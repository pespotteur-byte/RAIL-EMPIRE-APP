import { htmlText } from './html-text.js';
type JunctionType = 'simple' | 'double' | 'crossing';
type JunctionState = 'normal' | 'reversed' | 'locked';
type Junction = {
    id: string;
    stationId: string;
    name: string;
    type: JunctionType;
    state: JunctionState;
    lastSwitched: number;
};
type Siding = {
    id: string;
    stationId: string;
    name: string;
    capacity: number;
    occupants: string[];
};
type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
import type { World } from './world.js';
import type { RameManager } from './rame.js';
import type { RailEmpire } from './main.js';

/**
 * Junctions — Switch/junction management for railway operations.
 * Manages turnouts, sidings, and junction routing in stations.
 */
import { icon } from './icons.js';
export class JunctionManager {
    junctions: Junction[];
    sidings: Siding[];
    constructor() {
        this.junctions = []; // { id, stationId, name, type, tracks, state }
        this.sidings = []; // { id, stationId, name, capacity, occupants }
    }
    /**
     * Add a junction/switch at a station.
     */
    addJunction(stationId: unknown, name: unknown = undefined, type: unknown = undefined) {
        const normalizedStationId = String(stationId ?? '');
        if (!normalizedStationId)
            return null;
        const normalizedType: JunctionType = ['simple', 'double', 'crossing'].includes(String(type)) ? String(type) as JunctionType : 'simple';
        const junction: Junction = {
            id: `jct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stationId: normalizedStationId,
            name: String(name || `Aiguillage ${this.junctions.length + 1}`),
            type: normalizedType, // simple, double, crossing
            state: 'normal', // normal, reversed, locked
            lastSwitched: 0,
        };
        this.junctions.push(junction);
        return junction;
    }
    removeJunction(id: unknown) {
        this.junctions = this.junctions.filter((j: { id: unknown }) => j.id !== id);
    }
    /**
     * Add a siding/garage track at a station.
     */
    addSiding(stationId: unknown, name: unknown = undefined, capacity: unknown = undefined) {
        const normalizedStationId = String(stationId ?? '');
        if (!normalizedStationId)
            return null;
        const cap = Number(capacity);
        const siding: Siding = {
            id: `sid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stationId: normalizedStationId,
            name: String(name || `Voie de garage ${this.sidings.length + 1}`),
            capacity: Number.isFinite(cap) ? Math.max(1, Math.min(100, Math.floor(cap))) : 2,
            occupants: [], // rameIds currently parked
        };
        this.sidings.push(siding);
        return siding;
    }
    removeSiding(id: unknown) {
        this.sidings = this.sidings.filter((s: { id: unknown }) => s.id !== id);
    }
    /**
     * Park a rame in a siding.
     */
    parkRame(sidingId: unknown, rameId: unknown) {
        const normalizedSidingId = String(sidingId ?? '');
        const normalizedRameId = String(rameId ?? '');
        if (!normalizedSidingId || !normalizedRameId)
            return false;
        const siding = this.sidings.find((s) => s.id === normalizedSidingId);
        if (!siding)
            return false;
        if (siding.occupants.length >= siding.capacity)
            return false;
        if (siding.occupants.includes(normalizedRameId))
            return false;
        siding.occupants.push(normalizedRameId);
        return true;
    }
    /**
     * Remove a rame from a siding.
     */
    unparkRame(sidingId: unknown, rameId: unknown) {
        const normalizedSidingId = String(sidingId ?? '');
        const normalizedRameId = String(rameId ?? '');
        const siding = this.sidings.find((s) => s.id === normalizedSidingId);
        if (!siding)
            return false;
        siding.occupants = siding.occupants.filter((r) => r !== normalizedRameId);
        return true;
    }
    /**
     * Switch a junction state.
     */
    switchJunction(junctionId: unknown, newState: unknown) {
        junctionId = String(junctionId ?? '');
        const state = String(newState);
        if (!['normal', 'reversed', 'locked'].includes(state))
            return false;
        const junction = this.junctions.find((j: { id: unknown }) => j.id === junctionId);
        if (!junction)
            return false;
        junction.state = state as JunctionState;
        junction.lastSwitched = Date.now();
        return true;
    }
    /**
     * Get all junctions for a station.
     */
    getStationJunctions(stationId: unknown) {
        return this.junctions.filter((j: { stationId: unknown }) => j.stationId === stationId);
    }
    /**
     * Get all sidings for a station.
     */
    getStationSidings(stationId: unknown) {
        return this.sidings.filter((s: { stationId: unknown }) => s.stationId === stationId);
    }
    render(container: HTMLElement, game: RailEmpire) {
        if (!container)
            return;
        const stations = game.world?.stations || [];
        const rames = game.rameManager?.getAll?.() || [];
        const totalJunctions = this.junctions.length;
        const totalSidings = this.sidings.length;
        const totalParked = this.sidings.reduce((sum: number, sid: Siding) => sum + sid.occupants.length, 0);
        const totalCapacity = this.sidings.reduce((sum: number, sid: Siding) => sum + sid.capacity, 0);
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
          ${stations.map((s: { id: unknown; name: unknown }) => {
            const jctCount = this.getStationJunctions(s.id).length;
            const sidCount = this.getStationSidings(s.id).length;
            return `<option value="${htmlText(s.id)}">${htmlText(s.name)} (${jctCount} aig. / ${sidCount} v.g.)</option>`;
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
                }
                else if (detail) {
                    detail.innerHTML = '';
                }
            });
        }
    }
    _renderStationDetail(container: HTMLElement, stationId: unknown, game: RailEmpire) {
        const station = game.world?.stations.find((s: { id: unknown }) => s.id === stationId);
        if (!station)
            return;
        const junctions = this.getStationJunctions(stationId);
        const sidings = this.getStationSidings(stationId);
        const rames = game.rameManager?.getAll?.() || [];
        container.innerHTML = `
      <div style="background:var(--bg2);padding:12px;border-radius:6px">
        <h3 style="margin-bottom:12px">${htmlText(station.name)}</h3>

        <h4 style="font-size:12px;margin-bottom:6px">Aiguillages</h4>
        <div class="dash-train-table" style="margin-bottom:12px">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
            <span>Nom</span><span>Type</span><span>État</span><span>Actions</span>
          </div>
          ${junctions.length === 0 ? '<div style="padding:8px;color:var(--text3);font-size:11px">Aucun aiguillage</div>' :
            junctions.map((j: { name: unknown; type: unknown; state: unknown; id: unknown }) => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
                <span>${htmlText(j.name)}</span>
                <span>${j.type === 'simple' ? 'Simple' : j.type === 'double' ? 'Double' : 'Croisement'}</span>
                <span style="color:${htmlText(j.state === 'normal' ? 'var(--green)' : j.state === 'reversed' ? '#f97316' : '#ef4444')}">
                  ${j.state === 'normal' ? '↑ Normal' : j.state === 'reversed' ? '↗ Dévié' : `${icon('lock', 12)} Verrouillé`}
                </span>
                <span>
                  <button class="jct-switch btn-sm" data-id="${htmlText(j.id)}" data-state="${htmlText(j.state === 'normal' ? 'reversed' : 'normal')}" style="background:#3b82f6">⇄</button>
                  <button class="jct-remove btn-sm" data-id="${htmlText(j.id)}" style="background:#ef4444">×</button>
                </span>
              </div>
            `).join('')}
        </div>
        <button class="jct-add-junction btn-primary" data-station="${htmlText(stationId)}" style="font-size:11px;padding:6px 12px;margin-bottom:16px">+ Aiguillage (5 000 €)</button>

        <h4 style="font-size:12px;margin-bottom:6px">Voies de garage</h4>
        <div class="dash-train-table" style="margin-bottom:12px">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
            <span>Nom</span><span>Capacité</span><span>Occupants</span><span>Actions</span>
          </div>
          ${sidings.length === 0 ? '<div style="padding:8px;color:var(--text3);font-size:11px">Aucune voie de garage</div>' :
            sidings.map((s: Siding) => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 1fr 1fr 0.8fr">
                <span>${htmlText(s.name)}</span>
                <span>${s.occupants.length} / ${s.capacity}</span>
                <span style="font-size:10px">${htmlText(s.occupants.map((rId: unknown) => {
                const r = rames.find((rm: { id: unknown }) => rm.id === rId);
                return r ? r.name : rId;
            }).join(', ') || '-')}</span>
                <span>
                  <button class="jct-remove-siding btn-sm" data-id="${htmlText(s.id)}" style="background:#ef4444">×</button>
                </span>
              </div>
            `).join('')}
        </div>
        <button class="jct-add-siding btn-primary" data-station="${htmlText(stationId)}" style="font-size:11px;padding:6px 12px">+ Voie de garage (10 000 €)</button>
      </div>
    `;
        // Event handlers
        container.querySelectorAll('.jct-switch').forEach((btn: HTMLButtonElement) => {
            btn.addEventListener('click', () => {
                if (this.switchJunction(btn.dataset.id, btn.dataset.state))
                    game.saveState?.();
                this._renderStationDetail(container, stationId, game);
            });
        });
        container.querySelectorAll('.jct-remove').forEach((btn: HTMLButtonElement) => {
            btn.addEventListener('click', () => {
                this.removeJunction(btn.dataset.id);
                game.saveState?.();
                this._renderStationDetail(container, stationId, game);
            });
        });
        container.querySelectorAll('.jct-remove-siding').forEach((btn: HTMLButtonElement) => {
            btn.addEventListener('click', () => {
                this.removeSiding(btn.dataset.id);
                game.saveState?.();
                this._renderStationDetail(container, stationId, game);
            });
        });
        container.querySelector('.jct-add-junction')?.addEventListener('click', () => {
            if (game.economy.balance < 5000)
                return alert('Solde insuffisant (5 000 € requis)');
            game.economy.addExpense(5000, 'infrastructure', `Aiguillage — ${station.name}`);
            this.addJunction(stationId);
            game.saveState?.();
            this._renderStationDetail(container, stationId, game);
        });
        container.querySelector('.jct-add-siding')?.addEventListener('click', () => {
            if (game.economy.balance < 10000)
                return alert('Solde insuffisant (10 000 € requis)');
            game.economy.addExpense(10000, 'infrastructure', `Voie de garage — ${station.name}`);
            this.addSiding(stationId);
            game.saveState?.();
            this._renderStationDetail(container, stationId, game);
        });
    }
    toSave() {
        return {
            junctions: this.junctions,
            sidings: this.sidings,
        };
    }
    loadFromSave(s: unknown, world: World | null = null, rameManager: RameManager | null = null) {
        this.junctions = [];
        this.sidings = [];
        if (!isRecord(s))
            return;
        const stationIds = world?.stations ? new Set(world.stations.map((st: { id: unknown }) => String(st?.id ?? '')).filter(Boolean)) : null;
        const rameIds = rameManager?.getAll?.() ? new Set(rameManager.getAll().map((r: { id: unknown }) => String(r?.id ?? '')).filter(Boolean)) : null;
        const seenJ = new Set();
        for (const raw of Array.isArray(s.junctions) ? s.junctions : []) {
            if (!isRecord(raw))
                continue;
            const id = String(raw.id ?? ''), stationId = String(raw.stationId ?? '');
            if (!id || seenJ.has(id) || !stationId || (stationIds && !stationIds.has(stationId)))
                continue;
            seenJ.add(id);
            const last = Number(raw.lastSwitched);
            const type: JunctionType = ['simple', 'double', 'crossing'].includes(String(raw.type)) ? String(raw.type) as JunctionType : 'simple';
            const state: JunctionState = ['normal', 'reversed', 'locked'].includes(String(raw.state)) ? String(raw.state) as JunctionState : 'normal';
            this.junctions.push({ id, stationId, name: String(raw.name || 'Aiguillage').slice(0, 120), type, state, lastSwitched: Number.isFinite(last) && last >= 0 ? last : 0 });
        }
        const seenS = new Set();
        for (const raw of Array.isArray(s.sidings) ? s.sidings : []) {
            if (!isRecord(raw))
                continue;
            const id = String(raw.id ?? ''), stationId = String(raw.stationId ?? '');
            if (!id || seenS.has(id) || !stationId || (stationIds && !stationIds.has(stationId)))
                continue;
            seenS.add(id);
            const cap = Number(raw.capacity);
            const capacity = Number.isFinite(cap) ? Math.max(1, Math.min(100, Math.floor(cap))) : 2;
            const occ = [];
            const seenOcc = new Set();
            for (const rid of Array.isArray(raw.occupants) ? raw.occupants : []) {
                const r = String(rid ?? '');
                if (!r || seenOcc.has(r) || (rameIds && !rameIds.has(r)) || occ.length >= capacity)
                    continue;
                seenOcc.add(r);
                occ.push(r);
            }
            this.sidings.push({ id, stationId, name: String(raw.name || 'Voie de garage').slice(0, 120), capacity, occupants: occ });
        }
    }
}
