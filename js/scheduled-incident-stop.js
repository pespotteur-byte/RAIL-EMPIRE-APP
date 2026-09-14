export function bookedIncidentStop(service) {
    if (service.completed || service.cancelled || !['waiting', 'stopped_at_station'].includes(service.state || ''))
        return null;
    const speed = Number(service.speed ?? service.train?.speed ?? 0);
    if (!Number.isFinite(speed) || Math.abs(speed) > 0.1)
        return null;
    const stops = service.getCurrentStops?.() ?? service.stops ?? [];
    // currentStopIndex advances when arrival is committed, including the terminus.
    const index = service.state === 'waiting' ? Number(service.currentStopIndex ?? 0) : Number(service.currentStopIndex ?? 0) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= stops.length)
        return null;
    const stop = stops[index];
    if (!stop || stop.stationId == null || String(stop.stationId) === '' || stop.technicalLocationId)
        return null;
    if (stop.type != null && stop.type !== 'arret')
        return null;
    const marker = service.train?.stoppedAt;
    const markerRecord = marker && typeof marker === 'object' ? marker : null;
    const markerId = markerRecord ? (markerRecord.id ?? markerRecord.stationId) : marker;
    if (markerId != null && String(markerId) !== '')
        return String(markerId) === String(stop.stationId) ? stop : null;
    // An old save can lack stoppedAt. Only accept the booked stop's own exact
    // stopping coordinates, never a different station found by geographic search.
    const lat = Number(stop.lat), lon = Number(stop.lon), pos = service.position;
    if (stop.lat == null || stop.lon == null || !pos || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon))
        return null;
    const dy = (Number(pos.lat) - lat) * 111.32;
    const dx = (Number(pos.lon) - lon) * 111.32 * Math.cos(lat * Math.PI / 180);
    return Math.hypot(dx, dy) <= 0.1 ? stop : null;
}
