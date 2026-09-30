import { CONFIG } from '../config';
import type { ReelStatus } from '../fishing/reelFight';
import { createElement } from './hud';
import { TEXTS } from './texts';

/**
 * Jauge du mini-jeu de remontée :
 *  - une piste où le poisson 🐟 se rapproche de la barque ;
 *  - la barre de tension (vert → rouge) et, sous elle, le risque de casse ;
 *  - près du maximum, des rayures et « ⚠ Relâche ! » (lisibles sans les couleurs).
 */
export class ReelGauge {
  private readonly root = createElement('reel');
  private readonly fish = createElement('reel-fish', '🐟');
  private readonly distance = createElement('reel-distance');
  private readonly bar = createElement('reel-bar');
  private readonly fill = createElement('reel-fill');
  private readonly breakBar = createElement('reel-break');
  private readonly warning = createElement('reel-warning', TEXTS.reel.release);

  constructor(layer: HTMLElement) {
    const track = createElement('reel-track');
    track.append(createElement('reel-boat', '🛶'), this.fish, this.distance);
    this.bar.append(this.fill);
    const tensionRow = createElement('reel-row');
    tensionRow.append(createElement('reel-label', TEXTS.reel.tension), this.bar);
    this.warning.hidden = true;
    this.root.append(track, tensionRow, this.breakBar, this.warning);
    this.root.hidden = true;
    layer.append(this.root);
  }

  update(status: ReelStatus): void {
    this.root.hidden = false;
    const progress = Math.min(status.distance / status.startDistance, 1);
    this.fish.style.left = `${8 + progress * 84}%`;
    this.distance.textContent = `${Math.max(0, status.distance).toFixed(0)} m`;
    this.fill.style.transform = `scaleX(${status.tension})`;
    this.fill.style.backgroundColor = `hsl(${Math.round(140 - 140 * status.tension)} 55% 58%)`;
    this.bar.classList.toggle('is-max', status.tension >= 1);
    const high = status.tension >= CONFIG.reel.warningTension;
    this.bar.classList.toggle('is-high', high);
    this.warning.hidden = !high;
    this.breakBar.style.transform = `scaleX(${status.breakProgress})`;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
