/** Petits utilitaires mathématiques absents de THREE.MathUtils. */

const TAU = Math.PI * 2;

/** Ramène un angle dans l'intervalle ]-π, π]. */
export function wrapAngle(angle: number): number {
  return angle - TAU * Math.floor((angle + Math.PI) / TAU);
}

/** Interpolation entre deux angles par le plus court chemin. */
export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t;
}

/** Cap (angle autour de la verticale) d'une direction horizontale : 0 = vers +Z. */
export function yawOf(x: number, z: number): number {
  return Math.atan2(x, z);
}

/** Interpolation linéaire dans une table [x, y] triée par x croissant. */
export function interpolateTable(table: readonly (readonly [number, number])[], x: number): number {
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
