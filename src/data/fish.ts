import type { TimeSlot } from '../core/gameClock';
import { pick } from '../core/language';
import type { ZoneType } from '../scene/levelLoader';
import type { BaitId } from './baits';
import type { PlaceId } from './places';
import type { WeatherId } from './weather';

/**
 * Espèces fictives, inspirées des eaux tempérées : 10 au lac, 6 à la
 * rivière, 6 à la crique (poissons de mer). Le modèle 3D d'une espèce est
 * `assets/fish/<id>.glb` (sinon un placeholder coloré avec `colors`).
 * Noms et descriptions : `pick(français, anglais)`.
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
    name: pick('Ablette miroir', 'Mirror Bleak'),
    place: 'lake',
    rarity: 'common',
    habitats: ['open', 'shallow'],
    times: ['day'],
    sizeCm: { min: 8, max: 18 },
    difficulty: { strength: 0.1, burstFrequency: 0.1 },
    baits: ['maggot', 'fly'],
    weather: 'wind',
    description: pick(
      'Ses écailles renvoient le soleil comme un petit miroir. Elle file en bancs entiers.',
      'Its scales flash the sun back like a tiny mirror. It darts about in whole shoals.',
    ),
    variant: { name: pick('Ablette miroir dorée', 'Golden Mirror Bleak'), color: 0xf2c14e },
    colors: { body: 0xcfdbe0, fins: 0x9fb4bd },
  },
  {
    id: 'gardon_perle',
    name: pick('Gardon perlé', 'Pearl Roach'),
    place: 'lake',
    rarity: 'common',
    habitats: ['open', 'shallow', 'reeds'],
    times: ['dawn', 'day'],
    sizeCm: { min: 10, max: 28 },
    difficulty: { strength: 0.15, burstFrequency: 0.15 },
    baits: ['maggot', 'worm', 'fly'],
    weather: 'rain',
    description: pick(
      'Le compagnon de toutes les matinées. Son œil rouge semble toujours un peu surpris.',
      'The companion of every morning. Its red eye always looks a little surprised.',
    ),
    variant: { name: pick('Gardon perlé rose', 'Pink Pearl Roach'), color: 0xf2a7b8 },
    colors: { body: 0xb8c4c2, fins: 0xd9735b },
  },
  {
    id: 'perche_zebree',
    name: pick('Perche zébrée', 'Zebra Perch'),
    place: 'lake',
    rarity: 'common',
    habitats: ['rocks', 'reeds', 'deep'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 15, max: 38 },
    difficulty: { strength: 0.35, burstFrequency: 0.35 },
    baits: ['worm', 'spinner'],
    weather: 'rain',
    description: pick(
      'Rayée comme un pyjama, elle chasse en petite bande autour des rochers.',
      'Striped like a pair of pyjamas, it hunts in small gangs around the rocks.',
    ),
    variant: { name: pick('Perche zébrée bleue', 'Blue Zebra Perch'), color: 0x6fa8dc },
    colors: { body: 0x9fae62, fins: 0xe0873f },
  },
  {
    id: 'rotengle_dore',
    name: pick('Rotengle doré', 'Golden Rudd'),
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['reeds'],
    times: ['day', 'dusk'],
    sizeCm: { min: 15, max: 32 },
    difficulty: { strength: 0.25, burstFrequency: 0.2 },
    baits: ['corn', 'maggot', 'fly'],
    weather: 'rain',
    description: pick(
      'Il se faufile entre les roseaux, ses nageoires rouge vif comme des lanternes.',
      'It slips between the reeds, its bright red fins glowing like lanterns.',
    ),
    variant: { name: pick('Rotengle argenté', 'Silver Rudd'), color: 0xdfe6ea },
    colors: { body: 0xd8b25a, fins: 0xd9573f },
  },
  {
    id: 'tanche_vase',
    name: pick('Tanche de vase', 'Mud Tench'),
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['reeds', 'shallow'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 25, max: 52 },
    difficulty: { strength: 0.45, burstFrequency: 0.25 },
    baits: ['worm', 'corn', 'boilie'],
    weather: 'rain',
    description: pick(
      'Verte et veloutée, elle somnole dans la vase et ne sort qu’à la lumière douce.',
      'Green and velvety, it dozes in the mud and only comes out in soft light.',
    ),
    variant: { name: pick('Tanche dorée', 'Golden Tench'), color: 0xe6b84a },
    colors: { body: 0x6f8a4a, fins: 0x4f6a36 },
  },
  {
    id: 'breme_lune',
    name: pick('Brème lune', 'Moon Bream'),
    place: 'lake',
    rarity: 'uncommon',
    habitats: ['deep', 'open', 'rocks'],
    times: ['day', 'dusk', 'night'],
    sizeCm: { min: 30, max: 58 },
    difficulty: { strength: 0.4, burstFrequency: 0.2 },
    baits: ['corn', 'worm', 'boilie'],
    weather: 'wind',
    description: pick(
      'Ronde et plate comme une lune pâle, elle croise lentement au-dessus des fonds.',
      'Round and flat like a pale moon, it cruises slowly above the lake bed.',
    ),
    variant: { name: pick('Brème lune rousse', 'Russet Moon Bream'), color: 0xd98a4e },
    colors: { body: 0xc9c2a2, fins: 0x8f8a78 },
  },
  {
    id: 'carpe_mousse',
    name: pick('Carpe mousse', 'Mossy Carp'),
    place: 'lake',
    rarity: 'rare',
    habitats: ['deep', 'reeds'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 45, max: 88 },
    difficulty: { strength: 0.75, burstFrequency: 0.35 },
    baits: ['corn', 'boilie'],
    weather: 'mist',
    description: pick(
      'Une vieille carpe au dos couvert de mousse. On dit qu’elle connaît tous les pêcheurs du lac.',
      'An old carp with a moss-covered back. They say it knows every angler on the lake.',
    ),
    variant: { name: pick('Carpe koï', 'Koi Carp'), color: 0xf08a3c },
    colors: { body: 0x8a7a4a, fins: 0x5f6f3a },
  },
  {
    id: 'sandre_ombre',
    name: pick('Sandre d’ombre', 'Shadow Zander'),
    place: 'lake',
    rarity: 'rare',
    habitats: ['deep', 'rocks'],
    times: ['dusk', 'night'],
    sizeCm: { min: 40, max: 78 },
    difficulty: { strength: 0.65, burstFrequency: 0.4 },
    baits: ['worm', 'spinner'],
    weather: 'mist',
    description: pick(
      'Ses grands yeux vitreux voient dans le noir. Il ne mord qu’une fois le soleil couché.',
      'Its big glassy eyes see in the dark. It only bites once the sun has set.',
    ),
    variant: { name: pick('Sandre albinos', 'Albino Zander'), color: 0xf4e4e0 },
    colors: { body: 0x8c9488, fins: 0x5c645c },
  },
  {
    id: 'brochet_emeraude',
    name: pick('Brochet émeraude', 'Emerald Pike'),
    place: 'lake',
    rarity: 'rare',
    habitats: ['reeds', 'rocks'],
    times: ['dawn', 'day'],
    sizeCm: { min: 55, max: 112 },
    difficulty: { strength: 0.8, burstFrequency: 0.45 },
    baits: ['worm', 'spinner'],
    weather: 'wind',
    description: pick(
      'Le chasseur des roseaux, vert comme une bouteille au soleil. Prépare-toi à des secousses.',
      'The hunter of the reeds, green as a bottle in the sun. Brace yourself for a fight.',
    ),
    variant: { name: pick('Brochet saphir', 'Sapphire Pike'), color: 0x4f7fd0 },
    colors: { body: 0x4f8a5a, fins: 0xa3b85a },
  },
  {
    id: 'silure_brumes',
    name: pick('Silure des brumes', 'Mist Catfish'),
    place: 'lake',
    rarity: 'legendary',
    habitats: ['deep'],
    times: ['night'],
    sizeCm: { min: 120, max: 220 },
    difficulty: { strength: 1, burstFrequency: 0.3 },
    baits: ['worm', 'corn', 'spinner'],
    weather: 'mist',
    description: pick(
      'Le géant du lac. Certains soirs de brume, on aperçoit ses moustaches à la surface.',
      'The giant of the lake. On misty evenings, its whiskers can be glimpsed at the surface.',
    ),
    variant: { name: pick('Silure de lune', 'Moon Catfish'), color: 0xcfd8f0 },
    colors: { body: 0x4d4f55, fins: 0x35373c },
  },
  // --- La rivière ---
  {
    id: 'vairon_vif',
    name: pick('Vairon vif', 'Darting Minnow'),
    place: 'river',
    rarity: 'common',
    habitats: ['open', 'shallow', 'reeds'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 5, max: 12 },
    difficulty: { strength: 0.08, burstFrequency: 0.1 },
    baits: ['maggot', 'fly'],
    weather: 'wind',
    description: pick(
      'Pas plus long qu’un doigt, il file entre les galets en bancs scintillants.',
      'No longer than a finger, it darts between the pebbles in glittering shoals.',
    ),
    variant: { name: pick('Vairon rubis', 'Ruby Minnow'), color: 0xe0584a },
    colors: { body: 0xb8b77a, fins: 0x8a8a5a },
  },
  {
    id: 'chevesne_malin',
    name: pick('Chevesne malin', 'Sly Chub'),
    place: 'river',
    rarity: 'common',
    habitats: ['open', 'shallow', 'rocks', 'deep', 'reeds'],
    times: ['day', 'dusk', 'night'],
    sizeCm: { min: 20, max: 55 },
    difficulty: { strength: 0.35, burstFrequency: 0.3 },
    baits: ['worm', 'corn', 'fly'],
    weather: 'rain',
    description: pick(
      'Gros museau et grand appétit : il goûte à tout ce qui tombe à l’eau.',
      'Big snout and bigger appetite: it tastes anything that falls into the water.',
    ),
    variant: { name: pick('Chevesne doré', 'Golden Chub'), color: 0xe8b84a },
    colors: { body: 0x9fabab, fins: 0xd07a4a },
  },
  {
    id: 'truite_ruisseau',
    name: pick('Truite des ruisseaux', 'Brook Trout'),
    place: 'river',
    rarity: 'uncommon',
    habitats: ['rocks', 'shallow'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 20, max: 48 },
    difficulty: { strength: 0.5, burstFrequency: 0.45 },
    baits: ['worm', 'spinner', 'fly'],
    weather: 'rain',
    description: pick(
      'Tachetée de rouge et de noir, elle aime l’eau froide qui court sur les pierres.',
      'Speckled with red and black, it loves cold water running over stones.',
    ),
    variant: { name: pick('Truite arc-en-ciel', 'Rainbow Trout'), color: 0xe8a0c0 },
    colors: { body: 0xb59a5a, fins: 0xc8a070 },
  },
  {
    id: 'barbeau_gue',
    name: pick('Barbeau du gué', 'Ford Barbel'),
    place: 'river',
    rarity: 'uncommon',
    habitats: ['deep', 'rocks', 'open'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 30, max: 70 },
    difficulty: { strength: 0.55, burstFrequency: 0.25 },
    baits: ['worm', 'boilie', 'corn'],
    weather: 'mist',
    description: pick(
      'Il fouille le fond avec ses quatre barbillons, le nez toujours dans le courant.',
      'It rummages along the bottom with its four barbels, nose always into the current.',
    ),
    variant: { name: pick('Barbeau d’argent', 'Silver Barbel'), color: 0xdfe4e8 },
    colors: { body: 0x9c8a60, fins: 0xb07a50 },
  },
  {
    id: 'ombre_cascade',
    name: pick('Ombre des cascades', 'Waterfall Grayling'),
    place: 'river',
    rarity: 'rare',
    habitats: ['shallow', 'rocks'],
    times: ['dawn', 'day'],
    sizeCm: { min: 28, max: 55 },
    difficulty: { strength: 0.5, burstFrequency: 0.4 },
    baits: ['fly', 'maggot'],
    weather: 'mist',
    description: pick(
      'Sa grande nageoire dorsale, violette et mouchetée, se déploie comme un drapeau.',
      'Its tall dorsal fin, purple and speckled, unfurls like a flag.',
    ),
    variant: { name: pick('Ombre de soleil', 'Sun Grayling'), color: 0xf2c14e },
    colors: { body: 0x8c9aa8, fins: 0x8a5ca8 },
  },
  {
    id: 'anguille_lune',
    name: pick('Anguille de lune', 'Moon Eel'),
    place: 'river',
    rarity: 'legendary',
    habitats: ['deep', 'reeds'],
    times: ['night'],
    sizeCm: { min: 80, max: 150 },
    difficulty: { strength: 0.9, burstFrequency: 0.5 },
    baits: ['worm', 'spinner'],
    weather: 'rain',
    description: pick(
      'Longue et souple comme un ruban d’argent : on ne la voit que les nuits de lune.',
      'Long and supple as a silver ribbon: it only shows itself on moonlit nights.',
    ),
    variant: { name: pick('Anguille de verre', 'Glass Eel'), color: 0xcfe8e8 },
    colors: { body: 0x5a5a40, fins: 0x4a4a38 },
  },
  // --- La crique ---
  {
    id: 'maquereau_raye',
    name: pick('Maquereau rayé', 'Striped Mackerel'),
    place: 'cove',
    rarity: 'common',
    habitats: ['open', 'deep', 'shallow'],
    times: ['dawn', 'day', 'dusk'],
    sizeCm: { min: 20, max: 40 },
    difficulty: { strength: 0.3, burstFrequency: 0.4 },
    baits: ['spinner', 'fly'],
    weather: 'wind',
    description: pick(
      'Il file en bancs serrés, le dos zébré de vagues bleues et noires.',
      'It races along in tight shoals, its back striped with blue and black waves.',
    ),
    variant: { name: pick('Maquereau d’or', 'Golden Mackerel'), color: 0xe8c050 },
    colors: { body: 0x8fb8c0, fins: 0x7a9aa4 },
  },
  {
    id: 'rouget_corail',
    name: pick('Rouget corail', 'Coral Red Mullet'),
    place: 'cove',
    rarity: 'common',
    habitats: ['shallow', 'rocks', 'reeds'],
    times: ['dawn', 'day', 'dusk', 'night'],
    sizeCm: { min: 12, max: 30 },
    difficulty: { strength: 0.2, burstFrequency: 0.2 },
    baits: ['worm', 'maggot'],
    weather: 'clear',
    description: pick(
      'Rose comme un coquillage, il fouille le sable avec ses deux barbillons, de jour comme de nuit.',
      'Pink as a seashell, it sifts the sand with its two barbels, by day and by night.',
    ),
    variant: { name: pick('Rouget d’argent', 'Silver Red Mullet'), color: 0xe8ecf0 },
    colors: { body: 0xe88878, fins: 0xf0a080 },
  },
  {
    id: 'bar_ecume',
    name: pick('Bar d’écume', 'Surf Bass'),
    place: 'cove',
    rarity: 'uncommon',
    habitats: ['rocks', 'shallow', 'open', 'reeds', 'deep'],
    times: ['dawn', 'dusk', 'night'],
    sizeCm: { min: 30, max: 75 },
    difficulty: { strength: 0.55, burstFrequency: 0.35 },
    baits: ['spinner', 'worm'],
    weather: 'wind',
    description: pick(
      'Le loup des rochers : il chasse dans l’écume quand la mer se lève.',
      'The wolf of the rocks: it hunts in the foam when the sea gets up.',
    ),
    variant: { name: pick('Bar tigré', 'Tiger Bass'), color: 0xe0a050 },
    colors: { body: 0xb8c4cc, fins: 0x8a98a0 },
  },
  {
    id: 'daurade_doree',
    name: pick('Daurade dorée', 'Gilthead Bream'),
    place: 'cove',
    rarity: 'uncommon',
    habitats: ['shallow', 'reeds', 'open', 'deep'],
    times: ['day', 'dusk'],
    sizeCm: { min: 25, max: 55 },
    difficulty: { strength: 0.45, burstFrequency: 0.3 },
    baits: ['worm', 'boilie'],
    weather: 'clear',
    description: pick(
      'Un sourcil d’or entre les yeux : elle broie les coquillages de ses dents plates.',
      'A golden brow between its eyes: it crushes shellfish with its flat teeth.',
    ),
    variant: { name: pick('Daurade de nacre', 'Pearl Bream'), color: 0xf0e8f4 },
    colors: { body: 0xc8ccc8, fins: 0xa0a8a0 },
  },
  {
    id: 'vieille_arlequin',
    name: pick('Vieille arlequin', 'Harlequin Wrasse'),
    place: 'cove',
    rarity: 'rare',
    habitats: ['rocks', 'reeds'],
    times: ['dawn', 'day'],
    sizeCm: { min: 20, max: 45 },
    difficulty: { strength: 0.4, burstFrequency: 0.35 },
    baits: ['worm'],
    weather: 'rain',
    description: pick(
      'Tachetée d’orange et de vert, elle vit en ermite au creux des rochers.',
      'Dappled with orange and green, it lives as a hermit in the hollows of the rocks.',
    ),
    variant: { name: pick('Vieille de feu', 'Fire Wrasse'), color: 0xe86040 },
    colors: { body: 0x6aa878, fins: 0xe08a50 },
  },
  {
    id: 'espadon_marees',
    name: pick('Espadon des marées', 'Tide Swordfish'),
    place: 'cove',
    rarity: 'legendary',
    habitats: ['deep', 'open'],
    times: ['night'],
    sizeCm: { min: 150, max: 260 },
    difficulty: { strength: 1, burstFrequency: 0.45 },
    baits: ['spinner'],
    weather: 'mist',
    description: pick(
      'Son long rostre fend les vagues : on ne l’a vu que les nuits de lune, près des bouées.',
      'Its long bill slices through the waves: it has only been seen on moonlit nights, near the buoys.',
    ),
    variant: { name: pick('Espadon d’argent', 'Silver Swordfish'), color: 0xdfe6ee },
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
