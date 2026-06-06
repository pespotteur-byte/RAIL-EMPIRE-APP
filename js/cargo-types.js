/**
 * @module CargoTypes
 * Comprehensive real-world freight cargo classification.
 * No min/max limits — all quantities are unlimited.
 */
import { icon } from './icons.js';

export class CargoTypeManager {
  constructor() {
    this.categories = {
      vrac_solide: {
        name: 'Vrac solide',
        icon: 'cargo',
        description: 'Matières premières et minéraux en vrac',
        wagonType: 'trémie',
        loadingTime: 15,
        types: [
          { type: 'coal', name: 'Charbon', unit: 't', pricePerUnit: 25, hazard: false },
          { type: 'sand', name: 'Sable', unit: 't', pricePerUnit: 15, hazard: false },
          { type: 'gravel', name: 'Gravier', unit: 't', pricePerUnit: 18, hazard: false },
          { type: 'ore', name: 'Minerai de fer', unit: 't', pricePerUnit: 35, hazard: false },
          { type: 'bauxite', name: 'Bauxite', unit: 't', pricePerUnit: 30, hazard: false },
          { type: 'limestone', name: 'Calcaire', unit: 't', pricePerUnit: 12, hazard: false },
          { type: 'gypsum', name: 'Gypse', unit: 't', pricePerUnit: 14, hazard: false },
          { type: 'salt', name: 'Sel gemme', unit: 't', pricePerUnit: 20, hazard: false },
          { type: 'phosphate', name: 'Phosphate', unit: 't', pricePerUnit: 40, hazard: false },
          { type: 'potash', name: 'Potasse', unit: 't', pricePerUnit: 38, hazard: false },
          { type: 'slag', name: 'Laitier/scories', unit: 't', pricePerUnit: 8, hazard: false },
          { type: 'clinker', name: 'Clinker', unit: 't', pricePerUnit: 22, hazard: false },
          { type: 'cement', name: 'Ciment en vrac', unit: 't', pricePerUnit: 28, hazard: false },
        ],
      },
      cereales_agri: {
        name: 'Céréales & Agri',
        icon: 'silo',
        description: 'Produits agricoles et céréaliers',
        wagonType: 'trémie-céréalière',
        loadingTime: 12,
        types: [
          { type: 'wheat', name: 'Blé', unit: 't', pricePerUnit: 45, hazard: false },
          { type: 'corn', name: 'Maïs', unit: 't', pricePerUnit: 42, hazard: false },
          { type: 'barley', name: 'Orge', unit: 't', pricePerUnit: 40, hazard: false },
          { type: 'rapeseed', name: 'Colza', unit: 't', pricePerUnit: 50, hazard: false },
          { type: 'sunflower', name: 'Tournesol', unit: 't', pricePerUnit: 48, hazard: false },
          { type: 'soybeans', name: 'Soja', unit: 't', pricePerUnit: 55, hazard: false },
          { type: 'sugar-beet', name: 'Betterave sucrière', unit: 't', pricePerUnit: 22, hazard: false },
          { type: 'oilseed-meal', name: 'Tourteaux', unit: 't', pricePerUnit: 35, hazard: false },
          { type: 'animal-feed', name: 'Aliment bétail', unit: 't', pricePerUnit: 30, hazard: false },
          { type: 'fertilizer-bulk', name: 'Engrais en vrac', unit: 't', pricePerUnit: 32, hazard: false },
        ],
      },
      conteneurs: {
        name: 'Conteneurs',
        icon: 'container',
        description: 'Conteneurs ISO standard et spéciaux',
        wagonType: 'plat-conteneur',
        loadingTime: 10,
        types: [
          { type: 'containers-20', name: 'Conteneurs 20\'', unit: 'TEU', pricePerUnit: 120, hazard: false },
          { type: 'containers-40', name: 'Conteneurs 40\'', unit: 'FEU', pricePerUnit: 200, hazard: false },
          { type: 'containers-reefer', name: 'Conteneurs réfrigérés', unit: 'TEU', pricePerUnit: 350, hazard: false },
          { type: 'containers-tank', name: 'Conteneurs-citernes', unit: 'TEU', pricePerUnit: 280, hazard: false },
          { type: 'containers-open-top', name: 'Conteneurs open-top', unit: 'TEU', pricePerUnit: 140, hazard: false },
          { type: 'containers-flat-rack', name: 'Conteneurs flat-rack', unit: 'TEU', pricePerUnit: 160, hazard: false },
          { type: 'swap-bodies', name: 'Caisses mobiles', unit: 'unités', pricePerUnit: 130, hazard: false },
          { type: 'semi-trailers', name: 'Semi-remorques (autoroute ferroviaire)', unit: 'unités', pricePerUnit: 180, hazard: false },
        ],
      },
      liquides: {
        name: 'Liquides',
        icon: 'oil',
        description: 'Produits liquides (pétrole, chimie, alimentaire)',
        wagonType: 'citerne',
        loadingTime: 20,
        types: [
          { type: 'crude-oil', name: 'Pétrole brut', unit: 'm³', pricePerUnit: 90, hazard: true },
          { type: 'diesel', name: 'Diesel/gasoil', unit: 'm³', pricePerUnit: 95, hazard: true },
          { type: 'gasoline', name: 'Essence', unit: 'm³', pricePerUnit: 100, hazard: true },
          { type: 'jet-fuel', name: 'Kérosène', unit: 'm³', pricePerUnit: 110, hazard: true },
          { type: 'fuel-oil', name: 'Fioul lourd', unit: 'm³', pricePerUnit: 75, hazard: true },
          { type: 'lpg', name: 'GPL (gaz liquéfié)', unit: 'm³', pricePerUnit: 220, hazard: true },
          { type: 'ethanol', name: 'Éthanol/biocarburant', unit: 'm³', pricePerUnit: 130, hazard: true },
          { type: 'chemicals-liq', name: 'Produits chimiques liquides', unit: 'm³', pricePerUnit: 180, hazard: true },
          { type: 'acids', name: 'Acides (sulfurique, chlorhydrique)', unit: 'm³', pricePerUnit: 200, hazard: true },
          { type: 'food-oil', name: 'Huile alimentaire', unit: 'm³', pricePerUnit: 130, hazard: false },
          { type: 'milk', name: 'Lait en vrac', unit: 'm³', pricePerUnit: 85, hazard: false },
          { type: 'wine-bulk', name: 'Vin en vrac', unit: 'm³', pricePerUnit: 150, hazard: false },
          { type: 'molasses', name: 'Mélasse', unit: 'm³', pricePerUnit: 60, hazard: false },
          { type: 'water-industrial', name: 'Eau industrielle', unit: 'm³', pricePerUnit: 10, hazard: false },
        ],
      },
      gaz: {
        name: 'Gaz',
        icon: 'hazard',
        description: 'Gaz comprimés et liquéfiés',
        wagonType: 'citerne-pression',
        loadingTime: 25,
        types: [
          { type: 'lng', name: 'GNL (gaz naturel liquéfié)', unit: 'm³', pricePerUnit: 250, hazard: true },
          { type: 'chlorine', name: 'Chlore', unit: 't', pricePerUnit: 300, hazard: true },
          { type: 'ammonia', name: 'Ammoniac', unit: 't', pricePerUnit: 180, hazard: true },
          { type: 'oxygen', name: 'Oxygène liquide', unit: 'm³', pricePerUnit: 120, hazard: true },
          { type: 'nitrogen', name: 'Azote liquide', unit: 'm³', pricePerUnit: 100, hazard: false },
          { type: 'co2', name: 'CO₂ liquide', unit: 't', pricePerUnit: 80, hazard: false },
        ],
      },
      dangereux: {
        name: 'Matières dangereuses',
        icon: 'warning',
        description: 'Transport réglementé TMD/RID — procédures spéciales',
        wagonType: 'spécial-TMD',
        loadingTime: 30,
        types: [
          { type: 'explosives', name: 'Explosifs (cl.1)', unit: 't', pricePerUnit: 500, hazard: true },
          { type: 'flammable-gas', name: 'Gaz inflammables (cl.2.1)', unit: 't', pricePerUnit: 280, hazard: true },
          { type: 'flammable-liq', name: 'Liquides inflammables (cl.3)', unit: 't', pricePerUnit: 200, hazard: true },
          { type: 'flammable-solid', name: 'Solides inflammables (cl.4)', unit: 't', pricePerUnit: 220, hazard: true },
          { type: 'oxidizers', name: 'Comburants (cl.5)', unit: 't', pricePerUnit: 250, hazard: true },
          { type: 'toxic', name: 'Toxiques (cl.6)', unit: 't', pricePerUnit: 350, hazard: true },
          { type: 'radioactive', name: 'Radioactif (cl.7)', unit: 't', pricePerUnit: 1200, hazard: true },
          { type: 'corrosive', name: 'Corrosifs (cl.8)', unit: 't', pricePerUnit: 250, hazard: true },
          { type: 'misc-dangerous', name: 'Divers dangereux (cl.9)', unit: 't', pricePerUnit: 180, hazard: true },
        ],
      },
      siderurgie: {
        name: 'Sidérurgie & Métaux',
        icon: 'wrench',
        description: 'Produits métallurgiques et métaux',
        wagonType: 'plat-lourd',
        loadingTime: 20,
        types: [
          { type: 'steel-coils', name: 'Bobines d\'acier', unit: 't', pricePerUnit: 80, hazard: false },
          { type: 'steel-beams', name: 'Poutrelles/profilés', unit: 't', pricePerUnit: 65, hazard: false },
          { type: 'steel-sheet', name: 'Tôles d\'acier', unit: 't', pricePerUnit: 70, hazard: false },
          { type: 'steel-wire', name: 'Fil machine/barres', unit: 't', pricePerUnit: 75, hazard: false },
          { type: 'steel-pipe', name: 'Tubes d\'acier', unit: 't', pricePerUnit: 85, hazard: false },
          { type: 'aluminum', name: 'Aluminium', unit: 't', pricePerUnit: 110, hazard: false },
          { type: 'copper', name: 'Cuivre', unit: 't', pricePerUnit: 250, hazard: false },
          { type: 'scrap-metal', name: 'Ferraille', unit: 't', pricePerUnit: 25, hazard: false },
          { type: 'cast-iron', name: 'Fonte brute', unit: 't', pricePerUnit: 45, hazard: false },
        ],
      },
      automobiles: {
        name: 'Automobiles',
        icon: 'car',
        description: 'Véhicules neufs et engins',
        wagonType: 'porte-auto',
        loadingTime: 25,
        types: [
          { type: 'cars', name: 'Voitures neuves', unit: 'unités', pricePerUnit: 180, hazard: false },
          { type: 'trucks', name: 'Camions/utilitaires', unit: 'unités', pricePerUnit: 400, hazard: false },
          { type: 'vans', name: 'Fourgons', unit: 'unités', pricePerUnit: 250, hazard: false },
          { type: 'construction-equip', name: 'Engins de chantier', unit: 'unités', pricePerUnit: 600, hazard: false },
          { type: 'tractors', name: 'Tracteurs agricoles', unit: 'unités', pricePerUnit: 350, hazard: false },
        ],
      },
      bois: {
        name: 'Bois & Papier',
        icon: 'wood',
        description: 'Bois brut, transformé et produits papetiers',
        wagonType: 'plat-ranchers',
        loadingTime: 15,
        types: [
          { type: 'timber', name: 'Bois ronds/grumes', unit: 't', pricePerUnit: 30, hazard: false },
          { type: 'sawn-wood', name: 'Bois scié/planches', unit: 't', pricePerUnit: 50, hazard: false },
          { type: 'plywood', name: 'Contreplaqué/panneaux', unit: 't', pricePerUnit: 60, hazard: false },
          { type: 'pulp', name: 'Pâte à papier', unit: 't', pricePerUnit: 55, hazard: false },
          { type: 'paper', name: 'Rouleaux de papier', unit: 't', pricePerUnit: 75, hazard: false },
          { type: 'cardboard', name: 'Carton ondulé', unit: 't', pricePerUnit: 65, hazard: false },
          { type: 'wood-chips', name: 'Plaquettes forestières', unit: 't', pricePerUnit: 20, hazard: false },
          { type: 'pellets', name: 'Granulés bois (pellets)', unit: 't', pricePerUnit: 40, hazard: false },
        ],
      },
      btp: {
        name: 'BTP & Construction',
        icon: 'track',
        description: 'Matériaux de construction et génie civil',
        wagonType: 'plat-lourd',
        loadingTime: 18,
        types: [
          { type: 'concrete-blocks', name: 'Parpaings/blocs béton', unit: 't', pricePerUnit: 16, hazard: false },
          { type: 'precast', name: 'Éléments préfabriqués béton', unit: 't', pricePerUnit: 35, hazard: false },
          { type: 'bricks', name: 'Briques/tuiles', unit: 't', pricePerUnit: 20, hazard: false },
          { type: 'asphalt', name: 'Enrobé/bitume', unit: 't', pricePerUnit: 25, hazard: false },
          { type: 'glass', name: 'Verre plat', unit: 't', pricePerUnit: 80, hazard: false },
          { type: 'insulation', name: 'Isolants', unit: 't', pricePerUnit: 45, hazard: false },
          { type: 'rails', name: 'Rails/traverses', unit: 't', pricePerUnit: 55, hazard: false },
          { type: 'ballast', name: 'Ballast ferroviaire', unit: 't', pricePerUnit: 10, hazard: false },
        ],
      },
      alimentaire: {
        name: 'Alimentaire',
        icon: 'cargo',
        description: 'Produits alimentaires transformés et frais',
        wagonType: 'couvert-réfrigéré',
        loadingTime: 12,
        types: [
          { type: 'sugar', name: 'Sucre', unit: 't', pricePerUnit: 50, hazard: false },
          { type: 'flour', name: 'Farine', unit: 't', pricePerUnit: 40, hazard: false },
          { type: 'frozen-food', name: 'Surgelés', unit: 't', pricePerUnit: 120, hazard: false },
          { type: 'beverages', name: 'Boissons (palettes)', unit: 't', pricePerUnit: 70, hazard: false },
          { type: 'canned-food', name: 'Conserves', unit: 't', pricePerUnit: 55, hazard: false },
          { type: 'fresh-produce', name: 'Fruits & légumes frais', unit: 't', pricePerUnit: 90, hazard: false },
          { type: 'meat', name: 'Viande réfrigérée', unit: 't', pricePerUnit: 150, hazard: false },
          { type: 'dairy', name: 'Produits laitiers', unit: 't', pricePerUnit: 85, hazard: false },
        ],
      },
      chimie: {
        name: 'Chimie & Plasturgie',
        icon: 'chemistry',
        description: 'Produits chimiques solides, plastiques, engrais',
        wagonType: 'couvert',
        loadingTime: 15,
        types: [
          { type: 'plastic-granules', name: 'Granulés plastique', unit: 't', pricePerUnit: 90, hazard: false },
          { type: 'fertilizer-bag', name: 'Engrais ensachés', unit: 't', pricePerUnit: 35, hazard: false },
          { type: 'chemicals-dry', name: 'Produits chimiques secs', unit: 't', pricePerUnit: 120, hazard: false },
          { type: 'paint', name: 'Peintures/résines', unit: 't', pricePerUnit: 140, hazard: true },
          { type: 'rubber', name: 'Caoutchouc', unit: 't', pricePerUnit: 70, hazard: false },
          { type: 'tires', name: 'Pneumatiques', unit: 't', pricePerUnit: 60, hazard: false },
          { type: 'pharma', name: 'Produits pharmaceutiques', unit: 't', pricePerUnit: 300, hazard: false },
        ],
      },
      dechets: {
        name: 'Déchets & Recyclage',
        icon: 'sorting',
        description: 'Déchets ménagers, industriels et recyclables',
        wagonType: 'couvert-déchets',
        loadingTime: 15,
        types: [
          { type: 'household-waste', name: 'Ordures ménagères', unit: 't', pricePerUnit: 15, hazard: false },
          { type: 'recyclables', name: 'Recyclables triés', unit: 't', pricePerUnit: 25, hazard: false },
          { type: 'industrial-waste', name: 'Déchets industriels', unit: 't', pricePerUnit: 40, hazard: false },
          { type: 'nuclear-waste', name: 'Déchets nucléaires', unit: 't', pricePerUnit: 2000, hazard: true },
          { type: 'used-oil', name: 'Huiles usagées', unit: 'm³', pricePerUnit: 30, hazard: true },
        ],
      },
      exceptionnel: {
        name: 'Convois exceptionnels',
        icon: 'crane',
        description: 'Charges lourdes, hors gabarit, pièces industrielles',
        wagonType: 'surbaissé',
        loadingTime: 40,
        types: [
          { type: 'transformer', name: 'Transformateur électrique', unit: 'unités', pricePerUnit: 5000, hazard: false },
          { type: 'turbine', name: 'Turbine/générateur', unit: 'unités', pricePerUnit: 8000, hazard: false },
          { type: 'reactor-vessel', name: 'Cuve de réacteur', unit: 'unités', pricePerUnit: 15000, hazard: false },
          { type: 'wind-blade', name: 'Pales d\'éolienne', unit: 'unités', pricePerUnit: 3000, hazard: false },
          { type: 'bridge-section', name: 'Éléments de pont', unit: 'unités', pricePerUnit: 4000, hazard: false },
          { type: 'military', name: 'Matériel militaire', unit: 't', pricePerUnit: 500, hazard: false },
        ],
      },
      courrier: {
        name: 'Courrier & Colis',
        icon: 'container',
        description: 'Courrier postal, colis express, e-commerce',
        wagonType: 'fourgon-postal',
        loadingTime: 8,
        types: [
          { type: 'mail', name: 'Courrier postal', unit: 't', pricePerUnit: 200, hazard: false },
          { type: 'parcels', name: 'Colis e-commerce', unit: 't', pricePerUnit: 250, hazard: false },
          { type: 'express', name: 'Express/messagerie', unit: 't', pricePerUnit: 400, hazard: false },
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

  // Add a cargo type if it is not already present (idempotent).
  // Used when importing catalog material that references a cargo not yet in the game.
  // Returns true if a new type was actually added.
  ensureType(categoryKey, typeObj) {
    if (!categoryKey || !typeObj || !typeObj.type) return false;
    if (this.getTypeInfo(typeObj.type)) return false;
    let cat = this.categories[categoryKey];
    if (!cat) {
      cat = this.categories[categoryKey] = {
        name: typeObj.categoryName || categoryKey,
        icon: typeObj.icon || 'cargo',
        description: typeObj.description || '',
        wagonType: typeObj.wagonType || 'spécial',
        loadingTime: typeObj.loadingTime || 15,
        types: [],
      };
    }
    cat.types.push({
      type: typeObj.type,
      name: typeObj.name || typeObj.type,
      unit: typeObj.unit || 't',
      pricePerUnit: typeObj.pricePerUnit ?? 0,
      hazard: !!typeObj.hazard,
    });
    return true;
  }

  getAllTypes() {
    const all = [];
    for (const [catKey, cat] of Object.entries(this.categories)) {
      for (const t of cat.types) {
        all.push({ ...t, category: catKey, categoryName: cat.name, icon: cat.icon, wagonType: cat.wagonType, loadingTime: cat.loadingTime });
      }
    }
    return all;
  }

  getTypeInfo(cargoType) {
    for (const [catKey, cat] of Object.entries(this.categories)) {
      const found = cat.types.find(t => t.type === cargoType);
      if (found) return { ...found, category: catKey, categoryName: cat.name, icon: cat.icon, wagonType: cat.wagonType, loadingTime: cat.loadingTime };
    }
    return null;
  }

  getCategoryForType(cargoType) {
    for (const [catKey, cat] of Object.entries(this.categories)) {
      if (cat.types.some(t => t.type === cargoType)) return catKey;
    }
    return null;
  }

  isHazardous(cargoType) {
    const info = this.getTypeInfo(cargoType);
    return info?.hazard || false;
  }

  getLoadingTime(cargoType) {
    const info = this.getTypeInfo(cargoType);
    return info?.loadingTime || 10;
  }

  recordContract(cargoType, quantity, revenue, countContract = true) {
    if (countContract) this.stats.totalContracts++;
    this.stats.totalTonnage += quantity;
    this.stats.totalRevenue += revenue;
    const cat = this.getCategoryForType(cargoType) || 'other';
    if (!this.stats.byCategory[cat]) this.stats.byCategory[cat] = { contracts: 0, tonnage: 0, revenue: 0 };
    if (countContract) this.stats.byCategory[cat].contracts++;
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
          <h3>${icon(cat.icon, 16)} ${cat.name} (${cat.types.length})</h3>
          <p style="font-size:11px;color:var(--text3);margin-bottom:8px">${cat.description}</p>
          <p style="font-size:10px;color:var(--text3);margin-bottom:6px">
            Wagon : <b>${cat.wagonType}</b> •
            Temps chargement : <b>${cat.loadingTime} min</b>
          </p>
          <div class="dash-train-table">
            <div class="dash-train-header" style="grid-template-columns:1.5fr 0.5fr 0.6fr 0.5fr">
              <span>Marchandise</span><span>Unité</span><span>Prix/unité</span><span>TMD</span>
            </div>
            ${cat.types.map(t => `
              <div class="dash-train-row" style="grid-template-columns:1.5fr 0.5fr 0.6fr 0.5fr">
                <span>${t.name}</span>
                <span>${t.unit}</span>
                <span style="color:var(--green)">${t.pricePerUnit} €</span>
                <span style="color:${t.hazard ? '#ef4444' : 'var(--text3)'}">${t.hazard ? icon('warning',12) + ' Oui' : '—'}</span>
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
