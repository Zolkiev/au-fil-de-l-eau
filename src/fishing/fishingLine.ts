import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Line, LineBasicMaterial, MathUtils, Vector3 } from 'three';

/** Nombre de segments de la courbe. */
const SEGMENTS = 24;
const RELAXED_COLOR = new Color(0xfdf8ec);
const TENSE_COLOR = new Color(0xff6b57);

const _middle = new Vector3();
const _control = new Vector3();
const _point = new Vector3();

/**
 * Ligne de pêche : une courbe (Bézier quadratique) de la pointe de la canne
 * au bouchon. Plus elle est détendue, plus elle s'affaisse vers l'eau.
 */
export class FishingLine {
  readonly object: Line<BufferGeometry, LineBasicMaterial>;
  private readonly positions = new Float32Array((SEGMENTS + 1) * 3);
  private readonly attribute: BufferAttribute;
  private readonly waterLevel: number;
  private slack = 0;

  constructor(waterLevel: number) {
    this.waterLevel = waterLevel;
    this.attribute = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry().setAttribute('position', this.attribute);
    this.object = new Line(geometry, new LineBasicMaterial({ color: RELAXED_COLOR, transparent: true, opacity: 0.85 }));
    this.object.name = 'fishing_line';
    this.object.frustumCulled = false;
  }

  /** La ligne rougit quand la tension (0 → 1) devient forte. */
  setTension(tension: number): void {
    this.object.material.color.lerpColors(RELAXED_COLOR, TENSE_COLOR, tension * tension);
  }

  /** Redessine la ligne de `from` à `to`. `slackGoal` : 0 = tendue, 1 = posée sur l'eau. */
  update(dt: number, from: Vector3, to: Vector3, slackGoal: number): void {
    this.slack = MathUtils.damp(this.slack, slackGoal, 4, dt);
    _middle.addVectors(from, to).multiplyScalar(0.5);
    const sag = this.slack * Math.max(0, _middle.y - this.waterLevel - 0.02);
    // Le milieu de la courbe descend de la moitié du déplacement du point de contrôle
    _control.copy(_middle).setY(_middle.y - 2 * sag);
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const u = 1 - t;
      _point.copy(from).multiplyScalar(u * u).addScaledVector(_control, 2 * u * t).addScaledVector(to, t * t);
      _point.toArray(this.positions, i * 3);
    }
    this.attribute.needsUpdate = true;
  }
}
