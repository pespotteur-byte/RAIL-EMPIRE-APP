/**
 * Cantonnement (portage RC28 `CantonManager`) : un canton ne peut être occupé ou
 * réservé que par un seul mouvement ; deux cantons virtuels qui partagent un
 * segment physique (ressource) s'excluent mutuellement.
 *
 * Fail-closed : `occupy()` ne vole jamais un canton réservé par un autre train
 * vivant ; un propriétaire disparu (`isGone`) est nettoyé à la volée.
 */
import type { BlockAssignment } from './rail-route.ts';

interface Canton {
  readonly id: string;
  occupiedBy: string | null;
  reservedBy: string | null;
  readonly resourceIds: Set<string>;
}

export interface BlockConflict {
  cantonId: string;
  resourceId: string | null;
  owner: string;
  field: 'occupiedBy' | 'reservedBy';
}

export interface BlockManagerOptions {
  /** true si le mouvement n'existe plus : ses cantons sont libérés. */
  isGone?: (trainId: string) => boolean;
  /** identité physique partagée (ex. même rame en rotation) */
  sameMovement?: (a: string, b: string) => boolean;
}

export class BlockManager {
  private readonly cantons = new Map<string, Canton>();
  private readonly resourceCantons = new Map<string, Set<string>>();
  private readonly trainCantons = new Map<string, Set<string>>();
  private readonly isGone: (trainId: string) => boolean;
  private readonly same: (a: string, b: string) => boolean;

  constructor(opts: BlockManagerOptions = {}) {
    this.isGone = opts.isGone ?? (() => false);
    this.same = opts.sameMovement ?? ((a, b) => a === b);
  }

  get cantonCount(): number {
    return this.cantons.size;
  }

  /** Enregistre les cantons d'une route (idempotent, partage par clé géographique). */
  register(blocks: readonly BlockAssignment[]): void {
    for (const b of blocks) {
      let c = this.cantons.get(b.cantonId);
      if (!c) {
        c = { id: b.cantonId, occupiedBy: null, reservedBy: null, resourceIds: new Set() };
        this.cantons.set(b.cantonId, c);
      }
      for (const rid of b.resourceIds) {
        c.resourceIds.add(rid);
        let set = this.resourceCantons.get(rid);
        if (!set) {
          set = new Set();
          this.resourceCantons.set(rid, set);
        }
        set.add(b.cantonId);
      }
    }
  }

  occupant(cantonId: string): string | null {
    return this.cantons.get(cantonId)?.occupiedBy ?? null;
  }

  reservation(cantonId: string): string | null {
    return this.cantons.get(cantonId)?.reservedBy ?? null;
  }

  /** Canton libre pour `trainId` (aucun autre mouvement vivant dessus ni sur ses ressources). */
  isAvailable(cantonId: string, trainId: string): boolean {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    return this.clearOwners(c, trainId) && this.conflict(c, trainId) === null;
  }

  reserve(cantonId: string, trainId: string): boolean {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    if (!this.clearOwners(c, trainId) || this.conflict(c, trainId)) return false;
    c.reservedBy = trainId;
    this.track(trainId, cantonId);
    return true;
  }

  occupy(cantonId: string, trainId: string): boolean {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    if (!this.clearOwners(c, trainId) || this.conflict(c, trainId)) return false;
    if (c.occupiedBy === null || c.occupiedBy === trainId) c.occupiedBy = trainId;
    if (c.reservedBy === trainId) c.reservedBy = null;
    this.track(trainId, cantonId);
    return true;
  }

  release(cantonId: string, trainId: string): void {
    const c = this.cantons.get(cantonId);
    if (!c) return;
    if (c.occupiedBy === trainId) c.occupiedBy = null;
    if (c.reservedBy === trainId) c.reservedBy = null;
    const tc = this.trainCantons.get(trainId);
    if (tc) {
      tc.delete(cantonId);
      if (!tc.size) this.trainCantons.delete(trainId);
    }
  }

  releaseAll(trainId: string): void {
    const tc = this.trainCantons.get(trainId);
    if (!tc) return;
    for (const id of [...tc]) this.release(id, trainId);
  }

  heldBy(trainId: string): readonly string[] {
    return [...(this.trainCantons.get(trainId) ?? [])];
  }

  /** Premier conflit de ressource physique avec un autre mouvement vivant. */
  conflictFor(cantonId: string, trainId: string): BlockConflict | null {
    const c = this.cantons.get(cantonId);
    return c ? this.conflict(c, trainId) : null;
  }

  private conflict(c: Canton, trainId: string): BlockConflict | null {
    for (const rid of c.resourceIds) {
      const ids = this.resourceCantons.get(rid);
      if (!ids) continue;
      for (const cid of ids) {
        if (cid === c.id) continue;
        const other = this.cantons.get(cid);
        if (!other) continue;
        for (const field of ['occupiedBy', 'reservedBy'] as const) {
          const owner = other[field];
          if (owner === null || this.same(owner, trainId)) continue;
          if (this.isGone(owner)) other[field] = null;
          else return { cantonId: cid, resourceId: rid, owner, field };
        }
      }
    }
    return null;
  }

  /** Nettoie les propriétaires disparus ; false si un autre mouvement vivant tient le canton. */
  private clearOwners(c: Canton, trainId: string): boolean {
    for (const field of ['occupiedBy', 'reservedBy'] as const) {
      const owner = c[field];
      if (owner === null || this.same(owner, trainId)) continue;
      if (!this.isGone(owner)) return false;
      c[field] = null;
    }
    return true;
  }

  private track(trainId: string, cantonId: string): void {
    let set = this.trainCantons.get(trainId);
    if (!set) {
      set = new Set();
      this.trainCantons.set(trainId, set);
    }
    set.add(cantonId);
  }
}
