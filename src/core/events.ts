type Listener<T> = (payload: T) => void;

/**
 * Petit émetteur d'événements typé.
 * `Events` associe chaque nom d'événement au type de ce qu'il transporte.
 */
export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Abonnement ; retourne la fonction de désabonnement. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener as Listener<never>);
    this.listeners.set(type, set);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.listeners.get(type)?.forEach((listener) => (listener as Listener<Events[K]>)(payload));
  }
}
