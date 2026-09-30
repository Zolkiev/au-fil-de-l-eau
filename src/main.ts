import './style.css';
import { Game } from './core/game';
import { getWarnings } from './core/log';
import { Pwa } from './pwa/pwa';
import { Hud } from './ui/hud';
import { TEXTS } from './ui/texts';

/** Point d'entrée : charge le jeu, puis retire l'écran de chargement. */
async function main(hud: Hud): Promise<void> {
  // Créée tout de suite : le navigateur peut proposer l'installation pendant le chargement
  const pwa = new Pwa();
  const game = await Game.create(requireElement('app'), hud, pwa);
  // Le bandeau d'avertissements sert au développement ; le joueur ne le voit pas
  if (import.meta.env.DEV) hud.showAssetStatus(game.level.source === 'placeholder', getWarnings().length);
  hud.hideLoading();
  game.start();
  // Le service worker télécharge tout le jeu : on attend qu'il soit lancé pour ne pas le ralentir
  pwa.register();
  // Accès depuis la console du navigateur pendant le développement
  if (import.meta.env.DEV) Object.assign(window, { game });
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément #${id} introuvable dans index.html`);
  return element;
}

const hud = new Hud(requireElement('hud'));
main(hud).catch((error: unknown) => {
  console.error(error);
  hud.showFatalError(TEXTS.loadError);
});
