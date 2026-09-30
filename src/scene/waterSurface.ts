import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import type { Footprint } from './footprint';
import type { HeightSampler, Surface } from './heightSampler';
import type { LevelData } from './levelLoader';
import { getWaterMaterial } from './water';

/** Au-delà, la grille est agrandie pour rester fluide. */
const MAX_CELLS = 40000;
/** Profondeur minimale enregistrée (terre émergée : île, rocher, berge). */
const MIN_DEPTH = -1;

/** Grille régulière posée sur l'emprise du plan d'eau. */
interface Grid {
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  readonly cell: number;
  /** Sommets utilisés par au moins une case d'eau (1) ou non (0). */
  readonly used: Uint8Array;
  readonly indices: number[];
}

/**
 * Surface d'eau jouable : une grille facettée qui remplace le mesh `water`
 * (souvent un simple quad dans Blender, trop pauvre pour onduler).
 * Chaque sommet connaît la profondeur de l'eau sous lui, mesurée sur le
 * décor visible (fond du lac, berges, îles…) : elle pilote le dégradé de
 * couleur, l'écume au bord et l'amortissement des vagues près de la rive.
 * `ground` : les surfaces du décor du niveau (voir HeightSampler).
 */
export function createWaterSurface(level: LevelData, ground: HeightSampler): Mesh {
  const grid = buildGrid(level.water.footprint);
  const depths = sampleDepths(grid, level.water.level, ground);
  const geometry = gridGeometry(grid, level.water.level, depths, smoothDepths(grid, depths));
  const surface = new Mesh(geometry, getWaterMaterial());
  surface.name = 'water_surface';
  surface.receiveShadow = true;
  return surface;
}

function buildGrid(footprint: Footprint): Grid {
  const { min, max } = footprint.bounds;
  const width = max.x - min.x;
  const depth = max.y - min.y;
  const cell = Math.max(CONFIG.water.cellSize, Math.sqrt((width * depth) / MAX_CELLS));
  if (cell > CONFIG.water.cellSize) info('eau', `plan d’eau très grand : facettes de ${cell.toFixed(1)} m.`);
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(depth / cell) + 1;
  const grid: Grid = { cols, rows, minX: min.x, minZ: min.y, cell, used: new Uint8Array((cols + 1) * (rows + 1)), indices: [] };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (footprint.contains(grid.minX + (i + 0.5) * cell, grid.minZ + (j + 0.5) * cell)) addCell(grid, i, j);
    }
  }
  return grid;
}

/** Deux triangles par case, orientés vers le haut. */
function addCell(grid: Grid, i: number, j: number): void {
  const a = vertexIndex(grid, i, j);
  const b = vertexIndex(grid, i + 1, j);
  const c = vertexIndex(grid, i, j + 1);
  const d = vertexIndex(grid, i + 1, j + 1);
  grid.indices.push(a, c, b, b, c, d);
  grid.used[a] = grid.used[b] = grid.used[c] = grid.used[d] = 1;
}

function vertexIndex(grid: Grid, i: number, j: number): number {
  return j * (grid.cols + 1) + i;
}

/** Profondeur sous chaque sommet (profondeur par défaut s'il n'y a pas de fond modélisé). */
function sampleDepths(grid: Grid, waterLevel: number, ground: HeightSampler): Float32Array {
  const depths = new Float32Array(grid.used.length).fill(CONFIG.water.defaultDepth);
  forEachUsedVertex(grid, (index, x, z) => {
    const depth = depthAt(ground.surfacesAt(x, z), waterLevel);
    if (depth !== null) depths[index] = depth;
  });
  return depths;
}

/**
 * Profondeur de l'eau d'après les surfaces du décor à la verticale d'un point :
 * - la plus haute surface tournée vers le haut est sous l'eau → c'est le fond ;
 * - elle sort de l'eau sans rien dessous (île, rocher, berge) → terre (négatif) ;
 * - elle sort de l'eau mais a un dessous au-dessus de l'eau (tablier d'un
 *   ponton) → c'est un surplomb : on regarde ce qu'il y a en dessous. S'il
 *   n'y a rien (le tablier est posé dans la berge), c'est de la terre.
 * Retourne null s'il n'y a aucun fond.
 */
function depthAt(surfaces: readonly Surface[], waterLevel: number): number | null {
  let ceiling = Infinity;
  let above: Surface | null = null;
  for (;;) {
    const top = highest(surfaces, (s) => s.up && s.height < ceiling);
    if (!top) return above ? dryDepth(above, waterLevel) : null;
    if (top.height <= waterLevel) return waterLevel - top.height;
    const overhang = highest(surfaces, (s) => !s.up && s.height > waterLevel && s.height < top.height);
    if (!overhang) return dryDepth(top, waterLevel);
    above = top;
    ceiling = overhang.height;
  }
}

/** Surface hors de l'eau : profondeur négative, bornée (l'écume n'a besoin que du bord). */
function dryDepth(surface: Surface, waterLevel: number): number {
  return Math.max(waterLevel - surface.height, MIN_DEPTH);
}

function highest(surfaces: readonly Surface[], keep: (surface: Surface) => boolean): Surface | null {
  let best: Surface | null = null;
  for (const surface of surfaces) {
    if (keep(surface) && (!best || surface.height > best.height)) best = surface;
  }
  return best;
}

/** Version lissée (flou sur la grille) pour un dégradé de couleur sans cassure. */
function smoothDepths(grid: Grid, depths: Float32Array): Float32Array {
  let current = depths.map((depth) => Math.max(depth, 0));
  for (let pass = 0; pass < CONFIG.water.depthSmoothing; pass++) {
    const next = new Float32Array(current);
    forEachUsedVertex(grid, (index, _x, _z, i, j) => (next[index] = neighbourAverage(grid, current, i, j)));
    current = next;
  }
  return current;
}

function neighbourAverage(grid: Grid, values: Float32Array, i: number, j: number): number {
  let sum = 0;
  let count = 0;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni > grid.cols || nj > grid.rows) continue;
      const index = vertexIndex(grid, ni, nj);
      if (!grid.used[index]) continue;
      sum += values[index];
      count += 1;
    }
  }
  return sum / count;
}

function gridGeometry(grid: Grid, waterLevel: number, depths: Float32Array, smooth: Float32Array): BufferGeometry {
  const positions = new Float32Array(grid.used.length * 3);
  const normals = new Float32Array(grid.used.length * 3);
  for (let j = 0; j <= grid.rows; j++) {
    for (let i = 0; i <= grid.cols; i++) {
      const index = vertexIndex(grid, i, j);
      positions.set([grid.minX + i * grid.cell, waterLevel, grid.minZ + j * grid.cell], index * 3);
      normals[index * 3 + 1] = 1;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('depth', new BufferAttribute(depths, 1));
  geometry.setAttribute('depthSmooth', new BufferAttribute(smooth, 1));
  geometry.setIndex(grid.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function forEachUsedVertex(grid: Grid, visit: (index: number, x: number, z: number, i: number, j: number) => void): void {
  for (let j = 0; j <= grid.rows; j++) {
    for (let i = 0; i <= grid.cols; i++) {
      const index = vertexIndex(grid, i, j);
      if (grid.used[index]) visit(index, grid.minX + i * grid.cell, grid.minZ + j * grid.cell, i, j);
    }
  }
}
