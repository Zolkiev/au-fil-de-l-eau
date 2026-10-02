import { Group, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { Ripples } from '../fishing/ripples';
import { Crabs } from './crabs';
import { Ducks, GULLS, MALLARDS, MOORHENS } from './ducks';
import { FishShadows } from './fishShadows';
import type { HeightSampler } from './heightSampler';
import { Heron } from './heron';
import { Kingfisher } from './kingfisher';
import type { LevelData } from './levelLoader';
import { LilyPads } from './lilyPads';
import { Turtles } from './turtles';
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
  /** Cap de la barque (le martin-pêcheur passe devant elle). */
  readonly boatYaw: number;
  /** 0 (jour) → 1 (nuit). */
  readonly night: number;
  /** 1 au crépuscule et la nuit (les grenouilles sortent), 0 sinon. */
  readonly evening: number;
}

/**
 * Vie sur l'eau : nénuphars et grenouilles autour des roseaux, canards qui
 * se promènent (mouettes posées au bord de la mer), un héron à l'affût, et
 * des ombres de poissons sous la surface. En eau douce : un couple de
 * poules d'eau près des roseaux, des tortues sur les rochers, et un
 * martin-pêcheur qui passe. Au bord de la mer : des crabes sur le rivage.
 * Rien n'est posé à la main : tout se place d'après les zones, l'eau libre,
 * la profondeur et le relief du niveau.
 */
export class WaterLife {
  readonly group = new Group();
  private readonly ripples = new Ripples(16);
  private readonly lilyPads: LilyPads | null;
  private readonly ducks: Ducks;
  private readonly heron: Heron | null;
  private readonly shadows: FishShadows;
  private readonly moorhens: Ducks | null;
  private readonly turtles: Turtles | null;
  private readonly kingfisher: Kingfisher | null;
  private readonly crabs: Crabs | null;

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
    const duckHooks = { onRipple: (x: number, z: number) => ripple(x, z, 0.35), onQuack: (volume: number) => hooks.play('quack', volume) };
    this.ducks = new Ducks(water, { around: level.spawn.position, min: 14, max: 55 }, sea ? GULLS : MALLARDS, duckHooks);
    this.heron = Heron.create(level, water);
    this.shadows = new FishShadows(water);
    // Plouf d'une bête qui plonge : rond, gouttes et son
    const plop = (x: number, z: number, volume: number): void => {
      ripple(x, z, 0.5);
      hooks.splash(x, z, 0.4);
      hooks.play('splash', volume);
    };
    const reeds = level.zones.find((zone) => zone.type === 'reeds');
    this.moorhens = !sea && reeds ? new Ducks(water, { around: reeds.center, min: 2, max: 12 }, MOORHENS, duckHooks, CONFIG.waterLife.moorhens) : null;
    this.turtles = sea ? null : new Turtles(level, water, { onPlop: plop });
    this.kingfisher = sea ? null : new Kingfisher(water, { onDive: plop });
    this.crabs = sea ? new Crabs(water, level.water.footprint.bounds) : null;
    this.group.name = 'water_life';
    this.group.add(this.ripples.group, this.ducks.mesh, this.shadows.mesh);
    for (const extra of [this.lilyPads?.group, this.heron?.group, this.moorhens?.mesh, this.turtles?.mesh, this.kingfisher?.group, this.crabs?.mesh]) {
      if (extra) this.group.add(extra);
    }
  }

  update(dt: number, elapsed: number, state: WaterLifeState): void {
    const { boat, boatYaw, night, evening } = state;
    this.lilyPads?.update(dt, elapsed, boat, evening);
    this.ducks.update(dt, elapsed, boat, night);
    this.moorhens?.update(dt, elapsed, boat, night);
    this.turtles?.update(dt, elapsed, boat);
    this.kingfisher?.update(dt, elapsed, boat, boatYaw, night);
    this.crabs?.update(dt, elapsed, boat);
    this.heron?.update(dt, elapsed, boat);
    this.shadows.update(dt, elapsed, boat);
    this.ripples.update(dt, elapsed);
  }
}
