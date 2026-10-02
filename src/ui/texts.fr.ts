import type { KeyHints } from '../core/controls';
import type { TimeSlot } from '../core/gameClock';
import type { Rarity } from '../data/fish';
import type { EscapeReason, FishingState } from '../fishing/fishingState';
import type { ShopCategory } from '../data/shop';
import type { Objective } from '../progression/objectives';
import type { ZoneType } from '../scene/levelLoader';

/** « 1ᵉʳ », « 2ᵉ », « 3ᵉ »… */
const ordinal = (rank: number): string => (rank === 1 ? '1ᵉʳ' : `${rank}ᵉ`);

/**
 * Tous les textes affichés au joueur, en français. La version anglaise
 * (texts.en.ts) a exactement la même forme : toute entrée ajoutée ici doit
 * l'être aussi là-bas (le compilateur le vérifie).
 */
export const FR = {
  /** Séparateur avant une valeur (« Record : 42 cm ») : en français, une espace avant les deux-points. */
  colon: ' : ',
  /** Format des dates (voir formatDate dans texts.ts). */
  dateLocale: 'fr-FR',
  /** Paroles rapportées (ce que dit Moustache d'une trouvaille). */
  quote: (text: string): string => `« ${text} »`,

  /** Invite en bas de l'écran, selon l'état de la pêche (au repos, elle cite les touches actuelles). */
  prompts: {
    IDLE: (k: KeyHints): string => `Clic sur l’eau : lancer · ${k.move} : ramer (${k.sprint} : plus vite) · ${k.cabin} : Moustache · ${k.journal} : carnet · Échap : menu`,
    CHARGING: 'Vise avec la souris, relâche pour lancer · Échap : annuler',
    CASTING: '',
    WAITING: 'Patience… · Clic : ramener la ligne',
    BITE: 'Ça mord ! Clique pour ferrer !',
    REELING: 'Clic maintenu : mouliner · Relâche quand la ligne est trop tendue',
    CAUGHT: '',
    ESCAPED: '',
  } satisfies Record<FishingState, string | ((keys: KeyHints) => string)>,

  /** Mêmes invites sur écran tactile. */
  touchPrompts: {
    IDLE: 'Touche l’eau : lancer · Joystick : ramer (à fond : plus vite)',
    CHARGING: 'Glisse pour ajuster (haut : plus loin), lâche pour lancer',
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
      [`${k.sprint} en ramant`, 'Ramer plus fort'],
      ['Clic sur l’eau (maintenir pour ajuster)', 'Lancer là où pointe la souris'],
      ['Clic quand ça mord', 'Ferrer'],
      ['Clic maintenu', 'Mouliner (relâcher si la ligne est trop tendue)'],
      ['1 à 6', 'Changer d’appât'],
      [k.journal, 'Carnet'],
      [k.cabin, 'Ponton de Moustache (demandes, trouvailles, vivier, boutique)'],
      ['Passer sur un éclat doré', 'Repêcher une trouvaille (à montrer à Moustache)'],
      [k.keep, 'Garder la prise au vivier'],
      ['Échap', 'Pause'],
    ],
    /** Au-dessus du choix de la langue, sur l'écran titre. */
    language: 'Langue',
    touchControls: [
      ['Joystick (en bas à gauche)', 'Ramer (poussé à fond : plus vite)'],
      ['Toucher l’eau (glisser pour ajuster)', 'Lancer là où tu touches'],
      ['Toucher quand ça mord', 'Ferrer'],
      ['Doigt maintenu', 'Mouliner (lâcher si la ligne est trop tendue)'],
      ['Boutons en haut à droite', 'Appât, Moustache, carnet et menu'],
      ['Passer sur un éclat doré', 'Repêcher une trouvaille (à montrer à Moustache)'],
    ] as readonly (readonly [string, string])[],
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
    buttonTitle: (key: string): string => `Ponton de Moustache : demandes, trouvailles et boutique (${key})`,
    title: 'Le ponton de Moustache',
    closeHint: (key: string): string => `${key} ou Échap pour fermer`,
    tabs: { requests: 'Demandes', finds: 'Trouvailles', pen: 'Vivier', shop: 'Boutique', map: 'Carte' },
    finds: {
      intro: 'Des choses flottent dans les recoins : un éclat doré les trahit de loin. Passe dessus avec la barque, puis montre-les-moi !',
      examined: 'Voyons ce que tu rapportes…',
      left: (count: number, at: string): string =>
        `🎁 Aujourd’hui, ${count} trouvaille${count > 1 ? 's flottent' : ' flotte'} encore ${at}.`,
      allPicked: (at: string): string => `🎁 Tu as tout repêché ${at} pour aujourd’hui. D’autres arriveront demain.`,
      none: (at: string): string => `Rien ne flotte ${at}.`,
      isNew: 'Nouvelle trouvaille !',
      again: 'Déjà dans la collection',
      collection: (name: string, found: number, total: number): string => `${name} · ${found} / ${total}`,
      unknown: '???',
      unknownHint: (at: string): string => `Quelque chose qui flotte ${at}…`,
      rareHint: (at: string): string => `Un objet rare, ${at}…`,
      count: (count: number): string => `× ${count}`,
    },
    greeting: 'Miaou ! Voilà ce qui me ferait plaisir :',
    allDone: 'Merci pour tout ! Reviens demain, j’aurai de nouvelles envies.',
    empty: 'Moustache fait la sieste… (aucune demande possible pour l’instant)',
    newRequests: 'Moustache a de nouvelles demandes ! 🐈',
    progress: (done: number, count: number): string => `${done} / ${count}`,
    done: 'Accomplie ✓',
    rule: 'Chaque jour, les demandes accomplies sont remplacées. Celles en cours t’attendent, sans se presser.',
    journalRewards: (rewards: Record<Objective, number>): string =>
      `Le carnet rapporte aussi des coquillages : nouvelle espèce ${rewards.caught}, beau poisson ${rewards.nice}, trophée ${rewards.trophy}, variante rare ${rewards.variant}.`,
    masteryRewards: (rewards: readonly number[]): string =>
      `Et plus tu attrapes une espèce, mieux tu la connais : trois étoiles de maîtrise par poisson, qui rapportent ${rewards.join(', ')} coquillages.`,
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
      intro: 'Tout se paie en coquillages. Rien ne presse : Moustache garde tout de côté. Les objets marqués 🏅 ne s’achètent pas : ils se gagnent.',
      sections: {
        bait: 'Appâts',
        gear: 'Matériel',
        pen: 'Vivier',
        boat: 'Barque et rames',
        decor: 'Décoration',
        outfit: 'Tenue du pêcheur',
      } satisfies Record<ShopCategory, string>,
      owned: 'Acquis ✓',
      equipped: 'Utilisé',
      equip: 'Utiliser',
      locked: (name: string): string => `Après : ${name}`,
      price: (price: number): string => `${price} 🐚`,
    },
    bought: (name: string): string => `Acheté : ${name} !`,
    newBait: (name: string, key: number): string => `Nouvel appât : ${name} (touche ${key})`,
  },

  /** Essai d'un objet de la boutique sur la barque ou le pêcheur. */
  fitting: {
    try: 'Essayer 👀',
    title: (name: string): string => `Essai : ${name}`,
    buy: (price: number): string => `Acheter ${price} 🐚`,
    back: 'Revenir',
    equipped: 'Déjà utilisé',
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
        mouse: (): string => 'Miaou ! Moi, c’est Moustache. Pour lancer, clique sur l’eau, là où tu veux pêcher. Garde le clic enfoncé pour ajuster, puis relâche.',
        touch: 'Miaou ! Moi, c’est Moustache. Pour lancer, touche l’eau, là où tu veux pêcher. Glisse ton doigt pour ajuster, puis lâche.',
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
          `Rame avec ${k.move} ou les flèches (${k.sprint} pour aller plus vite) : roseaux, rochers et eau profonde cachent d’autres poissons. Un poisson qui saute ou des bulles ? Lance juste à côté !`,
        touch: 'Rame avec le joystick en bas à gauche (pousse-le à fond pour aller plus vite) : roseaux, rochers et eau profonde cachent d’autres poissons. Un poisson qui saute ou des bulles ? Lance juste à côté !',
      },
      cabin: {
        mouse: (k: KeyHints): string =>
          `Et passe me voir au ponton (touche ${k.cabin}) : demandes, vivier, boutique et même une carte. Si un éclat doré brille sur l’eau, rame dessus et rapporte-moi ce qui flotte. Bonne pêche !`,
        touch: 'Et passe me voir au ponton (bouton 🐈) : demandes, vivier, boutique et même une carte. Si un éclat doré brille sur l’eau, rame dessus et rapporte-moi ce qui flotte. Bonne pêche !',
      },
    },
    tips: {
      early: 'Trop tôt ! Attends que le bouchon plonge vraiment. Relance, je te regarde.',
      missed: 'Un peu tard… Au prochain « ! », sois plus rapide. Relance !',
      snapped: 'Crac ! Relâche plus tôt quand la tension monte. On recommence ?',
      cancel: 'Pas grave : relance quand tu veux.',
    } satisfies Record<EscapeReason, string>,
  },

  /** Trouvailles repêchées par la barque. */
  finds: {
    picked: '🎁 Tu repêches quelque chose… Montre-le à Moustache ! (🐈)',
  },

  /** Carnet de bord : un tampon par jour où l'on pêche (`count` : nombre de jours de pêche). */
  logbook: {
    reward: (count: number): string => `📅 Carnet de bord · ${ordinal(count)} jour de pêche`,
    bonusReward: (count: number): string => `📅 Carnet de bord · ${ordinal(count)} jour de pêche, bravo !`,
    title: (count: number): string => `📅 Carnet de bord · ${count} jour${count > 1 ? 's' : ''} de pêche`,
    days: (count: number): string => `📅 ${count} jour${count > 1 ? 's' : ''} de pêche`,
    todo: (shells: number): string => `Attrape un poisson aujourd’hui pour ton tampon du jour (+${shells} 🐚).`,
    done: 'Tampon du jour obtenu ✓',
    next: (days: number, bonus: number): string =>
      `Encore ${days} jour${days > 1 ? 's' : ''} de pêche pour le bonus de ${bonus} 🐚. Rien ne presse : un jour sauté ne fait rien perdre.`,
    bonusToday: 'Rangée complète : bonus gagné ! Une nouvelle rangée commence demain.',
  },

  /** Exploits : ce qu'il faut accomplir pour gagner les objets exclusifs de la boutique (`of` : « du lac »). */
  feats: {
    icon: '🏅',
    legend: (of: string): string => `Attrape le poisson légendaire ${of}`,
    finds: (of: string): string => `Rapporte toutes les trouvailles ${of} à Moustache`,
    stars: (count: number): string => `Gagne ${count} étoiles de maîtrise`,
    journal: 'Attrape toutes les espèces du carnet',
    stamps: (count: number): string => `Pêche ${count} jours différents (carnet de bord)`,
    progress: (done: number, total: number): string => `${done} / ${total}`,
    earned: (name: string): string => `🏅 Exploit accompli ! Tu gagnes : ${name}. Il t’attend à la boutique de Moustache (🐈).`,
  },

  /** Maîtrise d'une espèce : trois étoiles gagnées au nombre de prises (`stars` : « ★★☆ »). */
  mastery: {
    progress: (stars: string, count: number, next: number): string => `${stars} ${count} / ${next} prises`,
    done: (stars: string): string => `${stars} Espèce maîtrisée`,
    reward: (stars: string): string => `Maîtrise ${stars}`,
    total: (stars: number, total: number): string => `★ ${stars} / ${total} étoiles`,
    title: 'Maîtrise : une étoile de plus à force de prises, avec des coquillages à chaque étoile',
  },

  /** Conseil de Moustache après plusieurs prises sans nouvelle espèce (où, quand, puis l'appât). */
  tip: {
    now: (where: string): string => `🐈 Psst ! Un poisson que tu ne connais pas rôde ${where}, en ce moment même.`,
    later: (where: string, when: string): string => `🐈 Psst ! Un poisson que tu ne connais pas rôde ${where}, ${when}.`,
    bait: (bait: string): string => `Il aime : ${bait}.`,
  },

  /** Piste d'un poisson légendaire : trois indices, trouvés dans des bouteilles à message. */
  trail: {
    found: (count: number, total: number): string =>
      `🍾 Une bouteille à message flottait à côté ! Indice ${count} / ${total} sur un poisson légendaire : ouvre ton carnet (📔).`,
    progress: (count: number, total: number): string => `🍾 Piste : ${count} / ${total} indices`,
    /** Sous les indices du carnet, tant qu'il en manque. */
    missing: (at: string): string =>
      `Les indices sont dans des bouteilles à message : une par jour ${at}, repêchée avec ta première trouvaille. Chaque indice le fait aussi mordre plus souvent.`,
    complete: 'Piste complète : tu sais tout, et il mord bien plus souvent. À toi de jouer !',
    fullMoon: '🌕 Pleine lune',
    /** Onglet « Trouvailles » du ponton. */
    bottleWaiting: (at: string): string => `🍾 Une bouteille à message flotte aussi ${at} aujourd’hui : elle parle d’un poisson légendaire.`,
    bottleFound: '🍾 Bouteille à message du jour trouvée : l’indice est dans ton carnet. La prochaine arrivera demain.',
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
    quality: 'Qualité graphique',
    qualities: { auto: 'Auto', low: 'Basse', medium: 'Moyenne', high: 'Haute' },
    /** Sous le choix, en mode automatique. */
    qualityAutoNow: (level: string): string => `Automatique : ${level.toLowerCase()} en ce moment (elle baisse si le jeu rame).`,
    qualityLowered: (level: string): string => `Qualité graphique réduite (${level.toLowerCase()}) pour garder le jeu fluide.`,
    showFps: 'Images par seconde',
    fps: (fps: number, level: string): string => `${Math.round(fps)} i/s · ${level}`,
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
      sprint: 'Ramer plus fort',
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
  /** Au-dessus de la jauge de visée : zone visée et distance. */
  aimLabel: (zone: string, meters: number): string => `${zone} · ${Math.round(meters)} m`,
  hooked: 'Ferré !',
  baitLocked: 'Ramène d’abord ta ligne pour changer d’appât.',
  loadError: 'Oups, le lac n’a pas pu se charger. Détails dans la console.',
  assetStatus: (placeholderLevel: boolean, warnings: number) =>
    `${placeholderLevel ? 'Niveau placeholder · ' : ''}${warnings} avertissement${warnings > 1 ? 's' : ''} d’assets (voir la console)`,
};

/** Forme des textes : la même dans toutes les langues. */
export type Texts = typeof FR;
