import {
  AdditiveBlending,
  Box3,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import { glowTexture } from '../scene/glowTexture';
import { waveHeight } from '../scene/waves';

type BobberMode = 'hanging' | 'flying' | 'floating' | 'plunged' | 'towed' | 'reeling';

const TAU = Math.PI * 2;
/** Profondeur du bouchon quand un poisson l'entraîne (m). */
const PLUNGE_DEPTH = 0.3;
/** Profondeur quand un poisson tire la ligne (m). */
const TOW_DEPTH = 0.12;
/** Distance horizontale à la pointe de la canne à partir de laquelle le bouchon est « rentré ». */
const HOME_DISTANCE = 1.2;

const _home = new Vector3();

/** Charge `assets/props/bobber.glb`, ou fabrique un bouchon en primitives. */
export async function loadBobberModel(): Promise<Object3D> {
  const gltf = await loadGLB(CONFIG.assets.bobber, 'Bouchon');
  return gltf?.scene ?? createPlaceholderBobber();
}

/** Bouchon low poly : dôme rouge, base blanche allongée, antenne. Origine = ligne de flottaison. */
export function createPlaceholderBobber(): Group {
  const red = new MeshStandardMaterial({ color: 0xe0483c, emissive: 0x5a120c, flatShading: true, roughness: 0.5 });
  const white = new MeshStandardMaterial({ color: 0xf6f1e7, flatShading: true, roughness: 0.6 });
  const top = new Mesh(new SphereGeometry(0.1, 10, 4, 0, TAU, 0, Math.PI / 2), red);
  const bottom = new Mesh(new SphereGeometry(0.1, 10, 4, 0, TAU, Math.PI / 2, Math.PI / 2), white);
  bottom.scale.y = 1.6;
  const antenna = new Mesh(new CylinderGeometry(0.012, 0.012, 0.16, 5), red);
  antenna.position.y = 0.18;
  const bobber = new Group();
  bobber.name = 'bobber_placeholder';
  bobber.add(top, bottom, antenna);
  return bobber;
}

/**
 * Bouchon : pend sous la canne, vole en arc, flotte, frémit (fausse touche),
 * plonge (vraie touche), suit le poisson pendant la remontée et revient
 * vers la barque.
 */
export class Bobber {
  readonly object = new Group();
  private readonly waterLevel: number;
  /** Hauteur du haut du bouchon au-dessus de son origine (point d'attache de la ligne). */
  /** Hauteur du point d'attache de la ligne (sommet du bouchon, à sa taille actuelle). */
  private attachHeight: number;
  /** Sommet du modèle, à l'échelle 1. */
  private readonly modelTop: number;
  private readonly flight = { from: new Vector3(), to: new Vector3(), duration: 1, height: 1, time: 0 };
  private mode: BobberMode = 'hanging';
  private readonly towTarget = new Vector3();
  /** Halo lumineux au sommet, visible la nuit. */
  private readonly glow: Sprite;
  private nibbleLeft = 0;
  private depth = 0;
  private reelSpeed = 0;

  constructor(model: Object3D, waterLevel: number) {
    const size = CONFIG.fishing.bobberSize;
    this.object.name = 'bobber';
    this.object.add(model);
    this.object.scale.setScalar(size);
    this.modelTop = new Box3().setFromObject(model).max.y;
    this.attachHeight = this.modelTop * size;
    this.waterLevel = waterLevel;
    this.glow = createGlow(size);
    this.glow.position.y = this.attachHeight / size;
    this.object.add(this.glow);
  }

  get position(): Vector3 {
    return this.object.position;
  }

  /** Bouchon plus gros (réglage « Grand bouchon ») : × la taille de config.ts. */
  setSizeFactor(factor: number): void {
    const size = CONFIG.fishing.bobberSize * factor;
    this.object.scale.setScalar(size);
    this.attachHeight = this.modelTop * size;
  }

  get isFlying(): boolean {
    return this.mode === 'flying';
  }

  /** Le bouchon est-il revenu pendre sous la canne ? */
  get isHome(): boolean {
    return this.mode === 'hanging';
  }

  /** Lueur du bouchon : 0 (jour, éteinte) → 1 (pleine nuit). */
  setNight(night: number): void {
    this.glow.material.opacity = night * 0.9;
    this.glow.visible = night > 0.01;
  }

  /** Point d'attache de la ligne (haut du bouchon). */
  lineAttach(out: Vector3): Vector3 {
    return out.copy(this.object.position).setY(this.object.position.y + this.attachHeight);
  }

  /** Lance le bouchon en arc de `from` vers `to` (à la surface de l'eau). */
  launch(from: Vector3, to: Vector3, duration: number, height: number): void {
    Object.assign(this.flight, { duration, height, time: 0 });
    this.flight.from.copy(from);
    this.flight.to.copy(to);
    this.object.position.copy(from);
    this.mode = 'flying';
  }

  /** Fausse touche : le bouchon frémit quelques dixièmes de seconde. */
  nibble(): void {
    this.nibbleLeft = CONFIG.fishing.nibbles.duration;
  }

  /** Vraie touche : le bouchon plonge. */
  plunge(): void {
    this.mode = 'plunged';
  }

  /** Un poisson entraîne le bouchon juste sous la surface, vers (x, z). */
  towTo(x: number, z: number): void {
    this.towTarget.set(x, this.waterLevel - TOW_DEPTH, z);
    this.mode = 'towed';
  }

  /** Ramène une ligne vide vers la barque, en surface. */
  reelIn(speed: number): void {
    this.reelSpeed = speed;
    this.nibbleLeft = 0;
    this.mode = 'reeling';
  }

  /** Le bouchon revient aussitôt pendre sous la canne (poisson sorti de l'eau). */
  returnHome(): void {
    this.mode = 'hanging';
  }

  update(dt: number, elapsed: number, rodTip: Vector3): void {
    if (this.mode === 'hanging') this.hang(dt, rodTip);
    else if (this.mode === 'flying') this.fly(dt);
    else if (this.mode === 'floating') this.float(dt, elapsed);
    else if (this.mode === 'plunged') this.sink(dt, elapsed);
    else if (this.mode === 'towed') this.tow(dt, elapsed);
    else this.reel(dt, elapsed, rodTip);
  }

  /** Pend sous la pointe de la canne, avec un léger retard (effet de balancier). */
  private hang(dt: number, rodTip: Vector3): void {
    _home.copy(rodTip);
    _home.y -= CONFIG.rod.hangLength + this.attachHeight;
    this.object.position.lerp(_home, 1 - Math.exp(-12 * dt));
    this.depth = 0;
    this.settleRotation(dt);
  }

  /** Vol en arc de parabole, avec deux tours sur lui-même. */
  private fly(dt: number): void {
    const flight = this.flight;
    flight.time += dt;
    const t = Math.min(flight.time / flight.duration, 1);
    this.object.position.lerpVectors(flight.from, flight.to, t);
    this.object.position.y += 4 * flight.height * t * (1 - t);
    this.object.rotation.x = t * 2 * TAU;
    if (t < 1) return;
    this.object.rotation.x = 0;
    this.mode = 'floating';
  }

  /** Surface de l'eau sous le bouchon (vagues comprises). */
  private surfaceAt(elapsed: number): number {
    const { x, z } = this.object.position;
    return this.waterLevel + waveHeight(x, z, elapsed);
  }

  private float(dt: number, elapsed: number): void {
    this.depth = MathUtils.damp(this.depth, 0, 6, dt);
    const bob = Math.sin(elapsed * 2.2) * 0.012;
    this.object.position.y = this.surfaceAt(elapsed) - this.depth + bob - this.shake(dt, elapsed);
    if (this.nibbleLeft <= 0) this.settleRotation(dt);
  }

  /** Secousses d'une fausse touche ; retourne l'enfoncement du moment. */
  private shake(dt: number, elapsed: number): number {
    if (this.nibbleLeft <= 0) return 0;
    this.nibbleLeft -= dt;
    const fade = Math.max(this.nibbleLeft, 0) / CONFIG.fishing.nibbles.duration;
    this.object.rotation.z = Math.sin(elapsed * 55) * 0.35 * fade;
    return Math.abs(Math.sin(elapsed * 38)) * 0.06 * fade;
  }

  private sink(dt: number, elapsed: number): void {
    this.depth = MathUtils.damp(this.depth, PLUNGE_DEPTH, 14, dt);
    this.object.position.y = this.surfaceAt(elapsed) - this.depth + Math.sin(elapsed * 22) * 0.02;
    this.object.rotation.z = Math.sin(elapsed * 17) * 0.25;
  }

  /** Suit le poisson, secoué par ses mouvements. */
  private tow(dt: number, elapsed: number): void {
    this.object.position.lerp(this.towTarget, 1 - Math.exp(-8 * dt));
    this.object.position.y = this.surfaceAt(elapsed) - TOW_DEPTH + Math.sin(elapsed * 19) * 0.02;
    this.object.rotation.z = Math.sin(elapsed * 13) * 0.3;
    this.depth = TOW_DEPTH;
  }

  /** Glisse vers la pointe de la canne ; une fois tout près, il repend sous la canne. */
  private reel(dt: number, elapsed: number, rodTip: Vector3): void {
    const position = this.object.position;
    const dx = rodTip.x - position.x;
    const dz = rodTip.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < HOME_DISTANCE) {
      this.mode = 'hanging';
      return;
    }
    const step = Math.min(distance, this.reelSpeed * dt) / distance;
    position.x += dx * step;
    position.z += dz * step;
    this.depth = MathUtils.damp(this.depth, 0, 6, dt);
    position.y = this.surfaceAt(elapsed) - this.depth + Math.abs(Math.sin(elapsed * 12)) * 0.03;
    this.settleRotation(dt);
  }

  private settleRotation(dt: number): void {
    this.object.rotation.x = MathUtils.damp(this.object.rotation.x, 0, 8, dt);
    this.object.rotation.z = MathUtils.damp(this.object.rotation.z, 0, 8, dt);
  }
}

/** Halo additif (dégradé radial), qui ne subit ni brouillard ni tone mapping pour rester vif. */
function createGlow(bobberSize: number): Sprite {
  const { color, size } = CONFIG.dayNight.bobberGlow;
  const material = new SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const glow = new Sprite(material);
  glow.name = 'bobber_glow';
  glow.scale.setScalar(size / bobberSize);
  glow.visible = false;
  return glow;
}
