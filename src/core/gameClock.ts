import { CONFIG } from '../config';

/** Créneaux horaires des poissons (bornes dans CONFIG.time.slots). */
export type TimeSlot = keyof typeof CONFIG.time.slots;

/** Créneau horaire d'une heure décimale (un créneau peut passer minuit). */
export function timeSlotAt(hour: number): TimeSlot {
  const slots = Object.entries(CONFIG.time.slots) as [TimeSlot, readonly [number, number]][];
  const found = slots.find(([, [start, end]]) => (start < end ? hour >= start && hour < end : hour >= start || hour < end));
  return found ? found[0] : 'day';
}

/**
 * Heure de la journée dans le jeu (0 → 24), qui avance en continu :
 * une journée complète dure CONFIG.time.dayLengthMinutes minutes réelles.
 * Les jours sont comptés, pour les phases de la lune.
 */
export class GameClock {
  private currentHour: number = CONFIG.time.startHour;
  private currentDay = 0;
  private dayLengthMinutes: number = CONFIG.time.dayLengthMinutes;

  /** Heure décimale : 7.5 = 7 h 30. */
  get hour(): number {
    return this.currentHour;
  }

  /** Jours de jeu écoulés depuis le début de la partie. */
  get day(): number {
    return this.currentDay;
  }

  /**
   * Phase de la lune : 0 = nouvelle lune, 0,5 = pleine lune. Elle change à
   * midi, pour qu'une nuit entière garde la même lune.
   */
  get moonPhase(): number {
    return this.moonIndex / CONFIG.events.moonCycleDays;
  }

  get isFullMoon(): boolean {
    return this.moonIndex === Math.floor(CONFIG.events.moonCycleDays / 2);
  }

  /** Heure affichable, ex. « 07:30 ». */
  get label(): string {
    const totalMinutes = Math.floor(this.currentHour * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  get slot(): TimeSlot {
    return timeSlotAt(this.currentHour);
  }

  /** Durée d'une journée complète en minutes réelles (réglage du joueur). */
  setDayLength(minutes: number): void {
    this.dayLengthMinutes = minutes;
  }

  /** Règle l'heure du jour en cours (tests en console). */
  setHour(hour: number): void {
    this.currentHour = ((hour % 24) + 24) % 24;
  }

  /** Reprend le jour et l'heure d'une sauvegarde. */
  setTime(day: number, hour: number): void {
    this.currentDay = Math.max(0, Math.floor(day));
    this.setHour(hour);
  }

  /** Avance l'horloge ; passer minuit change de jour. */
  advance(hours: number): void {
    const total = this.currentHour + hours;
    this.currentDay += Math.floor(total / 24);
    this.currentHour = ((total % 24) + 24) % 24;
  }

  /** Fait avancer l'heure ; retourne le nombre d'heures de jeu écoulées. */
  update(dt: number): number {
    const hours = (dt * 24) / (this.dayLengthMinutes * 60);
    this.advance(hours);
    return hours;
  }

  private get moonIndex(): number {
    const cycle = CONFIG.events.moonCycleDays;
    const moonDay = Math.floor(this.currentDay + (this.currentHour - 12) / 24);
    return ((moonDay % cycle) + cycle) % cycle;
  }
}
