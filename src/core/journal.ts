import { fishById } from '../data/fish';
import { readBoolean, readNumber } from './validate';

/** Ce que le carnet retient pour une espèce. */
export interface JournalEntry {
  readonly speciesId: string;
  count: number;
  bestSizeCm: number;
  /** Date de la première prise (ms depuis 1970). */
  readonly firstCaughtAt: number;
  /** Variante rare déjà attrapée. */
  variant: boolean;
}

/** Résultat de l'ajout d'une prise au carnet. */
export interface CatchResult {
  readonly isNewSpecies: boolean;
  /** Plus grand que le précédent record (jamais vrai pour une première prise). */
  readonly isRecord: boolean;
  /** Première variante rare de cette espèce. */
  readonly isNewVariant: boolean;
  /** Record avant cette prise (null pour une première prise). */
  readonly previousBestCm: number | null;
  readonly entry: JournalEntry;
}

/** Carnet de pêche : prises et records par espèce (sauvegardé avec la partie). */
export class Journal {
  private readonly entries = new Map<string, JournalEntry>();

  /** Reconstruit un carnet depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(data: unknown): Journal {
    const journal = new Journal();
    if (!Array.isArray(data)) return journal;
    for (const item of data) {
      const entry = parseEntry(item);
      if (entry) journal.entries.set(entry.speciesId, entry);
    }
    return journal;
  }

  record(speciesId: string, sizeCm: number, variant: boolean, now = Date.now()): CatchResult {
    const existing = this.entries.get(speciesId);
    if (!existing) {
      const entry = { speciesId, count: 1, bestSizeCm: sizeCm, firstCaughtAt: now, variant };
      this.entries.set(speciesId, entry);
      return { isNewSpecies: true, isRecord: false, isNewVariant: variant, previousBestCm: null, entry };
    }
    const previousBestCm = existing.bestSizeCm;
    const isNewVariant = variant && !existing.variant;
    existing.count += 1;
    existing.bestSizeCm = Math.max(previousBestCm, sizeCm);
    existing.variant ||= variant;
    return { isNewSpecies: false, isRecord: sizeCm > previousBestCm, isNewVariant, previousBestCm, entry: existing };
  }

  entry(speciesId: string): JournalEntry | undefined {
    return this.entries.get(speciesId);
  }

  /** Nombre d'espèces déjà attrapées. */
  get speciesCount(): number {
    return this.entries.size;
  }

  /** Toutes les entrées, dans l'ordre des premières prises. */
  get all(): readonly JournalEntry[] {
    return [...this.entries.values()];
  }

  get totalCatches(): number {
    let total = 0;
    this.entries.forEach((entry) => (total += entry.count));
    return total;
  }

  toData(): JournalEntry[] {
    return [...this.entries.values()].map((entry) => ({ ...entry }));
  }
}

/** Une entrée valide : espèce connue, nombres cohérents. */
function parseEntry(item: unknown): JournalEntry | null {
  if (typeof item !== 'object' || item === null) return null;
  const record = item as Record<string, unknown>;
  const speciesId = record.speciesId;
  if (typeof speciesId !== 'string' || !fishById(speciesId)) return null;
  const count = Math.floor(readNumber(record.count, 0, 0));
  if (count === 0) return null;
  return {
    speciesId,
    count,
    bestSizeCm: readNumber(record.bestSizeCm, 0, 0),
    firstCaughtAt: readNumber(record.firstCaughtAt, Date.now(), 0),
    variant: readBoolean(record.variant, false),
  };
}
