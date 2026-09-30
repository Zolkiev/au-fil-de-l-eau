import { CONFIG } from '../config';

/** Niveaux de qualité graphique (réglages dans CONFIG.quality.presets). */
export type QualityLevel = 'low' | 'medium' | 'high';
/** Choix du joueur : un niveau fixe, ou le mode automatique. */
export type QualitySetting = 'auto' | QualityLevel;

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', ...QUALITY_LEVELS];

export function isQualitySetting(value: unknown): value is QualitySetting {
  return QUALITY_SETTINGS.includes(value as QualitySetting);
}

/** Niveau de départ du mode automatique : plus prudent sur écran tactile (téléphones, tablettes). */
export function autoStartLevel(touch: boolean): QualityLevel {
  return touch ? CONFIG.quality.auto.startTouch : CONFIG.quality.auto.startDesktop;
}

/** Durée (s) depuis l'image précédente, mesurée sans le plafond de la boucle de jeu. */
class FrameClock {
  private last = 0;

  tick(now: number): number {
    const dt = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    return dt;
  }
}

/**
 * Mode automatique : mesure la fluidité et baisse la qualité d'un cran si le
 * jeu reste sous CONFIG.quality.auto.minFps. Il ne remonte jamais tout seul
 * (sinon la qualité ferait des va-et-vient). Les images d'un onglet caché ou
 * après une pause longue ne comptent pas.
 */
export class QualityGovernor {
  private readonly clock = new FrameClock();
  private readonly onLower: (level: QualityLevel) => void;
  private level: QualityLevel = 'high';
  private active = false;
  private warmup = 0;
  private frames = 0;
  private time = 0;

  constructor(onLower: (level: QualityLevel) => void) {
    this.onLower = onLower;
  }

  get current(): QualityLevel {
    return this.level;
  }

  /** (Re)part de `level` ; `active` : mode automatique (sinon on ne fait que suivre le niveau choisi). */
  start(level: QualityLevel, active: boolean): void {
    this.level = level;
    this.active = active;
    this.restartMeasure();
  }

  frame(now: number): void {
    const dt = this.clock.tick(now);
    if (!this.active || document.hidden || dt <= 0 || dt > 0.25) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    this.frames++;
    this.time += dt;
    if (this.time < CONFIG.quality.auto.window) return;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    if (fps >= CONFIG.quality.auto.minFps) return;
    const index = QUALITY_LEVELS.indexOf(this.level);
    if (index <= 0) return;
    this.level = QUALITY_LEVELS[index - 1];
    this.restartMeasure();
    this.onLower(this.level);
  }

  /** Après un changement, on laisse le rendu se stabiliser (compilation des shaders…) avant de mesurer. */
  private restartMeasure(): void {
    this.warmup = CONFIG.quality.auto.warmup;
    this.frames = 0;
    this.time = 0;
  }
}

/** Compteur d'images par seconde, rafraîchi toutes les demi-secondes. */
export class FpsMeter {
  private readonly clock = new FrameClock();
  private frames = 0;
  private time = 0;

  /** Retourne la nouvelle moyenne quand elle change, sinon null. */
  frame(now: number): number | null {
    const dt = this.clock.tick(now);
    if (dt <= 0 || dt > 1) return null;
    this.frames++;
    this.time += dt;
    if (this.time < 0.5) return null;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    return fps;
  }
}
