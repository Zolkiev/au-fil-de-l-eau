import { placeById } from '../data/places';
import type { Feat } from '../data/shop';
import { TEXTS } from './texts';

/** Ce qu'il faut accomplir pour gagner un objet exclusif (« Attrape le poisson légendaire du lac »). */
export function featText(feat: Feat): string {
  switch (feat.kind) {
    case 'legend':
      return TEXTS.feats.legend(placeById(feat.place).of);
    case 'finds':
      return TEXTS.feats.finds(placeById(feat.place).of);
    case 'stars':
      return TEXTS.feats.stars(feat.count);
    case 'journal':
      return TEXTS.feats.journal;
    case 'stamps':
      return TEXTS.feats.stamps(feat.count);
  }
}
