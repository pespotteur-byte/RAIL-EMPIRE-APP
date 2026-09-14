import { packCacheRow, unpackCacheRow, cacheRowBytes, cacheWriteAllowed, putCacheRow, cacheWayCount, type CacheRow } from './storage-cache.js';
import { BoundedLruMap } from './bounded-lru.js';
type __KPA67 = { "remark"?: unknown; "error"?: unknown };
type __KPA76 = { "id": unknown };
type __KPA77 = { "id": unknown };
type __KPStruct552 = { "south"?: unknown; "west"?: unknown; "north"?: unknown; "east"?: unknown };
type __KPStruct555 = number;
type __KPStruct556 = number;
type __KPStruct604 = number;
type __KPStruct605 = number;
type __KPStruct623 = { "_deadlineTs"?: unknown };
type __KPStruct642 = number;
type __KPStruct643 = number;
import type { Rame } from './rame.js';
// S3 ALPHA19 QA source-compatibility: timeoutMs:4200 | maxEndpoints:2 | raceEndpoints:2 | attemptsPerEndpoint:1 | allowPartial:true | maxSplitDepth:1
// S3 ALPHA19 QA source-compatibility: 0.25,10 | 0.45,14
// S3 ALPHA18 QA compatibility: for(let ring=0;;ring++) | source:'rail-corridor-tiny' | const bufferKm=Math.max(3.0,Math.min(5.0,2.8+distKm*0.45)) | const detourLimit=distKm<8?Math.max(distKm*2.2,distKm+2.0)
// OpenRailwayMap data integration via Overpass API — ORM Direct architecture
// Uses OSM way graph directly as the game's routing infrastructure.
// No conversion to intermediate tronçons — the OSM graph IS the network.
import { segmentsFromRoute, simulateProfile } from './train-physics.js';
import type { RoutePoint } from './train-physics.js';

// Routing must only use Overpass instances with GLOBAL data coverage.
// Do not add regional instances here (e.g. overpass.osm.ch is Switzerland-only):
// a valid empty response outside their coverage looks like "no railway" and can
// incorrectly kill a perfectly valid route in France/Germany/etc.
const OVERPASS_URLS: string[] = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// v1.1.49 — short-distance emergency source. The main OSM map API is not a
// replacement for Overpass and must never be used for continent-scale imports,
// but it is ideal for a tiny station throat / track picker bbox when public
// Overpass instances are temporarily unavailable.
const OSM_MAIN_MAP_URL = 'https://api.openstreetmap.org/api/0.6/map.json';

// HOTFIX3 — align Schedule Creator vector routing with the track-like features
// actually rendered by OpenRailwayMap's infrastructure layer. The old SC query
// only accepted rail/narrow_gauge/preserved, so a visible ORM line could be
// impossible to click or route on. Non-operational lifecycle geometries remain
// routable on explicit demand, but receive large pathfinding penalties below so
// ordinary services do not use a demolished/proposed alignment as a shortcut.
const ORM_TRACK_RAILWAY_VALUES = Object.freeze([
  'rail','narrow_gauge','preserved','light_rail','subway','tram','miniature','funicular',
  'construction','proposed','disused','abandoned','razed',
]);
const ORM_TRACK_RAILWAY_SET: Set<string> = new Set(ORM_TRACK_RAILWAY_VALUES);
const ORM_TRACK_QUERY_REGEX = `^(${ORM_TRACK_RAILWAY_VALUES.join('|')})$`;
const ORM_LIFECYCLE_VALUES = new Set(['construction','proposed','disused','abandoned','razed']);

function railwayTrackSemantics(tags: Record<string, unknown> = {}) {
  const railway = String(tags?.railway || '').trim().toLowerCase();
  if (!ORM_TRACK_RAILWAY_SET.has(railway)) return null;
  let lifecycle = 'present';
  let baseType = railway;
  if (railway === 'preserved') lifecycle = 'preserved';
  if (ORM_LIFECYCLE_VALUES.has(railway)) {
    lifecycle = railway;
    const candidates: unknown[] = [
      tags?.[`${railway}:railway`],
      tags?.[railway],
      tags?.construction,
      tags?.proposed,
      tags?.['disused:railway'],
      tags?.['abandoned:railway'],
      tags?.['razed:railway'],
    ];
    baseType = String(candidates.find((v: unknown) => String(v || '').trim()) || 'rail').trim().toLowerCase();
  }
  return { railway, lifecycle, baseType };
}

const DB_NAME = 'rail-empire-orm';
const DB_STORE = 'areas';
const DB_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep cached areas for 7 days

// SC-05 : no safety margin on auto-scheduled travel times so the schedule
// matches the physics exactly (0 %, 0 extra minute). Advance only appears if
// the player manually tightens the timetable.
function applyTravelTimeSafety(baseMin: unknown) {
  return baseMin;
}

class ORMIndexedCache {
  declare _db: IDBDatabase | null;
  declare _openPromise: Promise<boolean> | null;
  constructor() {
    this._db = null;
    this._openPromise = null;
  }

  open(): Promise<boolean> {
    if (this._db) return Promise.resolve(true);
    if (this._openPromise) return this._openPromise;
    if (typeof indexedDB === 'undefined') return Promise.resolve(false);
    const pending = new Promise<boolean>((resolve) => {
      let req: IDBOpenDBRequest;
      let settled = false;
      const finish = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
      // Restricted/file/private contexts can throw synchronously, not only emit onerror.
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch { finish(false); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (settled) { db.close(); return; }
        this._db = db;
        db.onversionchange = () => { db.close(); if (this._db === db) { this._db = null; this._openPromise = null; } };
        finish(true);
      };
      req.onerror = () => finish(false);
      req.onblocked = () => finish(false);
    });
    this._openPromise = pending;
    void pending.then(ok => { if (!ok && this._openPromise === pending) this._openPromise = null; });
    return pending;
  }

  async get(key: unknown): Promise<CacheRow | null> {
    if (!this._db) await this.open();
    if (!this._db) return null;
    const row = await new Promise<CacheRow | null>(resolve => {
      try {
        const tx = this._db!.transaction(DB_STORE, 'readonly'), req = tx.objectStore(DB_STORE).get(key as IDBValidKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = tx.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
    if (!row) return null;
    if (Date.now() - Number(row.timestamp || 0) > CACHE_MAX_AGE_MS) { this._delete(key); return null; }
    try { return await unpackCacheRow(row); } catch { return null; }
  }

  async set(key: unknown, value: Record<string, unknown>): Promise<boolean> {
    if (!this._db) await this.open();
    if (!this._db) return false;
    try {
      const row = await packCacheRow({ ...value, key:key as IDBValidKey, timestamp:Date.now() });
      if (!await cacheWriteAllowed(cacheRowBytes(row))) return false;
      return await putCacheRow(this._db, DB_STORE, row);
    } catch { return false; }
  }

  async getIntersecting(south: number, west: number, north: number, east: number, options: { limit?: number; maxWays?: number; maxScanned?: number } = {}) {
    if (!this._db) await this.open();
    if (!this._db) return [];
    const limit = Math.max(1, Number(options.limit || 24));
    const maxWays = Math.max(100, Number(options.maxWays || 16000));
    // v1.1.76 — NEVER walk the whole ORM cache for one Schedule Creator click.
    // A large Europe session can contain thousands of multi-MB records; the old
    // unbounded object-store cursor was able to spend minutes deserializing old
    // tiles before it happened to reach the requested Mannheim/Karlsruhe area.
    const maxScanned = Math.max(limit, Number(options.maxScanned || 180));
    const rows = await new Promise<CacheRow[]>((resolve) => {
      const tx = this._db!.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      let source: IDBObjectStore | IDBIndex = store;
      try { if (store.indexNames.contains('timestamp')) source = store.index('timestamp'); } catch {}
      const req = source.openCursor(null, 'prev');
      const out: CacheRow[] = [];
      let wayCount = 0, scanned = 0;
      let finished = false;
      const finish = () => { if (!finished) { finished = true; resolve(out); } };
      req.onsuccess = () => {
        if (finished) return;
        const cursor = req.result;
        if (!cursor) return finish();
        scanned++;
        const rec = cursor.value;
        const bb = rec?.bbox;
        const fresh = rec && Date.now() - Number(rec.timestamp || 0) <= CACHE_MAX_AGE_MS;
        const intersects = bb && Number(bb.north) >= south && Number(bb.south) <= north && Number(bb.east) >= west && Number(bb.west) <= east;
        if (fresh && intersects && cacheWayCount(rec) > 0) {
          out.push(rec);
          wayCount += cacheWayCount(rec);
          if (out.length >= limit || wayCount >= maxWays) return finish();
        }
        if (scanned >= maxScanned) return finish();
        cursor.continue();
      };
      req.onerror = () => finish();
      tx.onabort = () => finish();
    });
    // No await while advancing the IDB cursor: the transaction is already released here.
    const decoded: CacheRow[] = [];
    for (const row of rows) { try { decoded.push(await unpackCacheRow(row)); } catch { /* retain corrupt rows for diagnosis */ } }
    return decoded;
  }

  _delete(key: unknown) {
    if (!this._db) return;
    const tx = this._db!.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key as IDBValidKey);
  }
}

function localStorageGet(key: string) {
  try { return JSON.parse(localStorage.getItem(key) as string); } catch { return null; }
}
function localStorageKey(k: unknown) { return 'orm-area-' + k; }

function parseTagNumberList(value: unknown) {
  if (value == null || value === '') return [];
  return String(value).split(/[;,]/).map((x) => Number(String(x).trim().replace(',', '.'))).filter(Number.isFinite);
}

function parseMaxSpeedTag(value: unknown) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (raw.includes('mph')) return Math.round(n * 1.609344);
  return Math.round(n);
}

type GeoPoint = { lat: number; lon: number };
type WayPointSource = { nodeIds?: unknown[] };
type RailTile = { south: number; west: number; north: number; east: number; [key: string]: unknown };
type ProgressCallback = ((progress: Record<string, unknown>) => void) | null;

function pointSegmentDistanceKm(lat: number, lon: number, a: GeoPoint, b: GeoPoint) {
  const latScale = 111.32;
  const lonScale = Math.max(0.01, 111.32 * Math.cos(lat * Math.PI / 180));
  const ax = (a.lon - lon) * lonScale, ay = (a.lat - lat) * latScale;
  const bx = (b.lon - lon) * lonScale, by = (b.lat - lat) * latScale;
  const dx = bx - ax, dy = by - ay;
  const den = dx*dx + dy*dy;
  const t = den > 0 ? Math.max(0, Math.min(1, -(ax*dx + ay*dy)/den)) : 0;
  const px = ax + t*dx, py = ay + t*dy;
  return { distanceKm: Math.sqrt(px*px + py*py), t, lat: a.lat + (b.lat-a.lat)*t, lon: a.lon + (b.lon-a.lon)*t };
}

function wayPointKey(way: WayPointSource, index: number, point: GeoPoint) {
  const nodeId = Array.isArray(way?.nodeIds) ? way.nodeIds[index] : null;
  // Real OSM topology is node-id based. Coordinate fallback is retained for
  // synthetic/test/user geometry that has no OSM node ids.
  return nodeId != null && nodeId !== ''
    ? `osm-node:${nodeId}`
    : `${Number(point.lat).toFixed(6)},${Number(point.lon).toFixed(6)}`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Yield during very large ORM imports so a 500 km Tracer ligne does not lock the UI.
function ormYield() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function bindAbortSignal(controller: AbortController, externalSignal: AbortSignal | null | undefined) {
  if (!externalSignal) return () => {};
  const abort = () => { try { controller.abort(); } catch {} };
  if (externalSignal.aborted) abort();
  else externalSignal.addEventListener?.('abort', abort, { once: true });
  return () => { try { externalSignal.removeEventListener?.('abort', abort); } catch {} };
}

function throwIfAborted(signal: AbortSignal | null | undefined) {
  if (!signal?.aborted) return;
  const err = new Error('Schedule routing cancelled.');
  err.name = 'AbortError';
  err.code = 'ROUTE_CANCELLED';
  throw err;
}
function isRouteAbort(err: unknown) { const e=err as {name?: unknown; code?: unknown} | null; return e?.name==='AbortError' || e?.code==='ROUTE_CANCELLED'; }

// Initial bearing (degrees, 0-360) from A to B — used for turn-angle penalty
function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Smallest absolute difference between two bearings (0-180)
function angleBetween(b1: number, b2: number) {
  let d = Math.abs(b1 - b2) % 360;
  return d > 180 ? 360 - d : d;
}


function normalizeLoadingGauge(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TSI/, '').replace(/^UIC/, '');
}
function loadingGaugeCompatible(required: unknown, available: unknown) {
  const req=normalizeLoadingGauge(required), have=normalizeLoadingGauge(available);
  if(!req||!have)return true;
  if(req===have)return true;
  // Common continental hierarchy only. Unknown national profiles are never
  // guessed: they must match exactly or remain unknown upstream.
  const rank: Record<string, number>={GA:1,GB:2,GC:3};
  return rank[req]!=null && rank[have]!=null ? rank[have]>=rank[req] : false;
}

// --- Binary Heap for Dijkstra (fixes O(n²) sort bug) ---
type MinHeapItem = { d: number; key: string | number | OrmGraphEdge; to?: string; edge?: OrmGraphEdge; [key: string]: unknown };
class MinHeap {
  declare _data: MinHeapItem[];
  constructor() { this._data = []; }
  get size() { return this._data.length; }
  push(item: MinHeapItem) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) { this._data[0] = last!; this._sinkDown(0); }
    return top;
  }
  _bubbleUp(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[i].d >= this._data[p].d) break;
      [this._data[i], this._data[p]] = [this._data[p], this._data[i]];
      i = p;
    }
  }
  _sinkDown(i: number) {
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

type OrmParsedWay = ReturnType<ORMClient['parseWays']>[number];
type OrmParsedStation = ReturnType<ORMClient['_parseStations']>[number];
type OrmEdgeMetadata = ReturnType<ORMClient['_edgeMetadata']>;
type OrmGraphEdge = OrmEdgeMetadata & { from: string; to: string; dist: number; topologyStitch?: unknown };
type OrmGraphNode = { key: string; lat: number; lon: number; edges: OrmGraphEdge[] };
type OrmSpatialIndex = { cells: Map<string, OrmGraphNode[]>; cs: number };
type OrmGraph = { nodes: Map<string, OrmGraphNode>; _index?: OrmSpatialIndex; _compactEdges?: boolean };
type OrmAreaStatus = { ways: OrmParsedWay[]; ok: boolean; source: string; error: unknown };
type OrmStationStatus = { stations: OrmParsedStation[]; ok: boolean; source: string; error: unknown };
type OrmOptionProgress = (progress: Record<string, unknown>) => void;
type OrmAvoidStationPair = { latA?: unknown; lat?: unknown; lonA?: unknown; lon?: unknown; latB?: unknown; lat2?: unknown; lonB?: unknown; lon2?: unknown };
type OrmOptions = Record<string, unknown> & {
  signal?: AbortSignal | null;
  onProgress?: OrmOptionProgress | null;
  onPreparationProgress?: OrmOptionProgress | null;
  onRailGraphProgress?: OrmOptionProgress | null;
  electricSystems?: Array<{ voltage?: unknown; frequency?: unknown }>;
  gauges?: number[];
  avoidEdges?: Set<string>;
  avoidStationPairs?: OrmAvoidStationPair[];
  weather?: string | null;
  traction?: string;
  loadingGauge?: string;
  routeObjective?: string;
  absorbResident?: boolean; allowPartial?: boolean; allowSyntheticStitches?: boolean;
  forceNetwork?: boolean; forceRefresh?: boolean; localOnly?: boolean; rebuildIndex?: boolean;
  transient?: boolean; withStatus?: boolean; _scheduleExact?: boolean; allowFallback?: boolean;
  allowSignalRestrictedDirection?: boolean; compactGraphEdges?: boolean; compactStateKeys?: boolean;
  cooperative?: boolean; directed?: boolean; forbidPureBackup?: boolean; forceFreshRoute?: boolean;
  longRangeWindowed?: boolean; preserveInfrastructureMaxSpeed?: boolean;
  attemptsPerEndpoint?: number; bufferKm?: number; concurrency?: number; deadlineTs?: number;
  endpointOffset?: number; fallbackScanLimit?: number; hedgeDelayMs?: number; limit?: number;
  maxAreaDeg2?: number; maxDistanceKm?: number; maxEndpoints?: number; maxScanned?: number;
  maxSpanDeg?: number; maxSplitDepth?: number; maxTiles?: number; maxWays?: number;
  raceEndpoints?: number; radiusM?: number; targetKm?: number; timeoutMs?: number;
  _deadlineTs?: number; _longRangeFragmentDepth?: number; axleLoad?: number; brakeServiceMs2?: number;
  endMs?: number; loadFactor?: number; longRangeMaxCoarseNodes?: number; longRangeMaxCoarseSegments?: number;
  longRangeMaxCoarseWays?: number; longRangeMaxWindowSegments?: number; longRangeMaxWindowWays?: number;
  maxSpeed?: number; metreLoad?: number; prefetchBudgetMs?: number; routeBudgetMs?: number; startMs?: number;
  _sharedGraph?: unknown;
};
type OrmFetchOptions = OrmOptions & { withStatus?: boolean };
type OrmWayLike = Omit<Partial<OrmParsedWay>, 'id' | 'geometry'> & Pick<OrmParsedWay, 'id' | 'geometry'> & { layer?: unknown; bridge?: unknown; tunnel?: unknown };
type OrmAnchorSnapshot = Partial<OrmWayLike> & { wayId?: string | number; segmentIndex?: number | null };
type OrmAnchor = {
  lat: number; lon: number; snapLat?: number | null; snapLon?: number | null;
  wayId?: string | number | null; segmentIndex?: number | null; osmSnapshot?: OrmAnchorSnapshot | null;
  [key: string]: unknown;
};
type OrmResolvedAnchor = { lat: number; lon: number; wayId: string; segmentIndex: number | null; [key: string]: unknown };
type OrmLongRangeTransition = { lat: number; lon: number; nodeId?: unknown; fromWayId: string | number; toWayId: string | number };
type OrmLongRangePath = { wayIds: Array<string | number>; transitions: OrmLongRangeTransition[]; cost?: number; expanded?: number };
type OrmCursorCandidate = {
  way: OrmWayLike; segmentIndex: number; t: number; lat: number; lon: number; distanceKm: number; key?: string;
};
type OrmEndpoint = { way: OrmWayLike; p: GeoPoint; next: GeoPoint; key: string };
type OrmFetchError = Error & { code?: string; cause?: Error & { code?: string } };
type OrmFetchFailure = { tile: RailTile; error: OrmFetchError };
type OrmRoute = RoutePoint[] & {
  _resolvedAnchors?: OrmResolvedAnchor[];
  _fromScheduleRouteMemory?: boolean;
  _longRangeWindowed?: boolean;
  _dynamicRailGraphPrepared?: boolean;
  _railGraphLocal?: boolean;
  _routeObjective?: string;
  _railGraphNeighborRing?: number;
};
type OrmDynamicTileFetchArgs = { longRoute?: boolean; rescue?: boolean; legIndex?: number; legCount?: number; distanceKm?: number };
type OrmCursorRouteDiagnostics = { residentWays: number; spatialPersistentWays: number; osmMain: Array<Record<string, unknown>>; overpass: Array<Record<string, unknown>>; wideRescueWays?: number };
type OrmLongRangeDiagnostics = { mode: string; distanceKm: number; tiers: Array<Record<string, unknown>>; budgetMs: number; successTier?: unknown; successPhase?: unknown; totalWays?: number; residentWays?: number };

type ScheduleMemoryConstraint = OrmAnchor & { legIndex?: unknown; order?: unknown };
type ScheduleMemoryLocation = { id?: unknown; track?: OrmAnchor };
type ScheduleMemoryLeg = { fromLocationId?: unknown; toLocationId?: unknown; routePoints?: OrmRoute };
type ScheduleMemoryPath = {
  legs?: ScheduleMemoryLeg[]; constraints?: ScheduleMemoryConstraint[]; error?: unknown;
  resolvedRevision?: unknown; topologyRevision?: unknown;
};
type ScheduleMemoryVersion = {
  locations?: ScheduleMemoryLocation[]; outboundPath?: ScheduleMemoryPath; state?: string; performanceProfile?: OrmOptions;
};
type ScheduleMemoryManager = { schedules?: Array<{ versions?: ScheduleMemoryVersion[] }> };

export class ORMClient {

  constructor() {
    this.routeCache = new Map();
    this.areaCache = new Map(); // bbox key -> raw ways array
    // v1.1.57 — last-known-good Schedule Creator routes. This is separate from
    // routeCache because loading new OSM tiles invalidates routeCache, while a
    // previously resolved real OSM route remains useful during a network outage.
    this._cursorRouteMemory = new Map();
    // HOTFIX6 — route memory is an accelerator, never a reason to OOM. Long
    // routes are compacted and retained under a point budget instead of 96
    // arbitrarily huge arrays.
    this._cursorRouteMemoryMaxEntries = 48;
    this._cursorRouteMemoryMaxPoints = 30000;
    this._cursorRouteMemoryMaxSinglePoints = 12000;
    // v1.1.76 — short-lived exact-leg cache for Schedule Creator VIA chains.
    // Additive OSM tile loads must not force Karlsruhe→Mannheim to be recomputed
    // from zero every time the player adds one more exact VIA.
    this._scheduleExactLegCache = new Map();
    this._scheduleExactLegCacheMaxEntries = 96;
    this._scheduleExactLegCacheMaxPoints = 18000;
    this._scheduleExactLegCacheMaxSinglePoints = 8000;
    // v1.1.83 — one Schedule routing action has a hard wall-clock budget.
    // The budget only limits network acquisition/rescue work; it never authorizes
    // a synthetic/approximate railway geometry.
    this._scheduleRouteBudgetMs = 180000;
    // v1.1.83 — distribute parallel corridor tiles across the global Overpass
    // endpoints instead of queueing every tile behind the same first server.
    this._scheduleEndpointRotation = 0;
    // v1.1.84 — one active Schedule journey can pre-warm a corridor shared by
    // all of its legs. This is real OSM topology only; it is never a coarse
    // replacement for the final exact route.
    this._scheduleJourneyPrefetch = null;
    // v1.1.74 — monotonically changes whenever resident railway topology changes.
    // Route-memory keys include it so an old Schedule route cannot shadow newly
    // loaded/updated OSM geometry in the same session.
    this._topologyEpoch = 0;
    this.loading = false;

    // Persistent cache (IndexedDB + localStorage fallback) for offline / slow network
    this._persistentCache = new ORMIndexedCache();
    this._cacheReady = this._persistentCache.open();

    // ORM Direct: unified graph from all loaded areas
    this._graph = null; // { nodes: Map, adjacency: Map, _index }
    this._ways = new Map(); // wayId -> way object (all loaded ways)
    this._wayBoundsCache = new WeakMap(); // v1.1.46: transient bounds for fast Schedule Creator OSM-engine overlay
    // v1.1.47 — editor-only point infrastructure cache. Railway switches are
    // OSM nodes, not ways, so the v1.1.46 line overlay could never draw them.
    this._loadedSwitchBboxes = [];
    this._switchAreaCache = new BoundedLruMap<string, unknown[]>(128, 50000,
      nodes => nodes.length, key => {
        this._loadedSwitchBboxes = this._loadedSwitchBboxes.filter((box: {key: string}) => box.key !== key);
      }); // editor-only switch cache: bounded independently of routing topology
    this._loadedBboxes = []; // areas actually resident in this JS process
    this._savedLoadedBboxes = []; // historical areas persisted by the save, not resident until refetched
    this._stationsOSM = []; // detected OSM stations
    this._stationAreaCache = new BoundedLruMap<string, unknown[]>(128, 50000, stations => stations.length);
    // Eviction affects duplicate query arrays only. Discovered world stations,
    // railway topology and persistent storage remain authoritative and intact.
    this._graphDirty = true;
      this.routeCache.clear();
    this._graphBuildPromise = null; // cooperative graph build coalescing

    // R-08 : aiguillages branchés au routage — tronçons utilisateur injectés dans le graphe
    this._userTronconProvider = null;

    // v1.1.88 SC V3 — optional local, pre-indexed OpenRailwayMap rail graph pack.
    // Schedule Creator is forbidden from acquiring topology over the network.
    this._railGraphPack = null;
    // v1.1.93 — global OSM vector railway base, persisted in normalized world
    // tiles. This is the geometry underlay; ORM data enriches it but never
    // decides whether a real OSM railway way exists.
    this._worldRailCache = null;
    this._schedulePackedGraphCache = null;
    // Keep only a modest reusable graph. A trans-European graph can contain
    // hundreds of thousands of nodes and must die after its solve instead of
    // pinning a large fraction of the browser heap.
    this._schedulePackedGraphCacheMaxWays = 12000;
    this._schedulePackedGraphCacheMaxNodes = 120000;

    // Spatial index cell size (degrees) for nearest-node queries ~2 km
    this._cellSize = 0.02;
    // Routing tuning (directed graph)
    this._serviceSpeedKmh = 30; // yards/sidings default speed cap
    this._turnPenaltyDeg = 100; // above this angle a movement counts as a reversal
    this._reversalPenaltyH = 0.08; // ~5 min for a sharp DIFFERENT-way turn; true same-way back-up remains 72 h
    this._pureBackupPenaltyH = 72; // v1.1.45: last-resort same-way back-up; finite so valid topology never looks like ORM outage
    this._switchDivergePenaltyH = 0.01; // v1.1.73: ~36 s only; geometry/travel time remains authoritative
    this._maxFallbackKm = 0;   // only fabricate straight connectors up to 1 km (R-03)
    // R-07 : plafond V160 par défaut pour le calcul d'itinéraire (matériel joueur)
    this._routingSpeedCapKmh = 160;
  }

  startScheduleDebugSession(meta: unknown = {}) {
    const now = new Date();
    this._scheduleDebugSession = {
      id:`scdiag-${now.toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(36).slice(2,8)}`,
      startedAt:now.toISOString(),
      startedMs:Date.now(),
      meta:{...(meta||{})},
    };
    this._scheduleDebugTrace = [];
    this.debugScheduleEvent('session-start',{meta:this._scheduleDebugSession.meta});
    return this._scheduleDebugSession.id;
  }

  debugScheduleEvent(event: unknown, data: unknown = {}) {
    if(!this._scheduleDebugSession)return;
    const safeError=(v: Error)=>v&&typeof v==='object'?{name:v.name||'',message:v.message||String(v),code:v.code||'',stack:String(v.stack||'').split('\n').slice(0,5).join('\n')}:v;
    const clean=(value: unknown,depth: number=0): unknown =>{
      if(depth>5)return '[depth-limit]';
      if(value instanceof Error)return safeError(value);
      if(Array.isArray(value))return value.slice(0,80).map((v: unknown) =>clean(v,depth+1));
      if(value&&typeof value==='object'){const out: Record<string, unknown>={};for(const [k,v] of Object.entries(value)){if(k==='geometry'&&Array.isArray(v)){out.geometryPoints=v.length;continue;}out[k]=clean(v,depth+1);}return out;}
      if(typeof value==='string'&&value.length>1200)return value.slice(0,1200)+'…';
      return value;
    };
    this._scheduleDebugTrace.push({
      seq:this._scheduleDebugTrace.length+1,
      at:new Date().toISOString(),
      tMs:Date.now()-Number(this._scheduleDebugSession.startedMs||Date.now()),
      event:String(event||'event'),
      data:clean(data),
    });
    if(this._scheduleDebugTrace.length>5000)this._scheduleDebugTrace.splice(0,this._scheduleDebugTrace.length-5000);
  }

  getScheduleDebugSnapshot() {
    // DIAG2: keep error serialization in this method's own scope. DIAG1
    // accidentally referenced debugScheduleEvent()'s local helper here, which
    // made export fail with `safeError is not defined`.
    const safeError = (v: __S3Struct756) => v && typeof v === 'object'
      ? { name:v.name||'', message:v.message||String(v), code:v.code||'', stack:String(v.stack||'').split('\n').slice(0,5).join('\n') }
      : v;
    return {
      schema:'rail-empire-sc-diagnostic-v1',
      session:this._scheduleDebugSession?{...this._scheduleDebugSession}:null,
      environment:{
        online:typeof navigator==='undefined'?null:navigator.onLine,
        userAgent:typeof navigator==='undefined'?'':navigator.userAgent,
        language:typeof navigator==='undefined'?'':navigator.language,
        protocol:typeof location==='undefined'?'':location.protocol,
        href:typeof location==='undefined'?'':location.href,
      },
      ormState:{
        residentWays:Number(this._ways?.size||0),
        areaMemoryEntries:Number(this.areaCache?.size||0),
        routeCacheEntries:Number(this.routeCache?.size||0),
        exactLegCacheEntries:Number(this._scheduleExactLegCache?.size||0),
        cursorRouteMemoryPoints:[...this._cursorRouteMemory.values()].reduce((n,r: __S3Struct757)=>n+Number(r?.route?.length||0),0),
        exactLegCachePoints:[...this._scheduleExactLegCache.values()].reduce((n,r: __S3Struct758)=>n+Number(r?.route?.length||0),0),
        loadedBboxes:Number(this._loadedBboxes?.length||0),
        topologyEpoch:Number(this._topologyEpoch||0),
        lastCursorRouteFailure:String(this._lastCursorRouteFailure||''),
        lastCursorRouteDiagnostics:this._lastCursorRouteDiagnostics||null,
        lastRoutingFailure:this._lastRoutingFailure?{kind:this._lastRoutingFailure.kind||'',error:safeError(this._lastRoutingFailure.error)}:null,
        lastRailTileFetchStats:this._lastRailTileFetchStats||null,
        worldRailCache:this.getWorldRailCacheStats(),
      },
      events:this._scheduleDebugTrace.map((x: Record<string, unknown>) =>({...x})),
    };
  }

  _touchTopology() {
    this._topologyEpoch = Number(this._topologyEpoch || 0) + 1;
    this._graphDirty = true;
    this.routeCache.clear();
    // Exact-leg cache is a transient optimization over the current resident topology.
    // Real Schedule route memory remains keyed by anchors/profile and survives additive streaming.
    this._scheduleExactLegCache.clear();
    this._schedulePackedGraphCache = null;
  }

  setRailGraphPack(pack: unknown) {
    this._railGraphPack = pack || null;
    this._schedulePackedGraphCache = null;
  }

  setWorldRailCache(cache: unknown) {
    this._worldRailCache = cache || null;
  }

  getWorldRailCacheStats() {
    return this._worldRailCache?.stats?.() || { coverage:'world', cellDeg:0.5, memoryTiles:0, memoryWays:0 };
  }

  getRailGraphPackStats() {
    return this._railGraphPack?.stats?.() || { prepared:false, loadedShards:0, loadedWays:0, totalShards:0, coarseNodes:0 };
  }

  _absorbLocalRailWays(ways: OrmWayLike[] = []) {
    let added = 0;
    for (const w of ways || []) {
      if (!w || w.id == null || !Array.isArray(w.geometry) || w.geometry.length < 2) continue;
      const k = String(w.id);
      if (!this._ways.has(k) && !this._ways.has(Number(k))) added++;
      this._ways.set(k, w);
    }
    if (added) this._touchTopology();
    return added;
  }

  // ============================================================
  // AREA FETCHING — loads all railway data for a bounding box
  // Also fetches railway stations/halts
  // ============================================================

  async fetchArea(south: number, west: number, north: number, east: number, options: OrmFetchOptions & { withStatus: true }): Promise<OrmAreaStatus>;
  async fetchArea(south: number, west: number, north: number, east: number, options?: OrmFetchOptions & { withStatus?: false }): Promise<OrmParsedWay[]>;
  async fetchArea(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    // v5 cache: global-instance-only railway geometry. v4 may contain regional-empty tiles from the retired Swiss fallback.
    const withStatus = !!options.withStatus;
    const transient = options.transient === true;
    const forceNetwork = options.forceNetwork === true;
    const timeoutMs = Math.max(1200, Number(options.timeoutMs || 22000));
    const attemptsPerEndpoint = Math.max(1, Number(options.attemptsPerEndpoint || 2));
    const deadlineTs = Number(options.deadlineTs || 0);
    const endpointOffset = Math.abs(Math.trunc(Number(options.endpointOffset || 0))) % OVERPASS_URLS.length;
    const maxEndpoints = Math.max(1, Math.min(OVERPASS_URLS.length, Math.trunc(Number(options.maxEndpoints || OVERPASS_URLS.length))));
    const endpointOrder = OVERPASS_URLS.map((_: unknown,i: number)=>OVERPASS_URLS[(i+endpointOffset)%OVERPASS_URLS.length]).slice(0,maxEndpoints);
    const raceEndpoints = Math.max(0, Math.min(endpointOrder.length, Math.trunc(Number(options.raceEndpoints || 0))));
    const hedgeDelayMs = Math.max(0, Math.trunc(Number(options.hedgeDelayMs || 250)));
    const externalSignal = options.signal || null;
    throwIfAborted(externalSignal);
    const debugStarted=Date.now();
    this.debugScheduleEvent('overpass-area-start',{bbox:{south,west,north,east},timeoutMs,attemptsPerEndpoint,maxEndpoints,raceEndpoints,hedgeDelayMs,endpointOffset,deadlineLeftMs:deadlineTs>0?deadlineTs-Date.now():null});
    const key = `v7-all-orm-tracks:${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
    const done = (ways: unknown, ok: unknown = true, source: unknown = 'network', error: unknown = null) =>
      withStatus ? { ways, ok, source, error } : ways;

    if (!forceNetwork && this.areaCache.has(key)){const ways=this.areaCache.get(key);this.debugScheduleEvent('overpass-area-result',{source:'memory',ok:true,ways:Number(ways?.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});return done(ways,true,'memory');}

    await this._cacheReady;
    const cached = forceNetwork ? null : await this._loadCachedArea(key);
    if (cached?.ways) {
      // Long Schedule corridors may be intentionally transient: use IndexedDB
      // as the source without duplicating hundreds of MB into _ways + areaCache.
      if(!transient){
        for (const w of cached.ways) this._ways.set(w.id, w);
        this._graphDirty = true;
        if (!this._loadedBboxes.find((b: { key: unknown }) => b.key === key)) this._loadedBboxes.push({ south, west, north, east, key, fromCache: true });
        this.areaCache.set(key, cached.ways);
      }
      this.debugScheduleEvent('overpass-area-result',{source:transient?'persistent-cache-transient':'persistent-cache',ok:true,ways:Number(cached.ways?.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});
      return done(cached.ways, true, transient?'persistent-cache-transient':'persistent-cache');
    }

    const query = `[out:json][timeout:60];way["railway"~"${ORM_TRACK_QUERY_REGEX}"](${south},${west},${north},${east});out body geom;`;
    let lastError = null;
    let sawValidResponse = false;
    const acceptNetworkData = async (data: __KPA67) => {
      if (data?.remark || data?.error) throw new Error(`Overpass payload error: ${data.remark || data.error}`);
      sawValidResponse = true;
      const ways = this.parseWays(data as { elements?: OverpassElement[] });
      if(!transient){
        for (const w of ways) this._ways.set(w.id, w);
        this._touchTopology();
        if (!this._loadedBboxes.find((b: { key: unknown }) => b.key === key)) this._loadedBboxes.push({ south, west, north, east, key });
        this.areaCache.set(key, ways);
        await this._saveCachedArea(key, { bbox: { south, west, north, east }, ways, stations: [] });
      }
      this.debugScheduleEvent('overpass-area-result',{source:transient?'network-transient':'network',ok:true,ways:Number(ways.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});
      return done(ways, true, transient?'network-transient':'network');
    };

    // HOTFIX14 — if the initial hedged pair fails, keep a tiny fresh failover
    // deadline for the configured serial backup. This prevents event-loop stalls
    // from consuming the entire global budget before endpoint #3 is even attempted.
    // The grace is strictly bounded (<= 300 ms) and exists only after hedge failure.
    let serialFailoverDeadlineTs = deadlineTs;

    // v1.1.84 — Schedule routing may hedge the same bounded bbox across two
    // Overpass instances. The first valid payload wins and the loser is aborted.
    // This removes the historical 3 x timeout serial wait without changing the
    // OSM geometry/query at all. Ordinary bulk imports keep the serial policy.
    if (raceEndpoints >= 2) {
      const controllers: Set<AbortController> = new Set();
      let raceDone = false;
      const requestOne = async (url: string, slot: number) => {
        if (slot > 0 && hedgeDelayMs) await new Promise((r) => setTimeout(r, slot * hedgeDelayMs));
        if (raceDone) { const e=new Error('Overpass hedge cancelled.');e.name='AbortError';throw e; }
        let localError = null;
        for (let attempt = 0; attempt < attemptsPerEndpoint; attempt++) {
          const remaining = deadlineTs > 0 ? deadlineTs - Date.now() : Infinity;
          if (remaining <= 0) { const e=new Error('Schedule routing time budget exhausted.');e.code='TIME_BUDGET';throw e; }
          if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(350 + attempt * 200, Math.max(0, remaining))));
          if (raceDone) { const e=new Error('Overpass hedge cancelled.');e.name='AbortError';throw e; }
          throwIfAborted(externalSignal);
          const controller = new AbortController();controllers.add(controller);
          const unbindExternal = bindAbortSignal(controller, externalSignal);
          const remainingNow = deadlineTs > 0 ? deadlineTs - Date.now() : Infinity;
          const requestTimeout = Number.isFinite(remainingNow) ? Math.max(50, Math.min(timeoutMs, remainingNow)) : timeoutMs;
          let activeTimeout: ReturnType<typeof setTimeout> | null = null;
          let timeoutPhase = '';
          const armTimeout = (ms: number, phase: string) => {
            if (activeTimeout) clearTimeout(activeTimeout);
            timeoutPhase = '';
            activeTimeout = setTimeout(() => { timeoutPhase = phase; controller.abort(); }, ms);
          };
          try {
            const httpStarted=Date.now();
            armTimeout(requestTimeout, 'headers');
            this.debugScheduleEvent('overpass-http-start',{mode:'hedge',url,slot,attempt:attempt+1,timeoutMs:requestTimeout,bbox:{south,west,north,east}});
            const resp = await fetch(url, {method:'POST',body:'data='+encodeURIComponent(query),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:controller.signal});
            if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout=null; }
            timeoutPhase = '';
            this.debugScheduleEvent('overpass-http-response',{mode:'hedge',url,slot,attempt:attempt+1,status:Number(resp.status),ok:!!resp.ok,ms:Date.now()-httpStarted});
            if (resp.status === 429 || resp.status === 504) throw new Error(`Overpass ${resp.status}`);
            if (!resp.ok) throw new Error(`Overpass ${resp.status}`);

            // FIX-DIAG2: timeoutMs is a HEADER/acquisition budget, not a deadline for
            // downloading + decoding a valid HTTP 200 payload. Field diagnostics
            // showed Maps.Mail.ru returning 200 at 3.466 s, then being aborted at
            // 5 s while response.json() was still consuming the body. Give a valid
            // response a separate body budget, still capped by the global route deadline.
            const bodyRemaining = deadlineTs > 0 ? deadlineTs - Date.now() : Infinity;
            // HOTFIX14 — once valid HTTP headers arrived inside the request phase,
            // always give body/decode a tiny bounded grace window. Under CPU load the
            // global route deadline can expire between the 200 response and json(),
            // which previously made diagnostics flip nondeterministically between
            // TIME_BUDGET and OVERPASS_BODY_TIMEOUT. The grace is capped at 50 ms
            // when the global budget is already exhausted, so it cannot hang routing.
            const bodyBudgetBase = Math.max(8000, timeoutMs * 3);
            const bodyTimeoutMs = Number.isFinite(bodyRemaining) ? Math.max(50, Math.min(bodyBudgetBase, Math.max(0, bodyRemaining))) : bodyBudgetBase;
            const bodyStarted=Date.now();
            armTimeout(bodyTimeoutMs, 'body');
            this.debugScheduleEvent('overpass-body-start',{mode:'hedge',url,slot,attempt:attempt+1,timeoutMs:bodyTimeoutMs});
            const data = await resp.json();
            if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout=null; }
            timeoutPhase = '';
            this.debugScheduleEvent('overpass-body-complete',{mode:'hedge',url,slot,attempt:attempt+1,ms:Date.now()-bodyStarted,elements:Number(data?.elements?.length||0)});
            if (data?.remark || data?.error) throw new Error(`Overpass payload error: ${data.remark || data.error}`);
            return {data,url};
          } catch (rawError) {
            let e=rawError as Error & { code?: string };
            if (e?.name==='AbortError' && timeoutPhase && !externalSignal?.aborted && !raceDone) {
              const t=new Error(`Overpass ${timeoutPhase} timeout`);
              t.name='TimeoutError';
              t.code=timeoutPhase==='body'?'OVERPASS_BODY_TIMEOUT':'OVERPASS_HEADER_TIMEOUT';
              e=t;
            }
            localError=e;
            this.debugScheduleEvent(raceDone&&(rawError as { name?: string })?.name==='AbortError'?'overpass-http-cancelled':'overpass-http-error',{mode:'hedge',url,slot,attempt:attempt+1,error:e});
          }
          finally { if (activeTimeout) clearTimeout(activeTimeout);unbindExternal();controllers.delete(controller); }
        }
        throw localError || new Error('Overpass hedge failed.');
      };
      try {
        const winner = await Promise.any(endpointOrder.slice(0,raceEndpoints).map((url: string,i: number)=>requestOne(url,i)));
        raceDone = true; for (const c of controllers) try{c.abort();}catch{}
        return await acceptNetworkData(winner.data);
      } catch (e) {
        raceDone = true; for (const c of controllers) try{c.abort();}catch{}
        const errs = (e as { errors?: unknown[] })?.errors || [];
        lastError = errs.find((x: unknown) =>(x as {code?: string})?.code==='TIME_BUDGET') || errs.find((x: unknown) =>(x as {name?: string})?.name!=='AbortError') || e;
        const hasSerialBackup = endpointOrder.length > raceEndpoints;
        // A hedge-side TIME_BUDGET caused by scheduler pressure must not suppress
        // a configured serial backup. If endpoint #3 exists, give it the bounded
        // failover grace below; only surface TIME_BUDGET when there is no backup
        // left to try. This makes the failover contract deterministic under load.
        if ((lastError as (Error & { code?: string }) | null)?.code === 'TIME_BUDGET' && !hasSerialBackup) return done([], false, 'failed', lastError);
        console.warn('ORM railway hedged fetch failed:', (lastError as Error | null)?.message || lastError);
        if (deadlineTs > 0 && hasSerialBackup) {
          const failoverGraceMs = Math.min(300, Math.max(120, Math.round(timeoutMs * 0.25)));
          serialFailoverDeadlineTs = Math.max(deadlineTs, Date.now() + failoverGraceMs);
        }
        // SC HOTFIX: a failed hedge is not the end of the configured endpoint list.
        // Continue with any remaining endpoint(s) serially instead of returning a
        // false network outage while a third global instance is still available.
        if (!hasSerialBackup) {
          this.debugScheduleEvent('overpass-area-result',{source:'failed',ok:false,ways:0,ms:Date.now()-debugStarted,bbox:{south,west,north,east},error:lastError});
          return done([], false, 'failed', lastError);
        }
      }
    }

    const serialEndpointOrder = raceEndpoints >= 2 ? endpointOrder.slice(raceEndpoints) : endpointOrder;
    for (const url of serialEndpointOrder) {
      for (let attempt = 0; attempt < attemptsPerEndpoint; attempt++) {
        let unbindExternal = () => {};
        let activeTimeout: ReturnType<typeof setTimeout> | null = null;
        let timeoutPhase = '';
        try {
          const remaining = serialFailoverDeadlineTs > 0 ? serialFailoverDeadlineTs - Date.now() : Infinity;
          if (remaining <= 0) {
            const budgetErr = new Error('Schedule routing time budget exhausted.');
            budgetErr.code = 'TIME_BUDGET';
            lastError = budgetErr;
            break;
          }
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, Math.min(700 + attempt * 300, Math.max(0, remaining))));
          }
          const remainingNow = serialFailoverDeadlineTs > 0 ? serialFailoverDeadlineTs - Date.now() : Infinity;
          if (remainingNow <= 0) {
            const budgetErr = new Error('Schedule routing time budget exhausted.');
            budgetErr.code = 'TIME_BUDGET';
            lastError = budgetErr;
            break;
          }
          throwIfAborted(externalSignal);
          const controller = new AbortController();
          unbindExternal = bindAbortSignal(controller, externalSignal);
          // Serial failover uses the same two-phase timeout contract as the hedge:
          // one bounded budget for headers, then a separate body/decode budget.
          // Without this, the third backup endpoint could return HTTP 200 and leave
          // Schedule Creator stuck forever inside response.json().
          const requestTimeout = Number.isFinite(remainingNow) ? Math.max(50, Math.min(timeoutMs, remainingNow)) : timeoutMs;
          const armTimeout = (ms: number, phase: string) => {
            if (activeTimeout) clearTimeout(activeTimeout);
            timeoutPhase = '';
            activeTimeout = setTimeout(() => { timeoutPhase = phase; controller.abort(); }, ms);
          };
          const httpStarted=Date.now();
          armTimeout(requestTimeout, 'headers');
          this.debugScheduleEvent('overpass-http-start',{mode:'serial',url,attempt:attempt+1,timeoutMs:requestTimeout,bbox:{south,west,north,east}});
          const resp = await fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: controller.signal,
          });
          if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout=null; }
          timeoutPhase = '';
          this.debugScheduleEvent('overpass-http-response',{mode:'serial',url,attempt:attempt+1,status:Number(resp.status),ok:!!resp.ok,ms:Date.now()-httpStarted});
          if (resp.status === 429 || resp.status === 504) throw new Error(`Overpass ${resp.status}`);
          if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
          const bodyRemaining = serialFailoverDeadlineTs > 0 ? serialFailoverDeadlineTs - Date.now() : Infinity;
          // HOTFIX14 — valid 2xx headers get the same tiny bounded body/decode grace
          // in serial failover, keeping the error phase stable without relaxing the
          // route budget by more than the 50 ms minimum timeout quantum.
          const bodyBudgetBase = Math.max(8000, timeoutMs * 3);
          const bodyTimeoutMs = Number.isFinite(bodyRemaining) ? Math.max(50, Math.min(bodyBudgetBase, Math.max(0, bodyRemaining))) : bodyBudgetBase;
          const bodyStarted=Date.now();
          armTimeout(bodyTimeoutMs, 'body');
          this.debugScheduleEvent('overpass-body-start',{mode:'serial',url,attempt:attempt+1,timeoutMs:bodyTimeoutMs});
          const data = await resp.json();
          if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout=null; }
          timeoutPhase = '';
          this.debugScheduleEvent('overpass-body-complete',{mode:'serial',url,attempt:attempt+1,ms:Date.now()-bodyStarted,elements:Number(data?.elements?.length||0)});
          unbindExternal();
          return await acceptNetworkData(data);
        } catch (rawError) {
          let e=rawError as Error & { code?: string };
          if (e?.name==='AbortError' && timeoutPhase && !externalSignal?.aborted) {
            const t=new Error(`Overpass ${timeoutPhase} timeout`);
            t.name='TimeoutError';
            t.code=timeoutPhase==='body'?'OVERPASS_BODY_TIMEOUT':'OVERPASS_HEADER_TIMEOUT';
            e=t;
          }
          if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout=null; }
          try { unbindExternal(); } catch {}
          lastError = e;
          this.debugScheduleEvent('overpass-http-error',{mode:'serial',url,attempt:attempt+1,error:e});
          if (isRouteAbort(rawError) && externalSignal?.aborted) throw rawError;
          console.warn(`ORM railway fetch ${url} attempt ${attempt + 1} failed:`, e.message || e);
        }
      }
    }

    if (sawValidResponse) return done([], true, 'network-empty');
    console.warn('ORM railway fetch failed on all endpoints:', lastError);
    this.debugScheduleEvent('overpass-area-result',{source:'failed',ok:false,ways:0,ms:Date.now()-debugStarted,bbox:{south,west,north,east},error:lastError});
    return done([], false, 'failed', lastError);
  }

  _tileBbox(south: number, west: number, north: number, east: number, targetKm: number = 35) {
    const midLat = (south + north) / 2;
    const latStep = Math.max(0.04, targetKm / 111.32);
    const lonStep = Math.max(0.04, targetKm / Math.max(20, 111.32 * Math.cos(midLat * Math.PI / 180)));
    const rows = Math.max(1, Math.ceil((north - south) / latStep));
    const cols = Math.max(1, Math.ceil((east - west) / lonStep));
    const dLat = (north - south) / rows;
    const dLon = (east - west) / cols;
    const overlapLat = Math.min(0.012, dLat * 0.08);
    const overlapLon = Math.min(0.018, dLon * 0.08);
    const tiles: RailTile[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({
          south: Math.max(-90, south + r * dLat - (r ? overlapLat : 0)),
          north: Math.min(90, south + (r + 1) * dLat + (r < rows - 1 ? overlapLat : 0)),
          west: Math.max(-180, west + c * dLon - (c ? overlapLon : 0)),
          east: Math.min(180, west + (c + 1) * dLon + (c < cols - 1 ? overlapLon : 0)),
          r, c, rows, cols,
        });
      }
    }
    return tiles;
  }

  _corridorTiles(fromLat: number, fromLon: number, toLat: number, toLon: number, targetKm: number = 20, bufferKm: number = 18) {
    const distKm = Math.max(0.001, haversine(fromLat, fromLon, toLat, toLon));
    const steps = Math.max(1, Math.ceil(distKm / targetKm));
    const tiles: RailTile[] = [];
    // v1.1.93 — world coverage: interpolate longitude through the shortest arc,
    // not numerically through Greenwich when a route crosses the antimeridian.
    let dLon=Number(toLon)-Number(fromLon);
    if(dLon>180)dLon-=360;else if(dLon<-180)dLon+=360;
    const wrap=(x: number)=>{while(x<-180)x+=360;while(x>=180)x-=360;return x;};
    const pushTile=(aLat: number,aLon: number,bLat: number,bLon: number,i: unknown,part: unknown='')=>{
      const midLat=(aLat+bLat)/2,latPad=bufferKm/111.32;
      const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
      tiles.push({south:Math.max(-90,Math.min(aLat,bLat)-latPad),north:Math.min(90,Math.max(aLat,bLat)+latPad),west:Math.max(-180,Math.min(aLon,bLon)-lonPad),east:Math.min(180,Math.max(aLon,bLon)+lonPad),corridor:true,i,total:steps,part});
    };
    for (let i = 0; i < steps; i++) {
      const t0=i/steps,t1=(i+1)/steps;
      const aLat=fromLat+(toLat-fromLat)*t0,bLat=fromLat+(toLat-fromLat)*t1;
      const aRaw=Number(fromLon)+dLon*t0,bRaw=Number(fromLon)+dLon*t1;
      const aLon=wrap(aRaw),bLon=wrap(bRaw);
      if(Math.abs(aLon-bLon)>180){
        // One short segment straddles ±180°. Split it into two legal OSM bboxes.
        const positive=aLon>0?aLon:bLon,negative=aLon<0?aLon:bLon;
        pushTile(aLat,positive,bLat,180-1e-9,i,'dateline-east');
        pushTile(aLat,-180,bLat,negative,i,'dateline-west');
      }else pushTile(aLat,aLon,bLat,bLon,i);
    }
    return tiles;
  }

  _splitTile(tile: RailTile) {
    const latSpan = tile.north - tile.south;
    const lonSpanKm = (tile.east - tile.west) * Math.max(20, 111.32 * Math.cos(((tile.south + tile.north) / 2) * Math.PI / 180));
    const latSpanKm = latSpan * 111.32;
    if (latSpanKm >= lonSpanKm) {
      const m = (tile.south + tile.north) / 2;
      return [{ ...tile, north: m }, { ...tile, south: m }];
    }
    const m = (tile.west + tile.east) / 2;
    return [{ ...tile, east: m }, { ...tile, west: m }];
  }

  async _fetchRailTileResilient(tile: RailTile, depth: number = 0, options: OrmOptions = {}): Promise<OrmParsedWay[]> {
    const maxSplitDepth = Math.max(0, Number(options.maxSplitDepth ?? 3));
    const raw = await this.fetchArea(tile.south, tile.west, tile.north, tile.east, {
      withStatus: true,
      timeoutMs:options.timeoutMs,
      attemptsPerEndpoint:options.attemptsPerEndpoint,
      deadlineTs:options.deadlineTs,
      endpointOffset:options.endpointOffset,
      // v1.1.85 — do not drop the Schedule hedged-request policy here. v1.1.84
      // passed these options into fetchRailwayTiles(), but this wrapper silently
      // discarded them, so tiles still waited on old serial network behaviour.
      maxEndpoints:options.maxEndpoints,
      raceEndpoints:options.raceEndpoints,
      hedgeDelayMs:options.hedgeDelayMs,
      signal:options.signal,
      transient:options.transient===true,
      forceNetwork:options.forceNetwork===true,
    });
    const res = (Array.isArray(raw) ? { ways: raw, ok: true, source: 'compat', error: null } : raw) as OrmAreaStatus;
    if (res.ok) return res.ways;
    if (res.error && typeof res.error === 'object' && (res.error as { code?: unknown }).code === 'TIME_BUDGET') throw res.error;
    // A busy Overpass server often accepts the same area once split smaller.
    if (depth < maxSplitDepth) {
      const halves = this._splitTile(tile);
      const out: OrmParsedWay[] = [];
      for (const half of halves) {
        const items = await this._fetchRailTileResilient(half, depth + 1, options);
        for (const item of items) out.push(item);
      }
      return out;
    }
    const err = new Error('Impossible de récupérer une tuile ferroviaire après tous les serveurs et redécoupages.');
    err.cause = res.error;
    err.ormTile = tile;
    throw err;
  }

  async fetchRailwayTiles(tiles: RailTile[], onProgress: ProgressCallback = null, options: OrmOptions = {}) {
    const byId = new Map();
    const failures: OrmFetchFailure[] = [];
    let next = 0, doneCount = 0;
    const worker = async () => {
      while (true) {
        throwIfAborted(options.signal);
        const i = next++;
        if (i >= tiles.length) return;
        try {
          if (Number(options.deadlineTs||0) > 0 && Date.now() >= Number(options.deadlineTs)) {
            const e=new Error('Schedule routing time budget exhausted.');e.code='TIME_BUDGET';throw e;
          }
          const ways = await this._fetchRailTileResilient(tiles[i], 0, {
            ...options,
            endpointOffset:(Number(options.endpointOffset||0)+i)%OVERPASS_URLS.length,
          });
          for (const w of ways) byId.set(w.id, w);
        } catch (e) {
          // A global Schedule deadline is authoritative: do not churn through the
          // remaining tile queue after the 180 s contract has expired.
          if ((e as { code?: string })?.code === 'TIME_BUDGET' || isRouteAbort(e)) throw e;
          if (!options.allowPartial) throw e;
          failures.push({tile:tiles[i],error:e as OrmFetchError});
        }
        doneCount++;
        onProgress?.({ phase: 'tracks', done: doneCount, total: tiles.length, ways: byId.size, failed:failures.length });
        await ormYield();
      }
    };
    const concurrency = Math.min(Number(options.concurrency || 3), tiles.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (failures.length) console.warn(`ORM routing: ${failures.length} tuile(s) indisponible(s), données partielles conservées.`);
    const stats: { requested: number; failed: number; ways: number }={requested:tiles.length,failed:failures.length,ways:byId.size};
    this._lastRailTileFetchStats=stats; // compatibility/diagnostics only; consumers use batch-local stats below.
    const result=[...byId.values()];
    // v1.1.86 — concurrent Schedule tile batches must not read each other's global
    // diagnostics. Attach immutable stats to the returned batch while preserving
    // the historical Array API used by every caller.
    Object.defineProperty(result,'_fetchStats',{value:Object.freeze({...stats}),enumerable:false,configurable:false,writable:false});
    // Keep the exact failed envelopes too. Long-distance routing can then heal
    // the missing pieces instead of blindly widening/re-downloading the whole
    // 300 km corridor after one transient Overpass failure.
    const frozenFailures=Object.freeze(failures.map(({tile,error})=>Object.freeze({
      tile:Object.freeze({...tile}),
      code:String(error?.code||error?.cause?.code||''),
      message:String(error?.message||error?.cause?.message||'railway tile unavailable'),
    })));
    Object.defineProperty(result,'_fetchFailures',{value:frozenFailures,enumerable:false,configurable:false,writable:false});
    return result;
  }

  // v1.1.94 — empty world cells need independent confirmation. A single
  // syntactically-valid Overpass HTTP 200 with zero railway ways is treated as
  // suspicious, never as permanent truth. A second global endpoint must also
  // report zero before a short-lived negative cache record is allowed.
  async _fetchWorldRailTileVerified(tile: RailTile, options: OrmOptions = {}, ordinal: number = 0) {
    const baseOffset=(Number(options.endpointOffset||0)+Number(ordinal||0))%OVERPASS_URLS.length;
    const first=await this._fetchRailTileResilient(tile,0,{...options,transient:true,forceNetwork:true,endpointOffset:baseOffset});
    if(Array.isArray(first)&&first.length)return {ways:first,emptyVerified:false,emptyConfirmations:0,recoveredFromEmpty:false};

    let emptyConfirmations=1,lastError=null;
    for(let step=1;step<OVERPASS_URLS.length;step++){
      throwIfAborted(options.signal);
      try{
        const raw=await this.fetchArea(tile.south,tile.west,tile.north,tile.east,{
          withStatus:true,transient:true,forceNetwork:true,
          timeoutMs:options.timeoutMs,attemptsPerEndpoint:1,deadlineTs:options.deadlineTs,
          endpointOffset:(baseOffset+step)%OVERPASS_URLS.length,maxEndpoints:1,raceEndpoints:0,hedgeDelayMs:0,signal:options.signal,
        });
        const res=(Array.isArray(raw)?{ways:raw,ok:true,source:'compat',error:null}:raw) as OrmAreaStatus;
        if(!res?.ok){lastError=res?.error||lastError;continue;}
        if(Array.isArray(res.ways)&&res.ways.length){
          this.debugScheduleEvent('world-rail-empty-recovered',{tile,emptyConfirmations,recoveredWays:res.ways.length,source:res.source});
          return {ways:res.ways,emptyVerified:false,emptyConfirmations,recoveredFromEmpty:true};
        }
        emptyConfirmations++;
        if(emptyConfirmations>=2){
          this.debugScheduleEvent('world-rail-empty-verified',{tile,emptyConfirmations});
          return {ways:[],emptyVerified:true,emptyConfirmations,recoveredFromEmpty:false};
        }
      }catch(e){
        if((e as { code?: string })?.code==='TIME_BUDGET'||isRouteAbort(e))throw e;
        lastError=e;
      }
    }
    const err=new Error('Réponse OSM vide non confirmée : la tuile reste non validée et sera retentée.');
    err.code='WORLD_RAIL_EMPTY_UNVERIFIED';err.cause=lastError;err.ormTile=tile;
    throw err;
  }

  // v1.1.93 — worldwide OSM railway underlay. Requested route envelopes are
  // normalised to a deterministic 0.5° global grid and persisted indefinitely
  // in WorldRailCache. The first player to visit an area still needs OSM/Overpass;
  // every later route can use the exact vector railway geometry offline.
  async fetchWorldRailwayTiles(envelopes: RailTile[], onProgress: ProgressCallback = null, options: OrmOptions = {}) {
    if(!this._worldRailCache) return this.fetchRailwayTiles(envelopes,onProgress,options);
    const tiles=this._worldRailCache.tilesForEnvelopes(envelopes||[]);
    const byId=new Map(),failures: OrmFetchFailure[]=[];
    let next=0,done=0,cached=0,network=0;
    const mergeWay=(w: OrmWayLike)=>{
      if(!w?.id||!Array.isArray(w.geometry)||w.geometry.length<2)return;
      const id=String(w.id),overlay=this._ways.get(id)||this._ways.get(Number(id));
      // OSM base geometry is authoritative for existence. If a resident ORM
      // variant of the same OSM way carries richer tags, merge those fields on
      // top without ever deleting the base geometry/node topology.
      const merged=overlay?{...w,...overlay,geometry:overlay.geometry?.length?overlay.geometry:w.geometry,nodeIds:overlay.nodeIds?.length?overlay.nodeIds:w.nodeIds,tags:{...(w.tags||{}),...(overlay.tags||{})}}:w;
      byId.set(id,merged);
    };
    const worker=async()=>{
      for(;;){
        throwIfAborted(options.signal);
        const i=next++;if(i>=tiles.length)return;const tile=tiles[i];
        try{
          const rec=options.forceRefresh?null:await this._worldRailCache.get(tile);
          if(rec?.complete){cached++;for(const w of rec.ways||[])mergeWay(w);}
          else{
            const verified=await this._fetchWorldRailTileVerified(tile,options,i);
            const ways=verified?.ways||[];
            for(const w of ways)mergeWay(w);
            if(ways.length){
              await this._worldRailCache.put(tile,ways,{source:verified?.recoveredFromEmpty?'OpenStreetMap railway base (empty-response recovery)':'OpenStreetMap railway base',complete:true});
            }else if(verified?.emptyVerified){
              await this._worldRailCache.putVerifiedEmpty(tile,{source:'OpenStreetMap railway base — empty confirmed by independent endpoints',confirmations:verified.emptyConfirmations});
            }else{
              const e=new Error('Tuile OSM vide non validée.');e.code='WORLD_RAIL_EMPTY_UNVERIFIED';throw e;
            }
            this._worldRailCache.markNetworkTile?.(true);network++;
          }
        }catch(e){
          if((e as { code?: string })?.code==='TIME_BUDGET'||isRouteAbort(e))throw e;
          this._worldRailCache.markNetworkTile?.(false);failures.push({tile,error:e as OrmFetchError});
          if(!options.allowPartial)throw e;
        }
        done++;onProgress?.({phase:'world-osm',done,total:tiles.length,ways:byId.size,cached,network,failed:failures.length,coverage:'world'});await ormYield();
      }
    };
    const concurrency=Math.min(Math.max(1,Number(options.concurrency||3)),Math.max(1,tiles.length));
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    const out=[...byId.values()];
    const stats={requested:tiles.length,failed:failures.length,ways:out.length,cached,network,world:true};
    Object.defineProperty(out,'_fetchStats',{value:Object.freeze(stats),enumerable:false,configurable:false,writable:false});
    Object.defineProperty(out,'_fetchFailures',{value:Object.freeze(failures.map(({tile,error})=>Object.freeze({tile:Object.freeze({...tile}),code:String(error?.code||error?.cause?.code||''),message:String(error?.message||error?.cause?.message||'world OSM railway tile unavailable')}))),enumerable:false,configurable:false,writable:false});
    // HOTFIX6 — transient long-range reads are persisted in IndexedDB but must
    // not remain decoded in the WorldRailCache LRU after each batch.
    if(options.transient)this._worldRailCache.releaseMemory?.({maxTiles:6,maxWays:4000});
    // Short/regional world tiles should immediately feed the blue OSM-engine
    // overlay and exact click picker. Long routes remain transient to respect the
    // 3 GB/32-bit browser memory budget; their resolved path is snapshotted.
    if(options.absorbResident!==false && out.length<=12000)this._absorbLocalRailWays(out);
    return out;
  }

  async getCachedWorldRailwaysForEnvelopes(envelopes: unknown=[]) {
    if(!this._worldRailCache)return {ways:[],complete:false,cached:0,missing:[]};
    const r=await this._worldRailCache.cachedWaysForEnvelopes(envelopes||[]);
    const byId=new Map();for(const w of r.ways||[])if(w?.id!=null)byId.set(String(w.id),w);
    return {...r,ways:[...byId.values()]};
  }

  async refreshWorldRailwaysForEnvelopes(envelopes: RailTile[]=[], options: OrmOptions = {}) {
    if(!this._worldRailCache)return this.fetchRailwayTiles(envelopes,null,{...options,allowPartial:true});
    const cells=this._worldRailCache.tilesForEnvelopes(envelopes||[]);
    for(const c of cells)await this._worldRailCache.remove(c);
    return this.fetchWorldRailwayTiles(envelopes,null,{...options,forceRefresh:true,allowPartial:true});
  }

  async _healFailedRailwayTiles(failures: Array<RailTile | {tile?: RailTile}>=[], options: OrmOptions = {}) {
    const failed=(failures||[]).map((f: {tile?: RailTile} & Partial<RailTile>) =>f?.tile||f).filter((t): t is RailTile =>
      [t?.south,t?.west,t?.north,t?.east].every(Number.isFinite)
    );
    if(!failed.length)return [];
    const deadlineTs=Number(options.deadlineTs||0);
    if(deadlineTs>0 && deadlineTs-Date.now()<=1400)return [];
    // Retry smaller envelopes immediately. This is deliberately stronger than
    // the normal fast pass (3 endpoints, one further split), but restricted to
    // the exact holes so it does not turn a long route into a continent fetch.
    const repairTiles: RailTile[]=[];
    for(const tile of failed)repairTiles.push(...this._splitTile(tile));
    const left=deadlineTs>0?Math.max(0,deadlineTs-Date.now()):Infinity;
    return this.fetchRailwayTiles(repairTiles,null,{
      timeoutMs:Number.isFinite(left)?Math.min(4200,Math.max(1200,left-500)):4200,
      attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,
      concurrency:Math.min(3,Math.max(1,repairTiles.length)),
      maxEndpoints:OVERPASS_URLS.length,raceEndpoints:OVERPASS_URLS.length,hedgeDelayMs:160,
      deadlineTs,endpointOffset:Number(options.endpointOffset||0),signal:options.signal,
    });
  }

  async fetchRailwayTiled(south: number, west: number, north: number, east: number, onProgress: ProgressCallback = null) {
    return this.fetchRailwayTiles(this._tileBbox(south, west, north, east, 35), onProgress);
  }

  async fetchStationsArea(south: number, west: number, north: number, east: number, options: OrmFetchOptions & { withStatus: true }): Promise<OrmStationStatus>;
  async fetchStationsArea(south: number, west: number, north: number, east: number, options?: OrmFetchOptions & { withStatus?: false }): Promise<OrmParsedStation[]>;
  async fetchStationsArea(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    const withStatus = !!options.withStatus;
    // v3 station cache is independent from rail geometry and is persistent.
    // This makes 500 km imports resumable: a successful station tile is never
    // downloaded again just because another tile timed out.
    const key = `stations-v6:${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
    const done = (stations: unknown, ok: unknown = true, source: unknown = 'network', error: unknown = null) =>
      withStatus ? { stations, ok, source, error } : stations;
    if (this._stationAreaCache.has(key)) return done(this._stationAreaCache.get(key), true, 'memory');

    await this._cacheReady;
    const cached = await this._loadCachedArea(key);
    if (cached && Array.isArray(cached.stations)) {
      const stations = cached.stations.filter((st: { urbanTransit: unknown }) => !st.urbanTransit);
      this._stationAreaCache.set(key, stations);
      for (const st of stations) if (!this._stationsOSM.find((s: { id: unknown }) => s.id === st.id)) this._stationsOSM.push(st);
      return done(stations, true, 'persistent-cache');
    }

    const query = `[out:json][timeout:30];(nwr["railway"~"^(station|halt)$"](${south},${west},${north},${east});nwr["public_transport"="station"]["train"="yes"](${south},${west},${north},${east}););out tags center;`;
    let lastError = null;
    let sawValidResponse = false;
    for (const url of OVERPASS_URLS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt) await new Promise((r) => setTimeout(r, 600));
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (resp.status === 429 || resp.status === 504) { lastError = new Error(`Overpass ${resp.status}`); continue; }
          if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
          const data = await resp.json();
          if (data?.remark || data?.error) throw new Error(`Overpass query error: ${data.remark || data.error}`);
          sawValidResponse = true;
          const stations = this._parseStations(data).filter((st) => !st.urbanTransit);
          this._stationAreaCache.set(key, stations);
          for (const st of stations) if (!this._stationsOSM.find((s: { id: unknown }) => s.id === st.id)) this._stationsOSM.push(st);
          // Persist valid empty tiles too. Empty is a valid OSM result, not a failure.
          await this._saveCachedArea(key, { bbox: { south, west, north, east }, ways: [], stations });
          return done(stations, true, 'network');
        } catch (e) {
          lastError = e;
          console.warn(`ORM station fetch ${url} attempt ${attempt + 1} failed:`, (e as { message?: string }).message || e);
        }
      }
    }
    if (sawValidResponse) return done([], true, 'network-empty');
    console.warn('ORM station fetch failed (tracks remain usable):', lastError);
    return done([], false, 'failed', lastError);
  }

  async _fetchStationTileResilient(tile: RailTile, depth: number = 0) {
    const raw = await this.fetchStationsArea(tile.south, tile.west, tile.north, tile.east, { withStatus: true });
    const res = (Array.isArray(raw) ? { stations: raw, ok: true, source: 'compat', error: null } : raw) as OrmStationStatus;
    if (res.ok) return res.stations;

    // Station metadata is allowed to subdivide more aggressively than track
    // geometry. A failed metadata tile must never take the game down.
    if (depth < 4) {
      const halves = this._splitTile(tile);
      const settled = await Promise.allSettled([
        this._fetchStationTileResilient(halves[0], depth + 1),
        this._fetchStationTileResilient(halves[1], depth + 1),
      ]);
      const out: unknown[] = [];
      const errors: unknown[] = [];
      for (const part of settled) {
        if (part.status === 'fulfilled') for (const item of part.value || []) out.push(item);
        else errors.push(part.reason);
      }
      if (errors.length === 0) return out;
      // Preserve successful halves BUT still propagate the missing half so the
      // caller retries it. Otherwise a half-empty/half-failed tile could be
      // mistaken for a complete empty OSM result.
      const partialErr = new Error('Sous-tuile de gares indisponible; résultats partiels conservés pour reprise.');
      partialErr.partialStations = out;
      partialErr.ormTile = tile;
      partialErr.causes = errors;
      throw partialErr;
    }

    const err = new Error('Tuile de gares temporairement indisponible après retries/redécoupages.');
    err.cause = res.error;
    err.ormTile = tile;
    throw err;
  }

  async fetchStationTiles(tiles: RailTile[], onProgress: ProgressCallback = null) {
    const byId = new Map();
    const failedTiles: RailTile[] = [];
    let next = 0, doneCount = 0;

    const absorb = (stations: unknown[] | undefined) => {
      for (const st of (stations || []) as Array<{ id: unknown; urbanTransit?: unknown }>) if (!st.urbanTransit) byId.set(st.id, st);
    };

    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= tiles.length) return;
        try {
          absorb(await this._fetchStationTileResilient(tiles[i], 0));
        } catch (e) {
          if (Array.isArray((e as { partialStations?: unknown[] })?.partialStations)) absorb((e as { partialStations?: unknown[] }).partialStations);
          failedTiles.push(tiles[i]);
          console.warn('ORM station tile postponed:', (e as { message?: string })?.message || e);
        }
        doneCount++;
        onProgress?.({ phase: 'stations', done: doneCount, total: tiles.length, stations: byId.size, failed: failedTiles.length });
        await ormYield();
      }
    };

    const concurrency = Math.min(2, tiles.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    let pending = failedTiles.slice();
    for (let round = 1; pending.length && round <= 2; round++) {
      await new Promise((r) => setTimeout(r, 900 * round));
      const retry = pending;
      pending = [];
      let rdone = 0;
      for (const tile of retry) {
        try {
          absorb(await this._fetchStationTileResilient(tile, 1));
        } catch (e) {
          if (Array.isArray((e as { partialStations?: unknown[] })?.partialStations)) absorb((e as { partialStations?: unknown[] }).partialStations);
          pending.push(tile);
        }
        rdone++;
        onProgress?.({ phase: 'stations-retry', done: rdone, total: retry.length, stations: byId.size, failed: pending.length, round });
        await ormYield();
      }
    }

    if (pending.length) {
      console.warn(`ORM stations: ${pending.length} tuile(s) restent indisponibles; import partiel conservé et reprenable.`);
      onProgress?.({ phase: 'stations-partial', done: tiles.length - pending.length, total: tiles.length, stations: byId.size, failed: pending.length });
    }
    return [...byId.values()];
  }

  async fetchStationsTiled(south: number, west: number, north: number, east: number, onProgress: ProgressCallback = null) {
    return this.fetchStationTiles(this._tileBbox(south, west, north, east, 45), onProgress);
  }

  _cursorRouteMemoryKey(anchors: OrmAnchor[] = [], opts: OrmOptions = {}) {
    const pts=(anchors||[]).map((a) =>{
      const lat=Number(a?.snapLat ?? a?.lat), lon=Number(a?.snapLon ?? a?.lon);
      const way=a?.wayId!=null?String(a.wayId):'';
      return `${Number.isFinite(lat)?lat.toFixed(5):'?'},${Number.isFinite(lon)?lon.toFixed(5):'?'}@${way}`;
    });
    const systems=(opts?.electricSystems||[]).map((x) =>`${Number(x?.voltage)||0}/${Number(x?.frequency)||0}`).sort().join(',');
    const gauges=(opts?.gauges||[]).map(Number).filter(Number.isFinite).sort((a: __KPStruct555,b: __KPStruct556)=>a-b).join(',');
    const profile=`v${Number(opts?.maxSpeed)||0}|t${String(opts?.traction||'').toLowerCase()}|e${systems}|g${gauges}|lg${normalizeLoadingGauge(opts?.loadingGauge)}|al${Number(opts?.axleLoad)||0}|ml${Number(opts?.metreLoad)||0}`;
    return `schedule-route-v7:${pts.join('>')}:${profile}`;
  }

  _cloneRememberedRoute(route: unknown) {
    if(!Array.isArray(route))return null;
    // HOTFIX6: keep only data consumed by Schedule snapshot/physics. Raw OSM
    // tag dictionaries can dwarf the geometry on a 400+ km route.
    const out=route.map((p) =>{
      const incline=p?.tags?.incline ?? p?.incline;
      const q={
        lat:Number(p?.lat),lon:Number(p?.lon),wayId:p?.wayId!=null?String(p.wayId):'',
        segmentIndex:Number.isFinite(Number(p?.segmentIndex))?Number(p.segmentIndex):null,
        maxSpeed:p?.maxSpeed??30,maxSpeedSource:p?.maxSpeedSource||'FALLBACK_30',
        maxSpeedForward:p?.maxSpeedForward??null,maxSpeedBackward:p?.maxSpeedBackward??null,
        electrified:p?.electrified??null,electrifiedMode:p?.electrifiedMode||'',
        voltage:Array.isArray(p?.voltage)?p.voltage.slice():[],frequency:Array.isArray(p?.frequency)?p.frequency.slice():[],gauge:Array.isArray(p?.gauge)?p.gauge.slice():[],
        loadingGauge:p?.loadingGauge||'',axleLoad:p?.axleLoad??null,metreLoad:p?.metreLoad??null,tracks:p?.tracks||1,
        trafficMode:p?.trafficMode||'',usage:p?.usage||'',service:p?.service||'',railway:p?.railway||'rail',
        railwayLifecycle:p?.railwayLifecycle||'present',railwayBaseType:p?.railwayBaseType||p?.railway||'rail',
        preferredDirection:p?.preferredDirection||'',bidirectional:p?.bidirectional||'',oneway:p?.oneway||'',
        signalRestrictedDirection:!!p?.signalRestrictedDirection,travelDirection:p?.travelDirection||'',
        _againstPreferredDirection:!!p?._againstPreferredDirection,trackRef:p?.trackRef||'',name:p?.name||'',ref:p?.ref||'',
        trainProtection:p?.trainProtection?{...p.trainProtection}:{},fallback:!!p?.fallback,tags:incline!=null&&incline!==''?{incline}:{},
      };
      return q;
    });
    if(Array.isArray(route._resolvedAnchors))out._resolvedAnchors=route._resolvedAnchors.map((a) =>({...a}));
    if(route._fromScheduleRouteMemory)out._fromScheduleRouteMemory=true;
    if(route._longRangeWindowed)out._longRangeWindowed=true;
    if(route._dynamicRailGraphPrepared)out._dynamicRailGraphPrepared=true;
    return out;
  }

  _trimScheduleRouteMemories(){
    let points=[...this._cursorRouteMemory.values()].reduce((n,r: __S3Struct773)=>n+Number(r?.route?.length||0),0);
    while(this._cursorRouteMemory.size>this._cursorRouteMemoryMaxEntries||points>this._cursorRouteMemoryMaxPoints){
      const key=this._cursorRouteMemory.keys().next().value;if(key===undefined)break;
      const rec=this._cursorRouteMemory.get(key);points-=Number(rec?.route?.length||0);this._cursorRouteMemory.delete(key);
    }
    let exactPoints=[...this._scheduleExactLegCache.values()].reduce((n,r: __S3Struct774)=>n+Number(r?.route?.length||0),0);
    while(this._scheduleExactLegCache.size>this._scheduleExactLegCacheMaxEntries||exactPoints>this._scheduleExactLegCacheMaxPoints){
      const key=this._scheduleExactLegCache.keys().next().value;if(key===undefined)break;
      const rec=this._scheduleExactLegCache.get(key);exactPoints-=Number(rec?.route?.length||0);this._scheduleExactLegCache.delete(key);
    }
  }

  releaseScheduleRoutingMemory({aggressive=false}: { aggressive?: boolean }={}){
    // Only transient accelerators are discarded. Persistent OSM tiles and the
    // resolved Schedule geometry remain intact.
    this.routeCache.clear();
    this._schedulePackedGraphCache=null;
    this._scheduleJourneyPrefetch=null;
    if(aggressive)this._scheduleExactLegCache.clear();else this._trimScheduleRouteMemories();
    if(aggressive&&this._graph){this._graph=null;this._graphDirty=true;}
    this._worldRailCache?.releaseMemory?.({maxTiles:aggressive?4:12,maxWays:aggressive?2500:7000});
    this._trimScheduleRouteMemories();
    return {routeCacheEntries:this.routeCache.size,cursorRoutes:this._cursorRouteMemory.size,exactLegs:this._scheduleExactLegCache.size,worldRailCache:this.getWorldRailCacheStats()};
  }

  rememberCursorRoute(anchors: OrmAnchor[], route: OrmRoute, opts: OrmOptions = {}) {
    if(!Array.isArray(route)||route.length<2||this.isFallbackRoute(route))return false;
    if(route._longRangeWindowed || route.length>this._cursorRouteMemoryMaxSinglePoints)return false;
    const key=this._cursorRouteMemoryKey(anchors,opts);
    // Delete first so replacing one huge long-range route never temporarily
    // retains old+new copies during cloning.
    this._cursorRouteMemory.delete(key);
    const copy=this._cloneRememberedRoute(route);
    if(!copy)return false;
    if(!Array.isArray(copy._resolvedAnchors)||copy._resolvedAnchors.length!==(anchors||[]).length){
      copy._resolvedAnchors=(anchors||[]).map((a) =>({
        lat:Number(a?.snapLat ?? a?.lat),lon:Number(a?.snapLon ?? a?.lon),wayId:a?.wayId!=null?String(a.wayId):'',
        segmentIndex:Number.isFinite(Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex))?Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex):null,
      }));
    }
    this._cursorRouteMemory.set(key,{route:copy,lastUsed:Date.now()});
    this._trimScheduleRouteMemories();
    return true;
  }

  recallCursorRoute(anchors: OrmAnchor[], opts: OrmOptions = {}) {
    const key=this._cursorRouteMemoryKey(anchors,opts);
    const rec=this._cursorRouteMemory.get(key);
    if(!rec?.route?.length)return null;
    rec.lastUsed=Date.now();
    const copy=this._cloneRememberedRoute(rec.route);
    if(copy)copy._fromScheduleRouteMemory=true;
    return copy;
  }

  hydrateCursorRouteMemoryFromSchedules(scheduleManager: ScheduleMemoryManager | null | undefined) {
    let count=0;
    for(const rec of scheduleManager?.schedules||[]){
      for(const ver of rec?.versions||[]){
        const locs=ver?.locations||[];
        const path=ver?.outboundPath;
        if(!path||locs.length<2||ver?.state!=='VALID'||path?.error||Number(path?.resolvedRevision||0)!==Number(path?.topologyRevision||0))continue;
        for(let i=0;i<locs.length-1;i++){
          const a=locs[i],b=locs[i+1];
          const leg=(path.legs||[]).find((l) =>l?.fromLocationId===a?.id&&l?.toLocationId===b?.id);
          if(!leg?.routePoints?.length||leg.routePoints.length<2)continue;
          const constraints=(path.constraints||[]).filter((c) =>Number(c?.legIndex||0)===i).sort((x,y)=>Number(x?.order||0)-Number(y?.order||0));
          const anchors=[a?.track,...constraints,b?.track].filter((x): x is OrmAnchor => Boolean(x));
          const route=leg.routePoints.map((p: { lat: number; lon: number; [key: string]: unknown }) =>({...p}));
          route._resolvedAnchors=anchors.map((x) =>({lat:Number(x?.snapLat ?? x?.lat),lon:Number(x?.snapLon ?? x?.lon),wayId:x?.wayId!=null?String(x.wayId):'',segmentIndex:Number.isFinite(Number(x?.segmentIndex ?? x?.osmSnapshot?.segmentIndex))?Number(x?.segmentIndex ?? x?.osmSnapshot?.segmentIndex):null}));
          if(this.rememberCursorRoute(anchors,route,{maxSpeed:ver?.performanceProfile?.maxSpeed,traction:ver?.performanceProfile?.traction,electricSystems:ver?.performanceProfile?.electricSystems,gauges:ver?.performanceProfile?.gauges,loadingGauge:ver?.performanceProfile?.loadingGauge,axleLoad:ver?.performanceProfile?.axleLoad,metreLoad:ver?.performanceProfile?.metreLoad}))count++;
        }
      }
    }
    return count;
  }

  async _loadPersistentRailwaysInBounds(south: unknown, west: unknown, north: unknown, east: unknown, options: OrmOptions = {}) {
    await this._cacheReady;
    const recs=await this._persistentCache.getIntersecting(south,west,north,east,options);
    if(!recs?.length)return [];
    const byId=new Map();
    let loadedAny=false;
    for(const rec of recs){
      const bb=rec?.bbox;
      const key=rec?.key||`persist:${bb?.south},${bb?.west},${bb?.north},${bb?.east}`;
      const ways=Array.isArray(rec?.ways)?rec.ways:[];
      if(ways.length){
        this.areaCache.set(key,ways);
        for(const w of ways){if(w?.id!=null){byId.set(String(w.id),w);this._ways.set(w.id,w);}}
        if(bb&&!this._loadedBboxes.find((b: { key: unknown }) =>b.key===key))this._loadedBboxes.push({...bb,key,fromCache:true,source:'spatial-persistent-cache'});
        loadedAny=true;
      }
    }
    if(loadedAny)this._graphDirty=true;
    return [...byId.values()];
  }

  async _loadCachedArea(key: unknown) {
    const rec = await this._persistentCache.get(key);
    if (rec) return { ways: rec.ways, stations: rec.stations };
    // One-time legacy read: migrate old cache to IndexedDB, then free localStorage.
    const legacyKey = localStorageKey(key);
    const legacy = localStorageGet(legacyKey);
    if (legacy) {
      const committed = await this._persistentCache.set(key, legacy);
      // A quota abort must not erase the only offline copy.
      if (committed) { try { localStorage.removeItem(legacyKey); } catch {} }
      return { ways: legacy.ways || [], stations: legacy.stations || [] };
    }
    return null;
  }

  async _saveCachedArea(key: unknown, payload: unknown) {
    // v1.1.8: ORM data belongs in IndexedDB only. Duplicating multi-MB tiles in
    // localStorage was exhausting the browser's tiny synchronous quota.
    await this._persistentCache.set(key, payload);
  }

  _parseOsmMainMap(data: { elements: unknown }) {
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const nodes = new Map();
    const switches: unknown[] = [];
    for (const el of elements) {
      if (el?.type !== 'node') continue;
      const lat=Number(el.lat), lon=Number(el.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const tags={...(el.tags||{})};
      nodes.set(String(el.id), { id:el.id, lat, lon, tags });
      if (tags.railway === 'switch') switches.push({
        id:el.id, lat, lon, tags, ref:tags.ref||'', localRef:tags.local_ref||'',
      });
    }
    const overpassShape: unknown[]=[];
    for (const el of elements) {
      if (el?.type !== 'way') continue;
      const tags={...(el.tags||{})};
      if (!railwayTrackSemantics(tags)) continue;
      const nodeIds=Array.isArray(el.nodes)?el.nodes.slice():[];
      const geometry: Array<{ lat: number; lon: number }>=[];
      let complete=true;
      for (const id of nodeIds) {
        const n=nodes.get(String(id));
        if (!n) { complete=false; break; }
        geometry.push({lat:n.lat,lon:n.lon});
      }
      if (!complete || geometry.length < 2) continue;
      overpassShape.push({type:'way',id:el.id,nodes:nodeIds,tags,geometry});
    }
    return { ways:this.parseWays({elements:overpassShape as OverpassElement[]}), switches };
  }

  async fetchSmallOsmMapArea(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    south=Number(south);west=Number(west);north=Number(north);east=Number(east);
    if(![south,west,north,east].every(Number.isFinite))return {ok:false,ways:[],switches:[],source:'osm-main-invalid'};
    if(south>north)[south,north]=[north,south];
    if(west>east)[west,east]=[east,west];
    const latSpan=north-south, lonSpan=east-west;
    const maxSpan=Math.max(0.005,Number(options.maxSpanDeg||0.06));
    const maxArea=Math.max(0.00001,Number(options.maxAreaDeg2||0.0045));
    // Hard safety gate: the Editing API is only a tiny-bbox rescue path.
    if(latSpan>maxSpan || lonSpan>maxSpan || latSpan*lonSpan>maxArea){
      this.debugScheduleEvent('osm-main-area-skipped',{bbox:{south,west,north,east},latSpan,lonSpan,maxSpan,maxArea,reason:'large'});
      return {ok:false,ways:[],switches:[],source:'osm-main-skipped-large'};
    }
    const debugStarted=Date.now();
    this.debugScheduleEvent('osm-main-area-start',{bbox:{south,west,north,east},timeoutMs:Number(options.timeoutMs||4500),maxSpan,maxArea});
    const key=`main-v2-all-orm-tracks:${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;
    if(this.areaCache.has(key)){const ways=this.areaCache.get(key);this.debugScheduleEvent('osm-main-area-result',{source:'memory',ok:true,ways:Number(ways?.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});return {ok:true,ways,switches:this._switchAreaCache.get(`sw:${key}`)||[],source:'osm-main-memory'};}
    await this._cacheReady;
    const cached=await this._loadCachedArea(key);
    if(cached?.ways?.length){
      for(const w of cached.ways)this._ways.set(w.id,w);
      this.areaCache.set(key,cached.ways);
      if(!this._loadedBboxes.find((b: { key: unknown }) =>b.key===key))this._loadedBboxes.push({south,west,north,east,key,fromCache:true,source:'osm-main'});
      this._graphDirty=true;
      this.debugScheduleEvent('osm-main-area-result',{source:'persistent-cache',ok:true,ways:Number(cached.ways?.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});
      return {ok:true,ways:cached.ways,switches:[],source:'osm-main-persistent-cache'};
    }
    const timeoutMs=Math.max(1800,Number(options.timeoutMs||4500));
    const externalSignal=options.signal||null;
    throwIfAborted(externalSignal);
    const url=`${OSM_MAIN_MAP_URL}?bbox=${encodeURIComponent([west,south,east,north].join(','))}`;
    let unbindExternal=()=>{};
    try{
      throwIfAborted(externalSignal);
      const controller=new AbortController();
      unbindExternal=bindAbortSignal(controller,externalSignal);
      const timeout=setTimeout(()=>controller.abort(),timeoutMs);
      this.debugScheduleEvent('osm-main-http-start',{url,bbox:{south,west,north,east},timeoutMs});
      const httpStarted=Date.now();
      const resp=await fetch(url,{method:'GET',headers:{Accept:'application/json'},signal:controller.signal});
      clearTimeout(timeout);unbindExternal();
      this.debugScheduleEvent('osm-main-http-response',{url,status:Number(resp.status),ok:!!resp.ok,ms:Date.now()-httpStarted});
      if(!resp.ok)throw new Error(`OSM main API ${resp.status}`);
      const data=await resp.json();
      const parsed=this._parseOsmMainMap(data);
      const ways=parsed.ways||[], switches=parsed.switches||[];
      // An empty main-API bbox is NOT authoritative proof that no railway exists:
      // map?bbox can omit long ways that merely cross the box without a node in it.
      // Keep the result usable, but never poison the normal Overpass cache as empty.
      if(ways.length){
        for(const w of ways)this._ways.set(w.id,w);
        this.areaCache.set(key,ways);
        if(!this._loadedBboxes.find((b: { key: unknown }) =>b.key===key))this._loadedBboxes.push({south,west,north,east,key,source:'osm-main'});
        this._touchTopology();
        await this._saveCachedArea(key,{bbox:{south,west,north,east},ways,stations:[]});
      }
      if(switches.length){
        const swKey=`sw:${key}`;
        this._switchAreaCache.set(swKey,switches);
        if(this._switchAreaCache.has(swKey)&&!this._loadedSwitchBboxes.find((b: { key: unknown }) =>b.key===swKey))this._loadedSwitchBboxes.push({south,west,north,east,key:swKey,source:'osm-main'});
      }
      this.debugScheduleEvent('osm-main-area-result',{source:'network',ok:true,ways:Number(ways.length||0),switches:Number(switches.length||0),ms:Date.now()-debugStarted,bbox:{south,west,north,east}});
      return {ok:true,ways,switches,source:'osm-main-network'};
    }catch(error){
      try{unbindExternal();}catch{}
      if(isRouteAbort(error)&&externalSignal?.aborted)throw error;
      console.warn('OSM main small-bbox fallback failed:',(error as { message?: string })?.message||error);
      this.debugScheduleEvent('osm-main-area-result',{source:'network',ok:false,ways:0,ms:Date.now()-debugStarted,bbox:{south,west,north,east},error});
      return {ok:false,ways:[],switches:[],source:'osm-main-failed',error};
    }
  }

  async fetchSmallOsmMapCorridor(fromLat: number, fromLon: number, toLat: number, toLon: number, options: OrmOptions = {}) {
    fromLat=Number(fromLat);fromLon=Number(fromLon);toLat=Number(toLat);toLon=Number(toLon);
    if(![fromLat,fromLon,toLat,toLon].every(Number.isFinite))return {ok:false,ways:[],failed:0,requested:0,source:'osm-main-corridor-invalid'};
    const distKm=Math.max(0.001,haversine(fromLat,fromLon,toLat,toLon));
    const maxDistanceKm=Math.max(1,Number(options.maxDistanceKm||12));
    if(distKm>maxDistanceKm)return {ok:false,ways:[],failed:0,requested:0,source:'osm-main-corridor-skipped-distance'};
    const targetKm=Math.max(0.8,Math.min(1.8,Number(options.targetKm||1.5)));
    const bufferKm=Math.max(0.7,Math.min(1.35,Number(options.bufferKm||Math.max(0.9,Math.min(1.2,0.85+distKm*0.06)))));
    const maxTiles=Math.max(1,Math.min(12,Math.trunc(Number(options.maxTiles||10))));
    const tiles=this._corridorTiles(fromLat,fromLon,toLat,toLon,targetKm,bufferKm);
    if(!tiles.length||tiles.length>maxTiles){
      this.debugScheduleEvent('osm-main-corridor-skipped',{distanceKm:distKm,tiles:tiles.length,maxTiles,reason:'tile-count'});
      return {ok:false,ways:[],failed:0,requested:tiles.length,source:'osm-main-corridor-skipped-tiles'};
    }
    const timeoutMs=Math.max(1800,Number(options.timeoutMs||2600));
    const concurrency=Math.max(1,Math.min(2,Math.trunc(Number(options.concurrency||2)),tiles.length));
    const externalSignal=options.signal||null;
    const merged=new Map();
    let failed=0,next=0;
    this.debugScheduleEvent('osm-main-corridor-start',{distanceKm:distKm,tiles:tiles.length,targetKm,bufferKm,timeoutMs,concurrency});
    const worker=async()=>{
      while(true){
        const idx=next++;if(idx>=tiles.length)return;
        throwIfAborted(externalSignal);
        const tile=tiles[idx];
        const res=await this.fetchSmallOsmMapArea(tile.south,tile.west,tile.north,tile.east,{
          timeoutMs,maxAreaDeg2:0.0026,maxSpanDeg:0.055,signal:externalSignal,
        });
        if(!res?.ok){failed++;continue;}
        for(const w of res?.ways||[])if(w?.id!=null)merged.set(String(w.id),w);
      }
    };
    try{await Promise.all(Array.from({length:concurrency},()=>worker()));}
    catch(e){if(isRouteAbort(e))throw e;failed++;}
    const ways=[...merged.values()];
    this.debugScheduleEvent('osm-main-corridor-result',{ok:ways.length>0,complete:failed===0,ways:ways.length,failed,requested:tiles.length,distanceKm:distKm});
    return {ok:ways.length>0,complete:failed===0,ways,failed,requested:tiles.length,source:'osm-main-corridor'};
  }

  parseWays(data: { elements?: OverpassElement[] }) {
    if (!data.elements) return [];
    return data.elements
      .filter((el: OverpassElement) => el.type === 'way' && railwayTrackSemantics(el.tags || {}) && el.geometry)
      .map((el: OverpassElement) => {
        const tags = { ...(el.tags || {}) };
        const semantics = railwayTrackSemantics(tags) || { railway:String(tags.railway||'rail'), lifecycle:'present', baseType:String(tags.railway||'rail') };
        const maxSpeedRaw = parseMaxSpeedTag(tags.maxspeed);
        const maxSpeedForward = parseMaxSpeedTag(tags['maxspeed:forward']);
        const maxSpeedBackward = parseMaxSpeedTag(tags['maxspeed:backward']);
        // Schedule Creator V2 product rule: when ORM/OSM has no usable Vmax,
        // use 30 km/h and mark it explicitly as a fallback for the player.
        const maxSpeed = maxSpeedRaw ?? 30;
        const electrifiedMode = tags.electrified || '';
        const electrified = electrifiedMode === 'no' ? false
          : (electrifiedMode ? true : null);
        return {
          id: el.id,
          railway: semantics.railway || tags.railway || 'rail',
          railwayLifecycle: semantics.lifecycle || 'present',
          railwayBaseType: semantics.baseType || semantics.railway || 'rail',
          maxSpeed,
          maxSpeedSource: maxSpeedRaw == null ? 'FALLBACK_30' : 'OSM',
          maxSpeedForward,
          maxSpeedBackward,
          electrified,
          electrifiedMode,
          voltage: parseTagNumberList(tags.voltage),
          frequency: parseTagNumberList(tags.frequency),
          gauge: parseTagNumberList(tags.gauge),
          loadingGauge: tags.loading_gauge || tags.structure_gauge || '',
          axleLoad: Number.parseFloat(tags.axle_load) || null,
          metreLoad: Number.parseFloat(tags.metre_load) || null,
          tracks: parseInt(tags.tracks) || 1,
          usage: tags.usage || '',
          service: tags.service || '',
          trafficMode: tags['railway:traffic_mode'] || '',
          preferredDirection: tags['railway:preferred_direction'] || '',
          bidirectional: tags['railway:bidirectional'] || '',
          oneway: tags.oneway || '',
          trainProtection: {
            etcs: tags['railway:etcs'] || '',
            pzb: tags['railway:pzb'] || '',
            lzb: tags['railway:lzb'] || '',
            tvm: tags['railway:tvm'] || '',
            scmt: tags['railway:scmt'] || '',
          },
          name: tags.name || '',
          ref: tags.ref || '',
          trackRef: tags['railway:track_ref'] || tags.track_ref || '',
          geometry: el.geometry!.map((p: { lat: number; lon: number }) => ({ lat: p.lat, lon: p.lon })),
          nodeIds: el.nodes || [],
          tags, // preserve every OSM/ORM railway characteristic for future gameplay checks
        };
      });
  }

  _edgeMetadata(way: OrmWayLike, forward: boolean = true) {
    const directional = forward ? way.maxSpeedForward : way.maxSpeedBackward;
    const oppositeDirectional = forward ? way.maxSpeedBackward : way.maxSpeedForward;
    // HOTFIX83 — a very common OSM pattern is a speed mapped only on one
    // direction of a physical railway way. `way.maxSpeed` is 30 when the
    // generic maxspeed tag is absent, but that 30 is only our FALLBACK_30 data
    // quality marker. It must not make the reverse direction a different line.
    // Prefer a real generic speed; if none exists, reuse the documented speed
    // from the opposite direction as the best same-way proxy.
    const genericDocumented: number | null = way.maxSpeedSource !== 'FALLBACK_30' ? Number(way.maxSpeed) : null;
    const effectiveMaxSpeed = directional ??
      (genericDocumented != null && Number.isFinite(genericDocumented) && genericDocumented > 0 ? genericDocumented : null) ??
      oppositeDirectional ?? way.maxSpeed ?? 30;
    const effectiveMaxSpeedSource = directional != null ? 'OSM_DIRECTIONAL'
      : (genericDocumented != null && Number.isFinite(genericDocumented) && genericDocumented > 0 ? (way.maxSpeedSource || 'OSM')
        : (oppositeDirectional != null ? 'OSM_OPPOSITE_DIRECTION_FALLBACK' : (way.maxSpeedSource || 'FALLBACK_30')));
    const preferred = String(way.preferredDirection || '').trim().toLowerCase();
    const bidirectional = String(way.bidirectional || '').trim().toLowerCase();
    const travelDirection = forward ? 'forward' : 'backward';
    const oneway = String(way.oneway || way.tags?.oneway || '').trim().toLowerCase();
    // v1.1.83 retains the v1.1.77 railway-direction contract: generic road
    // oneway=* is metadata only on railways and must not delete a physical rail
    // direction. An explicit railway:bidirectional prohibition remains binding.
    const railSingle = ['no','false','0'].includes(bidirectional);
    const preferredKnown = preferred === 'forward' || preferred === 'backward';
    const preferredBack = preferred === 'backward';
    // Do not derive a forbidden direction from the arbitrary orientation of an
    // OSM way when no explicit preferred_direction exists. More importantly,
    // this is a signalling/operational restriction, not a broken piece of rail.
    // Generic low-level routing may still honour it as forbidden; Schedule V2
    // can explicitly allow it at a very high cost to preserve physical topology.
    const directionForbidden = railSingle && preferredKnown && (preferredBack ? forward : !forward);
    // OpenRailwayMap preferred_direction is meaningful primarily on main tracks.
    // In stations/service tracks, or where bidirectional=regular explicitly says
    // both directions are normal operation, do not manufacture a wrong-direction
    // anomaly. When it is meaningful, keep the reverse edge routable but mark it
    // so pathfinding can strongly prefer the normal-direction parallel track.
    const directionRelevant = !way.service && (preferred === 'forward' || preferred === 'backward') && bidirectional !== 'regular';
    const againstPreferredDirection = !!directionRelevant && preferred !== travelDirection;
    return {
      maxSpeed: effectiveMaxSpeed,
      maxSpeedSource: effectiveMaxSpeedSource,
      maxSpeedForward: way.maxSpeedForward ?? null, maxSpeedBackward: way.maxSpeedBackward ?? null,
      electrified: way.electrified ?? null, electrifiedMode: way.electrifiedMode || '',
      voltage: way.voltage || [], frequency: way.frequency || [], gauge: way.gauge || [], loadingGauge: way.loadingGauge || '', axleLoad: way.axleLoad ?? null, metreLoad: way.metreLoad ?? null,
      tracks: way.tracks || 1, usage: way.usage || '', service: way.service || '', railway: way.railway || 'rail',
      railwayLifecycle: way.railwayLifecycle || railwayTrackSemantics(way.tags||{})?.lifecycle || 'present', railwayBaseType: way.railwayBaseType || railwayTrackSemantics(way.tags||{})?.baseType || way.railway || 'rail',
      trafficMode: way.trafficMode || '', preferredDirection: preferred, bidirectional, oneway, directionForbidden, signalRestrictedDirection:directionForbidden,
      trainProtection: way.trainProtection || {}, wayId: way.id, name: way.name || '', ref: way.ref || '', trackRef: way.trackRef || '',
      travelDirection, againstPreferredDirection, tags: way.tags || {},
    };
  }

  getWayById(wayId: unknown) { return this._ways.get(Number(wayId)) || this._ways.get(String(wayId)) || null; }

  async getTrackCandidates(lat: number, lon: number, options: OrmOptions = {}) {
    const radiusM = Math.max(5, Number(options.radiusM || 35));
    const limit = Math.max(1, Number(options.limit || 8));
    const radiusKm = radiusM / 1000;
    const latPad = Math.max(0.0015, radiusKm / 111.32 * 4);
    const lonPad = Math.max(0.0015, radiusKm / Math.max(20, 111.32 * Math.cos(lat * Math.PI / 180)) * 4);

    // v1.1.49 — track picking is local and must not be held hostage by Overpass.
    // 1) resident/cache geometry, 2) tiny official OSM map API bbox, 3) Overpass.
    const local=new Map();
    const absorb=(ways: OrmWayLike[])=>{for(const w of ways||[])if(w?.id!=null)local.set(String(w.id),w);};
    absorb(this.getLoadedRailwaysInBounds?.(lat-latPad*3,lon-lonPad*3,lat+latPad*3,lon+lonPad*3,{limit:5000})||[]);

    const rank=()=>{
      const out=[];
      for (const way of local.values()) {
        const g = way.geometry || [];
        let best = null;
        for (let i=0;i<g.length-1;i++) {
          const hit = pointSegmentDistanceKm(lat, lon, g[i], g[i+1]);
          if (!best || hit.distanceKm < best.distanceKm) best = { ...hit, segmentIndex:i };
        }
        if (!best || best.distanceKm > radiusKm) continue;
        out.push({
          wayId: String(way.id), distanceM: best.distanceKm*1000, snapLat: best.lat, snapLon: best.lon,
          segmentIndex: best.segmentIndex, trackRef: way.trackRef || '', name: way.name || '', ref: way.ref || '',
          maxSpeed: way.maxSpeed ?? 30, maxSpeedSource: way.maxSpeedSource || 'FALLBACK_30',
          maxSpeedForward: way.maxSpeedForward ?? null, maxSpeedBackward: way.maxSpeedBackward ?? null,
          electrified: way.electrified ?? null, electrifiedMode: way.electrifiedMode || '', voltage: way.voltage || [], frequency: way.frequency || [], gauge: way.gauge || [], loadingGauge: way.loadingGauge || '', axleLoad: way.axleLoad ?? null, metreLoad: way.metreLoad ?? null,
          usage: way.usage || '', service: way.service || '', railway: way.railway || 'rail', railwayLifecycle:way.railwayLifecycle||railwayTrackSemantics(way.tags||{})?.lifecycle||'present', railwayBaseType:way.railwayBaseType||railwayTrackSemantics(way.tags||{})?.baseType||way.railway||'rail', preferredDirection: way.preferredDirection || '', bidirectional: way.bidirectional || '', oneway:way.oneway||'',
          tags: way.tags || {}, geometry: way.geometry || [], nodeIds:way.nodeIds || [],
        });
      }
      out.sort((a: __S3Struct783,b: __S3Struct784)=>a.distanceM-b.distanceM);
      return out.slice(0,limit);
    };

    // v1.1.88 SC V3 — local-only track picking. The Schedule Creator must never
    // fall through to OSM /map or Overpass. Local static RailGraph shards and the
    // already-persisted ORM cache are the only accepted vector sources.
    if(options.localOnly){
      let packPrepared=false;
      try{
        await this._railGraphPack?.ready?.();packPrepared=!!this._railGraphPack?.prepared;
        if(packPrepared)local.clear(); // SCV3 authority: never mix stale live/cache ways with the packaged graph.
        const packWays=packPrepared?await this._railGraphPack.ensureNear(lat,lon,Math.max(0.8,radiusKm*8)):[];
        if(packWays?.length)absorb(packWays);
      }catch(e){if(isRouteAbort(e))throw e;}
      // Migration-only fallback for an old save while no static pack is installed.
      // Once a pack exists, SC V3 never mixes it with resident/IndexedDB regions.
      if(!packPrepared){
        // v1.1.93 — exact picker can reopen a previously visited WORLD OSM tile
        // directly from IndexedDB, even after F5/offline and before _ways has
        // been repopulated in this JS process.
        try{
          if(this._worldRailCache){
            const cached=await this.getCachedWorldRailwaysForEnvelopes([{south:lat-latPad*5,west:lon-lonPad*5,north:lat+latPad*5,east:lon+lonPad*5}]);
            absorb(cached?.ways||[]);
          }
        }catch{}
        try{
          const persisted=await this._loadPersistentRailwaysInBounds(lat-latPad*5,lon-lonPad*5,lat+latPad*5,lon+lonPad*5,{limit:48,maxWays:24000,maxScanned:1200});
          absorb(persisted);
        }catch{}
      }
      return rank();
    }

    let out=rank();
    // v1.1.85 — a merely *available* resident candidate is not necessarily the
    // track the player clicked. In a two-track station throat the left way may
    // already be resident while the right way (visible in the ORM raster) has not
    // yet been streamed. Returning the resident way immediately made a precise
    // click on the right track bind to the left one. Only trust resident geometry
    // without a fresh tiny-bbox read when the click is already essentially ON it.
    const residentBestM=out.length?Number(out[0].distanceM):Infinity;
    const residentClickIsUnambiguous=Number.isFinite(residentBestM)&&residentBestM<=1.25;
    if(out.length&&residentClickIsUnambiguous)return out;

    // Tiny direct OSM map read: this is the same raw vector source editors use,
    // and is intentionally constrained to the few hundred metres around a click.
    try{
      const direct=await this.fetchSmallOsmMapArea(lat-latPad,lon-lonPad,lat+latPad,lon+lonPad,{timeoutMs:1800,maxAreaDeg2:0.0002,maxSpanDeg:0.02,signal:options.signal});
      absorb(direct?.ways||[]);
      out=rank();
      if(out.length && Number(out[0].distanceM)<=1.25)return out;
    }catch(e){if(isRouteAbort(e))throw e;/* Overpass remains the final network source */}

    try {
      const res=await this.fetchArea(lat-latPad, lon-lonPad, lat+latPad, lon+lonPad,
        {withStatus:true,timeoutMs:2600,attemptsPerEndpoint:1,maxEndpoints:3,raceEndpoints:2,hedgeDelayMs:220,signal:options.signal});
      absorb(Array.isArray(res)?res:(res?.ways||[]));
    } catch(e) { if(isRouteAbort(e))throw e; /* no local candidate */ }
    return rank();
  }

  _nearestNodeKeyOnWay(graph: __S3Struct785, wayId: string | number, lat: number, lon: number) {
    const way = this.getWayById(wayId);
    if (!way || !graph) return null;
    let bestKey = null, bestDist = Infinity;
    const geom = way.geometry || [];
    for (let i=0;i<geom.length;i++) {
      const p = geom[i];
      const key = wayPointKey(way,i,p);
      if (!graph.nodes.has(key)) continue;
      const d = haversine(lat,lon,p.lat,p.lon);
      if (d < bestDist) { bestDist=d; bestKey=key; }
    }
    return bestKey;
  }

  async findRouteViaTrackBindings(fromBinding: OrmAnchor, toBinding: OrmAnchor, constraints: OrmAnchor[] = [], opts: OrmOptions | null = null) {
    const all = [fromBinding, ...(constraints || []), toBinding].filter(Boolean);
    if (all.length < 2) return null;
    // Load a resilient corridor for every requested leg so long-distance schedules
    // do not depend on a continent-sized single Overpass rectangle.
    for (let i=1;i<all.length;i++) {
      const a=all[i-1], b=all[i];
      const aLat=a.snapLat ?? a.lat, aLon=a.snapLon ?? a.lon, bLat=b.snapLat ?? b.lat, bLon=b.snapLon ?? b.lon;
      const d=haversine(aLat,aLon,bLat,bLon);
      const tiles=d>60 ? this._corridorTiles(aLat,aLon,bLat,bLon,20,18) : this._tileBbox(Math.min(aLat,bLat)-0.03,Math.min(aLon,bLon)-0.03,Math.max(aLat,bLat)+0.03,Math.max(aLon,bLon)+0.03,35);
      await this.fetchRailwayTiles(tiles);
    }
    const graph = await this._ensureGraphAsync();
    const keys = all.map((x) => this._nearestNodeKeyOnWay(graph, x.wayId as string | number, x.snapLat ?? x.lat, x.snapLon ?? x.lon));
    if (keys.some((k) =>!k)) return null;
    let route=null;
    for (let i=1;i<keys.length;i++) {
      const leg=this.dijkstra(graph,keys[i-1]!,keys[i]!,opts);
      if (!leg || leg.length<2) return null;
      route = route ? route.concat(leg.slice(1)) : leg;
    }
    return route;
  }


  // Schedule V2 cursor-anchor routing. Player clicks are geographic anchors,
  // not OSM-node ids. Route each leg on a SMALL LOCAL graph built only from the
  // railway ways fetched for that leg. This avoids rebuilding the continent-wide
  // unified graph after every click and allows snapping to the middle of an OSM
  // segment (not just to a geometry node). No synthetic fallback is ever allowed.
  _scheduleJourneyPrefetchKey(anchors: OrmAnchor[]=[]) {
    return (anchors||[]).map((a) =>{
      const lat=Number(a?.snapLat ?? a?.lat),lon=Number(a?.snapLon ?? a?.lon);
      const way=a?.wayId!=null?String(a.wayId):'';
      return `${Number.isFinite(lat)?lat.toFixed(4):'?'},${Number.isFinite(lon)?lon.toFixed(4):'?'}@${way}`;
    }).join('>');
  }

  async prefetchScheduleJourney(anchors: OrmAnchor[]=[], opts: OrmOptions = {}) {
    const pts=(anchors||[]).map((a) =>({
      ...a,lat:Number(a?.snapLat ?? a?.lat),lon:Number(a?.snapLon ?? a?.lon),
      wayId:a?.wayId!=null?String(a.wayId):''
    })).filter((a: { lat: unknown; lon: unknown }) =>Number.isFinite(a.lat)&&Number.isFinite(a.lon));
    if(pts.length<2)return {skipped:true,reason:'too-few-anchors'};
    let totalKm=0;for(let i=1;i<pts.length;i++)totalKm+=haversine(pts[i-1].lat,pts[i-1].lon,pts[i].lat,pts[i].lon);
    if(totalKm<90)return {skipped:true,reason:'short-journey',distanceKm:totalKm};
    const key=this._scheduleJourneyPrefetchKey(pts);
    const prev=this._scheduleJourneyPrefetch;
    if(prev?.key===key && prev.complete===true && Array.isArray(prev.ways) && prev.ways.length && Date.now()-Number(prev.at||0)<30*60*1000)
      return {reused:true,complete:true,distanceKm:totalKm,ways:prev.ways.length,tiles:prev.tiles||0,failed:0};

    const byTile=new Map();
    const targetKm=totalKm<220?36:(totalKm<500?42:48);
    const bufferKm=totalKm<220?18:(totalKm<500?24:28);
    for(let i=1;i<pts.length;i++){
      for(const t of this._corridorTiles(pts[i-1].lat,pts[i-1].lon,pts[i].lat,pts[i].lon,targetKm,bufferKm)){
        const tk=[t.south,t.west,t.north,t.east].map((x: unknown) =>Number(x).toFixed(4)).join(',');
        if(!byTile.has(tk))byTile.set(tk,t);
      }
    }
    const tiles=[...byTile.values()];
    const deadlineTs=Math.min(
      Number(opts?._deadlineTs||Infinity),
      Date.now()+Math.max(12000,Math.min(35000,Number(opts?.prefetchBudgetMs||35000)))
    );
    let fetched=[];
    try{
      fetched=await this.fetchRailwayTiles(tiles,null,{
        timeoutMs:4500,attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,
        concurrency:Math.min(4,Math.max(1,tiles.length)),maxEndpoints:2,
        raceEndpoints:2,hedgeDelayMs:280,
        deadlineTs:Number.isFinite(deadlineTs)?deadlineTs:0,
        endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),
        signal:opts.signal,
      });
    }catch(e){if(isRouteAbort(e))throw e;if((e as { code?: string })?.code!=='TIME_BUDGET')console.warn('Schedule journey prefetch partial:',(e as { message?: string })?.message||e);}
    const merged=new Map();
    for(const w of fetched||[])if(w?.id!=null)merged.set(String(w.id),w);
    const initialFailedCount=Number(fetched?._fetchStats?.failed ?? this._lastRailTileFetchStats?.failed ?? 0);
    let remainingFailures=Array.from(fetched?._fetchFailures||[]);
    // Compatibility with injected/legacy fetchers that expose only a failed
    // count: keep those unknown failures untrusted even though we cannot target
    // their missing envelope for hole-healing.
    let unknownFailureCount=Math.max(0,initialFailedCount-remainingFailures.length);
    // Heal only the missing prefetch tiles while the small prefetch budget still
    // has room. A partial prefetch remains useful, but a transient middle hole
    // should not force the later exact leg to rediscover the whole journey.
    if(remainingFailures.length && (!Number.isFinite(deadlineTs) || deadlineTs-Date.now()>2500)){
      try{
        const healed=await this._healFailedRailwayTiles(remainingFailures as Array<RailTile | {tile?: RailTile}>,{
          deadlineTs:Number.isFinite(deadlineTs)?deadlineTs:0,
          endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal,
        });
        for(const w of healed||[])if(w?.id!=null)merged.set(String(w.id),w);
        remainingFailures=Array.from(healed?._fetchFailures||[]);
      }catch(e){if(isRouteAbort(e))throw e;}
    }
    this._seedAnchorSnapshotWays(merged,pts);
    const failed=remainingFailures.length+unknownFailureCount;
    const complete=failed===0;
    // Partial topology may still help individual legs, but must never masquerade as a trusted complete journey cache.
    this._scheduleJourneyPrefetch={key,ways:[...merged.values()],at:Date.now(),tiles:tiles.length,distanceKm:totalKm,failed,complete};
    return {distanceKm:totalKm,ways:merged.size,tiles:tiles.length,failed,complete};
  }

  async _routeFromJourneyPrefetch(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const pref=this._scheduleJourneyPrefetch;
    if(!pref?.ways?.length)return null;
    const merged=new Map<string, OrmWayLike>();
    for(const w of pref.ways||[])if(w?.id!=null)merged.set(String(w.id),w);
    // A corridor prefetch may legitimately omit a long way crossing its first/last
    // tile. The exact clicked anchor snapshots are authoritative and must complete
    // the prefetch graph rather than causing all that downloaded topology to be discarded.
    this._seedAnchorSnapshotWays(merged,[a,b]);
    const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...merged.values()]),a,b,opts);
    return (leg?.length ?? 0)>=2&&!this.isFallbackRoute(leg)?leg:null;
  }


  // HOTFIX4 — LONG-RANGE WINDOWED Schedule routing.
  // The old dynamic bridge could stream a 400+ km corridor from the network but
  // still merged the whole corridor before building one exact point graph. That
  // retained too much geometry on 32-bit/low-memory browsers. The long-range
  // planner below separates the problem in two layers:
  //   1) a compact OSM-way topology scan chooses a REAL connected railway corridor;
  //   2) the chosen corridor is reconstructed in small exact windows on the real
  //      OSM node graph. Hidden portals never become user VIA or saved locations.
  // Distance therefore changes the number of windows, not the size of one graph.
  _scheduleLongRangeBudgetCheck(ways: OrmWayLike[]=[], opts: OrmOptions = {}) {
    const maxWays=Math.max(4000,Number(opts.longRangeMaxWindowWays||26000));
    const maxSegments=Math.max(30000,Number(opts.longRangeMaxWindowSegments||260000));
    let segments=0;
    for(const w of ways||[]){segments+=Math.max(0,(w?.geometry?.length||0)-1);if(segments>maxSegments)break;}
    if((ways?.length||0)>maxWays||segments>maxSegments){
      const requiredBytes=Math.ceil((ways?.length||0)*1250+segments*250);
      const budgetBytes=Math.ceil(maxWays*1250+maxSegments*250);
      const e=new Error(`Fenêtre RailGraph trop dense (${(ways?.length||0).toLocaleString('fr-FR')} voies / ${segments.toLocaleString('fr-FR')} segments).`);
      e.code='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';e.requiredBytes=requiredBytes;e.budgetBytes=budgetBytes;
      this._lastCursorRouteFailure='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';
      this._lastRoutingFailure={code:e.code,requiredBytes,budgetBytes,ways:ways?.length||0,segments};
      throw e;
    }
    return {ways:ways?.length||0,segments,maxWays,maxSegments};
  }

  _scheduleLongRangeId(v: unknown){
    const n=Number(v);return Number.isSafeInteger(n)?n:String(v??'');
  }

  _scheduleLongRangeWayCost(way: unknown,lengthKm: unknown=0){
    const meta=this._edgeMetadata(way as OrmParsedWay,true),service=String(meta.service||''),usage=String(meta.usage||'').toLowerCase();
    const lifecycle=String(meta.railwayLifecycle||'present').toLowerCase(),base=String(meta.railwayBaseType||meta.railway||'rail').toLowerCase();
    let factor=1;
    if(service)factor+=10;else if(usage&&usage!=='main'&&usage!=='branch')factor+=3;
    factor+=({preserved:.35,construction:2.5,proposed:7,disused:9,abandoned:15,razed:28}[lifecycle]||0);
    factor+=({light_rail:2.5,subway:4,tram:7,miniature:14,funicular:18}[base]||0);
    return Math.max(.02,Number(lengthKm)||.02)*factor;
  }

  _createScheduleLongRangeCoarseState(opts: OrmOptions = {}){
    return {ways:new Map(),adj:new Map(),nodeOwners:new Map(),wayCount:0,nodeCount:0,segmentCount:0,
      maxWays:Math.max(20000,Number(opts.longRangeMaxCoarseWays||90000)),
      maxNodes:Math.max(100000,Number(opts.longRangeMaxCoarseNodes||700000)),
      maxSegments:Math.max(150000,Number(opts.longRangeMaxCoarseSegments||1200000)),
      fetchedTiles:0,failedTiles:0};
  }

  _ingestScheduleLongRangeWays(state: __S3Struct791,ways: OrmWayLike[]=[],opts: OrmOptions = {}){
    const connect=(a: string | number,b: string | number,lat: number,lon: number,nodeId: unknown)=>{
      if(a===b||!state.ways.has(a)||!state.ways.has(b))return;
      if(!state.adj.has(a))state.adj.set(a,new Map());if(!state.adj.has(b))state.adj.set(b,new Map());
      if(!state.adj.get(a)!.has(b))state.adj.get(a)!.set(b,{lat:Number(lat),lon:Number(lon),nodeId,fromWayId:a,toWayId:b});
      if(!state.adj.get(b)!.has(a))state.adj.get(b)!.set(a,{lat:Number(lat),lon:Number(lon),nodeId,fromWayId:b,toWayId:a});
    };
    for(const way of ways||[]){
      if(!way?.id||!Array.isArray(way.geometry)||way.geometry.length<2)continue;
      const id=this._scheduleLongRangeId(way.id);
      const f=this._edgeMetadata(way as OrmParsedWay,true),r=this._edgeMetadata(way,false);
      if(!this._edgeCompatibleWithProfile(f,opts)&&!this._edgeCompatibleWithProfile(r,opts))continue;
      const firstSeen=!state.ways.has(id);
      if(firstSeen){
        let lengthKm=0;for(let i=1;i<way.geometry.length;i++)lengthKm+=haversine(way.geometry[i-1].lat,way.geometry[i-1].lon,way.geometry[i].lat,way.geometry[i].lon);
        const mid=way.geometry[Math.floor((way.geometry.length-1)/2)]||way.geometry[0];
        state.ways.set(id,{id,lengthKm,cost:this._scheduleLongRangeWayCost(way,lengthKm),lat:Number(mid.lat),lon:Number(mid.lon)});
        state.adj.set(id,new Map());state.wayCount++;state.segmentCount+=Math.max(0,way.geometry.length-1);
      }
      // A seed anchor may contain geometry but no OSM nodeIds. When the real
      // network copy of the same way arrives later, ingest its topology too
      // instead of discarding it just because the way id was already known.
      const nodeIds=Array.isArray(way.nodeIds)?way.nodeIds:[],n=Math.min(nodeIds.length,way.geometry.length);
      for(let i=0;i<n;i++){
        const raw=nodeIds[i];if(raw==null)continue;const nk=this._scheduleLongRangeId(raw),p=way.geometry[i];
        const owner=state.nodeOwners.get(nk);
        if(owner===undefined){state.nodeOwners.set(nk,id);state.nodeCount++;}
        else if(Array.isArray(owner)){
          for(const other of owner)connect(other,id,p.lat,p.lon,nk);
          if(!owner.includes(id))owner.push(id);
        }else if(owner!==id){connect(owner,id,p.lat,p.lon,nk);state.nodeOwners.set(nk,[owner,id]);}
      }
      if(state.wayCount>state.maxWays||state.nodeCount>state.maxNodes||state.segmentCount>state.maxSegments){
        const requiredBytes=Math.ceil(state.wayCount*850+state.nodeCount*70+state.segmentCount*12),budgetBytes=Math.ceil(state.maxWays*850+state.maxNodes*70+state.maxSegments*12);
        const e=new Error('Le planificateur longue distance a atteint son plafond mémoire de topologie avant construction d’un gros RailGraph.');
        e.code='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';e.requiredBytes=requiredBytes;e.budgetBytes=budgetBytes;
        this._lastCursorRouteFailure=e.code;this._lastRoutingFailure={code:e.code,requiredBytes,budgetBytes,coarse:true,ways:state.wayCount,nodes:state.nodeCount,segments:state.segmentCount};throw e;
      }
    }
  }

  async _findScheduleLongRangeWayPath(state: __S3Struct791,startWayId: string | number,endWayId: string | number,opts: OrmOptions = {}){
    const start=this._scheduleLongRangeId(startWayId),end=this._scheduleLongRangeId(endWayId);
    if(start===end&&state.ways.has(start))return {wayIds:[start],transitions:[],cost:0};
    if(!state.ways.has(start)||!state.ways.has(end))return null;
    const heap=new MinHeap(),dist=new Map([[start,0]]),came=new Map(),settled=new Set();heap.push({key:start,d:0});let expanded=0;
    while(heap.size){
      throwIfAborted(opts.signal);const cur=heap.pop()! as MinHeapItem & { key: string | number };if(settled.has(cur.key))continue;settled.add(cur.key);if(cur.key===end)break;
      for(const [next,via] of state.adj.get(cur.key)||[]){
        if(settled.has(next))continue;const info=state.ways.get(next);if(!info)continue;
        const nd=(dist.get(cur.key)??Infinity)+Number(info.cost||.02);if(nd<(dist.get(next)??Infinity)){dist.set(next,nd);came.set(next,{prev:cur.key,via});heap.push({key:next,d:nd});}
      }
      if((++expanded%2500)===0)await ormYield();
    }
    if(!dist.has(end))return null;
    const revWays=[end],revTransitions=[];let cur=end;
    while(cur!==start){const c=came.get(cur);if(!c)return null;revTransitions.push({...c.via,fromWayId:c.prev,toWayId:cur});cur=c.prev;revWays.push(cur);}
    return {wayIds:revWays.reverse(),transitions:revTransitions.reverse(),cost:dist.get(end),expanded};
  }

  _scheduleLongRangePortals(coarse: OrmLongRangePath,a: OrmAnchor,b: OrmAnchor,targetKm: number=34){
    const transitions=coarse?.transitions||[],portals: { lat: number; lon: number; wayId: string; segmentIndex: null; transitionIndex: number; _hiddenLongRangePortal: boolean }[]=[];let last={lat:Number(a.lat),lon:Number(a.lon)},acc=0;
    for(let i=0;i<transitions.length;i++){
      const t=transitions[i];if(![t.lat,t.lon].every(Number.isFinite))continue;const d=haversine(last.lat,last.lon,t.lat,t.lon);acc+=d;last=t;
      const remaining=haversine(t.lat,t.lon,Number(b.lat),Number(b.lon));
      if(acc>=targetKm&&remaining>Math.max(8,targetKm*.45)){
        portals.push({lat:Number(t.lat),lon:Number(t.lon),wayId:String(t.toWayId),segmentIndex:null,transitionIndex:i,_hiddenLongRangePortal:true});acc=0;
      }
    }
    return portals;
  }

  _scheduleLongRangePolyline(a: __S3Struct797,b: __S3Struct798,transitions: OrmLongRangeTransition[]=[],fromTransition: unknown=-1,toTransition: unknown=null){
    const end=toTransition==null?transitions.length-1:Math.min(transitions.length-1,Number(toTransition));
    const raw=[{lat:Number(a.lat),lon:Number(a.lon)}];let last=raw[0],pending=null;
    for(let i=Math.max(0,Number(fromTransition)+1);i<=end;i++){
      const t=transitions[i];if(!t||![t.lat,t.lon].every(Number.isFinite))continue;pending={lat:Number(t.lat),lon:Number(t.lon)};
      if(haversine(last.lat,last.lon,pending.lat,pending.lon)>=7){raw.push(pending);last=pending;pending=null;}
    }
    if(pending&&haversine(last.lat,last.lon,pending.lat,pending.lon)>.25){raw.push(pending);last=pending;}
    const endPoint={lat:Number(b.lat),lon:Number(b.lon)};if(haversine(last.lat,last.lon,endPoint.lat,endPoint.lon)>.001)raw.push(endPoint);else raw[raw.length-1]=endPoint;
    return raw;
  }

  _scheduleLongRangeEnvelopeKey(t: RailTile){return [t.south,t.west,t.north,t.east].map((x: unknown) =>Number(x).toFixed(4)).join('|');}

  async _fetchScheduleLongRangeExactWays(polyline: GeoPoint[],opts: OrmOptions = {},bufferKm: number=9){
    const envelopes: RailTile[]=[],seen=new Set();
    for(let i=1;i<polyline.length;i++){
      const a=polyline[i-1],b=polyline[i],d=Math.max(.01,haversine(a.lat,a.lon,b.lat,b.lon));
      for(const t of this._corridorTiles(a.lat,a.lon,b.lat,b.lon,Math.min(18,Math.max(8,d)),bufferKm)){
        const k=this._scheduleLongRangeEnvelopeKey(t);if(!seen.has(k)){seen.add(k);envelopes.push(t);}
      }
    }
    const byId=new Map(),failures=[];let maxWays=0,maxSegments=0;
    for(let off=0;off<envelopes.length;off+=2){
      throwIfAborted(opts.signal);const batch=envelopes.slice(off,off+2);
      const part=await this.fetchWorldRailwayTiles(batch,null,{timeoutMs:6500,attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,concurrency:Math.min(2,batch.length),maxEndpoints:3,raceEndpoints:0,hedgeDelayMs:0,transient:true,absorbResident:false,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
      for(const w of part||[])if(w?.id!=null)byId.set(String(w.id),w);for(const f of part?._fetchFailures||[])failures.push(f);
      const stat=this._scheduleLongRangeBudgetCheck([...byId.values()],opts);maxWays=Math.max(maxWays,stat.ways);maxSegments=Math.max(maxSegments,stat.segments);
      opts.onPreparationProgress?.({phase:'long-window-stream',done:Math.min(envelopes.length,off+batch.length),total:envelopes.length,ways:byId.size,bufferKm});await ormYield();
    }
    let remaining=failures;
    if(remaining.length){
      try{
        const healed=await this.fetchWorldRailwayTiles(remaining.map((f: { tile?: RailTile } & Partial<RailTile>) => (f.tile || f) as RailTile),null,{forceRefresh:true,timeoutMs:7000,attemptsPerEndpoint:1,maxSplitDepth:2,allowPartial:true,concurrency:2,maxEndpoints:3,raceEndpoints:0,transient:true,absorbResident:false,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
        for(const w of healed||[])if(w?.id!=null)byId.set(String(w.id),w);remaining=Array.from(healed?._fetchFailures||[]);const stat=this._scheduleLongRangeBudgetCheck([...byId.values()],opts);maxWays=Math.max(maxWays,stat.ways);maxSegments=Math.max(maxSegments,stat.segments);
      }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET'||(e as { code?: string })?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED')throw e;}
    }
    const out=[...byId.values()];Object.defineProperty(out,'_longRangeFailures',{value:remaining,enumerable:false});Object.defineProperty(out,'_longRangeStats',{value:{envelopes:envelopes.length,maxWays,maxSegments},enumerable:false});return out;
  }

  async _routeScheduleLongRangeExactChunk(a: OrmAnchor,b: OrmAnchor,coarse: OrmLongRangePath,fromTransition: number,toTransition: number | null,opts: OrmOptions = {},depth: number=0): Promise<any>{
    const transitions=coarse?.transitions||[],polyline=this._scheduleLongRangePolyline(a,b,transitions,fromTransition,toTransition);
    const attempt=async(bufferKm: number)=>{
      let ways=await this._fetchScheduleLongRangeExactWays(polyline,opts,bufferKm);const fetchFailures=Array.from(ways?._longRangeFailures||[]);
      const map=new Map();for(const w of ways||[])if(w?.id!=null)map.set(String(w.id),w);this._seedAnchorSnapshotWays(map,[a,b]);ways=[...map.values()];
      const stat=this._scheduleLongRangeBudgetCheck(ways,opts);this._lastCursorRouteDiagnostics.maxExactWindowWays=Math.max(Number(this._lastCursorRouteDiagnostics.maxExactWindowWays||0),stat.ways);this._lastCursorRouteDiagnostics.maxExactWindowSegments=Math.max(Number(this._lastCursorRouteDiagnostics.maxExactWindowSegments||0),stat.segments);
      if(fetchFailures.length)this._lastCursorRouteDiagnostics.windowNetworkFailures=(Number(this._lastCursorRouteDiagnostics.windowNetworkFailures)||0)+fetchFailures.length;
      const route=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting(ways),a,b,{...opts,allowFallback:false,allowSyntheticStitches:false,routeObjective:'distance',forbidPureBackup:true,allowSignalRestrictedDirection:true,cooperative:true,compactGraphEdges:true,compactStateKeys:true,preserveInfrastructureMaxSpeed:true});
      return Array.isArray(route)&&route.length>=2&&!this.isFallbackRoute(route)?route:null;
    };
    try{
      let route=await attempt(9);if(route)return route;
      route=await attempt(18);if(route)return route;
    }catch(e){
      if((e as { code?: string })?.code!=='RAILGRAPH_MEMORY_BUDGET_EXCEEDED'||depth>=5)throw e;
      // A dense urban window is split BEFORE graph construction. No giant graph
      // is ever attempted simply because a 400 km route crosses one big city.
      const lo=Math.max(0,Number(fromTransition)+1),hi=Math.min(transitions.length-1,Number(toTransition));
      if(hi-lo<1)throw e;const mid=Math.floor((lo+hi)/2),t=transitions[mid];
      const portal={lat:Number(t.lat),lon:Number(t.lon),wayId:String(t.toWayId),segmentIndex:null,_hiddenLongRangePortal:true};
      const left=await this._routeScheduleLongRangeExactChunk(a,portal,coarse,fromTransition,mid,opts,depth+1);if(!left)return null;
      const resolved=left._resolvedAnchors?.at(-1)||portal;
      const right=await this._routeScheduleLongRangeExactChunk(resolved,b,coarse,mid,toTransition,opts,depth+1);if(!right)return null;
      const gap=haversine(left.at(-1).lat,left.at(-1).lon,right[0].lat,right[0].lon);if(gap>.002)return null;
      const full=left.concat(right.slice(1));full._resolvedAnchors=[left._resolvedAnchors?.[0]||a,right._resolvedAnchors?.at(-1)||b];return full;
    }
    return null;
  }

  // HOTFIX7 — topology fragmentation for ultra-dense long corridors.
  // A coarse memory-budget hit is no longer terminal. Instead, the planner
  // finds a small set of REAL railway candidates across a geographic cut near
  // the middle of the leg, solves each half independently, and recursively
  // fragments again if one half is still too dense. Hidden split anchors never
  // enter the user Schedule/VIA model and no synthetic rail geometry is added.
  _scheduleLongRangeProjectionOnWay(way: { geometry: unknown },lat: number,lon: number){
    let best=null,bestDist=Infinity,bestIdx=0;
    const g=Array.isArray(way?.geometry)?way.geometry:[];
    for(let i=0;i<g.length-1;i++){
      const q=this._projectOnSegment(Number(lat),Number(lon),Number(g[i].lat),Number(g[i].lon),Number(g[i+1].lat),Number(g[i+1].lon));
      const d=haversine(Number(lat),Number(lon),q.lat,q.lon);
      if(d<bestDist){bestDist=d;best=q;bestIdx=i;}
    }
    return best?{lat:Number(best.lat),lon:Number(best.lon),distKm:bestDist,segmentIndex:bestIdx}:null;
  }

  _scheduleLongRangeFragmentFrame(a: { lat: unknown; lon: unknown },b: { lat: unknown; lon: unknown },radiusKm: number){
    const midLat=(Number(a.lat)+Number(b.lat))/2,midLon=(Number(a.lon)+Number(b.lon))/2;
    const cos=Math.max(.12,Math.cos(midLat*Math.PI/180));
    const east=(Number(b.lon)-Number(a.lon))*111.32*cos,north=(Number(b.lat)-Number(a.lat))*111.32;
    const norm=Math.max(.001,Math.hypot(east,north)),pe=-north/norm,pn=east/norm;
    const offset=(km: number)=>({lat:midLat+(pn*km)/111.32,lon:midLon+(pe*km)/(111.32*cos)});
    return {mid:{lat:midLat,lon:midLon},p1:offset(-radiusKm),p2:offset(radiusKm)};
  }

  async _findScheduleLongRangeFragmentCandidates(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {},depth: unknown=0){
    const distKm=Math.max(.01,haversine(a.lat,a.lon,b.lat,b.lon));
    // Progressive cross-sections: cheap first, but large enough to catch a
    // railway that detours far from the geometric chord (e.g. 70+ km).
    const maxRadius=Math.min(180,Math.max(45,distKm*.34));
    const radii=[18,38,72,115,maxRadius].map((x) =>Math.round(Math.min(maxRadius,x))).filter((x,i,v)=>x>=10&&v.indexOf(x)===i);
    const bestByWay=new Map();let failures=0;
    for(let ri=0;ri<radii.length;ri++){
      throwIfAborted(opts.signal);const radius=radii[ri],frame=this._scheduleLongRangeFragmentFrame(a,b,radius);
      const tiles=this._corridorTiles(frame.p1.lat,frame.p1.lon,frame.p2.lat,frame.p2.lon,22,16);
      for(let off=0;off<tiles.length;off+=2){
        throwIfAborted(opts.signal);const batch=tiles.slice(off,off+2);
        let part=[];
        try{
          part=await this.fetchWorldRailwayTiles(batch,null,{timeoutMs:6200,attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,
            concurrency:Math.min(2,batch.length),maxEndpoints:3,raceEndpoints:0,transient:true,absorbResident:false,
            deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
          failures+=Number(part?._fetchStats?.failed||0);
        }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;failures++;part=[];}
        for(const way of part||[]){
          if(!way?.id||!Array.isArray(way.geometry)||way.geometry.length<2)continue;
          const f=this._edgeMetadata(way as OrmParsedWay,true),r=this._edgeMetadata(way,false);
          if(!this._edgeCompatibleWithProfile(f,opts)&&!this._edgeCompatibleWithProfile(r,opts))continue;
          const q=this._scheduleLongRangeProjectionOnWay(way,frame.mid.lat,frame.mid.lon);if(!q)continue;
          // Prefer main/branch present rail and a direction broadly aligned with
          // the long leg, but never hard-ban another visible ORM railway here.
          const g=way.geometry,sg=g[Math.min(q.segmentIndex,g.length-2)],eg=g[Math.min(q.segmentIndex+1,g.length-1)];
          const cos=Math.max(.12,Math.cos(frame.mid.lat*Math.PI/180));
          const vx=(Number(eg.lon)-Number(sg.lon))*cos,vy=Number(eg.lat)-Number(sg.lat);
          const dx=(Number(b.lon)-Number(a.lon))*cos,dy=Number(b.lat)-Number(a.lat);
          const denom=Math.max(1e-9,Math.hypot(vx,vy)*Math.hypot(dx,dy));const align=Math.abs((vx*dx+vy*dy)/denom);
          const infraPenalty=Math.max(0,this._scheduleLongRangeWayCost(way,1)-1);
          const score=q.distKm+infraPenalty*2.2+(1-Math.min(1,align))*10+ri*.15;
          const id=String(way.id),prev=bestByWay.get(id);
          if(!prev||score<prev.score)bestByWay.set(id,{score,anchor:{lat:q.lat,lon:q.lon,wayId:id,segmentIndex:q.segmentIndex,osmSnapshot:way,_hiddenLongRangeFragment:true}});
        }
        opts.onPreparationProgress?.({phase:'long-fragment-scan',depth,radiusKm:radius,done:Math.min(tiles.length,off+batch.length),total:tiles.length,candidates:bestByWay.size,failed:failures});
        // Keep the transient decoded world cache tiny while scanning the cut.
        this._worldRailCache?.releaseMemory?.({maxTiles:4,maxWays:2500});await ormYield();
      }
      if(bestByWay.size>=12)break;
    }
    const ranked=[...bestByWay.values()].sort((x: __S3Struct804,y: __S3Struct805)=>x.score-y.score),selected=[];
    for(const rec of ranked){
      const p=rec.anchor;
      // Spatial diversity matters more than trying six parallel tracks from one
      // station throat. Keep a couple of close alternatives, then spread out.
      const close=selected.filter((x: __S3Struct806) =>haversine(x.lat,x.lon,p.lat,p.lon)<3.0).length;
      if(close>=2)continue;selected.push(p);if(selected.length>=10)break;
    }
    return selected;
  }

  async _routeScheduleLongRangeFragmented(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {},depth: number=0,cause: unknown=null): Promise<any>{
    const distKm=Math.max(.01,haversine(a.lat,a.lon,b.lat,b.lon));
    if(depth>=5){if(cause)throw cause;return null;}
    // Drop all decoded/cache state from the failed macro attempt before looking
    // for a split. The failed local state is already out of scope after unwind.
    this.releaseScheduleRoutingMemory?.({aggressive:true});this._worldRailCache?.releaseMemory?.({maxTiles:2,maxWays:1200});await ormYield();
    const candidates=await this._findScheduleLongRangeFragmentCandidates(a,b,opts,depth);
    if(!candidates.length){if(cause)throw cause;return null;}
    let tried=0,lastMemoryError=cause;
    for(const portal of candidates){
      throwIfAborted(opts.signal);tried++;
      opts.onPreparationProgress?.({phase:'long-fragment-try',depth,try:tried,total:Math.min(10,candidates.length),distanceKm:distKm,portal:{lat:portal.lat,lon:portal.lon,wayId:portal.wayId}});
      try{
        const left=await this._routeScheduleLongRangeAdaptive(a,portal,opts,depth+1);if(!left?.length)continue;
        const lr=left._resolvedAnchors?.at(-1)||portal;
        const join={...portal,lat:Number(lr.lat??portal.lat),lon:Number(lr.lon??portal.lon),wayId:String(lr.wayId??portal.wayId),segmentIndex:Number.isFinite(Number(lr.segmentIndex))?Number(lr.segmentIndex):portal.segmentIndex,osmSnapshot:portal.osmSnapshot};
        const right=await this._routeScheduleLongRangeAdaptive(join,b,opts,depth+1);if(!right?.length)continue;
        const gap=haversine(left.at(-1).lat,left.at(-1).lon,right[0].lat,right[0].lon);if(gap>.002)continue;
        const full=left.concat(right.slice(1));
        full._resolvedAnchors=[left._resolvedAnchors?.[0]||a,right._resolvedAnchors?.at(-1)||b];full._dynamicRailGraphPrepared=true;full._longRangeWindowed=true;full._longRangeFragmented=true;
        this._lastCursorRouteFailure='';
        this._lastCursorRouteDiagnostics={mode:'schedule-long-range-fragmented',distanceKm:distKm,fragmentDepth:depth,fragmentPortal:{lat:portal.lat,lon:portal.lon,wayId:portal.wayId},fragmentCandidates:candidates.length,routePoints:full.length};
        return full;
      }catch(e){
        if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;
        if((e as { code?: string })?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED')lastMemoryError=e;
      }finally{
        this._worldRailCache?.releaseMemory?.({maxTiles:3,maxWays:1800});await ormYield();
      }
    }
    if(lastMemoryError)throw lastMemoryError;return null;
  }

  async _routeScheduleLongRangeAdaptive(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {},depth: number=0): Promise<any>{
    const distKm=Math.max(.01,haversine(a.lat,a.lon,b.lat,b.lon));
    // Recursive fragments can eventually become regional. Reuse the normal
    // exact dynamic bridge for those pieces rather than forcing a >=120 km macro
    // planner onto a 60 km leg.
    if(distKm<120){
      return await this.prepareAndRouteScheduleAnchors([a,b],{...opts,longRangeWindowed:false,forceFreshRoute:true,_longRangeFragmentInternal:true});
    }
    try{return await this._routeScheduleLongRangeWindowed(a,b,opts);}
    catch(e){
      if((e as { code?: string })?.code!=='RAILGRAPH_MEMORY_BUDGET_EXCEEDED')throw e;
      return await this._routeScheduleLongRangeFragmented(a,b,opts,depth,e);
    }
  }

  async _routeScheduleLongRangeWindowed(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}){
    const distKm=Math.max(.01,haversine(a.lat,a.lon,b.lat,b.lon));if(distKm<120)return null;
    const state=this._createScheduleLongRangeCoarseState(opts),startId=this._scheduleLongRangeId(a.wayId),endId=this._scheduleLongRangeId(b.wayId);
    this._lastCursorRouteDiagnostics={mode:'schedule-long-range-windowed',distanceKm:distKm,tiers:[],hiddenPortals:0,exactWindows:0,maxExactWindowWays:0,maxExactWindowSegments:0,windowNetworkFailures:0};
    const seed=new Map();this._seedAnchorSnapshotWays(seed,[a,b]);this._ingestScheduleLongRangeWays(state,[...seed.values()],opts);
    const tierRaw: number[]=[24,52,90,Math.min(175,Math.max(120,distKm*.28))],tiers: number[]=[];for(const x of tierRaw){const n=Math.round(x);if(!tiers.includes(n))tiers.push(n);}
    let coarse=null,hadFailure=false;
    for(let ti=0;ti<tiers.length&&!coarse;ti++){
      throwIfAborted(opts.signal);const buffer=tiers[ti],tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,distKm<500?48:58,buffer),diag: { tier:number; bufferKm:number; tiles:number; failed:number; waysBefore:number; ways?:number; nodes?:number; segments?:number }={tier:ti+1,bufferKm:buffer,tiles:tiles.length,failed:0,waysBefore:state.wayCount};
      for(let off=0;off<tiles.length;off+=2){
        const batch=tiles.slice(off,off+2),part=await this.fetchWorldRailwayTiles(batch,null,{timeoutMs:6800,attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,concurrency:Math.min(2,batch.length),maxEndpoints:3,raceEndpoints:0,hedgeDelayMs:0,transient:true,absorbResident:false,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
        state.fetchedTiles+=batch.length;diag.failed+=Number(part?._fetchStats?.failed||0);if(Number(part?._fetchStats?.failed||0)>0)hadFailure=true;this._ingestScheduleLongRangeWays(state,part,opts);
        opts.onPreparationProgress?.({phase:'long-macro',tier:ti+1,bufferKm:buffer,done:Math.min(tiles.length,off+batch.length),total:tiles.length,ways:state.wayCount,nodes:state.nodeCount});
        // Stop downloading this tier as soon as real OSM topology already connects
        // the exact start/end ways. Extra tiles would only waste RAM/network.
        coarse=await this._findScheduleLongRangeWayPath(state,startId,endId,opts);if(coarse)break;await ormYield();
      }
      diag.ways=state.wayCount;diag.nodes=state.nodeCount;diag.segments=state.segmentCount;this._lastCursorRouteDiagnostics.tiers.push(diag);
    }
    if(!coarse){this._lastCursorRouteFailure=hadFailure?'NETWORK_UNAVAILABLE':(state.wayCount?'SOURCE_TOPOLOGY_GAP':'NETWORK_UNAVAILABLE');return null;}
    // HOTFIX6 — once the compact corridor is known, NONE of the macro topology
    // is needed by exact windows. HOTFIX4 only cleared nodeOwners, leaving the
    // potentially huge way+adjacency maps alive until the whole route returned.
    const releasedCoarse: { ways: number; nodes: number; segments: number }={ways:state.wayCount,nodes:state.nodeCount,segments:state.segmentCount};
    state.nodeOwners.clear();state.adj.clear();state.ways.clear();
    this._lastCursorRouteDiagnostics.releasedCoarse=releasedCoarse;
    this._worldRailCache?.releaseMemory?.({maxTiles:4,maxWays:2500});
    await ormYield();
    const portals=this._scheduleLongRangePortals(coarse,a,b,distKm<500?34:40);this._lastCursorRouteDiagnostics.hiddenPortals=portals.length;this._lastCursorRouteDiagnostics.coarseWays=coarse.wayIds.length;
    const targets=[...portals,{...b,transitionIndex:coarse.transitions.length-1,_final:true}];let current={...a},prevTi=-1,full=[],firstResolved=null,lastResolved=null;
    for(let i=0;i<targets.length;i++){
      throwIfAborted(opts.signal);const target=targets[i],toTi=Number(target.transitionIndex);opts.onPreparationProgress?.({phase:'long-window',window:i+1,total:targets.length,distanceKm:distKm,from:current,to:target});
      const leg=await this._routeScheduleLongRangeExactChunk(current,target,coarse,prevTi,toTi,opts,0);if(!leg?.length){this._lastCursorRouteFailure=this._lastCursorRouteDiagnostics.windowNetworkFailures?'NETWORK_UNAVAILABLE':'SOURCE_TOPOLOGY_GAP';return null;}
      if(full.length){const gap=haversine(full.at(-1)!.lat,full.at(-1)!.lon,leg[0].lat,leg[0].lon);if(gap>.002){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;}for (let j = 1; j < leg.length; j++) full.push(leg[j]);}else for (const point of leg) full.push(point);
      firstResolved=firstResolved||leg._resolvedAnchors?.[0]||current;lastResolved=leg._resolvedAnchors?.at(-1)||target;current={...lastResolved};prevTi=toTi;this._lastCursorRouteDiagnostics.exactWindows++;await ormYield();
    }
    if(full.length>=2){full._resolvedAnchors=[firstResolved||a,lastResolved||b];full._dynamicRailGraphPrepared=true;full._longRangeWindowed=true;this._lastCursorRouteFailure='';return full;}
    return null;
  }

  // SC Future — dynamic vector preparation used only while no packaged
  // RailGraph covers the requested area. This is intentionally a SMALL,
  // deterministic bridge: acquire one real OSM railway corridor, route locally,
  // cache the exact result. It never invents geometry and never re-enters the
  // historical multi-stage Schedule routing ladder.
  async prepareAndRouteScheduleAnchors(anchors: OrmAnchor[] = [], opts: OrmOptions = {}) {
    const all=(anchors||[]).filter((a: __S3Struct816) =>Number.isFinite(Number(a?.lat))&&Number.isFinite(Number(a?.lon))).map((a) =>({
      lat:Number(a.lat),lon:Number(a.lon),wayId:a?.wayId!=null?String(a.wayId):'',
      segmentIndex:Number.isFinite(Number(a?.segmentIndex??a?.osmSnapshot?.segmentIndex))?Number(a?.segmentIndex??a?.osmSnapshot?.segmentIndex):null,
      osmSnapshot:a?.osmSnapshot||null,
    }));
    if(all.length<2)return null;
    throwIfAborted(opts.signal);
    this._lastCursorRouteFailure='';this._lastRoutingFailure=null;

    const wholeRemembered=!opts.forceFreshRoute&&all.every((a: { wayId: unknown }) =>a.wayId)?this.recallCursorRoute(all,opts):null;
    if((wholeRemembered?.length ?? 0)>=2){(wholeRemembered as any)._dynamicRailGraphPrepared=true;return wholeRemembered;}

    const full=[] as OrmRoute;const resolved=[];

    // SC Future A3 — long dynamic corridors are streamed instead of loading
    // several large hedged Overpass payloads at once. A 250–300 km German
    // corridor can be very dense; bounding simultaneous response bodies avoids
    // browser memory spikes while preserving the exact OSM ways.
    const fetchDynamicTilesWindowed=async(tiles: RailTile[],{longRoute=false,rescue=false,legIndex=0,legCount=1,distanceKm=0}: OrmDynamicTileFetchArgs={})=>{
      const byId=new Map();let failed=0,done=0;const failures=[];
      const batchSize=longRoute?2:Math.min(4,Math.max(1,tiles.length));
      for(let off=0;off<tiles.length;off+=batchSize){
        throwIfAborted(opts.signal);
        const batch=tiles.slice(off,off+batchSize);
        const part=await this.fetchWorldRailwayTiles(batch,null,{
          timeoutMs:longRoute?6200:(rescue?5200:5000),attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,
          concurrency:longRoute?Math.min(2,batch.length):Math.min(4,batch.length),
          // On long routes, do not decode duplicate hedge payloads concurrently.
          // All remaining endpoints stay available as serial failovers if the first attempt(s) fail.
          maxEndpoints:3,raceEndpoints:longRoute?0:2,hedgeDelayMs:longRoute?0:(rescue?300:280),
          // A long dynamic Schedule corridor is working data, not world state.
          // Keeping every tile simultaneously in _ways + areaCache was the main
          // retained-heap source behind field OOMs.
          transient:!!longRoute,
          deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal,
        });
        for(const w of part||[])if(w?.id!=null)byId.set(String(w.id),w);
        failed+=Number(part?._fetchStats?.failed||0);
        for(const f of part?._fetchFailures||[])failures.push(f);
        done+=batch.length;
        opts.onPreparationProgress?.({phase:'stream',legIndex,legCount,distanceKm,done,total:tiles.length,ways:byId.size,failed,rescue:!!rescue});
        await ormYield();
      }
      // SC 1.1.91 — a partial corridor is NOT authoritative topology. Repair
      // only the missing envelopes before routing/caching anything. The old
      // exact-leg engine already had this safeguard; the V3 dynamic bridge had
      // accidentally dropped it, allowing one missing middle tile to create a
      // long detour in one direction and NO_CONNECTED_PATH in the other.
      let remaining=failures;
      if(remaining.length && (!Number(opts?._deadlineTs||0) || this._routeBudgetLeftMs(opts)>1800)){
        try{
          const healed=this._worldRailCache
            ? await this.fetchWorldRailwayTiles(remaining.map((f: { tile?: RailTile } & Partial<RailTile>) => (f.tile || f) as RailTile),null,{
                forceRefresh:true,allowPartial:true,maxSplitDepth:2,concurrency:2,
                deadlineTs:Number(opts?._deadlineTs||0),
                endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal,
              })
            : await this._healFailedRailwayTiles(remaining,{
                deadlineTs:Number(opts?._deadlineTs||0),
                endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal,
              });
          for(const w of healed||[])if(w?.id!=null)byId.set(String(w.id),w);
          remaining=Array.from(healed?._fetchFailures||[]);
          failed=remaining.length;
          opts.onPreparationProgress?.({phase:'heal',legIndex,legCount,distanceKm,ways:byId.size,failed,requested:failures.length,rescue:!!rescue});
        }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;}
      }
      const out=[...byId.values()];
      Object.defineProperty(out,'_fetchStats',{value:Object.freeze({requested:tiles.length,failed,ways:out.length}),enumerable:false});
      Object.defineProperty(out,'_fetchFailures',{value:Object.freeze(remaining.map((f: { tile: unknown }) =>Object.freeze({...f,tile:f?.tile?Object.freeze({...f.tile}):f?.tile}))),enumerable:false});
      return out;
    };

    const appendLeg=(leg: OrmRoute)=>{
      if(!leg?.length)return false;
      if(full.length){
        const gap=haversine(full.at(-1)!.lat,full.at(-1)!.lon,leg[0].lat,leg[0].lon);
        if(gap>0.002)return false;
        for (let j = 1; j < leg.length; j++) full.push(leg[j]);
      }else for (const point of leg) full.push(point);
      return true;
    };

    for(let i=1;i<all.length;i++){
      throwIfAborted(opts.signal);
      const a=all[i-1],b=all[i],distKm=Math.max(0.01,haversine(a.lat,a.lon,b.lat,b.lon));
      opts.onPreparationProgress?.({phase:'start',legIndex:i-1,legCount:all.length-1,distanceKm:distKm});

      const remembered=!opts.forceFreshRoute&&(a.wayId&&b.wayId)?this.recallCursorRoute([a,b],opts):null;
      if((remembered?.length ?? 0)>=2){
        if(!appendLeg(remembered as OrmRoute)){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;}
        const rr=(remembered as any)._resolvedAnchors||[a,b];
        if(!resolved.length)resolved.push(rr[0]||a);resolved.push(rr.at(-1)||b);
        continue;
      }

      // HOTFIX4: 120+ km legs never build one corridor-sized exact graph. The
      // compact macro scan + exact hidden windows scales with distance while the
      // largest in-memory RailGraph remains bounded. User constraints remain the
      // only visible VIA; internal portals are transient solver state.
      if(distKm>=120 && a.wayId && b.wayId && opts.longRangeWindowed!==false){
        const longLeg=await this._routeScheduleLongRangeAdaptive(a,b,opts,Number(opts?._longRangeFragmentDepth||0));
        if(!longLeg?.length)return null;
        if(!appendLeg(longLeg)){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;}
        full._longRangeWindowed=true;
        const rr=longLeg._resolvedAnchors||[a,b];if(!resolved.length)resolved.push(rr[0]||a);resolved.push(rr.at(-1)||b);
        opts.onPreparationProgress?.({phase:'done',legIndex:i-1,legCount:all.length-1,distanceKm:distKm,routePoints:longLeg.length,longRange:true});
        continue;
      }

      const merged=new Map();let networkIncomplete=false;
      const absorb=(ways: OrmWayLike[])=>{for(const w of ways||[])if(w?.id!=null&&Array.isArray(w.geometry)&&w.geometry.length>=2)merged.set(String(w.id),w);};
      this._seedAnchorSnapshotWays(merged,[a,b]);

      // Resident geometry around a short edit is free and often enough after the
      // exact click picker has just loaded the platform/track throat.
      if(distKm<=15&&this.getLoadedRailwaysInBounds){
        const bufferKm=Math.max(1.5,Math.min(5,1+distKm*0.28));
        const midLat=(a.lat+b.lat)/2,latPad=bufferKm/111.32;
        const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
        absorb(this.getLoadedRailwaysInBounds(Math.min(a.lat,b.lat)-latPad,Math.min(a.lon,b.lon)-lonPad,Math.max(a.lat,b.lat)+latPad,Math.max(a.lon,b.lon)+lonPad,{limit:9000})||[]);
      }

      const tryLocal=async()=>{
        if(!merged.size)return null;
        this._seedAnchorSnapshotWays(merged,[a,b]);
        return await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),[a,b],{
          ...opts,allowFallback:false,allowSyntheticStitches:false,routeObjective:'distance',forbidPureBackup:true,allowSignalRestrictedDirection:true,cooperative:true,
        });
      };

      let leg=await tryLocal();
      if(!leg){
        let fetched=[];
        if(distKm<=4){
          // HOTFIX81 — tiny routes use the same railway-only dynamic corridor as
          // long routes. OSM /map bbox can omit a long way crossing a small box
          // when it has no node inside, which produced false "no ORM track" on
          // short station-to-station clicks. Raw /map is supplemental only.
          const targetKm=4;
          const bufferKm=Math.max(3.0,Math.min(5.0,2.8+distKm*0.45));
          const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,targetKm,bufferKm);
          fetched=await fetchDynamicTilesWindowed(tiles,{longRoute:false,rescue:false,legIndex:i-1,legCount:all.length-1,distanceKm:distKm});
          networkIncomplete=Number(fetched?._fetchStats?.failed||0)>0;
          if(!fetched?.length||networkIncomplete){
            const direct=await this.fetchSmallOsmMapCorridor(a.lat,a.lon,b.lat,b.lon,{
              maxDistanceKm:4.5,targetKm:1.4,bufferKm:Math.max(0.95,Math.min(1.35,0.9+distKm*0.08)),maxTiles:7,timeoutMs:2600,concurrency:2,signal:opts.signal,
            });
            const byId=new Map();
            for(const w of fetched||[])if(w?.id!=null)byId.set(String(w.id),w);
            for(const w of direct?.ways||[])if(w?.id!=null)byId.set(String(w.id),w);
            fetched=[...byId.values()];
          }
          opts.onPreparationProgress?.({phase:'acquired',legIndex:i-1,legCount:all.length-1,distanceKm:distKm,source:'rail-corridor-tiny',ways:fetched.length,tiles:tiles.length,failed:networkIncomplete?1:0});
        }else{
          // Longer route: one narrow railway-only corridor. Tile size grows with
          // route length so a 300 km leg remains a handful of requests, not a
          // continent-sized rectangle and not dozens of tiny click boxes.
          const longRoute=distKm>=120;
          const targetKm=distKm<40?12:(distKm<120?20:(distKm<250?40:(distKm<500?55:70)));
          const bufferKm=distKm<40?5:(distKm<120?8:(distKm<250?11:(distKm<500?13:16)));
          const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,targetKm,bufferKm);
          fetched=await fetchDynamicTilesWindowed(tiles,{longRoute,rescue:false,legIndex:i-1,legCount:all.length-1,distanceKm:distKm});
          networkIncomplete=Number(fetched?._fetchStats?.failed||0)>0;
          opts.onPreparationProgress?.({phase:'acquired',legIndex:i-1,legCount:all.length-1,distanceKm:distKm,source:'rail-corridor',ways:Number(fetched?.length||0),tiles:tiles.length,failed:Number(fetched?._fetchStats?.failed||0)});
        }
        absorb(fetched);leg=await tryLocal();
      }

      // Exactly one widening pass is allowed. This is a topology rescue, not an
      // alternate solver cascade. If real rail still does not connect, fail.
      if(!leg){
        const longRoute=distKm>=120;
        // One and only one widening pass, but sized for a REAL railway detour.
        // A 250-350 km main line can sit 40-60 km away from the geometric chord
        // (Darmstadt -> Hannover via Fulda/Kassel is the field example). A fixed
        // 22 km rescue falsely declared topology gaps even with perfect OSM data.
        const targetKm=distKm<40?12:(distKm<120?20:(distKm<250?35:(distKm<500?45:55)));
        const bufferKm=distKm<4?3:(distKm<40?9:(distKm<120?14:Math.min(90,Math.max(28,distKm*0.22))));
        const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,targetKm,bufferKm);
        let rescue=[];
        try{rescue=await fetchDynamicTilesWindowed(tiles,{longRoute,rescue:true,legIndex:i-1,legCount:all.length-1,distanceKm:distKm});}catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;}
        absorb(rescue);
        networkIncomplete=networkIncomplete||Number(rescue?._fetchStats?.failed||0)>0;
        opts.onPreparationProgress?.({phase:'rescue',legIndex:i-1,legCount:all.length-1,distanceKm:distKm,ways:Number(rescue?.length||0),tiles:tiles.length,failed:Number(rescue?._fetchStats?.failed||0)});
        leg=await tryLocal();
      }

      // SC 1.1.91 — short/regional routes get one continuous-bbox authority
      // check when the tiled acquisition was incomplete OR produced an implausible
      // detour. This is still 100% real OSM rail geometry: no straight connector,
      // no synthetic stitch. It prevents Dijon→Beaune-class asymmetry where a
      // missing tile leaves a long but technically connected branch detour.
      const legDistance=(leg?.length ?? 0)>=2?this.getRouteDistance(leg):Infinity;
      // HOTFIX81 — a +12 km allowance was absurdly permissive for a 1–5 km
      // leg and could certify a giant partial-topology loop in only one direction.
      const detourLimit=distKm<8?Math.max(distKm*2.2,distKm+2.0):(distKm<25?Math.max(distKm*1.75,distKm+4.0):Math.max(distKm*1.45,distKm+12));
      const suspiciousDetour=Number.isFinite(legDistance)&&distKm<120&&legDistance>detourLimit;
      if(distKm<120 && (networkIncomplete||suspiciousDetour||!leg?.length)){
        const beforeFailure=this._lastCursorRouteFailure;
        const broad=await this._findCursorLegBroadArea(a,b,{...opts,allowFallback:false,allowSyntheticStitches:false,routeObjective:'distance',forbidPureBackup:true,allowSignalRestrictedDirection:true,cooperative:true});
        if(Array.isArray(broad)&&broad.length>=2&&!this.isFallbackRoute(broad)){
          const broadDistance=this.getRouteDistance(broad);
          if(!leg?.length||networkIncomplete||!Number.isFinite(legDistance)||broadDistance+0.25<legDistance)leg=broad;
          networkIncomplete=false;
        }else if(networkIncomplete){
          // A failed authority fetch means we do NOT certify/cach a route built
          // from known-incomplete topology. Let the player retry cleanly later.
          this._lastCursorRouteFailure='NETWORK_UNAVAILABLE';
          return null;
        }else this._lastCursorRouteFailure=beforeFailure||this._lastCursorRouteFailure;
      }

      if(!leg?.length){
        this._lastCursorRouteFailure=networkIncomplete?'NETWORK_UNAVAILABLE':(merged.size?'SOURCE_TOPOLOGY_GAP':'NETWORK_UNAVAILABLE');
        return null;
      }
      this.rememberCursorRoute([a,b],leg,opts||{});
      // Release transient corridor geometry before the next leg. The resolved
      // route is already snapshotted in the route cache.
      merged.clear();
      if(!appendLeg(leg)){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;}
      const rr=leg._resolvedAnchors||[a,b];
      if(!resolved.length)resolved.push(rr[0]||a);resolved.push(rr.at(-1)||b);
      opts.onPreparationProgress?.({phase:'done',legIndex:i-1,legCount:all.length-1,distanceKm:distKm,routePoints:leg.length});
      await ormYield();
    }

    if(full.length>=2){
      full._resolvedAnchors=resolved;
      full._dynamicRailGraphPrepared=true;
      if(!full._longRangeWindowed)this.rememberCursorRoute(all,full,opts||{});
      this._lastCursorRouteFailure='';
      if(full._longRangeWindowed)this.releaseScheduleRoutingMemory({aggressive:true});
      return full;
    }
    return null;
  }

  // v1.1.88 SC V3 — exact Schedule Creator routing over the LOCAL packaged
  // railway graph only. No OSM API, no Overpass, no live bbox acquisition.
  // Corridor widening changes only which local shards are loaded; it never
  // invents geometry and it has no time-based "no path" verdict.
  async findRouteViaLocalRailGraphAnchors(anchors: OrmAnchor[] = [], opts: OrmOptions = {}) {
    const all=(anchors||[]).filter((a: __S3Struct820) =>Number.isFinite(Number(a?.lat))&&Number.isFinite(Number(a?.lon))).map((a) =>({
      lat:Number(a.lat),lon:Number(a.lon),wayId:a?.wayId!=null?String(a.wayId):'',segmentIndex:Number.isFinite(Number(a?.segmentIndex??a?.osmSnapshot?.segmentIndex))?Number(a?.segmentIndex??a?.osmSnapshot?.segmentIndex):null,osmSnapshot:a?.osmSnapshot||null,
    }));
    if(all.length<2)return null;
    throwIfAborted(opts.signal);
    this._lastCursorRouteFailure='';this._lastRoutingFailure=null;

    await this._railGraphPack?.ready?.();
    const packPrepared=!!this._railGraphPack?.prepared;
    const strictOpts={...opts,routeObjective:'distance',allowSyntheticStitches:false,allowFallback:false,forbidPureBackup:opts.forbidPureBackup!==false,allowSignalRestrictedDirection:true,cooperative:true};
    if(!packPrepared){
      // v1.1.93 — before any network request, consult the persistent WORLD OSM
      // base. A fully cached corridor is authoritative local geometry and can be
      // routed offline anywhere on Earth. Partial cached coverage is never used
      // to certify a long detour.
      const envelopes: RailTile[]=[];let maxLegKm=0;
      for(let i=1;i<all.length;i++){
        const d=haversine(all[i-1].lat,all[i-1].lon,all[i].lat,all[i].lon);maxLegKm=Math.max(maxLegKm,d);
        envelopes.push(...this._corridorTiles(all[i-1].lat,all[i-1].lon,all[i].lat,all[i].lon,55,d<20?8:12));
      }
      // HOTFIX4: a complete 400 km world cache must not be rehydrated into one
      // exact graph merely because it is offline-available. The dynamic windowed
      // planner below will read the same persistent tiles in bounded windows.
      if(maxLegKm>=120){this._lastCursorRouteFailure='RAILGRAPH_DATA_MISSING';return null;}
      const cachedWorld=await this.getCachedWorldRailwaysForEnvelopes(envelopes);
      const resident=new Map();
      if(cachedWorld?.complete)for(const w of cachedWorld.ways||[])if(w?.geometry?.length>=2)resident.set(String(w.id),w);
      // Tiny station-throat edits may also use freshly loaded exact OSM ways;
      // for regional/long routes only complete world-cache coverage is trusted.
      if(cachedWorld?.complete || maxLegKm<=4)for(const [k,w] of this._ways||[])if(w?.geometry?.length>=2)resident.set(String(w.id??k),w);
      this._seedAnchorSnapshotWays(resident,all);
      if(resident.size){
        const route=await this._routeCursorAnchorChainOnWays([...resident.values()],all,strictOpts);
        if(Array.isArray(route)&&route.length>=2&&!this.isFallbackRoute(route)){route._railGraphLocal=true;route._worldOsmBase=!!cachedWorld?.complete;route._railGraphMigration=true;this._lastCursorRouteFailure='';return route;}
      }
      this._lastCursorRouteFailure='RAILGRAPH_DATA_MISSING';
      return null;
    }

    let lastWays=[];
    // No arbitrary radius/deadline verdict. The coarse route gives us the most
    // likely local corridor; if exact topology needs a detour, widen one shard
    // ring at a time until a real path is found, the shard graph is exhausted,
    // or the player explicitly cancels.
    try{
    for(let ring=0;;ring++){
      throwIfAborted(opts.signal);
      let ways;
      try{ways=await this._railGraphPack.ensureForAnchors(all,{neighborRing:ring,onProgress:opts.onRailGraphProgress});}
      catch(e){
        if(isRouteAbort(e))throw e;
        if((e as { code?: string })?.code==='RAILGRAPH_INDEX_GAP'){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;}
        if((e as { code?: string })?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED'){
          this._lastCursorRouteFailure='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';
          this._lastRoutingFailure={code:'RAILGRAPH_MEMORY_BUDGET_EXCEEDED',requiredBytes:Number((e as { requiredBytes?: number }).requiredBytes)||0,budgetBytes:Number((e as { budgetBytes?: number }).budgetBytes)||0};
          return null;
        }
        throw e;
      }
      lastWays=ways||[];
      if(!ways?.length)continue;
      this._seedAnchorSnapshotWays(new Map(ways.map((w: __S3Struct822) =>[String(w.id),w])),all);

      let hash=2166136261>>>0;
      for(const w of ways){const k=String(w.id);for(let i=0;i<k.length;i++){hash^=k.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}}
      const graphKey=`local:${ring}:${ways.length}:${hash}`;
      let graph=this._schedulePackedGraphCache?.key===graphKey?this._schedulePackedGraphCache.graph:null;
      if(!graph){
        graph=await this._buildGraphFromWaysAsync(ways,{allowSyntheticStitches:false});
        const cacheable=ways.length<=this._schedulePackedGraphCacheMaxWays&&graph?.nodes?.size<=this._schedulePackedGraphCacheMaxNodes;
        this._schedulePackedGraphCache=cacheable?{key:graphKey,graph,waysCount:ways.length,nodesCount:graph.nodes.size,at:Date.now(),ring}:null;
      }

      let full: OrmRoute | null=null;const resolved=[];let failed=false;
      const perLegOpts={...strictOpts,_sharedGraph:graph};
      for(let i=1;i<all.length;i++){
        throwIfAborted(opts.signal);
        const a=all[i-1],b=all[i];let leg: OrmRoute | null=this._recallExactLeg(a,b,perLegOpts);
        if(!leg){leg=await this._routeCursorCandidatesOnWays(ways,a,b,perLegOpts) as OrmRoute | null;if((leg?.length ?? 0)>=2)this._rememberExactLeg(a,b,leg as OrmRoute,perLegOpts);}
        if(!leg?.length||leg.length<2||this.isFallbackRoute(leg)){failed=true;break;}
        if(full){
          const gap=haversine(full.at(-1)!.lat,full.at(-1)!.lon,leg[0].lat,leg[0].lon);
          if(gap>0.005){failed=true;break;}
          full=full.concat(leg.slice(1));
        }else full=leg.map((p: RoutePoint) =>({...p})) as OrmRoute;
        const rr=leg._resolvedAnchors||[];
        if(i===1)resolved.push(rr[0]||{lat:a.lat,lon:a.lon,wayId:a.wayId,segmentIndex:a.segmentIndex});
        resolved.push(rr.at(-1)||{lat:b.lat,lon:b.lon,wayId:b.wayId,segmentIndex:b.segmentIndex});
        await ormYield();
      }
      if(!failed&&(full?.length ?? 0)>=2){
        (full as any)._resolvedAnchors=resolved.map((x) =>({...x}));(full as any)._railGraphLocal=true;(full as any)._routeObjective='distance';(full as any)._railGraphNeighborRing=ring;
        this._lastCursorRouteFailure='';return full;
      }
      if(ways?._railGraphExhausted)break;
      await ormYield();
    }

    this._lastCursorRouteFailure=lastWays.length?'SOURCE_TOPOLOGY_GAP':'RAILGRAPH_DATA_MISSING';
    return null;
    }finally{this._railGraphPack?.trimCache?.();}
  }

  async findRouteViaCursorAnchors(anchors: OrmAnchor[] = [], opts: OrmOptions | null = null) {
    // S3 ALPHA19 QA source-compatibility: allowFallback:false
    opts={...(opts||{})};
    if(!Number.isFinite(Number(opts._deadlineTs))){
      const requested=Math.max(25000,Math.min(180000,Number(opts.routeBudgetMs||this._scheduleRouteBudgetMs||180000)));
      opts._deadlineTs=Date.now()+requested;
    }
    const all = (anchors || []).filter((a: { lat: unknown; lon: unknown }) => Number.isFinite(Number(a?.lat)) && Number.isFinite(Number(a?.lon)))
      .map((a) => ({ lat:Number(a.lat), lon:Number(a.lon), wayId:a?.wayId != null ? String(a.wayId) : '', segmentIndex:Number.isFinite(Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex))?Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex):null, osmSnapshot:a?.osmSnapshot||null }));
    if (all.length < 2) return null;
    this._lastCursorRouteFailure='';
    this._lastRoutingFailure=null;
    throwIfAborted(opts.signal);
    const chainLegKm: number[]=[];
    for(let i=1;i<all.length;i++)chainLegKm.push(Math.max(0.01,haversine(all[i-1].lat,all[i-1].lon,all[i].lat,all[i].lon)));
    const maxChainLegKm=Math.max(...chainLegKm);
    const totalChainKm=chainLegKm.reduce((x,y: number)=>x+y,0);
    const shortChain=maxChainLegKm<3;
    const localWholeChain=all.length>=3 && all.every((a: { wayId: unknown }) =>!!a.wayId) && maxChainLegKm<=4 && totalChainKm<=12;
    // v1.1.86: ordinary exact two-anchor edits no longer switch solver at 3 km.
    // Only compact 3+ anchor station-throat chains retain the whole-chain solver.
    // v1.1.76 — a validated saved OSM route is an offline-first source, not a
    // network fallback of last resort. Its key carries the exact anchor chain and
    // full rolling-stock profile; unrelated ORM streaming cannot invalidate it.
    // Reuse it before any HTTP request (especially after F5/offline).
    if (all.every((a: { wayId: unknown }) => !!a.wayId)) {
      const rememberedExact=this.recallCursorRoute(all,opts||{});
      if((rememberedExact?.length ?? 0)>=2){
        this._lastCursorRouteFailure='';
        this._lastCursorRouteDiagnostics={routeMemory:true,residentWays:0,spatialPersistentWays:0,osmMain:[],overpass:[]};
        return rememberedExact;
      }
    }
    // v1.1.76 — Exact Schedule V2 anchors are independent, reusable railway
    // sub-legs. Route/cache them pair-by-pair instead of rebuilding a giant
    // candidate-DP graph over the whole 50+ km VIA chain after every click.
    // This is especially important while the destination has not been added yet:
    // adding a 300 m VIA at Friedrichsfeld must calculate ~300 m, not Karlsruhe→Mannheim again.
    if (all.every((a: { wayId: unknown }) => !!a.wayId) && !localWholeChain) {
      const exact = await this._findExactCursorChainIncremental(all,{...(opts||{}),allowFallback:false});
      if ((exact?.length ?? 0) >= 2) {
        this.rememberCursorRoute(all,exact as OrmRoute,opts||{});
        this._lastCursorRouteFailure='';
        return exact;
      }
      // Exact anchors always use the same exact-leg pipeline regardless of distance.
      // Do not re-enter the historical whole-chain/broad ladder after a failed exact leg.
      if(!this._lastCursorRouteFailure)this._lastCursorRouteFailure='NO_CONNECTED_PATH';
      return null;
    }
    // v1.1.32: resolve the WHOLE anchor chain at once.  The former implementation
    // committed the snap chosen for A->VIA before it knew whether VIA->B was
    // routable.  In parallel-track/station throats that produced the field bug
    // "WAYPOINT -> gare introuvable" even though another nearby snap connected.
    // First try already-loaded real OSM data: offline/reload and unit tests must
    // never wait for Overpass when the required topology is already in memory.
    const min0Lat=Math.min(...all.map((a) =>a.lat)), max0Lat=Math.max(...all.map((a) =>a.lat));
    const min0Lon=Math.min(...all.map((a) =>a.lon)), max0Lon=Math.max(...all.map((a) =>a.lon));
    // v1.1.68 — keep the resident rescue proportional to the actual leg.
    // The old fixed 0.08° pad could feed a 10 km edit with a city-sized chunk
    // of cached Europe, then build/search that whole graph on the UI thread.
    const loadedPad=shortChain?0.03:(maxChainLegKm<25?0.03:(maxChainLegKm<80?0.06:0.10));
    const loadedLimit=localWholeChain?2600:(shortChain?5000:(maxChainLegKm<25?3500:(maxChainLegKm<80?7000:12000)));
    const loaded=this.getLoadedRailwaysInBounds
      ? this.getLoadedRailwaysInBounds(min0Lat-loadedPad,min0Lon-loadedPad,max0Lat+loadedPad,max0Lon+loadedPad,{limit:loadedLimit})
      : [];
    if (loaded.length) {
      const cachedRoute=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting(loaded),all,{...opts,allowFallback:false});
      if(cachedRoute){this.rememberCursorRoute(all,cachedRoute,opts||{});this._lastCursorRouteFailure='';return cachedRoute;}
    }

    // v1.1.74 — resident topology is newer/more authoritative than a saved
    // last-known-good route. Only fall back to remembered real OSM geometry when
    // the current process cannot already resolve the anchors from resident ways.
    const remembered=this.recallCursorRoute(all,opts||{});
    if((remembered?.length ?? 0)>=2){
      this._lastCursorRouteFailure='';
      this._lastCursorRouteDiagnostics={routeMemory:true,residentWays:loaded.length,spatialPersistentWays:0,osmMain:[],overpass:[]};
      return remembered;
    }

    const merged = new Map();
    this._seedAnchorSnapshotWays(merged,all);
    let networkFailure = false;
    const diagnostics: OrmCursorRouteDiagnostics={residentWays:loaded.length,spatialPersistentWays:0,osmMain:[],overpass:[]};

    // v1.1.57 — IndexedDB lookup is spatial, not exact-bbox only. A previously
    // cached real OSM area remains usable even when the next click/snap changes
    // the requested bbox by a few metres.
    // v1.1.68 — bounded persistent-cache rescue. 22k ways for every route >=3 km
    // was the main memory/latency trap once the player had accumulated a large OSM cache.
    const persistentPad=shortChain?0.04:(maxChainLegKm<25?0.03:(maxChainLegKm<80?0.07:0.12));
    let persistentRecLimit=shortChain?18:(maxChainLegKm<25?10:(maxChainLegKm<80?20:32));
    let persistentWayLimit=shortChain?9000:(maxChainLegKm<25?3500:(maxChainLegKm<80?9000:16000));
    // v1.1.82 local whole-chain limits: keep compact station-throat work from
    // rehydrating the larger generic short-route cache envelope.
    if(localWholeChain){persistentRecLimit=12;persistentWayLimit=3200;}
    let persisted=[];
    // v1.1.86 — compact exact multi-VIA chains are interactive editor work too.
    // Do not deserialize a timestamp-ordered history of unrelated Europe tiles
    // before the deterministic OSM-main/Overpass envelope. Resident topology and
    // exact route memory above remain zero-network fast paths.
    if(!localWholeChain){
      persisted=await this._loadPersistentRailwaysInBounds(
        min0Lat-persistentPad,min0Lon-persistentPad,max0Lat+persistentPad,max0Lon+persistentPad,
        {limit:persistentRecLimit,maxWays:persistentWayLimit}
      );
      diagnostics.spatialPersistentWays=persisted.length;
      if(persisted.length){
        const persistedRoute=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting(persisted),all,{...opts,allowFallback:false});
        if(persistedRoute){this.rememberCursorRoute(all,persistedRoute,opts||{});this._lastCursorRouteFailure='';this._lastCursorRouteDiagnostics=diagnostics;return persistedRoute;}
        for(const w of persisted)merged.set(String(w.id),w);
      }
    }

    // v1.1.49 — for a station throat / short route, try the official OSM map
    // endpoint BEFORE public Overpass. It returns raw OSM nodes + ways for a tiny
    // bbox, which lets us preserve exact shared node IDs (switch connectivity).
    if(shortChain){
      // v1.1.82 contract reconstructed on top of the complete v1.1.76 source:
      // one compact OSM-main envelope for the WHOLE local VIA chain, never one
      // request per VIA leg.
      const chainBufferKm=Math.max(0.8,Math.min(1.8,0.7+maxChainLegKm*0.30));
      const midLat=(min0Lat+max0Lat)/2,latPad=chainBufferKm/111.32;
      const lonPad=chainBufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
      const direct=await this.fetchSmallOsmMapArea(
        min0Lat-latPad,min0Lon-lonPad,max0Lat+latPad,max0Lon+lonPad,
        {timeoutMs:2400,maxAreaDeg2:0.006,maxSpanDeg:0.075,signal:opts.signal}
      );
      diagnostics.osmMain.push({ok:!!direct?.ok,source:direct?.source||'',ways:Number(direct?.ways?.length||0),chainWide:true});
      if(!direct?.ok)networkFailure=true;
      for(const w of direct?.ways||[])merged.set(String(w.id),w);
      this._seedAnchorSnapshotWays(merged,all);
      if(merged.size){
        const directRoute=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
        if(directRoute){this.rememberCursorRoute(all,directRoute,opts||{});this._lastCursorRouteFailure='';this._lastCursorRouteDiagnostics=diagnostics;return directRoute;}
      }
    }

    if(localWholeChain){
      // v1.1.82 — compact Overpass work is also chain-wide. This keeps network
      // cost constant when the player adds several VIA inside one station throat.
      const bufferKm=3.2;
      const midLat=(min0Lat+max0Lat)/2,latPad=bufferKm/111.32;
      const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
      try{
        const res=await this.fetchArea(
          min0Lat-latPad,min0Lon-lonPad,max0Lat+latPad,max0Lon+lonPad,
          {withStatus:true,timeoutMs:3400,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:260,deadlineTs:Number(opts?._deadlineTs||0),
           endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal}
        );
        const ways=Array.isArray(res)?res:(res?.ways||[]);
        diagnostics.overpass.push({ok:res?.ok!==false,source:res?.source||'overpass',ways:ways.length,chainWide:true});
        for(const w of ways)merged.set(String(w.id),w);
        this._seedAnchorSnapshotWays(merged,all);
        if(merged.size){
          const r=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
          if(r){this.rememberCursorRoute(all,r,opts||{});this._lastCursorRouteFailure='';this._lastCursorRouteDiagnostics=diagnostics;return r;}
        }
      }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure=true;}
      // One chain-wide wider rescue, then fail closed.
      const rescueKm=7.5;
      const latR=rescueKm/111.32,lonR=rescueKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
      try{
        const res=await this.fetchArea(
          min0Lat-latR,min0Lon-lonR,max0Lat+latR,max0Lon+lonR,
          {withStatus:true,timeoutMs:4200,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:320,deadlineTs:Number(opts?._deadlineTs||0),
           endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal}
        );
        const ways=Array.isArray(res)?res:(res?.ways||[]);
        diagnostics.overpass.push({ok:res?.ok!==false,source:res?.source||'overpass',ways:ways.length,chainWide:true,rescue:true});
        for(const w of ways)merged.set(String(w.id),w);
        this._seedAnchorSnapshotWays(merged,all);
        if(merged.size){
          const r=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
          if(r){this.rememberCursorRoute(all,r,opts||{});this._lastCursorRouteFailure='';this._lastCursorRouteDiagnostics=diagnostics;return r;}
        }
      }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure=true;}
      this._lastCursorRouteFailure=networkFailure?'NETWORK_UNAVAILABLE':'NO_CONNECTED_PATH';
      this._lastCursorRouteDiagnostics=diagnostics;
      return null;
    }

    for (let i=1; i<all.length; i++) {
      const a=all[i-1], b=all[i];
      const distKm=Math.max(0.01,haversine(a.lat,a.lon,b.lat,b.lon));
      let legFetched = 0;

      // v1.1.48 — SHORT-LEG FAST PATH. A 300 m station-throat move must not
      // trigger two corridor passes plus an editor-overlay fetch storm. For legs
      // below 3 km, perform exactly one compact railway fetch first, then route
      // immediately. Only widen if real rail was returned but no connected path
      // can be resolved later.
      if (distKm < 3) {
        const bufferKm=Math.max(1.2,Math.min(3.0,0.9+distKm*0.8));
        const midLat=(a.lat+b.lat)/2, latPad=bufferKm/111.32;
        const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
        try {
          const res=await this.fetchArea(
            Math.min(a.lat,b.lat)-latPad,Math.min(a.lon,b.lon)-lonPad,
            Math.max(a.lat,b.lat)+latPad,Math.max(a.lon,b.lon)+lonPad,
            {withStatus:true,timeoutMs:3200,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:240,deadlineTs:Number(opts?._deadlineTs||0),signal:opts.signal}
          );
          if (res?.ok === false) networkFailure = true;
          diagnostics.overpass.push({ok:res?.ok!==false,source:res?.source||'overpass',ways:Number((Array.isArray(res)?res:res?.ways||[]).length||0)});
          const ways=Array.isArray(res)?res:(res?.ways||[]);
          for (const w of ways) { merged.set(String(w.id),w); legFetched++; }
        } catch (e) { if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure = true; }
      } else {
        // v1.1.68 — NARROW FIRST. For the common two-anchor Schedule V2 leg,
        // try routing immediately after the first corridor pass. The old code
        // always downloaded/merged the wide pass first (up to a 44 km-wide
        // corridor for a 10 km trip) and only then ran pathfinding.
        const passes = distKm < 25
          ? [{target:10,buffer:4},{target:14,buffer:10}]
          : distKm < 80
            ? [{target:14,buffer:7},{target:18,buffer:18}]
            : [{target:18,buffer:12},{target:22,buffer:26}];
        for (let passIndex=0; passIndex<passes.length; passIndex++) {
          const cfg=passes[passIndex];
          const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,cfg.target,cfg.buffer);
          try {
            const ways=await this.fetchRailwayTiles(tiles,null,{timeoutMs:4800,attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,concurrency:Math.min(4,tiles.length),maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:300,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
            for (const w of ways||[]) { merged.set(String(w.id),w); legFetched++; }
          } catch (e) { if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure = true; }
          // Most Schedule Creator legs have no VIA: one successful narrow pass
          // must end the work here instead of paying for the wide rescue pass.
          if (all.length===2 && merged.size) {
            const incremental=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
            diagnostics.overpass.push({ok:true,source:`corridor-pass-${passIndex+1}`,ways:merged.size,incremental:true});
            if(incremental){this.rememberCursorRoute(all,incremental,opts||{});this._lastCursorRouteFailure='';this._lastCursorRouteDiagnostics=diagnostics;return incremental;}
          }
          await ormYield();
        }
      }

      if (!legFetched && distKm >= 3) {
        const bufferKm=Math.max(6,Math.min(24,5+distKm*0.22));
        const midLat=(a.lat+b.lat)/2, latPad=bufferKm/111.32;
        const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
        try {
          const res=await this.fetchArea(Math.min(a.lat,b.lat)-latPad,Math.min(a.lon,b.lon)-lonPad,
            Math.max(a.lat,b.lat)+latPad,Math.max(a.lon,b.lon)+lonPad,{withStatus:true,timeoutMs:4800,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:300,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal});
          if (res?.ok === false) networkFailure = true;
          for (const w of res?.ways || []) merged.set(String(w.id),w);
        } catch (e) { if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure = true; }
      }
    }

    // Reuse real already-loaded ways only when they fall near the chain envelope.
    // This keeps offline/resume useful without scanning all of Europe in a local edit.
    let minLat=Math.min(...all.map((a) =>a.lat)), maxLat=Math.max(...all.map((a) =>a.lat));
    let minLon=Math.min(...all.map((a) =>a.lon)), maxLon=Math.max(...all.map((a) =>a.lon));
    // v1.1.68 — never append a ~80 km-wide resident rectangle to a 10 km edit.
    // This is only a rescue supplement; fetched corridor data remains authoritative.
    const pad=shortChain?0.05:(maxChainLegKm<25?0.06:(maxChainLegKm<80?0.12:0.20));
    const nearbyLimit=shortChain?7000:(maxChainLegKm<25?4500:(maxChainLegKm<80?8500:13000));
    const nearbyLoaded=this.getLoadedRailwaysInBounds
      ? this.getLoadedRailwaysInBounds(minLat-pad,minLon-pad,maxLat+pad,maxLon+pad,{limit:nearbyLimit})
      : [];
    for (const w of nearbyLoaded) if (!merged.has(String(w.id))) merged.set(String(w.id),w);

    if (!merged.size) {
      this._lastCursorRouteFailure = networkFailure ? 'NETWORK_UNAVAILABLE' : 'NO_RAIL_DATA';
      this._lastCursorRouteDiagnostics=diagnostics;
      return null;
    }
    let route=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});

    // v1.1.69 — stability rescue for real detours / parallel-track connectivity.
    // Keep the fast v1.1.68 bounded attempts first; only a failed route earns one
    // wider resident + persistent-cache pass. No synthetic geometry is introduced.
    if(!route && !shortChain){
      const rescuePad=maxChainLegKm<25?0.10:(maxChainLegKm<80?0.18:0.30);
      const rescueLoadedLimit=maxChainLegKm<25?9000:(maxChainLegKm<80?16000:24000);
      const rescuePersistentLimit=maxChainLegKm<25?9000:(maxChainLegKm<80?18000:26000);
      const rescueLoaded=this.getLoadedRailwaysInBounds
        ? this.getLoadedRailwaysInBounds(minLat-rescuePad,minLon-rescuePad,maxLat+rescuePad,maxLon+rescuePad,{limit:rescueLoadedLimit})
        : [];
      for(const w of rescueLoaded)if(!merged.has(String(w.id)))merged.set(String(w.id),w);
      const rescuePersisted=await this._loadPersistentRailwaysInBounds(
        minLat-rescuePad,minLon-rescuePad,maxLat+rescuePad,maxLon+rescuePad,
        {limit:maxChainLegKm<80?32:48,maxWays:rescuePersistentLimit}
      );
      for(const w of rescuePersisted||[])if(!merged.has(String(w.id)))merged.set(String(w.id),w);
      diagnostics.wideRescueWays=(rescueLoaded?.length||0)+(rescuePersisted?.length||0);
      if(merged.size)route=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
    }

    // v1.1.48 — only if the compact short-leg graph contains rail but still has
    // no connected solution, widen ONCE. This is the opposite of v1.1.47, which
    // eagerly paid for narrow + wide network passes before even trying Dijkstra.
    if(!route && shortChain && merged.size){
      for(let i=1;i<all.length;i++){
        const a=all[i-1],b=all[i];
        const distKm=chainLegKm[i-1];
        const bufferKm=Math.max(3.0,Math.min(6.0,2.5+distKm));
        const midLat=(a.lat+b.lat)/2,latPad=bufferKm/111.32;
        const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
        try{
          const res=await this.fetchArea(
            Math.min(a.lat,b.lat)-latPad,Math.min(a.lon,b.lon)-lonPad,
            Math.max(a.lat,b.lat)+latPad,Math.max(a.lon,b.lon)+lonPad,
            {withStatus:true,timeoutMs:3800,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:280,deadlineTs:Number(opts?._deadlineTs||0),signal:opts.signal}
          );
          if(res?.ok===false)networkFailure=true;
          const ways=Array.isArray(res)?res:(res?.ways||[]);
          for(const w of ways)merged.set(String(w.id),w);
        }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;networkFailure=true;}
      }
      route=await this._routeCursorAnchorChainOnWays(this._cloneWaysForLocalRouting([...merged.values()]),all,{...opts,allowFallback:false});
    }

    // Once we have usable real OSM railway data, a failed graph search is a
    // topology/snap problem, not proof that ORM itself is unavailable. A partial
    // tile fetch failure must not poison the user-facing diagnosis.
    if (!route) this._lastCursorRouteFailure = 'NO_CONNECTED_PATH';
    else { this._lastCursorRouteFailure = ''; this.rememberCursorRoute(all,route,opts||{}); }
    this._lastCursorRouteDiagnostics=diagnostics;
    return route;
  }

  async _routeCursorAnchorChainOnWays(ways: OrmWayLike[], anchors: OrmAnchor[], opts: OrmOptions = {}) {
    if (!ways?.length || !anchors?.length || anchors.length < 2) return null;
    const lists: OrmCursorCandidate[][]=[];
    for (const a of anchors) {
      const exactWay=a?.wayId?String(a.wayId):'';
      let c;
      if(exactWay){
        // A bound Schedule V2 anchor is authoritative: never silently hop to a
        // neighbouring platform/parallel track, and never search 1.2 km away.
        c=this._cursorSegmentCandidates(ways,a.lat,a.lon,0.04,3,exactWay,true,a.segmentIndex).filter((x) =>String(x.way?.id)===exactWay).slice(0,3);
        // The way is authoritative and candidates are already ranked by the
        // actual click distance; one closest segment is enough and avoids 3x3
        // long-distance state combinations.
        if(c.length>1)c=c.slice(0,1);
      }else{
        c=this._cursorSegmentCandidates(ways,a.lat,a.lon,0.25,10,'');
        if(!c.length)c=this._cursorSegmentCandidates(ways,a.lat,a.lon,0.45,14,'');
      }
      if (!c.length) return null;
      lists.push(c);
    }

    const graph: OrmGraph=await this._buildGraphFromWaysAsync(ways,{compactEdges:opts.compactGraphEdges===true,allowSyntheticStitches:false});
    // Attach every anchor candidate in a single pass so multiple VIA on the same
    // OSM segment share one exact subdivided chain rather than independent stubs.
    const touched=new Map();
    for (let ai=0; ai<lists.length; ai++) {
      for (let ci=0; ci<lists[ai].length; ci++) {
        const cand=lists[ai][ci];
        cand.key=`@A${ai}.${ci}:${Number(cand.lat).toFixed(7)},${Number(cand.lon).toFixed(7)}`;
        if(!graph.nodes.has(cand.key))graph.nodes.set(cand.key,{key:cand.key,lat:cand.lat,lon:cand.lon,edges:[]});
        const segKey=`${cand.way.id}:${cand.segmentIndex}`;
        if(!touched.has(segKey))touched.set(segKey,{way:cand.way,segmentIndex:cand.segmentIndex,anchors:[]});
        touched.get(segKey)!.anchors.push(cand);
      }
    }
    for(const {way,segmentIndex,anchors:cs} of touched.values()){
      const a=way.geometry[segmentIndex],b=way.geometry[segmentIndex+1]; if(!a||!b)continue;
      const aKey=wayPointKey(way,segmentIndex,a),bKey=wayPointKey(way,segmentIndex+1,b);
      if(!graph.nodes.has(aKey))graph.nodes.set(aKey,{key:aKey,lat:a.lat,lon:a.lon,edges:[]});
      if(!graph.nodes.has(bKey))graph.nodes.set(bKey,{key:bKey,lat:b.lat,lon:b.lon,edges:[]});
      const chain=[{key:aKey,lat:a.lat,lon:a.lon,t:0},...cs.map((c: __S3Struct829) =>({key:c.key,lat:c.lat,lon:c.lon,t:c.t})),{key:bKey,lat:b.lat,lon:b.lon,t:1}].sort((x: __S3Struct830,y: __S3Struct831)=>x.t-y.t);
      const ded: Array<{key:string;lat:number;lon:number;t:number}>=[];for(const q of chain){if(!ded.some((x: { key: unknown }) =>x.key===q.key))ded.push(q);}
      for(let i=0;i<ded.length-1;i++){
        const x=ded[i],y=ded[i+1];if(x.key===y.key)continue;const dist=haversine(x.lat,x.lon,y.lat,y.lon);
        graph.nodes.get(x.key)!.edges.push({from:x.key,to:y.key,dist,...this._edgeMetadata(way as OrmParsedWay,true)});
        graph.nodes.get(y.key)!.edges.push({from:y.key,to:x.key,dist,...this._edgeMetadata(way,false)});
      }
    }
    graph._index=this._buildSpatialIndex(graph.nodes);

    // Common Schedule case: both player clicks resolve to one exact OSM segment.
    // Route once with cooperative A* instead of building the generic candidate
    // dynamic-programming layers. This is the low-memory long-distance path.
    if(lists.length===2&&lists[0].length===1&&lists[1].length===1){
      const s0=lists[0][0],e0=lists[1][0];
      const solveExact=async()=>{
        const r=await this._routeAsync(graph,s0.key!,e0.key!,{...opts,allowFallback:false,directed:true,compactStateKeys:opts.compactStateKeys!==false});
        if(Array.isArray(r)&&r.length>=2&&!this.isFallbackRoute(r))r._resolvedAnchors=[{lat:Number(s0.lat),lon:Number(s0.lon),wayId:String(s0.way.id),segmentIndex:Number(s0.segmentIndex)},{lat:Number(e0.lat),lon:Number(e0.lon),wayId:String(e0.way.id),segmentIndex:Number(e0.segmentIndex)}];
        return Array.isArray(r)&&r.length>=2?r:null;
      };
      let exactRoute=await solveExact();if(exactRoute)return exactRoute;
      // Keep synthetic topology repair lazy. Building all sub-1.2 m endpoint
      // stitches up front can accidentally join dense parallel tracks and make
      // the first A* search explore a huge artificial component. Strict OSM
      // topology always gets the first attempt; only repair if it truly fails.
      if(opts.allowSyntheticStitches!==false){
        const micro=this._addEndpointNodeMicroStitches(graph,ways,0.0012);
        if(micro){exactRoute=await solveExact();if(exactRoute)return exactRoute;}
      }
      const repairs=this._applyLazyEndpointSegmentStitch(graph,ways,96,0.0018);
      if(repairs){exactRoute=await solveExact();if(exactRoute)return exactRoute;}
      const gapRepairs=this._applySafeEndpointGapStitch(graph,ways,64,0.004);
      if(!gapRepairs)return null;
      return await solveExact();
    }

    // Dynamic programming over candidate snaps. Strict OSM topology is tried
    // first; the v1.1.79 endpoint->segment repair is a single bounded retry only.
    const solveChain=async()=>{
      let states=lists[0].map((c: __S3Struct832,ci: unknown)=>({ci,cost:c.distanceKm*5,route:null,prev:null,leg:null}));
      const layers=[states];
      for(let ai=1; ai<lists.length; ai++){
        const targets=lists[ai].map((c) =>c.key!);
        const bestByCi=new Map();
        for(let pi=0; pi<states.length; pi++){
          const st=states[pi],pc=lists[ai-1][st.ci as number];
          const routes=this._routeToTargets(graph,pc.key!,targets,{...opts,allowFallback:false,directed:true});
          for(let ci=0;ci<lists[ai].length;ci++){
            const c=lists[ai][ci],leg=routes.get(c.key!);
            if(!leg?.length||leg.length<2||this.isFallbackRoute(leg))continue;
            let wrongKm=0;for(let k=1;k<leg.length;k++)if(leg[k]?._againstPreferredDirection)wrongKm+=haversine(leg[k-1].lat,leg[k-1].lon,leg[k].lat,leg[k].lon);
            const cost=st.cost+this.getRouteDistance(leg)+c.distanceKm*5+wrongKm*100;
            const best=bestByCi.get(ci);if(!best||cost<best.cost)bestByCi.set(ci,{ci,cost,prev:pi,leg});
          }
          await ormYield();
        }
        const next=[...bestByCi.values()].sort((a: __S3Struct833,b: __S3Struct834)=>a.ci-b.ci);if(!next.length)return null;
        states=next;layers.push(states);
      }
      let si=0;for(let i=1;i<states.length;i++)if(states[i].cost<states[si].cost)si=i;
      const chosen=new Array(lists.length),legs=new Array(lists.length-1);
      for(let ai=lists.length-1;ai>=0;ai--){const st=layers[ai][si];chosen[ai]=lists[ai][st.ci as number];if(ai>0){legs[ai-1]=st.leg;si=st.prev!;}}
      let route=null;
      for(const leg of legs){if(!leg?.length)return null;if(route){const gap=haversine(route.at(-1).lat,route.at(-1).lon,leg[0].lat,leg[0].lon);if(gap>0.002)return null;route=route.concat(leg.slice(1));}else route=leg.map((p: RoutePoint) =>({...p}));}
      if(route)route._resolvedAnchors=chosen.map((c: __S3Struct835) =>({lat:Number(c.lat),lon:Number(c.lon),wayId:String(c.way.id),segmentIndex:Number(c.segmentIndex)}));
      return route;
    };
    let route=await solveChain();
    if(route)return route;
    if(opts.allowSyntheticStitches!==false){
      const micro=this._addEndpointNodeMicroStitches(graph,ways,0.0012);
      if(micro){route=await solveChain();if(route)return route;}
    }
    const repairs=this._applyLazyEndpointSegmentStitch(graph,ways,96,0.0018);
    if(repairs){route=await solveChain();if(route)return route;}
    const gapRepairs=this._applySafeEndpointGapStitch(graph,ways,64,0.004);
    if(!gapRepairs)return null;
    return await solveChain();
  }

  _cloneWaysForLocalRouting(ways: OrmWayLike[] = []) {
    const out = [];
    const seen = new Set();
    for (const w of ways || []) {
      if (!w || seen.has(String(w.id))) continue;
      seen.add(String(w.id));
      // v1.1.68 — routing never mutates OSM geometry. Reuse the immutable point
      // array instead of deep-copying tens/hundreds of thousands of {lat,lon}
      // objects for every click. The way object itself stays shallow-cloned so
      // routing-local metadata cannot leak back into the cache.
      out.push({ ...w, geometry:(w.geometry || []) });
    }
    return out;
  }

  _wayTopologySignature(way: OrmWayLike) {
    const tags=way?.tags||{};
    const layer=String(tags.layer??way?.layer??'0').trim()||'0';
    const yes=(v: unknown)=>{const x=String(v??'').trim().toLowerCase();return !!x&&!['no','false','0'].includes(x);};
    return {layer,bridge:yes(tags.bridge??way?.bridge),tunnel:yes(tags.tunnel??way?.tunnel)};
  }

  _topologyStitchCompatible(a: OrmWayLike,b: OrmWayLike) {
    const x=this._wayTopologySignature(a),y=this._wayTopologySignature(b);
    return x.layer===y.layer && x.bridge===y.bridge && x.tunnel===y.tunnel;
  }

  _topologyStitchMeta(way: unknown, kind: unknown='endpoint-node') {
    const m=this._edgeMetadata(way as OrmParsedWay,true);
    return {...m,maxSpeed:Math.min(60,Number(m.maxSpeed||30)),maxSpeedSource:'OSM_TOPOLOGY_STITCH',
      directionForbidden:false,againstPreferredDirection:false,topologyStitch:kind};
  }

  _addEndpointNodeMicroStitches(graph: OrmGraph,ways: OrmWayLike[],maxDistanceKm: number=0.0012) {
    // v1.1.77 reconstruction: only near-coincident WAY ENDPOINTS can be joined.
    // The repair is graph-local; authoritative OSM ways/geometry remain untouched.
    const endpoints=[],cell=0.00025,cells=new Map();
    const put=(ep: __S3Struct838)=>{const ck=`${Math.floor(ep.lat/cell)}:${Math.floor(ep.lon/cell)}`;if(!cells.has(ck))cells.set(ck,[]);cells.get(ck).push(ep);};
    for(const way of ways||[]){
      const g=way?.geometry||[];if(g.length<2)continue;
      for(const idx of [0,g.length-1]){const p=g[idx],key=wayPointKey(way,idx,p);const ep={way,idx,key,lat:Number(p.lat),lon:Number(p.lon)};endpoints.push(ep);put(ep);}
    }
    let added=0;
    for(const ep of endpoints){
      const cr=Math.floor(ep.lat/cell),cc=Math.floor(ep.lon/cell);
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)for(const other of cells.get(`${cr+dr}:${cc+dc}`)||[]){
        if(String(ep.way.id)>=String(other.way.id) || ep.way===other.way || ep.key===other.key)continue;
        if(!this._topologyStitchCompatible(ep.way,other.way))continue;
        const d=haversine(ep.lat,ep.lon,other.lat,other.lon);if(d>maxDistanceKm)continue;
        const a=graph.nodes.get(ep.key),b=graph.nodes.get(other.key);if(!a||!b)continue;
        if(!a.edges.some((e: { to: unknown }) =>e.to===other.key))a.edges.push({from:ep.key,to:other.key,dist:d,...this._topologyStitchMeta(ep.way,'endpoint-node')});
        if(!b.edges.some((e: { to: unknown }) =>e.to===ep.key))b.edges.push({from:other.key,to:ep.key,dist:d,...this._topologyStitchMeta(other.way,'endpoint-node')});
        added++;
      }
    }
    return added;
  }

  _applySafeEndpointGapStitch(graph: OrmGraph,ways: OrmWayLike[],maxRepairs: number=64,maxDistanceKm: number=0.004) {
    // Final graph-only rescue for tiny OSM endpoint gaps that are visually
    // continuous in ORM. Spatially indexed: even a 300 km graph never performs
    // endpoint×endpoint work after a failed route.
    const endpoints: OrmEndpoint[]=[],cell=0.00010,cells=new Map<string, OrmEndpoint[]>();
    const put=(ep: OrmEndpoint)=>{const k=`${Math.floor(ep.p.lat/cell)}:${Math.floor(ep.p.lon/cell)}`;if(!cells.has(k))cells.set(k,[]);cells.get(k)!.push(ep);};
    for(const way of ways||[]){
      const g=way?.geometry||[];if(g.length<2)continue;
      const a={way,p:g[0],next:g[1],key:wayPointKey(way,0,g[0])};
      const b={way,p:g.at(-1)!,next:g.at(-2)!,key:wayPointKey(way,g.length-1,g.at(-1)!)};
      endpoints.push(a,b);put(a);put(b);
    }
    const candidateFor=(ep: OrmEndpoint)=>{
      let best=null,bestScore=Infinity;
      const inward=bearing(ep.p.lat,ep.p.lon,ep.next.lat,ep.next.lon);
      const r=Math.floor(ep.p.lat/cell),c=Math.floor(ep.p.lon/cell),seen=new Set();
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)for(const other of cells.get(`${r+dr}:${c+dc}`)||[]){
        if(other===ep||other.way===ep.way||other.key===ep.key)continue;
        const oid=`${other.way.id}:${other.key}`;if(seen.has(oid))continue;seen.add(oid);
        if(!this._topologyStitchCompatible(ep.way,other.way))continue;
        const d=haversine(ep.p.lat,ep.p.lon,other.p.lat,other.p.lon);if(d<=0||d>maxDistanceKm)continue;
        const gap=bearing(ep.p.lat,ep.p.lon,other.p.lat,other.p.lon);
        const otherInward=bearing(other.p.lat,other.p.lon,other.next.lat,other.next.lon);
        const backGap=bearing(other.p.lat,other.p.lon,ep.p.lat,ep.p.lon);
        const a1=angleBetween(inward,gap),a2=angleBetween(otherInward,backGap);
        // At both ends the way's interior must lie on the opposite side of the
        // missing gap. Side-by-side parallel tracks are ~90° here and fail.
        if(a1<120||a2<120)continue;
        const score=d+(180-a1)*0.00001+(180-a2)*0.00001;
        if(score<bestScore){bestScore=score;best={other,d,a1,a2};}
      }
      return best;
    };
    const nearest=new Map();for(const ep of endpoints){const c=candidateFor(ep);if(c)nearest.set(ep,c);}
    let repairs=0;
    for(const ep of endpoints){
      if(repairs>=maxRepairs)break;
      const c=nearest.get(ep);if(!c)continue;
      const back=nearest.get(c.other);if(!back||back.other!==ep)continue; // unambiguous reciprocal nearest continuation
      if(String(ep.way.id)>String(c.other.way.id))continue;
      const a=graph.nodes.get(ep.key),b=graph.nodes.get(c.other.key);if(!a||!b)continue;
      const ma=this._topologyStitchMeta(ep.way,'endpoint-gap-safe');
      const mb=this._topologyStitchMeta(c.other.way,'endpoint-gap-safe');
      if(!a.edges.some((e: { to: unknown }) =>e.to===c.other.key))a.edges.push({from:ep.key,to:c.other.key,dist:c.d,...ma});
      if(!b.edges.some((e: { to: unknown }) =>e.to===ep.key))b.edges.push({from:c.other.key,to:ep.key,dist:c.d,...mb});
      repairs++;
    }
    if(repairs)graph._index=this._buildSpatialIndex(graph.nodes);
    return repairs;
  }

  _applyLazyEndpointSegmentStitch(graph: OrmGraph,ways: OrmWayLike[],maxRepairs: number=96,maxDistanceKm: number=0.0018) {
    // v1.1.79 reconstruction of the Friedrichsfeld rescue. It is called ONLY
    // after strict routing has proved NO_CONNECTED_PATH. Endpoints can project
    // onto the INTERIOR of another compatible railway segment; ordinary parallel
    // tracks and perpendicular crossings are rejected. Graph only, no OSM mutation.
    const cell=0.0005,segments=[],cells=new Map();
    const addCell=(r: unknown,c: unknown,seg: unknown)=>{const k=`${r}:${c}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(seg);};
    for(const way of ways||[]){
      const g=way?.geometry||[];
      for(let i=0;i<g.length-1;i++){
        const a=g[i],b=g[i+1],seg={way,i,a,b};segments.push(seg);
        const r0=Math.floor(Math.min(a.lat,b.lat)/cell),r1=Math.floor(Math.max(a.lat,b.lat)/cell);
        const c0=Math.floor(Math.min(a.lon,b.lon)/cell),c1=Math.floor(Math.max(a.lon,b.lon)/cell);
        // Extremely long synthetic/test segments are rare in OSM. Bound index
        // expansion; their endpoints will still be covered by the sampled range.
        const rr=Math.min(r1-r0,120),cc=Math.min(c1-c0,120);
        for(let r=r0;r<=r0+rr;r++)for(let c=c0;c<=c0+cc;c++)addCell(r,c,seg);
      }
    }
    const endpoints=[];
    for(const way of ways||[]){const g=way?.geometry||[];if(g.length<2)continue;
      endpoints.push({way,idx:0,p:g[0],next:g[1],key:wayPointKey(way,0,g[0])});
      endpoints.push({way,idx:g.length-1,p:g.at(-1)!,next:g.at(-2)!,key:wayPointKey(way,g.length-1,g.at(-1)!)});
    }
    const angleDeg=(ep: __S3Struct843,seg: __S3Struct844)=>{
      const lat=ep.p.lat*Math.PI/180,scale=Math.max(0.01,Math.cos(lat));
      const ux=(ep.next.lon-ep.p.lon)*scale,uy=ep.next.lat-ep.p.lat;
      const vx=(seg.b.lon-seg.a.lon)*scale,vy=seg.b.lat-seg.a.lat;
      const un=Math.hypot(ux,uy),vn=Math.hypot(vx,vy);if(!un||!vn)return 90;
      const dot=Math.min(1,Math.max(-1,Math.abs((ux*vx+uy*vy)/(un*vn))));
      return Math.acos(dot)*180/Math.PI;
    };
    let repairs=0;
    for(const ep of endpoints){
      if(repairs>=maxRepairs)break;
      const er=Math.floor(ep.p.lat/cell),ec=Math.floor(ep.p.lon/cell),seen=new Set();
      for(let dr=-1;dr<=1&&repairs<maxRepairs;dr++)for(let dc=-1;dc<=1&&repairs<maxRepairs;dc++)for(const seg of cells.get(`${er+dr}:${ec+dc}`)||[]){
        const sid=`${seg.way.id}:${seg.i}`;if(seen.has(sid))continue;seen.add(sid);
        if(seg.way===ep.way || !this._topologyStitchCompatible(ep.way,seg.way))continue;
        const hit=pointSegmentDistanceKm(ep.p.lat,ep.p.lon,seg.a,seg.b);
        if(hit.distanceKm>maxDistanceKm || hit.t<=0.015 || hit.t>=0.985)continue;
        const angle=angleDeg(ep,seg);
        // Railway turnout angles are shallow, but not mathematically parallel.
        // This rejects ordinary adjacent parallel lines and road-like crossings.
        if(angle<0.6 || angle>50)continue;
        const endNode=graph.nodes.get(ep.key);if(!endNode)continue;
        const aKey=wayPointKey(seg.way,seg.i,seg.a),bKey=wayPointKey(seg.way,seg.i+1,seg.b);
        const aNode=graph.nodes.get(aKey),bNode=graph.nodes.get(bKey);if(!aNode||!bNode)continue;
        const projKey=`@TURNOUT:${seg.way.id}:${seg.i}:${hit.lat.toFixed(7)},${hit.lon.toFixed(7)}`;
        if(!graph.nodes.has(projKey))graph.nodes.set(projKey,{key:projKey,lat:hit.lat,lon:hit.lon,edges:[]});
        const proj=graph.nodes.get(projKey)!,dA=haversine(seg.a.lat,seg.a.lon,hit.lat,hit.lon),dB=haversine(hit.lat,hit.lon,seg.b.lat,seg.b.lon);
        const f=this._edgeMetadata(seg.way,true),r=this._edgeMetadata(seg.way,false);
        if(!aNode.edges.some((e: { to: unknown }) =>e.to===projKey))aNode.edges.push({from:aKey,to:projKey,dist:dA,...f});
        if(!proj.edges.some((e: { to: unknown }) =>e.to===aKey))proj.edges.push({from:projKey,to:aKey,dist:dA,...r});
        if(!proj.edges.some((e: { to: unknown }) =>e.to===bKey))proj.edges.push({from:projKey,to:bKey,dist:dB,...f});
        if(!bNode.edges.some((e: { to: unknown }) =>e.to===projKey))bNode.edges.push({from:bKey,to:projKey,dist:dB,...r});
        const stitch=this._topologyStitchMeta(ep.way,'endpoint-segment');
        if(!endNode.edges.some((e: { to: unknown }) =>e.to===projKey))endNode.edges.push({from:ep.key,to:projKey,dist:hit.distanceKm,...stitch});
        if(!proj.edges.some((e: { to: unknown }) =>e.to===ep.key))proj.edges.push({from:projKey,to:ep.key,dist:hit.distanceKm,...stitch});
        repairs++;
      }
    }
    if(repairs)graph._index=this._buildSpatialIndex(graph.nodes);
    return repairs;
  }

  async _buildGraphFromWaysAsync(ways: OrmWayLike[] = [], options: OrmOptions = {}) {
    const nodes = new Map();
    const compact=options.compactEdges===true;
    // In SC Future long corridors, tens/hundreds of thousands of segments used
    // to duplicate the complete railway metadata object on BOTH directed edges.
    // Share two metadata prototypes per OSM way and keep only from/to/dist on
    // each edge. Property reads remain identical for the routing engine.
    const metaCache=compact?new Map():null;
    const edgeMeta=(way: OrmWayLike,forward: boolean)=>{
      if(!compact)return this._edgeMetadata(way,forward);
      const k=`${String(way?.id??'')}|${forward?'F':'B'}`;let m=metaCache!.get(k);
      if(!m){m=this._edgeMetadata(way,forward);metaCache!.set(k,m);}return m;
    };
    const makeEdge=(way: OrmWayLike,forward: boolean,from: string,to: string,dist: number)=>{
      if(!compact)return {from,to,dist,...edgeMeta(way,forward)};
      const e=Object.create(edgeMeta(way,forward));e.from=from;e.to=to;e.dist=dist;return e;
    };
    let wi = 0, segmentCount = 0;
    for (const way of ways) {
      const geom = way.geometry || [];
      for (let i=0;i<geom.length-1;i++) {
        const a=geom[i], b=geom[i+1];
        const aKey=wayPointKey(way,i,a);
        const bKey=wayPointKey(way,i+1,b);
        if (aKey===bKey) continue;
        if (!nodes.has(aKey)) nodes.set(aKey,{key:aKey,lat:a.lat,lon:a.lon,edges:[]});
        if (!nodes.has(bKey)) nodes.set(bKey,{key:bKey,lat:b.lat,lon:b.lon,edges:[]});
        const dist=haversine(a.lat,a.lon,b.lat,b.lon);
        nodes.get(aKey).edges.push(makeEdge(way,true,aKey,bKey,dist));
        nodes.get(bKey).edges.push(makeEdge(way,false,bKey,aKey,dist));
        if ((++segmentCount % 2500) === 0) await ormYield();
      }
      if ((++wi % 120) === 0) await ormYield();
    }
    const graph: OrmGraph={nodes,_compactEdges:compact};
    if(options.allowSyntheticStitches !== false)this._addEndpointNodeMicroStitches(graph,ways,0.0012);
    graph._index=this._buildSpatialIndex(nodes);
    return graph;
  }

  _cursorLegCacheKey(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const cap=Number(opts?.maxSpeed)||0;
    const aw=a?.wayId ? String(a.wayId) : '*', bw=b?.wayId ? String(b.wayId) : '*';
    const systems=(opts?.electricSystems||[]).map((x) =>`${Number(x?.voltage)||0}/${Number(x?.frequency)||0}`).sort().join(',');
    const gauges=(opts?.gauges||[]).map(Number).filter(Number.isFinite).sort((x: __KPStruct604,y: __KPStruct605)=>x-y).join(',');
    const traction=String(opts?.traction||'').toLowerCase();
    const asi=Number.isFinite(Number(a?.segmentIndex))?Number(a.segmentIndex):'*', bsi=Number.isFinite(Number(b?.segmentIndex))?Number(b.segmentIndex):'*';
    return `cursor-v11:${a.lat.toFixed(5)},${a.lon.toFixed(5)}@${aw}#${asi}>${b.lat.toFixed(5)},${b.lon.toFixed(5)}@${bw}#${bsi}:v${cap}:t${traction}:e${systems}:g${gauges}:lg${normalizeLoadingGauge(opts?.loadingGauge)}:al${Number(opts?.axleLoad)||0}:ml${Number(opts?.metreLoad)||0}:strict`;
  }

  _cursorSegmentCandidates(ways: OrmWayLike[], lat: number, lon: number, maxDistKm: number = 0.35, limit: number = 12, preferredWayId: string = '', exactWayOnly: boolean = false, segmentIndexHint: unknown = null): OrmCursorCandidate[] {
    const hits=[];
    const pref=preferredWayId ? String(preferredWayId) : '';
    for(const way of ways||[]){
      if(exactWayOnly && pref && String(way?.id)!==pref)continue;
      const g=way.geometry||[];
      for(let i=0;i<g.length-1;i++){
        const hit=pointSegmentDistanceKm(lat,lon,g[i],g[i+1]);
        if(hit.distanceKm>maxDistKm)continue;
        hits.push({way,segmentIndex:i,t:hit.t,lat:hit.lat,lon:hit.lon,distanceKm:hit.distanceKm});
      }
    }
    if(exactWayOnly && Number.isFinite(Number(segmentIndexHint))){
      const hinted=hits.filter((h: { segmentIndex: unknown }) =>Number(h.segmentIndex)===Number(segmentIndexHint));
      // segmentIndex is an acceleration hint, never an authority. OSM ways can
      // gain/lose geometry nodes between cache/snapshot/network reads. Trust the
      // old index only when it still lands essentially on the click; otherwise
      // rank every segment of the SAME authoritative way by actual distance.
      if(hinted.length){
        hinted.sort((a: __S3Struct850,b: __S3Struct851)=>a.distanceKm-b.distanceKm);
        const nearest=hits.reduce((m,h: __S3Struct852)=>Math.min(m,h.distanceKm),Infinity);
        if(hinted[0].distanceKm<=Math.max(0.0015,nearest+0.0005))return hinted.slice(0,Math.max(1,limit));
      }
    }
    hits.sort((a,b)=>{
      // A remembered wayId is only a small hint. A stale/split way must never fill
      // the entire candidate budget and hide a neighbouring connected main track.
      const as=a.distanceKm - (pref && String(a.way.id)===pref ? Math.min(0.01,a.distanceKm*0.5) : 0);
      const bs=b.distanceKm - (pref && String(b.way.id)===pref ? Math.min(0.01,b.distanceKm*0.5) : 0);
      return as-bs || a.distanceKm-b.distanceKm;
    });
    const out=[],seen=new Set();
    for(const h of hits){
      const k=`${h.way.id}:${h.segmentIndex}:${Math.round(h.t*10000)}`;
      if(seen.has(k))continue;seen.add(k);out.push(h);if(out.length>=limit)break;
    }
    return out;
  }

  _attachCursorCandidatesToGraph(graph: OrmGraph, startCandidates: OrmCursorCandidate[], endCandidates: OrmCursorCandidate[], options: OrmOptions = {}) {
    const touched=new Map<string, { way: OrmWayLike; segmentIndex: number; anchors: OrmCursorCandidate[] }>();
    const originalEdgeLengths=new Map<string, number>(),createdKeys=new Set<string>();
    const markNode=(key: string)=>{const n=graph.nodes.get(key);if(n&&!originalEdgeLengths.has(key))originalEdgeLengths.set(key,n.edges.length);};
    const ensureNode=(key: string,lat: number,lon: number)=>{if(!graph.nodes.has(key)){graph.nodes.set(key,{key,lat,lon,edges:[]});createdKeys.add(key);}else markNode(key);return graph.nodes.get(key);};
    const add=(cand: OrmCursorCandidate,prefix: string,index: number)=>{
      const key=`@${prefix}${index}:${Number(cand.lat).toFixed(7)},${Number(cand.lon).toFixed(7)}`;
      cand.key=key;ensureNode(key,cand.lat,cand.lon);
      const segKey=`${cand.way.id}:${cand.segmentIndex}`;
      if(!touched.has(segKey))touched.set(segKey,{way:cand.way,segmentIndex:cand.segmentIndex,anchors:[]});
      touched.get(segKey)!.anchors.push(cand);
    };
    startCandidates.forEach((c,i)=>add(c,'S',i));
    endCandidates.forEach((c,i)=>add(c,'E',i));
    for(const {way,segmentIndex,anchors} of touched.values()){
      const a=way.geometry[segmentIndex],b=way.geometry[segmentIndex+1];
      if(!a||!b)continue;
      const aKey=wayPointKey(way,segmentIndex,a),bKey=wayPointKey(way,segmentIndex+1,b);
      ensureNode(aKey,a.lat,a.lon);ensureNode(bKey,b.lat,b.lon);
      const chain=[{key:aKey,lat:a.lat,lon:a.lon,t:0},...anchors.map((c) =>({key:c.key!,lat:c.lat,lon:c.lon,t:c.t})),{key:bKey,lat:b.lat,lon:b.lon,t:1}].sort((x,y)=>x.t-y.t);
      const dedup=[];for(const x of chain){if(!dedup.length||dedup.at(-1)!.key!==x.key)dedup.push(x);}
      for(let i=0;i<dedup.length-1;i++){
        const x=dedup[i],y=dedup[i+1];if(x.key===y.key)continue;const dist=haversine(x.lat,x.lon,y.lat,y.lon);
        markNode(x.key);markNode(y.key);
        graph.nodes.get(x.key)!.edges.push({from:x.key,to:y.key,dist,...this._edgeMetadata(way as OrmParsedWay,true)});
        graph.nodes.get(y.key)!.edges.push({from:y.key,to:x.key,dist,...this._edgeMetadata(way,false)});
      }
    }
    if(options.rebuildIndex !== false)graph._index=this._buildSpatialIndex(graph.nodes);
    return ()=>{
      for(const [key,len] of originalEdgeLengths){const n=graph.nodes.get(key);if(n)n.edges.length=Math.min(n.edges.length,len);}
      for(const key of createdKeys)graph.nodes.delete(key);
      if(options.rebuildIndex !== false)graph._index=this._buildSpatialIndex(graph.nodes);
    };
  }

  async _routeCursorCandidatesOnWays(ways: OrmWayLike[],a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    if(!ways?.length)return null;
    if(opts?.signal?.aborted){const e=new Error('Calcul du sillon annulé.');e.name='AbortError';e.code='ROUTE_CANCELLED';throw e;}
    const exact=(anchor: OrmAnchor)=>{const w=anchor?.wayId?String(anchor.wayId):'';if(!w)return null;return this._cursorSegmentCandidates(ways,anchor.lat,anchor.lon,0.04,3,w,true,anchor.segmentIndex).filter((x) =>String(x.way?.id)===w).slice(0,3);};
    let starts=exact(a)??this._cursorSegmentCandidates(ways,a.lat,a.lon,0.25,6,'');
    let ends=exact(b)??this._cursorSegmentCandidates(ways,b.lat,b.lon,0.25,6,'');
    if(!a?.wayId&&!starts.length)starts=this._cursorSegmentCandidates(ways,a.lat,a.lon,0.45,8,'');
    if(!b?.wayId&&!ends.length)ends=this._cursorSegmentCandidates(ways,b.lat,b.lon,0.45,8,'');
    if(!starts.length||!ends.length)return null;
    const shared=(opts?._sharedGraph as OrmGraph | null)||null;
    const graph=shared||await this._buildGraphFromWaysAsync(ways,{allowSyntheticStitches:opts.allowSyntheticStitches!==false});
    const cleanup=this._attachCursorCandidatesToGraph(graph,starts,ends,{rebuildIndex:!shared});
    const combos: Array<{s:OrmCursorCandidate;e:OrmCursorCandidate;snap:number}>=[];for(const st of starts)for(const en of ends)combos.push({s:st,e:en,snap:st.distanceKm+en.distanceKm});combos.sort((x: __S3Struct869,y: __S3Struct870)=>x.snap-y.snap);
    const solveStrict=async()=>{
      let best=null,bestScore=Infinity;
      for(let i=0;i<combos.length;i++){
        if(opts?.signal?.aborted){const er=new Error('Calcul du sillon annulé.');er.name='AbortError';er.code='ROUTE_CANCELLED';throw er;}
        const {s:e1,e:e2,snap}=combos[i];
        const leg=opts.cooperative===false?this.dijkstra(graph,e1.key!,e2.key!,{...opts,allowFallback:false,directed:true}):await this._routeAsync(graph,e1.key!,e2.key!,{...opts,allowFallback:false,directed:true});
        if(!leg?.length||leg.length<2||this.isFallbackRoute(leg))continue;
        const distance=this.getRouteDistance(leg);let wrongPreferredKm=0;
        for(let k=1;k<leg.length;k++)if((leg[k] as { _againstPreferredDirection?: boolean })?._againstPreferredDirection)wrongPreferredKm+=haversine(Number(leg[k-1].lat),Number(leg[k-1].lon),Number(leg[k].lat),Number(leg[k].lon));
        const score=snap*1000+distance+wrongPreferredKm*100;
        if(score<bestScore){bestScore=score;best=leg;best._resolvedAnchors=[{lat:Number(e1.lat),lon:Number(e1.lon),wayId:String(e1.way.id),segmentIndex:Number(e1.segmentIndex)},{lat:Number(e2.lat),lon:Number(e2.lon),wayId:String(e2.way.id),segmentIndex:Number(e2.segmentIndex)}];}
        if((i%4)===3)await ormYield();
      }
      return best;
    };
    try{
      let best=await solveStrict();if(best)return best;
      // SC V3 is exact-only: no endpoint-segment stitch, no micro-gap stitch,
      // no straight connector. Legacy callers keep the historical repair path.
      if(opts.allowSyntheticStitches===false)return null;
      const repairs=this._applyLazyEndpointSegmentStitch(graph,ways,96,0.0018);if(repairs){best=await solveStrict();if(best)return best;}
      const gapRepairs=this._applySafeEndpointGapStitch(graph,ways,64,0.004);if(gapRepairs){best=await solveStrict();if(best)return best;}
      return null;
    }finally{if(shared)cleanup?.();}
  }

  _scheduleExactLegKey(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const base=this._cursorLegCacheKey(a,b,opts);
    const ai=Number.isFinite(Number(a?.segmentIndex))?Number(a.segmentIndex):'*';
    const bi=Number.isFinite(Number(b?.segmentIndex))?Number(b.segmentIndex):'*';
    return `exact-leg-v4:${base}:si${ai}>${bi}`;
  }

  _rememberExactLeg(a: OrmAnchor,b: OrmAnchor,route: OrmRoute,opts: OrmOptions = {}) {
    if(!route?.length||route.length<2||this.isFallbackRoute(route)||route.length>this._scheduleExactLegCacheMaxSinglePoints)return;
    const key=this._scheduleExactLegKey(a,b,opts);
    this._scheduleExactLegCache.delete(key);
    this._scheduleExactLegCache.set(key,{route:this._cloneRememberedRoute(route),at:Date.now()});
    this._trimScheduleRouteMemories();
  }

  _recallExactLeg(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const key=this._scheduleExactLegKey(a,b,opts),rec=this._scheduleExactLegCache.get(key);
    if(!rec?.route?.length)return null;
    if(Date.now()-Number(rec.at||0)>30*60*1000){this._scheduleExactLegCache.delete(key);return null;}
    return this._cloneRememberedRoute(rec.route);
  }

  async _findExactCursorChainIncremental(anchors: OrmAnchor[],opts: OrmOptions = {}) {
    let full=null;const resolved=[];
    for(let i=1;i<anchors.length;i++){
      const a=anchors[i-1],b=anchors[i];
      let leg=this._recallExactLeg(a,b,opts);
      if(!leg){
        leg=await this._findCursorLegLocal(a,b,{...opts,_scheduleExact:true});
        if(!leg?.length||leg.length<2||this.isFallbackRoute(leg))return null;
        this._rememberExactLeg(a,b,leg,opts);
      }
      if(full){
        const gap=haversine(full.at(-1)!.lat,full.at(-1)!.lon,leg[0].lat,leg[0].lon);
        if(gap>0.005)return null;
        full=full.concat(leg.slice(1));
      }else full=leg.map((p: { lat: number; lon: number; [key: string]: unknown }) =>({...p}));
      const rr=leg._resolvedAnchors||[];
      if(i===1)resolved.push(rr[0]||{lat:a.lat,lon:a.lon,wayId:a.wayId,segmentIndex:a.segmentIndex});
      resolved.push(rr.at(-1)||{lat:b.lat,lon:b.lon,wayId:b.wayId,segmentIndex:b.segmentIndex});
      await ormYield();
    }
    if(full)(full as any)._resolvedAnchors=resolved.map((x) =>({...x}));
    return full;
  }

  async _findCursorLegBroadArea(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    // Network fallback for ordinary regional legs: request ONE continuous bbox
    // instead of several corridor tiles. A failed HTTP response must remain a
    // network diagnosis; it is not evidence that no railway path exists.
    const distKm=Math.max(0.01,haversine(a.lat,a.lon,b.lat,b.lon));
    if (distKm > 120) return null;
    const bufferKm=Math.max(6,Math.min(24,5+distKm*0.22));
    const midLat=(a.lat+b.lat)/2;
    const latPad=bufferKm/111.32;
    const lonPad=bufferKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
    let res=null;
    try {
      res=await this.fetchArea(
        Math.min(a.lat,b.lat)-latPad,
        Math.min(a.lon,b.lon)-lonPad,
        Math.max(a.lat,b.lat)+latPad,
        Math.max(a.lon,b.lon)+lonPad,
        {withStatus:true,timeoutMs:5000,attemptsPerEndpoint:1,maxEndpoints:3,raceEndpoints:2,hedgeDelayMs:320,deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal},
      );
    } catch (err) {
      if(isRouteAbort(err)||(err as { code?: string })?.code==='TIME_BUDGET')throw err;
      this._lastRoutingFailure={kind:'NETWORK',error:err};
      this._lastCursorRouteFailure='NETWORK_UNAVAILABLE';
      return null;
    }
    if(res?.ok===false){
      this._lastRoutingFailure={kind:'NETWORK',error:res?.error||null};
      this._lastCursorRouteFailure='NETWORK_UNAVAILABLE';
      return null;
    }
    this._lastRoutingFailure=null;
    this._lastCursorRouteFailure='';
    const ways=Array.isArray(res)?res:(res?.ways||[]);
    const merged=new Map();
    for(const w of ways||[])if(w?.id!=null)merged.set(String(w.id),w);
    // Bbox selection is not allowed to erase the authoritative exact tracks the
    // player clicked. Long OSM ways can be absent from a bounded query even when
    // their geometry crosses the envelope; seed both anchor snapshots explicitly.
    this._seedAnchorSnapshotWays(merged,[a,b]);
    if (!merged.size) return null;
    const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...merged.values()]),a,b,opts);
    return (leg?.length ?? 0)>=2 && !this.isFallbackRoute(leg) ? leg : null;
  }

  async _findCursorLegLoadedGraph(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    // Second, still-real-rail strategy: reuse every OSM way already loaded by
    // the map/routing cache, while ALWAYS preserving the exact clicked ways.
    const merged=new Map<string, OrmWayLike>();
    for(const w of (this._ways?.values?.() || []))if(w?.id!=null)merged.set(String(w.id),w);
    this._seedAnchorSnapshotWays(merged,[a,b]);
    if(!merged.size)return null;
    const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...merged.values()]),a,b,opts);
    return (leg?.length ?? 0)>=2 && !this.isFallbackRoute(leg) ? leg : null;
  }


  _routeBudgetLeftMs(opts: __KPStruct623={}) {
    const deadline=Number(opts?._deadlineTs||0);
    return deadline>0 ? Math.max(0,deadline-Date.now()) : Infinity;
  }

  _snapshotWayFromAnchor(anchor: OrmAnchor) {
    const snap=anchor?.osmSnapshot as OrmAnchorSnapshot;
    const wayId=anchor?.wayId!=null&&String(anchor.wayId)!==''?String(anchor.wayId):String(snap?.wayId??snap?.id??'');
    const geometry=Array.isArray(snap?.geometry)?snap.geometry:[];
    if(!wayId || geometry.length<2)return null;
    return {
      id:wayId,
      geometry,
      nodeIds:Array.isArray(snap?.nodeIds)?snap.nodeIds:[],
      maxSpeed:snap.maxSpeed??30,maxSpeedSource:snap.maxSpeedSource||'FALLBACK_30',
      maxSpeedForward:snap.maxSpeedForward??null,maxSpeedBackward:snap.maxSpeedBackward??null,
      electrified:snap.electrified??null,electrifiedMode:snap.electrifiedMode||'',
      voltage:snap.voltage||[],frequency:snap.frequency||[],gauge:snap.gauge||[],
      loadingGauge:snap.loadingGauge||'',axleLoad:snap.axleLoad??null,metreLoad:snap.metreLoad??null,
      tracks:snap.tracks||1,usage:snap.usage||'',service:snap.service||'',railway:snap.railway||'rail',
      trafficMode:snap.trafficMode||'',preferredDirection:snap.preferredDirection||'',
      bidirectional:snap.bidirectional||'',oneway:snap.oneway||snap.tags?.oneway||'',
      trainProtection:snap.trainProtection||{},name:snap.name||'',ref:snap.ref||'',trackRef:snap.trackRef||'',
      tags:snap.tags||{},
    };
  }

  _seedAnchorSnapshotWays(map: Map<string, OrmWayLike>, anchors: OrmAnchor[]=[]) {
    for(const a of anchors){
      const w=this._snapshotWayFromAnchor(a);
      if(w)map.set(String(w.id),w as OrmWayLike);
    }
    return map;
  }

  async _findCursorLegLongDistance(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const distKm=Math.max(0.01,haversine(a.lat,a.lon,b.lat,b.lon));
    if(distKm<120)return null;
    const merged=new Map();
    this._seedAnchorSnapshotWays(merged,[a,b]);

    // Reuse a partial journey prefetch as topology input even if it was not
    // complete enough to solve the leg on its own. The old code discarded this
    // useful work and downloaded the same 300 km again from zero.
    for(const w of this._scheduleJourneyPrefetch?.ways||[])if(w?.id!=null)merged.set(String(w.id),w);
    this._seedAnchorSnapshotWays(merged,[a,b]);

    // Quality-preserving long-distance acquisition ladder. Only REAL OSM ways
    // are enlarged/retried; the final route is always solved on exact way/node
    // topology. A failed middle tile is healed locally before any wider tier.
    const tiers = distKm < 450 ? [
      {target:42,buffer:24,timeoutMs:4800,concurrency:4},
      {target:46,buffer:55,timeoutMs:5000,concurrency:4},
      {target:52,buffer:85,timeoutMs:5200,concurrency:4},
    ] : [
      {target:50,buffer:28,timeoutMs:5000,concurrency:4},
      {target:55,buffer:62,timeoutMs:5200,concurrency:4},
      {target:60,buffer:95,timeoutMs:5400,concurrency:4},
    ];

    const diagnostics: OrmLongRangeDiagnostics={mode:'long-hierarchical-healing',distanceKm:distKm,tiers:[],budgetMs:Number(opts?.routeBudgetMs||this._scheduleRouteBudgetMs||180000)};
    let hadUsableNetworkResponse=false, hadNetworkFailure=false;
    let widestTierUnresolvedFailures=0;
    let residentSeeded=false;
    const solveMerged=async(label: unknown,tierInfo: unknown)=>{
      if(merged.size<2)return null;
      const route=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...merged.values()]),a,b,opts);
      if(Array.isArray(route)&&route.length>=2&&!this.isFallbackRoute(route)){
        diagnostics.successTier=tierInfo;
        diagnostics.successPhase=label;
        diagnostics.totalWays=merged.size;
        this._lastCursorRouteDiagnostics=diagnostics;
        return route;
      }
      return null;
    };

    for(let ti=0;ti<tiers.length;ti++){
      const left=this._routeBudgetLeftMs(opts);
      if(left<=1200){this._lastCursorRouteFailure='TIME_BUDGET';break;}
      const cfg=tiers[ti];
      const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,cfg.target,cfg.buffer);
      const start=Date.now();

      // Long-route edits should benefit from topology already streamed by the
      // map or a previous attempt. getLoadedRailwaysInBounds uses resident bbox
      // metadata, so this does not scan all of Europe.
      if(!residentSeeded && this._ways?.size && this.getLoadedRailwaysInBounds){
        let added=0;
        for(const tile of tiles){
          const ways=this.getLoadedRailwaysInBounds(tile.south,tile.west,tile.north,tile.east,{limit:3500,fallbackScanLimit:0})||[];
          for(const w of ways){const id=String(w?.id??'');if(id&&!merged.has(id)){merged.set(id,w);added++;}}
          if(merged.size>18000)break;
        }
        residentSeeded=true;
        diagnostics.residentWays=added;
        if(added){const residentRoute=await solveMerged('resident',0);if(residentRoute)return residentRoute;}
      }

      let fetched=[];
      try{
        fetched=await this.fetchRailwayTiles(tiles,null,{
          timeoutMs:Math.min(cfg.timeoutMs,Math.max(1200,left-500)),
          attemptsPerEndpoint:1,maxSplitDepth:1,allowPartial:true,
          concurrency:Math.min(4,cfg.concurrency),maxEndpoints:2,
          raceEndpoints:2,hedgeDelayMs:320,
          deadlineTs:Number(opts?._deadlineTs||0),
          endpointOffset:(this._scheduleEndpointRotation++ % OVERPASS_URLS.length),signal:opts.signal,
        });
      }catch(err){
        if(isRouteAbort(err))throw err;
        if((err as { code?: string })?.code==='TIME_BUDGET'){this._lastCursorRouteFailure='TIME_BUDGET';break;}
        hadNetworkFailure=true;
      }
      const tileStats=fetched?._fetchStats || null;
      let failedTiles=Array.from(fetched?._fetchFailures||[]);
      widestTierUnresolvedFailures=failedTiles.length;
      if(tileStats){
        if(Number(tileStats.failed||0)>0)hadNetworkFailure=true;
        if(Number(tileStats.requested||0)>Number(tileStats.failed||0))hadUsableNetworkResponse=true;
      }
      if((fetched||[]).length)hadUsableNetworkResponse=true;
      for(const w of fetched||[])if(w?.id!=null)merged.set(String(w.id),w);
      this._seedAnchorSnapshotWays(merged,[a,b]);
      const tierDiag: { tier:number; bufferKm:number; targetKm:number; tiles:number; failed:number; ways:number; ms:number; heal?: Record<string, unknown> }={tier:ti+1,bufferKm:cfg.buffer,targetKm:cfg.target,tiles:tiles.length,failed:failedTiles.length,ways:merged.size,ms:Date.now()-start};
      diagnostics.tiers.push(tierDiag);

      let route=await solveMerged('corridor',ti+1);
      if(route)return route;

      // A partial response is not a topological verdict. Heal only the failed
      // envelopes (split smaller + race all endpoints), then solve the SAME graph
      // again before widening the corridor. This removes the classic false
      // NO_CONNECTED_PATH caused by one missing middle tile.
      if(failedTiles.length && this._routeBudgetLeftMs(opts)>2200){
        const healStart=Date.now();
        try{
          const healed=await this._healFailedRailwayTiles(failedTiles as Array<RailTile | {tile?: RailTile}>,{
            deadlineTs:Number(opts?._deadlineTs||0),
            endpointOffset:(this._scheduleEndpointRotation++ % OVERPASS_URLS.length),signal:opts.signal,
          });
          for(const w of healed||[])if(w?.id!=null)merged.set(String(w.id),w);
          const remaining=Array.from(healed?._fetchFailures||[]);
          widestTierUnresolvedFailures=remaining.length;
          tierDiag.heal={requested:failedTiles.length,remaining:remaining.length,ways:Number(healed?.length||0),ms:Date.now()-healStart};
          if((healed||[]).length)hadUsableNetworkResponse=true;
          if(remaining.length)hadNetworkFailure=true;
          this._seedAnchorSnapshotWays(merged,[a,b]);
          route=await solveMerged('hole-heal',ti+1);
          if(route)return route;
        }catch(err){
          if(isRouteAbort(err))throw err;
          if((err as { code?: string })?.code==='TIME_BUDGET'){this._lastCursorRouteFailure='TIME_BUDGET';break;}
          hadNetworkFailure=true;
          tierDiag.heal={requested:failedTiles.length,remaining:failedTiles.length,ways:0,ms:Date.now()-healStart,error:String((err as { message?: string })?.message||err)};
        }
      }
      await ormYield();
    }
    this._lastCursorRouteDiagnostics=diagnostics;
    if(!this._lastCursorRouteFailure){
      // The widest attempted topology envelope is authoritative for diagnosis.
      // If any of its tiles are still missing, never lie to the player that the
      // railway itself has no path.
      this._lastCursorRouteFailure=(widestTierUnresolvedFailures>0 || (!hadUsableNetworkResponse && hadNetworkFailure))
        ? 'NETWORK_UNAVAILABLE' : 'NO_CONNECTED_PATH';
    }
    return null;
  }

  async _findCursorLegLocal(a: OrmAnchor,b: OrmAnchor,opts: OrmOptions = {}) {
    const cacheKey=this._cursorLegCacheKey(a,b,opts);
    if (this.routeCache.has(cacheKey)) return this.routeCache.get(cacheKey);
    const distKm=Math.max(0.01,haversine(a.lat,a.lon,b.lat,b.lon));
    let lastNetworkIncomplete=false;

    // v1.1.84 — a whole-journey prefetch, when present, is always cheaper than
    // downloading the same long leg again. Try its real OSM ways first.
    if(this._scheduleJourneyPrefetch?.ways?.length){
      const prefetched=await this._routeFromJourneyPrefetch(a,b,opts);
      if(Array.isArray(prefetched)&&prefetched.length>=2){this.routeCache.set(cacheKey,prefetched);return prefetched;}
    }

    // v1.1.83/84 — 120+ km exact legs use the hierarchical corridor ladder only
    // after route-memory / journey-prefetch has had a chance to satisfy them.
    if(distKm>=120){
      const longRoute=await this._findCursorLegLongDistance(a,b,opts);
      if(Array.isArray(longRoute)&&longRoute.length>=2&&!this.isFallbackRoute(longRoute)){this.routeCache.set(cacheKey,longRoute);return longRoute;}
      return null;
    }

    // v1.1.76 — resolve each exact leg from resident topology BEFORE touching the
    // network. On an extending VIA chain, every previously visited kilometre is
    // already in memory and should be effectively free.
    const localPadKm=distKm<3?2.2:(distKm<25?5:9);
    const mid0=(a.lat+b.lat)/2,lat0=localPadKm/111.32,lon0=localPadKm/Math.max(20,111.32*Math.cos(mid0*Math.PI/180));
    const resident=this.getLoadedRailwaysInBounds?.(Math.min(a.lat,b.lat)-lat0,Math.min(a.lon,b.lon)-lon0,Math.max(a.lat,b.lat)+lat0,Math.max(a.lon,b.lon)+lon0,{limit:distKm<25?5000:8500})||[];
    if(resident.length){
      const residentMap=new Map(resident.map((w: OrmWayLike) =>[String(w.id),w] as const));this._seedAnchorSnapshotWays(residentMap,[a,b]);
      const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...residentMap.values()]),a,b,opts);
      if((leg?.length ?? 0)>=2&&!this.isFallbackRoute(leg)){this.routeCache.set(cacheKey,leg);return leg;}
    }

    // v1.1.76 — before HTTP, reuse spatial IndexedDB railway tiles. The old
    // exact-leg fast path accidentally skipped this and could hit all three
    // Overpass endpoints after F5 even though the same rails were already cached.
    // v1.1.86 — do not walk a timestamp-ordered IndexedDB cursor during an
    // interactive exact Schedule edit. Even with a scan cap, reading dozens of
    // multi-megabyte historical Europe tiles can dominate a 3 km route request.
    // Saved VALID routes are already served by cursor-route memory above, while
    // deterministic corridor fetches below consult their exact IndexedDB tile key
    // before any HTTP request. Keep the broad spatial scan only for legacy/non-exact
    // callers that do not have authoritative Schedule anchors.
    let persisted=[];
    if(!opts?._scheduleExact){
      persisted=await this._loadPersistentRailwaysInBounds(
        Math.min(a.lat,b.lat)-lat0,Math.min(a.lon,b.lon)-lon0,
        Math.max(a.lat,b.lat)+lat0,Math.max(a.lon,b.lon)+lon0,
        {limit:distKm<3?8:(distKm<25?12:16),maxWays:distKm<25?4000:7000,maxScanned:48}
      );
      if(persisted.length){
        const persistedMap=new Map(persisted.map((w: OrmWayLike) =>[String(w.id),w] as const));this._seedAnchorSnapshotWays(persistedMap,[a,b]);
        const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...persistedMap.values()]),a,b,opts);
        if((leg?.length ?? 0)>=2&&!this.isFallbackRoute(leg)){
          this.routeCache.set(cacheKey,leg);
          this._lastCursorRouteDiagnostics={routeMemory:false,residentWays:resident.length,spatialPersistentWays:persisted.length,osmMain:[],overpass:[]};
          return leg;
        }
      }
    }

    // FIX-DIAG2 — exact local legs up to 12 km always get a deterministic
    // OSM-main corridor attempt before Overpass. This removes the hidden 3 km
    // acquisition cliff seen in the real Karlsruhe diagnostic while preserving
    // the same exact-leg solver and exact OSM way/node identity.
    if(distKm<=12){
      try{
        const direct=await this.fetchSmallOsmMapCorridor(a.lat,a.lon,b.lat,b.lon,{
          maxDistanceKm:12,targetKm:1.5,timeoutMs:2600,concurrency:2,signal:opts.signal,
        });
        if(direct?.ways?.length){
          const directMap=new Map();for(const w of direct.ways)if(w?.id!=null)directMap.set(String(w.id),w);
          this._seedAnchorSnapshotWays(directMap,[a,b]);
          const leg=await this._routeCursorCandidatesOnWays(this._cloneWaysForLocalRouting([...directMap.values()]),a,b,opts);
          if((leg?.length ?? 0)>=2&&!this.isFallbackRoute(leg)){
            this._lastCursorRouteDiagnostics={routeMemory:false,residentWays:resident.length,spatialPersistentWays:persisted.length,osmMain:[{ok:true,source:direct.source,ways:direct.ways.length,requested:direct.requested,failed:direct.failed}],overpass:[]};
            this.routeCache.set(cacheKey,leg);return leg;
          }
        }
      }catch(e){if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET')throw e;}
    }

    // First pass stays intentionally narrow/fast. If the real railway wanders
    // outside that corridor, one wider pass is attempted. Both passes remain
    // local to this leg instead of poisoning/rebuilding the global graph.
    const passes = distKm < 8
      ? [{target:10,buffer:4},{target:14,buffer:12}]
      : distKm < 80
        ? [{target:14,buffer:8},{target:18,buffer:22}]
        : [{target:18,buffer:14},{target:22,buffer:30}];

    let merged=new Map();this._seedAnchorSnapshotWays(merged,[a,b]);
    for (let pass=0;pass<passes.length;pass++) {
      const cfg=passes[pass];
      const tiles=this._corridorTiles(a.lat,a.lon,b.lat,b.lon,cfg.target,cfg.buffer);
      let fetched=[];
      const shortNet=distKm<8;
      const timeoutMs=shortNet?(pass===0?3400:4200):(distKm<25?4200:4800);
      try { fetched=await this.fetchRailwayTiles(tiles,null,{
        timeoutMs,attemptsPerEndpoint:1,maxSplitDepth:shortNet?0:1,allowPartial:true,
        concurrency:shortNet?Math.min(2,tiles.length):Math.min(4,tiles.length),
        maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:shortNet?220:300,
        deadlineTs:Number(opts?._deadlineTs||0),endpointOffset:(this._scheduleEndpointRotation++%OVERPASS_URLS.length),signal:opts.signal
      });
        lastNetworkIncomplete=Number(fetched?._fetchStats?.failed||0)>0;
      } catch(e) {
        if(isRouteAbort(e)||(e as { code?: string })?.code==='TIME_BUDGET') throw e;
        lastNetworkIncomplete=true;this._lastRoutingFailure={kind:'NETWORK',error:e};fetched=[];
      }
      for (const w of fetched||[]) merged.set(String(w.id),w);
      this._seedAnchorSnapshotWays(merged,[a,b]);
      // Offline/test/resume path: if the exact tiles returned nothing but this ORM
      // client already holds vector ways, reuse them rather than declaring the
      // route impossible. This never fabricates geometry; it only reuses real OSM ways.
      if (!merged.size && this._ways?.size) {
        const padKm=distKm<25?5:(distKm<80?9:14);
        const midLat=(a.lat+b.lat)/2,latPad=padKm/111.32,lonPad=padKm/Math.max(20,111.32*Math.cos(midLat*Math.PI/180));
        const resident=this.getLoadedRailwaysInBounds?.(
          Math.min(a.lat,b.lat)-latPad,Math.min(a.lon,b.lon)-lonPad,
          Math.max(a.lat,b.lat)+latPad,Math.max(a.lon,b.lon)+lonPad,
          {limit:distKm<25?5000:(distKm<80?8000:12000)}
        )||[];
        for (const w of resident) merged.set(String(w.id),w);
      }
      if (!merged.size) continue;

      const localWays=this._cloneWaysForLocalRouting([...merged.values()]);
      // Cursor anchors are matched against several nearby REAL rail segments.
      // This prevents a platform/siding 5 m closer than the connected main track
      // from making an otherwise trivial itinerary impossible.
      const leg=await this._routeCursorCandidatesOnWays(localWays,a,b,opts);
      if ((leg?.length ?? 0)>=2 && !this.isFallbackRoute(leg)) {
        this.routeCache.set(cacheKey,leg);
        if (this.routeCache.size>700) {
          const keys=[...this.routeCache.keys()];
          for(let i=0;i<250;i++) this.routeCache.delete(keys[i]);
        }
        return leg;
      }
      await ormYield();
    }

    // v1.1.87 — one continuous real-OSM rescue belongs to the exact-leg
    // pipeline at EVERY sub-120 km distance. A 2–3 km station/throat movement
    // must not have fewer topology-recovery options than Weinheim→Darmstadt.
    // This runs only after resident + exact OSM-main + two corridor attempts
    // have failed, so successful short edits do not pay for the broad bbox.
    if(distKm<120 && this._routeBudgetLeftMs(opts)>1200){
      const broad=await this._findCursorLegBroadArea(a,b,opts);
      if(Array.isArray(broad)&&broad.length>=2&&!this.isFallbackRoute(broad)){
        this.routeCache.set(cacheKey,broad);
        return broad;
      }
      // _findCursorLegBroadArea owns the diagnosis for its complete/failed
      // continuous envelope. Preserve NETWORK_UNAVAILABLE if the request failed.
      if(this._lastCursorRouteFailure==='NETWORK_UNAVAILABLE')return null;
      lastNetworkIncomplete=false; // a valid broad response supersedes partial corridor failures
    }

    // Do NOT cache failures: Overpass/network availability is transient and the
    // player must be able to retry the exact same two cursor positions later.
    this._lastCursorRouteFailure=lastNetworkIncomplete?'NETWORK_UNAVAILABLE':'NO_CONNECTED_PATH';
    return null;
  }

  _parseStations(data: __S3Struct888) {
    if (!data?.elements) return [];
    return data.elements
      .filter((el: OverpassElement) => el.tags?.railway === 'station' || el.tags?.railway === 'halt' ||
        (el.tags?.public_transport === 'station' && String(el.tags?.train || '').toLowerCase() === 'yes'))
      .map((el: OverpassElement) => {
        const tags = el.tags || {};
        const center = el.type === 'node' ? el : el.center;
        if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return null;
        const stationKind = String(tags.station || '').toLowerCase();
        const train = String(tags.train || '').toLowerCase();
        const pureUrban = stationKind === 'subway' || stationKind === 'tram' || stationKind === 'light_rail' || stationKind === 'monorail' ||
          tags.subway === 'yes' || tags.tram === 'yes' || tags.light_rail === 'yes' || tags.monorail === 'yes';
        // train=yes is authoritative for multimodal heavy-rail/RER/S-Bahn stations.
        // Pure metro/tram/light-rail/monorail stops remain outside heavy-rail gameplay.
        const urbanTransit = train !== 'yes' && pureUrban;
        return {
          id: `osm-${el.type}-${el.id}`, osmType:el.type, osmId:el.id,
          lat:center.lat, lon:center.lon, name:tags.name || `Station ${el.id}`,
          type: tags.railway === 'halt' ? 'halt' : 'station', stationKind, urbanTransit, train:tags.train || '',
          uicRef:tags.uic_ref || tags['ref:UIC'] || tags['ref:UCI'] || '', ref:tags.ref || '',
          network:tags.network || '', operator:tags.operator || '', wikidata:tags.wikidata || '', wheelchair:tags.wheelchair || '',
        };
      }).filter((station): station is NonNullable<typeof station> => station !== null);
  }

  getOSMStations() { return this._stationsOSM; }

  // ============================================================
  // VIEWPORT LOADING — load infrastructure for visible map area
  // ============================================================

  async loadViewport(south: number, west: number, north: number, east: number, margin: number = 0.01) {
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

  _isCovered(south: number, west: number, north: number, east: number) {
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
  setUserTronconProvider(providerFn: unknown) {
    this._userTronconProvider = providerFn;
    this.markGraphDirty();
  }

  markGraphDirty() {
    this._touchTopology();
  }

  // v1.1.46 — expose the exact resident OSM railway geometry that routing can see.
  // This is intentionally read-only and viewport-filtered so the Schedule Creator
  // can draw the engine's topology without rebuilding or scanning the routing graph.
  getLoadedRailwaysInBounds(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    south = Number(south); west = Number(west); north = Number(north); east = Number(east);
    if (![south, west, north, east].every(Number.isFinite)) return [];
    if (south > north) [south, north] = [north, south];
    if (west > east) [west, east] = [east, west];
    const limit = Math.max(1, Number(options.limit || 16000));
    const fallbackScanLimit = Math.max(0, Number(options.fallbackScanLimit ?? 12000));
    const out: OrmWayLike[] = [], seen = new Set();
    let intersectingBoxes = 0;
    const maybePush = (way: OrmWayLike) => {
      const id=String(way?.id ?? '');if(!id || seen.has(id))return false;
      const geom = way?.geometry || [];if (geom.length < 2) return false;
      let b = this._wayBoundsCache.get(way);
      if (!b) {
        let s=Infinity,w=Infinity,n=-Infinity,e=-Infinity;
        for (const q of geom) {
          const lat=Number(q?.lat), lon=Number(q?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          if (lat<s) s=lat; if (lat>n) n=lat; if (lon<w) w=lon; if (lon>e) e=lon;
        }
        if (![s,w,n,e].every(Number.isFinite)) return false;
        b={south:s,west:w,north:n,east:e};this._wayBoundsCache.set(way,b);
      }
      if (b.north < south || b.south > north || b.east < west || b.west > east) return false;
      seen.add(id);out.push(way);return out.length>=limit;
    };
    // Fast path: resident fetch bboxes partition the same objects, so inspect only
    // tiles touching the requested viewport.
    for (const box of this._loadedBboxes || []) {
      if (!box || box.north < south || box.south > north || box.east < west || box.west > east) continue;
      intersectingBoxes++;
      const ways = this.areaCache.get(box.key) || [];
      for (const way of ways) if(maybePush(way)) return out;
    }
    // v1.1.48 — offline/reload compatibility. Some restored/test states can have
    // a small resident _ways set without bbox metadata. Scan it ONLY when it is
    // bounded; never let a continent-scale cache fall back to a global scan.
    if (!intersectingBoxes && this._ways?.size && this._ways.size <= fallbackScanLimit) {
      for (const way of this._ways.values()) if(maybePush(way)) return out;
    }
    return out;
  }

  // Small, resilient viewport fetch used only by the editor's optional engine-OSM
  // overlay. It never changes routing rules and tolerates partial Overpass outages.
  async fetchRailwayViewport(south: unknown, west: unknown, north: unknown, east: unknown) {
    const tiles = this._tileBbox(Number(south), Number(west), Number(north), Number(east), 25);
    return this.fetchRailwayTiles(tiles, null, {
      allowPartial:true, concurrency:2, timeoutMs:12000, attemptsPerEndpoint:1, maxSplitDepth:2,
    });
  }

  // v1.1.47 — fetch the actual OSM switch nodes for the Schedule Creator
  // overlay. These are diagnostic/editor visuals only; routing still derives
  // connectivity from the railway ways and their shared OSM node IDs.
  async fetchRailwaySwitchesViewport(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    south=Number(south);west=Number(west);north=Number(north);east=Number(east);
    if(![south,west,north,east].every(Number.isFinite))return [];
    if(south>north)[south,north]=[north,south];
    if(west>east)[west,east]=[east,west];
    const key=`sw:v1:${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
    if(this._switchAreaCache.has(key))return this._switchAreaCache.get(key);
    const timeoutMs=Math.max(2500,Number(options.timeoutMs||12000));
    const query=`[out:json][timeout:30];node[\"railway\"=\"switch\"](${south},${west},${north},${east});out body;`;
    let lastError=null;
    for(const url of OVERPASS_URLS){
      try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),timeoutMs);
        const resp=await fetch(url,{method:'POST',body:'data='+encodeURIComponent(query),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:controller.signal});
        clearTimeout(timeout);
        if(!resp.ok)throw new Error(`Overpass ${resp.status}`);
        const data=await resp.json();
        if(data?.remark||data?.error)throw new Error(`Overpass payload error: ${data.remark||data.error}`);
        const nodes=(data?.elements||[]).filter((el: HTMLElement) =>el?.type==='node'&&el?.tags?.railway==='switch'&&Number.isFinite(Number(el.lat))&&Number.isFinite(Number(el.lon))).map((el: HTMLElement) =>({
          id:el.id,lat:Number(el.lat),lon:Number(el.lon),tags:{...(el.tags||{})},ref:el.tags?.ref||'',localRef:el.tags?.local_ref||'',
        }));
        this._switchAreaCache.set(key,nodes);
        if(this._switchAreaCache.has(key)&&!this._loadedSwitchBboxes.find((b: { key: unknown }) =>b.key===key))this._loadedSwitchBboxes.push({south,west,north,east,key});
        return nodes;
      }catch(e){lastError=e;console.warn(`ORM switch fetch ${url} failed:`,(e as { message?: string })?.message||e);}
    }
    console.warn('ORM switch fetch failed on all endpoints:',lastError);
    return [];
  }

  getLoadedRailwaySwitchesInBounds(south: number, west: number, north: number, east: number, options: OrmOptions = {}) {
    south=Number(south);west=Number(west);north=Number(north);east=Number(east);
    if(![south,west,north,east].every(Number.isFinite))return [];
    if(south>north)[south,north]=[north,south];
    if(west>east)[west,east]=[east,west];
    const limit=Math.max(1,Number(options.limit||4000));
    const out=[],seen=new Set();
    for(const box of this._loadedSwitchBboxes||[]){
      if(!box||box.north<south||box.south>north||box.east<west||box.west>east)continue;
      for(const sw of this._switchAreaCache.get(box.key)||[]){
        const id=String(sw?.id??'');if(!id||seen.has(id))continue;
        const lat=Number(sw?.lat),lon=Number(sw?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
        if(lat<south||lat>north||lon<west||lon>east)continue;
        seen.add(id);out.push(sw);if(out.length>=limit)return out;
      }
    }
    return out;
  }

  _ensureGraph() {
    if (!this._graphDirty && this._graph) return this._graph;
    this._graph = this._buildUnifiedGraph();
    this._graphDirty = false;
    return this._graph;
  }

  // Cooperative equivalent used by async routing. On giant 500 km imports this
  // prevents the first route request after import from freezing the whole UI while
  // hundreds of thousands of OSM edges are indexed.
  async _ensureGraphAsync(onProgress: ProgressCallback = null) {
    if (!this._graphDirty && this._graph) return this._graph;
    if (this._graphBuildPromise) return this._graphBuildPromise;

    this._graphBuildPromise = (async () => {
      // Mark clean BEFORE yielding. If fresh data arrives during the build,
      // fetchArea/markGraphDirty flips it back to true and we know a later rebuild
      // is needed instead of accidentally clearing the dirty flag.
      this._graphDirty = false;
      const nodes = new Map();
      const ways = [...this._ways.values()];
      let wi = 0;
      for (const way of ways) {
        const geom = way.geometry || [];
        for (let i = 0; i < geom.length - 1; i++) {
          const aKey = wayPointKey(way, i, geom[i]);
          const bKey = wayPointKey(way, i + 1, geom[i + 1]);
          if (aKey === bKey) continue;
          if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
          if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });
          const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
          const forwardMeta = this._edgeMetadata(way, true);
          const backwardMeta = this._edgeMetadata(way, false);
          nodes.get(aKey).edges.push({ from: aKey, to: bKey, dist, ...forwardMeta });
          nodes.get(bKey).edges.push({ from: bKey, to: aKey, dist, ...backwardMeta });
        }
        if ((++wi % 80) === 0) {
          onProgress?.({ phase: 'route-graph', done: wi, total: ways.length, nodes: nodes.size });
          await ormYield();
        }
      }

      try {
        const userTroncons = typeof this._userTronconProvider === 'function' ? this._userTronconProvider() : null;
        if (Array.isArray(userTroncons)) {
          for (let ti = 0; ti < userTroncons.length; ti++) {
            const trc = userTroncons[ti];
            const route = trc?.route;
            if (route?.length >= 2) {
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
                const common = { dist, maxSpeed, electrified: null, tracks: 1, usage: 'main', service: '', wayId: trc.id || 'user-trc' };
                nodes.get(aKey).edges.push({ from: aKey, to: bKey, ...common });
                nodes.get(bKey).edges.push({ from: bKey, to: aKey, ...common });
              }
            }
            if ((ti % 150) === 0) await ormYield();
          }
        }
      } catch (e) { /* graceful */ }

      const graph: OrmGraph = { nodes };
      // Spatial index construction can also be large; build cooperatively.
      const cs = this._cellSize;
      const cells = new Map();
      let ni = 0;
      for (const [, node] of nodes) {
        const ck = Math.floor(node.lat / cs) + ':' + Math.floor(node.lon / cs);
        let bucket = cells.get(ck);
        if (!bucket) { bucket = []; cells.set(ck, bucket); }
        bucket.push(node);
        if ((++ni % 1500) === 0) await ormYield();
      }
      graph._index = { cells, cs };
      this._graph = graph;
      return graph;
    })();

    try {
      return await this._graphBuildPromise;
    } finally {
      this._graphBuildPromise = null;
      // Deliberately DO NOT force _graphDirty=false here: if data arrived during
      // the cooperative build it stays dirty and the next route rebuilds safely.
    }
  }

  _buildUnifiedGraph() {
    const nodes = new Map(); // nodeKey -> { key, lat, lon, edges: [] }

    for (const [, way] of this._ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;

      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = wayPointKey(way, i, geom[i]);
        const bKey = wayPointKey(way, i + 1, geom[i + 1]);
        if (aKey === bKey) continue;

        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });

        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);

        const edge = { from: aKey, to: bKey, dist, ...this._edgeMetadata(way, true) };
        const reverseEdge = { from: bKey, to: aKey, dist, ...this._edgeMetadata(way, false) };

        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
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

    const graph: OrmGraph = { nodes };
    graph._index = this._buildSpatialIndex(nodes);
    return graph;
  }

  // Legacy buildGraph (used by importInfrastructure)
  buildGraph(ways: OrmWayLike[]) {
    const nodes = new Map();
    for (const way of ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = wayPointKey(way, i, geom[i]);
        const bKey = wayPointKey(way, i + 1, geom[i + 1]);
        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });
        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const edge = { from: aKey, to: bKey, dist, ...this._edgeMetadata(way, true) };
        const reverseEdge = { from: bKey, to: aKey, dist, ...this._edgeMetadata(way, false) };
        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
      }
    }
    const graph: OrmGraph = { nodes };
    graph._index = this._buildSpatialIndex(nodes);
    return graph;
  }

  // ============================================================
  // SPATIAL INDEX — grid buckets for O(1) nearest-node lookup
  // Replaces the O(n) linear scan (enables routing at 1200+ km)
  // ============================================================

  _buildSpatialIndex(nodes: Map<string, OrmGraphNode>) {
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

  _nearestViaIndex(graph: OrmGraph, lat: number, lon: number, maxDistKm: number) {
    const { cells, cs } = graph._index!;
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
  _effectiveSpeed(edge: OrmEdgeMetadata, routingMaxSpeed: unknown = null) {
    const cap = routingMaxSpeed ?? this._routingSpeedCapKmh ?? Infinity;
    const isService = (edge.service && edge.service !== '') ||
      (edge.usage && edge.usage !== 'main' && edge.usage !== 'branch');
    // v1.1.73 — FALLBACK_30 means "speed unknown", not a documented 30 km/h
    // restriction. Treating every unknown main-line edge as V30 distorted route
    // choice according to OSM data completeness. Service tracks remain V30.
    let v;
    if (edge.maxSpeedSource === 'FALLBACK_30' && !isService) {
      v = Number.isFinite(cap) && cap > 0 ? cap : 120;
    } else {
      v = edge.maxSpeed != null ? edge.maxSpeed : (isService ? this._serviceSpeedKmh : 120);
    }
    if (isService) v = Math.min(v, this._serviceSpeedKmh);
    if (cap > 0) v = Math.min(v, cap);
    return Math.max(5, v);
  }

  _edgeCompatibleWithProfile(edge: OrmEdgeMetadata, opts: OrmOptions | null = null) {
    if(!opts)return true;
    const traction=String(opts.traction||'').toLowerCase();
    const diesel=traction.includes('diesel')||traction.includes('therm')||traction.includes('gazole');
    const systems=Array.isArray(opts.electricSystems)?opts.electricSystems:[];
    if(!diesel&&systems.length){
      if(edge.electrified===false)return false;
      const volts=Array.isArray(edge.voltage)?edge.voltage:[];
      const freqs=(Array.isArray(edge.frequency)&&edge.frequency.length)?edge.frequency:[0];
      if(edge.electrified===true&&volts.length){
        let ok=false;for(const sys of systems)for(const v of volts)for(const f of freqs){const vok=!Number(sys?.voltage)||Math.abs(Number(sys.voltage)-Number(v))<=Math.max(50,Number(v)*0.03);const fok=!Number(sys?.frequency)||!Number(f)||Math.abs(Number(sys.frequency)-Number(f))<=1;if(vok&&fok)ok=true;}
        if(!ok)return false;
      }
    }
    const wanted=(opts.gauges||[]).map(Number).filter(Number.isFinite),actual=(edge.gauge||[]).map(Number).filter(Number.isFinite);
    if(wanted.length&&actual.length&&!wanted.some((a: __KPStruct642) =>actual.some((b: __KPStruct643) =>Math.abs(a-b)<=1)))return false;
    if(opts.loadingGauge&&edge.loadingGauge&&!loadingGaugeCompatible(opts.loadingGauge,edge.loadingGauge))return false;
    const axle=Number(opts.axleLoad),trackAxle=Number(edge.axleLoad);
    if(Number.isFinite(axle)&&axle>0&&Number.isFinite(trackAxle)&&trackAxle>0&&axle>trackAxle+0.05)return false;
    const metre=Number(opts.metreLoad),trackMetre=Number(edge.metreLoad);
    if(Number.isFinite(metre)&&metre>0&&Number.isFinite(trackMetre)&&trackMetre>0&&metre>trackMetre+0.02)return false;
    return true;
  }

  // Edge cost. Generic gameplay routing keeps the historical time objective.
  // SC V3 can request a DISTANCE objective: physical kilometres are primary,
  // while IPCS/wrong-line, service/yard and abnormal moves remain possible but
  // deliberately unattractive. No edge is fabricated to obtain a cheaper result.
  _edgeCost(edge: OrmGraphEdge, routingMaxSpeed: number | null = null, opts: OrmOptions | null = null) {
    const dist=Math.max(0,Number(edge.dist||0));
    if(String(opts?.routeObjective||'').toLowerCase()==='distance'){
      let cost=dist;
      const service=String(edge.service||'').trim();
      const usage=String(edge.usage||'').trim().toLowerCase();
      if(service) cost += dist*18;
      else if(usage && usage!=='main' && usage!=='branch') cost += dist*6;
      // HOTFIX3: all ORM-visible track classes are usable, but inactive/future
      // infrastructure must never become an accidental shortcut for an ordinary
      // service. A user can still force it by selecting that track or a VIA on it.
      const lifecycle=String(edge.railwayLifecycle||'present').toLowerCase();
      const baseType=String(edge.railwayBaseType||edge.railway||'rail').toLowerCase();
      const lifecyclePenalty={preserved:0.35,construction:2.5,proposed:7,disused:9,abandoned:15,razed:28}[lifecycle]||0;
      const modePenalty={light_rail:2.5,subway:4,tram:7,miniature:14,funicular:18}[baseType]||0;
      if(lifecyclePenalty)cost += dist*lifecyclePenalty;
      if(modePenalty)cost += dist*modePenalty;
      // Prefer the normal running direction strongly enough that a tiny geometric
      // shortcut does not send an automatic path onto IPCS. Manual VIA/track edits
      // can still force it because these edges remain routable.
      if(edge.againstPreferredDirection) cost += dist*4;
      if(edge.signalRestrictedDirection) cost += dist*10;
      return cost;
    }
    const base = dist / this._effectiveSpeed(edge, routingMaxSpeed);
    const wrongDirectionPenalty = edge.againstPreferredDirection ? dist * 0.02 : 0;
    const signallingRestrictionPenalty = edge.signalRestrictedDirection ? dist * 0.05 : 0;
    return base + wrongDirectionPenalty + signallingRestrictionPenalty;
  }

  _edgeStateKey(edge: OrmGraphEdge) {
    // Parallel OSM ways can join the same pair of nodes. Keep the incoming edge
    // identity in the A*/Dijkstra state so one track cannot overwrite another.
    return `${edge.from}>${edge.to}#${String(edge.wayId ?? '')}#${String(edge.travelDirection || '')}`;
  }

  _edgeBearing(graph: OrmGraph, edge: OrmGraphEdge) {
    const a = graph.nodes.get(edge.from);
    const b = graph.nodes.get(edge.to);
    if (!a || !b) return 0;
    return bearing(a.lat, a.lon, b.lat, b.lon);
  }

  // Penalty (hours) for chaining edge `into` after edge `from`.
  // A near-U-turn (angle > _turnPenaltyDeg) is treated as a reversal.
  _turnPenalty(graph: OrmGraph, fromEdge: OrmGraphEdge | null | undefined, intoEdge: OrmGraphEdge, directed: boolean, opts: OrmOptions | null = null) {
    if (!directed || !fromEdge) return 0;
    const distanceObjective=String(opts?.routeObjective||'').toLowerCase()==='distance';
    // Same physical track, opposite direction = pure back-up. v1.1.44 made
    // this Infinity, which could turn an otherwise valid topology into a false
    // 'ORM unavailable' when the cursor landed on a dead-end/platform stub.
    // Keep it as an extreme LAST-RESORT cost instead; every direct crossover or
    // normal connected path wins by many hours, but routing remains available.
    if (intoEdge.to === fromEdge.from && intoEdge.wayId === fromEdge.wayId) {
      return distanceObjective ? 10000 : this._pureBackupPenaltyH;
    }
    const b1 = this._edgeBearing(graph, fromEdge);
    const b2 = this._edgeBearing(graph, intoEdge);
    const turn = angleBetween(b1, b2);
    if (turn > this._turnPenaltyDeg) return distanceObjective ? 200 : this._reversalPenaltyH;

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
        return distanceObjective ? 0.35 : this._switchDivergePenaltyH;
      }
    }
    return 0;
  }

  // v1.1.69 — directed multi-target shortest paths. Uses the same edge costs
  // and turn/reversal policy as _route(), but settles every requested destination
  // in one traversal from a given start candidate.
  _routeToTargets(graph: OrmGraph, startKey: string, targetKeys: string[], opts: OrmOptions | null = null) {
    const directed = !(opts && opts.directed === false);
    const routingMaxSpeed = opts?.maxSpeed ?? null;
    const avoidEdges = opts?.avoidEdges || new Set();
    const wanted = new Set((targetKeys || []).filter((k: string) => k && graph.nodes.has(k)));
    const out = new Map();
    if (!startKey || !graph.nodes.has(startKey) || wanted.size === 0) return out;

    const gScore = new Map();
    const cameFrom = new Map();
    const settled = new Set();
    const heap = new MinHeap();
    const startNode = graph.nodes.get(startKey)!;

    for (const edge of startNode.edges) {
      if (edge.directionForbidden && !opts?.allowSignalRestrictedDirection) continue;
      if (!this._edgeCompatibleWithProfile(edge,opts)) continue;
      if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
      const g = this._edgeCost(edge, routingMaxSpeed, opts);
      const sk = this._edgeStateKey(edge);
      if (g < (gScore.get(sk) ?? Infinity)) {
        gScore.set(sk, g);
        cameFrom.set(sk, { prev: null, edge });
        heap.push({ key: sk, to: edge.to, d: g });
      }
    }

    const targetStates = new Map();
    while (heap.size > 0 && targetStates.size < wanted.size) {
      const cur = heap.pop();
      if (settled.has(cur.key)) continue;
      settled.add(cur.key);
      const toKey = cur.to || cameFrom.get(cur.key)?.edge?.to;
      if (wanted.has(toKey) && !targetStates.has(toKey)) targetStates.set(toKey, cur.key);

      const node = graph.nodes.get(toKey);
      if (!node) continue;
      const inEdge = cameFrom.get(cur.key)?.edge;
      const gCur = gScore.get(cur.key);
      for (const edge of node.edges) {
        if (edge.directionForbidden && !opts?.allowSignalRestrictedDirection) continue;
        if (!this._edgeCompatibleWithProfile(edge,opts)) continue;
        if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
        if (opts?.forbidPureBackup && inEdge && edge.to === inEdge.from && edge.wayId === inEdge.wayId) continue;
        const pen = this._turnPenalty(graph, inEdge, edge, directed, opts);
        if (!isFinite(pen)) continue;
        const sk = this._edgeStateKey(edge);
        if (settled.has(sk)) continue;
        const g = gCur + this._edgeCost(edge, routingMaxSpeed, opts) + pen;
        if (g < (gScore.get(sk) ?? Infinity)) {
          gScore.set(sk, g);
          cameFrom.set(sk, { prev: cur.key, edge });
          heap.push({ key: sk, to: edge.to, d: g });
        }
      }
    }

    const cap = routingMaxSpeed ?? this._routingSpeedCapKmh ?? Infinity;
    const preserveInfrastructureMaxSpeed=opts?.preserveInfrastructureMaxSpeed===true;
    const capSpeed = (v: number) => preserveInfrastructureMaxSpeed?v:(cap > 0 && Number.isFinite(cap) ? Math.min(v, cap) : v);
    const pointFromEdge = (lat: unknown, lon: unknown, e: { maxSpeed: number | null | undefined; maxSpeedSource: unknown; maxSpeedForward: unknown; maxSpeedBackward: unknown; electrified: unknown; electrifiedMode: unknown; voltage: unknown; frequency: unknown; gauge: unknown; loadingGauge: unknown; axleLoad: unknown; metreLoad: unknown; tracks: unknown; wayId: unknown; usage: unknown; service: unknown; railway: unknown; railwayLifecycle: unknown; railwayBaseType: unknown; trafficMode: unknown; preferredDirection: unknown; bidirectional: unknown; oneway: unknown; signalRestrictedDirection: unknown; trainProtection: unknown; name: unknown; ref: unknown; trackRef: unknown; tags: unknown; travelDirection: unknown; againstPreferredDirection: unknown }) => ({
      lat, lon, maxSpeed: capSpeed(e.maxSpeed ?? 30), maxSpeedSource: e.maxSpeedSource || 'FALLBACK_30',
      maxSpeedForward: e.maxSpeedForward ?? null, maxSpeedBackward: e.maxSpeedBackward ?? null,
      electrified: e.electrified ?? null, electrifiedMode: e.electrifiedMode || '',
      voltage: e.voltage || [], frequency: e.frequency || [], gauge: e.gauge || [], loadingGauge: e.loadingGauge || '', axleLoad: e.axleLoad ?? null, metreLoad: e.metreLoad ?? null,
      tracks: e.tracks || 1, wayId: e.wayId, usage: e.usage || '', service: e.service || '', railway: e.railway || 'rail', railwayLifecycle:e.railwayLifecycle||'present', railwayBaseType:e.railwayBaseType||e.railway||'rail',
      trafficMode: e.trafficMode || '', preferredDirection: e.preferredDirection || '', bidirectional: e.bidirectional || '', oneway:e.oneway || '', signalRestrictedDirection:!!e.signalRestrictedDirection,
      trainProtection: e.trainProtection || {}, name: e.name || '', ref: e.ref || '', trackRef: e.trackRef || '', tags: e.tags || {},
      travelDirection: e.travelDirection || '', _againstPreferredDirection: !!e.againstPreferredDirection,
    });

    for (const [targetKey, endStateKey] of targetStates) {
      const edges=[];let sk=endStateKey;
      while(sk){const cf=cameFrom.get(sk);if(!cf)break;edges.unshift(cf.edge);sk=cf.prev;}
      if(!edges.length)continue;
      const path=[pointFromEdge(startNode.lat,startNode.lon,edges[0])];
      for(const e of edges){const n=graph.nodes.get(e.to);if(n)path.push(pointFromEdge(n.lat,n.lon,e));}
      if(path.length>=2)out.set(targetKey,path);
    }
    return out;
  }

  // Public entry point kept for backward compatibility (callers pass keys).
  // `directed` defaults to true; pass { directed:false } for a raw shortest path.
  // `opts.maxSpeed` plafonne la vitesse utilisée pour le calcul d'itinéraire (R-07).
  dijkstra(graph: OrmGraph, startKey: string, endKey: string, opts: OrmOptions | null = null) {
    return this._route(graph, startKey, endKey, opts);
  }

  _route(graph: OrmGraph, startKey: string, endKey: string, opts: OrmOptions | null = null) {
    const directed = !(opts && opts.directed === false);
    const routingMaxSpeed = opts?.maxSpeed ?? null;
    const avoidEdges = opts?.avoidEdges || new Set();
    if (!startKey || !endKey) return null;
    if (!graph.nodes.has(startKey) || !graph.nodes.has(endKey)) return null;
    const endNode = graph.nodes.get(endKey)!;
    if (startKey === endKey) {
      const n = graph.nodes.get(startKey)!;
      return [{ lat: n.lat, lon: n.lon, maxSpeed: 160, electrified: true, tracks: 1 }];
    }

    // Admissible heuristic for the selected objective. SC V3 uses physical
    // distance; generic gameplay keeps straight-line travel time at 320 km/h.
    const MAX_V = 320;
    const distanceObjective=String(opts?.routeObjective||'').toLowerCase()==='distance';
    const h = (key: string) => {
      const n = graph.nodes.get(key)!;
      const d=haversine(n.lat, n.lon, endNode.lat, endNode.lon);
      return distanceObjective ? d : d / MAX_V;
    };

    const gScore = new Map(); // stateKey ("from>to") -> best cost
    const cameFrom = new Map(); // stateKey -> { prev, edge }
    const settled = new Set();
    const heap = new MinHeap();

    const startNode = graph.nodes.get(startKey)!;
    for (const edge of startNode.edges) {
      if (edge.directionForbidden && !opts?.allowSignalRestrictedDirection) continue;
      if (!this._edgeCompatibleWithProfile(edge,opts)) continue;
      if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
      const g = this._edgeCost(edge, routingMaxSpeed, opts);
      const sk = this._edgeStateKey(edge);
      if (g < (gScore.get(sk) ?? Infinity)) {
        gScore.set(sk, g);
        cameFrom.set(sk, { prev: null, edge });
        heap.push({ key: sk, to: edge.to, d: g + h(edge.to) });
      }
    }

    let endStateKey = null;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (settled.has(cur.key)) continue;
      settled.add(cur.key);

      const toKey = cur.to || cameFrom.get(cur.key)?.edge?.to;
      if (toKey === endKey) { endStateKey = cur.key; break; }

      const node = graph.nodes.get(toKey);
      if (!node) continue;
      const inEdge = cameFrom.get(cur.key).edge;
      const gCur = gScore.get(cur.key);

      for (const edge of node.edges) {
        if (edge.directionForbidden && !opts?.allowSignalRestrictedDirection) continue;
        if (!this._edgeCompatibleWithProfile(edge,opts)) continue;
        if (avoidEdges.has(edge.from + '>' + edge.to)) continue;
        if (opts?.forbidPureBackup && inEdge && edge.to === inEdge.from && edge.wayId === inEdge.wayId) continue;
        const pen = this._turnPenalty(graph, inEdge, edge, directed, opts);
        if (!isFinite(pen)) continue; // forbidden reversal
        const sk = this._edgeStateKey(edge);
        if (settled.has(sk)) continue;
        const g = gCur + this._edgeCost(edge, routingMaxSpeed, opts) + pen;
        if (g < (gScore.get(sk) ?? Infinity)) {
          gScore.set(sk, g);
          cameFrom.set(sk, { prev: cur.key, edge });
          heap.push({ key: sk, to: edge.to, d: g + h(edge.to) });
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
    const preserveInfrastructureMaxSpeed=opts?.preserveInfrastructureMaxSpeed===true;
    const capSpeed = (v: number) => preserveInfrastructureMaxSpeed?v:(cap > 0 && Number.isFinite(cap) ? Math.min(v, cap) : v);

    const pointFromEdge = (lat: unknown, lon: unknown, e: { maxSpeed: number | null | undefined; maxSpeedSource: unknown; maxSpeedForward: unknown; maxSpeedBackward: unknown; electrified: unknown; electrifiedMode: unknown; voltage: unknown; frequency: unknown; gauge: unknown; loadingGauge: unknown; axleLoad: unknown; metreLoad: unknown; tracks: unknown; wayId: unknown; usage: unknown; service: unknown; railway: unknown; railwayLifecycle: unknown; railwayBaseType: unknown; trafficMode: unknown; preferredDirection: unknown; bidirectional: unknown; oneway: unknown; signalRestrictedDirection: unknown; trainProtection: unknown; name: unknown; ref: unknown; trackRef: unknown; tags: unknown; travelDirection: unknown; againstPreferredDirection: unknown }) => ({
      lat, lon, maxSpeed: capSpeed(e.maxSpeed ?? 30), maxSpeedSource: e.maxSpeedSource || 'FALLBACK_30',
      maxSpeedForward: e.maxSpeedForward ?? null, maxSpeedBackward: e.maxSpeedBackward ?? null,
      electrified: e.electrified ?? null, electrifiedMode: e.electrifiedMode || '',
      voltage: e.voltage || [], frequency: e.frequency || [], gauge: e.gauge || [], loadingGauge: e.loadingGauge || '', axleLoad: e.axleLoad ?? null, metreLoad: e.metreLoad ?? null,
      tracks: e.tracks || 1, wayId: e.wayId, usage: e.usage || '', service: e.service || '', railway: e.railway || 'rail', railwayLifecycle:e.railwayLifecycle||'present', railwayBaseType:e.railwayBaseType||e.railway||'rail',
      trafficMode: e.trafficMode || '', preferredDirection: e.preferredDirection || '', bidirectional: e.bidirectional || '', oneway:e.oneway || '', signalRestrictedDirection:!!e.signalRestrictedDirection,
      trainProtection: e.trainProtection || {}, name: e.name || '', ref: e.ref || '', trackRef: e.trackRef || '', tags: e.tags || {},
      travelDirection: e.travelDirection || '', _againstPreferredDirection: !!e.againstPreferredDirection,
    });
    const path = [pointFromEdge(startNode.lat, startNode.lon, edges[0])];
    for (const e of edges) {
      const n = graph.nodes.get(e.to)!;
      path.push(pointFromEdge(n.lat, n.lon, e));
    }
    return path;
  }

  // v1.1.88 SC V3 — cooperative A*. Identical edge policy to _route(), but yields
  // periodically so a 1000+ km search cannot freeze the editor. There is NO time
  // budget: only an explicit AbortSignal from the player can stop the search.
  async _routeAsync(graph: OrmGraph, startKey: string, endKey: string, opts: OrmOptions | null = null) {
    const directed = !(opts && opts.directed === false);
    const routingMaxSpeed = opts?.maxSpeed ?? null;
    const avoidEdges = opts?.avoidEdges || new Set();
    const signal=opts?.signal||null;
    const abort=()=>{const e=new Error('Calcul du sillon annulé.');e.name='AbortError';e.code='ROUTE_CANCELLED';throw e;};
    if(signal?.aborted)abort();
    if (!startKey || !endKey || !graph?.nodes?.has(startKey) || !graph.nodes.has(endKey)) return null;
    const endNode=graph.nodes.get(endKey)!,startNode=graph.nodes.get(startKey)!;
    if(startKey===endKey)return [{lat:startNode.lat,lon:startNode.lon,maxSpeed:160,electrified:true,tracks:1}];
    const distanceObjective=String(opts?.routeObjective||'').toLowerCase()==='distance';
    const h=(key: string)=>{const n=graph.nodes.get(key)!,d=haversine(n.lat,n.lon,endNode.lat,endNode.lon);return distanceObjective?d:d/320;};

    // SC Future A4: edge objects themselves are stable unique state IDs. Using
    // `${from}>${to}#${way}` strings for every explored edge generated a large
    // second heap of temporary strings on 300+ km graphs.
    const compactStates=opts?.compactStateKeys===true;
    const gScore=new Map(),cameFrom=new Map(),settled=new Set(),heap=new MinHeap();
    const stateKey=(edge: OrmGraphEdge)=>compactStates?edge:this._edgeStateKey(edge);
    for(const edge of startNode.edges){
      if(edge.directionForbidden&&!opts?.allowSignalRestrictedDirection)continue;
      if(!this._edgeCompatibleWithProfile(edge,opts))continue;
      if(avoidEdges.has(edge.from+'>'+edge.to))continue;
      const g=this._edgeCost(edge,routingMaxSpeed,opts),sk=stateKey(edge);
      if(g<(gScore.get(sk)??Infinity)){gScore.set(sk,g);cameFrom.set(sk,{prev:null,edge});heap.push({key:sk,edge,to:edge.to,d:g+h(edge.to)});}
    }
    let endStateKey=null,expanded=0;
    while(heap.size>0){
      if(signal?.aborted)abort();
      const cur=heap.pop();if(settled.has(cur.key))continue;settled.add(cur.key);
      const curEdge=cur.edge||cameFrom.get(cur.key)?.edge;
      const toKey=cur.to||curEdge?.to;if(toKey===endKey){endStateKey=cur.key;break;}
      const node=graph.nodes.get(toKey);if(!node)continue;const inEdge=curEdge,gCur=gScore.get(cur.key);
      for(const edge of node.edges){
        if(edge.directionForbidden&&!opts?.allowSignalRestrictedDirection)continue;
        if(!this._edgeCompatibleWithProfile(edge,opts))continue;
        if(avoidEdges.has(edge.from+'>'+edge.to))continue;
        if(opts?.forbidPureBackup&&inEdge&&edge.to===inEdge.from&&edge.wayId===inEdge.wayId)continue;
        const pen=this._turnPenalty(graph,inEdge,edge,directed,opts);if(!isFinite(pen))continue;
        const sk=stateKey(edge);if(settled.has(sk))continue;
        const g=gCur+this._edgeCost(edge,routingMaxSpeed,opts)+pen;
        if(g<(gScore.get(sk)??Infinity)){gScore.set(sk,g);cameFrom.set(sk,{prev:cur.key,edge});heap.push({key:sk,edge,to:edge.to,d:g+h(edge.to)});}
      }
      if((++expanded%2000)===0)await ormYield();
    }
    if(!endStateKey)return null;
    const edges=[];let sk=endStateKey;while(sk){const cf=cameFrom.get(sk);if(!cf)break;edges.unshift(cf.edge);sk=cf.prev;}if(!edges.length)return null;
    const cap=routingMaxSpeed??this._routingSpeedCapKmh??Infinity,preserveInfrastructureMaxSpeed=opts?.preserveInfrastructureMaxSpeed===true,capSpeed=(v: number) =>preserveInfrastructureMaxSpeed?v:(cap>0&&Number.isFinite(cap)?Math.min(v,cap):v);
    const pointFromEdge=(lat: unknown,lon: unknown,e: { maxSpeed: number | null | undefined; maxSpeedSource: unknown; maxSpeedForward: unknown; maxSpeedBackward: unknown; electrified: unknown; electrifiedMode: unknown; voltage: unknown; frequency: unknown; gauge: unknown; loadingGauge: unknown; axleLoad: unknown; metreLoad: unknown; tracks: unknown; wayId: unknown; usage: unknown; service: unknown; railway: unknown; railwayLifecycle: unknown; railwayBaseType: unknown; trafficMode: unknown; preferredDirection: unknown; bidirectional: unknown; oneway: unknown; signalRestrictedDirection: unknown; trainProtection: unknown; name: unknown; ref: unknown; trackRef: unknown; tags: unknown; travelDirection: unknown; againstPreferredDirection: unknown })=>({
      lat,lon,maxSpeed:capSpeed(e.maxSpeed??30),maxSpeedSource:e.maxSpeedSource||'FALLBACK_30',
      maxSpeedForward:e.maxSpeedForward??null,maxSpeedBackward:e.maxSpeedBackward??null,electrified:e.electrified??null,electrifiedMode:e.electrifiedMode||'',
      voltage:e.voltage||[],frequency:e.frequency||[],gauge:e.gauge||[],loadingGauge:e.loadingGauge||'',axleLoad:e.axleLoad??null,metreLoad:e.metreLoad??null,tracks:e.tracks||1,
      wayId:e.wayId,usage:e.usage||'',service:e.service||'',railway:e.railway||'rail',railwayLifecycle:e.railwayLifecycle||'present',railwayBaseType:e.railwayBaseType||e.railway||'rail',trafficMode:e.trafficMode||'',preferredDirection:e.preferredDirection||'',
      bidirectional:e.bidirectional||'',oneway:e.oneway||'',signalRestrictedDirection:!!e.signalRestrictedDirection,trainProtection:e.trainProtection||{},name:e.name||'',ref:e.ref||'',trackRef:e.trackRef||'',
      tags:e.tags||{},travelDirection:e.travelDirection||'',_againstPreferredDirection:!!e.againstPreferredDirection,
    });
    const path=[pointFromEdge(startNode.lat,startNode.lon,edges[0])];
    for(const e of edges){const n=graph.nodes.get(e.to);if(n)path.push(pointFromEdge(n.lat,n.lon,e));}
    path._routingDiagnostics={objective:distanceObjective?'distance':'time',expandedStates:expanded,settledStates:settled.size,compactStateKeys:compactStates,compactEdges:!!graph?._compactEdges};
    return path;
  }

  // Dijkstra with intermediate waypoints (forced routing through specific nodes)
  dijkstraConstrained(graph: OrmGraph, startKey: string, endKey: string, waypointKeys: string[], opts: OrmOptions | null = null) {
    if (!waypointKeys || waypointKeys.length === 0) {
      return this.dijkstra(graph, startKey, endKey, opts);
    }
    const allKeys = [startKey, ...waypointKeys, endKey];
    let fullPath: unknown[] | null = null;
    for (let i = 0; i < allKeys.length - 1; i++) {
      const segment = this.dijkstra(graph, allKeys[i], allKeys[i + 1], opts);
      if (!segment || segment.length < 2) return null;
      if (!fullPath) {
        fullPath = segment;
      } else {
        for (let j = 1; j < segment.length; j++) fullPath.push(segment[j]);
      }
    }
    return fullPath;
  }

  // ============================================================
  // SNAP TO NEAREST NODE / WAY — for player clicks
  // ============================================================

  findNearestNode(graph: OrmGraph, lat: number, lon: number, maxDistKm: number = Infinity) {
    // Use the spatial grid when available (O(1) avg vs O(n) scan)
    if (graph._index) return this._nearestViaIndex(graph, lat, lon, maxDistKm);
    let best = null, bestDist = Infinity;
    for (const [, node] of graph.nodes) {
      const d = haversine(lat, lon, node.lat, node.lon);
      if (d < bestDist && d <= maxDistKm) { bestDist = d; best = node; }
    }
    return best ? { node: best, dist: bestDist } : null;
  }

  snapToNearest(lat: number, lon: number, maxDistKm: number = 2) {
    const graph = this._ensureGraph();
    if (!graph || graph.nodes.size === 0) return null;
    return this.findNearestNode(graph, lat, lon, maxDistKm);
  }

  async snapToRailway(lat: number, lon: number, maxDistKm: number = 2) {
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
  snapToWay(lat: number, lon: number, maxDistKm: number = 0.5) {
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

  _projectOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { lat: ax, lon: ay };
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { lat: ax + t * dx, lon: ay + t * dy };
  }

  // Snap to the nearest existing node OR project onto the nearest way segment
  // and split that segment so the projected point becomes a real graph node.
  _snapAndSplitLocalWay(ways: OrmWayLike[], lat: number, lon: number, maxDistKm: number = 5) {
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
    bestSeg!.way.geometry.splice(bestSeg!.idx + 1, 0, bestSeg!.proj);
    return { lat: bestSeg!.proj.lat, lon: bestSeg!.proj.lon, key: `${bestSeg!.proj.lat.toFixed(6)},${bestSeg!.proj.lon.toFixed(6)}`, split: true };
  }

  // Cooperative variant for massive Tracer ligne imports. It scans nodes and
  // segments in ONE pass and yields regularly, so snapping A/B cannot create a
  // visible freeze even with hundreds of thousands of geometry points.
  async _snapAndSplitLocalWayAsync(ways: OrmWayLike[], lat: number, lon: number, maxDistKm: number = 5, onProgress: ProgressCallback = null, label: string = 'snap') {
    let bestNode = null, bestNodeDist = Infinity;
    let bestSeg = null, bestSegDist = Infinity;
    let wi = 0;
    for (const way of ways) {
      const geom = way.geometry || [];
      for (let i = 0; i < geom.length; i++) {
        const p = geom[i];
        const nd = haversine(lat, lon, p.lat, p.lon);
        if (nd < bestNodeDist) { bestNodeDist = nd; bestNode = p; }
        if (i < geom.length - 1) {
          const proj = this._projectOnSegment(lat, lon, p.lat, p.lon, geom[i + 1].lat, geom[i + 1].lon);
          const sd = haversine(lat, lon, proj.lat, proj.lon);
          if (sd < bestSegDist) { bestSegDist = sd; bestSeg = { way, idx: i, proj }; }
        }
      }
      if ((++wi % 80) === 0) {
        onProgress?.({ phase: label, done: wi, total: ways.length });
        await ormYield();
      }
    }
    const bestDist = Math.min(bestNodeDist, bestSegDist);
    if (bestDist > maxDistKm) return null;
    if (bestNodeDist <= bestSegDist && bestNode) {
      return { lat: bestNode.lat, lon: bestNode.lon, key: `${bestNode.lat.toFixed(6)},${bestNode.lon.toFixed(6)}`, split: false };
    }
    if (!bestSeg) return null;
    bestSeg!.way.geometry.splice(bestSeg!.idx + 1, 0, bestSeg!.proj);
    return { lat: bestSeg!.proj.lat, lon: bestSeg!.proj.lon, key: `${bestSeg!.proj.lat.toFixed(6)},${bestSeg!.proj.lon.toFixed(6)}`, split: true };
  }

  // Fast connectivity probe for long-distance imports. It is deliberately
  // independent from the final infrastructure builder: its only job is to tell us
  // whether the currently fetched OSM rail set contains one connected component
  // near both user endpoints. Union-Find keeps this O(N) and avoids a giant graph.
  async _probeRailConnectivity(ways: OrmWayLike[], fromLat: number, fromLon: number, toLat: number, toLon: number, maxSnapKm: number = 12, onProgress: ProgressCallback = null) {
    const keyToIdx = new Map();
    const parent: number[] = [];
    const rank: number[] = [];
    const coords: Array<{ lat: number; lon: number }> = [];
    const make = (key: unknown, lat: number, lon: number) => {
      let idx = keyToIdx.get(key);
      if (idx != null) return idx;
      idx = parent.length;
      keyToIdx.set(key, idx); parent.push(idx); rank.push(0); coords.push({lat,lon});
      return idx;
    };
    const find = (x: number) => { let r=x; while(parent[r]!==r) r=parent[r]; while(parent[x]!==x){ const n=parent[x]; parent[x]=r; x=n; } return r; };
    const union = (a: number,b: number) => { a=find(a); b=find(b); if(a===b)return; if(rank[a]<rank[b]) [a,b]=[b,a]; parent[b]=a; if(rank[a]===rank[b]) rank[a]++; };
    let wi=0;
    for (const way of ways || []) {
      const g=way.geometry || [];
      let prev=null;
      for (const p of g) {
        const k=`${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
        const idx=make(k,p.lat,p.lon);
        if(prev!=null) union(prev,idx);
        prev=idx;
      }
      if ((++wi % 100) === 0) { onProgress?.({phase:'connectivity',done:wi,total:ways.length}); await ormYield(); }
    }
    if (!coords.length) return { connected:false, startDist:Infinity, endDist:Infinity, nodeCount:0 };
    let sIdx=-1,eIdx=-1,sDist=Infinity,eDist=Infinity;
    for (let i=0;i<coords.length;i++) {
      const p=coords[i];
      const ds=haversine(fromLat,fromLon,p.lat,p.lon);
      if(ds<sDist){sDist=ds;sIdx=i;}
      const de=haversine(toLat,toLon,p.lat,p.lon);
      if(de<eDist){eDist=de;eIdx=i;}
      if ((i % 12000) === 0) await ormYield();
    }
    const connected = sIdx>=0 && eIdx>=0 && sDist<=maxSnapKm && eDist<=maxSnapKm && find(sIdx)===find(eIdx);
    return { connected, startDist:sDist, endDist:eDist, nodeCount:coords.length };
  }

  // ============================================================
  // IMPORT INFRASTRUCTURE — "Tracer ligne" mode
  // Now imports ALL ways in the zone, no filtering.
  // Returns voie points (at real junctions) and tronçons.
  // ============================================================

  async importInfrastructure(fromLat: number, fromLon: number, toLat: number, toLon: number, options: OrmOptions = {}) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    // Keep the historical import semantics (whole A/B rectangle), but tile it.
    // Padding grows gently and is capped so a 500 km import does not accidentally
    // request a continent-sized rectangle around the endpoints.
    const padding = Math.max(0.02, Math.min(distKm * 0.0015 + 0.02, 0.18));
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    // Rails have absolute priority. For long-distance traces, query an overlapping
    // corridor instead of the entire A/B rectangle (which can cover half a country
    // on a diagonal 500 km trace). This bounds data volume and keeps import smooth.
    // Short imports keep the historical rectangle semantics.
    const longDistance = distKm > 120;
    const railTiles = longDistance
      ? this._corridorTiles(fromLat, fromLon, toLat, toLon, 20, 18)
      : this._tileBbox(south, west, north, east, 35);
    const stationTiles = longDistance
      ? this._corridorTiles(fromLat, fromLon, toLat, toLon, 28, 20)
      : this._tileBbox(south, west, north, east, 45);
    onProgress?.({ phase: 'tracks', done: 0, total: railTiles.length, ways: 0, distanceKm: distKm, corridor: longDistance });
    let allWays = await this.fetchRailwayTiles(railTiles, onProgress);
    let searchMode = longDistance ? 'corridor' : 'rectangle';

    // A straight geographic corridor is fast, but a real railway can wander far
    // away from the A→B chord. Probe connectivity and, only when necessary, widen
    // automatically to the historical A/B rectangle. This is slower but resilient.
    if (longDistance && allWays.length) {
      const probe = await this._probeRailConnectivity(allWays, fromLat, fromLon, toLat, toLon, 12, onProgress);
      if (!probe.connected) {
        const fallbackTiles = this._tileBbox(south, west, north, east, 35);
        onProgress?.({ phase:'tracks-expand', done:0, total:fallbackTiles.length, ways:allWays.length, reason:'corridor-disconnected' });
        const extraWays = await this.fetchRailwayTiles(fallbackTiles, (p: unknown) => {
          if (!p) return;
          onProgress?.({ ...p, phase:'tracks-expand' });
        });
        const merged = new Map(allWays.map((w: __S3Struct917) => [w.id,w]));
        for (const w of extraWays) merged.set(w.id,w);
        allWays = [...merged.values()];
        searchMode = 'expanded-rectangle';
      }
    }

    const wayById = new Map(allWays.map((w: __S3Struct918) => [w.id, w]));
    if (allWays.length === 0) return { voiePoints: [], troncons: [], stations: [], stationsPromise: null, searchMode };

    // A/B snapping is useful to force endpoints into the compressed graph, but it
    // is NOT allowed to decide whether downloaded rail infrastructure exists.
    // If a click is a few km away from the railway, import what we actually found.
    const startSnap = await this._snapAndSplitLocalWayAsync(allWays, fromLat, fromLon, 12, onProgress, 'snap-start');
    const endSnap = await this._snapAndSplitLocalWayAsync(allWays, toLat, toLon, 12, onProgress, 'snap-end');

    // Build node-level adjacency graph from ALL ways (no filtering!)
    const nodes = new Map();
    let _ormWayLoop = 0;
    for (const way of allWays) {
      if ((++_ormWayLoop % 80) === 0) { onProgress?.({ phase: 'build', done: _ormWayLoop, total: allWays.length }); await ormYield(); }
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
    _ormWayLoop = 0;
    for (const way of allWays) {
      if ((++_ormWayLoop % 80) === 0) { onProgress?.({ phase: 'graph', done: _ormWayLoop, total: allWays.length }); await ormYield(); }
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

    // Use the snapped A/B nodes (existing or projected-and-split).
    // Do NOT build the global routing graph here: it was unused and could freeze
    // the UI on a 500 km import. Routing builds its graph lazily when actually needed.
    const startNode = startSnap ? nodes.get(startSnap.key) : null;
    const endNode = endSnap ? nodes.get(endSnap.key) : null;

    // Identify junction nodes: degree != 2 (real branching/dead-end), optional
    // snapped endpoints, AND OSM-way boundaries. The latter guarantees that a
    // perfectly straight/simple railway still produces importable tronçons.
    const junctionNodes = new Set();
    if (startNode) junctionNodes.add(startNode.key);
    if (endNode) junctionNodes.add(endNode.key);
    for (const way of allWays) {
      const g=way.geometry || [];
      if (g.length) {
        junctionNodes.add(`${g[0].lat.toFixed(6)},${g[0].lon.toFixed(6)}`);
        const z=g[g.length-1]; junctionNodes.add(`${z.lat.toFixed(6)},${z.lon.toFixed(6)}`);
      }
    }
    for (const [nodeKey, neighbors] of nodeGraph) {
      const uniqueNeighbors = new Set(neighbors.map((n: { neighborKey: unknown }) => n.neighborKey));
      if (uniqueNeighbors.size !== 2) junctionNodes.add(nodeKey);
    }

    // Chain-follow between junctions to create tronçons
    const resultVoiePoints: Array<{ id: string; lat: number; lon: number; voie: string; stationId: null; linePoint: boolean }> = [];
    const resultTroncons = [];
    const vpMap = new Map();

    const getOrCreateVP = (nodeKey: unknown) => {
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
    let junctionWork = 0;
    for (const jNodeKey of junctionNodes) {
      if ((++junctionWork % 60) === 0) {
        onProgress?.({ phase: 'chains', done: junctionWork, total: junctionNodes.size, troncons: resultTroncons.length });
        await ormYield();
      }
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
          let nextNb = curNeighbors.find((n: { neighborKey: unknown; wayId: unknown }) => n.neighborKey !== prevKey && n.wayId === chainWayId);
          if (!nextNb) {
            const uniqueCurNbs = [...new Set(curNeighbors.filter((n: { neighborKey: unknown }) => n.neighborKey !== prevKey).map((n: { neighborKey: unknown }) => n.neighborKey))];
            if (uniqueCurNbs.length === 1) {
              nextNb = curNeighbors.find((n: { neighborKey: unknown }) => n.neighborKey === uniqueCurNbs[0]);
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
          const trcRoute = chainPoints.map((p: { lat: unknown; lon: unknown }) => ({
            lat: Number(p.lat), lon: Number(p.lon), maxSpeed: chainMaxSpeed, tracks: 1
          }));
          const dist = trcRoute.reduce((sum: number, p, idx: number) => {
            if (idx === 0) return 0;
            return sum + haversine(trcRoute[idx - 1].lat, trcRoute[idx - 1].lon, p.lat, p.lon);
          }, 0);
          // Keep ALL tronçons — no dédoublonnage of parallel tracks!
          const wayMeta = (wayById.get(chainWayId) || {}) as { name?: string; ref?: string; trackRef?: string };
          resultTroncons.push({
            pointA: vpAId, pointB: vpBId,
            route: trcRoute, distance: Math.round(dist * 10) / 10,
            name: wayMeta.name || '', ref: wayMeta.ref || '', trackRef: wayMeta.trackRef || ''
          });
        }
      }
    }

    // Remove only self-loops (pointA === pointB), keep everything else.
    // The chain-follow above ALREADY emits junction-to-junction tronçons. The old
    // iterative degree-2 simplifier rebuilt the complete degree map after every
    // merge (quadratic on huge imports) and was redundant here.
    const cleanVPs = resultVoiePoints;
    const cleanTrcs = resultTroncons.filter((trc: { pointA: unknown; pointB: unknown }) => trc.pointA !== trc.pointB);
    await ormYield();

    // Resolve stations asynchronously ONLY after the track builder has produced
    // real infrastructure. This prevents the old ghost-progress bug where the UI
    // showed 19/19 station tiles after the track import had already aborted.
    const stationSearchTiles = searchMode === 'expanded-rectangle'
      ? this._tileBbox(south, west, north, east, 45)
      : stationTiles;
    const stationFetchPromise = (cleanVPs.length && cleanTrcs.length)
      ? this.fetchStationTiles(stationSearchTiles, onProgress).catch((e: unknown) => {
          console.warn('ORM station import safely degraded:', e);
          return [];
        })
      : Promise.resolve([]);
    const resolveImportedStations = async () => {
      const fetchedStations = await stationFetchPromise;
      if (!fetchedStations?.length) return [];
      const importedStations = [];
      const stationCandidates = fetchedStations.filter((st: __S3Struct920) =>
        !st.urbanTransit && st.lat >= south && st.lat <= north && st.lon >= west && st.lon <= east
      );

      // Build a coarse grid of route segments once. Avoid station × all-tronçons scans.
      const cell = 0.01; // ~1 km latitude
      const segGrid = new Map();
      const addCell = (iy: unknown, ix: unknown, seg: unknown) => {
        const k = `${iy},${ix}`;
        if (!segGrid.has(k)) segGrid.set(k, []);
        segGrid.get(k).push(seg);
      };
      let stationSegWork = 0;
      for (const trc of cleanTrcs) {
        if ((++stationSegWork % 100) === 0) await ormYield();
        const route = trc.route || [];
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1], b = route[i];
          const minLat = Math.min(a.lat, b.lat) - 0.004, maxLat = Math.max(a.lat, b.lat) + 0.004;
          const minLon = Math.min(a.lon, b.lon) - 0.006, maxLon = Math.max(a.lon, b.lon) + 0.006;
          const iy0 = Math.floor(minLat / cell), iy1 = Math.floor(maxLat / cell);
          const ix0 = Math.floor(minLon / cell), ix1 = Math.floor(maxLon / cell);
          const seg = { a, b };
          for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) addCell(iy, ix, seg);
        }
      }
      const isNearImportedTrack = (st: __S3Struct921) => {
        const iy = Math.floor(st.lat / cell), ix = Math.floor(st.lon / cell);
        const candidates = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const arr = segGrid.get(`${iy + dy},${ix + dx}`);
          if (arr) for (const candidate of arr) candidates.push(candidate);
        }
        const latScale = 111.32;
        const lonScale = Math.max(0.01, 111.32 * Math.cos(st.lat * Math.PI / 180));
        for (const {a,b} of candidates) {
          const ax = (a.lon - st.lon) * lonScale, ay = (a.lat - st.lat) * latScale;
          const bx = (b.lon - st.lon) * lonScale, by = (b.lat - st.lat) * latScale;
          const dx = bx - ax, dy = by - ay;
          const den = dx * dx + dy * dy;
          const t = den > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
          const px = ax + t * dx, py = ay + t * dy;
          if (Math.sqrt(px * px + py * py) <= 0.35) return true;
        }
        return false;
      };
      let stationCheckWork = 0;
      for (const st of stationCandidates) {
        if (isNearImportedTrack(st)) importedStations.push(st);
        if ((++stationCheckWork % 100) === 0) await ormYield();
      }
      return importedStations;
    };
    const stationsPromise = resolveImportedStations();

    // NO pruning of short dead-ends — keep everything!
    // NO dédoublonnage — parallel tracks between same junctions are valid!
    // NO final merge of close VPs — each OSM node is distinct!

    return { voiePoints: cleanVPs, troncons: cleanTrcs, stations: [], stationsPromise, searchMode, waysFetched: allWays.length, snappedA: !!startNode, snappedB: !!endNode };
  }

  // ============================================================
  // ROUTE FINDING — uses unified graph or area-specific graph
  // ============================================================

  // TRV-03/06 : construit un set d'arêtes à éviter à partir de paires de stations
  _avoidEdgesForPairs(graph: OrmGraph, pairs: OrmAvoidStationPair[]) {
    const avoid = new Set<string>();
    if (!graph || !Array.isArray(pairs)) return avoid;
    for (const p of pairs) {
      if (p == null) continue;
      const a = this.findNearestNode(graph, p.latA as number ?? p.lat as number, p.lonA as number ?? p.lon as number, 5);
      const b = this.findNearestNode(graph, p.latB as number ?? p.lat2 as number, p.lonB as number ?? p.lon2 as number, 5);
      if (!a || !b) continue;
      avoid.add(a.node.key + '>' + b.node.key);
      avoid.add(b.node.key + '>' + a.node.key);
    }
    return avoid;
  }

  async findRoute(fromLat: number, fromLon: number, toLat: number, toLon: number, opts: OrmOptions | null = null) {
    const speedSuffix = opts?.maxSpeed ? `v${Math.round(opts.maxSpeed)}` : 'v160';
    const avoidSuffix = Array.isArray(opts?.avoidStationPairs) && opts.avoidStationPairs.length
      ? '-a' + opts.avoidStationPairs.map((p) => [p?.latA ?? p?.lat, p?.lonA ?? p?.lon, p?.latB ?? p?.lat2, p?.lonB ?? p?.lon2]
          .map((v: unknown) => Number.isFinite(Number(v)) ? Number(v).toFixed(5) : '').join(',')).sort().join('|')
      : '';
    const fallbackSuffix = opts?.allowFallback === false ? '-strict' : '-fallback';
    const cacheKey = `${fromLat.toFixed(4)},${fromLon.toFixed(4)}-${toLat.toFixed(4)},${toLon.toFixed(4)}-${speedSuffix}${avoidSuffix}${fallbackSuffix}`;
    if (this.routeCache.has(cacheKey)) return this.routeCache.get(cacheKey);

    // First try the unified graph (pre-loaded areas)
    const uGraph = await this._ensureGraphAsync();
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
      const fallback = opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    // Use the unified graph (now includes new area)
    const graph = await this._ensureGraphAsync();
    if (opts?.avoidStationPairs?.length && graph) {
      routeOpts.avoidEdges = this._avoidEdgesForPairs(graph, opts.avoidStationPairs);
    }
    const snapRadius = distKm < 0.5 ? 0.3 : 5;
    const startResult = this.findNearestNode(graph, fromLat, fromLon, snapRadius);
    const endResult = this.findNearestNode(graph, toLat, toLon, snapRadius);

    if (distKm < 0.5 && (!startResult || !endResult || startResult.node.key === endResult.node.key)) {
      const direct = opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
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
      const graph2 = await this._ensureGraphAsync();
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
      const fallback = opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const path = this.dijkstra(graph, startResult.node.key, endResult.node.key, routeOpts);
    if (!path || path.length === 0) {
      const fallback = opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
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
  async findConstrainedRoute(fromLat: number, fromLon: number, toLat: number, toLon: number, waypointLatLons: GeoPoint[], opts: OrmOptions | null = null) {
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
      return opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const startSnap = this.findNearestNode(graph, fromLat, fromLon, 5);
    const endSnap = this.findNearestNode(graph, toLat, toLon, 5);
    if (!startSnap || !endSnap) {
      return opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const waypointKeys = waypointLatLons.map((wp: __S3Struct925) => {
      const snap = this.findNearestNode(graph, wp.lat, wp.lon, 2);
      return snap ? snap.node.key : null;
    }).filter((k: string | null): k is string => k !== null);

    const path = this.dijkstraConstrained(graph, startSnap.node.key, endSnap.node.key, waypointKeys, opts);
    return path || (opts?.allowFallback === false ? null : this.makeFallbackRoute(fromLat, fromLon, toLat, toLon));
  }

  // R-03: no more straight-line diagonal masquerading as real track.
  // A synthetic straight segment is only produced for SHORT connectors
  // (≤ _maxFallbackKm, e.g. a platform-to-rail stub) and every point is
  // tagged `fallback:true` so the renderer/schedule can flag it. For any
  // longer origin/destination pair with no ORM path we return null and let
  // the caller surface "route introuvable" instead of faking geometry.
  makeFallbackRoute(fromLat: unknown, fromLon: unknown, toLat: unknown, toLon: unknown) {
    // v1.1.32: automatic railway geometry is NEVER synthetic. Manual player-built
    // extensions remain handled by the explicit construction tools, not ORM.
    return null;
  }

  // Is this route a synthetic straight-line fallback (not real ORM track)?
  isFallbackRoute(route: unknown) {
    return Array.isArray(route) && route.length > 0 && route.some((p: { fallback: unknown }) => p && p.fallback);
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  getRouteDistance(route: unknown) {
    if (!Array.isArray(route)) return 0;
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      total += haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
    }
    return total;
  }

  getRouteSegments(route: unknown) {
    const segments: Array<{ from: unknown; to: unknown; distance: number; maxSpeed: number; electrified: boolean; tracks: number }> = [];
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
  calculateTravelTime(route: unknown, rame: Rame, opts: OrmOptions | null = null) {
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
    return applyTravelTimeSafety(Math.max(1 / 60, res.timeSec / 60));
  }

  // Realistic travel time (minutes) using traction physics. Returns null when
  // the rame lacks the data needed (falls back to the zone estimate).
  _physicalTravelTime(route: RoutePoint[], rame: Rame, opts: OrmOptions | null = null) {
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
    return applyTravelTimeSafety(Math.max(1 / 60, res.timeSec / 60));
  }

  generateSignalBlocks(route: unknown) {
    const segments = this.getRouteSegments(route);
    const signals: unknown[] = [];
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

  getPointAtRatio(route: unknown, ratio: number) {
    if (!Array.isArray(route) || route.length < 2) return (route && (route as RoutePoint[])[0]) || { lat: 0, lon: 0 };
    const r = Math.max(0, Math.min(1, ratio));
    let totalDist = 0;
    const segDists: number[] = [];
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

  getCountryAtPoint(lat: number, lon: number) {
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

  isDriveLeft(country: string) {
    return ['FR', 'IT', 'BE', 'GB'].includes(country);
  }

  toSave() {
    // Don't save routeCache — it's huge (100s of MB) and rebuilds on-demand.
    // Persist both historical and currently-resident areas, but keep the two
    // concepts separate after load: a saved bbox is not proof that its ways are
    // resident in a fresh JS process.
    const all: unknown[] = [];
    const seen = new Set();
    for (const bb of [...(this._savedLoadedBboxes || []), ...(this._loadedBboxes || [])]) {
      if (!bb) continue;
      const key = bb.key || `${bb.south},${bb.west},${bb.north},${bb.east}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ ...bb, key });
    }
    return { loadedBboxes: all };
  }

  loadFromSave(saved: { loadedBboxes: unknown }) {
    if (!saved) return;
    // v1.1.43 PERF — bounding boxes from a save are HISTORY, not proof that
    // railway ways are resident in this fresh JS process. Keeping them in
    // _loadedBboxes made _isCovered() lie and forced reloadAreas() to replay the
    // entire historical graph during startup. Keep history separate and let
    // route/snap operations fetch only the areas they actually need.
    this._savedLoadedBboxes = Array.isArray(saved.loadedBboxes) ? saved.loadedBboxes.slice() : [];
    this._loadedBboxes = [];
  }

  // Explicit/manual compatibility helper. Startup no longer calls this.
  async reloadAreas() {
    const pending = Array.isArray(this._savedLoadedBboxes) ? this._savedLoadedBboxes.slice() : [];
    this._savedLoadedBboxes = [];
    for (const bb of pending) {
      if (!bb || !Number.isFinite(Number(bb.south))) continue;
      await this.fetchArea(bb.south, bb.west, bb.north, bb.east);
    }
  }
}


// S3_STRUCT_V2_TEMP
type __S3Struct756 = { "name": string; "message": string; "code": string; "stack": unknown };
type __S3Struct757 = { "route": unknown[] };
type __S3Struct758 = { "route": unknown[] };
type __S3Struct767 = { "id": number; "geometry": unknown; "nodeIds": unknown[]; "tags": unknown };
type __S3Struct773 = { "route": unknown[] };
type __S3Struct774 = { "route": unknown[] };
type __S3Struct776 = { "snapLat": number; "lat": number; "snapLon": number; "lon": number; "wayId": string | number; "segmentIndex": number; "osmSnapshot": { "segmentIndex": number } };
type __S3Struct778 = { "snapLat": number; "lat": number; "snapLon": number; "lon": number; "wayId": string | number; "segmentIndex": number; "osmSnapshot": { "segmentIndex": number } };
type __S3Struct783 = { "distanceM": number };
type __S3Struct784 = { "distanceM": number };
type __S3Struct785 = { "nodes": { "has": (...args: unknown[]) => unknown } };
type __S3Struct786 = { "wayId": string | number; "snapLat": number; "lat": number; "snapLon": number; "lon": number };
type __S3Struct791 = { ways: Map<string | number, { id: string | number; lengthKm: number; cost: number; lat: number; lon: number }>; adj: Map<string | number, Map<string | number, { lat: number; lon: number; nodeId: unknown; fromWayId: string | number; toWayId: string | number }>>; wayCount: number; segmentCount: number; nodeOwners: Map<string | number, string | number | Array<string | number>>; nodeCount: number; maxWays: number; maxNodes: number; maxSegments: number };
type __S3Struct797 = { "lat": number; "lon": number };
type __S3Struct798 = { "lat": number; "lon": number };
type __S3Struct804 = { "score": number };
type __S3Struct805 = { "score": number };
type __S3Struct806 = { "lat": number; "lon": number };
type __S3Struct816 = { "lat": number; "lon": number };
type __S3Struct817 = { "lat": number; "lon": number; "wayId": string | number; "segmentIndex": number; "osmSnapshot": { "segmentIndex": number } };
type __S3Struct820 = { "lat": number; "lon": number };
type __S3Struct821 = { "lat": number; "lon": number; "wayId": string | number; "segmentIndex": number; "osmSnapshot": { "segmentIndex": number } };
type __S3Struct822 = { "id": string };
type __S3Struct824 = { "lat": number; "lon": number; "wayId": string | number; "segmentIndex": number; "osmSnapshot": { "segmentIndex": number } };
type __S3Struct828 = { "way": { "id": string } };
type __S3Struct829 = { "key": unknown; "lat": number; "lon": number; "t": unknown };
type __S3Struct830 = { "t": number };
type __S3Struct831 = { "t": number };
type __S3Struct832 = { "distanceKm": number };
type __S3Struct833 = { "ci": number };
type __S3Struct834 = { "ci": number };
type __S3Struct835 = { "lat": number; "lon": number; "way": { "id": string }; "segmentIndex": number };
type __S3Struct838 = { "lat": number; "lon": number };
type __S3Struct840 = { "p": { "lat": number; "lon": number } };
type __S3Struct841 = { "p": { "lat": number; "lon": number }; "next": { "lat": number; "lon": number }; "way": unknown; "key": unknown };
type __S3Struct843 = { "p": { "lat": number; "lon": number }; "next": { "lon": number; "lat": number } };
type __S3Struct844 = { "b": { "lon": number; "lat": number }; "a": { "lon": number; "lat": number } };
type __S3Struct850 = { "distanceKm": number };
type __S3Struct851 = { "distanceKm": number };
type __S3Struct852 = { "distanceKm": number };
type __S3Struct853 = { "distanceKm": number; "way": { "id": string } };
type __S3Struct854 = { "distanceKm": number; "way": { "id": string } };
type __S3Struct860 = { "key": unknown; "lat": number; "lon": number; "t": unknown };
type __S3Struct861 = { "t": number };
type __S3Struct862 = { "t": number };
type __S3Struct868 = { "way": { "id": string } };
type __S3Struct869 = { "snap": number };
type __S3Struct870 = { "snap": number };
type OverpassElement = { type: string; id: string | number; lat: number; lon: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }>; nodes?: Array<string | number> };
type __S3Struct888 = { elements: OverpassElement[] };
type __S3Struct917 = { "id": string };
type __S3Struct918 = { "id": string };
type __S3Struct919 = { "lat": number; "lon": number };
type __S3Struct920 = { "urbanTransit": number; "lat": number; "lon": number };
type __S3Struct921 = { "lat": number; "lon": number };
type __S3Struct925 = { "lat": number; "lon": number };
