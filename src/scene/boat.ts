import { Group, MathUtils, Vector2, type Object3D, type Vector3 } from 'three';
import { CONFIG } from '../config';
import type { BoatBounds } from './boatBounds';
import type { SpawnPoint } from './levelLoader';
import { waveHeight } from './waves';

/** Commandes de la barque pour une frame. */
export interface BoatControls {
  /** -1 (reculer) → 1 (avancer). */
  readonly throttle: number;
  /** -1 (gauche) → 1 (droite). */
  readonly turn: number;
  /** Ramer fort : plus vite, en marche avant seulement. */
  readonly sprint: boolean;
}

const TAU = Math.PI * 2;
const _from = new Vector2();
const _to = new Vector2();

/**
 * Barque : déplacement lent au clavier dans les limites du niveau, avec un
 * léger tangage procédural ; elle flotte sur les vagues de l'eau.
 *
 * Hiérarchie : root (position sur l'eau + cap) → hull (tangage) → modèle.
 * Le cap 0 regarde vers +Z.
 */
export class Boat {
  readonly root = new Group();
  private readonly hull = new Group();
  private readonly bounds: BoatBounds;
  private readonly waterLevel: number;
  private velocity = 0;
  private previousVelocity = 0;
  private yawRate = 0;
  private motionScale = 1;
  private lean = 0;
  private pitchKick = 0;

  constructor(model: Object3D, bounds: BoatBounds, waterLevel: number) {
    this.bounds = bounds;
    this.waterLevel = waterLevel;
    this.root.name = 'boat';
    this.hull.add(model);
    this.root.add(this.hull);
  }

  /** Position sur l'eau (sans le tangage). */
  get position(): Vector3 {
    return this.root.position;
  }

  get yaw(): number {
    return this.root.rotation.y;
  }

  /** Vitesse le long de son cap (m/s, négative en marche arrière). */
  get speed(): number {
    return this.velocity;
  }

  placeAt(spawn: SpawnPoint): void {
    this.root.position.set(spawn.position.x, this.waterLevel + CONFIG.boat.floatHeight, spawn.position.z);
    this.root.rotation.set(0, spawn.yaw, 0);
    this.velocity = 0;
    this.yawRate = 0;
  }

  /** Déplacement selon les commandes (seulement quand le jeu tourne). */
  update(dt: number, controls: BoatControls): void {
    this.steer(dt, controls.turn);
    this.propel(dt, controls.throttle, controls.sprint && controls.throttle > 0);
    this.move(dt);
  }

  /** Flottaison et tangage (à chaque image, même en pause : l'eau continue d'onduler). */
  animate(dt: number, elapsed: number): void {
    const { x, z } = this.root.position;
    this.root.position.y = this.waterLevel + CONFIG.boat.floatHeight + waveHeight(x, z, elapsed);
    this.rock(dt, elapsed);
    this.previousVelocity = this.velocity;
  }

  private steer(dt: number, turn: number): void {
    const { maxTurnSpeed, turnResponse } = CONFIG.boat;
    // Un cap croissant tourne vers la gauche : « droite » est donc négatif
    this.yawRate = MathUtils.damp(this.yawRate, -turn * maxTurnSpeed, turnResponse, dt);
    this.root.rotation.y += this.yawRate * dt;
  }

  private propel(dt: number, throttle: number, sprint: boolean): void {
    const { acceleration, waterDrag, maxForwardSpeed, maxBackwardSpeed, sprint: boost } = CONFIG.boat;
    const drag = Math.exp(-waterDrag * dt);
    // Sans pousser, la barque glisse sur son erre : c'est aussi ce qui la ramène en douceur à sa vitesse normale après un sprint
    const coasting = this.velocity * drag;
    const push = throttle * acceleration * (sprint ? boost.acceleration : 1);
    const top = maxForwardSpeed * (sprint ? boost.speed : 1);
    this.velocity = MathUtils.clamp((this.velocity + push * dt) * drag, Math.min(-maxBackwardSpeed, coasting), Math.max(top, coasting));
  }

  private move(dt: number): void {
    const { x, z } = this.root.position;
    const step = this.velocity * dt;
    _from.set(x, z);
    _to.set(x + Math.sin(this.yaw) * step, z + Math.cos(this.yaw) * step);
    this.bounds.resolve(_from, _to);
    this.rubAgainstObstacle(dt, Math.abs(step), _from.distanceTo(_to));
    this.root.position.x = _to.x;
    this.root.position.z = _to.y;
  }

  /** Contre un obstacle, la barque freine selon la part de son mouvement qui a été bloquée. */
  private rubAgainstObstacle(dt: number, wanted: number, moved: number): void {
    if (wanted < 1e-6) return;
    const blocked = 1 - Math.min(1, moved / wanted);
    this.velocity *= Math.exp(-CONFIG.boat.obstacleFriction * blocked * dt);
  }

  /** Tangage : houle permanente + inclinaisons dues aux virages et accélérations. */
  /** Part du tangage conservée (réglage « Moins d'animations »). */
  setMotionScale(scale: number): void {
    this.motionScale = scale;
  }

  private rock(dt: number, elapsed: number): void {
    const r = CONFIG.boatRocking;
    const motion = this.motionScale;
    const acceleration = dt > 0 ? (this.velocity - this.previousVelocity) / dt : 0;
    const leanGoal = MathUtils.clamp(this.yawRate * r.turnLean, -r.maxDynamicTilt, r.maxDynamicTilt);
    const pitchGoal = MathUtils.clamp(-acceleration * r.accelerationPitch, -r.maxDynamicTilt, r.maxDynamicTilt);
    this.lean = MathUtils.damp(this.lean, leanGoal, r.smoothing, dt);
    this.pitchKick = MathUtils.damp(this.pitchKick, pitchGoal, r.smoothing, dt);
    this.hull.position.y = wave(elapsed, r.bobFrequency, 0) * r.bobAmplitude * motion;
    this.hull.rotation.x = wave(elapsed, r.pitchFrequency, 1.3) * r.pitchAmplitude * motion + this.pitchKick;
    this.hull.rotation.z = wave(elapsed, r.rollFrequency, 0.4) * r.rollAmplitude * motion + this.lean;
  }
}

/** Sinusoïde de fréquence `frequency` (Hz), décalée de `phase` (rad). */
function wave(time: number, frequency: number, phase: number): number {
  return Math.sin(time * frequency * TAU + phase);
}
