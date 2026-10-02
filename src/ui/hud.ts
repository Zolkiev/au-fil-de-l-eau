import { TEXTS } from './texts';

/** Nombre maximal de messages empilés à l'écran. */
const MAX_TOASTS = 3;

/**
 * Interface superposée au canvas, en HTML/CSS sans framework.
 * Le calque #hud laisse passer les clics vers le jeu (pointer-events: none),
 * sauf sur les éléments interactifs.
 */
export class Hud {
  readonly layer: HTMLElement;
  private readonly prompt: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private hintsVisible = true;
  /** Compteur d'images par seconde (Réglages › Affichage), créé à la première utilisation. */
  private fps: HTMLDivElement | null = null;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.prompt = createElement('hud-prompt');
    this.prompt.hidden = true;
    this.toasts = createElement('hud-toasts');
    layer.append(this.prompt, this.toasts);
  }

  /** Fait disparaître l'écran de chargement en fondu. */
  hideLoading(): void {
    const loading = document.getElementById('loading');
    if (!loading) return;
    loading.addEventListener('transitionend', () => loading.remove(), { once: true });
    loading.classList.add('is-hidden');
  }

  /** Texte de l'écran de chargement (« Préparation de la rivière… »). */
  setLoadingText(text: string): void {
    const element = document.querySelector('#loading .loading-text');
    if (element) element.textContent = text;
  }

  /** Départ vers un autre lieu : un voile couvre l'écran pendant le rechargement. */
  showTravel(text: string): void {
    this.layer.append(createElement('travel-veil', text));
  }

  /** Affiche une erreur bloquante à la place du texte de chargement. */
  showFatalError(message: string): void {
    const loading = document.getElementById('loading');
    loading?.classList.add('is-error');
    const text = loading?.querySelector('.loading-text');
    if (text) text.textContent = message;
  }

  /** Invite en bas de l'écran (texte vide = masquée). */
  setPrompt(text: string): void {
    this.prompt.textContent = text;
    this.prompt.hidden = text === '' || !this.hintsVisible;
  }

  /** Afficher ou non les invites (réglage « Aides à l'écran »). */
  setHintsVisible(visible: boolean): void {
    this.hintsVisible = visible;
    this.setPrompt(this.prompt.textContent ?? '');
  }

  /** Sur l'écran titre, l'interface de jeu (invite, matériel) est masquée. */
  setTitleMode(active: boolean): void {
    this.layer.classList.toggle('is-title', active);
  }

  /** Vue rapprochée (vivier) : l'interface de jeu s'efface pour laisser voir. */
  setViewMode(active: boolean): void {
    this.layer.classList.toggle('is-viewing', active);
  }

  /** Compteur d'images par seconde en haut de l'écran ; null le cache. */
  setFps(text: string | null): void {
    if (text === null) {
      if (this.fps) this.fps.hidden = true;
      return;
    }
    if (!this.fps) {
      this.fps = createElement('hud-fps');
      // En tête du calque : les menus, le carnet et le ponton passent par-dessus
      this.layer.prepend(this.fps);
    }
    this.fps.hidden = false;
    this.fps.textContent = text;
  }

  /** Message éphémère au centre de l'écran ; `long` laisse le temps de lire une phrase entière. */
  toast(text: string, long = false): void {
    const toast = createElement(long ? 'hud-toast is-long' : 'hud-toast', text);
    toast.addEventListener('animationend', () => toast.remove());
    this.toasts.append(toast);
    while (this.toasts.childElementCount > MAX_TOASTS) this.toasts.firstElementChild?.remove();
  }

  /** Signale discrètement les assets manquants ou mal nommés (détails dans la console). */
  showAssetStatus(usingPlaceholderLevel: boolean, warningCount: number): void {
    if (warningCount === 0) return;
    // En tête du calque : le carnet et les menus passent par-dessus
    this.layer.prepend(createElement('hud-notice', TEXTS.assetStatus(usingPlaceholderLevel, warningCount)));
  }
}

export function createElement(className: string, text = ''): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}
