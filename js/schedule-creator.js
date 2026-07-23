import { haversineDistance, analyzeRoute } from './simulation.js?v=1784772843';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js?v=1784772843';
import { getGlobalRng } from './rng.js?v=1784772843';
import { accelerationMs2, brakingDecelMs2, _units } from './train-physics.js?v=1784772843';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js?v=1784772843';
import { ActiveService } from './active-service.js?v=1784772843';
import { ServiceStop } from './service-stop.js?v=1784772843';
import { cantonManager } from './canton-manager.js?v=1784772843';
import {
  timeDiff, timeGte, isInServiceWindow, wrapTime, _seeded01, serviceCounters
} from './service-utils.js?v=1784772843';

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
      id: `evo-${svc.id}-${serviceCounters.nextServiceId++}`,
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
  // Build per-minute indexes for rame usage and station priority.
  // Called once per simulation minute; subsequent isRameInUse/priority checks
  // are O(k) instead of O(n²) during the tick.
  beginTick(timeOfDay) {
    this._indexTime = timeOfDay;
    this._rameUsage = new Map();
    this._stationPriority = new Map();
    for (const svc of this.getActiveServices()) {
      if (!svc.active || svc.completed || svc.cancelled) continue;
      this._addToTickIndexes(svc, timeOfDay);
    }
  }

  _addToTickIndexes(svc, timeOfDay) {
    const rameId = svc.rameId;
    const currentFirst = svc._getCurrentFirstStop();
    if (rameId && currentFirst) {
      let rEntry = this._rameUsage.get(rameId);
      if (!rEntry) {
        rEntry = { moving: null, waiting: new Map() };
        this._rameUsage.set(rameId, rEntry);
      }
      if (svc.state === 'moving' || svc.state === 'stopped_at_station' || svc.state === 'departing') {
        rEntry.moving = svc.id;
      } else if (svc.state === 'waiting' && svc.currentStopIndex === 0) {
        const firstDep = currentFirst.departureTime ?? currentFirst.time;
        if (firstDep != null) {
          const diff = timeDiff(timeOfDay, firstDep);
          if (diff >= -2 && diff <= 5) rEntry.waiting.set(svc.id, firstDep);
        }
      }
    }
    if (svc.serviceType === 'passager' && svc.state !== 'moving' && svc.state !== 'departing' && currentFirst && svc.currentStopIndex === 0) {
      const depStationId = currentFirst.stationId;
      const dep = currentFirst.departureTime ?? currentFirst.time;
      if (depStationId != null && dep != null) {
        let sEntry = this._stationPriority.get(depStationId);
        if (!sEntry) {
          sEntry = { map: new Map() };
          this._stationPriority.set(depStationId, sEntry);
        }
        sEntry.map.set(svc.id, dep);
      }
    }
  }

  _removeFromTickIndexes(svc) {
    const rEntry = this._rameUsage?.get(svc.rameId);
    if (rEntry) {
      if (rEntry.moving === svc.id) rEntry.moving = null;
      rEntry.waiting.delete(svc.id);
    }
    const currentFirst = svc._getCurrentFirstStop();
    if (currentFirst?.stationId != null) {
      const sEntry = this._stationPriority?.get(currentFirst.stationId);
      if (sEntry) sEntry.map.delete(svc.id);
    }
  }

  // Refresh indexes for a single service after its scheduleTick has run.
  updateServiceIndexes(svc, timeOfDay) {
    if (!this._rameUsage) return;
    this._removeFromTickIndexes(svc);
    this._addToTickIndexes(svc, timeOfDay);
  }

  isRameInUse(rameId, excludeId, timeOfDay) {
    if (!rameId) return false;

    // Determine the excluded service's own first departure so we can order
    // multiple waiting services instead of mutually blocking each other.
    const excludedSvc = this.getActiveServices().find(s => s.id === excludeId);
    const excludedFirst = excludedSvc?._getCurrentFirstStop();
    const myDep = excludedFirst?.departureTime ?? excludedFirst?.time;
    const blocks = (otherId, otherDep) => {
      if (otherId === excludeId) return false;
      if (myDep == null || otherDep == null) return true;
      const d = timeDiff(otherDep, myDep);
      if (d < 0) return true;               // other departs earlier
      if (d === 0 && otherId < excludeId) return true; // same time, lower id first
      return false;
    };

    // Fallback if beginTick was not called (e.g. unit tests calling directly).
    if (!this._rameUsage || this._indexTime !== timeOfDay) {
      for (const svc of this.getActiveServices()) {
        if (svc.id === excludeId) continue;
        if (svc.rameId !== rameId) continue;
        if (svc.completed) continue;
        if (svc.state === 'moving' || svc.state === 'stopped_at_station' || svc.state === 'departing') return true;
        if (svc.state === 'waiting' && svc.currentStopIndex === 0) {
          const currentFirst = svc._getCurrentFirstStop();
          const firstDep = currentFirst?.departureTime ?? currentFirst?.time;
          if (firstDep != null) {
            const diff = timeDiff(timeOfDay, firstDep);
            if (diff >= -2 && diff <= 5 && blocks(svc.id, firstDep)) return true;
          }
        }
      }
      return false;
    }
    const entry = this._rameUsage.get(rameId);
    if (!entry) return false;
    if (entry.moving && entry.moving !== excludeId) return true;
    for (const [id, dep] of entry.waiting) {
      if (id === excludeId) continue;
      const diff = timeDiff(timeOfDay, dep);
      if (diff >= -2 && diff <= 5 && blocks(id, dep)) return true;
    }
    return false;
  }

  // Returns the active passenger service with the earliest due departure at the station.
  getEarliestDueServiceAtStation(stationId, timeOfDay) {
    if (!this._stationPriority || this._indexTime !== timeOfDay) return null;
    const sEntry = this._stationPriority.get(stationId);
    if (!sEntry || sEntry.map.size === 0) return null;
    let minId = null;
    let minDep = null;
    for (const [id, dep] of sEntry.map) {
      if (!timeGte(timeOfDay, dep)) continue;
      // OCC-03 : un train bloqué depuis plus de 5 min ne doit plus bloquer les départs suivants à jamais
      if (timeDiff(timeOfDay, dep) > 5) continue;
      if (minId === null || timeDiff(dep, minDep) < 0) {
        minId = id;
        minDep = dep;
      }
    }
    return minId ? { id: minId, dep: minDep } : null;
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
        if (s.serviceType && s.serviceType !== 'passager') o.svt = s.serviceType;
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
          dl: Math.round(s.delay ?? 0),
          cf: s._contractFreight || 0,
          cd: s._contractDelivered || 0,
          cm: s.completed || false,
          cn: s.cancelled || false,
          cdt: s.completedDate || '',
          ih: s._iteHardBlock || false,
          ie: s._iteDwellExtra || 0,
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
        serviceType: d.svt || (d.wt ? 'work' : 'passager'),
        isWorkTrain: (d.svt ? d.svt === 'work' : d.wt) || false,
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
          _contractFreight: d._r.cf || 0,
          _contractDelivered: d._r.cd || 0,
          completed: d._r.cm || false,
          cancelled: d._r.cn || false,
          completedDate: d._r.cdt || '',
          cm: d._r.cm || false,
          cn: d._r.cn || false,
          cdt: d._r.cdt || '',
          iteHardBlock: d._r.ih || false,
          iteDwellExtra: d._r.ie || 0,
        };
      }
      return expanded;
    }
    // Old format — just decode routes
    if (d.routes) d.routes = this._decodeRoutes(d.routes);
    return d;
  }

  loadFromSave(arr, rameManager, world, timeOfDay = 0, dateStr = '') {
    this.services = [];
    this._invalidateActiveCache();
    cantonManager.cantons.clear();
    cantonManager.routeCantons.clear();
    cantonManager.trainCantons.clear();
    const currentTimeOfDay = timeOfDay;
    const completedDate = dateStr || '';
    for (let d of arr) {
      d = this._expandCompactService(d);
      const rame = rameManager.getById(d.rameId);
      const svc = new ActiveService(d, rame, world, this.weather);
      svc.totalDistance = d.totalDistance || 0;
      svc.active = d.active !== false;

      if (d._runtime) {
        const rt = d._runtime;
        svc.completedDate = rt.completedDate || completedDate;
        svc.direction = rt.direction || 1;
        svc._tripCount = rt._tripCount || 0;
        svc._iteHardBlock = rt.iteHardBlock || false;
        svc._iteDwellExtra = rt.iteDwellExtra || 0;
        if (rt._adjustedStops) {
          svc._adjustedStops = rt._adjustedStops.map(s => new ServiceStop(
            s.stationId, s.type, s.departureTime, s.arrivalTime
          ));
        }
      }
      // Use the saved game time for validation (not wall clock).

      // Restore mid-journey state if train was moving/stopped at station
      const savedState = d._runtime?.state || 'waiting';
      const savedPos = d._runtime?.position || null;
      const savedSpeed = d._runtime?.speed || 0;
      const savedDelay = d._runtime?.delay ?? 0;
      const savedStopIdx = d._runtime?.currentStopIndex || 0;
      const savedCompleted = d._runtime?.cm || false;
      const savedCancelled = d._runtime?.cn || false;
      const savedCompletedDate = d._runtime?.cdt || completedDate;

      // Restore terminal states first so completed/cancelled services don't re-enter the schedule.
      if (savedState === 'completed' || savedState === 'cancelled' || savedCompleted || savedCancelled) {
        svc.completed = true;
        if (savedState === 'cancelled' || savedCancelled) {
          svc.cancelled = true;
          svc.state = 'cancelled';
        } else {
          svc.state = 'completed';
        }
        svc.completedDate = savedCompletedDate;
        svc.position = null;
        svc.speed = 0;
        svc.currentStopIndex = 0;
        svc.isReturnLeg = false;
        svc.delay = 0;
        svc.train.delay = 0;
        svc.train.speed = 0;
        svc.train.state = 'waiting';
        svc.train.blockedBy = false;
        svc.train.stoppedAt = null;
        svc.train._stoppedSinceGameTime = null;
      } else if ((savedState === 'moving' || savedState === 'stopped_at_station') && savedPos) {
        // Check if service window has expired for this train
        const svcStops = svc.getCurrentStops();
        const svcLastArr = svcStops[svcStops.length - 1]?.arrivalTime ?? (svcStops[0]?.departureTime ?? 0) + 120;
        const minutesPastEnd = timeDiff(currentTimeOfDay, svcLastArr);
        // If the service end time has passed, mark completed instead of restoring
        if (minutesPastEnd > 5) {
          svc.state = 'completed';
          svc.position = null;
          svc.speed = 0;
          svc.currentStopIndex = 0;
          svc.completed = true;
          svc.completedDate = completedDate;
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
        const svcStops = svc.getCurrentStops();
        const svcFirstDep = svcStops[0]?.departureTime ?? 0;
        const svcLastArr = svcStops[svcStops.length - 1]?.arrivalTime ?? svcFirstDep + 120;
        const plannedDuration = ((svcLastArr - svcFirstDep + 1440) % 1440) || 120;
        const maxRuntime = Math.max(120, plannedDuration * 2 + 30);
        const minutesSinceDep = (currentTimeOfDay - svcFirstDep + 1440) % 1440;
        const inWindow = isInServiceWindow(currentTimeOfDay, svcFirstDep - 1, svcFirstDep + maxRuntime);
        if (!inWindow && minutesSinceDep > plannedDuration + 60) {
          // Departure window has passed: mark completed, don't start late
          svc.state = 'completed';
          svc.position = null;
          svc.speed = 0;
          svc.currentStopIndex = 0;
          svc.completed = true;
          svc.completedDate = completedDate;
          svc.isReturnLeg = false;
          svc.delay = 0;
          svc.train.delay = 0;
          svc.train.speed = 0;
          svc.train.state = 'waiting';
          svc.train.blockedBy = false;
          svc.train.stoppedAt = null;
          svc.train._stoppedSinceGameTime = null;
        } else {
          // Departure is in the future or within the window: normal waiting state
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
      svc._contractFreight = d._runtime?._contractFreight || 0;
      svc._contractDelivered = d._runtime?._contractDelivered || 0;
      svc.revenueCollected = false;
      // Clear multi-trip adjusted stops to use original schedule on reload
      svc._adjustedStops = null;
      svc._tripCount = 0;
      svc._atTerminus = false;
      svc._resetState();

      this.services.push(svc);
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= serviceCounters.nextServiceId) serviceCounters.nextServiceId = num + 1;
    }
  }
}

export { ActiveService, ServiceStop, cantonManager };
