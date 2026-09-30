import { CONFIG } from '../config';
import { readNumber, readObject } from '../core/validate';
import { baitById, type BaitId } from '../data/baits';
import { SHOP_ITEMS, shopItemById, type DecorSlot, type GearTrack, type ShopItem } from '../data/shop';
import { BASIC_GEAR, type Gear } from '../fishing/reelFight';

/** Ce qu'on peut faire d'un objet de la boutique. */
export type ItemStatus =
  /** Assez de coquillages : on peut l'acheter. */
  | 'buyable'
  /** Pas encore assez de coquillages. */
  | 'tooExpensive'
  /** Il faut d'abord acheter l'objet précédent (matériel niveau 2). */
  | 'locked'
  /** Déjà possédé (appât, matériel). */
  | 'owned'
  /** Décoration possédée, pas utilisée : on peut la choisir. */
  | 'equipable'
  /** Décoration utilisée en ce moment. */
  | 'equipped';

const DECOR_SLOTS: readonly DecorSlot[] = ['boatPaint', 'bobber', 'lantern'];
/** Correspondance pièce de matériel → réglage du combat qu'elle améliore. */
const GEAR_KEYS: Record<GearTrack, keyof Gear> = { rod: 'tensionRise', reel: 'reelSpeed', line: 'breakTime' };

/**
 * Boutique de la cabane : objets achetés, décoration utilisée et coquillages
 * dépensés (sauvegardés). Le solde lui-même est calculé par Progression.
 */
export class Shop {
  private readonly owned = new Set<string>();
  private readonly equipped = new Map<DecorSlot, string>();
  private spentShells = 0;

  constructor() {
    for (const item of SHOP_ITEMS) if (item.price === 0) this.owned.add(item.id);
    for (const slot of DECOR_SLOTS) this.equipped.set(slot, defaultDecor(slot).id);
  }

  /** Reconstruit la boutique depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Shop {
    const raw = readObject(value);
    const shop = new Shop();
    if (Array.isArray(raw.owned)) {
      for (const id of raw.owned) if (typeof id === 'string' && shopItemById(id)) shop.owned.add(id);
    }
    const equipped = readObject(raw.equipped);
    for (const slot of DECOR_SLOTS) {
      const item = typeof equipped[slot] === 'string' ? shopItemById(equipped[slot]) : undefined;
      if (item && shop.owned.has(item.id) && item.effect.kind === 'decor' && item.effect.slot === slot) {
        shop.equipped.set(slot, item.id);
      }
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
    if (this.owns(item)) {
      if (item.effect.kind !== 'decor') return 'owned';
      return this.equipped.get(item.effect.slot) === item.id ? 'equipped' : 'equipable';
    }
    if (item.requires && !this.owned.has(item.requires)) return 'locked';
    return shells >= item.price ? 'buyable' : 'tooExpensive';
  }

  /** Achète l'objet (la décoration achetée est aussitôt utilisée). Retourne false si impossible. */
  buy(item: ShopItem, shells: number): boolean {
    if (this.status(item, shells) !== 'buyable') return false;
    this.owned.add(item.id);
    this.spentShells += item.price;
    if (item.effect.kind === 'decor') this.equipped.set(item.effect.slot, item.id);
    return true;
  }

  /** Utilise une décoration déjà possédée. */
  equip(item: ShopItem): boolean {
    if (item.effect.kind !== 'decor' || !this.owns(item)) return false;
    this.equipped.set(item.effect.slot, item.id);
    return true;
  }

  /** Couleur de la décoration utilisée à cet emplacement. */
  decorColor(slot: DecorSlot): number {
    const item = shopItemById(this.equipped.get(slot) ?? '') ?? defaultDecor(slot);
    return item.effect.kind === 'decor' ? item.effect.color : 0xffffff;
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

/** Décoration d'origine d'un emplacement (celle à prix 0). */
export function defaultDecor(slot: DecorSlot): ShopItem {
  const item = SHOP_ITEMS.find((candidate) => candidate.effect.kind === 'decor' && candidate.effect.slot === slot && candidate.price === 0);
  if (!item) throw new Error(`Boutique : aucune décoration d'origine (prix 0) pour « ${slot} ».`);
  return item;
}
