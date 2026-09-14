const blockedRailways = new Set(['abandoned', 'disused', 'razed', 'construction', 'proposed', 'tram', 'subway', 'light_rail', 'monorail']);
const text = (value) => String(value ?? '').trim().toLowerCase();
function validPoint(p) {
    if (!p || p.lat == null || p.lon == null || p.lat === '' || p.lon === '')
        return false;
    const lat = Number(p.lat), lon = Number(p.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
        !p.fallback && !p.synthetic && p.closed !== true &&
        !blockedRailways.has(text(p.railway ?? p.tags?.railway)) && !blockedRailways.has(text(p.railwayLifecycle));
}
function validRoute(route) {
    if (!Array.isArray(route) || route.length < 2)
        return false;
    let hasDistance = false;
    for (let i = 0; i < route.length; i++) {
        if (!validPoint(route[i]))
            return false;
        if (i && (Number(route[i].lat) !== Number(route[i - 1].lat) || Number(route[i].lon) !== Number(route[i - 1].lon)))
            hasDistance = true;
    }
    return hasDistance;
}
/** Reversing OSM geometry requires positive evidence; missing direction is not permission. */
function reversible(route) {
    return route.every(p => {
        const one = text(p.oneway ?? p.tags?.oneway);
        if (['yes', '1', 'true', 'forward', '-1', 'reverse', 'backward'].includes(one))
            return false;
        return text(p.bidirectional ?? p.tags?.['railway:bidirectional']) === 'regular' ||
            ['siding', 'yard', 'spur', 'crossover'].includes(text(p.service ?? p.tags?.service));
    });
}
/** Extract only current VALID V2 paths, plus already-authored legacy routes. */
export function collectFreightRailLegs(model, services = []) {
    const result = [];
    for (const record of model?.schedules ?? []) {
        const v = record.currentVersion;
        if (!v || v.state !== 'VALID' || v.validationReport?.issues?.some(i => i.level === 'ERROR'))
            continue;
        const locations = new Map(v.locations.map(l => [l.id, l]));
        const key = (id) => {
            const l = locations.get(id);
            return l?.stationId || (l?.technicalLocationId ? `technical:${l.technicalLocationId}` : '');
        };
        for (const path of [v.outboundPath, v.returnPath]) {
            if (!path || path.error || Number(path.topologyRevision ?? 0) !== Number(path.resolvedRevision ?? 0))
                continue;
            for (const leg of path.legs ?? []) {
                const fromId = key(leg.fromLocationId), toId = key(leg.toLocationId);
                if (fromId && toId && validRoute(leg.routePoints))
                    result.push({ fromId, toId, route: leg.routePoints });
            }
        }
    }
    for (const service of services) {
        // A stale compiled V2 occurrence cannot resurrect an invalidated version.
        if (service._v2OccurrenceId)
            continue;
        for (const [stops, routes] of [[service.stops, service.routes], [service._returnStopsData, service._returnRoutes]]) {
            if (!stops || !routes)
                continue;
            for (let i = 0; i < routes.length; i++) {
                const fromId = stops[i]?.stationId, toId = stops[i + 1]?.stationId;
                if (fromId && toId && validRoute(routes[i]))
                    result.push({ fromId, toId, route: routes[i] });
            }
        }
    }
    return result;
}
export class FreightNetwork {
    constructor(world, extra = []) {
        this.edges = new Map();
        this.closed = new Set();
        this.stations = new Set();
        this.edgeCount = 0;
        for (const s of world.stations ?? []) {
            if (!s?.id || !validPoint(s))
                continue;
            this.stations.add(s.id);
        }
        for (const s of world.stations ?? [])
            if (s?.closed)
                this.closed.add(s.id);
        const add = (leg) => {
            if (!leg.fromId || !leg.toId || leg.fromId === leg.toId || this.closed.has(leg.fromId) || this.closed.has(leg.toId) || !validRoute(leg.route))
                return;
            // Technical endpoints are explicit identities, never a spatial join.
            if ((!this.stations.has(leg.fromId) && !leg.fromId.startsWith('technical:')) ||
                (!this.stations.has(leg.toId) && !leg.toId.startsWith('technical:')))
                return;
            this.link(leg.fromId, leg.toId);
            if (leg.reverseAllowed && reversible(leg.route))
                this.link(leg.toId, leg.fromId);
        };
        for (const track of world.tracks ?? []) {
            if ((track.worksActive && ['closed', 'closure', 'stop', 'fermeture'].includes(text(track.worksImpact))) ||
                (track.incidentActive && track.incidentEffect === 'stop'))
                continue;
            add({ fromId: track.stationA, toId: track.stationB, route: track.route ?? [], reverseAllowed: true });
        }
        for (const leg of extra)
            add(leg);
    }
    link(a, b) {
        let next = this.edges.get(a);
        if (!next) {
            next = new Set();
            this.edges.set(a, next);
        }
        if (!next.has(b)) {
            next.add(b);
            this.edgeCount++;
        }
    }
    /** An iterative traversal handles cycles and long networks without call-stack growth. */
    reachableStations(origin) {
        const reachable = new Set();
        if (!this.stations.has(origin) || this.closed.has(origin))
            return reachable;
        const visited = new Set([origin]), queue = [origin];
        for (let head = 0; head < queue.length; head++) {
            for (const next of this.edges.get(queue[head]) ?? []) {
                if (visited.has(next))
                    continue;
                visited.add(next);
                queue.push(next);
                if (this.stations.has(next))
                    reachable.add(next);
            }
        }
        return reachable;
    }
}
