import type { ShopItem } from '../data/shop';
import { createElement } from './hud';
import { TEXTS } from './texts';

/** Ce qu'on peut faire de l'objet essayé : l'acheter, l'utiliser, ou seulement regarder (avec une note). */
export type FittingAction =
  | { readonly kind: 'buy'; readonly price: number; readonly affordable: boolean }
  | { readonly kind: 'equip' }
  | { readonly kind: 'none'; readonly note: string };

/**
 * Bandeau de l'essai d'un objet de la boutique (la caméra tourne autour de
 * la barque) : son nom, de quoi l'acheter ou l'utiliser, et le retour à la
 * boutique.
 */
export class FittingHud {
  private readonly root = createElement('pen-view fitting');
  private readonly title = createElement('pen-view-title');
  private readonly note = createElement('fitting-note');
  private readonly action = document.createElement('button');

  constructor(layer: HTMLElement, onAction: () => void, onBack: () => void) {
    this.action.type = 'button';
    this.action.className = 'shop-action';
    this.action.addEventListener('click', () => {
      this.action.blur();
      onAction();
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'shop-action is-quiet';
    back.textContent = TEXTS.fitting.back;
    back.addEventListener('click', () => {
      back.blur();
      onBack();
    });
    this.root.append(this.title, this.note, this.action, back);
    this.root.hidden = true;
    layer.append(this.root);
  }

  show(item: ShopItem, action: FittingAction): void {
    this.title.textContent = TEXTS.fitting.title(item.name);
    this.note.textContent = action.kind === 'none' ? action.note : '';
    this.note.hidden = action.kind !== 'none' || action.note === '';
    this.action.hidden = action.kind === 'none';
    if (action.kind === 'buy') {
      this.action.textContent = TEXTS.fitting.buy(action.price);
      this.action.disabled = !action.affordable;
    } else if (action.kind === 'equip') {
      this.action.textContent = TEXTS.cabin.shop.equip;
      this.action.disabled = false;
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
