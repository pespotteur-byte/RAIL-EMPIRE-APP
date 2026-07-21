import {
  timeDiff, timeGte, isInServiceWindow, wrapTime, _seeded01, serviceCounters
} from './service-utils.js?v=1784731004';
import { cantonManager } from './canton-manager.js?v=1784731004';
import { ServiceStop } from './service-stop.js?v=1784731004';
import { haversineDistance, analyzeRoute } from './simulation.js?v=1784731004';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js?v=1784731004';
import { getGlobalRng } from './rng.js?v=1784731004';
import { accelerationMs2, brakingDecelMs2, _units } from './train-physics.js?v=1784731004';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js?v=1784731004';

export const SchedulePlanner = {
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
    },

  getPassageStops() {
      return this._passageStops;
    },

  getNextStop() {
      const stops = this.isReturnLeg ? this.returnStops : this.stops;
      if (this.currentStopIndex < stops.length) return stops[this.currentStopIndex];
      return null;
    },

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
    },

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
    },

  _getCurrentFirstStop() {
      if (this.isReturnLeg) {
        if (!this.returnStops?.length) this.returnStops = this.buildReturnStops();
        return this.returnStops?.[0] || null;
      }
      return this._adjustedStops?.[0] || this.stops?.[0] || null;
    },

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
        // Completed on a previous allowed day: reset for a new daily run.
        if (this.completed && dateStr !== this.completedDate) {
          this.completed = false;
          this.position = null;
          this.train.stoppedAt = null;
        }
      }

      if (this.completed) {
        this.position = null;
        this.train.stoppedAt = null;
        return;
      }

      // FAST EARLY REJECT for waiting trains far from departure
      // This avoids expensive Date parsing and service window checks for 99% of services
      if (this.state === 'waiting' && this.currentStopIndex === 0 && !this.train.breakdown && !this.train.inMaintenance) {
        const dep0 = this._cachedFirstDep;
        if (dep0 !== undefined) {
          // Quick check: if departure is more than 2 min in the future, skip.
          // timeDiff(dep0, timeOfDay) > 0 means dep0 is ahead of timeOfDay.
          const diff = timeDiff(dep0, timeOfDay);
          if (diff > 2) {
            this.position = null;
            this.train.stoppedAt = null;
            return;
          }
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
        // INC-03 : incident en gare (bagage abandonné, etc.) bloque le départ immédiat
        if (this.train.incident?.effect === 'stop') {
          this.delay = Math.max(0, timeDiff(timeOfDay, firstDep));
          this.train.delay = this.delay;
          this.train.delayReason = this.train.incident.name || 'Incident';
          return;
        }

        // Compute service window
        const lastStop = currentStops[currentStops.length - 1];
        const endTime = lastStop?.arrivalTime ?? firstDep + 120;
        const plannedDuration = Math.max(0, endTime - firstDep);
        const maxRuntime = Math.max(120, plannedDuration * 2 + 30);
        const windowEnd = firstDep + maxRuntime;

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

        // Don't show train if not in service window. If the window has been missed,
        // cancel the service instead of keeping it waiting forever.
        if (this.currentStopIndex === 0 && !isInServiceWindow(timeOfDay, firstDep - 1, windowEnd)) {
          if (timeDiff(timeOfDay, windowEnd) > 0) {
            this.completed = true;
            this.cancelled = true;
            this.state = 'cancelled';
            this.completedDate = dateStr;
            this.position = null;
            this.train.stoppedAt = null;
            return;
          }
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
          // Mise à jour du retard avant les décisions de régulation/priorité
          this.delay = Math.round(timeDiff(timeOfDay, firstDep));
          this.train.delay = this.delay;

          // Cancel only if the whole service window is missed (end + 31 min grace).
          // Within the window the train departs late so delay is reported, not cancelled.
          if (!isInServiceWindow(timeOfDay, firstDep, windowEnd)) {
            this.completed = true;
            this.cancelled = true;
            this.state = 'cancelled';
            this.completedDate = dateStr;
            this.position = null;
            this.train.stoppedAt = null;
            return;
          }
          if (isInServiceWindow(timeOfDay, firstDep, windowEnd)) {
            // Section VI — une rame ne peut pas effectuer 2 trajets en même temps
            if (this.rameId && window.game?.scheduleCreator?.isRameInUse(this.rameId, this.id, timeOfDay)) {
              // Rame already used by another active service; stay waiting and retry next tick
              return;
            }

            // REG-03 : décision régulation — train en garage temporaire
            if (this._garageUntil != null && timeOfDay < this._garageUntil) {
              this.train.state = 'garage';
              this.train.delayReason = 'regulation : garage temporaire';
              return;
            }

            // OCC-03 : priorité au départ au voyageur dont le départ est le plus tôt
            const depStationId = currentStops[0]?.stationId;
            const myDep = currentStops[0]?.departureTime;
            if (depStationId && myDep != null && this.serviceType === 'passager' && window.game?.scheduleCreator) {
              const earliest = window.game.scheduleCreator.getEarliestDueServiceAtStation(depStationId, timeOfDay);
              if (earliest && earliest.id !== this.id && timeDiff(myDep, earliest.dep) > 0) {
                const earliestSvc = window.game.scheduleCreator.services.find(s => s.id === earliest.id);
                const earliestBlockedByRame = earliestSvc && window.game.scheduleCreator.isRameInUse(earliestSvc.rameId, earliestSvc.id, timeOfDay);
                if (!earliestBlockedByRame) return;
              }
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
            this.delay = Math.round(timeDiff(timeOfDay, firstDep));
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
            // Pre-initialize route state so the first move tick doesn't pay the cost.
            {
              const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
              const route = this.getCurrentRoute();
              if (route && route.length >= 2) this._initializeState(route, legKey);
            }
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
            // Pre-initialize route state so the first move tick doesn't pay the cost.
            {
              const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
              const route = this.getCurrentRoute();
              if (route && route.length >= 2) this._initializeState(route, legKey);
            }
          }
          return;
        }

        const stops = this.getCurrentStops();
        const stop = stops[this.currentStopIndex - 1];
        if (!stop) { this.state = 'moving'; return; }

        // INC-03 : incident en gare (bagage abandonné, etc.) bloque le départ
        if (this.train.incident?.effect === 'stop' && this.train.stoppedAt) {
          this._updateContinuousDelay(timeOfDay);
          return;
        }
        // REG-03 : décision régulation — respecter le garage temporaire aussi en arrêt en gare
        if (this._garageUntil != null && this._garageUntil > timeOfDay) {
          this.train.delayReason = 'regulation : garage temporaire';
          this._updateContinuousDelay(timeOfDay);
          return;
        }

        // Section VI — ITE : bloque le départ si le train est trop long pour l'ITE
        if (this._iteHardBlock && stop?.type === 'arret' && stop?.stationId && window.game?.depotManager && window.game?.world) {
          const station = window.game.world.getStationById(stop.stationId);
          if (station) {
            const trainLength = this.rame ? this.rame.totalLength : (this.train.length || 20);
            const rameCargo = this.rame?.elementDetails?.find(e => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0)?.cargoTypes?.[0] || '';
            const iteInfo = window.game.depotManager.getITEInfo(station.id, trainLength, rameCargo);
            if (iteInfo?.isITE && !iteInfo.canFit) {
              this.train.iteInfo = { ...this.train.iteInfo, canFit: false };
              this.train.delayReason = 'ITE : train trop long';
              this._updateContinuousDelay(timeOfDay);
              return;
            }
          }
          this._iteHardBlock = false;
        }

        const depTime = stop.departureTime;
        // Mise à jour du retard pendant l'arrêt (retard à l'arrivée qui s'aggrave si le départ est dépassé)
        if (depTime != null && timeGte(timeOfDay, depTime)) {
          const depDelay = timeDiff(timeOfDay, depTime);
          if (depDelay > (this.delay ?? 0)) {
            this.delay = Math.round(depDelay);
            this.train.delay = this.delay;
          }
        }

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
          this._iteHardBlock = false;
          this.train.iteInfo = null;
          if (this.currentStopIndex >= stops.length) {
            this.completeService(economy);
          } else {
            // Release old cantons before starting new leg
            cantonManager.releaseAll(this.id);
            this.state = 'moving';
            this.speed = 0;
            this.train.speed = 0;
            this._resetState();
          }
        }
      }
    },

  _getMaxRuntimeForCurrentLeg() {
      const stops = this.getCurrentStops();
      const idx = Math.max(0, this.currentStopIndex - 1);
      if (!stops || idx + 1 >= stops.length) return 120;
      const origin = stops[idx];
      const dest = stops[idx + 1];
      const planned = ((dest.arrivalTime - origin.departureTime + 1440) % 1440) || 5;
      return Math.max(120, planned * 2 + 30);
    },

  _updateDelayReason() {
      const t = this.train;
      if (!t) return;
      if (this._iteHardBlock) { t.delayReason = 'ITE : train trop long'; return; }
      if (this._rescueDispatched || t.state === 'en panne') { t.delayReason = 'Panne — attente secours'; return; }
      if (t.breakdown) { t.delayReason = `Panne ${t.breakdown.type}`; return; }
      if (t.incident) { t.delayReason = t.incident.name || 'Incident'; return; }
      if (t.signalAlert === 'closed') { t.delayReason = 'Arrêt pour signal fermé'; return; }
      if (t.signalAlert === 'caution' || t.blockedBy) { t.delayReason = 'Régulation du trafic'; return; }
      if (this._iteCargoMismatch) { t.delayReason = 'ITE : cargaison incompatible'; return; }
      if (this._iteDwellExtra > 0) { t.delayReason = 'ITE : manœuvres / chargement'; return; }
      t.delayReason = '';
    },

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
      this.delay = Math.round(timeDiff(timeOfDay, expectedTime));
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
    },

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
        this._updateHeading(this.position, { lat: tLat, lon: tLon });
        this.totalDistance += actualMove;
        this._trackWear(actualMove, timeOfDay);
      }

      this.train.speed = Math.round(this.speed);
      this.train.totalKm = this.totalDistance;
      this.train.state = this.speed > 0 ? 'moving' : 'stopped';
      this.train.blockedBy = false;
      this._updateContinuousDelay(timeOfDay);
    },

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

      // OCC-01/02 — occupation de gare = occupation d'un point de voie.
      // Si aucune voie n'est libre (et qu'aucune n'est imposée), le train
      // patiente en approche et ré-essaie au prochain tick.
      if (station && stop && stop.type === 'arret' && window.game?.voiePointManager) {
        const vpm = window.game.voiePointManager;
        const stationVPs = vpm.getStationVoiePoints(station.id);
        if (stationVPs.length > 0) {
          let candidates = stationVPs.filter(vp => vp.occupiedBy === null || vp.occupiedBy === this.id);
          if (stop.platform) candidates = candidates.filter(vp => vp.voie === stop.platform);
          if (candidates.length === 0) {
            // Aucune voie libre : rester en mouvement à vitesse nulle, bloqué en approche
            this.speed = 0;
            this.train.speed = 0;
            this.train.blockedBy = true;
            this.train.delayReason = 'attente voie libre en gare';
            return;
          }
          const chosen = candidates[0];
          stop.voiePointId = chosen.id;
          stop.platform = chosen.voie;
          vpm.occupyVoiePoint(chosen.id, this.id);
        }
        // If no voie point is defined, the station's platform manager is used as fallback.
      }

      // Only update delay based on actual arret stops, not waypoints/passages
      if (stop?.type === 'arret') {
        const expectedTime = stop.arrivalTime;
        if (expectedTime != null) {
          this.delay = Math.round(timeDiff(timeOfDay, expectedTime));
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
          this._iteHardBlock = iteInfo.isITE && !iteInfo.canFit;
          if (this._iteHardBlock) this.train.delayReason = 'ITE : train trop long';
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
        const legRoute = [];
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
                for (const p of route) legRoute.push(p);
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
        economy.processStopRevenue(this, station.name, distFromPrev, isFirst, isTerminus, station.id, legRoute);
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
          this.delay = (this.delay ?? 0) + 5;
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
        this.completeService(economy, station, arrivalLat, arrivalLon);
      }
    },

  completeService(economy, station, arrivalLat, arrivalLon) {
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
        if ((this.delay ?? 0) > 0 && rng.random() < 1 / 3) {
          this.state = 'cancelled';
          this.cancelled = true;
          this.speed = 0; this.train.speed = 0;
          this.delay = 0; this.train.delay = 0;
          this.completed = true; this.completedDate = this._currentDate || '';
          this.train.stoppedAt = station || this.train.stoppedAt;
          if (this.rame) {
            this.rame.currentLocation = {
              stationId: station?.id || this.rame.currentLocation?.stationId || '',
              depotId: this.rame.depotId || '',
              serviceId: '',
              lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
              lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
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
        if ((this.delay ?? 0) > 0 && rng.random() < 1 / 3) {
          this.state = 'cancelled';
          this.cancelled = true;
          this.speed = 0; this.train.speed = 0;
          this.delay = 0; this.train.delay = 0;
          this.completed = true; this.completedDate = this._currentDate || '';
          this.train.stoppedAt = station || this.train.stoppedAt;
          if (this.rame) {
            this.rame.currentLocation = {
              stationId: station?.id || this.rame.currentLocation?.stationId || '',
              depotId: this.rame.depotId || '',
              serviceId: '',
              lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
              lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
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

      this.state = 'completed';
      this.currentStopIndex = 0;
      this.speed = 0;
      this.train.speed = 0;
      this.train.state = 'completed';
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
      if (this.rame) {
        this.rame.currentLocation = {
          stationId: station?.id || this.rame.currentLocation?.stationId || '',
          depotId: this.rame.depotId || '',
          serviceId: '',
          lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
          lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
        };
      }
      this.position = null;
    },

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
    },

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
    },

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
    },

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
};
