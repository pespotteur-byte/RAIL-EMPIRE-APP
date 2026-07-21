// OpenRailwayMap data integration via Overpass API — ORM Direct architecture
// Uses OSM way graph directly as the game's routing infrastructure.
// No conversion to intermediate tronçons — the OSM graph IS the network.
import { segmentsFromRoute, simulateProfile } from './train-physics.js';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const DB_NAME = 'rail-empire-orm';
const DB_STORE = 'areas';
const DB_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep cached areas for 7 days

// SC-05 : no safety margin on auto-scheduled travel times so the schedule
// matches the physics exactly (0 %, 0 extra minute). Advance only appears if
// the player manually tightens the timetable.
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
    this._maxFallbackKm = 1.0;   // only fabricate straight connectors up to 1 km (R-03)
    // R-07 : plafond V160 par défaut pour le calcul d'itinéraire (matériel joueur)
    this._routingSpeedCapKmh = 160;
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
    if (rec) return { ways: rec.ways, stations: rec.stations };
    const legacy = localStorageGet(localStorageKey(key));
    return legacy ? { ways: legacy.ways || [], stations: legacy.stations || [] } : null;
  }

  async _saveCachedArea(key, payload) {
    await this._persistentCache.set(key, payload);
    localStorageSet(localStorageKey(key), payload);
  }

  parseWays(data) {
    if (!data.elements) return [];
    return data.elements
      .filter(el => el.type === 'way' && el.geometry)
      .map(el => {
        const usage = el.tags?.usage || '';
        const service = el.tags?.service || '';
        const isMainOrBranch = usage === 'main' || usage === 'branch';
        // Annexe 3A / §IV — voie sans indication de vitesse :
        //   • si ORM distingue voie principale (main/branch), défaut élevé (160);
        //   • sinon (pas d’usage/service, ou service/triage) défaut sécuritaire 30 km/h.
        const hasSpeed = el.tags?.maxspeed && !Number.isNaN(parseInt(el.tags.maxspeed));
        const maxSpeed = hasSpeed ? parseInt(el.tags.maxspeed) : (isMainOrBranch ? 160 : 30);
        return {
          id: el.id,
          maxSpeed,
          electrified: el.tags?.electrified !== 'no',
          tracks: parseInt(el.tags?.tracks) || 1,
          usage: el.tags?.usage || 'main',
          service,
          name: el.tags?.name || '',
          ref: el.tags?.ref || '',
          trackRef: el.tags?.['railway:track_ref'] || el.tags?.track_ref || '',
          preferredDirection: (() => {
            const pd = (el.tags?.['railway:preferred_direction'] || '').toLowerCase();
            return pd === 'forward' || pd === 'backward' ? pd : 'both';
          })(),
          geometry: el.geometry.map(p => ({ lat: p.lat, lon: p.lon })),
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
      if (!w.usage) w.usage = 'main';
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
      dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks,
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
    const ringCap = maxDistKm === Infinity ? 400 : Math.ceil(maxDistKm / (cs * 60)) + 3;
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
    // 30 si absence d’usage/service (on ne peut pas distinguer) ou service/triage.
    const isMainOrBranch = edge.usage === 'main' || edge.usage === 'branch';
    let v = edge.maxSpeed != null ? edge.maxSpeed : (isMainOrBranch ? 160 : 30);
    const isService = (edge.service && edge.service !== '') ||
      (edge.usage && edge.usage !== 'main' && edge.usage !== 'branch');
    if (isService) v = Math.min(v, this._serviceSpeedKmh);
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

    const cap = routingMaxSpeed ?? this._routingSpeedCapKmh ?? Infinity;
    const capSpeed = (v) => (cap > 0 && Number.isFinite(cap) ? Math.min(v, cap) : v);

    const path = [{
      lat: startNode.lat, lon: startNode.lon,
      maxSpeed: capSpeed(edges[0].maxSpeed), electrified: edges[0].electrified !== false,
      tracks: edges[0].tracks || 1, wayId: edges[0].wayId,
      name: edges[0].name || '', ref: edges[0].ref || '', trackRef: edges[0].trackRef || '',
    }];
    for (const e of edges) {
      const n = graph.nodes.get(e.to);
      path.push({
        lat: n.lat, lon: n.lon,
        maxSpeed: capSpeed(e.maxSpeed), electrified: e.electrified !== false,
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
  snapToWay(lat, lon, maxDistKm = 0.5) {
    let bestDist = Infinity, bestLat = null, bestLon = null, bestWayId = null;
    for (const [, way] of this._ways) {
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
    return { lat: bestLat, lon: bestLon, dist: bestDist, wayId: bestWayId };
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
  // Now imports ALL ways in the zone, no filtering.
  // Returns voie points (at real junctions) and tronçons.
  // ============================================================

  async importInfrastructure(fromLat, fromLon, toLat, toLon) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.02, Math.min(distKm * 0.005 + 0.015, 0.35));
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    const wayById = new Map(allWays.map(w => [w.id, w]));
    if (allWays.length === 0) return { voiePoints: [], troncons: [] };

    // Snap A/B to existing node or project onto nearest way segment (and split it)
    // so clicks/stations do not need to land exactly on an OSM node.
    const startSnap = this._snapAndSplitLocalWay(allWays, fromLat, fromLon, 5);
    const endSnap = this._snapAndSplitLocalWay(allWays, toLat, toLon, 5);
    if (!startSnap || !endSnap) return { voiePoints: [], troncons: [] };

    // Build node-level adjacency graph from ALL ways (no filtering!)
    const nodes = new Map();
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length; i++) {
        const key = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        if (!nodes.has(key)) {
          nodes.set(key, { key, lat: geom[i].lat, lon: geom[i].lon, wayIds: new Set(), edgeCount: 0 });
        }
        nodes.get(key).wayIds.add(way.id);
      }
    }

    const nodeGraph = new Map();
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (aKey === bKey) continue;
        if (!nodeGraph.has(aKey)) nodeGraph.set(aKey, []);
        if (!nodeGraph.has(bKey)) nodeGraph.set(bKey, []);
        nodeGraph.get(aKey).push({ neighborKey: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, maxSpeed: way.maxSpeed, wayId: way.id });
        nodeGraph.get(bKey).push({ neighborKey: aKey, lat: geom[i].lat, lon: geom[i].lon, maxSpeed: way.maxSpeed, wayId: way.id });
      }
    }

    // Use the snapped A/B nodes (existing or projected-and-split)
    const graph = this.buildGraph(allWays);
    const startNode = nodes.get(startSnap.key);
    const endNode = nodes.get(endSnap.key);
    if (!startNode || !endNode) return { voiePoints: [], troncons: [] };
    const startResult = { node: startNode, dist: 0 };
    const endResult = { node: endNode, dist: 0 };

    // Identify junction nodes: degree != 2 (real branching/dead-end) + start/end
    const junctionNodes = new Set();
    junctionNodes.add(startResult.node.key);
    junctionNodes.add(endResult.node.key);
    for (const [nodeKey, neighbors] of nodeGraph) {
      const uniqueNeighbors = new Set(neighbors.map(n => n.neighborKey));
      if (uniqueNeighbors.size !== 2) junctionNodes.add(nodeKey);
    }

    // Chain-follow between junctions to create tronçons
    const resultVoiePoints = [];
    const resultTroncons = [];
    const vpMap = new Map();

    const getOrCreateVP = (nodeKey) => {
      if (vpMap.has(nodeKey)) return vpMap.get(nodeKey);
      const node = nodes.get(nodeKey);
      if (!node) return null;
      const vpId = `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      resultVoiePoints.push({
        id: vpId, lat: node.lat, lon: node.lon,
        voie: '1', stationId: null, linePoint: true
      });
      vpMap.set(nodeKey, vpId);
      return vpId;
    };

    const visitedEdges = new Set();
    for (const jNodeKey of junctionNodes) {
      if (!nodeGraph.has(jNodeKey)) continue;
      const neighbors = nodeGraph.get(jNodeKey);
      // Group neighbors by wayId to preserve parallel tracks
      const neighborsByWay = new Map();
      for (const nb of neighbors) {
        const wk = `${nb.neighborKey}|${nb.wayId}`;
        if (!neighborsByWay.has(wk)) neighborsByWay.set(wk, nb);
      }
      for (const [, nb] of neighborsByWay) {
        const edgeKey = `${jNodeKey}|${nb.neighborKey}|${nb.wayId}`;
        if (visitedEdges.has(edgeKey)) continue;

        // Chain-follow from jNodeKey through nb until next junction
        const chainPoints = [nodes.get(jNodeKey)];
        let prevKey = jNodeKey;
        let curKey = nb.neighborKey;
        let chainMaxSpeed = nb.maxSpeed || 100;
        let chainWayId = nb.wayId;
        visitedEdges.add(`${jNodeKey}|${nb.neighborKey}|${nb.wayId}`);
        visitedEdges.add(`${nb.neighborKey}|${jNodeKey}|${nb.wayId}`);

        while (!junctionNodes.has(curKey) && nodeGraph.has(curKey)) {
          const curNode = nodes.get(curKey);
          if (!curNode) break;
          chainPoints.push(curNode);
          const curNeighbors = nodeGraph.get(curKey);
          // Follow same wayId when possible
          let nextNb = curNeighbors.find(n => n.neighborKey !== prevKey && n.wayId === chainWayId);
          if (!nextNb) {
            const uniqueCurNbs = [...new Set(curNeighbors.filter(n => n.neighborKey !== prevKey).map(n => n.neighborKey))];
            if (uniqueCurNbs.length === 1) {
              nextNb = curNeighbors.find(n => n.neighborKey === uniqueCurNbs[0]);
            }
          }
          if (!nextNb) break;
          chainMaxSpeed = Math.min(chainMaxSpeed, nextNb.maxSpeed);
          visitedEdges.add(`${curKey}|${nextNb.neighborKey}|${nextNb.wayId}`);
          visitedEdges.add(`${nextNb.neighborKey}|${curKey}|${nextNb.wayId}`);
          prevKey = curKey;
          curKey = nextNb.neighborKey;
        }
        const endNode = nodes.get(curKey);
        if (endNode) chainPoints.push(endNode);

        if (chainPoints.length < 2) continue;
        const vpAId = getOrCreateVP(jNodeKey);
        const vpBId = getOrCreateVP(curKey);
        if (vpAId && vpBId && vpAId !== vpBId) {
          const trcRoute = chainPoints.map(p => ({
            lat: p.lat, lon: p.lon, maxSpeed: chainMaxSpeed, tracks: 1
          }));
          const dist = trcRoute.reduce((sum, p, idx) => {
            if (idx === 0) return 0;
            return sum + haversine(trcRoute[idx - 1].lat, trcRoute[idx - 1].lon, p.lat, p.lon);
          }, 0);
          // Keep ALL tronçons — no dédoublonnage of parallel tracks!
          const wayMeta = wayById.get(chainWayId) || {};
          resultTroncons.push({
            pointA: vpAId, pointB: vpBId,
            route: trcRoute, distance: Math.round(dist * 10) / 10,
            name: wayMeta.name || '', ref: wayMeta.ref || '', trackRef: wayMeta.trackRef || ''
          });
        }
      }
    }

    // Remove only self-loops (pointA === pointB), keep everything else
    const finalTrcs = resultTroncons.filter(trc => trc.pointA !== trc.pointB);

    // Iterative simplify: merge degree-2 pass-through VPs
    let cleanVPs = resultVoiePoints.slice();
    let cleanTrcs = finalTrcs.slice();
    const startVpIdFinal = vpMap.get(startResult.node.key);
    const endVpIdFinal = vpMap.get(endResult.node.key);

    let simplified = true;
    while (simplified) {
      simplified = false;
      const deg = new Map();
      for (const v of cleanVPs) deg.set(v.id, []);
      for (let ti = 0; ti < cleanTrcs.length; ti++) {
        const t = cleanTrcs[ti];
        if (!t) continue;
        if (deg.has(t.pointA)) deg.get(t.pointA).push(ti);
        if (deg.has(t.pointB)) deg.get(t.pointB).push(ti);
      }
      for (const vp of cleanVPs) {
        if (vp.id === startVpIdFinal || vp.id === endVpIdFinal) continue;
        const trcIndices = deg.get(vp.id);
        if (!trcIndices || trcIndices.length !== 2) continue;
        const t1 = cleanTrcs[trcIndices[0]];
        const t2 = cleanTrcs[trcIndices[1]];
        if (!t1 || !t2) continue;
        const other1 = t1.pointA === vp.id ? t1.pointB : t1.pointA;
        const other2 = t2.pointA === vp.id ? t2.pointB : t2.pointA;
        if (other1 === other2) continue;
        let r1 = t1.route || [];
        if (t1.pointB !== vp.id) r1 = [...r1].reverse();
        let r2 = t2.route || [];
        if (t2.pointA !== vp.id) r2 = [...r2].reverse();
        const mergedRoute = [...r1, ...r2.slice(1)];
        const mergedDist = Math.round((t1.distance + t2.distance) * 10) / 10;
        cleanTrcs[trcIndices[0]] = {
          pointA: other1, pointB: other2,
          route: mergedRoute, distance: mergedDist
        };
        cleanTrcs[trcIndices[1]] = null;
        cleanVPs = cleanVPs.filter(v => v.id !== vp.id);
        simplified = true;
        break;
      }
      cleanTrcs = cleanTrcs.filter(t => t !== null);
    }

    // NO pruning of short dead-ends — keep everything!
    // NO dédoublonnage — parallel tracks between same junctions are valid!
    // NO final merge of close VPs — each OSM node is distinct!

    return { voiePoints: cleanVPs, troncons: cleanTrcs };
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
    const padding = Math.max(0.01, Math.min(0.3, distKm * 0.003 + 0.01));
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
    const snapRadius = distKm < 0.5 ? 0.3 : 5;
    const startResult = this.findNearestNode(graph, fromLat, fromLon, snapRadius);
    const endResult = this.findNearestNode(graph, toLat, toLon, snapRadius);

    if (distKm < 0.5 && (!startResult || !endResult || startResult.node.key === endResult.node.key)) {
      const direct = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, direct);
      return direct;
    }

    if (!startResult || !endResult) {
      // Try with larger padding
      const extraPadding = padding * 2;
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
      const s2 = this.findNearestNode(graph2, fromLat, fromLon, 10);
      const e2 = this.findNearestNode(graph2, toLat, toLon, 10);
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
    return path || this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
  }

  // R-03: no more straight-line diagonal masquerading as real track.
  // A synthetic straight segment is only produced for SHORT connectors
  // (≤ _maxFallbackKm, e.g. a platform-to-rail stub) and every point is
  // tagged `fallback:true` so the renderer/schedule can flag it. For any
  // longer origin/destination pair with no ORM path we return null and let
  // the caller surface "route introuvable" instead of faking geometry.
  makeFallbackRoute(fromLat, fromLon, toLat, toLon) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    if (distKm > this._maxFallbackKm) return null;
    const steps = 20;
    const route = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      route.push({
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t,
        maxSpeed: 160, electrified: true, tracks: 2, fallback: true,
      });
    }
    return route;
  }

  // Is this route a synthetic straight-line fallback (not real ORM track)?
  isFallbackRoute(route) {
    return Array.isArray(route) && route.length > 0 && route.some(p => p && p.fallback);
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
