// simulation.js - High-fidelity railway physics and infrastructure simulation layer
import { cantonLengthKm } from './signaling.js';

/**
 * Precise geodesic distance using Haversine formula.
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pre-analyze a route: compute per-segment distances, speeds, and estimated travel times.
 * @param {Array} route - Array of { lat, lon, maxSpeed, tracks }
 * @param {number} trainMaxSpeed - Train's physical speed limit (km/h)
 * @returns {{ segments: Array, totalDistance: number, estimatedTimeMinutes: number }}
 */
export function analyzeRoute(route, trainMaxSpeed) {
  if (!route || route.length < 2) {
    return { segments: [], totalDistance: 0, estimatedTimeMinutes: 0 };
  }

  const segments = [];
  let totalDistance = 0;
  let totalTimeMinutes = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const distance = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    const segmentMaxSpeed = to.maxSpeed || from.maxSpeed || 160;
    const effectiveSpeed = Math.min(trainMaxSpeed, segmentMaxSpeed);
    const timeMinutes = effectiveSpeed > 0 ? (distance / effectiveSpeed) * 60 : 0;

    totalDistance += distance;
    totalTimeMinutes += timeMinutes;

    segments.push({
      index: i,
      from,
      to,
      distance,
      maxSpeed: segmentMaxSpeed,
      effectiveSpeed,
      timeMinutes,
      cumulativeDistance: totalDistance,
    });
  }

  // No margin — raw physics time for accurate delay calculation
  const estimatedTimeMinutes = Math.round(totalTimeMinutes * 1.0001);

  return { segments, totalDistance, estimatedTimeMinutes };
}

/**
 * Canton (block section) for railway signaling.
 */
class Canton {
  constructor(id, startIndex, endIndex) {
    this.id = id;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.occupiedBy = null;
    this.reservedBy = null;
  }
}

/**
 * Determines the target block length (km) based on line speed (SIG-01).
 * Higher speeds require longer blocks for safe braking distance.
 */
function getBlockLength(speed) {
  return cantonLengthKm(speed);
}

/**
 * Manages the cantonnement (block signaling) system.
 * Prevents two trains from occupying the same block section.
 */
export class CantonManager {
  constructor() {
    this.cantons = new Map();
    this.routeCantons = new Map();
    this.trainCantons = new Map();
  }

  /**
   * Geographic key for a canton, quantized to ~11m precision.
   * Routes sharing physical track produce the same canton keys.
   */
  _geoKey(lat1, lon1, lat2, lon2) {
    // Sort coordinates to ensure symmetric keys: A→B and B→A produce the same canton ID
    // Use 5 decimal places (~1.1m precision) to reduce collision risk in dense areas
    const a = `${lat1.toFixed(5)},${lon1.toFixed(5)}`;
    const b = `${lat2.toFixed(5)},${lon2.toFixed(5)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  _routeKey(route) {
    if (!route || route.length < 2) return null;
    const f = route[0];
    const l = route[route.length - 1];
    return `${f.lat.toFixed(4)},${f.lon.toFixed(4)}-${l.lat.toFixed(4)},${l.lon.toFixed(4)}-${route.length}`;
  }

  /**
   * Create cantons for a route. Returns array of canton assignments.
   * Block boundaries are determined by speed-dependent block lengths.
   */
  createRouteCantons(route) {
    if (!route || route.length < 2) return [];

    const routeKey = this._routeKey(route);
    if (this.routeCantons.has(routeKey)) return this.routeCantons.get(routeKey);

    const assignments = [];
    let blockStartIdx = 0;
    let blockDist = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const segDist = haversineDistance(
        route[i].lat, route[i].lon,
        route[i + 1].lat, route[i + 1].lon
      );
      const speed = route[i + 1].maxSpeed || route[i].maxSpeed || 160;
      const targetBlockLength = getBlockLength(speed);

      blockDist += segDist;

      if (blockDist >= targetBlockLength || i === route.length - 2) {
        const endIdx = i + 1;
        const cantonId = this._geoKey(
          route[blockStartIdx].lat, route[blockStartIdx].lon,
          route[endIdx].lat, route[endIdx].lon
        );

        if (!this.cantons.has(cantonId)) {
          this.cantons.set(cantonId, new Canton(cantonId, blockStartIdx, endIdx));
        }

        assignments.push({
          cantonId,
          startIndex: blockStartIdx,
          endIndex: endIdx,
        });

        blockStartIdx = endIdx;
        blockDist = 0;
      }
    }

    this.routeCantons.set(routeKey, assignments);
    return assignments;
  }

  /**
   * Find which canton assignment a segment index falls into.
   */
  getCantonForSegment(assignments, segmentIndex) {
    for (const a of assignments) {
      if (segmentIndex >= a.startIndex && segmentIndex < a.endIndex) {
        return a;
      }
    }
    return null;
  }

  /**
   * Get the next canton after the one containing the given segment index.
   */
  getNextCanton(assignments, segmentIndex) {
    const current = this.getCantonForSegment(assignments, segmentIndex);
    if (!current) return null;
    const idx = assignments.indexOf(current);
    return (idx >= 0 && idx < assignments.length - 1) ? assignments[idx + 1] : null;
  }

  reserve(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    if (c.occupiedBy && c.occupiedBy !== trainId) return false;
    if (c.reservedBy && c.reservedBy !== trainId) return false;
    c.reservedBy = trainId;
    this._trackCanton(trainId, cantonId);
    return true;
  }

  occupy(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    // Prevent overwriting occupation by another active train
    if (c.occupiedBy && c.occupiedBy !== trainId) {
      if (!this._isTrainGone(c.occupiedBy)) return false;
    }
    c.occupiedBy = trainId;
    c.reservedBy = null;
    this._trackCanton(trainId, cantonId);
    return true;
  }

  release(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return;
    if (c.occupiedBy === trainId) c.occupiedBy = null;
    if (c.reservedBy === trainId) c.reservedBy = null;
    const tc = this.trainCantons.get(trainId);
    if (tc) tc.delete(cantonId);
  }

  isAvailable(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    // Verify occupying/reserving train still exists and is active
    if (c.occupiedBy !== null && c.occupiedBy !== trainId) {
      if (this._isTrainGone(c.occupiedBy)) { c.occupiedBy = null; }
      else return false;
    }
    if (c.reservedBy !== null && c.reservedBy !== trainId) {
      if (this._isTrainGone(c.reservedBy)) { c.reservedBy = null; }
      else return false;
    }
    return true;
  }

  _isTrainGone(id) {
    const svcs = window.game?.scheduleCreator?.services;
    if (!svcs) return false;
    const s = svcs.find(s => s.id === id);
    if (!s) return true;
    if (s.state === 'waiting' || s.state === 'completed') return true;
    if (!s.position) return true;
    // A train stopped at station has already released its cantons
    if (s.state === 'stopped_at_station') return true;
    return false;
  }

  releaseAll(trainId) {
    const ids = this.trainCantons.get(trainId);
    if (!ids) return;
    for (const cid of ids) {
      const c = this.cantons.get(cid);
      if (c) {
        if (c.occupiedBy === trainId) c.occupiedBy = null;
        if (c.reservedBy === trainId) c.reservedBy = null;
      }
    }
    ids.clear();
    this.trainCantons.delete(trainId);
  }

  /**
   * Periodic cleanup: remove cantons that are not occupied/reserved
   * and route cache entries exceeding limit. Call periodically (e.g. every 5 min).
   */
  cleanup() {
    // Evict routeCantons cache if too large (max 200 entries)
    if (this.routeCantons.size > 200) {
      const keys = Array.from(this.routeCantons.keys());
      for (let i = 0; i < keys.length - 100; i++) {
        this.routeCantons.delete(keys[i]);
      }
    }
    // Remove idle cantons (not occupied, not reserved, not tracked by any train)
    const activeCantonIds = new Set();
    for (const [, ids] of this.trainCantons) {
      for (const cid of ids) activeCantonIds.add(cid);
    }
    for (const [cid, c] of this.cantons) {
      if (!c.occupiedBy && !c.reservedBy && !activeCantonIds.has(cid)) {
        this.cantons.delete(cid);
      }
    }
  }

  /**
   * Get signal aspect for a train at a given position.
   * Returns: null (green/clear), 30 (yellow/caution), or 0 (red/stop).
   */
  getSignalAspect(assignments, segmentIndex, trainId) {
    const nextCanton = this.getNextCanton(assignments, segmentIndex);
    if (!nextCanton) return null;

    if (!this.isAvailable(nextCanton.cantonId, trainId)) {
      return 0;
    }

    // Two-block look-ahead for approach signaling
    const nextIdx = assignments.indexOf(
      assignments.find(a => a.startIndex === nextCanton.endIndex)
    );
    if (nextIdx >= 0 && nextIdx < assignments.length) {
      const twoAhead = assignments[nextIdx];
      if (!this.isAvailable(twoAhead.cantonId, trainId)) {
        return 30;
      }
    }

    return null;
  }

  _trackCanton(trainId, cantonId) {
    if (!this.trainCantons.has(trainId)) {
      this.trainCantons.set(trainId, new Set());
    }
    this.trainCantons.get(trainId).add(cantonId);
  }
}
