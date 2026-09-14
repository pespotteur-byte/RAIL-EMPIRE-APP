export const RESCUE_ENDPOINT_TOLERANCE_KM = 0.05;
export function rescuePoint(value) {
    if (!value || typeof value !== 'object')
        return null;
    const p = value;
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)
        return null;
    return { lat: p.lat, lon: p.lon };
}
export function rescueDistanceKm(a, b) {
    const r = Math.PI / 180, dlat = (b.lat - a.lat) * r, dlon = (b.lon - a.lon) * r;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export function validatedRescueRoute(value, from, to) {
    if (!Array.isArray(value) || value.length < 2)
        return null;
    for (const raw of value) {
        if (!rescuePoint(raw))
            return null;
        const p = raw;
        if (p.fallback || p.synthetic)
            return null;
    }
    const points = value;
    if (from && rescueDistanceKm(points[0], from) > RESCUE_ENDPOINT_TOLERANCE_KM)
        return null;
    if (to && rescueDistanceKm(points[points.length - 1], to) > RESCUE_ENDPOINT_TOLERANCE_KM)
        return null;
    if (!points.some(p => rescueDistanceKm(p, points[0]) > 1e-6))
        return null;
    return points.map(p => ({ ...p }));
}
export function rescueRouteFailure(error, previousAttempts, now = Date.now()) {
    const attempts = Math.min(16, Math.max(0, Math.floor(Number(previousAttempts) || 0)) + 1);
    const e = error && typeof error === 'object' ? error : {};
    const response = e.response && typeof e.response === 'object' ? e.response : {};
    const status = Number(e.status ?? e.statusCode ?? response.status);
    const accessDenied = status === 401 || status === 403;
    let retrySec = accessDenied ? 900 : Math.min(600, 30 * 2 ** Math.min(5, attempts - 1));
    if (status === 429 || status === 503) {
        let value = e.retryAfter;
        try {
            const headers = response.headers;
            if (value == null && typeof headers?.get === 'function')
                value = headers.get('Retry-After');
        }
        catch { /* absent/unreadable response headers */ }
        if (value != null && String(value).trim() !== '') {
            const text = String(value).trim();
            const seconds = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
            if (Number.isFinite(seconds) && seconds > 0)
                retrySec = Math.max(retrySec, seconds);
        }
    }
    let detail = 'Tracé indisponible';
    try {
        detail = String(e.message ?? (typeof error === 'string' ? error : detail)).slice(0, 180);
    }
    catch { /* diagnostic is best effort */ }
    return { attempts, retrySec, retryAtMs: now + retrySec * 1000, accessDenied,
        message: accessDenied ? `Routage refusé (${status}) — reprise manuelle requise` : detail };
}
