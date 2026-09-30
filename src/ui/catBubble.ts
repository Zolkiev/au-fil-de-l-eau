import { keyHints } from '../core/controls';
import { TEXTS } from './texts';

/**
 * Bulle « ! » au-dessus de Moustache quand il a de nouvelles demandes.
 * Positionnée en pixels écran par le jeu ; un clic ouvre son ponton.
 */
export class CatBubble {
  private readonly button = document.createElement('button');

  constructor(layer: HTMLElement, onClick: () => void) {
    this.button.type = 'button';
    this.button.className = 'cat-bubble';
    this.button.textContent = '!';
    this.button.title = TEXTS.cabin.buttonTitle(keyHints().cabin);
    this.button.hidden = true;
    this.button.addEventListener('click', () => {
      this.button.blur();
      onClick();
    });
    layer.append(this.button);
  }

  show(x: number, y: number): void {
    this.button.hidden = false;
    this.button.style.left = `${x}px`;
    this.button.style.top = `${y}px`;
  }

  hide(): void {
    this.button.hidden = true;
  }
}
