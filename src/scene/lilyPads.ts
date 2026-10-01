import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { LevelData } from './levelLoader';
import { merged, tinted } from './lowPoly';
import type { WaterMap } from './waterMap';

/** Hauteur d'un nénuphar au-dessus de la surface (m) : assez pour ne pas se mêler aux facettes de l'eau. */
const LIFT = 0.045;
const JUMP_DURATION = 0.45;
const JUMP_LENGTH = 0.9;
const JUMP_HEIGHT = 0.35;
/** Les grenouilles sont un peu plus grosses que nature, pour les voir depuis la barque. */
const FROG_SCALE = 1.6;

type FrogState = 'sitting' | 'jumping' | 'away';

/** Grenouille d'un nénuphar : où elle en est, et vers où elle saute. */
interface Frog {
  readonly index: number;
  readonly yaw: number;
  state: FrogState;
  /** Avancée du saut (0 → 1), ou temps restant avant son retour (s). */
  timer: number;
  dirX: number;
  dirZ: number;
}

interface Pad {
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly spin: number;
  /** Profondeur de l'eau dessous : les vagues y sont amorties près du bord. */
  readonly depth: number;
  /** Numéro de sa fleur dans le lot de fleurs, ou -1. */
  readonly flower: number;
  readonly frog: Frog | null;
}

/** Ce que les nénuphars annoncent au jeu. */
export interface LilyPadHooks {
  /** Une grenouille plonge en (x, z). */
  readonly onPlop: (x: number, z: number) => void;
  /** Une grenouille coasse ; `volume` (0 → 1) selon sa distance à la barque. */
  readonly onCroak: (volume: number) => void;
}

const _dummy = new Object3D();
const _color = new Color();

/**
 * Nénuphars autour des roselières (zones `reeds`) : des feuilles rondes qui
 * flottent sur les vagues, certaines avec une fleur. Le soir et la nuit, des
 * grenouilles s'y installent, coassent, et sautent à l'eau quand la barque
 * approche. Trois lots instanciés (feuilles, fleurs, grenouilles).
 */
export class LilyPads {
  readonly group = new Group();
  private readonly water: WaterMap;
  private readonly hooks: LilyPadHooks;
  private readonly pads: Pad[];
  private readonly leaves: InstancedMesh;
  private readonly flowers: InstancedMesh;
  private readonly frogs: InstancedMesh;
  /** Présence des grenouilles (0 → 1), fondue vers le soir. */
  private evening = 0;
  private croakIn = 3;

  constructor(level: LevelData, water: WaterMap, hooks: LilyPadHooks) {
    this.water = water;
    this.hooks = hooks;
    this.pads = scatterPads(level, water);
    const flowerCount = this.pads.filter((pad) => pad.flower >= 0).length;
    const frogCount = this.pads.filter((pad) => pad.frog).length;
    this.leaves = instanced(createLeafGeometry(), this.pads.length, true);
    this.flowers = instanced(createFlowerGeometry(), flowerCount, true);
    this.frogs = instanced(createFrogGeometry(), frogCount, false);
    this.paint();
    this.group.name = 'lily_pads';
    this.group.add(this.leaves, this.flowers, this.frogs);
    this.group.visible = this.pads.length > 0;
  }

  /** `evening` : 1 au crépuscule et la nuit (les grenouilles sortent), 0 le jour. */
  update(dt: number, elapsed: number, boat: Vector3, evening: number): void {
    if (this.pads.length === 0) return;
    this.evening = MathUtils.damp(this.evening, evening, 0.5, dt);
    for (let i = 0; i < this.pads.length; i++) this.place(this.pads[i], i, dt, elapsed, boat);
    this.leaves.instanceMatrix.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true;
    this.frogs.instanceMatrix.needsUpdate = true;
    this.croak(dt, boat);
  }

  /** Couleurs : chaque feuille et chaque fleur prend une teinte de la palette. */
  private paint(): void {
    const { colors, flowerColors } = CONFIG.waterLife.lilyPads;
    this.pads.forEach((pad, index) => {
      this.leaves.setColorAt(index, _color.set(colors[index % colors.length]));
      if (pad.flower >= 0) this.flowers.setColorAt(pad.flower, _color.set(flowerColors[pad.flower % flowerColors.length]));
    });
  }

  /** Pose la feuille sur la vague, puis sa fleur et sa grenouille. */
  private place(pad: Pad, index: number, dt: number, elapsed: number, boat: Vector3): void {
    const y = this.water.surfaceAt(pad.x, pad.z, elapsed, pad.depth) + LIFT;
    _dummy.position.set(pad.x, y, pad.z);
    _dummy.rotation.set(0, pad.spin, 0);
    _dummy.scale.setScalar(pad.size);
    _dummy.updateMatrix();
    this.leaves.setMatrixAt(index, _dummy.matrix);
    if (pad.flower >= 0) {
      _dummy.scale.setScalar(pad.size * 0.9);
      _dummy.updateMatrix();
      this.flowers.setMatrixAt(pad.flower, _dummy.matrix);
    }
    if (pad.frog) this.animateFrog(pad, pad.frog, y, dt, boat);
  }

  /** Assise, en plein saut ou partie sous l'eau. */
  private animateFrog(pad: Pad, frog: Frog, y: number, dt: number, boat: Vector3): void {
    const { fleeDistance, away } = CONFIG.waterLife.frogs;
    const distance = Math.hypot(pad.x - boat.x, pad.z - boat.z);
    const visible = MathUtils.smoothstep(this.evening, 0.2, 0.6);
    let scale = visible;
    let offset = 0;
    let height = 0;
    if (frog.state === 'sitting' && visible > 0.5 && distance < fleeDistance) this.startJump(pad, frog, boat);
    if (frog.state === 'jumping') {
      frog.timer += dt / JUMP_DURATION;
      offset = Math.min(frog.timer, 1) * JUMP_LENGTH;
      height = Math.sin(Math.PI * Math.min(frog.timer, 1)) * JUMP_HEIGHT;
      if (frog.timer >= 1) {
        frog.state = 'away';
        frog.timer = MathUtils.lerp(away.min, away.max, Math.random());
        this.hooks.onPlop(pad.x + frog.dirX * JUMP_LENGTH, pad.z + frog.dirZ * JUMP_LENGTH);
      }
    } else if (frog.state === 'away') {
      scale = 0;
      frog.timer -= dt;
      // Elle ne remonte que quand la barque s'est éloignée
      if (frog.timer <= 0 && distance > fleeDistance * 1.8) frog.state = 'sitting';
    }
    _dummy.position.set(pad.x + frog.dirX * offset, y + 0.02 + height, pad.z + frog.dirZ * offset);
    _dummy.rotation.set(0, frog.state === 'jumping' ? Math.atan2(frog.dirX, frog.dirZ) : frog.yaw, 0);
    _dummy.scale.setScalar(scale * FROG_SCALE);
    _dummy.updateMatrix();
    this.frogs.setMatrixAt(frog.index, _dummy.matrix);
  }

  /** Elle saute à l'opposé de la barque. */
  private startJump(pad: Pad, frog: Frog, boat: Vector3): void {
    const dx = pad.x - boat.x;
    const dz = pad.z - boat.z;
    const length = Math.hypot(dx, dz) || 1;
    frog.dirX = dx / length;
    frog.dirZ = dz / length;
    frog.state = 'jumping';
    frog.timer = 0;
  }

  /** De temps en temps, la grenouille assise la plus proche de la barque coasse. */
  private croak(dt: number, boat: Vector3): void {
    const { croakEvery, hearing } = CONFIG.waterLife.frogs;
    this.croakIn -= dt;
    if (this.croakIn > 0) return;
    this.croakIn = MathUtils.lerp(croakEvery.min, croakEvery.max, Math.random());
    if (this.evening < 0.6) return;
    let nearest = Infinity;
    for (const pad of this.pads) {
      if (pad.frog?.state === 'sitting') nearest = Math.min(nearest, Math.hypot(pad.x - boat.x, pad.z - boat.z));
    }
    if (nearest < hearing) this.hooks.onCroak(1 - nearest / hearing);
  }
}

/** Sème les nénuphars autour de chaque roselière, là où l'eau est libre et pas trop profonde. */
function scatterPads(level: LevelData, water: WaterMap): Pad[] {
  const { perZone, size, flowerShare, depth: depthRange } = CONFIG.waterLife.lilyPads;
  const pads: Pad[] = [];
  let flowers = 0;
  let frogs = 0;
  for (const zone of level.zones.filter((candidate) => candidate.type === 'reeds')) {
    const radius = zone.radius ?? 5;
    let placed = 0;
    for (let attempt = 0; attempt < perZone * 6 && placed < perZone; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = radius * MathUtils.lerp(0.45, 1.15, Math.random());
      const x = zone.center.x + Math.cos(angle) * reach;
      const z = zone.center.z + Math.sin(angle) * reach;
      const depth = water.isWater(x, z) ? water.depthAt(x, z) : -1;
      if (depth < depthRange.min || depth > depthRange.max || tooClose(pads, x, z)) continue;
      const hasFlower = Math.random() < flowerShare;
      // Pas de grenouille sur une fleur ; la première feuille libre de chaque roselière en a toujours une
      const hasFrog = !hasFlower && (placed === 0 || Math.random() < CONFIG.waterLife.frogs.share);
      const frog: Frog | null = hasFrog ? { index: frogs++, yaw: Math.random() * Math.PI * 2, state: 'sitting', timer: 0, dirX: 0, dirZ: 1 } : null;
      pads.push({ x, z, size: MathUtils.lerp(size.min, size.max, Math.random()), spin: Math.random() * Math.PI * 2, depth, flower: hasFlower ? flowers++ : -1, frog });
      placed++;
    }
  }
  return pads;
}

/** Deux feuilles ne se chevauchent pas. */
function tooClose(pads: readonly Pad[], x: number, z: number): boolean {
  return pads.some((pad) => Math.hypot(pad.x - x, pad.z - z) < 0.75);
}

function instanced(geometry: BufferGeometry, count: number, receiveShadow: boolean): InstancedMesh {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, side: DoubleSide });
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** Feuille : un disque à plat, de rayon 1, avec son encoche. Blanche : la couleur vient de chaque feuille. */
function createLeafGeometry(): BufferGeometry {
  return tinted(new CircleGeometry(1, 10, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), new Color(0xffffff));
}

/** Fleur : une corolle ouverte vers le haut (blanche, teintée par fleur) et un cœur jaune. */
function createFlowerGeometry(): BufferGeometry {
  const petals = tinted(new CylinderGeometry(0.42, 0.12, 0.3, 6, 1, true).translate(0, 0.17, 0), new Color(0xffffff));
  const heart = tinted(new IcosahedronGeometry(0.12, 0).translate(0, 0.14, 0), new Color(0xf2c230));
  return merged([petals, heart]);
}

/** Grenouille : corps trapu, deux yeux bombés, cuisses repliées ; elle regarde vers +Z. */
function createFrogGeometry(): BufferGeometry {
  const green = new Color(CONFIG.waterLife.frogs.color);
  const body = tinted(new SphereGeometry(0.075, 6, 4).scale(1, 0.7, 1.3).translate(0, 0.05, 0), green);
  const eyes = [-1, 1].map((side) => tinted(new SphereGeometry(0.024, 5, 4).translate(side * 0.04, 0.1, 0.06), new Color(0xf2e08a)));
  const thighs = [-1, 1].map((side) => tinted(new SphereGeometry(0.045, 5, 4).scale(0.8, 0.7, 1.2).translate(side * 0.075, 0.035, -0.05), green.clone().multiplyScalar(0.8)));
  return merged([body, ...eyes, ...thighs]);
}
