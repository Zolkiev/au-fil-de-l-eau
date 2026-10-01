import { Float32BufferAttribute, type BufferGeometry, type Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * Petits modèles low poly fabriqués en code (bêtes, objets flottants) : des
 * primitives colorées par sommet, réunies en une seule géométrie pour ne
 * coûter qu'un appel de dessin.
 */

/** Donne une couleur de sommets unie à une pièce. */
export function tinted<T extends BufferGeometry>(geometry: T, color: Color): T {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Réunit des pièces (déjà colorées) en une seule géométrie à facettes. */
export function merged(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts.map((part) => part.toNonIndexed()));
}
