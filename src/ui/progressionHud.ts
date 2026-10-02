import { CONFIG } from '../config';
import type { Journal } from '../core/journal';
import type { TimeSlot } from '../core/gameClock';
import { fishById, type FishSpecies, type Habitat } from '../data/fish';
import type { PlaceId } from '../data/places';
import type { ShopItem } from '../data/shop';
import { CLUE_KINDS } from '../data/trails';
import type { FindSpot } from '../scene/levelLoader';
import type { FishRoll } from '../fishing/fishSelector';
import type { KeptFish } from '../progression/keptFish';
import type { CatchReward, Progression } from '../progression/progression';
import type { Decor } from '../scene/decor';
import type { KeepState, RewardLine } from './catchPopup';
import type { FishingHud } from './fishingHud';
import type { Hud } from './hud';
import { starsText } from './fishText';
import { describeRequest } from './requestText';
import { TEXTS } from './texts';

export interface ProgressionHudDeps {
  readonly progression: Progression;
  readonly journal: Journal;
  readonly hud: Hud;
  readonly fishingHud: FishingHud;
  readonly decor: Decor;
  /** Lieu actuel et habitats de son niveau, pour créer des demandes réalisables. */
  readonly place: PlaceId;
  readonly habitats: readonly Habitat[];
}

/**
 * Relie la progression à l'interface et au décor : coquillages et badge de
 * Moustache dans le panneau « matériel », barre d'appâts, décoration de la
 * barque et tenue du pêcheur, récompenses et bouton du vivier sur la carte
 * de prise, achats, poisson du jour, trouvailles repêchées, conseils de
 * Moustache, exploits, et nouvelles demandes au changement de jour.
 */
export class ProgressionHud {
  private readonly deps: ProgressionHudDeps;
  private dayCheckTimer = 0;
  /** Messages longs en attente (conseil de Moustache, exploit) : ils s'affichent une fois la carte de prise refermée. */
  private readonly pendingNotes: string[] = [];

  constructor(deps: ProgressionHudDeps) {
    this.deps = deps;
    const { progression, fishingHud } = deps;
    progression.events.on('shells', ({ shells }) => fishingHud.setShells(shells));
    progression.events.on('requests', () => this.updateBadge());
    progression.events.on('finds', () => this.updateBadge());
    progression.events.on('shop', () => this.applyShop());
    progression.events.on('rewards', ({ roll, rewards }) => this.showCatchExtras(roll, rewards));
    progression.events.on('unlock', ({ place }) => deps.hud.toast(TEXTS.places.unlocked(place.name)));
    progression.events.on('tip', ({ species, slot }) => this.pendingNotes.push(this.tipText(species, slot)));
    progression.events.on('feat', ({ item }) => this.pendingNotes.push(TEXTS.feats.earned(item.name)));
    progression.setPlace(deps.place, deps.habitats);
    progression.refreshRequests();
    progression.refreshFinds();
    // Exploits accomplis avant l'arrivée des objets exclusifs (ancienne partie)
    progression.claimFeats();
    fishingHud.setShells(progression.shells);
    this.updateBadge();
    this.applyShop();
  }

  /** Moustache a-t-il quelque chose à nous dire ? (nouvelles demandes, ou trouvailles à lui montrer) */
  get catIsWaiting(): boolean {
    const { requests, finds } = this.deps.progression;
    return requests.unseen || finds.carriedCount > 0;
  }

  /** La barque vient de repêcher ce qui flottait à ce coin. Retourne false s'il n'y avait rien. */
  pickFind(spot: FindSpot): boolean {
    const pickup = this.deps.progression.pickFind(spot.index);
    if (!pickup) return false;
    if (pickup.clue) this.deps.hud.toast(TEXTS.trail.found(pickup.clue.count, CLUE_KINDS.length), true);
    else this.deps.hud.toast(TEXTS.finds.picked);
    return true;
  }

  /** Vérifie de temps en temps si le jour a changé (à appeler quand le jeu tourne). */
  update(dt: number): void {
    this.showPendingNote();
    this.dayCheckTimer += dt;
    if (this.dayCheckTimer < CONFIG.progression.requests.dayCheckSeconds) return;
    this.dayCheckTimer = 0;
    this.deps.progression.refreshFinds();
    if (this.deps.progression.refreshRequests()) this.deps.hud.toast(TEXTS.cabin.newRequests);
  }

  /** En début de partie : le poisson du jour (son nom s'il est connu). */
  announceDay(): void {
    const species = this.deps.progression.dailyFish;
    if (!species) return;
    const known = this.deps.journal.entry(species.id) !== undefined;
    this.deps.hud.toast(TEXTS.rendezvous.dailyFish(known ? species.name : TEXTS.journal.unknownName));
  }

  /** Relâche un poisson du vivier. */
  release(fish: KeptFish): void {
    this.deps.progression.release(fish);
    const species = fishById(fish.speciesId);
    if (species) this.deps.hud.toast(TEXTS.cabin.pen.released(fish.variant ? species.variant.name : species.name));
  }

  /** Achat depuis la boutique de la cabane. */
  buy(item: ShopItem): void {
    const { progression, hud } = this.deps;
    if (!progression.buy(item)) return;
    if (item.effect.kind !== 'bait') return hud.toast(TEXTS.cabin.bought(item.name));
    const bait = item.effect.bait;
    const key = progression.baits.findIndex((candidate) => candidate.id === bait) + 1;
    hud.toast(TEXTS.cabin.newBait(item.name, key));
  }

  equip(item: ShopItem): void {
    this.deps.progression.equip(item);
  }

  /** Essai avant achat : montre l'objet sur la barque ou le pêcheur ; null remet ce qui est vraiment utilisé. */
  preview(item: ShopItem | null): void {
    const { shop } = this.deps.progression;
    this.deps.decor.apply(item ? shop.trying(item) : shop);
  }

  /** Nouvelles demandes tout de suite (tests : `game.newRequestsDay()`). */
  forceNewDay(): void {
    this.deps.progression.requests.forgetDay();
    this.deps.progression.refreshRequests();
    this.deps.progression.refreshFinds(`test-${Date.now()}`);
  }

  /** Un message long à la fois, quand la carte de prise est refermée. */
  private showPendingNote(): void {
    if (this.pendingNotes.length === 0 || this.deps.fishingHud.catchPopup.isOpen) return;
    this.deps.hud.toast(this.pendingNotes.shift() ?? '', true);
  }

  /** « Un poisson que tu ne connais pas rôde dans les roseaux, au crépuscule. Il aime : … » */
  private tipText(species: FishSpecies, slot: TimeSlot): string {
    const { progression, habitats } = this.deps;
    const habitat = species.habitats.find((candidate) => habitats.includes(candidate)) ?? species.habitats[0];
    const where = TEXTS.cabin.where[habitat];
    const place = species.times.includes(slot) ? TEXTS.tip.now(where) : TEXTS.tip.later(where, TEXTS.cabin.when[species.times[0]]);
    const bait = progression.baits.find((candidate) => species.baits.includes(candidate.id));
    return bait ? `${place} ${TEXTS.tip.bait(`${bait.icon} ${bait.name}`)}` : place;
  }

  private updateBadge(): void {
    this.deps.fishingHud.setCabinBadge(this.catIsWaiting);
  }

  private applyShop(): void {
    const { progression, fishingHud, decor } = this.deps;
    fishingHud.setBaits(progression.baits);
    decor.apply(progression.shop);
  }

  /** Sur la carte de prise : coquillages gagnés et bouton « Garder au vivier ». */
  private showCatchExtras(roll: FishRoll, rewards: readonly CatchReward[]): void {
    const { catchPopup } = this.deps.fishingHud;
    catchPopup.showRewards(rewards.map((reward) => this.rewardLine(reward)));
    catchPopup.showKeep(this.keepState(), () => this.keep(roll));
  }

  private keep(roll: FishRoll): KeepState {
    return this.deps.progression.keep(roll) ? 'kept' : this.keepState();
  }

  private keepState(): KeepState {
    return this.deps.progression.penIsFull ? 'full' : 'available';
  }

  private rewardLine(reward: CatchReward): RewardLine {
    switch (reward.kind) {
      case 'objective': {
        const { icon, name } = TEXTS.objectives[reward.objective];
        return { label: `${icon} ${name}`, shells: reward.shells };
      }
      case 'mastery':
        return { label: TEXTS.mastery.reward(starsText(reward.star)), shells: reward.shells };
      case 'daily':
        return { label: TEXTS.catch.dailyReward, shells: reward.shells };
      case 'stamp':
        return { label: reward.bonus ? TEXTS.logbook.bonusReward(reward.count) : TEXTS.logbook.reward(reward.count), shells: reward.shells };
      case 'request': {
        const request = describeRequest(reward.request, this.deps.journal, this.deps.place);
        return { label: `${TEXTS.cabin.button} ${TEXTS.catch.requestReward}${TEXTS.colon}${request}`, shells: reward.shells };
      }
    }
  }
}
