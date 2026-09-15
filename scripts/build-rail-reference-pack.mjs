#!/usr/bin/env node
// Builds the embedded rail reference pack (passenger stations, freight yards, ITE) for every
// served country from OpenStreetMap (Overpass) + Cerema ITE 3000 (France), deduplicated against
// the strict RailNet station pack, and writes classic-script shards to data/railnet/reference/.
//
//   node scripts/build-rail-reference-pack.mjs            # fetch missing countries + build
//   node scripts/build-rail-reference-pack.mjs --refetch  # ignore the raw cache
//   node scripts/build-rail-reference-pack.mjs --build    # rebuild shards from the raw cache only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVED_RAIL_COUNTRIES, __railReferenceTest as ref } from '../js/rail-reference-sync.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'scripts', '.rail-reference-raw');
const OUT_DIR = path.join(ROOT, 'data', 'railnet', 'reference');
const STATION_PACK_DIR = path.join(ROOT, 'data', 'railnet', 'stations');
const ITE3000_URL = 'https://www.data.gouv.fr/api/1/datasets/r/a31e504f-ad5c-4b78-916e-f9ed30d789b7';
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'RailEmpire-ReferencePackBuilder/1.0 (+https://github.com/pespotteur-byte/RAIL-EMPIRE-APP)';
const SHARD_ROWS = 4000;
const argv = process.argv.slice(2);
const args = new Set(argv);
const refetch = args.has('--refetch');
const buildOnly = args.has('--build');
const fetchOnly = args.has('--fetch-only');
const optValue = (name) => { const a = argv.find((x) => x.startsWith(`${name}=`)); return a ? a.slice(name.length + 1) : ''; };
const onlyCountries = optValue('--countries').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
// `--endpoint=N` rotates the mirror list so several fetchers can run side by side without
// hammering the same server.
const endpointOffset = Math.max(0, Number(optValue('--endpoint') || 0)) % OVERPASS_URLS.length;
const ROTATED = [...OVERPASS_URLS.slice(endpointOffset), ...OVERPASS_URLS.slice(0, endpointOffset)];
// `--single` sticks to one mirror (useful when the others are down: avoids minutes of fallbacks).
const ENDPOINTS = args.has('--single') ? ROTATED.slice(0, 1) : ROTATED;

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, label, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    for (const url of ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 420000);
      try {
        const resp = await fetch(url, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: 'data=' + encodeURIComponent(query),
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data?.remark && /timed out|runtime error/i.test(String(data.remark))) throw new Error(String(data.remark));
        if (!Array.isArray(data?.elements)) throw new Error('elements manquants');
        return data.elements;
      } catch (e) {
        clearTimeout(timer);
        lastError = e;
        console.warn(`  [${label}] ${url.split('/')[2]} -> ${e instanceof Error ? e.message : e}`);
        await sleep(4000);
      }
    }
    await sleep(15000 * (attempt + 1));
  }
  throw lastError || new Error('Overpass indisponible');
}

function bigQuery(base) {
  return base.replace('[timeout:90]', '[timeout:400]').replace('[timeout:120]', '[timeout:400]').replace('[out:json]', '[out:json][maxsize:536870912]');
}

// Named freight sites only (yards, terminals, freight-only stations): cheap for any country.
function freightSiteQuery(iso) {
  return `[out:json][timeout:300][maxsize:536870912];area["ISO3166-1"="${iso}"][admin_level=2]->.re_country;(nwr["railway"~"^(yard|container_terminal|freight_terminal)$"](area.re_country);nwr["railway"="station"]["freight"](area.re_country);nwr["railway"="station"]["goods"](area.re_country);nwr["railway"="station"]["railway:freight"](area.re_country);nwr["railway"="station"]["passenger"="no"](area.re_country););out tags center;`;
}
// Sidings / yard tracks / industrial lines: the heavy part, fetched per bounding-box tile so a
// large country (DE, FR, RU…) never needs a single multi-minute request.
function trackTileQuery(iso, s, w, n, e) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:240][maxsize:536870912][bbox:${bbox}];area["ISO3166-1"="${iso}"][admin_level=2]->.re_country;(way["railway"~"^(rail|narrow_gauge)$"]["service"~"^(spur|yard)$"](area.re_country);way["railway"~"^(rail|narrow_gauge)$"]["usage"="industrial"](area.re_country););out tags center;`;
}
async function countryBounds(iso) {
  const els = await overpass(`[out:json][timeout:60];rel["ISO3166-1"="${iso}"][admin_level=2][boundary=administrative];out bb;`, `${iso} bbox`);
  const bb = els.find((el) => el.bounds)?.bounds;
  if (!bb) throw new Error(`${iso}: pas de relation frontière`);
  // Overseas territories inflate the bounding box (FR, ES, PT, NL, GB…): keep the served
  // European/NZ mainland window only.
  const CLIPS = {
    NZ: { s: -48, w: 165, n: -33, e: 179.5 }, RU: { s: 41, w: 19, n: 70, e: 61 }, NO: { s: 57, w: 4, n: 72, e: 32 },
    FR: { s: 41, w: -5.5, n: 51.5, e: 10 }, ES: { s: 35.9, w: -9.5, n: 44, e: 4.5 }, NL: { s: 50.7, w: 3.3, n: 53.7, e: 7.3 },
    PT: { s: 36.9, w: -9.6, n: 42.2, e: -6.1 }, GB: { s: 49.8, w: -8.7, n: 61, e: 2 }, DK: { s: 54.5, w: 8, n: 58, e: 15.3 },
  };
  const clip = CLIPS[iso] || { s: 34, w: -12, n: 72, e: 45 };
  // A relation crossing the antimeridian (RU) reports maxlon < minlon: fall back to the clip edge.
  const maxlon = bb.maxlon < bb.minlon ? clip.e : bb.maxlon;
  return { s: Math.max(bb.minlat, clip.s), w: Math.max(bb.minlon, clip.w), n: Math.min(bb.maxlat, clip.n), e: Math.min(maxlon, clip.e) };
}
async function fetchTracksTiled(iso, s, w, n, e, depth = 0) {
  const tileDir = path.join(RAW_DIR, 'tiles');
  fs.mkdirSync(tileDir, { recursive: true });
  const key = `${iso}_${s.toFixed(2)}_${w.toFixed(2)}_${n.toFixed(2)}_${e.toFixed(2)}`;
  const file = path.join(tileDir, `${key}.json`);
  if (n - s < 0.01 || e - w < 0.01) return [];
  if (!refetch && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const span = Math.max(n - s, e - w);
  if (span > 3.01 && depth === 0) return splitTile(iso, s, w, n, e, depth);
  try {
    const els = await overpass(trackTileQuery(iso, s, w, n, e), `${iso} voies ${key}`, span <= 0.8 ? 6 : 1);
    fs.writeFileSync(file, JSON.stringify(els));
    console.log(`  ${iso} voies ${key}: ${els.length} éléments`);
    await sleep(1500);
    return els;
  } catch (e2) {
    if (span <= 0.8) throw e2;
    console.warn(`  ${iso} voies ${key}: découpage (${e2 instanceof Error ? e2.message : e2})`);
    return splitTile(iso, s, w, n, e, depth);
  }
}
async function splitTile(iso, s, w, n, e, depth) {
  const step = Math.max(n - s, e - w) > 3.01 ? 3 : (Math.max(n - s, e - w)) / 2;
  const out = [];
  for (let lat = s; lat < n; lat += step) for (let lon = w; lon < e; lon += step) {
    out.push(...await fetchTracksTiled(iso, lat, lon, Math.min(n, lat + step), Math.min(e, lon + step), depth + 1));
  }
  return out;
}

async function fetchCountry(iso) {
  const file = path.join(RAW_DIR, `${iso}.json`);
  if (!refetch && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Overpass ${iso} : gares…`);
  const stations = await overpass(bigQuery(ref.stationQuery(iso)), `${iso} gares`);
  await sleep(2500);
  console.log(`Overpass ${iso} : sites fret…`);
  const sites = await overpass(freightSiteQuery(iso), `${iso} fret`);
  await sleep(2500);
  console.log(`Overpass ${iso} : voies de service / ITE (tuiles)…`);
  const bb = await countryBounds(iso);
  const tracks = await fetchTracksTiled(iso, bb.s, bb.w, bb.n, bb.e);
  const seen = new Set();
  const freight = [...sites, ...tracks].filter((el) => { const k = `${el.type}/${el.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const rec = { iso, fetchedAt: new Date().toISOString(), stations, freight };
  fs.writeFileSync(file, JSON.stringify(rec));
  console.log(`  ${iso}: ${stations.length} éléments gares, ${freight.length} éléments fret`);
  await sleep(3000);
  return rec;
}

async function fetchFranceIte3000() {
  const file = path.join(RAW_DIR, 'FR-ite3000.json');
  if (!refetch && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('Cerema ITE 3000…');
  const resp = await fetch(ITE3000_URL, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`ITE3000 HTTP ${resp.status}`);
  const data = await resp.json();
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

function loadStrictStationPack() {
  const manifestSrc = fs.readFileSync(path.join(STATION_PACK_DIR, 'manifest.js'), 'utf8');
  const window = {};
  new Function('window', manifestSrc)(window);
  const pack = window.__RAILNET_WORLD_STATION_PACK__;
  const rows = [];
  for (const shard of pack.shards) {
    const w = {};
    new Function('window', fs.readFileSync(path.join(STATION_PACK_DIR, shard), 'utf8'))(w);
    for (const r of w.__RAILNET_WORLD_STATION_SHARD__) rows.push({
      id: String(r[0]), name: String(r[1] || ''), lat: Number(r[2]) / 1e5, lon: Number(r[3]) / 1e5,
      type: 'voyageur', uicRef: String(r[5] || ''), osmType: String(r[6] || ''), osmId: String(r[7] || ''), ref: String(r[8] || ''), operator: String(r[9] || ''), country: String(r[13] || ''),
    });
  }
  return rows;
}

const normText = (v) => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function distanceKm(a, b) {
  const lat = (a.lat + b.lat) * 0.5 * Math.PI / 180;
  return Math.hypot((a.lon - b.lon) * 111.32 * Math.max(0.15, Math.cos(lat)), (a.lat - b.lat) * 111.32);
}
class Grid {
  constructor(cell = 0.01) { this.cell = cell; this.map = new Map(); this.items = []; }
  key(lat, lon) { return `${Math.floor(lat / this.cell)}:${Math.floor(lon / this.cell)}`; }
  add(p) { const idx = this.items.push(p) - 1; const k = this.key(p.lat, p.lon); if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(idx); }
  near(p) {
    const ci = Math.floor(p.lat / this.cell), cj = Math.floor(p.lon / this.cell); const out = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const idx of this.map.get(`${ci + di}:${cj + dj}`) || []) out.push(this.items[idx]);
    return out;
  }
}

// Same identity rule as World.mergeNativeOSMGameplayStationsAsync: same id, same UIC, or same
// normalised name within 350 m inside the same operational family (passenger vs freight).
function isDuplicate(p, grid, ids) {
  if (ids.has(p.id)) return true;
  const pn = normText(p.name), uic = String(p.uicRef || '').trim();
  const pFamily = p.type === 'voyageur' ? 'voyageur' : 'fret';
  const osmKey = p.osmType && p.osmId ? `${p.osmType}-${p.osmId}` : '';
  for (const q of grid.near(p)) {
    if (distanceKm(p, q) > 0.35) continue;
    const qFamily = q.type === 'voyageur' ? 'voyageur' : 'fret';
    if (osmKey && q.osmType && q.osmId && `${q.osmType}-${q.osmId}` === osmKey) return true;
    if (uic && String(q.uicRef || '').trim() === uic && pFamily === qFamily) return true;
    if (pn && pFamily === qFamily && normText(q.name) === pn) return true;
  }
  return false;
}

function compactRow(p) {
  const typeCode = p.type === 'ite' ? 2 : p.type === 'marchandise' ? 1 : 0;
  return [p.id, p.name, Math.round(p.lat * 1e5), Math.round(p.lon * 1e5), typeCode, p.country || '', p.siteKind || '',
    p.uicRef || '', p.osmType || '', p.osmId || '', p.ref || '', p.operator || '', p.network || '', p.wikidata || '', p.wheelchair || '',
    (p.cargoTags || []).join(';'), p.official ? 1 : 0, p.source || ''];
}

async function main() {
  const strict = loadStrictStationPack();
  console.log(`Pack strict : ${strict.length} gares`);
  const grid = new Grid(); const ids = new Set();
  for (const s of strict) { grid.add(s); ids.add(s.id); }

  const perCountry = {}; const out = []; let stationsAdded = 0, freightAdded = 0, iteAdded = 0;
  const failed = [];
  const countries = onlyCountries.length ? SERVED_RAIL_COUNTRIES.filter((c) => onlyCountries.includes(c)) : SERVED_RAIL_COUNTRIES;
  if (fetchOnly) {
    let todo = countries;
    for (let pass = 0; pass < 3 && todo.length; pass++) {
      failed.length = 0;
      for (const iso of todo) { try { await fetchCountry(iso); } catch (e) { console.warn(`!! ${iso} : ${e instanceof Error ? e.message : e}`); failed.push(iso); } }
      todo = [...failed];
      if (todo.length) { console.log(`Nouvelle passe (${pass + 2}) pour : ${todo.join(', ')}`); await sleep(60000); }
    }
    if (failed.length) { console.warn(`Pays non récupérés : ${failed.join(', ')}`); process.exitCode = 2; }
    return;
  }
  for (const iso of SERVED_RAIL_COUNTRIES) {
    let rec;
    try { rec = buildOnly ? JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${iso}.json`), 'utf8')) : await fetchCountry(iso); }
    catch (e) { console.warn(`!! ${iso} ignoré : ${e instanceof Error ? e.message : e}`); failed.push(iso); continue; }
    const stations = rec.stations.map((e) => ref.stationFromElement(e, iso)).filter(Boolean);
    const anchors = [...stations, ...grid.items.filter((s) => s.type === 'voyageur' && s.country === iso)];
    let freight = ref.mergeSiteRecords(rec.freight.map((e) => ref.freightSiteFromElement(e, iso)).filter(Boolean), anchors);
    if (iso === 'FR') {
      try {
        const official = ref.parseFranceIte3000(await fetchFranceIte3000());
        console.log(`  FR ITE 3000 officielles : ${official.length}`);
        freight = [...official, ...freight.filter((p) => !official.some((o) => distanceKm(p, o) <= 0.2 && (normText(p.name) === normText(o.name) || (p.operator && normText(p.operator) === normText(o.operator)))))];
      } catch (e) { console.warn('  ITE 3000 indisponible :', e instanceof Error ? e.message : e); }
    }
    let cs = 0, cf = 0, ci = 0;
    for (const p of [...stations, ...freight]) {
      if (isDuplicate(p, grid, ids)) continue;
      grid.add(p); ids.add(p.id); out.push(p);
      if (p.type === 'voyageur') cs++; else if (p.type === 'ite') ci++; else cf++;
    }
    perCountry[iso] = { stations: cs, freight: cf, ite: ci };
    stationsAdded += cs; freightAdded += cf; iteAdded += ci;
    console.log(`  ${iso}: +${cs} gares, +${cf} fret, +${ci} ITE`);
  }

  out.sort((a, b) => (a.country || '').localeCompare(b.country || '') || a.name.localeCompare(b.name, 'fr'));
  for (const f of fs.readdirSync(OUT_DIR)) if (/^shard-\d+\.js$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  const shards = [];
  for (let i = 0; i < out.length; i += SHARD_ROWS) {
    const name = `shard-${String(shards.length + 1).padStart(4, '0')}.js`;
    const rows = out.slice(i, i + SHARD_ROWS).map(compactRow);
    fs.writeFileSync(path.join(OUT_DIR, name), `/* Rail Empire rail reference shard (OSM/Overpass + Cerema ITE 3000). */\nwindow.__RAILNET_REFERENCE_SHARD__=${JSON.stringify(rows)};\n`);
    shards.push(name);
  }
  const manifest = {
    version: 1, prepared: true, count: out.length, generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap / Overpass (ODbL) + Cerema ITE 3000 (2026-07-08)',
    schema: 'reference-compact-v1', countries: SERVED_RAIL_COUNTRIES.slice(), failedCountries: failed,
    totals: { stations: stationsAdded, freight: freightAdded, ite: iteAdded }, perCountry, shards,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.js'), `/* Rail Empire rail reference pack manifest. */\nwindow.__RAILNET_REFERENCE_PACK__=${JSON.stringify(manifest)};\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'ATTRIBUTION.txt'), [
    'Rail Empire — pack référentiel ferroviaire embarqué',
    '',
    '© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    'Extraction via Overpass API (conventions OpenRailwayMap) : railway=station/halt, public_transport=station+train=yes,',
    'railway=yard/container_terminal/freight_terminal, gares taguées fret, voies service=spur/yard et usage=industrial.',
    'France : Cerema, base ITE 3000 (Licence Ouverte 2.0), mise à jour 2026-07-08.',
    `Généré le ${manifest.generatedAt} — ${out.length} points (${stationsAdded} gares, ${freightAdded} fret, ${iteAdded} ITE).`,
  ].join('\n') + '\n');
  console.log(`\nPack référentiel : ${out.length} points dans ${shards.length} shards (${stationsAdded} gares, ${freightAdded} fret, ${iteAdded} ITE)`);
  if (failed.length) { console.warn(`Pays non récupérés : ${failed.join(', ')}`); process.exitCode = 2; }
}

main().catch((e) => { console.error(e); process.exit(1); });
