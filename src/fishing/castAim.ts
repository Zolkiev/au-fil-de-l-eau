import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Vector3,
  type Camera,
  type Vector2,
} from 'three';
import { CONFIG } from '../config';
import { wrapAngle, yawOf } from '../core/math';
import { glowTexture } from '../scene/glowTexture';
import { waveHeight } from '../scene/waves';
import type { Footprint } from '../scene/footprint';
import type { LevelData } from '../scene/levelLoader';

const _raycaster = new Raycaster();
const _cameraForward = new Vector3();
const _hit = new Vector3();

/** Ce que le joueur vise : un cap et une distance depuis la barque. */
export interface AimTarget {
  yaw: number;
  distance: number;
}

/**
 * Visée du lancer : le point de l'eau sous le pointeur donne la direction et
 * la distance ; on en tire le point de chute sur l'eau libre, un repère
 * (anneau) et la trajectoire du bouchon (pointillés).
 */
export class CastAim {
  readonly marker = new Group();
  /** Pointillés de la trajectoire, de la pointe de la canne au point de chute. */
  readonly path: Points;
  private readonly plane: Plane;
  private readonly water: Footprint;
  private readonly colliders: Footprint;
  private readonly waterLevel: number;

  constructor(level: LevelData) {
    this.waterLevel = level.water.level;
    this.water = level.water.footprint;
    this.colliders = level.colliders.footprint;
    this.plane = new Plane(new Vector3(0, 1, 0), -this.waterLevel);
    this.path = createPath();
    this.buildMarker();
  }

  /**
   * Cap et distance visés depuis `origin` : le point d'eau sous le pointeur.
   * Si le pointeur montre le ciel ou l'arrière de la barque, on vise au plus
   * loin dans l'axe du rayon. Le cap reste dans un cône devant la caméra, et
   * la distance entre le lancer le plus court et le plus long.
   */
  target(camera: Camera, pointer: Vector2, origin: Vector3, out: AimTarget): AimTarget {
    const { maxAimAngle, minCastDistance, maxCastDistance } = CONFIG.fishing;
    _raycaster.setFromCamera(pointer, camera);
    camera.getWorldDirection(_cameraForward);
    const cameraYaw = yawOf(_cameraForward.x, _cameraForward.z);
    const ray = _raycaster.ray;
    const hit = ray.intersectPlane(this.plane, _hit);
    const onWater = hit !== null && isAhead(hit, origin, cameraYaw);
    const yaw = onWater ? yawOf(hit.x - origin.x, hit.z - origin.z) : yawOf(ray.direction.x, ray.direction.z);
    const distance = onWater ? Math.hypot(hit.x - origin.x, hit.z - origin.z) : maxCastDistance;
    out.yaw = cameraYaw + MathUtils.clamp(wrapAngle(yaw - cameraYaw), -maxAimAngle, maxAimAngle);
    out.distance = MathUtils.clamp(distance, minCastDistance, maxCastDistance);
    return out;
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

  /**
   * Trajectoire du bouchon de `from` (pointe de la canne) à `to`, en
   * pointillés qui avancent vers la cible ; masquée si l'un des deux est null.
   */
  showPath(from: Vector3 | null, to: Vector3 | null, elapsed: number): void {
    this.path.visible = from !== null && to !== null;
    if (!from || !to) return;
    const { arcHeight, aimPath } = CONFIG.fishing;
    const height = arcHeight.base + arcHeight.perMeter * Math.hypot(to.x - from.x, to.z - from.z);
    const position = this.path.geometry.getAttribute('position') as BufferAttribute;
    const drift = (elapsed * 0.8) % 1;
    for (let i = 0; i < aimPath.points; i++) {
      // Même arc que le vol du bouchon (voir Bobber.fly)
      const t = (i + drift) / aimPath.points;
      const y = MathUtils.lerp(from.y, to.y, t) + 4 * height * t * (1 - t);
      position.setXYZ(i, MathUtils.lerp(from.x, to.x, t), y, MathUtils.lerp(from.z, to.z, t));
    }
    position.needsUpdate = true;
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

/** Points de la trajectoire (leurs positions sont recalculées à chaque image de visée). */
function createPath(): Points {
  const { points, size } = CONFIG.fishing.aimPath;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points * 3), 3));
  const material = new PointsMaterial({ color: 0xfff6e0, map: glowTexture(), size, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const path = new Points(geometry, material);
  path.name = 'cast_path';
  path.frustumCulled = false;
  path.visible = false;
  return path;
}

/** Le point est-il devant `origin`, à plus d'un mètre dans l'axe de la caméra ? */
function isAhead(point: Vector3, origin: Vector3, cameraYaw: number): boolean {
  const along = (point.x - origin.x) * Math.sin(cameraYaw) + (point.z - origin.z) * Math.cos(cameraYaw);
  return along > 1;
}
