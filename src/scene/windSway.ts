import { BufferAttribute, Mesh, Vector3, type Material, type WebGLProgramParametersWithUniforms } from 'three';
import { CONFIG } from '../config';
import { HeightSampler } from './heightSampler';
import type { LevelData } from './levelLoader';

const _world = new Vector3();

// Ondulation : le motif avance avec le temps et varie d'un endroit à l'autre ;
// le poids (`swayWeight`) vaut 0 au pied et 1 à partir de CONFIG.decorLife.swayHeight.
const SWAY_VERTEX = /* glsl */ `
  #include <begin_vertex>
  float swayPhase = uSwayTime * 1.6 + position.x * 0.35 + position.z * 0.27;
  float swayWave = sin(swayPhase) + 0.35 * sin(swayPhase * 2.3 + 1.1);
  transformed.x += swayWave * uSwayAmount * swayWeight;
  transformed.z += swayWave * uSwayAmount * swayWeight * 0.6;
`;

/**
 * Le vent dans le décor : les objets `deco_*_sway` (arbres, roseaux)
 * ondulent doucement, beaucoup plus quand il y a du vent. Leur pied reste
 * fixe : chaque sommet reçoit un poids selon sa hauteur au-dessus du sol,
 * mesurée une fois au chargement sur le reste du décor.
 */
export class WindSway {
  private readonly uniforms = { uSwayTime: { value: 0 }, uSwayAmount: { value: 0 } };
  /** Part du balancement conservée (réglage « Moins d'animations »). */
  private motionScale = 1;

  constructor(level: LevelData) {
    if (level.sway.length === 0) return;
    const ground = new HeightSampler(level.decor.filter((object) => !level.sway.includes(object)));
    for (const object of level.sway) {
      object.traverse((child) => {
        if (child instanceof Mesh) this.prepare(child, ground);
      });
    }
  }

  setMotionScale(scale: number): void {
    this.motionScale = scale;
  }

  /** `wind` : intensité du vent (0 → 1). */
  update(elapsed: number, wind: number): void {
    const { calm, windy } = CONFIG.decorLife.swayAmount;
    this.uniforms.uSwayTime.value = elapsed;
    this.uniforms.uSwayAmount.value = (calm + (windy - calm) * wind) * this.motionScale;
  }

  private prepare(mesh: Mesh, ground: HeightSampler): void {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    const weights = new Float32Array(position.count);
    const height = CONFIG.decorLife.swayHeight;
    for (let i = 0; i < position.count; i++) {
      _world.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const floor = ground.groundAt(_world.x, _world.z, _world.y) ?? _world.y;
      weights[i] = Math.min(1, Math.max(0, (_world.y - floor) / height));
    }
    mesh.geometry.setAttribute('swayWeight', new BufferAttribute(weights, 1));
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((material) => this.swaying(material)) : this.swaying(mesh.material);
  }

  private swaying(material: Material): Material {
    const swaying = material.clone();
    swaying.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = `attribute float swayWeight;\nuniform float uSwayTime;\nuniform float uSwayAmount;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        SWAY_VERTEX,
      );
    };
    swaying.customProgramCacheKey = () => 'petite-peche-sway';
    return swaying;
  }
}
