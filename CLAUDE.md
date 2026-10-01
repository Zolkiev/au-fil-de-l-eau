# Projet : « Au fil de l’eau » (anciennement « Petite Pêche ») — jeu de pêche cozy en 3D, jouable dans le navigateur

## Vision
Un mini-jeu de pêche relaxant en low poly stylisé. Le joueur est dans une barque
sur un petit lac, lance sa ligne, attend une touche, ferre et remonte des poissons
qu'il collectionne dans un carnet. Ambiance douce : pas d'échec punitif, pas de
timer stressant, musique et sons calmes, cycle jour/nuit lent.

## Stack imposée
- Vite + TypeScript + Three.js (dernière version stable)
- Pas de moteur physique : la ligne, le bouchon et le poisson sont animés en code
- GLTFLoader + DRACOLoader pour les assets
- Sauvegarde dans localStorage (carnet, stats, réglages)
- Aucun framework UI : HUD en HTML/CSS superposé au canvas

## Pipeline Blender → jeu (IMPORTANT)
Les niveaux et assets viennent de Blender en .glb. Le code ne doit JAMAIS
hardcoder de positions : tout est lu depuis les noms d'objets du GLB.

Conventions de nommage dans `assets/levels/lake_01.glb` :
- `spawn_boat`            → Empty, position et rotation de départ de la barque
- `cam_default`           → Empty, position de la caméra par défaut
- `water`                 → mesh du plan d'eau (reçoit le shader d'eau du jeu)
- `zone_<type>_<n>`       → Empty ou mesh invisible définissant une zone de pêche
                            (<type> : `shallow`, `deep`, `reeds`, `rocks`)
- `*_col`                 → meshes de collision invisibles (limites de la barque)
- `deco_*`                → décor, rendu tel quel

Poissons : un fichier par espèce dans `assets/fish/<id>.glb`, avec une animation
de nage nommée `swim` si elle existe (sinon ondulation procédurale en code).

Crée un module `levelLoader.ts` qui parse le GLB, extrait ces objets, cache les
`*_col` et les zones, et expose une structure typée. Si un asset est absent,
utilise un placeholder (primitives Three.js) et log un warning clair : le jeu doit
TOUJOURS être jouable, même sans aucun asset Blender.

Documente ces conventions dans `docs/BLENDER_CONVENTIONS.md`.

## Boucle de gameplay
1. **Lancer** : cliquer (ou toucher) l'eau là où l'on veut pêcher ; en gardant
   l'appui, le repère suit le pointeur, et relâcher → le bouchon part en arc et
   tombe sur le repère. (Écart assumé avec la spec d'origine, « maintenir pour
   charger la puissance » : la jauge qui oscillait ne laissait pas maîtriser
   le point de chute.)
2. **Attente** : le bouchon flotte. Délai aléatoire selon la zone, l'heure et l'appât.
   Petites touches trompeuses (le bouchon frémit) avant la vraie touche.
3. **Ferrer** : à la vraie touche (le bouchon plonge + son), le joueur a une
   fenêtre de ~0,8 s pour cliquer. Raté = le poisson part, sans pénalité.
4. **Remonter** : mini-jeu de tension. Une jauge montre la tension de la ligne ;
   maintenir le clic remonte mais augmente la tension, relâcher la fait baisser.
   Le poisson tire par à-coups selon sa difficulté. Tension au max trop longtemps =
   la ligne casse. Distance à 0 = poisson attrapé.
5. **Prise** : petite scène de présentation du poisson (rotation, nom, taille en cm,
   rareté), puis ajout au carnet.

## Données
`src/data/fish.ts` : tableau typé d'espèces avec id, nom, rareté
(commun / peu commun / rare / légendaire), zones, créneaux horaires, taille min/max,
difficulté (force, fréquence des à-coups), description courte pour le carnet.
Commence avec 10 espèces fictives, cohérentes pour un lac tempéré.

## Systèmes
- **Cycle jour/nuit** : une journée in-game = 12 min réelles. Couleur du ciel,
  lumière et brouillard interpolés. Certains poissons ne sortent que la nuit.
- **Carnet** : grille des espèces, silhouettes pour celles pas encore attrapées,
  record de taille par espèce, compteur de prises.
- **Appâts** (phase 2) : 3 appâts qui modifient les probabilités.
- **Barque** : déplacement au clavier (ZQSD / WASD) dans les limites `_col`,
  léger tangage procédural ; touche Maj (ou joystick à fond) pour ramer fort.

## Rendu et ambiance
- Shader d'eau stylisé : ondulation des vertices, dégradé profondeur, écume
  légère sur les bords si possible, reflets simples. Rester performant.
- Palette douce, tone mapping ACES, ombres douces uniquement sur la barque.
- Caméra en troisième personne derrière la barque, légèrement surélevée,
  suivi amorti.
- Sons : prévoir un `audioManager.ts` avec des emplacements pour ambiance lac,
  plouf, moulinet, touche. Utiliser des sons générés en WebAudio en attendant
  les vrais fichiers.

## Architecture attendue
src/
  main.ts
  core/        (game loop, state machine du jeu, input, save)
  scene/       (levelLoader, water, sky/daynight, boat, camera)
  fishing/     (cast, bobber, bite, reel minigame, fishSelector)
  ui/          (hud, journal, catchPopup, menu)
  data/        (fish.ts)
  progression/ (objectifs, demandes, boutique, vivier, rendez-vous, trouvailles)
  pwa/         (service worker, installation, mises à jour)
  audio/
assets/
  levels/  fish/  props/  audio/

Machine à états explicite pour la pêche :
IDLE → CHARGING → CASTING → WAITING → BITE → REELING → CAUGHT | ESCAPED → IDLE

## Plan de livraison
Travaille par phases. Arrête-toi à la fin de chaque phase pour que je teste.
- **Phase 1** : scène placeholder (plan d'eau, barque cube, ciel), caméra,
  déplacement de la barque, levelLoader avec fallback.
- **Phase 2** : lancer, bouchon, attente, touche, ferrage.
- **Phase 3** : mini-jeu de remontée, présentation de la prise, données poissons.
- **Phase 4** : carnet, sauvegarde, cycle jour/nuit, zones.
- **Phase 5** : shader d'eau, polish, sons, menu, réglages.

## Règles
- Code propre et commenté en français, fonctions courtes.
- Tous les paramètres de gameplay (timings, vitesses, tensions) dans
  `src/config.ts` pour que je puisse les ajuster sans fouiller le code.
- Pas de dépendances superflues : demande-moi avant d'en ajouter une.
- Mets à jour ce CLAUDE.md et un `docs/PROGRESS.md` à la fin de chaque phase.

---

## État du projet

- **État** : les 5 phases du plan sont livrées. Depuis :
  - la pêche a été découpée en plusieurs fichiers ;
  - tous les assets Blender ont été créés, et les poissons nagent (squelette
    + action `swim`) ;
  - un contrôle qualité en jeu a été fait ;
  - le jeu est jouable sur mobile ;
  - un système de progression a été ajouté : objectifs du carnet, demandes
    de Moustache (le chat du ponton), boutique ;
  - un vivier (bac où nagent les poissons gardés) et des rendez-vous rares
    (pleine lune, poisson du jour) ont suivi ;
  - un deuxième lieu existe : la rivière (6 espèces), qui se débloque à la
    8ᵉ espèce du lac ;
  - météo, tutoriel de Moustache, puis équilibrage par simulation et
    contrôle qualité global ;
  - décor vivant : signes de poissons (sauts, bulles), vent dans les arbres
    et les roseaux, libellules et oiseaux ;
  - accessibilité et confort : taille du texte, moins d'animations, ferrage
    facile, grand bouchon, sensibilité du joystick, touches modifiables ;
  - un troisième lieu : la crique, au bord de la mer (6 espèces marines),
    qui se débloque à la 4ᵉ espèce de la rivière ;
  - le jeu est une PWA : installable, jouable hors connexion, mises à jour
    proposées depuis le menu ;
  - polish visuel : assets corrigés (faces qui clignotaient,
    décor qui flottait), éclairage revu, ombres du décor, nuages, lumières
    de nuit (lanternes, fenêtres, faisceau du phare), ombres douces cuites,
    petite flore (herbe, fleurs, buissons, galets), matériel dans la
    barque ;
  - un pêcheur low poly anime la barque : il rame (rames animées), tient
    la canne, mouline, suit son bouchon du regard et lève les bras à la
    prise ;
  - réglage de qualité graphique (Auto / Basse / Moyenne / Haute) avec
    baisse automatique si le jeu rame, et compteur d'images par seconde ;
  - niveaux agrandis (lac ~120 m, rivière ~250 m, crique ~260 m de côte),
    barque plus rapide avec sprint, visée directe du lancer, effets du
    décor (fumée, feux de camp, embruns, gouttes, scintillement de l'eau) ;
  - vie sur l'eau (nénuphars, grenouilles, canards ou mouettes, héron,
    ombres de poissons), trouvailles à repêcher et à montrer à Moustache
    (collection de 18 objets), tenue du pêcheur à la boutique ;
  - jeu en français et en anglais, langue choisie sur l'écran titre.

  Voir `docs/PROGRESS.md` (dont « Prochaines pistes »). Mesure sur iPhone :
  60 i/s en qualité Auto (Moyenne) avec les grands niveaux ; depuis, Auto
  démarre en Haute sur téléphone. En attente : savoir s'il y reste.
- Dépôt git **public** : https://github.com/Zolkiev/au-fil-de-l-eau (branche
  `main`, commits signés `jael.pattyn@gmail.com`, réglage local du dépôt).
  Chaque push sur `main` met le jeu en ligne sur
  https://zolkiev.github.io/au-fil-de-l-eau/ (`.github/workflows/deploy.yml`,
  GitHub Pages en source « GitHub Actions »). Ne committer et ne pousser que
  sur demande de l'utilisateur ; le push passe par son terminal (connexion
  GitHub via Git Credential Manager).
- Détail, vérifications et limites connues : `docs/PROGRESS.md`.

## Commandes

- `npm run dev` : serveur de développement (http://localhost:5173)
- `npm run dev -- --host` : idem, accessible depuis un téléphone du même
  réseau (adresse « Network »)
- `npm run build` : vérification des types, puis build dans `dist/`
- `npm run preview` : sert le build de production
- `npm run typecheck` : vérification des types seule (page et service
  worker)
- `python3 scripts/make_icons.py` : régénère les icônes (macOS, `sips`)
- En dev, `window.game` donne accès à l'instance du jeu depuis la console.

## Versions et dépendances

- three 0.186, @types/three 0.186, vite 8, typescript 7. Aucune autre
  dépendance.

## Notes techniques (décisions prises)

- `assets/` est le `publicDir` de Vite : `assets/levels/lake_01.glb` est servi
  à l'URL `levels/lake_01.glb`. Pour construire ces URL, utiliser
  `assetUrl()` / `loadGLB()` (`src/core/assets.ts`).
- `appType: 'mpa'` : un asset absent renvoie un vrai 404, et non `index.html`.
- `loadGLB()` ne lève jamais d'erreur : elle retourne `null` avec un warning,
  et l'appelant fournit un placeholder.
- Les noms d'objets sont lus via `blenderName()` : on prend le nom Blender
  d'origine (`userData.name`) et on retire le suffixe de doublon `.001`.
- Repères : l'avant est +Z dans Three.js (-Y dans Blender) et le cap
  (`yaw`) vaut 0 vers +Z. Un cap croissant tourne vers la gauche.
- Les collisions et les zones mesh passent par `Footprint`, l'emprise au sol
  en 2D (plan XZ). Dans ce code, un `Vector2` représente (x, z).
- Le placeholder de niveau suit les conventions de nommage et passe par
  `parseLevel()`. Toute nouvelle convention doit aussi y être ajoutée.
- three r186 : `PCFSoftShadowMap` a été retiré, on utilise `PCFShadowMap` avec
  `shadow.radius`. Les décodeurs Draco sont embarqués via `DRACO_GLTF_CONFIG`.
  `Clock` est déprécié ; la boucle utilise `performance.now()`.
- Ombres : la zone d'ombre (`CONFIG.render.shadowArea`, 64 m de côté) suit
  la barque. Tout le décor les reçoit et, sauf le terrain, en projette
  (`setupShadows` dans `levelLoader.ts`). La barque et le chat en
  projettent sans en recevoir : sur leurs faces presque parallèles au
  soleil, la carte (peu précise à cette échelle) dessinait des rayures qui
  clignotaient (« acné »). Le décalage anti-acné (`normalBias`) vaut un
  nombre de texels, donc suit la taille de la carte. Le centre de la zone
  avance par pas d'un texel (`Lighting.follow`), sinon les bords
  scintillent. Taille de la carte et zone (tout le décor, ou la barque
  seule) selon la qualité graphique (`Lighting.setShadowQuality`).
  (Écart assumé avec la spec d'origine, « ombres uniquement sur la barque ».)
- Rendu des couleurs : tone mapping « Neutral » par défaut
  (`CONFIG.render.toneMapping`, 'aces' possible) ; le ciel (ShaderMaterial)
  est tone-mappé lui aussi pour raccorder avec le brouillard. (Écart assumé
  avec la spec d'origine, « tone mapping ACES ».)
- Nuages : `Clouds` (`src/scene/clouds.ts`), amas d'icosaèdres fusionnés qui
  bouclent dans un carré centré sur la caméra, sans brouillard, dessous
  éclairé par la couleur de l'horizon (`setAmbience`). Couverture et teinte
  suivent la pluie et la brume.
- Contrôle des assets : `blender/check_assets.py` (via le MCP Blender)
  signale les faces superposées (qui clignotent) et le décor qui flotte. À
  relancer après toute modification des générateurs. Pour poser du décor sur
  le sol dans un générateur : `Ground(terrain).lowest_under(x, y, rayon)`
  (vrai maillage, pas la formule du relief) ; les arbres passent par
  `tree_base()` (`level.py`).
- Pêche : `FishingController` orchestre les modules de `src/fishing/` via
  une `StateMachine` (`src/core/stateMachine.ts`). Les transitions sont
  dans `fishingState.ts`. Le temps passé dans un état (`timeInState`) est
  compté en temps de jeu.
- Poisson ferré : `HookedFish` regroupe le tirage (`selectFish`), le combat
  (`ReelFight`, logique pure et testable) et le modèle 3D. Il est tiré au
  ferrage.
- Progression : `Progress` (`src/core/progress.ts`) possède `Journal`,
  `Stats` et `Settings`. Elle relit la sauvegarde au lancement (`readSave`)
  et écoute `FishingController.events` (cast, catch, escape, bait) pour
  sauvegarder (`SaveStore`, regroupé). Le format est versionné (`VERSION`
  dans `save.ts`) : ajouter une migration si la structure change. Tout ce
  qui est relu est validé (`validate.ts`).
- Cycle jour/nuit : `DayNight.update(hour)` renvoie une `Ambience`, que
  `Game.applyAmbience()` distribue au ciel, aux lumières, à l'eau, à la
  lanterne et au bouchon. Les ambiances clés sont dans `CONFIG.dayNight`.
- Pause : `Game.update` saute l'horloge, la barque, la pêche et le temps de
  jeu quand le carnet est ouvert (le rendu continue).
- Tests dans la console (dev) : touche T = +1 h (passe minuit),
  `game.resetSave()`, `game.progress`, `game.clock.setHour(h)`.
- Pêche : `FishingController` n'est qu'une porte d'entrée. L'état partagé et
  les actions communes sont dans `FishingContext`, chaque groupe d'états
  dans sa phase (`castPhase`, `bitePhase`, `reelPhase`), et l'animation du
  matériel dans `tackleAnimator`. Nouvelle logique de pêche = dans la phase
  concernée.
- Assets Blender : sources dans `blender/` (`petite_peche.blend`, une scène
  par asset). `export_assets.py` exporte vers `assets/`, et
  `generate_assets.py` + `petite_peche/*.py` recréent tout (en écrasant le
  fichier). Ils ont été produits via le MCP Blender (`runpy.run_path` sur ces
  scripts). Après une retouche d'asset, relancer l'export, pas la
  génération.
- Profondeur de l'eau : `HeightSampler` (grille de triangles, pas de
  raycast) ; il supporte les terrains détaillés. `surfacesAt` donne aussi
  l'orientation des faces (une face double face compte comme « vers le
  haut »).
- États du jeu : `Game` a une `StateMachine` (title → playing ⇄ paused ⇄
  journal). `updateWorld()` n'est appelé qu'en `playing` ; `animate()` (eau,
  flottaison, ciel, lucioles, caméra) tourne toujours.
- Eau : `createWaterSurface(level, sampler)` recrée une grille (emprise de
  `water`) avec les attributs `depth` et `depthSmooth`, mesurés avec le
  `HeightSampler` du décor visible. Les faces orientées vers le bas
  permettent de voir sous un surplomb (tablier du ponton). Le même sampler
  sert à la caméra, qui reste au-dessus du décor
  (`camera.minHeightAboveGround`). `water.ts` étend MeshStandardMaterial via
  `onBeforeCompile` (attention aux sauts de ligne avant les directives
  `#`). Les vagues sont définies une seule fois (`CONFIG.water.waves`) et
  existent en GLSL (`waveGlsl`) et en TS (`waveHeight`) : tout ce qui flotte
  doit utiliser `waveHeight`.
- Audio : trois canaux (sfx, ambience, music) sous un master, suivi d'un
  limiteur ; les calques d'ambiance passent par un passe-bas
  (`ambience.lowpassHz`). Ambiance jour et nuit en boucles fondues
  (`setNight`). `MusicBox` sert de musique générative si `audio/music.ogg`
  est absent. Volumes = (curseur du joueur)² × `CONFIG.audio` ; niveau
  général = `outputGain`. Le master est muet jusqu'au premier geste, puis
  fondu d'entrée (`fadeIn`). Le mixage est volontairement doux (le joueur
  s'est plaint d'un son trop fort) : niveaux mesurés dans
  `docs/PROGRESS.md` › « Son adouci ». Pour re-mesurer : importer
  `src/audio/synth.ts` dans un script Node avec un faux contexte
  (`sampleRate`, `createBuffer`) et calculer crête et niveau moyen.
- Réglages : `Settings` (`src/core/settings.ts`), valeurs par défaut dans
  `CONFIG.settingsDefaults`, relus par `parseSettings`, appliqués par
  `Game.applySettings()`, modifiés depuis `SettingsPanel`.
- Eau et barque : l'eau évite les pixels marqués par le masque `water_mask`
  (stencil, `src/scene/waterMask.ts`). Le renderer est créé avec
  `stencil: true`. Tout nouveau matériau d'eau (shader de la phase 5,
  écume…) doit appeler `avoidDryPixels()`.
- Clavier : `CONFIG.controls` accepte des lettres (reconnues d'après
  `event.key`, donc WASD et ZQSD en même temps, WASD affiché par défaut) et
  des codes physiques (`event.code`) pour les autres touches.
- Repère de la canne : pitch négatif = pointe vers le haut, yaw négatif = vers
  la droite. Les impulsions (`kick`) positives font plonger la pointe.
- Textes et langues : le jeu est en français et en anglais.
  - `src/core/language.ts` lit la langue une fois, au chargement de la page
    (clé `petite-peche/language` du navigateur, sinon la langue du
    navigateur : français s'il est en français, anglais sinon). `LANGUAGE`
    et `pick(fr, en)` sont donc figés pour la session ; changer de langue
    (`Game.changeLanguage`, écran titre) enregistre le choix et recharge la
    page.
  - Interface : `src/ui/texts.fr.ts` (`FR`, la référence, commentée) et
    `src/ui/texts.en.ts` (`EN: Texts`, même forme : une entrée manquante ne
    compile pas). `src/ui/texts.ts` exporte `TEXTS = pick(FR, EN)` et les
    formats (`formatDate`…). Tout nouveau texte va dans les deux fichiers.
  - Données (`src/data/` : poissons, appâts, lieux, météo, boutique,
    trouvailles) et noms de touches (`controls.ts`) : traduits sur place
    avec `pick('français', 'anglais')`.
  - Ne jamais écrire de ponctuation française en dur dans le code de
    l'interface : `TEXTS.colon` (` : ` en français, `: ` en anglais) et
    `TEXTS.quote()`.
  - Le code, ses commentaires et les messages de console restent en
    français. `index.html` et le manifeste aussi (le nom du jeu ne se
    traduit pas).
- Sons : `AudioManager.play(id)`. Un emplacement par son dans
  `CONFIG.audio.files`, avec repli sur `src/audio/synth.ts`.
- `window.game` (dev) expose `game.fishing`, `game.boat`, etc., utiles pour
  tester depuis la console.
- Mobile : `pointerMode.ts` (mode tactile, classe `is-touch` sur `<html>`),
  `TouchStick` (joystick, additionné au clavier dans
  `Game.readBoatControls`), textes tactiles à côté des textes clavier dans
  `texts.ts` (`touchPrompts`, `touchContinue`, `touchControls`). `Input` ne
  suit qu'un pointeur à la fois (`activePointer`) : un autre doigt ne vise
  pas et ne lâche pas le lancer. Pour tester dans le navigateur, simuler des
  `PointerEvent` avec `pointerType: 'touch'`.
- Poissons : squelette `<id>_rig` (spine, head, tail_1, tail_2) et une
  action `swim` partagée, dans `blender/petite_peche/fish.py`.
  `FishModel` joue le clip s'il existe, sinon l'ondulation en shader.
- Progression (`src/progression/`) :
  - `Progression` est possédée par `Progress` ; elle regroupe
    `RequestBoard` (demandes) et `Shop` (achats, décoration) ;
  - solde de coquillages = objectifs déduits du carnet
    (`objectives.ts`) + demandes accomplies − achats. Rien n'est stocké pour
    les objectifs ;
  - `ProgressionHud` (`src/ui/`) relie ses événements au HUD, au décor
    (`Decor`, qui repeint via `ColorSwap`) et à la carte de prise ;
  - le catalogue est dans `src/data/shop.ts` : la décoration à prix 0 donne
    la couleur d'origine que le jeu cherche dans le modèle ;
  - le matériel passe au combat par `FishingDeps.gear` (`Gear` dans
    `reelFight.ts`).
- `FishRoll` porte `variant`, `habitat` et `slot` (pour les demandes). Une
  variante est un modèle chargé à part et recoloré (`fishModel.ts`). Les
  patchs de shader s'enchaînent via `extendMaterial`.
- Moustache : Empty `npc_cat` (facultatif) + `props/cat.glb` (`cat_tail`
  balance), `src/scene/cat.ts`. Sa bulle « ! » est un élément HTML placé
  par projection (`CatBubble`).
- États du jeu : `cabin` (ponton) se comporte comme `journal`
  (`openOverlay` / `closeOverlay`).
- Tests en console : `game.newRequestsDay()` renouvelle les demandes.
- Vivier : Empty `fish_pen` (centre de l'eau du bac, rayon = échelle) et
  `cam_fish_pen` (vue rapprochée), tous deux facultatifs. `FishPen`
  (`src/scene/fishPen.ts`) charge une instance de modèle par poisson
  (`loadFishInstance`, non partagée). Les poissons gardés sont dans
  `Progression` (`keptFish`, événement `pen`). La vue rapprochée est l'état
  de jeu `pen` (ponton ⇄ vue), via `CameraRig.setView()` et
  `Hud.setViewMode()`.
- Rendez-vous (`src/progression/rendezvous.ts`) :
  - `GameClock` compte les jours (`day`, sauvegardé dans `world.day`) ;
    `advance()` fait passer minuit ;
  - `moonPhase` et `isFullMoon` changent à midi ;
  - les coups de pouce passent au tirage par `FishingDeps.boosts`
    (`FishBoosts` dans `fishSelector.ts`) ;
  - le poisson du jour est tiré d'après la date locale (rien n'est
    sauvegardé, sauf le jour où son bonus a été gagné).
- Tests : `game.clock.setTime(3, 20.9)` amène la nuit de pleine lune du
  3ᵉ jour (cycle de 6 jours).
- Lieux (`src/data/places.ts`) :
  - chaque espèce a son `place`, et chaque lieu son niveau ;
  - le lieu courant est dans la sauvegarde (`world.place`), et
    `Game.create` le lit avant de charger le niveau ;
  - voyager (`Game.travel`) sauvegarde, pose un mot dans sessionStorage
    (`src/core/travel.ts`) et recharge la page, qui arrive directement en
    jeu. Aucun démontage de scène à chaud ;
  - le tirage (`SelectionContext.place`), les demandes et le poisson du jour
    ne portent que sur les espèces du lieu ;
  - déblocage : `Progression.placeProgress()` et l'événement `unlock`.
  - Tests : `game.travel('river')` / `game.travel('lake')`.
- Rivière :
  - Empty `water_flow` → `LevelData.flow` → `setWaterFlow()`. Le motif des
    vagues est évalué en (x, z) − courant × temps, en GLSL comme dans
    `waveHeight` ;
  - `DriftingLeaves` et le calque audio `river` n'existent que si le courant
    n'est pas nul ;
  - générateur : `blender/petite_peche/river.py`.
- Météo :
  - `Weather` (`src/core/weather.ts`) avance avec les heures de jeu (que
    renvoie `GameClock.update`) et est sauvegardé dans `world.weather` ;
  - `intensity(id)` donne le fondu ;
  - `WeatherEffects` gère pluie, ronds, teinte de l'ambiance
    (`tint`, avant de la distribuer), couverture du ciel et houle du vent
    (`setWaterWaveScale`, en GLSL comme dans `waveHeight`) ;
  - effets sur la pêche : `BiteContext.weather` (attente) et
    `SelectionContext.weather` (temps préféré, `FishSpecies.weather`) ;
  - tests : `game.weather.set('rain')`.
- Tutoriel : `Tutorial` (`src/ui/tutorial.ts`) écoute les événements de la
  pêche et regarde l'état à chaque frame. `Progress.tutorialDone` est
  sauvegardé (`tutorial.done`), et vrai d'office si la partie a déjà des
  lancers.
- Équilibrage : les poids de rareté ne comptent qu'entre les espèces
  possibles au même endroit et à la même heure. Chaque combinaison lieu ×
  zone × créneau doit avoir des espèces non légendaires (contrôle au
  démarrage dans `checkFishData`). Pour re-simuler, exécuter les modules du
  jeu dans le navigateur (`selectFish`, `waitTime`, `ReelFight`) : voir
  `docs/PROGRESS.md`.
- Signes de poissons : `FishSigns` implémente `HotspotQuery` (via
  `FishingDeps.hotspots`).
  - Au plouf, `castPhase.land` appelle `claim(x, z)` : le coin pêché
    s'éteint, et `ctx.hotspot` passe à vrai.
  - Effets : `BiteContext.hotspot` (attente × `signs.waitFactor`) et poids ×
    `signs.rarityBoost` pour les espèces non communes.
  - Les signes n'avancent qu'en jeu (`updateWorld`).
- Vent dans le décor : les objets `deco_*_sway` → `LevelData.sway` →
  `WindSway`.
  - Attribut `swayWeight` calculé au chargement avec un `HeightSampler` sur
    le reste du décor.
  - Matériaux clonés, patchés dans `begin_vertex`.
- Petites bêtes : `Critters` (InstancedMesh). Présence = jour × pas de
  pluie × pas de brume.
- Caméra : `GroundQuery(x, z, y)` → `HeightSampler.groundAt`. Elle se
  relève seulement si la surface juste au-dessus d'elle regarde vers le haut
  (dans une colline), pas sous un pont.
- Touches : `src/core/controls.ts`. Le jeu lit les touches d'une action avec
  `keysFor(action)` (touche choisie par le joueur + flèches pour ramer), et
  les textes avec `keyHints()`. Les textes qui affichent une touche sont des
  fonctions `(k: KeyHints) => string` dans `texts.ts`. Après un changement de
  touches, `Game.applyComfort()` rafraîchit les invites, le HUD et le
  tutoriel.
- Confort : `Game.applyComfort()` applique les réglages (`--text-scale` en
  CSS, classe `reduce-motion`, `setMotionScale` sur la barque, la météo et le
  vent, `fishing.setComfort`, `stick.setSensitivity`). Dans `style.css`,
  toute taille de police s'écrit `calc(Npx * var(--text-scale, 1))`.
- Lieux au bord de la mer : `Place.sea` (`SeaLook`) → `Game.applySeaLook()`
  (teinte de l'eau `setWaterTint`, houle `WeatherEffects.setBaseWaves`, son
  `audio.setSea`, couleur des oiseaux). Un lieu sans `sea` garde l'eau
  douce.
- Carnet : `JournalView` reçoit le lieu actuel et s'ouvre sur ses poissons.
- PWA (`src/pwa/`) :
  - `Pwa` (créée dans `main.ts`, `register()` après `game.start()`) :
    installation (`beforeinstallprompt`), aide iPhone, mise à jour en
    attente. Les menus la lisent comme `AppStatus` et se réaffichent sur son
    événement `change` ;
  - le service worker (`serviceWorker.ts`) n'est compilé qu'au build, par
    `scripts/pwaPlugin.ts`, qui remplace `__PRECACHE_MANIFEST__` par la
    liste des fichiers (build + `assets/`) et leurs empreintes. Il se
    vérifie avec `tsconfig.sw.json` (types WebWorker) ; le `tsconfig.json`
    principal l'exclut ;
  - stratégie : cache d'abord (`ignoreVary`), réseau ensuite, 404 hors
    ligne pour un fichier inconnu. Une nouvelle version attend le message
    `skip-waiting` (bouton « Mettre à jour » → `Game.applyUpdate()`, qui
    sauvegarde d'abord) ;
  - pas de service worker en dev. Pour tester : `npm run build` puis
    `npm run preview`.
- Nom du jeu : « Au fil de l’eau » (`TEXTS.menu.logo`, `index.html`, manifeste ;
  « Fil de l’eau » sous l'icône). Les identifiants internes gardent
  `petite-peche` (clés de sauvegarde et de voyage, cache du service worker,
  nom du paquet npm, fichiers Blender) : ne pas les renommer, sinon les
  parties en cours seraient perdues.
- Lumières de nuit : `NightLights` (`src/scene/nightLights.ts`) trouve les
  meshes émissifs du décor (lanternes, fenêtres, lanterne du phare), règle
  leur éclat selon `night`, leur ajoute un halo (sprite additif) ; les
  `CONFIG.nightLights.maxLights` `PointLight` (toujours présentes,
  intensité 0 le jour : pas de recompilation des shaders) vont aux sources
  les plus proches de la barque (voir plus bas). L'Empty
  `beacon` (`LevelData.beacon`) porte le faisceau tournant d'un phare (cônes
  additifs dont la couleur des sommets s'éteint avec la distance).
- Assets, finitions : `generate_assets.py` cuit l'occlusion ambiante des
  niveaux dans « Col » (`petite_peche/ambient.py`, Cycles, ~quelques
  secondes par niveau : l'appel MCP peut dépasser son délai, Blender finit
  quand même). La flore (`petite_peche/flora.py`) a son propre tirage
  (`build_flora(..., seed=...)`) et des règles de placement par niveau
  (`lake_flora`, `river_flora`, `cove_flora`). La variation de teinte du
  terrain (`patchy` dans `common.py`) ne consomme pas le tirage aléatoire :
  les arbres et rochers ne bougent pas. Niveaux exportés : ~0,9 à 1 Mo.
- Ombres : la petite flore (`deco_grass*`, `deco_flowers*`,
  `deco_pebbles*`) ne projette pas d'ombre (`setupShadows`).
- Rames : `Oars` (`src/scene/oars.ts`) anime `oar_l`/`oar_r` de boat.glb
  (quaternion d'origine × balayage autour de Y × plongée autour de Z ; la
  rame droite est en miroir). Chaque rame a sa phase : commande gauche =
  avancer + tourner, droite = avancer − tourner. Rangées pendant la pêche
  (`fishing.isBusy`). Mise à jour dans `updateWorld` avec les commandes.
- Pêcheur : `Fisher` (`src/scene/fisher.ts`), assis sur `fisher_seat`.
  `Game.fisherPose()` choisit les cibles des mains (poignées des rames au
  repos, `Rod.gripPosition` et `Rod.crankPosition` en pêche, genou pendant
  l'attente, bras levés à la prise) ; le bras est résolu en IK à deux
  segments (coude vers l'extérieur et l'arrière). Mis à jour dans `animate`
  (tourne aussi en pause).
- Lancer : `CastAim.target()` donne le cap et la distance du point d'eau
  sous le pointeur ; `CastPhase.aimDistance()` les garde tels quels à la
  souris, et au doigt part du point touché puis ajoute le glissement
  vertical (`CONFIG.touch.aimMetersPerPixel`, d'après `Input.pointerPixels`).
  `ctx.power` n'est plus une jauge : c'est la portée visée (0 → 1), pour
  pencher la canne. Un appui relâché avant la première image de `CHARGING`
  lance quand même (`!isPointerHeld`).
- Sprint : `BoatControls.sprint` (touche `sprint`, modifiable, ou
  `TouchStick.sprint` quand le joystick est poussé à fond vers l'avant).
  `Boat.propel` ne plafonne jamais sous la vitesse d'erre : après un
  sprint, la barque ralentit toute seule. Le sillage est espacé en mètres
  (`CONFIG.wake.spacing`), pas en secondes.
- Effets du décor : Empties `fx_smoke_<n>`, `fx_fire_<n>`, `fx_mist_<n>` →
  `LevelData.effects` → `LevelEffects` (`src/scene/levelEffects.ts`), qui
  possède trois lots de `Particles` (`particles.ts` : carrés instanciés
  face à la caméra, un appel de dessin par lot ; volutes, lueurs, gouttes)
  et les `Campfire`. `LevelEffects.splash(x, z, force)` sert à toutes les
  éclaboussures (la pêche y accède par `FishingDeps.splash`). Les volutes
  et les gouttes prennent la lumière du moment (`setAmbience`).
- Lumières de nuit : `NightLights` garde une liste de `LightSource` (objets
  émissifs + feux via `addSource`) et prête ses `maxLights` PointLight aux
  plus proches de la barque, en fondu (`lend`). Un feu règle son
  `flicker`. Ne jamais créer de PointLight ailleurs pour le décor.
- Scintillement de l'eau : dans `FRAGMENT_REFLECTION` (`water.ts`), piloté
  par `CONFIG.water.sparkle` et la lumière principale (`setWaterAmbience`).
- Générateurs de niveaux : `grid_coords` et `build_grid_terrain`
  (`common.py`) font le terrain (grille fine où l'on joue, large au loin).
  `blender/regenerate_levels.py` ne recrée que les trois niveaux. Via le
  MCP Blender : ouvrir le `.blend` (`open_mainfile`) dans un appel, lancer
  les scripts dans le suivant (le contexte est vide juste après
  l'ouverture) ; rediriger la sortie de `export_assets.py` (très bavarde).
  `hills()` du lac ne descend jamais sous 0,3 m (sinon des flaques
  apparaîtraient à terre, là où le sol passe sous le niveau de l'eau).
- Vie sur l'eau : `WaterLife` (`src/scene/waterLife.ts`) possède
  `LilyPads` (feuilles, fleurs et grenouilles, autour des zones `reeds`,
  eau douce seulement), `Ducks` (palette `MALLARDS` ou `GULLS` au bord de la
  mer), `Heron` (absent s'il n'y a pas deux coins d'eau de 6 à 38 cm dans
  les zones `shallow` / `reeds`) et `FishShadows`. Rien n'est posé dans
  Blender. `WaterMap` (`waterMap.ts`) répond aux questions sur l'eau :
  `depthAt`, `isOpen` (eau libre, hors collisions), `isClearPath`,
  `randomPoint`, `surfaceAt` (vagues amorties près du bord, comme dans le
  shader : passer la profondeur pour ce qui flotte en eau peu profonde).
  Les petits modèles en code passent par `tinted()` et `merged()`
  (`lowPoly.ts`). Mise à jour dans `animate` (elle vit aussi en pause).
- Trouvailles : Empties `find_<n>` → `LevelData.finds` → `Flotsam`
  (`src/scene/flotsam.ts`, objets flottants et repêchage, seulement en
  `playing`). La logique est dans `Finds` (`src/progression/finds.ts`,
  possédée par `Progression`) : coins du jour tirés d'après la date et le
  lieu (`activeSpots`), objets dans la barque (`carried`), collection ;
  `Progression.pickFind()` / `redeemFinds()` et l'événement `finds`. La
  liste des objets est dans `src/data/finds.ts`. `CabinView` rachète les
  objets en ouvrant l'onglet « Trouvailles ». Sauvegarde : champ
  `progression.finds`, ajouté sans changer `VERSION`.
- Tenue du pêcheur : emplacements `hat`, `coat`, `scarf` de `DecorSlot`
  (`src/data/shop.ts`, catégorie de boutique `outfit`). `Decor` repeint
  `fisher.glb` par `ColorSwap` ; les pièces sombres assorties (bande du
  bob, rabat du ciré) sont dans `TRIMS` (`decor.ts`).
- Sons : `pickup`, `quack`, `croak` s'ajoutent aux effets (`SoundId`).
- Tests en console : `game.waterLife`, `game.flotsam`,
  `game.progress.progression.finds`.
- Qualité graphique : `src/core/quality.ts`. Le réglage `quality`
  ('auto' | 'low' | 'medium' | 'high') remplace les anciens `shadows` et
  `resolution` (repris par `parseQuality` : « économe » ou ombres coupées →
  'low'). `Game.applyQuality(level)` applique `CONFIG.quality.presets` :
  plafond du pixel ratio, ombres ('boat' ou 'full', taille de carte),
  `LevelData.shadowCasters` et `LevelData.flora` (petite flore cachée),
  `NightLights.setMaxLights`, `Clouds.setDensity`, `LevelEffects.setDensity`.
  En mode automatique, `QualityGovernor` démarre selon l'appareil ('high'
  partout, `CONFIG.quality.auto`) et baisse d'un cran sous `minFps` (jamais
  de remontée) ; il mesure avec
  `performance.now()` (sans le plafond de la boucle) et ignore les images
  d'un onglet caché. `FpsMeter` + `Hud.setFps` : compteur (réglage
  `showFps`). Tests : `game.governor.current`. Dans la prévisualisation de
  l'app, le volet caché ralentit `requestAnimationFrame` : on ne peut pas
  y mesurer les images par seconde, et une capture peut avoir une image de
  retard.

