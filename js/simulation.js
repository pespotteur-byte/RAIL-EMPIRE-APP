// simulation.js - High-fidelity railway physics and infrastructure simulation layer
import { blockLengthKm } from './signaling.js';

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

// Midnight-safe minute difference, clamped to [-720, 720]
export function timeDiff(a, b) {
  let d = a - b;
  if (d > 720) d -= 1440;
  else if (d < -720) d += 1440;
  return d;
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
    // Annexe 3A — absence d'indication de vitesse → 30 km/h.
    const segmentMaxSpeed = to.maxSpeed || from.maxSpeed || 30;
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
  }
}

/**
 * Determines the target block length (km) based on line speed (SIG-01).
 * Higher speeds require longer blocks for safe braking distance.
 */
function getBlockLength(speed) {
  return blockLengthKm(speed);
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
    this.currentTime = 0;
  }

  setTime(timeOfDay) {
    this.currentTime = timeOfDay;
  }

  setTrainSeparation(trainId, minutes) {
    // No-op : l'écart temporel fixe est supprimé, c'est l'occupation des cantons
    // ETCS/MA qui gère l'espacement entre trains.
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
      // Annexe 3A — absence d'indication de vitesse → 30 km/h.
      const speed = route[i + 1].maxSpeed || route[i].maxSpeed || 30;
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

    // Build an O(1) segment -> assignment lookup so getCantonForSegment never scans
    const segmentToCanton = new Array(Math.max(0, route.length - 1));
    for (const a of assignments) {
      for (let i = a.startIndex; i < a.endIndex; i++) {
        segmentToCanton[i] = a;
      }
    }
    assignments._segmentToCanton = segmentToCanton;
    this.routeCantons.set(routeKey, assignments);
    return assignments;
  }

  /**
   * Find which canton assignment a segment index falls into.
   */
  getCantonForSegment(assignments, segmentIndex) {
    const map = assignments?._segmentToCanton;
    return map && segmentIndex >= 0 && segmentIndex < map.length ? map[segmentIndex] : null;
  }

  occupy(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    // Prevent overwriting occupation by another active train
    if (c.occupiedBy && c.occupiedBy !== trainId) {
      if (!this._isTrainGone(c.occupiedBy)) return false;
    }
    c.occupiedBy = trainId;
    this._trackCanton(trainId, cantonId);
    return true;
  }

  release(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return;
    if (c.occupiedBy === trainId) { c.occupiedBy = null; }
    const tc = this.trainCantons.get(trainId);
    if (tc) tc.delete(cantonId);
  }

  isAvailable(cantonId, trainId) {
    const c = this.cantons.get(cantonId);
    if (!c) return true;
    // Verify occupying train still exists and is active
    if (c.occupiedBy !== null && c.occupiedBy !== trainId) {
      if (this._isTrainGone(c.occupiedBy)) { c.occupiedBy = null; }
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
      if (c && c.occupiedBy === trainId) { c.occupiedBy = null; }
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
    // Remove idle cantons (not occupied, not tracked by any train)
    const activeCantonIds = new Set();
    for (const [, ids] of this.trainCantons) {
      for (const cid of ids) activeCantonIds.add(cid);
    }
    for (const [cid, c] of this.cantons) {
      if (!c.occupiedBy && !activeCantonIds.has(cid)) {
        this.cantons.delete(cid);
      }
    }
  }

  _trackCanton(trainId, cantonId) {
    if (!this.trainCantons.has(trainId)) {
      this.trainCantons.set(trainId, new Set());
    }
    this.trainCantons.get(trainId).add(cantonId);
  }
}
