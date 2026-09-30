import { Box3, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Object3D, type Vector3 } from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import { warn } from '../core/log';
import { wrapAngle } from '../core/math';
import { findByBlenderName } from '../scene/objectNames';

const ROD_LENGTH = 2.4;

export interface RodModel {
  /** Modèle de la canne : origine à la poignée (pivot), pointe vers +Z. */
  readonly root: Object3D;
  /** Repère de la pointe, d'où part la ligne. */
  readonly tip: Object3D;
}

/** Charge `assets/props/rod.glb` (avec son Empty `rod_tip`), ou fabrique une canne en primitives. */
export async function loadRodModel(): Promise<RodModel> {
  const gltf = await loadGLB(CONFIG.assets.rod, 'Canne');
  const root = gltf?.scene ?? createPlaceholderRod();
  root.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  return { root, tip: findTip(root) };
}

/** Canne en primitives : blank effilé, poignée en liège, moulinet. */
export function createPlaceholderRod(): Group {
  const blank = new Mesh(
    new CylinderGeometry(0.012, 0.03, ROD_LENGTH, 6).translate(0, ROD_LENGTH / 2, 0).rotateX(Math.PI / 2),
    rodMaterial(0x4f6f5a),
  );
  const handle = new Mesh(new CylinderGeometry(0.035, 0.035, 0.45, 8).translate(0, 0.12, 0).rotateX(Math.PI / 2), rodMaterial(0xc9a57a));
  const reel = new Mesh(new CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2), rodMaterial(0x9aa3a8));
  reel.position.set(0, -0.07, 0.15);
  const tip = new Object3D();
  tip.name = 'rod_tip';
  tip.position.z = ROD_LENGTH;
  const rod = new Group();
  rod.name = 'rod_placeholder';
  rod.add(blank, handle, reel, tip);
  return rod;
}

/** Point de fixation de la canne : Empty `rod_mount` du modèle de barque, sinon position de secours. */
export function findRodMount(boatModel: Object3D): Object3D {
  const mount = findByBlenderName(boatModel, 'rod_mount');
  if (mount) return mount;
  warn('canne', '« rod_mount » absent de boat.glb → canne fixée à la position de secours (config.ts).');
  const { x, y, z } = CONFIG.rod.fallbackMount;
  const fallback = new Object3D();
  fallback.name = 'rod_mount';
  fallback.position.set(x, y, z);
  boatModel.add(fallback);
  return fallback;
}

/**
 * Canne animée en code : un ressort sur l'inclinaison (pitch) donne le
 * fouetté du lancer et les à-coups des touches ; la rotation horizontale
 * (yaw) suit la visée puis le bouchon.
 */
export class Rod {
  private readonly pivot = new Group();
  private readonly tip: Object3D;
  private pitch: number = CONFIG.rod.restPitch;
  private pitchVelocity = 0;
  private targetPitch: number = CONFIG.rod.restPitch;
  private yaw: number = CONFIG.rod.restYaw;
  private targetYaw: number = CONFIG.rod.restYaw;

  constructor(model: RodModel, mount: Object3D) {
    this.tip = model.tip;
    this.pivot.name = 'rod_pivot';
    this.pivot.rotation.order = 'YXZ';
    this.pivot.add(model.root);
    mount.add(this.pivot);
    this.applyRotation();
  }

  /** Inclinaison visée (voir CONFIG.rod : négatif = pointe vers le haut). */
  setPitch(pitch: number): void {
    this.targetPitch = pitch;
  }

  /** Orientation horizontale visée, relative à la barque ; null = position de repos. */
  setYaw(yaw: number | null): void {
    const { restYaw, maxYaw } = CONFIG.rod;
    this.targetYaw = yaw === null ? restYaw : MathUtils.clamp(wrapAngle(yaw), -maxYaw, maxYaw);
  }

  /** Impulsion sur l'inclinaison : positif = la pointe plonge, négatif = elle se relève. */
  kick(velocity: number): void {
    this.pitchVelocity += velocity;
  }

  update(dt: number): void {
    const { stiffness, damping, yawResponse } = CONFIG.rod;
    this.pitchVelocity += (this.targetPitch - this.pitch) * stiffness * dt;
    this.pitchVelocity *= Math.exp(-damping * dt);
    this.pitch += this.pitchVelocity * dt;
    this.yaw = MathUtils.damp(this.yaw, this.targetYaw, yawResponse, dt);
    this.applyRotation();
  }

  tipPosition(out: Vector3): Vector3 {
    return this.tip.getWorldPosition(out);
  }

  private applyRotation(): void {
    this.pivot.rotation.set(this.pitch, this.yaw, 0);
  }
}

function findTip(root: Object3D): Object3D {
  const tip = findByBlenderName(root, 'rod_tip');
  if (tip) return tip;
  warn('canne', '« rod_tip » absent de rod.glb → pointe placée au bout du modèle.');
  const fallback = new Object3D();
  fallback.position.set(0, 0, new Box3().setFromObject(root).max.z);
  root.add(fallback);
  return fallback;
}

function rodMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });
}
