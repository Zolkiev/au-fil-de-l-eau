import { Vector2 } from 'three';
import { CONFIG } from '../config';
import { warn } from '../core/log';
import { Footprint } from './footprint';
import type { LevelData } from './levelLoader';

/** Nombre de passes pour repousser la barque hors des collisions. */
const PUSH_ITERATIONS = 3;

const _desired = new Vector2();
const _candidate = new Vector2();

/**
 * Limites de navigation de la barque (un cercle vu de dessus) :
 *  - elle n'entre jamais dans l'empreinte des meshes `*_col` ;
 *  - son centre reste au-dessus du plan d'eau (filet de sécurité).
 * Les positions sont des Vector2 (x, z).
 */
export class BoatBounds {
  private readonly colliders: Footprint;
  private readonly water: Footprint;
  private readonly radius: number;

  constructor(colliders: Footprint, water: Footprint, radius: number) {
    this.colliders = colliders;
    this.water = water;
    this.radius = radius;
  }

  /** Le centre de la barque peut-il se trouver en `p` ? */
  isValid(p: Vector2): boolean {
    if (this.colliders.contains(p.x, p.y)) return false;
    return this.water.isEmpty || this.water.contains(p.x, p.y);
  }

  /** Corrige en place la position souhaitée `next`, en partant de `current` (valide). */
  resolve(current: Vector2, next: Vector2): void {
    _desired.copy(next);
    if (this.settle(next)) return;
    // Bloqué : on essaie de glisser le long d'un seul axe, sinon on reste sur place
    const slid =
      this.settle(_candidate.set(_desired.x, current.y)) || this.settle(_candidate.set(current.x, _desired.y));
    next.copy(slid ? _candidate : current);
  }

  /** Repousse le cercle hors des collisions ; false si la position reste interdite. */
  private settle(p: Vector2): boolean {
    for (let i = 0; i < PUSH_ITERATIONS; i++) {
      if (!this.colliders.pushCircleOut(p, this.radius)) break;
    }
    return this.isValid(p);
  }
}

/**
 * Crée les limites du niveau. Si le point de départ est lui-même interdit
 * (erreur de placement dans Blender), la limite fautive est désactivée pour
 * que la barque ne reste pas bloquée.
 */
export function createBoatBounds(level: LevelData): BoatBounds {
  const { x, z } = level.spawn.position;
  let colliders = level.colliders.footprint;
  let water = level.water.footprint;
  if (colliders.contains(x, z)) {
    warn('barque', '« spawn_boat » est dans un mesh *_col → collisions désactivées pour rester jouable.');
    colliders = Footprint.empty();
  }
  if (!water.isEmpty && !water.contains(x, z)) {
    warn('barque', '« spawn_boat » est hors du plan d’eau → limite du plan d’eau désactivée.');
    water = Footprint.empty();
  }
  return new BoatBounds(colliders, water, CONFIG.boat.collisionRadius);
}
