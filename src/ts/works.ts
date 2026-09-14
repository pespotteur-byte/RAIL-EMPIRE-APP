type __KPStruct528 = number;
type __KPStruct529 = string;
import type { World } from './world.js';
type WorkInput = {
    id?: unknown; name?: unknown; label?: unknown; impact?: unknown; speedLimit?: unknown; direction?: unknown; manual?: unknown; scope?: unknown; affectsTraffic?: unknown; stationId?: unknown; stationName?: unknown; station?: unknown; stationImpact?: unknown; stationSpeedLimit?: unknown; recurrence?: unknown; daysOfWeek?: unknown; zones?: unknown; manualRoute?: unknown; startDate?: unknown; startTime?: unknown; endDate?: unknown; endTime?: unknown;
    startBinding?: unknown; endBinding?: unknown; constraints?: unknown[]; route?: unknown; segments?: unknown[]; distanceKm?: unknown;
    startStation?: { name?: unknown } | null; endStation?: { name?: unknown } | null; stationA?: unknown; stationB?: unknown; trackId?: unknown;
};
import { normalizeSectionDirection } from './rail-section-geometry.js';
let nextWorksId = 1;
let nextWorksZoneId = 1;
function clone(v: unknown) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function workText(v: unknown, fallback: string = ''): string { if (v == null)
    return fallback; const s = String(v).trim(); return s || fallback; }
function validDate(v: unknown) { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    return false; const [y, m, d] = v.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return dt.toISOString().slice(0, 10) === v; }
function validTime(v: unknown) { if (typeof v !== 'string' || !/^\d{1,2}:\d{2}$/.test(v))
    return false; const [h, m] = v.split(':').map(Number); return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60; }
function cleanRoute(route: unknown) { return (Array.isArray(route) ? route : []).filter((p: { lat: unknown; lon: unknown; fallback: unknown; synthetic: unknown }) => { const lat = Number(p?.lat), lon = Number(p?.lon); return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !p?.fallback && !p?.synthetic; }).map((p: { lat: unknown; lon: unknown; wayId: unknown }) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon), ...(p.wayId != null ? { wayId: String(p.wayId) } : {}) })); }
function cleanBinding(v: unknown) { if (!v || typeof v !== 'object')
    return null; const rec = v as Record<string, unknown>; const lat = Number(rec.lat ?? rec.snapLat), lon = Number(rec.lon ?? rec.snapLon); if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return null; const out: Record<string, unknown> = { ...rec }; if (out.wayId != null)
    out.wayId = String(out.wayId); if (out.trackRef != null)
    out.trackRef = String(out.trackRef); for (const k of ['lat', 'snapLat'])
    if (out[k] != null && Number.isFinite(Number(out[k])))
        out[k] = Number(out[k]); for (const k of ['lon', 'snapLon'])
    if (out[k] != null && Number.isFinite(Number(out[k])))
        out[k] = Number(out[k]); return out; }
function normalizeZone(data: WorkInput = {}, inherited: WorkInput = {}) {
    const rawImpact = workText(data.impact, workText(inherited.impact, 'stop'));
    const impact = ['stop', 'slow', 'power-off'].includes(rawImpact) ? rawImpact : 'stop';
    return {
        id: workText(data.id) || `work-zone-${nextWorksZoneId++}`,
        name: workText(data.name, workText(data.label)),
        startBinding: cleanBinding(data.startBinding),
        endBinding: cleanBinding(data.endBinding),
        constraints: Array.isArray(data.constraints) ? clone(data.constraints) : [],
        route: cleanRoute(data.route),
        segments: Array.isArray(data.segments) ? clone(data.segments) : [],
        distanceKm: Number.isFinite(Number(data.distanceKm)) ? Math.max(0, Number(data.distanceKm)) : 0,
        impact,
        speedLimit: impact === 'stop' ? 0 : (Number.isFinite(Number(data.speedLimit)) ? Number(data.speedLimit) : (Number.isFinite(Number(inherited.speedLimit)) ? Number(inherited.speedLimit) : 40)),
        // HOTFIX40 — section affects both directions unless the player explicitly restricts it.
        direction: normalizeSectionDirection(data.direction ?? inherited.direction),
        manual: !!data.manual,
        // HOTFIX42 — preserve the actual endpoint stations selected by the Works SC.
        // stationA/stationB remain populated for legacy UI/runtime compatibility.
        startStation: data.startStation && typeof data.startStation === 'object' ? clone(data.startStation) : null,
        endStation: data.endStation && typeof data.endStation === 'object' ? clone(data.endStation) : null,
        stationA: workText(data.stationA, workText(data.startStation?.name, workText(inherited.stationA))),
        stationB: workText(data.stationB, workText(data.endStation?.name, workText(inherited.stationB))),
        trackId: workText(data.trackId, workText(inherited.trackId)),
    };
}
type NormalizedZone = ReturnType<typeof normalizeZone>;
type CleanRoute = ReturnType<typeof cleanRoute>;
export class PlannedWorks {
    id: string; name: string; trackId: string; scope: 'station' | 'sections'; stationA: string; stationB: string; stationId: string; stationName: string;
    station: { name?: unknown; lat?: unknown; lon?: unknown } | null; affectsTraffic: boolean; route: CleanRoute | null; manualRoute: CleanRoute | null; startDate: string; startTime: string; endDate: string; endTime: string;
    impact: string; stationImpact: string; speedLimit: number; stationSpeedLimit: number; recurrence: string; daysOfWeek: number[]; zones: NormalizedZone[]; active: boolean;
    constructor(input: unknown = {}) {
        const data: WorkInput = input && typeof input === 'object' && !Array.isArray(input) ? input as WorkInput : {};
        this.id = workText(data.id) || `works-${nextWorksId++}`;
        this.name = workText(data.name, 'Travaux');
        this.trackId = workText(data.trackId);
        // HOTFIX46 — a work package may target one station only, without inventing
        // a fake rail section around it. Old saves remain section works by default.
        this.scope = data.scope === 'station' ? 'station' : 'sections';
        // Legacy fields stay readable so old saves and old UI records remain valid.
        this.stationA = workText(data.stationA);
        this.stationB = workText(data.stationB);
        this.stationId = workText(data.stationId, this.scope === 'station' ? workText(this.stationA, this.stationB) : '');
        this.stationName = workText(data.stationName);
        this.station = data.station && typeof data.station === 'object' && !Array.isArray(data.station) ? clone(data.station) as { name?: unknown; lat?: unknown; lon?: unknown } : null;
        if (this.scope === 'station' && this.stationId) {
            this.stationA = this.stationId;
            this.stationB = this.stationId;
        }
        // Global operational gate. When false, the work remains visible/informative
        // but MUST NOT create a speed restriction, closure or power-off restriction.
        this.affectsTraffic = data.affectsTraffic !== false;
        const route = cleanRoute(data.route), manual = cleanRoute(data.manualRoute);
        this.route = route.length >= 2 ? route : null;
        this.manualRoute = manual.length >= 2 ? manual : null;
        this.startDate = validDate(data.startDate) ? String(data.startDate) : '';
        this.startTime = validTime(data.startTime) ? String(data.startTime) : '22:00';
        this.endDate = validDate(data.endDate) ? String(data.endDate) : '';
        this.endTime = validTime(data.endTime) ? String(data.endTime) : '05:00';
        this.impact = ['stop', 'slow', 'power-off'].includes(String(data.impact || '')) ? String(data.impact) : 'stop';
        this.stationImpact = ['stop', 'slow', 'power-off'].includes(String(data.stationImpact || '')) ? String(data.stationImpact) : this.impact;
        const sl = Number(data.speedLimit);
        this.speedLimit = this.impact === 'stop' ? 0 : (Number.isFinite(sl) ? Math.max(1, Math.min(400, sl)) : 40);
        const ssl = Number(data.stationSpeedLimit);
        this.stationSpeedLimit = this.stationImpact === 'stop' ? 0 : (Number.isFinite(ssl) ? Math.max(1, Math.min(400, ssl)) : (this.stationImpact === 'slow' ? 40 : 0));
        this.recurrence = ['once', 'daily', 'weekly'].includes(String(data.recurrence || '')) ? String(data.recurrence) : 'daily';
        this.daysOfWeek = [...new Set((Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((x: __KPStruct528) => Number.isInteger(x) && x >= 0 && x <= 6))];
        // v1.1.64 — Travaux V2: one work package can contain several independent,
        // precise ORM zones. Each zone keeps the exact cursor bindings, VIA anchors,
        // resolved OSM geometry and its own operational impact.
        this.zones = Array.isArray(data.zones)
            ? data.zones.map((z: unknown) => normalizeZone((z && typeof z === 'object' ? z : {}) as WorkInput, this))
            : [];
        this.active = false;
    }
    _dayOfWeek(dateStr: unknown) {
        try {
            return new Date(dateStr + 'T12:00:00').getDay();
        }
        catch {
            return -1;
        }
    }
    isActiveAt(dateStr: unknown, timeOfDay: unknown) {
        const currentDate = String(dateStr || '');
        if (!this.startDate || !this.endDate || !validDate(currentDate))
            return false;
        const parseTime = (t: unknown) => {
            if (typeof t === 'number')
                return Number.isFinite(t) ? Math.max(0, Math.min(1439, t)) : 0;
            if (typeof t !== 'string' || !t.includes(':'))
                return 0;
            const [h, m] = t.split(':').map(Number);
            return Math.max(0, Math.min(1439, (Number(h) || 0) * 60 + (Number(m) || 0)));
        };
        const dayMs = 86400000;
        const dateMs = (d: unknown) => { const [y, m, day] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, day); };
        const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
        const startMinutes = parseTime(this.startTime), endMinutes = parseTime(this.endTime);
        const overnight = startMinutes > endMinutes;
        const rawMinute = Number(timeOfDay);
        if (!Number.isFinite(rawMinute))
            return false;
        const minute = Math.max(0, Math.min(1439, rawMinute));
        // Early-morning part of an overnight possession belongs to the occurrence
        // that started on the previous calendar day.
        const occurrenceDate = overnight && minute <= endMinutes ? fmtDate(dateMs(currentDate) - dayMs) : currentDate;
        const inClockWindow = overnight ? (minute >= startMinutes || minute <= endMinutes) : (minute >= startMinutes && minute <= endMinutes);
        if (!inClockWindow)
            return false;
        if (occurrenceDate < this.startDate || occurrenceDate > this.endDate)
            return false;
        if (this.recurrence === 'once')
            return occurrenceDate === this.startDate;
        if (this.recurrence === 'weekly' && !this.daysOfWeek.includes(this._dayOfWeek(occurrenceDate)))
            return false;
        return true;
    }
    getDateRange() {
        if (!this.startDate || !this.endDate)
            return '';
        const fmt = (d: __KPStruct529) => {
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
        };
        return `${fmt(this.startDate)} ${this.startTime} → ${fmt(this.endDate)} ${this.endTime}`;
    }
}
export class WorksManager {
    works: PlannedWorks[];
    revision: number;
    _appliedWorksSignature: string;
    constructor() {
        this.works = [];
        this.revision = 0;
        this._appliedWorksSignature = '';
    }
    add(data: unknown) {
        const w = new PlannedWorks(data);
        this.works.push(w);
        this.revision++;
        return w;
    }
    remove(id: unknown) {
        const before = this.works.length;
        this.works = this.works.filter((w: { id: unknown }) => w.id !== id);
        if (this.works.length !== before)
            this.revision++;
    }
    getAll() { return this.works; }
    _legacyZone(w: PlannedWorks) {
        const route = w.manualRoute || w.route || [];
        return normalizeZone({
            id: `${w.id}-legacy`,
            route,
            impact: w.impact,
            speedLimit: w.speedLimit,
            stationA: w.stationA,
            stationB: w.stationB,
            trackId: w.trackId,
            manual: !!w.manualRoute,
        }, w);
    }
    getZones(work: PlannedWorks) {
        if (!work || work.scope === 'station')
            return [];
        if (Array.isArray(work.zones) && work.zones.length)
            return work.zones;
        return [this._legacyZone(work)];
    }
    // HOTFIX46 — display items include informational works too. This is used by
    // the UI/banner/map, while getActiveRestrictions filters only the items that
    // are allowed to alter train circulation.
    getActiveDisplayItems(dateStr: unknown, timeOfDay: unknown) {
        const out = [];
        for (const w of this.works) {
            if (!w.isActiveAt(dateStr, timeOfDay))
                continue;
            if (w.scope === 'station') {
                const st = w.station && typeof w.station === 'object' ? w.station : null;
                out.push({
                    workId: w.id,
                    workName: w.name,
                    zoneId: `${w.id}-station`,
                    scope: 'station',
                    stationOnly: true,
                    stationId: w.stationId || w.stationA || '',
                    stationName: w.stationName || st?.name || '',
                    station: st,
                    stationLat: Number.isFinite(Number(st?.lat)) ? Number(st?.lat) : null,
                    stationLon: Number.isFinite(Number(st?.lon)) ? Number(st?.lon) : null,
                    affectsTraffic: w.affectsTraffic !== false,
                    impact: w.affectsTraffic === false ? 'none' : (w.stationImpact || w.impact || 'stop'),
                    speedLimit: w.affectsTraffic === false ? null : ((w.stationImpact || w.impact) === 'stop' ? 0 : (Number.isFinite(w.stationSpeedLimit) ? w.stationSpeedLimit : 40)),
                    direction: 'both',
                    route: [],
                    segments: [],
                    startBinding: null,
                    endBinding: null,
                    startStation: st,
                    endStation: st,
                    stationA: w.stationId || w.stationA || '',
                    stationB: w.stationId || w.stationB || w.stationA || '',
                    trackId: '',
                    manual: false,
                    sourceWork: w,
                    sourceZone: null,
                });
                continue;
            }
            for (const z of this.getZones(w)) {
                out.push({
                    workId: w.id,
                    workName: w.name,
                    zoneId: z.id,
                    scope: 'sections',
                    stationOnly: false,
                    stationId: '',
                    stationName: '',
                    station: null,
                    stationLat: null,
                    stationLon: null,
                    affectsTraffic: w.affectsTraffic !== false,
                    impact: w.affectsTraffic === false ? 'none' : (z.impact || w.impact || 'stop'),
                    speedLimit: w.affectsTraffic === false ? null : (z.impact === 'stop' ? 0 : (Number.isFinite(z.speedLimit) ? z.speedLimit : w.speedLimit)),
                    direction: normalizeSectionDirection(z.direction),
                    route: z.route || [],
                    segments: z.segments || [],
                    startBinding: z.startBinding || null,
                    endBinding: z.endBinding || null,
                    startStation: z.startStation || null,
                    endStation: z.endStation || null,
                    stationA: z.stationA || z.startStation?.id || z.startStation?.name || w.stationA || '',
                    stationB: z.stationB || z.endStation?.id || z.endStation?.name || w.stationB || '',
                    trackId: z.trackId || w.trackId || '',
                    manual: !!z.manual,
                    sourceWork: w,
                    sourceZone: z,
                });
            }
        }
        return out;
    }
    // Flatten active work packages into precise OPERATIONAL restrictions only.
    getActiveRestrictions(dateStr: unknown, timeOfDay: unknown) {
        return this.getActiveDisplayItems(dateStr, timeOfDay).filter((r) => r.affectsTraffic !== false && r.impact !== 'none');
    }
    // Legacy station-pair query remains for old Schedule Creator paths.
    getActiveClosuresBetween(stationA: unknown, stationB: unknown, dateStr: unknown, timeOfDay: unknown) {
        if (!stationA || !stationB || !dateStr || timeOfDay == null)
            return [];
        return this.works.filter((w) => {
            if (!w.isActiveAt(dateStr, timeOfDay) || w.affectsTraffic === false)
                return false;
            if (w.scope === 'station') {
                const sid = String(w.stationId || w.stationA || '');
                return sid && (sid === String(stationA) || sid === String(stationB));
            }
            return (w.stationA === stationA && w.stationB === stationB) ||
                (w.stationA === stationB && w.stationB === stationA);
        });
    }
    getActive(dateStr: unknown, timeOfDay: unknown) {
        return this.works.filter((w) => w.isActiveAt(dateStr, timeOfDay));
    }
    _routeBBox(route: Array<{ lat: number; lon: number }> | null | undefined) {
        if (!route?.length)
            return null;
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        for (const p of route) {
            if (!Number.isFinite(Number(p?.lat)) || !Number.isFinite(Number(p?.lon)))
                continue;
            minLat = Math.min(minLat, Number(p.lat));
            maxLat = Math.max(maxLat, Number(p.lat));
            minLon = Math.min(minLon, Number(p.lon));
            maxLon = Math.max(maxLon, Number(p.lon));
        }
        return Number.isFinite(minLat) ? { minLat, maxLat, minLon, maxLon } : null;
    }
    _bboxNear(a: { minLat: number; maxLat: number; minLon: number; maxLon: number; } | null, b: { minLat: number; maxLat: number; minLon: number; maxLon: number; } | null, bufferDeg: number = 0.0012) {
        if (!a || !b)
            return true;
        return !(a.maxLat + bufferDeg < b.minLat || b.maxLat + bufferDeg < a.minLat || a.maxLon + bufferDeg < b.minLon || b.maxLon + bufferDeg < a.minLon);
    }
    _minDistToPolyline(lat: number, lon: number, polyline: Array<{ lat: number; lon: number }> | null | undefined) {
        if (!polyline || polyline.length < 2)
            return Infinity;
        let d = Infinity;
        for (let i = 0; i < polyline.length - 1; i++) {
            d = Math.min(d, this._pointToSegmentDistKm(lat, lon, polyline[i].lat, polyline[i].lon, polyline[i + 1].lat, polyline[i + 1].lon));
        }
        return d;
    }
    _routeIntersectsPolyline(a: Array<{ lat: number; lon: number }> | null | undefined, b: Array<{ lat: number; lon: number }> | null | undefined, bufferKm: number = 0.06) {
        if (!a?.length || a.length < 2 || !b?.length || b.length < 2)
            return false;
        const stepA = Math.max(1, Math.floor(a.length / 80));
        const stepB = Math.max(1, Math.floor(b.length / 80));
        for (let i = 0; i < a.length; i += stepA)
            if (this._minDistToPolyline(a[i].lat, a[i].lon, b) <= bufferKm)
                return true;
        for (let i = 0; i < b.length; i += stepB)
            if (this._minDistToPolyline(b[i].lat, b[i].lon, a) <= bufferKm)
                return true;
        return false;
    }
    _applyRestrictionToTrack(track: { worksActive?: boolean; worksImpact?: string | null; worksSpeedLimit?: number | null }, r: { impact?: string; speedLimit?: number | null }) {
        const impact = r.impact || 'stop';
        const speed: number = impact === 'stop' ? 0 : (Number.isFinite(r.speedLimit) ? Number(r.speedLimit) : 40);
        if (!track.worksActive) {
            track.worksActive = true;
            track.worksImpact = impact;
            track.worksSpeedLimit = speed;
            return;
        }
        if (impact === 'stop') {
            track.worksImpact = 'stop';
            track.worksSpeedLimit = 0;
        }
        else if (track.worksImpact !== 'stop') {
            // power-off is operationally stricter than a pure speed restriction for
            // electric trains; keep it if already present, otherwise the lowest speed wins.
            if (impact === 'power-off') {
                track.worksImpact = 'power-off';
                track.worksSpeedLimit = 0;
            }
            else if (track.worksImpact !== 'power-off' && speed < (track.worksSpeedLimit || 999)) {
                track.worksImpact = 'slow';
                track.worksSpeedLimit = speed;
            }
        }
    }
    update(dateStr: string, timeOfDay: unknown, world: World) {
        if (!world)
            return false;
        const activeWorks = [];
        for (const w of this.works) {
            w.active = w.isActiveAt(dateStr, timeOfDay);
            if (w.active)
                activeWorks.push(w);
        }
        const restrictions = this.getActiveRestrictions(dateStr, timeOfDay);
        const signature = `${this.revision}|${world.tracks?.length || 0}|` + restrictions.map((r) => {
            const first = r.route?.[0], last = r.route?.at?.(-1);
            return `${r.workId}:${r.zoneId}:${r.scope || 'sections'}:${r.stationId || ''}:${r.impact}:${r.speedLimit ?? ''}:${r.direction || 'both'}:${r.route?.length || 0}:${first?.wayId || ''}:${last?.wayId || ''}:${first?.lat ?? ''},${first?.lon ?? ''}:${last?.lat ?? ''},${last?.lon ?? ''}`;
        }).join('|');
        if (signature === this._appliedWorksSignature)
            return false;
        this._appliedWorksSignature = signature;
        for (const track of world.tracks || []) {
            track.worksActive = false;
            track.worksImpact = null;
            track.worksSpeedLimit = null;
        }
        // v1.1.64 — apply precise ORM zones. World tracks are only a coarse visual/
        // legacy projection; runtime route checks use the exact zone geometry directly.
        for (const r of restrictions) {
            let applied = false;
            if (r.route?.length >= 2) {
                const rb = this._routeBBox(r.route);
                for (const track of world.tracks || []) {
                    if (!track.route?.length || track.route.length < 2)
                        continue;
                    if (!this._bboxNear(rb, this._routeBBox(track.route)))
                        continue;
                    if (!this._routeIntersectsPolyline(r.route, track.route, 0.06))
                        continue;
                    this._applyRestrictionToTrack(track, r);
                    applied = true;
                }
            }
            if (applied)
                continue;
            let track = (world.tracks || []).find((t: { id: unknown }) => t.id === r.trackId);
            if (!track && r.stationA && r.stationB) {
                track = (world.tracks || []).find((t: { stationA: unknown; stationB: unknown }) => (t.stationA === r.stationA && t.stationB === r.stationB) || (t.stationA === r.stationB && t.stationB === r.stationA));
            }
            if (track)
                this._applyRestrictionToTrack(track, r);
        }
        return true;
    }
    _pointToSegmentDistKm(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number) {
        const cosLat = Math.cos(pLat * Math.PI / 180);
        const dx = (bLon - aLon) * 111 * cosLat;
        const dy = (bLat - aLat) * 111;
        const px = (pLon - aLon) * 111 * cosLat;
        const py = (pLat - aLat) * 111;
        const segLenSq = dx * dx + dy * dy;
        if (segLenSq < 0.0001)
            return Math.sqrt(px * px + py * py);
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
        const projX = t * dx, projY = t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }
    toSave() {
        return this.works.map((w: { id: unknown; name: unknown; trackId: unknown; scope: unknown; affectsTraffic: unknown; stationId: unknown; stationName: unknown; station: unknown; stationA: unknown; stationB: unknown; route: unknown; manualRoute: unknown; zones: unknown; startDate: unknown; startTime: unknown; endDate: unknown; endTime: unknown; impact: unknown; speedLimit: unknown; stationImpact: unknown; stationSpeedLimit: unknown; recurrence: unknown; daysOfWeek: unknown }) => ({
            id: w.id, name: w.name, trackId: w.trackId,
            scope: w.scope, affectsTraffic: w.affectsTraffic,
            stationId: w.stationId, stationName: w.stationName, station: clone(w.station),
            stationA: w.stationA, stationB: w.stationB,
            route: w.route, manualRoute: w.manualRoute,
            zones: clone(w.zones),
            startDate: w.startDate, startTime: w.startTime,
            endDate: w.endDate, endTime: w.endTime,
            impact: w.impact, speedLimit: w.speedLimit,
            stationImpact: w.stationImpact, stationSpeedLimit: w.stationSpeedLimit,
            recurrence: w.recurrence, daysOfWeek: w.daysOfWeek,
        }));
    }
    loadFromSave(arr: unknown) {
        this.works = [];
        const seen = new Set();
        for (const d of Array.isArray(arr) ? arr : []) {
            if (!d || typeof d !== 'object')
                continue;
            const w = new PlannedWorks(d);
            if (!w.id || seen.has(w.id) || !w.startDate || !w.endDate || w.endDate < w.startDate)
                continue;
            if (Array.isArray(w.zones)) {
                const zoneIds = new Set();
                w.zones = w.zones.filter((z: { id: unknown; route: unknown }) => { if (!z?.id || zoneIds.has(z.id))
                    return false; zoneIds.add(z.id); return Array.isArray(z.route) && z.route.length >= 2; });
            }
            if (w.scope === 'station') {
                if (!w.stationId && !(w.stationA && w.stationB))
                    continue;
            }
            else {
                const zones = this.getZones(w).filter((z: { route: unknown }) => Array.isArray(z.route) && z.route.length >= 2);
                if (zones.length === 0 && !w.trackId && !(w.stationA && w.stationB))
                    continue;
            }
            seen.add(w.id);
            this.works.push(w);
            const num = parseInt(String(w.id).split('-')[1] || '0');
            if (num >= nextWorksId)
                nextWorksId = num + 1;
            for (const z of w.zones || []) {
                const zn = parseInt((() => { const parts = String(z.id || '').split('-'); return parts[parts.length - 1]; })() || '0');
                if (zn >= nextWorksZoneId)
                    nextWorksZoneId = zn + 1;
            }
        }
        this._appliedWorksSignature = '';
        this.revision++;
    }
}


// S3_STRUCT_V2_TEMP
type __S3Struct747 = { "isActiveAt": (...args: unknown[]) => unknown; "affectsTraffic": boolean; "scope": string; "stationId": string; "stationA": unknown; "stationB": unknown };
type __S3Struct748 = { "isActiveAt": (...args: unknown[]) => unknown };
