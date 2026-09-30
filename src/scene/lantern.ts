import { Mesh, MeshStandardMaterial, PointLight, type Object3D } from 'three';
import { CONFIG } from '../config';
import { info } from '../core/log';
import { findByBlenderName } from './objectNames';

/**
 * Lanterne de la barque : une lumière chaude qui s'allume avec la nuit.
 * Placée sur l'objet `lantern` du modèle de barque ; les matériaux émissifs
 * de cet objet brillent en même temps.
 *
 * La lumière existe toujours (intensité 0 le jour) : en ajouter ou en retirer
 * une forcerait Three.js à recompiler tous les shaders.
 */
export class Lantern {
  private readonly light: PointLight;
  private readonly glowMaterials: MeshStandardMaterial[] = [];

  constructor(boatModel: Object3D) {
    const { color, distance } = CONFIG.dayNight.lantern;
    this.light = new PointLight(color, 0, distance, 2);
    this.light.name = 'lantern_light';
    const anchor = findByBlenderName(boatModel, 'lantern');
    if (!anchor) {
      info('barque', 'pas d’objet « lantern » dans boat.glb : lanterne placée au centre de la barque.');
      this.light.position.set(0, 1, 0);
      boatModel.add(this.light);
      return;
    }
    anchor.add(this.light);
    this.collectGlowMaterials(anchor);
  }

  /** Couleur de la lueur (décoration choisie à la cabane). */
  setColor(color: number): void {
    this.light.color.set(color);
    this.glowMaterials.forEach((material) => material.emissive.set(color));
  }

  /** `night` : 0 (jour, éteinte) → 1 (pleine nuit). */
  setNight(night: number): void {
    this.light.intensity = night * CONFIG.dayNight.lantern.intensity;
    this.glowMaterials.forEach((material) => (material.emissiveIntensity = 0.3 + night * 2.2));
  }

  private collectGlowMaterials(anchor: Object3D): void {
    anchor.traverse((child) => {
      if (!(child instanceof Mesh) || !(child.material instanceof MeshStandardMaterial)) return;
      if (child.material.emissive.getHex() !== 0) this.glowMaterials.push(child.material);
    });
  }
}
