/**
 * CargoTypes — Extended cargo type system with wagon requirements and constraints.
 * Enhances the freight system with realistic cargo categories.
 */
export class CargoTypeManager {
  constructor() {
    this.categories = {
      vrac: {
        name: 'Vrac',
        icon: '🪨',
        description: 'Matières en vrac (charbon, sable, gravier, minerai)',
        wagonType: 'trémie',
        speedLimit: null,
        loadingTime: 15, // minutes
        types: [
          { type: 'coal', name: 'Charbon', unit: 't', minQty: 100, maxQty: 800, pricePerUnit: 25, hazard: false },
          { type: 'sand', name: 'Sable', unit: 't', minQty: 80, maxQty: 600, pricePerUnit: 15, hazard: false },
          { type: 'gravel', name: 'Gravier', unit: 't', minQty: 100, maxQty: 700, pricePerUnit: 18, hazard: false },
          { type: 'ore', name: 'Minerai de fer', unit: 't', minQty: 150, maxQty: 1000, pricePerUnit: 35, hazard: false },
          { type: 'cereals', name: 'Céréales', unit: 't', minQty: 60, maxQty: 500, pricePerUnit: 45, hazard: false },
        ],
      },
      conteneurs: {
        name: 'Conteneurs',
        icon: '📦',
        description: 'Conteneurs ISO standard (20\' et 40\')',
        wagonType: 'plat',
        speedLimit: null,
        loadingTime: 10,
        types: [
          { type: 'containers-20', name: 'Conteneurs 20\'', unit: 'TEU', minQty: 20, maxQty: 200, pricePerUnit: 120, hazard: false },
          { type: 'containers-40', name: 'Conteneurs 40\'', unit: 'FEU', minQty: 10, maxQty: 100, pricePerUnit: 200, hazard: false },
          { type: 'containers-reefer', name: 'Conteneurs réfrigérés', unit: 'TEU', minQty: 5, maxQty: 50, pricePerUnit: 350, hazard: false },
        ],
      },
      liquides: {
        name: 'Liquides',
        icon: '🛢️',
        description: 'Produits liquides (carburant, chimie, alimentaire)',
        wagonType: 'citerne',
        speedLimit: 80,
        loadingTime: 20,
        types: [
          { type: 'fuel', name: 'Carburant', unit: 'm³', minQty: 30, maxQty: 200, pricePerUnit: 95, hazard: true },
          { type: 'chemicals-liq', name: 'Chimie liquide', unit: 'm³', minQty: 20, maxQty: 120, pricePerUnit: 180, hazard: true },
          { type: 'food-oil', name: 'Huile alimentaire', unit: 'm³', minQty: 15, maxQty: 80, pricePerUnit: 130, hazard: false },
          { type: 'lpg', name: 'GPL', unit: 'm³', minQty: 20, maxQty: 100, pricePerUnit: 220, hazard: true },
        ],
      },
      dangereux: {
        name: 'Matières dangereuses',
        icon: '☢️',
        description: 'Transport réglementé (TMD) — vitesse réduite obligatoire',
        wagonType: 'spécial',
        speedLimit: 60,
        loadingTime: 30,
        types: [
          { type: 'explosives', name: 'Explosifs (cl.1)', unit: 't', minQty: 5, maxQty: 30, pricePerUnit: 500, hazard: true },
          { type: 'toxic', name: 'Toxiques (cl.6)', unit: 't', minQty: 10, maxQty: 50, pricePerUnit: 350, hazard: true },
          { type: 'radioactive', name: 'Radioactif (cl.7)', unit: 't', minQty: 2, maxQty: 15, pricePerUnit: 1200, hazard: true },
          { type: 'corrosive', name: 'Corrosifs (cl.8)', unit: 't', minQty: 10, maxQty: 60, pricePerUnit: 250, hazard: true },
        ],
      },
      automobiles: {
        name: 'Automobiles',
        icon: '🚗',
        description: 'Transport de véhicules neufs sur wagons porte-autos',
        wagonType: 'porte-auto',
        speedLimit: 100,
        loadingTime: 25,
        types: [
          { type: 'cars', name: 'Voitures neuves', unit: 'unités', minQty: 20, maxQty: 200, pricePerUnit: 180, hazard: false },
          { type: 'trucks', name: 'Camions', unit: 'unités', minQty: 5, maxQty: 40, pricePerUnit: 400, hazard: false },
        ],
      },
      siderurgie: {
        name: 'Sidérurgie',
        icon: '🔩',
        description: 'Produits métallurgiques (bobines, poutrelles, tôles)',
        wagonType: 'plat-lourd',
        speedLimit: null,
        loadingTime: 20,
        types: [
          { type: 'steel-coils', name: 'Bobines d\'acier', unit: 't', minQty: 50, maxQty: 400, pricePerUnit: 80, hazard: false },
          { type: 'steel-beams', name: 'Poutrelles', unit: 't', minQty: 30, maxQty: 250, pricePerUnit: 65, hazard: false },
          { type: 'aluminum', name: 'Aluminium', unit: 't', minQty: 20, maxQty: 150, pricePerUnit: 110, hazard: false },
        ],
      },
      bois: {
        name: 'Bois & Papier',
        icon: '🪵',
        description: 'Bois de construction, pâte à papier, papier',
        wagonType: 'plat',
        speedLimit: null,
        loadingTime: 15,
        types: [
          { type: 'timber', name: 'Bois brut', unit: 't', minQty: 50, maxQty: 400, pricePerUnit: 30, hazard: false },
          { type: 'pulp', name: 'Pâte à papier', unit: 't', minQty: 40, maxQty: 300, pricePerUnit: 55, hazard: false },
          { type: 'paper', name: 'Rouleaux de papier', unit: 't', minQty: 20, maxQty: 150, pricePerUnit: 75, hazard: false },
        ],
      },
    };

    this.stats = {
      totalContracts: 0,
      totalTonnage: 0,
      totalRevenue: 0,
      byCategory: {},
    };
  }

  getAllTypes() {
    const all = [];
    for (const [catKey, cat] of Object.entries(this.categories)) {
      for (const t of cat.types) {
        all.push({ ...t, category: catKey, categoryName: cat.name, icon: cat.icon, wagonType: cat.wagonType, speedLimit: cat.speedLimit, loadingTime: cat.loadingTime });
      }
    }
    return all;
  }

  getTypeInfo(cargoType) {
    for (const [catKey, cat] of Object.entries(this.categories)) {
      const found = cat.types.find(t => t.type === cargoType);
      if (found) return { ...found, category: catKey, categoryName: cat.name, icon: cat.icon, wagonType: cat.wagonType, speedLimit: cat.speedLimit, loadingTime: cat.loadingTime };
    }
    return null;
  }

  getCategoryForType(cargoType) {
    for (const [catKey, cat] of Object.entries(this.categories)) {
      if (cat.types.some(t => t.type === cargoType)) return catKey;
    }
    return null;
  }

  getSpeedLimit(cargoType) {
    const info = this.getTypeInfo(cargoType);
    return info?.speedLimit || null;
  }

  isHazardous(cargoType) {
    const info = this.getTypeInfo(cargoType);
    return info?.hazard || false;
  }

  getLoadingTime(cargoType) {
    const info = this.getTypeInfo(cargoType);
    return info?.loadingTime || 10;
  }

  recordContract(cargoType, quantity, revenue) {
    this.stats.totalContracts++;
    this.stats.totalTonnage += quantity;
    this.stats.totalRevenue += revenue;
    const cat = this.getCategoryForType(cargoType) || 'other';
    if (!this.stats.byCategory[cat]) this.stats.byCategory[cat] = { contracts: 0, tonnage: 0, revenue: 0 };
    this.stats.byCategory[cat].contracts++;
    this.stats.byCategory[cat].tonnage += quantity;
    this.stats.byCategory[cat].revenue += revenue;
  }

  render(container, game) {
    if (!container) return;

    const allTypes = this.getAllTypes();
    const activeContracts = game.freightManager?.contracts?.filter(c => c.active) || [];

    container.innerHTML = `
      <div class="dash-section">
        <h3>Types de Marchandises</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Catégories</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${Object.keys(this.categories).length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Types de cargo</div>
            <div class="dash-kpi-value">${allTypes.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Contrats réalisés</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.stats.totalContracts}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Tonnage total</div>
            <div class="dash-kpi-value">${this.stats.totalTonnage.toLocaleString('fr-FR')} t</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Revenus fret total</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.stats.totalRevenue.toLocaleString('fr-FR')} €</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Contrats actifs</div>
            <div class="dash-kpi-value" style="color:#f97316">${activeContracts.length}</div>
          </div>
        </div>
      </div>

      ${Object.entries(this.categories).map(([key, cat]) => `
        <div class="dash-section">
          <h3>${cat.icon} ${cat.name}</h3>
          <p style="font-size:11px;color:var(--text3);margin-bottom:8px">${cat.description}</p>
          <p style="font-size:10px;color:var(--text3);margin-bottom:6px">
            Wagon requis : <b>${cat.wagonType}</b> •
            ${cat.speedLimit ? `Vitesse max : <b style="color:#ef4444">${cat.speedLimit} km/h</b> •` : ''}
            Temps chargement : <b>${cat.loadingTime} min</b>
          </p>
          <div class="dash-train-table">
            <div class="dash-train-header" style="grid-template-columns:1.5fr 0.6fr 0.8fr 0.8fr 0.6fr">
              <span>Marchandise</span><span>Unité</span><span>Qté min-max</span><span>Prix/unité</span><span>TMD</span>
            </div>
            ${cat.types.map(t => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 0.6fr 0.8fr 0.8fr 0.6fr">
                <span>${t.name}</span>
                <span>${t.unit}</span>
                <span>${t.minQty}-${t.maxQty}</span>
                <span style="color:var(--green)">${t.pricePerUnit} €</span>
                <span style="color:${t.hazard ? '#ef4444' : 'var(--text3)'}">${t.hazard ? '⚠️ Oui' : '—'}</span>
              </div>
            `).join('')}
          </div>
          ${this.stats.byCategory[key] ? `
            <div style="margin-top:6px;font-size:10px;color:var(--text3)">
              ${this.stats.byCategory[key].contracts} contrats • ${this.stats.byCategory[key].tonnage.toLocaleString('fr-FR')} t • ${this.stats.byCategory[key].revenue.toLocaleString('fr-FR')} €
            </div>
          ` : ''}
        </div>
      `).join('')}
    `;
  }

  toSave() {
    return { stats: this.stats };
  }

  loadFromSave(s) {
    if (!s) return;
    this.stats = s.stats || { totalContracts: 0, totalTonnage: 0, totalRevenue: 0, byCategory: {} };
  }
}
