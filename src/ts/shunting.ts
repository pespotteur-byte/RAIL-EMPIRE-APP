import { htmlText } from './html-text.js';
type ShuntingPhase = 'arriving' | 'uncoupling' | 'pushing' | 'loading' | 'pulling' | 'coupling' | 'inspection' | 'departing';
type OperationPhase = ShuntingPhase | 'completed';
type ShuntingPhaseInfo = { name: string; duration: number; description: string };
type ShuntingOptions = { loadingSpeedMultiplier?: unknown; shuntingSpeedMultiplier?: unknown };
type ShuntingOperation = {
    id: string;
    serviceId: string;
    stationId: string;
    depotId: string;
    cargoType: string;
    tonnage: number;
    wagons: number;
    phase: OperationPhase;
    phaseIndex: number;
    phaseElapsed: number;
    totalElapsed: number;
    startTime: number;
    completed: boolean;
    phaseDurations: Record<string, number>;
};
type ShuntingHistoryEntry = {
    id: string; serviceId: string; cargoType: string; tonnage: number; wagons: number; duration: number; completedAt: number;
};
type ShuntingStats = {
    totalOperations: number; totalWagonsHandled: number; totalTonnageHandled: number; averageDuration: number; totalDuration: number;
};
type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Shunting — Realistic shunting/triage operations for freight trains.
 * Simulates: arrival → uncoupling → pushing to loading track → loading → coupling → departure.
 */
let nextOpId = 1;
const SHUNTING_PHASES: Record<ShuntingPhase, ShuntingPhaseInfo> = {
    arriving: { name: 'Arrivée en ITE', duration: 5, description: 'Le train arrive sur les voies de l\'ITE' },
    uncoupling: { name: 'Découplage', duration: 8, description: 'Découplage des wagons du locotracteur' },
    pushing: { name: 'Poussage', duration: 10, description: 'Les wagons sont poussés sur la voie de chargement' },
    loading: { name: 'Chargement', duration: 15, description: 'Chargement/déchargement des marchandises' },
    pulling: { name: 'Tirage', duration: 8, description: 'Les wagons sont tirés hors de la voie de chargement' },
    coupling: { name: 'Recouplage', duration: 6, description: 'Recouplage des wagons au train' },
    inspection: { name: 'Inspection', duration: 5, description: 'Vérification freins et attelages' },
    departing: { name: 'Départ', duration: 3, description: 'Le train repart vers sa destination' },
};
const PHASE_ORDER: ShuntingPhase[] = ['arriving', 'uncoupling', 'pushing', 'loading', 'pulling', 'coupling', 'inspection', 'departing'];
export class ShuntingManager {
    operations: ShuntingOperation[];
    history: ShuntingHistoryEntry[];
    stats: ShuntingStats;
    constructor() {
        this.operations = []; // active shunting operations
        this.history = []; // completed operations (last 50)
        this.stats = {
            totalOperations: 0,
            totalWagonsHandled: 0,
            totalTonnageHandled: 0,
            averageDuration: 0,
            totalDuration: 0,
        };
    }
    startOperation(serviceId: unknown, stationId: unknown, depotId: unknown, cargoType: unknown, tonnage: unknown, wagons: unknown, options: unknown) {
        const normalizedServiceId = String(serviceId ?? '');
        const normalizedStationId = String(stationId ?? '');
        const normalizedDepotId = String(depotId ?? '');
        if (!normalizedServiceId || !normalizedStationId)
            return null;
        const existing = this.getOperationForService(normalizedServiceId);
        if (existing)
            return existing;
        const t = Number(tonnage), w = Number(wagons);
        const normalizedTonnage = Number.isFinite(t) ? Math.max(0, t) : 0;
        const normalizedWagons = Number.isFinite(w) ? Math.max(1, Math.min(1000, Math.floor(w))) : 1;
        const op: ShuntingOperation = {
            id: `shunt-${nextOpId++}`,
            serviceId: normalizedServiceId,
            stationId: normalizedStationId,
            depotId: normalizedDepotId,
            cargoType: String(cargoType || 'general').slice(0, 120),
            tonnage: normalizedTonnage,
            wagons: normalizedWagons,
            phase: 'arriving',
            phaseIndex: 0,
            phaseElapsed: 0,
            totalElapsed: 0,
            startTime: Date.now(),
            completed: false,
            phaseDurations: this._calculatePhaseDurations(normalizedDepotId, normalizedTonnage, normalizedWagons, options),
        };
        this.operations.push(op);
        return op;
    }
    _calculatePhaseDurations(depotId: unknown, tonnage: number, wagons: number, options: unknown) {
        const opts: ShuntingOptions = isRecord(options) ? options : {};
        const lm = Number(opts.loadingSpeedMultiplier), sm = Number(opts.shuntingSpeedMultiplier);
        const loadingMult = Number.isFinite(lm) && lm > 0 ? Math.max(0.05, Math.min(20, lm)) : 1;
        const shuntingMult = Number.isFinite(sm) && sm > 0 ? Math.max(0.05, Math.min(20, sm)) : 1;
        tonnage = Number.isFinite(Number(tonnage)) ? Math.max(0, Number(tonnage)) : 0;
        wagons = Number.isFinite(Number(wagons)) ? Math.max(1, Math.min(1000, Math.floor(Number(wagons)))) : 1;
        const durations: Record<string, number> = {};
        for (const [phase, info] of Object.entries(SHUNTING_PHASES)) {
            let dur = info.duration;
            // Scale with number of wagons
            if (['uncoupling', 'coupling', 'inspection'].includes(phase)) {
                dur = Math.ceil(dur * (1 + (wagons - 1) * 0.3));
            }
            if (['pushing', 'pulling'].includes(phase)) {
                dur = Math.ceil(dur * shuntingMult * (1 + (wagons - 1) * 0.2));
            }
            if (phase === 'loading') {
                // Loading time scales with tonnage
                const baseMins = Math.max(10, Math.ceil(tonnage / 50));
                dur = Math.ceil(baseMins * loadingMult);
            }
            durations[phase] = dur;
        }
        return durations;
    }
    update(deltaMinutes: unknown) {
        const delta = Number(deltaMinutes);
        if (!Number.isFinite(delta) || delta <= 0)
            return [];
        for (const op of this.operations) {
            if (op.completed)
                continue;
            let available = Math.max(0, Number(op.phaseElapsed) || 0) + delta;
            let elapsed = Math.max(0, Number(op.totalElapsed) || 0) - Math.max(0, Number(op.phaseElapsed) || 0);
            let guard = 0;
            while (!op.completed && guard++ < PHASE_ORDER.length + 1) {
                const duration = Math.max(0.01, Number(op.phaseDurations?.[op.phase]) || 5);
                if (available < duration) {
                    op.phaseElapsed = available;
                    op.totalElapsed = Math.max(0, elapsed) + available;
                    break;
                }
                available -= duration;
                elapsed += duration;
                op.phaseElapsed = 0;
                op.totalElapsed = Math.max(0, elapsed);
                op.phaseIndex++;
                if (op.phaseIndex >= PHASE_ORDER.length) {
                    op.completed = true;
                    op.phase = 'completed';
                    this._completeOperation(op);
                } else op.phase = PHASE_ORDER[op.phaseIndex];
            }
        }
        // Clean completed operations
        const completed = this.operations.filter((o: { completed: unknown }) => o.completed);
        this.operations = this.operations.filter((o: { completed: unknown }) => !o.completed);
        return completed;
    }
    _completeOperation(op: ShuntingOperation) {
        this.stats.totalOperations++;
        this.stats.totalWagonsHandled += op.wagons;
        this.stats.totalTonnageHandled += op.tonnage;
        this.stats.totalDuration += op.totalElapsed;
        this.stats.averageDuration = Math.floor(this.stats.totalDuration / this.stats.totalOperations);
        this.history.unshift({
            id: op.id,
            serviceId: op.serviceId,
            cargoType: op.cargoType,
            tonnage: op.tonnage,
            wagons: op.wagons,
            duration: Math.floor(op.totalElapsed),
            completedAt: Date.now(),
        });
        if (this.history.length > 50)
            this.history.length = 50;
    }
    getActiveOperations() {
        return this.operations.filter((o: { completed: unknown }) => !o.completed);
    }
    getOperationForService(serviceId: unknown) {
        return this.operations.find((o: { serviceId: unknown; completed: unknown }) => o.serviceId === serviceId && !o.completed);
    }
    isServiceInShunting(serviceId: unknown) {
        return this.operations.some((o: { serviceId: unknown; completed: unknown }) => o.serviceId === serviceId && !o.completed);
    }
    getPhaseInfo(phase: string) {
        return SHUNTING_PHASES[phase as ShuntingPhase] || { name: phase, duration: 0, description: '' };
    }
    render(container: HTMLElement, game: unknown) {
        if (!container)
            return;
        const activeOps = this.getActiveOperations();
        container.innerHTML = `
      <div class="dash-section">
        <h3>Manœuvres de Triage</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Opérations en cours</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${activeOps.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Total réalisées</div>
            <div class="dash-kpi-value">${this.stats.totalOperations}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Wagons traités</div>
            <div class="dash-kpi-value">${this.stats.totalWagonsHandled.toLocaleString('fr-FR')}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Tonnage traité</div>
            <div class="dash-kpi-value">${this.stats.totalTonnageHandled.toLocaleString('fr-FR')} t</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Durée moyenne</div>
            <div class="dash-kpi-value">${this.stats.averageDuration} min</div>
          </div>
        </div>
      </div>

      ${activeOps.length > 0 ? `
      <div class="dash-section">
        <h3>Opérations en cours</h3>
        ${activeOps.map((op: ShuntingOperation) => {
            const phaseInfo = this.getPhaseInfo(op.phase);
            const totalDuration = Number(Object.values(op.phaseDurations).reduce((sum: number, duration: number) => sum + Number(duration || 0), 0));
            const progressPercent = Math.min(100, Math.floor((op.totalElapsed / totalDuration) * 100));
            const phaseProgress = Math.min(100, Math.floor((op.phaseElapsed / (op.phaseDurations[op.phase] || 1)) * 100));
            return `
            <div style="background:var(--bg2);padding:12px;border-radius:6px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <b style="font-size:12px">${op.cargoType} — ${op.tonnage}t (${op.wagons} wagons)</b>
                <span style="font-size:11px;color:var(--text3)">${Math.floor(op.totalElapsed)} min / ~${totalDuration} min</span>
              </div>

              <!-- Overall progress -->
              <div style="background:var(--bg3);border-radius:4px;height:8px;margin-bottom:8px">
                <div style="background:#3b82f6;height:100%;border-radius:4px;width:${htmlText(progressPercent)}%;transition:width 0.3s"></div>
              </div>

              <!-- Phase timeline -->
              <div style="display:flex;gap:2px;margin-bottom:6px">
                ${PHASE_ORDER.map((p, i) => {
                const isActive = i === op.phaseIndex;
                const isDone = i < op.phaseIndex;
                const bg = isDone ? '#22c55e' : isActive ? '#3b82f6' : 'var(--bg3)';
                const pInfo = SHUNTING_PHASES[p];
                const w = Math.max(8, Math.floor((op.phaseDurations[p] / totalDuration) * 100));
                return `<div title="${htmlText(pInfo.name)}" style="flex:${htmlText(w)};height:20px;background:${htmlText(bg)};border-radius:2px;display:flex;align-items:center;justify-content:center">
                    <span style="font-size:7px;color:${htmlText(isDone || isActive ? 'white' : 'var(--text3)')};white-space:nowrap;overflow:hidden">${htmlText(isActive ? pInfo.name : isDone ? '✓' : '')}</span>
                  </div>`;
            }).join('')}
              </div>

              <!-- Current phase detail -->
              <div style="font-size:11px;color:var(--text3)">
                <b style="color:var(--text)">${htmlText(phaseInfo.name)}</b> — ${htmlText(phaseInfo.description)}
                <span style="float:right">${Math.floor(op.phaseElapsed)}/${op.phaseDurations[op.phase]} min (${phaseProgress}%)</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>` : `
      <div class="dash-section">
        <h3>Aucune opération en cours</h3>
        <p style="color:var(--text3);font-size:11px">Les manœuvres démarrent automatiquement quand un train fret arrive en ITE avec un contrat actif.</p>
      </div>`}

      <div class="dash-section">
        <h3>Phases de manœuvre</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 1fr 0.5fr 1.5fr">
            <span>#</span><span>Phase</span><span>Durée base</span><span>Description</span>
          </div>
          ${PHASE_ORDER.map((p, i) => {
            const info = SHUNTING_PHASES[p];
            return `
              <div class="dash-train-row" style="grid-template-columns:0.3fr 1fr 0.5fr 1.5fr">
                <span>${i + 1}</span>
                <span>${htmlText(info.name)}</span>
                <span>${info.duration} min</span>
                <span style="font-size:10px;color:var(--text3)">${htmlText(info.description)}</span>
              </div>
            `;
        }).join('')}
        </div>
        <p style="font-size:10px;color:var(--text3);margin-top:6px">
          Les durées sont ajustées selon : nombre de wagons, tonnage, équipements ITE (grue ×0.8, faisceau de triage ×0.7).
        </p>
      </div>

      ${this.history.length > 0 ? `
      <div class="dash-section">
        <h3>Historique (${this.history.length} dernières)</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1fr 0.5fr 0.5fr 0.5fr">
            <span>Cargo</span><span>Tonnage</span><span>Wagons</span><span>Durée</span>
          </div>
          ${this.history.slice(0, 20).map((h: { cargoType: unknown; tonnage: unknown; wagons: unknown; duration: unknown }) => `
            <div class="dash-train-row" style="grid-template-columns:1fr 0.5fr 0.5fr 0.5fr">
              <span>${h.cargoType}</span>
              <span>${h.tonnage} t</span>
              <span>${h.wagons}</span>
              <span>${h.duration} min</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    `;
    }
    toSave() {
        return {
            operations: this.operations,
            history: this.history,
            stats: this.stats,
            _nextOpId: nextOpId,
        };
    }
    loadFromSave(s: unknown) {
        this.operations = [];
        this.history = [];
        this.stats = { totalOperations: 0, totalWagonsHandled: 0, totalTonnageHandled: 0, averageDuration: 0, totalDuration: 0 };
        if (!isRecord(s))
            return;
        const finite = (v: unknown, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;
        const seen = new Set();
        for (const raw of Array.isArray(s.operations) ? s.operations : []) {
            if (!isRecord(raw))
                continue;
            const id = String(raw.id ?? ''), serviceId = String(raw.serviceId ?? ''), stationId = String(raw.stationId ?? '');
            if (!id || seen.has(id) || !serviceId || !stationId || raw.completed === true)
                continue;
            seen.add(id);
            const savedPhase = String(raw.phase || '') as ShuntingPhase;
            let phaseIndex = Math.floor(finite(raw.phaseIndex, PHASE_ORDER.indexOf(savedPhase)));
            if (phaseIndex < 0 || phaseIndex >= PHASE_ORDER.length)
                phaseIndex = 0;
            const phase = PHASE_ORDER[phaseIndex] ?? 'arriving';
            const tonnage = Math.max(0, finite(raw.tonnage, 0));
            const wagons = Math.max(1, Math.min(1000, Math.floor(finite(raw.wagons, 1))));
            const base = this._calculatePhaseDurations(String(raw.depotId ?? ''), tonnage, wagons, {}), dur: Record<string, number> = {};
            for (const p of PHASE_ORDER) {
                const savedDurations = isRecord(raw.phaseDurations) ? raw.phaseDurations : {};
                const v = finite(savedDurations[p], base[p]);
                dur[p] = Math.max(0.01, Math.min(100000, v));
            }
            this.operations.push({ id, serviceId, stationId, depotId: String(raw.depotId ?? ''), cargoType: String(raw.cargoType || 'general').slice(0, 120), tonnage, wagons, phase, phaseIndex, phaseElapsed: Math.max(0, finite(raw.phaseElapsed, 0)), totalElapsed: Math.max(0, finite(raw.totalElapsed, 0)), startTime: Math.max(0, finite(raw.startTime, 0)), completed: false, phaseDurations: dur });
        }
        this.history = (Array.isArray(s.history) ? s.history : [])
            .filter((h: unknown): h is UnknownRecord => isRecord(h))
            .slice(0, 50)
            .map((h): ShuntingHistoryEntry => ({ id: String(h.id ?? ''), serviceId: String(h.serviceId ?? ''), cargoType: String(h.cargoType || 'general').slice(0, 120), tonnage: Math.max(0, finite(h.tonnage, 0)), wagons: Math.max(0, Math.floor(finite(h.wagons, 0))), duration: Math.max(0, finite(h.duration, 0)), completedAt: Math.max(0, finite(h.completedAt, 0)) }));
        const st = isRecord(s.stats) ? s.stats : {};
        this.stats.totalOperations = Math.max(0, Math.floor(finite(st.totalOperations, 0)));
        this.stats.totalWagonsHandled = Math.max(0, Math.floor(finite(st.totalWagonsHandled, 0)));
        this.stats.totalTonnageHandled = Math.max(0, finite(st.totalTonnageHandled, 0));
        this.stats.totalDuration = Math.max(0, finite(st.totalDuration, 0));
        this.stats.averageDuration = this.stats.totalOperations ? Math.floor(this.stats.totalDuration / this.stats.totalOperations) : 0;
        const nx = Math.floor(finite(s._nextOpId, 1));
        nextOpId = Math.max(1, nx);
        for (const id of [...this.operations, ...this.history].map((x: { id: unknown }) => x.id)) {
            const m = String(id).match(/^shunt-(\d+)$/);
            if (m)
                nextOpId = Math.max(nextOpId, Number(m[1]) + 1);
        }
    }
}

