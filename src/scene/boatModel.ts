import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import { defaultDecor } from '../progression/shop';
import { applyWaterMask } from './waterMask';

const WOOD = 0xb9825a;
const WOOD_DARK = 0x8f5f3f;
const WOOD_LIGHT = 0xdcb58c;

/**
 * Charge `assets/props/boat.glb`, ou fabrique une barque en boîtes s'il est absent.
 * Elle projette son ombre mais n'en reçoit pas : sur ses planches presque
 * parallèles au soleil (tableau arrière), la carte d'ombre, large donc peu
 * précise, dessinait des rayures qui clignotaient (« acné » d'ombre).
 */
export async function loadBoatModel(): Promise<Object3D> {
  const gltf = await loadGLB(CONFIG.assets.boat, 'Barque');
  const model = gltf?.scene ?? createPlaceholderBoat();
  model.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  applyWaterMask(model);
  return model;
}

/**
 * Barque « cube » : fond, bords et banc en boîtes, proue en prisme.
 * Origine = ligne de flottaison, avant = +Z (mêmes conventions que boat.glb),
 * avec un Empty `rod_mount` pour fixer la canne sur le bord droit, un
 * `water_mask` qui garde l'intérieur de la coque au sec et une `lantern` à
 * l'arrière.
 */
export function createPlaceholderBoat(): Group {
  const length = 2.4;
  const width = 1.3;
  const height = 0.5;
  const plank = 0.08;
  const bottom = -0.18;
  const midHeight = bottom + height / 2;
  const boat = new Group();
  boat.name = 'boat_placeholder';
  boat.add(
    box([width, plank, length], [0, bottom + plank / 2, 0], WOOD_DARK), // fond
    box([plank, height, length], [width / 2 - plank / 2, midHeight, 0], paintColor()), // bord peint
    box([plank, height, length], [-width / 2 + plank / 2, midHeight, 0], paintColor()), // bord peint
    box([width, height, plank], [0, midHeight, -length / 2 + plank / 2], WOOD), // arrière
    box([width - 2 * plank, 0.06, 0.4], [0, bottom + height * 0.6, -0.25], WOOD_LIGHT), // banc
    createBow(width, height, length / 2, midHeight),
    createRodMount(-width / 2 + plank, bottom + height, 0.2),
    createWaterMask(width - 2 * plank, length - plank, bottom + height, plank / 2),
    createLantern(width / 2 - plank / 2, bottom + height, -length / 2 + plank / 2),
  );
  return boat;
}

/** Petit mât à l'arrière gauche, avec une lanterne dont le verre brille la nuit. */
function createLantern(x: number, y: number, z: number): Group {
  const lantern = new Group();
  lantern.name = 'lantern';
  lantern.position.set(x, y, z);
  const post = box([0.04, 0.6, 0.04], [0, 0.3, 0], WOOD_DARK);
  const glass = new Mesh(
    new BoxGeometry(0.12, 0.14, 0.12),
    new MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb35c, emissiveIntensity: 0.3, flatShading: true }),
  );
  glass.position.y = 0.67;
  const cap = box([0.15, 0.03, 0.15], [0, 0.755, 0], WOOD_DARK);
  lantern.add(post, glass, cap);
  return lantern;
}

/** Plan au niveau des plats-bords couvrant l'intérieur de la coque (voir waterMask.ts). */
function createWaterMask(width: number, length: number, y: number, z: number): Mesh {
  const mask = new Mesh(new PlaneGeometry(width, length).rotateX(-Math.PI / 2));
  mask.name = 'water_mask';
  mask.position.set(0, y, z);
  return mask;
}

/** Empty `rod_mount` : là où la poignée de la canne est fixée. */
function createRodMount(x: number, y: number, z: number): Object3D {
  const mount = new Object3D();
  mount.name = 'rod_mount';
  mount.position.set(x, y, z);
  return mount;
}

/** Proue : prisme triangulaire dont la face arrière ferme la coque et la pointe vise +Z. */
function createBow(width: number, height: number, hullFront: number, y: number): Mesh {
  const radius = width / Math.sqrt(3); // largeur de la face arrière = largeur de la coque
  const bow = new Mesh(new CylinderGeometry(radius, radius, height, 3), woodMaterial(WOOD));
  bow.position.set(0, y, hullFront + radius / 2);
  return bow;
}

/** Peinture d'origine (décoration par défaut) : la cabane peut la changer. */
function paintColor(): number {
  const { effect } = defaultDecor('boatPaint');
  return effect.kind === 'decor' ? effect.color : WOOD;
}

function box(size: [number, number, number], position: [number, number, number], color: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), woodMaterial(color));
  mesh.position.set(...position);
  return mesh;
}

function woodMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });
}
