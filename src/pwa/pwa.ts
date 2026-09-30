import { CONFIG } from '../config';
import { Emitter } from '../core/events';
import { info } from '../core/log';

/** Événement d'installation de Chrome/Edge/Android (absent des types du DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** Ce qui change pour l'interface : installation possible, mise à jour prête, jeu disponible hors ligne. */
export interface PwaEvents {
  change: void;
  offlineReady: void;
}

/**
 * Le jeu comme application (PWA) :
 * - enregistre le service worker (build seulement : en dev, il gênerait le
 *   rechargement à chaud) ;
 * - garde la proposition d'installation du navigateur, pour un bouton
 *   « Installer » ;
 * - repère une nouvelle version téléchargée, et l'applique quand le joueur le
 *   demande.
 */
export class Pwa {
  readonly events = new Emitter<PwaEvents>();
  private registration: ServiceWorkerRegistration | null = null;
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private lastUpdateCheck = 0;

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      this.events.emit('change', undefined);
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.events.emit('change', undefined);
    });
  }

  /** Le navigateur propose d'installer le jeu (Chrome, Edge, Android). */
  get canInstall(): boolean {
    return this.installPrompt !== null;
  }

  /** Safari sur iPhone/iPad, hors de l'écran d'accueil : on explique comment l'y ajouter. */
  get needsIosHint(): boolean {
    return (navigator as Navigator & { standalone?: boolean }).standalone === false;
  }

  /** Une nouvelle version est prête, et attend que le joueur l'accepte. */
  get updateReady(): boolean {
    return Boolean(this.registration?.waiting && navigator.serviceWorker.controller);
  }

  register(): void {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const firstInstall = !navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('sw.js')
      .then((registration) => this.watch(registration, firstInstall))
      .catch((error: unknown) => info('pwa', `service worker non enregistré (${String(error)}) : pas de jeu hors ligne.`));
  }

  /** Ouvre la fenêtre d'installation du navigateur. */
  async install(): Promise<void> {
    const prompt = this.installPrompt;
    if (!prompt) return;
    this.installPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
    this.events.emit('change', undefined);
  }

  /** Passe à la nouvelle version : la page se recharge dès qu'elle a pris la main. */
  applyUpdate(): void {
    const waiting = this.registration?.waiting;
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    waiting.postMessage('skip-waiting');
  }

  private watch(registration: ServiceWorkerRegistration, firstInstall: boolean): void {
    this.registration = registration;
    if (registration.waiting) this.events.emit('change', undefined);
    registration.addEventListener('updatefound', () => this.followInstall(registration.installing, firstInstall));
    // Le jeu peut rester ouvert longtemps (téléphone) : on vérifie les mises à jour au retour
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.checkForUpdate();
    });
  }

  /**
   * Suit l'installation d'une version : la première fois, le jeu est
   * disponible hors ligne dès qu'elle est active ; ensuite, c'est une mise à
   * jour qui attend (état « installed »).
   */
  private followInstall(worker: ServiceWorker | null, firstInstall: boolean): void {
    worker?.addEventListener('statechange', () => {
      if (firstInstall && worker.state === 'activated') this.events.emit('offlineReady', undefined);
      else if (!firstInstall && worker.state === 'installed') this.events.emit('change', undefined);
    });
  }

  private checkForUpdate(): void {
    const now = performance.now();
    if (!this.registration || now - this.lastUpdateCheck < CONFIG.pwa.updateCheckMinutes * 60_000) return;
    this.lastUpdateCheck = now;
    this.registration.update().catch(() => {
      // Hors ligne : on réessaiera plus tard
    });
  }
}
