import { CONFIG } from '../config';
import { readNumber, readObject } from '../core/validate';
import type { PlaceId } from '../data/places';
import { CLUE_KINDS, trailIn, trailOf, type ClueKind, type Trail } from '../data/trails';

/** Un indice tout juste trouvé. */
export interface FoundClue {
  readonly trail: Trail;
  readonly kind: ClueKind;
  /** Nombre d'indices de cette piste, celui-ci compris. */
  readonly count: number;
}

/**
 * Pistes des légendaires (sauvegardées avec la partie) : chaque jour (réel),
 * une bouteille à message attend dans chaque lieu dont la piste n'est pas
 * finie, avec l'indice suivant. Chaque indice fait aussi mordre le
 * légendaire plus souvent (CONFIG.events.trail).
 */
export class Trails {
  /** Indices trouvés par légendaire (identifiant de l'espèce → 0 à 3). */
  private readonly found = new Map<string, number>();
  /** Jour (réel) de la dernière bouteille trouvée dans chaque lieu. */
  private readonly lastDay = new Map<string, string>();

  /** Reconstruit les pistes depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Trails {
    const raw = readObject(value);
    const trails = new Trails();
    for (const [speciesId, count] of Object.entries(readObject(raw.found))) {
      if (trailOf(speciesId)) trails.found.set(speciesId, Math.floor(readNumber(count, 0, 0, CLUE_KINDS.length)));
    }
    for (const [place, day] of Object.entries(readObject(raw.lastDay))) {
      if (typeof day === 'string') trails.lastDay.set(place, day);
    }
    return trails;
  }

  /** Indices déjà trouvés sur ce légendaire, dans l'ordre. */
  clues(speciesId: string): ClueKind[] {
    return CLUE_KINDS.slice(0, this.found.get(speciesId) ?? 0);
  }

  isComplete(speciesId: string): boolean {
    return (this.found.get(speciesId) ?? 0) >= CLUE_KINDS.length;
  }

  /** La bouteille du jour de ce lieu a-t-elle déjà été trouvée ? */
  foundToday(place: PlaceId, today: string): boolean {
    return this.lastDay.get(place) === today;
  }

  /**
   * Une bouteille à message attend-elle aujourd'hui dans ce lieu ? Plus
   * aucune une fois la piste finie, ou le légendaire attrapé (`caught`).
   */
  bottleWaiting(place: PlaceId, today: string, caught: boolean): boolean {
    const trail = trailIn(place);
    return trail !== undefined && !caught && !this.isComplete(trail.speciesId) && !this.foundToday(place, today);
  }

  /** Ouvre la bouteille du jour : l'indice suivant de la piste du lieu. Null s'il n'y en a pas. */
  open(place: PlaceId, today: string, caught: boolean): FoundClue | null {
    const trail = trailIn(place);
    if (!trail || !this.bottleWaiting(place, today, caught)) return null;
    const index = this.found.get(trail.speciesId) ?? 0;
    this.found.set(trail.speciesId, index + 1);
    this.lastDay.set(place, today);
    return { trail, kind: CLUE_KINDS[index], count: index + 1 };
  }

  /** Coup de pouce au légendaire de ce lieu : il monte avec chaque indice. */
  legendaryFactor(place: PlaceId): number {
    const trail = trailIn(place);
    const factors = CONFIG.events.trail.legendaryFactor;
    return factors[Math.min(this.found.get(trail?.speciesId ?? '') ?? 0, factors.length - 1)];
  }

  toData(): unknown {
    return { found: Object.fromEntries(this.found), lastDay: Object.fromEntries(this.lastDay) };
  }
}
