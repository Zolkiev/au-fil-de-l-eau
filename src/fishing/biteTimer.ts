import { CONFIG } from '../config';
import { interpolateTable } from '../core/math';
import type { Bait } from '../data/baits';
import type { WeatherId } from '../data/weather';
import type { ZoneType } from '../scene/levelLoader';

/** Ce qui influence l'attente : où est le bouchon, quelle heure, quel appât. */
export interface BiteContext {
  /** Type de la zone où le bouchon est tombé, ou null en eau libre. */
  readonly zone: ZoneType | null;
  readonly hour: number;
  readonly bait: Bait;
  /** Temps qu'il fait (la pluie fait mordre plus vite) ; beau temps si absent. */
  readonly weather?: WeatherId;
  /** Le bouchon est tombé sur un coin où les poissons se montrent (sauts, bulles). */
  readonly hotspot?: boolean;
}

export type BiteEvent = 'nibble' | 'bite';

/**
 * Programme l'attente d'un lancer : quelques fausses touches (le bouchon
 * frémit), puis la vraie touche.
 */
export class BiteTimer {
  private elapsed = 0;
  private biteAt = Infinity;
  private nibbleTimes: number[] = [];
  private nibbleEndsAt = -Infinity;

  /** Prépare un nouveau lancer ; retourne le délai choisi avant la vraie touche (s). */
  start(context: BiteContext, random: () => number = Math.random): number {
    this.elapsed = 0;
    this.biteAt = waitTime(context, random);
    this.nibbleTimes = nibbleTimes(this.biteAt, random);
    this.nibbleEndsAt = -Infinity;
    return this.biteAt;
  }

  get pendingNibbles(): number {
    return this.nibbleTimes.length;
  }

  /** Une fausse touche est-elle en cours (le bouchon frémit) ? */
  get isNibbling(): boolean {
    return this.elapsed < this.nibbleEndsAt;
  }

  /** Fait avancer le temps ; retourne l'événement survenu pendant cette frame, s'il y en a un. */
  update(dt: number): BiteEvent | null {
    this.elapsed += dt;
    if (this.elapsed >= this.biteAt) {
      this.biteAt = Infinity;
      return 'bite';
    }
    if (this.nibbleTimes.length > 0 && this.elapsed >= this.nibbleTimes[0]) {
      this.nibbleTimes.shift();
      this.nibbleEndsAt = this.elapsed + CONFIG.fishing.nibbles.duration;
      return 'nibble';
    }
    return null;
  }
}

/** Délai avant la vraie touche : tirage aléatoire × zone × heure × appât. */
export function waitTime(context: BiteContext, random: () => number): number {
  const { waitTime: range, minWaitTime, zoneWaitFactor, hourWaitFactor } = CONFIG.fishing;
  const base = range.min + (range.max - range.min) * random();
  const zoneFactor = zoneWaitFactor[context.zone ?? 'open'];
  const hourFactor = interpolateTable(hourWaitFactor, context.hour);
  const weatherFactor = CONFIG.weather.waitFactor[context.weather ?? 'clear'];
  const hotspotFactor = context.hotspot ? CONFIG.signs.waitFactor : 1;
  return Math.max(minWaitTime, base * zoneFactor * hourFactor * context.bait.waitFactor * weatherFactor * hotspotFactor);
}

/**
 * Instants des fausses touches : réparties avant la vraie touche, espacées
 * d'au moins leur durée, et jamais juste avant la vraie (pour qu'on les distingue).
 */
function nibbleTimes(biteAt: number, random: () => number): number[] {
  const { min, max, duration, quietBeforeBite } = CONFIG.fishing.nibbles;
  const count = min + Math.floor(random() * (max - min + 1));
  const window = biteAt - quietBeforeBite;
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const time = (window * (i + 0.3 + random() * 0.5)) / count;
    const previous = times[times.length - 1] ?? 0;
    if (time > 0.8 && time - previous > duration + 0.3) times.push(time);
  }
  return times;
}
