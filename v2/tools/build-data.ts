#!/usr/bin/env node
/**
 * Convertit les données RC28 (catalogue, référentiel gares) vers les chunks V2
 * chargés à la demande. Sortie : v2/apps/game/public/data/.
 *
 *   node tools/build-data.ts [--out=chemin] [--catalog=chemin/catalog.native.json]
 *
 * Sources :
 *  - catalogue : catalogue-natif/data/catalog.native.json (généré par
 *    scripts/export-native-catalog.mjs, même pipeline que le jeu RC28) ;
 *  - référentiel : data/railnet/reference/*.js (82 k points) fusionné avec
 *    data/railnet/stations/*.js (pack strict 31 k) sans doublons.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CATALOG_CATEGORIES,
  CATALOG_INDEX_KEY,
  CATALOG_INDEX_SCHEMA,
  CATALOG_SHARD_COUNT,
  CATALOG_SHARD_SCHEMA,
  TRACTIONS,
  WORLD_INDEX_KEY,
  WORLD_INDEX_SCHEMA,
  WORLD_NAMES_KEY,
  WORLD_NAMES_SCHEMA,
  WORLD_TILE_SCHEMA,
  catalogShardKey,
  catalogShardOf,
  chunkPath,
  encodeChunk,
  haversineM,
  isCatalogCategory,
  isTraction,
  normalizeText,
  parseCatalogEntry,
  refRowFromPoint,
  tileKey,
  tileOf,
  worldTileKey,
  type CatalogEntry,
  type CatalogIndex,
  type RefPoint,
  type RefPointKind,
} from '@re/data';

const V2_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(V2_ROOT, '..');
const argv = process.argv.slice(2);
const opt = (name: string): string => {
  const a = argv.find((x) => x.startsWith(`${name}=`));
  return a ? a.slice(name.length + 1) : '';
};
const OUT = path.resolve(V2_ROOT, opt('--out') || 'apps/game/public/data');
const CATALOG_JSON = path.resolve(REPO_ROOT, opt('--catalog') || 'catalogue-natif/data/catalog.native.json');

let written = 0;
let bytes = 0;
function writeChunk(key: string, payload: unknown): void {
  const file = path.join(OUT, chunkPath(key));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = encodeChunk(key, payload);
  fs.writeFileSync(file, text);
  written++;
  bytes += Buffer.byteLength(text);
}

function rec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------- catalogue

const COUNTRY_FR: Record<string, string> = {
  Germany: 'Allemagne',
  'Germany (former GDR)': 'Allemagne',
  Austria: 'Autriche',
  'Austria / Hungary': 'Autriche',
  Belgium: 'Belgique',
  Croatia: 'Croatie',
  Czechia: 'Tchéquie',
  'Czechoslovakia (historical)': 'Tchéquie',
  Denmark: 'Danemark',
  Hungary: 'Hongrie',
  Ireland: 'Irlande',
  Italy: 'Italie',
  Netherlands: 'Pays-Bas',
  Poland: 'Pologne',
  Serbia: 'Serbie',
  Slovakia: 'Slovaquie',
  Slovenia: 'Slovénie',
  Spain: 'Espagne',
  Switzerland: 'Suisse',
  'USSR / Russia': 'Russie',
  'France / international': 'France',
  International: 'International',
  'International / generic': 'International',
  'International / lessors': 'International',
  'Manufacturers / generic': 'International',
  'Multi-country urban': 'International',
  'Private / mixed': 'International',
  Europe: 'Europe',
  None: '',
  Unmapped: '',
};

function cleanOperator(v: string): string {
  return v.replace(/^MLG source:\s*/i, '').trim();
}

function toEntry(raw: Record<string, unknown>): CatalogEntry | null {
  const category = raw.category;
  const traction = raw.traction;
  if (!isCatalogCategory(category) || !isTraction(traction)) return null;
  const s = (k: string): string => {
    const v = raw[k];
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  };
  const rawCountry = s('identityCountry');
  const country = COUNTRY_FR[rawCountry] ?? rawCountry;
  const image = s('imageData');
  return parseCatalogEntry({
    ...raw,
    image: image.startsWith('data:') ? '' : image,
    source: s('_source'),
    country,
    operator: cleanOperator(s('identityOperator')),
    wagonSubCategory: s('wagonSubCategory'),
    numberStart: s('numberStart'),
    isDrivingTrailer: raw.isDrivingTrailer === true,
    isComposite: raw._isComposite === true,
  });
}

function buildCatalog(): void {
  if (!fs.existsSync(CATALOG_JSON)) {
    console.log(`Catalogue absent, génération via scripts/export-native-catalog.mjs…`);
    execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts/export-native-catalog.mjs'), `--out=${CATALOG_JSON}`], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  }
  const root = rec(JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8')));
  const rawEntries = root && Array.isArray(root.entries) ? root.entries : [];
  const entries: CatalogEntry[] = [];
  let skipped = 0;
  for (const r of rawEntries) {
    const o = rec(r);
    const e = o ? toEntry(o) : null;
    if (e) entries.push(e);
    else skipped++;
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const countryDict: string[] = [''];
  const operatorDict: string[] = [''];
  const dictIdx = (dict: string[], v: string): number => {
    let i = dict.indexOf(v);
    if (i < 0) {
      i = dict.length;
      dict.push(v);
    }
    return i;
  };
  const index: CatalogIndex = {
    schema: CATALOG_INDEX_SCHEMA,
    count: entries.length,
    shardCount: CATALOG_SHARD_COUNT,
    dict: { country: countryDict, operator: operatorDict },
    id: [],
    name: [],
    seriesName: [],
    category: [],
    traction: [],
    country: [],
    operator: [],
    maxSpeed: [],
    length: [],
    purchasePrice: [],
    passengerCapacity: [],
    hasImage: [],
  };
  const shards: CatalogEntry[][] = Array.from({ length: CATALOG_SHARD_COUNT }, () => []);
  for (const e of entries) {
    index.id.push(e.id);
    index.name.push(e.name);
    index.seriesName.push(e.seriesName);
    index.category.push(CATALOG_CATEGORIES.indexOf(e.category));
    index.traction.push(TRACTIONS.indexOf(e.traction));
    index.country.push(dictIdx(countryDict, e.country));
    index.operator.push(dictIdx(operatorDict, e.operator));
    index.maxSpeed.push(e.maxSpeed);
    index.length.push(e.length);
    index.purchasePrice.push(e.purchasePrice);
    index.passengerCapacity.push(e.passengerCapacity);
    index.hasImage.push(e.image ? 1 : 0);
    shards[catalogShardOf(e.id)]?.push(e);
  }
  writeChunk(CATALOG_INDEX_KEY, index);
  shards.forEach((list, i) => {
    writeChunk(catalogShardKey(i), { schema: CATALOG_SHARD_SCHEMA, shard: i, entries: list });
  });
  const cargo = root?.cargoCategories;
  if (Array.isArray(cargo)) writeChunk('catalog/cargo', { schema: 're-cargo-v2', categories: cargo });
  console.log(`Catalogue : ${entries.length} fiches (${skipped} ignorées), ${CATALOG_SHARD_COUNT} shards`);
}

// ---------------------------------------------------------------- référentiel

/** Exécute un fichier « pack » RC28 (window.__X__ = …) et renvoie ses globals. */
function evalPackFile(file: string): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox;
}

function shardFiles(dir: string, manifestGlobal: string): string[] {
  const manifest = rec(evalPackFile(path.join(dir, 'manifest.js'))[manifestGlobal]);
  const shards = manifest && Array.isArray(manifest.shards) ? manifest.shards : [];
  const files: string[] = [];
  for (const s of shards) {
    const o = rec(s);
    const f = typeof s === 'string' ? s : o && typeof o.file === 'string' ? o.file : o && typeof o.url === 'string' ? o.url : '';
    if (f) files.push(path.join(dir, path.basename(f)));
  }
  if (!files.length) {
    for (const f of fs.readdirSync(dir)) if (/^shard-\d+\.js$/.test(f)) files.push(path.join(dir, f));
    files.sort();
  }
  return files;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

function referencePoints(): RefPoint[] {
  const dir = path.join(REPO_ROOT, 'data/railnet/reference');
  const out: RefPoint[] = [];
  for (const f of shardFiles(dir, '__RAILNET_REFERENCE_PACK__')) {
    const rows = evalPackFile(f).__RAILNET_REFERENCE_SHARD__;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 7) continue;
      const lat = Number(row[2]) / 1e5;
      const lon = Number(row[3]) / 1e5;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const code = Number(row[4]);
      const kind: RefPointKind = code === 2 ? 'ite' : code === 1 ? 'marchandise' : 'voyageur';
      const tags = str(row[15]);
      out.push({
        id: str(row[0]),
        name: str(row[1]),
        lat,
        lon,
        kind,
        country: str(row[5]),
        siteKind: str(row[6]),
        uicRef: str(row[7]),
        operator: str(row[11]),
        official: Number(row[16]) === 1,
        cargoTags: tags ? tags.split(';').filter(Boolean) : [],
        source: str(row[17]) || 'OpenStreetMap / Overpass',
      });
    }
  }
  return out;
}

function strictStations(): RefPoint[] {
  const dir = path.join(REPO_ROOT, 'data/railnet/stations');
  const out: RefPoint[] = [];
  for (const f of shardFiles(dir, '__RAILNET_WORLD_STATION_PACK__')) {
    const rows = evalPackFile(f).__RAILNET_WORLD_STATION_SHARD__;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const lat = Number(row[2]) / 1e5;
      const lon = Number(row[3]) / 1e5;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({
        id: str(row[0]),
        name: str(row[1]),
        lat,
        lon,
        kind: 'voyageur',
        country: str(row[13]),
        siteKind: row[4] ? 'halt' : 'station',
        uicRef: str(row[5]),
        operator: str(row[9]),
        official: false,
        cargoTags: [],
        source: 'STATIONS STRICT FINAL',
      });
    }
  }
  return out;
}

/** Fusion : un point strict est un doublon s'il existe un point voyageur à < 150 m, ou de même nom à < 400 m. */
function mergePoints(reference: RefPoint[], strict: RefPoint[]): { points: RefPoint[]; duplicates: number } {
  const byCell = new Map<string, RefPoint[]>();
  const cell = (p: RefPoint): string => `${Math.floor(p.lat * 100)}_${Math.floor(p.lon * 100)}`;
  const ids = new Set<string>();
  for (const p of reference) {
    ids.add(p.id);
    const k = cell(p);
    const list = byCell.get(k);
    if (list) list.push(p);
    else byCell.set(k, [p]);
  }
  const points = [...reference];
  let duplicates = 0;
  for (const p of strict) {
    if (ids.has(p.id)) {
      duplicates++;
      continue;
    }
    const n = normalizeText(p.name);
    let dup = false;
    const cy = Math.floor(p.lat * 100);
    const cx = Math.floor(p.lon * 100);
    for (let dy = -1; dy <= 1 && !dup; dy++) {
      for (let dx = -1; dx <= 1 && !dup; dx++) {
        for (const q of byCell.get(`${cy + dy}_${cx + dx}`) ?? []) {
          if (q.kind !== 'voyageur') continue;
          const d = haversineM(p.lat, p.lon, q.lat, q.lon);
          if (d < 150 || (d < 400 && normalizeText(q.name) === n)) {
            dup = true;
            break;
          }
        }
      }
    }
    if (dup) {
      duplicates++;
      continue;
    }
    points.push(p);
    ids.add(p.id);
  }
  return { points, duplicates };
}

function buildWorld(): void {
  const reference = referencePoints();
  const strict = strictStations();
  const { points, duplicates } = mergePoints(reference, strict);
  points.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const tiles = new Map<string, RefPoint[]>();
  const totals: Record<RefPointKind, number> = { voyageur: 0, marchandise: 0, ite: 0 };
  const countries = new Set<string>();
  for (const p of points) {
    const k = tileKey(tileOf(p.lat, p.lon));
    const list = tiles.get(k);
    if (list) list.push(p);
    else tiles.set(k, [p]);
    totals[p.kind]++;
    if (p.country) countries.add(p.country);
  }
  const tileCounts: Record<string, number> = {};
  for (const [k, list] of [...tiles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    tileCounts[k] = list.length;
    writeChunk(worldTileKey(k), { schema: WORLD_TILE_SCHEMA, tile: k, rows: list.map(refRowFromPoint) });
  }
  writeChunk(WORLD_INDEX_KEY, {
    schema: WORLD_INDEX_SCHEMA,
    count: points.length,
    totals,
    countries: [...countries].sort(),
    tiles: tileCounts,
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap / Overpass (ODbL) + Cerema ITE 3000 + STATIONS STRICT FINAL',
  });
  const names = { schema: WORLD_NAMES_SCHEMA, id: [] as string[], name: [] as string[], tile: [] as string[], kind: [] as number[], country: [] as string[] };
  for (const p of points) {
    names.id.push(p.id);
    names.name.push(p.name);
    names.tile.push(tileKey(tileOf(p.lat, p.lon)));
    names.kind.push(p.kind === 'ite' ? 2 : p.kind === 'marchandise' ? 1 : 0);
    names.country.push(p.country);
  }
  writeChunk(WORLD_NAMES_KEY, names);
  console.log(
    `Référentiel : ${points.length} points (${reference.length} référence + ${strict.length - duplicates} strict, ${duplicates} doublons), ${tiles.size} tuiles, ${totals.voyageur} voyageurs / ${totals.marchandise} fret / ${totals.ite} ITE`,
  );
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const t0 = performance.now();
buildCatalog();
buildWorld();
console.log(`${written} chunks, ${(bytes / 1e6).toFixed(1)} Mo → ${path.relative(REPO_ROOT, OUT)} en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
