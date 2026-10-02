import { CONFIG } from '../config';
import { timeSlotAt, type TimeSlot } from '../core/gameClock';
import { warn } from '../core/log';
import { FISH, fishOf, type FishSpecies, type Habitat } from '../data/fish';
import { PLACES, type PlaceId } from '../data/places';
import { ZONE_TYPES } from '../scene/levelLoader';
import type { BiteContext } from './biteTimer';

/** Le poisson tiré au sort pour une touche. */
export interface FishRoll {
  readonly species: FishSpecies;
  readonly sizeCm: number;
  /** Force effective pour le mini-jeu (force de l'espèce ajustée par la taille). */
  readonly strength: number;
  /** Variante rare de l'espèce (couleur inhabituelle). */
  readonly variant: boolean;
  /** Où et quand il a mordu (pour les demandes de Moustache). */
  readonly habitat: Habitat;
  readonly slot: TimeSlot;
}

type Random = () => number;

/** Coups de pouce du moment (voir src/progression/rendezvous.ts). */
export interface FishBoosts {
  /** Poisson du jour : il mord plus souvent (× favoriteFactor). */
  readonly favoriteId: string | null;
  readonly favoriteFactor: number;
  /** Nuit de pleine lune : poids des légendaires et chance de variante. */
  readonly legendaryFactor: number;
  readonly variantFactor: number;
  /** Espèces pas encore au carnet, hors légendaires : poids × discoveryFactor (il monte après des prises sans nouveauté). */
  readonly discoveryFactor: number;
  readonly isUnknown: (speciesId: string) => boolean;
}

export const NO_BOOSTS: FishBoosts = {
  favoriteId: null,
  favoriteFactor: 1,
  legendaryFactor: 1,
  variantFactor: 1,
  discoveryFactor: 1,
  isUnknown: () => false,
};

/** Ce qui décide du poisson : le lieu, là où il mord (zone, heure, appât) et les coups de pouce du moment. */
export interface SelectionContext extends BiteContext {
  readonly place: PlaceId;
  readonly boosts?: FishBoosts;
}

/**
 * Choisit le poisson qui a mordu : parmi les espèces qui vivent là et
 * mordent à cette heure, tirage pondéré par la rareté et l'appât. L'appât
 * influe aussi sur la taille et sur la chance de tomber sur une variante.
 */
export function selectFish(context: SelectionContext, random: Random = Math.random): FishRoll {
  const habitat: Habitat = context.zone ?? 'open';
  const slot = timeSlotAt(context.hour);
  const species = pickWeighted(candidates(context.place, habitat, slot), context, random);
  const sizeRatio = random() ** (CONFIG.fishSelection.sizeSkew * context.bait.sizeFactor);
  const { min, max } = CONFIG.fishSelection.sizeStrength;
  return {
    species,
    sizeCm: Math.round(species.sizeCm.min + (species.sizeCm.max - species.sizeCm.min) * sizeRatio),
    strength: species.difficulty.strength * (min + (max - min) * sizeRatio),
    variant: random() < CONFIG.progression.variantChance * context.bait.variantFactor * (context.boosts ?? NO_BOOSTS).variantFactor,
    habitat,
    slot,
  };
}

/** Poids de tirage d'une espèce : rareté × préférence pour l'appât × temps qu'il fait × coin à signes × coups de pouce. */
export function weightOf(species: FishSpecies, context: SelectionContext): number {
  const { rarityWeight, likedBaitBonus, otherBaitFactor } = CONFIG.fishSelection;
  const boosts = context.boosts ?? NO_BOOSTS;
  const baitFactor = species.baits.includes(context.bait.id) ? likedBaitBonus : otherBaitFactor;
  const favorite = species.id === boosts.favoriteId ? boosts.favoriteFactor : 1;
  const legendary = species.rarity === 'legendary' ? boosts.legendaryFactor : 1;
  const weather = context.weather && context.weather === species.weather ? CONFIG.weather.likedFactor : 1;
  const hotspot = context.hotspot && species.rarity !== 'common' ? CONFIG.signs.rarityBoost : 1;
  const discovery = species.rarity !== 'legendary' && boosts.isUnknown(species.id) ? boosts.discoveryFactor : 1;
  return rarityWeight[species.rarity] * baitFactor * favorite * legendary * weather * hotspot * discovery;
}

/**
 * Espèces possibles ici et maintenant. Si les données ont un trou, on
 * élargit (toute heure, puis tout le lieu) pour que ça morde quand même.
 */
function candidates(place: PlaceId, habitat: Habitat, slot: TimeSlot): readonly FishSpecies[] {
  const inPlace = fishOf(place);
  const here = inPlace.filter((species) => species.habitats.includes(habitat));
  const now = here.filter((species) => species.times.includes(slot));
  if (now.length > 0) return now;
  if (here.length > 0) return here;
  return inPlace.length > 0 ? inPlace : FISH;
}

function pickWeighted(list: readonly FishSpecies[], context: SelectionContext, random: Random): FishSpecies {
  const weights = list.map((species) => weightOf(species, context));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

/**
 * Vérifie les données des poissons au démarrage : identifiants uniques,
 * tailles cohérentes, et, pour chaque lieu, au moins une espèce par zone ×
 * créneau.
 */
export function checkFishData(): void {
  const ids = new Set<string>();
  for (const species of FISH) {
    if (ids.has(species.id)) warn('poissons', `identifiant en double : « ${species.id} ».`);
    ids.add(species.id);
    if (species.sizeCm.min > species.sizeCm.max) warn('poissons', `« ${species.id} » : taille min > taille max.`);
  }
  const habitats: readonly Habitat[] = ['open', ...ZONE_TYPES];
  const slots = Object.keys(CONFIG.time.slots) as TimeSlot[];
  for (const place of PLACES) {
    const inPlace = fishOf(place.id);
    for (const habitat of habitats) {
      for (const slot of slots) {
        const here = inPlace.filter((species) => species.habitats.includes(habitat) && species.times.includes(slot));
        if (here.length === 0) warn('poissons', `${place.name} : aucune espèce en « ${habitat} » au créneau « ${slot} » (une espèce d’un autre créneau sera choisie).`);
        else checkLegendaryShare(here, `${place.name}, « ${habitat} », « ${slot} »`);
      }
    }
  }
}

/** Un légendaire doit rester rare partout : pas plus de 10 % des touches à un endroit et une heure donnés. */
function checkLegendaryShare(species: readonly FishSpecies[], where: string): void {
  const weight = (candidate: FishSpecies): number => CONFIG.fishSelection.rarityWeight[candidate.rarity];
  const total = species.reduce((sum, candidate) => sum + weight(candidate), 0);
  const legendary = species.filter((candidate) => candidate.rarity === 'legendary').reduce((sum, candidate) => sum + weight(candidate), 0);
  if (legendary / total > 0.1) warn('poissons', `${where} : le légendaire y ferait ${Math.round((legendary / total) * 100)} % des touches (ajoute une espèce commune).`);
}
