// OpenRailwayMap data integration via Overpass API
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class ORMClient {
  constructor() {
    this.routeCache = new Map();
    this.areaCache = new Map();
    this.loading = false;
  }

  async fetchArea(south, west, north, east) {
    const key = `${south.toFixed(2)},${west.toFixed(2)},${north.toFixed(2)},${east.toFixed(2)}`;
    if (this.areaCache.has(key)) return this.areaCache.get(key);

    const query = `[out:json][timeout:90];(way["railway"="rail"](${south},${west},${north},${east}););out body geom;`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
        const resp = await fetch(OVERPASS_URL, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (resp.status === 429) {
          console.warn(`Overpass rate limited, retry ${attempt + 1}/3...`);
          continue;
        }
        if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
        const data = await resp.json();
        const ways = this.parseWays(data);
        this.areaCache.set(key, ways);
        return ways;
      } catch (e) {
        if (attempt === 2) {
          console.warn('Overpass fetch failed after retries:', e);
          return [];
        }
      }
    }
    return [];
  }

  parseWays(data) {
    if (!data.elements) return [];
    return data.elements
      .filter(el => el.type === 'way' && el.geometry)
      .map(el => ({
        id: el.id,
        maxSpeed: parseInt(el.tags?.maxspeed) || 160,
        electrified: el.tags?.electrified !== 'no',
        tracks: parseInt(el.tags?.tracks) || 1,
        usage: el.tags?.usage || 'main',
        name: el.tags?.name || '',
        ref: el.tags?.ref || '',
        geometry: el.geometry.map(p => ({ lat: p.lat, lon: p.lon })),
      }));
  }

  buildGraph(ways) {
    const nodes = new Map();
    const edges = [];

    for (const way of ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;

      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;

        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });

        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const edge = { from: aKey, to: bKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks };
        const reverseEdge = { from: bKey, to: aKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks };

        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
        edges.push(edge);
      }
    }
    return { nodes, edges };
  }

  findNearestNode(graph, lat, lon) {
    let best = null, bestDist = Infinity;
    for (const [, node] of graph.nodes) {
      const d = haversine(lat, lon, node.lat, node.lon);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return best;
  }

  dijkstra(graph, startKey, endKey) {
    if (!startKey || !endKey) return null;

    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    const queue = [];

    dist.set(startKey, 0);
    queue.push({ key: startKey, d: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const { key: u } = queue.shift();

      if (visited.has(u)) continue;
      visited.add(u);

      if (u === endKey) break;

      const node = graph.nodes.get(u);
      if (!node) continue;

      for (const edge of node.edges) {
        if (visited.has(edge.to)) continue;
        const newDist = (dist.get(u) || 0) + edge.dist;
        if (newDist < (dist.get(edge.to) || Infinity)) {
          dist.set(edge.to, newDist);
          prev.set(edge.to, { from: u, edge });
          queue.push({ key: edge.to, d: newDist });
        }
      }
    }

    if (!prev.has(endKey) && startKey !== endKey) return null;

    const path = [];
    let current = endKey;
    while (current && current !== startKey) {
      const p = prev.get(current);
      if (!p) break;
      const node = graph.nodes.get(current);
      path.unshift({ lat: node.lat, lon: node.lon, maxSpeed: p.edge.maxSpeed, electrified: p.edge.electrified, tracks: p.edge.tracks });
      current = p.from;
    }
    const startNode = graph.nodes.get(startKey);
    if (startNode) {
      path.unshift({ lat: startNode.lat, lon: startNode.lon, maxSpeed: path[0]?.maxSpeed || 160, electrified: true, tracks: 1 });
    }
    return path;
  }

  async findRoute(fromLat, fromLon, toLat, toLon) {
    const cacheKey = `${fromLat.toFixed(4)},${fromLon.toFixed(4)}-${toLat.toFixed(4)},${toLon.toFixed(4)}`;
    if (this.routeCache.has(cacheKey)) return this.routeCache.get(cacheKey);

    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.3, distKm * 0.003 + 0.1);
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);

    if (allWays.length === 0) {
      console.warn('ORM: No railway data found in area');
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const graph = this.buildGraph(allWays);
    const startNode = this.findNearestNode(graph, fromLat, fromLon);
    const endNode = this.findNearestNode(graph, toLat, toLon);

    if (!startNode || !endNode) {
      console.warn('ORM: No nearby railway nodes found');
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const startDist = haversine(fromLat, fromLon, startNode.lat, startNode.lon);
    const endDist = haversine(toLat, toLon, endNode.lat, endNode.lon);
    if (startDist > 5 || endDist > 5) {
      console.warn(`ORM: Nearest nodes too far (start: ${startDist.toFixed(1)}km, end: ${endDist.toFixed(1)}km)`);
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const path = this.dijkstra(graph, startNode.key, endNode.key);
    if (!path || path.length === 0) {
      console.warn('ORM: Dijkstra found no path');
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    this.routeCache.set(cacheKey, path);
    return path;
  }

  makeFallbackRoute(fromLat, fromLon, toLat, toLon) {
    const steps = 20;
    const route = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      route.push({
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t,
        maxSpeed: 160,
        electrified: true,
        tracks: 2,
      });
    }
    return route;
  }

  getRouteDistance(route) {
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      total += haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
    }
    return total;
  }

  getRouteSegments(route) {
    const segments = [];
    for (let i = 1; i < route.length; i++) {
      const dist = haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
      segments.push({
        from: route[i - 1],
        to: route[i],
        distance: dist,
        maxSpeed: route[i].maxSpeed || route[i - 1].maxSpeed || 160,
        electrified: route[i].electrified !== false,
        tracks: route[i].tracks || 1,
      });
    }
    return segments;
  }

  calculateTravelTime(route, rameMaxSpeed) {
    const segments = this.getRouteSegments(route);
    let totalMinutes = 0;
    for (const seg of segments) {
      const effectiveSpeed = Math.min(rameMaxSpeed, seg.maxSpeed);
      if (effectiveSpeed <= 0) continue;
      totalMinutes += (seg.distance / effectiveSpeed) * 60;
    }
    totalMinutes *= 1.15;
    return Math.ceil(totalMinutes);
  }

  generateSignalBlocks(route) {
    const segments = this.getRouteSegments(route);
    const signals = [];
    let accDist = 0;
    let lastSignalDist = 0;

    for (const seg of segments) {
      const speed = seg.maxSpeed;
      let blockLength;
      if (speed <= 80) blockLength = 0.6;
      else if (speed <= 160) blockLength = 1.0;
      else if (speed <= 200) blockLength = 1.5;
      else blockLength = 2.5;

      accDist += seg.distance;

      while (accDist - lastSignalDist >= blockLength) {
        lastSignalDist += blockLength;
        const ratio = lastSignalDist / this.getRouteDistance(route);
        const pos = this.getPointAtRatio(route, ratio);
        signals.push({
          km: lastSignalDist,
          lat: pos.lat,
          lon: pos.lon,
          maxSpeed: speed,
          blockLength,
        });
      }
    }
    return signals;
  }

  getPointAtRatio(route, ratio) {
    if (route.length < 2) return route[0] || { lat: 0, lon: 0 };
    const r = Math.max(0, Math.min(1, ratio));

    let totalDist = 0;
    const segDists = [];
    for (let i = 1; i < route.length; i++) {
      const d = haversine(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
      segDists.push(d);
      totalDist += d;
    }

    let target = r * totalDist;
    for (let i = 0; i < segDists.length; i++) {
      if (target <= segDists[i]) {
        const segRatio = segDists[i] > 0 ? target / segDists[i] : 0;
        return {
          lat: route[i].lat + (route[i + 1].lat - route[i].lat) * segRatio,
          lon: route[i].lon + (route[i + 1].lon - route[i].lon) * segRatio,
          maxSpeed: route[i + 1].maxSpeed || route[i].maxSpeed || 160,
        };
      }
      target -= segDists[i];
    }
    return route[route.length - 1];
  }

  getCountryAtPoint(lat, lon) {
    if (lat >= 49.5 && lat <= 51.5 && lon >= -5.5 && lon <= 1.8) return 'GB';
    if (lat >= 41 && lat <= 51.1 && lon >= -5 && lon <= 9.5) return 'FR';
    if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.4) return 'BE';
    if (lat >= 36 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) return 'IT';
    if (lat >= 47 && lat <= 55.1 && lon >= 5.9 && lon <= 15.1) return 'DE';
    if (lat >= 46 && lat <= 48.3 && lon >= 5.9 && lon <= 10.5) return 'CH';
    if (lat >= 49.4 && lat <= 50.2 && lon >= 5.7 && lon <= 6.4) return 'LU';
    if (lat >= 50.7 && lat <= 53.6 && lon >= 3.3 && lon <= 7.2) return 'NL';
    if (lat >= 36 && lat <= 43.8 && lon >= -9.5 && lon <= 3.4) return 'ES';
    return 'OTHER';
  }

  isDriveLeft(country) {
    return ['FR', 'IT', 'BE', 'GB'].includes(country);
  }

  toSave() {
    const routes = {};
    for (const [key, route] of this.routeCache) {
      routes[key] = route;
    }
    return routes;
  }

  loadFromSave(saved) {
    if (!saved) return;
    for (const [key, route] of Object.entries(saved)) {
      this.routeCache.set(key, route);
    }
  }
}
