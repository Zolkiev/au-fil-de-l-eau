import {
  CircleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  RingGeometry,
  Vector3,
  type Camera,
  type Vector2,
} from 'three';
import { CONFIG } from '../config';
import { wrapAngle, yawOf } from '../core/math';
import { waveHeight } from '../scene/waves';
import type { Footprint } from '../scene/footprint';
import type { LevelData } from '../scene/levelLoader';

const _raycaster = new Raycaster();
const _cameraForward = new Vector3();
const _hit = new Vector3();

/**
 * Visée du lancer : direction donnée par la souris, point de chute sur
 * l'eau libre, et repère visuel (anneau) sur l'eau.
 */
export class CastAim {
  readonly marker = new Group();
  private readonly plane: Plane;
  private readonly water: Footprint;
  private readonly colliders: Footprint;
  private readonly waterLevel: number;

  constructor(level: LevelData) {
    this.waterLevel = level.water.level;
    this.water = level.water.footprint;
    this.colliders = level.colliders.footprint;
    this.plane = new Plane(new Vector3(0, 1, 0), -this.waterLevel);
    this.buildMarker();
  }

  /**
   * Cap visé depuis `origin` : vers le point d'eau sous le pointeur, ou dans
   * l'axe du rayon si ce point est derrière la barque. Limité à un cône
   * devant la caméra.
   */
  aimYaw(camera: Camera, pointer: Vector2, origin: Vector3): number {
    _raycaster.setFromCamera(pointer, camera);
    camera.getWorldDirection(_cameraForward);
    const cameraYaw = yawOf(_cameraForward.x, _cameraForward.z);
    const ray = _raycaster.ray;
    const hit = ray.intersectPlane(this.plane, _hit);
    const yaw = hit && isAhead(hit, origin, cameraYaw)
      ? yawOf(hit.x - origin.x, hit.z - origin.z)
      : yawOf(ray.direction.x, ray.direction.z);
    const maxAngle = CONFIG.fishing.maxAimAngle;
    return cameraYaw + MathUtils.clamp(wrapAngle(yaw - cameraYaw), -maxAngle, maxAngle);
  }

  /**
   * Point de chute dans la direction `yaw` : le plus loin possible sur l'eau
   * libre sans dépasser `distance`. Écrit dans `out` ; null s'il n'y a pas d'eau.
   */
  landingPoint(origin: Vector3, yaw: number, distance: number, out: Vector3): Vector3 | null {
    const { minCastDistance, landingSearchStep } = CONFIG.fishing;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    for (let d = distance; d >= minCastDistance; d -= landingSearchStep) {
      const x = origin.x + dx * d;
      const z = origin.z + dz * d;
      if (this.isOpenWater(x, z)) return out.set(x, this.waterLevel, z);
    }
    return null;
  }

  /** Affiche l'anneau de visée en `point` (ou le masque si null), avec une légère pulsation. */
  showMarker(point: Vector3 | null, elapsed: number): void {
    this.marker.visible = point !== null;
    if (!point) return;
    this.marker.position.set(point.x, this.waterLevel + waveHeight(point.x, point.z, elapsed) + 0.05, point.z);
    this.marker.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.08);
  }

  private isOpenWater(x: number, z: number): boolean {
    const overWater = this.water.isEmpty || this.water.contains(x, z);
    return overWater && !this.colliders.contains(x, z);
  }

  private buildMarker(): void {
    const material = new MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new Mesh(new RingGeometry(0.5, 0.65, 32).rotateX(-Math.PI / 2), material);
    const dot = new Mesh(new CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), material);
    this.marker.name = 'cast_marker';
    this.marker.add(ring, dot);
    this.marker.visible = false;
  }
}

/** Le point est-il devant `origin`, à plus d'un mètre dans l'axe de la caméra ? */
function isAhead(point: Vector3, origin: Vector3, cameraYaw: number): boolean {
  const along = (point.x - origin.x) * Math.sin(cameraYaw) + (point.z - origin.z) * Math.cos(cameraYaw);
  return along > 1;
}
