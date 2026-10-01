import { Color, type Object3D } from 'three';
import { info } from '../core/log';
import type { DecorSlot } from '../data/shop';
import { defaultDecor, type Shop } from '../progression/shop';
import { ColorSwap } from './colorSwap';
import type { Lantern } from './lantern';

/**
 * Pièces plus sombres assorties à une couleur de tenue (couleurs d'origine
 * dans blender/petite_peche/props.py) : la bande du bob, le rabat et les
 * manchettes du ciré. Elles suivent la couleur choisie, assombrie.
 */
const TRIMS = { hat: { original: 0x55603a, shade: 0.72 }, coat: { original: 0xc38d2b, shade: 0.78 } };

const _shade = new Color();

/**
 * Décoration achetée à la cabane : peinture de la barque, couleur du bouchon,
 * lueur de la lanterne, et tenue du pêcheur (bob, ciré, écharpe). Les modèles
 * sont repeints là où ils portent la couleur d'origine (décoration à prix 0
 * dans src/data/shop.ts).
 */
export class Decor {
  private readonly swaps: { slot: DecorSlot; swap: ColorSwap; trim?: ColorSwap; shade?: number }[];
  private readonly lantern: Lantern;

  constructor(boatModel: Object3D, bobberModel: Object3D, lantern: Lantern, fisherModel: Object3D) {
    this.swaps = [
      { slot: 'boatPaint', swap: colorSwap(boatModel, 'boatPaint', 'barque') },
      { slot: 'bobber', swap: colorSwap(bobberModel, 'bobber', 'bouchon') },
      { slot: 'hat', swap: colorSwap(fisherModel, 'hat', 'bob du pêcheur'), trim: new ColorSwap(fisherModel, TRIMS.hat.original), shade: TRIMS.hat.shade },
      { slot: 'coat', swap: colorSwap(fisherModel, 'coat', 'ciré du pêcheur'), trim: new ColorSwap(fisherModel, TRIMS.coat.original), shade: TRIMS.coat.shade },
      { slot: 'scarf', swap: colorSwap(fisherModel, 'scarf', 'écharpe du pêcheur') },
    ];
    this.lantern = lantern;
  }

  /** Applique la décoration utilisée en ce moment. */
  apply(shop: Shop): void {
    for (const { slot, swap, trim, shade } of this.swaps) {
      const color = shop.decorColor(slot);
      swap.apply(color);
      trim?.apply(_shade.set(color).multiplyScalar(shade ?? 1).getHex());
    }
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
