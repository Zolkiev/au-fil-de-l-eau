/**
 * Journal du jeu : avertissements clairs dans la console (assets manquants,
 * conventions Blender non respectées…), mémorisés pour que le HUD puisse
 * les signaler discrètement.
 */

const warnings: string[] = [];

/** Signale un problème non bloquant : le jeu continue avec une valeur de secours. */
export function warn(scope: string, message: string, detail?: unknown): void {
  const line = `[${scope}] ${message}`;
  warnings.push(line);
  if (detail === undefined) console.warn(`⚠ ${line}`);
  else console.warn(`⚠ ${line}`, detail);
}

/** Information utile au réglage (pas un problème). */
export function info(scope: string, message: string): void {
  console.info(`[${scope}] ${message}`);
}

/** Tous les avertissements émis depuis le lancement. */
export function getWarnings(): readonly string[] {
  return warnings;
}
