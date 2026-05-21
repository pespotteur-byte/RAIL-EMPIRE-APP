/**
 * StationUpgrades — Modular station upgrade system.
 * Additive: adds upgrade capabilities to existing stations.
 */
export class StationUpgrades {
  constructor() {
    this.upgrades = {}; // stationId -> { modules: [...], level: N }
    this.availableModules = {
      platform: {
        name: 'Quai supplémentaire',
        cost: 15000,
        icon: '🚏',
        description: '+1 quai, permet plus de trains simultanés',
        maxPerStation: 6,
        effect: { platforms: 1 },
      },
      parking: {
        name: 'Parking voyageurs',
        cost: 20000,
        icon: '🅿️',
        description: '+5% de fréquentation',
        maxPerStation: 1,
        effect: { frequentation: 0.05 },
      },
      hall: {
        name: 'Hall voyageurs',
        cost: 50000,
        icon: '🏛️',
        description: '+10% de fréquentation, +5% satisfaction',
        maxPerStation: 1,
        effect: { frequentation: 0.10, satisfaction: 0.05 },
      },
      display: {
        name: 'Écrans Infogare',
        cost: 8000,
        icon: '📺',
        description: 'Information voyageurs en temps réel',
        maxPerStation: 1,
        effect: { satisfaction: 0.03 },
      },
      depot: {
        name: 'Voie de garage',
        cost: 25000,
        icon: '🔧',
        description: 'Permet le stationnement et le retournement',
        maxPerStation: 3,
        effect: { garage: 1 },
      },
      freight: {
        name: 'Terminal fret',
        cost: 40000,
        icon: '📦',
        description: 'Permet le chargement/déchargement de fret',
        maxPerStation: 1,
        effect: { freight: true },
      },
      restaurant: {
        name: 'Restauration',
        cost: 12000,
        icon: '🍽️',
        description: '+3% satisfaction voyageurs',
        maxPerStation: 1,
        effect: { satisfaction: 0.03 },
      },
      wifi: {
        name: 'WiFi gratuit',
        cost: 5000,
        icon: '📶',
        description: '+2% satisfaction voyageurs',
        maxPerStation: 1,
        effect: { satisfaction: 0.02 },
      },
    };
  }

  /**
   * Get upgrade data for a station, creating default if needed.
   */
  getStation(stationId) {
    if (!this.upgrades[stationId]) {
      this.upgrades[stationId] = { modules: [], level: 1, totalInvested: 0 };
    }
    return this.upgrades[stationId];
  }

  /**
   * Buy a module for a station.
   */
  buyModule(stationId, moduleType, economy) {
    const mod = this.availableModules[moduleType];
    if (!mod) return false;

    const data = this.getStation(stationId);
    const count = data.modules.filter(m => m.type === moduleType).length;
    if (count >= mod.maxPerStation) return false;
    if (economy.balance < mod.cost) return false;

    economy.addExpense(mod.cost, 'infrastructure', `${mod.name} — gare`);
    data.modules.push({
      type: moduleType,
      builtAt: Date.now(),
    });
    data.totalInvested += mod.cost;
    data.level = Math.floor(data.totalInvested / 50000) + 1;

    return true;
  }

  /**
   * Get total extra platforms from upgrades.
   */
  getExtraPlatforms(stationId) {
    const data = this.upgrades[stationId];
    if (!data) return 0;
    return data.modules.filter(m => m.type === 'platform').length;
  }

  /**
   * Get frequentation bonus.
   */
  getFrequentationBonus(stationId) {
    const data = this.upgrades[stationId];
    if (!data) return 0;
    let bonus = 0;
    for (const mod of data.modules) {
      const eff = this.availableModules[mod.type]?.effect;
      if (eff?.frequentation) bonus += eff.frequentation;
    }
    return bonus;
  }

  /**
   * Get satisfaction bonus.
   */
  getSatisfactionBonus(stationId) {
    const data = this.upgrades[stationId];
    if (!data) return 0;
    let bonus = 0;
    for (const mod of data.modules) {
      const eff = this.availableModules[mod.type]?.effect;
      if (eff?.satisfaction) bonus += eff.satisfaction;
    }
    return bonus;
  }

  /**
   * Render station upgrades panel.
   */
  render(container, game) {
    if (!container) return;
    const stations = game.world?.stations || [];

    const totalInvested = Object.values(this.upgrades).reduce((s, u) => s + u.totalInvested, 0);
    const totalModules = Object.values(this.upgrades).reduce((s, u) => s + u.modules.length, 0);

    container.innerHTML = `
      <div class="dash-section">
        <h3>Gares Modulaires</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Gares améliorées</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${Object.keys(this.upgrades).filter(k => this.upgrades[k].modules.length > 0).length}</div>
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
          ${stations.map(s => {
            const data = this.upgrades[s.id];
            const level = data ? data.level : 1;
            return `<option value="${s.id}">${s.name} (Niv. ${level})</option>`;
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
        } else if (detail) {
          detail.innerHTML = '';
        }
      });
    }
  }

  _renderStationDetail(container, stationId, game) {
    const station = game.world?.stations.find(s => s.id === stationId);
    if (!station) return;

    const data = this.getStation(stationId);

    container.innerHTML = `
      <div class="dash-section" style="background:var(--bg2);padding:12px;border-radius:6px">
        <h3 style="margin-bottom:8px">${station.name} — Niveau ${data.level}</h3>
        <p style="font-size:11px;color:var(--text3);margin-bottom:8px">
          ${station.platforms + this.getExtraPlatforms(stationId)} quais •
          Investissement: ${data.totalInvested.toLocaleString('fr-FR')} €
        </p>

        <h4 style="font-size:12px;margin:12px 0 6px">Modules installés</h4>
        ${data.modules.length === 0 ? '<p style="color:var(--text3);font-size:11px">Aucun module</p>' :
          `<div style="display:flex;gap:6px;flex-wrap:wrap">${data.modules.map(m => {
            const mod = this.availableModules[m.type];
            return `<span style="background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">${mod?.icon || ''} ${mod?.name || m.type}</span>`;
          }).join('')}</div>`}

        <h4 style="font-size:12px;margin:12px 0 6px">Modules disponibles</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(this.availableModules).map(([key, mod]) => {
            const count = data.modules.filter(m => m.type === key).length;
            const maxed = count >= mod.maxPerStation;
            const affordable = game.economy.balance >= mod.cost;
            return `<button class="upgrade-buy btn-primary" data-station="${stationId}" data-module="${key}"
              style="font-size:11px;padding:8px 12px;background:${maxed ? '#374151' : affordable ? '#3b82f6' : '#991b1b'};text-align:left"
              ${maxed || !affordable ? 'disabled' : ''}>
              ${mod.icon} ${mod.name}<br>
              <span style="font-size:9px;opacity:0.7">${mod.cost.toLocaleString('fr-FR')} € — ${mod.description}${count > 0 ? ` (${count}/${mod.maxPerStation})` : ''}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.upgrade-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const moduleType = btn.dataset.module;
        if (this.buyModule(stationId, moduleType, game.economy)) {
          this._renderStationDetail(container, stationId, game);
        }
      });
    });
  }

  toSave() {
    return { upgrades: this.upgrades };
  }

  loadFromSave(s) {
    if (!s) return;
    this.upgrades = s.upgrades || {};
  }
}
