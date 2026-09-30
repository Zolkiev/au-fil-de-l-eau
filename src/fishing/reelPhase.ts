import { Vector2, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { FishingContext } from './fishingContext';
import type { HookedFish } from './hookedFish';

/** Intervalle entre deux petits ronds laissés par le poisson pendant la remontée (s). */
const TRAIL_INTERVAL = 0.45;

const _towTarget = new Vector2();

/**
 * Remontée et fin : REELING → CAUGHT | ESCAPED → IDLE.
 * Mini-jeu de tension (clic maintenu = mouliner), présentation de la prise,
 * et retour de la ligne vers la barque.
 */
export class ReelPhase {
  private readonly ctx: FishingContext;
  /** Point d'où le poisson a sauté hors de l'eau. */
  private readonly catchOrigin = new Vector3();
  private trailTimer = 0;

  constructor(ctx: FishingContext) {
    this.ctx = ctx;
  }

  /** Mini-jeu de remontée : clic maintenu = mouliner. */
  updateReeling(dt: number): void {
    const ctx = this.ctx;
    const hooked = ctx.hooked;
    if (!hooked) return;
    const reeling = ctx.deps.input.isPointerHeld;
    const event = hooked.fight.update(dt, reeling);
    if (reeling) ctx.tickReel(dt);
    const target = hooked.bobberTarget(ctx.elapsed, _towTarget);
    ctx.bobber.towTo(target.x, target.y);
    this.leaveTrail(dt);
    ctx.deps.fishingHud.reel.update(hooked.fight);
    if (event === 'burst') this.fishBurst();
    else if (event === 'snapped') this.snapLine();
    else if (event === 'landed') this.landFish(hooked);
  }

  /** Présentation de la prise, jusqu'à ce que le joueur clique (ou appuie sur Espace). */
  updateCaught(dt: number): void {
    const { showcase, fsm, deps } = this.ctx;
    this.startShowcaseWhenReady();
    showcase.update(dt, deps.camera);
    if (fsm.timeInState < CONFIG.catchDisplay.minTime) return;
    if (deps.input.wasPointerPressed || deps.input.wasPressed(CONFIG.controls.confirm)) this.closeCatch();
  }

  /** Ligne vide ramenée vers la barque. */
  updateEscaped(dt: number): void {
    this.ctx.tickReel(dt);
    if (this.ctx.bobber.isHome) this.ctx.fsm.go('IDLE');
  }

  /** Petits ronds réguliers derrière le poisson. */
  private leaveTrail(dt: number): void {
    this.trailTimer -= dt;
    if (this.trailTimer > 0) return;
    this.trailTimer = TRAIL_INTERVAL;
    this.ctx.rippleAtBobber(0.6, 0.9, 0.35);
  }

  /** À-coup du poisson : gerbe d'eau, la canne plonge. */
  private fishBurst(): void {
    const ctx = this.ctx;
    ctx.rippleAtBobber(1.2, 0.8, 0.7);
    ctx.deps.rod.kick(CONFIG.rod.biteKick * 0.7);
    ctx.deps.audio.play('splash', 0.2, 0.5);
  }

  private snapLine(): void {
    this.ctx.deps.audio.play('snap');
    this.ctx.deps.fishingHud.reel.hide();
    this.ctx.escape('snapped');
  }

  /** Poisson ramené : il saute hors de l'eau, rejoint le carnet et se présente. */
  private landFish(hooked: HookedFish): void {
    const ctx = this.ctx;
    const { roll } = hooked;
    const { journal, fishingHud, audio, level } = ctx.deps;
    this.catchOrigin.set(ctx.bobber.position.x, level.water.level, ctx.bobber.position.z);
    ctx.rippleAtBobber(1.8, 1.2, 0.8);
    ctx.bobber.returnHome();
    fishingHud.reel.hide();
    const result = journal.record(roll.species.id, roll.sizeCm, roll.variant);
    fishingHud.catchPopup.show(roll, result);
    audio.play('splash');
    audio.play('catch', 0);
    ctx.fsm.go('CAUGHT');
    ctx.events.emit('catch', { roll, result });
  }

  /** Le modèle 3D peut finir de charger après la prise : on lance le saut dès qu'il est prêt. */
  private startShowcaseWhenReady(): void {
    const { showcase, hooked } = this.ctx;
    if (showcase.isActive || !hooked?.model) return;
    showcase.start(hooked.model, hooked.roll.sizeCm / 100, this.catchOrigin);
  }

  private closeCatch(): void {
    const ctx = this.ctx;
    ctx.showcase.hide();
    ctx.deps.fishingHud.catchPopup.hide();
    ctx.hooked = null;
    ctx.fsm.go('IDLE');
  }
}
