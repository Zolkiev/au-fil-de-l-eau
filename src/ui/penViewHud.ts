import { createElement } from './hud';
import { TEXTS } from './texts';

/** Bandeau de la vue rapprochée du vivier : titre et bouton pour revenir. */
export class PenViewHud {
  private readonly root = createElement('pen-view');
  private readonly title = createElement('pen-view-title');

  constructor(layer: HTMLElement, onBack: () => void) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'shop-action';
    back.textContent = TEXTS.penView.back;
    back.addEventListener('click', () => {
      back.blur();
      onBack();
    });
    this.root.append(this.title, back);
    this.root.hidden = true;
    layer.append(this.root);
  }

  show(count: number): void {
    this.title.textContent = TEXTS.penView.title(count);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
