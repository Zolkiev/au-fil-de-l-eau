/*
 * Langue du jeu : français ou anglais.
 *
 * Elle est lue une seule fois, au chargement de la page, avant tout le
 * reste : les textes (src/ui/texts.ts) et les données (poissons, appâts,
 * boutique…) se construisent directement dans la bonne langue. Changer de
 * langue (écran titre) l'enregistre puis recharge la page.
 *
 * Elle a sa propre clé dans le navigateur, à part de la sauvegarde : effacer
 * la partie ne change pas la langue.
 */

export type Language = 'fr' | 'en';

export const LANGUAGES: readonly Language[] = ['fr', 'en'];

/** Nom de chaque langue, dans cette langue (pour le sélecteur). */
export const LANGUAGE_NAMES: Record<Language, string> = { fr: 'Français', en: 'English' };

const STORAGE_KEY = 'petite-peche/language';

/** Langue de cette session. */
export const LANGUAGE: Language = readLanguage();

document.documentElement.lang = LANGUAGE;

/** Le texte dans la langue du jeu : `pick('Roseaux', 'Reeds')`. */
export function pick<T>(fr: T, en: T): T {
  return LANGUAGE === 'en' ? en : fr;
}

/** Enregistre la langue choisie ; elle s'applique au prochain chargement de la page. */
export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Stockage inaccessible (navigation privée…) : la langue du navigateur reste utilisée
  }
}

/** Langue choisie par le joueur, sinon celle du navigateur (français s'il est en français, anglais pour tous les autres). */
function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    // Stockage inaccessible : on se rabat sur la langue du navigateur
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
