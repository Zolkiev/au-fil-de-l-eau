import { pick } from '../core/language';

/**
 * Temps qu'il fait. Le beau temps est le plus fréquent ; la brume ne se lève
 * qu'au petit matin. Chaque espèce peut préférer un temps (FishSpecies.weather).
 * Durées, chances et effets chiffrés : CONFIG.weather.
 */

export type WeatherId = 'clear' | 'rain' | 'mist' | 'wind';

export interface WeatherInfo {
  readonly id: WeatherId;
  readonly name: string;
  readonly icon: string;
  /** Annonce quand ce temps arrive. */
  readonly arrival: string;
}

export const WEATHERS: Record<WeatherId, WeatherInfo> = {
  clear: { id: 'clear', name: pick('Beau temps', 'Fair weather'), icon: '', arrival: pick('🌤️ Le ciel se dégage.', '🌤️ The sky is clearing.') },
  rain: {
    id: 'rain',
    name: pick('Pluie', 'Rain'),
    icon: '🌧️',
    arrival: pick('🌧️ Il se met à pleuvoir : ça mord plus vite.', '🌧️ It is starting to rain: the fish bite sooner.'),
  },
  mist: {
    id: 'mist',
    name: pick('Brume', 'Mist'),
    icon: '🌫️',
    arrival: pick('🌫️ Une brume se lève sur l’eau : certains poissons en profitent.', '🌫️ Mist is rising over the water: some fish make the most of it.'),
  },
  wind: {
    id: 'wind',
    name: pick('Vent', 'Wind'),
    icon: '💨',
    arrival: pick('💨 Le vent se lève : l’eau s’agite, les touches se font attendre.', '💨 The wind is picking up: the water gets choppy, bites take longer.'),
  },
};

export const WEATHER_IDS = Object.keys(WEATHERS) as WeatherId[];

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === 'string' && value in WEATHERS;
}
