import type { KeyHints } from '../core/controls';
import type { TimeSlot } from '../core/gameClock';
import type { Rarity } from '../data/fish';
import type { EscapeReason, FishingState } from '../fishing/fishingState';
import type { ShopCategory } from '../data/shop';
import type { Objective } from '../progression/objectives';
import type { ZoneType } from '../scene/levelLoader';

/** Tous les textes affichés au joueur, regroupés pour les retoucher facilement. */
export const TEXTS = {
  /** Invite en bas de l'écran, selon l'état de la pêche (au repos, elle cite les touches actuelles). */
  prompts: {
    IDLE: (k: KeyHints): string => `Clic maintenu : lancer · ${k.move} : ramer · ${k.cabin} : Moustache · ${k.journal} : carnet · Échap : menu`,
    CHARGING: 'Relâche pour lancer · Échap : annuler',
    CASTING: '',
    WAITING: 'Patience… · Clic : ramener la ligne',
    BITE: 'Ça mord ! Clique pour ferrer !',
    REELING: 'Clic maintenu : mouliner · Relâche quand la ligne est trop tendue',
    CAUGHT: '',
    ESCAPED: '',
  } satisfies Record<FishingState, string | ((keys: KeyHints) => string)>,

  /** Mêmes invites sur écran tactile. */
  touchPrompts: {
    IDLE: 'Doigt maintenu sur l’eau : lancer · Joystick : ramer',
    CHARGING: 'Glisse pour viser, lâche pour lancer',
    CASTING: '',
    WAITING: 'Patience… · Touche : ramener la ligne',
    BITE: 'Ça mord ! Touche vite pour ferrer !',
    REELING: 'Doigt maintenu : mouliner · Lâche si la ligne est trop tendue',
    CAUGHT: '',
    ESCAPED: '',
  } satisfies Record<FishingState, string>,

  zones: {
    open: 'Eau libre',
    shallow: 'Eau peu profonde',
    deep: 'Eau profonde',
    reeds: 'Roseaux',
    rocks: 'Rochers',
  } satisfies Record<ZoneType | 'open', string>,

  escape: {
    cancel: 'Ligne ramenée.',
    early: 'Trop tôt ! Ce n’était qu’une petite touche.',
    missed: 'Raté… le poisson est reparti.',
    snapped: 'Crac ! La ligne a cassé… le poisson file.',
  } satisfies Record<EscapeReason, string>,

  slots: {
    dawn: { icon: '🌅', name: 'Aube' },
    day: { icon: '☀️', name: 'Jour' },
    dusk: { icon: '🌇', name: 'Crépuscule' },
    night: { icon: '🌙', name: 'Nuit' },
  } satisfies Record<TimeSlot, { icon: string; name: string }>,

  rarity: {
    common: 'Commun',
    uncommon: 'Peu commun',
    rare: 'Rare',
    legendary: 'Légendaire',
  } satisfies Record<Rarity, string>,

  reel: {
    tension: 'Tension',
    release: '⚠ Relâche !',
  },

  /** Objectifs du carnet (4 par espèce). */
  objectives: {
    caught: { icon: '🎣', name: 'Nouvelle espèce' },
    nice: { icon: '🥈', name: 'Beau poisson' },
    trophy: { icon: '🏆', name: 'Trophée' },
    variant: { icon: '✨', name: 'Variante rare' },
  } satisfies Record<Objective, { icon: string; name: string }>,

  shells: {
    icon: '🐚',
    count: (count: number): string => `${count} coquillage${count > 1 ? 's' : ''}`,
    title: 'Coquillages : gagnés au carnet et aux demandes de Moustache, à dépenser à sa cabane',
    gain: (count: number): string => `+${count} 🐚`,
  },

  catch: {
    newSpecies: 'Nouvelle espèce !',
    record: 'Nouveau record !',
    nice: 'Beau poisson',
    trophy: 'Trophée !',
    variant: '✨ Variante rare !',
    requestReward: 'Demande de Moustache',
    dailyReward: '⭐ Poisson du jour',
    keep: 'Garder au vivier 🐟',
    keepKey: (key: string): string => `Garder au vivier 🐟 (${key})`,
    kept: 'Au vivier ✓',
    penFull: 'Vivier plein',
    continue: 'Clic ou Espace pour continuer',
    touchContinue: 'Touche l’écran pour continuer',
  },

  journal: {
    title: 'Carnet de pêche',
    button: '📔',
    buttonTitle: (key: string): string => `Carnet de pêche (${key})`,
    close: 'Fermer',
    closeHint: (key: string): string => `${key} ou Échap pour fermer`,
    unknownName: '???',
    hint: 'Indice',
    record: 'Record',
    caughtTimes: (count: number): string => `${count} prise${count > 1 ? 's' : ''}`,
    species: (caught: number, total: number): string => `${caught} / ${total} espèces`,
    totalCatches: (count: number): string => `${count} prise${count > 1 ? 's' : ''} au total`,
    biggest: 'Plus grosse prise',
    playTime: 'Temps au bord de l’eau',
    objectives: (done: number, total: number): string => `Objectifs : ${done} / ${total}`,
    threshold: (cm: number): string => `${cm} cm`,
    variantName: (name: string): string => `✨ ${name}`,
    firstCatch: 'Première prise le',
    favoriteBaits: 'Appâts préférés',
    favoriteWeather: 'Temps préféré',
  },

  menu: {
    /** Nom du jeu (écran titre ; aussi dans index.html et assets/manifest.webmanifest). */
    logo: 'Au fil de l’eau',
    tagline: 'Un petit lac, une barque, et tout le temps du monde.',
    play: 'Jouer',
    continue: 'Continuer',
    progress: (species: number, total: number, catches: number): string =>
      `${species} / ${total} espèces · ${catches} prise${catches > 1 ? 's' : ''}`,
    settings: 'Réglages',
    pause: 'Pause',
    resume: 'Reprendre',
    journal: 'Carnet',
    back: 'Retour',
    button: '☰',
    buttonTitle: 'Menu (Échap)',
    cabin: 'Ponton de Moustache',
    map: 'Carte des lieux',
    controlsTitle: 'Commandes',
    controls: (k: KeyHints): (readonly [string, string])[] => [
      [`${k.move} ou flèches`, 'Ramer'],
      ['Clic maintenu, puis relâcher', 'Lancer (la souris vise)'],
      ['Clic quand ça mord', 'Ferrer'],
      ['Clic maintenu', 'Mouliner (relâcher si la ligne est trop tendue)'],
      ['1 à 6', 'Changer d’appât'],
      [k.journal, 'Carnet'],
      [k.cabin, 'Ponton de Moustache (demandes, vivier, boutique)'],
      [k.keep, 'Garder la prise au vivier'],
      ['Échap', 'Pause'],
    ],
    touchControls: [
      ['Joystick (en bas à gauche)', 'Ramer'],
      ['Doigt maintenu, puis lâcher', 'Lancer (le doigt vise)'],
      ['Toucher quand ça mord', 'Ferrer'],
      ['Doigt maintenu', 'Mouliner (lâcher si la ligne est trop tendue)'],
      ['Boutons en haut à droite', 'Appât, Moustache, carnet et menu'],
    ] as const,
  },

  /** Le jeu comme application (PWA) : installation, mise à jour, hors connexion. */
  pwa: {
    install: 'Installer le jeu',
    iosHint: 'Pour l’installer sur iPhone ou iPad : bouton Partager, puis « Sur l’écran d’accueil ».',
    updateReady: 'Une nouvelle version du jeu est prête.',
    update: 'Mettre à jour',
    offlineReady: 'Le jeu est prêt : il se lancera même sans connexion.',
  },

  /** Ponton de Moustache : demandes et boutique. */
  cabin: {
    button: '🐈',
    buttonTitle: (key: string): string => `Ponton de Moustache : demandes et boutique (${key})`,
    title: 'Le ponton de Moustache',
    closeHint: (key: string): string => `${key} ou Échap pour fermer`,
    tabs: { requests: 'Demandes', pen: 'Vivier', shop: 'Boutique', map: 'Carte' },
    greeting: 'Miaou ! Voilà ce qui me ferait plaisir :',
    allDone: 'Merci pour tout ! Reviens demain, j’aurai de nouvelles envies.',
    empty: 'Moustache fait la sieste… (aucune demande possible pour l’instant)',
    newRequests: 'Moustache a de nouvelles demandes ! 🐈',
    progress: (done: number, count: number): string => `${done} / ${count}`,
    done: 'Accomplie ✓',
    rule: 'Chaque jour, les demandes accomplies sont remplacées. Celles en cours t’attendent, sans se presser.',
    journalRewards: (rewards: Record<Objective, number>): string =>
      `Le carnet rapporte aussi des coquillages : nouvelle espèce ${rewards.caught}, beau poisson ${rewards.nice}, trophée ${rewards.trophy}, variante rare ${rewards.variant}.`,
    requests: {
      any: (count: number): string => `Attrape ${count} poissons, n’importe lesquels`,
      slot: (count: number, when: string): string => `Attrape ${count} poissons ${when}`,
      habitat: (count: number, where: string): string => `Attrape ${count} poissons ${where}`,
      rarity: 'Attrape un poisson peu commun, rare ou légendaire',
      species: (name: string): string => `Attrape : ${name}`,
      unknownSpecies: (hint: string): string => `Un poisson encore inconnu (${hint})`,
      size: (name: string, cm: number): string => `${name} d’au moins ${cm} cm`,
    },
    when: { dawn: 'à l’aube', day: 'en plein jour', dusk: 'au crépuscule', night: 'la nuit' } satisfies Record<TimeSlot, string>,
    where: {
      open: 'en eau libre',
      shallow: 'en eau peu profonde',
      deep: 'en eau profonde',
      reeds: 'dans les roseaux',
      rocks: 'près des rochers',
    } satisfies Record<ZoneType | 'open', string>,
    daily: (name: string, reward: number): string =>
      `⭐ Poisson du jour : ${name}. Il mord plus souvent aujourd’hui, et le premier rapporte ${reward} 🐚.`,
    dailyClaimed: (name: string): string => `⭐ Poisson du jour : ${name}. Bonus gagné, bravo ! Il mord toujours plus souvent.`,
    dailyUnknown: (hint: string): string => `un poisson encore inconnu (${hint})`,
    pen: {
      places: (count: number, capacity: number): string => `${count} / ${capacity} places`,
      empty: 'Le vivier est vide. Sur la carte de prise, « Garder au vivier » (touche V) y met ton poisson.',
      noPen: 'Le vivier n’est pas ici : tes poissons gardés t’attendent au lac.',
      view: 'Aller voir le vivier 👀',
      release: 'Relâcher',
      released: (name: string): string => `${name} retourne au lac. 🌊`,
      since: (date: string): string => `au vivier depuis le ${date}`,
    },
    shop: {
      intro: 'Tout se paie en coquillages. Rien ne presse : Moustache garde tout de côté.',
      sections: { bait: 'Appâts', gear: 'Matériel', pen: 'Vivier', decor: 'Décoration' } satisfies Record<ShopCategory, string>,
      owned: 'Acquis ✓',
      equipped: 'Utilisé',
      equip: 'Utiliser',
      locked: (name: string): string => `Après : ${name}`,
      price: (price: number): string => `${price} 🐚`,
    },
    bought: (name: string): string => `Acheté : ${name} !`,
    newBait: (name: string, key: number): string => `Nouvel appât : ${name} (touche ${key})`,
  },

  /** Vue rapprochée du vivier. */
  penView: {
    title: (count: number): string => `🐟 Le vivier · ${count} poisson${count > 1 ? 's' : ''}`,
    back: 'Revenir',
  },

  /** Tutoriel de Moustache (premier lancement) : texte souris / clavier et texte tactile. */
  tutorial: {
    skip: 'Passer',
    progress: (step: number, total: number): string => `${step} / ${total}`,
    steps: {
      cast: {
        mouse: (): string => 'Miaou ! Moi, c’est Moustache. Pour lancer, maintiens le clic sur l’eau, puis relâche : plus tu tiens, plus ça part loin.',
        touch: 'Miaou ! Moi, c’est Moustache. Pour lancer, garde ton doigt sur l’eau, puis lâche : plus tu tiens, plus ça part loin.',
      },
      strike: {
        mouse: (): string => 'Patience… Le bouchon frémit parfois : ce n’est rien. Quand il plonge et qu’un « ! » apparaît, clique vite pour ferrer !',
        touch: 'Patience… Le bouchon frémit parfois : ce n’est rien. Quand il plonge et qu’un « ! » apparaît, touche vite l’écran pour ferrer !',
      },
      reel: {
        mouse: (): string => 'Il est ferré ! Maintiens le clic pour mouliner. Si la jauge de tension rougit, relâche un peu : le poisson tire par à-coups.',
        touch: 'Il est ferré ! Garde ton doigt posé pour mouliner. Si la jauge de tension rougit, lâche un peu : le poisson tire par à-coups.',
      },
      caught: {
        mouse: (k: KeyHints): string =>
          `Bravo, ta première prise ! Elle rejoint ton carnet (touche ${k.journal}). Tu peux aussi la garder au vivier (touche ${k.keep}). Clique pour continuer.`,
        touch: 'Bravo, ta première prise ! Elle rejoint ton carnet (📔). Tu peux aussi la garder au vivier. Touche l’écran pour continuer.',
      },
      explore: {
        mouse: (k: KeyHints): string =>
          `Rame avec ${k.move} ou les flèches : roseaux, rochers et eau profonde cachent d’autres poissons. Un poisson qui saute ou des bulles ? Lance juste à côté !`,
        touch: 'Rame avec le joystick en bas à gauche : roseaux, rochers et eau profonde cachent d’autres poissons. Un poisson qui saute ou des bulles ? Lance juste à côté !',
      },
      cabin: {
        mouse: (k: KeyHints): string => `Et passe me voir au ponton (touche ${k.cabin}) : demandes, vivier, boutique et même une carte. Bonne pêche !`,
        touch: 'Et passe me voir au ponton (bouton 🐈) : demandes, vivier, boutique et même une carte. Bonne pêche !',
      },
    },
    tips: {
      early: 'Trop tôt ! Attends que le bouchon plonge vraiment. Relance, je te regarde.',
      missed: 'Un peu tard… Au prochain « ! », sois plus rapide. Relance !',
      snapped: 'Crac ! Relâche plus tôt quand la tension monte. On recommence ?',
      cancel: 'Pas grave : relance quand tu veux.',
    } satisfies Record<EscapeReason, string>,
  },

  /** Signes de poissons (sauts, bulles). */
  signs: {
    icon: '🐟',
    hotspot: '🐟 Joli coin : ça frétille par ici !',
  },

  /** Lieux de pêche et voyages. */
  places: {
    loading: (of: string): string => `Préparation ${of}…`,
    travel: (name: string): string => `En route vers ${name.toLowerCase()}…`,
    welcome: (at: string): string => `Bienvenue ${at} !`,
    unlocked: (name: string): string => `🗺️ Moustache connaît un nouveau coin : ${name.toLowerCase()} ! (ponton › Carte)`,
    here: 'Tu es ici',
    go: 'Y aller 🚣',
    locked: (caught: number, needed: number, fromOf: string): string =>
      `🔒 Attrape ${needed} espèces ${fromOf} pour que Moustache t’y emmène : ${caught} / ${needed}`,
    species: (caught: number, total: number): string => `${caught} / ${total} espèces`,
    elsewhere: (at: string): string => `(${at})`,
  },

  /** Rendez-vous rares : poisson du jour, pleine lune. */
  rendezvous: {
    dailyFish: (name: string): string => `⭐ Poisson du jour : ${name}`,
    fullMoon: (legendary: string): string => `🌕 Nuit de pleine lune ! ${legendary} pourrait se montrer, et les variantes aussi…`,
    /** Phases de la lune, de la nouvelle lune (0) à la fin du dernier quartier. */
    moonIcons: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
    fullMoonTitle: 'Pleine lune',
  },

  settings: {
    title: 'Réglages',
    sound: 'Son',
    display: 'Affichage',
    game: 'Jeu',
    save: 'Partie',
    masterVolume: 'Volume général',
    sfxVolume: 'Effets',
    ambienceVolume: 'Ambiance du lac',
    musicVolume: 'Musique',
    shadows: 'Ombres',
    resolution: 'Définition',
    resolutionAuto: 'Pleine',
    resolutionEco: 'Économe',
    showHints: 'Aides à l’écran',
    showBiteAlert: '« ! » quand ça mord',
    dayLength: 'Durée d’une journée',
    minutes: (minutes: number): string => `${minutes} min`,
    replayTutorial: 'Revoir le tutoriel',
    comfort: 'Confort',
    textSize: 'Taille du texte',
    textSizes: { normal: 'Normale', large: 'Grande', huge: 'Très grande' },
    reduceMotion: 'Moins d’animations',
    easyHook: 'Ferrage facile (plus de temps)',
    bigBobber: 'Grand bouchon',
    stickSensitivity: 'Sensibilité du joystick',
    keyboard: 'Clavier',
    actions: {
      forward: 'Avancer',
      left: 'Tourner à gauche',
      backward: 'Reculer',
      right: 'Tourner à droite',
      journal: 'Carnet',
      cabin: 'Ponton de Moustache',
      keep: 'Garder au vivier',
    },
    pressKey: 'Appuie sur une touche… (Échap : annuler)',
    reservedKey: (key: string): string => `« ${key} » est réservée.`,
    takenKey: (key: string, action: string): string => `« ${key} » sert déjà : ${action}.`,
    resetKeys: 'Touches par défaut',
    arrowsNote: 'Les flèches marchent toujours pour ramer.',
    reset: 'Effacer la partie',
    resetConfirm: 'Vraiment tout effacer ? Cliquer pour confirmer',
  },

  noWater: 'Pas d’eau par là…',
  hooked: 'Ferré !',
  baitLocked: 'Ramène d’abord ta ligne pour changer d’appât.',
  loadError: 'Oups, le lac n’a pas pu se charger. Détails dans la console.',
  assetStatus: (placeholderLevel: boolean, warnings: number) =>
    `${placeholderLevel ? 'Niveau placeholder · ' : ''}${warnings} avertissement${warnings > 1 ? 's' : ''} d’assets (voir la console)`,
};

/** Taille lisible : « 42 cm ». */
export function formatSize(sizeCm: number): string {
  return `${Math.round(sizeCm)} cm`;
}

/** Durée lisible : « 12 min », « 1 h 05 ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Date lisible : « 29 septembre ». */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
