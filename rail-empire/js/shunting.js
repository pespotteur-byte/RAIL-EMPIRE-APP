/**
 * Shunting — Realistic shunting/triage operations for freight trains.
 * Simulates: arrival → uncoupling → pushing to loading track → loading → coupling → departure.
 */

let nextOpId = 1;

const SHUNTING_PHASES = {
  arriving: { name: 'Arrivée en ITE', duration: 5, description: 'Le train arrive sur les voies de l\'ITE' },
  uncoupling: { name: 'Découplage', duration: 8, description: 'Découplage des wagons du locotracteur' },
  pushing: { name: 'Poussage', duration: 10, description: 'Les wagons sont poussés sur la voie de chargement' },
  loading: { name: 'Chargement', duration: 15, description: 'Chargement/déchargement des marchandises' },
  pulling: { name: 'Tirage', duration: 8, description: 'Les wagons sont tirés hors de la voie de chargement' },
  coupling: { name: 'Recouplage', duration: 6, description: 'Recouplage des wagons au train' },
  inspection: { name: 'Inspection', duration: 5, description: 'Vérification freins et attelages' },
  departing: { name: 'Départ', duration: 3, description: 'Le train repart vers sa destination' },
};

const PHASE_ORDER = ['arriving', 'uncoupling', 'pushing', 'loading', 'pulling', 'coupling', 'inspection', 'departing'];

export class ShuntingManager {
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

  startOperation(serviceId, stationId, depotId, cargoType, tonnage, wagons, options) {
    const op = {
      id: `shunt-${nextOpId++}`,
      serviceId,
      stationId,
      depotId,
      cargoType: cargoType || 'general',
      tonnage: tonnage || 0,
      wagons: wagons || 1,
      phase: 'arriving',
      phaseIndex: 0,
      phaseElapsed: 0,
      totalElapsed: 0,
      startTime: Date.now(),
      completed: false,
      phaseDurations: this._calculatePhaseDurations(depotId, tonnage, wagons, options),
    };

    this.operations.push(op);
    return op;
  }

  _calculatePhaseDurations(depotId, tonnage, wagons, options) {
    const loadingMult = options?.loadingSpeedMultiplier || 1;
    const shuntingMult = options?.shuntingSpeedMultiplier || 1;

    const durations = {};
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

  update(deltaMinutes) {
    for (const op of this.operations) {
      if (op.completed) continue;

      op.phaseElapsed += deltaMinutes;
      op.totalElapsed += deltaMinutes;

      const currentPhaseDuration = op.phaseDurations[op.phase] || 5;

      if (op.phaseElapsed >= currentPhaseDuration) {
        op.phaseElapsed = 0;
        op.phaseIndex++;

        if (op.phaseIndex >= PHASE_ORDER.length) {
          op.completed = true;
          op.phase = 'completed';
          this._completeOperation(op);
        } else {
          op.phase = PHASE_ORDER[op.phaseIndex];
        }
      }
    }

    // Clean completed operations
    const completed = this.operations.filter(o => o.completed);
    this.operations = this.operations.filter(o => !o.completed);

    return completed;
  }

  _completeOperation(op) {
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
    if (this.history.length > 50) this.history.length = 50;
  }

  getActiveOperations() {
    return this.operations.filter(o => !o.completed);
  }

  getOperationForService(serviceId) {
    return this.operations.find(o => o.serviceId === serviceId && !o.completed);
  }

  isServiceInShunting(serviceId) {
    return this.operations.some(o => o.serviceId === serviceId && !o.completed);
  }

  getPhaseInfo(phase) {
    return SHUNTING_PHASES[phase] || { name: phase, duration: 0, description: '' };
  }

  render(container, game) {
    if (!container) return;

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
        ${activeOps.map(op => {
          const phaseInfo = this.getPhaseInfo(op.phase);
          const totalDuration = Object.values(op.phaseDurations).reduce((s, d) => s + d, 0);
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
                <div style="background:#3b82f6;height:100%;border-radius:4px;width:${progressPercent}%;transition:width 0.3s"></div>
              </div>

              <!-- Phase timeline -->
              <div style="display:flex;gap:2px;margin-bottom:6px">
                ${PHASE_ORDER.map((p, i) => {
                  const isActive = i === op.phaseIndex;
                  const isDone = i < op.phaseIndex;
                  const bg = isDone ? '#22c55e' : isActive ? '#3b82f6' : 'var(--bg3)';
                  const pInfo = SHUNTING_PHASES[p];
                  const w = Math.max(8, Math.floor((op.phaseDurations[p] / totalDuration) * 100));
                  return `<div title="${pInfo.name}" style="flex:${w};height:20px;background:${bg};border-radius:2px;display:flex;align-items:center;justify-content:center">
                    <span style="font-size:7px;color:${isDone || isActive ? 'white' : 'var(--text3)'};white-space:nowrap;overflow:hidden">${isActive ? pInfo.name : isDone ? '✓' : ''}</span>
                  </div>`;
                }).join('')}
              </div>

              <!-- Current phase detail -->
              <div style="font-size:11px;color:var(--text3)">
                <b style="color:var(--text)">${phaseInfo.name}</b> — ${phaseInfo.description}
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
                <span>${info.name}</span>
                <span>${info.duration} min</span>
                <span style="font-size:10px;color:var(--text3)">${info.description}</span>
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
          ${this.history.slice(0, 20).map(h => `
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

  loadFromSave(s) {
    if (!s) return;
    this.operations = s.operations || [];
    this.history = s.history || [];
    this.stats = s.stats || { totalOperations: 0, totalWagonsHandled: 0, totalTonnageHandled: 0, averageDuration: 0, totalDuration: 0 };
    if (s._nextOpId) nextOpId = s._nextOpId;
  }
}
