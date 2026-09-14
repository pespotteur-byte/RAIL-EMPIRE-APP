import { segmentsFromRoute, simulateProfile } from './train-physics.js';
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function calculatePhysicalTravelSeconds(route, profile, opts = {}) {
    if (!Array.isArray(route) || route.length < 2)
        return 0;
    const maxSpeed = Math.max(1, Number(profile?.maxSpeed || 160));
    const segs = segmentsFromRoute(route, maxSpeed, haversine);
    if (!segs.length)
        return 0;
    const p = profile?.toPhysicsParams ? profile.toPhysicsParams() : {
        massKg: profile?.massKg || 500000,
        powerW: profile?.powerW ?? 5000000,
        electricPowerW: profile?.electricPowerW || 0,
        dieselPowerW: profile?.dieselPowerW || 0,
        electricSystems: profile?.electricSystems || [],
        traction: profile?.traction || '',
        lengthM: profile?.lengthM || 200,
        adhesionMassKg: profile?.adhesionMassKg || profile?.massKg || 500000,
        brakeServiceMs2: profile?.brakeServiceMs2 || 0.9,
        brakeBuildSec: profile?.brakeBuildSec,
    };
    const totalM = segs.reduce((sum, s) => sum + Math.max(0, Number(s.distM || 0)), 0);
    // HOTFIX8 — cap timetable integration cells on continental runs. 20 m remains
    // exact for ordinary routes; only huge runs progressively use a slightly larger
    // integration step to keep the temporary physics arrays bounded (~45k cells).
    const dsStep = Math.max(20, Math.ceil(totalM / 45000));
    const sim = simulateProfile(segs, {
        ...p,
        weather: weatherTimingKey(opts.weather ?? null),
        startMs: opts.startMs ?? 0,
        endMs: opts.endMs ?? 0,
        preBrakeMarginM: opts.preBrakeMarginM ?? 100,
        dsStep,
        collectSegmentTimes: false,
    });
    return Math.max(1, Math.ceil(sim.timeSec));
}
// HOTFIX8 — Opera/32-bit friendly timetable edits.
function weatherTimingKey(weather) {
    if (weather == null)
        return 'clear';
    if (typeof weather === 'string')
        return weather;
    return String(weather.current || weather.type || weather.condition || 'clear');
}
function profileTimingKey(profile) {
    const p = profile || {};
    const systems = (p.electricSystems || []).map((x) => `${Number(x?.voltage) || 0}/${Number(x?.frequency) || 0}`).sort().join(',');
    const gauges = (p.gauges || []).map(Number).filter((x) => Number.isFinite(x)).sort((a, b) => a - b).join(',');
    return [
        Number(p.maxSpeed || 160), Number(p.massKg || 0), Number(p.powerW || 0), Number(p.electricPowerW || 0), Number(p.dieselPowerW || 0),
        Number(p.lengthM || 0), Number(p.adhesionMassKg || 0), Number(p.brakeServiceMs2 || 0.9), p.brakeBuildSec ?? 'auto', String(p.traction || ''), systems, gauges,
        String(p.loadingGauge || ''), Number(p.axleLoad || 0), Number(p.metreLoad || 0),
    ].join('|');
}
function legTimingKey(leg, profile, weather) {
    const pts = leg?.routePoints || [];
    const routeKey = String(leg?.physicsRouteKey || leg?.routeInputKey || [
        pts.length, Number(leg?.distanceKm || 0).toFixed(6), pts[0]?.wayId || '', pts.at?.(-1)?.wayId || ''
    ].join(':'));
    return `phys9|${routeKey}|${profileTimingKey(profile)}|${weatherTimingKey(weather)}`;
}
export function physicalTravelSecondsForLeg(leg, profile, { weather = null } = {}) {
    if (!leg?.routePoints?.length || leg.routePoints.length < 2)
        return 0;
    const signature = legTimingKey(leg, profile, weather);
    const cached = Number(leg.physicalTravelSec);
    if (leg.physicalTravelSignature === signature && Number.isFinite(cached) && cached > 0)
        return cached;
    const sec = calculatePhysicalTravelSeconds(leg.routePoints, profile, { weather: weatherTimingKey(weather) });
    leg.physicalTravelSec = sec;
    leg.physicalTravelSignature = signature;
    return sec;
}
export function recalculateScheduleTiming(version, { firstDepartureSec = null, weather = null } = {}) {
    const v = version;
    if (!v?.locations?.length)
        return version;
    v.normalize?.();
    const locs = v.locations;
    let cursor = firstDepartureSec ?? locs[0].departureSec ?? locs[0].computedDepartureSec ?? 8 * 3600;
    locs[0].computedArrivalSec = locs[0].computedArrivalSec ?? null;
    locs[0].computedDepartureSec = Math.round(cursor);
    if (!locs[0].departureOverride)
        locs[0].departureSec = Math.round(cursor);
    cursor = locs[0].departureSec ?? cursor;
    for (let i = 0; i < locs.length - 1; i++) {
        const leg = v.outboundPath?.legs?.find((l) => l.fromLocationId === locs[i].id && l.toLocationId === locs[i + 1].id);
        if (!leg?.routePoints?.length || leg.routePoints.length < 2) {
            if (v.outboundPath)
                v.outboundPath.error = `Liaison ORM manquante entre ${locs[i].name || locs[i].id} et ${locs[i + 1].name || locs[i + 1].id}`;
            return version;
        }
        const travelSec = physicalTravelSecondsForLeg(leg, v.performanceProfile, { weather });
        if (!Number.isFinite(travelSec)) {
            if (v.outboundPath)
                v.outboundPath.error = `Traction insuffisante entre ${locs[i].name || locs[i].id} et ${locs[i + 1].name || locs[i + 1].id}.`;
            for (let j = i + 1; j < locs.length; j++) {
                locs[j].computedArrivalSec = locs[j].computedDepartureSec = null;
                if (!locs[j].arrivalOverride)
                    locs[j].arrivalSec = null;
                if (!locs[j].departureOverride)
                    locs[j].departureSec = null;
            }
            return version;
        }
        const computedArrival = Math.round(cursor + travelSec);
        const next = locs[i + 1];
        next.computedArrivalSec = computedArrival;
        if (!next.arrivalOverride)
            next.arrivalSec = computedArrival;
        const actualArrival = next.arrivalSec ?? computedArrival;
        const computedDeparture = Math.round(actualArrival + Math.max(0, next.dwellSec || 0));
        next.computedDepartureSec = computedDeparture;
        if (!next.departureOverride)
            next.departureSec = computedDeparture;
        cursor = next.departureSec ?? computedDeparture;
    }
    v.lastRecalculatedAt = new Date().toISOString();
    return version;
}
export function shiftScheduleFromLocation(version, locationIndex, deltaSec) {
    const v = version;
    if (!v?.locations || !deltaSec)
        return version;
    for (let i = Math.max(0, locationIndex); i < v.locations.length; i++) {
        const l = v.locations[i];
        for (const key of ['computedArrivalSec', 'computedDepartureSec', 'arrivalSec', 'departureSec']) {
            if (l[key] != null)
                l[key] += deltaSec;
        }
    }
    return version;
}
