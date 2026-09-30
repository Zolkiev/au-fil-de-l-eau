import type { BaitId } from './baits';

/**
 * Boutique de la cabane de Moustache : ce qu'on achète avec les coquillages
 * gagnés au carnet et aux demandes (voir src/progression/).
 *
 * - Appâts : ajoutent un appât à la barre (touches 4 à 6).
 * - Matériel : deux niveaux par pièce ; le niveau 2 remplace le niveau 1
 *   (il doit venir après dans la liste).
 * - Vivier : plus de places pour garder ses poissons.
 * - Décoration : une couleur par emplacement. La couleur à prix 0 est celle
 *   d'origine du modèle : c'est elle que le jeu cherche pour la repeindre
 *   (si tu changes la couleur dans Blender, change-la aussi ici).
 */

export type ShopCategory = 'bait' | 'gear' | 'pen' | 'decor';
/** Pièce de matériel : canne (tension), moulinet (vitesse), ligne (résistance). */
export type GearTrack = 'rod' | 'reel' | 'line';
export type DecorSlot = 'boatPaint' | 'bobber' | 'lantern';

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
const DECOR_ICONS: Record<DecorSlot, string> = { boatPaint: '🎨', bobber: '🔴', lantern: '🏮' };

export const SHOP_ITEMS: readonly ShopItem[] = [
  // --- Appâts ---
  {
    id: 'bait_spinner',
    name: 'Cuillère brillante',
    icon: '🥄',
    description: 'Un leurre pour les chasseurs : perche, sandre, brochet… et peut-être le silure.',
    price: 15,
    effect: { kind: 'bait', bait: 'spinner' },
  },
  {
    id: 'bait_boilie',
    name: 'Bouillette parfumée',
    icon: '🍡',
    description: 'Carpe, tanche et brème en raffolent, et les prises sont plus grosses.',
    price: 20,
    effect: { kind: 'bait', bait: 'boilie' },
  },
  {
    id: 'bait_fly',
    name: 'Mouche dorée',
    icon: '🪰',
    description: 'Les petits poissons de surface l’adorent, et les variantes rares sortent plus souvent.',
    price: 30,
    effect: { kind: 'bait', bait: 'fly' },
  },

  // --- Matériel ---
  {
    id: 'rod_1',
    name: 'Canne souple',
    icon: '🎣',
    description: 'La tension monte 15 % moins vite quand tu moulines.',
    price: 12,
    effect: { kind: 'gear', track: 'rod', factor: 0.85 },
  },
  {
    id: 'rod_2',
    name: 'Canne en bambou refendu',
    icon: '🎋',
    description: 'La tension monte 30 % moins vite.',
    price: 30,
    requires: 'rod_1',
    effect: { kind: 'gear', track: 'rod', factor: 0.7 },
  },
  {
    id: 'reel_1',
    name: 'Moulinet huilé',
    icon: '⚙️',
    description: 'Le poisson remonte 15 % plus vite.',
    price: 12,
    effect: { kind: 'gear', track: 'reel', factor: 1.15 },
  },
  {
    id: 'reel_2',
    name: 'Moulinet de maître',
    icon: '🌀',
    description: 'Le poisson remonte 30 % plus vite.',
    price: 30,
    requires: 'reel_1',
    effect: { kind: 'gear', track: 'reel', factor: 1.3 },
  },
  {
    id: 'line_1',
    name: 'Ligne tressée',
    icon: '🧵',
    description: 'À tension maximale, la ligne tient 30 % plus longtemps avant de casser.',
    price: 10,
    effect: { kind: 'gear', track: 'line', factor: 1.3 },
  },
  {
    id: 'line_2',
    name: 'Ligne de soie',
    icon: '🪢',
    description: 'À tension maximale, la ligne tient 60 % plus longtemps.',
    price: 25,
    requires: 'line_1',
    effect: { kind: 'gear', track: 'line', factor: 1.6 },
  },

  // --- Vivier ---
  {
    id: 'pen_large',
    name: 'Vivier agrandi',
    icon: '🪣',
    description: 'Moustache rallonge le bac : 10 places au lieu de 5 pour tes plus belles prises.',
    price: 20,
    effect: { kind: 'pen', capacity: 10 },
  },

  // --- Décoration : peinture de la barque ---
  decor('paint_teal', 'Barque bleu-vert', 'La couleur d’origine de la barque.', 0, 'boatPaint', 0x6aa9a8),
  decor('paint_brick', 'Barque rouge brique', 'Un rouge chaud de vieille ferme.', 8, 'boatPaint', 0xb5523b),
  decor('paint_sunflower', 'Barque tournesol', 'Un jaune qui se voit de l’autre bout du lac.', 8, 'boatPaint', 0xe8b84a),
  decor('paint_night', 'Barque bleu nuit', 'Pour les pêcheurs de minuit.', 10, 'boatPaint', 0x3f5f8f),
  decor('paint_candy', 'Barque rose bonbon', 'Moustache trouve ça très chic.', 10, 'boatPaint', 0xe79bb0),

  // --- Décoration : bouchon ---
  decor('bobber_red', 'Bouchon rouge', 'Le classique.', 0, 'bobber', 0xe0483c),
  decor('bobber_yellow', 'Bouchon jaune', 'Bien visible sur l’eau sombre.', 5, 'bobber', 0xf2c230),
  decor('bobber_green', 'Bouchon vert pomme', 'Acidulé.', 5, 'bobber', 0x7cc242),
  decor('bobber_purple', 'Bouchon violet', 'Un petit air de prune.', 6, 'bobber', 0x8e5cc4),

  // --- Décoration : lanterne ---
  decor('lantern_amber', 'Lanterne ambre', 'La lueur d’origine, chaude comme une bougie.', 0, 'lantern', 0xffc27a),
  decor('lantern_moon', 'Lanterne bleu lune', 'Une lumière fraîche de clair de lune.', 8, 'lantern', 0x9fc4ff),
  decor('lantern_rose', 'Lanterne rose', 'Douce et rêveuse.', 8, 'lantern', 0xff9fc8),
  decor('lantern_firefly', 'Lanterne luciole', 'Verte comme les lucioles des roseaux.', 10, 'lantern', 0xc8ff9f),
];

/** Objet de la boutique par identifiant. */
export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}

/** Catégorie d'un objet, d'après son effet. */
export function categoryOf(item: ShopItem): ShopCategory {
  return item.effect.kind;
}

function decor(id: string, name: string, description: string, price: number, slot: DecorSlot, color: number): ShopItem {
  return { id, name, icon: DECOR_ICONS[slot], description, price, effect: { kind: 'decor', slot, color } };
}
