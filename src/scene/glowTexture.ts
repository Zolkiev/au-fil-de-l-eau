import { CanvasTexture, SRGBColorSpace } from 'three';

let texture: CanvasTexture | null = null;

/** Halo rond (dégradé radial blanc → transparent), partagé par les lueurs du jeu. */
export function glowTexture(): CanvasTexture {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
