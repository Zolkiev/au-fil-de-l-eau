import { BoxGeometry, Color, ConeGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { CONFIG } from '../config';
import { lerpAngle } from '../core/math';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

/** Un passage : il arrive, s'arrête au-dessus de `dive`, plonge, puis repart vers `exit`. */
interface Pass {
  readonly entry: Vector3;
  readonly dive: Vector3;
  readonly exit: Vector3;
  /** Temps écoulé depuis le début du passage (s). */
  time: number;
  splashed: boolean;
}

/** Ce que le martin-pêcheur annonce au jeu. */
export interface KingfisherHooks {
  /** Il plonge en (x, z) ; `volume` (0 → 1) selon sa distance à la barque. */
  readonly onDive: (x: number, z: number, volume: number) => void;
}

/** Durée du piqué vers l'eau, et de la remontée (s). */
const DIVE_SECONDS = 0.22;
/** Il apparaît et disparaît en grossissant sur cette durée (s), au lieu de surgir d'un coup. */
const FADE_SECONDS = 0.5;

const _position = new Vector3();

/**
 * Martin-pêcheur : de jour, de temps en temps, il traverse l'eau en rase-
 * mottes devant la barque, s'arrête en vol sur place, plonge (plouf) et
 * repart avec sa prise. Le reste du temps, il n'est pas dessiné.
 */
export class Kingfisher {
  readonly group = new Group();
  private readonly water: WaterMap;
  private readonly hooks: KingfisherHooks;
  private readonly wings: Mesh[];
  private pass: Pass | null = null;
  private wait: number;
  private yaw = 0;

  constructor(water: WaterMap, hooks: KingfisherHooks) {
    const { scale, every } = CONFIG.waterLife.kingfisher;
    const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 });
    this.water = water;
    this.hooks = hooks;
    this.wings = [1, -1].map((side) => createWing(side, material));
    this.wait = MathUtils.lerp(every.min, every.max, Math.random()) * 0.5;
    this.group.name = 'kingfisher';
    this.group.add(new Mesh(createBodyGeometry(), material), ...this.wings);
    this.group.scale.setScalar(scale);
    this.group.visible = false;
  }

  /** `boatYaw` : cap de la barque (il passe devant elle) ; `night` : 0 (jour) → 1 (nuit, il dort). */
  update(dt: number, elapsed: number, boat: Vector3, boatYaw: number, night: number): void {
    if (this.pass) return this.fly(this.pass, dt, elapsed, boat);
    this.wait -= dt;
    if (this.wait > 0 || night > 0.4) return;
    this.pass = this.plan(boat, boatYaw);
    // Pas de trajet au-dessus de l'eau cette fois-ci : il réessaiera bientôt
    const { every } = CONFIG.waterLife.kingfisher;
    this.wait = this.pass ? MathUtils.lerp(every.min, every.max, Math.random()) : 5;
  }

  /**
   * Choisit où plonger (devant la barque, en eau libre), puis d'où venir et
   * où repartir, toujours au-dessus de l'eau : aussi loin que l'eau le permet
   * de chaque côté (sur une rivière étroite, il la suit plutôt qu'il ne la
   * traverse).
   */
  private plan(boat: Vector3, boatYaw: number): Pass | null {
    const { diveDistance, arc, approach, minApproach, height } = CONFIG.waterLife.kingfisher;
    for (let attempt = 0; attempt < 24; attempt++) {
      const bearing = boatYaw + (Math.random() * 2 - 1) * arc;
      const distance = MathUtils.lerp(diveDistance.min, diveDistance.max, Math.random());
      const x = boat.x + Math.sin(bearing) * distance;
      const z = boat.z + Math.cos(bearing) * distance;
      if (!this.water.isOpen(x, z, 0.6)) continue;
      const heading = Math.random() * Math.PI * 2;
      const dirX = Math.sin(heading);
      const dirZ = Math.cos(heading);
      const before = this.reach(x, z, -dirX, -dirZ, approach);
      const after = this.reach(x, z, dirX, dirZ, approach);
      if (before < minApproach || after < minApproach) continue;
      const y = this.water.level + height;
      return {
        entry: new Vector3(x - dirX * before, y, z - dirZ * before),
        dive: new Vector3(x, y, z),
        exit: new Vector3(x + dirX * after, y, z + dirZ * after),
        time: 0,
        splashed: false,
      };
    }
    return null;
  }

  /** Jusqu'où peut-il voler au-dessus de l'eau depuis (x, z) dans cette direction ? (par pas de 2 m, `max` au plus ; sur la terre, il traverserait les collines) */
  private reach(x: number, z: number, dirX: number, dirZ: number, max: number): number {
    let distance = 0;
    while (distance + 2 <= max) {
      const px = x + dirX * (distance + 2);
      const pz = z + dirZ * (distance + 2);
      if (!this.water.isWater(px, pz) || this.water.landHeightAt(px, pz) !== null) break;
      distance += 2;
    }
    return distance;
  }

  /** Approche → vol sur place → piqué → sous l'eau → remontée → départ. */
  private fly(pass: Pass, dt: number, elapsed: number, boat: Vector3): void {
    const { speed, hover, under, hearing, scale } = CONFIG.waterLife.kingfisher;
    pass.time += dt;
    const travel = pass.entry.distanceTo(pass.dive) / speed;
    const departure = pass.dive.distanceTo(pass.exit) / speed;
    const diveAt = travel + hover;
    const surfaceAt = diveAt + DIVE_SECONDS + under;
    const leaveAt = surfaceAt + DIVE_SECONDS;
    const end = leaveAt + departure;
    const t = pass.time;
    const surface = this.water.surfaceAt(pass.dive.x, pass.dive.z, elapsed);
    let flap = 26;
    let pitch = 0;
    if (t < travel) {
      _position.lerpVectors(pass.entry, pass.dive, MathUtils.smoothstep(t / travel, 0, 1) * 0.5 + (t / travel) * 0.5);
    } else if (t < diveAt) {
      _position.copy(pass.dive).setY(pass.dive.y + Math.sin(elapsed * 9) * 0.04);
      flap = 38;
    } else if (t < leaveAt) {
      // Piqué, un instant sous la surface, puis remontée
      const down = MathUtils.clamp((t - diveAt) / DIVE_SECONDS, 0, 1);
      const up = MathUtils.clamp((t - surfaceAt) / DIVE_SECONDS, 0, 1);
      _position.copy(pass.dive).setY(MathUtils.lerp(pass.dive.y, surface - 0.15, down - up));
      pitch = (down - up) * 1.3;
      flap = 0;
      if (down >= 1 && !pass.splashed) {
        pass.splashed = true;
        const distance = Math.hypot(pass.dive.x - boat.x, pass.dive.z - boat.z);
        this.hooks.onDive(pass.dive.x, pass.dive.z, MathUtils.clamp(1 - distance / hearing, 0, 1));
      }
    } else {
      const away = Math.min(1, (t - leaveAt) / departure);
      _position.lerpVectors(pass.dive, pass.exit, away);
      _position.y += away * 1.2;
    }
    this.group.visible = t < end;
    this.group.position.copy(_position);
    this.yaw = lerpAngle(this.yaw, Math.atan2(pass.exit.x - pass.entry.x, pass.exit.z - pass.entry.z), t === dt ? 1 : Math.min(1, 6 * dt));
    this.group.rotation.set(pitch, this.yaw, 0, 'YXZ');
    this.group.scale.setScalar(scale * MathUtils.smoothstep(Math.min(t, end - t), 0, FADE_SECONDS));
    this.beat(elapsed, flap);
    if (t >= end) this.pass = null;
  }

  /** Battement des ailes (`rate` : rad/s ; 0 : ailes repliées pour le piqué). */
  private beat(elapsed: number, rate: number): void {
    this.wings.forEach((wing, index) => {
      const side = index === 0 ? 1 : -1;
      wing.rotation.z = rate === 0 ? -side * 1.3 : side * Math.sin(elapsed * rate) * 0.9;
    });
  }
}

/** Corps posé à l'origine, regard vers +Z : dos bleu vif, ventre orange, grosse tête, long bec sombre, petite queue. */
function createBodyGeometry(): BufferGeometry {
  const { back, belly } = CONFIG.waterLife.kingfisher;
  const blue = new Color(back);
  return merged([
    tinted(new SphereGeometry(0.05, 6, 5).scale(0.9, 0.85, 1.5).translate(0, 0.008, 0), blue),
    tinted(new SphereGeometry(0.043, 6, 4).scale(0.85, 0.7, 1.3).translate(0, -0.012, 0.005), new Color(belly)),
    tinted(new SphereGeometry(0.036, 6, 5).translate(0, 0.025, 0.07), blue),
    tinted(new ConeGeometry(0.011, 0.08, 4).rotateX(Math.PI / 2).translate(0, 0.02, 0.135), new Color(0x23262b)),
    tinted(new BoxGeometry(0.03, 0.008, 0.04).translate(0, 0.005, -0.085), blue),
  ]);
}

/** Aile courte : une planche qui part de l'épaule vers le côté (`side` : +1 gauche, -1 droite), pivot à l'épaule. */
function createWing(side: number, material: MeshStandardMaterial): Mesh {
  const geometry = tinted(new BoxGeometry(0.11, 0.008, 0.07).translate(side * 0.055, 0, 0), new Color(CONFIG.waterLife.kingfisher.back).multiplyScalar(0.8));
  const wing = new Mesh(geometry, material);
  wing.position.set(side * 0.03, 0.02, 0);
  return wing;
}
