import { CONFIG } from '../config';
import { createElement } from './hud';

/**
 * Joystick virtuel pour ramer sur écran tactile, en bas à gauche.
 * Vers le haut : avancer ; vers le bas : reculer ; sur les côtés : tourner.
 * Il n'apparaît qu'en mode tactile (classe `is-touch`, voir pointerMode.ts)
 * et s'efface quand la barque ne peut pas bouger (ligne à l'eau).
 */
export class TouchStick {
  /** Direction de -1 à 1 : x = virage (droite positive), y = poussée (avant positif). */
  readonly value = { x: 0, y: 0 };
  /** Poussé à fond vers l'avant : on rame plus fort. */
  sprint = false;
  private readonly root = createElement('touch-stick');
  private readonly knob = createElement('touch-stick-knob');
  private pointerId: number | null = null;
  private available = true;
  private sensitivity = 1;

  constructor(layer: HTMLElement) {
    this.root.append(this.knob);
    layer.append(this.root);
    this.root.addEventListener('pointerdown', this.onDown);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('pointercancel', this.onUp);
  }

  /** Sensibilité (réglage) : > 1 = il suffit de pousser moins loin. */
  setSensitivity(sensitivity: number): void {
    this.sensitivity = sensitivity;
  }

  /** Affiché seulement quand ramer est possible. */
  setAvailable(available: boolean): void {
    if (available === this.available) return;
    this.available = available;
    this.root.classList.toggle('is-away', !available);
    if (!available) this.release();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.root.setPointerCapture(event.pointerId);
    this.follow(event);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.follow(event);
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.release();
  };

  private release(): void {
    this.pointerId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.setSprint(false);
    this.knob.style.transform = '';
  }

  private setSprint(sprint: boolean): void {
    if (sprint === this.sprint) return;
    this.sprint = sprint;
    this.root.classList.toggle('is-sprint', sprint);
  }

  /** Le bouton suit le doigt sans sortir du cercle. */
  private follow(event: PointerEvent): void {
    const rect = this.root.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = event.clientX - (rect.left + radius);
    let dy = event.clientY - (rect.top + radius);
    const distance = Math.hypot(dx, dy);
    this.setSprint(dy < 0 && (distance / radius) * this.sensitivity >= CONFIG.touch.stickSprintZone);
    if (distance > radius) {
      dx *= radius / distance;
      dy *= radius / distance;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.value.x = Math.max(-1, Math.min(1, withDeadZone(dx / radius) * this.sensitivity));
    this.value.y = Math.max(-1, Math.min(1, withDeadZone(-dy / radius) * this.sensitivity));
  }
}

/** Petite zone morte par axe : on peut avancer tout droit sans dériver. */
function withDeadZone(value: number): number {
  const deadZone = CONFIG.touch.stickDeadZone;
  const magnitude = Math.abs(value);
  if (magnitude < deadZone) return 0;
  return (Math.sign(value) * (magnitude - deadZone)) / (1 - deadZone);
}
