import { haversineDistance } from './simulation.js?v=1784931688';
import { getGlobalRng } from './rng.js?v=1784931688';

let nextIncId = 1;

export const PREDEFINED_INCIDENT_TYPES = [
  {
    id: 'signal-failure',
    name: 'Panne de signalisation',
    impact: 'Ralentissement 30 km/h',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'slow',
    speedLimit: 30,
    scope: 'track',
  },
  {
    id: 'person-accident',
    name: 'Accident de personne',
    impact: 'Interruption des circulations',
    special: 'aucune',
    probability: 2.5,
    seasons: ['all'],
    durationMin: 120,
    durationMax: 240,
    effect: 'stop',
    speedLimit: 0,
    scope: 'track',
  },
  {
    id: 'power-failure',
    name: 'Défaut d\'alimentation électrique',
    impact: 'Interruption des circulations',
    special: 'Ligne électrifiée',
    probability: 7,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'stop',
    speedLimit: 0,
    scope: 'track',
    requireElectrified: true,
  },
  {
    id: 'door-problem',
    name: 'Problème de porte',
    impact: 'Interruption d\'un seul train, uniquement à l\'arrêt EN GARE',
    special: 'Train de voyageur',
    probability: 7,
    seasons: ['all'],
    durationMin: 5,
    durationMax: 5,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
    requirePassenger: true,
    requireStopped: true,
  },
  {
    id: 'crowding',
    name: 'Forte affluence à bord',
    impact: 'Interruption d\'un seul train, uniquement à l\'arrêt EN GARE',
    special: 'Train de voyageur retardé ou effectuant des arrêts proches. Uniquement de 7h à 10h30 et de 16h30 à 20h30.',
    probability: 7,
    seasons: ['all'],
    durationMin: 5,
    durationMax: 10,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
    requirePassenger: true,
    requireStopped: true,
    timeWindows: [[7 * 60, 10 * 60 + 30], [16 * 60 + 30, 20 * 60 + 30]],
  },
  {
    id: 'train-breakdown',
    name: 'Train en panne',
    impact: 'Interruption d\'un seul train. Si le jeu considère la panne légère celui-ci pourra repartir. En cas contraire une DDS devra être effectuée.',
    special: 'aucune',
    probability: 4.5, // winter base
    summerProbability: 7.5,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 45,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
  },
  {
    id: 'abandoned-luggage',
    name: 'Bagage abandonné',
    impact: 'Interruption des circulations',
    special: 'Uniquement aux gares',
    probability: 7.5,
    seasons: ['all'],
    durationMin: 30,
    durationMax: 60,
    effect: 'stop',
    speedLimit: 0,
    scope: 'station',
  },
];

export class Incident {
  constructor(data) {
    this.id = data.id || `inc-${nextIncId++}`;
    this.typeId = data.typeId || '';
    this.name = data.name || 'Incident';
    this.trackName = data.trackName || '';
    this.stationA = data.stationA || null;
    this.stationB = data.stationB || null;
    this.stationAName = data.stationAName || '';
    this.stationBName = data.stationBName || '';
    this.trainId = data.trainId || null;
    this.serviceId = data.serviceId || null;
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
    this.predefinedTypes = PREDEFINED_INCIDENT_TYPES;
    this.enabledTypes = new Set(PREDEFINED_INCIDENT_TYPES.map(t => t.id));
    this.lastTriggerHour = -1;
    this._incBboxVer = null;
    this.accordionHorizonKm = 3.0; // INC-03 : effet accordéon avant la zone d'incident
  }

  isTypeEnabled(id) { return this.enabledTypes.has(id); }
  getEnabledTypes() { return Array.from(this.enabledTypes); }
  setEnabledTypes(ids) {
    this.enabledTypes = new Set(Array.isArray(ids) ? ids : PREDEFINED_INCIDENT_TYPES.map(t => t.id));
  }
  toggleType(id, enabled) {
    if (enabled) this.enabledTypes.add(id);
    else this.enabledTypes.delete(id);
  }

  createIncident(data, world) {
    const inc = new Incident(data);
    this.activeIncidents.push(inc);
    if (world && inc.stationA && inc.stationB) this._markAffectedTracks(inc, world);
    return inc;
  }

  _markAffectedTracks(inc, world) {
    if (!inc.stationA || !inc.stationB) return;
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
      if (inc.serviceId && inc.train) {
        // legacy single-train incident cleanup if train reference attached
        inc.train.incident = null;
      }
    }
    this.activeIncidents = this.activeIncidents.filter(i => i.id !== id);
    this._incBboxVer = null;
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

  _isOnRoute(lat, lon, route) {
    if (!route || route.length < 2) return false;
    const tolerance = 0.5;
    for (let i = 0; i < route.length - 1; i++) {
      const aLat = route[i].lat, aLon = route[i].lon;
      const bLat = route[i + 1].lat, bLon = route[i + 1].lon;
      if (this._pointToSegmentDist(lat, lon, aLat, aLon, bLat, bLon) < tolerance) return true;
    }
    return false;
  }

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

  _isBetweenStations(lat, lon, world, inc) {
    const stA = world.getStationById(inc.stationA);
    const stB = world.getStationById(inc.stationB);
    if (!stA || !stB) return false;
    const minLat = Math.min(stA.lat, stB.lat) - 0.01;
    const maxLat = Math.max(stA.lat, stB.lat) + 0.01;
    const minLon = Math.min(stA.lon, stB.lon) - 0.01;
    const maxLon = Math.max(stA.lon, stB.lon) + 0.01;
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
    const totalDist = haversineDistance(stA.lat, stA.lon, stB.lat, stB.lon);
    const dA = haversineDistance(lat, lon, stA.lat, stA.lon);
    const dB = haversineDistance(lat, lon, stB.lat, stB.lon);
    return (dA + dB) < totalDist + 2;
  }

  // Track/station-track incidents should only affect a train whose current leg
  // actually traverses the incident segment. A train stopped at the end of the
  // segment and departing on another leg must not be blocked by the previous one.
  _incidentMatchesServiceLeg(svc, inc) {
    if (inc.stationA === inc.stationB) return true; // pure station incident
    const stops = svc.getCurrentStops ? svc.getCurrentStops() : null;
    if (!stops || stops.length < 2) return true;
    // currentStopIndex is the next stop while moving, and has already been
    // incremented upon arrival (stopped_at_station). The origin of the current
    // leg is therefore the previous stop except when the train is still waiting
    // to start its very first leg.
    const originIdx = svc.state === 'waiting' ? svc.currentStopIndex : Math.max(0, svc.currentStopIndex - 1);
    const origin = stops[originIdx];
    const dest = stops[originIdx + 1];
    if (!origin || !dest) return true;
    const a = origin.stationId;
    const b = dest.stationId;
    if (a == null || b == null) return true;
    const incA = inc.stationA;
    const incB = inc.stationB;
    return (a === incA && b === incB) || (a === incB && b === incA);
  }

  // INC-03 : distance en avant du train jusqu'au point cible le long du trajet de service
  _distanceAheadOnRoute(svc, targetLat, targetLon) {
    const route = svc._state?.cachedRoute;
    const segDists = svc._state?.segDists;
    if (!route || route.length < 2 || svc._state.index >= route.length - 1) return null;
    let minDist = Infinity, bestSeg = -1, bestT = 0, bestAhead = Infinity;
    for (let i = svc._state.index; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      const d = this._pointToSegmentDist(targetLat, targetLon, a.lat, a.lon, b.lat, b.lon);
      if (d < minDist) {
        minDist = d;
        bestSeg = i;
        // recompute projection t
        const cosLat = Math.cos(a.lat * Math.PI / 180);
        const dx = (b.lon - a.lon) * 111 * cosLat;
        const dy = (b.lat - a.lat) * 111;
        const px = (targetLon - a.lon) * 111 * cosLat;
        const py = (targetLat - a.lat) * 111;
        const segLenSq = dx * dx + dy * dy;
        bestT = segLenSq < 0.0001 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
      }
    }
    if (bestSeg < 0) return null;
    if (bestSeg === svc._state.index && bestT < svc._state.progress) return null; // derrière le train
    let ahead = 0;
    const curSegDist = (segDists && segDists[svc._state.index]) || haversineDistance(route[svc._state.index].lat, route[svc._state.index].lon, route[svc._state.index + 1].lat, route[svc._state.index + 1].lon);
    ahead += (1 - svc._state.progress) * curSegDist;
    for (let i = svc._state.index + 1; i < bestSeg; i++) {
      ahead += (segDists && segDists[i]) || haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
    }
    if (bestSeg > svc._state.index) {
      ahead += bestT * ((segDists && segDists[bestSeg]) || haversineDistance(route[bestSeg].lat, route[bestSeg].lon, route[bestSeg + 1].lat, route[bestSeg + 1].lon));
    } else {
      ahead -= (svc._state.progress - bestT) * curSegDist;
    }
    return minDist < 1.0 ? ahead : null; // tolérance 1 km pour matcher le tracé ORM
  }

  // INC-03 : effet accordéon — ralentissement progressif avant l'incident
  getApproachingIncident(svc, world) {
    if (svc.state !== 'moving' || !svc._state?.cachedRoute || this.activeIncidents.length === 0) return null;
    const horizon = this.accordionHorizonKm;
    let best = null;
    let bestDist = Infinity;
    for (const inc of this.activeIncidents) {
      if (!inc.active || inc.serviceId) continue; // incidents mono-train gérés directement
      if (inc.effect !== 'stop' && inc.effect !== 'slow') continue;
      if (inc.stationA != null && inc.stationB != null && inc.stationA !== inc.stationB) {
        if (!this._incidentMatchesServiceLeg(svc, inc)) continue;
      }
      const points = [];
      if (inc.route && inc.route.length) points.push(...inc.route);
      else if (world) {
        const stA = world.getStationById(inc.stationA);
        const stB = world.getStationById(inc.stationB);
        if (stA) points.push({ lat: stA.lat, lon: stA.lon });
        if (stB) points.push({ lat: stB.lat, lon: stB.lon });
      }
      if (points.length === 0) continue;
      let minDist = Infinity;
      for (const p of points) {
        const d = this._distanceAheadOnRoute(svc, p.lat, p.lon);
        if (d != null && d < minDist) minDist = d;
      }
      if (minDist <= horizon && minDist < bestDist) {
        bestDist = minDist;
        best = inc;
      }
    }
    if (!best || bestDist > horizon) return null;
    // Ralentissement : 30 km/h à l'horizon, jusqu'à l'arrêt complet à < 0,3 km
    const slowLimit = Math.max(0, Math.round(30 * (bestDist / horizon)));
    if (best.effect === 'stop') {
      if (bestDist < 0.3) return { effect: 'stop', speedLimit: 0, name: best.name, approaching: true };
      return { effect: 'slow', speedLimit: Math.max(5, slowLimit), name: `Approche incident : ${best.name}`, approaching: true };
    }
    const base = best.speedLimit || 30;
    return { effect: 'slow', speedLimit: Math.max(5, Math.min(base, slowLimit + base * 0.2)), name: `Approche incident : ${best.name}`, approaching: true };
  }

  // --- Random incident spawning (Annexe 11) ---

  _randomDuration(min, max) {
    const rng = getGlobalRng();
    return Math.floor(min + rng.random() * (max - min + 1));
  }

  _probabilityForType(type, season) {
    if (type.id === 'train-breakdown') {
      return season === 'summer' ? (type.summerProbability || type.probability) : type.probability;
    }
    return type.probability;
  }

  _inTimeWindow(type, timeOfDay) {
    if (!type.timeWindows) return true;
    return type.timeWindows.some(([start, end]) => timeOfDay >= start && timeOfDay < end);
  }

  _trySpawn(timeOfDay, services, world, season) {
    const hour = Math.floor(timeOfDay / 60);
    if (hour === this.lastTriggerHour) return;
    this.lastTriggerHour = hour;

    for (const type of this.predefinedTypes) {
      if (!this.enabledTypes.has(type.id)) continue;
      if (type.timeWindows && !this._inTimeWindow(type, timeOfDay)) continue;

      const probability = this._probabilityForType(type, season);
      const rng = getGlobalRng();
      if (rng.random() * 100 >= probability) continue;

      try {
        if (type.scope === 'track') this._spawnTrackIncident(type, world);
        else if (type.scope === 'station') this._spawnStationIncident(type, world);
        else if (type.scope === 'train') this._spawnTrainIncident(type, services, timeOfDay);
      } catch (e) {
        console.warn('Incident spawn failed for', type.id, e);
      }
    }
  }

  _spawnTrackIncident(type, world) {
    if (!world || world.tracks.length === 0) return;
    const candidates = type.requireElectrified
      ? world.tracks.filter(t => t.electrified !== false)
      : [...world.tracks];
    if (candidates.length === 0) return;
    const rng = getGlobalRng();
    const track = candidates[Math.floor(rng.random() * candidates.length)];
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const stA = world.getStationById(track.stationA);
    const stB = world.getStationById(track.stationB);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: track.name || `${stA?.name || ''} — ${stB?.name || ''}`,
      stationA: track.stationA,
      stationB: track.stationB,
      stationAName: stA?.name || '',
      stationBName: stB?.name || '',
      route: track.route || null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
    });
    this.activeIncidents.push(inc);
    this._markAffectedTracks(inc, world);
  }

  _spawnStationIncident(type, world) {
    if (!world || world.stations.length === 0) return;
    const rng = getGlobalRng();
    const station = world.stations[Math.floor(rng.random() * world.stations.length)];
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    // Station incidents block the immediate track(s) connected to the station
    // to keep a 5–10 km impact zone as requested.
    const track = world.tracks.find(t => t.stationA === station.id || t.stationB === station.id) || null;
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: track ? (track.name || `${station.name}`) : station.name,
      stationA: track ? track.stationA : station.id,
      stationB: track ? track.stationB : station.id,
      stationAName: station.name,
      stationBName: station.name,
      route: track ? track.route : null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
    });
    this.activeIncidents.push(inc);
    if (track) this._markAffectedTracks(inc, world);
  }

  _spawnTrainIncident(type, services, timeOfDay) {
    if (!services || services.length === 0) return;
    let candidates = services.filter(s => s.train && s.position);
    if (type.requirePassenger) {
      candidates = candidates.filter(s => {
        const rame = s.rame || (s.train ? s.train.rame : null);
        return rame ? rame.totalCapacity > 0 : (s.train && s.train.totalCapacity > 0);
      });
    }
    if (type.requireStopped) {
      candidates = candidates.filter(s => s.state === 'stopped_at_station' || s.train?.stoppedAt);
    }
    if (candidates.length === 0) return;
    const rng = getGlobalRng();
    const svc = candidates[Math.floor(rng.random() * candidates.length)];
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trainId: svc.train.id,
      serviceId: svc.id,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
    });
    this.activeIncidents.push(inc);
    // Apply immediately to the affected train
    svc.train.incident = { effect: type.effect, speedLimit: type.speedLimit || 0, name: type.name };
  }

  update(timeOfDay, services, depotManager, world, dateStr, season) {
    if (timeOfDay !== this.lastCheck) {
      this.lastCheck = timeOfDay;
      for (const inc of this.activeIncidents) {
        inc.remaining -= 1;
        if (inc.remaining <= 0) {
          inc.active = false;
          this._clearTrackFlags(inc, world);
          if (inc.serviceId) {
            const svc = services?.find(s => s.id === inc.serviceId);
            if (svc && svc.train) svc.train.incident = null;
          }
        }
      }
      this.activeIncidents = this.activeIncidents.filter(i => i.active);
      this._incBboxVer = null;
    }

    this._trySpawn(timeOfDay, services, world, season);
    this.checkTrainPositions(services, depotManager, world);
  }

  checkTrainPositions(services, depotManager, world) {
    if (!services || this.activeIncidents.length === 0) {
      for (const svc of (services || [])) {
        if (svc?.train) svc.train.incident = null;
      }
      return;
    }

    if (!this._incBboxVer || this._incBboxVer !== this.activeIncidents.length) {
      this._incBboxVer = this.activeIncidents.length;
      for (const inc of this.activeIncidents) {
        if (inc._bbox) continue;
        if (inc.serviceId) {
          // train-specific incidents handled directly in update
          inc._bbox = [-Infinity, Infinity, -Infinity, Infinity];
        } else if (inc.route && inc.route.length >= 2) {
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
      svc.train.incident = null;

      const lat = svc.position.lat, lon = svc.position.lon;
      let worstIncident = null;
      for (const inc of this.activeIncidents) {
        if (!inc.active) continue;
        if (inc.serviceId) {
          if (inc.serviceId === svc.id) worstIncident = inc;
          continue;
        }
        if (inc._bbox && (lat < inc._bbox[0] || lat > inc._bbox[1] || lon < inc._bbox[2] || lon > inc._bbox[3])) continue;
        let affected = false;
        if (inc.route) {
          affected = this._isOnRoute(lat, lon, inc.route);
        } else if (world) {
          affected = this._isBetweenStations(lat, lon, world, inc);
        }
        if (!affected) continue;

        // Track/station-track incidents must match the train's current leg.
        if (inc.stationA != null && inc.stationB != null && inc.stationA !== inc.stationB) {
          if (!this._incidentMatchesServiceLeg(svc, inc)) continue;
        }

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
        // DDS-02 : secours uniquement pour les incidents spécifiques au train (panne, etc.)
        if (worstIncident.effect === 'stop' && worstIncident.serviceId && depotManager && world) {
          const alreadyRescued = depotManager.activeRescues?.some(r => r.targetServiceId === svc.id && r.state !== 'done');
          if (!alreadyRescued) {
            depotManager.dispatchRescue(world, svc);
          }
        }
      }

      // INC-03 : si aucun incident direct, ralentissement progressif en approche
      if (!worstIncident && svc.state === 'moving') {
        const approaching = this.getApproachingIncident(svc, world);
        if (approaching) {
          svc.train.incident = approaching;
        }
      }
    }
  }

  getActiveIncidents() {
    return this.activeIncidents;
  }

  // TRV-07 — incidents actifs affectant une ligne (par stationA/B ou trackName)
  getActiveIncidentsOnLine(lineStops = []) {
    const stopSet = new Set(lineStops);
    return this.activeIncidents.filter(i =>
      i.active && (stopSet.has(i.stationA) || stopSet.has(i.stationB) || (i.trackName && lineStops.some(sid => i.trackName.includes(sid))))
    );
  }

  // INC-05 — bulletins spéciaux à côté du récap de compagnie
  getBulletins() {
    return this.activeIncidents.filter(i => i.active).map(i => ({
      id: i.id,
      name: i.name,
      location: i.trackName || (i.stationAName && i.stationBName ? `${i.stationAName} — ${i.stationBName}` : 'Zone inconnue'),
      remaining: Math.max(0, Math.ceil(i.remaining)),
      effect: i.effect,
      speedLimit: i.speedLimit || 30,
    }));
  }

  getCustomTypes() { return []; }
  loadCustomTypes() {}

  getAllTypes() {
    return this.predefinedTypes.map(t => ({
      ...t,
      enabled: this.enabledTypes.has(t.id),
    }));
  }

  getActiveIncidentsSave() {
    return this.activeIncidents.map(inc => ({
      id: inc.id,
      typeId: inc.typeId,
      name: inc.name,
      trackName: inc.trackName,
      stationA: inc.stationA,
      stationB: inc.stationB,
      stationAName: inc.stationAName,
      stationBName: inc.stationBName,
      trainId: inc.trainId,
      serviceId: inc.serviceId,
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
      if (world && inc.stationA && inc.stationB) this._markAffectedTracks(inc, world);
    }
    this._incBboxVer = null;
  }
}
