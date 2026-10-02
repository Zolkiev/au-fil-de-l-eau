import { CONFIG } from '../config';
import type { CatchResult, Journal } from '../core/journal';
import { FISH, fishById, type FishSpecies } from '../data/fish';

/**
 * Maîtrise d'une espèce : trois étoiles gagnées à force de prises (seuils
 * selon la rareté, CONFIG.progression.mastery). Chaque étoile rapporte des
 * coquillages une seule fois : un poisson déjà connu garde ainsi de la
 * valeur.
 *
 * Comme pour les objectifs, rien n'est stocké à part : tout se déduit du
 * nombre de prises du carnet, donc les prises d'avant comptent aussi.
 */

export const MAX_STARS = CONFIG.progression.mastery.rewards.length;
export const TOTAL_STARS = FISH.length * MAX_STARS;

/** Nombre de prises à atteindre pour chaque étoile de cette espèce. */
export function starThresholds(species: FishSpecies): readonly number[] {
  return CONFIG.progression.mastery.catches[species.rarity];
}

/** Étoiles gagnées avec ce nombre de prises (0 → MAX_STARS). */
export function masteryStars(species: FishSpecies, count: number): number {
  return starThresholds(species).filter((threshold) => count >= threshold).length;
}

/** Nombre de prises de la prochaine étoile ; null si l'espèce est maîtrisée. */
export function nextStarAt(species: FishSpecies, count: number): number | null {
  return starThresholds(species).find((threshold) => count < threshold) ?? null;
}

/** Coquillages offerts pour la n-ième étoile (1 → MAX_STARS). */
export function starReward(star: number): number {
  return CONFIG.progression.mastery.rewards[star - 1] ?? 0;
}

/** Étoiles gagnées par cette prise (numéros des étoiles, le plus souvent aucune). */
export function starsGained(species: FishSpecies, result: CatchResult): number[] {
  const before = masteryStars(species, result.entry.count - 1);
  const after = masteryStars(species, result.entry.count);
  return Array.from({ length: after - before }, (_, index) => before + index + 1);
}

/** Étoiles gagnées dans tout le carnet (sur TOTAL_STARS). */
export function countStars(journal: Journal): number {
  return journal.all.reduce((total, entry) => total + starsOf(entry.speciesId, entry.count), 0);
}

/** Coquillages gagnés grâce à la maîtrise depuis le début de la partie. */
export function masteryShells(journal: Journal): number {
  let total = 0;
  for (const entry of journal.all) {
    for (let star = 1; star <= starsOf(entry.speciesId, entry.count); star++) total += starReward(star);
  }
  return total;
}

function starsOf(speciesId: string, count: number): number {
  const species = fishById(speciesId);
  return species ? masteryStars(species, count) : 0;
}
