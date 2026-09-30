import { CONFIG } from '../config';
import type { TimeSlot } from '../core/gameClock';
import { readBoolean, readNumber, readObject } from '../core/validate';
import { FISH, fishById, type FishSpecies, type Habitat } from '../data/fish';
import type { PlaceId } from '../data/places';
import type { FishRoll } from '../fishing/fishSelector';
import { ZONE_TYPES } from '../scene/levelLoader';
import { tierThresholdCm } from './objectives';

/**
 * Demandes de Moustache, le chat du ponton : quelques petits défis de pêche
 * qui rapportent des coquillages. Chaque jour (réel), les demandes
 * accomplies laissent la place à de nouvelles ; celles en cours restent,
 * sans limite de temps.
 */

/** Ce que demande Moustache. */
export type RequestGoal =
  | { readonly type: 'any' }
  | { readonly type: 'slot'; readonly slot: TimeSlot }
  | { readonly type: 'habitat'; readonly habitat: Habitat }
  /** Un poisson peu commun, rare ou légendaire. */
  | { readonly type: 'rarity' }
  | { readonly type: 'species'; readonly speciesId: string }
  | { readonly type: 'size'; readonly speciesId: string; readonly minCm: number };

export type RequestType = RequestGoal['type'];

export interface FishRequest {
  readonly goal: RequestGoal;
  /** Nombre de poissons demandés. */
  readonly count: number;
  progress: number;
  /** Coquillages offerts. */
  readonly reward: number;
}

/** Ce que la création des demandes doit savoir du jeu. */
export interface RequestContext {
  /** Lieu actuel : les demandes d'espèce portent sur ses poissons. */
  readonly place: PlaceId;
  /** Habitats présents dans le niveau (eau libre + types de zones). */
  readonly habitats: readonly Habitat[];
  /** Espèce déjà dans le carnet ? */
  readonly isCaught: (speciesId: string) => boolean;
  readonly random?: () => number;
}

type Random = () => number;

const REQUEST_TYPES: readonly RequestType[] = ['any', 'slot', 'habitat', 'rarity', 'species', 'size'];
const HABITATS: readonly Habitat[] = ['open', ...ZONE_TYPES];

export function isDone(request: FishRequest): boolean {
  return request.progress >= request.count;
}

/** Jour local au format AAAA-MM-JJ (le tableau change à minuit). */
export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Tableau des demandes (sauvegardé avec la partie). */
export class RequestBoard {
  readonly requests: FishRequest[] = [];
  /** Jour du dernier renouvellement. */
  private day = '';
  /** De nouvelles demandes n'ont pas encore été lues (bulle au-dessus de Moustache). */
  unseen = false;

  /** Reconstruit le tableau depuis une sauvegarde, en ignorant ce qui est invalide. */
  static fromData(value: unknown): RequestBoard {
    const raw = readObject(value);
    const board = new RequestBoard();
    board.day = typeof raw.day === 'string' ? raw.day : '';
    board.unseen = readBoolean(raw.unseen, false);
    if (Array.isArray(raw.requests)) {
      for (const item of raw.requests) {
        const request = parseRequest(item);
        if (request && board.requests.length < CONFIG.progression.requests.slots) board.requests.push(request);
      }
    }
    return board;
  }

  /**
   * Nouveau jour : les demandes accomplies sont retirées. Puis on complète
   * le tableau. Retourne true si de nouvelles demandes sont arrivées.
   */
  refresh(today: string, context: RequestContext): boolean {
    if (today !== this.day) {
      this.day = today;
      const pending = this.requests.filter((request) => !isDone(request));
      this.requests.splice(0, this.requests.length, ...pending);
    }
    let added = false;
    while (this.requests.length < CONFIG.progression.requests.slots) {
      const request = createRequest(context, this.requests);
      if (!request) break;
      this.requests.push(request);
      added = true;
    }
    if (added) this.unseen = true;
    return added;
  }

  /** Oublie le jour en cours : le prochain `refresh` renouvelle le tableau (tests). */
  forgetDay(): void {
    this.day = '';
  }

  /** Compte une prise ; retourne les demandes qu'elle vient d'accomplir. */
  recordCatch(roll: FishRoll): FishRequest[] {
    const completed: FishRequest[] = [];
    for (const request of this.requests) {
      if (isDone(request) || !matches(request.goal, roll)) continue;
      request.progress += 1;
      if (isDone(request)) completed.push(request);
    }
    return completed;
  }

  get allDone(): boolean {
    return this.requests.length > 0 && this.requests.every(isDone);
  }

  toData(): unknown {
    return { day: this.day, unseen: this.unseen, requests: structuredClone(this.requests) };
  }
}

/** La prise compte-t-elle pour cette demande ? */
export function matches(goal: RequestGoal, roll: FishRoll): boolean {
  switch (goal.type) {
    case 'any':
      return true;
    case 'slot':
      return roll.slot === goal.slot;
    case 'habitat':
      return roll.habitat === goal.habitat;
    case 'rarity':
      return roll.species.rarity !== 'common';
    case 'species':
      return roll.species.id === goal.speciesId;
    case 'size':
      return roll.species.id === goal.speciesId && roll.sizeCm >= goal.minCm;
  }
}

// --- Création -----------------------------------------------------------------

/** Une nouvelle demande, d'une sorte absente du tableau ; null s'il n'y en a plus de possible. */
function createRequest(context: RequestContext, existing: readonly FishRequest[]): FishRequest | null {
  const random = context.random ?? Math.random;
  const eligible = eligibleSpecies(context, existing);
  const caught = eligible.filter((species) => context.isCaught(species.id));
  const used = new Set(existing.map((request) => request.goal.type));
  const types = REQUEST_TYPES.filter((type) => !used.has(type) && isPossible(type, eligible, caught));
  if (types.length === 0) return null;
  const weights = CONFIG.progression.requests.weights;
  const type = pickWeighted(types, (candidate) => weights[candidate], random);
  return buildRequest(type, context, eligible, caught, random);
}

function isPossible(type: RequestType, eligible: readonly FishSpecies[], caught: readonly FishSpecies[]): boolean {
  if (type === 'species') return eligible.length > 0;
  if (type === 'size') return caught.length > 0;
  return true;
}

function buildRequest(
  type: RequestType,
  context: RequestContext,
  eligible: readonly FishSpecies[],
  caught: readonly FishSpecies[],
  random: Random,
): FishRequest {
  const { counts, rewards, unknownSpeciesChance } = CONFIG.progression.requests;
  switch (type) {
    case 'any':
      return request({ type }, between(counts.any, random), rewards.any);
    case 'slot':
      return request({ type, slot: pick(Object.keys(CONFIG.time.slots) as TimeSlot[], random) }, between(counts.slot, random), rewards.slot);
    case 'habitat':
      return request({ type, habitat: pick(context.habitats, random) }, between(counts.habitat, random), rewards.habitat);
    case 'rarity':
      return request({ type }, 1, rewards.rarity);
    case 'species': {
      const unknown = eligible.filter((species) => !context.isCaught(species.id));
      const pool = unknown.length > 0 && random() < unknownSpeciesChance ? unknown : eligible;
      const species = pick(pool, random);
      return request({ type, speciesId: species.id }, 1, speciesReward(species));
    }
    case 'size': {
      const species = pick(caught, random);
      const goal = { type, speciesId: species.id, minCm: tierThresholdCm(species, 'nice') } as const;
      return request(goal, 1, speciesReward(species) + rewards.sizeBonus);
    }
  }
}

function request(goal: RequestGoal, count: number, reward: number): FishRequest {
  return { goal, count, progress: 0, reward };
}

/** Espèces qu'on peut demander : de ce lieu, pas légendaires, présentes dans ce niveau, pas déjà demandées. */
function eligibleSpecies(context: RequestContext, existing: readonly FishRequest[]): FishSpecies[] {
  const requested = new Set(existing.map((request) => ('speciesId' in request.goal ? request.goal.speciesId : '')));
  return FISH.filter(
    (species) =>
      species.place === context.place &&
      species.rarity !== 'legendary' &&
      !requested.has(species.id) &&
      species.habitats.some((habitat) => context.habitats.includes(habitat)),
  );
}

function speciesReward(species: FishSpecies): number {
  const rewards = CONFIG.progression.requests.rewards.species;
  return species.rarity === 'legendary' ? rewards.rare : rewards[species.rarity];
}

// --- Relecture de la sauvegarde ------------------------------------------------

function parseRequest(value: unknown): FishRequest | null {
  const raw = readObject(value);
  const goal = parseGoal(raw.goal);
  if (!goal) return null;
  const count = Math.floor(readNumber(raw.count, 0, 1, 99));
  if (count < 1) return null;
  return {
    goal,
    count,
    progress: Math.floor(readNumber(raw.progress, 0, 0, count)),
    reward: Math.floor(readNumber(raw.reward, 0, 0, 999)),
  };
}

function parseGoal(value: unknown): RequestGoal | null {
  const raw = readObject(value);
  switch (raw.type) {
    case 'any':
    case 'rarity':
      return { type: raw.type };
    case 'slot':
      return typeof raw.slot === 'string' && raw.slot in CONFIG.time.slots ? { type: 'slot', slot: raw.slot as TimeSlot } : null;
    case 'habitat':
      return HABITATS.includes(raw.habitat as Habitat) ? { type: 'habitat', habitat: raw.habitat as Habitat } : null;
    case 'species':
      return typeof raw.speciesId === 'string' && fishById(raw.speciesId) ? { type: 'species', speciesId: raw.speciesId } : null;
    case 'size':
      if (typeof raw.speciesId !== 'string' || !fishById(raw.speciesId)) return null;
      return { type: 'size', speciesId: raw.speciesId, minCm: readNumber(raw.minCm, 0, 0) };
    default:
      return null;
  }
}

// --- Hasard ------------------------------------------------------------------------

function pick<T>(list: readonly T[], random: Random): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function between([min, max]: readonly [number, number], random: Random): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pickWeighted<T>(list: readonly T[], weightOf: (item: T) => number, random: Random): T {
  let roll = random() * list.reduce((sum, item) => sum + weightOf(item), 0);
  for (const item of list) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}
