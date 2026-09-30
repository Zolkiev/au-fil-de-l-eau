import { BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, MathUtils, type Vector3 } from 'three';
import { CONFIG } from '../config';
import type { Weather } from '../core/weather';
import { Ripples } from '../fishing/ripples';
import type { Ambience } from './dayNight';
import type { LevelData } from './levelLoader';
import { setWaterWaveScale } from './water';

const _grey = new Color();

/**
 * Ce qu'on voit du temps qu'il fait :
 * - pluie : gouttes autour de la caméra et petits ronds sur l'eau ;
 * - pluie et brume : ciel gris, lumière voilée, brouillard plus proche ;
 * - vent : vagues plus creuses (la barque tangue davantage).
 * Tout suit les fondus de Weather.intensity().
 */
export class WeatherEffects {
  readonly group = new Group();
  private readonly level: LevelData;
  private readonly drops: Float32Array;
  private readonly rain: LineSegments;
  private readonly rainMaterial: LineBasicMaterial;
  private readonly splashes = new Ripples(32);
  private splashTimer = 0;
  /** Part du mouvement des vagues conservée (réglage « Moins d'animations »). */
  private motionScale = 1;
  /** Houle propre au lieu (× vagues : plus forte au bord de la mer). */
  private baseWaves = 1;

  constructor(level: LevelData) {
    const { drops, color } = CONFIG.weather.rain;
    this.level = level;
    this.drops = new Float32Array(drops * 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.drops, 3));
    this.rainMaterial = new LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new LineSegments(geometry, this.rainMaterial);
    this.rain.name = 'rain';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.name = 'weather';
    this.group.add(this.rain, this.splashes.group);
  }

  /** Ciel, lumière et brouillard du moment, assombris par la pluie et la brume (modifie `ambience`). */
  tint(ambience: Ambience, weather: Weather): void {
    const { rain, mist } = CONFIG.weather.look;
    const r = weather.intensity('rain');
    const m = weather.intensity('mist');
    if (r + m === 0) return;
    const { colors, values } = ambience;
    const grey = rain.grey * r + mist.grey * m;
    for (const color of [colors.skyTop, colors.skyHorizon, colors.water, colors.hemiSky]) color.lerp(greyOf(color, _grey), grey);
    colors.skyHorizon.lerp(_grey.setScalar(luminance(colors.skyHorizon) * 1.25), m * 0.3);
    values.sunIntensity *= MathUtils.lerp(1, rain.light, r) * MathUtils.lerp(1, mist.light, m);
    values.hemiIntensity *= MathUtils.lerp(1, 0.85, r);
    values.fogNear = MathUtils.lerp(MathUtils.lerp(values.fogNear, rain.fogNear, r), mist.fogNear, m);
    values.fogFar = MathUtils.lerp(MathUtils.lerp(values.fogFar, rain.fogFar, r), mist.fogFar, m);
    ambience.sunVisibility *= 1 - 0.9 * Math.max(r, m);
  }

  /** Ciel couvert (0 → 1), pour voiler la lune et les étoiles. */
  cloudiness(weather: Weather): number {
    return Math.max(weather.intensity('rain'), weather.intensity('mist'));
  }

  setMotionScale(scale: number): void {
    this.motionScale = scale;
  }

  setBaseWaves(scale: number): void {
    this.baseWaves = scale;
  }

  update(dt: number, elapsed: number, weather: Weather, camera: Vector3, boat: Vector3): void {
    const wind = 1 + (CONFIG.weather.look.windWaves - 1) * weather.intensity('wind');
    setWaterWaveScale(wind * this.baseWaves * this.motionScale);
    const rain = weather.intensity('rain');
    this.updateDrops(dt, rain, weather.intensity('wind'), camera);
    this.updateSplashes(dt, rain, boat);
    this.splashes.update(dt, elapsed);
  }

  /** Les gouttes tombent autour de la caméra ; arrivées à l'eau, elles repartent d'en haut. */
  private updateDrops(dt: number, intensity: number, wind: number, camera: Vector3): void {
    const { speed, length, opacity, area, height } = CONFIG.weather.rain;
    this.rain.visible = intensity > 0.01;
    if (!this.rain.visible) return;
    this.rainMaterial.opacity = opacity * intensity;
    const fall = speed * dt;
    const slant = length * (0.15 + 0.5 * wind);
    const floor = this.level.water.level;
    const d = this.drops;
    for (let i = 0; i < d.length; i += 6) {
      let x = d[i];
      let y = d[i + 1] - fall;
      let z = d[i + 2];
      const outside = Math.abs(x - camera.x) > area || Math.abs(z - camera.z) > area;
      if (y < floor || outside || y > camera.y + height) {
        x = camera.x + (Math.random() * 2 - 1) * area;
        z = camera.z + (Math.random() * 2 - 1) * area;
        y = outside || y > camera.y + height ? floor + Math.random() * height : camera.y + height * (0.5 + Math.random() * 0.5);
      }
      d.set([x, y, z, x + slant, y + length, z], i);
    }
    (this.rain.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }

  /** Petits ronds des gouttes sur l'eau libre, autour de la barque. */
  private updateSplashes(dt: number, intensity: number, boat: Vector3): void {
    this.splashTimer -= dt * CONFIG.weather.rain.ripples * intensity;
    while (this.splashTimer < 0) {
      this.splashTimer += 1;
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 12;
      const x = boat.x + Math.cos(angle) * distance;
      const z = boat.z + Math.sin(angle) * distance;
      if (this.isOpenWater(x, z)) this.splashes.spawn(x, this.level.water.level, z, 0.25 + Math.random() * 0.2, 0.6, 0.4);
    }
  }

  private isOpenWater(x: number, z: number): boolean {
    return this.level.water.footprint.contains(x, z) && !this.level.colliders.footprint.contains(x, z);
  }
}

function luminance(color: Color): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

/** Gris de même luminosité, à peine bleuté (ciel couvert). */
function greyOf(color: Color, out: Color): Color {
  const value = luminance(color);
  return out.setRGB(value * 0.97, value, value * 1.05);
}
