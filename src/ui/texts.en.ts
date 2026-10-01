import type { KeyHints } from '../core/controls';
import type { Objective } from '../progression/objectives';
import type { Texts } from './texts.fr';

/**
 * Tous les textes affichés au joueur, en anglais. Même forme que texts.fr.ts
 * (le type `Texts` le garantit) : c'est là-bas que chaque entrée est
 * expliquée.
 */
export const EN: Texts = {
  colon: ': ',
  dateLocale: 'en-GB',
  quote: (text: string): string => `“${text}”`,

  prompts: {
    IDLE: (k: KeyHints): string => `Click the water: cast · ${k.move}: row (${k.sprint}: faster) · ${k.cabin}: Moustache · ${k.journal}: journal · Esc: menu`,
    CHARGING: 'Aim with the mouse, release to cast · Esc: cancel',
    CASTING: '',
    WAITING: 'Patience… · Click: reel the line back in',
    BITE: 'A bite! Click to strike!',
    REELING: 'Hold click: reel in · Let go when the line gets too tight',
    CAUGHT: '',
    ESCAPED: '',
  },

  touchPrompts: {
    IDLE: 'Tap the water: cast · Joystick: row (pushed all the way: faster)',
    CHARGING: 'Drag to adjust (up: farther), lift to cast',
    CASTING: '',
    WAITING: 'Patience… · Tap: reel the line back in',
    BITE: 'A bite! Tap quickly to strike!',
    REELING: 'Hold: reel in · Let go if the line gets too tight',
    CAUGHT: '',
    ESCAPED: '',
  },

  zones: {
    open: 'Open water',
    shallow: 'Shallow water',
    deep: 'Deep water',
    reeds: 'Reeds',
    rocks: 'Rocks',
  },

  escape: {
    cancel: 'Line reeled in.',
    early: 'Too soon! That was only a nibble.',
    missed: 'Missed… the fish swam off.',
    snapped: 'Snap! The line broke… the fish gets away.',
  },

  slots: {
    dawn: { icon: '🌅', name: 'Dawn' },
    day: { icon: '☀️', name: 'Day' },
    dusk: { icon: '🌇', name: 'Dusk' },
    night: { icon: '🌙', name: 'Night' },
  },

  rarity: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary',
  },

  reel: {
    tension: 'Tension',
    release: '⚠ Let go!',
  },

  objectives: {
    caught: { icon: '🎣', name: 'New species' },
    nice: { icon: '🥈', name: 'Fine fish' },
    trophy: { icon: '🏆', name: 'Trophy' },
    variant: { icon: '✨', name: 'Rare variant' },
  },

  shells: {
    icon: '🐚',
    count: (count: number): string => `${count} shell${count === 1 ? '' : 's'}`,
    title: 'Shells: earned from the journal and Moustache’s requests, to spend at his cabin',
    gain: (count: number): string => `+${count} 🐚`,
  },

  catch: {
    newSpecies: 'New species!',
    record: 'New record!',
    nice: 'Fine fish',
    trophy: 'Trophy!',
    variant: '✨ Rare variant!',
    requestReward: 'Moustache’s request',
    dailyReward: '⭐ Fish of the day',
    keep: 'Keep in the fish pen 🐟',
    keepKey: (key: string): string => `Keep in the fish pen 🐟 (${key})`,
    kept: 'In the pen ✓',
    penFull: 'Pen full',
    continue: 'Click or Space to continue',
    touchContinue: 'Tap the screen to continue',
  },

  journal: {
    title: 'Fishing journal',
    button: '📔',
    buttonTitle: (key: string): string => `Fishing journal (${key})`,
    close: 'Close',
    closeHint: (key: string): string => `${key} or Esc to close`,
    unknownName: '???',
    hint: 'Hint',
    record: 'Record',
    caughtTimes: (count: number): string => `${count} catch${count === 1 ? '' : 'es'}`,
    species: (caught: number, total: number): string => `${caught} / ${total} species`,
    totalCatches: (count: number): string => `${count} catch${count === 1 ? '' : 'es'} in total`,
    biggest: 'Biggest catch',
    playTime: 'Time by the water',
    objectives: (done: number, total: number): string => `Goals: ${done} / ${total}`,
    threshold: (cm: number): string => `${cm} cm`,
    variantName: (name: string): string => `✨ ${name}`,
    firstCatch: 'First caught on',
    favoriteBaits: 'Favourite baits',
    favoriteWeather: 'Favourite weather',
  },

  menu: {
    logo: 'Au fil de l’eau',
    tagline: 'A little lake, a rowboat, and all the time in the world.',
    play: 'Play',
    continue: 'Continue',
    progress: (species: number, total: number, catches: number): string =>
      `${species} / ${total} species · ${catches} catch${catches === 1 ? '' : 'es'}`,
    settings: 'Settings',
    pause: 'Paused',
    resume: 'Resume',
    journal: 'Journal',
    back: 'Back',
    button: '☰',
    buttonTitle: 'Menu (Esc)',
    cabin: 'Moustache’s dock',
    map: 'Map of fishing spots',
    controlsTitle: 'Controls',
    controls: (k: KeyHints): (readonly [string, string])[] => [
      [`${k.move} or arrow keys`, 'Row'],
      [`${k.sprint} while rowing`, 'Row harder'],
      ['Click the water (hold to adjust)', 'Cast where the mouse points'],
      ['Click when it bites', 'Strike'],
      ['Hold click', 'Reel in (let go if the line gets too tight)'],
      ['1 to 6', 'Change bait'],
      [k.journal, 'Journal'],
      [k.cabin, 'Moustache’s dock (requests, finds, fish pen, shop)'],
      ['Row over a golden glint', 'Fish out a find (to show Moustache)'],
      [k.keep, 'Keep the catch in the fish pen'],
      ['Esc', 'Pause'],
    ],
    language: 'Language',
    touchControls: [
      ['Joystick (bottom left)', 'Row (pushed all the way: faster)'],
      ['Tap the water (drag to adjust)', 'Cast where you tap'],
      ['Tap when it bites', 'Strike'],
      ['Hold', 'Reel in (let go if the line gets too tight)'],
      ['Buttons at the top right', 'Bait, Moustache, journal and menu'],
      ['Row over a golden glint', 'Fish out a find (to show Moustache)'],
    ],
  },

  pwa: {
    install: 'Install the game',
    iosHint: 'To install it on iPhone or iPad: Share button, then “Add to Home Screen”.',
    updateReady: 'A new version of the game is ready.',
    update: 'Update',
    offlineReady: 'The game is ready: it will start even without a connection.',
  },

  cabin: {
    button: '🐈',
    buttonTitle: (key: string): string => `Moustache’s dock: requests, finds and shop (${key})`,
    title: 'Moustache’s dock',
    closeHint: (key: string): string => `${key} or Esc to close`,
    tabs: { requests: 'Requests', finds: 'Finds', pen: 'Fish pen', shop: 'Shop', map: 'Map' },
    finds: {
      intro: 'Things float in the quiet corners: a golden glint gives them away from afar. Row over them, then show them to me!',
      examined: 'Let’s see what you’ve brought back…',
      left: (count: number, at: string): string => `🎁 Today, ${count} find${count > 1 ? 's are' : ' is'} still floating ${at}.`,
      allPicked: (at: string): string => `🎁 You have fished out everything ${at} for today. More will drift in tomorrow.`,
      none: (at: string): string => `Nothing floats ${at}.`,
      isNew: 'New find!',
      again: 'Already in the collection',
      collection: (name: string, found: number, total: number): string => `${name} · ${found} / ${total}`,
      unknown: '???',
      unknownHint: (at: string): string => `Something floating ${at}…`,
      rareHint: (at: string): string => `A rare object, ${at}…`,
      count: (count: number): string => `× ${count}`,
    },
    greeting: 'Meow! Here is what would make me happy:',
    allDone: 'Thanks for everything! Come back tomorrow, I’ll have new cravings.',
    empty: 'Moustache is napping… (no request possible for now)',
    newRequests: 'Moustache has new requests! 🐈',
    progress: (done: number, count: number): string => `${done} / ${count}`,
    done: 'Done ✓',
    rule: 'Each day, completed requests are replaced. Those in progress wait for you, no rush.',
    journalRewards: (rewards: Record<Objective, number>): string =>
      `The journal earns shells too: new species ${rewards.caught}, fine fish ${rewards.nice}, trophy ${rewards.trophy}, rare variant ${rewards.variant}.`,
    requests: {
      any: (count: number): string => `Catch ${count} fish, any kind`,
      slot: (count: number, when: string): string => `Catch ${count} fish ${when}`,
      habitat: (count: number, where: string): string => `Catch ${count} fish ${where}`,
      rarity: 'Catch an uncommon, rare or legendary fish',
      species: (name: string): string => `Catch: ${name}`,
      unknownSpecies: (hint: string): string => `A fish not yet known (${hint})`,
      size: (name: string, cm: number): string => `${name} of at least ${cm} cm`,
    },
    when: { dawn: 'at dawn', day: 'in broad daylight', dusk: 'at dusk', night: 'at night' },
    where: {
      open: 'in open water',
      shallow: 'in shallow water',
      deep: 'in deep water',
      reeds: 'in the reeds',
      rocks: 'near the rocks',
    },
    daily: (name: string, reward: number): string =>
      `⭐ Fish of the day: ${name}. It bites more often today, and the first one earns ${reward} 🐚.`,
    dailyClaimed: (name: string): string => `⭐ Fish of the day: ${name}. Bonus earned, well done! It still bites more often.`,
    dailyUnknown: (hint: string): string => `a fish not yet known (${hint})`,
    pen: {
      places: (count: number, capacity: number): string => `${count} / ${capacity} places`,
      empty: 'The fish pen is empty. On the catch card, “Keep in the fish pen” (V key) puts your fish in it.',
      noPen: 'The fish pen is not here: the fish you kept are waiting at the lake.',
      view: 'Go and see the fish pen 👀',
      release: 'Release',
      released: (name: string): string => `${name} goes back to the lake. 🌊`,
      since: (date: string): string => `in the pen since ${date}`,
    },
    shop: {
      intro: 'Everything is paid for in shells. No hurry: Moustache keeps it all aside.',
      sections: { bait: 'Baits', gear: 'Tackle', pen: 'Fish pen', decor: 'Decoration', outfit: 'Angler’s outfit' },
      owned: 'Owned ✓',
      equipped: 'In use',
      equip: 'Use',
      locked: (name: string): string => `After: ${name}`,
      price: (price: number): string => `${price} 🐚`,
    },
    bought: (name: string): string => `Bought: ${name}!`,
    newBait: (name: string, key: number): string => `New bait: ${name} (key ${key})`,
  },

  penView: {
    title: (count: number): string => `🐟 The fish pen · ${count} fish`,
    back: 'Back',
  },

  tutorial: {
    skip: 'Skip',
    progress: (step: number, total: number): string => `${step} / ${total}`,
    steps: {
      cast: {
        mouse: (): string => 'Meow! I’m Moustache. To cast, click the water where you want to fish. Keep the button held to adjust, then release.',
        touch: 'Meow! I’m Moustache. To cast, tap the water where you want to fish. Drag your finger to adjust, then lift it.',
      },
      strike: {
        mouse: (): string => 'Patience… The bobber twitches now and then: that’s nothing. When it dives and a “!” appears, click quickly to strike!',
        touch: 'Patience… The bobber twitches now and then: that’s nothing. When it dives and a “!” appears, tap the screen quickly to strike!',
      },
      reel: {
        mouse: (): string => 'It’s hooked! Hold the click to reel in. If the tension gauge turns red, let go a little: the fish pulls in bursts.',
        touch: 'It’s hooked! Keep your finger down to reel in. If the tension gauge turns red, let go a little: the fish pulls in bursts.',
      },
      caught: {
        mouse: (k: KeyHints): string =>
          `Well done, your first catch! It goes into your journal (${k.journal} key). You can also keep it in the fish pen (${k.keep} key). Click to continue.`,
        touch: 'Well done, your first catch! It goes into your journal (📔). You can also keep it in the fish pen. Tap the screen to continue.',
      },
      explore: {
        mouse: (k: KeyHints): string =>
          `Row with ${k.move} or the arrow keys (${k.sprint} to go faster): reeds, rocks and deep water hide other fish. A fish jumping, or bubbles? Cast right next to them!`,
        touch: 'Row with the joystick at the bottom left (push it all the way to go faster): reeds, rocks and deep water hide other fish. A fish jumping, or bubbles? Cast right next to them!',
      },
      cabin: {
        mouse: (k: KeyHints): string =>
          `And come and see me at the dock (${k.cabin} key): requests, fish pen, shop and even a map. If a golden glint shines on the water, row over it and bring me whatever is floating there. Happy fishing!`,
        touch: 'And come and see me at the dock (🐈 button): requests, fish pen, shop and even a map. If a golden glint shines on the water, row over it and bring me whatever is floating there. Happy fishing!',
      },
    },
    tips: {
      early: 'Too soon! Wait until the bobber really dives. Cast again, I’m watching.',
      missed: 'A bit late… At the next “!”, be quicker. Cast again!',
      snapped: 'Snap! Let go sooner when the tension rises. Shall we try again?',
      cancel: 'No harm done: cast again whenever you like.',
    },
  },

  finds: {
    picked: '🎁 You fish something out… Show it to Moustache! (🐈)',
  },

  signs: {
    icon: '🐟',
    hotspot: '🐟 Nice spot: they’re wriggling around here!',
  },

  places: {
    loading: (of: string): string => `Getting ${of} ready…`,
    travel: (name: string): string => `Off to ${name.toLowerCase()}…`,
    welcome: (at: string): string => `Here we are, ${at}!`,
    unlocked: (name: string): string => `🗺️ Moustache knows a new spot: ${name.toLowerCase()}! (dock › Map)`,
    here: 'You are here',
    go: 'Go there 🚣',
    locked: (caught: number, needed: number, fromOf: string): string =>
      `🔒 Catch ${needed} species from ${fromOf} and Moustache will take you there: ${caught} / ${needed}`,
    species: (caught: number, total: number): string => `${caught} / ${total} species`,
    elsewhere: (at: string): string => `(${at})`,
  },

  rendezvous: {
    dailyFish: (name: string): string => `⭐ Fish of the day: ${name}`,
    fullMoon: (legendary: string): string => `🌕 Full moon tonight! The ${legendary} might show up, and the rare variants too…`,
    moonIcons: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
    fullMoonTitle: 'Full moon',
  },

  settings: {
    title: 'Settings',
    sound: 'Sound',
    display: 'Display',
    game: 'Game',
    save: 'Saved game',
    masterVolume: 'Master volume',
    sfxVolume: 'Effects',
    ambienceVolume: 'Lake ambience',
    musicVolume: 'Music',
    quality: 'Graphics quality',
    qualities: { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' },
    qualityAutoNow: (level: string): string => `Automatic: ${level.toLowerCase()} right now (it drops if the game stutters).`,
    qualityLowered: (level: string): string => `Graphics quality lowered (${level.toLowerCase()}) to keep the game smooth.`,
    showFps: 'Frames per second',
    fps: (fps: number, level: string): string => `${Math.round(fps)} fps · ${level}`,
    showHints: 'On-screen hints',
    showBiteAlert: '“!” when a fish bites',
    dayLength: 'Length of a day',
    minutes: (minutes: number): string => `${minutes} min`,
    replayTutorial: 'Replay the tutorial',
    comfort: 'Comfort',
    textSize: 'Text size',
    textSizes: { normal: 'Normal', large: 'Large', huge: 'Very large' },
    reduceMotion: 'Less motion',
    easyHook: 'Easy strike (more time)',
    bigBobber: 'Big bobber',
    stickSensitivity: 'Joystick sensitivity',
    keyboard: 'Keyboard',
    actions: {
      forward: 'Forward',
      left: 'Turn left',
      backward: 'Backward',
      right: 'Turn right',
      sprint: 'Row harder',
      journal: 'Journal',
      cabin: 'Moustache’s dock',
      keep: 'Keep in the fish pen',
    },
    pressKey: 'Press a key… (Esc: cancel)',
    reservedKey: (key: string): string => `“${key}” is reserved.`,
    takenKey: (key: string, action: string): string => `“${key}” is already used: ${action}.`,
    resetKeys: 'Default keys',
    arrowsNote: 'The arrow keys always work for rowing.',
    reset: 'Erase saved game',
    resetConfirm: 'Really erase everything? Click to confirm',
  },

  noWater: 'No water that way…',
  aimLabel: (zone: string, meters: number): string => `${zone} · ${Math.round(meters)} m`,
  hooked: 'Hooked!',
  baitLocked: 'Reel your line in first to change bait.',
  loadError: 'Oops, the lake could not be loaded. Details in the console.',
  assetStatus: (placeholderLevel: boolean, warnings: number) =>
    `${placeholderLevel ? 'Placeholder level · ' : ''}${warnings} asset warning${warnings === 1 ? '' : 's'} (see the console)`,
};
