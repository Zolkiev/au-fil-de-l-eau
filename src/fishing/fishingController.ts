import type { Vector3 } from 'three';
import { CONFIG } from '../config';
import type { Emitter } from '../core/events';
import type { Bait } from '../data/baits';
import { TEXTS } from '../ui/texts';
import { BitePhase } from './bitePhase';
import { CastPhase } from './castPhase';
import { FishingContext, type FishingDeps, type FishingEvents } from './fishingContext';
import type { FishingState } from './fishingState';
import { ReelPhase } from './reelPhase';
import { TackleAnimator } from './tackleAnimator';

export type { FishingDeps, FishingEvents };

/** États où l'on peut ouvrir le carnet (et donc mettre le jeu en pause). */
const PAUSABLE_STATES = new Set<FishingState>(['IDLE', 'CASTING', 'WAITING', 'BITE', 'REELING', 'ESCAPED']);

/** États où la caméra cadre le bouchon. */
const FOCUS_STATES = new Set<FishingState>(['CASTING', 'WAITING', 'BITE', 'REELING', 'ESCAPED']);

/**
 * Boucle de pêche, pilotée par une machine à états explicite :
 * IDLE → CHARGING → CASTING → WAITING → BITE → REELING → CAUGHT | ESCAPED → IDLE
 *
 * Ce fichier est la porte d'entrée : il expose l'interface utilisée par le
 * jeu et confie chaque état à sa phase (castPhase, bitePhase, reelPhase),
 * l'animation du matériel à tackleAnimator, et l'état partagé à fishingContext.
 */
export class FishingController {
  private readonly ctx: FishingContext;
  private readonly cast: CastPhase;
  private readonly bite: BitePhase;
  private readonly reel: ReelPhase;
  private readonly tackle: TackleAnimator;

  constructor(deps: FishingDeps) {
    this.ctx = new FishingContext(deps);
    this.cast = new CastPhase(this.ctx);
    this.bite = new BitePhase(this.ctx);
    this.reel = new ReelPhase(this.ctx);
    this.tackle = new TackleAnimator(this.ctx);
    deps.fishingHud.setBait(this.ctx.bait);
  }

  get events(): Emitter<FishingEvents> {
    return this.ctx.events;
  }

  get state(): FishingState {
    return this.ctx.fsm.state;
  }

  get currentBait(): Bait {
    return this.ctx.bait;
  }

  /**
   * Peut-on mettre le jeu en pause maintenant ? Pas pendant la charge d'un
   * lancer (le clic est en cours) ni pendant la présentation d'une prise.
   */
  get canPause(): boolean {
    return PAUSABLE_STATES.has(this.state);
  }

  /** Vrai dès que la ligne n'est plus au repos : la barque reste alors immobile. */
  get isBusy(): boolean {
    return this.state !== 'IDLE';
  }

  /** Point que la caméra doit cadrer (le bouchon quand il est à l'eau), ou null. */
  get focusPoint(): Vector3 | null {
    return FOCUS_STATES.has(this.state) ? this.ctx.bobber.position : null;
  }

  /** Change d'appât, seulement quand la ligne est au repos. */
  selectBait(bait: Bait): void {
    const { deps, events } = this.ctx;
    if (this.isBusy) {
      deps.hud.toast(TEXTS.baitLocked);
      return;
    }
    this.ctx.bait = bait;
    deps.fishingHud.setBait(bait);
    events.emit('bait', { bait });
  }

  /** Afficher ou non le « ! » à la vraie touche (réglage du joueur). */
  setShowBiteAlert(show: boolean): void {
    this.ctx.showBiteAlert = show;
    if (!show) this.ctx.deps.fishingHud.hideBiteAlert();
  }

  /** Réglages de confort : fenêtre de ferrage et taille du bouchon (× les valeurs de config.ts). */
  setComfort(hookWindowFactor: number, bobberSizeFactor: number): void {
    this.ctx.hookWindow = CONFIG.fishing.hookWindow * hookWindowFactor;
    this.ctx.bobber.setSizeFactor(bobberSizeFactor);
  }

  /** Réaffiche l'invite (après un changement de touches). */
  refreshPrompt(): void {
    this.ctx.refreshPrompt();
  }

  /** Lueur du bouchon selon la nuit (0 → 1). */
  setNight(night: number): void {
    this.ctx.bobber.setNight(night);
  }

  update(dt: number, elapsed: number): void {
    this.ctx.elapsed = elapsed;
    this.ctx.fsm.update(dt);
    this.updateState(dt);
    this.tackle.update(dt, elapsed);
  }

  private updateState(dt: number): void {
    switch (this.state) {
      case 'IDLE':
        return this.cast.updateIdle();
      case 'CHARGING':
        return this.cast.updateCharging(dt);
      case 'CASTING':
        return this.cast.updateCasting();
      case 'WAITING':
        return this.bite.updateWaiting(dt);
      case 'BITE':
        return this.bite.updateBite();
      case 'REELING':
        return this.reel.updateReeling(dt);
      case 'CAUGHT':
        return this.reel.updateCaught(dt);
      case 'ESCAPED':
        return this.reel.updateEscaped(dt);
    }
  }
}
