/*
 * Sons générés en code, en attendant les vrais fichiers audio.
 * Chaque recette remplit directement les échantillons d'un AudioBuffer.
 */

export type SoundId = 'cast' | 'splash' | 'nibble' | 'bite' | 'reel' | 'snap' | 'catch' | 'pickup' | 'quack' | 'croak';
export type AmbienceId = 'day' | 'night' | 'river' | 'rain' | 'wind' | 'sea';

interface Recipe {
  /** Durée en secondes. */
  readonly duration: number;
  readonly render: (out: Float32Array, rate: number) => void;
}

/** Durée du fondu qui raccorde la fin d'une boucle à son début (s). */
const LOOP_CROSSFADE = 1;

/** Ambiances jouées en boucle : jour et nuit (fondues selon l'heure), eau vive de la rivière, pluie et vent. */
const AMBIENCES: Record<AmbienceId, Recipe> = {
  // Jour : clapotis contre la coque, souffle de vent, quelques oiseaux
  day: {
    duration: 24,
    render: (out, rate) => {
      lapping(out, rate, 1);
      wind(out, rate, 0.5);
      birds(out, rate, 7);
    },
  },
  // Rivière : bruissement de l'eau qui court et petits gargouillis (s'ajoute au jour ou à la nuit)
  river: {
    duration: 20,
    render: (out, rate) => stream(out, rate, 1),
  },
  // Mer : des vagues qui enflent et se retirent, et quelques cris de mouettes
  sea: {
    duration: 22.5,
    render: (out, rate) => surf(out, rate, 1),
  },
  // Pluie : un bruissement dense et des gouttes qui claquent sur l'eau
  rain: {
    duration: 16,
    render: (out, rate) => rain(out, rate, 1),
  },
  // Vent : un souffle grave qui enfle et retombe
  wind: {
    duration: 20,
    render: (out, rate) => wind(out, rate, 1.6),
  },
  // Nuit : clapotis plus doux et grillons
  night: {
    duration: 24,
    render: (out, rate) => {
      lapping(out, rate, 0.8);
      crickets(out, rate, 4600, 0.75);
      crickets(out, rate, 5200, 0.95);
    },
  },
};

const RECIPES: Record<SoundId, Recipe> = {
  // Lancer : souffle qui monte puis retombe
  cast: { duration: 0.45, render: (out, rate) => whoosh(out, rate) },
  // Plouf : « bloop » grave + éclaboussure
  splash: {
    duration: 0.6,
    render: (out, rate) => {
      bloop(out, rate, 420, 110, 0.6);
      noiseBurst(out, rate, 0.25, 0.9, 0.12);
    },
  },
  // Fausse touche : petit « plip » aigu
  nibble: { duration: 0.12, render: (out, rate) => bloop(out, rate, 950, 520, 0.5) },
  // Vraie touche : « gloup » profond et appuyé
  bite: {
    duration: 0.55,
    render: (out, rate) => {
      bloop(out, rate, 320, 70, 1);
      noiseBurst(out, rate, 0.3, 0.6, 0.1);
    },
  },
  // Moulinet : série de petits cliquetis
  reel: { duration: 0.3, render: (out, rate) => ratchet(out, rate, 28) },
  // Ligne qui casse : « twang » aigu qui retombe
  snap: {
    duration: 0.35,
    render: (out, rate) => {
      bloop(out, rate, 1400, 300, 0.7);
      noiseBurst(out, rate, 0.08, 0.8, 0.5);
    },
  },
  // Prise : petit carillon do-mi-sol
  catch: {
    duration: 1.4,
    render: (out, rate) => {
      chime(out, rate, 523.25, 0, 1);
      chime(out, rate, 659.25, 0.12, 0.9);
      chime(out, rate, 783.99, 0.24, 0.8);
    },
  },
  // Trouvaille repêchée : deux notes claires qui montent
  pickup: {
    duration: 0.9,
    render: (out, rate) => {
      chime(out, rate, 880, 0, 0.9);
      chime(out, rate, 1318.5, 0.09, 0.8);
    },
  },
  // Canard : deux « coin » nasillards
  quack: {
    duration: 0.5,
    render: (out, rate) => {
      honk(out, rate, 0, 0.16, 520, 410);
      honk(out, rate, 0.22, 0.2, 500, 380);
    },
  },
  // Grenouille : un coassement grave et roulé
  croak: { duration: 0.42, render: (out, rate) => rattle(out, rate, 0.4, 150, 32) },
};

/** Fabrique le son `id` pour ce contexte audio. */
export function synthesize(id: SoundId, context: BaseAudioContext): AudioBuffer {
  const recipe = RECIPES[id];
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(recipe.duration * rate), rate);
  const samples = buffer.getChannelData(0);
  recipe.render(samples, rate);
  normalize(samples, 0.8);
  return buffer;
}

/** Fabrique une ambiance qui boucle sans à-coup (sa fin est fondue dans son début). */
export function synthesizeAmbience(id: AmbienceId, context: BaseAudioContext): AudioBuffer {
  const recipe = AMBIENCES[id];
  const rate = context.sampleRate;
  const length = Math.ceil(recipe.duration * rate);
  const fade = Math.ceil(LOOP_CROSSFADE * rate);
  const samples = new Float32Array(length + fade);
  recipe.render(samples, rate);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    samples[i] = samples[i] * t + samples[length + i] * (1 - t);
  }
  const buffer = context.createBuffer(1, length, rate);
  const channel = buffer.getChannelData(0);
  channel.set(samples.subarray(0, length));
  normalize(channel, 0.8);
  return buffer;
}

/** Cri nasillard : une note riche en harmoniques qui glisse de `from` à `to` Hz, de `start` à `start + length` secondes. */
function honk(out: Float32Array, rate: number, start: number, length: number, from: number, to: number): void {
  const first = Math.floor(start * rate);
  const count = Math.floor(length * rate);
  let phase = 0;
  for (let i = 0; i < count && first + i < out.length; i++) {
    const t = i / count;
    phase += (2 * Math.PI * (from + (to - from) * t)) / rate;
    const envelope = Math.sin(Math.PI * t) ** 0.6;
    out[first + i] += envelope * 0.5 * (Math.sin(phase) + 0.6 * Math.sin(2 * phase) + 0.45 * Math.sin(3 * phase) + 0.3 * Math.sin(5 * phase));
  }
}

/** Son roulé : une note grave hachée `pulses` fois par seconde (coassement). */
function rattle(out: Float32Array, rate: number, length: number, frequency: number, pulses: number): void {
  const count = Math.min(out.length, Math.floor(length * rate));
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const envelope = Math.sin((Math.PI * i) / count);
    const pulse = Math.max(0, Math.sin(2 * Math.PI * pulses * t)) ** 2;
    out[i] += envelope * pulse * 0.6 * (Math.sin(2 * Math.PI * frequency * t) + 0.5 * Math.sin(2 * Math.PI * frequency * 2.02 * t));
  }
}

/** Sinus dont la fréquence glisse de `from` à `to` Hz, avec une décroissance rapide. */
function bloop(out: Float32Array, rate: number, from: number, to: number, volume: number): void {
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    phase += (2 * Math.PI * from * Math.pow(to / from, t)) / rate;
    const attack = Math.min(1, i / (0.004 * rate));
    out[i] += Math.sin(phase) * attack * (1 - t) ** 3 * volume;
  }
}

/** Bruit adouci (passe-bas) qui s'éteint : éclaboussure. */
function noiseBurst(out: Float32Array, rate: number, length: number, volume: number, smoothing: number): void {
  const count = Math.min(out.length, Math.floor(length * rate));
  let low = 0;
  for (let i = 0; i < count; i++) {
    low += smoothing * (Math.random() * 2 - 1 - low);
    out[i] += low * volume * 3 * (1 - i / count) ** 2;
  }
}

/** Bruit dont le filtre s'ouvre puis se referme : souffle d'un lancer. */
function whoosh(out: Float32Array, _rate: number): void {
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    const swell = Math.sin(Math.PI * t);
    low += (0.02 + 0.25 * swell) * (Math.random() * 2 - 1 - low);
    out[i] = low * swell * swell;
  }
}

/** Note de carillon (fondamentale + octave douce) qui démarre à `start` secondes. */
function chime(out: Float32Array, rate: number, frequency: number, start: number, volume: number): void {
  const offset = Math.floor(start * rate);
  for (let i = offset; i < out.length; i++) {
    const t = (i - offset) / rate;
    const envelope = Math.min(1, t / 0.01) * Math.exp(-t * 3);
    const tone = Math.sin(2 * Math.PI * frequency * t) + 0.3 * Math.sin(4 * Math.PI * frequency * t);
    out[i] += tone * envelope * volume;
  }
}

/** Clapotis : bruit très adouci qui respire lentement, et petits « clocs » contre la coque. */
function lapping(out: Float32Array, rate: number, volume: number): void {
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    low += 0.02 * (Math.random() * 2 - 1 - low);
    const swell = 0.55 + 0.25 * Math.sin(t * 1.7) + 0.2 * Math.sin(t * 0.9 + 1.3);
    out[i] += low * swell * 6 * volume;
  }
  for (let time = Math.random() * 2; time < out.length / rate - 0.3; time += 1.5 + Math.random() * 2.5) {
    const start = Math.floor(time * rate);
    bloop(out.subarray(start, start + Math.floor(0.18 * rate)), rate, 260, 140, 0.25 * volume);
  }
}

/** Souffle de vent : bruit très grave dont l'intensité varie lentement. */
/** Ressac : un souffle qui enfle et se retire (une vague toutes les 7,5 s) et des mouettes. */
function surf(out: Float32Array, rate: number, volume: number): void {
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    low += 0.05 * (Math.random() * 2 - 1 - low);
    const swell = Math.sin(Math.PI * ((t % 7.5) / 7.5)) ** 3;
    out[i] += low * (0.25 + 1.3 * swell) * 3 * volume;
  }
  for (const start of [3.1, 3.5, 14.2]) chirp(out, rate, start, 0.35, 1150 + Math.random() * 200);
}

/** Pluie : bruit clair et régulier, et une multitude de petites gouttes. */
function rain(out: Float32Array, rate: number, volume: number): void {
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    low += 0.3 * (white - low);
    out[i] += (white - low) * 0.35 * volume;
  }
  for (let time = 0; time < out.length / rate - 0.05; time += 0.01 + Math.random() * 0.05) {
    const start = Math.floor(time * rate);
    const pitch = 1800 + Math.random() * 2500;
    bloop(out.subarray(start, start + Math.floor(0.02 * rate)), rate, pitch, pitch * 0.7, 0.06 * volume * Math.random());
  }
}

/** Eau vive : un souffle plus clair que le clapotis, qui ondule, et des gargouillis. */
function stream(out: Float32Array, rate: number, volume: number): void {
  let low = 0;
  let band = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    low += 0.08 * (white - low);
    band += 0.35 * (low - band);
    const swell = 0.7 + 0.2 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 5.1 + 0.7);
    out[i] += (low - band) * swell * 4 * volume;
  }
  for (let time = Math.random() * 0.5; time < out.length / rate - 0.2; time += 0.25 + Math.random() * 0.9) {
    const start = Math.floor(time * rate);
    const pitch = 500 + Math.random() * 700;
    bloop(out.subarray(start, start + Math.floor(0.08 * rate)), rate, pitch, pitch * 0.6, 0.12 * volume);
  }
}

function wind(out: Float32Array, rate: number, volume: number): void {
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    low += 0.004 * (Math.random() * 2 - 1 - low);
    out[i] += low * (0.6 + 0.4 * Math.sin(t * 0.35)) * 10 * volume;
  }
}

/** Oiseaux : `phrases` petites phrases de 2 à 4 gazouillis, réparties dans la boucle. */
function birds(out: Float32Array, rate: number, phrases: number): void {
  const duration = out.length / rate;
  for (let p = 0; p < phrases; p++) {
    let time = Math.random() * (duration - 2);
    const pitch = 2600 + Math.random() * 1600;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let c = 0; c < chirps; c++) {
      chirp(out, rate, time, 0.08 + Math.random() * 0.07, pitch * (0.9 + Math.random() * 0.2));
      time += 0.14 + Math.random() * 0.1;
    }
  }
}

/** Un gazouillis : note aiguë qui descend, avec un léger trémolo. */
function chirp(out: Float32Array, rate: number, start: number, length: number, frequency: number): void {
  const offset = Math.floor(start * rate);
  const count = Math.floor(length * rate);
  let phase = 0;
  for (let i = 0; i < count && offset + i < out.length; i++) {
    const t = i / count;
    phase += (2 * Math.PI * frequency * (1 - 0.3 * t + 0.05 * Math.sin(t * 40))) / rate;
    out[offset + i] += Math.sin(phase) * Math.sin(Math.PI * t) * 0.12;
  }
}

/** Grillon : trilles régulières (3 impulsions à `frequency` Hz) toutes les `period` secondes environ. */
function crickets(out: Float32Array, rate: number, frequency: number, period: number): void {
  const duration = out.length / rate;
  for (let time = Math.random() * period; time < duration; time += period * (0.9 + Math.random() * 0.2)) {
    for (let pulse = 0; pulse < 3; pulse++) chirp(out, rate, time + pulse * 0.045, 0.025, frequency);
  }
}

/** Cliquetis réguliers (`clicksPerSecond`), chacun un très bref bruit, adouci pour ne pas claquer dans l'aigu. */
function ratchet(out: Float32Array, rate: number, clicksPerSecond: number): void {
  const period = Math.floor(rate / clicksPerSecond);
  const clickLength = Math.floor(0.005 * rate);
  for (let start = 0; start < out.length; start += period) {
    let low = 0;
    for (let i = 0; i < clickLength && start + i < out.length; i++) {
      low += 0.35 * (Math.random() * 2 - 1 - low);
      out[start + i] = low * (1 - i / clickLength);
    }
  }
}

/** Met le pic du son à `peak` pour que toutes les recettes aient un volume comparable. */
function normalize(samples: Float32Array, peak: number): void {
  const max = samples.reduce((m, value) => Math.max(m, Math.abs(value)), 0);
  if (max === 0) return;
  const gain = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}
