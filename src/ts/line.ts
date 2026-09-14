import { canonicalTrackRef, normalizeStationTrackIdentity, stationTrackResourceKey, type StationTrackIdentity } from './station-track-identity.js';
type __KPStruct16 = number;
import type { World } from './world.js';
type UnknownRecord = Record<string, unknown>;
type LineRoutePoint = UnknownRecord & { lat?: unknown; lon?: unknown; maxSpeed?: unknown; electrified?: unknown; fallback?: unknown; synthetic?: unknown; trackRef?: unknown; ref?: unknown; name?: unknown };
type LineOrm = {
    findRoute: (latA: number, lonA: number, latB: number, lonB: number) => Promise<unknown>;
    getRouteDistance: (route: unknown[]) => number;
};
type PlatformState = { total: number; occupied: Map<string | number, string> };
type PlatformAssignOptions = { exactPreferred?: boolean; trackIdentity?: StationTrackIdentity | null; displayName?: string };
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
let nextLineId = 1;
export class Line {
    id: string;
    name: string;
    color: string;
    code: string;
    stops: string[];
    trackIds: string[];
    constructor(input: unknown = {}) {
        const data: UnknownRecord = isRecord(input) ? input : {};
        const rawId = data.id == null ? '' : String(data.id);
        this.id = rawId || `line-${nextLineId++}`;
        this.name = String(data.name || 'Ligne').slice(0, 160);
        this.color = /^#[0-9a-f]{6}$/i.test(String(data.color || '')) ? String(data.color) : '#3b82f6';
        this.code = String(data.code || '').slice(0, 40);
        this.stops = Array.isArray(data.stops) ? data.stops.map((id:string) => String(id ?? '')).filter(Boolean) : []; // ordered station IDs
        this.trackIds = Array.isArray(data.trackIds) ? data.trackIds.map((id:string) => String(id ?? '')).filter(Boolean) : []; // track IDs between consecutive stops
    }
    getStationIds() {
        return [...this.stops];
    }
    hasStation(stationId:string) {
        return this.stops.includes(stationId);
    }
    hasTrack(trackId:string) {
        return this.trackIds.includes(trackId);
    }
    toSave() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            code: this.code,
            stops: [...this.stops],
            trackIds: [...this.trackIds],
        };
    }
}
export class LineManager {
    lines: Line[];
    _trackLineMap: Map<string, Line[]> | null;
    constructor() {
        this._trackLineMap = null;
        this.lines = [];
    }
    addLine(data: unknown) {
        const line = new Line(data || {});
        if (this.lines.some((l: { id: unknown }) => l.id === line.id))
            line.id = `line-${nextLineId++}`;
        this.lines.push(line);
        this.invalidateTrackLineMap();
        return line;
    }
    removeLine(id:string) {
        id = String(id ?? '');
        this.lines = this.lines.filter((l: { id: unknown }) => l.id !== id);
        this.invalidateTrackLineMap();
    }
    getLine(id:string) {
        id = String(id ?? '');
        return this.lines.find((l: { id: unknown }) => l.id === id);
    }
    getAll() {
        return this.lines;
    }
    getLinesForStation(stationId:string) {
        return this.lines.filter((l) => l.hasStation(stationId));
    }
    getLinesForTrack(trackId:string) {
        // Use cached track→line map for O(1) lookup
        if (!this._trackLineMap)
            this._rebuildTrackLineMap();
        return this._trackLineMap!.get(trackId) || [];
    }
    _rebuildTrackLineMap() {
        this._trackLineMap = new Map();
        for (const l of this.lines) {
            for (const tid of l.trackIds) {
                let arr = this._trackLineMap.get(tid);
                if (!arr) {
                    arr = [];
                    this._trackLineMap.set(tid, arr);
                }
                arr.push(l);
            }
        }
    }
    invalidateTrackLineMap() { this._trackLineMap = null; }
    /**
     * Build a line from ordered station IDs.
     * Reuses existing tracks (troncons communs) if they exist between station pairs.
     * Creates new tracks via ORM if they don't exist.
     */
    async buildLine(input: unknown, world: World, orm: LineOrm) {
        if (!isRecord(input))
            return null;
        const lineData = input;
        const stops = Array.isArray(lineData.stops) ? lineData.stops.filter((id:string) => typeof id === 'string' && id) : [];
        if (stops.length < 2 || new Set(stops).size < 2)
            return null;
        const trackIds: string[] = [];
        const createdTrackIds: string[] = [];
        const manualRoutes = Array.isArray(lineData.manualRoutes) ? lineData.manualRoutes : [];
        const abortBuild = () => {
            for (const id of createdTrackIds)
                world.removeTrack(id);
            return null;
        };
        for (let i = 0; i < stops.length - 1; i++) {
            const stA = world.getStationById(stops[i]);
            const stB = world.getStationById(stops[i + 1]);
            if (!stA || !stB) {
                console.warn('Création de ligne refusée : gare introuvable', stops[i], stops[i + 1]);
                return abortBuild();
            }
            // Manual trace is an explicit player override and therefore takes
            // precedence over a previously cached station-to-station track. Otherwise
            // the "tracé manuel" button can appear to save successfully while the
            // line silently keeps the old automatic ORM path.
            const manualRoute = manualRoutes[i];
            if (Array.isArray(manualRoute) && manualRoute.length >= 2) {
                const routeOk = manualRoute.every((p: { lat: unknown; lon: unknown; fallback: unknown; synthetic: unknown }) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && !p.fallback && !p.synthetic);
                const distance = routeOk ? Number(orm.getRouteDistance(manualRoute)) : NaN;
                if (!routeOk || !Number.isFinite(distance) || distance <= 0) {
                    console.warn(`Tracé manuel invalide pour ${stA.name} -> ${stB.name}`);
                    return abortBuild();
                }
                const speeds = manualRoute.map((r: { maxSpeed: unknown }) => Number(r.maxSpeed)).filter((v: __KPStruct16) => Number.isFinite(v) && v > 0);
                const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((sum: number, value: number) => sum + value, 0) / speeds.length) : 160;
                const electrified = manualRoute.some((r: { electrified: unknown }) => r.electrified === false) ? false : true;
                const routeLabel = manualRoute.find((p: { trackRef: unknown; ref: unknown; name: unknown }) => p.trackRef || p.ref || p.name);
                const trackName = routeLabel ? (routeLabel.trackRef || routeLabel.ref || routeLabel.name) : `${stA.name} - ${stB.name}`;
                const track = world.addTrack({
                    stationA: stA.id, stationB: stB.id,
                    distance: Math.round(distance * 1000) / 1000, maxSpeed: avgSpeed,
                    electrified, name: trackName, route: manualRoute,
                });
                trackIds.push(track.id);
                createdTrackIds.push(track.id);
                continue;
            }
            // Check if a track already exists between these two stations (troncon commun)
            let existing = world.getTrackBetween(stA.id, stB.id);
            if (existing) {
                trackIds.push(existing.id);
                continue;
            }
            // No existing track: the OSM/ORM graph is authoritative. A line leg only
            // exists when a real railway route can be resolved; Rail Empire never invents
            // a straight connection between two railway stations.
            try {
                const route = await orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
                if (!Array.isArray(route) || route.length < 2) {
                    console.warn(`No OSM/ORM railway route for ${stA.name} -> ${stB.name}`);
                    return abortBuild();
                }
                const routeOk = route.every((p: { lat: unknown; lon: unknown; fallback: unknown; synthetic: unknown }) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && !p.fallback && !p.synthetic);
                const distance = routeOk ? Number(orm.getRouteDistance(route)) : NaN;
                if (!routeOk || !Number.isFinite(distance) || distance <= 0) {
                    console.warn(`Route OSM/ORM invalide pour ${stA.name} -> ${stB.name}`);
                    return abortBuild();
                }
                const speeds = route.map((r: { maxSpeed: unknown }) => Number(r.maxSpeed)).filter((v) => Number.isFinite(v) && v > 0);
                const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
                const routeLabel = route.find((p: { trackRef: unknown; ref: unknown; name: unknown }) => p.trackRef || p.ref || p.name);
                const trackName = routeLabel ? (routeLabel.trackRef || routeLabel.ref || routeLabel.name) : `${stA.name} - ${stB.name}`;
                const electrified = route.some((r: { electrified: unknown }) => r.electrified === false) ? false : true;
                const track = world.addTrack({
                    stationA: stA.id,
                    stationB: stB.id,
                    distance: Math.round(distance * 1000) / 1000,
                    maxSpeed: avgSpeed,
                    electrified,
                    name: trackName,
                    route,
                });
                trackIds.push(track.id);
                createdTrackIds.push(track.id);
            }
            catch (e: unknown) {
                console.warn(`ORM route failed for ${stA.name} -> ${stB.name}:`, e);
                return abortBuild();
            }
        }
        lineData.trackIds = trackIds;
        return this.addLine(lineData);
    }
    toSave() {
        return this.lines.map((l) => l.toSave());
    }
    loadFromSave(data: unknown, world: World | null = null) {
        if (!Array.isArray(data)) {
            this.lines = [];
            this.invalidateTrackLineMap();
            return;
        }
        const seen = new Set();
        this.lines = [];
        for (const raw of data) {
            if (!raw || typeof raw !== 'object')
                continue;
            const line = new Line(raw);
            if (!line.id || seen.has(line.id) || line.stops.length < 2)
                continue;
            if (line.stops.some((id:string, i:number) => i > 0 && id === line.stops[i - 1]))
                continue;
            if (world) {
                if (line.stops.some((id:string) => !world.getStationById?.(id)))
                    continue;
                const rebuilt = [];
                let ok = true;
                for (let i = 0; i < line.stops.length - 1; i++) {
                    const a = line.stops[i], b = line.stops[i + 1];
                    const savedId = line.trackIds[i];
                    const savedTrack = savedId ? (world.tracks || []).find((t: { id: unknown }) => t?.id === savedId) : null;
                    const connects = savedTrack && ((savedTrack.stationA === a && savedTrack.stationB === b) || (savedTrack.stationA === b && savedTrack.stationB === a));
                    const track = connects ? savedTrack : world.getTrackBetween?.(a, b);
                    if (!track) {
                        ok = false;
                        break;
                    }
                    rebuilt.push(track.id);
                }
                if (!ok)
                    continue;
                line.trackIds = rebuilt;
            }
            seen.add(line.id);
            this.lines.push(line);
        }
        this.invalidateTrackLineMap();
        nextLineId = this.lines.reduce((max:number, l: { id: unknown }) => {
            const num = parseInt(String(l.id || '').replace('line-', ''));
            return isNaN(num) ? max : Math.max(max, num + 1);
        }, nextLineId);
    }
}
/**
 * PlatformManager - tracks platform allocation at stations.
 * Each station has N platforms. A train occupies one platform while stopped.
 */
export class PlatformManager {
    stationPlatforms: Map<string, PlatformState>;
    capacityProvider: ((stationId: string, base: number) => number) | null = null;
    private effectiveCapacity(stationId: string, value: unknown): number {
        const parsed = Math.floor(Number(value));
        const base = Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
        const result = Math.floor(Number(this.capacityProvider?.(stationId, base) ?? base));
        return Number.isFinite(result) && result >= base ? result : base;
    }
    private physicalAliases = new Map<string, Map<string, string | number>>();
    private displayNames = new Map<string, Map<string | number, string>>();
    private physicallyReferencedKeys = new Map<string, Set<string | number>>();
    constructor() {
        // stationId -> { total: N, occupied: Map<platformIndex, trainId> }
        this.stationPlatforms = new Map();
    }
    initStation(stationId:string, numPlatforms: unknown) {
        const total = this.effectiveCapacity(stationId, numPlatforms);
        if (!this.stationPlatforms.has(stationId)) {
            this.stationPlatforms.set(stationId, {
                total,
                occupied: new Map(),
            });
        }
        else {
            // Update total if changed
            this.stationPlatforms.get(stationId)!.total = total;
        }
    }
    /**
     * Try to assign a platform to a train at a station.
     * Returns the platform name/number or null if all platforms are occupied.
     * @param {string} preferred - preferred platform name from schedule (optional)
     */
    assignPlatform(stationId:string, trainId:string, numPlatforms: unknown, preferred: unknown, options: PlatformAssignOptions | boolean | null = null) {
        const parsedTotal = Math.floor(Number(numPlatforms));
        const baseTotal = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 2;
        const requestedTotal = this.effectiveCapacity(stationId, baseTotal);
        if (!this.stationPlatforms.has(stationId)) {
            this.initStation(stationId, baseTotal);
        }
        else {
            // A station may first be touched through a fallback `2 platforms` path and
            // only later reveal its real OSM/gameplay capacity. Grow lazily when better
            // information arrives; never shrink merely because a later fallback says 2.
            const data0 = this.stationPlatforms.get(stationId)!;
            if (requestedTotal > Number(data0.total || 0))
                data0.total = requestedTotal;
        }
        const data = this.stationPlatforms.get(stationId)!;
        const exactPreferred = options === true || (typeof options === 'object' && options?.exactPreferred === true);
        const identity = typeof options === 'object' ? normalizeStationTrackIdentity(options?.trackIdentity) : null;
        if (identity) return this._assignPhysicalTrack(stationId, trainId, data, identity, typeof options === 'object' ? options?.displayName || '' : '');
        // Unbound legacy requests cannot enter an occupied physical track merely
        // because that train's display name differs from the stored ORM key.
        if (preferred != null && String(preferred).trim()) {
            const wantedLabel = canonicalTrackRef(preferred);
            for (const [key, label] of this.displayNames.get(stationId) || []) {
                const owner = data.occupied.get(key);
                if (!this.physicallyReferencedKeys.get(stationId)?.has(key) && canonicalTrackRef(label) === wantedLabel && owner != null && owner !== trainId) return null;
            }
        }
        // A real ref may have been renamed or split across OSM ways. Legacy
        // requests must consult those same aliases, in either occupation order.
        const refAlias = preferred == null ? undefined : this.physicalAliases.get(stationId)?.get(`ref:${canonicalTrackRef(preferred)}`);
        if (refAlias != null) {
            const owner = data.occupied.get(refAlias);
            if (owner != null && owner !== trainId) return null;
            for (const [key, existingOwner] of data.occupied) {
                if (existingOwner === trainId && key !== refAlias) return null;
            }
            data.occupied.set(refAlias, trainId);
            this.displayNames.get(stationId)?.delete(refAlias);
            return refAlias;
        }
        // Check if train already has a platform
        for (const [plat, tid] of data.occupied) {
            if (tid === trainId) {
                // The owner of track 1 is not automatically the owner of track 2.
                if (exactPreferred && preferred != null && String(preferred).trim()
                    && canonicalTrackRef(plat) !== canonicalTrackRef(preferred)) return null;
                return plat;
            }
        }
        // If a preferred platform/track was specified and it's free, use it.
        // V2 Schedule Creator bindings are exact physical track labels (e.g. Paris-Est
        // "20"), NOT ordinal platform numbers constrained by world.station.platforms.
        // When no native VoiePoint exists, exactPreferred preserves that track identity
        // as a station resource instead of falsely declaring "voie occupée" because
        // a generic station model happens to advertise only 2 platforms.
        if (preferred != null && String(preferred).trim() !== '') {
            const rawPreferred = String(preferred).trim();
            let preferredKey = null;
            const numericLabel = rawPreferred.match(/^(?:voie|track|gleis|v)?\s*(\d+)$/i);
            if (numericLabel) {
                const n = Number(numericLabel[1]);
                if (!Number.isSafeInteger(n)) preferredKey = exactPreferred ? canonicalTrackRef(rawPreferred) : null;
                else if (Number.isInteger(n) && n >= 1 && data.occupied.has(String(n)))
                    preferredKey = String(n); // Existing exact key survives newly discovered capacity.
                else if (Number.isInteger(n) && n >= 1 && n <= data.total)
                    preferredKey = n;
                else if (exactPreferred)
                    preferredKey = String(n);
            }
            else if (exactPreferred) {
                // A, 1 bis and V1M are real track labels, not requests for any track.
                preferredKey = rawPreferred;
            }
            if (preferredKey != null) {
                const owner = data.occupied.get(preferredKey);
                if (owner == null || owner === trainId) {
                    data.occupied.set(preferredKey, trainId);
                    return preferredKey;
                }
                // Exact requested track exists logically but is genuinely owned by another
                // train: never spill onto a different free platform.
                if (exactPreferred)
                    return null;
            }
        }
        // Find first free platform
        for (let i = 1; i <= data.total; i++) {
            const physicalKey = this.physicalAliases.get(stationId)?.get(`ref:${i}`) ?? i;
            if (!data.occupied.has(i) && !data.occupied.has(String(i)) && !data.occupied.has(physicalKey)) {
                data.occupied.set(physicalKey, trainId);
                this.displayNames.get(stationId)?.delete(physicalKey);
                return physicalKey;
            }
        }
        return null; // All platforms occupied
    }
    /** ORM aliases connect validated way IDs and real track refs, never display names. */
    private _assignPhysicalTrack(stationId: string, trainId: string, data: PlatformState,
        identity: StationTrackIdentity, displayName: string): string | number | null {
        const aliases = this.physicalAliases.get(stationId) || new Map<string, string | number>();
        const resource = stationTrackResourceKey(identity);
        const ref = canonicalTrackRef(identity.trackRef);
        const aliasNames = ref ? [resource, `ref:${ref}`] : [resource];
        const candidates = new Set<string | number>();
        for (const name of aliasNames) {
            const mapped = aliases.get(name);
            if (mapped != null) candidates.add(mapped);
        }
        // A legacy service using the real platform number must conflict with the
        // same ORM track. Both numeric representations occur in old/custom worlds.
        let refKey: string | number | null = null;
        if (ref) {
            const n = /^\d+$/.test(ref) ? Number(ref) : NaN;
            refKey = Number.isSafeInteger(n) && n >= 1 && n <= data.total ? n : ref;
            candidates.add(refKey);
            for (const key of data.occupied.keys()) {
                if (canonicalTrackRef(key) === ref) candidates.add(key);
            }
        }
        // With no real track ref, an already occupied legacy label is ambiguous:
        // hold, do not invent proof that it is a different physical track. This is
        // only an occupancy guard, never an alias between two bound ORM tracks.
        if (!ref && displayName) {
            const legacyLabel = canonicalTrackRef(displayName);
            for (const [key, owner] of data.occupied) {
                if (!String(key).startsWith('@') && canonicalTrackRef(key) === legacyLabel && owner !== trainId) return null;
            }
        }
        const key = aliases.get(resource) ?? (ref ? aliases.get(`ref:${ref}`) : undefined) ?? refKey ?? resource;
        candidates.add(key);
        // No reservation/alias is changed on refusal. Inconsistent imports with two
        // different owners stay blocked rather than losing one owner's protection.
        for (const candidate of candidates) {
            const owner = data.occupied.get(candidate);
            if (owner != null && owner !== trainId) return null;
        }
        for (const [owned, owner] of data.occupied) {
            if (owner === trainId && !candidates.has(owned)) return null;
        }
        for (const candidate of candidates) {
            if (candidate !== key && data.occupied.get(candidate) === trainId) data.occupied.delete(candidate);
        }
        for (const [name, oldKey] of aliases) {
            if (candidates.has(oldKey)) aliases.set(name, key);
        }
        for (const name of aliasNames) aliases.set(name, key);
        this.physicalAliases.set(stationId, aliases);
        const realRefs = this.physicallyReferencedKeys.get(stationId) || new Set<string | number>();
        if (ref || [...candidates].some(candidate => realRefs.has(candidate))) realRefs.add(key);
        this.physicallyReferencedKeys.set(stationId, realRefs);
        data.occupied.set(key, trainId);
        const labels = this.displayNames.get(stationId) || new Map<string | number, string>();
        labels.set(key, displayName || identity.trackRef || resource);
        this.displayNames.set(stationId, labels);
        return key;
    }

    /** Identify a unique blocking owner without mutating aliases/reservations. */
    getPhysicalTrackOwner(stationId: string, input: StationTrackIdentity, displayName = ''): string | null {
        const identity = normalizeStationTrackIdentity(input);
        const data = this.stationPlatforms.get(stationId);
        if (!identity || !data) return null;
        const aliases = this.physicalAliases.get(stationId);
        const ref = canonicalTrackRef(identity.trackRef);
        const keys = new Set<string | number>([stationTrackResourceKey(identity)]);
        for (const name of [stationTrackResourceKey(identity), ...(ref ? [`ref:${ref}`] : [])]) {
            const key = aliases?.get(name);
            if (key != null) keys.add(key);
        }
        if (ref) {
            for (const key of data.occupied.keys()) if (canonicalTrackRef(key) === ref) keys.add(key);
        } else if (displayName) {
            for (const key of data.occupied.keys()) {
                if (!String(key).startsWith('@') && canonicalTrackRef(key) === canonicalTrackRef(displayName)) keys.add(key);
            }
        }
        const owners = new Set<string>();
        for (const key of keys) { const owner = data.occupied.get(key); if (owner != null) owners.add(owner); }
        return owners.size === 1 ? owners.values().next().value! : null;
    }

    /**
     * Release a platform when a train departs.
     */
    releasePlatform(stationId:string, trainId:string) {
        const data = this.stationPlatforms.get(stationId);
        if (!data)
            return;
        for (const [plat, tid] of data.occupied) {
            if (tid === trainId) {
                data.occupied.delete(plat);
                this.displayNames.get(stationId)?.delete(plat);
                return;
            }
        }
    }
    /**
     * Get the platform a train is on, or null.
     */
    getPlatformForTrain(stationId:string, trainId:string) {
        const data = this.stationPlatforms.get(stationId);
        if (!data)
            return null;
        for (const [plat, tid] of data.occupied) {
            if (tid === trainId)
                return plat;
        }
        return null;
    }
    /**
     * Check how many free platforms are available.
     */
    getFreePlatforms(stationId:string) {
        const data = this.stationPlatforms.get(stationId);
        if (!data)
            return 0;
        return Math.max(0, Number(data.total || 0) - data.occupied.size);
    }
    /**
     * Get platform status for display.
     */
    getStatus(stationId:string) {
        const data = this.stationPlatforms.get(stationId);
        if (!data)
            return { total: 0, used: 0, free: 0, assignments: [] };
        const assignments = [];
        for (const [plat, tid] of data.occupied) {
            assignments.push({ platform: this.displayNames.get(stationId)?.get(plat) || plat, resourceId: plat, trainId: tid });
        }
        return {
            total: data.total,
            used: data.occupied.size,
            free: Math.max(0, Number(data.total || 0) - data.occupied.size),
            assignments,
        };
    }
}

