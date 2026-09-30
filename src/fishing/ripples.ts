import { Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { avoidDryPixels } from '../scene/waterMask';
import { waveHeight } from '../scene/waves';

/** Hauteur des ronds au-dessus de la surface de l'eau. */
const LIFT = 0.04;

/** Nombre de ronds dans l'eau affichables en même temps (par défaut). */
const POOL_SIZE = 12;

interface Ripple {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
  duration: number;
  radius: number;
  strength: number;
}

/** Ronds dans l'eau qui s'élargissent et s'effacent (plouf, touches, sillage…), posés sur les vagues. */
export class Ripples {
  readonly group = new Group();
  private readonly pool: Ripple[] = [];
  private waterLevel = 0;

  constructor(poolSize = POOL_SIZE) {
    this.group.name = 'ripples';
    const geometry = new RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < poolSize; i++) {
      const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      avoidDryPixels(material);
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.pool.push({ mesh, material, age: 0, duration: 1, radius: 1, strength: 1 });
    }
  }

  /** Crée un rond centré en (x, z) à la surface `y`, qui grandit jusqu'à `radius` en `duration` secondes. */
  spawn(x: number, y: number, z: number, radius: number, duration = 1.2, strength = 0.6): void {
    const ripple = this.pickRipple();
    ripple.age = 0;
    ripple.duration = duration;
    ripple.radius = radius;
    ripple.strength = strength;
    this.waterLevel = y;
    ripple.mesh.position.set(x, y + LIFT, z);
    ripple.mesh.visible = true;
  }

  /** `time` : temps des vagues (s), pour que les ronds suivent la surface. */
  update(dt: number, time: number): void {
    for (const ripple of this.pool) {
      if (!ripple.mesh.visible) continue;
      const { position } = ripple.mesh;
      position.y = this.waterLevel + waveHeight(position.x, position.z, time) + LIFT;
      ripple.age += dt;
      const t = Math.min(ripple.age / ripple.duration, 1);
      const eased = 1 - (1 - t) ** 3;
      ripple.mesh.scale.setScalar(0.15 + eased * ripple.radius);
      ripple.material.opacity = (1 - t) * ripple.strength;
      if (t >= 1) ripple.mesh.visible = false;
    }
  }

  /** Un rond libre, sinon celui qui est le plus près de disparaître. */
  private pickRipple(): Ripple {
    const free = this.pool.find((ripple) => !ripple.mesh.visible);
    if (free) return free;
    const progress = (ripple: Ripple): number => ripple.age / ripple.duration;
    return this.pool.reduce((best, ripple) => (progress(ripple) > progress(best) ? ripple : best));
  }
}
