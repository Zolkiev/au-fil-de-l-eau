# Au fil de l’eau

Un petit jeu de pêche tout doux, en 3D low poly, qui se joue dans le
navigateur. Une barque, un lac, et tout le temps du monde : on lance sa ligne,
on attend que ça morde, on remonte le poisson et on remplit son carnet. Puis
on suit le fil de l’eau, du lac à la rivière, jusqu’à la mer.

**▶ Jouer :** https://zolkiev.github.io/au-fil-de-l-eau/

## Sur téléphone

Le jeu s’installe comme une application et marche ensuite sans connexion.

- **iPhone / iPad** : ouvrir le lien dans Safari › bouton Partager ›
  « Sur l’écran d’accueil ».
- **Android** : ouvrir le lien dans Chrome › « Installer le jeu » sur l’écran
  titre (ou menu ⋮ › Installer l’application).

Si le jeu manque de fluidité : Réglages › Affichage › Qualité graphique
(Basse, Moyenne, Haute ; « Auto » s’adapte tout seul).

## Commandes

| Ordinateur | Téléphone | Action |
| --- | --- | --- |
| WASD / ZQSD ou flèches | Joystick | Ramer |
| Clic maintenu, puis relâcher | Doigt maintenu, puis lâcher | Lancer |
| Clic quand ça mord | Toucher quand ça mord | Ferrer |
| Clic maintenu | Doigt maintenu | Mouliner (relâcher si la ligne est trop tendue) |
| J / C | Boutons en haut à droite | Carnet / ponton de Moustache |

Les touches se changent dans Réglages › Clavier.

## Développement

Vite + TypeScript + Three.js, sans autre dépendance. Les niveaux, la barque et
les poissons viennent de Blender (`blender/`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vérifie les types, puis construit dist/
npm run preview    # sert le build (avec le mode hors connexion)
```

Chaque push sur `main` met le jeu en ligne sur GitHub Pages
(`.github/workflows/deploy.yml`).

Pour aller plus loin : `docs/PROGRESS.md` (avancement et choix techniques) et
`docs/BLENDER_CONVENTIONS.md` (noms d’objets à respecter dans Blender).
