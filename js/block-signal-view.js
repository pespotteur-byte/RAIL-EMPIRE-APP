export function displayBlockSignals(services, manager, bounds) {
    const candidates = new Map();
    for (const service of services) {
        if (service.active === false || service.completed || service.cancelled)
            continue;
        const route = service._state?.cachedRoute, assignments = service._cantonAssignments;
        if (!route || !assignments)
            continue;
        const front = (service._state?.index || 0) + (service._state?.progress || 0);
        // The signal at the END of block i protects block i+1, never block i.
        // No invented red signal at the final buffer stop / end of the route.
        for (let i = 0; i < assignments.length - 1; i++) {
            const current = assignments[i], next = assignments[i + 1];
            if (!current || !next)
                continue;
            const at = current.endIndex, p = route[at], before = route[Math.max(0, at - 1)], after = route[Math.min(route.length - 1, at + 1)];
            if (!p || !before || !after || p.lat < bounds.minLat || p.lat > bounds.maxLat || p.lon < bounds.minLon || p.lon > bounds.maxLon)
                continue;
            const heading = Math.atan2(after.lat - before.lat, (after.lon - before.lon) * Math.cos(p.lat * Math.PI / 180));
            const direction = Math.round(heading * 4 / Math.PI); // opposite directions remain separate
            const key = `${p.lat.toFixed(7)},${p.lon.toFixed(7)}|${next.cantonId}|${direction}`;
            const distance = front < at ? at - front : Infinity, old = candidates.get(key);
            if (old && old.distance <= distance)
                continue;
            candidates.set(key, { lat: p.lat, lon: p.lon, heading, assignments, entryIndex: i + 1, observer: front < at ? service.id : null, distance });
        }
    }
    return [...candidates.values()].map(entry => ({ lat: entry.lat, lon: entry.lon, heading: entry.heading,
        aspect: manager.getEntrySignalAspect(entry.assignments, entry.entryIndex, entry.observer) }));
}
