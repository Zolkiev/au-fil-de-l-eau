import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from 'three';

/**
 * Petit studio hors écran : une lumière douce, une caméra, et de quoi rendre
 * un objet seul sur fond transparent puis le convertir en image (vignettes
 * du carnet et de la boutique). À l'appelant de cadrer l'objet avec
 * `camera` avant `capture`.
 */
export class ThumbnailStudio {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly target: WebGLRenderTarget;
  private readonly width: number;
  private readonly height: number;

  constructor(renderer: WebGLRenderer, width: number, height: number, fov = 30) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.camera = new PerspectiveCamera(fov, width / height, 0.01, 100);
    this.target = new WebGLRenderTarget(width, height, { samples: 4 });
    this.target.texture.colorSpace = SRGBColorSpace;
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 2);
    this.scene.add(new HemisphereLight(0xe8f2ff, 0x8c9a6c, 1.4), key);
  }

  /** Image (data URL) de l'objet vu par `camera` ; `override` remplace tous ses matériaux (silhouette). */
  capture(object: Object3D, override: Material | null = null): string {
    this.scene.add(object);
    this.scene.overrideMaterial = override;
    const pixels = this.draw();
    this.scene.remove(object);
    return this.toDataUrl(pixels);
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
    const pixels = new Uint8Array(this.width * this.height * 4);
    renderer.readRenderTargetPixels(this.target, 0, 0, this.width, this.height, pixels);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    return pixels;
  }

  /** Pixels WebGL (lus de bas en haut) → image PNG. */
  private toDataUrl(pixels: Uint8Array): string {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) return '';
    const image = context.createImageData(this.width, this.height);
    const rowSize = this.width * 4;
    for (let y = 0; y < this.height; y++) {
      image.data.set(pixels.subarray(y * rowSize, (y + 1) * rowSize), (this.height - 1 - y) * rowSize);
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
