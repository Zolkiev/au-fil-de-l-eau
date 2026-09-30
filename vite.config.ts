import { defineConfig } from 'vite';
import { pwaPlugin } from './scripts/pwaPlugin';

export default defineConfig({
  // Chemins relatifs : le build fonctionne aussi dans un sous-dossier (itch.io, GitHub Pages…)
  base: './',
  // Le dossier assets/ (levels, fish, props, audio) est servi tel quel à la racine du site
  publicDir: 'assets',
  // Vrais 404 pour les assets absents (sinon Vite renverrait index.html à la place)
  appType: 'mpa',
  // Service worker (jeu jouable hors connexion), produit au build seulement
  plugins: [pwaPlugin()],
});
