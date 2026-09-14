import { htmlText } from './html-text.js';
import type { World, Station } from './world.js';
import { Depot, type DepotManager } from './depot.js';
import type { PlatformManager } from './line.js';
const escapeUpgradeText = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] ?? c));
type StationModuleEffect = {
    platforms?: number;
    frequentation?: number;
    satisfaction?: number;
    garage?: number;
    freight?: boolean;
};
type StationModuleDefinition = {
    name: string;
    cost: number;
    icon: string;
    description: string;
    maxPerStation: number;
    effect: StationModuleEffect;
};
type InstalledStationModule = { type: string; builtAt: number };
type StationUpgradeData = { modules: InstalledStationModule[]; level: number; totalInvested: number };
type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
import type { Economy } from './economy.js';
import type { RailEmpire } from './main.js';
/**
 * StationUpgrades — Modular station upgrade system.
 * Additive: adds upgrade capabilities to existing stations.
 */
import { icon } from './icons.js';
export class StationUpgrades {
    upgrades: Record<string, StationUpgradeData>;
    availableModules: Record<string, StationModuleDefinition>;
    private world: World | null = null;
    private depots: DepotManager | null = null;
    private platforms: PlatformManager | null = null;
    constructor() {
        this.upgrades = Object.create(null); // stationId -> { modules: [...], level: N }
        this.availableModules = {
            platform: {
                name: 'Quai supplémentaire',
                cost: 15000,
                icon: 'station',
                description: '+1 quai, permet plus de trains simultanés',
                maxPerStation: 6,
                effect: { platforms: 1 },
            },
            parking: {
                name: 'Parking voyageurs',
                cost: 20000,
                icon: 'parking',
                description: '+5% de fréquentation',
                maxPerStation: 1,
                effect: { frequentation: 0.05 },
            },
            hall: {
                name: 'Hall voyageurs',
                cost: 50000,
                icon: 'hall',
                description: '+10% de fréquentation, +5% satisfaction',
                maxPerStation: 1,
                effect: { frequentation: 0.10, satisfaction: 0.05 },
            },
            display: {
                name: 'Écrans Infogare',
                cost: 8000,
                icon: 'screen',
                description: 'Information voyageurs en temps réel',
                maxPerStation: 1,
                effect: { satisfaction: 0.03 },
            },
            depot: {
                name: 'Voie de garage',
                cost: 25000,
                icon: 'wrench',
                description: '+1 place de garage au dépôt de gare (manœuvre non incluse)',
                maxPerStation: 3,
                effect: { garage: 1 },
            },
            freight: {
                name: 'Terminal fret',
                cost: 40000,
                icon: 'cargo',
                description: 'Permet le chargement/déchargement de fret',
                maxPerStation: 1,
                effect: { freight: true },
            },
            restaurant: {
                name: 'Restauration',
                cost: 12000,
                icon: 'restaurant',
                description: '+3% satisfaction voyageurs',
                maxPerStation: 1,
                effect: { satisfaction: 0.03 },
            },
            wifi: {
                name: 'WiFi gratuit',
                cost: 5000,
                icon: 'wifi',
                description: '+2% satisfaction voyageurs',
                maxPerStation: 1,
                effect: { satisfaction: 0.02 },
            },
        };
    }
    /** Runtime links are not serialised: reapply effects from paid modules only. */
    connectRuntime(world: World, depots: DepotManager, platforms: PlatformManager): void {
        this.world = world; this.depots = depots; this.platforms = platforms;
        platforms.capacityProvider = (id, base) => this.getPlatformCapacity(id, base);
        this.syncRuntime();
    }
    getPlatformCapacity(stationId: string, base: unknown = this.world?.getStationById(stationId)?.platforms): number {
        const n = Math.floor(Number(base));
        return (Number.isFinite(n) && n > 0 ? n : 2) + this.getExtraPlatforms(stationId);
    }
    getGarageCapacity(stationId: string): number {
        return this.upgrades[stationId]?.modules.filter(m => m.type === 'depot').length ?? 0;
    }
    /** null = no runtime context (legacy embedders); false = a known unsuitable station. */
    canHandleFreight(stationId: string): boolean | null {
        if (!this.world) return null;
        const station = this.world.getStationById(stationId);
        if (!station || station.closed) return false;
        return /fret|freight|mixte|ite|industry|goods/.test(String(station.type).toLowerCase()) ||
            !!this.upgrades[stationId]?.modules.some(m => m.type === 'freight') ||
            !!this.depots?.getITEs().some(d => d.stationId === stationId);
    }
    syncRuntime(): void {
        if (!this.world) return;
        for (const stationId of new Set([...Object.keys(this.upgrades), ...(this.platforms?.stationPlatforms.keys() ?? [])])) {
            const station = this.world.getStationById(stationId);
            if (!station) continue;
            this.platforms?.initStation(stationId, station.platforms);
            const count = this.getGarageCapacity(stationId);
            if (!count || !this.depots) continue;
            let depot = this.depots.depots.find(d => d.stationUpgradeSource === stationId);
            if (!depot) {
                const baseId = `station-garage:${encodeURIComponent(stationId)}`;
                let id = baseId, suffix = 1;
                while (this.depots.getDepotById(id)) id = `${baseId}:${suffix++}`;
                depot = new Depot({id, type:'depot', name:`Garage — ${station.name}`, stationId,
                    tracks:count, stationUpgradeSource:stationId, stationUpgradeTracks:count,
                    cost:0, built:true, placementOnly:true, location:{lat:station.lat,lon:station.lon}});
                this.depots.depots.push(depot);
            } else if (count > depot.stationUpgradeTracks) {
                // Preserve occupied slots and separately purchased extensions; never erase a train on reload.
                const growth = count - depot.stationUpgradeTracks;
                for (let i = 0; i < growth; i++) depot.trackOccupancy.push({track:depot.tracks + i + 1,rameId:'',purpose:'garage',operationId:''});
                depot.tracks += growth; depot.stationUpgradeTracks = count;
            }
        }
    }
    /**
     * Get upgrade data for a station, creating default if needed.
     */
    getStation(stationId:string) {
        stationId = String(stationId ?? '');
        if (!stationId)
            return { modules: [], level: 1, totalInvested: 0 };
        if (!Object.prototype.hasOwnProperty.call(this.upgrades, stationId)) {
            this.upgrades[stationId] = { modules: [], level: 1, totalInvested: 0 };
        }
        return this.upgrades[stationId];
    }
    /**
     * Buy a module for a station.
     */
    buyModule(stationId:string, moduleType: string | undefined, economy: Economy) {
        stationId = String(stationId ?? '');
        moduleType = String(moduleType ?? '');
        const mod = Object.prototype.hasOwnProperty.call(this.availableModules, moduleType) ? this.availableModules[moduleType] : undefined;
        if ((this.world && !this.world.getStationById(stationId)) || !stationId || !mod || !economy || !Number.isFinite(Number(economy.balance)))
            return false;
        const data = this.getStation(stationId);
        const count = data.modules.filter((m: { type: unknown }) => m.type === moduleType).length;
        if (count >= mod.maxPerStation)
            return false;
        if (economy.balance < mod.cost)
            return false;
        economy.addExpense(mod.cost, 'infrastructure', `${mod.name} — gare`);
        data.modules.push({
            type: moduleType,
            builtAt: Date.now(),
        });
        data.totalInvested += mod.cost;
        data.level = Math.floor(data.totalInvested / 50000) + 1;
        this.syncRuntime();
        return true;
    }
    /**
     * Get total extra platforms from upgrades.
     */
    getExtraPlatforms(stationId:string) {
        const data = this.upgrades[stationId];
        if (!data)
            return 0;
        return data.modules.filter((m: { type: unknown }) => m.type === 'platform').length;
    }
    /**
     * Get frequentation bonus.
     */
    getFrequentationBonus(stationId:string) {
        const data = this.upgrades[stationId];
        if (!data)
            return 0;
        let bonus = 0;
        for (const mod of data.modules) {
            const eff = this.availableModules[mod.type]?.effect;
            if (eff?.frequentation)
                bonus += eff.frequentation;
        }
        return bonus;
    }
    /**
     * Get satisfaction bonus.
     */
    getSatisfactionBonus(stationId:string) {
        const data = this.upgrades[stationId];
        if (!data)
            return 0;
        let bonus = 0;
        for (const mod of data.modules) {
            const eff = this.availableModules[mod.type]?.effect;
            if (eff?.satisfaction)
                bonus += eff.satisfaction;
        }
        return bonus;
    }
    /**
     * Render station upgrades panel.
     */
    render(container: HTMLElement, game: RailEmpire) {
        if (!container)
            return;
        const stations = game.world?.stations || [];
        const totalInvested = Object.values(this.upgrades).reduce((sum, u) => sum + Number(u.totalInvested || 0), 0);
        const totalModules = Object.values(this.upgrades).reduce((sum, u) => sum + u.modules.length, 0);
        container.innerHTML = `
      <div class="dash-section">
        <h3>Gares Modulaires</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Gares améliorées</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${Object.keys(this.upgrades).filter((k) => this.upgrades[k].modules.length > 0).length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Modules installés</div>
            <div class="dash-kpi-value">${totalModules}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Investissement total</div>
            <div class="dash-kpi-value" style="color:#f97316">${totalInvested.toLocaleString('fr-FR')} €</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde</div>
            <div class="dash-kpi-value" style="color:var(--green)">${game.economy.formatAmount(game.economy.balance)}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Sélectionner une gare</h3>
        ${stations.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucune gare créée</p>' : `
        <select id="upgrade-station-select" style="width:100%;max-width:300px;padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <option value="">Choisir une gare...</option>
          ${stations.map((s: Station) => {
            const data = this.upgrades[s.id];
            const level = data ? data.level : 1;
            return `<option value="${escapeUpgradeText(s.id)}">${escapeUpgradeText(s.name)} (Niv. ${level})</option>`;
        }).join('')}
        </select>
        <div id="upgrade-station-detail" style="margin-top:12px"></div>`}
      </div>
    `;
        // Station select handler
        const select = container.querySelector('#upgrade-station-select');
        if (select) {
            select.addEventListener('change', () => {
                const stationId = select.value;
                const detail = container.querySelector('#upgrade-station-detail');
                if (stationId && detail) {
                    this._renderStationDetail(detail, stationId, game);
                }
                else if (detail) {
                    detail.innerHTML = '';
                }
            });
        }
    }
    _renderStationDetail(container: HTMLElement, stationId:string, game: RailEmpire) {
        const station = game.world?.stations.find((s: { id: unknown }) => s.id === stationId);
        if (!station)
            return;
        const data = this.getStation(stationId);
        container.innerHTML = `
      <div class="dash-section" style="background:var(--bg2);padding:12px;border-radius:6px">
        <h3 style="margin-bottom:8px">${escapeUpgradeText(station.name)} — Niveau ${data.level}</h3>
        <p style="font-size:11px;color:var(--text3);margin-bottom:8px">
          ${this.getPlatformCapacity(stationId, station.platforms)} quais •
          Investissement: ${data.totalInvested.toLocaleString('fr-FR')} €<br>
          Fréquentation +${Math.round(this.getFrequentationBonus(stationId) * 100)} % ·
          Satisfaction +${Math.round(this.getSatisfactionBonus(stationId) * 100)} points ·
          Garage ${this.getGarageCapacity(stationId)} place(s) ·
          Fret ${this.canHandleFreight(stationId) === false ? 'non équipé' : 'autorisé'}
        </p>

        <h4 style="font-size:12px;margin:12px 0 6px">Modules installés</h4>
        ${data.modules.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucun module</p>' :
            `<div style="display:flex;gap:6px;flex-wrap:wrap">${data.modules.map((m: InstalledStationModule) => {
                const mod = this.availableModules[m.type];
                return `<span style="background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">${mod ? icon(mod.icon, 12) : ''} ${htmlText(mod?.name || m.type)}</span>`;
            }).join('')}</div>`}

        <h4 style="font-size:12px;margin:12px 0 6px">Modules disponibles</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(this.availableModules).map(([key, mod]) => {
            const count = data.modules.filter((m: { type: unknown }) => m.type === key).length;
            const moduleDef = mod as { maxPerStation: number; cost: number; icon: string; name: string; description: string };
            const maxed = count >= moduleDef.maxPerStation;
            const affordable = game.economy.balance >= moduleDef.cost;
            return `<button class="upgrade-buy btn-primary" data-station="${escapeUpgradeText(stationId)}" data-module="${htmlText(key)}"
              style="font-size:11px;padding:8px 12px;background:${htmlText(maxed ? '#374151' : affordable ? '#3b82f6' : '#991b1b')};text-align:left"
              ${maxed || !affordable ? 'disabled' : ''}>
              ${icon(moduleDef.icon, 12)} ${htmlText(moduleDef.name)}<br>
              <span style="font-size:9px;opacity:0.7">${moduleDef.cost.toLocaleString('fr-FR')} € — ${htmlText(moduleDef.description)}${count > 0 ? ` (${count}/${moduleDef.maxPerStation})` : ''}</span>
            </button>`;
        }).join('')}
        </div>
      </div>
    `;
        container.querySelectorAll('.upgrade-buy').forEach((btn: HTMLButtonElement) => {
            btn.addEventListener('click', () => {
                const moduleType = btn.dataset.module;
                if (this.buyModule(stationId, moduleType, game.economy)) {
                    game.saveState?.();
                    this._renderStationDetail(container, stationId, game);
                }
            });
        });
    }
    toSave() {
        return { upgrades: this.upgrades };
    }
    loadFromSave(s: unknown, world: World | null = null) {
        this.upgrades = Object.create(null);
        if (!isRecord(s) || !isRecord(s.upgrades)) { this.syncRuntime(); return; }
        const stationIds = world?.stations ? new Set(world.stations.map((st: { id: unknown }) => String(st?.id ?? '')).filter(Boolean)) : null;
        for (const [rawId, rawValue] of Object.entries(s.upgrades)) {
            if (!isRecord(rawValue))
                continue;
            const raw = rawValue;
            const stationId = String(rawId || '');
            if (!stationId || stationId === '__proto__' || stationId === 'constructor' || stationId === 'prototype' || (stationIds && !stationIds.has(stationId)))
                continue;
            const counts = new Map(), modules = [];
            for (const value of Array.isArray(raw.modules) ? raw.modules : []) {
                if (!isRecord(value))
                    continue;
                const type = String(value.type ?? '');
                const def = Object.prototype.hasOwnProperty.call(this.availableModules, type) ? this.availableModules[type] : undefined;
                if (!def)
                    continue;
                const count = counts.get(type) || 0;
                if (count >= def.maxPerStation)
                    continue;
                counts.set(type, count + 1);
                const builtAt = Number(value.builtAt);
                modules.push({ type, builtAt: Number.isFinite(builtAt) && builtAt >= 0 ? builtAt : 0 });
            }
            const derived = modules.reduce((sum, m) => sum + (this.availableModules[m.type]?.cost || 0), 0);
            const rawInvest = Number(raw.totalInvested);
            const totalInvested = Number.isFinite(rawInvest) && rawInvest >= derived ? rawInvest : derived;
            const level = Math.max(1, Math.floor(totalInvested / 50000) + 1);
            this.upgrades[stationId] = { modules, level, totalInvested };
        }
        this.syncRuntime();
    }
}

