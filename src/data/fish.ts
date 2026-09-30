import type { TimeSlot } from '../core/gameClock';
import type { ZoneType } from '../scene/levelLoader';
import type { BaitId } from './baits';
import type { PlaceId } from './places';
import type { WeatherId } from './weather';

/**
 * Espèces fictives, inspirées des eaux tempérées : 10 au lac, 6 à la
 * rivière, 6 à la crique (poissons de mer). Le modèle 3D d'une espèce est `assets/fish/<id>.glb` (sinon un
 * placeholder coloré avec `colors`).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Où vit un poisson : un type de zone, ou l'eau libre (hors de toute zone). */
export type Habitat = ZoneType | 'open';

export interface FishSpecies {
  /** Identifiant stable (nom du fichier .glb, clé de sauvegarde). */
  readonly id: string;
  readonly name: string;
  /** Lieu où elle vit (elle ne mord que là). */
  readonly place: PlaceId;
  readonly rarity: Rarity;
  readonly habitats: readonly Habitat[];
  /** Créneaux où il mord (bornes horaires dans CONFIG.time.slots). */
  readonly times: readonly TimeSlot[];
  readonly sizeCm: { readonly min: number; readonly max: number };
  readonly difficulty: {
    /** Force de 0 (docile) à 1 (très combatif). */
    readonly strength: number;
    /** À-coups par seconde en moyenne pendant la remontée. */
    readonly burstFrequency: number;
  };
  /** Appâts qu'il préfère (voir CONFIG.fishSelection). */
  readonly baits: readonly BaitId[];
  /** Temps qu'il préfère : il mord plus souvent (CONFIG.weather.likedFactor). */
  readonly weather: WeatherId;
  /** Texte court pour le carnet. */
  readonly description: string;
  /**
   * Variante rare (couleur inhabituelle) : son nom complet et sa teinte.
   * Chance de la croiser : CONFIG.progression.variantChance.
   */
  readonly variant: { readonly name: string; readonly color: number };
  /** Couleurs du modèle placeholder. */
  readonly colors: { readonly body: number; readonly fins: number };
}

export const FISH: readonly FishSpecies[] = [
  {
    id: 'ablette_miroir',
    name: 'Ablette miroir',
    place: 'lake',
    rarity: 'common',
    habitats: ['open', 'shallow'],
    times: ['day'],
    sizeCm: { min: 8, max: 18 },
    difficulty: { strength: 0.1, burstFrequency: 0.1 },
    baits: ['maggot', 'fly'],
    weather: 'wind',
    description: 'Ses écailles renvoient le soleil comme un petit miroir. Elle file en bancs entiers.',
    variant: { name: 'Ablette miroir dorée', color: 0xf2c14e },
    colors: { body: 0xcfdbe0, fins: 0x9fb4bd },
  },
  {
    id: 'gardon_perle',
    name: 'Gardon perlé',
    place: 'lake',
    rarity: 'common',
    habitats: ['open', 'shallow', 'reeds'],
    times: ['dawn', 'day'],
    sizeCm: { min: 10, max: 28 },
    difficulty: { strength: 0.15, burstFrequency: 0.15 },
    baits: ['maggot', 'worm', 'fly'],
    weather: 'rain',
    description: 'Le compagnon de toutes les matinées. Son œil rouge semble toujours un peu surpris.',
    variant: { name: 'Gardon perlé rose', color: 0xf2a7b8 },
    colors: { body: 0xb8c4c2, fins: 0xd9735b },
  },
  {
    id: 'perche_zebree',
    name: 'Perche zébrée',
    place: 'lake',
    rarity: 'common',
    habitats: ['rocks', 'reeds', 'deep'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 15, max: 38 },
    difficulty: { strength: 0.35, burstFrequency: 0.35 },
    baits: ['worm', 'spinner'],
    weather: 'rain',
    description: 'Rayée comme un pyjama, elle chasse en petite bande autour des rochers.',
    variant: { name: 'Perche zébrée bleue', color: 0x6fa8dc },
    colors: { body: 0x9fae62, fins: 0xe0873f },
  },
  {
    id: 'rotengle_dore',
    name: 'Rotengle doré',
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['reeds'],
    times: ['day', 'dusk'],
    sizeCm: { min: 15, max: 32 },
    difficulty: { strength: 0.25, burstFrequency: 0.2 },
    baits: ['corn', 'maggot', 'fly'],
    weather: 'rain',
    description: 'Il se faufile entre les roseaux, ses nageoires rouge vif comme des lanternes.',
    variant: { name: 'Rotengle argenté', color: 0xdfe6ea },
    colors: { body: 0xd8b25a, fins: 0xd9573f },
  },
  {
    id: 'tanche_vase',
    name: 'Tanche de vase',
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['reeds', 'shallow'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 25, max: 52 },
    difficulty: { strength: 0.45, burstFrequency: 0.25 },
    baits: ['worm', 'corn', 'boilie'],
    weather: 'rain',
    description: 'Verte et veloutée, elle somnole dans la vase et ne sort qu’à la lumière douce.',
    variant: { name: 'Tanche dorée', color: 0xe6b84a },
    colors: { body: 0x6f8a4a, fins: 0x4f6a36 },
  },
  {
    id: 'breme_lune',
    name: 'Brème lune',
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['deep', 'open', 'rocks'],
    times: ['day', 'dusk', 'night'],
    sizeCm: { min: 30, max: 58 },
    difficulty: { strength: 0.4, burstFrequency: 0.2 },
    baits: ['corn', 'worm', 'boilie'],
    weather: 'wind',
    description: 'Ronde et plate comme une lune pâle, elle croise lentement au-dessus des fonds.',
    variant: { name: 'Brème lune rousse', color: 0xd98a4e },
    colors: { body: 0xc9c2a2, fins: 0x8f8a78 },
  },
  {
    id: 'carpe_mousse',
    name: 'Carpe mousse',
    place: 'lake',
    rarity: 'rare',
    habitats: ['deep', 'reeds'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 45, max: 88 },
    difficulty: { strength: 0.75, burstFrequency: 0.35 },
    baits: ['corn', 'boilie'],
    weather: 'mist',
    description: 'Une vieille carpe au dos couvert de mousse. On dit qu’elle connaît tous les pêcheurs du lac.',
    variant: { name: 'Carpe koï', color: 0xf08a3c },
    colors: { body: 0x8a7a4a, fins: 0x5f6f3a },
  },
  {
    id: 'sandre_ombre',
    name: 'Sandre d’ombre',
    place: 'lake',
    rarity: 'rare',
    habitats: ['deep', 'rocks'],
    times: ['dusk', 'night'],
    sizeCm: { min: 40, max: 78 },
    difficulty: { strength: 0.65, burstFrequency: 0.4 },
    baits: ['worm', 'spinner'],
    weather: 'mist',
    description: 'Ses grands yeux vitreux voient dans le noir. Il ne mord qu’une fois le soleil couché.',
    variant: { name: 'Sandre albinos', color: 0xf4e4e0 },
    colors: { body: 0x8c9488, fins: 0x5c645c },
  },
  {
    id: 'brochet_emeraude',
    name: 'Brochet émeraude',
    place: 'lake',
    rarity: 'rare',
    habitats: ['reeds', 'rocks'],
    times: ['dawn', 'day'],
    sizeCm: { min: 55, max: 112 },
    difficulty: { strength: 0.8, burstFrequency: 0.45 },
    baits: ['worm', 'spinner'],
    weather: 'wind',
    description: 'Le chasseur des roseaux, vert comme une bouteille au soleil. Prépare-toi à des secousses.',
    variant: { name: 'Brochet saphir', color: 0x4f7fd0 },
    colors: { body: 0x4f8a5a, fins: 0xa3b85a },
  },
  {
    id: 'silure_brumes',
    name: 'Silure des brumes',
    place: 'lake',
    rarity: 'legendary',
    habitats: ['deep'],
    times: ['night'],
    sizeCm: { min: 120, max: 220 },
    difficulty: { strength: 1, burstFrequency: 0.3 },
    baits: ['worm', 'corn', 'spinner'],
    weather: 'mist',
    description: 'Le géant du lac. Certains soirs de brume, on aperçoit ses moustaches à la surface.',
    variant: { name: 'Silure de lune', color: 0xcfd8f0 },
    colors: { body: 0x4d4f55, fins: 0x35373c },
  },
  // --- La rivière ---
  {
    id: 'vairon_vif',
    name: 'Vairon vif',
    place: 'river',
    rarity: 'common',
    habitats: ['open', 'shallow', 'reeds'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 5, max: 12 },
    difficulty: { strength: 0.08, burstFrequency: 0.1 },
    baits: ['maggot', 'fly'],
    weather: 'wind',
    description: 'Pas plus long qu’un doigt, il file entre les galets en bancs scintillants.',
    variant: { name: 'Vairon rubis', color: 0xe0584a },
    colors: { body: 0xb8b77a, fins: 0x8a8a5a },
  },
  {
    id: 'chevesne_malin',
    name: 'Chevesne malin',
    place: 'river',
    rarity: 'common',
    habitats: ['open', 'shallow', 'rocks', 'deep', 'reeds'],
    times: ['day', 'dusk', 'night'],
    sizeCm: { min: 20, max: 55 },
    difficulty: { strength: 0.35, burstFrequency: 0.3 },
    baits: ['worm', 'corn', 'fly'],
    weather: 'rain',
    description: 'Gros museau et grand appétit : il goûte à tout ce qui tombe à l’eau.',
    variant: { name: 'Chevesne doré', color: 0xe8b84a },
    colors: { body: 0x9fabab, fins: 0xd07a4a },
  },
  {
    id: 'truite_ruisseau',
    name: 'Truite des ruisseaux',
    place: 'river',
    rarity: 'uncommon',
    habitats: ['rocks', 'shallow'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 20, max: 48 },
    difficulty: { strength: 0.5, burstFrequency: 0.45 },
    baits: ['worm', 'spinner', 'fly'],
    weather: 'rain',
    description: 'Tachetée de rouge et de noir, elle aime l’eau froide qui court sur les pierres.',
    variant: { name: 'Truite arc-en-ciel', color: 0xe8a0c0 },
    colors: { body: 0xb59a5a, fins: 0xc8a070 },
  },
  {
    id: 'barbeau_gue',
    name: 'Barbeau du gué',
    place: 'river',
    rarity: 'uncommon',
    habitats: ['deep', 'rocks', 'open'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 30, max: 70 },
    difficulty: { strength: 0.55, burstFrequency: 0.25 },
    baits: ['worm', 'boilie', 'corn'],
    weather: 'mist',
    description: 'Il fouille le fond avec ses quatre barbillons, le nez toujours dans le courant.',
    variant: { name: 'Barbeau d’argent', color: 0xdfe4e8 },
    colors: { body: 0x9c8a60, fins: 0xb07a50 },
  },
  {
    id: 'ombre_cascade',
    name: 'Ombre des cascades',
    place: 'river',
    rarity: 'rare',
    habitats: ['shallow', 'rocks'],
    times: ['dawn', 'day'],
    sizeCm: { min: 28, max: 55 },
    difficulty: { strength: 0.5, burstFrequency: 0.4 },
    baits: ['fly', 'maggot'],
    weather: 'mist',
    description: 'Sa grande nageoire dorsale, violette et mouchetée, se déploie comme un drapeau.',
    variant: { name: 'Ombre de soleil', color: 0xf2c14e },
    colors: { body: 0x8c9aa8, fins: 0x8a5ca8 },
  },
  {
    id: 'anguille_lune',
    name: 'Anguille de lune',
    place: 'river',
    rarity: 'legendary',
    habitats: ['deep', 'reeds'],
    times: ['night'],
    sizeCm: { min: 80, max: 150 },
    difficulty: { strength: 0.9, burstFrequency: 0.5 },
    baits: ['worm', 'spinner'],
    weather: 'rain',
    description: 'Longue et souple comme un ruban d’argent : on ne la voit que les nuits de lune.',
    variant: { name: 'Anguille de verre', color: 0xcfe8e8 },
    colors: { body: 0x5a5a40, fins: 0x4a4a38 },
  },
  // --- La crique ---
  {
    id: 'maquereau_raye',
    name: 'Maquereau rayé',
    place: 'cove',
    rarity: 'common',
    habitats: ['open', 'deep', 'shallow'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 20, max: 40 },
    difficulty: { strength: 0.3, burstFrequency: 0.4 },
    baits: ['spinner', 'fly'],
    weather: 'wind',
    description: 'Il file en bancs serrés, le dos zébré de vagues bleues et noires.',
    variant: { name: 'Maquereau d’or', color: 0xe8c050 },
    colors: { body: 0x8fb8c0, fins: 0x7a9aa4 },
  },
  {
    id: 'rouget_corail',
    name: 'Rouget corail',
    place: 'cove',
    rarity: 'common',
    habitats: ['shallow', 'rocks', 'reeds'],
    times: ['dawn', 'day', 'dusk', 'night'],
    sizeCm: { min: 12, max: 30 },
    difficulty: { strength: 0.2, burstFrequency: 0.2 },
    baits: ['worm', 'maggot'],
    weather: 'clear',
    description: 'Rose comme un coquillage, il fouille le sable avec ses deux barbillons, de jour comme de nuit.',
    variant: { name: 'Rouget d’argent', color: 0xe8ecf0 },
    colors: { body: 0xe88878, fins: 0xf0a080 },
  },
  {
    id: 'bar_ecume',
    name: 'Bar d’écume',
    place: 'cove',
    rarity: 'uncommon',
    habitats: ['rocks', 'shallow', 'open', 'reeds', 'deep'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 30, max: 75 },
    difficulty: { strength: 0.55, burstFrequency: 0.35 },
    baits: ['spinner', 'worm'],
    weather: 'wind',
    description: 'Le loup des rochers : il chasse dans l’écume quand la mer se lève.',
    variant: { name: 'Bar tigré', color: 0xe0a050 },
    colors: { body: 0xb8c4cc, fins: 0x8a98a0 },
  },
  {
    id: 'daurade_doree',
    name: 'Daurade dorée',
    place: 'cove',
    rarity: 'uncommon',
    habitats: ['shallow', 'reeds', 'open', 'deep'],
    times: ['day', 'dusk'],
    sizeCm: { min: 25, max: 55 },
    difficulty: { strength: 0.45, burstFrequency: 0.3 },
    baits: ['worm', 'boilie'],
    weather: 'clear',
    description: 'Un sourcil d’or entre les yeux : elle broie les coquillages de ses dents plates.',
    variant: { name: 'Daurade de nacre', color: 0xf0e8f4 },
    colors: { body: 0xc8ccc8, fins: 0xa0a8a0 },
  },
  {
    id: 'vieille_arlequin',
    name: 'Vieille arlequin',
    place: 'cove',
    rarity: 'rare',
    habitats: ['rocks', 'reeds'],
    times: ['dawn', 'day'],
    sizeCm: { min: 20, max: 45 },
    difficulty: { strength: 0.4, burstFrequency: 0.35 },
    baits: ['worm'],
    weather: 'rain',
    description: 'Tachetée d’orange et de vert, elle vit en ermite au creux des rochers.',
    variant: { name: 'Vieille de feu', color: 0xe86040 },
    colors: { body: 0x6aa878, fins: 0xe08a50 },
  },
  {
    id: 'espadon_marees',
    name: 'Espadon des marées',
    place: 'cove',
    rarity: 'legendary',
    habitats: ['deep', 'open'],
    times: ['night'],
    sizeCm: { min: 150, max: 260 },
    difficulty: { strength: 1, burstFrequency: 0.45 },
    baits: ['spinner'],
    weather: 'mist',
    description: 'Son long rostre fend les vagues : on ne l’a vu que les nuits de lune, près des bouées.',
    variant: { name: 'Espadon d’argent', color: 0xdfe6ee },
    colors: { body: 0x3a4a68, fins: 0x2a3a58 },
  },
];

/** Espèces d'un lieu. */
export function fishOf(place: PlaceId): FishSpecies[] {
  return FISH.filter((species) => species.place === place);
}

/** Espèce par identifiant. */
export function fishById(id: string): FishSpecies | undefined {
  return FISH.find((species) => species.id === id);
}
