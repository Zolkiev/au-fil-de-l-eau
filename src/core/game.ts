import { MathUtils, Scene, Vector2, Vector3, type Object3D, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { AudioManager } from '../audio/audioManager';
import { CONFIG } from '../config';
import { baitById } from '../data/baits';
import { WEATHERS } from '../data/weather';
import { FISH, fishOf, type Habitat } from '../data/fish';
import { DEFAULT_PLACE, placeById, type PlaceId } from '../data/places';
import { lookSlot, type LookSlot, type ShopItem } from '../data/shop';
import { loadBobberModel } from '../fishing/bobber';
import { FishingController } from '../fishing/fishingController';
import { checkFishData } from '../fishing/fishSelector';
import { isTouchMode } from './pointerMode';
import { autoStartLevel, FpsMeter, QualityGovernor, type QualityLevel, type QualitySetting } from './quality';
import { Ripples } from '../fishing/ripples';
import { Rod, findRodMount, loadRodModel, type RodModel } from '../fishing/rod';
import { Boat, type BoatControls } from '../scene/boat';
import { createBoatBounds } from '../scene/boatBounds';
import { loadBoatModel } from '../scene/boatModel';
import { CameraRig, createCamera, type CameraView } from '../scene/cameraRig';
import { currentBoosts } from '../progression/rendezvous';
import type { Pwa } from '../pwa/pwa';
import { Cat, loadCatModel } from '../scene/cat';
import { Clouds } from '../scene/clouds';
import { Fisher, loadFisherModel, type FisherPose } from '../scene/fisher';
import { Oars } from '../scene/oars';
import { NightLights } from '../scene/nightLights';
import { DayNight } from '../scene/dayNight';
import { Decor } from '../scene/decor';
import { DriftingLeaves } from '../scene/driftingLeaves';
import { Critters } from '../scene/critters';
import { FishPen } from '../scene/fishPen';
import { FishSigns } from '../scene/fishSigns';
import { Flotsam } from '../scene/flotsam';
import { WeatherEffects } from '../scene/weatherEffects';
import { WindSway } from '../scene/windSway';
import { HeightSampler } from '../scene/heightSampler';
import { Fireflies } from '../scene/fireflies';
import { Lantern } from '../scene/lantern';
import { LevelEffects } from '../scene/levelEffects';
import { createLevelHelpers } from '../scene/levelHelpers';
import { loadLevel, type FindSpot, type LevelData } from '../scene/levelLoader';
import { Lighting } from '../scene/lighting';
import { createRenderer, fitToWindow, setPixelRatioCap } from '../scene/renderer';
import { Sky } from '../scene/sky';
import { setWaterAmbience, setWaterFlow, setWaterTime, setWaterTint } from '../scene/water';
import { WaterLife } from '../scene/waterLife';
import { createWaterSurface } from '../scene/waterSurface';
import { CabinView, type CabinTab } from '../ui/cabinView';
import { CatBubble } from '../ui/catBubble';
import { featText } from '../ui/featText';
import { FishThumbnails } from '../ui/fishThumbnails';
import { FittingHud, type FittingAction } from '../ui/fittingHud';
import { FishingHud } from '../ui/fishingHud';
import type { Hud } from '../ui/hud';
import { JournalView } from '../ui/journalView';
import { LookThumbnails } from '../ui/lookThumbnails';
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
import { saveLanguage, type Language } from './language';
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
  readonly fisherModel: Object3D;
  /** Lieu de pêche chargé, et la partie relue (qui disait où l'on était). */
  readonly place: PlaceId;
  readonly progress: Progress;
  readonly audio: AudioManager;
  readonly pwa: Pwa;
}

/** États du jeu : le monde n'avance que dans `playing`. */
type GameState = 'title' | 'playing' | 'paused' | 'journal' | 'cabin' | 'pen' | 'fitting';
/** Panneaux qui mettent le jeu en pause : le carnet et le ponton de Moustache. */
type OverlayState = 'journal' | 'cabin';

const GAME_TRANSITIONS: TransitionTable<GameState> = {
  title: ['playing'],
  playing: ['paused', 'journal', 'cabin'],
  paused: ['playing', 'journal', 'cabin'],
  journal: ['playing', 'paused'],
  cabin: ['playing', 'paused', 'pen', 'fitting'],
  /** Vue rapprochée du vivier, ouverte depuis le ponton (et qui y ramène). */
  pen: ['cabin'],
  /** Essai d'un objet de la boutique : la caméra tourne autour de la barque, puis retour au ponton. */
  fitting: ['cabin'],
};

/** Emplacements portés par le pêcheur : leur essai se regarde de près. */
const WORN_SLOTS: readonly LookSlot[] = ['hat', 'hatShape', 'coat', 'scarf'];

/** Essai en cours : l'objet, le cadrage, et le tour déjà fait par la caméra (rad). */
interface Fitting {
  readonly item: ShopItem;
  readonly close: boolean;
  angle: number;
}

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
  private readonly clouds = new Clouds();
  private readonly nightLights: NightLights;
  /** Fumée, feux de camp, embruns et éclaboussures. */
  private readonly effects: LevelEffects;
  /** Trouvailles qui flottent dans les recoins du niveau. */
  private readonly flotsam: Flotsam;
  /** Nénuphars, grenouilles, canards, héron, ombres de poissons. */
  private readonly waterLife: WaterLife;
  private readonly rod: Rod;
  private readonly oars: Oars;
  private readonly fisher: Fisher;
  /** Cibles des mains du pêcheur (réutilisées d'une image à l'autre) et tour de manivelle du moulinet. */
  private readonly leftHand = new Vector3();
  private readonly rightHand = new Vector3();
  private crankTurn = 0;
  /** Qualité graphique : régulateur du mode automatique, compteur d'images, choix appliqué. */
  private readonly governor = new QualityGovernor((level) => this.onQualityLowered(level));
  private readonly fpsMeter = new FpsMeter();
  private qualitySetting: QualitySetting | null = null;
  private showFps = false;
  private readonly fsm = new StateMachine<GameState>('jeu', 'title', GAME_TRANSITIONS);
  private readonly scene = new Scene();
  private readonly clock = new GameClock();
  private readonly dayNight = new DayNight();
  private readonly fireflies = new Fireflies();
  private readonly wake = new Ripples(20);
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
  private readonly fittingHud: FittingHud;
  private fitting: Fitting | null = null;
  private readonly fittingView: CameraView = { position: new Vector3(), target: new Vector3(), aboveGround: true };
  private readonly tutorial: Tutorial;
  private readonly menus: Menus;
  private readonly levelHelpers: Object3D;
  private readonly loop = new GameLoop((dt, elapsed) => this.update(dt, elapsed));
  /** Où revenir en fermant le carnet ou le ponton. */
  private overlayReturn: 'playing' | 'paused' = 'playing';
  /** Distance parcourue depuis le dernier rond du sillage (m). */
  private wakeTravel = 0;
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
    const [level, boatModel, rodModel, bobberModel, catModel, fisherModel] = await Promise.all([
      loadLevel(placeById(place).level),
      loadBoatModel(),
      loadRodModel(),
      loadBobberModel(),
      loadCatModel(),
      loadFisherModel(),
      audio.load(),
    ]);
    return new Game(container, hud, { level, boatModel, rodModel, bobberModel, catModel, fisherModel, audio, place, progress, pwa });
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
    this.fishSigns = new FishSigns(level, (volume, x, z) => this.fishSplash(volume, x, z));
    this.windSway = new WindSway(level);
    const sea = placeById(this.place).sea;
    this.critters = new Critters(level, sea?.birdColor);
    this.applySeaLook();
    this.nightLights = new NightLights(level);
    this.effects = new LevelEffects(level, this.nightLights);
    this.flotsam = new Flotsam(level, (spot) => this.pickFind(spot));
    this.scene.add(this.weatherEffects.group, this.fishSigns.group, this.critters.group, this.clouds.group, this.nightLights.group, this.effects.group);
    this.waterLife = new WaterLife(level, ground, sea !== undefined, {
      splash: (x, z, strength) => this.effects.splash(x, z, strength),
      play: (sound, volume) => this.audio.play(sound, 0.12, volume),
    });
    this.scene.add(this.flotsam.group, this.waterLife.group);
    this.cat = level.cat ? new Cat(assets.catModel, level.cat) : null;
    if (this.cat) this.scene.add(this.cat.root);
    this.fishingHud = new FishingHud(hud.layer, {
      onSelectBait: (bait) => this.fishing.selectBait(bait),
      onOpenCabin: () => this.openOverlay('cabin'),
      onOpenJournal: () => this.openOverlay('journal'),
      onOpenMenu: () => this.pause(),
    });
    this.rod = new Rod(assets.rodModel, findRodMount(assets.boatModel));
    this.oars = new Oars(assets.boatModel, (blade) => this.oarSplash(blade));
    this.fisher = new Fisher(assets.fisherModel, assets.boatModel);
    this.fishing = this.createFishing(assets);
    this.stick = new TouchStick(hud.layer);
    this.progressionHud = this.createProgressionHud(assets);
    this.showFinds();
    this.progress.progression.events.on('finds', () => this.showFinds());
    const thumbnails = new FishThumbnails(this.renderer);
    this.journalView = new JournalView(hud.layer, {
      journal: this.progress.journal,
      stats: this.progress.stats,
      thumbnails,
      shells: () => this.progress.progression.shells,
      trails: this.progress.progression.trails,
      fishingDays: () => this.progress.progression.logbook.count,
      place: this.place,
    });
    this.fishPen = this.createFishPen();
    this.cabinView = new CabinView(hud.layer, {
      progression: this.progress.progression,
      journal: this.progress.journal,
      thumbnails,
      lookThumbnails: new LookThumbnails(this.renderer, assets.boatModel, assets.fisherModel),
      hasPen: this.fishPen !== null,
      onBuy: (item) => this.progressionHud.buy(item),
      onEquip: (item) => this.progressionHud.equip(item),
      onTry: (item) => this.tryOn(item),
      onRelease: (fish) => this.progressionHud.release(fish),
      onViewPen: () => this.viewPen(),
      place: this.place,
      onTravel: (place) => this.travel(place),
      findSpots: this.findSpots,
    });
    this.catBubble = new CatBubble(hud.layer, () => this.openOverlay('cabin'));
    this.penViewHud = new PenViewHud(hud.layer, () => this.leavePenView());
    this.fittingHud = new FittingHud(hud.layer, () => this.confirmFitting(), () => this.leaveFitting());
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
      rod: this.rod,
      bobberModel: assets.bobberModel,
      clock: this.clock,
      audio: assets.audio,
      journal: this.progress.journal,
      hud: this.hud,
      fishingHud: this.fishingHud,
      place: this.place,
      gear: () => this.progress.progression.gear,
      boosts: () => currentBoosts(this.progress.progression.dailyFish, this.isFullMoonNight, this.progress.progression.boosts),
      weather: () => this.weather.id,
      hotspots: this.fishSigns,
      splash: (x, z, strength) => this.effects.splash(x, z, strength),
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

  /** Numéros des coins à trouvailles de ce niveau. */
  private get findSpots(): number[] {
    return this.level.finds.map((spot) => spot.index);
  }

  /** Fait flotter les trouvailles du jour qui n'ont pas encore été repêchées. */
  private showFinds(): void {
    this.flotsam.setActive(this.progress.progression.finds.activeSpots(this.place, this.findSpots));
  }

  /** La barque passe sur une trouvaille : elle part dans la barque, en attendant de la montrer à Moustache. */
  private pickFind(spot: FindSpot): void {
    if (!this.progressionHud.pickFind(spot)) return;
    this.effects.splash(spot.position.x, spot.position.z, 0.7);
    this.audio.play('pickup', 0.03);
  }

  /** Crépuscule ou nuit : l'heure des grenouilles. */
  private get isEvening(): boolean {
    return this.clock.slot === 'dusk' || this.clock.slot === 'night';
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
      decor: new Decor(assets.boatModel, assets.bobberModel, this.lantern, assets.fisherModel),
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
      onLanguageChange: (language: Language) => this.changeLanguage(language),
      currentQuality: () => this.governor.current,
    };
    return new Menus(this.hud.layer, actions, () => this.progress.settings, () => this.pwa);
  }

  /** Autre langue choisie sur l'écran titre : elle est enregistrée, puis la page se recharge dans cette langue. */
  private changeLanguage(language: Language): void {
    saveLanguage(language);
    this.progress.saveNow();
    location.reload();
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
    this.applyQualitySetting(settings.quality);
    this.showFps = settings.showFps;
    if (!settings.showFps) this.hud.setFps(null);
    this.fishing.setShowBiteAlert(settings.showBiteAlert);
    this.hud.setHintsVisible(settings.showHints);
    this.clock.setDayLength(settings.dayLengthMinutes);
    this.applyComfort(settings);
  }

  /** Nouveau choix de qualité : niveau fixe, ou mode automatique (qui part d'un niveau selon l'appareil). */
  private applyQualitySetting(setting: QualitySetting): void {
    if (setting === this.qualitySetting) return;
    this.qualitySetting = setting;
    const level = setting === 'auto' ? autoStartLevel(isTouchMode()) : setting;
    this.governor.start(level, setting === 'auto');
    this.applyQuality(level);
  }

  /**
   * Applique un niveau de qualité (CONFIG.quality.presets) : finesse de
   * l'image, ombres (barque seule ou tout le décor), petite flore, lumières
   * de nuit, nuages, particules.
   */
  private applyQuality(level: QualityLevel): void {
    const preset = CONFIG.quality.presets[level];
    setPixelRatioCap(this.renderer, preset.pixelRatio);
    this.lighting.setShadowQuality(preset.shadows, preset.shadowMapSize);
    this.level.shadowCasters.forEach((mesh) => (mesh.castShadow = preset.shadows === 'full'));
    this.level.flora.forEach((object) => (object.visible = preset.flora));
    this.nightLights.setMaxLights(preset.nightLights);
    this.clouds.setDensity(preset.clouds);
    this.effects.setDensity(preset.effects);
  }

  /** Mode automatique : le jeu ramait, la qualité vient de baisser d'un cran. */
  private onQualityLowered(level: QualityLevel): void {
    this.applyQuality(level);
    this.hud.toast(TEXTS.settings.qualityLowered(TEXTS.settings.qualities[level]));
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

  /** Depuis la boutique : le ponton s'efface, et on voit l'objet sur la barque ou le pêcheur. */
  private tryOn(item: ShopItem): void {
    const slot = lookSlot(item);
    if (slot === null || this.fsm.state !== 'cabin') return;
    this.cabinView.suspend();
    this.fsm.go('fitting');
    this.fitting = { item, close: WORN_SLOTS.includes(slot), angle: 0 };
    this.progressionHud.preview(item);
    this.hud.setViewMode(true);
    this.fittingHud.show(item, this.fittingAction(item));
  }

  /** Ce que propose le bandeau de l'essai : acheter, utiliser, ou rappeler comment l'objet se gagne. */
  private fittingAction(item: ShopItem): FittingAction {
    const { progression } = this.progress;
    switch (progression.shop.status(item, progression.shells)) {
      case 'buyable':
        return { kind: 'buy', price: item.price, affordable: true };
      case 'tooExpensive':
        return { kind: 'buy', price: item.price, affordable: false };
      case 'equipable':
        return { kind: 'equip' };
      case 'feat':
        return { kind: 'none', note: item.feat ? `${TEXTS.feats.icon} ${featText(item.feat)}` : '' };
      default:
        return { kind: 'none', note: TEXTS.fitting.equipped };
    }
  }

  /** Bouton du bandeau : achète ou utilise l'objet essayé, puis retour à la boutique. */
  private confirmFitting(): void {
    if (!this.fitting) return;
    const { item } = this.fitting;
    const action = this.fittingAction(item);
    if (action.kind === 'buy') this.progressionHud.buy(item);
    if (action.kind === 'equip') this.progressionHud.equip(item);
    this.leaveFitting();
  }

  private leaveFitting(): void {
    if (this.fsm.state !== 'fitting') return;
    this.fitting = null;
    this.progressionHud.preview(null);
    this.rig.setView(null);
    this.hud.setViewMode(false);
    this.fittingHud.hide();
    this.fsm.go('cabin');
    this.cabinView.resume();
  }

  /** Pendant un essai, la caméra tourne lentement autour de la barque (ou reste de trois quarts avec « Moins d'animations »). */
  private orbitFitting(dt: number): void {
    const fitting = this.fitting;
    if (!fitting) return;
    const { orbitSeconds, startAngle, wide, close } = CONFIG.fitting;
    if (!this.progress.settings.reduceMotion) fitting.angle += (dt / orbitSeconds) * 2 * Math.PI;
    const frame = fitting.close ? close : wide;
    const angle = this.boat.yaw + startAngle + fitting.angle;
    const { position, target } = this.fittingView;
    if (fitting.close) this.fisher.root.getWorldPosition(target);
    else target.copy(this.boat.position);
    target.y = this.boat.position.y + frame.lookHeight;
    position.set(target.x + Math.sin(angle) * frame.distance, this.boat.position.y + frame.height, target.z + Math.cos(angle) * frame.distance);
    this.rig.setView(this.fittingView);
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
    this.measureFrame();
  }

  /** Fluidité : le mode automatique mesure, et le compteur s'affiche si on l'a demandé. */
  private measureFrame(): void {
    const now = performance.now();
    this.governor.frame(now);
    const fps = this.fpsMeter.frame(now);
    if (fps !== null && this.showFps) this.hud.setFps(TEXTS.settings.fps(fps, TEXTS.settings.qualities[this.governor.current]));
  }

  /** Tout ce qui s'arrête en pause, dans le carnet ou sur l'écran titre. */
  private updateWorld(dt: number, elapsed: number): void {
    const hours = this.clock.update(dt);
    this.updateWeather(hours);
    this.progress.update(dt);
    const controls = this.readBoatControls();
    this.boat.update(dt, controls);
    this.oars.update(dt, controls, this.fishing.isBusy);
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
    this.nightLights.update(dt, night, this.boat.position);
    this.effects.update(dt, elapsed, night, this.weather.intensity('wind'), this.boat.position);
    this.flotsam.update(dt, elapsed, this.boat.position, this.fsm.state === 'playing');
    this.waterLife.update(dt, elapsed, { boat: this.boat.position, boatYaw: this.boat.yaw, night, evening: this.isEvening ? 1 : 0 });
    this.fisher.update(dt, elapsed, this.fisherPose(dt));
    this.fireflies.update(elapsed, this.boat.position, this.level.water.level, night);
    this.orbitFitting(dt);
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
    this.clouds.update(dt, this.camera.position, this.weather.intensity('wind'), this.weatherEffects.cloudiness(this.weather));
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
    this.clouds.setAmbience(ambience);
    this.effects.setAmbience(ambience);
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

  /** « ! » au-dessus de Moustache quand il a de nouvelles demandes ou qu'on lui rapporte une trouvaille (seulement en jeu, s'il est à l'écran). */
  private updateCatBubble(): void {
    if (!this.cat || !this.progressionHud.catIsWaiting || this.fsm.state !== 'playing') return this.catBubble.hide();
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
  /**
   * Ce que fait le pêcheur : les mains sur les rames quand la ligne est au
   * repos, sur la canne sinon (la gauche tourne la manivelle quand on
   * mouline) ; il regarde son bouchon, et lève les bras à la prise.
   */
  private fisherPose(dt: number): FisherPose {
    const state = this.fishing.state;
    if (state === 'CAUGHT') return { left: null, right: null, lookAt: null, lean: 0, cheer: true };
    if (state === 'IDLE') {
      const left = this.oars.gripPosition('l', this.leftHand);
      const right = this.oars.gripPosition('r', this.rightHand);
      return { left, right, lookAt: null, lean: this.oars.stroke };
    }
    const winding = (state === 'REELING' && this.input.isPointerHeld) || state === 'ESCAPED';
    if (winding) this.crankTurn += dt * CONFIG.fisher.reelTurns * 2 * Math.PI;
    const right = this.rod.gripPosition(this.rightHand);
    // En attendant la touche, la main gauche se repose sur le genou
    const left = state === 'WAITING' ? null : this.rod.crankPosition(this.crankTurn, this.leftHand);
    return { left, right, lookAt: this.fishing.focusPoint, lean: 0 };
  }

  /** Une pelle entre dans l'eau : petit rond, quelques gouttes et plouf discret. */
  private oarSplash(blade: Vector3): void {
    this.wake.spawn(blade.x, this.level.water.level, blade.z, 0.35, 0.9, 0.45);
    this.effects.splash(blade.x, blade.z, 0.3);
    this.audio.play('splash', 0.2, CONFIG.oars.splashVolume);
  }

  /** Un poisson saute ou replonge : gouttes, et son plouf plus ou moins fort selon la distance. */
  private fishSplash(volume: number, x: number, z: number): void {
    this.effects.splash(x, z, 0.8);
    this.audio.play('splash', 0.3, volume * CONFIG.signs.splashVolume);
  }

  private updateWake(dt: number, elapsed: number): void {
    const { minSpeed, spacing } = CONFIG.wake;
    this.wake.update(dt, elapsed);
    const speed = this.boat.speed;
    // Un rond tous les `spacing` mètres : le sillage reste régulier, même en ramant fort
    this.wakeTravel += Math.abs(speed) * dt;
    if (Math.abs(speed) < minSpeed || this.wakeTravel < spacing) return;
    this.wakeTravel = 0;
    const behind = -Math.sign(speed) * 1.4;
    const { x, z } = this.boat.position;
    const yaw = this.boat.yaw;
    this.wake.spawn(x + Math.sin(yaw) * behind, this.level.water.level, z + Math.cos(yaw) * behind, 1.3, 1.8, 0.28);
    // En ramant fort, l'étrave soulève une petite gerbe
    if (speed > CONFIG.boat.maxForwardSpeed * CONFIG.effects.bowSprayFrom) this.effects.splash(x + Math.sin(yaw) * 1.5, z + Math.cos(yaw) * 1.5, 0.45);
  }

  /** Clavier et joystick tactile ; la barque reste immobile tant que la ligne n'est pas au repos. */
  private readBoatControls(): BoatControls {
    const busy = this.fishing.isBusy;
    this.stick.setAvailable(!busy);
    if (busy) return { throttle: 0, turn: 0, sprint: false };
    const stick = this.stick.value;
    return {
      throttle: MathUtils.clamp(this.input.axis(keysFor('backward'), keysFor('forward')) + stick.y, -1, 1),
      turn: MathUtils.clamp(this.input.axis(keysFor('left'), keysFor('right')) + stick.x, -1, 1),
      sprint: this.input.isHeld(keysFor('sprint')) || this.stick.sprint,
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
      case 'fitting':
        if (input.wasPressed(controls.cancel)) this.leaveFitting();
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
