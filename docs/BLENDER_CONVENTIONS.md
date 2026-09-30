# Conventions Blender → Au fil de l’eau

## En bref

- Un lieu de pêche = un niveau = un fichier `assets/levels/<nom>.glb` :
  `lake_01.glb` (le lac), `river_01.glb` (la rivière) et `cove_01.glb` (la
  crique, au bord de la mer). La liste des lieux
  est dans `src/data/places.ts`.
- Le jeu lit **uniquement les noms d'objets** : aucune position n'est codée en dur.
- Tout est optionnel. Un élément absent est remplacé par une valeur de secours
  et signalé par un avertissement dans la console du navigateur (F12). Un badge
  en haut à gauche de l'écran indique le nombre d'avertissements.
- En jeu, la touche **G** affiche les collisions (rouge), les zones de pêche
  (couleur par type) et le point de départ (flèche jaune). Pratique pour
  vérifier un export.

Sans le `.glb` d'un lieu, le jeu génère un lac de démonstration qui suit
exactement ces conventions (`src/scene/placeholderLevel.ts`).

Le jeu est jouable hors connexion : tout fichier de `assets/` (niveau,
poisson, son…) est mis en cache automatiquement au build suivant. Après un
export, relance `npm run build` ; les joueurs verront « Mettre à jour » au
prochain passage.

## Assets fournis : `blender/`

Tous les assets du jeu ont été créés dans Blender et sont livrés avec leurs
sources :

- **`blender/petite_peche.blend`** contient une scène par asset : `lake_01`,
  `river_01`, `cove_01`, `boat`, `rod`, `bobber`, `cat` et `fish_<id>` (les
  22 poissons). C'est le fichier
  à ouvrir pour retoucher un asset à la main.
- **`blender/export_assets.py`** exporte toutes ces scènes en `.glb` dans
  `assets/` sans rien modifier. Pour t'en servir : ouvre
  `petite_peche.blend`, puis onglet *Scripting* › *Ouvrir* ›
  `export_assets.py` › *Exécuter*. Correspondance :
  - `lake_01`, `river_01`, `cove_01` → `levels/<nom>.glb` (compressés en
    Draco) ;
  - `boat`, `rod`, `bobber`, `cat` → `props/<nom>.glb` ;
  - `fish_<id>` → `fish/<id>.glb`.
- **`blender/generate_assets.py`** (et le dossier `petite_peche/`) recrée
  toutes les scènes par programme, puis enregistre le `.blend`.
  ⚠ Il **remplace tout le fichier** : à ne relancer que pour repartir de zéro
  ou après avoir modifié les générateurs. Après des retouches à la main,
  utilise seulement l'export.

Les objets sont colorés par face (attribut de couleur « Col », lu par un
matériau « Palette ») : pour recolorer, passe en mode *Vertex Paint* ou
retouche les couleurs dans les générateurs. Pour voir ces couleurs dans la
vue 3D : *Viewport Shading* › *Color* › *Attribute*.

Un objet de décor peut aussi avoir son propre matériau, exporté tel quel.
Par exemple, la lampe du phare de la crique (`deco_lighthouse_lamp`) a un
matériau émissif, « LighthouseGlass », et pas d'attribut « Col » : elle
brille de jour comme de nuit. Une émission non noire suffit pour qu'un objet
brille ; seule la lanterne de la barque s'allume et s'éteint avec la nuit.

## Réglages d'export

*File › Export › glTF 2.0*

| Option | Valeur |
| --- | --- |
| Format | **glTF Binary (.glb)** |
| Include › Limit to | Ne pas cocher « Visible Objects » si tu masques les `_col` ou les zones dans Blender |
| Include › Data › Object Types | Empty et Mesh inclus (défaut) |
| Transform › +Y Up | Coché (défaut) |
| Data › Mesh › Apply Modifiers | Coché |
| Data › Compression | Facultatif : Draco est pris en charge |

## Échelle et axes

- 1 unité Blender = 1 mètre. Pour se repérer : la barque mesure environ 3,5 m
  et son cercle de collision fait 1,2 m de rayon.
- La verticale est Z dans Blender. La conversion vers Three.js (Y vertical) est
  automatique.
- **L'avant d'un objet pointe vers -Y dans Blender.** En vue de face (pavé
  numérique 1), on voit donc l'avant des objets. C'est la convention glTF
  (l'avant regarde +Z une fois exporté). Ça concerne `spawn_boat` et
  `boat.glb`.

## Noms d'objets

| Nom | Type | Rôle |
| --- | --- | --- |
| `spawn_boat` | Empty | Départ de la barque. Position au sol et rotation autour de Z utilisées ; la hauteur est ignorée (la barque est posée sur l'eau). |
| `cam_default` | Empty | Position de la caméra par rapport à la barque au départ. Le jeu conserve cet écart en suivant la barque (ex. 7 m derrière, 3 m au-dessus). |
| `water` | Mesh | Plan d'eau. Seules son emprise vue de dessus et sa hauteur (son point le plus haut) comptent : le jeu le remplace par sa propre surface animée. |
| `zone_<type>_<n>` | Empty ou Mesh | Zone de pêche, masquée en jeu (voir plus bas). |
| `*_col` | Mesh | Collision : la barque ne peut pas y entrer. Masquée en jeu. |
| `deco_*` | Tout | Décor, rendu tel quel. |
| `deco_*_sway` | Mesh | Décor qui **ondule au vent** (arbres, roseaux) : le pied reste fixe, le haut balance (doucement par temps calme, fort par grand vent). Le jeu mesure la hauteur de chaque sommet au-dessus du reste du décor ; balancement complet à partir de 2,5 m (`CONFIG.decorLife.swayHeight`). |
| `water_flow` | Empty (facultatif) | Courant d'une rivière : l'Empty pointe vers l'**aval** (son avant, -Y, comme la barque ; une flèche « Single Arrow » tournée dans le sens du courant) et son **échelle** donne la vitesse en m/s (0,6 pour la rivière). Les vagues et l'écume sont emportées, des feuilles dérivent et on entend l'eau vive. Sans lui, l'eau est calme (lac). |
| `fish_pen` | Empty « Circle » (facultatif) | Vivier : centre de la **surface de l'eau** du bac, rayon = échelle (couché à plat comme une zone, rotation X 90°). Le jeu y ajoute une eau transparente et les poissons gardés. Le bac lui-même est un objet de décor (`deco_fish_pen`), ouvert en haut. Sans `fish_pen`, les poissons gardés restent seulement listés au ponton. |
| `cam_fish_pen` | Empty (facultatif) | Point de vue de la vue rapprochée du vivier (la caméra regarde le centre du bac). Sans lui, elle se place en retrait côté terre (`CONFIG.pen.viewDistance`, `viewHeight`). |
| `npc_cat` | Empty (facultatif) | Où s'assoit Moustache, le chat des demandes : position exacte (sur le ponton, la berge…) et rotation autour de Z (son regard suit -Y, comme la barque). Sans lui, Moustache n'apparaît pas dans le décor, mais ses demandes restent accessibles par le bouton 🐈. |
| autre | — | Rendu tel quel, et listé dans la console (message d'info) pour repérer les fautes de frappe. |

Règles de nommage :

- C'est le nom de l'**objet** qui compte (celui de l'Outliner), pas celui de
  son mesh.
- Les doublons de Blender (`.001`, `.002`…) sont tolérés : `rock_col.001` reste
  une collision.
- Évite les caractères `. : / [ ]` et les espaces dans les noms : Three.js les
  supprime ou les remplace.
- Les enfants d'un objet reconnu font partie de cet objet (ex. un `deco_arbre`
  composé de plusieurs sous-objets). Le jeu ne cherche pas de convention à
  l'intérieur.

## Zones de pêche : `zone_<type>_<n>`

`<type>` est l'un des quatre suivants : `shallow` (eau peu profonde), `deep`
(eau profonde), `reeds` (roseaux) ou `rocks` (rochers). `<n>` est un numéro
(`zone_reeds_1`, `zone_reeds_2`…). Un autre type est ignoré, avec un
avertissement.

Deux façons de définir une zone :

- **Empty (recommandé)** : type d'affichage « Circle », *Size* = 1, et
  **rotation X = 90°**. Blender dessine ce cercle à la verticale (plan XZ) :
  couché à plat, il montre exactement la zone vue de dessus. Le jeu ignore la
  rotation. **Le rayon de la zone est l'échelle de l'Empty** : une échelle de 8
  donne une zone de 8 m de rayon. Garde une échelle uniforme.
- **Mesh** : forme libre. La zone correspond à ce que couvre le mesh **vu de
  dessus**. Un plan découpé à la forme voulue suffit.

Les zones peuvent se chevaucher : c'est alors **la plus petite** qui compte
(par exemple une touffe de roseaux au milieu d'une grande zone peu profonde).

## Collisions : `*_col`

- La barque est un cercle. Elle ne peut pas entrer dans ce que couvre un mesh
  `_col` **vu de dessus** : seule l'emprise au sol compte, pas la hauteur.
- **Pour fermer le lac**, fais un anneau autour de l'eau (cylindre + booléen,
  ou plan en anneau) nommé par exemple `shore_col`, avec son bord intérieur
  légèrement dans l'eau.
- Pour les rochers, îles ou pontons, un cylindre ou un prisme simple par
  obstacle suffit (`rock_01_col`, `island_col`…).
- Garde des meshes simples (quelques dizaines à quelques centaines de
  triangles) : ils sont testés à chaque image.
- Filet de sécurité : le centre de la barque doit aussi rester au-dessus du
  mesh `water`.
- Si `spawn_boat` est placé dans une collision ou hors de l'eau, la limite
  fautive est désactivée (avec un avertissement) pour que le jeu reste jouable.

## Eau : `water`

- Un mesh plat, de n'importe quelle forme vue de dessus. Un simple plan
  suffit : le jeu le **remplace** par sa propre surface facettée (une grille
  de `CONFIG.water.cellSize` = 1,2 m), qui ondule et reçoit le shader d'eau.
  Inutile de le subdiviser.
- Il peut passer sous la berge, mais il faut alors une collision `_col` pour
  délimiter la zone navigable.
- **Modélise le fond du lac** (un simple décor `deco_*` sous l'eau, par
  exemple une cuvette). Le jeu mesure la profondeur sous chaque point de
  l'eau en lançant un rayon vers le bas sur le décor visible :
  - eau claire et turquoise là où c'est peu profond, plus sombre au large ;
  - écume là où un objet affleure (berge, île, rochers) ;
  - vagues amorties près du bord.

  Sans fond modélisé, l'eau est considérée comme profonde de
  `CONFIG.water.defaultDepth` mètres.
- Pour que l'écume se voie bien, donne aux berges, îles et rochers une
  **pente douce** sous l'eau plutôt que des flancs verticaux.

## Barque : `assets/props/boat.glb`

- Origine au centre de la barque, **au niveau de la ligne de flottaison**.
- L'avant pointe vers -Y, longueur d'environ 3 à 4 m.
- L'ombre portée est activée automatiquement sur tous ses meshes.
- **`rod_mount`** (Empty) : point où la poignée de la canne est fixée,
  typiquement sur le bord droit. La canne hérite de son orientation : laisse-le
  sans rotation pour la position de repos par défaut. S'il est absent, la canne
  est fixée à `CONFIG.rod.fallbackMount`, avec un avertissement.
- **`water_mask`** (mesh, recommandé) : un simple plan posé **à la hauteur
  des plats-bords**, qui couvre tout l'intérieur de la coque vu de dessus. Il
  est invisible en jeu : il empêche seulement le plan d'eau de se dessiner
  dans la barque (sinon, si le fond est sous la ligne de flottaison, la
  barque paraît remplie d'eau). La coque doit être fermée jusqu'aux
  plats-bords tout autour du masque.
- **`lantern`** (Empty ou petit objet, facultatif) : emplacement de la
  lanterne qui s'allume la nuit (lumière chaude). Si c'est un objet avec un
  matériau émissif (couleur d'émission non noire), il brille aussi la nuit.
  Sans `lantern`, la lumière est placée au-dessus du centre de la barque.
- **Peinture (décoration de la cabane)** : le jeu repeint les sommets de la
  couleur d'origine `#6aa9a8` (bleu-vert). Si tu changes cette couleur dans
  Blender, change aussi la décoration à prix 0 `paint_teal` dans
  `src/data/shop.ts`, sinon la peinture achetée n'aura pas d'effet (un
  message le signale dans la console). La lueur de la lanterne se change
  sans condition.

## Canne : `assets/props/rod.glb`

- Origine = **pivot de la canne** (la poignée). C'est autour de ce point que le
  jeu la fait basculer et tourner.
- La canne est modélisée **allongée vers l'avant (-Y dans Blender)**, à
  l'horizontale : c'est le jeu qui la relève (voir les angles de
  `CONFIG.rod`).
- **`rod_tip`** (Empty, enfant de la canne) : la pointe, d'où part la ligne.
  S'il est absent, la pointe est placée au bout du modèle, avec un
  avertissement.
- Longueur de référence : environ 2,4 m.

## Bouchon : `assets/props/bobber.glb`

- Origine = **ligne de flottaison** : ce qui est sous l'origine est immergé.
- Environ 20 cm de haut en taille réelle. Le jeu l'agrandit selon
  `CONFIG.fishing.bobberSize` (1,6 par défaut) pour qu'il reste lisible de
  loin.
- La ligne s'attache au point le plus haut du modèle.
- **Couleur (décoration de la cabane)** : le jeu repeint les sommets de la
  couleur d'origine `#e0483c` (rouge du dôme et de l'antenne). Même règle
  que pour la barque : elle doit correspondre à `bobber_red` dans
  `src/data/shop.ts`.

## Moustache : `assets/props/cat.glb`

- Le chat qui donne les demandes, assis sur l'Empty `npc_cat` du niveau.
- Origine **au sol** (sous ses pattes), regard vers -Y. Environ 0,7 m de haut
  avec le chapeau ; le jeu l'agrandit de `CONFIG.cat.scale` (1,3) pour qu'on
  le voie depuis la barque.
- **`cat_tail`** (objet enfant, facultatif) : la queue, avec son origine **à
  sa base**. Le jeu la fait balancer autour de la verticale. Sans elle, le
  chat reste immobile (il respire quand même).
- Absent : un chat en primitives le remplace.

## Poissons : `assets/fish/<id>.glb`

- Un fichier par espèce ; `<id>` est l'identifiant de l'espèce dans
  `src/data/fish.ts` : `ablette_miroir`, `gardon_perle`, `perche_zebree`,
  `rotengle_dore`, `tanche_vase`, `breme_lune`, `carpe_mousse`,
  `sandre_ombre`, `brochet_emeraude`, `silure_brumes` (le lac), et
  `vairon_vif`, `chevesne_malin`, `truite_ruisseau`, `barbeau_gue`,
  `ombre_cascade`, `anguille_lune` (la rivière), et `maquereau_raye`,
  `rouget_corail`, `bar_ecume`, `daurade_doree`, `vieille_arlequin`,
  `espadon_marees` (la crique).
- Origine au centre du poisson, **tête vers -Y dans Blender** (comme l'avant
  de la barque), dos vers +Z.
- L'échelle n'a pas d'importance : le jeu remet le poisson à sa taille tirée
  au sort pour le saut, puis à une taille lisible pour la présentation.
- **Animation `swim`** (en boucle) : jouée si elle existe. C'est le nom de
  l'**action** Blender qui compte : l'export en fait un clip `swim`.
- Poissons fournis : chaque mesh est déformé par une armature `<id>_rig`
  (os `spine` au centre, `head` vers le museau, `tail_1` puis `tail_2`
  jusqu'au bout de la nageoire caudale). Toutes les armatures ont les mêmes os
  et partagent **une seule action `swim`** (1 s, images 0 à 24, clé 0 = clé
  24) : retoucher cette action change la nage de tous les poissons. Les poids
  sont répartis le long du corps (groupes de sommets du même nom que les os).
  Pour animer un nouveau poisson avec cette action, donne à son armature les
  mêmes noms d'os et, dans l'*Action Editor*, choisis l'action `swim` et son
  slot.
- **Sans animation**, le jeu fait onduler le poisson en code (une vague de la
  tête vers la queue, plus ample vers la queue). Pour que l'ondulation soit
  propre : **applique les transformations** (Ctrl+A › All Transforms) et
  **joins les pièces en un seul objet** (Ctrl+J).
- Un poisson absent est remplacé par un poisson en primitives aux couleurs de
  l'espèce, avec un avertissement la première fois qu'on l'attrape.

## Sons : `assets/audio/`

Ce ne sont pas des fichiers Blender, mais ils suivent la même logique : un
emplacement par son (`CONFIG.audio.files`). Si le fichier existe, il est
utilisé ; sinon, un son généré en WebAudio le remplace (un seul avertissement
regroupe tous les sons absents).

| Emplacement | Moment |
| --- | --- |
| `audio/cast.ogg` | Lancer |
| `audio/splash.ogg` | Le bouchon touche l'eau |
| `audio/nibble.ogg` | Fausse touche |
| `audio/bite.ogg` | Vraie touche |
| `audio/reel.ogg` | Cliquetis du moulinet (joué en boucle quand la ligne revient) |
| `audio/snap.ogg` | La ligne casse |
| `audio/catch.ogg` | Petit jingle de prise |
| `audio/lake_day.ogg` | Ambiance du lac le jour (boucle) |
| `audio/lake_night.ogg` | Ambiance du lac la nuit (boucle, fondue avec celle du jour) |
| `audio/river.ogg` | Eau vive (boucle), ajoutée à l'ambiance sur une eau qui coule (`water_flow`) |
| `audio/rain.ogg` | Pluie (boucle), selon la météo |
| `audio/wind.ogg` | Vent (boucle), selon la météo |
| `audio/sea.ogg` | Ressac et mouettes (boucle), ajouté à l'ambiance des lieux au bord de la mer (la crique) |
| `audio/music.ogg` | Musique (boucle) ; sans fichier, une boîte à musique générée joue à la place |

Les formats `.ogg`, `.mp3` et `.wav` conviennent : il suffit d'adapter
l'extension dans `config.ts`.

## Dépannage

| Avertissement dans la console | Cause probable |
| --- | --- |
| `« assets/levels/<nom>.glb » introuvable ou illisible` | Fichier absent, mal nommé, ou exporté en `.gltf` au lieu de `.glb`. |
| `aucun objet « water »` | L'objet d'eau n'est pas nommé exactement `water` (vérifie le nom de l'objet, pas celui du mesh). |
| `zone « … » ignorée` | Type de zone inconnu ou numéro manquant (`zone_reeds` → `zone_reeds_1`). |
| `aucun mesh « *_col »` | Aucune collision : ajoute une berge `shore_col`. |
| `les objets « *_col » ne contiennent aucun triangle` | Les collisions sont des Empties : il faut des meshes. |
| `« spawn_boat » est dans un mesh *_col` | Déplace l'Empty de départ dans l'eau libre. |
| `« rod_mount » absent de boat.glb` / `« rod_tip » absent de rod.glb` | Ajoute l'Empty correspondant (nom exact). |
| (info) `pas de « water_mask » dans boat.glb` | La barque se remplit d'eau : ajoute le plan `water_mask` (voir « Barque »). |
| (info) `pas d’objet « lantern » dans boat.glb` | Facultatif : ajoute un Empty `lantern` pour placer la lanterne. |
| `Poisson « … » : « assets/fish/<id>.glb » introuvable` | Nom de fichier différent de l'identifiant de l'espèce. |
| (info) `pas d’Empty « fish_pen »` | Facultatif : ajoute l'Empty (et un bac `deco_*`) pour que les poissons gardés nagent dans le décor. |
| (info) `pas d’Empty « npc_cat »` | Facultatif : ajoute l'Empty pour que Moustache apparaisse dans le décor. |
| (info) `décoration : couleur d’origine … introuvable` | La couleur de la barque ou du bouchon a changé dans Blender : mets à jour la décoration à prix 0 dans `src/data/shop.ts`. |
| Le poisson ondule « en morceaux » | Transformations non appliquées ou plusieurs objets : Ctrl+A puis Ctrl+J. |
| Le poisson ne nage pas (ondulation en code à la place) | L'action ne s'appelle pas exactement `swim`, ou elle n'est pas assignée à l'armature. |
| Des objets n'apparaissent pas du tout | « Limit to › Visible Objects » est coché à l'export alors qu'ils sont masqués dans Blender. |
