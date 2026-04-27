let nextIncId = 1;

const DEFAULT_TYPES = [
  { id: 'breakdown', name: 'Panne mecanique', icon: '🔧', effect: 'stop', minDuration: 15, maxDuration: 60, probability: 0.005 },
  { id: 'signal_failure', name: 'Signalisation HS', icon: '🚦', effect: 'slow', speedLimit: 30, minDuration: 15, maxDuration: 60, probability: 0.003 },
  { id: 'track_blocked', name: 'Voie bloquee', icon: '🚫', effect: 'stop', minDuration: 20, maxDuration: 90, probability: 0.002 },
  { id: 'weather', name: 'Intemperies', icon: '🌧', effect: 'slow', speedLimit: 80, minDuration: 30, maxDuration: 120, probability: 0.004 },
];

export class Incident {
  constructor(type, track) {
    this.id = `inc-${nextIncId++}`;
    this.type = type;
    this.trackId = track?.id || null;
    this.trackName = track?.name || '';
    this.stationA = track?.stationA || null;
    this.stationB = track?.stationB || null;
    this.startTime = 0;
    this.duration = type.minDuration + Math.random() * (type.maxDuration - type.minDuration);
    this.remaining = this.duration;
    this.active = true;
    this.effect = type.effect;
    this.speedLimit = type.speedLimit || 0;
    this.name = type.name;
    this.icon = type.icon || '⚠';
  }
}

export class IncidentManager {
  constructor() {
    this.incidentTypes = [...DEFAULT_TYPES];
    this.customTypes = [];
    this.activeIncidents = [];
    this.lastCheck = -1;
    this.breakdownQueue = [];
  }

  addCustomType(data) {
    const type = {
      id: `custom-${Date.now()}`,
      name: data.name || 'Incident',
      icon: '⚠',
      effect: data.impact === 'stop' ? 'stop' : 'slow',
      speedLimit: data.speedLimit || 30,
      minDuration: data.minDuration || 15,
      maxDuration: data.maxDuration || 60,
      probability: data.probability || 0.01,
      custom: true,
    };
    this.customTypes.push(type);
    return type;
  }

  updateCustomType(id, data) {
    const type = this.customTypes.find(t => t.id === id);
    if (!type) return;
    if (data.name) type.name = data.name;
    if (data.impact) type.effect = data.impact === 'stop' ? 'stop' : 'slow';
    if (data.speedLimit) type.speedLimit = data.speedLimit;
    if (data.minDuration) type.minDuration = data.minDuration;
    if (data.maxDuration) type.maxDuration = data.maxDuration;
    if (data.probability !== undefined) type.probability = data.probability;
  }

  removeCustomType(id) {
    this.customTypes = this.customTypes.filter(t => t.id !== id);
  }

  getAllTypes() {
    return [...this.incidentTypes, ...this.customTypes];
  }

  getCustomTypes() {
    return this.customTypes.map(t => ({
      id: t.id, name: t.name, effect: t.effect,
      speedLimit: t.speedLimit, minDuration: t.minDuration,
      maxDuration: t.maxDuration, probability: t.probability,
    }));
  }

  loadCustomTypes(arr) {
    this.customTypes = arr.map(t => ({ ...t, icon: '⚠', custom: true }));
  }

  // Check if a service is on a track affected by an incident
  getIncidentForService(svc) {
    if (!svc || !svc.position || svc.state !== 'moving') return null;

    for (const inc of this.activeIncidents) {
      if (!inc.active || !inc.trackId) continue;

      // Check if service is currently on this track
      const currentStops = svc.getCurrentStops();
      if (!currentStops || svc.currentStopIndex < 1) continue;

      const prevStop = currentStops[svc.currentStopIndex - 1];
      const nextStop = currentStops[svc.currentStopIndex];
      if (!prevStop || !nextStop) continue;

      const onTrack =
        (prevStop.stationId === inc.stationA && nextStop.stationId === inc.stationB) ||
        (prevStop.stationId === inc.stationB && nextStop.stationId === inc.stationA);

      if (onTrack) {
        return { effect: inc.effect, speedLimit: inc.speedLimit, name: inc.name };
      }
    }
    return null;
  }

  update(timeOfDay, services, depotManager, world) {
    if (timeOfDay === this.lastCheck) return;
    this.lastCheck = timeOfDay;

    // Update remaining time for active incidents
    for (const inc of this.activeIncidents) {
      inc.remaining -= 1;
      if (inc.remaining <= 0) {
        inc.active = false;
        // Clear track incident flags
        if (world && inc.trackId) {
          const track = world.tracks.find(t => t.id === inc.trackId);
          if (track) {
            track.incidentActive = false;
            track.incidentEffect = null;
            track.incidentSpeedLimit = null;
            track.incidentName = null;
          }
        }
      }
    }
    this.activeIncidents = this.activeIncidents.filter(i => i.active);

    // Apply active incidents to all trains on affected tracks
    for (const svc of services) {
      if (!svc.train) continue;
      const inc = this.getIncidentForService(svc);
      if (inc) {
        svc.train.incident = inc;
      } else if (svc.train.incident && !svc.train.breakdown) {
        svc.train.incident = null;
      }
    }

    if (depotManager) {
      this.processBreakdownRepairs(services, depotManager, timeOfDay);
    }

    // Generate new random incidents on tracks
    if (!world || !world.tracks || world.tracks.length === 0) return;

    const allTypes = this.getAllTypes();
    for (const type of allTypes) {
      if (Math.random() < type.probability) {
        // Pick a random track that doesn't already have an incident
        const availableTracks = world.tracks.filter(t => !t.incidentActive && !t.worksActive);
        if (availableTracks.length === 0) continue;

        const track = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        const incident = new Incident(type, track);
        incident.startTime = timeOfDay;
        this.activeIncidents.push(incident);

        // Set track flags for visual rendering
        track.incidentActive = true;
        track.incidentEffect = type.effect;
        track.incidentSpeedLimit = type.speedLimit;
        track.incidentName = type.name;

        // If breakdown type, mark any train currently on this track
        if (type.id === 'breakdown') {
          for (const svc of services) {
            if (!svc.train || svc.train.breakdown) continue;
            const onTrack = this.isServiceOnTrack(svc, track);
            if (onTrack) {
              svc.train.breakdown = { needsRepair: false, repairTime: 0 };
              break;
            }
          }
        }
      }
    }
  }

  isServiceOnTrack(svc, track) {
    if (!svc || svc.state !== 'moving') return false;
    const stops = svc.getCurrentStops();
    if (!stops || svc.currentStopIndex < 1) return false;
    const prev = stops[svc.currentStopIndex - 1];
    const next = stops[svc.currentStopIndex];
    if (!prev || !next) return false;
    return (prev.stationId === track.stationA && next.stationId === track.stationB) ||
           (prev.stationId === track.stationB && next.stationId === track.stationA);
  }

  processBreakdownRepairs(services, depotManager, timeOfDay) {
    for (const svc of services) {
      if (svc.train?.breakdown?.needsRepair) {
        const station = svc.train.stoppedAt;
        if (!station) continue;

        const depots = depotManager.getByStation(station.id);
        if (depots.length > 0) {
          svc.train.breakdown.repairTime -= 1;
          if (svc.train.breakdown.repairTime <= 0) {
            svc.train.breakdown = null;
            svc.state = 'waiting';
          }
        }
      }
    }
  }

  getActiveIncidents() {
    return this.activeIncidents;
  }

  getBreakdownQueue() {
    return this.breakdownQueue;
  }
}
