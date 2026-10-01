import { CONFIG } from '../config';
import { readNumber, readObject } from '../core/validate';
import { curioById, curiosOf, type Curio } from '../data/finds';
import type { PlaceId } from '../data/places';

/** Ce que Moustache donne pour une trouvaille qu'on lui montre. */
export interface FindReward {
  readonly curio: Curio;
  /** Première fois qu'on lui en rapporte une. */
  readonly isNew: boolean;
  readonly shells: number;
}

type Random = () => number;

/**
 * Trouvailles du joueur (sauvegardées avec la partie) :
 * - chaque jour (réel), quelques coins de chaque lieu cachent un objet, les
 *   mêmes pour toute la journée (tirés d'après la date) ;
 * - un objet repêché reste dans la barque jusqu'à ce qu'on le montre à
 *   Moustache, qui l'ajoute à la collection et donne des coquillages.
 */
export class Finds {
  /** Collection : identifiant de l'objet → nombre de fois rapporté. */
  private readonly collection = new Map<string, number>();
  /** Objets repêchés, pas encore montrés à Moustache. */
  private readonly carried: string[] = [];
  /** Coins déjà vidés aujourd'hui (« lieu:numéro »). */
  private readonly picked = new Set<string>();
  private day = '';

  /** Reconstruit les trouvailles depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): Finds {
    const raw = readObject(value);
    const finds = new Finds();
    finds.day = typeof raw.day === 'string' ? raw.day : '';
    for (const [id, count] of Object.entries(readObject(raw.collection))) {
      if (curioById(id)) finds.collection.set(id, Math.floor(readNumber(count, 1, 1)));
    }
    for (const id of stringsOf(raw.carried)) if (curioById(id)) finds.carried.push(id);
    for (const key of stringsOf(raw.picked)) finds.picked.add(key);
    return finds;
  }

  /** Nombre d'objets dans la barque, à montrer à Moustache. */
  get carriedCount(): number {
    return this.carried.length;
  }

  /** Nombre de fois où cet objet a été rapporté (0 = jamais). */
  count(curio: Curio): number {
    return this.collection.get(curio.id) ?? 0;
  }

  /** Nombre d'objets différents de ce lieu déjà dans la collection. */
  foundIn(place: PlaceId): number {
    return curiosOf(place).filter((item) => this.collection.has(item.id)).length;
  }

  /** Nouveau jour : les coins se remplissent à nouveau. Retourne true si le jour a changé. */
  refresh(today: string): boolean {
    if (today === this.day) return false;
    this.day = today;
    this.picked.clear();
    return true;
  }

  /**
   * Coins qui cachent encore quelque chose aujourd'hui dans ce lieu, parmi
   * les numéros `spots` de son niveau (`find_<n>`).
   */
  activeSpots(place: PlaceId, spots: readonly number[]): number[] {
    return todaysSpots(this.day, place, spots).filter((spot) => !this.picked.has(spotKey(place, spot)));
  }

  /** Nombre de trouvailles cachées chaque jour dans un niveau qui a ces coins. */
  dailyCount(spots: readonly number[]): number {
    return Math.min(CONFIG.finds.perDay, spots.length);
  }

  /** La barque repêche ce qui flotte au coin `spot` : l'objet tiré part dans la barque. Null si le coin est déjà vide. */
  pick(place: PlaceId, spot: number, random: Random = Math.random): Curio | null {
    const key = spotKey(place, spot);
    if (this.picked.has(key)) return null;
    const curio = this.draw(place, random);
    if (!curio) return null;
    this.picked.add(key);
    this.carried.push(curio.id);
    return curio;
  }

  /** Moustache examine ce qu'il y a dans la barque : tout rejoint la collection. Retourne ce qu'il donne. */
  redeem(): FindReward[] {
    const { rewards } = CONFIG.finds;
    const given: FindReward[] = [];
    for (const id of this.carried.splice(0)) {
      const curio = curioById(id);
      if (!curio) continue;
      const before = this.count(curio);
      this.collection.set(id, before + 1);
      given.push({ curio, isNew: before === 0, shells: before === 0 ? rewards[curio.rarity] : rewards.duplicate });
    }
    return given;
  }

  toData(): unknown {
    return { day: this.day, collection: Object.fromEntries(this.collection), carried: [...this.carried], picked: [...this.picked] };
  }

  /** Tire un objet du lieu : parfois rare, et de préférence un qu'on n'a encore jamais eu. */
  private draw(place: PlaceId, random: Random): Curio | null {
    const all = curiosOf(place);
    if (all.length === 0) return null;
    const { rareChance, newChance } = CONFIG.finds;
    const wanted = random() < rareChance ? 'rare' : 'common';
    const sameRarity = all.filter((item) => item.rarity === wanted);
    const pool = sameRarity.length > 0 ? sameRarity : all;
    const unknown = pool.filter((item) => !this.collection.has(item.id) && !this.carried.includes(item.id));
    const from = unknown.length > 0 && random() < newChance ? unknown : pool;
    return from[Math.floor(random() * from.length)];
  }
}

function spotKey(place: PlaceId, spot: number): string {
  return `${place}:${spot}`;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Coins du jour : un tirage qui ne dépend que de la date et du lieu (les mêmes à chaque lancement du jeu). */
function todaysSpots(day: string, place: PlaceId, spots: readonly number[]): number[] {
  const random = seededRandom(`${day}:${place}`);
  const shuffled = [...spots].sort((a, b) => a - b);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, CONFIG.finds.perDay);
}

/** Générateur pseudo-aléatoire (mulberry32) amorcé par un texte. */
function seededRandom(seed: string): Random {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
