/**
 * Connections — Passenger transfer/correspondence system.
 * Tracks transfers between services at shared stations.
 */
export class Connections {
  constructor() {
    this.transfers = [];          // active transfer configs
    this.waitPolicy = 'moderate'; // 'strict' (no wait), 'moderate' (wait 5min), 'flexible' (wait 15min)
    this.stats = {
      totalTransfers: 0,
      successfulTransfers: 0,
      missedTransfers: 0,
    };
    this._pendingTransfers = [];  // runtime: passengers waiting for connecting train
  }

  /**
   * Define a connection between two services at a station.
   */
  addTransfer(fromServiceId, toServiceId, stationId) {
    const existing = this.transfers.find(t =>
      t.fromServiceId === fromServiceId && t.toServiceId === toServiceId && t.stationId === stationId
    );
    if (existing) return existing;

    const transfer = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      fromServiceId,
      toServiceId,
      stationId,
      minTransferTime: 3,       // minutes minimum
      waitTime: this._getWaitTime(),
    };
    this.transfers.push(transfer);
    return transfer;
  }

  removeTransfer(id) {
    this.transfers = this.transfers.filter(t => t.id !== id);
  }

  _getWaitTime() {
    return { strict: 0, moderate: 5, flexible: 15 }[this.waitPolicy] || 5;
  }

  /**
   * Check if a connecting service should wait for an arriving service.
   * Called from schedule tick when a service is at a station.
   */
  shouldWait(serviceId, stationId, currentTime, services) {
    const relevantTransfers = this.transfers.filter(t =>
      t.toServiceId === serviceId && t.stationId === stationId
    );
    if (relevantTransfers.length === 0) return false;

    for (const transfer of relevantTransfers) {
      const fromSvc = services.find(s => s.id === transfer.fromServiceId);
      if (!fromSvc || fromSvc.completed) continue;

      // Check if the incoming service is close to arriving
      if (fromSvc.state === 'running') {
        const nextStop = fromSvc.stops[fromSvc.currentStopIndex];
        if (nextStop?.stationId === stationId) {
          // The connecting train is approaching this station
          const eta = fromSvc.delay ?? 0;
          if (eta <= transfer.waitTime) {
            return true; // Wait for it
          }
        }
      }
    }
    return false;
  }

  /**
   * Record a transfer event.
   */
  recordTransfer(fromServiceId, toServiceId, stationId, success) {
    this.stats.totalTransfers++;
    if (success) {
      this.stats.successfulTransfers++;
    } else {
      this.stats.missedTransfers++;
    }
  }

  /**
   * Auto-detect possible connections based on shared stations and compatible times.
   */
  autoDetect(services, world) {
    const stationServices = {};

    for (const svc of services) {
      for (const stop of svc.stops) {
        if (!stationServices[stop.stationId]) stationServices[stop.stationId] = [];
        stationServices[stop.stationId].push({
          serviceId: svc.id,
          serviceName: svc.name,
          time: stop.departureTime || stop.arrivalTime,
          type: stop.type,
        });
      }
    }

    const suggestions = [];
    for (const [stationId, svcs] of Object.entries(stationServices)) {
      if (svcs.length < 2) continue;

      for (let i = 0; i < svcs.length; i++) {
        for (let j = 0; j < svcs.length; j++) {
          if (i === j) continue;
          const arriving = svcs[i];
          const departing = svcs[j];

          // Check if times are compatible (arrive before depart, within 30 min)
          let diff = departing.time - arriving.time;
          if (diff < 0) diff += 1440;
          if (diff >= 3 && diff <= 30) {
            const exists = this.transfers.find(t =>
              t.fromServiceId === arriving.serviceId &&
              t.toServiceId === departing.serviceId &&
              t.stationId === stationId
            );
            if (!exists) {
              suggestions.push({
                fromServiceId: arriving.serviceId,
                fromName: arriving.serviceName,
                toServiceId: departing.serviceId,
                toName: departing.serviceName,
                stationId,
                transferTime: diff,
              });
            }
          }
        }
      }
    }
    return suggestions;
  }

  render(container, game) {
    if (!container) return;

    const services = game.scheduleCreator?.services || [];
    const stations = game.world?.stations || [];
    const successRate = this.stats.totalTransfers > 0
      ? Math.round(this.stats.successfulTransfers / this.stats.totalTransfers * 100)
      : 100;

    container.innerHTML = `
      <div class="dash-section">
        <h3>Correspondances Voyageurs</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances actives</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${this.transfers.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Taux de réussite</div>
            <div class="dash-kpi-value" style="color:${successRate >= 80 ? 'var(--green)' : '#ef4444'}">${successRate}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances réussies</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.stats.successfulTransfers}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances ratées</div>
            <div class="dash-kpi-value" style="color:#ef4444">${this.stats.missedTransfers}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Politique d'attente</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="conn-policy btn-primary" data-policy="strict" style="font-size:11px;padding:8px 14px;background:${this.waitPolicy === 'strict' ? '#ef4444' : '#374151'}">
            Stricte (0 min)
          </button>
          <button class="conn-policy btn-primary" data-policy="moderate" style="font-size:11px;padding:8px 14px;background:${this.waitPolicy === 'moderate' ? '#3b82f6' : '#374151'}">
            Modérée (5 min)
          </button>
          <button class="conn-policy btn-primary" data-policy="flexible" style="font-size:11px;padding:8px 14px;background:${this.waitPolicy === 'flexible' ? 'var(--green)' : '#374151'}">
            Flexible (15 min)
          </button>
        </div>
      </div>

      <div class="dash-section">
        <h3>Correspondances configurées</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1.2fr 1.2fr 1fr 0.6fr">
            <span>De</span><span>Vers</span><span>Gare</span><span>Action</span>
          </div>
          ${this.transfers.length === 0 ? '<div style="padding:8px;color:var(--text3)">Aucune correspondance configurée</div>' :
            this.transfers.map(t => {
              const fromSvc = services.find(s => s.id === t.fromServiceId);
              const toSvc = services.find(s => s.id === t.toServiceId);
              const station = stations.find(s => s.id === t.stationId);
              return `<div class="dash-train-row" style="grid-template-columns:1.2fr 1.2fr 1fr 0.6fr">
                <span>${fromSvc?.name || t.fromServiceId}</span>
                <span>${toSvc?.name || t.toServiceId}</span>
                <span>${station?.name || t.stationId}</span>
                <span><button class="conn-remove btn-sm" data-id="${t.id}" style="background:#ef4444">×</button></span>
              </div>`;
            }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Ajouter une correspondance</h3>
        ${services.length < 2 ? '<p style="color:var(--text3);font-size:11px">Créez au moins 2 services pour configurer des correspondances.</p>' : `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label style="font-size:10px;color:var(--text3)">Service arrivant</label>
            <select id="conn-from" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3)">Service partant</label>
            <select id="conn-to" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3)">Gare</label>
            <select id="conn-station" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <button id="conn-add-btn" class="btn-primary" style="font-size:11px;padding:6px 12px">+ Ajouter</button>
        </div>`}
      </div>
    `;

    // Event handlers
    container.querySelectorAll('.conn-policy').forEach(btn => {
      btn.addEventListener('click', () => {
        this.waitPolicy = btn.dataset.policy;
        this.transfers.forEach(t => t.waitTime = this._getWaitTime());
        this.render(container, game);
      });
    });

    container.querySelectorAll('.conn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeTransfer(btn.dataset.id);
        this.render(container, game);
      });
    });

    const addBtn = container.querySelector('#conn-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const from = container.querySelector('#conn-from')?.value;
        const to = container.querySelector('#conn-to')?.value;
        const station = container.querySelector('#conn-station')?.value;
        if (from && to && station && from !== to) {
          this.addTransfer(from, to, station);
          this.render(container, game);
        }
      });
    }
  }

  toSave() {
    return {
      transfers: this.transfers,
      waitPolicy: this.waitPolicy,
      stats: this.stats,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.transfers = s.transfers || [];
    this.waitPolicy = s.waitPolicy || 'moderate';
    this.stats = s.stats || { totalTransfers: 0, successfulTransfers: 0, missedTransfers: 0 };
  }
}
