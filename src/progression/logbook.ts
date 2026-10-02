import { CONFIG } from '../config';
import { readNumber, readObject } from '../core/validate';

/** Le tampon du jour, tout juste obtenu. */
export interface Stamp {
  /** Nombre de tampons du carnet, celui-ci compris. */
  readonly count: number;
  /** Coquillages offerts (avec le bonus si c'est un tampon « rond »). */
  readonly shells: number;
  readonly bonus: boolean;
}

/**
 * Carnet de bord (sauvegardé avec la partie) : un tampon par jour (réel) où
 * l'on a attrapé au moins un poisson. Chaque tampon rapporte un peu, et un
 * bonus tombe tous les `bonusEvery` tampons (CONFIG.progression.logbook).
 * Les tampons s'additionnent sans jamais se perdre : sauter un jour ne
 * coûte rien.
 */
export class Logbook {
  private stamps = 0;
  private lastDay = '';

  /** Reconstruit le carnet de bord depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Logbook {
    const raw = readObject(value);
    const logbook = new Logbook();
    logbook.stamps = Math.floor(readNumber(raw.stamps, 0, 0));
    logbook.lastDay = typeof raw.lastDay === 'string' ? raw.lastDay : '';
    return logbook;
  }

  /** Nombre de jours de pêche. */
  get count(): number {
    return this.stamps;
  }

  stampedToday(today: string): boolean {
    return this.lastDay === today;
  }

  /**
   * Cases tamponnées de la rangée en cours (0 → bonusEvery) : la rangée
   * reste pleine le jour du bonus, et repart le lendemain.
   */
  rowProgress(today: string): number {
    const { bonusEvery } = CONFIG.progression.logbook;
    const inRow = this.stamps % bonusEvery;
    return inRow === 0 && this.stamps > 0 && this.stampedToday(today) ? bonusEvery : inRow;
  }

  /** Première prise du jour : le tampon. Null s'il est déjà pris aujourd'hui. */
  stamp(today: string): Stamp | null {
    if (this.stampedToday(today)) return null;
    const { perStamp, bonusEvery, bonus } = CONFIG.progression.logbook;
    this.stamps += 1;
    this.lastDay = today;
    const isBonus = this.stamps % bonusEvery === 0;
    return { count: this.stamps, shells: perStamp + (isBonus ? bonus : 0), bonus: isBonus };
  }

  toData(): unknown {
    return { stamps: this.stamps, lastDay: this.lastDay };
  }
}
