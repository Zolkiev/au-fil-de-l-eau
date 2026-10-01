import type { QualityLevel, QualitySetting } from './core/quality';

/**
 * Tous les paramètres réglables du jeu, regroupés ici pour pouvoir les
 * ajuster sans fouiller le code.
 *
 * Unités : mètres, secondes, radians (sauf mention contraire).
 * Les couleurs sont en hexadécimal sRGB (comme dans un sélecteur de couleur).
 */
export const CONFIG = {
  /** Chemins relatifs au dossier `assets/` (servi à la racine du site). */
  assets: {
    level: 'levels/lake_01.glb',
    boat: 'props/boat.glb',
    rod: 'props/rod.glb',
    bobber: 'props/bobber.glb',
    /** Moustache, le chat du ponton (placé sur l'Empty `npc_cat` du niveau). */
    cat: 'props/cat.glb',
    /** Le pêcheur, assis sur l'Empty `fisher_seat` de la barque. */
    fisher: 'props/fisher.glb',
    /** Dossier des poissons : un fichier `<id>.glb` par espèce (voir src/data/fish.ts). */
    fishFolder: 'fish/',
  },

  /**
   * Touches. Chaque liste peut contenir :
   *  - des lettres en minuscule (« w », « z ») : reconnues d'après le caractère
   *    tapé, donc WASD (par défaut) et ZQSD fonctionnent en même temps, quel
   *    que soit le clavier ;
   *  - des codes physiques (« ArrowUp », « Digit1 », « Escape »…) pour les
   *    autres touches (voir KeyboardEvent.code).
   */
  controls: {
    forward: ['w', 'z', 'ArrowUp'],
    backward: ['s', 'ArrowDown'],
    left: ['a', 'q', 'ArrowLeft'],
    right: ['d', 'ArrowRight'],
    /** Ramer plus fort, tant que la touche est maintenue. */
    sprint: ['ShiftLeft', 'ShiftRight'],
    toggleLevelHelpers: ['g'],
    journal: ['j'],
    /** Garder la prise au vivier (sur la carte de prise). */
    keep: ['v'],
    /** Ponton de Moustache : demandes et boutique. */
    cabin: ['c'],
    /** Échap annule une charge de lancer ; sinon il ouvre ou ferme le menu pause. */
    cancel: ['Escape'],
    confirm: ['Space', 'Enter', 'NumpadEnter'],
    /**
     * Une liste par place dans la barre d'appâts (appâts possédés, dans l'ordre
     * de src/data/baits.ts). Digit1 = touche « 1 » ou « & ».
     */
    baits: [
      ['Digit1', 'Numpad1'],
      ['Digit2', 'Numpad2'],
      ['Digit3', 'Numpad3'],
      ['Digit4', 'Numpad4'],
      ['Digit5', 'Numpad5'],
      ['Digit6', 'Numpad6'],
    ],
  },

  /** Écran tactile (voir src/core/pointerMode.ts et src/ui/touchStick.ts). */
  touch: {
    /** Joystick pour ramer : zone morte au centre (part du rayon, 0 → 1), par axe. */
    stickDeadZone: 0.18,
    /** Joystick poussé vers l'avant au-delà de cette part du rayon : on rame plus fort. */
    stickSprintZone: 0.9,
    /**
     * Visée du lancer au doigt : le point touché donne la direction et la
     * distance de départ, puis glisser vers le haut ou le bas règle la
     * distance finement (mètres par pixel d'écran).
     */
    aimMetersPerPixel: 0.11,
  },

  /** Horloge de jeu (le rendu jour/nuit arrivera en phase 4). */
  time: {
    /** Durée d'une journée complète en minutes réelles. */
    dayLengthMinutes: 12,
    /** Heure au lancement du jeu (7.5 = 7 h 30). */
    startHour: 7.5,
    /** Créneaux horaires des poissons : [début, fin[ en heures (un créneau peut passer minuit). */
    slots: {
      dawn: [5, 8],
      day: [8, 18],
      dusk: [18, 21],
      night: [21, 5],
    },
  },

  loop: {
    /** Pas de temps maximal d'une frame (évite les sauts après un onglet en pause). */
    maxDelta: 0.1,
  },

  boat: {
    /** Poussée des rames (m/s²). Vitesse de croisière ≈ acceleration / waterDrag. */
    acceleration: 1.5,
    /** Freinage de l'eau (1/s) : plus c'est grand, plus la barque s'arrête vite. */
    waterDrag: 0.45,
    maxForwardSpeed: 2.8,
    maxBackwardSpeed: 1.1,
    /**
     * Ramer fort (touche Maj, ou joystick poussé à fond), en marche avant :
     * × vitesse maximale, × poussée, × cadence des rames.
     */
    sprint: { speed: 1.75, acceleration: 2.2, strokeRate: 1.45 },
    /** Vitesse de rotation maximale (rad/s). */
    maxTurnSpeed: 0.8,
    /** Réactivité du gouvernail (1/s). */
    turnResponse: 2,
    /** Rayon du cercle de collision de la barque. */
    collisionRadius: 1.2,
    /** Freinage (1/s) quand la barque pousse contre un obstacle (berge, rocher…). */
    obstacleFriction: 3,
    /** Hauteur de l'origine de la barque au-dessus de la surface de l'eau. */
    floatHeight: 0,
  },

  /** Tangage procédural de la barque. Fréquences en Hz, amplitudes en m ou rad. */
  boatRocking: {
    bobAmplitude: 0.04,
    bobFrequency: 0.3,
    pitchAmplitude: 0.02,
    pitchFrequency: 0.17,
    rollAmplitude: 0.035,
    rollFrequency: 0.23,
    /** Inclinaison en virage (rad par rad/s de rotation). */
    turnLean: 0.1,
    /** Cabrage à l'accélération (rad par m/s²). */
    accelerationPitch: 0.03,
    /** Inclinaison dynamique maximale (virage, accélération, choc). */
    maxDynamicTilt: 0.08,
    /** Amorti des inclinaisons dynamiques (1/s). */
    smoothing: 3,
  },

  camera: {
    /** Champ de vision vertical (degrés). */
    fov: 55,
    /** Écran étroit (téléphone en portrait) : le champ s'élargit pour garder au moins cette largeur (degrés). */
    minHorizontalFov: 50,
    near: 0.1,
    far: 600,
    /**
     * Position de la caméra dans le repère de la barque (+Z = avant) quand le
     * niveau ne contient pas d'objet `cam_default`.
     */
    defaultOffset: { x: 0, y: 3.2, z: -7 },
    /** Point visé : hauteur au-dessus de la barque et distance devant elle. */
    lookHeight: 0.8,
    lookAhead: 3,
    /** Amorti du suivi (1/s) : plus c'est grand, plus la caméra colle à la barque. */
    followDamping: 2.5,
    lookDamping: 4,
    minHeightAboveWater: 0.6,
    /** Hauteur minimale au-dessus du décor (berges, arbres) : la caméra passe par-dessus. */
    minHeightAboveGround: 1.2,
    /** Quand la ligne est à l'eau, part du regard attirée vers le bouchon (0 → 1). */
    fishingFocusBlend: 0.5,
    /** Le cadrage sur le bouchon s'installe progressivement entre ces distances (m). */
    focusFadeDistance: { min: 2, max: 6 },
  },

  fishing: {
    /** Distance du lancer à 0 % et à 100 % de puissance. */
    minCastDistance: 4,
    maxCastDistance: 22,
    /** Vitesse à laquelle la canne part en arrière quand on arme le lancer (1/s). */
    chargeResponse: 9,
    /** Trajectoire affichée pendant la visée : nombre de points, et leur taille (m). */
    aimPath: { points: 20, size: 0.3 },
    /** Écart maximal (rad) entre la visée et l'axe de la caméra. */
    maxAimAngle: 1.3,
    /** Durée du vol du bouchon : base + par mètre parcouru (s). */
    flightTime: { base: 0.5, perMeter: 0.03 },
    /** Hauteur de l'arc du lancer : base + par mètre parcouru. */
    arcHeight: { base: 1, perMeter: 0.2 },
    /** Si le point visé n'est pas de l'eau libre, on raccourcit le lancer par pas de… */
    landingSearchStep: 0.5,
    /** Attente avant la vraie touche, tirée au hasard puis multipliée par les facteurs ci-dessous. */
    waitTime: { min: 4, max: 14 },
    minWaitTime: 2,
    /** Multiplicateur d'attente selon la zone (< 1 = ça mord plus vite). */
    zoneWaitFactor: { open: 1.3, shallow: 0.9, deep: 1.1, reeds: 0.85, rocks: 1 },
    /** Multiplicateur d'attente selon l'heure : [heure, facteur], interpolé, de 0 h à 24 h. */
    hourWaitFactor: [
      [0, 1.2],
      [5, 0.9],
      [7, 0.75],
      [10, 1],
      [14, 1.3],
      [18, 0.8],
      [21, 0.9],
      [24, 1.2],
    ],
    /** Fausses touches (le bouchon frémit) avant la vraie. */
    nibbles: { min: 1, max: 3, duration: 0.45, quietBeforeBite: 1.2 },
    /** Fenêtre pour ferrer après la vraie touche (s). */
    hookWindow: 0.8,
    /** Vitesse à laquelle on ramène une ligne vide (m/s). */
    retrieveSpeed: 9,
    /** Taille du bouchon (1 = taille réelle ; plus gros = plus lisible de loin). */
    bobberSize: 1.6,
    /** Intervalle entre deux cliquetis du moulinet (s). */
    reelTickInterval: 0.28,
  },

  /** Choix du poisson qui mord (données des espèces : src/data/fish.ts). */
  fishSelection: {
    /**
     * Poids de tirage selon la rareté, entre les espèces possibles à cet
     * endroit et à cette heure (réglés par simulation : environ 1 h de jeu pour
     * 8 espèces du lac ; le légendaire surtout les nuits de pleine lune).
     */
    rarityWeight: { common: 10, uncommon: 4, rare: 1.2, legendary: 0.12 },
    /** Multiplicateur si l'espèce aime l'appât utilisé… */
    likedBaitBonus: 2.5,
    /** … et sinon. */
    otherBaitFactor: 0.6,
    /** > 1 : les grandes tailles sont plus rares dans la fourchette de l'espèce. */
    sizeSkew: 1.5,
    /** Force effective selon la taille : × min pour la plus petite, × max pour la plus grande. */
    sizeStrength: { min: 0.8, max: 1.2 },
  },

  /**
   * Mini-jeu de remontée. Tension de 0 à 1 ; « force » = force du poisson
   * (0 → 1, un peu plus pour les très gros).
   */
  reel: {
    /** Vitesse de remontée en moulinant (m/s). */
    reelSpeed: 2,
    /** Distance à la pointe de la canne où le poisson est pris (m). */
    landDistance: 1.5,
    /** Le poisson peut reprendre jusqu'à ce nombre de mètres au-delà du point de ferrage. */
    maxExtraLine: 6,
    startTension: 0.2,
    /** Montée de la tension en moulinant (/s) : base + force × perStrength. */
    tensionRise: { base: 0.06, perStrength: 0.4 },
    /** Baisse de la tension quand on relâche (/s). */
    tensionFall: 0.5,
    /** Quand on ne mouline pas, le poisson s'éloigne à force × idlePull (m/s). */
    idlePull: 0.5,
    /** À-coups du poisson. */
    burst: {
      /** Tension ajoutée (/s, × force). */
      tension: 0.8,
      /** Ligne reprise par le poisson (m/s, × force). */
      pull: 1,
      /** Efficacité du moulinet pendant un à-coup. */
      reelFactor: 0.35,
      minDuration: 0.5,
      maxDuration: 1.1,
      /** Écart minimal entre deux à-coups (s). */
      minInterval: 0.8,
    },
    /** À partir de cette tension, la jauge se raye et affiche « Relâche ! ». */
    warningTension: 0.88,
    /** Temps passé à tension maximale avant que la ligne casse (s). */
    breakTime: 1.6,
    /** Vitesse à laquelle ce temps « se recharge » quand la tension redescend (× temps réel). */
    overloadRecovery: 0.7,
    /** Amplitude max des zigzags du poisson (m, × force). */
    wanderAmplitude: 2,
  },

  /**
   * Progression : objectifs du carnet, coquillages, demandes de Moustache
   * (src/progression/). Les prix de la boutique sont dans src/data/shop.ts.
   */
  progression: {
    /** Paliers de taille, en part de la fourchette de l'espèce (0 = la plus petite, 1 = la plus grande). */
    sizeTiers: { nice: 0.5, trophy: 0.85 },
    /** Chance qu'une prise soit la variante rare de l'espèce (× variantFactor de l'appât). */
    variantChance: 0.03,
    /** Coquillages gagnés par objectif du carnet (4 objectifs par espèce). */
    objectiveRewards: { caught: 3, nice: 2, trophy: 4, variant: 6 },
    requests: {
      /** Demandes affichées en même temps ; celles accomplies sont remplacées chaque jour (réel). */
      slots: 3,
      /** Chance de tirer chaque sorte de demande (poids relatifs). */
      weights: { any: 1, slot: 1.2, habitat: 1.2, rarity: 0.8, species: 1.5, size: 1 },
      /** Nombre de poissons demandés (min, max) pour les demandes « plusieurs poissons ». */
      counts: { any: [3, 5], slot: [2, 3], habitat: [2, 3] },
      /** Coquillages offerts ; espèce et taille selon la rareté (+ bonus de taille). */
      rewards: { any: 2, slot: 3, habitat: 3, rarity: 3, species: { common: 2, uncommon: 3, rare: 5 }, sizeBonus: 2 },
      /** Part des demandes d'espèce qui portent sur une espèce pas encore attrapée (s'il en reste). */
      unknownSpeciesChance: 0.5,
      /** Intervalle de vérification du changement de jour (s). */
      dayCheckSeconds: 30,
    },
  },

  /** Météo (src/core/weather.ts, src/scene/weatherEffects.ts). */
  weather: {
    /** Durée d'un temps, en heures de jeu (une heure = 30 s avec des journées de 12 min). */
    duration: { min: 3, max: 7 },
    /** Durée du fondu d'un temps à l'autre (heures de jeu). */
    transitionHours: 1,
    /** Chances de chaque temps au changement (poids relatifs). */
    chances: { clear: 5, rain: 2, mist: 3, wind: 1.5 },
    /** La brume ne peut se lever qu'entre ces heures. */
    mistHours: { from: 3, to: 8 },
    /** Effets sur la pêche : attente avant la touche, et poids des espèces qui aiment ce temps. */
    waitFactor: { clear: 1, rain: 0.8, mist: 1, wind: 1.15 },
    likedFactor: 2.2,
    /** Aspect : grisaille du ciel (0 → 1), lumière restante, brouillard (m), houle du vent (× vagues). */
    look: {
      rain: { grey: 0.55, light: 0.55, fogNear: 18, fogFar: 140 },
      mist: { grey: 0.45, light: 0.7, fogNear: 3, fogFar: 55 },
      windWaves: 2.2,
    },
    /** Pluie : gouttes autour de la caméra, et ronds sur l'eau (par seconde). */
    rain: { drops: 1400, area: 22, height: 12, speed: 13, length: 0.45, color: 0xd8e4ec, opacity: 0.65, ripples: 12 },
  },

  /** Tutoriel de Moustache (src/ui/tutorial.ts). */
  tutorial: {
    /** Étape « ramer » : finie après cette distance (m) ou ce temps (s). */
    explore: { distance: 12, seconds: 30 },
    /** Étape « ponton » : finie en ouvrant le ponton, ou après ce temps (s). */
    cabin: { seconds: 25 },
    /** Durée d'affichage d'un conseil après un raté (s). */
    tipSeconds: 6,
  },

  /** Décor vivant : vent dans les arbres et les roseaux, libellules, oiseaux (src/scene/windSway.ts, critters.ts). */
  decorLife: {
    /** Balancement (m) au sommet des objets `deco_*_sway` : par temps calme, et par grand vent. */
    swayAmount: { calm: 0.05, windy: 0.4 },
    /** Hauteur au-dessus du sol (m) à partir de laquelle le balancement est complet. */
    swayHeight: 2.5,
    /** Libellules au-dessus de chaque zone de roseaux, le jour. */
    dragonfliesPerZone: 4,
    /** Oiseaux qui tournent haut dans le ciel, le jour : nombre, altitude (m), rayon (m). */
    birds: 5,
    birdHeight: { min: 24, max: 36 },
    birdRadius: { min: 25, max: 45 },
  },

  /** Signes de poissons : sauts et bulles qui trahissent un bon coin (src/scene/fishSigns.ts). */
  signs: {
    /** Délai entre deux apparitions (s) ; nombre de coins actifs au maximum ; durée d'un coin (s). */
    interval: { min: 25, max: 50 },
    maxActive: 2,
    life: 45,
    /** Où ils apparaissent : distance à la barque (m) et écart à son cap (rad), pour rester à portée de lancer. */
    distance: { min: 8, max: 19 },
    arc: 1.3,
    /** Lancer à moins de ce rayon (m) d'un coin actif : attente × waitFactor, et × rarityBoost pour les poissons non communs. */
    radius: 3.5,
    waitFactor: 0.45,
    rarityBoost: 2,
    /** Sauts : écart entre deux (s), durée (s), hauteur et longueur (m). Bulles : écart entre deux (s). */
    jumpEvery: { min: 3, max: 6 },
    jumpDuration: 0.7,
    jumpHeight: 0.6,
    jumpLength: 1.4,
    bubbleEvery: { min: 0.25, max: 0.7 },
    /** Bulles affichables en même temps. */
    bubbles: 24,
    /** Volume du plouf d'un saut (× distance). */
    splashVolume: 0.35,
  },

  /** Durée du fondu avant de recharger la page pour changer de lieu (ms). */
  travelDelayMs: 900,

  /** Lumières de nuit du décor : lanternes, fenêtres, phare (src/scene/nightLights.ts). */
  nightLights: {
    /** Éclat des objets émissifs le jour, puis la nuit (× leur intensité dans Blender). */
    dayGlow: 0.15,
    nightGlow: 1.6,
    /** Halo : taille (× la plus grande dimension de l'objet), plafonnée (m), et opacité la nuit. */
    haloScale: 5,
    haloMax: 6,
    haloOpacity: 0.55,
    /**
     * Vraies lumières chaudes : `maxLights` au plus, données aux lanternes,
     * fenêtres et feux les plus proches de la barque. Une source n'éclaire
     * que si la barque est à moins de `reach.none` mètres (pleinement en
     * deçà de `reach.full`) ; `fade` : vitesse du fondu quand une lumière
     * change de source (1/s).
     */
    light: { color: 0xffc27a, intensity: 5, distance: 10 },
    maxLights: 3,
    reach: { full: 45, none: 70 },
    fade: 4,
    /** Faisceau du phare : longueur et rayon au bout (m), rotation (rad/s), inclinaison vers le bas (rad). */
    beacon: { color: 0xfff1c0, length: 70, radius: 6, speed: 0.5, tilt: 0.06, opacity: 0.2 },
  },

  /**
   * Effets du décor posés dans Blender (Empties `fx_*`) et éclaboussures
   * (src/scene/levelEffects.ts, campfire.ts, particles.ts). Débits en
   * particules par seconde, durées en secondes, tailles en mètres.
   */
  effects: {
    /** Au-delà de cette distance à la barque (m), un effet du décor n'émet plus rien. */
    range: 120,
    /** Fumée d'une cheminée (`fx_smoke_<n>`) : elle monte, grossit, pâlit, et dérive avec le vent. */
    smoke: { rate: 4.5, life: { min: 4, max: 6.5 }, rise: 0.75, spread: 0.12, size: 0.4, endSize: 1.8, color: 0xdcd9d2, alpha: 0.4, drift: 0.3 },
    /** Feu de camp (`fx_fire_<n>`) : flammes, étincelles, fumée légère, halo et lumière vacillante. */
    fire: {
      flameColors: [0xff6a14, 0xffa726, 0xffe27a],
      flameHeight: 0.62,
      flameRadius: 0.2,
      /** Vitesse du vacillement. */
      flicker: 9,
      sparks: { rate: 5, life: 1.5, rise: 1.3, size: 0.07, color: 0xffb060 },
      smoke: { rate: 2.2, alpha: 0.24, size: 0.3, endSize: 1.2 },
      glow: { color: 0xff9a3c, size: 2.8, opacity: 0.45 },
      /** Lumière du feu : `day` = part gardée en plein jour. */
      light: { color: 0xff9548, intensity: 9, day: 0.3 },
    },
    /** Embruns d'une cascade (`fx_mist_<n>`, échelle de l'Empty = rayon du nuage). */
    mist: { rate: 12, life: { min: 2.2, max: 3.6 }, rise: 0.6, size: 1.6, endSize: 4.4, color: 0xf4fbff, alpha: 0.32 },
    /** Éclaboussures : gouttes projetées (plouf du bouchon, saut d'un poisson, rames, étrave quand on rame fort). */
    splash: { drops: 14, size: 0.085, speed: 2.6, gravity: 9, color: 0xf4fbff, alpha: 0.9 },
    /** Gerbe à l'étrave à partir de cette vitesse (× la vitesse maximale sans sprint). */
    bowSprayFrom: 1.15,
    /** Nombre maximal de particules affichées : volutes (fumée, embruns), lueurs (étincelles), gouttes. */
    capacity: { puffs: 160, sparks: 48, drops: 96 },
  },

  /** Rames de la barque (src/scene/oars.ts). Angles en radians. */
  oars: {
    /** Coups de rame par seconde, à pleine commande. */
    strokeRate: 0.85,
    /** Balayage avant-arrière de la pelle, de part et d'autre. */
    sweep: 0.42,
    /** Plongée vers l'eau : pelle dans l'eau (poussée), levée (retour), au repos. */
    dipIn: 0.4,
    dipOut: 0.12,
    dipRest: 0.25,
    /** Rangées le long de la coque pendant la pêche. */
    stowSweep: 1.35,
    stowDip: 0.05,
    /** Réactivité (1/s). */
    response: 10,
    /** Distance du tolet au milieu de la pelle (m), pour les éclaboussures. */
    bladeDistance: 1.35,
    /** Volume du petit plouf de chaque coup de rame. */
    splashVolume: 0.12,
  },

  /** Le pêcheur de la barque (src/scene/fisher.ts). */
  fisher: {
    /** Réactivité des mains et de la tête (1/s). */
    handResponse: 12,
    headResponse: 4,
    /** Penché en avant au bout d'un coup de rame (rad). */
    rowLean: 0.3,
    /** Tête : rotation maximale pour suivre le bouchon (rad), sur les côtés et vers le bas. */
    headYaw: 1.0,
    headPitch: 0.45,
    /** Tours de manivelle par seconde quand on mouline. */
    reelTurns: 2.2,
    /** Main posée sur le genou au repos, et bras levés quand il attrape un poisson (repères du pêcheur et du buste). */
    knee: { x: 0.1, y: 0.16, z: 0.3 },
    cheer: { x: 0.3, y: 0.85, z: 0.1 },
    /** Longueur de l'avant-bras jusqu'au milieu de la main, si fisher.glb n'a pas d'Empty `fisher_hand_*`. */
    forearmLength: 0.275,
    /** Siège si boat.glb n'a pas d'Empty `fisher_seat` (repère de la barque). */
    fallbackSeat: { x: 0, y: 0.165, z: -0.55 },
  },

  /** Nuages qui dérivent dans le ciel (src/scene/clouds.ts). */
  clouds: {
    count: 22,
    /** Demi-côté (m) du carré, centré sur la caméra, dans lequel les nuages bouclent. */
    area: 420,
    /**
     * Altitude (m). Vus depuis la barque, les nuages doivent passer juste
     * au-dessus des collines, dans la bande de ciel visible : loin, assez
     * hauts et gros.
     */
    height: { min: 60, max: 95 },
    /** Longueur d'un nuage (m). */
    size: { min: 60, max: 110 },
    /** Dérive (m/s) et sa direction (rad) ; le vent la triple. */
    speed: 1.5,
    direction: 0.6,
    /** Part des nuages visibles par beau temps, puis sous la pluie ou dans la brume. */
    coverage: { clear: 0.55, overcast: 1 },
    /** Teinte des nuages quand le ciel se couvre. */
    overcastColor: 0x9aa3ad,
    /** Lueur du dessous des nuages (× couleur de l'horizon). */
    underGlow: 0.7,
  },

  /** Application installée (PWA, src/pwa/). */
  pwa: {
    /** Écart minimal entre deux recherches de mise à jour, au retour sur le jeu (minutes). */
    updateCheckMinutes: 30,
  },

  /** Rendez-vous rares : pleine lune et poisson du jour (src/progression/rendezvous.ts). */
  events: {
    /** Durée d'un cycle de la lune, en jours de jeu (pleine lune au milieu). */
    moonCycleDays: 6,
    /** Nuit de pleine lune : les légendaires et les variantes sortent plus souvent. */
    fullMoon: { legendaryFactor: 5, variantFactor: 2 },
    /** Poisson du jour (change chaque jour réel) : il mord plus souvent, et sa première prise du jour rapporte un bonus. */
    dailyFish: { weightFactor: 2.5, reward: 3 },
  },

  /** Vivier de la cabane : un bac où nagent les poissons gardés (src/scene/fishPen.ts). */
  pen: {
    /** Places au départ (la boutique peut l'agrandir). */
    capacity: 5,
    /** Longueur des poissons dans le bac (m) : leur taille réelle, bornée pour rester lisible. */
    fishLength: { min: 0.35, max: 0.95 },
    /** Nage en rond : vitesse (m/s) et profondeur sous la surface (m), tirées pour chaque poisson. */
    swimSpeed: { min: 0.12, max: 0.3 },
    depth: { min: 0.1, max: 0.28 },
    /** Eau du bac (transparente, pour voir les poissons). */
    waterColor: 0x4f9fa8,
    waterOpacity: 0.4,
    /** Vue rapprochée sans Empty `cam_fish_pen` : recul et hauteur de la caméra (m). */
    viewDistance: 2.6,
    viewHeight: 2.3,
  },

  /** Présentation de la prise devant la caméra. */
  catchDisplay: {
    /** Distance à la caméra (m). */
    distance: 2.6,
    /** Décalage vers le haut (m), pour laisser la place à la carte. */
    lift: 0.3,
    /** Longueur affichée maximale (m), et part maximale de la largeur visible. */
    maxLength: 1.1,
    maxScreenFraction: 0.55,
    /** Saut hors de l'eau : durée (s) et hauteur (m). */
    leapDuration: 0.9,
    leapHeight: 1.2,
    /** Vitesse de rotation du poisson présenté (rad/s). */
    turnSpeed: 0.6,
    /** Délai avant de pouvoir fermer la présentation (s). */
    minTime: 0.8,
    /** Petite lumière qui éclaire le poisson présenté (utile la nuit). */
    lightIntensity: 4,
  },

  /** Sauvegarde automatique dans le navigateur (localStorage). */
  save: {
    key: 'petite-peche/save',
    /** Les demandes de sauvegarde rapprochées sont regroupées (ms). */
    debounceMs: 800,
    /** Sauvegarde périodique de l'heure et du temps de jeu (s). */
    autosaveSeconds: 30,
  },

  /**
   * Canne à pêche. Angles en radians : pitch négatif = pointe vers le haut
   * (-π/2 = verticale) ; yaw = rotation autour de la verticale (négatif = vers la droite).
   */
  rod: {
    restPitch: -0.6,
    restYaw: -0.3,
    maxYaw: 1.9,
    /** Pendant la charge, la canne bascule vers l'arrière selon la puissance. */
    chargePitch: { start: -0.9, end: -2.3 },
    castPitch: -0.35,
    waitPitch: -0.5,
    bitePitch: -0.25,
    reelPitch: -1.1,
    /** Ressort de la canne : raideur et amortissement. */
    stiffness: 70,
    damping: 9,
    /** Réactivité de la rotation horizontale (1/s). */
    yawResponse: 5,
    /** Impulsions (rad/s) : positif = la pointe plonge, négatif = elle se relève. */
    castKick: 9,
    nibbleKick: 1.5,
    biteKick: 5,
    hookKick: -8,
    /** Longueur de ligne sous la pointe quand le bouchon pend (m). */
    hangLength: 0.6,
    /** Fixation de la canne si boat.glb ne contient pas d'Empty `rod_mount` (repère de la barque). */
    fallbackMount: { x: -0.56, y: 0.37, z: -0.2 },
    /** Mains du pêcheur si rod.glb n'a pas d'Empty `rod_grip` / `rod_reel` (repère de la canne). */
    gripFallback: { x: 0, y: -0.01, z: -0.12 },
    reelFallback: { x: 0.05, y: -0.075, z: -0.12 },
    /** Rayon du tour de manivelle (m). */
    crankRadius: 0.035,
  },

  audio: {
    masterVolume: 0.8,
    /** Fichiers de assets/audio/ ; un fichier absent est remplacé par un son généré. */
    files: {
      cast: 'audio/cast.ogg',
      splash: 'audio/splash.ogg',
      nibble: 'audio/nibble.ogg',
      bite: 'audio/bite.ogg',
      reel: 'audio/reel.ogg',
      snap: 'audio/snap.ogg',
      catch: 'audio/catch.ogg',
    },
    volumes: { cast: 0.3, splash: 0.55, nibble: 0.35, bite: 0.8, reel: 0.3, snap: 0.6, catch: 0.5 },
    /** Ambiance du lac (boucles), fondue entre le jour et la nuit. */
    ambience: {
      files: {
        day: 'audio/lake_day.ogg',
        night: 'audio/lake_night.ogg',
        river: 'audio/river.ogg',
        rain: 'audio/rain.ogg',
        wind: 'audio/wind.ogg',
        sea: 'audio/sea.ogg',
      },
      /** Volume du ressac au bord de la mer. */
      seaVolume: 0.9,
      /** Volume de l'eau vive à la rivière (par rapport aux ambiances jour et nuit). */
      riverVolume: 0.8,
      volume: 0.5,
    },
    /** Musique : ce fichier en boucle s'il existe, sinon une petite boîte à musique générée. */
    music: { file: 'audio/music.ogg', volume: 0.35 },
  },

  /** Réglages par défaut (modifiables dans le menu, sauvegardés). */
  settingsDefaults: {
    masterVolume: 0.8,
    sfxVolume: 1,
    ambienceVolume: 1,
    musicVolume: 1,
    /** Qualité graphique : 'auto' (s'adapte à l'appareil), 'low', 'medium' ou 'high' (voir `quality`). */
    quality: 'auto' as QualitySetting,
    /** Affiche le nombre d'images par seconde (pour vérifier la fluidité). */
    showFps: false,
    showBiteAlert: true,
    showHints: true,
    dayLengthMinutes: 12,
    textSize: 'normal',
    /** Par défaut, suit la préférence du système (« réduire les animations »). */
    reduceMotion: false,
    easyHook: false,
    bigBobber: false,
    stickSensitivity: 1,
  },

  /**
   * Qualité graphique (Réglages › Affichage). Chaque niveau règle :
   * - pixelRatio : finesse de l'image (plafond du nombre de pixels par point d'écran) ;
   * - shadows : 'boat' (seule la barque fait une ombre) ou 'full' (tout le décor proche) ;
   * - shadowMapSize : finesse des ombres (px) ;
   * - flora : herbe, fleurs et galets affichés ou non ;
   * - nightLights : nombre de vraies lumières de nuit (lanternes, fenêtres, feux) ;
   * - clouds : part des nuages affichés ;
   * - effects : part des particules émises (fumée, embruns, étincelles).
   */
  quality: {
    presets: {
      low: { pixelRatio: 1, shadows: 'boat', shadowMapSize: 512, flora: false, nightLights: 1, clouds: 0.5, effects: 0.5 },
      medium: { pixelRatio: 1.5, shadows: 'full', shadowMapSize: 1024, flora: true, nightLights: 2, clouds: 1, effects: 1 },
      high: { pixelRatio: 2, shadows: 'full', shadowMapSize: 2048, flora: true, nightLights: 3, clouds: 1, effects: 1 },
    } satisfies Record<
      QualityLevel,
      { pixelRatio: number; shadows: 'boat' | 'full'; shadowMapSize: number; flora: boolean; nightLights: number; clouds: number; effects: number }
    >,
    /**
     * Mode automatique : niveau de départ (ordinateur, écran tactile), puis
     * baisse d'un cran si le jeu passe sous `minFps` en moyenne sur `window`
     * secondes. Mesure après `warmup` secondes (chargement, shaders).
     */
    auto: { startDesktop: 'high' as QualityLevel, startTouch: 'medium' as QualityLevel, minFps: 45, window: 4, warmup: 6 },
  },

  /** Confort et accessibilité (réglages du joueur). */
  comfort: {
    /** Taille du texte : multiplicateur de toutes les tailles de police. */
    textScale: { normal: 1, large: 1.2, huge: 1.4 },
    /** « Moins d'animations » : part du mouvement conservée (tangage, vagues, balancement). */
    reducedMotion: 0.35,
    /** « Ferrage facile » : × la fenêtre pour ferrer. */
    easyHookFactor: 2,
    /** « Grand bouchon » : × la taille du bouchon. */
    bigBobberFactor: 1.5,
  },

  render: {
    maxPixelRatio: 2,
    /**
     * Rendu des couleurs : 'neutral' garde les couleurs de la palette telles
     * quelles ; 'aces' (plus cinéma) les désature et les assombrit un peu.
     */
    toneMapping: 'neutral' as 'neutral' | 'aces',
    exposure: 1,
    /** Taille de la carte d'ombre au démarrage (px) ; ensuite, selon la qualité graphique (CONFIG.quality). */
    shadowMapSize: 2048,
    /** Flou des ombres (en texels). */
    shadowRadius: 3,
    /** Demi-côté (m) de la zone d'ombre qui suit la barque : le décor proche y projette son ombre. */
    shadowArea: 32,
    /** … quand seule la barque projette une ombre (qualité basse) : petite zone, ombre plus fine. */
    boatShadowArea: 6,
    shadowBias: -0.0003,
    /**
     * Décalage le long des normales, en texels de la carte d'ombre (donc plus
     * grand quand elle est moins fine) : évite l'« acné », ces rayures qui
     * clignotent sur les faces presque parallèles au soleil.
     */
    shadowNormalBias: 1.5,
  },

  /**
   * Cycle jour/nuit (la durée d'une journée est dans `time`). L'ambiance est
   * définie à quelques heures clés et interpolée entre deux clés. La dernière
   * clé (24 h) doit être identique à la première (0 h).
   * `night` (0 → 1) allume les étoiles, la lune, la lanterne et le bouchon lumineux.
   */
  dayNight: {
    keyframes: [
      { hour: 0, skyTop: 0x0c1630, skyHorizon: 0x26375e, sun: 0x9fb2ee, sunIntensity: 1.1, hemiSky: 0x6078b5, hemiGround: 0x1f2838, hemiIntensity: 1.5, water: 0x3a6a92, fogNear: 30, fogFar: 170, night: 1 },
      { hour: 4.5, skyTop: 0x101c3a, skyHorizon: 0x32406a, sun: 0x9fb2ee, sunIntensity: 1.05, hemiSky: 0x6078b5, hemiGround: 0x1f2838, hemiIntensity: 1.45, water: 0x3c6c94, fogNear: 25, fogFar: 150, night: 1 },
      { hour: 6.5, skyTop: 0x7898cf, skyHorizon: 0xf5b88a, sun: 0xffb883, sunIntensity: 2.1, hemiSky: 0xb9c6ea, hemiGround: 0x6f6a52, hemiIntensity: 0.75, water: 0x5596b0, fogNear: 25, fogFar: 170, night: 0 },
      { hour: 9, skyTop: 0x5c9fe2, skyHorizon: 0xdde6e8, sun: 0xfff0d8, sunIntensity: 3.1, hemiSky: 0xcfe4ff, hemiGround: 0x8a9a68, hemiIntensity: 0.78, water: 0x4f9fb3, fogNear: 60, fogFar: 290, night: 0 },
      { hour: 14, skyTop: 0x4f98e0, skyHorizon: 0xcfe2ee, sun: 0xffffff, sunIntensity: 3.4, hemiSky: 0xcfe4ff, hemiGround: 0x8a9a66, hemiIntensity: 0.78, water: 0x4a9db3, fogNear: 70, fogFar: 320, night: 0 },
      { hour: 17.5, skyTop: 0x6b97d6, skyHorizon: 0xf3d2a8, sun: 0xffd79a, sunIntensity: 2.9, hemiSky: 0xcfd8f2, hemiGround: 0x86905f, hemiIntensity: 0.74, water: 0x4a92aa, fogNear: 55, fogFar: 270, night: 0 },
      { hour: 19.5, skyTop: 0x57649f, skyHorizon: 0xf2977a, sun: 0xff9460, sunIntensity: 2.2, hemiSky: 0xb3a3cb, hemiGround: 0x6a5a4a, hemiIntensity: 0.95, water: 0x5a8fae, fogNear: 40, fogFar: 200, night: 0.15 },
      { hour: 21, skyTop: 0x1a2347, skyHorizon: 0x574a78, sun: 0x9fb2ee, sunIntensity: 1.0, hemiSky: 0x606fa8, hemiGround: 0x232a38, hemiIntensity: 1.35, water: 0x3a6690, fogNear: 30, fogFar: 175, night: 0.9 },
      { hour: 24, skyTop: 0x0c1630, skyHorizon: 0x26375e, sun: 0x9fb2ee, sunIntensity: 1.1, hemiSky: 0x6078b5, hemiGround: 0x1f2838, hemiIntensity: 1.5, water: 0x3a6a92, fogNear: 30, fogFar: 170, night: 1 },
    ],
    /** Course du soleil : lever et coucher (heures), hauteur maximale (rad). */
    sunrise: 6,
    sunset: 19.8,
    sunMaxElevation: 1,
    /**
     * Hauteur minimale de la lumière (rad). Le soleil affiché dans le ciel peut
     * être bas, mais l'éclairage reste assez haut pour que le lac ne paraisse
     * pas éteint à l'aube et au coucher.
     */
    minLightElevation: 0.42,
    /** Position fixe de la lune (rad) : angle autour de la verticale et hauteur. */
    moon: { azimuth: -1.1, elevation: 0.45 },
    /** Courbure du dégradé du ciel (petit = horizon plus haut). */
    skyGradientExponent: 0.55,
    /** Lanterne de la barque, allumée la nuit. */
    lantern: { color: 0xffc27a, intensity: 3, distance: 9 },
    /** Lueur du bouchon la nuit (comme un bâton lumineux). */
    bobberGlow: { color: 0xb6ff9e, size: 0.35 },
  },

  /** Eau stylisée (src/scene/water.ts et waterSurface.ts). */
  water: {
    /** Taille des facettes de la surface (m) : plus petit = plus fin, mais plus coûteux. */
    cellSize: 1.2,
    /**
     * Vagues : somme de sinusoïdes. Amplitude (m), longueur d'onde (m),
     * vitesse (m/s), direction (rad). Rester petit : c'est un lac calme.
     */
    waves: [
      { amplitude: 0.06, wavelength: 18, speed: 1.2, direction: 0.4 },
      { amplitude: 0.04, wavelength: 11, speed: 0.9, direction: 2.1 },
      { amplitude: 0.02, wavelength: 5, speed: 1.4, direction: -0.8 },
    ],
    /** Profondeur (m) à partir de laquelle l'eau prend sa couleur « profonde ». */
    depthRange: 4.5,
    /** Profondeur supposée là où aucun fond n'est modélisé sous l'eau. */
    defaultDepth: 5,
    /** Passes de lissage du dégradé de profondeur. */
    depthSmoothing: 3,
    /** Écume au bord de l'eau : largeur (en m de profondeur) et intensité. */
    foamWidth: 0.9,
    foamStrength: 0.85,
    foamColor: 0xf4fbff,
    /** Eau peu profonde : couleur du cycle jour/nuit mêlée à cette teinte, puis éclaircie. */
    shallowTint: 0x7fe3d2,
    shallowMix: 0.3,
    shallowBrightness: 1.6,
    deepBrightness: 1.0,
    /** Reflet du ciel en regardant l'eau de biais (0 → 1). */
    reflectivity: 0.75,
    roughness: 0.3,
    /**
     * Scintillement : petits éclats de soleil (ou de lune) qui clignotent sur
     * l'eau, du côté de la lumière. `density` = éclats possibles par mètre,
     * `share` = part des cases qui en portent un, `size` = rayon (part de la
     * case), `focus` = étroitesse du reflet (grand = seulement à contre-jour),
     * `strength` = éclat.
     */
    sparkle: { density: 4.5, share: 0.16, size: 0.3, focus: 9, strength: 1.8, speed: 2.5 },
  },

  /** Lucioles, la nuit, autour de la barque. */
  /** Moustache, le chat du ponton (src/scene/cat.ts). */
  cat: {
    /** Taille du modèle (un peu plus grand que nature, pour le voir depuis la barque). */
    scale: 1.3,
    /** Hauteur de la bulle « ! » au-dessus de ses pattes (m, avant `scale`). */
    height: 0.95,
    /** Balancement de la queue : amplitude (rad) et vitesse (rad/s). */
    tailSway: 0.35,
    tailSpeed: 1.6,
    /** Respiration : variation de hauteur du corps. */
    breathing: 0.012,
    /** Distance minimale entre la bulle « ! » et le bord de l'écran (px). */
    bubbleMargin: 24,
  },

  /** Feuilles qui dérivent sur une rivière (src/scene/driftingLeaves.ts). */
  leaves: {
    count: 36,
    /** Taille d'une feuille (m). */
    size: 0.22,
    /** Elles restent à cette distance de la barque (m)… */
    radius: 24,
    /** … mais jamais trop près (elles passeraient dans la coque). */
    boatClearance: 1.8,
    colors: [0xd98a3a, 0xc9a23a, 0xa8b04a, 0xb8502e, 0xe0b04e],
  },

  fireflies: { count: 40, color: 0xd8ff7a, size: 0.3, minDistance: 6, maxDistance: 28 },

  /** Sillage de la barque : un rond derrière elle quand elle avance, tous les `spacing` mètres parcourus. */
  wake: { minSpeed: 0.4, spacing: 0.75 },

  level: {
    /** Taille du plan d'eau de secours si le GLB ne contient pas d'objet `water`. */
    fallbackWaterSize: 120,
    /** Rayon d'une zone définie par un Empty = échelle de l'Empty × cette valeur. */
    emptyZoneRadius: 1,
  },

  /** Niveau de secours généré quand `assets/levels/lake_01.glb` est absent. */
  placeholder: {
    lakeRadius: 38,
    groundRadius: 260,
    treeCount: 45,
    seed: 7,
  },

  debug: {
    /** Afficher zones, collisions et spawn dès le démarrage (sinon touche G). */
    showLevelHelpersAtStart: false,
    /** Écrire dans la console le délai et les fausses touches de chaque lancer. */
    logBites: true,
    /** Touche pour avancer l'horloge (tester le jour et la nuit) ; liste vide = désactivé. */
    timeSkip: ['t'],
    timeSkipHours: 1,
  },
} as const;
