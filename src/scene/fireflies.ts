import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { glowTexture } from './glowTexture';

/** Trajectoire propre à chaque luciole. */
interface Firefly {
  readonly angle: number;
  readonly distance: number;
  readonly height: number;
  readonly phase: number;
  readonly speed: number;
}

const _color = new Color();

/**
 * Lucioles : quelques points lumineux qui flottent et clignotent doucement
 * autour de la barque, la nuit seulement.
 */
export class Fireflies {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  private readonly flies: Firefly[];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseColor = new Color(CONFIG.fireflies.color);

  constructor() {
    const { count, minDistance, maxDistance, size } = CONFIG.fireflies;
    this.flies = Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: minDistance + Math.random() * (maxDistance - minDistance),
      height: 0.4 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.8,
    }));
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
    const material = new PointsMaterial({
      size,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.points = new Points(geometry, material);
    this.points.name = 'fireflies';
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** `center` : autour de quoi elles volent (la barque) ; `night` : 0 (jour, invisibles) → 1. */
  update(time: number, center: Vector3, waterLevel: number, night: number): void {
    this.points.visible = night > 0.02;
    if (!this.points.visible) return;
    this.flies.forEach((fly, index) => {
      const angle = fly.angle + Math.sin(time * 0.05 * fly.speed + fly.phase) * 0.4;
      const distance = fly.distance + Math.sin(time * 0.3 * fly.speed + fly.phase) * 1.5;
      this.positions[index * 3] = center.x + Math.cos(angle) * distance;
      this.positions[index * 3 + 1] = waterLevel + fly.height + Math.sin(time * 0.8 * fly.speed + fly.phase) * 0.3;
      this.positions[index * 3 + 2] = center.z + Math.sin(angle) * distance;
      // Clignotement doux : allumées surtout au sommet de la sinusoïde
      const blink = (0.5 + 0.5 * Math.sin(time * 2.2 * fly.speed + fly.phase)) ** 3;
      _color.copy(this.baseColor).multiplyScalar(blink * night);
      _color.toArray(this.colors, index * 3);
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
