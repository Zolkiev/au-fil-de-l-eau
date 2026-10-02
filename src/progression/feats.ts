import type { Journal } from '../core/journal';
import { curiosOf } from '../data/finds';
import { FISH, fishOf } from '../data/fish';
import type { Feat } from '../data/shop';
import type { Finds } from './finds';
import type { Logbook } from './logbook';
import { countStars } from './mastery';

/**
 * Exploits : ce qu'il faut accomplir pour gagner les objets exclusifs de la
 * boutique (ceux qui ont un `feat` dans src/data/shop.ts). Tout se déduit du
 * carnet, de la collection de trouvailles et du carnet de bord : un exploit
 * accompli avant l'arrivée des objets exclusifs compte aussi.
 */

/** Ce que les exploits regardent. */
export interface FeatSources {
  readonly journal: Journal;
  readonly finds: Finds;
  readonly logbook: Logbook;
}

/** Où l'on en est d'un exploit (« 4 / 6 »). */
export interface FeatProgress {
  readonly done: number;
  readonly total: number;
}

export function featProgress(feat: Feat, { journal, finds, logbook }: FeatSources): FeatProgress {
  switch (feat.kind) {
    case 'legend': {
      const legends = fishOf(feat.place).filter((species) => species.rarity === 'legendary');
      return { done: legends.filter((species) => journal.entry(species.id)).length, total: legends.length };
    }
    case 'finds':
      return { done: finds.foundIn(feat.place), total: curiosOf(feat.place).length };
    case 'stars':
      return { done: Math.min(countStars(journal), feat.count), total: feat.count };
    case 'journal':
      return { done: journal.speciesCount, total: FISH.length };
    case 'stamps':
      return { done: Math.min(logbook.count, feat.count), total: feat.count };
  }
}

export function featAchieved(feat: Feat, sources: FeatSources): boolean {
  const { done, total } = featProgress(feat, sources);
  return total > 0 && done >= total;
}
