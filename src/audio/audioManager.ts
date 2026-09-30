import { CONFIG } from '../config';
import { assetUrl } from '../core/assets';
import { warn } from '../core/log';
import { MusicBox } from './musicBox';
import { synthesize, synthesizeAmbience, type AmbienceId, type SoundId } from './synth';

export type { SoundId };

/** Volumes des canaux, de 0 à 1 (réglages du joueur). */
export interface AudioVolumes {
  readonly master: number;
  readonly sfx: number;
  readonly ambience: number;
  readonly music: number;
}

/** Nœuds audio, créés seulement si le navigateur fournit WebAudio. */
interface Channels {
  readonly master: GainNode;
  readonly sfx: GainNode;
  readonly ambience: GainNode;
  readonly music: GainNode;
  readonly ambienceLayers: Record<AmbienceId, GainNode>;
}

/** Note le nom d'un son absent et laisse passer la valeur. */
type Remember = <T>(name: string, value: T | null) => T | null;

/**
 * Sons du jeu, répartis en trois canaux réglables : effets, ambiance du lac
 * (boucles jour et nuit, fondues selon l'heure) et musique.
 *
 * Chaque son a un emplacement dans CONFIG.audio : si le fichier existe dans
 * assets/audio/ il est utilisé, sinon un son généré en WebAudio le remplace.
 * Le navigateur n'autorise le son qu'après une interaction : le contexte
 * audio est réveillé au premier clic ou à la première touche.
 */
export class AudioManager {
  private readonly context: AudioContext | null;
  private readonly channels: Channels | null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private musicBox: MusicBox | null = null;
  /** Volume des oiseaux et des grillons sous la pluie (1 = normal). */
  private weatherHush = 1;

  constructor() {
    this.context = createContext();
    this.channels = this.context ? createChannels(this.context) : null;
    if (this.context) this.unlockOnFirstGesture(this.context);
  }

  /** Charge (ou génère) tous les sons, puis lance l'ambiance et la musique. */
  async load(): Promise<void> {
    const { context, channels } = this;
    if (!context || !channels) return;
    const missing: string[] = [];
    const remember: Remember = (name, value) => {
      if (!value) missing.push(name);
      return value;
    };
    await Promise.all([this.loadEffects(context, remember), this.loadAmbience(context, channels, remember), this.loadMusic(context, channels, remember)]);
    if (missing.length > 0) warn('audio', `sons absents (${missing.join(', ')}) → sons générés en WebAudio.`);
  }

  setVolumes(volumes: AudioVolumes): void {
    if (!this.channels) return;
    this.channels.master.gain.value = volumes.master;
    this.channels.sfx.gain.value = volumes.sfx;
    this.channels.ambience.gain.value = volumes.ambience * CONFIG.audio.ambience.volume;
    this.channels.music.gain.value = volumes.music * CONFIG.audio.music.volume;
  }

  /** Ressac et mouettes au bord de la mer, en plus de l'ambiance jour/nuit. */
  setSea(level: number): void {
    if (this.channels) this.channels.ambienceLayers.sea.gain.value = level;
  }

  /** Eau vive de la rivière, en plus de l'ambiance jour/nuit (0 = lac, 1 = rivière). */
  setRiver(level: number): void {
    if (this.channels) this.channels.ambienceLayers.river.gain.value = level;
  }

  /** Pluie et vent (0 → 1) : leurs boucles montent, oiseaux et grillons se font plus discrets. */
  setWeather(rain: number, wind: number): void {
    this.weatherHush = 1 - 0.6 * rain;
    if (!this.channels) return;
    this.channels.ambienceLayers.rain.gain.value = rain;
    this.channels.ambienceLayers.wind.gain.value = wind;
  }

  /** Fondu de l'ambiance jour → nuit (0 → 1), et humeur de la musique. */
  setNight(night: number): void {
    if (!this.channels) return;
    // Fondu à puissance constante : pas de creux de volume au milieu
    this.channels.ambienceLayers.day.gain.value = Math.cos((night * Math.PI) / 2) * this.weatherHush;
    this.channels.ambienceLayers.night.gain.value = Math.sin((night * Math.PI) / 2) * this.weatherHush;
    this.musicBox?.setNight(night);
  }

  /**
   * Joue un effet. `variation` fait varier légèrement la hauteur pour éviter
   * la répétition ; `volume` multiplie le volume de CONFIG.audio.volumes.
   */
  play(id: SoundId, variation = 0.06, volume = 1): void {
    const buffer = this.buffers.get(id);
    if (!this.context || !this.channels || !buffer || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * variation;
    const gain = this.context.createGain();
    gain.gain.value = CONFIG.audio.volumes[id] * volume;
    source.connect(gain).connect(this.channels.sfx);
    source.start();
  }

  private async loadEffects(context: AudioContext, remember: Remember): Promise<void> {
    const ids = Object.keys(CONFIG.audio.files) as SoundId[];
    await Promise.all(
      ids.map(async (id) => {
        const buffer = remember(id, await loadFile(context, CONFIG.audio.files[id]));
        this.buffers.set(id, buffer ?? synthesize(id, context));
      }),
    );
  }

  /** Les deux boucles d'ambiance tournent en permanence ; setNight() règle leur mélange. */
  private async loadAmbience(context: AudioContext, channels: Channels, remember: Remember): Promise<void> {
    const ids = Object.keys(CONFIG.audio.ambience.files) as AmbienceId[];
    await Promise.all(
      ids.map(async (id) => {
        const buffer = remember(`ambiance ${id}`, await loadFile(context, CONFIG.audio.ambience.files[id]));
        startLoop(context, buffer ?? synthesizeAmbience(id, context), channels.ambienceLayers[id]);
      }),
    );
  }

  /** Musique : le fichier en boucle s'il existe, sinon la boîte à musique générée. */
  private async loadMusic(context: AudioContext, channels: Channels, remember: Remember): Promise<void> {
    const buffer = remember('musique', await loadFile(context, CONFIG.audio.music.file));
    if (buffer) {
      startLoop(context, buffer, channels.music);
      return;
    }
    this.musicBox = new MusicBox(context, channels.music);
    this.musicBox.start();
  }

  /**
   * Le navigateur n'autorise le son qu'après un geste du joueur. Sur iPhone,
   * seul un toucher terminé (touchend, click) compte : on essaie à chaque
   * geste jusqu'à ce que le contexte tourne.
   */
  private unlockOnFirstGesture(context: AudioContext): void {
    const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
    const unlock = (): void => {
      void context.resume().then(() => {
        if (context.state !== 'running') return;
        gestures.forEach((gesture) => window.removeEventListener(gesture, unlock));
      });
    };
    gestures.forEach((gesture) => window.addEventListener(gesture, unlock));
  }
}

/** Contexte audio, ou null si le navigateur n'en fournit pas (le jeu reste alors muet). */
function createContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch (error) {
    warn('audio', 'WebAudio indisponible → jeu sans son.', error);
    return null;
  }
}

/** master ← effets, ambiance (← calques jour et nuit), musique. */
function createChannels(context: AudioContext): Channels {
  const gain = (output: AudioNode): GainNode => {
    const node = context.createGain();
    node.connect(output);
    return node;
  };
  const master = gain(context.destination);
  const ambience = gain(master);
  return {
    master,
    sfx: gain(master),
    ambience,
    music: gain(master),
    ambienceLayers: {
      day: gain(ambience),
      night: gain(ambience),
      river: silent(gain(ambience)),
      rain: silent(gain(ambience)),
      wind: silent(gain(ambience)),
      sea: silent(gain(ambience)),
    },
  };
}

function silent(node: GainNode): GainNode {
  node.gain.value = 0;
  return node;
}

function startLoop(context: AudioContext, buffer: AudioBuffer, output: AudioNode): void {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(output);
  source.start();
}

async function loadFile(context: AudioContext, path: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(assetUrl(path));
    if (!response.ok) return null;
    return await context.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}
