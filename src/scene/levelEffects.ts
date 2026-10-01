import { Color, Group, MathUtils, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { Campfire } from './campfire';
import type { Ambience } from './dayNight';
import { glowTexture } from './glowTexture';
import type { EffectSpot, LevelData } from './levelLoader';
import type { NightLights } from './nightLights';
import { Particles, puffTexture, type Particle } from './particles';

/** Un effet du décor qui émet des particules : où, et combien il en « doit » (partie entière = à émettre). */
interface Emitter {
  readonly spot: EffectSpot;
  budget: number;
}

const _color = new Color();
const TAU = Math.PI * 2;

/**
 * Effets du décor et éclaboussures :
 * - fumée des cheminées (`fx_smoke_<n>`), qui dérive avec le vent ;
 * - feux de camp (`fx_fire_<n>`) : flammes, étincelles, fumée, lumière ;
 * - embruns au pied d'une cascade (`fx_mist_<n>`) ;
 * - gouttes projetées (`splash`) : plouf du bouchon, saut d'un poisson, rames…
 *
 * Trois lots de particules seulement (volutes, lueurs, gouttes), soit trois
 * appels de dessin, quel que soit le nombre d'effets du niveau.
 */
export class LevelEffects {
  readonly group = new Group();
  private readonly puffs = new Particles('fx_puffs', { capacity: CONFIG.effects.capacity.puffs, texture: puffTexture() });
  private readonly sparks = new Particles('fx_sparks', { capacity: CONFIG.effects.capacity.sparks, texture: glowTexture(), additive: true });
  private readonly drops = new Particles('fx_drops', { capacity: CONFIG.effects.capacity.drops, texture: glowTexture() });
  private readonly emitters: Emitter[];
  private readonly fires: Campfire[] = [];
  private readonly waterLevel: number;
  /** Part des particules émises (qualité graphique). */
  private density = 1;
  private readonly light = new Color(0xffffff);

  constructor(level: LevelData, nightLights: NightLights) {
    this.waterLevel = level.water.level;
    this.emitters = level.effects.map((spot) => ({ spot, budget: Math.random() }));
    this.group.name = 'level_effects';
    this.group.add(this.puffs.mesh, this.sparks.mesh, this.drops.mesh);
    const { light } = CONFIG.effects.fire;
    for (const spot of level.effects) {
      if (spot.kind !== 'fire') continue;
      const fire = new Campfire(spot.position, spot.scale, nightLights.addSource(lightSpot(spot), light.color, light.intensity, light.day));
      this.fires.push(fire);
      this.group.add(fire.group);
    }
  }

  /** Part des particules émises par le décor (qualité graphique : 0 → 1). */
  setDensity(density: number): void {
    this.density = density;
  }

  /** Fumée, embruns et gouttes prennent la lumière du moment (blancs le jour, bleutés et sombres la nuit). */
  setAmbience(ambience: Ambience): void {
    const { colors, values } = ambience;
    this.light.copy(colors.hemiSky).multiplyScalar(values.hemiIntensity * 0.5);
    this.light.add(_color.copy(colors.sun).multiplyScalar(values.sunIntensity * 0.25));
    this.light.setRGB(Math.min(this.light.r, 1), Math.min(this.light.g, 1), Math.min(this.light.b, 1));
    this.puffs.setLight(this.light);
    this.drops.setLight(this.light);
  }

  /**
   * `night` : 0 → 1 ; `wind` : force du vent (0 → 1) ; `focus` : la barque
   * (les effets trop loin d'elle n'émettent rien).
   */
  update(dt: number, elapsed: number, night: number, wind: number, focus: Vector3): void {
    for (const emitter of this.emitters) {
      if (emitter.spot.position.distanceTo(focus) < CONFIG.effects.range) this.emit(emitter, dt, wind);
    }
    for (const fire of this.fires) fire.update(elapsed, night);
    this.puffs.update(dt);
    this.sparks.update(dt);
    this.drops.update(dt);
  }

  /** Gerbe de gouttes en (x, z) à la surface de l'eau ; `strength` : 1 = plouf du bouchon. */
  splash(x: number, z: number, strength = 1): void {
    const { drops, size, speed, gravity, color, alpha } = CONFIG.effects.splash;
    _color.set(color);
    const count = Math.round(drops * Math.min(strength, 1.5));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const out = (0.25 + Math.random() * 0.6) * speed * strength * 0.5;
      const drop = this.drops.spawn();
      place(drop, x, this.waterLevel + 0.05, z);
      drop.vx = Math.cos(angle) * out;
      drop.vz = Math.sin(angle) * out;
      drop.vy = (0.55 + Math.random() * 0.6) * speed * Math.sqrt(strength);
      drop.gravity = gravity;
      drop.life = 1.2;
      drop.size = size * (0.7 + Math.random() * 0.8);
      drop.endSize = drop.size * 0.6;
      drop.alpha = alpha;
      drop.floor = this.waterLevel - 0.05;
      tint(drop, _color);
    }
  }

  /** Émet ce que l'effet « doit » depuis la dernière image. */
  private emit(emitter: Emitter, dt: number, wind: number): void {
    const { smoke, fire, mist } = CONFIG.effects;
    const { kind } = emitter.spot;
    const rate = kind === 'smoke' ? smoke.rate : kind === 'mist' ? mist.rate : fire.sparks.rate + fire.smoke.rate;
    emitter.budget += rate * this.density * dt;
    while (emitter.budget >= 1) {
      emitter.budget -= 1;
      if (kind === 'smoke') this.puffSmoke(emitter.spot, wind, smoke.alpha, smoke.size, smoke.endSize);
      else if (kind === 'mist') this.puffMist(emitter.spot);
      else if (Math.random() * rate < fire.sparks.rate) this.spark(emitter.spot);
      else this.puffSmoke(emitter.spot, wind, fire.smoke.alpha, fire.smoke.size, fire.smoke.endSize, 0.5);
    }
  }

  /** Volute de fumée : elle monte, s'élargit, pâlit, et part avec le vent. */
  private puffSmoke(spot: EffectSpot, wind: number, alpha: number, size: number, endSize: number, lift = 0): void {
    const { life, rise, spread, color, drift } = CONFIG.effects.smoke;
    const { direction } = CONFIG.clouds;
    const push = drift * (1 + 4 * wind);
    const puff = this.puffs.spawn();
    place(puff, spot.position.x + jitter(spread), spot.position.y + lift * spot.scale, spot.position.z + jitter(spread));
    puff.vx = Math.cos(direction) * push + jitter(0.08);
    puff.vz = Math.sin(direction) * push + jitter(0.08);
    puff.vy = rise * (0.8 + Math.random() * 0.4);
    puff.drag = 0.12;
    puff.life = MathUtils.lerp(life.min, life.max, Math.random());
    puff.size = size * spot.scale;
    puff.endSize = endSize * spot.scale * (0.8 + Math.random() * 0.4);
    puff.alpha = alpha;
    puff.fadeIn = 0.12;
    puff.rotation = Math.random() * TAU;
    puff.spin = jitter(0.4);
    tint(puff, _color.set(color));
  }

  /** Embruns : un nuage blanc qui s'élève de la surface, quelque part dans le rayon de l'effet. */
  private puffMist(spot: EffectSpot): void {
    const { life, rise, size, endSize, color, alpha } = CONFIG.effects.mist;
    // Le rideau d'eau tombe le long d'une ligne : nuage étiré en travers, étroit dans le sens où l'eau s'en va
    const along = jitter(spot.scale * 0.25);
    const across = jitter(spot.scale);
    const sin = Math.sin(spot.yaw);
    const cos = Math.cos(spot.yaw);
    const puff = this.puffs.spawn();
    place(puff, spot.position.x + sin * along + cos * across, spot.position.y + jitter(0.3), spot.position.z + cos * along - sin * across);
    puff.vx = jitter(0.25);
    puff.vz = jitter(0.25);
    puff.vy = rise * (0.6 + Math.random() * 0.8);
    puff.drag = 0.5;
    puff.life = MathUtils.lerp(life.min, life.max, Math.random());
    puff.size = size;
    puff.endSize = endSize;
    puff.alpha = alpha;
    puff.fadeIn = 0.25;
    puff.rotation = Math.random() * TAU;
    puff.spin = jitter(0.3);
    tint(puff, _color.set(color));
  }

  /** Étincelle : un point vif qui monte en zigzag et s'éteint. */
  private spark(spot: EffectSpot): void {
    const { life, rise, size, color } = CONFIG.effects.fire.sparks;
    const spark = this.sparks.spawn();
    place(spark, spot.position.x + jitter(0.12), spot.position.y + 0.3 * spot.scale, spot.position.z + jitter(0.12));
    spark.vx = jitter(0.5);
    spark.vz = jitter(0.5);
    spark.vy = rise * (0.7 + Math.random() * 0.6);
    spark.gravity = -0.4;
    spark.drag = 0.6;
    spark.life = life * (0.6 + Math.random() * 0.8);
    spark.size = size * (0.7 + Math.random() * 0.8);
    spark.endSize = spark.size * 0.3;
    tint(spark, _color.set(color));
  }
}

/** La lumière d'un feu est un peu au-dessus des braises (sinon le sol la mange). */
function lightSpot(spot: EffectSpot): Vector3 {
  return spot.position.clone().setY(spot.position.y + 0.5 * spot.scale);
}

function place(particle: Particle, x: number, y: number, z: number): void {
  particle.x = x;
  particle.y = y;
  particle.z = z;
}

function tint(particle: Particle, color: Color): void {
  particle.r = color.r;
  particle.g = color.g;
  particle.b = color.b;
}

/** Nombre au hasard entre -amount et +amount. */
function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}
