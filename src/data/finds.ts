import { pick } from '../core/language';
import type { PlaceId } from './places';

/**
 * Trouvailles : de petits objets qui flottent dans les recoins des lieux de
 * pêche. On les repêche en passant dessus avec la barque, puis Moustache
 * les examine au ponton et les échange contre des coquillages. Chaque lieu a
 * les siennes ; les rares sortent moins souvent (CONFIG.finds).
 */

export type CurioRarity = 'common' | 'rare';

export interface Curio {
  /** Identifiant stable (clé de sauvegarde). */
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Lieu où on la trouve. */
  readonly place: PlaceId;
  readonly rarity: CurioRarity;
  /** Ce qu'en dit Moustache en la découvrant. */
  readonly comment: string;
}

export const CURIOS: readonly Curio[] = [
  // --- Le lac ---
  curio('old_boot', pick('Vieille botte', 'Old boot'), '🥾', 'lake', 'common', pick('Elle a dû faire le tour du lac plus d’une fois.', 'It must have been round the lake more than once.')),
  curio('wooden_duck', pick('Canard en bois', 'Wooden duck'), '🦆', 'lake', 'common', pick('Un appelant d’autrefois. Il flotte encore !', 'An old decoy. It still floats!')),
  curio('rusty_key', pick('Clé rouillée', 'Rusty key'), '🗝️', 'lake', 'common', pick('Je me demande quelle porte elle ouvrait…', 'I wonder which door it used to open…')),
  curio('bait_tin', pick('Boîte à appâts', 'Bait tin'), '🥫', 'lake', 'common', pick('Vide. Dommage, j’ai un faible pour les asticots.', 'Empty. A pity, I have a soft spot for maggots.')),
  curio('straw_hat', pick('Chapeau de paille', 'Straw hat'), '👒', 'lake', 'common', pick('Le vent l’a pris à quelqu’un. Il me va bien, non ?', 'The wind took it from someone. Suits me, doesn’t it?')),
  curio('lake_bottle', pick('Bouteille au message', 'Message in a bottle'), '🍾', 'lake', 'rare', pick('Un message ! “Les plus gros dorment sous la pleine lune.”', 'A message! ‘The biggest ones sleep under the full moon.’')),

  // --- La rivière ---
  curio('old_coin', pick('Pièce ancienne', 'Old coin'), '🪙', 'river', 'common', pick('Quelqu’un a fait un vœu du haut du pont.', 'Someone made a wish from the top of the bridge.')),
  curio('horseshoe', pick('Fer à cheval', 'Horseshoe'), '🧲', 'river', 'common', pick('Ça porte bonheur. Garde-le dans la barque !', 'It brings good luck. Keep it in the boat!')),
  curio('bark_boat', pick('Bateau d’écorce', 'Bark boat'), '⛵', 'river', 'common', pick('Il a descendu toute la rivière sans chavirer.', 'It sailed all the way down the river without capsizing.')),
  curio('wooden_spoon', pick('Cuillère en bois', 'Wooden spoon'), '🥄', 'river', 'common', pick('Pour la soupe de poisson. Miam.', 'For the fish soup. Yum.')),
  curio('pocket_watch', pick('Montre à gousset', 'Pocket watch'), '⌚', 'river', 'rare', pick('Elle s’est arrêtée pile à l’heure de la sieste.', 'It stopped right at nap time.')),
  curio('gold_nugget', pick('Pépite', 'Gold nugget'), '✨', 'river', 'rare', pick('De l’or ! La cascade en charrie donc encore…', 'Gold! So the waterfall still washes some down…')),

  // --- La crique ---
  curio('starfish', pick('Étoile de mer', 'Starfish'), '⭐', 'cove', 'common', pick('Toute sèche. Je la mets sur l’étagère.', 'All dried out. I’ll put it on the shelf.')),
  curio('compass', pick('Boussole', 'Compass'), '🧭', 'cove', 'common', pick('Elle montre toujours le phare. Drôle de boussole.', 'It always points to the lighthouse. Funny sort of compass.')),
  curio('spyglass', pick('Longue-vue', 'Spyglass'), '🔭', 'cove', 'common', pick('Avec ça, je verrai sauter les poissons depuis le ponton.', 'With this, I’ll see the fish jumping from the dock.')),
  curio('cork_buoy', pick('Petite bouée de liège', 'Little cork float'), '🛟', 'cove', 'common', pick('Elle s’est décrochée d’un filet, au large.', 'It came loose from a net, out at sea.')),
  curio('glass_float', pick('Flotteur de verre', 'Glass float'), '🔮', 'cove', 'rare', pick('Un flotteur de pêcheur d’autrefois. On dirait une bulle de mer.', 'A fisherman’s float from long ago. It looks like a bubble of sea.')),
  curio('pearl', pick('Perle', 'Pearl'), '🦪', 'cove', 'rare', pick('Une vraie perle ! Ne le dis pas aux mouettes.', 'A real pearl! Don’t tell the gulls.')),
];

export function curioById(id: string): Curio | undefined {
  return CURIOS.find((item) => item.id === id);
}

/** Trouvailles possibles dans un lieu. */
export function curiosOf(place: PlaceId): Curio[] {
  return CURIOS.filter((item) => item.place === place);
}

function curio(id: string, name: string, icon: string, place: PlaceId, rarity: CurioRarity, comment: string): Curio {
  return { id, name, icon, place, rarity, comment };
}
