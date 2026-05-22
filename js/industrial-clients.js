/**
 * IndustrialClients — Major industrial customers that generate massive freight traffic.
 * Adapted for very high traffic volumes (cimenteries, raffineries, ports, aciéries).
 */

let nextClientId = 1;

const INDUSTRY_TYPES = [
  {
    type: 'cement',
    name: 'Cimenterie',
    icon: '🏭',
    cargoTypes: ['sand', 'gravel', 'coal'],
    cargoOut: 'Ciment',
    dailyTonnageMin: 200,
    dailyTonnageMax: 800,
    pricePerTonne: 30,
    attractCost: 80000,
    description: 'Produit 200-800t/jour de ciment. Consomme sable, gravier, charbon.',
  },
  {
    type: 'refinery',
    name: 'Raffinerie',
    icon: '🛢️',
    cargoTypes: ['fuel', 'chemicals-liq', 'lpg'],
    cargoOut: 'Produits pétroliers',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2000,
    pricePerTonne: 55,
    attractCost: 200000,
    description: 'Produit 500-2000t/jour. Nécessite équipement TMD. Très haut trafic.',
  },
  {
    type: 'port',
    name: 'Port maritime',
    icon: '🚢',
    cargoTypes: ['containers-20', 'containers-40', 'containers-reefer'],
    cargoOut: 'Conteneurs export',
    dailyTonnageMin: 800,
    dailyTonnageMax: 5000,
    pricePerTonne: 45,
    attractCost: 350000,
    description: 'Trafic massif de conteneurs : 800-5000 TEU/jour. Le plus gros générateur de fret.',
  },
  {
    type: 'steel_mill',
    name: 'Aciérie',
    icon: '🔩',
    cargoTypes: ['ore', 'coal', 'steel-coils', 'steel-beams'],
    cargoOut: 'Produits sidérurgiques',
    dailyTonnageMin: 400,
    dailyTonnageMax: 1500,
    pricePerTonne: 40,
    attractCost: 150000,
    description: 'Consomme minerai + charbon, produit 400-1500t/jour d\'acier.',
  },
  {
    type: 'auto_plant',
    name: 'Usine automobile',
    icon: '🚗',
    cargoTypes: ['cars', 'trucks', 'steel-coils'],
    cargoOut: 'Véhicules neufs',
    dailyTonnageMin: 100,
    dailyTonnageMax: 500,
    pricePerTonne: 120,
    attractCost: 120000,
    description: 'Exporte 100-500 véhicules/jour. Haut revenu par unité.',
  },
  {
    type: 'grain_terminal',
    name: 'Terminal céréalier',
    icon: '🌾',
    cargoTypes: ['cereals'],
    cargoOut: 'Céréales export',
    dailyTonnageMin: 300,
    dailyTonnageMax: 1200,
    pricePerTonne: 35,
    attractCost: 90000,
    description: 'Trafic saisonnier intense pendant les récoltes. 300-1200t/jour.',
  },
  {
    type: 'chemical_plant',
    name: 'Usine chimique',
    icon: '⚗️',
    cargoTypes: ['chemicals-liq', 'toxic', 'corrosive'],
    cargoOut: 'Produits chimiques',
    dailyTonnageMin: 150,
    dailyTonnageMax: 600,
    pricePerTonne: 90,
    attractCost: 130000,
    description: 'Produits dangereux : 150-600t/jour. Nécessite TMD. Revenu élevé.',
  },
  {
    type: 'paper_mill',
    name: 'Papeterie',
    icon: '📜',
    cargoTypes: ['timber', 'pulp', 'paper'],
    cargoOut: 'Papier/carton',
    dailyTonnageMin: 200,
    dailyTonnageMax: 700,
    pricePerTonne: 50,
    attractCost: 75000,
    description: 'Consomme bois brut, produit 200-700t/jour de papier.',
  },
  {
    type: 'logistics_hub',
    name: 'Plateforme logistique',
    icon: '📦',
    cargoTypes: ['containers-20', 'containers-40'],
    cargoOut: 'Colis/palettes',
    dailyTonnageMin: 400,
    dailyTonnageMax: 3000,
    pricePerTonne: 65,
    attractCost: 250000,
    description: 'Hub multimodal : 400-3000t/jour. Le cœur de la supply chain.',
  },
  {
    type: 'power_plant',
    name: 'Centrale thermique',
    icon: '⚡',
    cargoTypes: ['coal'],
    cargoOut: 'Cendres/résidus',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2500,
    pricePerTonne: 20,
    attractCost: 100000,
    description: 'Consomme 500-2500t/jour de charbon. Trafic régulier et prévisible.',
  },
];

export class IndustrialClients {
  constructor() {
    this.clients = []; // { id, type, name, stationId, depotId, dailyTonnage, active, satisfaction, contractsGenerated, totalTonnage, totalRevenue }
    this.lastGenerationTime = {};
    this.stats = {
      totalClients: 0,
      totalTonnage: 0,
      totalRevenue: 0,
      contractsGenerated: 0,
    };
  }

  getIndustryTypes() {
    return INDUSTRY_TYPES;
  }

  getIndustryInfo(type) {
    return INDUSTRY_TYPES.find(i => i.type === type) || null;
  }

  attractClient(industryType, stationId, depotId, economy) {
    const industry = this.getIndustryInfo(industryType);
    if (!industry) return null;
    if (economy.balance < industry.attractCost) return null;

    economy.addExpense(industry.attractCost, 'infrastructure', `Attraction client: ${industry.name}`);

    const dailyTonnage = industry.dailyTonnageMin + Math.floor(Math.random() * (industry.dailyTonnageMax - industry.dailyTonnageMin));

    const client = {
      id: `client-${nextClientId++}`,
      type: industryType,
      name: industry.name,
      icon: industry.icon,
      stationId,
      depotId,
      dailyTonnage,
      active: true,
      satisfaction: 80,
      contractsGenerated: 0,
      totalTonnage: 0,
      totalRevenue: 0,
      createdAt: Date.now(),
    };

    this.clients.push(client);
    this.stats.totalClients++;
    return client;
  }

  removeClient(clientId) {
    this.clients = this.clients.filter(c => c.id !== clientId);
  }

  getClientsByStation(stationId) {
    return this.clients.filter(c => c.stationId === stationId && c.active);
  }

  getActiveClients() {
    return this.clients.filter(c => c.active);
  }

  generateDailyContracts(freightManager, world) {
    for (const client of this.clients) {
      if (!client.active) continue;

      const industry = this.getIndustryInfo(client.type);
      if (!industry) continue;

      const stations = world.stations || [];
      if (stations.length < 2) continue;

      const otherStations = stations.filter(s => s.id !== client.stationId);
      if (otherStations.length === 0) continue;

      const fromStation = stations.find(s => s.id === client.stationId);
      if (!fromStation) continue;

      // Generate multiple contracts based on daily tonnage
      let remainingTonnage = client.dailyTonnage;
      let contractsToday = 0;

      while (remainingTonnage > 0 && contractsToday < 10) {
        // Each contract handles a portion of daily tonnage
        const contractTonnage = Math.min(
          remainingTonnage,
          Math.max(50, Math.floor(remainingTonnage / (3 + Math.random() * 3)))
        );

        const toStation = otherStations[Math.floor(Math.random() * otherStations.length)];
        const revenue = Math.floor(contractTonnage * industry.pricePerTonne);

        // Pick a cargo type from the industry
        const cargoType = industry.cargoTypes[Math.floor(Math.random() * industry.cargoTypes.length)];

        if (freightManager.contracts.filter(c => c.active).length < 20) {
          const { FreightContract } = freightManager.constructor === Object ? {} : { FreightContract: null };
          freightManager.contracts.push({
            id: `fret-ind-${nextClientId++}`,
            cargoType,
            cargoName: industry.cargoOut,
            quantity: contractTonnage,
            unit: 't',
            from: fromStation.name,
            fromId: fromStation.id,
            to: toStation.name,
            toId: toStation.id,
            payment: revenue,
            active: true,
            progress: 0,
            industrialClientId: client.id,
          });
        }

        remainingTonnage -= contractTonnage;
        contractsToday++;
        client.contractsGenerated++;
        client.totalTonnage += contractTonnage;
        client.totalRevenue += revenue;
        this.stats.contractsGenerated++;
        this.stats.totalTonnage += contractTonnage;
        this.stats.totalRevenue += revenue;
      }

      // Satisfaction decays if ITE is underequipped
      if (client.satisfaction > 20) {
        client.satisfaction = Math.max(20, client.satisfaction - 0.5);
      }
    }
  }

  boostSatisfaction(clientId, amount) {
    const client = this.clients.find(c => c.id === clientId);
    if (client) {
      client.satisfaction = Math.min(100, client.satisfaction + amount);
    }
  }

  render(container, game) {
    if (!container) return;

    const activeClients = this.getActiveClients();

    container.innerHTML = `
      <div class="dash-section">
        <h3>Clients Industriels</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Clients actifs</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${activeClients.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Tonnage total</div>
            <div class="dash-kpi-value">${this.stats.totalTonnage.toLocaleString('fr-FR')} t</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Revenus générés</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.stats.totalRevenue.toLocaleString('fr-FR')} €</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Contrats générés</div>
            <div class="dash-kpi-value">${this.stats.contractsGenerated}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Trafic/jour moyen</div>
            <div class="dash-kpi-value" style="color:#f97316">${activeClients.length > 0 ? Math.floor(activeClients.reduce((s, c) => s + c.dailyTonnage, 0)).toLocaleString('fr-FR') : 0} t</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde</div>
            <div class="dash-kpi-value" style="color:var(--green)">${game.economy.formatAmount(game.economy.balance)}</div>
          </div>
        </div>
      </div>

      ${activeClients.length > 0 ? `
      <div class="dash-section">
        <h3>Clients installés</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 1fr 0.8fr 0.6fr 0.6fr 0.5fr">
            <span></span><span>Client</span><span>Gare</span><span>Trafic/j</span><span>Satisfaction</span><span>Actions</span>
          </div>
          ${activeClients.map(c => {
            const station = game.world?.stations.find(s => s.id === c.stationId);
            const satColor = c.satisfaction > 70 ? 'var(--green)' : c.satisfaction > 40 ? '#f97316' : '#ef4444';
            return `
              <div class="dash-train-row" style="grid-template-columns:0.3fr 1fr 0.8fr 0.6fr 0.6fr 0.5fr">
                <span>${c.icon}</span>
                <span>${c.name}<br><span style="font-size:9px;color:var(--text3)">${c.totalTonnage.toLocaleString('fr-FR')} t traités</span></span>
                <span>${station?.name || '?'}</span>
                <span style="color:#38bdf8">${c.dailyTonnage.toLocaleString('fr-FR')} t</span>
                <span style="color:${satColor}">${Math.floor(c.satisfaction)}%</span>
                <span><button class="btn-primary industrial-remove" data-id="${c.id}" style="font-size:9px;padding:3px 6px;background:#991b1b">Résilier</button></span>
              </div>
            `;
          }).join('')}
        </div>
      </div>` : ''}

      <div class="dash-section">
        <h3>Attirer un client industriel</h3>
        <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Sélectionnez une gare avec une ITE, puis choisissez le type d'industrie à attirer.</p>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select id="industrial-station-select" style="flex:1;min-width:200px;padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Choisir une gare avec ITE...</option>
            ${(game.depotManager?.getITEs() || []).map(ite => {
              const station = game.world?.stations.find(s => s.id === ite.stationId);
              return `<option value="${ite.stationId}" data-depot="${ite.id}">${station?.name || '?'} — ${ite.name}</option>`;
            }).join('')}
          </select>
        </div>

        <div id="industrial-types-grid" style="display:flex;gap:8px;flex-wrap:wrap">
          ${INDUSTRY_TYPES.map(ind => {
            const affordable = game.economy.balance >= ind.attractCost;
            return `<button class="industrial-attract btn-primary" data-type="${ind.type}"
              style="font-size:11px;padding:10px 14px;background:${affordable ? '#3b82f6' : '#991b1b'};text-align:left;min-width:200px"
              ${!affordable ? 'disabled' : ''}>
              ${ind.icon} <b>${ind.name}</b><br>
              <span style="font-size:9px;opacity:0.8">${ind.description}</span><br>
              <span style="font-size:10px;color:#fbbf24">${ind.attractCost.toLocaleString('fr-FR')} € • ${ind.dailyTonnageMin}-${ind.dailyTonnageMax} t/j • ${ind.pricePerTonne} €/t</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    `;

    // Bind attract buttons
    container.querySelectorAll('.industrial-attract').forEach(btn => {
      btn.addEventListener('click', () => {
        const select = container.querySelector('#industrial-station-select');
        const stationId = select?.value;
        const depotId = select?.selectedOptions?.[0]?.dataset?.depot;
        if (!stationId) { alert('Sélectionnez une gare avec ITE d\'abord'); return; }

        const type = btn.dataset.type;
        const client = this.attractClient(type, stationId, depotId, game.economy);
        if (client) {
          this.render(container, game);
        } else {
          alert('Fonds insuffisants');
        }
      });
    });

    // Bind remove buttons
    container.querySelectorAll('.industrial-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Résilier ce client ? Il ne générera plus de contrats.')) {
          this.removeClient(btn.dataset.id);
          this.render(container, game);
        }
      });
    });
  }

  toSave() {
    return {
      clients: this.clients,
      stats: this.stats,
      _nextClientId: nextClientId,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.clients = s.clients || [];
    this.stats = s.stats || { totalClients: 0, totalTonnage: 0, totalRevenue: 0, contractsGenerated: 0 };
    if (s._nextClientId) nextClientId = s._nextClientId;
  }
}
