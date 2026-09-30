import type { TransitionTable } from '../core/stateMachine';

/** États de la pêche (voir CLAUDE.md). */
export type FishingState = 'IDLE' | 'CHARGING' | 'CASTING' | 'WAITING' | 'BITE' | 'REELING' | 'CAUGHT' | 'ESCAPED';

/**
 * IDLE → CHARGING → CASTING → WAITING → BITE → REELING → CAUGHT | ESCAPED → IDLE
 * Retours possibles : CHARGING → IDLE (annulé ou pas d'eau), WAITING → ESCAPED
 * (ligne ramenée trop tôt), BITE → ESCAPED (ferrage raté), REELING → ESCAPED
 * (ligne cassée). CAUGHT dure le temps de la présentation de la prise.
 */
export const FISHING_TRANSITIONS: TransitionTable<FishingState> = {
  IDLE: ['CHARGING'],
  CHARGING: ['CASTING', 'IDLE'],
  CASTING: ['WAITING'],
  WAITING: ['BITE', 'ESCAPED'],
  BITE: ['REELING', 'ESCAPED'],
  REELING: ['CAUGHT', 'ESCAPED'],
  CAUGHT: ['IDLE'],
  ESCAPED: ['IDLE'],
};

/** Pourquoi la ligne revient sans poisson. */
export type EscapeReason = 'cancel' | 'early' | 'missed' | 'snapped';
