import { MathUtils, Scene, Vector2, Vector3, type Object3D, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { AudioManager } from '../audio/audioManager';
import { CONFIG } from '../config';
import { baitById } from '../data/baits';
import { WEATHERS } from '../data/weather';
import { FISH, fishOf, type Habitat } from '../data/fish';
import { DEFAULT_PLACE, placeById, type PlaceId } from '../data/places';
import { loadBobberModel } from '../fishing/bobber';
import { FishingController } from '../fishing/fishingController';
import { checkFishData } from '../fishing/fishSelector';
import { Ripples } from '../fishing/ripples';
import { Rod, findRodMount, loadRodModel, type RodModel } from '../fishing/rod';
import { Boat, type BoatControls } from '../scene/boat';
import { createBoatBounds } from '../scene/boatBounds';
import { loadBoatModel } from '../scene/boatModel';
import { CameraRig, createCamera } from '../scene/cameraRig';
import { currentBoosts } from '../progression/rendezvous';
import type { Pwa } from '../pwa/pwa';
import { Cat, loadCatModel } from '../scene/cat';
import { DayNight } from '../scene/dayNight';
import { Decor } from '../scene/decor';
import { DriftingLeaves } from '../scene/driftingLeaves';
import { Critters } from '../scene/critters';
import { FishPen } from '../scene/fishPen';
import { FishSigns } from '../scene/fishSigns';
import { WeatherEffects } from '../scene/weatherEffects';
import { WindSway } from '../scene/windSway';
import { HeightSampler } from '../scene/heightSampler';
import { Fireflies } from '../scene/fireflies';
import { Lantern } from '../scene/lantern';
import { createLevelHelpers } from '../scene/levelHelpers';
import { loadLevel, type LevelData } from '../scene/levelLoader';
import { Lighting } from '../scene/lighting';
import { createRenderer, fitToWindow, setResolution } from '../scene/renderer';
import { Sky } from '../scene/sky';
import { setWaterAmbience, setWaterFlow, setWaterTime, setWaterTint } from '../scene/water';
import { createWaterSurface } from '../scene/waterSurface';
import { CabinView, type CabinTab } from '../ui/cabinView';
import { CatBubble } from '../ui/catBubble';
import { FishThumbnails } from '../ui/fishThumbnails';
import { FishingHud } from '../ui/fishingHud';
import type { Hud } from '../ui/hud';
import { JournalView } from '../ui/journalView';
import { Menus } from '../ui/menus';
import { PenViewHud } from '../ui/penViewHud';
import { ProgressionHud } from '../ui/progressionHud';
import { TEXTS } from '../ui/texts';
import { TouchStick } from '../ui/touchStick';
import { Tutorial } from '../ui/tutorial';
import { keysFor, setCustomBindings } from './controls';
import { GameClock, type TimeSlot } from './gameClock';
import { GameLoop } from './gameLoop';
import { Input } from './input';
import { Progress } from './progress';
import type { Settings } from './settings';
import { StateMachine, type TransitionTable } from './stateMachine';
import { rememberArrival, takeArrival } from './travel';
import { Weather } from './weather';

/** Assets chargés (ou remplacés par leurs placeholders) avant le démarrage. */
interface LoadedAssets {
  readonly level: LevelData;
  readonly boatModel: Object3D;
  readonly rodModel: RodModel;
  readonly bobberModel: Object3D;
  readonly catModel: Object3D;
  /** Lieu de pêche chargé, et la partie relue (qui disait où l'on était). */
  readonly place: PlaceId;
  readonly progress: Progress;
  readonly audio: AudioManager;
  readonly pwa: Pwa;
}

/** États du jeu : le monde n'avance que dans `playing`. */
type GameState = 'title' | 'playing' | 'paused' | 'journal' | 'cabin' | 'pen';
/** Panneaux qui mettent le jeu en pause : le carnet et le ponton de Moustache. */
type OverlayState = 'journal' | 'cabin';

const GAME_TRANSITIONS: TransitionTable<GameState> = {
  title: ['playing'],
  playing: ['paused', 'journal', 'cabin'],
  paused: ['playing', 'journal', 'cabin'],
  journal: ['playing', 'paused'],
  cabin: ['playing', 'paused', 'pen'],
  /** Vue rapprochée du vivier, ouverte depuis le ponton (et qui y ramène). */
  pen: ['cabin'],
};

const _bubble = new Vector3();

/**
 * Assemble la scène (niveau, eau, barque, caméra, ciel, lumière, Moustache),
 * la pêche, l'interface et la progression, puis fait tourner la boucle
 * principale. Une machine à états explicite gère titre → jeu ⇄ pause ⇄
 * carnet / ponton de Moustache.
 */
export class Game {
  readonly level: LevelData;
  readonly progress: Progress;
  /** Lieu de pêche de ce niveau. */
  readonly place: PlaceId;
  /** Temps qu'il fait (tests en console : `game.weather.set('rain')`). */
  readonly weather: Weather;
  /** Le jeu comme application : installation, mise à jour, hors connexion. */
  readonly pwa: Pwa;
  private readonly weatherEffects: WeatherEffects;
  private readonly fishSigns: FishSigns;
  private readonly windSway: WindSway;
  private readonly critters: Critters;
  private readonly fsm = new StateMachine<GameState>('jeu', 'title', GAME_TRANSITIONS);
  private readonly scene = new Scene();
  private readonly clock = new GameClock();
  private readonly dayNight = new DayNight();
  private readonly fireflies = new Fireflies();
  private readonly wake = new Ripples();
  private readonly hud: Hud;
  private readonly audio: AudioManager;
  private readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly input: Input;
  private readonly sky: Sky;
  private readonly lighting: Lighting;
  private readonly boat: Boat;
  private readonly lantern: Lantern;
  private readonly rig: CameraRig;
  private readonly fishing: FishingController;
  private readonly fishingHud: FishingHud;
  private readonly stick: TouchStick;
  private readonly journalView: JournalView;
  private readonly cabinView: CabinView;
  private readonly progressionHud: ProgressionHud;
  private readonly cat: Cat | null;
  private readonly catBubble: CatBubble;
  private readonly fishPen: FishPen | null;
  private readonly penViewHud: PenViewHud;
  private readonly tutorial: Tutorial;
  private readonly menus: Menus;
  private readonly levelHelpers: Object3D;
  private readonly loop = new GameLoop((dt, elapsed) => this.update(dt, elapsed));
  /** Où revenir en fermant le carnet ou le ponton. */
  private overlayReturn: 'playing' | 'paused' = 'playing';
  private wakeTimer = 0;
  /** Créneau de la frame précédente (annonce de la nuit de pleine lune). */
  private lastSlot: TimeSlot | null = null;
  private dayAnnounced = false;
  /** Lieu vers lequel on part (sauvegardé juste avant de recharger la page). */
  private destination: PlaceId | null = null;
  /** Feuilles qui dérivent, seulement sur une eau qui coule. */
  private readonly leaves: DriftingLeaves | null;

  /** Charge les assets (ou leurs placeholders) en parallèle, puis assemble le jeu. */
  static async create(container: HTMLElement, hud: Hud, pwa: Pwa): Promise<Game> {
    checkFishData();
    const progress = new Progress();
    const place = progress.saved?.world.place ?? DEFAULT_PLACE;
    hud.setLoadingText(TEXTS.places.loading(placeById(place).of));
    const audio = new AudioManager();
    const [level, boatModel, rodModel, bobberModel, catModel] = await Promise.all([
      loadLevel(placeById(place).level),
      loadBoatModel(),
      loadRodModel(),
      loadBobberModel(),
      loadCatModel(),
      audio.load(),
    ]);
    return new Game(container, hud, { level, boatModel, rodModel, bobberModel, catModel, audio, place, progress, pwa });
  }

  private constructor(container: HTMLElement, hud: Hud, assets: LoadedAssets) {
    const { level } = assets;
    this.progress = assets.progress;
    this.place = assets.place;
    this.pwa = assets.pwa;
    this.weather = Weather.fromData(assets.progress.saved?.world.weather);
    this.level = level;
    this.hud = hud;
    this.audio = assets.audio;
    this.renderer = createRenderer(container);
    this.camera = createCamera();
    fitToWindow(this.renderer, this.camera);
    this.input = new Input(this.renderer.domElement);
    this.sky = new Sky(this.scene);
    this.lighting = new Lighting(this.scene);
    this.boat = new Boat(assets.boatModel, createBoatBounds(level), level.water.level);
    this.boat.placeAt(level.spawn);
    this.lantern = new Lantern(assets.boatModel);
    const ground = new HeightSampler([level.root]);
    this.rig = new CameraRig(this.camera, level.cameraOffset, level.water.level, (x, z, y) => ground.groundAt(x, z, y));
    this.rig.snap(this.boat);
    this.levelHelpers = createLevelHelpers(level);
    this.scene.add(level.root, createWaterSurface(level, ground), this.boat.root, this.levelHelpers, this.fireflies.points, this.wake.group);
    this.leaves = this.createFlow(level);
    this.weatherEffects = new WeatherEffects(level);
    this.fishSigns = new FishSigns(level, (volume) => this.audio.play('splash', 0.3, volume * CONFIG.signs.splashVolume));
    this.windSway = new WindSway(level);
    const sea = placeById(this.place).sea;
    this.critters = new Critters(level, sea?.birdColor);
    this.applySeaLook();
    this.scene.add(this.weatherEffects.group, this.fishSigns.group, this.critters.group);
    this.cat = level.cat ? new Cat(assets.catModel, level.cat) : null;
    if (this.cat) this.scene.add(this.cat.root);
    this.fishingHud = new FishingHud(hud.layer, {
      onSelectBait: (bait) => this.fishing.selectBait(bait),
      onOpenCabin: () => this.openOverlay('cabin'),
      onOpenJournal: () => this.openOverlay('journal'),
      onOpenMenu: () => this.pause(),
    });
    this.fishing = this.createFishing(assets);
    this.stick = new TouchStick(hud.layer);
    this.progressionHud = this.createProgressionHud(assets);
    const thumbnails = new FishThumbnails(this.renderer);
    this.journalView = new JournalView(hud.layer, {
      journal: this.progress.journal,
      stats: this.progress.stats,
      thumbnails,
      shells: () => this.progress.progression.shells,
      place: this.place,
    });
    this.fishPen = this.createFishPen();
    this.cabinView = new CabinView(hud.layer, {
      progression: this.progress.progression,
      journal: this.progress.journal,
      thumbnails,
      hasPen: this.fishPen !== null,
      onBuy: (item) => this.progressionHud.buy(item),
      onEquip: (item) => this.progressionHud.equip(item),
      onRelease: (fish) => this.progressionHud.release(fish),
      onViewPen: () => this.viewPen(),
      place: this.place,
      onTravel: (place) => this.travel(place),
    });
    this.catBubble = new CatBubble(hud.layer, () => this.openOverlay('cabin'));
    this.penViewHud = new PenViewHud(hud.layer, () => this.leavePenView());
    this.tutorial = new Tutorial(hud.layer, this.fishing.events, () => this.progress.setTutorialDone(true));
    this.menus = this.createMenus();
    this.pwa.events.on('change', () => this.menus.refresh());
    this.pwa.events.on('offlineReady', () => this.hud.toast(TEXTS.pwa.offlineReady));
    this.restoreProgress();
    this.applySettings(this.progress.settings);
    this.arrive();
  }

  /** Après un voyage, on arrive directement sur l'eau ; sinon, écran titre. */
  private arrive(): void {
    if (takeArrival() !== this.place) return this.showTitle();
    this.play();
    this.hud.toast(TEXTS.places.welcome(placeById(this.place).at));
  }

  /** Courant d'une rivière : il emporte les vagues, des feuilles dérivent, et l'eau vive s'entend. */
  private createFlow(level: LevelData): DriftingLeaves | null {
    setWaterFlow(level.flow);
    if (level.flow.lengthSq() === 0) return null;
    this.audio.setRiver(CONFIG.audio.ambience.riverVolume);
    const leaves = new DriftingLeaves(level);
    this.scene.add(leaves.mesh);
    return leaves;
  }

  /** Au bord de la mer : eau turquoise, houle et ressac (rien au lac ni à la rivière). */
  private applySeaLook(): void {
    const sea = placeById(this.place).sea;
    setWaterTint(sea?.waterTint ?? 0xffffff, sea?.tintMix ?? 0);
    this.weatherEffects.setBaseWaves(sea?.waves ?? 1);
    this.audio.setSea(sea ? CONFIG.audio.ambience.seaVolume : 0);
  }

  /** Part pêcher ailleurs : la partie est sauvegardée avec le nouveau lieu, puis la page recharge l'autre niveau. */
  private travel(place: PlaceId): void {
    if (place === this.place || this.destination) return;
    this.destination = place;
    this.progress.saveNow();
    rememberArrival(place);
    this.cabinView.close();
    this.hud.showTravel(TEXTS.places.travel(placeById(place).name));
    window.setTimeout(() => location.reload(), CONFIG.travelDelayMs);
  }

  start(): void {
    this.loop.start();
  }

  /** Efface la sauvegarde et recharge la page (menu Réglages, ou `game.resetSave()` en console). */
  resetSave(): void {
    this.progress.reset();
    location.reload();
  }

  /** Tests en console : Moustache renouvelle ses demandes comme si un jour était passé. */
  newRequestsDay(): void {
    this.progressionHud.forceNewDay();
  }

  private createFishing(assets: LoadedAssets): FishingController {
    return new FishingController({
      scene: this.scene,
      camera: this.camera,
      input: this.input,
      boat: this.boat,
      level: assets.level,
      rod: new Rod(assets.rodModel, findRodMount(assets.boatModel)),
      bobberModel: assets.bobberModel,
      clock: this.clock,
      audio: assets.audio,
      journal: this.progress.journal,
      hud: this.hud,
      fishingHud: this.fishingHud,
      place: this.place,
      gear: () => this.progress.progression.gear,
      boosts: () => currentBoosts(this.progress.progression.dailyFish, this.isFullMoonNight),
      weather: () => this.weather.id,
      hotspots: this.fishSigns,
    });
  }

  /** Vivier du décor (Empty `fish_pen`), rempli avec les poissons gardés. */
  private createFishPen(): FishPen | null {
    if (!this.level.pen) return null;
    const pen = new FishPen(this.level.pen);
    const { progression } = this.progress;
    void pen.setFish(progression.keptFish);
    progression.events.on('pen', ({ kept }) => void pen.setFish(kept));
    this.scene.add(pen.group);
    return pen;
  }

  private get isFullMoonNight(): boolean {
    return this.clock.isFullMoon && this.clock.slot === 'night';
  }

  /** Coquillages, demandes, boutique et décoration reliés à l'interface. */
  private createProgressionHud(assets: LoadedAssets): ProgressionHud {
    const habitats: Habitat[] = ['open', ...new Set(this.level.zones.map((zone) => zone.type))];
    return new ProgressionHud({
      progression: this.progress.progression,
      journal: this.progress.journal,
      hud: this.hud,
      fishingHud: this.fishingHud,
      decor: new Decor(assets.boatModel, assets.bobberModel, this.lantern),
      place: this.place,
      habitats,
    });
  }

  private createMenus(): Menus {
    const actions = {
      onPlay: () => this.play(),
      onResume: () => this.resume(),
      onOpenJournal: () => this.openOverlay('journal'),
      onOpenCabin: () => this.openOverlay('cabin'),
      onOpenMap: () => this.openOverlay('cabin', 'map'),
      onSettingsChange: (settings: Settings) => this.changeSettings(settings),
      onResetProgress: () => this.resetSave(),
      onReplayTutorial: () => this.replayTutorial(),
      onInstall: () => void this.pwa.install(),
      onUpdate: () => this.applyUpdate(),
    };
    return new Menus(this.hud.layer, actions, () => this.progress.settings, () => this.pwa);
  }

  /** Nouvelle version du jeu : la partie est sauvegardée, puis la page se recharge sur la nouvelle version. */
  private applyUpdate(): void {
    this.progress.saveNow();
    this.pwa.applyUpdate();
  }

  /** Reprend l'heure et l'appât de la dernière partie, puis branche la sauvegarde. */
  private restoreProgress(): void {
    const { saved } = this.progress;
    if (saved) {
      this.clock.setTime(saved.world.day, saved.world.hour);
      const bait = baitById(saved.world.baitId ?? '');
      if (bait && this.progress.progression.shop.hasBait(bait.id)) this.fishing.selectBait(bait);
    }
    this.progress.connect(this.fishing, () => ({
      place: this.destination ?? this.place,
      day: this.clock.day,
      hour: this.clock.hour,
      baitId: this.fishing.currentBait.id,
      weather: this.weather.toData(),
    }));
  }

  private changeSettings(settings: Settings): void {
    this.progress.updateSettings(settings);
    this.applySettings(settings);
  }

  private applySettings(settings: Settings): void {
    this.audio.setVolumes({
      master: settings.masterVolume,
      sfx: settings.sfxVolume,
      ambience: settings.ambienceVolume,
      music: settings.musicVolume,
    });
    this.lighting.sun.castShadow = settings.shadows;
    setResolution(this.renderer, settings.resolution);
    this.fishing.setShowBiteAlert(settings.showBiteAlert);
    this.hud.setHintsVisible(settings.showHints);
    this.clock.setDayLength(settings.dayLengthMinutes);
    this.applyComfort(settings);
  }

  /** Confort et accessibilité : texte, animations, ferrage, bouchon, joystick, touches. */
  private applyComfort(settings: Settings): void {
    const { textScale, reducedMotion, easyHookFactor, bigBobberFactor } = CONFIG.comfort;
    const root = document.documentElement;
    root.style.setProperty('--text-scale', String(textScale[settings.textSize]));
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    const motion = settings.reduceMotion ? reducedMotion : 1;
    this.boat.setMotionScale(motion);
    this.weatherEffects.setMotionScale(motion);
    this.windSway.setMotionScale(motion);
    this.fishing.setComfort(settings.easyHook ? easyHookFactor : 1, settings.bigBobber ? bigBobberFactor : 1);
    this.stick.setSensitivity(settings.stickSensitivity);
    setCustomBindings(settings.keyBindings);
    this.fishingHud.refreshKeyHints();
    this.fishing.refreshPrompt();
    this.tutorial.refresh();
  }

  // --- États du jeu --------------------------------------------------------

  /** Écran titre : « Continuer » et un résumé seulement si la partie a déjà commencé. */
  private showTitle(): void {
    const { journal, stats } = this.progress;
    const started = stats.data.casts > 0 || journal.totalCatches > 0;
    const progress = started ? TEXTS.menu.progress(journal.speciesCount, FISH.length, journal.totalCatches) : '';
    this.hud.setTitleMode(true);
    this.menus.showTitle(started, progress);
  }

  private play(): void {
    this.hud.setTitleMode(false);
    this.menus.hide();
    this.fsm.go('playing');
    if (!this.dayAnnounced) this.progressionHud.announceDay();
    this.dayAnnounced = true;
    if (!this.progress.tutorialDone && !this.tutorial.isActive) this.tutorial.start();
  }

  /** Réglages (en pause) › « Revoir le tutoriel ». */
  private replayTutorial(): void {
    this.progress.setTutorialDone(false);
    this.resume();
    this.tutorial.start();
  }

  /** Pause, sauf pendant la charge d'un lancer ou la présentation d'une prise. */
  private pause(): void {
    if (this.fsm.state !== 'playing' || !this.fishing.canPause) return;
    this.fsm.go('paused');
    this.menus.showPause();
  }

  private resume(): void {
    this.menus.hide();
    this.fsm.go('playing');
  }

  /** Ouvre le carnet ou le ponton, depuis le jeu (si la pêche le permet) ou la pause. */
  private openOverlay(overlay: OverlayState, tab?: CabinTab): void {
    const from = this.fsm.state;
    if (from !== 'playing' && from !== 'paused') return;
    if (from === 'playing' && !this.fishing.canPause) return;
    this.overlayReturn = from;
    this.menus.hide();
    this.catBubble.hide();
    if (overlay === 'cabin') this.tutorial.notifyCabin();
    if (overlay === 'cabin') this.cabinView.open(tab);
    else this.journalView.open();
    this.fsm.go(overlay);
  }

  private closeOverlay(overlay: OverlayState): void {
    this.overlayView(overlay).close();
    this.fsm.go(this.overlayReturn);
    if (this.overlayReturn === 'paused') this.menus.showPause();
  }

  private overlayView(overlay: OverlayState): JournalView | CabinView {
    return overlay === 'journal' ? this.journalView : this.cabinView;
  }

  /** Depuis le ponton : la caméra va voir les poissons du vivier de près. */
  private viewPen(): void {
    if (!this.fishPen || this.fsm.state !== 'cabin') return;
    this.cabinView.close();
    this.fsm.go('pen');
    this.rig.setView(this.fishPen.view(this.level.water.footprint.bounds.getCenter(new Vector2())));
    this.hud.setViewMode(true);
    this.penViewHud.show(this.progress.progression.keptFish.length);
  }

  private leavePenView(): void {
    if (this.fsm.state !== 'pen') return;
    this.rig.setView(null);
    this.hud.setViewMode(false);
    this.penViewHud.hide();
    this.fsm.go('cabin');
    this.cabinView.open('pen');
  }

  // --- Boucle ---------------------------------------------------------------

  private update(dt: number, elapsed: number): void {
    this.handleShortcuts();
    // Le carnet et le ponton se ferment aussi par leur bouton ✕ ou un clic à côté
    const state = this.fsm.state;
    if ((state === 'journal' || state === 'cabin') && !this.overlayView(state).isOpen) this.closeOverlay(state);
    this.tutorial.setVisible(this.fsm.state === 'playing');
    if (this.fsm.state === 'playing') this.updateWorld(dt, elapsed);
    this.animate(dt, elapsed);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  /** Tout ce qui s'arrête en pause, dans le carnet ou sur l'écran titre. */
  private updateWorld(dt: number, elapsed: number): void {
    const hours = this.clock.update(dt);
    this.updateWeather(hours);
    this.progress.update(dt);
    this.boat.update(dt, this.readBoatControls());
    this.fishing.update(dt, elapsed);
    this.fishSigns.update(dt, elapsed, this.boat.position, this.boat.yaw);
    this.progressionHud.update(dt);
    this.tutorial.update(dt, { fishing: this.fishing.state, boat: this.boat.position });
    this.announceFullMoon();
    this.updateWake(dt, elapsed);
  }

  /** Le temps change au fil des heures ; on l'annonce. */
  private updateWeather(hours: number): void {
    const changed = this.weather.update(hours, this.clock.hour);
    if (changed) this.hud.toast(WEATHERS[changed].arrival);
  }

  /** À la tombée de la nuit, si c'est la pleine lune. */
  private announceFullMoon(): void {
    const slot = this.clock.slot;
    if (slot === 'night' && this.lastSlot !== null && this.lastSlot !== 'night' && this.clock.isFullMoon) {
      const legendary = fishOf(this.place).find((species) => species.rarity === 'legendary');
      if (legendary) this.hud.toast(TEXTS.rendezvous.fullMoon(legendary.name));
    }
    this.lastSlot = slot;
  }

  /** Ce qui vit toujours : eau, flottaison, ciel et lumières, lucioles, caméra. */
  private animate(dt: number, elapsed: number): void {
    setWaterTime(elapsed);
    this.boat.animate(dt, elapsed);
    const night = this.applyAmbience();
    this.fireflies.update(elapsed, this.boat.position, this.level.water.level, night);
    this.rig.update(dt, this.boat, this.fishing.focusPoint);
    this.cat?.update(elapsed);
    this.fishPen?.update(dt, elapsed);
    this.leaves?.update(dt, elapsed, this.boat.position);
    this.weatherEffects.update(dt, elapsed, this.weather, this.camera.position, this.boat.position);
    this.windSway.update(elapsed, this.weather.intensity('wind'));
    const calmDay = (1 - night) * (1 - this.weather.intensity('rain')) * (1 - this.weather.intensity('mist'));
    this.critters.update(elapsed, calmDay);
    this.updateCatBubble();
    this.lighting.follow(this.boat.position);
    this.sky.follow(this.camera.position);
    this.fishingHud.setTime(this.clock.label, this.timeIcon());
    const weather = WEATHERS[this.weather.id];
    this.fishingHud.setWeather(weather.icon, weather.name);
  }

  /** Icône du moment de la journée ; la nuit, la phase de la lune. */
  private timeIcon(): string {
    const slot = this.clock.slot;
    if (slot !== 'night') return TEXTS.slots[slot].icon;
    const icons = TEXTS.rendezvous.moonIcons;
    return icons[Math.round(this.clock.moonPhase * icons.length) % icons.length];
  }

  /** Ciel, lumières, brouillard, eau, lanterne, bouchon et sons suivent l'heure ; retourne `night`. */
  private applyAmbience(): number {
    const ambience = this.dayNight.update(this.clock.hour);
    this.weatherEffects.tint(ambience, this.weather);
    const { night } = ambience.values;
    this.sky.setAmbience(ambience);
    this.sky.setMoonPhase(this.clock.moonPhase);
    this.sky.setCloudiness(this.weatherEffects.cloudiness(this.weather));
    this.audio.setWeather(this.weather.intensity('rain'), this.weather.intensity('wind'));
    this.lighting.setAmbience(ambience);
    setWaterAmbience(ambience);
    this.lantern.setNight(night);
    this.fishing.setNight(night);
    this.audio.setNight(night);
    return night;
  }

  /** « ! » au-dessus de Moustache quand il a de nouvelles demandes (seulement en jeu, s'il est à l'écran). */
  private updateCatBubble(): void {
    const unseen = this.progress.progression.requests.unseen;
    if (!this.cat || !unseen || this.fsm.state !== 'playing') return this.catBubble.hide();
    this.cat.bubbleAnchor(_bubble).project(this.camera);
    const onScreen = _bubble.z < 1 && Math.abs(_bubble.x) < 1 && Math.abs(_bubble.y) < 1;
    if (!onScreen) return this.catBubble.hide();
    // Toujours entière à l'écran, même quand Moustache est au bord
    const margin = CONFIG.cat.bubbleMargin;
    const x = MathUtils.clamp((_bubble.x * 0.5 + 0.5) * window.innerWidth, margin, window.innerWidth - margin);
    const y = MathUtils.clamp((-_bubble.y * 0.5 + 0.5) * window.innerHeight, margin * 2, window.innerHeight);
    this.catBubble.show(x, y);
  }

  /** Quand la barque avance, elle laisse des ronds derrière elle. */
  private updateWake(dt: number, elapsed: number): void {
    const { minSpeed, interval } = CONFIG.wake;
    this.wake.update(dt, elapsed);
    this.wakeTimer -= dt;
    const speed = this.boat.speed;
    if (Math.abs(speed) < minSpeed || this.wakeTimer > 0) return;
    this.wakeTimer = interval;
    const behind = -Math.sign(speed) * 1.4;
    const { x, z } = this.boat.position;
    const yaw = this.boat.yaw;
    this.wake.spawn(x + Math.sin(yaw) * behind, this.level.water.level, z + Math.cos(yaw) * behind, 1.3, 1.8, 0.28);
  }

  /** Clavier et joystick tactile ; la barque reste immobile tant que la ligne n'est pas au repos. */
  private readBoatControls(): BoatControls {
    const busy = this.fishing.isBusy;
    this.stick.setAvailable(!busy);
    if (busy) return { throttle: 0, turn: 0 };
    const stick = this.stick.value;
    return {
      throttle: MathUtils.clamp(this.input.axis(keysFor('backward'), keysFor('forward')) + stick.y, -1, 1),
      turn: MathUtils.clamp(this.input.axis(keysFor('left'), keysFor('right')) + stick.x, -1, 1),
    };
  }

  // --- Raccourcis clavier ----------------------------------------------------

  private handleShortcuts(): void {
    const { controls } = CONFIG;
    const input = this.input;
    switch (this.fsm.state) {
      case 'title':
        if (this.menus.current === 'settings' && input.wasPressed(controls.cancel)) this.menus.back();
        else if (this.menus.current === 'title' && input.wasPressed(controls.confirm)) this.play();
        return;
      case 'journal':
        if (input.wasPressed(keysFor('journal')) || input.wasPressed(controls.cancel)) this.closeOverlay('journal');
        return;
      case 'cabin':
        if (input.wasPressed(keysFor('cabin')) || input.wasPressed(controls.cancel)) this.closeOverlay('cabin');
        return;
      case 'pen':
        if (input.wasPressed(controls.cancel) || input.wasPointerPressed) this.leavePenView();
        return;
      case 'paused':
        if (!input.wasPressed(controls.cancel)) return;
        if (this.menus.current === 'settings') this.menus.back();
        else this.resume();
        return;
      case 'playing':
        this.handlePlayingShortcuts();
    }
  }

  private handlePlayingShortcuts(): void {
    const { controls, debug } = CONFIG;
    const input = this.input;
    if (input.wasPressed(keysFor('journal'))) return this.openOverlay('journal');
    if (input.wasPressed(keysFor('cabin'))) return this.openOverlay('cabin');
    if (input.wasPressed(keysFor('keep'))) this.fishingHud.catchPopup.keep();
    // Pendant la charge d'un lancer, Échap l'annule (géré par la pêche) au lieu d'ouvrir la pause
    if (input.wasPressed(controls.cancel) && this.fishing.canPause) return this.pause();
    if (input.wasPressed(controls.toggleLevelHelpers)) this.levelHelpers.visible = !this.levelHelpers.visible;
    if (input.wasPressed(debug.timeSkip)) this.clock.advance(debug.timeSkipHours);
    const baits = this.progress.progression.baits;
    controls.baits.forEach((keys, index) => {
      const bait = baits[index];
      if (bait && input.wasPressed(keys)) this.fishing.selectBait(bait);
    });
  }
}
