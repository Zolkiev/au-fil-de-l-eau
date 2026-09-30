/**
 * Lieux de pêche. Chacun a son niveau Blender (`assets/levels/…`) et ses
 * propres poissons (FishSpecies.place). On voyage de l'un à l'autre depuis
 * la carte du ponton de Moustache.
 */

export type PlaceId = 'lake' | 'river' | 'cove';

/** Ambiance marine d'un lieu : teinte de l'eau, houle, couleur des oiseaux (mouettes). */
export interface SeaLook {
  readonly waterTint: number;
  /** Part de la teinte dans la couleur de l'eau (0 → 1). */
  readonly tintMix: number;
  /** × hauteur des vagues (la houle). */
  readonly waves: number;
  readonly birdColor: number;
}

export interface Place {
  readonly id: PlaceId;
  readonly name: string;
  /** Pour les phrases : « du lac », « au lac ». */
  readonly of: string;
  readonly at: string;
  readonly icon: string;
  readonly description: string;
  /** Niveau à charger (chemin dans assets/). */
  readonly level: string;
  /**
   * Pour y aller : avoir déjà attrapé ce nombre d'espèces d'un autre lieu.
   * null = accessible dès le départ.
   */
  readonly unlock: { readonly place: PlaceId; readonly species: number } | null;
  /** Lieu au bord de la mer : eau turquoise, houle, ressac, mouettes. */
  readonly sea?: SeaLook;
}

export const PLACES: readonly Place[] = [
  {
    id: 'lake',
    name: 'Le lac',
    of: 'du lac',
    at: 'au lac',
    icon: '🏞️',
    description: 'Un lac tranquille, son île, son ponton et la cabane de Moustache.',
    level: 'levels/lake_01.glb',
    unlock: null,
  },
  {
    id: 'river',
    name: 'La rivière',
    of: 'de la rivière',
    at: 'à la rivière',
    icon: '🌊',
    description: 'Une rivière vive au fond d’un vallon, avec sa cascade et son vieux pont de bois.',
    level: 'levels/river_01.glb',
    unlock: { place: 'lake', species: 8 },
  },
  {
    id: 'cove',
    name: 'La crique',
    of: 'de la crique',
    at: 'à la crique',
    icon: '🏖️',
    description: 'Une crique au bord de la mer : plage de sable, falaises de pins, vieux phare et bouées au large.',
    level: 'levels/cove_01.glb',
    unlock: { place: 'river', species: 4 },
    sea: { waterTint: 0x3fc8c0, tintMix: 0.4, waves: 1.7, birdColor: 0xf2f2ee },
  },
];

export const DEFAULT_PLACE: PlaceId = 'lake';

export function placeById(id: PlaceId): Place {
  return PLACES.find((place) => place.id === id) ?? PLACES[0];
}

export function isPlaceId(value: unknown): value is PlaceId {
  return PLACES.some((place) => place.id === value);
}
