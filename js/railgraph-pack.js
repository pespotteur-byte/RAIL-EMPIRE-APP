// Rail Empire SC V3 — persistent local railway graph pack derived from the
// same OpenStreetMap railway data model used by OpenRailwayMap.
// IMPORTANT: Schedule Creator routing is strictly local. No OSM/Overpass fetch.
const PACK_GLOBAL = '__RAILNET_TRACK_PACK__';
const SHARD_GLOBAL = '__RAILNET_TRACK_SHARD__';
const SHARDS_GLOBAL = '__RAILNET_TRACK_SHARDS__';
const BINARY_SHARDS_GLOBAL = '__RAILNET_TRACK_BINARY_SHARDS__';
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function haversine(aLat, aLon, bLat, bLon) {
    const R = 6371, dLat = (bLat - aLat) * Math.PI / 180, dLon = (bLon - aLon) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
function _b64ToBytes(text) {
    const s = String(text || '');
    if (typeof atob === 'function') {
        const raw = atob(s), out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++)
            out[i] = raw.charCodeAt(i);
        return out;
    }
    if (typeof Buffer !== 'undefined')
        return new Uint8Array(Buffer.from(s, 'base64'));
    throw new Error('Décodeur base64 indisponible pour RailGraph Binary V2.');
}
async function _binaryAssetBytes(entry) {
    let bytes = _b64ToBytes(entry?.data || ''), codec = String(entry?.codec || 'raw').toLowerCase();
    if (codec === 'raw')
        return bytes;
    if (codec !== 'gzip')
        throw new Error(`Codec RailGraph Binary V2 inconnu: ${codec}`);
    if (typeof DecompressionStream !== 'function')
        throw new Error('DecompressionStream gzip indisponible pour RailGraph Binary V2.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
class _RGV2Reader {
    constructor(bytes) { this.b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0); this.i = 0; }
    byte() { if (this.i >= this.b.length)
        throw new Error('RailGraph V2 EOF'); return this.b[this.i++]; }
    raw(n) { const j = this.i + Number(n); if (j > this.b.length)
        throw new Error('RailGraph V2 EOF'); const x = this.b.slice(this.i, j); this.i = j; return x; }
    uvarBig() { let n = 0n, shift = 0n; for (;;) {
        const x = this.byte();
        n |= BigInt(x & 127) << shift;
        if (!(x & 128))
            return n;
        shift += 7n;
        if (shift > 70n)
            throw new Error('RailGraph V2 varint overflow');
    } }
    uvar() { const n = this.uvarBig(); if (n > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('RailGraph V2 integer > MAX_SAFE_INTEGER'); return Number(n); }
    svar() { const u = this.uvarBig(); const n = (u & 1n) ? -(u >> 1n) - 1n : (u >> 1n); if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER))
        throw new Error('RailGraph V2 signed integer overflow'); return Number(n); }
    text() { return new TextDecoder().decode(this.raw(this.uvar())); }
}
const _RGV2F = { RAILWAY: 1 << 0, MAXSPEED: 1 << 1, MAXSPEED_SOURCE: 1 << 2, MAXSPEED_F: 1 << 3, MAXSPEED_B: 1 << 4, E_TRUE: 1 << 5, E_FALSE: 1 << 6, E_MODE: 1 << 7, E_STATE: 1 << 8, VOLTAGE: 1 << 9, FREQUENCY: 1 << 10, GAUGE: 1 << 11, LOADING: 1 << 12, AXLE: 1 << 13, METRE: 1 << 14, TRACKS: 1 << 15, USAGE: 1 << 16, SERVICE: 1 << 17, TRAFFIC: 1 << 18, PREF: 1 << 19, BIDIR: 1 << 20, ONEWAY: 1 << 21, TP: 1 << 22, NAME: 1 << 23, REF: 1 << 24, TRACKREF: 1 << 25, LAYER: 1 << 26, BRIDGE: 1 << 27, TUNNEL: 1 << 28, ORM: 1 << 29 };
const _RGV2STR = [['railway', _RGV2F.RAILWAY], ['maxSpeedSource', _RGV2F.MAXSPEED_SOURCE], ['electrifiedMode', _RGV2F.E_MODE], ['electrifiedState', _RGV2F.E_STATE], ['loadingGauge', _RGV2F.LOADING], ['usage', _RGV2F.USAGE], ['service', _RGV2F.SERVICE], ['trafficMode', _RGV2F.TRAFFIC], ['preferredDirection', _RGV2F.PREF], ['bidirectional', _RGV2F.BIDIR], ['oneway', _RGV2F.ONEWAY], ['name', _RGV2F.NAME], ['ref', _RGV2F.REF], ['trackRef', _RGV2F.TRACKREF], ['layer', _RGV2F.LAYER]];
function _rgv2Arr(r, scale) { const out = [], n = r.uvar(); for (let i = 0; i < n; i++)
    out.push(r.svar() / scale); return out; }
export function decodeRailGraphBinaryV2(bytes) {
    const r = new _RGV2Reader(bytes), magic = String.fromCharCode(...r.raw(4));
    if (magic !== 'RGV2' || r.byte() !== 2)
        throw new Error('Shard RailGraph Binary V2 invalide.');
    const id = r.text(), strings = [];
    for (let i = 0, n = r.uvar(); i < n; i++)
        strings.push(r.text());
    const ways = [];
    for (let wi = 0, wn = r.uvar(); wi < wn; wi++) {
        const mode = r.byte(), wid = mode === 0 ? String(r.uvarBig()) : strings[r.uvar()], flags = r.uvar(), w = { id: wid, tags: {} };
        for (const [field, bit] of _RGV2STR)
            if (flags & bit)
                w[field] = strings[r.uvar()];
        if (!w.railway)
            w.railway = 'rail';
        if (flags & _RGV2F.MAXSPEED)
            w.maxSpeed = r.svar() / 10;
        else
            w.maxSpeed = 30;
        if (flags & _RGV2F.MAXSPEED_F)
            w.maxSpeedForward = r.svar() / 10;
        else
            w.maxSpeedForward = null;
        if (flags & _RGV2F.MAXSPEED_B)
            w.maxSpeedBackward = r.svar() / 10;
        else
            w.maxSpeedBackward = null;
        w.electrified = (flags & _RGV2F.E_TRUE) ? true : ((flags & _RGV2F.E_FALSE) ? false : null);
        w.voltage = (flags & _RGV2F.VOLTAGE) ? _rgv2Arr(r, 1) : [];
        w.frequency = (flags & _RGV2F.FREQUENCY) ? _rgv2Arr(r, 100) : [];
        w.gauge = (flags & _RGV2F.GAUGE) ? _rgv2Arr(r, 10) : [];
        w.axleLoad = (flags & _RGV2F.AXLE) ? r.svar() / 100 : null;
        w.metreLoad = (flags & _RGV2F.METRE) ? r.svar() / 100 : null;
        w.tracks = (flags & _RGV2F.TRACKS) ? r.uvar() : 1;
        w.trainProtection = (flags & _RGV2F.TP) ? JSON.parse(strings[r.uvar()]) : {};
        if (flags & _RGV2F.ORM)
            w.orm = JSON.parse(strings[r.uvar()]);
        if (flags & _RGV2F.BRIDGE)
            w.bridge = true;
        if (flags & _RGV2F.TUNNEL)
            w.tunnel = true;
        const n = r.uvar(), nodeMode = r.byte(), nodeIds = [];
        if (nodeMode === 0) {
            let prev = 0n;
            for (let i = 0; i < n; i++) {
                const x = i === 0 ? r.uvarBig() : prev + BigInt(r.svar());
                nodeIds.push(String(x));
                prev = x;
            }
        }
        else
            for (let i = 0; i < n; i++)
                nodeIds.push(strings[r.uvar()]);
        const geometry = [];
        let plat = 0, plon = 0;
        for (let i = 0; i < n; i++) {
            const lat = i === 0 ? r.svar() : plat + r.svar(), lon = i === 0 ? r.svar() : plon + r.svar();
            geometry.push({ lat: lat / 1e7, lon: lon / 1e7 });
            plat = lat;
            plon = lon;
        }
        w.nodeIds = nodeIds;
        w.geometry = geometry;
        ways.push(w);
    }
    if (r.i !== r.b.length)
        throw new Error('Shard RailGraph Binary V2 contient des octets résiduels.');
    return { schema: 'rail-empire-railgraph-shard-v2', id, ways };
}
export function decodeRailGraphCoarseBinaryV2(bytes) {
    const r = new _RGV2Reader(bytes), magic = String.fromCharCode(...r.raw(4));
    if (magic !== 'RGC2' || r.byte() !== 2)
        throw new Error('Coarse RailGraph Binary V2 invalide.');
    const cellDeg = r.uvar() / 1e6, nodes = [];
    let plat = 0, plon = 0;
    for (let i = 0, n = r.uvar(); i < n; i++) {
        const mode = r.byte(), key = mode === 0 ? String(r.uvarBig()) : new TextDecoder().decode(r.raw(r.uvar()));
        const lat = i === 0 ? r.svar() : plat + r.svar(), lon = i === 0 ? r.svar() : plon + r.svar(), sh = r.svar();
        const row = [key, lat, lon];
        if (sh >= 0)
            row.push(sh);
        nodes.push(row);
        plat = lat;
        plon = lon;
    }
    const edges = [];
    for (let i = 0, n = r.uvar(); i < n; i++) {
        const a = r.uvar(), b = r.uvar(), dist = r.uvar(), sn = r.uvar(), ss = [];
        let prev = 0;
        for (let j = 0; j < sn; j++) {
            const x = j === 0 ? r.uvar() : prev + r.uvar();
            ss.push(x);
            prev = x;
        }
        edges.push([a, b, dist, ss, r.svar()]);
    }
    if (r.i !== r.b.length)
        throw new Error('Coarse RailGraph Binary V2 contient des octets résiduels.');
    return { cellDeg, nodes, edges };
}
function defaultScriptLoader(src) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined')
            return reject(new Error('DOM indisponible pour le pack RailGraph local.'));
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => { s.remove(); resolve(true); };
        s.onerror = () => { s.remove(); reject(new Error(`Impossible de charger le shard RailGraph local: ${src}`)); };
        document.head.appendChild(s);
    });
}
class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i) {
        const p = (i - 1) >> 1;
        if (a[p].f <= x.f)
            break;
        a[i] = a[p];
        i = p;
    } a[i] = x; }
    pop() { const a = this.a; if (!a.length)
        return null; const root = a[0], last = a.pop(); if (a.length) {
        a[0] = last;
        let i = 0;
        while (true) {
            let l = i * 2 + 1, r = l + 1, b = i;
            if (l < a.length && a[l].f < a[b].f)
                b = l;
            if (r < a.length && a[r].f < a[b].f)
                b = r;
            if (b === i)
                break;
            [a[i], a[b]] = [a[b], a[i]];
            i = b;
        }
    } return root; }
}
export class RailGraphPack {
    constructor({ scriptLoader = null, basePath = 'data/railnet/tracks/', maxLoadedShards = 192, maxResidentBytes = 96 * 1024 * 1024, maxConcurrentShardLoads = 2 } = {}) {
        this.manifest = null;
        this.loadedShards = new Set();
        this.loadingShards = new Map();
        this.ways = new Map();
        this.shardWayIds = new Map(); // shard id -> Set(way id)
        this.wayRefCount = new Map(); // way id -> number of resident shards referencing it
        this.shardTouch = new Map();
        this._touchSerial = 0;
        this.maxLoadedShards = Math.max(16, Math.floor(num(maxLoadedShards, 192) || 192));
        // 3 GB-friendly hard cap: detailed RailGraph residency is byte-bounded, not
        // merely shard-count-bounded. This governor never simplifies topology; when
        // an exact corridor cannot fit, routing fails explicitly instead of risking OOM.
        this.maxResidentBytes = Math.max(8 * 1024 * 1024, Math.floor(num(maxResidentBytes, 96 * 1024 * 1024) || 96 * 1024 * 1024));
        this.maxConcurrentShardLoads = Math.max(1, Math.min(6, Math.floor(num(maxConcurrentShardLoads, 2) || 2)));
        this.residentWayBytes = 0;
        this.wayResidentBytes = new Map();
        this._coarse = null;
        this._coarseIndex = null;
        this._gridIndex = null;
        this._scriptLoader = scriptLoader || defaultScriptLoader;
        this._basePath = String(basePath || 'data/railnet/tracks/');
    }
    async ready() {
        if (this.manifest)
            return this.manifest;
        const m = globalThis?.[PACK_GLOBAL];
        if (!m) {
            this.manifest = { schema: 'rail-empire-railgraph-v1', prepared: false, reason: 'manifest-missing', shards: [] };
            return this.manifest;
        }
        this.manifest = m;
        if (m.prepared && m.coarse)
            this._prepareCoarse(m.coarse);
        else if (m.prepared && m.coarseFile) {
            if (!globalThis[BINARY_SHARDS_GLOBAL] || typeof globalThis[BINARY_SHARDS_GLOBAL] !== 'object')
                globalThis[BINARY_SHARDS_GLOBAL] = Object.create(null);
            await this._scriptLoader(`${this._basePath}${String(m.coarseFile)}`, { coarse: true });
            const entry = globalThis[BINARY_SHARDS_GLOBAL]?.['__coarse__'];
            if (globalThis[BINARY_SHARDS_GLOBAL])
                delete globalThis[BINARY_SHARDS_GLOBAL]['__coarse__'];
            if (!entry)
                throw new Error('Coarse RailGraph Binary V2 absent.');
            this._prepareCoarse(decodeRailGraphCoarseBinaryV2(await _binaryAssetBytes(entry)));
        }
        this._prepareGridIndex();
        return this.manifest;
    }
    get prepared() { return !!this.manifest?.prepared; }
    get source() { return this.manifest?.source || 'OpenRailwayMap railway data'; }
    _prepareGridIndex() {
        if (this._gridIndex || !this.manifest)
            return this._gridIndex;
        const grid = this.manifest.grid || {}, cell = num(grid.cellDeg, 0);
        const cells = new Map();
        if (cell > 0 && grid.cells && typeof grid.cells === 'object') {
            for (const [k, v] of Object.entries(grid.cells))
                cells.set(k, (Array.isArray(v) ? v : [v]).map(Number).filter(Number.isInteger));
            this._gridIndex = { cell, cells };
            return this._gridIndex;
        }
        // Compatibility fallback for older packs: build a grid once from shard bboxes.
        const fallbackCell = Math.max(0.05, num(this.manifest.shardCellDeg, 0.2) || 0.2);
        (this.manifest.shards || []).forEach((s, i) => {
            const south = num(s.south), north = num(s.north), west = num(s.west), east = num(s.east);
            for (let r = Math.floor(south / fallbackCell); r <= Math.floor(north / fallbackCell); r++)
                for (let c = Math.floor(west / fallbackCell); c <= Math.floor(east / fallbackCell); c++) {
                    const k = `${r}:${c}`;
                    let a = cells.get(k);
                    if (!a) {
                        a = [];
                        cells.set(k, a);
                    }
                    a.push(i);
                }
        });
        this._gridIndex = { cell: fallbackCell, cells };
        return this._gridIndex;
    }
    _prepareCoarse(raw) {
        if (this._coarse)
            return this._coarse;
        const nodes = (raw.nodes || []).map((r, i) => ({ i, key: String(r[0] ?? i), lat: num(r[1]) / 1e6, lon: num(r[2]) / 1e6, shard: Number.isInteger(Number(r[3])) ? Number(r[3]) : -1, edges: [] }));
        for (const e of raw.edges || []) {
            const a = num(e[0], -1), b = num(e[1], -1), dist = Math.max(0.000001, num(e[2]) / 1000), dir = num(e[4], 0);
            const shards = (Array.isArray(e[3]) ? e[3] : [e[3]]).map(Number).filter(Number.isInteger);
            if (!nodes[a] || !nodes[b])
                continue;
            if (dir !== -1)
                nodes[a].edges.push({ to: b, dist, shards });
            if (dir !== 1)
                nodes[b].edges.push({ to: a, dist, shards });
        }
        this._coarse = { nodes };
        const cell = num(raw.cellDeg, 0.25) || 0.25, cells = new Map();
        for (const n of nodes) {
            const k = `${Math.floor(n.lat / cell)}:${Math.floor(n.lon / cell)}`;
            let b = cells.get(k);
            if (!b) {
                b = [];
                cells.set(k, b);
            }
            b.push(n);
        }
        this._coarseIndex = { cell, cells };
        return this._coarse;
    }
    _nearestCoarse(lat, lon, maxKm = 80) {
        if (!this._coarseIndex)
            return null;
        const { cell, cells } = this._coarseIndex, cr = Math.floor(lat / cell), cc = Math.floor(lon / cell);
        const maxRing = Math.max(2, Math.ceil(maxKm / (Math.max(0.05, cell) * 70)) + 2);
        let best = null, bd = Infinity, found = -1;
        for (let ring = 0; ring <= maxRing; ring++) {
            for (let dr = -ring; dr <= ring; dr++)
                for (let dc = -ring; dc <= ring; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring)
                        continue;
                    for (const n of cells.get(`${cr + dr}:${cc + dc}`) || []) {
                        const d = haversine(lat, lon, n.lat, n.lon);
                        if (d < bd) {
                            bd = d;
                            best = n;
                            if (found < 0)
                                found = ring;
                        }
                    }
                }
            if (best && ring >= found + 2)
                break;
        }
        return best && bd <= maxKm ? { node: best, distKm: bd } : null;
    }
    _coarseRoute(from, to) {
        if (!this._coarse?.nodes?.length)
            return null;
        const s = this._nearestCoarse(num(from.snapLat ?? from.lat), num(from.snapLon ?? from.lon));
        const t = this._nearestCoarse(num(to.snapLat ?? to.lat), num(to.snapLon ?? to.lon));
        if (!s || !t)
            return null;
        const nodes = this._coarse.nodes, end = t.node;
        const g = new Float64Array(nodes.length);
        g.fill(Infinity);
        g[s.node.i] = 0;
        const prev = new Int32Array(nodes.length);
        prev.fill(-1);
        const prevShards = new Array(nodes.length);
        const closed = new Uint8Array(nodes.length), heap = new Heap();
        const h = (i) => haversine(nodes[i].lat, nodes[i].lon, end.lat, end.lon);
        heap.push({ i: s.node.i, f: h(s.node.i) });
        while (heap.size) {
            const cur = heap.pop();
            if (!cur || closed[cur.i])
                continue;
            closed[cur.i] = 1;
            if (cur.i === end.i)
                break;
            for (const e of nodes[cur.i].edges) {
                if (closed[e.to])
                    continue;
                const ng = g[cur.i] + e.dist;
                if (ng < g[e.to]) {
                    g[e.to] = ng;
                    prev[e.to] = cur.i;
                    prevShards[e.to] = e.shards || [];
                    heap.push({ i: e.to, f: ng + h(e.to) });
                }
            }
        }
        if (!Number.isFinite(g[end.i]))
            return null;
        const shardIds = [], nodePath = [];
        let i = end.i;
        while (i >= 0) {
            nodePath.push(i);
            if (i !== s.node.i) {
                for (const sh of prevShards[i] || [])
                    if (Number.isInteger(Number(sh)))
                        shardIds.push(Number(sh));
                i = prev[i];
            }
            else
                break;
        }
        nodePath.reverse();
        for (const ni of nodePath) {
            const si = nodes[ni]?.shard;
            if (Number.isInteger(si) && si >= 0)
                shardIds.push(si);
        }
        return { distanceKm: g[end.i], nodePath, shardIndexes: [...new Set(shardIds)] };
    }
    _shardMeta(idx) { return this.manifest?.shards?.[idx] || null; }
    _shardId(idx) { const m = this._shardMeta(idx); return m ? String(m.id ?? idx) : ''; }
    _wayNodeIds(w) { return Array.isArray(w?.nodeIds) ? w.nodeIds.map(String) : []; }
    _containsNodeChain(big, small) {
        if (!small.length || small.length > big.length)
            return false;
        outer: for (let i = 0; i <= big.length - small.length; i++) {
            for (let j = 0; j < small.length; j++)
                if (big[i + j] !== small[j])
                    continue outer;
            return true;
        }
        return false;
    }
    _preferWayVariant(current, incoming) {
        if (!current)
            return incoming;
        const a = this._wayNodeIds(current), b = this._wayNodeIds(incoming);
        if (!a.length || !b.length)
            return (incoming?.geometry?.length || 0) > (current?.geometry?.length || 0) ? incoming : current;
        if (a.length === b.length && a.every((x, i) => x === b[i]))
            return current;
        if (this._containsNodeChain(b, a))
            return incoming;
        if (this._containsNodeChain(a, b))
            return current;
        // A prepared pack should never contain incompatible geometries for one OSM
        // way id. Keep the first one fail-closed; build-time merge QA catches this.
        return current;
    }
    async _loadShardIndex(idx) {
        idx = Number(idx);
        if (!Number.isInteger(idx) || idx < 0)
            return null;
        const meta = this._shardMeta(idx);
        if (!meta)
            return null;
        const id = String(meta.id ?? idx);
        if (this.loadedShards.has(id)) {
            this._touchShard(id);
            return { id, added: 0, totalWays: this.ways.size, cached: true };
        }
        if (this.loadingShards.has(id))
            return this.loadingShards.get(id);
        const p = (async () => {
            if (!globalThis[SHARDS_GLOBAL] || typeof globalThis[SHARDS_GLOBAL] !== 'object')
                globalThis[SHARDS_GLOBAL] = Object.create(null);
            globalThis[SHARD_GLOBAL] = null;
            await this._scriptLoader(`${this._basePath}${String(meta.file || '')}`, { index: idx, meta });
            // Binary V2 keeps file:// compatibility: the .js wrapper only registers a
            // compressed base64 byte stream, then this decoder reconstructs the exact
            // way/node topology in memory. V1 JSON shards remain supported in parallel.
            let payload = null;
            const binEntry = globalThis[BINARY_SHARDS_GLOBAL]?.[id];
            if (binEntry) {
                payload = decodeRailGraphBinaryV2(await _binaryAssetBytes(binEntry));
                if (globalThis[BINARY_SHARDS_GLOBAL])
                    delete globalThis[BINARY_SHARDS_GLOBAL][id];
            }
            else
                payload = globalThis[SHARDS_GLOBAL]?.[id] || globalThis[SHARD_GLOBAL];
            if (globalThis[SHARDS_GLOBAL])
                delete globalThis[SHARDS_GLOBAL][id];
            globalThis[SHARD_GLOBAL] = null;
            if (!payload || String(payload.id ?? id) !== id || !Array.isArray(payload.ways))
                throw new Error(`Shard RailGraph invalide: ${id}`);
            let added = 0;
            const ids = new Set();
            for (const w of payload.ways) {
                if (!w || w.id == null || !Array.isArray(w.geometry) || w.geometry.length < 2)
                    continue;
                const k = String(w.id);
                if (ids.has(k))
                    continue;
                ids.add(k);
                this.wayRefCount.set(k, (this.wayRefCount.get(k) || 0) + 1);
                const existing = this.ways.get(k);
                if (!existing) {
                    const wb = this._estimateWayResidentBytes(w);
                    this.ways.set(k, w);
                    this.wayResidentBytes.set(k, wb);
                    this.residentWayBytes += wb;
                    added++;
                }
                else {
                    const preferred = this._preferWayVariant(existing, w);
                    if (preferred !== existing) {
                        const prevBytes = this.wayResidentBytes.get(k) || this._estimateWayResidentBytes(existing), nextBytes = this._estimateWayResidentBytes(preferred);
                        this.ways.set(k, preferred);
                        this.wayResidentBytes.set(k, nextBytes);
                        this.residentWayBytes += nextBytes - prevBytes;
                    }
                }
            }
            this.shardWayIds.set(id, ids);
            this.loadedShards.add(id);
            this._touchShard(id);
            return { id, added, totalWays: this.ways.size, cached: false };
        })().finally(() => this.loadingShards.delete(id));
        this.loadingShards.set(id, p);
        return p;
    }
    _touchShard(id) { this.shardTouch.set(String(id), ++this._touchSerial); }
    _estimateWayResidentBytes(w) {
        if (!w)
            return 0;
        // Conservative JS-object estimate. It deliberately overestimates common V2
        // ways so the cap protects old/32-bit browsers rather than chasing a precise
        // engine-specific heap figure.
        let n = 1024;
        const ids = Array.isArray(w.nodeIds) ? w.nodeIds : [], geom = Array.isArray(w.geometry) ? w.geometry : [];
        n += geom.length * 128;
        for (const id of ids)
            n += 64 + String(id ?? '').length * 2;
        for (const k of ['railway', 'maxSpeedSource', 'electrifiedMode', 'electrifiedState', 'loadingGauge', 'usage', 'service', 'trafficMode', 'preferredDirection', 'bidirectional', 'oneway', 'name', 'ref', 'trackRef', 'layer']) {
            const v = w?.[k];
            if (v != null)
                n += 48 + String(v).length * 2;
        }
        if (w?.trainProtection)
            try {
                n += 128 + JSON.stringify(w.trainProtection).length * 2;
            }
            catch { }
        if (w?.orm)
            try {
                n += 256 + JSON.stringify(w.orm).length * 2;
            }
            catch { }
        return Math.max(1024, Math.ceil(n / 64) * 64);
    }
    _estimateIndexesRuntimeBytes(indexes) {
        let total = 0;
        for (const idx of indexes || []) {
            const m = this._shardMeta(idx);
            if (!m)
                continue;
            if (this.loadedShards.has(String(m.id ?? idx)))
                continue;
            total += Math.max(0, num(m.runtimeEstimateBytes, 0));
        }
        return total;
    }
    _memoryBudgetError(requiredBytes, indexes = []) {
        const e = new Error(`Corridor ferroviaire exact trop volumineux pour le budget mémoire RailGraph (${Math.ceil(requiredBytes / 1048576)} Mo > ${Math.floor(this.maxResidentBytes / 1048576)} Mo).`);
        e.code = 'RAILGRAPH_MEMORY_BUDGET_EXCEEDED';
        e.requiredBytes = Math.ceil(requiredBytes);
        e.budgetBytes = this.maxResidentBytes;
        e.shardIndexes = [...(indexes || [])];
        return e;
    }
    _prepareMemoryForIndexes(indexes) {
        const wanted = [...new Set((indexes || []).map(Number).filter(Number.isInteger))];
        const incoming = this._estimateIndexesRuntimeBytes(wanted);
        // First evict everything unrelated that is safe to evict. Pinned/wanted
        // shards are never removed while preparing an exact calculation.
        const pinned = new Set(wanted.map((i) => this._shardId(i)).filter(Boolean));
        const victims = [...this.loadedShards].filter((id) => !pinned.has(id) && !this.loadingShards.has(id))
            .sort((a, b) => (this.shardTouch.get(a) || 0) - (this.shardTouch.get(b) || 0));
        for (const id of victims) {
            if (this.residentWayBytes + incoming <= this.maxResidentBytes)
                break;
            this._evictShard(id);
        }
        const projected = this.residentWayBytes + incoming;
        if (projected > this.maxResidentBytes)
            throw this._memoryBudgetError(projected, wanted);
        return { incomingBytes: incoming, projectedBytes: projected };
    }
    _evictShard(id) {
        id = String(id);
        if (!this.loadedShards.has(id) || this.loadingShards.has(id))
            return false;
        const ids = this.shardWayIds.get(id) || [];
        this.loadedShards.delete(id);
        this.shardWayIds.delete(id);
        this.shardTouch.delete(id);
        for (const wayId of ids) {
            const left = (this.wayRefCount.get(wayId) || 0) - 1;
            if (left <= 0) {
                this.wayRefCount.delete(wayId);
                this.ways.delete(wayId);
                this.residentWayBytes = Math.max(0, this.residentWayBytes - (this.wayResidentBytes.get(wayId) || 0));
                this.wayResidentBytes.delete(wayId);
            }
            else
                this.wayRefCount.set(wayId, left);
        }
        return true;
    }
    trimCache({ pinnedIndexes = [] } = {}) {
        const limit = this.maxLoadedShards, byteLimit = this.maxResidentBytes;
        if (this.loadedShards.size <= limit && this.residentWayBytes <= byteLimit)
            return 0;
        const pinned = new Set((pinnedIndexes || []).map((i) => this._shardId(i)).filter(Boolean));
        const victims = [...this.loadedShards].filter((id) => !pinned.has(id) && !this.loadingShards.has(id))
            .sort((a, b) => (this.shardTouch.get(a) || 0) - (this.shardTouch.get(b) || 0));
        let evicted = 0;
        for (const id of victims) {
            if (this.loadedShards.size <= limit && this.residentWayBytes <= byteLimit)
                break;
            if (this._evictShard(id))
                evicted++;
        }
        return evicted;
    }
    _expandShardNeighborhood(indexes, ring = 1) {
        const out = new Set((indexes || []).map(Number).filter(Number.isInteger)), shards = this.manifest?.shards || [];
        for (let r = 0; r < ring; r++)
            for (const idx of [...out])
                for (const x of shards[idx]?.neighbors || []) {
                    const n = Number(x);
                    if (Number.isInteger(n))
                        out.add(n);
                }
        return [...out];
    }
    _waysForShardIndexes(indexes) {
        const out = [], seen = new Set();
        for (const idx of indexes || []) {
            const id = this._shardId(idx);
            if (!id)
                continue;
            for (const wayId of this.shardWayIds.get(id) || []) {
                if (seen.has(wayId))
                    continue;
                const w = this.ways.get(wayId);
                if (w) {
                    seen.add(wayId);
                    out.push(w);
                }
            }
        }
        // Keep corridor metadata off JSON serialization but available to the router/tests.
        Object.defineProperty(out, '_railGraphShardIndexes', { value: [...(indexes || [])], enumerable: false, configurable: true });
        return out;
    }
    async _loadIndexes(indexes, onProgress = null) {
        const all = [...new Set((indexes || []).map(Number).filter(Number.isInteger))];
        let done = 0;
        this._prepareMemoryForIndexes(all);
        const queue = all.slice(), workers = [];
        const worker = async () => { while (queue.length) {
            const idx = queue.shift();
            await this._loadShardIndex(idx);
            done++;
            onProgress?.({ phase: 'railgraph-local', done, total: all.length, loadedWays: this.ways.size, residentBytes: this.residentWayBytes, budgetBytes: this.maxResidentBytes });
            await new Promise((r) => setTimeout(r, 0));
        } };
        const n = Math.min(this.maxConcurrentShardLoads, Math.max(1, queue.length));
        for (let i = 0; i < n; i++)
            workers.push(worker());
        await Promise.all(workers);
        // Runtime estimates are conservative, but never allow unexpected object
        // expansion to silently cross the hard cap after decode.
        if (this.residentWayBytes > this.maxResidentBytes)
            throw this._memoryBudgetError(this.residentWayBytes, all);
        return all;
    }
    async ensureForAnchors(anchors, { neighborRing = 1, onProgress = null } = {}) {
        await this.ready();
        if (!this.prepared) {
            const e = new Error('Pack vectoriel ferroviaire ORM local non installé.');
            e.code = 'RAILGRAPH_PACK_MISSING';
            throw e;
        }
        const list = (anchors || []).filter((a) => Number.isFinite(Number(a?.snapLat ?? a?.lat)) && Number.isFinite(Number(a?.snapLon ?? a?.lon)));
        if (list.length < 2)
            return [];
        const base = new Set();
        // Anchor cells are authoritative too. A click may lie midway between two
        // coarse nodes; the coarse path can legally leave from the nearest node in
        // the opposite direction and otherwise omit the shard containing the exact
        // clicked way. Always seed every departure/VIA/arrival cell explicitly.
        for (const a of list) {
            const lat = num(a?.snapLat ?? a?.lat), lon = num(a?.snapLon ?? a?.lon);
            for (const idx of this._shardsForBBox({ south: lat, west: lon, north: lat, east: lon }))
                base.add(idx);
        }
        for (let i = 1; i < list.length; i++) {
            const r = this._coarseRoute(list[i - 1], list[i]);
            if (!r) {
                const e = new Error('Index ferroviaire ORM local incomplet autour des points sélectionnés.');
                e.code = 'RAILGRAPH_INDEX_GAP';
                throw e;
            }
            for (const idx of r.shardIndexes)
                base.add(idx);
        }
        const wanted = this._expandShardNeighborhood([...base], Math.max(0, Number(neighborRing) || 0));
        const all = await this._loadIndexes(wanted, onProgress);
        const ways = this._waysForShardIndexes(all);
        // Tell the router whether a wider retry can add any new real railway data.
        // This prevents both arbitrary fixed retry counts and infinite retries once
        // the connected shard neighbourhood has actually been exhausted.
        const next = this._expandShardNeighborhood(wanted, 1);
        const exhausted = next.length === wanted.length;
        Object.defineProperty(ways, '_railGraphNeighborRing', { value: Math.max(0, Number(neighborRing) || 0), enumerable: false, configurable: true });
        Object.defineProperty(ways, '_railGraphExhausted', { value: exhausted, enumerable: false, configurable: true });
        Object.defineProperty(ways, '_railGraphBaseShardIndexes', { value: [...base], enumerable: false, configurable: true });
        return ways;
    }
    _bboxIntersects(a, b) { return a && b && num(a.north) >= num(b.south) && num(a.south) <= num(b.north) && num(a.east) >= num(b.west) && num(a.west) <= num(b.east); }
    _shardsForBBox(bb) {
        const gi = this._prepareGridIndex();
        if (!gi?.cell)
            return [];
        const out = new Set(), cell = gi.cell;
        for (let r = Math.floor(bb.south / cell); r <= Math.floor(bb.north / cell); r++)
            for (let c = Math.floor(bb.west / cell); c <= Math.floor(bb.east / cell); c++)
                for (const i of gi.cells.get(`${r}:${c}`) || []) {
                    const s = this._shardMeta(i);
                    if (this._bboxIntersects(s, bb))
                        out.add(i);
                }
        return [...out];
    }
    async ensureNear(lat, lon, radiusKm = 1) {
        await this.ready();
        if (!this.prepared)
            return [];
        const la = num(lat), lo = num(lon), latPad = radiusKm / 111.32, lonPad = radiusKm / Math.max(20, 111.32 * Math.cos(la * Math.PI / 180));
        const bb = { south: la - latPad, west: lo - lonPad, north: la + latPad, east: lo + lonPad };
        const indexes = this._expandShardNeighborhood(this._shardsForBBox(bb), 1);
        await this._loadIndexes(indexes);
        const ways = this._waysForShardIndexes(indexes);
        this.trimCache();
        return ways;
    }
    stats() { return { prepared: this.prepared, source: this.source, loadedShards: this.loadedShards.size, loadedWays: this.ways.size, maxLoadedShards: this.maxLoadedShards, residentBytes: this.residentWayBytes, maxResidentBytes: this.maxResidentBytes, maxConcurrentShardLoads: this.maxConcurrentShardLoads, totalShards: this.manifest?.shards?.length || 0, coarseNodes: this._coarse?.nodes?.length || 0 }; }
}
