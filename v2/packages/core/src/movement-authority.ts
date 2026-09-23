/**
 * Autorité de mouvement unique (portage RC28 HOTFIX16 `movement-authority.ts`).
 *
 * Les systèmes opérationnels soumettent des contraintes GO/CAUTION/STOP ; seule la
 * décision publiée ici fait foi (raison + plafond de vitesse). Réutilisable par
 * train et par pas : `begin()` réinitialise sans allouer.
 */
export type MovementStatus = 'GO' | 'CAUTION' | 'STOP';

export interface MovementConstraint {
  status: 'CAUTION' | 'STOP';
  limitKmh: number;
  code: string;
  reason: string;
  source: string;
}

export interface MovementDecision {
  status: MovementStatus;
  speedLimitKmh: number;
  code: string;
  reason: string;
  source: string;
}

const GO: MovementDecision = { status: 'GO', speedLimitKmh: Number.POSITIVE_INFINITY, code: 'GO', reason: '', source: 'movement-authority' };

function finiteLimit(v: number): number {
  return Number.isFinite(v) ? Math.max(0, v) : Number.POSITIVE_INFINITY;
}

export class MovementAuthority {
  private readonly constraints: MovementConstraint[] = [];
  private used = 0;
  private baseLimitKmh = Number.POSITIVE_INFINITY;
  sequence = 0;

  begin(baseLimitKmh = Number.POSITIVE_INFINITY): this {
    this.baseLimitKmh = finiteLimit(baseLimitKmh);
    this.used = 0;
    this.sequence++;
    return this;
  }

  caution(limitKmh: number, code = 'CAUTION', reason = 'marche prudente', source = 'runtime'): this {
    const limit = finiteLimit(limitKmh);
    if (!(limit > 0) || limit === Number.POSITIVE_INFINITY) return this;
    return this.push('CAUTION', limit, code, reason, source);
  }

  stop(code = 'STOP', reason = 'arrêt de sécurité', source = 'runtime'): this {
    return this.push('STOP', 0, code, reason, source);
  }

  limit(limitKmh: number, code = 'LIMIT', reason = 'restriction de circulation', source = 'runtime'): this {
    const limit = finiteLimit(limitKmh);
    if (limit <= 0) return this.stop(code, reason, source);
    return this.caution(limit, code, reason, source);
  }

  /** Priorité STOP > CAUTION (plus basse limite ; premier soumis en cas d'égalité). */
  decision(): MovementDecision {
    let stop: MovementConstraint | null = null;
    let caution: MovementConstraint | null = null;
    for (let i = 0; i < this.used; i++) {
      const c = this.constraints[i];
      if (!c) continue;
      if (c.status === 'STOP' || c.limitKmh <= 0) {
        if (!stop || finiteLimit(c.limitKmh) < finiteLimit(stop.limitKmh)) stop = c;
      } else if (Number.isFinite(c.limitKmh)) {
        if (!caution || c.limitKmh < caution.limitKmh) caution = c;
      }
    }
    if (stop) return { status: 'STOP', speedLimitKmh: 0, code: stop.code, reason: stop.reason, source: stop.source };
    if (caution) {
      return {
        status: 'CAUTION',
        speedLimitKmh: Math.min(this.baseLimitKmh, caution.limitKmh),
        code: caution.code,
        reason: caution.reason,
        source: caution.source,
      };
    }
    return this.baseLimitKmh === Number.POSITIVE_INFINITY ? GO : { ...GO, speedLimitKmh: this.baseLimitKmh };
  }

  private push(status: 'CAUTION' | 'STOP', limitKmh: number, code: string, reason: string, source: string): this {
    const slot = this.constraints[this.used];
    if (slot) {
      slot.status = status;
      slot.limitKmh = limitKmh;
      slot.code = code;
      slot.reason = reason;
      slot.source = source;
    } else {
      this.constraints.push({ status, limitKmh, code, reason, source });
    }
    this.used++;
    return this;
  }
}
