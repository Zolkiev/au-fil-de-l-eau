import { MathUtils, Vector3 } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import { isTouchMode } from '../core/pointerMode';
import { zoneAt } from '../scene/levelLoader';
import { TEXTS } from '../ui/texts';
import type { AimTarget } from './castAim';
import type { FishingContext } from './fishingContext';

const _tip = new Vector3();
const _landing = new Vector3();
const _aim: AimTarget = { yaw: 0, distance: 0 };

/**
 * Lancer : IDLE → CHARGING → CASTING → WAITING.
 * Le bouchon part là où l'on pointe : appuyer sur l'eau fait apparaître le
 * repère et la trajectoire, on ajuste en gardant l'appui, et relâcher lance.
 * Un simple clic (ou une touche du doigt) lance donc aussitôt à cet endroit.
 */
export class CastPhase {
  private readonly ctx: FishingContext;
  /** Visée au doigt : distance du point touché au départ, et hauteur du doigt à ce moment (px). */
  private touchStart: { distance: number; y: number } | null = null;

  constructor(ctx: FishingContext) {
    this.ctx = ctx;
  }

  updateIdle(): void {
    if (!this.ctx.deps.input.wasPointerPressed) return;
    this.touchStart = null;
    this.ctx.power = 0;
    this.ctx.fsm.go('CHARGING');
  }

  updateCharging(dt: number): void {
    const { fsm, deps } = this.ctx;
    if (deps.input.wasPressed(CONFIG.controls.cancel)) {
      this.hideChargeUi();
      fsm.go('IDLE');
      return;
    }
    const landing = this.aim(dt);
    // Un appui très bref peut être relâché avant même cette image
    if (!deps.input.wasPointerReleased && deps.input.isPointerHeld) return;
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

  /**
   * Suit le pointeur : repère sur l'eau, trajectoire, jauge de distance et
   * canne qui part en arrière. Retourne le point de chute (ou null).
   */
  private aim(dt: number): Vector3 | null {
    const ctx = this.ctx;
    const { input, boat, camera, fishingHud, rod } = ctx.deps;
    const { minCastDistance, maxCastDistance, chargeResponse } = CONFIG.fishing;
    const target = ctx.aim.target(camera, input.pointer, boat.position, _aim);
    ctx.aimYaw = target.yaw;
    const landing = ctx.aim.landingPoint(boat.position, target.yaw, this.aimDistance(target.distance), _landing);
    const reach = landing ? Math.hypot(landing.x - boat.position.x, landing.z - boat.position.z) : minCastDistance;
    const power = MathUtils.inverseLerp(minCastDistance, maxCastDistance, reach);
    // La canne part d'autant plus en arrière que l'on vise loin
    ctx.power = MathUtils.damp(ctx.power, power, chargeResponse, dt);
    fishingHud.showPower(power, this.landingLabel(landing, reach));
    ctx.aim.showMarker(landing, ctx.elapsed);
    ctx.aim.showPath(landing ? rod.tipPosition(_tip) : null, landing, ctx.elapsed);
    return landing;
  }

  /**
   * Distance du lancer. À la souris : celle du point visé. Au doigt (qui
   * cache ce qu'il vise, et manque de précision au loin) : celle du point
   * touché au départ, puis glisser vers le haut ou le bas la règle finement.
   */
  private aimDistance(pointed: number): number {
    if (!isTouchMode()) return pointed;
    const { minCastDistance, maxCastDistance } = CONFIG.fishing;
    const y = this.ctx.deps.input.pointerPixels.y;
    this.touchStart ??= { distance: pointed, y };
    const wanted = this.touchStart.distance + (this.touchStart.y - y) * CONFIG.touch.aimMetersPerPixel;
    const distance = MathUtils.clamp(wanted, minCastDistance, maxCastDistance);
    // En butée, le départ suit le doigt : repartir dans l'autre sens agit tout de suite
    this.touchStart.distance += distance - wanted;
    return distance;
  }

  /** Zone visée et distance, affichées au-dessus de la jauge. */
  private landingLabel(landing: Vector3 | null, reach: number): string {
    if (!landing) return TEXTS.noWater;
    const zone = zoneAt(this.ctx.deps.level.zones, landing.x, landing.z);
    const hotspot = this.ctx.deps.hotspots.isNear(landing.x, landing.z) ? `${TEXTS.signs.icon} ` : '';
    return TEXTS.aimLabel(`${hotspot}${TEXTS.zones[zone?.type ?? 'open']}`, reach);
  }

  private hideChargeUi(): void {
    this.ctx.deps.fishingHud.hidePower();
    this.ctx.aim.showMarker(null, this.ctx.elapsed);
    this.ctx.aim.showPath(null, null, this.ctx.elapsed);
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
    ctx.splashAtBobber(1);
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
