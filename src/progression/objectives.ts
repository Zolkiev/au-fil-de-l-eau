import { CONFIG } from '../config';
import type { CatchResult, Journal, JournalEntry } from '../core/journal';
import { FISH, fishById, type FishSpecies } from '../data/fish';

/**
 * Objectifs du carnet : quatre par espèce (l'attraper, en attraper un beau,
 * un trophée, et sa variante rare). Chacun rapporte des coquillages une
 * seule fois (CONFIG.progression.objectiveRewards).
 *
 * Rien n'est stocké à part : tout se déduit du carnet (record et variante),
 * donc les prises faites avant l'arrivée des objectifs comptent aussi.
 */

export type Objective = 'caught' | 'nice' | 'trophy' | 'variant';
export const OBJECTIVES: readonly Objective[] = ['caught', 'nice', 'trophy', 'variant'];

/** Palier de taille d'une prise. */
export type SizeTier = 'small' | 'nice' | 'trophy';

/** Taille minimale (cm) d'un beau poisson ou d'un trophée pour cette espèce. */
export function tierThresholdCm(species: FishSpecies, tier: 'nice' | 'trophy'): number {
  const { min, max } = species.sizeCm;
  return Math.ceil(min + (max - min) * CONFIG.progression.sizeTiers[tier]);
}

export function sizeTier(species: FishSpecies, sizeCm: number): SizeTier {
  if (sizeCm >= tierThresholdCm(species, 'trophy')) return 'trophy';
  if (sizeCm >= tierThresholdCm(species, 'nice')) return 'nice';
  return 'small';
}

/** Objectifs remplis pour une espèce, d'après son entrée du carnet. */
export function achievedObjectives(species: FishSpecies, entry: JournalEntry | undefined): Objective[] {
  if (!entry) return [];
  return OBJECTIVES.filter((objective) => isAchieved(objective, species, entry.bestSizeCm, entry.variant));
}

/** Objectifs remplis par cette prise (ceux qui ne l'étaient pas avant). */
export function objectivesGained(species: FishSpecies, result: CatchResult): Objective[] {
  const { entry, previousBestCm, isNewVariant } = result;
  const gained: Objective[] = [];
  if (previousBestCm === null) gained.push('caught');
  for (const tier of ['nice', 'trophy'] as const) {
    const threshold = tierThresholdCm(species, tier);
    if (entry.bestSizeCm >= threshold && (previousBestCm === null || previousBestCm < threshold)) gained.push(tier);
  }
  if (isNewVariant) gained.push('variant');
  return gained;
}

export function objectiveReward(objective: Objective): number {
  return CONFIG.progression.objectiveRewards[objective];
}

/** Nombre d'objectifs remplis dans tout le carnet (sur FISH.length × 4). */
export function countAchieved(journal: Journal): number {
  return journal.all.reduce((total, entry) => total + achievedFor(entry).length, 0);
}

export const TOTAL_OBJECTIVES = FISH.length * OBJECTIVES.length;

/** Coquillages gagnés grâce au carnet depuis le début de la partie. */
export function journalShells(journal: Journal): number {
  let total = 0;
  for (const entry of journal.all) {
    for (const objective of achievedFor(entry)) total += objectiveReward(objective);
  }
  return total;
}

function achievedFor(entry: JournalEntry): Objective[] {
  const species = fishById(entry.speciesId);
  return species ? achievedObjectives(species, entry) : [];
}

function isAchieved(objective: Objective, species: FishSpecies, bestSizeCm: number, variant: boolean): boolean {
  switch (objective) {
    case 'caught':
      return true;
    case 'nice':
    case 'trophy':
      return bestSizeCm >= tierThresholdCm(species, objective);
    case 'variant':
      return variant;
  }
}
