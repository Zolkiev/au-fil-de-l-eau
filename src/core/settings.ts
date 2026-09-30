import { CONFIG } from '../config';
import { REBINDABLE_ACTIONS, type KeyBindings } from './controls';
import { isQualitySetting, type QualitySetting } from './quality';
import { readBoolean, readNumber, readObject } from './validate';

/** Taille des textes de l'interface. */
export type TextSize = 'normal' | 'large' | 'huge';
export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'huge'];

/** Réglages du joueur (menu Réglages), sauvegardés avec la partie. */
export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  musicVolume: number;
  /** Qualité graphique (automatique ou niveau fixe). */
  quality: QualitySetting;
  /** Affiche le nombre d'images par seconde. */
  showFps: boolean;
  showBiteAlert: boolean;
  showHints: boolean;
  dayLengthMinutes: number;
  // --- Confort et accessibilité ---
  textSize: TextSize;
  /** Moins de mouvements : tangage, vagues, balancement, animations de l'interface. */
  reduceMotion: boolean;
  /** Plus de temps pour ferrer. */
  easyHook: boolean;
  /** Bouchon plus gros, plus facile à suivre. */
  bigBobber: boolean;
  /** Sensibilité du joystick tactile (× la course). */
  stickSensitivity: number;
  /** Touches choisies par le joueur. */
  keyBindings: KeyBindings;
}

/** Durées de journée proposées dans le menu (minutes réelles). */
export const DAY_LENGTHS: readonly number[] = [6, 12, 24];

export function defaultSettings(): Settings {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { ...CONFIG.settingsDefaults, reduceMotion, keyBindings: {} };
}

/** Relit des réglages sauvegardés ; chaque valeur invalide reprend sa valeur par défaut. */
export function parseSettings(value: unknown): Settings {
  const raw = readObject(value);
  const defaults = defaultSettings();
  const dayLength = readNumber(raw.dayLengthMinutes, defaults.dayLengthMinutes);
  return {
    masterVolume: readNumber(raw.masterVolume, defaults.masterVolume, 0, 1),
    sfxVolume: readNumber(raw.sfxVolume, defaults.sfxVolume, 0, 1),
    ambienceVolume: readNumber(raw.ambienceVolume, defaults.ambienceVolume, 0, 1),
    musicVolume: readNumber(raw.musicVolume, defaults.musicVolume, 0, 1),
    quality: parseQuality(raw, defaults.quality),
    showFps: readBoolean(raw.showFps, defaults.showFps),
    showBiteAlert: readBoolean(raw.showBiteAlert, defaults.showBiteAlert),
    showHints: readBoolean(raw.showHints, defaults.showHints),
    dayLengthMinutes: DAY_LENGTHS.includes(dayLength) ? dayLength : defaults.dayLengthMinutes,
    textSize: TEXT_SIZES.includes(raw.textSize as TextSize) ? (raw.textSize as TextSize) : defaults.textSize,
    reduceMotion: readBoolean(raw.reduceMotion, defaults.reduceMotion),
    easyHook: readBoolean(raw.easyHook, defaults.easyHook),
    bigBobber: readBoolean(raw.bigBobber, defaults.bigBobber),
    stickSensitivity: readNumber(raw.stickSensitivity, defaults.stickSensitivity, 0.5, 1.5),
    keyBindings: parseBindings(raw.keyBindings),
  };
}

/**
 * Qualité graphique. Anciennes sauvegardes (avant ce réglage) : la définition
 * « économe » ou les ombres coupées deviennent la qualité basse.
 */
function parseQuality(raw: Record<string, unknown>, fallback: QualitySetting): QualitySetting {
  if (isQualitySetting(raw.quality)) return raw.quality;
  if (raw.resolution === 'eco' || raw.shadows === false) return 'low';
  return fallback;
}

/** Touches choisies : une chaîne courte par action connue. */
function parseBindings(value: unknown): KeyBindings {
  const raw = readObject(value);
  const bindings: KeyBindings = {};
  for (const action of REBINDABLE_ACTIONS) {
    const key = raw[action];
    if (typeof key === 'string' && key.length > 0 && key.length <= 20) bindings[action] = key;
  }
  return bindings;
}
