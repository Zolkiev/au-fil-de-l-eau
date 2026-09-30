import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type Vector2,
  type Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { LevelData } from './levelLoader';
import { waveHeight } from './waves';

/** Une feuille qui flotte : position sur l'eau, rotation et vitesse de rotation. */
interface Leaf {
  x: number;
  z: number;
  angle: number;
  spin: number;
  visible: boolean;
}

const _dummy = new Object3D();
const _color = new Color();

/**
 * Feuilles emportées par le courant d'une rivière : elles rendent l'eau
 * vivante et montrent dans quel sens elle coule. Elles n'existent qu'autour
 * de la barque et réapparaissent ailleurs quand elles s'en éloignent ou
 * touchent la berge.
 */
export class DriftingLeaves {
  readonly mesh: InstancedMesh;
  private readonly level: LevelData;
  private readonly flow: Vector2;
  private readonly leaves: Leaf[] = [];

  constructor(level: LevelData) {
    const { count, size, colors } = CONFIG.leaves;
    this.level = level;
    this.flow = level.flow;
    const material = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.8, flatShading: true });
    this.mesh = new InstancedMesh(createLeafGeometry(size), material, count);
    this.mesh.name = 'drifting_leaves';
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.leaves.push({ x: 0, z: 0, angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.6, visible: false });
      this.mesh.setColorAt(i, _color.set(colors[i % colors.length]));
    }
  }

  /** Fait dériver les feuilles ; `center` = la barque (elles restent autour d'elle). */
  update(dt: number, elapsed: number, center: Vector3): void {
    const { radius, boatClearance } = CONFIG.leaves;
    this.leaves.forEach((leaf, index) => {
      leaf.x += this.flow.x * dt;
      leaf.z += this.flow.y * dt;
      leaf.angle += leaf.spin * dt;
      const distance = Math.hypot(leaf.x - center.x, leaf.z - center.z);
      if (!leaf.visible || distance > radius || !this.isOpenWater(leaf.x, leaf.z)) this.respawn(leaf, center);
      const hidden = !leaf.visible || Math.hypot(leaf.x - center.x, leaf.z - center.z) < boatClearance;
      this.place(index, leaf, elapsed, hidden);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Nouvelle place au hasard sur l'eau libre autour de la barque (plutôt en amont). */
  private respawn(leaf: Leaf, center: Vector3): void {
    const { radius, boatClearance } = CONFIG.leaves;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = boatClearance + Math.random() * (radius - boatClearance);
      // Le vecteur vers l'amont, pour que la feuille traverse la vue
      const x = center.x + Math.cos(angle) * distance - this.flow.x * 4;
      const z = center.z + Math.sin(angle) * distance - this.flow.y * 4;
      if (!this.isOpenWater(x, z)) continue;
      leaf.x = x;
      leaf.z = z;
      leaf.visible = true;
      return;
    }
    leaf.visible = false;
  }

  private place(index: number, leaf: Leaf, elapsed: number, hidden: boolean): void {
    const y = this.level.water.level + waveHeight(leaf.x, leaf.z, elapsed) + 0.02;
    _dummy.position.set(leaf.x, y, leaf.z);
    _dummy.rotation.set(0, leaf.angle, 0);
    _dummy.scale.setScalar(hidden ? 0 : 1);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }

  private isOpenWater(x: number, z: number): boolean {
    return this.level.water.footprint.contains(x, z) && !this.level.colliders.footprint.contains(x, z);
  }
}

/** Petite feuille en losange, posée à plat, avec une nervure pliée pour accrocher la lumière. */
function createLeafGeometry(size: number): BufferGeometry {
  const half = size / 2;
  const width = size * 0.3;
  const positions = [0, 0.01, -half, width, 0, 0, 0, 0.01, half, 0, 0.01, -half, 0, 0.01, half, -width, 0, 0];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
