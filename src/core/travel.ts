import { isPlaceId, type PlaceId } from '../data/places';

/*
 * Voyage d'un lieu à l'autre : la partie est sauvegardée (avec le nouveau
 * lieu), puis la page est rechargée et charge l'autre niveau. Ce petit mot
 * dans sessionStorage dit au jeu qu'on arrive de voyage : il saute alors
 * l'écran titre.
 */

const ARRIVAL_KEY = 'petite-peche-arrivee';

export function rememberArrival(place: PlaceId): void {
  try {
    sessionStorage.setItem(ARRIVAL_KEY, place);
  } catch {
    // Stockage indisponible : on repassera simplement par l'écran titre
  }
}

/** Lieu d'arrivée si l'on vient de voyager (une seule fois), sinon null. */
export function takeArrival(): PlaceId | null {
  try {
    const place = sessionStorage.getItem(ARRIVAL_KEY);
    sessionStorage.removeItem(ARRIVAL_KEY);
    return isPlaceId(place) ? place : null;
  } catch {
    return null;
  }
}
