import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import type { Marker } from './levelLoader';
import { findByBlenderName } from './objectNames';

const GINGER = 0xe39a4f;
const CREAM = 0xf6e3c6;

/** Charge `assets/props/cat.glb`, ou fabrique Moustache en primitives. */
export async function loadCatModel(): Promise<Object3D> {
  const gltf = await loadGLB(CONFIG.assets.cat, 'Moustache (chat)');
  return gltf?.scene ?? createPlaceholderCat();
}

/**
 * Moustache, le chat pêcheur du ponton, qui donne les demandes. Il est assis
 * sur l'Empty `npc_cat` ; sa queue (`cat_tail`) balance doucement et il
 * respire. La bulle « ! » au-dessus de sa tête est gérée par l'interface.
 */
export class Cat {
  readonly root = new Group();
  private readonly model: Object3D;
  private readonly tail: Object3D | null;
  private readonly tailYaw: number;
  private readonly height: number;

  constructor(model: Object3D, marker: Marker) {
    this.model = model;
    this.root.name = 'cat';
    this.root.position.copy(marker.position);
    this.root.rotation.y = marker.yaw;
    this.root.scale.setScalar(CONFIG.cat.scale);
    this.root.add(model);
    this.tail = findByBlenderName(model, 'cat_tail');
    this.tailYaw = this.tail?.rotation.y ?? 0;
    this.height = CONFIG.cat.height * CONFIG.cat.scale;
  }

  update(elapsed: number): void {
    const { tailSway, tailSpeed, breathing } = CONFIG.cat;
    this.model.scale.y = 1 + Math.sin(elapsed * 2.1) * breathing;
    if (!this.tail) return;
    // Balancement lent, avec de temps en temps un petit coup de queue
    const flick = Math.max(0, Math.sin(elapsed * 0.37)) ** 12;
    this.tail.rotation.y = this.tailYaw + Math.sin(elapsed * tailSpeed) * tailSway * (1 + flick);
  }

  /** Point au-dessus de sa tête (pour la bulle), en coordonnées monde. */
  bubbleAnchor(out: Vector3): Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + this.height);
  }
}

/**
 * Chat assis en primitives : corps, tête, oreilles, museau, queue (`cat_tail`,
 * pivot à sa base). Origine = sol, avant = +Z (comme cat.glb une fois exporté).
 */
export function createPlaceholderCat(): Group {
  const fur = material(GINGER);
  const cream = material(CREAM);
  const cat = new Group();
  cat.name = 'cat_placeholder';
  const body = new Mesh(new SphereGeometry(0.2, 10, 8).scale(1, 1.25, 1.1), fur);
  body.position.set(0, 0.24, -0.03);
  const head = new Mesh(new SphereGeometry(0.14, 10, 8), fur);
  head.position.set(0, 0.52, 0.07);
  const muzzle = new Mesh(new SphereGeometry(0.06, 8, 6), cream);
  muzzle.position.set(0, 0.47, 0.19);
  cat.add(body, head, muzzle, ...ears(fur), createTail(fur));
  return cat;
}

function ears(fur: MeshStandardMaterial): Mesh[] {
  return [-1, 1].map((side) => {
    const ear = new Mesh(new ConeGeometry(0.05, 0.1, 4), fur);
    ear.position.set(side * 0.08, 0.66, 0.06);
    ear.rotation.z = -side * 0.3;
    return ear;
  });
}

function createTail(fur: MeshStandardMaterial): Group {
  const tail = new Group();
  tail.name = 'cat_tail';
  tail.position.set(0, 0.06, -0.22);
  const piece = new Mesh(new CylinderGeometry(0.03, 0.035, 0.36, 6), fur);
  piece.rotation.x = -1.1;
  piece.position.set(0, 0.08, -0.15);
  tail.add(piece);
  return tail;
}

function material(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
}
