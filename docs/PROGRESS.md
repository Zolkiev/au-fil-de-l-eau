# Avancement — Au fil de l’eau

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Scène placeholder, caméra, barque, levelLoader | ✅ Validée |
| 2 | Lancer, bouchon, attente, touche, ferrage (+ appâts, horloge, sons générés) | ✅ Validée |
| 3 | Mini-jeu de remontée, présentation de la prise, données poissons | ✅ Validée |
| 4 | Carnet, sauvegarde, cycle jour/nuit, zones | ✅ Validée |
| 5 | Shader d'eau, polish, sons, menu, réglages | ✅ Validée |
| + | Découpage de la pêche, assets Blender | ✅ Livré le 2026-09-29, **à tester** |
| + | Contrôle qualité, nage des poissons, jouable sur mobile | ✅ Livré le 2026-09-30, **à tester** |
| + | Progression : objectifs du carnet, demandes de Moustache, boutique | ✅ Livré le 2026-09-30, **à tester** |
| + | Vivier de la cabane, pleine lune, poisson du jour | ✅ Livré le 2026-09-30, **à tester** |
| + | Nouveau lieu : la rivière (6 espèces, déblocage, voyage) | ✅ Livré le 2026-09-30, **à tester** |
| + | Météo, tutoriel de Moustache, équilibrage et contrôle qualité | ✅ Livré le 2026-09-30, **à tester** |
| + | Vie du décor et signes de poissons | ✅ Livré le 2026-09-30, **à tester** |
| + | Accessibilité et confort (texte, animations, ferrage, touches) | ✅ Livré le 2026-09-30, **à tester** |
| + | Troisième lieu : la crique (6 espèces marines) | ✅ Livré le 2026-09-30, **à tester** |
| + | Application installable (PWA) et jeu hors connexion | ✅ Livré le 2026-09-30, **à tester** |
| + | Polish visuel (1) : assets corrigés, éclairage, ombres du décor, nuages | ✅ Livré le 2026-09-30, **à tester** |

---

## Polish visuel (1) : assets, éclairage, ombres, nuages

### Livré

- **Barque** : le tableau arrière et l'étrave ne clignotent plus. Faces
  extérieure, intérieure et tranche étaient dans le même plan ; l'intérieur
  s'arrête maintenant 5 cm avant (épaisseur des planches).
- **Contrôle automatique des assets** (`blender/check_assets.py`) : faces
  superposées et décor qui flotte, dans toutes les scènes. Il a trouvé et on
  a corrigé :
  - l'arbre de l'île du lac (33 cm au-dessus du sol) et des arbres en pente
    (jusqu'à 14 cm de vide côté aval), au lac et à la crique ;
  - un rocher de la rivière (22 cm) et quelques roseaux ;
  - le socle du phare (58 cm de vide côté pente) ;
  - les toits de la cabane (lac) et de la cabane de plage, le pont de la
    rivière (306 triangles), la poignée de la canne, les pupilles des 22
    poissons.

  Le décor est maintenant posé sur le **vrai maillage** du terrain
  (`Ground` dans `common.py`), sous le point le plus bas autour de sa base.
  Chaque arbre est aussi tourné à sa façon (forêt moins uniforme).
- **Éclairage** :
  - tone mapping « Neutral » à la place d'ACES : les couleurs de la palette
    restent franches (`CONFIG.render.toneMapping`, 'aces' pour revenir) ;
  - soleil plus fort, lumière du ciel plus douce : les faces à l'ombre et au
    soleil se distinguent, le relief ressort ;
  - soleil plus bas le matin et le soir (ombres plus longues, lumière
    dorée), ciel plus bleu le jour, brouillard plus lointain ;
  - le ciel passe par le même rendu des couleurs que le reste (l'horizon
    raccorde avec le brouillard) ;
  - l'eau reflète davantage le ciel (bleue le jour, rose au couchant) et
    reste claire malgré une lumière du ciel plus douce.
- **Ombres du décor** : la zone d'ombre suit la barque sur 64 m. Arbres,
  roseaux, rochers, cabane, ponton, pont, phare, Moustache et la barque y
  projettent leur ombre, sur le terrain, l'eau et le décor. Elle avance par
  pas d'un pixel d'ombre : pas de scintillement quand on rame. Carte de
  2048 px, 1024 en définition « Économe ».
- **Nuages low poly** : une vingtaine d'amas qui dérivent lentement (plus
  vite avec le vent), dessous éclairé par la couleur de l'horizon : blancs
  le jour, pêche et rose au couchant, bleutés la nuit. Sous la pluie ou dans
  la brume, ils sont plus nombreux et plus gris. Réglages : `CONFIG.clouds`.

### Vérifications déjà faites

- Contrôle des assets : rien à signaler après les corrections. L'outil a été
  vérifié sur une scène d'essai (bloc qui flotte et bloc en pente détectés,
  toit qui déborde d'un poteau accepté).
- Captures : tableau arrière (uni, plus de damier), île (arbres plantés),
  lac à 7 h, 14 h, 19 h 20 et 22 h 30, nuages de jour, au couchant et sous la
  pluie, rivière (ombre du pont sur l'eau), crique (falaises à l'ombre).
- Une image complète (mise à jour + rendu avec ombres) prend moins de 1 ms
  sur le Mac de développement. La fluidité sur téléphone reste à juger en
  jouant.

### Comment tester

- Joue à différentes heures (touche T = +1 h) et par différents temps
  (`game.weather.set('rain')` en console).
- Rame près des berges : les arbres font de l'ombre sur l'eau et sur la
  barque.
- Réglages › Définition « Économe » : ombres plus légères pour les petits
  appareils.

### Limites connues

- Les ombres des arbres ne suivent pas leur balancement au vent.
- Au-delà de 32 m de la barque, le décor ne projette plus d'ombre (la zone
  suit la barque).

## Application installable (PWA) et jeu hors connexion

### Livré

- **Installable** sur l'écran d'accueil (Android, iPhone, iPad) et comme
  application sur ordinateur (Chrome, Edge) :
  - manifeste `assets/manifest.webmanifest` : nom, couleurs, plein écran,
    orientation libre ;
  - icônes dans `assets/icons/` : un bouchon qui flotte au coucher du soleil
    (onglet, 192 et 512 px, version « maskable » pour Android, 180 px pour
    iPhone). Elles sont produites par `scripts/make_icons.py` (SVG converti
    avec `sips`, fourni avec macOS) ;
  - écran titre : bouton « Installer le jeu » quand le navigateur le
    propose (Chrome, Edge, Android). Sur iPhone et iPad, Safari n'a pas de
    bouton : une ligne explique « Partager › Sur l'écran d'accueil ».
- **Hors connexion** : un service worker (`src/pwa/serviceWorker.ts`)
  garde tout le jeu en cache : code, les trois lieux, les 22 poissons,
  accessoires, icônes (43 fichiers, environ 4 Mo). Il s'installe après le
  lancement du jeu, pour ne pas ralentir le premier chargement. Une fois
  prêt, un message l'annonce : « Le jeu est prêt : il se lancera même sans
  connexion. »
- **Mises à jour** :
  - une nouvelle version se télécharge en arrière-plan. Seuls les fichiers
    modifiés sont retéléchargés (empreinte par fichier) ;
  - elle ne s'applique jamais en pleine partie. L'écran titre et la pause
    affichent « Une nouvelle version du jeu est prête » avec un bouton
    « Mettre à jour » : la partie est sauvegardée, puis la page se recharge ;
  - sinon, la nouvelle version s'applique au prochain lancement ;
  - le jeu revérifie au retour sur l'onglet (au plus toutes les 30 min,
    `CONFIG.pwa.updateCheckMinutes`).
- **Sans dépendance** : le plugin `scripts/pwaPlugin.ts` (branché dans
  `vite.config.ts`) compile le service worker en `dist/sw.js` et y inscrit
  la liste des fichiers du build et du dossier `assets/`, avec leurs
  empreintes. Un fichier ajouté dans `assets/` (un son, un poisson…) est
  donc mis en cache au build suivant, sans rien toucher.
- `npm run typecheck` vérifie aussi le service worker (`tsconfig.sw.json`,
  types d'un worker).

### Vérifications déjà faites

- Build de production (`npm run preview`) : service worker actif, 43
  fichiers en cache, message « Le jeu est prêt » affiché.
- **Serveur arrêté**, page rechargée : le jeu démarre en entier depuis le
  cache (lac, barque, modèles). Correction en route : le serveur répond
  « Vary: Origin », et le cache ne servait alors pas les <script> et
  <link> du build. Le cache ignore maintenant cet en-tête.
- Mise à jour simulée (texte modifié, nouveau build) : nouvelle version
  détectée, avis « Mettre à jour » affiché ; seuls `index.html` et le JS ont
  été retéléchargés (41 fichiers repris) ; après le clic, la page se
  recharge sur la nouvelle version et l'ancien cache est supprimé.
- Mise en page vérifiée (bureau et téléphone) : bouton « Installer le
  jeu », aide pour iPhone, avis de mise à jour dans l'écran titre et dans la
  pause.
- Tests nettoyés : service worker désinscrit et caches vidés sur
  localhost:4173.

### Comment tester

- `npm run build` puis `npm run preview` (http://localhost:4173) : le
  service worker ne tourne qu'avec le build, pas avec `npm run dev`.
- Chrome › outils de développement › Application : manifeste, service
  worker, cache « petite-peche-… ». Case « Offline » (onglet Réseau), puis
  recharger : le jeu démarre.
- **Sur téléphone**, le site doit être servi en **HTTPS** (GitHub Pages,
  Netlify…). En http sur le réseau local (`npm run dev -- --host`), le
  navigateur refuse le service worker et l'installation.

### Limites connues

- iPhone et iPad : l'application installée a sa **propre sauvegarde**,
  séparée de celle de Safari. Une partie commencée dans Safari ne se
  retrouve pas dans l'icône de l'écran d'accueil (et inversement). Sur
  Android, la sauvegarde est la même.
- Sur itch.io, le jeu tourne dans un cadre (iframe) : le hors connexion
  peut marcher, mais pas l'installation.
- `scripts/make_icons.py` utilise `sips`, donc macOS.

## Troisième lieu : la crique

### Livré

- **La crique** (`levels/cove_01.glb`) : une baie au bord de la mer, avec
  une plage de sable, une cabane de pêcheur et du bois flotté, un ponton de
  bois où Moustache attend, des falaises couvertes de pins, un phare rayé
  sur le cap ouest (sa lampe brille la nuit), des rochers sur le cap est,
  des herbiers et une ligne de bouées qui marque la limite du large.
- **Déblocage** : attraper 4 espèces de la rivière. Le voyage passe par la
  carte du ponton, comme pour la rivière.
- **Ambiance marine** (`Place.sea` dans `src/data/places.ts`) :
  - eau turquoise (teinte mélangée au dégradé du jour et de la nuit) ;
  - houle × 1,7 : la barque tangue un peu plus qu'au lac ;
  - mouettes blanches à la place des oiseaux sombres ;
  - une boucle de ressac générée (vagues toutes les 7,5 s, cris de
    mouettes), à remplacer par `audio/sea.ogg`.
- **6 espèces marines** (22 au total) :

  | Espèce | Rareté | Où | Quand |
  | --- | --- | --- | --- |
  | Maquereau rayé | commun | large, profond, peu profond | aube, jour, crépuscule |
  | Rouget corail | commun | peu profond, rochers, herbiers | toute la journée et la nuit |
  | Bar d'écume | peu commun | partout | aube, crépuscule, nuit |
  | Daurade dorée | peu commun | peu profond, herbiers, large, profond | jour, crépuscule |
  | Vieille arlequin | rare | rochers, herbiers | aube, jour |
  | Espadon des marées | légendaire | profond, large | nuit (150 à 260 cm) |

  Chacune a ses appâts, son temps préféré, sa variante et sa description.
- **Carnet** : il s'ouvre maintenant sur les poissons du lieu où l'on pêche,
  et son en-tête (titre, bouton fermer) reste en haut quand on fait défiler.
- Les noms de zones n'ont plus le suffixe de doublon de Blender
  (`zone_deep_1` au lieu de `zone_deep_1002`).

### Assets Blender

- `blender/petite_peche/cove.py`, scène `cove_01` : relief (côte en arc,
  deux caps), plage, eau, rochers, herbiers `deco_seagrass_sway`, pins
  `deco_trees_sway`, phare, lampe `deco_lighthouse_lamp` (émissive), ponton,
  cabane, bouées, collisions (`shore_col`, `open_sea_col`, `pier_col`,
  `rock_XX_col`), 5 zones, `spawn_boat`, `cam_default` et `npc_cat`.
- La barque part tournée vers la falaise et le phare, le large à droite
  (`SPAWN_HEADING` dans `cove.py`).
- 6 poissons ajoutés dans `fish.py` (rostre de l'espadon, rayures du
  maquereau, barbillons du rouget, taches de la vieille…), avec le même rig
  et l'action `swim` partagée.
- `generate_assets.py` et `export_assets.py` connaissent la crique. Tout a
  été régénéré et exporté (29 scènes, `cove_01.glb` : 218 Ko).

### Vérifications déjà faites

- Chargement de la crique : 5 zones, Moustache au bout du ponton, départ
  face au phare, eau turquoise ; captures de jour et de nuit (lampe du
  phare allumée).
- Seul avertissement : les sons absents (comme aux autres lieux). Aucune
  alerte sur les données des poissons (`checkFishData`).
- Répartition des touches simulée (4 000 tirages par zone et par créneau) :
  au moins deux espèces partout. La nuit, au large et en profondeur, c'est
  surtout le bar, avec l'espadon à 2-3 % des touches.
- Prises simulées : espadon de 250 cm (présentation, trophée, demande de
  Moustache), maquereau, rouget, vieille, daurade ; vignettes du carnet
  correctes.
- Carte du ponton : trois lieux, avec leurs conditions de déblocage.

### Comment tester

- Débloque la crique (4 espèces de la rivière), ou en console (dev) :
  `game.travel('cove')`.
- Pêche la nuit près des bouées pour l'espadon (`game.clock.setHour(23)`).

### Limites connues

- Pas de vivier dans le décor de la crique : les poissons gardés restent
  listés au ponton (comme à la rivière).
- La houle est la même partout dans la crique (pas plus forte au large).

## Accessibilité et confort

### Livré

- **Réglages › Confort** :
  - **taille du texte** : Normale, Grande (× 1,2) ou Très grande (× 1,4),
    appliquée à tout le HUD, aux menus, au carnet et au ponton ;
  - **moins d'animations** : la barque tangue moins, les vagues et le vent
    dans le décor sont réduits (× 0,35), et les animations de l'interface
    sont coupées. Activé d'office si le système le demande
    (`prefers-reduced-motion`) ;
  - **ferrage facile** : la fenêtre pour ferrer passe de 0,8 à 1,6 s ;
  - **grand bouchon** : bouchon 1,5 fois plus grand ;
  - **sensibilité du joystick** (téléphone), de 0,5 à 1,5.
- **Réglages › Clavier** (masqué sur écran tactile) :
  - on peut changer la touche de chaque action : avancer, tourner, reculer,
    carnet, ponton de Moustache, garder au vivier ;
  - clic sur la touche, puis appui sur la nouvelle (Échap : annuler) ;
  - une touche réservée (menu, appâts, confirmer…) ou déjà utilisée est
    refusée, avec un message ;
  - « Touches par défaut » remet tout comme avant ;
  - les flèches marchent toujours pour ramer.
  
  Tous les textes (invites, aide du menu, tutoriel, carte de prise, boutons)
  affichent les touches choisies.
- **Remontée** : quand la tension dépasse 88 %, la jauge se hachure et
  « ⚠ Relâche ! » s'affiche, en plus de la couleur.
- **Réglages** : `CONFIG.comfort`, `CONFIG.reel.warningTension`, valeurs par
  défaut dans `CONFIG.settingsDefaults`. Code des touches :
  `src/core/controls.ts`.

### Vérifications déjà faites

- Texte × 1,4 : panneaux et boutons lisibles, sans débordement (les lignes
  des réglages passent à la ligne).
- Moins d'animations : classe posée, tangage et vagues réduits.
- Ferrage facile : fenêtre de 1,6 s. Grand bouchon : échelle × 1,5.
- Carnet sur K : J ne l'ouvre plus, K oui, et l'invite affiche « K :
  carnet ». La touche « C » (déjà prise) est refusée.
- Alerte de tension affichée à 95 %.

### Comment tester

- Échap › Réglages › Confort et Clavier.

### Limites connues

- Une seule touche par action (plus les flèches pour ramer).
- Pas de réglage des couleurs (daltonisme) : les raretés et la tension
  gardent un texte en plus de la couleur.

## Vie du décor et signes de poissons

### Livré

- **Signes de poissons** (`src/scene/fishSigns.ts`), aux deux lieux :
  - toutes les 25 à 50 s, un coin s'anime devant la barque, à portée de
    lancer (8 à 19 m) : soit un poisson qui saute régulièrement, avec son
    éclaboussure et un petit plouf, soit des bulles qui crèvent en surface ;
  - un coin dure 45 s, et au plus 2 sont actifs à la fois ;
  - **effet de jeu** : un lancer à moins de 3,5 m d'un coin actif fait
    mordre 2 fois plus vite, et double les chances des poissons non communs.
    Pendant la visée, le nom de la zone porte un 🐟 quand on vise un coin. Au
    plouf, Moustache annonce « Joli coin : ça frétille par ici ! », et
    l'invite affiche « 🐟 » devant la zone ;
  - un coin pêché s'éteint ; un autre apparaîtra plus tard ;
  - le tutoriel en parle à l'étape « ramer ».
- **Le vent dans le décor** (`src/scene/windSway.ts`) : les objets
  `deco_*_sway` (arbres et roseaux, au lac comme à la rivière) ondulent
  doucement, et fort par grand vent. Le pied reste fixe : chaque sommet a
  un poids selon sa hauteur au-dessus du sol, calculé au chargement.
- **Petites bêtes** (`src/scene/critters.ts`), le jour et par temps sec :
  - des libellules volent en zigzag au-dessus de chaque zone de roseaux ;
  - des oiseaux tournent haut au-dessus de l'eau, en battant des ailes puis
    en planant.
  
  Elles s'effacent la nuit, sous la pluie et dans la brume.
- **Réglages** : `CONFIG.signs` et `CONFIG.decorLife`.

### Assets Blender

- `deco_trees` et `deco_reeds` s'appellent maintenant `deco_trees_sway` et
  `deco_reeds_sway` (lac et rivière). Nouvelle convention documentée dans
  `BLENDER_CONVENTIONS.md`.
- Le niveau placeholder suit la même convention.
- Régénéré et exporté (le `.blend` n'avait pas de changements non
  enregistrés).

### Vérifications déjà faites

- Des coins apparaissent devant la barque, à 12 et 15 m.
- Bouchon posé sur un coin : le coin est pêché puis s'éteint ; annonce et
  invite « 🐟 » affichées.
- Captures : un poisson en plein saut près des roseaux ; grand vent
  (roseaux qui penchent, eau agitée, libellules visibles).
- Shaders compilés sans erreur. `npm run build` sans erreur.

### Comment tester

- Rame un peu et regarde devant toi : sauts ou bulles, puis lance juste à
  côté.
- **Console (dev)** :
  - `game.fishSigns.spawnIn = 0` fait apparaître un coin tout de suite ;
  - `game.weather.set('wind')` pour voir le vent dans les arbres.

### Limites connues

- Les signes ne dépendent pas des espèces présentes (un saut ne dit pas
  quel poisson c'est).
- Libellules et oiseaux ne réagissent pas à la barque.

## Météo, tutoriel, équilibrage et contrôle qualité

### Météo

- **Quatre temps** :
  - beau temps (le plus fréquent), pluie, vent ;
  - brume, qui ne se lève qu'au petit matin (entre 3 h et 8 h de jeu).
  
  Chacun dure de 3 à 7 heures de jeu (1,5 à 3,5 min réelles), avec un fondu
  d'une heure. Le temps est sauvegardé.
- **À l'écran** :
  - pluie et brume grisent le ciel, voilent le soleil, la lune et les étoiles,
    et rapprochent le brouillard ;
  - la pluie fait tomber des gouttes autour de la caméra et dessine de petits
    ronds sur l'eau ;
  - le vent creuse les vagues (× 2,2) : la barque tangue davantage.
- **À l'oreille** : deux boucles générées (pluie, vent). Sous la pluie,
  oiseaux et grillons se font plus discrets.
- **Sur la pêche** :
  - la pluie fait mordre plus vite (attente × 0,8), le vent plus lentement
    (× 1,15) ;
  - chaque espèce a un temps préféré, et elle mord alors 2,2 fois plus souvent
    (par exemple : la tanche et la truite aiment la pluie, la carpe et le
    silure des brumes la brume, le brochet le vent) ;
  - le carnet l'indique (« Temps préféré »).
- **Interface** : l'icône du temps s'affiche à côté de l'heure (🌧️ 🌫️ 💨),
  avec une annonce à chaque changement.
- **Réglages** : `CONFIG.weather`, données dans `src/data/weather.ts`.

### Tutoriel de Moustache

- Au premier lancement, une bulle de Moustache (en haut à gauche, sous le
  panneau sur téléphone) guide en 6 étapes : lancer, ferrer, remonter, la
  première prise, ramer, puis le ponton.
- Chaque étape avance quand le joueur l'a faite. Après un raté (trop tôt,
  trop tard, ligne cassée, ligne ramenée), un conseil s'affiche et on
  relance.
- Rien n'est bloqué : bouton « Passer ». Réglages (depuis la pause) ›
  « Revoir le tutoriel ». Textes différents à la souris et au doigt.
- Une partie déjà commencée (au moins un lancer) ne le voit pas.

### Équilibrage (par simulation, avec les vrais modules du jeu)

- **Combats** : un joueur attentif et même un débutant gagnent presque
  toujours. Tenir le clic sans jamais relâcher échoue dès les poissons moyens
  (le jeu apprend donc à relâcher). Le matériel raccourcit surtout les
  combats (brochet : 26 s → 12 s) et sauve les distraits face aux
  légendaires. Réglages inchangés.
- **Progression** : trop rapide avant réglage (rivière en ~20 min, lac
  complet en ~1 h dans le modèle). Après :
  - poids de rareté 10 / 4 / 1,2 / 0,12 (au lieu de 10 / 5 / 1,8 / 0,4) ;
  - pleine lune × 5 pour le légendaire ;
  - variantes à 3 % (au lieu de 4 %).
  
  Pour un joueur simulé qui explore, cela donne 8 espèces du lac (la
  rivière) en ~40 min, soit environ 1 h de vrai jeu. Le silure est pris vers
  2 h, surtout les nuits de pleine lune.
- **Coquillages (carnet seul)** : ~60 en 30 min, ~75 en 1 h, ~110 en 4 h,
  plus environ 9 par jour avec les demandes. Toute la boutique coûte environ
  280 : les premiers achats sont rapides, le reste s'étale sur plusieurs
  jours.
- **Données** :
  - la nuit dans les roseaux de la rivière, l'anguille légendaire était la
    seule espèce possible, donc garantie : le chevesne fréquente maintenant
    aussi les roseaux ;
  - un contrôle au démarrage avertit si un légendaire dépasse 10 % des
    touches à un endroit et une heure donnés.

### Contrôle qualité

- **Ancienne sauvegarde** (d'avant la progression, la météo et le
  tutoriel) : relue sans souci ; les coquillages sont rattrapés d'après le
  carnet et le tutoriel est sauté.
- **Performances**, pluie de nuit : 24 draw calls et 34 000 triangles au
  lac, 26 et 36 000 à la rivière.
- **Captures** : pluie de jour, brume à l'aube, pluie de nuit à la rivière
  (pleine lune), tutoriel sur téléphone.
- **Corrigé** :
  - la bulle « ! » de Moustache était coupée au bord de l'écran ; elle reste
    maintenant entière ;
  - sur téléphone en paysage, la carte de prise (bien remplie) débordait en
    hauteur ; elle passe à droite, plus compacte.
- `npm run build` sans erreur.

### Comment tester

- Nouvelle partie : le tutoriel démarre.
- **Console (dev)** :
  - `game.weather.set('rain')`, `'mist'`, `'wind'` ou `'clear'` ;
  - `game.clock.setHour(6)` pour la brume du matin.

### Limites connues

- La météo est identique au lac et à la rivière (même horloge).
- Le vent n'agite que l'eau (pas les arbres ni les roseaux).

## Nouveau lieu : la rivière

### Livré

- **La rivière** (`levels/river_01.glb`, générée dans Blender) : un vallon
  boisé, une rivière sinueuse d'environ 120 m jouables.
  - En amont, une cascade de 4,4 m entre deux amas de rochers, avec de
    l'écume à son pied.
  - Au milieu, un pont de bois en arche (5 m au centre) : la barque passe
    dessous, et Moustache s'y installe.
  - Le lit a du relief : une fosse profonde de 4,5 m, un radier peu profond,
    un banc de graviers, des blocs dans le courant et une anse à roseaux.
  - 6 zones de pêche, avec les berges, l'aval, le pied de la cascade et les
    blocs en collisions.
- **Courant** : un Empty `water_flow` (0,6 m/s vers l'aval). Les vagues et
  l'écume des berges sont emportées, des feuilles d'automne dérivent autour
  de la barque, et une ambiance d'eau vive (générée) s'ajoute au jour et à la
  nuit.
- **6 espèces de rivière**, avec leur modèle Blender et la nage `swim` :
  - communs : Vairon vif, Chevesne malin ;
  - peu communs : Truite des ruisseaux (tachetée de rouge, nageoire
    adipeuse), Barbeau du gué (barbillons) ;
  - rare : Ombre des cascades (grande voile violette) ;
  - légendaire : Anguille de lune (la nuit, dans les fosses et les roseaux).
  
  Chacune a sa variante rare, ses appâts préférés et une description. Le
  carnet passe à 16 espèces et 64 objectifs.
- **Chaque lieu a ses poissons** (`FishSpecies.place`). Tirage, demandes de
  Moustache et poisson du jour ne concernent que ceux du lieu. Une demande
  en cours pour une espèce d'ailleurs reste, marquée « (au lac) » ou « (à la
  rivière) ». La pleine lune annonce le légendaire du lieu.
- **Déblocage** : la rivière s'ouvre à la 8ᵉ espèce du lac, avec l'annonce
  « Moustache connaît un nouveau coin : la rivière ! ».
- **Voyage** : ponton › onglet **Carte** (ou menu pause › « Carte des
  lieux »). Pour chaque lieu : description, espèces trouvées, avancement du
  déblocage et « Y aller 🚣 ».
  - Au départ, la partie est sauvegardée avec le nouveau lieu, un voile
    « En route vers la rivière… » s'affiche, puis la page se recharge sur
    l'autre niveau.
  - On arrive directement sur l'eau (« Bienvenue à la rivière ! »), sans
    repasser par l'écran titre.
  - L'heure, le jour, les coquillages, les achats et le vivier suivent.
- **Carnet** : les espèces sont groupées par lieu (« 🌊 La rivière · 1 / 6 »).
- **Caméra** : elle ne se relève plus que si elle est vraiment dans le décor.
  Sous le pont, elle reste dessous au lieu de sauter par-dessus
  (`HeightSampler.groundAt`).

### Assets Blender

- `blender/petite_peche/river.py` (nouveau) : terrain, emprise de l'eau,
  cascade, blocs, roseaux, pont, forêt, collisions, zones et repères
  (`spawn_boat`, `cam_default`, `npc_cat` sur le pont, `water_flow`).
- `fish.py` : 6 espèces de plus. `export_assets.py` exporte les deux niveaux
  en Draco.
- Tout a été régénéré puis exporté (le `.blend` n'avait pas de changements
  non enregistrés).

### Comment tester

- La rivière s'ouvre à la 8ᵉ espèce du lac. Pour y aller tout de suite, en
  console (dev) : `game.travel('river')`, puis `game.travel('lake')` pour
  revenir.
- Là-bas : passe sous le pont, remonte vers la cascade, pêche la fosse
  (profond) et l'anse à roseaux ; l'anguille ne sort que la nuit.

### Vérifications déjà faites

- **Voyage lac → rivière → lac** : chargement direct en jeu, courant, feuilles,
  Moustache sur le pont, pas de vivier à la rivière, 6 zones reconnues. Au
  retour, l'eau est calme et le carnet, l'heure et le vivier sont conservés.
- **Pêche** : trois prises à la rivière, toutes des espèces de rivière. Les
  6 modèles ont été vérifiés en vignettes.
- **Pont** : la caméra reste vers 3,2 m en passant dessous (elle sautait
  au-dessus avant la correction).
- **Déblocage** : l'annonce part exactement à la 8ᵉ espèce du lac.
- **Données** : au démarrage, aucun avertissement sur les poissons. Chaque
  lieu couvre toutes les zones et tous les créneaux.
- `npm run build` sans erreur.

### Limites connues

- Changer de lieu recharge la page. La musique et l'ambiance attendent le
  premier clic (règle des navigateurs pour le son).
- Le courant est visuel : il ne pousse ni la barque ni le bouchon.
- Le vivier et la cabane restent au lac (Moustache, lui, suit à la rivière).

## Vivier de la cabane et rendez-vous rares

### Livré

- **Vivier** : un grand bac en bois cerclé, posé sur la plage au pied du
  ponton.
  - **Garder un poisson** : sur la carte de prise, bouton « Garder au
    vivier 🐟 » (touche V). Le bouton affiche « Au vivier ✓ » une fois
    gardé, ou « Vivier plein ».
  - **Places** : 5 au départ, 10 avec « Vivier agrandi » (20 🐚, nouvelle
    section « Vivier » de la boutique).
  - **Dans le bac** : les poissons gardés nagent en rond avec leur animation
    `swim`, chacun à son rayon, sa vitesse, son sens et sa profondeur. Leur
    taille réelle est bornée (35 à 95 cm) pour rester lisible. On les voit
    aussi depuis la barque.
  - **Onglet « Vivier » du ponton** : pour chaque poisson, la vignette (en
    couleur de variante s'il y a lieu), le nom, la taille, la date et un
    bouton « Relâcher ».
  - **« Aller voir le vivier 👀 »** : la caméra vole jusqu'au bac et
    l'interface s'efface. Un bandeau « Revenir » (ou un clic, ou Échap)
    ramène au ponton.
- **Pleine lune** :
  - l'horloge compte maintenant les jours de jeu (sauvegardés) ;
  - la lune a des phases, sur un cycle de 6 jours (`CONFIG.events`) : un
    disque d'ombre glisse dans le ciel, la pleine lune a un halo et elle
    cache les étoiles derrière elle. La nuit, l'icône de l'heure montre la
    phase (🌒 🌓 🌕…) ;
  - nuit de pleine lune : le silure légendaire sort 5 fois plus souvent (4 à la livraison, réglé ensuite par simulation) et
    les variantes 2 fois plus. Une annonce apparaît à 21 h ;
  - avec des journées de 12 min, la première pleine lune arrive après
    environ 40 min de jeu, puis toutes les 72 min.
- **Poisson du jour** :
  - chaque jour réel, une espèce non légendaire du niveau est tirée d'après
    la date (la même toute la journée) ;
  - elle mord 2,5 fois plus souvent, et sa première prise du jour rapporte
    +3 🐚 (« ⭐ Poisson du jour » sur la carte) ;
  - elle est annoncée au lancement et affichée en tête des demandes de
    Moustache (avec un indice si l'espèce est encore inconnue).

### Assets Blender

- Niveau : `deco_fish_pen` (bac ouvert, douelles, cerclages), et les
  Empties `fish_pen` et `cam_fish_pen`. Le bac est posé sur la plage, sur un
  sol presque plat (0,78 à 0,9 m), à l'écart des arbres.
- Le niveau placeholder a aussi son bac (primitives) et son `fish_pen`.
- `oriented_quad` est passé dans `common.py` (partagé par la barque et le
  bac).

### Comment tester

- Garde quelques poissons (touche V sur la carte de prise), puis va au
  ponton (C) › Vivier › « Aller voir le vivier ».
- **Console (dev)** :
  - `game.clock.setTime(3, 20.9)` fait arriver la nuit de pleine lune du
    3ᵉ jour ;
  - `game.progress.progression.dailyFish` donne le poisson du jour.

### Vérifications déjà faites

- **Vivier** : 5 poissons gardés (dont 2 variantes) nagent dans le bac ;
  aller-retour ponton → vue rapprochée → ponton, puis caméra revenue
  derrière la barque.
- **Vraie prise** : la touche V garde le poisson (4 → 5) et le bouton passe
  à « Au vivier ✓ ». La prise suivante affiche « Vivier plein ».
- **Pleine lune** : jour 3 à 21 h, annonce, icône 🌕, légendaire × 4 et
  variantes × 2 dans le tirage. Captures de la pleine lune (halo) et d'un
  croissant (🌒).
- **Poisson du jour** : bonus de +3 🐚 à la première prise seulement ;
  ligne affichée au ponton.
- **Sauvegarde** : le vivier est bien sauvegardé (un oubli corrigé : son
  changement ne déclenchait pas l'écriture).
- **Placeholder** : bac, `fish_pen` et point de vue calculé.
- `npm run build` sans erreur.

### Limites connues

- Dans le vivier, les poissons tournent chacun sur leur cercle et peuvent se
  croiser (pas d'évitement).
- La vue rapprochée n'est accessible que depuis le ponton.
- Le poisson du jour suit l'heure de l'appareil : changer la date du
  téléphone change le poisson.

## Progression : carnet approfondi, demandes de Moustache, boutique

### Livré

- **Coquillages 🐚** : la monnaie du jeu. On les gagne au carnet et avec les
  demandes, et on les dépense à la cabane. Le solde est affiché en haut, à
  côté de l'heure.
  - Calcul : objectifs du carnet (déduits du carnet) + demandes accomplies −
    achats.
  - Les prises faites avant cette mise à jour rapportent donc aussi leurs
    coquillages.
- **Carnet approfondi** : 4 objectifs par espèce, soit 40 en tout.
  - **Attrapé** (3 🐚).
  - **Beau poisson** : 50 % de la fourchette de taille (2 🐚).
  - **Trophée** : 85 % de la fourchette (4 🐚).
  - **Variante rare** (6 🐚) : chaque espèce a une couleur rare (Brème lune
    rousse, Carpe koï, Sandre albinos…), avec 4 % de chance à chaque prise.
  
  Le carnet affiche ces objectifs sur chaque carte, avec les tailles des
  paliers une fois l'espèce attrapée. Le résumé indique « Objectifs : x / 40 »
  et les coquillages.
- **Variantes** : le modèle est recoloré par un petit shader (teinte unique,
  plus sombre sur le dos, pupilles noires, légère lueur). La carte de prise
  affiche le nom de la variante en dégradé.
- **Carte de prise** : badges « Beau poisson », « Trophée ! » et « Variante
  rare ! », puis la liste des coquillages gagnés (objectifs et demandes).
- **Moustache**, le chat pêcheur du ponton :
  - un chat roux au chapeau de paille, assis au bout du ponton, dont la queue
    balance ;
  - une bulle « ! » au-dessus de lui quand il a de nouvelles demandes (un
    clic dessus ouvre son ponton) ;
  - une pastille sur le bouton 🐈.
- **Demandes** : 3 à la fois.
  - Exemples : « 3 poissons, n'importe lesquels », « 2 poissons au
    crépuscule », « 2 poissons dans les roseaux », « un poisson peu commun ou
    plus », une espèce (même inconnue, avec un indice), « une perche d'au
    moins 27 cm ».
  - Elles rapportent 2 à 7 🐚 et sont accomplies automatiquement à la prise.
  - Chaque jour réel, les demandes accomplies sont remplacées ; celles en
    cours restent, sans limite de temps.
  - Elles ne portent que sur des habitats présents dans le niveau, et jamais
    sur le légendaire.
- **Boutique de la cabane** (touche C, bouton 🐈, ou menu pause) :
  - **Appâts** : Cuillère brillante (chasseurs), Bouillette parfumée
    (poissons de fond, prises plus grosses), Mouche dorée (surface, variantes
    × 2,5). Ils prennent les touches 4 à 6.
  - **Matériel**, deux niveaux par pièce :
    - canne : tension −15 % / −30 % ;
    - moulinet : remontée +15 % / +30 % ;
    - ligne : résistance +30 % / +60 %.
  - **Décoration** : 5 peintures de barque, 4 bouchons, 4 lanternes. On peut
    revenir à une couleur déjà achetée.
- **Réglages** : paliers, chance de variante, récompenses et demandes dans
  `CONFIG.progression`. Prix et effets de la boutique dans
  `src/data/shop.ts`. Moustache dans `CONFIG.cat`.
- **Sauvegarde** : ajout d'un bloc `progression` (demandes, achats) et d'un
  champ `variant` dans le carnet. Une ancienne sauvegarde se relit telle
  quelle.

### Assets Blender

- Nouvelle scène `cat` → `props/cat.glb` : chat roux assis, chapeau de
  paille, moustaches, queue `cat_tail` séparée (pivot à sa base).
- Niveau : Empty `npc_cat` au bout du ponton, tourné vers la barque au
  départ. Le niveau placeholder a aussi son `npc_cat`, sur la berge.
- Avant de régénérer, le `.blend` ouvert avait des changements non
  enregistrés (a priori juste une sélection). Une copie a été gardée dans
  `blender/backup/petite_peche_avant_moustache.blend`.

### Comment tester

- **Nouvelle partie** :
  - deux ou trois prises font apparaître les premiers coquillages sur la
    carte de prise ;
  - la touche C (ou 🐈) ouvre le ponton ;
  - le premier achat possible est la ligne tressée ou la canne souple.
- **Moustache** : tourne la barque vers le ponton (à droite du départ) pour
  le voir avec sa bulle.
- **Console (dev)** :
  - `game.newRequestsDay()` renouvelle les demandes comme au lendemain ;
  - `game.progress.progression` donne le solde et les achats.

### Vérifications déjà faites

- **Deux prises complètes** :
  - la 1re (Brème lune) rapporte « nouvelle espèce » et accomplit la demande
    « peu commun » : 6 🐚 ;
  - la 2e était par chance une variante (Brème lune rousse) : « Beau
    poisson » + « Variante rare » donnent 14 🐚.
- **Achats** :
  - la canne passe à 0,85 puis 0,7 ;
  - le moulinet niveau 2 reste verrouillé sans le niveau 1 ;
  - la cuillère arrive en touche 4 ;
  - la barque rose, le bouchon jaune et la lanterne bleu lune ont été
    vérifiés en jeu, de jour et de nuit.
- **Sauvegarde** : après rechargement, on retrouve le solde, les achats, la
  décoration, l'avancement des demandes et la variante dans le carnet.
- **Changement de jour** : la demande accomplie est remplacée, les deux en
  cours restent, et le badge revient.
- **Téléphone (375 px)** : ponton, boutique et barre du haut vérifiés en
  émulation, après correction de l'en-tête du ponton qui débordait.
- **Placeholder** : `npc_cat` posé au sol de la berge (0,5 m), chat en
  primitives avec sa queue, et barque et bouchon repeints.
- `npm run build` sans erreur.

### Limites connues

- La boutique est équilibrée « sur le papier » : tout acheter demande
  environ 260 🐚, soit le carnet complet (150) plus une douzaine de jours de
  demandes. À ajuster après tes essais (`CONFIG.progression` et
  `src/data/shop.ts`).
- Les variantes n'ont pas de vignette propre dans le carnet (on voit
  l'espèce normale, avec la ligne « ✨ nom de la variante »).
- On ne peut pas acheter en dehors du ponton, et on ne revend rien.

## Contrôle qualité, nage des poissons, mobile

### Contrôle qualité en jeu (avec les assets Blender)

- **Ponton** : un rectangle d'écume blanche l'entourait, car la mesure de
  profondeur prenait son tablier pour de la terre. `HeightSampler` connaît
  maintenant l'orientation des faces (`surfacesAt`). Une surface hors de
  l'eau qui a un dessous est un surplomb : on regarde ce qu'il y a en
  dessous. Si le tablier est posé dans la berge, c'est de la terre.
- **Caméra** : elle reste au moins 1,2 m au-dessus du décor
  (`camera.minHeightAboveGround`). Le même `HeightSampler` sert à l'eau et à
  la caméra.
- **Bandeau « avertissements d'assets »** : affiché seulement en
  développement, sous le carnet et les menus. Le joueur ne le voit plus (le
  seul avertissement restant, les sons générés, est normal). Son texte est
  dans `texts.ts`.
- **Vérifié sans rien à corriger** :
  - aucun sommet d'eau sans fond, sur le niveau Blender comme sur le
    placeholder ;
  - les taches cyan à l'avant de la barque sont les pales des rames ;
  - les 10 poissons se chargent sans avertissement.

### Nage des poissons (Blender)

- Chaque poisson a un squelette de 4 os (`spine`, `head`, `tail_1`,
  `tail_2`). Les poids sont calculés le long du corps, en fondu entre les os.
- **Une seule action `swim`**, partagée par les 10 poissons :
  - 1 s en boucle, une vague de la tête vers la queue ;
  - débattement : ±0,15 au bout de la queue, ±0,035 au museau (pour un
    poisson d'environ 1,1 de long).
- Chaque `.glb` contient le skin (4 os) et le clip `swim` (25 clés de
  rotation par os). Le jeu le joue avec un `AnimationMixer` au lieu de
  l'ondulation procédurale, que l'on garde pour les poissons sans clip.
- Les générateurs (`fish.py`) ont été mis à jour et tout a été régénéré puis
  exporté. Le `.blend` n'avait pas été retouché à la main (vérifié avant).

### Jouable sur mobile

- **Mode tactile** (`src/core/pointerMode.ts`) :
  - il est détecté au lancement (écran « doigt »), puis suit le dernier
    appui : doigt ou souris ;
  - la classe `is-touch` sur `<html>` adapte l'interface.
- **Doigt = souris** :
  - maintenir le doigt sur l'eau charge le lancer ;
  - glisser vise ;
  - lâcher lance ;
  - toucher ferre, maintenir mouline.
  
  Seul le doigt posé sur le jeu compte : un second doigt (joystick) ne vise
  pas et ne lâche pas le lancer.
- **Joystick virtuel** (`src/ui/touchStick.ts`) :
  - il est placé en bas à gauche : haut pour avancer, bas pour reculer, côtés
    pour tourner ;
  - chaque axe a une zone morte (`CONFIG.touch.stickDeadZone`) ;
  - il s'efface quand la ligne est à l'eau ;
  - il s'additionne au clavier.
- **Textes tactiles** : invites, « Touche l'écran pour continuer », et aide
  des commandes du menu pause.
- **Mise en page** :
  - boutons plus grands, sans les touches `1 2 3` ;
  - l'invite se place à droite du joystick sur petit écran ;
  - les jauges remontent d'un cran ;
  - marges des encoches (`safe-area`) ;
  - l'heure tient sur une ligne.
- **Navigateur** :
  - pas de zoom, de défilement, de sélection ni de menu d'appui long sur le
    jeu ;
  - le carnet et les menus défilent au doigt ;
  - ajouté à l'écran d'accueil, le jeu s'ouvre en plein écran.
- **Portrait** : le champ de vision s'élargit pour garder au moins 50° de
  large (`camera.minHorizontalFov`).
- **Son sur iPhone** : l'audio se débloque au premier toucher terminé.

### Comment tester

- Sur ordinateur : rien ne change (souris et clavier).
- **Sur téléphone** (même Wi-Fi que l'ordinateur) :
  - lance `npm run dev -- --host` ;
  - ouvre l'adresse « Network » affichée (par exemple
    `http://192.168.x.x:5173`) ;
  - essaie le portrait et le paysage.
- Dans Chrome sur ordinateur : outils de développement › mode appareil
  (Ctrl/Cmd + Maj + M) donne un aperçu.

### Vérifications déjà faites

- **Émulation téléphone** (375 × 812, écran tactile), avec des doigts
  simulés :
  - le joystick fait avancer, tourner et s'arrêter la barque ;
  - avec deux doigts à la fois, le lancer n'est ni visé ni lâché par le
    doigt du joystick ;
  - lancer, touche, ferrage, remontée et prise se jouent entièrement au doigt.
- **Captures en portrait** : jeu, menu pause, carnet (2 colonnes qui
  défilent), remontée, carte de prise. Aussi une capture en paysage
  (812 × 375).
- `npm run build` sans erreur.

### Limites connues

- Pas encore essayé sur un vrai téléphone : l'émulation ne reproduit ni les
  performances, ni le son d'iOS, ni les gestes système.
- En tactile, on ne peut pas annuler une charge de lancer (Échap). Ce n'est
  pas grave : un toucher ramène la ligne.
- Sur iPhone, Safari ne permet pas le plein écran depuis une page. Il faut
  « Ajouter à l'écran d'accueil ».

## Après la phase 5 : découpage de la pêche et assets Blender

### Découpage de `fishingController.ts`

Les 502 lignes sont réparties en six fichiers, sans changement de
comportement :

| Fichier | Rôle | Lignes |
| --- | --- | --- |
| `fishingController.ts` | Porte d'entrée : interface utilisée par le jeu, aiguillage des états | 124 |
| `fishingContext.ts` | État partagé (matériel, machine à états, session en cours) et actions communes (ligne vide, moulinet, ronds, invites) | 121 |
| `castPhase.ts` | IDLE → CHARGING → CASTING → WAITING (charge, visée, lancer, plouf) | 107 |
| `bitePhase.ts` | WAITING → BITE → REELING (fausses touches, touche, ferrage) | 92 |
| `reelPhase.ts` | REELING → CAUGHT / ESCAPED → IDLE (combat, prise, retour de ligne) | 111 |
| `tackleAnimator.ts` | Animation de la canne, du bouchon, de la ligne et des ronds | 79 |

### Assets Blender, créés via le MCP Blender

- **Niveau `lake_01`** :
  - le terrain : un lac aux rives irrégulières, un fond en pente, une plage,
    une prairie, des collines qui ferment l'horizon, et une île en pente
    douce ;
  - le décor : 97 arbres (sapins et feuillus), des rochers dans l'eau et sur
    la berge, deux touffes de roseaux, un ponton en bois et une cabane de
    pêcheur ;
  - les repères de jeu : 6 zones (2 peu profondes, 1 profonde, 2 roseaux,
    1 rochers), les collisions (berge, île, 4 rochers, ponton), le départ près
    du ponton et la caméra. Soit environ 20 000 triangles, 199 Ko en Draco.
- **Barque** : coque épaisse (bordés peints bleu-vert, bande crème, carène
  rouge, intérieur en bois), trois bancs, plancher, dames de nage, rames,
  lanterne émissive sur son mât, `rod_mount` et `water_mask`.
- **Canne** : blank effilé, poignée en liège, moulinet, anneaux, `rod_tip`.
- **Bouchon** : dôme rouge, corps blanc, antenne à pointe jaune.
- **10 poissons** : une silhouette par espèce (hauteur, profil, museau,
  queue fourchue, échancrée ou ronde, nageoires, yeux, barbillons, rayures
  ou taches). Un seul objet chacun, animé en jeu par l'ondulation
  procédurale.

Les sources sont dans `blender/` (voir `BLENDER_CONVENTIONS.md` › « Assets
fournis ») : le `.blend`, le script d'export, et les générateurs Python pour
tout recréer.

### Côté jeu

- **Profondeur de l'eau** : elle est maintenant mesurée par
  `HeightSampler`, qui range les triangles du décor dans une grille, au lieu
  de lancer un rayon par sommet. Sur le terrain Blender (20 000 triangles,
  5 600 sommets d'eau), la construction prend 15 ms ; par rayons, elle aurait
  pris plusieurs secondes.
- **Documentation corrigée** : dans Blender, un Empty « Circle » est dessiné
  à la verticale. Il faut le tourner de 90° sur X pour qu'il montre la zone à
  plat.

### Vérifications déjà faites

- Tous les chemins de la pêche rejoués après le découpage : Échap pendant la
  charge, ligne ramenée, ferrage raté, casse, prise complète.
- **Chargement en jeu** : niveau lu depuis le `.glb`, et aucun avertissement
  d'asset en dehors des sons (qui n'ont pas de fichiers).
  - 6 zones, 7 collisions et 6 objets de décor reconnus ;
  - départ face au lac et caméra 7 m derrière ;
  - `rod_mount`, `rod_tip`, `lantern` et `water_mask` trouvés.
- Captures dans Blender (niveau, barque, les 10 poissons côte à côte) et en
  jeu (lac, barque, canne, bouchon).
- **Carnet** : vignettes des poissons `.glb` générées et vérifiées pixel par
  pixel (cadrage, couleurs, tête à gauche, silhouettes unies).
- **Prise complète** avec présentation d'un poisson `.glb` (ablette miroir).
- `tsc` et `npm run build` OK ; aucun avertissement à l'export glTF.
- La sauvegarde de test a été effacée.

---

## Phase 5 : shader d'eau, sons, menu, réglages, finitions

### Livré

- **Eau stylisée** (`src/scene/water.ts`, `waterSurface.ts`, `waves.ts`) :
  - La surface est une grille facettée qui remplace le mesh `water` (emprise
    conservée) et ondule par une somme de sinusoïdes.
  - Une facette low poly accroche la lumière (soleil, lune, lanterne).
  - La couleur suit la profondeur, mesurée à la construction par un rayon
    vers le fond du décor : turquoise au bord, plus sombre au large.
  - Une écume animée apparaît là où quelque chose affleure (berge, île,
    rochers).
  - Le ciel se reflète quand on regarde l'eau de biais (Fresnel).
  - La couleur de l'eau suit le cycle jour/nuit.

  Performances : environ 3 800 sommets, un seul matériau (MeshStandard
  complété par un peu de GLSL), ombre de la barque et brouillard conservés,
  barque toujours au sec (stencil). Les mêmes vagues existent en TypeScript
  (`waveHeight`) : barque, bouchon, ronds dans l'eau et anneau de visée
  flottent sur la surface visible.
- **Sons** (`src/audio/`), en trois canaux réglables :
  - **effets** : lancer, plouf, touches, moulinet, casse, jingle de prise ;
  - **ambiance du lac** : une boucle de jour (clapotis contre la coque, vent,
    oiseaux) et une de nuit (clapotis, grillons), fondues selon l'heure, sans
    à-coup à la reprise de la boucle ;
  - **musique** : une petite boîte à musique générée (phrases pentatoniques
    espacées, écho doux), en majeur le jour, en mineur, plus grave et plus
    lente la nuit.
  
  Chaque son a son emplacement de fichier dans `assets/audio/` et remplace
  le son généré dès qu'il existe.
- **Menus** (`src/ui/menus.ts`) :
  - écran titre sur le lac vivant : « Jouer », ou « Continuer » avec le
    résumé de la partie ;
  - menu pause (Échap ou bouton ☰) : Reprendre, Carnet, Réglages, et un
    aide-mémoire des commandes.
- **Réglages** (`src/ui/settingsPanel.ts`, `src/core/settings.ts`),
  appliqués tout de suite et sauvegardés :
  - 4 volumes ;
  - ombres, définition (pleine ou économe), aides à l'écran, « ! » à la
    touche ;
  - durée d'une journée (6, 12 ou 24 min) ;
  - « Effacer la partie », en deux clics.
- **Machine à états du jeu** (`Game`) : titre → jeu ⇄ pause ⇄ carnet. Le monde
  n'avance qu'en jeu ; l'eau, le ciel et les lucioles restent vivants
  partout.
- **Finitions** :
  - lucioles clignotantes autour de la barque la nuit ;
  - sillage de ronds derrière la barque quand elle avance ;
  - fond de lac et île en pente douce dans le niveau placeholder (pour le
    dégradé de profondeur et l'écume).

### Comment tester

1. Au lancement : écran titre sur le lac. « Jouer » (ou Espace / Entrée).
2. Regarde l'eau : facettes qui ondulent, turquoise près de l'île et de la
   berge, écume au bord, reflet du ciel au loin. Avance avec **T** jusqu'à la
   nuit : lac bleu profond, reflet de la lune, lucioles.
3. Rame : un sillage se forme derrière la barque, qui flotte sur les vagues.
4. Écoute : clapotis et oiseaux le jour, grillons la nuit, petite musique
   espacée, jingle à chaque prise.
5. **Échap** ou ☰ : pause, avec Réglages. Change les volumes, coupe les
   ombres, passe la définition en « Économe », choisis une journée de 6 min.
   Recharge la page : les réglages sont conservés.
6. Réglages › « Effacer la partie » (deux clics) : retour à une partie neuve.

### Vérifications déjà faites

- `tsc` et `npm run build` OK ; aucune erreur dans la console (seulement les
  404 attendus des assets absents).
- **Captures** : écran titre, eau à midi (facettes, dégradé, reflets), eau la
  nuit (lune, lanterne, lucioles), menu pause, panneau Réglages.
- **Réglages modifiés par de vrais clics** (définition économe, journée
  24 min, ombres coupées, musique à 30 %) : appliqués immédiatement
  (définition ×1, soleil sans ombre, horloge) et présents dans la
  sauvegarde.
- **Navigation** : Échap depuis Réglages → pause ; Carnet depuis la pause →
  Échap → pause ; Reprendre ; J → carnet → ✕ → jeu ; ☰ → pause. L'horloge
  est bien arrêtée en pause.
- **Audio** : contexte actif, boîte à musique lancée, volumes des canaux
  appliqués.
- **Pêche** : cycle complet sur l'eau animée, prise ajoutée au carnet. Le
  bouchon suit bien les vagues (de −6 à +6 cm pendant l'attente).
- **Bug trouvé et corrigé pendant les tests** : le shader d'eau ne compilait
  pas (une directive `#define` collée à ma fonction de vagues).
- La sauvegarde de test a été effacée : tu démarres sur une partie neuve,
  avec les réglages par défaut.

### Décisions techniques

- **Eau recréée plutôt que « shadée » telle quelle** : un plan Blender est
  souvent un simple quad, trop pauvre pour onduler. La grille garde
  l'emprise du mesh `water` et porte les attributs de profondeur.
- **Profondeur mesurée sur le décor** (un rayon par sommet, à la
  construction) plutôt qu'avec une texture de profondeur par image : rien ne
  se calcule en jeu, et ça marche avec n'importe quel niveau Blender.
- **MeshStandardMaterial + `onBeforeCompile`** plutôt qu'un ShaderMaterial
  complet : on garde gratuitement lumières, ombre, brouillard et stencil.
- **Sons générés dans le navigateur** (échantillons calculés une fois au
  chargement) et musique planifiée sur l'horloge audio : aucune dépendance,
  et tout se met en attente tant que le navigateur bloque le son.
- **Titre et pause dans la même scène** : le lac reste vivant derrière les
  menus.

### Limites connues

- Pas de vrais fichiers audio ni de vrais modèles : tout est généré. Les
  emplacements sont prêts (`BLENDER_CONVENTIONS.md`).
- `fishingController.ts` dépasse 500 lignes (ses fonctions restent courtes).
  On pourra y séparer le lancer et le combat si le jeu grandit.
- Le bundle JS fait environ 750 kB (200 kB gzip).
- Le déplacement de la barque reste au clavier : pas de commandes tactiles.

---

## Phase 4 : carnet, sauvegarde, cycle jour/nuit, zones

### Livré

- **Cycle jour/nuit** (`src/scene/dayNight.ts`) :
  - une journée dure 12 minutes réelles ;
  - l'ambiance est définie à 8 heures clés dans `CONFIG.dayNight.keyframes`
    et interpolée entre elles : ciel, brouillard, soleil, lumière du ciel,
    couleur de l'eau ;
  - le soleil se lève à l'est, passe au sud et se couche à l'ouest, avec un
    disque et un halo dans le ciel ;
  - la nuit, des étoiles et la lune apparaissent, la lumière principale
    devient bleutée, la lanterne de la barque s'allume et le bouchon luit en
    vert (halo visible de loin). L'icône de l'horloge suit le moment de la
    journée (🌅 ☀️ 🌇 🌙).
- **Carnet** (touche **J** ou bouton 📔, `src/ui/journalView.ts`) :
  - grille des 10 espèces : vignette du vrai modèle 3D, en couleurs si
    l'espèce a été attrapée, en silhouette sinon ;
  - pour une espèce attrapée : rareté, record de taille, nombre de prises,
    zones, créneaux, appâts préférés, description et date de la première
    prise ;
  - pour une espèce inconnue : « ??? » et un indice (zones et créneaux) ;
  - un résumé de la partie : espèces trouvées, prises, plus grosse prise,
    temps de jeu ;
  - le jeu est en pause tant que le carnet est ouvert (J, Échap ou clic à
    côté pour le fermer).
- **Sauvegarde** (`src/core/save.ts`, `progress.ts`) dans `localStorage`. Elle
  contient le carnet, les statistiques (lancers, prises, lignes vides par
  raison, temps de jeu, plus grosse prise), les réglages (volume) et l'état du
  monde (heure, appât). Elle est déclenchée après chaque lancer, prise,
  ligne vide ou changement d'appât, toutes les 30 s, et quand l'onglet est
  caché ou fermé. À la relecture, tout est validé : une sauvegarde
  corrompue ou d'une autre version donne une nouvelle partie, avec un
  avertissement.
- **Zones** :
  - la zone visée s'affiche au-dessus de la jauge pendant la charge ;
  - si des zones se chevauchent, la plus petite l'emporte ;
  - le carnet indique où et quand chercher chaque espèce.
- **Barque** : une lanterne sur un petit mât à l'arrière (convention
  `lantern` dans `boat.glb`).
- **Aide au test** : la touche **T** avance l'horloge d'une heure
  (`CONFIG.debug.timeSkip`, à vider pour la désactiver). En dev,
  `game.resetSave()` dans la console efface la sauvegarde.

### Comment tester

1. Appuie plusieurs fois sur **T** pour faire défiler la journée : aube rosée,
   plein jour, coucher orangé, nuit bleue avec étoiles, lanterne et bouchon
   lumineux.
2. Pêche la nuit en eau profonde : les poissons nocturnes (sandre, silure)
   n'apparaissent qu'à ces heures-là.
3. Ouvre le carnet (**J** ou 📔) : les silhouettes et les indices, puis tes
   prises en couleurs avec leurs records. Pendant que le carnet est ouvert,
   l'horloge est arrêtée.
4. Recharge la page : l'heure, l'appât, le carnet et les statistiques sont
   conservés.
5. Pendant la charge d'un lancer, le nom de la zone visée s'affiche au-dessus
   de la jauge.

### Vérifications déjà faites

- `tsc` et `npm run build` OK.
- **Captures à 7 h 30, 13 h, 19 h 30 et 23 h**. Elles m'ont conduit à
  remonter l'éclairage de l'aube, du soir et de la nuit : le lac était trop
  sombre au soleil bas.
- **Chaîne complète en simulation** : appât changé à la touche 2, zone
  affichée pendant la visée, puis prise d'un Gardon perlé de 19 cm. Carnet,
  statistiques et sauvegarde sont mis à jour ; après rechargement, l'heure
  (10 h 30), l'appât (asticots), le carnet et les statistiques sont bien
  restaurés.
- **Carnet** : 10 cartes et résumé corrects ; horloge arrêtée tant qu'il est
  ouvert ; fermeture par Échap. Vignettes analysées pixel par pixel :
  poisson centré, tête à gauche, silhouette unie.
- **Robustesse** :
  - zones qui se chevauchent : la plus petite l'emporte ;
  - sauvegarde piégée : les espèces inconnues et les nombres invalides sont
    écartés ;
  - JSON corrompu ou version inconnue : nouvelle partie ;
  - valeurs hors bornes : ramenées dans les limites.

  La touche T avance bien l'heure.
- **Non vérifié à l'écran** : la mise en page du carnet elle-même. Le panneau
  navigateur était masqué pendant ce test ; la structure a été vérifiée,
  mais pas l'apparence.

### Décisions techniques

- **Lumière jamais trop rasante** : le soleil affiché suit sa vraie course,
  mais la lumière qui éclaire la scène ne descend pas sous 34°
  (`minLightElevation`), sinon le lac paraît éteint à l'aube. La nuit, elle
  vient de la lune, bleutée.
- **Nuit lisible, pas noire** : les intensités de nuit sont assez hautes pour
  garder un lac bleu profond. C'est plus cozy que réaliste.
- **Lumières ponctuelles toujours présentes** (lanterne, présentation de la
  prise) : leur intensité est à 0 quand elles sont inutiles. En ajouter ou en
  retirer forcerait Three.js à recompiler tous les shaders (saccade).
- **Vignettes du carnet** : le vrai modèle (GLB ou placeholder) est rendu hors
  écran avec le renderer du jeu, puis converti en image, une seule fois par
  espèce et par variante.
- **Progression séparée du jeu** : `Progress` regroupe carnet, statistiques,
  réglages et sauvegarde, et écoute les événements de la pêche
  (`FishingController.events`) au lieu d'y être mêlé.
- **Pause** : seul le carnet met le jeu en pause pour l'instant. Il ne s'ouvre
  ni pendant la charge d'un lancer ni pendant la présentation d'une prise.

### Limites connues

- L'eau reste un matériau simple ; le shader stylisé arrive en phase 5 (il
  devra garder `avoidDryPixels()` et suivre la couleur donnée par
  `setWaterColor()`).
- Pas d'écran de réglages ni d'effacement de sauvegarde dans le jeu (phase 5).
- Le bundle JS atteint environ 730 kB (à découper plus tard si besoin).

---

## Phase 3 : remontée, présentation de la prise, données poissons

### Livré

- **10 espèces** (`src/data/fish.ts`) : identifiant, nom, rareté, zones (dont
  l'eau libre), créneaux horaires (aube, jour, crépuscule, nuit), taille
  min/max, difficulté (force, fréquence des à-coups), appâts préférés,
  description et couleurs du placeholder. Il y a 3 communs, 3 peu communs,
  3 rares et 1 légendaire (le silure, la nuit en eau profonde).
- **Sélection du poisson** (`src/fishing/fishSelector.ts`) : parmi les espèces
  de la zone et du créneau, tirage pondéré par la rareté et par l'appât
  (préféré × 2,5, sinon × 0,6). La taille est tirée dans la fourchette de
  l'espèce (les grandes tailles sont plus rares) et rend le poisson un peu
  plus fort. Au démarrage, `checkFishData()` vérifie qu'il existe au moins
  une espèce pour chaque zone × créneau.
- **Mini-jeu de remontée** (`src/fishing/reelFight.ts`, logique pure) :
  - clic maintenu = mouliner : le poisson se rapproche mais la tension monte ;
  - relâcher : la tension baisse, mais le poisson reprend un peu de ligne ;
  - à-coups aléatoires selon l'espèce : la tension grimpe et le poisson
    s'éloigne ;
  - tension au maximum plus de 1,6 s d'affilée : la ligne casse ;
  - distance nulle : le poisson est pris.
- **Retours du combat** : jauge (piste 🐟 → 🛶, distance, tension vert →
  rouge, fine barre de risque de casse), ligne qui rougit, canne qui plie,
  bouchon qui zigzague sous l'eau, remous et gerbes aux à-coups, cliquetis du
  moulinet, « twang » à la casse.
- **Présentation de la prise** (`catchShowcase.ts` + `ui/catchPopup.ts`) :
  le poisson saute hors de l'eau puis vient tourner devant la caméra. Une
  carte affiche la rareté, le nom, la taille en cm, « Nouvelle espèce ! » ou
  « Nouveau record ! » et la description, avec un petit carillon. Clic ou
  Espace pour continuer.
- **Carnet** (`src/core/journal.ts`) : chaque prise y est ajoutée (nombre et
  record par espèce). Il est en mémoire pour l'instant ; la sauvegarde et
  l'écran arrivent en phase 4.
- **Modèles de poissons** : `assets/fish/<id>.glb` avec l'animation `swim`,
  sinon une ondulation procédurale en vertex shader. Sans fichier, un
  placeholder low poly aux couleurs de l'espèce.
- **Barque au sec** : un masque stencil (`water_mask`, `src/scene/waterMask.ts`)
  empêche l'eau de se dessiner dans la coque.
- **WASD et ZQSD** fonctionnent tous les deux, quel que soit le clavier : les
  lettres sont reconnues d'après le caractère tapé. L'interface affiche WASD
  par défaut.

### Comment tester

1. Lance, attends la touche, ferre, puis **garde le clic** : la jauge de
   tension monte. Relâche avant la zone rouge et reprends, jusqu'à ce que le
   🐟 rejoigne le 🛶.
2. Pour les petits poissons (ablette, gardon), mouliner sans relâcher suffit.
   Les gros (carpe, brochet, silure) demandent de gérer la tension.
3. Pour tester la casse, garde le clic sur un gros poisson : la jauge vibre
   en rouge, la fine barre se remplit, puis « Crac ! ».
4. À la prise : saut, présentation, carte. Recommence avec la même espèce pour
   voir « Nouveau record ! ».
5. Essaie les appâts dans les roseaux à l'aube : le maïs attire la carpe et la
   tanche. La console indique l'espèce tirée à chaque ferrage.
6. Vérifie que l'intérieur de la barque n'est plus rempli d'eau.

### Vérifications déjà faites

- `tsc` et `npm run build` OK.
- **Simulation** de 300 combats par espèce avec un joueur automatique qui
  mouline et relâche avant la casse :
  - communs et peu communs : 100 % de réussite, en 7 à 19 s ;
  - rares : 82 à 97 % ;
  - légendaire : 81 à 92 %.
  
  En moulinant sans relâcher, l'ablette et le gardon se remontent, mais pas
  les gros poissons.
- **Tirages** (5 000 par cas) cohérents : le maïs multiplie la carpe par 7
  dans les roseaux à l'aube ; le silure sort à environ 6 % la nuit en eau
  profonde.
- **Parcours réels** avec de vrais événements souris :
  - prise complète (Brème lune 44 cm, « Nouvelle espèce ! », carnet mis à
    jour), fermée avec Espace ;
  - casse forcée : REELING → ESCAPED → IDLE, carnet inchangé.
- **Clavier** : W/Z, A/Q, S, D, flèches et majuscules vérifiés, sur des
  événements QWERTY et AZERTY simulés.
- **Captures** : barque au sec, jauge de combat, carte de prise (format
  étroit et format bureau).

### Décisions techniques

- **Masque stencil plutôt que remonter le fond de la barque** : ça reste
  juste avec le tangage, avec les vagues de la phase 5, et avec une barque
  modélisée dans Blender. Le shader d'eau de la phase 5 devra garder
  `avoidDryPixels()`.
- **Carnet en mémoire dès maintenant**, puisque la spec demande « puis ajout
  au carnet » à la phase 3. La phase 4 n'aura qu'à le sauvegarder et à
  l'afficher.
- **Poisson tiré au ferrage** : il ne dépend donc que de la zone, de l'heure
  et de l'appât au moment où ça mord.
- **Présentation dans la scène 3D**, devant la caméra, plutôt que dans un
  second renderer : plus léger, et le lac reste visible derrière.
- **Rochers la nuit** : la brème y vit aussi, pour que le sandre reste rare.

### Limites connues

- Carnet non sauvegardé, sans écran pour l'instant (phase 4).
- Le jeu ne tient pas compte de l'aspect de l'emoji 🐟 de la jauge, qui varie
  selon le système.

---

## Phase 2 : lancer, bouchon, attente, touche, ferrage

### Livré

- **Machine à états explicite** (`src/core/stateMachine.ts`, générique et
  typée) pour la pêche : IDLE → CHARGING → CASTING → WAITING → BITE → REELING →
  CAUGHT | ESCAPED → IDLE. Les transitions sont déclarées dans
  `src/fishing/fishingState.ts` ; une transition non prévue est refusée et
  signalée dans la console.
- **Lancer** : clic maintenu pour charger (jauge en va-et-vient), la souris
  vise et un anneau sur l'eau montre le point de chute. Au relâchement, le
  bouchon part en arc depuis la pointe de la canne. Un point de chute sur la
  berge ou un obstacle est ramené sur l'eau libre ; s'il n'y a pas d'eau du
  tout, on reçoit « Pas d'eau par là… ». Échap annule.
- **Canne** animée par un ressort : elle bascule en arrière pendant la
  charge, fouette au lancer, plonge aux touches et se relève au ferrage. Elle
  suit la visée, puis le bouchon.
- **Bouchon** : pend sous la canne, vole, flotte, frémit (fausse touche),
  plonge (vraie touche) et revient vers la barque. Ronds dans l'eau à chaque
  événement. Ligne en courbe qui s'affaisse vers l'eau quand elle est
  détendue.
- **Attente** (`src/fishing/biteTimer.ts`) : délai aléatoire × zone × heure ×
  appât, puis 0 à 3 fausses touches avant la vraie. Tous les facteurs sont
  dans `CONFIG.fishing`.
- **Ferrer** : à la vraie touche (plongeon + son + « ! » au-dessus du
  bouchon), on a 0,8 s pour cliquer.
  - Raté : « Raté… », la ligne revient, sans pénalité.
  - Clic pendant une fausse touche : « Trop tôt ! ».
  - Clic pendant l'attente : la ligne est ramenée.
- **Remontée provisoire** : après un ferrage réussi, le bouchon est remonté
  automatiquement, puis « Un poisson ! ». Le mini-jeu de tension arrive en
  phase 3.
- **Appâts** (`src/data/baits.ts`) : ver de terre, asticots, grain de maïs.
  Touches 1 / 2 / 3 ou clic dans le panneau en haut à droite ; le changement
  n'est possible que ligne au repos. Pour l'instant, ils ne modifient que le
  délai d'attente.
- **Horloge de jeu** (`src/core/gameClock.ts`) : 12 min réelles = 24 h,
  affichée en haut à droite. Elle agit déjà sur l'attente ; le rendu
  jour/nuit viendra en phase 4.
- **Caméra** : quand la ligne est à l'eau, elle pivote autour de la barque
  pour cadrer le bouchon.
- **Barque** immobilisée tant que la ligne n'est pas au repos.
- **Sons** (`src/audio/`) : `audioManager.ts` avec un emplacement par son
  (lancer, plouf, fausse touche, touche, moulinet). Un fichier présent dans
  `assets/audio/` est utilisé, sinon un son généré en WebAudio le remplace.
- **Nouveaux assets optionnels** : `props/rod.glb` (avec `rod_tip`),
  `props/bobber.glb`, Empty `rod_mount` dans `boat.glb`. Voir
  `BLENDER_CONVENTIONS.md`.
- **HUD** : invite contextuelle en bas, messages éphémères, jauge de
  puissance, « ! » de touche, panneau heure + appâts. Tous les textes sont
  dans `src/ui/texts.ts`.

### Comment tester

1. Maintiens le clic : la jauge oscille, la canne bascule et l'anneau se
   déplace sur l'eau. Relâche : le bouchon part en arc, plouf.
2. Attends : le bouchon frémit (petits « plip ») puis plonge avec un « gloup »
   et un « ! ». Clique dans les 0,8 s.
3. Essaie aussi de cliquer pendant un frémissement, de ne pas cliquer du tout,
   et d'appuyer sur Échap pendant la charge.
4. Change d'appât (1 / 2 / 3) et pêche dans les roseaux (touche G pour voir
   les zones) : la console indique pour chaque lancer la zone, l'heure,
   l'appât et le délai tiré.
5. Vise la berge de près : « Pas d'eau par là… ».

Le badge indique « 5 avertissements » sans aucun asset : niveau, barque,
canne, bouchon et sons.

### Vérifications déjà faites

- `tsc` et `npm run build` OK.
- Cycle complet piloté par de vrais événements pointeur :
  CHARGING → CASTING → WAITING → BITE → REELING → CAUGHT → IDLE.
- Issues testées : ferrage raté, clic pendant une fausse touche, Échap
  pendant la charge, changement d'appât refusé ligne sortie, barque immobile
  pendant la pêche.
- Point de chute : un lancer par-dessus l'île retombe dans l'eau libre
  derrière elle, un lancer vers la berge est raccourci (z = 36 pour une berge
  à 36,5), et un lancer face à la berge à bout portant ne trouve pas d'eau.
- Délais sur 2 000 tirages : environ 4 s en moyenne (roseaux, 7 h, asticots),
  10 s (eau profonde, 10 h, ver) et 21 s (eau libre, 14 h, maïs). Fausses
  touches : 0 à 3, espacées d'au moins 0,75 s.
- Captures vérifiées : charge (jauge, anneau sous le curseur), attente
  (caméra tournée vers le bouchon, zone affichée), touche (« ! »), et mise en
  page étroite (noms d'appâts masqués).

### Décisions techniques

- **Appâts dès la phase 2**, comme l'indique la section « Systèmes » de la
  spec. Leur effet sur les espèces viendra avec `fishSelector` en phase 3.
- **Horloge dès la phase 2**, puisque l'heure influence l'attente. La phase 4
  n'aura qu'à brancher le ciel et la lumière dessus.
- **Clic pendant l'attente = ramener la ligne** : c'est ce qui donne un
  enjeu aux fausses touches, sans autre pénalité que de relancer.
- **ESCAPED sert à toute ligne revenue vide** (annulation, trop tôt, raté),
  avec une raison (`EscapeReason`), pour rester fidèle au schéma d'états de la
  spec. La casse de ligne viendra en phase 3.
- **La visée est limitée à ±75° autour de l'axe de la caméra**, pour ne pas
  lancer vers la caméra (réglable : `CONFIG.fishing.maxAimAngle`).
- **Si des zones se chevauchent**, la première trouvée l'emporte
  (`zoneAt`). C'est à affiner en phase 4.

### Limites connues

- Pas encore d'ambiance sonore du lac (prévue en phase 5).
- Sur écran tactile, le lancer fonctionne mais la barque ne se déplace
  qu'au clavier.

---

## Phase 1 : scène, barque, caméra, levelLoader

### Livré

- Projet Vite 8 + TypeScript 7 + Three.js r186. Le dossier `assets/` est servi
  tel quel à la racine du site.
- `src/config.ts` : tous les réglages (barque, tangage, caméra, rendu, ambiance,
  touches, niveau placeholder).
- `src/scene/levelLoader.ts` : lit `assets/levels/lake_01.glb` et en extrait,
  d'après les noms d'objets, le départ, la caméra, l'eau, les zones, les
  collisions et le décor, dans une structure typée (`LevelData`). Chaque
  élément manquant a une valeur de secours et un avertissement clair.
- `src/scene/placeholderLevel.ts` : lac de démonstration en primitives (berge,
  île, rochers, roseaux, sapins, collines). Il suit les conventions de nommage
  et passe par le même parseur qu'un vrai `.glb`.
- Barque : déplacement lent avec inertie (ZQSD / WASD / flèches), collisions
  sur l'emprise au sol des `*_col` avec glissement le long des obstacles,
  tangage procédural (houle, inclinaison en virage, cabrage à l'accélération).
  `assets/props/boat.glb` est utilisé s'il existe, sinon une barque « cube ».
- Caméra à la troisième personne, suivi amorti. L'écart est lu depuis
  `cam_default`, sinon il vient de `config.ts`.
- Ciel en dôme dégradé, brouillard assorti à l'horizon, tone mapping ACES,
  ombre douce portée uniquement par la barque.
- Touche **G** : affichage des collisions, des zones et du départ.
- HUD minimal : écran de chargement, aide des touches, badge d'avertissements
  d'assets.
- `docs/BLENDER_CONVENTIONS.md`.

### Comment tester

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:5173.

1. Sans aucun asset, le lac placeholder s'affiche avec le badge
   « Niveau placeholder · 2 avertissements » (niveau et barque absents).
2. ZQSD / WASD / flèches : la barque avance lentement, glisse quand on relâche
   et tangue doucement.
3. Fonce sur l'île, les rochers ou la berge : la barque s'arrête en douceur
   et glisse si elle arrive en biais.
4. G : affiche ou masque les collisions, les zones et le départ.
5. Exporte un `lake_01.glb` depuis Blender dans `assets/levels/`, recharge la
   page, puis vérifie la console et la touche G.

### Vérifications déjà faites

- `tsc` sans erreur ; `npm run build` OK.
- Collisions simulées : la barque ne dépasse jamais la berge (rayon max
  35,3 m pour une berge à 36,5 m et une barque de 1,2 m). Elle s'arrête
  contre l'île et les rochers et glisse le long de la berge.
- Un `.glb` généré avec Blender 5.2 (compressé en Draco) a été chargé
  correctement, en dev comme en build de production. Ont été vérifiés : la
  conversion d'axes, le spawn tourné à 90°, l'écart caméra, la zone Empty et
  la zone mesh, les doublons `.001`, le warning sur un type de zone invalide et
  le message d'info sur un objet sans convention. Le fichier de test a ensuite
  été supprimé.

### Décisions techniques

- **Collisions** : pas de moteur physique. Chaque `*_col` est projeté vu de
  dessus en triangles 2D (`src/scene/footprint.ts`) et la barque est un cercle
  repoussé hors de ces triangles. Ça marche avec n'importe quelle forme (anneau
  de berge, île…) sans convention de forme particulière.
- **Avant = -Y dans Blender** (+Z dans Three.js), comme le veut la
  convention glTF.
- **`cam_default` est relatif au départ** : on garde son écart avec
  `spawn_boat`, exprimé dans le repère de la barque.
- **Draco** : three r186 fournit ses décodeurs et Vite les embarque au build
  (`DRACO_GLTF_CONFIG`). Pas besoin de CDN ni de plugin.
- **Ombres** : `PCFSoftShadowMap` a été retiré de three r186. On utilise
  `PCFShadowMap` avec `shadow.radius` pour adoucir les ombres.
- **Machine à états** : elle n'a pas été créée en phase 1, où elle n'aurait
  servi qu'à un état « chargement → jeu ». Une machine générique et typée sera
  introduite en phase 2 avec la machine de pêche
  (IDLE → CHARGING → … → IDLE).

### Limites connues (prévues pour plus tard)

- L'eau est un matériau simple et opaque. Le shader stylisé arrive en phase 5 ;
  il devra reprendre la réception de l'ombre de la barque.
- Le bundle JS fait environ 650 kB (principalement three.js). On pourra le
  découper si le chargement devient gênant.
- Le navigateur affiche ses propres lignes « 404 » pour les assets absents.
  C'est normal : le jeu les remplace par des placeholders.
