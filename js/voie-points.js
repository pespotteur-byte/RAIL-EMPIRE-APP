// voie-points.js - Voie Point system for track visualization and switching
// Voie points are unnamed geographic markers that define which voie (track) a train is on
// Troncons connect voie points and/or stations with ORM-traced routes

import { haversineDistance } from './simulation.js?v=1784772853';

let nextVoiePointId = 1;
let nextTronconId = 1;

export class VoiePoint {
  constructor(data) {
    this.id = data.id || `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.lat = data.lat || 0;
    this.lon = data.lon || 0;
    this.voie = data.voie || '1'; // which voie this point belongs to
    this.stationId = data.stationId || null; // linked station (voie à quai)
    this.occupiedBy = data.occupiedBy || null; // trainId occupying this voie point
    this.lineGroupId = data.lineGroupId || null; // import group for bulk delete
    this.linePoint = data.linePoint || false; // imported point, hidden in schedule creator
  }
}

export class Troncon {
  constructor(data) {
    this.id = data.id || `trc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Endpoints can be station IDs or voie point IDs
    this.pointA = data.pointA; // station id or voie point id
    this.pointB = data.pointB; // station id or voie point id
    this.route = data.route || []; // ORM route array [{lat, lon, maxSpeed, tracks}, ...]
    this.distance = data.distance || 0; // km
    this.occupiedBy = null; // trainId currently occupying this troncon
    // TRV-01 : usure de la voie (0-100)
    this.wear = data.wear != null ? data.wear : 0;
    this.name = data.name || '';
    this.ref = data.ref || '';
    this.trackRef = data.trackRef || '';
    this.lineGroupId = data.lineGroupId || null; // import group for bulk delete
  }
}

export class VoiePointManager {
  constructor() {
    this.voiePoints = [];
    this.troncons = [];
    this._vpMap = new Map(); // O(1) lookup by id
    this._trcMap = new Map(); // O(1) lookup by id
    this.onChange = null; // R-08 : callback quand les tronçons/aiguillages changent
  }

  _notifyChange() {
    if (typeof this.onChange === 'function') {
      try { this.onChange(); } catch (e) { /* ignore */ }
    }
  }

  _rebuildMaps() {
    this._vpMap.clear();
    for (const vp of this.voiePoints) this._vpMap.set(vp.id, vp);
    this._trcMap.clear();
    for (const trc of this.troncons) this._trcMap.set(trc.id, trc);
  }

  // --- Voie Points ---

  addVoiePoint(data) {
    const vp = new VoiePoint(data);
    this.voiePoints.push(vp);
    this._vpMap.set(vp.id, vp);
    this._notifyChange();
    return vp;
  }

  removeVoiePoint(id) {
    // Also remove all troncons connected to this point
    this.troncons = this.troncons.filter(t => t.pointA !== id && t.pointB !== id);
    this.voiePoints = this.voiePoints.filter(vp => vp.id !== id);
    this._vpMap.delete(id);
    this._rebuildMaps();
    this._notifyChange();
  }

  deleteLineGroup(lineGroupId) {
    if (!lineGroupId) return 0;
    const vpsBefore = this.voiePoints.length;
    const trcsBefore = this.troncons.length;
    this.troncons = this.troncons.filter(t => t.lineGroupId !== lineGroupId);
    this.voiePoints = this.voiePoints.filter(vp => vp.lineGroupId !== lineGroupId);
    this._rebuildMaps();
    this._notifyChange();
    return (vpsBefore - this.voiePoints.length) + (trcsBefore - this.troncons.length);
  }

  getVoiePointById(id) {
    return this._vpMap.get(id) || null;
  }

  getAll() {
    return this.voiePoints;
  }

  getStationVoiePoints(stationId) {
    return this.voiePoints.filter(vp => vp.stationId === stationId);
  }

  getStationVoiePoint(stationId, voie) {
    return this.voiePoints.find(vp => vp.stationId === stationId && vp.voie === voie);
  }

  // --- Voie Point Occupation (station platforms) ---

  occupyVoiePoint(vpId, trainId) {
    const vp = this.getVoiePointById(vpId);
    if (vp) vp.occupiedBy = trainId;
  }

  releaseVoiePoint(vpId, trainId) {
    const vp = this.getVoiePointById(vpId);
    if (vp && vp.occupiedBy === trainId) vp.occupiedBy = null;
  }

  releaseAllVoiePointsForTrain(trainId) {
    for (const vp of this.voiePoints) {
      if (vp.occupiedBy === trainId) vp.occupiedBy = null;
    }
  }

  isVoiePointOccupied(vpId, excludeTrainId) {
    const vp = this.getVoiePointById(vpId);
    if (!vp) return false;
    return vp.occupiedBy !== null && vp.occupiedBy !== excludeTrainId;
  }

  // --- Troncons ---

  addTroncon(data) {
    const trc = new Troncon(data);
    this.troncons.push(trc);
    this._trcMap.set(trc.id, trc);
    this._notifyChange();
    return trc;
  }

  removeTroncon(id) {
    this.troncons = this.troncons.filter(t => t.id !== id);
    this._trcMap.delete(id);
    this._notifyChange();
  }

  getTronconById(id) {
    return this._trcMap.get(id) || null;
  }

  getAllTroncons() {
    return this.troncons;
  }

  getTronconsForPoint(pointId) {
    return this.troncons.filter(t => t.pointA === pointId || t.pointB === pointId);
  }

  // --- Troncon voie helpers ---

  getTronconVoies(troncon) {
    const voies = new Set();
    const vpA = this.getVoiePointById(troncon.pointA);
    const vpB = this.getVoiePointById(troncon.pointB);
    if (vpA) voies.add(vpA.voie);
    if (vpB) voies.add(vpB.voie);
    return voies;
  }

  tronconsShareVoie(trcA, trcB) {
    const voiesA = this.getTronconVoies(trcA);
    const voiesB = this.getTronconVoies(trcB);
    for (const v of voiesA) {
      if (voiesB.has(v)) return true;
    }
    return false;
  }

  // --- Occupation ---

  occupyTroncon(tronconId, trainId) {
    const trc = this.getTronconById(tronconId);
    if (trc) trc.occupiedBy = trainId;
  }

  releaseTroncon(tronconId, trainId) {
    const trc = this.getTronconById(tronconId);
    if (trc && trc.occupiedBy === trainId) trc.occupiedBy = null;
  }

  releaseAllForTrain(trainId) {
    for (const trc of this.troncons) {
      if (trc.occupiedBy === trainId) trc.occupiedBy = null;
    }
  }

  isTronconOccupied(tronconId, excludeTrainId) {
    const trc = this.getTronconById(tronconId);
    if (!trc) return false;
    if (!trc.occupiedBy || trc.occupiedBy === excludeTrainId) return false;
    // Verify the occupying train still exists, is active, and is still near this troncon
    const services = window.game?.scheduleCreator?.services;
    if (services) {
      const occupier = services.find(s => s.id === trc.occupiedBy);
      if (!occupier || occupier.state === 'waiting' || occupier.state === 'completed' || !occupier.position) {
        trc.occupiedBy = null;
        return false;
      }
      // Staleness check: if occupier has moved far from this troncon, release it
      if (occupier.position && trc.route && trc.route.length >= 2) {
        const vpA = this.getVoiePointById(trc.pointA);
        const vpB = this.getVoiePointById(trc.pointB);
        if (vpA && vpB) {
          const dA = haversineDistance(occupier.position.lat, occupier.position.lon, vpA.lat, vpA.lon);
          const dB = haversineDistance(occupier.position.lat, occupier.position.lon, vpB.lat, vpB.lon);
          const trcLen = haversineDistance(vpA.lat, vpA.lon, vpB.lat, vpB.lon);
          if (Math.min(dA, dB) > trcLen + 0.5) {
            trc.occupiedBy = null;
            return false;
          }
        }
      }
    }
    return true;
  }

  // --- Cisaillement (crossing detection) ---

  /**
   * Check if a troncon's ORM route physically crosses any other occupied troncon's route.
   * Returns the first blocking troncon, or null if clear.
   * @param {string} tronconId - troncon to check
   * @param {string} trainId - train trying to use this troncon
   * @returns {Troncon|null} - blocking troncon or null
   */
  checkCisaillement(tronconId, trainId) {
    const trc = this.getTronconById(tronconId);
    if (!trc || !trc.route || trc.route.length < 2) return null;

    // Pre-compute bounding box of current troncon for fast rejection
    let tMinLat = Infinity, tMaxLat = -Infinity, tMinLon = Infinity, tMaxLon = -Infinity;
    for (const p of trc.route) {
      if (p.lat < tMinLat) tMinLat = p.lat;
      if (p.lat > tMaxLat) tMaxLat = p.lat;
      if (p.lon < tMinLon) tMinLon = p.lon;
      if (p.lon > tMaxLon) tMaxLon = p.lon;
    }
    const margin = 0.01; // ~1km margin

    for (const other of this.troncons) {
      if (other.id === tronconId) continue;
      if (!other.occupiedBy || other.occupiedBy === trainId) continue;
      // Verify the occupying train still exists and is active
      const services = window.game?.scheduleCreator?.services;
      if (services) {
        const occ = services.find(s => s.id === other.occupiedBy);
        if (!occ || occ.state === 'waiting' || occ.state === 'completed' || !occ.position) {
          other.occupiedBy = null;
          continue;
        }
      }
      if (!other.route || other.route.length < 2) continue;
      // Quick bounding box rejection
      const oFirst = other.route[0], oLast = other.route[other.route.length - 1];
      const oMinLat = Math.min(oFirst.lat, oLast.lat);
      const oMaxLat = Math.max(oFirst.lat, oLast.lat);
      const oMinLon = Math.min(oFirst.lon, oLast.lon);
      const oMaxLon = Math.max(oFirst.lon, oLast.lon);
      if (oMaxLat < tMinLat - margin || oMinLat > tMaxLat + margin ||
          oMaxLon < tMinLon - margin || oMinLon > tMaxLon + margin) continue;
      // Different voies = different physical tracks, no conflict
      if (!this.tronconsShareVoie(trc, other)) continue;

      if (this._routesCross(trc.route, other.route)) {
        return other;
      }
    }
    return null;
  }

  /**
   * Check if two ORM routes physically cross each other.
   * Uses segment-segment intersection test.
   */
  _routesCross(routeA, routeB) {
    // Check proximity first — if routes are far apart, skip expensive intersection
    const midA = routeA[Math.floor(routeA.length / 2)];
    const midB = routeB[Math.floor(routeB.length / 2)];
    const roughDist = haversineDistance(midA.lat, midA.lon, midB.lat, midB.lon);
    if (roughDist > 50) return false; // > 50km apart, no crossing possible

    // Check if any segments intersect (cap iterations to prevent O(n²) explosion)
    const maxSegsA = Math.min(routeA.length - 1, 200);
    const maxSegsB = Math.min(routeB.length - 1, 200);
    const stepA = Math.max(1, Math.floor((routeA.length - 1) / maxSegsA));
    const stepB = Math.max(1, Math.floor((routeB.length - 1) / maxSegsB));
    for (let i = 0; i < routeA.length - 1; i += stepA) {
      for (let j = 0; j < routeB.length - 1; j += stepB) {
        if (this._segmentsIntersect(
          routeA[i].lat, routeA[i].lon, routeA[i + 1].lat, routeA[i + 1].lon,
          routeB[j].lat, routeB[j].lon, routeB[j + 1].lat, routeB[j + 1].lon
        )) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 2D line segment intersection test using cross products.
   */
  _segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const a1 = [ax1, ay1], a2 = [ax2, ay2];
    const b1 = [bx1, by1], b2 = [bx2, by2];

    const d1 = cross(b1, b2, a1);
    const d2 = cross(b1, b2, a2);
    const d3 = cross(a1, a2, b1);
    const d4 = cross(a1, a2, b2);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    // Collinear / endpoint touching — skip (shared endpoints are not crossings)
    return false;
  }

  // --- Tronçon graph routing (Dijkstra on player's infrastructure) ---

  /**
   * Find a route through the tronçon graph from point A to point B.
   * Returns the concatenated route geometry or null if no path exists.
   * @param {number} fromLat
   * @param {number} fromLon
   * @param {number} toLat
   * @param {number} toLon
   * @returns {{ route: Array, tronconIds: Array }|null}
   */
  findTronconRoute(fromLat, fromLon, toLat, toLon) {
    if (this.troncons.length === 0) return null;

    // Find nearest voie points to start and end
    const startVP = this._findNearestVoiePoint(fromLat, fromLon, 1.0);
    const endVP = this._findNearestVoiePoint(toLat, toLon, 1.0);
    if (!startVP || !endVP) return null;
    if (startVP.id === endVP.id) return null;

    // Build adjacency: vpId -> [{ neighborVpId, troncon, reversed }]
    const adj = new Map();
    for (const trc of this.troncons) {
      if (!trc.route || trc.route.length < 2) continue;
      if (!adj.has(trc.pointA)) adj.set(trc.pointA, []);
      if (!adj.has(trc.pointB)) adj.set(trc.pointB, []);
      adj.get(trc.pointA).push({ neighbor: trc.pointB, troncon: trc, reversed: false });
      adj.get(trc.pointB).push({ neighbor: trc.pointA, troncon: trc, reversed: true });
    }

    if (!adj.has(startVP.id) || !adj.has(endVP.id)) return null;

    // Dijkstra with binary heap — O(E log V)
    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    dist.set(startVP.id, 0);

    // MinHeap inlined for this module (no import needed)
    const heap = [];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[i].d >= heap[p].d) break;
        [heap[i], heap[p]] = [heap[p], heap[i]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let s = i, l = 2 * i + 1, r = 2 * i + 2;
          if (l < heap.length && heap[l].d < heap[s].d) s = l;
          if (r < heap.length && heap[r].d < heap[s].d) s = r;
          if (s === i) break;
          [heap[i], heap[s]] = [heap[s], heap[i]];
          i = s;
        }
      }
      return top;
    };

    push({ id: startVP.id, d: 0 });

    while (heap.length > 0) {
      const { id: u } = pop();
      if (visited.has(u)) continue;
      visited.add(u);
      if (u === endVP.id) break;

      const neighbors = adj.get(u) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.neighbor)) continue;
        const newDist = (dist.get(u) || 0) + (edge.troncon.distance || 1);
        if (newDist < (dist.get(edge.neighbor) || Infinity)) {
          dist.set(edge.neighbor, newDist);
          prev.set(edge.neighbor, { from: u, troncon: edge.troncon, reversed: edge.reversed });
          push({ id: edge.neighbor, d: newDist });
        }
      }
    }

    if (!prev.has(endVP.id)) return null;

    // Reconstruct path
    const tronconIds = [];
    const routeSegments = [];
    let current = endVP.id;
    while (current !== startVP.id) {
      const p = prev.get(current);
      if (!p) return null;
      tronconIds.unshift(p.troncon.id);
      const geom = p.reversed ? [...p.troncon.route].reverse() : [...p.troncon.route];
      routeSegments.unshift(geom);
      current = p.from;
    }

    // Concatenate route segments, removing duplicate junction points
    const fullRoute = [];
    for (let s = 0; s < routeSegments.length; s++) {
      const seg = routeSegments[s];
      const startIdx = (s > 0 && fullRoute.length > 0) ? 1 : 0; // skip first point (duplicate of prev segment's last)
      for (let i = startIdx; i < seg.length; i++) {
        fullRoute.push(seg[i]);
      }
    }

    return { route: fullRoute, tronconIds };
  }

  _findNearestVoiePoint(lat, lon, maxDistKm) {
    let best = null, bestDist = Infinity;
    // Pre-filter with bounding box to skip distant points (flat approx)
    const latRange = maxDistKm / 111;
    const lonRange = maxDistKm / (111 * Math.cos(lat * Math.PI / 180));
    for (const vp of this.voiePoints) {
      if (Math.abs(vp.lat - lat) > latRange || Math.abs(vp.lon - lon) > lonRange) continue;
      const d = haversineDistance(lat, lon, vp.lat, vp.lon);
      if (d < bestDist && d <= maxDistKm) { bestDist = d; best = vp; }
    }
    return best;
  }

  // --- Voie lookup for train position ---

  /**
   * Find which voie a train is on based on its position and nearby voie points.
   * Returns the voie string or null if no voie point is close enough.
   * @param {object} position - {lat, lon}
   * @param {number} maxDistKm - max distance to consider (default 5km)
   * @returns {string|null} voie name
   */
  getVoieAtPosition(position, maxDistKm = 0.5) {
    if (!position || this.voiePoints.length === 0) return null;

    let closestVP = null;
    let closestDist = Infinity;

    for (const vp of this.voiePoints) {
      const dist = haversineDistance(position.lat, position.lon, vp.lat, vp.lon);
      if (dist < closestDist && dist <= maxDistKm) {
        closestDist = dist;
        closestVP = vp;
      }
    }

    return closestVP ? closestVP.voie : null;
  }

  /**
   * Get the troncon a train is currently on, based on position.
   * @param {object} position - {lat, lon}
   * @param {number} maxDistKm - max distance to route to consider
   * @returns {Troncon|null}
   */
  getTronconAtPosition(position, maxDistKm = 2, filterVoie = null) {
    if (!position) return null;

    // Quick bounding box pre-filter (~0.01° ≈ 1.1km)
    const margin = maxDistKm / 111;
    const lat = position.lat;
    const lon = position.lon;

    let bestTrc = null;
    let bestDist = Infinity;

    for (const trc of this.troncons) {
      if (!trc.route || trc.route.length < 2) continue;

      // Bounding box pre-check using troncon endpoints
      const vpA = this.getVoiePointById(trc.pointA);
      const vpB = this.getVoiePointById(trc.pointB);
      if (vpA && vpB) {
        const minLat = Math.min(vpA.lat, vpB.lat) - margin;
        const maxLat = Math.max(vpA.lat, vpB.lat) + margin;
        const minLon = Math.min(vpA.lon, vpB.lon) - margin;
        const maxLon = Math.max(vpA.lon, vpB.lon) + margin;
        if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) continue;
      }

      // Filter by voie if specified
      if (filterVoie) {
        const voies = this.getTronconVoies(trc);
        if (!voies.has(filterVoie)) continue;
      }

      // Sample route points (skip some for speed if route is long)
      const step = trc.route.length > 20 ? Math.floor(trc.route.length / 10) : 1;
      for (let i = 0; i < trc.route.length; i += step) {
        const pt = trc.route[i];
        const dist = haversineDistance(position.lat, position.lon, pt.lat, pt.lon);
        if (dist < bestDist && dist <= maxDistKm) {
          bestDist = dist;
          bestTrc = trc;
        }
      }
    }

    return bestTrc;
  }

  // --- Save / Load ---

  toSave() {
    return {
      voiePoints: this.voiePoints.map(vp => {
        const o = { id: vp.id, la: Math.round(vp.lat * 1e5), lo: Math.round(vp.lon * 1e5), v: vp.voie };
        if (vp.stationId) o.s = vp.stationId;
        if (vp.lineGroupId) o.lg = vp.lineGroupId;
        if (vp.linePoint) o.lp = true;
        return o;
      }),
      troncons: this.troncons.map(t => {
        const o = { id: t.id, a: t.pointA, b: t.pointB, d: Math.round(t.distance * 100) / 100, w: Math.round((t.wear || 0) * 100) / 100 };
        if (t.name) o.n = t.name;
        if (t.ref) o.r = t.ref;
        if (t.trackRef) o.tr = t.trackRef;
        if (t.lineGroupId) o.lg = t.lineGroupId;
        // Delta-encoded route
        if (Array.isArray(t.route) && t.route.length > 0) {
          let pts = t.route;
          if (pts.length > 100) {
            const step = Math.ceil(pts.length / 80);
            const sampled = [pts[0]];
            for (let i = step; i < pts.length - 1; i += step) sampled.push(pts[i]);
            sampled.push(pts[pts.length - 1]);
            pts = sampled;
          }
          const r = [];
          let prevLat = 0, prevLon = 0;
          for (let i = 0; i < pts.length; i++) {
            const lat5 = Math.round(pts[i].lat * 1e5);
            const lon5 = Math.round(pts[i].lon * 1e5);
            if (i === 0) { r.push(lat5, lon5); }
            else { r.push(lat5 - prevLat, lon5 - prevLon); }
            prevLat = lat5; prevLon = lon5;
          }
          o.r = r;
        }
        return o;
      }),
      _v: 2,
    };
  }

  loadFromSave(data) {
    if (!data) return;
    const v2 = data._v === 2;
    this.voiePoints = (data.voiePoints || []).map(d => {
      if (v2) return new VoiePoint({ id: d.id, lat: d.la / 1e5, lon: d.lo / 1e5, voie: d.v, stationId: d.s || null, lineGroupId: d.lg || null, linePoint: d.lp || false });
      return new VoiePoint(d);
    });
    this.troncons = (data.troncons || []).map(d => {
      if (v2) {
        let route = [];
        if (d.r?.length >= 2) {
          let lat = d.r[0], lon = d.r[1];
          route.push({ lat: lat / 1e5, lon: lon / 1e5 });
          for (let i = 2; i < d.r.length; i += 2) {
            lat += d.r[i]; lon += d.r[i + 1];
            route.push({ lat: lat / 1e5, lon: lon / 1e5 });
          }
        }
        return new Troncon({ id: d.id, pointA: d.a, pointB: d.b, route, distance: d.d, wear: d.w || 0, lineGroupId: d.lg || null, name: d.n || '', ref: d.r || '', trackRef: d.tr || '' });
      }
      return new Troncon(d);
    });

    // Rebuild O(1) lookup maps
    this._rebuildMaps();
  }
}
