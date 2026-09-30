import { MathUtils, Quaternion, Vector3, type Object3D } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import type { BoatControls } from './boat';
import { findByBlenderName } from './objectNames';

export type OarSide = 'l' | 'r';

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const _sweep = new Quaternion();
const _dip = new Quaternion();
const _blade = new Vector3();

/** Une rame : son nœud (pivot au tolet), son orientation d'origine, sa poignée, et son coup de rame en cours. */
interface Oar {
  readonly node: Object3D;
  readonly base: Quaternion;
  readonly grip: Object3D;
  /** +1 à gauche, -1 à droite : la rame droite est tournée d'un demi-tour dans boat.glb. */
  readonly mirror: number;
  /** Avancée dans le coup de rame (rad). */
  phase: number;
  /** Balayage (rad, > 0 : pelle vers l'arrière) et plongée (rad, > 0 : pelle vers l'eau). */
  sweep: number;
  dip: number;
  wasInWater: boolean;
}

/**
 * Rames de la barque (`oar_l`, `oar_r` de boat.glb : pivot au tolet, rame
 * vers +X local, poignée marquée par `oar_*_grip`). Elles battent quand on
 * rame : chacune a son propre coup, en avant ou en arrière, et elles
 * s'opposent pour tourner. La pelle ne plonge que pendant la poussée.
 * Au repos, pelles juste au-dessus de l'eau ; pendant la pêche, rangées le
 * long de la coque.
 */
export class Oars {
  private readonly oars = new Map<OarSide, Oar>();
  private readonly onSplash: (position: Vector3) => void;

  constructor(boatModel: Object3D, onSplash: (position: Vector3) => void) {
    this.onSplash = onSplash;
    for (const side of ['l', 'r'] as const) {
      const oar = findOar(boatModel, side);
      if (oar) this.oars.set(side, oar);
    }
    if (this.oars.size < 2) info('barque', 'rames « oar_l » / « oar_r » absentes de boat.glb : pas de rames animées.');
  }

  /** Position (monde) de la poignée d'une rame, ou null s'il n'y a pas de rames. */
  gripPosition(side: OarSide, out: Vector3): Vector3 | null {
    const oar = this.oars.get(side);
    return oar ? oar.grip.getWorldPosition(out) : null;
  }

  /** Où en est le coup de rame, pour le pêcheur : -1 (poignées vers lui) → 1 (poignées poussées vers l'avant). */
  get stroke(): number {
    let total = 0;
    this.oars.forEach((oar) => (total += oar.sweep / CONFIG.oars.sweep));
    return this.oars.size ? MathUtils.clamp(total / this.oars.size, -1, 1) : 0;
  }

  /** `stowed` : la ligne est sortie, les rames se rangent le long de la coque. */
  update(dt: number, controls: BoatControls, stowed: boolean): void {
    // « Droite » = +1 : pour tourner à droite, la rame gauche pousse et la droite recule
    const drive = { l: MathUtils.clamp(controls.throttle + controls.turn, -1, 1), r: MathUtils.clamp(controls.throttle - controls.turn, -1, 1) };
    this.oars.forEach((oar, side) => {
      this.animate(oar, dt, stowed ? null : drive[side]);
      this.apply(oar);
    });
  }

  /** Coup de rame (drive ≠ 0), repos (drive ≈ 0) ou rangement (drive null). */
  private animate(oar: Oar, dt: number, drive: number | null): void {
    const { strokeRate, sweep, dipIn, dipOut, dipRest, stowSweep, stowDip, response } = CONFIG.oars;
    let targetSweep: number = 0;
    let targetDip: number = dipRest;
    if (drive === null) {
      targetSweep = stowSweep;
      targetDip = stowDip;
    } else if (Math.abs(drive) > 0.05) {
      oar.phase += dt * strokeRate * 2 * Math.PI * drive;
      // Poussée quand la pelle part vers l'arrière (avancer) ; le sens s'inverse tout seul en marche arrière
      const inWater = MathUtils.smoothstep(-Math.sin(oar.phase), 0, 0.35);
      targetSweep = sweep * Math.cos(oar.phase);
      targetDip = MathUtils.lerp(dipOut, dipIn, inWater);
      this.splashOnEntry(oar, inWater > 0.5);
    }
    oar.sweep = MathUtils.damp(oar.sweep, targetSweep, response, dt);
    oar.dip = MathUtils.damp(oar.dip, targetDip, response, dt);
  }

  private apply(oar: Oar): void {
    _sweep.setFromAxisAngle(Y_AXIS, oar.mirror * oar.sweep);
    _dip.setFromAxisAngle(Z_AXIS, -oar.dip);
    oar.node.quaternion.copy(oar.base).multiply(_sweep).multiply(_dip);
  }

  /** Petit plouf quand la pelle entre dans l'eau. */
  private splashOnEntry(oar: Oar, inWater: boolean): void {
    if (inWater && !oar.wasInWater) {
      oar.node.updateWorldMatrix(true, false);
      this.onSplash(oar.node.localToWorld(_blade.set(CONFIG.oars.bladeDistance, 0, 0)));
    }
    oar.wasInWater = inWater;
  }
}

function findOar(boatModel: Object3D, side: OarSide): Oar | null {
  const node = findByBlenderName(boatModel, `oar_${side}`);
  if (!node) return null;
  const grip = findByBlenderName(node, `oar_${side}_grip`) ?? node;
  return { node, base: node.quaternion.clone(), grip, mirror: side === 'l' ? 1 : -1, phase: 0, sweep: 0, dip: CONFIG.oars.dipRest, wasInWater: false };
}
