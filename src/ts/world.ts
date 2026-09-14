type ProgressCallback = ((progress: { indexed: number; total: number; count?: number; added?: number; enriched?: number }) => void) | null;
type UnknownRecord = Record<string, unknown>;
type BuiltInBaseline = {
  name: string; lat: number; lon: number; platforms: number; type: string; country: string;
  facilities: string[]; lineIds: string[]; platformNames: string[]; closed: boolean;
  uicRef: string; ref: string; operator: string; network: string; wikidata: string; wheelchair: string;
  source: string; siteKind: string; cargoTags: string[]; official: boolean;
};
type ReferenceStationInput = { id?: string; name?: string; lat?: number; lon?: number; country?: string; uicRef?: string; ref?: string; operator?: string; network?: string; wikidata?: string; wheelchair?: string; osmType?: string; osmId?: string; type?: string; platforms?: number; facilities?: string[]; source?: string; siteKind?: string; cargoTags?: string[]; official?: boolean };
type SavedTrackRow = { id?: unknown; a?: unknown; b?: unknown; d?: unknown; s?: unknown; e?: unknown; n?: unknown; tk?: unknown; r?: unknown[] } & UnknownRecord;
type StationOverrides = Partial<{ name: string; lat: number; lon: number; platforms: number; type: string; platformNames: string[]; closed: boolean }>;
type SavedWorldNativeRef = { id?: string; n?: string; la?: number; lo?: number; u?: string; r?: string; o?: string; nw?: string; t?: string; c?: string; f?: string[]; sk?: string; src?: string; ct?: string[]; of?: boolean };
type SavedWorldData = { _v?: unknown; builtInRemoved?: string[]; nativeRefs?: SavedWorldNativeRef[]; stations?: __KPStruct10[]; tracks?: unknown[] };
type __KPStruct10 = { id: string; n?: string; la: number; lo: number; p?: number; t?: string; c?: string; f?: string[]; li?: string[]; pn?: string[]; cl?: boolean; rs?: string; bi?: boolean; name?: string; lat?: number; lon?: number; platforms?: number; type?: string; country?: string; facilities?: string[]; lineIds?: string[]; platformNames?: string[]; closed?: boolean; referenceSourceId?: string };
type ReferenceStation = ReferenceStationInput & { id: string; lat: number; lon: number; type?: string; _count?: number; _playableView?: Station; _reMercLat?: number; _reMercLon?: number; _reMercX?: number; _reMercY?: number };
type RailRoutePoint = { lat: number; lon: number; [key: string]: unknown };
type RailNetworkLike = {
  ready?: () => unknown | Promise<unknown>;
  stats?: () => Record<string, unknown>;
  prepared?: boolean;
  ensureNear?: (lat: number, lon: number, radiusKm: number) => unknown[] | Promise<unknown[]>;
};

export class Station {
    declare id: string;
    declare name: string;
    declare lat: number;
    declare lon: number;
    declare platforms: number;
    declare type: string;
    declare platformNames: string[];
    declare cargo: unknown[];
    declare facilities: string[];
    declare country: string;
    declare lineIds: string[];
    declare closed: boolean;
    declare referenceSourceId?: string;
    declare osmNativeId?: string;
    declare osmType?: string;
    declare osmId?: string;
    declare uicRef?: string;
    declare ref?: string;
    declare operator?: string;
    declare network?: string;
    declare wikidata?: string;
    declare wheelchair?: string;
    declare source?: string;
    declare siteKind?: string;
    declare cargoTags?: string[];
    declare official?: boolean;
    declare _builtInRailNet?: boolean;
    declare _nativeOSM?: boolean;
    declare _fromWorldReference?: boolean;
    declare _reMercLat?: number;
    declare _reMercLon?: number;
    declare _reMercX?: number;
    declare _reMercY?: number;
    constructor(data: unknown, name?:string, lat?:number, lon?:number, platforms?: unknown, type?:string) {
        const src: UnknownRecord = data && typeof data === 'object' && !Array.isArray(data) ? data as UnknownRecord : {};
        if (typeof data === 'string') {
            this.id = data;
            this.name = name || data;
            this.lat = lat || 0;
            this.lon = lon || 0;
            this.platforms = (platforms || 2) as number;
            this.type = type || 'voyageur';
        }
        else {
            this.id = (src.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`) as string;
            this.name = (src.name || 'Gare') as string;
            this.lat = (src.lat || 0) as number;
            this.lon = (src.lon || 0) as number;
            this.platforms = (src.platforms || 2) as number;
            this.type = (src.type || 'voyageur') as string;
        }
        this.platformNames = (src.platformNames || []) as string[]; // custom platform names (e.g. ['1', '2', '3A', '3B'])
        this.cargo = [];
        this.facilities = [];
        this.country = '';
        this.lineIds = (src.lineIds || []) as string[]; // lines this station belongs to
        this.closed = (src.closed || false) as boolean;
    }
}
export class Track {
    declare id: string;
    declare stationA: string;
    declare stationB: string;
    declare distance: number;
    declare maxSpeed: number;
    declare electrified: boolean;
    declare name: string;
    declare route: RailRoutePoint[];
    declare worksActive: boolean;
    declare worksImpact: string | null;
    declare worksSpeedLimit: number | null;
    declare tracks: number;
    declare _incidentIds?: string[];
    declare incidentActive?: boolean;
    declare incidentEffect?: string | null;
    declare incidentSpeedLimit?: number | null;
    declare incidentName?: string | null;
    declare _bbox?: [number, number, number, number];
    constructor(input: unknown) {
        const data: UnknownRecord = input && typeof input === 'object' && !Array.isArray(input) ? input as UnknownRecord : {};
        this.id = (data.id || `trk-${Date.now()}`) as string;
        this.stationA = data.stationA as string;
        this.stationB = data.stationB as string;
        this.distance = (data.distance || 0) as number;
        this.maxSpeed = (data.maxSpeed || 160) as number;
        this.electrified = data.electrified !== false;
        this.name = (data.name || '') as string;
        this.route = (data.route || []) as RailRoutePoint[];
        this.worksActive = false;
        this.worksImpact = null;
        this.worksSpeedLimit = null;
        this.tracks = (data.tracks || 2) as number;
    }
}
// Re-export from simulation.js to avoid duplication
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
export { haversineDistance as haversine } from './simulation.js?v=1784250033';
export class World {
    declare stations: Station[];
    declare tracks: Track[];
    declare _stationMap: Map<string, Station>;
    declare _trackPairMap: Map<string, Track>;
    declare _stationSpatial: Map<string, Station[]>;
    declare _stationSpatialDirty: boolean;
    declare _stationSpatialCell: number;
    declare referenceStations: ReferenceStation[];
    declare _referenceStationMap: Map<string, ReferenceStation>;
    declare _referenceStationSpatial: Map<string, ReferenceStation[]>;
    declare _referenceStationSpatialCell: number;
    declare _referenceStationLod5: ReferenceStation[];
    declare _referenceStationLod1: ReferenceStation[];
    declare _builtInStationBaseline: Map<string, BuiltInBaseline>;
    declare _removedBuiltInStations: Set<string>;
    declare _builtInStationCount: number;
    declare railNetwork: RailNetworkLike | null;
    declare _railNetworkReadyPromise: Promise<RailNetworkLike | null> | null;
    constructor() {
        this.stations = [];
        this.tracks = [];
        this._stationMap = new Map<string, Station>();
        this._trackPairMap = new Map<string, Track>();
        this._stationSpatial = new Map<string, Station[]>();
        this._stationSpatialDirty = true;
        this._stationSpatialCell = 0.05; // ~5 km latitude
        // v1.1.9 — worldwide OSM/ORM railway stations are REFERENCE data.
        // They are intentionally separate from `stations`: no platforms, no gameplay
        // ownership, and most importantly they are never serialized in player saves.
        this.referenceStations = [];
        this._referenceStationMap = new Map<string, ReferenceStation>();
        this._referenceStationSpatial = new Map<string, ReferenceStation[]>();
        this._referenceStationSpatialCell = 0.25; // ~28 km latitude; viewport queries stay cheap.
        this._referenceStationLod5 = []; // one representative per 5° cell for continent/world views
        this._referenceStationLod1 = []; // one representative per 1° cell for country views
        // v1.1.14 — RailNet Europe is native gameplay infrastructure. The 17k+
        // built-in stations live in `stations` like user-created stations, but unchanged
        // built-ins are omitted from saves. Only edits/removals become save deltas.
        this._builtInStationBaseline = new Map<string, BuiltInBaseline>();
        this._removedBuiltInStations = new Set<string>();
        this._builtInStationCount = 0;
        // SC Future alpha 1 — immutable packaged rail infrastructure shared by World/ORM/Schedule.
        // It is not serialized in player saves.
        this.railNetwork = null;
        this._railNetworkReadyPromise = null;
    }
    setRailNetwork(network: unknown) {
        this.railNetwork = (network || null) as RailNetworkLike | null;
        this._railNetworkReadyPromise = this.railNetwork?.ready
            ? Promise.resolve().then(() => this.railNetwork!.ready!()).then(() => this.railNetwork)
            : Promise.resolve(this.railNetwork);
        return this.railNetwork;
    }
    railNetworkReady() {
        return this._railNetworkReadyPromise || Promise.resolve(this.railNetwork);
    }
    getRailNetworkStats() {
        const s = this.railNetwork?.stats?.();
        return s && typeof s === 'object'
            ? { ...s }
            : { prepared: false, source: '', loadedShards: 0, loadedWays: 0, totalShards: 0, coarseNodes: 0 };
    }
    async getNativeRailWaysNear(lat:number, lon:number, radiusKm:number = 1) {
        await this.railNetworkReady();
        if (!this.railNetwork?.prepared || typeof this.railNetwork.ensureNear !== 'function')
            return [];
        return this.railNetwork.ensureNear(Number(lat), Number(lon), Math.max(0.05, Number(radiusKm) || 1));
    }
    async prefetchRailNetworkNearStation(stationOrId:string, radiusKm:number = 0.8) {
        const st = typeof stationOrId === 'object' && stationOrId
            ? stationOrId
            : this.getStationById(stationOrId);
        if (!st || !Number.isFinite(Number(st.lat)) || !Number.isFinite(Number(st.lon)))
            return [];
        return this.getNativeRailWaysNear(st.lat, st.lon, radiusKm);
    }
    _rebuildStationMap() {
        this._stationMap.clear();
        for (const s of this.stations)
            this._stationMap.set(s.id, s);
        this._stationSpatialDirty = true;
    }
    _ensureStationSpatial() {
        if (!this._stationSpatialDirty)
            return;
        this._stationSpatial.clear();
        const cs = this._stationSpatialCell;
        for (const st of this.stations) {
            const k = `${Math.floor(st.lat / cs)}:${Math.floor(st.lon / cs)}`;
            if (!this._stationSpatial.has(k))
                this._stationSpatial.set(k, []);
            this._stationSpatial.get(k)!.push(st);
        }
        this._stationSpatialDirty = false;
    }
    getStationsNear(lat:number, lon:number, radiusKm:number = 2) {
        this._ensureStationSpatial();
        const cs = this._stationSpatialCell;
        const latD = radiusKm / 111.32;
        const lonD = radiusKm / Math.max(20, 111.32 * Math.cos(lat * Math.PI / 180));
        const i0 = Math.floor((lat - latD) / cs), i1 = Math.floor((lat + latD) / cs);
        const j0 = Math.floor((lon - lonD) / cs), j1 = Math.floor((lon + lonD) / cs);
        const out = [];
        for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
                const arr = this._stationSpatial.get(`${i}:${j}`) || [];
                for (const st of arr) {
                    const dy = (st.lat - lat) * 111.32;
                    const dx = (st.lon - lon) * Math.max(20, 111.32 * Math.cos(lat * Math.PI / 180));
                    if (Math.hypot(dx, dy) <= radiusKm)
                        out.push(st);
                }
            }
        return out;
    }
    getStationsInBounds(south: number, west: number, north: number, east: number) {
        if (!this.stations.length)
            return [];
        this._ensureStationSpatial();
        south = Math.max(-90, Number(south));
        north = Math.min(90, Number(north));
        if (!Number.isFinite(south) || !Number.isFinite(north))
            return [];
        if (south > north)
            [south, north] = [north, south];
        const cs = this._stationSpatialCell;
        const i0 = Math.floor(south / cs), i1 = Math.floor(north / cs);
        const ranges = west <= east ? [[west, east]] : [[west, 180], [-180, east]];
        const out = [];
        const seen = new Set();
        for (const [w0, e0] of ranges) {
            const j0 = Math.floor(w0 / cs), j1 = Math.floor(e0 / cs);
            for (let i = i0; i <= i1; i++)
                for (let j = j0; j <= j1; j++) {
                    for (const st of this._stationSpatial.get(`${i}:${j}`) || []) {
                        if (seen.has(st.id) || st.lat < south || st.lat > north)
                            continue;
                        const lonOk = west <= east ? (st.lon >= west && st.lon <= east) : (st.lon >= west || st.lon <= east);
                        if (!lonOk)
                            continue;
                        seen.add(st.id);
                        out.push(st);
                    }
                }
        }
        return out;
    }
    _referenceCellKey(lat:number, lon:number) {
        const cs = this._referenceStationSpatialCell;
        return `${Math.floor(lat / cs)}:${Math.floor(lon / cs)}`;
    }
    clearReferenceStations() {
        this.referenceStations = [];
        this._referenceStationMap.clear();
        this._referenceStationSpatial.clear();
        this._referenceStationLod5 = [];
        this._referenceStationLod1 = [];
    }
    _rebuildReferenceStationLod() {
        const make = (degrees: number) => {
            const cells = new Map();
            for (const st of this.referenceStations) {
                const key = `${Math.floor(st.lat / degrees)}:${Math.floor(st.lon / degrees)}`;
                const prev = cells.get(key);
                if (!prev)
                    cells.set(key, { ...st, _count: 1 });
                else
                    prev._count++;
            }
            return Array.from(cells.values());
        };
        this._referenceStationLod5 = make(5);
        this._referenceStationLod1 = make(1);
    }
    setReferenceStations(stations: unknown) {
        this.clearReferenceStations();
        for (const raw of Array.isArray(stations) ? stations : []) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            const st = raw as ReferenceStation;
            if (!st.id || typeof st.lat !== 'number' || !Number.isFinite(st.lat) || typeof st.lon !== 'number' || !Number.isFinite(st.lon))
                continue;
            this.referenceStations.push(st);
            this._referenceStationMap.set(st.id, st);
            const k = this._referenceCellKey(st.lat, st.lon);
            if (!this._referenceStationSpatial.has(k))
                this._referenceStationSpatial.set(k, []);
            this._referenceStationSpatial.get(k)!.push(st);
        }
        this._rebuildReferenceStationLod();
        return this.referenceStations.length;
    }
    async setReferenceStationsAsync(stations: unknown, onProgress: ProgressCallback = null, chunkSize: number = 4000) {
        this.clearReferenceStations();
        const src = Array.isArray(stations) ? stations : [];
        const total = src.length;
        for (let start = 0; start < total; start += chunkSize) {
            const end = Math.min(total, start + chunkSize);
            for (let i = start; i < end; i++) {
                const raw = src[i];
                if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
                const st = raw as ReferenceStation;
                if (!st.id || typeof st.lat !== 'number' || !Number.isFinite(st.lat) || typeof st.lon !== 'number' || !Number.isFinite(st.lon))
                    continue;
                this.referenceStations.push(st);
                this._referenceStationMap.set(st.id, st);
                const k = this._referenceCellKey(st.lat, st.lon);
                if (!this._referenceStationSpatial.has(k))
                    this._referenceStationSpatial.set(k, []);
                this._referenceStationSpatial.get(k)!.push(st);
            }
            onProgress?.({ indexed: end, total, count: this.referenceStations.length });
            // Yield to Chromium between batches; loading the world must not freeze the game.
            if (end < total)
                await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this._rebuildReferenceStationLod();
        return this.referenceStations.length;
    }
    getReferenceStationById(id:string) {
        return this._referenceStationMap.get(id) || null;
    }
    getReferenceStationsInBounds(south: number, west: number, north: number, east: number) {
        if (!this.referenceStations.length)
            return [];
        south = Math.max(-90, Number(south));
        north = Math.min(90, Number(north));
        if (!Number.isFinite(south) || !Number.isFinite(north))
            return [];
        if (south > north)
            [south, north] = [north, south];
        const cs = this._referenceStationSpatialCell;
        const i0 = Math.floor(south / cs), i1 = Math.floor(north / cs);
        const ranges = west <= east ? [[west, east]] : [[west, 180], [-180, east]]; // antimeridian
        const out = [];
        const seen = new Set();
        for (const [w0, e0] of ranges) {
            const j0 = Math.floor(w0 / cs), j1 = Math.floor(e0 / cs);
            for (let i = i0; i <= i1; i++)
                for (let j = j0; j <= j1; j++) {
                    for (const st of this._referenceStationSpatial.get(`${i}:${j}`) || []) {
                        if (seen.has(st.id) || st.lat < south || st.lat > north)
                            continue;
                        const lonOk = west <= east ? (st.lon >= west && st.lon <= east) : (st.lon >= west || st.lon <= east);
                        if (!lonOk)
                            continue;
                        seen.add(st.id);
                        out.push(st);
                    }
                }
        }
        return out;
    }
    getReferenceStationRenderCandidates(south: number, west: number, north: number, east: number, zoom:number = 10) {
        const source = zoom < 4.5 ? this._referenceStationLod5 : (zoom < 7 ? this._referenceStationLod1 : null);
        if (!source)
            return this.getReferenceStationsInBounds(south, west, north, east);
        const crosses = west > east;
        const out = [];
        for (const st of source) {
            if (st.lat < south || st.lat > north)
                continue;
            const lonOk = crosses ? (st.lon >= west || st.lon <= east) : (st.lon >= west && st.lon <= east);
            if (lonOk)
                out.push(st);
        }
        return out;
    }
    getReferenceStationsNear(lat:number, lon:number, radiusKm:number = 2) {
        const latD = radiusKm / 111.32;
        const lonD = radiusKm / Math.max(20, 111.32 * Math.cos(lat * Math.PI / 180));
        const west = lon - lonD < -180 ? lon - lonD + 360 : lon - lonD;
        const east = lon + lonD > 180 ? lon + lonD - 360 : lon + lonD;
        const candidates = this.getReferenceStationsInBounds(lat - latD, west, lat + latD, east);
        return candidates.filter((st: __S3Struct3) => {
            const dy = (st.lat - lat) * 111.32;
            const dx = (st.lon - lon) * Math.max(20, 111.32 * Math.cos(lat * Math.PI / 180));
            return Math.hypot(dx, dy) <= radiusKm;
        });
    }
    _builtInBaselineFor(ref: ReferenceStationInput): BuiltInBaseline {
        const rawType = String(ref.type || 'voyageur').toLowerCase();
        const type = rawType === 'marchandise' || rawType === 'ite' || rawType === 'voyageur' ? rawType : 'voyageur';
        const defaultFacilities = type === 'ite' ? ['fret','ite'] : type === 'marchandise' ? ['fret'] : ['voyageur'];
        const platformsRaw = Number(ref.platforms);
        return {
            name: ref.name || 'Gare', lat: Number(ref.lat), lon: Number(ref.lon), platforms: Number.isFinite(platformsRaw) && platformsRaw > 0 ? Math.max(1, Math.floor(platformsRaw)) : (type === 'voyageur' ? 2 : 1), type,
            country: ref.country || '', facilities: Array.isArray(ref.facilities) && ref.facilities.length ? [...new Set(ref.facilities.map(String))] : defaultFacilities, lineIds: [], platformNames: [], closed: false,
            uicRef: ref.uicRef || '', ref: ref.ref || '', operator: ref.operator || '', network: ref.network || '',
            wikidata: ref.wikidata || '', wheelchair: ref.wheelchair || '', source: String(ref.source || ''), siteKind: String(ref.siteKind || ''),
            cargoTags: Array.isArray(ref.cargoTags) ? [...new Set(ref.cargoTags.map(String).filter(Boolean))] : [], official: ref.official === true,
        };
    }
    _applyBuiltInBaseline(st: Station, id:string, b: BuiltInBaseline) {
        st.name = b.name;
        st.lat = b.lat;
        st.lon = b.lon;
        st.platforms = b.platforms;
        st.type = b.type;
        st.country = b.country;
        st.facilities = [...b.facilities];
        st.lineIds = [...b.lineIds];
        st.platformNames = [...b.platformNames];
        st.closed = !!b.closed;
        st.referenceSourceId = id;
        st.uicRef = b.uicRef || '';
        st.ref = b.ref || '';
        st.operator = b.operator || '';
        st.network = b.network || '';
        st.wikidata = b.wikidata || '';
        st.wheelchair = b.wheelchair || '';
        st.source = b.source || '';
        st.siteKind = b.siteKind || '';
        st.cargoTags = [...(b.cargoTags || [])];
        st.official = b.official === true;
        st._builtInRailNet = true;
        st._nativeOSM = true;
        st._fromWorldReference = true;
        return st;
    }
    _createBuiltInFromBaseline(id:string, b: BuiltInBaseline) {
        const st = new Station({ id, name: b.name, lat: b.lat, lon: b.lon, platforms: b.platforms, type: b.type,
            lineIds: [...b.lineIds], platformNames: [...b.platformNames], closed: !!b.closed });
        return this._applyBuiltInBaseline(st, id, b);
    }
    _stationMatchesBuiltInBaseline(station: Station) {
        const b = this._builtInStationBaseline.get(station?.id);
        if (!b)
            return false;
        const arrEq = (a: unknown, c: unknown) => JSON.stringify(a || []) === JSON.stringify(c || []);
        return station.name === b.name && station.lat === b.lat && station.lon === b.lon &&
            station.platforms === b.platforms && station.type === b.type && station.country === b.country &&
            !!station.closed === !!b.closed && arrEq(station.facilities, b.facilities) &&
            arrEq(station.lineIds, b.lineIds) && arrEq(station.platformNames, b.platformNames);
    }
    async setBuiltInGameplayStationsAsync(stations: unknown, onProgress: ProgressCallback = null, chunkSize: number = 2500) {
        const src = Array.isArray(stations) ? stations : [];
        if (!src.length)
            return 0;
        let ready = 0;
        for (let start = 0; start < src.length; start += chunkSize) {
            const end = Math.min(src.length, start + chunkSize);
            for (let i = start; i < end; i++) {
                const raw = src[i];
                if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
                const ref = raw as ReferenceStationInput;
                if (!ref.id || typeof ref.lat !== 'number' || !Number.isFinite(ref.lat) || typeof ref.lon !== 'number' || !Number.isFinite(ref.lon))
                    continue;
                if (!this._builtInStationBaseline.has(ref.id))
                    this._builtInStationBaseline.set(ref.id, this._builtInBaselineFor(ref));
                if (this._removedBuiltInStations.has(ref.id))
                    continue;
                const existing = this._stationMap.get(ref.id);
                if (existing) {
                    // A save delta may already exist with this ID: keep the player's version.
                    existing._builtInRailNet = true;
                    existing._nativeOSM = true;
                    existing.referenceSourceId ||= ref.id;
                    ready++;
                    continue;
                }
                const st = this._createBuiltInFromBaseline(ref.id, this._builtInStationBaseline.get(ref.id)!);
                this.stations.push(st);
                this._stationMap.set(st.id, st);
                ready++;
            }
            this._stationSpatialDirty = true;
            onProgress?.({ indexed: end, total: src.length, count: ready });
            if (end < src.length)
                await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this._builtInStationCount = this._builtInStationBaseline.size;
        return ready;
    }
    _nativeStationNameKey(name:string) {
        return String(name || '').normalize?.('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || '';
    }
    async mergeNativeOSMGameplayStationsAsync(stations: unknown, onProgress: ProgressCallback = null, chunkSize: number = 600) {
        const src = Array.isArray(stations) ? stations : [];
        if (!src.length)
            return { added: 0, enriched: 0, total: 0 };
        let added = 0, enriched = 0;
        for (let start = 0; start < src.length; start += chunkSize) {
            const end = Math.min(src.length, start + chunkSize);
            for (let i = start; i < end; i++) {
                const raw = src[i];
                if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
                const ref = raw as ReferenceStationInput;
                if (!ref.id || typeof ref.lat !== 'number' || !Number.isFinite(ref.lat) || typeof ref.lon !== 'number' || !Number.isFinite(ref.lon))
                    continue;
                let existing = this._stationMap.get(ref.id) || null;
                if (!existing) {
                    const uic = String(ref.uicRef || '').trim();
                    const nn = this._nativeStationNameKey(ref.name || '');
                    let best = null, bestD = Infinity;
                    for (const cand of this.getStationsNear(ref.lat, ref.lon, 0.35)) {
                        const sameUic = !!uic && String(cand.uicRef || '').trim() === uic;
                        const refType = String(ref.type || 'voyageur');
                        const candType = String(cand.type || 'voyageur');
                        const sameOperationalFamily = refType === 'voyageur'
                            ? candType === 'voyageur'
                            : (refType === candType || (refType !== 'voyageur' && candType !== 'voyageur'));
                        const sameName = sameOperationalFamily && !!nn && this._nativeStationNameKey(cand.name) === nn;
                        if (!sameUic && !sameName)
                            continue;
                        const lat = (cand.lat + ref.lat) * 0.5 * Math.PI / 180;
                        const dy = (cand.lat - ref.lat) * 111320;
                        const dx = (cand.lon - ref.lon) * 111320 * Math.max(0.15, Math.cos(lat));
                        const d = Math.hypot(dx, dy);
                        if (d < bestD) {
                            best = cand;
                            bestD = d;
                        }
                    }
                    existing = best;
                }
                if (existing) {
                    existing._nativeOSM = true;
                    existing.osmNativeId = ref.id;
                    existing.osmType = ref.osmType || existing.osmType || '';
                    existing.osmId = ref.osmId || existing.osmId || '';
                    if (ref.uicRef && !existing.uicRef)
                        existing.uicRef = ref.uicRef;
                    if (ref.ref && !existing.ref)
                        existing.ref = ref.ref;
                    if (ref.operator && !existing.operator)
                        existing.operator = ref.operator;
                    if (ref.network && !existing.network)
                        existing.network = ref.network;
                    if (ref.wikidata && !existing.wikidata)
                        existing.wikidata = ref.wikidata;
                    if (ref.wheelchair && !existing.wheelchair)
                        existing.wheelchair = ref.wheelchair;
                    if (ref.source && !existing.source)
                        existing.source = ref.source;
                    if (ref.siteKind && !existing.siteKind)
                        existing.siteKind = ref.siteKind;
                    if (Array.isArray(ref.cargoTags) && ref.cargoTags.length)
                        existing.cargoTags = [...new Set([...(existing.cargoTags || []), ...ref.cargoTags.map(String).filter(Boolean)])].slice(0, 12);
                    if (ref.official === true)
                        existing.official = true;
                    enriched++;
                    continue;
                }
                if (!this._builtInStationBaseline.has(ref.id))
                    this._builtInStationBaseline.set(ref.id, this._builtInBaselineFor(ref));
                if (this._removedBuiltInStations.has(ref.id))
                    continue;
                const st = this._createBuiltInFromBaseline(ref.id, this._builtInStationBaseline.get(ref.id)!);
                st.osmNativeId = ref.id;
                st.osmType = ref.osmType || '';
                st.osmId = ref.osmId || '';
                this.stations.push(st);
                this._stationMap.set(st.id, st);
                added++;
            }
            this._stationSpatialDirty = true;
            onProgress?.({ indexed: end, total: src.length, added, enriched });
            if (end < src.length)
                await new Promise((resolve) => setTimeout(resolve, 0));
        }
        this._builtInStationCount = this._builtInStationBaseline.size;
        return { added, enriched, total: added + enriched };
    }
    _trackPairKey(a: string, b: string) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
    _rebuildTrackPairMap() {
        this._trackPairMap.clear();
        for (const t of this.tracks)
            this._trackPairMap.set(this._trackPairKey(t.stationA, t.stationB), t);
    }
    addStation(data: unknown) {
        const station = new Station(data);
        this.stations.push(station);
        this._stationMap.set(station.id, station);
        this._stationSpatialDirty = true;
        return station;
    }
    removeStation(id:string) {
        if (this._builtInStationBaseline.has(id))
            this._removedBuiltInStations.add(id);
        this.tracks = this.tracks.filter((t: { stationA: unknown; stationB: unknown }) => t.stationA !== id && t.stationB !== id);
        this.stations = this.stations.filter((s: { id: unknown }) => s.id !== id);
        this._stationMap.delete(id);
        this._stationSpatialDirty = true;
        this._rebuildTrackPairMap();
    }
    addTrack(data: unknown) {
        const track = new Track(data);
        this.tracks.push(track);
        this._trackPairMap.set(this._trackPairKey(track.stationA, track.stationB), track);
        return track;
    }
    removeTrack(id:string) {
        const t = this.tracks.find((t: { id: unknown }) => t.id === id);
        this.tracks = this.tracks.filter((t: { id: unknown }) => t.id !== id);
        if (t)
            this._trackPairMap.delete(this._trackPairKey(t.stationA, t.stationB));
    }
    getStationById(id:string) {
        const local = this._stationMap.get(id);
        if (local)
            return local;
        const ref = this._referenceStationMap.get(id);
        if (!ref)
            return undefined;
        // Lightweight Station-compatible view. Reference stations become fully mutable
        // only when activateReferenceStation() is called.
        if (!ref._playableView) {
            Object.defineProperty(ref, '_playableView', {
                configurable: true, enumerable: false, writable: true,
                value: {
                    id: ref.id, name: ref.name, lat: ref.lat, lon: ref.lon,
                    platforms: 2, platformNames: [], type: 'voyageur', cargo: [], facilities: [],
                    country: ref.country || '', lineIds: [], closed: false,
                    reference: true, referenceRailwayType: ref.type || 'station',
                    osmType: ref.osmType || '', osmId: ref.osmId || '', uicRef: ref.uicRef || '', ref: ref.ref || '',
                    operator: ref.operator || '', network: ref.network || '', wikidata: ref.wikidata || '', wheelchair: ref.wheelchair || '',
                } as Station,
            });
        }
        return ref._playableView;
    }
    isReferenceStationActivated(id:string) {
        return this._stationMap.has(id);
    }
    activateReferenceStation(id:string, overrides: StationOverrides = {}) {
        const existing = this._stationMap.get(id);
        if (existing)
            return existing;
        const ref = this._referenceStationMap.get(id);
        if (!ref)
            return null;
        const station = new Station({
            id: ref.id,
            name: overrides.name || ref.name || 'Gare',
            lat: Number.isFinite(overrides.lat) ? overrides.lat : ref.lat,
            lon: Number.isFinite(overrides.lon) ? overrides.lon : ref.lon,
            platforms: Number(overrides.platforms) || 2,
            type: overrides.type || 'voyageur',
            platformNames: Array.isArray(overrides.platformNames) ? overrides.platformNames : [],
            closed: !!overrides.closed,
        });
        station.referenceSourceId = ref.id;
        station.osmType = ref.osmType || '';
        station.osmId = ref.osmId || '';
        station.uicRef = ref.uicRef || '';
        station.ref = ref.ref || '';
        station.operator = ref.operator || '';
        station.network = ref.network || '';
        station.wikidata = ref.wikidata || '';
        station.wheelchair = ref.wheelchair || '';
        station.country = ref.country || '';
        station.facilities = ['voyageur'];
        station._fromWorldReference = true;
        this.stations.push(station);
        this._stationMap.set(station.id, station);
        this._stationSpatialDirty = true;
        return station;
    }
    getTrackBetween(stationAId:string, stationBId:string) {
        return this._trackPairMap.get(this._trackPairKey(stationAId, stationBId));
    }
    // findPath removed — routing now uses ORM Dijkstra directly
    toSave(options: { pinNativeStationIds?: Set<string> | string[] } | null = null) {
        const pinNativeStationIds = options?.pinNativeStationIds instanceof Set
            ? options.pinNativeStationIds
            : new Set(options?.pinNativeStationIds || []);
        const stationRows = [];
        const nativeRefs = [];
        for (const s of this.stations) {
            // Native OSM gameplay stations are reconstructed from OSM/cache as their areas are loaded.
            // Persist only an edited native station, never the untouched OSM baseline.
            if (s._builtInRailNet && this._stationMatchesBuiltInBaseline(s)) {
                // OSM is canonical, but stations actively referenced by gameplay need a tiny
                // save-local identity record so lines/services survive an offline reload.
                if (s._nativeOSM && pinNativeStationIds.has(s.id)) {
                    const r: Record<string, unknown> = { id: s.id, n: s.name, la: Math.round(s.lat * 1e5), lo: Math.round(s.lon * 1e5) };
                    if (s.uicRef)
                        r.u = s.uicRef;
                    if (s.ref)
                        r.r = s.ref;
                    if (s.operator)
                        r.o = s.operator;
                    if (s.network)
                        r.nw = s.network;
                    if (s.type !== 'voyageur') r.t = s.type;
                    if (s.country) r.c = s.country;
                    if (s.facilities?.length) r.f = s.facilities;
                    if (s.siteKind) r.sk = s.siteKind;
                    if (s.source) r.src = s.source;
                    if (s.cargoTags?.length) r.ct = s.cargoTags;
                    if (s.official) r.of = true;
                    nativeRefs.push(r);
                }
                continue;
            }
            const o: Record<string, unknown> = { id: s.id, n: s.name, la: Math.round(s.lat * 1e5), lo: Math.round(s.lon * 1e5) };
            if (s.platforms !== 2)
                o.p = s.platforms;
            if (s.type !== 'voyageur')
                o.t = s.type;
            if (s.country)
                o.c = s.country;
            if (s.facilities?.length)
                o.f = s.facilities;
            if (s.lineIds?.length)
                o.li = s.lineIds;
            if (s.platformNames?.length)
                o.pn = s.platformNames;
            if (s.closed)
                o.cl = true;
            if (s.referenceSourceId)
                o.rs = s.referenceSourceId;
            if (s._builtInRailNet)
                o.bi = true;
            stationRows.push(o);
        }
        return {
            stations: stationRows,
            ...(nativeRefs.length ? { nativeRefs } : {}),
            builtInRemoved: Array.from(this._removedBuiltInStations),
            tracks: this.tracks.map((t: Track) => {
                const o: Record<string, unknown> = { id: t.id, a: t.stationA, b: t.stationB, d: Math.round(t.distance * 100) / 100 };
                if (t.maxSpeed !== 160)
                    o.s = t.maxSpeed;
                if (!t.electrified)
                    o.e = false;
                if (t.name)
                    o.n = t.name;
                if (t.tracks !== 2)
                    o.tk = t.tracks;
                if (t.route?.length > 0) {
                    const r = [];
                    let prevLat = 0, prevLon = 0;
                    for (let i = 0; i < t.route.length; i++) {
                        const pt = t.route[i];
                        const lat5 = Math.round(pt.lat * 1e5);
                        const lon5 = Math.round(pt.lon * 1e5);
                        if (i === 0) {
                            r.push(lat5, lon5);
                        }
                        else {
                            r.push(lat5 - prevLat, lon5 - prevLon);
                        }
                        prevLat = lat5;
                        prevLon = lon5;
                    }
                    o.r = r;
                }
                return o;
            }),
            _v: 3,
        };
    }
    loadFromSave(data: SavedWorldData) {
        if (!data)
            return;
        const compact = data._v === 2 || data._v === 3;
        // v1.1.19: restore only OSM stations pinned by this save before dependent
        // lines/services load. This is not a parallel catalogue: it is a tiny save-local
        // cache of OSM entities already used by this company.
        for (const r of data.nativeRefs || []) {
            if (!r?.id || !Number.isFinite(r.la) || !Number.isFinite(r.lo))
                continue;
            if (!this._builtInStationBaseline.has(r.id)) {
                this._builtInStationBaseline.set(r.id, this._builtInBaselineFor({
                    id: r.id, name: r.n || 'Gare', lat: Number(r.la) / 1e5, lon: Number(r.lo) / 1e5,
                    uicRef: r.u || '', ref: r.r || '', operator: r.o || '', network: r.nw || '',
                    type: r.t || 'voyageur', country: r.c || '', facilities: r.f || undefined, siteKind: r.sk || '', source: r.src || '', cargoTags: r.ct || [], official: r.of === true,
                }));
            }
        }
        // v1.1.14: preserve native OSM gameplay stations already loaded in this session, then overlay the player's edits/user-created stations.
        this._removedBuiltInStations = new Set(data.builtInRemoved || []);
        // Loading a save replaces user-created gameplay stations from the current session.
        // Native OSM infrastructure already known in this session is reset to its OSM baseline first, including stations deleted/edited in the previously open session.
        this.stations = this.stations.filter((s: Station) => s._builtInRailNet);
        this._rebuildStationMap();
        for (const [id, b] of this._builtInStationBaseline) {
            let st = this._stationMap.get(id);
            if (!st) {
                st = this._createBuiltInFromBaseline(id, b);
                this.stations.push(st);
                this._stationMap.set(id, st);
            }
            else {
                this._applyBuiltInBaseline(st, id, b);
            }
        }
        if (this._removedBuiltInStations.size) {
            this.stations = this.stations.filter((s: Station) => !(s._builtInRailNet && this._removedBuiltInStations.has(s.id)));
            for (const id of this._removedBuiltInStations)
                this._stationMap.delete(id);
        }
        const upsertStation = (d: __KPStruct10) => {
            let id, name, lat, lon, platforms, type, country, facilities, lineIds, platformNames, closed, refSource, builtIn;
            if (compact) {
                id = d.id;
                name = d.n;
                lat = d.la / 1e5;
                lon = d.lo / 1e5;
                platforms = d.p || 2;
                type = d.t || 'voyageur';
                country = d.c || '';
                facilities = d.f || [];
                lineIds = d.li || [];
                platformNames = d.pn || [];
                closed = d.cl || false;
                refSource = d.rs || '';
                builtIn = !!d.bi || this._builtInStationBaseline.has(id);
            }
            else {
                id = d.id;
                name = d.name;
                lat = d.lat;
                lon = d.lon;
                platforms = d.platforms || 2;
                type = d.type || 'voyageur';
                country = d.country || '';
                facilities = d.facilities || [];
                lineIds = d.lineIds || [];
                platformNames = d.platformNames || [];
                closed = d.closed || false;
                refSource = d.referenceSourceId || '';
                builtIn = this._builtInStationBaseline.has(id);
            }
            let st = this._stationMap.get(id);
            if (!st) {
                st = new Station({ id, name, lat, lon, platforms, type, lineIds, platformNames, closed });
                this.stations.push(st);
                this._stationMap.set(id, st);
            }
            else {
                st.name = name || st.name;
                st.lat = lat as number;
                st.lon = lon as number;
                st.platforms = platforms;
                st.type = type;
                st.lineIds = lineIds;
                st.platformNames = platformNames;
                st.closed = !!closed;
            }
            st.country = country;
            st.facilities = facilities;
            if (refSource) {
                st.referenceSourceId = refSource;
                st._fromWorldReference = true;
            }
            if (builtIn) {
                st._builtInRailNet = true;
                st._nativeOSM = String(id || '').startsWith('osm-') || !!st._nativeOSM;
                st.referenceSourceId ||= id;
            }
            return st;
        };
        for (const d of data.stations || [])
            upsertStation(d);
        this.tracks = (data.tracks || []).map((raw: unknown) => {
            const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as SavedTrackRow : {};
            if (compact) {
                let route = [];
                const savedRoute = Array.isArray(d.r) ? d.r : [];
                if (savedRoute.length >= 2) {
                    let lat = Number(savedRoute[0]), lon = Number(savedRoute[1]);
                    route.push({ lat: lat / 1e5, lon: lon / 1e5 });
                    for (let i = 2; i < savedRoute.length; i += 2) {
                        lat += Number(savedRoute[i]);
                        lon += Number(savedRoute[i + 1]);
                        route.push({ lat: lat / 1e5, lon: lon / 1e5 });
                    }
                }
                return new Track({
                    id: d.id, stationA: d.a, stationB: d.b,
                    distance: d.d, maxSpeed: d.s || 160,
                    electrified: d.e !== false, name: d.n || '',
                    route, tracks: d.tk || 2,
                });
            }
            return new Track(d);
        });
        this._rebuildStationMap();
        this._rebuildTrackPairMap();
    }
}
export function createDefaultWorld() {
    const world = new World();
    return world;
}


// S3_STRUCT_V2_TEMP
type __S3Struct3 = { "lat": number; "lon": number };
