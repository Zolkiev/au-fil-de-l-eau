import { pick } from '../core/language';
import type { BaitId } from './baits';
import type { PlaceId } from './places';

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
 * - Formes : coque de la barque, rames, chapeau. Chaque forme est un objet
 *   `skin_<emplacement>_<forme>` du modèle (voir src/scene/skins.ts et
 *   blender/petite_peche/props.py) ; celle à prix 0 est la forme d'origine.
 * - Objets exclusifs (`feat`) : ils ne s'achètent pas, ils se gagnent par
 *   un exploit (voir src/progression/feats.ts).
 */

export type ShopCategory = 'bait' | 'gear' | 'pen' | 'boat' | 'decor' | 'outfit';
/** Pièce de matériel : canne (tension), moulinet (vitesse), ligne (résistance). */
export type GearTrack = 'rod' | 'reel' | 'line';
/** Emplacements à couleur : la barque et son matériel, puis la tenue du pêcheur (bob, ciré, écharpe). */
export type DecorSlot = 'boatPaint' | 'bobber' | 'lantern' | 'hat' | 'coat' | 'scarf';
export const DECOR_SLOTS: readonly DecorSlot[] = ['boatPaint', 'bobber', 'lantern', 'hat', 'coat', 'scarf'];
/** Emplacements à forme : la coque de la barque, ses rames, le chapeau du pêcheur. */
export type SkinSlot = 'hull' | 'oars' | 'hatShape';
export const SKIN_SLOTS: readonly SkinSlot[] = ['hull', 'oars', 'hatShape'];
/** Tout emplacement où l'on choisit un objet parmi ceux qu'on possède (couleur ou forme). */
export type LookSlot = DecorSlot | SkinSlot;
export const LOOK_SLOTS: readonly LookSlot[] = [...DECOR_SLOTS, ...SKIN_SLOTS];
/** Emplacements de la barque et de ses rames, puis du pêcheur (rangés à part dans la boutique). */
const BOAT_SLOTS: readonly LookSlot[] = ['hull', 'oars', 'boatPaint'];
const OUTFIT_SLOTS: readonly LookSlot[] = ['hatShape', 'hat', 'coat', 'scarf'];

/** Exploit qui fait gagner un objet exclusif (sa progression : src/progression/feats.ts). */
export type Feat =
  /** Attraper le légendaire du lieu. */
  | { readonly kind: 'legend'; readonly place: PlaceId }
  /** Rapporter toutes les trouvailles du lieu à Moustache. */
  | { readonly kind: 'finds'; readonly place: PlaceId }
  /** Gagner ce nombre d'étoiles de maîtrise. */
  | { readonly kind: 'stars'; readonly count: number }
  /** Attraper toutes les espèces. */
  | { readonly kind: 'journal' }
  /** Pêcher ce nombre de jours différents (tampons du carnet de bord). */
  | { readonly kind: 'stamps'; readonly count: number };

export type ShopEffect =
  | { readonly kind: 'bait'; readonly bait: BaitId }
  /**
   * `factor` multiplie, selon la pièce : la montée de tension (canne), la
   * vitesse de remontée (moulinet) ou le temps avant la casse (ligne).
   */
  | { readonly kind: 'gear'; readonly track: GearTrack; readonly factor: number }
  /** Nombre de places du vivier (remplace CONFIG.pen.capacity). */
  | { readonly kind: 'pen'; readonly capacity: number }
  | { readonly kind: 'decor'; readonly slot: DecorSlot; readonly color: number }
  /** `shape` : la fin du nom de l'objet dans le modèle (`skin_hull_canoe` → « canoe »). */
  | { readonly kind: 'skin'; readonly slot: SkinSlot; readonly shape: string };

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
  /** Objet exclusif : il ne s'achète pas, il se gagne en accomplissant cet exploit. */
  readonly feat?: Feat;
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

  // --- Barque : coques ---
  skin('hull_classic', pick('Barque de pêche', 'Fishing boat'), '🚣', pick('La barque de toujours, ronde et stable.', 'The same old boat, round and steady.'), 0, 'hull', 'classic'),
  skin('hull_canoe', pick('Canoë', 'Canoe'), '🛶', pick('Long, fin, pointu aux deux bouts : il a l’air de filer tout seul.', 'Long, slender, pointed at both ends: it looks as if it glides by itself.'), 30, 'hull', 'canoe'),
  skin('hull_punt', pick('Barque plate', 'Flat-bottomed punt'), '🛥️', pick('Fond plat et nez carré, comme sur les marais.', 'Flat bottom and square nose, like the boats of the marshes.'), 30, 'hull', 'punt'),
  {
    ...skin('hull_drakkar', pick('Petit drakkar', 'Little longship'), '🐉', pick('Tête de dragon, boucliers et queue enroulée : même le silure s’incline.', 'Dragon head, shields and a curled tail: even the catfish bows.'), 0, 'hull', 'drakkar'),
    feat: { kind: 'legend', place: 'lake' },
  },

  // --- Barque : rames ---
  skin('oars_classic', pick('Rames de bois', 'Wooden oars'), '🪵', pick('Simples et solides, peintes comme la barque.', 'Plain and sturdy, painted like the boat.'), 0, 'oars', 'classic'),
  skin('oars_leaf', pick('Pagaies feuille', 'Leaf paddles'), '🍃', pick('Des pelles en forme de feuille de saule.', 'Blades shaped like willow leaves.'), 12, 'oars', 'leaf'),
  {
    ...skin('oars_fishtail', pick('Rames queue de poisson', 'Fishtail oars'), '🐠', pick('Manche doré, pelles en queue de poisson : on dirait qu’elles nagent.', 'Golden shafts, fishtail blades: they almost seem to swim.'), 0, 'oars', 'fishtail'),
    feat: { kind: 'legend', place: 'river' },
  },

  // --- Barque : peinture ---
  decor('paint_teal', pick('Barque bleu-vert', 'Teal boat'), pick('La couleur d’origine de la barque.', 'The boat’s original colour.'), 0, 'boatPaint', 0x6aa9a8),
  decor('paint_brick', pick('Barque rouge brique', 'Brick-red boat'), pick('Un rouge chaud de vieille ferme.', 'A warm red, like an old farmhouse.'), 8, 'boatPaint', 0xb5523b),
  decor('paint_sunflower', pick('Barque tournesol', 'Sunflower boat'), pick('Un jaune qui se voit de l’autre bout du lac.', 'A yellow you can spot from the far end of the lake.'), 8, 'boatPaint', 0xe8b84a),
  decor('paint_night', pick('Barque bleu nuit', 'Midnight-blue boat'), pick('Pour les pêcheurs de minuit.', 'For midnight anglers.'), 10, 'boatPaint', 0x3f5f8f),
  decor('paint_candy', pick('Barque rose bonbon', 'Candy-pink boat'), pick('Moustache trouve ça très chic.', 'Moustache finds it very smart.'), 10, 'boatPaint', 0xe79bb0),
  {
    ...decor('paint_pearl', pick('Barque nacrée', 'Pearly boat'), pick('Blanche et douce comme l’intérieur d’un coquillage.', 'White and soft as the inside of a seashell.'), 0, 'boatPaint', 0xf1ece4),
    feat: { kind: 'finds', place: 'cove' },
  },

  // --- Décoration : bouchon ---
  decor('bobber_red', pick('Bouchon rouge', 'Red bobber'), pick('Le classique.', 'The classic.'), 0, 'bobber', 0xe0483c),
  decor('bobber_yellow', pick('Bouchon jaune', 'Yellow bobber'), pick('Bien visible sur l’eau sombre.', 'Easy to see on dark water.'), 5, 'bobber', 0xf2c230),
  decor('bobber_green', pick('Bouchon vert pomme', 'Apple-green bobber'), pick('Acidulé.', 'Tangy.'), 5, 'bobber', 0x7cc242),
  decor('bobber_purple', pick('Bouchon violet', 'Purple bobber'), pick('Un petit air de prune.', 'A hint of plum.'), 6, 'bobber', 0x8e5cc4),
  {
    ...decor('bobber_gold', pick('Bouchon doré', 'Golden bobber'), pick('Il brille comme un trésor repêché.', 'It shines like treasure fished from the deep.'), 0, 'bobber', 0xf0c040),
    feat: { kind: 'finds', place: 'lake' },
  },

  // --- Décoration : lanterne ---
  decor('lantern_amber', pick('Lanterne ambre', 'Amber lantern'), pick('La lueur d’origine, chaude comme une bougie.', 'The original glow, warm as a candle.'), 0, 'lantern', 0xffc27a),
  decor('lantern_moon', pick('Lanterne bleu lune', 'Moon-blue lantern'), pick('Une lumière fraîche de clair de lune.', 'A cool, moonlit light.'), 8, 'lantern', 0x9fc4ff),
  decor('lantern_rose', pick('Lanterne rose', 'Pink lantern'), pick('Douce et rêveuse.', 'Soft and dreamy.'), 8, 'lantern', 0xff9fc8),
  decor('lantern_firefly', pick('Lanterne luciole', 'Firefly lantern'), pick('Verte comme les lucioles des roseaux.', 'Green like the fireflies in the reeds.'), 10, 'lantern', 0xc8ff9f),
  {
    ...decor('lantern_nugget', pick('Lanterne pépite', 'Nugget lantern'), pick('Une lueur d’or, comme au pied de la cascade.', 'A golden glow, like at the foot of the waterfall.'), 0, 'lantern', 0xffd75e),
    feat: { kind: 'finds', place: 'river' },
  },

  // --- Tenue du pêcheur : chapeau (forme) ---
  skin('headwear_bob', pick('Bob', 'Bucket hat'), '👒', pick('Le bob de toujours.', 'The same old bucket hat.'), 0, 'hatShape', 'bob'),
  skin('headwear_cap', pick('Casquette', 'Cap'), '🧢', pick('Une visière contre le soleil du matin.', 'A peak against the morning sun.'), 12, 'hatShape', 'cap'),
  skin('headwear_straw', pick('Chapeau de paille', 'Wide-brimmed hat'), '👒', pick('Un bord très large, pour les après-midi de plein soleil.', 'A very wide brim, for afternoons in full sun.'), 15, 'hatShape', 'straw'),
  skin('headwear_beanie', pick('Bonnet à pompon', 'Bobble hat'), '🧶', pick('Bien chaud pour les nuits de pêche.', 'Nice and warm for nights of fishing.'), 15, 'hatShape', 'beanie'),
  {
    ...skin('headwear_captain', pick('Casquette de capitaine', 'Captain’s cap'), '⚓', pick('Blanche, à écusson doré : celle de qui a dompté l’espadon.', 'White, with a golden badge: for the one who tamed the swordfish.'), 0, 'hatShape', 'captain'),
    feat: { kind: 'legend', place: 'cove' },
  },

  // --- Tenue du pêcheur : chapeau (couleur) ---
  decor('hat_khaki', pick('Chapeau kaki', 'Khaki hat'), pick('La couleur de toujours, un peu délavée.', 'The same old colour, a little faded.'), 0, 'hat', 0x6f7d4a),
  decor('hat_navy', pick('Chapeau marine', 'Navy hat'), pick('Bleu comme le large.', 'Blue as the open sea.'), 6, 'hat', 0x3d5a80),
  decor('hat_straw', pick('Chapeau paille', 'Straw-coloured hat'), pick('Clair et léger.', 'Pale and light.'), 6, 'hat', 0xe3c779),
  decor('hat_cherry', pick('Chapeau cerise', 'Cherry hat'), pick('On le repère de l’autre rive.', 'You can spot it from the far shore.'), 8, 'hat', 0xc8463a),
  decor('hat_lilac', pick('Chapeau lilas', 'Lilac hat'), pick('Moustache dit que ça te va bien.', 'Moustache says it suits you.'), 8, 'hat', 0xa68bd0),
  {
    ...decor('hat_dawn', pick('Chapeau soleil levant', 'Sunrise hat'), pick('Orange comme le lac au petit matin : pour qui revient souvent.', 'Orange like the lake at daybreak: for those who keep coming back.'), 0, 'hat', 0xf08a3c),
    feat: { kind: 'stamps', count: 7 },
  },

  // --- Tenue du pêcheur : ciré ---
  decor('coat_mustard', pick('Ciré moutarde', 'Mustard raincoat'), pick('Le ciré d’origine, jaune comme il se doit.', 'The original raincoat, yellow as it should be.'), 0, 'coat', 0xe0a83a),
  decor('coat_red', pick('Ciré rouge', 'Red raincoat'), pick('Un rouge de bouée, pour les jours de brume.', 'Buoy red, for misty days.'), 8, 'coat', 0xc8463a),
  decor('coat_navy', pick('Ciré marine', 'Navy raincoat'), pick('Sobre, façon vieux loup de mer.', 'Sober, old sea dog style.'), 8, 'coat', 0x3d5a80),
  decor('coat_fir', pick('Ciré vert sapin', 'Fir-green raincoat'), pick('Pour se fondre dans la forêt.', 'To blend into the forest.'), 10, 'coat', 0x4f8a67),
  decor('coat_rose', pick('Ciré rose', 'Pink raincoat'), pick('Assorti à la barque rose bonbon.', 'Goes with the candy-pink boat.'), 10, 'coat', 0xe79bb0),
  {
    ...decor('coat_master', pick('Ciré du grand pêcheur', 'Master angler’s raincoat'), pick('Violet profond : il se mérite, espèce après espèce.', 'Deep purple: it is earned, species after species.'), 0, 'coat', 0x5b3f8f),
    feat: { kind: 'journal' },
  },

  // --- Tenue du pêcheur : écharpe ---
  decor('scarf_red', pick('Écharpe rouge', 'Red scarf'), pick('Tricotée main, il paraît.', 'Hand-knitted, apparently.'), 0, 'scarf', 0xb8483c),
  decor('scarf_sky', pick('Écharpe bleu ciel', 'Sky-blue scarf'), pick('Douce comme un matin clair.', 'Soft as a clear morning.'), 5, 'scarf', 0x7fb6e0),
  decor('scarf_cream', pick('Écharpe écrue', 'Cream scarf'), pick('En grosse laine.', 'In chunky wool.'), 5, 'scarf', 0xf2ead8),
  decor('scarf_apple', pick('Écharpe vert pomme', 'Apple-green scarf'), pick('Acidulée, comme le bouchon.', 'Tangy, like the bobber.'), 6, 'scarf', 0x7cc242),
  decor('scarf_plum', pick('Écharpe prune', 'Plum scarf'), pick('Chaude, pour les nuits de pleine lune.', 'Warm, for full-moon nights.'), 6, 'scarf', 0x8e5cc4),
  {
    ...decor('scarf_star', pick('Écharpe étoilée', 'Starry scarf'), pick('Jaune d’or : celle des pêcheurs qui connaissent leurs poissons.', 'Golden yellow: for anglers who know their fish.'), 0, 'scarf', 0xf2c230),
    feat: { kind: 'stars', count: 30 },
  },
];

/** Objet de la boutique par identifiant. */
export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}

/** Emplacement où l'objet se choisit (couleur ou forme) ; null pour un appât, du matériel ou le vivier. */
export function lookSlot(item: ShopItem): LookSlot | null {
  return item.effect.kind === 'decor' || item.effect.kind === 'skin' ? item.effect.slot : null;
}

/** Catégorie d'un objet, d'après son effet (la barque et la tenue du pêcheur ont leur propre section). */
export function categoryOf(item: ShopItem): ShopCategory {
  const { effect } = item;
  if (effect.kind !== 'decor' && effect.kind !== 'skin') return effect.kind;
  if (BOAT_SLOTS.includes(effect.slot)) return 'boat';
  return OUTFIT_SLOTS.includes(effect.slot) ? 'outfit' : 'decor';
}

function skin(id: string, name: string, icon: string, description: string, price: number, slot: SkinSlot, shape: string): ShopItem {
  return { id, name, icon, description, price, effect: { kind: 'skin', slot, shape } };
}

function decor(id: string, name: string, description: string, price: number, slot: DecorSlot, color: number): ShopItem {
  return { id, name, icon: DECOR_ICONS[slot], description, price, effect: { kind: 'decor', slot, color } };
}
