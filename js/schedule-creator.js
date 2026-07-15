import { haversineDistance, analyzeRoute, CantonManager } from './simulation.js?v=1779724771';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js';
import { getGlobalRng } from './rng.js?v=1779724771';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js';

let nextServiceId = 1;
// SC-03 — running odd counter so each new service gets an odd (aller) number.
let nextServiceNumber = 1;

// Midnight-safe time difference: handles wrapping around 00:00
// Returns difference in minutes, clamped to [-720, 720]
function timeDiff(timeA, timeB) {
  let d = timeA - timeB;
  if (d > 720) d -= 1440;
  else if (d < -720) d += 1440;
  return d;
}

// Midnight-safe "is timeA >= timeB"
function timeGte(timeA, timeB) {
  return timeDiff(timeA, timeB) >= 0;
}

// Check if timeOfDay falls within a service window [start, end]
// Handles midnight-crossing services (e.g., depart 23:00, arrive 01:00)
function isInServiceWindow(timeOfDay, start, end) {
  // Normalize to [0, 1440)
  start = ((start % 1440) + 1440) % 1440;
  end = ((end % 1440) + 1440) % 1440;
  if (start <= end) {
    return timeOfDay >= start && timeOfDay <= end;
  } else {
    // Midnight-crossing
    return timeOfDay >= start || timeOfDay <= end;
  }
}

// Global canton manager shared across all services
const cantonManager = new CantonManager();
export { cantonManager };

export class ServiceStop {
  constructor(stationId, type, depTime, arrTime, voiePointId, platform, stopCode = '') {
    this.stationId = stationId;
    this.type = type;
    this.stopCode = stopCode || '';
    this.departureTime = depTime;
    this.arrivalTime = arrTime || depTime;
    this.voiePointId = voiePointId || null;
    this.platform = platform || '';
  }
}

export class ActiveService {
  constructor(data, rame, world, weather) {
    this.id = data.id || `svc-${nextServiceId++}`;
    this.name = data.name || 'Service';
    this.rameId = data.rameId;
    this.rame = rame;
    this.stops = (data.stops || []).map(s =>
      new ServiceStop(s.stationId, s.type, s.departureTime ?? s.time, s.arrivalTime ?? s.time, s.voiePointId, s.platform, s.stopCode)
    );
    this.routes = data.routes || [];
    this.world = world;
    this.weather = weather;
    this.roundTrip = data.roundTrip || false;
    this.multiDepartures = data.multiDepartures || 1;
    this.terminusWait = data.terminusWait || DEFAULT_TERMINUS_WAIT_MIN; // SC-06

    // SC-03 — auto numbering: aller = impair, retour = pair (aller+1).
    this.number = toOdd(data.number != null ? data.number : nextServiceNumber);
    if (data.number != null) {
      nextServiceNumber = Math.max(nextServiceNumber, this.number + 2);
    } else {
      nextServiceNumber = this.number + 2;
    }
    this.returnNumber = data.returnNumber != null
      ? data.returnNumber : returnNumberFor(this.number);

    // SC-04 — optional independent return geometry/stops (falls back to the
    // reversed forward leg when absent, keeping old saves working).
    this._returnRoutes = data.returnRoutes || null;
    this._returnStopsData = data.returnStops || null;
    this.totalDistance = data.totalDistance || 0;
    this.plannedDistance = data.plannedDistance || 0;
    this.active = data.active !== false;
    // Section VI — types de convois : passager (par defaut), W, HLP, TM, EVO, work
    this.serviceType = data.serviceType || (data.isWorkTrain ? 'work' : 'passager');
    this.isWorkTrain = this.serviceType === 'work'; // S15: Work trains unaffected by works
    // Section X — contrat fret éventuellement assigné à ce service
    this.assignedContractId = data.assignedContractId || '';
    this.returnName = data.returnName || '';
    this.returnPlatforms = data.returnPlatforms || {}; // { stationId: platformName }
    this.runDays = data.runDays || [0,1,2,3,4,5,6]; // days of week (0=Sun..6=Sat), default all
    this.runDates = data.runDates || []; // specific dates (YYYY-MM-DD), empty = every day
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
    // DET-05 : curseur de réalisme physique
    const physicsMult = (typeof window !== 'undefined' && window.game?.realismSettings?.physics) ?? 1;
    accel = Math.max(0.1, accel * physicsMult);
    decel = Math.max(0.1, decel * physicsMult);

    // S12: Get locomotive series name/number from rame
    let seriesName = '', trainNumber = '';
    if (rame && rame.elements) {
      const loco = rame.elements.find(e => e.item?.seriesName);
      if (loco?.item) {
        seriesName = loco.item.seriesName;
        trainNumber = String(loco.item.numberStart || '');
      }
    }

    // LVM-01 — livemap category (annexe 2a) : Voyageur / Fret / Travaux / Machines.
    this.category = this.isWorkTrain
      ? 'travaux'
      : (['hlp','tm','m-','evo'].includes(this.serviceType)
        ? 'machine'
        : (rame && rame.totalFreightCapacity > rame.totalCapacity ? 'fret' : 'voyageur'));

    this.train = {
      id: this.id,
      name: this.name,
      color: this.getColor(),
      category: this.category,
      maxSpeed: rame ? rame.maxSpeed : 160,
      speed: 0,
      delay: 0,
      state: 'waiting',
      totalKm: 0,
      stoppedAt: null,
      incident: null,
      breakdown: null,
      blockedBy: false,
      signalAlert: null, // 'caution' | 'closed' | null
      delayReason: '',   // OCC-04 : motif du retard (régulation, signal, incident...)
      accel,
      decel,
      seriesName,
      number: this.number != null ? String(this.number) : trainNumber,
      platform: null,
      // S14: Wear tracking — initialize from rame (persists across services)
      totalKmRun: rame ? (rame.totalKmRun || 0) : 0,
      kmSinceLastMaint: rame ? (rame.kmSinceLastMaint || 0) : 0,
      wearLevel: rame ? (rame.wearLevel || 0) : 0,
    };

    // Garage/shunting state
    this._garage = null; // { vpId, route, savedRoute, savedStopIndex, savedState, blockerTrainId }

    // Position will be set by scheduleTick when in pre-departure window
    // (don't set here to avoid ghost trains on the map)

    // SC-02 — pre-compute passage times at every real station encountered on
    // each leg, even if it is not a scheduled stop or waypoint.
    this._passageStops = this._computePassageStops();
  }

  _computePassageStops() {
    if (!this.world || !this.world.stations || this.stops.length < 2) return [];
    const passages = [];
    const thresholdKm = 0.5;
    const stopsByStation = new Set();
    for (const s of this.stops) if (s.stationId) stopsByStation.add(s.stationId);

    for (let leg = 0; leg < this.stops.length - 1; leg++) {
      const route = this.routes[leg];
      if (!route || route.length < 2) continue;
      const stopA = this.stops[leg];
      const stopB = this.stops[leg + 1];
      const depTime = stopA.departureTime;
      const arrTime = stopB.arrivalTime;
      const cumDists = [0];
      for (let i = 1; i < route.length; i++) {
        cumDists[i] = cumDists[i - 1] + haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
      }
      const totalDist = cumDists[cumDists.length - 1];
      if (totalDist <= 0) continue;
      for (const st of this.world.stations) {
        if (stopsByStation.has(st.id)) continue;
        let bestIdx = -1, bestDist = Infinity;
        for (let i = 0; i < route.length; i++) {
          const d = haversineDistance(st.lat, st.lon, route[i].lat, route[i].lon);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        if (bestDist <= thresholdKm && bestIdx >= 0) {
          const dFromStart = cumDists[bestIdx];
          const times = interpolatePassageTimes(depTime, arrTime, [0, dFromStart, totalDist]);
          passages.push({ stationId: st.id, name: st.name, time: times[1], leg, distKm: dFromStart });
        }
      }
    }
    const byStation = new Map();
    for (const p of passages) {
      const existing = byStation.get(p.stationId);
      if (!existing || p.distKm < existing.distKm) byStation.set(p.stationId, p);
    }
    return Array.from(byStation.values()).sort((a, b) => a.time - b.time);
  }

  getPassageStops() {
    return this._passageStops;
  }

  async garageToVoiePoint(vpId) { return; }
  resumeFromGarage() { return; }

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
    if (this.isReturnLeg) {
      if (this.returnStops.length === 0 && this._returnStopsData?.length) {
        this.returnStops = this.buildReturnStops();
      }
      if (!this._adjustedReturnStops && this.returnStops.length) {
        this._adjustedReturnStops = this._buildAdjustedStops(this.returnStops);
      }
      return this._adjustedReturnStops || this.returnStops;
    }
    return this._adjustedStops || this.stops;
  }

  // MET-01/03/04/05/06 — météo locale au point courant
  _getWeatherEffects() {
    if (!this.weather) return { brakeFactor: 1.0, speedCap: Infinity, speedMult: 1.0, type: 'clear' };
    let lat = this.position?.lat;
    let lon = this.position?.lon;
    if ((lat == null || lon == null) && this._state?.cachedRoute) {
      const pt = this._state.cachedRoute[this._state.index || 0];
      if (pt) { lat = pt.lat; lon = pt.lon; }
    }
    return this.weather.getSpeedEffectsAt(lat, lon, this.rame ? this.rame.maxSpeed : (this.train?.maxSpeed || 0));
  }

  // REG-01/02 : calcule l'écart canton selon la couverture régulateur/AC
  _updateRegulationFactor() {
    const lat = this.position?.lat;
    const lon = this.position?.lon;
    if (lat == null || lon == null || !window.game?.staffManager) {
      cantonManager.setTrainSeparation(this.id, 2);
      return;
    }
    const effects = window.game.staffManager.getRegulationEffects(lat, lon);
    let minutes = 2;
    if (effects.regulator) minutes = 1; // 1 min d'écart si zone régulateur couverte
    if (effects.signalBox) minutes = 0.5; // 30 s d'écart si AC (signal box) couverte en plus
    cantonManager.setTrainSeparation(this.id, minutes);
  }

  // MAT-08 — détermine si la rame est 100 % électrique (pas de Diesel/Vapeur)
  _isElectricOnly() {
    const traction = this.rame?.traction || 'none';
    const parts = traction.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0 || parts.includes('none')) return false;
    const electric = new Set(['1.5kv', '3kv', '15kv', '25kv', '3e rail', '3e_rail']);
    const self = new Set(['diesel', 'vapeur', 'steam']);
    if (parts.some(p => self.has(p))) return false;
    if (parts.some(p => electric.has(p))) return true;
    return false;
  }

  // MAT-08 — le segment courant est-il compatible avec la traction de la rame ?
  _electrificationMismatch(route, segIdx) {
    if (!route || !this.rame) return false;
    const from = route[segIdx];
    const to = route[segIdx + 1];
    if (!from || !to) return false;
    // Non électrifié seulement si explicitement false
    const electrified = (from.electrified !== false) && (to.electrified !== false);
    if (electrified) return false;
    return this._isElectricOnly();
  }

  // Annexe 3A — A. changements de vitesse : vitesse minimale sur la portion de
  // voie occupée par le train (de l’avant jusqu’à la queue, trainLength en m).
  _getInfraSpeedLimit(route, segIdx, progress, trainLengthM) {
    const segDists = this._state?.segDists;
    const cumDist = this._state?.cumDist;
    if (!segDists || !cumDist || !route?.length) return route[segIdx]?.maxSpeed || route[segIdx + 1]?.maxSpeed || 30;
    const trainLenKm = Math.max(0, trainLengthM) / 1000;
    const totalDist = cumDist[0];
    const frontDist = totalDist - cumDist[segIdx] + progress * segDists[segIdx];
    const step = 0.01; // km (10 m)
    let minSpeed = Infinity;
    for (let dBack = 0; dBack <= trainLenKm; dBack += step) {
      const target = frontDist - dBack;
      if (target <= 0) {
        minSpeed = Math.min(minSpeed, route[0].maxSpeed || 30);
        break;
      }
      if (target >= totalDist) {
        minSpeed = Math.min(minSpeed, route[route.length - 1].maxSpeed || 30);
        continue;
      }
      // find the segment containing target
      let i = 0;
      for (; i < route.length - 1; i++) {
        const segStart = totalDist - cumDist[i];
        const segEnd = totalDist - cumDist[i + 1];
        if (target >= segStart && target < segEnd) break;
      }
      if (i >= route.length - 1) i = route.length - 2;
      minSpeed = Math.min(minSpeed, route[i].maxSpeed || 30);
    }
    return Number.isFinite(minSpeed) ? minSpeed : (route[segIdx]?.maxSpeed || 30);
  }

  // Annexe 3A — B. changement négatif : ralentir pour être à la nouvelle vitesse
  // 50-150 m avant le point de transition (on retient 100 m de marge).
  _getNegativeTransitionCap(route, segIdx, progress, currentSpeed) {
    const segDists = this._state?.segDists;
    const cumDist = this._state?.cumDist;
    if (!segDists || !cumDist || currentSpeed <= 0) return null;
    const totalDist = cumDist[0];
    const frontDist = totalDist - cumDist[segIdx] + progress * segDists[segIdx];
    const bufferKm = 0.10; // 100 m (50-150 m)
    let cap = Infinity;
    for (let i = segIdx + 1; i < route.length; i++) {
      const nextSpeed = route[i].maxSpeed || 30;
      if (nextSpeed >= currentSpeed) continue;
      const pointDist = totalDist - cumDist[i];
      const distToPoint = pointDist - frontDist;
      if (distToPoint <= 0) {
        cap = Math.min(cap, nextSpeed);
        continue;
      }
      const weather = this._getWeatherEffects();
      const decel = this.train.decel * weather.brakeFactor;
      const brakingNeeded = Math.max(0, (currentSpeed * currentSpeed - nextSpeed * nextSpeed) / (2 * decel * 3600));
      if (distToPoint <= brakingNeeded + bufferKm) {
        // speed required to be exactly at nextSpeed at (pointDist - bufferKm)
        const targetDist = Math.max(0, distToPoint - bufferKm);
        const reqSpeed = Math.sqrt(Math.max(0, nextSpeed * nextSpeed + 2 * decel * 3600 * targetDist));
        cap = Math.min(cap, reqSpeed);
      }
    }
    return Number.isFinite(cap) ? cap : null;
  }

  // DDS-05 : les trains à proximité d'un secours en intervention s'arrêtent pour le laisser passer
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
  }

  // Called every minute - handles schedule logic (departures, arrivals, state transitions)
  scheduleTick(timeOfDay, dateStr, economy) {
    if (!this.active || this.stops.length < 2) return;
    cantonManager.setTime(timeOfDay);
    this._currentDate = dateStr;
    this._economy = economy;

    if (this.train.breakdown) {
      const BENIGN_TYPES = ['climatisation', 'portes'];
      // MNT-03 : pannes bénignes ne nécessitent pas de technicentre (train continue, limité en vitesse, réparé en gare)
      if (!BENIGN_TYPES.includes(this.train.breakdown.type)) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.state = 'en panne';
        // Section VI/DDS — demander un secours depuis le dépôt le plus proche
        if (!this._rescueDispatched && this.position && window.game?.depotManager) {
          window.game.depotManager.dispatchRescue(this.world, this);
          this._rescueDispatched = true;
        }
        return;
      }
      this.train.state = 'anomalie legere';
    }

    if (this.train.inMaintenance) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'en maintenance';
      return;
    }

    // FAST EARLY REJECT for waiting trains far from departure
    // This avoids expensive Date parsing and service window checks for 99% of services
    if (this.state === 'waiting' && this.currentStopIndex === 0 && !this.train.breakdown && !this.train.inMaintenance) {
      const dep0 = this._cachedFirstDep;
      if (dep0 !== undefined) {
        // Quick check: if departure is more than 2 min away, skip
        let diff = dep0 - timeOfDay;
        if (diff < -180) diff += 1440; // wrap around midnight
        if (diff > 2 && diff < 1400) {
          this.position = null;
          this.train.stoppedAt = null;
          return;
        }
      }
    }

    // Check if train runs today (day of week + specific dates)
    if (this.state === 'waiting' || (this.state === 'stopped_at_station' && this.currentStopIndex === 0)) {
      // Cache DOW check per date to avoid repeated Date construction
      if (this._cachedDowDate !== dateStr) {
        const today = new Date(dateStr + 'T12:00:00');
        this._cachedDow = today.getDay();
        this._cachedDowDate = dateStr;
      }
      const runsToday = this.runDays.includes(this._cachedDow);
      const hasDateRestriction = this.runDates.length > 0;
      const dateAllowed = !hasDateRestriction || this.runDates.includes(dateStr);
      if (!runsToday || !dateAllowed) {
        this.position = null;
        this.train.stoppedAt = null;
        return;
      }
    }

    // RH-05 : grève — bloque le départ des services concernés
    if (window.game?.unions?.isServiceBlocked(this.id)) {
      this.train.delayReason = 'grève';
      return;
    } else if (this.train.delayReason === 'grève') {
      this.train.delayReason = '';
    }

    const currentStops = this.getCurrentStops();
    const firstDep = currentStops[0]?.departureTime ?? 0;
    this._cachedFirstDep = firstDep;

    if (this.state === 'waiting') {
      if (this.completed && dateStr !== this.completedDate) {
        this.completed = false;
        // Reset position so the train is not rendered until near departure
        this.position = null;
        this.train.stoppedAt = null;
      }
      if (this.completed) {
        this.position = null;
        this.train.stoppedAt = null;
        return;
      }

      // Compute service window
      const lastStop = currentStops[currentStops.length - 1];
      const endTime = lastStop?.arrivalTime ?? firstDep + 120;

      // CVO-04 : attendre l'arrivée de l'EVO avant le premier départ
      if (this.serviceType !== 'evo' && this._evoServiceId && !this._evoCompleted) {
        const evo = window.game?.scheduleCreator?.services.find(s => s.id === this._evoServiceId);
        if (evo && !evo.completed && evo.state !== 'completed') {
          this.delay = Math.max(0, timeDiff(timeOfDay, firstDep));
          this.train.delay = this.delay;
          this.train.state = 'waiting_evo';
          return;
        } else {
          this._evoCompleted = true;
          this._evoServiceId = null;
        }
      }

      // Don't show train if not in service window (uses direct comparison, no ±720 wrapping)
      if (this.currentStopIndex === 0 && !isInServiceWindow(timeOfDay, firstDep - 1, endTime + 31)) {
        this.position = null;
        this.train.stoppedAt = null;
        return;
      }

      // Show train on map 1 minute before departure (position at first station)
      if (this.currentStopIndex === 0 && isInServiceWindow(timeOfDay, firstDep - 1, firstDep) && !timeGte(timeOfDay, firstDep)) {
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

      if (this.currentStopIndex === 0 && timeGte(timeOfDay, firstDep)) {
        // Don't start a train if departure was missed by more than 1 minute
        // (prevents trains starting late after reload)
        const minutesLate = timeDiff(timeOfDay, firstDep);
        if (minutesLate > 1) {
          this.completed = true;
          this.completedDate = dateStr;
          this.position = null;
          this.train.stoppedAt = null;
          return;
        }
        if (isInServiceWindow(timeOfDay, firstDep, endTime + 31)) {
          // Section VI — une rame ne peut pas effectuer 2 trajets en même temps
          if (this.rameId && window.game?.scheduleCreator?.isRameInUse(this.rameId, this.id, timeOfDay)) {
            // Rame already used by another active service; stay waiting and retry next tick
            return;
          }

          // OCC-03 : priorité au départ au voyageur dont le départ est le plus tôt
          const depStationId = currentStops[0]?.stationId;
          const myDep = currentStops[0]?.departureTime;
          if (depStationId && myDep != null && this.serviceType === 'passager' && window.game?.scheduleCreator) {
            const others = window.game.scheduleCreator.getActiveServices();
            const earlier = others.find(s =>
              s.id !== this.id &&
              s.serviceType === 'passager' &&
              !s.completed &&
              s.state !== 'moving' &&
              s.stops?.[0]?.stationId === depStationId &&
              (s.stops[0]?.departureTime ?? Infinity) < myDep
            );
            if (earlier) return;
          }

          // Ensure position is set (may not have been set by pre-departure positioning)
          if (!this.position) {
            const depStation = this.world?.getStationById(currentStops[0]?.stationId);
            if (depStation) {
              let posLat = depStation.lat, posLon = depStation.lon;
              if (window.game?.voiePointManager) {
                const s0 = currentStops[0];
                if (s0?.voiePointId) {
                  const vp = window.game.voiePointManager.getVoiePointById(s0.voiePointId);
                  if (vp) { posLat = vp.lat; posLon = vp.lon; }
                } else if (s0?.platform) {
                  const svp = window.game.voiePointManager.getStationVoiePoint(depStation.id, s0.platform);
                  if (svp) { posLat = svp.lat; posLon = svp.lon; }
                }
              }
              this.position = { lat: posLat, lon: posLon };
            }
          }
          // Board passengers at departure station before moving
          if (economy) {
            const firstStation = this.world?.getStationById(currentStops[0]?.stationId);
            if (firstStation) {
              economy.processStopRevenue(this, firstStation.name, 0, true, false);
            }
          }
          this._adjustedStops = this._buildAdjustedStops();
          this._adjustedReturnStops = null;
          this.state = 'moving';
          this.currentStopIndex = 1;
          this.speed = 0;
          this.revenueCollected = false;
          this.delay = Math.round(Math.max(0, timeDiff(timeOfDay, firstDep)));
          this.train.delay = this.delay;
          this.train.blockedBy = false;
          this.train.stoppedAt = null;
          this._lastTronconId = null;
          // DEP-05 : mise à jour de la localisation permanente de la rame
          if (this.rame) {
            this.rame.currentLocation = {
              stationId: currentStops[0]?.stationId || '',
              depotId: this.rame.depotId || '',
              serviceId: this.id,
              lat: this.position?.lat ?? null,
              lon: this.position?.lon ?? null,
            };
          }
          // Release all occupations on departure
          if (window.game?.voiePointManager) window.game.voiePointManager.releaseAllVoiePointsForTrain(this.id);
          if (window.game?.platformManager) window.game.platformManager.releasePlatform(currentStops[0]?.stationId, this.id);
          // Release any stale cantons and reset simulation state
          cantonManager.releaseAll(this.id);
          this._resetState();
        }
      }
      return;
    }

    if (this.state === 'stopped_at_station') {
      // Multi-trip waiting: use _nextDepartureTime if set
      if (this._nextDepartureTime != null && this.currentStopIndex === 0) {
        if (timeGte(timeOfDay, this._nextDepartureTime)) {
          // Board passengers at departure station for return/multi-trip
          const curStops = this.getCurrentStops();
          if (economy && curStops[0]) {
            const depStation = this.world?.getStationById(curStops[0].stationId);
            if (depStation) {
              economy.processStopRevenue(this, depStation.name, 0, true, false);
            }
          }
          this._nextDepartureTime = null;
          this._atTerminus = false;
          this.delay = 0;
          this.train.delay = 0;
          // Ensure position is set for multi-trip departure
          if (!this.position) {
            const curStops2 = this.getCurrentStops();
            const depSt = this.world?.getStationById(curStops2[0]?.stationId);
            if (depSt) this.position = { lat: depSt.lat, lon: depSt.lon };
          }
          if (this.isReturnLeg) this._adjustedReturnStops = this._buildAdjustedStops(this.returnStops);
          else this._adjustedStops = this._buildAdjustedStops();
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
          cantonManager.releaseAll(this.id);
          this._resetState();
        }
        return;
      }

      const stops = this.getCurrentStops();
      const stop = stops[this.currentStopIndex - 1];
      if (!stop) { this.state = 'moving'; return; }

      const depTime = stop.departureTime;
      const iteExtra = this._iteDwellExtra || 0;
      const effectiveDep = depTime != null ? depTime + iteExtra : null;
      // OCC-06 : plafond d'attente max 2h en gare (sauf terminus) → départ forcé
      const stopDuration = this.train._stoppedSinceGameTime ? timeDiff(timeOfDay, this.train._stoppedSinceGameTime) : 0;
      const isLastStop = this.currentStopIndex >= stops.length;
      const forceDepart = !isLastStop && stopDuration >= 120;
      // Guard against undefined/NaN departureTime — depart immediately
      if (stop.type === 'passage' || stop.type === 'waypoint' || effectiveDep == null || isNaN(effectiveDep) || forceDepart || timeGte(timeOfDay, effectiveDep)) {
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
        this._iteDwellExtra = 0;
        this.train.iteInfo = null;
        if (this.currentStopIndex >= stops.length) {
          this.completeService(economy);
        } else {
          // Release old cantons before starting new leg
          cantonManager.releaseAll(this.id);
          this.state = 'moving';
          this._resetState();
        }
      }
    }
  }

  /**
   * Centralized wear/km tracking. Called from moveUpdate and _moveDirectToTarget.
   */
  _trackWear(distKm, timeOfDay) {
    if (!isFinite(distKm) || distKm <= 0) return;
    this.train.totalKmRun = (this.train.totalKmRun || 0) + distKm;
    this.train.kmSinceLastMaint = (this.train.kmSinceLastMaint || 0) + distKm;
    this.train.wearLevel = Math.min(100, (this.train.kmSinceLastMaint || 0) / 250);
    if (this.rame) {
      this.rame.totalKmRun = (this.rame.totalKmRun || 0) + distKm;
      this.rame.kmSinceLastMaint = (this.rame.kmSinceLastMaint || 0) + distKm;
      this.rame.wearLevel = this.train.wearLevel;
    }
    if (!this.train.breakdown) {
      const wearMultiplier = 1 + (this.train.wearLevel || 0) / 25;
      const breakdownMult = (typeof window !== 'undefined' && window.game?.realismSettings?.breakdown) ?? 1;
      const failureProb = (distKm / 25000) * wearMultiplier * breakdownMult;
      const rng = getGlobalRng();
      if (rng.random() < failureProb) {
        const types = ['moteur', 'freins', 'climatisation', 'portes', 'fanaux'];
        const type = types[Math.floor(rng.random() * types.length)];
        this.train.breakdown = { type, time: timeOfDay };
        this._rescueDispatched = false;
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
    this._cachedTroncon = null;
    this._cachedTronconTime = null;
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

    // RH-05 : grève — les services affectés s'arrêtent sur place
    if (window.game?.unions?.isServiceBlocked(this.id)) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.delayReason = 'grève';
      this._updateContinuousDelay(timeOfDay);
      return;
    }

    cantonManager.setTime(timeOfDay);
    this._updateRegulationFactor();

    // Clear any stale garage state from old saves
    if (this._garage) this._garage = null;

    // Safety: ensure position exists (may be null after reload or direct transition)
    if (!this.position) {
      const stops = this.getCurrentStops();
      const depSt = stops?.length > 0 ? this.world?.getStationById(stops[0]?.stationId) : null;
      if (depSt) {
        this.position = { lat: depSt.lat, lon: depSt.lon };
      } else {
        return;
      }
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
    // Annexe 3A — limite sur la portion de voie occupée + transitions +/-.
    const trainLength = this.rame ? this.rame.totalLength : (this.train.length || 20);
    const infraLimit = this._getInfraSpeedLimit(route, segIdx, this._state.progress, trainLength);
    const negativeCap = this._getNegativeTransitionCap(route, segIdx, this._state.progress, this.speed);
    let segMaxSpeed = negativeCap != null ? Math.min(infraLimit, negativeCap) : infraLimit;
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

    // MAT-08 : contrainte électrification ↔ traction
    if (this._electrificationMismatch(route, segIdx)) {
      this.speed = 0;
      this.train.speed = 0;
      this.train.blockedBy = true;
      this.train.delayReason = 'tronçon non électrifié';
      this._updateContinuousDelay(timeOfDay);
      return;
    }

    // MNT-03 : pannes bénignes (climatisation, portes) limitent la vitesse mais ne bloquent pas
    if (this.train.breakdown) {
      const BENIGN_TYPES = ['climatisation', 'portes'];
      if (BENIGN_TYPES.includes(this.train.breakdown.type)) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, 80);
      }
    }

    // MET-01/06 — météo locale : neige −20 km/h si V ≥ 140
    const weather = this._getWeatherEffects();
    if (Number.isFinite(weather.speedCap) && weather.speedCap < effectiveMaxSpeed) {
      effectiveMaxSpeed = weather.speedCap;
    }

    // Reset blockedBy/signal alert at start of each tick — each check below will set it if needed
    this.train.blockedBy = false;
    this.train.signalAlert = null;

    // --- TRONCON CISAILLEMENT CHECK (runs first, overrides proximity if on troncon) ---
    let onTroncon = false;
    if (window.game?.voiePointManager && this.position) {
      const vpm = window.game.voiePointManager;
      // Cache troncon lookup: re-scan every ~300ms or when position changes
      let currentTrc = null;
      const cacheAge = this._cachedTronconTime ? (performance.now() - this._cachedTronconTime) : Infinity;
      if (this._cachedTroncon && cacheAge < 300) {
        currentTrc = this._cachedTroncon;
      } else {
        const trainVoie = this.train.platform || null;
        currentTrc = vpm.getTronconAtPosition(this.position, 0.3, trainVoie);
        this._cachedTroncon = currentTrc;
        this._cachedTronconTime = performance.now();
      }
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

    // --- CANTONNEMENT + PROXIMITY SAFETY (only if NOT on a troncon) ---
    if (!onTroncon) {
      if (this._cantonAssignments && this._cantonAssignments.length > 0) {
        const signalAspect = cantonManager.getSignalAspect(
          this._cantonAssignments, segIdx, this.id
        );
        if (signalAspect === 0) {
          // Carré ahead: apply VISA steps (30/20/10) toward the blocked canton
          // boundary and stop ~30 m upstream (SIG-05/SIG-06).
          this.train.signalAlert = 'closed';
          const nextCanton = cantonManager.getNextCanton(this._cantonAssignments, segIdx);
          let distM = 0;
          if (nextCanton && this._state.segDists && this._state.cumDist) {
            const distKm = (1 - this._state.progress) * (this._state.segDists[segIdx] || 0)
              + ((this._state.cumDist[segIdx + 1] || 0) - (this._state.cumDist[nextCanton.startIndex] || 0));
            distM = Math.max(0, distKm * 1000);
          }
          const cap = visaSpeedCapKmh(distM);
          const visaCap = (cap === null) ? RESTART_SPEED_KMH : cap;
          effectiveMaxSpeed = Math.min(effectiveMaxSpeed, visaCap);
          this.train.blockedBy = visaCap === 0;
        } else if (signalAspect !== null) {
          // Avertissement: be ready to stop at the next signal (SIG-04/SIG-07).
          this.train.signalAlert = 'caution';
          effectiveMaxSpeed = Math.min(effectiveMaxSpeed, RESTART_SPEED_KMH);
          this.train.blockedBy = false;
        } else {
          this.train.signalAlert = null;
          this.train.blockedBy = false;
        }
      }
      // ALWAYS run proximity check as a safety net (catches cases where
      // canton geo-keys don't match between trains with different routes)
      const blockLimit = this._proximityBlockCheck(allServices);
      if (blockLimit !== null) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, blockLimit);
        if (blockLimit === 0) this.train.blockedBy = true;
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
    // MET-03/04/05/06 — météo locale : freinage plus tôt sous pluie/orage/neige
    const decel = this.train.decel * weather.brakeFactor;
    const accelDelta = this.train.accel * dt;
    const decelDelta = decel * dt;

    // Check if next stop is a waypoint or passage (no braking needed)
    const nextStopBrake = this.getNextStop();
    const isNextPassThrough = nextStopBrake?.type === 'waypoint' || nextStopBrake?.type === 'passage';

    // Braking distance check for approaching end of route (skip for pass-through stops)
    const remainingDist = this._getRemainingDistance(route);
    // brakingDistance = speed² / (2 * deceleration), convert km/h to km/s²
    const brakeDist = (this.speed * this.speed) / (2 * decel * 3600);

    if (!isNextPassThrough && remainingDist < brakeDist + 0.3 && remainingDist > 0.01) {
      // Progressive deceleration: no forced minimum speed
      const targetSpeed = Math.sqrt(Math.max(0, 2 * decel * 3600 * remainingDist));
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
    const preIndex = this._state.index;
    const preProgress = this._state.progress;

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
            const occ = cantonManager.occupy(nextCanton.cantonId, this.id);
            if (!occ) {
              // Canton unexpectedly occupied — stop at boundary
              this._state.progress = 1.0;
              this.position.lat = segTo.lat;
              this.position.lon = segTo.lon;
              this.train.blockedBy = true;
              remaining = 0;
              break;
            }
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
      // Reached end of route — track km before returning
      const lastPt = route[route.length - 1];
      this.position.lat = lastPt.lat;
      this.position.lon = lastPt.lon;
      const finalDist = stepKm - remaining;
      if (isFinite(finalDist) && finalDist > 0) {
        this.totalDistance += finalDist;
        this._trackWear(finalDist, timeOfDay);
      }
      cantonManager.releaseAll(this.id);
      this.arriveAtStation(target, timeOfDay, this._economy);
      return;
    }

    // DDS-05 : céder le passage aux secours en intervention
    this._yieldToRescue();

    // --- ANTI-OVERTAKE: clamp position behind nearest train ahead on same route ---
    if (allServices && allServices.length > 1) {
      const myProgressKm = this._getRouteProgressKm(this.position, route, this._state.index);
      // OCC-04 : espacement de sécurité fonction de la vitesse (freinage + marge)
      const mySpeed = this.speed || 0;
      const decel = this.train.decel || 2;
      const brakeDistKm = mySpeed > 0 ? (mySpeed * mySpeed) / (2 * decel * 3600) : 0;
      const MIN_SPACING = Math.max(0.15, brakeDistKm + 0.05); // min 150 m, + marge
      const candidates = this._nearbyServices || allServices;
      const vpmAO = window.game?.voiePointManager;
      const myVoieAO = this.train.platform || (vpmAO ? vpmAO.getVoieAtPosition(this.position) : null);
      for (const other of candidates) {
        if (other.id === this.id || !other.position) continue;
        if (other.state === 'waiting' || other.state === 'completed') continue;
        // Skip trains on different tracks
        const otherVoieAO = other.train?.platform || (vpmAO && other.position ? vpmAO.getVoieAtPosition(other.position) : null);
        if (myVoieAO && otherVoieAO && myVoieAO !== otherVoieAO) continue;
        // Skip trains going in opposite direction (different track)
        if (other._state?.cachedRoute && other._state.index < other._state.cachedRoute.length - 1) {
          const oRoute = other._state.cachedRoute;
          const oi = other._state.index;
          const si = this._state.index;
          if (si < route.length - 1) {
            const myH = Math.atan2(route[si+1].lon - route[si].lon, route[si+1].lat - route[si].lat);
            const oH = Math.atan2(oRoute[oi+1].lon - oRoute[oi].lon, oRoute[oi+1].lat - oRoute[oi].lat);
            let hd = Math.abs(myH - oH);
            if (hd > Math.PI) hd = 2 * Math.PI - hd;
            if (hd > Math.PI / 2) continue;
          }
        }
        const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
        if (rawDist > 3) continue;
        const otherProgress = this._getRouteProgressKm(other.position, route, this._state.index);
        if (otherProgress <= myProgressKm) continue; // behind us
        const gap = otherProgress - myProgressKm;
        if (gap < MIN_SPACING) {
          // Clamp: place ourselves MIN_SPACING behind the other train
          const targetKm = otherProgress - MIN_SPACING;
          if (targetKm > 0) {
            let cumDist = 0;
            for (let ci = 0; ci < route.length - 1; ci++) {
              const sd = (this._state.segDists && this._state.segDists[ci]) || haversineDistance(route[ci].lat, route[ci].lon, route[ci+1].lat, route[ci+1].lon);
              if (cumDist + sd >= targetKm) {
                this._state.index = ci;
                this._state.progress = sd > 0 ? (targetKm - cumDist) / sd : 0;
                // Re-interpolate position at clamped location
                const sf = route[ci], st = route[ci + 1];
                this.position.lat = sf.lat + (st.lat - sf.lat) * this._state.progress;
                this.position.lon = sf.lon + (st.lon - sf.lon) * this._state.progress;
                break;
              }
              cumDist += sd;
            }
          }
          this.speed = Math.min(this.speed, other.speed || 0);
          this.train.blockedBy = true;
          break;
        }
      }
    }

    // Actual distance traveled along route this tick (not clamped)
    const actualDist = stepKm - remaining;
    this.totalDistance += actualDist;
    this.train.speed = Math.round(this.speed);
    this.train.totalKm = this.totalDistance;
    this.train.state = this.speed > 0 ? 'moving' : 'stopped';

    // S8/S14: Wear tracking using actual route distance (no clamping)
    if (isFinite(actualDist) && actualDist > 0) {
      this._trackWear(actualDist, timeOfDay);
    }

    // RET-04 : motif de retard si bloqué par un autre train / signal / incident
    this._updateDelayReason();

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
  // RET-04 : motive le retard courant pour bilan de trajet et bandeau Livemap
  _updateDelayReason() {
    const t = this.train;
    if (!t) return;
    if (this._rescueDispatched || t.state === 'en panne') { t.delayReason = 'Panne — attente secours'; return; }
    if (t.breakdown) { t.delayReason = `Panne ${t.breakdown.type}`; return; }
    if (t.incident) { t.delayReason = t.incident.name || 'Incident'; return; }
    if (t.signalAlert === 'closed') { t.delayReason = 'Arrêt pour signal fermé'; return; }
    if (t.signalAlert === 'caution' || t.blockedBy) { t.delayReason = 'Régulation du trafic'; return; }
    if (this._iteCargoMismatch) { t.delayReason = 'ITE : cargaison incompatible'; return; }
    if (this._iteDwellExtra > 0) { t.delayReason = 'ITE : manœuvres / chargement'; return; }
    t.delayReason = '';
  }

  _updateContinuousDelay(timeOfDay) {
    const stops = this.getCurrentStops();
    if (this.currentStopIndex <= 0 || this.currentStopIndex >= stops.length) return;

    // Use immediate previous and next stops for this segment
    const prevStop = stops[this.currentStopIndex - 1];
    const nextStop = stops[this.currentStopIndex];

    const depA = prevStop.departureTime ?? prevStop.arrivalTime ?? 0;
    const arrB = nextStop.arrivalTime ?? nextStop.departureTime ?? (depA + 5);
    let scheduledTravelTime = arrB - depA;
    // Handle midnight crossing
    if (scheduledTravelTime < 0) scheduledTravelTime += 1440;
    if (scheduledTravelTime <= 0) scheduledTravelTime = 1;

    // Route-based progress using actual distance along the ORM route
    let progress = 0;
    if (this._state?.cachedRoute && this._state.cumDist && this._state.segDists) {
      const totalRouteDist = this._state.cumDist[0] || 0;
      if (totalRouteDist > 0.001) {
        const idx = this._state.index || 0;
        const segProg = this._state.progress || 0;
        const distRemaining = (1 - segProg) * (this._state.segDists[idx] || 0)
          + (this._state.cumDist[idx + 1] || 0);
        progress = Math.max(0, Math.min(1, 1 - distRemaining / totalRouteDist));
      }
    } else if (this.position) {
      // Fallback if no cached route: use haversine between stations
      const stA = prevStop.stationId ? this.world?.getStationById(prevStop.stationId) : null;
      const stB = nextStop.stationId ? this.world?.getStationById(nextStop.stationId) : null;
      const latA = stA ? stA.lat : this.position.lat;
      const lonA = stA ? stA.lon : this.position.lon;
      const latB = stB ? stB.lat : this.position.lat;
      const lonB = stB ? stB.lon : this.position.lon;
      const totalDist = haversineDistance(latA, lonA, latB, lonB);
      if (totalDist > 0.01) {
        const distFromA = haversineDistance(latA, lonA, this.position.lat, this.position.lon);
        progress = Math.max(0, Math.min(1, distFromA / totalDist));
      }
    }

    // Expected time at current position = depA + scheduledTravelTime * progress
    const expectedTime = depA + scheduledTravelTime * progress;
    // Clamp to 0 minimum: trains cannot be "en avance"
    this.delay = Math.max(0, Math.round(timeDiff(timeOfDay, expectedTime)));
    this.train.delay = this.delay;

    // DEP-05 : mise à jour continue de la localisation permanente de la rame
    if (this.rame && this.position) {
      this.rame.currentLocation = {
        stationId: this.rame.currentLocation?.stationId || '',
        depotId: this.rame.depotId || '',
        serviceId: this.id,
        lat: this.position.lat,
        lon: this.position.lon,
      };
    }
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

    // MET-01/03/04/05/06 — météo locale en fallback direct
    const weather = this._getWeatherEffects();
    if (Number.isFinite(weather.speedCap) && weather.speedCap < rameMaxSpeed) rameMaxSpeed = weather.speedCap;
    const decel = this.train.decel * weather.brakeFactor;
    const accelDelta = this.train.accel * dt;
    const decelDelta = decel * dt;
    const brakeDist = (this.speed * this.speed) / (2 * decel * 3600);

    if (dist < brakeDist + 0.5 && dist > 0.01) {
      const targetSpeed = Math.sqrt(Math.max(0, 2 * decel * 3600 * dist));
      this.speed = Math.max(0, Math.min(this.speed, targetSpeed));
    } else if (this.speed < rameMaxSpeed) {
      this.speed = Math.min(rameMaxSpeed, this.speed + accelDelta);
    } else if (this.speed > rameMaxSpeed) {
      this.speed = Math.max(rameMaxSpeed, this.speed - decelDelta);
    }

    const stepKm = this.speed * dt / 3600;
    if (dist > 0 && stepKm > 0) {
      const actualMove = Math.min(stepKm, dist);
      const fraction = Math.min(stepKm / dist, 1);
      this.position.lat += (tLat - this.position.lat) * fraction;
      this.position.lon += (tLon - this.position.lon) * fraction;
      this.totalDistance += actualMove;
      this._trackWear(actualMove, timeOfDay);
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

      // Nez-à-nez detection: other train coming toward us on same track
      // (heading check above already filtered opposite-direction trains on parallel tracks,
      //  but if they're stopped or have no heading data, check raw distance)
      if (!ahead && rawDist < 1.5 && other.state === 'stopped_at_station') {
        // A stopped train close behind us is not a head-on concern
      } else if (!ahead && rawDist < 1.5 && other.speed > 0) {
        const dist = Math.abs(otherProgress - myProgress);
        if (dist < nearestAheadDist && dist < 0.8) {
          nearestAheadDist = dist;
          nearestAheadSpeed = 0;
        }
      }
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
    // Cache on a WeakMap-style key to avoid mutating the shared route object
    if (!this._cumDistCache) this._cumDistCache = new WeakMap();
    let cumDist = this._cumDistCache.get(route);
    if (!cumDist) {
      cumDist = new Float64Array(route.length);
      for (let i = 1; i < route.length; i++) {
        const dlat = (route[i].lat - route[i-1].lat) * 111;
        const dlon = (route[i].lon - route[i-1].lon) * 111 * Math.cos(route[i].lat * Math.PI / 180);
        cumDist[i] = cumDist[i-1] + Math.sqrt(dlat * dlat + dlon * dlon);
      }
      this._cumDistCache.set(route, cumDist);
    }
    return cumDist[bestIdx];
  }

  // Legacy compatibility
  update(timeOfDay, dateStr, economy, allServices) {
    this._economy = economy;
    this.scheduleTick(timeOfDay, dateStr, economy);
  }

  getCurrentRoute() {
    const idx = Math.max(0, this.currentStopIndex - 1);
    if (this.isReturnLeg) {
      // SC-04 — use an independent return geometry when provided; otherwise
      // fall back to reversing the forward legs.
      if (this._returnRoutes && this._returnRoutes.length) {
        return this._returnRoutes[idx] || null;
      }
      if (!this.routes || this.routes.length === 0) return null;
      const routeIdx = this.routes.length - 1 - idx;
      const route = this.routes[routeIdx];
      return route ? [...route].reverse() : null;
    }
    if (!this.routes || this.routes.length === 0) return null;
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
      // Annexe 3A — absence d'indication de vitesse → 30 km/h.
      return route[idx + 1].maxSpeed || route[idx].maxSpeed || 30;
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
        // Annexe 3A — absence d'indication de vitesse → 30 km/h.
        bestSpeed = pt.maxSpeed || 30;
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

    // CVO-04 : quand un EVO arrive à destination, le service principal peut partir
    if (this.serviceType === 'evo' && this._evoForServiceId) {
      const passenger = window.game?.scheduleCreator?.services.find(s => s.id === this._evoForServiceId);
      if (passenger) {
        passenger._evoCompleted = true;
        passenger._evoServiceId = null;
      }
    }

    // OCC-01/02 — occupation des voies en gare : un train ne peut PAS entrer
    // si aucune voie n'est libre (sauf voie forcée/point de voie précis).
    // Il patiente en approche (bloqué) et ré-essaie au tick suivant.
    if (station && stop && stop.type === 'arret' && !stop.platform && !stop.voiePointId
        && window.game?.platformManager) {
      const pm = window.game.platformManager;
      pm.initStation(station.id, station.platforms || 2);
      const held = pm.getPlatformForTrain(station.id, this.id);
      if (!held && pm.getFreePlatforms(station.id) <= 0) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.blockedBy = true;
        this.state = 'moving'; // reste en approche, ré-essaie au prochain tick
        return;
      }
    }

    // Only update delay based on actual arret stops, not waypoints/passages
    if (stop?.type === 'arret') {
      const expectedTime = stop.arrivalTime;
      if (expectedTime != null) {
        this.delay = Math.max(0, Math.round(timeDiff(timeOfDay, expectedTime)));
      }
      this.train.delay = this.delay;
    }
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

    // DEP-05 : mise à jour de la localisation permanente de la rame
    if (this.rame) {
      this.rame.currentLocation = {
        stationId: station?.id || '',
        depotId: this.rame.depotId || '',
        serviceId: this.id,
        lat: arrivalLat,
        lon: arrivalLon,
      };
    }

    // Section VI — ITE : longueur utile, tranches et compatibilité fret
    if (stop?.type === 'arret' && station) {
      const dm = window.game?.depotManager;
      const trainLength = this.rame ? this.rame.totalLength : (this.train.length || 20);
      const rameCargo = this.rame?.elementDetails?.find(e =>
        Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0
      )?.cargoTypes?.[0] || '';
      const iteInfo = dm?.getITEInfo(station.id, trainLength, rameCargo);
      if (iteInfo?.isITE) {
        // ITE-07 : modules grues/portiques accélèrent le chargement / la manœuvre
        const iteMods = window.game?.iteModules;
        const loadingMult = iteMods?.getLoadingSpeedMultiplier(station.id) ?? 1;
        const shuntingMult = iteMods?.getShuntingSpeedMultiplier(station.id) ?? 1;
        const craneCount = iteMods?.getCraneCount ? iteMods.getCraneCount(station.id) : 0;
        this.train.iteInfo = { totalLength: iteInfo.totalLength, trainLength, trancheCount: iteInfo.trancheCount, canFit: iteInfo.canFit, cargoMatch: iteInfo.cargoMatch, craneCount };
        this._iteCargoMismatch = iteInfo.cargoMatch === false;
        // ITE-06 : temps de manœuvre/déchargement/rechargement selon type de cargaison + longueur/tranches
        const cargo = (rameCargo || '').toLowerCase();
        let factor = 1.0; // minutes par 100 m de train
        if (/citerne|gaz|gas|liquide/.test(cargo)) factor = 1.5;
        else if (/intermodal|container|conteneur|porte-auto|tomber/.test(cargo)) factor = 2.5;
        else if (/cereals|cereale|ciment|cement|silos|tremie|trémie/.test(cargo)) factor = 1.2;
        const loadUnload = Math.ceil(factor * (trainLength / 100) * (iteInfo.canFit ? 1 : 1.2) * loadingMult);
        const trancheManeuver = iteInfo.canFit ? 0 : Math.ceil((iteInfo.trancheCount - 1) * 10 * shuntingMult);
        this._iteDwellExtra = loadUnload + trancheManeuver;
      } else {
        this._iteDwellExtra = 0;
        this._iteCargoMismatch = false;
        this.train.iteInfo = null;
      }
    } else {
      this._iteDwellExtra = 0;
      this._iteCargoMismatch = false;
      this.train.iteInfo = null;
    }

    // Per-stop revenue: montée/descente voyageurs + chargement/déchargement fret
    if (economy && stop?.type === 'arret') {
      const firstArretIdx = stops.findIndex(s => s.type === 'arret');
      const lastArretIdx = stops.length - 1 - [...stops].reverse().findIndex(s => s.type === 'arret');
      const isFirst = this.currentStopIndex === firstArretIdx;
      const isTerminus = this.currentStopIndex === lastArretIdx;
      // Compute distance from last 'arret' stop (sum all route segments since then)
      let distFromPrev = 0;
      if (!isFirst) {
        if (this.routes && this.routes.length > 0) {
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
        }
        // Fallback: haversine between previous and current station
        if (distFromPrev <= 0) {
          const prevStop = stops[this.currentStopIndex - 1];
          const prevStation = prevStop?.stationId ? this.world?.getStationById(prevStop.stationId) : null;
          if (prevStation && station) {
            distFromPrev = haversineDistance(prevStation.lat, prevStation.lon, station.lat, station.lon);
          }
          if (distFromPrev <= 0) distFromPrev = 20; // ultimate fallback
        }
      }
      economy.processStopRevenue(this, station.name, distFromPrev, isFirst, isTerminus, station.id);
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
      // MNT-03 : pannes bénignes réparables en gare sans technicentre
      if (this.train.breakdown && ['climatisation', 'portes'].includes(this.train.breakdown.type)) {
        this.delay = (this.delay || 0) + 5;
        this.train.delay = this.delay;
        this.train.breakdown = null;
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

    // Final sync km to rame (use max to avoid overwriting higher values from other services)
    if (this.rame) {
      const tKm = this.train.totalKmRun || 0;
      const tMaint = this.train.kmSinceLastMaint || 0;
      const tWear = this.train.wearLevel || 0;
      if (isFinite(tKm)) this.rame.totalKmRun = Math.max(this.rame.totalKmRun || 0, tKm);
      if (isFinite(tMaint)) this.rame.kmSinceLastMaint = Math.max(this.rame.kmSinceLastMaint || 0, tMaint);
      if (isFinite(tWear)) this.rame.wearLevel = Math.max(this.rame.wearLevel || 0, tWear);
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

    const rng = getGlobalRng();
    if (this.roundTrip && !this.isReturnLeg) {
      // Section OCC — retard au terminus : 1/3 de supprimer le retour, 2/3 de le faire rouler en retard
      // RET-03 : si supprimé, la rame reste à la gare et repart au prochain trajet prévu depuis cette gare
      if ((this.delay || 0) > 0 && rng.random() < 1 / 3) {
        this.state = 'waiting';
        this.speed = 0; this.train.speed = 0;
        this.delay = 0; this.train.delay = 0;
        this.completed = true; this.completedDate = this._currentDate || '';
        this.train.stoppedAt = station || this.train.stoppedAt;
        if (this.rame && station) {
          this.rame.currentLocation = {
            stationId: station.id,
            depotId: this.rame.depotId || '',
            serviceId: '',
            lat: arrivalLat,
            lon: arrivalLon,
          };
        }
        this.position = null;
        return;
      }
      this.returnStops = this.buildReturnStops();
      this.isReturnLeg = true;
      this.currentStopIndex = 0;
      this._tripCount = (this._tripCount || 0) + 1;
      // Switch to return name if defined
      if (this.returnName) this.train.name = this.returnName;
      // SC-03 — return leg shows the even number.
      if (this.returnNumber != null) this.train.number = String(this.returnNumber);
      // Start the return leg immediately (schedule as stopped_at_station for terminus wait)
      this.state = 'stopped_at_station';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      // Reset delay for the return leg
      this.delay = 0;
      this.train.delay = 0;
      this._atTerminus = true;
      // Set next departure time based on terminus wait
      this._nextDepartureTime = (this._lastArrivalTime || 0) + this.terminusWait;
      return;
    }

    // Check for multi round-trip (additional departures)
    if (this.roundTrip && this.isReturnLeg && this.multiDepartures && this._tripCount < this.multiDepartures) {
      // Section OCC — retard au terminus : 1/3 de supprimer le trajet suivant, 2/3 de le faire rouler en retard
      // RET-03 : si supprimé, la rame reste à la gare et repart au prochain trajet prévu depuis cette gare
      if ((this.delay || 0) > 0 && rng.random() < 1 / 3) {
        this.state = 'waiting';
        this.speed = 0; this.train.speed = 0;
        this.delay = 0; this.train.delay = 0;
        this.completed = true; this.completedDate = this._currentDate || '';
        this.train.stoppedAt = station || this.train.stoppedAt;
        if (this.rame && station) {
          this.rame.currentLocation = {
            stationId: station.id,
            depotId: this.rame.depotId || '',
            serviceId: '',
            lat: arrivalLat,
            lon: arrivalLon,
          };
        }
        this.position = null;
        return;
      }
      this.isReturnLeg = false;
      this.currentStopIndex = 0;
      // Switch back to forward name
      this.train.name = this.name;
      // SC-03 — forward leg shows the odd number.
      if (this.number != null) this.train.number = String(this.number);
      this.state = 'stopped_at_station';
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'waiting';
      this.train.blockedBy = false;
      this.revenueCollected = false;
      // Reset delay for next trip
      this.delay = 0;
      this.train.delay = 0;
      this._atTerminus = true;
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
    this.delay = 0;
    this.train.delay = 0;
    this._atTerminus = false;
    this.completed = true;
    this.completedDate = this._currentDate || '';
    this.isReturnLeg = false;
    this.revenueCollected = false;
    this._tripCount = 0;
    this._adjustedStops = null;
    this.train.stoppedAt = station || this.train.stoppedAt;
    // RET-03 : à la fin du trajet, la rame reste à la dernière gare pour le prochain service
    if (this.rame && station) {
      this.rame.currentLocation = {
        stationId: station.id,
        depotId: this.rame.depotId || '',
        serviceId: '',
        lat: arrivalLat,
        lon: arrivalLon,
      };
    }
    this.position = null;
  }

  _rebuildStopsFromTime(departureTime) {
    const offset = departureTime - (this.stops[0]?.departureTime || 0);
    return this.stops.map(s => {
      const dep = ((s.departureTime || 0) + offset) % 1440;
      const arr = ((s.arrivalTime || 0) + offset) % 1440;
      return new ServiceStop(
        s.stationId, s.type,
        dep < 0 ? dep + 1440 : dep,
        arr < 0 ? arr + 1440 : arr,
        s.voiePointId, s.platform, s.stopCode
      );
    });
  }

  // ARR-04/05 — for each circulation, randomly skip bracketed [C]/[S] stops.
  // Skipped arrets are treated as waypoints (no braking / no dwell / no revenue).
  _buildAdjustedStops(sourceStops = this.stops, rng = Math.random) {
    // DET-03 : saut d'arrêt [C]/[S] reste hors seed (aléatoire par circulation)
    return sourceStops.map(s => {
      if (s.type === 'arret' && s.stopCode && shouldSkipStop(s.stopCode, rng)) {
        const adjusted = new ServiceStop(
          s.stationId, 'waypoint', s.departureTime, s.arrivalTime,
          s.voiePointId, s.platform, s.stopCode
        );
        adjusted._skipped = true;
        return adjusted;
      }
      return new ServiceStop(
        s.stationId, s.type, s.departureTime, s.arrivalTime,
        s.voiePointId, s.platform, s.stopCode
      );
    });
  }

  buildReturnStops() {
    // Build the return from the original (non-adjusted) forward stops so
    // skippable [C]/[S] draws are independent on the return leg.
    const fwdStops = this.stops;
    if (!fwdStops || fwdStops.length === 0) return [];

    // SC-04 — independent return timetable when the player defined one:
    // preserve its own inter-stop deltas, anchored at terminus + wait.
    if (this._returnStopsData && this._returnStopsData.length) {
      return this._buildIndependentReturnStops(fwdStops);
    }

    const reversed = [...fwdStops].reverse();
    const lastStop = fwdStops[fwdStops.length - 1];
    const lastArrival = lastStop.arrivalTime || lastStop.departureTime || 0;
    let currentTime = lastArrival + this.terminusWait;

    // Build index map to handle duplicate station IDs correctly
    const fwdIndices = fwdStops.map((s, i) => ({ stationId: s.stationId, idx: i }));

    return reversed.map((stop, i) => {
      const prevStop = i > 0 ? reversed[i - 1] : null;
      let travelTime = 0;
      if (prevStop) {
        // Use the original forward index position (reversed) instead of findIndex
        // to handle duplicate station IDs correctly
        const revIdxPrev = i - 1;
        const revIdxCurr = i;
        const origIdxPrev = fwdStops.length - 1 - revIdxPrev;
        const origIdxCurr = fwdStops.length - 1 - revIdxCurr;
        if (origIdxPrev >= 0 && origIdxCurr >= 0 && origIdxPrev < fwdStops.length && origIdxCurr < fwdStops.length) {
          travelTime = Math.abs((fwdStops[origIdxPrev].departureTime || 0) - (fwdStops[origIdxCurr].arrivalTime || 0));
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
      const rs = new ServiceStop(stop.stationId, stop.type, depTime, arrTime, stop.voiePointId, returnPlat, stop.stopCode);
      return rs;
    });
  }

  // SC-04 — build the return leg from a player-defined, independent stop list.
  // Times keep their own relative deltas, re-anchored at (terminus arrival +
  // terminus wait). Wraps around midnight like _rebuildStopsFromTime.
  _buildIndependentReturnStops(fwdStops) {
    const lastStop = fwdStops[fwdStops.length - 1];
    const lastArrival = (lastStop?.arrivalTime ?? lastStop?.departureTime ?? 0);
    const anchor = lastArrival + this.terminusWait;
    const data = this._returnStopsData;
    const base = data[0]?.departureTime ?? data[0]?.arrivalTime ?? 0;
    const wrap = (t) => { const m = t % 1440; return m < 0 ? m + 1440 : m; };
    return data.map(s => {
      const dep = anchor + ((s.departureTime ?? s.arrivalTime ?? 0) - base);
      const arr = anchor + ((s.arrivalTime ?? s.departureTime ?? 0) - base);
      return new ServiceStop(
        s.stationId, s.type, wrap(dep), wrap(arr), s.voiePointId, s.platform, s.stopCode
      );
    });
  }
}

export class ScheduleCreator {
  constructor() {
    this.services = [];
    this.weather = null; // set by game
  }

  addService(data, rame, world) {
    const svc = new ActiveService(data, rame, world, this.weather);
    this.services.push(svc);
    this._invalidateActiveCache();
    return svc;
  }

  // CVO-04 : génère automatiquement un service EVO (garage/gare → gare de départ) si la rame n'est pas sur place
  ensureEVOForService(svc, world, timeOfDay) {
    if (svc.serviceType === 'evo' || svc._evoCreated || svc._evoCompleted) return null;
    if (!svc.rame || !svc.stops?.length || !svc.active) { svc._evoCreated = true; return null; }
    const firstStop = svc.stops[0];
    if (!firstStop?.stationId) { svc._evoCreated = true; return null; }
    const targetStation = world?.getStationById(firstStop.stationId);
    if (!targetStation) { svc._evoCreated = true; return null; }
    const current = svc.rame.currentLocation || {};
    if (current.stationId === targetStation.id) { svc._evoCompleted = true; return null; }

    const depotManager = window.game?.depotManager;
    let fromStation = current.stationId ? world.getStationById(current.stationId) : null;
    let fromLat = current.lat ?? null;
    let fromLon = current.lon ?? null;
    if (!fromStation && current.depotId && depotManager) {
      const depot = depotManager.getDepotById(current.depotId);
      if (depot?.stationId) fromStation = world.getStationById(depot.stationId);
    }
    if (!fromStation && svc.rame.depotId && depotManager) {
      const depot = depotManager.getDepotById(svc.rame.depotId);
      if (depot?.stationId) fromStation = world.getStationById(depot.stationId);
    }
    if (!fromStation) { svc._evoCreated = true; return null; }
    if (fromLat == null || fromLon == null) { fromLat = fromStation.lat; fromLon = fromStation.lon; }

    // Resolve route (ORM if available, else direct)
    let route = [];
    const orm = window.game?.orm;
    if (orm?.findRoute) {
      try {
        const routingSpeed = Math.min(svc.rame?.maxSpeed || 160, 160);
        const resolved = orm.findRoute(fromLat, fromLon, targetStation.lat, targetStation.lon, { maxSpeed: routingSpeed });
        if (Array.isArray(resolved) && resolved.length >= 2) route = resolved;
      } catch (e) { route = []; }
    }
    if (route.length < 2) route = [{ lat: fromLat, lon: fromLon }, { lat: targetStation.lat, lon: targetStation.lon }];

    let distKm = 0;
    for (let i = 1; i < route.length; i++) {
      distKm += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
    }
    const avgSpeed = 30;
    const travelMin = Math.max(5, Math.ceil((distKm / avgSpeed) * 60) + 5);
    const firstDep = firstStop.departureTime;
    if (timeGte(timeOfDay, firstDep)) { svc._evoCreated = true; return null; } // too late

    const wrap = (t) => { const m = t % 1440; return m < 0 ? m + 1440 : m; };
    const depMin = wrap(firstDep - travelMin);
    const arrMin = wrap(firstDep - 2);

    const evoData = {
      id: `evo-${svc.id}-${nextServiceId++}`,
      name: `EVO ${svc.name}`,
      rameId: svc.rame.id,
      serviceType: 'evo',
      stops: [
        { stationId: fromStation.id, type: 'passage', departureTime: depMin, arrivalTime: depMin, voiePointId: null, platform: '', stopCode: '' },
        { stationId: targetStation.id, type: 'arret', departureTime: firstDep, arrivalTime: arrMin, voiePointId: firstStop.voiePointId || null, platform: firstStop.platform || '', stopCode: firstStop.stopCode || '' },
      ],
      routes: [route],
      active: true,
      runDays: svc.runDays,
      runDates: svc.runDates,
      multiDepartures: 1,
      roundTrip: false,
      terminusWait: 0,
    };
    const evo = this.addService(evoData, svc.rame, world);
    evo._evoForServiceId = svc.id;
    evo._isEVO = true;
    svc._evoCreated = true;
    svc._evoServiceId = evo.id;
    return evo;
  }

  duplicateService(id, intervalMin, count, rame, world) {
    const src = this.services.find(s => s.id === id);
    if (!src) return [];
    const created = [];
    for (let i = 1; i <= count; i++) {
      const offset = intervalMin * i;
      const newName = incrementTrailingNumber(src.name, 2 * i);
      const shiftStops = stops => stops.map(st => ({
        stationId: st.stationId, type: st.type,
        departureTime: (st.departureTime ?? st.time) + offset,
        arrivalTime: (st.arrivalTime ?? st.time) + offset,
        voiePointId: st.voiePointId || null, platform: st.platform || '', stopCode: st.stopCode || '',
      }));
      const newStops = shiftStops(src.stops);
      const newReturnStops = src._returnStopsData
        ? shiftStops(src._returnStopsData)
        : null;
      const svc = this.addService({
        name: newName,
        rameId: src.rameId, stops: newStops, routes: src.routes,
        roundTrip: src.roundTrip, multiDepartures: src.multiDepartures,
        terminusWait: src.terminusWait, totalDistance: 0,
        plannedDistance: src.plannedDistance,
        serviceType: src.serviceType,
        isWorkTrain: src.isWorkTrain,
        assignedContractId: src.assignedContractId || '',
        returnName: src.returnName ? incrementTrailingNumber(src.returnName, 2 * i) : '',
        returnPlatforms: src.returnPlatforms,
        // SC-04 — propagate the independent return geometry/timetable so each
        // real duplicate keeps the same return path (fresh auto number).
        returnRoutes: src._returnRoutes, returnStops: newReturnStops,
        runDays: src.runDays, runDates: src.runDates,
      }, rame, world);
      created.push(svc);
    }
    return created;
  }

  // SC-05 — Auto 24h creates real, separate services. Each duplicate is one
  // round trip (aller + retour), shifted by the full round-trip duration.
  createAutoRoundTripDuplicates(baseService, requestedCount, oneRoundTripMin, rame, world) {
    if (requestedCount <= 1) return [];
    const created = [];
    const shiftStops = (stops, offset) => stops.map(st => ({
      stationId: st.stationId, type: st.type,
      departureTime: (st.departureTime ?? st.time) + offset,
      arrivalTime: (st.arrivalTime ?? st.time) + offset,
      voiePointId: st.voiePointId || null, platform: st.platform || '', stopCode: st.stopCode || '',
    }));
    for (let i = 1; i < requestedCount; i++) {
      const offset = oneRoundTripMin * i;
      const newForwardName = incrementTrailingNumber(baseService.name, 2 * i);
      const returnNameBase = baseService.returnName || incrementTrailingNumber(baseService.name, -1);
      const newReturnName = incrementTrailingNumber(returnNameBase, 2 * i);
      const newStops = shiftStops(baseService.stops, offset);
      const newReturnStops = baseService._returnStopsData
        ? shiftStops(baseService._returnStopsData, offset)
        : null;
      const svc = this.addService({
        name: newForwardName,
        rameId: baseService.rameId, stops: newStops, routes: baseService.routes,
        roundTrip: baseService.roundTrip, multiDepartures: 1,
        terminusWait: baseService.terminusWait, totalDistance: 0,
        plannedDistance: baseService.plannedDistance,
        serviceType: baseService.serviceType,
        isWorkTrain: baseService.isWorkTrain,
        assignedContractId: baseService.assignedContractId || '',
        returnName: newReturnName,
        returnPlatforms: baseService.returnPlatforms,
        returnRoutes: baseService._returnRoutes, returnStops: newReturnStops,
        runDays: baseService.runDays, runDates: baseService.runDates,
      }, rame, world);
      created.push(svc);
    }
    return created;
  }

  removeService(id) {
    const svc = this.services.find(s => s.id === id);
    if (svc) cantonManager.releaseAll(svc.id);
    this.services = this.services.filter(s => s.id !== id);
    this._invalidateActiveCache();
  }

  getActiveServices() {
    if (this._activeCache && this._activeCacheVer === this._serviceVer) return this._activeCache;
    this._activeCache = this.services.filter(s => s.active);
    this._activeCacheVer = this._serviceVer;
    return this._activeCache;
  }

  _invalidateActiveCache() {
    this._serviceVer = (this._serviceVer || 0) + 1;
  }

  // Section VI — une rame ne peut pas effectuer 2 trajets en même temps
  isRameInUse(rameId, excludeId, timeOfDay) {
    if (!rameId) return false;
    for (const svc of this.getActiveServices()) {
      if (svc.id === excludeId) continue;
      if (svc.rameId !== rameId) continue;
      if (svc.completed) continue;
      if (svc.state === 'moving' || svc.state === 'stopped_at_station' || svc.state === 'departing') return true;
      if (svc.state === 'waiting' && svc.currentStopIndex === 0) {
        const firstDep = svc.stops?.[0]?.departureTime ?? svc.stops?.[0]?.time;
        if (firstDep != null) {
          const diff = timeDiff(timeOfDay, firstDep);
          if (diff >= -2 && diff <= 5) return true;
        }
      }
    }
    return false;
  }

  /**
   * Returns only services that are currently moving (need physics update).
   * Uses cached subset, rebuilt when version changes.
   */
  getMovingServices() {
    if (this._movingCache && this._movingCacheVer === this._serviceVer) return this._movingCache;
    const active = this.getActiveServices();
    this._movingCache = active.filter(s => s.state === 'moving' || s.state === 'departing');
    this._movingCacheVer = this._serviceVer;
    return this._movingCache;
  }

  /**
   * Rebuild moving cache after state transitions in scheduleTick/moveUpdate.
   * Called once per tick cycle.
   */
  refreshMovingCache() {
    this._movingCacheVer = -1; // force rebuild on next getMovingServices()
  }

  toSave() {
    return this.services.map(s => {
      try {
        // Compact route encoding: delta-encoded flat arrays + strip defaults
        const safeRoutes = (s.routes || []).map(route => {
          if (!Array.isArray(route) || route.length === 0) return null;
          // Downsample: keep every Nth point for long routes
          let pts = route;
          if (pts.length > 100) {
            const step = Math.ceil(pts.length / 80);
            const sampled = [pts[0]];
            for (let i = step; i < pts.length - 1; i += step) sampled.push(pts[i]);
            sampled.push(pts[pts.length - 1]);
            pts = sampled;
          }
          // Delta-encode coords as flat int array
          const coords = [];
          let prevLat = 0, prevLon = 0;
          for (let i = 0; i < pts.length; i++) {
            const lat5 = Math.round(pts[i].lat * 1e5);
            const lon5 = Math.round(pts[i].lon * 1e5);
            if (i === 0) { coords.push(lat5, lon5); }
            else { coords.push(lat5 - prevLat, lon5 - prevLon); }
            prevLat = lat5; prevLon = lon5;
          }
          // Speed segments: only store when speed differs from the 30 km/h default.
          const speeds = [];
          let hasCustomSpeed = false;
          for (const pt of pts) {
            const sp = pt.maxSpeed || 30;
            if (sp !== 30) hasCustomSpeed = true;
            speeds.push(sp);
          }
          const o = { c: coords };
          if (hasCustomSpeed) o.s = speeds;
          return o;
        }).filter(r => r !== null);
        const safeReturnRoutes = (s._returnRoutes || []).map(route => {
          if (!Array.isArray(route) || route.length === 0) return null;
          let pts = route;
          if (pts.length > 100) {
            const step = Math.ceil(pts.length / 80);
            const sampled = [pts[0]];
            for (let i = step; i < pts.length - 1; i += step) sampled.push(pts[i]);
            sampled.push(pts[pts.length - 1]);
            pts = sampled;
          }
          const coords = [];
          let prevLat = 0, prevLon = 0;
          for (let i = 0; i < pts.length; i++) {
            const lat5 = Math.round(pts[i].lat * 1e5);
            const lon5 = Math.round(pts[i].lon * 1e5);
            if (i === 0) { coords.push(lat5, lon5); }
            else { coords.push(lat5 - prevLat, lon5 - prevLon); }
            prevLat = lat5; prevLon = lon5;
          }
          const speeds = [];
          let hasCustomSpeed = false;
          for (const pt of pts) {
            const sp = pt.maxSpeed || 30;
            if (sp !== 30) hasCustomSpeed = true;
            speeds.push(sp);
          }
          const o = { c: coords };
          if (hasCustomSpeed) o.s = speeds;
          return o;
        }).filter(r => r !== null);
        // Compact stops: short keys
        const compactStops = (s.stops || []).map(st => {
          const o = { si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime };
          if (st.voiePointId) o.vp = st.voiePointId;
          if (st.platform) o.p = st.platform;
          if (st.stopCode) o.sc = st.stopCode;
          return o;
        });
        const compactReturnStops = (s._returnStopsData || []).map(st => {
          const o = { si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime };
          if (st.voiePointId) o.vp = st.voiePointId;
          if (st.platform) o.p = st.platform;
          if (st.stopCode) o.sc = st.stopCode;
          return o;
        });
        const o = { id: s.id, n: s.name, ri: s.rameId, st: compactStops, rt: safeRoutes };
        if (s.roundTrip) o.rnd = true;
        if (s.multiDepartures > 1) o.md = s.multiDepartures;
        if (s.terminusWait !== DEFAULT_TERMINUS_WAIT_MIN) o.tw = s.terminusWait;
        // SC-03 — persist auto numbers so they survive reloads.
        if (s.number != null) o.num = s.number;
        if (s.returnNumber != null) o.rnum = s.returnNumber;
        o.td = Math.round((s.totalDistance || 0) * 100) / 100;
        if (s.plannedDistance) o.pd = s.plannedDistance;
        if (!s.active) o.act = false;
        if (s.serviceType && s.serviceType !== 'passager') o.st = s.serviceType;
        if (s.isWorkTrain) o.wt = true;
        if (s.assignedContractId) o.ac = s.assignedContractId;
        const allDays = [0,1,2,3,4,5,6];
        if (JSON.stringify(s.runDays) !== JSON.stringify(allDays)) o.rd = s.runDays;
        if (s.runDates?.length) o.rdt = s.runDates;
        if (s.returnName) o.rn = s.returnName;
        if (s.returnPlatforms && Object.keys(s.returnPlatforms).length) o.rp = s.returnPlatforms;
        if (safeReturnRoutes.length) o.rtrt = safeReturnRoutes;
        if (compactReturnStops.length) o.rst = compactReturnStops;
        // Runtime state (compact)
        o._r = {
          ci: s.currentStopIndex || 0,
          dir: s.direction || 1,
          tc: s._tripCount || 0,
          st: s.state || 'waiting',
          sp: Math.round((s.speed || 0) * 10) / 10,
          dl: Math.round(s.delay || 0),
        };
        // Save position for mid-journey restore
        if (s.position) {
          o._r.pos = [Math.round(s.position.lat * 1e6) / 1e6, Math.round(s.position.lon * 1e6) / 1e6];
        }
        if (s._adjustedStops) {
          o._r.as = s._adjustedStops.map(st => ({
            si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime,
          }));
        }
        return o;
      } catch (e) {
        console.warn('Error saving service', s.id, s.name, e);
        return { id: s.id, name: s.name, rameId: s.rameId, stops: [], routes: [], active: false, _saveError: true };
      }
    });
  }

  _decodeRoutes(routes) {
    if (!routes || !Array.isArray(routes)) return [];
    return routes.map(r => {
      // New compact format: { c: [delta-encoded ints], s: [speeds] }
      if (r && r.c && Array.isArray(r.c)) {
        const pts = [];
        let lat = 0, lon = 0;
        for (let i = 0; i < r.c.length; i += 2) {
          if (i === 0) { lat = r.c[0]; lon = r.c[1]; }
          else { lat += r.c[i]; lon += r.c[i + 1]; }
          // Annexe 3A — absence d'indication de vitesse → 30 km/h.
          const pt = { lat: lat / 1e5, lon: lon / 1e5, maxSpeed: 30, electrified: true, tracks: 1 };
          if (r.s && r.s[i / 2] !== undefined) pt.maxSpeed = r.s[i / 2];
          pts.push(pt);
        }
        return pts;
      }
      // Old format: array of {lat, lon, maxSpeed, ...}
      if (Array.isArray(r)) return r;
      return [];
    });
  }

  _expandCompactService(d) {
    // Expand compact format (short keys) to full format for ActiveService constructor
    if (d.n !== undefined && d.ri !== undefined && d.st !== undefined) {
      const expanded = {
        id: d.id,
        name: d.n,
        rameId: d.ri,
        stops: (d.st || []).map(s => ({
          stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
          voiePointId: s.vp || null, platform: s.p || '', stopCode: s.sc || '',
        })),
        routes: this._decodeRoutes(d.rt || []),
        returnStops: (d.rst || []).map(s => ({
          stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
          voiePointId: s.vp || null, platform: s.p || '', stopCode: s.sc || '',
        })),
        returnRoutes: this._decodeRoutes(d.rtrt || []),
        roundTrip: d.rnd || false,
        multiDepartures: d.md || 1,
        terminusWait: d.tw ?? DEFAULT_TERMINUS_WAIT_MIN,
        number: d.num,
        returnNumber: d.rnum,
        totalDistance: d.td || 0,
        plannedDistance: d.pd || 0,
        active: d.act !== false,
        serviceType: d.st || (d.wt ? 'work' : 'passager'),
        isWorkTrain: (d.st ? d.st === 'work' : d.wt) || false,
        assignedContractId: d.ac || '',
        runDays: d.rd || [0,1,2,3,4,5,6],
        runDates: d.rdt || [],
        returnName: d.rn || '',
        returnPlatforms: d.rp || {},
      };
      if (d._r) {
        expanded._runtime = {
          direction: d._r.dir || 1,
          _tripCount: d._r.tc || 0,
          currentStopIndex: d._r.ci || 0,
          state: d._r.st || 'waiting',
          speed: d._r.sp || 0,
          delay: d._r.dl || 0,
          position: d._r.pos || null,
          _adjustedStops: d._r.as ? d._r.as.map(s => ({
            stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
          })) : null,
        };
      }
      return expanded;
    }
    // Old format — just decode routes
    if (d.routes) d.routes = this._decodeRoutes(d.routes);
    return d;
  }

  loadFromSave(arr, rameManager, world) {
    this.services = [];
    this._invalidateActiveCache();
    cantonManager.cantons.clear();
    cantonManager.routeCantons.clear();
    cantonManager.trainCantons.clear();
    for (let d of arr) {
      d = this._expandCompactService(d);
      const rame = rameManager.getById(d.rameId);
      const svc = new ActiveService(d, rame, world, this.weather);
      svc.totalDistance = d.totalDistance || 0;
      svc.active = d.active !== false;

      if (d._runtime) {
        const rt = d._runtime;
        svc.completedDate = rt.completedDate || '';
        svc.direction = rt.direction || 1;
        svc._tripCount = rt._tripCount || 0;
        if (rt._adjustedStops) {
          svc._adjustedStops = rt._adjustedStops.map(s => new ServiceStop(
            s.stationId, s.type, s.departureTime, s.arrivalTime
          ));
        }
      }
      // Compute current game time for validation
      const now = new Date();
      const currentTimeOfDay = now.getHours() * 60 + now.getMinutes();

      // Restore mid-journey state if train was moving/stopped at station
      const savedState = d._runtime?.state || 'waiting';
      const savedPos = d._runtime?.position || null;
      const savedSpeed = d._runtime?.speed || 0;
      const savedDelay = d._runtime?.delay || 0;
      const savedStopIdx = d._runtime?.currentStopIndex || 0;

      // Check if service window has expired for this train
      const svcStops = svc.getCurrentStops();
      const svcFirstDep = svcStops[0]?.departureTime ?? 0;
      const svcLastArr = svcStops[svcStops.length - 1]?.arrivalTime ?? svcFirstDep + 120;
      const minutesPastDep = timeDiff(currentTimeOfDay, svcFirstDep);
      const minutesPastEnd = timeDiff(currentTimeOfDay, svcLastArr);

      if ((savedState === 'moving' || savedState === 'stopped_at_station') && savedPos) {
        // If the service end time has passed, mark completed instead of restoring
        if (minutesPastEnd > 5) {
          svc.state = 'waiting';
          svc.position = null;
          svc.speed = 0;
          svc.currentStopIndex = 0;
          svc.completed = true;
          svc.completedDate = now.toISOString().slice(0, 10);
          svc.isReturnLeg = false;
          svc.delay = 0;
          svc.train.delay = 0;
          svc.train.speed = 0;
          svc.train.state = 'waiting';
          svc.train.blockedBy = false;
          svc.train.stoppedAt = null;
          svc.train._stoppedSinceGameTime = null;
        } else {
          // Service window still active — restore mid-journey
          svc.state = savedState;
          svc.position = { lat: savedPos[0], lon: savedPos[1] };
          svc.speed = savedSpeed;
          svc.currentStopIndex = savedStopIdx;
          svc.delay = savedDelay;
          svc.train.delay = Math.round(savedDelay) === 0 ? 0 : Math.round(savedDelay);
          svc.train.speed = savedSpeed;
          svc.train.state = savedState === 'moving' ? 'moving' : 'stopped_at_station';
          svc.train.blockedBy = false;
          svc.train.stoppedAt = null;
          svc.train._stoppedSinceGameTime = null;
          svc.completed = false;
          svc.isReturnLeg = false;
        }
      } else {
        // Train was waiting — check if departure has already passed
        if (minutesPastDep > 1) {
          // Departure was more than 1 min ago: mark completed, don't start late
          svc.state = 'waiting';
          svc.position = null;
          svc.speed = 0;
          svc.currentStopIndex = 0;
          svc.completed = true;
          svc.completedDate = now.toISOString().slice(0, 10);
          svc.isReturnLeg = false;
          svc.delay = 0;
          svc.train.delay = 0;
          svc.train.speed = 0;
          svc.train.state = 'waiting';
          svc.train.blockedBy = false;
          svc.train.stoppedAt = null;
          svc.train._stoppedSinceGameTime = null;
        } else {
          // Departure is in the future or within 1 min: normal waiting state
          svc.state = 'waiting';
          svc.position = null;
          svc.speed = 0;
          svc.currentStopIndex = 0;
          svc.completed = false;
          svc.isReturnLeg = false;
          svc.delay = 0;
          svc.train.delay = 0;
          svc.train.speed = 0;
          svc.train.state = 'waiting';
          svc.train.blockedBy = false;
          svc.train.stoppedAt = null;
          svc.train._stoppedSinceGameTime = null;
        }
      }
      svc.train.inMaintenance = rame ? (rame.inMaintenance || false) : false;
      svc._nextDepartureTime = null;
      svc._onboardPax = 0;
      svc._onboardFreight = 0;
      svc.revenueCollected = false;
      // Clear multi-trip adjusted stops to use original schedule on reload
      svc._adjustedStops = null;
      svc._tripCount = 0;
      svc._atTerminus = false;
      svc._resetState();

      this.services.push(svc);
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextServiceId) nextServiceId = num + 1;
    }
  }
}
