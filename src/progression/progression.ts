import { CONFIG } from '../config';
import { Emitter } from '../core/events';
import type { CatchResult, Journal } from '../core/journal';
import { readNumber, readObject } from '../core/validate';
import { BAITS, type Bait } from '../data/baits';
import { FISH, type FishSpecies, type Habitat } from '../data/fish';
import { DEFAULT_PLACE, PLACES, type Place, type PlaceId } from '../data/places';
import type { ShopItem } from '../data/shop';
import type { FishRoll } from '../fishing/fishSelector';
import type { Gear } from '../fishing/reelFight';
import { parseKeptFish, type KeptFish } from './keptFish';
import { journalShells, objectiveReward, objectivesGained, type Objective } from './objectives';
import { dailyFish } from './rendezvous';
import { localDay, RequestBoard, type FishRequest } from './requests';
import { Shop } from './shop';

/** Une récompense gagnée avec une prise (affichée sur la carte de prise). */
export type CatchReward =
  | { readonly kind: 'objective'; readonly objective: Objective; readonly shells: number }
  | { readonly kind: 'request'; readonly request: FishRequest; readonly shells: number }
  | { readonly kind: 'daily'; readonly shells: number };

/** Ce que la progression annonce à l'interface. */
export interface ProgressionEvents {
  /** Une prise vient d'être comptée, avec ses récompenses (peut-être aucune). */
  rewards: { roll: FishRoll; rewards: readonly CatchReward[] };
  /** Le solde de coquillages a changé. */
  shells: { shells: number };
  /** Le tableau des demandes a changé (nouvelles demandes, progrès). */
  requests: { added: boolean };
  /** Achat ou changement de décoration. */
  shop: { item: ShopItem };
  /** Un poisson est entré au vivier ou en est sorti. */
  pen: { kept: readonly KeptFish[] };
  /** Un nouveau lieu vient d'être débloqué. */
  unlock: { place: Place };
}

/** Avancement vers le déblocage d'un lieu (espèces attrapées sur celles demandées). */
export interface PlaceProgress {
  readonly unlocked: boolean;
  readonly caught: number;
  readonly needed: number;
}

/**
 * Progression du joueur au-delà du carnet : coquillages, demandes de
 * Moustache, poisson du jour, boutique de la cabane et vivier.
 *
 * Solde de coquillages = objectifs du carnet (déduits du carnet) + bonus
 * (demandes accomplies, poissons du jour) − achats. Ainsi les prises faites
 * avant l'arrivée des objectifs rapportent aussi leurs coquillages.
 */
export class Progression {
  readonly events = new Emitter<ProgressionEvents>();
  readonly requests: RequestBoard;
  readonly shop: Shop;
  private readonly journal: Journal;
  private readonly kept: KeptFish[];
  /** Coquillages gagnés hors carnet (demandes, poissons du jour) depuis le début de la partie. */
  private bonusShells: number;
  /** Jour (réel) où le bonus du poisson du jour a été gagné. */
  private dailyClaimedDay: string;
  /** Lieu actuel et habitats de son niveau : les demandes et le poisson du jour doivent y être possibles. */
  private place: PlaceId = DEFAULT_PLACE;
  private habitats: readonly Habitat[] = ['open'];

  constructor(journal: Journal, data: unknown) {
    const raw = readObject(data);
    this.journal = journal;
    this.requests = RequestBoard.fromData(raw.requests);
    this.shop = Shop.fromData(raw.shop);
    this.bonusShells = readNumber(raw.bonusShells ?? raw.requestShells, 0, 0);
    this.dailyClaimedDay = typeof raw.dailyClaimedDay === 'string' ? raw.dailyClaimedDay : '';
    this.kept = parseKeptFish(raw.pen, this.penCapacity);
  }

  /** Le niveau est chargé : on connaît le lieu et ses habitats. */
  setPlace(place: PlaceId, habitats: readonly Habitat[]): void {
    this.place = place;
    this.habitats = habitats;
  }

  get currentPlace(): PlaceId {
    return this.place;
  }

  /** Espèces d'un lieu déjà au carnet. */
  speciesCaught(place: PlaceId): number {
    return FISH.filter((species) => species.place === place && this.journal.entry(species.id)).length;
  }

  /** Le lieu est-il accessible, et où en est-on pour le débloquer ? */
  placeProgress(place: Place): PlaceProgress {
    if (!place.unlock) return { unlocked: true, caught: 0, needed: 0 };
    const caught = this.speciesCaught(place.unlock.place);
    return { unlocked: caught >= place.unlock.species, caught, needed: place.unlock.species };
  }

  /** Coquillages disponibles. */
  get shells(): number {
    return Math.max(0, journalShells(this.journal) + this.bonusShells - this.shop.spent);
  }

  /** Appâts utilisables (offerts ou achetés), dans l'ordre de la barre. */
  get baits(): Bait[] {
    return BAITS.filter((bait) => this.shop.hasBait(bait.id));
  }

  get gear(): Gear {
    return this.shop.gear();
  }

  /** Poisson du jour du lieu actuel (il change chaque jour réel). */
  get dailyFish(): FishSpecies | null {
    return dailyFish(localDay(), this.place, this.habitats);
  }

  /** Le bonus du poisson du jour est-il encore à gagner aujourd'hui ? */
  get dailyBonusAvailable(): boolean {
    return this.dailyClaimedDay !== localDay();
  }

  /**
   * À appeler après l'ajout de la prise au carnet : objectifs remplis,
   * poisson du jour et demandes accomplies. Retourne les récompenses (aussi
   * annoncées par l'événement `rewards`).
   */
  recordCatch(roll: FishRoll, result: CatchResult): CatchReward[] {
    const rewards: CatchReward[] = objectivesGained(roll.species, result).map((objective) => ({
      kind: 'objective',
      objective,
      shells: objectiveReward(objective),
    }));
    const daily = this.claimDailyBonus(roll);
    if (daily) rewards.push(daily);
    for (const request of this.requests.recordCatch(roll)) {
      this.bonusShells += request.reward;
      rewards.push({ kind: 'request', request, shells: request.reward });
    }
    this.events.emit('rewards', { roll, rewards });
    this.events.emit('requests', { added: false });
    if (rewards.length > 0) this.events.emit('shells', { shells: this.shells });
    if (result.isNewSpecies) this.announceUnlocks(roll.species.place);
    return rewards;
  }

  /** Une nouvelle espèce de `from` vient d'entrer au carnet : un lieu est-il tout juste débloqué ? */
  private announceUnlocks(from: PlaceId): void {
    for (const place of PLACES) {
      if (place.unlock?.place === from && this.speciesCaught(from) === place.unlock.species) this.events.emit('unlock', { place });
    }
  }

  /** Renouvelle les demandes si le jour a changé. Retourne true si de nouvelles sont arrivées. */
  refreshRequests(today = localDay()): boolean {
    const added = this.requests.refresh(today, {
      place: this.place,
      habitats: this.habitats,
      isCaught: (id) => this.journal.entry(id) !== undefined,
    });
    if (added) this.events.emit('requests', { added });
    return added;
  }

  /** Le joueur a ouvert le tableau : les nouvelles demandes sont lues. */
  markRequestsSeen(): void {
    if (!this.requests.unseen) return;
    this.requests.unseen = false;
    this.events.emit('requests', { added: false });
  }

  buy(item: ShopItem): boolean {
    if (!this.shop.buy(item, this.shells)) return false;
    this.events.emit('shop', { item });
    this.events.emit('shells', { shells: this.shells });
    return true;
  }

  equip(item: ShopItem): boolean {
    if (!this.shop.equip(item)) return false;
    this.events.emit('shop', { item });
    return true;
  }

  // --- Vivier ------------------------------------------------------------------------

  /** Poissons gardés au vivier, du plus ancien au plus récent. */
  get keptFish(): readonly KeptFish[] {
    return this.kept;
  }

  get penCapacity(): number {
    return this.shop.penCapacity();
  }

  get penIsFull(): boolean {
    return this.kept.length >= this.penCapacity;
  }

  /** Garde la prise au vivier. Retourne false s'il est plein. */
  keep(roll: FishRoll): boolean {
    if (this.penIsFull) return false;
    this.kept.push({ speciesId: roll.species.id, sizeCm: roll.sizeCm, variant: roll.variant, keptAt: Date.now() });
    this.events.emit('pen', { kept: this.kept });
    return true;
  }

  /** Relâche un poisson du vivier dans le lac. */
  release(fish: KeptFish): void {
    const index = this.kept.indexOf(fish);
    if (index < 0) return;
    this.kept.splice(index, 1);
    this.events.emit('pen', { kept: this.kept });
  }

  toData(): unknown {
    return {
      requests: this.requests.toData(),
      shop: this.shop.toData(),
      bonusShells: this.bonusShells,
      dailyClaimedDay: this.dailyClaimedDay,
      pen: this.kept.map((fish) => ({ ...fish })),
    };
  }

  /** Première prise du poisson du jour : bonus (une fois par jour réel). */
  private claimDailyBonus(roll: FishRoll): CatchReward | null {
    if (roll.species.id !== this.dailyFish?.id || !this.dailyBonusAvailable) return null;
    const shells = CONFIG.events.dailyFish.reward;
    this.dailyClaimedDay = localDay();
    this.bonusShells += shells;
    return { kind: 'daily', shells };
  }
}
