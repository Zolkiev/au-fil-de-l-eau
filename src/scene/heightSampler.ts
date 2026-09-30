import { DoubleSide, Mesh, Vector3, type Material, type Object3D } from 'three';

/** En dessous de cette aire (m²), un triangle vu de dessus est vertical : il ne porte pas de hauteur. */
const MIN_AREA = 1e-6;

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

/** Une surface du décor à la verticale d'un point. */
export interface Surface {
  readonly height: number;
  /** Vrai si la face regarde vers le haut (sol, dessus d'un rocher), faux vers le bas (dessous d'un ponton). */
  readonly up: boolean;
}

/**
 * Hauteur du décor vue de dessus, sans lancer de rayons.
 * Les triangles sont rangés dans une grille de cases (plan XZ) : une requête
 * ne teste que les quelques triangles de sa case. Indispensable pour les
 * terrains détaillés venus de Blender (dizaines de milliers de triangles).
 */
export class HeightSampler {
  private readonly cellSize: number;
  /** Triangles à plat : ax, ay, az, bx, by, bz, cx, cy, cz, … (coordonnées monde). */
  private readonly tris: number[] = [];
  /** Orientation de chaque triangle : vers le haut (true) ou vers le bas. */
  private readonly facingUp: boolean[] = [];
  private readonly cells = new Map<string, number[]>();

  /** `roots` : objets dont les meshes visibles forment le décor. */
  constructor(roots: readonly Object3D[], cellSize = 4) {
    this.cellSize = cellSize;
    for (const root of roots) {
      root.updateMatrixWorld(true);
      root.traverseVisible((object) => {
        if (object instanceof Mesh) this.addMesh(object);
      });
    }
  }

  /** Hauteur de la plus haute surface à la verticale de (x, z), ou null s'il n'y a rien. */
  heightAt(x: number, z: number): number | null {
    let best: number | null = null;
    for (const surface of this.surfacesAt(x, z)) {
      if (best === null || surface.height > best) best = surface.height;
    }
    return best;
  }

  /**
   * Sol pour un point en l'air (x, y, z) :
   * - si la première surface au-dessus du point regarde vers le haut, le
   *   point est dans le décor (une colline) : c'est cette surface ;
   * - sinon (ciel, ou dessous d'un pont) : la surface tournée vers le haut la
   *   plus haute sous le point.
   * Retourne null s'il n'y a rien.
   */
  groundAt(x: number, z: number, y: number): number | null {
    let above: Surface | null = null;
    let below: number | null = null;
    for (const surface of this.surfacesAt(x, z)) {
      if (surface.height > y) {
        if (!above || surface.height < above.height) above = surface;
      } else if (surface.up && (below === null || surface.height > below)) {
        below = surface.height;
      }
    }
    return above?.up ? above.height : below;
  }

  /** Toutes les surfaces à la verticale de (x, z), avec leur orientation. */
  surfacesAt(x: number, z: number): Surface[] {
    const candidates = this.cells.get(this.key(this.cell(x), this.cell(z))) ?? [];
    const surfaces: Surface[] = [];
    for (const index of candidates) {
      const height = this.heightInTriangle(index, x, z);
      if (height !== null) surfaces.push({ height, up: this.facingUp[index] });
    }
    return surfaces;
  }

  private addMesh(mesh: Mesh): void {
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    const vertex = (i: number, out: Vector3): Vector3 =>
      out.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    // Une surface visible des deux côtés compte toujours comme un sol
    const doubleSided = ([] as Material[]).concat(mesh.material).some((material) => material.side === DoubleSide);
    for (let i = 0; i + 2 < count; i += 3) this.addTriangle(vertex(i, _a), vertex(i + 1, _b), vertex(i + 2, _c), doubleSided);
  }

  private addTriangle(a: Vector3, b: Vector3, c: Vector3, doubleSided: boolean): void {
    // Composante verticale de la normale (b - a) × (c - a) : son signe donne l'orientation
    const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (Math.abs(normalY) / 2 < MIN_AREA) return;
    const index = this.tris.length / 9;
    this.tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.facingUp.push(doubleSided || normalY > 0);
    const [minX, maxX] = [Math.min(a.x, b.x, c.x), Math.max(a.x, b.x, c.x)];
    const [minZ, maxZ] = [Math.min(a.z, b.z, c.z), Math.max(a.z, b.z, c.z)];
    for (let i = this.cell(minX); i <= this.cell(maxX); i++) {
      for (let j = this.cell(minZ); j <= this.cell(maxZ); j++) {
        const key = this.key(i, j);
        const list = this.cells.get(key);
        if (list) list.push(index);
        else this.cells.set(key, [index]);
      }
    }
  }

  /** Hauteur du triangle au-dessus de (x, z) (coordonnées barycentriques), ou null si le point est dehors. */
  private heightInTriangle(index: number, x: number, z: number): number | null {
    const t = this.tris;
    const o = index * 9;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [t[o], t[o + 1], t[o + 2], t[o + 3], t[o + 4], t[o + 5], t[o + 6], t[o + 7], t[o + 8]];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
    const w = 1 - u - v;
    if (u < -1e-6 || v < -1e-6 || w < -1e-6) return null;
    return u * ay + v * by + w * cy;
  }

  private cell(value: number): number {
    return Math.floor(value / this.cellSize);
  }

  private key(i: number, j: number): string {
    return `${i}:${j}`;
  }
}
