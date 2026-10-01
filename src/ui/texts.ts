import { pick } from '../core/language';
import { EN } from './texts.en';
import { FR, type Texts } from './texts.fr';

/**
 * Tous les textes affichés au joueur, dans la langue du jeu (voir
 * src/core/language.ts). Le français est dans texts.fr.ts, l'anglais dans
 * texts.en.ts ; les noms et descriptions des données (poissons, appâts,
 * boutique, lieux…) sont traduits sur place, dans src/data/, avec `pick()`.
 */
export const TEXTS: Texts = pick(FR, EN);

/** Taille lisible : « 42 cm ». */
export function formatSize(sizeCm: number): string {
  return `${Math.round(sizeCm)} cm`;
}

/** Durée lisible : « 12 min », « 1 h 05 ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Date lisible : « 29 septembre » (« 29 September » en anglais). */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(TEXTS.dateLocale, { day: 'numeric', month: 'long' });
}
