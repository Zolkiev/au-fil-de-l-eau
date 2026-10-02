import { keyHints } from '../core/controls';
import type { Journal, JournalEntry } from '../core/journal';
import type { Stats } from '../core/stats';
import { BAITS } from '../data/baits';
import { FISH, fishById, fishOf, type FishSpecies } from '../data/fish';
import { PLACES, placeById, type PlaceId } from '../data/places';
import { CLUE_KINDS, trailOf, type ClueKind, type Trail } from '../data/trails';
import { WEATHERS } from '../data/weather';
import { countStars, TOTAL_STARS } from '../progression/mastery';
import { achievedObjectives, countAchieved, OBJECTIVES, tierThresholdCm, TOTAL_OBJECTIVES } from '../progression/objectives';
import type { Trails } from '../progression/trails';
import { habitatText, hintText, masteryText, timeText } from './fishText';
import type { FishThumbnails } from './fishThumbnails';
import { createElement } from './hud';
import { formatDate, formatDuration, formatSize, TEXTS } from './texts';

/** Ce dont le carnet a besoin pour s'afficher. */
export interface JournalViewDeps {
  readonly journal: Journal;
  readonly stats: Stats;
  readonly thumbnails: FishThumbnails;
  /** Coquillages disponibles. */
  readonly shells: () => number;
  /** Pistes des légendaires (indices trouvés). */
  readonly trails: Trails;
  /** Jours de pêche (tampons du carnet de bord). */
  readonly fishingDays: () => number;
  /** Lieu où l'on pêche : le carnet s'ouvre sur ses poissons. */
  readonly place: PlaceId;
}

/**
 * Carnet de pêche : grille des espèces (silhouette et indices pour celles
 * pas encore attrapées, piste à remonter pour les légendaires), objectifs (attrapé, beau, trophée, variante),
 * record, nombre de prises et étoiles de maîtrise par espèce, et résumé de
 * la partie. Le jeu est
 * en pause tant qu'il est ouvert.
 */
export class JournalView {
  private readonly deps: JournalViewDeps;
  private readonly root = createElement('journal');
  private readonly panel = createElement('journal-panel');

  constructor(layer: HTMLElement, deps: JournalViewDeps) {
    this.deps = deps;
    this.root.hidden = true;
    this.root.append(this.panel);
    // Un clic sur le fond (hors du carnet) le ferme
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    layer.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.panel.replaceChildren(this.header(), this.summary(), this.grid());
    this.root.hidden = false;
    this.scrollToPlace(this.deps.place);
  }

  close(): void {
    this.root.hidden = true;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Fait défiler jusqu'aux poissons d'un lieu (le premier lieu reste en haut, avec le résumé). */
  private scrollToPlace(place: PlaceId): void {
    const title = this.panel.querySelector<HTMLElement>(`.journal-place[data-place="${place}"]`);
    const header = this.panel.querySelector<HTMLElement>('.journal-header');
    if (!title || !header || place === PLACES[0].id) {
      this.panel.scrollTop = 0;
      return;
    }
    const offset = title.getBoundingClientRect().top - this.panel.getBoundingClientRect().top;
    this.panel.scrollTop += offset - header.offsetHeight - 12;
  }

  private header(): HTMLElement {
    const header = createElement('journal-header');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'journal-close';
    close.title = TEXTS.journal.closeHint(keyHints().journal);
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    header.append(createElement('journal-title', TEXTS.journal.title), close);
    return header;
  }

  /** Résumé de la partie : espèces trouvées, prises, plus grosse prise, temps de jeu. */
  private summary(): HTMLElement {
    const { journal, stats } = this.deps;
    const summary = createElement('journal-summary');
    summary.append(
      chip(TEXTS.journal.species(journal.speciesCount, FISH.length)),
      chip(TEXTS.journal.objectives(countAchieved(journal), TOTAL_OBJECTIVES)),
      chip(TEXTS.mastery.total(countStars(journal), TOTAL_STARS)),
      chip(`${TEXTS.shells.icon} ${TEXTS.shells.count(this.deps.shells())}`),
      chip(TEXTS.journal.totalCatches(journal.totalCatches)),
      chip(TEXTS.logbook.days(this.deps.fishingDays())),
      chip(`${TEXTS.journal.playTime}${TEXTS.colon}${formatDuration(stats.data.playTimeSeconds)}`),
    );
    const biggest = stats.data.biggest;
    const species = biggest && fishById(biggest.speciesId);
    if (biggest && species) summary.append(chip(`${TEXTS.journal.biggest}${TEXTS.colon}${species.name}, ${formatSize(biggest.sizeCm)}`));
    return summary;
  }

  /** Les espèces, lieu par lieu (« Le lac · 7 / 10 »). */
  private grid(): HTMLElement {
    const list = createElement('journal-places');
    for (const place of PLACES) {
      const species = fishOf(place.id);
      const caught = species.filter((candidate) => this.deps.journal.entry(candidate.id)).length;
      const grid = createElement('journal-grid');
      species.forEach((candidate) => grid.append(this.card(candidate)));
      const title = createElement('journal-place', `${place.icon} ${place.name} · ${caught} / ${species.length}`);
      title.dataset.place = place.id;
      list.append(title, grid);
    }
    return list;
  }

  private card(species: FishSpecies): HTMLElement {
    const entry = this.deps.journal.entry(species.id);
    const card = document.createElement('article');
    card.className = `journal-card rarity-${species.rarity}${entry ? '' : ' is-unknown'}`;
    card.append(this.thumbnail(species, !entry), createElement('catch-rarity', TEXTS.rarity[species.rarity]));
    card.append(createElement('journal-name', entry ? species.name : TEXTS.journal.unknownName));
    card.append(objectivesRow(species, entry));
    const trail = trailOf(species.id);
    if (entry) card.append(...caughtDetails(species, entry));
    else if (trail) card.append(...this.trailDetails(species, trail));
    else card.append(createElement('journal-where', hintText(species)));
    return card;
  }

  /** Légendaire pas encore attrapé : les indices déjà trouvés, et comment trouver les autres. */
  private trailDetails(species: FishSpecies, trail: Trail): HTMLElement[] {
    const clues = this.deps.trails.clues(species.id);
    const complete = clues.length >= CLUE_KINDS.length;
    const rule = complete ? TEXTS.trail.complete : TEXTS.trail.missing(placeById(species.place).at);
    return [
      createElement('journal-trail', TEXTS.trail.progress(clues.length, CLUE_KINDS.length)),
      ...clues.map((kind) => clueLine(species, trail, kind)),
      createElement('journal-where', rule),
    ];
  }

  private thumbnail(species: FishSpecies, silhouette: boolean): HTMLImageElement {
    const image = document.createElement('img');
    image.className = 'journal-thumb';
    image.alt = '';
    void this.deps.thumbnails.get(species, silhouette).then((url) => (image.src = url));
    return image;
  }
}

/**
 * Les quatre objectifs de l'espèce : remplis en couleur, les autres pâles.
 * Les tailles des paliers ne sont révélées qu'une fois l'espèce attrapée.
 */
function objectivesRow(species: FishSpecies, entry: JournalEntry | undefined): HTMLElement {
  const done = new Set(achievedObjectives(species, entry));
  const row = createElement('journal-objectives');
  for (const objective of OBJECTIVES) {
    const { icon, name } = TEXTS.objectives[objective];
    const sized = entry && (objective === 'nice' || objective === 'trophy');
    const detail = sized ? TEXTS.journal.threshold(tierThresholdCm(species, objective)) : '';
    const badge = createElement(`journal-objective${done.has(objective) ? ' is-done' : ''}`, detail ? `${icon} ${detail}` : icon);
    badge.title = objective === 'variant' && done.has(objective) ? species.variant.name : detail ? `${name}${TEXTS.colon}${detail}` : name;
    row.append(badge);
  }
  return row;
}

/** Un indice de la piste : ce qu'il apprend, puis le message de la bouteille. */
function clueLine(species: FishSpecies, trail: Trail, kind: ClueKind): HTMLElement {
  const line = createElement('journal-clue');
  line.append(createElement('journal-clue-fact', clueFact(species, kind)), createElement('journal-clue-message', TEXTS.quote(trail.messages[kind])));
  return line;
}

/** Ce qu'un indice révèle : où vit le poisson, quand il sort, ou ce qui l'attire. */
function clueFact(species: FishSpecies, kind: ClueKind): string {
  switch (kind) {
    case 'where':
      return `📍 ${habitatText(species)}`;
    case 'when':
      return `${timeText(species)} · ${TEXTS.trail.fullMoon}`;
    case 'bait':
      return `${favoriteBaits(species)} · ${WEATHERS[species.weather].icon} ${WEATHERS[species.weather].name}`;
  }
}

/** Appâts préférés d'une espèce (« 🪱 Ver de terre, 🌽 Grain de maïs »). */
function favoriteBaits(species: FishSpecies): string {
  return BAITS.filter((bait) => species.baits.includes(bait.id))
    .map((bait) => `${bait.icon} ${bait.name}`)
    .join(', ');
}

/** Détails d'une espèce déjà attrapée. */
function caughtDetails(species: FishSpecies, entry: JournalEntry): HTMLElement[] {
  const variant = entry.variant ? [createElement('journal-variant', TEXTS.journal.variantName(species.variant.name))] : [];
  const mastery = createElement('journal-mastery', masteryText(species, entry.count));
  mastery.title = TEXTS.mastery.title;
  return [
    ...variant,
    createElement('journal-record', `${TEXTS.journal.record}${TEXTS.colon}${formatSize(entry.bestSizeCm)} · ${TEXTS.journal.caughtTimes(entry.count)}`),
    mastery,
    createElement('journal-where', `${habitatText(species)} · ${timeText(species)}`),
    createElement('journal-description', species.description),
    createElement('journal-meta', `${TEXTS.journal.favoriteBaits}${TEXTS.colon}${favoriteBaits(species)}`),
    createElement('journal-meta', `${TEXTS.journal.favoriteWeather}${TEXTS.colon}${WEATHERS[species.weather].icon} ${WEATHERS[species.weather].name}`),
    createElement('journal-meta', `${TEXTS.journal.firstCatch} ${formatDate(entry.firstCaughtAt)}`),
  ];
}

function chip(text: string): HTMLElement {
  return createElement('journal-chip', text);
}
