import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import { lerpAngle } from '../core/math';
import type { LevelData } from './levelLoader';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

/** Écart minimal entre deux coins où le héron se pose (m). */
const SPOT_SPACING = 10;
const MAX_SPOTS = 8;

/** Vol en cours d'un coin à un autre. */
interface Flight {
  readonly from: Vector3;
  readonly to: Vector3;
  readonly duration: number;
  time: number;
}

const GREY = 0x8fa0ab;
const PALE = 0xe4e9ec;

/**
 * Héron : il guette, les pattes dans l'eau peu profonde, près des roseaux et
 * des hauts-fonds. Quand la barque approche, il s'envole à grands coups
 * d'ailes vers un autre coin, loin d'elle.
 */
export class Heron {
  readonly group = new Group();
  private readonly spots: Vector3[];
  private readonly bird = new Group();
  private readonly wings: Mesh[];
  private spot = 0;
  private flight: Flight | null = null;
  private yaw = Math.random() * Math.PI * 2;

  /** Null si le niveau n'a pas au moins deux coins où se poser. */
  static create(level: LevelData, water: WaterMap): Heron | null {
    const spots = findWadingSpots(level, water);
    if (spots.length >= 2) return new Heron(spots);
    info('décor', 'pas assez d’eau peu profonde près des roseaux et des hauts-fonds : pas de héron.');
    return null;
  }

  private constructor(spots: Vector3[]) {
    const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    const body = new Mesh(createBodyGeometry(), material);
    this.wings = [1, -1].map((side) => createWing(side, material));
    this.spots = spots;
    this.spot = Math.floor(Math.random() * spots.length);
    this.bird.add(body, ...this.wings);
    this.bird.scale.setScalar(CONFIG.waterLife.heron.scale);
    this.bird.traverse((child) => (child.castShadow = true));
    this.group.name = 'heron';
    this.group.add(this.bird);
    this.group.position.copy(spots[this.spot]);
  }

  update(dt: number, elapsed: number, boat: Vector3): void {
    if (this.flight) this.fly(this.flight, dt, elapsed);
    else this.stand(elapsed, boat);
    this.group.rotation.y = this.yaw;
  }

  /** Immobile, à l'affût ; il s'envole si la barque approche et qu'un coin assez loin d'elle existe. */
  private stand(elapsed: number, boat: Vector3): void {
    const { fleeDistance, flySpeed } = CONFIG.waterLife.heron;
    this.bird.rotation.x = Math.sin(elapsed * 0.5) * 0.03;
    this.foldWings();
    const here = this.spots[this.spot];
    if (Math.hypot(here.x - boat.x, here.z - boat.z) > fleeDistance) return;
    const next = this.farthestSpot(boat);
    if (next < 0) return;
    const to = this.spots[next];
    this.flight = { from: here, to, duration: Math.max(2, here.distanceTo(to) / flySpeed), time: 0 };
    this.spot = next;
  }

  /** Le coin le plus loin de la barque (hors celui où il est), s'il en est assez loin ; sinon -1. */
  private farthestSpot(boat: Vector3): number {
    let best = -1;
    let bestDistance: number = CONFIG.waterLife.heron.minFlight;
    this.spots.forEach((spot, index) => {
      const distance = Math.hypot(spot.x - boat.x, spot.z - boat.z);
      if (index !== this.spot && distance > bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  /** Vol en cloche d'un coin à l'autre : corps à l'horizontale, pattes à la traîne, ailes qui battent. */
  private fly(flight: Flight, dt: number, elapsed: number): void {
    flight.time += dt;
    const t = Math.min(1, flight.time / flight.duration);
    const eased = MathUtils.smootherstep(t, 0, 1);
    const lift = Math.sin(Math.PI * eased);
    this.group.position.lerpVectors(flight.from, flight.to, eased);
    this.group.position.y += lift * CONFIG.waterLife.heron.flyHeight;
    this.yaw = lerpAngle(this.yaw, Math.atan2(flight.to.x - flight.from.x, flight.to.z - flight.from.z), Math.min(1, 4 * dt));
    this.bird.rotation.x = 0.75 * Math.sqrt(lift);
    const flap = Math.sin(elapsed * 9);
    this.wings.forEach((wing, index) => {
      const side = index === 0 ? 1 : -1;
      wing.rotation.z = side * (0.15 + flap * 0.65);
      wing.scale.setScalar(1);
    });
    if (t >= 1) this.flight = null;
  }

  /** Ailes repliées le long du corps. */
  private foldWings(): void {
    this.wings.forEach((wing, index) => {
      const side = index === 0 ? 1 : -1;
      wing.rotation.z = -side * 1.35;
      wing.scale.set(0.55, 1, 0.85);
    });
  }
}

/**
 * Coins où le héron peut se poser : dans l'eau peu profonde autour des
 * hauts-fonds et des roselières. Chaque point est au fond de l'eau (là où il
 * pose ses pattes).
 */
function findWadingSpots(level: LevelData, water: WaterMap): Vector3[] {
  const { min, max } = CONFIG.waterLife.heron.depth;
  const spots: Vector3[] = [];
  for (const zone of level.zones) {
    if (zone.type !== 'shallow' && zone.type !== 'reeds') continue;
    const radius = (zone.radius ?? 6) * 1.5;
    let found = 0;
    for (let attempt = 0; attempt < 120 && found < 2 && spots.length < MAX_SPOTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.sqrt(Math.random()) * radius;
      const x = zone.center.x + Math.cos(angle) * reach;
      const z = zone.center.z + Math.sin(angle) * reach;
      const depth = water.isWater(x, z) ? water.depthAt(x, z) : -1;
      if (depth < min || depth > max || spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < SPOT_SPACING)) continue;
      spots.push(new Vector3(x, water.level - depth, z));
      found++;
    }
  }
  return spots;
}

/** Héron debout, pieds en y = 0, regard vers +Z : pattes fines, corps gris, long cou clair, bec jaune. */
function createBodyGeometry(): BufferGeometry {
  const legs = [-1, 1].map((side) => tinted(new CylinderGeometry(0.012, 0.012, 0.52, 4).translate(side * 0.045, 0.26, 0), new Color(0x6b5a3a)));
  return merged([
    ...legs,
    tinted(new SphereGeometry(0.17, 7, 5).scale(0.75, 0.7, 1.5).rotateX(-0.35).translate(0, 0.63, 0), new Color(GREY)),
    tinted(new CylinderGeometry(0.028, 0.045, 0.38, 5).rotateX(0.3).translate(0, 0.87, 0.2), new Color(PALE)),
    tinted(new SphereGeometry(0.06, 6, 5).scale(0.9, 0.9, 1.3).translate(0, 1.06, 0.27), new Color(PALE)),
    tinted(new ConeGeometry(0.02, 0.14, 4).rotateX(-1.9).translate(0, 1.09, 0.17), new Color(0x2d3a44)),
    tinted(new ConeGeometry(0.022, 0.22, 4).rotateX(Math.PI / 2).translate(0, 1.05, 0.45), new Color(0xe2b23a)),
  ]);
}

/** Aile : une planche qui part de l'épaule vers le côté (`side` : +1 gauche, -1 droite), pivot à l'épaule. */
function createWing(side: number, material: MeshStandardMaterial): Mesh {
  const geometry = tinted(new BoxGeometry(0.55, 0.02, 0.3).translate(side * 0.275, 0, 0), new Color(0x6f7f8a));
  const wing = new Mesh(geometry, material);
  wing.position.set(side * 0.09, 0.7, -0.02);
  return wing;
}
