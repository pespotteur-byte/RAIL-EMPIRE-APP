import { haversine } from './world.js';

let nextServiceId = 1;

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
    this.terminusWait = data.terminusWait || 10;
    this.totalDistance = data.totalDistance || 0;
    this.active = data.active !== false;

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
      accel: 3.0,
      decel: 4.0,
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
        }
      }
      return;
    }

    if (this.state === 'stopped_at_station') {
      const stops = this.getCurrentStops();
      const stop = stops[this.currentStopIndex - 1];
      if (!stop) { this.state = 'moving'; return; }

      const depTime = stop.departureTime;
      if (stop.type === 'passage' || timeOfDay >= depTime) {
        if (this.currentStopIndex >= stops.length) {
          this.completeService(economy);
        } else {
          this.state = 'moving';
        }
      }
    }
  }

  // Called every 0.5s - handles smooth train movement
  moveUpdate(dt, timeOfDay, allServices) {
    if (!this.active || this.state !== 'moving') return;

    const target = this.getTargetStation();
    if (!target) return;

    const incident = this.train.incident;
    let lineMaxSpeed = this.getLineSpeedAtPosition();
    let rameMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;

    if (incident?.effect === 'stop') { this.speed = 0; this.train.speed = 0; return; }
    if (incident?.effect === 'slow') lineMaxSpeed = Math.min(lineMaxSpeed, incident.speedLimit || 30);

    const worksLimit = this.getWorksSpeedLimit();
    if (worksLimit === 0) { this.speed = 0; this.train.speed = 0; this.train.state = 'travaux'; return; }
    if (worksLimit !== null) lineMaxSpeed = Math.min(lineMaxSpeed, worksLimit);

    let maxSpd = Math.min(rameMaxSpeed, lineMaxSpeed);

    // --- CANTONNEMENT / BLOCK SIGNALING ---
    const blockLimit = this.getBlockSignalLimit(allServices || []);
    if (blockLimit !== null) {
      maxSpd = Math.min(maxSpd, blockLimit);
      this.train.blockedBy = blockLimit === 0;
    } else {
      this.train.blockedBy = false;
    }

    const from = this.position;
    const to = { lat: target.lat, lon: target.lon };
    const dist = haversine(from.lat, from.lon, to.lat, to.lon);

    if (dist < 0.3) {
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    // Acceleration/deceleration: accel km/h per second, dt in seconds
    const accelDelta = this.train.accel * dt;
    const decelDelta = this.train.decel * dt;

    const brakeDist = (this.speed * this.speed) / (2 * this.train.decel * 3600);
    if (dist < brakeDist + 1 && this.speed > 10) {
      this.speed = Math.max(10, this.speed - decelDelta);
    } else if (maxSpd === 0) {
      this.speed = Math.max(0, this.speed - decelDelta);
    } else if (this.speed < maxSpd) {
      this.speed = Math.min(maxSpd, this.speed + accelDelta);
    } else if (this.speed > maxSpd) {
      this.speed = Math.max(maxSpd, this.speed - decelDelta);
    }

    // Distance traveled this tick: speed (km/h) * dt (seconds) / 3600
    const stepKm = this.speed * dt / 3600;
    if (dist > 0 && stepKm > 0) {
      const route = this.getCurrentRoute();
      if (route && route.length > 1) {
        this.advanceAlongRoute(stepKm, route);
      } else {
        const fraction = Math.min(stepKm / dist, 1);
        this.position.lat += (to.lat - from.lat) * fraction;
        this.position.lon += (to.lon - from.lon) * fraction;
      }
      this.totalDistance += stepKm;
    }

    this.train.speed = Math.round(this.speed);
    this.train.totalKm = this.totalDistance;
    this.train.state = this.speed > 0 ? 'moving' : 'stopped';
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

  getLineSpeedAtPosition() {
    const route = this.getCurrentRoute();
    if (!route || route.length === 0) return 300;

    let minDist = Infinity;
    let bestSpeed = 160;
    for (const pt of route) {
      if (!this.position) break;
      const d = haversine(this.position.lat, this.position.lon, pt.lat, pt.lon);
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

  getRouteProgress(pos, route) {
    if (!pos || !route || route.length < 2) return 0;
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < route.length; i++) {
      const d = haversine(pos.lat, pos.lon, route[i].lat, route[i].lon);
      if (d < minDist) { minDist = d; bestIdx = i; }
    }
    let progress = 0;
    for (let i = 0; i < bestIdx && i < route.length - 1; i++) {
      progress += haversine(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
    }
    return progress;
  }

  getBlockSignalLimit(allServices) {
    if (!this.position || this.state !== 'moving') return null;

    const route = this.getCurrentRoute();
    if (!route || route.length < 2) return null;

    const lineSpeed = this.getLineSpeedAtPosition();
    let blockLength;
    if (lineSpeed <= 80) blockLength = 0.6;
    else if (lineSpeed <= 160) blockLength = 1.0;
    else if (lineSpeed <= 200) blockLength = 1.5;
    else blockLength = 2.5;

    const myProgress = this.getRouteProgress(this.position, route);
    let nearestAheadDist = Infinity;
    let nearestAheadSpeed = 0;

    for (const other of allServices) {
      if (other.id === this.id) continue;
      if (!other.position || other.state === 'waiting') continue;

      const rawDist = haversine(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
      if (rawDist > 30) continue;

      const otherOnRoute = this.getRouteProgress(other.position, route);
      const closestPt = route.reduce((best, pt) => {
        const d = haversine(other.position.lat, other.position.lon, pt.lat, pt.lon);
        return d < best.d ? { d, pt } : best;
      }, { d: Infinity, pt: null });

      if (closestPt.d > 1.5) continue;

      let ahead;
      if (this.isReturnLeg) {
        ahead = otherOnRoute < myProgress;
      } else {
        ahead = otherOnRoute > myProgress;
      }

      if (ahead) {
        const dist = Math.abs(otherOnRoute - myProgress);
        if (dist < nearestAheadDist) {
          nearestAheadDist = dist;
          nearestAheadSpeed = other.speed || 0;
        }
      }
    }

    if (nearestAheadDist === Infinity) return null;

    if (nearestAheadDist < blockLength) {
      return 0;
    } else if (nearestAheadDist < blockLength * 2) {
      return Math.min(nearestAheadSpeed, 30);
    } else if (nearestAheadDist < blockLength * 3) {
      return nearestAheadSpeed;
    }

    return null;
  }

  advanceAlongRoute(stepKm, route) {
    if (!this.position || !route || route.length < 2) return;

    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = haversine(this.position.lat, this.position.lon, route[i].lat, route[i].lon);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }

    let remaining = stepKm;
    let idx = closestIdx;

    while (remaining > 0 && idx < route.length - 1) {
      const nextIdx = idx + 1;
      if (nextIdx >= route.length) break;

      const segDist = haversine(route[idx].lat, route[idx].lon, route[nextIdx].lat, route[nextIdx].lon);
      if (segDist <= 0) { idx = nextIdx; continue; }

      if (remaining >= segDist) {
        remaining -= segDist;
        idx = nextIdx;
      } else {
        const frac = remaining / segDist;
        this.position.lat = route[idx].lat + (route[nextIdx].lat - route[idx].lat) * frac;
        this.position.lon = route[idx].lon + (route[nextIdx].lon - route[idx].lon) * frac;
        remaining = 0;
      }
    }

    if (remaining > 0 && idx >= 0 && idx < route.length) {
      this.position.lat = route[idx].lat;
      this.position.lon = route[idx].lon;
    }
  }

  arriveAtStation(station, timeOfDay, economy) {
    const stops = this.getCurrentStops();
    const stop = stops[this.currentStopIndex];
    const expectedTime = stop.arrivalTime;
    this.delay = Math.max(0, timeOfDay - expectedTime);
    this.train.delay = this.delay;
    this.position = { lat: station.lat, lon: station.lon };
    this.speed = 0;
    this.train.speed = 0;
    this.train.stoppedAt = station;

    if (stop.type === 'arret') {
      this.state = 'stopped_at_station';
    } else {
      this.state = 'moving';
    }

    this.currentStopIndex++;

    if (this.currentStopIndex >= stops.length) {
      this.completeService(economy);
    }
  }

  completeService(economy) {
    if (!this.revenueCollected && economy) {
      economy.processServiceRevenue(this);
      this.revenueCollected = true;
    }

    if (this.roundTrip && !this.isReturnLeg) {
      this.isReturnLeg = true;
      this.returnStops = this.buildReturnStops();
      this.currentStopIndex = 0;
      this.state = 'waiting';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      return;
    }

    this.state = 'waiting';
    this.currentStopIndex = 0;
    this.speed = 0;
    this.train.speed = 0;
    this.train.state = 'waiting';
    this.completed = true;
    this.completedDate = this._currentDate || '';
    this.isReturnLeg = false;
    this.revenueCollected = false;

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
