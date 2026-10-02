import type { FishSpecies } from '../data/fish';
import { masteryStars, MAX_STARS, nextStarAt } from '../progression/mastery';
import { TEXTS } from './texts';

/** Où vit une espèce, en toutes lettres (« Roseaux, Eau peu profonde »). */
export function habitatText(species: FishSpecies): string {
  return species.habitats.map((habitat) => TEXTS.zones[habitat]).join(', ');
}

/** Quand elle mord, avec les icônes des créneaux (« 🌅 Aube, 🌙 Nuit »). */
export function timeText(species: FishSpecies): string {
  return species.times.map((slot) => `${TEXTS.slots[slot].icon} ${TEXTS.slots[slot].name}`).join(', ');
}

/** Étoiles pleines puis vides : « ★★☆ ». */
export function starsText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars);
}

/** Maîtrise d'une espèce après `count` prises : « ★☆☆ 7 / 20 prises », ou « ★★★ Espèce maîtrisée ». */
export function masteryText(species: FishSpecies, count: number): string {
  const stars = starsText(masteryStars(species, count));
  const next = nextStarAt(species, count);
  return next === null ? TEXTS.mastery.done(stars) : TEXTS.mastery.progress(stars, count, next);
}

/** Indice pour une espèce pas encore attrapée. */
export function hintText(species: FishSpecies): string {
  return `${TEXTS.journal.hint}${TEXTS.colon}${habitatText(species)} · ${timeText(species)}`;
}
