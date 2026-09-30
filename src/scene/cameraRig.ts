import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CONFIG } from '../config';
import { lerpAngle, yawOf } from '../core/math';

const UP = new Vector3(0, 1, 0);

/** Hauteur du décor à la verticale d'un point (null s'il n'y a rien). */
/** Hauteur du sol pour un point en l'air (voir HeightSampler.groundAt) ; null s'il n'y a rien. */
export type GroundQuery = (x: number, z: number, y: number) => number | null;

/** Point de vue fixe : où est la caméra et ce qu'elle regarde. */
export interface CameraView {
  readonly position: Vector3;
  readonly target: Vector3;
}

/** Ce que la caméra suit : une position au niveau de l'eau et un cap. */
export interface FollowTarget {
  readonly position: Vector3;
  readonly yaw: number;
}

export function createCamera(): PerspectiveCamera {
  const { fov, near, far } = CONFIG.camera;
  return new PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
}

/**
 * Caméra à la troisième personne : derrière la barque, légèrement surélevée,
 * avec un suivi amorti de sa position et du point visé. Quand la ligne est à
 * l'eau, elle pivote autour de la barque pour cadrer aussi le bouchon.
 */
export class CameraRig {
  private readonly camera: PerspectiveCamera;
  /** Position de la caméra dans le repère de la barque (+Z = avant). */
  private readonly offset: Vector3;
  private readonly minHeight: number;
  private readonly groundAt: GroundQuery;
  private readonly lookTarget = new Vector3();
  private readonly goalPosition = new Vector3();
  private readonly goalTarget = new Vector3();
  /** Vue imposée (vivier) : la caméra y va en douceur ; null = elle suit la barque. */
  private view: CameraView | null = null;

  /**
   * `levelOffset` vient de l'Empty `cam_default` (null → valeur de config.ts) ;
   * `groundAt` permet à la caméra de rester au-dessus du décor (berges, arbres).
   */
  constructor(camera: PerspectiveCamera, levelOffset: Vector3 | null, waterLevel: number, groundAt: GroundQuery) {
    const fallback = CONFIG.camera.defaultOffset;
    this.camera = camera;
    this.groundAt = groundAt;
    this.offset = levelOffset?.clone() ?? new Vector3(fallback.x, fallback.y, fallback.z);
    this.minHeight = waterLevel + CONFIG.camera.minHeightAboveWater;
  }

  /** Place la caméra immédiatement, sans amorti (au démarrage). */
  snap(target: FollowTarget): void {
    this.computeGoals(target, null);
    this.camera.position.copy(this.goalPosition);
    this.lookTarget.copy(this.goalTarget);
    this.camera.lookAt(this.lookTarget);
  }

  /** Impose un point de vue (vue rapprochée du vivier) ; null pour revenir à la barque. */
  setView(view: CameraView | null): void {
    this.view = view;
  }

  /** `focus` : point à cadrer en plus de la barque (le bouchon), ou null. */
  update(dt: number, target: FollowTarget, focus: Vector3 | null = null): void {
    const { followDamping, lookDamping } = CONFIG.camera;
    if (this.view) {
      this.goalPosition.copy(this.view.position);
      this.goalTarget.copy(this.view.target);
    } else {
      this.computeGoals(target, focus);
    }
    this.camera.position.lerp(this.goalPosition, 1 - Math.exp(-followDamping * dt));
    this.lookTarget.lerp(this.goalTarget, 1 - Math.exp(-lookDamping * dt));
    this.camera.lookAt(this.lookTarget);
  }

  /** Où la caméra devrait être, et ce qu'elle devrait viser, sans amorti. */
  private computeGoals(target: FollowTarget, focus: Vector3 | null): void {
    const { lookHeight, lookAhead, fishingFocusBlend } = CONFIG.camera;
    const { position } = target;
    const weight = focus ? focusWeight(position, focus) : 0;
    const focusYaw = focus ? yawOf(focus.x - position.x, focus.z - position.z) : target.yaw;
    const yaw = lerpAngle(target.yaw, focusYaw, weight);
    this.goalPosition.copy(this.offset).applyAxisAngle(UP, yaw).add(position);
    this.goalPosition.y = Math.max(this.goalPosition.y, this.floorAt(this.goalPosition));
    this.goalTarget.set(Math.sin(yaw) * lookAhead, lookHeight, Math.cos(yaw) * lookAhead).add(position);
    if (focus) this.goalTarget.lerp(focus, fishingFocusBlend * weight);
  }

  /**
   * Hauteur minimale de la caméra en `point` : au-dessus de l'eau, et au-dessus
   * du décor si elle se retrouve dedans (collines, arbres empilés : on
   * vérifie plusieurs fois). Sous un pont, elle reste dessous.
   */
  private floorAt(point: Vector3): number {
    const clearance = CONFIG.camera.minHeightAboveGround;
    let floor = this.minHeight;
    let probe = point.y;
    for (let i = 0; i < 3; i++) {
      const ground = this.groundAt(point.x, point.z, probe);
      if (ground === null) break;
      floor = Math.max(floor, ground + clearance);
      if (ground + clearance <= probe) break;
      probe = ground + clearance;
    }
    return floor;
  }
}

/** 0 quand le point à cadrer est tout près de la barque, 1 quand il en est assez loin. */
function focusWeight(from: Vector3, focus: Vector3): number {
  const { min, max } = CONFIG.camera.focusFadeDistance;
  return MathUtils.smoothstep(Math.hypot(focus.x - from.x, focus.z - from.z), min, max);
}
