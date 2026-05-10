import { haversineDistance } from './simulation.js?v=1778402725';

let nextIncId = 1;

export class Incident {
  constructor(data, track) {
    this.id = data.id || `inc-${nextIncId++}`;
    this.name = data.name || 'Incident';
    this.trackId = track?.id || data.trackId || null;
    this.trackName = track?.name || data.trackName || '';
    this.stationA = track?.stationA || data.stationA || null;
    this.stationB = track?.stationB || data.stationB || null;
    this.effect = data.effect || 'slow';
    this.speedLimit = data.speedLimit || 0;
    this.radiusKm = data.radiusKm || 10;
    this.centerLat = data.centerLat || 0;
    this.centerLon = data.centerLon || 0;
    this.duration = data.duration || 60;
    this.remaining = data.remaining ?? this.duration;
    this.active = data.active !== false;
    this.startTime = data.startTime || 0;
    this.playerCreated = true;
  }
}

export class IncidentManager {
  constructor() {
    this.activeIncidents = [];
    this.lastCheck = -1;
  }

  createIncident(data, world) {
    const track = world?.tracks?.find(t => t.id === data.trackId);
    const inc = new Incident(data, track);

    if (track) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (stA && stB) {
        inc.centerLat = (stA.lat + stB.lat) / 2;
        inc.centerLon = (stA.lon + stB.lon) / 2;
      }
    }

    // Safety: ensure center coordinates are valid
    if (!inc.centerLat && !inc.centerLon && track) {
      console.warn('Incident center not set, using track direct coords');
    }

    this.activeIncidents.push(inc);

    // Mark affected tracks within radius (visual only)
    if (world) this._markAffectedTracks(inc, world);

    return inc;
  }

  _markAffectedTracks(inc, world) {
    if (!inc.centerLat || !inc.centerLon) {
      // Single track mode
      const track = world.tracks.find(t => t.id === inc.trackId);
      if (track) {
        track.incidentActive = true;
        track.incidentEffect = inc.effect;
        track.incidentSpeedLimit = inc.speedLimit;
        track.incidentName = inc.name;
      }
      return;
    }

    // Mark all tracks within radius
    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

      const midLat = (stA.lat + stB.lat) / 2;
      const midLon = (stA.lon + stB.lon) / 2;
      const dist = this._haversine(inc.centerLat, inc.centerLon, midLat, midLon);

      if (dist <= inc.radiusKm) {
        track.incidentActive = true;
        track.incidentEffect = inc.effect;
        track.incidentSpeedLimit = inc.speedLimit;
        track.incidentName = inc.name;
        if (!track._incidentIds) track._incidentIds = [];
        track._incidentIds.push(inc.id);
      }
    }
  }

  _haversine(lat1, lon1, lat2, lon2) {
    return haversineDistance(lat1, lon1, lat2, lon2);
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
      } else if (track.incidentActive && track.id === inc.trackId) {
        track.incidentActive = false;
        track.incidentEffect = null;
        track.incidentSpeedLimit = null;
        track.incidentName = null;
      }
    }
  }

  update(timeOfDay, services, depotManager, world) {
    // Time countdown: only once per game-minute
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

    // Position check: runs EVERY call (not just per-minute) so newly created
    // incidents affect trains already in the zone immediately
    this.checkTrainPositions(services, depotManager, world);
  }

  // Separate method so it can be called from moveTick as well
  checkTrainPositions(services, depotManager, world) {
    if (!services || this.activeIncidents.length === 0) {
      // Clear incident flags when no incidents active
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
        const dist = this._haversine(svc.position.lat, svc.position.lon, inc.centerLat, inc.centerLon);
        if (dist <= (inc.radiusKm || 10)) {
          if (!worstIncident || inc.effect === 'stop') {
            worstIncident = inc;
            if (inc.effect === 'stop') break;
          } else if (worstIncident.effect === 'slow' && inc.effect === 'slow') {
            if (inc.speedLimit < worstIncident.speedLimit) worstIncident = inc;
          }
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

  // No pre-included types - backward compat stubs
  getCustomTypes() { return []; }
  loadCustomTypes() {}
  getAllTypes() { return []; }

  getActiveIncidentsSave() {
    return this.activeIncidents.map(inc => ({
      id: inc.id,
      name: inc.name,
      trackId: inc.trackId,
      trackName: inc.trackName,
      stationA: inc.stationA,
      stationB: inc.stationB,
      effect: inc.effect,
      speedLimit: inc.speedLimit,
      radiusKm: inc.radiusKm,
      centerLat: inc.centerLat,
      centerLon: inc.centerLon,
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
