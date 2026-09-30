import { Box3, Mesh, Vector2, Vector3, type Object3D } from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import { info, warn } from '../core/log';
import { Footprint } from './footprint';
import { blenderName } from './objectNames';
import { buildPlaceholderLevel } from './placeholderLevel';
import { createFallbackWater } from './water';

/*
 * Lecture d'un niveau exporté de Blender (.glb).
 *
 * Aucune position n'est codée en dur : tout vient des NOMS d'objets
 * (voir docs/BLENDER_CONVENTIONS.md). Chaque élément manquant est remplacé
 * par une valeur de secours accompagnée d'un warning : le jeu reste jouable.
 */

const SCOPE = 'levelLoader';
const UP = new Vector3(0, 1, 0);

export const ZONE_TYPES = ['shallow', 'deep', 'reeds', 'rocks'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

/** Zone de pêche : un Empty (cercle) ou un mesh (son empreinte vue de dessus). */
export interface FishingZone {
  /** Nom de l'objet dans la scène (unique). */
  readonly name: string;
  readonly type: ZoneType;
  /** Le <n> de `zone_<type>_<n>`. */
  readonly index: number;
  readonly object: Object3D;
  readonly center: Vector3;
  /** Rayon d'une zone Empty ; null pour une zone mesh. */
  readonly radius: number | null;
  /** Aire vue de dessus (m²), pour départager des zones qui se chevauchent. */
  readonly area: number;
  contains(x: number, z: number): boolean;
}

export interface SpawnPoint {
  /** Position de départ, ramenée à la surface de l'eau. */
  readonly position: Vector3;
  /** Cap initial en radians (0 = vers +Z, c'est-à-dire -Y dans Blender). */
  readonly yaw: number;
}

/** Repère posé dans le niveau : position de l'Empty et cap. */
export interface Marker {
  readonly position: Vector3;
  /** Cap en radians (0 = vers +Z, c'est-à-dire -Y dans Blender). */
  readonly yaw: number;
}

/** Vivier de la cabane : le bac où nagent les poissons gardés. */
export interface PenInfo {
  /** Centre de la surface de l'eau du bac (position de l'Empty `fish_pen`). */
  readonly center: Vector3;
  /** Rayon de l'eau du bac (échelle de l'Empty, comme une zone). */
  readonly radius: number;
  /** Point de vue de la vue rapprochée (`cam_fish_pen`) ; null = calculé. */
  readonly view: Vector3 | null;
}

export interface WaterInfo {
  /** Objets `water` d'origine, masqués : la surface jouable est recréée par waterSurface.ts. */
  readonly objects: readonly Object3D[];
  /** Hauteur de la surface (point le plus haut du premier objet `water`). */
  readonly level: number;
  readonly footprint: Footprint;
}

export interface ColliderInfo {
  /** Objets `*_col`, masqués. */
  readonly objects: readonly Object3D[];
  readonly footprint: Footprint;
}

export interface LevelData {
  readonly source: 'glb' | 'placeholder';
  /** Racine à ajouter à la scène. */
  readonly root: Object3D;
  readonly spawn: SpawnPoint;
  /** Position de `cam_default` dans le repère de la barque au départ ; null si absent. */
  readonly cameraOffset: Vector3 | null;
  readonly water: WaterInfo;
  readonly zones: readonly FishingZone[];
  readonly colliders: ColliderInfo;
  readonly decor: readonly Object3D[];
  /** Où s'assoit Moustache, le chat des demandes (`npc_cat`) ; null s'il est absent. */
  readonly cat: Marker | null;
  /** Vivier (`fish_pen`) ; null s'il est absent. */
  readonly pen: PenInfo | null;
  /** Courant de l'eau (m/s, x et z) d'après l'Empty `water_flow` ; nul s'il est absent (lac). */
  readonly flow: Vector2;
  /** Décor qui ondule au vent : les objets `deco_*` dont le nom finit par `_sway` (arbres, roseaux). */
  readonly sway: readonly Object3D[];
}

type Role = 'spawn' | 'camera' | 'water' | 'zone' | 'collider' | 'decor' | 'cat' | 'pen' | 'penCamera' | 'flow';
type ZoneBase = Pick<FishingZone, 'name' | 'type' | 'index' | 'object'>;

/** Charge le niveau .glb, ou le niveau placeholder s'il est absent. */
export async function loadLevel(path: string = CONFIG.assets.level): Promise<LevelData> {
  const gltf = await loadGLB(path, 'Niveau');
  if (gltf) return parseLevel(gltf.scene, 'glb');
  return parseLevel(buildPlaceholderLevel(), 'placeholder');
}

/** Extrait la structure typée d'un niveau à partir des noms de ses objets. */
export function parseLevel(root: Object3D, source: LevelData['source']): LevelData {
  root.updateMatrixWorld(true);
  const found = classify(root);
  setupShadows(found.decor);
  const water = readWater(root, found.water);
  const spawn = readSpawn(found.spawn, water);
  return {
    source,
    root,
    spawn,
    water,
    cameraOffset: readCameraOffset(found.camera, spawn),
    zones: readZones(found.zone),
    colliders: readColliders(found.collider),
    decor: found.decor,
    cat: readCat(found.cat),
    pen: readPen(found.pen, found.penCamera),
    flow: readFlow(found.flow),
    sway: found.decor.filter((object) => blenderName(object).endsWith('_sway')),
  };
}

/**
 * Ombres du décor : tout le décor les reçoit ; tout sauf le terrain en
 * projette (le relief est doux, et c'est la plus grande surface à dessiner).
 */
function setupShadows(decor: readonly Object3D[]): void {
  for (const object of decor) {
    const ground = blenderName(object).startsWith('deco_terrain');
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.receiveShadow = true;
      child.castShadow = !ground;
    });
  }
}

/**
 * Zone de pêche au point (x, z), ou null en eau libre.
 * Si des zones se chevauchent, la plus petite (la plus précise) l'emporte :
 * une touffe de roseaux au milieu d'une grande zone peu profonde, par exemple.
 */
export function zoneAt(zones: readonly FishingZone[], x: number, z: number): FishingZone | null {
  let best: FishingZone | null = null;
  for (const zone of zones) {
    if (zone.contains(x, z) && (!best || zone.area < best.area)) best = zone;
  }
  return best;
}

/** Rôle d'un objet d'après son nom, ou null s'il ne suit aucune convention. */
function roleOf(name: string): Role | null {
  if (name === 'spawn_boat') return 'spawn';
  if (name === 'cam_default') return 'camera';
  if (name === 'npc_cat') return 'cat';
  if (name === 'fish_pen') return 'pen';
  if (name === 'cam_fish_pen') return 'penCamera';
  if (name === 'water_flow') return 'flow';
  if (name === 'water') return 'water';
  if (name.startsWith('zone_')) return 'zone';
  if (name.endsWith('_col')) return 'collider';
  if (name.startsWith('deco_')) return 'decor';
  return null;
}

/** Range les objets par rôle. On ne descend pas dans un objet déjà reconnu. */
function classify(root: Object3D): Record<Role, Object3D[]> {
  const found: Record<Role, Object3D[]> = { spawn: [], camera: [], water: [], zone: [], collider: [], decor: [], cat: [], pen: [], penCamera: [], flow: [] };
  const unknown: string[] = [];
  const visit = (object: Object3D): void => {
    const role = roleOf(blenderName(object));
    if (role) {
      found[role].push(object);
      return;
    }
    if (object instanceof Mesh) unknown.push(blenderName(object));
    object.children.forEach(visit);
  };
  root.children.forEach(visit);
  if (unknown.length > 0) info(SCOPE, `objets sans convention, rendus tels quels : ${unknown.join(', ')}`);
  return found;
}

function readWater(root: Object3D, found: Object3D[]): WaterInfo {
  const objects = found.length > 0 ? found : [addFallbackWater(root)];
  const water = { objects, level: surfaceHeight(objects[0]), footprint: Footprint.fromObjects(objects) };
  objects.forEach((object) => (object.visible = false));
  return water;
}

function addFallbackWater(root: Object3D): Object3D {
  warn(SCOPE, 'aucun objet « water » → plan d’eau de secours créé en y = 0.');
  const water = createFallbackWater(CONFIG.level.fallbackWaterSize);
  root.add(water);
  water.updateMatrixWorld(true);
  return water;
}

function surfaceHeight(water: Object3D): number {
  const box = new Box3().setFromObject(water);
  if (!box.isEmpty()) return box.max.y;
  warn(SCOPE, '« water » ne contient aucun mesh → surface supposée en y = 0.');
  return 0;
}

function readSpawn(found: Object3D[], water: WaterInfo): SpawnPoint {
  const empty = pickOne(found, 'spawn_boat');
  if (!empty) {
    warn(SCOPE, '« spawn_boat » absent → départ au centre du plan d’eau.');
    const center = water.footprint.bounds.getCenter(new Vector2());
    return { position: new Vector3(center.x, water.level, center.y), yaw: 0 };
  }
  const position = empty.getWorldPosition(new Vector3()).setY(water.level);
  return { position, yaw: yawOf(empty) };
}

/** Moustache est facultatif : sans `npc_cat`, ses demandes restent accessibles par le bouton 🐈. */
function readCat(found: Object3D[]): Marker | null {
  const empty = pickOne(found, 'npc_cat');
  if (!empty) {
    info(SCOPE, 'pas d’Empty « npc_cat » : Moustache n’apparaît pas dans le décor (demandes par le bouton 🐈).');
    return null;
  }
  return { position: empty.getWorldPosition(new Vector3()), yaw: yawOf(empty) };
}

/** Vivier facultatif : sans `fish_pen`, les poissons gardés restent dans la liste du ponton. */
function readPen(found: Object3D[], cameras: Object3D[]): PenInfo | null {
  const empty = pickOne(found, 'fish_pen');
  if (!empty) {
    info(SCOPE, 'pas d’Empty « fish_pen » : pas de vivier dans le décor (les poissons gardés restent listés au ponton).');
    return null;
  }
  const scale = empty.getWorldScale(new Vector3());
  const camera = pickOne(cameras, 'cam_fish_pen');
  return {
    center: empty.getWorldPosition(new Vector3()),
    radius: Math.max(scale.x, scale.z) * CONFIG.level.emptyZoneRadius,
    view: camera ? camera.getWorldPosition(new Vector3()) : null,
  };
}

/**
 * Courant d'une rivière : l'Empty `water_flow` pointe vers l'aval (son avant,
 * -Y dans Blender) et son échelle donne la vitesse en m/s. Sans lui, l'eau
 * est calme.
 */
function readFlow(found: Object3D[]): Vector2 {
  const empty = pickOne(found, 'water_flow');
  if (!empty) return new Vector2();
  const yaw = yawOf(empty);
  const speed = empty.getWorldScale(new Vector3()).x;
  return new Vector2(Math.sin(yaw) * speed, Math.cos(yaw) * speed);
}

/** Cap d'un objet : angle de son axe local +Z (= -Y dans Blender) autour de la verticale. */
function yawOf(object: Object3D): number {
  const forward = new Vector3(0, 0, 1).transformDirection(object.matrixWorld);
  return Math.atan2(forward.x, forward.z);
}

/** Exprime `cam_default` dans le repère de la barque posée au spawn. */
function readCameraOffset(found: Object3D[], spawn: SpawnPoint): Vector3 | null {
  const empty = pickOne(found, 'cam_default');
  if (!empty) {
    warn(SCOPE, '« cam_default » absent → position de caméra par défaut (config.ts).');
    return null;
  }
  const offset = empty.getWorldPosition(new Vector3()).sub(spawn.position);
  return offset.applyAxisAngle(UP, -spawn.yaw);
}

function readZones(found: Object3D[]): FishingZone[] {
  if (found.length === 0) warn(SCOPE, 'aucune zone « zone_<type>_<n> » trouvée.');
  found.forEach((object) => (object.visible = false));
  return found.map((object) => readZone(object)).filter((zone) => zone !== null);
}

function readZone(object: Object3D): FishingZone | null {
  const name = blenderName(object);
  const match = /^zone_([a-z]+)_(\d+)$/.exec(name);
  const type = match?.[1];
  if (!match || !isZoneType(type)) {
    warn(SCOPE, `zone « ${name} » ignorée : nom attendu zone_<${ZONE_TYPES.join('|')}>_<numéro>.`);
    return null;
  }
  const base: ZoneBase = { name, type, index: Number(match[2]), object };
  return hasMesh(object) ? meshZone(base) : circleZone(base);
}

function isZoneType(value: string | undefined): value is ZoneType {
  return ZONE_TYPES.includes(value as ZoneType);
}

/** Zone Empty : cercle horizontal dont le rayon est l'échelle de l'Empty. */
function circleZone(base: ZoneBase): FishingZone {
  const center = base.object.getWorldPosition(new Vector3());
  const scale = base.object.getWorldScale(new Vector3());
  const radius = Math.max(scale.x, scale.z) * CONFIG.level.emptyZoneRadius;
  const radiusSq = radius * radius;
  const contains = (x: number, z: number): boolean => (x - center.x) ** 2 + (z - center.z) ** 2 <= radiusSq;
  return { ...base, center, radius, area: Math.PI * radiusSq, contains };
}

/** Zone mesh : son empreinte vue de dessus. */
function meshZone(base: ZoneBase): FishingZone {
  const footprint = Footprint.fromObjects([base.object]);
  const center = new Box3().setFromObject(base.object).getCenter(new Vector3());
  const contains = (x: number, z: number): boolean => footprint.contains(x, z);
  return { ...base, center, radius: null, area: footprint.area, contains };
}

function readColliders(found: Object3D[]): ColliderInfo {
  found.forEach((object) => (object.visible = false));
  const footprint = Footprint.fromObjects(found);
  if (found.length === 0) warn(SCOPE, 'aucun mesh « *_col » → la barque est seulement limitée au plan d’eau.');
  else if (footprint.isEmpty) warn(SCOPE, 'les objets « *_col » ne contiennent aucun triangle → collisions ignorées.');
  return { objects: found, footprint };
}

function hasMesh(object: Object3D): boolean {
  let found = false;
  object.traverse((child) => {
    if (child instanceof Mesh) found = true;
  });
  return found;
}

function pickOne(found: Object3D[], name: string): Object3D | null {
  if (found.length > 1) warn(SCOPE, `${found.length} objets « ${name} » trouvés → seul le premier est utilisé.`);
  return found[0] ?? null;
}
