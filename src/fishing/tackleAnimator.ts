import { MathUtils, Vector3 } from 'three';
import { CONFIG } from '../config';
import { yawOf } from '../core/math';
import type { FishingContext } from './fishingContext';
import type { FishingState } from './fishingState';

/** Mou de la ligne selon l'état (0 = tendue, 1 = posée sur l'eau). */
const LINE_SLACK: Record<FishingState, number> = {
  IDLE: 0,
  CHARGING: 0,
  CASTING: 0.15,
  WAITING: 1,
  BITE: 0,
  REELING: 0,
  CAUGHT: 0,
  ESCAPED: 0.3,
};

const _tip = new Vector3();
const _attach = new Vector3();

/**
 * Animation du matériel à chaque image, selon l'état de la pêche : canne
 * (inclinaison et orientation), bouchon, ligne (mou et tension) et ronds
 * dans l'eau.
 */
export class TackleAnimator {
  private readonly ctx: FishingContext;

  constructor(ctx: FishingContext) {
    this.ctx = ctx;
  }

  update(dt: number, elapsed: number): void {
    const { deps, bobber, line, ripples, fsm, hooked } = this.ctx;
    const { rod } = deps;
    rod.setPitch(this.rodPitch());
    rod.setYaw(this.rodYaw());
    rod.update(dt);
    rod.tipPosition(_tip);
    bobber.update(dt, elapsed, _tip);
    line.update(dt, _tip, bobber.lineAttach(_attach), LINE_SLACK[fsm.state]);
    line.setTension(fsm.state === 'REELING' ? (hooked?.fight.tension ?? 0) : 0);
    ripples.update(dt, elapsed);
  }

  /** Inclinaison de la canne voulue dans l'état courant. */
  private rodPitch(): number {
    const rod = CONFIG.rod;
    const { fsm, power, hooked } = this.ctx;
    switch (fsm.state) {
      case 'IDLE':
        return rod.restPitch;
      case 'CHARGING':
        return MathUtils.lerp(rod.chargePitch.start, rod.chargePitch.end, power);
      case 'CASTING':
        return rod.castPitch;
      case 'BITE':
        return rod.bitePitch;
      case 'REELING':
        // Plus la ligne est tendue, plus le poisson fait plier la canne vers l'eau
        return MathUtils.lerp(rod.reelPitch, rod.bitePitch, hooked?.fight.tension ?? 0);
      case 'CAUGHT':
        return rod.reelPitch;
      default:
        return rod.waitPitch;
    }
  }

  /** Orientation de la canne (relative à la barque) : vers la visée, puis vers le bouchon. */
  private rodYaw(): number | null {
    const { deps, fsm, aimYaw, bobber } = this.ctx;
    const { boat } = deps;
    if (fsm.state === 'CHARGING') return aimYaw - boat.yaw;
    if (fsm.state === 'IDLE' || bobber.isHome) return null;
    const { x, z } = bobber.position;
    return yawOf(x - boat.position.x, z - boat.position.z) - boat.yaw;
  }
}
