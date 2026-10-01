import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  type Texture,
} from 'three';

/** Une particule : position, vitesse, âge, aspect. Les champs sont réécrits à chaque naissance. */
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  /** Durée de vie (s). */
  life: number;
  /** Taille (m) à la naissance et à la fin de sa vie. */
  size: number;
  endSize: number;
  r: number;
  g: number;
  b: number;
  /** Opacité au plus fort (elle apparaît en fondu, puis s'efface jusqu'à la fin). */
  alpha: number;
  /** Part de la vie passée à apparaître (0 → 1). */
  fadeIn: number;
  /** Chute (m/s², positive vers le bas ; négative : la particule monte de plus en plus vite). */
  gravity: number;
  /** Freinage de l'air (1/s). */
  drag: number;
  rotation: number;
  /** Vitesse de rotation (rad/s). */
  spin: number;
  /** Hauteur sous laquelle la particule disparaît (surface de l'eau), ou -Infinity. */
  floor: number;
}

export interface ParticleOptions {
  /** Nombre maximal de particules affichées en même temps (au-delà, la plus vieille est remplacée). */
  readonly capacity: number;
  readonly texture: Texture;
  /** Mélange additif (flammes, étincelles) au lieu d'un fondu (fumée, embruns, gouttes). */
  readonly additive?: boolean;
}

const VERTEX = /* glsl */ `
  attribute vec3 offset;
  attribute vec4 tint;
  attribute vec2 shape;
  varying vec4 vTint;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vTint = tint;
    vUv = uv;
    // Carré toujours face à la caméra, de côté shape.x, tourné de shape.y
    vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0);
    float c = cos(shape.y);
    float s = sin(shape.y);
    vec2 corner = position.xy * shape.x;
    mvPosition.xy += vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 light;
  varying vec4 vTint;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float alpha = vTint.a * texture2D(map, vUv).a;
    gl_FragColor = vec4(vTint.rgb * light, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/**
 * Particules : de petits carrés face à la caméra (une seule géométrie
 * instanciée, un seul appel de dessin), animés en code. Sert à la fumée, aux
 * embruns, aux flammes, aux étincelles et aux éclaboussures.
 *
 * `spawn()` rend une particule à remplir ; `update()` les fait vivre.
 */
export class Particles {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly pool: Particle[];
  private readonly offsets: InstancedBufferAttribute;
  private readonly tints: InstancedBufferAttribute;
  private readonly shapes: InstancedBufferAttribute;
  /** Nombre de particules vivantes (les premières du tableau). */
  private alive = 0;

  constructor(name: string, options: ParticleOptions) {
    const { capacity, texture, additive = false } = options;
    this.pool = Array.from({ length: capacity }, () => blankParticle());
    this.offsets = dynamicAttribute(capacity, 3);
    this.tints = dynamicAttribute(capacity, 4);
    this.shapes = dynamicAttribute(capacity, 2);
    const quad = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(quad.getIndex());
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.setAttribute('offset', this.offsets);
    geometry.setAttribute('tint', this.tints);
    geometry.setAttribute('shape', this.shapes);
    geometry.instanceCount = 0;
    const material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, { map: { value: null }, light: { value: new Color(0xffffff) } }]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      // En additif, le brouillard ajouterait sa couleur : ces particules-là (flammes, étincelles) restent vives
      fog: !additive,
    });
    material.uniforms.map.value = texture;
    this.mesh = new Mesh(geometry, material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Teinte commune (lumière ambiante) : la fumée s'assombrit la nuit. */
  setLight(color: Color): void {
    (this.mesh.material.uniforms.light.value as Color).copy(color);
  }

  /**
   * Nouvelle particule, remise à zéro : l'appelant règle ses champs. Si tout
   * est pris, la plus proche de sa fin est remplacée.
   */
  spawn(): Particle {
    const particle = this.alive < this.pool.length ? this.pool[this.alive++] : this.oldest();
    return Object.assign(particle, BLANK);
  }

  update(dt: number): void {
    let index = 0;
    while (index < this.alive) {
      const particle = this.pool[index];
      particle.age += dt;
      if (particle.age >= particle.life || particle.y < particle.floor) {
        this.retire(index);
        continue;
      }
      move(particle, dt);
      this.write(index, particle);
      index++;
    }
    this.mesh.geometry.instanceCount = this.alive;
    this.mesh.visible = this.alive > 0;
    this.offsets.needsUpdate = true;
    this.tints.needsUpdate = true;
    this.shapes.needsUpdate = true;
  }

  /** La particule morte échange sa place avec la dernière vivante. */
  private retire(index: number): void {
    this.alive--;
    const last = this.pool[this.alive];
    this.pool[this.alive] = this.pool[index];
    this.pool[index] = last;
  }

  private oldest(): Particle {
    return this.pool.reduce((best, particle) => (particle.age / particle.life > best.age / best.life ? particle : best));
  }

  private write(index: number, particle: Particle): void {
    const t = particle.age / particle.life;
    const appear = particle.fadeIn > 0 ? Math.min(1, t / particle.fadeIn) : 1;
    const fade = 1 - Math.max(0, (t - particle.fadeIn) / (1 - particle.fadeIn));
    this.offsets.setXYZ(index, particle.x, particle.y, particle.z);
    this.tints.setXYZW(index, particle.r, particle.g, particle.b, particle.alpha * appear * fade);
    this.shapes.setXY(index, particle.size + (particle.endSize - particle.size) * t, particle.rotation);
  }
}

const BLANK: Particle = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 1,
  size: 1,
  endSize: 1,
  r: 1,
  g: 1,
  b: 1,
  alpha: 1,
  fadeIn: 0,
  gravity: 0,
  drag: 0,
  rotation: 0,
  spin: 0,
  floor: -Infinity,
};

function blankParticle(): Particle {
  return { ...BLANK };
}

function dynamicAttribute(count: number, itemSize: number): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function move(particle: Particle, dt: number): void {
  const slow = Math.exp(-particle.drag * dt);
  particle.vx *= slow;
  particle.vy = particle.vy * slow - particle.gravity * dt;
  particle.vz *= slow;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.z += particle.vz * dt;
  particle.rotation += particle.spin * dt;
}

let puff: CanvasTexture | null = null;

/** Disque très doux (bord fondu), pour les volutes de fumée et les embruns. */
export function puffTexture(): CanvasTexture {
  if (puff) return puff;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  puff = new CanvasTexture(canvas);
  puff.colorSpace = SRGBColorSpace;
  return puff;
}
