import { Color, ConeGeometry, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D, SphereGeometry, Vector2, type BufferGeometry, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { wrapAngle } from '../core/math';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

/** Couleurs d'un oiseau posé sur l'eau : corps, tête, bec ; `others` teinte ceux qui suivent le premier. */
export interface DuckPalette {
  readonly body: number;
  readonly head: number;
  readonly beak: number;
  readonly others: number;
}

/** Canards colverts : le mâle en tête (tête verte), des canes brunes derrière. */
export const MALLARDS: DuckPalette = { body: 0xb5aa9a, head: 0x2f6b4f, beak: 0xe8b030, others: 0xd9b48a };
/** Mouettes posées, au bord de la mer. */
export const GULLS: DuckPalette = { body: 0xf4f4f0, head: 0xf4f4f0, beak: 0xf2c230, others: 0xe6e9ec };
/** Poules d'eau : sombres, bec rouge. */
export const MOORHENS: DuckPalette = { body: 0x3a3f45, head: 0x23262b, beak: 0xd9402b, others: 0xc9ccd0 };

/** Réglages d'une sorte d'oiseau posé sur l'eau (CONFIG.waterLife.ducks, CONFIG.waterLife.moorhens). */
export interface DuckSettings {
  readonly groups: number;
  readonly perGroup: number;
  readonly scale: number;
  readonly speed: number;
  readonly fleeSpeed: number;
  readonly fleeDistance: number;
  readonly roam: { readonly min: number; readonly max: number };
  readonly rest: { readonly min: number; readonly max: number };
  readonly minDepth: number;
  readonly spacing: number;
  readonly turn: number;
  readonly hearing: number;
  readonly nod: number;
  /** Ils ne s'éloignent pas de plus de cette distance de leur point de départ (m) ; 0 : ils vont où ils veulent. */
  readonly stay: number;
}

interface Duck {
  x: number;
  z: number;
  yaw: number;
  readonly phase: number;
}

/** Un petit groupe : le premier mène, les autres suivent à la file. */
interface Flock {
  readonly ducks: Duck[];
  /** Là où le groupe s'est installé au départ. */
  readonly home: Vector2;
  /** Où va le groupe ; null : il se repose. */
  target: Vector2 | null;
  /** Temps de repos restant avant la prochaine promenade (s). */
  rest: number;
  /** Temps de fuite restant (s) : ils nagent plus vite. */
  fleeing: number;
  /** Temps avant les prochains ronds dans l'eau (s). */
  ripple: number;
}

/** Ce que les canards annoncent au jeu. */
export interface DuckHooks {
  /** Un canard qui nage laisse un petit rond en (x, z). */
  readonly onRipple: (x: number, z: number) => void;
  /** Le groupe s'enfuit en cancanant ; `volume` (0 → 1) selon sa distance à la barque. */
  readonly onQuack: (volume: number) => void;
}

const _dummy = new Object3D();
const _color = new Color();

/** Où les groupes s'installent au départ : autour d'un point, entre deux distances (m). */
export interface DuckHome {
  readonly around: Vector3;
  readonly min: number;
  readonly max: number;
}

/**
 * Canards (ou mouettes posées, ou poules d'eau) : de petits groupes qui se
 * promènent en eau libre, se reposent, et s'écartent de la barque en
 * cancanant. La nuit, ils dorment sur place. Un seul lot instancié pour tous.
 */
export class Ducks {
  readonly mesh: InstancedMesh;
  private readonly water: WaterMap;
  private readonly hooks: DuckHooks;
  private readonly settings: DuckSettings;
  private readonly flocks: Flock[] = [];

  constructor(water: WaterMap, home: DuckHome, palette: DuckPalette, hooks: DuckHooks, settings: DuckSettings = CONFIG.waterLife.ducks) {
    const { groups, perGroup, minDepth } = settings;
    this.water = water;
    this.hooks = hooks;
    this.settings = settings;
    for (let i = 0; i < groups; i++) {
      const start = water.randomPoint(home.around.x, home.around.z, home.min, home.max, minDepth + 0.3, 40);
      if (start) this.flocks.push(createFlock(start, perGroup));
    }
    const count = this.flocks.length * perGroup;
    const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    this.mesh = new InstancedMesh(createDuckGeometry(palette), material, Math.max(1, count));
    this.mesh.name = 'ducks';
    this.mesh.count = count;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, _color.set(i % perGroup === 0 ? 0xffffff : palette.others));
  }

  /** `night` : 0 (jour) → 1 (nuit, ils dorment). */
  update(dt: number, elapsed: number, boat: Vector3, night: number): void {
    let index = 0;
    for (const flock of this.flocks) {
      this.lead(flock, dt, boat, night);
      this.follow(flock, dt);
      this.paddle(flock, dt);
      for (const duck of flock.ducks) this.place(duck, index++, elapsed);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Le premier du groupe : il fuit la barque, nage vers sa destination, ou se repose. */
  private lead(flock: Flock, dt: number, boat: Vector3, night: number): void {
    const { speed, fleeSpeed, fleeDistance, turn, rest, minDepth } = this.settings;
    const leader = flock.ducks[0];
    flock.fleeing = Math.max(0, flock.fleeing - dt);
    if (flock.fleeing <= 0 && Math.hypot(leader.x - boat.x, leader.z - boat.z) < fleeDistance) this.flee(flock, boat);
    if (!flock.target) {
      flock.rest -= dt;
      if (flock.rest <= 0 && night < 0.6) flock.target = this.stroll(flock);
      return;
    }
    const dx = flock.target.x - leader.x;
    const dz = flock.target.y - leader.z;
    if (Math.hypot(dx, dz) < 0.6) return this.settle(flock, MathUtils.lerp(rest.min, rest.max, Math.random()));
    leader.yaw += MathUtils.clamp(wrapAngle(Math.atan2(dx, dz) - leader.yaw), -turn * dt, turn * dt);
    const step = (flock.fleeing > 0 ? fleeSpeed : speed) * dt;
    const x = leader.x + Math.sin(leader.yaw) * step;
    const z = leader.z + Math.cos(leader.yaw) * step;
    // Bloqué (rive, rocher, haut-fond) : il s'arrête et choisira bientôt une autre destination
    if (!this.water.isOpen(x, z, minDepth * 0.6)) return this.settle(flock, 0.6);
    leader.x = x;
    leader.z = z;
  }

  private settle(flock: Flock, rest: number): void {
    flock.target = null;
    flock.rest = rest;
  }

  /**
   * Prochaine promenade : un point d'eau libre joignable en ligne droite (null
   * s'il n'y en a pas). Les oiseaux casaniers (`stay`) visent d'abord un
   * point près de chez eux ; s'ils en sont coupés, ils se promènent comme
   * les autres.
   */
  private stroll(flock: Flock): Vector2 | null {
    const { roam, minDepth, stay } = this.settings;
    const leader = flock.ducks[0];
    if (stay > 0) {
      const near = this.water.randomPoint(flock.home.x, flock.home.y, 0, stay, minDepth, 6);
      if (near && this.water.isClearPath(leader.x, leader.z, near.x, near.y, minDepth * 0.6)) return near;
    }
    return this.water.randomPoint(leader.x, leader.z, roam.min, roam.max, minDepth, 8, true);
  }

  /** La barque est trop près : le groupe file vers un point à l'opposé, en cancanant. */
  private flee(flock: Flock, boat: Vector3): void {
    const { minDepth, hearing, fleeDistance } = this.settings;
    const leader = flock.ducks[0];
    const away = Math.atan2(leader.x - boat.x, leader.z - boat.z);
    for (let attempt = 0; attempt < 8; attempt++) {
      const heading = away + (Math.random() * 2 - 1) * 0.9;
      const reach = MathUtils.lerp(9, 16, Math.random());
      const x = leader.x + Math.sin(heading) * reach;
      const z = leader.z + Math.cos(heading) * reach;
      if (!this.water.isOpen(x, z, minDepth) || !this.water.isClearPath(leader.x, leader.z, x, z, minDepth * 0.6)) continue;
      flock.target = new Vector2(x, z);
      flock.fleeing = 5;
      this.hooks.onQuack(1 - fleeDistance / hearing);
      return;
    }
    // Acculés : ils laissent passer la barque, et réessaieront un peu plus tard
    flock.fleeing = 1.5;
  }

  /** Les suivants : chacun rejoint sa place derrière le premier, en file un peu décalée. */
  private follow(flock: Flock, dt: number): void {
    const { spacing } = this.settings;
    const leader = flock.ducks[0];
    const rate = 1 - Math.exp(-(flock.fleeing > 0 ? 3 : 1.6) * dt);
    for (let k = 1; k < flock.ducks.length; k++) {
      const duck = flock.ducks[k];
      const side = (k % 2 === 0 ? -1 : 1) * 0.38;
      const slotX = leader.x - Math.sin(leader.yaw) * spacing * k + Math.cos(leader.yaw) * side;
      const slotZ = leader.z - Math.cos(leader.yaw) * spacing * k - Math.sin(leader.yaw) * side;
      const dx = (slotX - duck.x) * rate;
      const dz = (slotZ - duck.z) * rate;
      duck.x += dx;
      duck.z += dz;
      const moving = Math.hypot(dx, dz) > 0.002;
      duck.yaw += wrapAngle((moving ? Math.atan2(dx, dz) : leader.yaw) - duck.yaw) * Math.min(1, 3 * dt);
    }
  }

  /** Petits ronds derrière les canards qui nagent. */
  private paddle(flock: Flock, dt: number): void {
    if (!flock.target) return;
    flock.ripple -= dt;
    if (flock.ripple > 0) return;
    flock.ripple = flock.fleeing > 0 ? 0.45 : 1.1;
    for (const duck of flock.ducks) this.hooks.onRipple(duck.x, duck.z);
  }

  /** Posé sur la vague, avec un léger tangage (ou un hochement de tête marqué, pour les poules d'eau). */
  private place(duck: Duck, index: number, elapsed: number): void {
    const { nod, scale } = this.settings;
    const t = elapsed * 1.7 + duck.phase;
    _dummy.position.set(duck.x, this.water.surfaceAt(duck.x, duck.z, elapsed), duck.z);
    _dummy.rotation.set(Math.sin(t * (nod > 0.1 ? 3 : 1)) * nod, duck.yaw, Math.sin(t * 0.8) * 0.04, 'YXZ');
    _dummy.scale.setScalar(scale);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }
}

function createFlock(start: Vector2, count: number): Flock {
  const yaw = Math.random() * Math.PI * 2;
  const ducks: Duck[] = [];
  for (let k = 0; k < count; k++) {
    const duck = { x: start.x - Math.sin(yaw) * 0.85 * k, z: start.y - Math.cos(yaw) * 0.85 * k, yaw, phase: Math.random() * 6 };
    ducks.push(duck);
  }
  return { ducks, home: start.clone(), target: null, rest: MathUtils.lerp(1, 6, Math.random()), fleeing: 0, ripple: 0 };
}

/** Canard low poly : corps rebondi, croupion relevé, tête ronde et bec ; il regarde vers +Z, posé sur l'eau (y = 0). */
function createDuckGeometry(palette: DuckPalette): BufferGeometry {
  const body = new Color(palette.body);
  return merged([
    tinted(new SphereGeometry(0.16, 7, 5).scale(0.85, 0.62, 1.3).translate(0, 0.05, 0), body),
    tinted(new ConeGeometry(0.07, 0.16, 4).rotateX(-0.9).translate(0, 0.12, -0.2), body.clone().multiplyScalar(0.8)),
    tinted(new SphereGeometry(0.075, 6, 5).translate(0, 0.2, 0.13), new Color(palette.head)),
    tinted(new ConeGeometry(0.03, 0.09, 4).rotateX(Math.PI / 2).translate(0, 0.19, 0.23), new Color(palette.beak)),
  ]);
}
