import { pick } from '../core/language';
import type { BaitId } from './baits';

/**
 * Boutique de la cabane de Moustache : ce qu'on achète avec les coquillages
 * gagnés au carnet et aux demandes (voir src/progression/).
 *
 * - Appâts : ajoutent un appât à la barre (touches 4 à 6).
 * - Matériel : deux niveaux par pièce ; le niveau 2 remplace le niveau 1
 *   (il doit venir après dans la liste).
 * - Vivier : plus de places pour garder ses poissons.
 * - Décoration et tenue du pêcheur : une couleur par emplacement. La
 *   couleur à prix 0 est celle d'origine du modèle : c'est elle que le jeu
 *   cherche pour la repeindre (si tu changes la couleur dans Blender,
 *   change-la aussi ici).
 */

export type ShopCategory = 'bait' | 'gear' | 'pen' | 'decor' | 'outfit';
/** Pièce de matériel : canne (tension), moulinet (vitesse), ligne (résistance). */
export type GearTrack = 'rod' | 'reel' | 'line';
/** Emplacements à couleur : la barque et son matériel, puis la tenue du pêcheur (bob, ciré, écharpe). */
export type DecorSlot = 'boatPaint' | 'bobber' | 'lantern' | 'hat' | 'coat' | 'scarf';
export const DECOR_SLOTS: readonly DecorSlot[] = ['boatPaint', 'bobber', 'lantern', 'hat', 'coat', 'scarf'];
/** Emplacements qui habillent le pêcheur (rangés à part dans la boutique). */
const OUTFIT_SLOTS: readonly DecorSlot[] = ['hat', 'coat', 'scarf'];

export type ShopEffect =
  | { readonly kind: 'bait'; readonly bait: BaitId }
  /**
   * `factor` multiplie, selon la pièce : la montée de tension (canne), la
   * vitesse de remontée (moulinet) ou le temps avant la casse (ligne).
   */
  | { readonly kind: 'gear'; readonly track: GearTrack; readonly factor: number }
  /** Nombre de places du vivier (remplace CONFIG.pen.capacity). */
  | { readonly kind: 'pen'; readonly capacity: number }
  | { readonly kind: 'decor'; readonly slot: DecorSlot; readonly color: number };

export interface ShopItem {
  /** Identifiant stable (clé de sauvegarde). */
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  /** Prix en coquillages (0 = possédé dès le départ). */
  readonly price: number;
  /** Objet à posséder avant de pouvoir acheter celui-ci. */
  readonly requires?: string;
  readonly effect: ShopEffect;
}

/** Icône des objets de décoration, par emplacement. */
const DECOR_ICONS: Record<DecorSlot, string> = { boatPaint: '🎨', bobber: '🔴', lantern: '🏮', hat: '🧢', coat: '🧥', scarf: '🧣' };

export const SHOP_ITEMS: readonly ShopItem[] = [
  // --- Appâts ---
  {
    id: 'bait_spinner',
    name: pick('Cuillère brillante', 'Shiny spinner'),
    icon: '🥄',
    description: pick('Un leurre pour les chasseurs : perche, sandre, brochet… et peut-être le silure.', 'A lure for the hunters: perch, zander, pike… and perhaps the catfish.'),
    price: 15,
    effect: { kind: 'bait', bait: 'spinner' },
  },
  {
    id: 'bait_boilie',
    name: pick('Bouillette parfumée', 'Scented boilie'),
    icon: '🍡',
    description: pick('Carpe, tanche et brème en raffolent, et les prises sont plus grosses.', 'Carp, tench and bream are mad about it, and catches are bigger.'),
    price: 20,
    effect: { kind: 'bait', bait: 'boilie' },
  },
  {
    id: 'bait_fly',
    name: pick('Mouche dorée', 'Golden fly'),
    icon: '🪰',
    description: pick('Les petits poissons de surface l’adorent, et les variantes rares sortent plus souvent.', 'Small surface fish adore it, and rare variants turn up more often.'),
    price: 30,
    effect: { kind: 'bait', bait: 'fly' },
  },

  // --- Matériel ---
  {
    id: 'rod_1',
    name: pick('Canne souple', 'Supple rod'),
    icon: '🎣',
    description: pick('La tension monte 15 % moins vite quand tu moulines.', 'Tension rises 15% more slowly when you reel in.'),
    price: 12,
    effect: { kind: 'gear', track: 'rod', factor: 0.85 },
  },
  {
    id: 'rod_2',
    name: pick('Canne en bambou refendu', 'Split-cane bamboo rod'),
    icon: '🎋',
    description: pick('La tension monte 30 % moins vite.', 'Tension rises 30% more slowly.'),
    price: 30,
    requires: 'rod_1',
    effect: { kind: 'gear', track: 'rod', factor: 0.7 },
  },
  {
    id: 'reel_1',
    name: pick('Moulinet huilé', 'Oiled reel'),
    icon: '⚙️',
    description: pick('Le poisson remonte 15 % plus vite.', 'The fish comes in 15% faster.'),
    price: 12,
    effect: { kind: 'gear', track: 'reel', factor: 1.15 },
  },
  {
    id: 'reel_2',
    name: pick('Moulinet de maître', 'Master’s reel'),
    icon: '🌀',
    description: pick('Le poisson remonte 30 % plus vite.', 'The fish comes in 30% faster.'),
    price: 30,
    requires: 'reel_1',
    effect: { kind: 'gear', track: 'reel', factor: 1.3 },
  },
  {
    id: 'line_1',
    name: pick('Ligne tressée', 'Braided line'),
    icon: '🧵',
    description: pick('À tension maximale, la ligne tient 30 % plus longtemps avant de casser.', 'At full tension, the line holds 30% longer before it snaps.'),
    price: 10,
    effect: { kind: 'gear', track: 'line', factor: 1.3 },
  },
  {
    id: 'line_2',
    name: pick('Ligne de soie', 'Silk line'),
    icon: '🪢',
    description: pick('À tension maximale, la ligne tient 60 % plus longtemps.', 'At full tension, the line holds 60% longer.'),
    price: 25,
    requires: 'line_1',
    effect: { kind: 'gear', track: 'line', factor: 1.6 },
  },

  // --- Vivier ---
  {
    id: 'pen_large',
    name: pick('Vivier agrandi', 'Bigger fish pen'),
    icon: '🪣',
    description: pick('Moustache rallonge le bac : 10 places au lieu de 5 pour tes plus belles prises.', 'Moustache extends the tub: 10 places instead of 5 for your finest catches.'),
    price: 20,
    effect: { kind: 'pen', capacity: 10 },
  },

  // --- Décoration : peinture de la barque ---
  decor('paint_teal', pick('Barque bleu-vert', 'Teal boat'), pick('La couleur d’origine de la barque.', 'The boat’s original colour.'), 0, 'boatPaint', 0x6aa9a8),
  decor('paint_brick', pick('Barque rouge brique', 'Brick-red boat'), pick('Un rouge chaud de vieille ferme.', 'A warm red, like an old farmhouse.'), 8, 'boatPaint', 0xb5523b),
  decor('paint_sunflower', pick('Barque tournesol', 'Sunflower boat'), pick('Un jaune qui se voit de l’autre bout du lac.', 'A yellow you can spot from the far end of the lake.'), 8, 'boatPaint', 0xe8b84a),
  decor('paint_night', pick('Barque bleu nuit', 'Midnight-blue boat'), pick('Pour les pêcheurs de minuit.', 'For midnight anglers.'), 10, 'boatPaint', 0x3f5f8f),
  decor('paint_candy', pick('Barque rose bonbon', 'Candy-pink boat'), pick('Moustache trouve ça très chic.', 'Moustache finds it very smart.'), 10, 'boatPaint', 0xe79bb0),

  // --- Décoration : bouchon ---
  decor('bobber_red', pick('Bouchon rouge', 'Red bobber'), pick('Le classique.', 'The classic.'), 0, 'bobber', 0xe0483c),
  decor('bobber_yellow', pick('Bouchon jaune', 'Yellow bobber'), pick('Bien visible sur l’eau sombre.', 'Easy to see on dark water.'), 5, 'bobber', 0xf2c230),
  decor('bobber_green', pick('Bouchon vert pomme', 'Apple-green bobber'), pick('Acidulé.', 'Tangy.'), 5, 'bobber', 0x7cc242),
  decor('bobber_purple', pick('Bouchon violet', 'Purple bobber'), pick('Un petit air de prune.', 'A hint of plum.'), 6, 'bobber', 0x8e5cc4),

  // --- Décoration : lanterne ---
  decor('lantern_amber', pick('Lanterne ambre', 'Amber lantern'), pick('La lueur d’origine, chaude comme une bougie.', 'The original glow, warm as a candle.'), 0, 'lantern', 0xffc27a),
  decor('lantern_moon', pick('Lanterne bleu lune', 'Moon-blue lantern'), pick('Une lumière fraîche de clair de lune.', 'A cool, moonlit light.'), 8, 'lantern', 0x9fc4ff),
  decor('lantern_rose', pick('Lanterne rose', 'Pink lantern'), pick('Douce et rêveuse.', 'Soft and dreamy.'), 8, 'lantern', 0xff9fc8),
  decor('lantern_firefly', pick('Lanterne luciole', 'Firefly lantern'), pick('Verte comme les lucioles des roseaux.', 'Green like the fireflies in the reeds.'), 10, 'lantern', 0xc8ff9f),

  // --- Tenue du pêcheur : bob ---
  decor('hat_khaki', pick('Bob kaki', 'Khaki bucket hat'), pick('Le bob de toujours, un peu délavé.', 'The same old hat, a little faded.'), 0, 'hat', 0x6f7d4a),
  decor('hat_navy', pick('Bob marine', 'Navy bucket hat'), pick('Bleu comme le large.', 'Blue as the open sea.'), 6, 'hat', 0x3d5a80),
  decor('hat_straw', pick('Bob paille', 'Straw bucket hat'), pick('Clair et léger, pour les après-midi de plein soleil.', 'Pale and light, for afternoons in full sun.'), 6, 'hat', 0xe3c779),
  decor('hat_cherry', pick('Bob cerise', 'Cherry bucket hat'), pick('On le repère de l’autre rive.', 'You can spot it from the far shore.'), 8, 'hat', 0xc8463a),
  decor('hat_lilac', pick('Bob lilas', 'Lilac bucket hat'), pick('Moustache dit que ça te va bien.', 'Moustache says it suits you.'), 8, 'hat', 0xa68bd0),

  // --- Tenue du pêcheur : ciré ---
  decor('coat_mustard', pick('Ciré moutarde', 'Mustard raincoat'), pick('Le ciré d’origine, jaune comme il se doit.', 'The original raincoat, yellow as it should be.'), 0, 'coat', 0xe0a83a),
  decor('coat_red', pick('Ciré rouge', 'Red raincoat'), pick('Un rouge de bouée, pour les jours de brume.', 'Buoy red, for misty days.'), 8, 'coat', 0xc8463a),
  decor('coat_navy', pick('Ciré marine', 'Navy raincoat'), pick('Sobre, façon vieux loup de mer.', 'Sober, old sea dog style.'), 8, 'coat', 0x3d5a80),
  decor('coat_fir', pick('Ciré vert sapin', 'Fir-green raincoat'), pick('Pour se fondre dans la forêt.', 'To blend into the forest.'), 10, 'coat', 0x4f8a67),
  decor('coat_rose', pick('Ciré rose', 'Pink raincoat'), pick('Assorti à la barque rose bonbon.', 'Goes with the candy-pink boat.'), 10, 'coat', 0xe79bb0),

  // --- Tenue du pêcheur : écharpe ---
  decor('scarf_red', pick('Écharpe rouge', 'Red scarf'), pick('Tricotée main, il paraît.', 'Hand-knitted, apparently.'), 0, 'scarf', 0xb8483c),
  decor('scarf_sky', pick('Écharpe bleu ciel', 'Sky-blue scarf'), pick('Douce comme un matin clair.', 'Soft as a clear morning.'), 5, 'scarf', 0x7fb6e0),
  decor('scarf_cream', pick('Écharpe écrue', 'Cream scarf'), pick('En grosse laine.', 'In chunky wool.'), 5, 'scarf', 0xf2ead8),
  decor('scarf_apple', pick('Écharpe vert pomme', 'Apple-green scarf'), pick('Acidulée, comme le bouchon.', 'Tangy, like the bobber.'), 6, 'scarf', 0x7cc242),
  decor('scarf_plum', pick('Écharpe prune', 'Plum scarf'), pick('Chaude, pour les nuits de pleine lune.', 'Warm, for full-moon nights.'), 6, 'scarf', 0x8e5cc4),
];

/** Objet de la boutique par identifiant. */
export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}

/** Catégorie d'un objet, d'après son effet (la tenue du pêcheur a sa propre section). */
export function categoryOf(item: ShopItem): ShopCategory {
  if (item.effect.kind === 'decor' && OUTFIT_SLOTS.includes(item.effect.slot)) return 'outfit';
  return item.effect.kind;
}

function decor(id: string, name: string, description: string, price: number, slot: DecorSlot, color: number): ShopItem {
  return { id, name, icon: DECOR_ICONS[slot], description, price, effect: { kind: 'decor', slot, color } };
}
