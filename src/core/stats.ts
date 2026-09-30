import { fishById } from '../data/fish';
import type { EscapeReason } from '../fishing/fishingState';
import { readNumber, readObject } from './validate';

export interface StatsData {
  casts: number;
  catches: number;
  /** Lignes revenues vides, par raison. */
  escapes: Record<EscapeReason, number>;
  playTimeSeconds: number;
  /** Plus grosse prise, toutes espèces confondues. */
  biggest: { speciesId: string; sizeCm: number } | null;
}

const ESCAPE_REASONS: readonly EscapeReason[] = ['cancel', 'early', 'missed', 'snapped'];

/** Statistiques de la partie (sauvegardées). */
export class Stats {
  readonly data: StatsData;

  constructor(data?: StatsData) {
    this.data = data ?? { casts: 0, catches: 0, escapes: emptyEscapes(), playTimeSeconds: 0, biggest: null };
  }

  /** Reconstruit les statistiques depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Stats {
    const raw = readObject(value);
    const rawEscapes = readObject(raw.escapes);
    const escapes = emptyEscapes();
    for (const reason of ESCAPE_REASONS) escapes[reason] = Math.floor(readNumber(rawEscapes[reason], 0, 0));
    return new Stats({
      casts: Math.floor(readNumber(raw.casts, 0, 0)),
      catches: Math.floor(readNumber(raw.catches, 0, 0)),
      escapes,
      playTimeSeconds: readNumber(raw.playTimeSeconds, 0, 0),
      biggest: parseBiggest(raw.biggest),
    });
  }

  recordCast(): void {
    this.data.casts += 1;
  }

  recordCatch(speciesId: string, sizeCm: number): void {
    this.data.catches += 1;
    if (!this.data.biggest || sizeCm > this.data.biggest.sizeCm) this.data.biggest = { speciesId, sizeCm };
  }

  recordEscape(reason: EscapeReason): void {
    this.data.escapes[reason] += 1;
  }

  addPlayTime(seconds: number): void {
    this.data.playTimeSeconds += seconds;
  }

  toData(): StatsData {
    return structuredClone(this.data);
  }
}

function emptyEscapes(): Record<EscapeReason, number> {
  return { cancel: 0, early: 0, missed: 0, snapped: 0 };
}

function parseBiggest(value: unknown): StatsData['biggest'] {
  const raw = readObject(value);
  if (typeof raw.speciesId !== 'string' || !fishById(raw.speciesId)) return null;
  return { speciesId: raw.speciesId, sizeCm: readNumber(raw.sizeCm, 0, 0) };
}
