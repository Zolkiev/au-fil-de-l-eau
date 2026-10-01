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

/** Ce qui peut recevoir une vraie lumière : lanterne, fenêtre, feu de camp. */
export interface LightSource {
  readonly position: Vector3;
  readonly color: Color;
  /** Intensité à pleine nuit. */
  readonly intensity: number;
  /** Part de l'intensité gardée en plein jour (0 pour une lanterne, un peu pour un feu). */
  readonly day: number;
  /** Vacillement du moment (× intensité) : le feu de camp le fait varier. */
  flicker: number;
}

/** Une vraie lumière, prêtée à une source ; `level` fond de 0 à 1 quand elle en change. */
interface Slot {
  readonly light: PointLight;
  source: LightSource | null;
  level: number;
}

/**
 * Lumières de nuit du décor :
 * - tout objet du décor à matériau émissif (lanternes, fenêtres, lanterne du
 *   phare) s'allume avec la nuit ; le jour, il brille à peine ;
 * - chacun reçoit un halo ; les sources les plus proches de la barque
 *   (lanternes, fenêtres, feux de camp) reçoivent une vraie lumière chaude,
 *   qui éclaire les alentours et se reflète sur l'eau ;
 * - un phare (Empty `beacon`) balaie la nuit de son faisceau tournant.
 *
 * Les lumières existent toujours (intensité 0 le jour) et passent d'une
 * source à l'autre en fondu : en ajouter ou en retirer forcerait Three.js à
 * recompiler tous les shaders.
 */
export class NightLights {
  readonly group = new Group();
  /** Matériaux émissifs et leur intensité d'origine (celle de Blender). */
  private readonly materials = new Map<MeshStandardMaterial, number>();
  private readonly halos: Sprite[] = [];
  private readonly sources: LightSource[] = [];
  private readonly slots: Slot[] = [];
  private activeSlots: number = CONFIG.nightLights.maxLights;
  private readonly beacon: Group | null = null;
  private readonly beamMaterial = createBeamMaterial();

  constructor(level: LevelData) {
    this.group.name = 'night_lights';
    for (const mesh of emissiveMeshes(level.decor)) this.addGlow(mesh);
    const { light, maxLights } = CONFIG.nightLights;
    for (let i = 0; i < maxLights; i++) {
      const pointLight = new PointLight(light.color, 0, light.distance, 2);
      this.slots.push({ light: pointLight, source: null, level: 0 });
      this.group.add(pointLight);
    }
    if (level.beacon) {
      this.beacon = createBeacon(level.beacon, this.beamMaterial);
      this.group.add(this.beacon);
    }
  }

  /** Déclare une source de lumière de plus (feu de camp) ; elle règle ensuite son `flicker`. */
  addSource(position: Vector3, color: number, intensity: number, day: number): LightSource {
    const source: LightSource = { position: position.clone(), color: new Color(color), intensity, day, flicker: 1 };
    this.sources.push(source);
    return source;
  }

  /**
   * Nombre de vraies lumières allumées (qualité graphique) ; les autres
   * sources gardent leur halo. Changer ce nombre recompile les shaders une fois.
   */
  setMaxLights(count: number): void {
    this.activeSlots = Math.min(count, this.slots.length);
    this.slots.forEach((slot, index) => {
      slot.light.visible = index < this.activeSlots;
      if (slot.light.visible) return;
      // Une lumière éteinte rend sa source : une autre pourra l'éclairer
      slot.source = null;
      slot.level = 0;
    });
  }

  /** `night` : 0 (jour) → 1 (pleine nuit) ; `focus` : la barque, pour éclairer ce qui est près d'elle. */
  update(dt: number, night: number, focus: Vector3): void {
    const { dayGlow, nightGlow, haloOpacity, beacon } = CONFIG.nightLights;
    const glow = MathUtils.lerp(dayGlow, nightGlow, night);
    this.materials.forEach((base, material) => (material.emissiveIntensity = base * glow));
    this.halos.forEach((halo) => (halo.material.opacity = night * haloOpacity));
    this.lend(dt, night, focus);
    if (!this.beacon) return;
    this.beacon.visible = night > 0.05;
    this.beacon.rotation.y += dt * beacon.speed;
    this.beamMaterial.opacity = night * beacon.opacity;
  }

  /** Prête les vraies lumières aux sources les plus proches de `focus`, en fondu. */
  private lend(dt: number, night: number, focus: Vector3): void {
    const { reach, fade } = CONFIG.nightLights;
    const wanted = this.nearest(focus);
    for (let i = 0; i < this.activeSlots; i++) {
      const slot = this.slots[i];
      const keep = slot.source !== null && wanted.includes(slot.source);
      slot.level = MathUtils.damp(slot.level, keep ? 1 : 0, fade, dt);
      // Éteinte : elle peut partir éclairer une source proche qui n'a pas encore de lumière
      if (!keep && slot.level < 0.02) slot.source = wanted.find((source) => !this.slots.some((other) => other.source === source)) ?? null;
      const source = slot.source;
      if (!source) {
        slot.light.intensity = 0;
        continue;
      }
      const near = 1 - MathUtils.smoothstep(source.position.distanceTo(focus), reach.full, reach.none);
      slot.light.position.copy(source.position);
      slot.light.color.copy(source.color);
      slot.light.intensity = slot.level * near * source.intensity * source.flicker * MathUtils.lerp(source.day, 1, night);
    }
  }

  /**
   * Sources à éclairer : les plus proches de `focus`, autant qu'il y a de
   * lumières. Une source déjà éclairée garde un petit avantage (elle ne perd
   * pas sa lumière pour un mètre d'écart).
   */
  private nearest(focus: Vector3): LightSource[] {
    const lit = new Set(this.slots.map((slot) => slot.source));
    const distance = (source: LightSource): number => source.position.distanceTo(focus) - (lit.has(source) ? 4 : 0);
    return [...this.sources]
      .filter((source) => source.position.distanceTo(focus) < CONFIG.nightLights.reach.none)
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, this.activeSlots);
  }

  /** Halo autour d'un objet émissif, qui devient aussi une source de lumière. */
  private addGlow(mesh: Mesh): void {
    const material = mesh.material as MeshStandardMaterial;
    if (!this.materials.has(material)) this.materials.set(material, material.emissiveIntensity);
    const { haloScale, haloMax, light } = CONFIG.nightLights;
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
    this.addSource(center, light.color, light.intensity, 0);
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
