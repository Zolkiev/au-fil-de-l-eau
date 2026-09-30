import type { Object3D, PerspectiveCamera, Scene } from 'three';
import type { AudioManager } from '../audio/audioManager';
import { CONFIG } from '../config';
import { Emitter } from '../core/events';
import type { GameClock } from '../core/gameClock';
import type { Input } from '../core/input';
import type { CatchResult, Journal } from '../core/journal';
import { keyHints } from '../core/controls';
import { isTouchMode, onTouchModeChange } from '../core/pointerMode';
import { StateMachine } from '../core/stateMachine';
import { BAITS, type Bait } from '../data/baits';
import type { PlaceId } from '../data/places';
import type { WeatherId } from '../data/weather';
import type { Boat } from '../scene/boat';
import type { LevelData, ZoneType } from '../scene/levelLoader';
import type { FishingHud } from '../ui/fishingHud';
import type { Hud } from '../ui/hud';
import { TEXTS } from '../ui/texts';
import { BiteTimer } from './biteTimer';
import { Bobber } from './bobber';
import { CastAim } from './castAim';
import { CatchShowcase } from './catchShowcase';
import { FishingLine } from './fishingLine';
import { FISHING_TRANSITIONS, type EscapeReason, type FishingState } from './fishingState';
import type { FishBoosts, FishRoll } from './fishSelector';
import type { HookedFish } from './hookedFish';
import { Ripples } from './ripples';
import type { HotspotQuery } from '../scene/fishSigns';
import type { Gear } from './reelFight';
import type { Rod } from './rod';

/** Tout ce dont la pêche a besoin, fourni par Game. */
export interface FishingDeps {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly input: Input;
  readonly boat: Boat;
  readonly level: LevelData;
  /** Lieu de pêche (pour le tirage des poissons). */
  readonly place: PlaceId;
  readonly rod: Rod;
  readonly bobberModel: Object3D;
  readonly clock: GameClock;
  readonly audio: AudioManager;
  readonly journal: Journal;
  readonly hud: Hud;
  readonly fishingHud: FishingHud;
  /** Matériel actuel du joueur (lu au ferrage). */
  readonly gear: () => Gear;
  /** Coups de pouce du moment : poisson du jour, pleine lune (lus au ferrage). */
  readonly boosts: () => FishBoosts;
  /** Temps qu'il fait (lu au lancer et au ferrage). */
  readonly weather: () => WeatherId;
  /** Coins où les poissons se montrent (sauts, bulles). */
  readonly hotspots: HotspotQuery;
}

/** Ce que la pêche annonce au reste du jeu (statistiques, sauvegarde…). */
export interface FishingEvents {
  cast: undefined;
  catch: { roll: FishRoll; result: CatchResult };
  escape: { reason: EscapeReason };
  bait: { bait: Bait };
}

/**
 * Tout ce que les phases de la pêche partagent : le matériel (bouchon, ligne,
 * ronds, visée, vitrine), la machine à états, la session en cours (appât,
 * zone, poisson ferré…) et quelques actions communes.
 */
export class FishingContext {
  readonly deps: FishingDeps;
  readonly fsm = new StateMachine<FishingState>('pêche', 'IDLE', FISHING_TRANSITIONS);
  readonly events = new Emitter<FishingEvents>();
  readonly bobber: Bobber;
  readonly line: FishingLine;
  readonly ripples = new Ripples();
  readonly aim: CastAim;
  readonly biteTimer = new BiteTimer();
  readonly showcase = new CatchShowcase();

  // --- Session en cours ---
  bait: Bait = BAITS[0];
  /** Type de la zone où le bouchon est tombé (null = eau libre). */
  zone: ZoneType | null = null;
  /** Le bouchon est tombé sur un coin où les poissons se montrent. */
  hotspot = false;
  /** Temps pour ferrer (s) : CONFIG.fishing.hookWindow, allongé par le réglage « Ferrage facile ». */
  hookWindow: number = CONFIG.fishing.hookWindow;
  /** Puissance du lancer en cours de charge (0 → 1). */
  power = 0;
  /** Cap visé pendant la charge (rad). */
  aimYaw = 0;
  /** Poisson au bout de la ligne, de la touche ferrée jusqu'à la fin de la présentation. */
  hooked: HookedFish | null = null;
  /** Temps de la boucle (s), pour les animations liées aux vagues. */
  elapsed = 0;
  showBiteAlert = true;
  private reelTickTimer = 0;

  constructor(deps: FishingDeps) {
    this.deps = deps;
    this.bobber = new Bobber(deps.bobberModel, deps.level.water.level);
    this.line = new FishingLine(deps.level.water.level);
    this.aim = new CastAim(deps.level);
    deps.scene.add(this.bobber.object, this.line.object, this.ripples.group, this.aim.marker);
    deps.scene.add(this.showcase.group, this.showcase.light);
    this.fsm.onChange((state) => this.updatePrompt(state));
    this.updatePrompt(this.fsm.state);
    onTouchModeChange(() => this.updatePrompt(this.fsm.state));
  }

  /** Rond dans l'eau sous le bouchon. */
  rippleAtBobber(radius: number, duration?: number, strength?: number): void {
    const { x, z } = this.bobber.position;
    this.ripples.spawn(x, this.deps.level.water.level, z, radius, duration, strength);
  }

  /** La ligne revient sans poisson, sans aucune pénalité. */
  escape(reason: EscapeReason): void {
    this.deps.fishingHud.hideBiteAlert();
    this.deps.hud.toast(TEXTS.escape[reason]);
    this.bobber.reelIn(CONFIG.fishing.retrieveSpeed);
    this.hooked = null;
    this.fsm.go('ESCAPED');
    this.events.emit('escape', { reason });
  }

  /** Cliquetis réguliers du moulinet. */
  tickReel(dt: number): void {
    this.reelTickTimer -= dt;
    if (this.reelTickTimer > 0) return;
    this.reelTickTimer = CONFIG.fishing.reelTickInterval;
    this.deps.audio.play('reel', 0.1);
  }

  /** Réaffiche l'invite (touches changées, mode tactile…). */
  refreshPrompt(): void {
    this.updatePrompt(this.fsm.state);
  }

  private updatePrompt(state: FishingState): void {
    const entry = (isTouchMode() ? TEXTS.touchPrompts : TEXTS.prompts)[state];
    const prompt = typeof entry === 'function' ? entry(keyHints()) : entry;
    const where = `${this.hotspot ? `${TEXTS.signs.icon} ` : ''}${TEXTS.zones[this.zone ?? 'open']}`;
    const text = state === 'WAITING' ? `${where} · ${prompt}` : prompt;
    this.deps.hud.setPrompt(text);
  }
}
