import { CONFIG } from '../config';
import { DEFAULT_PLACE, isPlaceId, type PlaceId } from '../data/places';
import type { JournalEntry } from './journal';
import { warn } from './log';
import { parseSettings, type Settings } from './settings';
import type { StatsData } from './stats';
import { readNumber, readObject } from './validate';

/**
 * Version du format : à incrémenter (avec une migration) si la structure
 * change. Un ajout avec valeur par défaut (comme `progression`, ou
 * `variant` dans le carnet) ne change pas la version : une ancienne
 * sauvegarde se relit telle quelle.
 */
const VERSION = 1;

/** État du monde qu'on retrouve en revenant. */
export interface WorldState {
  /** Lieu où l'on pêche (le niveau chargé au lancement). */
  place: PlaceId;
  /** Jours de jeu écoulés (phases de la lune). */
  day: number;
  hour: number;
  baitId: string;
  /** Temps qu'il fait (voir Weather.toData). */
  weather: unknown;
}

/** Ce que le jeu écrit dans la sauvegarde. */
export interface SaveSnapshot {
  journal: JournalEntry[];
  stats: StatsData;
  /** Demandes, boutique et coquillages (voir src/progression/). */
  progression: unknown;
  tutorial: { done: boolean };
  settings: Settings;
  world: WorldState;
}

/**
 * Sauvegarde relue. Le carnet, les statistiques et la progression restent
 * bruts : ils sont validés par Journal.fromData, Stats.fromData et Progression.
 */
export interface LoadedSave {
  journal: unknown;
  stats: unknown;
  progression: unknown;
  tutorial: unknown;
  settings: Settings;
  world: { place: PlaceId; day: number; hour: number; baitId: string | null; weather: unknown };
}

/** Relit la sauvegarde ; null s'il n'y en a pas, ou si elle est illisible (nouvelle partie). */
export function readSave(): LoadedSave | null {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    const data = readObject(JSON.parse(raw));
    if (data.version !== VERSION) {
      warn('sauvegarde', `version ${String(data.version)} inconnue → nouvelle partie.`);
      return null;
    }
    return parse(data);
  } catch (error) {
    warn('sauvegarde', 'sauvegarde illisible → nouvelle partie.', error);
    return null;
  }
}

function parse(data: Record<string, unknown>): LoadedSave {
  const world = readObject(data.world);
  return {
    journal: data.journal,
    stats: data.stats,
    progression: data.progression,
    tutorial: data.tutorial,
    settings: parseSettings(data.settings),
    world: {
      place: isPlaceId(world.place) ? world.place : DEFAULT_PLACE,
      day: Math.floor(readNumber(world.day, 0, 0)),
      hour: readNumber(world.hour, CONFIG.time.startHour, 0, 23.999),
      baitId: typeof world.baitId === 'string' ? world.baitId : null,
      weather: world.weather,
    },
  };
}

/**
 * Écrit la partie dans localStorage. Les demandes rapprochées sont
 * regroupées ; tout est écrit aussi quand l'onglet est caché ou fermé.
 * Si le navigateur refuse (navigation privée…), le jeu continue sans sauvegarde.
 */
export class SaveStore {
  private readonly snapshot: () => SaveSnapshot;
  private timer: number | undefined;
  private dirty = false;
  private disabled = false;
  private failed = false;

  constructor(snapshot: () => SaveSnapshot) {
    this.snapshot = snapshot;
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush();
    });
  }

  /** Demande une sauvegarde prochaine. */
  request(): void {
    this.dirty = true;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), CONFIG.save.debounceMs);
  }

  /** Écrit tout de suite s'il y a quelque chose à sauvegarder. */
  flush(): void {
    if (!this.dirty || this.disabled) return;
    this.dirty = false;
    try {
      localStorage.setItem(CONFIG.save.key, JSON.stringify({ version: VERSION, savedAt: Date.now(), ...this.snapshot() }));
    } catch (error) {
      if (!this.failed) warn('sauvegarde', 'écriture impossible (navigation privée ?) → la partie ne sera pas conservée.', error);
      this.failed = true;
    }
  }

  /** Efface la sauvegarde et n'en écrit plus jusqu'au rechargement de la page. */
  reset(): void {
    this.disabled = true;
    window.clearTimeout(this.timer);
    try {
      localStorage.removeItem(CONFIG.save.key);
    } catch {
      // Rien à effacer si le stockage est inaccessible
    }
  }
}
