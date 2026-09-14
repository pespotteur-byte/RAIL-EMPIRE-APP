export const SERVED_RAIL_COUNTRIES = Object.freeze([
    'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE',
    'IT', 'LT', 'LU', 'LV', 'ME', 'MK', 'MT', 'NL', 'NO', 'NZ', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'UA',
]);
const OVERPASS_URLS = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const ITE3000_URL = 'https://www.data.gouv.fr/api/1/datasets/r/a31e504f-ad5c-4b78-916e-f9ed30d789b7';
const DB_NAME = 'rail-empire-reference-sites';
const DB_VERSION = 1;
const STORE = 'countries';
const CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
function normText(value) {
    return String(value || '').normalize?.('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || '';
}
function centerOf(el) {
    const lat = Number(el.type === 'node' ? el.lat : el.center?.lat);
    const lon = Number(el.type === 'node' ? el.lon : el.center?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
}
function distanceKm(a, b) {
    const lat = (a.lat + b.lat) * 0.5 * Math.PI / 180;
    const dy = (a.lat - b.lat) * 111.32;
    const dx = (a.lon - b.lon) * 111.32 * Math.max(0.15, Math.cos(lat));
    return Math.hypot(dx, dy);
}
function cleanCargoTags(tags) {
    const raw = [tags['railway:freight'], tags.freight, tags.goods, tags.cargo, tags.product, tags.industrial]
        .filter(Boolean).join(';').split(/[;,/]/).map((x) => String(x || '').trim()).filter(Boolean);
    return [...new Set(raw)].slice(0, 12);
}
function isUrbanTransitOnly(tags) {
    const kind = String(tags.station || '').toLowerCase();
    const train = String(tags.train || '').toLowerCase();
    const urban = kind === 'subway' || kind === 'tram' || kind === 'light_rail' || kind === 'monorail' ||
        String(tags.subway || '').toLowerCase() === 'yes' || String(tags.tram || '').toLowerCase() === 'yes' ||
        String(tags.light_rail || '').toLowerCase() === 'yes' || String(tags.monorail || '').toLowerCase() === 'yes';
    return train !== 'yes' && urban;
}
function stationFromElement(el, iso) {
    const tags = el.tags || {};
    const railway = String(tags.railway || '').toLowerCase();
    const isStation = railway === 'station' || railway === 'halt' || (tags.public_transport === 'station' && String(tags.train || '').toLowerCase() === 'yes');
    const freightFlag = String(tags.freight || tags.goods || tags['railway:freight'] || '').toLowerCase();
    const passengerFlag = String(tags.passenger || '').toLowerCase();
    const freightOnly = passengerFlag === 'no' && !!freightFlag && freightFlag !== 'no';
    if (!isStation || freightOnly || isUrbanTransitOnly(tags))
        return null;
    const c = centerOf(el);
    if (!c)
        return null;
    const id = `osm-${String(el.type || 'node')}-${String(el.id || '')}`;
    const name = String(tags.name || tags['uic_name'] || tags.ref || `Gare ${el.id || ''}`).trim();
    return {
        id, name: name || `Gare ${el.id || ''}`, lat: c.lat, lon: c.lon, country: iso,
        type: 'voyageur', platforms: 2, facilities: ['voyageur'], source: 'OpenStreetMap / Overpass', siteKind: railway === 'halt' ? 'halt' : 'station', cargoTags: [], official: false,
        osmType: String(el.type || ''), osmId: String(el.id || ''), uicRef: String(tags.uic_ref || tags['ref:UIC'] || tags['ref:UCI'] || ''),
        ref: String(tags.ref || ''), operator: String(tags.operator || ''), network: String(tags.network || ''), wikidata: String(tags.wikidata || ''), wheelchair: String(tags.wheelchair || ''),
    };
}
function freightSiteFromElement(el, iso) {
    const tags = el.tags || {};
    const c = centerOf(el);
    if (!c)
        return null;
    const railway = String(tags.railway || '').toLowerCase();
    const service = String(tags.service || '').toLowerCase();
    const usage = String(tags.usage || '').toLowerCase();
    const freightTag = String(tags.freight || tags.goods || tags['railway:freight'] || '').toLowerCase();
    const passengerFlag = String(tags.passenger || '').toLowerCase();
    const isYard = railway === 'yard';
    const isTerminal = railway === 'container_terminal' || railway === 'freight_terminal';
    const isFreightStation = railway === 'station' && ((!!freightTag && freightTag !== 'no') || passengerFlag === 'no');
    const isSpur = (railway === 'rail' || railway === 'narrow_gauge') && (service === 'spur' || usage === 'industrial');
    const isYardTrack = (railway === 'rail' || railway === 'narrow_gauge') && service === 'yard';
    if (!isYard && !isTerminal && !isFreightStation && !isSpur && !isYardTrack)
        return null;
    const type = isSpur ? 'ite' : 'marchandise';
    const kind = isYard ? 'yard' : isTerminal ? railway : isFreightStation ? 'freight_station' : isYardTrack ? 'yard_track' : (usage === 'industrial' ? 'industrial_rail' : 'spur');
    const rawName = String(tags.name || tags.operator || tags.ref || '').trim();
    const fallback = type === 'ite' ? `ITE ferroviaire OSM ${el.id || ''}` : `Gare marchandises OSM ${el.id || ''}`;
    const facilities = type === 'ite' ? ['fret', 'ite'] : ['fret'];
    return {
        id: `osm-${type === 'ite' ? 'ite' : 'freight'}-${String(el.type || 'way')}-${String(el.id || '')}`, name: rawName || fallback, lat: c.lat, lon: c.lon, country: iso,
        type, platforms: 1, facilities, source: 'OpenStreetMap / Overpass', siteKind: kind, cargoTags: cleanCargoTags(tags), official: false,
        osmType: String(el.type || ''), osmId: String(el.id || ''), ref: String(tags.ref || tags['railway:ref'] || ''), operator: String(tags.operator || ''), network: String(tags.network || ''), wikidata: String(tags.wikidata || ''), wheelchair: '',
    };
}
function mergeSiteRecords(points) {
    const fixed = [];
    const industrial = [];
    for (const p of points)
        (p.type === 'ite' ? industrial : fixed).push(p);
    // Group the several spur ways of a single ITE into one usable gameplay point.
    const groups = [];
    const grid = new Map();
    const cell = 0.01;
    const keyOf = (lat, lon) => `${Math.floor(lat / cell)}:${Math.floor(lon / cell)}`;
    for (const p of industrial) {
        const namedKey = normText(p.name.replace(/^ITE ferroviaire OSM\s+\d+$/i, '')) || normText(p.operator) || normText(p.ref);
        let best = -1, bestD = Infinity;
        const ci = Math.floor(p.lat / cell), cj = Math.floor(p.lon / cell);
        for (let di = -1; di <= 1; di++)
            for (let dj = -1; dj <= 1; dj++)
                for (const idx of grid.get(`${ci + di}:${cj + dj}`) || []) {
                    const g = groups[idx];
                    const d = distanceKm(p, g);
                    if (d > 0.8)
                        continue;
                    const gKey = normText(g.name.replace(/^ITE ferroviaire OSM\s+\d+$/i, '')) || normText(g.operator) || normText(g.ref);
                    if (namedKey && gKey && namedKey !== gKey)
                        continue;
                    if (d < bestD) {
                        bestD = d;
                        best = idx;
                    }
                }
        if (best < 0) {
            const copy = { ...p, cargoTags: [...p.cargoTags] };
            groups.push(copy);
            const idx = groups.length - 1;
            const k = keyOf(copy.lat, copy.lon);
            if (!grid.has(k))
                grid.set(k, []);
            grid.get(k).push(idx);
        }
        else {
            const g = groups[best];
            if (/^ITE ferroviaire OSM\s+\d+$/i.test(g.name) && !/^ITE ferroviaire OSM\s+\d+$/i.test(p.name))
                g.name = p.name;
            if (!g.operator && p.operator)
                g.operator = p.operator;
            if (!g.ref && p.ref)
                g.ref = p.ref;
            g.cargoTags = [...new Set([...g.cargoTags, ...p.cargoTags])].slice(0, 12);
            if (p.siteKind === 'industrial_rail')
                g.siteKind = 'industrial_rail';
        }
    }
    // Prefer explicit yard/terminal points over duplicate generic ITE clusters nearby.
    const out = [...fixed];
    for (const p of groups) {
        const near = fixed.find((q) => distanceKm(p, q) <= 0.22 && (!!normText(p.name) && normText(p.name) === normText(q.name) || (!!p.operator && normText(p.operator) === normText(q.operator))));
        if (!near)
            out.push(p);
    }
    return out;
}
function dedupeAgainst(points, existing, radiusKm = 0.18) {
    const out = [];
    for (const p of points) {
        const pn = normText(p.name);
        const same = existing.find((q) => distanceKm(p, q) <= radiusKm && ((pn && pn === normText(q.name)) || (!!p.ref && p.ref === q.ref) || (!!p.operator && normText(p.operator) === normText(q.operator))));
        if (!same)
            out.push(p);
    }
    return out;
}
class RailReferenceDB {
    constructor() {
        this.openPromise = null;
    }
    open() {
        if (this.openPromise)
            return this.openPromise;
        if (typeof indexedDB === 'undefined')
            return (this.openPromise = Promise.resolve(null));
        this.openPromise = new Promise((resolve) => {
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE))
                    db.createObjectStore(STORE, { keyPath: 'key' }); };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            }
            catch {
                resolve(null);
            }
        });
        return this.openPromise;
    }
    async get(iso) {
        const db = await this.open();
        if (!db)
            return null;
        return new Promise((resolve) => { try {
            const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(`country:${iso}`);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => resolve(null);
        }
        catch {
            resolve(null);
        } });
    }
    async set(rec) { const db = await this.open(); if (!db)
        return false; return new Promise((resolve) => { try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
    }
    catch {
        resolve(false);
    } }); }
    async all() { const db = await this.open(); if (!db)
        return []; return new Promise((resolve) => { try {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
        r.onerror = () => resolve([]);
    }
    catch {
        resolve([]);
    } }); }
}
async function fetchOverpass(query, timeoutMs = 90000) {
    let lastError = null;
    for (const url of OVERPASS_URLS) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: controller.signal });
                clearTimeout(timer);
                if (resp.status === 429 || resp.status === 504)
                    throw new Error(`Overpass ${resp.status}`);
                if (!resp.ok)
                    throw new Error(`Overpass ${resp.status}`);
                const data = await resp.json();
                if (data?.remark || data?.error)
                    throw new Error(String(data.remark || data.error));
                return Array.isArray(data?.elements) ? data.elements : [];
            }
            catch (e) {
                clearTimeout(timer);
                lastError = e;
                if (attempt === 0)
                    await new Promise((r) => setTimeout(r, 700));
            }
        }
    }
    throw lastError || new Error('Overpass indisponible');
}
function stationQuery(iso) {
    return `[out:json][timeout:90];area["ISO3166-1"="${iso}"][admin_level=2]->.re_country;(nwr["railway"~"^(station|halt)$"](area.re_country);nwr["public_transport"="station"]["train"="yes"](area.re_country););out tags center;`;
}
function freightQuery(iso) {
    return `[out:json][timeout:120];area["ISO3166-1"="${iso}"][admin_level=2]->.re_country;(nwr["railway"~"^(yard|container_terminal|freight_terminal)$"](area.re_country);nwr["railway"="station"]["freight"](area.re_country);nwr["railway"="station"]["goods"](area.re_country);nwr["railway"="station"]["railway:freight"](area.re_country);nwr["railway"="station"]["passenger"="no"](area.re_country);way["railway"~"^(rail|narrow_gauge)$"]["service"~"^(spur|yard)$"](area.re_country);way["railway"~"^(rail|narrow_gauge)$"]["usage"="industrial"](area.re_country););out tags center;`;
}
function pickString(props, keys) {
    for (const key of keys) {
        const v = props[key];
        if (typeof v === 'string' && v.trim())
            return v.trim();
        if (typeof v === 'number' && Number.isFinite(v))
            return String(v);
    }
    const low = new Map(Object.entries(props).map(([k, v]) => [normText(k), v]));
    for (const key of keys) {
        const v = low.get(normText(key));
        if (typeof v === 'string' && v.trim())
            return v.trim();
        if (typeof v === 'number' && Number.isFinite(v))
            return String(v);
    }
    return '';
}
function parseFranceIte3000(data) {
    const features = (data && typeof data === 'object' && Array.isArray(data.features)) ? data.features : [];
    const out = [];
    for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const coords = f?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
            continue;
        let lon = Number(coords[0]), lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            continue;
        const p = f.properties || {};
        const rawId = String(f.id ?? (pickString(p, ['ID', 'Id', 'id', 'Identifiant', 'ID_ITE', 'Identifiant ITE']) || i + 1));
        const company = pickString(p, ['Entreprise', 'Etablissement', 'Établissement', 'Nom entreprise', 'Nom_entreprise', 'Raison sociale', 'ITE', 'Nom ITE', 'Nom_ITE', 'Nom']);
        const commune = pickString(p, ['Commune', 'COMMUNE', 'Ville']);
        const active = pickString(p, ['Convention_active', 'Convention active']);
        const recent = pickString(p, ['Circulation_récente', 'Circulation recente', 'Circulation récente']);
        const cargo = pickString(p, ['Produit_transporté', 'Produit transporte', 'Produit transporté', 'Marchandise', 'Produit']);
        const access = pickString(p, ['Accessibilité', 'Accessibilite']);
        const name = (company || `ITE 3000 ${rawId}`) + (commune && !normText(company).includes(normText(commune)) ? ` — ${commune}` : '');
        const cargoTags = [cargo, access, active, recent].filter(Boolean);
        out.push({ id: `fr-ite3000-${rawId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`, name, lat, lon, country: 'FR', type: 'ite', platforms: 1, facilities: ['fret', 'ite', 'reference-officielle'], source: 'Cerema / ITE 3000 (2026-07-08)', siteKind: 'ite3000', cargoTags, official: true });
    }
    return out;
}
export class RailReferenceSync {
    constructor() {
        this.db = new RailReferenceDB();
        this.running = null;
        this.franceOfficial = null;
    }
    async loadCachedIntoWorld(world, onProgress = null) {
        const rows = await this.db.all();
        let stations = 0, freightSites = 0;
        for (const rec of rows) {
            if (!rec || !SERVED_RAIL_COUNTRIES.includes(rec.iso))
                continue;
            const merged = [...(rec.stations || []), ...(rec.freightSites || [])];
            if (!merged.length)
                continue;
            await world.mergeNativeOSMGameplayStationsAsync(merged, null, 900);
            stations += (rec.stations || []).length;
            freightSites += (rec.freightSites || []).length;
            onProgress?.({ phase: 'cache-country', iso: rec.iso, stations, freightSites });
        }
        return { stations, freightSites, countries: rows.length };
    }
    async fetchFranceOfficialITE() {
        if (this.franceOfficial)
            return this.franceOfficial;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 45000);
            const resp = await fetch(ITE3000_URL, { signal: controller.signal, cache: 'no-store' });
            clearTimeout(timer);
            if (!resp.ok)
                throw new Error(`ITE3000 HTTP ${resp.status}`);
            const data = await resp.json();
            this.franceOfficial = parseFranceIte3000(data);
            return this.franceOfficial;
        }
        catch (e) {
            console.warn('ITE 3000 indisponible, OSM reste actif:', e);
            this.franceOfficial = [];
            return [];
        }
    }
    async syncAll(world, onProgress = null, force = false) {
        if (this.running)
            return this.running;
        this.running = (async () => {
            let totalStations = 0, totalFreight = 0, errors = 0, countries = 0;
            if (typeof navigator !== 'undefined' && navigator.onLine === false)
                return { countries: 0, stations: 0, freightSites: 0, errors: 0 };
            for (let i = 0; i < SERVED_RAIL_COUNTRIES.length; i++) {
                const iso = SERVED_RAIL_COUNTRIES[i];
                const cached = await this.db.get(iso);
                const fresh = !force && !!cached?.complete && Date.now() - Number(cached.updatedAt || 0) < CACHE_MAX_AGE_MS;
                if (fresh) {
                    totalStations += (cached?.stations || []).length;
                    totalFreight += (cached?.freightSites || []).length;
                    countries++;
                    onProgress?.({ phase: 'country-fresh', iso, index: i + 1, totalCountries: SERVED_RAIL_COUNTRIES.length, stations: totalStations, freightSites: totalFreight });
                    continue;
                }
                onProgress?.({ phase: 'country-start', iso, index: i + 1, totalCountries: SERVED_RAIL_COUNTRIES.length, stations: totalStations, freightSites: totalFreight });
                try {
                    const [stationEls, freightEls] = await Promise.all([fetchOverpass(stationQuery(iso), 70000), fetchOverpass(freightQuery(iso), 100000)]);
                    const stations = stationEls.map((e) => stationFromElement(e, iso)).filter((x) => !!x);
                    let freight = mergeSiteRecords(freightEls.map((e) => freightSiteFromElement(e, iso)).filter((x) => !!x));
                    if (iso === 'FR') {
                        const official = await this.fetchFranceOfficialITE();
                        freight = [...official, ...dedupeAgainst(freight, official, 0.20)];
                    }
                    const rec = { key: `country:${iso}`, iso, updatedAt: Date.now(), complete: true, stations, freightSites: freight };
                    await this.db.set(rec);
                    const result = await world.mergeNativeOSMGameplayStationsAsync([...stations, ...freight], null, 900);
                    totalStations += stations.length;
                    totalFreight += freight.length;
                    countries++;
                    onProgress?.({ phase: 'country-done', iso, index: i + 1, totalCountries: SERVED_RAIL_COUNTRIES.length, stations: totalStations, freightSites: totalFreight, added: result.added, enriched: result.enriched });
                }
                catch (e) {
                    errors++;
                    console.warn(`Référentiel ferroviaire ${iso} incomplet pour cette session:`, e);
                    // Keep a previous stale cache rather than replacing it with an empty failure.
                    if (cached) {
                        await world.mergeNativeOSMGameplayStationsAsync([...(cached.stations || []), ...(cached.freightSites || [])], null, 900);
                        totalStations += (cached.stations || []).length;
                        totalFreight += (cached.freightSites || []).length;
                        countries++;
                    }
                    onProgress?.({ phase: 'country-error', iso, index: i + 1, totalCountries: SERVED_RAIL_COUNTRIES.length, stations: totalStations, freightSites: totalFreight, message: e instanceof Error ? e.message : String(e) });
                }
                await new Promise((r) => setTimeout(r, 350));
            }
            return { countries, stations: totalStations, freightSites: totalFreight, errors };
        })().finally(() => { this.running = null; });
        return this.running;
    }
}
export const __railReferenceTest = { stationFromElement, freightSiteFromElement, mergeSiteRecords, parseFranceIte3000, stationQuery, freightQuery };
