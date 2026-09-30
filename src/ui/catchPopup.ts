import type { CatchResult } from '../core/journal';
import { keyHints } from '../core/controls';
import { isTouchMode } from '../core/pointerMode';
import type { FishRoll } from '../fishing/fishSelector';
import { sizeTier } from '../progression/objectives';
import { createElement } from './hud';
import { formatSize, TEXTS } from './texts';

/** Bouton « Garder au vivier » : possible, déjà fait, ou vivier plein. */
export type KeepState = 'available' | 'kept' | 'full';

/** Une ligne de récompense sur la carte (« 🏆 Trophée +4 🐚 »). */
export interface RewardLine {
  readonly label: string;
  readonly shells: number;
}

/**
 * Carte de présentation de la prise (le poisson 3D tourne au-dessus) :
 * rareté, nom, taille, nouveautés, palier de taille, description, puis les
 * coquillages gagnés. Un voile doux assombrit les bords de l'écran.
 */
export class CatchPopup {
  private readonly vignette = createElement('catch-vignette');
  private readonly card = createElement('catch-card');
  private readonly rewards = createElement('catch-rewards');
  private readonly keepButton = document.createElement('button');
  private keepState: KeepState = 'full';
  private onKeep: (() => KeepState) | null = null;

  constructor(layer: HTMLElement) {
    this.vignette.hidden = true;
    this.card.hidden = true;
    this.keepButton.type = 'button';
    this.keepButton.className = 'catch-keep';
    this.keepButton.addEventListener('click', () => {
      this.keepButton.blur();
      this.keep();
    });
    layer.append(this.vignette, this.card);
  }

  show(roll: FishRoll, result: CatchResult): void {
    const { species } = roll;
    this.card.className = `catch-card rarity-${species.rarity}${roll.variant ? ' is-variant' : ''}`;
    this.rewards.replaceChildren();
    this.rewards.hidden = true;
    this.keepButton.hidden = true;
    this.onKeep = null;
    this.card.replaceChildren(
      createElement('catch-rarity', TEXTS.rarity[species.rarity]),
      createElement('catch-name', roll.variant ? species.variant.name : species.name),
      createElement('catch-size', formatSize(roll.sizeCm)),
      this.badges(roll, result),
      createElement('catch-description', species.description),
      this.rewards,
      this.keepButton,
      createElement('catch-continue', isTouchMode() ? TEXTS.catch.touchContinue : TEXTS.catch.continue),
    );
    this.vignette.hidden = false;
    this.card.hidden = false;
  }

  /** Coquillages gagnés avec cette prise (objectifs du carnet, demandes de Moustache). */
  showRewards(lines: readonly RewardLine[]): void {
    this.rewards.replaceChildren(
      ...lines.map((line) => {
        const row = createElement('catch-reward');
        row.append(createElement('catch-reward-label', line.label), createElement('catch-reward-shells', TEXTS.shells.gain(line.shells)));
        return row;
      }),
    );
    this.rewards.hidden = lines.length === 0;
  }

  /** Affiche le bouton « Garder au vivier » ; `onKeep` garde le poisson et donne le nouvel état. */
  showKeep(state: KeepState, onKeep: () => KeepState): void {
    this.onKeep = onKeep;
    this.renderKeep(state);
    this.keepButton.hidden = false;
  }

  /** Garde le poisson affiché (bouton ou touche V), si c'est possible. */
  keep(): void {
    if (this.card.hidden || !this.onKeep || this.keepState !== 'available') return;
    this.renderKeep(this.onKeep());
  }

  hide(): void {
    this.vignette.hidden = true;
    this.card.hidden = true;
  }

  private renderKeep(state: KeepState): void {
    this.keepState = state;
    const available = isTouchMode() ? TEXTS.catch.keep : TEXTS.catch.keepKey(keyHints().keep);
    this.keepButton.textContent = state === 'available' ? available : state === 'kept' ? TEXTS.catch.kept : TEXTS.catch.penFull;
    this.keepButton.disabled = state !== 'available';
    this.keepButton.classList.toggle('is-kept', state === 'kept');
  }

  private badges(roll: FishRoll, result: CatchResult): HTMLDivElement {
    const badges = createElement('catch-badges');
    if (result.isNewSpecies) badges.append(createElement('catch-badge', TEXTS.catch.newSpecies));
    if (result.isRecord) badges.append(createElement('catch-badge', TEXTS.catch.record));
    if (roll.variant) badges.append(createElement('catch-badge is-variant', TEXTS.catch.variant));
    const tier = sizeTier(roll.species, roll.sizeCm);
    if (tier !== 'small') badges.append(createElement(`catch-badge is-${tier}`, TEXTS.catch[tier]));
    return badges;
  }
}
