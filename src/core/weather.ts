import { MathUtils } from 'three';
import { CONFIG } from '../config';
import { isWeatherId, WEATHER_IDS, type WeatherId } from '../data/weather';
import { readNumber, readObject } from './validate';

type Random = () => number;

/**
 * Le temps qu'il fait, qui change au fil des heures de jeu. Chaque temps dure
 * quelques heures (CONFIG.weather.duration), puis un autre est tiré au sort.
 * Le passage de l'un à l'autre est progressif : `intensity()` donne la part
 * de chaque temps (0 → 1), pour les visuels et les sons.
 */
export class Weather {
  private current: WeatherId = 'clear';
  private previous: WeatherId = 'clear';
  private hoursLeft: number = CONFIG.weather.duration.max;
  /** Avancement du fondu de `previous` vers `current` (0 → 1). */
  private blend = 1;

  /** Relit l'état sauvegardé (beau temps s'il est invalide). */
  static fromData(value: unknown): Weather {
    const raw = readObject(value);
    const weather = new Weather();
    if (isWeatherId(raw.id)) weather.current = weather.previous = raw.id;
    weather.hoursLeft = readNumber(raw.hoursLeft, CONFIG.weather.duration.max, 0, 48);
    return weather;
  }

  /** Temps actuel (celui vers lequel on va, pendant un fondu). */
  get id(): WeatherId {
    return this.current;
  }

  /** Part de ce temps dans ce qu'on voit et entend (0 → 1). */
  intensity(id: WeatherId): number {
    if (id === this.current) return this.previous === id ? 1 : this.blend;
    return id === this.previous ? 1 - this.blend : 0;
  }

  /**
   * Fait passer `hours` heures de jeu ; `hour` = heure qu'il est (la brume ne
   * se lève qu'au petit matin). Retourne le nouveau temps s'il vient de changer.
   */
  update(hours: number, hour: number, random: Random = Math.random): WeatherId | null {
    this.blend = Math.min(1, this.blend + hours / CONFIG.weather.transitionHours);
    this.hoursLeft -= hours;
    if (this.hoursLeft > 0) return null;
    return this.change(pickWeather(this.current, hour, random), random);
  }

  /** Change de temps tout de suite, avec un fondu (tests en console : `game.weather.set('rain')`). */
  set(id: WeatherId): void {
    this.change(id, Math.random);
  }

  toData(): unknown {
    return { id: this.current, hoursLeft: this.hoursLeft };
  }

  private change(next: WeatherId, random: Random): WeatherId | null {
    const { min, max } = CONFIG.weather.duration;
    this.hoursLeft = MathUtils.lerp(min, max, random());
    if (next === this.current) return null;
    this.previous = this.current;
    this.current = next;
    this.blend = 0;
    return next;
  }
}

/** Temps suivant, tiré selon CONFIG.weather.chances (jamais deux fois le même, sauf le beau temps). */
function pickWeather(current: WeatherId, hour: number, random: Random): WeatherId {
  const { chances, mistHours } = CONFIG.weather;
  const dawn = hour >= mistHours.from && hour < mistHours.to;
  const candidates = WEATHER_IDS.filter((id) => (id === 'mist' ? dawn : true) && (id === 'clear' || id !== current));
  const weights = candidates.map((id) => chances[id]);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return 'clear';
}
