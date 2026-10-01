import { CONFIG } from '../config';
import { pick } from './language';

/*
 * Touches du jeu : celles de CONFIG.controls, dont certaines peuvent être
 * remplacées par le joueur (Réglages › Clavier). Pour ramer, les flèches
 * restent toujours actives en plus de la touche choisie.
 */

/** Actions dont le joueur peut changer la touche. */
export type RebindableAction = 'forward' | 'left' | 'backward' | 'right' | 'sprint' | 'journal' | 'cabin' | 'keep';
export const REBINDABLE_ACTIONS: readonly RebindableAction[] = ['forward', 'left', 'backward', 'right', 'sprint', 'journal', 'cabin', 'keep'];

/** Touches choisies par le joueur (une par action) ; les autres gardent celles de config.ts. */
export type KeyBindings = Partial<Record<RebindableAction, string>>;

let custom: KeyBindings = {};

export function setCustomBindings(bindings: KeyBindings): void {
  custom = { ...bindings };
}

/** Touches actives pour une action. */
export function keysFor(action: RebindableAction): readonly string[] {
  const defaults: readonly string[] = CONFIG.controls[action];
  const chosen = custom[action];
  if (!chosen) return defaults;
  return [chosen, ...defaults.filter((key) => key.startsWith('Arrow'))];
}

/** Touche « principale » d'une action (la première), pour l'afficher. */
export function mainKey(action: RebindableAction): string {
  return keysFor(action)[0];
}

/** Touches réservées, qu'on ne peut pas choisir (menu, confirmer, appâts, aides). */
export function isReserved(key: string): boolean {
  const { cancel, confirm, baits, toggleLevelHelpers } = CONFIG.controls;
  const reserved: readonly string[] = [...cancel, ...confirm, ...baits.flat(), ...toggleLevelHelpers, ...CONFIG.debug.timeSkip];
  return reserved.includes(key);
}

/** Action qui utilise déjà cette touche (hors `except`), ou null. */
export function actionUsing(key: string, except: RebindableAction): RebindableAction | null {
  return REBINDABLE_ACTIONS.find((action) => action !== except && keysFor(action).includes(key)) ?? null;
}

/**
 * Identifiant d'une touche pressée, comme dans CONFIG.controls : la lettre
 * tapée pour un caractère, sinon le code physique (« ArrowUp »…).
 */
export function keyOf(event: KeyboardEvent): string {
  return event.key.length === 1 && event.key !== ' ' ? event.key.toLowerCase() : event.code;
}

const KEY_NAMES: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: pick('Espace', 'Space'),
  Enter: pick('Entrée', 'Enter'),
  Escape: pick('Échap', 'Esc'),
  Tab: 'Tab',
  ShiftLeft: pick('Maj', 'Shift'),
  ShiftRight: pick('Maj', 'Shift'),
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
};

/** Nom lisible d'une touche : « W », « ↑ », « Espace »… */
export function keyLabel(key: string): string {
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  if (key.length === 1) return key.toUpperCase();
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Digit')) return key.slice(5);
  if (key.startsWith('Numpad')) return `${pick('Pavé', 'Numpad')} ${key.slice(6)}`;
  return key;
}

/** Touches pour ramer, telles qu'on les annonce : « WASD / ZQSD » par défaut, sinon celles choisies. */
export function movementLabel(): string {
  const moves: readonly RebindableAction[] = ['forward', 'left', 'backward', 'right'];
  if (moves.every((action) => !custom[action])) return 'WASD / ZQSD';
  return moves.map((action) => keyLabel(mainKey(action))).join('');
}

/** Noms des touches actuelles, pour les textes (invites, aide, tutoriel). */
export interface KeyHints {
  readonly move: string;
  readonly sprint: string;
  readonly journal: string;
  readonly cabin: string;
  readonly keep: string;
}

export function keyHints(): KeyHints {
  return {
    move: movementLabel(),
    sprint: keyLabel(mainKey('sprint')),
    journal: keyLabel(mainKey('journal')),
    cabin: keyLabel(mainKey('cabin')),
    keep: keyLabel(mainKey('keep')),
  };
}
