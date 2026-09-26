#!/usr/bin/env node
// Exporte le catalogue matériel exact du jeu (même pipeline que Game.seedCatalog +
// chunks Batch186) vers un JSON consommé par l'application native
// "Rail Empire Catalogue" (catalogue-natif/). Usage :
//   node scripts/export-native-catalog.mjs [--out=chemin/catalog.native.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(ROOT, 'js');
const argv = process.argv.slice(2);
const optValue = (name) => { const a = argv.find((x) => x.startsWith(`${name}=`)); return a ? a.slice(name.length + 1) : ''; };
const outPath = path.resolve(ROOT, optValue('--out') || path.join('catalogue-natif', 'data', 'catalog.native.json'));

const mod = (file) => import(pathToFileURL(path.join(JS, file)).href);

const [
  data, pack, identity,
  freight, freight2, catOverrides, price, norm, cargoBase, cargoTypesMod, loader,
] = await Promise.all([
  mod('catalog-data.js'), mod('catalog-data-pack-re.js'), mod('catalog-identity-batch186.js'),
  mod('catalog-freight-batch186.js'), mod('catalog-freight-batch186-pass2.js'),
  mod('catalog-batch186-category-overrides.js'), mod('catalog-price-balance.js'),
  mod('catalog-cargo-normalization.js'), mod('catalog-cargo-types-base.js'), mod('cargo-types.js'),
  mod('catalog-batch186-full-loader.js'),
]);

const CATALOG = data.CATALOG || [];
const CATALOG_PACK_RE = pack.CATALOG_PACK_RE || [];
const IDENT = identity.CATALOG_IDENTITY_BATCH186 || {};

let all = [...CATALOG];
all = freight.applyBatch186FreightToCatalog(all);
all = freight2.applyBatch186FreightPass2ToCatalog(all);
all = catOverrides.applyBatch186CategoryOverrides(all);
all = all.concat(CATALOG_PACK_RE);
all = norm.normalizeCatalogCargoKeys(all);
all = all.map((e) => { const i = IDENT[e.id]; return i ? { ...e, ...i, mlgSeriesName: e.seriesName || '' } : e; });
all = price.applyBalancedPurchasePrices(all);

let additions = await loader.loadBatch186FullCatalogAdditions();
additions = price.applyBalancedPurchasePrices(norm.normalizeCatalogCargoKeys(additions));

const seen = new Set();
const entries = [];
for (const e of [...all, ...additions]) {
  if (!e || !e.id || seen.has(e.id)) continue;
  seen.add(e.id);
  entries.push(e);
}

const cargo = new cargoTypesMod.CargoTypeManager();
for (const list of [cargoBase.CATALOG_CARGO_TYPES_BASE, freight.BATCH186_FREIGHT_CARGO_TYPES, freight2.BATCH186_FREIGHT_PASS2_CARGO_TYPES, norm.CATALOG_NORMALIZATION_EXTRA_CARGO_TYPES]) {
  if (Array.isArray(list)) for (const ct of list) cargo.ensureType(ct.category, ct);
}
const cargoCategories = Object.entries(cargo.categories).map(([key, cat]) => ({
  key, name: cat.name,
  types: (cat.types || []).map((t) => ({ type: t.type, name: t.name, unit: t.unit || '' })),
}));

const pkgVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '';
const out = {
  format: 'rail-empire-native-catalog',
  version: 1,
  gameVersion: pkgVersion,
  generatedAt: new Date().toISOString(),
  imageRoot: 'img/catalog',
  count: entries.length,
  cargoCategories,
  entries,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`Catalogue natif exporté : ${entries.length} fiches, ${cargoCategories.length} catégories de fret → ${path.relative(ROOT, outPath)} (${(fs.statSync(outPath).size / 1048576).toFixed(1)} Mo)`);
