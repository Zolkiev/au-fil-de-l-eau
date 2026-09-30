import { Color, MathUtils, Vector3 } from 'three';
import { CONFIG } from '../config';

type Keyframe = (typeof CONFIG.dayNight.keyframes)[number];
type ColorKey = 'skyTop' | 'skyHorizon' | 'sun' | 'hemiSky' | 'hemiGround' | 'water';
type NumberKey = 'sunIntensity' | 'hemiIntensity' | 'fogNear' | 'fogFar' | 'night';

const COLOR_KEYS: readonly ColorKey[] = ['skyTop', 'skyHorizon', 'sun', 'hemiSky', 'hemiGround', 'water'];
const NUMBER_KEYS: readonly NumberKey[] = ['sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'night'];

/** Ambiance d'un instant de la journée (objets réutilisés d'une frame à l'autre). */
export interface Ambience {
  readonly colors: Record<ColorKey, Color>;
  readonly values: Record<NumberKey, number>;
  /** Direction vers le vrai soleil (peut être sous l'horizon). */
  readonly sunDirection: Vector3;
  /** Visibilité du disque solaire dans le ciel, 0 → 1. */
  sunVisibility: number;
  readonly moonDirection: Vector3;
  /** Direction de la lumière principale : le soleil le jour, la lune la nuit. */
  readonly lightDirection: Vector3;
}

const _moonLight = new Vector3();

/**
 * Cycle jour/nuit : interpole les ambiances clés de CONFIG.dayNight selon
 * l'heure, et calcule la course du soleil (lever à l'est, +X ; midi côté -Z ;
 * coucher à l'ouest, -X).
 */
export class DayNight {
  readonly ambience: Ambience;
  private readonly keyframeColors: Record<ColorKey, Color>[];

  constructor() {
    this.keyframeColors = CONFIG.dayNight.keyframes.map((keyframe) => colorsOf(keyframe));
    this.ambience = {
      colors: colorsOf(CONFIG.dayNight.keyframes[0]),
      values: { sunIntensity: 0, hemiIntensity: 0, fogNear: 0, fogFar: 0, night: 0 },
      sunDirection: new Vector3(),
      sunVisibility: 0,
      moonDirection: moonDirection(new Vector3()),
      lightDirection: new Vector3(),
    };
  }

  /** Calcule l'ambiance de l'heure `hour` (0 → 24). */
  update(hour: number): Ambience {
    const { index, t } = this.segmentAt(hour);
    const from = CONFIG.dayNight.keyframes[index];
    const to = CONFIG.dayNight.keyframes[index + 1];
    const { colors, values } = this.ambience;
    for (const key of COLOR_KEYS) colors[key].lerpColors(this.keyframeColors[index][key], this.keyframeColors[index + 1][key], t);
    for (const key of NUMBER_KEYS) values[key] = MathUtils.lerp(from[key], to[key], t);
    this.updateCelestial(hour);
    return this.ambience;
  }

  /** Segment de keyframes qui contient `hour`, et position dans ce segment (0 → 1). */
  private segmentAt(hour: number): { index: number; t: number } {
    const keyframes = CONFIG.dayNight.keyframes;
    for (let i = 0; i < keyframes.length - 1; i++) {
      const start = keyframes[i].hour;
      const end = keyframes[i + 1].hour;
      if (hour >= start && hour <= end) return { index: i, t: (hour - start) / (end - start) };
    }
    return { index: 0, t: 0 };
  }

  /** Soleil, lune et direction de la lumière principale. */
  private updateCelestial(hour: number): void {
    const { sunrise, sunset, sunMaxElevation, minLightElevation } = CONFIG.dayNight;
    const ambience = this.ambience;
    const progress = (hour - sunrise) / (sunset - sunrise);
    const azimuth = Math.PI * MathUtils.clamp(progress, 0, 1);
    const elevation = sunMaxElevation * Math.sin(Math.PI * progress);
    directionFrom(azimuth, elevation, ambience.sunDirection);
    ambience.sunVisibility = MathUtils.smoothstep(elevation, -0.05, 0.08) * (1 - ambience.values.night);
    // Lumière : le soleil (jamais trop bas pour garder des ombres lisibles), puis la lune la nuit
    directionFrom(azimuth, Math.max(elevation, minLightElevation), ambience.lightDirection);
    _moonLight.copy(ambience.moonDirection);
    ambience.lightDirection.lerp(_moonLight, ambience.values.night).normalize();
  }
}

/** Direction depuis un angle horizontal (0 = est, π/2 = midi, π = ouest) et une hauteur (rad). */
function directionFrom(azimuth: number, elevation: number, out: Vector3): Vector3 {
  const horizontal = Math.cos(elevation);
  return out.set(Math.cos(azimuth) * horizontal, Math.sin(elevation), -Math.sin(azimuth) * horizontal);
}

function moonDirection(out: Vector3): Vector3 {
  const { azimuth, elevation } = CONFIG.dayNight.moon;
  return directionFrom(azimuth, elevation, out);
}

function colorsOf(keyframe: Keyframe): Record<ColorKey, Color> {
  return {
    skyTop: new Color(keyframe.skyTop),
    skyHorizon: new Color(keyframe.skyHorizon),
    sun: new Color(keyframe.sun),
    hemiSky: new Color(keyframe.hemiSky),
    hemiGround: new Color(keyframe.hemiGround),
    water: new Color(keyframe.water),
  };
}
