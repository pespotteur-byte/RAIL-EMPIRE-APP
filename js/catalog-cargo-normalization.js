// Catalog cargo-key normalization for legacy Pack RE labels.
// User-facing names remain French; internal IDs stay stable ASCII keys.
export const CATALOG_NORMALIZATION_EXTRA_CARGO_TYPES = [
    { category: 'gaz', type: 'butadiene', name: 'Butadiène', unit: 't', pricePerUnit: 70, hazard: true, balanceStatus: 'provisional-game-balance' },
    { category: 'gaz', type: 'compressed-gas', name: 'Gaz sous pression', unit: 't', pricePerUnit: 65, hazard: true, balanceStatus: 'provisional-game-balance' },
    { category: 'marchandises', type: 'machinery', name: 'Machines et équipements', unit: 't', pricePerUnit: 55, hazard: false, balanceStatus: 'provisional-game-balance' },
];
export const CATALOG_CARGO_ALIASES = {
    'ciment': 'cement', 'sable': 'sand', 'céréales': 'grain', 'engrais': 'fertilizer-bulk',
    'maïs': 'corn', 'blé': 'wheat', 'orge': 'barley', 'soja': 'soybeans',
    'véhicules automobiles': 'vehicles', 'voitures': 'vehicles',
    'conteneurs': 'containers', 'caisses mobiles': 'swap-bodies', 'conteneurs ISO': 'containers',
    "conteneurs ISO 20'": 'containers-20', "conteneurs ISO 40'": 'containers-40',
    'semi-remorques': 'semi-trailers', 'camions': 'trucks',
    'hydrocarbures': 'oil', 'produits chimiques': 'chemicals', 'éthanol': 'ethanol',
    'gaz liquéfié': 'lpg', 'GPL': 'lpg', 'chlorure de vinyle': 'vinyl-chloride',
    'gaz sous pression': 'compressed-gas', 'butadiène': 'butadiene',
    "bobines d'acier": 'steel-coils', 'tôles': 'steel-sheet', 'produits sidérurgiques': 'steel',
    'bois': 'wood', 'machines': 'machinery', 'tubes': 'steel-pipe', 'poutrelles': 'steel-beams', 'gravier': 'gravel'
};
const norm = (list) => [...new Set((list || []).map((x) => CATALOG_CARGO_ALIASES[x] || x))];
export function normalizeCatalogCargoKeys(catalog) {
    return catalog.map(e => ({ ...e, cargoTypes: norm(e.cargoTypes), technicallyCompatibleCargoTypes: norm(e.technicallyCompatibleCargoTypes) }));
}
