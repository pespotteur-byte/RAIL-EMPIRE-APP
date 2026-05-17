// OpenRailwayMap data integration via Overpass API — ORM Direct architecture
// Uses OSM way graph directly as the game's routing infrastructure.
// No conversion to intermediate tronçons — the OSM graph IS the network.
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

// --- Binary Heap for Dijkstra (fixes O(n²) sort bug) ---
class MinHeap {
  constructor() { this._data = []; }
  get size() { return this._data.length; }
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) { this._data[0] = last; this._sinkDown(0); }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[i].d >= this._data[p].d) break;
      [this._data[i], this._data[p]] = [this._data[p], this._data[i]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._data[l].d < this._data[smallest].d) smallest = l;
      if (r < n && this._data[r].d < this._data[smallest].d) smallest = r;
      if (smallest === i) break;
      [this._data[i], this._data[smallest]] = [this._data[smallest], this._data[i]];
      i = smallest;
    }
  }
}

export class ORMClient {
  constructor() {
    this.routeCache = new Map();
    this.areaCache = new Map(); // bbox key -> raw ways array
    this.loading = false;

    // ORM Direct: unified graph from all loaded areas
    this._graph = null; // { nodes: Map, adjacency: Map }
    this._ways = new Map(); // wayId -> way object (all loaded ways)
    this._loadedBboxes = []; // track which areas have been loaded
    this._stationsOSM = []; // detected OSM stations
    this._graphDirty = true;
  }

  // ============================================================
  // AREA FETCHING — loads all railway data for a bounding box
  // Also fetches railway stations/halts
  // ============================================================

  async fetchArea(south, west, north, east) {
    const key = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    if (this.areaCache.has(key)) return this.areaCache.get(key);

    // Fetch ways + stations in one query
    const query = `[out:json][timeout:90];(way["railway"="rail"](${south},${west},${north},${east});node["railway"~"^(station|halt)$"](${south},${west},${north},${east}););out body geom;`;

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
        const stations = this._parseStations(data);

        // Register in unified graph
        for (const w of ways) this._ways.set(w.id, w);
        for (const st of stations) {
          if (!this._stationsOSM.find(s => s.id === st.id)) this._stationsOSM.push(st);
        }
        this._graphDirty = true;
        this._loadedBboxes.push({ south, west, north, east });

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
        service: el.tags?.service || '',
        name: el.tags?.name || '',
        ref: el.tags?.ref || '',
        geometry: el.geometry.map(p => ({ lat: p.lat, lon: p.lon })),
        nodeIds: el.nodes || [],
      }));
  }

  _parseStations(data) {
    if (!data.elements) return [];
    return data.elements
      .filter(el => el.type === 'node' && el.tags?.railway && (el.tags.railway === 'station' || el.tags.railway === 'halt'))
      .map(el => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name || `Station ${el.id}`,
        type: el.tags.railway,
      }));
  }

  getOSMStations() { return this._stationsOSM; }

  // ============================================================
  // VIEWPORT LOADING — load infrastructure for visible map area
  // ============================================================

  async loadViewport(south, west, north, east, margin = 0.01) {
    const s = south - margin, w = west - margin;
    const n = north + margin, e = east + margin;

    // Check if already covered
    if (this._isCovered(s, w, n, e)) return;

    this.loading = true;
    try {
      await this.fetchArea(s, w, n, e);
    } finally {
      this.loading = false;
    }
  }

  _isCovered(south, west, north, east) {
    for (const bb of this._loadedBboxes) {
      if (bb.south <= south && bb.west <= west && bb.north >= north && bb.east >= east) return true;
    }
    return false;
  }

  // ============================================================
  // GRAPH BUILDING — builds routing graph from ALL loaded ways
  // No filtering: yards, sidings, spurs all included.
  // ============================================================

  _ensureGraph() {
    if (!this._graphDirty && this._graph) return this._graph;
    this._graph = this._buildUnifiedGraph();
    this._graphDirty = false;
    return this._graph;
  }

  _buildUnifiedGraph() {
    const nodes = new Map(); // nodeKey -> { key, lat, lon, edges: [] }

    for (const [, way] of this._ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;

      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (aKey === bKey) continue;

        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });

        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);

        const edge = { from: aKey, to: bKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks, wayId: way.id };
        const reverseEdge = { from: bKey, to: aKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks, wayId: way.id };

        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
      }
    }
    return { nodes };
  }

  // Legacy buildGraph (used by findRoute)
  buildGraph(ways) {
    const nodes = new Map();
    for (const way of ways) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (!nodes.has(aKey)) nodes.set(aKey, { key: aKey, lat: geom[i].lat, lon: geom[i].lon, edges: [] });
        if (!nodes.has(bKey)) nodes.set(bKey, { key: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, edges: [] });
        const dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const edge = { from: aKey, to: bKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks, wayId: way.id };
        const reverseEdge = { from: bKey, to: aKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks, wayId: way.id };
        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
      }
    }
    return { nodes };
  }

  // ============================================================
  // DIJKSTRA WITH BINARY HEAP — O(E log V)
  // Supports optional waypoint constraints (forced ways)
  // ============================================================

  dijkstra(graph, startKey, endKey, constraintWayIds = null) {
    if (!startKey || !endKey) return null;
    if (!graph.nodes.has(startKey) || !graph.nodes.has(endKey)) return null;

    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    const heap = new MinHeap();

    dist.set(startKey, 0);
    heap.push({ key: startKey, d: 0 });

    while (heap.size > 0) {
      const { key: u } = heap.pop();
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
          heap.push({ key: edge.to, d: newDist });
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
      path.unshift({
        lat: node.lat, lon: node.lon,
        maxSpeed: p.edge.maxSpeed, electrified: p.edge.electrified,
        tracks: p.edge.tracks, wayId: p.edge.wayId,
      });
      current = p.from;
    }
    const startNode = graph.nodes.get(startKey);
    if (startNode) {
      path.unshift({
        lat: startNode.lat, lon: startNode.lon,
        maxSpeed: path[0]?.maxSpeed || 160, electrified: true, tracks: 1,
      });
    }
    return path;
  }

  // Dijkstra with intermediate waypoints (forced routing through specific nodes)
  dijkstraConstrained(graph, startKey, endKey, waypointKeys) {
    if (!waypointKeys || waypointKeys.length === 0) {
      return this.dijkstra(graph, startKey, endKey);
    }
    const allKeys = [startKey, ...waypointKeys, endKey];
    let fullPath = null;
    for (let i = 0; i < allKeys.length - 1; i++) {
      const segment = this.dijkstra(graph, allKeys[i], allKeys[i + 1]);
      if (!segment || segment.length < 2) return null;
      if (!fullPath) {
        fullPath = segment;
      } else {
        fullPath.push(...segment.slice(1));
      }
    }
    return fullPath;
  }

  // ============================================================
  // SNAP TO NEAREST NODE / WAY — for player clicks
  // ============================================================

  findNearestNode(graph, lat, lon, maxDistKm = Infinity) {
    let best = null, bestDist = Infinity;
    for (const [, node] of graph.nodes) {
      const d = haversine(lat, lon, node.lat, node.lon);
      if (d < bestDist && d <= maxDistKm) { bestDist = d; best = node; }
    }
    return best ? { node: best, dist: bestDist } : null;
  }

  snapToNearest(lat, lon, maxDistKm = 2) {
    const graph = this._ensureGraph();
    if (!graph || graph.nodes.size === 0) return null;
    return this.findNearestNode(graph, lat, lon, maxDistKm);
  }

  async snapToRailway(lat, lon, maxDistKm = 2) {
    // First try the unified graph
    const snap = this.snapToNearest(lat, lon, maxDistKm);
    if (snap) return { lat: snap.node.lat, lon: snap.node.lon, dist: snap.dist };

    // Fallback: load area if not loaded
    const padding = Math.max(0.05, maxDistKm * 0.015);
    await this.fetchArea(lat - padding, lon - padding, lat + padding, lon + padding);
    const snap2 = this.snapToNearest(lat, lon, maxDistKm);
    if (!snap2) return null;
    return { lat: snap2.node.lat, lon: snap2.node.lon, dist: snap2.dist };
  }

  // Snap to the nearest point on any way (interpolated on the segment, not just nodes)
  snapToWay(lat, lon, maxDistKm = 0.5) {
    let bestDist = Infinity, bestLat = null, bestLon = null, bestWayId = null;
    for (const [, way] of this._ways) {
      const geom = way.geometry;
      for (let i = 0; i < geom.length - 1; i++) {
        const proj = this._projectOnSegment(lat, lon, geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        const d = haversine(lat, lon, proj.lat, proj.lon);
        if (d < bestDist && d <= maxDistKm) {
          bestDist = d;
          bestLat = proj.lat;
          bestLon = proj.lon;
          bestWayId = way.id;
        }
      }
    }
    if (bestLat === null) return null;
    return { lat: bestLat, lon: bestLon, dist: bestDist, wayId: bestWayId };
  }

  _projectOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { lat: ax, lon: ay };
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { lat: ax + t * dx, lon: ay + t * dy };
  }

  // ============================================================
  // IMPORT INFRASTRUCTURE — "Tracer ligne" mode
  // Now imports ALL ways in the zone, no filtering.
  // Returns voie points (at real junctions) and tronçons.
  // ============================================================

  async importInfrastructure(fromLat, fromLon, toLat, toLon) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.01, distKm * 0.003 + 0.005);
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    if (allWays.length === 0) return { voiePoints: [], troncons: [] };

    // Build node-level adjacency graph from ALL ways (no filtering!)
    const nodes = new Map();
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length; i++) {
        const key = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        if (!nodes.has(key)) {
          nodes.set(key, { key, lat: geom[i].lat, lon: geom[i].lon, wayIds: new Set(), edgeCount: 0 });
        }
        nodes.get(key).wayIds.add(way.id);
      }
    }

    const nodeGraph = new Map();
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (aKey === bKey) continue;
        if (!nodeGraph.has(aKey)) nodeGraph.set(aKey, []);
        if (!nodeGraph.has(bKey)) nodeGraph.set(bKey, []);
        nodeGraph.get(aKey).push({ neighborKey: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, maxSpeed: way.maxSpeed, wayId: way.id });
        nodeGraph.get(bKey).push({ neighborKey: aKey, lat: geom[i].lat, lon: geom[i].lon, maxSpeed: way.maxSpeed, wayId: way.id });
      }
    }

    // Find nearest nodes to A and B
    const graph = this.buildGraph(allWays);
    const startResult = this.findNearestNode(graph, fromLat, fromLon, 5);
    const endResult = this.findNearestNode(graph, toLat, toLon, 5);
    if (!startResult || !endResult) return { voiePoints: [], troncons: [] };

    // Identify junction nodes: degree != 2 (real branching/dead-end) + start/end
    const junctionNodes = new Set();
    junctionNodes.add(startResult.node.key);
    junctionNodes.add(endResult.node.key);
    for (const [nodeKey, neighbors] of nodeGraph) {
      const uniqueNeighbors = new Set(neighbors.map(n => n.neighborKey));
      if (uniqueNeighbors.size !== 2) junctionNodes.add(nodeKey);
    }

    // Chain-follow between junctions to create tronçons
    const resultVoiePoints = [];
    const resultTroncons = [];
    const vpMap = new Map();

    const getOrCreateVP = (nodeKey) => {
      if (vpMap.has(nodeKey)) return vpMap.get(nodeKey);
      const node = nodes.get(nodeKey);
      if (!node) return null;
      const vpId = `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      resultVoiePoints.push({
        id: vpId, lat: node.lat, lon: node.lon,
        voie: '1', stationId: null, linePoint: true
      });
      vpMap.set(nodeKey, vpId);
      return vpId;
    };

    const visitedEdges = new Set();
    for (const jNodeKey of junctionNodes) {
      if (!nodeGraph.has(jNodeKey)) continue;
      const neighbors = nodeGraph.get(jNodeKey);
      // Group neighbors by wayId to preserve parallel tracks
      const neighborsByWay = new Map();
      for (const nb of neighbors) {
        const wk = `${nb.neighborKey}|${nb.wayId}`;
        if (!neighborsByWay.has(wk)) neighborsByWay.set(wk, nb);
      }
      for (const [, nb] of neighborsByWay) {
        const edgeKey = `${jNodeKey}|${nb.neighborKey}|${nb.wayId}`;
        if (visitedEdges.has(edgeKey)) continue;

        // Chain-follow from jNodeKey through nb until next junction
        const chainPoints = [nodes.get(jNodeKey)];
        let prevKey = jNodeKey;
        let curKey = nb.neighborKey;
        let chainMaxSpeed = nb.maxSpeed || 100;
        let chainWayId = nb.wayId;
        visitedEdges.add(`${jNodeKey}|${nb.neighborKey}|${nb.wayId}`);
        visitedEdges.add(`${nb.neighborKey}|${jNodeKey}|${nb.wayId}`);

        while (!junctionNodes.has(curKey) && nodeGraph.has(curKey)) {
          const curNode = nodes.get(curKey);
          if (!curNode) break;
          chainPoints.push(curNode);
          const curNeighbors = nodeGraph.get(curKey);
          // Follow same wayId when possible
          let nextNb = curNeighbors.find(n => n.neighborKey !== prevKey && n.wayId === chainWayId);
          if (!nextNb) {
            const uniqueCurNbs = [...new Set(curNeighbors.filter(n => n.neighborKey !== prevKey).map(n => n.neighborKey))];
            if (uniqueCurNbs.length === 1) {
              nextNb = curNeighbors.find(n => n.neighborKey === uniqueCurNbs[0]);
            }
          }
          if (!nextNb) break;
          chainMaxSpeed = Math.min(chainMaxSpeed, nextNb.maxSpeed);
          visitedEdges.add(`${curKey}|${nextNb.neighborKey}|${nextNb.wayId}`);
          visitedEdges.add(`${nextNb.neighborKey}|${curKey}|${nextNb.wayId}`);
          prevKey = curKey;
          curKey = nextNb.neighborKey;
        }
        const endNode = nodes.get(curKey);
        if (endNode) chainPoints.push(endNode);

        if (chainPoints.length < 2) continue;
        const vpAId = getOrCreateVP(jNodeKey);
        const vpBId = getOrCreateVP(curKey);
        if (vpAId && vpBId && vpAId !== vpBId) {
          const trcRoute = chainPoints.map(p => ({
            lat: p.lat, lon: p.lon, maxSpeed: chainMaxSpeed, tracks: 1
          }));
          const dist = trcRoute.reduce((sum, p, idx) => {
            if (idx === 0) return 0;
            return sum + haversine(trcRoute[idx - 1].lat, trcRoute[idx - 1].lon, p.lat, p.lon);
          }, 0);
          // Keep ALL tronçons — no dédoublonnage of parallel tracks!
          resultTroncons.push({
            pointA: vpAId, pointB: vpBId,
            route: trcRoute, distance: Math.round(dist * 10) / 10
          });
        }
      }
    }

    // Remove only self-loops (pointA === pointB), keep everything else
    const finalTrcs = resultTroncons.filter(trc => trc.pointA !== trc.pointB);

    // Iterative simplify: merge degree-2 pass-through VPs
    let cleanVPs = resultVoiePoints.slice();
    let cleanTrcs = finalTrcs.slice();
    const startVpIdFinal = vpMap.get(startResult.node.key);
    const endVpIdFinal = vpMap.get(endResult.node.key);

    let simplified = true;
    while (simplified) {
      simplified = false;
      const deg = new Map();
      for (const v of cleanVPs) deg.set(v.id, []);
      for (let ti = 0; ti < cleanTrcs.length; ti++) {
        const t = cleanTrcs[ti];
        if (!t) continue;
        if (deg.has(t.pointA)) deg.get(t.pointA).push(ti);
        if (deg.has(t.pointB)) deg.get(t.pointB).push(ti);
      }
      for (const vp of cleanVPs) {
        if (vp.id === startVpIdFinal || vp.id === endVpIdFinal) continue;
        const trcIndices = deg.get(vp.id);
        if (!trcIndices || trcIndices.length !== 2) continue;
        const t1 = cleanTrcs[trcIndices[0]];
        const t2 = cleanTrcs[trcIndices[1]];
        if (!t1 || !t2) continue;
        const other1 = t1.pointA === vp.id ? t1.pointB : t1.pointA;
        const other2 = t2.pointA === vp.id ? t2.pointB : t2.pointA;
        if (other1 === other2) continue;
        let r1 = t1.route || [];
        if (t1.pointB !== vp.id) r1 = [...r1].reverse();
        let r2 = t2.route || [];
        if (t2.pointA !== vp.id) r2 = [...r2].reverse();
        const mergedRoute = [...r1, ...r2.slice(1)];
        const mergedDist = Math.round((t1.distance + t2.distance) * 10) / 10;
        cleanTrcs[trcIndices[0]] = {
          pointA: other1, pointB: other2,
          route: mergedRoute, distance: mergedDist
        };
        cleanTrcs[trcIndices[1]] = null;
        cleanVPs = cleanVPs.filter(v => v.id !== vp.id);
        simplified = true;
        break;
      }
      cleanTrcs = cleanTrcs.filter(t => t !== null);
    }

    // NO pruning of short dead-ends — keep everything!
    // NO dédoublonnage — parallel tracks between same junctions are valid!
    // NO final merge of close VPs — each OSM node is distinct!

    return { voiePoints: cleanVPs, troncons: cleanTrcs };
  }

  // ============================================================
  // ROUTE FINDING — uses unified graph or area-specific graph
  // ============================================================

  async findRoute(fromLat, fromLon, toLat, toLon) {
    const cacheKey = `${fromLat.toFixed(4)},${fromLon.toFixed(4)}-${toLat.toFixed(4)},${toLon.toFixed(4)}`;
    if (this.routeCache.has(cacheKey)) return this.routeCache.get(cacheKey);

    // First try the unified graph (pre-loaded areas)
    const uGraph = this._ensureGraph();
    if (uGraph && uGraph.nodes.size > 0) {
      const s = this.findNearestNode(uGraph, fromLat, fromLon, 5);
      const e = this.findNearestNode(uGraph, toLat, toLon, 5);
      if (s && e) {
        const path = this.dijkstra(uGraph, s.node.key, e.node.key);
        if (path && path.length >= 2) {
          this.routeCache.set(cacheKey, path);
          return path;
        }
      }
    }

    // Fallback: load area and try
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.3, distKm * 0.003 + 0.1);
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    if (allWays.length === 0) {
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    // Use the unified graph (now includes new area)
    const graph = this._ensureGraph();
    const snapRadius = distKm < 0.5 ? 0.3 : 5;
    const startResult = this.findNearestNode(graph, fromLat, fromLon, snapRadius);
    const endResult = this.findNearestNode(graph, toLat, toLon, snapRadius);

    if (distKm < 0.5 && (!startResult || !endResult || startResult.node.key === endResult.node.key)) {
      const direct = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, direct);
      return direct;
    }

    if (!startResult || !endResult) {
      // Try with larger padding
      const extraPadding = padding * 2;
      await this.fetchArea(
        Math.min(fromLat, toLat) - extraPadding,
        Math.min(fromLon, toLon) - extraPadding,
        Math.max(fromLat, toLat) + extraPadding,
        Math.max(fromLon, toLon) + extraPadding
      );
      const graph2 = this._ensureGraph();
      const s2 = this.findNearestNode(graph2, fromLat, fromLon, 10);
      const e2 = this.findNearestNode(graph2, toLat, toLon, 10);
      if (s2 && e2) {
        const retryPath = this.dijkstra(graph2, s2.node.key, e2.node.key);
        if (retryPath && retryPath.length > 0) {
          this.routeCache.set(cacheKey, retryPath);
          return retryPath;
        }
      }
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const path = this.dijkstra(graph, startResult.node.key, endResult.node.key);
    if (!path || path.length === 0) {
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    this.routeCache.set(cacheKey, path);
    return path;
  }

  // Route with waypoint constraints (player forced routing)
  async findConstrainedRoute(fromLat, fromLon, toLat, toLon, waypointLatLons) {
    // Load area covering all points
    let minLat = Math.min(fromLat, toLat), maxLat = Math.max(fromLat, toLat);
    let minLon = Math.min(fromLon, toLon), maxLon = Math.max(fromLon, toLon);
    for (const wp of waypointLatLons) {
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
      minLon = Math.min(minLon, wp.lon);
      maxLon = Math.max(maxLon, wp.lon);
    }
    const padding = 0.01;
    await this.fetchArea(minLat - padding, minLon - padding, maxLat + padding, maxLon + padding);

    const graph = this._ensureGraph();
    if (!graph || graph.nodes.size === 0) {
      return this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const startSnap = this.findNearestNode(graph, fromLat, fromLon, 5);
    const endSnap = this.findNearestNode(graph, toLat, toLon, 5);
    if (!startSnap || !endSnap) {
      return this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const waypointKeys = waypointLatLons.map(wp => {
      const snap = this.findNearestNode(graph, wp.lat, wp.lon, 2);
      return snap ? snap.node.key : null;
    }).filter(k => k !== null);

    const path = this.dijkstraConstrained(graph, startSnap.node.key, endSnap.node.key, waypointKeys);
    return path || this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
  }

  makeFallbackRoute(fromLat, fromLon, toLat, toLon) {
    const steps = 20;
    const route = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      route.push({
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t,
        maxSpeed: 160, electrified: true, tracks: 2,
      });
    }
    return route;
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

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
        from: route[i - 1], to: route[i],
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
    if (segments.length === 0) return 1;

    // Merge consecutive segments into speed zones (avoid per-point accel/decel)
    const zones = [];
    for (const seg of segments) {
      const vMax = Math.min(rameMaxSpeed, seg.maxSpeed);
      if (vMax <= 0) continue;
      if (zones.length > 0 && zones[zones.length - 1].vMax === vMax) {
        zones[zones.length - 1].distKm += seg.distance;
      } else {
        zones.push({ vMax, distKm: seg.distance });
      }
    }
    if (zones.length === 0) return 1;

    // Total distance for the whole route
    const totalDistKm = zones.reduce((s, z) => s + z.distKm, 0);
    if (totalDistKm <= 0) return 1;

    // Accel/decel only at start and end of the full journey
    const accelRate = 1.8; // km/h per second
    const cruiseSpeed = zones.length === 1 ? zones[0].vMax : Math.min(rameMaxSpeed, Math.max(...zones.map(z => z.vMax)));

    // Time for each zone at its speed limit (cruise only)
    let totalSeconds = 0;
    for (const z of zones) {
      totalSeconds += (z.distKm / z.vMax) * 3600;
    }

    // Add acceleration at start (0 -> first zone speed) and deceleration at end (last zone speed -> 0)
    const startSpeed = zones[0].vMax;
    const endSpeed = zones[zones.length - 1].vMax;
    const tAccelStart = startSpeed / accelRate;
    const tDecelEnd = endSpeed / accelRate;
    // During acceleration, we travel slower than cruise: lost time = tAccel/2
    totalSeconds += tAccelStart / 2;
    totalSeconds += tDecelEnd / 2;

    // Add time for speed transitions between zones (braking/accelerating)
    for (let i = 1; i < zones.length; i++) {
      const speedDiff = Math.abs(zones[i].vMax - zones[i - 1].vMax);
      if (speedDiff > 0) {
        const tTransition = speedDiff / accelRate;
        totalSeconds += tTransition / 2;
      }
    }

    let totalMinutes = totalSeconds / 60;
    // 10% margin for signals, junctions, minor slowdowns
    totalMinutes *= 1.10;
    return Math.ceil(totalMinutes);
  }

  generateSignalBlocks(route) {
    const segments = this.getRouteSegments(route);
    const signals = [];
    const totalDist = this.getRouteDistance(route);
    if (totalDist <= 0) return signals;
    let accDist = 0, lastSignalDist = 0;
    for (const seg of segments) {
      const speed = seg.maxSpeed;
      let blockLength;
      if (speed <= 60) blockLength = 0.4;
      else if (speed <= 80) blockLength = 0.6;
      else if (speed <= 120) blockLength = 0.8;
      else if (speed <= 160) blockLength = 1.0;
      else if (speed <= 220) blockLength = 1.5;
      else blockLength = 1.8;
      accDist += seg.distance;
      while (accDist - lastSignalDist >= blockLength) {
        lastSignalDist += blockLength;
        const ratio = lastSignalDist / totalDist;
        const pos = this.getPointAtRatio(route, ratio);
        signals.push({ km: lastSignalDist, lat: pos.lat, lon: pos.lon, maxSpeed: speed, blockLength });
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
    return {
      routes,
      loadedBboxes: this._loadedBboxes,
    };
  }

  loadFromSave(saved) {
    if (!saved) return;
    // Support both old format (just routes) and new format (routes + bboxes)
    if (saved.routes) {
      for (const [key, route] of Object.entries(saved.routes)) {
        this.routeCache.set(key, route);
      }
    } else if (typeof saved === 'object' && !Array.isArray(saved)) {
      // Old format: saved is directly the routes map
      for (const [key, route] of Object.entries(saved)) {
        this.routeCache.set(key, route);
      }
    }
    if (saved.loadedBboxes) {
      this._loadedBboxes = saved.loadedBboxes;
    }
  }

  // Reload OSM data for previously loaded areas (after save load)
  async reloadAreas() {
    for (const bb of this._loadedBboxes) {
      await this.fetchArea(bb.south, bb.west, bb.north, bb.east);
    }
  }
}
