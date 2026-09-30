import { CONFIG } from '../config';
import type { Journal } from '../core/journal';
import { fishById, type Habitat } from '../data/fish';
import type { PlaceId } from '../data/places';
import type { ShopItem } from '../data/shop';
import type { FishRoll } from '../fishing/fishSelector';
import type { KeptFish } from '../progression/keptFish';
import type { CatchReward, Progression } from '../progression/progression';
import type { Decor } from '../scene/decor';
import type { KeepState, RewardLine } from './catchPopup';
import type { FishingHud } from './fishingHud';
import type { Hud } from './hud';
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
 * barque, récompenses et bouton du vivier sur la carte de prise, achats,
 * poisson du jour, et nouvelles demandes au changement de jour.
 */
export class ProgressionHud {
  private readonly deps: ProgressionHudDeps;
  private dayCheckTimer = 0;

  constructor(deps: ProgressionHudDeps) {
    this.deps = deps;
    const { progression, fishingHud } = deps;
    progression.events.on('shells', ({ shells }) => fishingHud.setShells(shells));
    progression.events.on('requests', () => fishingHud.setCabinBadge(progression.requests.unseen));
    progression.events.on('shop', () => this.applyShop());
    progression.events.on('rewards', ({ roll, rewards }) => this.showCatchExtras(roll, rewards));
    progression.events.on('unlock', ({ place }) => deps.hud.toast(TEXTS.places.unlocked(place.name)));
    progression.setPlace(deps.place, deps.habitats);
    progression.refreshRequests();
    fishingHud.setShells(progression.shells);
    fishingHud.setCabinBadge(progression.requests.unseen);
    this.applyShop();
  }

  /** Vérifie de temps en temps si le jour a changé (à appeler quand le jeu tourne). */
  update(dt: number): void {
    this.dayCheckTimer += dt;
    if (this.dayCheckTimer < CONFIG.progression.requests.dayCheckSeconds) return;
    this.dayCheckTimer = 0;
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

  /** Nouvelles demandes tout de suite (tests : `game.newRequestsDay()`). */
  forceNewDay(): void {
    this.deps.progression.requests.forgetDay();
    this.deps.progression.refreshRequests();
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
      case 'daily':
        return { label: TEXTS.catch.dailyReward, shells: reward.shells };
      case 'request': {
        const request = describeRequest(reward.request, this.deps.journal, this.deps.place);
        return { label: `${TEXTS.cabin.button} ${TEXTS.catch.requestReward} : ${request}`, shells: reward.shells };
      }
    }
  }
}
