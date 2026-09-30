import { Vector2, Vector3 } from 'three';
import { CONFIG } from '../config';
import { loadFishModel, type FishModel } from './fishModel';
import type { FishRoll } from './fishSelector';
import { ReelFight, type Gear } from './reelFight';

/**
 * Le poisson ferré : son tirage (espèce, taille, force), le combat de
 * remontée, la trajectoire qu'il impose au bouchon, et son modèle 3D
 * (chargé pendant le combat, pour la présentation de la prise).
 */
export class HookedFish {
  readonly roll: FishRoll;
  readonly fight: ReelFight;
  model: FishModel | null = null;
  /** Pointe de la canne au moment du ferrage. */
  private readonly tip = new Vector3();
  /** Direction horizontale (x, z) de la pointe vers le point de ferrage. */
  private readonly direction = new Vector2();
  private readonly wanderPhase = Math.random() * Math.PI * 2;

  constructor(roll: FishRoll, gear: Gear, rodTip: Vector3, bobber: Vector3) {
    this.roll = roll;
    this.tip.copy(rodTip);
    this.direction.set(bobber.x - rodTip.x, bobber.z - rodTip.z);
    const distance = Math.max(this.direction.length(), CONFIG.reel.landDistance + 0.5);
    this.direction.normalize();
    this.fight = new ReelFight(roll.strength, roll.species.difficulty.burstFrequency, distance, gear);
    void loadFishModel(roll.species, roll.variant).then((model) => (this.model = model));
  }

  /**
   * Où le poisson entraîne le bouchon (x, z) : dans l'axe du ferrage, à la
   * distance du combat, avec des zigzags qui s'atténuent près de la barque.
   */
  bobberTarget(elapsed: number, out: Vector2): Vector2 {
    const { distance } = this.fight;
    const amplitude = CONFIG.reel.wanderAmplitude * this.roll.strength * Math.min(1, distance / 8);
    const wander = Math.sin(elapsed * 0.9 + this.wanderPhase) * amplitude;
    const { x: dx, y: dz } = this.direction;
    return out.set(this.tip.x + dx * distance - dz * wander, this.tip.z + dz * distance + dx * wander);
  }
}
