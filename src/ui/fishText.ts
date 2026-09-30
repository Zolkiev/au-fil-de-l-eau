import type { FishSpecies } from '../data/fish';
import { TEXTS } from './texts';

/** Où vit une espèce, en toutes lettres (« Roseaux, Eau peu profonde »). */
export function habitatText(species: FishSpecies): string {
  return species.habitats.map((habitat) => TEXTS.zones[habitat]).join(', ');
}

/** Quand elle mord, avec les icônes des créneaux (« 🌅 Aube, 🌙 Nuit »). */
export function timeText(species: FishSpecies): string {
  return species.times.map((slot) => `${TEXTS.slots[slot].icon} ${TEXTS.slots[slot].name}`).join(', ');
}

/** Indice pour une espèce pas encore attrapée. */
export function hintText(species: FishSpecies): string {
  return `${TEXTS.journal.hint} : ${habitatText(species)} · ${timeText(species)}`;
}
