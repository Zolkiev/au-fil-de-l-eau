import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  type Vector3,
} from 'three';
import { CONFIG } from '../config';
import { glowTexture } from './glowTexture';
import type { FindSpot, LevelData } from './levelLoader';
import { merged, tinted } from './lowPoly';
import { waveHeight } from './waves';

/** Durée du petit saut d'un objet repêché avant de disparaître (s). */
const PICK_DURATION = 0.45;

/** Un objet qui flotte à un coin à trouvailles. */
interface Floater {
  readonly spot: FindSpot;
  readonly object: Group;
  readonly glint: Sprite;
  readonly phase: number;
  /** Présent aujourd'hui (pas encore repêché). */
  active: boolean;
  /** Temps écoulé depuis qu'il a été repêché (s), ou -1 s'il flotte encore. */
  picked: number;
}

/**
 * Trouvailles qui flottent : une bouteille ou une petite caisse à chaque coin
 * actif du jour (Empties `find_<n>`), surmontée d'un éclat qui scintille pour
 * qu'on la repère de loin. Quand la barque passe tout près, elle est
 * repêchée : `onPick` prévient le jeu.
 */
export class Flotsam {
  readonly group = new Group();
  private readonly floaters: Floater[];
  private readonly waterLevel: number;
  private readonly onPick: (spot: FindSpot) => void;

  constructor(level: LevelData, onPick: (spot: FindSpot) => void) {
    this.waterLevel = level.water.level;
    this.onPick = onPick;
    this.group.name = 'flotsam';
    this.floaters = level.finds.map((spot) => createFloater(spot));
    for (const floater of this.floaters) this.group.add(floater.object, floater.glint);
  }

  /** Coins qui cachent quelque chose en ce moment (numéros des `find_<n>`). */
  setActive(spots: readonly number[]): void {
    for (const floater of this.floaters) {
      floater.active = spots.includes(floater.spot.index);
      // Un objet en train d'être repêché finit son saut
      if (floater.active) floater.picked = -1;
    }
  }

  /** `boat` : position de la barque ; `canPick` : faux tant que le jeu ne tourne pas (menu, pause). */
  update(dt: number, elapsed: number, boat: Vector3, canPick: boolean): void {
    const radius = CONFIG.finds.pickRadius;
    for (const floater of this.floaters) {
      const { x, z } = floater.spot.position;
      const visible = floater.active || floater.picked >= 0;
      floater.object.visible = visible;
      floater.glint.visible = floater.active;
      if (!visible) continue;
      if (floater.active && canPick && Math.hypot(x - boat.x, z - boat.z) < radius) this.pick(floater);
      if (floater.picked >= 0) this.leap(floater, dt);
      else this.float(floater, elapsed);
    }
  }

  private pick(floater: Floater): void {
    floater.active = false;
    floater.picked = 0;
    floater.glint.visible = false;
    this.onPick(floater.spot);
  }

  /** Ballotté par les vagues, penché, avec son éclat qui clignote au-dessus. */
  private float(floater: Floater, elapsed: number): void {
    const { scale, glint } = CONFIG.finds;
    const { x, z } = floater.spot.position;
    const surface = this.waterLevel + waveHeight(x, z, elapsed);
    const t = elapsed + floater.phase;
    floater.object.position.set(x, surface, z);
    floater.object.rotation.set(Math.sin(t * 0.9) * 0.16, t * 0.12, 0.35 + Math.sin(t * 0.7) * 0.14);
    floater.object.scale.setScalar(scale);
    const twinkle = Math.max(0, Math.sin(t * glint.speed)) ** 3;
    floater.glint.position.set(x, surface + glint.height, z);
    floater.glint.scale.setScalar(glint.size * (0.7 + 0.5 * twinkle));
    floater.glint.material.opacity = 0.35 + 0.65 * twinkle;
  }

  /** Repêché : il saute vers la barque en rapetissant. */
  private leap(floater: Floater, dt: number): void {
    floater.picked += dt;
    const t = Math.min(1, floater.picked / PICK_DURATION);
    floater.object.position.y += dt * 2.2;
    floater.object.rotation.y += dt * 9;
    floater.object.scale.setScalar(CONFIG.finds.scale * (1 - t * t));
    if (t >= 1) floater.picked = -1;
  }
}

function createFloater(spot: FindSpot): Floater {
  const object = new Group();
  object.name = `find_${spot.index}`;
  // Une fois sur deux une bouteille, sinon une caisse : on ne sait ce qu'elle contient qu'en la montrant à Moustache
  object.add(spot.index % 2 === 0 ? createBottle() : createCrate());
  object.visible = false;
  const material = new SpriteMaterial({ map: glowTexture(), color: CONFIG.finds.glint.color, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  const glint = new Sprite(material);
  glint.visible = false;
  return { spot, object, glint, phase: spot.index * 1.7, active: false, picked: -1 };
}

/** Bouteille de verre vert, couchée, avec son bouchon de liège. */
function createBottle(): Mesh {
  const glass = new Color(0x5fa37a);
  const body = tinted(new CylinderGeometry(0.085, 0.085, 0.26, 8).rotateZ(Math.PI / 2), glass);
  const neck = tinted(new CylinderGeometry(0.032, 0.07, 0.12, 8).rotateZ(Math.PI / 2).translate(-0.19, 0, 0), glass);
  const cork = tinted(new CylinderGeometry(0.03, 0.03, 0.05, 6).rotateZ(Math.PI / 2).translate(-0.27, 0, 0), new Color(0xc9a36a));
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, transparent: true, opacity: 0.9 });
  return withShadow(new Mesh(merged([body, neck, cork]), material));
}

/** Petite caisse de bois cerclée de deux lattes sombres, à moitié enfoncée dans l'eau. */
function createCrate(): Mesh {
  const box = tinted(new BoxGeometry(0.42, 0.28, 0.32), new Color(0xb98a5c));
  const dark = new Color(0x6f4a32);
  const slats = [-0.13, 0.13].map((x) => tinted(new BoxGeometry(0.06, 0.3, 0.34).translate(x, 0, 0), dark));
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  return withShadow(new Mesh(merged([box, ...slats]), material));
}

function withShadow(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  return mesh;
}
