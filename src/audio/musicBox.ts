/*
 * Musique générative douce, en attendant une vraie musique : une boîte à
 * musique qui joue de courtes phrases sur une gamme pentatonique (impossible
 * de faire une fausse note), avec de longs silences et un léger écho.
 * La nuit, la gamme devient mineure, plus grave et plus lente.
 */

/** Notes MIDI : do majeur pentatonique le jour, la mineur pentatonique la nuit. */
const DAY_SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const NIGHT_SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76];
/** Le planificateur prépare les notes qui tombent dans cette fenêtre (s). */
const LOOKAHEAD = 0.3;
const TICK_MS = 100;

export class MusicBox {
  private readonly context: AudioContext;
  private readonly input: GainNode;
  private timer: number | undefined;
  private nextTime = 0;
  private notesLeft = 0;
  private index = 4;
  private night = 0;

  /** `output` : nœud de sortie (le canal « musique »). */
  constructor(context: AudioContext, output: AudioNode) {
    this.context = context;
    this.input = context.createGain();
    this.input.connect(output);
    this.connectEcho(output);
  }

  start(): void {
    if (this.timer !== undefined) return;
    this.nextTime = this.context.currentTime + 2;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  setNight(night: number): void {
    this.night = night;
  }

  /** Prépare les notes des prochaines centaines de millisecondes (le temps audio est à l'arrêt tant que le son est bloqué). */
  private schedule(): void {
    while (this.nextTime < this.context.currentTime + LOOKAHEAD) {
      if (this.notesLeft <= 0) this.startPhrase();
      else this.playNextNote();
    }
  }

  /** Longue respiration, puis une nouvelle phrase de 5 à 9 notes. */
  private startPhrase(): void {
    this.nextTime += 5 + Math.random() * 7;
    this.notesLeft = 5 + Math.floor(Math.random() * 5);
    this.play(this.scale[0] - 12, this.nextTime, 0.12, 4);
  }

  private playNextNote(): void {
    const scale = this.scale;
    const step = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
    this.index = Math.min(Math.max(this.index + step, 0), scale.length - 1);
    this.play(scale[this.index], this.nextTime, 0.16, 2.2);
    this.nextTime += (0.45 + Math.random() * 0.45) * (this.night > 0.5 ? 1.3 : 1);
    this.notesLeft -= 1;
  }

  private get scale(): readonly number[] {
    return this.night > 0.5 ? NIGHT_SCALE : DAY_SCALE;
  }

  /** Une note : sinus + harmonique douce, attaque rapide, longue extinction. */
  private play(midi: number, time: number, volume: number, decay: number): void {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    envelope.connect(this.input);
    for (const [ratio, type, level] of [[1, 'sine', 1], [2, 'triangle', 0.25]] as const) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency * ratio;
      gain.gain.value = level;
      oscillator.connect(gain).connect(envelope);
      oscillator.start(time);
      oscillator.stop(time + decay + 0.05);
    }
  }

  /** Écho doux : un retard qui se réinjecte un peu, mêlé au son direct. */
  private connectEcho(output: AudioNode): void {
    const delay = this.context.createDelay(1);
    const feedback = this.context.createGain();
    const wet = this.context.createGain();
    delay.delayTime.value = 0.33;
    feedback.gain.value = 0.3;
    wet.gain.value = 0.25;
    this.input.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(output);
  }
}
