import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { FishSpecies } from '../data/fish';
import { loadFishModel } from '../fishing/fishModel';

const WIDTH = 320;
const HEIGHT = 180;

/**
 * Vignettes du carnet : le modèle 3D de chaque espèce, rendu de profil hors
 * écran (couleurs, ou silhouette tant qu'elle n'a pas été attrapée), puis
 * converti en image. Chaque vignette n'est calculée qu'une fois.
 */
export class FishThumbnails {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, WIDTH / HEIGHT, 0.01, 100);
  private readonly target = new WebGLRenderTarget(WIDTH, HEIGHT, { samples: 4 });
  private readonly silhouette = new MeshBasicMaterial({ color: 0x55636b });
  private readonly cache = new Map<string, Promise<string>>();

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.target.texture.colorSpace = SRGBColorSpace;
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 2);
    this.scene.add(new HemisphereLight(0xe8f2ff, 0x8c9a6c, 1.4), key);
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
    this.scene.add(fish);
    this.scene.overrideMaterial = silhouette ? this.silhouette : null;
    const pixels = this.draw();
    this.scene.remove(fish);
    return toDataUrl(pixels);
  }

  /** Cadre le poisson de profil, tête à gauche, avec une petite marge. */
  private frame(fish: Object3D): void {
    const box = new Box3().setFromObject(fish);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const halfFovY = MathUtils.degToRad(this.camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * this.camera.aspect);
    const fitLength = size.z / 2 / Math.tan(halfFovX);
    const fitHeight = size.y / 2 / Math.tan(halfFovY);
    this.camera.position.set(center.x + Math.max(fitLength, fitHeight) * 1.2 + size.x / 2, center.y, center.z);
    this.camera.lookAt(center);
  }

  /** Rend la scène dans la cible hors écran et relit ses pixels, puis restaure le renderer. */
  private draw(): Uint8Array {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousColor = renderer.getClearColor(new Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
    renderer.readRenderTargetPixels(this.target, 0, 0, WIDTH, HEIGHT, pixels);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    return pixels;
  }
}

/** Pixels WebGL (lus de bas en haut) → image PNG. */
function toDataUrl(pixels: Uint8Array): string {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(WIDTH, HEIGHT);
  const rowSize = WIDTH * 4;
  for (let y = 0; y < HEIGHT; y++) {
    image.data.set(pixels.subarray(y * rowSize, (y + 1) * rowSize), (HEIGHT - 1 - y) * rowSize);
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
