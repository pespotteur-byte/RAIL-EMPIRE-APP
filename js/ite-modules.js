import { icon } from './icons.js';
/**
 * ITEModules — Modular ITE system with upgradeable infrastructure.
 * Adds loading bays, cranes, silos, warehouses to ITE installations.
 */
export class ITEModules {
  constructor() {
    this.installations = {}; // depotId -> { modules: [...], capacity, throughput }

    this.availableModules = {
      loading_bay: {
        name: 'Voie de chargement',
        cost: 25000,
        icon: 'track',
        description: '+1 voie de chargement simultané',
        maxPerITE: 8,
        effect: { loadingTracks: 1, throughputBonus: 50 },
        maintenanceCost: 150,
      },
      crane: {
        name: 'Grue de manutention',
        cost: 45000,
        icon: 'crane',
        description: 'Réduit le temps de chargement de 20%',
        maxPerITE: 4,
        effect: { loadingSpeedBonus: 0.20, throughputBonus: 100 },
        maintenanceCost: 250,
      },
      gantry_crane: {
        name: 'Portique conteneurs',
        cost: 120000,
        icon: 'crane',
        description: 'Chargement rapide conteneurs, +200t/jour',
        maxPerITE: 3,
        effect: { containerSpeed: 0.35, throughputBonus: 200, containerOnly: true },
        maintenanceCost: 500,
      },
      reach_stacker: {
        name: 'Reach stacker',
        cost: 65000,
        icon: 'crane',
        description: 'Empilage conteneurs rapide, +100t/jour',
        maxPerITE: 3,
        effect: { containerSpeed: 0.15, throughputBonus: 100 },
        maintenanceCost: 300,
      },
      silo: {
        name: 'Silo de stockage',
        cost: 35000,
        icon: 'silo',
        description: 'Stockage vrac — 500t de capacité',
        maxPerITE: 8,
        effect: { storageCapacity: 500, bulkOnly: true, throughputBonus: 80 },
        maintenanceCost: 180,
      },
      warehouse: {
        name: 'Entrepôt couvert',
        cost: 55000,
        icon: 'warehouse',
        description: 'Stockage 300t, protège du vol/intempéries',
        maxPerITE: 6,
        effect: { storageCapacity: 300, throughputBonus: 60, protection: true },
        maintenanceCost: 300,
      },
      cold_storage: {
        name: 'Entrepôt frigorifique',
        cost: 85000,
        icon: 'warehouse',
        description: 'Stockage réfrigéré 200t pour alimentaire',
        maxPerITE: 3,
        effect: { storageCapacity: 200, throughputBonus: 80, coldCapable: true },
        maintenanceCost: 500,
      },
      tank_farm: {
        name: 'Parc de citernes',
        cost: 80000,
        icon: 'oil',
        description: 'Stockage liquides/gaz — 200m³, TMD',
        maxPerITE: 6,
        effect: { liquidCapacity: 200, throughputBonus: 120, hazardCapable: true },
        maintenanceCost: 400,
      },
      weighbridge: {
        name: 'Pont-bascule',
        cost: 20000,
        icon: 'scale',
        description: 'Pesée auto — évite surcharges/amendes',
        maxPerITE: 1,
        effect: { weighing: true, throughputBonus: 20 },
        maintenanceCost: 100,
      },
      shunting_yard: {
        name: 'Faisceau de triage',
        cost: 90000,
        icon: 'sorting',
        description: 'Manœuvres rapides — ×0.7 temps',
        maxPerITE: 3,
        effect: { shuntingSpeedBonus: 0.30, throughputBonus: 150 },
        maintenanceCost: 450,
      },
      hump_yard: {
        name: 'Butte de triage',
        cost: 200000,
        icon: 'sorting',
        description: 'Triage par gravité — ×0.5 temps manœuvre',
        maxPerITE: 1,
        effect: { shuntingSpeedBonus: 0.50, throughputBonus: 300 },
        maintenanceCost: 800,
      },
      rail_loader: {
        name: 'Chargeur à rails',
        cost: 30000,
        icon: 'track',
        description: 'Chargement vrac automatisé +15%',
        maxPerITE: 2,
        effect: { loadingSpeedBonus: 0.15, throughputBonus: 60 },
        maintenanceCost: 200,
      },
      auto_ramp: {
        name: 'Rampe porte-autos',
        cost: 40000,
        icon: 'car',
        description: 'Chargement véhicules rapide +25%',
        maxPerITE: 2,
        effect: { loadingSpeedBonus: 0.25, throughputBonus: 80, autoOnly: true },
        maintenanceCost: 200,
      },
      security_fence: {
        name: 'Clôture sécurisée',
        cost: 15000,
        icon: 'hazard',
        description: 'Sécurisation périmètre, -50% vols',
        maxPerITE: 1,
        effect: { security: true, throughputBonus: 10 },
        maintenanceCost: 50,
      },
      lighting: {
        name: 'Éclairage industriel',
        cost: 10000,
        icon: 'lightning',
        description: 'Opérations 24h/24',
        maxPerITE: 1,
        effect: { nightOps: true, throughputBonus: 30 },
        maintenanceCost: 80,
      },
    };
  }

  getInstallation(depotId) {
    if (!this.installations[depotId]) {
      this.installations[depotId] = {
        modules: [],
        totalInvested: 0,
        level: 1,
        totalTonnageHandled: 0,
        totalRevenue: 0,
      };
    }
    return this.installations[depotId];
  }

  buyModule(depotId, moduleType, economy) {
    const mod = this.availableModules[moduleType];
    if (!mod) return false;

    const data = this.getInstallation(depotId);
    const count = data.modules.filter(m => m.type === moduleType).length;
    if (count >= mod.maxPerITE) return false;
    if (economy.balance < mod.cost) return false;

    economy.addExpense(mod.cost, 'infrastructure', `${mod.name} — ITE`);
    data.modules.push({ type: moduleType, builtAt: Date.now() });
    data.totalInvested += mod.cost;
    data.level = Math.floor(data.totalInvested / 80000) + 1;
    return true;
  }

  getThroughput(depotId) {
    const data = this.installations[depotId];
    if (!data) return 100; // base throughput
    let base = 100;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.effect?.throughputBonus) base += mod.effect.throughputBonus;
    }
    return base;
  }

  getLoadingSpeedMultiplier(depotId) {
    const data = this.installations[depotId];
    if (!data) return 1;
    let bonus = 0;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.effect?.loadingSpeedBonus) bonus += mod.effect.loadingSpeedBonus;
      if (mod?.effect?.containerSpeed) bonus += mod.effect.containerSpeed;
    }
    return 1 / (1 + bonus); // lower = faster
  }

  getShuntingSpeedMultiplier(depotId) {
    const data = this.installations[depotId];
    if (!data) return 1;
    let bonus = 0;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.effect?.shuntingSpeedBonus) bonus += mod.effect.shuntingSpeedBonus;
    }
    return 1 / (1 + bonus);
  }

  getStorageCapacity(depotId) {
    const data = this.installations[depotId];
    if (!data) return 0;
    let total = 0;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.effect?.storageCapacity) total += mod.effect.storageCapacity;
      if (mod?.effect?.liquidCapacity) total += mod.effect.liquidCapacity;
    }
    return total;
  }

  getLoadingTracks(depotId) {
    const data = this.installations[depotId];
    if (!data) return 1;
    let tracks = 1;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.effect?.loadingTracks) tracks += mod.effect.loadingTracks;
    }
    return tracks;
  }

  hasWeighbridge(depotId) {
    const data = this.installations[depotId];
    if (!data) return false;
    return data.modules.some(m => m.type === 'weighbridge');
  }

  canHandleHazardous(depotId) {
    const data = this.installations[depotId];
    if (!data) return false;
    return data.modules.some(m => {
      const mod = this.availableModules[m.type];
      return mod?.effect?.hazardCapable;
    });
  }

  getDailyMaintenanceCost(depotId) {
    const data = this.installations[depotId];
    if (!data) return 0;
    let cost = 0;
    for (const m of data.modules) {
      const mod = this.availableModules[m.type];
      if (mod?.maintenanceCost) cost += mod.maintenanceCost;
    }
    return cost;
  }

  getTotalDailyMaintenance() {
    let total = 0;
    for (const depotId of Object.keys(this.installations)) {
      total += this.getDailyMaintenanceCost(depotId);
    }
    return total;
  }

  recordHandling(depotId, tonnage, revenue) {
    const data = this.getInstallation(depotId);
    data.totalTonnageHandled += tonnage;
    data.totalRevenue += revenue;
  }

  render(container, game) {
    if (!container) return;

    const ites = game.depotManager.getITEs();
    const totalInvested = Object.values(this.installations).reduce((s, i) => s + i.totalInvested, 0);
    const totalModules = Object.values(this.installations).reduce((s, i) => s + i.modules.length, 0);
    const totalMaintenance = this.getTotalDailyMaintenance();

    container.innerHTML = `
      <div class="dash-section">
        <h3>ITE — Installations Terminales Embranchées</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">ITE construites</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${ites.length}</div>
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
            <div class="dash-kpi-label">Maintenance/jour</div>
            <div class="dash-kpi-value" style="color:#ef4444">${totalMaintenance.toLocaleString('fr-FR')} €</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde</div>
            <div class="dash-kpi-value" style="color:var(--green)">${game.economy.formatAmount(game.economy.balance)}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Sélectionner une ITE</h3>
        ${ites.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucune ITE construite. Créez des ITE depuis l\'onglet Dépots/ITE.</p>' : `
        <select id="ite-module-select" style="width:100%;max-width:300px;padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <option value="">Choisir une ITE...</option>
          ${ites.map(d => {
            const data = this.installations[d.id];
            const level = data ? data.level : 1;
            const station = game.world?.stations.find(s => s.id === d.stationId);
            return `<option value="${d.id}">${d.name} — ${station?.name || '?'} (Niv. ${level})</option>`;
          }).join('')}
        </select>
        <div id="ite-module-detail" style="margin-top:12px"></div>`}
      </div>

      <div class="dash-section">
        <h3>Catalogue des modules ITE</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 1.2fr 1fr 0.5fr 0.5fr 0.4fr">
            <span></span><span>Module</span><span>Effet</span><span>Coût</span><span>Maint./j</span><span>Max</span>
          </div>
          ${Object.entries(this.availableModules).map(([key, mod]) => `
            <div class="dash-train-row" style="grid-template-columns:0.3fr 1.2fr 1fr 0.5fr 0.5fr 0.4fr">
              <span>${icon(mod.icon, 16)}</span>
              <span>${mod.name}</span>
              <span style="font-size:10px;color:var(--text3)">${mod.description}</span>
              <span style="color:#f97316">${(mod.cost/1000).toFixed(0)}K€</span>
              <span style="color:#ef4444">${mod.maintenanceCost}€</span>
              <span>×${mod.maxPerITE}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const select = container.querySelector('#ite-module-select');
    if (select) {
      select.addEventListener('change', () => {
        const depotId = select.value;
        const detail = container.querySelector('#ite-module-detail');
        if (depotId && detail) {
          this._renderITEDetail(detail, depotId, game);
        } else if (detail) {
          detail.innerHTML = '';
        }
      });
    }
  }

  _renderITEDetail(container, depotId, game) {
    const depot = game.depotManager.getAll().find(d => d.id === depotId);
    if (!depot) return;

    const data = this.getInstallation(depotId);
    const station = game.world?.stations.find(s => s.id === depot.stationId);
    const throughput = this.getThroughput(depotId);
    const storage = this.getStorageCapacity(depotId);
    const tracks = this.getLoadingTracks(depotId);
    const loadSpeed = this.getLoadingSpeedMultiplier(depotId);
    const shuntSpeed = this.getShuntingSpeedMultiplier(depotId);

    container.innerHTML = `
      <div class="dash-section" style="background:var(--bg2);padding:12px;border-radius:6px">
        <h3 style="margin-bottom:8px">${depot.name} — ${station?.name || '?'} — Niveau ${data.level}</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Débit</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${throughput} t/j</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Stockage</div>
            <div class="dash-kpi-value">${storage} t</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Voies chargement</div>
            <div class="dash-kpi-value">${tracks}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Vitesse chargement</div>
            <div class="dash-kpi-value" style="color:var(--green)">×${(1/loadSpeed).toFixed(1)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Vitesse manœuvre</div>
            <div class="dash-kpi-value" style="color:var(--green)">×${(1/shuntSpeed).toFixed(1)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">TMD</div>
            <div class="dash-kpi-value" style="color:${this.canHandleHazardous(depotId) ? 'var(--green)' : '#ef4444'}">${this.canHandleHazardous(depotId) ? '✓ Oui' : '✗ Non'}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Pont-bascule</div>
            <div class="dash-kpi-value" style="color:${this.hasWeighbridge(depotId) ? 'var(--green)' : '#ef4444'}">${this.hasWeighbridge(depotId) ? '✓ Oui' : '✗ Non'}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Tonnage traité</div>
            <div class="dash-kpi-value">${data.totalTonnageHandled.toLocaleString('fr-FR')} t</div>
          </div>
        </div>

        <h4 style="font-size:12px;margin:12px 0 6px">Modules installés</h4>
        ${data.modules.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucun module — ITE de base uniquement</p>' :
          `<div style="display:flex;gap:6px;flex-wrap:wrap">${data.modules.map(m => {
            const mod = this.availableModules[m.type];
            return `<span style="background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">${mod ? icon(mod.icon, 12) : ''} ${mod?.name || m.type}</span>`;
          }).join('')}</div>`}

        <h4 style="font-size:12px;margin:12px 0 6px">Acheter un module</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(this.availableModules).map(([key, mod]) => {
            const count = data.modules.filter(m => m.type === key).length;
            const maxed = count >= mod.maxPerITE;
            const affordable = game.economy.balance >= mod.cost;
            return `<button class="ite-buy-mod btn-primary" data-depot="${depotId}" data-module="${key}"
              style="font-size:11px;padding:8px 12px;background:${maxed ? '#374151' : affordable ? '#3b82f6' : '#991b1b'};text-align:left"
              ${maxed || !affordable ? 'disabled' : ''}>
              ${icon(mod.icon, 12)} ${mod.name}<br>
              <span style="font-size:9px;opacity:0.7">${mod.cost.toLocaleString('fr-FR')} € — ${mod.description}${count > 0 ? ` (${count}/${mod.maxPerITE})` : ''}</span>
            </button>`;
          }).join('')}
        </div>

        <div style="margin-top:10px;font-size:10px;color:var(--text3)">
          Maintenance quotidienne de cette ITE : <b style="color:#ef4444">${this.getDailyMaintenanceCost(depotId).toLocaleString('fr-FR')} €/jour</b>
        </div>
      </div>
    `;

    container.querySelectorAll('.ite-buy-mod').forEach(btn => {
      btn.addEventListener('click', () => {
        const moduleType = btn.dataset.module;
        if (this.buyModule(depotId, moduleType, game.economy)) {
          this._renderITEDetail(container, depotId, game);
        }
      });
    });
  }

  toSave() {
    return { installations: this.installations };
  }

  loadFromSave(s) {
    if (!s) return;
    this.installations = s.installations || {};
  }
}
