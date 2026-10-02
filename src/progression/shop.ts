import { CONFIG } from '../config';
import { readNumber, readObject } from '../core/validate';
import { baitById, type BaitId } from '../data/baits';
import { LOOK_SLOTS, lookSlot, SHOP_ITEMS, shopItemById, type DecorSlot, type GearTrack, type LookSlot, type ShopItem, type SkinSlot } from '../data/shop';
import { BASIC_GEAR, type Gear } from '../fishing/reelFight';

/** Ce qu'on peut faire d'un objet de la boutique. */
export type ItemStatus =
  /** Assez de coquillages : on peut l'acheter. */
  | 'buyable'
  /** Pas encore assez de coquillages. */
  | 'tooExpensive'
  /** Il faut d'abord acheter l'objet précédent (matériel niveau 2). */
  | 'locked'
  /** Objet exclusif pas encore gagné : il ne s'achète pas, il faut accomplir son exploit. */
  | 'feat'
  /** Déjà possédé (appât, matériel). */
  | 'owned'
  /** Couleur ou forme possédée, pas utilisée : on peut la choisir. */
  | 'equipable'
  /** Couleur ou forme utilisée en ce moment. */
  | 'equipped';

/** Une apparence : la couleur et la forme de chaque emplacement (ce que `Decor` applique aux modèles). */
export interface Look {
  decorColor(slot: DecorSlot): number;
  skinShape(slot: SkinSlot): string;
}

/** Correspondance pièce de matériel → réglage du combat qu'elle améliore. */
const GEAR_KEYS: Record<GearTrack, keyof Gear> = { rod: 'tensionRise', reel: 'reelSpeed', line: 'breakTime' };

/**
 * Boutique de la cabane : objets achetés ou gagnés, couleurs et formes
 * utilisées, coquillages dépensés (sauvegardés). Le solde lui-même est
 * calculé par Progression.
 */
export class Shop implements Look {
  private readonly owned = new Set<string>();
  private readonly equipped = new Map<LookSlot, string>();
  private spentShells = 0;

  constructor() {
    for (const item of SHOP_ITEMS) if (isOriginal(item)) this.owned.add(item.id);
    for (const slot of LOOK_SLOTS) this.equipped.set(slot, defaultLook(slot).id);
  }

  /** Reconstruit la boutique depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Shop {
    const raw = readObject(value);
    const shop = new Shop();
    if (Array.isArray(raw.owned)) {
      for (const id of raw.owned) if (typeof id === 'string' && shopItemById(id)) shop.owned.add(id);
    }
    const equipped = readObject(raw.equipped);
    for (const slot of LOOK_SLOTS) {
      const item = typeof equipped[slot] === 'string' ? shopItemById(equipped[slot]) : undefined;
      if (item && shop.owned.has(item.id) && lookSlot(item) === slot) shop.equipped.set(slot, item.id);
    }
    shop.spentShells = readNumber(raw.spent, 0, 0);
    return shop;
  }

  get spent(): number {
    return this.spentShells;
  }

  owns(item: ShopItem): boolean {
    return this.owned.has(item.id);
  }

  status(item: ShopItem, shells: number): ItemStatus {
    const slot = lookSlot(item);
    if (this.owns(item)) {
      if (slot === null) return 'owned';
      return this.equipped.get(slot) === item.id ? 'equipped' : 'equipable';
    }
    if (item.feat) return 'feat';
    if (item.requires && !this.owned.has(item.requires)) return 'locked';
    return shells >= item.price ? 'buyable' : 'tooExpensive';
  }

  /** Achète l'objet (une couleur ou une forme achetée est aussitôt utilisée). Retourne false si impossible. */
  buy(item: ShopItem, shells: number): boolean {
    if (this.status(item, shells) !== 'buyable') return false;
    this.owned.add(item.id);
    this.spentShells += item.price;
    this.equip(item);
    return true;
  }

  /** Donne un objet exclusif (exploit accompli), sans l'utiliser d'office. Retourne false s'il était déjà possédé. */
  grant(item: ShopItem): boolean {
    if (this.owns(item)) return false;
    this.owned.add(item.id);
    return true;
  }

  /** Utilise une couleur ou une forme déjà possédée. */
  equip(item: ShopItem): boolean {
    const slot = lookSlot(item);
    if (slot === null || !this.owns(item)) return false;
    this.equipped.set(slot, item.id);
    return true;
  }

  /** Couleur de la décoration utilisée à cet emplacement. */
  decorColor(slot: DecorSlot): number {
    return colorOf(this.lookItem(slot));
  }

  /** Forme utilisée à cet emplacement (fin du nom de l'objet `skin_…` du modèle). */
  skinShape(slot: SkinSlot): string {
    return shapeOf(this.lookItem(slot));
  }

  /** L'apparence actuelle, avec `item` à la place de ce qui est utilisé à son emplacement (essai avant achat). */
  trying(item: ShopItem): Look {
    const pick = (slot: LookSlot): ShopItem => (lookSlot(item) === slot ? item : this.lookItem(slot));
    return { decorColor: (slot) => colorOf(pick(slot)), skinShape: (slot) => shapeOf(pick(slot)) };
  }

  /** Objet utilisé à cet emplacement. */
  private lookItem(slot: LookSlot): ShopItem {
    return shopItemById(this.equipped.get(slot) ?? '') ?? defaultLook(slot);
  }

  /** L'appât est-il utilisable ? (offert, ou acheté à la cabane) */
  hasBait(id: BaitId): boolean {
    if (!baitById(id)?.sold) return true;
    return SHOP_ITEMS.some((item) => item.effect.kind === 'bait' && item.effect.bait === id && this.owns(item));
  }

  /** Places au vivier : celles de départ, ou celles de l'agrandissement acheté. */
  penCapacity(): number {
    let capacity: number = CONFIG.pen.capacity;
    for (const item of SHOP_ITEMS) {
      if (item.effect.kind === 'pen' && this.owns(item)) capacity = Math.max(capacity, item.effect.capacity);
    }
    return capacity;
  }

  /** Matériel actuel : pour chaque pièce, le meilleur niveau acheté. */
  gear(): Gear {
    const gear = { ...BASIC_GEAR };
    for (const item of SHOP_ITEMS) {
      if (item.effect.kind === 'gear' && this.owns(item)) gear[GEAR_KEYS[item.effect.track]] = item.effect.factor;
    }
    return gear;
  }

  toData(): unknown {
    return { owned: [...this.owned], equipped: Object.fromEntries(this.equipped), spent: this.spentShells };
  }
}

function colorOf(item: ShopItem): number {
  return item.effect.kind === 'decor' ? item.effect.color : 0xffffff;
}

function shapeOf(item: ShopItem): string {
  return item.effect.kind === 'skin' ? item.effect.shape : '';
}

/** Objet d'origine : à prix 0, possédé dès le départ (un objet exclusif, lui, se gagne). */
function isOriginal(item: ShopItem): boolean {
  return item.price === 0 && !item.feat;
}

/** Couleur ou forme d'origine d'un emplacement (celle à prix 0). */
export function defaultLook(slot: LookSlot): ShopItem {
  const item = SHOP_ITEMS.find((candidate) => lookSlot(candidate) === slot && isOriginal(candidate));
  if (!item) throw new Error(`Boutique : aucun objet d'origine (prix 0) pour « ${slot} ».`);
  return item;
}

/** Décoration d'origine d'un emplacement à couleur. */
export function defaultDecor(slot: DecorSlot): ShopItem {
  return defaultLook(slot);
}
