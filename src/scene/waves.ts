import { CONFIG } from '../config';

/*
 * Vagues : une somme de sinusoïdes définie dans CONFIG.water.waves.
 * La même formule existe en GLSL (surface de l'eau) et en TypeScript (barque,
 * bouchon, ronds dans l'eau), pour que tout flotte sur la même surface.
 * Sur une rivière, le motif des vagues est emporté par le courant : on
 * évalue les vagues au point (x, z) − courant × temps.
 */

const TAU = Math.PI * 2;

interface Wave {
  readonly amplitude: number;
  /** Nombre d'onde (rad/m). */
  readonly k: number;
  /** Pulsation (rad/s). */
  readonly omega: number;
  readonly dx: number;
  readonly dz: number;
}

const WAVES: readonly Wave[] = CONFIG.water.waves.map((wave) => {
  const k = TAU / wave.wavelength;
  return { amplitude: wave.amplitude, k, omega: k * wave.speed, dx: Math.cos(wave.direction), dz: Math.sin(wave.direction) };
});

/** Courant (m/s, dans le plan x, z) ; nul sur un lac. Houle : × hauteur des vagues (le vent la creuse). */
const flow = { x: 0, z: 0 };
let scale = 1;

/** Règle le courant (voir water.ts › setWaterFlow, qui règle aussi le shader). */
export function setWaveFlow(x: number, z: number): void {
  flow.x = x;
  flow.z = z;
}

/** Règle la houle (voir water.ts › setWaterWaveScale, qui règle aussi le shader). */
export function setWaveScale(value: number): void {
  scale = value;
}

/** Hauteur des vagues (m, autour du niveau de l'eau) au point (x, z) et à l'instant `time` (s). */
export function waveHeight(x: number, z: number, time: number): number {
  const px = x - flow.x * time;
  const pz = z - flow.z * time;
  let height = 0;
  for (const wave of WAVES) height += wave.amplitude * Math.sin(wave.k * (wave.dx * px + wave.dz * pz) - wave.omega * time);
  return height * scale;
}

/** La même fonction en GLSL : `float waterWave(vec2 p, float t)`. */
export function waveGlsl(): string {
  const terms = WAVES.map(
    (wave) =>
      `h += ${glslFloat(wave.amplitude)} * sin(${glslFloat(wave.k)} * dot(p, vec2(${glslFloat(wave.dx)}, ${glslFloat(wave.dz)})) - ${glslFloat(wave.omega)} * t);`,
  );
  return `float waterWave(vec2 p, float t) {\n  float h = 0.0;\n  ${terms.join('\n  ')}\n  return h;\n}`;
}

function glslFloat(value: number): string {
  return value.toFixed(6);
}
