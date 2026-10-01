import { actionUsing, isReserved, keyLabel, keyOf, mainKey, REBINDABLE_ACTIONS, setCustomBindings, type RebindableAction } from '../core/controls';
import { isTouchMode } from '../core/pointerMode';
import { QUALITY_SETTINGS, type QualityLevel, type QualitySetting } from '../core/quality';
import { DAY_LENGTHS, TEXT_SIZES, type Settings, type TextSize } from '../core/settings';
import { createElement } from './hud';
import { TEXTS } from './texts';

type VolumeKey = 'masterVolume' | 'sfxVolume' | 'ambienceVolume' | 'musicVolume';
type ToggleKey = 'showFps' | 'showHints' | 'showBiteAlert' | 'reduceMotion' | 'easyHook' | 'bigBobber';

/** Temps pour confirmer l'effacement de la partie (ms). */
const RESET_CONFIRM_DELAY = 4000;

export interface SettingsPanelActions {
  /** Appelé à chaque modification, avec l'ensemble des réglages. */
  readonly onChange: (settings: Settings) => void;
  readonly onResetProgress: () => void;
  /** Revoir le tutoriel (absent sur l'écran titre). */
  readonly onReplayTutorial?: () => void;
  readonly onBack: () => void;
  /** Niveau de qualité graphique en ce moment (utile en mode automatique). */
  readonly currentQuality?: () => QualityLevel;
}

/**
 * Panneau Réglages : son (4 volumes), affichage (qualité graphique, images par seconde, aides),
 * confort (texte, animations, ferrage, bouchon, joystick), clavier (touches
 * reconfigurables), jeu (durée d'une journée) et effacement de la partie (en
 * deux clics). Chaque changement s'applique tout de suite.
 */
export class SettingsPanel {
  readonly element = createElement('menu-panel menu-settings');
  private readonly settings: Settings;
  private readonly actions: SettingsPanelActions;
  private readonly keyRows = createElement('settings-keys');
  /** Arrête l'écoute d'une touche en cours de choix. */
  private stopListening: (() => void) | null = null;

  constructor(current: Settings, actions: SettingsPanelActions) {
    this.settings = { ...current };
    this.actions = actions;
    const t = TEXTS.settings;
    this.element.append(
      createElement('menu-title', t.title),
      this.section(t.sound, this.volume('masterVolume'), this.volume('sfxVolume'), this.volume('ambienceVolume'), this.volume('musicVolume')),
      this.section(t.display, ...this.qualityChoice(), this.toggle('showFps'), this.toggle('showHints'), this.toggle('showBiteAlert')),
      this.section(
        t.comfort,
        this.textSizeChoice(),
        this.toggle('reduceMotion'),
        this.toggle('easyHook'),
        this.toggle('bigBobber'),
        this.stickSensitivity(),
      ),
      ...this.keyboardSection(),
      this.section(t.game, this.dayLengthChoice(), ...this.replayButton()),
      this.section(t.save, this.resetButton()),
      menuButton(TEXTS.menu.back, actions.onBack),
    );
  }

  private commit(): void {
    this.actions.onChange({ ...this.settings, keyBindings: { ...this.settings.keyBindings } });
  }

  private section(title: string, ...rows: HTMLElement[]): HTMLElement {
    const section = createElement('settings-section');
    section.append(createElement('settings-heading', title), ...rows);
    return section;
  }

  private volume(key: VolumeKey): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(Math.round(this.settings[key] * 100));
    input.addEventListener('input', () => {
      this.settings[key] = Number(input.value) / 100;
      this.commit();
    });
    return settingsRow(TEXTS.settings[key], input);
  }

  private toggle(key: ToggleKey): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.settings[key];
    input.addEventListener('change', () => {
      this.settings[key] = input.checked;
      this.commit();
    });
    return settingsRow(TEXTS.settings[key], input);
  }

  /** Qualité graphique (Auto / Basse / Moyenne / Haute), et en mode automatique le niveau du moment. */
  private qualityChoice(): HTMLElement[] {
    const t = TEXTS.settings;
    const note = createElement('settings-note');
    const refreshNote = (): void => {
      const level = this.actions.currentQuality?.();
      note.hidden = this.settings.quality !== 'auto' || !level;
      if (level) note.textContent = t.qualityAutoNow(t.qualities[level]);
    };
    const options = QUALITY_SETTINGS.map((value) => [value, t.qualities[value]] as const);
    const choice = segmented<QualitySetting>(options, this.settings.quality, (value) => {
      this.settings.quality = value;
      this.commit();
      refreshNote();
    });
    refreshNote();
    return [settingsRow(t.quality, choice), note];
  }

  private textSizeChoice(): HTMLElement {
    const options = TEXT_SIZES.map((size) => [size, TEXTS.settings.textSizes[size]] as const);
    const choice = segmented<TextSize>(options, this.settings.textSize, (value) => {
      this.settings.textSize = value;
      this.commit();
    });
    return settingsRow(TEXTS.settings.textSize, choice);
  }

  private stickSensitivity(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '50';
    input.max = '150';
    input.step = '10';
    input.value = String(Math.round(this.settings.stickSensitivity * 100));
    input.addEventListener('input', () => {
      this.settings.stickSensitivity = Number(input.value) / 100;
      this.commit();
    });
    return settingsRow(TEXTS.settings.stickSensitivity, input);
  }

  // --- Clavier ----------------------------------------------------------------------

  /** Touches reconfigurables (pas sur écran tactile). */
  private keyboardSection(): HTMLElement[] {
    if (isTouchMode()) return [];
    this.renderKeyRows();
    const reset = menuButton(TEXTS.settings.resetKeys, () => {
      this.settings.keyBindings = {};
      this.commit();
      this.renderKeyRows();
    });
    reset.classList.add('is-quiet');
    return [this.section(TEXTS.settings.keyboard, this.keyRows, createElement('settings-note', TEXTS.settings.arrowsNote), reset)];
  }

  private renderKeyRows(message = ''): void {
    // Les touches affichées doivent refléter les choix en cours
    setCustomBindings(this.settings.keyBindings);
    const rows = REBINDABLE_ACTIONS.map((action) => settingsRow(TEXTS.settings.actions[action], this.keyButton(action)));
    this.keyRows.replaceChildren(...rows, createElement('settings-note is-warning', message));
  }

  private keyButton(action: RebindableAction): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key-button';
    button.textContent = keyLabel(mainKey(action));
    button.addEventListener('click', () => this.listenForKey(action, button));
    return button;
  }

  /** Attend la prochaine touche (sans que le jeu la reçoive) et l'attribue à l'action. */
  private listenForKey(action: RebindableAction, button: HTMLButtonElement): void {
    this.stopListening?.();
    button.textContent = TEXTS.settings.pressKey;
    button.classList.add('is-listening');
    const onKey = (event: KeyboardEvent): void => {
      // Panneau fermé entre-temps : on n'écoute plus, la touche revient au jeu
      if (!button.isConnected) return this.stopListening?.();
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stopListening?.();
      if (event.code === 'Escape') return this.renderKeyRows();
      this.assignKey(action, keyOf(event));
    };
    window.addEventListener('keydown', onKey, { capture: true });
    this.stopListening = () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      this.stopListening = null;
    };
  }

  private assignKey(action: RebindableAction, key: string): void {
    if (isReserved(key)) return this.renderKeyRows(TEXTS.settings.reservedKey(keyLabel(key)));
    const other = actionUsing(key, action);
    if (other) return this.renderKeyRows(TEXTS.settings.takenKey(keyLabel(key), TEXTS.settings.actions[other]));
    this.settings.keyBindings[action] = key;
    this.commit();
    this.renderKeyRows();
  }

  private dayLengthChoice(): HTMLElement {
    const options = DAY_LENGTHS.map((minutes) => [minutes, TEXTS.settings.minutes(minutes)] as const);
    const choice = segmented(options, this.settings.dayLengthMinutes, (value) => {
      this.settings.dayLengthMinutes = value;
      this.commit();
    });
    return settingsRow(TEXTS.settings.dayLength, choice);
  }

  private replayButton(): HTMLElement[] {
    const replay = this.actions.onReplayTutorial;
    if (!replay) return [];
    const button = menuButton(TEXTS.settings.replayTutorial, replay);
    button.classList.add('is-quiet');
    return [button];
  }

  /** Premier clic : demande de confirmation (quelques secondes) ; second clic : efface. */
  private resetButton(): HTMLElement {
    let armedUntil = 0;
    const button = menuButton(TEXTS.settings.reset, () => {
      if (Date.now() < armedUntil) {
        this.actions.onResetProgress();
        return;
      }
      armedUntil = Date.now() + RESET_CONFIRM_DELAY;
      button.textContent = TEXTS.settings.resetConfirm;
      button.classList.add('is-danger');
      window.setTimeout(() => {
        button.textContent = TEXTS.settings.reset;
        button.classList.remove('is-danger');
      }, RESET_CONFIRM_DELAY);
    });
    button.classList.add('is-quiet');
    return button;
  }
}

/** Bouton de menu (réutilisé par menus.ts). */
export function menuButton(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = primary ? 'menu-button is-primary' : 'menu-button';
  button.textContent = label;
  button.addEventListener('click', () => {
    button.blur();
    onClick();
  });
  return button;
}

function settingsRow(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('label');
  row.className = 'settings-row';
  row.append(createElement('settings-label', label), control);
  return row;
}

/** Choix exclusif sous forme de boutons côte à côte. */
export function segmented<T>(options: readonly (readonly [T, string])[], current: T, onPick: (value: T) => void): HTMLElement {
  const group = createElement('segmented');
  const buttons = options.map(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.classList.toggle('is-selected', value === current);
    button.addEventListener('click', () => {
      buttons.forEach((other) => other.classList.toggle('is-selected', other === button));
      onPick(value);
    });
    return button;
  });
  group.append(...buttons);
  return group;
}
