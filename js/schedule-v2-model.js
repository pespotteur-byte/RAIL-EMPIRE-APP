import { cloneEditableGraph, prepareEditableClone, LabelAllocator, incrementLabel, duplicatedTrainName } from './duplicate-tools.js';
import { railPointDistanceKm } from './rail-speed.js';
// Rail Empire — Schedule Creator V2 domain model.
// Deliberately independent from the legacy ScheduleCreator/ActiveService runtime.
// V2 rules are data-first: schedules describe WHAT/WHEN, rotations describe chaining,
// physical formations describe WITH WHAT, and the runtime executes occurrences.
export const SCHEDULE_V2_SCHEMA = 2;
export const SCHEDULE_V2_MIN_SCHEMA = 1;
export const ScheduleState = Object.freeze({
    DRAFT: 'DRAFT',
    VALID: 'VALID',
    NEEDS_REPAIR: 'NEEDS_REPAIR',
});
export const TrainCategory = Object.freeze({
    PASSENGER: 'PASSENGER',
    FREIGHT: 'FREIGHT',
    W: 'W', // matériel voyageurs vide
    HLP: 'HLP', // locomotive seule
    TM: 'TM', // train de machines
    INFRA: 'INFRA', // train d'infrastructure
    TTX: 'TTX', // train de travaux
});
export const StopCode = Object.freeze({
    NONE: 'NONE',
    C: 'C',
    S: 'S',
    OPTIONAL_C: 'OPTIONAL_C',
    OPTIONAL_S: 'OPTIONAL_S',
});
export const LocationKind = Object.freeze({
    STATION: 'STATION',
    TECHNICAL: 'TECHNICAL',
});
export const PathDirection = Object.freeze({
    OUTBOUND: 'OUTBOUND',
    RETURN: 'RETURN',
});
export const PerformanceMode = Object.freeze({
    REFERENCE_COMPOSITION: 'REFERENCE_COMPOSITION',
    LINE_MAX_SPEED: 'LINE_MAX_SPEED',
});
let _seq = 1;
export function makeV2Id(prefix = 'v2') {
    const cryptoObj = globalThis?.crypto;
    if (cryptoObj?.randomUUID)
        return `${prefix}-${cryptoObj.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${(_seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function deepClone(value) {
    if (value == null)
        return value;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        }
        catch { }
    }
    return JSON.parse(JSON.stringify(value));
}
function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function array(value) { return Array.isArray(value) ? value : []; }
function bool(value, fallback = false) { return value == null ? fallback : !!value; }
export function isPassengerCategory(category) {
    return category === TrainCategory.PASSENGER;
}
export function isOptionalStopCode(code) {
    return code === StopCode.OPTIONAL_C || code === StopCode.OPTIONAL_S;
}
export function formatScheduleClock(totalSec) {
    const raw = Math.max(0, Math.round(num(totalSec, 0)));
    const day = Math.floor(raw / 86400);
    const sec = raw % 86400;
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = sec % 60;
    // Preserve physical-second precision. Hiding non-zero seconds made a 16:19:37
    // departure look like 16:19 even though the runtime could only trigger later.
    return `${hh}:${mm}${ss ? `:${String(ss).padStart(2, '0')}` : ''}${day > 0 ? ` (+${day})` : ''}`;
}
export function parseScheduleClock(text, previousSec = 0, options = {}) {
    if (typeof text === 'number' && Number.isFinite(text))
        return Math.max(0, Math.round(text));
    let s = String(text || '').trim();
    // Accept both the canonical UI form `00:15 (+1)` and the documented shorthand
    // `J+1 00:15`. Both are normalized to one parser so frequency/stop dialogs agree.
    const j = s.match(/^J\+(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/i);
    if (j)
        s = `${j[2]} (+${j[1]})`;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*\(\+(\d+)\))?$/);
    if (!m)
        return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] == null ? 0 : Number(m[3]);
    if (hh > 23 || mm > 59 || ss > 59)
        return null;
    const explicitDay = m[4] != null;
    const inferRollover = options?.inferRollover !== false;
    const defaultDay = Number.isFinite(Number(options?.defaultDay)) ? Math.max(0, Math.floor(Number(options.defaultDay))) : Math.floor(Math.max(0, previousSec) / 86400);
    let day = explicitDay ? Number(m[4]) : defaultDay;
    let result = day * 86400 + hh * 3600 + mm * 60 + ss;
    // Only downstream stops infer a midnight rollover. The FIRST departure must
    // never become J+1 merely because its newly-entered clock is lower than the
    // previous value stored in the field. Users can still request J+n explicitly
    // with the visible "(+N)" suffix.
    if (!explicitDay && inferRollover) {
        while (result < previousSec)
            result += 86400;
    }
    return result;
}
export class OperatingCalendar {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('cal');
        this.name = data.name || 'Calendrier';
        this.startDate = data.startDate || '1900-01-01';
        this.endDate = data.endDate || '2999-12-31';
        this.weekdays = array(data.weekdays).length ? [...new Set(data.weekdays.map(Number))] : [0, 1, 2, 3, 4, 5, 6];
        this.excludedDates = [...new Set(array(data.excludedDates).map(String))];
        this.enabled = data.enabled !== false;
    }
    matchesDate(dateStr) {
        if (!this.enabled || !dateStr)
            return false;
        if (dateStr < this.startDate || dateStr > this.endDate)
            return false;
        if (this.excludedDates.includes(dateStr))
            return false;
        const d = new Date(`${dateStr}T12:00:00Z`);
        if (Number.isNaN(d.getTime()))
            return false;
        return this.weekdays.includes(d.getUTCDay());
    }
    toJSON() { return deepClone(this); }
}
export class TrackBinding {
    constructor(data = {}) {
        this.voiePointId = data.voiePointId == null ? '' : String(data.voiePointId);
        this.wayId = data.wayId != null ? String(data.wayId) : '';
        this.trackRef = data.trackRef || '';
        this.displayName = data.displayName || ''; // mandatory player-facing Livemap name
        this.lat = data.lat == null ? null : num(data.lat, null);
        this.lon = data.lon == null ? null : num(data.lon, null);
        this.snapLat = data.snapLat == null ? this.lat : num(data.snapLat, null);
        this.snapLon = data.snapLon == null ? this.lon : num(data.snapLon, null);
        this.segmentIndex = data.segmentIndex == null ? (data.osmSnapshot?.segmentIndex ?? null) : num(data.segmentIndex, null);
        // Snapshot lets validated services continue when ORM/Overpass is temporarily unavailable.
        this.osmSnapshot = data.osmSnapshot ? deepClone(data.osmSnapshot) : null;
    }
    get complete() { return Number.isFinite(this.lat) && Number.isFinite(this.lon) && !!this.displayName.trim(); }
    toJSON() { return deepClone(this); }
}
export class RouteConstraint {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('via');
        this.order = num(data.order, 0);
        this.lat = data.lat == null ? null : num(data.lat, null);
        this.lon = data.lon == null ? null : num(data.lon, null);
        this.wayId = data.wayId != null ? String(data.wayId) : '';
        this.snapLat = data.snapLat == null ? this.lat : num(data.snapLat, null);
        this.snapLon = data.snapLon == null ? this.lon : num(data.snapLon, null);
        this.trackRef = data.trackRef || '';
        this.segmentIndex = data.segmentIndex == null ? (data.osmSnapshot?.segmentIndex ?? null) : num(data.segmentIndex, null);
        this.osmSnapshot = data.osmSnapshot ? deepClone(data.osmSnapshot) : null;
        this.legIndex = Math.max(0, num(data.legIndex, 0));
    }
    toJSON() { return deepClone(this); }
}
export class RouteSegmentSnapshot {
    constructor(data = {}) {
        this.wayId = data.wayId != null ? String(data.wayId) : '';
        this.from = data.from ? { lat: num(data.from.lat), lon: num(data.from.lon) } : null;
        this.to = data.to ? { lat: num(data.to.lat), lon: num(data.to.lon) } : null;
        this.distanceKm = num(data.distanceKm, 0);
        this.maxSpeed = num(data.maxSpeed, 30);
        this.maxSpeedSource = data.maxSpeedSource || 'OSM';
        this.maxSpeedForward = data.maxSpeedForward != null ? num(data.maxSpeedForward, null) : null;
        this.maxSpeedBackward = data.maxSpeedBackward != null ? num(data.maxSpeedBackward, null) : null;
        this.electrified = data.electrified ?? null;
        this.electrifiedMode = data.electrifiedMode || '';
        this.voltage = array(data.voltage).map(Number).filter(Number.isFinite);
        this.frequency = array(data.frequency).map(Number).filter(Number.isFinite);
        this.gauge = array(data.gauge).map(Number).filter(Number.isFinite);
        this.loadingGauge = data.loadingGauge || '';
        this.axleLoad = data.axleLoad == null ? null : num(data.axleLoad, null);
        this.metreLoad = data.metreLoad == null ? null : num(data.metreLoad, null);
        this.tracks = Math.max(1, num(data.tracks, 1));
        this.trafficMode = data.trafficMode || '';
        this.trainProtection = data.trainProtection ? deepClone(data.trainProtection) : {};
        this.usage = data.usage || '';
        this.service = data.service || '';
        this.railway = data.railway || 'rail';
        this.railwayLifecycle = data.railwayLifecycle || 'present';
        this.railwayBaseType = data.railwayBaseType || this.railway || 'rail';
        this.preferredDirection = data.preferredDirection || '';
        this.bidirectional = data.bidirectional || '';
        this.oneway = data.oneway || '';
        this._againstPreferredDirection = !!data._againstPreferredDirection;
        this.trackRef = data.trackRef || '';
        this.name = data.name || '';
        this.ref = data.ref || '';
        this.tags = data.tags ? deepClone(data.tags) : {};
        this.fallback = !!data.fallback;
    }
    toJSON() { return deepClone(this); }
}
function compactGlobalPathSegment(s = {}) {
    return {
        // The global view is also used for operational validation, not only for
        // drawing. Preserve every physical restriction below the sharing threshold.
        ...s,
        wayId: s?.wayId != null ? String(s.wayId) : '',
        from: s?.from ? { lat: num(s.from.lat), lon: num(s.from.lon) } : null,
        to: s?.to ? { lat: num(s.to.lat), lon: num(s.to.lon) } : null,
        distanceKm: num(s?.distanceKm, 0),
        maxSpeed: num(s?.maxSpeed, 30), maxSpeedSource: s?.maxSpeedSource || 'OSM',
        _againstPreferredDirection: !!s?._againstPreferredDirection, fallback: !!s?.fallback,
    };
}
function schedulePointDistanceKm(a, b) {
    if (!a || !b || ![a.lat, a.lon, b.lat, b.lon].every(x => Number.isFinite(Number(x))))
        return NaN;
    const R = 6371, dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(Number(a.lat) * Math.PI / 180) * Math.cos(Number(b.lat) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// HOTFIX8 OPERA-FRIENDLY — canonical route points already contain every railway
// attribute needed to rebuild RouteSegmentSnapshot. New saves therefore omit the
// per-leg segment array (which otherwise duplicates most route metadata) and
// recreate it on load. Legacy saves with explicit segments remain supported.
function documentedScheduleSpeedMeta(p) {
    const speed = Number(p?.maxSpeed), source = String(p?.maxSpeedSource || '');
    if (Number.isFinite(speed) && speed > 0 && source !== 'FALLBACK_30')
        return { speed, source: source || 'OSM' };
    return null;
}
function derivedSegmentSpeedMeta(a, b) {
    const bm = documentedScheduleSpeedMeta(b), am = documentedScheduleSpeedMeta(a);
    if (bm)
        return bm;
    const aw = String(a?.wayId || ''), bw = String(b?.wayId || '');
    if (am && (!aw || !bw || aw === bw))
        return am;
    return { speed: Number(b?.maxSpeed ?? a?.maxSpeed ?? 30) || 30, source: 'FALLBACK_30' };
}
function normalizeSavedSameWaySpeeds(points) {
    const pts = Array.isArray(points) ? points : [];
    let changed = false;
    const original = pts.map(p => documentedScheduleSpeedMeta(p));
    for (const [i, j] of [[0, 1], [pts.length - 1, pts.length - 2]]) {
        if (i < 0 || j < 0 || i >= pts.length || j >= pts.length || original[i] || !original[j])
            continue;
        if (!String(pts[i]?.wayId || '') || String(pts[i].wayId) !== String(pts[j].wayId))
            continue;
        if (railPointDistanceKm(pts[i], pts[j]) > 1)
            continue;
        pts[i].maxSpeed = original[j].speed;
        pts[i].maxSpeedSource = original[j].source;
        changed = true;
    }
    return changed;
}
function deriveRouteSegmentsFromPoints(points = []) {
    const pts = Array.isArray(points) ? points : [];
    const out = [];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1] || {}, b = pts[i] || {};
        const d = schedulePointDistanceKm(a, b);
        out.push(new RouteSegmentSnapshot({
            wayId: b.wayId ?? a.wayId ?? '',
            from: a, to: b, distanceKm: Number.isFinite(d) ? d : 0,
            maxSpeed: derivedSegmentSpeedMeta(a, b).speed,
            maxSpeedSource: derivedSegmentSpeedMeta(a, b).source,
            maxSpeedForward: b.maxSpeedForward ?? a.maxSpeedForward ?? null,
            maxSpeedBackward: b.maxSpeedBackward ?? a.maxSpeedBackward ?? null,
            electrified: b.electrified ?? a.electrified ?? null,
            electrifiedMode: b.electrifiedMode || a.electrifiedMode || '',
            voltage: b.voltage || a.voltage || [], frequency: b.frequency || a.frequency || [], gauge: b.gauge || a.gauge || [],
            loadingGauge: b.loadingGauge || a.loadingGauge || '', axleLoad: b.axleLoad ?? a.axleLoad ?? null, metreLoad: b.metreLoad ?? a.metreLoad ?? null, tracks: b.tracks || a.tracks || 1,
            trafficMode: b.trafficMode || a.trafficMode || '', trainProtection: b.trainProtection || a.trainProtection || {},
            usage: b.usage || a.usage || '', service: b.service || a.service || '', railway: b.railway || a.railway || 'rail',
            railwayLifecycle: b.railwayLifecycle || a.railwayLifecycle || 'present', railwayBaseType: b.railwayBaseType || a.railwayBaseType || b.railway || a.railway || 'rail',
            preferredDirection: b.preferredDirection || a.preferredDirection || '', bidirectional: b.bidirectional || a.bidirectional || '', oneway: b.oneway || a.oneway || '',
            trackRef: b.trackRef || a.trackRef || '', name: b.name || a.name || '', ref: b.ref || a.ref || '',
            tags: ((b?.tags?.incline ?? a?.tags?.incline) != null && (b?.tags?.incline ?? a?.tags?.incline) !== '') ? { incline: (b?.tags?.incline ?? a?.tags?.incline) } : {},
            fallback: !!(a.fallback || b.fallback), _againstPreferredDirection: !!b._againstPreferredDirection,
        }));
    }
    return out;
}
const PACKED_ROUTE_POINT_THRESHOLD = 4000;
// HOTFIX8 SC8P1 — column/delta route encoding for long Schedule V2 saves.
// Coordinates and repeated railway metadata are stored once in compact columns,
// drastically reducing both JSON size and the object graph cloned into the save
// worker. This is a persistence format only: runtime still receives normal route
// point objects after load.
function packScheduleRoutePoints(points = []) {
    const pts = Array.isArray(points) ? points : [];
    if (!pts.length)
        return null;
    const scale = 1e6, coords = [], wayDict = [], wayMap = new Map(), wayIndex = [], segmentIndex = [], metaDict = [], metaMap = new Map(), metaIndex = [];
    let prevLat = 0, prevLon = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i] || {}, lat = Math.round(num(p.lat, 0) * scale), lon = Math.round(num(p.lon, 0) * scale);
        if (i === 0)
            coords.push(lat, lon);
        else
            coords.push(lat - prevLat, lon - prevLon);
        prevLat = lat;
        prevLon = lon;
        const way = p.wayId != null ? String(p.wayId) : '';
        let wi = wayMap.get(way);
        if (wi === undefined) {
            wi = wayDict.length;
            wayMap.set(way, wi);
            wayDict.push(way);
        }
        wayIndex.push(wi);
        segmentIndex.push(Number.isFinite(Number(p.segmentIndex)) ? Number(p.segmentIndex) : -1);
        const meta = {};
        for (const [k, v] of Object.entries(p)) {
            if (k === 'lat' || k === 'lon' || k === 'wayId' || k === 'segmentIndex')
                continue;
            meta[k] = v;
        }
        const mk = JSON.stringify(meta);
        let mi = metaMap.get(mk);
        if (mi === undefined) {
            mi = metaDict.length;
            metaMap.set(mk, mi);
            metaDict.push(deepClone(meta));
        }
        metaIndex.push(mi);
    }
    return { format: 'SC8P1', scale, count: pts.length, coords, wayDict, wayIndex, segmentIndex, metaDict, metaIndex };
}
function unpackScheduleRoutePoints(packed) {
    if (!packed || packed.format !== 'SC8P1')
        return [];
    const count = Math.max(0, Math.floor(num(packed.count, 0))), scale = Math.max(1, num(packed.scale, 1e6));
    const coords = array(packed.coords), wayDict = array(packed.wayDict), wayIndex = array(packed.wayIndex), segmentIndex = array(packed.segmentIndex), metaDict = array(packed.metaDict), metaIndex = array(packed.metaIndex);
    const out = new Array(count);
    let lat = 0, lon = 0;
    for (let i = 0; i < count; i++) {
        if (i === 0) {
            lat = num(coords[0], 0);
            lon = num(coords[1], 0);
        }
        else {
            lat += num(coords[i * 2], 0);
            lon += num(coords[i * 2 + 1], 0);
        }
        const meta = metaDict[Math.max(0, Math.floor(num(metaIndex[i], 0)))] || {};
        const si = num(segmentIndex[i], -1);
        out[i] = { ...deepClone(meta), lat: lat / scale, lon: lon / scale, wayId: String(wayDict[Math.max(0, Math.floor(num(wayIndex[i], 0)))] ?? ''), segmentIndex: si >= 0 ? si : null };
    }
    return out;
}
export function assignResolvedLegsToPath(path, legs, { validatedAt = null, resolvedRevision = null, error = '' } = {}) {
    if (!path)
        throw new Error('SchedulePath manquant.');
    const input = Array.isArray(legs) ? legs : [];
    const list = [], routePoints = [], segments = [];
    const totalCanonicalPoints = input.reduce((n, l) => n + Math.max(0, (l?.routePoints?.length || 0) - (n ? 1 : 0)), 0);
    // HOTFIX8 — on continental routes the global path is a derived view over the
    // canonical legs. Sharing point/segment objects avoids retaining a second full
    // 1500 km object graph exactly when the physics/timing pass starts.
    const shareGlobalGeometry = totalCanonicalPoints > 12000;
    let distanceKm = 0;
    for (const sourceLeg of input) {
        if (!Array.isArray(sourceLeg?.routePoints) || sourceLeg.routePoints.length < 2)
            throw new Error('Liaison ORM vide pendant assemblage du trajet.');
        // HOTFIX6 — source legs are fresh transient snapshots from the router (or
        // already-canonical cached legs). Reuse their compact point array instead of
        // allocating a third full copy during path assembly. The global path keeps
        // its independent copy below for integrity checks/serialization.
        const legPoints = sourceLeg.routePoints;
        const sourceSegments = Array.isArray(sourceLeg.segments) ? sourceLeg.segments : [];
        if (sourceSegments.length !== legPoints.length - 1)
            throw new Error('Liaison ORM incohérente : nombre de segments différent de la géométrie.');
        const legSegments = [];
        let legDistanceKm = 0;
        for (let i = 0; i < sourceSegments.length; i++) {
            const d = schedulePointDistanceKm(legPoints[i], legPoints[i + 1]);
            if (!Number.isFinite(d))
                throw new Error('Liaison ORM incohérente : coordonnées invalides.');
            const seg = sourceSegments[i] instanceof RouteSegmentSnapshot ? sourceSegments[i] : new RouteSegmentSnapshot(sourceSegments[i]);
            seg.from = { lat: Number(legPoints[i].lat), lon: Number(legPoints[i].lon) };
            seg.to = { lat: Number(legPoints[i + 1].lat), lon: Number(legPoints[i + 1].lon) };
            seg.distanceKm = d;
            legDistanceKm += d;
            legSegments.push(seg);
        }
        const leg = { ...sourceLeg, routePoints: legPoints, segments: legSegments, distanceKm: legDistanceKm };
        list.push(leg);
        for (let i = 0; i < legPoints.length; i++) {
            if (routePoints.length && i === 0)
                continue;
            routePoints.push(shareGlobalGeometry ? legPoints[i] : { ...legPoints[i] });
        }
        // Keep the same physical metadata at every geometry size. Long routes
        // share immutable snapshots; smaller routes keep lightweight shell copies.
        // RC4: no argument spreading for continental geometries (engine call-argument limit).
        for (const segment of legSegments)
            segments.push(shareGlobalGeometry ? segment : compactGlobalPathSegment(segment));
        distanceKm += legDistanceKm;
    }
    path.legs = list;
    path.globalGeometryShared = shareGlobalGeometry;
    path.routePoints = routePoints;
    path.segments = segments;
    path.distanceKm = distanceKm;
    path.error = String(error || '');
    if (validatedAt !== null)
        path.validatedAt = validatedAt || '';
    if (resolvedRevision !== null)
        path.resolvedRevision = Math.max(0, Number(resolvedRevision || 0));
    return path;
}
export class SchedulePath {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('path');
        this.direction = data.direction || PathDirection.OUTBOUND;
        this.constraints = array(data.constraints).map(c => new RouteConstraint(c));
        this.legs = array(data.legs).map(l => {
            const legPoints = array(l.routePoints).length ? array(l.routePoints).map(p => ({ ...p })) : unpackScheduleRoutePoints(l.routePacked);
            const speedMetadataRepaired = normalizeSavedSameWaySpeeds(legPoints);
            return {
                id: l.id || makeV2Id('leg'), fromLocationId: l.fromLocationId || '', toLocationId: l.toLocationId || '',
                constraintIds: array(l.constraintIds).map(String), routeInputKey: String(l.routeInputKey || ''), physicsRouteKey: String(l.physicsRouteKey || ''),
                physicalTravelSec: !speedMetadataRepaired && l.physicalTravelSec != null && Number.isFinite(Number(l.physicalTravelSec)) ? Number(l.physicalTravelSec) : null,
                physicalTravelSignature: speedMetadataRepaired ? '' : String(l.physicalTravelSignature || ''),
                routePoints: legPoints,
                segments: array(l.segments).length ? array(l.segments).map(s => new RouteSegmentSnapshot(s)) : deriveRouteSegmentsFromPoints(legPoints), distanceKm: num(l.distanceKm, 0),
            };
        });
        // HOTFIX8 compact save format stores canonical geometry once, on legs. Rebuild
        // the global integrity/drawing view on load. Legacy saves with explicit global
        // arrays remain fully supported.
        const explicitPoints = array(data.routePoints);
        const canonicalPointCount = this.legs.reduce((n, l) => n + Math.max(0, (l.routePoints?.length || 0) - (n ? 1 : 0)), 0);
        this.globalGeometryShared = !explicitPoints.length && canonicalPointCount > 12000;
        if (explicitPoints.length)
            this.routePoints = explicitPoints.map(p => ({ ...p }));
        else {
            this.routePoints = [];
            for (const leg of this.legs)
                for (let i = 0; i < leg.routePoints.length; i++) {
                    if (this.routePoints.length && i === 0)
                        continue;
                    this.routePoints.push(this.globalGeometryShared ? leg.routePoints[i] : { ...leg.routePoints[i] });
                }
        }
        const explicitSegments = array(data.segments);
        const canonicalSegments = this.legs.flatMap(l => l.segments || []);
        if (explicitSegments.length) {
            // Older saves stored a lossy global segment view. Recover missing physical
            // attributes from canonical legs only when the geometry demonstrably matches.
            const legPoints = [];
            for (const leg of this.legs)
                for (let i = 0; i < leg.routePoints.length; i++) {
                    if (legPoints.length && i === 0)
                        continue;
                    legPoints.push(leg.routePoints[i]);
                }
            const aligned = canonicalSegments.length === explicitSegments.length &&
                legPoints.length === this.routePoints.length && legPoints.every((p, i) => Number(p.lat) === Number(this.routePoints[i]?.lat) && Number(p.lon) === Number(this.routePoints[i]?.lon));
            this.segments = explicitSegments.map((seg, i) => compactGlobalPathSegment(aligned ? { ...canonicalSegments[i], ...seg } : seg));
        }
        else
            this.segments = this.globalGeometryShared ? canonicalSegments : canonicalSegments.map(compactGlobalPathSegment);
        this.distanceKm = num(data.distanceKm, this.legs.reduce((sum, l) => sum + num(l.distanceKm, 0), 0));
        this.validatedAt = data.validatedAt || '';
        this.ormRevision = data.ormRevision || '';
        // topologyRevision changes whenever stations/tracks/VIA change. resolvedRevision
        // changes only after a successful real ORM recomputation. A stale preserved route
        // can therefore never become VALID merely because the network is still offline.
        this.topologyRevision = Math.max(0, num(data.topologyRevision, 0));
        this.resolvedRevision = Math.max(0, num(data.resolvedRevision, this.topologyRevision));
        this.offlineUsable = data.offlineUsable !== false;
        this.error = data.error || '';
    }
    clearResolvedRoute() {
        this.routePoints = [];
        this.segments = [];
        this.legs = [];
        this.globalGeometryShared = false;
        this.distanceKm = 0;
        this.validatedAt = '';
        this.error = '';
        this.resolvedRevision = Math.min(this.resolvedRevision, Math.max(0, this.topologyRevision - 1));
    }
    toJSON() {
        // HOTFIX8 — do not serialize the same 1500 km geometry twice (global path +
        // canonical legs). Legs are authoritative; constructor rebuilds global arrays.
        const hasCanonicalLegs = this.legs.length > 0 && this.legs.every((l) => Array.isArray(l.routePoints) && l.routePoints.length >= 2);
        const legs = this.legs.map((l) => {
            const pts = l.routePoints || [], usePacked = pts.length >= PACKED_ROUTE_POINT_THRESHOLD;
            return {
                id: l.id, fromLocationId: l.fromLocationId, toLocationId: l.toLocationId, constraintIds: [...(l.constraintIds || [])],
                routeInputKey: String(l.routeInputKey || ''), physicsRouteKey: String(l.physicsRouteKey || ''),
                physicalTravelSec: l.physicalTravelSec != null && Number.isFinite(Number(l.physicalTravelSec)) ? Number(l.physicalTravelSec) : null,
                physicalTravelSignature: String(l.physicalTravelSignature || ''),
                routePoints: usePacked ? [] : pts.map((p) => deepClone(p)), routePacked: usePacked ? packScheduleRoutePoints(pts) : null, routePointStorage: usePacked ? 'SC8P1' : 'OBJECTS',
                segments: [], distanceKm: num(l.distanceKm, 0), segmentStorage: 'DERIVED_FROM_POINTS',
            };
        });
        return {
            id: this.id, direction: this.direction, constraints: this.constraints.map((c) => c.toJSON()),
            routePoints: hasCanonicalLegs ? [] : this.routePoints.map((p) => deepClone(p)),
            segments: hasCanonicalLegs ? [] : this.segments.map(compactGlobalPathSegment),
            legs, distanceKm: num(this.distanceKm, 0), validatedAt: this.validatedAt, ormRevision: this.ormRevision,
            topologyRevision: this.topologyRevision, resolvedRevision: this.resolvedRevision, offlineUsable: this.offlineUsable, error: this.error,
            geometryStorage: hasCanonicalLegs ? 'LEGS_CANONICAL' : 'GLOBAL_LEGACY', globalGeometryShared: !!this.globalGeometryShared,
        };
    }
}
export class ScheduledLocation {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('loc'); // occurrence id — always unique, even same station twice
        this.kind = data.kind || LocationKind.STATION;
        this.order = num(data.order, 0);
        this.stationId = data.stationId || '';
        this.technicalLocationId = data.technicalLocationId || '';
        this.name = data.name || '';
        this.track = new TrackBinding(data.track || {});
        this.computedArrivalSec = data.computedArrivalSec == null ? null : num(data.computedArrivalSec, 0);
        this.computedDepartureSec = data.computedDepartureSec == null ? null : num(data.computedDepartureSec, 0);
        this.arrivalSec = data.arrivalSec == null ? null : num(data.arrivalSec, 0);
        this.departureSec = data.departureSec == null ? null : num(data.departureSec, 0);
        this.arrivalOverride = !!data.arrivalOverride;
        this.departureOverride = !!data.departureOverride;
        this.dwellSec = Math.max(0, num(data.dwellSec, 300)); // 5 min default; player may lower it explicitly
        this.stopCode = data.stopCode || StopCode.NONE;
        this.turnBack = !!data.turnBack;
        this.notes = data.notes || '';
    }
    setComputedTimes(arrivalSec, departureSec) {
        this.computedArrivalSec = arrivalSec == null ? null : Math.round(arrivalSec);
        this.computedDepartureSec = departureSec == null ? null : Math.round(departureSec);
        if (!this.arrivalOverride)
            this.arrivalSec = this.computedArrivalSec;
        if (!this.departureOverride)
            this.departureSec = this.computedDepartureSec;
    }
    applyManualArrival(sec) {
        this.arrivalOverride = true;
        this.arrivalSec = Math.max(0, Math.round(sec));
    }
    applyManualDeparture(sec) {
        this.departureOverride = true;
        this.departureSec = Math.max(0, Math.round(sec));
    }
    clearManualArrival() {
        this.arrivalOverride = false;
        this.arrivalSec = this.computedArrivalSec;
    }
    clearManualDeparture() {
        this.departureOverride = false;
        this.departureSec = this.computedDepartureSec;
    }
    toJSON() {
        const out = deepClone(this);
        out.track = this.track.toJSON();
        return out;
    }
}
export class TechnicalLocation {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('tech');
        this.name = data.name || 'Point technique';
        this.track = new TrackBinding(data.track || {});
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() { const o = deepClone(this); o.track = this.track.toJSON(); return o; }
}
export class PerformanceProfile {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('perf');
        this.mode = data.mode || PerformanceMode.LINE_MAX_SPEED;
        this.name = data.name || 'Profil de marche';
        this.referenceRameId = data.referenceRameId || '';
        this.referenceComposition = array(data.referenceComposition).map((x) => ({ ...x }));
        this.category = data.category || TrainCategory.PASSENGER;
        this.maxSpeed = Math.max(1, num(data.maxSpeed, 160));
        this.massKg = Math.max(1000, num(data.massKg, 200000));
        this.powerW = Math.max(0, num(data.powerW, 3000000));
        this.electricPowerW = Math.max(0, num(data.electricPowerW, 0));
        this.dieselPowerW = Math.max(0, num(data.dieselPowerW, 0));
        this.lengthM = Math.max(1, num(data.lengthM, 200));
        this.adhesionMassKg = Math.max(0, num(data.adhesionMassKg, this.massKg));
        this.brakeServiceMs2 = Math.max(0.1, num(data.brakeServiceMs2, 0.9));
        const freightLike = [TrainCategory.FREIGHT, TrainCategory.INFRA, TrainCategory.TTX, TrainCategory.TM].includes(this.category);
        this.brakeBuildSec = Math.max(0.5, num(data.brakeBuildSec, freightLike
            ? Math.max(2.5, Math.min(7, 2.2 + this.lengthM / 170))
            : Math.max(1, Math.min(2.5, 0.8 + this.lengthM / 300))));
        this.traction = data.traction || '';
        this.electricSystems = array(data.electricSystems).map((s) => ({ voltage: num(s.voltage, 0), frequency: num(s.frequency, 0) }));
        this.gauges = array(data.gauges).map(Number).filter(Number.isFinite);
        // Optional physical-envelope constraints. Unknown stays unknown: routing must
        // never invent a gabarit/axle/metre-load restriction for incomplete catalog data.
        this.loadingGauge = String(data.loadingGauge || '').trim();
        this.axleLoad = data.axleLoad == null ? null : Math.max(0, num(data.axleLoad, null));
        this.metreLoad = data.metreLoad == null ? null : Math.max(0, num(data.metreLoad, null));
        this.source = data.source || 'PLAYER';
    }
    // Existing Rame objects are accepted as a *reference composition only*.
    static fromLegacyRame(rame, category = TrainCategory.PASSENGER) {
        if (!rame)
            return PerformanceProfile.genericForCategory(category, 160);
        const maxSpeed = Math.max(1, num(rame.maxSpeed, 160));
        // Never invent a hidden 70% payload. Use the explicit live load ratio when the
        // Rame object provides one; otherwise the reference composition is timed at its
        // declared mass and the runtime may add real load later.
        const loadRatioCandidates = [rame.currentLoadRatio, rame.loadRatio, rame.payloadRatio].map(Number).filter(Number.isFinite);
        const loadRatio = loadRatioCandidates.length ? Math.max(0, Math.min(1, loadRatioCandidates[0])) : 0;
        const declaredMassT = num(rame.totalMass || rame.totalTonnage, 200);
        const massT = Math.max(1, loadRatio > 0 ? num(rame.getTotalMassWithPayload?.(loadRatio), declaredMassT) : declaredMassT);
        const powerKw = Math.max(0, num(rame.totalPower, 0));
        const details = array(rame.elementDetails);
        const poweredMassT = details
            .filter(e => (e.category === 'locomotive' || e.category === 'automotrice') && num(e.power, 0) > 0)
            .reduce((sum, e) => sum + Math.max(0, num(e.mass, e.tonnage || 0)), 0);
        const systems = [];
        const gauges = [];
        let brakeWeighted = 0, brakeMass = 0;
        const loadingGauges = [];
        const axleLoads = [];
        const metreLoads = [];
        if (Array.isArray(rame.electricSystems))
            systems.push(...rame.electricSystems);
        if (Array.isArray(rame.gauges))
            gauges.push(...rame.gauges);
        else if (Number.isFinite(Number(rame.gauge)))
            gauges.push(Number(rame.gauge));
        if (rame.loadingGauge)
            loadingGauges.push(String(rame.loadingGauge));
        if (Number.isFinite(Number(rame.axleLoad)))
            axleLoads.push(Number(rame.axleLoad));
        if (Number.isFinite(Number(rame.metreLoad)))
            metreLoads.push(Number(rame.metreLoad));
        for (const e of details) {
            if (Array.isArray(e.electricSystems))
                systems.push(...e.electricSystems);
            if (Array.isArray(e.gauges))
                gauges.push(...e.gauges);
            else if (Number.isFinite(Number(e.gauge)))
                gauges.push(Number(e.gauge));
            if (e.loadingGauge)
                loadingGauges.push(String(e.loadingGauge));
            if (Number.isFinite(Number(e.axleLoad)))
                axleLoads.push(Number(e.axleLoad));
            if (Number.isFinite(Number(e.metreLoad)))
                metreLoads.push(Number(e.metreLoad));
            const em = Math.max(1, num(e.mass, e.tonnage || 0)) * 1000, eb = Number(e.brakeServiceMs2);
            if (Number.isFinite(eb) && eb > 0) {
                brakeWeighted += eb * em;
                brakeMass += em;
            }
        }
        const uniqueSystems = [];
        const seenSystems = new Set();
        for (const x of systems) {
            const v = num(x?.voltage, 0), f = num(x?.frequency, 0), k = `${v}/${f}`;
            if (v > 0 && !seenSystems.has(k)) {
                seenSystems.add(k);
                uniqueSystems.push({ voltage: v, frequency: f });
            }
        }
        const uniqueGauges = [...new Set(gauges.map(Number).filter(Number.isFinite))];
        // Do not use total consist mass as adhesive mass. For legacy data with no
        // powered-vehicle mass, use a conservative traction-unit fallback.
        const adhesionMassKg = Math.max(1000, (poweredMassT > 0 ? poweredMassT : Math.min(massT, 100)) * 1000);
        return new PerformanceProfile({
            mode: PerformanceMode.REFERENCE_COMPOSITION,
            name: rame.name || 'Composition type',
            referenceRameId: rame.id || '',
            category,
            maxSpeed,
            massKg: massT * 1000,
            powerW: powerKw * 1000,
            electricPowerW: Math.max(0, num(rame.electricPower ?? rame.electricPowerKw, 0)) * 1000,
            dieselPowerW: Math.max(0, num(rame.dieselPower ?? rame.dieselPowerKw, 0)) * 1000,
            lengthM: Math.max(1, num(rame.totalLength, 200)),
            adhesionMassKg,
            traction: rame.traction || '',
            electricSystems: uniqueSystems,
            gauges: uniqueGauges,
            // The most restrictive vehicle governs the complete consist. For loading
            // gauge we only propagate an explicit value; unknown/mixed nomenclature is
            // left blank rather than guessed.
            loadingGauge: [...new Set(loadingGauges.map(x => String(x).trim()).filter(Boolean))].length === 1 ? String(loadingGauges[0]).trim() : '',
            axleLoad: axleLoads.length ? Math.max(...axleLoads) : null,
            metreLoad: metreLoads.length ? Math.max(...metreLoads) : null,
            brakeServiceMs2: brakeMass ? brakeWeighted / brakeMass : num(rame.brakeServiceMs2, 0.9),
            source: 'REFERENCE_RAME',
            referenceComposition: array(rame.elementDetails).map((e, i) => ({
                order: i,
                catalogId: e.id || e.catalogId || '',
                name: e.name || '',
                category: e.category || '',
                mass: num(e.mass, e.tonnage || 0),
                power: num(e.power, 0),
                maxSpeed: num(e.maxSpeed, 160),
            })),
        });
    }
    // Fixed standard consists for Vmax-only mode. They are intentionally simple
    // and category-specific; the player cannot edit them (specification decision).
    static genericForCategory(category, maxSpeed = 160) {
        const vmax = Math.max(1, num(maxSpeed, 160));
        const presets = {
            [TrainCategory.PASSENGER]: { massKg: 320000, powerW: 4000000, lengthM: 200, adhesionMassKg: 160000, brakeServiceMs2: 1.0 },
            [TrainCategory.FREIGHT]: { massKg: 1600000, powerW: 5000000, lengthM: 650, adhesionMassKg: 180000, brakeServiceMs2: 0.65 },
            [TrainCategory.W]: { massKg: 280000, powerW: 3500000, lengthM: 180, adhesionMassKg: 140000, brakeServiceMs2: 0.95 },
            [TrainCategory.HLP]: { massKg: 90000, powerW: 5000000, lengthM: 20, adhesionMassKg: 90000, brakeServiceMs2: 1.0 },
            [TrainCategory.TM]: { massKg: 300000, powerW: 8000000, lengthM: 80, adhesionMassKg: 270000, brakeServiceMs2: 0.8 },
            [TrainCategory.INFRA]: { massKg: 900000, powerW: 3000000, lengthM: 450, adhesionMassKg: 120000, brakeServiceMs2: 0.6 },
            [TrainCategory.TTX]: { massKg: 750000, powerW: 2800000, lengthM: 350, adhesionMassKg: 120000, brakeServiceMs2: 0.6 },
        };
        const p = presets[category] || presets[TrainCategory.PASSENGER];
        return new PerformanceProfile({
            mode: PerformanceMode.LINE_MAX_SPEED,
            name: `${category} V${vmax}`,
            category,
            maxSpeed: vmax,
            ...p,
            source: 'FIXED_STANDARD_CONSIST',
        });
    }
    toPhysicsParams() {
        return {
            massKg: this.massKg,
            powerW: this.powerW,
            electricPowerW: this.electricPowerW,
            dieselPowerW: this.dieselPowerW,
            electricSystems: this.electricSystems,
            traction: this.traction,
            lengthM: this.lengthM,
            adhesionMassKg: this.adhesionMassKg,
            brakeServiceMs2: this.brakeServiceMs2,
            brakeBuildSec: this.brakeBuildSec,
        };
    }
    toJSON() { return deepClone(this); }
}
export class ValidationIssue {
    constructor(level, code, message, data = null) {
        this.id = makeV2Id('issue');
        this.level = level; // ERROR | WARNING | UNKNOWN | INFO
        this.code = code;
        this.message = message;
        this.data = data ? deepClone(data) : null;
    }
}
export class ValidationReport {
    constructor(data = {}) {
        this.timestamp = data.timestamp || new Date().toISOString();
        this.ormRevision = data.ormRevision || '';
        this.issues = array(data.issues).map(i => ({ ...i }));
        this.deferred = !!data.deferred;
    }
    get errors() { return this.issues.filter((i) => i.level === 'ERROR'); }
    get warnings() { return this.issues.filter((i) => i.level === 'WARNING'); }
    get unknowns() { return this.issues.filter((i) => i.level === 'UNKNOWN'); }
    get information() { return this.issues.filter((i) => i.level === 'INFO'); }
    get canValidate() { return this.errors.length === 0; }
    toJSON() { return deepClone(this); }
}
export class ScheduleVersion {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('schver');
        this.version = Math.max(1, num(data.version, 1));
        this.createdAt = data.createdAt || new Date().toISOString();
        this.state = data.state || ScheduleState.DRAFT;
        this.calendarIds = array(data.calendarIds).map(String);
        this.category = data.category || TrainCategory.PASSENGER;
        this.performanceProfile = new PerformanceProfile(data.performanceProfile || { category: this.category });
        this.locations = array(data.locations).map(l => new ScheduledLocation(l));
        this.outboundPath = new SchedulePath({ ...(data.outboundPath || {}), direction: PathDirection.OUTBOUND });
        // Legacy compatibility only. Modern V2 returns are independent ScheduleRecord objects.
        this.returnPath = data.returnPath ? new SchedulePath({ ...data.returnPath, direction: PathDirection.RETURN }) : null;
        this.validationReport = data.validationReport ? new ValidationReport(data.validationReport) : null;
        this.notes = data.notes || '';
        this.automaticMarginSec = 0; // immutable product rule
        this.lastRecalculatedAt = data.lastRecalculatedAt || '';
        // v1.1.92 — explicit player override: a timetable may intentionally be
        // validated with a manually entered running time shorter than RE's current
        // physical estimate. Structural/route/safety validation remains mandatory.
        this.allowShorterThanPhysicalTiming = Boolean(data.allowShorterThanPhysicalTiming);
    }
    normalize() {
        this.locations.sort((a, b) => a.order - b.order);
        this.locations.forEach((l, i) => { l.order = i; });
        this.outboundPath.constraints.sort((a, b) => a.order - b.order);
        this.outboundPath.constraints.forEach((c, i) => { c.order = i; });
        if (this.returnPath) {
            this.returnPath.constraints.sort((a, b) => a.order - b.order);
            this.returnPath.constraints.forEach((c, i) => { c.order = i; });
        }
        return this;
    }
    get firstDepartureSec() {
        const loc = this.locations[0];
        return loc?.departureSec ?? loc?.arrivalSec ?? 0;
    }
    get lastArrivalSec() {
        const loc = this.locations[this.locations.length - 1];
        return loc?.arrivalSec ?? loc?.departureSec ?? this.firstDepartureSec;
    }
    toJSON() {
        return {
            id: this.id, version: this.version, createdAt: this.createdAt, state: this.state,
            calendarIds: [...this.calendarIds], category: this.category,
            performanceProfile: this.performanceProfile.toJSON(),
            locations: this.locations.map((l) => l.toJSON()),
            outboundPath: this.outboundPath.toJSON(),
            returnPath: this.returnPath?.toJSON() || null,
            validationReport: this.validationReport?.toJSON() || null,
            notes: this.notes,
            automaticMarginSec: 0,
            lastRecalculatedAt: this.lastRecalculatedAt,
            allowShorterThanPhysicalTiming: Boolean(this.allowShorterThanPhysicalTiming),
        };
    }
}
export class ScheduleRecord {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('schedule');
        this.number = data.number || '';
        this.name = data.name || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.versions = array(data.versions).map(v => new ScheduleVersion(v));
        if (this.versions.length === 0)
            this.versions.push(new ScheduleVersion());
        this.currentVersionId = data.currentVersionId || this.versions[this.versions.length - 1].id;
    }
    get currentVersion() {
        return this.versions.find((v) => v.id === this.currentVersionId) || this.versions[this.versions.length - 1];
    }
    createVersion(options = {}) {
        const src = options.fromVersion || this.currentVersion;
        const copy = new ScheduleVersion(src.toJSON());
        copy.id = makeV2Id('schver');
        copy.version = Math.max(0, ...this.versions.map((v) => v.version)) + 1;
        copy.createdAt = new Date().toISOString();
        copy.state = options.state || ScheduleState.DRAFT;
        if (options.calendarIds)
            copy.calendarIds = [...options.calendarIds];
        // Every version owns its exact stop/VIA/leg identities. Reusing the source
        // IDs would make rotation actions attached to one version ambiguous.
        rekeyVersionInternals(copy);
        this.versions.push(copy);
        this.currentVersionId = copy.id;
        return copy;
    }
    toJSON() {
        return {
            id: this.id, number: this.number, name: this.name, createdAt: this.createdAt,
            currentVersionId: this.currentVersionId,
            versions: this.versions.map((v) => v.toJSON()),
        };
    }
}
function roundTripLocationIdentity(loc) {
    if (!loc)
        return '';
    if (loc.kind === LocationKind.TECHNICAL && loc.technicalLocationId)
        return `TECH:${loc.technicalLocationId}`;
    if (loc.stationId)
        return `STATION:${loc.stationId}`;
    return '';
}
export function validateRoundTripPair(outVersion, returnVersion, { terminalLayoverSec = 300 } = {}) {
    const issues = [];
    if (!outVersion || !returnVersion) {
        issues.push(new ValidationIssue('ERROR', 'ROUND_TRIP_MEMBER_MISSING', 'Aller ou retour introuvable.'));
        return issues;
    }
    const outFirst = outVersion.locations?.[0];
    const outLast = outVersion.locations?.at?.(-1) || outVersion.locations?.[outVersion.locations.length - 1];
    const retFirst = returnVersion.locations?.[0];
    const retLast = returnVersion.locations?.at?.(-1) || returnVersion.locations?.[returnVersion.locations.length - 1];
    const outTerminal = roundTripLocationIdentity(outLast);
    const retOrigin = roundTripLocationIdentity(retFirst);
    const outOrigin = roundTripLocationIdentity(outFirst);
    const retTerminal = roundTripLocationIdentity(retLast);
    if (outTerminal && retOrigin && outTerminal !== retOrigin) {
        issues.push(new ValidationIssue('ERROR', 'ROUND_TRIP_TERMINAL_MISMATCH', `Le retour doit partir du terminus de l’aller (${outLast?.name || 'terminus aller'}), pas de ${retFirst?.name || 'cet arrêt'}.`, { outboundTerminalId: outTerminal, returnOriginId: retOrigin }));
    }
    if (outOrigin && retTerminal && outOrigin !== retTerminal) {
        issues.push(new ValidationIssue('ERROR', 'ROUND_TRIP_ORIGIN_MISMATCH', `Le retour doit revenir à l’origine de l’aller (${outFirst?.name || 'origine aller'}), pas à ${retLast?.name || 'cet arrêt'}.`, { outboundOriginId: outOrigin, returnTerminalId: retTerminal }));
    }
    const outArrival = Number(outLast?.arrivalSec ?? outLast?.departureSec);
    const retDeparture = Number(retFirst?.departureSec ?? retFirst?.arrivalSec);
    const requiredDeparture = outArrival + Math.max(0, Number(terminalLayoverSec || 0));
    if (Number.isFinite(outArrival) && Number.isFinite(retDeparture) && retDeparture < requiredDeparture) {
        issues.push(new ValidationIssue('ERROR', 'ROUND_TRIP_TURNAROUND_TOO_SHORT', 'Le retour part avant la fin de l’attente au terminus.', { outboundArrivalSec: outArrival, returnDepartureSec: retDeparture, requiredDepartureSec: requiredDeparture }));
    }
    return issues;
}
export class RoundTripGroup {
    constructor(data = {}) {
        this.id = data.id || makeV2Id('rt');
        this.outboundScheduleId = data.outboundScheduleId || '';
        this.returnScheduleId = data.returnScheduleId || '';
        this.terminalLayoverSec = Math.max(0, num(data.terminalLayoverSec, 300));
    }
    toJSON() { return deepClone(this); }
}
function shiftLocationTimes(location, deltaSec) {
    for (const key of ['computedArrivalSec', 'computedDepartureSec', 'arrivalSec', 'departureSec']) {
        if (location[key] != null)
            location[key] = Number(location[key]) + deltaSec;
    }
}
function rekeyPath(path, locationMap) {
    if (!path)
        return null;
    path.id = makeV2Id('path');
    const constraintMap = new Map();
    for (const c of path.constraints || []) {
        const old = c.id;
        c.id = makeV2Id('via');
        constraintMap.set(old, c.id);
    }
    for (const leg of path.legs || []) {
        leg.id = makeV2Id('leg');
        leg.fromLocationId = locationMap.get(leg.fromLocationId) || leg.fromLocationId;
        leg.toLocationId = locationMap.get(leg.toLocationId) || leg.toLocationId;
        leg.constraintIds = (leg.constraintIds || []).map((id) => constraintMap.get(id) || id);
    }
    return path;
}
function rekeyVersionInternals(version, { shiftSec = 0 } = {}) {
    const locationMap = new Map();
    for (const l of version.locations || []) {
        const old = l.id;
        l.id = makeV2Id('loc');
        locationMap.set(old, l.id);
        if (shiftSec)
            shiftLocationTimes(l, shiftSec);
    }
    rekeyPath(version.outboundPath, locationMap);
    rekeyPath(version.returnPath, locationMap);
    return version;
}
export class ScheduleV2Manager {
    constructor() {
        this._batchClones = null;
        this._batchNumbers = null;
        this._batchNames = null;
        this.schemaVersion = SCHEDULE_V2_SCHEMA;
        this.schedules = [];
        this.calendars = [];
        this.roundTrips = [];
        this.technicalLocations = [];
    }
    createDraft(data = {}) {
        const rec = new ScheduleRecord({
            number: data.number ? this.uniqueTrainNumber(String(data.number)) : '',
            name: data.name || '',
            versions: [{
                    state: ScheduleState.DRAFT,
                    category: data.category || TrainCategory.PASSENGER,
                    calendarIds: data.calendarIds || [],
                    performanceProfile: data.performanceProfile || PerformanceProfile.genericForCategory(data.category || TrainCategory.PASSENGER, data.maxSpeed || 160).toJSON(),
                }],
        });
        this.schedules.push(rec);
        return rec;
    }
    getSchedule(id) { return this.schedules.find((s) => s.id === id) || null; }
    getVersion(scheduleId, versionId = null) {
        const rec = this.getSchedule(scheduleId);
        if (!rec)
            return null;
        if (!versionId)
            return rec.currentVersion;
        return rec.versions.find((v) => v.id === versionId) || null;
    }
    addCalendar(data = {}) {
        const cal = new OperatingCalendar(data);
        this.calendars.push(cal); // array order == priority order (index 0 highest)
        return cal;
    }
    addRoundTrip(data = {}) {
        const group = new RoundTripGroup(data);
        if (!group.outboundScheduleId || !group.returnScheduleId)
            throw new Error('Un aller-retour doit référencer un horaire aller et un horaire retour.');
        this.roundTrips.push(group);
        return group;
    }
    moveCalendar(id, targetIndex) {
        const idx = this.calendars.findIndex((c) => c.id === id);
        if (idx < 0)
            return false;
        const [cal] = this.calendars.splice(idx, 1);
        const to = Math.max(0, Math.min(this.calendars.length, targetIndex));
        this.calendars.splice(to, 0, cal);
        return true;
    }
    removeCalendar(id, { rotationManager = null } = {}) {
        id = String(id || '');
        const cal = this.calendars.find((c) => String(c.id) === id);
        if (!cal)
            return { ok: false, references: [] };
        const references = [];
        const affectedSchedules = new Set();
        const affectedRotations = new Set();
        for (const rec of this.schedules)
            for (const v of rec.versions) {
                if ((v.calendarIds || []).includes(id)) {
                    references.push({ kind: 'schedule', scheduleId: rec.id, versionId: v.id });
                    const beforeCount = (v.calendarIds || []).length;
                    v.calendarIds = (v.calendarIds || []).filter((x) => String(x) !== id);
                    // Calendar-less VALID versions are an intentional everyday fallback. Deleting
                    // the sole calendar must never silently convert a seasonal service into an
                    // everyday service. Preserve geometry, but require explicit player repair.
                    if (beforeCount > 0 && v.calendarIds.length === 0 && v.state === ScheduleState.VALID) {
                        v.state = ScheduleState.NEEDS_REPAIR;
                        v.validationReport = new ValidationReport({ issues: [new ValidationIssue('ERROR', 'CALENDAR_REMOVED', 'Le seul calendrier de cette version a été supprimé. Réaffectez un calendrier avant de la remettre en service.', { calendarId: id })] });
                    }
                    affectedSchedules.add(rec.id);
                }
            }
        for (const r of rotationManager?.rotations || []) {
            if (String(r.calendarId || '') === id) {
                r.calendarId = '';
                // Blank rotation calendar means "always" at runtime. Disable it instead of
                // turning a dated rotation into an everyday rotation after deletion.
                r.enabled = false;
                references.push({ kind: 'rotation', rotationId: r.id });
                affectedRotations.add(r.id);
            }
        }
        this.calendars = this.calendars.filter((c) => String(c.id) !== id);
        for (const sid of affectedSchedules) {
            for (const ref of rotationManager?.findScheduleReferences?.(sid) || [])
                affectedRotations.add(ref.rotationId);
        }
        for (const rid of affectedRotations)
            rotationManager?.recalculateRotation?.(rid);
        return { ok: true, references, affectedScheduleIds: [...affectedSchedules], affectedRotationIds: [...affectedRotations] };
    }
    resolveVersion(scheduleId, dateStr) {
        const rec = this.getSchedule(scheduleId);
        if (!rec)
            return null;
        // First applicable calendar in display order wins.
        for (const cal of this.calendars) {
            if (!cal.matchesDate(dateStr))
                continue;
            const candidates = rec.versions
                .filter((v) => v.state === ScheduleState.VALID && v.calendarIds.includes(cal.id))
                .sort((a, b) => b.version - a.version);
            if (candidates.length)
                return candidates[0];
        }
        // Calendar-less valid version = fallback.
        return rec.versions
            .filter((v) => v.state === ScheduleState.VALID && v.calendarIds.length === 0)
            .sort((a, b) => b.version - a.version)[0] || null;
    }
    isTrainNumberAvailable(number, exceptScheduleId = '') {
        const n = String(number ?? '').trim();
        if (!n)
            return false;
        return !this.schedules.some((s) => s.id !== exceptScheduleId && String(s.number ?? '').trim() === n);
    }
    uniqueTrainNumber(preferred, exceptScheduleId = '', step = 1) {
        const pool = !exceptScheduleId && this._batchNumbers ? this._batchNumbers : new LabelAllocator(this.schedules.filter(s => s.id !== exceptScheduleId).map(s => s.number));
        return pool.claim(preferred, step);
    }
    duplicateSchedule(id, options = {}) {
        const src = this.getSchedule(id);
        if (!src)
            return null;
        let factory = this._batchClones?.get(src);
        if (this._batchClones && !factory) {
            factory = prepareEditableClone(src);
            this._batchClones.set(src, factory);
        }
        const copy = factory ? factory() : cloneEditableGraph(src);
        copy.id = makeV2Id('schedule');
        const desiredNumber = options.number != null ? String(options.number) : incrementLabel(src.number, options.numberDelta || 0);
        copy.number = this.uniqueTrainNumber(desiredNumber, '', Number(options.numberStep || (options.numberDelta ? 2 : 1)));
        if (options.name != null)
            copy.name = String(options.name);
        else
            copy.name = duplicatedTrainName(src.name, src.number, copy.number, Number(options.numberDelta || 1), this._batchNames || new LabelAllocator(this.schedules.map(s => s.name), true));
        copy.createdAt = new Date().toISOString();
        const shiftSec = Number(options.timeShiftSec || 0);
        copy.versions = copy.versions.map((v) => {
            v.id = makeV2Id('schver');
            v.state = options.preserveState ? v.state : (options.state || ScheduleState.DRAFT);
            v.createdAt = new Date().toISOString();
            rekeyVersionInternals(v, { shiftSec });
            // Route geometry/OSM bindings are unchanged by a timetable-only clone.
            // A VALID clone retains its validation report; a draft gets revalidated later.
            if (v.state === ScheduleState.DRAFT)
                v.validationReport = null;
            return v;
        });
        const sourceCurrentIndex = src.versions.findIndex((v) => v.id === src.currentVersionId);
        copy.currentVersionId = copy.versions[Math.max(0, sourceCurrentIndex)]?.id || copy.versions.at(-1)?.id || '';
        this.schedules.push(copy);
        return copy;
    }
    duplicateScheduleFrequency(id, options = {}) {
        const src = this.getSchedule(id);
        if (!src)
            throw new Error('Horaire introuvable.');
        const intervalSec = Math.max(60, Math.round(Number(options.intervalSec || 0)));
        if (!Number.isFinite(intervalSec) || intervalSec < 60)
            throw new Error('Fréquence invalide.');
        const baseDeparture = Number(src.currentVersion?.firstDepartureSec || 0);
        const shifts = [];
        const maxCopies = Math.max(1, Math.min(500, Math.floor(Number(options.maxCopies || 500))));
        if (options.untilDepartureSec != null) {
            const until = Number(options.untilDepartureSec);
            if (!Number.isFinite(until) || until <= baseDeparture)
                throw new Error('Heure de fin invalide.');
            if (until - baseDeparture > 86400)
                throw new Error('La génération par fréquence est limitée à 24 h.');
            for (let shift = intervalSec; baseDeparture + shift <= until && shifts.length < maxCopies; shift += intervalSec)
                shifts.push(shift);
        }
        else {
            const totalCount = Math.max(1, Math.floor(Number(options.totalCount || 2)));
            const includeOriginal = options.includeOriginal !== false;
            const copies = totalCount - (includeOriginal ? 1 : 0);
            if (copies < 1)
                return [];
            if (copies > maxCopies)
                throw new Error(`Trop de duplicatas (${copies}). Maximum : ${maxCopies}.`);
            if (copies * intervalSec > 86400)
                throw new Error('La génération par fréquence est limitée à 24 h.');
            for (let i = 1; i <= copies; i++)
                shifts.push(i * intervalSec);
        }
        // Only new records are touched: retain references, not a serialized copy of
        // the entire network. Rollback also preserves existing object identities.
        const length = this.schedules.length;
        const prevNumbers = this._batchNumbers, prevNames = this._batchNames, prevClones = this._batchClones;
        this._batchClones = new Map();
        this._batchNumbers = new LabelAllocator(this.schedules.map(s => s.number));
        this._batchNames = new LabelAllocator(this.schedules.map(s => s.name), true);
        try {
            return shifts.map((shift, index) => this.duplicateSchedule(id, {
                preserveState: true,
                numberDelta: (index + 1) * 2,
                timeShiftSec: shift,
            }));
        }
        catch (err) {
            // Frequency creation is atomic: a failure at copy N must not leave N-1
            // phantom schedules behind. Transactional load preserves the prior state.
            this.schedules.splice(length);
            throw err;
        }
        finally {
            this._batchNumbers = prevNumbers;
            this._batchNames = prevNames;
            this._batchClones = prevClones;
        }
    }
    duplicateRoundTrip(groupId, options = {}, rotationManager = null) {
        const group = this.roundTrips.find((g) => g.id === groupId);
        if (!group)
            throw new Error('Aller-retour introuvable.');
        const out = this.getSchedule(group.outboundScheduleId);
        const ret = this.getSchedule(group.returnScheduleId);
        if (!out || !ret)
            throw new Error('Horaire aller/retour introuvable.');
        const pairIssues = validateRoundTripPair(out.currentVersion, ret.currentVersion, { terminalLayoverSec: group.terminalLayoverSec });
        const pairError = pairIssues.find((i) => i.level === 'ERROR');
        if (pairError)
            throw new Error(pairError.message);
        const baseDeparture = out.currentVersion.firstDepartureSec;
        const horizonSec = Math.min(86400, Math.max(0, Number(options.horizonSec ?? 86400)));
        let intervalSec = Math.max(1, Number(options.intervalSec || 0));
        let firstShift = Number(options.firstShiftSec || 0);
        if (options.nextDepartureSec != null)
            firstShift = Number(options.nextDepartureSec) - baseDeparture;
        if (!intervalSec)
            intervalSec = Math.max(1, firstShift || 3600);
        if (firstShift <= 0)
            firstShift = intervalSec;
        const created = [];
        const maxPairs = Math.max(1, Math.min(500, Math.floor(Number(options.maxPairs || 500))));
        const scheduleLength = this.schedules.length, groupLength = this.roundTrips.length;
        const rotationSnapshot = options.rotationId ? rotationManager?.toSave?.() || null : null;
        const prevNumbers = this._batchNumbers, prevNames = this._batchNames, prevClones = this._batchClones;
        this._batchClones = new Map();
        this._batchNumbers = new LabelAllocator(this.schedules.map(s => s.number));
        this._batchNames = new LabelAllocator(this.schedules.map(s => s.name), true);
        let pairIndex = 1;
        try {
            for (let shift = firstShift; shift <= horizonSec && created.length < maxPairs; shift += intervalSec, pairIndex++) {
                // Preserve every seasonal/version state exactly. Only the current pair must be
                // VALID to duplicate; NEEDS_REPAIR historical versions must never be promoted.
                let outNumber = incrementLabel(out.number, pairIndex * 2), retNumber = incrementLabel(ret.number, pairIndex * 2);
                if (outNumber === out.number)
                    outNumber = `${out.number} ${pairIndex * 2}`;
                if (retNumber === ret.number)
                    retNumber = `${ret.number} ${pairIndex * 2}`;
                if (outNumber === retNumber)
                    throw new Error('Les numéros aller et retour doivent être distincts.');
                while (this._batchNumbers.has(outNumber) || this._batchNumbers.has(retNumber)) {
                    outNumber = incrementLabel(outNumber, 2);
                    retNumber = incrementLabel(retNumber, 2);
                }
                const outCopy = this.duplicateSchedule(out.id, { preserveState: true, number: outNumber, numberStep: 2, numberDelta: pairIndex * 2, timeShiftSec: shift });
                const retCopy = this.duplicateSchedule(ret.id, { preserveState: true, number: retNumber, numberStep: 2, numberDelta: pairIndex * 2, timeShiftSec: shift });
                const g = new RoundTripGroup({ outboundScheduleId: outCopy.id, returnScheduleId: retCopy.id, terminalLayoverSec: group.terminalLayoverSec });
                this.roundTrips.push(g);
                if (rotationManager && options.rotationId) {
                    rotationManager.addOccurrence(options.rotationId, { scheduleId: outCopy.id, versionId: outCopy.currentVersion.id });
                    rotationManager.addOccurrence(options.rotationId, { scheduleId: retCopy.id, versionId: retCopy.currentVersion.id });
                }
                created.push({ group: g, outbound: outCopy, return: retCopy, shiftSec: shift });
            }
            if (rotationManager && options.rotationId)
                rotationManager.recalculateRotation(options.rotationId);
            return created;
        }
        catch (err) {
            this.schedules.splice(scheduleLength);
            this.roundTrips.splice(groupLength);
            if (rotationSnapshot && rotationManager?.loadFromSave)
                rotationManager.loadFromSave(rotationSnapshot);
            throw err;
        }
        finally {
            this._batchNumbers = prevNumbers;
            this._batchNames = prevNames;
            this._batchClones = prevClones;
        }
    }
    addTechnicalLocation(data = {}) {
        const loc = new TechnicalLocation(data);
        if (!loc.name.trim())
            throw new Error('Le point technique doit avoir un nom.');
        this.technicalLocations.push(loc);
        return loc;
    }
    removeSchedule(id, { cascade = false, rotationManager = null } = {}) {
        const refs = rotationManager?.findScheduleReferences?.(id) || [];
        if (refs.length && !cascade)
            return { ok: false, references: refs };
        if (refs.length && cascade)
            rotationManager.removeScheduleReferences(id);
        // A direct material assignment is owned by the timetable itself and cannot
        // survive deletion of that timetable. It is removed even when no rotation
        // references exist (the common direct-only workflow).
        rotationManager?.removeDirectAssignment?.(id);
        this.schedules = this.schedules.filter((s) => s.id !== id);
        this.roundTrips = this.roundTrips.filter((r) => r.outboundScheduleId !== id && r.returnScheduleId !== id);
        return { ok: true, references: refs };
    }
    removeTechnicalLocation(id, { cascade = false } = {}) {
        const refs = [];
        for (const s of this.schedules)
            for (const v of s.versions) {
                v.locations.forEach((l) => { if (l.technicalLocationId === id)
                    refs.push({ scheduleId: s.id, versionId: v.id, locationId: l.id }); });
            }
        if (refs.length && !cascade)
            return { ok: false, references: refs };
        if (cascade) {
            for (const schedule of this.schedules)
                for (const v of schedule.versions) {
                    const oldLocations = [...v.locations], removed = new Set();
                    oldLocations.forEach((l, i) => { if (l.technicalLocationId === id)
                        removed.add(i); });
                    if (!removed.size)
                        continue;
                    const kept = oldLocations.map((_, i) => i).filter(i => !removed.has(i));
                    const path = v.outboundPath;
                    const mapped = [];
                    for (const c of path.constraints || []) {
                        const oldLeg = Math.max(0, Number(c.legIndex) || 0);
                        let newLeg = -1;
                        for (let j = 0; j < kept.length - 1; j++)
                            if (kept[j] <= oldLeg && oldLeg < kept[j + 1]) {
                                newLeg = j;
                                break;
                            }
                        if (newLeg >= 0)
                            mapped.push({ c, oldLeg, newLeg, oldOrder: Number(c.order) || 0 });
                    }
                    mapped.sort((a, b) => a.newLeg - b.newLeg || a.oldLeg - b.oldLeg || a.oldOrder - b.oldOrder);
                    path.constraints = mapped.map(x => { x.c.legIndex = x.newLeg; return x.c; });
                    path.constraints.forEach((c, i) => c.order = i);
                    v.locations = oldLocations.filter((_, i) => !removed.has(i));
                    v.normalize();
                    // Preserve the last known-good geometry for visual diagnosis, but make it
                    // explicitly stale. The next editor recomputation rebuilds canonical legs.
                    path.topologyRevision = Math.max(0, Number(path.topologyRevision || 0)) + 1;
                    path.resolvedRevision = Math.min(Number(path.resolvedRevision || 0), Math.max(0, path.topologyRevision - 1));
                    path.validatedAt = '';
                    v.state = ScheduleState.NEEDS_REPAIR;
                    v.validationReport = null;
                }
        }
        this.technicalLocations = this.technicalLocations.filter((t) => t.id !== id);
        return { ok: true, references: refs };
    }
    toSave() {
        return {
            schemaVersion: SCHEDULE_V2_SCHEMA,
            schedules: this.schedules.map((s) => s.toJSON()),
            calendars: this.calendars.map((c) => c.toJSON()),
            roundTrips: this.roundTrips.map((r) => r.toJSON()),
            technicalLocations: this.technicalLocations.map((t) => t.toJSON()),
        };
    }
    loadFromSave(data) {
        if (!data || Array.isArray(data) || typeof data !== 'object') {
            console.error('Schedule V2 : format de sauvegarde legacy brut non supporté ; migration explicite requise.');
            return false;
        }
        const schema = Number(data.schemaVersion ?? 1);
        if (!Number.isFinite(schema) || schema < SCHEDULE_V2_MIN_SCHEMA || schema > SCHEDULE_V2_SCHEMA) {
            console.error(`Schedule V2 schema ${data.schemaVersion} non supporté (attendu ${SCHEDULE_V2_MIN_SCHEMA}..${SCHEDULE_V2_SCHEMA}).`);
            return false;
        }
        // Schema 1 used the same top-level collections in early V2 prototypes. Normalize
        // missing fields instead of silently dropping all timetables. Future schemas stay
        // fail-closed until an explicit migration exists.
        const migrated = { ...data, schemaVersion: SCHEDULE_V2_SCHEMA, schedules: array(data.schedules), calendars: array(data.calendars), roundTrips: array(data.roundTrips), technicalLocations: array(data.technicalLocations) };
        // Transactional load: a malformed/incompatible payload must never erase the live game state.
        let schedules, calendars, roundTrips, technicalLocations;
        try {
            schedules = migrated.schedules.map((s) => new ScheduleRecord(s));
            calendars = migrated.calendars.map((c) => new OperatingCalendar(c));
            roundTrips = migrated.roundTrips.map((r) => new RoundTripGroup(r));
            technicalLocations = migrated.technicalLocations.map((t) => new TechnicalLocation(t));
            const unique = (items, label) => { const ids = new Set(); for (const x of items) {
                const id = String(x?.id || '');
                if (!id || ids.has(id))
                    throw new Error(`${label}: identifiant vide ou dupliqué (${id || '?'})`);
                ids.add(id);
            } };
            unique(schedules, 'Horaires');
            unique(calendars, 'Calendriers');
            unique(roundTrips, 'Aller-retour');
            unique(technicalLocations, 'Points techniques');
            for (let si = 0; si < schedules.length; si++) {
                const rec = schedules[si], raw = migrated.schedules[si] || {};
                unique(rec.versions, `Versions ${rec.id}`);
                if (raw.currentVersionId && !rec.versions.some((v) => v.id === raw.currentVersionId))
                    throw new Error(`Horaire ${rec.id}: currentVersionId introuvable (${raw.currentVersionId})`);
                for (const v of rec.versions) {
                    unique(v.locations, `Arrêts ${rec.id}/${v.id}`);
                    unique(v.outboundPath?.constraints || [], `VIA ${rec.id}/${v.id}`);
                }
            }
        }
        catch (err) {
            console.error('Schedule V2 chargement refusé:', err);
            return false;
        }
        this.schedules = schedules;
        this.calendars = calendars;
        this.roundTrips = roundTrips;
        this.technicalLocations = technicalLocations;
        return true;
    }
}
