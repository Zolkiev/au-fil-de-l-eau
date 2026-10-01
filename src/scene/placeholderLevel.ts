import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { CONFIG } from '../config';

/*
 * Niveau de secours en primitives Three.js, utilisé quand
 * assets/levels/lake_01.glb est absent.
 *
 * Il respecte EXACTEMENT les conventions de nommage Blender et passe par le
 * même parseur (levelLoader) qu'un vrai .glb : c'est aussi un exemple vivant
 * de ce qu'on attend d'un niveau. Ses positions sont exprimées en fractions
 * du rayon du lac (CONFIG.placeholder.lakeRadius).
 */

const PALETTE = {
  sand: 0xd8c59a,
  grass: 0x9dc27b,
  trunk: 0x8a6a4f,
  leaves: [0x5f9e6e, 0x71ad73, 0x4f8a67],
  rock: 0xa9aaa4,
  reeds: 0xb9c56d,
  hill: 0x93b98c,
};

/** Rochers dans l'eau : [x / rayon, z / rayon, taille]. */
const ROCKS: readonly (readonly [number, number, number])[] = [
  [-0.47, 0.32, 1.6],
  [-0.41, 0.38, 1.1],
  [-0.53, 0.26, 0.9],
];

type Random = () => number;

export function buildPlaceholderLevel(): Group {
  const { lakeRadius: r, groundRadius, seed } = CONFIG.placeholder;
  const random = createRandom(seed);
  const root = new Group();
  root.name = 'placeholder_lake_01';
  root.add(
    named(new Mesh(new CircleGeometry(r + 3, 64).rotateX(-Math.PI / 2)), 'water'),
    createBank(r, groundRadius),
    named(new Mesh(new RingGeometry(r - 1.5, groundRadius, 64, 1).rotateX(-Math.PI / 2)), 'shore_col'),
    ...createMarkers(r),
    ...createFishPen(r),
    ...createCampfire(r),
    ...createFinds(r),
    ...createZones(r),
    ...createIsland(r),
    ...createRocks(r),
    createReeds(r, random),
    ...createTrees(r, random),
    ...createHills(random),
  );
  return root;
}

/** Empties de départ de la barque et de caméra, et Moustache assis sur la berge. */
function createMarkers(r: number): Object3D[] {
  const spawnZ = -0.55 * r; // cap 0 : la barque regarde vers +Z, donc vers le centre du lac
  const cam = CONFIG.camera.defaultOffset;
  return [
    createEmpty('spawn_boat', 0, 0, spawnZ),
    createEmpty('cam_default', cam.x, cam.y, spawnZ + cam.z),
    createCatMarker(r),
  ];
}

/** Sur la berge (où le sol est à 0,5 m), devant à gauche de la barque, tourné vers le centre du lac. */
function createCatMarker(r: number): Object3D {
  const angle = -Math.PI / 3;
  const x = Math.sin(angle) * (r + 2.5);
  const z = Math.cos(angle) * (r + 2.5);
  const marker = createEmpty('npc_cat', x, 0.5, z);
  marker.rotation.y = Math.atan2(-x, -z);
  return marker;
}

/**
 * Vivier : un bac en bois ouvert posé sur la berge, près de Moustache, et
 * l'Empty `fish_pen` au centre de la surface de son eau (échelle = rayon).
 */
function createFishPen(r: number): Object3D[] {
  const angle = -Math.PI / 3.6;
  const x = Math.sin(angle) * (r + 5);
  const z = Math.cos(angle) * (r + 5);
  const base = 0.55;
  const floor = 0.78;
  const top = floor + 0.6;
  const wood = new MeshStandardMaterial({ color: 0x9a6b47, flatShading: true, roughness: 0.9, side: DoubleSide });
  const walls = new Mesh(new CylinderGeometry(1.25, 1.25, top - base, 16, 1, true), wood);
  walls.position.set(x, (base + top) / 2, z);
  const bottom = new Mesh(new CircleGeometry(1.2, 16).rotateX(-Math.PI / 2), material(0x6f4a32));
  bottom.position.set(x, floor, z);
  const tub = named(new Group(), 'deco_fish_pen');
  tub.add(walls, bottom);
  return [tub, createEmpty('fish_pen', x, top - 0.08, z, 1.15)];
}

/**
 * Feu de camp sur la berge, de l'autre côté de la barque : un cercle de
 * pierres, et l'Empty `fx_fire_1` où le jeu allume les flammes.
 */
function createCampfire(r: number): Object3D[] {
  const angle = Math.PI / 3.4;
  const x = Math.sin(angle) * (r + 4.5);
  const z = Math.cos(angle) * (r + 4.5);
  const ground = 0.68;
  const stones = named(new Group(), 'deco_campfire');
  for (let i = 0; i < 7; i++) {
    const stone = new Mesh(new DodecahedronGeometry(0.17, 0), material(PALETTE.rock));
    const around = (i / 7) * Math.PI * 2;
    stone.position.set(x + Math.cos(around) * 0.6, ground + 0.05, z + Math.sin(around) * 0.6);
    stone.rotation.set(i, i * 1.3, 0);
    stones.add(stone);
  }
  return [stones, createEmpty('fx_fire_1', x, ground + 0.1, z)];
}

/** Coins à trouvailles (`find_<n>`) : quelques points d'eau libre, loin du départ. */
function createFinds(r: number): Object3D[] {
  const spots: readonly (readonly [number, number])[] = [
    [0.7, 0.25],
    [-0.2, 0.75],
    [0.45, 0.65],
    [-0.75, 0.35],
    [0.6, -0.2],
  ];
  return spots.map(([fx, fz], index) => createEmpty(`find_${index + 1}`, fx * r, 0, fz * r));
}

/** Zones de pêche en Empties : l'échelle de l'Empty est le rayon de la zone. */
function createZones(r: number): Object3D[] {
  return [
    createEmpty('zone_shallow_1', -0.15 * r, 0, -0.72 * r, 0.2 * r),
    createEmpty('zone_shallow_2', -0.75 * r, 0, -0.1 * r, 0.15 * r),
    createEmpty('zone_deep_1', -0.1 * r, 0, 0.05 * r, 0.25 * r),
    createEmpty('zone_reeds_1', 0.63 * r, 0, -0.55 * r, 0.18 * r),
    createEmpty('zone_rocks_1', -0.45 * r, 0, 0.3 * r, 0.17 * r),
  ];
}

/**
 * Fond du lac et berge en pente douce (sable au bord de l'eau, herbe
 * au-delà). Le fond sert à mesurer la profondeur de l'eau (dégradé, écume).
 */
function createBank(r: number, groundRadius: number): Mesh {
  const profile = [
    new Vector2(0.01, -4.5),
    new Vector2(0.4 * r, -4.2),
    new Vector2(0.75 * r, -3),
    new Vector2(r - 5, -1.6),
    new Vector2(r - 1, -0.3),
    new Vector2(r + 2.5, 0.5),
    new Vector2(r + 7, 0.8),
    new Vector2(groundRadius, 0.8),
  ];
  const geometry = new LatheGeometry(profile, 48);
  paintByDistance(geometry, r + 3, PALETTE.sand, PALETTE.grass);
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: DoubleSide });
  return named(new Mesh(geometry, material), 'deco_bank');
}

/** Couleurs de sommets : `near` en deçà de `limit` (distance au centre), `far` au-delà. */
function paintByDistance(geometry: BufferGeometry, limit: number, near: number, far: number): void {
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const nearColor = new Color(near);
  const farColor = new Color(far);
  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.getX(i), position.getZ(i));
    const color = distance < limit ? nearColor : farColor;
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

function createIsland(r: number): Object3D[] {
  const x = 0.2 * r;
  const z = 0.26 * r;
  // Pente douce sous l'eau : l'écume se voit tout autour de l'île
  const island = named(new Mesh(new CylinderGeometry(3.2, 5.5, 2, 9), material(PALETTE.sand)), 'deco_island');
  island.position.set(x, -0.2, z);
  const tree = named(createTree(1.1, PALETTE.leaves[0]), 'deco_island_tree_sway');
  tree.position.set(x, 0.8, z);
  const collider = named(new Mesh(new CylinderGeometry(4.4, 4.4, 1, 12)), 'island_col');
  collider.position.set(x, 0, z);
  return [island, tree, collider];
}

function createRocks(r: number): Object3D[] {
  return ROCKS.flatMap(([fx, fz, size], i) => {
    const rock = named(new Mesh(new DodecahedronGeometry(size, 0), material(PALETTE.rock)), `deco_rock_${i + 1}`);
    rock.position.set(fx * r, size * 0.2, fz * r);
    rock.scale.set(1.2, 0.8, 1);
    rock.rotation.set(0.3, i * 1.7, 0.1);
    const collider = named(new Mesh(new CylinderGeometry(size * 1.15, size * 1.15, 1, 10)), `rock_${i + 1}_col`);
    collider.position.set(fx * r, 0, fz * r);
    return [rock, collider];
  });
}

/** Touffe de roseaux près de la rive (la barque peut les traverser). */
function createReeds(r: number, random: Random): Group {
  const reeds = named(new Group(), 'deco_reeds_1_sway');
  reeds.position.set(0.66 * r, 0, -0.58 * r);
  const geometry = new ConeGeometry(0.06, 1.8, 4);
  for (let i = 0; i < 40; i++) {
    const stem = new Mesh(geometry, material(PALETTE.reeds));
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 3.5;
    stem.position.set(Math.cos(angle) * distance, 0.6, Math.sin(angle) * distance);
    stem.scale.y = 0.6 + random() * 0.8;
    stem.rotation.set((random() - 0.5) * 0.3, 0, (random() - 0.5) * 0.3);
    reeds.add(stem);
  }
  return reeds;
}

/** Sapins en couronne autour du lac. */
function createTrees(r: number, random: Random): Object3D[] {
  const trees: Object3D[] = [];
  for (let i = 0; i < CONFIG.placeholder.treeCount; i++) {
    const color = PALETTE.leaves[i % PALETTE.leaves.length];
    const tree = named(createTree(0.8 + random() * 0.7, color), `deco_tree_${i + 1}_sway`);
    const angle = random() * Math.PI * 2;
    const distance = r + 8 + random() * 45;
    tree.position.set(Math.cos(angle) * distance, 0.8, Math.sin(angle) * distance);
    tree.rotation.y = random() * Math.PI;
    trees.push(tree);
  }
  return trees;
}

function createTree(scale: number, leavesColor: number): Group {
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.22, 0.3, 1.4, 6), material(PALETTE.trunk));
  trunk.position.y = 0.7;
  const lower = new Mesh(new ConeGeometry(1.7, 3, 7), material(leavesColor));
  lower.position.y = 2.6;
  const upper = new Mesh(new ConeGeometry(1.15, 2.2, 7), material(leavesColor));
  upper.position.y = 4;
  tree.add(trunk, lower, upper);
  tree.scale.setScalar(scale);
  return tree;
}

/** Collines lointaines, à moitié dans le brouillard. */
function createHills(random: Random): Object3D[] {
  const hills: Object3D[] = [];
  const geometry = new IcosahedronGeometry(1, 1);
  for (let i = 0; i < 8; i++) {
    const hill = named(new Mesh(geometry, material(PALETTE.hill)), `deco_hill_${i + 1}`);
    const angle = (i / 8) * Math.PI * 2 + random() * 0.5;
    const distance = 140 + random() * 40;
    hill.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    hill.scale.set(30 + random() * 20, 12 + random() * 14, 30 + random() * 20);
    hills.push(hill);
  }
  return hills;
}

/** Empty (Object3D vide). `scale` sert de rayon pour les zones. */
function createEmpty(name: string, x: number, y: number, z: number, scale = 1): Object3D {
  const empty = named(new Object3D(), name);
  empty.position.set(x, y, z);
  empty.scale.setScalar(scale);
  return empty;
}

function named<T extends Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

const materials = new Map<number, MeshStandardMaterial>();

/** Matériau low poly (facettes visibles), partagé par couleur. */
function material(color: number): MeshStandardMaterial {
  let cached = materials.get(color);
  if (!cached) {
    cached = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    materials.set(color, cached);
  }
  return cached;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même décor à chaque partie. */
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

