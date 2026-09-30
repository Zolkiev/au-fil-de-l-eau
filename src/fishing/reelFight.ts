import { MathUtils } from 'three';
import { CONFIG } from '../config';

/** Événement survenu pendant une frame du combat. */
export type FightEvent = 'burst' | 'landed' | 'snapped';

/** Matériel du joueur (boutique de la cabane) : multiplicateurs des réglages de CONFIG.reel. */
export interface Gear {
  /** Montée de la tension en moulinant (canne). */
  readonly tensionRise: number;
  /** Vitesse de remontée (moulinet). */
  readonly reelSpeed: number;
  /** Temps à tension maximale avant la casse (ligne). */
  readonly breakTime: number;
}

/** Matériel de départ : les réglages de CONFIG.reel tels quels. */
export const BASIC_GEAR: Gear = { tensionRise: 1, reelSpeed: 1, breakTime: 1 };

/** Ce que la jauge a besoin de connaître du combat. */
export interface ReelStatus {
  /** Tension de la ligne, 0 → 1. */
  readonly tension: number;
  /** Progression vers la casse, 0 → 1 (monte tant que la tension est au maximum). */
  readonly breakProgress: number;
  /** Distance du poisson à la pointe de la canne (m). */
  readonly distance: number;
  readonly startDistance: number;
}

/**
 * Mini-jeu de remontée, en logique pure (sans affichage).
 *
 * - Mouliner (clic maintenu) rapproche le poisson mais fait monter la tension.
 * - Relâcher fait baisser la tension, mais le poisson reprend un peu de ligne.
 * - Le poisson tire par à-coups : la tension grimpe et il s'éloigne.
 * - Tension au maximum trop longtemps : la ligne casse.
 * - Poisson arrivé à la barque : il est pris.
 */
export class ReelFight implements ReelStatus {
  readonly startDistance: number;
  distance: number;
  tension: number = CONFIG.reel.startTension;
  private readonly strength: number;
  private readonly burstFrequency: number;
  private readonly maxDistance: number;
  private readonly gear: Gear;
  private readonly random: () => number;
  private overload = 0;
  private burstLeft = 0;
  private nextBurstIn: number;

  constructor(
    strength: number,
    burstFrequency: number,
    startDistance: number,
    gear: Gear = BASIC_GEAR,
    random: () => number = Math.random,
  ) {
    this.strength = strength;
    this.gear = gear;
    this.burstFrequency = burstFrequency;
    this.startDistance = startDistance;
    this.distance = startDistance;
    this.maxDistance = startDistance + CONFIG.reel.maxExtraLine;
    this.random = random;
    this.nextBurstIn = this.drawBurstDelay();
  }

  get isBursting(): boolean {
    return this.burstLeft > 0;
  }

  get breakProgress(): number {
    return this.overload;
  }

  /** Fait avancer le combat ; `reeling` = le joueur mouline (clic maintenu). */
  update(dt: number, reeling: boolean): FightEvent | null {
    const burstStarted = this.updateBursts(dt);
    this.updateTension(dt, reeling);
    this.updateDistance(dt, reeling);
    this.updateOverload(dt);
    if (this.overload >= 1) return 'snapped';
    if (this.distance <= CONFIG.reel.landDistance) return 'landed';
    return burstStarted ? 'burst' : null;
  }

  /** Retourne true à l'instant où un à-coup commence. */
  private updateBursts(dt: number): boolean {
    if (this.burstLeft > 0) {
      this.burstLeft -= dt;
      return false;
    }
    this.nextBurstIn -= dt;
    if (this.nextBurstIn > 0) return false;
    const { minDuration, maxDuration } = CONFIG.reel.burst;
    this.burstLeft = MathUtils.lerp(minDuration, maxDuration, this.random());
    this.nextBurstIn = this.drawBurstDelay();
    return true;
  }

  private updateTension(dt: number, reeling: boolean): void {
    const { tensionRise, tensionFall, burst } = CONFIG.reel;
    const rise = (tensionRise.base + tensionRise.perStrength * this.strength) * this.gear.tensionRise;
    const player = reeling ? rise : -tensionFall;
    const fish = this.isBursting ? burst.tension * this.strength : 0;
    this.tension = MathUtils.clamp(this.tension + (player + fish) * dt, 0, 1);
  }

  private updateDistance(dt: number, reeling: boolean): void {
    const { reelSpeed, idlePull, burst } = CONFIG.reel;
    const reelIn = reeling ? reelSpeed * this.gear.reelSpeed * (this.isBursting ? burst.reelFactor : 1) : 0;
    const pull = this.isBursting ? burst.pull : reeling ? 0 : idlePull;
    this.distance = MathUtils.clamp(this.distance + (pull * this.strength - reelIn) * dt, 0, this.maxDistance);
  }

  /** La casse approche à tension maximale et s'éloigne dès qu'on relâche. */
  private updateOverload(dt: number): void {
    const { overloadRecovery } = CONFIG.reel;
    const breakTime = CONFIG.reel.breakTime * this.gear.breakTime;
    if (this.tension >= 1) this.overload += dt / breakTime;
    else this.overload = Math.max(0, this.overload - (dt * overloadRecovery) / breakTime);
  }

  /** Délai avant le prochain à-coup : aléatoire (loi exponentielle), jamais trop court. */
  private drawBurstDelay(): number {
    if (this.burstFrequency <= 0) return Infinity;
    const delay = -Math.log(1 - this.random()) / this.burstFrequency;
    return Math.max(CONFIG.reel.burst.minInterval, delay);
  }
}
