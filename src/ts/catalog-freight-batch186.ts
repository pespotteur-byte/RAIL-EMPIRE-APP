import { catalogRecord, industryPatchHost } from './catalog-contracts.js';
import type { CargoDefinition, FreightPatch, IndustryPatchType } from './catalog-contracts.js';
// Rail Empire — Batch186 Freight Integration
// Stable technical cargo IDs; all player-visible cargo labels are French.
// Sources: validated France Lots 001 Rils, 002 Citernes, 003 Trémies.

export const BATCH186_FREIGHT_CARGO_TYPES: CargoDefinition[] = [
  {
    "type": "mineral-water-palletized",
    "name": "Eaux minérales conditionnées",
    "category": "alimentaire",
    "unit": "t",
    "transportForm": "Palettes de bouteilles",
    "hazard": false,
    "pricePerUnit": 58,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Contrex",
      "Evian",
      "Vittel"
    ],
    "producers": [
      "source-mineral-water-bottling"
    ],
    "consumers": [
      "beverage-distribution-center",
      "retail-logistics-hub"
    ],
    "iteTypes": [
      "ite-covered-loading",
      "ite-beverage-warehouse"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Alimentaire & boissons"
  },
  {
    "type": "beer-palletized",
    "name": "Bière conditionnée",
    "category": "alimentaire",
    "unit": "t",
    "transportForm": "Palettes de bouteilles, canettes ou fûts conditionnés",
    "hazard": false,
    "pricePerUnit": 92,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Kronenbourg"
    ],
    "producers": [
      "brewery"
    ],
    "consumers": [
      "beverage-distribution-center",
      "retail-logistics-hub"
    ],
    "iteTypes": [
      "ite-brewery",
      "ite-beverage-warehouse"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Alimentaire & boissons"
  },
  {
    "type": "palletized-consumer-goods",
    "name": "Produits de grande consommation palettisés",
    "category": "general",
    "unit": "t",
    "transportForm": "Palettes",
    "hazard": false,
    "pricePerUnit": 105,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Rils 20 - essais et premiers services commerciaux"
    ],
    "producers": [
      "consumer-goods-factory",
      "regional-warehouse"
    ],
    "consumers": [
      "distribution-center",
      "retail-logistics-hub"
    ],
    "iteTypes": [
      "ite-covered-loading",
      "ite-warehouse"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Marchandises générales",
    "wagonType": "wagon couvert / bâché"
  },
  {
    "type": "fibreboard-panels",
    "name": "Panneaux en fibres de bois",
    "category": "bois",
    "unit": "t",
    "transportForm": "Panneaux protégés des intempéries",
    "hazard": false,
    "pricePerUnit": 58,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Prototype et essais Débach'vit"
    ],
    "producers": [
      "wood-panel-factory"
    ],
    "consumers": [
      "building-materials-distributor",
      "furniture-factory"
    ],
    "iteTypes": [
      "ite-wood-products",
      "ite-covered-loading"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Bois & papier"
  },
  {
    "type": "paperboard-rolls",
    "name": "Rouleaux de cartonnage",
    "category": "bois",
    "unit": "t",
    "transportForm": "Rouleaux arrimés sur plancher",
    "hazard": false,
    "pricePerUnit": 72,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Rils 20 - 2e sous-série"
    ],
    "producers": [
      "paper-mill",
      "cardboard-mill"
    ],
    "consumers": [
      "packaging-factory",
      "printing-plant"
    ],
    "iteTypes": [
      "ite-paper-mill",
      "ite-covered-loading"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Bois & papier"
  },
  {
    "type": "packaged-paper-products",
    "name": "Produits papetiers conditionnés",
    "category": "bois",
    "unit": "t",
    "transportForm": "Palettes ou lots protégés",
    "hazard": false,
    "pricePerUnit": 82,
    "status": "Nouveau - à ajouter",
    "documentedFor": [
      "Cellulose du Pin / Smurfit - affectations documentées"
    ],
    "producers": [
      "paper-mill",
      "packaging-factory"
    ],
    "consumers": [
      "distribution-center",
      "printing-plant"
    ],
    "iteTypes": [
      "ite-paper-mill",
      "ite-covered-loading"
    ],
    "validationSource": "France Lot001 Rils",
    "categoryName": "Bois & papier"
  },
  {
    "category": "liquides",
    "type": "grape-juice-bulk",
    "name": "Jus de raisin en vrac",
    "unit": "m³",
    "pricePerUnit": 115,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "grape-must-bulk",
    "name": "Moût de raisin en vrac",
    "unit": "m³",
    "pricePerUnit": 125,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "mistelle-bulk",
    "name": "Mistelle en vrac",
    "unit": "m³",
    "pricePerUnit": 145,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "beverage-alcohol-bulk",
    "name": "Alcool de bouche en vrac (< 60°)",
    "unit": "m³",
    "pricePerUnit": 190,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "fruit-juice-concentrate",
    "name": "Concentré de jus de fruits",
    "unit": "m³",
    "pricePerUnit": 165,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "vinegar-bulk",
    "name": "Vinaigre en vrac",
    "unit": "m³",
    "pricePerUnit": 105,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "beer-bulk",
    "name": "Bière en vrac",
    "unit": "m³",
    "pricePerUnit": 125,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "calcium-carbonate-slurry",
    "name": "Craie liquide / carbonate de calcium en suspension",
    "unit": "m³",
    "pricePerUnit": 72,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "sulfur-liquid",
    "name": "Soufre liquide",
    "unit": "m³",
    "pricePerUnit": 95,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "gaz",
    "type": "butane",
    "name": "Butane liquéfié",
    "unit": "m³",
    "pricePerUnit": 225,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "gaz",
    "type": "propane",
    "name": "Propane liquéfié",
    "unit": "m³",
    "pricePerUnit": 235,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "gaz",
    "type": "propylene",
    "name": "Propylène liquéfié",
    "unit": "m³",
    "pricePerUnit": 260,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "gaz",
    "type": "vinyl-chloride",
    "name": "Chlorure de vinyle stabilisé",
    "unit": "t",
    "pricePerUnit": 330,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "vinyl-acetate",
    "name": "Acétate de vinyle",
    "unit": "m³",
    "pricePerUnit": 245,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "naphtha",
    "name": "Naphta",
    "unit": "m³",
    "pricePerUnit": 108,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "heating-oil",
    "name": "Fioul domestique",
    "unit": "m³",
    "pricePerUnit": 88,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "methanol",
    "name": "Méthanol",
    "unit": "m³",
    "pricePerUnit": 155,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "acetone",
    "name": "Acétone",
    "unit": "m³",
    "pricePerUnit": 175,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "styrene",
    "name": "Styrène",
    "unit": "m³",
    "pricePerUnit": 205,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "bitumen",
    "name": "Bitume",
    "unit": "m³",
    "pricePerUnit": 82,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "tar",
    "name": "Goudron",
    "unit": "m³",
    "pricePerUnit": 76,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "paraffin",
    "name": "Paraffine liquide",
    "unit": "m³",
    "pricePerUnit": 118,
    "hazard": false,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "liquides",
    "type": "liquid-pitch",
    "name": "Brai liquide",
    "unit": "m³",
    "pricePerUnit": 90,
    "hazard": true,
    "balanceStatus": "paramètre de gameplay à valider dans l’économie Rail Empire",
    "densityTPerM3": null,
    "densityStatus": "non renseignée: aucune conversion volume/masse automatique sans source et produit précis",
    "validationSource": "France Lot002 Citernes"
  },
  {
    "category": "vrac_solide",
    "type": "lime-bulk",
    "name": "Chaux en vrac",
    "unit": "t",
    "pricePerUnit": 24,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "chalk-powder",
    "name": "Craie en poudre / carbonate de calcium",
    "unit": "t",
    "pricePerUnit": 18,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "fly-ash",
    "name": "Cendres volantes",
    "unit": "t",
    "pricePerUnit": 12,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "limestone-powder",
    "name": "Poudre de calcaire / filler",
    "unit": "t",
    "pricePerUnit": 16,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "feldspar",
    "name": "Feldspath",
    "unit": "t",
    "pricePerUnit": 32,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "alumina-powder",
    "name": "Alumine en poudre",
    "unit": "t",
    "pricePerUnit": 85,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "perlite",
    "name": "Perlite",
    "unit": "t",
    "pricePerUnit": 28,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "dolomite-powder",
    "name": "Dolomie en poudre",
    "unit": "t",
    "pricePerUnit": 18,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "dry-clay",
    "name": "Argile sèche",
    "unit": "t",
    "pricePerUnit": 16,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "vrac_solide",
    "type": "coke",
    "name": "Coke métallurgique",
    "unit": "t",
    "pricePerUnit": 25,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "chimie",
    "type": "soda-ash",
    "name": "Carbonate de soude",
    "unit": "t",
    "pricePerUnit": 42,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "chimie",
    "type": "carbon-black",
    "name": "Noir de carbone",
    "unit": "t",
    "pricePerUnit": 95,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "chimie",
    "type": "iron-sulfate",
    "name": "Sulfate de fer",
    "unit": "t",
    "pricePerUnit": 48,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "chimie",
    "type": "lead-oxide",
    "name": "Oxyde de plomb",
    "unit": "t",
    "pricePerUnit": 180,
    "hazard": true,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  },
  {
    "category": "chimie",
    "type": "zeolite",
    "name": "Zéolite",
    "unit": "t",
    "pricePerUnit": 55,
    "hazard": false,
    "balanceStatus": "provisional-game-balance",
    "validationSource": "France Lot003 Trémies"
  }
];

export const BATCH186_WAGON_FREIGHT_PATCH: Record<string, FreightPatch> = {
  "cat-8394": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8395": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8396": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8397": {
    "cargoTypes": [
      "grape-juice-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "wine-bulk",
      "mistelle-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8398": {
    "cargoTypes": [
      "grape-juice-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "wine-bulk",
      "mistelle-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8399": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8400": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8401": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8402": {
    "cargoTypes": [
      "wine-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "grape-must-bulk",
      "mistelle-bulk",
      "beverage-alcohol-bulk",
      "fruit-juice-concentrate",
      "food-oil",
      "molasses",
      "vinegar-bulk",
      "milk"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8403": {
    "cargoTypes": [
      "calcium-carbonate-slurry"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8404": {
    "cargoTypes": [
      "calcium-carbonate-slurry"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8405": {
    "cargoTypes": [
      "sulfur-liquid"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8406": {
    "cargoTypes": [
      "sulfur-liquid"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8407": {
    "cargoTypes": [
      "sulfur-liquid"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8408": {
    "cargoTypes": [
      "sulfur-liquid"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8409": {
    "cargoTypes": [
      "butane",
      "propane",
      "lpg"
    ],
    "technicallyCompatibleCargoTypes": [
      "propylene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8410": {
    "cargoTypes": [
      "butane",
      "propane",
      "lpg"
    ],
    "technicallyCompatibleCargoTypes": [
      "propylene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8411": {
    "cargoTypes": [
      "butane",
      "propane",
      "lpg"
    ],
    "technicallyCompatibleCargoTypes": [
      "propylene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8412": {
    "cargoTypes": [
      "butane",
      "lpg"
    ],
    "technicallyCompatibleCargoTypes": [
      "propane",
      "propylene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8413": {
    "cargoTypes": [
      "propane",
      "lpg"
    ],
    "technicallyCompatibleCargoTypes": [
      "butane",
      "propylene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8414": {
    "cargoTypes": [
      "ammonia"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8415": {
    "cargoTypes": [
      "vinyl-chloride"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8416": {
    "cargoTypes": [
      "chlorine"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8417": {
    "cargoTypes": [
      "vinyl-acetate"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8418": {
    "cargoTypes": [
      "naphtha"
    ],
    "technicallyCompatibleCargoTypes": [
      "gasoline",
      "diesel",
      "jet-fuel",
      "heating-oil",
      "ethanol",
      "methanol",
      "acetone",
      "styrene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8419": {
    "cargoTypes": [
      "naphtha"
    ],
    "technicallyCompatibleCargoTypes": [
      "gasoline",
      "diesel",
      "jet-fuel",
      "heating-oil",
      "ethanol",
      "methanol",
      "acetone",
      "styrene"
    ],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8420": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8421": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8422": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8423": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8424": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8425": {
    "cargoTypes": [
      "fuel-oil",
      "bitumen",
      "tar",
      "paraffin",
      "liquid-pitch"
    ],
    "technicallyCompatibleCargoTypes": [],
    "freightValidationSource": "France Lot002 Citernes — matrice validée",
    "freightValidationScope": "documented_enabled_plus_conditional_technical"
  },
  "cat-8726": {
    "cargoTypes": [
      "bauxite"
    ],
    "technicallyCompatibleCargoTypes": [
      "ore",
      "coal",
      "coke",
      "slag",
      "ballast",
      "limestone"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8727": {
    "cargoTypes": [
      "bauxite"
    ],
    "technicallyCompatibleCargoTypes": [
      "ore",
      "coal",
      "coke",
      "slag",
      "ballast",
      "limestone"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8728": {
    "cargoTypes": [
      "bauxite"
    ],
    "technicallyCompatibleCargoTypes": [
      "ore",
      "coal",
      "coke",
      "slag",
      "ballast",
      "limestone"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8729": {
    "cargoTypes": [
      "limestone"
    ],
    "technicallyCompatibleCargoTypes": [
      "limestone-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8730": {
    "cargoTypes": [
      "limestone"
    ],
    "technicallyCompatibleCargoTypes": [
      "limestone-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8731": {
    "cargoTypes": [
      "limestone"
    ],
    "technicallyCompatibleCargoTypes": [
      "limestone-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8732": {
    "cargoTypes": [
      "soda-ash"
    ],
    "technicallyCompatibleCargoTypes": [
      "soda-ash"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8733": {
    "cargoTypes": [
      "soda-ash"
    ],
    "technicallyCompatibleCargoTypes": [
      "soda-ash"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8734": {
    "cargoTypes": [
      "soda-ash"
    ],
    "technicallyCompatibleCargoTypes": [
      "soda-ash"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8735": {
    "cargoTypes": [
      "soda-ash"
    ],
    "technicallyCompatibleCargoTypes": [
      "soda-ash"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8736": {
    "cargoTypes": [
      "lime-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "lime-bulk"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8737": {
    "cargoTypes": [
      "lime-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "lime-bulk"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8738": {
    "cargoTypes": [
      "lime-bulk"
    ],
    "technicallyCompatibleCargoTypes": [
      "sand",
      "dry-clay",
      "fertilizer-bulk"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8739": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "limestone-powder",
      "lime-bulk",
      "gypsum",
      "fly-ash",
      "soda-ash",
      "sand",
      "feldspar",
      "iron-sulfate",
      "lead-oxide",
      "zeolite",
      "alumina-powder",
      "perlite",
      "dolomite-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8740": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "limestone-powder",
      "lime-bulk",
      "gypsum",
      "fly-ash",
      "soda-ash",
      "sand",
      "feldspar",
      "iron-sulfate",
      "lead-oxide",
      "zeolite",
      "alumina-powder",
      "perlite",
      "dolomite-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8741": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8742": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8743": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8744": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8745": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8746": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8747": {
    "cargoTypes": [
      "carbon-black"
    ],
    "technicallyCompatibleCargoTypes": [
      "carbon-black"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8748": {
    "cargoTypes": [
      "sugar"
    ],
    "technicallyCompatibleCargoTypes": [
      "sugar"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8749": {
    "cargoTypes": [
      "sugar"
    ],
    "technicallyCompatibleCargoTypes": [
      "sugar"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8750": {
    "cargoTypes": [
      "sugar"
    ],
    "technicallyCompatibleCargoTypes": [
      "sugar"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8751": {
    "cargoTypes": [
      "sugar"
    ],
    "technicallyCompatibleCargoTypes": [
      "sugar"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8752": {
    "cargoTypes": [
      "sugar"
    ],
    "technicallyCompatibleCargoTypes": [
      "sugar"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8753": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "lime-bulk",
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8754": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "lime-bulk",
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8755": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "lime-bulk",
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8756": {
    "cargoTypes": [
      "cement"
    ],
    "technicallyCompatibleCargoTypes": [
      "cement",
      "lime-bulk",
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8757": {
    "cargoTypes": [
      "chalk-powder"
    ],
    "technicallyCompatibleCargoTypes": [
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8758": {
    "cargoTypes": [
      "chalk-powder"
    ],
    "technicallyCompatibleCargoTypes": [
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8759": {
    "cargoTypes": [
      "chalk-powder"
    ],
    "technicallyCompatibleCargoTypes": [
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8760": {
    "cargoTypes": [
      "chalk-powder"
    ],
    "technicallyCompatibleCargoTypes": [
      "chalk-powder"
    ],
    "freightValidationSource": "France Lot003 Trémies Helper V2",
    "freightValidationScope": "documented_enabled_plus_technical"
  },
  "cat-8573": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8574": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8575": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8576": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8577": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8578": {
    "cargoTypes": [
      "beer-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "mineral-water-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8579": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  },
  "cat-8580": {
    "cargoTypes": [
      "mineral-water-palletized"
    ],
    "technicallyCompatibleCargoTypes": [
      "beer-palletized",
      "palletized-consumer-goods",
      "fibreboard-panels",
      "paperboard-rolls",
      "packaged-paper-products",
      "beverages",
      "plywood",
      "paper",
      "cardboard",
      "fertilizer-bag",
      "canned-food",
      "sugar",
      "flour",
      "tires",
      "insulation"
    ],
    "freightValidationSource": "France Lot001 Rils 10/10",
    "freightValidationScope": "documented_livery_cargo_plus_family_technical"
  }
};

export const BATCH186_INDUSTRY_CARGO_ADDITIONS: Record<string, string[]> = {
  "refinery": [
    "naphtha",
    "heating-oil",
    "bitumen",
    "tar",
    "paraffin",
    "liquid-pitch",
    "butane",
    "propane",
    "propylene",
    "sulfur-liquid"
  ],
  "chemical_plant": [
    "calcium-carbonate-slurry",
    "sulfur-liquid",
    "vinyl-chloride",
    "vinyl-acetate",
    "naphtha",
    "methanol",
    "acetone",
    "styrene",
    "soda-ash",
    "carbon-black",
    "iron-sulfate",
    "lead-oxide",
    "zeolite",
    "chalk-powder"
  ],
  "brewery": [
    "wine-bulk",
    "grape-juice-bulk",
    "grape-must-bulk",
    "mistelle-bulk",
    "beverage-alcohol-bulk",
    "fruit-juice-concentrate",
    "vinegar-bulk",
    "beer-bulk",
    "food-oil",
    "molasses",
    "milk",
    "mineral-water-palletized",
    "beer-palletized"
  ],
  "cement": [
    "lime-bulk",
    "chalk-powder",
    "limestone-powder",
    "fly-ash",
    "dolomite-powder"
  ],
  "steel_mill": [
    "lime-bulk",
    "dolomite-powder"
  ],
  "paper_mill": [
    "chalk-powder",
    "limestone-powder",
    "paperboard-rolls",
    "packaged-paper-products"
  ],
  "power_plant": [
    "fly-ash"
  ],
  "quarry": [
    "chalk-powder",
    "limestone-powder",
    "feldspar",
    "perlite",
    "dry-clay",
    "dolomite-powder"
  ],
  "glass_factory": [
    "soda-ash",
    "limestone-powder",
    "feldspar",
    "dolomite-powder"
  ],
  "tire_plant": [
    "carbon-black"
  ],
  "aluminium_smelter": [
    "alumina-powder"
  ],
  "concrete_plant": [
    "fly-ash",
    "lime-bulk"
  ],
  "plastics_plant": [
    "carbon-black",
    "chalk-powder",
    "limestone-powder"
  ],
  "ceramics": [
    "feldspar",
    "dry-clay",
    "perlite",
    "chalk-powder"
  ],
  "logistics_hub": [
    "mineral-water-palletized",
    "beer-palletized",
    "palletized-consumer-goods",
    "fibreboard-panels",
    "paperboard-rolls",
    "packaged-paper-products"
  ],
  "sawmill": [
    "fibreboard-panels"
  ],
  "furniture": [
    "fibreboard-panels"
  ]
};

export const BATCH186_NEW_INDUSTRIES: IndustryPatchType[] = [
  {
    "type": "soda_plant",
    "name": "Soudière",
    "icon": "ind_chemical",
    "cargoTypes": [
      "limestone",
      "salt",
      "coal",
      "soda-ash"
    ],
    "cargoOut": "Carbonate de soude",
    "dailyTonnageMin": 100,
    "dailyTonnageMax": 1000,
    "pricePerTonne": 40,
    "attractCost": 90000,
    "description": "Ajout validé — chaîne industrielle dédiée aux cargaisons du catalogue MLG.",
    "realLocations": [
      {
        "name": "Solvay - Dombasle-sur-Meurthe",
        "lat": 48.619,
        "lon": 6.348,
        "country": "FR"
      },
      {
        "name": "Novacarb - Laneuveville-devant-Nancy",
        "lat": 48.617,
        "lon": 6.344,
        "country": "FR"
      }
    ]
  },
  {
    "type": "lime_plant",
    "name": "Four à chaux",
    "icon": "ind_chemical",
    "cargoTypes": [
      "limestone",
      "coal",
      "lime-bulk"
    ],
    "cargoOut": "Chaux en vrac",
    "dailyTonnageMin": 100,
    "dailyTonnageMax": 1000,
    "pricePerTonne": 40,
    "attractCost": 90000,
    "description": "Ajout validé — chaîne industrielle dédiée aux cargaisons du catalogue MLG.",
    "realLocations": [
      {
        "name": "Carrières et Fours à Chaux de Dugny",
        "lat": 49.0969,
        "lon": 5.3853,
        "country": "FR"
      }
    ]
  },
  {
    "type": "carbon_black_plant",
    "name": "Usine de noir de carbone",
    "icon": "ind_chemical",
    "cargoTypes": [
      "fuel-oil",
      "carbon-black"
    ],
    "cargoOut": "Noir de carbone",
    "dailyTonnageMin": 100,
    "dailyTonnageMax": 1000,
    "pricePerTonne": 40,
    "attractCost": 90000,
    "description": "Ajout validé — chaîne industrielle dédiée aux cargaisons du catalogue MLG.",
    "realLocations": [
      {
        "name": "Orion / Cofrablack - Ambès",
        "lat": 45.024145,
        "lon": -0.584799,
        "country": "FR"
      }
    ]
  },
  {
    "type": "mineral_processing",
    "name": "Traitement de minéraux industriels",
    "icon": "ind_chemical",
    "cargoTypes": [
      "limestone",
      "chalk-powder",
      "limestone-powder"
    ],
    "cargoOut": "Carbonate de calcium",
    "dailyTonnageMin": 100,
    "dailyTonnageMax": 1000,
    "pricePerTonne": 40,
    "attractCost": 90000,
    "description": "Ajout validé — chaîne industrielle dédiée aux cargaisons du catalogue MLG.",
    "realLocations": [
      {
        "name": "Omya - Orgon",
        "lat": 43.778368,
        "lon": 5.020064,
        "country": "FR"
      }
    ]
  },
  {
    "type": "alumina_refinery",
    "name": "Raffinerie d’alumine",
    "icon": "ind_chemical",
    "cargoTypes": [
      "bauxite",
      "alumina-powder"
    ],
    "cargoOut": "Alumine",
    "dailyTonnageMin": 100,
    "dailyTonnageMax": 1000,
    "pricePerTonne": 40,
    "attractCost": 90000,
    "description": "Ajout validé — chaîne industrielle dédiée aux cargaisons du catalogue MLG.",
    "realLocations": [
      {
        "name": "Alteo - Gardanne",
        "lat": 43.45164,
        "lon": 5.46004,
        "country": "FR"
      }
    ]
  }
];

export function applyBatch186FreightToCatalog(catalog: unknown[]): unknown[] {
  if (!Array.isArray(catalog)) return [];
  return catalog.map(entry => {
    const record = catalogRecord(entry);
    const patch = record && BATCH186_WAGON_FREIGHT_PATCH[String(record.id ?? '')];
    if (!patch) return entry;
    return {
      ...record,
      cargoTypes: [...(patch.cargoTypes || [])],
      technicallyCompatibleCargoTypes: [...(patch.technicallyCompatibleCargoTypes || [])],
      freightValidationSource: patch.freightValidationSource || '',
      freightValidationScope: patch.freightValidationScope || '',
      freightBatch: 'Batch186-FreightPass1',
    };
  });
}

export function applyBatch186IndustryFreightPatch(industrialClients: unknown) {
  const host = industryPatchHost(industrialClients);
  const types = host?.getIndustryTypes?.();
  if (!Array.isArray(types)) return { updated: 0, added: 0 };
  let updated = 0;
  for (const [type, cargos] of Object.entries(BATCH186_INDUSTRY_CARGO_ADDITIONS)) {
    const ind = types.find(x => x.type === type);
    if (!ind) continue;
    if (!Array.isArray(ind.cargoTypes)) ind.cargoTypes = [];
    let changed = false;
    for (const cargo of cargos) {
      if (!ind.cargoTypes.includes(cargo)) { ind.cargoTypes.push(cargo); changed = true; }
    }
    if (changed) updated++;
  }
  let added = 0;
  const colors = host?.getIndustryColors?.();
  const defaultColors: Record<string, string> = {
    soda_plant: '#64748b', lime_plant: '#d6d3d1', carbon_black_plant: '#111827',
    mineral_processing: '#a8a29e', alumina_refinery: '#cbd5e1',
  };
  for (const ni of BATCH186_NEW_INDUSTRIES) {
    if (!types.some(x => x.type === ni.type)) { types.push(structuredClone(ni)); added++; }
    if (colors && !colors[ni.type]) colors[ni.type] = defaultColors[ni.type] || '#94a3b8';
  }
  return { updated, added };
}
