import { CONFIG } from '../config';
import { BAITS } from '../data/baits';
import { DEFAULT_PLACE } from '../data/places';
import type { FishingController } from '../fishing/fishingController';
import { Progression } from '../progression/progression';
import { Journal } from './journal';
import { readSave, SaveStore, type LoadedSave, type SaveSnapshot, type WorldState } from './save';
import { defaultSettings, type Settings } from './settings';
import { Stats } from './stats';
import { readBoolean, readObject } from './validate';

/**
 * Tout ce que le joueur garde d'une partie à l'autre : carnet, statistiques,
 * réglages et progression (coquillages, demandes, boutique). Relus depuis la
 * sauvegarde au lancement, puis sauvegardés à chaque événement important
 * (lancer, prise, ligne vide, appât, achat) et régulièrement.
 */
export class Progress {
  /** Sauvegarde relue au lancement (null = nouvelle partie). */
  readonly saved: LoadedSave | null;
  readonly journal: Journal;
  readonly stats: Stats;
  readonly settings: Settings;
  readonly progression: Progression;
  /** Tutoriel déjà vu (ou passé), ou partie commencée avant son arrivée. */
  tutorialDone: boolean;
  private readonly store: SaveStore;
  private world: () => WorldState = () => ({
    place: DEFAULT_PLACE,
    day: 0,
    hour: CONFIG.time.startHour,
    baitId: BAITS[0].id,
    weather: null,
  });
  private autosaveTimer = 0;

  constructor() {
    this.saved = readSave();
    this.journal = Journal.fromData(this.saved?.journal);
    this.stats = Stats.fromData(this.saved?.stats);
    this.settings = this.saved?.settings ?? defaultSettings();
    this.progression = new Progression(this.journal, this.saved?.progression);
    this.tutorialDone = readBoolean(readObject(this.saved?.tutorial).done, false) || this.stats.data.casts > 0;
    this.store = new SaveStore(() => this.snapshot());
    this.progression.events.on('shop', () => this.store.request());
    this.progression.events.on('requests', () => this.store.request());
    this.progression.events.on('pen', () => this.store.request());
  }

  /** Branche les statistiques et la sauvegarde sur la pêche ; `world` donne l'heure et l'appât actuels. */
  connect(fishing: FishingController, world: () => WorldState): void {
    this.world = world;
    fishing.events.on('cast', () => this.change(() => this.stats.recordCast()));
    fishing.events.on('catch', ({ roll, result }) =>
      this.change(() => {
        this.stats.recordCatch(roll.species.id, roll.sizeCm);
        this.progression.recordCatch(roll, result);
      }),
    );
    fishing.events.on('escape', ({ reason }) => this.change(() => this.stats.recordEscape(reason)));
    fishing.events.on('bait', () => this.store.request());
  }

  /** Temps de jeu et sauvegarde périodique (à appeler seulement quand le jeu n'est pas en pause). */
  update(dt: number): void {
    this.stats.addPlayTime(dt);
    this.autosaveTimer += dt;
    if (this.autosaveTimer < CONFIG.save.autosaveSeconds) return;
    this.autosaveTimer = 0;
    this.store.request();
  }

  /** Remplace les réglages (menu Réglages) et les sauvegarde. */
  updateSettings(settings: Settings): void {
    Object.assign(this.settings, settings);
    this.store.request();
  }

  setTutorialDone(done: boolean): void {
    this.tutorialDone = done;
    this.store.request();
  }

  /** Sauvegarde tout de suite (avant de changer de lieu). */
  saveNow(): void {
    this.store.request();
    this.store.flush();
  }

  /** Efface la sauvegarde (recharger la page ensuite). */
  reset(): void {
    this.store.reset();
  }

  private change(apply: () => void): void {
    apply();
    this.store.request();
  }

  private snapshot(): SaveSnapshot {
    return {
      journal: this.journal.toData(),
      stats: this.stats.toData(),
      progression: this.progression.toData(),
      tutorial: { done: this.tutorialDone },
      settings: { ...this.settings },
      world: this.world(),
    };
  }
}
