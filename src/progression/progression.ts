import { CONFIG } from '../config';
import { Emitter } from '../core/events';
import type { CatchResult, Journal } from '../core/journal';
import { readNumber, readObject } from '../core/validate';
import { BAITS, type Bait } from '../data/baits';
import type { TimeSlot } from '../core/gameClock';
import { FISH, fishOf, type FishSpecies, type Habitat } from '../data/fish';
import { DEFAULT_PLACE, PLACES, type Place, type PlaceId } from '../data/places';
import type { Curio } from '../data/finds';
import { SHOP_ITEMS, type Feat, type ShopItem } from '../data/shop';
import type { FishRoll } from '../fishing/fishSelector';
import type { Gear } from '../fishing/reelFight';
import { featAchieved, featProgress, type FeatProgress, type FeatSources } from './feats';
import { Finds, type FindReward } from './finds';
import { parseKeptFish, type KeptFish } from './keptFish';
import { Logbook } from './logbook';
import { masteryShells, starReward, starsGained } from './mastery';
import { journalShells, objectiveReward, objectivesGained, type Objective } from './objectives';
import { dailyFish, type Discovery, type ProgressBoosts } from './rendezvous';
import { localDay, RequestBoard, type FishRequest } from './requests';
import { Shop } from './shop';
import { Trails, type FoundClue } from './trails';
import { trailIn } from '../data/trails';

/** Une récompense gagnée avec une prise (affichée sur la carte de prise). */
export type CatchReward =
  | { readonly kind: 'objective'; readonly objective: Objective; readonly shells: number }
  /** Nouvelle étoile de maîtrise (`star` : 1 → 3). */
  | { readonly kind: 'mastery'; readonly star: number; readonly shells: number }
  | { readonly kind: 'request'; readonly request: FishRequest; readonly shells: number }
  | { readonly kind: 'daily'; readonly shells: number }
  /** Tampon du jour au carnet de bord (`count` : jours de pêche ; `bonus` : tampon rond). */
  | { readonly kind: 'stamp'; readonly count: number; readonly bonus: boolean; readonly shells: number };

/** Ce que la barque vient de repêcher : un objet, et parfois la bouteille à message du jour (un indice). */
export interface Pickup {
  readonly curio: Curio;
  readonly clue: FoundClue | null;
}

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
  /** Exploit accompli : un objet exclusif vient d'être gagné. */
  feat: { item: ShopItem };
  /** Un poisson est entré au vivier ou en est sorti. */
  pen: { kept: readonly KeptFish[] };
  /** Un nouveau lieu vient d'être débloqué. */
  unlock: { place: Place };
  /** Trouvailles : objet repêché, objets montrés à Moustache, ou nouveau jour. */
  finds: { carried: number };
  /** Plusieurs prises sans nouvelle espèce : Moustache conseille d'en chercher une ; `slot` = créneau du moment. */
  tip: { species: FishSpecies; slot: TimeSlot };
}

/** Avancement vers le déblocage d'un lieu (espèces attrapées sur celles demandées). */
export interface PlaceProgress {
  readonly unlocked: boolean;
  readonly caught: number;
  readonly needed: number;
}

/**
 * Progression du joueur au-delà du carnet : coquillages, demandes de
 * Moustache, poisson du jour, carnet de bord, boutique de la cabane, vivier,
 * trouvailles et pistes des légendaires.
 *
 * Solde de coquillages = objectifs du carnet et étoiles de maîtrise (déduits
 * du carnet) + bonus (demandes accomplies, poissons du jour, trouvailles,
 * tampons du carnet de bord) − achats. Ainsi les prises faites avant l'arrivée des objectifs et de la
 * maîtrise rapportent aussi leurs coquillages.
 */
export class Progression {
  readonly events = new Emitter<ProgressionEvents>();
  readonly requests: RequestBoard;
  readonly shop: Shop;
  readonly finds: Finds;
  readonly trails: Trails;
  readonly logbook: Logbook;
  private readonly journal: Journal;
  private readonly kept: KeptFish[];
  /** Coquillages gagnés hors carnet (demandes, poissons du jour, trouvailles) depuis le début de la partie. */
  private bonusShells: number;
  /** Jour (réel) où le bonus du poisson du jour a été gagné. */
  private dailyClaimedDay: string;
  /** Prises d'affilée sans nouvelle espèce, et lieu où elles ont été faites (voir CONFIG.progression.discovery). */
  private dryCatches: number;
  private dryPlace: string;
  /** Lieu actuel et habitats de son niveau : les demandes et le poisson du jour doivent y être possibles. */
  private place: PlaceId = DEFAULT_PLACE;
  private habitats: readonly Habitat[] = ['open'];

  constructor(journal: Journal, data: unknown) {
    const raw = readObject(data);
    this.journal = journal;
    this.requests = RequestBoard.fromData(raw.requests);
    this.shop = Shop.fromData(raw.shop);
    this.finds = Finds.fromData(raw.finds);
    this.trails = Trails.fromData(raw.trails);
    this.logbook = Logbook.fromData(raw.logbook);
    this.bonusShells = readNumber(raw.bonusShells ?? raw.requestShells, 0, 0);
    this.dailyClaimedDay = typeof raw.dailyClaimedDay === 'string' ? raw.dailyClaimedDay : '';
    this.dryCatches = Math.floor(readNumber(raw.dryCatches, 0, 0));
    this.dryPlace = typeof raw.dryPlace === 'string' ? raw.dryPlace : DEFAULT_PLACE;
    this.kept = parseKeptFish(raw.pen, this.penCapacity);
  }

  /** Le niveau est chargé : on connaît le lieu et ses habitats. */
  setPlace(place: PlaceId, habitats: readonly Habitat[]): void {
    this.place = place;
    this.habitats = habitats;
    if (this.dryPlace !== place) this.dryCatches = 0;
    this.dryPlace = place;
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
    return Math.max(0, journalShells(this.journal) + masteryShells(this.journal) + this.bonusShells - this.shop.spent);
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

  /**
   * Coup de pouce aux espèces pas encore au carnet : il monte à chaque prise
   * sans nouveauté, et retombe à la première nouvelle espèce.
   */
  get discovery(): Discovery {
    const { perCatch, maxFactor } = CONFIG.progression.discovery;
    return {
      discoveryFactor: Math.min(maxFactor, 1 + perCatch * this.dryCatches),
      isUnknown: (speciesId) => this.journal.entry(speciesId) === undefined,
    };
  }

  /** Ce que la progression apporte au tirage du poisson (voir currentBoosts). */
  get boosts(): ProgressBoosts {
    return { discovery: this.discovery, trailFactor: this.trails.legendaryFactor(this.place) };
  }

  /** Le bonus du poisson du jour est-il encore à gagner aujourd'hui ? */
  get dailyBonusAvailable(): boolean {
    return this.dailyClaimedDay !== localDay();
  }

  /**
   * À appeler après l'ajout de la prise au carnet : objectifs remplis,
   * étoiles de maîtrise, poisson du jour et demandes accomplies. Retourne les
   * récompenses (aussi annoncées par l'événement `rewards`).
   */
  recordCatch(roll: FishRoll, result: CatchResult): CatchReward[] {
    const rewards: CatchReward[] = objectivesGained(roll.species, result).map((objective) => ({
      kind: 'objective',
      objective,
      shells: objectiveReward(objective),
    }));
    for (const star of starsGained(roll.species, result)) rewards.push({ kind: 'mastery', star, shells: starReward(star) });
    const daily = this.claimDailyBonus(roll);
    if (daily) rewards.push(daily);
    const stamp = this.logbook.stamp(localDay());
    if (stamp) {
      this.bonusShells += stamp.shells;
      rewards.push({ kind: 'stamp', ...stamp });
    }
    for (const request of this.requests.recordCatch(roll)) {
      this.bonusShells += request.reward;
      rewards.push({ kind: 'request', request, shells: request.reward });
    }
    this.events.emit('rewards', { roll, rewards });
    this.events.emit('requests', { added: false });
    if (rewards.length > 0) this.events.emit('shells', { shells: this.shells });
    if (result.isNewSpecies) this.announceUnlocks(roll.species.place);
    this.trackDiscovery(roll, result);
    this.claimFeats();
    return rewards;
  }

  // --- Exploits ------------------------------------------------------------------------

  /**
   * Donne les objets exclusifs dont l'exploit est accompli (annoncés par
   * l'événement `feat`). À appeler après ce qui peut en accomplir un, et au
   * lancement : les exploits d'avant comptent aussi.
   */
  claimFeats(): ShopItem[] {
    const earned: ShopItem[] = [];
    for (const item of SHOP_ITEMS) {
      if (!item.feat || this.shop.owns(item) || !featAchieved(item.feat, this.featSources)) continue;
      this.shop.grant(item);
      earned.push(item);
      this.events.emit('feat', { item });
    }
    return earned;
  }

  /** Où en est-on d'un exploit ? */
  featProgress(feat: Feat): FeatProgress {
    return featProgress(feat, this.featSources);
  }

  private get featSources(): FeatSources {
    return { journal: this.journal, finds: this.finds, logbook: this.logbook };
  }

  /** Compte les prises sans nouvelle espèce ; de temps en temps, Moustache conseille d'en chercher une. */
  private trackDiscovery(roll: FishRoll, result: CatchResult): void {
    if (result.isNewSpecies) {
      this.dryCatches = 0;
      return;
    }
    this.dryCatches += 1;
    const { tipEvery } = CONFIG.progression.discovery;
    if (this.dryCatches % tipEvery !== 0) return;
    const species = this.tipSpecies(roll.slot, this.dryCatches / tipEvery - 1);
    if (species) this.events.emit('tip', { species, slot: roll.slot });
  }

  /**
   * Espèce à conseiller : pas encore au carnet, non légendaire, possible dans
   * ce niveau ; de préférence une qui mord en ce moment, la plus courante
   * d'abord. `turn` (0, 1, 2…) fait tourner les conseils d'une fois sur l'autre.
   */
  private tipSpecies(slot: TimeSlot, turn: number): FishSpecies | null {
    const missing = fishOf(this.place).filter(
      (species) =>
        species.rarity !== 'legendary' &&
        !this.journal.entry(species.id) &&
        species.habitats.some((habitat) => this.habitats.includes(habitat)),
    );
    const now = missing.filter((species) => species.times.includes(slot));
    const pool = now.length > 0 ? now : missing;
    return pool.length > 0 ? pool[turn % pool.length] : null;
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

  // --- Trouvailles -------------------------------------------------------------------

  /** Nouveau jour (réel) : les coins à trouvailles se remplissent. Retourne true si le jour a changé. */
  refreshFinds(today = localDay()): boolean {
    const changed = this.finds.refresh(today);
    if (changed) this.events.emit('finds', { carried: this.finds.carriedCount });
    return changed;
  }

  /**
   * La barque repêche ce qui flotte au coin `spot` du lieu actuel ; null si
   * le coin est vide. La première trouvaille du jour vient avec la bouteille
   * à message du lieu, s'il en attend une.
   */
  pickFind(spot: number): Pickup | null {
    const curio = this.finds.pick(this.place, spot);
    if (!curio) return null;
    const clue = this.trails.open(this.place, localDay(), this.legendaryCaught);
    this.events.emit('finds', { carried: this.finds.carriedCount });
    return { curio, clue };
  }

  /** Une bouteille à message attend-elle aujourd'hui dans le lieu actuel ? */
  get bottleWaiting(): boolean {
    return this.trails.bottleWaiting(this.place, localDay(), this.legendaryCaught);
  }

  /** Le légendaire du lieu actuel est-il déjà au carnet ? */
  private get legendaryCaught(): boolean {
    const trail = trailIn(this.place);
    return trail !== undefined && this.journal.entry(trail.speciesId) !== undefined;
  }

  /** Moustache examine les objets rapportés : ils rejoignent la collection, contre des coquillages. */
  redeemFinds(): FindReward[] {
    const rewards = this.finds.redeem();
    if (rewards.length === 0) return rewards;
    this.bonusShells += rewards.reduce((total, reward) => total + reward.shells, 0);
    this.events.emit('finds', { carried: 0 });
    this.events.emit('shells', { shells: this.shells });
    this.claimFeats();
    return rewards;
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
      dryCatches: this.dryCatches,
      dryPlace: this.dryPlace,
      pen: this.kept.map((fish) => ({ ...fish })),
      finds: this.finds.toData(),
      trails: this.trails.toData(),
      logbook: this.logbook.toData(),
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
