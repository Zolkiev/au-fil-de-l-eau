import { Box3, MathUtils, Sphere, Vector3, type Object3D, type WebGLRenderer } from 'three';
import type { ShopItem, SkinSlot } from '../data/shop';
import { blenderName, findByBlenderName } from '../scene/objectNames';
import { skinObjectName } from '../scene/skins';
import { ThumbnailStudio } from './thumbnailStudio';

const WIDTH = 240;
const HEIGHT = 180;

/** D'où l'on regarde chaque sorte de forme (direction de la caméra, +Z = avant de la barque). */
const VIEW_FROM: Record<SkinSlot, Vector3> = {
  hull: new Vector3(0.85, 0.6, 1),
  oars: new Vector3(0.15, 0.3, 1),
  hatShape: new Vector3(0.65, 0.3, 1),
};
/** Rames : on ne cadre que le bout qui change, la pelle (m le long de la rame, depuis le tolet). */
const BLADE_FROM = 0.75;

/** Part de la demi-image que l'objet doit occuper. */
const FILL = 0.92;

const _box = new Box3();
const _sphere = new Sphere();
const _direction = new Vector3();
const _corner = new Vector3();

/**
 * Vignettes de la boutique pour les formes au choix (coque, rames,
 * chapeau) : le vrai modèle, avec ses couleurs du moment, rendu seul hors
 * écran. Recalculées quand la décoration change (`clear`).
 */
export class LookThumbnails {
  private readonly studio: ThumbnailStudio;
  private readonly boatModel: Object3D;
  private readonly fisherModel: Object3D;
  private readonly cache = new Map<string, string | null>();

  constructor(renderer: WebGLRenderer, boatModel: Object3D, fisherModel: Object3D) {
    this.studio = new ThumbnailStudio(renderer, WIDTH, HEIGHT);
    this.boatModel = boatModel;
    this.fisherModel = fisherModel;
  }

  /** Image (data URL) de l'objet ; null si ce n'est pas une forme, ou si le modèle ne l'a pas. */
  get(item: ShopItem): string | null {
    if (item.effect.kind !== 'skin') return null;
    if (!this.cache.has(item.id)) this.cache.set(item.id, this.render(item.effect.slot, item.effect.shape));
    return this.cache.get(item.id) ?? null;
  }

  /** Les couleurs ont changé : les vignettes sont à refaire. */
  clear(): void {
    this.cache.clear();
  }

  private render(slot: SkinSlot, shape: string): string | null {
    const subject = slot === 'hatShape' ? this.headWith(shape) : this.piece(slot, shape);
    if (!subject) return null;
    subject.position.set(0, 0, 0);
    subject.rotation.set(0, 0, 0);
    subject.traverse((object) => (object.visible = true));
    this.frame(subject, slot);
    return this.studio.capture(subject);
  }

  /** Copie de la coque ou d'une rame de cette forme, sans son masque « au sec ». */
  private piece(slot: SkinSlot, shape: string): Object3D | null {
    const copy = findByBlenderName(this.boatModel, skinObjectName(slot, shape))?.clone();
    copy?.children.filter((child) => blenderName(child) === 'water_mask').forEach((mask) => copy.remove(mask));
    return copy ?? null;
  }

  /** Copie de la tête du pêcheur, coiffée de ce chapeau seulement. */
  private headWith(shape: string): Object3D | null {
    const wanted = skinObjectName('hatShape', shape);
    const head = findByBlenderName(this.fisherModel, 'fisher_head')?.clone();
    if (!head || !findByBlenderName(head, wanted)) return null;
    head.children.filter((child) => blenderName(child).startsWith('skin_') && blenderName(child) !== wanted).forEach((other) => head.remove(other));
    return head;
  }

  /** Place la caméra pour que l'objet remplisse l'image : on part large, puis on s'approche d'après ce qu'il occupe à l'écran. */
  private frame(subject: Object3D, slot: SkinSlot): void {
    const { camera } = this.studio;
    _box.setFromObject(subject);
    if (slot === 'oars') _box.min.x = Math.max(_box.min.x, BLADE_FROM);
    _box.getBoundingSphere(_sphere);
    const direction = _direction.copy(VIEW_FROM[slot]).normalize();
    let distance = _sphere.radius / Math.sin(MathUtils.degToRad(camera.fov / 2));
    for (let pass = 0; pass < 3; pass++) {
      camera.position.copy(direction).multiplyScalar(distance).add(_sphere.center);
      camera.lookAt(_sphere.center);
      camera.updateMatrixWorld();
      distance *= this.screenExtent() / FILL;
    }
    camera.position.copy(direction).multiplyScalar(distance).add(_sphere.center);
  }

  /** Part de la demi-image qu'occupe la boîte de l'objet (1 = elle touche un bord). */
  private screenExtent(): number {
    let extent = 0;
    for (let index = 0; index < 8; index++) {
      _corner.set(index & 1 ? _box.max.x : _box.min.x, index & 2 ? _box.max.y : _box.min.y, index & 4 ? _box.max.z : _box.min.z);
      _corner.project(this.studio.camera);
      extent = Math.max(extent, Math.abs(_corner.x), Math.abs(_corner.y));
    }
    return extent;
  }
}
