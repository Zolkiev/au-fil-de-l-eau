import {
  AdditiveBlending,
  Box3,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { CONFIG } from '../config';
import { glowTexture } from './glowTexture';
import type { LevelData } from './levelLoader';

const _box = new Box3();
const _size = new Vector3();

/**
 * Lumières de nuit du décor :
 * - tout objet du décor à matériau émissif (lanternes, fenêtres, lanterne du
 *   phare) s'allume avec la nuit ; le jour, il brille à peine ;
 * - chacun reçoit un halo, et les premiers (CONFIG.nightLights.maxLights) une
 *   vraie lumière chaude, qui éclaire les alentours et se reflète sur l'eau ;
 * - un phare (Empty `beacon`) balaie la nuit de son faisceau tournant.
 *
 * Les lumières existent toujours (intensité 0 le jour) : en ajouter ou en
 * retirer forcerait Three.js à recompiler tous les shaders.
 */
export class NightLights {
  readonly group = new Group();
  /** Matériaux émissifs et leur intensité d'origine (celle de Blender). */
  private readonly materials = new Map<MeshStandardMaterial, number>();
  private readonly halos: Sprite[] = [];
  private readonly lights: PointLight[] = [];
  private readonly beacon: Group | null = null;
  private readonly beamMaterial = createBeamMaterial();

  constructor(level: LevelData) {
    this.group.name = 'night_lights';
    for (const mesh of emissiveMeshes(level.decor)) this.addGlow(mesh);
    if (level.beacon) {
      this.beacon = createBeacon(level.beacon, this.beamMaterial);
      this.group.add(this.beacon);
    }
  }

  /**
   * Nombre de vraies lumières allumées (qualité graphique) ; les autres
   * objets gardent leur halo. Changer ce nombre recompile les shaders une fois.
   */
  setMaxLights(count: number): void {
    this.lights.forEach((pointLight, index) => (pointLight.visible = index < count));
  }

  /** `night` : 0 (jour) → 1 (pleine nuit). */
  update(dt: number, night: number): void {
    const { dayGlow, nightGlow, haloOpacity, light, beacon } = CONFIG.nightLights;
    const glow = MathUtils.lerp(dayGlow, nightGlow, night);
    this.materials.forEach((base, material) => (material.emissiveIntensity = base * glow));
    this.halos.forEach((halo) => (halo.material.opacity = night * haloOpacity));
    this.lights.forEach((pointLight) => (pointLight.intensity = night * light.intensity));
    if (!this.beacon) return;
    this.beacon.visible = night > 0.05;
    this.beacon.rotation.y += dt * beacon.speed;
    this.beamMaterial.opacity = night * beacon.opacity;
  }

  /** Halo (et lumière, s'il en reste) autour d'un objet émissif. */
  private addGlow(mesh: Mesh): void {
    const material = mesh.material as MeshStandardMaterial;
    if (!this.materials.has(material)) this.materials.set(material, material.emissiveIntensity);
    const { haloScale, haloMax, light, maxLights } = CONFIG.nightLights;
    _box.setFromObject(mesh);
    const center = _box.getCenter(new Vector3());
    const size = Math.max(..._box.getSize(_size).toArray());
    const halo = new Sprite(
      new SpriteMaterial({ map: glowTexture(), color: material.emissive, blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }),
    );
    halo.position.copy(center);
    halo.scale.setScalar(Math.min(size * haloScale, haloMax));
    this.halos.push(halo);
    this.group.add(halo);
    if (this.lights.length >= maxLights) return;
    const pointLight = new PointLight(light.color, 0, light.distance, 2);
    pointLight.position.copy(center);
    this.lights.push(pointLight);
    this.group.add(pointLight);
  }
}

/** Meshes du décor dont le matériau brille (couleur d'émission non noire). */
function emissiveMeshes(decor: readonly Object3D[]): Mesh[] {
  const found: Mesh[] = [];
  for (const object of decor) {
    object.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial && child.material.emissive.getHex() !== 0) found.push(child);
    });
  }
  return found;
}

function createBeamMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: CONFIG.nightLights.beacon.color,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
}

/** Deux faisceaux opposés qui partent du centre de la lanterne, un peu inclinés vers le bas. */
function createBeacon(position: Vector3, material: MeshBasicMaterial): Group {
  const { length, radius, tilt } = CONFIG.nightLights.beacon;
  const beacon = new Group();
  beacon.name = 'beacon';
  beacon.position.copy(position);
  for (const side of [0, Math.PI]) {
    const beam = new Mesh(createBeamGeometry(length, radius), material);
    beam.rotation.set(0, side, -tilt);
    beam.renderOrder = 2;
    beacon.add(beam);
  }
  return beacon;
}

/**
 * Cône ouvert, pointe au centre et évasé vers +X. La couleur des sommets
 * s'éteint avec la distance (en mélange additif, noir = invisible) : le
 * faisceau se dissipe au loin.
 */
function createBeamGeometry(length: number, radius: number): ConeGeometry {
  const geometry = new ConeGeometry(radius, length, 20, 6, true);
  geometry.translate(0, -length / 2, 0);
  geometry.rotateZ(Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    const fade = Math.pow(1 - MathUtils.clamp(position.getX(i) / length, 0, 1), 1.6);
    color.setScalar(fade);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
