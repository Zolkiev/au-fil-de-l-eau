import { CONFIG } from '../config';

/** Fonction appelée à chaque frame : `dt` et `elapsed` en secondes. */
export type FrameCallback = (dt: number, elapsed: number) => void;

/**
 * Boucle principale basée sur requestAnimationFrame.
 * Le pas de temps est plafonné pour éviter les sauts (onglet en arrière-plan…).
 */
export class GameLoop {
  private readonly onFrame: FrameCallback;
  private lastTime = 0;
  private elapsed = 0;
  private frameId = 0;

  constructor(onFrame: FrameCallback) {
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.frameId !== 0) return;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), CONFIG.loop.maxDelta);
    this.lastTime = now;
    this.elapsed += dt;
    this.onFrame(dt, this.elapsed);
    this.frameId = requestAnimationFrame(this.tick);
  };
}
