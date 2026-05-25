import { haversineDistance } from './simulation.js?v=1779724771';

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
    const tolerance = 0.5; // 500m
    for (let i = 0; i < route.length - 1; i++) {
      const aLat = route[i].lat, aLon = route[i].lon;
      const bLat = route[i + 1].lat, bLon = route[i + 1].lon;
      // Point-to-segment distance using projection
      if (this._pointToSegmentDist(lat, lon, aLat, aLon, bLat, bLon) < tolerance) return true;
    }
    return false;
  }

  // Approximate point-to-segment distance in km
  _pointToSegmentDist(pLat, pLon, aLat, aLon, bLat, bLon) {
    const cosLat = Math.cos(pLat * Math.PI / 180);
    const dx = (bLon - aLon) * 111 * cosLat;
    const dy = (bLat - aLat) * 111;
    const px = (pLon - aLon) * 111 * cosLat;
    const py = (pLat - aLat) * 111;
    const segLenSq = dx * dx + dy * dy;
    if (segLenSq < 0.0001) return Math.sqrt(px * px + py * py);
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
    const projX = t * dx, projY = t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
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

    // Precompute incident bounding boxes for fast spatial skip
    if (!this._incBboxVer || this._incBboxVer !== this.activeIncidents.length) {
      this._incBboxVer = this.activeIncidents.length;
      for (const inc of this.activeIncidents) {
        if (inc._bbox) continue;
        if (inc.route && inc.route.length >= 2) {
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          for (const p of inc.route) {
            if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
            if (p.lon < minLon) minLon = p.lon; if (p.lon > maxLon) maxLon = p.lon;
          }
          inc._bbox = [minLat - 0.01, maxLat + 0.01, minLon - 0.01, maxLon + 0.01];
        } else if (world) {
          const stA = world.getStationById(inc.stationA);
          const stB = world.getStationById(inc.stationB);
          if (stA && stB) {
            inc._bbox = [Math.min(stA.lat, stB.lat) - 0.02, Math.max(stA.lat, stB.lat) + 0.02,
                         Math.min(stA.lon, stB.lon) - 0.02, Math.max(stA.lon, stB.lon) + 0.02];
          }
        }
      }
    }

    for (const svc of services) {
      if (!svc.train || !svc.position) continue;
      // Skip trains that aren't moving (no need to recheck)
      if (svc.state !== 'moving') { if (!svc.train.incident) continue; }
      svc.train.incident = null;

      const lat = svc.position.lat, lon = svc.position.lon;
      let worstIncident = null;
      for (const inc of this.activeIncidents) {
        if (!inc.active) continue;
        // Fast bbox reject
        if (inc._bbox && (lat < inc._bbox[0] || lat > inc._bbox[1] || lon < inc._bbox[2] || lon > inc._bbox[3])) continue;
        let affected = false;
        if (inc.route) {
          affected = this._isOnRoute(lat, lon, inc.route);
        } else if (world) {
          affected = this._isBetweenStations(lat, lon, world, inc);
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
