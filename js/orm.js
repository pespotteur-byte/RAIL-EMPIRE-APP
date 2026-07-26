// OpenRailwayMap data integration via Overpass API — ORM Direct architecture
// Uses OSM way graph directly as the game's routing infrastructure.
// No conversion to intermediate tronçons — the OSM graph IS the network.
import { segmentsFromRoute, simulateProfile, simulateProfileCumulative } from './train-physics.js?v=1784931691';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const DB_NAME = 'rail-empire-orm';
const DB_STORE = 'areas';
const DB_VERSION = 2; // keep stable; _effectiveSpeed migrates old cached maxspeed values
const ORM_CACHE_VERSION = 2; // _effectiveSpeed handles missing maxSpeedExplicit flag
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep cached areas for 7 days

// TL-XX numbering for imported line points (vacuum tracer ligne)
let _linePointCounter = 0;

// SC-05 : the base schedule is proposed at 0 % safety margin (pure physics
// travel time). The player can tighten it manually if they want.
function applyTravelTimeSafety(baseMin) {
  return baseMin;
}

class ORMIndexedCache {
  constructor() {
    this._db = null;
    this._openPromise = null;
  }

  open() {
    if (this._openPromise) return this._openPromise;
    if (typeof indexedDB === 'undefined') {
      this._openPromise = Promise.resolve(false);
      return this._openPromise;
    }
    this._openPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVersion = e.oldVersion;
        // Clear stale cached ways so the new maxspeed/usage fallback rules apply.
        if (oldVersion > 0 && db.objectStoreNames.contains(DB_STORE)) {
          db.deleteObjectStore(DB_STORE);
        }
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(true); };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
    return this._openPromise;
  }

  async get(key) {
    if (!this._db) await this.open();
    if (!this._db) return null;
    return new Promise((resolve) => {
      const tx = this._db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const rec = req.result;
        if (!rec) return resolve(null);
        if (Date.now() - rec.timestamp > CACHE_MAX_AGE_MS) {
          this._delete(key);
          return resolve(null);
        }
        resolve(rec);
      };
      req.onerror = () => resolve(null);
    });
  }

  async set(key, value) {
    if (!this._db) await this.open();
    if (!this._db) return;
    return new Promise((resolve) => {
      const tx = this._db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.put({ key, ...value, timestamp: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  _delete(key) {
    if (!this._db) return;
    const tx = this._db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
  }
}

function localStorageGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function localStorageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or disabled */ }
}
function localStorageKey(k) { return 'orm-area-' + k; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Initial bearing (degrees, 0-360) from A to B — used for turn-angle penalty
function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Smallest absolute difference between two bearings (0-180)
function angleBetween(b1, b2) {
  let d = Math.abs(b1 - b2) % 360;
  return d > 180 ? 360 - d : d;
}

// --- Binary Heap for Dijkstra (fixes O(n²) sort bug) ---
class MinHeap {
  constructor() { this._data = []; }
  get size() { return this._data.length; }
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) { this._data[0] = last; this._sinkDown(0); }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[i].d >= this._data[p].d) break;
      [this._data[i], this._data[p]] = [this._data[p], this._data[i]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._data[l].d < this._data[smallest].d) smallest = l;
      if (r < n && this._data[r].d < this._data[smallest].d) smallest = r;
      if (smallest === i) break;
      [this._data[i], this._data[smallest]] = [this._data[smallest], this._data[i]];
      i = smallest;
    }
  }
}

export class ORMClient {
  constructor() {
    this.routeCache = new Map();
    this.areaCache = new Map(); // bbox key -> raw ways array
    this.loading = false;

    // Persistent cache (IndexedDB + localStorage fallback) for offline / slow network
    this._persistentCache = new ORMIndexedCache();
    this._cacheReady = this._persistentCache.open();

    // ORM Direct: unified graph from all loaded areas
    this._graph = null; // { nodes: Map, adjacency: Map, _index }
    this._ways = new Map(); // wayId -> way object (all loaded ways)
    this._loadedBboxes = []; // track which areas have been loaded
    this._stationsOSM = []; // detected OSM stations
    this._graphDirty = true;

    // R-08 / R-XX — routage directionnel : chaque voie OSM a un sens préféré
    // (railway:preferred_direction) ou hérite du premier itinéraire calculé.
    this._wayDir = new Map(); // wayId -> bearing (degrés) du sens autorisé

    // R-08 : aiguillages branchés au routage — tronçons utilisateur injectés dans le graphe
    this._userTronconProvider = null;

    // Spatial index cell size (degrees) for nearest-node queries ~2 km
    this._cellSize = 0.02;
    // Routing tuning (directed graph)
    this._serviceSpeedKmh = 30; // yards/sidings default speed cap
    this._turnPenaltyDeg = 100; // above this angle a movement counts as a reversal
    this._reversalPenaltyH = 6;  // ~6h penalty ≫ any real leg → forbids arbitrary back-up
    this._switchDivergePenaltyH = 0.25; // ~15 min penalty for taking a non-straight path at a switch (Annexe 10d)
    this._maxFallbackKm = 100.0; // last-resort straight fallback, tagged `fallback: true`
    // R-07 : plafond V160 par défaut pour le calcul d'itinéraire (matériel joueur)
    this._routingSpeedCapKmh = 160;
  }

  // SC-06 : default speeds for service tracks without an explicit maxspeed.
  // Crossovers and sidings can run faster than yards/spurs.
  _serviceDefaultSpeed(service) {
    switch (service) {
      case 'crossover': return 60;
      case 'siding': return 60;
      case 'yard': return 30;
      case 'spur': return 30;
      default: return 30;
    }
  }

  // Reduce point density while keeping the rail line shape.
  // Tolerance is the minimum distance (m) between kept points.
  simplifyGeometry(points, toleranceM = 5) {
    if (!points || points.length < 3) return points;
    const out = [points[0]];
    let last = points[0];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const d = haversine(last.lat, last.lon, p.lat, p.lon) * 1000;
      if (d >= toleranceM) {
        out.push(p);
        last = p;
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  // ============================================================
  // AREA FETCHING — loads all railway data for a bounding box
  // Also fetches railway stations/halts
  // ============================================================

  async fetchArea(south, west, north, east) {
    const key = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    if (this.areaCache.has(key)) return this.areaCache.get(key);

    // Try persistent cache first (offline / fast fallback)
    await this._cacheReady;
    const cached = await this._loadCachedArea(key);
    if (cached) {
      for (const w of cached.ways) this._ways.set(w.id, w);
      for (const st of cached.stations) {
        if (!this._stationsOSM.find(s => s.id === st.id)) this._stationsOSM.push(st);
      }
      this._graphDirty = true;
      if (!this._loadedBboxes.find(b => b.key === key)) {
        this._loadedBboxes.push({ south, west, north, east, key, fromCache: true });
      }
      this.areaCache.set(key, cached.ways);
      return cached.ways;
    }

    // Fetch ways + stations in one query
    const query = `[out:json][timeout:90];(way["railway"="rail"](${south},${west},${north},${east});node["railway"~"^(station|halt)$"](${south},${west},${north},${east}););out body geom;`;

    let lastError = null;
    for (const url of OVERPASS_URLS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000); // 30 s per endpoint
          const resp = await fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (resp.status === 429) {
            console.warn(`ORM rate limited on ${url}, retry ${attempt + 1}/2...`);
            continue;
          }
          if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
          const data = await resp.json();
          const ways = this.parseWays(data);
          const stations = this._parseStations(data);

          // Register in unified graph
          for (const w of ways) this._ways.set(w.id, w);
          for (const st of stations) {
            if (!this._stationsOSM.find(s => s.id === st.id)) this._stationsOSM.push(st);
          }
          this._graphDirty = true;
          this._loadedBboxes.push({ south, west, north, east, key });

          this.areaCache.set(key, ways);
          await this._saveCachedArea(key, { bbox: { south, west, north, east }, ways, stations });
          return ways;
        } catch (e) {
          lastError = e;
          console.warn(`ORM fetch ${url} attempt ${attempt + 1} failed:`, e.message || e);
        }
      }
    }

    console.warn('ORM fetch failed on all endpoints:', lastError);
    return [];
  }

  async _loadCachedArea(key) {
    const rec = await this._persistentCache.get(key);
    if (rec && rec.version === ORM_CACHE_VERSION) return { ways: rec.ways, stations: rec.stations };
    const legacy = localStorageGet(localStorageKey(key));
    if (legacy && legacy.version === ORM_CACHE_VERSION) {
      return { ways: legacy.ways || [], stations: legacy.stations || [] };
    }
    return null;
  }

  async _saveCachedArea(key, payload) {
    const versioned = { ...payload, version: ORM_CACHE_VERSION };
    await this._persistentCache.set(key, versioned);
    localStorageSet(localStorageKey(key), versioned);
  }

  parseWays(data) {
    if (!data.elements) return [];
    return data.elements
      .filter(el => el.type === 'way' && el.geometry)
      .map(el => {
        const usage = el.tags?.usage || '';
        const service = el.tags?.service || '';
        // A way is treated as a main/branch line (higher default speed) if it is
        // tagged as main/branch, or if it has no usage/service tags at all and
        // is therefore assumed to be a plain railway=rail line.
        const isMainOrBranch = usage === 'main' || usage === 'branch' || (!usage && !service);
        // Annexe 3A / §IV — voie sans indication de vitesse :
        //   • voie principale/branch ou ligne simple : défaut 160;
        //   • service/triage ou usage explicite non principal : défaut 30.
        const hasSpeed = el.tags?.maxspeed && !Number.isNaN(parseInt(el.tags.maxspeed));
        const serviceDefault = !isMainOrBranch ? this._serviceDefaultSpeed(service) : 30;
        const maxSpeed = hasSpeed ? parseInt(el.tags.maxspeed) : (isMainOrBranch ? 160 : serviceDefault);
        return {
          id: el.id,
          maxSpeed,
          maxSpeedExplicit: !!hasSpeed,
          electrified: el.tags?.electrified !== 'no',
          tracks: parseInt(el.tags?.tracks) || 1,
          usage: el.tags?.usage || (service ? '' : 'main'),
          service,
          name: el.tags?.name || '',
          ref: el.tags?.ref || '',
          trackRef: el.tags?.['railway:track_ref'] || el.tags?.track_ref || '',
          preferredDirection: (() => {
            const pd = (el.tags?.['railway:preferred_direction'] || '').toLowerCase();
            return pd === 'forward' || pd === 'backward' ? pd : 'both';
          })(),
          geometry: this.simplifyGeometry(el.geometry.map(p => ({ lat: p.lat, lon: p.lon })), 5),
          nodeIds: el.nodes || [],
        };
      });
  }

  _parseStations(data) {
    if (!data.elements) return [];
    return data.elements
      .filter(el => el.type === 'node' && el.tags?.railway && (el.tags.railway === 'station' || el.tags.railway === 'halt'))
      .map(el => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name || `Station ${el.id}`,
        type: el.tags.railway,
      }));
  }

  getOSMStations() { return this._stationsOSM; }

  // ============================================================
  // VIEWPORT LOADING — load infrastructure for visible map area
  // ============================================================

  async loadViewport(south, west, north, east, margin = 0.01) {
    const s = south - margin, w = west - margin;
    const n = north + margin, e = east + margin;

    // Check if already covered
    if (this._isCovered(s, w, n, e)) return;

    this.loading = true;
    try {
      await this.fetchArea(s, w, n, e);
    } finally {
      this.loading = false;
    }
  }

  _isCovered(south, west, north, east) {
    for (const bb of this._loadedBboxes) {
      if (bb.south <= south && bb.west <= west && bb.north >= north && bb.east >= east) return true;
    }
    return false;
  }

  // ============================================================
  // GRAPH BUILDING — builds routing graph from ALL loaded ways
  // No filtering: yards, sidings, spurs all included.
  // ============================================================

  // R-08 : fournisseur de tronçons utilisateur pour les intégrer au graphe de routage
  setUserTronconProvider(providerFn) {
    this._userTronconProvider = providerFn;
    this.markGraphDirty();
  }

  markGraphDirty() {
    this._graphDirty = true;
    this.routeCache.clear();
    this._wayDir.clear();
  }

  _ensureGraph() {
    if (!this._graphDirty && this._graph) return this._graph;
    this._inferPreferredDirections();
    this._graph = this._buildUnifiedGraph();
    this._graphDirty = false;
    return this._graph;
  }

  // R-XX — sens de circulation ferroviaire au point demandé.
  // La liste suit la règle métier demandée : France, Italie, Espagne,
  // Grande-Bretagne roulent à gauche sur rail ; les autres à droite.
  getTrafficSide(lat, lon) {
    const LEFT_HAND_BBOXES = [
      { code: 'FR', minLat: 41.0, maxLat: 51.5, minLon: -5.5, maxLon: 9.5 },
      { code: 'IT', minLat: 36.5, maxLat: 47.5, minLon: 6.5, maxLon: 19.0 },
      { code: 'ES', minLat: 35.0, maxLat: 44.0, minLon: -10.0, maxLon: 4.5 },
      { code: 'GB', minLat: 49.5, maxLat: 61.0, minLon: -11.0, maxLon: 2.0 },
    ];
    for (const b of LEFT_HAND_BBOXES) {
      if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) return 'left';
    }
    return 'right';
  }

  _wayBearing(way) {
    let x = 0, y = 0;
    const g = way.geometry;
    for (let i = 0; i < g.length - 1; i++) {
      const b = bearing(g[i].lat, g[i].lon, g[i + 1].lat, g[i + 1].lon);
      const rad = b * Math.PI / 180;
      x += Math.cos(rad); y += Math.sin(rad);
    }
    const len = Math.hypot(x, y);
    if (len === 0) return 0;
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  _wayMidpoint(way) {
    const g = way.geometry;
    let lat = 0, lon = 0;
    for (const p of g) { lat += p.lat; lon += p.lon; }
    return { lat: lat / g.length, lon: lon / g.length };
  }

  _wayLength(way) {
    let len = 0;
    const g = way.geometry;
    for (let i = 0; i < g.length - 1; i++) {
      len += haversine(g[i].lat, g[i].lon, g[i + 1].lat, g[i + 1].lon);
    }
    return len;
  }

  _assignPairDirections(a, b) {
    const bA = a.b, bB = b.b;
    const midA = a.mid, midB = b.mid;
    const bearingAB = bearing(midA.lat, midA.lon, midB.lat, midB.lon);
    const delta = ((bearingAB - bA) + 360) % 360;
    const isRight = (delta >= 45 && delta <= 135);
    const isLeft = (delta >= 225 && delta <= 315);
    if (!isRight && !isLeft) return;
    const rightHand = this.getTrafficSide(midA.lat, midA.lon) === 'right';
    let dirA, dirB;
    if (rightHand) {
      if (isRight) { dirA = bA + 180; dirB = bA; }
      else { dirA = bA; dirB = bA + 180; }
    } else {
      if (isRight) { dirA = bA; dirB = bA + 180; }
      else { dirA = bA + 180; dirB = bA; }
    }
    dirA = (dirA + 360) % 360;
    dirB = (dirB + 360) % 360;
    a.way.preferredDirection = angleBetween(bA, dirA) <= 90 ? 'forward' : 'backward';
    b.way.preferredDirection = angleBetween(bB, dirB) <= 90 ? 'forward' : 'backward';
  }

  _inferPreferredDirections() {
    if (!this._ways || this._ways.size === 0) return;
    // Normalise les voies issues du cache qui ne contiennent pas encore les nouveaux champs.
    for (const w of this._ways.values()) {
      if (!w.preferredDirection) w.preferredDirection = 'both';
      if (w.tracks == null) w.tracks = 1;
      if (!w.usage && !w.service) w.usage = 'main';
      if (w.service == null) w.service = '';
    }
    const candidates = [...this._ways.values()].filter(w =>
      w.preferredDirection === 'both' &&
      w.tracks === 1 &&
      w.usage === 'main' &&
      !w.service &&
      (w.ref || w.name)
    );
    const byRef = new Map();
    for (const w of candidates) {
      const key = w.ref || w.name;
      if (!byRef.has(key)) byRef.set(key, []);
      byRef.get(key).push(w);
    }
    for (const [ref, list] of byRef) {
      if (list.length < 2) continue;
      const meta = list.map(way => ({
        way,
        b: this._wayBearing(way),
        mid: this._wayMidpoint(way),
        len: this._wayLength(way),
      }));
      for (const a of meta) {
        if (a.way.preferredDirection !== 'both') continue;
        let best = null, bestDist = Infinity;
        for (const b of meta) {
          if (a === b || b.way.preferredDirection !== 'both') continue;
          const d = haversine(a.mid.lat, a.mid.lon, b.mid.lat, b.mid.lon);
          if (d < 0.003 || d > 0.08) continue;
          const lenRatio = a.len / b.len;
          if (lenRatio > 2 || lenRatio < 0.5) continue;
          const bDiff = angleBetween(a.b, b.b);
          if (bDiff > 15 && bDiff < 165) continue;
          if (d < bestDist) { bestDist = d; best = b; }
        }
        if (best) this._assignPairDirections(a, best);
      }
    }
  }

  _addDirectedWayEdges(nodes, aKey, bKey, way, segmentIdx, dist, seedDir = true) {
    const pd = way.preferredDirection || 'both';
    const base = {
      dist, maxSpeed: way.maxSpeed, maxSpeedExplicit: way.maxSpeedExplicit, electrified: way.electrified, tracks: way.tracks,
      usage: way.usage, service: way.service, wayId: way.id, name: way.name || '',
      ref: way.ref || '', trackRef: way.trackRef || '', preferredDirection: pd,
    };
    if (pd === 'forward' || pd === 'both') {
      nodes.get(aKey).edges.push({ from: aKey, to: bKey, ...base });
    }
    if (pd === 'backward' || pd === 'both') {
      nodes.get(bKey).edges.push({ from: bKey, to: aKey, ...base });
    }
    if (seedDir && !this._wayDir.has(way.id)) {
      const g = way.geometry;
      if (pd === 'forward' && g.length >= 2) {
        this._wayDir.set(way.id, bearing(g[0].lat, g[0].lon, g[1].lat, g[1].lon));
      } else if (pd === 'backward' && g.length >= 2) {
        this._wayDir.set(way.id, bearing(g[g.length - 1].lat, g[g.length - 1].lon, g[g.length - 2].lat, g[g.length - 2].lon));
      }
    }
  }

  _buildUnifiedGraph() {
    this._wayDir.clear();
    const nodes = new Map(); // nodeKey -> { key, lat, lon, edges: [] }

    for (const [, way] of this._ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;

      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (aKey === bKey) continue;

        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });

        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        this._addDirectedWayEdges(nodes, aKey, bKey, way, i, dist, true);
      }
    }

    // R-08 : injecter les tronçons / aiguillages créés par le joueur dans le graphe de routage
    try {
      const userTroncons = typeof this._userTronconProvider === 'function'
        ? this._userTronconProvider()
        : null;
      if (Array.isArray(userTroncons)) {
        for (const trc of userTroncons) {
          const route = trc?.route;
          if (!route || route.length < 2) continue;
          for (let i = 0; i < route.length - 1; i++) {
            const a = route[i], b = route[i + 1];
            if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
            const aKey = `${a.lat.toFixed(6)},${a.lon.toFixed(6)}`;
            const bKey = `${b.lat.toFixed(6)},${b.lon.toFixed(6)}`;
            if (aKey === bKey) continue;
            if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: a.lat, lon: a.lon, edges: [] });
            if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: b.lat, lon: b.lon, edges: [] });
            const dist = haversine(a.lat, a.lon, b.lat, b.lon);
            const maxSpeed = a.maxSpeed || b.maxSpeed || 30;
            const edge = { from: aKey, to: bKey, dist, maxSpeed, electrified: null, tracks: 1, usage: 'main', service: '', wayId: trc.id || 'user-trc' };
            const reverseEdge = { from: bKey, to: aKey, dist, maxSpeed, electrified: null, tracks: 1, usage: 'main', service: '', wayId: trc.id || 'user-trc' };
            nodes.get(aKey).edges.push(edge);
            nodes.get(bKey).edges.push(reverseEdge);
          }
        }
      }
    } catch (e) { /* graceful */ }

    const graph = { nodes };
    graph._index = this._buildSpatialIndex(nodes);
    return graph;
  }

  // Legacy buildGraph (used by importInfrastructure)
  buildGraph(ways) {
    const nodes = new Map();
    for (const way of ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });
        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        this._addDirectedWayEdges(nodes, aKey, bKey, way, i, dist, false);
      }
    }
    const graph = { nodes };
    graph._index = this._buildSpatialIndex(nodes);
    return graph;
  }

  // ============================================================
  // SPATIAL INDEX — grid buckets for O(1) nearest-node lookup
  // Replaces the O(n) linear scan (enables routing at 1200+ km)
  // ============================================================

  _buildSpatialIndex(nodes) {
    const cs = this._cellSize;
    const cells = new Map(); // "cLat:cLon" -> [node,...]
    for (const [, node] of nodes) {
      const ck = Math.floor(node.lat / cs) + ':' + Math.floor(node.lon / cs);
      let bucket = cells.get(ck);
      if (!bucket) { bucket = []; cells.set(ck, bucket); }
      bucket.push(node);
    }
    return { cells, cs };
  }

  _nearestViaIndex(graph, lat, lon, maxDistKm) {
    const { cells, cs } = graph._index;
    const cLat = Math.floor(lat / cs), cLon = Math.floor(lon / cs);
    let best = null, bestDist = Infinity, foundRing = -1;
    // Cap the search radius (in rings) to avoid scanning the whole grid
    // One cell is about cs * 111 km (1 degree latitude ~ 111 km).
    const ringCap = maxDistKm === Infinity ? 400 : Math.ceil(maxDistKm / (cs * 111)) + 3;
    for (let ring = 0; ring <= ringCap; ring++) {
      for (let dLat = -ring; dLat <= ring; dLat++) {
        for (let dLon = -ring; dLon <= ring; dLon++) {
          // only the border cells of the current ring
          if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== ring) continue;
          const bucket = cells.get((cLat + dLat) + ':' + (cLon + dLon));
          if (!bucket) continue;
          for (const node of bucket) {
            const d = haversine(lat, lon, node.lat, node.lon);
            if (d < bestDist && d <= maxDistKm) { bestDist = d; best = node; if (foundRing < 0) foundRing = ring; }
          }
        }
      }
      // Once found, scan two extra rings (closer node may sit in a neighbour cell) then stop
      if (best && ring >= foundRing + 2) break;
    }
    return best ? { node: best, dist: bestDist } : null;
  }

  // ============================================================
  // DIRECTED ROUTING — edge-state A* on the oriented graph
  //  • edges carry a running direction (from -> to)
  //  • cost = travel time (dist / effective speed), not raw distance
  //  • turn-angle penalty forbids arbitrary reversals / wrong-way moves
  //    (a train may only turn back where a planned reversal makes it
  //     the sole option; sharp turns cost _reversalPenaltyH hours)
  //  • A* with an admissible time heuristic → fast even at 1200+ km
  // ============================================================

  // Effective running speed on an edge (km/h). Service tracks (yards,
  // sidings, spurs) are capped low so routing avoids them unless required.
  // R-07 : plafond à V160 par défaut pour le routage du matériel joueur ;
  // le maxSpeed du matériel sélectionné peut être passé via opts.maxSpeed.
  _effectiveSpeed(edge, routingMaxSpeed = null) {
    // Annexe 3A / §IV — défaut conditionnel : 160 pour voie principale/branch,
    // défaut par type de service (crossover/siding 60, yard/spur 30) si pas
    // de maxspeed OSM. Si un maxspeed OSM est présent, on l'honore.
    // A way is a main/branch running line only if it has no service tag and
    // its usage is main/branch (or plain railway=rail with both empty).
    const hasService = edge.service && edge.service !== '';
    const isMainOrBranch = (edge.usage === 'main' || edge.usage === 'branch' || (!edge.usage && !hasService)) && !hasService;
    let v;
    if (edge.maxSpeedExplicit) {
      v = edge.maxSpeed;
    } else if (edge.maxSpeedExplicit === false) {
      v = isMainOrBranch ? 160 : this._serviceDefaultSpeed(edge.service);
    } else {
      // Old cached ways without the explicit flag: keep non-default values,
      // but recompute the old hard-coded defaults (160 / 30) by type.
      const defaultValue = isMainOrBranch ? 160 : this._serviceDefaultSpeed(edge.service);
      const isOldDefault = edge.maxSpeed === 160 || edge.maxSpeed === 30 || edge.maxSpeed === defaultValue;
      v = isOldDefault ? defaultValue : edge.maxSpeed;
    }
    const cap = routingMaxSpeed ?? this._routingSpeedCapKmh ?? Infinity;
    if (cap > 0) v = Math.min(v, cap);
    return Math.max(5, v);
  }

  // Travel time across an edge, in hours
  _edgeCost(edge, routingMaxSpeed = null) {
    return edge.dist / this._effectiveSpeed(edge, routingMaxSpeed);
  }

  _edgeBearing(graph, edge) {
    const a = graph.nodes.get(edge.from);
    const b = graph.nodes.get(edge.to);
    if (!a || !b) return 0;
    return bearing(a.lat, a.lon, b.lat, b.lon);
  }

  // Penalty (hours) for chaining edge `into` after edge `from`.
  // A near-U-turn (angle > _turnPenaltyDeg) is treated as a reversal.
  _turnPenalty(graph, fromEdge, intoEdge, directed) {
    if (!directed || !fromEdge) return 0;
    // Same physical track, opposite direction = pure back-up: always forbid
    if (intoEdge.to === fromEdge.from && intoEdge.wayId === fromEdge.wayId) {
      return Infinity;
    }
    const b1 = this._edgeBearing(graph, fromEdge);
    const b2 = this._edgeBearing(graph, intoEdge);
    const turn = angleBetween(b1, b2);
    if (turn > this._turnPenaltyDeg) return this._reversalPenaltyH;

    // Annexe 10d — at a switch, prefer the straightest continuation (direct line
    // priority). If the chosen edge is not the straightest available one, apply a
    // small diverging penalty so trains take the main track when possible.
    const node = graph.nodes.get(intoEdge.from);
    if (node && node.edges.length > 2) {
      let bestTurn = Infinity;
      for (const e of node.edges) {
        if (e.to === fromEdge.from && e.wayId === fromEdge.wayId) continue; // back-up
        bestTurn = Math.min(bestTurn, angleBetween(b1, this._edgeBearing(graph, e)));
      }
      if (bestTurn < Infinity && turn > bestTurn + 1e-6) {
        return this._switchDivergePenaltyH;
      }
    }
    return 0;
  }

  // Public entry point kept for backward compatibility (callers pass keys).
  // `directed` defaults to true; pass { directed:false } for a raw shortest path.
  // `opts.maxSpeed` plafonne la vitesse utilisée pour le calcul d'itinéraire (R-07).
  dijkstra(graph, startKey, endKey, opts = null) {
    return this._route(graph, startKey, endKey, opts);
  }

  _route(graph, startKey, endKey, opts = null) {
    const directed = !(opts && opts.directed === false);
    const routingMaxSpeed = opts?.maxSpeed ?? null;
    const avoidEdges = opts?.avoidEdges || new Set();
    if (!startKey || !endKey) return null;
    if (!graph.nodes.has(startKey) || !graph.nodes.has(endKey)) return null;
    const endNode = graph.nodes.get(endKey);
    if (startKey === endKey) {
      const n = graph.nodes.get(startKey);
      return [{ lat: n.lat, lon: n.lon, maxSpeed: 160, electrified: true, tracks: 1 }];
    }

    // Admissible heuristic: straight-line time to goal at the max plausible speed
    const MAX_V = 320;
    const h = (key) => {
      const n = graph.nodes.get(key);
      return haversine(n.lat, n.lon, endNode.lat, endNode.lon) / MAX_V;
    };

    const gScore = new Map(); // stateKey ("from>to") -> best cost
    const cameFrom = new Map(); // stateKey -> { prev, edge }
    const settled = new Set();
    const heap = new MinHeap();

    const startNode = graph.nodes.get(startKey);
    for (const edge of startNode.edges) {
      if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
      const g = this._edgeCost(edge, routingMaxSpeed);
      const sk = edge.from + '>' + edge.to;
      if (g < (gScore.get(sk) ?? Infinity)) {
        gScore.set(sk, g);
        cameFrom.set(sk, { prev: null, edge });
        heap.push({ key: sk, d: g + h(edge.to) });
      }
    }

    let endStateKey = null;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (settled.has(cur.key)) continue;
      settled.add(cur.key);

      const toKey = cur.key.slice(cur.key.indexOf('>') + 1);
      if (toKey === endKey) { endStateKey = cur.key; break; }

      const node = graph.nodes.get(toKey);
      if (!node) continue;
      const inEdge = cameFrom.get(cur.key).edge;
      const gCur = gScore.get(cur.key);

      for (const edge of node.edges) {
        if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
        const pen = this._turnPenalty(graph, inEdge, edge, directed);
        if (!isFinite(pen)) continue; // forbidden reversal
        const sk = edge.from + '>' + edge.to;
        if (settled.has(sk)) continue;
        const g = gCur + this._edgeCost(edge, routingMaxSpeed) + pen;
        if (g < (gScore.get(sk) ?? Infinity)) {
          gScore.set(sk, g);
          cameFrom.set(sk, { prev: cur.key, edge });
          heap.push({ key: sk, d: g + h(edge.to) });
        }
      }
    }

    if (!endStateKey) return null;

    // Reconstruct the edge chain
    const edges = [];
    let sk = endStateKey;
    while (sk) {
      const cf = cameFrom.get(sk);
      if (!cf) break;
      edges.unshift(cf.edge);
      sk = cf.prev;
    }
    if (edges.length === 0) return null;

    const path = [{
      lat: startNode.lat, lon: startNode.lon,
      maxSpeed: this._effectiveSpeed(edges[0], routingMaxSpeed), electrified: edges[0].electrified !== false,
      tracks: edges[0].tracks || 1, wayId: edges[0].wayId,
      name: edges[0].name || '', ref: edges[0].ref || '', trackRef: edges[0].trackRef || '',
    }];
    for (const e of edges) {
      const n = graph.nodes.get(e.to);
      path.push({
        lat: n.lat, lon: n.lon,
        maxSpeed: this._effectiveSpeed(e, routingMaxSpeed), electrified: e.electrified !== false,
        tracks: e.tracks || 1, wayId: e.wayId, usage: e.usage, service: e.service,
        name: e.name || '', ref: e.ref || '', trackRef: e.trackRef || '',
      });
    }
    return path;
  }

  // Dijkstra with intermediate waypoints (forced routing through specific nodes)
  dijkstraConstrained(graph, startKey, endKey, waypointKeys, opts = null) {
    if (!waypointKeys || waypointKeys.length === 0) {
      return this.dijkstra(graph, startKey, endKey, opts);
    }
    const allKeys = [startKey, ...waypointKeys, endKey];
    let fullPath = null;
    for (let i = 0; i < allKeys.length - 1; i++) {
      const segment = this.dijkstra(graph, allKeys[i], allKeys[i + 1], opts);
      if (!segment || segment.length < 2) return null;
      if (!fullPath) {
        fullPath = segment;
      } else {
        fullPath.push(...segment.slice(1));
      }
    }
    return fullPath;
  }

  // ============================================================
  // SNAP TO NEAREST NODE / WAY — for player clicks
  // ============================================================

  findNearestNode(graph, lat, lon, maxDistKm = Infinity) {
    // Use the spatial grid when available (O(1) avg vs O(n) scan)
    if (graph._index) return this._nearestViaIndex(graph, lat, lon, maxDistKm);
    let best = null, bestDist = Infinity;
    for (const [, node] of graph.nodes) {
      const d = haversine(lat, lon, node.lat, node.lon);
      if (d < bestDist && d <= maxDistKm) { bestDist = d; best = node; }
    }
    return best ? { node: best, dist: bestDist } : null;
  }

  snapToNearest(lat, lon, maxDistKm = 2) {
    const graph = this._ensureGraph();
    if (!graph || graph.nodes.size === 0) return null;
    return this.findNearestNode(graph, lat, lon, maxDistKm);
  }

  async snapToRailway(lat, lon, maxDistKm = 2) {
    // First try the unified graph
    const snap = this.snapToNearest(lat, lon, maxDistKm);
    if (snap) return { lat: snap.node.lat, lon: snap.node.lon, dist: snap.dist };

    // Fallback: load area if not loaded
    const padding = Math.max(0.05, maxDistKm * 0.015);
    await this.fetchArea(lat - padding, lon - padding, lat + padding, lon + padding);
    const snap2 = this.snapToNearest(lat, lon, maxDistKm);
    if (!snap2) return null;
    return { lat: snap2.node.lat, lon: snap2.node.lon, dist: snap2.dist };
  }

  // Snap to the nearest point on any way (interpolated on the segment, not just nodes)
  // Optional wayFilter can restrict the search (e.g. main/branch lines only).
  snapToWay(lat, lon, maxDistKm = 0.5, wayFilter = null) {
    let bestDist = Infinity, bestLat = null, bestLon = null, bestWayId = null;
    for (const [, way] of this._ways) {
      if (wayFilter && !wayFilter(way)) continue;
      const geom = way.geometry;
      for (let i = 0; i < geom.length - 1; i++) {
        const proj = this._projectOnSegment(lat, lon, geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const d = haversine(lat, lon, proj.lat, proj.lon);
        if (d < bestDist && d <= maxDistKm) {
          bestDist = d;
          bestLat = proj.lat;
          bestLon = proj.lon;
          bestWayId = way.id;
        }
      }
    }
    if (bestLat === null) return null;
    const way = bestWayId ? this._ways.get(bestWayId) : null;
    return { lat: bestLat, lon: bestLon, dist: bestDist, wayId: bestWayId, maxSpeed: way ? this._effectiveSpeed(way) : 30 };
  }

  // SC-04 / remaster IV : vitesse d'un point du trace = vitesse de la voie
  // ORM la plus proche. Prefer main/branch lines so a nearby service track
  // does not force a 30 km/h limit on a main-line route.
  getNearestWayMaxSpeed(lat, lon, maxDistKm = 0.5) {
    const mainFilter = (w) => w.usage === 'main' || w.usage === 'branch';
    let snap = this.snapToWay(lat, lon, maxDistKm, mainFilter);
    if (!snap?.wayId) snap = this.snapToWay(lat, lon, maxDistKm);
    if (snap?.wayId) {
      const way = this._ways.get(snap.wayId);
      if (way) {
        const v = this._effectiveSpeed(way);
        if (v > 0) return v;
      }
      if (snap.maxSpeed > 0) return snap.maxSpeed;
    }
    const nodeSnap = this.snapToNearest(lat, lon, maxDistKm);
    if (nodeSnap?.node?.maxSpeed > 0) return nodeSnap.node.maxSpeed;
    return null;
  }

  _projectOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { lat: ax, lon: ay };
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { lat: ax + t * dx, lon: ay + t * dy };
  }

  // Snap to the nearest existing node OR project onto the nearest way segment
  // and split that segment so the projected point becomes a real graph node.
  _snapAndSplitLocalWay(ways, lat, lon, maxDistKm = 5) {
    let bestNode = null, bestNodeDist = Infinity;
    for (const way of ways) {
      for (const p of way.geometry) {
        const d = haversine(lat, lon, p.lat, p.lon);
        if (d < bestNodeDist) { bestNodeDist = d; bestNode = p; }
      }
    }
    let bestSeg = null, bestSegDist = Infinity;
    for (const way of ways) {
      const geom = way.geometry;
      for (let i = 0; i < geom.length - 1; i++) {
        const proj = this._projectOnSegment(lat, lon, geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const d = haversine(lat, lon, proj.lat, proj.lon);
        if (d < bestSegDist) { bestSegDist = d; bestSeg = { way, idx: i, proj }; }
      }
    }
    const bestDist = Math.min(bestNodeDist, bestSegDist);
    if (bestDist > maxDistKm) return null;
    if (bestNodeDist <= bestSegDist && bestNode) {
      return { lat: bestNode.lat, lon: bestNode.lon, key: `${bestNode.lat.toFixed(6)},${bestNode.lon.toFixed(6)}`, split: false };
    }
    bestSeg.way.geometry.splice(bestSeg.idx + 1, 0, bestSeg.proj);
    return { lat: bestSeg.proj.lat, lon: bestSeg.proj.lon, key: `${bestSeg.proj.lat.toFixed(6)},${bestSeg.proj.lon.toFixed(6)}`, split: true };
  }

  // ============================================================
  // IMPORT INFRASTRUCTURE — "Tracer ligne" mode
  // Calcule un itinéraire A→B sur le graphe ORM local et crée les tronçons
  // correspondants. N'importe plus tout le réseau au-delà de la destination.
  // ============================================================

  async importInfrastructure(fromLat, fromLon, toLat, toLon, opts = null) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.02, Math.min(distKm * 0.005 + 0.015, 0.35));
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    if (allWays.length === 0) return { voiePoints: [], troncons: [] };

    // VACUUM MODE — Tracer ligne absorbs every railway way in the fetched area.
    if (opts?.vacuum) {
      const vpMap = new Map();
      const resultVoiePoints = [];
      const resultTroncons = [];
      const getOrCreateVP = (p) => {
        const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
        if (vpMap.has(key)) return vpMap.get(key);
        const vpId = `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const voieLabel = `TL-${++_linePointCounter}`;
        const vp = { id: vpId, lat: p.lat, lon: p.lon, voie: voieLabel, stationId: null, linePoint: true };
        resultVoiePoints.push(vp);
        vpMap.set(key, vpId);
        return vpId;
      };

      for (const way of allWays) {
        const geom = way.geometry;
        if (!geom || geom.length < 2) continue;
        const ms = Number.isFinite(way.maxSpeed) ? way.maxSpeed : 30;
        const tracks = way.tracks || 1;
        const electrified = way.electrified !== false;
        const wayId = way.id || '';
        const name = way.name || '';
        const ref = way.ref || '';
        const trackRef = way.trackRef || '';

        let prevId = null;
        for (let i = 0; i < geom.length; i++) {
          const p = geom[i];
          const vpId = getOrCreateVP(p);
          if (prevId && vpId !== prevId) {
            const a = geom[i - 1];
            const b = p;
            const route = [
              { lat: a.lat, lon: a.lon, maxSpeed: ms, tracks, electrified, wayId, name, ref, trackRef },
              { lat: b.lat, lon: b.lon, maxSpeed: ms, tracks, electrified, wayId, name, ref, trackRef }
            ];
            const dist = this.getRouteDistance(route);
            resultTroncons.push({
              pointA: prevId, pointB: vpId,
              route,
              distance: Math.round(dist * 10) / 10,
              name, ref, trackRef
            });
          }
          prevId = vpId;
        }
      }

      return { voiePoints: resultVoiePoints, troncons: resultTroncons };
    }

    // LEGACY PATH MODE — compute a shortest A→B path and split at junctions.
    const wayById = new Map(allWays.map(w => [w.id, w]));

    // Snap A/B to existing node or project onto nearest way segment (and split it)
    const startSnap = this._snapAndSplitLocalWay(allWays, fromLat, fromLon, 5);
    const endSnap = this._snapAndSplitLocalWay(allWays, toLat, toLon, 5);
    if (!startSnap || !endSnap) return { voiePoints: [], troncons: [] };

    // Node-level adjacency for junction detection
    const nodes = new Map();
    const nodeGraph = new Map();
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length; i++) {
        const key = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        if (!nodes.has(key)) nodes.set(key, { key, lat: geom[i].lat, lon: geom[i].lon });
        if (i < geom.length - 1) {
          const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
          if (key === bKey) continue;
          if (!nodeGraph.has(key)) nodeGraph.set(key, []);
          if (!nodeGraph.has(bKey)) nodeGraph.set(bKey, []);
          nodeGraph.get(key).push({ neighborKey: bKey, maxSpeed: way.maxSpeed, wayId: way.id });
          nodeGraph.get(bKey).push({ neighborKey: key, maxSpeed: way.maxSpeed, wayId: way.id });
        }
      }
    }

    const graph = this.buildGraph(allWays);
    if (!graph.nodes.has(startSnap.key) || !graph.nodes.has(endSnap.key)) {
      return { voiePoints: [], troncons: [] };
    }

    // Itinéraire le plus court A→B, sans dépasser la destination
    const path = this.dijkstra(graph, startSnap.key, endSnap.key);
    if (!path || path.length < 2) return { voiePoints: [], troncons: [] };

    // Découper l'itinéraire aux jonctions (degré != 2) et aux extrémités
    const splitIdxs = [];
    for (let i = 0; i < path.length; i++) {
      const key = `${path[i].lat.toFixed(6)},${path[i].lon.toFixed(6)}`;
      const neighbors = nodeGraph.get(key) || [];
      const unique = new Set(neighbors.map(n => n.neighborKey));
      if (i === 0 || i === path.length - 1 || unique.size !== 2) splitIdxs.push(i);
    }

    const vpMap = new Map();
    const resultVoiePoints = [];
    const resultTroncons = [];
    const getOrCreateVP = (p) => {
      const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
      if (vpMap.has(key)) return vpMap.get(key);
      const vpId = `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const vp = { id: vpId, lat: p.lat, lon: p.lon, voie: '1', stationId: null, linePoint: true };
      resultVoiePoints.push(vp);
      vpMap.set(key, vpId);
      return vpId;
    };

    for (let s = 0; s < splitIdxs.length - 1; s++) {
      const startI = splitIdxs[s];
      const endI = splitIdxs[s + 1];
      const subPath = path.slice(startI, endI + 1);
      if (subPath.length < 2) continue;
      const vpA = getOrCreateVP(subPath[0]);
      const vpB = getOrCreateVP(subPath[subPath.length - 1]);
      if (!vpA || !vpB || vpA === vpB) continue;

      const route = subPath.map((p) => {
        const ms = Number.isFinite(p.maxSpeed) ? p.maxSpeed : 30;
        return {
          lat: p.lat, lon: p.lon,
          maxSpeed: ms,
          tracks: p.tracks || 1,
          electrified: p.electrified !== false,
          wayId: p.wayId || '',
          name: p.name || '',
          ref: p.ref || '',
          trackRef: p.trackRef || ''
        };
      });
      const dist = this.getRouteDistance(route);
      const wayMeta = wayById.get(route[1]?.wayId || route[0]?.wayId) || {};
      resultTroncons.push({
        pointA: vpA, pointB: vpB,
        route,
        distance: Math.round(dist * 10) / 10,
        name: wayMeta.name || '', ref: wayMeta.ref || '', trackRef: wayMeta.trackRef || ''
      });
    }

    return { voiePoints: resultVoiePoints, troncons: resultTroncons };
  }

  // ============================================================
  // ROUTE FINDING — uses unified graph or area-specific graph
  // ============================================================

  // TRV-03/06 : construit un set d'arêtes à éviter à partir de paires de stations
  _avoidEdgesForPairs(graph, pairs) {
    const avoid = new Set();
    if (!graph || !Array.isArray(pairs)) return avoid;
    for (const p of pairs) {
      if (p == null) continue;
      const a = this.findNearestNode(graph, p.latA ?? p.lat, p.lonA ?? p.lon, 5);
      const b = this.findNearestNode(graph, p.latB ?? p.lat2, p.lonB ?? p.lon2, 5);
      if (!a || !b) continue;
      avoid.add(a.node.key + '>' + b.node.key);
      avoid.add(b.node.key + '>' + a.node.key);
    }
    return avoid;
  }

  async findRoute(fromLat, fromLon, toLat, toLon, opts = null) {
    const raw = await this._findRouteUnclamped(fromLat, fromLon, toLat, toLon, opts);
    return this._clampRouteToEndpoints(raw, fromLat, fromLon, toLat, toLon);
  }

  async _findRouteUnclamped(fromLat, fromLon, toLat, toLon, opts = null) {
    const speedSuffix = opts?.maxSpeed ? `v${Math.round(opts.maxSpeed)}` : 'v160';
    const avoidSuffix = opts?.avoidStationPairs?.length
      ? `-a${opts.avoidStationPairs.length}`
      : '';
    const cacheKey = `${fromLat.toFixed(4)},${fromLon.toFixed(4)}-${toLat.toFixed(4)},${toLon.toFixed(4)}-${speedSuffix}${avoidSuffix}`;
    if (this.routeCache.has(cacheKey)) return this.routeCache.get(cacheKey);

    // First try the unified graph (pre-loaded areas)
    const uGraph = this._ensureGraph();
    const routeOpts = { ...opts };
    if (opts?.avoidStationPairs?.length && uGraph) {
      routeOpts.avoidEdges = this._avoidEdgesForPairs(uGraph, opts.avoidStationPairs);
    }
    if (uGraph && uGraph.nodes.size > 0) {
      const s = this.findNearestNode(uGraph, fromLat, fromLon, 5);
      const e = this.findNearestNode(uGraph, toLat, toLon, 5);
      if (s && e) {
        const path = this.dijkstra(uGraph, s.node.key, e.node.key, routeOpts);
        if (path && path.length >= 2) {
          this.routeCache.set(cacheKey, path);
          return path;
        }
      }
    }

    // Fallback: load area and try
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    // Load a generous area: 1% of the leg distance, min 0.02 deg, max 0.5 deg.
    const padding = Math.max(0.02, Math.min(0.5, distKm * 0.01));
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    if (allWays.length === 0) {
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    // Use the unified graph (now includes new area)
    const graph = this._ensureGraph();
    if (opts?.avoidStationPairs?.length && graph) {
      routeOpts.avoidEdges = this._avoidEdgesForPairs(graph, opts.avoidStationPairs);
    }
    const snapRadius = distKm < 0.5 ? 0.3 : Math.max(5, Math.min(20, distKm * 0.05));
    const startResult = this.findNearestNode(graph, fromLat, fromLon, snapRadius);
    const endResult = this.findNearestNode(graph, toLat, toLon, snapRadius);

    if (distKm < 0.5 && (!startResult || !endResult || startResult.node.key === endResult.node.key)) {
      const direct = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, direct);
      return direct;
    }

    if (!startResult || !endResult) {
      // Try with larger padding
      const extraPadding = padding * 3;
      await this.fetchArea(
        Math.min(fromLat, toLat) - extraPadding,
        Math.min(fromLon, toLon) - extraPadding,
        Math.max(fromLat, toLat) + extraPadding,
        Math.max(fromLon, toLon) + extraPadding
      );
      const graph2 = this._ensureGraph();
      if (opts?.avoidStationPairs?.length && graph2) {
        routeOpts.avoidEdges = this._avoidEdgesForPairs(graph2, opts.avoidStationPairs);
      }
      const s2 = this.findNearestNode(graph2, fromLat, fromLon, 20);
      const e2 = this.findNearestNode(graph2, toLat, toLon, 20);
      if (s2 && e2) {
        const retryPath = this.dijkstra(graph2, s2.node.key, e2.node.key, routeOpts);
        if (retryPath && retryPath.length > 0) {
          this.routeCache.set(cacheKey, retryPath);
          return retryPath;
        }
      }
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const path = this.dijkstra(graph, startResult.node.key, endResult.node.key, routeOpts);
    if (!path || path.length === 0) {
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    this.routeCache.set(cacheKey, path);
    // Limit route cache size to prevent memory bloat
    if (this.routeCache.size > 500) {
      const keys = Array.from(this.routeCache.keys());
      for (let i = 0; i < 200; i++) this.routeCache.delete(keys[i]);
    }
    return path;
  }

  // Route with waypoint constraints (player forced routing)
  async findConstrainedRoute(fromLat, fromLon, toLat, toLon, waypointLatLons, opts = null) {
    // Load area covering all points
    let minLat = Math.min(fromLat, toLat), maxLat = Math.max(fromLat, toLat);
    let minLon = Math.min(fromLon, toLon), maxLon = Math.max(fromLon, toLon);
    for (const wp of waypointLatLons) {
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
      minLon = Math.min(minLon, wp.lon);
      maxLon = Math.max(maxLon, wp.lon);
    }
    const padding = 0.01;
    await this.fetchArea(minLat - padding, minLon - padding, maxLat + padding, maxLon + padding);

    const graph = this._ensureGraph();
    if (!graph || graph.nodes.size === 0) {
      return this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const startSnap = this.findNearestNode(graph, fromLat, fromLon, 5);
    const endSnap = this.findNearestNode(graph, toLat, toLon, 5);
    if (!startSnap || !endSnap) {
      return this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const waypointKeys = waypointLatLons.map(wp => {
      const snap = this.findNearestNode(graph, wp.lat, wp.lon, 2);
      return snap ? snap.node.key : null;
    }).filter(k => k !== null);

    const path = this.dijkstraConstrained(graph, startSnap.node.key, endSnap.node.key, waypointKeys, opts);
    const clamped = this._clampRouteToEndpoints(path, fromLat, fromLon, toLat, toLon);
    return clamped || this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
  }

  // R-03: fallback direct (straight) when ORM has no graph. Tagged so the
  // renderer can show it as unconfirmed, and sampled at 50 m for physics.
  makeFallbackRoute(fromLat, fromLon, toLat, toLon) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    if (distKm > this._maxFallbackKm) return null;
    const stepKm = 0.05;
    const steps = Math.max(2, Math.ceil(distKm / stepKm));
    const midLat = (fromLat + toLat) / 2;
    const midLon = (fromLon + toLon) / 2;
    const maxSpeed = this.getNearestWayMaxSpeed(midLat, midLon, 2.0) ?? 160;
    const route = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      route.push({
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t,
        maxSpeed, electrified: true, tracks: 2, fallback: true,
      });
    }
    return route;
  }

  // Is this route a synthetic straight-line fallback (not real ORM track)?
  isFallbackRoute(route) {
    return Array.isArray(route) && route.length > 0 && route.some(p => p && p.fallback);
  }

  // Clamp an ORM route so it starts and ends at the exact requested coordinates
  // and never overshoots the destination. This fixes the "aller après" / "aller
  // derrière" artefacts when the snapped graph node lies beyond the target.
  _clampRouteToEndpoints(route, fromLat, fromLon, toLat, toLon) {
    if (!Array.isArray(route) || route.length < 2) return route;
    const out = route.slice();
    const maxSnap = 5; // km
    // Snap start point to exact origin when within snapping range.
    if (haversine(out[0].lat, out[0].lon, fromLat, fromLon) <= maxSnap) {
      out[0] = { ...out[0], lat: fromLat, lon: fromLon };
    }
    // Find the closest point to the destination and truncate after it.
    let bestIdx = out.length - 1;
    let bestD = Infinity;
    for (let i = out.length - 1; i >= 0; i--) {
      const d = haversine(out[i].lat, out[i].lon, toLat, toLon);
      if (d <= bestD) { bestD = d; bestIdx = i; }
    }
    if (bestIdx < out.length - 1) out.length = bestIdx + 1;
    // Snap / append exact destination.
    if (out.length === 0) return this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    if (haversine(out[out.length - 1].lat, out[out.length - 1].lon, toLat, toLon) <= maxSnap) {
      out[out.length - 1] = { ...out[out.length - 1], lat: toLat, lon: toLon };
    } else {
      out.push({ lat: toLat, lon: toLon, maxSpeed: out[out.length - 1]?.maxSpeed || 30, fallback: true });
    }
    return out.length >= 2 ? out : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  getRouteDistance(route) {
    if (!Array.isArray(route)) return 0;
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      total += haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
    }
    return total;
  }

  getRouteSegments(route) {
    const segments = [];
    if (!Array.isArray(route)) return segments;
    for (let i = 1; i < route.length; i++) {
      const dist = haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
      segments.push({
        from: route[i - 1], to: route[i],
        distance: dist,
        maxSpeed: route[i].maxSpeed || route[i - 1].maxSpeed || 30,
        electrified: route[i].electrified !== false,
        tracks: route[i].tracks || 1,
      });
    }
    return segments;
  }

  // Travel time (minutes) for a route.
  // `rame` may be a number (max speed km/h — generic physics estimate) or a Rame-like
  // object (totalMass/totalPower/totalLength/maxSpeed) → realistic traction
  // physics via train-physics.js (PH-01→PH-07, VIT-02/03).
  calculateTravelTime(route, rame, opts = null) {
    if (!Array.isArray(route) || route.length < 2) return 1;

    // Use the real rame physics whenever mass and power are available.
    if (rame && typeof rame === 'object') {
      const physical = this._physicalTravelTime(route, rame, opts);
      if (physical !== null) return physical;
      // No power / no mass: fall through to the conservative generic estimate below.
    }

    const rameMaxSpeed = typeof rame === 'number' ? rame : (rame && rame.maxSpeed) || 160;
    const rameMaxMs = rameMaxSpeed / 3.6;
    const segs = segmentsFromRoute(route, rameMaxSpeed, haversine);
    if (segs.length === 0) return 1;

    // Generic conservative trainset: enough power to be plausible, but not
    // optimistic. This path is used for raw speed numbers or unpowered rames.
    const massT = 500;
    const powerPerTonne = 12; // kW/t — middle-of-the-road regional/LGV mix
    const massKg = massT * 1000;
    const powerW = massKg * powerPerTonne;
    const res = simulateProfile(segs, {
      massKg,
      powerW,
      lengthM: 200,
      weather: opts?.weather,
      brakeServiceMs2: opts?.brakeServiceMs2,
      startMs: opts?.startMs ?? 0,
      endMs: opts?.endMs ?? 0,
    });
    return applyTravelTimeSafety(Math.round(res.timeSec / 60) || 1);
  }

  // Realistic travel time (minutes) using traction physics. Returns null when
  // the rame lacks the data needed (falls back to the zone estimate).
  _physicalTravelTime(route, rame, opts = null) {
    const massKg = ((rame.getTotalMassWithPayload
      ? rame.getTotalMassWithPayload(opts?.loadFactor ?? 0.7)
      : (rame.totalMass || rame.totalTonnage)) || 0) * 1000;
    const powerW = (rame.totalPower || 0) * 1000;
    if (massKg <= 0 || powerW <= 0) return null;

    const maxSpeedKmh = rame.maxSpeed || 160;
    const maxSpeedMs = maxSpeedKmh / 3.6;
    const segs = segmentsFromRoute(route, maxSpeedKmh, haversine);
    if (segs.length === 0) return null;

    const res = simulateProfile(segs, {
      massKg,
      powerW,
      lengthM: rame.totalLength || 200,
      weather: opts?.weather,
      brakeServiceMs2: opts?.brakeServiceMs2,
      startMs: opts?.startMs ?? 0,
      endMs: opts?.endMs ?? 0,
    });
    return applyTravelTimeSafety(Math.round(res.timeSec / 60) || 1);
  }

  // Travel time profile (minutes) for a route, returning the time at requested
  // cumulative distances. Useful for schedule creators with intermediate
  // waypoints/voie points: one continuous physics run from arret to arret,
  // then the time is sampled at each intermediate point.
  // queryDistancesKm must be sorted non-decreasing; the last one is normally
  // the terminal arret and gets the total travel time.
  calculateTravelTimeProfile(route, rame, opts = null, queryDistancesKm = []) {
    if (!Array.isArray(route) || route.length < 2) return null;

    let rameMaxSpeed, massKg, powerW, lengthM;
    if (rame && typeof rame === 'object') {
      const payload = opts?.loadFactor ?? 0.7;
      massKg = ((rame.getTotalMassWithPayload
        ? rame.getTotalMassWithPayload(payload)
        : (rame.totalMass || rame.totalTonnage)) || 0) * 1000;
      powerW = (rame.totalPower || 0) * 1000;
      if (massKg > 0 && powerW > 0) {
        rameMaxSpeed = rame.maxSpeed || 160;
        lengthM = rame.totalLength || 200;
      }
    }

    // Generic conservative trainset fallback.
    if (!massKg || !powerW) {
      rameMaxSpeed = typeof rame === 'number' ? rame : (rame && rame.maxSpeed) || 160;
      const massT = 500;
      const powerPerTonne = 12;
      massKg = massT * 1000;
      powerW = massKg * powerPerTonne;
      lengthM = 200;
    }

    const segs = segmentsFromRoute(route, rameMaxSpeed, haversine);
    if (segs.length === 0) return null;

    const queryDistancesM = (Array.isArray(queryDistancesKm) ? queryDistancesKm : [])
      .map(d => d * 1000);

    const res = simulateProfileCumulative(segs, {
      massKg,
      powerW,
      lengthM,
      weather: opts?.weather,
      brakeServiceMs2: opts?.brakeServiceMs2,
      startMs: opts?.startMs ?? 0,
      endMs: opts?.endMs ?? 0,
    }, queryDistancesM);

    const baseTotalMin = Math.round(res.timeSec / 60) || 1;
    const totalMin = applyTravelTimeSafety(baseTotalMin);
    const safetyScale = baseTotalMin > 0 ? totalMin / baseTotalMin : 1;

    const queryTimesMin = res.queryTimesSec.map(tSec => {
      const baseMin = Math.round(tSec / 60);
      return Math.max(0, Math.round(baseMin * safetyScale));
    });

    return { totalMin, queryTimesMin };
  }

  generateSignalBlocks(route) {
    const segments = this.getRouteSegments(route);
    const signals = [];
    const totalDist = this.getRouteDistance(route);
    if (totalDist <= 0) return signals;
    let accDist = 0, lastSignalDist = 0;
    for (const seg of segments) {
      const speed = seg.maxSpeed;
      const blockLength = 0.8;
      accDist += seg.distance;
      while (accDist - lastSignalDist >= blockLength) {
        lastSignalDist += blockLength;
        const ratio = lastSignalDist / totalDist;
        const pos = this.getPointAtRatio(route, ratio);
        signals.push({ km: lastSignalDist, lat: pos.lat, lon: pos.lon, maxSpeed: speed, blockLength });
      }
    }
    return signals;
  }

  getPointAtRatio(route, ratio) {
    if (!Array.isArray(route) || route.length < 2) return (route && route[0]) || { lat: 0, lon: 0 };
    const r = Math.max(0, Math.min(1, ratio));
    let totalDist = 0;
    const segDists = [];
    for (let i = 1; i < route.length; i++) {
      const d = haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
      segDists.push(d);
      totalDist += d;
    }
    let target = r * totalDist;
    for (let i = 0; i < segDists.length; i++) {
      if (target <= segDists[i]) {
        const segRatio = segDists[i] > 0 ? target / segDists[i] : 0;
        return {
          lat: route[i].lat + (route[i + 1].lat - route[i].lat) * segRatio,
          lon: route[i].lon + (route[i + 1].lon - route[i].lon) * segRatio,
          maxSpeed: route[i + 1].maxSpeed || route[i].maxSpeed || 160,
        };
      }
      target -= segDists[i];
    }
    return route[route.length - 1];
  }

  getCountryAtPoint(lat, lon) {
    // Check smaller/more specific countries first to avoid overlap
    if (lat >= 49.4 && lat <= 50.2 && lon >= 5.7 && lon <= 6.4) return 'LU';
    if (lat >= 46 && lat <= 48.3 && lon >= 5.9 && lon <= 10.5) return 'CH';
    if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.4) return 'BE';
    if (lat >= 50.7 && lat <= 53.6 && lon >= 3.3 && lon <= 7.2) return 'NL';
    if (lat >= 49.5 && lat <= 51.6 && lon >= -5.5 && lon <= 1.8) return 'GB';
    if (lat >= 36 && lat <= 43.8 && lon >= -9.5 && lon <= 3.4) return 'ES';
    if (lat >= 36 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) return 'IT';
    if (lat >= 47 && lat <= 55.1 && lon >= 5.9 && lon <= 15.1) return 'DE';
    if (lat >= 41 && lat <= 51.1 && lon >= -5 && lon <= 9.5) return 'FR';
    return 'OTHER';
  }

  isDriveLeft(country) {
    return ['FR', 'IT', 'BE', 'GB'].includes(country);
  }

  toSave() {
    // Don't save routeCache — it's huge (100s of MB) and rebuilds on-demand
    return {
      loadedBboxes: this._loadedBboxes,
    };
  }

  loadFromSave(saved) {
    if (!saved) return;
    // Restore loaded bounding boxes (route cache is rebuilt on-demand)
    if (saved.loadedBboxes) {
      this._loadedBboxes = saved.loadedBboxes;
    }
  }

  // Reload OSM data for previously loaded areas (after save load)
  async reloadAreas() {
    for (const bb of this._loadedBboxes) {
      await this.fetchArea(bb.south, bb.west, bb.north, bb.east);
    }
  }
}
