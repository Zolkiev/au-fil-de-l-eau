/** Aides pour relire des données sauvegardées sans leur faire confiance. */

/** Un nombre fini, borné, sinon la valeur par défaut. */
export function readNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** Un booléen, sinon la valeur par défaut. */
export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Un objet (hors tableau), sinon un objet vide. */
export function readObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
