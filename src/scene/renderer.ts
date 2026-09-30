import { ACESFilmicToneMapping, MathUtils, NeutralToneMapping, PCFShadowMap, WebGLRenderer, type PerspectiveCamera } from 'three';
import { CONFIG } from '../config';
import type { Resolution } from '../core/settings';

/** Renderer WebGL : tone mapping (CONFIG.render.toneMapping), ombres douces (PCF + flou), stencil pour le masque d'eau. */
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
  renderer.toneMapping = CONFIG.render.toneMapping === 'aces' ? ACESFilmicToneMapping : NeutralToneMapping;
  renderer.toneMappingExposure = CONFIG.render.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

/** Définition du rendu : pleine (écrans haute densité jusqu'à ×2) ou économe (×1, plus fluide). */
export function setResolution(renderer: WebGLRenderer, resolution: Resolution): void {
  const max = resolution === 'eco' ? 1 : CONFIG.render.maxPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, max));
}

/** Adapte le rendu et la caméra à la taille de la fenêtre, maintenant et à chaque redimensionnement. */
export function fitToWindow(renderer: WebGLRenderer, camera: PerspectiveCamera): void {
  const fit = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = verticalFov(camera.aspect);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', fit);
  fit();
}

/**
 * Champ vertical de config.ts, élargi sur écran étroit (téléphone en
 * portrait) pour garder au moins `minHorizontalFov` de large.
 */
function verticalFov(aspect: number): number {
  const { fov, minHorizontalFov } = CONFIG.camera;
  const halfWidth = Math.tan(MathUtils.degToRad(minHorizontalFov) / 2);
  return Math.max(fov, MathUtils.radToDeg(2 * Math.atan(halfWidth / aspect)));
}
