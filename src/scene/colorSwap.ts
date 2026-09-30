import { Color, Mesh, MeshStandardMaterial, type BufferAttribute, type Object3D } from 'three';

/** Écart maximal (par canal, en couleur linéaire) pour reconnaître la couleur d'origine. */
const TOLERANCE = 0.02;

const _color = new Color();

/**
 * Repeint les parties d'un modèle qui ont une couleur donnée : la peinture
 * de la barque, le dôme du bouchon… (décoration achetée à la cabane).
 *
 * Les assets Blender sont colorés par sommet : on retient les sommets de la
 * couleur d'origine. Les placeholders utilisent des matériaux : on retient
 * ceux de cette couleur. Si rien ne correspond, `apply` ne fait rien.
 */
export class ColorSwap {
  private readonly vertices: { attribute: BufferAttribute; indices: number[] }[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  /** `original` : couleur d'origine (sRGB, comme dans Blender ou un sélecteur de couleur). */
  constructor(root: Object3D, original: number) {
    const target = new Color(original);
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      this.collectVertices(child, target);
      this.collectMaterials(child, target);
    });
  }

  /** Rien à repeindre (couleur d'origine introuvable dans le modèle). */
  get isEmpty(): boolean {
    return this.vertices.length === 0 && this.materials.length === 0;
  }

  apply(color: number): void {
    _color.set(color);
    for (const { attribute, indices } of this.vertices) {
      for (const index of indices) attribute.setXYZ(index, _color.r, _color.g, _color.b);
      attribute.needsUpdate = true;
    }
    for (const material of this.materials) material.color.copy(_color);
  }

  private collectVertices(mesh: Mesh, target: Color): void {
    const attribute = mesh.geometry.getAttribute('color') as BufferAttribute | undefined;
    if (!attribute) return;
    const indices: number[] = [];
    for (let i = 0; i < attribute.count; i++) {
      _color.setRGB(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
      if (isClose(_color, target)) indices.push(i);
    }
    if (indices.length > 0) this.vertices.push({ attribute, indices });
  }

  private collectMaterials(mesh: Mesh, target: Color): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !material.vertexColors && isClose(material.color, target)) {
        this.materials.push(material);
      }
    }
  }
}

function isClose(a: Color, b: Color): boolean {
  return Math.abs(a.r - b.r) < TOLERANCE && Math.abs(a.g - b.g) < TOLERANCE && Math.abs(a.b - b.b) < TOLERANCE;
}
