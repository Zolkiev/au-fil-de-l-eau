import { keyHints } from '../core/controls';
import { BAITS, type Bait, type BaitId } from '../data/baits';
import { CatchPopup } from './catchPopup';
import { createElement } from './hud';
import { ReelGauge } from './reelGauge';
import { TEXTS } from './texts';

/** Actions déclenchées depuis le panneau « matériel ». */
export interface FishingHudActions {
  readonly onSelectBait: (bait: Bait) => void;
  readonly onOpenCabin: () => void;
  readonly onOpenJournal: () => void;
  readonly onOpenMenu: () => void;
}

/**
 * Éléments d'interface de la pêche : jauge de puissance, alerte de touche
 * au-dessus du bouchon, jauge de remontée, carte de prise, et panneau
 * « matériel » (heure, coquillages, boutons, appâts possédés).
 */
export class FishingHud {
  readonly reel: ReelGauge;
  readonly catchPopup: CatchPopup;
  private readonly gauge = createElement('power');
  private readonly gaugeLabel = createElement('power-label');
  private readonly gaugeFill = createElement('power-fill');
  private readonly alert = createElement('bite-alert', '!');
  private readonly clockIcon = document.createElement('span');
  private readonly clock = document.createElement('span');
  private readonly weatherIcon = document.createElement('span');
  private readonly description = createElement('tackle-description');
  private readonly shells = createElement('tackle-shells');
  private readonly baitsRow = createElement('tackle-baits');
  private readonly baitButtons = new Map<BaitId, HTMLButtonElement>();
  private readonly actions: FishingHudActions;
  private cabinButton: HTMLButtonElement | null = null;
  private journalButton: HTMLButtonElement | null = null;
  private currentBait: Bait = BAITS[0];

  constructor(layer: HTMLElement, actions: FishingHudActions) {
    this.actions = actions;
    const bar = createElement('power-bar');
    bar.append(this.gaugeFill);
    this.gauge.append(this.gaugeLabel, bar);
    this.gauge.hidden = true;
    this.alert.hidden = true;
    layer.append(this.gauge, this.alert, this.buildTacklePanel(actions));
    this.reel = new ReelGauge(layer);
    this.catchPopup = new CatchPopup(layer);
  }

  /** Jauge de puissance (0 → 1), avec le nom de la zone visée. */
  showPower(power: number, label: string): void {
    this.gauge.hidden = false;
    this.gaugeFill.style.transform = `scaleX(${power})`;
    if (this.gaugeLabel.textContent !== label) this.gaugeLabel.textContent = label;
  }

  hidePower(): void {
    this.gauge.hidden = true;
  }

  /** « ! » au-dessus du bouchon, en pixels écran. */
  showBiteAlert(x: number, y: number): void {
    this.alert.hidden = false;
    this.alert.style.left = `${x}px`;
    this.alert.style.top = `${y}px`;
  }

  hideBiteAlert(): void {
    this.alert.hidden = true;
  }

  setBait(bait: Bait): void {
    this.currentBait = bait;
    this.baitButtons.forEach((button, id) => button.classList.toggle('is-selected', id === bait.id));
    this.description.textContent = bait.description;
  }

  /** Appâts de la barre (offerts et achetés), dans l'ordre des touches. */
  setBaits(baits: readonly Bait[]): void {
    this.baitButtons.clear();
    this.baitsRow.replaceChildren(...baits.map((bait, index) => this.buildBaitButton(bait, index + 1)));
    this.setBait(this.currentBait);
  }

  setShells(count: number): void {
    this.shells.textContent = `${TEXTS.shells.icon} ${count}`;
  }

  /** Infobulles des boutons, avec les touches actuelles. */
  refreshKeyHints(): void {
    const keys = keyHints();
    if (this.cabinButton) this.cabinButton.title = TEXTS.cabin.buttonTitle(keys.cabin);
    if (this.journalButton) this.journalButton.title = TEXTS.journal.buttonTitle(keys.journal);
  }

  /** Pastille sur le bouton de Moustache quand il a de nouvelles demandes. */
  setCabinBadge(visible: boolean): void {
    this.cabinButton?.classList.toggle('has-badge', visible);
  }

  /** Temps qu'il fait, à côté de l'heure (rien par beau temps) ; `title` = infobulle. */
  setWeather(icon: string, title: string): void {
    this.weatherIcon.textContent = icon ? ` ${icon}` : '';
    this.weatherIcon.parentElement?.setAttribute('title', title);
  }

  /** Heure affichée, avec l'icône du moment (la phase de la lune la nuit). */
  setTime(label: string, icon: string): void {
    if (this.clock.textContent !== label) this.clock.textContent = label;
    if (this.clockIcon.textContent !== icon) this.clockIcon.textContent = icon;
  }

  private buildTacklePanel(actions: FishingHudActions): HTMLDivElement {
    const panel = createElement('tackle');
    const topRow = createElement('tackle-row');
    const clock = createElement('tackle-clock');
    clock.append(this.clockIcon, ' ', this.clock, this.weatherIcon);
    this.shells.title = TEXTS.shells.title;
    this.cabinButton = iconButton(TEXTS.cabin.button, '', actions.onOpenCabin);
    this.journalButton = iconButton(TEXTS.journal.button, '', actions.onOpenJournal);
    topRow.append(
      clock,
      this.shells,
      this.cabinButton,
      this.journalButton,
      iconButton(TEXTS.menu.button, TEXTS.menu.buttonTitle, actions.onOpenMenu),
    );
    panel.append(topRow, this.baitsRow, this.description);
    this.refreshKeyHints();
    this.setBaits(BAITS.filter((bait) => !bait.sold));
    return panel;
  }

  private buildBaitButton(bait: Bait, key: number): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bait';
    button.title = bait.description;
    button.innerHTML = `<kbd>${key}</kbd><span class="bait-icon">${bait.icon}</span><span class="bait-name">${bait.name}</span>`;
    button.addEventListener('click', () => {
      button.blur();
      this.actions.onSelectBait(bait);
    });
    this.baitButtons.set(bait.id, button);
    return button;
  }
}

/** Petit bouton rond du panneau « matériel » (carnet, menu). */
function iconButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.title = title;
  button.textContent = icon;
  button.addEventListener('click', () => {
    button.blur();
    onClick();
  });
  return button;
}
