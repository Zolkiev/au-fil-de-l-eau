import { MathUtils, Vector2 } from 'three';
import { CONFIG } from '../config';
import type { HeightSampler } from './heightSampler';
import type { LevelData } from './levelLoader';
import { waveHeight } from './waves';

const TAU = Math.PI * 2;

/**
 * Ce que les bêtes savent de l'eau du niveau : où elle est libre (emprise de
 * `water`, hors collisions), sa profondeur (mesurée sur le décor) et la
 * hauteur de sa surface, vagues comprises.
 */
export class WaterMap {
  /** Hauteur de la surface au repos. */
  readonly level: number;
  private readonly data: LevelData;
  private readonly ground: HeightSampler;

  constructor(level: LevelData, ground: HeightSampler) {
    this.data = level;
    this.ground = ground;
    this.level = level.water.level;
  }

  /** Profondeur de l'eau en (x, z) : négative sur la terre ferme, celle de config.ts s'il n'y a pas de fond modélisé. */
  depthAt(x: number, z: number): number {
    const bed = this.ground.groundAt(x, z, this.level + 0.02);
    return bed === null ? CONFIG.water.defaultDepth : this.level - bed;
  }

  /** Sur l'eau (au-dessus de `water`) ? Les collisions ne comptent pas : la rive en fait partie. */
  isWater(x: number, z: number): boolean {
    return this.data.water.footprint.isEmpty || this.data.water.footprint.contains(x, z);
  }

  /** Eau libre (là où la barque peut passer) et profonde d'au moins `minDepth` ? */
  isOpen(x: number, z: number, minDepth = 0): boolean {
    if (!this.isWater(x, z) || this.data.colliders.footprint.contains(x, z)) return false;
    return minDepth <= 0 || this.depthAt(x, z) >= minDepth;
  }

  /** Tout le trajet d'un point à l'autre est-il en eau libre assez profonde ? (vérifié tous les 1,5 m) */
  isClearPath(fromX: number, fromZ: number, toX: number, toZ: number, minDepth: number): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 1.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isOpen(MathUtils.lerp(fromX, toX, t), MathUtils.lerp(fromZ, toZ, t), minDepth)) return false;
    }
    return true;
  }

  /**
   * Point d'eau libre au hasard, entre `minRadius` et `maxRadius` de
   * (x, z) ; avec `reachable`, seulement s'il est joignable en ligne droite.
   * Null si `tries` essais n'ont rien donné.
   */
  randomPoint(x: number, z: number, minRadius: number, maxRadius: number, minDepth: number, tries: number, reachable = false): Vector2 | null {
    for (let i = 0; i < tries; i++) {
      const angle = Math.random() * TAU;
      const radius = MathUtils.lerp(minRadius, maxRadius, Math.random());
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      if (!this.isOpen(px, pz, minDepth)) continue;
      if (!reachable || this.isClearPath(x, z, px, pz, minDepth)) return new Vector2(px, pz);
    }
    return null;
  }

  /**
   * Hauteur de la surface en (x, z) à l'instant `elapsed`. Près du bord, les
   * vagues sont amorties comme dans le shader de l'eau : donner la
   * profondeur de l'endroit pour ce qui flotte en eau peu profonde.
   */
  surfaceAt(x: number, z: number, elapsed: number, depth = Infinity): number {
    return this.level + waveHeight(x, z, elapsed) * MathUtils.smoothstep(depth, 0, 1.2);
  }
}
