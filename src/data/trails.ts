import { pick } from '../core/language';
import { fishById } from './fish';
import type { PlaceId } from './places';

/**
 * Pistes des poissons légendaires : trois indices par légendaire, écrits par
 * un vieux pêcheur et cachés dans des bouteilles à message (voir
 * src/progression/trails.ts). Chaque indice révèle une chose vraie sur le
 * poisson : où il vit, quand il sort, ce qui l'attire. Les faits eux-mêmes
 * viennent de src/data/fish.ts ; ici, seulement les messages.
 */

/** Les indices d'une piste, dans l'ordre où on les trouve. */
export const CLUE_KINDS = ['where', 'when', 'bait'] as const;
export type ClueKind = (typeof CLUE_KINDS)[number];

export interface Trail {
  /** Le légendaire pisté (src/data/fish.ts). */
  readonly speciesId: string;
  /** Message de la bouteille pour chaque indice. */
  readonly messages: Record<ClueKind, string>;
}

export const TRAILS: readonly Trail[] = [
  {
    speciesId: 'silure_brumes',
    messages: {
      where: pick(
        'Je l’ai vu ! Une ombre longue comme ma barque, là où le lac est le plus profond.',
        'I saw it! A shadow as long as my boat, where the lake is at its deepest.',
      ),
      when: pick(
        'Il ne monte qu’en pleine nuit. Les soirs de pleine lune, il oublie d’être méfiant.',
        'It only rises in the dead of night. On full-moon evenings, it forgets to be wary.',
      ),
      bait: pick(
        'Un gros ver, du maïs ou une cuillère qui brille : il n’est pas difficile. Mais attends la brume.',
        'A fat worm, sweetcorn or a shiny spinner: it isn’t fussy. But wait for the mist.',
      ),
    },
  },
  {
    speciesId: 'anguille_lune',
    messages: {
      where: pick(
        'Un ruban d’argent a filé sous ma barque, dans l’eau profonde… puis il a disparu dans les roseaux.',
        'A silver ribbon slipped under my boat, in the deep water… then it vanished into the reeds.',
      ),
      when: pick(
        'De jour, rien. Elle ne sort qu’à la nuit tombée, et la pleine lune l’attire.',
        'By day, nothing. It only comes out after nightfall, and the full moon draws it.',
      ),
      bait: pick(
        'Elle a pris mon ver sous une pluie battante. On dit qu’une cuillère la tente aussi.',
        'It took my worm in pouring rain. They say a spinner tempts it too.',
      ),
    },
  },
  {
    speciesId: 'espadon_marees',
    messages: {
      where: pick(
        'Au large, près des bouées, là où le fond se dérobe : un rostre a fendu la vague.',
        'Offshore, near the buoys, where the bottom drops away: a bill sliced through the wave.',
      ),
      when: pick(
        'Il chasse la nuit. Guette la pleine lune : la mer brille, et lui aussi.',
        'It hunts at night. Watch for the full moon: the sea glitters, and so does it.',
      ),
      bait: pick(
        'Rien ne l’intéresse, sauf ce qui scintille : une cuillère, par une nuit de brume.',
        'Nothing interests it but what glitters: a spinner, on a misty night.',
      ),
    },
  },
];

/** Piste d'un légendaire, s'il en a une. */
export function trailOf(speciesId: string): Trail | undefined {
  return TRAILS.find((trail) => trail.speciesId === speciesId);
}

/** Piste du légendaire qui vit dans ce lieu. */
export function trailIn(place: PlaceId): Trail | undefined {
  return TRAILS.find((trail) => fishById(trail.speciesId)?.place === place);
}
