import type { Vector3 } from 'three';
import { CONFIG } from '../config';
import { keyHints } from '../core/controls';
import type { Emitter } from '../core/events';
import { isTouchMode, onTouchModeChange } from '../core/pointerMode';
import type { FishingEvents } from '../fishing/fishingController';
import type { EscapeReason, FishingState } from '../fishing/fishingState';
import { createElement } from './hud';
import { TEXTS } from './texts';

type StepId = keyof typeof TEXTS.tutorial.steps;

const STEPS: readonly StepId[] = ['cast', 'strike', 'reel', 'caught', 'explore', 'cabin'];

/** Ce que le tutoriel regarde à chaque frame. */
export interface TutorialView {
  readonly fishing: FishingState;
  readonly boat: Vector3;
}

/**
 * Premier lancement guidé par Moustache : une bulle en haut de l'écran qui
 * explique une chose à la fois et avance quand le joueur l'a faite (lancer,
 * ferrer, remonter, ramer, aller au ponton). Rien n'est bloqué : on peut
 * jouer librement, ou passer le tutoriel.
 */
export class Tutorial {
  private readonly root = createElement('tutorial');
  private readonly text = createElement('tutorial-text');
  private readonly counter = createElement('tutorial-counter');
  private readonly onFinish: () => void;
  private step: StepId | null = null;
  private stepTime = 0;
  private tip: string | null = null;
  private tipTime = 0;
  private startX = 0;
  private startZ = 0;

  constructor(layer: HTMLElement, events: Emitter<FishingEvents>, onFinish: () => void) {
    this.onFinish = onFinish;
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'tutorial-skip';
    skip.textContent = TEXTS.tutorial.skip;
    skip.addEventListener('click', () => this.finish());
    const body = createElement('tutorial-body');
    body.append(this.text, this.counter);
    this.root.append(createElement('tutorial-avatar', '🐈'), body, skip);
    this.root.hidden = true;
    layer.append(this.root);
    events.on('cast', () => this.advanceFrom('cast'));
    events.on('catch', () => this.advanceFrom('reel'));
    events.on('escape', ({ reason }) => this.onEscape(reason));
    onTouchModeChange(() => this.render());
  }

  get isActive(): boolean {
    return this.step !== null;
  }

  /** Réaffiche le texte (touches changées). */
  refresh(): void {
    this.render();
  }

  /** (Re)commence au début. */
  start(): void {
    this.go('cast');
  }

  /** Masquée hors du jeu (menus, carnet, ponton), sans perdre l'étape en cours. */
  setVisible(visible: boolean): void {
    this.root.hidden = !visible || this.step === null;
  }

  /** Le joueur a ouvert le ponton (dernière étape). */
  notifyCabin(): void {
    if (this.step === 'cabin') this.finish();
  }

  update(dt: number, view: TutorialView): void {
    if (!this.step) return;
    this.stepTime += dt;
    this.updateTip(dt);
    const { explore, cabin } = CONFIG.tutorial;
    switch (this.step) {
      case 'strike':
        if (view.fishing === 'REELING') this.go('reel');
        return;
      case 'caught':
        if (view.fishing === 'IDLE') this.go('explore', view.boat);
        return;
      case 'explore':
        if (Math.hypot(view.boat.x - this.startX, view.boat.z - this.startZ) > explore.distance || this.stepTime > explore.seconds) this.go('cabin');
        return;
      case 'cabin':
        if (this.stepTime > cabin.seconds) this.finish();
        return;
    }
  }

  private advanceFrom(step: StepId): void {
    if (this.step !== step) return;
    this.go(STEPS[STEPS.indexOf(step) + 1]);
  }

  /** Raté : un conseil, et on relance (retour à l'étape du lancer). */
  private onEscape(reason: EscapeReason): void {
    if (this.step !== 'strike' && this.step !== 'reel') return;
    this.go('cast');
    this.showTip(TEXTS.tutorial.tips[reason]);
  }

  private go(step: StepId, boat?: Vector3): void {
    this.step = step;
    this.stepTime = 0;
    this.tip = null;
    if (boat) {
      this.startX = boat.x;
      this.startZ = boat.z;
    }
    this.root.hidden = false;
    this.root.classList.remove('is-new');
    void this.root.offsetWidth; // relance l'animation d'apparition
    this.root.classList.add('is-new');
    this.render();
  }

  private showTip(tip: string): void {
    this.tip = tip;
    this.tipTime = CONFIG.tutorial.tipSeconds;
    this.render();
  }

  private updateTip(dt: number): void {
    if (!this.tip) return;
    this.tipTime -= dt;
    if (this.tipTime > 0) return;
    this.tip = null;
    this.render();
  }

  private render(): void {
    if (!this.step) return;
    const texts = TEXTS.tutorial.steps[this.step];
    this.text.textContent = this.tip ?? (isTouchMode() ? texts.touch : texts.mouse(keyHints()));
    this.counter.textContent = TEXTS.tutorial.progress(STEPS.indexOf(this.step) + 1, STEPS.length);
  }

  private finish(): void {
    this.step = null;
    this.root.hidden = true;
    this.onFinish();
  }
}
