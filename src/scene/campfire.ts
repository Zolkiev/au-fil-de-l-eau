import { AdditiveBlending, ConeGeometry, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { glowTexture } from './glowTexture';
import type { LightSource } from './nightLights';

/** Une langue de feu : son mesh et sa façon de vaciller. */
interface Flame {
  readonly mesh: Mesh;
  readonly phase: number;
  readonly speed: number;
}

/**
 * Feu de camp (Empty `fx_fire_<n>`) : trois flammes low poly emboîtées qui
 * vacillent, un halo, et une lumière qui tremble avec elles (prêtée par
 * NightLights quand la barque est assez près). Étincelles et fumée sont
 * émises par LevelEffects.
 */
export class Campfire {
  readonly group = new Group();
  private readonly flames: Flame[];
  private readonly glow: Sprite;
  private readonly light: LightSource;
  private readonly size: number;

  /** `size` : échelle de l'Empty (1 = feu normal). */
  constructor(position: Vector3, size: number, light: LightSource) {
    const { flameColors, glow } = CONFIG.effects.fire;
    this.size = size;
    this.light = light;
    this.group.name = 'campfire';
    this.group.position.copy(position);
    this.flames = flameColors.map((color, index) => createFlame(color, index, size));
    this.glow = createGlow(glow.color);
    this.glow.position.y = 0.3 * size;
    this.group.add(...this.flames.map((flame) => flame.mesh), this.glow);
  }

  /** `night` : 0 (jour) → 1 (nuit) : le halo ne se voit vraiment que dans le noir. */
  update(elapsed: number, night: number): void {
    const { flicker, glow } = CONFIG.effects.fire;
    let pulse = 0;
    for (const flame of this.flames) {
      const t = elapsed * flicker * flame.speed + flame.phase;
      // Deux sinus de périodes sans rapport : un vacillement qui ne se répète pas à l'œil
      const sway = 0.5 + 0.25 * Math.sin(t) + 0.25 * Math.sin(t * 1.73 + 1.1);
      flame.mesh.scale.set(1 - 0.18 * sway, 0.75 + 0.5 * sway, 1 - 0.18 * sway);
      flame.mesh.rotation.set(0.1 * Math.sin(t * 0.7), elapsed * flame.speed, 0.1 * Math.sin(t * 0.9 + 2));
      pulse += sway;
    }
    const level = 0.8 + 0.4 * (pulse / this.flames.length);
    this.light.flicker = level;
    this.glow.material.opacity = glow.opacity * level * (0.25 + 0.75 * night);
    this.glow.scale.setScalar(glow.size * this.size * (0.9 + 0.2 * level));
  }
}

/** Flamme : un cône pointu posé sur sa base ; les flammes intérieures sont plus petites et plus claires. */
function createFlame(color: number, index: number, size: number): Flame {
  const { flameHeight, flameRadius } = CONFIG.effects.fire;
  const shrink = 1 - index * 0.28;
  const height = flameHeight * shrink * size;
  const geometry = new ConeGeometry(flameRadius * shrink * size, height, 5).translate(0, height / 2, 0);
  const material = new MeshBasicMaterial({ color, toneMapped: false, fog: false });
  const mesh = new Mesh(geometry, material);
  mesh.name = `campfire_flame_${index + 1}`;
  return { mesh, phase: index * 2.1, speed: 1 + index * 0.35 };
}

function createGlow(color: number): Sprite {
  const material = new SpriteMaterial({ map: glowTexture(), color, blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const glow = new Sprite(material);
  glow.name = 'campfire_glow';
  return glow;
}
