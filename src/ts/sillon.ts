import type { World } from './world.js';
type SillonPoint = {
    lat: number;
    lon: number;
    maxSpeed?: number;
    electrified?: boolean;
    [key: string]: unknown;
};
type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
import { haversineDistance } from './simulation.js';
let nextSillonId = 1;
export class Sillon {
    id: string;
    name: string;
    fromStationId: string;
    toStationId: string;
    fromStationName: string;
    toStationName: string;
    route: SillonPoint[];
    distance: number;
    maxSpeed: number;
    electrified: boolean;
    createdDate: string;
    constructor(input: unknown = {}) {
        const data: UnknownRecord = isRecord(input) ? input : {};
        const rawId = data.id == null ? '' : String(data.id);
        this.id = rawId || `sillon-${nextSillonId++}`;
        this.name = String(data.name || 'V1').slice(0, 160);
        this.fromStationId = String(data.fromStationId ?? '');
        this.toStationId = String(data.toStationId ?? '');
        this.fromStationName = String(data.fromStationName || '').slice(0, 200);
        this.toStationName = String(data.toStationName || '').slice(0, 200);
        this.route = Array.isArray(data.route) ? data.route.filter((p: unknown): p is UnknownRecord => isRecord(p) && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && Number(p.lat) >= -90 && Number(p.lat) <= 90 && Number(p.lon) >= -180 && Number(p.lon) <= 180 && !p.fallback && !p.synthetic).map((p): SillonPoint => ({ ...p, lat: Number(p.lat), lon: Number(p.lon), maxSpeed: Number.isFinite(Number(p.maxSpeed)) ? Number(p.maxSpeed) : undefined, electrified: p.electrified !== false })) : []; // real ORM points only
        const savedDistance = Number(data.distance);
        let routeDistance = 0;
        for (let i = 1; i < this.route.length; i++)
            routeDistance += haversineDistance(this.route[i - 1].lat, this.route[i - 1].lon, this.route[i].lat, this.route[i].lon);
        this.distance = Number.isFinite(savedDistance) && savedDistance > 0 ? savedDistance : routeDistance;
        this.maxSpeed = Number.isFinite(Number(data.maxSpeed)) && Number(data.maxSpeed) > 0 ? Math.min(500, Number(data.maxSpeed)) : 160;
        this.electrified = data.electrified !== false;
        this.createdDate = /^\d{4}-\d{2}-\d{2}$/.test(String(data.createdDate || '')) ? String(data.createdDate) : (new Date().toISOString().split('T')[0] ?? '');
    }
    get isValid() {
        return this.fromStationId && this.toStationId && this.fromStationId !== this.toStationId &&
            Array.isArray(this.route) && this.route.length >= 2;
    }
}
export class SillonManager {
    sillons: Sillon[];
    constructor() {
        this.sillons = [];
    }
    add(data: unknown) {
        const sillon = new Sillon(data || {});
        if (!sillon.isValid || !(sillon.distance > 0))
            return null;
        if (this.sillons.some((s: { id: unknown }) => s.id === sillon.id))
            sillon.id = `sillon-${nextSillonId++}`;
        this.sillons.push(sillon);
        return sillon;
    }
    remove(id:string) {
        id = String(id ?? '');
        this.sillons = this.sillons.filter((s: { id: unknown }) => s.id !== id);
    }
    getById(id:string) {
        id = String(id ?? '');
        return this.sillons.find((s: { id: unknown }) => s.id === id);
    }
    getAll() {
        return this.sillons;
    }
    getBetween(fromStationId:string, toStationId:string) {
        fromStationId = String(fromStationId ?? '');
        toStationId = String(toStationId ?? '');
        return this.sillons.filter((s: { fromStationId: unknown; toStationId: unknown }) => s.fromStationId === fromStationId && s.toStationId === toStationId);
    }
    getNextName(fromStationId:string, toStationId:string) {
        const existing = this.getBetween(fromStationId, toStationId).map((s: { name: unknown }) => s.name);
        const suffixes = ['', 'BIS', 'TER', 'QUATER', 'QUINQUIES'];
        for (let i = 0; i < existing.length + suffixes.length + 2; i++) {
            const base = Math.floor(i / suffixes.length) + 1;
            const suffix = suffixes[i % suffixes.length];
            const candidate = `V${base}${suffix}`;
            if (!existing.includes(candidate))
                return candidate;
        }
        return `V${existing.length + 1}`;
    }
    _samePoint(a: SillonPoint, b: SillonPoint) {
        if (!a || !b)
            return false;
        return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
    }
    _pathEntry(route: Sillon[]) {
        if (!route || route.length === 0)
            return null;
        const first = route[0];
        const last = route[route.length - 1];
        const outRoute: SillonPoint[] = [];
        for (let i = 0; i < route.length; i++) {
            const r = route[i].route || [];
            if (!Array.isArray(r) || r.length < 2)
                return null;
            // A composite auto-sillon must be physically continuous. Never draw an
            // implicit diagonal between two different platform/track anchors that merely
            // share the same station id. The missing station-throat route must be explicit.
            if (i > 0 && outRoute.length > 0 && !this._samePoint(outRoute[outRoute.length - 1], r[0]))
                return null;
            for (let j = 0; j < r.length; j++) {
                const pt = r[j];
                if (outRoute.length > 0 && i > 0 && j === 0 && this._samePoint(outRoute[outRoute.length - 1], pt))
                    continue;
                outRoute.push({ lat: pt.lat, lon: pt.lon, maxSpeed: pt.maxSpeed || route[i].maxSpeed, electrified: pt.electrified !== false && route[i].electrified !== false });
            }
        }
        let totalDistance = 0;
        let weightedSpeed = 0;
        for (const s of route) {
            totalDistance += s.distance || 0;
            weightedSpeed += (s.distance || 0) * (s.maxSpeed || 160);
        }
        const avgSpeed = totalDistance > 0 ? Math.round(weightedSpeed / totalDistance) : (route[0].maxSpeed || 160);
        return {
            id: route.map((s: { id: unknown }) => s.id).join('|'),
            name: route.map((s: { name: unknown }) => s.name).join(' → '),
            fromStationId: first.fromStationId,
            toStationId: last.toStationId,
            fromStationName: first.fromStationName,
            toStationName: last.toStationName,
            route: outRoute,
            distance: totalDistance,
            maxSpeed: avgSpeed,
            electrified: route.every((s: { electrified: unknown }) => s.electrified !== false),
            segments: route.map((s: { name: unknown }) => s.name),
            _isPath: true,
        };
    }
    findPaths(fromStationId:string, toStationId:string, maxHops: number = 4) {
        const results: Array<ReturnType<SillonManager['_pathEntry']>> = [];
        const resultIds = new Set();
        const addResult = (entry: ReturnType<SillonManager['_pathEntry']> | null) => { if (entry && !resultIds.has(entry.id)) {
            resultIds.add(entry.id);
            results.push(entry);
        } };
        const direct = this.getBetween(fromStationId, toStationId);
        for (const s of direct)
            addResult(this._pathEntry([s]));
        if (maxHops <= 1 || this.sillons.length === 0)
            return results;
        const adj: Map<string, Sillon[]> = new Map();
        for (const s of this.sillons) {
            if (!adj.has(s.fromStationId))
                adj.set(s.fromStationId, []);
            adj.get(s.fromStationId)!.push(s);
        }
        const queue: Array<{ current: string; route: Sillon[]; visited: Set<string> }> = [{ current: fromStationId, route: [], visited: new Set([fromStationId]) }];
        while (queue.length > 0) {
            const entry = queue.shift();
            if (!entry) continue;
            const { current, route, visited } = entry;
            if (route.length >= maxHops)
                continue;
            const next = adj.get(current) || [];
            for (const s of next) {
                if (visited.has(s.toStationId))
                    continue;
                const newRoute = [...route, s];
                if (s.toStationId === toStationId) {
                    addResult(this._pathEntry(newRoute));
                }
                else {
                    const newVisited = new Set(visited);
                    newVisited.add(s.toStationId);
                    queue.push({ current: s.toStationId, route: newRoute, visited: newVisited });
                }
            }
        }
        return results;
    }
    toSave() {
        return this.sillons.map((s: { id: unknown; name: unknown; fromStationId: unknown; toStationId: unknown; fromStationName: unknown; toStationName: unknown; route: unknown; distance: unknown; maxSpeed: unknown; electrified: unknown; createdDate: unknown }) => ({
            id: s.id,
            name: s.name,
            fromStationId: s.fromStationId,
            toStationId: s.toStationId,
            fromStationName: s.fromStationName,
            toStationName: s.toStationName,
            route: s.route,
            distance: s.distance,
            maxSpeed: s.maxSpeed,
            electrified: s.electrified,
            createdDate: s.createdDate,
        }));
    }
    loadFromSave(arr: unknown, world: World | null = null) {
        this.sillons = [];
        if (!Array.isArray(arr))
            return;
        const seen = new Set();
        const stationIds = world?.stations ? new Set(world.stations.map((st: { id: unknown }) => String(st?.id ?? '')).filter(Boolean)) : null;
        for (const d of arr) {
            if (!d || typeof d !== 'object')
                continue;
            const sillon = new Sillon(d);
            if (!sillon.isValid || !(sillon.distance > 0) || !sillon.id || seen.has(sillon.id))
                continue;
            if (stationIds && (!stationIds.has(sillon.fromStationId) || !stationIds.has(sillon.toStationId)))
                continue;
            seen.add(sillon.id);
            this.sillons.push(sillon);
            const num = parseInt(String(sillon.id).replace(/^sillon-/, ''), 10);
            if (Number.isFinite(num) && num >= nextSillonId)
                nextSillonId = num + 1;
        }
    }
}

