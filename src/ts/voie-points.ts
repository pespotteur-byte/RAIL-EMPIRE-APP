import { samePhysicalMovement } from './physical-service-identity.js';
// voie-points.js - Voie Point system for track visualization and switching
// Voie points are unnamed geographic markers that define which voie (track) a train is on
// Troncons connect voie points and/or stations with ORM-traced routes
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
import { haversineDistance } from './simulation.js?v=1784250033';
let nextVoiePointId = 1;
let nextTronconId = 1;

type UnknownRecord = Record<string, unknown>;
type VoiePointInput = { id?: unknown; lat?: unknown; lon?: unknown; voie?: unknown; stationId?: unknown; occupiedBy?: unknown; lineGroupId?: unknown; linePoint?: unknown };
type RoutePoint = UnknownRecord & { lat: number; lon: number; maxSpeed?: number; maxSpeedSource?: string; wayId?: string; incline?: unknown; tags?: UnknownRecord; service?: unknown; usage?: unknown; oneway?: unknown; bidirectional?: unknown; trackRef?: unknown; ref?: unknown; travelDirection?: unknown; electrified?: unknown };
type TronconInput = { id?: unknown; pointA?: unknown; pointB?: unknown; route?: unknown; distance?: unknown; wear?: unknown; name?: unknown; ref?: unknown; trackRef?: unknown; lineGroupId?: unknown };
type RenderBBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };
type RouteChunk = RenderBBox & { start: number; end: number };
type HeapItem = { id: string; d: number };
type GeoLike = { lat: number; lon: number };
type ServiceLike = { id?: unknown; active?: boolean; completed?: boolean; cancelled?: boolean; state?: string; position?: GeoLike; rame?: { totalLength?: unknown }; train?: { length?: unknown } };
type AdjacencyEdge = { neighbor: string; troncon: Troncon; reversed: boolean };
type PreviousEdge = { from: string; troncon: Troncon; reversed: boolean };
type WorldLike = { stations?: Array<{ id?: unknown }> } | null;
type EncodedRouteRecord = UnknownRecord & {
    c?: unknown[]; q?: unknown; f?: unknown[]; i?: unknown[][]; s?: unknown[]; w?: unknown[];
    wd?: unknown[]; wm?: UnknownRecord[]; dr?: unknown[]; e?: unknown[];
};
type VoiePointSaveData = UnknownRecord & { _v?: unknown; voiePoints?: unknown; troncons?: unknown };
export class VoiePoint {
    declare id: string; declare lat: number; declare lon: number; declare voie: string; declare stationId: string | null; declare occupiedBy: string | null; declare lineGroupId: string | null; declare linePoint: boolean;
    constructor(data: VoiePointInput = {}) {
        this.id = String(data.id || `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        const lat = Number(data.lat), lon = Number(data.lon);
        this.lat = Number.isFinite(lat) ? lat : 0;
        this.lon = Number.isFinite(lon) ? lon : 0;
        this.voie = String(data.voie ?? '1'); // which voie this point belongs to
        this.stationId = data.stationId != null && data.stationId !== '' ? String(data.stationId) : null; // linked station (voie à quai)
        this.occupiedBy = data.occupiedBy != null && data.occupiedBy !== '' ? String(data.occupiedBy) : null; // trainId occupying this voie point
        this.lineGroupId = data.lineGroupId != null && data.lineGroupId !== '' ? String(data.lineGroupId) : null; // import group for bulk delete
        this.linePoint = data.linePoint === true; // imported point, hidden in schedule creator
    }
}
export class Troncon {
    declare id: string; declare pointA: string; declare pointB: string; declare route: RoutePoint[]; declare distance: number; declare occupiedBy: string | null; declare reservedBy: string | null; declare wear: number; declare name: string; declare ref: string; declare trackRef: string; declare lineGroupId: string | null; declare _renderBBox?: RenderBBox;
    constructor(data: TronconInput = {}) {
        this.id = String(data.id || `trc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        // Endpoints can be station IDs or voie point IDs
        this.pointA = data.pointA != null ? String(data.pointA) : ''; // station id or voie point id
        this.pointB = data.pointB != null ? String(data.pointB) : ''; // station id or voie point id
        this.route = Array.isArray(data.route) ? data.route as RoutePoint[] : []; // ORM route array [{lat, lon, maxSpeed, tracks}, ...]
        const dist = Number(data.distance);
        this.distance = Number.isFinite(dist) && dist >= 0 ? dist : 0; // km
        this.occupiedBy = null; // trainId currently physically occupying this troncon
        this.reservedBy = null; // trainId holding an interlocking reservation before entry
        // TRV-01 : usure de la voie (0-100)
        const wear = Number(data.wear);
        this.wear = Number.isFinite(wear) ? Math.max(0, Math.min(100, wear)) : 0;
        this.name = String(data.name || '');
        this.ref = String(data.ref || '');
        this.trackRef = String(data.trackRef || '');
        this.lineGroupId = data.lineGroupId != null && data.lineGroupId !== '' ? String(data.lineGroupId) : null; // import group for bulk delete
    }
}
export class VoiePointManager {
    declare voiePoints: VoiePoint[]; declare troncons: Troncon[]; declare _vpMap: Map<string, VoiePoint>; declare _trcMap: Map<string, Troncon>; declare _trcByPoint: Map<string, Troncon[]>; declare _revision: number; declare _saveCache: unknown; declare _spatialDirty: boolean; declare _vpSpatial: Map<string, VoiePoint[]>; declare _trcSpatial: Map<string, Troncon[]>; declare _largeTrcs: Troncon[]; declare _routeGeomCache: WeakMap<RoutePoint[], { chunkSize: number; chunks: RouteChunk[] }>; declare _spatialCellSize: number; declare _batchDepth: number; declare _batchChanged: boolean; declare _occupiedVpIds: Set<string>; declare _occupiedTrcIds: Set<string>; declare onChange: (() => void) | null;
    constructor() {
        this.voiePoints = [];
        this.troncons = [];
        this._vpMap = new Map(); // O(1) lookup by id
        this._trcMap = new Map(); // O(1) lookup by id
        this._trcByPoint = new Map(); // O(1) adjacency lookup
        this._revision = 1;
        this._saveCache = null;
        this._spatialDirty = true;
        this._vpSpatial = new Map();
        this._trcSpatial = new Map();
        this._largeTrcs = [];
        this._routeGeomCache = new WeakMap(); // route -> exact-segment bbox chunks
        this._spatialCellSize = 0.04; // ~4 km; viewport queries stay tiny
        this._batchDepth = 0;
        this._batchChanged = false;
        this._occupiedVpIds = new Set();
        this._occupiedTrcIds = new Set();
        this.onChange = null; // R-08 : callback quand les tronçons/aiguillages changent
    }
    get revision() { return this._revision; }
    beginBatch() { this._batchDepth++; }
    endBatch() {
        if (this._batchDepth > 0)
            this._batchDepth--;
        if (this._batchDepth === 0 && this._batchChanged) {
            this._batchChanged = false;
            if (typeof this.onChange === 'function') {
                try {
                    this.onChange();
                }
                catch (e: unknown) { /* ignore */ }
            }
        }
    }
    markDirty() { this._notifyChange(); }
    _notifyChange() {
        this._revision++;
        this._saveCache = null;
        this._spatialDirty = true;
        if (this._batchDepth > 0) {
            this._batchChanged = true;
            return;
        }
        if (typeof this.onChange === 'function') {
            try {
                this.onChange();
            }
            catch (e: unknown) { /* ignore */ }
        }
    }
    _rebuildMaps() {
        this._vpMap.clear();
        this._occupiedVpIds.clear();
        for (const vp of this.voiePoints) {
            this._vpMap.set(vp.id, vp);
            if (vp.occupiedBy)
                this._occupiedVpIds.add(vp.id);
        }
        this._trcMap.clear();
        this._trcByPoint.clear();
        this._occupiedTrcIds.clear();
        for (const trc of this.troncons) {
            this._trcMap.set(trc.id, trc);
            if (!this._trcByPoint.has(trc.pointA))
                this._trcByPoint.set(trc.pointA, []);
            if (!this._trcByPoint.has(trc.pointB))
                this._trcByPoint.set(trc.pointB, []);
            this._trcByPoint.get(trc.pointA)!.push(trc);
            this._trcByPoint.get(trc.pointB)!.push(trc);
            if (trc.occupiedBy)
                this._occupiedTrcIds.add(trc.id);
        }
        this._spatialDirty = true;
        this._saveCache = null;
    }
    _cellKey(lat: number, lon: number) {
        const cs = this._spatialCellSize;
        return `${Math.floor(lat / cs)}:${Math.floor(lon / cs)}`;
    }
    _ensureSpatialIndex() {
        if (!this._spatialDirty)
            return;
        this._vpSpatial.clear();
        this._trcSpatial.clear();
        this._largeTrcs = [];
        const cs = this._spatialCellSize;
        for (const vp of this.voiePoints) {
            const key = this._cellKey(vp.lat, vp.lon);
            let bucket = this._vpSpatial.get(key);
            if (!bucket) {
                bucket = [];
                this._vpSpatial.set(key, bucket);
            }
            bucket.push(vp);
        }
        for (const trc of this.troncons) {
            let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
            const pts = Array.isArray(trc.route) && trc.route.length ? trc.route : null;
            if (pts) {
                for (const pt of pts) {
                    if (pt.lat < minLat)
                        minLat = pt.lat;
                    if (pt.lat > maxLat)
                        maxLat = pt.lat;
                    if (pt.lon < minLon)
                        minLon = pt.lon;
                    if (pt.lon > maxLon)
                        maxLon = pt.lon;
                }
            }
            else {
                const a = this.getVoiePointById(trc.pointA), b = this.getVoiePointById(trc.pointB);
                if (!a || !b) {
                    this._largeTrcs.push(trc);
                    continue;
                }
                minLat = Math.min(a.lat, b.lat);
                maxLat = Math.max(a.lat, b.lat);
                minLon = Math.min(a.lon, b.lon);
                maxLon = Math.max(a.lon, b.lon);
            }
            trc._renderBBox = { minLat, maxLat, minLon, maxLon };
            const i0 = Math.floor(minLat / cs), i1 = Math.floor(maxLat / cs);
            const j0 = Math.floor(minLon / cs), j1 = Math.floor(maxLon / cs);
            // Avoid exploding the index for exceptionally long troncons.
            if ((i1 - i0 + 1) * (j1 - j0 + 1) > 300) {
                this._largeTrcs.push(trc);
                continue;
            }
            for (let i = i0; i <= i1; i++)
                for (let j = j0; j <= j1; j++) {
                    const key = `${i}:${j}`;
                    let bucket = this._trcSpatial.get(key);
                    if (!bucket) {
                        bucket = [];
                        this._trcSpatial.set(key, bucket);
                    }
                    bucket.push(trc);
                }
        }
        this._spatialDirty = false;
    }
    getVoiePointsInBounds(minLat: number, maxLat: number, minLon: number, maxLon: number) {
        this._ensureSpatialIndex();
        const cs = this._spatialCellSize, out = [];
        const i0 = Math.floor(minLat / cs), i1 = Math.floor(maxLat / cs);
        const j0 = Math.floor(minLon / cs), j1 = Math.floor(maxLon / cs);
        for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
                const bucket = this._vpSpatial.get(`${i}:${j}`);
                if (!bucket)
                    continue;
                for (const vp of bucket)
                    if (vp.lat >= minLat && vp.lat <= maxLat && vp.lon >= minLon && vp.lon <= maxLon)
                        out.push(vp);
            }
        return out;
    }
    getTronconsInBounds(minLat: number, maxLat: number, minLon: number, maxLon: number) {
        this._ensureSpatialIndex();
        const cs = this._spatialCellSize, ids = new Set<string>(), out: Troncon[] = [];
        const i0 = Math.floor(minLat / cs), i1 = Math.floor(maxLat / cs);
        const j0 = Math.floor(minLon / cs), j1 = Math.floor(maxLon / cs);
        const add = (trc: Troncon) => {
            if (!trc || ids.has(trc.id))
                return;
            const b = trc._renderBBox;
            if (b && (b.maxLat < minLat || b.minLat > maxLat || b.maxLon < minLon || b.minLon > maxLon))
                return;
            ids.add(trc.id);
            out.push(trc);
        };
        for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
                const bucket = this._trcSpatial.get(`${i}:${j}`);
                if (bucket)
                    for (const trc of bucket)
                        add(trc);
            }
        for (const trc of this._largeTrcs)
            add(trc);
        return out;
    }
    getVoiePointsNear(lat: number, lon: number, radiusKm: number = 0.2) {
        const latD = radiusKm / 111;
        const lonD = radiusKm / Math.max(1, 111 * Math.cos(lat * Math.PI / 180));
        const candidates = this.getVoiePointsInBounds(lat - latD, lat + latD, lon - lonD, lon + lonD);
        return candidates.filter((vp: VoiePoint) => haversineDistance(lat, lon, vp.lat, vp.lon) <= radiusKm);
    }
    // --- Voie Points ---
    addVoiePoint(data: VoiePointInput) {
        const vp = new VoiePoint(data);
        this.voiePoints.push(vp);
        this._vpMap.set(vp.id, vp);
        this._notifyChange();
        return vp;
    }
    // PERF v1.1.6: append a chunk with ONE invalidation instead of one per point.
    // Tracer ligne uses this for huge imports so 50k+ points never create 50k
    // revision/cache invalidations on the UI thread.
    addVoiePointsBulk(items: Array<VoiePoint | VoiePointInput> | null | undefined) {
        const added = [];
        for (const data of (items || [])) {
            const vp = data instanceof VoiePoint ? data : new VoiePoint(data);
            this.voiePoints.push(vp);
            this._vpMap.set(vp.id, vp);
            if (vp.occupiedBy)
                this._occupiedVpIds.add(vp.id);
            added.push(vp);
        }
        if (added.length)
            this._notifyChange();
        return added;
    }
    removeVoiePoint(id: string) {
        // Also remove all troncons connected to this point
        this.troncons = this.troncons.filter((t: Troncon) => t.pointA !== id && t.pointB !== id);
        this.voiePoints = this.voiePoints.filter((vp: VoiePoint) => vp.id !== id);
        this._vpMap.delete(id);
        this._rebuildMaps();
        this._notifyChange();
    }
    deleteLineGroup(lineGroupId: string | null | undefined) {
        if (!lineGroupId)
            return 0;
        const vpsBefore = this.voiePoints.length;
        const trcsBefore = this.troncons.length;
        this.troncons = this.troncons.filter((t: Troncon) => t.lineGroupId !== lineGroupId);
        this.voiePoints = this.voiePoints.filter((vp: VoiePoint) => vp.lineGroupId !== lineGroupId);
        this._rebuildMaps();
        this._notifyChange();
        return (vpsBefore - this.voiePoints.length) + (trcsBefore - this.troncons.length);
    }
    getVoiePointById(id: string) {
        return this._vpMap.get(id) || null;
    }
    getAll() {
        return this.voiePoints;
    }
    getStationVoiePoints(stationId: string) {
        return this.voiePoints.filter((vp: VoiePoint) => vp.stationId === stationId);
    }
    getStationVoiePoint(stationId: string, voie: string) {
        return this.voiePoints.find((vp: VoiePoint) => vp.stationId === stationId && vp.voie === voie);
    }
    // --- Voie Point Occupation (station platforms) ---
    occupyVoiePoint(vpId: string, trainId: string) {
        const vp = this.getVoiePointById(vpId);
        if (!vp || !trainId)
            return false;
        // HOTFIX16 — station track points are physical interlocking resources too.
        // Purge owners that are no longer physically present before failing closed.
        this._purgeDeadVoiePointOwner(vp, trainId);
        if (vp.occupiedBy != null && vp.occupiedBy !== trainId)
            return false;
        vp.occupiedBy = trainId;
        this._occupiedVpIds.add(vpId);
        return true;
    }
    releaseVoiePoint(vpId: string, trainId: string) {
        const vp = this.getVoiePointById(vpId);
        if (vp && vp.occupiedBy === trainId) {
            vp.occupiedBy = null;
            this._occupiedVpIds.delete(vpId);
        }
    }
    releaseAllVoiePointsForTrain(trainId: string) {
        for (const id of Array.from(this._occupiedVpIds)) {
            const vp = this.getVoiePointById(id);
            if (vp?.occupiedBy === trainId) {
                vp.occupiedBy = null;
                this._occupiedVpIds.delete(id);
            }
        }
    }
    isVoiePointOccupied(vpId: string, excludeTrainId: string | null) {
        const vp = this.getVoiePointById(vpId);
        if (!vp)
            return false;
        this._purgeDeadVoiePointOwner(vp, excludeTrainId);
        return vp.occupiedBy !== null && vp.occupiedBy !== excludeTrainId;
    }
    _purgeDeadVoiePointOwner(vp: VoiePoint, excludeTrainId: string | null = null) {
        if (!vp?.occupiedBy || vp.occupiedBy === excludeTrainId)
            return false;
        if (!this._isDeadInterlockingOwner(vp.occupiedBy))
            return false;
        vp.occupiedBy = null;
        this._occupiedVpIds.delete(vp.id);
        return true;
    }
    // --- Troncons ---
    addTroncon(data: TronconInput) {
        const trc = new Troncon(data);
        this.troncons.push(trc);
        this._trcMap.set(trc.id, trc);
        if (!this._trcByPoint.has(trc.pointA))
            this._trcByPoint.set(trc.pointA, []);
        if (!this._trcByPoint.has(trc.pointB))
            this._trcByPoint.set(trc.pointB, []);
        this._trcByPoint.get(trc.pointA)!.push(trc);
        this._trcByPoint.get(trc.pointB)!.push(trc);
        this._notifyChange();
        return trc;
    }
    // PERF v1.1.6: same idea for track chunks. Adjacency maps are updated while
    // the expensive renderer/routing invalidation is emitted only once per chunk.
    addTronconsBulk(items: Array<Troncon | TronconInput> | null | undefined) {
        const added = [];
        for (const data of (items || [])) {
            const trc = data instanceof Troncon ? data : new Troncon(data);
            this.troncons.push(trc);
            this._trcMap.set(trc.id, trc);
            if (!this._trcByPoint.has(trc.pointA))
                this._trcByPoint.set(trc.pointA, []);
            if (!this._trcByPoint.has(trc.pointB))
                this._trcByPoint.set(trc.pointB, []);
            this._trcByPoint.get(trc.pointA)!.push(trc);
            this._trcByPoint.get(trc.pointB)!.push(trc);
            if (trc.occupiedBy)
                this._occupiedTrcIds.add(trc.id);
            added.push(trc);
        }
        if (added.length)
            this._notifyChange();
        return added;
    }
    removeTroncon(id: string) {
        const trc = this._trcMap.get(id);
        this.troncons = this.troncons.filter((t: Troncon) => t.id !== id);
        this._trcMap.delete(id);
        this._occupiedTrcIds.delete(id);
        if (trc) {
            if (this._trcByPoint.has(trc.pointA))
                this._trcByPoint.set(trc.pointA, this._trcByPoint.get(trc.pointA)!.filter((t: Troncon) => t.id !== id));
            if (this._trcByPoint.has(trc.pointB))
                this._trcByPoint.set(trc.pointB, this._trcByPoint.get(trc.pointB)!.filter((t: Troncon) => t.id !== id));
        }
        this._notifyChange();
    }
    getTronconById(id: string) {
        return this._trcMap.get(id) || null;
    }
    getAllTroncons() {
        return this.troncons;
    }
    getTronconsForPoint(pointId: string) {
        return this._trcByPoint.get(pointId) || [];
    }
    // --- Troncon voie helpers ---
    getTronconVoies(troncon: Troncon) {
        const voies = new Set();
        const vpA = this.getVoiePointById(troncon.pointA);
        const vpB = this.getVoiePointById(troncon.pointB);
        if (vpA)
            voies.add(vpA.voie);
        if (vpB)
            voies.add(vpB.voie);
        return voies;
    }
    tronconsShareVoie(trcA: Troncon, trcB: Troncon) {
        const voiesA = this.getTronconVoies(trcA);
        const voiesB = this.getTronconVoies(trcB);
        for (const v of voiesA) {
            if (voiesB.has(v))
                return true;
        }
        return false;
    }
    // --- Occupation ---
    occupyTroncon(tronconId: string, trainId: string) {
        const trc = this.getTronconById(tronconId);
        if (!trc)
            return false;
        // HOTFIX15 — direct acquisition must clean the same dead interlocking owners
        // as isTronconOccupied(). The previous HOTFIX only cleaned on the probe path:
        // _reserveOriginSafetyFootprint()/look-ahead can call occupy/reserve directly,
        // so a ghost owner could still pin the first section at 0 km/h forever.
        this._purgeDeadTronconOwners(trc, trainId);
        // Fail closed for a genuinely live owner.
        if ((trc.occupiedBy && !samePhysicalMovement(trc.occupiedBy, trainId)) || (trc.reservedBy && !samePhysicalMovement(trc.reservedBy, trainId)))
            return false;
        if (trc.occupiedBy == null || trc.occupiedBy === trainId) trc.occupiedBy = trainId;
        if (trc.reservedBy === trainId)
            trc.reservedBy = null;
        this._occupiedTrcIds.add(tronconId);
        return true;
    }
    releaseTroncon(tronconId: string, trainId: string) {
        const trc = this.getTronconById(tronconId);
        if (trc && trc.occupiedBy === trainId) {
            trc.occupiedBy = null;
            this._occupiedTrcIds.delete(tronconId);
        }
    }
    reserveTroncon(tronconId: string, trainId: string) {
        const trc = this.getTronconById(tronconId);
        if (!trc)
            return false;
        // HOTFIX15 — look-ahead reservation is itself a stale-owner boundary. Do not
        // require an earlier isTronconOccupied() call to clean a dead service.
        this._purgeDeadTronconOwners(trc, trainId);
        if ((trc.occupiedBy && !samePhysicalMovement(trc.occupiedBy, trainId)) || (trc.reservedBy && !samePhysicalMovement(trc.reservedBy, trainId)))
            return false;
        trc.reservedBy = trainId;
        return true;
    }
    releaseTronconReservation(tronconId: string, trainId: string) {
        const trc = this.getTronconById(tronconId);
        if (trc && trc.reservedBy === trainId)
            trc.reservedBy = null;
    }
    releaseAllReservationsForTrain(trainId: string) {
        for (const trc of this.troncons)
            if (trc.reservedBy === trainId)
                trc.reservedBy = null;
    }
    _isDeadInterlockingOwner(trainId: string | null) {
        if (!trainId)
            return true;
        const services = globalThis.window?.game?.scheduleCreator?.services;
        if (!Array.isArray(services))
            return false;
        if (globalThis.window?.game?.depotManager?.hasPhysicalRescue?.(trainId)) return false;
        const svc = globalThis.window?.game?.depotManager?.getPhysicalRescueService?.(trainId) || services.find((s: ServiceLike) => String(s?.id) === String(trainId));
        return !svc || svc.active === false || svc.completed || svc.cancelled || ['completed', 'cancelled'].includes(svc.state) || !svc.position;
    }
    _purgeDeadTronconReservation(trc: Troncon, excludeTrainId: string | null = null) {
        if (!trc?.reservedBy || trc.reservedBy === excludeTrainId)
            return false;
        if (!this._isDeadInterlockingOwner(trc.reservedBy))
            return false;
        trc.reservedBy = null;
        return true;
    }
    _purgeDeadTronconOwners(trc: Troncon, excludeTrainId: string | null = null) {
        if (!trc)
            return false;
        let changed = this._purgeDeadTronconReservation(trc, excludeTrainId);
        if (trc.occupiedBy && !samePhysicalMovement(trc.occupiedBy, excludeTrainId) && this._isDeadInterlockingOwner(trc.occupiedBy)) {
            trc.occupiedBy = null;
            this._occupiedTrcIds.delete(trc.id);
            changed = true;
        }
        return changed;
    }
    isTronconReserved(tronconId: string, excludeTrainId: string | null) {
        const trc = this.getTronconById(tronconId);
        if (!trc)
            return false;
        this._purgeDeadTronconReservation(trc, excludeTrainId);
        return !!(trc.reservedBy && !samePhysicalMovement(trc.reservedBy, excludeTrainId));
    }
    releaseAllForTrain(trainId: string) {
        for (const id of Array.from(this._occupiedTrcIds)) {
            const trc = this.getTronconById(id);
            if (trc?.occupiedBy === trainId) {
                trc.occupiedBy = null;
                this._occupiedTrcIds.delete(id);
            }
        }
        this.releaseAllReservationsForTrain(trainId);
    }
    getOccupiedVoiePoints() { return Array.from(this._occupiedVpIds, (id: string) => this.getVoiePointById(id)).filter(Boolean); }
    getOccupiedTroncons() { return Array.from(this._occupiedTrcIds, (id: string) => this.getTronconById(id)).filter(Boolean); }
    _routeGeometryChunks(route: RoutePoint[], chunkSize: number = 24) {
        if (!Array.isArray(route) || route.length < 2)
            return [];
        const cached = this._routeGeomCache.get(route);
        if (cached?.chunkSize === chunkSize)
            return cached!.chunks;
        const chunks = [];
        for (let start = 0; start < route.length - 1; start += chunkSize) {
            const end = Math.min(route.length - 1, start + chunkSize); // segment indexes [start,end)
            let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
            for (let i = start; i <= end; i++) {
                const p = route[i];
                if (!p)
                    continue;
                minLat = Math.min(minLat, Number(p.lat));
                maxLat = Math.max(maxLat, Number(p.lat));
                minLon = Math.min(minLon, Number(p.lon));
                maxLon = Math.max(maxLon, Number(p.lon));
            }
            chunks.push({ start, end, minLat, maxLat, minLon, maxLon });
        }
        this._routeGeomCache.set(route, { chunkSize, chunks });
        return chunks;
    }
    _pointToSegmentKm(position: GeoLike, a: GeoLike, b: GeoLike) {
        const cosLat = Math.max(0.15, Math.cos(Number(position.lat) * Math.PI / 180));
        const ax = (Number(a.lon) - Number(position.lon)) * 111.32 * cosLat;
        const ay = (Number(a.lat) - Number(position.lat)) * 111.32;
        const bx = (Number(b.lon) - Number(position.lon)) * 111.32 * cosLat;
        const by = (Number(b.lat) - Number(position.lat)) * 111.32;
        const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy;
        const t = vv > 1e-12 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / vv)) : 0;
        return Math.hypot(ax + vx * t, ay + vy * t);
    }
    _pointToBBoxLowerBoundKm(position: GeoLike, box: RenderBBox) {
        const lat = Number(position.lat), lon = Number(position.lon);
        const clat = Math.max(box.minLat, Math.min(box.maxLat, lat));
        const clon = Math.max(box.minLon, Math.min(box.maxLon, lon));
        const cosLat = Math.max(0.15, Math.cos(lat * Math.PI / 180));
        return Math.hypot((clat - lat) * 111.32, (clon - lon) * 111.32 * cosLat);
    }
    _distanceToRouteKm(position: GeoLike, route: RoutePoint[]) {
        if (!position || !Array.isArray(route) || route.length < 2)
            return Infinity;
        let best = Infinity;
        for (const chunk of this._routeGeometryChunks(route)) {
            if (this._pointToBBoxLowerBoundKm(position, chunk) > best)
                continue;
            for (let i = chunk.start; i < chunk.end; i++) {
                const a = route[i], b = route[i + 1];
                if (!a || !b)
                    continue;
                const d = this._pointToSegmentKm(position, a, b);
                if (d < best)
                    best = d;
            }
        }
        return best;
    }
    isTronconOccupied(tronconId: string, excludeTrainId: string | null) {
        const trc = this.getTronconById(tronconId);
        if (!trc)
            return false;
        this._purgeDeadTronconReservation(trc, excludeTrainId);
        if (trc.reservedBy && !samePhysicalMovement(trc.reservedBy, excludeTrainId))
            return true;
        if (!trc.occupiedBy || samePhysicalMovement(trc.occupiedBy, excludeTrainId))
            return false;
        // Verify the occupying train still exists, is active, and is still near this troncon
        const services = window.game?.scheduleCreator?.services;
        if (services) {
            const manager=globalThis.window?.game?.depotManager;
            if (manager?.hasPhysicalRescue?.(trc.occupiedBy) && !manager.getPhysicalRescueService?.(trc.occupiedBy)) return true;
            const occupier = globalThis.window?.game?.depotManager?.getPhysicalRescueService?.(trc.occupiedBy) || services.find((s: ServiceLike) => s.id === trc.occupiedBy);
            if (!occupier || occupier.state === 'completed' || occupier.state === 'cancelled' || !occupier.position) {
                trc.occupiedBy = null;
                this._occupiedTrcIds.delete(trc.id);
                return false;
            }
            // Staleness check against the WHOLE troncon geometry, not only endpoints.
            // Keep enough margin for the train's rear: a 700 m consist whose head has
            // just left the segment is still physically occupying it.
            if (occupier.position && trc.route && trc.route.length >= 2) {
                const d = this._distanceToRouteKm(occupier.position, trc.route);
                const lengthKm = Math.max(0.02, Number(occupier.rame?.totalLength || occupier.train?.length || 20) / 1000);
                if (d > lengthKm + 0.08) {
                    trc.occupiedBy = null;
                    this._occupiedTrcIds.delete(trc.id);
                    return false;
                }
            }
        }
        return true;
    }
    // --- Cisaillement (crossing detection) ---
    /**
     * Check if a troncon's ORM route physically crosses any other occupied troncon's route.
     * Returns the first blocking troncon, or null if clear.
     * @param {string} tronconId - troncon to check
     * @param {string} trainId - train trying to use this troncon
     * @returns {Troncon|null} - blocking troncon or null
     */
    checkCisaillement(tronconId: string, trainId: string) {
        const trc = this.getTronconById(tronconId);
        if (!trc || !trc.route || trc.route.length < 2)
            return null;
        // Pre-compute bounding box of current troncon for fast rejection
        let tMinLat = Infinity, tMaxLat = -Infinity, tMinLon = Infinity, tMaxLon = -Infinity;
        for (const p of trc.route) {
            if (p.lat < tMinLat)
                tMinLat = p.lat;
            if (p.lat > tMaxLat)
                tMaxLat = p.lat;
            if (p.lon < tMinLon)
                tMinLon = p.lon;
            if (p.lon > tMaxLon)
                tMaxLon = p.lon;
        }
        const margin = 0.01; // ~1km margin
        for (const other of this.troncons) {
            if (other.id === tronconId)
                continue;
            this._purgeDeadTronconReservation(other, trainId);
            if (other.occupiedBy && other.occupiedBy !== trainId && this._isDeadInterlockingOwner(other.occupiedBy)) {
                other.occupiedBy = null;
                this._occupiedTrcIds.delete(other.id);
            }
            const otherOwner = other.occupiedBy || other.reservedBy;
            if (!otherOwner || samePhysicalMovement(otherOwner, trainId))
                continue;
            if (!other.route || other.route.length < 2)
                continue;
            // Quick bounding box rejection
            let oMinLat = Infinity, oMaxLat = -Infinity, oMinLon = Infinity, oMaxLon = -Infinity;
            for (const p of other.route) {
                oMinLat = Math.min(oMinLat, p.lat);
                oMaxLat = Math.max(oMaxLat, p.lat);
                oMinLon = Math.min(oMinLon, p.lon);
                oMaxLon = Math.max(oMaxLon, p.lon);
            }
            if (oMaxLat < tMinLat - margin || oMinLat > tMaxLat + margin ||
                oMaxLon < tMinLon - margin || oMinLon > tMaxLon + margin)
                continue;
            // Geometry is authoritative here: routes with different voie labels can
            // still cross on a switch/diamond and therefore conflict. Parallel tracks
            // are rejected naturally by _routesCross().
            if (this._routesCross(trc.route, other.route)) {
                return other;
            }
        }
        return null;
    }
    /**
     * Check if two ORM routes physically cross each other.
     * Uses segment-segment intersection test.
     */
    _routesCross(routeA: RoutePoint[], routeB: RoutePoint[]) {
        if (!Array.isArray(routeA) || !Array.isArray(routeB) || routeA.length < 2 || routeB.length < 2)
            return false;
        const chunksA = this._routeGeometryChunks(routeA), chunksB = this._routeGeometryChunks(routeB);
        const overlaps = (a: RenderBBox, b: RenderBBox) => !(a.maxLat < b.minLat || a.minLat > b.maxLat || a.maxLon < b.minLon || a.minLon > b.maxLon);
        const segBox = (p: GeoLike, q: GeoLike) => ({ minLat: Math.min(p.lat, q.lat), maxLat: Math.max(p.lat, q.lat), minLon: Math.min(p.lon, q.lon), maxLon: Math.max(p.lon, q.lon) });
        for (const ca of chunksA) {
            for (const cb of chunksB) {
                if (!overlaps(ca, cb))
                    continue;
                for (let i = ca.start; i < ca.end; i++) {
                    const a1 = routeA[i], a2 = routeA[i + 1];
                    if (!a1 || !a2)
                        continue;
                    const ab = segBox(a1, a2);
                    for (let j = cb.start; j < cb.end; j++) {
                        const b1 = routeB[j], b2 = routeB[j + 1];
                        if (!b1 || !b2)
                            continue;
                        if (!overlaps(ab, segBox(b1, b2)))
                            continue;
                        if (this._segmentsIntersect(a1.lat, a1.lon, a2.lat, a2.lon, b1.lat, b1.lon, b2.lat, b2.lon))
                            return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * 2D line segment intersection test using cross products.
     */
    _segmentsIntersect(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number) {
        const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const a1 = [ax1, ay1], a2 = [ax2, ay2];
        const b1 = [bx1, by1], b2 = [bx2, by2];
        const d1 = cross(b1, b2, a1);
        const d2 = cross(b1, b2, a2);
        const d3 = cross(a1, a2, b1);
        const d4 = cross(a1, a2, b2);
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }
        // Endpoint touching is a real interlocking conflict (switch nose / diamond).
        // Collinear overlap/touching is also conservatively protected here; same-train
        // movements are filtered by checkCisaillement before this function.
        const eps = 1e-10;
        const onSegment = (p: number[], q: number[], r: number[]) => q[0] <= Math.max(p[0], r[0]) + eps && q[0] + eps >= Math.min(p[0], r[0]) &&
            q[1] <= Math.max(p[1], r[1]) + eps && q[1] + eps >= Math.min(p[1], r[1]);
        if (Math.abs(d1) <= eps && onSegment(b1, a1, b2))
            return true;
        if (Math.abs(d2) <= eps && onSegment(b1, a2, b2))
            return true;
        if (Math.abs(d3) <= eps && onSegment(a1, b1, a2))
            return true;
        if (Math.abs(d4) <= eps && onSegment(a1, b2, a2))
            return true;
        return false;
    }
    // --- Tronçon graph routing (Dijkstra on player's infrastructure) ---
    /**
     * Find a route through the tronçon graph from point A to point B.
     * Returns the concatenated route geometry or null if no path exists.
     * @param {number} fromLat
     * @param {number} fromLon
     * @param {number} toLat
     * @param {number} toLon
     * @returns {{ route: Array, tronconIds: Array }|null}
     */
    findTronconRoute(fromLat: number, fromLon: number, toLat: number, toLon: number) {
        if (this.troncons.length === 0)
            return null;
        // Find nearest voie points to start and end
        const startVP = this._findNearestVoiePoint(fromLat, fromLon, 1.0);
        const endVP = this._findNearestVoiePoint(toLat, toLon, 1.0);
        if (!startVP || !endVP)
            return null;
        if (startVP.id === endVP.id)
            return null;
        // Build adjacency: vpId -> [{ neighborVpId, troncon, reversed }]
        const adj = new Map<string, AdjacencyEdge[]>();
        for (const trc of this.troncons) {
            if (!trc.route || trc.route.length < 2)
                continue;
            if (!adj.has(trc.pointA))
                adj.set(trc.pointA, []);
            if (!adj.has(trc.pointB))
                adj.set(trc.pointB, []);
            adj.get(trc.pointA)!.push({ neighbor: trc.pointB, troncon: trc, reversed: false });
            adj.get(trc.pointB)!.push({ neighbor: trc.pointA, troncon: trc, reversed: true });
        }
        if (!adj.has(startVP.id) || !adj.has(endVP.id))
            return null;
        // Dijkstra with binary heap — O(E log V)
        const dist = new Map<string, number>();
        const prev = new Map<string, PreviousEdge>();
        const visited = new Set<string>();
        dist.set(startVP.id, 0);
        // MinHeap inlined for this module (no import needed)
        const heap: HeapItem[] = [];
        const push = (item: HeapItem) => {
            heap.push(item);
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[i].d >= heap[p].d)
                    break;
                [heap[i], heap[p]] = [heap[p], heap[i]];
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length > 0) {
                heap[0] = last!;
                let i = 0;
                while (true) {
                    let s = i, l = 2 * i + 1, r = 2 * i + 2;
                    if (l < heap.length && heap[l].d < heap[s].d)
                        s = l;
                    if (r < heap.length && heap[r].d < heap[s].d)
                        s = r;
                    if (s === i)
                        break;
                    [heap[i], heap[s]] = [heap[s], heap[i]];
                    i = s;
                }
            }
            return top;
        };
        push({ id: startVP.id, d: 0 });
        while (heap.length > 0) {
            const { id: u } = pop();
            if (visited.has(u))
                continue;
            visited.add(u);
            if (u === endVP.id)
                break;
            const neighbors = adj.get(u) || [];
            for (const edge of neighbors) {
                if (visited.has(edge.neighbor))
                    continue;
                const newDist = (dist.get(u) || 0) + (edge.troncon.distance || 1);
                if (newDist < (dist.get(edge.neighbor) || Infinity)) {
                    dist.set(edge.neighbor, newDist);
                    prev.set(edge.neighbor, { from: u, troncon: edge.troncon, reversed: edge.reversed });
                    push({ id: edge.neighbor, d: newDist });
                }
            }
        }
        if (!prev.has(endVP.id))
            return null;
        // Reconstruct path
        const tronconIds = [];
        const routeSegments: RoutePoint[][] = [];
        let current = endVP.id;
        while (current !== startVP.id) {
            const p = prev.get(current);
            if (!p)
                return null;
            tronconIds.unshift(p.troncon.id);
            const geom = p.reversed ? [...p.troncon.route].reverse() : [...p.troncon.route];
            routeSegments.unshift(geom);
            current = p.from;
        }
        // Concatenate route segments, removing duplicate junction points
        const fullRoute: RoutePoint[] = [];
        for (let s = 0; s < routeSegments.length; s++) {
            const seg = routeSegments[s];
            const startIdx: number = (s > 0 && fullRoute.length > 0) ? 1 : 0; // skip first point (duplicate of prev segment's last)
            for (let i: number = startIdx; i < seg.length; i++) {
                fullRoute.push(seg[i]);
            }
        }
        return { route: fullRoute, tronconIds };
    }
    _findNearestVoiePoint(lat: number, lon: number, maxDistKm: number) {
        let best = null, bestDist = Infinity;
        // Pre-filter with bounding box to skip distant points (flat approx)
        const latRange = maxDistKm / 111;
        const lonRange = maxDistKm / (111 * Math.cos(lat * Math.PI / 180));
        for (const vp of this.voiePoints) {
            if (Math.abs(vp.lat - lat) > latRange || Math.abs(vp.lon - lon) > lonRange)
                continue;
            const d = haversineDistance(lat, lon, vp.lat, vp.lon);
            if (d < bestDist && d <= maxDistKm) {
                bestDist = d;
                best = vp;
            }
        }
        return best;
    }
    // --- Voie lookup for train position ---
    /**
     * Find which voie a train is on based on its position and nearby voie points.
     * Returns the voie string or null if no voie point is close enough.
     * @param {object} position - {lat, lon}
     * @param {number} maxDistKm - max distance to consider (default 5km)
     * @returns {string|null} voie name
     */
    getVoieAtPosition(position: GeoLike | null | undefined, maxDistKm: number = 0.5) {
        if (!position || this.voiePoints.length === 0)
            return null;
        let closestVP = null, closestDist = Infinity;
        let secondDifferentVoieDist = Infinity;
        for (const vp of this.voiePoints) {
            const dist = haversineDistance(position.lat, position.lon, vp.lat, vp.lon);
            if (dist > maxDistKm)
                continue;
            if (dist < closestDist) {
                if (closestVP && String(closestVP.voie) !== String(vp.voie))
                    secondDifferentVoieDist = closestDist;
                closestDist = dist;
                closestVP = vp;
            }
            else if (closestVP && String(closestVP.voie) !== String(vp.voie)) {
                secondDifferentVoieDist = Math.min(secondDifferentVoieDist, dist);
            }
        }
        if (!closestVP)
            return null;
        // In a dense station two parallel tracks can be only a few metres apart.
        // If geometry is ambiguous, return UNKNOWN rather than confidently naming
        // the wrong track and letting safety code reject a real leader.
        if (secondDifferentVoieDist <= closestDist + 0.03)
            return null;
        return closestVP.voie;
    }
    /**
     * Get the troncon a train is currently on, based on position.
     * @param {object} position - {lat, lon}
     * @param {number} maxDistKm - max distance to route to consider
     * @returns {Troncon|null}
     */
    getTronconAtPosition(position: GeoLike | null | undefined, maxDistKm: number = 2, filterVoie: string | null = null, filterWayIds: Set<string> | string[] | string | null = null) {
        if (!position)
            return null;
        const wantedWayIds = filterWayIds instanceof Set
            ? filterWayIds
            : new Set(Array.isArray(filterWayIds) ? filterWayIds.map(String) : (filterWayIds ? [String(filterWayIds)] : []));
        // Quick bounding box pre-filter (~0.01° ≈ 1.1km)
        const margin = maxDistKm / 111;
        const lat = position.lat;
        const lon = position.lon;
        let bestTrc = null;
        let bestDist = Infinity;
        for (const trc of this.troncons) {
            if (!trc.route || trc.route.length < 2)
                continue;
            // Bounding box pre-check using troncon endpoints
            const vpA = this.getVoiePointById(trc.pointA);
            const vpB = this.getVoiePointById(trc.pointB);
            if (vpA && vpB) {
                const minLat = Math.min(vpA.lat, vpB.lat) - margin;
                const maxLat = Math.max(vpA.lat, vpB.lat) + margin;
                const minLon = Math.min(vpA.lon, vpB.lon) - margin;
                const maxLon = Math.max(vpA.lon, vpB.lon) + margin;
                if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon)
                    continue;
            }
            // Filter by voie if specified
            if (filterVoie) {
                const voies = this.getTronconVoies(trc);
                if (!voies.has(filterVoie))
                    continue;
            }
            // Strong OSM identity beats fuzzy geographic proximity. If BOTH the train
            // route and this custom section know their wayIds, an adjacent parallel
            // track is not a candidate even when it is only a few metres away. Legacy
            // sections without wayId metadata still use the geometric fallback.
            if (wantedWayIds.size) {
                let hasKnownWay = false, overlapsWay = false;
                for (const rp of trc.route) {
                    if (rp?.wayId == null || rp.wayId === '')
                        continue;
                    hasKnownWay = true;
                    if (wantedWayIds.has(String(rp.wayId))) {
                        overlapsWay = true;
                        break;
                    }
                }
                if (hasKnownWay && !overlapsWay)
                    continue;
            }
            const dist = this._distanceToRouteKm(position, trc.route);
            if (dist < bestDist && dist <= maxDistKm) {
                bestDist = dist;
                bestTrc = trc;
            }
        }
        return bestTrc;
    }
    // --- Save / Load ---
    _encodeTronconRoute(route: RoutePoint[]) {
        if (!Array.isArray(route) || !route.length)
            return null;
        const q = 1e6, c = [];
        let prevLat = 0, prevLon = 0;
        const speeds = [], fallback = [], directions = [], electrification = [], inclines = [];
        let hasSpeed = false, hasDirection = false, hasElectrification = false;
        const wayDict = [], wayMap = new Map(), wayIdx = [], wayMeta = [];
        for (let i = 0; i < route.length; i++) {
            const pt = route[i] || {};
            const la = Math.round(Number(pt.lat || 0) * q), lo = Math.round(Number(pt.lon || 0) * q);
            if (i === 0)
                c.push(la, lo);
            else
                c.push(la - prevLat, lo - prevLon);
            prevLat = la;
            prevLon = lo;
            const sp = Number.isFinite(Number(pt.maxSpeed)) ? Number(pt.maxSpeed) : 30;
            speeds.push(sp);
            if (sp !== 30)
                hasSpeed = true;
            if (String(pt.maxSpeedSource || '') === 'FALLBACK_30')
                fallback.push(i);
            const wid = pt.wayId != null && pt.wayId !== '' ? String(pt.wayId) : '';
            let wi = 0;
            if (wid) {
                if (!wayMap.has(wid)) {
                    wayMap.set(wid, wayDict.length + 1);
                    wayDict.push(wid);
                    wayMeta.push({ s: pt.service || pt.tags?.service || '', u: pt.usage || pt.tags?.usage || '', o: pt.oneway || pt.tags?.oneway || '', b: pt.bidirectional || pt.tags?.['railway:bidirectional'] || '', r: pt.trackRef || pt.ref || pt.tags?.ref || '' });
                }
                wi = wayMap.get(wid);
            }
            wayIdx.push(wi);
            const td = String(pt.travelDirection || '').toLowerCase();
            const dc = td === 'backward' ? -1 : (td === 'forward' ? 1 : 0);
            directions.push(dc);
            if (dc)
                hasDirection = true;
            const ec = pt.electrified === true ? 1 : (pt.electrified === false ? 0 : -1);
            electrification.push(ec);
            if (ec !== -1)
                hasElectrification = true;
            const inc = pt.tags?.incline ?? pt.incline;
            if (inc != null && inc !== '')
                inclines.push([i, String(inc)]);
        }
        const out: UnknownRecord = { c, q: 6 };
        if (hasSpeed)
            out.s = speeds;
        if (fallback.length)
            out.f = fallback;
        if (wayDict.length) {
            out.wd = wayDict;
            out.w = wayIdx;
            out.wm = wayMeta;
        }
        if (hasDirection)
            out.dr = directions;
        if (hasElectrification)
            out.e = electrification;
        if (inclines.length)
            out.i = inclines;
        return out;
    }
    _decodeTronconRoute(r: unknown[] | EncodedRouteRecord | null | undefined) {
        if (!r)
            return [];
        const validCoord = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
        // Legacy v2 is a raw delta array at 1e5 precision.
        if (Array.isArray(r)) {
            if (r.length < 2 || r.length % 2 !== 0)
                return [];
            const firstLat = Number(r[0]), firstLon = Number(r[1]);
            if (!Number.isFinite(firstLat) || !Number.isFinite(firstLon))
                return [];
            const out = [];
            let lat = firstLat, lon = firstLon;
            if (!validCoord(lat / 1e5, lon / 1e5))
                return [];
            out.push({ lat: lat / 1e5, lon: lon / 1e5 });
            for (let i = 2; i < r.length; i += 2) {
                const dla = Number(r[i]), dlo = Number(r[i + 1]);
                if (!Number.isFinite(dla) || !Number.isFinite(dlo))
                    return [];
                lat += dla;
                lon += dlo;
                const la = lat / 1e5, lo = lon / 1e5;
                if (!validCoord(la, lo))
                    return [];
                out.push({ lat: la, lon: lo });
            }
            return out;
        }
        if (!r || typeof r !== 'object' || !Array.isArray(r.c) || r.c.length < 2 || r.c.length % 2 !== 0)
            return [];
        const div = r.q === 6 ? 1e6 : 1e5, out = [];
        let lat = 0, lon = 0;
        const fallback = new Set(Array.isArray(r.f) ? r.f.map(Number) : []);
        const inclineMap = new Map(Array.isArray(r.i) ? r.i.map((x: readonly unknown[]) => [Number(x?.[0]), x?.[1]]) : []);
        for (let i = 0; i < r.c.length; i += 2) {
            const a = Number(r.c[i]), b = Number(r.c[i + 1]);
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return [];
            if (i === 0) {
                lat = a;
                lon = b;
            }
            else {
                lat += a;
                lon += b;
            }
            const la = lat / div, lo = lon / div;
            if (!validCoord(la, lo))
                return [];
            const rawSpeed = Number(r.s?.[i / 2]);
            const n = i / 2;
            const pt: UnknownRecord = { lat: la, lon: lo, maxSpeed: Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.min(500, rawSpeed) : 30 };
            if (fallback.has(n))
                pt.maxSpeedSource = 'FALLBACK_30';
            else if (r.q === 6)
                pt.maxSpeedSource = 'OSM';
            const wi = Number(r.w?.[n] || 0);
            if (wi > 0 && r.wd?.[wi - 1] != null) {
                pt.wayId = String(r.wd[wi - 1]);
                const wm = r.wm?.[wi - 1] || {};
                if (wm.s)
                    pt.service = wm.s;
                if (wm.u)
                    pt.usage = wm.u;
                if (wm.o)
                    pt.oneway = wm.o;
                if (wm.b)
                    pt.bidirectional = wm.b;
                if (wm.r)
                    pt.trackRef = wm.r;
            }
            const dc = Number(r.dr?.[n] || 0);
            if (dc === 1)
                pt.travelDirection = 'forward';
            else if (dc === -1)
                pt.travelDirection = 'backward';
            const ec = r.e?.[n];
            if (ec === 1)
                pt.electrified = true;
            else if (ec === 0)
                pt.electrified = false;
            if (inclineMap.has(n))
                pt.incline = inclineMap.get(n);
            out.push(pt);
        }
        return out;
    }
    toSave() {
        if (this._saveCache)
            return this._saveCache;
        const saved = {
            voiePoints: this.voiePoints.map((vp: VoiePoint) => {
                const o: UnknownRecord = { id: vp.id, la: Math.round(vp.lat * 1e5), lo: Math.round(vp.lon * 1e5), v: vp.voie };
                if (vp.stationId)
                    o.s = vp.stationId;
                if (vp.lineGroupId)
                    o.lg = vp.lineGroupId;
                if (vp.linePoint)
                    o.lp = true;
                return o;
            }),
            troncons: this.troncons.map((t: Troncon) => {
                const o: UnknownRecord = { id: t.id, a: t.pointA, b: t.pointB, d: Math.round(t.distance * 1000) / 1000, w: Math.round((t.wear || 0) * 100) / 100 };
                if (t.name)
                    o.n = t.name;
                if (t.ref)
                    o.rf = t.ref;
                if (t.trackRef)
                    o.tr = t.trackRef;
                if (t.lineGroupId)
                    o.lg = t.lineGroupId;
                const encoded = this._encodeTronconRoute(t.route);
                if (encoded)
                    o.rt = encoded;
                return o;
            }),
            _v: 3,
        };
        this._saveCache = saved;
        return saved;
    }
    loadFromSave(data: VoiePointSaveData | null | undefined, world: WorldLike = null) {
        this.voiePoints = [];
        this.troncons = [];
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            this._rebuildMaps();
            this._revision++;
            return;
        }
        const compact = data._v === 2 || data._v === 3;
        const vpSeen = new Set();
        for (const d of Array.isArray(data.voiePoints) ? data.voiePoints : []) {
            if (!d || typeof d !== 'object')
                continue;
            const rawId = String(d.id ?? '');
            if (!rawId || vpSeen.has(rawId))
                continue;
            const lat = compact ? Number(d.la) / 1e5 : Number(d.lat), lon = compact ? Number(d.lo) / 1e5 : Number(d.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
                continue;
            vpSeen.add(rawId);
            const rawStationId = String((compact ? d.s : d.stationId) ?? '');
            this.voiePoints.push(new VoiePoint({ id: rawId, lat, lon, voie: compact ? d.v : d.voie, stationId: rawStationId, lineGroupId: compact ? d.lg : d.lineGroupId, linePoint: compact ? d.lp : d.linePoint }));
        }
        const vpIds = new Set(this.voiePoints.map((v: VoiePoint) => v.id));
        const stationIds = world?.stations ? new Set(world.stations.map((st: { id?: unknown }) => String(st?.id ?? '')).filter(Boolean)) : null;
        if (stationIds) {
            for (const vp of this.voiePoints) {
                if (vp.stationId && !stationIds.has(vp.stationId))
                    vp.stationId = null;
            }
        }
        const endpointValid = (id: string) => vpIds.has(id) || !stationIds || stationIds.has(id);
        const trcSeen = new Set();
        const routeDistance = (route: RoutePoint[]) => { let d = 0; for (let i = 1; i < route.length; i++)
            d += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon); return d; };
        for (const d of Array.isArray(data.troncons) ? data.troncons : []) {
            if (!d || typeof d !== 'object')
                continue;
            const id = String(d.id ?? ''), pointA = String((compact ? d.a : d.pointA) ?? ''), pointB = String((compact ? d.b : d.pointB) ?? '');
            if (!id || trcSeen.has(id) || !pointA || !pointB || pointA === pointB || !endpointValid(pointA) || !endpointValid(pointB))
                continue;
            let route = [], ref = '', name = '', trackRef = '', lineGroupId = null, distRaw, wearRaw;
            if (data._v === 3) {
                route = this._decodeTronconRoute(d.rt);
                distRaw = d.d;
                wearRaw = d.w;
                lineGroupId = d.lg ?? null;
                name = d.n || '';
                ref = d.rf || '';
                trackRef = d.tr || '';
            }
            else if (data._v === 2) {
                route = Array.isArray(d.r) ? this._decodeTronconRoute(d.r) : [];
                ref = typeof d.r === 'string' ? d.r : '';
                distRaw = d.d;
                wearRaw = d.w;
                lineGroupId = d.lg ?? null;
                name = d.n || '';
                trackRef = d.tr || '';
            }
            else {
                route = (Array.isArray(d.route) ? d.route : []).filter((pt: UnknownRecord) => pt && Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lon)) && Number(pt.lat) >= -90 && Number(pt.lat) <= 90 && Number(pt.lon) >= -180 && Number(pt.lon) <= 180).map((pt: UnknownRecord) => ({ ...pt, lat: Number(pt.lat), lon: Number(pt.lon) }));
                distRaw = d.distance;
                wearRaw = d.wear;
                lineGroupId = d.lineGroupId ?? null;
                name = d.name || '';
                ref = d.ref || '';
                trackRef = d.trackRef || '';
            }
            const rd = route.length >= 2 ? routeDistance(route) : 0;
            let distance = Number(distRaw);
            if (!Number.isFinite(distance) || distance <= 0)
                distance = rd;
            if (!Number.isFinite(distance) || distance < 0)
                distance = 0;
            const wear = Number(wearRaw);
            trcSeen.add(id);
            this.troncons.push(new Troncon({ id, pointA, pointB, route, distance, wear: Number.isFinite(wear) ? Math.max(0, Math.min(100, wear)) : 0, lineGroupId, name, ref, trackRef }));
        }
        this._rebuildMaps();
        this._revision++;
    }
}
