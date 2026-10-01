import { CONFIG } from '../config';
import { keyHints } from '../core/controls';
import type { Journal } from '../core/journal';
import { curiosOf, type Curio } from '../data/finds';
import { fishById, fishOf } from '../data/fish';
import { PLACES, placeById, type Place, type PlaceId } from '../data/places';
import { categoryOf, SHOP_ITEMS, shopItemById, type ShopCategory, type ShopItem } from '../data/shop';
import type { FindReward } from '../progression/finds';
import type { KeptFish } from '../progression/keptFish';
import type { Progression } from '../progression/progression';
import { isDone, type FishRequest } from '../progression/requests';
import type { ItemStatus } from '../progression/shop';
import { hintText } from './fishText';
import type { FishThumbnails } from './fishThumbnails';
import { createElement } from './hud';
import { describeRequest, requestIcon } from './requestText';
import { formatDate, formatSize, TEXTS } from './texts';

/** Ce dont le ponton a besoin pour s'afficher et agir. */
export interface CabinViewDeps {
  readonly progression: Progression;
  readonly journal: Journal;
  readonly thumbnails: FishThumbnails;
  /** Le niveau a-t-il un vivier dans le décor (vue rapprochée possible) ? */
  readonly hasPen: boolean;
  readonly onBuy: (item: ShopItem) => void;
  readonly onEquip: (item: ShopItem) => void;
  readonly onRelease: (fish: KeptFish) => void;
  readonly onViewPen: () => void;
  /** Lieu actuel, et départ vers un autre lieu (carte). */
  readonly place: PlaceId;
  readonly onTravel: (place: PlaceId) => void;
  /** Numéros des coins à trouvailles du niveau (`find_<n>`). */
  readonly findSpots: readonly number[];
}

export type CabinTab = 'requests' | 'finds' | 'pen' | 'shop' | 'map';

const TABS: readonly CabinTab[] = ['requests', 'finds', 'pen', 'shop', 'map'];
const CATEGORIES: readonly ShopCategory[] = ['bait', 'gear', 'pen', 'decor', 'outfit'];

/**
 * Ponton de Moustache : ses demandes du jour (et le poisson du jour), les
 * trouvailles, le vivier, la boutique de la cabane et la carte des lieux de
 * pêche. Le jeu
 * est en pause tant qu'il est ouvert. L'affichage se met à jour à chaque
 * changement.
 */
export class CabinView {
  private readonly deps: CabinViewDeps;
  private readonly root = createElement('journal cabin');
  private readonly panel = createElement('journal-panel cabin-panel');
  private tab: CabinTab = 'requests';
  /** Ce que Moustache vient de donner pour les trouvailles rapportées (affiché jusqu'à la fermeture). */
  private examined: FindReward[] = [];

  constructor(layer: HTMLElement, deps: CabinViewDeps) {
    this.deps = deps;
    this.root.hidden = true;
    this.root.append(this.panel);
    // Un clic sur le fond (hors du panneau) le ferme
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    layer.append(this.root);
    const refresh = (): void => {
      if (this.isOpen) this.render();
    };
    deps.progression.events.on('shells', refresh);
    deps.progression.events.on('shop', refresh);
    deps.progression.events.on('requests', refresh);
    deps.progression.events.on('pen', refresh);
    deps.progression.events.on('finds', refresh);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /**
   * Ouvre sur un onglet (par défaut : les trouvailles si on en rapporte, les
   * demandes s'il y en a de nouvelles, sinon le dernier ouvert).
   */
  open(tab?: CabinTab): void {
    const { progression } = this.deps;
    if (tab) this.tab = tab;
    else if (progression.finds.carriedCount > 0) this.tab = 'finds';
    else if (progression.requests.unseen) this.tab = 'requests';
    this.root.hidden = false;
    this.showTab(this.tab);
  }

  close(): void {
    this.root.hidden = true;
    this.examined = [];
  }

  private showTab(tab: CabinTab): void {
    this.tab = tab;
    this.panel.scrollTop = 0;
    // Moustache examine ce qu'on lui rapporte dès qu'on lui montre
    if (tab === 'finds') this.examined.push(...this.deps.progression.redeemFinds());
    this.render();
    if (tab === 'requests') this.deps.progression.markRequestsSeen();
  }

  private render(): void {
    const scroll = this.panel.scrollTop;
    const content = this.tabContent();
    this.panel.replaceChildren(this.header(), this.tabs(), content);
    this.panel.scrollTop = scroll;
  }

  private tabContent(): HTMLElement {
    switch (this.tab) {
      case 'requests':
        return this.requestsTab();
      case 'finds':
        return this.findsTab();
      case 'pen':
        return this.penTab();
      case 'shop':
        return this.shopTab();
      case 'map':
        return this.mapTab();
    }
  }

  private header(): HTMLElement {
    const header = createElement('journal-header');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'journal-close';
    close.title = TEXTS.cabin.closeHint(keyHints().cabin);
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    const wallet = createElement('cabin-wallet', `${TEXTS.shells.icon} ${TEXTS.shells.count(this.deps.progression.shells)}`);
    wallet.title = TEXTS.shells.title;
    header.append(createElement('journal-title', TEXTS.cabin.title), wallet, close);
    return header;
  }

  private tabs(): HTMLElement {
    const tabs = createElement('segmented cabin-tabs');
    for (const tab of TABS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = TEXTS.cabin.tabs[tab];
      button.classList.toggle('is-selected', tab === this.tab);
      button.addEventListener('click', () => this.showTab(tab));
      tabs.append(button);
    }
    return tabs;
  }

  // --- Demandes ------------------------------------------------------------------

  private requestsTab(): HTMLElement {
    const board = this.deps.progression.requests;
    const section = createElement('cabin-section');
    const speech = board.requests.length === 0 ? TEXTS.cabin.empty : board.allDone ? TEXTS.cabin.allDone : TEXTS.cabin.greeting;
    const cat = createElement('cabin-cat');
    cat.append(createElement('cabin-cat-avatar', '🐈'), createElement('cabin-speech', speech));
    section.append(cat, this.dailyFishNote(), ...board.requests.map((request) => this.requestCard(request)));
    section.append(
      createElement('cabin-note', TEXTS.cabin.rule),
      createElement('cabin-note', TEXTS.cabin.journalRewards(CONFIG.progression.objectiveRewards)),
    );
    return section;
  }

  /** Le poisson du jour (son nom s'il est déjà au carnet, sinon un indice). */
  private dailyFishNote(): HTMLElement {
    const { progression, journal } = this.deps;
    const species = progression.dailyFish;
    if (!species) return createElement('cabin-daily');
    const name = journal.entry(species.id) ? species.name : TEXTS.cabin.dailyUnknown(hintText(species));
    const text = progression.dailyBonusAvailable
      ? TEXTS.cabin.daily(name, CONFIG.events.dailyFish.reward)
      : TEXTS.cabin.dailyClaimed(name);
    return createElement('cabin-daily', text);
  }

  private requestCard(request: FishRequest): HTMLElement {
    const done = isDone(request);
    const card = createElement(`request-card${done ? ' is-done' : ''}`);
    const body = createElement('request-body');
    const bar = createElement('request-bar');
    const fill = createElement('request-fill');
    fill.style.transform = `scaleX(${Math.min(1, request.progress / request.count)})`;
    bar.append(fill);
    body.append(
      createElement('request-text', describeRequest(request, this.deps.journal, this.deps.place)),
      bar,
      createElement('request-progress', TEXTS.cabin.progress(Math.min(request.progress, request.count), request.count)),
    );
    const reward = done ? TEXTS.cabin.done : TEXTS.cabin.shop.price(request.reward);
    card.append(createElement('request-icon', requestIcon(request.goal)), body, createElement('request-reward', reward));
    return card;
  }

  // --- Trouvailles -------------------------------------------------------------------

  private findsTab(): HTMLElement {
    const texts = TEXTS.cabin.finds;
    const section = createElement('cabin-section');
    const cat = createElement('cabin-cat');
    cat.append(createElement('cabin-cat-avatar', '🐈'), createElement('cabin-speech', this.examined.length > 0 ? texts.examined : texts.intro));
    section.append(cat, ...this.examined.map((reward) => this.findRewardCard(reward)), createElement('cabin-daily', this.findsToday()));
    // Le lieu actuel d'abord, puis les autres
    const places = [...PLACES].sort((a, b) => Number(b.id === this.deps.place) - Number(a.id === this.deps.place));
    for (const place of places) section.append(...this.curioShelf(place));
    return section;
  }

  /** Ce qui flotte encore aujourd'hui dans le lieu actuel. */
  private findsToday(): string {
    const { progression, place, findSpots } = this.deps;
    const texts = TEXTS.cabin.finds;
    const at = placeById(place).at;
    if (progression.finds.dailyCount(findSpots) === 0) return texts.none(at);
    const left = progression.finds.activeSpots(place, findSpots).length;
    return left > 0 ? texts.left(left, at) : texts.allPicked(at);
  }

  /** Ce que Moustache dit d'une trouvaille rapportée, et ce qu'il donne. */
  private findRewardCard(reward: FindReward): HTMLElement {
    const texts = TEXTS.cabin.finds;
    const card = createElement(`request-card find-reward${reward.isNew ? ' is-new' : ''}`);
    const body = createElement('request-body');
    body.append(
      createElement('request-text', `${reward.curio.name} · ${reward.isNew ? texts.isNew : texts.again}`),
      createElement('shop-description', TEXTS.quote(reward.curio.comment)),
    );
    card.append(createElement('request-icon', reward.curio.icon), body, createElement('request-reward', TEXTS.shells.gain(reward.shells)));
    return card;
  }

  /** Collection d'un lieu : ses trouvailles, connues ou encore à découvrir. */
  private curioShelf(place: Place): HTMLElement[] {
    const { finds } = this.deps.progression;
    const curios = curiosOf(place.id);
    const grid = createElement('shop-grid');
    curios.forEach((curio) => grid.append(this.curioCard(curio, place)));
    return [createElement('settings-heading', TEXTS.cabin.finds.collection(place.name, finds.foundIn(place.id), curios.length)), grid];
  }

  private curioCard(curio: Curio, place: Place): HTMLElement {
    const texts = TEXTS.cabin.finds;
    const count = this.deps.progression.finds.count(curio);
    const card = createElement(`shop-item${count > 0 ? '' : ' is-locked'}`);
    const body = createElement('shop-body');
    if (count > 0) {
      body.append(createElement('shop-name', curio.name), createElement('shop-description', TEXTS.quote(curio.comment)));
      card.append(createElement('shop-icon', curio.icon), body, createElement('shop-status is-owned', texts.count(count)));
      return card;
    }
    const hint = curio.rarity === 'rare' ? texts.rareHint(place.at) : texts.unknownHint(place.at);
    body.append(createElement('shop-name', texts.unknown), createElement('shop-description', hint));
    card.append(createElement('shop-icon', '❔'), body);
    return card;
  }

  // --- Vivier ----------------------------------------------------------------------------

  private penTab(): HTMLElement {
    const { progression, hasPen } = this.deps;
    const kept = progression.keptFish;
    const section = createElement('cabin-section');
    const header = createElement('pen-header');
    header.append(createElement('cabin-wallet', TEXTS.cabin.pen.places(kept.length, progression.penCapacity)));
    if (hasPen && kept.length > 0) header.append(actionButton(TEXTS.cabin.pen.view, true, this.deps.onViewPen));
    section.append(header);
    if (kept.length === 0) section.append(createElement('cabin-note', TEXTS.cabin.pen.empty));
    if (!hasPen) section.append(createElement('cabin-note', TEXTS.cabin.pen.noPen));
    const grid = createElement('shop-grid');
    kept.forEach((fish) => grid.append(this.keptCard(fish)));
    section.append(grid);
    return section;
  }

  private keptCard(fish: KeptFish): HTMLElement {
    const species = fishById(fish.speciesId);
    const card = createElement(`shop-item kept-fish${fish.variant ? ' is-variant' : ''}`);
    if (!species) return card;
    const image = document.createElement('img');
    image.className = 'kept-thumb';
    image.alt = '';
    void this.deps.thumbnails.get(species, false, fish.variant).then((url) => (image.src = url));
    const body = createElement('shop-body');
    body.append(
      createElement('shop-name', fish.variant ? species.variant.name : species.name),
      createElement('shop-description', `${formatSize(fish.sizeCm)} · ${TEXTS.cabin.pen.since(formatDate(fish.keptAt))}`),
    );
    card.append(image, body, actionButton(TEXTS.cabin.pen.release, true, () => this.deps.onRelease(fish)));
    return card;
  }

  // --- Carte ------------------------------------------------------------------------------

  private mapTab(): HTMLElement {
    const section = createElement('cabin-section');
    PLACES.forEach((place) => section.append(this.placeCard(place)));
    return section;
  }

  /** Un lieu : description, espèces trouvées, et « Y aller » s'il est débloqué. */
  private placeCard(place: Place): HTMLElement {
    const { progression, place: here } = this.deps;
    const progress = progression.placeProgress(place);
    const card = createElement(`shop-item place-card${progress.unlocked ? '' : ' is-locked'}`);
    const body = createElement('shop-body');
    const species = TEXTS.places.species(progression.speciesCaught(place.id), fishOf(place.id).length);
    body.append(createElement('shop-name', place.name), createElement('shop-description', `${place.description} · ${species}`));
    if (!progress.unlocked && place.unlock) {
      const from = placeById(place.unlock.place).of;
      body.append(createElement('place-lock', TEXTS.places.locked(progress.caught, progress.needed, from)));
    }
    card.append(createElement('shop-icon', place.icon), body, this.placeAction(place, here, progress.unlocked));
    return card;
  }

  private placeAction(place: Place, here: PlaceId, unlocked: boolean): HTMLElement {
    if (place.id === here) return createElement('shop-status is-owned', TEXTS.places.here);
    return actionButton(TEXTS.places.go, unlocked, () => this.deps.onTravel(place.id));
  }

  // --- Boutique ----------------------------------------------------------------------

  private shopTab(): HTMLElement {
    const section = createElement('cabin-section');
    section.append(createElement('cabin-note', TEXTS.cabin.shop.intro));
    for (const category of CATEGORIES) {
      const grid = createElement('shop-grid');
      SHOP_ITEMS.filter((item) => categoryOf(item) === category).forEach((item) => grid.append(this.itemCard(item)));
      section.append(createElement('settings-heading', TEXTS.cabin.shop.sections[category]), grid);
    }
    return section;
  }

  private itemCard(item: ShopItem): HTMLElement {
    const { progression } = this.deps;
    const status = progression.shop.status(item, progression.shells);
    const card = createElement(`shop-item is-${status}`);
    const icon = createElement('shop-icon', item.effect.kind === 'decor' ? '' : item.icon);
    if (item.effect.kind === 'decor') {
      icon.classList.add('is-swatch');
      icon.style.background = `#${item.effect.color.toString(16).padStart(6, '0')}`;
    }
    const body = createElement('shop-body');
    body.append(createElement('shop-name', item.name), createElement('shop-description', item.description));
    card.append(icon, body, this.itemAction(item, status));
    return card;
  }

  private itemAction(item: ShopItem, status: ItemStatus): HTMLElement {
    const texts = TEXTS.cabin.shop;
    switch (status) {
      case 'buyable':
      case 'tooExpensive':
        return actionButton(texts.price(item.price), status === 'buyable', () => this.deps.onBuy(item));
      case 'equipable':
        return actionButton(texts.equip, true, () => this.deps.onEquip(item));
      case 'locked':
        return createElement('shop-status', texts.locked(shopItemById(item.requires ?? '')?.name ?? ''));
      case 'owned':
        return createElement('shop-status is-owned', texts.owned);
      case 'equipped':
        return createElement('shop-status is-owned', texts.equipped);
    }
  }
}

function actionButton(label: string, enabled: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shop-action';
  button.textContent = label;
  button.disabled = !enabled;
  button.addEventListener('click', onClick);
  return button;
}
