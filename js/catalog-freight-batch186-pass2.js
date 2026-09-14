import { catalogRecord, industryPatchHost } from './catalog-contracts.js';
// Rail Empire — Batch186 FreightPass2 — explicit MLG cargo evidence across Europe
// Conservative policy: only explicit cargo wording/filenames from the MLG catalog; no inferred generic compatibility.
export const BATCH186_FREIGHT_PASS2_CARGO_TYPES = [
    {
        "type": "sugar-bulk",
        "name": "Sucre en vrac",
        "category": "cereales_agri",
        "categoryName": "Céréales & Agri",
        "unit": "t",
        "pricePerUnit": 50,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "potatoes-bulk",
        "name": "Pommes de terre en vrac",
        "category": "alimentaire",
        "categoryName": "Alimentaire & boissons",
        "unit": "t",
        "pricePerUnit": 45,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "industrial-ice",
        "name": "Glace industrielle",
        "category": "alimentaire",
        "categoryName": "Alimentaire & boissons",
        "unit": "t",
        "pricePerUnit": 20,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "bananas-refrigerated",
        "name": "Bananes réfrigérées",
        "category": "alimentaire",
        "categoryName": "Alimentaire & boissons",
        "unit": "t",
        "pricePerUnit": 95,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "glass-sand",
        "name": "Sable siliceux de verrerie",
        "category": "vrac_solide",
        "categoryName": "Vrac solide",
        "unit": "t",
        "pricePerUnit": 22,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "excavated-material",
        "name": "Déblais de chantier",
        "category": "dechets",
        "categoryName": "Déchets & recyclage",
        "unit": "t",
        "pricePerUnit": 4,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "acts-containers",
        "name": "Caisses ACTS",
        "category": "conteneurs",
        "categoryName": "Conteneurs",
        "unit": "unités",
        "pricePerUnit": 150,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "automotive-parts",
        "name": "Pièces automobiles",
        "category": "automobiles",
        "categoryName": "Automobile & véhicules",
        "unit": "t",
        "pricePerUnit": 120,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "lignite",
        "name": "Lignite",
        "category": "vrac_solide",
        "categoryName": "Vrac solide",
        "unit": "t",
        "pricePerUnit": 20,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "zinc",
        "name": "Zinc",
        "category": "siderurgie",
        "categoryName": "Sidérurgie & Métaux",
        "unit": "t",
        "pricePerUnit": 90,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "concrete-sleepers",
        "name": "Traverses en béton",
        "category": "btp",
        "categoryName": "BTP & Matériaux",
        "unit": "t",
        "pricePerUnit": 45,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "mini-containers",
        "name": "Mini-conteneurs porte-à-porte",
        "category": "conteneurs",
        "categoryName": "Conteneurs",
        "unit": "unités",
        "pricePerUnit": 90,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "postal-roll-containers",
        "name": "Conteneurs postaux roulants",
        "category": "courrier",
        "categoryName": "Courrier & Express",
        "unit": "unités",
        "pricePerUnit": 80,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "bulk-powders",
        "name": "Produits pulvérulents en vrac",
        "category": "vrac_solide",
        "categoryName": "Vrac solide",
        "unit": "t",
        "pricePerUnit": 25,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "quarry-products",
        "name": "Produits de carrière",
        "category": "vrac_solide",
        "categoryName": "Vrac solide",
        "unit": "t",
        "pricePerUnit": 18,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    },
    {
        "type": "oversized-loads",
        "name": "Charges encombrantes",
        "category": "exceptionnel",
        "categoryName": "Convois exceptionnels",
        "unit": "t",
        "pricePerUnit": 100,
        "hazard": false,
        "balanceStatus": "provisional-game-balance"
    }
];
export const BATCH186_FREIGHT_PASS2_WAGON_PATCH = {
    "cat-100": {
        "cargoTypes": [
            "automotive-parts"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "automotive-parts:description MLG: pièces automobiles"
    },
    "cat-393": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-757": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-1278": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-1279": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1331": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1332": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1333": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1421": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1422": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-1423": {
        "cargoTypes": [
            "acts-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "acts-containers:description MLG: caisses ACTS"
    },
    "cat-1425": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-1458": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1459": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1460": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1461": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1462": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1463": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1464": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1465": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1466": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1467": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1468": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1469": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-1470": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-2149": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-2150": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-2151": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-2152": {
        "cargoTypes": [
            "containers",
            "semi-trailers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "semi-trailers:description MLG: semi-remorques | containers:description MLG: conteneurs"
    },
    "cat-3232": {
        "cargoTypes": [
            "ballast",
            "excavated-material"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast | excavated-material:description MLG: déblais"
    },
    "cat-3233": {
        "cargoTypes": [
            "ballast",
            "excavated-material"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast | excavated-material:description MLG: déblais"
    },
    "cat-3234": {
        "cargoTypes": [
            "ballast",
            "excavated-material"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast | excavated-material:description MLG: déblais"
    },
    "cat-3235": {
        "cargoTypes": [
            "ballast",
            "excavated-material"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast | excavated-material:description MLG: déblais"
    },
    "cat-3236": {
        "cargoTypes": [
            "ballast",
            "excavated-material"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast | excavated-material:description MLG: déblais"
    },
    "cat-4493": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-4498": {
        "cargoTypes": [
            "wood-chips"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "wood-chips:description MLG: copeaux de bois"
    },
    "cat-4524": {
        "cargoTypes": [
            "coal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille"
    },
    "cat-4525": {
        "cargoTypes": [
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ore:description MLG: minerai de fer/Erz"
    },
    "cat-4527": {
        "cargoTypes": [
            "coke"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coke:description MLG: coke"
    },
    "cat-4529": {
        "cargoTypes": [
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ore:description MLG: minerai de fer/Erz"
    },
    "cat-4531": {
        "cargoTypes": [
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ore:description MLG: minerai de fer/Erz"
    },
    "cat-4532": {
        "cargoTypes": [
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ore:description MLG: minerai de fer/Erz"
    },
    "cat-4534": {
        "cargoTypes": [
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ore:description MLG: minerai de fer/Erz"
    },
    "cat-4559": {
        "cargoTypes": [
            "limestone"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "limestone:description MLG: calcaire"
    },
    "cat-4564": {
        "cargoTypes": [
            "lignite"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "lignite:description MLG: lignite"
    },
    "cat-4682": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-4703": {
        "cargoTypes": [
            "mini-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "mini-containers:description MLG: mini-conteneurs"
    },
    "cat-4704": {
        "cargoTypes": [
            "mini-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "mini-containers:description MLG: mini-conteneurs"
    },
    "cat-4705": {
        "cargoTypes": [
            "mini-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "mini-containers:description MLG: mini-conteneurs"
    },
    "cat-4706": {
        "cargoTypes": [
            "mini-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "mini-containers:description MLG: mini-conteneurs"
    },
    "cat-4707": {
        "cargoTypes": [
            "mini-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "mini-containers:description MLG: mini-conteneurs"
    },
    "cat-4708": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4709": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4710": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4711": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4712": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4713": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4714": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4715": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4716": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4717": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4718": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4736": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4808": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4810": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4812": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4817": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4823": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4825": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4826": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4828": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4830": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4832": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4834": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-4840": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4841": {
        "cargoTypes": [
            "steel-pipe",
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs | steel-pipe:description MLG: tubes/tuyaux"
    },
    "cat-4843": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4844": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4846": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4848": {
        "cargoTypes": [
            "steel-pipe",
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs | steel-pipe:description MLG: tubes/tuyaux"
    },
    "cat-4850": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-4853": {
        "cargoTypes": [
            "semi-trailers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "semi-trailers:description MLG: semi-remorques"
    },
    "cat-4854": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4858": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-4930": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-4933": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-5016": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-5017": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-5038": {
        "cargoTypes": [
            "containers",
            "postal-roll-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "postal-roll-containers:description MLG: conteneurs postaux roulants | containers:description MLG: conteneurs"
    },
    "cat-5039": {
        "cargoTypes": [
            "containers",
            "postal-roll-containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "postal-roll-containers:description MLG: conteneurs postaux roulants | containers:description MLG: conteneurs"
    },
    "cat-5918": {
        "cargoTypes": [
            "potatoes-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "potatoes-bulk:description MLG: pommes de terre"
    },
    "cat-6533": {
        "cargoTypes": [
            "industrial-ice"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "industrial-ice:description MLG: glace"
    },
    "cat-6542": {
        "cargoTypes": [
            "limestone"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "limestone:description MLG: calcaire"
    },
    "cat-6543": {
        "cargoTypes": [
            "semi-trailers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "semi-trailers:description MLG: semi-remorques"
    },
    "cat-6546": {
        "cargoTypes": [
            "coke"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coke:description MLG: coke"
    },
    "cat-6550": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-6551": {
        "cargoTypes": [
            "gravel"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "gravel:description/nom MLG: gravier"
    },
    "cat-6610": {
        "cargoTypes": [
            "scrap-metal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "scrap-metal:description MLG: ferraille"
    },
    "cat-6611": {
        "cargoTypes": [
            "lime-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "lime-bulk:description MLG: chaux"
    },
    "cat-6616": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-6617": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-6618": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-6619": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-6620": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-6630": {
        "cargoTypes": [
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-6633": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-6634": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-7803": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-7804": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-7807": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-8093": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8094": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8095": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8096": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8097": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8098": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8099": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8100": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8101": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8102": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8103": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8104": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8105": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8106": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8107": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8108": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8109": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8110": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8111": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8112": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8113": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8114": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8115": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8116": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8117": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8118": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8119": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8120": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8121": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8122": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8123": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8124": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8125": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8126": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8127": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8128": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8129": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8130": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8131": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8132": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8133": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8134": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8135": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8136": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8137": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8138": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8139": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8140": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8141": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8142": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8143": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8144": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8145": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8146": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8147": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8148": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8149": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8150": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8151": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8152": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8153": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8154": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8155": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8156": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8157": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8158": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8159": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8160": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8161": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8162": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8163": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8164": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8165": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8166": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8167": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8168": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8169": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8170": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8171": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8172": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8173": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8174": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8175": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8176": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8177": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8178": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8179": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8180": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8181": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8182": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8183": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8184": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8185": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8186": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8187": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8188": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8189": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8190": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8191": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8192": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8193": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8194": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8195": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8196": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8197": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8198": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8199": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8200": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8201": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8202": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8203": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8204": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8205": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8206": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8207": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8208": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8209": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8210": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8211": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8212": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8213": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8214": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8215": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8216": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8217": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8218": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8219": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8220": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8221": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8222": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8223": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8224": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8225": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8226": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8227": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8228": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8229": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8230": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8231": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8232": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8233": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8234": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8235": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8236": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8237": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8238": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8239": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8240": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8241": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8242": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8243": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8244": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8245": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8246": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8247": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8248": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8249": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8250": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8251": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8252": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8253": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8254": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8255": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8256": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8257": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8258": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8259": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8260": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8261": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8262": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8263": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8264": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8265": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8266": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8267": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8268": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8269": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8270": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8271": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8272": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8273": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8274": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8275": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8276": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8277": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8278": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8279": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8280": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8281": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8282": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8283": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8284": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8285": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8286": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8287": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8288": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8289": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8290": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8291": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8292": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8293": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8294": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8295": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8296": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8297": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8298": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8299": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8300": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8301": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8302": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8303": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8304": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8305": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8306": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8307": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8308": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8309": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8310": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8311": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8312": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8313": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8314": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8315": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8316": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8317": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8318": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8319": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8320": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8321": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8322": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8323": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8324": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8325": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8326": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8327": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8328": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8329": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8330": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8331": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8332": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8333": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8334": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8335": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8336": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8337": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8338": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8339": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8340": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8341": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8342": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8343": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8344": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8345": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8346": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8347": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8348": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8349": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8350": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8351": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8352": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8353": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8354": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8355": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8356": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8357": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8358": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8359": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8360": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8361": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8362": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8363": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8364": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8365": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8367": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8368": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8369": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8370": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8371": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8372": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8373": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8374": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8375": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8376": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8377": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8378": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8379": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8380": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8381": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8382": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8383": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8384": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8385": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8386": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8387": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8388": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8389": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8390": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8391": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8392": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8393": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8441": {
        "cargoTypes": [
            "semi-trailers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "semi-trailers:description MLG: semi-remorques"
    },
    "cat-8445": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8446": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8447": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8448": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8457": {
        "cargoTypes": [
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-8458": {
        "cargoTypes": [
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-8459": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8460": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8468": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8469": {
        "cargoTypes": [
            "soda-ash"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "soda-ash:description MLG: carbonate de soude"
    },
    "cat-8471": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8472": {
        "cargoTypes": [
            "soda-ash"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "soda-ash:description MLG: carbonate de soude"
    },
    "cat-8473": {
        "cargoTypes": [
            "glass-sand"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "glass-sand:description MLG: sable de verrerie"
    },
    "cat-8474": {
        "cargoTypes": [
            "glass-sand"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "glass-sand:description MLG: sable de verrerie"
    },
    "cat-8475": {
        "cargoTypes": [
            "cement"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cement:description/nom MLG: ciment"
    },
    "cat-8478": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8479": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8480": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8481": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8482": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8483": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8484": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8485": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8486": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-8509": {
        "cargoTypes": [
            "cement"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cement:description/nom MLG: ciment"
    },
    "cat-8510": {
        "cargoTypes": [
            "cement"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cement:description/nom MLG: ciment"
    },
    "cat-8511": {
        "cargoTypes": [
            "cement"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cement:description/nom MLG: ciment"
    },
    "cat-8627": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8628": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8629": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8630": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8631": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8632": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8633": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8634": {
        "cargoTypes": [
            "coal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille"
    },
    "cat-8652": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8654": {
        "cargoTypes": [
            "coal",
            "ore"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "coal:description MLG: charbon/houille | ore:description MLG: minerai de fer/Erz"
    },
    "cat-8852": {
        "cargoTypes": [
            "ethanol"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ethanol:description/nom MLG: éthanol"
    },
    "cat-8876": {
        "cargoTypes": [
            "bananas-refrigerated"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "bananas-refrigerated:description/nom MLG: banane"
    },
    "cat-8919": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8920": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-8945": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-8949": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-8964": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-8965": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-8966": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-8967": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8968": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8969": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8970": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8971": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8972": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-8980": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8981": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8990": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-8991": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-8999": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-9010": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9011": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9012": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9013": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9014": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9015": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9016": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9017": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9018": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9019": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9020": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9021": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9022": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9023": {
        "cargoTypes": [
            "grain",
            "sugar-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains | sugar-bulk:description/nom MLG: sucre/sucrier"
    },
    "cat-9066": {
        "cargoTypes": [
            "automotive-parts"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "automotive-parts:description MLG: pièces automobiles"
    },
    "cat-9067": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-9068": {
        "cargoTypes": [
            "cars"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cars:description MLG: automobiles"
    },
    "cat-9069": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-9070": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-9072": {
        "cargoTypes": [
            "automotive-parts"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "automotive-parts:description MLG: pièces automobiles"
    },
    "cat-9333": {
        "cargoTypes": [
            "household-waste"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "household-waste:description MLG: ordures ménagères"
    },
    "cat-9570": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-9586": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-9587": {
        "cargoTypes": [
            "bulk-powders",
            "cement"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "cement:description/nom MLG: ciment | bulk-powders:description MLG: produits pulvérulents"
    },
    "cat-9595": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-9596": {
        "cargoTypes": [
            "fertilizer-bulk"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fertilizer-bulk:description MLG: engrais"
    },
    "cat-9604": {
        "cargoTypes": [
            "bulk-powders"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "bulk-powders:description MLG: produits pulvérulents"
    },
    "cat-9605": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-9606": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-9607": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-10377": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-10381": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-10382": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-10383": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-10384": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-10385": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10386": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10387": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10388": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10389": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10390": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-10412": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11190": {
        "cargoTypes": [
            "glass"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "glass:description MLG: vitres"
    },
    "cat-11203": {
        "cargoTypes": [
            "zinc"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "zinc:description MLG: zinc"
    },
    "cat-11210": {
        "cargoTypes": [
            "parcels"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "parcels:description MLG: colis"
    },
    "cat-11218": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11219": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11228": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11229": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11230": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11231": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11232": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11233": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11235": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11237": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11238": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11240": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11242": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11243": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11251": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11252": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-11259": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11260": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11261": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11262": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11263": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-11268": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-11269": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-13533": {
        "cargoTypes": [
            "concrete-sleepers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "concrete-sleepers:description MLG: traverses béton"
    },
    "cat-13536": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-13537": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-13539": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-13540": {
        "cargoTypes": [
            "ballast"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "ballast:description MLG: ballast"
    },
    "cat-14886": {
        "cargoTypes": [
            "scrap-metal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "scrap-metal:description MLG: ferraille"
    },
    "cat-14889": {
        "cargoTypes": [
            "sand"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "sand:description MLG: sable"
    },
    "cat-14891": {
        "cargoTypes": [
            "scrap-metal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "scrap-metal:description MLG: ferraille"
    },
    "cat-14898": {
        "cargoTypes": [
            "dry-clay",
            "feldspar",
            "kaolin",
            "quarry-products"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "quarry-products:description MLG: produits de carrière | kaolin:description MLG: kaolin | dry-clay:description MLG: argile | feldspar:description MLG: feldspath"
    },
    "cat-14899": {
        "cargoTypes": [
            "dry-clay",
            "feldspar",
            "kaolin",
            "quarry-products"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "quarry-products:description MLG: produits de carrière | kaolin:description MLG: kaolin | dry-clay:description MLG: argile | feldspar:description MLG: feldspath"
    },
    "cat-14900": {
        "cargoTypes": [
            "flour",
            "quarry-products"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "flour:description MLG: farine | quarry-products:description MLG: produits de carrière"
    },
    "cat-14905": {
        "cargoTypes": [
            "scrap-metal"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "scrap-metal:description MLG: ferraille"
    },
    "cat-14907": {
        "cargoTypes": [
            "flour"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "flour:description MLG: farine"
    },
    "cat-14931": {
        "cargoTypes": [
            "fresh-produce"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fresh-produce:description MLG: fruits et légumes"
    },
    "cat-14946": {
        "cargoTypes": [
            "fresh-produce"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fresh-produce:description MLG: fruits et légumes"
    },
    "cat-14960": {
        "cargoTypes": [
            "fresh-produce"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "fresh-produce:description MLG: fruits et légumes"
    },
    "cat-14969": {
        "cargoTypes": [
            "livestock"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "livestock:description MLG: grands animaux"
    },
    "cat-14980": {
        "cargoTypes": [
            "livestock"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "livestock:description MLG: grands animaux"
    },
    "cat-15016": {
        "cargoTypes": [
            "vehicles"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "vehicles:description MLG: véhicules"
    },
    "cat-15017": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-15018": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-15025": {
        "cargoTypes": [
            "timber"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "timber:description MLG: bois/grumes/troncs"
    },
    "cat-15026": {
        "cargoTypes": [
            "military"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "military:description MLG: blindés"
    },
    "cat-15057": {
        "cargoTypes": [
            "steel-pipe"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-pipe:description MLG: tubes/tuyaux"
    },
    "cat-15058": {
        "cargoTypes": [
            "steel-pipe"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-pipe:description MLG: tubes/tuyaux"
    },
    "cat-15059": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-15060": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-15061": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-15063": {
        "cargoTypes": [
            "oversized-loads"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "oversized-loads:description MLG: charges encombrantes"
    },
    "cat-15064": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15065": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15066": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15067": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15068": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15069": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15070": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15071": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15072": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15073": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-15380": {
        "cargoTypes": [
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles"
    },
    "cat-15381": {
        "cargoTypes": [
            "containers",
            "swap-bodies"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "swap-bodies:description MLG: caisses mobiles | containers:description MLG: conteneurs"
    },
    "cat-15382": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-15383": {
        "cargoTypes": [
            "containers"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "containers:description MLG: conteneurs"
    },
    "cat-15850": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-15851": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-15852": {
        "cargoTypes": [
            "grain"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "grain:description/nom MLG: céréalier/grains"
    },
    "cat-15853": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-16054": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-16055": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    },
    "cat-16056": {
        "cargoTypes": [
            "steel-coils"
        ],
        "technicallyCompatibleCargoTypes": [],
        "freightValidationSource": "MLG Traffic — description explicite du catalogue",
        "freightValidationScope": "MLG_EXPLICIT_CARGO_TEXT",
        "freightEvidence": "steel-coils:description MLG: coils/rouleaux de tôles"
    }
};
export const BATCH186_FREIGHT_PASS2_INDUSTRY_ADDITIONS = {
    "grain_terminal": [
        "grain",
        "potatoes-bulk"
    ],
    "sugar_refinery": [
        "sugar-bulk"
    ],
    "food_processing": [
        "sugar-bulk",
        "potatoes-bulk",
        "bananas-refrigerated"
    ],
    "glass_factory": [
        "glass-sand"
    ],
    "logistics_hub": [
        "acts-containers",
        "automotive-parts",
        "bananas-refrigerated",
        "mini-containers",
        "postal-roll-containers",
        "oversized-loads"
    ],
    "rail_route": [
        "acts-containers"
    ],
    "container_terminal": [
        "acts-containers",
        "mini-containers"
    ],
    "auto_parts": [
        "automotive-parts"
    ],
    "auto_plant": [
        "automotive-parts"
    ],
    "mine": [
        "lignite",
        "zinc"
    ],
    "power_plant": [
        "lignite"
    ],
    "foundry": [
        "zinc"
    ],
    "concrete_plant": [
        "concrete-sleepers"
    ],
    "rail_workshop": [
        "concrete-sleepers"
    ],
    "waste_center": [
        "excavated-material"
    ],
    "postal_center": [
        "postal-roll-containers"
    ],
    "quarry": [
        "glass-sand",
        "excavated-material",
        "quarry-products"
    ]
};
export function applyBatch186FreightPass2ToCatalog(catalog) {
    if (!Array.isArray(catalog))
        return catalog;
    return catalog.map(entry => {
        const record = catalogRecord(entry);
        const patch = record && BATCH186_FREIGHT_PASS2_WAGON_PATCH[String(record.id ?? '')];
        if (!patch)
            return entry;
        return { ...record, cargoTypes: [...(patch.cargoTypes || [])], technicallyCompatibleCargoTypes: [...(patch.technicallyCompatibleCargoTypes || [])], freightValidationSource: patch.freightValidationSource, freightValidationScope: patch.freightValidationScope, freightEvidence: patch.freightEvidence, freightBatch: 'Batch186-FreightPass2' };
    });
}
export function applyBatch186FreightPass2IndustryPatch(industrialClients) {
    const host = industryPatchHost(industrialClients);
    const types = host?.getIndustryTypes?.();
    if (!Array.isArray(types))
        return { updated: 0 };
    let updated = 0;
    for (const [type, cargos] of Object.entries(BATCH186_FREIGHT_PASS2_INDUSTRY_ADDITIONS)) {
        const ind = types.find(x => x.type === type);
        if (!ind)
            continue;
        if (!Array.isArray(ind.cargoTypes))
            ind.cargoTypes = [];
        let changed = false;
        for (const cargo of cargos) {
            if (!ind.cargoTypes.includes(cargo)) {
                ind.cargoTypes.push(cargo);
                changed = true;
            }
        }
        if (changed)
            updated++;
    }
    return { updated };
}
