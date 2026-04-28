import { haversineDistance, analyzeRoute, CantonManager } from './simulation.js';

let nextServiceId = 1;

// Global canton manager shared across all services
const cantonManager = new CantonManager();

export class ServiceStop {
  constructor(stationId, type, depTime, arrTime) {
    this.stationId = stationId;
    this.type = type;
    this.departureTime = depTime;
    this.arrivalTime = arrTime || depTime;
  }
}

export class ActiveService {
  constructor(data, rame, world) {
    this.id = data.id || `svc-${nextServiceId++}`;
    this.name = data.name || 'Service';
    this.rameId = data.rameId;
    this.rame = rame;
    this.stops = (data.stops || []).map(s =>
      new ServiceStop(s.stationId, s.type, s.departureTime ?? s.time, s.arrivalTime ?? s.time)
    );
    this.routes = data.routes || [];
    this.world = world;
    this.roundTrip = data.roundTrip || false;
    this.multiDepartures = data.multiDepartures || 1;
    this.terminusWait = data.terminusWait || 10;
    this.totalDistance = data.totalDistance || 0;
    this.active = data.active !== false;
    this._tripCount = 0;

    this.currentStopIndex = 0;
    this.state = 'waiting';
    this.position = null;
    this.speed = 0;
    this.targetSpeed = 0;
    this.delay = 0;
    this.completed = false;
    this.direction = 1;
    this.currentRouteIndex = -1;
    this.routeProgress = 0;
    this.lastTickTime = -1;
    this.revenueCollected = false;
    this.isReturnLeg = false;
    this.returnStops = [];

    // Simulation state for strict segment-based route following
    this._state = {
      index: 0,
      progress: 0,
      legKey: null,
      cachedRoute: null,
    };
    this._routeAnalysis = null;
    this._cantonAssignments = null;

    // Mass-based physics: compute accel/decel from rame properties
    let accel = 3.0; // default km/h/s
    let decel = 4.0;
    if (rame) {
      const totalMass = rame.getTotalMassWithPayload ? rame.getTotalMassWithPayload(0.7) : (rame.totalMass || rame.totalTonnage || 400);
      const totalPower = rame.totalPower || 0;
      if (totalPower > 0 && totalMass > 0) {
        // F = P/v (at low speed, use 30 km/h reference), a = F/m
        // accel in km/h/s: a_m/s² * 3.6
        const forceKN = totalPower / (30 / 3.6); // force at 30 km/h in kN
        accel = Math.min(5.0, Math.max(0.5, (forceKN / totalMass) * 3.6));
      }
      // Heavier trains decelerate slightly slower
      if (totalMass > 0) {
        decel = Math.min(5.0, Math.max(2.0, 1600 / totalMass));
      }
    }

    this.train = {
      id: this.id,
      name: this.name,
      color: this.getColor(),
      maxSpeed: rame ? rame.maxSpeed : 160,
      speed: 0,
      delay: 0,
      state: 'waiting',
      totalKm: 0,
      stoppedAt: null,
      incident: null,
      breakdown: null,
      blockedBy: false,
      accel,
      decel,
    };

    if (this.stops.length > 0 && world) {
      const firstStation = world.getStationById(this.stops[0].stationId);
      if (firstStation) {
        this.position = { lat: firstStation.lat, lon: firstStation.lon };
        this.train.stoppedAt = firstStation;
      }
    }
  }

  getColor() {
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const hash = this.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getNextStop() {
    const stops = this.isReturnLeg ? this.returnStops : this.stops;
    if (this.currentStopIndex < stops.length) return stops[this.currentStopIndex];
    return null;
  }

  getTargetStation() {
    const next = this.getNextStop();
    if (!next || !this.world) return null;
    return this.world.getStationById(next.stationId) || null;
  }

  getCurrentStops() {
    return this.isReturnLeg ? this.returnStops : this.stops;
  }

  // Called every minute - handles schedule logic (departures, arrivals, state transitions)
  scheduleTick(timeOfDay, dateStr, economy) {
    if (!this.active || this.stops.length < 2) return;
    this._currentDate = dateStr;
    this._economy = economy;

    if (this.train.breakdown) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'en panne';
      return;
    }

    const currentStops = this.getCurrentStops();
    const firstDep = currentStops[0]?.departureTime ?? 0;

    if (this.state === 'waiting') {
      if (this.completed && dateStr !== this.completedDate) {
        this.completed = false;
      }
      if (this.completed) return;

      if (this.currentStopIndex === 0 && timeOfDay >= firstDep) {
        const lastStop = currentStops[currentStops.length - 1];
        const endTime = lastStop?.arrivalTime ?? firstDep + 120;
        if (timeOfDay <= endTime + 30) {
          this.state = 'moving';
          this.currentStopIndex = 1;
          this.speed = 0;
          this.revenueCollected = false;
          this.delay = Math.max(0, timeOfDay - firstDep);
          this.train.delay = this.delay;
          // Reset simulation state for new movement leg
          this._resetState();
        }
      }
      return;
    }

    if (this.state === 'stopped_at_station') {
      const stops = this.getCurrentStops();
      const stop = stops[this.currentStopIndex - 1];
      if (!stop) { this.state = 'moving'; return; }

      const depTime = stop.departureTime;
      if (stop.type === 'passage' || stop.type === 'waypoint' || timeOfDay >= depTime) {
        if (this.currentStopIndex >= stops.length) {
          this.completeService(economy);
        } else {
          this.state = 'moving';
          // Reset simulation state for next leg
          this._resetState();
        }
      }
    }
  }

  /**
   * Reset simulation state when starting a new movement leg.
   */
  _resetState() {
    this._state.index = 0;
    this._state.progress = 0;
    this._state.legKey = null;
    this._state.cachedRoute = null;
    this._routeAnalysis = null;
    this._cantonAssignments = null;
  }

  /**
   * Initialize simulation state for the current route leg.
   * Computes route analysis and creates canton assignments.
   */
  _initializeState(route, legKey) {
    this._state.legKey = legKey;
    this._state.cachedRoute = route;
    this._state.progress = 0;

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

    // Occupy initial canton
    if (this._cantonAssignments.length > 0) {
      const initialCanton = cantonManager.getCantonForSegment(
        this._cantonAssignments, this._state.index
      );
      if (initialCanton) {
        cantonManager.occupy(initialCanton.cantonId, this.id);
      }
    }
  }

  /**
   * Called every 0.5s - handles smooth train movement with strict route following.
   *
   * Movement rules:
   * 1. Follow route array sequentially, segment by segment
   * 2. effectiveSpeed = min(train.maxSpeed, segment.maxSpeed)
   * 3. Canton check: if next block occupied -> brake/stop
   * 4. Update progress via interpolation between two points
   * 5. On segment switch: release previous canton, reserve next
   * 6. Delay computed continuously during movement
   */
  moveUpdate(dt, timeOfDay, allServices) {
    if (!this.active || this.state !== 'moving') return;

    const target = this.getTargetStation();
    if (!target) return;

    // Get current route and ensure simulation state is initialized
    const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
    if (this._state.legKey !== legKey) {
      const freshRoute = this.getCurrentRoute();
      if (freshRoute && freshRoute.length >= 2) {
        this._initializeState(freshRoute, legKey);
      }
    }

    const route = this._state.cachedRoute;

    // Fallback: no ORM route available - direct movement toward target
    if (!route || route.length < 2) {
      this._moveDirectToTarget(dt, timeOfDay, target);
      return;
    }

    // Check if we've reached end of route
    if (this._state.index >= route.length - 1) {
      cantonManager.releaseAll(this.id);
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    // --- SPEED ENFORCEMENT ---
    const segIdx = this._state.index;
    const from = route[segIdx];
    const to = route[segIdx + 1];
    const segDistance = haversineDistance(from.lat, from.lon, to.lat, to.lon);

    if (segDistance <= 0) {
      this._state.index++;
      this._state.progress = 0;
      return;
    }

    // Infrastructure speed limit from ORM data
    let segMaxSpeed = to.maxSpeed || from.maxSpeed || 160;
    // Train physical speed limit
    const rameMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;

    // Incident effects
    const incident = this.train.incident;
    if (incident?.effect === 'stop') {
      this.speed = 0;
      this.train.speed = 0;
      this._updateContinuousDelay(timeOfDay);
      return;
    }
    if (incident?.effect === 'slow') {
      segMaxSpeed = Math.min(segMaxSpeed, incident.speedLimit || 30);
    }

    // Works speed limit
    const worksLimit = this.getWorksSpeedLimit();
    if (worksLimit === 0) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'travaux';
      this._updateContinuousDelay(timeOfDay);
      return;
    }
    if (worksLimit !== null) segMaxSpeed = Math.min(segMaxSpeed, worksLimit);

    // CRITICAL: effectiveSpeed = min(train speed, infrastructure speed)
    let effectiveMaxSpeed = Math.min(rameMaxSpeed, segMaxSpeed);

    // --- CANTONNEMENT (BLOCK SIGNALING) ---
    if (this._cantonAssignments && this._cantonAssignments.length > 0) {
      const signalAspect = cantonManager.getSignalAspect(
        this._cantonAssignments, segIdx, this.id
      );
      if (signalAspect !== null) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, signalAspect);
        this.train.blockedBy = signalAspect === 0;
      } else {
        this.train.blockedBy = false;
      }
    } else {
      // Fallback: proximity-based block check for routes without canton data
      const blockLimit = this._proximityBlockCheck(allServices);
      if (blockLimit !== null) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, blockLimit);
        this.train.blockedBy = blockLimit === 0;
      } else {
        this.train.blockedBy = false;
      }
    }

    // --- ACCELERATION / DECELERATION PHYSICS ---
    const accelDelta = this.train.accel * dt;
    const decelDelta = this.train.decel * dt;

    // Check if next stop is a waypoint (no braking needed)
    const nextStop = this.getNextStop();
    const isNextWaypoint = nextStop?.type === 'waypoint';

    // Braking distance check for approaching end of route (skip for waypoints)
    const remainingDist = this._getRemainingDistance(route);
    // brakingDistance = speed² / (2 * deceleration), convert km/h to km/s²
    const brakeDist = (this.speed * this.speed) / (2 * this.train.decel * 3600);

    if (!isNextWaypoint && remainingDist < brakeDist + 0.3 && remainingDist > 0.01) {
      // Progressive deceleration: no forced minimum speed
      const targetSpeed = Math.sqrt(Math.max(0, 2 * this.train.decel * 3600 * remainingDist));
      this.speed = Math.max(0, Math.min(this.speed, targetSpeed));
    } else if (effectiveMaxSpeed === 0) {
      this.speed = Math.max(0, this.speed - decelDelta);
    } else if (this.speed < effectiveMaxSpeed) {
      this.speed = Math.min(effectiveMaxSpeed, this.speed + accelDelta);
    } else if (this.speed > effectiveMaxSpeed) {
      this.speed = Math.max(effectiveMaxSpeed, this.speed - decelDelta);
    }

    // Distance traveled this tick: speed (km/h) * dt (seconds) / 3600
    const stepKm = this.speed * dt / 3600;

    if (stepKm <= 0) {
      this.train.speed = 0;
      this.train.state = 'stopped';
      this._updateContinuousDelay(timeOfDay);
      return;
    }

    // --- STRICT ROUTE FOLLOWING: advance segment by segment ---
    let remaining = stepKm;

    while (remaining > 0 && this._state.index < route.length - 1) {
      const idx = this._state.index;
      const segFrom = route[idx];
      const segTo = route[idx + 1];
      const segDist = haversineDistance(segFrom.lat, segFrom.lon, segTo.lat, segTo.lon);

      if (segDist <= 0) {
        this._state.index++;
        this._state.progress = 0;
        continue;
      }

      const remainingInSeg = (1 - this._state.progress) * segDist;

      if (remaining >= remainingInSeg) {
        // Complete this segment
        remaining -= remainingInSeg;

        // Canton transition on segment switch
        if (this._cantonAssignments) {
          const prevCanton = cantonManager.getCantonForSegment(this._cantonAssignments, idx);
          const nextCanton = cantonManager.getCantonForSegment(this._cantonAssignments, idx + 1);

          if (nextCanton && (!prevCanton || nextCanton.cantonId !== prevCanton.cantonId)) {
            if (!cantonManager.isAvailable(nextCanton.cantonId, this.id)) {
              // Canton blocked: stop at boundary
              this._state.progress = 1.0;
              this.position.lat = segTo.lat;
              this.position.lon = segTo.lon;
              this.train.blockedBy = true;
              remaining = 0;
              break;
            }
            // Reserve and occupy next canton, release previous
            cantonManager.occupy(nextCanton.cantonId, this.id);
            if (prevCanton) {
              cantonManager.release(prevCanton.cantonId, this.id);
            }
          }
        }

        this._state.index++;
        this._state.progress = 0;
      } else {
        // Partial segment: advance progress
        this._state.progress += remaining / segDist;
        remaining = 0;
      }
    }

    // --- POSITION UPDATE via interpolation ---
    if (this._state.index < route.length - 1) {
      const idx = this._state.index;
      const segFrom = route[idx];
      const segTo = route[idx + 1];
      const p = this._state.progress;
      this.position.lat = segFrom.lat + (segTo.lat - segFrom.lat) * p;
      this.position.lon = segFrom.lon + (segTo.lon - segFrom.lon) * p;
    } else {
      // Reached end of route
      const lastPt = route[route.length - 1];
      this.position.lat = lastPt.lat;
      this.position.lon = lastPt.lon;
      cantonManager.releaseAll(this.id);
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    this.totalDistance += stepKm;
    this.train.speed = Math.round(this.speed);
    this.train.totalKm = this.totalDistance;
    this.train.state = this.speed > 0 ? 'moving' : 'stopped';

    // --- REAL-TIME DELAY ---
    this._updateContinuousDelay(timeOfDay);
  }

  /**
   * Compute remaining distance from current position to end of route.
   */
  _getRemainingDistance(route) {
    const idx = this._state.index;
    if (idx >= route.length - 1) return 0;

    // Remaining in current segment
    const from = route[idx];
    const to = route[idx + 1];
    const segDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    let dist = (1 - this._state.progress) * segDist;

    // Sum remaining segments
    for (let i = idx + 1; i < route.length - 1; i++) {
      dist += haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
    }
    return dist;
  }

  /**
   * Continuous delay computation during movement.
   * Uses per-segment time fractions mapped to scheduled stop times
   * for accurate delay even on routes with varying speed limits.
   *
   * Delay increases when:
   *  - speed < maxSpeed (infrastructure/incident constraints)
   *  - waiting for canton (blocked, speed = 0)
   */
  _updateContinuousDelay(timeOfDay) {
    if (!this._routeAnalysis || this._routeAnalysis.segments.length === 0) return;

    const stops = this.getCurrentStops();
    if (this.currentStopIndex <= 0 || this.currentStopIndex > stops.length) return;

    const prevStop = stops[this.currentStopIndex - 1];
    if (!prevStop) return;

    const scheduledDepartureTime = prevStop.departureTime || 0;
    const nextStop = stops[this.currentStopIndex];
    const scheduledArrivalTime = nextStop?.arrivalTime ||
      (scheduledDepartureTime + this._routeAnalysis.estimatedTimeMinutes);

    const segments = this._routeAnalysis.segments;

    // Compute time-based progress fraction using per-segment ideal times
    let elapsedSegTime = 0;
    let totalSegTime = 0;
    for (const seg of segments) totalSegTime += seg.timeMinutes;

    for (let i = 0; i < this._state.index && i < segments.length; i++) {
      elapsedSegTime += segments[i].timeMinutes;
    }
    if (this._state.index < segments.length) {
      elapsedSegTime += segments[this._state.index].timeMinutes * this._state.progress;
    }

    const timeFraction = totalSegTime > 0 ? elapsedSegTime / totalSegTime : 0;

    // Map to schedule window for accurate delay
    const totalScheduledTime = scheduledArrivalTime - scheduledDepartureTime;
    const expectedTimeAtPosition = scheduledDepartureTime + totalScheduledTime * timeFraction;

    this.delay = Math.max(0, timeOfDay - expectedTimeAtPosition);
    this.train.delay = Math.round(this.delay);
  }

  /**
   * Fallback movement toward target station when no ORM route is available.
   */
  _moveDirectToTarget(dt, timeOfDay, target) {
    const dist = haversineDistance(this.position.lat, this.position.lon, target.lat, target.lon);

    if (dist < 0.3) {
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    const rameMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;
    const accelDelta = this.train.accel * dt;
    const decelDelta = this.train.decel * dt;
    const brakeDist = (this.speed * this.speed) / (2 * this.train.decel * 3600);

    if (dist < brakeDist + 0.5 && dist > 0.01) {
      const targetSpeed = Math.sqrt(Math.max(0, 2 * this.train.decel * 3600 * dist));
      this.speed = Math.max(0, Math.min(this.speed, targetSpeed));
    } else if (this.speed < rameMaxSpeed) {
      this.speed = Math.min(rameMaxSpeed, this.speed + accelDelta);
    } else if (this.speed > rameMaxSpeed) {
      this.speed = Math.max(rameMaxSpeed, this.speed - decelDelta);
    }

    const stepKm = this.speed * dt / 3600;
    if (dist > 0 && stepKm > 0) {
      const fraction = Math.min(stepKm / dist, 1);
      this.position.lat += (target.lat - this.position.lat) * fraction;
      this.position.lon += (target.lon - this.position.lon) * fraction;
      this.totalDistance += stepKm;
    }

    this.train.speed = Math.round(this.speed);
    this.train.totalKm = this.totalDistance;
    this.train.state = this.speed > 0 ? 'moving' : 'stopped';
    this.train.blockedBy = false;
  }

  /**
   * Proximity-based block check fallback (when canton data unavailable).
   */
  _proximityBlockCheck(allServices) {
    if (!this.position || !allServices) return null;

    const route = this._state.cachedRoute || this.getCurrentRoute();
    if (!route || route.length < 2) return null;

    const myProgress = this._getRouteProgressKm(this.position, route);
    let nearestAheadDist = Infinity;
    let nearestAheadSpeed = 0;

    for (const other of allServices) {
      if (other.id === this.id || !other.position || other.state === 'waiting') continue;

      const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
      if (rawDist > 30) continue;

      // Check if other train is on our route
      const closestPt = route.reduce((best, pt) => {
        const d = haversineDistance(other.position.lat, other.position.lon, pt.lat, pt.lon);
        return d < best.d ? { d, pt } : best;
      }, { d: Infinity, pt: null });

      if (closestPt.d > 1.5) continue;

      const otherProgress = this._getRouteProgressKm(other.position, route);
      const ahead = this.isReturnLeg ? otherProgress < myProgress : otherProgress > myProgress;

      if (ahead) {
        const dist = Math.abs(otherProgress - myProgress);
        if (dist < nearestAheadDist) {
          nearestAheadDist = dist;
          nearestAheadSpeed = other.speed || 0;
        }
      }
    }

    if (nearestAheadDist === Infinity) return null;

    const lineSpeed = this.getLineSpeedAtPosition();
    let blockLength;
    if (lineSpeed <= 80) blockLength = 0.6;
    else if (lineSpeed <= 160) blockLength = 1.0;
    else if (lineSpeed <= 200) blockLength = 1.5;
    else blockLength = 2.5;

    if (nearestAheadDist < blockLength) return 0;
    if (nearestAheadDist < blockLength * 2) return Math.min(nearestAheadSpeed, 30);
    if (nearestAheadDist < blockLength * 3) return nearestAheadSpeed;

    return null;
  }

  _getRouteProgressKm(pos, route) {
    if (!pos || !route || route.length < 2) return 0;
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < route.length; i++) {
      const d = haversineDistance(pos.lat, pos.lon, route[i].lat, route[i].lon);
      if (d < minDist) { minDist = d; bestIdx = i; }
    }
    let progress = 0;
    for (let i = 0; i < bestIdx && i < route.length - 1; i++) {
      progress += haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
    }
    return progress;
  }

  // Legacy compatibility
  update(timeOfDay, dateStr, economy, allServices) {
    this._economy = economy;
    this.scheduleTick(timeOfDay, dateStr, economy);
  }

  getCurrentRoute() {
    if (!this.routes || this.routes.length === 0) return null;
    const idx = Math.max(0, this.currentStopIndex - 1);
    if (this.isReturnLeg) {
      const routeIdx = this.routes.length - 1 - idx;
      const route = this.routes[routeIdx];
      return route ? [...route].reverse() : null;
    }
    return this.routes[idx] || null;
  }

  /**
   * Get infrastructure speed limit at current position.
   * Uses segment data from _state for precision when available.
   */
  getLineSpeedAtPosition() {
    // Use segment data from simulation state if available
    if (this._state.cachedRoute && this._state.index < this._state.cachedRoute.length - 1) {
      const route = this._state.cachedRoute;
      const idx = this._state.index;
      return route[idx + 1].maxSpeed || route[idx].maxSpeed || 160;
    }

    // Fallback: find nearest point on route
    const route = this.getCurrentRoute();
    if (!route || route.length === 0) return 300;

    let minDist = Infinity;
    let bestSpeed = 160;
    for (const pt of route) {
      if (!this.position) break;
      const d = haversineDistance(this.position.lat, this.position.lon, pt.lat, pt.lon);
      if (d < minDist) {
        minDist = d;
        bestSpeed = pt.maxSpeed || 160;
      }
    }
    return bestSpeed;
  }

  getWorksSpeedLimit() {
    if (!this.world) return null;
    const currentStops = this.getCurrentStops();
    if (this.currentStopIndex <= 0 || this.currentStopIndex >= currentStops.length) return null;

    const prevStop = currentStops[this.currentStopIndex - 1];
    const nextStop = currentStops[this.currentStopIndex];
    if (!prevStop || !nextStop) return null;

    const prevId = prevStop.stationId;
    const nextId = nextStop.stationId;

    for (const track of this.world.tracks) {
      if (!track.worksActive) continue;
      const matches = (track.stationA === prevId && track.stationB === nextId) ||
                      (track.stationA === nextId && track.stationB === prevId);
      if (matches) {
        if (track.worksImpact === 'stop') return 0;
        return track.worksSpeedLimit || 40;
      }
    }
    return null;
  }

  arriveAtStation(station, timeOfDay, economy) {
    const stops = this.getCurrentStops();
    const stop = stops[this.currentStopIndex];
    const expectedTime = stop?.arrivalTime;
    if (expectedTime != null) {
      this.delay = Math.max(0, timeOfDay - expectedTime);
    }
    this.train.delay = Math.round(this.delay);
    this.position = { lat: station.lat, lon: station.lon };
    this.speed = 0;
    this.train.speed = 0;
    this.train.stoppedAt = station;
    this.train.blockedBy = false;

    // Release all cantons for this train on arrival
    cantonManager.releaseAll(this.id);

    if (stop?.type === 'arret') {
      this.state = 'stopped_at_station';
    } else if (stop?.type === 'waypoint') {
      // Waypoints: don't stop, don't brake, continue moving
      this.state = 'moving';
    } else {
      this.state = 'moving';
    }

    this.currentStopIndex++;

    // Reset simulation state for next leg
    this._resetState();

    if (this.currentStopIndex >= stops.length) {
      this.completeService(economy);
    }
  }

  completeService(economy) {
    if (!this.revenueCollected && economy) {
      economy.processServiceRevenue(this);
      this.revenueCollected = true;
    }

    // Release all cantons
    cantonManager.releaseAll(this.id);
    this._resetState();

    if (this.roundTrip && !this.isReturnLeg) {
      this.isReturnLeg = true;
      this.returnStops = this.buildReturnStops();
      this.currentStopIndex = 0;
      this.state = 'waiting';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      this._tripCount = (this._tripCount || 0) + 1;
      return;
    }

    // Check for multi round-trip (additional departures)
    if (this.roundTrip && this.isReturnLeg && this.multiDepartures && this._tripCount < this.multiDepartures) {
      this.isReturnLeg = false;
      this.currentStopIndex = 0;
      this.state = 'waiting';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      this.revenueCollected = false;
      if (this.stops.length > 0 && this.world) {
        const firstStation = this.world.getStationById(this.stops[0].stationId);
        if (firstStation) {
          this.position = { lat: firstStation.lat, lon: firstStation.lon };
          this.train.stoppedAt = firstStation;
        }
      }
      return;
    }

    this.state = 'waiting';
    this.currentStopIndex = 0;
    this.speed = 0;
    this.train.speed = 0;
    this.train.state = 'waiting';
    this.train.blockedBy = false;
    this.completed = true;
    this.completedDate = this._currentDate || '';
    this.isReturnLeg = false;
    this.revenueCollected = false;
    this._tripCount = 0;

    if (this.stops.length > 0 && this.world) {
      const firstStation = this.world.getStationById(this.stops[0].stationId);
      if (firstStation) {
        this.position = { lat: firstStation.lat, lon: firstStation.lon };
        this.train.stoppedAt = firstStation;
      }
    }
  }

  buildReturnStops() {
    const reversed = [...this.stops].reverse();
    const lastArrival = this.stops[this.stops.length - 1].arrivalTime || this.stops[this.stops.length - 1].departureTime;
    let currentTime = lastArrival + this.terminusWait;

    return reversed.map((stop, i) => {
      const prevStop = i > 0 ? reversed[i - 1] : null;
      let travelTime = 0;
      if (prevStop) {
        const origIdx = this.stops.findIndex(s => s.stationId === prevStop.stationId);
        const origIdx2 = this.stops.findIndex(s => s.stationId === stop.stationId);
        if (origIdx >= 0 && origIdx2 >= 0) {
          travelTime = Math.abs((this.stops[origIdx].departureTime || 0) - (this.stops[origIdx2].arrivalTime || 0));
        }
        if (travelTime <= 0) travelTime = 15;
      }

      const arrTime = currentTime + travelTime;
      const depTime = arrTime + (stop.type === 'arret' ? 2 : 0);
      currentTime = depTime;

      return new ServiceStop(stop.stationId, stop.type, depTime, arrTime);
    });
  }
}

export class ScheduleCreator {
  constructor() {
    this.services = [];
  }

  addService(data, rame, world) {
    const svc = new ActiveService(data, rame, world);
    this.services.push(svc);
    return svc;
  }

  removeService(id) {
    // Release cantons for removed service
    const svc = this.services.find(s => s.id === id);
    if (svc) cantonManager.releaseAll(svc.id);
    this.services = this.services.filter(s => s.id !== id);
  }

  getActiveServices() {
    return this.services.filter(s => s.active);
  }

  toSave() {
    return this.services.map(s => ({
      id: s.id,
      name: s.name,
      rameId: s.rameId,
      stops: s.stops.map(st => ({
        stationId: st.stationId,
        type: st.type,
        departureTime: st.departureTime,
        arrivalTime: st.arrivalTime,
      })),
      routes: s.routes,
      roundTrip: s.roundTrip,
      multiDepartures: s.multiDepartures,
      terminusWait: s.terminusWait,
      totalDistance: s.totalDistance,
      active: s.active,
    }));
  }

  loadFromSave(arr, rameManager, world) {
    this.services = [];
    for (const d of arr) {
      const rame = rameManager.getById(d.rameId);
      const svc = new ActiveService(d, rame, world);
      svc.totalDistance = d.totalDistance || 0;
      svc.active = d.active !== false;
      this.services.push(svc);
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextServiceId) nextServiceId = num + 1;
    }
  }
}
