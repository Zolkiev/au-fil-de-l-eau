import { Color, Group, IcosahedronGeometry, MathUtils, Mesh, MeshStandardMaterial, type BufferGeometry, type Vector3 } from 'three';
import type { Ambience } from './dayNight';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';

const WHITE = new Color(0xffffff);

/** Un nuage : sa place de départ autour de la caméra, sa hauteur et sa taille. */
interface Cloud {
  readonly mesh: Mesh;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly size: number;
  /** Rang d'apparition : les premiers restent visibles par beau temps, les autres arrivent avec la pluie. */
  readonly rank: number;
}

/**
 * Nuages low poly qui dérivent lentement dans le ciel, loin au-dessus de
 * l'eau. Éclairés comme le reste de la scène (roses au couchant, bleutés la
 * nuit), sans brouillard. Ils suivent la caméra à l'horizontale, comme le
 * ciel : on ne les atteint jamais. Plus nombreux et plus gris quand il pleut.
 */
export class Clouds {
  readonly group = new Group();
  private readonly clouds: Cloud[] = [];
  private readonly material = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, fog: false });
  private readonly overcastColor = new Color(CONFIG.clouds.overcastColor);
  private drift = 0;
  /** Assombrissement du ciel couvert (0 → 1), repris par la lueur du dessous. */
  private overcast = 0;

  constructor(random: () => number = Math.random) {
    const { count, height, size, area } = CONFIG.clouds;
    for (let i = 0; i < count; i++) {
      const cloudSize = MathUtils.lerp(size.min, size.max, random());
      const mesh = new Mesh(createCloudGeometry(random), this.material);
      mesh.name = 'cloud';
      this.group.add(mesh);
      this.clouds.push({
        mesh,
        x: (random() * 2 - 1) * area,
        z: (random() * 2 - 1) * area,
        height: MathUtils.lerp(height.min, height.max, random()),
        size: cloudSize,
        rank: i / count,
      });
    }
    this.group.name = 'clouds';
  }

  /**
   * Le dessous des nuages prend la couleur de l'horizon (blanc bleuté le jour,
   * rose au couchant, bleu nuit la nuit) : vu depuis la barque, c'est surtout
   * lui qu'on voit, et le soleil ne l'éclaire pas.
   */
  setAmbience(ambience: Ambience): void {
    const { underGlow } = CONFIG.clouds;
    this.material.emissive.copy(ambience.colors.skyHorizon).multiplyScalar(underGlow * (1 - 0.4 * this.overcast));
  }

  /**
   * `wind` (0 → 1) accélère la dérive ; `overcast` (0 → 1 : pluie, brume)
   * fait venir plus de nuages, plus gris.
   */
  update(dt: number, camera: Vector3, wind: number, overcast: number): void {
    this.overcast = overcast;
    const { speed, direction, area, coverage } = CONFIG.clouds;
    this.drift += dt * speed * (1 + 2 * wind);
    const shown = MathUtils.lerp(coverage.clear, coverage.overcast, overcast);
    this.material.color.copy(WHITE).lerp(this.overcastColor, overcast);
    const dx = Math.cos(direction) * this.drift;
    const dz = Math.sin(direction) * this.drift;
    for (const cloud of this.clouds) {
      // Position qui boucle dans un carré centré sur la caméra : un nuage sorti d'un côté revient de l'autre
      const x = wrap(cloud.x + dx - camera.x, area);
      const z = wrap(cloud.z + dz - camera.z, area);
      // Rétrécit près des bords du carré (il ne surgit jamais d'un coup) et quand il n'a pas sa place
      const edge = MathUtils.smoothstep(area - Math.max(Math.abs(x), Math.abs(z)), 0, area * 0.2);
      const presence = MathUtils.smoothstep(shown - cloud.rank, 0, 0.08);
      const scale = cloud.size * edge * presence;
      cloud.mesh.visible = scale > 0.01;
      cloud.mesh.position.set(camera.x + x, cloud.height, camera.z + z);
      cloud.mesh.scale.set(scale, scale * 0.5, scale * 0.7);
    }
  }
}

/** Ramène `value` dans [-half, half] (boucle). */
function wrap(value: number, half: number): number {
  const size = half * 2;
  return ((((value + half) % size) + size) % size) - half;
}

/** Amas de 4 à 6 boules à facettes alignées, au dessous aplati (rayon ≈ 1). */
function createCloudGeometry(random: () => number): BufferGeometry {
  const puffs: BufferGeometry[] = [];
  const count = 4 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const radius = MathUtils.lerp(0.35, 0.6, random()) * (1 - 0.5 * Math.abs(t - 0.5));
    const puff = new IcosahedronGeometry(radius, 1);
    puff.translate(MathUtils.lerp(-0.8, 0.8, t), (random() - 0.3) * 0.25, (random() - 0.5) * 0.35);
    puffs.push(puff);
  }
  const geometry = mergeGeometries(puffs);
  puffs.forEach((puff) => puff.dispose());
  flattenBottom(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

/** Écrase le dessous du nuage : un ventre plat, comme les cumulus. */
function flattenBottom(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y < -0.05) position.setY(i, -0.05 + (y + 0.05) * 0.25);
  }
  position.needsUpdate = true;
}
