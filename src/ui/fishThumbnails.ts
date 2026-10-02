import { Box3, MathUtils, MeshBasicMaterial, Vector3, type Object3D, type WebGLRenderer } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { FishSpecies } from '../data/fish';
import { loadFishModel } from '../fishing/fishModel';
import { ThumbnailStudio } from './thumbnailStudio';

const WIDTH = 320;
const HEIGHT = 180;

/**
 * Vignettes du carnet : le modèle 3D de chaque espèce, rendu de profil hors
 * écran (couleurs, ou silhouette tant qu'elle n'a pas été attrapée), puis
 * converti en image. Chaque vignette n'est calculée qu'une fois.
 */
export class FishThumbnails {
  private readonly studio: ThumbnailStudio;
  private readonly silhouette = new MeshBasicMaterial({ color: 0x55636b });
  private readonly cache = new Map<string, Promise<string>>();

  constructor(renderer: WebGLRenderer) {
    this.studio = new ThumbnailStudio(renderer, WIDTH, HEIGHT);
  }

  /** Image (data URL) de l'espèce, en couleurs (éventuellement sa variante rare) ou en silhouette. */
  get(species: FishSpecies, silhouette: boolean, variant = false): Promise<string> {
    const key = `${species.id}:${silhouette ? 'silhouette' : variant ? 'variante' : 'couleurs'}`;
    let image = this.cache.get(key);
    if (!image) {
      image = loadFishModel(species, variant && !silhouette).then((model) => this.render(model.root, silhouette));
      this.cache.set(key, image);
    }
    return image;
  }

  private render(root: Object3D, silhouette: boolean): string {
    const fish = clone(root);
    this.frame(fish);
    return this.studio.capture(fish, silhouette ? this.silhouette : null);
  }

  /** Cadre le poisson de profil, tête à gauche, avec une petite marge. */
  private frame(fish: Object3D): void {
    const { camera } = this.studio;
    const box = new Box3().setFromObject(fish);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const halfFovY = MathUtils.degToRad(camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
    const fitLength = size.z / 2 / Math.tan(halfFovX);
    const fitHeight = size.y / 2 / Math.tan(halfFovY);
    camera.position.set(center.x + Math.max(fitLength, fitHeight) * 1.2 + size.x / 2, center.y, center.z);
    camera.lookAt(center);
  }
}
