import { readBoolean, readNumber, readObject } from '../core/validate';
import { fishById } from '../data/fish';

/** Un poisson gardé au vivier de la cabane. */
export interface KeptFish {
  readonly speciesId: string;
  readonly sizeCm: number;
  /** Variante rare (couleur inhabituelle). */
  readonly variant: boolean;
  /** Date d'arrivée au vivier (ms depuis 1970). */
  readonly keptAt: number;
}

/** Relit le vivier d'une sauvegarde : espèces connues seulement, sans dépasser la capacité. */
export function parseKeptFish(value: unknown, capacity: number): KeptFish[] {
  if (!Array.isArray(value)) return [];
  const kept: KeptFish[] = [];
  for (const item of value) {
    const raw = readObject(item);
    if (typeof raw.speciesId !== 'string' || !fishById(raw.speciesId) || kept.length >= capacity) continue;
    kept.push({
      speciesId: raw.speciesId,
      sizeCm: readNumber(raw.sizeCm, 0, 0),
      variant: readBoolean(raw.variant, false),
      keptAt: readNumber(raw.keptAt, Date.now(), 0),
    });
  }
  return kept;
}
