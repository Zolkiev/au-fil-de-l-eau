import { DoubleSide, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D, Shape, ShapeGeometry, type BufferGeometry, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { wrapAngle } from '../core/math';
import type { WaterMap } from './waterMap';
import { avoidDryPixels } from './waterMask';

/** Hauteur des ombres au-dessus de la surface (m) : l'eau est opaque, on les dessine juste dessus. */
const LIFT = 0.03;
/** Durée de l'apparition et de la disparition d'une ombre (s). */
const FADE = 1.5;

/** Une ombre de poisson : où elle est, où elle va, depuis quand. */
interface Shadow {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  size: number;
  age: number;
  life: number;
  /** Élan de fuite (1 = elle file, 0 = nage tranquille). */
  dart: number;
  readonly phase: number;
  /** Côté par lequel elle contourne un obstacle (+1 ou -1). */
  readonly turn: number;
}

const _dummy = new Object3D();

/**
 * Ombres de poissons : des silhouettes sombres qui passent sous la surface
 * autour de la barque, serpentent, et filent quand elle approche. Elles
 * naissent et s'effacent en douceur ; un seul lot instancié.
 */
export class FishShadows {
  readonly mesh: InstancedMesh;
  private readonly water: WaterMap;
  private readonly shadows: Shadow[];

  constructor(water: WaterMap) {
    const { count, color, opacity } = CONFIG.waterLife.shadows;
    this.water = water;
    this.shadows = Array.from({ length: count }, (_, index) => blankShadow(index));
    const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide });
    avoidDryPixels(material);
    this.mesh = new InstancedMesh(createSilhouette(), material, count);
    this.mesh.name = 'fish_shadows';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(dt: number, elapsed: number, boat: Vector3): void {
    this.shadows.forEach((shadow, index) => {
      if (shadow.age >= shadow.life) this.respawn(shadow, boat);
      else this.swim(shadow, dt, elapsed, boat);
      this.place(shadow, index, elapsed);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Nouvelle ombre quelque part autour de la barque, en eau assez profonde (sinon on réessaiera à la prochaine image). */
  private respawn(shadow: Shadow, boat: Vector3): void {
    const { ring, speed, size, life, minDepth } = CONFIG.waterLife.shadows;
    const point = this.water.randomPoint(boat.x, boat.z, ring.min, ring.max, minDepth, 2);
    if (!point) return;
    shadow.x = point.x;
    shadow.z = point.y;
    shadow.yaw = Math.random() * Math.PI * 2;
    shadow.speed = MathUtils.lerp(speed.min, speed.max, Math.random());
    shadow.size = MathUtils.lerp(size.min, size.max, Math.random() ** 1.5);
    shadow.life = MathUtils.lerp(life.min, life.max, Math.random());
    shadow.age = 0;
    shadow.dart = 0;
  }

  /** Elle serpente, contourne les hauts-fonds et les rives, et file si la barque est trop près. */
  private swim(shadow: Shadow, dt: number, elapsed: number, boat: Vector3): void {
    const { fleeDistance, minDepth, ring } = CONFIG.waterLife.shadows;
    shadow.age += dt;
    shadow.yaw += Math.sin(elapsed * 0.4 + shadow.phase) * 0.5 * dt;
    const fromBoat = Math.hypot(shadow.x - boat.x, shadow.z - boat.z);
    if (fromBoat < fleeDistance) {
      shadow.dart = 1;
      shadow.yaw += wrapAngle(Math.atan2(shadow.x - boat.x, shadow.z - boat.z) - shadow.yaw) * Math.min(1, 6 * dt);
    }
    shadow.dart = Math.max(0, shadow.dart - 0.8 * dt);
    const ahead = 1.5 + shadow.size;
    if (!this.water.isOpen(shadow.x + Math.sin(shadow.yaw) * ahead, shadow.z + Math.cos(shadow.yaw) * ahead, minDepth)) shadow.yaw += shadow.turn * 2.4 * dt;
    const step = shadow.speed * (1 + 3.5 * shadow.dart) * dt;
    shadow.x += Math.sin(shadow.yaw) * step;
    shadow.z += Math.cos(shadow.yaw) * step;
    // Trop loin de la barque, ou échouée : elle s'efface (au plus vite, sans sauter d'un coup)
    const lost = fromBoat > ring.max + 6 || !this.water.isOpen(shadow.x, shadow.z, minDepth * 0.6);
    if (lost) shadow.life = Math.min(shadow.life, shadow.age + FADE);
  }

  /** Posée juste au-dessus de la vague ; sa queue ondule (tout le corps pivote un peu). */
  private place(shadow: Shadow, index: number, elapsed: number): void {
    const fade = MathUtils.clamp(Math.min(shadow.age, shadow.life - shadow.age) / FADE, 0, 1);
    _dummy.position.set(shadow.x, this.water.surfaceAt(shadow.x, shadow.z, elapsed) + LIFT, shadow.z);
    _dummy.rotation.set(0, shadow.yaw + Math.sin(elapsed * (4 + 6 * shadow.dart) + shadow.phase) * 0.14, 0);
    _dummy.scale.setScalar(shadow.size * fade);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }
}

/** Ombre pas encore née : elle apparaîtra dès qu'un point d'eau assez profonde sera trouvé près de la barque. */
function blankShadow(index: number): Shadow {
  return { x: 0, z: 0, yaw: 0, speed: 0, size: 0, age: 0, life: 0, dart: 0, phase: index * 1.9, turn: index % 2 === 0 ? 1 : -1 };
}

/** Silhouette vue de dessus, à plat, longue de 1 m : corps fuselé et queue fourchue ; la tête pointe vers +Z. */
function createSilhouette(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, -0.5);
  shape.quadraticCurveTo(0.17, -0.3, 0.14, 0);
  shape.quadraticCurveTo(0.1, 0.25, 0.03, 0.33);
  shape.lineTo(0.16, 0.5);
  shape.lineTo(0, 0.44);
  shape.lineTo(-0.16, 0.5);
  shape.lineTo(-0.03, 0.33);
  shape.quadraticCurveTo(-0.1, 0.25, -0.14, 0);
  shape.quadraticCurveTo(-0.17, -0.3, 0, -0.5);
  return new ShapeGeometry(shape, 5).rotateX(-Math.PI / 2);
}
