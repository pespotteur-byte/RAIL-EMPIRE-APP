import { haversineDistance, analyzeRoute, CantonManager } from './simulation.js?v=1778404142';

let nextServiceId = 1;

// Global canton manager shared across all services
const cantonManager = new CantonManager();
export { cantonManager };

export class ServiceStop {
  constructor(stationId, type, depTime, arrTime, voiePointId, platform) {
    this.stationId = stationId;
    this.type = type;
    this.departureTime = depTime;
    this.arrivalTime = arrTime || depTime;
    this.voiePointId = voiePointId || null;
    this.platform = platform || '';
  }
}

export class ActiveService {
  constructor(data, rame, world) {
    this.id = data.id || `svc-${nextServiceId++}`;
    this.name = data.name || 'Service';
    this.rameId = data.rameId;
    this.rame = rame;
    this.stops = (data.stops || []).map(s =>
      new ServiceStop(s.stationId, s.type, s.departureTime ?? s.time, s.arrivalTime ?? s.time, s.voiePointId, s.platform)
    );
    this.routes = data.routes || [];
    this.world = world;
    this.roundTrip = data.roundTrip || false;
    this.multiDepartures = data.multiDepartures || 1;
    this.terminusWait = data.terminusWait || 10;
    this.totalDistance = data.totalDistance || 0;
    this.active = data.active !== false;
    this.isWorkTrain = data.isWorkTrain || false; // S15: Work trains unaffected by works
    this.returnName = data.returnName || '';
    this.returnPlatforms = data.returnPlatforms || {}; // { stationId: platformName }
    this._tripCount = 0;
    this._adjustedStops = null;

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
    this._platformAssignment = null; // { stationId, platform } when stopped

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

    // S12: Get locomotive series name/number from rame
    let seriesName = '', trainNumber = '';
    if (rame && rame.elements) {
      const loco = rame.elements.find(e => e.item?.seriesName);
      if (loco?.item) {
        seriesName = loco.item.seriesName;
        trainNumber = String(loco.item.numberStart || '');
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
      seriesName,
      number: trainNumber,
      platform: null,
      // S14: Wear tracking
      totalKmRun: 0,
      kmSinceLastMaint: 0,
      wearLevel: 0, // 0-100
    };

    // Garage/shunting state
    this._garage = null; // { vpId, route, savedRoute, savedStopIndex, savedState, blockerTrainId }

    if (this.stops.length > 0 && world) {
      const firstStation = world.getStationById(this.stops[0].stationId);
      if (firstStation) {
        this.position = { lat: firstStation.lat, lon: firstStation.lon };
        this.train.stoppedAt = firstStation;
      }
    }
  }

  async garageToVoiePoint(vpId) {
    if (this._garage || !this.position) return;
    const vpm = window.game?.voiePointManager;
    const vp = vpm?.getVoiePointById(vpId);
    if (!vp) return;
    const orm = window.game?.orm;
    let route;
    try {
      route = await orm.findRoute(this.position.lat, this.position.lon, vp.lat, vp.lon);
    } catch (e) {
      route = [{ lat: this.position.lat, lon: this.position.lon, maxSpeed: 30 }, { lat: vp.lat, lon: vp.lon, maxSpeed: 30 }];
    }
    this._garage = {
      vpId, route,
      savedRoutes: this.routes,
      savedStopIndex: this.currentStopIndex,
      savedState: this.state,
      savedIsReturn: this.isReturnLeg,
      phase: 'going', // going → parked → returning
    };
    this._state.cachedRoute = route;
    this._state.routeIndex = 0;
    this._state.segDists = null;
    this.state = 'moving';
    this.train.blockedBy = false;
    this.speed = 0;
  }

  resumeFromGarage() {
    if (!this._garage) return;
    this._garage.phase = 'resuming';
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
    // Station stop
    if (next.stationId) return this.world.getStationById(next.stationId) || null;
    // Non-station voie point stop — return virtual target from voie point coords
    if (next.voiePointId && window.game?.voiePointManager) {
      const vp = window.game.voiePointManager.getVoiePointById(next.voiePointId);
      if (vp) return { id: vp.id, name: `Voie ${vp.voie}`, lat: vp.lat, lon: vp.lon, platforms: 1 };
    }
    return null;
  }

  getCurrentStops() {
    if (this.isReturnLeg) return this.returnStops;
    return this._adjustedStops || this.stops;
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

    if (this.train.inMaintenance) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'en maintenance';
      return;
    }

    const currentStops = this.getCurrentStops();
    const firstDep = currentStops[0]?.departureTime ?? 0;

    if (this.state === 'waiting') {
      if (this.completed && dateStr !== this.completedDate) {
        this.completed = false;
      }
      if (this.completed) return;

      // Show train on map 1 minute before departure (position at first station)
      if (this.currentStopIndex === 0 && timeOfDay >= firstDep - 1 && timeOfDay < firstDep) {
        const firstStation = this.world?.getStationById(currentStops[0]?.stationId);
        if (firstStation) {
          // Use voie point coords if available
          let posLat = firstStation.lat, posLon = firstStation.lon;
          if (window.game?.voiePointManager) {
            const s0 = currentStops[0];
            if (s0?.voiePointId) {
              const vp = window.game.voiePointManager.getVoiePointById(s0.voiePointId);
              if (vp) { posLat = vp.lat; posLon = vp.lon; }
            } else if (s0?.platform) {
              const svp = window.game.voiePointManager.getStationVoiePoint(firstStation.id, s0.platform);
              if (svp) { posLat = svp.lat; posLon = svp.lon; }
            }
          }
          this.position = { lat: posLat, lon: posLon };
          this.train.stoppedAt = firstStation;
          this.train.platform = currentStops[0]?.platform || '';
          this.train.speed = 0;
          this.speed = 0;
        }
        return;
      }

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
          this.train.blockedBy = false;
          this.train.stoppedAt = null;
          this._lastTronconId = null;
          // Release all occupations on departure
          if (window.game?.voiePointManager) window.game.voiePointManager.releaseAllVoiePointsForTrain(this.id);
          if (window.game?.platformManager) window.game.platformManager.releasePlatform(currentStops[0]?.stationId, this.id);
          // Reset simulation state for new movement leg
          this._resetState();
        }
      }
      return;
    }

    if (this.state === 'stopped_at_station') {
      // Multi-trip waiting: use _nextDepartureTime if set
      if (this._nextDepartureTime != null && this.currentStopIndex === 0) {
        if (timeOfDay >= this._nextDepartureTime) {
          this._nextDepartureTime = null;
          this.state = 'moving';
          this.currentStopIndex = 1;
          this.speed = 0;
          this.revenueCollected = false;
          this.train.blockedBy = false;
          this.train.stoppedAt = null;
          this._lastTronconId = null;
          if (window.game?.voiePointManager) window.game.voiePointManager.releaseAllVoiePointsForTrain(this.id);
          if (this._platformAssignment && window.game?.platformManager) {
            window.game.platformManager.releasePlatform(this._platformAssignment.stationId, this.id);
            this._platformAssignment = null;
          }
          this._resetState();
        }
        return;
      }

      const stops = this.getCurrentStops();
      const stop = stops[this.currentStopIndex - 1];
      if (!stop) { this.state = 'moving'; return; }

      const depTime = stop.departureTime;
      if (stop.type === 'passage' || stop.type === 'waypoint' || timeOfDay >= depTime) {
        // Release platform on departure
        if (this._platformAssignment && window.game?.platformManager) {
          window.game.platformManager.releasePlatform(
            this._platformAssignment.stationId, this.id
          );
          this._platformAssignment = null;
          this.train.platform = null;
        }
        // Release voie point occupation on departure
        if (window.game?.voiePointManager) {
          window.game.voiePointManager.releaseAllVoiePointsForTrain(this.id);
        }

        this.train._stoppedSinceGameTime = null;
        this.train.blockedBy = false;
        this.train.stoppedAt = null;
        this._lastTronconId = null;
        if (this.currentStopIndex >= stops.length) {
          this.completeService(economy);
        } else {
          this.state = 'moving';
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

    // Cache segment distances for O(1) remaining-distance lookups
    const segDists = new Float64Array(route.length - 1);
    const cumDist = new Float64Array(route.length); // cumDist[i] = total distance from i to end
    for (let i = route.length - 2; i >= 0; i--) {
      segDists[i] = haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
      cumDist[i] = segDists[i] + (cumDist[i + 1] || 0);
    }
    this._state.segDists = segDists;
    this._state.cumDist = cumDist;

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

    // Garage: parked at voie de garage — wait for resume
    if (this._garage && this._garage.phase === 'parked') {
      this.speed = 0;
      this.train.speed = 0;
      this.train.blockedBy = false;
      return;
    }
    // Garage: resuming — build return route
    if (this._garage && this._garage.phase === 'resuming') {
      this._garage.phase = 'returning';
      const vp = window.game?.voiePointManager?.getVoiePointById(this._garage.vpId);
      if (vp && this.position) {
        const target = this.getTargetStation();
        const tgtLat = target?.lat || this.position.lat;
        const tgtLon = target?.lon || this.position.lon;
        window.game.orm.findRoute(vp.lat, vp.lon, tgtLat, tgtLon).then(route => {
          this._state.cachedRoute = route;
          this._state.index = 0;
          this._state.progress = 0;
          this._state.segDists = null;
          this._state.legKey = null;
        }).catch(() => {
          // Fallback: direct line
          this._state.cachedRoute = [
            { lat: vp.lat, lon: vp.lon, maxSpeed: 30 },
            { lat: tgtLat, lon: tgtLon, maxSpeed: 30 },
          ];
          this._state.index = 0;
          this._state.progress = 0;
          this._state.segDists = null;
          this._state.legKey = null;
        });
      }
      return;
    }

    let target = this.getTargetStation();
    if (!target) {
      // No target = service done, clean up blocked state
      this.train.blockedBy = false;
      this.completeService(this._economy);
      return;
    }
    // Override target coords with voie point when stop has a voiePointId
    const nextStop = this.getNextStop();
    if (nextStop?.voiePointId && window.game?.voiePointManager) {
      const vp = window.game.voiePointManager.getVoiePointById(nextStop.voiePointId);
      if (vp) target = { ...target, lat: vp.lat, lon: vp.lon };
    }

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

    // Clamp route index to valid range
    if (this._state.index < 0) this._state.index = 0;
    if (this._state.index >= route.length) this._state.index = route.length - 1;

    // Check if we've reached end of route
    if (this._state.index >= route.length - 1) {
      // Garage: arrived at voie de garage
      if (this._garage && this._garage.phase === 'going') {
        this._garage.phase = 'parked';
        this.speed = 0;
        this.train.speed = 0;
        this.state = 'moving'; // keep moving state but speed 0
        return;
      }
      // Garage: returning to main route
      if (this._garage && this._garage.phase === 'returning') {
        this.currentStopIndex = this._garage.savedStopIndex;
        this.isReturnLeg = this._garage.savedIsReturn;
        this.routes = this._garage.savedRoutes;
        this._garage = null;
        this._resetState();
        this.state = 'moving';
        this.train.blockedBy = false;
        return;
      }
      cantonManager.releaseAll(this.id);
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    // --- SPEED ENFORCEMENT ---
    const segIdx = this._state.index;
    const from = route[segIdx];
    const to = route[segIdx + 1];
    const segDistance = (this._state.segDists && this._state.segDists[segIdx]) || haversineDistance(from.lat, from.lon, to.lat, to.lon);

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

    // Works speed limit (S15: work trains are unaffected)
    const worksLimit = this.isWorkTrain ? null : this.getWorksSpeedLimit();
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

    // --- TRONCON CISAILLEMENT CHECK (runs first, overrides proximity if on troncon) ---
    let onTroncon = false;
    if (window.game?.voiePointManager && this.position) {
      const vpm = window.game.voiePointManager;
      const trainVoie = this.train.platform || vpm.getVoieAtPosition(this.position) || null;
      const currentTrc = vpm.getTronconAtPosition(this.position, 0.3, trainVoie);
      if (currentTrc) {
        onTroncon = true;
        if (currentTrc.occupiedBy !== this.id) {
          if (vpm.isTronconOccupied(currentTrc.id, this.id)) {
            effectiveMaxSpeed = 0;
            this.train.blockedBy = true;
          } else {
            const blocking = vpm.checkCisaillement(currentTrc.id, this.id);
            if (blocking) {
              effectiveMaxSpeed = 0;
              this.train.blockedBy = true;
            } else {
              vpm.occupyTroncon(currentTrc.id, this.id);
              this.train.blockedBy = false;
            }
          }
        } else {
          this.train.blockedBy = false;
        }
        if (this._lastTronconId && this._lastTronconId !== currentTrc.id) {
          vpm.releaseTroncon(this._lastTronconId, this.id);
        }
        this._lastTronconId = currentTrc.id;
      } else {
        vpm.releaseAllForTrain(this.id);
      }
    }

    // --- CANTONNEMENT / PROXIMITY (only if NOT on a troncon) ---
    if (!onTroncon) {
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
        const blockLimit = this._proximityBlockCheck(allServices);
        if (blockLimit !== null) {
          effectiveMaxSpeed = Math.min(effectiveMaxSpeed, blockLimit);
          this.train.blockedBy = blockLimit === 0;
        } else {
          this.train.blockedBy = false;
        }
      }
    }

    // --- STATION VOIE POINT OCCUPATION CHECK ---
    if (window.game?.voiePointManager && !this.train.blockedBy) {
      const vpm = window.game.voiePointManager;
      const nextStop = this.getNextStop();
      if (nextStop && nextStop.type === 'arret' && target) {
        const platform = nextStop.platform || nextStop.voiePointId || (this.isReturnLeg ? '2' : '1');
        const stationVP = nextStop.voiePointId
          ? vpm.getVoiePointById(nextStop.voiePointId)
          : vpm.getStationVoiePoint(target.id, platform);
        if (stationVP && vpm.isVoiePointOccupied(stationVP.id, this.id)) {
          const remainDist = this._getRemainingDistance(route);
          if (remainDist < 3) {
            effectiveMaxSpeed = 0;
            this.train.blockedBy = true;
          }
        }
      }
    }

    // --- ACCELERATION / DECELERATION PHYSICS ---
    const accelDelta = this.train.accel * dt;
    const decelDelta = this.train.decel * dt;

    // Check if next stop is a waypoint or passage (no braking needed)
    const nextStopBrake = this.getNextStop();
    const isNextPassThrough = nextStopBrake?.type === 'waypoint' || nextStopBrake?.type === 'passage';

    // Braking distance check for approaching end of route (skip for pass-through stops)
    const remainingDist = this._getRemainingDistance(route);
    // brakingDistance = speed² / (2 * deceleration), convert km/h to km/s²
    const brakeDist = (this.speed * this.speed) / (2 * this.train.decel * 3600);

    if (!isNextPassThrough && remainingDist < brakeDist + 0.3 && remainingDist > 0.01) {
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
      const segDist = (this._state.segDists && this._state.segDists[idx]) || haversineDistance(segFrom.lat, segFrom.lon, segTo.lat, segTo.lon);

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

    // S8/S14: Wear tracking + probabilistic failure (~1 per 25,000 km)
    this.train.totalKmRun = (this.train.totalKmRun || 0) + stepKm;
    this.train.kmSinceLastMaint = (this.train.kmSinceLastMaint || 0) + stepKm;
    this.train.wearLevel = Math.min(100, (this.train.kmSinceLastMaint || 0) / 250); // 100% wear at 25,000km
    // Failure probability: scales with wear level (higher wear = more likely to break)
    if (!this.train.breakdown && stepKm > 0) {
      const wearMultiplier = 1 + (this.train.wearLevel || 0) / 25; // 1x at 0%, 5x at 100%
      const failureProb = (stepKm / 25000) * wearMultiplier;
      if (Math.random() < failureProb) {
        this.train.breakdown = { type: 'panne', time: timeOfDay };
      }
    }

    // --- REAL-TIME DELAY ---
    this._updateContinuousDelay(timeOfDay);
  }

  /**
   * Compute remaining distance from current position to end of route.
   */
  _getRemainingDistance(route) {
    const idx = this._state.index;
    if (idx >= route.length - 1) return 0;

    // Use cached distances if available (O(1) instead of O(n))
    if (this._state.segDists && this._state.cumDist) {
      const segDist = this._state.segDists[idx] || 0;
      return (1 - this._state.progress) * segDist + (this._state.cumDist[idx + 1] || 0);
    }

    // Fallback: compute on the fly
    const from = route[idx];
    const to = route[idx + 1];
    const segDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    let dist = (1 - this._state.progress) * segDist;
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
    const stops = this.getCurrentStops();
    if (this.currentStopIndex <= 0 || this.currentStopIndex > stops.length) return;

    const prevStop = stops[this.currentStopIndex - 1];
    if (!prevStop) return;

    const scheduledDepartureTime = prevStop.departureTime || 0;
    const nextStop = stops[this.currentStopIndex];

    if (this._routeAnalysis && this._routeAnalysis.segments.length > 0) {
      // Precise delay using route segment analysis
      const scheduledArrivalTime = nextStop?.arrivalTime ||
        (scheduledDepartureTime + this._routeAnalysis.estimatedTimeMinutes);
      const segments = this._routeAnalysis.segments;

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
      const totalScheduledTime = scheduledArrivalTime - scheduledDepartureTime;
      const expectedTimeAtPosition = scheduledDepartureTime + totalScheduledTime * timeFraction;

      this.delay = timeOfDay - expectedTimeAtPosition;
    } else {
      // Fallback: estimate delay using distance-based progress
      const scheduledArrivalTime = nextStop?.arrivalTime || (scheduledDepartureTime + 60);
      const target = this.getTargetStation();
      if (target && this.position) {
        const totalDist = haversineDistance(
          stops[this.currentStopIndex - 1]?.lat || this.position.lat,
          stops[this.currentStopIndex - 1]?.lon || this.position.lon,
          target.lat, target.lon
        );
        const remainDist = haversineDistance(this.position.lat, this.position.lon, target.lat, target.lon);
        const progress = totalDist > 0 ? Math.max(0, 1 - remainDist / totalDist) : 0;
        const totalScheduledTime = scheduledArrivalTime - scheduledDepartureTime;
        const expectedTime = scheduledDepartureTime + totalScheduledTime * progress;
        this.delay = timeOfDay - expectedTime;
      } else {
        this.delay = timeOfDay - scheduledDepartureTime;
      }
    }

    // Avoid -0 display
    const rounded = Math.round(this.delay);
    this.train.delay = rounded === 0 ? 0 : rounded;
  }

  /**
   * Fallback movement toward target station when no ORM route is available.
   */
  _moveDirectToTarget(dt, timeOfDay, target) {
    // Override target coords with station voie point if available
    let tLat = target.lat, tLon = target.lon;
    if (window.game?.voiePointManager) {
      const ns = this.getNextStop();
      if (ns && ns.stationId) {
        const plat = ns.platform || (this.isReturnLeg ? '2' : '1');
        const svp = window.game.voiePointManager.getStationVoiePoint(target.id, plat);
        if (svp) { tLat = svp.lat; tLon = svp.lon; }
      }
    }
    const dist = haversineDistance(this.position.lat, this.position.lon, tLat, tLon);

    if (dist < 0.3) {
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    // Incident effects (also in direct movement mode)
    const incident = this.train.incident;
    if (incident?.effect === 'stop') {
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'stopped';
      return;
    }

    let rameMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;
    if (incident?.effect === 'slow') {
      rameMaxSpeed = Math.min(rameMaxSpeed, incident.speedLimit || 30);
    }
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
      this.position.lat += (tLat - this.position.lat) * fraction;
      this.position.lon += (tLon - this.position.lon) * fraction;
      this.totalDistance += stepKm;
    }

    this.train.speed = Math.round(this.speed);
    this.train.totalKm = this.totalDistance;
    this.train.state = this.speed > 0 ? 'moving' : 'stopped';
    this.train.blockedBy = false;
    this._updateContinuousDelay(timeOfDay);
  }

  /**
   * Proximity-based block check fallback (when canton data unavailable).
   */
  _proximityBlockCheck(allServices) {
    if (!this.position || !allServices) return null;

    const route = this._state.cachedRoute || this.getCurrentRoute();
    if (!route || route.length < 2) return null;

    const myProgress = this._getRouteProgressKm(this.position, route, this._state.index);
    let nearestAheadDist = Infinity;
    let nearestAheadSpeed = 0;
    const vpm = window.game?.voiePointManager;
    const myVoie = this.train.platform || (vpm ? vpm.getVoieAtPosition(this.position) : null);

    for (const other of allServices) {
      if (other.id === this.id || !other.position || other.state === 'waiting' || other.state === 'stopped_at_station') continue;

      // Skip trains on a different voie (parallel tracks)
      const otherVoie = other.train?.platform || (vpm && other.position ? vpm.getVoieAtPosition(other.position) : null);
      if (myVoie && otherVoie && myVoie !== otherVoie) continue;

      const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
      if (rawDist > 30) continue;

      // Quick check: is other train near our route? Sample a few route points
      const rLen = route.length;
      const step = Math.max(1, Math.floor(rLen / 10));
      let nearRoute = false;
      for (let ri = 0; ri < rLen; ri += step) {
        if (haversineDistance(other.position.lat, other.position.lon, route[ri].lat, route[ri].lon) < 3) {
          nearRoute = true; break;
        }
      }
      if (!nearRoute) continue;

      const otherProgress = this._getRouteProgressKm(other.position, route, this._state.index);
      const ahead = this.isReturnLeg ? otherProgress < myProgress : otherProgress > myProgress;

      if (ahead) {
        const dist = Math.abs(otherProgress - myProgress);
        if (dist < nearestAheadDist) {
          nearestAheadDist = dist;
          nearestAheadSpeed = other.speed || 0;
        }
      }

      // Nez-à-nez detection: other train coming toward us on same track
      if (!ahead && rawDist < 3) {
        const otherRoute = other._state?.cachedRoute || other.getCurrentRoute?.();
        if (otherRoute && otherRoute.length >= 2) {
          const otherDir = other.isReturnLeg ? -1 : 1;
          const myDir = this.isReturnLeg ? -1 : 1;
          if (otherDir !== myDir) {
            const dist = Math.abs(otherProgress - myProgress);
            if (dist < nearestAheadDist) {
              nearestAheadDist = dist;
              nearestAheadSpeed = 0; // Full stop for head-on
            }
          }
        }
      }
    }

    if (nearestAheadDist === Infinity) return null;

    const lineSpeed = this.getLineSpeedAtPosition();
    let blockLength;
    if (lineSpeed <= 60) blockLength = 0.4;
    else if (lineSpeed <= 80) blockLength = 0.6;
    else if (lineSpeed <= 120) blockLength = 0.8;
    else if (lineSpeed <= 160) blockLength = 1.0;
    else if (lineSpeed <= 220) blockLength = 1.5;
    else blockLength = 1.8;

    if (nearestAheadDist < blockLength) return 0;
    if (nearestAheadDist < blockLength * 2) return Math.min(nearestAheadSpeed, 30);
    if (nearestAheadDist < blockLength * 3) return nearestAheadSpeed;

    return null;
  }

  _getRouteProgressKm(pos, route, hintIndex) {
    if (!pos || !route || route.length < 2) return 0;

    // Use hint index to limit search window — train is near its current segment
    let minDist = Infinity;
    let bestIdx = 0;
    const hint = hintIndex ?? 0;
    const lo = Math.max(0, hint - 50);
    const hi = Math.min(route.length, hint + 200);

    for (let i = lo; i < hi; i++) {
      const dlat = (pos.lat - route[i].lat) * 111;
      const dlon = (pos.lon - route[i].lon) * 111 * Math.cos(pos.lat * Math.PI / 180);
      const d = dlat * dlat + dlon * dlon;
      if (d < minDist) { minDist = d; bestIdx = i; }
    }

    // Use cached cumulative distances if available
    if (!route._cumDist) {
      route._cumDist = new Float64Array(route.length);
      for (let i = 1; i < route.length; i++) {
        const dlat = (route[i].lat - route[i-1].lat) * 111;
        const dlon = (route[i].lon - route[i-1].lon) * 111 * Math.cos(route[i].lat * Math.PI / 180);
        route._cumDist[i] = route._cumDist[i-1] + Math.sqrt(dlat * dlat + dlon * dlon);
      }
    }
    return route._cumDist[bestIdx];
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
    // Ensure economy ref is available (fallback to stored ref)
    if (!economy) economy = this._economy;
    const stops = this.getCurrentStops();
    const stop = stops[this.currentStopIndex];
    const expectedTime = stop?.arrivalTime;
    if (expectedTime != null) {
      this.delay = timeOfDay - expectedTime;
    }
    const roundedDelay = Math.round(this.delay);
    this.train.delay = roundedDelay === 0 ? 0 : roundedDelay;
    // Use voie point coords for arrival position
    let arrivalLat = station.lat, arrivalLon = station.lon;
    if (window.game?.voiePointManager && stop) {
      // Priority 1: use the exact voie point from the stop
      if (stop.voiePointId) {
        const vp = window.game.voiePointManager.getVoiePointById(stop.voiePointId);
        if (vp) { arrivalLat = vp.lat; arrivalLon = vp.lon; }
      }
      // Priority 2: look up by station + platform name
      else if (stop.platform) {
        const svp = window.game.voiePointManager.getStationVoiePoint(station.id, stop.platform);
        if (svp) { arrivalLat = svp.lat; arrivalLon = svp.lon; }
      }
    }
    this.position = { lat: arrivalLat, lon: arrivalLon };
    this.train.blockedBy = false;
    this._lastArrivalTime = timeOfDay;

    // Per-stop revenue: montée/descente voyageurs + chargement/déchargement fret
    if (economy && stop?.type === 'arret') {
      const firstArretIdx = stops.findIndex(s => s.type === 'arret');
      const lastArretIdx = stops.length - 1 - [...stops].reverse().findIndex(s => s.type === 'arret');
      const isFirst = this.currentStopIndex === firstArretIdx;
      const isTerminus = this.currentStopIndex === lastArretIdx;
      // Compute distance from last 'arret' stop (sum all route segments since then)
      let distFromPrev = 0;
      if (!isFirst && this.routes) {
        // Find the previous 'arret' stop index
        let prevArretIdx = this.currentStopIndex - 1;
        while (prevArretIdx > 0 && stops[prevArretIdx]?.type !== 'arret') {
          prevArretIdx--;
        }
        // Sum all route segments from prevArretIdx to currentStopIndex
        for (let seg = prevArretIdx; seg < this.currentStopIndex; seg++) {
          const routeIdx = this.isReturnLeg
            ? this.routes.length - 1 - seg
            : seg;
          const route = this.routes[Math.max(0, Math.min(routeIdx, this.routes.length - 1))];
          if (route && route.length >= 2) {
            for (let k = 1; k < route.length; k++) {
              distFromPrev += haversineDistance(route[k - 1].lat, route[k - 1].lon, route[k].lat, route[k].lon);
            }
          }
        }
        if (distFromPrev <= 0) distFromPrev = 20; // fallback
      }
      economy.processStopRevenue(this, station.name, distFromPrev, isFirst, isTerminus);
    }

    // For passage and waypoint stops, maintain speed (no stop-and-go)
    const isPassThrough = stop?.type === 'waypoint' || stop?.type === 'passage';
    if (isPassThrough) {
      // Keep current speed, just update position and continue
      this.train.stoppedAt = null;
      this.state = 'moving';
    } else {
      this.speed = 0;
      this.train.speed = 0;
      this.train.stoppedAt = station;
      this.state = 'stopped_at_station';
      if (!this.train._stoppedSinceGameTime) {
        this.train._stoppedSinceGameTime = timeOfDay;
      }
    }

    // Release all cantons for this train on arrival
    cantonManager.releaseAll(this.id);

    // Release previous voie point occupation and occupy new one
    if (window.game?.voiePointManager) {
      const vpm = window.game.voiePointManager;
      vpm.releaseAllVoiePointsForTrain(this.id);
      vpm.releaseAllForTrain(this.id);
    }

    // Platform management: assign a platform at this station
    // If stop has a voiePointId, force the voie from the voie point
    if (stop?.voiePointId && window.game?.voiePointManager) {
      const vp = window.game.voiePointManager.getVoiePointById(stop.voiePointId);
      if (vp) {
        this._platformAssignment = { stationId: station.id, platform: vp.voie };
        this.train.platform = vp.voie;
      }
    } else if ((stop?.type === 'arret' || (stop?.type === 'waypoint' && stop.platform)) && window.game?.platformManager) {
      const pm = window.game.platformManager;
      let preferred = stop.platform || '';
      const forced = !!stop.platform;
      if (!preferred) {
        preferred = this.isReturnLeg ? '2' : '1';
      }
      if (forced) {
        this._platformAssignment = { stationId: station.id, platform: preferred };
        this.train.platform = preferred;
      } else {
        const plat = pm.assignPlatform(station.id, this.id, station.platforms || 2, preferred);
        this._platformAssignment = plat ? { stationId: station.id, platform: plat } : null;
        this.train.platform = plat;
        if (!plat) {
          console.warn(`No free platform at ${station.name} for ${this.name}`);
        }
      }
    }

    // Occupy station voie point if one exists for this platform
    if (window.game?.voiePointManager && this.train.platform && !isPassThrough) {
      const vpm = window.game.voiePointManager;
      const stationVP = vpm.getStationVoiePoint(station.id, this.train.platform);
      if (stationVP) {
        vpm.occupyVoiePoint(stationVP.id, this.id);
      }
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

    // Release all voie points
    if (window.game?.voiePointManager) {
      window.game.voiePointManager.releaseAllVoiePointsForTrain(this.id);
      window.game.voiePointManager.releaseAllForTrain(this.id);
    }

    // Release platform if still assigned
    if (this._platformAssignment && window.game?.platformManager) {
      window.game.platformManager.releasePlatform(
        this._platformAssignment.stationId, this.id
      );
      this._platformAssignment = null;
      this.train.platform = null;
    }

    if (this.roundTrip && !this.isReturnLeg) {
      this.returnStops = this.buildReturnStops();
      this.isReturnLeg = true;
      this.currentStopIndex = 0;
      this._tripCount = (this._tripCount || 0) + 1;
      // Switch to return name if defined
      if (this.returnName) this.train.name = this.returnName;
      // Start the return leg immediately (schedule as stopped_at_station for terminus wait)
      this.state = 'stopped_at_station';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      // Set next departure time based on terminus wait
      this._nextDepartureTime = (this._lastArrivalTime || 0) + this.terminusWait;
      return;
    }

    // Check for multi round-trip (additional departures)
    if (this.roundTrip && this.isReturnLeg && this.multiDepartures && this._tripCount < this.multiDepartures) {
      this.isReturnLeg = false;
      this.currentStopIndex = 0;
      // Switch back to forward name
      this.train.name = this.name;
      this.state = 'stopped_at_station';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      this.revenueCollected = false;
      this._nextDepartureTime = (this._lastArrivalTime || 0) + this.terminusWait;
      // Rebuild forward stops with adjusted times for new trip
      this._adjustedStops = this._rebuildStopsFromTime(this._nextDepartureTime);
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
    this._adjustedStops = null;

    if (this.stops.length > 0 && this.world) {
      const firstStation = this.world.getStationById(this.stops[0].stationId);
      if (firstStation) {
        this.position = { lat: firstStation.lat, lon: firstStation.lon };
        this.train.stoppedAt = firstStation;
      }
    }
  }

  _rebuildStopsFromTime(departureTime) {
    const offset = departureTime - (this.stops[0]?.departureTime || 0);
    return this.stops.map(s => new ServiceStop(
      s.stationId, s.type,
      (s.departureTime || 0) + offset,
      (s.arrivalTime || 0) + offset,
      s.voiePointId, s.platform
    ));
  }

  buildReturnStops() {
    const fwdStops = this._adjustedStops || this.stops;
    if (!fwdStops || fwdStops.length === 0) return [];
    const reversed = [...fwdStops].reverse();
    const lastStop = fwdStops[fwdStops.length - 1];
    const lastArrival = lastStop.arrivalTime || lastStop.departureTime || 0;
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

      // Default: swap platform for return leg (voie 1 ↔ voie 2)
      let returnPlat = stop.platform;
      if (this.returnPlatforms && stop.stationId && this.returnPlatforms[stop.stationId]) {
        returnPlat = this.returnPlatforms[stop.stationId];
      } else if (returnPlat === '1' || returnPlat === 'Voie 1') {
        returnPlat = '2';
      } else if (returnPlat === '2' || returnPlat === 'Voie 2') {
        returnPlat = '1';
      } else if (/^\d+$/.test(returnPlat)) {
        // Numeric platform: swap odd↔even (1↔2, 3↔4, etc.)
        const n = parseInt(returnPlat, 10);
        returnPlat = String(n % 2 === 0 ? n - 1 : n + 1);
      }
      const rs = new ServiceStop(stop.stationId, stop.type, depTime, arrTime, stop.voiePointId, returnPlat);
      return rs;
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

  duplicateService(id, intervalMin, count, rame, world) {
    const src = this.services.find(s => s.id === id);
    if (!src) return [];
    const created = [];
    for (let i = 1; i <= count; i++) {
      const offset = intervalMin * i;
      const newStops = src.stops.map(st => ({
        stationId: st.stationId, type: st.type,
        departureTime: st.departureTime + offset,
        arrivalTime: st.arrivalTime + offset,
        voiePointId: st.voiePointId || null, platform: st.platform || '',
      }));
      const svc = this.addService({
        name: `${src.name} +${offset}min`,
        rameId: src.rameId, stops: newStops, routes: src.routes,
        roundTrip: src.roundTrip, multiDepartures: src.multiDepartures,
        terminusWait: src.terminusWait, totalDistance: src.totalDistance,
        isWorkTrain: src.isWorkTrain, returnName: src.returnName,
        returnPlatforms: src.returnPlatforms,
      }, rame, world);
      created.push(svc);
    }
    return created;
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
        voiePointId: st.voiePointId || null,
        type: st.type,
        departureTime: st.departureTime,
        arrivalTime: st.arrivalTime,
        platform: st.platform || '',
      })),
      routes: s.routes,
      roundTrip: s.roundTrip,
      multiDepartures: s.multiDepartures,
      terminusWait: s.terminusWait,
      totalDistance: s.totalDistance,
      active: s.active,
      isWorkTrain: s.isWorkTrain || false,
      returnName: s.returnName || '',
      returnPlatforms: s.returnPlatforms || {},
      // Runtime state persistence
      _runtime: {
        currentStopIndex: s.currentStopIndex,
        state: s.state,
        isReturnLeg: s.isReturnLeg,
        _tripCount: s._tripCount || 0,
        position: s.position ? { lat: s.position.lat, lon: s.position.lon } : null,
        speed: s.speed,
        delay: s.delay,
        completed: s.completed,
        completedDate: s.completedDate || '',
        direction: s.direction,
        revenueCollected: s.revenueCollected,
        _nextDepartureTime: s._nextDepartureTime ?? null,
        _lastArrivalTime: s._lastArrivalTime ?? null,
        _onboardPax: s._onboardPax || 0,
        _onboardFreight: s._onboardFreight || 0,
        _adjustedStops: s._adjustedStops ? s._adjustedStops.map(st => ({
          stationId: st.stationId, type: st.type,
          departureTime: st.departureTime, arrivalTime: st.arrivalTime,
        })) : null,
        _simState: { index: s._state.index, progress: s._state.progress, legKey: s._state.legKey || null },
        trainSpeed: s.train?.speed || 0,
        trainState: s.train?.state || 'waiting',
        trainTotalKm: s.train?.totalKm || 0,
        trainTotalKmRun: s.train?.totalKmRun || 0,
        trainKmSinceLastMaint: s.train?.kmSinceLastMaint || 0,
        trainWearLevel: s.train?.wearLevel || 0,
        trainInMaintenance: s.train?.inMaintenance || false,
      },
    }));
  }

  loadFromSave(arr, rameManager, world) {
    this.services = [];
    // Clear all canton reservations to prevent stale blocks after crash/reload
    cantonManager.cantons.clear();
    cantonManager.routeCantons.clear();
    cantonManager.trainCantons.clear();
    for (const d of arr) {
      const rame = rameManager.getById(d.rameId);
      const svc = new ActiveService(d, rame, world);
      svc.totalDistance = d.totalDistance || 0;
      svc.active = d.active !== false;

      // Restore runtime state if saved
      if (d._runtime) {
        const rt = d._runtime;
        svc.currentStopIndex = rt.currentStopIndex || 0;
        svc.state = rt.state || 'waiting';
        svc.isReturnLeg = rt.isReturnLeg || false;
        svc._tripCount = rt._tripCount || 0;
        if (rt.position) svc.position = { lat: rt.position.lat, lon: rt.position.lon };
        svc.speed = rt.speed || 0;
        svc.delay = rt.delay || 0;
        svc.completed = rt.completed || false;
        svc.completedDate = rt.completedDate || '';
        svc.direction = rt.direction || 1;
        svc.revenueCollected = rt.revenueCollected || false;
        svc._nextDepartureTime = rt._nextDepartureTime ?? null;
        svc._lastArrivalTime = rt._lastArrivalTime ?? null;
        svc._onboardPax = rt._onboardPax || 0;
        svc._onboardFreight = rt._onboardFreight || 0;
        if (rt._adjustedStops) {
          svc._adjustedStops = rt._adjustedStops.map(s => new ServiceStop(
            s.stationId, s.type, s.departureTime, s.arrivalTime
          ));
        }
        if (rt._simState) {
          svc._state.index = rt._simState.index || 0;
          svc._state.progress = rt._simState.progress || 0;
          svc._state.legKey = rt._simState.legKey || null;
          // Rebuild cached route so train can continue moving
          if (svc._state.legKey && svc.state === 'moving') {
            const route = svc.getCurrentRoute();
            if (route && route.length >= 2) {
              svc._state.cachedRoute = route;
            }
          }
        }
        svc.train.speed = rt.trainSpeed || 0;
        svc.train.state = rt.trainState || 'waiting';
        svc.train.totalKm = rt.trainTotalKm || 0;
        svc.train.delay = rt.delay || 0;
        svc.train.totalKmRun = rt.trainTotalKmRun || 0;
        svc.train.kmSinceLastMaint = rt.trainKmSinceLastMaint || 0;
        svc.train.wearLevel = rt.trainWearLevel || 0;
        svc.train.inMaintenance = rt.trainInMaintenance || false;
        svc.train.blockedBy = false; // Reset on load — will be recomputed

        // Rebuild return stops if on return leg
        if (svc.isReturnLeg && svc.roundTrip) {
          svc.returnStops = svc.buildReturnStops();
          if (svc.returnName) svc.train.name = svc.returnName;
        }

        // Restore position from current station if stopped and no position saved
        if (!rt.position && svc.state === 'stopped_at_station') {
          const stops = svc.isReturnLeg ? svc.returnStops : svc.stops;
          const stopIdx = Math.max(0, svc.currentStopIndex - 1);
          if (stops[stopIdx]) {
            const st = world.getStationById(stops[stopIdx].stationId);
            if (st) {
              svc.position = { lat: st.lat, lon: st.lon };
              svc.train.stoppedAt = st;
            }
          }
        }
      }

      this.services.push(svc);
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextServiceId) nextServiceId = num + 1;
    }
  }
}
