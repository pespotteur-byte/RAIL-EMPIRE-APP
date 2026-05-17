import { haversineDistance } from './simulation.js?v=1778517600';

let nextIncId = 1;

export class Incident {
  constructor(data) {
    this.id = data.id || `inc-${nextIncId++}`;
    this.name = data.name || 'Incident';
    this.trackName = data.trackName || '';
    this.stationA = data.stationA || null;
    this.stationB = data.stationB || null;
    this.stationAName = data.stationAName || '';
    this.stationBName = data.stationBName || '';
    this.effect = data.effect || 'slow';
    this.speedLimit = data.speedLimit || 0;
    this.route = data.route || null;
    this.duration = data.duration || 60;
    this.remaining = data.remaining ?? this.duration;
    this.active = data.active !== false;
    this.startTime = data.startTime || 0;
  }
}

export class IncidentManager {
  constructor() {
    this.activeIncidents = [];
    this.lastCheck = -1;
  }

  createIncident(data, world) {
    const inc = new Incident(data);
    this.activeIncidents.push(inc);

    // Mark the specific track between stationA and stationB
    if (world) this._markAffectedTracks(inc, world);

    return inc;
  }

  _markAffectedTracks(inc, world) {
    if (!inc.stationA || !inc.stationB) return;
    // Mark only the direct track between these two stations
    for (const track of world.tracks) {
      const matches = (track.stationA === inc.stationA && track.stationB === inc.stationB) ||
                      (track.stationA === inc.stationB && track.stationB === inc.stationA);
      if (matches) {
        track.incidentActive = true;
        track.incidentEffect = inc.effect;
        track.incidentSpeedLimit = inc.speedLimit;
        track.incidentName = inc.name;
        if (!track._incidentIds) track._incidentIds = [];
        track._incidentIds.push(inc.id);
      }
    }
  }

  removeIncident(id, world) {
    const inc = this.activeIncidents.find(i => i.id === id);
    if (inc) {
      inc.active = false;
      this._clearTrackFlags(inc, world);
    }
    this.activeIncidents = this.activeIncidents.filter(i => i.id !== id);
  }

  _clearTrackFlags(inc, world) {
    if (!world) return;
    for (const track of world.tracks) {
      if (track._incidentIds) {
        track._incidentIds = track._incidentIds.filter(iid => iid !== inc.id);
        if (track._incidentIds.length === 0) {
          track.incidentActive = false;
          track.incidentEffect = null;
          track.incidentSpeedLimit = null;
          track.incidentName = null;
        }
      }
    }
  }

  // Check if a position is on the incident's route (within tolerance)
  _isOnRoute(lat, lon, route) {
    if (!route || route.length < 2) return false;
    // Check proximity to each segment of the route
    for (let i = 0; i < route.length - 1; i++) {
      const aLat = route[i].lat, aLon = route[i].lon;
      const bLat = route[i + 1].lat, bLon = route[i + 1].lon;
      // Distance from point to segment (simplified: check distance to both endpoints and midpoint)
      const dA = haversineDistance(lat, lon, aLat, aLon);
      const dB = haversineDistance(lat, lon, bLat, bLon);
      if (dA < 0.5 || dB < 0.5) return true; // within 500m of a route point
      // Check distance to segment midpoint for long segments
      const segLen = haversineDistance(aLat, aLon, bLat, bLon);
      if (segLen > 0.3) {
        const mLat = (aLat + bLat) / 2, mLon = (aLon + bLon) / 2;
        if (haversineDistance(lat, lon, mLat, mLon) < 0.5) return true;
      }
    }
    return false;
  }

  // Fallback: check if position is between stationA and stationB using bounding box
  _isBetweenStations(lat, lon, world, inc) {
    const stA = world.getStationById(inc.stationA);
    const stB = world.getStationById(inc.stationB);
    if (!stA || !stB) return false;
    // Check if within the corridor between the two stations (1km buffer)
    const minLat = Math.min(stA.lat, stB.lat) - 0.01;
    const maxLat = Math.max(stA.lat, stB.lat) + 0.01;
    const minLon = Math.min(stA.lon, stB.lon) - 0.01;
    const maxLon = Math.max(stA.lon, stB.lon) + 0.01;
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
    // Also check proximity to the straight line between stations (max 2km off the line)
    const totalDist = haversineDistance(stA.lat, stA.lon, stB.lat, stB.lon);
    const dA = haversineDistance(lat, lon, stA.lat, stA.lon);
    const dB = haversineDistance(lat, lon, stB.lat, stB.lon);
    return (dA + dB) < totalDist + 2;
  }

  update(timeOfDay, services, depotManager, world) {
    if (timeOfDay !== this.lastCheck) {
      this.lastCheck = timeOfDay;
      for (const inc of this.activeIncidents) {
        inc.remaining -= 1;
        if (inc.remaining <= 0) {
          inc.active = false;
          this._clearTrackFlags(inc, world);
        }
      }
      this.activeIncidents = this.activeIncidents.filter(i => i.active);
    }

    this.checkTrainPositions(services, depotManager, world);
  }

  checkTrainPositions(services, depotManager, world) {
    if (!services || this.activeIncidents.length === 0) {
      for (const svc of (services || [])) {
        if (svc?.train) svc.train.incident = null;
      }
      return;
    }

    for (const svc of services) {
      if (!svc.train || !svc.position) continue;
      svc.train.incident = null;

      let worstIncident = null;
      for (const inc of this.activeIncidents) {
        if (!inc.active) continue;
        // Route-based check: is the train on the incident's route?
        let affected = false;
        if (inc.route) {
          affected = this._isOnRoute(svc.position.lat, svc.position.lon, inc.route);
        } else if (world) {
          affected = this._isBetweenStations(svc.position.lat, svc.position.lon, world, inc);
        }
        if (!affected) continue;

        if (!worstIncident || inc.effect === 'stop') {
          worstIncident = inc;
          if (inc.effect === 'stop') break;
        } else if (worstIncident.effect === 'slow' && inc.effect === 'slow') {
          if (inc.speedLimit < worstIncident.speedLimit) worstIncident = inc;
        }
      }
      if (worstIncident) {
        svc.train.incident = {
          effect: worstIncident.effect,
          speedLimit: worstIncident.speedLimit || 0,
          name: worstIncident.name,
        };
        if (worstIncident.effect === 'stop' && depotManager && world) {
          const alreadyRescued = depotManager.activeRescues?.some(r => r.targetServiceId === svc.id && r.state !== 'done');
          if (!alreadyRescued) {
            depotManager.dispatchRescue(world, svc);
          }
        }
      }
    }
  }

  getActiveIncidents() {
    return this.activeIncidents;
  }

  getCustomTypes() { return []; }
  loadCustomTypes() {}
  getAllTypes() { return []; }

  getActiveIncidentsSave() {
    return this.activeIncidents.map(inc => ({
      id: inc.id,
      name: inc.name,
      trackName: inc.trackName,
      stationA: inc.stationA,
      stationB: inc.stationB,
      stationAName: inc.stationAName,
      stationBName: inc.stationBName,
      effect: inc.effect,
      speedLimit: inc.speedLimit,
      route: inc.route,
      duration: inc.duration,
      remaining: inc.remaining,
      active: inc.active,
      startTime: inc.startTime,
    }));
  }

  loadFromSave(arr, world) {
    this.activeIncidents = [];
    if (!arr) return;
    for (const d of arr) {
      const inc = new Incident(d);
      this.activeIncidents.push(inc);
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextIncId) nextIncId = num + 1;
      if (world) this._markAffectedTracks(inc, world);
    }
  }
}
