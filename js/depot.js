import { cantonManager } from './schedule-creator.js';
import { validRescueMotion, RescueMovement } from './rescue-movement.js';
import { advanceMaterialMileage } from './material-mileage.js';
import { rescuePoint, rescueDistanceKm, validatedRescueRoute, rescueRouteFailure, RESCUE_ENDPOINT_TOLERANCE_KM } from './rescue-route-contract.js';
import { normalizeRailSection, cleanRailRoute, cleanRailBinding, cloneRailValue } from './rail-section-geometry.js';
import { Rame } from './rame.js';
let nextDepotId = 1;
let nextRescueId = 1;
// HOTFIX50 — operational depot system. Prices are gameplay/economy parameters
// kept in one catalogue so balancing can be changed without rewriting UI logic.
export const DEPOT_RESOURCE_CATALOG = Object.freeze({
    diesel_l: { label: 'Gazole', unit: 'L', price: 1.45, stock: true, defaultCapacity: 100000, category: 'Avitaillement' },
    sand_kg: { label: 'Sable de sablière', unit: 'kg', price: 0.12, stock: true, defaultCapacity: 20000, category: 'Avitaillement' },
    engine_oil_l: { label: 'Huile moteur', unit: 'L', price: 7.50, stock: true, defaultCapacity: 5000, category: 'Fluides' },
    gearbox_oil_l: { label: 'Huile de transmission / réducteur', unit: 'L', price: 8.40, stock: true, defaultCapacity: 3500, category: 'Fluides' },
    hydraulic_oil_l: { label: 'Huile hydraulique', unit: 'L', price: 6.80, stock: true, defaultCapacity: 3500, category: 'Fluides' },
    coolant_l: { label: 'Liquide de refroidissement', unit: 'L', price: 4.20, stock: true, defaultCapacity: 5000, category: 'Fluides' },
    adblue_l: { label: 'AdBlue', unit: 'L', price: 0.95, stock: true, defaultCapacity: 5000, category: 'Avitaillement' },
    washer_fluid_l: { label: 'Liquide lave-glace', unit: 'L', price: 1.80, stock: true, defaultCapacity: 2500, category: 'Fluides' },
    grease_kg: { label: 'Graisse / lubrifiant ferroviaire', unit: 'kg', price: 6.50, stock: true, defaultCapacity: 1500, category: 'Atelier' },
    penetrating_oil_l: { label: 'Dégrippant / huile fine', unit: 'L', price: 9.50, stock: true, defaultCapacity: 500, category: 'Atelier' },
    brake_cleaner_l: { label: 'Nettoyant frein / dégraissant', unit: 'L', price: 5.90, stock: true, defaultCapacity: 1000, category: 'Atelier' },
    detergent_l: { label: 'Produit lavage extérieur', unit: 'L', price: 2.80, stock: true, defaultCapacity: 3000, category: 'Nettoyage' },
    interior_cleaner_l: { label: 'Produit nettoyage intérieur', unit: 'L', price: 3.20, stock: true, defaultCapacity: 2000, category: 'Nettoyage' },
    disinfectant_l: { label: 'Désinfectant intérieur', unit: 'L', price: 4.60, stock: true, defaultCapacity: 1200, category: 'Nettoyage' },
    toilet_chemical_l: { label: 'Produit sanitaire / WC', unit: 'L', price: 3.90, stock: true, defaultCapacity: 1500, category: 'Sanitaires' },
    absorbent_kg: { label: 'Absorbant atelier', unit: 'kg', price: 1.90, stock: true, defaultCapacity: 1000, category: 'Atelier' },
    deicer_l: { label: 'Produit dégivrant', unit: 'L', price: 2.60, stock: true, defaultCapacity: 2500, category: 'Hiver' },
    water_l: { label: 'Eau réseau', unit: 'L', price: 0.004, stock: false, defaultCapacity: 0, category: 'Réseaux' },
    electricity_kwh: { label: 'Électricité', unit: 'kWh', price: 0.25, stock: false, defaultCapacity: 0, category: 'Réseaux' },
    compressed_air_m3: { label: 'Air comprimé', unit: 'm³', price: 0.08, stock: false, defaultCapacity: 0, category: 'Réseaux' },
    wastewater_l: { label: 'Traitement eaux usées', unit: 'L', price: 0.003, stock: false, defaultCapacity: 0, category: 'Réseaux' },
});
export const DEPOT_STAFF_CATALOG = Object.freeze({
    chef_equipe: { label: 'Chef d’équipe maintenance', category: 'Encadrement' },
    agent_manoeuvre: { label: 'Agent de manœuvre dépôt', category: 'Exploitation' },
    agent_visite: { label: 'Agent de visite', category: 'Maintenance' },
    agent_maintenance: { label: 'Agent de maintenance', category: 'Maintenance' },
    electromecanicien: { label: 'Électromécanicien', category: 'Maintenance' },
    mecanicien_diesel: { label: 'Mécanicien diesel', category: 'Traction thermique' },
    technicien_traction_elec: { label: 'Technicien traction électrique', category: 'Traction électrique' },
    technicien_pneumatique: { label: 'Technicien pneumatique', category: 'Freinage' },
    specialiste_freinage: { label: 'Spécialiste freinage', category: 'Freinage' },
    specialiste_essieux: { label: 'Spécialiste essieux / reprofilage', category: 'Roulement' },
    agent_levage: { label: 'Agent levage / bogies', category: 'Maintenance lourde' },
    technicien_hvac: { label: 'Technicien climatisation / HVAC', category: 'Confort' },
    chaudronnier_soudeur: { label: 'Chaudronnier / soudeur', category: 'Caisse' },
    electricien_bord: { label: 'Électricien matériel roulant', category: 'Électrique' },
    agent_avitaillement: { label: 'Agent d’avitaillement', category: 'Avitaillement' },
    agent_lavage: { label: 'Agent de lavage extérieur', category: 'Nettoyage' },
    agent_nettoyage: { label: 'Agent de nettoyage intérieur', category: 'Nettoyage' },
    agent_assainissement: { label: 'Agent sanitaires / assainissement', category: 'Nettoyage' },
    magasinier: { label: 'Magasinier pièces & consommables', category: 'Logistique' },
});
export const DEPOT_EQUIPMENT_CATALOG = Object.freeze({
    inspection_pit: { label: 'Fosse de visite', category: 'Atelier', price: 180000, maxCount: 4, description: 'Inspection sous caisse, entretien courant et organes bas.' },
    lifting_jacks: { label: 'Rampes / vérins de levage', category: 'Levage', price: 420000, maxCount: 3, description: 'Levage d’une rame ou d’un véhicule pour travaux lourds.' },
    underfloor_lathe: { label: 'Tour en fosse', category: 'Essieux', price: 950000, maxCount: 2, description: 'Reprofilage des roues sans démontage complet des essieux.' },
    wash_plant: { label: 'Station de lavage extérieur', category: 'Nettoyage', price: 360000, maxCount: 3, description: 'Portique / tunnel de lavage du matériel roulant.' },
    interior_cleaning: { label: 'Poste de nettoyage intérieur', category: 'Nettoyage', price: 90000, maxCount: 6, description: 'Quai équipé eau/électricité pour nettoyage voyageurs.' },
    fuel_station: { label: 'Station-service gazole', category: 'Avitaillement', price: 310000, maxCount: 3, description: 'Distribution sécurisée de gazole au matériel thermique.' },
    sand_station: { label: 'Station de remplissage des sablières', category: 'Avitaillement', price: 125000, maxCount: 4, description: 'Stockage et distribution de sable sec.' },
    fluid_station: { label: 'Poste fluides & lubrifiants', category: 'Avitaillement', price: 145000, maxCount: 4, description: 'Huiles, refroidissement, lave-glace et autres fluides.' },
    toilet_service: { label: 'Station sanitaires / vidange WC', category: 'Nettoyage', price: 210000, maxCount: 3, description: 'Vidange, rinçage et réapprovisionnement sanitaire.' },
    overhead_crane: { label: 'Pont roulant atelier', category: 'Levage', price: 380000, maxCount: 3, description: 'Dépose de moteurs, HVAC et organes lourds.' },
    brake_bench: { label: 'Banc freinage & pneumatique', category: 'Freinage', price: 265000, maxCount: 3, description: 'Contrôle et intervention sur freinage et circuit pneumatique.' },
    roof_access: { label: 'Passerelle toiture / accès pantographes', category: 'Électrique', price: 195000, maxCount: 4, description: 'Accès sécurisé aux équipements de toiture.' },
    electrical_bench: { label: 'Banc électrique / électronique', category: 'Électrique', price: 230000, maxCount: 4, description: 'Diagnostic traction, auxiliaires, batteries et électronique.' },
    bogie_drop: { label: 'Table de descente bogie', category: 'Bogies', price: 780000, maxCount: 2, description: 'Dépose d’un bogie sous véhicule.' },
    compressor_station: { label: 'Réseau / centrale d’air comprimé', category: 'Atelier', price: 160000, maxCount: 2, description: 'Air comprimé pour atelier, essais et outillage.' },
    deicing_station: { label: 'Station de dégivrage', category: 'Hiver', price: 280000, maxCount: 2, description: 'Traitement du matériel en conditions hivernales.' },
    battery_station: { label: 'Poste batteries / charge & essai', category: 'Électrique', price: 105000, maxCount: 3, description: 'Charge, contrôle et remplacement des batteries auxiliaires.' },
});
export const DEPOT_TRACK_EXPANSION_COST = 30000;
export const DEPOT_PART_CATALOG = Object.freeze([
    { id: 'engine_mtu_16v4000_r41', label: 'MTU 16V 4000 R41 — moteur diesel', category: 'Moteurs', price: 180000, match: /BB\s*(?:75000|75100|75300)/i, realModel: true },
    { id: 'engine_mtu_4000_r43l', label: 'MTU 4000 R43L — moteur diesel', category: 'Moteurs', price: 210000, match: /BB\s*75400/i, realModel: true },
    { id: 'engine_emd_12n710g3b_ec', label: 'EMD 12N-710G3B-EC — moteur diesel', category: 'Moteurs', price: 220000, match: /(Class\s*66|JT42CWR)/i, realModel: true },
    { id: 'engine_man_d2866_luh21', label: 'MAN D2866 LUH21 — moteur diesel', category: 'Moteurs', price: 65000, match: /(X\s*73(?:500|900)|ATER)/i, realModel: true },
    { id: 'engine_generic', label: 'Moteur principal / module de traction — référence série', category: 'Moteurs', price: 140000 },
    { id: 'turbocharger', label: 'Turbocompresseur moteur diesel', category: 'Moteurs', price: 22000 },
    { id: 'injector_set', label: 'Jeu d’injecteurs moteur', category: 'Moteurs', price: 8500 },
    { id: 'fuel_pump', label: 'Pompe carburant haute pression', category: 'Moteurs', price: 7200 },
    { id: 'oil_pump', label: 'Pompe à huile moteur', category: 'Moteurs', price: 4800 },
    { id: 'water_pump', label: 'Pompe circuit refroidissement', category: 'Moteurs', price: 5200 },
    { id: 'radiator_module', label: 'Module radiateur / échangeur', category: 'Moteurs', price: 12500 },
    { id: 'gearbox_module', label: 'Réducteur / transmission', category: 'Transmission', price: 42000 },
    { id: 'cardan_shaft', label: 'Arbre de transmission / cardan', category: 'Transmission', price: 7200 },
    { id: 'traction_motor', label: 'Moteur de traction', category: 'Traction', price: 38000 },
    { id: 'traction_inverter', label: 'Convertisseur / onduleur de traction', category: 'Traction', price: 52000 },
    { id: 'main_transformer', label: 'Transformateur principal', category: 'Traction', price: 95000 },
    { id: 'main_breaker', label: 'Disjoncteur principal HT', category: 'Traction', price: 18500 },
    { id: 'aux_converter', label: 'Convertisseur auxiliaire', category: 'Électrique', price: 28000 },
    { id: 'pantograph', label: 'Pantographe complet', category: 'Captage', price: 24000 },
    { id: 'pantograph_strip', label: 'Bande d’usure de pantographe', category: 'Captage', price: 950 },
    { id: 'wheelset', label: 'Essieu monté', category: 'Roulement', price: 14500 },
    { id: 'axle_bearing', label: 'Boîte d’essieu / roulement', category: 'Roulement', price: 2800 },
    { id: 'bogie_frame', label: 'Châssis de bogie', category: 'Bogies', price: 48000 },
    { id: 'air_spring', label: 'Coussin de suspension pneumatique', category: 'Bogies', price: 2400 },
    { id: 'damper', label: 'Amortisseur de suspension', category: 'Bogies', price: 950 },
    { id: 'brake_disc', label: 'Disque de frein', category: 'Freinage', price: 1200 },
    { id: 'brake_pad_set', label: 'Jeu de garnitures / semelles de frein', category: 'Freinage', price: 420 },
    { id: 'brake_caliper', label: 'Étrier / mécanisme de frein', category: 'Freinage', price: 3500 },
    { id: 'brake_cylinder', label: 'Cylindre de frein', category: 'Freinage', price: 1800 },
    { id: 'compressor', label: 'Compresseur d’air principal', category: 'Pneumatique', price: 12000 },
    { id: 'air_dryer', label: 'Sécheur d’air', category: 'Pneumatique', price: 3400 },
    { id: 'air_reservoir', label: 'Réservoir d’air principal', category: 'Pneumatique', price: 2900 },
    { id: 'hvac_unit', label: 'Groupe climatisation / HVAC', category: 'Confort', price: 18000 },
    { id: 'hvac_compressor', label: 'Compresseur de climatisation', category: 'Confort', price: 4800 },
    { id: 'door_drive', label: 'Mécanisme / motorisation de porte', category: 'Portes', price: 2600 },
    { id: 'door_leaf', label: 'Vantail / panneau de porte', category: 'Portes', price: 3400 },
    { id: 'battery_pack', label: 'Batterie auxiliaire', category: 'Électrique', price: 4200 },
    { id: 'headlight_unit', label: 'Bloc optique / fanal', category: 'Électrique', price: 850 },
    { id: 'windscreen', label: 'Pare-brise cabine', category: 'Caisse', price: 3200 },
    { id: 'wiper_motor', label: 'Moteur d’essuie-glace', category: 'Caisse', price: 650 },
    { id: 'cab_display', label: 'Écran / pupitre cabine', category: 'Électronique', price: 5800 },
    { id: 'control_card', label: 'Carte électronique de commande', category: 'Électronique', price: 2400 },
    { id: 'oil_filter', label: 'Filtre à huile', category: 'Consommables atelier', price: 85 },
    { id: 'fuel_filter', label: 'Filtre à carburant', category: 'Consommables atelier', price: 95 },
    { id: 'air_filter', label: 'Filtre à air moteur', category: 'Consommables atelier', price: 140 },
    { id: 'coolant_filter', label: 'Filtre circuit refroidissement', category: 'Consommables atelier', price: 110 },
    { id: 'toilet_pump', label: 'Pompe sanitaire / WC', category: 'Sanitaires', price: 2100 },
    { id: 'toilet_valve', label: 'Vanne / clapet sanitaire', category: 'Sanitaires', price: 780 },
    { id: 'coupler_wear_kit', label: 'Kit d’usure attelage / tampons', category: 'Attelage', price: 1800 },
    { id: 'automatic_coupler_head', label: 'Tête d’attelage automatique', category: 'Attelage', price: 14500 },
    { id: 'buffer', label: 'Tampon complet', category: 'Attelage', price: 2600 },
]);
export const DEPOT_OPERATION_CATALOG = Object.freeze({
    refuel: { label: 'Plein de gazole', group: 'Avitaillement', duration: 25, staff: { agent_avitaillement: 1 }, dynamic: 'fuel', equipment: ['fuel_station'] },
    sand_fill: { label: 'Remplissage des sablières', group: 'Avitaillement', duration: 15, staff: { agent_avitaillement: 1 }, dynamic: 'sand', equipment: ['sand_station'] },
    fluid_service: { label: 'Niveaux / changement des fluides', group: 'Maintenance', duration: 60, staff: { agent_maintenance: 1 }, dynamic: 'fluids', resources: { electricity_kwh: 8, compressed_air_m3: 4 }, equipment: ['fluid_station'] },
    washer_fill: { label: 'Remplissage lave-glace', group: 'Avitaillement', duration: 10, staff: { agent_avitaillement: 1 }, dynamic: 'washer', equipment: ['fluid_station'] },
    lubrication: { label: 'Graissage / lubrification', group: 'Maintenance', duration: 45, staff: { agent_maintenance: 1 }, resources: { grease_kg: 6, penetrating_oil_l: 1, electricity_kwh: 5, compressed_air_m3: 8 }, equipment: ['inspection_pit', 'compressor_station'] },
    sanitary_service: { label: 'Vidange et service sanitaires', group: 'Nettoyage', duration: 35, staff: { agent_assainissement: 1 }, resources: { water_l: 450, toilet_chemical_l: 4, wastewater_l: 350, electricity_kwh: 4 }, equipment: ['toilet_service'] },
    exterior_wash: { label: 'Lavage extérieur', group: 'Nettoyage', duration: 35, staff: { agent_lavage: 2 }, resources: { water_l: 850, detergent_l: 4, electricity_kwh: 12 }, equipment: ['wash_plant'] },
    interior_clean: { label: 'Nettoyage intérieur', group: 'Nettoyage', duration: 55, staff: { agent_nettoyage: 2 }, resources: { water_l: 90, interior_cleaner_l: 3, electricity_kwh: 6 }, equipment: ['interior_cleaning'] },
    deep_disinfection: { label: 'Nettoyage intérieur approfondi / désinfection', group: 'Nettoyage', duration: 120, staff: { agent_nettoyage: 3 }, resources: { water_l: 160, interior_cleaner_l: 5, disinfectant_l: 5, electricity_kwh: 10 }, equipment: ['interior_cleaning'] },
    routine_service: { label: 'Visite / entretien courant', group: 'Maintenance', duration: 120, staff: { agent_visite: 1, agent_maintenance: 2 }, resources: { electricity_kwh: 35, compressed_air_m3: 20, brake_cleaner_l: 2 }, parts: { oil_filter: 1, air_filter: 1 }, equipment: ['inspection_pit', 'compressor_station'] },
    brake_overhaul: { label: 'Révision du freinage', group: 'Maintenance lourde', duration: 240, staff: { specialiste_freinage: 2, technicien_pneumatique: 1 }, resources: { electricity_kwh: 75, compressed_air_m3: 80, brake_cleaner_l: 8 }, parts: { brake_pad_set: 4, brake_disc: 2 }, equipment: ['inspection_pit', 'brake_bench', 'compressor_station'] },
    wheel_reprofile: { label: 'Reprofilage des essieux', group: 'Maintenance lourde', duration: 300, staff: { specialiste_essieux: 2 }, resources: { electricity_kwh: 180 }, equipment: ['underfloor_lathe'] },
    bogie_change: { label: 'Dépose / remplacement bogie', group: 'Maintenance lourde', duration: 540, staff: { agent_levage: 2, specialiste_essieux: 2 }, resources: { electricity_kwh: 260, grease_kg: 12 }, parts: { bogie_frame: 1 }, equipment: ['lifting_jacks', 'bogie_drop', 'overhead_crane'] },
    engine_replace: { label: 'Remplacement moteur diesel / module principal', group: 'Maintenance lourde', duration: 720, staff: { mecanicien_diesel: 3, agent_levage: 2 }, resources: { electricity_kwh: 420 }, dynamic: 'engine', equipment: ['lifting_jacks', 'overhead_crane'] },
    traction_motor_replace: { label: 'Remplacement moteur de traction', group: 'Maintenance lourde', duration: 480, staff: { technicien_traction_elec: 2, agent_levage: 2 }, resources: { electricity_kwh: 260 }, parts: { traction_motor: 1 }, equipment: ['lifting_jacks', 'overhead_crane', 'electrical_bench'] },
    pantograph_replace: { label: 'Remplacement pantographe', group: 'Maintenance lourde', duration: 180, staff: { technicien_traction_elec: 2 }, resources: { electricity_kwh: 35 }, parts: { pantograph: 1 }, equipment: ['roof_access', 'overhead_crane'] },
    electrical_diagnostic: { label: 'Diagnostic électrique / électronique', group: 'Maintenance', duration: 90, staff: { electromecanicien: 1, electricien_bord: 1 }, resources: { electricity_kwh: 18 }, equipment: ['electrical_bench'] },
    compressor_replace: { label: 'Remplacement compresseur d’air', group: 'Maintenance lourde', duration: 210, staff: { technicien_pneumatique: 2, agent_maintenance: 1 }, resources: { electricity_kwh: 45, compressed_air_m3: 20 }, parts: { compressor: 1 }, equipment: ['inspection_pit', 'compressor_station'] },
    hvac_replace: { label: 'Remplacement groupe climatisation', group: 'Maintenance lourde', duration: 180, staff: { technicien_hvac: 2, agent_levage: 1 }, resources: { electricity_kwh: 40 }, parts: { hvac_unit: 1 }, equipment: ['roof_access', 'overhead_crane'] },
    door_repair: { label: 'Réparation mécanisme de porte', group: 'Maintenance', duration: 90, staff: { agent_maintenance: 1, electromecanicien: 1 }, resources: { electricity_kwh: 12 }, parts: { door_drive: 1 } },
    battery_service: { label: 'Contrôle / remplacement batteries', group: 'Maintenance', duration: 75, staff: { electricien_bord: 1 }, resources: { electricity_kwh: 20 }, parts: { battery_pack: 1 }, equipment: ['battery_station'] },
    deicing: { label: 'Dégivrage du matériel', group: 'Nettoyage', duration: 30, staff: { agent_lavage: 1 }, resources: { deicer_l: 18, water_l: 120, electricity_kwh: 15 }, equipment: ['deicing_station'] },
});
let nextDepotOperationId = 1;
function depotFinite(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function depotClamp(v, a, b) { return Math.max(a, Math.min(b, depotFinite(v, a))); }
function materialSearchText(rame) { return [rame?.name, rame?.serialNumber, ...(rame?.elementDetails || []).flatMap((e) => [e?.name, e?.instanceName, e?.seriesName])].filter(Boolean).join(' '); }
function partForEngine(rame) { const txt = materialSearchText(rame); return DEPOT_PART_CATALOG.find((p) => p.realModel && p.match?.test(txt)) || DEPOT_PART_CATALOG.find((p) => p.id === 'engine_generic'); }
export class Depot {
    constructor(data = {}) {
        const src = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        this.id = src.id == null || src.id === '' ? `depot-${nextDepotId++}` : String(src.id);
        this.type = (src.type || 'depot'); // depot, ite-fret, ite-industrie, ite-logistique
        this.name = (src.name || 'Depot');
        this.stationId = String(src.stationId ?? '');
        this.stationUpgradeSource = typeof src.stationUpgradeSource === 'string' ? src.stationUpgradeSource : '';
        this.stationUpgradeTracks = Math.max(0, Math.min(3, Math.floor(depotFinite(src.stationUpgradeTracks, 0))));
        const tracks = Math.floor(Number(src.tracks));
        this.tracks = Number.isFinite(tracks) && tracks > 0 ? tracks : 4;
        const cost = Number(src.cost);
        this.cost = Number.isFinite(cost) && cost >= 0 ? cost : 50000;
        this.built = src.built === true;
        // DEP-01 : infrastructures dépôt (remisage, rotonde, technicentre)
        const infraAllowed = new Set(['remisage', 'rotonde', 'technicentre']);
        this.infrastructure = [...new Set((Array.isArray(src.infrastructure) ? src.infrastructure : []).filter((x) => typeof x === 'string' && infraAllowed.has(x)))];
        // HOTFIX51 — physical workshop equipment. Counts are capacities: one tour en
        // fosse cannot serve two trains at the same time. Legacy technicentre/rotonde
        // flags are migrated once so old depots keep useful capabilities.
        this.equipmentInventory = {};
        if (src.equipmentInventory && typeof src.equipmentInventory === 'object' && !Array.isArray(src.equipmentInventory)) {
            for (const [key, value] of Object.entries(src.equipmentInventory)) {
                const def = DEPOT_EQUIPMENT_CATALOG[key], n = Math.floor(Number(value));
                if (def && Number.isFinite(n) && n > 0)
                    this.equipmentInventory[key] = Math.min(def.maxCount || 1, n);
            }
        }
        if (!Object.keys(this.equipmentInventory).length) {
            if (this.infrastructure.includes('technicentre'))
                Object.assign(this.equipmentInventory, { inspection_pit: 1, lifting_jacks: 1, overhead_crane: 1, underfloor_lathe: 1, brake_bench: 1, electrical_bench: 1, compressor_station: 1, fuel_station: 1, sand_station: 1, fluid_station: 1, wash_plant: 1, interior_cleaning: 1, roof_access: 1, battery_station: 1 });
            if (this.infrastructure.includes('remisage'))
                this.equipmentInventory.interior_cleaning = Math.max(1, this.equipmentInventory.interior_cleaning || 0);
        }
        this.ramesStored = [...new Set((Array.isArray(src.ramesStored) ? src.ramesStored : []).filter((x) => typeof x === 'string' && x))];
        // HOTFIX40 — V2 infrastructure geometry. Each section is an independent
        // Schedule-Creator-grade A→B route; no continuity is implied between sections.
        this.schemaVersion = Number(src.schemaVersion) >= 2 ? 2 : 1;
        this.location = src.location && Number.isFinite(Number(src.location.lat)) && Number.isFinite(Number(src.location.lon))
            ? { lat: Number(src.location.lat), lon: Number(src.location.lon) } : null;
        // HOTFIX49 — point objects created from the Depots & ITE page do not carry
        // artificial ORM sections. stationId remains a technical gameplay link only.
        this.placementOnly = src.placementOnly === true;
        this.railSections = (Array.isArray(src.railSections) ? src.railSections : [])
            .map((x, i) => normalizeRailSection(x, { id: `${this.id}-section-${i + 1}`, name: `Section ${i + 1}`, direction: 'both' }))
            .filter((x) => x.route.length >= 2 && x.startBinding && x.endBinding);
        // ITE track footprints keep their real ORM geometry when available, while
        // preserving legacy {name,length,cargoType} saves.
        this.iteTracks = (Array.isArray(src.iteTracks) ? src.iteTracks : []).filter((t) => t && typeof t === 'object' && Number.isFinite(Number(t.length)) && Number(t.length) > 0).map((t, i) => ({
            name: String(t.name || 'Voie').trim() || 'Voie', length: Math.max(1, Number(t.length)), cargoType: typeof t.cargoType === 'string' ? t.cargoType : '',
            startBinding: cleanRailBinding(t.startBinding), endBinding: cleanRailBinding(t.endBinding), constraints: Array.isArray(t.constraints) ? cloneRailValue(t.constraints) : [],
            route: cleanRailRoute(t.route), segments: Array.isArray(t.segments) ? cloneRailValue(t.segments) : [], distanceKm: Number.isFinite(Number(t.distanceKm)) ? Math.max(0, Number(t.distanceKm)) : Math.max(0, Number(t.length) / 1000), role: String(t.role || 'ite-track')
        }));
        // V2 ITEs can reconstruct the common section collection from track geometry.
        if (!this.railSections.length) {
            this.railSections = this.iteTracks.filter((t) => t.route?.length >= 2 && t.startBinding && t.endBinding).map((t, i) => normalizeRailSection({ ...t, id: `${this.id}-section-${i + 1}`, name: t.name, role: 'ite-track', direction: 'both' }));
        }
        this.iteCargoTypes = [...new Set((Array.isArray(src.iteCargoTypes) ? src.iteCargoTypes : []).filter((x) => typeof x === 'string' && x))];
        // Rescue locomotives: array of { stockId, stockName, deployed }
        this.rescueLocos = (Array.isArray(src.rescueLocos) ? src.rescueLocos : []).filter((r) => r && r.stockId).map((r) => ({
            stockId: String(r.stockId),
            stockName: String(r.stockName || '').slice(0, 160),
            traction: String(r.traction || '').slice(0, 80),
            deployed: r.deployed === true,
            totalKmRun: typeof r.totalKmRun === 'number' && Number.isFinite(r.totalKmRun) ? Math.max(0, r.totalKmRun) : 0,
            consumables: r.consumables && typeof r.consumables === 'object' && !Array.isArray(r.consumables)
                ? Object.fromEntries(Object.entries(r.consumables).filter(([k, n]) => !['__proto__', 'constructor', 'prototype'].includes(k) && typeof n === 'number' && Number.isFinite(n) && n >= 0)) : undefined,
        }));
        // HOTFIX50 — real depot stocks + operating costs. Legacy spareParts are
        // migrated into the richer part inventory instead of being discarded.
        this.partInventory = {};
        if (src.partInventory && typeof src.partInventory === 'object' && !Array.isArray(src.partInventory)) {
            for (const [key, value] of Object.entries(src.partInventory)) {
                const n = Math.floor(Number(value));
                if (key && Number.isFinite(n) && n >= 0)
                    this.partInventory[String(key)] = n;
            }
        }
        const legacyMap = { moteur: 'engine_generic', climatisation: 'hvac_unit', fanaux: 'headlight_unit', freins: 'brake_pad_set', portes: 'door_drive' };
        if (src.spareParts && typeof src.spareParts === 'object' && !Array.isArray(src.spareParts)) {
            for (const [oldKey, newKey] of Object.entries(legacyMap)) {
                const n = Math.floor(Number(src.spareParts[oldKey]));
                if (Number.isFinite(n) && n > 0)
                    this.partInventory[newKey] = (this.partInventory[newKey] || 0) + n;
            }
        }
        // Keep a legacy read-only shaped view for old code/tests.
        this.spareParts = { moteur: this.partInventory.engine_generic || 0, climatisation: this.partInventory.hvac_unit || 0, fanaux: this.partInventory.headlight_unit || 0, freins: this.partInventory.brake_pad_set || 0, portes: this.partInventory.door_drive || 0 };
        this.resourceStocks = {};
        this.resourceCapacities = {};
        this.resourceUsage = {};
        for (const [key, def] of Object.entries(DEPOT_RESOURCE_CATALOG)) {
            this.resourceUsage[key] = Math.max(0, depotFinite(src.resourceUsage?.[key], 0));
            if (!def.stock)
                continue;
            const cap = Math.max(0, depotFinite(src.resourceCapacities?.[key], def.defaultCapacity));
            this.resourceCapacities[key] = cap;
            this.resourceStocks[key] = depotClamp(src.resourceStocks?.[key], 0, cap);
        }
        const slots = Array.isArray(src.trackOccupancy) ? src.trackOccupancy : [];
        this.trackOccupancy = Array.from({ length: this.tracks }, (_, i) => { const raw = slots[i] || {}; return { track: i + 1, rameId: String(raw.rameId || ''), purpose: String(raw.purpose || 'garage'), operationId: String(raw.operationId || '') }; });
        this.utilityTotals = { electricityKWh: Math.max(0, depotFinite(src.utilityTotals?.electricityKWh, 0)), waterL: Math.max(0, depotFinite(src.utilityTotals?.waterL, 0)), expenseEur: Math.max(0, depotFinite(src.utilityTotals?.expenseEur, 0)) };
        this.expenseLedger = (Array.isArray(src.expenseLedger) ? src.expenseLedger : []).filter((x) => x && typeof x === 'object').slice(-120).map((x) => ({ time: Number(x.time) || 0, label: String(x.label || ''), amount: Math.max(0, depotFinite(x.amount, 0)), category: String(x.category || 'exploitation') }));
    }
    _syncLegacySpareParts() {
        this.spareParts = { moteur: this.partInventory.engine_generic || 0, climatisation: this.partInventory.hvac_unit || 0, fanaux: this.partInventory.headlight_unit || 0, freins: this.partInventory.brake_pad_set || 0, portes: this.partInventory.door_drive || 0 };
    }
    addPart(partId, qty) {
        const key = String(partId || '');
        const amount = Math.floor(Number(qty));
        if (!key || !Number.isFinite(amount) || amount <= 0)
            return false;
        this.partInventory[key] = (Number(this.partInventory[key]) || 0) + amount;
        this._syncLegacySpareParts();
        return true;
    }
    consumeParts(parts) {
        const entries = Object.entries(parts || {}).map(([k, v]) => [String(k), Math.floor(Number(v))]);
        if (!entries.length)
            return true;
        for (const [k, n] of entries) {
            if (!k || !Number.isFinite(n) || n <= 0 || (Number(this.partInventory[k]) || 0) < n)
                return false;
        }
        for (const [k, n] of entries)
            this.partInventory[k] -= n;
        this._syncLegacySpareParts();
        return true;
    }
    // Legacy API retained for old repair/rescue paths.
    addSpareParts(type, qty) { const map = { moteur: 'engine_generic', climatisation: 'hvac_unit', fanaux: 'headlight_unit', freins: 'brake_pad_set', portes: 'door_drive' }; const key = String(type || ''); return this.addPart(map[key] || key, qty); }
    consumeSpareParts(parts) { const map = { moteur: 'engine_generic', climatisation: 'hvac_unit', fanaux: 'headlight_unit', freins: 'brake_pad_set', portes: 'door_drive' }; const next = {}; for (const [k, v] of Object.entries(parts || {}))
        next[map[k] || k] = v; return this.consumeParts(next); }
    freeTrackCount() { return this.trackOccupancy.filter((x) => !x.rameId).length; }
    occupancyCount() { return this.trackOccupancy.filter((x) => !!x.rameId).length; }
    findRameTrack(rameId) { return this.trackOccupancy.find((x) => x.rameId === String(rameId || '')) || null; }
    getTypeLabel() {
        const labels = {
            'depot': 'Depot maintenance',
            'ite-fret': 'ITE Fret',
            'ite-industrie': 'ITE Industrie',
            'ite-logistique': 'ITE Logistique',
        };
        return labels[this.type] || this.type;
    }
    getMaintenanceCost() {
        return this.tracks * 200;
    }
    hasInfrastructure(type) {
        return Array.isArray(this.infrastructure) && this.infrastructure.includes(type);
    }
    equipmentCount(id) { const key = String(id || ''); return Math.max(0, Math.floor(Number(this.equipmentInventory?.[key]) || 0)); }
    hasEquipment(id) { return this.equipmentCount(id) > 0; }
    addEquipment(id, count = 1) { const key = String(id || ''); const def = DEPOT_EQUIPMENT_CATALOG[key], n = Math.floor(Number(count)); if (!def || !Number.isFinite(n) || n <= 0)
        return false; const cur = this.equipmentCount(id), next = Math.min(def.maxCount || 1, cur + n); if (next <= cur)
        return false; this.equipmentInventory[key] = next; return true; }
    // HOTFIX51 — les équipements précis gouvernent désormais la faisabilité.
    // L'ancien drapeau générique "technicentre" ne pénalise plus toutes les opérations.
    getMaintenanceDuration(baseMinutes) {
        const base = Math.max(1, Number(baseMinutes) || 60);
        if (this.hasInfrastructure('rotonde'))
            return Math.max(5, Math.round(base * 0.8));
        return base;
    }
    // Can dispatch rescue locomotive (has available non-deployed locos)
    canRescue() {
        return this.type === 'depot' && this.built && this.rescueLocos.some((r) => !r.deployed);
    }
    // Get first available rescue loco
    getAvailableRescueLoco(preferredTraction) {
        const preferred = String(preferredTraction || '').toLowerCase();
        if (preferred) {
            const match = this.rescueLocos.find((r) => !r.deployed && r.traction && r.traction.toLowerCase().includes(preferred));
            if (match)
                return match;
        }
        return this.rescueLocos.find((r) => !r.deployed);
    }
    // Mark a rescue loco as deployed
    deployRescue(stockId) {
        const loco = this.rescueLocos.find((r) => r.stockId === stockId && !r.deployed);
        if (loco) {
            loco.deployed = true;
            return loco;
        }
        return null;
    }
    // Return a rescue loco to depot
    returnRescue(stockId) {
        const loco = this.rescueLocos.find((r) => r.stockId === stockId && r.deployed);
        if (loco)
            loco.deployed = false;
    }
}
export class DepotManager {
    constructor() {
        this._rescueMovements = new Map();
        this.rescuedOccurrenceIds = new Set();
        this.rescuedFormations = [];
        this.depots = [];
        this.activeRescues = []; // { id, depotId, stockId, stockName, targetServiceId, state, position }
        this.repairQueue = []; // legacy emergency repair path
        this.maintenanceQueue = []; // legacy preventive-maintenance path
        this.depotOperations = []; // HOTFIX50 player-launched depot operations only
    }
    add(data, economy) {
        const depot = new Depot(data);
        const cost = Number(depot.cost);
        if (!Number.isFinite(cost) || cost < 0)
            return null;
        depot.cost = cost;
        // There is no deferred-construction workflow in the UI. Keeping an unbuilt
        // object after a failed purchase created ghost depots/ITEs that some gameplay
        // systems still treated as operational. A purchase is therefore atomic.
        if (economy) {
            if (!Number.isFinite(Number(economy.balance)) || economy.balance < cost)
                return null;
            economy.addExpense(cost, 'construction', `Construction ${depot.name}`);
        }
        depot.built = true;
        this.depots.push(depot);
        return depot;
    }
    remove(id) {
        id = String(id ?? '');
        if (this.getDepotById(id)?.stationUpgradeSource)
            return false; // paid module still owns these slots
        if (this.activeRescues.some((r) => r.depotId === id) || this.repairQueue.some((r) => r.depotId === id) || this.maintenanceQueue.some((r) => r.depotId === id) || this.depotOperations.some((r) => r.depotId === id) || this.getDepotById(id)?.trackOccupancy?.some((x) => x.rameId))
            return false;
        const before = this.depots.length;
        this.depots = this.depots.filter((d) => d.id !== id);
        return this.depots.length !== before;
    }
    getAll() {
        return this.depots;
    }
    getDepots() {
        return this.depots.filter((d) => d.type === 'depot' && d.built);
    }
    getDepotById(id) {
        id = String(id ?? '');
        return this.depots.find((d) => d.id === id) || null;
    }
    getITEs() {
        return this.depots.filter((d) => d.built && typeof d.type === 'string' && d.type.startsWith('ite'));
    }
    getByStation(stationId) {
        stationId = String(stationId ?? '');
        return this.depots.filter((d) => d.stationId === stationId);
    }
    addITETrack(depotId, track) {
        const depot = this.depots.find((d) => d.id === depotId);
        const length = Number(track?.length);
        const name = String(track?.name || '').trim();
        if (depot?.built && depot.type.startsWith('ite') && name && Number.isFinite(length) && length > 0) {
            const rec = { name, length, cargoType: String(track?.cargoType || ''), startBinding: cleanRailBinding(track?.startBinding), endBinding: cleanRailBinding(track?.endBinding), constraints: Array.isArray(track?.constraints) ? cloneRailValue(track.constraints) : [], route: cleanRailRoute(track?.route), segments: Array.isArray(track?.segments) ? cloneRailValue(track.segments) : [], distanceKm: Number.isFinite(Number(track?.distanceKm)) ? Math.max(0, Number(track.distanceKm)) : length / 1000, role: String(track?.role || 'ite-track') };
            depot.iteTracks.push(rec);
            if (rec.route.length >= 2 && rec.startBinding && rec.endBinding)
                depot.railSections.push(normalizeRailSection({ ...rec, id: `${depot.id}-section-${depot.railSections.length + 1}`, direction: 'both' }));
            return true;
        }
        return false;
    }
    removeITETrack(depotId, index) {
        const depot = this.depots.find((d) => d.id === depotId);
        const i = Number(index);
        if (depot?.built && depot.type.startsWith('ite') && Number.isInteger(i) && i >= 0 && i < depot.iteTracks.length) {
            depot.iteTracks.splice(i, 1);
            return true;
        }
        return false;
    }
    getTotalITELength(depotId) {
        const depot = this.depots.find((d) => d.id === depotId);
        return depot ? depot.iteTracks.reduce((s, t) => s + (Number(t.length) || 0), 0) : 0;
    }
    // Section VI — ITE : récupère le dépôt ITE lié à une gare (s'il existe)
    getITEByStation(stationId) {
        stationId = String(stationId ?? '');
        return this.depots.find((d) => d.built && typeof d.type === 'string' && d.type.startsWith('ite') && d.stationId === stationId) || null;
    }
    // Section VI — longueur utile totale d'un ITE, et nombre de tranches nécessaires
    getITEInfo(stationId, trainLengthM, cargoType) {
        const ite = this.getITEByStation(stationId);
        if (!ite)
            return { isITE: false, depotId: '', totalLength: Infinity, trancheCount: 1 };
        const totalLength = ite.iteTracks.reduce((s, t) => s + (Number(t.length) || 0), 0);
        // Vérification du type de fret accepté par l'ITE
        let cargoMatch = true;
        if (cargoType != null && String(cargoType).trim() && ite.iteCargoTypes && ite.iteCargoTypes.length > 0) {
            const cargo = String(cargoType).trim();
            cargoMatch = ite.iteCargoTypes.some((ct) => { const accepted = String(ct || '').trim(); return accepted && (accepted === cargo || cargo.startsWith(accepted) || accepted.startsWith(cargo)); });
        }
        if (totalLength <= 0) {
            // HOTFIX49 — a page-created ITE is a map object, not a hand-drawn siding.
            // With no authored useful-length geometry, do not make freight unusable:
            // length capacity is unspecified rather than zero.
            if (ite.placementOnly)
                return { isITE: true, depotId: ite.id, totalLength: Infinity, canFit: true, usable: true, trancheCount: 1, cargoMatch, placementOnly: true };
            return { isITE: true, depotId: ite.id, totalLength: 0, canFit: false, usable: false, trancheCount: 1, cargoMatch };
        }
        const rawLength = Number(trainLengthM);
        const safeLength = Number.isFinite(rawLength) ? Math.max(0, rawLength) : 0;
        const trancheCount = Math.max(1, Math.ceil(safeLength / totalLength));
        return { isITE: true, depotId: ite.id, totalLength, usable: true, canFit: safeLength <= totalLength, trancheCount, cargoMatch };
    }
    // HOTFIX50 — home assignment is not physical movement.
    assignRameHome(rame, depotId, { assignElements = true } = {}) {
        const depot = this.getDepotById(depotId);
        if (!rame || !depot || depot.type !== 'depot' || !depot.built)
            return false;
        rame.depotId = depot.id;
        if (assignElements)
            for (const el of rame.elementDetails || [])
                el.homeDepotId = depot.id;
        return true;
    }
    assignElementHome(rame, elementId, depotId) {
        const depot = this.getDepotById(depotId);
        const el = rame?.elementDetails?.find((e) => e.elementId === String(elementId || ''));
        if (!el || !depot || depot.type !== 'depot' || !depot.built)
            return false;
        el.homeDepotId = depot.id;
        return true;
    }
    clearRameHome(rame) { if (!rame)
        return false; const old = rame.depotId; rame.depotId = ''; for (const el of rame.elementDetails || [])
        if (el.homeDepotId === old)
            el.homeDepotId = ''; return true; }
    _rameHasActiveService(rameId, services = []) {
        const id = String(rameId || '');
        return services.some((svc) => svc?.rame?.id === id && !svc.completed && !svc.cancelled && ['moving', 'departing', 'stopped_at_station'].includes(String(svc.state || '')));
    }
    enterRame(depotId, rame, services = []) {
        const depot = this.getDepotById(depotId);
        if (!depot || depot.type !== 'depot' || !depot.built || !rame)
            return { ok: false, reason: 'Dépôt invalide' };
        if (this._rameHasActiveService(rame.id, services))
            return { ok: false, reason: 'Cette rame est encore engagée dans un service.' };
        if (rame.depotOperationId)
            return { ok: false, reason: 'Une opération dépôt est déjà en cours.' };
        const existing = depot.findRameTrack(rame.id);
        const slot = existing || depot.trackOccupancy.find(x => !x.rameId);
        if (!slot)
            return { ok: false, reason: 'Dépôt complet : aucune voie de garage libre.' };
        // Commit only after validating the destination. Failed admission keeps every
        // old occupancy, location and service flag exactly as it was.
        for (const d of this.getDepots()) {
            for (const occupied of d.trackOccupancy) {
                if (occupied !== slot && occupied.rameId === rame.id) {
                    occupied.rameId = '';
                    occupied.purpose = 'garage';
                    occupied.operationId = '';
                }
            }
        }
        slot.rameId = rame.id;
        slot.purpose = 'garage';
        slot.operationId = '';
        rame.currentLocation = { depotId: depot.id, stationId: '', serviceId: '', lat: depot.location?.lat ?? null, lon: depot.location?.lon ?? null };
        // Block every future/waiting service using this rame until the player releases it,
        // without mislabelling ordinary depot storage as maintenance.
        for (const svc of services || [])
            if (svc?.rame?.id === rame.id && svc.train) {
                svc.train.inDepot = true;
                svc.train.inMaintenance = !!rame.inMaintenance;
            }
        return { ok: true, track: slot.track, already: !!existing };
    }
    leaveRame(depotId, rame, services = []) {
        const depot = this.getDepotById(depotId);
        if (!depot || !rame)
            return { ok: false, reason: 'Dépôt / rame invalide' };
        if (rame.depotOperationId || this.depotOperations.some((o) => o.rameId === rame.id && o.state === 'running'))
            return { ok: false, reason: 'Opération en cours : sortie impossible.' };
        if (this.isRameInMaintenance(rame.id) || this.repairQueue.some(q => q.rameId === rame.id))
            return { ok: false, reason: 'Réparation ou entretien en cours : sortie impossible.' };
        const slot = depot.findRameTrack(rame.id);
        if (!slot && rame.currentLocation?.depotId !== depot.id)
            return { ok: false, reason: 'Cette rame ne se trouve pas dans ce dépôt.' };
        if (slot) {
            slot.rameId = '';
            slot.purpose = 'garage';
            slot.operationId = '';
        }
        if (rame.currentLocation?.depotId === depot.id)
            rame.currentLocation = { ...(rame.currentLocation || {}), depotId: '', lat: null, lon: null };
        for (const svc of services || [])
            if (svc?.rame?.id === rame.id && svc.train) {
                svc.train.inDepot = false;
                svc.train.inMaintenance = !!rame.inMaintenance;
            }
        return { ok: true };
    }
    getDepotOccupancy(depotId) { const d = this.getDepotById(depotId); return d ? { used: d.occupancyCount(), capacity: d.tracks, free: d.freeTrackCount(), tracks: d.trackOccupancy.map((x) => ({ ...x })) } : { used: 0, capacity: 0, free: 0, tracks: [] }; }
    addDepotTracks(depotId, count, economy) {
        const depot = this.getDepotById(depotId);
        count = Math.floor(Number(count));
        if (!depot || depot.type !== 'depot' || !economy || !Number.isFinite(count) || count <= 0)
            return { ok: false, reason: 'Extension invalide.' };
        const allowed = Math.min(count, Math.max(0, 60 - depot.tracks));
        if (allowed <= 0)
            return { ok: false, reason: 'Capacité maximale atteinte (60 voies).' };
        const cost = allowed * DEPOT_TRACK_EXPANSION_COST;
        if (Number(economy.balance) < cost)
            return { ok: false, cost, reason: 'Fonds insuffisants.' };
        const old = depot.tracks;
        for (let i = 0; i < allowed; i++)
            depot.trackOccupancy.push({ track: old + i + 1, rameId: '', purpose: 'garage', operationId: '' });
        depot.tracks += allowed;
        economy.addExpense(cost, 'construction', `Extension ${depot.name} — ${allowed} voie(s) de garage`);
        depot.utilityTotals.expenseEur += cost;
        depot.expenseLedger.push({ time: Date.now(), label: `Extension +${allowed} voie(s)`, amount: cost, category: 'infrastructure' });
        depot.expenseLedger = depot.expenseLedger.slice(-120);
        return { ok: true, cost, count: allowed, tracks: depot.tracks };
    }
    buyEquipment(depotId, equipmentId, economy) {
        const equipmentKey = String(equipmentId || '');
        const depot = this.getDepotById(depotId), def = DEPOT_EQUIPMENT_CATALOG[equipmentKey];
        if (!depot || depot.type !== 'depot' || !def || !economy)
            return { ok: false, reason: 'Équipement invalide.' };
        const cur = depot.equipmentCount(equipmentKey);
        if (cur >= (def.maxCount || 1))
            return { ok: false, reason: 'Nombre maximal déjà installé.' };
        if (Number(economy.balance) < def.price)
            return { ok: false, cost: def.price, reason: 'Fonds insuffisants.' };
        economy.addExpense(def.price, 'construction', `${depot.name} — ${def.label}`);
        depot.addEquipment(equipmentKey, 1);
        depot.utilityTotals.expenseEur += def.price;
        depot.expenseLedger.push({ time: Date.now(), label: `Équipement : ${def.label}`, amount: def.price, category: 'équipement' });
        depot.expenseLedger = depot.expenseLedger.slice(-120);
        return { ok: true, cost: def.price, count: depot.equipmentCount(equipmentKey) };
    }
    _equipmentBusyCount(depotId, equipmentId) { return this.depotOperations.filter((o) => o.depotId === String(depotId || '') && o.state === 'running' && Array.isArray(o.equipment) && o.equipment.includes(equipmentId)).length; }
    getEquipmentAvailability(depotId, equipmentId) { const depot = this.getDepotById(depotId), installed = depot?.equipmentCount?.(equipmentId) || 0, busy = this._equipmentBusyCount(depotId, equipmentId); return { installed, busy, free: Math.max(0, installed - busy) }; }
    buyResource(depotId, key, qty, economy) {
        const resourceKey = String(key || '');
        const depot = this.getDepotById(depotId), def = DEPOT_RESOURCE_CATALOG[resourceKey];
        qty = Number(qty);
        if (!depot || !def?.stock || !economy || !Number.isFinite(qty) || qty <= 0)
            return { ok: false, cost: 0 };
        const cap = Number(depot.resourceCapacities[resourceKey] || 0), cur = Number(depot.resourceStocks[resourceKey] || 0), add = Math.min(qty, Math.max(0, cap - cur));
        if (add <= 0)
            return { ok: false, cost: 0, reason: 'Stock déjà plein' };
        const cost = add * def.price;
        if (Number(economy.balance) < cost)
            return { ok: false, cost, reason: 'Fonds insuffisants' };
        economy.addExpense(cost, 'maintenance', `Approvisionnement ${depot.name} — ${def.label} ${add.toFixed(def.unit === 'L' ? 0 : 1)} ${def.unit}`);
        depot.resourceStocks[resourceKey] = cur + add;
        depot.utilityTotals.expenseEur += cost;
        depot.expenseLedger.push({ time: Date.now(), label: `Achat ${def.label}`, amount: cost, category: 'approvisionnement' });
        depot.expenseLedger = depot.expenseLedger.slice(-120);
        return { ok: true, cost, qty: add };
    }
    buyPart(depotId, partId, qty, economy) {
        const depot = this.getDepotById(depotId), part = DEPOT_PART_CATALOG.find((p) => p.id === partId);
        qty = Math.floor(Number(qty));
        if (!depot || !part || !economy || !Number.isFinite(qty) || qty <= 0)
            return { ok: false, cost: 0 };
        const cost = part.price * qty;
        if (Number(economy.balance) < cost)
            return { ok: false, cost, reason: 'Fonds insuffisants' };
        economy.addExpense(cost, 'maintenance', `Pièces ${depot.name} — ${part.label} x${qty}`);
        depot.addPart(partId, qty);
        depot.utilityTotals.expenseEur += cost;
        depot.expenseLedger.push({ time: Date.now(), label: `Pièce : ${part.label} x${qty}`, amount: cost, category: 'pièces' });
        depot.expenseLedger = depot.expenseLedger.slice(-120);
        return { ok: true, cost };
    }
    _operationNeeds(rame, opId) {
        const opKey = String(opId || '');
        const def = DEPOT_OPERATION_CATALOG[opKey];
        if (!def)
            return null;
        const resources = { ...(def.resources || {}) }, parts = { ...(def.parts || {}) };
        const c = rame?.consumables || {};
        if (def.dynamic === 'fuel') {
            const missing = Math.max(0, Number(c.fuelCapacityL || 0) - Number(c.fuelL || 0));
            if (missing <= 0)
                return { def, resources, parts, nothing: true };
            resources.diesel_l = missing;
        }
        if (def.dynamic === 'sand') {
            const missing = Math.max(0, Number(c.sandCapacityKg || 0) - Number(c.sandKg || 0));
            if (missing <= 0)
                return { def, resources, parts, nothing: true };
            resources.sand_kg = missing;
        }
        if (def.dynamic === 'fluids') {
            resources.engine_oil_l = Math.max(0, Number(c.oilCapacityL || 0) - Number(c.oilL || 0));
            resources.coolant_l = Math.max(0, Number(c.coolantCapacityL || 0) - Number(c.coolantL || 0));
            if (Number(c.adblueCapacityL || 0) > 0)
                resources.adblue_l = Math.max(0, Number(c.adblueCapacityL || 0) - Number(c.adblueL || 0));
            if (Number(c.gearboxOilCapacityL || 0) > 0)
                resources.gearbox_oil_l = Math.max(0, Number(c.gearboxOilCapacityL || 0) - Number(c.gearboxOilL || 0));
            if (Number(c.hydraulicOilCapacityL || 0) > 0)
                resources.hydraulic_oil_l = Math.max(0, Number(c.hydraulicOilCapacityL || 0) - Number(c.hydraulicOilL || 0));
        }
        if (def.dynamic === 'washer') {
            const missing = Math.max(0, Number(c.washerCapacityL || 0) - Number(c.washerL || 0));
            if (missing <= 0)
                return { def, resources, parts, nothing: true };
            resources.washer_fluid_l = missing;
        }
        if (def.dynamic === 'engine') {
            const part = partForEngine(rame);
            parts[part?.id || 'engine_generic'] = 1;
        }
        return { def, resources, parts, nothing: false };
    }
    startDepotOperation(depotId, rame, opId, economy, staffManager = null) {
        const depot = this.getDepotById(depotId), need = this._operationNeeds(rame, opId);
        if (!depot || depot.type !== 'depot' || !rame || !need)
            return { ok: false, reason: 'Opération invalide' };
        if (rame.currentLocation?.depotId !== depot.id || !depot.findRameTrack(rame.id))
            return { ok: false, reason: 'La rame doit d’abord être envoyée manuellement dans ce dépôt.' };
        if (rame.depotOperationId || this.depotOperations.some((o) => o.rameId === rame.id && o.state === 'running'))
            return { ok: false, reason: 'Une opération est déjà en cours sur cette rame.' };
        if (need.def.requires && !depot.hasInfrastructure(need.def.requires))
            return { ok: false, reason: `Équipement historique requis : ${need.def.requires}.` };
        const requiredEquipment = [...new Set((Array.isArray(need.def.equipment) ? need.def.equipment : []).map(String))];
        for (const equipmentId of requiredEquipment) {
            const def = DEPOT_EQUIPMENT_CATALOG[equipmentId], availability = this.getEquipmentAvailability(depot.id, equipmentId);
            if (availability.installed <= 0)
                return { ok: false, reason: `Équipement requis : ${def?.label || equipmentId}.` };
            if (availability.free <= 0)
                return { ok: false, reason: `Équipement occupé : ${def?.label || equipmentId}.` };
        }
        if (staffManager?.checkDepotStaff) {
            const staffCheck = staffManager.checkDepotStaff(depot.id, need.def.staff || {});
            if (!staffCheck.ok) {
                const txt = staffCheck.shortages.map((x) => `${x.label} : ${x.free}/${x.need} disponible(s)`).join(' · ');
                return { ok: false, reason: `Personnel insuffisant : ${txt}. Affectez ou embauchez les agents nécessaires dans Personnel.` };
            }
        }
        if (need.nothing)
            return { ok: false, reason: 'Aucun complément nécessaire.' };
        for (const [key, qty] of Object.entries(need.resources)) {
            const def = DEPOT_RESOURCE_CATALOG[key];
            if (def?.stock && (Number(depot.resourceStocks[key]) || 0) + 1e-9 < Number(qty || 0))
                return { ok: false, reason: `Stock insuffisant : ${def.label}.` };
        }
        for (const [key, qty] of Object.entries(need.parts)) {
            if ((Number(depot.partInventory[key]) || 0) < Number(qty || 0)) {
                const p = DEPOT_PART_CATALOG.find((x) => x.id === key);
                return { ok: false, reason: `Pièce manquante : ${p?.label || key}.` };
            }
        }
        let utilityCost = 0;
        for (const [key, qty] of Object.entries(need.resources)) {
            const def = DEPOT_RESOURCE_CATALOG[key];
            if (def && !def.stock)
                utilityCost += Number(qty || 0) * def.price;
        }
        if (utilityCost > 0 && Number(economy?.balance) < utilityCost)
            return { ok: false, reason: 'Fonds insuffisants pour les fluides/énergies.' };
        const duration = depot.getMaintenanceDuration(need.def.duration);
        const id = `depot-op-${nextDepotOperationId++}`;
        const staffReservation = staffManager?.reserveDepotStaff ? staffManager.reserveDepotStaff(depot.id, need.def.staff || {}, id, need.def.label) : { ok: true, staffIds: [] };
        if (!staffReservation?.ok)
            return { ok: false, reason: 'Personnel devenu indisponible avant le lancement de l’opération.' };
        // Reserve the full team before spending anything. Preflight availability is
        // advisory: a late reservation refusal must not consume stocks or cash.
        if (!depot.consumeParts(need.parts)) {
            staffManager?.releaseDepotTask?.(id);
            return { ok: false, reason: 'Pièces insuffisantes' };
        }
        for (const [key, qty] of Object.entries(need.resources)) {
            const def = DEPOT_RESOURCE_CATALOG[key];
            if (!def)
                continue;
            const used = Math.max(0, Number(qty || 0));
            depot.resourceUsage[key] = (Number(depot.resourceUsage[key]) || 0) + used;
            if (def.stock)
                depot.resourceStocks[key] = Math.max(0, (Number(depot.resourceStocks[key]) || 0) - used);
            if (key === 'water_l')
                depot.utilityTotals.waterL += used;
            if (key === 'electricity_kwh')
                depot.utilityTotals.electricityKWh += used;
        }
        if (utilityCost > 0) {
            economy.addExpense(utilityCost, 'maintenance', `${depot.name} — ${need.def.label} (eau/électricité)`);
            depot.utilityTotals.expenseEur += utilityCost;
            depot.expenseLedger.push({ time: Date.now(), label: need.def.label, amount: utilityCost, category: 'énergie/eau' });
        }
        const op = { id, depotId: depot.id, rameId: rame.id, rameName: rame.name, opId, label: need.def.label, group: need.def.group, remainingMin: duration, totalMin: duration, state: 'running', staff: { ...(need.def.staff || {}) }, staffIds: [...(staffReservation.staffIds || [])], resources: need.resources, parts: need.parts, equipment: requiredEquipment, startedAt: Date.now() };
        this.depotOperations.push(op);
        rame.depotOperationId = id;
        const slot = depot.findRameTrack(rame.id);
        if (slot) {
            slot.purpose = need.def.group;
            slot.operationId = id;
        }
        return { ok: true, operation: op, utilityCost };
    }
    updateDepotOperations(dt, rameManager, staffManager = null) {
        const step = Math.max(0, Number(dt) || 0), finished = [];
        for (const op of this.depotOperations) {
            if (op.state !== 'running')
                continue;
            op.remainingMin -= step;
            if (op.remainingMin <= 0) {
                op.remainingMin = 0;
                op.state = 'done';
                finished.push(op);
            }
        }
        for (const op of finished) {
            const rame = rameManager?.getById?.(op.rameId), depot = this.getDepotById(op.depotId);
            if (rame) {
                const c = rame.consumables || {};
                if (op.opId === 'refuel')
                    c.fuelL = Number(c.fuelCapacityL || 0);
                else if (op.opId === 'sand_fill')
                    c.sandKg = Number(c.sandCapacityKg || 0);
                else if (op.opId === 'fluid_service') {
                    c.oilL = Number(c.oilCapacityL || 0);
                    c.coolantL = Number(c.coolantCapacityL || 0);
                    c.adblueL = Number(c.adblueCapacityL || 0);
                    c.gearboxOilL = Number(c.gearboxOilCapacityL || 0);
                    c.hydraulicOilL = Number(c.hydraulicOilCapacityL || 0);
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 3);
                }
                else if (op.opId === 'washer_fill')
                    c.washerL = Number(c.washerCapacityL || 0);
                else if (op.opId === 'lubrication')
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 2);
                else if (op.opId === 'exterior_wash' || op.opId === 'deicing')
                    rame.cleanliness = { ...(rame.cleanliness || {}), exterior: 100 };
                else if (op.opId === 'interior_clean' || op.opId === 'deep_disinfection')
                    rame.cleanliness = { ...(rame.cleanliness || {}), interior: 100 };
                else if (op.opId === 'routine_service') {
                    rame.kmSinceLastMaint = 0;
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 25);
                    rame.recommendedMaintenance = false;
                }
                else if (op.opId === 'brake_overhaul') {
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 12);
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'freins');
                }
                else if (op.opId === 'wheel_reprofile') {
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 10);
                }
                else if (op.opId === 'engine_replace') {
                    rame.wearLevel = Math.max(0, Number(rame.wearLevel || 0) - 20);
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'moteur');
                }
                else if (op.opId === 'traction_motor_replace')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => !['traction', 'moteur_traction'].includes(String(x)));
                else if (op.opId === 'pantograph_replace')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'pantographe');
                else if (op.opId === 'compressor_replace')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'compresseur');
                else if (op.opId === 'hvac_replace')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'climatisation');
                else if (op.opId === 'door_repair')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'portes');
                else if (op.opId === 'battery_service')
                    rame.pendingDefects = (rame.pendingDefects || []).filter((x) => x !== 'batterie');
                rame.depotOperationId = '';
            }
            const slot = depot?.findRameTrack?.(op.rameId);
            if (slot) {
                slot.purpose = 'garage';
                slot.operationId = '';
            }
            staffManager?.releaseDepotTask?.(op.id);
        }
        this.depotOperations = this.depotOperations.filter((o) => o.state === 'running');
        return finished;
    }
    getOperationsForDepot(depotId) { return this.depotOperations.filter((o) => o.depotId === String(depotId || '')); }
    // Add a rescue loco to a depot — max 2 per depot (Annexe 9)
    addRescueLoco(depotId, stockId, stockName, traction) {
        const depot = this.depots.find((d) => d.id === depotId);
        if (depot?.built && depot.type === 'depot' && stockId) {
            if (depot.rescueLocos.length >= 2 || depot.rescueLocos.some((r) => r.stockId === stockId) || this.depots.some((d) => d.id !== depotId && d.rescueLocos?.some((raw) => raw?.stockId === stockId)))
                return false;
            depot.rescueLocos.push({ stockId: stockId, stockName: stockName, traction: (traction || ''), deployed: false });
            return true;
        }
        return false;
    }
    // Remove a rescue loco from a depot
    removeRescueLoco(depotId, stockId) {
        const depot = this.depots.find((d) => d.id === depotId);
        if (!depot)
            return false;
        const loco = depot.rescueLocos.find((r) => r.stockId === stockId);
        if (!loco || loco.deployed || this.activeRescues.some((r) => r.depotId === depotId && r.stockId === stockId))
            return false;
        depot.rescueLocos = depot.rescueLocos.filter((r) => r.stockId !== stockId);
        return true;
    }
    // Find nearest depot that can rescue
    findNearestRescueDepot(world, lat, lon) {
        let best = null, bestDist = Infinity;
        for (const depot of this.depots) {
            if (!depot.canRescue())
                continue;
            const station = world.getStationById(depot.stationId);
            const origin = depot.location && Number.isFinite(Number(depot.location.lat)) && Number.isFinite(Number(depot.location.lon)) ? depot.location : station;
            if (!origin)
                continue;
            const dLat = (origin.lat - lat) * 111;
            const dLon = (origin.lon - lon) * 111 * Math.cos(lat * Math.PI / 180);
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);
            if (dist < bestDist) {
                bestDist = dist;
                best = depot;
            }
        }
        return best;
    }
    // Dispatch rescue for a broken-down train
    // DDS-02 : choisir un secours diesel si le tronçon est non électrifié, électrique sinon
    dispatchRescue(world, brokenService) {
        const targetId = String(brokenService?.id ?? '');
        const targetPosition = rescuePoint(brokenService?.position);
        if (!targetId || !targetPosition)
            return null;
        // The incident and breakdown paths may request the same rescue in one tick.
        // A restored service may also have lost its transient 'dispatched' flag.
        const existing = this.activeRescues.find(r => r.targetServiceId === targetId && r.state !== 'done');
        if (existing)
            return existing;
        if (this.repairQueue.some(r => r.serviceId === targetId))
            return null;
        const depot = this.findNearestRescueDepot(world, targetPosition.lat, targetPosition.lon);
        if (!depot)
            return null;
        let preferred = '';
        const route = ((typeof brokenService.getCurrentRoute === 'function' && brokenService.getCurrentRoute()) ||
            brokenService._state?.cachedRoute || []);
        if (route?.length > 1) {
            const electCount = route.filter((p) => p.electrified !== false).length;
            const nonElectCount = route.filter((p) => p.electrified === false).length;
            if (nonElectCount > electCount)
                preferred = 'diesel';
            else if (electCount > 0)
                preferred = 'kv';
        }
        const loco = depot.getAvailableRescueLoco(preferred);
        if (!loco)
            return null;
        const station = world.getStationById(depot.stationId);
        const depotOrigin = depot.location && Number.isFinite(Number(depot.location.lat)) && Number.isFinite(Number(depot.location.lon)) ? depot.location : station;
        if (!rescuePoint(depotOrigin) || !depot.deployRescue(loco.stockId))
            return null;
        const repairType = (brokenService?.train?.breakdown?.type || 'moteur');
        const rescue = {
            id: `rescue-${nextRescueId++}`,
            depotId: depot.id,
            stockId: loco.stockId,
            stockName: loco.stockName,
            targetServiceId: targetId,
            repairType,
            state: 'routing', // routing -> en_route -> recovering -> routing_return -> returning
            position: depotOrigin ? { lat: depotOrigin.lat, lon: depotOrigin.lon } : null,
            targetPosition,
            depotPosition: depotOrigin ? { lat: depotOrigin.lat, lon: depotOrigin.lon } : null,
            speed: 0,
            progress: 0,
            route: null,
            routeIndex: 0,
            returnRoute: null,
            _routeRequestInFlight: false,
            _routeRetrySec: 0,
        };
        // Railway rescue movements are fail-closed: no synthetic straight-line
        // fallback and no implicit reversal of the outbound railway path.
        this.activeRescues.push(rescue);
        this._requestRescueRoute(rescue, rescue.position, targetPosition, false);
        return rescue;
    }
    _requestRescueRoute(rescue, from, to, returning = false) {
        const origin = rescuePoint(from), target = rescuePoint(to);
        if (!rescue || !this.activeRescues.includes(rescue) || rescue._routeRequestInFlight || rescue._routeAccessDenied || !origin || !target)
            return false;
        if (Number(rescue._routeRetryAtMs || 0) > Date.now())
            return false;
        const phase = returning ? 'routing_return' : 'routing';
        rescue.state = phase;
        rescue.speed = 0;
        const current = () => this.activeRescues.includes(rescue) && rescue.state === phase;
        const fail = (error) => {
            if (!current())
                return;
            const f = rescueRouteFailure(error, Number(rescue._routeFailureCount || 0));
            rescue._routeFailureCount = f.attempts;
            rescue._routeRetrySec = f.retrySec;
            rescue._routeRetryAtMs = f.retryAtMs;
            rescue._routeAccessDenied = f.accessDenied;
            rescue.routeStatusMessage = f.message;
        };
        const orm = globalThis.window?.game?.orm;
        if (!orm?.findRoute) {
            fail('Service de routage indisponible');
            return false;
        }
        rescue._routeRequestInFlight = true;
        rescue.routeStatusMessage = 'Recherche du tracé ferroviaire';
        // Start inside a promise so a synchronous provider exception cannot leak the
        // deployed locomotive or abort the game's movement loop.
        Promise.resolve().then(() => current() ? orm.findRoute(origin.lat, origin.lon, target.lat, target.lon) : null)
            .then((raw) => {
            if (!current())
                return;
            const route = validatedRescueRoute(raw, origin, target);
            if (!route) {
                fail('Tracé refusé : géométrie ou extrémités incohérentes');
                return;
            }
            const liveService = !returning ? globalThis.window?.game?.scheduleCreator?.services?.find((s) => s.id === rescue.targetServiceId) : null;
            const liveTarget = rescuePoint(liveService?.position);
            const movedOrigin = rescuePoint(rescue.position);
            const movedTarget = rescuePoint(rescue.targetPosition);
            if (!movedOrigin || !movedTarget || rescueDistanceKm(origin, movedOrigin) > RESCUE_ENDPOINT_TOLERANCE_KM || rescueDistanceKm(target, movedTarget) > RESCUE_ENDPOINT_TOLERANCE_KM || (liveTarget && rescueDistanceKm(target, liveTarget) > RESCUE_ENDPOINT_TOLERANCE_KM)) {
                if (liveTarget)
                    rescue.targetPosition = liveTarget;
                fail('Position modifiée pendant le calcul : tracé à recalculer');
                return;
            }
            if (returning)
                rescue.returnRoute = route;
            else
                rescue.route = route;
            rescue.routeIndex = 0;
            rescue._routeRetrySec = 0;
            rescue._routeRetryAtMs = 0;
            rescue._routeFailureCount = 0;
            rescue.routeStatusMessage = '';
            rescue.state = returning ? 'returning' : 'en_route';
        }).catch(fail).finally(() => { rescue._routeRequestInFlight = false; });
        return true;
    }
    resumeRescueRouting(id) {
        const rescue = this.activeRescues.find(r => r.id === String(id));
        if (!rescue || !['routing', 'routing_return'].includes(rescue.state) || rescue._routeRequestInFlight || Number(rescue._routeRetryAtMs || 0) > Date.now())
            return false;
        rescue._routeAccessDenied = false;
        rescue._routeRetrySec = 0;
        rescue._routeRetryAtMs = 0;
        return !!rescue.targetPosition && this._requestRescueRoute(rescue, rescue.position, rescue.targetPosition, rescue.state === 'routing_return');
    }
    /** The mission, not a transient train flag, owns an attached consist. */
    hasRescuedOccurrence(serviceId) { return this.rescuedOccurrenceIds.has(String(serviceId)); }
    ownsServiceMovement(serviceId) {
        return this.activeRescues.some(r => r.targetServiceId === String(serviceId) && r.towAttached === true && r.state !== 'done');
    }
    isVehicleUnderRepair(vehicleId) {
        return this.repairQueue.some(q => q.vehicleIds?.includes(String(vehicleId)));
    }
    getRescuedFormations(depotId) {
        return this.rescuedFormations.filter(f => f.depotId === String(depotId)).map(f => ({ ...f, vehicleIds: [...f.vehicleIds], repairing: this.repairQueue.some(q => q.serviceId === f.serviceId) }));
    }
    reconcileRescuedFormations() {
        const rotation = globalThis.window?.game?.rotationV2;
        if (!rotation?.getVehicle)
            return;
        this.rescuedFormations = this.rescuedFormations.filter(f => {
            if (this.repairQueue.some(q => q.serviceId === f.serviceId))
                return true;
            // A physical-only formation is a parking record, NOT another purchased rame.
            // Keep its bay until every known member has actually left this depot.
            const left = f.vehicleIds.length > 0 && f.vehicleIds.every(id => {
                const v = rotation.getVehicle(id);
                return !!v?.location?.id && !(v.location.kind === 'DEPOT' && v.location.id === f.depotId);
            });
            if (!left)
                return true;
            const slot = this.getDepotById(f.depotId)?.findRameTrack(f.id);
            if (slot) {
                slot.rameId = '';
                slot.purpose = 'garage';
                slot.operationId = '';
            }
            return false;
        });
    }
    restoreRescueTow(serviceId) {
        const rescue = this.activeRescues.find(r => r.targetServiceId === String(serviceId) && r.towAttached === true && r.state !== 'done');
        return !!rescue && this._syncRescueTow(rescue, 0);
    }
    /** Only a genuine stopped rendezvous target can share a block with its
     * rescue. A third train is NEVER part of this authorisation. */
    isRescueCouplingAuthorized(a, b) {
        const r = this.activeRescues.find(r => (r.id === a && r.targetServiceId === b) || (r.id === b && r.targetServiceId === a));
        if (!r || r.state === 'done' || !r.position)
            return false;
        const target = this._rescueTarget(r);
        if (!target?.position || target.cancelled || target.completed)
            return false;
        if (r.towAttached)
            return rescueDistanceKm(r.position, target.position) <= RESCUE_ENDPOINT_TOLERANCE_KM;
        return ['en_route', 'recovering'].includes(r.state) && Math.abs(Number(target.speed || 0)) <= .01
            && !!r.targetPosition && rescueDistanceKm(target.position, r.targetPosition) <= .001
            && rescueDistanceKm(r.position, target.position) <= 2;
    }
    getPhysicalRescueService(id) { return this._rescueMovements.get(String(id)); }
    /** Occupation liveness remains true during load, before controllers exist. */
    hasPhysicalRescue(id) { return this.activeRescues.some(r => r.id === id && r.state !== 'done' && !!r.position); }
    getPhysicalRescueServices() {
        for (const rescue of this.activeRescues)
            this._prepareRescueMovement(rescue);
        return [...this._rescueMovements.values()].filter(s => this.activeRescues.some(r => r.id === s.id && r.state !== 'done'));
    }
    _prepareRescueMovement(rescue) {
        const game = globalThis.window?.game;
        if (rescue._motionInvalid) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Secours suspendu : état physique sauvegardé invalide';
            return null;
        }
        const returning = rescue.state === 'returning' || rescue.state === 'routing_return' && rescue.towAttached === true;
        const route = returning ? rescue.returnRoute : rescue.route;
        let controller = this._rescueMovements.get(rescue.id);
        if (!route || route.length < 2 || !rescue.position || !game)
            return controller || null;
        if (!controller) {
            const rames = game.rameManager?.getAll?.() || [];
            const parent = rames.find(r => r.elementDetails?.some(e => e.elementId === rescue.stockId));
            const detail = parent?.elementDetails.find(e => e.elementId === rescue.stockId) || game.rollingStock?.getById?.(rescue.stockId);
            if (!detail || !(Number(detail.power) > 0) || !(Number(detail.mass || detail.tonnage) > 0) || !(Number(detail.length) > 0) || !(Number(detail.maxSpeed) > 0)) {
                rescue.speed = 0;
                rescue.routeStatusMessage = 'Secours retenu : caractéristiques physiques du matériel manquantes';
                return null;
            }
            const registered = this.getDepotById(rescue.depotId)?.rescueLocos.find(l => l.stockId === rescue.stockId);
            const material = new Rame({ id: rescue.id + ':material', name: rescue.stockName, elementDetails: [{ ...detail, category: 'locomotive' }], consumables: rescue.movementSnapshot?.consumables || registered?.consumables || parent?.consumables,
                totalKmRun: Number(registered?.totalKmRun || 0) });
            controller = new RescueMovement(rescue.id, material, game.world, game.weather);
            // Register before initializing occupations so cleanup can resolve its owner.
            this._rescueMovements.set(rescue.id, controller);
        }
        if (controller.routeIdentity !== route || controller.returning !== returning) {
            const snapshot = rescue.movementSnapshot?.returning === returning ? rescue.movementSnapshot : undefined;
            if (rescue.route)
                cantonManager.createRouteCantons(rescue.route);
            const target = this._rescueTarget(rescue);
            if (target?.getCurrentRoute?.())
                cantonManager.createRouteCantons(target.getCurrentRoute());
            controller.configure(route, rescue.position, returning, target, snapshot);
            if (!snapshot)
                controller.speed = Math.max(0, Number(rescue.speed) || 0);
            controller._economy = game.economy;
            controller._currentDate = game._currentDate || target?._currentDate || '';
            if (returning && target) {
                const retained = cantonManager.transferTrainResources(target.id, controller.id);
                controller._carryoverCantonIds = new Set([...(controller._carryoverCantonIds || []), ...retained]);
                if (!snapshot)
                    controller._carryoverStartTravelKm = controller.totalDistance;
                for (const trc of game.voiePointManager?.troncons || []) {
                    if (trc.occupiedBy === target.id) {
                        trc.occupiedBy = controller.id;
                        controller._occupiedTronconIds.add(trc.id);
                        controller._tronconExitTravelKm.set(trc.id, controller.totalDistance);
                    }
                    if (trc.reservedBy === target.id)
                        trc.reservedBy = controller.id;
                }
                controller._syncCantonFootprint(route);
            }
        }
        return controller;
    }
    _moveRescue(rescue, dt, timeOfDay, fleet) {
        const controller = this._prepareRescueMovement(rescue);
        if (!controller)
            return false;
        const returning = rescue.state === 'returning';
        if (returning && !rescue.towAttached)
            return false;
        controller._currentDate = globalThis.window?.game?._currentDate || controller._currentDate;
        const distance = rescue.targetPosition && rescue.position ? rescueDistanceKm(rescue.position, rescue.targetPosition) : Infinity;
        controller.setPhaseLimit(returning ? 60 : distance < .5 ? 10 : distance < 2 ? 30 : 100);
        const before = controller.totalDistance;
        if (controller.arrived) {
            rescue.speed = 0;
        }
        else {
            // The engine already uses 100 ms. Direct calls/tests also use the same
            // bounded physical step; no fast path bypasses the shared constraints.
            let remaining = dt;
            while (remaining > 1e-9 && !controller.arrived) {
                const step = Math.min(.1, remaining);
                controller.moveUpdate(step, timeOfDay + (dt - remaining) / 60, fleet);
                remaining -= step;
            }
            rescue.position = controller.position ? { ...controller.position } : rescue.position;
            rescue.speed = controller.speed;
            rescue.routeIndex = controller._state.index;
            rescue.routeStatusMessage = controller.train.delayReason || '';
        }
        rescue.movementSnapshot = controller.snapshot();
        // The locomotive's fuel and odometer belong to the depot roster, not to
        // a disposable mission controller. A second dispatch cannot refill it.
        const registered = this.getDepotById(rescue.depotId)?.rescueLocos.find(l => l.stockId === rescue.stockId);
        if (registered && controller.rame) {
            registered.consumables = { ...controller.rame.consumables };
            registered.totalKmRun = Number(controller.rame.totalKmRun || 0);
        }
        if (returning) {
            if (!this._syncRescueTow(rescue, Math.max(0, controller.totalDistance - before)))
                return false;
            if (controller.arrived) {
                if (this._deliverRescueTow(rescue)) {
                    controller._releaseAllPhysicalResources();
                    this._rescueMovements.delete(rescue.id);
                }
            }
        }
        else if (controller.arrived) {
            const target = this._rescueTarget(rescue);
            if (!target?.position || !rescue.position || rescueDistanceKm(rescue.position, target.position) > RESCUE_ENDPOINT_TOLERANCE_KM) {
                rescue.state = 'routing';
                rescue.route = null;
                rescue.speed = 0;
                rescue.routeIndex = 0;
                rescue.routeStatusMessage = 'Le train cible a bougé : nouveau tracé requis';
            }
            else {
                rescue.state = 'recovering';
                rescue.speed = 0;
                rescue._recoverTimer = 5;
            }
        }
        return true;
    }
    _rescueTarget(rescue) {
        return globalThis.window?.game?.scheduleCreator?.services?.find((s) => String(s.id) === rescue.targetServiceId) || null;
    }
    _attachRescueTow(rescue) {
        const target = this._rescueTarget(rescue);
        const position = rescuePoint(target?.position);
        if (!target?.train || !position || !rescue.position) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Prise en charge suspendue : train cible absent';
            return false;
        }
        if (rescueDistanceKm(rescue.position, position) > RESCUE_ENDPOINT_TOLERANCE_KM ||
            Math.abs(Number(target.speed ?? target.train.speed ?? 0)) > 0.01) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Prise en charge suspendue : train cible non immobilisé à l’accostage';
            return false;
        }
        rescue.towAttached = true;
        rescue.towDistanceKm = Math.max(0, Number(rescue.towDistanceKm) || 0);
        rescue.towRameId = String(target._v2DirectRameId || target._v2AssignedRameId || target.rame?.id || target.rameId || '');
        rescue.towVehicleIds = Array.isArray(target._v2VehicleIds) ? target._v2VehicleIds.map(String) : [];
        target.speed = target.train.speed = 0;
        target.train.state = 'pris en charge';
        target.train.delayReason = 'Secours attelé — attente du tracé de retour';
        target._movementStop?.('RESCUE_TOW', target.train.delayReason, 'depot');
        return true;
    }
    /** Restore/publish the consist on the SAME resolved return path. Coordinates
     * are the convoy's common map reference, not independently modelled couplers.
     * The original timetable never advances, earns revenue or consumes traction.
     */
    _syncRescueTow(rescue, movedKm = 0) {
        const target = this._rescueTarget(rescue);
        if (!rescue.towAttached || !target?.train || !rescue.position) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Remorquage suspendu : train cible indisponible';
            return false;
        }
        const game = globalThis.window?.game;
        const material = game?.rameManager?.getById?.(rescue.towRameId) || target.rame;
        if (!material || material.currentLocation?.depotId) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Remorquage suspendu : matériel absent ou déjà localisé dans un dépôt';
            return false;
        }
        target.position = { ...rescue.position };
        target.speed = Number(rescue.speed) || 0;
        target.train.speed = Math.round(target.speed);
        target.state = 'moving';
        target.train.state = 'remorqué';
        target.train.delayReason = rescue.routeStatusMessage || 'Acheminement au dépôt par le secours';
        target.train.stoppedAt = null;
        target._movementStop?.('RESCUE_TOW', 'Traction propre neutralisée : remorquage', 'depot');
        const route = rescue.returnRoute;
        if (route && route.length >= 2 && target._state) {
            if (target._state.cachedRoute !== route) {
                target._captureCantonCarryover?.();
                target._initializeState?.(route, `rescue:${rescue.id}`);
            }
            if (target._state.cachedRoute === route) {
                target._state.index = Math.min(rescue.routeIndex, route.length - 1);
                const from = route[target._state.index], to = route[target._state.index + 1];
                const length = to ? rescueDistanceKm(from, to) : 0;
                target._state.progress = length > 0 ? Math.min(1, rescueDistanceKm(from, rescue.position) / length) : 0;
                if (!this._rescueMovements.has(rescue.id))
                    target._syncCantonFootprint?.(route);
                target._releaseDepartureResourcesIfTailClear?.(route);
            }
        }
        if (movedKm > 0 && Number.isFinite(movedKm)) {
            rescue.towDistanceKm = (Number(rescue.towDistanceKm) || 0) + movedKm;
            // Service accounting excludes the rescue diversion; material odometers do not.
            advanceMaterialMileage(material, target.train, movedKm);
            if (material && target.rame && material !== target.rame) {
                for (const key of ['totalKmRun', 'kmSinceLastMaint', 'wearLevel'])
                    target.rame[key] = material[key];
            }
            for (const id of rescue.towVehicleIds || []) {
                const v = game?.rotationV2?.getVehicle?.(id);
                if (v)
                    v.odometerKm = Math.max(0, Number(v.odometerKm) || 0) + movedKm;
            }
        }
        if (material)
            material.currentLocation = { depotId: '', stationId: '', serviceId: target.id, lat: rescue.position.lat, lon: rescue.position.lon };
        target._movementStop?.('RESCUE_TOW', 'Traction propre neutralisée : remorquage', 'depot');
        return true;
    }
    _deliverRescueTow(rescue) {
        const target = this._rescueTarget(rescue), game = globalThis.window?.game;
        const depot = this.getDepotById(rescue.depotId);
        const material = game?.rameManager?.getById?.(rescue.towRameId) || target?.rame;
        if (!rescue.towAttached || !target?.train || !depot?.built || !rescue.position || !rescue.depotPosition ||
            rescueDistanceKm(rescue.position, rescue.depotPosition) > RESCUE_ENDPOINT_TOLERANCE_KM) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Réception au dépôt suspendue : convoi ou dépôt indisponible';
            return false;
        }
        if (!material || (rescue.towVehicleIds || []).some(id => !game?.rotationV2?.getVehicle?.(id))) {
            rescue.speed = 0;
            rescue.routeStatusMessage = 'Réception suspendue : matériel introuvable';
            return false;
        }
        // Do not mark the mission done, free its locomotive, or start repairing while
        // depot admission can still fail. The whole consist remains at the endpoint.
        if (material) {
            const result = this.enterRame(depot.id, material, []);
            if (!result.ok) {
                rescue.speed = target.speed = target.train.speed = 0;
                rescue.routeStatusMessage = result.reason || 'Dépôt indisponible';
                return false;
            }
            material.currentLocation = { ...material.currentLocation, lat: rescue.depotPosition.lat, lon: rescue.depotPosition.lon };
            material.inMaintenance = true;
            if (target.rame && target.rame !== material) {
                target.rame.currentLocation = { ...material.currentLocation };
                target.rame.inMaintenance = true;
            }
        }
        if ((rescue.towVehicleIds || []).length && !game?.rameManager?.getById?.(rescue.towRameId) && !this.rescuedFormations.some(f => f.serviceId === target.id)) {
            this.rescuedFormations.push({ id: material.id, name: String(material.name || target.name || target.id), depotId: depot.id, serviceId: target.id, vehicleIds: [...(rescue.towVehicleIds || [])] });
        }
        for (const id of rescue.towVehicleIds || []) {
            const v = game?.rotationV2?.getVehicle?.(id);
            if (v) {
                v.available = false;
                v.location = { kind: 'DEPOT', id: depot.id, depotId: depot.id, lat: rescue.depotPosition.lat, lon: rescue.depotPosition.lon };
            }
        }
        target._releaseAllPhysicalResources?.();
        target._finishLegacyOperatingDay?.();
        target.speed = target.train.speed = 0;
        target.completed = true;
        target.cancelled = true;
        target.state = 'cancelled';
        target.train.inDepot = true;
        target.train.inMaintenance = true;
        target.train.state = 'au dépôt';
        target.train.delayReason = 'Service interrompu — rame remorquée au dépôt';
        target.train.stoppedAt = null;
        target.position = null;
        // This mission has already committed physical material placement; normal V2
        // finalization must not move it to a booked stop or free broken vehicles.
        if (target._v2OccurrenceId) {
            target._v2MaterialFinalized = true;
            this.rescuedOccurrenceIds.add(target.id);
        }
        if (!this.repairQueue.some(q => q.serviceId === rescue.targetServiceId))
            this.repairQueue.push({
                serviceId: rescue.targetServiceId, depotId: rescue.depotId, rameId: rescue.towRameId,
                vehicleIds: [...(rescue.towVehicleIds || [])], remainingMin: 30, totalMin: 30,
                serviceName: String(target.name || target.id), repairType: rescue.repairType || 'moteur',
            });
        rescue.state = 'done';
        rescue.speed = 0;
        depot.returnRescue(rescue.stockId);
        game?.scheduleCreator?._invalidateActiveCache?.();
        return true;
    }
    // Update active rescues (called each move tick)
    updateRescues(dt, timeOfDay = Number(globalThis.window?.game?.timeOfDay || 0), physicalFleet) {
        if (!Number.isFinite(dt) || dt <= 0)
            return;
        this.reconcileRescuedFormations();
        const fleet = physicalFleet || [...(globalThis.window?.game?.scheduleCreator?.services || []).filter((s) => !this.ownsServiceMovement(s.id)), ...this.getPhysicalRescueServices()];
        for (const rescue of this.activeRescues) {
            if (!rescue.position || !rescue.targetPosition)
                continue;
            if (rescue.state === 'routing' || rescue.state === 'routing_return') {
                rescue.speed = 0;
                rescue._routeRetrySec = Math.max(0, Number(rescue._routeRetrySec || 0) - Number(dt || 0));
                if (!rescue._routeAccessDenied && !rescue._routeRequestInFlight && rescue._routeRetrySec <= 0 && Number(rescue._routeRetryAtMs || 0) <= Date.now()) {
                    const liveService = rescue.state === 'routing' ? globalThis.window?.game?.scheduleCreator?.services?.find((s) => s.id === rescue.targetServiceId) : null;
                    const liveTarget = rescuePoint(liveService?.position);
                    if (liveTarget)
                        rescue.targetPosition = liveTarget;
                    this._requestRescueRoute(rescue, rescue.position, rescue.targetPosition, rescue.state === 'routing_return');
                }
                continue;
            }
            if (rescue.state === 'en_route') {
                const actualTarget = rescuePoint(this._rescueTarget(rescue)?.position);
                if (actualTarget && rescueDistanceKm(actualTarget, rescue.targetPosition) > RESCUE_ENDPOINT_TOLERANCE_KM) {
                    rescue.targetPosition = actualTarget;
                    rescue.state = 'routing';
                    rescue.route = null;
                    rescue.speed = 0;
                    rescue.routeIndex = 0;
                    rescue.movementSnapshot = undefined;
                    const old = this._rescueMovements.get(rescue.id);
                    if (old) {
                        old.speed = old.train.speed = 0;
                    }
                    rescue.routeStatusMessage = 'Train cible déplacé : recalcul du trajet depuis la position réelle';
                    continue;
                }
                if (!rescue.route || rescue.route.length < 2) {
                    rescue.state = 'routing';
                    rescue.speed = 0;
                    rescue._routeRetrySec = 0;
                    continue;
                }
                this._moveRescue(rescue, dt, timeOfDay, fleet);
            }
            else if (rescue.state === 'recovering') {
                const target = globalThis.window?.game?.scheduleCreator?.services?.find((s) => s.id === rescue.targetServiceId);
                const position = rescuePoint(target?.position);
                if (position && rescueDistanceKm(rescue.position, position) > RESCUE_ENDPOINT_TOLERANCE_KM) {
                    rescue.targetPosition = position;
                    rescue.state = 'routing';
                    rescue.speed = 0;
                    rescue.route = null;
                    rescue.routeIndex = 0;
                    rescue._recoverTimer = 5;
                    rescue.routeStatusMessage = 'Accostage interrompu : le train cible a bougé';
                    continue;
                }
                // dt is in seconds; _recoverTimer is in minutes
                rescue._recoverTimer = (Number.isFinite(rescue._recoverTimer) ? rescue._recoverTimer : 5) - dt / 60;
                if (rescue._recoverTimer <= 0) {
                    if (!this._attachRescueTow(rescue))
                        continue;
                    rescue.targetPosition = rescue.depotPosition;
                    rescue.speed = 0;
                    rescue.returnRoute = null;
                    rescue.routeIndex = 0;
                    rescue.state = 'routing_return';
                    this._requestRescueRoute(rescue, rescue.position, rescue.depotPosition, true);
                }
            }
            else if (rescue.state === 'returning') {
                if (!rescue.towAttached) {
                    // RC14 saved returns did not actually carry the target. Never teleport
                    // that train to a returning locomotive during migration.
                    const target = rescuePoint(this._rescueTarget(rescue)?.position);
                    rescue.speed = 0;
                    if (target) {
                        rescue.targetPosition = target;
                        rescue.state = 'routing';
                        rescue.route = null;
                        rescue.returnRoute = null;
                        rescue.routeIndex = 0;
                        rescue._routeRetrySec = 0;
                        rescue.routeStatusMessage = 'Ancien retour sans train : reprise du secours à la position réelle';
                    }
                    else
                        rescue.routeStatusMessage = 'Ancien retour suspendu : train cible absent';
                    continue;
                }
                const towTarget = this._rescueTarget(rescue);
                if (!towTarget?.position || towTarget.cancelled || towTarget.completed || !rescue.depotPosition || !this.getDepotById(rescue.depotId)?.built) {
                    rescue.speed = 0;
                    rescue.routeStatusMessage = 'Remorquage suspendu : train cible ou dépôt absent';
                    continue;
                }
                const towMaterial = globalThis.window?.game?.rameManager?.getById?.(rescue.towRameId) || towTarget.rame;
                if (rescueDistanceKm(rescue.position, towTarget.position) > RESCUE_ENDPOINT_TOLERANCE_KM ||
                    !towMaterial || towMaterial.currentLocation?.depotId ||
                    (rescue.towRameId && String(towTarget._v2DirectRameId || towTarget._v2AssignedRameId || towTarget.rame?.id || '') !== rescue.towRameId)) {
                    rescue.speed = towTarget.speed = towTarget.train.speed = 0;
                    rescue.routeStatusMessage = 'Remorquage suspendu : localisation ou composition du matériel incohérente';
                    continue;
                }
                if (!rescue.returnRoute || rescue.returnRoute.length < 2) {
                    rescue.state = 'routing_return';
                    rescue.speed = 0;
                    rescue._routeRetrySec = 0;
                    continue;
                }
                this._moveRescue(rescue, dt, timeOfDay, fleet);
            }
        }
        // Remove completed rescues
        this.activeRescues = this.activeRescues.filter((r) => r.state !== 'done');
    }
    // Update repair & maintenance timers (called each minute tick)
    updateRepairs(dt) {
        const rawStep = Number(dt);
        const step = Number.isFinite(rawStep) ? Math.max(0, rawStep) : 1; // preserve an explicit dt=0 on load/initialisation
        const finished = [];
        for (const r of this.repairQueue) {
            r.remainingMin -= step;
            if (r.remainingMin <= 0)
                finished.push(r);
        }
        for (const r of finished) {
            // Section VI — consommation de pièces détachées pour la réparation
            const depot = this.depots.find((d) => d.id === r.depotId);
            const type = r.repairType || 'moteur';
            const needed = { moteur: 1, freins: 1, climatisation: 1, portes: 1, fanaux: 1 };
            if (!depot || depot.type !== 'depot' || !depot.built) {
                r.remainingMin = 60; // le dépôt a disparu / n'est pas opérationnel : ne jamais réparer magiquement
            }
            else if (needed[type]) {
                depot.consumeSpareParts({ [type]: needed[type] }) || (r.remainingMin = 60); // attendre pièces
            }
            if (r.remainingMin <= 0) {
                this.repairQueue = this.repairQueue.filter((q) => q.serviceId !== r.serviceId);
            }
        }
        const finishedM = [];
        for (const m of this.maintenanceQueue) {
            m.remainingMin -= step;
            if (m.remainingMin <= 0)
                finishedM.push(m);
        }
        for (const m of finishedM) {
            this.maintenanceQueue = this.maintenanceQueue.filter((q) => q.rameId !== m.rameId);
        }
        return {
            repaired: finished.filter((r) => r.remainingMin <= 0).map((r) => ({ serviceId: r.serviceId, depotId: r.depotId, repairType: r.repairType, rameId: r.rameId, vehicleIds: [...(r.vehicleIds || [])] })),
            maintainedIds: finishedM.map((m) => m.rameId),
        };
    }
    // MNT-06 : vérification mensuelle de la maintenance préventive recommandée
    checkPreventiveMaintenance(dateStr, rameManager) {
        if (!dateStr || !rameManager)
            return;
        const month = dateStr.slice(0, 7); // YYYY-MM
        for (const rame of rameManager.getAll()) {
            if (rame.inMaintenance || this.isRameInMaintenance(rame.id)) {
                rame.recommendedMaintenance = false;
                continue;
            }
            const noMaint = !rame.lastMaintenanceMonth;
            const monthChanged = rame.lastMaintenanceMonth !== month;
            const used = rame.kmSinceLastMaint > 2000 || rame.wearLevel > 20;
            const needs = noMaint || (monthChanged && used);
            rame.recommendedMaintenance = needs;
        }
    }
    // MNT-05 : liste des dépôts avec pièces détachées en sous-stock
    getLowStockDepots(threshold = 2) {
        const result = [];
        for (const depot of this.depots) {
            if (depot.type !== 'depot' || !depot.built)
                continue;
            const low = Object.entries(depot.spareParts || {})
                .filter(([, qty]) => Number(qty) < Number(threshold))
                .map(([type]) => type);
            if (low.length > 0)
                result.push({ depot, low });
        }
        return result;
    }
    // MNT-05 : livraison groupée de pièces détachées vers plusieurs dépôts
    buyBulkSpareParts(type, qty, economy) {
        qty = Number(qty);
        if (!Number.isInteger(qty) || qty <= 0 || !economy)
            return { ok: false, totalCost: 0, invalid: true };
        const prices = { moteur: 5000, freins: 3000, climatisation: 2000, portes: 1500, fanaux: 1000 };
        const partType = String(type || '');
        const price = prices[partType] || 1000;
        const targets = this.depots.filter((d) => d.type === 'depot' && d.built);
        const totalCost = price * qty * targets.length;
        if (economy.balance < totalCost)
            return { ok: false, totalCost };
        economy.addExpense(totalCost, 'maintenance', `Livraison groupée pièces : ${partType} x${qty} (${targets.length} dépôts)`);
        for (const depot of targets)
            depot.addSpareParts(type, qty);
        return { ok: true, totalCost, count: targets.length };
    }
    // Send a RAME for preventive maintenance
    sendRameToMaintenance(rameId, rameName, depotId) {
        rameId = String(rameId ?? '');
        depotId = String(depotId ?? '');
        if (!rameId || !depotId || this.maintenanceQueue.some((m) => m.rameId === rameId))
            return false;
        const depot = this.depots.find((d) => d.id === depotId);
        if (!depot || depot.type !== 'depot' || !depot.built)
            return false;
        const game = typeof window !== 'undefined' ? window.game : null;
        const rame = game?.rameManager?.getById?.(rameId);
        if (rame) {
            const inService = (game?.scheduleCreator?.services || []).some((s) => (s.rame?.id === rameId || s._v2DirectRameId === rameId || s._v2AssignedRameId === rameId) &&
                !s.completed && !s.cancelled && s.position && (s.state === 'moving' || s.state === 'departing' || Number(s.currentStopIndex) > 0));
            if (inService || (rame.currentLocation?.depotId !== depotId && !depot.findRameTrack?.(rameId)))
                return false;
        }
        const duration = depot.getMaintenanceDuration(20);
        this.maintenanceQueue.push({
            rameId: rameId,
            depotId: depotId,
            remainingMin: duration,
            totalMin: duration,
            rameName: (rameName || rameId),
        });
        return true;
    }
    isRameInMaintenance(rameId) {
        return this.maintenanceQueue.some((m) => m.rameId === rameId);
    }
    getRameMaintenanceInfo(rameId) {
        return this.maintenanceQueue.find((m) => m.rameId === rameId) || null;
    }
    isInRepairOrMaintenance(serviceId) {
        return this.repairQueue.some((r) => r.serviceId === serviceId);
    }
    getRepairInfo(serviceId) {
        return this.repairQueue.find((r) => r.serviceId === serviceId) || null;
    }
    // Get active rescues as pseudo-services for rendering on map
    getRescueServices() {
        return this.activeRescues.filter((r) => r.position).map((r) => ({
            id: r.id,
            name: r.stockName || 'Secours',
            position: r.position,
            state: 'moving',
            isRescue: true,
            rescueState: r.state,
            rescueCanRetry: ['routing', 'routing_return'].includes(r.state) && !r._routeRequestInFlight && Number(r._routeRetryAtMs || 0) <= Date.now(),
            train: {
                speed: Math.round(r.speed),
                delayReason: r.routeStatusMessage || '',
                color: '#ef4444', // red for rescue
                stoppedAt: null,
                incident: null,
                delay: 0,
                seriesName: '',
                number: '',
                platform: null,
            },
        }));
    }
    toSave() {
        return {
            rescuedOccurrenceIds: [...this.rescuedOccurrenceIds],
            rescuedFormations: this.rescuedFormations.map(f => ({ ...f, vehicleIds: [...f.vehicleIds] })),
            depots: this.depots.map((d) => ({
                id: d.id,
                type: d.type,
                name: d.name,
                stationId: d.stationId,
                stationUpgradeSource: d.stationUpgradeSource,
                stationUpgradeTracks: d.stationUpgradeTracks,
                tracks: d.tracks,
                cost: d.cost,
                built: d.built,
                infrastructure: d.infrastructure,
                equipmentInventory: d.equipmentInventory,
                ramesStored: d.ramesStored,
                schemaVersion: d.schemaVersion || 1,
                location: d.location,
                placementOnly: d.placementOnly === true,
                railSections: d.railSections,
                iteTracks: d.iteTracks,
                iteCargoTypes: d.iteCargoTypes,
                rescueLocos: d.rescueLocos,
                spareParts: d.spareParts,
                partInventory: d.partInventory,
                resourceStocks: d.resourceStocks,
                resourceCapacities: d.resourceCapacities,
                resourceUsage: d.resourceUsage,
                trackOccupancy: d.trackOccupancy,
                utilityTotals: d.utilityTotals,
                expenseLedger: d.expenseLedger,
            })),
            // Route callbacks and later movement must not mutate an in-flight save.
            activeRescues: this.activeRescues.map(r => ({ ...r, movementSnapshot: this._rescueMovements.get(r.id)?.snapshot() || r.movementSnapshot, _routeRequestInFlight: false, towVehicleIds: [...(r.towVehicleIds || [])],
                position: r.position ? { ...r.position } : null, targetPosition: r.targetPosition ? { ...r.targetPosition } : null, depotPosition: r.depotPosition ? { ...r.depotPosition } : null,
                route: r.route?.map(p => ({ ...p })) ?? null, returnRoute: r.returnRoute?.map(p => ({ ...p })) ?? null })),
            repairQueue: this.repairQueue.map(q => ({ ...q, vehicleIds: [...(q.vehicleIds || [])] })),
            maintenanceQueue: this.maintenanceQueue,
            depotOperations: this.depotOperations,
        };
    }
    loadFromSave(data) {
        for (const s of this._rescueMovements.values())
            s._releaseAllPhysicalResources();
        this._rescueMovements.clear();
        this.depots = [];
        this.activeRescues = [];
        this.depotOperations = [];
        this.rescuedFormations = [];
        // Support both old format (array) and new format (object with depots + activeRescues)
        const obj = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        this.rescuedOccurrenceIds = new Set(Array.isArray(obj.rescuedOccurrenceIds) ? obj.rescuedOccurrenceIds.filter((x) => typeof x === 'string' && x.startsWith('v2:')) : []);
        const arr = Array.isArray(data) ? data : (Array.isArray(obj.depots) ? obj.depots : []);
        const seenDepotIds = new Set();
        for (const d of arr) {
            if (!d || typeof d !== 'object')
                continue;
            const normalized = { ...d, id: String(d.id ?? ''), stationId: String(d.stationId ?? '') };
            const depot = new Depot(normalized);
            if (!depot.id || seenDepotIds.has(depot.id) || !depot.stationId || !['depot', 'ite-fret', 'ite-industrie', 'ite-logistique'].includes(depot.type))
                continue;
            seenDepotIds.add(depot.id);
            this.depots.push(depot);
            const num = parseInt(String(d.id).split('-')[1] || '0');
            if (num >= nextDepotId)
                nextDepotId = num + 1;
        }
        if (!Array.isArray(data) && Array.isArray(obj.activeRescues)) {
            const rescueStates = new Set(['routing', 'en_route', 'recovering', 'routing_return', 'returning', 'done']);
            const validCoord = (p) => rescuePoint(p) !== null;
            const seenRescueIds = new Set(), seenRescueLocos = new Set();
            this.activeRescues = obj.activeRescues.filter((r) => r && typeof r === 'object' && !Array.isArray(r)).map((raw) => {
                const r = raw;
                const depotId = String(r.depotId ?? ''), stockId = String(r.stockId ?? ''), id = String(r.id ?? '');
                if (!depotId || !stockId || !id || seenRescueIds.has(id) || seenRescueLocos.has(`${depotId}|${stockId}`))
                    return null;
                seenRescueIds.add(id);
                seenRescueLocos.add(`${depotId}|${stockId}`);
                const rawState = String(r.state || '');
                const state = rescueStates.has(rawState) ? rawState : 'routing';
                const finite = (v, fb = 0) => Number.isFinite(Number(v)) ? Number(v) : fb;
                const route = validatedRescueRoute(r.route);
                const returnRoute = validatedRescueRoute(r.returnRoute);
                const motion = validRescueMotion(r.movementSnapshot);
                const invalidMotion = r._motionInvalid === true || (r.movementSnapshot != null && !motion);
                return { ...r, movementSnapshot: motion || undefined, _motionInvalid: invalidMotion, id, depotId, stockId, towAttached: r.towAttached === true, towDistanceKm: Math.max(0, finite(r.towDistanceKm)), towRameId: typeof r.towRameId === 'string' ? r.towRameId : '', towVehicleIds: Array.isArray(r.towVehicleIds) ? r.towVehicleIds.filter((v) => typeof v === 'string') : [], stockName: String(r.stockName || '').slice(0, 160), targetServiceId: String(r.targetServiceId ?? ''), state, position: validCoord(r.position) ? { lat: Number(r.position.lat), lon: Number(r.position.lon) } : null, targetPosition: validCoord(r.targetPosition) ? { lat: Number(r.targetPosition.lat), lon: Number(r.targetPosition.lon) } : null, depotPosition: validCoord(r.depotPosition) ? { lat: Number(r.depotPosition.lat), lon: Number(r.depotPosition.lon) } : null, speed: Math.max(0, finite(r.speed, 0)), progress: Math.max(0, finite(r.progress, 0)), route, returnRoute, routeIndex: Math.max(0, Math.floor(finite(r.routeIndex, 0))), _routeRequestInFlight: false, _routeRetrySec: Math.max(0, finite(r._routeRetrySec, 0)), _routeRetryAtMs: Math.max(0, finite(r._routeRetryAtMs, 0)), _routeFailureCount: Math.max(0, Math.min(16, Math.floor(finite(r._routeFailureCount, 0)))), _routeAccessDenied: r._routeAccessDenied === true, routeStatusMessage: typeof r.routeStatusMessage === 'string' ? r.routeStatusMessage.slice(0, 240) : '', _recoverTimer: typeof r._recoverTimer === 'number' ? Math.max(0, finite(r._recoverTimer, 5)) : 5 };
            }).filter(Boolean);
            for (const r of this.activeRescues) {
                let route = r.state === 'returning' ? r.returnRoute : r.route;
                const endpoint = r.state === 'returning' ? r.depotPosition : r.targetPosition;
                if (route && endpoint && rescueDistanceKm(route[route.length - 1], endpoint) > RESCUE_ENDPOINT_TOLERANCE_KM) {
                    if (r.state === 'returning')
                        r.returnRoute = null;
                    else
                        r.route = null;
                    route = null;
                }
                if (r._routeAccessDenied && !r._routeRetryAtMs)
                    r._routeRetryAtMs = Date.now() + 900000;
                if ((r.state === 'en_route' || r.state === 'returning') && !route) {
                    r.state = r.state === 'returning' ? 'routing_return' : 'routing';
                    r.speed = 0;
                    r.routeIndex = 0;
                    r.routeStatusMessage = 'Tracé sauvegardé invalide : recalcul nécessaire';
                }
                else if (route && (r.routeIndex >= route.length - 1) && r.position && rescueDistanceKm(r.position, route[route.length - 1]) > RESCUE_ENDPOINT_TOLERANCE_KM) {
                    // An out-of-range saved index is not evidence of a completed journey.
                    if (r.state === 'en_route' || r.state === 'returning') {
                        r.state = r.state === 'returning' ? 'routing_return' : 'routing';
                        r.speed = 0;
                        r.routeStatusMessage = 'Progression sauvegardée incohérente : recalcul nécessaire';
                    }
                    r.routeIndex = 0;
                }
                else if (route)
                    r.routeIndex = Math.min(r.routeIndex, route.length - 1);
                const num = parseInt(String(r.id || '').split('-')[1] || '0');
                if (num >= nextRescueId)
                    nextRescueId = num + 1;
            }
        }
        if (!Array.isArray(data) && Array.isArray(obj.maintenanceQueue)) {
            // Migrate old format (serviceId) to new format (rameId)
            const seenRames = new Set();
            this.maintenanceQueue = obj.maintenanceQueue
                .filter((m) => m && typeof m === 'object')
                .map((m) => { const rameId = String(m.rameId ?? m.serviceId ?? ''), depotId = String(m.depotId ?? ''), remaining = Number(m.remainingMin), total = Number(m.totalMin); return { rameId, depotId, remainingMin: remaining, totalMin: Number.isFinite(total) && total > 0 ? total : 20, rameName: String(m.rameName ?? m.serviceName ?? '') }; })
                .filter((m) => m.rameId && !seenRames.has(m.rameId) && Number.isFinite(m.remainingMin) && m.remainingMin > 0 && (seenRames.add(m.rameId), true));
        }
        else {
            this.maintenanceQueue = [];
        }
        if (!Array.isArray(data) && Array.isArray(obj.repairQueue)) {
            const seenServices = new Set();
            this.repairQueue = obj.repairQueue
                .filter((r) => r && typeof r === 'object')
                .map((r) => { const serviceId = String(r.serviceId ?? ''), depotId = String(r.depotId ?? ''), remaining = Number(r.remainingMin), total = Number(r.totalMin); return { serviceId, depotId, rameId: typeof r.rameId === 'string' ? r.rameId : '', vehicleIds: Array.isArray(r.vehicleIds) ? r.vehicleIds.filter((v) => typeof v === 'string') : [], remainingMin: remaining, totalMin: Number.isFinite(total) && total > 0 ? total : 30, serviceName: String(r.serviceName ?? ''), repairType: ['moteur', 'freins', 'climatisation', 'portes', 'fanaux'].includes(String(r.repairType ?? r.type)) ? String(r.repairType ?? r.type) : 'moteur' }; })
                .filter((r) => r.serviceId && !seenServices.has(r.serviceId) && Number.isFinite(r.remainingMin) && r.remainingMin > 0 && (seenServices.add(r.serviceId), true));
        }
        else {
            this.repairQueue = [];
        }
        if (!Array.isArray(data) && Array.isArray(obj.depotOperations)) {
            const seenOps = new Set();
            this.depotOperations = obj.depotOperations.filter((o) => o && typeof o === 'object').map((o) => {
                const id = String(o.id || ''), depotId = String(o.depotId || ''), rameId = String(o.rameId || ''), remaining = Math.max(0, Number(o.remainingMin) || 0), total = Math.max(1, Number(o.totalMin) || 1);
                if (!id || !depotId || !rameId || seenOps.has(id) || remaining <= 0)
                    return null;
                seenOps.add(id);
                const m = /^depot-op-(\d+)$/.exec(id);
                if (m && Number(m[1]) >= nextDepotOperationId)
                    nextDepotOperationId = Number(m[1]) + 1;
                return { ...o, id, depotId, rameId, rameName: String(o.rameName || ''), opId: String(o.opId || ''), label: String(o.label || ''), group: String(o.group || ''), remainingMin: remaining, totalMin: total, state: 'running', staff: o.staff && typeof o.staff === 'object' ? { ...o.staff } : {}, resources: o.resources && typeof o.resources === 'object' ? { ...o.resources } : {}, parts: o.parts && typeof o.parts === 'object' ? { ...o.parts } : {}, equipment: Array.isArray(o.equipment) ? o.equipment.filter((x) => DEPOT_EQUIPMENT_CATALOG[String(x)]) : [], staffIds: Array.isArray(o.staffIds) ? o.staffIds.map(String).filter(Boolean) : [] };
            }).filter(Boolean);
        }
        // Runtime promises do not survive reload. Reconcile deployment flags from the
        // actual restored rescue list so a vanished rescue can never lock a loco forever.
        const seenTargets = new Set();
        this.activeRescues = this.activeRescues.filter((r) => {
            if (r.state === 'done' || (r.targetServiceId && seenTargets.has(r.targetServiceId)))
                return false;
            const depot = this.getDepotById(r.depotId);
            const valid = !!(depot?.built && depot.type === 'depot' && depot.rescueLocos?.some((l) => l.stockId === r.stockId));
            if (valid && r.targetServiceId)
                seenTargets.add(r.targetServiceId);
            return valid;
        });
        const validBuiltDepotIds = new Set(this.depots.filter((d) => d.built).map((d) => d.id));
        const formationIds = new Set();
        for (const value of Array.isArray(obj.rescuedFormations) ? obj.rescuedFormations : []) {
            if (!value || typeof value !== 'object' || Array.isArray(value))
                continue;
            const f = value, id = String(f.id || ''), depotId = String(f.depotId || '');
            const vehicleIds = Array.isArray(f.vehicleIds) ? [...new Set(f.vehicleIds.filter((v) => typeof v === 'string' && !!v))] : [];
            if (!id || formationIds.has(id) || !validBuiltDepotIds.has(depotId) || !vehicleIds.length || !this.getDepotById(depotId)?.findRameTrack(id))
                continue;
            formationIds.add(id);
            this.rescuedFormations.push({ id, depotId, name: String(f.name || id), serviceId: String(f.serviceId || ''), vehicleIds });
        }
        this.maintenanceQueue = this.maintenanceQueue.filter((q) => q.rameId && validBuiltDepotIds.has(q.depotId) && Number.isFinite(Number(q.remainingMin)) && Number(q.remainingMin) > 0).map((q) => ({ ...q, remainingMin: Number(q.remainingMin), totalMin: Number.isFinite(Number(q.totalMin)) && Number(q.totalMin) > 0 ? Number(q.totalMin) : 20 }));
        this.repairQueue = this.repairQueue.filter((q) => q.serviceId && validBuiltDepotIds.has(q.depotId) && Number.isFinite(Number(q.remainingMin)) && Number(q.remainingMin) > 0).map((q) => ({ ...q, remainingMin: Number(q.remainingMin), totalMin: Number.isFinite(Number(q.totalMin)) && Number(q.totalMin) > 0 ? Number(q.totalMin) : 30 }));
        this.depotOperations = this.depotOperations.filter((o) => validBuiltDepotIds.has(o.depotId));
        const opByRame = new Map(this.depotOperations.map((o) => [String(o.rameId), o]));
        for (const depot of this.getDepots()) {
            if (!Array.isArray(depot.trackOccupancy) || depot.trackOccupancy.length !== depot.tracks)
                depot.trackOccupancy = Array.from({ length: depot.tracks }, (_, i) => ({ track: i + 1, rameId: '', purpose: 'garage', operationId: '' }));
            for (const slot of depot.trackOccupancy) {
                if (slot.rameId) {
                    const op = opByRame.get(slot.rameId);
                    slot.operationId = op?.id || '';
                    slot.purpose = op?.group || 'garage';
                }
            }
        }
        const rescueKeys = new Set(this.activeRescues.map((r) => `${r.depotId}|${r.stockId}`));
        for (const depot of this.depots)
            for (const loco of depot.rescueLocos || []) {
                loco.deployed = rescueKeys.has(`${depot.id}|${loco.stockId}`);
            }
    }
}
