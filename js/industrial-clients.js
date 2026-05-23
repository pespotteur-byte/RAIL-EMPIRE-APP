/**
 * IndustrialClients — Comprehensive real-world industrial database.
 * All Eurozone countries: FR, DE, BE, NL, IT, ES, AT, PT, LU, IE, FI, GR, SK, SI, EE, LV, LT, CY, MT, HR.
 * Real GPS coordinates from industrial sites.
 */
import { icon } from './icons.js';

let nextClientId = 1;

/* ═══════════════════════════════════════════════════════════════════════════
   INDUSTRY TYPES — 25 categories with real sites across the Eurozone
   ═══════════════════════════════════════════════════════════════════════════ */
const INDUSTRY_TYPES = [
  /* ───────── 1. CIMENTERIE ───────── */
  {
    type: 'cement',
    name: 'Cimenterie',
    icon: 'ind_cement',
    cargoTypes: ['limestone', 'gypsum', 'clinker', 'cement', 'coal', 'slag'],
    cargoOut: 'Ciment',
    dailyTonnageMin: 200,
    dailyTonnageMax: 800,
    pricePerTonne: 30,
    attractCost: 80000,
    description: 'Production de ciment : 200-800t/jour. Consomme calcaire, gypse, charbon.',
    realLocations: [
      // France
      { name: 'Lafarge — Le Teil', lat: 44.548, lon: 4.681, country: 'FR' },
      { name: 'Vicat — L\'Isle-d\'Abeau', lat: 45.616, lon: 5.229, country: 'FR' },
      { name: 'Holcim — Altkirch', lat: 47.623, lon: 7.241, country: 'FR' },
      { name: 'Ciments Calcia — Airvault', lat: 46.832, lon: -0.135, country: 'FR' },
      { name: 'Kerneos — Fos-sur-Mer', lat: 43.437, lon: 4.944, country: 'FR' },
      { name: 'Lafarge — Martres-Tolosane', lat: 43.197, lon: 0.900, country: 'FR' },
      { name: 'Ciments Calcia — Beffes', lat: 46.995, lon: 3.067, country: 'FR' },
      // Germany
      { name: 'HeidelbergCement — Leimen', lat: 49.346, lon: 8.691, country: 'DE' },
      { name: 'Dyckerhoff — Wiesbaden', lat: 50.069, lon: 8.246, country: 'DE' },
      { name: 'Schwenk — Allmendingen', lat: 48.387, lon: 9.718, country: 'DE' },
      { name: 'HeidelbergCement — Lengfurt', lat: 49.791, lon: 9.574, country: 'DE' },
      { name: 'Lafarge — Wössingen', lat: 48.955, lon: 8.595, country: 'DE' },
      // Belgium
      { name: 'Holcim — Obourg', lat: 50.474, lon: 3.991, country: 'BE' },
      { name: 'CBR — Lixhe', lat: 50.752, lon: 5.681, country: 'BE' },
      // Italy
      { name: 'Italcementi — Bergamo', lat: 45.694, lon: 9.670, country: 'IT' },
      { name: 'Buzzi Unicem — Casale Monferrato', lat: 45.134, lon: 8.450, country: 'IT' },
      { name: 'Colacem — Gubbio', lat: 43.349, lon: 12.572, country: 'IT' },
      // Spain
      { name: 'CEMEX — Alcanar', lat: 40.544, lon: 0.484, country: 'ES' },
      { name: 'LafargeHolcim — Sagunto', lat: 39.662, lon: -0.275, country: 'ES' },
      { name: 'Cementos Portland — Olazagutía', lat: 42.880, lon: -2.195, country: 'ES' },
      // Portugal
      { name: 'SECIL — Outão', lat: 38.488, lon: -8.927, country: 'PT' },
      { name: 'CIMPOR — Alhandra', lat: 38.891, lon: -9.001, country: 'PT' },
      // Austria
      { name: 'Lafarge — Mannersdorf', lat: 47.972, lon: 16.604, country: 'AT' },
      // Netherlands
      { name: 'ENCI — Maastricht', lat: 50.836, lon: 5.686, country: 'NL' },
      // Greece
      { name: 'Titan Cement — Elefsina', lat: 38.041, lon: 23.534, country: 'GR' },
      { name: 'Heracles — Volos', lat: 39.367, lon: 22.937, country: 'GR' },
      // Finland
      { name: 'Finnsementti — Parainen', lat: 60.301, lon: 22.300, country: 'FI' },
      // Ireland
      { name: 'Irish Cement — Limerick', lat: 52.660, lon: -8.629, country: 'IE' },
      { name: 'Irish Cement — Platin', lat: 53.721, lon: -6.417, country: 'IE' },
    ],
  },

  /* ───────── 2. RAFFINERIE ───────── */
  {
    type: 'refinery',
    name: 'Raffinerie',
    icon: 'ind_refinery',
    cargoTypes: ['crude-oil', 'diesel', 'gasoline', 'jet-fuel', 'fuel-oil', 'lpg', 'ethanol'],
    cargoOut: 'Produits pétroliers',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2000,
    pricePerTonne: 55,
    attractCost: 200000,
    description: 'Raffinage pétrole : 500-2000t/jour. TMD obligatoire.',
    realLocations: [
      // France
      { name: 'TotalEnergies — Donges', lat: 47.318, lon: -2.075, country: 'FR' },
      { name: 'TotalEnergies — Gonfreville', lat: 49.490, lon: 0.224, country: 'FR' },
      { name: 'ExxonMobil — Port-Jérôme', lat: 49.510, lon: 0.586, country: 'FR' },
      { name: 'Petroineos — Lavéra', lat: 43.393, lon: 5.019, country: 'FR' },
      { name: 'TotalEnergies — Feyzin', lat: 45.670, lon: 4.857, country: 'FR' },
      { name: 'TotalEnergies — Grandpuits', lat: 48.558, lon: 2.952, country: 'FR' },
      // Germany
      { name: 'Shell — Wesseling', lat: 50.811, lon: 6.976, country: 'DE' },
      { name: 'BP — Gelsenkirchen', lat: 51.529, lon: 7.073, country: 'DE' },
      { name: 'PCK — Schwedt', lat: 53.041, lon: 14.273, country: 'DE' },
      { name: 'MiRO — Karlsruhe', lat: 49.039, lon: 8.304, country: 'DE' },
      { name: 'Bayernoil — Vohburg', lat: 48.774, lon: 11.609, country: 'DE' },
      { name: 'Holborn — Hamburg', lat: 53.515, lon: 9.964, country: 'DE' },
      // Netherlands
      { name: 'Shell — Pernis (Rotterdam)', lat: 51.881, lon: 4.380, country: 'NL' },
      { name: 'BP — Rotterdam', lat: 51.886, lon: 4.328, country: 'NL' },
      { name: 'ExxonMobil — Rotterdam', lat: 51.893, lon: 4.335, country: 'NL' },
      // Belgium
      { name: 'TotalEnergies — Anvers', lat: 51.266, lon: 4.352, country: 'BE' },
      { name: 'ExxonMobil — Anvers', lat: 51.275, lon: 4.368, country: 'BE' },
      // Italy
      { name: 'ENI — Sannazzaro', lat: 45.096, lon: 8.903, country: 'IT' },
      { name: 'Saras — Sarroch', lat: 39.096, lon: 9.011, country: 'IT' },
      { name: 'ISAB — Priolo Gargallo', lat: 37.158, lon: 15.187, country: 'IT' },
      { name: 'ENI — Taranto', lat: 40.481, lon: 17.195, country: 'IT' },
      // Spain
      { name: 'Repsol — Tarragona', lat: 41.085, lon: 1.219, country: 'ES' },
      { name: 'Repsol — Puertollano', lat: 38.685, lon: -4.090, country: 'ES' },
      { name: 'CEPSA — Algeciras', lat: 36.176, lon: -5.414, country: 'ES' },
      { name: 'BP — Castellón', lat: 39.966, lon: -0.010, country: 'ES' },
      // Portugal
      { name: 'Galp — Sines', lat: 37.929, lon: -8.867, country: 'PT' },
      { name: 'Galp — Matosinhos', lat: 41.187, lon: -8.694, country: 'PT' },
      // Austria
      { name: 'OMV — Schwechat', lat: 48.142, lon: 16.471, country: 'AT' },
      // Greece
      { name: 'Motor Oil — Agioi Theodoroi', lat: 37.940, lon: 22.985, country: 'GR' },
      { name: 'Hellenic Petroleum — Thessalonique', lat: 40.623, lon: 22.918, country: 'GR' },
      // Finland
      { name: 'Neste — Porvoo', lat: 60.310, lon: 25.609, country: 'FI' },
      { name: 'Neste — Naantali', lat: 60.462, lon: 22.037, country: 'FI' },
    ],
  },

  /* ───────── 3. PORT MARITIME ───────── */
  {
    type: 'port',
    name: 'Port maritime',
    icon: 'ind_port',
    cargoTypes: ['containers-20', 'containers-40', 'containers-reefer', 'containers-tank', 'swap-bodies'],
    cargoOut: 'Conteneurs export',
    dailyTonnageMin: 800,
    dailyTonnageMax: 5000,
    pricePerTonne: 45,
    attractCost: 350000,
    description: 'Trafic massif : 800-5000 TEU/jour. Hub intermodal.',
    realLocations: [
      // France
      { name: 'Grand Port du Havre', lat: 49.485, lon: 0.107, country: 'FR' },
      { name: 'Europort Marseille-Fos', lat: 43.405, lon: 4.879, country: 'FR' },
      { name: 'Port de Dunkerque', lat: 51.045, lon: 2.348, country: 'FR' },
      { name: 'Port Nantes Saint-Nazaire', lat: 47.285, lon: -2.190, country: 'FR' },
      { name: 'Port de Rouen', lat: 49.437, lon: 1.088, country: 'FR' },
      { name: 'Port de Bordeaux', lat: 44.854, lon: -0.551, country: 'FR' },
      { name: 'Port de La Rochelle', lat: 46.155, lon: -1.157, country: 'FR' },
      // Netherlands
      { name: 'Port of Rotterdam', lat: 51.903, lon: 4.468, country: 'NL' },
      { name: 'Port of Amsterdam', lat: 52.409, lon: 4.796, country: 'NL' },
      // Belgium
      { name: 'Port of Antwerp-Bruges', lat: 51.295, lon: 4.339, country: 'BE' },
      { name: 'Port of Zeebrugge', lat: 51.340, lon: 3.189, country: 'BE' },
      { name: 'Port of Gent', lat: 51.090, lon: 3.756, country: 'BE' },
      // Germany
      { name: 'Port of Hamburg', lat: 53.535, lon: 9.963, country: 'DE' },
      { name: 'Bremerhaven', lat: 53.542, lon: 8.571, country: 'DE' },
      { name: 'Wilhelmshaven — JadeWeserPort', lat: 53.580, lon: 8.140, country: 'DE' },
      { name: 'Duisburg — duisport', lat: 51.449, lon: 6.738, country: 'DE' },
      // Italy
      { name: 'Porto di Genova', lat: 44.408, lon: 8.927, country: 'IT' },
      { name: 'Porto di Gioia Tauro', lat: 38.435, lon: 15.893, country: 'IT' },
      { name: 'Porto di Trieste', lat: 45.639, lon: 13.761, country: 'IT' },
      { name: 'Porto di La Spezia', lat: 44.089, lon: 9.833, country: 'IT' },
      { name: 'Porto di Livorno', lat: 43.556, lon: 10.298, country: 'IT' },
      // Spain
      { name: 'Puerto de Valencia', lat: 39.442, lon: -0.314, country: 'ES' },
      { name: 'Puerto de Algeciras', lat: 36.129, lon: -5.434, country: 'ES' },
      { name: 'Puerto de Barcelona', lat: 41.363, lon: 2.165, country: 'ES' },
      { name: 'Puerto de Bilbao', lat: 43.351, lon: -3.047, country: 'ES' },
      // Portugal
      { name: 'Porto de Sines', lat: 37.951, lon: -8.869, country: 'PT' },
      { name: 'Porto de Leixões', lat: 41.183, lon: -8.707, country: 'PT' },
      { name: 'Porto de Lisboa', lat: 38.726, lon: -9.128, country: 'PT' },
      // Greece
      { name: 'Port of Piraeus', lat: 37.942, lon: 23.636, country: 'GR' },
      { name: 'Port of Thessaloniki', lat: 40.634, lon: 22.940, country: 'GR' },
      // Finland
      { name: 'Port of Helsinki — Vuosaari', lat: 60.213, lon: 25.174, country: 'FI' },
      { name: 'Port of HaminaKotka', lat: 60.455, lon: 26.915, country: 'FI' },
      // Ireland
      { name: 'Port of Dublin', lat: 53.347, lon: -6.213, country: 'IE' },
      { name: 'Port of Cork', lat: 51.848, lon: -8.301, country: 'IE' },
      // Estonia
      { name: 'Port of Tallinn — Muuga', lat: 59.494, lon: 24.953, country: 'EE' },
      // Latvia
      { name: 'Freeport of Riga', lat: 56.964, lon: 24.063, country: 'LV' },
      // Lithuania
      { name: 'Port of Klaipėda', lat: 55.694, lon: 21.130, country: 'LT' },
      // Slovenia
      { name: 'Port of Koper', lat: 45.548, lon: 13.740, country: 'SI' },
      // Croatia
      { name: 'Port of Rijeka', lat: 45.329, lon: 14.440, country: 'HR' },
    ],
  },

  /* ───────── 4. ACIÉRIE / SIDÉRURGIE ───────── */
  {
    type: 'steel_mill',
    name: 'Aciérie / Sidérurgie',
    icon: 'ind_steel',
    cargoTypes: ['ore', 'coal', 'scrap-metal', 'steel-coils', 'steel-beams', 'steel-sheet', 'steel-wire', 'cast-iron'],
    cargoOut: 'Produits sidérurgiques',
    dailyTonnageMin: 400,
    dailyTonnageMax: 1500,
    pricePerTonne: 40,
    attractCost: 150000,
    description: 'Sidérurgie lourde : 400-1500t/jour. Consomme minerai et charbon.',
    realLocations: [
      // France
      { name: 'ArcelorMittal — Dunkerque', lat: 51.032, lon: 2.334, country: 'FR' },
      { name: 'ArcelorMittal — Fos-sur-Mer', lat: 43.449, lon: 4.918, country: 'FR' },
      { name: 'ArcelorMittal — Florange', lat: 49.324, lon: 6.120, country: 'FR' },
      { name: 'Vallourec — Saint-Saulve', lat: 50.359, lon: 3.562, country: 'FR' },
      { name: 'Ascoval — Saint-Saulve', lat: 50.361, lon: 3.558, country: 'FR' },
      // Germany
      { name: 'ThyssenKrupp — Duisburg', lat: 51.448, lon: 6.729, country: 'DE' },
      { name: 'Salzgitter AG — Salzgitter', lat: 52.146, lon: 10.315, country: 'DE' },
      { name: 'ArcelorMittal — Eisenhüttenstadt', lat: 52.152, lon: 14.660, country: 'DE' },
      { name: 'ArcelorMittal — Bremen', lat: 53.097, lon: 8.735, country: 'DE' },
      { name: 'Saarstahl — Völklingen', lat: 49.252, lon: 6.853, country: 'DE' },
      { name: 'Dillinger Hütte — Dillingen', lat: 49.354, lon: 6.730, country: 'DE' },
      // Belgium
      { name: 'ArcelorMittal — Gand', lat: 51.072, lon: 3.765, country: 'BE' },
      { name: 'ArcelorMittal — Liège', lat: 50.589, lon: 5.514, country: 'BE' },
      { name: 'NLMK — Clabecq', lat: 50.664, lon: 4.234, country: 'BE' },
      // Netherlands
      { name: 'Tata Steel — IJmuiden', lat: 52.461, lon: 4.588, country: 'NL' },
      // Italy
      { name: 'ArcelorMittal — Taranto (ex-ILVA)', lat: 40.483, lon: 17.175, country: 'IT' },
      { name: 'Arvedi — Cremona', lat: 45.138, lon: 10.013, country: 'IT' },
      { name: 'Danieli — Buttrio', lat: 46.014, lon: 13.321, country: 'IT' },
      { name: 'Feralpi — Lonato', lat: 45.464, lon: 10.486, country: 'IT' },
      // Spain
      { name: 'ArcelorMittal — Avilés', lat: 43.548, lon: -5.917, country: 'ES' },
      { name: 'ArcelorMittal — Gijón', lat: 43.539, lon: -5.665, country: 'ES' },
      { name: 'Celsa — Castellbisbal', lat: 41.467, lon: 1.988, country: 'ES' },
      // Austria
      { name: 'Voestalpine — Linz', lat: 48.316, lon: 14.294, country: 'AT' },
      { name: 'Voestalpine — Donawitz', lat: 47.365, lon: 15.013, country: 'AT' },
      // Finland
      { name: 'SSAB — Raahe', lat: 64.683, lon: 24.474, country: 'FI' },
      // Luxembourg
      { name: 'ArcelorMittal — Belval', lat: 49.504, lon: 5.945, country: 'LU' },
      { name: 'ArcelorMittal — Differdange', lat: 49.523, lon: 5.896, country: 'LU' },
      // Slovakia
      { name: 'US Steel — Košice', lat: 48.712, lon: 21.242, country: 'SK' },
      // Greece
      { name: 'Halyvourgiki — Elefsina', lat: 38.044, lon: 23.536, country: 'GR' },
    ],
  },

  /* ───────── 5. USINE AUTOMOBILE ───────── */
  {
    type: 'auto_plant',
    name: 'Usine automobile',
    icon: 'ind_auto',
    cargoTypes: ['cars', 'trucks', 'vans', 'steel-coils', 'plastic-granules', 'tires'],
    cargoOut: 'Véhicules neufs',
    dailyTonnageMin: 100,
    dailyTonnageMax: 500,
    pricePerTonne: 120,
    attractCost: 120000,
    description: 'Assemblage et export : 100-500 véhicules/jour. Haut revenu.',
    realLocations: [
      // France
      { name: 'Stellantis — Sochaux', lat: 47.512, lon: 6.832, country: 'FR' },
      { name: 'Stellantis — Poissy', lat: 48.930, lon: 2.034, country: 'FR' },
      { name: 'Renault — Flins', lat: 48.968, lon: 1.876, country: 'FR' },
      { name: 'Renault — Douai', lat: 50.374, lon: 3.077, country: 'FR' },
      { name: 'Toyota — Onnaing', lat: 50.391, lon: 3.601, country: 'FR' },
      { name: 'Renault — Sandouville', lat: 49.502, lon: 0.264, country: 'FR' },
      { name: 'Stellantis — Rennes', lat: 48.164, lon: -1.596, country: 'FR' },
      { name: 'Stellantis — Mulhouse', lat: 47.757, lon: 7.300, country: 'FR' },
      { name: 'Renault — Maubeuge', lat: 50.277, lon: 3.973, country: 'FR' },
      { name: 'Renault — Batilly', lat: 49.160, lon: 5.974, country: 'FR' },
      // Germany
      { name: 'Volkswagen — Wolfsburg', lat: 52.428, lon: 10.791, country: 'DE' },
      { name: 'BMW — Munich', lat: 48.176, lon: 11.555, country: 'DE' },
      { name: 'Mercedes-Benz — Sindelfingen', lat: 48.713, lon: 9.013, country: 'DE' },
      { name: 'Mercedes-Benz — Bremen', lat: 53.056, lon: 8.793, country: 'DE' },
      { name: 'Audi — Ingolstadt', lat: 48.776, lon: 11.439, country: 'DE' },
      { name: 'Audi — Neckarsulm', lat: 49.192, lon: 9.226, country: 'DE' },
      { name: 'Porsche — Stuttgart-Zuffenhausen', lat: 48.823, lon: 9.154, country: 'DE' },
      { name: 'Opel — Rüsselsheim', lat: 49.998, lon: 8.417, country: 'DE' },
      { name: 'Ford — Cologne', lat: 50.876, lon: 7.034, country: 'DE' },
      { name: 'Volkswagen — Emden', lat: 53.365, lon: 7.188, country: 'DE' },
      { name: 'BMW — Dingolfing', lat: 48.634, lon: 12.501, country: 'DE' },
      { name: 'BMW — Regensburg', lat: 49.020, lon: 12.089, country: 'DE' },
      { name: 'BMW — Leipzig', lat: 51.389, lon: 12.302, country: 'DE' },
      // Italy
      { name: 'Stellantis — Melfi', lat: 40.995, lon: 15.615, country: 'IT' },
      { name: 'Stellantis — Mirafiori (Turin)', lat: 45.032, lon: 7.608, country: 'IT' },
      { name: 'Ferrari — Maranello', lat: 44.533, lon: 10.865, country: 'IT' },
      { name: 'Lamborghini — Sant\'Agata', lat: 44.654, lon: 11.126, country: 'IT' },
      // Spain
      { name: 'SEAT — Martorell', lat: 41.486, lon: 1.912, country: 'ES' },
      { name: 'Stellantis — Vigo', lat: 42.228, lon: -8.693, country: 'ES' },
      { name: 'Stellantis — Zaragoza', lat: 41.679, lon: -0.910, country: 'ES' },
      { name: 'Ford — Almussafes', lat: 39.280, lon: -0.417, country: 'ES' },
      { name: 'Renault — Valladolid', lat: 41.641, lon: -4.708, country: 'ES' },
      { name: 'Mercedes-Benz — Vitoria', lat: 42.867, lon: -2.696, country: 'ES' },
      // Belgium
      { name: 'Volvo Cars — Gand', lat: 51.082, lon: 3.730, country: 'BE' },
      { name: 'Audi — Forest (Bruxelles)', lat: 50.810, lon: 4.313, country: 'BE' },
      // Portugal
      { name: 'Volkswagen Autoeuropa — Palmela', lat: 38.556, lon: -8.906, country: 'PT' },
      { name: 'Stellantis — Mangualde', lat: 40.599, lon: -7.768, country: 'PT' },
      // Slovakia
      { name: 'Volkswagen — Bratislava', lat: 48.169, lon: 17.143, country: 'SK' },
      { name: 'Kia — Žilina', lat: 49.206, lon: 18.734, country: 'SK' },
      // Slovenia
      { name: 'Revoz (Renault) — Novo Mesto', lat: 45.802, lon: 15.171, country: 'SI' },
    ],
  },

  /* ───────── 6. TERMINAL CÉRÉALIER ───────── */
  {
    type: 'grain_terminal',
    name: 'Terminal céréalier',
    icon: 'ind_grain',
    cargoTypes: ['wheat', 'corn', 'barley', 'rapeseed', 'sunflower', 'soybeans', 'oilseed-meal'],
    cargoOut: 'Céréales export',
    dailyTonnageMin: 300,
    dailyTonnageMax: 1200,
    pricePerTonne: 35,
    attractCost: 90000,
    description: 'Terminal export : 300-1200t/jour. Trafic saisonnier pendant les récoltes.',
    realLocations: [
      // France
      { name: 'Sénalia — Rouen', lat: 49.437, lon: 1.079, country: 'FR' },
      { name: 'Silos Grand-Couronne', lat: 49.358, lon: 1.015, country: 'FR' },
      { name: 'Soufflet — Nogent-sur-Seine', lat: 48.492, lon: 3.505, country: 'FR' },
      { name: 'InVivo — La Pallice', lat: 46.166, lon: -1.214, country: 'FR' },
      { name: 'Axéréal — Chartres', lat: 48.453, lon: 1.489, country: 'FR' },
      { name: 'SCAEL — Chartres', lat: 48.456, lon: 1.500, country: 'FR' },
      { name: 'Vivescia — Reims', lat: 49.258, lon: 3.995, country: 'FR' },
      // Germany
      { name: 'ADM — Hamburg', lat: 53.534, lon: 9.963, country: 'DE' },
      { name: 'BayWa — Munich', lat: 48.115, lon: 11.612, country: 'DE' },
      { name: 'Agravis — Münster', lat: 51.961, lon: 7.638, country: 'DE' },
      // Netherlands
      { name: 'Cargill — Amsterdam', lat: 52.393, lon: 4.795, country: 'NL' },
      { name: 'ADM — Rotterdam', lat: 51.888, lon: 4.390, country: 'NL' },
      // Belgium
      { name: 'Cargill — Antwerpen', lat: 51.258, lon: 4.364, country: 'BE' },
      // Italy
      { name: 'Casillo — Corato', lat: 41.146, lon: 16.419, country: 'IT' },
      // Spain
      { name: 'Puerto de Tarragona — silos', lat: 41.087, lon: 1.235, country: 'ES' },
      // Finland
      { name: 'Raisio — Raisio', lat: 60.484, lon: 22.169, country: 'FI' },
    ],
  },

  /* ───────── 7. USINE CHIMIQUE ───────── */
  {
    type: 'chemical_plant',
    name: 'Usine chimique',
    icon: 'ind_chemical',
    cargoTypes: ['chemicals-liq', 'acids', 'toxic', 'corrosive', 'plastic-granules', 'paint', 'ammonia', 'chlorine'],
    cargoOut: 'Produits chimiques',
    dailyTonnageMin: 150,
    dailyTonnageMax: 600,
    pricePerTonne: 90,
    attractCost: 130000,
    description: 'Chimie fine et lourde : 150-600t/jour. TMD obligatoire.',
    realLocations: [
      // France
      { name: 'BASF — Chalampé', lat: 47.820, lon: 7.554, country: 'FR' },
      { name: 'Arkema — Pierre-Bénite', lat: 45.700, lon: 4.825, country: 'FR' },
      { name: 'Solvay — Dombasle', lat: 48.619, lon: 6.348, country: 'FR' },
      { name: 'Air Liquide — Fos-sur-Mer', lat: 43.428, lon: 4.903, country: 'FR' },
      { name: 'Rhodia — Roussillon', lat: 45.374, lon: 4.820, country: 'FR' },
      { name: 'Arkema — Lacq', lat: 43.390, lon: -0.611, country: 'FR' },
      // Germany
      { name: 'BASF — Ludwigshafen', lat: 49.493, lon: 8.431, country: 'DE' },
      { name: 'Bayer — Leverkusen', lat: 51.033, lon: 6.994, country: 'DE' },
      { name: 'Evonik — Marl', lat: 51.659, lon: 7.105, country: 'DE' },
      { name: 'Dow — Stade', lat: 53.600, lon: 9.477, country: 'DE' },
      { name: 'Lanxess — Dormagen', lat: 51.095, lon: 6.834, country: 'DE' },
      { name: 'Covestro — Leverkusen', lat: 51.038, lon: 6.998, country: 'DE' },
      { name: 'Wacker — Burghausen', lat: 48.168, lon: 12.834, country: 'DE' },
      { name: 'INEOS — Cologne', lat: 50.892, lon: 6.991, country: 'DE' },
      // Belgium
      { name: 'BASF — Antwerpen', lat: 51.289, lon: 4.373, country: 'BE' },
      { name: 'INEOS — Antwerpen', lat: 51.278, lon: 4.388, country: 'BE' },
      { name: 'Solvay — Jemeppe', lat: 50.605, lon: 5.500, country: 'BE' },
      // Netherlands
      { name: 'DSM — Geleen', lat: 50.966, lon: 5.831, country: 'NL' },
      { name: 'SABIC — Geleen', lat: 50.971, lon: 5.841, country: 'NL' },
      { name: 'Shell Chemicals — Moerdijk', lat: 51.671, lon: 4.586, country: 'NL' },
      // Italy
      { name: 'ENI Versalis — Porto Marghera', lat: 45.454, lon: 12.240, country: 'IT' },
      { name: 'Radici — Novara', lat: 45.454, lon: 8.619, country: 'IT' },
      // Spain
      { name: 'Repsol Química — Tarragona', lat: 41.082, lon: 1.195, country: 'ES' },
      { name: 'BASF — Tarragona', lat: 41.078, lon: 1.200, country: 'ES' },
      // Austria
      { name: 'Borealis — Linz', lat: 48.307, lon: 14.297, country: 'AT' },
      // Finland
      { name: 'Neste — Porvoo (chemicals)', lat: 60.312, lon: 25.613, country: 'FI' },
      // Ireland
      { name: 'Pfizer — Ringaskiddy', lat: 51.829, lon: -8.330, country: 'IE' },
    ],
  },

  /* ───────── 8. PAPETERIE ───────── */
  {
    type: 'paper_mill',
    name: 'Papeterie',
    icon: 'ind_paper',
    cargoTypes: ['timber', 'pulp', 'paper', 'cardboard', 'wood-chips'],
    cargoOut: 'Papier / Carton',
    dailyTonnageMin: 200,
    dailyTonnageMax: 700,
    pricePerTonne: 50,
    attractCost: 75000,
    description: 'Transformation bois → papier : 200-700t/jour.',
    realLocations: [
      // France
      { name: 'Smurfit Kappa — Facture', lat: 44.630, lon: -0.976, country: 'FR' },
      { name: 'Norske Skog — Golbey', lat: 48.194, lon: 6.441, country: 'FR' },
      { name: 'Papeteries de Condat', lat: 45.072, lon: 1.220, country: 'FR' },
      { name: 'Fibre Excellence — Saint-Gaudens', lat: 43.107, lon: 0.725, country: 'FR' },
      { name: 'Chapelle Darblay — Grand-Couronne', lat: 49.360, lon: 1.014, country: 'FR' },
      // Germany
      { name: 'UPM — Schongau', lat: 47.808, lon: 10.895, country: 'DE' },
      { name: 'UPM — Schwedt', lat: 53.044, lon: 14.276, country: 'DE' },
      { name: 'Sappi — Ehingen', lat: 48.277, lon: 9.727, country: 'DE' },
      { name: 'Stora Enso — Sachsen', lat: 50.897, lon: 12.640, country: 'DE' },
      // Finland
      { name: 'UPM — Jämsänkoski', lat: 61.863, lon: 25.196, country: 'FI' },
      { name: 'Stora Enso — Imatra', lat: 61.181, lon: 28.782, country: 'FI' },
      { name: 'Metsä Board — Äänekoski', lat: 62.599, lon: 25.730, country: 'FI' },
      { name: 'UPM — Rauma', lat: 61.130, lon: 21.505, country: 'FI' },
      // Austria
      { name: 'Sappi — Gratkorn', lat: 47.128, lon: 15.350, country: 'AT' },
      { name: 'Mondi — Frantschach', lat: 46.837, lon: 14.947, country: 'AT' },
      // Portugal
      { name: 'Navigator — Setúbal', lat: 38.518, lon: -8.886, country: 'PT' },
      { name: 'Navigator — Figueira da Foz', lat: 40.143, lon: -8.850, country: 'PT' },
      // Italy
      { name: 'Burgo — Mantova', lat: 45.147, lon: 10.793, country: 'IT' },
      // Spain
      { name: 'ENCE — Pontevedra', lat: 42.440, lon: -8.617, country: 'ES' },
      { name: 'Smurfit Kappa — Nervión', lat: 43.268, lon: -2.977, country: 'ES' },
    ],
  },

  /* ───────── 9. PLATEFORME LOGISTIQUE ───────── */
  {
    type: 'logistics_hub',
    name: 'Plateforme logistique',
    icon: 'ind_logistics',
    cargoTypes: ['containers-20', 'containers-40', 'swap-bodies', 'semi-trailers', 'parcels', 'express'],
    cargoOut: 'Colis / Palettes',
    dailyTonnageMin: 400,
    dailyTonnageMax: 3000,
    pricePerTonne: 65,
    attractCost: 250000,
    description: 'Hub intermodal : 400-3000t/jour. Cœur de la supply chain.',
    realLocations: [
      // France
      { name: 'Dourges Delta 3', lat: 50.430, lon: 2.971, country: 'FR' },
      { name: 'Valenton — hub SNCF Fret', lat: 48.745, lon: 2.467, country: 'FR' },
      { name: 'Perpignan Saint-Charles', lat: 42.690, lon: 2.880, country: 'FR' },
      { name: 'Lyon Vénissieux — hub combiné', lat: 45.710, lon: 4.880, country: 'FR' },
      { name: 'Noisy-le-Sec — hub IDF', lat: 48.895, lon: 2.462, country: 'FR' },
      { name: 'Avignon Courtine', lat: 43.917, lon: 4.822, country: 'FR' },
      { name: 'Bordeaux Hourcade', lat: 44.793, lon: -0.523, country: 'FR' },
      // Germany
      { name: 'Duisburg Intermodal Terminal', lat: 51.432, lon: 6.747, country: 'DE' },
      { name: 'München-Riem KV-Terminal', lat: 48.138, lon: 11.713, country: 'DE' },
      { name: 'Hamburg Billwerder', lat: 53.513, lon: 10.108, country: 'DE' },
      { name: 'Köln-Eifeltor', lat: 50.890, lon: 6.916, country: 'DE' },
      { name: 'Nürnberg Hafen', lat: 49.453, lon: 11.083, country: 'DE' },
      // Belgium
      { name: 'Antwerp Combinant', lat: 51.296, lon: 4.336, country: 'BE' },
      { name: 'Zeebrugge Intermodal', lat: 51.335, lon: 3.196, country: 'BE' },
      // Netherlands
      { name: 'Rotterdam RSC', lat: 51.910, lon: 4.490, country: 'NL' },
      { name: 'Born Intermodal', lat: 51.039, lon: 5.805, country: 'NL' },
      // Italy
      { name: 'Verona Quadrante Europa', lat: 45.394, lon: 11.009, country: 'IT' },
      { name: 'Milano Segrate', lat: 45.489, lon: 9.292, country: 'IT' },
      { name: 'Bologna Interporto', lat: 44.500, lon: 11.380, country: 'IT' },
      // Spain
      { name: 'Barcelona Can Tunis', lat: 41.362, lon: 2.131, country: 'ES' },
      { name: 'Madrid Abroñigal', lat: 40.390, lon: -3.669, country: 'ES' },
      // Austria
      { name: 'Wien Süd Terminal', lat: 48.145, lon: 16.380, country: 'AT' },
      { name: 'Wels Container Terminal', lat: 48.159, lon: 14.022, country: 'AT' },
    ],
  },

  /* ───────── 10. CENTRALE THERMIQUE ───────── */
  {
    type: 'power_plant',
    name: 'Centrale thermique',
    icon: 'ind_power',
    cargoTypes: ['coal', 'pellets', 'wood-chips', 'household-waste'],
    cargoOut: 'Cendres / Résidus',
    dailyTonnageMin: 500,
    dailyTonnageMax: 2500,
    pricePerTonne: 20,
    attractCost: 100000,
    description: 'Consomme 500-2500t/jour de combustible. Trafic prévisible.',
    realLocations: [
      // France
      { name: 'Centrale de Cordemais', lat: 47.268, lon: -1.878, country: 'FR' },
      { name: 'Centrale du Havre', lat: 49.494, lon: 0.168, country: 'FR' },
      { name: 'Centrale de Gardanne (biomasse)', lat: 43.454, lon: 5.470, country: 'FR' },
      { name: 'Centrale de Saint-Avold', lat: 49.100, lon: 6.736, country: 'FR' },
      // Germany
      { name: 'RWE — Niederaußem', lat: 50.990, lon: 6.669, country: 'DE' },
      { name: 'RWE — Neurath', lat: 51.037, lon: 6.622, country: 'DE' },
      { name: 'LEAG — Jänschwalde', lat: 51.836, lon: 14.451, country: 'DE' },
      { name: 'LEAG — Schwarze Pumpe', lat: 51.537, lon: 14.357, country: 'DE' },
      { name: 'Uniper — Datteln', lat: 51.651, lon: 7.342, country: 'DE' },
      { name: 'EnBW — Karlsruhe', lat: 49.037, lon: 8.348, country: 'DE' },
      // Netherlands
      { name: 'RWE — Eemshaven', lat: 53.444, lon: 6.829, country: 'NL' },
      { name: 'Uniper — Maasvlakte', lat: 51.953, lon: 4.039, country: 'NL' },
      // Italy
      { name: 'ENEL — Brindisi', lat: 40.647, lon: 17.996, country: 'IT' },
      { name: 'ENEL — Civitavecchia', lat: 42.064, lon: 11.762, country: 'IT' },
      // Spain
      { name: 'Endesa — As Pontes', lat: 43.433, lon: -7.856, country: 'ES' },
      // Greece
      { name: 'DEI — Ptolemaida', lat: 40.510, lon: 21.686, country: 'GR' },
      { name: 'DEI — Megalopoli', lat: 37.404, lon: 22.137, country: 'GR' },
      // Ireland
      { name: 'Moneypoint — Clare', lat: 52.610, lon: -9.429, country: 'IE' },
      // Portugal
      { name: 'EDP — Sines (charbon)', lat: 37.936, lon: -8.868, country: 'PT' },
    ],
  },

  /* ───────── 11. CENTRALE NUCLÉAIRE ───────── */
  {
    type: 'nuclear_plant',
    name: 'Centrale nucléaire',
    icon: 'ind_nuclear',
    cargoTypes: ['nuclear-waste', 'radioactive', 'construction-equip', 'transformer'],
    cargoOut: 'Combustible / Déchets nucléaires',
    dailyTonnageMin: 10,
    dailyTonnageMax: 50,
    pricePerTonne: 2000,
    attractCost: 500000,
    description: 'Convois nucléaires ultra-sécurisés. Faible volume, très haut revenu.',
    realLocations: [
      // France (56 réacteurs)
      { name: 'La Hague — retraitement', lat: 49.680, lon: -1.879, country: 'FR' },
      { name: 'Gravelines', lat: 50.993, lon: 2.117, country: 'FR' },
      { name: 'Paluel', lat: 49.858, lon: 0.632, country: 'FR' },
      { name: 'Cattenom', lat: 49.408, lon: 6.217, country: 'FR' },
      { name: 'Tricastin', lat: 44.333, lon: 4.733, country: 'FR' },
      { name: 'Dampierre', lat: 47.732, lon: 2.518, country: 'FR' },
      { name: 'Saint-Laurent-des-Eaux', lat: 47.721, lon: 1.581, country: 'FR' },
      { name: 'Chinon', lat: 47.230, lon: 0.167, country: 'FR' },
      { name: 'Cruas-Meysse', lat: 44.633, lon: 4.758, country: 'FR' },
      { name: 'Bugey', lat: 45.797, lon: 5.270, country: 'FR' },
      { name: 'Flamanville', lat: 49.537, lon: -1.881, country: 'FR' },
      { name: 'Civaux', lat: 46.448, lon: 0.661, country: 'FR' },
      { name: 'Golfech', lat: 44.106, lon: 0.845, country: 'FR' },
      { name: 'Blayais', lat: 45.255, lon: -0.690, country: 'FR' },
      { name: 'Chooz', lat: 50.091, lon: 4.791, country: 'FR' },
      { name: 'Penly', lat: 49.976, lon: 1.210, country: 'FR' },
      { name: 'Nogent-sur-Seine', lat: 48.518, lon: 3.520, country: 'FR' },
      { name: 'Belleville-sur-Loire', lat: 47.514, lon: 2.876, country: 'FR' },
      // Belgium
      { name: 'Doel', lat: 51.326, lon: 4.260, country: 'BE' },
      { name: 'Tihange', lat: 50.534, lon: 5.272, country: 'BE' },
      // Germany (en démantèlement)
      { name: 'Isar (Niederaichbach)', lat: 48.606, lon: 12.294, country: 'DE' },
      { name: 'Neckarwestheim', lat: 49.040, lon: 9.175, country: 'DE' },
      { name: 'Emsland (Lingen)', lat: 52.474, lon: 7.320, country: 'DE' },
      // Spain
      { name: 'Almaraz', lat: 39.808, lon: -5.694, country: 'ES' },
      { name: 'Vandellòs', lat: 41.198, lon: 0.867, country: 'ES' },
      { name: 'Ascó', lat: 41.199, lon: 0.572, country: 'ES' },
      { name: 'Cofrentes', lat: 39.215, lon: -1.049, country: 'ES' },
      // Finland
      { name: 'Olkiluoto', lat: 61.235, lon: 21.444, country: 'FI' },
      { name: 'Loviisa', lat: 60.369, lon: 26.363, country: 'FI' },
      // Netherlands
      { name: 'Borssele', lat: 51.430, lon: 3.717, country: 'NL' },
      // Slovakia
      { name: 'Jaslovské Bohunice', lat: 48.491, lon: 17.682, country: 'SK' },
      { name: 'Mochovce', lat: 48.277, lon: 18.440, country: 'SK' },
      // Slovenia
      { name: 'Krško', lat: 45.938, lon: 15.517, country: 'SI' },
    ],
  },

  /* ───────── 12. CARRIÈRE / MINE ───────── */
  {
    type: 'quarry',
    name: 'Carrière / Mine',
    icon: 'ind_quarry',
    cargoTypes: ['sand', 'gravel', 'limestone', 'ballast', 'ore', 'bauxite', 'salt'],
    cargoOut: 'Granulats / Minéraux',
    dailyTonnageMin: 500,
    dailyTonnageMax: 3000,
    pricePerTonne: 12,
    attractCost: 60000,
    description: 'Extraction massive : 500-3000t/jour. Faible prix mais gros volumes.',
    realLocations: [
      // France
      { name: 'GSM — Bréauté', lat: 49.629, lon: 0.397, country: 'FR' },
      { name: 'Carrières du Boulonnais', lat: 50.719, lon: 1.630, country: 'FR' },
      { name: 'MDPA — Mulhouse (potasse)', lat: 47.773, lon: 7.275, country: 'FR' },
      { name: 'Carrières de Mauperthuis', lat: 48.728, lon: 3.073, country: 'FR' },
      { name: 'Lafarge Granulats — Gennevilliers', lat: 48.921, lon: 2.292, country: 'FR' },
      { name: 'Imerys — Lussac-les-Châteaux', lat: 46.401, lon: 0.733, country: 'FR' },
      // Germany
      { name: 'HeidelbergCement — Ennigerloh', lat: 51.836, lon: 8.019, country: 'DE' },
      { name: 'K+S — Heringen (potasse)', lat: 50.872, lon: 9.967, country: 'DE' },
      { name: 'K+S — Wintershall', lat: 50.893, lon: 9.965, country: 'DE' },
      { name: 'RWE — Hambach (lignite)', lat: 50.915, lon: 6.526, country: 'DE' },
      { name: 'RWE — Garzweiler (lignite)', lat: 51.069, lon: 6.520, country: 'DE' },
      // Belgium
      { name: 'Sibelco — Dessel', lat: 51.238, lon: 5.115, country: 'BE' },
      // Spain
      { name: 'Riotinto (cuivre)', lat: 37.694, lon: -6.594, country: 'ES' },
      { name: 'Almadén (mercure historique)', lat: 38.775, lon: -4.838, country: 'ES' },
      // Greece
      { name: 'Aluminium de Grèce — Distomon (bauxite)', lat: 38.428, lon: 22.712, country: 'GR' },
      // Austria
      { name: 'VA Erzberg — Eisenerz', lat: 47.531, lon: 14.893, country: 'AT' },
      // Finland
      { name: 'Boliden — Kevitsa (nickel)', lat: 67.697, lon: 26.069, country: 'FI' },
      { name: 'Outokumpu — Kemi (chrome)', lat: 65.811, lon: 24.609, country: 'FI' },
      // Ireland
      { name: 'Boliden — Tara Mine (zinc)', lat: 53.585, lon: -6.826, country: 'IE' },
      // Portugal
      { name: 'Somincor — Neves-Corvo (cuivre)', lat: 37.584, lon: -7.972, country: 'PT' },
    ],
  },

  /* ───────── 13. AGRO-INDUSTRIE ───────── */
  {
    type: 'food_processing',
    name: 'Agro-industrie',
    icon: 'ind_food',
    cargoTypes: ['sugar', 'flour', 'frozen-food', 'beverages', 'canned-food', 'sugar-beet', 'milk'],
    cargoOut: 'Produits alimentaires',
    dailyTonnageMin: 200,
    dailyTonnageMax: 1000,
    pricePerTonne: 60,
    attractCost: 100000,
    description: 'Transformation alimentaire : sucrerie, laiterie, conserverie.',
    realLocations: [
      // France
      { name: 'Tereos — Origny-Sainte-Benoite', lat: 49.833, lon: 3.517, country: 'FR' },
      { name: 'Cristal Union — Bazancourt', lat: 49.343, lon: 3.836, country: 'FR' },
      { name: 'Lactalis — Laval', lat: 48.073, lon: -0.768, country: 'FR' },
      { name: 'Danone — Bailleul', lat: 50.739, lon: 2.733, country: 'FR' },
      { name: 'Roquette — Lestrem', lat: 50.634, lon: 2.693, country: 'FR' },
      { name: 'Bonduelle — Renescure', lat: 50.729, lon: 2.316, country: 'FR' },
      { name: 'Nestlé — Pontarlier', lat: 46.903, lon: 6.357, country: 'FR' },
      // Germany
      { name: 'Südzucker — Ochsenfurt', lat: 49.668, lon: 10.061, country: 'DE' },
      { name: 'Südzucker — Plattling', lat: 48.771, lon: 12.874, country: 'DE' },
      { name: 'Nordzucker — Uelzen', lat: 52.954, lon: 10.558, country: 'DE' },
      { name: 'Dr. Oetker — Bielefeld', lat: 52.027, lon: 8.538, country: 'DE' },
      // Netherlands
      { name: 'FrieslandCampina — Leeuwarden', lat: 53.195, lon: 5.786, country: 'NL' },
      { name: 'Cosun/Suiker Unie — Dinteloord', lat: 51.633, lon: 4.372, country: 'NL' },
      // Belgium
      { name: 'Raffinerie Tirlemontoise — Tienen', lat: 50.807, lon: 4.934, country: 'BE' },
      // Italy
      { name: 'Barilla — Parma', lat: 44.800, lon: 10.329, country: 'IT' },
      { name: 'Ferrero — Alba', lat: 44.694, lon: 8.033, country: 'IT' },
      // Spain
      { name: 'Ebro Foods — Madrid', lat: 40.462, lon: -3.713, country: 'ES' },
      // Ireland
      { name: 'Kerry Group — Listowel', lat: 52.444, lon: -9.487, country: 'IE' },
      { name: 'Glanbia — Kilkenny', lat: 52.654, lon: -7.251, country: 'IE' },
      // Portugal
      { name: 'RAR — Porto', lat: 41.144, lon: -8.612, country: 'PT' },
      // Finland
      { name: 'Valio — Helsinki', lat: 60.228, lon: 24.887, country: 'FI' },
    ],
  },

  /* ───────── 14. CENTRE DE TRAITEMENT DÉCHETS ───────── */
  {
    type: 'waste_center',
    name: 'Centre de traitement déchets',
    icon: 'ind_waste',
    cargoTypes: ['household-waste', 'recyclables', 'industrial-waste', 'used-oil'],
    cargoOut: 'Matières recyclées',
    dailyTonnageMin: 200,
    dailyTonnageMax: 1500,
    pricePerTonne: 25,
    attractCost: 70000,
    description: 'Traitement et recyclage : 200-1500t/jour.',
    realLocations: [
      // France
      { name: 'Veolia — Limay', lat: 48.993, lon: 1.742, country: 'FR' },
      { name: 'Suez — Nanterre', lat: 48.897, lon: 2.199, country: 'FR' },
      { name: 'Paprec — La Courneuve', lat: 48.924, lon: 2.396, country: 'FR' },
      { name: 'Séché — Changé', lat: 48.063, lon: -0.756, country: 'FR' },
      { name: 'Veolia — Claye-Souilly', lat: 48.951, lon: 2.683, country: 'FR' },
      // Germany
      { name: 'ALBA — Berlin', lat: 52.505, lon: 13.472, country: 'DE' },
      { name: 'Remondis — Lünen', lat: 51.617, lon: 7.524, country: 'DE' },
      { name: 'PreZero — Porta Westfalica', lat: 52.234, lon: 8.912, country: 'DE' },
      // Netherlands
      { name: 'AEB Amsterdam', lat: 52.391, lon: 4.827, country: 'NL' },
      { name: 'AVR Rotterdam', lat: 51.891, lon: 4.340, country: 'NL' },
      // Belgium
      { name: 'INDAVER — Antwerpen', lat: 51.287, lon: 4.315, country: 'BE' },
      // Italy
      { name: 'A2A — Brescia', lat: 45.527, lon: 10.247, country: 'IT' },
      // Spain
      { name: 'Urbaser — Madrid', lat: 40.473, lon: -3.545, country: 'ES' },
      // Austria
      { name: 'Spittelau — Wien', lat: 48.235, lon: 16.360, country: 'AT' },
    ],
  },

  /* ───────── 15. BASE MILITAIRE ───────── */
  {
    type: 'military_base',
    name: 'Base militaire',
    icon: 'ind_military',
    cargoTypes: ['military', 'explosives', 'construction-equip'],
    cargoOut: 'Matériel militaire',
    dailyTonnageMin: 50,
    dailyTonnageMax: 300,
    pricePerTonne: 200,
    attractCost: 180000,
    description: 'Convois militaires sécurisés. Volume modéré, haut revenu.',
    realLocations: [
      // France
      { name: 'Camp de Mourmelon', lat: 49.132, lon: 4.359, country: 'FR' },
      { name: 'Camp de Mailly', lat: 48.660, lon: 3.863, country: 'FR' },
      { name: 'Arsenal de Bourges', lat: 47.084, lon: 2.395, country: 'FR' },
      { name: 'Camp de Canjuers', lat: 43.622, lon: 6.352, country: 'FR' },
      { name: 'Base aérienne d\'Istres', lat: 43.522, lon: 4.928, country: 'FR' },
      { name: 'DGA — Biscarrosse', lat: 44.375, lon: -1.228, country: 'FR' },
      // Germany
      { name: 'Ramstein Air Base', lat: 49.436, lon: 7.603, country: 'DE' },
      { name: 'Grafenwöhr Training Area', lat: 49.693, lon: 11.694, country: 'DE' },
      { name: 'Munster (Panzer)', lat: 52.980, lon: 10.098, country: 'DE' },
      // Italy
      { name: 'Base OTAN — Aviano', lat: 46.030, lon: 12.597, country: 'IT' },
      { name: 'Camp Darby — Pisa', lat: 43.685, lon: 10.340, country: 'IT' },
      // Spain
      { name: 'Base de Rota', lat: 36.641, lon: -6.351, country: 'ES' },
      { name: 'Base de Morón', lat: 37.175, lon: -5.615, country: 'ES' },
      // Belgium
      { name: 'SHAPE — Mons', lat: 50.505, lon: 3.968, country: 'BE' },
      { name: 'Kleine-Brogel AB', lat: 51.168, lon: 5.470, country: 'BE' },
      // Netherlands
      { name: 'RNLAF — Volkel', lat: 51.657, lon: 5.707, country: 'NL' },
      // Greece
      { name: 'Souda Bay — Crète', lat: 35.490, lon: 24.118, country: 'GR' },
    ],
  },

  /* ───────── 16. VERRERIE ───────── */
  {
    type: 'glass_factory',
    name: 'Verrerie',
    icon: 'ind_glass',
    cargoTypes: ['sand', 'limestone', 'glass', 'recyclables'],
    cargoOut: 'Verre plat / creux',
    dailyTonnageMin: 150,
    dailyTonnageMax: 500,
    pricePerTonne: 45,
    attractCost: 85000,
    description: 'Fabrication de verre : 150-500t/jour. Consomme sable et calcaire.',
    realLocations: [
      // France
      { name: 'Saint-Gobain — Chantereine', lat: 49.075, lon: 2.586, country: 'FR' },
      { name: 'AGC — Boussois', lat: 50.293, lon: 4.048, country: 'FR' },
      { name: 'O-I — Veauche', lat: 45.561, lon: 4.281, country: 'FR' },
      { name: 'Arc International — Arques', lat: 50.741, lon: 2.298, country: 'FR' },
      { name: 'Duralex — La Chapelle-Saint-Mesmin', lat: 47.887, lon: 1.833, country: 'FR' },
      // Germany
      { name: 'Schott — Mainz', lat: 49.999, lon: 8.261, country: 'DE' },
      { name: 'Pilkington — Gladbeck', lat: 51.569, lon: 6.994, country: 'DE' },
      // Italy
      { name: 'Bormioli — Parma', lat: 44.803, lon: 10.326, country: 'IT' },
      // Belgium
      { name: 'AGC — Fleurus', lat: 50.471, lon: 4.562, country: 'BE' },
      // Spain
      { name: 'Saint-Gobain — Avilés', lat: 43.552, lon: -5.920, country: 'ES' },
      // Portugal
      { name: 'BA Glass — Marinha Grande', lat: 39.747, lon: -8.939, country: 'PT' },
      // Austria
      { name: 'Stölzle — Köflach', lat: 47.068, lon: 15.088, country: 'AT' },
    ],
  },

  /* ───────── 17. PARC ÉOLIEN (CHANTIER) ───────── */
  {
    type: 'wind_farm',
    name: 'Parc éolien (composants)',
    icon: 'ind_wind',
    cargoTypes: ['wind-blade', 'bridge-section', 'transformer', 'construction-equip'],
    cargoOut: 'Composants éoliens',
    dailyTonnageMin: 20,
    dailyTonnageMax: 100,
    pricePerTonne: 300,
    attractCost: 150000,
    description: 'Convois exceptionnels hors gabarit pour éoliennes.',
    realLocations: [
      // France
      { name: 'Siemens Gamesa — Le Havre', lat: 49.489, lon: 0.125, country: 'FR' },
      { name: 'GE Renewable — Cherbourg', lat: 49.648, lon: -1.622, country: 'FR' },
      { name: 'LM Wind Power — Cherbourg', lat: 49.641, lon: -1.615, country: 'FR' },
      // Germany
      { name: 'Siemens Gamesa — Cuxhaven', lat: 53.862, lon: 8.706, country: 'DE' },
      { name: 'Enercon — Aurich', lat: 53.469, lon: 7.484, country: 'DE' },
      { name: 'Vestas — Lauchhammer', lat: 51.489, lon: 13.762, country: 'DE' },
      { name: 'Nordex — Rostock', lat: 54.179, lon: 12.077, country: 'DE' },
      // Denmark (in Eurozone context)
      { name: 'Vestas — Esbjerg', lat: 55.476, lon: 8.452, country: 'DK' },
      // Spain
      { name: 'Siemens Gamesa — Miranda de Ebro', lat: 42.690, lon: -2.947, country: 'ES' },
      { name: 'Siemens Gamesa — Asteasu', lat: 43.196, lon: -2.076, country: 'ES' },
      // Portugal
      { name: 'Enercon — Viana do Castelo', lat: 41.693, lon: -8.834, country: 'PT' },
      // Finland
      { name: 'TuuliWatti — Pori', lat: 61.484, lon: 21.782, country: 'FI' },
    ],
  },

  /* ───────── 18. PHARMACEUTIQUE ───────── */
  {
    type: 'pharma',
    name: 'Industrie pharmaceutique',
    icon: 'ind_pharma',
    cargoTypes: ['chemicals-liq', 'frozen-food', 'parcels', 'express'],
    cargoOut: 'Produits pharmaceutiques',
    dailyTonnageMin: 50,
    dailyTonnageMax: 200,
    pricePerTonne: 500,
    attractCost: 200000,
    description: 'Pharma et biotech : 50-200t/jour. Très haut revenu par tonne.',
    realLocations: [
      // France
      { name: 'Sanofi — Vitry-sur-Seine', lat: 48.787, lon: 2.405, country: 'FR' },
      { name: 'Sanofi — Sisteron', lat: 44.198, lon: 5.942, country: 'FR' },
      { name: 'Servier — Gidy', lat: 47.963, lon: 1.836, country: 'FR' },
      { name: 'Ipsen — Dreux', lat: 48.737, lon: 1.364, country: 'FR' },
      // Germany
      { name: 'Bayer Pharma — Leverkusen', lat: 51.035, lon: 6.992, country: 'DE' },
      { name: 'Boehringer Ingelheim', lat: 49.977, lon: 8.056, country: 'DE' },
      { name: 'Merck — Darmstadt', lat: 49.856, lon: 8.641, country: 'DE' },
      { name: 'BioNTech — Mainz', lat: 49.996, lon: 8.264, country: 'DE' },
      // Belgium
      { name: 'GSK — Wavre', lat: 50.714, lon: 4.612, country: 'BE' },
      { name: 'UCB — Braine-l\'Alleud', lat: 50.679, lon: 4.363, country: 'BE' },
      { name: 'Pfizer — Puurs', lat: 51.076, lon: 4.283, country: 'BE' },
      // Ireland
      { name: 'Pfizer — Ringaskiddy', lat: 51.829, lon: -8.330, country: 'IE' },
      { name: 'MSD — Carlow', lat: 52.838, lon: -6.934, country: 'IE' },
      { name: 'Eli Lilly — Kinsale', lat: 51.706, lon: -8.524, country: 'IE' },
      { name: 'AbbVie — Sligo', lat: 54.273, lon: -8.474, country: 'IE' },
      // Italy
      { name: 'Menarini — Florence', lat: 43.771, lon: 11.254, country: 'IT' },
      { name: 'Chiesi — Parma', lat: 44.802, lon: 10.332, country: 'IT' },
      // Spain
      { name: 'Grifols — Barcelona', lat: 41.469, lon: 2.163, country: 'ES' },
      { name: 'Almirall — Sant Andreu', lat: 41.441, lon: 2.190, country: 'ES' },
      // Netherlands
      { name: 'MSD — Oss', lat: 51.762, lon: 5.523, country: 'NL' },
      // Austria
      { name: 'Sandoz — Kundl', lat: 47.463, lon: 11.998, country: 'AT' },
      // Finland
      { name: 'Orion — Espoo', lat: 60.207, lon: 24.657, country: 'FI' },
    ],
  },

  /* ───────── 19. TEXTILE ───────── */
  {
    type: 'textile',
    name: 'Industrie textile',
    icon: 'ind_textile',
    cargoTypes: ['cotton-bales', 'plastic-granules', 'parcels', 'paper'],
    cargoOut: 'Textiles / Fibres',
    dailyTonnageMin: 80,
    dailyTonnageMax: 300,
    pricePerTonne: 70,
    attractCost: 60000,
    description: 'Production textile : 80-300t/jour. Fibres, tissus, vêtements.',
    realLocations: [
      // France
      { name: 'Dickson Constant — Wasquehal', lat: 50.674, lon: 3.137, country: 'FR' },
      { name: 'Mulliez-Flory — Nieppe', lat: 50.702, lon: 2.839, country: 'FR' },
      // Italy
      { name: 'Benetton — Treviso', lat: 45.667, lon: 12.242, country: 'IT' },
      { name: 'Prato textile district', lat: 43.881, lon: 11.098, country: 'IT' },
      { name: 'Biella textile district', lat: 45.563, lon: 8.050, country: 'IT' },
      // Spain
      { name: 'Inditex — Arteixo', lat: 43.305, lon: -8.508, country: 'ES' },
      // Portugal
      { name: 'Textile Guimarães', lat: 41.443, lon: -8.296, country: 'PT' },
      { name: 'Riopele — Pousada de Saramagos', lat: 41.410, lon: -8.335, country: 'PT' },
      // Germany
      { name: 'Freudenberg — Weinheim', lat: 49.546, lon: 8.672, country: 'DE' },
      // Greece
      { name: 'Thrace Group — Xanthi', lat: 41.141, lon: 24.887, country: 'GR' },
    ],
  },

  /* ───────── 20. ÉLECTRONIQUE / SEMI-CONDUCTEURS ───────── */
  {
    type: 'electronics',
    name: 'Électronique / Semi-conducteurs',
    icon: 'ind_electronics',
    cargoTypes: ['parcels', 'express', 'chemicals-liq', 'containers-20'],
    cargoOut: 'Composants électroniques',
    dailyTonnageMin: 30,
    dailyTonnageMax: 150,
    pricePerTonne: 800,
    attractCost: 300000,
    description: 'Semi-conducteurs et électronique : 30-150t/jour. Extrême valeur.',
    realLocations: [
      // France
      { name: 'STMicroelectronics — Crolles', lat: 45.281, lon: 5.961, country: 'FR' },
      { name: 'STMicroelectronics — Tours', lat: 47.391, lon: 0.701, country: 'FR' },
      { name: 'Soitec — Bernin', lat: 45.270, lon: 5.870, country: 'FR' },
      // Germany
      { name: 'Infineon — Dresden', lat: 51.060, lon: 13.715, country: 'DE' },
      { name: 'Bosch — Reutlingen', lat: 48.491, lon: 9.206, country: 'DE' },
      { name: 'GlobalFoundries — Dresden', lat: 51.063, lon: 13.720, country: 'DE' },
      { name: 'TSMC — Dresden (en construction)', lat: 51.058, lon: 13.725, country: 'DE' },
      { name: 'Intel — Magdeburg (en construction)', lat: 52.131, lon: 11.628, country: 'DE' },
      // Netherlands
      { name: 'ASML — Veldhoven', lat: 51.408, lon: 5.393, country: 'NL' },
      { name: 'NXP — Nijmegen', lat: 51.833, lon: 5.869, country: 'NL' },
      // Ireland
      { name: 'Intel — Leixlip', lat: 53.365, lon: -6.484, country: 'IE' },
      { name: 'Analog Devices — Limerick', lat: 52.663, lon: -8.633, country: 'IE' },
      // Italy
      { name: 'STMicroelectronics — Catania', lat: 37.509, lon: 15.090, country: 'IT' },
      { name: 'STMicroelectronics — Agrate', lat: 45.571, lon: 9.346, country: 'IT' },
      // Austria
      { name: 'Infineon — Villach', lat: 46.611, lon: 13.854, country: 'AT' },
      { name: 'ams-OSRAM — Premstätten', lat: 46.970, lon: 15.398, country: 'AT' },
      // Finland
      { name: 'Okmetic — Vantaa', lat: 60.293, lon: 24.963, country: 'FI' },
    ],
  },

  /* ───────── 21. AÉRONAUTIQUE / DÉFENSE ───────── */
  {
    type: 'aerospace',
    name: 'Aéronautique / Défense',
    icon: 'ind_aerospace',
    cargoTypes: ['wind-blade', 'construction-equip', 'containers-40', 'military'],
    cargoOut: 'Pièces aéronautiques',
    dailyTonnageMin: 30,
    dailyTonnageMax: 200,
    pricePerTonne: 400,
    attractCost: 250000,
    description: 'Production aéronautique : pièces, sous-ensembles, moteurs. Haut revenu.',
    realLocations: [
      // France
      { name: 'Airbus — Toulouse (Blagnac)', lat: 43.621, lon: 1.374, country: 'FR' },
      { name: 'Airbus — Saint-Nazaire', lat: 47.299, lon: -2.135, country: 'FR' },
      { name: 'Airbus — Nantes', lat: 47.168, lon: -1.590, country: 'FR' },
      { name: 'Safran — Gennevilliers', lat: 48.925, lon: 2.293, country: 'FR' },
      { name: 'Dassault — Mérignac', lat: 44.831, lon: -0.688, country: 'FR' },
      { name: 'Thales — Élancourt', lat: 48.770, lon: 1.975, country: 'FR' },
      { name: 'Safran — Villaroche', lat: 48.622, lon: 2.613, country: 'FR' },
      // Germany
      { name: 'Airbus — Hamburg-Finkenwerder', lat: 53.536, lon: 9.837, country: 'DE' },
      { name: 'Airbus Defence — Manching', lat: 48.707, lon: 11.540, country: 'DE' },
      { name: 'MTU Aero Engines — Munich', lat: 48.104, lon: 11.701, country: 'DE' },
      { name: 'Airbus — Bremen', lat: 53.053, lon: 8.787, country: 'DE' },
      // Spain
      { name: 'Airbus — Getafe', lat: 40.293, lon: -3.722, country: 'ES' },
      { name: 'Airbus — Sevilla (San Pablo)', lat: 37.417, lon: -6.002, country: 'ES' },
      { name: 'ITP Aero — Zamudio', lat: 43.286, lon: -2.876, country: 'ES' },
      // Italy
      { name: 'Leonardo — Pomigliano', lat: 40.915, lon: 14.386, country: 'IT' },
      { name: 'Leonardo — Cameri', lat: 45.528, lon: 8.654, country: 'IT' },
      { name: 'Piaggio Aero — Genova', lat: 44.434, lon: 8.852, country: 'IT' },
      // Belgium
      { name: 'SABCA — Haren', lat: 50.887, lon: 4.408, country: 'BE' },
    ],
  },

  /* ───────── 22. CHANTIER NAVAL ───────── */
  {
    type: 'shipyard',
    name: 'Chantier naval',
    icon: 'ind_shipyard',
    cargoTypes: ['steel-sheet', 'steel-beams', 'construction-equip', 'paint', 'transformer'],
    cargoOut: 'Sections de navire',
    dailyTonnageMin: 50,
    dailyTonnageMax: 300,
    pricePerTonne: 150,
    attractCost: 200000,
    description: 'Construction navale : 50-300t/jour de composants lourds.',
    realLocations: [
      // France
      { name: 'Chantiers de l\'Atlantique — Saint-Nazaire', lat: 47.280, lon: -2.170, country: 'FR' },
      { name: 'Naval Group — Lorient', lat: 47.740, lon: -3.355, country: 'FR' },
      { name: 'Naval Group — Cherbourg', lat: 49.640, lon: -1.610, country: 'FR' },
      { name: 'Naval Group — Toulon', lat: 43.120, lon: 5.936, country: 'FR' },
      // Germany
      { name: 'Meyer Werft — Papenburg', lat: 53.078, lon: 7.399, country: 'DE' },
      { name: 'ThyssenKrupp Marine — Kiel', lat: 54.332, lon: 10.165, country: 'DE' },
      { name: 'Flensburger Schiffbau', lat: 54.796, lon: 9.433, country: 'DE' },
      // Italy
      { name: 'Fincantieri — Monfalcone', lat: 45.794, lon: 13.528, country: 'IT' },
      { name: 'Fincantieri — Marghera', lat: 45.449, lon: 12.228, country: 'IT' },
      { name: 'Fincantieri — Sestri Ponente', lat: 44.419, lon: 8.853, country: 'IT' },
      // Spain
      { name: 'Navantia — Ferrol', lat: 43.483, lon: -8.222, country: 'ES' },
      { name: 'Navantia — Cartagena', lat: 37.594, lon: -0.978, country: 'ES' },
      { name: 'Navantia — Cádiz', lat: 36.524, lon: -6.283, country: 'ES' },
      // Finland
      { name: 'Meyer Turku', lat: 60.437, lon: 22.212, country: 'FI' },
      // Netherlands
      { name: 'Damen — Vlissingen', lat: 51.443, lon: 3.571, country: 'NL' },
      { name: 'IHC — Kinderdijk', lat: 51.884, lon: 4.649, country: 'NL' },
      // Croatia
      { name: 'Brodosplit — Split', lat: 43.516, lon: 16.424, country: 'HR' },
      { name: 'Uljanik — Pula', lat: 44.865, lon: 13.835, country: 'HR' },
    ],
  },

  /* ───────── 23. BRASSERIE / BOISSONS ───────── */
  {
    type: 'brewery',
    name: 'Brasserie / Boissons',
    icon: 'ind_brewery',
    cargoTypes: ['barley', 'beverages', 'glass', 'containers-20'],
    cargoOut: 'Boissons',
    dailyTonnageMin: 100,
    dailyTonnageMax: 500,
    pricePerTonne: 80,
    attractCost: 80000,
    description: 'Production de boissons : bière, eau, sodas. 100-500t/jour.',
    realLocations: [
      // France
      { name: 'Kronenbourg — Obernai', lat: 48.461, lon: 7.487, country: 'FR' },
      { name: 'Heineken — Schiltigheim', lat: 48.608, lon: 7.749, country: 'FR' },
      { name: 'Perrier — Vergèze', lat: 43.744, lon: 4.226, country: 'FR' },
      { name: 'Danone Eaux — Évian', lat: 46.401, lon: 6.592, country: 'FR' },
      // Germany
      { name: 'Beck\'s — Bremen', lat: 53.062, lon: 8.822, country: 'DE' },
      { name: 'Warsteiner — Warstein', lat: 51.444, lon: 8.350, country: 'DE' },
      { name: 'Bitburger — Bitburg', lat: 49.972, lon: 6.524, country: 'DE' },
      { name: 'Krombacher — Kreuztal', lat: 50.964, lon: 7.989, country: 'DE' },
      // Belgium
      { name: 'AB InBev — Leuven', lat: 50.880, lon: 4.702, country: 'BE' },
      { name: 'Duvel Moortgat — Puurs', lat: 51.074, lon: 4.279, country: 'BE' },
      // Netherlands
      { name: 'Heineken — Zoeterwoude', lat: 52.118, lon: 4.489, country: 'NL' },
      { name: 'Grolsch — Enschede', lat: 52.210, lon: 6.882, country: 'NL' },
      // Ireland
      { name: 'Guinness — St. James\'s Gate, Dublin', lat: 53.342, lon: -6.287, country: 'IE' },
      { name: 'Heineken — Cork', lat: 51.897, lon: -8.471, country: 'IE' },
      // Italy
      { name: 'Peroni — Roma', lat: 41.893, lon: 12.516, country: 'IT' },
      // Spain
      { name: 'Mahou — Madrid', lat: 40.407, lon: -3.698, country: 'ES' },
      { name: 'Estrella Damm — Barcelona', lat: 41.424, lon: 2.188, country: 'ES' },
      // Austria
      { name: 'Stiegl — Salzburg', lat: 47.792, lon: 13.014, country: 'AT' },
      // Portugal
      { name: 'Super Bock — Leça do Balio', lat: 41.192, lon: -8.618, country: 'PT' },
    ],
  },

  /* ───────── 24. MINE SOUTERRAINE ───────── */
  {
    type: 'mine',
    name: 'Mine souterraine',
    icon: 'ind_mine',
    cargoTypes: ['ore', 'coal', 'salt', 'bauxite', 'limestone'],
    cargoOut: 'Minerai brut',
    dailyTonnageMin: 300,
    dailyTonnageMax: 2000,
    pricePerTonne: 18,
    attractCost: 90000,
    description: 'Extraction souterraine : 300-2000t/jour. Gros volumes, prix modéré.',
    realLocations: [
      // Germany
      { name: 'K+S — Werra (potasse)', lat: 50.868, lon: 9.920, country: 'DE' },
      { name: 'K+S — Bernburg (sel)', lat: 51.809, lon: 11.739, country: 'DE' },
      { name: 'RAG — Prosper-Haniel (dernière mine charbon)', lat: 51.564, lon: 6.886, country: 'DE' },
      // Spain
      { name: 'ICL — Sallent/Súria (potasse)', lat: 41.830, lon: 1.841, country: 'ES' },
      { name: 'Minas de Riotinto', lat: 37.694, lon: -6.594, country: 'ES' },
      // Finland
      { name: 'Boliden — Kevitsa (Ni, Cu)', lat: 67.697, lon: 26.069, country: 'FI' },
      { name: 'Agnico Eagle — Kittilä (or)', lat: 67.924, lon: 25.429, country: 'FI' },
      { name: 'Terrafame — Sotkamo (Ni)', lat: 63.963, lon: 28.022, country: 'FI' },
      // Ireland
      { name: 'Boliden Tara — Navan (zinc)', lat: 53.585, lon: -6.826, country: 'IE' },
      // Portugal
      { name: 'Somincor — Neves-Corvo (Cu)', lat: 37.584, lon: -7.972, country: 'PT' },
      { name: 'Panasqueira (tungstène)', lat: 40.161, lon: -7.784, country: 'PT' },
      // Greece
      { name: 'Eldorado Gold — Olympias', lat: 40.596, lon: 23.774, country: 'GR' },
      { name: 'Eldorado Gold — Stratoni', lat: 40.511, lon: 23.855, country: 'GR' },
      // Austria
      { name: 'Salinen — Altaussee (sel)', lat: 47.636, lon: 13.772, country: 'AT' },
      { name: 'Wolfram Bergbau — Mittersill', lat: 47.285, lon: 12.473, country: 'AT' },
      // Slovakia
      { name: 'Hornonitrianske bane — Nováky (lignite)', lat: 48.727, lon: 18.541, country: 'SK' },
    ],
  },

  /* ───────── 25. PNEUS / CAOUTCHOUC ───────── */
  {
    type: 'tire_plant',
    name: 'Usine de pneumatiques',
    icon: 'ind_auto',
    cargoTypes: ['tires', 'rubber', 'plastic-granules', 'chemicals-liq'],
    cargoOut: 'Pneumatiques',
    dailyTonnageMin: 100,
    dailyTonnageMax: 400,
    pricePerTonne: 100,
    attractCost: 110000,
    description: 'Production de pneus : 100-400t/jour. Export massif.',
    realLocations: [
      // France
      { name: 'Michelin — Clermont-Ferrand', lat: 45.784, lon: 3.070, country: 'FR' },
      { name: 'Michelin — Cholet', lat: 47.058, lon: -0.882, country: 'FR' },
      { name: 'Michelin — La Roche-sur-Yon', lat: 46.671, lon: -1.427, country: 'FR' },
      { name: 'Continental — Sarreguemines', lat: 49.109, lon: 7.073, country: 'FR' },
      // Germany
      { name: 'Continental — Hannover', lat: 52.374, lon: 9.728, country: 'DE' },
      { name: 'Continental — Aachen', lat: 50.776, lon: 6.084, country: 'DE' },
      // Italy
      { name: 'Pirelli — Settimo Torinese', lat: 45.137, lon: 7.766, country: 'IT' },
      { name: 'Pirelli — Bollate', lat: 45.541, lon: 9.115, country: 'IT' },
      // Spain
      { name: 'Michelin — Vitoria-Gasteiz', lat: 42.846, lon: -2.672, country: 'ES' },
      { name: 'Bridgestone — Bilbao', lat: 43.292, lon: -2.897, country: 'ES' },
      // Portugal
      { name: 'Continental — Lousado', lat: 41.379, lon: -8.451, country: 'PT' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COUNTRY FLAGS & NAMES
   ═══════════════════════════════════════════════════════════════════════════ */
const COUNTRY_NAMES = {
  FR: 'France', DE: 'Allemagne', BE: 'Belgique', NL: 'Pays-Bas', IT: 'Italie',
  ES: 'Espagne', PT: 'Portugal', AT: 'Autriche', LU: 'Luxembourg', IE: 'Irlande',
  FI: 'Finlande', GR: 'Grèce', SK: 'Slovaquie', SI: 'Slovénie', EE: 'Estonie',
  LV: 'Lettonie', LT: 'Lituanie', HR: 'Croatie', CY: 'Chypre', MT: 'Malte',
  DK: 'Danemark',
};

/* ═══════════════════════════════════════════════════════════════════════════
   INDUSTRY COLORS for map rendering
   ═══════════════════════════════════════════════════════════════════════════ */
const INDUSTRY_COLORS = {
  cement: '#a8a29e',
  refinery: '#f97316',
  port: '#3b82f6',
  steel_mill: '#6b7280',
  auto_plant: '#22c55e',
  grain_terminal: '#eab308',
  chemical_plant: '#a855f7',
  paper_mill: '#84cc16',
  logistics_hub: '#06b6d4',
  power_plant: '#ef4444',
  nuclear_plant: '#facc15',
  quarry: '#78716c',
  food_processing: '#f472b6',
  waste_center: '#64748b',
  military_base: '#16a34a',
  glass_factory: '#67e8f9',
  wind_farm: '#10b981',
  pharma: '#c084fc',
  textile: '#fb923c',
  electronics: '#2563eb',
  aerospace: '#0ea5e9',
  shipyard: '#0369a1',
  brewery: '#d97706',
  mine: '#92400e',
  tire_plant: '#1e293b',
};

/* ═══════════════════════════════════════════════════════════════════════════
   CLASS
   ═══════════════════════════════════════════════════════════════════════════ */
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

  getIndustryTypes() { return INDUSTRY_TYPES; }
  getIndustryColors() { return INDUSTRY_COLORS; }
  getCountryNames() { return COUNTRY_NAMES; }

  getIndustryInfo(type) {
    return INDUSTRY_TYPES.find(i => i.type === type) || null;
  }

  getAllRealLocations() {
    const locs = [];
    for (const ind of INDUSTRY_TYPES) {
      if (!ind.realLocations) continue;
      for (const loc of ind.realLocations) {
        locs.push({
          ...loc,
          industryType: ind.type,
          industryName: ind.name,
          industryIcon: ind.icon,
          color: INDUSTRY_COLORS[ind.type] || '#94a3b8',
        });
      }
    }
    return locs;
  }

  attractClient(industryType, stationId, depotId, economy) {
    const industry = this.getIndustryInfo(industryType);
    if (!industry) return null;
    if (economy.balance < industry.attractCost) return null;

    economy.addExpense(industry.attractCost, 'infrastructure', `Attraction client: ${industry.name}`);

    const dailyTonnage = industry.dailyTonnageMin +
      Math.floor(Math.random() * (industry.dailyTonnageMax - industry.dailyTonnageMin));

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

    // Count real locations
    let totalLocs = 0;
    let totalCountries = new Set();
    for (const ind of INDUSTRY_TYPES) {
      if (ind.realLocations) {
        totalLocs += ind.realLocations.length;
        ind.realLocations.forEach(l => totalCountries.add(l.country));
      }
    }

    container.innerHTML = `
      <div class="dash-section">
        <h3>${icon('factory', 18)} Clients Industriels</h3>
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
            <div class="dash-kpi-label">Sites réels référencés</div>
            <div class="dash-kpi-value" style="color:#f97316">${totalLocs} (${totalCountries.size} pays)</div>
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
        <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Sélectionnez une gare avec une ITE, puis choisissez le type d'industrie.</p>

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
            const color = INDUSTRY_COLORS[ind.type] || '#3b82f6';
            return `<button class="industrial-attract btn-primary" data-type="${ind.type}"
              style="font-size:11px;padding:10px 14px;background:${affordable ? color : '#991b1b'};text-align:left;border:1px solid ${color}50"
              ${!affordable ? 'disabled' : ''}>
              ${icon(ind.icon, 14)} <b>${ind.name}</b><br>
              <span style="font-size:9px;opacity:0.8">${ind.description}</span><br>
              <span style="font-size:10px;color:#fbbf24">${ind.attractCost.toLocaleString('fr-FR')} € | ${ind.dailyTonnageMin}-${ind.dailyTonnageMax} t/j | ${ind.pricePerTonne} €/t</span>
              ${ind.realLocations ? `<br><span style="font-size:8px;opacity:0.6">${ind.realLocations.length} sites réels</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>${icon('map', 16)} Implantations réelles — ${totalLocs} sites dans ${totalCountries.size} pays</h3>
        <p style="font-size:10px;color:var(--text3);margin-bottom:8px">Activez le toggle "Industries" sur la carte pour voir tous les sites. Filtrez par pays ou type.</p>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <select id="ind-filter-country" style="padding:4px 8px;font-size:11px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Tous les pays</option>
            ${[...totalCountries].sort().map(c => `<option value="${c}">${COUNTRY_NAMES[c] || c}</option>`).join('')}
          </select>
          <select id="ind-filter-type" style="padding:4px 8px;font-size:11px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Tous les types</option>
            ${INDUSTRY_TYPES.map(ind => `<option value="${ind.type}">${ind.name}</option>`).join('')}
          </select>
        </div>

        <div id="ind-locations-table" class="dash-train-table" style="max-height:400px;overflow-y:auto">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 0.6fr 1.5fr 0.3fr 0.4fr 0.4fr">
            <span></span><span>Type</span><span>Site</span><span>Pays</span><span>Lat</span><span>Lon</span>
          </div>
          ${this._renderLocationsRows('', '')}
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
        if (confirm('Résilier ce client ?')) {
          this.removeClient(btn.dataset.id);
          this.render(container, game);
        }
      });
    });

    // Bind filters
    const filterCountry = container.querySelector('#ind-filter-country');
    const filterType = container.querySelector('#ind-filter-type');
    const tableBody = container.querySelector('#ind-locations-table');
    const updateFilter = () => {
      if (!tableBody) return;
      const header = tableBody.querySelector('.dash-train-header')?.outerHTML || '';
      tableBody.innerHTML = header + this._renderLocationsRows(
        filterCountry?.value || '',
        filterType?.value || ''
      );
    };
    filterCountry?.addEventListener('change', updateFilter);
    filterType?.addEventListener('change', updateFilter);
  }

  _renderLocationsRows(countryFilter, typeFilter) {
    let html = '';
    for (const ind of INDUSTRY_TYPES) {
      if (typeFilter && ind.type !== typeFilter) continue;
      if (!ind.realLocations) continue;
      const color = INDUSTRY_COLORS[ind.type] || '#94a3b8';
      for (const loc of ind.realLocations) {
        if (countryFilter && loc.country !== countryFilter) continue;
        html += `
          <div class="dash-train-row" style="grid-template-columns:0.3fr 0.6fr 1.5fr 0.3fr 0.4fr 0.4fr">
            <span>${icon(ind.icon, 12)}</span>
            <span style="font-size:10px;color:${color}">${ind.name}</span>
            <span style="font-size:10px">${loc.name}</span>
            <span style="font-size:9px;color:var(--text3)">${loc.country}</span>
            <span style="font-size:9px;color:var(--text3)">${loc.lat.toFixed(3)}</span>
            <span style="font-size:9px;color:var(--text3)">${loc.lon.toFixed(3)}</span>
          </div>
        `;
      }
    }
    return html;
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
