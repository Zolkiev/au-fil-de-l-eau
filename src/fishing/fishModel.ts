import {
  AnimationMixer,
  Box3,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type AnimationClip,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { CONFIG } from '../config';
import { loadGLB } from '../core/assets';
import type { FishSpecies } from '../data/fish';

/** Uniforms de l'ondulation procédurale d'un poisson. */
interface SwimUniforms {
  readonly uSwimTime: { value: number };
  readonly uSwimHead: { value: number };
  readonly uSwimLength: { value: number };
}

// Une vague parcourt le corps de la tête vers la queue, plus ample vers la queue.
const SWIM_VERTEX = /* glsl */ `
  #include <begin_vertex>
  float swimTail = clamp((uSwimHead - transformed.z) / uSwimLength, 0.0, 1.0);
  float swimWave = sin(transformed.z * 5.0 / uSwimLength - uSwimTime * 7.0);
  transformed.x += swimWave * uSwimLength * 0.07 * swimTail * swimTail;
`;

// Variante rare : la couleur de l'espèce devient une teinte unique, plus ou
// moins claire selon la couleur d'origine (le dos reste plus sombre que le
// ventre, les pupilles restent noires), avec une très légère lueur.
const VARIANT_FRAGMENT = /* glsl */ `
  #include <color_fragment>
  float variantLight = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = uVariantColor * smoothstep(0.0, 0.6, variantLight) * 1.15;
`;
const VARIANT_GLOW = /* glsl */ `
  #include <emissivemap_fragment>
  totalEmissiveRadiance += uVariantColor * 0.08;
`;

/**
 * Modèle 3D d'une espèce, tête vers +Z. Il nage avec l'animation `swim` du
 * .glb si elle existe, sinon avec une ondulation procédurale (vertex shader).
 */
export class FishModel {
  readonly root: Object3D;
  /** Longueur du modèle le long de Z, dans ses propres unités. */
  readonly length: number;
  private readonly mixer: AnimationMixer | null = null;
  private readonly swimTime = { value: 0 };

  constructor(root: Object3D, swimClip?: AnimationClip) {
    this.root = root;
    const box = new Box3().setFromObject(root);
    this.length = Math.max(box.max.z - box.min.z, 0.001);
    if (swimClip) {
      this.mixer = new AnimationMixer(root);
      this.mixer.clipAction(swimClip).play();
    } else {
      addUndulation(root, { uSwimTime: this.swimTime, uSwimHead: { value: box.max.z }, uSwimLength: { value: this.length } });
    }
  }

  update(dt: number): void {
    this.swimTime.value += dt;
    this.mixer?.update(dt);
  }
}

const cache = new Map<string, Promise<FishModel>>();

/**
 * Modèle de l'espèce (chargé une seule fois) : `assets/fish/<id>.glb`, sinon
 * un placeholder. La variante rare est un modèle à part, recoloré.
 */
export function loadFishModel(species: FishSpecies, variant = false): Promise<FishModel> {
  const key = variant ? `${species.id}:variant` : species.id;
  let model = cache.get(key);
  if (!model) {
    model = createFishModel(species, variant);
    cache.set(key, model);
  }
  return model;
}

/**
 * Un modèle à part (non partagé), pour avoir plusieurs poissons de la même
 * espèce à l'écran : ceux du vivier.
 */
export function loadFishInstance(species: FishSpecies, variant: boolean): Promise<FishModel> {
  return createFishModel(species, variant);
}

async function createFishModel(species: FishSpecies, variant: boolean): Promise<FishModel> {
  const gltf = await loadGLB(`${CONFIG.assets.fishFolder}${species.id}.glb`, `Poisson « ${species.name} »`);
  const root = gltf?.scene ?? createPlaceholderFish(species);
  if (variant) recolor(root, species.variant.color);
  return new FishModel(root, gltf?.animations.find((clip) => clip.name === 'swim'));
}

/**
 * Poisson low poly aux couleurs de l'espèce : corps ovale, queue, nageoire
 * dorsale, yeux. Longueur 1 le long de Z, tête vers +Z. Toutes les pièces
 * partagent le même repère pour que l'ondulation soit continue.
 */
export function createPlaceholderFish(species: FishSpecies): Group {
  const body = fishMaterial(species.colors.body);
  const fins = fishMaterial(species.colors.fins);
  const eye = fishMaterial(0x23262b);
  const fish = new Group();
  fish.name = `fish_placeholder_${species.id}`;
  fish.add(
    new Mesh(new SphereGeometry(0.5, 12, 8).scale(0.26, 0.34, 1), body),
    new Mesh(new ConeGeometry(0.24, 0.34, 4).rotateX(Math.PI / 2).scale(0.15, 1, 1).translate(0, 0, -0.62), fins),
    new Mesh(new ConeGeometry(0.14, 0.22, 4).scale(0.15, 1, 1.4).rotateX(-0.5).translate(0, 0.22, 0.02), fins),
    new Mesh(new SphereGeometry(0.04, 6, 4).translate(0.17, 0.06, 0.34), eye),
    new Mesh(new SphereGeometry(0.04, 6, 4).translate(-0.17, 0.06, 0.34), eye),
  );
  return fish;
}

function fishMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.55 });
}

/** Remplace les matériaux du poisson par des copies qui ondulent. */
function addUndulation(root: Object3D, uniforms: SwimUniforms): void {
  replaceMaterials(root, (material) =>
    extendMaterial(material, 'swim', (shader) => {
      Object.assign(shader.uniforms, uniforms);
      const declarations = 'uniform float uSwimTime;\nuniform float uSwimHead;\nuniform float uSwimLength;\n';
      shader.vertexShader = declarations + shader.vertexShader.replace('#include <begin_vertex>', SWIM_VERTEX);
    }),
  );
}

/** Variante rare : remplace les matériaux par des copies teintes de `color`. */
function recolor(root: Object3D, color: number): void {
  const uniforms = { uVariantColor: { value: new Color(color) } };
  replaceMaterials(root, (material) =>
    extendMaterial(material, `variant-${color}`, (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = `uniform vec3 uVariantColor;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', VARIANT_FRAGMENT)
        .replace('#include <emissivemap_fragment>', VARIANT_GLOW);
    }),
  );
}

function replaceMaterials(root: Object3D, replace: (material: Material) => Material): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material);
  });
}

/**
 * Copie de `material` dont le shader est modifié par `patch`, après les
 * modifications déjà présentes (une variante qui ondule garde sa couleur).
 */
function extendMaterial(material: Material, key: string, patch: (shader: WebGLProgramParametersWithUniforms) => void): Material {
  const extended = material.clone();
  const previousPatch = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey();
  extended.onBeforeCompile = (shader, renderer) => {
    previousPatch(shader, renderer);
    patch(shader);
  };
  extended.customProgramCacheKey = () => `${previousKey}|fish-${key}`;
  return extended;
}
