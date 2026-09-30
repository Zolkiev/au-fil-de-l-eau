import { Vector2 } from 'three';

/** Touches dont on bloque l'effet par défaut du navigateur (défilement de la page). */
const BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/**
 * État du clavier et du pointeur (souris ou doigt), lu à chaque frame par le jeu.
 *
 * Une touche est reconnue de deux façons (voir CONFIG.controls) :
 *  - par la lettre tapée (« w », « z »…) : WASD et ZQSD marchent donc tous
 *    les deux, sur n'importe quel clavier ;
 *  - par son code physique (« ArrowUp », « Digit1 »…) pour le reste.
 *
 * Sur écran tactile, seul le doigt posé sur le jeu compte : un autre doigt
 * (sur le joystick par exemple) ne vise pas et ne relâche pas le lancer.
 */
export class Input {
  /** Position du pointeur en coordonnées normalisées (-1 → 1), pour viser. */
  readonly pointer = new Vector2();
  private readonly surface: HTMLElement;
  /** Touches maintenues : code physique → lettre tapée (ou null). */
  private readonly held = new Map<string, string | null>();
  /** Codes et lettres des touches enfoncées pendant cette frame. */
  private readonly pressedThisFrame = new Set<string>();
  private pointerDown = false;
  /** Identifiant du pointeur qui maintient l'appui sur le jeu (null si aucun). */
  private activePointer: number | null = null;
  private pointerPressed = false;
  private pointerReleased = false;

  constructor(surface: HTMLElement) {
    this.surface = surface;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('contextmenu', (event) => event.preventDefault());
    // Safari (iOS) : pas de zoom à deux doigts sur le jeu
    document.addEventListener('gesturestart', (event) => event.preventDefault());
  }

  /** Une de ces touches (codes ou lettres) est-elle maintenue ? */
  isHeld(bindings: readonly string[]): boolean {
    for (const [code, letter] of this.held) {
      if (bindings.includes(code) || (letter !== null && bindings.includes(letter))) return true;
    }
    return false;
  }

  /** Une de ces touches vient-elle d'être enfoncée ? (vrai pendant une seule frame) */
  wasPressed(bindings: readonly string[]): boolean {
    return bindings.some((binding) => this.pressedThisFrame.has(binding));
  }

  /** Axe de -1 à 1 à partir de deux groupes de touches opposés. */
  axis(negative: readonly string[], positive: readonly string[]): number {
    return Number(this.isHeld(positive)) - Number(this.isHeld(negative));
  }

  get isPointerHeld(): boolean {
    return this.pointerDown;
  }

  /** Le bouton principal vient-il d'être enfoncé sur le jeu ? (une seule frame) */
  get wasPointerPressed(): boolean {
    return this.pointerPressed;
  }

  /** Le bouton principal vient-il d'être relâché ? (une seule frame) */
  get wasPointerReleased(): boolean {
    return this.pointerReleased;
  }

  /** À appeler à la toute fin de chaque frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.pointerPressed = false;
    this.pointerReleased = false;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (BLOCKED_KEYS.has(event.code)) event.preventDefault();
    const letter = letterOf(event);
    if (!event.repeat) {
      this.pressedThisFrame.add(event.code);
      if (letter) this.pressedThisFrame.add(letter);
    }
    this.held.set(event.code, letter);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  /** Fenêtre quittée : on relâche tout pour éviter une touche « collée ». */
  private readonly onBlur = (): void => {
    this.held.clear();
    if (this.pointerDown) this.pointerReleased = true;
    this.pointerDown = false;
    this.activePointer = null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    // La souris vise même sans clic ; un doigt ne vise que s'il est posé sur le jeu
    if (event.pointerType !== 'mouse' && event.pointerId !== this.activePointer) return;
    this.aimAt(event);
  };

  private aimAt(event: PointerEvent): void {
    const rect = this.surface.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.set(x, y);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.activePointer !== null) return;
    this.activePointer = event.pointerId;
    this.aimAt(event);
    this.pointerDown = true;
    this.pointerPressed = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.pointerDown = false;
    this.pointerReleased = true;
  };
}

/** Caractère tapé, en minuscule (null pour les touches spéciales comme « Shift »). */
function letterOf(event: KeyboardEvent): string | null {
  return event.key.length === 1 ? event.key.toLowerCase() : null;
}
