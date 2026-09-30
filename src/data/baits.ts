/**
 * Appâts, dans l'ordre des touches 1 à 6. Les trois premiers sont offerts ;
 * les autres s'achètent à la cabane de Moustache (voir src/data/shop.ts).
 * Chaque espèce indique les appâts qu'elle préfère (src/data/fish.ts).
 */

export type BaitId = 'worm' | 'maggot' | 'corn' | 'spinner' | 'boilie' | 'fly';

export interface Bait {
  readonly id: BaitId;
  readonly name: string;
  readonly icon: string;
  /** Texte court pour l'interface. */
  readonly description: string;
  /** Multiplicateur du temps d'attente (< 1 = ça mord plus vite). */
  readonly waitFactor: number;
  /** Multiplicateur de CONFIG.fishSelection.sizeSkew (< 1 = les grandes tailles sortent plus souvent). */
  readonly sizeFactor: number;
  /** Multiplicateur de la chance de variante rare (CONFIG.progression.variantChance). */
  readonly variantFactor: number;
  /** Vendu à la cabane : il faut l'acheter avant de l'utiliser. */
  readonly sold: boolean;
}

export const BAITS: readonly Bait[] = [
  {
    id: 'worm',
    name: 'Ver de terre',
    icon: '🪱',
    description: 'L’appât à tout faire : presque tous les poissons y goûtent.',
    waitFactor: 1,
    sizeFactor: 1,
    variantFactor: 1,
    sold: false,
  },
  {
    id: 'maggot',
    name: 'Asticots',
    icon: '🐛',
    description: 'Les touches arrivent vite, surtout chez les petits poissons.',
    waitFactor: 0.75,
    sizeFactor: 1,
    variantFactor: 1,
    sold: false,
  },
  {
    id: 'corn',
    name: 'Grain de maïs',
    icon: '🌽',
    description: 'Il faut de la patience, mais les gros poissons en raffolent.',
    waitFactor: 1.35,
    sizeFactor: 0.85,
    variantFactor: 1,
    sold: false,
  },
  {
    id: 'spinner',
    name: 'Cuillère brillante',
    icon: '🥄',
    description: 'Elle tournoie et scintille : les chasseurs (perche, sandre, brochet) ne résistent pas.',
    waitFactor: 1.1,
    sizeFactor: 1,
    variantFactor: 1,
    sold: true,
  },
  {
    id: 'boilie',
    name: 'Bouillette parfumée',
    icon: '🍡',
    description: 'Les poissons de fond (carpe, tanche, brème) la sentent de loin. Les prises sont plus grosses.',
    waitFactor: 1.4,
    sizeFactor: 0.6,
    variantFactor: 1,
    sold: true,
  },
  {
    id: 'fly',
    name: 'Mouche dorée',
    icon: '🪰',
    description: 'Les poissons de surface l’adorent, et les variantes rares se montrent plus souvent.',
    waitFactor: 0.9,
    sizeFactor: 1,
    variantFactor: 2.5,
    sold: true,
  },
];

/** Appât par identifiant. */
export function baitById(id: string): Bait | undefined {
  return BAITS.find((bait) => bait.id === id);
}
