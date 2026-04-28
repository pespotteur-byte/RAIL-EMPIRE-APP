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
    this.icon = data.icon || '⚠';
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
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    if (timeOfDay === this.lastCheck) return;
    this.lastCheck = timeOfDay;

    // Update remaining time
    for (const inc of this.activeIncidents) {
      inc.remaining -= 1;
      if (inc.remaining <= 0) {
        inc.active = false;
        this._clearTrackFlags(inc, world);
      }
    }
    this.activeIncidents = this.activeIncidents.filter(i => i.active);

    // Incidents are visual/UI only
    for (const svc of services) {
      if (!svc.train) continue;
      if (svc.train.incident) svc.train.incident = null;
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
      icon: inc.icon,
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
