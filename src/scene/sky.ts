import { BackSide, Color, Fog, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Scene } from 'three';
import { CONFIG } from '../config';
import type { Ambience } from './dayNight';

/** Rayon du dôme : doit rester sous CONFIG.camera.far. */
const SKY_RADIUS = 450;

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Dégradé horizon → zénith, soleil (disque + halo), lune (avec sa phase) et
// étoiles la nuit. Sous l'horizon : couleur de l'horizon, identique au brouillard.
const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunVisibility;
  uniform vec3 moonDirection;
  uniform float moonPhase;
  uniform float cloudiness;
  uniform float night;
  varying vec3 vDirection;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Étoiles : une grille sur la voûte, quelques cases seulement contiennent une étoile
  float stars(vec3 direction) {
    vec2 uv = vec2(atan(direction.z, direction.x), asin(clamp(direction.y, -1.0, 1.0))) * 45.0;
    vec2 cell = floor(uv);
    vec2 offset = vec2(hash(cell), hash(cell + 17.0)) - 0.5;
    float distanceToStar = length(fract(uv) - 0.5 - offset * 0.6);
    float present = step(0.95, hash(cell + 3.1));
    return present * smoothstep(0.12, 0.0, distanceToStar) * (0.5 + 0.5 * hash(cell + 9.7));
  }

  // Lune : un disque d'ombre glisse devant elle (croissant → pleine → décroissant).
  // La pleine lune a un halo.
  vec3 moonGlow(vec3 direction) {
    float moonDot = dot(direction, moonDirection);
    float disc = smoothstep(0.99955, 0.9998, moonDot);
    vec3 right = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, moonDirection);
    vec2 local = vec2(dot(direction, right), dot(direction, up)) / 0.027;
    float lit = 1.0 - abs(moonPhase * 2.0 - 1.0);
    float side = moonPhase < 0.5 ? -1.0 : 1.0;
    float shadow = 1.0 - smoothstep(0.9, 1.0, length(local - vec2(side * 2.0 * lit, 0.0)));
    float halo = pow(max(moonDot, 0.0), 900.0) * 0.3 * smoothstep(0.7, 1.0, lit);
    return vec3(0.92, 0.94, 1.0) * disc * mix(1.0, 0.1, shadow) + vec3(0.6, 0.66, 0.85) * halo;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = max(direction.y, 0.0);
    vec3 color = mix(horizonColor, topColor, pow(height, exponent));
    float sunDot = max(dot(direction, sunDirection), 0.0);
    color += sunColor * (pow(sunDot, 600.0) * 1.5 + pow(sunDot, 10.0) * 0.2) * sunVisibility;
    float aboveHorizon = smoothstep(0.02, 0.2, direction.y);
    // Les nuages (pluie, brume) voilent la lune et cachent les étoiles
    color += moonGlow(direction) * night * (1.0 - cloudiness * 0.85);
    // La lune (même sa partie sombre) cache les étoiles
    float behindMoon = smoothstep(0.9995, 0.9997, dot(direction, moonDirection));
    color += vec3(stars(direction)) * night * aboveHorizon * (1.0 - behindMoon) * (1.0 - cloudiness);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Ciel en dôme + brouillard assorti à l'horizon, piloté par le cycle
 * jour/nuit (setAmbience).
 */
export class Sky {
  readonly mesh: Mesh;
  private readonly fog = new Fog(0xffffff, 50, 250);
  private readonly uniforms = {
    topColor: { value: new Color() },
    horizonColor: { value: new Color() },
    exponent: { value: CONFIG.dayNight.skyGradientExponent },
    sunDirection: { value: new Vector3(0, 1, 0) },
    sunColor: { value: new Color() },
    sunVisibility: { value: 0 },
    moonDirection: { value: new Vector3(0, 1, 0) },
    moonPhase: { value: 0.5 },
    cloudiness: { value: 0 },
    night: { value: 0 },
  };

  constructor(scene: Scene) {
    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
    });
    this.mesh = new Mesh(new SphereGeometry(SKY_RADIUS, 32, 16), material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1;
    scene.fog = this.fog;
    scene.add(this.mesh);
  }

  /** Couleurs, astres et brouillard du moment ; le brouillard prend la couleur de l'horizon. */
  setAmbience(ambience: Ambience): void {
    const u = this.uniforms;
    const { colors, values } = ambience;
    u.topColor.value.copy(colors.skyTop);
    u.horizonColor.value.copy(colors.skyHorizon);
    u.sunColor.value.copy(colors.sun);
    u.sunDirection.value.copy(ambience.sunDirection);
    u.sunVisibility.value = ambience.sunVisibility;
    u.moonDirection.value.copy(ambience.moonDirection);
    u.night.value = values.night;
    this.fog.color.copy(colors.skyHorizon);
    this.fog.near = values.fogNear;
    this.fog.far = values.fogFar;
  }

  /** Phase de la lune : 0 = nouvelle, 0,5 = pleine (voir GameClock.moonPhase). */
  setMoonPhase(phase: number): void {
    this.uniforms.moonPhase.value = phase;
  }

  /** Ciel couvert (0 → 1) : étoiles et lune voilées. */
  setCloudiness(value: number): void {
    this.uniforms.cloudiness.value = value;
  }

  /** Le dôme reste centré sur la caméra : on ne peut jamais l'atteindre. */
  follow(position: Vector3): void {
    this.mesh.position.copy(position);
  }
}
