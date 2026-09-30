import type { Object3D } from 'three';
import { info } from '../core/log';
import type { DecorSlot } from '../data/shop';
import { defaultDecor, type Shop } from '../progression/shop';
import { ColorSwap } from './colorSwap';
import type { Lantern } from './lantern';

/**
 * Décoration achetée à la cabane : peinture de la barque, couleur du bouchon
 * et lueur de la lanterne. Les modèles sont repeints là où ils portent la
 * couleur d'origine (décoration à prix 0 dans src/data/shop.ts).
 */
export class Decor {
  private readonly paint: ColorSwap;
  private readonly bobber: ColorSwap;
  private readonly lantern: Lantern;

  constructor(boatModel: Object3D, bobberModel: Object3D, lantern: Lantern) {
    this.paint = colorSwap(boatModel, 'boatPaint', 'barque');
    this.bobber = colorSwap(bobberModel, 'bobber', 'bouchon');
    this.lantern = lantern;
  }

  /** Applique la décoration utilisée en ce moment. */
  apply(shop: Shop): void {
    this.paint.apply(shop.decorColor('boatPaint'));
    this.bobber.apply(shop.decorColor('bobber'));
    this.lantern.setColor(shop.decorColor('lantern'));
  }
}

function colorSwap(model: Object3D, slot: DecorSlot, label: string): ColorSwap {
  const { effect } = defaultDecor(slot);
  const original = effect.kind === 'decor' ? effect.color : 0;
  const swap = new ColorSwap(model, original);
  if (swap.isEmpty) {
    info('décoration', `${label} : couleur d’origine #${original.toString(16)} introuvable → sa décoration n’aura pas d’effet.`);
  }
  return swap;
}
