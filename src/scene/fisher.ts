import { ConeGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import { info } from '../core/log';
import { findByBlenderName } from './objectNames';

/** Direction d'un segment de bras au repos (il pend vers le bas depuis son pivot). */
const REST = new Vector3(0, -1, 0);
const _target = new Vector3();
const _direction = new Vector3();
const _bend = new Vector3();
const _elbow = new Vector3();
const _lower = new Vector3();
const _look = new Vector3();
const _inverse = new Quaternion();

/** Ce que fait le pêcheur à cette image : cibles des mains (monde, null = main sur le genou), regard, élan. */
export interface FisherPose {
  readonly left: Vector3 | null;
  readonly right: Vector3 | null;
  /** Point regardé (le bouchon), ou null : il regarde devant lui. */
  readonly lookAt: Vector3 | null;
  /** Buste : -1 (en arrière) → 1 (penché en avant), au rythme des rames. */
  readonly lean: number;
  /** Poisson attrapé : les deux bras levés (les cibles des mains sont alors ignorées). */
  readonly cheer?: boolean;
}

/** Un bras : épaule, coude, main (Empty), longueurs, et cible lissée de la main. */
interface Arm {
  readonly upper: Object3D;
  readonly lower: Object3D;
  readonly upperLength: number;
  readonly lowerLength: number;
  /** Côté : +1 gauche (+X), -1 droite. */
  readonly side: number;
  /** Genou où la main se pose au repos (repère du pêcheur). */
  readonly knee: Vector3;
  /** Cible actuelle (monde), lissée ; null tant qu'elle n'a pas servi. */
  hand: Vector3 | null;
}

/** Charge `assets/props/fisher.glb`, ou fabrique un pêcheur en primitives (mêmes noms de pièces). */
export async function loadFisherModel(): Promise<Object3D> {
  const gltf = await loadGLB(CONFIG.assets.fisher, 'Pêcheur');
  const model = gltf?.scene ?? createPlaceholderFisher();
  model.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  return model;
}

/**
 * Le pêcheur, assis sur le banc de la barque (Empty `fisher_seat`). Ses
 * pièces (`fisher_torso`, `fisher_head`, `fisher_arm_*`,
 * `fisher_forearm_*`, `fisher_hand_*`) sont animées en code : ses mains
 * suivent les poignées des rames ou la canne (bras à deux segments, calcul
 * de l'angle du coude), sa tête suit le bouchon, son buste se penche au
 * rythme des rames et il respire doucement.
 */
export class Fisher {
  readonly root: Object3D;
  private readonly torso: Object3D;
  private readonly head: Object3D;
  private readonly arms: Arm[];
  private lean = 0;
  private headYaw = 0;
  private headPitch = 0;

  constructor(model: Object3D, boatModel: Object3D) {
    this.root = model;
    const seat = findByBlenderName(boatModel, 'fisher_seat');
    if (seat) seat.add(model);
    else {
      info('barque', 'pas d’Empty « fisher_seat » dans boat.glb : pêcheur placé au banc du milieu.');
      const { x, y, z } = CONFIG.fisher.fallbackSeat;
      model.position.set(x, y, z);
      boatModel.add(model);
    }
    this.torso = required(model, 'fisher_torso');
    this.head = required(model, 'fisher_head');
    this.arms = [createArm(model, 'l', 1), createArm(model, 'r', -1)];
    this.torso.rotation.order = 'XZY';
    this.head.rotation.order = 'YXZ';
  }

  update(dt: number, elapsed: number, pose: FisherPose): void {
    const { rowLean, headResponse } = CONFIG.fisher;
    this.lean = MathUtils.damp(this.lean, pose.lean * rowLean, 8, dt);
    // Respiration et léger balancement : il ne reste jamais figé
    this.torso.rotation.x = this.lean + Math.sin(elapsed * 1.3) * 0.015;
    this.torso.rotation.z = Math.sin(elapsed * 0.7) * 0.02;
    // Toute la chaîne à jour (barque, siège, buste) : sinon les mains visent avec une image de retard
    this.torso.updateWorldMatrix(true, true);
    for (const arm of this.arms) this.moveArm(arm, dt, pose.cheer ? this.cheerTarget(arm) : arm.side > 0 ? pose.left : pose.right);
    this.lookAt(pose.lookAt, dt, headResponse, elapsed);
  }

  /** Bras levé au-dessus de la tête (repère du buste → monde). */
  private cheerTarget(arm: Arm): Vector3 {
    const { x, y, z } = CONFIG.fisher.cheer;
    return this.torso.localToWorld(_look.set(arm.side * x, y, z));
  }

  /** La main rejoint sa cible (lissée), puis épaule et coude s'orientent pour l'atteindre. */
  private moveArm(arm: Arm, dt: number, target: Vector3 | null): void {
    const goal = target ?? this.root.localToWorld(_target.copy(arm.knee));
    if (!arm.hand) arm.hand = goal.clone();
    else arm.hand.lerp(goal, 1 - Math.exp(-CONFIG.fisher.handResponse * dt));
    solveArm(arm, this.torso.worldToLocal(_target.copy(arm.hand)));
  }

  /** Tête tournée vers le point regardé (dans ses limites), ou vers l'avant avec de petits mouvements. */
  private lookAt(point: Vector3 | null, dt: number, response: number, elapsed: number): void {
    const { headYaw, headPitch } = CONFIG.fisher;
    let yaw = Math.sin(elapsed * 0.23) * 0.25;
    let pitch = 0.05 + Math.sin(elapsed * 0.31) * 0.05;
    if (point) {
      this.torso.worldToLocal(_look.copy(point)).sub(this.head.position);
      yaw = MathUtils.clamp(Math.atan2(_look.x, _look.z), -headYaw, headYaw);
      pitch = MathUtils.clamp(-Math.atan2(_look.y, Math.hypot(_look.x, _look.z)), -headPitch, headPitch);
    }
    this.headYaw = MathUtils.damp(this.headYaw, yaw, response, dt);
    this.headPitch = MathUtils.damp(this.headPitch, pitch, response, dt);
    this.head.rotation.set(this.headPitch, this.headYaw, 0);
  }
}

/**
 * Bras à deux segments (repère du buste) : on place le coude pour que la
 * main atteigne `target`, coude tourné vers l'extérieur et l'arrière. Trop
 * loin, le bras se tend vers la cible.
 */
function solveArm(arm: Arm, target: Vector3): void {
  const { upper, lower, upperLength, lowerLength, side } = arm;
  const shoulder = upper.position;
  _direction.subVectors(target, shoulder);
  const distance = MathUtils.clamp(_direction.length(), 0.05, (upperLength + lowerLength) * 0.999);
  _direction.normalize();
  const cosAngle = (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance);
  const angle = Math.acos(MathUtils.clamp(cosAngle, -1, 1));
  // Coude : vers l'extérieur, un peu vers le bas et l'arrière
  _bend.set(side * 0.7, -0.35, -0.6);
  _bend.addScaledVector(_direction, -_bend.dot(_direction)).normalize();
  _elbow.copy(shoulder).addScaledVector(_direction, Math.cos(angle) * upperLength).addScaledVector(_bend, Math.sin(angle) * upperLength);
  upper.quaternion.setFromUnitVectors(REST, _lower.subVectors(_elbow, shoulder).normalize());
  // Avant-bras, du coude vers la main (exprimé dans le repère du bras)
  _lower.copy(shoulder).addScaledVector(_direction, distance).sub(_elbow).normalize();
  _lower.applyQuaternion(_inverse.copy(upper.quaternion).invert());
  lower.quaternion.setFromUnitVectors(REST, _lower);
}

function createArm(model: Object3D, suffix: 'l' | 'r', side: number): Arm {
  const upper = required(model, `fisher_arm_${suffix}`);
  const lower = required(model, `fisher_forearm_${suffix}`);
  const hand = findByBlenderName(lower, `fisher_hand_${suffix}`);
  const { knee } = CONFIG.fisher;
  return {
    upper,
    lower,
    upperLength: lower.position.length(),
    lowerLength: hand ? hand.position.length() : CONFIG.fisher.forearmLength,
    side,
    knee: new Vector3(side * knee.x, knee.y, knee.z),
    hand: null,
  };
}

function required(model: Object3D, name: string): Object3D {
  const found = findByBlenderName(model, name);
  if (found) return found;
  // Pièce manquante : un nœud vide, placé au pivot, pour que l'animation fonctionne quand même
  info('pêcheur', `pièce « ${name} » absente de fisher.glb.`);
  const empty = new Object3D();
  empty.name = name;
  model.add(empty);
  return empty;
}

// --- Pêcheur de secours (primitives) ------------------------------------------------

const PLACEHOLDER = { skin: 0xe7b48f, jacket: 0xe0a83a, trousers: 0x3e5470, hat: 0x6f7d4a };

/** Pêcheur en primitives, avec les mêmes pièces et pivots que fisher.glb (repère Three.js : avant = +Z). */
export function createPlaceholderFisher(): Object3D {
  const root = new Group();
  root.name = 'fisher';
  root.add(part(new SphereGeometry(0.17, 8, 6), PLACEHOLDER.trousers, 0, 0.07, -0.02, [1.15, 0.6, 1]));
  const torso = named(new Group(), 'fisher_torso', 0, 0.06, -0.02);
  torso.add(part(new ConeGeometry(0.2, 0.42, 10), PLACEHOLDER.jacket, 0, 0.2, 0));
  const head = named(new Group(), 'fisher_head', 0, 0.46, 0);
  head.add(part(new SphereGeometry(0.14, 10, 8), PLACEHOLDER.skin, 0, 0.14, 0), part(new ConeGeometry(0.2, 0.12, 12), PLACEHOLDER.hat, 0, 0.26, 0));
  torso.add(head);
  for (const [suffix, side] of [['l', 1], ['r', -1]] as const) {
    const arm = named(new Group(), `fisher_arm_${suffix}`, side * 0.19, 0.4, 0);
    arm.add(part(new ConeGeometry(0.055, 0.25, 8), PLACEHOLDER.jacket, 0, -0.125, 0));
    const forearm = named(new Group(), `fisher_forearm_${suffix}`, 0, -0.25, 0);
    forearm.add(part(new ConeGeometry(0.048, 0.23, 8), PLACEHOLDER.jacket, 0, -0.115, 0), part(new SphereGeometry(0.048, 8, 6), PLACEHOLDER.skin, 0, -0.275, 0));
    forearm.add(named(new Object3D(), `fisher_hand_${suffix}`, 0, -0.275, 0));
    arm.add(forearm);
    torso.add(arm);
  }
  root.add(torso);
  return root;
}

function part(geometry: SphereGeometry | ConeGeometry, color: number, x: number, y: number, z: number, scale = [1, 1, 1]): Mesh {
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
  mesh.position.set(x, y, z);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  return mesh;
}

function named<T extends Object3D>(object: T, name: string, x: number, y: number, z: number): T {
  object.name = name;
  object.position.set(x, y, z);
  return object;
}
