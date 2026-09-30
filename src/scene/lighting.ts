import { DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three';
import { CONFIG } from '../config';
import type { Ambience } from './dayNight';

/** Distance de la lumière au centre de la zone d'ombre (elle est directionnelle, seule la direction compte). */
const SUN_DISTANCE = 80;

const _right = new Vector3();
const _up = new Vector3();
const _snapped = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

/**
 * Lumière douce du ciel + lumière principale (soleil le jour, lune la nuit),
 * pilotées par le cycle jour/nuit. La zone d'ombre (CONFIG.render.shadowArea)
 * suit la barque : la barque et le décor proche (arbres, rochers, ponton…) y
 * projettent leur ombre.
 */
export class Lighting {
  readonly sun = new DirectionalLight();
  readonly hemisphere = new HemisphereLight();
  /** Direction vers la source de lumière (soleil ou lune). */
  private readonly direction = new Vector3(0, 1, 0);

  constructor(scene: Scene) {
    configureShadow(this.sun);
    scene.add(this.hemisphere, this.sun, this.sun.target);
  }

  setAmbience(ambience: Ambience): void {
    const { colors, values } = ambience;
    this.sun.color.copy(colors.sun);
    this.sun.intensity = values.sunIntensity;
    this.hemisphere.color.copy(colors.hemiSky);
    this.hemisphere.groundColor.copy(colors.hemiGround);
    this.hemisphere.intensity = values.hemiIntensity;
    this.direction.copy(ambience.lightDirection);
  }

  /** Taille de la carte d'ombre (px) ; la carte est recréée au prochain rendu. */
  setShadowMapSize(size: number): void {
    const shadow = this.sun.shadow;
    if (shadow.mapSize.x === size) return;
    shadow.mapSize.set(size, size);
    shadow.map?.dispose();
    shadow.map = null;
  }

  /**
   * Recentre la lumière (et donc la zone d'ombre) sur `focus`. Le centre
   * avance par pas d'un texel de la carte d'ombre : sinon les bords des
   * ombres scintillent dès que la barque bouge.
   */
  follow(focus: Vector3): void {
    snapToShadowTexels(focus, this.direction, this.sun.shadow.mapSize.x, _snapped);
    this.sun.target.position.copy(_snapped);
    this.sun.position.copy(_snapped).addScaledVector(this.direction, SUN_DISTANCE);
  }
}

/** `focus` arrondi à la grille des texels, dans le plan vu depuis la lumière. */
function snapToShadowTexels(focus: Vector3, direction: Vector3, mapSize: number, out: Vector3): Vector3 {
  const texel = (2 * CONFIG.render.shadowArea) / mapSize;
  _right.crossVectors(WORLD_UP, direction);
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
  _right.normalize();
  _up.crossVectors(direction, _right).normalize();
  const x = Math.round(focus.dot(_right) / texel) * texel;
  const y = Math.round(focus.dot(_up) / texel) * texel;
  const depth = focus.dot(direction);
  return out.copy(_right).multiplyScalar(x).addScaledVector(_up, y).addScaledVector(direction, depth);
}

function configureShadow(sun: DirectionalLight): void {
  const { shadowMapSize, shadowArea, shadowRadius, shadowBias, shadowNormalBias } = CONFIG.render;
  const camera = sun.shadow.camera;
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.radius = shadowRadius;
  sun.shadow.bias = shadowBias;
  sun.shadow.normalBias = shadowNormalBias;
  camera.left = -shadowArea;
  camera.right = shadowArea;
  camera.top = shadowArea;
  camera.bottom = -shadowArea;
  camera.near = 1;
  camera.far = SUN_DISTANCE * 2;
  camera.updateProjectionMatrix();
}
