import { Group, MathUtils, PointLight, Vector3, type PerspectiveCamera } from 'three';
import { CONFIG } from '../config';
import { yawOf } from '../core/math';
import type { FishModel } from './fishModel';

const _forward = new Vector3();
const _up = new Vector3();
const _display = new Vector3();

/**
 * Présentation de la prise : le poisson saute hors de l'eau, vient se placer
 * devant la caméra à une taille lisible, puis tourne lentement sur lui-même.
 */
export class CatchShowcase {
  readonly group = new Group();
  /**
   * Lumière d'appoint, près de la caméra, pour que le poisson reste lisible la
   * nuit. Toujours présente (intensité 0 hors présentation) pour éviter une
   * recompilation des shaders.
   */
  readonly light = new PointLight(0xfff4e6, 0, 8, 1);
  private fish: FishModel | null = null;
  private readonly from = new Vector3();
  private fromScale = 1;
  private time = 0;
  private spin = 0;

  constructor() {
    this.group.name = 'catch_showcase';
    this.group.rotation.order = 'YXZ';
    this.group.visible = false;
  }

  get isActive(): boolean {
    return this.fish !== null;
  }

  /** Lance la présentation depuis `from` (à la surface), avec la taille réelle du poisson en mètres. */
  start(fish: FishModel, lengthMeters: number, from: Vector3): void {
    this.hide();
    this.fish = fish;
    this.group.add(fish.root);
    this.group.visible = true;
    this.from.copy(from);
    this.fromScale = lengthMeters / fish.length;
    this.time = 0;
    this.spin = 0;
  }

  hide(): void {
    if (this.fish) this.group.remove(this.fish.root);
    this.fish = null;
    this.group.visible = false;
    this.light.intensity = 0;
  }

  update(dt: number, camera: PerspectiveCamera): void {
    if (!this.fish) return;
    const { leapDuration, leapHeight, turnSpeed } = CONFIG.catchDisplay;
    this.time += dt;
    this.fish.update(dt);
    const t = Math.min(this.time / leapDuration, 1);
    const eased = 1 - (1 - t) ** 3;
    this.group.position.lerpVectors(this.from, displayPosition(camera, _display), eased);
    this.group.position.y += Math.sin(Math.PI * t) * leapHeight + Math.sin(this.time * 1.5) * 0.03 * t;
    this.group.scale.setScalar(MathUtils.lerp(this.fromScale, displayLength(camera) / this.fish.length, eased));
    this.spin += turnSpeed * dt * t;
    this.orient(camera, t);
    this.light.position.copy(camera.position).addScaledVector(_up, 0.6);
    this.light.intensity = CONFIG.catchDisplay.lightIntensity * t;
  }

  /** De profil face à la caméra, puis rotation lente ; museau levé au début du saut. */
  private orient(camera: PerspectiveCamera, t: number): void {
    camera.getWorldDirection(_forward);
    const profileYaw = yawOf(_forward.x, _forward.z) + Math.PI / 2;
    const leapTilt = -0.9 * Math.cos(Math.PI * t) * (1 - t);
    this.group.rotation.set(leapTilt, profileYaw + this.spin, 0);
  }
}

/** Point de présentation : devant la caméra, un peu au-dessus du centre. */
function displayPosition(camera: PerspectiveCamera, out: Vector3): Vector3 {
  const { distance, lift } = CONFIG.catchDisplay;
  camera.getWorldDirection(_forward);
  _up.setFromMatrixColumn(camera.matrixWorld, 1);
  return out.copy(camera.position).addScaledVector(_forward, distance).addScaledVector(_up, lift);
}

/** Longueur affichée : lisible, sans dépasser une part de la largeur visible (écrans étroits). */
function displayLength(camera: PerspectiveCamera): number {
  const { distance, maxLength, maxScreenFraction } = CONFIG.catchDisplay;
  const visibleHeight = 2 * distance * Math.tan(MathUtils.degToRad(camera.fov) / 2);
  return Math.min(maxLength, visibleHeight * camera.aspect * maxScreenFraction);
}
