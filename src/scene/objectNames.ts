import type { Object3D } from 'three';

/**
 * Nom d'origine dans Blender, sans le suffixe de doublon.
 * (« rock_col.001 » → « rock_col ». GLTFLoader garde le nom brut dans userData.name.)
 */
export function blenderName(object: Object3D): string {
  const original: unknown = object.userData.name;
  const name = typeof original === 'string' ? original : object.name;
  return name.replace(/\.\d+$/, '');
}

/** Premier objet de la hiérarchie portant ce nom Blender, ou null. */
export function findByBlenderName(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((object) => {
    if (!found && blenderName(object) === name) found = object;
  });
  return found;
}
