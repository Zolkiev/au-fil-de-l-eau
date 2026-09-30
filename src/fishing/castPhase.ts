import { MathUtils, Vector3 } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import { zoneAt } from '../scene/levelLoader';
import { TEXTS } from '../ui/texts';
import type { FishingContext } from './fishingContext';

const _tip = new Vector3();
const _landing = new Vector3();

/**
 * Lancer : IDLE → CHARGING → CASTING → WAITING.
 * Clic maintenu pour charger la puissance (la souris vise), relâcher pour
 * lancer, puis le bouchon vole jusqu'à l'eau.
 */
export class CastPhase {
  private readonly ctx: FishingContext;

  constructor(ctx: FishingContext) {
    this.ctx = ctx;
  }

  updateIdle(): void {
    if (this.ctx.deps.input.wasPointerPressed) this.ctx.fsm.go('CHARGING');
  }

  updateCharging(): void {
    const { fsm, deps } = this.ctx;
    if (deps.input.wasPressed(CONFIG.controls.cancel)) {
      this.hideChargeUi();
      fsm.go('IDLE');
      return;
    }
    const landing = this.chargeAndAim();
    if (!deps.input.wasPointerReleased) return;
    this.hideChargeUi();
    if (landing) {
      this.cast(landing);
    } else {
      deps.hud.toast(TEXTS.noWater);
      fsm.go('IDLE');
    }
  }

  updateCasting(): void {
    if (!this.ctx.bobber.isFlying) this.land();
  }

  /** Fait osciller la puissance et suit la visée ; retourne le point de chute (ou null). */
  private chargeAndAim(): Vector3 | null {
    const ctx = this.ctx;
    const { input, boat, camera, fishingHud } = ctx.deps;
    const { minCastDistance, maxCastDistance, chargeDuration } = CONFIG.fishing;
    ctx.power = MathUtils.pingpong(ctx.fsm.timeInState / chargeDuration);
    ctx.aimYaw = ctx.aim.aimYaw(camera, input.pointer, boat.position);
    const distance = MathUtils.lerp(minCastDistance, maxCastDistance, ctx.power);
    const landing = ctx.aim.landingPoint(boat.position, ctx.aimYaw, distance, _landing);
    fishingHud.showPower(ctx.power, this.landingLabel(landing));
    ctx.aim.showMarker(landing, ctx.elapsed);
    return landing;
  }

  /** Nom de la zone visée, affiché au-dessus de la jauge de puissance. */
  private landingLabel(landing: Vector3 | null): string {
    if (!landing) return TEXTS.noWater;
    const zone = zoneAt(this.ctx.deps.level.zones, landing.x, landing.z);
    const hotspot = this.ctx.deps.hotspots.isNear(landing.x, landing.z) ? `${TEXTS.signs.icon} ` : '';
    return `${hotspot}${TEXTS.zones[zone?.type ?? 'open']}`;
  }

  private hideChargeUi(): void {
    this.ctx.deps.fishingHud.hidePower();
    this.ctx.aim.showMarker(null, this.ctx.elapsed);
  }

  /** Lance le bouchon en arc, de la pointe de la canne vers `landing`. */
  private cast(landing: Vector3): void {
    const { deps, bobber, fsm, events } = this.ctx;
    const { flightTime, arcHeight } = CONFIG.fishing;
    const from = deps.rod.tipPosition(_tip);
    const distance = Math.hypot(landing.x - from.x, landing.z - from.z);
    const duration = flightTime.base + flightTime.perMeter * distance;
    bobber.launch(from, landing, duration, arcHeight.base + arcHeight.perMeter * distance);
    deps.rod.kick(CONFIG.rod.castKick);
    deps.audio.play('cast');
    fsm.go('CASTING');
    events.emit('cast', undefined);
  }

  /** Le bouchon touche l'eau : plouf, puis on programme les touches. */
  private land(): void {
    const ctx = this.ctx;
    const { x, z } = ctx.bobber.position;
    ctx.rippleAtBobber(1.6);
    ctx.deps.audio.play('splash');
    ctx.zone = zoneAt(ctx.deps.level.zones, x, z)?.type ?? null;
    ctx.hotspot = ctx.deps.hotspots.claim(x, z);
    if (ctx.hotspot) ctx.deps.hud.toast(TEXTS.signs.hotspot);
    const delay = ctx.biteTimer.start({ zone: ctx.zone, hour: ctx.deps.clock.hour, bait: ctx.bait, weather: ctx.deps.weather(), hotspot: ctx.hotspot });
    this.logCast(delay);
    ctx.fsm.go('WAITING');
  }

  private logCast(delay: number): void {
    if (!CONFIG.debug.logBites) return;
    const { zone, bait, biteTimer, deps } = this.ctx;
    const nibbles = biteTimer.pendingNibbles;
    info('pêche', `${TEXTS.zones[zone ?? 'open']}, ${deps.clock.label}, ${bait.name} → touche dans ${delay.toFixed(1)} s, ${nibbles} fausse(s) touche(s)`);
  }
}
