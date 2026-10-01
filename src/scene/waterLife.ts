import { Group, type Vector3 } from 'three';
import { Ripples } from '../fishing/ripples';
import { Ducks, GULLS, MALLARDS } from './ducks';
import { FishShadows } from './fishShadows';
import type { HeightSampler } from './heightSampler';
import { Heron } from './heron';
import type { LevelData } from './levelLoader';
import { LilyPads } from './lilyPads';
import { WaterMap } from './waterMap';

/** Ce que la vie sur l'eau demande au jeu : gouttes et sons. */
export interface WaterLifeHooks {
  /** Petite gerbe de gouttes en (x, z). */
  readonly splash: (x: number, z: number, strength: number) => void;
  /** Cri ou plouf ; `volume` de 0 à 1 selon la distance à la barque. */
  readonly play: (sound: 'quack' | 'croak' | 'splash', volume: number) => void;
}

/** Ce que les bêtes regardent à chaque image. */
export interface WaterLifeState {
  readonly boat: Vector3;
  /** 0 (jour) → 1 (nuit). */
  readonly night: number;
  /** 1 au crépuscule et la nuit (les grenouilles sortent), 0 sinon. */
  readonly evening: number;
}

/**
 * Vie sur l'eau : nénuphars et grenouilles autour des roseaux, canards qui
 * se promènent (mouettes posées au bord de la mer), un héron à l'affût, et
 * des ombres de poissons sous la surface. Rien n'est posé à la main : tout
 * se place d'après les zones, l'eau libre et la profondeur du niveau.
 */
export class WaterLife {
  readonly group = new Group();
  private readonly ripples = new Ripples(16);
  private readonly lilyPads: LilyPads | null;
  private readonly ducks: Ducks;
  private readonly heron: Heron | null;
  private readonly shadows: FishShadows;

  /** `sea` : lieu au bord de la mer (pas de nénuphars, des mouettes au lieu des canards). */
  constructor(level: LevelData, ground: HeightSampler, sea: boolean, hooks: WaterLifeHooks) {
    const water = new WaterMap(level, ground);
    const ripple = (x: number, z: number, radius: number): void => this.ripples.spawn(x, water.level, z, radius, 0.9, 0.4);
    this.lilyPads = sea
      ? null
      : new LilyPads(level, water, {
          onPlop: (x, z) => {
            ripple(x, z, 0.5);
            hooks.splash(x, z, 0.3);
          },
          onCroak: (volume) => hooks.play('croak', volume),
        });
    this.ducks = new Ducks(water, level.spawn.position, sea ? GULLS : MALLARDS, {
      onRipple: (x, z) => ripple(x, z, 0.35),
      onQuack: (volume) => hooks.play('quack', volume),
    });
    this.heron = Heron.create(level, water);
    this.shadows = new FishShadows(water);
    this.group.name = 'water_life';
    this.group.add(this.ripples.group, this.ducks.mesh, this.shadows.mesh);
    if (this.lilyPads) this.group.add(this.lilyPads.group);
    if (this.heron) this.group.add(this.heron.group);
  }

  update(dt: number, elapsed: number, state: WaterLifeState): void {
    const { boat, night, evening } = state;
    this.lilyPads?.update(dt, elapsed, boat, evening);
    this.ducks.update(dt, elapsed, boat, night);
    this.heron?.update(dt, elapsed, boat);
    this.shadows.update(dt, elapsed, boat);
    this.ripples.update(dt, elapsed);
  }
}
