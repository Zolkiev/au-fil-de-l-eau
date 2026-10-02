import type { Object3D } from 'three';
import { info } from '../core/log';
import type { SkinSlot } from '../data/shop';
import { blenderName } from './objectNames';

/** Nom des emplacements dans les modèles : les objets s'appellent `skin_<nom>_<forme>`. */
const MODEL_NAMES: Record<SkinSlot, string> = { hull: 'hull', oars: 'oars', hatShape: 'hat' };

/** Nom, dans le modèle, de l'objet qui porte cette forme (« skin_hull_canoe »). */
export function skinObjectName(slot: SkinSlot, shape: string): string {
  return `skin_${MODEL_NAMES[slot]}_${shape}`;
}

/**
 * Formes au choix d'un modèle (coque de la barque, rames, chapeau du
 * pêcheur) : les objets `skin_<emplacement>_<forme>` sont des variantes
 * d'une même pièce, et une seule est montrée par emplacement. Un modèle
 * sans variantes (placeholder, ancien asset) reste tel quel.
 */
export class Skins {
  private readonly shapes = new Map<SkinSlot, Map<string, Object3D[]>>();

  constructor(models: readonly Object3D[]) {
    for (const slot of Object.keys(MODEL_NAMES) as SkinSlot[]) this.shapes.set(slot, new Map());
    for (const model of models) model.traverse((object) => this.collect(object));
  }

  /** Montre la forme `shape` de cet emplacement ; si le modèle ne l'a pas, la première qu'il a. */
  show(slot: SkinSlot, shape: string): void {
    const shapes = this.shapes.get(slot);
    if (!shapes || shapes.size === 0) return;
    if (!shapes.has(shape)) info('formes', `« ${skinObjectName(slot, shape)} » absent du modèle → forme d’origine.`);
    const shown = shapes.has(shape) ? shape : [...shapes.keys()][0];
    shapes.forEach((objects, name) => objects.forEach((object) => (object.visible = name === shown)));
  }

  private collect(object: Object3D): void {
    const name = blenderName(object);
    for (const slot of Object.keys(MODEL_NAMES) as SkinSlot[]) {
      const prefix = skinObjectName(slot, '');
      if (!name.startsWith(prefix)) continue;
      const shapes = this.shapes.get(slot);
      const shape = name.slice(prefix.length);
      shapes?.set(shape, [...(shapes.get(shape) ?? []), object]);
    }
  }
}
