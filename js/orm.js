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
        service: el.tags?.service || '',
        name: el.tags?.name || '',
        ref: el.tags?.ref || '',
        geometry: el.geometry.map(p => ({ lat: p.lat, lon: p.lon })),
      }));
  }

  /**
   * Import infrastructure between two points: fetches OSM data and returns
   * voie points (at junctions/endpoints) and tronçons (track segments) with
   * real geometry, speeds, and track counts.
   * Imports ALL parallel tracks (not just the Dijkstra shortest path).
   */
  async importInfrastructure(fromLat, fromLon, toLat, toLon) {
    const distKm = haversine(fromLat, fromLon, toLat, toLon);
    const padding = Math.max(0.5, distKm * 0.005 + 0.2);
    const south = Math.min(fromLat, toLat) - padding;
    const north = Math.max(fromLat, toLat) + padding;
    const west = Math.min(fromLon, toLon) - padding;
    const east = Math.max(fromLon, toLon) + padding;

    const allWays = await this.fetchArea(south, west, north, east);
    if (allWays.length === 0) return { voiePoints: [], troncons: [] };

    // Build node registry
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
      const firstKey = `${geom[0].lat.toFixed(6)},${geom[0].lon.toFixed(6)}`;
      const lastKey = `${geom[geom.length - 1].lat.toFixed(6)},${geom[geom.length - 1].lon.toFixed(6)}`;
      nodes.get(firstKey).edgeCount++;
      nodes.get(lastKey).edgeCount++;
    }
    // Mark intermediate junction nodes
    for (const way of allWays) {
      const geom = way.geometry;
      for (let i = 1; i < geom.length - 1; i++) {
        const key = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const node = nodes.get(key);
        if (node && node.wayIds.size > 1) node.edgeCount += 2;
      }
    }

    // Find main path A→B via Dijkstra
    const graph = this.buildGraph(allWays);
    const startResult = this.findNearestNode(graph, fromLat, fromLon, 5);
    const endResult = this.findNearestNode(graph, toLat, toLon, 5);
    if (!startResult || !endResult) return { voiePoints: [], troncons: [] };

    const path = this.dijkstra(graph, startResult.node.key, endResult.node.key);
    if (!path || path.length < 2) return { voiePoints: [], troncons: [] };

    // Build a polyline of path points for proximity tests
    const pathPoints = path.map(p => ({ lat: p.lat, lon: p.lon }));
    const pathKeys = new Set(path.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`));

    // Determine which ways to import: on the path OR parallel (within 100m)
    // Build a spatial grid of path points for fast proximity lookups
    const PARALLEL_THRESHOLD = 0.1; // km (~100m)
    const GRID_SIZE = 0.002; // ~200m grid cells
    const pathGrid = new Map();
    for (const pp of pathPoints) {
      const gx = Math.floor(pp.lat / GRID_SIZE);
      const gy = Math.floor(pp.lon / GRID_SIZE);
      const gk = `${gx},${gy}`;
      if (!pathGrid.has(gk)) pathGrid.set(gk, []);
      pathGrid.get(gk).push(pp);
    }
    const nearPath = (lat, lon) => {
      const gx = Math.floor(lat / GRID_SIZE);
      const gy = Math.floor(lon / GRID_SIZE);
      let minD = Infinity;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const pts = pathGrid.get(`${gx+dx},${gy+dy}`);
          if (!pts) continue;
          for (const pp of pts) {
            const d = haversine(lat, lon, pp.lat, pp.lon);
            if (d < minD) minD = d;
          }
        }
      }
      return minD;
    };

    const waysToImport = new Set();
    const SERVICE_EXCLUDE = new Set(['siding', 'yard', 'spur', 'crossover']);
    for (const way of allWays) {
      const geom = way.geometry;
      if (geom.length < 2) continue;
      // Check if any point of this way is on the path
      let onPath = false;
      for (const p of geom) {
        if (pathKeys.has(`${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)) { onPath = true; break; }
      }
      if (onPath) { waysToImport.add(way.id); continue; }

      // Skip service tracks (sidings, yards, spurs) for parallel detection
      if (SERVICE_EXCLUDE.has(way.service)) continue;

      // Check if way runs parallel using grid-accelerated proximity
      const step = Math.max(1, Math.floor(geom.length / 6));
      const samples = [];
      for (let si = 0; si < geom.length; si += step) samples.push(geom[si]);
      if (samples[samples.length - 1] !== geom[geom.length - 1]) samples.push(geom[geom.length - 1]);
      let closeCount = 0;
      for (const sp of samples) {
        if (nearPath(sp.lat, sp.lon) < PARALLEL_THRESHOLD) closeCount++;
      }
      if (closeCount >= Math.ceil(samples.length * 0.6)) {
        waysToImport.add(way.id);
      }
    }

    // --- Build node-level adjacency graph from imported ways ---
    const importedWays = allWays.filter(w => waysToImport.has(w.id) && w.geometry.length >= 2);
    const nodeGraph = new Map(); // nodeKey -> [{neighborKey, lat, lon, maxSpeed}]

    for (const way of importedWays) {
      const geom = way.geometry;
      for (let i = 0; i < geom.length - 1; i++) {
        const aKey = `${geom[i].lat.toFixed(6)},${geom[i].lon.toFixed(6)}`;
        const bKey = `${geom[i + 1].lat.toFixed(6)},${geom[i + 1].lon.toFixed(6)}`;
        if (aKey === bKey) continue;
        if (!nodeGraph.has(aKey)) nodeGraph.set(aKey, []);
        if (!nodeGraph.has(bKey)) nodeGraph.set(bKey, []);
        nodeGraph.get(aKey).push({ neighborKey: bKey, lat: geom[i + 1].lat, lon: geom[i + 1].lon, maxSpeed: way.maxSpeed });
        nodeGraph.get(bKey).push({ neighborKey: aKey, lat: geom[i].lat, lon: geom[i].lon, maxSpeed: way.maxSpeed });
      }
    }

    // --- Identify junction nodes (degree != 2, or import start/end) ---
    const junctionNodes = new Set();
    junctionNodes.add(startResult.node.key);
    junctionNodes.add(endResult.node.key);
    for (const [nodeKey, neighbors] of nodeGraph) {
      // Count unique neighbor keys
      const uniqueNeighbors = new Set(neighbors.map(n => n.neighborKey));
      if (uniqueNeighbors.size !== 2) junctionNodes.add(nodeKey);
    }

    // --- Chain-follow between junctions ---
    const resultVoiePoints = [];
    const resultTroncons = [];
    const vpMap = new Map(); // nodeKey -> vpId

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

    const visitedEdges = new Set(); // "a|b" directional
    for (const jNodeKey of junctionNodes) {
      if (!nodeGraph.has(jNodeKey)) continue;
      const neighbors = nodeGraph.get(jNodeKey);
      const uniqueNbs = [...new Set(neighbors.map(n => n.neighborKey))];
      for (const firstNb of uniqueNbs) {
        const edgeKey = `${jNodeKey}|${firstNb}`;
        if (visitedEdges.has(edgeKey)) continue;

        // Chain-follow from jNodeKey through firstNb until next junction
        const chainPoints = [nodes.get(jNodeKey)];
        let prevKey = jNodeKey;
        let curKey = firstNb;
        let chainMaxSpeed = (neighbors.find(n => n.neighborKey === firstNb) || {}).maxSpeed || 100;
        visitedEdges.add(`${jNodeKey}|${firstNb}`);
        visitedEdges.add(`${firstNb}|${jNodeKey}`);

        while (!junctionNodes.has(curKey) && nodeGraph.has(curKey)) {
          const curNode = nodes.get(curKey);
          if (!curNode) break;
          chainPoints.push(curNode);
          const curNeighbors = nodeGraph.get(curKey);
          const uniqueCurNbs = [...new Set(curNeighbors.map(n => n.neighborKey))];
          const nextKey = uniqueCurNbs.find(k => k !== prevKey);
          if (!nextKey) break;
          const nextEdge = curNeighbors.find(n => n.neighborKey === nextKey);
          if (nextEdge) chainMaxSpeed = Math.min(chainMaxSpeed, nextEdge.maxSpeed);
          visitedEdges.add(`${curKey}|${nextKey}`);
          visitedEdges.add(`${nextKey}|${curKey}`);
          prevKey = curKey;
          curKey = nextKey;
        }
        // Add the final junction node
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
          resultTroncons.push({
            pointA: vpAId, pointB: vpBId,
            route: trcRoute, distance: Math.round(dist * 10) / 10
          });
        }
      }
    }

    // Clean up self-loops and duplicate tronçons (no VP merging — keep parallel tracks separate)
    const trcKeySet = new Set();
    const finalVPs = resultVoiePoints.slice();
    const finalTrcs = resultTroncons.filter(trc => {
      if (trc.pointA === trc.pointB) return false;
      const key = [trc.pointA, trc.pointB].sort().join('|');
      if (trcKeySet.has(key)) return false;
      trcKeySet.add(key);
      return true;
    });

    // --- Connect disconnected components to the main graph ---
    // Find main component via BFS, then for each satellite component,
    // connect its nearest VP to the main graph with a single tronçon.
    const vpIdSet = new Set(finalVPs.map(v => v.id));
    const adj = new Map();
    for (const v of finalVPs) adj.set(v.id, []);
    for (const t of finalTrcs) {
      if (vpIdSet.has(t.pointA) && vpIdSet.has(t.pointB)) {
        adj.get(t.pointA).push(t.pointB);
        adj.get(t.pointB).push(t.pointA);
      }
    }
    // BFS from first VP to find main component
    const mainComp = new Set();
    if (finalVPs.length > 0) {
      const bfsQ = [finalVPs[0].id];
      mainComp.add(finalVPs[0].id);
      while (bfsQ.length > 0) {
        const c = bfsQ.shift();
        for (const n of (adj.get(c) || [])) {
          if (!mainComp.has(n)) { mainComp.add(n); bfsQ.push(n); }
        }
      }
    }
    // Connect or discard satellite components
    const mainVPs = finalVPs.filter(v => mainComp.has(v.id));
    const visited = new Set(mainComp);
    const vpById = new Map(finalVPs.map(v => [v.id, v]));
    const discardIds = new Set();
    for (const vp of finalVPs) {
      if (visited.has(vp.id)) continue;
      const satComp = [vp];
      const satQ = [vp.id];
      visited.add(vp.id);
      while (satQ.length > 0) {
        const c = satQ.shift();
        for (const n of (adj.get(c) || [])) {
          if (!visited.has(n)) {
            visited.add(n);
            satQ.push(n);
            const nvp = vpById.get(n);
            if (nvp) satComp.push(nvp);
          }
        }
      }
      // Find closest VP in main component
      let bestDist = Infinity, bestSat = null, bestMain = null;
      for (const sv of satComp) {
        for (const mv of mainVPs) {
          const d = haversine(sv.lat, sv.lon, mv.lat, mv.lon);
          if (d < bestDist) { bestDist = d; bestSat = sv; bestMain = mv; }
        }
      }
      if (bestSat && bestMain && bestDist < 0.2) { // within 200m: connect
        finalTrcs.push({
          pointA: bestSat.id, pointB: bestMain.id,
          route: [
            { lat: bestSat.lat, lon: bestSat.lon, maxSpeed: 30, tracks: 1 },
            { lat: bestMain.lat, lon: bestMain.lon, maxSpeed: 30, tracks: 1 }
          ],
          distance: Math.round(bestDist * 1000) / 1000
        });
        for (const sv of satComp) { mainComp.add(sv.id); mainVPs.push(sv); }
      } else {
        // Too far: discard this satellite (noise from parallel detection)
        for (const sv of satComp) discardIds.add(sv.id);
      }
    }

    // Remove discarded VPs and their tronçons
    let cleanVPs = finalVPs.filter(v => !discardIds.has(v.id));
    let cleanTrcs = finalTrcs.filter(t => !discardIds.has(t.pointA) && !discardIds.has(t.pointB));

    // --- Iterative simplify + prune until stable ---
    // 1. Merge degree-2 VPs (pass-through from way boundaries)
    // 2. Prune short dead-end stubs (<2km, not start/end)
    // 3. Repeat until no changes
    const startVpIdFinal = vpMap.get(startResult.node.key);
    const endVpIdFinal = vpMap.get(endResult.node.key);
    let anyChange = true;
    while (anyChange) {
      anyChange = false;

      // Simplify: merge degree-2 pass-through VPs
      let simplified = true;
      while (simplified) {
        simplified = false;
        const deg2 = new Map();
        for (const v of cleanVPs) deg2.set(v.id, []);
        for (let ti = 0; ti < cleanTrcs.length; ti++) {
          const t = cleanTrcs[ti];
          if (!t) continue;
          if (deg2.has(t.pointA)) deg2.get(t.pointA).push(ti);
          if (deg2.has(t.pointB)) deg2.get(t.pointB).push(ti);
        }
        for (const vp of cleanVPs) {
          if (vp.id === startVpIdFinal || vp.id === endVpIdFinal) continue;
          const trcIndices = deg2.get(vp.id);
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
          anyChange = true;
          break;
        }
      }
      cleanTrcs = cleanTrcs.filter(t => t !== null);

      // Prune: remove short dead-end stubs (<2km, not start/end)
      let prunedAny = true;
      while (prunedAny) {
        prunedAny = false;
        const degP = new Map();
        for (const v of cleanVPs) degP.set(v.id, []);
        for (const t of cleanTrcs) {
          if (degP.has(t.pointA)) degP.get(t.pointA).push(t);
          if (degP.has(t.pointB)) degP.get(t.pointB).push(t);
        }
        for (const vp of cleanVPs) {
          if (vp.id === startVpIdFinal || vp.id === endVpIdFinal) continue;
          const trcs = degP.get(vp.id);
          if (!trcs || trcs.length !== 1) continue;
          // Only prune short stubs (<2km) to avoid removing real parallel track
          if (trcs[0].distance > 2) continue;
          cleanTrcs = cleanTrcs.filter(t => t.pointA !== vp.id && t.pointB !== vp.id);
          cleanVPs = cleanVPs.filter(v => v.id !== vp.id);
          prunedAny = true;
          anyChange = true;
          break;
        }
      }
    }

    // --- Final merge: collapse junction VPs within 15m ---
    // At convergence/divergence points, the two parallel tracks often have
    // separate OSM nodes a few meters apart instead of one shared node.
    // Merge these into a single VP to get the correct aiguillage count.
    const FINAL_MERGE = 0.015; // km (~15m)
    const fMerge = new Map();
    for (let i = 0; i < cleanVPs.length; i++) {
      for (let j = i + 1; j < cleanVPs.length; j++) {
        const a = cleanVPs[i], b = cleanVPs[j];
        if (fMerge.has(b.id)) continue;
        if (haversine(a.lat, a.lon, b.lat, b.lon) < FINAL_MERGE) {
          fMerge.set(b.id, a.id);
        }
      }
    }
    if (fMerge.size > 0) {
      const resolve = id => { while (fMerge.has(id)) id = fMerge.get(id); return id; };
      for (const t of cleanTrcs) {
        t.pointA = resolve(t.pointA);
        t.pointB = resolve(t.pointB);
      }
      const mergedIds = new Set(fMerge.keys());
      cleanVPs = cleanVPs.filter(v => !mergedIds.has(v.id));
      // Remove self-loops and duplicates after merge
      const tks2 = new Set();
      cleanTrcs = cleanTrcs.filter(t => {
        if (t.pointA === t.pointB) return false;
        const k = [t.pointA, t.pointB].sort().join('|');
        if (tks2.has(k)) return false;
        tks2.add(k);
        return true;
      });
      // Run one more simplify pass for any new degree-2 VPs
      let s2 = true;
      while (s2) {
        s2 = false;
        const d2 = new Map();
        for (const v of cleanVPs) d2.set(v.id, []);
        for (let ti = 0; ti < cleanTrcs.length; ti++) {
          const t = cleanTrcs[ti];
          if (!t) continue;
          if (d2.has(t.pointA)) d2.get(t.pointA).push(ti);
          if (d2.has(t.pointB)) d2.get(t.pointB).push(ti);
        }
        for (const vp of cleanVPs) {
          if (vp.id === startVpIdFinal || vp.id === endVpIdFinal) continue;
          const idx = d2.get(vp.id);
          if (!idx || idx.length !== 2) continue;
          const t1 = cleanTrcs[idx[0]], t2 = cleanTrcs[idx[1]];
          if (!t1 || !t2) continue;
          const o1 = t1.pointA === vp.id ? t1.pointB : t1.pointA;
          const o2 = t2.pointA === vp.id ? t2.pointB : t2.pointA;
          if (o1 === o2) continue;
          let r1 = t1.route || []; if (t1.pointB !== vp.id) r1 = [...r1].reverse();
          let r2 = t2.route || []; if (t2.pointA !== vp.id) r2 = [...r2].reverse();
          cleanTrcs[idx[0]] = { pointA: o1, pointB: o2, route: [...r1, ...r2.slice(1)], distance: Math.round((t1.distance + t2.distance) * 10) / 10 };
          cleanTrcs[idx[1]] = null;
          cleanVPs = cleanVPs.filter(v => v.id !== vp.id);
          s2 = true; break;
        }
      }
      cleanTrcs = cleanTrcs.filter(t => t !== null);
    }

    return { voiePoints: cleanVPs, troncons: cleanTrcs };
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

        let dist = haversine(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
        // Penalize non-main tracks to prefer main lines
        const usage = way.usage;
        const svc = way.service;
        if (svc === 'yard' || svc === 'siding' || svc === 'crossover') dist *= 4;
        else if (usage === 'industrial' || usage === 'military') dist *= 5;
        else if (usage === 'branch') dist *= 1.5;
        else if (usage === 'tourism') dist *= 3;
        const edge = { from: aKey, to: bKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks };
        const reverseEdge = { from: bKey, to: aKey, dist, maxSpeed: way.maxSpeed, electrified: way.electrified, tracks: way.tracks };

        nodes.get(aKey).edges.push(edge);
        nodes.get(bKey).edges.push(reverseEdge);
        edges.push(edge);
      }
    }
    return { nodes, edges };
  }

  findNearestNode(graph, lat, lon, maxDistKm = Infinity) {
    let best = null, bestDist = Infinity;
    for (const [, node] of graph.nodes) {
      const d = haversine(lat, lon, node.lat, node.lon);
      if (d < bestDist && d <= maxDistKm) { bestDist = d; best = node; }
    }
    return best ? { node: best, dist: bestDist } : null;
  }

  /**
   * Snap a lat/lon to the nearest railway node.
   * Returns { lat, lon, dist } or null if no node within maxDistKm.
   */
  async snapToRailway(lat, lon, maxDistKm = 2) {
    const padding = Math.max(0.05, maxDistKm * 0.015);
    const ways = await this.fetchArea(
      lat - padding, lon - padding, lat + padding, lon + padding
    );
    if (ways.length === 0) return null;
    const graph = this.buildGraph(ways);
    const result = this.findNearestNode(graph, lat, lon, maxDistKm);
    if (!result) return null;
    return { lat: result.node.lat, lon: result.node.lon, dist: result.dist };
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
    // For short distances (< 0.5km), use tight snap to avoid jumping to wrong track
    const snapRadius = distKm < 0.5 ? 0.3 : 5;
    const startResult = this.findNearestNode(graph, fromLat, fromLon, snapRadius);
    const endResult = this.findNearestNode(graph, toLat, toLon, snapRadius);

    // Very short distance: if both snap to same node or snap failed, use direct route
    if (distKm < 0.5 && (!startResult || !endResult || startResult.node.key === endResult.node.key)) {
      const direct = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, direct);
      return direct;
    }

    if (!startResult || !endResult) {
      console.warn('ORM: No nearby railway nodes found within 5km');
      // Only fallback if absolutely no ORM data
      if (allWays.length === 0) {
        const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
        this.routeCache.set(cacheKey, fallback);
        return fallback;
      }
      // Try with larger search area
      const extraPadding = padding * 2;
      const extraWays = await this.fetchArea(
        Math.min(fromLat, toLat) - extraPadding,
        Math.min(fromLon, toLon) - extraPadding,
        Math.max(fromLat, toLat) + extraPadding,
        Math.max(fromLon, toLon) + extraPadding
      );
      const extraGraph = this.buildGraph(extraWays);
      const startRetry = this.findNearestNode(extraGraph, fromLat, fromLon, 10);
      const endRetry = this.findNearestNode(extraGraph, toLat, toLon, 10);
      if (!startRetry || !endRetry) {
        console.warn('ORM: Still no nodes after expanded search');
        const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
        this.routeCache.set(cacheKey, fallback);
        return fallback;
      }
      const retryPath = this.dijkstra(extraGraph, startRetry.node.key, endRetry.node.key);
      if (retryPath && retryPath.length > 0) {
        this.routeCache.set(cacheKey, retryPath);
        return retryPath;
      }
      const fallback = this.makeFallbackRoute(fromLat, fromLon, toLat, toLon);
      this.routeCache.set(cacheKey, fallback);
      return fallback;
    }

    const startNode = startResult.node;
    const endNode = endResult.node;

    const path = this.dijkstra(graph, startNode.key, endNode.key);
    if (!path || path.length === 0) {
      console.warn('ORM: Dijkstra found no path, trying expanded area');
      // Try expanded area for big stations or complex junctions
      const extraPadding = padding * 2;
      const extraWays = await this.fetchArea(
        Math.min(fromLat, toLat) - extraPadding,
        Math.min(fromLon, toLon) - extraPadding,
        Math.max(fromLat, toLat) + extraPadding,
        Math.max(fromLon, toLon) + extraPadding
      );
      const extraGraph = this.buildGraph(extraWays);
      const s2 = this.findNearestNode(extraGraph, fromLat, fromLon, 10);
      const e2 = this.findNearestNode(extraGraph, toLat, toLon, 10);
      if (s2 && e2) {
        const retryPath = this.dijkstra(extraGraph, s2.node.key, e2.node.key);
        if (retryPath && retryPath.length > 0) {
          this.routeCache.set(cacheKey, retryPath);
          return retryPath;
        }
      }
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
