export function physicalAnchorKey(track) {
    const t = track || {}, snap = t.osmSnapshot || {};
    const lat = Number(t.snapLat ?? snap.snapLat ?? t.lat ?? snap.lat);
    const lon = Number(t.snapLon ?? snap.snapLon ?? t.lon ?? snap.lon);
    const rawSegment = t.segmentIndex ?? snap.segmentIndex;
    const segment = rawSegment != null && Number.isFinite(Number(rawSegment)) ? Number(rawSegment) : '';
    return `${String(t.wayId || snap.wayId || '')}#${segment}@${Number.isFinite(lat) ? lat.toFixed(7) : ''},${Number.isFinite(lon) ? lon.toFixed(7) : ''}`;
}
export function legRouteInputKey(ver, path, index) {
    const a = ver?.locations?.[index], b = ver?.locations?.[index + 1];
    if (!a || !b)
        return '';
    const constraints = (path?.constraints || []).filter(c => Number(c.legIndex) === index)
        .slice().sort((x, y) => x.order - y.order).map(physicalAnchorKey);
    const p = ver.performanceProfile || {};
    const systems = (p.electricSystems || []).map(x => `${Number(x?.voltage) || 0}/${Number(x?.frequency) || 0}`).sort().join(',');
    const gauges = (p.gauges || []).map(Number).filter(Number.isFinite).sort((x, y) => x - y).join(',');
    return ['scv3', physicalAnchorKey(a.track), ...constraints, physicalAnchorKey(b.track),
        String(p.traction || '').toLowerCase(), systems, gauges, String(p.loadingGauge || ''),
        Number(p.axleLoad) || 0, Number(p.metreLoad) || 0].join('|');
}
export function physicsRouteKey(inputKey, topologyEpoch, pointCount, distanceKm) {
    return `${inputKey}|topo:${Number(topologyEpoch) || 0}|n:${pointCount}|km:${Number(distanceKm || 0).toFixed(6)}`;
}
