import { keyHints } from '../core/controls';
import { LANGUAGE, LANGUAGE_NAMES, LANGUAGES, type Language } from '../core/language';
import { isTouchMode } from '../core/pointerMode';
import type { QualityLevel } from '../core/quality';
import type { Settings } from '../core/settings';
import { createElement } from './hud';
import { menuButton, segmented, SettingsPanel } from './settingsPanel';
import { TEXTS } from './texts';

export type MenuScreen = 'title' | 'pause' | 'settings';

export interface MenuActions {
  readonly onPlay: () => void;
  readonly onResume: () => void;
  readonly onOpenJournal: () => void;
  readonly onOpenCabin: () => void;
  readonly onOpenMap: () => void;
  readonly onSettingsChange: (settings: Settings) => void;
  readonly onResetProgress: () => void;
  readonly onReplayTutorial: () => void;
  readonly onInstall: () => void;
  readonly onUpdate: () => void;
  /** Le joueur choisit une autre langue (écran titre) : le jeu se recharge dans cette langue. */
  readonly onLanguageChange: (language: Language) => void;
  /** Niveau de qualité graphique en ce moment (affiché dans les réglages en mode automatique). */
  readonly currentQuality: () => QualityLevel;
}

/** Ce que les menus montrent du jeu comme application (voir src/pwa/pwa.ts). */
export interface AppStatus {
  readonly canInstall: boolean;
  readonly needsIosHint: boolean;
  readonly updateReady: boolean;
}

/**
 * Écrans de menu : titre (au lancement), pause (Échap) et réglages
 * (accessibles depuis les deux). Le lac reste visible derrière.
 */
export class Menus {
  private readonly root = createElement('menu');
  private readonly actions: MenuActions;
  private readonly getSettings: () => Settings;
  private readonly getAppStatus: () => AppStatus;
  private screen: MenuScreen | null = null;
  private settingsReturn: 'title' | 'pause' = 'pause';
  private title = { hasSave: false, progress: '' };

  constructor(layer: HTMLElement, actions: MenuActions, getSettings: () => Settings, getAppStatus: () => AppStatus) {
    this.actions = actions;
    this.getSettings = getSettings;
    this.getAppStatus = getAppStatus;
    this.root.hidden = true;
    layer.append(this.root);
  }

  get current(): MenuScreen | null {
    return this.screen;
  }

  /** Écran titre ; `progress` résume la partie sauvegardée (vide pour une nouvelle partie). */
  showTitle(hasSave: boolean, progress: string): void {
    this.title = { hasSave, progress };
    this.render('title', this.titlePanel());
  }

  showPause(): void {
    this.render('pause', this.pausePanel());
  }

  showSettings(): void {
    this.settingsReturn = this.screen === 'title' ? 'title' : 'pause';
    const fromPause = this.settingsReturn === 'pause';
    const panel = new SettingsPanel(this.getSettings(), {
      onChange: this.actions.onSettingsChange,
      onResetProgress: this.actions.onResetProgress,
      onReplayTutorial: fromPause ? this.actions.onReplayTutorial : undefined,
      onBack: () => this.back(),
      currentQuality: this.actions.currentQuality,
    });
    this.render('settings', panel.element);
  }

  /** Retour arrière (bouton Retour ou Échap) depuis les réglages. */
  back(): void {
    if (this.settingsReturn === 'title') this.showTitle(this.title.hasSave, this.title.progress);
    else this.showPause();
  }

  /** Réaffiche le titre ou la pause (installation possible, mise à jour prête…). */
  refresh(): void {
    if (this.screen === 'title') this.showTitle(this.title.hasSave, this.title.progress);
    else if (this.screen === 'pause') this.showPause();
  }

  hide(): void {
    this.screen = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private render(screen: MenuScreen, panel: HTMLElement): void {
    this.screen = screen;
    this.root.className = `menu menu-screen-${screen}`;
    this.root.replaceChildren(panel);
    this.root.hidden = false;
  }

  private titlePanel(): HTMLElement {
    const { hasSave, progress } = this.title;
    const panel = createElement('menu-panel menu-title-panel');
    panel.append(
      createElement('menu-logo', TEXTS.menu.logo),
      createElement('menu-tagline', TEXTS.menu.tagline),
      menuButton(hasSave ? TEXTS.menu.continue : TEXTS.menu.play, this.actions.onPlay, true),
    );
    if (progress) panel.append(createElement('menu-progress', progress));
    panel.append(menuButton(TEXTS.menu.settings, () => this.showSettings()));
    const { canInstall, needsIosHint } = this.getAppStatus();
    if (canInstall) panel.append(menuButton(TEXTS.pwa.install, this.actions.onInstall));
    else if (needsIosHint) panel.append(createElement('menu-note', TEXTS.pwa.iosHint));
    this.appendUpdateNotice(panel);
    panel.append(this.languageChoice());
    return panel;
  }

  /** Choix de la langue, en bas de l'écran titre : chaque langue est écrite dans sa propre langue. */
  private languageChoice(): HTMLElement {
    const row = createElement('menu-language');
    const icon = createElement('menu-language-icon', '🌐');
    icon.title = TEXTS.menu.language;
    const options = LANGUAGES.map((language) => [language, LANGUAGE_NAMES[language]] as const);
    const choice = segmented<Language>(options, LANGUAGE, (language) => {
      if (language !== LANGUAGE) this.actions.onLanguageChange(language);
    });
    choice.setAttribute('aria-label', TEXTS.menu.language);
    row.append(icon, choice);
    return row;
  }

  private pausePanel(): HTMLElement {
    const panel = createElement('menu-panel');
    panel.append(
      createElement('menu-title', TEXTS.menu.pause),
      menuButton(TEXTS.menu.resume, this.actions.onResume, true),
      menuButton(TEXTS.menu.journal, this.actions.onOpenJournal),
      menuButton(TEXTS.menu.cabin, this.actions.onOpenCabin),
      menuButton(TEXTS.menu.map, this.actions.onOpenMap),
      menuButton(TEXTS.menu.settings, () => this.showSettings()),
    );
    this.appendUpdateNotice(panel);
    panel.append(controlsHelp());
    return panel;
  }

  /** Nouvelle version prête : un mot et un bouton (la partie est sauvegardée avant de recharger). */
  private appendUpdateNotice(panel: HTMLElement): void {
    if (!this.getAppStatus().updateReady) return;
    const notice = createElement('menu-update');
    notice.append(createElement('menu-update-text', TEXTS.pwa.updateReady), menuButton(TEXTS.pwa.update, this.actions.onUpdate));
    panel.append(notice);
  }
}

/** Aide-mémoire des commandes (clavier et souris, ou tactile). */
function controlsHelp(): HTMLElement {
  const help = createElement('menu-controls');
  help.append(createElement('settings-heading', TEXTS.menu.controlsTitle));
  const controls = isTouchMode() ? TEXTS.menu.touchControls : TEXTS.menu.controls(keyHints());
  for (const [keys, action] of controls) {
    const row = createElement('menu-controls-row');
    row.append(createElement('menu-keys', keys), createElement('menu-action', action));
    help.append(row);
  }
  return help;
}
