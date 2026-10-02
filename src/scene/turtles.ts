import { BoxGeometry, Color, CylinderGeometry, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { CONFIG } from '../config';
import { lerpAngle } from '../core/math';
import type { LevelData } from './levelLoader';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

type TurtleState = 'basking' | 'leaving' | 'away' | 'returning';

interface Turtle {
  /** Sa place au soleil, sur le rocher, et l'inclinaison du rocher à cet endroit (elle y est posée à plat ventre). */
  readonly rock: Vector3;
  readonly tilt: Quaternion;
  /** Là où elle entre dans l'eau, à la surface. */
  readonly water: Vector3;
  /** Cap sur le rocher, et cap vers l'eau. */
  readonly restYaw: number;
  readonly waterYaw: number;
  state: TurtleState;
  /** 0 = sur le rocher, 1 = à l'eau. */
  slide: number;
  /** Temps restant sous l'eau (s). */
  away: number;
}

/** Ce que les tortues annoncent au jeu. */
export interface TurtleHooks {
  /** Une tortue plonge en (x, z) ; `volume` (0 → 1) selon sa distance à la barque. */
  readonly onPlop: (x: number, z: number, volume: number) => void;
}

/** Profondeur d'eau qu'il faut au pied du rocher pour qu'elle puisse plonger (m). */
const DIVE_DEPTH = 0.35;
/** Elle s'enfonce de cette hauteur en disparaissant sous l'eau (m). */
const SINK = 0.25;
/** Demi-taille de la place qu'il lui faut sur le rocher (m), et dénivelé accepté sur cette distance (une pente d'environ 25°). */
const FOOTPRINT = 0.14;
const MAX_RISE = 0.065;

const UP = new Vector3(0, 1, 0);
const _dummy = new Object3D();
const _yaw = new Quaternion();
const _lean = new Quaternion();
const _flat = new Quaternion();

/**
 * Tortues : chacune se chauffe sur un rocher bas d'une zone `rocks`. Quand
 * la barque approche, elle glisse à l'eau (plouf) ; elle remonte plus tard,
 * une fois la barque éloignée. Un seul lot instancié.
 */
export class Turtles {
  readonly mesh: InstancedMesh;
  private readonly turtles: Turtle[];
  private readonly hooks: TurtleHooks;

  constructor(level: LevelData, water: WaterMap, hooks: TurtleHooks) {
    this.hooks = hooks;
    this.turtles = findBaskingSpots(level, water);
    const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    this.mesh = new InstancedMesh(createTurtleGeometry(), material, Math.max(1, this.turtles.length));
    this.mesh.name = 'turtles';
    this.mesh.count = this.turtles.length;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  update(dt: number, elapsed: number, boat: Vector3): void {
    this.turtles.forEach((turtle, index) => {
      this.live(turtle, dt, boat);
      this.place(turtle, index, elapsed);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Au soleil → glissade → sous l'eau → remontée. */
  private live(turtle: Turtle, dt: number, boat: Vector3): void {
    const { fleeDistance, returnDistance, away, leaveSeconds, returnSeconds, hearing } = CONFIG.waterLife.turtles;
    const distance = Math.hypot(turtle.rock.x - boat.x, turtle.rock.z - boat.z);
    switch (turtle.state) {
      case 'basking':
        if (distance < fleeDistance) turtle.state = 'leaving';
        return;
      case 'returning':
        turtle.slide = Math.max(0, turtle.slide - dt / returnSeconds);
        if (distance < fleeDistance) turtle.state = 'leaving';
        else if (turtle.slide === 0) turtle.state = 'basking';
        return;
      case 'leaving':
        turtle.slide = Math.min(1, turtle.slide + dt / leaveSeconds);
        if (turtle.slide < 1) return;
        turtle.state = 'away';
        turtle.away = MathUtils.lerp(away.min, away.max, Math.random());
        this.hooks.onPlop(turtle.water.x, turtle.water.z, MathUtils.clamp(1 - distance / hearing, 0, 1));
        return;
      case 'away':
        turtle.away -= dt;
        if (turtle.away <= 0 && distance > returnDistance) turtle.state = 'returning';
    }
  }

  /** Sur le rocher, en chemin vers l'eau (elle se tourne vers elle), ou disparue dessous. */
  private place(turtle: Turtle, index: number, elapsed: number): void {
    const t = MathUtils.smoothstep(turtle.slide, 0, 1);
    _dummy.position.lerpVectors(turtle.rock, turtle.water, t);
    // Sur la fin de la glissade, elle s'enfonce ; sous l'eau, elle n'est plus dessinée
    _dummy.position.y -= MathUtils.smoothstep(turtle.slide, 0.75, 1) * SINK;
    // Couchée sur la pente du rocher ; elle se tourne vers l'eau, pique du nez en glissant, et se redresse à plat dans l'eau
    const yaw = lerpAngle(turtle.restYaw, turtle.waterYaw, Math.min(1, turtle.slide * 3)) + Math.sin(elapsed * 0.5 + index) * 0.04;
    _dummy.rotation.set(-t * 0.35, yaw, 0, 'YXZ');
    _yaw.copy(_dummy.quaternion);
    _dummy.quaternion.copy(_lean.copy(turtle.tilt).slerp(_flat, t)).multiply(_yaw);
    _dummy.scale.setScalar(turtle.state === 'away' ? 0 : CONFIG.waterLife.turtles.scale);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }
}

/**
 * Une place par zone de rochers : un coin de rocher plat, juste au-dessus de
 * l'eau, avec assez d'eau à son pied pour y plonger.
 */
function findBaskingSpots(level: LevelData, water: WaterMap): Turtle[] {
  const { count, height } = CONFIG.waterLife.turtles;
  const turtles: Turtle[] = [];
  for (const zone of level.zones) {
    if (zone.type !== 'rocks' || turtles.length >= count) continue;
    const radius = (zone.radius ?? 6) * 1.2;
    for (let attempt = 0; attempt < 250; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.sqrt(Math.random()) * radius;
      const x = zone.center.x + Math.cos(angle) * reach;
      const z = zone.center.z + Math.sin(angle) * reach;
      const top = water.landHeightAt(x, z);
      if (top === null || top < height.min || top > height.max || !water.isFlatLand(x, z, FOOTPRINT, MAX_RISE)) continue;
      const dive = findDivePoint(water, x, z);
      if (!dive) continue;
      const waterYaw = Math.atan2(dive.x - x, dive.z - z);
      turtles.push({
        rock: new Vector3(x, water.level + top, z),
        tilt: slopeAt(water, x, z),
        water: dive,
        restYaw: waterYaw + MathUtils.lerp(1.2, 2.6, Math.random()) * (Math.random() < 0.5 ? -1 : 1),
        waterYaw,
        state: 'basking',
        slide: 0,
        away: 0,
      });
      break;
    }
  }
  return turtles;
}

/** Inclinaison du rocher en (x, z) : la rotation qui couche la verticale sur sa pente. */
function slopeAt(water: WaterMap, x: number, z: number): Quaternion {
  const height = (px: number, pz: number): number => water.landHeightAt(px, pz) ?? 0;
  const riseX = (height(x + FOOTPRINT, z) - height(x - FOOTPRINT, z)) / (2 * FOOTPRINT);
  const riseZ = (height(x, z + FOOTPRINT) - height(x, z - FOOTPRINT)) / (2 * FOOTPRINT);
  return new Quaternion().setFromUnitVectors(UP, new Vector3(-riseX, 1, -riseZ).normalize());
}

/** Le point d'eau assez profonde le plus proche, à moins de 1,5 m du rocher ; null s'il n'y en a pas. */
function findDivePoint(water: WaterMap, x: number, z: number): Vector3 | null {
  for (let reach = 0.5; reach <= 1.5; reach += 0.25) {
    for (let k = 0; k < 10; k++) {
      const angle = (k / 10) * Math.PI * 2;
      const px = x + Math.cos(angle) * reach;
      const pz = z + Math.sin(angle) * reach;
      if (water.isWater(px, pz) && water.landHeightAt(px, pz) === null && water.depthAt(px, pz) >= DIVE_DEPTH) return new Vector3(px, water.level, pz);
    }
  }
  return null;
}

/** Tortue low poly posée en y = 0, tête vers +Z : carapace bombée, bord plus clair, tête, quatre pattes, petite queue. */
function createTurtleGeometry(): BufferGeometry {
  const shell = new Color(0x4f6b3a);
  const rim = new Color(0x8a9a52);
  const skin = new Color(0xa3a85a);
  const legs = [
    [0.1, 0.09],
    [-0.1, 0.09],
    [0.1, -0.08],
    [-0.1, -0.08],
  ].map(([x, z]) => tinted(new BoxGeometry(0.07, 0.03, 0.06).translate(x, 0.02, z), skin));
  return merged([
    tinted(new SphereGeometry(0.13, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.85, 0.6, 1.1).translate(0, 0.04, 0), shell),
    tinted(new CylinderGeometry(0.15, 0.15, 0.025, 8).scale(0.85, 1, 1.1).translate(0, 0.035, 0), rim),
    tinted(new SphereGeometry(0.04, 5, 4).scale(0.9, 0.85, 1.3).translate(0, 0.07, 0.19), skin),
    tinted(new BoxGeometry(0.02, 0.015, 0.06).translate(0, 0.03, -0.17), skin),
    ...legs,
  ]);
}
