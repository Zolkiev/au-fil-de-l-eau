import { Box2, Mesh, Vector2, Vector3, type Object3D } from 'three';

/** En dessous de cette aire, un triangle projeté est considéré comme plat (un segment). */
const MIN_AREA = 1e-9;

const _vertex = new Vector3();
const _point = new Vector2();
const _closest = new Vector2();
const _candidate = new Vector2();

/**
 * Empreinte « vue de dessus » (plan XZ) d'un ensemble de meshes.
 *
 * Tous les triangles sont projetés au sol : n'importe quel mesh 3D devient
 * une surface 2D. Sert aux collisions de la barque (`*_col`), aux zones de
 * pêche en forme de mesh et au plan d'eau.
 *
 * Convention : un Vector2 représente un point (x, z) du monde ; sa
 * composante `y` contient donc la coordonnée Z.
 */
export class Footprint {
  /** Rectangle englobant, pour écarter vite les tests inutiles. */
  readonly bounds = new Box2();
  /** Triangles projetés, à plat : ax, az, bx, bz, cx, cz, ax, az… */
  private readonly tris: Float32Array;

  private constructor(coords: readonly number[]) {
    this.tris = new Float32Array(coords);
    for (let i = 0; i < coords.length; i += 2) {
      this.bounds.expandByPoint(_point.set(coords[i], coords[i + 1]));
    }
  }

  /** Empreinte de tous les meshes contenus dans `objects` (matrices monde à jour). */
  static fromObjects(objects: readonly Object3D[]): Footprint {
    const coords: number[] = [];
    for (const object of objects) {
      object.traverse((child) => {
        if (child instanceof Mesh) appendTriangles(child, coords);
      });
    }
    return new Footprint(coords);
  }

  static empty(): Footprint {
    return new Footprint([]);
  }

  get isEmpty(): boolean {
    return this.tris.length === 0;
  }

  /**
   * Aire approximative vue de dessus (m²) : somme des triangles projetés.
   * Un mesh fermé est compté deux fois (dessus + dessous) : ça suffit pour
   * comparer des zones entre elles.
   */
  get area(): number {
    let total = 0;
    const t = this.tris;
    for (let i = 0; i < t.length; i += 6) total += Math.abs(cross(t[i], t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5])) / 2;
    return total;
  }

  /** Le point (x, z) est-il dans l'empreinte ? */
  contains(x: number, z: number): boolean {
    if (!this.isNear(x, z, 0)) return false;
    for (let i = 0; i < this.tris.length; i += 6) {
      if (pointInTriangle(x, z, this.tris, i)) return true;
    }
    return false;
  }

  /**
   * Repousse un cercle hors des bords de l'empreinte (centre modifié en place).
   * Un centre situé À L'INTÉRIEUR n'est pas repoussé : c'est à l'appelant de
   * refuser cette position. Retourne true si le cercle a bougé.
   */
  pushCircleOut(center: Vector2, radius: number): boolean {
    if (!this.isNear(center.x, center.y, radius)) return false;
    let pushed = false;
    for (let i = 0; i < this.tris.length; i += 6) {
      if (this.pushOutOfTriangle(center, radius, i)) pushed = true;
    }
    return pushed;
  }

  private pushOutOfTriangle(center: Vector2, radius: number, i: number): boolean {
    if (!triangleNear(this.tris, i, center, radius)) return false;
    if (pointInTriangle(center.x, center.y, this.tris, i)) return false;
    closestPointOnEdges(center, this.tris, i, _closest);
    const dx = center.x - _closest.x;
    const dz = center.y - _closest.y;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= radius * radius || distanceSq < 1e-12) return false;
    const distance = Math.sqrt(distanceSq);
    const push = (radius - distance) / distance;
    center.x += dx * push;
    center.y += dz * push;
    return true;
  }

  private isNear(x: number, z: number, margin: number): boolean {
    const { min, max } = this.bounds;
    return x >= min.x - margin && x <= max.x + margin && z >= min.y - margin && z <= max.y + margin;
  }
}

/** Ajoute à `out` les triangles du mesh, en coordonnées monde projetées sur XZ. */
function appendTriangles(mesh: Mesh, out: number[]): void {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return;
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : position.count;
  for (let i = 0; i < count - (count % 3); i++) {
    _vertex.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    out.push(_vertex.x, _vertex.z);
  }
}

/** Produit vectoriel 2D (b - a) × (p - a) : son signe dit de quel côté de [ab] est p. */
function cross(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  return (bx - ax) * (pz - az) - (bz - az) * (px - ax);
}

function pointInTriangle(px: number, pz: number, t: Float32Array, i: number): boolean {
  if (Math.abs(cross(t[i], t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5])) < MIN_AREA) return false;
  const d1 = cross(t[i], t[i + 1], t[i + 2], t[i + 3], px, pz);
  const d2 = cross(t[i + 2], t[i + 3], t[i + 4], t[i + 5], px, pz);
  const d3 = cross(t[i + 4], t[i + 5], t[i], t[i + 1], px, pz);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

/** Test rapide : le rectangle englobant du triangle touche-t-il celui du cercle ? */
function triangleNear(t: Float32Array, i: number, center: Vector2, radius: number): boolean {
  const minX = Math.min(t[i], t[i + 2], t[i + 4]);
  const maxX = Math.max(t[i], t[i + 2], t[i + 4]);
  const minZ = Math.min(t[i + 1], t[i + 3], t[i + 5]);
  const maxZ = Math.max(t[i + 1], t[i + 3], t[i + 5]);
  return center.x + radius >= minX && center.x - radius <= maxX && center.y + radius >= minZ && center.y - radius <= maxZ;
}

/** Point le plus proche de `p` sur le contour du triangle i. */
function closestPointOnEdges(p: Vector2, t: Float32Array, i: number, out: Vector2): void {
  let best = Infinity;
  for (let edge = 0; edge < 3; edge++) {
    const a = i + edge * 2;
    const b = i + ((edge + 1) % 3) * 2;
    const distanceSq = closestPointOnSegment(p, t[a], t[a + 1], t[b], t[b + 1], _candidate);
    if (distanceSq < best) {
      best = distanceSq;
      out.copy(_candidate);
    }
  }
}

/** Point le plus proche de `p` sur le segment [ab] ; retourne la distance au carré. */
function closestPointOnSegment(p: Vector2, ax: number, az: number, bx: number, bz: number, out: Vector2): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSq = abx * abx + abz * abz;
  const s = lengthSq > 0 ? ((p.x - ax) * abx + (p.y - az) * abz) / lengthSq : 0;
  const clamped = Math.min(Math.max(s, 0), 1);
  out.set(ax + abx * clamped, az + abz * clamped);
  return out.distanceToSquared(p);
}
