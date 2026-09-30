import { DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three';
import { CONFIG } from '../config';
import type { Ambience } from './dayNight';

/** Distance de la lumière à la barque (elle est directionnelle, seule la direction compte). */
const SUN_DISTANCE = 40;

/**
 * Lumière douce du ciel + lumière principale (soleil le jour, lune la nuit),
 * pilotées par le cycle jour/nuit. Seule la barque projette une ombre : la
 * zone d'ombre, petite et nette, la suit.
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

  /** Recentre la lumière (et donc la zone d'ombre) sur `focus`. */
  follow(focus: Vector3): void {
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.direction, SUN_DISTANCE);
  }
}

function configureShadow(sun: DirectionalLight): void {
  const { shadowMapSize, shadowArea, shadowRadius, shadowBias } = CONFIG.render;
  const camera = sun.shadow.camera;
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.radius = shadowRadius;
  sun.shadow.bias = shadowBias;
  camera.left = -shadowArea;
  camera.right = shadowArea;
  camera.top = shadowArea;
  camera.bottom = -shadowArea;
  camera.near = 1;
  camera.far = SUN_DISTANCE * 2;
  camera.updateProjectionMatrix();
}
