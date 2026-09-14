/** Bounded, display-only cache. Exact coordinate comparison detects in-place edits;
 * no route vertex or physical constraint is ever removed from game data. */
export class RouteDrawingCache {
    constructor(maxPoints = 200000, maxEntries = 8) {
        this.maxPoints = maxPoints;
        this.maxEntries = maxEntries;
        this.entries = new Map();
        this.points = 0;
    }
    clear() { this.entries.clear(); this.points = 0; }
    get retainedPoints() { return this.points; }
    unchanged(route, entry) {
        if (entry.coords.length !== route.length * 2)
            return false;
        for (let i = 0; i < route.length; i++)
            if (!Object.is(entry.coords[i * 2], Number(route[i]?.lat)) || !Object.is(entry.coords[i * 2 + 1], Number(route[i]?.lon)))
                return false;
        return true;
    }
    project(route, bounds, viewKey, project) {
        const key = `${viewKey}|${bounds.minLat},${bounds.maxLat},${bounds.minLon},${bounds.maxLon}`;
        let entry = this.entries.get(route);
        if (entry && !this.unchanged(route, entry)) {
            this.points -= entry.coords.length / 2;
            this.entries.delete(route);
            entry = undefined;
        }
        if (!entry) {
            const coords = new Float64Array(route.length * 2), chunks = [];
            for (let i = 0; i < route.length; i++) {
                coords[i * 2] = Number(route[i]?.lat);
                coords[i * 2 + 1] = Number(route[i]?.lon);
            }
            for (let start = 0; start < route.length - 1; start += 128) {
                const end = Math.min(route.length - 1, start + 128), chunk = { start, end, minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity };
                for (let i = start; i <= end; i++) {
                    const lat = coords[i * 2], lon = coords[i * 2 + 1];
                    if (!Number.isFinite(lat) || !Number.isFinite(lon))
                        continue;
                    chunk.minLat = Math.min(chunk.minLat, lat);
                    chunk.maxLat = Math.max(chunk.maxLat, lat);
                    chunk.minLon = Math.min(chunk.minLon, lon);
                    chunk.maxLon = Math.max(chunk.maxLon, lon);
                }
                chunks.push(chunk);
            }
            entry = { coords, chunks, view: '', paths: [] };
            if (route.length <= this.maxPoints) {
                while (this.entries.size && (this.points + route.length > this.maxPoints || this.entries.size >= this.maxEntries)) {
                    const oldest = this.entries.keys().next().value;
                    this.points -= this.entries.get(oldest).coords.length / 2;
                    this.entries.delete(oldest);
                }
                this.entries.set(route, entry);
                this.points += route.length;
            }
        }
        else {
            this.entries.delete(route);
            this.entries.set(route, entry);
        }
        if (entry.view === key)
            return entry.paths;
        const paths = [];
        let path = null, last = -2;
        const safeBounds = bounds.minLon <= bounds.maxLon && bounds.minLat <= bounds.maxLat;
        for (const chunk of entry.chunks) {
            if (safeBounds && (chunk.maxLat < bounds.minLat || chunk.minLat > bounds.maxLat || chunk.maxLon < bounds.minLon || chunk.minLon > bounds.maxLon)) {
                path = null;
                last = -2;
                continue;
            }
            if (!path || last !== chunk.start) {
                path = [];
                paths.push(path);
            }
            for (let i = chunk.start; i <= chunk.end; i++) {
                if (i === last)
                    continue;
                const lat = entry.coords[i * 2], lon = entry.coords[i * 2 + 1];
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    path = null;
                    last = -2;
                    continue;
                }
                if (!path) {
                    path = [];
                    paths.push(path);
                }
                path.push(project({ lat, lon }));
                last = i;
            }
        }
        entry.paths = paths.filter(p => p.length >= 2);
        entry.view = key;
        return entry.paths;
    }
}
