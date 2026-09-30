/**
 * Mode d'entrée courant : souris et clavier, ou écran tactile.
 *
 * Il suit le dernier appui (un doigt → tactile, la souris → souris). Au
 * lancement, on part du type d'écran (`pointer: coarse` = doigt). La classe
 * `is-touch` sur <html> permet au CSS d'adapter l'interface (joystick,
 * raccourcis clavier masqués…).
 */

type Listener = (touch: boolean) => void;

const listeners = new Set<Listener>();
let touch = window.matchMedia('(pointer: coarse)').matches;

document.documentElement.classList.toggle('is-touch', touch);
window.addEventListener('pointerdown', (event) => setTouchMode(event.pointerType === 'touch'), { capture: true });

/** Le joueur utilise-t-il un écran tactile ? */
export function isTouchMode(): boolean {
  return touch;
}

/** Prévient quand le joueur passe de la souris au tactile, ou inversement. */
export function onTouchModeChange(listener: Listener): void {
  listeners.add(listener);
}

function setTouchMode(next: boolean): void {
  if (next === touch) return;
  touch = next;
  document.documentElement.classList.toggle('is-touch', touch);
  listeners.forEach((listener) => listener(touch));
}
