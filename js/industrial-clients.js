/**
 * IndustrialClients — Real-world industrial customers with geographic locations.
 * Uses real French industrial sites for realistic placement.
 */
import { icon } from './icons.js';

let nextClientId = 1;

const INDUSTRY_TYPES = [
  {
    type: 'cement',
    name: 'Cimenterie',
    icon: 'factory',
    cargoTypes: ['limestone', 'gypsum', 'clinker', 'cement', 'coal', 'slag'],
    cargoOut: 'Ciment',
    dailyTonnageMin: 200,
    dailyTonnageMax: 800,
    pricePerTonne: 30,
    attractCost: 80000,
    description: 'Produit 200-800t/jour de ciment. Consomme calcaire, gypse, charbon.',
    realLocations: [
      { name: 'Lafarge Ciments — Le Teil', lat: 44.548, lon: 4.681 },
      { name: 'Vicat — L\'Isle-d\'Abeau', lat: 45.616, lon: 5.229 },
      { name: 'Holcim — Altkirch', lat: 47.623, lon: 7.241 },
      { name: 'Ciments Calcia — Airvault', lat: 46.832, lon: -0.135 },
      { name: 'Kerneos — Fos-sur-Mer', lat: 43.437, lon: 4.944 },
    ],
  },
  {
    type: 'refinery',
    name: 'Raffinerie',
    icon: 'oil',
    cargoTypes: ['crude-oil', 'diesel', 'gasoline', 'jet-fuel', 'fuel-oil', 'lpg', 'ethanol'],
    cargoOut: 'Produits pétroliers',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2000,
    pricePerTonne: 55,
    attractCost: 200000,
    description: 'Produit 500-2000t/jour. Nécessite équipement TMD. Très haut trafic.',
    realLocations: [
      { name: 'TotalEnergies — Donges', lat: 47.318, lon: -2.075 },
      { name: 'TotalEnergies — Gonfreville', lat: 49.490, lon: 0.224 },
      { name: 'ExxonMobil — Notre-Dame-de-Gravenchon', lat: 49.510, lon: 0.586 },
      { name: 'Petroineos — Lavéra', lat: 43.393, lon: 5.019 },
      { name: 'TotalEnergies — Feyzin', lat: 45.670, lon: 4.857 },
    ],
  },
  {
    type: 'port',
    name: 'Port maritime',
    icon: 'cargo',
    cargoTypes: ['containers-20', 'containers-40', 'containers-reefer', 'containers-tank', 'swap-bodies'],
    cargoOut: 'Conteneurs export',
    dailyTonnageMin: 800,
    dailyTonnageMax: 5000,
    pricePerTonne: 45,
    attractCost: 350000,
    description: 'Trafic massif de conteneurs : 800-5000 TEU/jour.',
    realLocations: [
      { name: 'Grand Port du Havre', lat: 49.485, lon: 0.107 },
      { name: 'Europort Marseille-Fos', lat: 43.405, lon: 4.879 },
      { name: 'Port de Dunkerque', lat: 51.045, lon: 2.348 },
      { name: 'Port Nantes Saint-Nazaire', lat: 47.285, lon: -2.190 },
      { name: 'Port de Rouen', lat: 49.437, lon: 1.088 },
      { name: 'Port de Bordeaux', lat: 44.854, lon: -0.551 },
    ],
  },
  {
    type: 'steel_mill',
    name: 'Aciérie',
    icon: 'wrench',
    cargoTypes: ['ore', 'coal', 'scrap-metal', 'steel-coils', 'steel-beams', 'steel-sheet', 'steel-wire', 'cast-iron'],
    cargoOut: 'Produits sidérurgiques',
    dailyTonnageMin: 400,
    dailyTonnageMax: 1500,
    pricePerTonne: 40,
    attractCost: 150000,
    description: 'Consomme minerai + charbon, produit 400-1500t/jour d\'acier.',
    realLocations: [
      { name: 'ArcelorMittal — Dunkerque', lat: 51.032, lon: 2.334 },
      { name: 'ArcelorMittal — Fos-sur-Mer', lat: 43.449, lon: 4.918 },
      { name: 'ArcelorMittal — Florange', lat: 49.324, lon: 6.120 },
      { name: 'Ascometal — Les Dunes', lat: 51.035, lon: 2.345 },
      { name: 'Vallourec — Saint-Saulve', lat: 50.359, lon: 3.562 },
    ],
  },
  {
    type: 'auto_plant',
    name: 'Usine automobile',
    icon: 'car',
    cargoTypes: ['cars', 'trucks', 'vans', 'steel-coils', 'plastic-granules', 'tires'],
    cargoOut: 'Véhicules neufs',
    dailyTonnageMin: 100,
    dailyTonnageMax: 500,
    pricePerTonne: 120,
    attractCost: 120000,
    description: 'Exporte 100-500 véhicules/jour. Haut revenu par unité.',
    realLocations: [
      { name: 'PSA — Sochaux', lat: 47.512, lon: 6.832 },
      { name: 'PSA — Poissy', lat: 48.930, lon: 2.034 },
      { name: 'Renault — Flins', lat: 48.968, lon: 1.876 },
      { name: 'Renault — Douai', lat: 50.374, lon: 3.077 },
      { name: 'Toyota — Onnaing', lat: 50.391, lon: 3.601 },
      { name: 'Renault — Sandouville', lat: 49.502, lon: 0.264 },
    ],
  },
  {
    type: 'grain_terminal',
    name: 'Terminal céréalier',
    icon: 'silo',
    cargoTypes: ['wheat', 'corn', 'barley', 'rapeseed', 'sunflower', 'soybeans', 'oilseed-meal'],
    cargoOut: 'Céréales export',
    dailyTonnageMin: 300,
    dailyTonnageMax: 1200,
    pricePerTonne: 35,
    attractCost: 90000,
    description: 'Trafic saisonnier intense pendant les récoltes. 300-1200t/jour.',
    realLocations: [
      { name: 'Silos Rouen — Grand-Couronne', lat: 49.358, lon: 1.015 },
      { name: 'Soufflet — Nogent-sur-Seine', lat: 48.492, lon: 3.505 },
      { name: 'InVivo — La Pallice (La Rochelle)', lat: 46.166, lon: -1.214 },
      { name: 'Sénalia — Rouen', lat: 49.437, lon: 1.079 },
      { name: 'Axéréal — Chartres', lat: 48.453, lon: 1.489 },
    ],
  },
  {
    type: 'chemical_plant',
    name: 'Usine chimique',
    icon: 'chemistry',
    cargoTypes: ['chemicals-liq', 'acids', 'toxic', 'corrosive', 'plastic-granules', 'paint', 'ammonia', 'chlorine'],
    cargoOut: 'Produits chimiques',
    dailyTonnageMin: 150,
    dailyTonnageMax: 600,
    pricePerTonne: 90,
    attractCost: 130000,
    description: 'Produits dangereux : 150-600t/jour. Nécessite TMD. Revenu élevé.',
    realLocations: [
      { name: 'BASF — Chalampé', lat: 47.820, lon: 7.554 },
      { name: 'Arkema — Pierre-Bénite', lat: 45.700, lon: 4.825 },
      { name: 'Solvay — Dombasle-sur-Meurthe', lat: 48.619, lon: 6.348 },
      { name: 'Air Liquide — Fos-sur-Mer', lat: 43.428, lon: 4.903 },
      { name: 'Rhodia — Roussillon', lat: 45.374, lon: 4.820 },
    ],
  },
  {
    type: 'paper_mill',
    name: 'Papeterie',
    icon: 'wood',
    cargoTypes: ['timber', 'pulp', 'paper', 'cardboard', 'wood-chips'],
    cargoOut: 'Papier/carton',
    dailyTonnageMin: 200,
    dailyTonnageMax: 700,
    pricePerTonne: 50,
    attractCost: 75000,
    description: 'Consomme bois brut, produit 200-700t/jour de papier.',
    realLocations: [
      { name: 'Smurfit Kappa — Facture', lat: 44.630, lon: -0.976 },
      { name: 'Norske Skog — Golbey', lat: 48.194, lon: 6.441 },
      { name: 'Papeteries de Condat', lat: 45.072, lon: 1.220 },
      { name: 'Fibre Excellence — Saint-Gaudens', lat: 43.107, lon: 0.725 },
    ],
  },
  {
    type: 'logistics_hub',
    name: 'Plateforme logistique',
    icon: 'container',
    cargoTypes: ['containers-20', 'containers-40', 'swap-bodies', 'semi-trailers', 'parcels', 'express'],
    cargoOut: 'Colis/palettes',
    dailyTonnageMin: 400,
    dailyTonnageMax: 3000,
    pricePerTonne: 65,
    attractCost: 250000,
    description: 'Hub multimodal : 400-3000t/jour. Le cœur de la supply chain.',
    realLocations: [
      { name: 'Dourges Delta 3', lat: 50.430, lon: 2.971 },
      { name: 'Valenton — hub SNCF Fret', lat: 48.745, lon: 2.467 },
      { name: 'Perpignan — Saint-Charles', lat: 42.690, lon: 2.880 },
      { name: 'Lyon — Vénissieux', lat: 45.710, lon: 4.880 },
      { name: 'Noisy-le-Sec — hub IDF', lat: 48.895, lon: 2.462 },
    ],
  },
  {
    type: 'power_plant',
    name: 'Centrale thermique',
    icon: 'lightning',
    cargoTypes: ['coal', 'pellets', 'wood-chips', 'household-waste'],
    cargoOut: 'Cendres/résidus',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2500,
    pricePerTonne: 20,
    attractCost: 100000,
    description: 'Consomme 500-2500t/jour de charbon. Trafic régulier et prévisible.',
    realLocations: [
      { name: 'Centrale de Cordemais', lat: 47.268, lon: -1.878 },
      { name: 'Centrale du Havre', lat: 49.494, lon: 0.168 },
      { name: 'Centrale de Gardanne (biomasse)', lat: 43.454, lon: 5.470 },
    ],
  },
  {
    type: 'nuclear_plant',
    name: 'Centrale nucléaire',
    icon: 'lightning',
    cargoTypes: ['nuclear-waste', 'radioactive', 'construction-equip', 'transformer'],
    cargoOut: 'Déchets nucléaires',
    dailyTonnageMin: 10,
    dailyTonnageMax: 50,
    pricePerTonne: 2000,
    attractCost: 500000,
    description: 'Convois nucléaires très sécurisés. Faible volume, très haut revenu.',
    realLocations: [
      { name: 'La Hague — retraitement', lat: 49.680, lon: -1.879 },
      { name: 'Gravelines', lat: 50.993, lon: 2.117 },
      { name: 'Paluel', lat: 49.858, lon: 0.632 },
      { name: 'Cattenom', lat: 49.408, lon: 6.217 },
      { name: 'Tricastin', lat: 44.333, lon: 4.733 },
    ],
  },
  {
    type: 'quarry',
    name: 'Carrière / Mine',
    icon: 'cargo',
    cargoTypes: ['sand', 'gravel', 'limestone', 'ballast', 'ore', 'bauxite', 'salt'],
    cargoOut: 'Granulats',
    dailyTonnageMin: 500,
    dailyTonnageMax: 3000,
    pricePerTonne: 12,
    attractCost: 60000,
    description: 'Extraction massive de granulats et minéraux. 500-3000t/jour.',
    realLocations: [
      { name: 'GSM — Bréauté', lat: 49.629, lon: 0.397 },
      { name: 'Carrières du Boulonnais', lat: 50.719, lon: 1.630 },
      { name: 'Mines de potasse — Mulhouse', lat: 47.773, lon: 7.275 },
      { name: 'Carrières de Mauperthuis', lat: 48.728, lon: 3.073 },
    ],
  },
  {
    type: 'food_processing',
    name: 'Agro-industrie',
    icon: 'cargo',
    cargoTypes: ['sugar', 'flour', 'frozen-food', 'beverages', 'canned-food', 'sugar-beet', 'milk'],
    cargoOut: 'Produits alimentaires',
    dailyTonnageMin: 200,
    dailyTonnageMax: 1000,
    pricePerTonne: 60,
    attractCost: 100000,
    description: 'Transformation alimentaire : sucrerie, laiterie, conserverie.',
    realLocations: [
      { name: 'Tereos — Origny-Sainte-Benoite', lat: 49.833, lon: 3.517 },
      { name: 'Cristal Union — Bazancourt', lat: 49.343, lon: 3.836 },
      { name: 'Lactalis — Laval', lat: 48.073, lon: -0.768 },
      { name: 'Danone — Bailleul', lat: 50.739, lon: 2.733 },
      { name: 'Roquette — Lestrem', lat: 50.634, lon: 2.693 },
    ],
  },
  {
    type: 'waste_center',
    name: 'Centre de traitement déchets',
    icon: 'sorting',
    cargoTypes: ['household-waste', 'recyclables', 'industrial-waste', 'used-oil'],
    cargoOut: 'Matières recyclées',
    dailyTonnageMin: 200,
    dailyTonnageMax: 1500,
    pricePerTonne: 25,
    attractCost: 70000,
    description: 'Traitement et recyclage : 200-1500t/jour. Écologique.',
    realLocations: [
      { name: 'Veolia — Limay', lat: 48.993, lon: 1.742 },
      { name: 'Suez — Nanterre', lat: 48.897, lon: 2.199 },
      { name: 'Paprec — La Courneuve', lat: 48.924, lon: 2.396 },
    ],
  },
  {
    type: 'military_base',
    name: 'Base militaire',
    icon: 'hazard',
    cargoTypes: ['military', 'explosives', 'construction-equip'],
    cargoOut: 'Matériel militaire',
    dailyTonnageMin: 50,
    dailyTonnageMax: 300,
    pricePerTonne: 200,
    attractCost: 180000,
    description: 'Convois militaires sécurisés. Volume modéré, haut revenu.',
    realLocations: [
      { name: 'Base de Mourmelon', lat: 49.132, lon: 4.359 },
      { name: 'Base de Mailly', lat: 48.660, lon: 3.863 },
      { name: 'Arsenal Bourges', lat: 47.084, lon: 2.395 },
    ],
  },
  {
    type: 'glass_factory',
    name: 'Verrerie',
    icon: 'factory',
    cargoTypes: ['sand', 'limestone', 'glass', 'recyclables'],
    cargoOut: 'Verre plat/creux',
    dailyTonnageMin: 150,
    dailyTonnageMax: 500,
    pricePerTonne: 45,
    attractCost: 85000,
    description: 'Fabrication de verre : 150-500t/jour. Consomme sable et calcaire.',
    realLocations: [
      { name: 'Saint-Gobain — Chantereine', lat: 49.075, lon: 2.586 },
      { name: 'AGC — Boussois', lat: 50.293, lon: 4.048 },
      { name: 'O-I — Veauche', lat: 45.561, lon: 4.281 },
    ],
  },
  {
    type: 'wind_farm',
    name: 'Parc éolien (chantier)',
    icon: 'crane',
    cargoTypes: ['wind-blade', 'bridge-section', 'transformer', 'construction-equip'],
    cargoOut: 'Composants éoliens',
    dailyTonnageMin: 20,
    dailyTonnageMax: 100,
    pricePerTonne: 300,
    attractCost: 150000,
    description: 'Convois exceptionnels pour éoliennes. Hors gabarit.',
    realLocations: [
      { name: 'Siemens Gamesa — Le Havre', lat: 49.489, lon: 0.125 },
      { name: 'GE Renewable — Cherbourg', lat: 49.648, lon: -1.622 },
      { name: 'LM Wind Power — Cherbourg', lat: 49.641, lon: -1.615 },
    ],
  },
];

export class IndustrialClients {
  constructor() {
    this.clients = [];
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

      let remainingTonnage = client.dailyTonnage;
      let contractsToday = 0;

      while (remainingTonnage > 0 && contractsToday < 10) {
        const contractTonnage = Math.min(
          remainingTonnage,
          Math.max(50, Math.floor(remainingTonnage / (3 + Math.random() * 3)))
        );

        const toStation = otherStations[Math.floor(Math.random() * otherStations.length)];
        const revenue = Math.floor(contractTonnage * industry.pricePerTonne);
        const cargoType = industry.cargoTypes[Math.floor(Math.random() * industry.cargoTypes.length)];

        if (freightManager.contracts.filter(c => c.active).length < 30) {
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
            <div class="dash-kpi-label">Types d'industries</div>
            <div class="dash-kpi-value">${INDUSTRY_TYPES.length}</div>
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
                <span>${icon(c.icon, 16)}</span>
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
            ${(game.depotManager?.getITEs?.() || []).map(ite => {
              const station = game.world?.stations.find(s => s.id === ite.stationId);
              return `<option value="${ite.stationId}" data-depot="${ite.id}">${station?.name || '?'} — ${ite.name}</option>`;
            }).join('')}
          </select>
        </div>

        <div id="industrial-types-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">
          ${INDUSTRY_TYPES.map(ind => {
            const affordable = game.economy.balance >= ind.attractCost;
            return `<button class="industrial-attract btn-primary" data-type="${ind.type}"
              style="font-size:11px;padding:10px 14px;background:${affordable ? '#3b82f6' : '#991b1b'};text-align:left"
              ${!affordable ? 'disabled' : ''}>
              ${icon(ind.icon, 14)} <b>${ind.name}</b><br>
              <span style="font-size:9px;opacity:0.8">${ind.description}</span><br>
              <span style="font-size:10px;color:#fbbf24">${ind.attractCost.toLocaleString('fr-FR')} € • ${ind.dailyTonnageMin}-${ind.dailyTonnageMax} t/j • ${ind.pricePerTonne} €/t</span>
              ${ind.realLocations ? `<br><span style="font-size:8px;color:#94a3b8">📍 ${ind.realLocations.length} sites réels référencés</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Implantations réelles référencées</h3>
        <p style="font-size:10px;color:var(--text3);margin-bottom:8px">Sites industriels français réels avec coordonnées GPS. Utilisez-les comme référence pour positionner vos gares à proximité.</p>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.8fr 1.5fr 0.5fr 0.5fr">
            <span>Industrie</span><span>Site</span><span>Lat</span><span>Lon</span>
          </div>
          ${INDUSTRY_TYPES.filter(i => i.realLocations).flatMap(ind =>
            ind.realLocations.map(loc => `
              <div class="dash-train-row" style="grid-template-columns:0.8fr 1.5fr 0.5fr 0.5fr">
                <span style="font-size:10px">${icon(ind.icon, 12)} ${ind.name}</span>
                <span style="font-size:10px">${loc.name}</span>
                <span style="font-size:9px;color:var(--text3)">${loc.lat.toFixed(3)}</span>
                <span style="font-size:9px;color:var(--text3)">${loc.lon.toFixed(3)}</span>
              </div>
            `)
          ).join('')}
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
