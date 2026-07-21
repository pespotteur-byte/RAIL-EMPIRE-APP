import {
  timeDiff, timeGte, isInServiceWindow, wrapTime, _seeded01, serviceCounters
} from './service-utils.js?v=1784731002';
import { cantonManager } from './canton-manager.js?v=1784731002';
import { ServiceStop } from './service-stop.js?v=1784731002';
import { haversineDistance, analyzeRoute } from './simulation.js?v=1784731002';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js?v=1784731002';
import { getGlobalRng } from './rng.js?v=1784731002';
import { accelerationMs2, brakingDecelMs2, _units } from './train-physics.js?v=1784731002';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js?v=1784731002';

export const CantonController = {
  _yieldToRescue() {
      const dm = window.game?.depotManager;
      if (!dm || !this.position) return;
      for (const rescue of dm.activeRescues || []) {
        if (!rescue.position || (rescue.state !== 'en_route' && rescue.state !== 'recovering')) continue;
        const d = haversineDistance(this.position.lat, this.position.lon, rescue.position.lat, rescue.position.lon);
        if (d < 2.0) {
          this.speed = 0;
          this.train.speed = 0;
          this.train.blockedBy = true;
          return;
        }
      }
    },

  _resetState() {
      this._state.index = 0;
      this._state.progress = 0;
      this._state.legKey = null;
      this._state.cachedRoute = null;
      this._state.worksLimitCache = null;
      this._routeAnalysis = null;
      this._cantonAssignments = null;
      this._cachedTroncon = null;
      this._cachedTronconTime = null;
      this._trackKey = null;
      this._iteHardBlock = false;
    },

  _initializeState(route, legKey) {
      this._state.legKey = legKey;
      this._state.cachedRoute = route;
      this._state.worksLimitCache = null;
      this._state.progress = 0;

      // Cache segment distances for O(1) remaining-distance lookups
      const segDists = new Float64Array(route.length - 1);
      const cumDist = new Float64Array(route.length); // cumDist[i] = total distance from i to end
      for (let i = route.length - 2; i >= 0; i--) {
        segDists[i] = haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
        cumDist[i] = segDists[i] + (cumDist[i + 1] || 0);
      }
      this._state.segDists = segDists;
      this._state.cumDist = cumDist;

      // Cache a stable content key for route grouping (used by the LOD engine)
      const first = route[0];
      const last = route[route.length - 1];
      this._routeKey = `${first.lat.toFixed(6)},${first.lon.toFixed(6)}->${last.lat.toFixed(6)},${last.lon.toFixed(6)}@${route.length}@${cumDist[0].toFixed(3)}`;
      // Direction-agnostic key for IPCS / same-track detection (same endpoints, either direction)
      const aKey = `${first.lat.toFixed(5)},${first.lon.toFixed(5)}`;
      const bKey = `${last.lat.toFixed(5)},${last.lon.toFixed(5)}`;
      this._trackKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;

      // Find closest point on route to current position
      if (this.position && route.length > 1) {
        let minDist = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < route.length; i++) {
          const d = haversineDistance(this.position.lat, this.position.lon, route[i].lat, route[i].lon);
          if (d < minDist) { minDist = d; bestIdx = i; }
        }
        this._state.index = Math.min(bestIdx, route.length - 2);
      } else {
        this._state.index = 0;
      }

      // Pre-analyze route for precise distance and time calculations
      const trainMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;
      this._routeAnalysis = analyzeRoute(route, trainMaxSpeed);

      // Create canton assignments for block signaling
      this._cantonAssignments = cantonManager.createRouteCantons(route);

      // Occupy initial canton (may fail if another train is there)
      if (this._cantonAssignments.length > 0) {
        const initialCanton = cantonManager.getCantonForSegment(
          this._cantonAssignments, this._state.index
        );
        if (initialCanton) {
          const occupied = cantonManager.occupy(initialCanton.cantonId, this.id);
          if (!occupied) {
            this.train.blockedBy = true;
          }
        }
      }
    },

  _cancelBlockedService(timeOfDay) {
      if (this.completed || this.cancelled) return false;
      this.state = 'cancelled';
      this.cancelled = true;
      this.completed = true;
      this.completedDate = (typeof window !== 'undefined' && window.game?._currentDate) || this._currentDate || '';
      this.position = null;
      this.speed = 0;
      if (this.train) {
        this.train.speed = 0;
        this.train.stoppedAt = null;
        this.train.blockedBy = false;
        this.train.delayReason = 'annulation après blocage prolongé';
      }
      this.delay = 0;
      cantonManager.releaseAll(this.id);
      return true;
    },

  _updateStuckTimer(timeOfDay) {
      const blocked = this.train && (this.train.blockedBy || this.train.state === 'en panne' || this.train.delayReason === 'Incident' || this.train.delayReason === 'travaux' || this.train.delayReason?.startsWith('travaux :') || this.train.delayReason === 'tronçon non électrifié' || this.train.delayReason === 'TTX : ligne non électrifiée' || this.train.delayReason === 'attente voie libre en gare' || this.train.delayReason?.startsWith('Panne'));
      if (!blocked) {
        this._blockedSinceGameTime = null;
        return false;
      }
      if (this._blockedSinceGameTime == null) this._blockedSinceGameTime = timeOfDay;
      const elapsed = (timeOfDay - this._blockedSinceGameTime + 1440) % 1440;
      if (elapsed > this._getMaxRuntimeForCurrentLeg()) {
        return this._cancelBlockedService(timeOfDay);
      }
      return false;
    },

  _proximityBlockCheck(allServices) {
      if (!this.position || !allServices) return null;

      const route = this._state.cachedRoute || this.getCurrentRoute();
      if (!route || route.length < 2) return null;

      const myProgress = this._getRouteProgressKm(this.position, route, this._state.index);
      let nearestAheadDist = Infinity;
      let nearestAheadSpeed = 0;
      const vpm = window.game?.voiePointManager;
      const myVoie = this.train.platform || (vpm ? vpm.getVoieAtPosition(this.position) : null);

      // Use spatial hash if available (O(k) where k = nearby trains), else fallback to all
      const candidates = this._nearbyServices || allServices;

      for (const other of candidates) {
        if (other.id === this.id) continue;
        if (!other.position || other.state === 'waiting' || other.state === 'completed') continue;

        // Voie check: if both trains have voie info and they differ → different tracks, skip
        const otherVoie = other.train?.platform || (vpm && other.position ? vpm.getVoieAtPosition(other.position) : null);
        if (myVoie && otherVoie && myVoie !== otherVoie) continue;

        const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
        // Only check trains within canton range (max ~5km, not 30km)
        if (rawDist > 5) continue;

        // Check if other train is actually on our route (within 0.2km of a route point)
        const rLen = route.length;
        const step = Math.max(1, Math.floor(rLen / 15));
        let nearRoute = false;
        for (let ri = 0; ri < rLen; ri += step) {
          if (haversineDistance(other.position.lat, other.position.lon, route[ri].lat, route[ri].lon) < 0.2) {
            nearRoute = true; break;
          }
        }
        if (!nearRoute) continue;

        // Heading check: skip trains going in opposite direction (likely on other track)
        if (other.state === 'moving' && other._state?.cachedRoute && other._state.index < other._state.cachedRoute.length - 1) {
          const oRoute = other._state.cachedRoute;
          const oi = other._state.index;
          const segIdx = this._state.index;
          if (segIdx < route.length - 1) {
            const myHdg = Math.atan2(route[segIdx + 1].lon - route[segIdx].lon, route[segIdx + 1].lat - route[segIdx].lat);
            const otHdg = Math.atan2(oRoute[oi + 1].lon - oRoute[oi].lon, oRoute[oi + 1].lat - oRoute[oi].lat);
            let hdiff = Math.abs(myHdg - otHdg);
            if (hdiff > Math.PI) hdiff = 2 * Math.PI - hdiff;
            if (hdiff > Math.PI / 2) continue; // Opposite direction → different tracks
          }
        }

        const otherProgress = this._getRouteProgressKm(other.position, route, this._state.index);
        const ahead = otherProgress > myProgress;

        if (ahead) {
          const dist = Math.abs(otherProgress - myProgress);
          if (dist < nearestAheadDist) {
            nearestAheadDist = dist;
            nearestAheadSpeed = other.speed || 0;
          }
        }

        // Nez-à-nez: on ne garde que les trains réellement devant nous. Les trains
        // derrière (même sens) ne doivent pas faire freiner le train de tête.
      }

      if (nearestAheadDist === Infinity) return null;

      // OCC-04 : sillage dynamique basé sur la distance de freinage par rapport au train de tête
      const mySpeed = this.speed || 0;
      const decel = this.train.decel || 2;
      const leaderSpeed = Math.max(0, nearestAheadSpeed);
      const dSafe = Math.max(0.15, (mySpeed * mySpeed - leaderSpeed * leaderSpeed) / (2 * decel * 3600) + 0.15);

      if (nearestAheadDist < dSafe) return 0;
      if (nearestAheadDist < dSafe + 0.3) return leaderSpeed;
      if (nearestAheadDist < dSafe + 0.8 && mySpeed > leaderSpeed + 20) return leaderSpeed + 20;

      return null;
    },

  _getIpcsCandidates(candidates) {
      if (typeof window !== 'undefined' && window.game?._serviceGrid) {
        const grid = window.game._serviceGrid;
        const cellSize = window.game._serviceGridCell || 0.02;
        const latKey = Math.floor(this.position.lat / cellSize);
        const lonKey = Math.floor(this.position.lon / cellSize);
        const list = [];
        for (let dl = -1; dl <= 1; dl++) {
          for (let dn = -1; dn <= 1; dn++) {
            const cell = grid.get(`${latKey + dl},${lonKey + dn}`);
            if (cell) list.push(...cell);
          }
        }
        return list;
      }
      return candidates || this._nearbyServices || [];
    },

  _isNearRoute(pos, route, hintIndex = 0) {
      if (!pos || !route || route.length < 2) return false;
      const NEAR_KM = 0.15;
      const start = Math.max(0, hintIndex - 50);
      const end = Math.min(route.length, hintIndex + 150);
      for (let i = start; i < end; i++) {
        const dlat = (pos.lat - route[i].lat) * 111;
        const dlon = (pos.lon - route[i].lon) * 111 * Math.cos(pos.lat * Math.PI / 180);
        if (dlat * dlat + dlon * dlon < NEAR_KM * NEAR_KM) return true;
      }
      return false;
    },

  _ipcsBlockCheck(candidates = null) {
      if (!this.position || !this._state?.cachedRoute) return null;
      const route = this._state.cachedRoute;
      if (route.length < 2) return null;
      const myIdx = this._state.index;
      if (myIdx >= route.length - 1) return null;
      const mySpeed = this.speed || 0;
      const decel = this.train?.decel || 4;
      const myH = Math.atan2(route[myIdx + 1].lon - route[myIdx].lon, route[myIdx + 1].lat - route[myIdx].lat);
      const list = this._getIpcsCandidates(candidates);
      const myTrackKey = this._trackKey;
      const vpm = window.game?.voiePointManager;
      const myVoie = this.train.platform || (vpm ? vpm.getVoieAtPosition(this.position, 0.3) : null);
      for (const other of list) {
        if (other.id === this.id) continue;
        if (!other.position) continue;
        if (other.state === 'waiting' || other.state === 'completed') continue;
        if (myTrackKey && other._trackKey && other._trackKey !== myTrackKey) continue;
        // Sur double voie, deux trains sur des voies différentes ne se gênent pas
        const otherVoie = other.train?.platform || (vpm && other.position ? vpm.getVoieAtPosition(other.position, 0.3) : null);
        if (myVoie && otherVoie && myVoie !== otherVoie) continue;
        const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
        if (rawDist > 5) continue;
        if (!myTrackKey && !this._isNearRoute(other.position, route, myIdx)) continue;
        const otherRoute = other._state?.cachedRoute || (typeof other.getCurrentRoute === 'function' ? other.getCurrentRoute() : null);
        if (!otherRoute || otherRoute.length < 2) continue;
        const oi = other._state?.index || 0;
        if (oi >= otherRoute.length - 1) continue;
        const oH = Math.atan2(otherRoute[oi + 1].lon - otherRoute[oi].lon, otherRoute[oi + 1].lat - otherRoute[oi].lat);
        let hDiff = Math.abs(myH - oH);
        if (hDiff > Math.PI) hDiff = 2 * Math.PI - hDiff;
        if (hDiff <= Math.PI / 2) continue; // not opposite direction
        const otherSpeed = other.speed || 0;
        const vClose = mySpeed + otherSpeed;
        const dSafe = Math.max(0.3, (vClose * vClose) / (2 * decel * 3600) + 0.3);
        if (rawDist < dSafe) return 0;
        if (rawDist < dSafe + 0.5) return 20;
      }
      return null;
    },

  _getBlockingWorksForRoute(route, dateStr, timeOfDay) {
      const blocking = [];
      if (!route || route.length < 2 || !this.world) return blocking;
      const currentStops = this.getCurrentStops();
      const prevId = currentStops[this.currentStopIndex - 1]?.stationId;
      const nextId = currentStops[this.currentStopIndex]?.stationId;
      for (const track of this.world.tracks) {
        if (!track.worksActive) continue;
        const poly = track.route;
        if (poly && poly.length >= 2) {
          if (!this._routeIntersectsPolyline(route, poly, 0.1)) continue;
        } else if (prevId && nextId) {
          const pairMatches = (track.stationA === prevId && track.stationB === nextId) || (track.stationA === nextId && track.stationB === prevId);
          if (!pairMatches) continue;
        } else continue;
        blocking.push({ impact: track.worksImpact || 'stop', speedLimit: track.worksSpeedLimit, stationA: track.stationA, stationB: track.stationB, route: track.route });
      }
      const worksMgr = typeof window !== 'undefined' && window.game?.worksManager;
      if (worksMgr) {
        for (const w of worksMgr.getActive(dateStr, timeOfDay)) {
          const poly = w.manualRoute || w.route;
          if (poly && poly.length >= 2) {
            if (!this._routeIntersectsPolyline(route, poly, 0.1)) continue;
          } else if (prevId && nextId) {
            const pairMatches = (w.stationA === prevId && w.stationB === nextId) || (w.stationA === nextId && w.stationB === prevId);
            if (!pairMatches) continue;
          } else continue;
          blocking.push({ impact: w.impact || 'stop', speedLimit: Number.isFinite(w.speedLimit) ? w.speedLimit : 40, stationA: w.stationA, stationB: w.stationB, route: w.manualRoute || w.route });
        }
      }
      return blocking;
    }
};
