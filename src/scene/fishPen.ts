import { CircleGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { CONFIG } from '../config';
import { fishById } from '../data/fish';
import { loadFishInstance, type FishModel } from '../fishing/fishModel';
import type { KeptFish } from '../progression/keptFish';
import type { CameraView } from './cameraRig';
import type { PenInfo } from './levelLoader';

/** Un poisson qui tourne dans le bac. */
interface Swimmer {
  readonly model: FishModel;
  /** Porte l'orientation et la taille ; le modèle garde les siennes (animation). */
  readonly holder: Group;
  readonly radius: number;
  /** Vitesse angulaire (rad/s), signée : sens de rotation. */
  readonly angularSpeed: number;
  readonly depth: number;
  readonly phase: number;
  angle: number;
}

/**
 * Vivier de la cabane : le bac (modélisé dans le décor, `deco_*`) reçoit ici
 * une eau transparente et les poissons gardés, qui y tournent en nageant.
 * Placé sur l'Empty `fish_pen` du niveau.
 */
export class FishPen {
  readonly group = new Group();
  private readonly info: PenInfo;
  private swimmers: Swimmer[] = [];
  /** Numéro du dernier remplissage : un chargement dépassé est ignoré. */
  private version = 0;

  constructor(info: PenInfo) {
    this.info = info;
    this.group.name = 'fish_pen';
    this.group.position.copy(info.center);
    this.group.add(createPenWater(info.radius));
  }

  /** Remplace les poissons du bac (chargés en arrière-plan). */
  async setFish(kept: readonly KeptFish[]): Promise<void> {
    const version = ++this.version;
    const loaded = await Promise.all(kept.map((fish) => loadSwimmerModel(fish)));
    if (version !== this.version) return;
    this.swimmers.forEach((swimmer) => this.group.remove(swimmer.holder));
    this.swimmers = loaded.flatMap((entry, index) => (entry ? [this.createSwimmer(entry.model, entry.fish, index, loaded.length)] : []));
    this.swimmers.forEach((swimmer) => this.group.add(swimmer.holder));
  }

  update(dt: number, elapsed: number): void {
    for (const swimmer of this.swimmers) this.swim(swimmer, dt, elapsed);
  }

  /**
   * Point de vue de la vue rapprochée : l'Empty `cam_fish_pen` s'il existe,
   * sinon en retrait côté terre (dos au lac, `lakeCenter`), un peu au-dessus.
   */
  view(lakeCenter: Vector2): CameraView {
    const { center, view } = this.info;
    const target = center.clone().setY(center.y - 0.15);
    if (view) return { position: view.clone(), target };
    const away = new Vector2(center.x - lakeCenter.x, center.z - lakeCenter.y).normalize();
    const { viewDistance, viewHeight } = CONFIG.pen;
    const position = new Vector3(center.x + away.x * viewDistance, center.y + viewHeight, center.z + away.y * viewDistance);
    return { position, target };
  }

  private createSwimmer(model: FishModel, fish: KeptFish, index: number, count: number): Swimmer {
    const { fishLength, swimSpeed, depth } = CONFIG.pen;
    const length = MathUtils.clamp(fish.sizeCm / 100, fishLength.min, fishLength.max);
    const holder = new Group();
    holder.add(model.root);
    holder.scale.setScalar(length / model.length);
    // Rayons répartis du centre vers le bord, sans que le poisson dépasse du bac
    const maxRadius = Math.max(0.1, this.info.radius - length * 0.6);
    const radius = maxRadius * (0.35 + 0.65 * ((index + 0.5) / count));
    const speed = MathUtils.lerp(swimSpeed.min, swimSpeed.max, Math.random());
    const direction = Math.random() < 0.5 ? -1 : 1;
    return {
      model,
      holder,
      radius,
      angularSpeed: (direction * speed) / radius,
      depth: MathUtils.lerp(depth.min, depth.max, Math.random()),
      phase: Math.random() * Math.PI * 2,
      angle: Math.random() * Math.PI * 2,
    };
  }

  /** Un tour de bac, avec un léger va-et-vient en profondeur et vers le bord. */
  private swim(swimmer: Swimmer, dt: number, elapsed: number): void {
    swimmer.angle += swimmer.angularSpeed * dt;
    const radius = swimmer.radius * (1 + Math.sin(elapsed * 0.4 + swimmer.phase) * 0.08);
    const { angle } = swimmer;
    swimmer.holder.position.set(Math.cos(angle) * radius, -swimmer.depth + Math.sin(elapsed * 0.9 + swimmer.phase) * 0.03, Math.sin(angle) * radius);
    // Tête dans le sens de la marche (tangente au cercle)
    const sign = Math.sign(swimmer.angularSpeed);
    swimmer.holder.rotation.y = Math.atan2(-Math.sin(angle) * sign, Math.cos(angle) * sign);
    swimmer.model.update(dt);
  }
}

async function loadSwimmerModel(fish: KeptFish): Promise<{ model: FishModel; fish: KeptFish } | null> {
  const species = fishById(fish.speciesId);
  if (!species) return null;
  return { model: await loadFishInstance(species, fish.variant), fish };
}

/** Surface de l'eau du bac : transparente pour qu'on voie les poissons. */
function createPenWater(radius: number): Mesh {
  const material = new MeshStandardMaterial({
    color: CONFIG.pen.waterColor,
    transparent: true,
    opacity: CONFIG.pen.waterOpacity,
    roughness: 0.4,
    depthWrite: false,
  });
  const water = new Mesh(new CircleGeometry(radius, 32).rotateX(-Math.PI / 2), material);
  water.name = 'fish_pen_water';
  water.renderOrder = 1;
  return water;
}
