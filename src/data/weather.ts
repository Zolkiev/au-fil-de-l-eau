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
  clear: { id: 'clear', name: 'Beau temps', icon: '', arrival: '🌤️ Le ciel se dégage.' },
  rain: { id: 'rain', name: 'Pluie', icon: '🌧️', arrival: '🌧️ Il se met à pleuvoir : ça mord plus vite.' },
  mist: { id: 'mist', name: 'Brume', icon: '🌫️', arrival: '🌫️ Une brume se lève sur l’eau : certains poissons en profitent.' },
  wind: { id: 'wind', name: 'Vent', icon: '💨', arrival: '💨 Le vent se lève : l’eau s’agite, les touches se font attendre.' },
};

export const WEATHER_IDS = Object.keys(WEATHERS) as WeatherId[];

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === 'string' && value in WEATHERS;
}
