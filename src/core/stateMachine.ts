/** Transitions autorisées : pour chaque état, la liste des états suivants possibles. */
export type TransitionTable<S extends string> = { readonly [K in S]: readonly S[] };

type Listener<S> = (to: S, from: S) => void;

/**
 * Machine à états générique et typée.
 * Les transitions sont déclarées explicitement : une transition non prévue
 * est refusée et signalée dans la console (c'est un bug de code).
 */
export class StateMachine<S extends string> {
  private readonly name: string;
  private readonly transitions: TransitionTable<S>;
  private readonly listeners = new Set<Listener<S>>();
  private current: S;
  private elapsed = 0;

  constructor(name: string, initial: S, transitions: TransitionTable<S>) {
    this.name = name;
    this.current = initial;
    this.transitions = transitions;
  }

  get state(): S {
    return this.current;
  }

  /** Secondes de jeu passées dans l'état courant. */
  get timeInState(): number {
    return this.elapsed;
  }

  /** À appeler à chaque frame pour faire avancer `timeInState`. */
  update(dt: number): void {
    this.elapsed += dt;
  }

  can(to: S): boolean {
    return this.transitions[this.current].includes(to);
  }

  /** Change d'état si la transition est autorisée. Retourne true en cas de succès. */
  go(to: S): boolean {
    if (!this.can(to)) {
      console.error(`[${this.name}] transition interdite : ${this.current} → ${to}`);
      return false;
    }
    const from = this.current;
    this.current = to;
    this.elapsed = 0;
    this.listeners.forEach((listener) => listener(to, from));
    return true;
  }

  /** Abonnement aux changements d'état ; retourne la fonction de désabonnement. */
  onChange(listener: Listener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
