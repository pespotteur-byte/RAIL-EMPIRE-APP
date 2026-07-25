/**
 * Junctions — Switch/junction management for railway operations.
 * Manages turnouts, sidings, and junction routing in stations.
 */
import { icon } from './icons.js';
import { alertToast } from './html-utils.js?v=1785016545';
export class JunctionManager {
  constructor() {
    this.junctions = [];     // { id, stationId, name, type, tracks, state }
    this.sidings = [];       // { id, stationId, name, capacity, occupants }
  }

  /**
   * Add a junction/switch at a station.
   */
  addJunction(stationId, name, type) {
    const junction = {
      id: `jct-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      stationId,
      name: name || `Aiguillage ${this.junctions.length + 1}`,
      type: type || 'simple',  // simple, double, crossing
      state: 'normal',         // normal, reversed, locked
      lastSwitched: 0,
    };
    this.junctions.push(junction);
    return junction;
  }

  removeJunction(id) {
    this.junctions = this.junctions.filter(j => j.id !== id);
  }

  /**
   * Add a siding/garage track at a station.
   */
  addSiding(stationId, name, capacity) {
    const siding = {
      id: `sid-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      stationId,
      name: name || `Voie de garage ${this.sidings.length + 1}`,
      capacity: capacity || 2,
      occupants: [],  // rameIds currently parked
    };
    this.sidings.push(siding);
    return siding;
  }

  removeSiding(id) {
    this.sidings = this.sidings.filter(s => s.id !== id);
  }

  /**
   * Park a rame in a siding.
   */
  parkRame(sidingId, rameId) {
    const siding = this.sidings.find(s => s.id === sidingId);
    if (!siding) return false;
    if (siding.occupants.length >= siding.capacity) return false;
    if (siding.occupants.includes(rameId)) return false;
    siding.occupants.push(rameId);
    return true;
  }

  /**
   * Remove a rame from a siding.
   */
  unparkRame(sidingId, rameId) {
    const siding = this.sidings.find(s => s.id === sidingId);
    if (!siding) return false;
    siding.occupants = siding.occupants.filter(r => r !== rameId);
    return true;
  }

  /**
   * Switch a junction state.
   */
  switchJunction(junctionId, newState) {
    const junction = this.junctions.find(j => j.id === junctionId);
    if (!junction) return false;
    junction.state = newState;
    junction.lastSwitched = Date.now();
    return true;
  }

  /**
   * Get all junctions for a station.
   */
  getStationJunctions(stationId) {
    return this.junctions.filter(j => j.stationId === stationId);
  }

  /**
   * Get all sidings for a station.
   */
  getStationSidings(stationId) {
    return this.sidings.filter(s => s.stationId === stationId);
  }

  render(container, game) {
    if (!container) return;
    const stations = game.world?.stations || [];
    const rames = game.rameManager?.getAll?.() || [];

    const totalJunctions = this.junctions.length;
    const totalSidings = this.sidings.length;
    const totalParked = this.sidings.reduce((s, sid) => s + sid.occupants.length, 0);
    const totalCapacity = this.sidings.reduce((s, sid) => s + sid.capacity, 0);

    container.innerHTML = `
      <div class="dash-section">
        <h3>Aiguillages & Bifurcations</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Aiguillages</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${totalJunctions}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Voies de garage</div>
            <div class="dash-kpi-value" style="color:#f97316">${totalSidings}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Rames garées</div>
            <div class="dash-kpi-value">${totalParked} / ${totalCapacity}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Gestion par gare</h3>
        ${stations.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucune gare créée</p>' : `
        <select id="jct-station-select" style="width:100%;max-width:300px;padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <option value="">Choisir une gare...</option>
          ${stations.map(s => {
            const jctCount = this.getStationJunctions(s.id).length;
            const sidCount = this.getStationSidings(s.id).length;
            return `<option value="${s.id}">${s.name} (${jctCount} aig. / ${sidCount} v.g.)</option>`;
          }).join('')}
        </select>
        <div id="jct-station-detail" style="margin-top:12px"></div>`}
      </div>
    `;

    const select = container.querySelector('#jct-station-select');
    if (select) {
      select.addEventListener('change', () => {
        const detail = container.querySelector('#jct-station-detail');
        if (select.value && detail) {
          this._renderStationDetail(detail, select.value, game);
        } else if (detail) {
          detail.innerHTML = '';
        }
      });
    }
  }

  _renderStationDetail(container, stationId, game) {
    const station = game.world?.stations.find(s => s.id === stationId);
    if (!station) return;

    const junctions = this.getStationJunctions(stationId);
    const sidings = this.getStationSidings(stationId);
    const rames = game.rameManager?.getAll?.() || [];

    container.innerHTML = `
      <div style="background:var(--bg2);padding:12px;border-radius:6px">
        <h3 style="margin-bottom:12px">${station.name}</h3>

        <h4 style="font-size:12px;margin-bottom:6px">Aiguillages</h4>
        <div class="dash-train-table" style="margin-bottom:12px">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
            <span>Nom</span><span>Type</span><span>État</span><span>Actions</span>
          </div>
          ${junctions.length === 0 ? '<div style="padding:8px;color:var(--text3);font-size:11px">Aucun aiguillage</div>' :
            junctions.map(j => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
                <span>${j.name}</span>
                <span>${j.type === 'simple' ? 'Simple' : j.type === 'double' ? 'Double' : 'Croisement'}</span>
                <span style="color:${j.state === 'normal' ? 'var(--green)' : j.state === 'reversed' ? '#f97316' : '#ef4444'}">
                  ${j.state === 'normal' ? '↑ Normal' : j.state === 'reversed' ? '↗ Dévié' : `${icon('lock', 12)} Verrouillé`}
                </span>
                <span>
                  <button class="jct-switch btn-sm" data-id="${j.id}" data-state="${j.state === 'normal' ? 'reversed' : 'normal'}" style="background:#3b82f6">⇄</button>
                  <button class="jct-remove btn-sm" data-id="${j.id}" style="background:#ef4444">×</button>
                </span>
              </div>
            `).join('')}
        </div>
        <button class="jct-add-junction btn-primary" data-station="${stationId}" style="font-size:11px;padding:6px 12px;margin-bottom:16px">+ Aiguillage (5 000 €)</button>

        <h4 style="font-size:12px;margin-bottom:6px">Voies de garage</h4>
        <div class="dash-train-table" style="margin-bottom:12px">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
            <span>Nom</span><span>Capacité</span><span>Occupants</span><span>Actions</span>
          </div>
          ${sidings.length === 0 ? '<div style="padding:8px;color:var(--text3);font-size:11px">Aucune voie de garage</div>' :
            sidings.map(s => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
                <span>${s.name}</span>
                <span>${s.occupants.length} / ${s.capacity}</span>
                <span style="font-size:10px">${s.occupants.map(rId => {
                  const r = rames.find(rm => rm.id === rId);
                  return r ? r.name : rId;
                }).join(', ') || '-'}</span>
                <span>
                  <button class="jct-remove-siding btn-sm" data-id="${s.id}" style="background:#ef4444">×</button>
                </span>
              </div>
            `).join('')}
        </div>
        <button class="jct-add-siding btn-primary" data-station="${stationId}" style="font-size:11px;padding:6px 12px">+ Voie de garage (10 000 €)</button>
      </div>
    `;

    // Event handlers
    container.querySelectorAll('.jct-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchJunction(btn.dataset.id, btn.dataset.state);
        this._renderStationDetail(container, stationId, game);
      });
    });

    container.querySelectorAll('.jct-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeJunction(btn.dataset.id);
        this._renderStationDetail(container, stationId, game);
      });
    });

    container.querySelectorAll('.jct-remove-siding').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeSiding(btn.dataset.id);
        this._renderStationDetail(container, stationId, game);
      });
    });

    container.querySelector('.jct-add-junction')?.addEventListener('click', () => {
      if (game.economy.balance < 5000) return alertToast('Solde insuffisant (5 000 € requis)');
      game.economy.addExpense(5000, 'infrastructure', `Aiguillage — ${station.name}`);
      this.addJunction(stationId);
      this._renderStationDetail(container, stationId, game);
    });

    container.querySelector('.jct-add-siding')?.addEventListener('click', () => {
      if (game.economy.balance < 10000) return alertToast('Solde insuffisant (10 000 € requis)');
      game.economy.addExpense(10000, 'infrastructure', `Voie de garage — ${station.name}`);
      this.addSiding(stationId);
      this._renderStationDetail(container, stationId, game);
    });
  }

  toSave() {
    return {
      junctions: this.junctions,
      sidings: this.sidings,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.junctions = s.junctions || [];
    this.sidings = s.sidings || [];
  }
}
