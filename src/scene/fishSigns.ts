import {
  ConeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { Ripples } from '../fishing/ripples';
import type { LevelData } from './levelLoader';
import { waveHeight } from './waves';

type SignKind = 'jump' | 'bubbles';

/** Un coin où les poissons se montrent. */
interface Sign {
  readonly x: number;
  readonly z: number;
  readonly kind: SignKind;
  /** Temps restant (s). */
  life: number;
  /** Délai avant le prochain saut ou la prochaine bulle (s). */
  next: number;
  /** Déjà pêché : il s'éteint. */
  fished: boolean;
  /** Poisson qui saute (signe « saut » seulement) et avancement du saut (0 → 1, -1 = sous l'eau). */
  readonly jumper: Mesh | null;
  jump: number;
  jumpYaw: number;
}

/** Ce que la pêche demande aux signes : un coin actif près d'un point ? */
export interface HotspotQuery {
  /** Un coin actif près de (x, z) ? (pour l'afficher pendant la visée) */
  isNear(x: number, z: number): boolean;
  /** Le bouchon tombe en (x, z) : si un coin actif est là, il est pêché (et s'éteint). */
  claim(x: number, z: number): boolean;
}

const _dummy = new Object3D();

/**
 * Signes de poissons : de temps en temps, un poisson saute ou des bulles
 * remontent quelque part devant la barque. Lancer à côté (CONFIG.signs.radius)
 * fait mordre plus vite et donne plus de chances aux poissons rares.
 * Un coin pêché s'éteint ; un autre apparaîtra plus tard.
 */
export class FishSigns implements HotspotQuery {
  readonly group = new Group();
  private readonly level: LevelData;
  private readonly signs: Sign[] = [];
  private readonly ripples = new Ripples(24);
  private readonly bubbles: InstancedMesh;
  private readonly bubbleAges: number[];
  private readonly jumpers: Mesh[] = [];
  private spawnIn: number;
  private bubbleCursor = 0;
  private readonly boat = new Vector3();
  /** Un poisson crève la surface en (x, z) : son plouf, avec un volume selon la distance à la barque (0 → 1). */
  private readonly onSplash: (volume: number, x: number, z: number) => void;

  constructor(level: LevelData, onSplash: (volume: number, x: number, z: number) => void) {
    const { maxActive, bubbles } = CONFIG.signs;
    this.level = level;
    this.onSplash = onSplash;
    this.spawnIn = MathUtils.lerp(CONFIG.signs.interval.min, CONFIG.signs.interval.max, 0.3);
    const bubbleMaterial = new MeshStandardMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.85, roughness: 0.2 });
    this.bubbles = new InstancedMesh(new SphereGeometry(0.05, 6, 4), bubbleMaterial, bubbles);
    this.bubbles.frustumCulled = false;
    this.bubbleAges = new Array<number>(bubbles).fill(Infinity);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = 0; i < bubbles; i++) this.bubbles.setMatrixAt(i, _dummy.matrix);
    for (let i = 0; i < maxActive; i++) this.jumpers.push(createJumper());
    this.group.name = 'fish_signs';
    this.group.add(this.ripples.group, this.bubbles, ...this.jumpers);
  }

  isNear(x: number, z: number): boolean {
    return this.nearest(x, z) !== null;
  }

  claim(x: number, z: number): boolean {
    const sign = this.nearest(x, z);
    if (!sign) return false;
    sign.fished = true;
    sign.life = Math.min(sign.life, 2);
    return true;
  }

  /** `boat`, `boatYaw` : les coins apparaissent devant la barque, à portée de lancer. */
  update(dt: number, elapsed: number, boat: Vector3, boatYaw: number): void {
    this.boat.copy(boat);
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) this.spawn(boat, boatYaw);
    for (const sign of this.signs) this.animate(sign, dt, elapsed);
    this.forget(boat);
    this.updateBubbles(dt, elapsed);
    this.ripples.update(dt, elapsed);
  }

  private nearest(x: number, z: number): Sign | null {
    const radius = CONFIG.signs.radius;
    let best: Sign | null = null;
    let bestDistance: number = radius;
    for (const sign of this.signs) {
      const distance = Math.hypot(sign.x - x, sign.z - z);
      if (!sign.fished && distance <= bestDistance) {
        best = sign;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Nouveau coin sur l'eau libre, devant la barque (s'il reste de la place). */
  private spawn(boat: Vector3, boatYaw: number): void {
    const { interval, maxActive, distance, arc } = CONFIG.signs;
    this.spawnIn = MathUtils.lerp(interval.min, interval.max, Math.random());
    if (this.signs.length >= maxActive) return;
    for (let attempt = 0; attempt < 10; attempt++) {
      const yaw = boatYaw + (Math.random() * 2 - 1) * arc;
      const reach = MathUtils.lerp(distance.min, distance.max, Math.random());
      const x = boat.x + Math.sin(yaw) * reach;
      const z = boat.z + Math.cos(yaw) * reach;
      if (!this.isOpenWater(x, z)) continue;
      const kind: SignKind = Math.random() < 0.5 ? 'jump' : 'bubbles';
      const jumper = kind === 'jump' ? (this.jumpers.find((mesh) => !this.signs.some((sign) => sign.jumper === mesh)) ?? null) : null;
      this.signs.push({ x, z, kind: jumper ? 'jump' : 'bubbles', life: CONFIG.signs.life, next: 0.5, fished: false, jumper, jump: -1, jumpYaw: 0 });
      return;
    }
  }

  private animate(sign: Sign, dt: number, elapsed: number): void {
    sign.life -= dt;
    sign.next -= dt;
    if (sign.kind === 'jump') this.animateJump(sign, dt, elapsed);
    else if (sign.next <= 0 && !sign.fished) this.bubble(sign, elapsed);
  }

  /** Un poisson jaillit, décrit un arc et replonge ; puis on attend le prochain saut. */
  private animateJump(sign: Sign, dt: number, elapsed: number): void {
    const { jumpEvery, jumpDuration, jumpHeight, jumpLength } = CONFIG.signs;
    const jumper = sign.jumper;
    if (!jumper) return;
    if (sign.jump < 0) {
      jumper.visible = false;
      if (sign.next > 0 || sign.fished) return;
      sign.jump = 0;
      sign.jumpYaw = Math.random() * Math.PI * 2;
      this.splash(sign.x, sign.z);
    }
    sign.jump = Math.min(1, sign.jump + dt / jumpDuration);
    const t = sign.jump;
    const along = (t - 0.5) * jumpLength;
    const x = sign.x + Math.sin(sign.jumpYaw) * along;
    const z = sign.z + Math.cos(sign.jumpYaw) * along;
    const surface = this.level.water.level + waveHeight(x, z, elapsed);
    jumper.visible = true;
    jumper.position.set(x, surface + Math.sin(Math.PI * t) * jumpHeight - 0.05, z);
    jumper.rotation.set(-Math.cos(Math.PI * t) * 0.9, sign.jumpYaw, 0, 'YXZ');
    if (t < 1) return;
    jumper.visible = false;
    sign.jump = -1;
    sign.next = MathUtils.lerp(jumpEvery.min, jumpEvery.max, Math.random());
    this.splash(x, z);
  }

  /** Bulles : une petite bulle qui crève et un tout petit rond, au hasard autour du coin. */
  private bubble(sign: Sign, elapsed: number): void {
    const { bubbleEvery } = CONFIG.signs;
    sign.next = MathUtils.lerp(bubbleEvery.min, bubbleEvery.max, Math.random());
    const x = sign.x + (Math.random() - 0.5) * 1.2;
    const z = sign.z + (Math.random() - 0.5) * 1.2;
    this.ripples.spawn(x, this.level.water.level, z, 0.18 + Math.random() * 0.15, 0.7, 0.45);
    const index = this.bubbleCursor;
    this.bubbleCursor = (this.bubbleCursor + 1) % this.bubbleAges.length;
    this.bubbleAges[index] = 0;
    _dummy.position.set(x, this.level.water.level + waveHeight(x, z, elapsed), z);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    this.bubbles.setMatrixAt(index, _dummy.matrix);
  }

  /** Les bulles gonflent un instant à la surface, puis crèvent. */
  private updateBubbles(dt: number, elapsed: number): void {
    for (let i = 0; i < this.bubbleAges.length; i++) {
      if (this.bubbleAges[i] === Infinity) continue;
      this.bubbleAges[i] += dt;
      const age = this.bubbleAges[i];
      this.bubbles.getMatrixAt(i, _dummy.matrix);
      _dummy.matrix.decompose(_dummy.position, _dummy.quaternion, _dummy.scale);
      _dummy.position.y = this.level.water.level + waveHeight(_dummy.position.x, _dummy.position.z, elapsed);
      _dummy.scale.setScalar(age < 0.6 ? Math.sin((age / 0.6) * Math.PI) * (1 + (i % 3) * 0.3) : 0);
      _dummy.updateMatrix();
      this.bubbles.setMatrixAt(i, _dummy.matrix);
      if (age >= 0.6) this.bubbleAges[i] = Infinity;
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
  }

  private splash(x: number, z: number): void {
    this.ripples.spawn(x, this.level.water.level, z, 0.7, 1.0, 0.7);
    const distance = Math.hypot(x - this.boat.x, z - this.boat.z);
    this.onSplash(MathUtils.clamp(1 - distance / 35, 0, 1), x, z);
  }

  /** Les coins éteints ou trop loin de la barque disparaissent. */
  private forget(boat: Vector3): void {
    const forgetDistance = CONFIG.signs.distance.max * 1.8;
    for (let i = this.signs.length - 1; i >= 0; i--) {
      const sign = this.signs[i];
      if (sign.life > 0 && Math.hypot(sign.x - boat.x, sign.z - boat.z) < forgetDistance) continue;
      if (sign.jumper) sign.jumper.visible = false;
      this.signs.splice(i, 1);
    }
  }

  private isOpenWater(x: number, z: number): boolean {
    return this.level.water.footprint.contains(x, z) && !this.level.colliders.footprint.contains(x, z);
  }
}

/** Silhouette de poisson qui saute : corps fuselé et queue, argentée. */
function createJumper(): Mesh {
  const body = new SphereGeometry(0.5, 8, 6).scale(0.16, 0.24, 0.8);
  const tail = new ConeGeometry(0.16, 0.3, 4).rotateX(-Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, -0.5);
  const geometry = mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()]);
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0x9aa8a8, metalness: 0.3, roughness: 0.35, flatShading: true }));
  mesh.name = 'fish_sign_jumper';
  mesh.visible = false;
  return mesh;
}
