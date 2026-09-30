import type { Journal } from '../core/journal';
import { fishById, type FishSpecies, type Habitat } from '../data/fish';
import { placeById, type PlaceId } from '../data/places';
import type { FishRequest, RequestGoal } from '../progression/requests';
import { hintText } from './fishText';
import { TEXTS } from './texts';

const HABITAT_ICONS: Record<Habitat, string> = { open: '🌊', shallow: '🏝️', deep: '⚓', reeds: '🌾', rocks: '🪨' };

/**
 * Texte d'une demande de Moustache. Une espèce pas encore attrapée reste
 * mystérieuse (avec un indice) ; une espèce d'un autre lieu que `here` est
 * signalée (« (la rivière) »).
 */
export function describeRequest(request: FishRequest, journal: Journal, here: PlaceId): string {
  const { goal, count } = request;
  const texts = TEXTS.cabin.requests;
  switch (goal.type) {
    case 'any':
      return texts.any(count);
    case 'slot':
      return texts.slot(count, TEXTS.cabin.when[goal.slot]);
    case 'habitat':
      return texts.habitat(count, TEXTS.cabin.where[goal.habitat]);
    case 'rarity':
      return texts.rarity;
    case 'species': {
      const species = fishById(goal.speciesId);
      if (!species) return '';
      const text = journal.entry(species.id) ? texts.species(species.name) : texts.unknownSpecies(hintText(species));
      return withPlace(text, species, here);
    }
    case 'size': {
      const species = fishById(goal.speciesId);
      return species ? withPlace(texts.size(species.name, goal.minCm), species, here) : '';
    }
  }
}

function withPlace(text: string, species: FishSpecies, here: PlaceId): string {
  return species.place === here ? text : `${text} ${TEXTS.places.elsewhere(placeById(species.place).at)}`;
}

/** Petite icône pour chaque sorte de demande. */
export function requestIcon(goal: RequestGoal): string {
  switch (goal.type) {
    case 'any':
      return '🎣';
    case 'slot':
      return TEXTS.slots[goal.slot].icon;
    case 'habitat':
      return HABITAT_ICONS[goal.habitat];
    case 'rarity':
      return '💎';
    case 'species':
      return '🐟';
    case 'size':
      return '📏';
  }
}
