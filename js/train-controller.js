import {
  timeDiff, timeGte, isInServiceWindow, wrapTime, _seeded01, serviceCounters
} from './service-utils.js?v=1784931680';
import { cantonManager } from './canton-manager.js?v=1784931680';
import { ServiceStop } from './service-stop.js?v=1784931680';
import { haversineDistance, analyzeRoute } from './simulation.js?v=1784931680';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js?v=1784931680';
import { getGlobalRng } from './rng.js?v=1784931680';
import { accelerationMs2, brakingDecelMs2, _units } from './train-physics.js?v=1784931680';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js?v=1784931680';

export const TrainController = {
  _getWeatherEffects() {
      if (!this.weather) return { brakeFactor: 1.0, speedCap: Infinity, speedMult: 1.0, type: 'clear' };
      let lat = this.position?.lat;
      let lon = this.position?.lon;
      if ((lat == null || lon == null) && this._state?.cachedRoute) {
        const pt = this._state.cachedRoute[this._state.index || 0];
        if (pt) { lat = pt.lat; lon = pt.lon; }
      }
      return this.weather.getSpeedEffectsAt(lat, lon, this.rame ? this.rame.maxSpeed : (this.train?.maxSpeed || 0));
    },

  _computePhysicsAccel(weather) {
      const baseAccel = this.train.accel || 3.0; // km/h/s
      const baseDecel = this.train.decel || 4.0; // km/h/s
      if (!this.rame) return { accel: baseAccel, decel: baseDecel };

      const massKg = (this.rame.getTotalMassWithPayload
        ? this.rame.getTotalMassWithPayload(0.7)
        : (this.rame.totalMass || this.rame.totalTonnage || 400)) * 1000;
      const powerW = (this.rame.totalPower || 0) * 1000;
      const lengthM = this.rame.totalLength || 200;
      const weatherType = weather?.type || 'clear';

      const vMs = this.speed * _units.KMH_TO_MS;
      const grade = 0;
      const params = { massKg, powerW, lengthM, weather: weatherType, adhesionMassKg: massKg, brakeServiceMs2: 0.9 };

      let aMs2 = 0;
      if (powerW > 0) {
        aMs2 = accelerationMs2(params, vMs, grade);
      }
      const aKmhS = aMs2 * _units.MS_TO_KMH;
      const effectiveAccel = powerW > 0 && Number.isFinite(aKmhS) && aKmhS > 0
        ? Math.min(baseAccel, aKmhS)
        : baseAccel;

      const bMs2 = brakingDecelMs2(params, weatherType);
      const bKmhS = bMs2 * _units.MS_TO_KMH;
      const effectiveDecel = Number.isFinite(bKmhS) && bKmhS > 0
        ? Math.min(baseDecel, bKmhS)
        : baseDecel;

      return { accel: effectiveAccel, decel: effectiveDecel };
    },

  _updateRegulationFactor() {
      const lat = this.position?.lat;
      const lon = this.position?.lon;
      if (lat == null || lon == null || !window.game?.staffManager) {
        cantonManager.setTrainSeparation(this.id, 2);
        return;
      }
      const currentStops = this.getCurrentStops();
      const curStop = currentStops?.[this.currentStopIndex];
      const prevStop = currentStops?.[this.currentStopIndex - 1];
      const stationIds = [curStop?.stationId, prevStop?.stationId].filter(Boolean);
      const lineManager = window.game.lineManager;
      const lineIds = new Set();
      for (const stId of stationIds) {
        if (stId && lineManager?.getLinesForStation) {
          for (const l of lineManager.getLinesForStation(stId)) lineIds.add(l.id);
        }
      }
      const effects = window.game.staffManager.getRegulationEffects(lat, lon, stationIds, [...lineIds]);
      let minutes = 2;
      if (effects.regulator) minutes = 1; // 1 min d'écart si zone régulateur couverte
      if (effects.signalBox) minutes = 0.5; // 30 s d'écart si AC (signal box) couverte en plus
      cantonManager.setTrainSeparation(this.id, minutes);
    },

  _isElectricOnly() {
      const traction = this.rame?.traction || 'none';
      const parts = traction.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (parts.length === 0 || parts.includes('none')) return false;
      const electric = new Set(['1.5kv', '3kv', '15kv', '25kv', '3e rail', '3e_rail', 'electrique', 'electric']);
      const self = new Set(['diesel', 'vapeur', 'steam']);
      if (parts.some(p => self.has(p))) return false;
      if (parts.some(p => electric.has(p))) return true;
      return false;
    },

  _electrificationMismatch(route, segIdx) {
      if (!route || !this.rame) return false;
      const from = route[segIdx];
      const to = route[segIdx + 1];
      if (!from || !to) return false;
      // Non électrifié seulement si explicitement false
      const electrified = (from.electrified !== false) && (to.electrified !== false);
      if (electrified) return false;
      return this._isElectricOnly();
    },

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
    },

  _getNegativeTransitionCap(route, segIdx, progress, currentSpeed) {
      const segDists = this._state?.segDists;
      const cumDist = this._state?.cumDist;
      if (!segDists || !cumDist || currentSpeed <= 0) return null;
      const totalDist = cumDist[0];
      const frontDist = totalDist - cumDist[segIdx] + progress * segDists[segIdx];
      const bufferKm = this._negativeBufferKm != null ? this._negativeBufferKm : 0.10;
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
    },

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
      // TRV-01 : usure des voies par le trafic (tonnage + distance)
      const vpm = window.game?.voiePointManager;
      if (vpm && this.position) {
        const trc = this._cachedTroncon || vpm.getTronconAtPosition(this.position, 0.3, this.train.platform);
        if (trc) {
          const mass = this.rame?.getTotalMassWithPayload ? this.rame.getTotalMassWithPayload() : 400;
          trc.wear = Math.min(100, (trc.wear || 0) + distKm * (mass / 400) * 0.005);
        }
      }

      // BUG-09 : avancement du contrat assigné mis à jour en temps réel
      if (this.assignedContractId && window.game?.freightManager) {
        const contract = window.game.freightManager.contracts.find(c => c.id === this.assignedContractId);
        if (contract && contract.active) {
          const total = Math.max(1, this.plannedDistance || this._state?.cumDist?.[0] || 1);
          contract.progress = Math.min(0.99, Math.max(0, (this.totalDistance || 0) / total));
        }
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
    },

  _updateHeading(a, b) {
      if (!a || !b || !this.train) return;
      // Geographic heading (radians, 0 = north) used for "Se situe entre" context.
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLon = (b.lon - a.lon) * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(b.lat * Math.PI / 180);
      const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos(dLon);
      const h = Math.atan2(y, x);
      this.train.geoHeading = h;
      if (this._state) this._state.heading = h;
      // Screen-space heading used for livemap icon rotation.
      const renderer = window.game?.renderer;
      if (!renderer?.latLonToScreen) { this.train.heading = 0; return; }
      try {
        const pa = renderer.latLonToScreen(a.lat, a.lon);
        const pb = renderer.latLonToScreen(b.lat, b.lon);
        this.train.heading = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      } catch (e) { this.train.heading = 0; }
    },

  moveUpdate(dt, timeOfDay, allServices) {
      if (!this.active || this.state !== 'moving') return;
      // REG-03 : un train en route n'est plus sous garage régulation
      this._garageUntil = null;

      // RH-05 : grève — les services affectés s'arrêtent sur place
      if (window.game?.unions?.isServiceBlocked(this.id)) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.delayReason = 'grève';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
        return;
      }

      // MNT-03 : panne non bénigne en cours de route -> arrêt + secours
      if (this.train.breakdown && !['climatisation', 'portes'].includes(this.train.breakdown.type)) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.state = 'en panne';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
        if (!this._rescueDispatched && this.position && window.game?.depotManager) {
          window.game.depotManager.dispatchRescue(this.world, this);
          this._rescueDispatched = true;
        }
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
        this.train.blockedBy = true;
        this.train.delayReason = 'Incident';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
        return;
      }
      if (incident?.effect === 'slow') {
        segMaxSpeed = Math.min(segMaxSpeed, incident.speedLimit || 30);
      }

      // Works speed limit (S15: work trains are unaffected)
      const worksLimit = this.isWorkTrain ? null : this.getWorksSpeedLimit(timeOfDay);
      if (worksLimit === 0) {
        const dateStr = this._currentDate || (typeof window !== 'undefined' && window.game?._currentDate) || '';
        this._startAlternateRouteSearch(timeOfDay, dateStr);
        const search = this._pendingAltRoute;
        if (search && search.completed && search.route) {
          this._applyAlternateRoute(search.route, timeOfDay);
          return; // next tick will follow the alternate route
        }
        this.speed = 0;
        this.train.speed = 0;
        this.train.state = 'travaux';
        this.train.delayReason = (search && search.completed && !search.route) ? 'travaux : aucun itinéraire alternatif' : 'travaux';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
        return;
      }
      if (worksLimit !== null) segMaxSpeed = Math.min(segMaxSpeed, worksLimit);

      // TRV-04 : TTX (trains de travaux caténaire) uniquement sur lignes électrifiées
      if (this.isWorkTrain && this._electrificationMismatch(route, segIdx)) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.blockedBy = true;
        this.train.delayReason = 'TTX : ligne non électrifiée';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
        return;
      }

      // CRITICAL: effectiveSpeed = min(train speed, infrastructure speed)
      let effectiveMaxSpeed = Math.min(rameMaxSpeed, segMaxSpeed);

      // MAT-08 : contrainte électrification ↔ traction
      if (this._electrificationMismatch(route, segIdx)) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.blockedBy = true;
        this.train.delayReason = 'tronçon non électrifié';
        this._updateContinuousDelay(timeOfDay);
        if (this._updateStuckTimer(timeOfDay)) return;
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
      if (this.speed > 0) this._blockedSinceGameTime = null;

      // --- TRONCON OCCUPANCY + CISAILLEMENT CHECK (first, physical block) ---
      let tronconBlocked = false;
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
          if (currentTrc.occupiedBy !== this.id) {
            if (vpm.isTronconOccupied(currentTrc.id, this.id)) {
              effectiveMaxSpeed = 0;
              tronconBlocked = true;
              this.train.blockedBy = true;
            } else {
              const blocking = vpm.checkCisaillement(currentTrc.id, this.id);
              if (blocking) {
                effectiveMaxSpeed = 0;
                tronconBlocked = true;
                this.train.blockedBy = true;
              } else {
                vpm.occupyTroncon(currentTrc.id, this.id);
              }
            }
          }
          if (this._lastTronconId && this._lastTronconId !== currentTrc.id) {
            vpm.releaseTroncon(this._lastTronconId, this.id);
          }
          this._lastTronconId = currentTrc.id;
        } else {
          vpm.releaseAllForTrain(this.id);
        }
      }

      // --- MOVEMENT AUTHORITY (ETCS/MA) ---
      const physics = this._computePhysicsAccel(weather);
      const decelMps2 = (physics.decel / 3.6) * weather.brakeFactor;
      const ma = this._movementAuthority(allServices, decelMps2);
      if (ma && Number.isFinite(ma.eoaM)) {
        this.train.signalAlert = ma.aspect === 'clear' ? null : (ma.aspect || null);
        const maCap = this._maSpeedCap(ma.eoaM, ma.targetSpeedKmh, decelMps2, this._carreMarginM);
        if (Number.isFinite(maCap)) {
          effectiveMaxSpeed = Math.min(effectiveMaxSpeed, maCap);
          if (maCap <= 1 && ma.reason !== 'clear') this.train.blockedBy = true;
        }
      }
      // ALWAYS run proximity check as a safety net (catches cases where
      // canton geo-keys don't match between trains with different routes)
      const blockLimit = this._proximityBlockCheck(allServices);
      if (blockLimit !== null) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, blockLimit);
        if (blockLimit === 0) this.train.blockedBy = true;
      }

      // IPCS runtime: stop opposite-direction trains on the same track (Section IV / Annexe 10d)
      const ipcsLimit = this._ipcsBlockCheck(this._nearbyServices || allServices);
      if (ipcsLimit !== null) {
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, ipcsLimit);
        if (ipcsLimit === 0) {
          this.train.blockedBy = true;
          this.train.delayReason = this.train.delayReason || 'attente IPCS / sens inverse';
        }
      }

      // --- STATION VOIE POINT OCCUPATION CHECK (OCC-01/02) ---
      if (window.game?.voiePointManager && !this.train.blockedBy) {
        const vpm = window.game.voiePointManager;
        const nextStop = this.getNextStop();
        if (nextStop && nextStop.type === 'arret' && target) {
          const remainDist = this._getRemainingDistance(route);
          if (remainDist < 3) {
            let canArrive = true;
            if (nextStop.voiePointId) {
              canArrive = !vpm.isVoiePointOccupied(nextStop.voiePointId, this.id);
            } else if (nextStop.platform) {
              const svp = vpm.getStationVoiePoint(target.id, nextStop.platform);
              canArrive = !svp || !vpm.isVoiePointOccupied(svp.id, this.id);
            } else {
              const stationVPs = vpm.getStationVoiePoints(target.id);
              // Aucun point de voie défini = pas de contrainte
              if (stationVPs.length > 0) {
                canArrive = stationVPs.some(vp => !vpm.isVoiePointOccupied(vp.id, this.id));
              }
            }
            if (!canArrive) {
              effectiveMaxSpeed = 0;
              this.train.blockedBy = true;
              this.train.delayReason = 'attente voie libre en gare';
            }
          }
        }
      }

      // --- ACCELERATION / DECELERATION PHYSICS (PH-01/PH-03/PH-04) ---
      // MET-03/04/05/06 — météo locale : freinage plus tôt sous pluie/orage/neige
      const decel = physics.decel * weather.brakeFactor;
      const accelDelta = physics.accel * dt;
      const decelDelta = decel * dt;

      // Check if next stop is a waypoint or passage (no braking needed)
      const nextStopBrake = this.getNextStop();
      const isNextPassThrough = nextStopBrake?.type === 'waypoint' || nextStopBrake?.type === 'passage';

      // Braking distance check for approaching end of route (skip for pass-through stops)
      const remainingDist = this._getRemainingDistance(route);
      // brakingDistance = speed² / (2 * deceleration), convert km/h to km/s²
      const brakeDist = (this.speed * this.speed) / (2 * decel * 3600);

      if (!isNextPassThrough && remainingDist < brakeDist + 0.3 && remainingDist > 0.001) {
        // Progressive deceleration / approach: move speed toward the safe target
        const targetSpeed = Math.sqrt(Math.max(0, 2 * decel * 3600 * remainingDist));
        if (this.speed > targetSpeed) {
          this.speed = Math.max(targetSpeed, this.speed - decelDelta);
        } else {
          this.speed = Math.min(targetSpeed, this.speed + accelDelta);
        }
        this.speed = Math.max(0, Math.min(this.speed, effectiveMaxSpeed));
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
        if (this._updateStuckTimer(timeOfDay)) return;
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
        this._updateHeading(segFrom, segTo);
      } else {
        // Reached end of route — track km before returning
        const lastPt = route[route.length - 1];
        this.position.lat = lastPt.lat;
        this.position.lon = lastPt.lon;
        const prevIdx = Math.max(0, this._state.index - 1);
        this._updateHeading(route[prevIdx], lastPt);
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
        // O(1) progress from route start using cached cumulative distances
        const myProgressKm = (this._state.cumDist && this._state.segDists)
          ? this._state.cumDist[0] - this._state.cumDist[this._state.index] + this._state.progress * this._state.segDists[this._state.index]
          : this._getRouteProgressKm(this.position, route, this._state.index);
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
              const oH = other._state.heading != null
                ? other._state.heading
                : Math.atan2(oRoute[oi+1].lon - oRoute[oi].lon, oRoute[oi+1].lat - oRoute[oi].lat);
              let hd = Math.abs(myH - oH);
              if (hd > Math.PI) hd = 2 * Math.PI - hd;
              if (hd > Math.PI / 2) continue;
            }
          }
          const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
          if (rawDist > 3) continue;
          // O(1) same-route progress, fallback to geometric scan
          const otherProgress = (other._state?.cumDist && other._state?.segDists && other._state.cachedRoute === route)
            ? other._state.cumDist[0] - other._state.cumDist[other._state.index] + other._state.progress * other._state.segDists[other._state.index]
            : this._getRouteProgressKm(other.position, route, this._state.index);
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
    },

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
    },

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
    },

  moveMacro(dt, timeOfDay, economy, allServices) {
      if (!this.active || this.state !== 'moving' || !this.position) return;
      // Ensure route state is initialized (departing trains start with no cachedRoute)
      const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
      if (this._state.legKey !== legKey) {
        const freshRoute = this.getCurrentRoute();
        if (freshRoute && freshRoute.length >= 2) this._initializeState(freshRoute, legKey);
        else return;
      }
      if (!this._state?.cachedRoute) return;
      cantonManager.setTime(timeOfDay);

      // Macro speed: line/rame limit. Preserve full-physics speed, but ramp from a
      // standstill so trains do not teleport to max speed when they enter the viewport.
      let macroSpeed = Math.min(
        this.rame?.maxSpeed || 300,
        this.getLineSpeedAtPosition()
      );
      const macroAccel = this.train.accel || 3.0;
      const macroDecel = this.train.decel || 4.0;

      // Movement Authority for low-LOD trains (replaces fixed signal aspect)
      if (this._cantonAssignments) {
        const weather = this._getWeatherEffects ? this._getWeatherEffects() : { brakeFactor: 1.0 };
        const decelMps2 = ((this.train.decel || 4.0) / 3.6) * (weather.brakeFactor || 1.0);
        const ma = this._movementAuthority(allServices, decelMps2);
        if (ma && Number.isFinite(ma.eoaM)) {
          const maCap = this._maSpeedCap(ma.eoaM, ma.targetSpeedKmh, decelMps2, this._carreMarginM);
          if (Number.isFinite(maCap)) macroSpeed = Math.min(macroSpeed, maCap);
        }
      }

      // Proximity safety net (uses _nearbyServices if available, else allServices)
      const blockLimit = this._proximityBlockCheck(allServices);
      if (blockLimit !== null) {
        macroSpeed = Math.min(macroSpeed, blockLimit);
        if (blockLimit === 0) this.train.blockedBy = true;
      }

      // IPCS runtime for low-LOD trains: stop before a head-on collision on single track
      const ipcsLimit = this._ipcsBlockCheck(allServices);
      if (ipcsLimit === 0) {
        this.speed = 0;
        this.train.speed = 0;
        this.train.state = 'stopped';
        this.train.delayReason = this.train.delayReason || 'attente IPCS / sens inverse';
        return;
      }
      if (ipcsLimit) macroSpeed = Math.min(macroSpeed, ipcsLimit);

      if (this.speed < macroSpeed) {
        this.speed = Math.min(macroSpeed, this.speed + macroAccel * dt);
      } else if (this.speed > macroSpeed) {
        this.speed = Math.max(macroSpeed, this.speed - macroDecel * dt);
      }
      this.train.speed = Math.round(this.speed);
      if (this.speed <= 0) return;

      const route = this._state.cachedRoute;
      const stepKm = this.speed * dt / 3600;
      let remaining = stepKm;
      while (remaining > 1e-6 && this._state.index < route.length - 1) {
        const idx = this._state.index;
        const from = route[idx];
        const to = route[idx + 1];
        const segDist = (this._state.segDists?.[idx]) || haversineDistance(from.lat, from.lon, to.lat, to.lon);
        if (segDist <= 0) { this._state.index++; continue; }
        const maxFrac = 1 - this._state.progress;
        const frac = Math.min(maxFrac, remaining / segDist);
        this.position.lat += (to.lat - from.lat) * frac;
        this.position.lon += (to.lon - from.lon) * frac;
        this._state.progress += frac;
        remaining -= segDist * frac;
        if (this._state.progress >= 1 - 1e-9) {
          // Canton transition on segment switch
          if (this._cantonAssignments) {
            const prevCanton = cantonManager.getCantonForSegment(this._cantonAssignments, idx);
            const nextCanton = cantonManager.getCantonForSegment(this._cantonAssignments, idx + 1);
            if (nextCanton && (!prevCanton || nextCanton.cantonId !== prevCanton.cantonId)) {
              if (!cantonManager.isAvailable(nextCanton.cantonId, this.id)) {
                this._state.progress = 1.0;
                this.position.lat = to.lat;
                this.position.lon = to.lon;
                this.train.blockedBy = true;
                remaining = 0;
                break;
              }
              const occ = cantonManager.occupy(nextCanton.cantonId, this.id);
              if (!occ) {
                this._state.progress = 1.0;
                this.position.lat = to.lat;
                this.position.lon = to.lon;
                this.train.blockedBy = true;
                remaining = 0;
                break;
              }
              if (prevCanton) {
                cantonManager.release(prevCanton.cantonId, this.id);
              }
            }
          }
          this._state.progress = 0;
          this._state.index++;
        }
      }
      this.totalDistance += stepKm;
      this.train.totalKm = this.totalDistance;
      if (this._state.index >= route.length - 1) {
        const target = this.getTargetStation();
        if (target) this.arriveAtStation(target, timeOfDay, economy);
      }
    },

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
    },

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
    },

  getWorksSpeedLimit(timeOfDay) {
      if (!this.world) return null;
      const currentStops = this.getCurrentStops();
      if (this.currentStopIndex <= 0 || this.currentStopIndex >= currentStops.length) return null;

      const route = this._state.cachedRoute;
      if (!route || route.length < 2) return null;

      const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
      const dateStr = this._currentDate || (typeof window !== 'undefined' && window.game?._currentDate) || '';
      const cacheKey = `${legKey}|${dateStr}|${Math.floor(timeOfDay)}|${route.length}`;
      if (this._state.worksLimitCache && this._state.worksLimitCache.key === cacheKey) {
        return this._state.worksLimitCache.limit;
      }
      const limit = this._computeWorksLimit(route, dateStr, timeOfDay);
      this._state.worksLimitCache = { key: cacheKey, limit };
      return limit;
    },

  _computeWorksLimit(route, dateStr, timeOfDay) {
      const blocking = this._getBlockingWorksForRoute(route, dateStr, timeOfDay);
      if (blocking.length === 0) return null;
      const limits = blocking.map(w => (w.impact === 'stop' || w.speedLimit === 0) ? 0 : (Number.isFinite(w.speedLimit) ? w.speedLimit : 40));
      return Math.min(...limits);
    },

  _pointToSegmentDistKm(pLat, pLon, aLat, aLon, bLat, bLon) {
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
    },

  _minDistToPolyline(lat, lon, polyline) {
      if (!polyline || polyline.length < 2) return Infinity;
      let minD = Infinity;
      for (let i = 0; i < polyline.length - 1; i++) {
        const d = this._pointToSegmentDistKm(lat, lon, polyline[i].lat, polyline[i].lon, polyline[i + 1].lat, polyline[i + 1].lon);
        if (d < minD) minD = d;
      }
      return minD;
    },

  _routeIntersectsPolyline(route, polyline, bufferKm = 0.1) {
      if (!route || route.length < 2 || !polyline || polyline.length < 2) return false;
      for (const p of route) {
        if (this._minDistToPolyline(p.lat, p.lon, polyline) <= bufferKm) return true;
      }
      for (const p of polyline) {
        if (this._minDistToPolyline(p.lat, p.lon, route) <= bufferKm) return true;
      }
      return false;
    },

  _isFallbackRoute(route) {
      return Array.isArray(route) && route.length > 0 && route.some(p => p && p.fallback);
    },

  async _findAlternateRoute(prevId, nextId, dateStr, timeOfDay) {
      const prev = this.world?.getStationById(prevId);
      const next = this.world?.getStationById(nextId);
      if (!prev || !next) return null;
      const orm = typeof window !== 'undefined' && window.game?.orm ? window.game.orm : null;
      if (!orm) return null;
      const blocking = this._getBlockingWorksForRoute(this._state.cachedRoute, dateStr, timeOfDay);
      if (blocking.length === 0) return null;
      const avoidPairs = blocking.map(w => {
        const a = this.world?.getStationById(w.stationA);
        const b = this.world?.getStationById(w.stationB);
        return {
          latA: a?.lat ?? w.route?.[0]?.lat ?? prev.lat,
          lonA: a?.lon ?? w.route?.[0]?.lon ?? prev.lon,
          latB: b?.lat ?? w.route?.[w.route?.length - 1]?.lat ?? next.lat,
          lonB: b?.lon ?? w.route?.[w.route?.length - 1]?.lon ?? next.lon,
        };
      });
      // First: direct route avoiding the closed pair/segment
      let direct = await orm.findConstrainedRoute(prev.lat, prev.lon, next.lat, next.lon, [], { avoidStationPairs: avoidPairs });
      if (direct && !this._isFallbackRoute(direct) && this._getBlockingWorksForRoute(direct, dateStr, timeOfDay).length === 0) return direct;
      // Then: try detours via nearby stations
      const mid = { lat: (prev.lat + next.lat) / 2, lon: (prev.lon + next.lon) / 2 };
      const candidates = this.world.stations
        .filter(s => s.id !== prevId && s.id !== nextId)
        .map(s => ({ s, d: haversineDistance(s.lat, s.lon, mid.lat, mid.lon) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 12);
      for (const { s } of candidates) {
        const via = await orm.findConstrainedRoute(prev.lat, prev.lon, next.lat, next.lon, [{ lat: s.lat, lon: s.lon }], { avoidStationPairs: avoidPairs });
        if (via && !this._isFallbackRoute(via) && this._getBlockingWorksForRoute(via, dateStr, timeOfDay).length === 0) return via;
      }
      return null;
    },

  _startAlternateRouteSearch(timeOfDay, dateStr) {
      const currentStops = this.getCurrentStops();
      if (this.currentStopIndex <= 0 || this.currentStopIndex >= currentStops.length) return;
      const prev = currentStops[this.currentStopIndex - 1];
      const next = currentStops[this.currentStopIndex];
      if (!prev || !next) return;
      const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
      const key = `${legKey}|${dateStr || ''}|${Math.floor(timeOfDay / 5)}`;
      if (this._pendingAltRoute && this._pendingAltRoute.key === key && !this._pendingAltRoute.completed) return;
      if (this._altRouteFailedKeys.has(key)) return;
      const search = { key, completed: false, route: null, failed: false };
      this._pendingAltRoute = search;
      this._findAlternateRoute(prev.stationId, next.stationId, dateStr, timeOfDay)
        .then(route => { search.route = route; search.completed = true; if (!route) this._altRouteFailedKeys.add(key); })
        .catch(() => { search.completed = true; search.failed = true; this._altRouteFailedKeys.add(key); });
    },

  _applyAlternateRoute(route, timeOfDay) {
      if (!route || route.length < 2) return;
      cantonManager.releaseAll(this.id);
      this._initializeState(route, this._state.legKey);
      this._state.worksLimitCache = null;
      this._pendingAltRoute = null;
      this._altRouteFailedKeys.clear();
      this.train.blockedBy = false;
      this.train.delayReason = 'déroutement';
      this.train.state = 'moving';
    }
};
