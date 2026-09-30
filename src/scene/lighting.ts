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
  /** Demi-côté (m) de la zone d'ombre actuelle. */
  private area: number = CONFIG.render.shadowArea;

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

  /**
   * Ombres selon la qualité graphique : 'full' = grande zone (tout le décor
   * proche), 'boat' = petite zone autour de la barque (seule elle fait une
   * ombre) ; `mapSize` = finesse de la carte (px). La carte est recréée au
   * prochain rendu si sa taille change.
   */
  setShadowQuality(mode: 'boat' | 'full', mapSize: number): void {
    const shadow = this.sun.shadow;
    this.area = mode === 'full' ? CONFIG.render.shadowArea : CONFIG.render.boatShadowArea;
    setFrustum(this.sun, this.area);
    shadow.normalBias = normalBiasFor(this.area, mapSize);
    if (shadow.mapSize.x === mapSize) return;
    shadow.mapSize.set(mapSize, mapSize);
    shadow.map?.dispose();
    shadow.map = null;
  }

  /**
   * Recentre la lumière (et donc la zone d'ombre) sur `focus`. Le centre
   * avance par pas d'un texel de la carte d'ombre : sinon les bords des
   * ombres scintillent dès que la barque bouge.
   */
  follow(focus: Vector3): void {
    snapToShadowTexels(focus, this.direction, texelSize(this.area, this.sun.shadow.mapSize.x), _snapped);
    this.sun.target.position.copy(_snapped);
    this.sun.position.copy(_snapped).addScaledVector(this.direction, SUN_DISTANCE);
  }
}

/** Taille (m) d'un texel de la carte d'ombre. */
function texelSize(area: number, mapSize: number): number {
  return (2 * area) / mapSize;
}

/** Décalage anti-acné (m) : un nombre fixe de texels, donc plus grand pour une carte moins fine. */
function normalBiasFor(area: number, mapSize: number): number {
  return CONFIG.render.shadowNormalBias * texelSize(area, mapSize);
}

/** Cadre de la caméra d'ombre : un carré de demi-côté `area` autour du centre de la zone. */
function setFrustum(sun: DirectionalLight, area: number): void {
  const camera = sun.shadow.camera;
  camera.left = -area;
  camera.right = area;
  camera.top = area;
  camera.bottom = -area;
  camera.updateProjectionMatrix();
}

/** `focus` arrondi à la grille des texels, dans le plan vu depuis la lumière. */
function snapToShadowTexels(focus: Vector3, direction: Vector3, texel: number, out: Vector3): Vector3 {
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
  const { shadowMapSize, shadowArea, shadowRadius, shadowBias } = CONFIG.render;
  const camera = sun.shadow.camera;
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.radius = shadowRadius;
  sun.shadow.bias = shadowBias;
  sun.shadow.normalBias = normalBiasFor(shadowArea, shadowMapSize);
  camera.near = 1;
  camera.far = SUN_DISTANCE * 2;
  setFrustum(sun, shadowArea);
}
