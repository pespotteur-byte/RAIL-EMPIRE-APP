// Rail Empire v1.1.14 — embedded European conventional-rail station source catalog.
// The European dataset ships inside the game and is loaded directly from local shards.
// No station preparer, download or network fallback is required. Reference data is not serialized into player saves.
const DB_NAME = 'rail-empire-world-reference';
const DB_VERSION = 1;
const STORE = 'datasets';
const CACHE_KEY = 'osm-world-rail-stations-v1';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const QLEVER_URLS = [
    'https://qlever.dev/api/osm-planet',
    'https://qlever.cs.uni-freiburg.de/api/osm-planet',
];
// v1.1.13 — embedded European RailNet RAIL-ONLY source pack for native gameplay stations. The manifest is loaded as a classic
// script before the game bundle, which also works when index.html is opened via file://.
const EMBEDDED_PACK_GLOBAL = '__RAILNET_WORLD_STATION_PACK__';
const EMBEDDED_SHARD_GLOBAL = '__RAILNET_WORLD_STATION_SHARD__';
// Deliberately small payload: identity, name, centroid and mode-disambiguation tags only.
// railway=station/halt can include subway/light-rail in OSM, hence the explicit filters in JS.
export const WORLD_STATION_QUERY = `
PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?station ?railway ?centroid
       (SAMPLE(?name0) AS ?name)
       (SAMPLE(?stationKind0) AS ?stationKind)
       (SAMPLE(?train0) AS ?train)
       (SAMPLE(?subway0) AS ?subway)
       (SAMPLE(?tram0) AS ?tram)
       (SAMPLE(?lightRail0) AS ?lightRail)
       (SAMPLE(?monorail0) AS ?monorail)
       (SAMPLE(?uicRef0) AS ?uicRef)
       (SAMPLE(?ref0) AS ?ref)
       (SAMPLE(?operator0) AS ?operator)
       (SAMPLE(?network0) AS ?network)
       (SAMPLE(?wikidata0) AS ?wikidata)
       (SAMPLE(?wheelchair0) AS ?wheelchair)
WHERE {
  {
    VALUES ?railway { "station" "halt" }
    ?station osmkey:railway ?railway .
  } UNION {
    ?station osmkey:public_transport "station" ;
             osmkey:train "yes" .
    BIND("station" AS ?railway)
  }
  ?station geo:hasCentroid/geo:asWKT ?centroid .
  OPTIONAL { ?station osmkey:name ?name0 . }
  OPTIONAL { ?station osmkey:station ?stationKind0 . }
  OPTIONAL { ?station osmkey:train ?train0 . }
  OPTIONAL { ?station osmkey:subway ?subway0 . }
  OPTIONAL { ?station osmkey:tram ?tram0 . }
  OPTIONAL { ?station osmkey:light_rail ?lightRail0 . }
  OPTIONAL { ?station osmkey:monorail ?monorail0 . }
  OPTIONAL { ?station osmkey:uic_ref ?uicRef0 . }
  OPTIONAL { ?station osmkey:ref ?ref0 . }
  OPTIONAL { ?station osmkey:operator ?operator0 . }
  OPTIONAL { ?station osmkey:network ?network0 . }
  OPTIONAL { ?station osmkey:wikidata ?wikidata0 . }
  OPTIONAL { ?station osmkey:wheelchair ?wheelchair0 . }
}
GROUP BY ?station ?railway ?centroid`;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function loadClassicScript(src) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined')
            return reject(new Error('DOM indisponible pour le pack local'));
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => { script.remove(); resolve(true); };
        script.onerror = () => { script.remove(); reject(new Error(`Impossible de charger ${src}`)); };
        document.head.appendChild(script);
    });
}
export async function loadEmbeddedStationPack(onProgress = null) {
    const globalBag = globalThis;
    const pack = globalBag[EMBEDDED_PACK_GLOBAL];
    if (!pack?.prepared || !Array.isArray(pack.shards) || !pack.shards.length)
        return null;
    const all = [];
    const totalShards = pack.shards.length;
    for (let i = 0; i < totalShards; i++) {
        const file = String(pack.shards[i] || '').replace(/^\/+/, '');
        if (!file || file.includes('..'))
            throw new Error('Nom de shard RailNet invalide');
        onProgress?.({ phase: 'embedded-shard', shard: i + 1, totalShards, count: all.length });
        globalBag[EMBEDDED_SHARD_GLOBAL] = null;
        await loadClassicScript(`data/railnet/stations/${file}`);
        const rows = globalBag[EMBEDDED_SHARD_GLOBAL];
        globalBag[EMBEDDED_SHARD_GLOBAL] = null;
        if (!Array.isArray(rows))
            throw new Error(`Shard RailNet invalide: ${file}`);
        const expanded = expandStations(rows, pack.source || 'RailNet local station pack');
        for (const st of expanded)
            all.push(st);
        // Let Chromium paint between local files; world load must never freeze the UI.
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const stations = dedupeWorldStations(all);
    onProgress?.({ phase: 'embedded-ready', count: stations.length, totalShards });
    return { stations, pack };
}
function valueOf(binding) {
    if (binding == null)
        return '';
    if (typeof binding === 'string' || typeof binding === 'number')
        return String(binding);
    if (typeof binding === 'object' && 'value' in binding) {
        const value = binding.value;
        if (typeof value === 'string' || typeof value === 'number')
            return String(value);
    }
    return '';
}
function parseWktPoint(wkt) {
    const s = String(wkt || '');
    // Handles both `POINT(lon lat)` and CRS-prefixed WKT literals.
    const m = s.match(/POINT\s*\(\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)\s*\)/i);
    if (!m)
        return null;
    const lon = Number(m[1]), lat = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
        return null;
    return { lat, lon };
}
function parseOsmIri(iri) {
    const s = String(iri || '');
    const m = s.match(/openstreetmap\.org\/(node|way|relation)\/(\d+)/i);
    if (!m)
        return { id: s || '', osmType: '', osmId: '' };
    return { id: `${m[1].toLowerCase()}-${m[2]}`, osmType: m[1].toLowerCase(), osmId: m[2] };
}
function normText(v) { return String(v || '').trim().toLowerCase(); }
function isUrbanTransitOnly(row) {
    const kind = normText(row.stationKind);
    const train = normText(row.train);
    const subway = normText(row.subway);
    const tram = normText(row.tram);
    const lightRail = normText(row.lightRail);
    const monorail = normText(row.monorail);
    if (train === 'no')
        return true;
    if (kind === 'subway' || kind === 'light_rail' || kind === 'monorail' || kind === 'tram')
        return true;
    // Keep genuine multimodal mainline stations when train=yes.
    if (train !== 'yes' && (subway === 'yes' || tram === 'yes' || lightRail === 'yes' || monorail === 'yes'))
        return true;
    return false;
}
function normalizeName(s) {
    return String(s || '').normalize?.('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || '';
}
function approxDistanceMeters(a, b) {
    const lat = (a.lat + b.lat) * 0.5 * Math.PI / 180;
    const dy = (a.lat - b.lat) * 111320;
    const dx = (a.lon - b.lon) * 111320 * Math.max(0.15, Math.cos(lat));
    return Math.hypot(dx, dy);
}
export function dedupeWorldStations(stations) {
    const byId = new Map();
    const byUic = new Map();
    const grid = new Map();
    const out = [];
    const cell = 0.01; // ~1 km, candidate lookup only.
    const gridKey = (lat, lon) => `${Math.floor(lat / cell)}:${Math.floor(lon / cell)}`;
    for (const raw of Array.isArray(stations) ? stations : []) {
        if (!raw || typeof raw !== 'object')
            continue;
        const st = raw;
        if (!st.id || typeof st.id !== 'string' || !Number.isFinite(st.lat) || !Number.isFinite(st.lon))
            continue;
        const typed = st;
        if (byId.has(typed.id))
            continue;
        const uic = String(typed.uicRef || '').trim();
        if (uic) {
            const existing = byUic.get(uic);
            if (existing) {
                byId.set(typed.id, existing);
                continue;
            }
        }
        const nn = normalizeName(typed.name);
        let duplicate = null;
        if (nn) {
            const ci = Math.floor(typed.lat / cell), cj = Math.floor(typed.lon / cell);
            for (let di = -1; di <= 1 && !duplicate; di++)
                for (let dj = -1; dj <= 1 && !duplicate; dj++) {
                    for (const idx of grid.get(`${ci + di}:${cj + dj}`) || []) {
                        const other = out[idx];
                        if (other._normName === nn && approxDistanceMeters(typed, other) <= 250)
                            duplicate = other;
                    }
                }
        }
        if (duplicate) {
            byId.set(typed.id, duplicate);
            if (uic && !duplicate.uicRef)
                duplicate.uicRef = uic;
            continue;
        }
        const stored = { ...typed, _normName: nn };
        const idx = out.length;
        out.push(stored);
        byId.set(typed.id, stored);
        if (uic)
            byUic.set(uic, stored);
        const k = gridKey(typed.lat, typed.lon);
        if (!grid.has(k))
            grid.set(k, []);
        grid.get(k).push(idx);
    }
    for (const st of out)
        delete st._normName;
    return out;
}
export function parseWorldStationResponse(data) {
    let rows = [];
    const root = data && typeof data === 'object' ? data : {};
    const results = root.results && typeof root.results === 'object' ? root.results : {};
    if (Array.isArray(results.bindings)) {
        rows = results.bindings.map((b) => ({
            station: valueOf(b.station), railway: valueOf(b.railway), name: valueOf(b.name), centroid: valueOf(b.centroid),
            stationKind: valueOf(b.stationKind), train: valueOf(b.train), subway: valueOf(b.subway), tram: valueOf(b.tram),
            lightRail: valueOf(b.lightRail), monorail: valueOf(b.monorail), uicRef: valueOf(b.uicRef),
            ref: valueOf(b.ref), operator: valueOf(b.operator), network: valueOf(b.network), wikidata: valueOf(b.wikidata), wheelchair: valueOf(b.wheelchair),
        }));
    }
    else if (Array.isArray(root.selected) && Array.isArray(root.res)) {
        const names = root.selected.map((x) => String(x).replace(/^\?/, ''));
        rows = root.res.map((r) => {
            const o = {};
            for (let i = 0; i < names.length; i++)
                o[names[i]] = valueOf(r[i]);
            return o;
        });
    }
    else if (Array.isArray(root.result) && Array.isArray(root.vars)) {
        const vars = root.vars;
        rows = root.result.map((r) => {
            const o = {};
            for (let i = 0; i < vars.length; i++)
                o[String(vars[i]).replace(/^\?/, '')] = valueOf(r[i]);
            return o;
        });
    }
    else {
        throw new Error('Format de réponse QLever inattendu.');
    }
    const stations = [];
    for (const row of rows) {
        if (isUrbanTransitOnly(row))
            continue;
        const p = parseWktPoint(row.centroid);
        if (!p)
            continue;
        const osm = parseOsmIri(row.station);
        if (!osm.id)
            continue;
        stations.push({
            id: `osm-${osm.id}`,
            osmType: osm.osmType,
            osmId: osm.osmId,
            name: String(row.name || '').trim() || `Gare OSM ${osm.osmId || osm.id}`,
            lat: p.lat,
            lon: p.lon,
            type: row.railway === 'halt' ? 'halt' : 'station',
            stationKind: String(row.stationKind || ''),
            uicRef: String(row.uicRef || ''), ref: String(row.ref || ''),
            operator: String(row.operator || ''), network: String(row.network || ''),
            wikidata: String(row.wikidata || ''), wheelchair: String(row.wheelchair || ''),
            reference: true,
            source: 'OpenStreetMap / QLever OSM Planet',
        });
    }
    return dedupeWorldStations(stations);
}
class WorldStationDB {
    constructor() { this._openPromise = null; }
    open() {
        if (this._openPromise)
            return this._openPromise;
        if (typeof indexedDB === 'undefined')
            return (this._openPromise = Promise.resolve(null));
        this._openPromise = new Promise((resolve) => {
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(STORE))
                        db.createObjectStore(STORE, { keyPath: 'key' });
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            }
            catch {
                resolve(null);
            }
        });
        return this._openPromise;
    }
    async get(key) {
        const db = await this.open();
        if (!db)
            return null;
        return new Promise((resolve) => {
            try {
                const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            }
            catch {
                resolve(null);
            }
        });
    }
    async set(rec) {
        const db = await this.open();
        if (!db)
            return false;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(rec);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            }
            catch {
                resolve(false);
            }
        });
    }
}
const _db = new WorldStationDB();
function compactStations(stations) {
    return stations.map((s) => [
        s.id, s.name, Math.round(s.lat * 1e5), Math.round(s.lon * 1e5), s.type === 'halt' ? 1 : 0,
        s.uicRef || '', s.osmType || '', s.osmId || '', s.ref || '', s.operator || '', s.network || '',
        s.wikidata || '', s.wheelchair || ''
    ]);
}
function expandStations(rows, source = 'OpenStreetMap / QLever OSM Planet') {
    return (Array.isArray(rows) ? rows : []).filter(Array.isArray).map((r) => ({
        id: String(r[0] ?? ''), name: r[1], lat: Number(r[2]) / 1e5, lon: Number(r[3]) / 1e5,
        type: r[4] ? 'halt' : 'station', uicRef: r[5] || '', osmType: r[6] || '', osmId: r[7] || '',
        ref: r[8] || '', operator: r[9] || '', network: r[10] || '', wikidata: r[11] || '', wheelchair: r[12] || '',
        country: r[13] || '', reference: true, source,
    })).filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}
async function fetchQLeverJson(query, onProgress) {
    let lastError = null;
    for (const url of QLEVER_URLS) {
        for (let attempt = 0; attempt < 2; attempt++) {
            // GET first: for a game launched from file:// this is a CORS-simple request and
            // avoids the preflight that application/sparql-query POST may trigger.
            for (const mode of ['get', 'post']) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 120000);
                try {
                    onProgress?.({ phase: 'network', endpoint: url, attempt: attempt + 1, mode });
                    let resp;
                    if (mode === 'get') {
                        const sep = url.includes('?') ? '&' : '?';
                        const requestUrl = `${url}${sep}query=${encodeURIComponent(query)}`;
                        resp = await fetch(requestUrl, {
                            method: 'GET',
                            headers: { 'Accept': 'application/sparql-results+json, application/json;q=0.9' },
                            signal: controller.signal,
                            cache: 'no-store',
                        });
                    }
                    else {
                        resp = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/sparql-query; charset=utf-8',
                                'Accept': 'application/sparql-results+json, application/json;q=0.9',
                            },
                            body: query,
                            signal: controller.signal,
                        });
                    }
                    clearTimeout(timer);
                    if (!resp.ok)
                        throw new Error(`QLever HTTP ${resp.status}`);
                    return await resp.json();
                }
                catch (e) {
                    clearTimeout(timer);
                    lastError = e;
                }
            }
            if (attempt === 0)
                await sleep(900);
        }
    }
    throw lastError || new Error('QLever indisponible');
}
export class GlobalStationCatalog {
    constructor() {
        this.stations = [];
        this.loaded = false;
        this.source = '';
        this.cacheTimestamp = 0;
        this.refreshPromise = null;
    }
    async load(onProgress = null, onRefreshed = null) {
        const embedded = await loadEmbeddedStationPack(onProgress);
        if (!embedded?.stations?.length) {
            const err = new Error('Pack européen RailNet intégré absent ou vide. Réextraire Rail Empire v1.1.14 dans un dossier neuf.');
            err.code = 'RAILNET_EU_PACK_MISSING';
            throw err;
        }
        this.stations = embedded.stations;
        this.loaded = true;
        this.source = String(embedded.pack.datasetKind || embedded.pack.source || 'europe-rail-only-direct');
        this.cacheTimestamp = Date.parse(embedded.pack.generatedAt || '') || 0;
        onProgress?.({ phase: 'ready-local-europe', count: this.stations.length, timestamp: this.cacheTimestamp });
        return this.stations;
    }
    async refresh(onProgress = null) {
        // v1.1.14 intentionally has no network refresh for station data.
        // Reload the embedded Europe pack deterministically.
        this.loaded = false;
        this.stations = [];
        return this.load(onProgress, null);
    }
}
