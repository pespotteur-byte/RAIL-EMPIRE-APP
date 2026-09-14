import { railPointDistanceKm } from './rail-speed.js';
import { RouteSegmentSnapshot } from './schedule-v2-model.js';
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function structuredCloneSafe(v) { try {
    return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
catch {
    return v || null;
} }
function documentedSpeedMeta(p) {
    const speed = Number(p?.maxSpeed), source = String(p?.maxSpeedSource || '');
    if (Number.isFinite(speed) && speed > 0 && source !== 'FALLBACK_30')
        return { speed, source: source || 'OSM' };
    return null;
}
function segmentSpeedMeta(a, b) {
    const bm = documentedSpeedMeta(b), am = documentedSpeedMeta(a);
    if (bm)
        return bm;
    // HOTFIX65 — station/terminus anchors can be metadata-light even when they
    // sit on the same exact OSM way as the previous route point. Do not let that
    // endpoint-only FALLBACK_30 marker overwrite a documented speed for the
    // physical segment that reaches the station.
    const aw = String(a?.wayId || ''), bw = String(b?.wayId || '');
    if (am && (!aw || !bw || aw === bw))
        return am;
    return { speed: Number(b?.maxSpeed ?? a?.maxSpeed ?? 30) || 30, source: 'FALLBACK_30' };
}
function normalizeSameWayRoutePointSpeeds(points) {
    const pts = Array.isArray(points) ? points : [];
    let changed = false;
    const original = pts.map(p => documentedSpeedMeta(p));
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
    return pts;
}
function anchorCoords(a) {
    return {
        lat: Number(a?.snapLat ?? a?.lat),
        lon: Number(a?.snapLon ?? a?.lon),
        wayId: a?.wayId != null ? String(a.wayId) : '',
        segmentIndex: Number.isFinite(Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex)) ? Number(a?.segmentIndex ?? a?.osmSnapshot?.segmentIndex) : null,
        osmSnapshot: a?.osmSnapshot ? structuredCloneSafe(a.osmSnapshot) : null,
    };
}
// Long-range SC memory guard: runtime route points only need geometry + physical
// railway attributes. Raw Overpass tags can be very large and used to be copied
// into every point, every leg and the global path. Preserve the only raw point
// tag consumed by train physics (incline); RouteSegmentSnapshot still keeps its
// own compatibility metadata for validation/runtime diagnostics.
function compactRoutePoint(p = {}) {
    const incline = p?.tags?.incline ?? p?.incline;
    const out = {
        lat: Number(p.lat), lon: Number(p.lon), wayId: p.wayId != null ? String(p.wayId) : '',
        segmentIndex: Number.isFinite(Number(p.segmentIndex)) ? Number(p.segmentIndex) : null,
        maxSpeed: p.maxSpeed ?? 30, maxSpeedSource: p.maxSpeedSource || 'FALLBACK_30',
        maxSpeedForward: p.maxSpeedForward ?? null, maxSpeedBackward: p.maxSpeedBackward ?? null,
        electrified: p.electrified ?? null, electrifiedMode: p.electrifiedMode || '',
        voltage: Array.isArray(p.voltage) ? [...p.voltage] : [], frequency: Array.isArray(p.frequency) ? [...p.frequency] : [], gauge: Array.isArray(p.gauge) ? [...p.gauge] : [],
        loadingGauge: p.loadingGauge || '', axleLoad: p.axleLoad ?? null, metreLoad: p.metreLoad ?? null, tracks: p.tracks || 1,
        trafficMode: p.trafficMode || '', usage: p.usage || '', service: p.service || '', railway: p.railway || 'rail',
        railwayLifecycle: p.railwayLifecycle || 'present', railwayBaseType: p.railwayBaseType || p.railway || 'rail',
        preferredDirection: p.preferredDirection || '', bidirectional: p.bidirectional || '', oneway: p.oneway || '',
        signalRestrictedDirection: !!p.signalRestrictedDirection, travelDirection: p.travelDirection || '',
        _againstPreferredDirection: !!p._againstPreferredDirection, trackRef: p.trackRef || '', name: p.name || '', ref: p.ref || '',
        trainProtection: p.trainProtection ? { ...p.trainProtection } : {}, fallback: !!p.fallback,
    };
    if (incline != null && incline !== '')
        out.tags = { incline };
    else
        out.tags = {};
    return out;
}
export class ScheduleV2Router {
    constructor(orm) { this.orm = orm; }
    async chooseTrackCandidatesAtCursor(lat, lon, options = {}) {
        const pxPerKm = Math.max(1, Number(options.pixelsPerKm || 1));
        const hitPx = Math.max(2, Number(options.hitTolerancePx || 5));
        // This is only a vector acquisition envelope derived from screen pixels.
        // Acceptance is performed later by a pixel hit-test; this metre value is
        // never a snapping/selection threshold.
        const queryRadiusM = Math.max(5, Math.min(120, Math.ceil(((hitPx + 8) / pxPerKm) * 1000)));
        return this.chooseTrackCandidates(lat, lon, { ...options, radiusM: queryRadiusM });
    }
    async chooseTrackCandidates(lat, lon, options = {}) {
        if (!this.orm)
            throw new Error('ORM indisponible.');
        // Prefer local RailGraph vectors. If this migration build has no prepared
        // RailGraph pack yet, allow ONLY the existing tiny click-area lookup to
        // identify the exact physical OSM way. Route calculation stays local-only.
        const pickerOpts = { ...options, localOnly: true };
        let local = [];
        try {
            local = await this.orm.getTrackCandidates(lat, lon, pickerOpts) || [];
        }
        catch (e) {
            if (e?.name === 'AbortError')
                throw e;
        }
        if (local.length)
            return local;
        let packPrepared = false;
        try {
            await this.orm?._railGraphPack?.ready?.();
            packPrepared = !!this.orm?._railGraphPack?.prepared;
        }
        catch { }
        if (packPrepared || options.allowNetworkPickerFallback === false)
            return local;
        const fallback = await this.orm.getTrackCandidates(lat, lon, { ...options, localOnly: false });
        return (fallback || []).map((c) => ({ ...c, pickerSource: c?.pickerSource || 'OSM_TINY_CLICK_FALLBACK' }));
    }
    async routeBetweenBindings(fromTrack, toTrack, constraints = [], opts = {}) {
        if (!this.orm)
            throw new Error('ORM indisponible.');
        const all = [fromTrack, ...(constraints || []), toTrack].filter(Boolean);
        if (all.length < 2)
            throw new Error('Points de départ/arrivée manquants.');
        for (const a of all) {
            const p = anchorCoords(a);
            if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon))
                throw new Error('Position de voie invalide.');
        }
        // SC V3.3: player-picked anchors first route over local vector data. If no
        // packaged RailGraph is present, ORMClient may prepare missing geometry via
        // the persistent worldwide OSM railway underlay, then solve locally.
        const routeOpts = { ...opts, allowFallback: false, allowSyntheticStitches: false, routeObjective: 'distance', allowSignalRestrictedDirection: true, forbidPureBackup: true, preserveInfrastructureMaxSpeed: true, compactGraphEdges: true, compactStateKeys: true };
        let route;
        if (typeof this.orm.findRouteViaLocalRailGraphAnchors === 'function') {
            route = await this.orm.findRouteViaLocalRailGraphAnchors(all.map(anchorCoords), routeOpts);
        }
        else if (typeof this.orm.findRouteViaCursorAnchors === 'function') {
            // Compatibility only for injected legacy test doubles/plugins. Production
            // ORMClient always exposes the SC Future local RailGraph method.
            route = await this.orm.findRouteViaCursorAnchors(all.map(anchorCoords), routeOpts);
        }
        else {
            throw new Error('Moteur de routage ORM indisponible.');
        }
        // No static RailGraph in this area yet: prepare exactly the railway corridor
        // required by the selected anchors, cache it, then route locally. This is a
        // single preparation stage, never the historical Schedule routing ladder.
        if ((!route || route.length < 2) && String(this.orm?._lastCursorRouteFailure || '') === 'RAILGRAPH_DATA_MISSING' && opts.allowDynamicRailGraphPreparation !== false && typeof this.orm.prepareAndRouteScheduleAnchors === 'function') {
            route = await this.orm.prepareAndRouteScheduleAnchors(all.map(anchorCoords), routeOpts);
        }
        if (!route || route.length < 2 || this.orm.isFallbackRoute(route)) {
            const reason = String(this.orm?._lastCursorRouteFailure || '');
            if (reason === 'RAILGRAPH_DATA_MISSING') {
                const err = new Error('Données vectorielles OSM de routage absentes et préparation du corridor mondial indisponible pour cette zone. Le fond OpenRailwayMap peut rester visible même quand les vecteurs de routage ne sont pas encore chargés.');
                err.code = 'RAILGRAPH_DATA_MISSING';
                throw err;
            }
            if (reason === 'SOURCE_TOPOLOGY_GAP') {
                const err = new Error('Continuité interrompue dans les données ferroviaires ORM locales entre les points sélectionnés. Aucun raccordement artificiel n’a été créé.');
                err.code = 'ORM_SOURCE_TOPOLOGY_GAP';
                throw err;
            }
            if (reason === 'NETWORK_UNAVAILABLE') {
                const err = new Error('Données ferroviaires ORM incomplètes ou serveur temporairement indisponible. Réessayez le calcul : aucun verdict « pas de chemin » n’a été enregistré.');
                err.code = 'ORM_NETWORK_UNAVAILABLE';
                throw err;
            }
            if (reason === 'NO_CONNECTED_PATH') {
                const err = new Error('Aucun tracé ferroviaire ORM réel connecté n’existe entre les points sélectionnés dans les données complètes chargées.');
                err.code = 'ORM_NO_CONNECTED_PATH';
                throw err;
            }
            if (reason === 'TIME_BUDGET') {
                const err = new Error('Le calcul exact du sillon a atteint sa limite de temps. Réessayez le calcul ; aucun faux verdict « aucun chemin » n’a été enregistré.');
                err.code = 'ORM_TIME_BUDGET';
                throw err;
            }
            if (reason === 'RAILGRAPH_MEMORY_BUDGET_EXCEEDED') {
                const d = this.orm?._lastRoutingFailure || {}, needed = Math.max(0, Number(d.requiredBytes) || 0), budget = Math.max(0, Number(d.budgetBytes) || 0);
                const err = new Error(`Ce sillon exact dépasse le budget mémoire RailGraph${needed && budget ? ` (${Math.ceil(needed / 1048576)} Mo nécessaires / ${Math.floor(budget / 1048576)} Mo autorisés)` : ''}. Aucun itinéraire simplifié n’a été utilisé.`);
                err.code = 'RAILGRAPH_MEMORY_BUDGET_EXCEEDED';
                err.requiredBytes = needed;
                err.budgetBytes = budget;
                throw err;
            }
            const err = new Error('Le graphe ferroviaire ORM local n’a pas pu résoudre ce sillon.');
            err.code = 'ORM_LOCAL_ROUTE_UNRESOLVED';
            throw err;
        }
        return route;
    }
    snapshotRoute(route) {
        const routePoints = normalizeSameWayRoutePointSpeeds(route.map(compactRoutePoint));
        const segments = [];
        let distanceKm = 0;
        for (let i = 1; i < routePoints.length; i++) {
            const a = routePoints[i - 1], b = routePoints[i];
            const d = haversine(a.lat, a.lon, b.lat, b.lon);
            distanceKm += d;
            segments.push(new RouteSegmentSnapshot({
                wayId: b.wayId ?? a.wayId ?? '',
                from: a, to: b, distanceKm: d,
                maxSpeed: segmentSpeedMeta(a, b).speed,
                maxSpeedSource: segmentSpeedMeta(a, b).source,
                maxSpeedForward: b.maxSpeedForward ?? a.maxSpeedForward ?? null,
                maxSpeedBackward: b.maxSpeedBackward ?? a.maxSpeedBackward ?? null,
                electrified: b.electrified ?? a.electrified ?? null,
                electrifiedMode: b.electrifiedMode || a.electrifiedMode || '',
                voltage: b.voltage || a.voltage || [], frequency: b.frequency || a.frequency || [], gauge: b.gauge || a.gauge || [],
                loadingGauge: b.loadingGauge || a.loadingGauge || '', axleLoad: b.axleLoad ?? a.axleLoad ?? null, metreLoad: b.metreLoad ?? a.metreLoad ?? null, tracks: b.tracks || a.tracks || 1,
                trafficMode: b.trafficMode || a.trafficMode || '', trainProtection: b.trainProtection || a.trainProtection || {},
                usage: b.usage || a.usage || '', service: b.service || a.service || '', railway: b.railway || a.railway || 'rail',
                railwayLifecycle: b.railwayLifecycle || a.railwayLifecycle || 'present', railwayBaseType: b.railwayBaseType || a.railwayBaseType || b.railway || a.railway || 'rail',
                preferredDirection: b.preferredDirection || a.preferredDirection || '',
                bidirectional: b.bidirectional || a.bidirectional || '',
                oneway: b.oneway || a.oneway || '',
                trackRef: b.trackRef || a.trackRef || '', name: b.name || a.name || '', ref: b.ref || a.ref || '',
                tags: ((b?.tags?.incline ?? a?.tags?.incline) != null && (b?.tags?.incline ?? a?.tags?.incline) !== '') ? { incline: (b?.tags?.incline ?? a?.tags?.incline) } : {}, fallback: !!(a.fallback || b.fallback),
                _againstPreferredDirection: !!b._againstPreferredDirection,
            }));
        }
        // HOTFIX6 — after a long solve, replace raw graph points (which can still
        // carry large OSM metadata objects) with their compact equivalents before
        // returning control to the editor. The resolved anchors were read already.
        if (route?._longRangeWindowed || route.length > 12000) {
            for (let i = 0; i < routePoints.length; i++)
                route[i] = routePoints[i];
            this.orm?.releaseScheduleRoutingMemory?.({ aggressive: true });
        }
        return { routePoints, segments, distanceKm };
    }
}
