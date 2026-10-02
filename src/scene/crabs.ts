import { BoxGeometry, Color, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D, SphereGeometry, type Box2, type BufferGeometry, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

interface Crab {
  /** Milieu de son va-et-vient, sur le sol. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Direction du va-et-vient (il marche de côté). */
  readonly dirX: number;
  readonly dirZ: number;
  readonly span: number;
  readonly phase: number;
  /** Où il est sur son trajet (-span → span), et où il va. */
  offset: number;
  target: number;
  /** Pause restante avant la prochaine course (s). */
  rest: number;
  /** 0 = sorti, 1 = enfoui dans le sable. */
  buried: number;
  /** Temps restant avant de ressortir (s). */
  hiding: number;
}

/** Écart minimal entre deux colonies (m), et rayon d'une colonie. */
const COLONY_SPACING = 12;
const COLONY_RADIUS = 1.8;
/** Écart minimal entre deux crabes d'une colonie (m). */
const MEMBER_SPACING = 0.7;
/** Il faut de l'eau à moins de… (m), et la barque doit pouvoir passer à moins de… (m). */
const WATER_WITHIN = 3;
const BOAT_WITHIN = 11;
const BURY_SECONDS = 0.35;

const _dummy = new Object3D();

/**
 * Crabes du bord de mer : de petites colonies sur le sable et les rochers
 * bas, tout près de l'eau. Ils trottinent de côté, s'arrêtent, repartent, et
 * s'enfouissent quand la barque approche. Un seul lot instancié.
 */
export class Crabs {
  readonly mesh: InstancedMesh;
  private readonly crabs: Crab[];

  constructor(water: WaterMap, bounds: Box2) {
    this.crabs = findColonies(water, bounds);
    const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 });
    this.mesh = new InstancedMesh(createCrabGeometry(), material, Math.max(1, this.crabs.length));
    this.mesh.name = 'crabs';
    this.mesh.count = this.crabs.length;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  update(dt: number, elapsed: number, boat: Vector3): void {
    this.crabs.forEach((crab, index) => {
      this.hide(crab, dt, boat);
      if (crab.buried === 0) this.scuttle(crab, dt);
      this.place(crab, index, elapsed);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** La barque approche : il s'enfouit, et ne ressort qu'un moment après son départ. */
  private hide(crab: Crab, dt: number, boat: Vector3): void {
    const { fleeDistance, hide } = CONFIG.waterLife.crabs;
    if (Math.hypot(crab.x - boat.x, crab.z - boat.z) < fleeDistance) crab.hiding = MathUtils.lerp(hide.min, hide.max, Math.random());
    crab.hiding = Math.max(0, crab.hiding - dt);
    const goal = crab.hiding > 0 ? 1 : 0;
    crab.buried = MathUtils.clamp(crab.buried + (Math.sign(goal - crab.buried) * dt) / BURY_SECONDS, 0, 1);
  }

  /** Course de côté jusqu'à un point de son trajet, puis une pause. */
  private scuttle(crab: Crab, dt: number): void {
    const { speed, rest } = CONFIG.waterLife.crabs;
    if (crab.rest > 0) {
      crab.rest -= dt;
      return;
    }
    const gap = crab.target - crab.offset;
    const step = speed * dt;
    if (Math.abs(gap) > step) {
      crab.offset += Math.sign(gap) * step;
      return;
    }
    crab.offset = crab.target;
    crab.target = MathUtils.lerp(-crab.span, crab.span, Math.random());
    crab.rest = MathUtils.lerp(rest.min, rest.max, Math.random());
  }

  private place(crab: Crab, index: number, elapsed: number): void {
    const { scale } = CONFIG.waterLife.crabs;
    const moving = crab.rest <= 0 && crab.buried === 0;
    // En courant, il se dandine ; enfoui, il s'enfonce et rétrécit
    const bob = moving ? Math.abs(Math.sin(elapsed * 14 + crab.phase)) * 0.012 : 0;
    _dummy.position.set(crab.x + crab.dirX * crab.offset, crab.y + bob - crab.buried * 0.06, crab.z + crab.dirZ * crab.offset);
    _dummy.rotation.set(0, Math.atan2(crab.dirX, crab.dirZ) + Math.PI / 2, 0);
    _dummy.scale.setScalar(scale * (1 - crab.buried));
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }
}

/** Cherche des coins de sable ou de rocher bas, près de l'eau et visibles depuis la barque, puis y installe les colonies. */
function findColonies(water: WaterMap, bounds: Box2): Crab[] {
  const { colonies, perColony } = CONFIG.waterLife.crabs;
  const centers: { x: number; z: number }[] = [];
  const crabs: Crab[] = [];
  for (let attempt = 0; attempt < 4000 && centers.length < colonies; attempt++) {
    const x = MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random());
    const z = MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random());
    if (centers.some((center) => Math.hypot(center.x - x, center.z - z) < COLONY_SPACING)) continue;
    if (!isCrabGround(water, x, z) || !isNearWater(water, x, z)) continue;
    const members = settle(water, x, z, perColony);
    if (members.length === 0) continue;
    centers.push({ x, z });
    crabs.push(...members);
  }
  return crabs;
}

/** Les crabes d'une colonie : chacun a son petit trajet, entièrement sur un sol bas et plat. */
function settle(water: WaterMap, x: number, z: number, count: number): Crab[] {
  const { span } = CONFIG.waterLife.crabs;
  const crabs: Crab[] = [];
  for (let attempt = 0; attempt < 60 && crabs.length < count; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * COLONY_RADIUS;
    const cx = x + Math.cos(angle) * reach;
    const cz = z + Math.sin(angle) * reach;
    const heading = Math.random() * Math.PI * 2;
    const dirX = Math.sin(heading);
    const dirZ = Math.cos(heading);
    const length = MathUtils.lerp(span.min, span.max, Math.random());
    const height = water.landHeightAt(cx, cz);
    const ends = [-length, length].map((offset) => water.landHeightAt(cx + dirX * offset, cz + dirZ * offset));
    // Tout le trajet à la même hauteur (à 5 cm près), sinon il flotterait ou s'enfoncerait en chemin
    if (height === null || !isCrabGround(water, cx, cz) || ends.some((end) => end === null || Math.abs(end - height) > 0.05)) continue;
    if (crabs.some((other) => Math.hypot(other.x - cx, other.z - cz) < MEMBER_SPACING)) continue;
    crabs.push({ x: cx, y: water.level + height, z: cz, dirX, dirZ, span: length, phase: Math.random() * 6, offset: 0, target: 0, rest: Math.random() * 3, buried: 0, hiding: 0 });
  }
  return crabs;
}

/** Sol bas et plat, juste au-dessus de l'eau. */
function isCrabGround(water: WaterMap, x: number, z: number): boolean {
  const { height } = CONFIG.waterLife.crabs;
  const top = water.landHeightAt(x, z);
  return top !== null && top >= height.min && top <= height.max && water.isFlatLand(x, z, 0.3, 0.09);
}

/** De l'eau tout près, et de l'eau libre (où passe la barque) pas loin : sinon personne ne les verrait. */
function isNearWater(water: WaterMap, x: number, z: number): boolean {
  let wet = false;
  let reachable = false;
  for (let k = 0; k < 12; k++) {
    const angle = (k / 12) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    wet ||= water.isWater(x + dx * WATER_WITHIN, z + dz * WATER_WITHIN) && water.landHeightAt(x + dx * WATER_WITHIN, z + dz * WATER_WITHIN) === null;
    reachable ||= water.isOpen(x + dx * BOAT_WITHIN, z + dz * BOAT_WITHIN, 0.5) || water.isOpen(x + dx * BOAT_WITHIN * 0.6, z + dz * BOAT_WITHIN * 0.6, 0.5);
  }
  return wet && reachable;
}

/** Crabe low poly posé en y = 0, face vers +Z (il marche le long de X) : carapace plate, deux pinces, yeux, six pattes. */
function createCrabGeometry(): BufferGeometry {
  const shell = new Color(CONFIG.waterLife.crabs.color);
  const dark = shell.clone().multiplyScalar(0.7);
  const parts: BufferGeometry[] = [tinted(new SphereGeometry(0.07, 6, 4).scale(1.35, 0.5, 1).translate(0, 0.045, 0), shell)];
  for (const side of [-1, 1]) {
    parts.push(tinted(new SphereGeometry(0.03, 5, 4).scale(1, 0.8, 1.3).translate(side * 0.085, 0.05, 0.07), shell));
    parts.push(tinted(new SphereGeometry(0.012, 4, 3).translate(side * 0.03, 0.085, 0.05), new Color(0x23262b)));
    for (const z of [-0.035, 0, 0.035]) {
      parts.push(tinted(new BoxGeometry(0.07, 0.012, 0.012).rotateZ(side * -0.5).translate(side * 0.115, 0.025, z - 0.01), dark));
    }
  }
  return merged(parts);
}
