import { ArrowHelper, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type Object3D } from 'three';
import { CONFIG } from '../config';
import type { FishingZone, LevelData, ZoneType } from './levelLoader';

const ZONE_COLORS: Record<ZoneType, number> = {
  shallow: 0x7fe0c8,
  deep: 0x3a6fd8,
  reeds: 0xb5d65a,
  rocks: 0xc9a27e,
};
const COLLIDER_COLOR = 0xff6b6b;
const SPAWN_COLOR = 0xffd166;
/** Hauteur des aides au-dessus de l'eau. */
const LIFT = 0.08;

/**
 * Aides visuelles pour vérifier un export Blender (touche G) :
 * collisions en rouge, zones de pêche colorées par type, flèche de départ jaune.
 */
export function createLevelHelpers(level: LevelData): Group {
  const helpers = new Group();
  helpers.name = 'level_helpers';
  helpers.visible = CONFIG.debug.showLevelHelpersAtStart;
  level.colliders.objects.forEach((object) => helpers.add(ghostOf(object, COLLIDER_COLOR)));
  level.zones.forEach((zone) => helpers.add(zoneHelper(zone, level.water.level)));
  helpers.add(spawnArrow(level));
  return helpers;
}

function zoneHelper(zone: FishingZone, waterLevel: number): Object3D {
  const color = ZONE_COLORS[zone.type];
  if (zone.radius === null) return ghostOf(zone.object, color);
  const ring = new Mesh(new RingGeometry(zone.radius - 0.2, zone.radius, 48).rotateX(-Math.PI / 2), helperMaterial(color));
  ring.position.set(zone.center.x, waterLevel + LIFT, zone.center.z);
  ring.renderOrder = 10;
  return ring;
}

/** Copie filaire d'un objet (ses meshes, replacés en coordonnées monde). */
function ghostOf(object: Object3D, color: number): Group {
  const ghost = new Group();
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const copy = new Mesh(child.geometry, helperMaterial(color, true));
    child.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    copy.renderOrder = 10;
    ghost.add(copy);
  });
  return ghost;
}

function spawnArrow(level: LevelData): ArrowHelper {
  const { position, yaw } = level.spawn;
  const direction = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const origin = position.clone().setY(level.water.level + 0.6);
  return new ArrowHelper(direction, origin, 3, SPAWN_COLOR, 0.8, 0.5);
}

/** Matériau visible à travers tout (pas de test de profondeur), non affecté par le brouillard. */
function helperMaterial(color: number, wireframe = false): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, wireframe, transparent: true, opacity: 0.75, depthTest: false, fog: false });
}
