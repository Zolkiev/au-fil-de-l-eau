import {
  AlwaysStencilFunc,
  KeepStencilOp,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  type Material,
  type Object3D,
} from 'three';
import { info } from '../core/log';
import { blenderName } from './objectNames';

/*
 * Masque « au sec » : empêche l'eau de se dessiner à l'intérieur de la coque.
 *
 * Le fond de la barque est sous la ligne de flottaison : sans masque, le plan
 * d'eau le traverserait. Le mesh `water_mask` (un plan posé au niveau des
 * plats-bords, qui couvre l'intérieur de la coque) est dessiné en premier,
 * invisible, et marque ses pixels dans le stencil ; l'eau ne se dessine pas
 * sur ces pixels. Chaque coque au choix (`skin_hull_*`) a le sien, enfant de
 * la coque : celui d'une coque cachée n'est pas dessiné.
 */

/** Valeur du stencil pour les pixels où l'eau est interdite. */
const DRY = 1;
/** Le masque passe avant tout le reste (le ciel, à -1, n'écrit pas la profondeur). */
const MASK_RENDER_ORDER = -0.5;

/** Transforme les objets `water_mask` du modèle de barque en masques ; false s'il n'y en a aucun. */
export function applyWaterMask(boatModel: Object3D): boolean {
  const masks: Object3D[] = [];
  boatModel.traverse((object) => {
    if (blenderName(object) === 'water_mask') masks.push(object);
  });
  if (masks.length === 0) {
    info('barque', 'pas de « water_mask » dans boat.glb : l’eau peut apparaître dans la coque si le fond est sous la ligne de flottaison.');
    return false;
  }
  const material = createMaskMaterial();
  for (const mask of masks) {
    mask.visible = true;
    mask.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = material;
      child.renderOrder = MASK_RENDER_ORDER;
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }
  return true;
}

/** À appliquer aux matériaux « d'eau » (plan d'eau, ronds…) : ils évitent les pixels masqués. */
export function avoidDryPixels(material: Material): void {
  material.stencilWrite = true; // active le test du stencil
  material.stencilRef = DRY;
  material.stencilFunc = NotEqualStencilFunc;
  material.stencilWriteMask = 0; // teste sans jamais écrire
  material.stencilZPass = KeepStencilOp;
}

/** Invisible (ni couleur ni profondeur), il écrit seulement DRY dans le stencil. */
function createMaskMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: DRY,
    stencilFunc: AlwaysStencilFunc,
    stencilZPass: ReplaceStencilOp,
  });
}
