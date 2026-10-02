import { CONFIG } from '../config';
import { fishOf, type FishSpecies, type Habitat } from '../data/fish';
import type { PlaceId } from '../data/places';
import type { FishBoosts } from '../fishing/fishSelector';

/**
 * Rendez-vous rares, pour donner envie de revenir :
 * - le poisson du jour, tiré d'après la date réelle (le même toute la
 *   journée, sans rien sauvegarder) : il mord plus souvent, et sa première
 *   prise du jour rapporte un bonus ;
 * - la nuit de pleine lune (cycle en jours de jeu, voir GameClock) : les
 *   légendaires et les variantes sortent plus souvent.
 * La piste d'un légendaire (src/progression/trails.ts) s'y ajoute.
 */

/** Poisson du jour d'un lieu : une espèce non légendaire qui vit dans ce niveau ; null s'il n'y en a pas. */
export function dailyFish(day: string, place: PlaceId, habitats: readonly Habitat[]): FishSpecies | null {
  const eligible = fishOf(place).filter(
    (species) => species.rarity !== 'legendary' && species.habitats.some((habitat) => habitats.includes(habitat)),
  );
  if (eligible.length === 0) return null;
  return eligible[hashText(`${day}:${place}`) % eligible.length];
}

/** Coup de pouce aux espèces pas encore au carnet (voir Progression.discovery). */
export type Discovery = Pick<FishBoosts, 'discoveryFactor' | 'isUnknown'>;

/** Ce que la progression apporte au tirage : espèces inconnues, et piste du légendaire du lieu (× son poids). */
export interface ProgressBoosts {
  readonly discovery: Discovery;
  readonly trailFactor: number;
}

/** Coups de pouce en cours pour le tirage du poisson. */
export function currentBoosts(favorite: FishSpecies | null, fullMoonNight: boolean, progress: ProgressBoosts): FishBoosts {
  const { dailyFish: daily, fullMoon } = CONFIG.events;
  return {
    favoriteId: favorite?.id ?? null,
    favoriteFactor: daily.weightFactor,
    legendaryFactor: (fullMoonNight ? fullMoon.legendaryFactor : 1) * progress.trailFactor,
    variantFactor: fullMoonNight ? fullMoon.variantFactor : 1,
    ...progress.discovery,
  };
}

/** Empreinte d'un texte (FNV-1a) : la même date donne toujours le même poisson. */
function hashText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
