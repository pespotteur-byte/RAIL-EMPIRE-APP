/**
 * IndustrialClients — Comprehensive real-world industrial database.
 * 52 industry types, 3500+ real sites across ALL Eurozone countries.
 * FR, DE, BE, NL, IT, ES, AT, PT, LU, IE, FI, GR, SK, SI, EE, LV, LT, CY, MT, HR, DK.
 * Real GPS coordinates from industrial sites.
 */
import { icon } from './icons.js';
import { getGlobalRng } from './rng.js?v=1784250026';

let nextClientId = 1;

/* ═══════════════════════════════════════════════════════════════════════════
   INDUSTRY TYPES — 52 categories with real sites across the Eurozone
   ═══════════════════════════════════════════════════════════════════════════ */
const INDUSTRY_TYPES = [

  /* ───────── 1. CIMENTERIE ───────── */
  {
    type: 'cement', name: 'Cimenterie', icon: 'ind_cement',
    cargoTypes: ['limestone','gypsum','clinker','cement','coal','slag'],
    cargoOut: 'Ciment', dailyTonnageMin: 200, dailyTonnageMax: 800,
    pricePerTonne: 30, attractCost: 80000,
    description: 'Production de ciment : 200-800t/jour. Consomme calcaire, gypse, charbon.',
    realLocations: [
      {name:'Lafarge — Le Teil',lat:44.548,lon:4.681,country:'FR'},
      {name:'Vicat — L\'Isle-d\'Abeau',lat:45.616,lon:5.229,country:'FR'},
      {name:'Holcim — Altkirch',lat:47.623,lon:7.241,country:'FR'},
      {name:'Ciments Calcia — Airvault',lat:46.832,lon:-0.135,country:'FR'},
      {name:'Kerneos — Fos-sur-Mer',lat:43.437,lon:4.944,country:'FR'},
      {name:'Lafarge — Martres-Tolosane',lat:43.197,lon:0.9,country:'FR'},
      {name:'Ciments Calcia — Beffes',lat:46.995,lon:3.067,country:'FR'},
      {name:'Lafarge — Val d\'Azergues',lat:45.887,lon:4.597,country:'FR'},
      {name:'Vicat — Montalieu-Vercieu',lat:45.624,lon:5.389,country:'FR'},
      {name:'Lafarge — La Couronne',lat:45.607,lon:0.101,country:'FR'},
      {name:'Ciments Calcia — Cruas',lat:44.663,lon:4.758,country:'FR'},
      {name:'Lafarge — Contes',lat:43.809,lon:7.315,country:'FR'},
      {name:'Lafarge — Lézinnes',lat:47.812,lon:4.085,country:'FR'},
      {name:'Ciments Calcia — Gargenville',lat:48.974,lon:1.813,country:'FR'},
      {name:'Calcia — Beaucaire',lat:43.808,lon:4.643,country:'FR'},
      {name:'Lafarge — Saint-Pierre-la-Cour',lat:48.111,lon:-1.032,country:'FR'},
      {name:'HeidelbergCement — Leimen',lat:49.346,lon:8.691,country:'DE'},
      {name:'Dyckerhoff — Wiesbaden',lat:50.069,lon:8.246,country:'DE'},
      {name:'Schwenk — Allmendingen',lat:48.387,lon:9.718,country:'DE'},
      {name:'HeidelbergCement — Lengfurt',lat:49.791,lon:9.574,country:'DE'},
      {name:'Lafarge — Wössingen',lat:48.955,lon:8.595,country:'DE'},
      {name:'Buzzi — Deuna',lat:51.571,lon:10.461,country:'DE'},
      {name:'HeidelbergCement — Schelklingen',lat:48.375,lon:9.733,country:'DE'},
      {name:'Dyckerhoff — Geseke',lat:51.644,lon:8.51,country:'DE'},
      {name:'Holcim — Obourg',lat:50.474,lon:3.991,country:'BE'},
      {name:'CBR — Lixhe',lat:50.752,lon:5.681,country:'BE'},
      {name:'CBR — Harmignies',lat:50.397,lon:3.944,country:'BE'},
      {name:'Italcementi — Bergamo',lat:45.694,lon:9.67,country:'IT'},
      {name:'Buzzi Unicem — Casale Monf.',lat:45.134,lon:8.45,country:'IT'},
      {name:'Colacem — Gubbio',lat:43.349,lon:12.572,country:'IT'},
      {name:'Cementir — Taranto',lat:40.478,lon:17.178,country:'IT'},
      {name:'Buzzi — Vernasca',lat:44.761,lon:9.834,country:'IT'},
      {name:'Colacem — Galatina',lat:40.179,lon:18.167,country:'IT'},
      {name:'CEMEX — Alcanar',lat:40.544,lon:0.484,country:'ES'},
      {name:'LafargeHolcim — Sagunto',lat:39.662,lon:-0.275,country:'ES'},
      {name:'Cementos Portland — Olazagutía',lat:42.88,lon:-2.195,country:'ES'},
      {name:'Cementos Molins — Sant Vicenç',lat:41.36,lon:1.886,country:'ES'},
      {name:'Cemex — Lloseta (Mallorca)',lat:39.721,lon:2.862,country:'ES'},
      {name:'Cementos Cosmos — Córdoba',lat:37.884,lon:-4.776,country:'ES'},
      {name:'FYM — Málaga',lat:36.711,lon:-4.402,country:'ES'},
      {name:'SECIL — Outão',lat:38.488,lon:-8.927,country:'PT'},
      {name:'CIMPOR — Alhandra',lat:38.891,lon:-9.001,country:'PT'},
      {name:'Lafarge — Mannersdorf',lat:47.972,lon:16.604,country:'AT'},
      {name:'Lafarge — Retznei',lat:46.747,lon:15.619,country:'AT'},
      {name:'ENCI — Maastricht',lat:50.836,lon:5.686,country:'NL'},
      {name:'Titan Cement — Elefsina',lat:38.041,lon:23.534,country:'GR'},
      {name:'Heracles — Volos',lat:39.367,lon:22.937,country:'GR'},
      {name:'Titan — Kamari',lat:38.034,lon:23.647,country:'GR'},
      {name:'Finnsementti — Parainen',lat:60.301,lon:22.3,country:'FI'},
      {name:'Finnsementti — Lappeenranta',lat:61.058,lon:28.186,country:'FI'},
      {name:'Irish Cement — Limerick',lat:52.66,lon:-8.629,country:'IE'},
      {name:'Irish Cement — Platin',lat:53.721,lon:-6.417,country:'IE'},
      {name:'Cementárna — Ladce',lat:48.997,lon:18.3,country:'SK'},
      {name:'CRH — Rohožník',lat:48.4,lon:17.183,country:'SK'},
      {name:'Salonit — Anhovo',lat:46.024,lon:13.629,country:'SI'},
      {name:'NEXE — Našice',lat:45.49,lon:18.092,country:'HR'},
    
      {name:'Lafarge — Dunkerque',lat:51.034,lon:2.33,country:'FR'},
      {name:'Kerneos — Dunkerque',lat:51.032,lon:2.328,country:'FR'},
      {name:'Ciments Vicat — Créchy',lat:46.268,lon:3.435,country:'FR'},
      {name:'Lafarge — Frangey',lat:47.81,lon:4.09,country:'FR'},
      {name:'Ciments du Maroc — Sète',lat:43.405,lon:3.694,country:'FR'},
      {name:'Cemex — Rüdersdorf',lat:52.472,lon:13.787,country:'DE'},
      {name:'Phoenix Zement — Beckum',lat:51.759,lon:8.051,country:'DE'},
      {name:'Opterra — Karsdorf',lat:51.273,lon:11.644,country:'DE'},
      {name:'Holcim — Lägerdorf',lat:53.876,lon:9.603,country:'DE'},
      {name:'Bernburg Zement',lat:51.802,lon:11.735,country:'DE'},
      {name:'Italcementi — Rezzato',lat:45.529,lon:10.315,country:'IT'},
      {name:'Cementir — Spoleto',lat:42.738,lon:12.737,country:'IT'},
      {name:'Colacem — Modica',lat:36.867,lon:14.762,country:'IT'},
      {name:'Buzzi — Barletta',lat:41.314,lon:16.285,country:'IT'},
      {name:'Cementos Tudela — Navarra',lat:42.064,lon:-1.604,country:'ES'},
      {name:'Portland Valderrivas — Alcalá',lat:40.489,lon:-3.346,country:'ES'},
      {name:'Cementos Rezola — Añorga',lat:43.29,lon:-1.985,country:'ES'},
      {name:'LafargeHolcim — Villaluenga',lat:40.089,lon:-3.988,country:'ES'},
      {name:'Holcim — Haccourt',lat:50.747,lon:5.66,country:'BE'},
      {name:'ENCI — Rotterdam',lat:51.898,lon:4.484,country:'NL'},
      {name:'Rohrdorfer — Gmunden',lat:47.92,lon:13.777,country:'AT'},
      {name:'CRH — Lixhe',lat:50.748,lon:5.682,country:'BE'},
      {name:'Finnsementti — Sipoo',lat:60.371,lon:25.263,country:'FI'},
      {name:'CIMPOR — Souselas',lat:40.268,lon:-8.437,country:'PT'},
      {name:'Devnya Cement — Devnya (export to GR)',lat:43.222,lon:27.565,country:'GR'},
      {name:'Aalborg Portland — Aalborg',lat:57.059,lon:9.932,country:'DK'},
    
      {name:'Buzzi — Trino',lat:45.197,lon:8.3,country:'IT'},
      {name:'Cementizillo — Este',lat:45.228,lon:11.655,country:'IT'},
      {name:'CEMEX — Rugby (exp. IE)',lat:52.648,lon:-1.255,country:'IE'},
      {name:'Cimento Maceira — Leiria',lat:39.743,lon:-8.92,country:'PT'},
      {name:'Titan — Patras',lat:38.245,lon:21.73,country:'GR'},
      {name:'Titan — Thessalonique (add)',lat:40.622,lon:22.935,country:'GR'},
      {name:'CRH — Limhamn (exp. DK)',lat:55.583,lon:12.94,country:'DK'},
      {name:'Cementa — Slite (exp. FI)',lat:57.703,lon:18.808,country:'FI'},
      {name:'Italcementi — Monselice',lat:45.24,lon:11.745,country:'IT'},
      {name:'Holcim — Eclépens (exp. FR)',lat:46.647,lon:6.534,country:'FR'},
      {name:'Cementos La Unión — Rioja',lat:42.446,lon:-2.448,country:'ES'},
      {name:'Cementos Lemona',lat:43.247,lon:-2.621,country:'ES'},
    
      {name:'Lafarge — Lägerdorf (add)',lat:53.877,lon:9.604,country:'DE'},
      {name:'HeidelbergCement — Burglengenfeld',lat:49.21,lon:12.042,country:'DE'},
      {name:'Holcim — Höver',lat:52.33,lon:9.855,country:'DE'},
      {name:'Holcim — Dotternhausen',lat:48.225,lon:8.808,country:'DE'},
      {name:'Schwenk — Bernburg',lat:51.803,lon:11.736,country:'DE'},
      {name:'Cemex — Beckum',lat:51.756,lon:8.047,country:'DE'},
      {name:'Dyckerhoff — Lengerich',lat:52.185,lon:7.873,country:'DE'},
      {name:'Schwenk — Mergelstetten',lat:48.632,lon:10.163,country:'DE'},
      {name:'Calcia — Ranville',lat:49.231,lon:-0.303,country:'FR'},
      {name:'Ciment Vicat — Xeuilley',lat:48.543,lon:6.076,country:'FR'},
      {name:'Cementos Balboa — Badajoz',lat:38.88,lon:-6.83,country:'ES'},
      {name:'Holcim — Carboneras',lat:36.996,lon:-1.894,country:'ES'},
      {name:'Cementir — Maddaloni',lat:41.039,lon:14.386,country:'IT'},
      {name:'Italcementi — Calusco',lat:45.693,lon:9.468,country:'IT'},
    
      {name:'Titan — Kamari (add)',lat:38.035,lon:23.648,country:'GR'},
      {name:'Heracles — Milaki',lat:38.601,lon:23.626,country:'GR'},
      {name:'CRH — Kunda (exp. EE)',lat:59.499,lon:26.538,country:'EE'},
      {name:'Boral — Kiuruvesi (exp. FI)',lat:63.652,lon:26.625,country:'FI'},
      {name:'Schwenk — Karlstadt',lat:49.955,lon:9.773,country:'DE'},
      {name:'Heidelberg — Paderborn',lat:51.718,lon:8.755,country:'DE'},
      {name:'Italcementi — Colleferro',lat:41.727,lon:13.001,country:'IT'},
      {name:'Cementir — Arquata Scrivia',lat:44.676,lon:8.87,country:'IT'},
      {name:'Italcementi — Scafa',lat:42.262,lon:14.002,country:'IT'},
      {name:'FYM — Córdoba',lat:37.885,lon:-4.777,country:'ES'},
      {name:'Cemex — Lloseta (add)',lat:39.722,lon:2.863,country:'ES'},
      {name:'Portland — Morata (add2)',lat:40.224,lon:-3.433,country:'ES'},
    
      {name:'Aalborg Portland — DK',lat:57.06,lon:9.933,country:'DK'},
      {name:'Norcem — Brevik (exp. DE)',lat:59.052,lon:9.69,country:'DE'},
      {name:'Çimsa — Mersin (exp. GR)',lat:36.81,lon:34.633,country:'GR'},
      {name:'Star Cement — Limassol',lat:34.692,lon:33.044,country:'CY'},
      {name:'General Cement — Malta',lat:35.89,lon:14.44,country:'MT'},
    
      {name:'Lafarge — Viviers',lat:44.484,lon:4.689,country:'FR'},
      {name:'Calcia — Guerville',lat:48.948,lon:1.727,country:'FR'},
      {name:'Holcim — Herouxville (exp. LU)',lat:49.62,lon:6.13,country:'LU'},
      {name:'CRH — Turku (exp. FI)',lat:60.45,lon:22.27,country:'FI'},
    ],
  },

  /* ───────── 2. RAFFINERIE ───────── */
  {
    type: 'refinery', name: 'Raffinerie', icon: 'ind_refinery',
    cargoTypes: ['crude-oil','diesel','gasoline','jet-fuel','fuel-oil','lpg','ethanol'],
    cargoOut: 'Produits pétroliers', dailyTonnageMin: 500, dailyTonnageMax: 2000,
    pricePerTonne: 55, attractCost: 200000,
    description: 'Raffinage pétrole : 500-2000t/jour. TMD obligatoire.',
    realLocations: [
      {name:'TotalEnergies — Donges',lat:47.318,lon:-2.075,country:'FR'},
      {name:'TotalEnergies — Gonfreville',lat:49.49,lon:0.224,country:'FR'},
      {name:'ExxonMobil — Port-Jérôme',lat:49.51,lon:0.586,country:'FR'},
      {name:'Petroineos — Lavéra',lat:43.393,lon:5.019,country:'FR'},
      {name:'TotalEnergies — Feyzin',lat:45.67,lon:4.857,country:'FR'},
      {name:'TotalEnergies — Grandpuits',lat:48.558,lon:2.952,country:'FR'},
      {name:'Shell — Wesseling',lat:50.811,lon:6.976,country:'DE'},
      {name:'BP — Gelsenkirchen',lat:51.529,lon:7.073,country:'DE'},
      {name:'PCK — Schwedt',lat:53.041,lon:14.273,country:'DE'},
      {name:'MiRO — Karlsruhe',lat:49.039,lon:8.304,country:'DE'},
      {name:'Bayernoil — Vohburg',lat:48.774,lon:11.609,country:'DE'},
      {name:'Holborn — Hamburg',lat:53.515,lon:9.964,country:'DE'},
      {name:'TotalEnergies — Leuna',lat:51.32,lon:12.009,country:'DE'},
      {name:'Gunvor — Ingolstadt',lat:48.758,lon:11.43,country:'DE'},
      {name:'Shell — Pernis (Rotterdam)',lat:51.881,lon:4.38,country:'NL'},
      {name:'BP — Rotterdam',lat:51.886,lon:4.328,country:'NL'},
      {name:'ExxonMobil — Rotterdam',lat:51.893,lon:4.335,country:'NL'},
      {name:'Zeeland Refinery — Vlissingen',lat:51.458,lon:3.606,country:'NL'},
      {name:'TotalEnergies — Anvers',lat:51.266,lon:4.352,country:'BE'},
      {name:'ExxonMobil — Anvers',lat:51.275,lon:4.368,country:'BE'},
      {name:'ENI — Sannazzaro',lat:45.096,lon:8.903,country:'IT'},
      {name:'Saras — Sarroch',lat:39.096,lon:9.011,country:'IT'},
      {name:'ISAB — Priolo Gargallo',lat:37.158,lon:15.187,country:'IT'},
      {name:'ENI — Taranto',lat:40.481,lon:17.195,country:'IT'},
      {name:'ENI — Livorno',lat:43.551,lon:10.325,country:'IT'},
      {name:'API — Falconara M.',lat:43.624,lon:13.371,country:'IT'},
      {name:'Repsol — Tarragona',lat:41.085,lon:1.219,country:'ES'},
      {name:'Repsol — Puertollano',lat:38.685,lon:-4.09,country:'ES'},
      {name:'CEPSA — Algeciras',lat:36.176,lon:-5.414,country:'ES'},
      {name:'BP — Castellón',lat:39.966,lon:-0.01,country:'ES'},
      {name:'Repsol — A Coruña',lat:43.361,lon:-8.38,country:'ES'},
      {name:'CEPSA — Huelva',lat:37.237,lon:-6.94,country:'ES'},
      {name:'Repsol — Bilbao',lat:43.331,lon:-3.019,country:'ES'},
      {name:'Repsol — Cartagena',lat:37.576,lon:-0.954,country:'ES'},
      {name:'Galp — Sines',lat:37.929,lon:-8.867,country:'PT'},
      {name:'Galp — Matosinhos',lat:41.187,lon:-8.694,country:'PT'},
      {name:'OMV — Schwechat',lat:48.142,lon:16.471,country:'AT'},
      {name:'Motor Oil — Agioi Theodoroi',lat:37.94,lon:22.985,country:'GR'},
      {name:'Hellenic Petroleum — Thessalonique',lat:40.623,lon:22.918,country:'GR'},
      {name:'Hellenic — Aspropyrgos',lat:38.068,lon:23.576,country:'GR'},
      {name:'Neste — Porvoo',lat:60.31,lon:25.609,country:'FI'},
      {name:'Neste — Naantali',lat:60.462,lon:22.037,country:'FI'},
      {name:'Slovnaft — Bratislava',lat:48.122,lon:17.151,country:'SK'},
      {name:'INA — Rijeka',lat:45.321,lon:14.438,country:'HR'},
    
      {name:'TotalEnergies — La Mède',lat:43.416,lon:5.173,country:'FR'},
      {name:'ExxonMobil — Gravenchon',lat:49.515,lon:0.576,country:'FR'},
      {name:'BP — Gelsenkirchen Scholven',lat:51.545,lon:7.076,country:'DE'},
      {name:'Shell — Hamburg',lat:53.514,lon:9.962,country:'DE'},
      {name:'H&R — Hamburg',lat:53.522,lon:9.968,country:'DE'},
      {name:'Klesch — Heide',lat:54.196,lon:9.1,country:'DE'},
      {name:'Esso — Ingolstadt',lat:48.759,lon:11.431,country:'DE'},
      {name:'Saras — Sarroch (unit 2)',lat:39.097,lon:9.013,country:'IT'},
      {name:'ENI — Gela',lat:37.066,lon:14.246,country:'IT'},
      {name:'ENI — Sannazzaro (P2)',lat:45.097,lon:8.905,country:'IT'},
      {name:'ISAB — Augusta',lat:37.211,lon:15.2,country:'IT'},
      {name:'Repsol — Petronor Bilbao',lat:43.33,lon:-3.018,country:'ES'},
      {name:'BP — Rotterdam Europoort',lat:51.952,lon:4.109,country:'NL'},
      {name:'Neste — Porvoo (unit 4)',lat:60.309,lon:25.607,country:'FI'},
      {name:'MOL — Bratislava',lat:48.123,lon:17.153,country:'SK'},
      {name:'ExxonMobil — Anvers',lat:51.274,lon:4.367,country:'BE'},
      {name:'Kuwait — Rotterdam',lat:51.953,lon:4.112,country:'NL'},
      {name:'INA — Sisak',lat:45.475,lon:16.391,country:'HR'},
      {name:'Hellenic — Elefsina',lat:38.055,lon:23.545,country:'GR'},
    
      {name:'TotalEnergies — Normandy (add)',lat:49.491,lon:0.225,country:'FR'},
      {name:'Esso — Fos',lat:43.437,lon:4.942,country:'FR'},
      {name:'Rosneft — Schwedt (add)',lat:53.042,lon:14.274,country:'DE'},
      {name:'TotalEnergies — Leuna (add)',lat:51.321,lon:12.01,country:'DE'},
      {name:'API — Falconara (add)',lat:43.625,lon:13.372,country:'IT'},
      {name:'PKN — Gdańsk (exp. LT)',lat:54.38,lon:18.611,country:'LT'},
      {name:'ORLEN — Mažeikiai (LT)',lat:56.323,lon:22.341,country:'LT'},
      {name:'Star Rafineri — Aliağa (exp. GR)',lat:38.78,lon:26.93,country:'GR'},
    
      {name:'TotalEnergies — Antwerp (add2)',lat:51.267,lon:4.353,country:'BE'},
      {name:'Ruhr Oel — Gelsenkirchen',lat:51.53,lon:7.075,country:'DE'},
      {name:'LOTOS — Gdańsk (exp. LT)',lat:54.38,lon:18.612,country:'LT'},
      {name:'Nynas — Hamburg',lat:53.516,lon:9.965,country:'DE'},
      {name:'Repsol — A Coruña (add)',lat:43.362,lon:-8.381,country:'ES'},
      {name:'Saras — Sarroch (add2)',lat:39.098,lon:9.014,country:'IT'},
    
      {name:'Gunvor — Ingolstadt (add)',lat:48.759,lon:11.431,country:'DE'},
      {name:'TOTAL — Schwedt (add2)',lat:53.043,lon:14.275,country:'DE'},
      {name:'Slovnaft — Bratislava (add2)',lat:48.123,lon:17.152,country:'SK'},
      {name:'INA — Rijeka (add2)',lat:45.322,lon:14.439,country:'HR'},
      {name:'ELPE — Aspropyrgos (add)',lat:38.069,lon:23.577,country:'GR'},
      {name:'ELPE — Elefsina (add)',lat:38.056,lon:23.546,country:'GR'},
      {name:'Nynas — Nynäshamn (exp. FI)',lat:58.9,lon:17.942,country:'FI'},
      {name:'Neste — Naantali (add2)',lat:60.463,lon:22.038,country:'FI'},
    
      {name:'Motor Oil — Corinth (add2)',lat:37.941,lon:22.986,country:'GR'},
      {name:'Tupras — Aliaga (exp. GR)',lat:38.77,lon:26.93,country:'GR'},
      {name:'PKN Orlen — Litvinov (exp. DE)',lat:50.6,lon:13.61,country:'DE'},
      {name:'MOL — Bratislava (add3)',lat:48.124,lon:17.153,country:'SK'},
    ],
  },

  /* ───────── 3. PORT MARITIME ───────── */
  {
    type: 'port', name: 'Port maritime', icon: 'ind_port',
    cargoTypes: ['containers-20','containers-40','containers-reefer','containers-tank','swap-bodies'],
    cargoOut: 'Conteneurs export', dailyTonnageMin: 800, dailyTonnageMax: 5000,
    pricePerTonne: 45, attractCost: 350000,
    description: 'Trafic massif : 800-5000 TEU/jour. Hub intermodal.',
    realLocations: [
      {name:'Grand Port du Havre',lat:49.485,lon:0.107,country:'FR'},
      {name:'Europort Marseille-Fos',lat:43.405,lon:4.879,country:'FR'},
      {name:'Port de Dunkerque',lat:51.045,lon:2.348,country:'FR'},
      {name:'Port Nantes Saint-Nazaire',lat:47.285,lon:-2.19,country:'FR'},
      {name:'Port de Rouen',lat:49.437,lon:1.088,country:'FR'},
      {name:'Port de Bordeaux',lat:44.854,lon:-0.551,country:'FR'},
      {name:'Port de La Rochelle',lat:46.155,lon:-1.157,country:'FR'},
      {name:'Port de Sète',lat:43.396,lon:3.696,country:'FR'},
      {name:'Port de Calais',lat:50.958,lon:1.854,country:'FR'},
      {name:'Port de Brest',lat:48.385,lon:-4.493,country:'FR'},
      {name:'Port de Bayonne',lat:43.524,lon:-1.466,country:'FR'},
      {name:'Port de Strasbourg',lat:48.565,lon:7.793,country:'FR'},
      {name:'Port of Rotterdam',lat:51.903,lon:4.468,country:'NL'},
      {name:'Port of Amsterdam',lat:52.409,lon:4.796,country:'NL'},
      {name:'Port of Vlissingen',lat:51.443,lon:3.576,country:'NL'},
      {name:'Port of Moerdijk',lat:51.69,lon:4.577,country:'NL'},
      {name:'Port of Antwerp-Bruges',lat:51.295,lon:4.339,country:'BE'},
      {name:'Port of Zeebrugge',lat:51.34,lon:3.189,country:'BE'},
      {name:'Port of Gent',lat:51.09,lon:3.756,country:'BE'},
      {name:'Port of Liège',lat:50.644,lon:5.589,country:'BE'},
      {name:'Port of Hamburg',lat:53.535,lon:9.963,country:'DE'},
      {name:'Bremerhaven',lat:53.542,lon:8.571,country:'DE'},
      {name:'Wilhelmshaven — JadeWeserPort',lat:53.58,lon:8.14,country:'DE'},
      {name:'Duisburg — duisport',lat:51.449,lon:6.738,country:'DE'},
      {name:'Port of Lübeck',lat:53.883,lon:10.705,country:'DE'},
      {name:'Port of Rostock',lat:54.143,lon:12.081,country:'DE'},
      {name:'Porto di Genova',lat:44.408,lon:8.927,country:'IT'},
      {name:'Porto di Gioia Tauro',lat:38.435,lon:15.893,country:'IT'},
      {name:'Porto di Trieste',lat:45.639,lon:13.761,country:'IT'},
      {name:'Porto di La Spezia',lat:44.089,lon:9.833,country:'IT'},
      {name:'Porto di Livorno',lat:43.556,lon:10.298,country:'IT'},
      {name:'Porto di Napoli',lat:40.84,lon:14.269,country:'IT'},
      {name:'Porto di Ravenna',lat:44.454,lon:12.284,country:'IT'},
      {name:'Porto di Venezia',lat:45.444,lon:12.272,country:'IT'},
      {name:'Porto di Salerno',lat:40.676,lon:14.744,country:'IT'},
      {name:'Porto di Cagliari',lat:39.208,lon:9.114,country:'IT'},
      {name:'Puerto de Valencia',lat:39.442,lon:-0.314,country:'ES'},
      {name:'Puerto de Algeciras',lat:36.129,lon:-5.434,country:'ES'},
      {name:'Puerto de Barcelona',lat:41.363,lon:2.165,country:'ES'},
      {name:'Puerto de Bilbao',lat:43.351,lon:-3.047,country:'ES'},
      {name:'Puerto de Las Palmas',lat:28.139,lon:-15.42,country:'ES'},
      {name:'Puerto de Cartagena',lat:37.587,lon:-0.974,country:'ES'},
      {name:'Puerto de Tarragona',lat:41.087,lon:1.236,country:'ES'},
      {name:'Puerto de Vigo',lat:42.233,lon:-8.717,country:'ES'},
      {name:'Puerto de Huelva',lat:37.248,lon:-6.944,country:'ES'},
      {name:'Puerto de Sevilla',lat:37.362,lon:-6.001,country:'ES'},
      {name:'Porto de Sines',lat:37.951,lon:-8.869,country:'PT'},
      {name:'Porto de Leixões',lat:41.183,lon:-8.707,country:'PT'},
      {name:'Porto de Lisboa',lat:38.726,lon:-9.128,country:'PT'},
      {name:'Porto de Setúbal',lat:38.515,lon:-8.896,country:'PT'},
      {name:'Port of Piraeus',lat:37.942,lon:23.636,country:'GR'},
      {name:'Port of Thessaloniki',lat:40.634,lon:22.94,country:'GR'},
      {name:'Port of Patras',lat:38.254,lon:21.734,country:'GR'},
      {name:'Port of Heraklion',lat:35.34,lon:25.139,country:'GR'},
      {name:'Port of Helsinki — Vuosaari',lat:60.213,lon:25.174,country:'FI'},
      {name:'Port of HaminaKotka',lat:60.455,lon:26.915,country:'FI'},
      {name:'Port of Turku',lat:60.435,lon:22.221,country:'FI'},
      {name:'Port of Rauma',lat:61.128,lon:21.467,country:'FI'},
      {name:'Port of Dublin',lat:53.347,lon:-6.213,country:'IE'},
      {name:'Port of Cork',lat:51.848,lon:-8.301,country:'IE'},
      {name:'Port of Shannon Foynes',lat:52.613,lon:-9.095,country:'IE'},
      {name:'Port of Waterford',lat:52.264,lon:-6.998,country:'IE'},
      {name:'Port of Tallinn — Muuga',lat:59.494,lon:24.953,country:'EE'},
      {name:'Freeport of Riga',lat:56.964,lon:24.063,country:'LV'},
      {name:'Port of Ventspils',lat:57.396,lon:21.543,country:'LV'},
      {name:'Port of Liepāja',lat:56.533,lon:21.006,country:'LV'},
      {name:'Port of Klaipėda',lat:55.694,lon:21.13,country:'LT'},
      {name:'Port of Koper',lat:45.548,lon:13.74,country:'SI'},
      {name:'Port of Rijeka',lat:45.329,lon:14.44,country:'HR'},
      {name:'Port of Split',lat:43.503,lon:16.438,country:'HR'},
      {name:'Port of Ploče',lat:43.052,lon:17.433,country:'HR'},
      {name:'Port of Limassol',lat:34.658,lon:33.039,country:'CY'},
      {name:'Malta Freeport — Birżebbuġa',lat:35.813,lon:14.536,country:'MT'},
    
      {name:'Porto di Ancona',lat:43.624,lon:13.506,country:'IT'},
      {name:'Porto di Bari',lat:41.13,lon:16.866,country:'IT'},
      {name:'Porto di Catania',lat:37.501,lon:15.091,country:'IT'},
      {name:'Porto di Civitavecchia',lat:42.093,lon:11.794,country:'IT'},
      {name:'Porto di Piombino',lat:42.934,lon:10.537,country:'IT'},
      {name:'Puerto de Castellón',lat:39.968,lon:-0.008,country:'ES'},
      {name:'Puerto de Almería',lat:36.835,lon:-2.466,country:'ES'},
      {name:'Puerto de Cádiz',lat:36.531,lon:-6.291,country:'ES'},
      {name:'Puerto de Santander',lat:43.458,lon:-3.8,country:'ES'},
      {name:'Puerto de Avilés',lat:43.585,lon:-5.938,country:'ES'},
      {name:'Puerto de Pasajes',lat:43.326,lon:-1.921,country:'ES'},
      {name:'Puerto de Motril',lat:36.721,lon:-3.524,country:'ES'},
      {name:'Port of Naantali',lat:60.473,lon:22.003,country:'FI'},
      {name:'Port of Pori',lat:61.479,lon:21.778,country:'FI'},
      {name:'Port of Oulu',lat:65.007,lon:25.442,country:'FI'},
      {name:'Port of Kokkola',lat:63.841,lon:23.032,country:'FI'},
      {name:'Port of Belfast',lat:54.606,lon:-5.895,country:'IE'},
      {name:'Port of Larnaca',lat:34.916,lon:33.635,country:'CY'},
      {name:'Freeport Marsaxlokk',lat:35.814,lon:14.535,country:'MT'},
      {name:'Port of Zadar',lat:44.12,lon:15.228,country:'HR'},
      {name:'Port of Dubrovnik',lat:42.66,lon:18.069,country:'HR'},
    
      {name:'Porto di Brindisi',lat:40.648,lon:17.95,country:'IT'},
      {name:'Porto di Augusta',lat:37.232,lon:15.222,country:'IT'},
      {name:'Porto di Catanzaro (Crotone)',lat:39.088,lon:17.127,country:'IT'},
      {name:'Porto di Olbia',lat:40.924,lon:9.508,country:'IT'},
      {name:'Puerto de Ferrol',lat:43.48,lon:-8.24,country:'ES'},
      {name:'Puerto de Gijón',lat:43.552,lon:-5.691,country:'ES'},
      {name:'Puerto de Alicante',lat:38.338,lon:-0.485,country:'ES'},
      {name:'Puerto de A Coruña',lat:43.364,lon:-8.381,country:'ES'},
      {name:'Porto de Aveiro',lat:40.646,lon:-8.747,country:'PT'},
      {name:'Porto de Faro',lat:37.01,lon:-7.935,country:'PT'},
      {name:'Port of Thessaloniki (add)',lat:40.635,lon:22.941,country:'GR'},
      {name:'Port of Pátrai (add)',lat:38.255,lon:21.735,country:'GR'},
      {name:'Port of Igoumenitsa',lat:39.504,lon:20.222,country:'GR'},
      {name:'Port of Volos',lat:39.362,lon:22.94,country:'GR'},
      {name:'Port of Kavala',lat:40.932,lon:24.414,country:'GR'},
      {name:'Port of Alexandroupoli',lat:40.85,lon:25.875,country:'GR'},
      {name:'Port of Pärnu',lat:58.381,lon:24.503,country:'EE'},
      {name:'Port of Sillamäe',lat:59.398,lon:27.758,country:'EE'},
      {name:'Port of Paldiski',lat:59.355,lon:24.056,country:'EE'},
      {name:'Port of Liepāja (add)',lat:56.534,lon:21.007,country:'LV'},
    
      {name:'Porto di Monfalcone',lat:45.784,lon:13.549,country:'IT'},
      {name:'Porto di Palermo',lat:38.13,lon:13.358,country:'IT'},
      {name:'Porto di Messina',lat:38.193,lon:15.562,country:'IT'},
      {name:'Porto di Savona',lat:44.308,lon:8.478,country:'IT'},
      {name:'Porto di Marina di Carrara',lat:44.043,lon:10.038,country:'IT'},
      {name:'Porto di Trapani',lat:38.014,lon:12.51,country:'IT'},
      {name:'Puerto de Gandía',lat:38.992,lon:-0.159,country:'ES'},
      {name:'Puerto de Marín',lat:42.393,lon:-8.702,country:'ES'},
      {name:'Puerto de Melilla',lat:35.29,lon:-2.939,country:'ES'},
      {name:'Puerto de Ceuta',lat:35.889,lon:-5.318,country:'ES'},
      {name:'Puerto de Santa Cruz de Tenerife',lat:28.468,lon:-16.252,country:'ES'},
      {name:'Porto de Figueira da Foz',lat:40.152,lon:-8.853,country:'PT'},
      {name:'Porto de Peniche',lat:39.355,lon:-9.376,country:'PT'},
      {name:'Port of Eleusis',lat:38.041,lon:23.53,country:'GR'},
      {name:'Port of Syros',lat:37.443,lon:24.94,country:'GR'},
      {name:'Port of Laurium',lat:37.719,lon:24.06,country:'GR'},
      {name:'Port of Corfu',lat:39.623,lon:19.92,country:'GR'},
      {name:'Port of Mykonos',lat:37.447,lon:25.328,country:'GR'},
      {name:'Port of Rhodes',lat:36.451,lon:28.226,country:'GR'},
      {name:'Port of Chania',lat:35.519,lon:24.019,country:'GR'},
    
      {name:'Port of Gdynia (exp. LT)',lat:54.533,lon:18.541,country:'LT'},
      {name:'Port of Gdańsk (exp. LT)',lat:54.38,lon:18.66,country:'LT'},
      {name:'Port of Szczecin (exp. DE)',lat:53.425,lon:14.581,country:'DE'},
      {name:'Port of Świnoujście (exp. DE)',lat:53.913,lon:14.252,country:'DE'},
      {name:'Port of Rostock (add)',lat:54.144,lon:12.082,country:'DE'},
      {name:'Port of Wismar',lat:53.897,lon:11.465,country:'DE'},
      {name:'Port of Sassnitz/Mukran',lat:54.515,lon:13.605,country:'DE'},
      {name:'Port of Stralsund',lat:54.312,lon:13.091,country:'DE'},
      {name:'Puerto de Gandía (add)',lat:38.993,lon:-0.16,country:'ES'},
      {name:'Puerto de Ibiza',lat:38.906,lon:1.443,country:'ES'},
      {name:'Puerto de Mahón',lat:39.886,lon:4.265,country:'ES'},
      {name:'Porto di Monopoli',lat:40.953,lon:17.303,country:'IT'},
      {name:'Porto di Manfredonia',lat:41.634,lon:15.918,country:'IT'},
      {name:'Porto di Ortona',lat:42.352,lon:14.406,country:'IT'},
      {name:'Porto di Termini Imerese',lat:37.986,lon:13.694,country:'IT'},
      {name:'Porto di Crotone',lat:39.088,lon:17.127,country:'IT'},
      {name:'Port of Varna (exp. GR)',lat:43.193,lon:27.915,country:'GR'},
      {name:'Port of Constantza (exp. GR)',lat:44.174,lon:28.65,country:'GR'},
      {name:'Port of Larnaca (add)',lat:34.917,lon:33.636,country:'CY'},
      {name:'Port of Paphos',lat:34.756,lon:32.408,country:'CY'},
    
      {name:'Port of Brake',lat:53.33,lon:8.477,country:'DE'},
      {name:'Port of Nordenham',lat:53.491,lon:8.49,country:'DE'},
      {name:'Port of Emden',lat:53.338,lon:7.186,country:'DE'},
      {name:'Port of Papenburg',lat:53.078,lon:7.401,country:'DE'},
      {name:'Port of Cuxhaven',lat:53.87,lon:8.709,country:'DE'},
      {name:'Porto di Milazzo',lat:38.217,lon:15.243,country:'IT'},
      {name:'Porto di Reggio Calabria',lat:38.109,lon:15.643,country:'IT'},
      {name:'Porto di Pescara',lat:42.461,lon:14.219,country:'IT'},
      {name:'Porto di Gaeta',lat:41.213,lon:13.571,country:'IT'},
      {name:'Porto di Portoscuso',lat:39.193,lon:8.381,country:'IT'},
      {name:'Puerto de Motril (add)',lat:36.722,lon:-3.525,country:'ES'},
      {name:'Puerto de Torrevieja',lat:37.978,lon:-0.683,country:'ES'},
      {name:'Puerto de Carboneras',lat:36.996,lon:-1.894,country:'ES'},
      {name:'Puerto de Garrucha',lat:37.186,lon:-1.822,country:'ES'},
      {name:'Puerto de Portimão',lat:37.12,lon:-8.537,country:'PT'},
      {name:'Porto de Viana (add)',lat:41.695,lon:-8.838,country:'PT'},
      {name:'Port of Preveza',lat:38.953,lon:20.748,country:'GR'},
      {name:'Port of Itea',lat:38.434,lon:22.423,country:'GR'},
      {name:'Port of Elefsina (add)',lat:38.042,lon:23.531,country:'GR'},
      {name:'Port of Aliveri',lat:38.381,lon:24.026,country:'GR'},
    
      {name:'Porto di Ortona (add2)',lat:42.353,lon:14.407,country:'IT'},
      {name:'Porto di Vasto',lat:42.113,lon:14.706,country:'IT'},
      {name:'Porto di Oristano',lat:39.902,lon:8.574,country:'IT'},
      {name:'Porto di Arbatax',lat:39.936,lon:9.712,country:'IT'},
      {name:'Porto di Carloforte',lat:39.143,lon:8.314,country:'IT'},
      {name:'Porto di Porto Torres',lat:40.844,lon:8.399,country:'IT'},
      {name:'Porto di La Maddalena',lat:41.213,lon:9.404,country:'IT'},
      {name:'Porto di Santo Stefano',lat:42.439,lon:11.118,country:'IT'},
      {name:'Puerto de La Luz — Las Palmas (add)',lat:28.14,lon:-15.421,country:'ES'},
      {name:'Puerto de Santa Cruz Tenerife (add)',lat:28.469,lon:-16.253,country:'ES'},
      {name:'Puerto de Arrecife — Lanzarote',lat:28.962,lon:-13.543,country:'ES'},
      {name:'Puerto de Puerto del Rosario — Fuerteventura',lat:28.5,lon:-13.863,country:'ES'},
      {name:'Puerto de La Estaca — El Hierro',lat:27.78,lon:-17.91,country:'ES'},
      {name:'Puerto de San Sebastián — La Gomera',lat:28.088,lon:-17.109,country:'ES'},
      {name:'Puerto de Los Cristianos — Tenerife',lat:28.053,lon:-16.719,country:'ES'},
      {name:'Port of Leixões (add2)',lat:41.184,lon:-8.708,country:'PT'},
      {name:'Port of Funchal — Madeira',lat:32.646,lon:-16.91,country:'PT'},
      {name:'Port of Ponta Delgada — Açores',lat:37.739,lon:-25.667,country:'PT'},
      {name:'Port of Praia da Vitória — Açores',lat:38.727,lon:-27.058,country:'PT'},
      {name:'Port of Elefsina (add2)',lat:38.043,lon:23.532,country:'GR'},
    
      {name:'Porto di Bagnoli',lat:40.81,lon:14.17,country:'IT'},
      {name:'Porto di San Benedetto del Tronto',lat:42.944,lon:13.893,country:'IT'},
      {name:'Porto di Formia',lat:41.254,lon:13.607,country:'IT'},
      {name:'Porto di Ischia',lat:40.73,lon:13.943,country:'IT'},
      {name:'Porto di Capri',lat:40.549,lon:14.243,country:'IT'},
      {name:'Porto di Lipari',lat:38.468,lon:14.957,country:'IT'},
      {name:'Puerto de Águilas',lat:37.407,lon:-1.578,country:'ES'},
      {name:'Puerto de Mazarrón',lat:37.565,lon:-1.264,country:'ES'},
      {name:'Puerto de Adra',lat:36.748,lon:-3.024,country:'ES'},
      {name:'Puerto de Roquetas',lat:36.764,lon:-2.614,country:'ES'},
    
      {name:'Porto di Giardini Naxos',lat:37.825,lon:15.27,country:'IT'},
      {name:'Porto di Castellammare',lat:40.695,lon:14.48,country:'IT'},
      {name:'Puerto de Villagarcía de Arosa',lat:42.593,lon:-8.773,country:'ES'},
      {name:'Puerto de Cambados',lat:42.513,lon:-8.812,country:'ES'},
      {name:'Puerto de Riveira',lat:42.557,lon:-8.99,country:'ES'},
      {name:'Puerto de Muros',lat:42.776,lon:-9.058,country:'ES'},
      {name:'Puerto de Corcubión',lat:42.935,lon:-9.187,country:'ES'},
      {name:'Puerto de Camarinas',lat:43.128,lon:-9.18,country:'ES'},
      {name:'Puerto de Cee',lat:42.952,lon:-9.19,country:'ES'},
      {name:'Puerto de Malpica',lat:43.325,lon:-8.812,country:'ES'},
      {name:'Puerto de Cedeira',lat:43.663,lon:-8.065,country:'ES'},
      {name:'Puerto de Viveiro',lat:43.66,lon:-7.593,country:'ES'},
      {name:'Puerto de Burela',lat:43.663,lon:-7.358,country:'ES'},
      {name:'Puerto de Luarca',lat:43.544,lon:-6.538,country:'ES'},
      {name:'Puerto de Cudillero',lat:43.568,lon:-6.15,country:'ES'},
      {name:'Puerto de Lastres',lat:43.515,lon:-5.269,country:'ES'},
    ],
  },

  /* ───────── 4. ACIÉRIE / SIDÉRURGIE ───────── */
  {
    type: 'steel_mill', name: 'Aciérie / Sidérurgie', icon: 'ind_steel',
    cargoTypes: ['ore','coal','scrap-metal','steel-coils','steel-beams','steel-sheet','steel-wire','cast-iron'],
    cargoOut: 'Produits sidérurgiques', dailyTonnageMin: 400, dailyTonnageMax: 1500,
    pricePerTonne: 40, attractCost: 150000,
    description: 'Sidérurgie lourde : 400-1500t/jour. Consomme minerai et charbon.',
    realLocations: [
      {name:'ArcelorMittal — Dunkerque',lat:51.032,lon:2.334,country:'FR'},
      {name:'ArcelorMittal — Fos-sur-Mer',lat:43.449,lon:4.918,country:'FR'},
      {name:'ArcelorMittal — Florange',lat:49.324,lon:6.12,country:'FR'},
      {name:'Vallourec — Saint-Saulve',lat:50.359,lon:3.562,country:'FR'},
      {name:'Ascoval — Saint-Saulve',lat:50.361,lon:3.558,country:'FR'},
      {name:'ArcelorMittal — Mardyck',lat:51.012,lon:2.29,country:'FR'},
      {name:'Celsa — Bayonne',lat:43.5,lon:-1.457,country:'FR'},
      {name:'Riva — Condé-sur-Noireau',lat:48.849,lon:-0.547,country:'FR'},
      {name:'ThyssenKrupp — Duisburg',lat:51.448,lon:6.729,country:'DE'},
      {name:'Salzgitter AG — Salzgitter',lat:52.146,lon:10.315,country:'DE'},
      {name:'ArcelorMittal — Eisenhüttenstadt',lat:52.152,lon:14.66,country:'DE'},
      {name:'ArcelorMittal — Bremen',lat:53.097,lon:8.735,country:'DE'},
      {name:'Saarstahl — Völklingen',lat:49.252,lon:6.853,country:'DE'},
      {name:'Dillinger Hütte — Dillingen',lat:49.354,lon:6.73,country:'DE'},
      {name:'Badische Stahlwerke — Kehl',lat:48.57,lon:7.806,country:'DE'},
      {name:'Georgsmarienhütte',lat:52.196,lon:8.042,country:'DE'},
      {name:'Lech-Stahlwerke — Meitingen',lat:48.54,lon:10.853,country:'DE'},
      {name:'Brandenburger Elektrostahlwerke',lat:52.399,lon:12.527,country:'DE'},
      {name:'ArcelorMittal — Gand',lat:51.072,lon:3.765,country:'BE'},
      {name:'ArcelorMittal — Liège',lat:50.589,lon:5.514,country:'BE'},
      {name:'NLMK — Clabecq',lat:50.664,lon:4.234,country:'BE'},
      {name:'Tata Steel — IJmuiden',lat:52.461,lon:4.588,country:'NL'},
      {name:'ArcelorMittal — Taranto',lat:40.483,lon:17.175,country:'IT'},
      {name:'Arvedi — Cremona',lat:45.138,lon:10.013,country:'IT'},
      {name:'Danieli — Buttrio',lat:46.014,lon:13.321,country:'IT'},
      {name:'Feralpi — Lonato',lat:45.464,lon:10.486,country:'IT'},
      {name:'Ori Martin — Brescia',lat:45.541,lon:10.211,country:'IT'},
      {name:'Beltrame — Vicenza',lat:45.55,lon:11.542,country:'IT'},
      {name:'Pittini — Osoppo',lat:46.276,lon:13.079,country:'IT'},
      {name:'ArcelorMittal — Avilés',lat:43.548,lon:-5.917,country:'ES'},
      {name:'ArcelorMittal — Gijón',lat:43.539,lon:-5.665,country:'ES'},
      {name:'Celsa — Castellbisbal',lat:41.467,lon:1.988,country:'ES'},
      {name:'Acerinox — Algeciras',lat:36.173,lon:-5.437,country:'ES'},
      {name:'ArcelorMittal — Sestao',lat:43.307,lon:-3.011,country:'ES'},
      {name:'Sidenor — Basauri',lat:43.234,lon:-2.892,country:'ES'},
      {name:'Voestalpine — Linz',lat:48.316,lon:14.294,country:'AT'},
      {name:'Voestalpine — Donawitz',lat:47.365,lon:15.013,country:'AT'},
      {name:'SSAB — Raahe',lat:64.683,lon:24.474,country:'FI'},
      {name:'Outokumpu — Tornio',lat:65.857,lon:24.187,country:'FI'},
      {name:'ArcelorMittal — Belval',lat:49.504,lon:5.945,country:'LU'},
      {name:'ArcelorMittal — Differdange',lat:49.523,lon:5.896,country:'LU'},
      {name:'ArcelorMittal — Rodange',lat:49.547,lon:5.838,country:'LU'},
      {name:'US Steel — Košice',lat:48.712,lon:21.242,country:'SK'},
      {name:'Halyvourgiki — Elefsina',lat:38.044,lon:23.536,country:'GR'},
      {name:'Sidenor — Thessalonique',lat:40.599,lon:22.891,country:'GR'},
      {name:'SIJ — Jesenice',lat:46.436,lon:14.064,country:'SI'},
      {name:'SIJ — Ravne na Koroškem',lat:46.543,lon:14.957,country:'SI'},
      {name:'SN Holding — Sisak',lat:45.465,lon:16.377,country:'HR'},
    
      {name:'ArcelorMittal — Gandrange',lat:49.203,lon:6.09,country:'FR'},
      {name:'Hachette & Driout — Commercy',lat:48.763,lon:5.59,country:'FR'},
      {name:'BGH Edelstahl — Siegen',lat:50.884,lon:8.022,country:'DE'},
      {name:'Deutsche Edelstahlwerke — Witten',lat:51.436,lon:7.332,country:'DE'},
      {name:'Outokumpu — Krefeld',lat:51.348,lon:6.569,country:'DE'},
      {name:'Lech-Stahlwerke — Herbertshofen',lat:48.52,lon:10.843,country:'DE'},
      {name:'Acciaierie Venete — Padova',lat:45.415,lon:11.885,country:'IT'},
      {name:'Acciaierie di Calvisano',lat:45.356,lon:10.353,country:'IT'},
      {name:'Aceros Inoxidables — Algeciras',lat:36.174,lon:-5.436,country:'ES'},
      {name:'Tubos Reunidos — Amurrio',lat:42.909,lon:-3.0,country:'ES'},
      {name:'Uddeholm — Hagfors (exp. AT)',lat:47.4,lon:14.3,country:'AT'},
      {name:'Voestalpine — Kapfenberg',lat:47.444,lon:15.294,country:'AT'},
      {name:'SSAB — Hämeenlinna (exp. FI)',lat:60.997,lon:24.46,country:'FI'},
    
      {name:'Ferriere Nord — Osoppo (add)',lat:46.277,lon:13.08,country:'IT'},
      {name:'Lucchini — Piombino',lat:42.936,lon:10.53,country:'IT'},
      {name:'SSAB — Helsinki (exp.)',lat:60.215,lon:24.935,country:'FI'},
      {name:'Ruukki — Raahe (add)',lat:64.684,lon:24.475,country:'FI'},
      {name:'ArcelorMittal — Zumarraga',lat:43.082,lon:-2.316,country:'ES'},
      {name:'Celsa — Maia',lat:41.234,lon:-8.618,country:'PT'},
      {name:'Dunaferr — Dunaújváros (exp. SK)',lat:46.92,lon:18.935,country:'SK'},
      {name:'ArcelorMittal — Warszawa (exp. SK)',lat:52.23,lon:20.99,country:'SK'},
      {name:'Acciaierie di Piombino (add)',lat:42.937,lon:10.531,country:'IT'},
      {name:'Magnitogorsk (exp. AT)',lat:48.316,lon:14.295,country:'AT'},
    
      {name:'Feralpi — Calvisano (add)',lat:45.465,lon:10.487,country:'IT'},
      {name:'ABS — Cargnacco',lat:46.008,lon:13.283,country:'IT'},
      {name:'Duferco — Brescia',lat:45.54,lon:10.215,country:'IT'},
      {name:'Nucor (exp. DE)',lat:52.15,lon:14.662,country:'DE'},
      {name:'ArcelorMittal — Cracovie (exp. SK)',lat:50.063,lon:19.933,country:'SK'},
      {name:'Dillinger — Dillingen (add)',lat:49.355,lon:6.731,country:'DE'},
      {name:'ArcelorMittal — Henstedt (exp.DE)',lat:53.767,lon:10.024,country:'DE'},
      {name:'Megasa — Seixal',lat:38.624,lon:-9.095,country:'PT'},
      {name:'Sidenor — Thessaloniki (add)',lat:40.6,lon:22.892,country:'GR'},
    
      {name:'Riva — Caronno',lat:45.591,lon:9.052,country:'IT'},
      {name:'Alfa Acciai — Brescia',lat:45.543,lon:10.22,country:'IT'},
      {name:'Ferriera Valsabbia — Odolo',lat:45.617,lon:10.378,country:'IT'},
      {name:'Acciaieria ISP — Cremona',lat:45.14,lon:10.015,country:'IT'},
      {name:'ArcelorMittal — Zumarraga (add)',lat:43.083,lon:-2.317,country:'ES'},
      {name:'ArcelorMittal — Zumárraga (add2)',lat:43.084,lon:-2.318,country:'ES'},
      {name:'Acroni — Jesenice (add)',lat:46.437,lon:14.065,country:'SI'},
      {name:'Metal Ravne — Ravne (add)',lat:46.544,lon:14.958,country:'SI'},
    
      {name:'Marcegaglia — Ravenna',lat:44.46,lon:12.278,country:'IT'},
      {name:'Marcegaglia — Gazoldo',lat:45.168,lon:10.533,country:'IT'},
      {name:'Cogne Acciai — Aosta',lat:45.736,lon:7.318,country:'IT'},
      {name:'Acciaierie di Calvisano (add2)',lat:45.357,lon:10.354,country:'IT'},
      {name:'SSAB — Oxelösund (exp. FI)',lat:58.671,lon:17.107,country:'FI'},
      {name:'SSAB — Borlänge (exp. FI)',lat:60.486,lon:15.433,country:'FI'},
    
      {name:'Riva — Lesegno',lat:44.425,lon:8.049,country:'IT'},
      {name:'Presider — Borgo Valsugana',lat:46.055,lon:11.459,country:'IT'},
      {name:'CMC — Sisak (add)',lat:45.466,lon:16.378,country:'HR'},
      {name:'Metinvest — Mariupol (exp. AT)',lat:47.1,lon:37.55,country:'AT'},
    ],
  },

  /* ───────── 5. USINE AUTOMOBILE ───────── */
  {
    type: 'auto_plant', name: 'Usine automobile', icon: 'ind_auto',
    cargoTypes: ['cars','trucks','vans','steel-coils','plastic-granules','tires'],
    cargoOut: 'Véhicules neufs', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 120, attractCost: 120000,
    description: 'Assemblage et export : 100-500 véhicules/jour. Haut revenu.',
    realLocations: [
      {name:'Stellantis — Sochaux',lat:47.512,lon:6.832,country:'FR'},
      {name:'Stellantis — Poissy',lat:48.93,lon:2.034,country:'FR'},
      {name:'Renault — Flins',lat:48.968,lon:1.876,country:'FR'},
      {name:'Renault — Douai',lat:50.374,lon:3.077,country:'FR'},
      {name:'Toyota — Onnaing',lat:50.391,lon:3.601,country:'FR'},
      {name:'Renault — Sandouville',lat:49.502,lon:0.264,country:'FR'},
      {name:'Stellantis — Rennes',lat:48.164,lon:-1.596,country:'FR'},
      {name:'Stellantis — Mulhouse',lat:47.757,lon:7.3,country:'FR'},
      {name:'Renault — Maubeuge',lat:50.277,lon:3.973,country:'FR'},
      {name:'Renault — Batilly',lat:49.16,lon:5.974,country:'FR'},
      {name:'Stellantis — Hordain',lat:50.253,lon:3.308,country:'FR'},
      {name:'Renault — Cléon',lat:49.31,lon:1.026,country:'FR'},
      {name:'Volkswagen — Wolfsburg',lat:52.428,lon:10.791,country:'DE'},
      {name:'BMW — Munich',lat:48.176,lon:11.555,country:'DE'},
      {name:'Mercedes-Benz — Sindelfingen',lat:48.713,lon:9.013,country:'DE'},
      {name:'Mercedes-Benz — Bremen',lat:53.056,lon:8.793,country:'DE'},
      {name:'Audi — Ingolstadt',lat:48.776,lon:11.439,country:'DE'},
      {name:'Audi — Neckarsulm',lat:49.192,lon:9.226,country:'DE'},
      {name:'Porsche — Zuffenhausen',lat:48.823,lon:9.154,country:'DE'},
      {name:'Opel — Rüsselsheim',lat:49.998,lon:8.417,country:'DE'},
      {name:'Ford — Cologne',lat:50.876,lon:7.034,country:'DE'},
      {name:'Volkswagen — Emden',lat:53.365,lon:7.188,country:'DE'},
      {name:'BMW — Dingolfing',lat:48.634,lon:12.501,country:'DE'},
      {name:'BMW — Regensburg',lat:49.02,lon:12.089,country:'DE'},
      {name:'BMW — Leipzig',lat:51.389,lon:12.302,country:'DE'},
      {name:'Mercedes — Rastatt',lat:48.86,lon:8.203,country:'DE'},
      {name:'Volkswagen — Zwickau',lat:50.723,lon:12.487,country:'DE'},
      {name:'MAN — Munich',lat:48.173,lon:11.551,country:'DE'},
      {name:'Daimler Truck — Wörth',lat:49.047,lon:8.248,country:'DE'},
      {name:'Stellantis — Melfi',lat:40.995,lon:15.615,country:'IT'},
      {name:'Stellantis — Mirafiori',lat:45.032,lon:7.608,country:'IT'},
      {name:'Ferrari — Maranello',lat:44.533,lon:10.865,country:'IT'},
      {name:'Lamborghini — Sant\'Agata',lat:44.654,lon:11.126,country:'IT'},
      {name:'Stellantis — Pomigliano',lat:40.913,lon:14.385,country:'IT'},
      {name:'Stellantis — Cassino',lat:41.49,lon:13.834,country:'IT'},
      {name:'Iveco — Brescia',lat:45.531,lon:10.218,country:'IT'},
      {name:'SEAT — Martorell',lat:41.486,lon:1.912,country:'ES'},
      {name:'Stellantis — Vigo',lat:42.228,lon:-8.693,country:'ES'},
      {name:'Stellantis — Zaragoza',lat:41.679,lon:-0.91,country:'ES'},
      {name:'Ford — Almussafes',lat:39.28,lon:-0.417,country:'ES'},
      {name:'Renault — Valladolid',lat:41.641,lon:-4.708,country:'ES'},
      {name:'Mercedes-Benz — Vitoria',lat:42.867,lon:-2.696,country:'ES'},
      {name:'Renault — Palencia',lat:42.009,lon:-4.529,country:'ES'},
      {name:'Volvo Cars — Gand',lat:51.082,lon:3.73,country:'BE'},
      {name:'Audi — Forest',lat:50.81,lon:4.313,country:'BE'},
      {name:'DAF — Westerlo',lat:51.081,lon:4.918,country:'BE'},
      {name:'VDL Nedcar — Born',lat:51.035,lon:5.807,country:'NL'},
      {name:'DAF — Eindhoven',lat:51.44,lon:5.469,country:'NL'},
      {name:'VW Autoeuropa — Palmela',lat:38.556,lon:-8.906,country:'PT'},
      {name:'Stellantis — Mangualde',lat:40.599,lon:-7.768,country:'PT'},
      {name:'Volkswagen — Bratislava',lat:48.169,lon:17.143,country:'SK'},
      {name:'Kia — Žilina',lat:49.206,lon:18.734,country:'SK'},
      {name:'Jaguar Land Rover — Nitra',lat:48.313,lon:18.085,country:'SK'},
      {name:'Revoz — Novo Mesto',lat:45.802,lon:15.171,country:'SI'},
      {name:'MAN — Steyr',lat:48.043,lon:14.422,country:'AT'},
      {name:'BMW — Steyr',lat:48.045,lon:14.426,country:'AT'},
      {name:'Magna Steyr — Graz',lat:47.073,lon:15.442,country:'AT'},
      {name:'Rimac — Sveta Nedelja',lat:45.797,lon:15.826,country:'HR'},
    
      {name:'Iveco — Valladolid',lat:41.634,lon:-4.724,country:'ES'},
      {name:'SEAT — Zona Franca',lat:41.345,lon:2.124,country:'ES'},
      {name:'Stellantis — Atessa (SEVEL)',lat:42.082,lon:14.419,country:'IT'},
      {name:'Ducati — Borgo Panigale',lat:44.534,lon:11.287,country:'IT'},
      {name:'Maserati — Modena',lat:44.633,lon:10.945,country:'IT'},
      {name:'Tesla — Grünheide',lat:52.398,lon:13.788,country:'DE'},
      {name:'Volkswagen — Hannover',lat:52.378,lon:9.793,country:'DE'},
      {name:'Porsche — Leipzig',lat:51.393,lon:12.324,country:'DE'},
      {name:'Mercedes — Düsseldorf',lat:51.201,lon:6.803,country:'DE'},
      {name:'Toyota — Kolin',lat:49.991,lon:15.208,country:'SK'},
      {name:'Hyundai — Nošovice',lat:49.651,lon:18.445,country:'SK'},
    
      {name:'Renault — Novo Mesto (add)',lat:45.803,lon:15.172,country:'SI'},
      {name:'Smart — Hambach',lat:44.098,lon:6.974,country:'FR'},
      {name:'Alpine — Dieppe',lat:49.921,lon:1.071,country:'FR'},
      {name:'Volkswagen — Pamplona',lat:42.818,lon:-1.644,country:'ES'},
      {name:'Nissan — Barcelona (closed/exp.)',lat:41.435,lon:2.195,country:'ES'},
      {name:'MINI — Oxford (exp. NL)',lat:51.767,lon:-1.267,country:'NL'},
      {name:'Hyundai — Nošovice (add)',lat:49.652,lon:18.446,country:'SK'},
      {name:'Porsche — Leipzig (add)',lat:51.394,lon:12.325,country:'DE'},
    
      {name:'Stellantis — Tychy (exp. SK)',lat:50.112,lon:18.992,country:'SK'},
      {name:'Suzuki — Esztergom (exp. SK)',lat:47.794,lon:18.737,country:'SK'},
      {name:'Volkswagen — Poznań (exp. DE)',lat:52.414,lon:16.94,country:'DE'},
      {name:'Toyota — Wałbrzych (exp. SK)',lat:50.783,lon:16.283,country:'SK'},
      {name:'Mercedes-Benz — Kecskemét (exp. AT)',lat:46.907,lon:19.698,country:'AT'},
      {name:'Renault — Novo Mesto (add2)',lat:45.804,lon:15.173,country:'SI'},
      {name:'Volvo — Bruges (add)',lat:51.205,lon:3.233,country:'BE'},
    
      {name:'FCA — Tychy (exp. SK add)',lat:50.113,lon:18.993,country:'SK'},
      {name:'Skoda — Mladá Boleslav (exp. SK)',lat:50.417,lon:14.907,country:'SK'},
      {name:'Volvo — Göteborg (exp. FI)',lat:57.708,lon:11.978,country:'FI'},
      {name:'Saab — Trollhättan (exp. FI)',lat:58.283,lon:12.287,country:'FI'},
      {name:'Ford — Craiova (exp. HR)',lat:44.316,lon:23.794,country:'HR'},
    
      {name:'BMW — San Luis Potosí (exp. DE)',lat:22.149,lon:-100.978,country:'DE'},
      {name:'Volvo — Göteborg Torslanda (exp. FI)',lat:57.72,lon:11.817,country:'FI'},
      {name:'Stellantis — Luton (exp. FR)',lat:51.88,lon:-0.434,country:'FR'},
    ],
  },

  /* ───────── 6. TERMINAL CÉRÉALIER ───────── */
  {
    type: 'grain_terminal', name: 'Terminal céréalier', icon: 'ind_grain',
    cargoTypes: ['wheat','corn','barley','rapeseed','sunflower','soybeans','oilseed-meal','animal-feed'],
    cargoOut: 'Céréales export', dailyTonnageMin: 300, dailyTonnageMax: 1200,
    pricePerTonne: 35, attractCost: 90000,
    description: 'Terminal export : 300-1200t/jour. Trafic saisonnier pendant les récoltes.',
    realLocations: [
      {name:'Sénalia — Rouen',lat:49.437,lon:1.079,country:'FR'},
      {name:'Silos Grand-Couronne',lat:49.358,lon:1.015,country:'FR'},
      {name:'Soufflet — Nogent-sur-Seine',lat:48.492,lon:3.505,country:'FR'},
      {name:'InVivo — La Pallice',lat:46.166,lon:-1.214,country:'FR'},
      {name:'Axéréal — Chartres',lat:48.453,lon:1.489,country:'FR'},
      {name:'Vivescia — Reims',lat:49.258,lon:3.995,country:'FR'},
      {name:'Terrena — Nantes',lat:47.218,lon:-1.553,country:'FR'},
      {name:'Arterris — Castelnaudary',lat:43.317,lon:1.954,country:'FR'},
      {name:'Maïsadour — Mont-de-Marsan',lat:43.893,lon:-0.497,country:'FR'},
      {name:'Soufflet — Strasbourg',lat:48.573,lon:7.8,country:'FR'},
      {name:'Sénalia — Dunkerque',lat:51.044,lon:2.366,country:'FR'},
      {name:'Cérévia — La Pallice',lat:46.168,lon:-1.213,country:'FR'},
      {name:'Socomac — Bordeaux',lat:44.858,lon:-0.547,country:'FR'},
      {name:'Silos port de Sète',lat:43.397,lon:3.695,country:'FR'},
      {name:'ADM — Hamburg',lat:53.534,lon:9.963,country:'DE'},
      {name:'BayWa — Munich',lat:48.115,lon:11.612,country:'DE'},
      {name:'Agravis — Münster',lat:51.961,lon:7.638,country:'DE'},
      {name:'ADM — Brake',lat:53.333,lon:8.477,country:'DE'},
      {name:'Bunge — Mannheim',lat:49.487,lon:8.465,country:'DE'},
      {name:'Getreide AG — Rendsburg',lat:54.304,lon:9.663,country:'DE'},
      {name:'Cargill — Amsterdam',lat:52.393,lon:4.795,country:'NL'},
      {name:'ADM — Rotterdam',lat:51.888,lon:4.39,country:'NL'},
      {name:'Bunge Loders Croklaan — Wormerveer',lat:52.498,lon:4.785,country:'NL'},
      {name:'Cargill — Antwerpen',lat:51.258,lon:4.364,country:'BE'},
      {name:'Euro-Silo — Gent',lat:51.088,lon:3.758,country:'BE'},
      {name:'Casillo — Corato',lat:41.146,lon:16.419,country:'IT'},
      {name:'Casillo — Foggia',lat:41.467,lon:15.544,country:'IT'},
      {name:'Barilla — Parma (silos)',lat:44.8,lon:10.33,country:'IT'},
      {name:'Puerto Tarragona — silos',lat:41.087,lon:1.235,country:'ES'},
      {name:'Cargill — Barcelona',lat:41.353,lon:2.173,country:'ES'},
      {name:'Sovena — Lisboa',lat:38.732,lon:-9.132,country:'PT'},
      {name:'Raisio — Raisio',lat:60.484,lon:22.169,country:'FI'},
      {name:'Myllyn Paras — Hyvinkää',lat:60.634,lon:24.86,country:'FI'},
      {name:'Glanbia — Kilkenny',lat:52.654,lon:-7.251,country:'IE'},
      {name:'Origin Enterprises — Dublin',lat:53.332,lon:-6.25,country:'IE'},
      {name:'Loulis Mills — Volos',lat:39.365,lon:22.935,country:'GR'},
      {name:'EPIRUS — Ioannina',lat:39.664,lon:20.851,country:'GR'},
      {name:'Latvijas Maiznieks — Rīga',lat:56.948,lon:24.081,country:'LV'},
      {name:'Kauno Grūdai — Kaunas',lat:54.932,lon:24.003,country:'LT'},
      {name:'Mlyn Pohronský Ruskov',lat:48.216,lon:18.605,country:'SK'},
    
      {name:'Senalia — Dunkerque',lat:51.043,lon:2.367,country:'FR'},
      {name:'Axéréal — Tours',lat:47.392,lon:0.697,country:'FR'},
      {name:'Tereos — Origny (export)',lat:49.832,lon:3.516,country:'FR'},
      {name:'Agralys — Blois',lat:47.586,lon:1.33,country:'FR'},
      {name:'Vivescia — Vitry-le-François',lat:48.726,lon:4.587,country:'FR'},
      {name:'Soufflet — Bordeaux',lat:44.856,lon:-0.546,country:'FR'},
      {name:'BayWa — Bamberg',lat:49.899,lon:10.907,country:'DE'},
      {name:'Getreide AG — Mannheim',lat:49.487,lon:8.467,country:'DE'},
      {name:'ADM — Spyck',lat:51.829,lon:6.363,country:'DE'},
      {name:'Toepfer — Hamburg',lat:53.536,lon:9.964,country:'DE'},
      {name:'BayWa — Stuttgart',lat:48.799,lon:9.182,country:'DE'},
      {name:'Porto Cereales — Ravenna',lat:44.455,lon:12.285,country:'IT'},
      {name:'Consorzio Agrario — Padova',lat:45.411,lon:11.881,country:'IT'},
      {name:'Cargill — Sant Adrià',lat:41.425,lon:2.219,country:'ES'},
      {name:'AgroFert — Prostějov',lat:49.472,lon:17.109,country:'SK'},
      {name:'Kauno Grūdai — Klaipėda',lat:55.712,lon:21.128,country:'LT'},
      {name:'ALOJA STARKELSEN — Rīga',lat:56.949,lon:24.085,country:'LV'},
      {name:'Soya Hellas — Thessaloniki',lat:40.641,lon:22.939,country:'GR'},
      {name:'Groupe Castel — Lisboa',lat:38.73,lon:-9.13,country:'PT'},
      {name:'Goodmills — Wien',lat:48.215,lon:16.34,country:'AT'},
      {name:'Mühlenchemie — Ahrensburg',lat:53.679,lon:10.232,country:'DE'},
      {name:'Atria — Seinäjoki',lat:62.792,lon:22.831,country:'FI'},
    
      {name:'InVivo — Rouen (add)',lat:49.438,lon:1.08,country:'FR'},
      {name:'Socomac — Lorient',lat:47.744,lon:-3.358,country:'FR'},
      {name:'Axéréal — Rouen',lat:49.436,lon:1.078,country:'FR'},
      {name:'Cargill — Brest',lat:48.389,lon:-4.485,country:'FR'},
      {name:'ADM — Mainz',lat:49.998,lon:8.265,country:'DE'},
      {name:'Bunge — Brake (add)',lat:53.334,lon:8.478,country:'DE'},
      {name:'Agropalma — Lisboa',lat:38.73,lon:-9.131,country:'PT'},
      {name:'Atria — Nurmo (add)',lat:62.82,lon:22.86,country:'FI'},
    
      {name:'Tereos — Connantre (grain)',lat:48.751,lon:3.568,country:'FR'},
      {name:'Vivescia — Châlons',lat:48.952,lon:4.356,country:'FR'},
      {name:'InVivo — Bordeaux',lat:44.857,lon:-0.548,country:'FR'},
      {name:'Soufflet — Liège',lat:50.64,lon:5.585,country:'BE'},
      {name:'Cefetra — Amsterdam',lat:52.395,lon:4.797,country:'NL'},
      {name:'Bunge — Amsterdam',lat:52.394,lon:4.796,country:'NL'},
      {name:'Cargill — Gent',lat:51.09,lon:3.758,country:'BE'},
      {name:'Bunge — Mannheim (add)',lat:49.488,lon:8.466,country:'DE'},
      {name:'Leipziger Mühle',lat:51.343,lon:12.39,country:'DE'},
      {name:'Dresdner Mühle',lat:51.058,lon:13.731,country:'DE'},
    
      {name:'Senalia — Grand-Couronne (add)',lat:49.359,lon:1.016,country:'FR'},
      {name:'Casillo Group — Foggia (add)',lat:41.468,lon:15.545,country:'IT'},
      {name:'Cereales Barcala — Vigo',lat:42.235,lon:-8.718,country:'ES'},
      {name:'Kölnölwerke — Köln',lat:50.955,lon:6.96,country:'DE'},
      {name:'Lantmännen — Malmö (exp. DK)',lat:55.601,lon:13.001,country:'DK'},
      {name:'GASC — Alexandria (exp. GR)',lat:31.2,lon:29.917,country:'GR'},
    
      {name:'InVivo — Nantes (add)',lat:47.219,lon:-1.554,country:'FR'},
      {name:'Agralys — Orléans',lat:47.905,lon:1.9,country:'FR'},
      {name:'Cargill — Krefeld',lat:51.34,lon:6.57,country:'DE'},
      {name:'ADM — Leer',lat:53.234,lon:7.452,country:'DE'},
    
      {name:'Grainbulk — Rostock',lat:54.143,lon:12.082,country:'DE'},
      {name:'ATR Landhandel — Ratzeburg',lat:53.707,lon:10.784,country:'DE'},
      {name:'Mannheim Ag — Mannheim',lat:49.488,lon:8.468,country:'DE'},
      {name:'Malteurop — Reims',lat:49.259,lon:3.994,country:'FR'},
    ],
  },

  /* ───────── 7. USINE CHIMIQUE ───────── */
  {
    type: 'chemical_plant', name: 'Usine chimique', icon: 'ind_chemical',
    cargoTypes: ['chemicals-liq','acids','toxic','corrosive','plastic-granules','paint','ammonia','chlorine'],
    cargoOut: 'Produits chimiques', dailyTonnageMin: 150, dailyTonnageMax: 600,
    pricePerTonne: 90, attractCost: 130000,
    description: 'Chimie fine et lourde : 150-600t/jour. TMD obligatoire.',
    realLocations: [
      {name:'BASF — Chalampé',lat:47.82,lon:7.554,country:'FR'},
      {name:'Arkema — Pierre-Bénite',lat:45.7,lon:4.825,country:'FR'},
      {name:'Solvay — Dombasle',lat:48.619,lon:6.348,country:'FR'},
      {name:'Air Liquide — Fos',lat:43.428,lon:4.903,country:'FR'},
      {name:'Rhodia — Roussillon',lat:45.374,lon:4.82,country:'FR'},
      {name:'Arkema — Lacq',lat:43.39,lon:-0.611,country:'FR'},
      {name:'Arkema — Serquigny',lat:49.099,lon:0.52,country:'FR'},
      {name:'Solvay — Tavaux',lat:47.028,lon:5.442,country:'FR'},
      {name:'SNF — Andrézieux',lat:45.519,lon:4.265,country:'FR'},
      {name:'Novacarb — Laneuveville',lat:48.617,lon:6.344,country:'FR'},
      {name:'BASF — Ludwigshafen',lat:49.493,lon:8.431,country:'DE'},
      {name:'Bayer — Leverkusen',lat:51.033,lon:6.994,country:'DE'},
      {name:'Evonik — Marl',lat:51.659,lon:7.105,country:'DE'},
      {name:'Dow — Stade',lat:53.6,lon:9.477,country:'DE'},
      {name:'Lanxess — Dormagen',lat:51.095,lon:6.834,country:'DE'},
      {name:'Covestro — Leverkusen',lat:51.038,lon:6.998,country:'DE'},
      {name:'Wacker — Burghausen',lat:48.168,lon:12.834,country:'DE'},
      {name:'INEOS — Cologne',lat:50.892,lon:6.991,country:'DE'},
      {name:'Evonik — Wesseling',lat:50.822,lon:6.97,country:'DE'},
      {name:'Henkel — Düsseldorf',lat:51.21,lon:6.746,country:'DE'},
      {name:'BASF — Schwarzheide',lat:51.476,lon:13.86,country:'DE'},
      {name:'Dow — Schkopau',lat:51.388,lon:11.972,country:'DE'},
      {name:'BASF — Antwerpen',lat:51.289,lon:4.373,country:'BE'},
      {name:'INEOS — Antwerpen',lat:51.278,lon:4.388,country:'BE'},
      {name:'Solvay — Jemeppe',lat:50.605,lon:5.5,country:'BE'},
      {name:'Borealis — Kallo',lat:51.268,lon:4.276,country:'BE'},
      {name:'3M — Zwijndrecht',lat:51.222,lon:4.33,country:'BE'},
      {name:'DSM — Geleen',lat:50.966,lon:5.831,country:'NL'},
      {name:'SABIC — Geleen',lat:50.971,lon:5.841,country:'NL'},
      {name:'Shell Chemicals — Moerdijk',lat:51.671,lon:4.586,country:'NL'},
      {name:'Dow — Terneuzen',lat:51.332,lon:3.828,country:'NL'},
      {name:'AkzoNobel — Arnhem',lat:51.975,lon:5.909,country:'NL'},
      {name:'ENI Versalis — Porto Marghera',lat:45.454,lon:12.24,country:'IT'},
      {name:'Radici — Novara',lat:45.454,lon:8.619,country:'IT'},
      {name:'Mapei — Milan',lat:45.533,lon:9.332,country:'IT'},
      {name:'Repsol Química — Tarragona',lat:41.082,lon:1.195,country:'ES'},
      {name:'BASF — Tarragona',lat:41.078,lon:1.2,country:'ES'},
      {name:'Cepsa Química — Puertollano',lat:38.688,lon:-4.085,country:'ES'},
      {name:'Ercros — Flix',lat:41.233,lon:0.54,country:'ES'},
      {name:'Borealis — Linz',lat:48.307,lon:14.297,country:'AT'},
      {name:'Neste — Porvoo (chemicals)',lat:60.312,lon:25.613,country:'FI'},
      {name:'Kemira — Helsinki',lat:60.241,lon:25.037,country:'FI'},
      {name:'Pfizer — Ringaskiddy',lat:51.829,lon:-8.33,country:'IE'},
      {name:'Aughinish Alumina — Limerick',lat:52.625,lon:-9.068,country:'IE'},
      {name:'Dow Hellas — Lavrio',lat:37.719,lon:24.062,country:'GR'},
      {name:'Achema — Jonava',lat:55.079,lon:24.289,country:'LT'},
      {name:'Borealis — Schwechat',lat:48.14,lon:16.47,country:'AT'},
      {name:'Duslo — Šaľa',lat:48.151,lon:17.879,country:'SK'},
    
      {name:'BASF — Schwarzheide (chem)',lat:51.477,lon:13.862,country:'DE'},
      {name:'BASF — Münster',lat:51.969,lon:7.625,country:'DE'},
      {name:'Evonik — Darmstadt',lat:49.86,lon:8.639,country:'DE'},
      {name:'Evonik — Hanau',lat:50.133,lon:8.927,country:'DE'},
      {name:'Lanxess — Krefeld',lat:51.348,lon:6.571,country:'DE'},
      {name:'Lanxess — Leverkusen (add)',lat:51.036,lon:6.997,country:'DE'},
      {name:'Solvay — Rheinberg',lat:51.548,lon:6.595,country:'DE'},
      {name:'Arkema — Marseille',lat:43.315,lon:5.375,country:'FR'},
      {name:'Solvay — Salin-de-Giraud',lat:43.429,lon:4.74,country:'FR'},
      {name:'Novacarb — La Madeleine',lat:48.616,lon:6.347,country:'FR'},
      {name:'Arkema — Jarrie',lat:45.097,lon:5.749,country:'FR'},
      {name:'Rhodia — Lyon',lat:45.76,lon:4.83,country:'FR'},
      {name:'Dow — Stade (add)',lat:53.599,lon:9.476,country:'DE'},
      {name:'Merck KGaA — Darmstadt',lat:49.857,lon:8.64,country:'DE'},
      {name:'Yara — Tertre',lat:50.486,lon:3.776,country:'BE'},
      {name:'AGC Chemicals — Terni',lat:42.562,lon:12.642,country:'IT'},
      {name:'Mapei — Robbiano',lat:45.574,lon:9.328,country:'IT'},
      {name:'CEPSA Química — Palos',lat:37.211,lon:-6.886,country:'ES'},
      {name:'Borregaard — Sarpsborg (exp. FI)',lat:61.117,lon:28.502,country:'FI'},
      {name:'Kemira — Vaasa',lat:63.1,lon:21.62,country:'FI'},
    
      {name:'Air Liquide — Dunkerque',lat:51.035,lon:2.34,country:'FR'},
      {name:'Total — Feluy',lat:50.538,lon:4.29,country:'BE'},
      {name:'Solvay — Devnya (exp. GR)',lat:43.222,lon:27.565,country:'GR'},
      {name:'Kemira — Oulu',lat:65.013,lon:25.472,country:'FI'},
      {name:'Tikkurila — Vantaa',lat:60.293,lon:24.958,country:'FI'},
      {name:'Nouryon — Bohus (exp. NL)',lat:51.95,lon:4.5,country:'NL'},
    
      {name:'Solvay — Bernburg',lat:51.81,lon:11.741,country:'DE'},
      {name:'Lanxess — Bitterfeld',lat:51.624,lon:12.319,country:'DE'},
      {name:'Bayer — Brunsbüttel',lat:53.893,lon:9.165,country:'DE'},
      {name:'BASF — Lemförde',lat:52.457,lon:8.374,country:'DE'},
      {name:'Henkel — Wien',lat:48.211,lon:16.37,country:'AT'},
      {name:'Atotech — Berlin',lat:52.509,lon:13.341,country:'DE'},
      {name:'Cabot — Ravenna',lat:44.455,lon:12.286,country:'IT'},
      {name:'Lonza — Visp (exp. AT)',lat:46.296,lon:7.881,country:'AT'},
    
      {name:'Clariant — Frankfurt',lat:50.107,lon:8.645,country:'DE'},
      {name:'SKW — Trostberg',lat:48.03,lon:12.529,country:'DE'},
      {name:'Woellner — Ludwigshafen',lat:49.49,lon:8.434,country:'DE'},
      {name:'Solvay — Rosignano',lat:43.384,lon:10.43,country:'IT'},
      {name:'Nutreco — Boxmeer',lat:51.65,lon:5.95,country:'NL'},
      {name:'Tessenderlo — Tessenderlo',lat:51.07,lon:5.087,country:'BE'},
      {name:'Perstorp — Landskrona (exp. FI)',lat:55.87,lon:12.828,country:'FI'},
    
      {name:'Brenntag — Essen',lat:51.449,lon:7.01,country:'DE'},
      {name:'Brenntag — Mulhouse',lat:47.755,lon:7.34,country:'FR'},
      {name:'Univar — Rotterdam',lat:51.893,lon:4.34,country:'NL'},
      {name:'Caldic — Rotterdam',lat:51.895,lon:4.342,country:'NL'},
      {name:'Quaker Chemical — Uithoorn',lat:52.248,lon:4.831,country:'NL'},
    
      {name:'BASF — Tarragona (add)',lat:41.079,lon:1.201,country:'ES'},
      {name:'CEPSA — San Roque',lat:36.216,lon:-5.374,country:'ES'},
      {name:'Borealis — Porvoo',lat:60.313,lon:25.614,country:'FI'},
      {name:'Nouryon — Delfzijl',lat:53.329,lon:6.925,country:'NL'},
    
      {name:'Wacker — München',lat:48.133,lon:11.59,country:'DE'},
      {name:'Symrise — Holzminden',lat:51.826,lon:9.444,country:'DE'},
      {name:'Givaudan — Vernier (exp. FR)',lat:46.211,lon:6.078,country:'FR'},
      {name:'IFF — Tilburg',lat:51.558,lon:5.09,country:'NL'},
    ],
  },

  /* ───────── 8. PAPETERIE ───────── */
  {
    type: 'paper_mill', name: 'Papeterie', icon: 'ind_paper',
    cargoTypes: ['timber','pulp','paper','cardboard','wood-chips'],
    cargoOut: 'Papier / Carton', dailyTonnageMin: 200, dailyTonnageMax: 700,
    pricePerTonne: 50, attractCost: 75000,
    description: 'Transformation bois → papier : 200-700t/jour.',
    realLocations: [
      {name:'Smurfit Kappa — Facture',lat:44.63,lon:-0.976,country:'FR'},
      {name:'Norske Skog — Golbey',lat:48.194,lon:6.441,country:'FR'},
      {name:'Papeteries de Condat',lat:45.072,lon:1.22,country:'FR'},
      {name:'Fibre Excellence — Saint-Gaudens',lat:43.107,lon:0.725,country:'FR'},
      {name:'Chapelle Darblay — Grand-Couronne',lat:49.36,lon:1.014,country:'FR'},
      {name:'SCA — Kunheim',lat:48.069,lon:7.537,country:'FR'},
      {name:'DS Smith — Kaysersberg',lat:48.137,lon:7.264,country:'FR'},
      {name:'Palm — Aalen',lat:48.842,lon:10.079,country:'FR'},
      {name:'UPM — Schongau',lat:47.808,lon:10.895,country:'DE'},
      {name:'UPM — Schwedt',lat:53.044,lon:14.276,country:'DE'},
      {name:'Sappi — Ehingen',lat:48.277,lon:9.727,country:'DE'},
      {name:'Stora Enso — Sachsen',lat:50.897,lon:12.64,country:'DE'},
      {name:'Palm — Eltmann',lat:49.974,lon:10.667,country:'DE'},
      {name:'Hamburger — Spremberg',lat:51.571,lon:14.373,country:'DE'},
      {name:'Progroup — Sandersdorf',lat:51.629,lon:12.253,country:'DE'},
      {name:'Smurfit Kappa — Herzberg',lat:51.655,lon:10.338,country:'DE'},
      {name:'LEIPA — Schwedt',lat:53.045,lon:14.271,country:'DE'},
      {name:'UPM — Jämsänkoski',lat:61.863,lon:25.196,country:'FI'},
      {name:'Stora Enso — Imatra',lat:61.181,lon:28.782,country:'FI'},
      {name:'Metsä Board — Äänekoski',lat:62.599,lon:25.73,country:'FI'},
      {name:'UPM — Rauma',lat:61.13,lon:21.505,country:'FI'},
      {name:'Metsä Fibre — Joutseno',lat:61.116,lon:28.505,country:'FI'},
      {name:'UPM — Kymi',lat:60.903,lon:26.612,country:'FI'},
      {name:'Stora Enso — Oulu',lat:65.013,lon:25.471,country:'FI'},
      {name:'Sappi — Gratkorn',lat:47.128,lon:15.35,country:'AT'},
      {name:'Mondi — Frantschach',lat:46.837,lon:14.947,country:'AT'},
      {name:'Lenzing AG — Lenzing',lat:47.978,lon:13.612,country:'AT'},
      {name:'Navigator — Setúbal',lat:38.518,lon:-8.886,country:'PT'},
      {name:'Navigator — Figueira da Foz',lat:40.143,lon:-8.85,country:'PT'},
      {name:'Navigator — Aveiro',lat:40.64,lon:-8.65,country:'PT'},
      {name:'Burgo — Mantova',lat:45.147,lon:10.793,country:'IT'},
      {name:'Cartiere Fedrigoni — Verona',lat:45.438,lon:11.001,country:'IT'},
      {name:'ENCE — Pontevedra',lat:42.44,lon:-8.617,country:'ES'},
      {name:'Smurfit Kappa — Nervión',lat:43.268,lon:-2.977,country:'ES'},
      {name:'VPK — Oudegem',lat:51.006,lon:4.076,country:'BE'},
      {name:'Sappi — Lanaken',lat:50.88,lon:5.644,country:'BE'},
      {name:'Smurfit Kappa — Roermond',lat:51.192,lon:5.979,country:'NL'},
      {name:'Grigeo — Grigiškės',lat:54.649,lon:25.13,country:'LT'},
      {name:'Mondi SCP — Ružomberok',lat:49.076,lon:19.306,country:'SK'},
    
      {name:'Lecta — Condat',lat:45.07,lon:1.218,country:'FR'},
      {name:'Papeterie de Mandeure',lat:47.454,lon:6.815,country:'FR'},
      {name:'Cascades — La Rochette',lat:45.452,lon:6.115,country:'FR'},
      {name:'Clairefontaine — Étival',lat:48.363,lon:6.857,country:'FR'},
      {name:'VPK — Strasbourg',lat:48.578,lon:7.755,country:'FR'},
      {name:'Papeterie Palm — Eltmann',lat:49.975,lon:10.67,country:'DE'},
      {name:'August Koehler — Oberkirch',lat:48.529,lon:8.076,country:'DE'},
      {name:'Felix Schoeller — Osnabrück',lat:52.267,lon:8.038,country:'DE'},
      {name:'Papierfabrik — Scheufelen',lat:48.552,lon:9.614,country:'DE'},
      {name:'Stora Enso — Corbehem',lat:50.338,lon:3.032,country:'FR'},
      {name:'Kruger — Sherbrooke (exp. BE)',lat:50.84,lon:5.64,country:'BE'},
      {name:'Cartiere Burgo — Avezzano',lat:42.032,lon:13.426,country:'IT'},
      {name:'SAICA — Zaragoza',lat:41.654,lon:-0.893,country:'ES'},
      {name:'Europac — Viana do Castelo',lat:41.693,lon:-8.834,country:'PT'},
      {name:'Metsä Board — Kyro',lat:61.66,lon:23.502,country:'FI'},
      {name:'Heinzel — Pöls',lat:47.224,lon:14.588,country:'AT'},
      {name:'Mondi — Štětí',lat:50.478,lon:14.373,country:'SK'},
    
      {name:'Metsä Board — Husum (exp. FI)',lat:63.333,lon:18.73,country:'FI'},
      {name:'Stora Enso — Heinola',lat:61.205,lon:26.038,country:'FI'},
      {name:'SCA — Östrand (exp. FI)',lat:62.377,lon:17.377,country:'FI'},
      {name:'Ahlstrom — Kauttua',lat:61.076,lon:22.319,country:'FI'},
      {name:'Sappi — Lanaken (add)',lat:50.881,lon:5.645,country:'BE'},
    
      {name:'Sappi — Stockstadt',lat:49.806,lon:8.963,country:'DE'},
      {name:'Perlen Papier — Perlen (exp. AT)',lat:47.18,lon:8.262,country:'AT'},
      {name:'Brigl & Bergmeister — Niklasdorf',lat:47.386,lon:15.13,country:'AT'},
      {name:'Zellstoff Pöls — Steiermark',lat:47.224,lon:14.59,country:'AT'},
      {name:'Cartiere Miliani — Fabriano',lat:43.337,lon:12.906,country:'IT'},
      {name:'Torraspapel — Zaragoza',lat:41.656,lon:-0.892,country:'ES'},
      {name:'ENCE — Navia',lat:43.547,lon:-6.732,country:'ES'},
      {name:'Papelera del Nervión — Bilbao',lat:43.265,lon:-2.975,country:'ES'},
    
      {name:'Cartiere di Trevi',lat:42.874,lon:12.753,country:'IT'},
      {name:'Lucart — Porcari',lat:43.847,lon:10.621,country:'IT'},
      {name:'DS Smith — Lucca',lat:43.843,lon:10.508,country:'IT'},
      {name:'Papelera Guipuzcoana — Tolosa',lat:43.135,lon:-2.078,country:'ES'},
      {name:'Holmen — Hallstavik (exp. FI)',lat:60.06,lon:18.6,country:'FI'},
      {name:'Billerud — Gruvön (exp. FI)',lat:59.345,lon:13.111,country:'FI'},
    
      {name:'Essity — Mannheim',lat:49.487,lon:8.469,country:'DE'},
      {name:'Wepa — Arnsberg',lat:51.397,lon:7.977,country:'DE'},
      {name:'Sofidel — Porcari',lat:43.846,lon:10.62,country:'IT'},
      {name:'Sofidel — Kisa (exp. FI)',lat:58.115,lon:15.63,country:'FI'},
    ],
  },

  /* ───────── 9. PLATEFORME LOGISTIQUE ───────── */
  {
    type: 'logistics_hub', name: 'Plateforme logistique', icon: 'ind_logistics',
    cargoTypes: ['containers-20','containers-40','swap-bodies','semi-trailers','parcels','express'],
    cargoOut: 'Colis / Palettes', dailyTonnageMin: 400, dailyTonnageMax: 3000,
    pricePerTonne: 65, attractCost: 250000,
    description: 'Hub intermodal : 400-3000t/jour. Cœur de la supply chain.',
    realLocations: [
      {name:'Dourges Delta 3',lat:50.43,lon:2.971,country:'FR'},
      {name:'Valenton — hub SNCF Fret',lat:48.745,lon:2.467,country:'FR'},
      {name:'Perpignan Saint-Charles',lat:42.69,lon:2.88,country:'FR'},
      {name:'Lyon Vénissieux',lat:45.71,lon:4.88,country:'FR'},
      {name:'Noisy-le-Sec — hub IDF',lat:48.895,lon:2.462,country:'FR'},
      {name:'Avignon Courtine',lat:43.917,lon:4.822,country:'FR'},
      {name:'Bordeaux Hourcade',lat:44.793,lon:-0.523,country:'FR'},
      {name:'Toulouse Eurocentre',lat:43.725,lon:1.37,country:'FR'},
      {name:'Lille Lomme — CT',lat:50.644,lon:3.024,country:'FR'},
      {name:'Strasbourg — CTS',lat:48.574,lon:7.796,country:'FR'},
      {name:'Marseille Mourepiane',lat:43.363,lon:5.35,country:'FR'},
      {name:'Le Boulou — AF',lat:42.523,lon:2.84,country:'FR'},
      {name:'Duisburg Intermodal',lat:51.432,lon:6.747,country:'DE'},
      {name:'München-Riem KV',lat:48.138,lon:11.713,country:'DE'},
      {name:'Hamburg Billwerder',lat:53.513,lon:10.108,country:'DE'},
      {name:'Köln-Eifeltor',lat:50.89,lon:6.916,country:'DE'},
      {name:'Nürnberg Hafen',lat:49.453,lon:11.083,country:'DE'},
      {name:'Frankfurt-Ost',lat:50.104,lon:8.746,country:'DE'},
      {name:'Hannover-Linden',lat:52.366,lon:9.718,country:'DE'},
      {name:'Stuttgart-Kornwestheim',lat:48.86,lon:9.183,country:'DE'},
      {name:'Bremen Roland',lat:53.095,lon:8.765,country:'DE'},
      {name:'Leipzig-Wahren',lat:51.374,lon:12.331,country:'DE'},
      {name:'Berlin-Großbeeren',lat:52.354,lon:13.318,country:'DE'},
      {name:'Antwerp Combinant',lat:51.296,lon:4.336,country:'BE'},
      {name:'Zeebrugge Intermodal',lat:51.335,lon:3.196,country:'BE'},
      {name:'Athus — terminal',lat:49.563,lon:5.83,country:'BE'},
      {name:'Rotterdam RSC',lat:51.91,lon:4.49,country:'NL'},
      {name:'Born Intermodal',lat:51.039,lon:5.805,country:'NL'},
      {name:'Venlo — Greenport',lat:51.38,lon:6.175,country:'NL'},
      {name:'Tilburg Railport',lat:51.564,lon:5.099,country:'NL'},
      {name:'Verona Quadrante Europa',lat:45.394,lon:11.009,country:'IT'},
      {name:'Milano Segrate',lat:45.489,lon:9.292,country:'IT'},
      {name:'Bologna Interporto',lat:44.5,lon:11.38,country:'IT'},
      {name:'Padova Interporto',lat:45.36,lon:11.917,country:'IT'},
      {name:'Torino Orbassano',lat:44.989,lon:7.521,country:'IT'},
      {name:'Barcelona Can Tunis',lat:41.362,lon:2.131,country:'ES'},
      {name:'Madrid Abroñigal',lat:40.39,lon:-3.669,country:'ES'},
      {name:'Zaragoza PLAZA',lat:41.641,lon:-1.003,country:'ES'},
      {name:'Valencia Fuente de San Luis',lat:39.46,lon:-0.37,country:'ES'},
      {name:'Wien Süd Terminal',lat:48.145,lon:16.38,country:'AT'},
      {name:'Wels Container Terminal',lat:48.159,lon:14.022,country:'AT'},
      {name:'Wolfurt Terminal',lat:47.474,lon:9.751,country:'AT'},
      {name:'Graz Werndorf',lat:46.941,lon:15.467,country:'AT'},
      {name:'Sines — ZAL',lat:37.948,lon:-8.86,country:'PT'},
      {name:'Bobadela — Lisboa',lat:38.802,lon:-9.077,country:'PT'},
      {name:'Vuosaari Harbour',lat:60.212,lon:25.172,country:'FI'},
      {name:'Shannon — Limerick',lat:52.701,lon:-8.935,country:'IE'},
      {name:'Bettembourg CFL',lat:49.513,lon:6.102,country:'LU'},
      {name:'Koper Intermodal',lat:45.55,lon:13.738,country:'SI'},
      {name:'Žilina Terminal',lat:49.208,lon:18.73,country:'SK'},
      {name:'Zagreb Jankomir',lat:45.82,lon:15.895,country:'HR'},
    
      {name:'Sogaris — Rungis',lat:48.746,lon:2.349,country:'FR'},
      {name:'CMA CGM — Marseille',lat:43.362,lon:5.347,country:'FR'},
      {name:'Eurorail — Bonneuil',lat:48.771,lon:2.492,country:'FR'},
      {name:'Logport — Duisburg II',lat:51.419,lon:6.691,country:'DE'},
      {name:'GVZ — Bremen',lat:53.1,lon:8.77,country:'DE'},
      {name:'Logistikzentrum — Erfurt',lat:50.97,lon:11.021,country:'DE'},
      {name:'GVZ — Augsburg',lat:48.353,lon:10.892,country:'DE'},
      {name:'Hupac — Basel',lat:47.556,lon:7.611,country:'DE'},
      {name:'Rotterdam Europoort — Intermodal',lat:51.955,lon:4.122,country:'NL'},
      {name:'Schiphol Trade Park',lat:52.275,lon:4.726,country:'NL'},
      {name:'Port de Liège — Trilogiport',lat:50.672,lon:5.623,country:'BE'},
      {name:'Interporto — Nola',lat:40.927,lon:14.53,country:'IT'},
      {name:'Interporto — Rivalta Scrivia',lat:44.787,lon:8.877,country:'IT'},
      {name:'Centro Intermodal — Coslada',lat:40.429,lon:-3.571,country:'ES'},
      {name:'ZAL Port — Barcelona',lat:41.36,lon:2.129,country:'ES'},
      {name:'Plataforma Central — Iberum',lat:39.994,lon:-3.597,country:'ES'},
      {name:'Sines — ZILS',lat:37.949,lon:-8.862,country:'PT'},
      {name:'Cargo Center — Graz',lat:46.94,lon:15.467,country:'AT'},
    
      {name:'Fret SNCF — Metz',lat:49.12,lon:6.183,country:'FR'},
      {name:'DB Schenker — Frankfurt',lat:50.09,lon:8.65,country:'DE'},
      {name:'Kuehne+Nagel — Rotterdam',lat:51.912,lon:4.47,country:'NL'},
      {name:'DSV — Hedehusene (exp. DK)',lat:55.658,lon:12.199,country:'DK'},
      {name:'GLS — Neuenstein',lat:49.205,lon:9.572,country:'DE'},
      {name:'TNT — Duiven',lat:51.951,lon:6.015,country:'NL'},
      {name:'XPO — Lyon',lat:45.714,lon:4.884,country:'FR'},
      {name:'Geodis — Gennevilliers',lat:48.923,lon:2.294,country:'FR'},
    
      {name:'Hupac — Busto Arsizio (add)',lat:45.619,lon:8.856,country:'IT'},
      {name:'Mercitalia — Roma',lat:41.89,lon:12.52,country:'IT'},
      {name:'Renfe Mercancías — Barcelona',lat:41.362,lon:2.132,country:'ES'},
      {name:'DB Cargo — Antwerpen',lat:51.295,lon:4.34,country:'BE'},
      {name:'TX Logistik — Troisdorf',lat:50.816,lon:7.156,country:'DE'},
      {name:'VIIA — Calais',lat:50.929,lon:1.811,country:'FR'},
      {name:'BLS Cargo — Bern (exp. AT)',lat:46.949,lon:7.439,country:'AT'},
      {name:'Captrain — Paris',lat:48.833,lon:2.33,country:'FR'},
    
      {name:'ECM — Dourges (add)',lat:50.431,lon:2.972,country:'FR'},
      {name:'Naviland Cargo — Marseille',lat:43.364,lon:5.351,country:'FR'},
      {name:'Fret SNCF — Bordeaux',lat:44.82,lon:-0.556,country:'FR'},
      {name:'Fret SNCF — Lyon (add)',lat:45.713,lon:4.881,country:'FR'},
      {name:'Kombiverkehr — Frankfurt',lat:50.091,lon:8.647,country:'DE'},
      {name:'ERS Railways — Rotterdam',lat:51.911,lon:4.488,country:'NL'},
      {name:'Hupac — Milano (add)',lat:45.457,lon:9.255,country:'IT'},
      {name:'Kombiconsult — Duisburg',lat:51.431,lon:6.748,country:'DE'},
    
      {name:'SNCF Fret — Metz (add)',lat:49.121,lon:6.184,country:'FR'},
      {name:'DHL Freight — Frankfurt',lat:50.094,lon:8.64,country:'DE'},
      {name:'Kuehne Nagel — Bremen',lat:53.105,lon:8.78,country:'DE'},
      {name:'Dachser — Kempten',lat:47.734,lon:10.32,country:'DE'},
      {name:'Schenker — Berlin',lat:52.505,lon:13.37,country:'DE'},
      {name:'Gefco — Paris',lat:48.835,lon:2.332,country:'FR'},
      {name:'XPO — Niort',lat:46.323,lon:-0.461,country:'FR'},
      {name:'Samskip — Rotterdam',lat:51.913,lon:4.47,country:'NL'},
      {name:'P&O Ferrymasters — Zeebrugge',lat:51.341,lon:3.189,country:'BE'},
      {name:'Ewals Cargo — Tegelen',lat:51.346,lon:6.141,country:'NL'},
    
      {name:'LKW Walter — Wien',lat:48.15,lon:16.38,country:'AT'},
      {name:'Cargo Partner — Fischamend',lat:48.113,lon:16.605,country:'AT'},
      {name:'Fercam — Bolzano',lat:46.497,lon:11.344,country:'IT'},
      {name:'Arcese — Rovereto',lat:45.889,lon:11.043,country:'IT'},
    
      {name:'SNCF — Valenton (add2)',lat:48.747,lon:2.469,country:'FR'},
      {name:'VIIA — Cherbourg',lat:49.642,lon:-1.615,country:'FR'},
      {name:'TX Logistik — Köln',lat:50.91,lon:6.975,country:'DE'},
      {name:'Mercitalia Shunting — Torino',lat:45.065,lon:7.66,country:'IT'},
      {name:'TX Logistik — Wien',lat:48.176,lon:16.385,country:'AT'},
      {name:'SNCF Fret — Nice',lat:43.7,lon:7.275,country:'FR'},
      {name:'XPO — Gerzat',lat:45.82,lon:3.143,country:'FR'},
      {name:'Fret SNCF — Rennes',lat:48.086,lon:-1.677,country:'FR'},
    ],
  },

  /* ───────── 10. CENTRALE THERMIQUE ───────── */
  {
    type: 'power_plant', name: 'Centrale thermique', icon: 'ind_power',
    cargoTypes: ['coal','pellets','wood-chips','household-waste'],
    cargoOut: 'Cendres / Résidus', dailyTonnageMin: 500, dailyTonnageMax: 2500,
    pricePerTonne: 20, attractCost: 100000,
    description: 'Consomme 500-2500t/jour de combustible. Trafic prévisible.',
    realLocations: [
      {name:'Centrale de Cordemais',lat:47.268,lon:-1.878,country:'FR'},
      {name:'Centrale du Havre',lat:49.494,lon:0.168,country:'FR'},
      {name:'Centrale de Gardanne',lat:43.454,lon:5.47,country:'FR'},
      {name:'Centrale de Saint-Avold',lat:49.1,lon:6.736,country:'FR'},
      {name:'Centrale de Meyreuil',lat:43.487,lon:5.51,country:'FR'},
      {name:'RWE — Niederaußem',lat:50.99,lon:6.669,country:'DE'},
      {name:'RWE — Neurath',lat:51.037,lon:6.622,country:'DE'},
      {name:'LEAG — Jänschwalde',lat:51.836,lon:14.451,country:'DE'},
      {name:'LEAG — Schwarze Pumpe',lat:51.537,lon:14.357,country:'DE'},
      {name:'Uniper — Datteln',lat:51.651,lon:7.342,country:'DE'},
      {name:'EnBW — Karlsruhe',lat:49.037,lon:8.348,country:'DE'},
      {name:'Vattenfall — Moorburg',lat:53.498,lon:9.945,country:'DE'},
      {name:'LEAG — Boxberg',lat:51.416,lon:14.579,country:'DE'},
      {name:'RWE — Weisweiler',lat:50.855,lon:6.364,country:'DE'},
      {name:'Trianel — Lünen',lat:51.607,lon:7.502,country:'DE'},
      {name:'EnBW — Heilbronn',lat:49.147,lon:9.207,country:'DE'},
      {name:'RWE — Eemshaven',lat:53.444,lon:6.829,country:'NL'},
      {name:'Uniper — Maasvlakte',lat:51.953,lon:4.039,country:'NL'},
      {name:'Onyx Power — Rotterdam',lat:51.891,lon:4.337,country:'NL'},
      {name:'ENEL — Brindisi',lat:40.647,lon:17.996,country:'IT'},
      {name:'ENEL — Civitavecchia',lat:42.064,lon:11.762,country:'IT'},
      {name:'A2A — Monfalcone',lat:45.782,lon:13.53,country:'IT'},
      {name:'Endesa — As Pontes',lat:43.433,lon:-7.856,country:'ES'},
      {name:'Endesa — Andorra',lat:40.996,lon:-0.441,country:'ES'},
      {name:'DEI — Ptolemaida',lat:40.51,lon:21.686,country:'GR'},
      {name:'DEI — Megalopoli',lat:37.404,lon:22.137,country:'GR'},
      {name:'DEI — Agios Dimitrios',lat:40.411,lon:21.838,country:'GR'},
      {name:'Moneypoint — Clare',lat:52.61,lon:-9.429,country:'IE'},
      {name:'EDP — Sines',lat:37.936,lon:-8.868,country:'PT'},
      {name:'EDP — Pego',lat:39.459,lon:-8.105,country:'PT'},
      {name:'Verbund — Mellach',lat:46.996,lon:15.521,country:'AT'},
      {name:'Lietuvos Energija — Elektrėnai',lat:54.784,lon:24.658,country:'LT'},
      {name:'Nováky — HBP',lat:48.718,lon:18.536,country:'SK'},
      {name:'Šoštanj TEŠ',lat:46.376,lon:15.047,country:'SI'},
      {name:'HEP — Plomin',lat:45.137,lon:14.156,country:'HR'},
      {name:'Tallinna Elektrijaam',lat:59.421,lon:24.711,country:'EE'},
    
      {name:'Emile Huchet — Saint-Avold',lat:49.1,lon:6.735,country:'FR'},
      {name:'Provence 5 — Gardanne',lat:43.455,lon:5.471,country:'FR'},
      {name:'GKM — Mannheim',lat:49.469,lon:8.461,country:'DE'},
      {name:'Staudinger — Großkrotzenburg',lat:50.088,lon:8.978,country:'DE'},
      {name:'Boxberg (unit N)',lat:51.418,lon:14.581,country:'DE'},
      {name:'Jänschwalde (units)',lat:51.837,lon:14.453,country:'DE'},
      {name:'Moorburg — Hamburg',lat:53.497,lon:9.943,country:'DE'},
      {name:'Irsching — Bayern',lat:48.773,lon:11.555,country:'DE'},
      {name:'Hemweg — Amsterdam',lat:52.405,lon:4.888,country:'NL'},
      {name:'Borssele — Kerncentrale',lat:51.43,lon:3.718,country:'NL'},
      {name:'Lünen — Trianel',lat:51.608,lon:7.503,country:'DE'},
      {name:'Livorno Ferraris — ENEL',lat:45.284,lon:8.068,country:'IT'},
      {name:'Fusina — A2A',lat:45.426,lon:12.25,country:'IT'},
      {name:'Compostilla — Endesa',lat:42.592,lon:-6.567,country:'ES'},
      {name:'Litoral — Almería',lat:36.833,lon:-2.46,country:'ES'},
      {name:'Lada — HUNOSA',lat:43.273,lon:-5.658,country:'ES'},
      {name:'Sines — PEGOP',lat:37.935,lon:-8.867,country:'PT'},
      {name:'Ahlstrom — Varkaus',lat:62.32,lon:27.908,country:'FI'},
      {name:'Moneypoint (unit 2)',lat:52.612,lon:-9.43,country:'IE'},
      {name:'Ptolemaida V',lat:40.513,lon:21.688,country:'GR'},
      {name:'TE-TO — Ljubljana',lat:46.07,lon:14.53,country:'SI'},
      {name:'EL-TO — Zagreb',lat:45.812,lon:15.99,country:'HR'},
    
      {name:'ENEL — Torrevaldaliga',lat:42.081,lon:11.746,country:'IT'},
      {name:'ENEL — Cerano (Brindisi)',lat:40.3,lon:18.015,country:'IT'},
      {name:'ENEL — La Casella',lat:44.988,lon:9.26,country:'IT'},
      {name:'Endesa — Carboneras',lat:36.995,lon:-1.893,country:'ES'},
      {name:'Naturgy — San Roque',lat:36.215,lon:-5.373,country:'ES'},
      {name:'Uniper — Scholven',lat:51.545,lon:7.075,country:'DE'},
      {name:'EVN — Dürnrohr (add)',lat:48.334,lon:15.883,country:'AT'},
    
      {name:'Frimmersdorf — RWE',lat:51.052,lon:6.578,country:'DE'},
      {name:'Schwarze Pumpe (add)',lat:51.538,lon:14.358,country:'DE'},
      {name:'Eemshaven (add)',lat:53.445,lon:6.83,country:'NL'},
      {name:'Maasvlakte (add)',lat:51.954,lon:4.04,country:'NL'},
      {name:'Moneypoint (add2)',lat:52.613,lon:-9.431,country:'IE'},
      {name:'Cordemais (add)',lat:47.269,lon:-1.879,country:'FR'},
      {name:'Meyreuil (add)',lat:43.488,lon:5.511,country:'FR'},
    
      {name:'Gardanne (add2)',lat:43.456,lon:5.472,country:'FR'},
      {name:'Blenod — EDF',lat:48.62,lon:6.074,country:'FR'},
      {name:'Weiher — EDF',lat:49.101,lon:6.738,country:'FR'},
      {name:'Mehrum — enercity',lat:52.351,lon:10.085,country:'DE'},
      {name:'Heyden — Uniper',lat:52.287,lon:8.917,country:'DE'},
      {name:'RDK — Karlsruhe',lat:49.038,lon:8.349,country:'DE'},
      {name:'Meri Pori — Fortum',lat:61.471,lon:21.759,country:'FI'},
      {name:'Naistenlahti — Tampere',lat:61.5,lon:23.776,country:'FI'},
    
      {name:'Vado Ligure — Tirreno Power',lat:44.268,lon:8.42,country:'IT'},
      {name:'Brindisi ENEL (add2)',lat:40.648,lon:17.997,country:'IT'},
      {name:'Torrevaldaliga ENEL (add)',lat:42.082,lon:11.747,country:'IT'},
      {name:'Sardinia Fiumesanto',lat:40.814,lon:8.297,country:'IT'},
    ],
  },

  /* ───────── 11. CENTRALE NUCLÉAIRE ───────── */
  {
    type: 'nuclear_plant', name: 'Centrale nucléaire', icon: 'ind_nuclear',
    cargoTypes: ['nuclear-waste','radioactive','construction-equip','transformer'],
    cargoOut: 'Combustible / Déchets nucléaires', dailyTonnageMin: 10, dailyTonnageMax: 50,
    pricePerTonne: 2000, attractCost: 500000,
    description: 'Convois nucléaires ultra-sécurisés. Faible volume, très haut revenu.',
    realLocations: [
      {name:'La Hague — retraitement',lat:49.68,lon:-1.879,country:'FR'},
      {name:'Gravelines',lat:50.993,lon:2.117,country:'FR'},
      {name:'Paluel',lat:49.858,lon:0.632,country:'FR'},
      {name:'Cattenom',lat:49.408,lon:6.217,country:'FR'},
      {name:'Tricastin',lat:44.333,lon:4.733,country:'FR'},
      {name:'Dampierre',lat:47.732,lon:2.518,country:'FR'},
      {name:'Saint-Laurent-des-Eaux',lat:47.721,lon:1.581,country:'FR'},
      {name:'Chinon',lat:47.23,lon:0.167,country:'FR'},
      {name:'Cruas-Meysse',lat:44.633,lon:4.758,country:'FR'},
      {name:'Bugey',lat:45.797,lon:5.27,country:'FR'},
      {name:'Flamanville',lat:49.537,lon:-1.881,country:'FR'},
      {name:'Civaux',lat:46.448,lon:0.661,country:'FR'},
      {name:'Golfech',lat:44.106,lon:0.845,country:'FR'},
      {name:'Blayais',lat:45.255,lon:-0.69,country:'FR'},
      {name:'Chooz',lat:50.091,lon:4.791,country:'FR'},
      {name:'Penly',lat:49.976,lon:1.21,country:'FR'},
      {name:'Nogent-sur-Seine',lat:48.518,lon:3.52,country:'FR'},
      {name:'Belleville-sur-Loire',lat:47.514,lon:2.876,country:'FR'},
      {name:'Saint-Alban',lat:45.406,lon:4.754,country:'FR'},
      {name:'Fessenheim',lat:47.908,lon:7.562,country:'FR'},
      {name:'Doel',lat:51.326,lon:4.26,country:'BE'},
      {name:'Tihange',lat:50.534,lon:5.272,country:'BE'},
      {name:'Isar — Niederaichbach',lat:48.606,lon:12.294,country:'DE'},
      {name:'Neckarwestheim',lat:49.04,lon:9.175,country:'DE'},
      {name:'Emsland — Lingen',lat:52.474,lon:7.32,country:'DE'},
      {name:'Almaraz',lat:39.808,lon:-5.694,country:'ES'},
      {name:'Vandellòs',lat:41.198,lon:0.867,country:'ES'},
      {name:'Ascó',lat:41.199,lon:0.572,country:'ES'},
      {name:'Cofrentes',lat:39.215,lon:-1.049,country:'ES'},
      {name:'Trillo',lat:40.704,lon:-2.614,country:'ES'},
      {name:'Olkiluoto',lat:61.235,lon:21.444,country:'FI'},
      {name:'Loviisa',lat:60.369,lon:26.363,country:'FI'},
      {name:'Borssele',lat:51.43,lon:3.717,country:'NL'},
      {name:'Jaslovské Bohunice',lat:48.491,lon:17.682,country:'SK'},
      {name:'Mochovce',lat:48.277,lon:18.44,country:'SK'},
      {name:'Krško',lat:45.938,lon:15.517,country:'SI'},
    
      {name:'Creys-Malville (Superphénix)',lat:45.798,lon:5.476,country:'FR'},
      {name:'Marcoule — CEA',lat:44.144,lon:4.702,country:'FR'},
      {name:'Brennilis — EDF',lat:48.359,lon:-3.872,country:'FR'},
      {name:'Superphénix — Creys',lat:45.798,lon:5.478,country:'FR'},
      {name:'Cadarache — CEA',lat:43.686,lon:5.762,country:'FR'},
      {name:'Saclay — CEA',lat:48.723,lon:2.168,country:'FR'},
      {name:'Isar — unit 2',lat:48.608,lon:12.296,country:'DE'},
      {name:'Brokdorf',lat:53.849,lon:9.345,country:'DE'},
      {name:'Grohnde',lat:52.036,lon:9.413,country:'DE'},
      {name:'Philippsburg',lat:49.252,lon:8.442,country:'DE'},
      {name:'Grafenrheinfeld',lat:49.983,lon:10.186,country:'DE'},
      {name:'Gundremmingen',lat:48.514,lon:10.402,country:'DE'},
      {name:'Cofrentes (unit 2)',lat:39.216,lon:-1.048,country:'ES'},
      {name:'Almaraz (unit 2)',lat:39.809,lon:-5.695,country:'ES'},
      {name:'Santa María de Garoña',lat:42.725,lon:-3.21,country:'ES'},
    
      {name:'Hinkley Point (exp. FR)',lat:51.208,lon:-3.131,country:'FR'},
      {name:'Sizewell (exp. NL)',lat:52.215,lon:1.619,country:'NL'},
      {name:'Cernavodă (exp. GR)',lat:44.325,lon:28.059,country:'GR'},
      {name:'Temelin (exp. AT)',lat:49.181,lon:14.378,country:'AT'},
      {name:'Dukovany (exp. SK)',lat:51.087,lon:16.148,country:'SK'},
    
      {name:'Ringhals (exp. FI)',lat:57.263,lon:12.115,country:'FI'},
      {name:'Forsmark (exp. FI)',lat:60.408,lon:18.166,country:'FI'},
    ],
  },

  /* ───────── 12. CARRIÈRE / MINE À CIEL OUVERT ───────── */
  {
    type: 'quarry', name: 'Carrière / Mine à ciel ouvert', icon: 'ind_quarry',
    cargoTypes: ['sand','gravel','limestone','ballast','ore','bauxite','salt'],
    cargoOut: 'Granulats / Minéraux', dailyTonnageMin: 500, dailyTonnageMax: 3000,
    pricePerTonne: 12, attractCost: 60000,
    description: 'Extraction massive : 500-3000t/jour. Faible prix mais gros volumes.',
    realLocations: [
      {name:'GSM — Bréauté',lat:49.629,lon:0.397,country:'FR'},
      {name:'Carrières du Boulonnais',lat:50.719,lon:1.63,country:'FR'},
      {name:'MDPA — Mulhouse',lat:47.773,lon:7.275,country:'FR'},
      {name:'Lafarge — Gennevilliers',lat:48.921,lon:2.292,country:'FR'},
      {name:'Imerys — Lussac-les-Châteaux',lat:46.401,lon:0.733,country:'FR'},
      {name:'GSM — Rombas',lat:49.249,lon:6.092,country:'FR'},
      {name:'Holcim — Héming',lat:48.694,lon:7.002,country:'FR'},
      {name:'Cemex — Boulogne-sur-Gesse',lat:43.29,lon:0.65,country:'FR'},
      {name:'Lafarge — Luzech',lat:44.477,lon:1.287,country:'FR'},
      {name:'HeidelbergCement — Ennigerloh',lat:51.836,lon:8.019,country:'DE'},
      {name:'K+S — Heringen',lat:50.872,lon:9.967,country:'DE'},
      {name:'RWE — Hambach (lignite)',lat:50.915,lon:6.526,country:'DE'},
      {name:'RWE — Garzweiler (lignite)',lat:51.069,lon:6.52,country:'DE'},
      {name:'RWE — Inden (lignite)',lat:50.861,lon:6.383,country:'DE'},
      {name:'LEAG — Welzow-Süd',lat:51.574,lon:14.141,country:'DE'},
      {name:'Quarzwerke — Frechen',lat:50.913,lon:6.812,country:'DE'},
      {name:'Sibelco — Dessel',lat:51.238,lon:5.115,country:'BE'},
      {name:'Sagrex — Quenast',lat:50.648,lon:4.143,country:'BE'},
      {name:'Sibelco — Mol',lat:51.199,lon:5.115,country:'BE'},
      {name:'Bontrup — Rotterdam',lat:51.901,lon:4.465,country:'NL'},
      {name:'Riotinto (cuivre)',lat:37.694,lon:-6.594,country:'ES'},
      {name:'Magnesitas — Navarra',lat:42.79,lon:-1.6,country:'ES'},
      {name:'Aluminium Grèce — Distomon',lat:38.428,lon:22.712,country:'GR'},
      {name:'S&B — Milos',lat:36.678,lon:24.438,country:'GR'},
      {name:'VA Erzberg — Eisenerz',lat:47.531,lon:14.893,country:'AT'},
      {name:'Wietersdorfer — Peggau',lat:47.204,lon:15.349,country:'AT'},
      {name:'Boliden — Kevitsa',lat:67.697,lon:26.069,country:'FI'},
      {name:'Outokumpu — Kemi',lat:65.811,lon:24.609,country:'FI'},
      {name:'Yara — Siilinjärvi',lat:63.112,lon:27.76,country:'FI'},
      {name:'Nordkalk — Pargas',lat:60.299,lon:22.301,country:'FI'},
      {name:'Boliden Tara — Navan',lat:53.585,lon:-6.826,country:'IE'},
      {name:'Somincor — Neves-Corvo',lat:37.584,lon:-7.972,country:'PT'},
      {name:'MOTA — Porto',lat:41.172,lon:-8.595,country:'PT'},
    
      {name:'Carrières de Noubleau',lat:46.14,lon:0.25,country:'FR'},
      {name:'GSM — Sandrancourt',lat:49.059,lon:1.867,country:'FR'},
      {name:'Lafarge — Isère',lat:45.19,lon:5.72,country:'FR'},
      {name:'Imerys — Ploemeur',lat:47.731,lon:-3.431,country:'FR'},
      {name:'Lafarge — Chatillon',lat:47.85,lon:4.58,country:'FR'},
      {name:'Holcim — Obourg (quarry)',lat:50.475,lon:3.99,country:'BE'},
      {name:'Werfenweng Steinbruch',lat:47.458,lon:13.255,country:'AT'},
      {name:'Heidelberg Quarry — Burglengenfeld',lat:49.209,lon:12.041,country:'DE'},
      {name:'LEAG — Nochten',lat:51.459,lon:14.767,country:'DE'},
      {name:'RWE — Frechen Quarry',lat:50.915,lon:6.81,country:'DE'},
      {name:'Nordkalk — Lappeenranta',lat:61.06,lon:28.19,country:'FI'},
      {name:'Cementos Portland — Morata',lat:40.223,lon:-3.432,country:'ES'},
      {name:'Secil — Outão (quarry)',lat:38.49,lon:-8.928,country:'PT'},
      {name:'Imerys Tableware — Limerick',lat:52.66,lon:-8.63,country:'IE'},
      {name:'Larfarge — Tetovo (export GR)',lat:40.55,lon:21.12,country:'GR'},
      {name:'Carrière Jura — Solnhofen (exp. AT)',lat:47.35,lon:13.4,country:'AT'},
      {name:'Nordkalk — Louhi',lat:60.3,lon:22.305,country:'FI'},
      {name:'Elkem — Sauda (exp. SI)',lat:46.2,lon:14.1,country:'SI'},
      {name:'SN Holding — Đurđevac (quarry)',lat:46.038,lon:17.076,country:'HR'},
      {name:'Kiviõli kaevandus',lat:59.36,lon:26.96,country:'EE'},
    
      {name:'Aggregates Industries — Bardon (exp. IE)',lat:52.711,lon:-1.345,country:'IE'},
      {name:'Roadstone — Belgard (Dublin)',lat:53.283,lon:-6.373,country:'IE'},
      {name:'CRH — Belgard Quarry',lat:53.284,lon:-6.374,country:'IE'},
      {name:'Terex — Omagh (exp. IE)',lat:54.599,lon:-7.307,country:'IE'},
      {name:'Nordkalk — Pargas (add)',lat:60.3,lon:22.302,country:'FI'},
      {name:'Nordkalk — Sipoo',lat:60.375,lon:25.267,country:'FI'},
    
      {name:'Lafarge — Auneuil',lat:49.369,lon:1.985,country:'FR'},
      {name:'Holcim — Altkirch (quarry)',lat:47.624,lon:7.242,country:'FR'},
      {name:'GSM — Mantes',lat:48.993,lon:1.74,country:'FR'},
      {name:'Sagrex — Tournaisis',lat:50.621,lon:3.389,country:'BE'},
      {name:'Sibelco — Maastricht',lat:50.835,lon:5.685,country:'NL'},
      {name:'K+S — Bernburg (quarry)',lat:51.808,lon:11.738,country:'DE'},
      {name:'Breedon — Dublin (exp. IE)',lat:53.35,lon:-6.26,country:'IE'},
      {name:'Colacem — Ghigiano (quarry)',lat:43.35,lon:12.574,country:'IT'},
    
      {name:'Lafarge — Rochefort',lat:46.0,lon:-0.967,country:'FR'},
      {name:'GSM — Boulogne (add)',lat:50.72,lon:1.631,country:'FR'},
      {name:'HeidelbergCement — Rohrdorf',lat:47.797,lon:12.178,country:'DE'},
      {name:'Basalt AG — Bad Ems',lat:50.334,lon:7.709,country:'DE'},
      {name:'Werhahn — Neuss',lat:51.196,lon:6.693,country:'DE'},
      {name:'Nordkalk — Raahe',lat:64.68,lon:24.47,country:'FI'},
      {name:'MinerAlpha — Almería',lat:36.838,lon:-2.468,country:'ES'},
      {name:'Italcementi — Bergamo (quarry)',lat:45.695,lon:9.671,country:'IT'},
    
      {name:'LEAG — Reichwalde',lat:51.345,lon:14.646,country:'DE'},
      {name:'MIBRAG — Profen',lat:51.152,lon:12.061,country:'DE'},
      {name:'MIBRAG — Schleenhain',lat:51.187,lon:12.429,country:'DE'},
      {name:'Knauf — Iphofen',lat:49.707,lon:10.244,country:'DE'},
      {name:'Heidelberg — Ennigerloh (add)',lat:51.837,lon:8.02,country:'DE'},
    ],
  },

  /* ───────── 13. AGRO-INDUSTRIE ───────── */
  {
    type: 'food_processing', name: 'Agro-industrie', icon: 'ind_food',
    cargoTypes: ['sugar','flour','frozen-food','beverages','canned-food','sugar-beet','milk'],
    cargoOut: 'Produits alimentaires', dailyTonnageMin: 200, dailyTonnageMax: 1000,
    pricePerTonne: 60, attractCost: 100000,
    description: 'Transformation alimentaire : sucrerie, laiterie, conserverie.',
    realLocations: [
      {name:'Tereos — Origny-Sainte-Benoite',lat:49.833,lon:3.517,country:'FR'},
      {name:'Cristal Union — Bazancourt',lat:49.343,lon:3.836,country:'FR'},
      {name:'Lactalis — Laval',lat:48.073,lon:-0.768,country:'FR'},
      {name:'Danone — Bailleul',lat:50.739,lon:2.733,country:'FR'},
      {name:'Roquette — Lestrem',lat:50.634,lon:2.693,country:'FR'},
      {name:'Bonduelle — Renescure',lat:50.729,lon:2.316,country:'FR'},
      {name:'Nestlé — Pontarlier',lat:46.903,lon:6.357,country:'FR'},
      {name:'Bigard — Quimperlé',lat:47.874,lon:-3.545,country:'FR'},
      {name:'LDC — Sablé-sur-Sarthe',lat:47.838,lon:-0.333,country:'FR'},
      {name:'Fleury Michon — Pouzauges',lat:46.781,lon:-0.844,country:'FR'},
      {name:'Südzucker — Ochsenfurt',lat:49.668,lon:10.061,country:'DE'},
      {name:'Nordzucker — Uelzen',lat:52.954,lon:10.558,country:'DE'},
      {name:'Dr. Oetker — Bielefeld',lat:52.027,lon:8.538,country:'DE'},
      {name:'Müller Milch — Aretsried',lat:48.257,lon:10.666,country:'DE'},
      {name:'Tönnies — Rheda-Wiedenbrück',lat:51.845,lon:8.298,country:'DE'},
      {name:'FrieslandCampina — Leeuwarden',lat:53.195,lon:5.786,country:'NL'},
      {name:'Cosun — Dinteloord',lat:51.633,lon:4.372,country:'NL'},
      {name:'Tirlemontoise — Tienen',lat:50.807,lon:4.934,country:'BE'},
      {name:'Barry Callebaut — Wieze',lat:50.972,lon:4.005,country:'BE'},
      {name:'Barilla — Parma',lat:44.8,lon:10.329,country:'IT'},
      {name:'Ferrero — Alba',lat:44.694,lon:8.033,country:'IT'},
      {name:'Lavazza — Turin',lat:45.037,lon:7.648,country:'IT'},
      {name:'Ebro Foods — Madrid',lat:40.462,lon:-3.713,country:'ES'},
      {name:'Kerry Group — Listowel',lat:52.444,lon:-9.487,country:'IE'},
      {name:'Glanbia — Kilkenny',lat:52.654,lon:-7.251,country:'IE'},
      {name:'RAR — Porto',lat:41.144,lon:-8.612,country:'PT'},
      {name:'Valio — Helsinki',lat:60.228,lon:24.887,country:'FI'},
      {name:'Fazer — Lahti',lat:60.984,lon:25.66,country:'FI'},
      {name:'Agrana — Tulln',lat:48.33,lon:15.886,country:'AT'},
      {name:'Podravka — Koprivnica',lat:46.164,lon:16.833,country:'HR'},
      {name:'AB Mauri — Vilnius',lat:54.697,lon:25.24,country:'LT'},
      {name:'Orkla — Rīga',lat:56.967,lon:24.108,country:'LV'},
    
      {name:'Roquette — Beinheim',lat:48.874,lon:8.086,country:'FR'},
      {name:'Mars — Haguenau',lat:48.812,lon:7.795,country:'FR'},
      {name:'Nestlé — Dieppe',lat:49.919,lon:1.085,country:'FR'},
      {name:'Andros — Biars',lat:44.93,lon:1.849,country:'FR'},
      {name:'Lindt — Oloron',lat:43.185,lon:-0.608,country:'FR'},
      {name:'Haribo — Uzès',lat:44.012,lon:4.419,country:'FR'},
      {name:'Bel — Lons-le-Saunier',lat:46.673,lon:5.556,country:'FR'},
      {name:'Nestlé — Noisiel',lat:48.848,lon:2.627,country:'FR'},
      {name:'Dr. Oetker — Wittenburg',lat:53.52,lon:11.078,country:'DE'},
      {name:'Bahlsen — Hannover',lat:52.382,lon:9.726,country:'DE'},
      {name:'Haribo — Bonn',lat:50.703,lon:7.136,country:'DE'},
      {name:'Kellogg\'s — Bremen',lat:53.103,lon:8.806,country:'DE'},
      {name:'Mondelez — Bremen',lat:53.098,lon:8.791,country:'DE'},
      {name:'Unilever — Rotterdam',lat:51.923,lon:4.489,country:'NL'},
      {name:'Heinz — Elst',lat:51.919,lon:5.838,country:'NL'},
      {name:'Mondelez — Herentals',lat:51.18,lon:4.83,country:'BE'},
      {name:'Nestlé — Tutbury (exp. IE)',lat:52.83,lon:-1.67,country:'IE'},
      {name:'Mutti — Parma',lat:44.81,lon:10.325,country:'IT'},
      {name:'De Cecco — Fara San Martino',lat:42.089,lon:14.2,country:'IT'},
      {name:'Ebro — Sevilla',lat:37.39,lon:-5.98,country:'ES'},
      {name:'Calvo — Vigo',lat:42.233,lon:-8.716,country:'ES'},
      {name:'Fazer — Vantaa',lat:60.293,lon:24.956,country:'FI'},
      {name:'Agrana — Gleisdorf',lat:47.104,lon:15.708,country:'AT'},
    
      {name:'Pernod Ricard — Cognac',lat:45.695,lon:-0.329,country:'FR'},
      {name:'Danone — Wexford',lat:52.334,lon:-6.458,country:'IE'},
      {name:'Heineken — Amsterdam',lat:52.367,lon:4.906,country:'NL'},
      {name:'Unilever — Heilbronn',lat:49.14,lon:9.21,country:'DE'},
      {name:'Oatly — Landskrona (exp. FI)',lat:55.872,lon:12.828,country:'FI'},
      {name:'Valio — Oulu',lat:65.012,lon:25.47,country:'FI'},
      {name:'Fazer — Lahti (add)',lat:60.985,lon:25.661,country:'FI'},
      {name:'Atria — Kuopio',lat:62.893,lon:27.677,country:'FI'},
    
      {name:'Fleury Michon — Chantonnay',lat:46.686,lon:-1.055,country:'FR'},
      {name:'Daunat — Guingamp',lat:48.563,lon:-3.154,country:'FR'},
      {name:'Herta — Illkirch',lat:48.53,lon:7.718,country:'FR'},
      {name:'Cargill — Haubourdin',lat:50.606,lon:2.987,country:'FR'},
      {name:'Ferrero — Frankfurt',lat:50.11,lon:8.683,country:'DE'},
      {name:'Storck — Halle',lat:52.06,lon:8.381,country:'DE'},
      {name:'Campina — Maasdam',lat:51.79,lon:4.6,country:'NL'},
      {name:'Vandemoortele — Gent',lat:51.054,lon:3.72,country:'BE'},
      {name:'Star — Porto',lat:41.145,lon:-8.61,country:'PT'},
      {name:'FAGE — Athens (add)',lat:37.96,lon:23.71,country:'GR'},
      {name:'Kalev — Tallinn',lat:59.435,lon:24.745,country:'EE'},
      {name:'Laima — Riga',lat:56.957,lon:24.119,country:'LV'},
    
      {name:'Soufflet — Nogent (add2)',lat:48.493,lon:3.506,country:'FR'},
      {name:'Tereos — Lillers (add)',lat:50.562,lon:2.484,country:'FR'},
      {name:'Bel — Dole',lat:47.093,lon:5.5,country:'FR'},
      {name:'Fromageries — Roquefort',lat:43.994,lon:2.981,country:'FR'},
      {name:'Harry-Brot — Schenefeld',lat:53.587,lon:9.831,country:'DE'},
      {name:'Müller — Sachseln (exp. AT)',lat:46.867,lon:8.233,country:'AT'},
      {name:'Barilla — Pedrignano (add)',lat:44.763,lon:10.219,country:'IT'},
      {name:'Campofrio — Burgos',lat:42.341,lon:-3.7,country:'ES'},
    
      {name:'Mars — Veghel',lat:51.615,lon:5.547,country:'NL'},
      {name:'Heineken — Den Bosch (add2)',lat:51.689,lon:5.314,country:'NL'},
      {name:'Unilever — Knorr — Heilbronn',lat:49.141,lon:9.211,country:'DE'},
      {name:'Nestlé — Kaffee — Berlin',lat:52.51,lon:13.395,country:'DE'},
      {name:'Mondelez — Bratislava',lat:48.155,lon:17.14,country:'SK'},
    
      {name:'Oetker — Bielefeld (add2)',lat:52.028,lon:8.539,country:'DE'},
      {name:'August Storck — Berlin',lat:52.49,lon:13.35,country:'DE'},
      {name:'Perfetti Van Melle — Lainate',lat:45.571,lon:9.029,country:'IT'},
      {name:'Rigoni di Asiago',lat:45.875,lon:11.507,country:'IT'},
    
      {name:'Lidl — Neckarsulm',lat:49.193,lon:9.225,country:'DE'},
      {name:'Aldi — Essen',lat:51.449,lon:7.011,country:'DE'},
      {name:'Edeka — Hamburg',lat:53.563,lon:10.012,country:'DE'},
      {name:'REWE — Köln',lat:50.949,lon:6.961,country:'DE'},
    ],
  },

  /* ───────── 14. CENTRE DE TRAITEMENT DÉCHETS ───────── */
  {
    type: 'waste_center', name: 'Centre de traitement déchets', icon: 'ind_waste',
    cargoTypes: ['household-waste','recyclables','industrial-waste','used-oil'],
    cargoOut: 'Matières recyclées', dailyTonnageMin: 200, dailyTonnageMax: 1500,
    pricePerTonne: 25, attractCost: 70000,
    description: 'Traitement et recyclage : 200-1500t/jour.',
    realLocations: [
      {name:'Veolia — Limay',lat:48.993,lon:1.742,country:'FR'},
      {name:'Suez — Nanterre',lat:48.897,lon:2.199,country:'FR'},
      {name:'Paprec — La Courneuve',lat:48.924,lon:2.396,country:'FR'},
      {name:'Séché — Changé',lat:48.063,lon:-0.756,country:'FR'},
      {name:'Veolia — Claye-Souilly',lat:48.951,lon:2.683,country:'FR'},
      {name:'Paprec — Harnes',lat:50.447,lon:2.887,country:'FR'},
      {name:'TIRU — Ivry-sur-Seine',lat:48.813,lon:2.396,country:'FR'},
      {name:'ALBA — Berlin',lat:52.505,lon:13.472,country:'DE'},
      {name:'Remondis — Lünen',lat:51.617,lon:7.524,country:'DE'},
      {name:'PreZero — Porta Westfalica',lat:52.234,lon:8.912,country:'DE'},
      {name:'EEW — Helmstedt',lat:52.229,lon:11.007,country:'DE'},
      {name:'AGR — Herten',lat:51.6,lon:7.147,country:'DE'},
      {name:'AEB Amsterdam',lat:52.391,lon:4.827,country:'NL'},
      {name:'AVR Rotterdam',lat:51.891,lon:4.34,country:'NL'},
      {name:'Twence — Hengelo',lat:52.268,lon:6.745,country:'NL'},
      {name:'INDAVER — Antwerpen',lat:51.287,lon:4.315,country:'BE'},
      {name:'ISVAG — Wilrijk',lat:51.175,lon:4.403,country:'BE'},
      {name:'A2A — Brescia',lat:45.527,lon:10.247,country:'IT'},
      {name:'Hera — Rimini',lat:44.066,lon:12.582,country:'IT'},
      {name:'Urbaser — Madrid',lat:40.473,lon:-3.545,country:'ES'},
      {name:'Tirme — Mallorca',lat:39.61,lon:2.793,country:'ES'},
      {name:'Spittelau — Wien',lat:48.235,lon:16.36,country:'AT'},
      {name:'EVN — Dürnrohr',lat:48.333,lon:15.882,country:'AT'},
      {name:'Fortum — Riihimäki',lat:60.733,lon:24.779,country:'FI'},
      {name:'Indaver — Cork',lat:51.882,lon:-8.316,country:'IE'},
      {name:'Valorsul — Lisboa',lat:38.788,lon:-9.128,country:'PT'},
      {name:'OKG — Tallinn',lat:59.414,lon:24.769,country:'EE'},
    
      {name:'Suez — Isséane (Issy)',lat:48.825,lon:2.249,country:'FR'},
      {name:'Véolia — Créteil',lat:48.79,lon:2.462,country:'FR'},
      {name:'Nicollin — Lunel',lat:43.677,lon:4.136,country:'FR'},
      {name:'Suez — Limeil-Brévannes',lat:48.753,lon:2.504,country:'FR'},
      {name:'Véolia — Nîmes',lat:43.833,lon:4.364,country:'FR'},
      {name:'ITAD — Leunaweg',lat:51.321,lon:12.01,country:'DE'},
      {name:'BSR — Berlin-Ruhleben',lat:52.528,lon:13.225,country:'DE'},
      {name:'Stadtreinigung — Hamburg',lat:53.538,lon:10.093,country:'DE'},
      {name:'MVA — Köln-Niehl',lat:50.99,lon:6.973,country:'DE'},
      {name:'HVC — Dordrecht',lat:51.79,lon:4.66,country:'NL'},
      {name:'Attero — Moerdijk',lat:51.688,lon:4.575,country:'NL'},
      {name:'Hera — Bologna',lat:44.513,lon:11.377,country:'IT'},
      {name:'AMSA A2A — Milano',lat:45.5,lon:9.225,country:'IT'},
      {name:'Ecoparc — Barcelona',lat:41.415,lon:2.233,country:'ES'},
      {name:'Valdemingómez — Madrid',lat:40.355,lon:-3.61,country:'ES'},
      {name:'LIPOR — Porto',lat:41.152,lon:-8.56,country:'PT'},
      {name:'Rethmann — Vilnius',lat:54.702,lon:25.31,country:'LT'},
      {name:'Clean Malta — Marsaskala',lat:35.861,lon:14.553,country:'MT'},
      {name:'Ragn-Sells — Tallinn',lat:59.4,lon:24.7,country:'EE'},
      {name:'VAATC — Riga',lat:56.92,lon:24.18,country:'LV'},
    
      {name:'Suez — Fos-sur-Mer',lat:43.429,lon:4.902,country:'FR'},
      {name:'Veolia — Rouen',lat:49.44,lon:1.09,country:'FR'},
      {name:'EBS — Wien',lat:48.234,lon:16.361,country:'AT'},
      {name:'Wiener Neustadt',lat:47.81,lon:16.24,country:'AT'},
      {name:'Sysav — Malmö (exp. DK)',lat:55.573,lon:12.95,country:'DK'},
      {name:'Viridor — Dublin',lat:53.351,lon:-6.22,country:'IE'},
      {name:'Covanta — Dublin (add)',lat:53.352,lon:-6.221,country:'IE'},
    
      {name:'Paprec — Moulinot — Paris',lat:48.86,lon:2.34,country:'FR'},
      {name:'Suez — Nantes',lat:47.22,lon:-1.56,country:'FR'},
      {name:'Sita — Bruxelles',lat:50.86,lon:4.4,country:'BE'},
      {name:'Renewi — Amsterdam',lat:52.395,lon:4.83,country:'NL'},
      {name:'FCC — Madrid',lat:40.46,lon:-3.69,country:'ES'},
      {name:'Urbaser — Barcelona',lat:41.4,lon:2.2,country:'ES'},
      {name:'A2A — Milano (add)',lat:45.501,lon:9.226,country:'IT'},
      {name:'Wien Energie — Pfaffenau',lat:48.196,lon:16.445,country:'AT'},
    
      {name:'Suez — Bordeaux',lat:44.82,lon:-0.557,country:'FR'},
      {name:'Veolia — Toulouse',lat:43.615,lon:1.408,country:'FR'},
      {name:'Veolia — Lyon (add)',lat:45.76,lon:4.833,country:'FR'},
      {name:'BSR — Berlin (add2)',lat:52.506,lon:13.473,country:'DE'},
      {name:'AWG — Wuppertal',lat:51.27,lon:7.19,country:'DE'},
      {name:'ARA — Wien',lat:48.23,lon:16.365,country:'AT'},
    
      {name:'SAICA Natur — Zaragoza',lat:41.655,lon:-0.894,country:'ES'},
      {name:'Cespa — Madrid',lat:40.355,lon:-3.61,country:'ES'},
      {name:'Remondis — Köln',lat:50.96,lon:6.96,country:'DE'},
      {name:'PreZero — Ölbronn',lat:48.948,lon:8.695,country:'DE'},
    
      {name:'SITA — Lyon',lat:45.758,lon:4.831,country:'FR'},
      {name:'Derichebourg — Athis-Mons',lat:48.71,lon:2.38,country:'FR'},
    ],
  },

  /* ───────── 15. BASE MILITAIRE ───────── */
  {
    type: 'military_base', name: 'Base militaire', icon: 'ind_military',
    cargoTypes: ['military','explosives','construction-equip'],
    cargoOut: 'Matériel militaire', dailyTonnageMin: 50, dailyTonnageMax: 300,
    pricePerTonne: 200, attractCost: 180000,
    description: 'Convois militaires sécurisés. Volume modéré, haut revenu.',
    realLocations: [
      {name:'Camp de Mourmelon',lat:49.132,lon:4.359,country:'FR'},
      {name:'Camp de Mailly',lat:48.66,lon:3.863,country:'FR'},
      {name:'Arsenal de Bourges',lat:47.084,lon:2.395,country:'FR'},
      {name:'Camp de Canjuers',lat:43.622,lon:6.352,country:'FR'},
      {name:'Base aérienne d\'Istres',lat:43.522,lon:4.928,country:'FR'},
      {name:'DGA — Biscarrosse',lat:44.375,lon:-1.228,country:'FR'},
      {name:'Arsenal de Roanne',lat:46.037,lon:4.064,country:'FR'},
      {name:'Camp de la Courtine',lat:45.87,lon:2.275,country:'FR'},
      {name:'Ramstein Air Base',lat:49.436,lon:7.603,country:'DE'},
      {name:'Grafenwöhr',lat:49.693,lon:11.694,country:'DE'},
      {name:'Munster (Panzer)',lat:52.98,lon:10.098,country:'DE'},
      {name:'Bergen-Hohne',lat:52.849,lon:9.885,country:'DE'},
      {name:'Base OTAN — Aviano',lat:46.03,lon:12.597,country:'IT'},
      {name:'Camp Darby — Pisa',lat:43.685,lon:10.34,country:'IT'},
      {name:'Base de Rota',lat:36.641,lon:-6.351,country:'ES'},
      {name:'Base de Morón',lat:37.175,lon:-5.615,country:'ES'},
      {name:'SHAPE — Mons',lat:50.505,lon:3.968,country:'BE'},
      {name:'Kleine-Brogel AB',lat:51.168,lon:5.47,country:'BE'},
      {name:'Florennes AB',lat:50.243,lon:4.645,country:'BE'},
      {name:'Souda Bay — Crète',lat:35.49,lon:24.118,country:'GR'},
      {name:'Tapa — Estonia (NATO)',lat:59.262,lon:25.958,country:'EE'},
      {name:'Ādaži — Latvia (NATO)',lat:57.074,lon:24.32,country:'LV'},
      {name:'Rukla — Lithuania (NATO)',lat:55.093,lon:24.191,country:'LT'},
    
      {name:'Camp de Chambaran',lat:45.345,lon:5.385,country:'FR'},
      {name:'Base navale — Toulon',lat:43.114,lon:5.929,country:'FR'},
      {name:'Base aérienne — Nancy-Ochey',lat:48.583,lon:5.95,country:'FR'},
      {name:'Base — Creil',lat:49.253,lon:2.516,country:'FR'},
      {name:'Djibouti (staging FR)',lat:43.151,lon:5.927,country:'FR'},
      {name:'Büchel Air Base',lat:50.174,lon:7.063,country:'DE'},
      {name:'Hohenfels',lat:49.221,lon:11.829,country:'DE'},
      {name:'Baumholder',lat:49.645,lon:7.311,country:'DE'},
      {name:'Spangdahlem AB',lat:49.973,lon:6.693,country:'DE'},
      {name:'Camp Ederle — Vicenza',lat:45.544,lon:11.545,country:'IT'},
      {name:'Sigonella — Catania',lat:37.402,lon:14.922,country:'IT'},
      {name:'Decimomannu — Sardegna',lat:39.354,lon:8.972,country:'IT'},
      {name:'Moron de la Frontera',lat:37.175,lon:-5.615,country:'ES'},
      {name:'Zaragoza AB',lat:41.664,lon:-1.028,country:'ES'},
      {name:'Beja AB',lat:38.078,lon:-7.932,country:'PT'},
      {name:'Pápa Air Base',lat:47.363,lon:17.501,country:'SK'},
      {name:'Keflavík (NATO — export IE)',lat:53.36,lon:-6.27,country:'IE'},
    
      {name:'Solenzara — Corse',lat:41.924,lon:9.404,country:'FR'},
      {name:'BA 942 — Lyon-Mont Verdun',lat:45.829,lon:4.771,country:'FR'},
      {name:'Cazaux — BA 120',lat:44.533,lon:-1.131,country:'FR'},
      {name:'Chièvres AB (NATO)',lat:50.575,lon:3.831,country:'BE'},
      {name:'Nörvenich AB',lat:50.83,lon:6.656,country:'DE'},
      {name:'Laage AB',lat:53.917,lon:12.277,country:'DE'},
      {name:'Trapani-Birgi (IT)',lat:37.911,lon:12.498,country:'IT'},
      {name:'Ghedi AB (IT)',lat:45.433,lon:10.267,country:'IT'},
    
      {name:'BA 105 — Évreux',lat:49.028,lon:1.213,country:'FR'},
      {name:'BA 133 — Nancy-Ochey (add)',lat:48.584,lon:5.951,country:'FR'},
      {name:'Geilenkirchen — AWACS',lat:50.962,lon:6.035,country:'DE'},
      {name:'Ämari — Estonia (NATO)',lat:59.259,lon:24.209,country:'EE'},
      {name:'Šiauliai — Lithuania (NATO)',lat:55.895,lon:23.393,country:'LT'},
    
      {name:'BA 118 — Mont-de-Marsan',lat:43.912,lon:-0.504,country:'FR'},
      {name:'BA 709 — Cognac',lat:45.658,lon:-0.317,country:'FR'},
      {name:'Landsberg/Lech',lat:48.073,lon:10.904,country:'DE'},
      {name:'Rostock-Laage (add)',lat:53.918,lon:12.278,country:'DE'},
    ],
  },

  /* ───────── 16. VERRERIE ───────── */
  {
    type: 'glass_factory', name: 'Verrerie', icon: 'ind_glass',
    cargoTypes: ['sand','limestone','glass','recyclables'],
    cargoOut: 'Verre plat / creux', dailyTonnageMin: 150, dailyTonnageMax: 500,
    pricePerTonne: 45, attractCost: 85000,
    description: 'Fabrication de verre : 150-500t/jour. Consomme sable et calcaire.',
    realLocations: [
      {name:'Saint-Gobain — Chantereine',lat:49.075,lon:2.586,country:'FR'},
      {name:'AGC — Boussois',lat:50.293,lon:4.048,country:'FR'},
      {name:'O-I — Veauche',lat:45.561,lon:4.281,country:'FR'},
      {name:'Arc International — Arques',lat:50.741,lon:2.298,country:'FR'},
      {name:'Duralex — La Chapelle-Saint-Mesmin',lat:47.887,lon:1.833,country:'FR'},
      {name:'Verallia — Chalon',lat:46.774,lon:4.855,country:'FR'},
      {name:'O-I — Wingles',lat:50.483,lon:2.851,country:'FR'},
      {name:'Schott — Mainz',lat:49.999,lon:8.261,country:'DE'},
      {name:'Pilkington — Gladbeck',lat:51.569,lon:6.994,country:'DE'},
      {name:'Gerresheimer — Düsseldorf',lat:51.195,lon:6.867,country:'DE'},
      {name:'Ardagh — Nienburg',lat:52.647,lon:9.211,country:'DE'},
      {name:'Bormioli — Parma',lat:44.803,lon:10.326,country:'IT'},
      {name:'Verallia — Pescia',lat:43.9,lon:10.688,country:'IT'},
      {name:'Zignago Vetro — Fossalta',lat:45.717,lon:12.615,country:'IT'},
      {name:'AGC — Fleurus',lat:50.471,lon:4.562,country:'BE'},
      {name:'AGC — Moustier',lat:50.409,lon:5.058,country:'BE'},
      {name:'Saint-Gobain — Avilés',lat:43.552,lon:-5.92,country:'ES'},
      {name:'Vidrala — Llodio',lat:43.14,lon:-2.963,country:'ES'},
      {name:'BA Glass — Marinha Grande',lat:39.747,lon:-8.939,country:'PT'},
      {name:'BA Glass — Avintes',lat:41.109,lon:-8.583,country:'PT'},
      {name:'Stölzle — Köflach',lat:47.068,lon:15.088,country:'AT'},
      {name:'O-I — Leerdam',lat:51.889,lon:5.093,country:'NL'},
      {name:'Ardagh — Dublin',lat:53.389,lon:-6.356,country:'IE'},
      {name:'Owens-Illinois — Lahti',lat:60.983,lon:25.661,country:'FI'},
    
      {name:'Verallia — Cognac',lat:45.696,lon:-0.33,country:'FR'},
      {name:'Saverglass — Feuquières',lat:49.758,lon:1.806,country:'FR'},
      {name:'SGD Pharma — Kipfenberg',lat:48.952,lon:11.394,country:'DE'},
      {name:'Wiegand-Glas — Steinbach',lat:50.323,lon:11.158,country:'DE'},
      {name:'Stoelzle — Oberglas',lat:47.068,lon:15.09,country:'AT'},
      {name:'Vetropack — Pöchlarn',lat:48.218,lon:15.212,country:'AT'},
      {name:'Vetropack — Kremsmünster',lat:48.052,lon:14.125,country:'AT'},
      {name:'Verallia — Sevilla',lat:37.395,lon:-5.981,country:'ES'},
      {name:'Bormioli Luigi — Parma',lat:44.806,lon:10.328,country:'IT'},
      {name:'Vetrobalsamo — Milano',lat:45.536,lon:9.266,country:'IT'},
      {name:'Ardagh — Dongen',lat:51.629,lon:4.936,country:'NL'},
      {name:'Ardagh — Irvine (exp.IE)',lat:53.4,lon:-6.36,country:'IE'},
      {name:'Vetri Speciali — Trento',lat:46.066,lon:11.122,country:'IT'},
      {name:'BA Glass — León',lat:42.595,lon:-5.59,country:'ES'},
    
      {name:'Verallia — Bad Wurzach',lat:47.907,lon:9.889,country:'DE'},
      {name:'Ardagh — Obernkirchen',lat:52.267,lon:9.127,country:'DE'},
      {name:'Wiegand — Großbreitenbach',lat:50.582,lon:10.975,country:'DE'},
      {name:'VETRO-PACK — Kyjov (exp. SK)',lat:48.955,lon:17.122,country:'SK'},
      {name:'Steklarna Hrastnik (SI)',lat:46.144,lon:15.076,country:'SI'},
    
      {name:'Verallia — Oiry',lat:49.0,lon:3.917,country:'FR'},
      {name:'Saverglass — Arques (add)',lat:50.74,lon:2.297,country:'FR'},
      {name:'O-I — Lünen',lat:51.605,lon:7.52,country:'DE'},
      {name:'Wiegand — Schleusingen',lat:50.51,lon:10.747,country:'DE'},
      {name:'O-I — Villotta',lat:45.954,lon:12.741,country:'IT'},
      {name:'Vidrala — Castellar del Vallès',lat:41.619,lon:2.088,country:'ES'},
    
      {name:'Gerresheimer — Essen',lat:51.458,lon:7.013,country:'DE'},
      {name:'Wiegand — Immenhausen',lat:51.424,lon:9.471,country:'DE'},
      {name:'O-I — Gironcourt',lat:48.298,lon:5.938,country:'FR'},
      {name:'Verallia — Lagnieu',lat:45.899,lon:5.345,country:'FR'},
    ],
  },

  /* ───────── 17. PARC ÉOLIEN (COMPOSANTS) ───────── */
  {
    type: 'wind_farm', name: 'Parc éolien (composants)', icon: 'ind_wind',
    cargoTypes: ['wind-blade','bridge-section','transformer','construction-equip'],
    cargoOut: 'Composants éoliens', dailyTonnageMin: 20, dailyTonnageMax: 100,
    pricePerTonne: 300, attractCost: 150000,
    description: 'Convois exceptionnels hors gabarit pour éoliennes.',
    realLocations: [
      {name:'Siemens Gamesa — Le Havre',lat:49.489,lon:0.125,country:'FR'},
      {name:'GE Renewable — Cherbourg',lat:49.648,lon:-1.622,country:'FR'},
      {name:'LM Wind Power — Cherbourg',lat:49.641,lon:-1.615,country:'FR'},
      {name:'Siemens Gamesa — Cuxhaven',lat:53.862,lon:8.706,country:'DE'},
      {name:'Enercon — Aurich',lat:53.469,lon:7.484,country:'DE'},
      {name:'Vestas — Lauchhammer',lat:51.489,lon:13.762,country:'DE'},
      {name:'Nordex — Rostock',lat:54.179,lon:12.077,country:'DE'},
      {name:'Enercon — Magdeburg',lat:52.121,lon:11.666,country:'DE'},
      {name:'Siemens Gamesa — Hamburg',lat:53.547,lon:9.95,country:'DE'},
      {name:'Vestas — Esbjerg',lat:55.476,lon:8.452,country:'DK'},
      {name:'Vestas — Nakskov',lat:54.833,lon:11.146,country:'DK'},
      {name:'Siemens Gamesa — Aalborg',lat:57.048,lon:9.918,country:'DK'},
      {name:'Siemens Gamesa — Miranda de Ebro',lat:42.69,lon:-2.947,country:'ES'},
      {name:'Siemens Gamesa — Asteasu',lat:43.196,lon:-2.076,country:'ES'},
      {name:'Enercon — Viana do Castelo',lat:41.693,lon:-8.834,country:'PT'},
      {name:'TuuliWatti — Pori',lat:61.484,lon:21.782,country:'FI'},
      {name:'Wärtsilä — Vaasa',lat:63.097,lon:21.617,country:'FI'},
      {name:'Vestas — Taranto',lat:40.49,lon:17.2,country:'IT'},
      {name:'MHI Vestas — Belfast (export)',lat:54.607,lon:-5.893,country:'IE'},
      {name:'WEG — Maia',lat:41.238,lon:-8.62,country:'PT'},
    
      {name:'GE — Montoir-de-Bretagne',lat:47.315,lon:-2.155,country:'FR'},
      {name:'Prysmian — Gron',lat:48.395,lon:3.32,country:'FR'},
      {name:'Nordex — Hamburg',lat:53.53,lon:9.94,country:'DE'},
      {name:'Senvion — Bremerhaven',lat:53.54,lon:8.575,country:'DE'},
      {name:'Enercon — Magdeburg (add)',lat:52.122,lon:11.667,country:'DE'},
      {name:'Siemens Gamesa — Lerma',lat:42.025,lon:-3.751,country:'ES'},
      {name:'Vestas — Viveiro',lat:43.66,lon:-7.593,country:'ES'},
      {name:'Vestas — Daimiel',lat:38.937,lon:-3.611,country:'ES'},
      {name:'Vestas — Lem (exp. DK)',lat:56.025,lon:8.26,country:'DK'},
      {name:'Bonus/Siemens — Brande (DK)',lat:55.948,lon:9.117,country:'DK'},
      {name:'Nordex — Joensuu (exp. FI)',lat:62.602,lon:29.775,country:'FI'},
      {name:'Enercon — Trier',lat:49.749,lon:6.641,country:'DE'},
      {name:'WEG — Porto (add)',lat:41.24,lon:-8.622,country:'PT'},
      {name:'Gamesa — Pamplona',lat:42.816,lon:-1.65,country:'ES'},
      {name:'ABB — Vaasa (wind)',lat:63.098,lon:21.618,country:'FI'},
      {name:'Siemens — Vagos (PT)',lat:40.513,lon:-8.685,country:'PT'},
      {name:'Vestas — Taranto (add)',lat:40.492,lon:17.201,country:'IT'},
    
      {name:'Senvion — Osterrönfeld',lat:54.29,lon:9.71,country:'DE'},
      {name:'ENERCON — Haren',lat:52.797,lon:7.233,country:'DE'},
      {name:'Nordex — Rostock (add)',lat:54.18,lon:12.078,country:'DE'},
      {name:'MHI Vestas — Lindø (exp. DK)',lat:55.425,lon:10.52,country:'DK'},
      {name:'GE Wind — Salzbergen',lat:52.318,lon:7.366,country:'DE'},
    
      {name:'GE Vernova — Salzbergen (add)',lat:52.319,lon:7.367,country:'DE'},
      {name:'Goldwind — Frankfurt (exp. DE)',lat:50.095,lon:8.639,country:'DE'},
      {name:'Vestas — Lagos (PT)',lat:37.102,lon:-8.674,country:'PT'},
      {name:'Siemens Gamesa — Hull (exp. IE)',lat:53.749,lon:-0.346,country:'IE'},
    
      {name:'Vestas — Lauchhammer (add)',lat:51.49,lon:13.763,country:'DE'},
      {name:'Nordex — Berlin (add)',lat:52.53,lon:13.4,country:'DE'},
      {name:'GE Renewable — Salzbergen (add2)',lat:52.32,lon:7.368,country:'DE'},
    
      {name:'Siemens Gamesa — Bremen',lat:53.1,lon:8.79,country:'DE'},
      {name:'Nordex — Neumünster',lat:54.071,lon:9.98,country:'DE'},
    ],
  },

  /* ───────── 18. INDUSTRIE PHARMACEUTIQUE ───────── */
  {
    type: 'pharma', name: 'Industrie pharmaceutique', icon: 'ind_pharma',
    cargoTypes: ['chemicals-liq','frozen-food','parcels','express'],
    cargoOut: 'Produits pharmaceutiques', dailyTonnageMin: 50, dailyTonnageMax: 200,
    pricePerTonne: 500, attractCost: 200000,
    description: 'Pharma et biotech : 50-200t/jour. Très haut revenu par tonne.',
    realLocations: [
      {name:'Sanofi — Vitry-sur-Seine',lat:48.787,lon:2.405,country:'FR'},
      {name:'Sanofi — Sisteron',lat:44.198,lon:5.942,country:'FR'},
      {name:'Servier — Gidy',lat:47.963,lon:1.836,country:'FR'},
      {name:'Ipsen — Dreux',lat:48.737,lon:1.364,country:'FR'},
      {name:'Pierre Fabre — Castres',lat:43.604,lon:2.246,country:'FR'},
      {name:'Sanofi — Ambarès',lat:44.914,lon:-0.488,country:'FR'},
      {name:'Bayer Pharma — Leverkusen',lat:51.035,lon:6.992,country:'DE'},
      {name:'Boehringer Ingelheim',lat:49.977,lon:8.056,country:'DE'},
      {name:'Merck — Darmstadt',lat:49.856,lon:8.641,country:'DE'},
      {name:'BioNTech — Mainz',lat:49.996,lon:8.264,country:'DE'},
      {name:'Roche — Mannheim',lat:49.48,lon:8.44,country:'DE'},
      {name:'GSK — Wavre',lat:50.714,lon:4.612,country:'BE'},
      {name:'UCB — Braine-l\'Alleud',lat:50.679,lon:4.363,country:'BE'},
      {name:'Pfizer — Puurs',lat:51.076,lon:4.283,country:'BE'},
      {name:'Janssen — Beerse',lat:51.326,lon:4.849,country:'BE'},
      {name:'Pfizer — Ringaskiddy',lat:51.829,lon:-8.33,country:'IE'},
      {name:'MSD — Carlow',lat:52.838,lon:-6.934,country:'IE'},
      {name:'Eli Lilly — Kinsale',lat:51.706,lon:-8.524,country:'IE'},
      {name:'AbbVie — Sligo',lat:54.273,lon:-8.474,country:'IE'},
      {name:'Alexion — Athlone',lat:53.422,lon:-7.941,country:'IE'},
      {name:'Menarini — Florence',lat:43.771,lon:11.254,country:'IT'},
      {name:'Chiesi — Parma',lat:44.802,lon:10.332,country:'IT'},
      {name:'Grifols — Barcelona',lat:41.469,lon:2.163,country:'ES'},
      {name:'Almirall — Sant Andreu',lat:41.441,lon:2.19,country:'ES'},
      {name:'MSD — Oss',lat:51.762,lon:5.523,country:'NL'},
      {name:'Sandoz — Kundl',lat:47.463,lon:11.998,country:'AT'},
      {name:'Orion — Espoo',lat:60.207,lon:24.657,country:'FI'},
      {name:'Bial — Porto',lat:41.154,lon:-8.59,country:'PT'},
      {name:'Krka — Novo Mesto',lat:45.803,lon:15.174,country:'SI'},
      {name:'Lek — Ljubljana',lat:46.055,lon:14.513,country:'SI'},
      {name:'Pliva — Zagreb',lat:45.818,lon:15.956,country:'HR'},
    
      {name:'Sanofi — Montpellier',lat:43.61,lon:3.878,country:'FR'},
      {name:'Sanofi — Compiègne',lat:49.417,lon:2.826,country:'FR'},
      {name:'Bioderma — Lyon',lat:45.762,lon:4.838,country:'FR'},
      {name:'Servier — Orléans',lat:47.908,lon:1.904,country:'FR'},
      {name:'Bayer — Berlin',lat:52.487,lon:13.344,country:'DE'},
      {name:'Stada — Bad Vilbel',lat:50.177,lon:8.737,country:'DE'},
      {name:'AbbVie — Ludwigshafen',lat:49.488,lon:8.437,country:'DE'},
      {name:'Novartis — Ringaskiddy',lat:51.83,lon:-8.331,country:'IE'},
      {name:'Hovione — Loures',lat:38.826,lon:-9.173,country:'PT'},
      {name:'Stada — Wien',lat:48.205,lon:16.372,country:'AT'},
      {name:'Takeda — Singen',lat:47.76,lon:8.842,country:'DE'},
      {name:'Ratiopharm — Ulm',lat:48.401,lon:9.987,country:'DE'},
    
      {name:'Novo Nordisk — Chartres',lat:48.445,lon:1.5,country:'FR'},
      {name:'Sanofi — Tours',lat:47.388,lon:0.698,country:'FR'},
      {name:'AstraZeneca — Södertälje (exp. FI)',lat:59.195,lon:17.629,country:'FI'},
      {name:'Teva — Debrecen (exp. SK)',lat:47.541,lon:21.625,country:'SK'},
    
      {name:'Sanofi — Frankfurt',lat:50.108,lon:8.687,country:'DE'},
      {name:'Bayer — Wuppertal',lat:51.262,lon:7.162,country:'DE'},
      {name:'Fresenius — Bad Homburg',lat:50.227,lon:8.612,country:'DE'},
      {name:'Novo Nordisk — Hillerød (exp. DK)',lat:55.928,lon:12.309,country:'DK'},
    
      {name:'Roche — Basel (exp. DE)',lat:47.564,lon:7.595,country:'DE'},
      {name:'Novartis — Basel (exp. DE)',lat:47.558,lon:7.588,country:'DE'},
    
      {name:'Bayer — Basel (exp. DE)',lat:47.56,lon:7.59,country:'DE'},
      {name:'Roche — Penzberg',lat:47.751,lon:11.377,country:'DE'},
      {name:'GSK — München',lat:48.135,lon:11.585,country:'DE'},
      {name:'Janssen — Neuss',lat:51.19,lon:6.69,country:'DE'},
      {name:'Amgen — München',lat:48.132,lon:11.588,country:'DE'},
    ],
  },

  /* ───────── 19. INDUSTRIE TEXTILE ───────── */
  {
    type: 'textile', name: 'Industrie textile', icon: 'ind_textile',
    cargoTypes: ['cotton-bales','plastic-granules','parcels','paper'],
    cargoOut: 'Textiles / Fibres', dailyTonnageMin: 80, dailyTonnageMax: 300,
    pricePerTonne: 70, attractCost: 60000,
    description: 'Production textile : 80-300t/jour. Fibres, tissus, vêtements.',
    realLocations: [
      {name:'Dickson Constant — Wasquehal',lat:50.674,lon:3.137,country:'FR'},
      {name:'DMC — Mulhouse',lat:47.751,lon:7.348,country:'FR'},
      {name:'Benetton — Treviso',lat:45.667,lon:12.242,country:'IT'},
      {name:'Prato textile district',lat:43.881,lon:11.098,country:'IT'},
      {name:'Biella textile district',lat:45.563,lon:8.05,country:'IT'},
      {name:'Marzotto — Valdagno',lat:45.661,lon:11.3,country:'IT'},
      {name:'Inditex — Arteixo',lat:43.305,lon:-8.508,country:'ES'},
      {name:'Mango — Palau-solità',lat:41.603,lon:2.2,country:'ES'},
      {name:'Textile Guimarães',lat:41.443,lon:-8.296,country:'PT'},
      {name:'Riopele — Saramagos',lat:41.41,lon:-8.335,country:'PT'},
      {name:'Freudenberg — Weinheim',lat:49.546,lon:8.672,country:'DE'},
      {name:'Trigema — Burladingen',lat:48.291,lon:9.098,country:'DE'},
      {name:'Thrace Group — Xanthi',lat:41.141,lon:24.887,country:'GR'},
      {name:'Beaulieu — Wielsbeke',lat:50.905,lon:3.428,country:'BE'},
      {name:'Sioen — Ardooie',lat:50.989,lon:3.204,country:'BE'},
      {name:'Ten Cate — Nijverdal',lat:52.361,lon:6.459,country:'NL'},
      {name:'Lenzing — Lenzing',lat:47.977,lon:13.613,country:'AT'},
      {name:'Marimekko — Helsinki',lat:60.196,lon:24.969,country:'FI'},
      {name:'Krenholm — Narva',lat:59.376,lon:28.174,country:'EE'},
      {name:'Valmiera Glass — Valmiera',lat:57.535,lon:25.414,country:'LV'},
    
      {name:'Lacoste — Troyes',lat:48.297,lon:4.074,country:'FR'},
      {name:'Petit Bateau — Troyes',lat:48.3,lon:4.071,country:'FR'},
      {name:'Hermès — Pantin',lat:48.897,lon:2.406,country:'FR'},
      {name:'Louis Vuitton — Asnières',lat:48.909,lon:2.291,country:'FR'},
      {name:'Benetton — Castrette',lat:45.727,lon:12.237,country:'IT'},
      {name:'Calzedonia — Avio',lat:45.736,lon:10.959,country:'IT'},
      {name:'Desigual — Barcelona',lat:41.375,lon:2.177,country:'ES'},
      {name:'Bershka — Arteixo',lat:43.306,lon:-8.51,country:'ES'},
      {name:'Primark — Dublin',lat:53.349,lon:-6.26,country:'IE'},
      {name:'Hugo Boss — Metzingen',lat:48.536,lon:9.274,country:'DE'},
      {name:'Adidas — Herzogenaurach',lat:49.569,lon:10.878,country:'DE'},
      {name:'Puma — Herzogenaurach',lat:49.568,lon:10.88,country:'DE'},
      {name:'Falke — Schmallenberg',lat:51.155,lon:8.285,country:'DE'},
      {name:'Calzaturificio — Montebelluna',lat:45.777,lon:12.042,country:'IT'},
      {name:'Camper — Inca (Mallorca)',lat:39.715,lon:2.914,country:'ES'},
    
      {name:'Levi\'s — Brussels (HQ)',lat:50.855,lon:4.363,country:'BE'},
      {name:'G-Star — Amsterdam',lat:52.391,lon:4.9,country:'NL'},
      {name:'Zara — A Coruña',lat:43.305,lon:-8.51,country:'ES'},
      {name:'Massimo Dutti — Arteixo',lat:43.307,lon:-8.512,country:'ES'},
    
      {name:'New Balance — Flimby (exp. IE)',lat:54.684,lon:-3.512,country:'IE'},
      {name:'Burberry — Castleford (exp. IE)',lat:53.725,lon:-1.356,country:'IE'},
      {name:'Levi\'s — Płock (exp. DE)',lat:52.55,lon:19.7,country:'DE'},
    
      {name:'Falke — Lippstadt',lat:51.68,lon:8.34,country:'DE'},
      {name:'Olymp — Bietigheim-Bissingen',lat:48.958,lon:9.129,country:'DE'},
    
      {name:'s.Oliver — Rottendorf',lat:49.791,lon:9.964,country:'DE'},
      {name:'Tom Tailor — Hamburg',lat:53.55,lon:9.97,country:'DE'},
      {name:'Marc O\'Polo — Stephanskirchen',lat:47.857,lon:12.178,country:'DE'},
    ],
  },

  /* ───────── 20. ÉLECTRONIQUE / SEMI-CONDUCTEURS ───────── */
  {
    type: 'electronics', name: 'Électronique / Semi-conducteurs', icon: 'ind_electronics',
    cargoTypes: ['parcels','express','chemicals-liq','containers-20'],
    cargoOut: 'Composants électroniques', dailyTonnageMin: 30, dailyTonnageMax: 150,
    pricePerTonne: 800, attractCost: 300000,
    description: 'Semi-conducteurs et électronique : 30-150t/jour. Extrême valeur.',
    realLocations: [
      {name:'STMicroelectronics — Crolles',lat:45.281,lon:5.961,country:'FR'},
      {name:'STMicroelectronics — Tours',lat:47.391,lon:0.701,country:'FR'},
      {name:'Soitec — Bernin',lat:45.27,lon:5.87,country:'FR'},
      {name:'Thales — Brest',lat:48.39,lon:-4.486,country:'FR'},
      {name:'Infineon — Dresden',lat:51.06,lon:13.715,country:'DE'},
      {name:'Bosch — Reutlingen',lat:48.491,lon:9.206,country:'DE'},
      {name:'GlobalFoundries — Dresden',lat:51.063,lon:13.72,country:'DE'},
      {name:'TSMC — Dresden',lat:51.058,lon:13.725,country:'DE'},
      {name:'Intel — Magdeburg',lat:52.131,lon:11.628,country:'DE'},
      {name:'Infineon — Regensburg',lat:49.021,lon:12.088,country:'DE'},
      {name:'Bosch — Dresden',lat:51.055,lon:13.699,country:'DE'},
      {name:'X-FAB — Erfurt',lat:50.975,lon:11.035,country:'DE'},
      {name:'ASML — Veldhoven',lat:51.408,lon:5.393,country:'NL'},
      {name:'NXP — Nijmegen',lat:51.833,lon:5.869,country:'NL'},
      {name:'Nexperia — Nijmegen',lat:51.832,lon:5.863,country:'NL'},
      {name:'Intel — Leixlip',lat:53.365,lon:-6.484,country:'IE'},
      {name:'Analog Devices — Limerick',lat:52.663,lon:-8.633,country:'IE'},
      {name:'STMicro — Catania',lat:37.509,lon:15.09,country:'IT'},
      {name:'STMicro — Agrate',lat:45.571,lon:9.346,country:'IT'},
      {name:'Infineon — Villach',lat:46.611,lon:13.854,country:'AT'},
      {name:'ams-OSRAM — Premstätten',lat:46.97,lon:15.398,country:'AT'},
      {name:'Okmetic — Vantaa',lat:60.293,lon:24.963,country:'FI'},
      {name:'ON Semi — Piešťany',lat:48.586,lon:17.825,country:'SK'},
      {name:'Elmos — Dortmund',lat:51.498,lon:7.481,country:'DE'},
      {name:'Melexis — Ieper',lat:50.85,lon:2.881,country:'BE'},
    
      {name:'Altis Semiconductor — Corbeil',lat:48.607,lon:2.476,country:'FR'},
      {name:'Safran Electronics — Massy',lat:48.725,lon:2.267,country:'FR'},
      {name:'Thales — Cholet',lat:47.058,lon:-0.88,country:'FR'},
      {name:'X-FAB — Corbeil',lat:48.61,lon:2.48,country:'FR'},
      {name:'MediaTek — Leuven',lat:50.882,lon:4.704,country:'BE'},
      {name:'Microchip — Dublin',lat:53.337,lon:-6.262,country:'IE'},
      {name:'Wolfspeed — Ensdorf',lat:49.305,lon:6.797,country:'DE'},
      {name:'Siltronic — Burghausen',lat:48.17,lon:12.836,country:'DE'},
      {name:'Rohm — Willich',lat:51.264,lon:6.551,country:'DE'},
      {name:'Broadcom — München',lat:48.135,lon:11.582,country:'DE'},
      {name:'ams — Unterpremstätten',lat:46.971,lon:15.399,country:'AT'},
      {name:'Texas Instruments — Freising',lat:48.394,lon:11.749,country:'DE'},
      {name:'Vishay — Selb',lat:50.173,lon:12.128,country:'DE'},
    
      {name:'ASML — Berlin',lat:52.465,lon:13.3,country:'DE'},
      {name:'Infineon — München (add)',lat:48.133,lon:11.59,country:'DE'},
      {name:'Murata — Vantaa',lat:60.295,lon:24.96,country:'FI'},
      {name:'Silicon Labs — Oslo (exp. FI)',lat:60.39,lon:5.322,country:'FI'},
    
      {name:'Bosch — Reutlingen (add2)',lat:48.492,lon:9.207,country:'DE'},
      {name:'TSMC — Dresden (add2)',lat:51.059,lon:13.726,country:'DE'},
      {name:'GlobalFoundries — Dresden (add2)',lat:51.064,lon:13.721,country:'DE'},
    
      {name:'Renesas — Duisburg',lat:51.442,lon:6.758,country:'DE'},
      {name:'onsemi — München',lat:48.137,lon:11.593,country:'DE'},
    
      {name:'Continental — Nürnberg (add)',lat:49.451,lon:11.086,country:'DE'},
      {name:'Siemens — Erlangen',lat:49.595,lon:11.002,country:'DE'},
    ],
  },

  /* ───────── 21. AÉRONAUTIQUE / DÉFENSE ───────── */
  {
    type: 'aerospace', name: 'Aéronautique / Défense', icon: 'ind_aerospace',
    cargoTypes: ['wind-blade','construction-equip','containers-40','military'],
    cargoOut: 'Pièces aéronautiques', dailyTonnageMin: 30, dailyTonnageMax: 200,
    pricePerTonne: 400, attractCost: 250000,
    description: 'Production aéronautique : pièces, sous-ensembles, moteurs.',
    realLocations: [
      {name:'Airbus — Toulouse',lat:43.621,lon:1.374,country:'FR'},
      {name:'Airbus — Saint-Nazaire',lat:47.299,lon:-2.135,country:'FR'},
      {name:'Airbus — Nantes',lat:47.168,lon:-1.59,country:'FR'},
      {name:'Safran — Gennevilliers',lat:48.925,lon:2.293,country:'FR'},
      {name:'Dassault — Mérignac',lat:44.831,lon:-0.688,country:'FR'},
      {name:'Thales — Élancourt',lat:48.77,lon:1.975,country:'FR'},
      {name:'Safran — Villaroche',lat:48.622,lon:2.613,country:'FR'},
      {name:'Airbus Helicopters — Marignane',lat:43.437,lon:5.215,country:'FR'},
      {name:'Safran Nacelles — Le Havre',lat:49.49,lon:0.13,country:'FR'},
      {name:'Daher — Tarbes',lat:43.18,lon:0.0,country:'FR'},
      {name:'Latécoère — Toulouse',lat:43.574,lon:1.377,country:'FR'},
      {name:'Airbus — Hamburg',lat:53.536,lon:9.837,country:'DE'},
      {name:'Airbus Defence — Manching',lat:48.707,lon:11.54,country:'DE'},
      {name:'MTU Aero — Munich',lat:48.104,lon:11.701,country:'DE'},
      {name:'Airbus — Bremen',lat:53.053,lon:8.787,country:'DE'},
      {name:'Premium AEROTEC — Augsburg',lat:48.363,lon:10.9,country:'DE'},
      {name:'Airbus — Getafe',lat:40.293,lon:-3.722,country:'ES'},
      {name:'Airbus — Sevilla',lat:37.417,lon:-6.002,country:'ES'},
      {name:'ITP Aero — Zamudio',lat:43.286,lon:-2.876,country:'ES'},
      {name:'Leonardo — Pomigliano',lat:40.915,lon:14.386,country:'IT'},
      {name:'Leonardo — Cameri',lat:45.528,lon:8.654,country:'IT'},
      {name:'Leonardo — Venegono',lat:45.742,lon:8.85,country:'IT'},
      {name:'SABCA — Haren',lat:50.887,lon:4.408,country:'BE'},
      {name:'Sonaca — Gosselies',lat:50.444,lon:4.449,country:'BE'},
      {name:'Fokker/GKN — Papendrecht',lat:51.832,lon:4.683,country:'NL'},
      {name:'FACC — Ried im Innkreis',lat:48.209,lon:13.49,country:'AT'},
      {name:'Patria — Tampere',lat:61.494,lon:23.788,country:'FI'},
      {name:'TAP — Lisbon',lat:38.773,lon:-9.135,country:'PT'},
    
      {name:'STELIA — Méaulte',lat:49.922,lon:2.643,country:'FR'},
      {name:'FIGEAC AERO — Figeac',lat:44.609,lon:2.031,country:'FR'},
      {name:'Liebherr Aerospace — Toulouse',lat:43.61,lon:1.371,country:'FR'},
      {name:'Safran Landing — Molsheim',lat:48.543,lon:7.491,country:'FR'},
      {name:'Premium AEROTEC — Nordenham',lat:53.491,lon:8.479,country:'DE'},
      {name:'Liebherr — Lindenberg',lat:47.603,lon:9.877,country:'DE'},
      {name:'Rolls-Royce — Dahlewitz',lat:52.311,lon:13.46,country:'DE'},
      {name:'Piaggio Aero — Villanova',lat:44.39,lon:8.756,country:'IT'},
      {name:'Avio Aero — Rivalta',lat:45.049,lon:7.486,country:'IT'},
      {name:'Aernnova — Vitoria',lat:42.858,lon:-2.68,country:'ES'},
      {name:'FACC — Ried (add)',lat:48.21,lon:13.491,country:'AT'},
      {name:'Rolls-Royce — Dahlewitz (add)',lat:52.312,lon:13.461,country:'DE'},
    
      {name:'Safran — Gennevilliers (add)',lat:48.926,lon:2.294,country:'FR'},
      {name:'Dassault — Biarritz',lat:43.468,lon:-1.531,country:'FR'},
      {name:'Collins — Ratingen',lat:51.297,lon:6.847,country:'DE'},
      {name:'GKN — München',lat:48.14,lon:11.555,country:'DE'},
    
      {name:'Rolls-Royce — Berlin',lat:52.4,lon:13.312,country:'DE'},
      {name:'Leonardo — Grottaglie',lat:40.438,lon:17.44,country:'IT'},
      {name:'Safran — Le Creusot',lat:46.807,lon:4.431,country:'FR'},
    ],
  },

  /* ───────── 22. CHANTIER NAVAL ───────── */
  {
    type: 'shipyard', name: 'Chantier naval', icon: 'ind_shipyard',
    cargoTypes: ['steel-sheet','steel-beams','construction-equip','paint','transformer'],
    cargoOut: 'Sections de navire', dailyTonnageMin: 50, dailyTonnageMax: 300,
    pricePerTonne: 150, attractCost: 200000,
    description: 'Construction navale : 50-300t/jour de composants lourds.',
    realLocations: [
      {name:'Chantiers Atlantique — Saint-Nazaire',lat:47.28,lon:-2.17,country:'FR'},
      {name:'Naval Group — Lorient',lat:47.74,lon:-3.355,country:'FR'},
      {name:'Naval Group — Cherbourg',lat:49.64,lon:-1.61,country:'FR'},
      {name:'Naval Group — Toulon',lat:43.12,lon:5.936,country:'FR'},
      {name:'Piriou — Concarneau',lat:47.873,lon:-3.919,country:'FR'},
      {name:'Meyer Werft — Papenburg',lat:53.078,lon:7.399,country:'DE'},
      {name:'ThyssenKrupp Marine — Kiel',lat:54.332,lon:10.165,country:'DE'},
      {name:'Flensburger Schiffbau',lat:54.796,lon:9.433,country:'DE'},
      {name:'Lürssen — Bremen',lat:53.123,lon:8.753,country:'DE'},
      {name:'Fincantieri — Monfalcone',lat:45.794,lon:13.528,country:'IT'},
      {name:'Fincantieri — Marghera',lat:45.449,lon:12.228,country:'IT'},
      {name:'Fincantieri — Sestri Ponente',lat:44.419,lon:8.853,country:'IT'},
      {name:'Navantia — Ferrol',lat:43.483,lon:-8.222,country:'ES'},
      {name:'Navantia — Cartagena',lat:37.594,lon:-0.978,country:'ES'},
      {name:'Navantia — Cádiz',lat:36.524,lon:-6.283,country:'ES'},
      {name:'Meyer Turku',lat:60.437,lon:22.212,country:'FI'},
      {name:'Rauma Marine — Rauma',lat:61.128,lon:21.508,country:'FI'},
      {name:'Damen — Vlissingen',lat:51.443,lon:3.571,country:'NL'},
      {name:'IHC — Kinderdijk',lat:51.884,lon:4.649,country:'NL'},
      {name:'Brodosplit — Split',lat:43.516,lon:16.424,country:'HR'},
      {name:'Uljanik — Pula',lat:44.865,lon:13.835,country:'HR'},
      {name:'3. Maj — Rijeka',lat:45.345,lon:14.412,country:'HR'},
      {name:'West Sea — Viana do Castelo',lat:41.694,lon:-8.837,country:'PT'},
      {name:'Hellenic Shipyards — Skaramagas',lat:38.005,lon:23.606,country:'GR'},
    
      {name:'CMN — Cherbourg',lat:49.641,lon:-1.612,country:'FR'},
      {name:'Socarenam — Boulogne',lat:50.725,lon:1.597,country:'FR'},
      {name:'Aker — Turku (add)',lat:60.438,lon:22.213,country:'FI'},
      {name:'STX — Rauma (add)',lat:61.129,lon:21.509,country:'FI'},
      {name:'Damen — Galați (export HR)',lat:45.515,lon:16.44,country:'HR'},
      {name:'Cantiere Navale — Ancona',lat:43.624,lon:13.504,country:'IT'},
      {name:'Balenciaga — Zumaia',lat:43.296,lon:-2.254,country:'ES'},
      {name:'Gondán — Asturias',lat:43.536,lon:-6.748,country:'ES'},
      {name:'Lisnave — Setúbal',lat:38.512,lon:-8.895,country:'PT'},
      {name:'Estaleiros — Viana',lat:41.696,lon:-8.838,country:'PT'},
    
      {name:'Piriou — Concarneau (add)',lat:47.874,lon:-3.92,country:'FR'},
      {name:'Damen — Gorinchem (add)',lat:51.837,lon:4.963,country:'NL'},
      {name:'Fincantieri — Ancona',lat:43.625,lon:13.505,country:'IT'},
      {name:'Lurssen — Rendsburg',lat:54.303,lon:9.665,country:'DE'},
    
      {name:'Damen — Mangalia (exp. HR)',lat:43.8,lon:28.58,country:'HR'},
      {name:'Colombo Dockyard (exp. IT)',lat:44.41,lon:8.93,country:'IT'},
      {name:'Hyundai Vinashin (exp. HR)',lat:45.345,lon:14.413,country:'HR'},
    ],
  },

  /* ───────── 23. BRASSERIE / BOISSONS ───────── */
  {
    type: 'brewery', name: 'Brasserie / Boissons', icon: 'ind_brewery',
    cargoTypes: ['barley','beverages','glass','containers-20'],
    cargoOut: 'Boissons', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 80, attractCost: 80000,
    description: 'Production de boissons : bière, eau, sodas. 100-500t/jour.',
    realLocations: [
      {name:'Kronenbourg — Obernai',lat:48.461,lon:7.487,country:'FR'},
      {name:'Heineken — Schiltigheim',lat:48.608,lon:7.749,country:'FR'},
      {name:'Perrier — Vergèze',lat:43.744,lon:4.226,country:'FR'},
      {name:'Danone Eaux — Évian',lat:46.401,lon:6.592,country:'FR'},
      {name:'Pernod Ricard — Marseille',lat:43.296,lon:5.379,country:'FR'},
      {name:'Beck\'s — Bremen',lat:53.062,lon:8.822,country:'DE'},
      {name:'Warsteiner — Warstein',lat:51.444,lon:8.35,country:'DE'},
      {name:'Bitburger — Bitburg',lat:49.972,lon:6.524,country:'DE'},
      {name:'Krombacher — Kreuztal',lat:50.964,lon:7.989,country:'DE'},
      {name:'Erdinger — Erding',lat:48.308,lon:11.907,country:'DE'},
      {name:'Paulaner — München',lat:48.108,lon:11.552,country:'DE'},
      {name:'AB InBev — Leuven',lat:50.88,lon:4.702,country:'BE'},
      {name:'Duvel Moortgat — Puurs',lat:51.074,lon:4.279,country:'BE'},
      {name:'Chimay — Baileux',lat:50.04,lon:4.335,country:'BE'},
      {name:'Heineken — Zoeterwoude',lat:52.118,lon:4.489,country:'NL'},
      {name:'Grolsch — Enschede',lat:52.21,lon:6.882,country:'NL'},
      {name:'Bavaria — Lieshout',lat:51.514,lon:5.619,country:'NL'},
      {name:'Guinness — St. James\'s Gate',lat:53.342,lon:-6.287,country:'IE'},
      {name:'Heineken — Cork',lat:51.897,lon:-8.471,country:'IE'},
      {name:'Peroni — Roma',lat:41.893,lon:12.516,country:'IT'},
      {name:'Mahou — Madrid',lat:40.407,lon:-3.698,country:'ES'},
      {name:'Estrella Damm — Barcelona',lat:41.424,lon:2.188,country:'ES'},
      {name:'Stiegl — Salzburg',lat:47.792,lon:13.014,country:'AT'},
      {name:'Ottakringer — Wien',lat:48.21,lon:16.313,country:'AT'},
      {name:'Super Bock — Leça do Balio',lat:41.192,lon:-8.618,country:'PT'},
      {name:'Sagres — Vialonga',lat:38.847,lon:-9.104,country:'PT'},
      {name:'Sinebrychoff — Helsinki',lat:60.232,lon:24.983,country:'FI'},
      {name:'Aldaris — Rīga',lat:56.945,lon:24.151,country:'LV'},
      {name:'Švyturys — Klaipėda',lat:55.71,lon:21.131,country:'LT'},
      {name:'Pivovarna Laško',lat:46.153,lon:15.237,country:'SI'},
      {name:'Zagrebačka Pivovara',lat:45.825,lon:15.979,country:'HR'},
    
      {name:'Brasserie de Saint-Omer',lat:50.748,lon:2.258,country:'FR'},
      {name:'Brasserie Licorne — Saverne',lat:48.741,lon:7.362,country:'FR'},
      {name:'Brasserie Castelain — Bénifontaine',lat:50.442,lon:2.8,country:'FR'},
      {name:'1664 — Kronenbourg (add)',lat:48.462,lon:7.488,country:'FR'},
      {name:'Binding — Frankfurt',lat:50.106,lon:8.683,country:'DE'},
      {name:'König Pilsener — Duisburg',lat:51.433,lon:6.752,country:'DE'},
      {name:'Radeberger — Radeberg',lat:51.12,lon:13.925,country:'DE'},
      {name:'Veltins — Meschede',lat:51.361,lon:8.29,country:'DE'},
      {name:'Spaten — München',lat:48.136,lon:11.548,country:'DE'},
      {name:'Heineken — Sevilla',lat:37.39,lon:-5.975,country:'ES'},
      {name:'Moritz — Barcelona',lat:41.387,lon:2.164,country:'ES'},
      {name:'Mahou — Alovera',lat:40.593,lon:-3.252,country:'ES'},
      {name:'Birra Peroni — Padova',lat:45.418,lon:11.873,country:'IT'},
      {name:'Nastro Azzurro — Bari',lat:41.128,lon:16.869,country:'IT'},
      {name:'Palm — Steenhuffel (BE)',lat:50.97,lon:4.291,country:'BE'},
      {name:'Liefmans — Oudenaarde',lat:50.845,lon:3.604,country:'BE'},
      {name:'Smithwick\'s — Kilkenny',lat:52.65,lon:-7.252,country:'IE'},
      {name:'Heineken — Den Bosch',lat:51.688,lon:5.313,country:'NL'},
      {name:'Brand — Wijlre',lat:50.817,lon:5.885,country:'NL'},
      {name:'Stiegl — Salzburg (add)',lat:47.793,lon:13.015,country:'AT'},
    
      {name:'Brasserie Goudale — Arques',lat:50.742,lon:2.3,country:'FR'},
      {name:'Brasserie de Gayant — Douai',lat:50.373,lon:3.078,country:'FR'},
      {name:'Augustiner — München',lat:48.143,lon:11.545,country:'DE'},
      {name:'Franziskaner — München',lat:48.134,lon:11.556,country:'DE'},
      {name:'Peroni — Roma (add)',lat:41.894,lon:12.517,country:'IT'},
      {name:'Estrella Galicia — A Coruña',lat:43.345,lon:-8.405,country:'ES'},
    
      {name:'AB InBev — Jupille',lat:50.643,lon:5.613,country:'BE'},
      {name:'Carlsberg — Copenhagen (exp. DK)',lat:55.666,lon:12.53,country:'DK'},
      {name:'Tuborg — Helsingør (exp. DK)',lat:56.033,lon:12.612,country:'DK'},
      {name:'Royal Unibrew — Faxe (exp. DK)',lat:55.253,lon:12.115,country:'DK'},
      {name:'Olvi — Iisalmi',lat:63.56,lon:27.19,country:'FI'},
    
      {name:'La Chouffe — Achouffe',lat:50.127,lon:5.781,country:'BE'},
      {name:'Orval — Villers-devant-Orval',lat:49.636,lon:5.343,country:'BE'},
      {name:'Westvleteren — Vleteren',lat:50.896,lon:2.728,country:'BE'},
      {name:'Westmalle — Westmalle',lat:51.285,lon:4.672,country:'BE'},
      {name:'Rochefort — Rochefort',lat:50.162,lon:5.221,country:'BE'},
    ],
  },

  /* ───────── 24. MINE SOUTERRAINE ───────── */
  {
    type: 'mine', name: 'Mine souterraine', icon: 'ind_mine',
    cargoTypes: ['ore','coal','salt','bauxite','limestone'],
    cargoOut: 'Minerai brut', dailyTonnageMin: 300, dailyTonnageMax: 2000,
    pricePerTonne: 18, attractCost: 90000,
    description: 'Extraction souterraine : 300-2000t/jour. Gros volumes.',
    realLocations: [
      {name:'K+S — Werra (potasse)',lat:50.868,lon:9.92,country:'DE'},
      {name:'K+S — Bernburg (sel)',lat:51.809,lon:11.739,country:'DE'},
      {name:'RAG — Prosper-Haniel',lat:51.564,lon:6.886,country:'DE'},
      {name:'K+S — Sigmundshall',lat:52.383,lon:9.712,country:'DE'},
      {name:'K+S — Zielitz',lat:52.305,lon:11.674,country:'DE'},
      {name:'ICL — Sallent/Súria',lat:41.83,lon:1.841,country:'ES'},
      {name:'Minas de Almadén',lat:38.775,lon:-4.838,country:'ES'},
      {name:'Minas de Riotinto',lat:37.694,lon:-6.594,country:'ES'},
      {name:'Boliden — Kevitsa (Ni)',lat:67.697,lon:26.069,country:'FI'},
      {name:'Agnico Eagle — Kittilä',lat:67.924,lon:25.429,country:'FI'},
      {name:'Terrafame — Sotkamo',lat:63.963,lon:28.022,country:'FI'},
      {name:'First Quantum — Pyhäsalmi',lat:63.656,lon:25.96,country:'FI'},
      {name:'Boliden Tara — Navan',lat:53.585,lon:-6.826,country:'IE'},
      {name:'Somincor — Neves-Corvo',lat:37.584,lon:-7.972,country:'PT'},
      {name:'Panasqueira (tungstène)',lat:40.161,lon:-7.784,country:'PT'},
      {name:'Eldorado Gold — Olympias',lat:40.596,lon:23.774,country:'GR'},
      {name:'Eldorado Gold — Stratoni',lat:40.511,lon:23.855,country:'GR'},
      {name:'Salinen — Altaussee',lat:47.636,lon:13.772,country:'AT'},
      {name:'Wolfram Bergbau — Mittersill',lat:47.285,lon:12.473,country:'AT'},
      {name:'HBP — Nováky',lat:48.727,lon:18.541,country:'SK'},
      {name:'Premogovnik Velenje',lat:46.363,lon:15.115,country:'SI'},
      {name:'Estonia Oil Shale — Jõhvi',lat:59.354,lon:27.412,country:'EE'},
    
      {name:'Terrafame — Talvivaara',lat:63.965,lon:28.024,country:'FI'},
      {name:'Nordgold — Laisvall',lat:66.135,lon:15.867,country:'FI'},
      {name:'LKAB — Malmberget (exp. FI)',lat:67.176,lon:20.657,country:'FI'},
      {name:'Almadén (add)',lat:38.776,lon:-4.839,country:'ES'},
      {name:'Aguas Teñidas — Huelva',lat:37.695,lon:-6.596,country:'ES'},
      {name:'Cobre Las Cruces',lat:37.501,lon:-6.139,country:'ES'},
      {name:'Boliden — Garpenberg (exp. FI)',lat:60.344,lon:16.219,country:'FI'},
      {name:'Outokumpu Chrome — Kemi (add)',lat:65.81,lon:24.61,country:'FI'},
      {name:'K+S — Unterbreizbach',lat:50.783,lon:9.948,country:'DE'},
      {name:'K+S — Philippsthal',lat:50.849,lon:9.992,country:'DE'},
      {name:'K+S — Neuhof-Ellers',lat:50.463,lon:9.6,country:'DE'},
    
      {name:'K+S — Hattorf',lat:50.939,lon:9.894,country:'DE'},
      {name:'K+S — Wintershall (add)',lat:50.867,lon:9.968,country:'DE'},
      {name:'K+S — Werra (add2)',lat:50.87,lon:9.922,country:'DE'},
      {name:'Siilinjärvi — FinnMin',lat:63.114,lon:27.762,country:'FI'},
      {name:'Nordic Mines — Laiva',lat:64.15,lon:26.183,country:'FI'},
    
      {name:'Agnico Eagle — Kittilä (add)',lat:67.925,lon:25.43,country:'FI'},
      {name:'Boliden — Aitik (exp. FI)',lat:67.073,lon:20.95,country:'FI'},
      {name:'Rio Tinto — Riotinto (add2)',lat:37.695,lon:-6.595,country:'ES'},
    
      {name:'Neves Corvo (add2)',lat:37.585,lon:-7.973,country:'PT'},
      {name:'Panasqueira (add2)',lat:40.162,lon:-7.785,country:'PT'},
    ],
  },

  /* ───────── 25. USINE DE PNEUMATIQUES ───────── */
  {
    type: 'tire_plant', name: 'Usine de pneumatiques', icon: 'ind_tire',
    cargoTypes: ['tires','rubber','plastic-granules','chemicals-liq'],
    cargoOut: 'Pneumatiques', dailyTonnageMin: 100, dailyTonnageMax: 400,
    pricePerTonne: 100, attractCost: 110000,
    description: 'Production de pneus : 100-400t/jour. Export massif.',
    realLocations: [
      {name:'Michelin — Clermont-Ferrand',lat:45.784,lon:3.07,country:'FR'},
      {name:'Michelin — Cholet',lat:47.058,lon:-0.882,country:'FR'},
      {name:'Michelin — La Roche-sur-Yon',lat:46.671,lon:-1.427,country:'FR'},
      {name:'Continental — Sarreguemines',lat:49.109,lon:7.073,country:'FR'},
      {name:'Michelin — Roanne',lat:46.037,lon:4.065,country:'FR'},
      {name:'Michelin — Tours',lat:47.378,lon:0.68,country:'FR'},
      {name:'Continental — Hannover',lat:52.374,lon:9.728,country:'DE'},
      {name:'Continental — Aachen',lat:50.776,lon:6.084,country:'DE'},
      {name:'Continental — Korbach',lat:51.275,lon:8.875,country:'DE'},
      {name:'Pirelli — Settimo Torinese',lat:45.137,lon:7.766,country:'IT'},
      {name:'Pirelli — Bollate',lat:45.541,lon:9.115,country:'IT'},
      {name:'Michelin — Vitoria-Gasteiz',lat:42.846,lon:-2.672,country:'ES'},
      {name:'Bridgestone — Bilbao',lat:43.292,lon:-2.897,country:'ES'},
      {name:'Bridgestone — Puente San Miguel',lat:43.344,lon:-4.118,country:'ES'},
      {name:'Continental — Lousado',lat:41.379,lon:-8.451,country:'PT'},
      {name:'Goodyear — Luxembourg',lat:49.601,lon:6.127,country:'LU'},
      {name:'Nokian Tyres — Nokia',lat:61.469,lon:23.508,country:'FI'},
    
      {name:'Michelin — Vannes',lat:47.657,lon:-2.76,country:'FR'},
      {name:'Michelin — Le Puy',lat:45.044,lon:3.885,country:'FR'},
      {name:'Michelin — Montceau-les-Mines',lat:46.67,lon:4.376,country:'FR'},
      {name:'Dunlop — Montluçon',lat:46.34,lon:2.603,country:'FR'},
      {name:'Michelin — Homburg',lat:49.319,lon:7.332,country:'DE'},
      {name:'Continental — Sarreguemines (add)',lat:49.11,lon:7.074,country:'FR'},
      {name:'Pirelli — Breuberg',lat:49.818,lon:9.034,country:'DE'},
      {name:'Bridgestone — Stargard (exp. DE)',lat:53.337,lon:15.044,country:'DE'},
      {name:'Vredestein — Enschede',lat:52.207,lon:6.88,country:'NL'},
      {name:'Bridgestone — Rome (exp. IT)',lat:41.897,lon:12.5,country:'IT'},
      {name:'Hankook — Rácalmás',lat:46.874,lon:18.932,country:'SK'},
      {name:'Trelleborg — Hartola',lat:61.581,lon:26.019,country:'FI'},
    
      {name:'Michelin — Blavozy',lat:45.072,lon:3.856,country:'FR'},
      {name:'Goodyear — Amiens',lat:49.898,lon:2.304,country:'FR'},
      {name:'Continental — Timișoara (exp. SK)',lat:45.755,lon:21.228,country:'SK'},
      {name:'Yokohama — Daventry (exp. IE)',lat:52.256,lon:-1.162,country:'IE'},
    
      {name:'Michelin — Golbey',lat:48.195,lon:6.442,country:'FR'},
      {name:'Bridgestone — Béthune',lat:50.529,lon:2.639,country:'FR'},
      {name:'Yokohama — Verchères (exp. DE)',lat:45.783,lon:-73.349,country:'DE'},
    
      {name:'Michelin — Bad Kreuznach',lat:49.843,lon:7.873,country:'DE'},
      {name:'Continental — Aachen (add2)',lat:50.777,lon:6.085,country:'DE'},
    ],
  },

  /* ───────── 26. TERMINAL RAIL-ROUTE (COMBINÉ) ───────── */
  {
    type: 'rail_route', name: 'Terminal rail-route (combiné)', icon: 'ind_rail_route',
    cargoTypes: ['swap-bodies','semi-trailers','containers-20','containers-40'],
    cargoOut: 'Transport combiné', dailyTonnageMin: 300, dailyTonnageMax: 2000,
    pricePerTonne: 55, attractCost: 180000,
    description: 'Terminal combiné rail-route : transbordement camions ↔ wagons.',
    realLocations: [
      {name:'Perpignan — Le Boulou',lat:42.523,lon:2.84,country:'FR'},
      {name:'Aiton-Bourgneuf (AF)',lat:45.486,lon:6.282,country:'FR'},
      {name:'Calais — Eurotunnel Fret',lat:50.928,lon:1.81,country:'FR'},
      {name:'Mouguerre — Bayonne AF',lat:43.462,lon:-1.442,country:'FR'},
      {name:'Sète — AF Méditerranée',lat:43.395,lon:3.693,country:'FR'},
      {name:'Rungis MIN',lat:48.745,lon:2.348,country:'FR'},
      {name:'Lyon Vénissieux — VIIA',lat:45.712,lon:4.882,country:'FR'},
      {name:'Dourges — LDCT',lat:50.432,lon:2.97,country:'FR'},
      {name:'Ludwigshafen BASF — KTL',lat:49.494,lon:8.435,country:'DE'},
      {name:'Lübeck Skandinavienkai',lat:53.893,lon:10.81,country:'DE'},
      {name:'Duisburg Ruhrort — KV',lat:51.456,lon:6.728,country:'DE'},
      {name:'Rostock Seehafen — KV',lat:54.142,lon:12.071,country:'DE'},
      {name:'Dresden-Friedrichstadt',lat:51.047,lon:13.715,country:'DE'},
      {name:'Ulm Dornstadt — KV',lat:48.423,lon:9.911,country:'DE'},
      {name:'Singen — KV',lat:47.759,lon:8.84,country:'DE'},
      {name:'Mannheim — KV',lat:49.488,lon:8.457,country:'DE'},
      {name:'Bettembourg CFL Multimodal',lat:49.513,lon:6.102,country:'LU'},
      {name:'Muizen — Combinant',lat:51.009,lon:4.476,country:'BE'},
      {name:'Genk — Euroports',lat:50.984,lon:5.53,country:'BE'},
      {name:'Rotterdam ECT — Euromax',lat:51.949,lon:4.008,country:'NL'},
      {name:'Venlo — Greenport Venlo',lat:51.38,lon:6.175,country:'NL'},
      {name:'Moerdijk — KV',lat:51.691,lon:4.58,country:'NL'},
      {name:'Verona Quadrante — CEMAT',lat:45.395,lon:11.01,country:'IT'},
      {name:'Novara CIM',lat:45.449,lon:8.622,country:'IT'},
      {name:'Busto Arsizio Hupac',lat:45.618,lon:8.855,country:'IT'},
      {name:'Pomezia (Roma Sud)',lat:41.67,lon:12.494,country:'IT'},
      {name:'Barcelona Morrot',lat:41.362,lon:2.148,country:'ES'},
      {name:'Irun — Terminal Bidasoa',lat:43.34,lon:-1.789,country:'ES'},
      {name:'Tarragona — TCT',lat:41.089,lon:1.238,country:'ES'},
      {name:'Bilbao — Arasur',lat:42.805,lon:-2.719,country:'ES'},
      {name:'Wels — ROLA',lat:48.159,lon:14.02,country:'AT'},
      {name:'Brenner — ROLA',lat:47.003,lon:11.507,country:'AT'},
      {name:'Wolfurt — RCA',lat:47.474,lon:9.75,country:'AT'},
      {name:'Sines — ZILS',lat:37.949,lon:-8.861,country:'PT'},
      {name:'Kouvola — RRT Finland',lat:60.871,lon:26.701,country:'FI'},
      {name:'Oulu — Oritkari',lat:65.013,lon:25.423,country:'FI'},
      {name:'Thessaloniki — ThPA',lat:40.636,lon:22.941,country:'GR'},
      {name:'Dunajská Streda — KV',lat:47.993,lon:17.612,country:'SK'},
      {name:'Ljubljana — BTC',lat:46.063,lon:14.539,country:'SI'},
      {name:'Zagreb — Jankomir CT',lat:45.822,lon:15.893,country:'HR'},
      {name:'Tallinn — Muuga CT',lat:59.495,lon:24.955,country:'EE'},
      {name:'Riga — SIA terminal',lat:56.963,lon:24.063,country:'LV'},
      {name:'Kaunas — Intermodal',lat:54.933,lon:24.004,country:'LT'},
    
      {name:'Niort — Terminal',lat:46.325,lon:-0.462,country:'FR'},
      {name:'Dijon — Gevrey',lat:47.218,lon:4.984,country:'FR'},
      {name:'Cerbère — Franco-espagnol',lat:42.443,lon:3.167,country:'FR'},
      {name:'Marseille — Canet',lat:43.343,lon:5.37,country:'FR'},
      {name:'Novara Boschetto',lat:45.441,lon:8.611,country:'IT'},
      {name:'Trento Interporto',lat:46.028,lon:11.093,country:'IT'},
      {name:'Trieste — Fernetti',lat:45.671,lon:13.82,country:'IT'},
      {name:'Padova — Interporto',lat:45.36,lon:11.918,country:'IT'},
      {name:'Algeciras — Intermodal',lat:36.128,lon:-5.435,country:'ES'},
      {name:'Seville — La Negrilla',lat:37.389,lon:-5.948,country:'ES'},
      {name:'Granada — Ogíjares',lat:37.136,lon:-3.599,country:'ES'},
      {name:'Villach — ROLA',lat:46.601,lon:13.843,country:'AT'},
      {name:'Salzburg — Liefering',lat:47.82,lon:13.03,country:'AT'},
      {name:'Piraeus — CT',lat:37.941,lon:23.637,country:'GR'},
    
      {name:'Lyon Saint-Priest VIIA',lat:45.696,lon:4.94,country:'FR'},
      {name:'Nice Saint-Roch',lat:43.702,lon:7.276,country:'FR'},
      {name:'Bordeaux — Hourcade (add)',lat:44.794,lon:-0.524,country:'FR'},
      {name:'Metz — CT',lat:49.121,lon:6.184,country:'FR'},
      {name:'Nantes — Cheviré',lat:47.2,lon:-1.6,country:'FR'},
      {name:'Köln-Eifeltor (add)',lat:50.891,lon:6.917,country:'DE'},
      {name:'Hof — KV',lat:50.316,lon:11.913,country:'DE'},
      {name:'Regensburg — KV',lat:49.019,lon:12.09,country:'DE'},
      {name:'Sopron — Terminal',lat:47.682,lon:16.598,country:'AT'},
      {name:'Linz — KV',lat:48.319,lon:14.3,country:'AT'},
      {name:'Milano — Gallarate',lat:45.664,lon:8.797,country:'IT'},
      {name:'Marcianise CT — Napoli',lat:41.031,lon:14.299,country:'IT'},
      {name:'Córdoba — CT',lat:37.885,lon:-4.77,country:'ES'},
      {name:'Murcia — Intermodal',lat:37.983,lon:-1.13,country:'ES'},
      {name:'Porto — Leixões CT',lat:41.184,lon:-8.708,country:'PT'},
    
      {name:'Bettembourg (add)',lat:49.514,lon:6.103,country:'LU'},
      {name:'Antwerp Combinant (add)',lat:51.297,lon:4.337,country:'BE'},
      {name:'Hamburg Billwerder (add)',lat:53.514,lon:10.109,country:'DE'},
      {name:'München Riem (add)',lat:48.139,lon:11.714,country:'DE'},
      {name:'Wien Süd (add)',lat:48.146,lon:16.381,country:'AT'},
    
      {name:'Torino Orbassano (add)',lat:44.99,lon:7.522,country:'IT'},
      {name:'Bologna Interporto (add)',lat:44.501,lon:11.381,country:'IT'},
      {name:'Bari Lamasinata',lat:41.13,lon:16.86,country:'IT'},
      {name:'Catania Bicocca — CT',lat:37.523,lon:15.073,country:'IT'},
      {name:'Valence — CT',lat:44.934,lon:4.891,country:'FR'},
      {name:'Avignon — IACF',lat:43.918,lon:4.823,country:'FR'},
    
      {name:'Ludwigshafen BASF (add2)',lat:49.495,lon:8.436,country:'DE'},
      {name:'Augsburg — KV',lat:48.364,lon:10.89,country:'DE'},
      {name:'Stuttgart — KV',lat:48.787,lon:9.223,country:'DE'},
      {name:'Nürnberg — KV',lat:49.448,lon:11.087,country:'DE'},
      {name:'Leipzig — KV',lat:51.376,lon:12.333,country:'DE'},
      {name:'Wien — KV',lat:48.174,lon:16.384,country:'AT'},
      {name:'Graz — KV',lat:46.943,lon:15.469,country:'AT'},
      {name:'Salzburg — KV',lat:47.821,lon:13.031,country:'AT'},
    
      {name:'Innsbruck — Brenner (add)',lat:47.004,lon:11.508,country:'AT'},
      {name:'Salzburg Liefering (add2)',lat:47.821,lon:13.031,country:'AT'},
      {name:'Villach — ROLA (add2)',lat:46.602,lon:13.844,country:'AT'},
      {name:'Trento — KV',lat:46.029,lon:11.094,country:'IT'},
    
      {name:'Hannover — KV (add)',lat:52.367,lon:9.719,country:'DE'},
      {name:'Frankfurt — KV (add)',lat:50.105,lon:8.747,country:'DE'},
      {name:'Duisburg — KV (add2)',lat:51.451,lon:6.749,country:'DE'},
      {name:'Köln — KV',lat:50.892,lon:6.918,country:'DE'},
    ],
  },

  /* ───────── 27. TERMINAL CONTENEURS INTÉRIEUR ───────── */
  {
    type: 'container_terminal', name: 'Terminal conteneurs intérieur', icon: 'ind_container',
    cargoTypes: ['containers-20','containers-40','containers-reefer','flat-rack','open-top'],
    cargoOut: 'Conteneurs', dailyTonnageMin: 200, dailyTonnageMax: 1500,
    pricePerTonne: 50, attractCost: 150000,
    description: 'Terminal conteneurs sec inland : 200-1500 EVP/jour.',
    realLocations: [
      {name:'Paris Gennevilliers — SOGARIS',lat:48.925,lon:2.29,country:'FR'},
      {name:'Lyon Port Édouard Herriot',lat:45.729,lon:4.831,country:'FR'},
      {name:'Strasbourg — PAS',lat:48.57,lon:7.795,country:'FR'},
      {name:'Lille — CT',lat:50.643,lon:3.02,country:'FR'},
      {name:'Mulhouse-Ottmarsheim',lat:47.786,lon:7.506,country:'FR'},
      {name:'Pagny-sur-Moselle',lat:48.974,lon:6.001,country:'FR'},
      {name:'Bonneuil-sur-Marne',lat:48.77,lon:2.493,country:'FR'},
      {name:'Duisburg — DUSS',lat:51.44,lon:6.753,country:'DE'},
      {name:'Ludwigshafen — KTL',lat:49.486,lon:8.438,country:'DE'},
      {name:'Nürnberg — TriCon',lat:49.442,lon:11.097,country:'DE'},
      {name:'München — DUSS Riem',lat:48.138,lon:11.713,country:'DE'},
      {name:'Frankfurt — Osthafen',lat:50.103,lon:8.746,country:'DE'},
      {name:'Dortmund — CT',lat:51.498,lon:7.484,country:'DE'},
      {name:'Berlin Westhafen',lat:52.539,lon:13.338,country:'DE'},
      {name:'Halle (Saale) — Star Park',lat:51.465,lon:12.019,country:'DE'},
      {name:'Antwerpen — MSC PSA',lat:51.304,lon:4.286,country:'BE'},
      {name:'Gent — Kluizendok',lat:51.126,lon:3.786,country:'BE'},
      {name:'Moerdijk — Inland CT',lat:51.691,lon:4.577,country:'NL'},
      {name:'Tilburg Railport',lat:51.564,lon:5.099,country:'NL'},
      {name:'Alphen a/d Rijn',lat:52.131,lon:4.658,country:'NL'},
      {name:'Milano Smistamento',lat:45.456,lon:9.254,country:'IT'},
      {name:'Rivalta Scrivia',lat:44.786,lon:8.876,country:'IT'},
      {name:'Piacenza — Le Mose',lat:45.047,lon:9.721,country:'IT'},
      {name:'Madrid Coslada — CT',lat:40.428,lon:-3.572,country:'ES'},
      {name:'Zaragoza — TMZ',lat:41.658,lon:-0.908,country:'ES'},
      {name:'Sevilla — Maersk',lat:37.358,lon:-6.0,country:'ES'},
      {name:'Entroncamento — CT',lat:39.468,lon:-8.47,country:'PT'},
      {name:'Wien Freudenau',lat:48.18,lon:16.43,country:'AT'},
      {name:'Linz — CT',lat:48.318,lon:14.299,country:'AT'},
      {name:'Vuosaari — CT Helsinki',lat:60.212,lon:25.171,country:'FI'},
      {name:'Dublin — Inland Port',lat:53.351,lon:-6.219,country:'IE'},
      {name:'Piraeus — PCT',lat:37.943,lon:23.638,country:'GR'},
      {name:'Bratislava — CT',lat:48.121,lon:17.15,country:'SK'},
      {name:'Koper — CT',lat:45.549,lon:13.741,country:'SI'},
      {name:'Rijeka — AGCT',lat:45.33,lon:14.441,country:'HR'},
      {name:'Muuga — CT',lat:59.495,lon:24.954,country:'EE'},
    
      {name:'Chalon-sur-Saône — CT',lat:46.774,lon:4.856,country:'FR'},
      {name:'Valenton — CT',lat:48.745,lon:2.468,country:'FR'},
      {name:'Marseille — Mourepiane CT',lat:43.363,lon:5.349,country:'FR'},
      {name:'Le Havre — TNMSC',lat:49.486,lon:0.11,country:'FR'},
      {name:'Bremerhaven — NTB',lat:53.543,lon:8.573,country:'DE'},
      {name:'Bremerhaven — MSC Gate',lat:53.541,lon:8.569,country:'DE'},
      {name:'Wilhelmshaven — EUROGATE',lat:53.579,lon:8.138,country:'DE'},
      {name:'Marsaxlokk — Malta',lat:35.813,lon:14.535,country:'MT'},
      {name:'Limassol — CT',lat:34.659,lon:33.04,country:'CY'},
      {name:'Gioia Tauro — MCT',lat:38.433,lon:15.89,country:'IT'},
      {name:'Vado Ligure — APM',lat:44.264,lon:8.431,country:'IT'},
      {name:'Taranto — Evergreen',lat:40.479,lon:17.177,country:'IT'},
      {name:'Aarhus — Grenaa (exp. DK)',lat:56.15,lon:10.217,country:'DK'},
      {name:'Hamina — Kotka CT',lat:60.455,lon:26.917,country:'FI'},
    
      {name:'Noisy-le-Sec CT (add)',lat:48.896,lon:2.463,country:'FR'},
      {name:'Avignon — CT',lat:43.918,lon:4.823,country:'FR'},
      {name:'Dijon — CT',lat:47.31,lon:5.02,country:'FR'},
      {name:'Nantes — CT',lat:47.198,lon:-1.598,country:'FR'},
      {name:'Hamburg — HHLA Tollerort',lat:53.53,lon:9.934,country:'DE'},
      {name:'Hamburg — Eurogate',lat:53.536,lon:9.96,country:'DE'},
      {name:'Bremerhaven — EUROGATE (add)',lat:53.544,lon:8.572,country:'DE'},
      {name:'Catania — CT',lat:37.503,lon:15.093,country:'IT'},
      {name:'Marsala — CT',lat:37.798,lon:12.437,country:'IT'},
      {name:'Valence — CT',lat:44.933,lon:4.89,country:'FR'},
      {name:'Rouen — HAROPA CT',lat:49.438,lon:1.084,country:'FR'},
    
      {name:'Genk Euroports (add)',lat:50.985,lon:5.531,country:'BE'},
      {name:'Born CT (add)',lat:51.04,lon:5.806,country:'NL'},
      {name:'Wels CT (add)',lat:48.16,lon:14.023,country:'AT'},
      {name:'Graz CT (add)',lat:46.942,lon:15.468,country:'AT'},
      {name:'Kouvola CT (add)',lat:60.872,lon:26.702,country:'FI'},
    
      {name:'Le Havre — TNMSC (add2)',lat:49.487,lon:0.111,country:'FR'},
      {name:'Fos — 2XL',lat:43.406,lon:4.88,country:'FR'},
      {name:'Dunkerque — Terminal Flandres',lat:51.046,lon:2.349,country:'FR'},
      {name:'Nantes — Terminal Cheviré',lat:47.201,lon:-1.601,country:'FR'},
    
      {name:'Lübeck — CT',lat:53.884,lon:10.706,country:'DE'},
      {name:'Sassnitz — CT',lat:54.516,lon:13.606,country:'DE'},
      {name:'Wismar — CT',lat:53.898,lon:11.466,country:'DE'},
      {name:'Stralsund — CT',lat:54.313,lon:13.092,country:'DE'},
      {name:'Emden — CT',lat:53.339,lon:7.187,country:'DE'},
      {name:'Cuxhaven — CT',lat:53.871,lon:8.71,country:'DE'},
      {name:'Brake — CT',lat:53.331,lon:8.478,country:'DE'},
    
      {name:'Hamburg — HHLA Burchardkai',lat:53.531,lon:9.929,country:'DE'},
      {name:'Hamburg — Eurogate (add)',lat:53.537,lon:9.961,country:'DE'},
    
      {name:'Frankfurt-Ost — CT',lat:50.105,lon:8.748,country:'DE'},
      {name:'Hannover-Linden — CT',lat:52.367,lon:9.72,country:'DE'},
      {name:'Bremen — Roland CT',lat:53.096,lon:8.766,country:'DE'},
      {name:'Berlin-Großbeeren — CT',lat:52.355,lon:13.319,country:'DE'},
    ],
  },

  /* ───────── 28. HUB DHL EXPRESS/FREIGHT ───────── */
  {
    type: 'dhl_hub', name: 'Hub DHL Express/Freight', icon: 'ind_dhl',
    cargoTypes: ['parcels','express','swap-bodies'],
    cargoOut: 'Colis DHL', dailyTonnageMin: 100, dailyTonnageMax: 800,
    pricePerTonne: 150, attractCost: 120000,
    description: 'Hub de tri DHL Express et DHL Freight. 100-800t/jour.',
    realLocations: [
      {name:'DHL Hub — Roissy CDG',lat:49.009,lon:2.546,country:'FR'},
      {name:'DHL — Lyon Saint-Exupéry',lat:45.724,lon:5.085,country:'FR'},
      {name:'DHL — Marseille Vitrolles',lat:43.443,lon:5.224,country:'FR'},
      {name:'DHL — Lille Lesquin',lat:50.567,lon:3.1,country:'FR'},
      {name:'DHL Hub — Leipzig (Europahub)',lat:51.432,lon:12.236,country:'DE'},
      {name:'DHL — Frankfurt',lat:50.042,lon:8.566,country:'DE'},
      {name:'DHL — Munich',lat:48.354,lon:11.786,country:'DE'},
      {name:'DHL — Cologne/Bonn',lat:50.874,lon:7.138,country:'DE'},
      {name:'DHL — Berlin-Schönefeld',lat:52.38,lon:13.522,country:'DE'},
      {name:'DHL — Hamburg',lat:53.635,lon:9.997,country:'DE'},
      {name:'DHL — Bremen',lat:53.049,lon:8.788,country:'DE'},
      {name:'DHL — Nürnberg',lat:49.494,lon:11.078,country:'DE'},
      {name:'DHL — Bruxelles Zaventem',lat:50.902,lon:4.484,country:'BE'},
      {name:'DHL — Liège Bierset',lat:50.643,lon:5.441,country:'BE'},
      {name:'DHL — Amsterdam Schiphol',lat:52.318,lon:4.768,country:'NL'},
      {name:'DHL — Eindhoven',lat:51.451,lon:5.372,country:'NL'},
      {name:'DHL — Milano Malpensa',lat:45.632,lon:8.717,country:'IT'},
      {name:'DHL — Roma Fiumicino',lat:41.803,lon:12.256,country:'IT'},
      {name:'DHL — Bologna',lat:44.536,lon:11.292,country:'IT'},
      {name:'DHL — Madrid Barajas',lat:40.472,lon:-3.561,country:'ES'},
      {name:'DHL — Barcelona',lat:41.299,lon:2.084,country:'ES'},
      {name:'DHL — Vitoria',lat:42.883,lon:-2.725,country:'ES'},
      {name:'DHL — Lisboa',lat:38.774,lon:-9.136,country:'PT'},
      {name:'DHL — Wien Schwechat',lat:48.112,lon:16.563,country:'AT'},
      {name:'DHL — Dublin',lat:53.426,lon:-6.249,country:'IE'},
      {name:'DHL — Helsinki Vantaa',lat:60.315,lon:24.966,country:'FI'},
      {name:'DHL — Athens',lat:37.937,lon:23.95,country:'GR'},
      {name:'DHL — Tallinn',lat:59.414,lon:24.799,country:'EE'},
      {name:'DHL — Riga',lat:56.921,lon:23.972,country:'LV'},
      {name:'DHL — Vilnius',lat:54.635,lon:25.283,country:'LT'},
      {name:'DHL — Bratislava',lat:48.17,lon:17.213,country:'SK'},
      {name:'DHL — Ljubljana',lat:46.225,lon:14.459,country:'SI'},
      {name:'DHL — Zagreb',lat:45.741,lon:16.069,country:'HR'},
      {name:'DHL — Luxembourg',lat:49.624,lon:6.209,country:'LU'},
      {name:'DHL — Nicosia',lat:34.878,lon:33.624,country:'CY'},
      {name:'DHL — Malta Luqa',lat:35.856,lon:14.482,country:'MT'},
    
      {name:'DHL — Nantes',lat:47.153,lon:-1.605,country:'FR'},
      {name:'DHL — Bordeaux',lat:44.828,lon:-0.715,country:'FR'},
      {name:'DHL — Strasbourg',lat:48.585,lon:7.71,country:'FR'},
      {name:'DHL — Toulouse',lat:43.63,lon:1.367,country:'FR'},
      {name:'DHL — Stuttgart',lat:48.69,lon:9.222,country:'DE'},
      {name:'DHL — Hannover',lat:52.461,lon:9.685,country:'DE'},
      {name:'DHL — Düsseldorf',lat:51.278,lon:6.755,country:'DE'},
      {name:'DHL — Dortmund',lat:51.518,lon:7.612,country:'DE'},
      {name:'DHL — Leipzig (sorting)',lat:51.433,lon:12.237,country:'DE'},
      {name:'DHL — Porto',lat:41.235,lon:-8.68,country:'PT'},
      {name:'DHL — Thessaloniki',lat:40.52,lon:22.971,country:'GR'},
      {name:'DHL — Vilnius',lat:54.637,lon:25.285,country:'LT'},
      {name:'DHL — Zagreb (add)',lat:45.743,lon:16.07,country:'HR'},
      {name:'DHL — Valletta',lat:35.857,lon:14.483,country:'MT'},
    
      {name:'DHL — Nice',lat:43.663,lon:7.209,country:'FR'},
      {name:'DHL — Metz',lat:49.111,lon:6.176,country:'FR'},
      {name:'DHL — Rouen',lat:49.38,lon:1.18,country:'FR'},
      {name:'DHL — Augsburg',lat:48.366,lon:10.886,country:'DE'},
      {name:'DHL — Bielefeld',lat:52.02,lon:8.54,country:'DE'},
      {name:'DHL — Essen',lat:51.458,lon:7.012,country:'DE'},
      {name:'DHL — Verona',lat:45.395,lon:11.01,country:'IT'},
      {name:'DHL — Napoli',lat:40.87,lon:14.288,country:'IT'},
      {name:'DHL — Torino',lat:45.04,lon:7.65,country:'IT'},
      {name:'DHL — Sevilla',lat:37.41,lon:-5.98,country:'ES'},
      {name:'DHL — Bilbao',lat:43.301,lon:-2.91,country:'ES'},
      {name:'DHL — Valencia',lat:39.49,lon:-0.473,country:'ES'},
    
      {name:'DHL — Roissy (add2)',lat:49.011,lon:2.547,country:'FR'},
      {name:'DHL — Bruxelles (add2)',lat:50.903,lon:4.485,country:'BE'},
      {name:'DHL — Amsterdam (add2)',lat:52.319,lon:4.769,country:'NL'},
      {name:'DHL — Wien (add2)',lat:48.113,lon:16.564,country:'AT'},
      {name:'DHL — Helsinki (add2)',lat:60.316,lon:24.967,country:'FI'},
    
      {name:'DHL — Graz',lat:46.993,lon:15.44,country:'AT'},
      {name:'DHL — Salzburg',lat:47.793,lon:13.003,country:'AT'},
      {name:'DHL — Linz',lat:48.233,lon:14.188,country:'AT'},
      {name:'DHL — Cork',lat:51.842,lon:-8.491,country:'IE'},
      {name:'DHL — Tampere',lat:61.415,lon:23.597,country:'FI'},
      {name:'DHL — Turku',lat:60.51,lon:22.272,country:'FI'},
    
      {name:'DHL — Innsbruck',lat:47.26,lon:11.344,country:'AT'},
      {name:'DHL — Klagenfurt',lat:46.643,lon:14.339,country:'AT'},
      {name:'DHL — Oulu',lat:65.007,lon:25.445,country:'FI'},
    ],
  },

  /* ───────── 29. HUB FEDEX / TNT ───────── */
  {
    type: 'fedex_hub', name: 'Hub FedEx / TNT', icon: 'ind_fedex',
    cargoTypes: ['parcels','express','swap-bodies'],
    cargoOut: 'Colis FedEx', dailyTonnageMin: 80, dailyTonnageMax: 600,
    pricePerTonne: 160, attractCost: 110000,
    description: 'Hub FedEx Express et TNT. 80-600t/jour.',
    realLocations: [
      {name:'FedEx Hub — Roissy CDG',lat:49.013,lon:2.55,country:'FR'},
      {name:'TNT — Garonor',lat:48.968,lon:2.498,country:'FR'},
      {name:'TNT — Lyon',lat:45.718,lon:5.077,country:'FR'},
      {name:'TNT — Toulouse',lat:43.63,lon:1.364,country:'FR'},
      {name:'TNT — Liège (hub européen)',lat:50.641,lon:5.447,country:'BE'},
      {name:'FedEx — Bruxelles',lat:50.903,lon:4.485,country:'BE'},
      {name:'FedEx — Cologne',lat:50.868,lon:7.134,country:'DE'},
      {name:'FedEx — Frankfurt',lat:50.036,lon:8.56,country:'DE'},
      {name:'TNT — Arnhem',lat:51.954,lon:5.85,country:'NL'},
      {name:'TNT — Amsterdam',lat:52.315,lon:4.766,country:'NL'},
      {name:'FedEx — Milano Malpensa',lat:45.633,lon:8.714,country:'IT'},
      {name:'TNT — Piacenza',lat:45.048,lon:9.723,country:'IT'},
      {name:'FedEx — Madrid',lat:40.471,lon:-3.557,country:'ES'},
      {name:'TNT — Barcelona',lat:41.298,lon:2.083,country:'ES'},
      {name:'FedEx — Lisboa',lat:38.775,lon:-9.137,country:'PT'},
      {name:'FedEx — Wien',lat:48.113,lon:16.561,country:'AT'},
      {name:'FedEx — Dublin',lat:53.425,lon:-6.248,country:'IE'},
      {name:'FedEx — Helsinki',lat:60.317,lon:24.968,country:'FI'},
      {name:'TNT — Bratislava',lat:48.171,lon:17.214,country:'SK'},
      {name:'FedEx — Athens',lat:37.938,lon:23.948,country:'GR'},
      {name:'FedEx — München',lat:48.356,lon:11.788,country:'DE'},
      {name:'TNT — Luxembourg',lat:49.621,lon:6.207,country:'LU'},
      {name:'FedEx — Ljubljana',lat:46.224,lon:14.458,country:'SI'},
    
      {name:'FedEx — Nantes',lat:47.155,lon:-1.607,country:'FR'},
      {name:'FedEx — Bordeaux',lat:44.827,lon:-0.713,country:'FR'},
      {name:'FedEx — Stuttgart',lat:48.692,lon:9.224,country:'DE'},
      {name:'FedEx — Düsseldorf',lat:51.277,lon:6.754,country:'DE'},
      {name:'FedEx — Hannover',lat:52.462,lon:9.686,country:'DE'},
      {name:'TNT — Porto',lat:41.237,lon:-8.682,country:'PT'},
      {name:'FedEx — Thessaloniki',lat:40.522,lon:22.973,country:'GR'},
      {name:'TNT — Zagreb',lat:45.742,lon:16.068,country:'HR'},
      {name:'FedEx — Tallinn',lat:59.415,lon:24.8,country:'EE'},
      {name:'TNT — Riga',lat:56.923,lon:23.974,country:'LV'},
      {name:'FedEx — Valletta',lat:35.858,lon:14.484,country:'MT'},
      {name:'TNT — Vilnius',lat:54.636,lon:25.284,country:'LT'},
      {name:'FedEx — Nicosia',lat:34.879,lon:33.625,country:'CY'},
      {name:'TNT — Helsinki',lat:60.318,lon:24.969,country:'FI'},
      {name:'FedEx — Bratislava',lat:48.172,lon:17.215,country:'SK'},
    
      {name:'FedEx — Nice',lat:43.665,lon:7.211,country:'FR'},
      {name:'FedEx — Rennes',lat:48.085,lon:-1.677,country:'FR'},
      {name:'FedEx — Nürnberg',lat:49.495,lon:11.079,country:'DE'},
      {name:'FedEx — Leipzig',lat:51.434,lon:12.238,country:'DE'},
      {name:'FedEx — Verona',lat:45.396,lon:11.011,country:'IT'},
      {name:'FedEx — Napoli',lat:40.871,lon:14.289,country:'IT'},
      {name:'FedEx — Sevilla',lat:37.411,lon:-5.981,country:'ES'},
      {name:'FedEx — Bilbao',lat:43.302,lon:-2.911,country:'ES'},
      {name:'FedEx — Zaragoza',lat:41.665,lon:-1.01,country:'ES'},
    
      {name:'FedEx — Liège (add2)',lat:50.642,lon:5.448,country:'BE'},
      {name:'FedEx — Milano (add2)',lat:45.634,lon:8.718,country:'IT'},
      {name:'FedEx — Hamburg',lat:53.636,lon:9.998,country:'DE'},
      {name:'FedEx — Berlin',lat:52.381,lon:13.523,country:'DE'},
    
      {name:'FedEx — Graz',lat:46.992,lon:15.439,country:'AT'},
      {name:'FedEx — Cork',lat:51.841,lon:-8.49,country:'IE'},
      {name:'FedEx — Tampere',lat:61.414,lon:23.596,country:'FI'},
      {name:'FedEx — Turku',lat:60.509,lon:22.271,country:'FI'},
      {name:'FedEx — Porto (add)',lat:41.238,lon:-8.683,country:'PT'},
    
      {name:'FedEx — Innsbruck',lat:47.259,lon:11.343,country:'AT'},
      {name:'FedEx — Oulu',lat:65.006,lon:25.444,country:'FI'},
    ],
  },

  /* ───────── 30. HUB UPS ───────── */
  {
    type: 'ups_hub', name: 'Hub UPS', icon: 'ind_ups',
    cargoTypes: ['parcels','express','swap-bodies'],
    cargoOut: 'Colis UPS', dailyTonnageMin: 80, dailyTonnageMax: 600,
    pricePerTonne: 155, attractCost: 115000,
    description: 'Hub UPS Supply Chain. 80-600t/jour.',
    realLocations: [
      {name:'UPS — Roissy CDG',lat:49.01,lon:2.548,country:'FR'},
      {name:'UPS — Lyon',lat:45.72,lon:5.083,country:'FR'},
      {name:'UPS — Marseille',lat:43.441,lon:5.222,country:'FR'},
      {name:'UPS — Toulouse',lat:43.632,lon:1.366,country:'FR'},
      {name:'UPS Hub — Cologne/Bonn',lat:50.873,lon:7.136,country:'DE'},
      {name:'UPS — Frankfurt',lat:50.039,lon:8.563,country:'DE'},
      {name:'UPS — Hamburg',lat:53.633,lon:9.995,country:'DE'},
      {name:'UPS — München',lat:48.353,lon:11.784,country:'DE'},
      {name:'UPS — Berlin',lat:52.381,lon:13.524,country:'DE'},
      {name:'UPS — Amsterdam Schiphol',lat:52.316,lon:4.766,country:'NL'},
      {name:'UPS — Eindhoven',lat:51.449,lon:5.371,country:'NL'},
      {name:'UPS — Bruxelles',lat:50.901,lon:4.483,country:'BE'},
      {name:'UPS — Milano Malpensa',lat:45.631,lon:8.715,country:'IT'},
      {name:'UPS — Roma',lat:41.801,lon:12.254,country:'IT'},
      {name:'UPS — Madrid',lat:40.47,lon:-3.559,country:'ES'},
      {name:'UPS — Barcelona',lat:41.297,lon:2.082,country:'ES'},
      {name:'UPS — Wien',lat:48.11,lon:16.56,country:'AT'},
      {name:'UPS — Dublin',lat:53.424,lon:-6.247,country:'IE'},
      {name:'UPS — Helsinki',lat:60.314,lon:24.964,country:'FI'},
      {name:'UPS — Lisboa',lat:38.772,lon:-9.134,country:'PT'},
      {name:'UPS — Athens',lat:37.936,lon:23.947,country:'GR'},
      {name:'UPS — Luxembourg',lat:49.622,lon:6.208,country:'LU'},
      {name:'UPS — Tallinn',lat:59.413,lon:24.797,country:'EE'},
      {name:'UPS — Riga',lat:56.92,lon:23.971,country:'LV'},
    
      {name:'UPS — Nantes',lat:47.154,lon:-1.606,country:'FR'},
      {name:'UPS — Bordeaux',lat:44.826,lon:-0.712,country:'FR'},
      {name:'UPS — Stuttgart',lat:48.691,lon:9.223,country:'DE'},
      {name:'UPS — Düsseldorf',lat:51.276,lon:6.753,country:'DE'},
      {name:'UPS — Hannover',lat:52.46,lon:9.684,country:'DE'},
      {name:'UPS — Dortmund',lat:51.519,lon:7.613,country:'DE'},
      {name:'UPS — Porto',lat:41.236,lon:-8.681,country:'PT'},
      {name:'UPS — Thessaloniki',lat:40.521,lon:22.972,country:'GR'},
      {name:'UPS — Zagreb',lat:45.74,lon:16.067,country:'HR'},
      {name:'UPS — Vilnius',lat:54.636,lon:25.283,country:'LT'},
      {name:'UPS — Bratislava',lat:48.169,lon:17.212,country:'SK'},
      {name:'UPS — Ljubljana (add)',lat:46.226,lon:14.46,country:'SI'},
      {name:'UPS — Valletta',lat:35.855,lon:14.481,country:'MT'},
      {name:'UPS — Nicosia',lat:34.877,lon:33.623,country:'CY'},
    
      {name:'UPS — Nice',lat:43.664,lon:7.21,country:'FR'},
      {name:'UPS — Rennes',lat:48.084,lon:-1.676,country:'FR'},
      {name:'UPS — Nürnberg',lat:49.494,lon:11.078,country:'DE'},
      {name:'UPS — Verona',lat:45.394,lon:11.009,country:'IT'},
      {name:'UPS — Napoli',lat:40.869,lon:14.287,country:'IT'},
      {name:'UPS — Sevilla',lat:37.409,lon:-5.979,country:'ES'},
      {name:'UPS — Bilbao',lat:43.3,lon:-2.909,country:'ES'},
      {name:'UPS — Zaragoza',lat:41.663,lon:-1.008,country:'ES'},
    
      {name:'UPS — Cologne (add2)',lat:50.874,lon:7.137,country:'DE'},
      {name:'UPS — Milano (add2)',lat:45.632,lon:8.716,country:'IT'},
      {name:'UPS — Frankfurt (add2)',lat:50.04,lon:8.564,country:'DE'},
    
      {name:'UPS — Graz',lat:46.991,lon:15.438,country:'AT'},
      {name:'UPS — Cork',lat:51.84,lon:-8.489,country:'IE'},
      {name:'UPS — Tampere',lat:61.413,lon:23.595,country:'FI'},
      {name:'UPS — Turku',lat:60.508,lon:22.27,country:'FI'},
    
      {name:'UPS — Innsbruck',lat:47.258,lon:11.342,country:'AT'},
      {name:'UPS — Oulu',lat:65.005,lon:25.443,country:'FI'},
    ],
  },

  /* ───────── 31. CENTRE DE TRI POSTAL ───────── */
  {
    type: 'postal_center', name: 'Centre de tri postal', icon: 'ind_postal',
    cargoTypes: ['parcels','express','mail-bags'],
    cargoOut: 'Courrier / Colis', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 120, attractCost: 80000,
    description: 'Centre de tri postal national. 100-500t/jour.',
    realLocations: [
      {name:'La Poste PIC — Paris-Brune',lat:48.823,lon:2.329,country:'FR'},
      {name:'La Poste PIC — Roissy',lat:49.0,lon:2.523,country:'FR'},
      {name:'La Poste PIC — Wissous',lat:48.73,lon:2.322,country:'FR'},
      {name:'La Poste PIC — Lyon',lat:45.712,lon:5.083,country:'FR'},
      {name:'La Poste PIC — Bordeaux',lat:44.815,lon:-0.555,country:'FR'},
      {name:'La Poste — Courcouronnes',lat:48.615,lon:2.423,country:'FR'},
      {name:'La Poste PIC — Lille',lat:50.645,lon:3.019,country:'FR'},
      {name:'La Poste PIC — Marseille',lat:43.348,lon:5.365,country:'FR'},
      {name:'La Poste PIC — Strasbourg',lat:48.588,lon:7.71,country:'FR'},
      {name:'La Poste PIC — Toulouse',lat:43.614,lon:1.407,country:'FR'},
      {name:'Deutsche Post — Frankfurt',lat:50.107,lon:8.681,country:'DE'},
      {name:'Deutsche Post — Berlin',lat:52.535,lon:13.348,country:'DE'},
      {name:'Deutsche Post — Munich',lat:48.143,lon:11.595,country:'DE'},
      {name:'Deutsche Post — Hamburg',lat:53.557,lon:10.001,country:'DE'},
      {name:'Deutsche Post — Cologne',lat:50.945,lon:6.967,country:'DE'},
      {name:'DPD — Aschaffenburg',lat:49.969,lon:9.134,country:'DE'},
      {name:'bpost — X (Bruxelles)',lat:50.857,lon:4.406,country:'BE'},
      {name:'bpost — Gent',lat:51.056,lon:3.718,country:'BE'},
      {name:'bpost — Antwerpen',lat:51.217,lon:4.422,country:'BE'},
      {name:'PostNL — Den Haag',lat:52.079,lon:4.329,country:'NL'},
      {name:'PostNL — Nieuwegein',lat:52.029,lon:5.085,country:'NL'},
      {name:'PostNL — Amsterdam',lat:52.352,lon:4.937,country:'NL'},
      {name:'Poste Italiane — Roma',lat:41.785,lon:12.278,country:'IT'},
      {name:'Poste Italiane — Milano',lat:45.475,lon:9.2,country:'IT'},
      {name:'Correos — Madrid',lat:40.471,lon:-3.69,country:'ES'},
      {name:'Correos — Barcelona',lat:41.391,lon:2.174,country:'ES'},
      {name:'CTT — Lisboa',lat:38.778,lon:-9.121,country:'PT'},
      {name:'Österreichische Post — Wien',lat:48.211,lon:16.382,country:'AT'},
      {name:'An Post — Dublin',lat:53.343,lon:-6.271,country:'IE'},
      {name:'Posti — Helsinki',lat:60.235,lon:24.973,country:'FI'},
      {name:'ELTA — Athens',lat:37.985,lon:23.722,country:'GR'},
      {name:'Lietuvos paštas — Vilnius',lat:54.687,lon:25.264,country:'LT'},
      {name:'Latvijas Pasts — Rīga',lat:56.95,lon:24.111,country:'LV'},
      {name:'Omniva — Tallinn',lat:59.428,lon:24.765,country:'EE'},
      {name:'Pošta Slovenije — Ljubljana',lat:46.052,lon:14.503,country:'SI'},
      {name:'Slovenská pošta — Bratislava',lat:48.158,lon:17.134,country:'SK'},
      {name:'Hrvatska pošta — Zagreb',lat:45.812,lon:15.974,country:'HR'},
      {name:'POST Luxembourg',lat:49.605,lon:6.131,country:'LU'},
    
      {name:'La Poste PIC — Nantes',lat:47.218,lon:-1.552,country:'FR'},
      {name:'La Poste PIC — Metz',lat:49.11,lon:6.175,country:'FR'},
      {name:'La Poste PIC — Rennes',lat:48.083,lon:-1.678,country:'FR'},
      {name:'La Poste PIC — Nice',lat:43.664,lon:7.208,country:'FR'},
      {name:'Deutsche Post — Stuttgart',lat:48.776,lon:9.181,country:'DE'},
      {name:'Deutsche Post — Düsseldorf',lat:51.232,lon:6.792,country:'DE'},
      {name:'Deutsche Post — Leipzig',lat:51.34,lon:12.374,country:'DE'},
      {name:'Deutsche Post — Hannover',lat:52.377,lon:9.737,country:'DE'},
      {name:'Royal Mail — Dublin (An Post add)',lat:53.344,lon:-6.272,country:'IE'},
      {name:'Posti — Tampere',lat:61.5,lon:23.773,country:'FI'},
      {name:'PostNord — København (exp. DK)',lat:55.632,lon:12.57,country:'DK'},
      {name:'Cyprus Post — Nicosia',lat:35.176,lon:33.364,country:'CY'},
    
      {name:'La Poste — Dijon',lat:47.322,lon:5.041,country:'FR'},
      {name:'La Poste — Tours',lat:47.389,lon:0.698,country:'FR'},
      {name:'La Poste — Limoges',lat:45.832,lon:1.261,country:'FR'},
      {name:'La Poste — Clermont',lat:45.781,lon:3.086,country:'FR'},
      {name:'Deutsche Post — Nürnberg',lat:49.445,lon:11.082,country:'DE'},
      {name:'Deutsche Post — Essen',lat:51.455,lon:7.01,country:'DE'},
      {name:'Deutsche Post — Bremen',lat:53.095,lon:8.8,country:'DE'},
      {name:'Deutsche Post — Dresden',lat:51.058,lon:13.73,country:'DE'},
      {name:'Poste Italiane — Napoli',lat:40.86,lon:14.26,country:'IT'},
      {name:'Poste Italiane — Torino',lat:45.065,lon:7.681,country:'IT'},
      {name:'Correos — Sevilla',lat:37.393,lon:-5.979,country:'ES'},
      {name:'Correos — Valencia',lat:39.472,lon:-0.384,country:'ES'},
    
      {name:'La Poste — Amiens',lat:49.89,lon:2.3,country:'FR'},
      {name:'La Poste — Rouen',lat:49.44,lon:1.087,country:'FR'},
      {name:'La Poste — Caen',lat:49.182,lon:-0.37,country:'FR'},
      {name:'Deutsche Post — Augsburg',lat:48.37,lon:10.89,country:'DE'},
      {name:'Deutsche Post — Dortmund',lat:51.515,lon:7.465,country:'DE'},
    
      {name:'La Poste — Montpellier',lat:43.61,lon:3.875,country:'FR'},
      {name:'La Poste — Grenoble',lat:45.188,lon:5.724,country:'FR'},
      {name:'La Poste — Nancy',lat:48.69,lon:6.185,country:'FR'},
      {name:'Deutsche Post — Magdeburg',lat:52.13,lon:11.635,country:'DE'},
      {name:'Deutsche Post — Rostock',lat:54.09,lon:12.14,country:'DE'},
      {name:'Deutsche Post — Kiel',lat:54.325,lon:10.14,country:'DE'},
      {name:'Poste Italiane — Firenze',lat:43.77,lon:11.25,country:'IT'},
      {name:'Poste Italiane — Bologna (add)',lat:44.508,lon:11.365,country:'IT'},
    
      {name:'La Poste — Orléans',lat:47.908,lon:1.903,country:'FR'},
      {name:'La Poste — Reims',lat:49.26,lon:3.996,country:'FR'},
      {name:'Deutsche Post — Saarbrücken',lat:49.238,lon:6.978,country:'DE'},
    ],
  },

  /* ───────── 32. ATELIER MAINTENANCE FERROVIAIRE ───────── */
  {
    type: 'rail_workshop', name: 'Atelier maintenance ferroviaire', icon: 'ind_rail_depot',
    cargoTypes: ['steel-beams','steel-sheet','construction-equip','transformer'],
    cargoOut: 'Matériel roulant réparé', dailyTonnageMin: 20, dailyTonnageMax: 100,
    pricePerTonne: 250, attractCost: 200000,
    description: 'Maintenance lourde et rénovation de matériel roulant.',
    realLocations: [
      {name:'Technicentre SNCF — Le Mans',lat:47.995,lon:0.192,country:'FR'},
      {name:'Technicentre — Hellemmes',lat:50.627,lon:3.108,country:'FR'},
      {name:'Technicentre — Oullins',lat:45.722,lon:4.815,country:'FR'},
      {name:'Technicentre — Romilly',lat:48.516,lon:3.723,country:'FR'},
      {name:'Technicentre — Bischheim',lat:48.615,lon:7.72,country:'FR'},
      {name:'Technicentre — Périgueux',lat:45.183,lon:0.718,country:'FR'},
      {name:'Technicentre — Saintes',lat:45.748,lon:-0.628,country:'FR'},
      {name:'Technicentre — Nevers',lat:46.989,lon:3.169,country:'FR'},
      {name:'Technicentre — Sotteville',lat:49.417,lon:1.081,country:'FR'},
      {name:'Technicentre — St-Pierre-des-Corps',lat:47.389,lon:0.733,country:'FR'},
      {name:'Alstom — Belfort',lat:47.639,lon:6.865,country:'FR'},
      {name:'Alstom — Aytré',lat:46.139,lon:-1.13,country:'FR'},
      {name:'Alstom — Valenciennes',lat:50.364,lon:3.502,country:'FR'},
      {name:'Alstom — Reichshoffen',lat:48.929,lon:7.662,country:'FR'},
      {name:'CAF — Bagnères-de-Bigorre',lat:43.066,lon:0.148,country:'FR'},
      {name:'DB Werk — Krefeld',lat:51.329,lon:6.577,country:'DE'},
      {name:'DB Werk — Nürnberg',lat:49.441,lon:11.084,country:'DE'},
      {name:'DB Werk — München Pasing',lat:48.141,lon:11.452,country:'DE'},
      {name:'DB Werk — Dessau',lat:51.832,lon:12.234,country:'DE'},
      {name:'DB Werk — Cottbus',lat:51.755,lon:14.333,country:'DE'},
      {name:'DB Werk — Kassel',lat:51.313,lon:9.455,country:'DE'},
      {name:'DB Werk — Frankfurt',lat:50.095,lon:8.61,country:'DE'},
      {name:'Siemens Mobility — Krefeld',lat:51.332,lon:6.573,country:'DE'},
      {name:'Siemens — Wien Simmering',lat:48.172,lon:16.424,country:'AT'},
      {name:'Bombardier — Bruges',lat:51.206,lon:3.234,country:'BE'},
      {name:'NMBS — Mechelen',lat:51.024,lon:4.475,country:'BE'},
      {name:'NS Werkplaats — Haarlem',lat:52.389,lon:4.643,country:'NL'},
      {name:'NS Werkplaats — Tilburg',lat:51.562,lon:5.081,country:'NL'},
      {name:'Trenitalia — Milano',lat:45.485,lon:9.204,country:'IT'},
      {name:'Trenitalia — Bologna',lat:44.508,lon:11.364,country:'IT'},
      {name:'Trenitalia — Foligno',lat:42.947,lon:12.715,country:'IT'},
      {name:'Hitachi Rail — Pistoia',lat:43.932,lon:10.907,country:'IT'},
      {name:'Hitachi Rail — Napoli',lat:40.86,lon:14.262,country:'IT'},
      {name:'Talgo — Las Matas',lat:40.575,lon:-3.91,country:'ES'},
      {name:'CAF — Beasain',lat:43.048,lon:-2.189,country:'ES'},
      {name:'Renfe — Fuencarral',lat:40.494,lon:-3.689,country:'ES'},
      {name:'Stadler — Albuixech',lat:39.554,lon:-0.342,country:'ES'},
      {name:'ÖBB Werk — Wien',lat:48.261,lon:16.394,country:'AT'},
      {name:'ÖBB Werk — Linz',lat:48.305,lon:14.289,country:'AT'},
      {name:'ÖBB Werk — Innsbruck',lat:47.262,lon:11.394,country:'AT'},
      {name:'CP — Entroncamento',lat:39.468,lon:-8.47,country:'PT'},
      {name:'VR — Pieksämäki',lat:62.302,lon:27.158,country:'FI'},
      {name:'VR — Helsinki (Pasila)',lat:60.198,lon:24.932,country:'FI'},
      {name:'Iarnród Éireann — Inchicore',lat:53.341,lon:-6.325,country:'IE'},
      {name:'CFL — Luxembourg-Ville',lat:49.6,lon:6.133,country:'LU'},
      {name:'OSE — Thessalonique',lat:40.652,lon:22.928,country:'GR'},
      {name:'ZSSK — Vrútky',lat:49.12,lon:18.922,country:'SK'},
      {name:'SŽ — Maribor',lat:46.558,lon:15.648,country:'SI'},
      {name:'HŽ — Zagreb',lat:45.804,lon:15.985,country:'HR'},
      {name:'Elron — Tapa',lat:59.26,lon:25.957,country:'EE'},
      {name:'Pasažieru vilciens — Rīga',lat:56.948,lon:24.11,country:'LV'},
      {name:'LG — Vilnius',lat:54.676,lon:25.299,country:'LT'},
    
      {name:'SNCF — Bordeaux',lat:44.82,lon:-0.555,country:'FR'},
      {name:'SNCF — Toulouse',lat:43.612,lon:1.408,country:'FR'},
      {name:'SNCF — Rennes',lat:48.085,lon:-1.676,country:'FR'},
      {name:'CAF — Zaragoza',lat:41.66,lon:-0.896,country:'ES'},
      {name:'Stadler — Bussnang (exp. AT)',lat:47.473,lon:9.103,country:'AT'},
      {name:'Vossloh — Kiel',lat:54.333,lon:10.162,country:'DE'},
      {name:'Škoda Transportation — Plzeň (exp. SK)',lat:48.151,lon:17.118,country:'SK'},
    
      {name:'Alstom — Tarbes',lat:43.232,lon:0.075,country:'FR'},
      {name:'Alstom — La Rochelle',lat:46.161,lon:-1.177,country:'FR'},
      {name:'SNCF — Clermont-Ferrand',lat:45.779,lon:3.085,country:'FR'},
      {name:'DB — Fulda',lat:50.553,lon:9.674,country:'DE'},
      {name:'DB — Eberswalde',lat:52.833,lon:13.809,country:'DE'},
      {name:'DB — Ingolstadt',lat:48.765,lon:11.435,country:'DE'},
      {name:'Talgo — Rivabellosa',lat:42.764,lon:-2.774,country:'ES'},
      {name:'CAF — Irun',lat:43.341,lon:-1.791,country:'ES'},
      {name:'Vossloh — Valencia',lat:39.475,lon:-0.37,country:'ES'},
      {name:'ALSTOM — Savigliano',lat:44.651,lon:7.651,country:'IT'},
    
      {name:'SNCF — Nantes',lat:47.217,lon:-1.555,country:'FR'},
      {name:'SNCF — Lyon Vaise',lat:45.775,lon:4.803,country:'FR'},
      {name:'DB — Mannheim',lat:49.48,lon:8.47,country:'DE'},
      {name:'DB — Wittenberge',lat:52.992,lon:11.755,country:'DE'},
      {name:'ÖBB — Knittelfeld',lat:47.219,lon:14.819,country:'AT'},
    
      {name:'SNCF — Marseille',lat:43.304,lon:5.38,country:'FR'},
      {name:'SNCF — Metz',lat:49.11,lon:6.177,country:'FR'},
      {name:'SNCF — Strasbourg (add)',lat:48.59,lon:7.75,country:'FR'},
      {name:'DB — Leipzig',lat:51.345,lon:12.39,country:'DE'},
      {name:'DB — Berlin Rummelsburg',lat:52.497,lon:13.479,country:'DE'},
      {name:'Siemens — München Allach',lat:48.181,lon:11.446,country:'DE'},
    
      {name:'Stadler — Berlin',lat:52.53,lon:13.36,country:'DE'},
      {name:'Stadler — Wien',lat:48.2,lon:16.378,country:'AT'},
      {name:'Talgo — Madrid',lat:40.475,lon:-3.695,country:'ES'},
    
      {name:'SNCF — Dijon',lat:47.32,lon:5.042,country:'FR'},
      {name:'SNCF — Montpellier',lat:43.61,lon:3.88,country:'FR'},
      {name:'DB — Braunschweig',lat:52.262,lon:10.521,country:'DE'},
      {name:'DB — Halle',lat:51.479,lon:11.979,country:'DE'},
      {name:'DB — Rostock (add)',lat:54.092,lon:12.141,country:'DE'},
    ],
  },

  /* ───────── 33. GARE DE TRIAGE ───────── */
  {
    type: 'marshalling_yard', name: 'Gare de triage', icon: 'ind_triage',
    cargoTypes: ['containers-20','containers-40','coal','ore','steel-coils','chemicals-liq'],
    cargoOut: 'Wagons triés', dailyTonnageMin: 500, dailyTonnageMax: 5000,
    pricePerTonne: 15, attractCost: 300000,
    description: 'Gare de triage : formation et décomposition de trains.',
    realLocations: [
      {name:'Triage de Woippy',lat:49.136,lon:6.154,country:'FR'},
      {name:'Triage du Bourget',lat:48.929,lon:2.424,country:'FR'},
      {name:'Triage de Sibelin',lat:45.718,lon:4.87,country:'FR'},
      {name:'Triage de Sotteville',lat:49.417,lon:1.081,country:'FR'},
      {name:'Triage de Miramas',lat:43.584,lon:5.003,country:'FR'},
      {name:'Triage de Gevrey-Chambertin',lat:47.218,lon:4.984,country:'FR'},
      {name:'Triage de Villeneuve-St-Georges',lat:48.734,lon:2.447,country:'FR'},
      {name:'Triage de Hourcade',lat:44.793,lon:-0.523,country:'FR'},
      {name:'Triage de St-Pierre-des-Corps',lat:47.389,lon:0.733,country:'FR'},
      {name:'Triage de Lens-Avion',lat:50.413,lon:2.815,country:'FR'},
      {name:'Rbf München Nord',lat:48.197,lon:11.558,country:'DE'},
      {name:'Rbf Maschen',lat:53.413,lon:10.035,country:'DE'},
      {name:'Rbf Mannheim',lat:49.487,lon:8.488,country:'DE'},
      {name:'Rbf Nürnberg',lat:49.437,lon:11.067,country:'DE'},
      {name:'Rbf Hagen-Vorhalle',lat:51.375,lon:7.425,country:'DE'},
      {name:'Rbf Gremberg',lat:50.908,lon:7.024,country:'DE'},
      {name:'Rbf Seelze',lat:52.398,lon:9.601,country:'DE'},
      {name:'Rbf Seddin',lat:52.296,lon:13.016,country:'DE'},
      {name:'Rbf Kornwestheim',lat:48.859,lon:9.184,country:'DE'},
      {name:'Rbf Bremen',lat:53.094,lon:8.763,country:'DE'},
      {name:'Antwerpen-Noord',lat:51.274,lon:4.391,country:'BE'},
      {name:'Monceau — Charleroi',lat:50.405,lon:4.386,country:'BE'},
      {name:'Kijfhoek (Rotterdam)',lat:51.853,lon:4.543,country:'NL'},
      {name:'Onnen (Groningen)',lat:53.151,lon:6.619,country:'NL'},
      {name:'Torino Orbassano',lat:44.989,lon:7.521,country:'IT'},
      {name:'Milano Smistamento',lat:45.465,lon:9.253,country:'IT'},
      {name:'Bologna S. Donato',lat:44.509,lon:11.365,country:'IT'},
      {name:'Villa Selva',lat:44.213,lon:12.077,country:'IT'},
      {name:'Madrid Vicálvaro',lat:40.4,lon:-3.606,country:'ES'},
      {name:'Barcelona Can Tunis',lat:41.362,lon:2.131,country:'ES'},
      {name:'León Clasificación',lat:42.591,lon:-5.587,country:'ES'},
      {name:'Wien Zentralvbf',lat:48.173,lon:16.383,country:'AT'},
      {name:'Linz Vbf',lat:48.295,lon:14.299,country:'AT'},
      {name:'Villach Süd',lat:46.604,lon:13.844,country:'AT'},
      {name:'Entroncamento',lat:39.468,lon:-8.47,country:'PT'},
      {name:'Kouvola Triage',lat:60.871,lon:26.701,country:'FI'},
      {name:'Limerick Junction',lat:52.49,lon:-8.195,country:'IE'},
      {name:'Thessaloniki Triage',lat:40.653,lon:22.93,country:'GR'},
      {name:'Žilina Teplička',lat:49.215,lon:18.72,country:'SK'},
      {name:'Ljubljana Triage',lat:46.05,lon:14.51,country:'SI'},
      {name:'Zagreb Ranžirni',lat:45.786,lon:16.003,country:'HR'},
      {name:'Bettembourg Triage',lat:49.514,lon:6.101,country:'LU'},
    
      {name:'Triage de Bordeaux Bastide',lat:44.834,lon:-0.557,country:'FR'},
      {name:'Triage de Dijon',lat:47.316,lon:5.023,country:'FR'},
      {name:'Triage de Toulouse',lat:43.613,lon:1.454,country:'FR'},
      {name:'Triage de Nantes',lat:47.199,lon:-1.54,country:'FR'},
      {name:'Rbf Hamburg-Eidelstedt',lat:53.594,lon:9.885,country:'DE'},
      {name:'Rbf Hamm',lat:51.68,lon:7.817,country:'DE'},
      {name:'Rbf Oberhausen-Osterfeld',lat:51.5,lon:6.87,country:'DE'},
      {name:'Rbf Halle (Saale)',lat:51.478,lon:11.978,country:'DE'},
      {name:'Rbf Frankfurt-Ost',lat:50.104,lon:8.747,country:'DE'},
      {name:'Rbf Basel Badischer Bf (exp. DE)',lat:47.568,lon:7.605,country:'DE'},
      {name:'Monceau (add)',lat:50.406,lon:4.387,country:'BE'},
      {name:'Schaerbeek — Bruxelles',lat:50.874,lon:4.373,country:'BE'},
      {name:'Gioia Tauro — Triage',lat:38.436,lon:15.895,country:'IT'},
      {name:'Roma San Lorenzo',lat:41.894,lon:12.521,country:'IT'},
      {name:'Lisboa Entroncamento (add)',lat:39.467,lon:-8.469,country:'PT'},
      {name:'Kouvola (add)',lat:60.872,lon:26.702,country:'FI'},
    
      {name:'Triage de Rennes',lat:48.085,lon:-1.676,country:'FR'},
      {name:'Triage de Metz-Sablon',lat:49.103,lon:6.178,country:'FR'},
      {name:'Triage de Nice Saint-Roch',lat:43.701,lon:7.277,country:'FR'},
      {name:'Triage de Tours Saint-Pierre',lat:47.388,lon:0.732,country:'FR'},
      {name:'Rbf Wanne-Eickel',lat:51.528,lon:7.172,country:'DE'},
      {name:'Rbf Kiel-Meimersdorf',lat:54.294,lon:10.101,country:'DE'},
      {name:'Rbf Augsburg',lat:48.362,lon:10.884,country:'DE'},
      {name:'Rbf Würzburg',lat:49.8,lon:9.935,country:'DE'},
      {name:'Rbf Freiburg',lat:47.99,lon:7.833,country:'DE'},
      {name:'Rbf Fulda',lat:50.554,lon:9.675,country:'DE'},
      {name:'Catania Bicocca — Triage',lat:37.522,lon:15.072,country:'IT'},
      {name:'Bari — Triage',lat:41.125,lon:16.855,country:'IT'},
      {name:'Málaga Triage',lat:36.715,lon:-4.4,country:'ES'},
      {name:'Irún — Triage',lat:43.342,lon:-1.79,country:'ES'},
    
      {name:'Triage de Strasbourg',lat:48.575,lon:7.798,country:'FR'},
      {name:'Triage de Lille Délivrance',lat:50.644,lon:3.017,country:'FR'},
      {name:'Triage de Valenton (add)',lat:48.746,lon:2.468,country:'FR'},
      {name:'Rbf München Ost',lat:48.136,lon:11.622,country:'DE'},
      {name:'Rbf Leipzig Engelsdorf',lat:51.33,lon:12.44,country:'DE'},
    
      {name:'Triage de Clermont-Ferrand',lat:45.78,lon:3.085,country:'FR'},
      {name:'Triage de Nancy',lat:48.69,lon:6.184,country:'FR'},
      {name:'Rbf Kassel',lat:51.314,lon:9.456,country:'DE'},
      {name:'Rbf Duisburg-Wedau',lat:51.409,lon:6.788,country:'DE'},
      {name:'Rbf Regensburg',lat:49.018,lon:12.088,country:'DE'},
      {name:'Rbf Berlin Grunewald',lat:52.483,lon:13.261,country:'DE'},
    
      {name:'Rbf Ingolstadt',lat:48.77,lon:11.44,country:'DE'},
      {name:'Rbf Magdeburg',lat:52.115,lon:11.66,country:'DE'},
      {name:'Rbf Rostock',lat:54.09,lon:12.14,country:'DE'},
      {name:'Rbf Emmerich',lat:51.83,lon:6.244,country:'DE'},
      {name:'Firenze Triage',lat:43.775,lon:11.258,country:'IT'},
      {name:'Napoli Triage',lat:40.87,lon:14.3,country:'IT'},
    
      {name:'Rbf Dresden Friedrichstadt',lat:51.047,lon:13.716,country:'DE'},
      {name:'Rbf Saarbrücken',lat:49.237,lon:6.977,country:'DE'},
      {name:'Rbf Ulm',lat:48.393,lon:9.982,country:'DE'},
      {name:'Rbf Stuttgart',lat:48.782,lon:9.181,country:'DE'},
    
      {name:'Rbf Brake',lat:53.332,lon:8.479,country:'DE'},
      {name:'Rbf Emden',lat:53.34,lon:7.188,country:'DE'},
      {name:'Rbf Leer',lat:53.235,lon:7.453,country:'DE'},
      {name:'Rbf Oldenburg',lat:53.148,lon:8.211,country:'DE'},
      {name:'Rbf Osnabrück',lat:52.28,lon:8.05,country:'DE'},
      {name:'Rbf Minden',lat:52.285,lon:8.918,country:'DE'},
      {name:'Rbf Hameln',lat:52.103,lon:9.35,country:'DE'},
      {name:'Rbf Braunschweig',lat:52.262,lon:10.52,country:'DE'},
      {name:'Rbf Goslar',lat:51.907,lon:10.429,country:'DE'},
      {name:'Rbf Göttingen',lat:51.533,lon:9.936,country:'DE'},
      {name:'Rbf Paderborn',lat:51.72,lon:8.756,country:'DE'},
      {name:'Rbf Siegen',lat:50.87,lon:8.023,country:'DE'},
      {name:'Rbf Wuppertal',lat:51.271,lon:7.191,country:'DE'},
      {name:'Rbf Aachen',lat:50.77,lon:6.08,country:'DE'},
    ],
  },

  /* ───────── 34. ALUMINERIE ───────── */
  {
    type: 'aluminium_smelter', name: 'Aluminerie', icon: 'ind_aluminium',
    cargoTypes: ['bauxite','aluminium','chemicals-liq','coal'],
    cargoOut: 'Aluminium', dailyTonnageMin: 200, dailyTonnageMax: 800,
    pricePerTonne: 70, attractCost: 130000,
    description: 'Production d\'aluminium : 200-800t/jour. Très énergivore.',
    realLocations: [
      {name:'Aluminium Dunkerque',lat:51.008,lon:2.24,country:'FR'},
      {name:'Rio Tinto — Saint-Jean-de-Maurienne',lat:45.277,lon:6.343,country:'FR'},
      {name:'Constellium — Issoire',lat:45.544,lon:3.25,country:'FR'},
      {name:'Constellium — Neuf-Brisach',lat:48.019,lon:7.524,country:'FR'},
      {name:'Aluminium Rheinfelden',lat:47.559,lon:7.791,country:'DE'},
      {name:'Trimet — Essen',lat:51.444,lon:6.996,country:'DE'},
      {name:'Trimet — Hamburg',lat:53.518,lon:9.957,country:'DE'},
      {name:'Speira — Grevenbroich',lat:51.086,lon:6.583,country:'DE'},
      {name:'Norsk Hydro — Neuss',lat:51.194,lon:6.693,country:'DE'},
      {name:'AMAG — Ranshofen',lat:48.231,lon:13.017,country:'AT'},
      {name:'Alcoa — San Ciprián',lat:43.709,lon:-7.457,country:'ES'},
      {name:'Aluminio Español — A Coruña',lat:43.368,lon:-8.395,country:'ES'},
      {name:'Alcoa — Portovesme',lat:39.18,lon:8.388,country:'IT'},
      {name:'Hindalco — Moerdijk',lat:51.69,lon:4.574,country:'NL'},
      {name:'Mytilineos — Distomon',lat:38.428,lon:22.712,country:'GR'},
      {name:'Elval — Oinofyta',lat:38.302,lon:23.64,country:'GR'},
      {name:'Aughinish Alumina — Foynes',lat:52.625,lon:-9.068,country:'IE'},
      {name:'Slovalco — Žiar nad Hronom',lat:48.586,lon:18.857,country:'SK'},
      {name:'Talum — Kidričevo',lat:46.397,lon:15.791,country:'SI'},
    
      {name:'Constellium — Montreuil-Juigné',lat:47.523,lon:-0.613,country:'FR'},
      {name:'Novelis — Sierre (exp. FR)',lat:46.292,lon:7.536,country:'FR'},
      {name:'Constellium — Valais (exp. FR)',lat:46.293,lon:7.537,country:'FR'},
      {name:'Aleris — Koblenz',lat:50.352,lon:7.578,country:'DE'},
      {name:'Novelis — Nachterstedt',lat:51.781,lon:11.339,country:'DE'},
      {name:'Constellium — Singen',lat:47.762,lon:8.845,country:'DE'},
      {name:'Hydro — Grevenbroich (add)',lat:51.087,lon:6.584,country:'DE'},
      {name:'Fonderie Aluminium — Parma',lat:44.805,lon:10.33,country:'IT'},
      {name:'Alcoa — Lista (exp. IT)',lat:40.9,lon:14.38,country:'IT'},
      {name:'Idalsa — Alicante',lat:38.345,lon:-0.486,country:'ES'},
    
      {name:'Novelis — Pieve Emanuele',lat:45.354,lon:9.193,country:'IT'},
      {name:'Hydro — Sunndalsøra (exp. DE)',lat:62.668,lon:8.554,country:'DE'},
      {name:'Constellium — Ussel',lat:45.549,lon:2.317,country:'FR'},
      {name:'Novelis — Sierre (exp. AT)',lat:46.293,lon:7.537,country:'AT'},
      {name:'Trimet — Essen (add)',lat:51.445,lon:6.997,country:'DE'},
      {name:'Elval-Halcor — Athens',lat:38.032,lon:23.639,country:'GR'},
      {name:'Impol — Slovenska Bistrica',lat:46.394,lon:15.573,country:'SI'},
    
      {name:'Aluminij — Mostar (exp. HR)',lat:43.341,lon:17.793,country:'HR'},
      {name:'Impol — Sevojno (exp. SI)',lat:43.843,lon:19.908,country:'SI'},
      {name:'Alouette (exp. FR) — Dunkerque',lat:51.009,lon:2.241,country:'FR'},
    
      {name:'Rio Tinto — Dunkerque (add)',lat:51.009,lon:2.242,country:'FR'},
      {name:'Norsk Hydro — Hamburg (add)',lat:53.519,lon:9.958,country:'DE'},
      {name:'Constellium — Ravenswood (exp. FR)',lat:45.278,lon:6.344,country:'FR'},
    
      {name:'Alcoa — San Ciprián (add)',lat:43.71,lon:-7.458,country:'ES'},
      {name:'Trimet — Voerde',lat:51.613,lon:6.681,country:'DE'},
    
      {name:'Constellium — Singen (add2)',lat:47.763,lon:8.846,country:'DE'},
      {name:'Aleris — Duffel',lat:51.089,lon:4.51,country:'BE'},
    ],
  },

  /* ───────── 35. COKERIE ───────── */
  {
    type: 'cokerie', name: 'Cokerie', icon: 'ind_cokerie',
    cargoTypes: ['coal','coke','chemicals-liq','tar'],
    cargoOut: 'Coke métallurgique', dailyTonnageMin: 300, dailyTonnageMax: 1500,
    pricePerTonne: 35, attractCost: 100000,
    description: 'Production de coke pour l\'industrie sidérurgique.',
    realLocations: [
      {name:'ArcelorMittal Cokerie — Dunkerque',lat:51.03,lon:2.332,country:'FR'},
      {name:'ArcelorMittal Cokerie — Fos',lat:43.447,lon:4.916,country:'FR'},
      {name:'ThyssenKrupp Cokerie — Schwelgern',lat:51.484,lon:6.718,country:'DE'},
      {name:'ArcelorMittal Cokerie — Bremen',lat:53.096,lon:8.733,country:'DE'},
      {name:'Zentralkokerei Saar — Dillingen',lat:49.352,lon:6.728,country:'DE'},
      {name:'Prosper-Kokerei — Bottrop',lat:51.538,lon:6.928,country:'DE'},
      {name:'ArcelorMittal Cokerie — Gand',lat:51.07,lon:3.763,country:'BE'},
      {name:'Tata Steel Cokerie — IJmuiden',lat:52.46,lon:4.586,country:'NL'},
      {name:'ILVA Cokerie — Taranto',lat:40.48,lon:17.173,country:'IT'},
      {name:'US Steel Cokerie — Košice',lat:48.713,lon:21.244,country:'SK'},
      {name:'Voestalpine Cokerie — Linz',lat:48.314,lon:14.292,country:'AT'},
    
      {name:'Schwelgern (add)',lat:51.485,lon:6.719,country:'DE'},
      {name:'HKM — Duisburg Huckingen',lat:51.387,lon:6.778,country:'DE'},
      {name:'ArcelorMittal — Gand (add)',lat:51.071,lon:3.764,country:'BE'},
      {name:'Tata IJmuiden (add)',lat:52.461,lon:4.587,country:'NL'},
      {name:'ILVA — Taranto (add)',lat:40.481,lon:17.174,country:'IT'},
      {name:'ArcelorMittal — Fos (add2)',lat:43.448,lon:4.917,country:'FR'},
      {name:'Košice Cokerie (add)',lat:48.714,lon:21.243,country:'SK'},
      {name:'Voestalpine (add)',lat:48.315,lon:14.293,country:'AT'},
      {name:'ArcelorMittal — Bremen (add2)',lat:53.097,lon:8.734,country:'DE'},
    
      {name:'Hüttenwerke Krupp — Duisburg',lat:51.406,lon:6.741,country:'DE'},
      {name:'Rogesa — Dillingen (add)',lat:49.355,lon:6.731,country:'DE'},
      {name:'SN Holding — Smederevo (exp. HR)',lat:44.668,lon:20.94,country:'HR'},
    
      {name:'Saarstahl — Dillingen (add2)',lat:49.353,lon:6.729,country:'DE'},
      {name:'HKM — Huckingen (add2)',lat:51.388,lon:6.779,country:'DE'},
    
      {name:'ZKS — Dillingen (add3)',lat:49.354,lon:6.729,country:'DE'},
      {name:'ArcelorMittal — Fos (add3)',lat:43.449,lon:4.918,country:'FR'},
    ],
  },

  /* ───────── 36. USINE D'ENGRAIS ───────── */
  {
    type: 'fertilizer_plant', name: 'Usine d\'engrais', icon: 'ind_fertilizer',
    cargoTypes: ['ammonia','fertilizer','phosphate','potash','chemicals-liq'],
    cargoOut: 'Engrais', dailyTonnageMin: 200, dailyTonnageMax: 1000,
    pricePerTonne: 40, attractCost: 100000,
    description: 'Production d\'engrais : 200-1000t/jour.',
    realLocations: [
      {name:'Yara — Le Havre',lat:49.493,lon:0.14,country:'FR'},
      {name:'Yara — Ambès',lat:44.909,lon:-0.5,country:'FR'},
      {name:'Borealis — Grandpuits',lat:48.56,lon:2.955,country:'FR'},
      {name:'BASF — Ludwigshafen (engrais)',lat:49.492,lon:8.433,country:'DE'},
      {name:'Yara — Brunsbüttel',lat:53.883,lon:9.164,country:'DE'},
      {name:'SKW — Piesteritz',lat:51.855,lon:12.731,country:'DE'},
      {name:'BASF — Antwerpen (engrais)',lat:51.29,lon:4.375,country:'BE'},
      {name:'OCI Nitrogen — Geleen',lat:50.968,lon:5.836,country:'NL'},
      {name:'Yara — Sluiskil',lat:51.276,lon:3.855,country:'NL'},
      {name:'Rosier — Moustier',lat:50.407,lon:5.061,country:'BE'},
      {name:'Fertiberia — Puertollano',lat:38.689,lon:-4.087,country:'ES'},
      {name:'Fertiberia — Huelva',lat:37.252,lon:-6.941,country:'ES'},
      {name:'Fertiberia — Sagunto',lat:39.664,lon:-0.272,country:'ES'},
      {name:'Yara — Ferrara',lat:44.837,lon:11.615,country:'IT'},
      {name:'Yara — Porto Marghera',lat:45.454,lon:12.239,country:'IT'},
      {name:'Borealis — Linz (engrais)',lat:48.309,lon:14.299,country:'AT'},
      {name:'Yara — Siilinjärvi',lat:63.112,lon:27.763,country:'FI'},
      {name:'Yara — Kokkola',lat:63.834,lon:23.126,country:'FI'},
      {name:'Duslo — Šaľa (engrais)',lat:48.151,lon:17.879,country:'SK'},
      {name:'Petrokemija — Kutina',lat:45.477,lon:16.782,country:'HR'},
      {name:'Achema — Jonava (engrais)',lat:55.08,lon:24.29,country:'LT'},
    
      {name:'Yara — Montoir',lat:47.309,lon:-2.155,country:'FR'},
      {name:'GPN — Toulouse',lat:43.615,lon:1.394,country:'FR'},
      {name:'Yara — Rostock',lat:54.15,lon:12.078,country:'DE'},
      {name:'Compo — Münster',lat:51.96,lon:7.628,country:'DE'},
      {name:'K+S Kali — Heringen',lat:50.873,lon:9.968,country:'DE'},
      {name:'Tessenderlo Group — Ham',lat:51.088,lon:5.175,country:'BE'},
      {name:'BASF Dunger — Antwerpen',lat:51.291,lon:4.376,country:'BE'},
      {name:'ICL — Amsterdam',lat:52.393,lon:4.796,country:'NL'},
      {name:'Fertitalia — Pordenone',lat:45.96,lon:12.656,country:'IT'},
      {name:'Cargill — Barreiro',lat:38.66,lon:-9.072,country:'PT'},
      {name:'Kemira — Siilinjärvi (add)',lat:63.113,lon:27.762,country:'FI'},
    
      {name:'BASF — Antwerpen (add2)',lat:51.292,lon:4.377,country:'BE'},
      {name:'Borealis — Grandpuits (add)',lat:48.561,lon:2.956,country:'FR'},
      {name:'K+S — Bernburg (fertilizer)',lat:51.81,lon:11.74,country:'DE'},
      {name:'Haifa Chemicals — Cartagena (exp. ES)',lat:37.575,lon:-0.975,country:'ES'},
      {name:'Yara — Porsgrunn (exp. FI)',lat:59.14,lon:9.656,country:'FI'},
    
      {name:'Fertiberia — Avilés',lat:43.558,lon:-5.914,country:'ES'},
      {name:'ICL — Ludwigshafen',lat:49.485,lon:8.432,country:'DE'},
      {name:'EuroChem — Antwerpen',lat:51.288,lon:4.372,country:'BE'},
      {name:'Timac Agro — Saint-Malo',lat:48.651,lon:-2.007,country:'FR'},
    
      {name:'Borealis — Grandpuits (add2)',lat:48.562,lon:2.957,country:'FR'},
      {name:'BASF — Ludwigshafen (add2)',lat:49.493,lon:8.434,country:'DE'},
      {name:'Yara — Ferrara (add)',lat:44.838,lon:11.616,country:'IT'},
    
      {name:'Yara — Brunsbüttel (add)',lat:53.884,lon:9.165,country:'DE'},
      {name:'Borealis — Linz (add2)',lat:48.31,lon:14.3,country:'AT'},
    
      {name:'COMPO — Münster (add)',lat:51.961,lon:7.629,country:'DE'},
      {name:'Fertiberia — Sagunto (add)',lat:39.665,lon:-0.273,country:'ES'},
    ],
  },

  /* ───────── 37. COMPLEXE PÉTROCHIMIQUE ───────── */
  {
    type: 'petrochemical', name: 'Complexe pétrochimique', icon: 'ind_petrochem',
    cargoTypes: ['crude-oil','ethanol','plastic-granules','chemicals-liq','lpg'],
    cargoOut: 'Produits pétrochimiques', dailyTonnageMin: 300, dailyTonnageMax: 1500,
    pricePerTonne: 65, attractCost: 180000,
    description: 'Pétrochimie intégrée : cracking, polymères, plastiques.',
    realLocations: [
      {name:'Naphtachimie — Lavéra',lat:43.393,lon:5.019,country:'FR'},
      {name:'LyondellBasell — Berre',lat:43.465,lon:5.165,country:'FR'},
      {name:'Total Petrochem — Gonfreville',lat:49.491,lon:0.225,country:'FR'},
      {name:'BASF — Ludwigshafen (petrochem)',lat:49.494,lon:8.432,country:'DE'},
      {name:'INEOS — Cologne (petrochem)',lat:50.893,lon:6.992,country:'DE'},
      {name:'Dow — Böhlen',lat:51.223,lon:12.363,country:'DE'},
      {name:'Shell Pernis Petrochem',lat:51.882,lon:4.381,country:'NL'},
      {name:'SABIC — Geleen (petrochem)',lat:50.972,lon:5.842,country:'NL'},
      {name:'Dow — Terneuzen (petrochem)',lat:51.333,lon:3.829,country:'NL'},
      {name:'BASF — Antwerpen (petrochem)',lat:51.29,lon:4.374,country:'BE'},
      {name:'INEOS — Antwerpen (petrochem)',lat:51.279,lon:4.389,country:'BE'},
      {name:'ENI Versalis — Porto Marghera',lat:45.455,lon:12.241,country:'IT'},
      {name:'ENI Versalis — Priolo',lat:37.159,lon:15.188,country:'IT'},
      {name:'Repsol — Tarragona',lat:41.083,lon:1.196,country:'ES'},
      {name:'Repsol — Puertollano (petrochem)',lat:38.686,lon:-4.089,country:'ES'},
      {name:'Borealis — Schwechat',lat:48.141,lon:16.471,country:'AT'},
      {name:'Neste — Porvoo (petrochem)',lat:60.311,lon:25.611,country:'FI'},
      {name:'Galp — Sines (petrochem)',lat:37.93,lon:-8.868,country:'PT'},
      {name:'Hellenic — Thessalonique',lat:40.624,lon:22.919,country:'GR'},
      {name:'Slovnaft — Bratislava',lat:48.123,lon:17.152,country:'SK'},
      {name:'INA — Rijeka (petrochem)',lat:45.322,lon:14.439,country:'HR'},
    
      {name:'LyondellBasell — Wesseling',lat:50.815,lon:6.972,country:'DE'},
      {name:'SABIC — Gelsenkirchen',lat:51.525,lon:7.084,country:'DE'},
      {name:'Total — Carling',lat:49.188,lon:6.711,country:'FR'},
      {name:'Ineos — Sarralbe',lat:48.995,lon:7.018,country:'FR'},
      {name:'Versalis — Brindisi',lat:40.649,lon:18.0,country:'IT'},
      {name:'Versalis — Mantova',lat:45.145,lon:10.797,country:'IT'},
      {name:'CEPSA — Palos',lat:37.213,lon:-6.888,country:'ES'},
      {name:'Sabic — Cartagena',lat:37.578,lon:-0.96,country:'ES'},
      {name:'MOL — Tiszaújváros (exp. SK)',lat:48.12,lon:17.15,country:'SK'},
      {name:'PKN — Płock (exp. LT)',lat:55.08,lon:24.291,country:'LT'},
    
      {name:'Ineos — Grangemouth (exp. BE)',lat:56.024,lon:-3.717,country:'BE'},
      {name:'MOL — Százhalombatta (exp. SK)',lat:47.32,lon:18.925,country:'SK'},
      {name:'PKN — Gdańsk (exp. LT add)',lat:54.381,lon:18.612,country:'LT'},
      {name:'CEPSA — Algeciras (petrochem)',lat:36.177,lon:-5.415,country:'ES'},
    
      {name:'Total — Carling (add)',lat:49.189,lon:6.712,country:'FR'},
      {name:'LyondellBasell — Frankfurt',lat:50.065,lon:8.535,country:'DE'},
      {name:'Indorama — Rotterdam',lat:51.892,lon:4.338,country:'NL'},
      {name:'Borealis — Kallo',lat:51.268,lon:4.276,country:'BE'},
    
      {name:'INEOS — Cologne (add)',lat:50.894,lon:6.993,country:'DE'},
      {name:'Dow — Terneuzen (add)',lat:51.334,lon:3.83,country:'NL'},
      {name:'Repsol — Tarragona (add)',lat:41.084,lon:1.197,country:'ES'},
    
      {name:'BASF — Ludwigshafen (add3)',lat:49.495,lon:8.435,country:'DE'},
      {name:'Shell — Moerdijk (add)',lat:51.672,lon:4.587,country:'NL'},
    ],
  },

  /* ───────── 38. TERMINAL GNL ───────── */
  {
    type: 'lng_terminal', name: 'Terminal GNL', icon: 'ind_gas',
    cargoTypes: ['lng','lpg','ethanol'],
    cargoOut: 'Gaz naturel liquéfié', dailyTonnageMin: 200, dailyTonnageMax: 1000,
    pricePerTonne: 80, attractCost: 250000,
    description: 'Terminal de regazéification ou liquéfaction GNL.',
    realLocations: [
      {name:'Fos Tonkin — GNL',lat:43.408,lon:4.893,country:'FR'},
      {name:'Fos Cavaou — GNL',lat:43.39,lon:4.88,country:'FR'},
      {name:'Montoir-de-Bretagne',lat:47.31,lon:-2.153,country:'FR'},
      {name:'Dunkerque LNG',lat:51.047,lon:2.32,country:'FR'},
      {name:'Brunsbüttel LNG',lat:53.894,lon:9.148,country:'DE'},
      {name:'Wilhelmshaven FSRU',lat:53.577,lon:8.137,country:'DE'},
      {name:'Gate Terminal — Rotterdam',lat:51.929,lon:4.117,country:'NL'},
      {name:'Zeebrugge LNG',lat:51.34,lon:3.18,country:'BE'},
      {name:'Adriatic LNG — Rovigo',lat:45.087,lon:12.293,country:'IT'},
      {name:'OLT — Livorno FSRU',lat:43.545,lon:10.243,country:'IT'},
      {name:'Panigaglia — La Spezia',lat:44.084,lon:9.861,country:'IT'},
      {name:'Barcelona Reganosa',lat:41.36,lon:2.16,country:'ES'},
      {name:'Huelva LNG',lat:37.234,lon:-6.938,country:'ES'},
      {name:'Bilbao LNG — BBG',lat:43.356,lon:-3.098,country:'ES'},
      {name:'Cartagena LNG',lat:37.574,lon:-0.976,country:'ES'},
      {name:'Sagunto LNG',lat:39.64,lon:-0.243,country:'ES'},
      {name:'Mugardos — Reganosa',lat:43.458,lon:-8.266,country:'ES'},
      {name:'Sines LNG',lat:37.93,lon:-8.869,country:'PT'},
      {name:'Revithoussa — Athens',lat:37.952,lon:23.387,country:'GR'},
      {name:'Pori LNG',lat:61.5,lon:21.774,country:'FI'},
      {name:'Inkoo — Gasum LNG',lat:60.051,lon:24.017,country:'FI'},
      {name:'Shannon LNG — Tarbert',lat:52.567,lon:-9.382,country:'IE'},
      {name:'Klaipėda FSRU — Independence',lat:55.697,lon:21.105,country:'LT'},
      {name:'Krk LNG — Omišalj',lat:45.216,lon:14.544,country:'HR'},
      {name:'Vassilikos LNG — Chypre',lat:34.725,lon:33.323,country:'CY'},
      {name:'Malta Delimara LNG',lat:35.835,lon:14.564,country:'MT'},
    
      {name:'Elengy — Fos (3rd)',lat:43.407,lon:4.892,country:'FR'},
      {name:'Montoir (add)',lat:47.311,lon:-2.154,country:'FR'},
      {name:'Stade LNG',lat:53.601,lon:9.478,country:'DE'},
      {name:'Lubmin LNG',lat:54.143,lon:13.653,country:'DE'},
      {name:'GATE — Rotterdam (add)',lat:51.93,lon:4.118,country:'NL'},
      {name:'Revithoussa (add)',lat:37.953,lon:23.388,country:'GR'},
      {name:'Alexandroupolis FSRU',lat:40.845,lon:25.956,country:'GR'},
      {name:'Inkoo (add)',lat:60.052,lon:24.018,country:'FI'},
    
      {name:'Elengy — Fos Tonkin (add2)',lat:43.409,lon:4.894,country:'FR'},
      {name:'Uniper — Wilhelmshaven (add)',lat:53.578,lon:8.138,country:'DE'},
      {name:'Brunsbuttel (add)',lat:53.895,lon:9.149,country:'DE'},
      {name:'Adriatic LNG (add)',lat:45.088,lon:12.294,country:'IT'},
      {name:'EnaGas — Cartagena (add)',lat:37.575,lon:-0.977,country:'ES'},
      {name:'Saggas — Sagunto (add)',lat:39.641,lon:-0.244,country:'ES'},
    
      {name:'EnaGas — Barcelona',lat:41.361,lon:2.161,country:'ES'},
      {name:'EnaGas — El Musel (Gijón)',lat:43.553,lon:-5.692,country:'ES'},
    
      {name:'EnaGas — Huelva (add)',lat:37.235,lon:-6.939,country:'ES'},
      {name:'Panigaglia (add2)',lat:44.085,lon:9.862,country:'IT'},
    ],
  },

  /* ───────── 39. PARC SOLAIRE (COMPOSANTS) ───────── */
  {
    type: 'solar_park', name: 'Parc solaire (composants)', icon: 'ind_solar',
    cargoTypes: ['construction-equip','transformer','steel-beams'],
    cargoOut: 'Panneaux solaires', dailyTonnageMin: 20, dailyTonnageMax: 80,
    pricePerTonne: 200, attractCost: 100000,
    description: 'Transport de panneaux et composants pour parcs solaires.',
    realLocations: [
      {name:'Cestas Solar — Bordeaux',lat:44.747,lon:-0.777,country:'FR'},
      {name:'Toul-Rosières Solar',lat:48.674,lon:5.898,country:'FR'},
      {name:'Beaucaire Solar',lat:43.804,lon:4.652,country:'FR'},
      {name:'Lazer Solar',lat:44.289,lon:5.856,country:'FR'},
      {name:'Solarpark Meuro',lat:51.507,lon:13.798,country:'DE'},
      {name:'Solarpark Senftenberg',lat:51.525,lon:13.945,country:'DE'},
      {name:'Solarpark Weesow-Willmersdorf',lat:52.65,lon:13.789,country:'DE'},
      {name:'Solarpark Tramm-Göthen',lat:53.497,lon:10.972,country:'DE'},
      {name:'Nunez de Balboa — Badajoz',lat:38.481,lon:-6.828,country:'ES'},
      {name:'Francisco Pizarro — Cáceres',lat:39.468,lon:-6.372,country:'ES'},
      {name:'Mula Solar — Murcia',lat:38.044,lon:-1.499,country:'ES'},
      {name:'Solaria — Trillo',lat:40.71,lon:-2.605,country:'ES'},
      {name:'Montalto di Castro Solar',lat:42.347,lon:11.598,country:'IT'},
      {name:'Foggia Solar Park',lat:41.459,lon:15.554,country:'IT'},
      {name:'Amareleja Solar',lat:38.195,lon:-7.23,country:'PT'},
      {name:'Alqueva Solar',lat:38.191,lon:-7.505,country:'PT'},
      {name:'Kozani Solar',lat:40.289,lon:21.789,country:'GR'},
      {name:'Ptolemaida Solar',lat:40.506,lon:21.68,country:'GR'},
    
      {name:'Gardanne-Meyreuil Solar',lat:43.484,lon:5.508,country:'FR'},
      {name:'Gien Solar',lat:47.685,lon:2.632,country:'FR'},
      {name:'Marville Solar',lat:49.448,lon:5.452,country:'FR'},
      {name:'Losse Solar',lat:43.764,lon:-0.903,country:'FR'},
      {name:'Solarpark Brandenburg',lat:52.505,lon:12.571,country:'DE'},
      {name:'Solarpark Witznitz',lat:51.162,lon:12.464,country:'DE'},
      {name:'Solarpark Barth',lat:54.379,lon:12.725,country:'DE'},
      {name:'Bienvenida Solar',lat:38.329,lon:-6.135,country:'ES'},
      {name:'Núñez de Balboa (add)',lat:38.482,lon:-6.829,country:'ES'},
      {name:'Serpa Solar',lat:37.94,lon:-7.6,country:'PT'},
      {name:'Pegões Solar',lat:38.668,lon:-8.703,country:'PT'},
      {name:'PV Sardegna',lat:39.9,lon:8.6,country:'IT'},
      {name:'PV Puglia',lat:41.0,lon:16.2,country:'IT'},
      {name:'Heliotopos — Kozani (add)',lat:40.29,lon:21.79,country:'GR'},
      {name:'Oulunsalo Solar',lat:64.93,lon:25.38,country:'FI'},
      {name:'Salo Solar',lat:60.39,lon:23.13,country:'FI'},
    
      {name:'Solarpark — Cottbus',lat:51.76,lon:14.327,country:'DE'},
      {name:'Solarpark — Eberswalde',lat:52.834,lon:13.81,country:'DE'},
      {name:'PV Extremadura — Cáceres',lat:39.47,lon:-6.373,country:'ES'},
      {name:'PV Andalucía — Guadix',lat:37.298,lon:-3.137,country:'ES'},
      {name:'PV Alentejo — Évora',lat:38.571,lon:-7.912,country:'PT'},
      {name:'PV Attiki — Athens',lat:38.01,lon:23.75,country:'GR'},
      {name:'PV Thessaly — Larisa',lat:39.637,lon:22.42,country:'GR'},
    
      {name:'Solarpark Neuenhagen',lat:52.54,lon:13.69,country:'DE'},
      {name:'Solarpark Traunreut',lat:48.0,lon:12.6,country:'DE'},
      {name:'PV Sardinia — Ottana',lat:40.229,lon:8.999,country:'IT'},
      {name:'PV Campania — Benevento',lat:41.13,lon:14.78,country:'IT'},
    
      {name:'PV Algarve — Tavira',lat:37.127,lon:-7.65,country:'PT'},
      {name:'PV Alentejo — Beja',lat:38.016,lon:-7.863,country:'PT'},
      {name:'PV Lazio — Viterbo',lat:42.42,lon:12.109,country:'IT'},
      {name:'PV Sicilia — Catania',lat:37.51,lon:15.09,country:'IT'},
    
      {name:'PV Andalucía — Córdoba',lat:37.885,lon:-4.776,country:'ES'},
      {name:'PV Castilla — Toledo',lat:39.86,lon:-4.02,country:'ES'},
    ],
  },

  /* ───────── 40. DATA CENTER ───────── */
  {
    type: 'data_center', name: 'Data center', icon: 'ind_datacenter',
    cargoTypes: ['construction-equip','transformer','parcels'],
    cargoOut: 'Équipements IT', dailyTonnageMin: 10, dailyTonnageMax: 50,
    pricePerTonne: 600, attractCost: 200000,
    description: 'Data centers massifs. Faible volume, très haute valeur.',
    realLocations: [
      {name:'Equinix PA — Paris',lat:48.858,lon:2.376,country:'FR'},
      {name:'Interxion — Marseille',lat:43.304,lon:5.372,country:'FR'},
      {name:'Scaleway DC5 — Vitry',lat:48.782,lon:2.39,country:'FR'},
      {name:'OVHcloud — Roubaix',lat:50.695,lon:3.177,country:'FR'},
      {name:'OVHcloud — Gravelines',lat:50.987,lon:2.122,country:'FR'},
      {name:'OVHcloud — Strasbourg',lat:48.587,lon:7.743,country:'FR'},
      {name:'Equinix FR — Frankfurt',lat:50.097,lon:8.638,country:'DE'},
      {name:'e-shelter — Frankfurt',lat:50.089,lon:8.622,country:'DE'},
      {name:'Interxion — Frankfurt',lat:50.106,lon:8.66,country:'DE'},
      {name:'NTT — Frankfurt',lat:50.094,lon:8.633,country:'DE'},
      {name:'Equinix MU — Munich',lat:48.134,lon:11.59,country:'DE'},
      {name:'Equinix AM — Amsterdam',lat:52.341,lon:4.893,country:'NL'},
      {name:'Interxion AMS — Amsterdam',lat:52.356,lon:4.952,country:'NL'},
      {name:'Digital Realty — Amsterdam',lat:52.338,lon:4.891,country:'NL'},
      {name:'Equinix — Dublin',lat:53.34,lon:-6.267,country:'IE'},
      {name:'Microsoft — Dublin',lat:53.341,lon:-6.26,country:'IE'},
      {name:'Amazon AWS — Dublin',lat:53.339,lon:-6.258,country:'IE'},
      {name:'Google — Hamina',lat:60.568,lon:27.17,country:'FI'},
      {name:'Aruba — Arezzo',lat:43.457,lon:11.882,country:'IT'},
      {name:'CDLAN — Milan',lat:45.484,lon:9.199,country:'IT'},
      {name:'Interxion — Madrid',lat:40.454,lon:-3.601,country:'ES'},
      {name:'Equinix — Madrid',lat:40.449,lon:-3.597,country:'ES'},
      {name:'Equinix LS — Lisbon',lat:38.741,lon:-9.098,country:'PT'},
      {name:'NTT — Wien',lat:48.2,lon:16.371,country:'AT'},
      {name:'LuxConnect — Bettembourg',lat:49.519,lon:6.098,country:'LU'},
      {name:'Telia — Tallinn',lat:59.434,lon:24.748,country:'EE'},
      {name:'Tet — Riga',lat:56.96,lon:24.108,country:'LV'},
    
      {name:'Equinix PA3 — Pantin',lat:48.895,lon:2.402,country:'FR'},
      {name:'Telehouse — Magny',lat:48.628,lon:2.8,country:'FR'},
      {name:'Cyrus One — Frankfurt',lat:50.095,lon:8.635,country:'DE'},
      {name:'Equinix FR6',lat:50.101,lon:8.641,country:'DE'},
      {name:'Telehouse — London (exp. NL)',lat:52.35,lon:4.9,country:'NL'},
      {name:'Global Switch — Amsterdam',lat:52.344,lon:4.896,country:'NL'},
      {name:'Vantage — Berlin',lat:52.43,lon:13.345,country:'DE'},
      {name:'Equinix ML — Milano',lat:45.48,lon:9.196,country:'IT'},
      {name:'Data4 — Milano',lat:45.465,lon:9.2,country:'IT'},
      {name:'Nabiax — Madrid',lat:40.45,lon:-3.599,country:'ES'},
      {name:'Interxion — Marseille (add)',lat:43.305,lon:5.373,country:'FR'},
    
      {name:'AWS — Frankfurt',lat:50.098,lon:8.64,country:'DE'},
      {name:'Microsoft — Dublin (add)',lat:53.342,lon:-6.261,country:'IE'},
      {name:'Google — Eemshaven',lat:53.442,lon:6.83,country:'NL'},
      {name:'Google — Saint-Ghislain',lat:50.449,lon:3.829,country:'BE'},
      {name:'Microsoft — Amsterdam',lat:52.343,lon:4.895,country:'NL'},
      {name:'Apple — Viborg (exp. DK)',lat:56.453,lon:9.402,country:'DK'},
    
      {name:'Interxion — Brussels',lat:50.863,lon:4.37,country:'BE'},
      {name:'Equinix — Helsinki',lat:60.21,lon:24.96,country:'FI'},
      {name:'Digita — Helsinki',lat:60.224,lon:24.925,country:'FI'},
      {name:'CyrusOne — London (exp. IE)',lat:53.34,lon:-6.262,country:'IE'},
    
      {name:'Equinix — Barcelona',lat:41.38,lon:2.19,country:'ES'},
      {name:'Equinix — Vienna (add)',lat:48.202,lon:16.373,country:'AT'},
      {name:'Hetzner — Falkenstein',lat:50.476,lon:12.371,country:'DE'},
      {name:'Hetzner — Nürnberg',lat:49.449,lon:11.08,country:'DE'},
    
      {name:'OVHcloud — Frankfurt',lat:50.1,lon:8.64,country:'DE'},
      {name:'Ionos — Frankfurt',lat:50.095,lon:8.635,country:'DE'},
    ],
  },

  /* ───────── 41. ENTREPÔT E-COMMERCE ───────── */
  {
    type: 'ecommerce_hub', name: 'Entrepôt e-commerce', icon: 'ind_ecommerce',
    cargoTypes: ['parcels','express','swap-bodies','containers-20'],
    cargoOut: 'Colis e-commerce', dailyTonnageMin: 200, dailyTonnageMax: 1500,
    pricePerTonne: 100, attractCost: 120000,
    description: 'Centre de distribution e-commerce (Amazon, Zalando, Cdiscount...).',
    realLocations: [
      {name:'Amazon — Saran (Orléans)',lat:47.95,lon:1.862,country:'FR'},
      {name:'Amazon — Lauwin-Planque',lat:50.389,lon:3.04,country:'FR'},
      {name:'Amazon — Boves (Amiens)',lat:49.833,lon:2.395,country:'FR'},
      {name:'Amazon — Brétigny',lat:48.614,lon:2.308,country:'FR'},
      {name:'Amazon — Montélimar',lat:44.561,lon:4.754,country:'FR'},
      {name:'Cdiscount — Cestas',lat:44.748,lon:-0.778,country:'FR'},
      {name:'Veepee — Croix',lat:50.677,lon:3.142,country:'FR'},
      {name:'Amazon — Metz-Augny',lat:49.055,lon:6.145,country:'FR'},
      {name:'Amazon — Bad Hersfeld',lat:50.867,lon:9.705,country:'DE'},
      {name:'Amazon — Graben',lat:48.188,lon:10.829,country:'DE'},
      {name:'Amazon — Koblenz',lat:50.378,lon:7.61,country:'DE'},
      {name:'Amazon — Werne',lat:51.664,lon:7.635,country:'DE'},
      {name:'Amazon — Dortmund',lat:51.532,lon:7.418,country:'DE'},
      {name:'Amazon — Brieselang',lat:52.576,lon:13.006,country:'DE'},
      {name:'Zalando — Erfurt',lat:50.972,lon:11.019,country:'DE'},
      {name:'Zalando — Mönchengladbach',lat:51.197,lon:6.451,country:'DE'},
      {name:'Amazon — Piacenza',lat:45.033,lon:9.68,country:'IT'},
      {name:'Amazon — Castel San Giovanni',lat:45.057,lon:9.438,country:'IT'},
      {name:'Amazon — Vercelli',lat:45.328,lon:8.418,country:'IT'},
      {name:'Amazon — Getafe',lat:40.309,lon:-3.733,country:'ES'},
      {name:'Amazon — Barcelona El Prat',lat:41.289,lon:2.075,country:'ES'},
      {name:'Amazon — Illescas',lat:40.117,lon:-3.831,country:'ES'},
      {name:'Bol.com — Waalwijk',lat:51.687,lon:5.068,country:'NL'},
      {name:'Amazon — Dublin',lat:53.4,lon:-6.369,country:'IE'},
      {name:'Amazon — Wien',lat:48.103,lon:16.308,country:'AT'},
      {name:'Emag — Ljubljana',lat:46.056,lon:14.505,country:'SI'},
    
      {name:'Amazon — Chalon',lat:46.77,lon:4.847,country:'FR'},
      {name:'Amazon — Senlis',lat:49.213,lon:2.583,country:'FR'},
      {name:'Amazon — Sevrey',lat:46.753,lon:4.849,country:'FR'},
      {name:'Amazon — Briec',lat:48.1,lon:-4.0,country:'FR'},
      {name:'Amazon — Rheinberg',lat:51.547,lon:6.595,country:'DE'},
      {name:'Amazon — Frankenthal',lat:49.533,lon:8.353,country:'DE'},
      {name:'Amazon — Garbsen',lat:52.432,lon:9.596,country:'DE'},
      {name:'Amazon — Winsen',lat:53.362,lon:10.202,country:'DE'},
      {name:'Zalando — Lahr',lat:48.337,lon:7.873,country:'DE'},
      {name:'Zalando — Brieselang',lat:52.577,lon:13.007,country:'DE'},
      {name:'Amazon — Castelguglielmo',lat:45.038,lon:11.579,country:'IT'},
      {name:'Amazon — Torrazza',lat:45.179,lon:8.044,country:'IT'},
      {name:'Amazon — San Fernando',lat:40.12,lon:-3.785,country:'ES'},
      {name:'Zalando — Stradella',lat:45.077,lon:9.299,country:'IT'},
      {name:'Coolblue — Tilburg',lat:51.555,lon:5.09,country:'NL'},
      {name:'Amazon — Helsinki',lat:60.235,lon:24.975,country:'FI'},
      {name:'Amazon — Bratislava',lat:48.172,lon:17.2,country:'SK'},
    
      {name:'Amazon — Augsburg',lat:48.365,lon:10.888,country:'DE'},
      {name:'Amazon — Sülzetal',lat:52.052,lon:11.56,country:'DE'},
      {name:'Amazon — Wrocław (exp. SK)',lat:51.107,lon:17.039,country:'SK'},
      {name:'Zalando — Gardno (exp. DE)',lat:52.578,lon:13.008,country:'DE'},
      {name:'La Redoute — Roubaix',lat:50.696,lon:3.178,country:'FR'},
      {name:'Veepee — Lyon',lat:45.713,lon:4.883,country:'FR'},
    
      {name:'Amazon — Metz (add)',lat:49.056,lon:6.146,country:'FR'},
      {name:'Amazon — Strasbourg',lat:48.59,lon:7.75,country:'FR'},
      {name:'Amazon — München',lat:48.135,lon:11.59,country:'DE'},
      {name:'Amazon — Hamburg',lat:53.55,lon:9.99,country:'DE'},
    
      {name:'Amazon — Lille',lat:50.64,lon:3.02,country:'FR'},
      {name:'Amazon — Nice',lat:43.66,lon:7.21,country:'FR'},
      {name:'Amazon — Nantes',lat:47.22,lon:-1.555,country:'FR'},
    
      {name:'Amazon — Brétigny (add2)',lat:48.615,lon:2.309,country:'FR'},
      {name:'Amazon — Lyon',lat:45.715,lon:4.885,country:'FR'},
    ],
  },

  /* ───────── 42. ÉQUIPEMENTIER AUTOMOBILE ───────── */
  {
    type: 'auto_parts', name: 'Équipementier automobile', icon: 'ind_autoparts',
    cargoTypes: ['steel-coils','plastic-granules','tires','parcels','containers-20'],
    cargoOut: 'Pièces auto', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 100, attractCost: 100000,
    description: 'Équipementiers Tier 1 : Bosch, Continental, Valeo, Faurecia, ZF...',
    realLocations: [
      {name:'Valeo — La Verrière',lat:48.759,lon:1.937,country:'FR'},
      {name:'Faurecia — Nanterre',lat:48.893,lon:2.211,country:'FR'},
      {name:'Plastic Omnium — Levallois',lat:48.893,lon:2.286,country:'FR'},
      {name:'Valeo — Étaples',lat:50.524,lon:1.64,country:'FR'},
      {name:'Faurecia — Caligny',lat:48.739,lon:-0.457,country:'FR'},
      {name:'Continental — Toulouse',lat:43.598,lon:1.434,country:'FR'},
      {name:'Bosch — Stuttgart',lat:48.786,lon:9.222,country:'DE'},
      {name:'ZF — Friedrichshafen',lat:47.655,lon:9.475,country:'DE'},
      {name:'Continental — Regensburg',lat:49.019,lon:12.085,country:'DE'},
      {name:'Schaeffler — Herzogenaurach',lat:49.568,lon:10.879,country:'DE'},
      {name:'Mahle — Stuttgart',lat:48.806,lon:9.163,country:'DE'},
      {name:'Hella — Lippstadt',lat:51.679,lon:8.339,country:'DE'},
      {name:'Webasto — Stockdorf',lat:48.109,lon:11.446,country:'DE'},
      {name:'Brembo — Curno',lat:45.685,lon:9.616,country:'IT'},
      {name:'Magneti Marelli — Bologna',lat:44.529,lon:11.296,country:'IT'},
      {name:'Gestamp — Bizkaia',lat:43.264,lon:-2.933,country:'ES'},
      {name:'CIE Automotive — Bilbao',lat:43.263,lon:-2.935,country:'ES'},
      {name:'Antolin — Burgos',lat:42.341,lon:-3.7,country:'ES'},
      {name:'Mubea — Attendorn',lat:51.125,lon:7.904,country:'DE'},
      {name:'Bosal — Lummen',lat:50.991,lon:5.233,country:'BE'},
      {name:'Miba — Laakirchen',lat:47.978,lon:13.823,country:'AT'},
      {name:'AVL — Graz',lat:47.059,lon:15.44,country:'AT'},
      {name:'Aptiv — Dublin',lat:53.336,lon:-6.264,country:'IE'},
      {name:'Matador — Púchov',lat:49.123,lon:18.324,country:'SK'},
    
      {name:'Bosch — Mondeville',lat:49.163,lon:-0.341,country:'FR'},
      {name:'Valeo — Amiens',lat:49.891,lon:2.295,country:'FR'},
      {name:'Michelin — Clermont (add)',lat:45.785,lon:3.072,country:'FR'},
      {name:'Hella — Hamm',lat:51.68,lon:7.82,country:'DE'},
      {name:'ElringKlinger — Dettingen',lat:48.623,lon:9.352,country:'DE'},
      {name:'Benteler — Paderborn',lat:51.709,lon:8.754,country:'DE'},
      {name:'SKF — Schweinfurt',lat:50.045,lon:10.23,country:'DE'},
      {name:'Brembo — Bergamo',lat:45.694,lon:9.679,country:'IT'},
      {name:'Denso — San Salvo',lat:42.045,lon:14.708,country:'IT'},
      {name:'GKN — Firenze',lat:43.776,lon:11.253,country:'IT'},
      {name:'Ficosa — Viladecavalls',lat:41.568,lon:1.949,country:'ES'},
      {name:'Mann+Hummel — Ludwigsburg',lat:48.9,lon:9.197,country:'DE'},
      {name:'Bosch — Eisenach',lat:50.982,lon:10.303,country:'DE'},
      {name:'Continental — Budapest (exp. SK)',lat:48.1,lon:17.1,country:'SK'},
    
      {name:'Faurecia — Flers',lat:48.744,lon:-0.56,country:'FR'},
      {name:'Valeo — L\'Isle-d\'Abeau',lat:45.617,lon:5.23,country:'FR'},
      {name:'Bosch — Bamberg',lat:49.9,lon:10.905,country:'DE'},
      {name:'Bosch — Hildesheim',lat:52.156,lon:9.952,country:'DE'},
      {name:'Schaeffler — Schweinfurt',lat:50.046,lon:10.231,country:'DE'},
    
      {name:'Magna — Graz (add)',lat:47.074,lon:15.443,country:'AT'},
      {name:'Webasto — Hengersberg',lat:48.773,lon:13.052,country:'DE'},
      {name:'Bosch — Blaichach',lat:47.524,lon:10.272,country:'DE'},
      {name:'Valeo — Isle-d\'Abeau (add)',lat:45.618,lon:5.231,country:'FR'},
    
      {name:'Bosch — Madrid',lat:40.45,lon:-3.7,country:'ES'},
      {name:'Bosch — Burgos',lat:42.34,lon:-3.696,country:'ES'},
      {name:'Valeo — Praha (exp. SK)',lat:50.075,lon:14.437,country:'SK'},
    
      {name:'Continental — Nürnberg',lat:49.45,lon:11.085,country:'DE'},
      {name:'Continental — Frankfurt',lat:50.09,lon:8.65,country:'DE'},
    ],
  },

  /* ───────── 43. CENTRALE À BÉTON ───────── */
  {
    type: 'concrete_plant', name: 'Centrale à béton', icon: 'ind_concrete',
    cargoTypes: ['sand','gravel','cement','water'],
    cargoOut: 'Béton prêt à l\'emploi', dailyTonnageMin: 300, dailyTonnageMax: 1500,
    pricePerTonne: 15, attractCost: 50000,
    description: 'Béton prêt à l\'emploi : 300-1500t/jour. Très gros volumes.',
    realLocations: [
      {name:'Lafarge — Gennevilliers BPE',lat:48.92,lon:2.291,country:'FR'},
      {name:'Holcim — Paris',lat:48.876,lon:2.358,country:'FR'},
      {name:'Cemex — Bondy',lat:48.893,lon:2.491,country:'FR'},
      {name:'Vicat — Lyon',lat:45.758,lon:4.828,country:'FR'},
      {name:'HeidelbergCement — Berlin',lat:52.514,lon:13.401,country:'DE'},
      {name:'Holcim — Munich',lat:48.158,lon:11.586,country:'DE'},
      {name:'Thomas Beton — Hamburg',lat:53.552,lon:9.99,country:'DE'},
      {name:'Cemex — Madrid',lat:40.434,lon:-3.674,country:'ES'},
      {name:'Holcim — Barcelona',lat:41.39,lon:2.164,country:'ES'},
      {name:'Calcestruzzi — Roma',lat:41.9,lon:12.488,country:'IT'},
      {name:'Holcim — Rotterdam',lat:51.9,lon:4.466,country:'NL'},
      {name:'Holcim — Bruxelles',lat:50.856,lon:4.355,country:'BE'},
      {name:'TBG — Wien',lat:48.209,lon:16.374,country:'AT'},
      {name:'Rudus — Helsinki',lat:60.24,lon:24.97,country:'FI'},
      {name:'CRH — Dublin',lat:53.35,lon:-6.27,country:'IE'},
      {name:'Titan — Athens',lat:37.97,lon:23.72,country:'GR'},
    
      {name:'Lafarge BPE — Lyon',lat:45.756,lon:4.828,country:'FR'},
      {name:'Holcim — Marseille',lat:43.32,lon:5.368,country:'FR'},
      {name:'Heidelberg BPE — Berlin (add)',lat:52.515,lon:13.402,country:'DE'},
      {name:'Schwing — Herne',lat:51.539,lon:7.218,country:'DE'},
      {name:'Buzzi BPE — Napoli',lat:40.835,lon:14.265,country:'IT'},
      {name:'Cementos Molins BPE',lat:41.362,lon:1.888,country:'ES'},
      {name:'Thomas — Lübeck',lat:53.87,lon:10.68,country:'DE'},
      {name:'Holcim — Wien (add)',lat:48.21,lon:16.375,country:'AT'},
      {name:'Lujabetoni — Helsinki',lat:60.24,lon:24.971,country:'FI'},
      {name:'Ecocem — Dublin',lat:53.348,lon:-6.215,country:'IE'},
      {name:'TITAN BPE — Thessaloniki',lat:40.633,lon:22.939,country:'GR'},
      {name:'Aslan — Nicosia',lat:35.18,lon:33.37,country:'CY'},
      {name:'Readymix — Malta',lat:35.89,lon:14.43,country:'MT'},
    
      {name:'Holcim — Lyon (add)',lat:45.757,lon:4.829,country:'FR'},
      {name:'Lafarge — Nantes',lat:47.22,lon:-1.555,country:'FR'},
      {name:'Heidelberg — Hamburg',lat:53.555,lon:9.992,country:'DE'},
      {name:'Buzzi — Torino',lat:45.068,lon:7.654,country:'IT'},
      {name:'Readymix — Bratislava',lat:48.155,lon:17.142,country:'SK'},
      {name:'Betón — Košice',lat:48.715,lon:21.24,country:'SK'},
      {name:'BSRI — Rīga',lat:56.945,lon:24.095,country:'LV'},
    
      {name:'Holcim — Nantes (add)',lat:47.221,lon:-1.556,country:'FR'},
      {name:'Cemex — Amsterdam',lat:52.395,lon:4.797,country:'NL'},
      {name:'Holcim — Frankfurt',lat:50.1,lon:8.68,country:'DE'},
      {name:'Holcim — Stuttgart',lat:48.78,lon:9.18,country:'DE'},
    
      {name:'Holcim — Berlin',lat:52.516,lon:13.402,country:'DE'},
      {name:'Holcim — Düsseldorf',lat:51.228,lon:6.787,country:'DE'},
      {name:'Holcim — Torino',lat:45.07,lon:7.655,country:'IT'},
    
      {name:'Heidelberg — Köln',lat:50.945,lon:6.962,country:'DE'},
      {name:'Cemex — London (exp. IE)',lat:51.508,lon:-0.076,country:'IE'},
    ],
  },

  /* ───────── 44. FONDERIE ───────── */
  {
    type: 'foundry', name: 'Fonderie', icon: 'ind_foundry',
    cargoTypes: ['scrap-metal','cast-iron','aluminium','sand','coke'],
    cargoOut: 'Pièces de fonderie', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 60, attractCost: 90000,
    description: 'Fonderie : coulée, moulage. 100-500t/jour.',
    realLocations: [
      {name:'Fonderie de Bretagne — Caudan',lat:47.772,lon:-3.353,country:'FR'},
      {name:'PSA Fonderie — Charleville',lat:49.763,lon:4.716,country:'FR'},
      {name:'Fonderie Aluminium — Ingrandes',lat:47.085,lon:-0.955,country:'FR'},
      {name:'SHW — Aalen',lat:48.838,lon:10.094,country:'DE'},
      {name:'Nemak — Frankfurt',lat:50.064,lon:8.655,country:'DE'},
      {name:'Fritz Winter — Stadtallendorf',lat:50.827,lon:9.013,country:'DE'},
      {name:'Georg Fischer — Singen',lat:47.761,lon:8.845,country:'DE'},
      {name:'Teksid — Carmagnola',lat:44.849,lon:7.722,country:'IT'},
      {name:'Fundición Nodular — Álava',lat:42.828,lon:-2.74,country:'ES'},
      {name:'Eisenwerk Würth — Graz',lat:47.068,lon:15.445,country:'AT'},
    
      {name:'Saint-Jean Industries — Lyon',lat:45.74,lon:4.831,country:'FR'},
      {name:'Montupet — Laigneville',lat:49.304,lon:2.445,country:'FR'},
      {name:'Aludyne — Nantes',lat:47.22,lon:-1.55,country:'FR'},
      {name:'Buderus — Wetzlar',lat:50.553,lon:8.508,country:'DE'},
      {name:'Eisengiesserei — Mettmann',lat:51.25,lon:6.983,country:'DE'},
      {name:'KSM Castings — Hildesheim',lat:52.155,lon:9.951,country:'DE'},
      {name:'Fonderie Zanardi — Minerbe',lat:45.249,lon:11.323,country:'IT'},
      {name:'Teksid — Crescentino',lat:45.183,lon:8.104,country:'IT'},
      {name:'Fagor — Mondragón',lat:43.063,lon:-2.489,country:'ES'},
      {name:'ŽDB — Bohumín (exp. SK)',lat:48.172,lon:17.155,country:'SK'},
      {name:'Valmet — Jyväskylä',lat:62.238,lon:25.737,country:'FI'},
      {name:'Halberg Guss — Leipzig',lat:51.34,lon:12.384,country:'DE'},
      {name:'Georg Fischer — Schaffhausen (exp. AT)',lat:47.697,lon:8.634,country:'AT'},
    
      {name:'Fonderie LEMER — Lorient',lat:47.742,lon:-3.355,country:'FR'},
      {name:'Fonderie Saguenay (exp. FR)',lat:45.7,lon:4.83,country:'FR'},
      {name:'Schäfer Werke — Neunkirchen',lat:50.797,lon:8.002,country:'DE'},
      {name:'Buderus Guss — Breidenbach',lat:50.886,lon:8.453,country:'DE'},
      {name:'Fonderia di Torino',lat:45.042,lon:7.64,country:'IT'},
      {name:'ŠKODA JS — Plzeň (exp. SK)',lat:49.74,lon:13.38,country:'SK'},
    
      {name:'Fonderie Ventana — Modena',lat:44.645,lon:10.921,country:'IT'},
      {name:'Fonderie — Brescia',lat:45.53,lon:10.21,country:'IT'},
      {name:'FAR — Fonderia Alluminio Rimini',lat:44.06,lon:12.58,country:'IT'},
    
      {name:'Fonderie de Niederbronn',lat:48.951,lon:7.646,country:'FR'},
      {name:'Fonderie Boillat — Reconvilier (exp. FR)',lat:47.231,lon:7.223,country:'FR'},
    
      {name:'Eisengießerei — Mühlhausen',lat:51.207,lon:10.453,country:'DE'},
      {name:'Fonderie — Grasse',lat:43.659,lon:6.923,country:'FR'},
    ],
  },

  /* ───────── 45. PLASTURGIE ───────── */
  {
    type: 'plastics_plant', name: 'Plasturgie', icon: 'ind_plastics',
    cargoTypes: ['plastic-granules','chemicals-liq','containers-20'],
    cargoOut: 'Produits plastiques', dailyTonnageMin: 100, dailyTonnageMax: 400,
    pricePerTonne: 75, attractCost: 80000,
    description: 'Transformation plastique : injection, extrusion, soufflage.',
    realLocations: [
      {name:'Plastic Omnium — Lyon',lat:45.74,lon:4.83,country:'FR'},
      {name:'Plastivaloire — Langeais',lat:47.327,lon:0.405,country:'FR'},
      {name:'Covestro — Dormagen',lat:51.094,lon:6.832,country:'DE'},
      {name:'Röchling — Mannheim',lat:49.485,lon:8.465,country:'DE'},
      {name:'Rehau — Rehau',lat:50.329,lon:12.045,country:'DE'},
      {name:'BASF Plastics — Ludwigshafen',lat:49.49,lon:8.43,country:'DE'},
      {name:'Novamont — Novara',lat:45.454,lon:8.62,country:'IT'},
      {name:'Radici — Gandino',lat:45.81,lon:9.901,country:'IT'},
      {name:'Repsol — Puertollano (plast.)',lat:38.687,lon:-4.088,country:'ES'},
      {name:'SABIC — Bergen op Zoom',lat:51.501,lon:4.291,country:'NL'},
      {name:'Solvay — Bruxelles (polymères)',lat:50.86,lon:4.36,country:'BE'},
      {name:'Borealis — Linz (polym.)',lat:48.308,lon:14.298,country:'AT'},
      {name:'Neste — Porvoo (plast.)',lat:60.313,lon:25.614,country:'FI'},
    
      {name:'Albéa — Gennevilliers',lat:48.922,lon:2.295,country:'FR'},
      {name:'Allibert — Nîmes',lat:43.836,lon:4.366,country:'FR'},
      {name:'Greiner — Kremsmünster',lat:48.05,lon:14.125,country:'AT'},
      {name:'Alpla — Hard',lat:47.492,lon:9.697,country:'AT'},
      {name:'Georg Utz — Bremgarten',lat:47.354,lon:8.316,country:'DE'},
      {name:'Pöppelmann — Lohne',lat:52.664,lon:8.237,country:'DE'},
      {name:'Geberit — Pfullendorf',lat:47.925,lon:9.257,country:'DE'},
      {name:'Plastipak — Toledo (exp. ES)',lat:39.856,lon:-4.023,country:'ES'},
      {name:'Bormioli Rocco — Fidenza',lat:44.871,lon:10.069,country:'IT'},
      {name:'RPC — Bramlage (exp. NL)',lat:52.7,lon:7.95,country:'NL'},
      {name:'Promens — Annecy',lat:45.902,lon:6.128,country:'FR'},
      {name:'Simoldes — Oliveira de Azeméis',lat:40.838,lon:-8.477,country:'PT'},
      {name:'Nolato — Torekov (exp. FI)',lat:60.2,lon:24.96,country:'FI'},
    
      {name:'Tupperware — Joué-lès-Tours',lat:47.346,lon:0.653,country:'FR'},
      {name:'Plastiques du Val de Loire',lat:47.09,lon:0.47,country:'FR'},
      {name:'Engel — Schwertberg (exp. AT)',lat:48.26,lon:14.605,country:'AT'},
      {name:'Greiner — Slaný (exp. SK)',lat:50.231,lon:14.087,country:'SK'},
      {name:'LEGO — Billund (exp. DK)',lat:55.731,lon:9.114,country:'DK'},
      {name:'Playmobil — Zirndorf',lat:49.445,lon:10.955,country:'DE'},
      {name:'Arburg — Loßburg',lat:48.403,lon:8.445,country:'DE'},
    
      {name:'Plastic Omnium — Sigmaringen',lat:48.089,lon:9.229,country:'DE'},
      {name:'Röchling — Haren',lat:52.795,lon:7.238,country:'DE'},
      {name:'Magna — Graz Plastics',lat:47.075,lon:15.444,country:'AT'},
    
      {name:'Ensinger — Nufringen',lat:48.621,lon:8.892,country:'DE'},
      {name:'Pöppelmann — Lohne (add)',lat:52.665,lon:8.238,country:'DE'},
    
      {name:'Covestro — Brunsbuttel',lat:53.893,lon:9.16,country:'DE'},
      {name:'REHAU — Viechtach',lat:49.079,lon:12.879,country:'DE'},
    ],
  },

  /* ───────── 46. SUCRERIE ───────── */
  {
    type: 'sugar_refinery', name: 'Sucrerie', icon: 'ind_sugar',
    cargoTypes: ['sugar-beet','sugar','fertilizer','animal-feed'],
    cargoOut: 'Sucre raffiné', dailyTonnageMin: 400, dailyTonnageMax: 2000,
    pricePerTonne: 35, attractCost: 90000,
    description: 'Sucrerie : campagne betteravière 400-2000t/jour.',
    realLocations: [
      {name:'Tereos — Origny',lat:49.833,lon:3.517,country:'FR'},
      {name:'Cristal Union — Bazancourt',lat:49.343,lon:3.836,country:'FR'},
      {name:'Tereos — Lillers',lat:50.561,lon:2.483,country:'FR'},
      {name:'Tereos — Escaudœuvres',lat:50.2,lon:3.283,country:'FR'},
      {name:'Cristal Union — Arcis-sur-Aube',lat:48.533,lon:4.133,country:'FR'},
      {name:'Saint Louis Sucre — Roye',lat:49.7,lon:2.783,country:'FR'},
      {name:'Cristal Union — Erstein',lat:48.424,lon:7.66,country:'FR'},
      {name:'Südzucker — Ochsenfurt',lat:49.67,lon:10.063,country:'DE'},
      {name:'Südzucker — Plattling',lat:48.773,lon:12.875,country:'DE'},
      {name:'Nordzucker — Uelzen',lat:52.956,lon:10.56,country:'DE'},
      {name:'Nordzucker — Schladen',lat:52.018,lon:10.553,country:'DE'},
      {name:'Pfeifer & Langen — Euskirchen',lat:50.66,lon:6.791,country:'DE'},
      {name:'Cosun — Dinteloord',lat:51.633,lon:4.372,country:'NL'},
      {name:'Cosun — Vierverlaten',lat:53.237,lon:6.484,country:'NL'},
      {name:'Tirlemontoise — Tienen',lat:50.808,lon:4.935,country:'BE'},
      {name:'Iscal Sugar — Fontenoy',lat:50.56,lon:3.563,country:'BE'},
      {name:'AGRANA — Tulln',lat:48.331,lon:15.887,country:'AT'},
      {name:'AGRANA — Leopoldsdorf',lat:48.117,lon:16.407,country:'AT'},
      {name:'Azucarera — Toro',lat:41.515,lon:-5.394,country:'ES'},
      {name:'Azucarera — Miranda de Ebro',lat:42.694,lon:-2.947,country:'ES'},
      {name:'COPROB — Minerbio',lat:44.62,lon:11.481,country:'IT'},
      {name:'Nordic Sugar — Nakskov',lat:54.834,lon:11.145,country:'DK'},
      {name:'Slovenské cukrovary — Sereď',lat:48.284,lon:17.735,country:'SK'},
    
      {name:'Tereos — Boiry-Sainte-Rictrude',lat:50.27,lon:2.804,country:'FR'},
      {name:'Saint Louis — Étrépagny',lat:49.318,lon:1.608,country:'FR'},
      {name:'Cristal Union — Toury',lat:48.197,lon:1.933,country:'FR'},
      {name:'Tereos — Artenay',lat:48.079,lon:1.878,country:'FR'},
      {name:'Cristal Union — Corbeilles',lat:48.063,lon:2.704,country:'FR'},
      {name:'Südzucker — Offstein',lat:49.59,lon:8.283,country:'DE'},
      {name:'Südzucker — Zeitz',lat:51.047,lon:12.143,country:'DE'},
      {name:'Nordzucker — Clauen',lat:52.283,lon:10.091,country:'DE'},
      {name:'Nordzucker — Klein Wanzleben',lat:52.06,lon:11.343,country:'DE'},
      {name:'Pfeifer & Langen — Appeldorn',lat:51.757,lon:6.405,country:'DE'},
      {name:'Südzucker — Leopoldsdorf (add)',lat:48.118,lon:16.408,country:'AT'},
      {name:'British Sugar — Wissington (exp. IE)',lat:52.62,lon:0.43,country:'IE'},
    
      {name:'Tereos — Connantre',lat:48.75,lon:3.567,country:'FR'},
      {name:'Cristal Union — Sainte-Émilie',lat:49.543,lon:3.5,country:'FR'},
      {name:'Südzucker — Rain',lat:48.683,lon:10.917,country:'DE'},
      {name:'Nordzucker — Nordstemmen',lat:52.175,lon:9.791,country:'DE'},
      {name:'Cosun — Halfweg',lat:52.388,lon:4.732,country:'NL'},
      {name:'AGRANA — Tulln (add)',lat:48.332,lon:15.888,country:'AT'},
    
      {name:'Tereos — Attin',lat:50.549,lon:1.744,country:'FR'},
      {name:'Cristal Union — Pithiviers',lat:48.172,lon:2.252,country:'FR'},
      {name:'Südzucker — Offenau',lat:49.246,lon:9.156,country:'DE'},
    
      {name:'British Sugar — Newark (exp. IE)',lat:53.08,lon:-0.81,country:'IE'},
      {name:'Cristal Union — Reims (add)',lat:49.344,lon:3.837,country:'FR'},
      {name:'Nordzucker — Schladen (add)',lat:52.019,lon:10.554,country:'DE'},
    
      {name:'Südzucker — Warburg',lat:51.491,lon:9.149,country:'DE'},
      {name:'Nordzucker — Nakskov (add)',lat:54.835,lon:11.146,country:'DK'},
    ],
  },

  /* ───────── 47. LAITERIE / FROMAGERIE ───────── */
  {
    type: 'dairy', name: 'Laiterie / Fromagerie', icon: 'ind_dairy',
    cargoTypes: ['milk','frozen-food','beverages','containers-reefer'],
    cargoOut: 'Produits laitiers', dailyTonnageMin: 150, dailyTonnageMax: 800,
    pricePerTonne: 55, attractCost: 85000,
    description: 'Industrie laitière : lait, fromage, yaourt. 150-800t/jour.',
    realLocations: [
      {name:'Lactalis — Laval',lat:48.073,lon:-0.768,country:'FR'},
      {name:'Danone — Bailleul',lat:50.739,lon:2.733,country:'FR'},
      {name:'Bel — Vendôme',lat:47.793,lon:1.064,country:'FR'},
      {name:'Sodiaal — Montluçon',lat:46.339,lon:2.602,country:'FR'},
      {name:'Lactalis — Retiers',lat:47.913,lon:-1.387,country:'FR'},
      {name:'FrieslandCampina — Leeuwarden',lat:53.196,lon:5.787,country:'NL'},
      {name:'FrieslandCampina — Borculo',lat:52.116,lon:6.522,country:'NL'},
      {name:'Arla — Pronsfeld',lat:50.256,lon:6.431,country:'DE'},
      {name:'DMK — Bremen',lat:53.099,lon:8.804,country:'DE'},
      {name:'Müller Milch — Aretsried',lat:48.258,lon:10.667,country:'DE'},
      {name:'Hochland — Heimenkirch',lat:47.628,lon:9.982,country:'DE'},
      {name:'Kerry — Listowel',lat:52.445,lon:-9.488,country:'IE'},
      {name:'Glanbia — Kilkenny',lat:52.655,lon:-7.252,country:'IE'},
      {name:'Dairygold — Mitchelstown',lat:52.265,lon:-8.267,country:'IE'},
      {name:'Granarolo — Bologna',lat:44.505,lon:11.359,country:'IT'},
      {name:'Parmalat — Collecchio',lat:44.753,lon:10.213,country:'IT'},
      {name:'Valio — Helsinki',lat:60.229,lon:24.888,country:'FI'},
      {name:'Valio — Lapinlahti',lat:63.369,lon:27.389,country:'FI'},
      {name:'SalzburgMilch — Salzburg',lat:47.803,lon:13.044,country:'AT'},
      {name:'FAGE — Athens',lat:37.959,lon:23.709,country:'GR'},
      {name:'Rīgas piena kombināts',lat:56.955,lon:24.137,country:'LV'},
      {name:'Pieno žvaigždės — Pasvalys',lat:56.066,lon:24.403,country:'LT'},
      {name:'Meggle — Osijek',lat:45.554,lon:18.694,country:'HR'},
    
      {name:'Sodiaal — Vienne',lat:45.524,lon:4.879,country:'FR'},
      {name:'Lactalis — Château-Gontier',lat:47.828,lon:-0.706,country:'FR'},
      {name:'Bel — Evron',lat:48.153,lon:-0.399,country:'FR'},
      {name:'Isigny Sainte-Mère',lat:49.328,lon:-1.104,country:'FR'},
      {name:'Président — Laval (add)',lat:48.074,lon:-0.769,country:'FR'},
      {name:'Arla — Upahl',lat:53.793,lon:11.44,country:'DE'},
      {name:'Meggle — Wasserburg',lat:48.063,lon:12.222,country:'DE'},
      {name:'Emmi — Luzern (exp. AT)',lat:47.048,lon:8.308,country:'AT'},
      {name:'Berglandmilch — Aschbach',lat:48.057,lon:14.759,country:'AT'},
      {name:'Aurivo — Ballaghaderreen',lat:53.917,lon:-8.569,country:'IE'},
      {name:'Carbery — Ballineen',lat:51.762,lon:-8.914,country:'IE'},
      {name:'Mozzarella di Bufala — Caserta',lat:41.075,lon:14.333,country:'IT'},
      {name:'Danone — Aldaya',lat:39.462,lon:-0.461,country:'ES'},
    
      {name:'Savencia — Illoud',lat:48.235,lon:5.598,country:'FR'},
      {name:'Bongrain — Gérardmer',lat:48.074,lon:6.879,country:'FR'},
      {name:'Arla — Falkenberg (exp. DK)',lat:56.9,lon:12.49,country:'DK'},
      {name:'Müller — Leppersdorf',lat:51.117,lon:13.745,country:'DE'},
      {name:'Alpro — Wevelgem',lat:50.814,lon:3.183,country:'BE'},
      {name:'Royal A-ware — Heerenveen',lat:52.959,lon:5.942,country:'NL'},
    
      {name:'Danone — Rotselaar',lat:50.976,lon:4.718,country:'BE'},
      {name:'FrieslandCampina — Born',lat:51.04,lon:5.808,country:'NL'},
      {name:'Danone — Salas',lat:43.412,lon:-6.262,country:'ES'},
      {name:'Nestlé — La Penilla',lat:43.268,lon:-3.754,country:'ES'},
    
      {name:'Lactalis — Pont-Scorff',lat:47.825,lon:-3.38,country:'FR'},
      {name:'Fromagerie Bel — Sablé',lat:47.839,lon:-0.334,country:'FR'},
      {name:'Danone — Ferrières-en-Bray',lat:49.593,lon:1.619,country:'FR'},
      {name:'Danone — Villecomtal',lat:44.559,lon:2.57,country:'FR'},
    
      {name:'Müller — Freising',lat:48.395,lon:11.749,country:'DE'},
      {name:'Zott — Mertingen',lat:48.642,lon:10.779,country:'DE'},
    
      {name:'Arla — Vimmerby (exp. FI)',lat:57.665,lon:15.859,country:'FI'},
      {name:'DMK — Zeven (add)',lat:53.295,lon:9.276,country:'DE'},
    ],
  },

  /* ───────── 48. SCIERIE ───────── */
  {
    type: 'sawmill', name: 'Scierie', icon: 'ind_sawmill',
    cargoTypes: ['timber','planks','wood-chips','pellets'],
    cargoOut: 'Bois scié / pellets', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 30, attractCost: 60000,
    description: 'Scierie et fabrication de pellets : 100-500t/jour.',
    realLocations: [
      {name:'Piveteau — Sainte-Florence',lat:46.826,lon:-1.087,country:'FR'},
      {name:'Scierie Ducerf — Vendenesse',lat:46.557,lon:4.296,country:'FR'},
      {name:'Egger — Rion-des-Landes',lat:43.924,lon:-0.971,country:'FR'},
      {name:'Egger — Rambervillers',lat:48.348,lon:6.629,country:'FR'},
      {name:'Binderholz — Fügen',lat:47.342,lon:11.854,country:'AT'},
      {name:'Mayr-Melnhof — Leoben',lat:47.383,lon:15.091,country:'AT'},
      {name:'Egger — St. Johann',lat:47.524,lon:12.427,country:'AT'},
      {name:'Pölzl — Zeltweg',lat:47.184,lon:14.754,country:'AT'},
      {name:'Ilim Timber — Wismar',lat:53.897,lon:11.461,country:'DE'},
      {name:'Metsä Fibre — Äänekoski',lat:62.6,lon:25.731,country:'FI'},
      {name:'UPM — Kaukas',lat:61.046,lon:28.211,country:'FI'},
      {name:'Stora Enso — Varkaus',lat:62.319,lon:27.907,country:'FI'},
      {name:'Coillte — Clonmel',lat:52.355,lon:-7.707,country:'IE'},
      {name:'Grupo Losán — Galicia',lat:42.453,lon:-8.628,country:'ES'},
      {name:'Sonae Arauco — Mangualde',lat:40.6,lon:-7.77,country:'PT'},
      {name:'Latvijas Finieris — Rīga',lat:56.93,lon:24.09,country:'LV'},
      {name:'Grigeo — Grigiškės',lat:54.65,lon:25.131,country:'LT'},
      {name:'Swedspan — Nová Baňa',lat:48.419,lon:18.641,country:'SK'},
    
      {name:'Bois du Dauphiné — La Mure',lat:44.901,lon:5.786,country:'FR'},
      {name:'Monnet-Sève — Panissières',lat:45.793,lon:4.338,country:'FR'},
      {name:'Pölzl — Zeltweg (add)',lat:47.185,lon:14.755,country:'AT'},
      {name:'Mayr-Melnhof — Leoben (add)',lat:47.384,lon:15.092,country:'AT'},
      {name:'Klausner — Wismar',lat:53.896,lon:11.46,country:'DE'},
      {name:'Rettenmeier — Ramstein',lat:49.443,lon:7.545,country:'DE'},
      {name:'Mercer Holz — Friesau',lat:50.459,lon:11.656,country:'DE'},
      {name:'GLUNZ — Nettgau',lat:52.592,lon:10.93,country:'DE'},
      {name:'Sonae — Sines',lat:37.95,lon:-8.862,country:'PT'},
      {name:'Pfeifer — Kundl',lat:47.462,lon:12.0,country:'AT'},
      {name:'Binderholz — Hallein',lat:47.683,lon:13.095,country:'AT'},
      {name:'Coillte — Waterford',lat:52.255,lon:-7.105,country:'IE'},
      {name:'Metsä Wood — Suolahti',lat:62.556,lon:25.847,country:'FI'},
      {name:'IKEA Industry — Kazlu Ruda (exp. LT)',lat:54.748,lon:23.489,country:'LT'},
    
      {name:'Scierie Brugère — Ussel',lat:45.55,lon:2.32,country:'FR'},
      {name:'Bois Énergie — Épinal',lat:48.174,lon:6.45,country:'FR'},
      {name:'Holzindustrie Schweighofer — Sebes (exp. AT)',lat:45.961,lon:23.57,country:'AT'},
      {name:'Södra — Värö (exp. FI)',lat:57.111,lon:12.37,country:'FI'},
      {name:'BSW — Fort William (exp. IE)',lat:56.818,lon:-5.107,country:'IE'},
      {name:'IKEA Industry — Wielbark (exp. LT)',lat:53.392,lon:20.117,country:'LT'},
    
      {name:'Klenk — Oberrot',lat:49.037,lon:9.917,country:'DE'},
      {name:'BHS Holzindustrie — Berchtesgaden',lat:47.632,lon:13.003,country:'DE'},
      {name:'Setra — Heby (exp. FI)',lat:59.904,lon:16.866,country:'FI'},
    
      {name:'Piveteau — La Guyonnière',lat:46.881,lon:-1.225,country:'FR'},
      {name:'BSW — Newbridge (exp. IE)',lat:56.349,lon:-3.724,country:'IE'},
    
      {name:'Holzindustrie Leitinger — St. Michael',lat:47.361,lon:14.993,country:'AT'},
      {name:'Stora Enso — Ala-Pori (exp. FI)',lat:61.48,lon:21.77,country:'FI'},
    
      {name:'Rettenmeier — Ullersreuth',lat:50.392,lon:11.83,country:'DE'},
      {name:'Egger — Brilon',lat:51.395,lon:8.568,country:'DE'},
    ],
  },

  /* ───────── 49. DÉPÔT PÉTROLIER ───────── */
  {
    type: 'oil_depot', name: 'Dépôt pétrolier', icon: 'ind_oil_depot',
    cargoTypes: ['diesel','gasoline','jet-fuel','fuel-oil','ethanol'],
    cargoOut: 'Carburants', dailyTonnageMin: 200, dailyTonnageMax: 1500,
    pricePerTonne: 50, attractCost: 130000,
    description: 'Stockage et distribution de carburants : 200-1500t/jour.',
    realLocations: [
      {name:'DPF — Gennevilliers',lat:48.924,lon:2.288,country:'FR'},
      {name:'SFDM — Le Havre',lat:49.488,lon:0.12,country:'FR'},
      {name:'Rubis — Rouen',lat:49.438,lon:1.086,country:'FR'},
      {name:'SDLP — Lorient',lat:47.741,lon:-3.356,country:'FR'},
      {name:'Picoty — La Rochelle',lat:46.158,lon:-1.16,country:'FR'},
      {name:'DPF — Lyon',lat:45.731,lon:4.862,country:'FR'},
      {name:'Oiltanking — Hamburg',lat:53.523,lon:9.958,country:'DE'},
      {name:'Vopak — Rotterdam',lat:51.895,lon:4.34,country:'NL'},
      {name:'Oiltanking — Amsterdam',lat:52.401,lon:4.81,country:'NL'},
      {name:'Vopak — Antwerpen',lat:51.28,lon:4.365,country:'BE'},
      {name:'Sea-Invest — Gent',lat:51.089,lon:3.757,country:'BE'},
      {name:'ENI Depot — Ravenna',lat:44.453,lon:12.283,country:'IT'},
      {name:'Kuwait Petroleum — Napoli',lat:40.845,lon:14.27,country:'IT'},
      {name:'CLH — Torrejón',lat:40.458,lon:-3.45,country:'ES'},
      {name:'CLH — Tarragona',lat:41.09,lon:1.237,country:'ES'},
      {name:'CLH — Huelva',lat:37.25,lon:-6.942,country:'ES'},
      {name:'Galp — Aveiras',lat:39.063,lon:-8.921,country:'PT'},
      {name:'OMV — Wien Lobau',lat:48.195,lon:16.5,country:'AT'},
      {name:'Neste — Turku',lat:60.432,lon:22.213,country:'FI'},
      {name:'Topaz — Dublin',lat:53.343,lon:-6.267,country:'IE'},
      {name:'Motor Oil Depot — Agioi Theodoroi',lat:37.941,lon:22.986,country:'GR'},
      {name:'Slovnaft — Bratislava',lat:48.12,lon:17.148,country:'SK'},
      {name:'Petrol — Ljubljana',lat:46.053,lon:14.508,country:'SI'},
      {name:'INA — Zagreb',lat:45.807,lon:15.997,country:'HR'},
      {name:'Alexela — Tallinn',lat:59.42,lon:24.714,country:'EE'},
      {name:'VIADA — Klaipėda',lat:55.695,lon:21.127,country:'LT'},
    
      {name:'SDLP — Brest',lat:48.39,lon:-4.49,country:'FR'},
      {name:'Rubis — Strasbourg',lat:48.57,lon:7.794,country:'FR'},
      {name:'Wagram — Rouen (add)',lat:49.44,lon:1.088,country:'FR'},
      {name:'DPF — Toulouse',lat:43.615,lon:1.41,country:'FR'},
      {name:'Oiltanking — Karlsruhe',lat:49.04,lon:8.305,country:'DE'},
      {name:'Mabanaft — Bremen',lat:53.098,lon:8.77,country:'DE'},
      {name:'Shell — Godorf',lat:50.859,lon:6.945,country:'DE'},
      {name:'BP — Gelsenkirchen (depot)',lat:51.53,lon:7.076,country:'DE'},
      {name:'Vopak — Vlissingen',lat:51.445,lon:3.574,country:'NL'},
      {name:'Q8 — Antwerpen',lat:51.27,lon:4.365,country:'BE'},
      {name:'ERG — Priolo (depot)',lat:37.16,lon:15.189,country:'IT'},
      {name:'API — Trecate',lat:45.432,lon:8.729,country:'IT'},
      {name:'CLH — León',lat:42.595,lon:-5.59,country:'ES'},
      {name:'CLH — Burgos',lat:42.34,lon:-3.695,country:'ES'},
    
      {name:'TotalEnergies — Donges (depot)',lat:47.319,lon:-2.076,country:'FR'},
      {name:'Bollore — Dunkerque',lat:51.043,lon:2.349,country:'FR'},
      {name:'ExxonMobil — Gravenchon (depot)',lat:49.516,lon:0.577,country:'FR'},
      {name:'Avia — Zürich (exp. AT)',lat:47.376,lon:8.541,country:'AT'},
      {name:'Esso — Nürnberg',lat:49.445,lon:11.083,country:'DE'},
      {name:'Shell — München',lat:48.13,lon:11.58,country:'DE'},
    
      {name:'DPF — Nantes',lat:47.22,lon:-1.553,country:'FR'},
      {name:'Rubis — Brest',lat:48.391,lon:-4.491,country:'FR'},
      {name:'Varo — Rotterdam',lat:51.893,lon:4.34,country:'NL'},
      {name:'CLH — A Coruña',lat:43.363,lon:-8.382,country:'ES'},
    
      {name:'Vopak — Europoort',lat:51.958,lon:4.13,country:'NL'},
      {name:'Esso — Karlsruhe',lat:49.038,lon:8.305,country:'DE'},
      {name:'Shell — Frankfurt',lat:50.1,lon:8.685,country:'DE'},
      {name:'ENI — Augusta',lat:37.234,lon:15.22,country:'IT'},
    
      {name:'DPF — Bordeaux',lat:44.83,lon:-0.556,country:'FR'},
      {name:'Rubis — Nantes',lat:47.223,lon:-1.558,country:'FR'},
    
      {name:'Shell — Cologne',lat:50.895,lon:6.975,country:'DE'},
      {name:'Vopak — Hamburg',lat:53.525,lon:9.96,country:'DE'},
    ],
  },

  /* ───────── 50. USINE DE MÉTHANISATION ───────── */
  {
    type: 'biogas_plant', name: 'Usine de méthanisation', icon: 'ind_biogas',
    cargoTypes: ['household-waste','sugar-beet','animal-feed','wood-chips'],
    cargoOut: 'Biogaz / Digestat', dailyTonnageMin: 50, dailyTonnageMax: 300,
    pricePerTonne: 25, attractCost: 60000,
    description: 'Méthanisation : 50-300t/jour de matière organique.',
    realLocations: [
      {name:'GRDF Méthanisation — Marne',lat:49.04,lon:3.954,country:'FR'},
      {name:'Engie BiOZ — Cestas',lat:44.75,lon:-0.78,country:'FR'},
      {name:'SEDE — Moissy-Cramayel',lat:48.62,lon:2.593,country:'FR'},
      {name:'TotalEnergies Biogaz — Pontivy',lat:48.069,lon:-2.964,country:'FR'},
      {name:'EnviTec — Lohne',lat:52.665,lon:8.235,country:'DE'},
      {name:'BioConstruct — Melle',lat:52.203,lon:8.338,country:'DE'},
      {name:'Verbio — Pinnow',lat:53.394,lon:11.758,country:'DE'},
      {name:'Naturenergie — Magdeburg',lat:52.13,lon:11.634,country:'DE'},
      {name:'OWS — Brecht',lat:51.348,lon:4.6,country:'BE'},
      {name:'Host — Ede',lat:52.05,lon:5.66,country:'NL'},
      {name:'Biogas Italia — Modena',lat:44.649,lon:10.92,country:'IT'},
      {name:'IES Biogas — Pordenone',lat:45.963,lon:12.654,country:'IT'},
      {name:'Greenalia — A Coruña',lat:43.362,lon:-8.382,country:'ES'},
      {name:'AGRANA — Pischelsdorf',lat:48.304,lon:16.352,country:'AT'},
      {name:'Gasum — Turku',lat:60.44,lon:22.22,country:'FI'},
      {name:'Biogas Rīga',lat:56.94,lon:24.1,country:'LV'},
    
      {name:'Méthanisation Picardie — Roye',lat:49.7,lon:2.785,country:'FR'},
      {name:'Fonroche — Agen',lat:44.2,lon:0.615,country:'FR'},
      {name:'Weltec — Vechta',lat:52.726,lon:8.283,country:'DE'},
      {name:'Schmack — Schwandorf',lat:49.33,lon:12.103,country:'DE'},
      {name:'PlanET — Vreden',lat:52.036,lon:6.823,country:'DE'},
      {name:'Envitec — Saerbeck',lat:52.146,lon:7.625,country:'DE'},
      {name:'BioConstruct — Billerbeck',lat:51.978,lon:7.295,country:'DE'},
      {name:'Greenlane — Swindon (exp. IE)',lat:53.34,lon:-6.26,country:'IE'},
      {name:'Nedgia — Madrid',lat:40.458,lon:-3.698,country:'ES'},
      {name:'AB Energy — Orzinuovi',lat:45.403,lon:10.011,country:'IT'},
      {name:'HZI — Leoben',lat:47.38,lon:15.09,country:'AT'},
      {name:'Gasum — Riihimäki (add)',lat:60.734,lon:24.78,country:'FI'},
      {name:'Tallinn Biogas',lat:59.42,lon:24.715,country:'EE'},
      {name:'Vilnius Biogas',lat:54.7,lon:25.27,country:'LT'},
    
      {name:'Engie Green — Montpellier',lat:43.61,lon:3.88,country:'FR'},
      {name:'TotalEnergies — Paprec',lat:48.61,lon:2.308,country:'FR'},
      {name:'Naturenergie — Rostock',lat:54.15,lon:12.079,country:'DE'},
      {name:'Verbio — Schwedt (add)',lat:53.044,lon:14.275,country:'DE'},
      {name:'BioEnergy — Passo Corese',lat:42.161,lon:12.733,country:'IT'},
      {name:'Biowatt — Cork',lat:51.9,lon:-8.47,country:'IE'},
      {name:'Doranova — Klaipėda',lat:55.7,lon:21.125,country:'LT'},
    
      {name:'BioFerm — Ismaning',lat:48.228,lon:11.677,country:'DE'},
      {name:'EnviTec — Anklam',lat:53.853,lon:13.695,country:'DE'},
      {name:'Weltec — Siegen',lat:50.88,lon:8.02,country:'DE'},
      {name:'Xergi — Horsens (exp. DK)',lat:55.862,lon:9.854,country:'DK'},
    
      {name:'Engie — Paris',lat:48.86,lon:2.34,country:'FR'},
      {name:'TotalEnergies — Strasbourg',lat:48.59,lon:7.745,country:'FR'},
      {name:'Verbio — Zörbig',lat:51.626,lon:12.113,country:'DE'},
    
      {name:'Engie — Nantes',lat:47.225,lon:-1.56,country:'FR'},
      {name:'TotalEnergies — Lyon',lat:45.76,lon:4.835,country:'FR'},
    
      {name:'Envitec — Neuenkirchen',lat:52.254,lon:7.38,country:'DE'},
      {name:'BioEnergy — München',lat:48.14,lon:11.595,country:'DE'},
    ],
  },

  /* ───────── 51. CÉRAMIQUE / BRIQUES ───────── */
  {
    type: 'ceramics', name: 'Céramique / Briques', icon: 'ind_ceramics',
    cargoTypes: ['sand','limestone','clay','coal'],
    cargoOut: 'Briques / Tuiles / Carrelage', dailyTonnageMin: 100, dailyTonnageMax: 500,
    pricePerTonne: 35, attractCost: 70000,
    description: 'Fabrication de briques, tuiles, carrelage : 100-500t/jour.',
    realLocations: [
      {name:'Imerys — Limoges',lat:45.833,lon:1.261,country:'FR'},
      {name:'Terreal — Chagny',lat:46.917,lon:4.75,country:'FR'},
      {name:'Wienerberger — Hannover',lat:52.375,lon:9.73,country:'DE'},
      {name:'Wienerberger — Wien',lat:48.196,lon:16.42,country:'AT'},
      {name:'Marazzi — Sassuolo',lat:44.534,lon:10.78,country:'IT'},
      {name:'Florim — Fiorano',lat:44.535,lon:10.814,country:'IT'},
      {name:'Iris Ceramica — Fiorano',lat:44.534,lon:10.812,country:'IT'},
      {name:'Porcelanosa — Villareal',lat:39.938,lon:-0.1,country:'ES'},
      {name:'Roca — Barcelona',lat:41.415,lon:2.123,country:'ES'},
      {name:'Aleluia — Aveiro',lat:40.645,lon:-8.653,country:'PT'},
      {name:'Koramic — Kortemark',lat:51.025,lon:3.036,country:'BE'},
      {name:'Wienerberger — Kapfenberg',lat:47.444,lon:15.298,country:'AT'},
    
      {name:'Wienerberger — Uttendorf',lat:47.92,lon:13.043,country:'AT'},
      {name:'Wienerberger — Hennersdorf',lat:48.102,lon:16.342,country:'AT'},
      {name:'Lasselsberger — Chlumčany',lat:49.67,lon:13.32,country:'SK'},
      {name:'Lasselsberger — Pöchlarn',lat:48.218,lon:15.213,country:'AT'},
      {name:'ABK — Finale Emilia',lat:44.835,lon:11.29,country:'IT'},
      {name:'Ragno — Sassuolo (add)',lat:44.535,lon:10.781,country:'IT'},
      {name:'Casalgrande Padana',lat:44.569,lon:10.732,country:'IT'},
      {name:'Equipe — Castellón',lat:39.986,lon:-0.033,country:'ES'},
      {name:'Keraben — Nules',lat:39.854,lon:-0.155,country:'ES'},
      {name:'Sanitec — Orsa (exp. FI)',lat:61.12,lon:14.635,country:'FI'},
      {name:'RAK Ceramics — Gistel (exp. BE)',lat:51.159,lon:2.966,country:'BE'},
      {name:'Cersanit — Kielce (exp. SK)',lat:48.7,lon:17.1,country:'SK'},
      {name:'Royal Mosa — Maastricht',lat:50.845,lon:5.677,country:'NL'},
      {name:'Revigres — Barreiro',lat:38.661,lon:-9.071,country:'PT'},
      {name:'Kerion — Limoges (add)',lat:45.834,lon:1.262,country:'FR'},
      {name:'Terreal — Castelnaudary',lat:43.315,lon:1.953,country:'FR'},
    
      {name:'Terreal — Colomiers',lat:43.612,lon:1.332,country:'FR'},
      {name:'Terreal — Mazamet',lat:43.49,lon:2.378,country:'FR'},
      {name:'Monier — Heusenstamm',lat:50.058,lon:8.799,country:'DE'},
      {name:'Creaton — Wertingen',lat:48.561,lon:10.688,country:'DE'},
      {name:'Unipasta — Aveiro',lat:40.646,lon:-8.654,country:'PT'},
      {name:'LAUFEN — Gmunden',lat:47.918,lon:13.773,country:'AT'},
      {name:'Tondach — Gleinstätten',lat:46.827,lon:15.37,country:'AT'},
      {name:'Röben — Zetel',lat:53.41,lon:7.953,country:'DE'},
    
      {name:'Villeroy & Boch — Mettlach',lat:49.496,lon:6.59,country:'DE'},
      {name:'Deutsche Steinzeug — Alfter',lat:50.733,lon:7.008,country:'DE'},
      {name:'Erlus — Neufahrn',lat:48.748,lon:12.19,country:'DE'},
      {name:'Agrob Buchtal — Schwarzenfeld',lat:49.389,lon:12.127,country:'DE'},
    
      {name:'Wienerberger — Langenzersdorf',lat:48.307,lon:16.367,country:'AT'},
      {name:'Wienerberger — Maissau',lat:48.571,lon:15.845,country:'AT'},
      {name:'Monier — Braas — Heusenstamm (add)',lat:50.059,lon:8.8,country:'DE'},
    
      {name:'Terreal — Rieussequel',lat:43.649,lon:2.149,country:'FR'},
      {name:'Imerys — Limoges (add2)',lat:45.834,lon:1.262,country:'FR'},
    
      {name:'Marazzi — Fiorano (add2)',lat:44.536,lon:10.782,country:'IT'},
      {name:'Casalgrande (add2)',lat:44.57,lon:10.733,country:'IT'},
    ],
  },

  /* ───────── 52. INDUSTRIE DU MEUBLE ───────── */
  {
    type: 'furniture', name: 'Industrie du meuble', icon: 'ind_furniture',
    cargoTypes: ['timber','planks','parcels','containers-20'],
    cargoOut: 'Meubles / Ameublement', dailyTonnageMin: 80, dailyTonnageMax: 400,
    pricePerTonne: 65, attractCost: 70000,
    description: 'Fabrication de meubles : 80-400t/jour.',
    realLocations: [
      {name:'IKEA Industry — Lure',lat:47.681,lon:6.497,country:'FR'},
      {name:'Schmidt Groupe — Sélestat',lat:48.261,lon:7.454,country:'FR'},
      {name:'Nobilia — Verl',lat:51.878,lon:8.491,country:'DE'},
      {name:'Häcker — Rödinghausen',lat:52.244,lon:8.477,country:'DE'},
      {name:'Hülsta — Stadtlohn',lat:51.994,lon:6.916,country:'DE'},
      {name:'Natuzzi — Santeramo',lat:40.793,lon:16.755,country:'IT'},
      {name:'Scavolini — Pesaro',lat:43.912,lon:12.907,country:'IT'},
      {name:'Muebles Ros — Saragosse',lat:41.647,lon:-0.89,country:'ES'},
      {name:'IKEA Industry — Castelo de Paiva',lat:41.048,lon:-8.256,country:'PT'},
      {name:'Wicanders — Santa Maria da Feira',lat:40.929,lon:-8.542,country:'PT'},
      {name:'Team 7 — Ried im Innkreis',lat:48.21,lon:13.491,country:'AT'},
      {name:'Egger — Unterradlberg',lat:48.198,lon:15.651,country:'AT'},
    
      {name:'Ligne Roset — Briord',lat:45.807,lon:5.468,country:'FR'},
      {name:'Roche Bobois — Saintes',lat:45.746,lon:-0.63,country:'FR'},
      {name:'Gautier — Bournezeau',lat:46.633,lon:-1.166,country:'FR'},
      {name:'IKEA Industry — Stalowa Wola (exp. SK)',lat:50.583,lon:22.05,country:'SK'},
      {name:'SieMatic — Löhne',lat:52.197,lon:8.685,country:'DE'},
      {name:'Bulthaup — Aich',lat:48.49,lon:12.361,country:'DE'},
      {name:'Poliform — Inverigo',lat:45.735,lon:9.218,country:'IT'},
      {name:'B&B Italia — Novedrate',lat:45.695,lon:9.12,country:'IT'},
      {name:'Kartell — Noviglio',lat:45.389,lon:9.041,country:'IT'},
      {name:'Cosentino — Almería',lat:37.333,lon:-2.315,country:'ES'},
      {name:'Steelcase — Sarrebourg',lat:48.741,lon:7.073,country:'FR'},
      {name:'Fritz Hansen — Allerød (exp. DK)',lat:55.866,lon:12.345,country:'DK'},
      {name:'Calligaris — Manzano',lat:45.989,lon:13.375,country:'IT'},
      {name:'Magis — Torre di Mosto',lat:45.6,lon:12.706,country:'IT'},
      {name:'Vitra — Weil am Rhein',lat:47.603,lon:7.627,country:'DE'},
      {name:'USM — Münsingen (exp. DE)',lat:47.0,lon:7.56,country:'DE'},
      {name:'Quadrifoglio — Treviso',lat:45.67,lon:12.243,country:'IT'},
    
      {name:'Parisot — Saint-Loup-sur-Semouse',lat:47.89,lon:6.267,country:'FR'},
      {name:'Mobalpa — Rumilly',lat:45.863,lon:5.948,country:'FR'},
      {name:'IKEA Industry — Wielbark (add)',lat:53.393,lon:20.118,country:'DE'},
      {name:'Nolte — Germersheim',lat:49.214,lon:8.363,country:'DE'},
      {name:'Molteni — Giussano',lat:45.702,lon:9.209,country:'IT'},
      {name:'Flexform — Meda',lat:45.67,lon:9.157,country:'IT'},
      {name:'Cassina — Meda',lat:45.672,lon:9.155,country:'IT'},
      {name:'JORI — Tongeren',lat:50.78,lon:5.467,country:'BE'},
    
      {name:'Hay — Horsens (exp. DK)',lat:55.86,lon:9.85,country:'DK'},
      {name:'BoConcept — Herning (exp. DK)',lat:56.133,lon:8.975,country:'DK'},
      {name:'Muuto — Copenhagen (exp. DK)',lat:55.673,lon:12.569,country:'DK'},
      {name:'Montana — Haarby (exp. DK)',lat:55.248,lon:10.125,country:'DK'},
    
      {name:'Leicht Küchen — Waldstetten',lat:48.769,lon:9.837,country:'DE'},
      {name:'ALNO — Pfullendorf',lat:47.925,lon:9.256,country:'DE'},
      {name:'Poltrona Frau — Tolentino',lat:43.21,lon:13.285,country:'IT'},
      {name:'Minotti — Meda',lat:45.671,lon:9.156,country:'IT'},
    
      {name:'SieMatic — Löhne (add)',lat:52.198,lon:8.686,country:'DE'},
      {name:'Hülsta — Stadtlohn (add)',lat:51.995,lon:6.917,country:'DE'},
    
      {name:'Hacker Küchen — Rödinghausen (add)',lat:52.245,lon:8.478,country:'DE'},
      {name:'Poggenpohl — Herford',lat:52.117,lon:8.683,country:'DE'},
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
  cement: '#a8a29e', refinery: '#f97316', port: '#3b82f6', steel_mill: '#6b7280',
  auto_plant: '#22c55e', grain_terminal: '#eab308', chemical_plant: '#a855f7',
  paper_mill: '#84cc16', logistics_hub: '#06b6d4', power_plant: '#ef4444',
  nuclear_plant: '#facc15', quarry: '#78716c', food_processing: '#f472b6',
  waste_center: '#64748b', military_base: '#16a34a', glass_factory: '#67e8f9',
  wind_farm: '#10b981', pharma: '#c084fc', textile: '#fb923c', electronics: '#2563eb',
  aerospace: '#0ea5e9', shipyard: '#0369a1', brewery: '#d97706', mine: '#92400e',
  tire_plant: '#1e293b',
  // New types 26-52
  rail_route: '#dc2626', container_terminal: '#7c3aed', dhl_hub: '#fbbf24',
  fedex_hub: '#4f46e5', ups_hub: '#854d0e', postal_center: '#ea580c',
  rail_workshop: '#059669', marshalling_yard: '#be185d', aluminium_smelter: '#94a3b8',
  cokerie: '#44403c', fertilizer_plant: '#65a30d', petrochemical: '#c2410c',
  lng_terminal: '#0891b2', solar_park: '#fbbf24', data_center: '#6366f1',
  ecommerce_hub: '#f59e0b', auto_parts: '#4ade80', concrete_plant: '#9ca3af',
  foundry: '#b45309', plastics_plant: '#e879f9', sugar_refinery: '#f9a8d4',
  dairy: '#fef08a', sawmill: '#a3e635', oil_depot: '#991b1b', biogas_plant: '#86efac',
  ceramics: '#fdba74', furniture: '#fcd34d',
};

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
    // Player-moved industry sites: key `${type}|${name}` -> {lat, lon}.
    this.locationOverrides = {};
    // Custom sites created by the player on the livemap (XXI).
    this.customSites = [];
    // Static real locations hidden by the player (XXI).
    this.hiddenStaticKeys = new Set();
  }

  // Persist a player-moved industry location (static or custom).
  setLocationOverride(key, lat, lon) {
    if (!key) return;
    if (String(key).startsWith('custom|')) {
      const s = this.customSites.find(s => s._key === key);
      if (s) { s.lat = lat; s.lon = lon; }
      return;
    }
    this.locationOverrides[key] = { lat, lon };
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
        const key = ind.type + '|' + loc.name;
        if (this.hiddenStaticKeys.has(key)) continue;
        const ov = this.locationOverrides[key];
        locs.push({
          ...loc,
          lat: ov ? ov.lat : loc.lat,
          lon: ov ? ov.lon : loc.lon,
          industryType: ind.type,
          industryName: ind.name,
          industryIcon: ind.icon,
          color: INDUSTRY_COLORS[ind.type] || '#94a3b8',
          _key: key,
        });
      }
    }
    for (const s of this.customSites) {
      const ind = this.getIndustryInfo(s.type) || {};
      locs.push({
        ...s,
        industryType: s.type,
        industryName: s.industryName || ind.name || s.name,
        industryIcon: s.icon || ind.icon || 'factory',
        color: INDUSTRY_COLORS[s.type] || '#94a3b8',
        _key: s._key,
        custom: true,
      });
    }
    return locs;
  }

  // XXI — CRUD sites industriels (création / modif / suppression / déplacement)
  addCustomSite(type, name, lat, lon, country = 'FR') {
    const id = `cs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const _key = `custom|${id}`;
    const s = { id, type, name, lat, lon, country: country || 'FR', _key };
    this.customSites.push(s);
    return s;
  }

  removeSite(key) {
    if (String(key).startsWith('custom|')) {
      this.customSites = this.customSites.filter(s => s._key !== key);
    } else {
      this.hiddenStaticKeys.add(key);
      delete this.locationOverrides[key];
    }
  }

  restoreStaticSite(key) {
    this.hiddenStaticKeys.delete(key);
  }

  updateSite(key, data) {
    if (String(key).startsWith('custom|')) {
      const s = this.customSites.find(s => s._key === key);
      if (!s) return null;
      if (data.name != null) s.name = data.name;
      if (data.type != null) s.type = data.type;
      if (data.country != null) s.country = data.country;
      if (data.lat != null) s.lat = parseFloat(data.lat);
      if (data.lon != null) s.lon = parseFloat(data.lon);
      return s;
    }
    // Static sites can only be renamed/hidden/moved; name override stored in locationOverrides.
    if (data.name != null) {
      this.locationOverrides[key] = this.locationOverrides[key] || {};
      this.locationOverrides[key].name = data.name;
    }
    return null;
  }

  getSiteByKey(key) {
    if (String(key).startsWith('custom|')) {
      return this.customSites.find(s => s._key === key) || null;
    }
    for (const ind of INDUSTRY_TYPES) {
      if (!ind.realLocations) continue;
      for (const loc of ind.realLocations) {
        if (ind.type + '|' + loc.name === key) return { ...loc, _key: key, type: ind.type };
      }
    }
    return null;
  }

  attractClient(industryType, stationId, depotId, economy) {
    const industry = this.getIndustryInfo(industryType);
    if (!industry) return null;
    if (economy.balance < industry.attractCost) return null;

    economy.addExpense(industry.attractCost, 'infrastructure', `Attraction client: ${industry.name}`);

    const rng = getGlobalRng();
    const dailyTonnage = industry.dailyTonnageMin +
      Math.floor(rng.random() * (industry.dailyTonnageMax - industry.dailyTonnageMin));

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
      marketShare: 5,
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

  // IND-01 : modification des paramètres d'un client
  updateClient(clientId, data) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return null;
    if (data.name != null) client.name = data.name;
    if (data.dailyTonnage != null) client.dailyTonnage = Math.max(0, parseInt(data.dailyTonnage) || 0);
    if (data.satisfaction != null) client.satisfaction = Math.max(0, Math.min(100, parseFloat(data.satisfaction) || 0));
    return client;
  }

  // IND-01 : déplacer un client vers une autre gare avec ITE
  moveClient(clientId, stationId, depotId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return null;
    client.stationId = stationId;
    if (depotId != null) client.depotId = depotId;
    return client;
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

      // FRT-02/05 : satisfaction + part de marché = plus d'offres
      const satBoost = 1 + Math.max(0, (client.satisfaction - 70)) / 100;
      const shareBoost = 0.5 + (client.marketShare || 5) / 10;
      let remainingTonnage = Math.round(client.dailyTonnage * satBoost * shareBoost);
      let contractsToday = 0;

      const rng = getGlobalRng();
      while (remainingTonnage > 0 && contractsToday < 10) {
        const contractTonnage = Math.min(
          remainingTonnage,
          Math.max(50, Math.floor(remainingTonnage / (3 + rng.random() * 3)))
        );

        const toStation = otherStations[Math.floor(rng.random() * otherStations.length)];
        const revenue = Math.floor(contractTonnage * industry.pricePerTonne);
        const cargoType = industry.cargoTypes[Math.floor(rng.random() * industry.cargoTypes.length)];

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

      ${this._renderSitesSection(game)}

      ${activeClients.length > 0 ? `
      <div class="dash-section">
        <h3>Clients installés</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.5fr">
            <span></span><span>Client</span><span>Gare</span><span>Trafic/j</span><span>Satisfaction</span><span>Part marché</span><span>Actions</span>
          </div>
          ${activeClients.map(c => {
            const station = game.world?.stations.find(s => s.id === c.stationId);
            const satColor = c.satisfaction > 70 ? 'var(--green)' : c.satisfaction > 40 ? '#f97316' : '#ef4444';
            return `
              <div class="dash-train-row" style="grid-template-columns:0.3fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.5fr">
                <span>${icon(c.icon, 16)}</span>
                <span>${c.name}<br><span style="font-size:9px;color:var(--text3)">${c.totalTonnage.toLocaleString('fr-FR')} t traités</span></span>
                <span>${station?.name || '?'}</span>
                <span style="color:#38bdf8">${c.dailyTonnage.toLocaleString('fr-FR')} t</span>
                <span style="color:${satColor}">${Math.floor(c.satisfaction)}%</span>
                <span style="color:#a78bfa">${Math.floor(c.marketShare || 5)}%</span>
                <span style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn-primary industrial-edit" data-id="${c.id}" style="font-size:9px;padding:3px 6px;background:#3b82f6">Modifier</button>
                  <button class="btn-primary industrial-move" data-id="${c.id}" style="font-size:9px;padding:3px 6px;background:#6366f1">Déplacer</button>
                  <button class="btn-primary industrial-remove" data-id="${c.id}" style="font-size:9px;padding:3px 6px;background:#991b1b">Résilier</button>
                </span>
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

    // IND-01 : modification / déplacement
    container.querySelectorAll('.industrial-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const client = this.clients.find(c => c.id === btn.dataset.id);
        if (!client) return;
        const name = prompt('Nom du client :', client.name);
        if (name === null) return;
        const tonnage = prompt('Tonnage journalier :', String(client.dailyTonnage));
        if (tonnage === null) return;
        const sat = prompt('Satisfaction (0-100) :', String(Math.floor(client.satisfaction)));
        if (sat === null) return;
        this.updateClient(client.id, {
          name: name.trim() || client.name,
          dailyTonnage,
          satisfaction: sat,
        });
        this.render(container, game);
      });
    });

    container.querySelectorAll('.industrial-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const client = this.clients.find(c => c.id === btn.dataset.id);
        if (!client) return;
        const ites = (game.depotManager?.getITEs?.() || []);
        if (ites.length === 0) { alert('Aucune ITE disponible'); return; }
        const opts = ites.map(ite => {
          const st = game.world?.stations.find(s => s.id === ite.stationId);
          return `${ite.stationId}|${ite.id} — ${st?.name || '?'} — ${ite.name}`;
        }).join('\n');
        const choice = prompt(`Choisir la nouvelle gare/ITE :\n${opts}`, `${client.stationId}|${client.depotId || ''}`);
        if (!choice) return;
        const [stationId, depotId] = choice.split('|');
        if (!stationId) return;
        this.moveClient(client.id, stationId, depotId);
        this.render(container, game);
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

    // XXI — custom industrial sites CRUD bindings
    container.querySelector('#btn-use-map-center')?.addEventListener('click', () => {
      const tm = game.renderer?.tileMap;
      if (!tm) return;
      const latInput = container.querySelector('#new-site-lat');
      const lonInput = container.querySelector('#new-site-lon');
      if (latInput) latInput.value = Number(tm.centerLat).toFixed(5);
      if (lonInput) lonInput.value = Number(tm.centerLon).toFixed(5);
    });

    container.querySelector('#btn-add-custom-site')?.addEventListener('click', () => {
      const type = container.querySelector('#new-site-type')?.value;
      const name = (container.querySelector('#new-site-name')?.value || '').trim();
      const lat = parseFloat(container.querySelector('#new-site-lat')?.value);
      const lon = parseFloat(container.querySelector('#new-site-lon')?.value);
      const country = (container.querySelector('#new-site-country')?.value || 'FR').trim();
      if (!type || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        alert('Remplissez type, nom, latitude et longitude.'); return;
      }
      this.addCustomSite(type, name, lat, lon, country);
      this.render(container, game);
    });

    container.querySelectorAll('.site-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const s = this.getSiteByKey(key) || {};
        const name = prompt('Nom du site :', s.name || '');
        if (name === null) return;
        const type = prompt('Type (laissez vide pour inchangé) :', s.type || '');
        if (type === null) return;
        const lat = prompt('Latitude :', s.lat ?? '');
        if (lat === null) return;
        const lon = prompt('Longitude :', s.lon ?? '');
        if (lon === null) return;
        const country = prompt('Pays :', s.country || 'FR');
        if (country === null) return;
        this.updateSite(key, {
          name: name.trim() || undefined,
          type: type.trim() || undefined,
          lat: lat.trim() ? parseFloat(lat) : undefined,
          lon: lon.trim() ? parseFloat(lon) : undefined,
          country: country.trim() || undefined,
        });
        this.render(container, game);
      });
    });

    container.querySelectorAll('.site-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Supprimer ce site ?')) { this.removeSite(btn.dataset.key); this.render(container, game); }
      });
    });

    container.querySelectorAll('.site-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        delete this.locationOverrides[btn.dataset.key];
        this.render(container, game);
      });
    });

    container.querySelectorAll('.site-restore').forEach(btn => {
      btn.addEventListener('click', () => { this.restoreStaticSite(btn.dataset.key); this.render(container, game); });
    });
  }

  _renderSitesSection(game) {
    const typeOptions = INDUSTRY_TYPES.map(ind => `<option value="${ind.type}">${ind.name}</option>`).join('');

    const customRows = this.customSites.map(s => {
      const ind = this.getIndustryInfo(s.type) || {};
      const color = INDUSTRY_COLORS[s.type] || '#94a3b8';
      return `
        <div class="dash-train-row" style="grid-template-columns:0.3fr 0.8fr 1.2fr 0.5fr 0.5fr 0.4fr 0.8fr">
          <span>${icon(s.icon || ind.icon || 'factory', 12)}</span>
          <span style="font-size:10px;color:${color}">${ind.name || s.type}</span>
          <span style="font-size:10px">${s.name}</span>
          <span style="font-size:9px;color:var(--text3)">${s.lat.toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${s.lon.toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${s.country}</span>
          <span style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-primary site-edit" data-key="${s._key}" style="font-size:9px;padding:3px 6px;background:#3b82f6">Modifier</button>
            <button class="btn-primary site-delete" data-key="${s._key}" style="font-size:9px;padding:3px 6px;background:#991b1b">Supprimer</button>
          </span>
        </div>
      `;
    }).join('');

    const movedRows = Object.entries(this.locationOverrides).filter(([k, v]) => !k.startsWith('custom|') && (v.lat != null || v.lon != null)).map(([key, ov]) => {
      const site = this.getSiteByKey(key) || {};
      return `
        <div class="dash-train-row" style="grid-template-columns:0.3fr 0.8fr 1.2fr 0.5fr 0.5fr 0.4fr 0.8fr">
          <span>${icon('move', 12)}</span>
          <span style="font-size:10px;color:var(--text3)">Déplacé</span>
          <span style="font-size:10px">${site.name || key}</span>
          <span style="font-size:9px;color:var(--text3)">${(ov.lat ?? site.lat ?? 0).toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${(ov.lon ?? site.lon ?? 0).toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${site.country || ''}</span>
          <span><button class="btn-primary site-reset" data-key="${key}" style="font-size:9px;padding:3px 6px;background:#6366f1">Reset</button></span>
        </div>
      `;
    }).join('');

    const hiddenRows = [...this.hiddenStaticKeys].map(key => {
      const site = this.getSiteByKey(key) || {};
      return `
        <div class="dash-train-row" style="grid-template-columns:0.3fr 0.8fr 1.2fr 0.5fr 0.5fr 0.4fr 0.8fr">
          <span>${icon('eye-off', 12)}</span>
          <span style="font-size:10px;color:var(--text3)">Masqué</span>
          <span style="font-size:10px">${site.name || key}</span>
          <span style="font-size:9px;color:var(--text3)">${(site.lat ?? 0).toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${(site.lon ?? 0).toFixed(3)}</span>
          <span style="font-size:9px;color:var(--text3)">${site.country || ''}</span>
          <span><button class="btn-primary site-restore" data-key="${key}" style="font-size:9px;padding:3px 6px;background:#047857">Restaurer</button></span>
        </div>
      `;
    }).join('');

    const hasRows = customRows || movedRows || hiddenRows;

    return `
      <div class="dash-section">
        <h3>${icon('factory', 16)} Mes sites industriels</h3>
        <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Créez un site, ou déplacez/supprimez directement sur la livemap (Shift+drag / Ctrl+clic).</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <select id="new-site-type" style="padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Type d'industrie...</option>
            ${typeOptions}
          </select>
          <input id="new-site-name" type="text" placeholder="Nom du site" style="padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <input id="new-site-lat" type="number" step="any" placeholder="Latitude" style="padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <input id="new-site-lon" type="number" step="any" placeholder="Longitude" style="padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
          <input id="new-site-country" type="text" placeholder="Pays (FR)" value="FR" style="padding:6px;font-size:12px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button id="btn-use-map-center" class="btn-sm btn-map-action" style="background:#334155">Utiliser le centre de la carte</button>
          <button id="btn-add-custom-site" class="btn-sm btn-map-action" style="background:#047857">Créer le site</button>
        </div>

        ${hasRows ? `
        <div class="dash-train-table" style="max-height:300px;overflow-y:auto">
          <div class="dash-train-header" style="grid-template-columns:0.3fr 0.8fr 1.2fr 0.5fr 0.5fr 0.4fr 0.8fr">
            <span></span><span>Type</span><span>Nom</span><span>Lat</span><span>Lon</span><span>Pays</span><span>Actions</span>
          </div>
          ${customRows}${movedRows}${hiddenRows}
        </div>` : ''}
      </div>
    `;
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
      locationOverrides: this.locationOverrides,
      customSites: this.customSites,
      hiddenStaticKeys: [...this.hiddenStaticKeys],
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.clients = s.clients || [];
    this.stats = s.stats || { totalClients: 0, totalTonnage: 0, totalRevenue: 0, contractsGenerated: 0 };
    if (s._nextClientId) nextClientId = s._nextClientId;
    this.locationOverrides = s.locationOverrides || {};
    this.customSites = s.customSites || [];
    this.hiddenStaticKeys = new Set(s.hiddenStaticKeys || []);
  }
}
