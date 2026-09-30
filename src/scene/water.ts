import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2 } from 'three';
import { CONFIG } from '../config';
import type { Ambience } from './dayNight';
import { avoidDryPixels } from './waterMask';
import { setWaveFlow, setWaveScale, waveGlsl } from './waves';

/*
 * Eau stylisée : un MeshStandardMaterial (lumières, ombre de la barque,
 * brouillard) complété par un peu de GLSL :
 *  - ondulation des sommets (vagues, amorties près de la rive) ;
 *  - facettes low poly (flatShading) qui accrochent la lumière ;
 *  - dégradé selon la profondeur, écume animée au bord de l'eau ;
 *  - reflet du ciel quand on regarde l'eau de biais (Fresnel).
 * La géométrie vient de waterSurface.ts (attributs `depth` et `depthSmooth`).
 */

const uniforms = {
  uTime: { value: 0 },
  uFlow: { value: new Vector2() },
  uWaveScale: { value: 1 },
  uShallowColor: { value: new Color() },
  uDeepColor: { value: new Color() },
  uFoamColor: { value: new Color(CONFIG.water.foamColor) },
  uReflectionColor: { value: new Color() },
  uDepthRange: { value: CONFIG.water.depthRange },
  uFoamWidth: { value: CONFIG.water.foamWidth },
  uFoamStrength: { value: CONFIG.water.foamStrength },
  uReflectivity: { value: CONFIG.water.reflectivity },
};

const SHALLOW_TINT = new Color(CONFIG.water.shallowTint);
/** Teinte propre au lieu (eau de mer turquoise) ; aucune au lac et à la rivière. */
const placeTint = { color: new Color(), mix: 0 };

const VERTEX_HEADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uFlow;
  uniform float uWaveScale;
  attribute float depth;
  attribute float depthSmooth;
  varying float vWaterDepth;
  varying float vWaterDepthSmooth;
  varying vec2 vWaterXZ;
`;

// La géométrie est en coordonnées monde : position.xz est la position sur l'eau.
// Le courant emporte le motif des vagues et de l'écume.
const VERTEX_WAVES = /* glsl */ `
  #include <begin_vertex>
  vWaterDepth = depth;
  vWaterDepthSmooth = depthSmooth;
  vWaterXZ = position.xz - uFlow * uTime;
  transformed.y += waterWave(vWaterXZ, uTime) * uWaveScale * smoothstep(0.0, 1.2, depth);
`;

const FRAGMENT_HEADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  uniform vec3 uReflectionColor;
  uniform float uDepthRange;
  uniform float uFoamWidth;
  uniform float uFoamStrength;
  uniform float uReflectivity;
  varying float vWaterDepth;
  varying float vWaterDepthSmooth;
  varying vec2 vWaterXZ;
`;

const FRAGMENT_COLOR = /* glsl */ `
  #include <color_fragment>
  float waterShallow = 1.0 - smoothstep(0.0, uDepthRange, vWaterDepthSmooth);
  diffuseColor.rgb = mix(uDeepColor, uShallowColor, waterShallow);
  float waterFoamNoise = sin(vWaterXZ.x * 1.9 + uTime * 1.2) * sin(vWaterXZ.y * 2.3 - uTime * 0.9);
  float waterFoam = 1.0 - smoothstep(0.0, uFoamWidth, vWaterDepth + waterFoamNoise * 0.1);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, clamp(waterFoam, 0.0, 1.0) * uFoamStrength);
`;

const FRAGMENT_REFLECTION = /* glsl */ `
  float waterFresnel = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
  outgoingLight = mix(outgoingLight, uReflectionColor, waterFresnel * uReflectivity);
  #include <opaque_fragment>
`;

let waterMaterial: MeshStandardMaterial | null = null;

/** Matériau partagé de l'eau (qui évite l'intérieur de la coque, voir waterMask.ts). */
export function getWaterMaterial(): MeshStandardMaterial {
  if (waterMaterial) return waterMaterial;
  waterMaterial = new MeshStandardMaterial({ roughness: CONFIG.water.roughness, metalness: 0, flatShading: true });
  waterMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // Les sauts de ligne comptent : une directive comme #define doit commencer sa ligne
    shader.vertexShader = `${VERTEX_HEADER}${waveGlsl()}\n${shader.vertexShader.replace('#include <begin_vertex>', VERTEX_WAVES)}`;
    shader.fragmentShader =
      FRAGMENT_HEADER +
      shader.fragmentShader
        .replace('#include <color_fragment>', FRAGMENT_COLOR)
        .replace('#include <opaque_fragment>', FRAGMENT_REFLECTION);
  };
  waterMaterial.customProgramCacheKey = () => 'petite-peche-water';
  avoidDryPixels(waterMaterial);
  return waterMaterial;
}

/** Couleurs de l'eau et du reflet, pilotées par le cycle jour/nuit. */
export function setWaterAmbience(ambience: Ambience): void {
  const { water, skyHorizon, skyTop } = ambience.colors;
  const { shallowMix, shallowBrightness, deepBrightness } = CONFIG.water;
  uniforms.uShallowColor.value.copy(water).lerp(SHALLOW_TINT, shallowMix).multiplyScalar(shallowBrightness);
  uniforms.uDeepColor.value.copy(water).multiplyScalar(deepBrightness);
  uniforms.uReflectionColor.value.copy(skyHorizon).lerp(skyTop, 0.35);
  if (placeTint.mix <= 0) return;
  uniforms.uShallowColor.value.lerp(placeTint.color, placeTint.mix);
  uniforms.uDeepColor.value.lerp(placeTint.color, placeTint.mix * 0.6).multiplyScalar(0.85);
}

/** Teinte de l'eau propre au lieu (mix 0 = aucune), mêlée aux couleurs du cycle jour/nuit. */
export function setWaterTint(color: number, mix: number): void {
  placeTint.color.set(color);
  placeTint.mix = mix;
}

/** Courant de l'eau (m/s dans le plan x, z) : il emporte les vagues et l'écume. */
export function setWaterFlow(flow: Vector2): void {
  uniforms.uFlow.value.copy(flow);
  setWaveFlow(flow.x, flow.y);
}

/** Houle : × hauteur des vagues (1 = calme ; le vent la creuse). */
export function setWaterWaveScale(value: number): void {
  uniforms.uWaveScale.value = value;
  setWaveScale(value);
}

/** Temps des vagues et de l'écume (s). */
export function setWaterTime(time: number): void {
  uniforms.uTime.value = time;
}

/** Plan d'eau carré de secours, posé en y = 0 (seule son emprise sert : voir waterSurface.ts). */
export function createFallbackWater(size: number): Mesh {
  const water = new Mesh(new PlaneGeometry(size, size).rotateX(-Math.PI / 2));
  water.name = 'water';
  return water;
}
