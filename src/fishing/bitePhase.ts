import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import { TEXTS } from '../ui/texts';
import type { FishingContext } from './fishingContext';
import { selectFish } from './fishSelector';
import { HookedFish } from './hookedFish';

const _tip = new Vector3();
const _screen = new Vector3();

/**
 * Attente et ferrage : WAITING → BITE → REELING (ou ESCAPED).
 * Le bouchon frémit (fausses touches), puis plonge : il faut cliquer dans la
 * fenêtre de ferrage. Cliquer trop tôt ramène la ligne, sans autre pénalité.
 */
export class BitePhase {
  private readonly ctx: FishingContext;

  constructor(ctx: FishingContext) {
    this.ctx = ctx;
  }

  updateWaiting(dt: number): void {
    const ctx = this.ctx;
    if (ctx.deps.input.wasPointerPressed) {
      ctx.escape(ctx.biteTimer.isNibbling ? 'early' : 'cancel');
      return;
    }
    const event = ctx.biteTimer.update(dt);
    if (event === 'nibble') this.nibble();
    if (event === 'bite') this.bite();
  }

  updateBite(): void {
    const ctx = this.ctx;
    this.updateBiteAlert();
    if (ctx.deps.input.wasPointerPressed) this.hook();
    else if (ctx.fsm.timeInState > ctx.hookWindow) ctx.escape('missed');
  }

  /** Fausse touche : le bouchon frémit. */
  private nibble(): void {
    const ctx = this.ctx;
    ctx.bobber.nibble();
    ctx.rippleAtBobber(0.7, 0.8, 0.4);
    ctx.deps.rod.kick(CONFIG.rod.nibbleKick);
    ctx.deps.audio.play('nibble', 0.15);
  }

  /** Vraie touche : le bouchon plonge, la fenêtre de ferrage s'ouvre. */
  private bite(): void {
    const ctx = this.ctx;
    ctx.bobber.plunge();
    ctx.rippleAtBobber(1.3, 0.9, 0.8);
    ctx.splashAtBobber(0.7);
    ctx.deps.rod.kick(CONFIG.rod.biteKick);
    ctx.deps.audio.play('bite');
    ctx.fsm.go('BITE');
  }

  /** Place le « ! » au-dessus du bouchon, en coordonnées écran. */
  private updateBiteAlert(): void {
    const { showBiteAlert, bobber, deps } = this.ctx;
    if (!showBiteAlert) return;
    _screen.copy(bobber.position).setY(bobber.position.y + 0.9).project(deps.camera);
    if (_screen.z > 1) {
      deps.fishingHud.hideBiteAlert();
      return;
    }
    deps.fishingHud.showBiteAlert((_screen.x * 0.5 + 0.5) * window.innerWidth, (-_screen.y * 0.5 + 0.5) * window.innerHeight);
  }

  /** Ferrage réussi : on tire au sort le poisson et le combat commence. */
  private hook(): void {
    const ctx = this.ctx;
    const { fishingHud, rod, hud, clock } = ctx.deps;
    fishingHud.hideBiteAlert();
    rod.kick(CONFIG.rod.hookKick);
    hud.toast(TEXTS.hooked);
    const { place, boosts, weather } = ctx.deps;
    const roll = selectFish({ place, zone: ctx.zone, hour: clock.hour, bait: ctx.bait, weather: weather(), hotspot: ctx.hotspot, boosts: boosts() });
    ctx.hooked = new HookedFish(roll, ctx.deps.gear(), rod.tipPosition(_tip), ctx.bobber.position);
    this.logHook();
    ctx.fsm.go('REELING');
  }

  private logHook(): void {
    const hooked = this.ctx.hooked;
    if (!CONFIG.debug.logBites || !hooked) return;
    const { species, sizeCm, strength, variant } = hooked.roll;
    const name = variant ? species.variant.name : species.name;
    info('pêche', `ferré : ${name}, ${sizeCm} cm, force ${strength.toFixed(2)}`);
  }
}
