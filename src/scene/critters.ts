import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
} from 'three';
import { CONFIG } from '../config';
import type { LevelData } from './levelLoader';

const _dummy = new Object3D();

/** Une petite bête : son point d'attache et ses rythmes propres (tout est calculé à partir du temps). */
interface Critter {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
}

/**
 * Petites bêtes du décor, seulement le jour et par temps sec :
 * - des libellules qui volent en zigzag au-dessus des roseaux ;
 * - des oiseaux qui tournent haut dans le ciel.
 * Chaque espèce est une seule InstancedMesh (très peu coûteux).
 */
export class Critters {
  readonly group = new Group();
  private readonly dragonflies: Critter[] = [];
  private readonly birds: Critter[] = [];
  private readonly bodies: InstancedMesh;
  private readonly wings: InstancedMesh;
  private readonly flock: InstancedMesh;

  /** `birdColor` : couleur des oiseaux (des mouettes blanches au bord de la mer). */
  constructor(level: LevelData, birdColor = 0x3a4046) {
    const { dragonfliesPerZone, birds, birdHeight, birdRadius } = CONFIG.decorLife;
    const water = level.water.level;
    for (const zone of level.zones.filter((candidate) => candidate.type === 'reeds')) {
      for (let i = 0; i < dragonfliesPerZone; i++) {
        this.dragonflies.push(critter(zone.center.x, water + 2.1, zone.center.z, (zone.radius ?? 4) * 0.8, 0.8));
      }
    }
    const lake = level.water.footprint.bounds.getCenter(new Vector2());
    for (let i = 0; i < birds; i++) {
      const radius = MathUtils.lerp(birdRadius.min, birdRadius.max, Math.random());
      this.birds.push(critter(lake.x, water + MathUtils.lerp(birdHeight.min, birdHeight.max, Math.random()), lake.y, radius, 0.12));
    }
    // Un peu plus grandes que nature, pour qu'on les voie depuis la barque
    this.bodies = instanced(new BoxGeometry(0.06, 0.06, 0.32), new MeshStandardMaterial({ color: 0x2f8f9a, emissive: 0x0f3a40 }), this.dragonflies.length);
    this.wings = instanced(
      new PlaneGeometry(0.52, 0.1).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
      this.dragonflies.length * 2,
    );
    this.flock = instanced(createBirdGeometry(), new MeshBasicMaterial({ color: birdColor, side: DoubleSide }), this.birds.length);
    this.group.name = 'critters';
    this.group.add(this.bodies, this.wings, this.flock);
  }

  /** `presence` : 0 (nuit, pluie, brume : personne) → 1 (beau jour). */
  update(elapsed: number, presence: number): void {
    this.group.visible = presence > 0.05;
    if (!this.group.visible) return;
    const scale = MathUtils.smoothstep(presence, 0.05, 0.6);
    this.dragonflies.forEach((dragonfly, index) => this.placeDragonfly(dragonfly, index, elapsed, scale));
    this.birds.forEach((bird, index) => this.placeBird(bird, index, elapsed, scale));
    for (const mesh of [this.bodies, this.wings, this.flock]) mesh.instanceMatrix.needsUpdate = true;
  }

  /** Vol en zigzag : une somme de sinusoïdes autour des roseaux, avec de brusques arrêts. */
  private placeDragonfly(dragonfly: Critter, index: number, elapsed: number, scale: number): void {
    const t = elapsed * dragonfly.speed + dragonfly.phase;
    const dart = Math.sin(t * 0.7) > 0.6 ? 2.2 : 1;
    const x = dragonfly.x + (Math.sin(t * 1.3 * dart) + 0.5 * Math.sin(t * 3.1)) * dragonfly.radius * 0.5;
    const z = dragonfly.z + (Math.cos(t * 1.1 * dart) + 0.5 * Math.cos(t * 2.7)) * dragonfly.radius * 0.5;
    const y = dragonfly.y + Math.sin(t * 2.3) * 0.25;
    const heading = Math.atan2(Math.cos(t * 1.3 * dart), -Math.sin(t * 1.1 * dart));
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, heading, 0);
    _dummy.scale.setScalar(scale);
    _dummy.updateMatrix();
    this.bodies.setMatrixAt(index, _dummy.matrix);
    // Deux paires d'ailes qui battent très vite (on joue sur leur largeur)
    for (let pair = 0; pair < 2; pair++) {
      _dummy.position.set(x, y + 0.01, z);
      _dummy.rotation.set(0, heading, 0);
      _dummy.translateZ(pair === 0 ? 0.06 : -0.02);
      _dummy.scale.set(scale, scale, scale * (0.4 + 0.6 * Math.abs(Math.sin(elapsed * 40 + pair + index))));
      _dummy.updateMatrix();
      this.wings.setMatrixAt(index * 2 + pair, _dummy.matrix);
    }
  }

  /** Grand cercle lent, en battant des ailes puis en planant. */
  private placeBird(bird: Critter, index: number, elapsed: number, scale: number): void {
    const angle = elapsed * bird.speed + bird.phase;
    const x = bird.x + Math.cos(angle) * bird.radius;
    const z = bird.z + Math.sin(angle) * bird.radius;
    const flap = Math.sin(elapsed * 7 + bird.phase * 3);
    const gliding = Math.sin(elapsed * 0.4 + bird.phase) > 0.3;
    _dummy.position.set(x, bird.y + Math.sin(elapsed * 0.5 + bird.phase) * 1.5, z);
    _dummy.rotation.set(0, -angle, 0);
    _dummy.scale.set(scale, scale * (gliding ? 0.25 : flap), scale);
    _dummy.updateMatrix();
    this.flock.setMatrixAt(index, _dummy.matrix);
  }
}

function critter(x: number, y: number, z: number, radius: number, speed: number): Critter {
  return { x, y, z, radius, speed: speed * MathUtils.lerp(0.8, 1.2, Math.random()), phase: Math.random() * Math.PI * 2 };
}

function instanced(geometry: BufferGeometry, material: MeshBasicMaterial | MeshStandardMaterial, count: number): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  return mesh;
}

/** Oiseau en « V » vu de loin : deux ailes minces qui partent du corps (l'échelle en Y les fait battre). */
function createBirdGeometry(): BufferGeometry {
  const positions = [
    // aile gauche
    0, 0, 0.15, -0.9, 0.35, 0, 0, 0, -0.15,
    // aile droite
    0, 0, 0.15, 0, 0, -0.15, 0.9, 0.35, 0,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
