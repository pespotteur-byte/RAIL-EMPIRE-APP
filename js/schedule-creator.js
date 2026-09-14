import { randomizeRameDeparture } from './rame-random.js';
import { samePhysicalMovement } from './physical-service-identity.js';
import { assessTurnback, normalizeTurnbackState, CAB_CHANGE_SECONDS } from './formation-turnback.js';
import { materialTrackLocation, materialTrackMismatch } from './material-track-location.js';
import { materialResourceEffects, consumeMaterialResources } from './consumable-effects.js';
import { canonicalTrackRef, normalizeStationTrackIdentity, resolveNativeStationTrack, stationTrackResourceKey } from './station-track-identity.js';
import { TailSpeedIndex, normalizePassageTailSpeedHolds } from './tail-speed-index.js';
import { advanceMaterialMileage, syncMaterialMileage } from './material-mileage.js';
import { civilDayIndex, resolveLegacyOperatingDay } from './legacy-operating-day.js';
import { RouteElectrificationIndex } from './route-electrification-index.js';
import { forwardClockMinutes } from './operational-time.js';
import { resolveRailSpeedLimits } from './rail-speed.js';
// @ts-expect-error -- cache-busted browser import is intentionally resolved at runtime.
import { haversineDistance, analyzeRoute, CantonManager } from './simulation.js?v=1784561441';
import { visaSpeedCapKmh } from './signaling.js';
import { MovementAuthority } from './movement-authority.js';
import { railSectionDirectionMatchesRoute } from './rail-section-geometry.js';
// @ts-expect-error -- cache-busted browser import is intentionally resolved at runtime.
import { getGlobalRng } from './rng.js?v=1784250033';
// @ts-expect-error -- cache-busted browser import is intentionally resolved at runtime.
import { accelerationMs2, brakingDecelMs2, segmentsFromRoute, simulateProfile, _units } from './train-physics.js?v=1784250033';
import { DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber, interpolatePassageTimes, shouldSkipStop, } from './schedule-logic.js';
let nextServiceId = 1;
// SC-03 — running odd counter so each new service gets an odd (aller) number.
let nextServiceNumber = 1;
// Midnight-safe time difference: handles wrapping around 00:00
// Returns difference in minutes, clamped to [-720, 720]
function timeDiff(timeA, timeB) {
    let d = Number(timeA) - Number(timeB);
    if (d > 720)
        d -= 1440;
    else if (d < -720)
        d += 1440;
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
    }
    else {
        // Midnight-crossing
        return timeOfDay >= start || timeOfDay <= end;
    }
}
// Global canton manager shared across all services
const cantonManager = new CantonManager();
export { cantonManager };
// Deterministic [0,1) pseudo-random from a string seed (does not advance global RNG)
function _seeded01(seed) {
    let h = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++)
        h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    // xorshift32
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h >>>= 0;
    h ^= h << 5;
    h >>>= 0;
    return (h >>> 0) / 4294967296;
}
function wrapTime(t) {
    const value = Number(t);
    const n = Number.isFinite(value) ? value % 1440 : 0;
    return n < 0 ? n + 1440 : n;
}
export class ServiceStop {
    constructor(stationId, type, depTime, arrTime, voiePointId = null, platform = '', stopCode = '', extra = null) {
        this.stationId = stationId;
        this.type = type;
        this.stopCode = (stopCode || '');
        const absolute = !!extra?.absoluteTime;
        this.departureTime = absolute ? Number(depTime ?? 0) : wrapTime(depTime);
        this.arrivalTime = absolute ? Number(arrTime ?? depTime ?? 0) : (arrTime == null ? this.departureTime : wrapTime(arrTime));
        this.voiePointId = (voiePointId || null);
        this.platform = (platform || '');
        this.trackIdentity = normalizeStationTrackIdentity(extra?.trackIdentity);
        // V2 can target an exact ORM track coordinate, including technical points
        // that are not World stations. Legacy services simply leave these empty.
        this.lat = extra?.lat != null && extra.lat !== '' && Number.isFinite(Number(extra.lat)) ? Number(extra.lat) : null;
        this.lon = extra?.lon != null && extra.lon !== '' && Number.isFinite(Number(extra.lon)) ? Number(extra.lon) : null;
        this.locationOccurrenceId = extra?.locationOccurrenceId || '';
        this.technicalLocationId = (extra?.technicalLocationId || '');
        this.locationName = (extra?.locationName || '');
        this.v2OperationSec = Math.max(0, Number(extra?.v2OperationSec || 0));
        this.turnBack = extra?.turnBack === true;
        if (this.turnBack)
            this.type = 'arret';
    }
}
export class ActiveService {
    constructor(data, rame, world, weather) {
        this._tailSpeedIndex = null;
        this._passageTailSpeedHolds = [];
        this._stepPhysicalLeader = null;
        this._legacyOperatingDay = '';
        this._legacyLastFinishedDay = '';
        this.id = (data.id || `svc-${nextServiceId++}`);
        this.name = (data.name || 'Service');
        this._v2OccurrenceId = (data.v2OccurrenceId || '');
        this._v2RotationId = (data.v2RotationId || '');
        this._v2BaseDate = (data.v2BaseDate || '');
        this._v2OptionalStopDecisions = (data.optionalStopDecisions || null);
        this._v2AllowEarlyDeparture = data.allowEarlyDeparture === true;
        this.rameId = data.rameId || rame?.id || '';
        this.rame = rame;
        this.stops = (Array.isArray(data.stops) ? data.stops : []).map((s) => new ServiceStop(s.stationId, s.type, s.departureTime ?? s.time, s.arrivalTime ?? s.time, s.voiePointId, s.platform, s.stopCode, {
            absoluteTime: !!this._v2OccurrenceId, lat: s.lat, lon: s.lon,
            locationOccurrenceId: s.locationOccurrenceId,
            technicalLocationId: s.technicalLocationId,
            locationName: s.locationName,
            v2OperationSec: s.v2OperationSec, trackIdentity: s.trackIdentity, turnBack: s.turnBack,
        }));
        this.routes = (data.routes || []);
        this.world = world;
        this.weather = weather;
        this.roundTrip = (data.roundTrip || false);
        this.multiDepartures = (data.multiDepartures || 1);
        this.terminusWait = (data.terminusWait ?? DEFAULT_TERMINUS_WAIT_MIN); // preserve explicit 0
        // Legacy keeps its historical odd/even auto-numbering. V2 train numbers
        // are user data and may deliberately be duplicated or non-numeric.
        if (this._v2OccurrenceId) {
            this.number = (data.number != null ? data.number : '');
            this.returnNumber = (data.returnNumber != null ? data.returnNumber : '');
        }
        else {
            this.number = toOdd(data.number != null ? data.number : nextServiceNumber);
            if (data.number != null) {
                nextServiceNumber = Math.max(nextServiceNumber, this.number + 2);
            }
            else {
                nextServiceNumber = this.number + 2;
            }
            this.returnNumber = data.returnNumber != null
                ? data.returnNumber : returnNumberFor(this.number);
        }
        // SC-04 — optional independent return geometry/stops (falls back to the
        // reversed forward leg when absent, keeping old saves working).
        this._returnRoutes = (data.returnRoutes || null);
        this._returnStopsData = (data.returnStops || null);
        this.totalDistance = (data.totalDistance || 0);
        this.plannedDistance = (data.plannedDistance || 0);
        this.active = data.active !== false;
        // Section VI — types de convois : passager, fret, W, HLP, TM, Infra, TTX, EVO.
        // Legacy 'work' is kept as the historical TTX value for save compatibility.
        this.serviceType = (data.serviceType || (data.isWorkTrain ? 'work' : 'passager'));
        this.isTTX = this.serviceType === 'ttx' || this.serviceType === 'work';
        this.isLegacyCatenaryWork = this.serviceType === 'work';
        this.isWorkTrain = this.isTTX || this.serviceType === 'infra'; // S15: infrastructure/work trains unaffected by works
        // Section X — contrat fret éventuellement assigné à ce service.
        // W/HLP/TM (plus leurs variantes techniques legacy M-/EVO) sont des
        // mouvements vides et ne doivent jamais conserver un contrat de chargement.
        const emptyMovement = ['w', 'hlp', 'tm', 'm-', 'evo'].includes(this.serviceType.toLowerCase());
        this.assignedContractId = (emptyMovement ? '' : (data.assignedContractId || ''));
        this.returnName = (data.returnName || '');
        this.returnPlatforms = (data.returnPlatforms || {}); // { stationId: platformName }
        this.runDays = (data.runDays || [0, 1, 2, 3, 4, 5, 6]); // days of week (0=Sun..6=Sat), default all
        this.runDates = (data.runDates || []); // specific dates (YYYY-MM-DD), empty = every day
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
        this._departureResourceHold = null; // station resources kept until the tail clears
        // Simulation state for strict segment-based route following
        this._state = {
            index: 0,
            progress: 0,
            legKey: null,
            cachedRoute: null,
            worksLimitCache: null,
        };
        this._routeAnalysis = null;
        this._cantonAssignments = null;
        this._carryoverCantonIds = null; // old-leg footprint retained until the tail clears the station throat
        this._occupiedTronconIds = new Set();
        this._tronconExitTravelKm = new Map();
        this._reservedTronconId = null;
        this._lastTronconId = null;
        this._brakeEffort = 0; // 0..1 pneumatic/electrodynamic service-brake build-up
        // HOTFIX81 — traction is not an instantaneous switch either. Ramp the
        // commanded tractive effort so a train does not jump straight to its full
        // power/adhesion acceleration on the first physics tick.
        this._tractiveEffort = 0; // 0..1 traction build-up
        this._stationaryRoute = null; // exact approach geometry retained while stopped at a station
        this._stationaryRouteIndex = 0;
        // TRV-06 — automatic alternate route search when a leg is closed
        this._pendingAltRoute = null; // { key, completed, route, failed }
        this._altRouteFailedKeys = new Set();
        // v1.1.73 — these are only safety ceilings. Real acceleration comes from
        // power / *live* total mass / adhesion / Davis resistance; real braking comes
        // from the train category, weather, grade and brake build-up below. The old
        // constructor guessed both from an arbitrary 70% payload and then kept that
        // guess as a hidden cap for the whole run.
        const physicsMult = (typeof window !== 'undefined' ? (window.game?.realismSettings?.physics ?? 1) : 1);
        let accel = Math.max(0.1, 5.0 * physicsMult); // km/h/s ceiling
        let decel = Math.max(0.1, 5.0 * physicsMult); // km/h/s ceiling
        // S12: Get locomotive series name/number from rame
        let seriesName = '', trainNumber = '';
        if (rame?.elementDetails?.length) {
            const loco = rame.elementDetails.find((e) => !!e.seriesName);
            if (loco) {
                seriesName = loco.seriesName;
                trainNumber = String(loco.instanceNumber || loco.numberStart || '');
            }
        }
        // v1.1.55 — seven explicit Livemap categories. Legacy service types are
        // normalized here so old saves keep a meaningful marker colour.
        if (this.serviceType === 'fret')
            this.category = 'fret';
        else if (this.serviceType === 'w')
            this.category = 'w';
        else if (this.serviceType === 'hlp' || this.serviceType === 'm-' || this.serviceType === 'evo')
            this.category = 'hlp';
        else if (this.serviceType === 'tm')
            this.category = 'tm';
        else if (this.serviceType === 'infra')
            this.category = 'infra';
        else if (this.isTTX)
            this.category = 'ttx';
        else
            this.category = (rame && rame.totalFreightCapacity > rame.totalCapacity) ? 'fret' : 'voyageur';
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
            delayReason: '', // OCC-04 : motif du retard (régulation, signal, incident...)
            // v1.1.65 — historical incident causes that actually contributed delay.
            // Location text is frozen when the train encounters the incident.
            incidentDelayReasons: [],
            accel,
            decel,
            seriesName,
            number: this.number != null ? String(this.number) : trainNumber,
            platform: null,
            // S14: Wear tracking — initialize from rame (persists across services)
            totalKmRun: rame ? (rame.totalKmRun || 0) : 0,
            kmSinceLastMaint: rame ? (rame.kmSinceLastMaint || 0) : 0,
            wearLevel: rame ? (rame.wearLevel || 0) : 0,
            // HOTFIX50 — depot presence and maintenance are distinct states.
            // Both prevent a departure, but a rame simply parked on a depot track must
            // never be presented as being in maintenance.
            inMaintenance: rame ? !!rame.inMaintenance : false,
            inDepot: rame ? !!rame.currentLocation?.depotId : false,
        };
        this._movementAuthority = new MovementAuthority(this.train);
        // Garage/shunting state
        this._garage = null; // { vpId, route, savedRoute, savedStopIndex, savedState, blockerTrainId }
        // Section VI — ITE state
        this._iteHardBlock = false;
        this._iteDwellExtra = 0;
        this._iteCargoMismatch = false;
        // Position will be set by scheduleTick when in pre-departure window
        // (don't set here to avoid ghost trains on the map)
        // SC-02 — pre-compute passage times at every real station encountered on
        // each leg, even if it is not a scheduled stop or waypoint.
        // V2 intentionally does NOT materialise every station merely traversed by a
        // route. Only explicitly clicked station/technical stops belong to the timetable.
        this._passageStops = this._v2OccurrenceId ? [] : this._computePassageStops();
        // LVM — randomized response margins per service (Annexe 3A : 25-50 m carré, 50-150 m ralentissement)
        // Deterministic from service id so save/load and tests stay stable.
        this._carreMarginM = 25 + _seeded01(this.id + ':carre') * 25;
        this._negativeBufferKm = 0.05 + _seeded01(this.id + ':neg') * 0.10;
    }
    _movementBegin(baseLimitKmh = Infinity) {
        if (!this._movementAuthority)
            this._movementAuthority = new MovementAuthority(this.train);
        this._movementAuthority.begin(baseLimitKmh);
        return this._movementAuthority.decision();
    }
    _movementGo() {
        if (!this._movementAuthority)
            this._movementAuthority = new MovementAuthority(this.train);
        this._movementAuthority.go();
        return true;
    }
    _movementStop(code = 'RUNTIME_STOP', reason = '', source = 'runtime', meta = null) {
        if (!this._movementAuthority)
            this._movementAuthority = new MovementAuthority(this.train);
        const why = reason || this.train?.delayReason || 'arrêt de sécurité';
        this._movementAuthority.stop(code, why, source, meta);
        if (this.train && !this.train.delayReason)
            this.train.delayReason = why;
        return false;
    }
    _movementCaution(limitKmh, code = 'RUNTIME_CAUTION', reason = '', source = 'runtime', meta = null) {
        if (!this._movementAuthority)
            this._movementAuthority = new MovementAuthority(this.train);
        this._movementAuthority.caution(limitKmh, code, reason || 'marche prudente', source, meta);
        return this._movementAuthority.decision();
    }
    _computePassageStops() {
        if (!this.world || !this.world.stations || this.stops.length < 2)
            return [];
        const passages = [];
        const thresholdKm = 0.5;
        const stopsByStation = new Set();
        for (const s of this.stops)
            if (s.stationId)
                stopsByStation.add(s.stationId);
        for (let leg = 0; leg < this.stops.length - 1; leg++) {
            const route = this.routes[leg];
            if (!route || route.length < 2)
                continue;
            const stopA = this.stops[leg];
            const stopB = this.stops[leg + 1];
            const depTime = stopA.departureTime;
            const arrTime = stopB.arrivalTime;
            const cumDists = [0];
            for (let i = 1; i < route.length; i++) {
                cumDists[i] = cumDists[i - 1] + haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
            }
            const totalDist = cumDists[cumDists.length - 1];
            if (totalDist <= 0)
                continue;
            // v1.1.43 — legacy services used to compare EVERY European station with
            // EVERY route point here. With the 17,817-station baseline, creating/loading
            // one long legacy service could explode into hundreds of millions of distance
            // calculations. Use World's existing station spatial index around the route
            // points and keep the exact same <=500 m route-point semantics.
            if (typeof this.world.getStationsNear === 'function') {
                const bestByStation = new Map();
                for (let i = 0; i < route.length; i++) {
                    const pt = route[i];
                    const near = this.world.getStationsNear(pt.lat, pt.lon, thresholdKm);
                    for (const st of near) {
                        if (stopsByStation.has(st.id))
                            continue;
                        const d = haversineDistance(st.lat, st.lon, pt.lat, pt.lon);
                        const prev = bestByStation.get(st.id);
                        if (!prev || d < prev.dist)
                            bestByStation.set(st.id, { st, idx: i, dist: d });
                    }
                }
                for (const { st, idx, dist } of bestByStation.values()) {
                    if (dist > thresholdKm || idx < 0)
                        continue;
                    const dFromStart = cumDists[idx];
                    const times = interpolatePassageTimes(depTime, arrTime, [0, dFromStart, totalDist]);
                    passages.push({ stationId: st.id, name: st.name, time: times[1], leg, distKm: dFromStart });
                }
            }
            else {
                // Compatibility path for tiny test/custom worlds without a spatial index.
                for (const st of this.world.stations) {
                    if (stopsByStation.has(st.id))
                        continue;
                    let bestIdx = -1, bestDist = Infinity;
                    for (let i = 0; i < route.length; i++) {
                        const d = haversineDistance(st.lat, st.lon, route[i].lat, route[i].lon);
                        if (d < bestDist) {
                            bestDist = d;
                            bestIdx = i;
                        }
                    }
                    if (bestDist <= thresholdKm && bestIdx >= 0) {
                        const dFromStart = cumDists[bestIdx];
                        const times = interpolatePassageTimes(depTime, arrTime, [0, dFromStart, totalDist]);
                        passages.push({ stationId: st.id, name: st.name, time: times[1], leg, distKm: dFromStart });
                    }
                }
            }
        }
        const byStation = new Map();
        for (const p of passages) {
            const existing = byStation.get(p.stationId);
            if (!existing || p.distKm < existing.distKm)
                byStation.set(p.stationId, p);
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
    _v2ScheduleNowMinutes(dateStr, timeOfDay) {
        if (!this._v2OccurrenceId || !this._v2BaseDate || !dateStr)
            return timeOfDay;
        const a = Date.parse(`${this._v2BaseDate}T12:00:00Z`);
        const b = Date.parse(`${dateStr}T12:00:00Z`);
        if (!Number.isFinite(a) || !Number.isFinite(b))
            return timeOfDay;
        const days = Math.round((b - a) / 86400000);
        return days * 1440 + timeOfDay;
    }
    // V2 timetables are absolute relative to the operating day and may freely
    // exceed 24 h. Legacy services keep the historical midnight-wrapping rules.
    _scheduleDiff(a, b) {
        return this._v2OccurrenceId ? (a - b) : timeDiff(a, b);
    }
    _scheduleGte(a, b) {
        return this._v2OccurrenceId ? (a >= b) : timeGte(a, b);
    }
    // V2 zero-margin contract: the timetable must never be converted into an
    // instantaneous cruise-speed cap. Runtime speed is governed by physical /
    // operational limits. An early physical passenger arrival is accepted, but
    // departure remains pinned to the booked departure time.
    _timetableSpeedCap(timeOfDay, route) {
        return null;
    }
    _isLiveResourceOwner(ownerId) {
        if (ownerId == null || ownerId === this.id)
            return true;
        const services = globalThis.window?.game?.scheduleCreator?.services || [];
        const owner = cantonManager.findResourceOwner(services, ownerId);
        // Keep live-state decisions separate from the identity acceleration index.
        // A malformed duplicate introduced earlier in this same tick must not let a
        // cached inactive entry erase another consist's physical occupation.
        const live = (service) => {
            if (!service || service.active === false || service.completed || service.cancelled || service.state === 'completed' || service.state === 'cancelled')
                return false;
            if (service.state === 'moving' || service.state === 'departing' || service.state === 'stopped_at_station')
                return true;
            return !!service.position;
        };
        if (live(owner))
            return true;
        return services.some((service) => String(service?.id) === String(ownerId) && live(service));
    }
    // HOTFIX72 — arrival reservation deadlock breaker. A follower can reach the
    // reservation horizon first simply because services are ticked in a different
    // order. If that follower reserves the exact platform needed by the physical
    // leader, we get a circular wait: leader = "voie occupée", follower =
    // "espacement". Only pre-empt a reservation when the current train is proven
    // to be physically ahead and the owner is still approaching the SAME station.
    _arrivalReservationOwnerIsFollower(ownerId, station, stop, resource = null) {
        if (ownerId == null || String(ownerId) === String(this.id) || !station || !this.position)
            return false;
        const services = globalThis.window?.game?.scheduleCreator?.services || [];
        const owner = services.find((s) => String(s?.id) === String(ownerId));
        if (!owner || !owner.position || owner.completed || owner.cancelled || owner.active === false)
            return false;
        const ownerNext = owner.getNextStop?.();
        if (String(ownerNext?.stationId || '') !== String(station.id || ''))
            return false;
        const ownerPhysicalStation = String(owner.train?.stoppedAt?.id || owner._platformAssignment?.stationId || '');
        if (owner.state === 'stopped_at_station' && ownerPhysicalStation === String(station.id || ''))
            return false;
        // Strong proof: the reservation owner sees THIS service as its physical leader.
        try {
            const ownerRoute = owner._state?.cachedRoute || owner.getCurrentRoute?.();
            const leader = ownerRoute?.length >= 2 ? owner._findPhysicalLeader?.(services, ownerRoute, 6) : null;
            if (leader?.service && String(leader.service.id) === String(this.id))
                return true;
        }
        catch { }
        // Conservative fallback for old/custom route objects: only an owner already
        // stopped by train spacing may lose its speculative arrival reservation, and
        // only when it is materially farther from the exact station resource.
        const reason = String(owner.train?.delayReason || owner.train?.blockedReason || '');
        if (!/espacement|proximity/i.test(reason))
            return false;
        const lat = Number(resource?.lat ?? stop?.lat ?? station.lat);
        const lon = Number(resource?.lon ?? stop?.lon ?? station.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            return false;
        const myDist = haversineDistance(Number(this.position.lat), Number(this.position.lon), lat, lon);
        const ownerDist = haversineDistance(Number(owner.position.lat), Number(owner.position.lon), lat, lon);
        return Number.isFinite(myDist) && Number.isFinite(ownerDist) && ownerDist > myDist + 0.02;
    }
    _revokeFollowerArrivalReservation(ownerId, stationId, voiePointId = null, platform = null) {
        const services = globalThis.window?.game?.scheduleCreator?.services || [];
        const owner = services.find((s) => String(s?.id) === String(ownerId));
        if (!owner)
            return;
        const a = owner._platformAssignment;
        if (a && String(a.stationId || '') === String(stationId || '') &&
            (!voiePointId || !a.voiePointId || String(a.voiePointId) === String(voiePointId))) {
            owner._platformAssignment = null;
            if (!owner._departureResourceHold || String(owner._departureResourceHold.stationId || '') !== String(stationId || '')) {
                owner.train.platform = null;
            }
        }
        // The follower remains physically protected by canton/proximity. Clearing a
        // station-resource reason avoids a stale UI reason after its reservation is revoked.
        if (String(owner.train?.delayReason || '') === 'attente voie libre en gare')
            owner.train.delayReason = '';
    }
    _purgeStaleStationResources(stationId) {
        const game = globalThis.window?.game;
        const vpm = game?.voiePointManager;
        if (vpm) {
            for (const vp of vpm.getStationVoiePoints?.(stationId) || []) {
                if (vp?.occupiedBy != null && vp.occupiedBy !== this.id && !this._isLiveResourceOwner(vp.occupiedBy)) {
                    vpm.releaseVoiePoint?.(vp.id, vp.occupiedBy);
                }
            }
        }
        const pm = game?.platformManager;
        const data = pm?.stationPlatforms?.get?.(stationId);
        if (data?.occupied instanceof Map) {
            for (const [plat, ownerId] of Array.from(data.occupied.entries())) {
                if (ownerId !== this.id && !this._isLiveResourceOwner(ownerId))
                    data.occupied.delete(plat);
            }
        }
    }
    _reserveArrivalResources(station, stop) {
        if (!station || !stop || stop.type !== 'arret')
            return true;
        this._purgeStaleStationResources(station.id);
        const vpm = globalThis.window?.game?.voiePointManager;
        if (vpm) {
            if (stop.voiePointId) {
                const requested = vpm.getVoiePointById(stop.voiePointId);
                if (!requested || String(requested.stationId || '') !== String(station.id || ''))
                    return false;
            }
            const stationVPs = vpm.getStationVoiePoints(station.id) || [];
            if (stationVPs.length) {
                let chosen = stop.trackIdentity ? resolveNativeStationTrack(stop.trackIdentity, String(station.id), stationVPs) : null;
                if (stop.trackIdentity && !chosen)
                    return false;
                if (!chosen && stop.voiePointId)
                    chosen = vpm.getVoiePointById(stop.voiePointId);
                if (!chosen && stop.platform) {
                    const canonical = (value) => String(value ?? '').trim().toLowerCase().replace(/^(?:voie|track|gleis|v)\s*(\d+)$/, '$1');
                    chosen = stationVPs.find((vp) => canonical(vp.voie) === canonical(stop.platform));
                    if (!chosen)
                        return false; // Do not mutate a requested track into a free substitute.
                }
                if (!chosen)
                    chosen = stationVPs.find((vp) => vp.occupiedBy == null || vp.occupiedBy === this.id);
                if (!chosen)
                    return false;
                if (chosen.occupiedBy != null && chosen.occupiedBy !== this.id) {
                    const previousOwner = chosen.occupiedBy;
                    if (!this._arrivalReservationOwnerIsFollower(previousOwner, station, stop, chosen))
                        return false;
                    // The physical leader wins the station route. The follower never moves
                    // through this transfer: it stays held by its own canton/proximity signal.
                    vpm.releaseVoiePoint?.(chosen.id, previousOwner);
                    this._revokeFollowerArrivalReservation(previousOwner, station.id, chosen.id, chosen.voie);
                }
                stop.voiePointId = chosen.id;
                if (!stop.trackIdentity)
                    stop.platform = chosen.voie;
                const occupied = vpm.occupyVoiePoint(chosen.id, this.id);
                // Old/custom managers returned undefined on success; only an explicit
                // false is a refusal. The native v1.1.73 manager is fail-closed.
                if (occupied === false)
                    return false;
                this._platformAssignment = { stationId: station.id, platform: chosen.voie, voiePointId: chosen.id, source: 'VOIE_POINT', trackIdentity: stop.trackIdentity, displayName: String(stop.platform || chosen.voie) };
                this.train.platform = stop.trackIdentity ? stop.platform : chosen.voie;
                return true;
            }
        }
        if (stop.trackIdentity?.kind === 'native')
            return false;
        const pm = globalThis.window?.game?.platformManager;
        if (!pm)
            return true;
        // A restored/candidate assignment is not a reservation. Recheck the manager
        // so catch-up cannot acquire a platform by merely constructing this object.
        if (!stop.trackIdentity && this._platformAssignment?.stationId === station.id &&
            pm.getPlatformForTrain?.(station.id, this.id) != null)
            return true;
        const preferred = stop.trackIdentity ? stationTrackResourceKey(stop.trackIdentity) : (stop.platform || '');
        const reservationOptions = { exactPreferred: !!this._v2OccurrenceId || !!stop.trackIdentity, trackIdentity: stop.trackIdentity, displayName: String(stop.platform || '') };
        let plat = pm.assignPlatform(station.id, this.id, station.platforms || 2, preferred || null, reservationOptions);
        if (plat == null && preferred) {
            const data = pm.stationPlatforms?.get?.(station.id);
            const wanted = String(preferred).match(/^(?:voie|track|gleis|v)?\s*(\d+)$/i);
            const key = wanted ? (data?.occupied?.has?.(Number(wanted[1])) ? Number(wanted[1]) : String(Number(wanted[1]))) : preferred;
            const previousOwner = stop.trackIdentity
                ? pm.getPhysicalTrackOwner?.(station.id, stop.trackIdentity, String(stop.platform || ''))
                : data?.occupied?.get?.(key);
            if (previousOwner != null && this._arrivalReservationOwnerIsFollower(previousOwner, station, stop, station)) {
                pm.releasePlatform?.(station.id, previousOwner);
                this._revokeFollowerArrivalReservation(previousOwner, station.id, null, preferred);
                plat = pm.assignPlatform(station.id, this.id, station.platforms || 2, preferred || null, reservationOptions);
            }
        }
        if (plat == null)
            return false;
        // A schedule-forced numeric platform must never silently spill onto another one.
        if (preferred && /^\d+$/.test(String(preferred)) && String(plat) !== String(preferred)) {
            pm.releasePlatform(station.id, this.id);
            return false;
        }
        this._platformAssignment = { stationId: station.id, platform: plat, source: 'PLATFORM_MANAGER', trackIdentity: stop.trackIdentity, displayName: String(stop.platform || plat) };
        this.train.platform = stop.trackIdentity ? stop.platform : plat;
        return true;
    }
    _beginDepartureResourceHold(stationId) {
        this._departureResourceHold = {
            stationId: stationId || this._platformAssignment?.stationId || '',
            platform: this._platformAssignment?.platform ?? this.train?.platform ?? null,
            platformSource: this._platformAssignment?.source || '',
            trackIdentity: this._platformAssignment?.trackIdentity || null,
            displayName: this._platformAssignment?.displayName || String(this.train?.platform || ''),
            voiePointId: this._platformAssignment?.voiePointId || null,
            startTravelKm: Number(this.totalDistance || 0),
        };
    }
    _releaseDepartureResourcesIfTailClear(route = this._state?.cachedRoute) {
        const hold = this._departureResourceHold;
        if (!hold)
            return;
        const lengthM = Math.max(1, Number(this.rame?.totalLength || this.train?.length || 20));
        // Use distance actually travelled since departure, not route-origin progress.
        // This stays correct after reroutes and never depends on OSM point density.
        const travelledM = Math.max(0, (Number(this.totalDistance || 0) - Number(hold.startTravelKm || 0)) * 1000);
        if (travelledM + 0.5 < lengthM)
            return;
        const vpm = globalThis.window?.game?.voiePointManager;
        // Release ONLY the origin track point. releaseAllVoiePointsForTrain() could
        // accidentally erase an arrival platform already reserved further ahead.
        if (vpm && hold.voiePointId)
            vpm.releaseVoiePoint(hold.voiePointId, this.id);
        if (hold.stationId && window.game?.platformManager && hold.platformSource !== 'VOIE_POINT') {
            globalThis.window?.game?.platformManager?.releasePlatform(hold.stationId, this.id);
        }
        if (this._platformAssignment?.stationId === hold.stationId)
            this._platformAssignment = null;
        this._departureResourceHold = null;
        this._stationaryRoute = null;
        this._stationaryRouteIndex = 0;
        // Do not blank the UI platform if a different destination platform is
        // already reserved by this train.
        if (!this._platformAssignment)
            this.train.platform = null;
    }
    _isPassengerService() {
        const type = String(this.serviceType || '').toLowerCase();
        return this.category === 'voyageur' || type === 'passager' || type === 'passenger' || type === 'voyageur';
    }
    _holdForBookedArrival(timeOfDay) {
        // LIVEMAP EARLY-ARRIVAL FIX — reaching the physical platform is an arrival.
        // The old hard gate stopped the consist at the route endpoint while leaving
        // ActiveService in "moving". On the following tick speed was already zero,
        // moveUpdate returned before arriveAtStation(), and the train could remain
        // there forever while its displayed delay kept increasing.
        //
        // Passenger "no advance" is therefore enforced at DEPARTURE, not by
        // refusing a real physical arrival. arriveAtStation() clamps passenger delay
        // to >= 0 and stopped_at_station waits for the booked departure time.
        const passenger = typeof this._isPassengerService === 'function'
            ? this._isPassengerService()
            : !!this._v2OccurrenceId;
        if (!passenger)
            return false;
        const stop = this.getNextStop?.();
        if (!stop || stop.type !== 'arret')
            return false;
        const booked = Number(stop.arrivalTime ?? stop.departureTime);
        if (!Number.isFinite(booked))
            return false;
        const now = this._v2ScheduleNowMinutes(this._currentDate, timeOfDay);
        const diff = typeof this._scheduleDiff === 'function'
            ? this._scheduleDiff(booked, now)
            : (this._v2OccurrenceId ? (booked - now) : timeDiff(booked, now));
        if (diff > (1 / 60)) {
            // Reserve the real arrival resource before committing the stop, but do not
            // block the state transition itself. This keeps interlocking protection
            // while allowing arriveAtStation() to mark the train physically at quai.
            const station = this.getTargetStation?.();
            if (typeof this._reserveArrivalResources === 'function') {
                const reserved = this._reserveArrivalResources(station, stop);
                if (!reserved) {
                    this.speed = 0;
                    if (this.train) {
                        this.train.speed = 0;
                        this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                        this.train.delayReason = 'attente voie libre en gare';
                    }
                    return true;
                }
            }
            this.delay = 0;
            if (this.train) {
                this.train.delay = 0;
                if (typeof this._movementGo === 'function')
                    this._movementGo();
                else
                    new MovementAuthority(this.train).begin(); // prototype-level compatibility tests/plugins
                this.train.delayReason = 'arrivée en avance : attente heure de départ';
            }
        }
        return false;
    }
    _commitNearEndpointArrival(route, timeOfDay, toleranceKm = 0.006) {
        if (!Array.isArray(route) || route.length < 2 || this.state !== 'moving')
            return false;
        const stop = this.getNextStop?.();
        if (!stop || stop.type !== 'arret')
            return false;
        const remainingKm = this._getRemainingDistance(route);
        if (!Number.isFinite(remainingKm) || remainingKm > toleranceKm)
            return false;
        // Never turn an operational stop (signal/incident/works/breakdown/route conflict)
        // into an artificial station arrival. Arrival-track reservation remains atomic.
        if (this.train?.blockedBy || (this.train?.breakdown && !['climatisation', 'portes'].includes(this.train.breakdown.type)))
            return false;
        const station = this.getTargetStation?.();
        if (!station || !this._reserveArrivalResources(station, stop))
            return false;
        const last = route[route.length - 1];
        this._state.index = route.length - 1;
        this._state.progress = 0;
        this.position = { lat: last.lat, lon: last.lon };
        this.speed = 0;
        if (this.train)
            this.train.speed = 0;
        this._syncCantonFootprint?.(route);
        this.arriveAtStation(station, timeOfDay, this._economy);
        return true;
    }
    _scheduleInWindow(now, start, end) {
        return this._v2OccurrenceId
            ? (now >= start && now <= end)
            : isInServiceWindow(now, start, end);
    }
    getNextStop() {
        const stops = this.isReturnLeg ? this.returnStops : this.stops;
        if (this.currentStopIndex < stops.length)
            return stops[this.currentStopIndex];
        return null;
    }
    getTargetStation() {
        const next = this.getNextStop();
        if (!next || !this.world)
            return null;
        // V2 binds a stop to the exact ORM track coordinate, not the station centre.
        // Keep the real station id/name for gameplay when it exists.
        if (next.lat != null && next.lon != null) {
            const st = next.stationId ? this.world.getStationById(next.stationId) : null;
            return {
                ...(st || {}),
                id: st?.id || next.technicalLocationId || `tech-${next.locationOccurrenceId || this.currentStopIndex}`,
                name: st?.name || next.locationName || 'Point technique',
                lat: next.lat,
                lon: next.lon,
                platforms: st?.platforms || 1,
                _v2Technical: !st,
            };
        }
        // Legacy station stop
        if (next.stationId)
            return (this.world.getStationById(next.stationId) || null);
        // Non-station voie point stop — return virtual target from voie point coords
        if (next.voiePointId && window.game?.voiePointManager) {
            const vp = window.game.voiePointManager.getVoiePointById(next.voiePointId);
            if (vp)
                return { id: vp.id, name: `Voie ${vp.voie}`, lat: vp.lat, lon: vp.lon, platforms: 1 };
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
    // Returns the raw first stop of the *current* leg, without skippable-stop
    // randomisation, so scheduling indexes use the actual next/current station.
    _getCurrentFirstStop() {
        if (this.isReturnLeg) {
            if (!this.returnStops?.length)
                this.returnStops = this.buildReturnStops();
            return this.returnStops?.[0] || null;
        }
        return this._adjustedStops?.[0] || this.stops?.[0] || null;
    }
    // MET-01/03/04/05/06 — météo locale au point courant
    _getWeatherEffects() {
        if (!this.weather)
            return { brakeFactor: 1.0, speedCap: Infinity, speedMult: 1.0, type: 'clear' };
        let lat = this.position?.lat;
        let lon = this.position?.lon;
        if ((lat == null || lon == null) && this._state?.cachedRoute) {
            const pt = this._state.cachedRoute[this._state.index || 0];
            if (pt) {
                lat = pt.lat;
                lon = pt.lon;
            }
        }
        return this.weather.getSpeedEffectsAt(lat, lon, this.rame ? this.rame.maxSpeed : (this.train?.maxSpeed || 0));
    }
    _referenceLoadRatio() {
        const vals = [this.rame?.currentLoadRatio, this.rame?.loadRatio, this.rame?.payloadRatio].map(Number).filter(Number.isFinite);
        return vals.length ? Math.max(0, Math.min(1, vals[0])) : 0;
    }
    // Live consist mass. Use actual onboard demand whenever the economy has
    // initialised it. Before that, use an explicit configured load ratio if one
    // exists; never invent the old hidden 70% payload.
    _currentMassKg() {
        if (!this.rame)
            return 400000;
        const emptyT = Number(this.rame.totalMass || this.rame.totalTonnage || 400);
        const hasPax = Number.isFinite(Number(this._onboardPax));
        const hasFreight = Number.isFinite(Number(this._onboardFreight)) || Number.isFinite(Number(this._contractFreight));
        const paxT = hasPax
            ? Math.max(0, Number(this._onboardPax || 0)) * 0.08
            : Math.max(0, Number(this.rame.totalCapacity || 0)) * this._referenceLoadRatio() * 0.08;
        const freightT = hasFreight
            ? Math.max(0, Number(this._onboardFreight || 0)) + Math.max(0, Number(this._contractFreight || 0))
            : Math.max(0, Number(this.rame.totalFreightCapacity || 0)) * this._referenceLoadRatio();
        return Math.max(1000, (emptyT + paxT + freightT) * 1000);
    }
    _adhesionMassKg() {
        if (!this.rame)
            return 90000;
        const poweredT = Number(this.rame.adhesionMass || 0) || (this.rame.elementDetails || [])
            .filter((e) => (e.category === 'locomotive' || e.category === 'automotrice') && Number(e.power || 0) > 0)
            .reduce((sum, e) => sum + Math.max(0, Number(e.mass || e.tonnage || 0)), 0);
        // Conservative fallback for incomplete old catalogue rows: one traction unit,
        // never the complete hauled consist.
        return Math.max(1000, (poweredT > 0 ? poweredT : Math.min(Number(this.rame.totalMass || 100), 100)) * 1000);
    }
    // OSM incline uses percentages by convention. Keep signed %/‰ values and
    // reverse the sign when traversing the OSM way backwards.
    _gradePermilleAt(route = this._state?.cachedRoute, segIdx = this._state?.index || 0) {
        if (!Array.isArray(route) || route.length < 2)
            return 0;
        const a = route[Math.max(0, Math.min(route.length - 1, segIdx))];
        const b = route[Math.max(0, Math.min(route.length - 1, segIdx + 1))];
        const raw = b?.tags?.incline ?? a?.tags?.incline ?? b?.incline ?? a?.incline;
        if (raw == null || raw === '' || raw === 'up' || raw === 'down')
            return 0;
        const txt = String(raw).trim().replace(',', '.');
        let value = Number.parseFloat(txt);
        if (!Number.isFinite(value))
            return 0;
        if (txt.includes('‰'))
            value = value;
        else
            value *= 10; // OSM numeric/plain and '%' incline are percentages.
        // Ignore clearly corrupt metadata rather than turning it into a launch ramp.
        value = Math.max(-80, Math.min(80, value));
        const travelDir = b?.travelDirection || a?.travelDirection;
        if (travelDir === 'backward')
            value *= -1;
        return value;
    }
    _serviceBrakeMs2() {
        // Prefer the physical formation's mass-weighted service brake when known.
        // Category values are only a conservative fallback for legacy catalogue rows.
        const formationBrake = Number(this._v2BrakeServiceMs2 ?? this.rame?.brakeServiceMs2);
        if (Number.isFinite(formationBrake) && formationBrake > 0)
            return Math.max(0.1, Math.min(1.6, formationBrake));
        // Service (not emergency) deceleration once the brake is fully established.
        switch (String(this.serviceType || '').toLowerCase()) {
            case 'fret': return 0.55;
            case 'ttx':
            case 'work': return 0.50;
            case 'infra': return 0.52;
            case 'tm': return 0.62;
            case 'w': return 0.78;
            case 'hlp':
            case 'm-':
            case 'evo': return 0.85;
            default: return 0.90;
        }
    }
    _brakeBuildSeconds() {
        const lengthM = Math.max(20, Number(this.rame?.totalLength || this.train?.length || 200));
        const t = String(this.serviceType || '').toLowerCase();
        if (t === 'fret' || t === 'ttx' || t === 'work' || t === 'infra' || t === 'tm') {
            // Pneumatic propagation + cylinder build-up becomes visibly slower on a
            // 500-750 m consist. Bound it to avoid pathological catalogue lengths.
            return Math.max(2.5, Math.min(7.0, 2.2 + lengthM / 170));
        }
        return Math.max(1.0, Math.min(2.5, 0.8 + lengthM / 300));
    }
    _tractionBuildSeconds() {
        const lengthM = Math.max(20, Number(this.rame?.totalLength || this.train?.length || 200));
        const t = String(this.serviceType || '').toLowerCase();
        // Converter/inverter and coupler take-up are quick on passenger stock but a
        // long freight consist should build tractive effort progressively.
        if (t === 'fret' || t === 'ttx' || t === 'work' || t === 'infra' || t === 'tm') {
            return Math.max(1.6, Math.min(4.0, 1.2 + lengthM / 260));
        }
        return Math.max(0.8, Math.min(1.8, 0.65 + lengthM / 500));
    }
    _applyPhysicalSpeedTarget(targetKmh, accelKmhS, decelKmhS, dt) {
        const target = Math.max(0, Number(targetKmh || 0));
        const step = Math.max(0, Number(dt || 0));
        if (this.speed > target + 1e-6) {
            this._tractiveEffort = Math.max(0, Number(this._tractiveEffort || 0) - step / 0.45);
            const build = this._brakeBuildSeconds();
            const before = Math.max(0, Math.min(1, Number(this._brakeEffort || 0)));
            const after = Math.min(1, before + step / Math.max(0.25, build));
            this._brakeEffort = after;
            const effort = Math.max(0.12, (before + after) * 0.5);
            this.speed = Math.max(target, this.speed - Math.max(0.01, decelKmhS) * effort * step);
        }
        else {
            this._brakeEffort = Math.max(0, Number(this._brakeEffort || 0) - step / 1.5);
            if (Number.isFinite(accelKmhS) && accelKmhS < 0) {
                // RC7: even full traction cannot balance grade/resistance here. This
                // deceleration is not a commanded brake and must not be clamped away,
                // including when the train is exactly at the permitted line speed.
                this._tractiveEffort = Math.min(1, Math.max(0, Number(this._tractiveEffort || 0)) + step / this._tractionBuildSeconds());
                this.speed = Math.max(0, this.speed + accelKmhS * step);
            }
            else if (this.speed < target - 1e-6) {
                const build = this._tractionBuildSeconds();
                const before = Math.max(0, Math.min(1, Number(this._tractiveEffort || 0)));
                const after = Math.min(1, before + step / Math.max(0.2, build));
                this._tractiveEffort = after;
                const effort = Math.max(0.08, (before + after) * 0.5);
                this.speed = Math.min(target, this.speed + Math.max(0, accelKmhS) * effort * step);
            }
            else {
                this._tractiveEffort = Math.max(0, Number(this._tractiveEffort || 0) - step / 1.2);
            }
        }
        return this.speed;
    }
    // Planned (not live) physics used only to map a position on the route to the
    // corresponding booked-time fraction. This prevents the delay display from
    // assuming that 50% of the distance means 50% of the running time. The profile
    // uses the same zero-margin physics as the timetable, with a neutral clear-
    // weather reference load; live weather/load then appear naturally as delay.
    _buildPlannedTimeProfile(route) {
        if (!Array.isArray(route) || route.length < 2)
            return null;
        try {
            const maxSpeedKmh = Math.max(1, Number(this.rame?.maxSpeed || this.train?.maxSpeed || 160));
            const segments = segmentsFromRoute(route, maxSpeedKmh, haversineDistance);
            if (!segments.length)
                return null;
            let params;
            if (this.rame) {
                const emptyT = Math.max(1, Number(this.rame.totalMass || this.rame.totalTonnage || 400));
                const ratio = this._referenceLoadRatio();
                const paxT = Math.max(0, Number(this.rame.totalCapacity || 0)) * ratio * 0.08;
                const freightT = Math.max(0, Number(this.rame.totalFreightCapacity || 0)) * ratio;
                const physicsMult = (typeof window !== 'undefined' ? (window.game?.realismSettings?.physics ?? 1) : 1);
                params = {
                    massKg: (emptyT + paxT + freightT) * 1000,
                    powerW: Math.max(0, Number(this.rame.totalPower || 0)) * 1000,
                    lengthM: Math.max(1, Number(this.rame.totalLength || 200)),
                    adhesionMassKg: this._adhesionMassKg(),
                    brakeServiceMs2: Math.max(0.08, this._serviceBrakeMs2() * physicsMult),
                    brakeBuildSec: this._brakeBuildSeconds(),
                    weather: 'clear',
                    startMs: 0,
                    endMs: 0,
                    preBrakeMarginM: 100,
                };
            }
            else {
                // Legacy/custom services without a Rame still get a monotonic physical
                // shape instead of pure distance interpolation.
                params = {
                    massKg: 400000,
                    powerW: 4000000,
                    lengthM: Math.max(20, Number(this.train?.length || 200)),
                    adhesionMassKg: 90000,
                    brakeServiceMs2: Math.max(0.2, Number(this.train?.decel || 3.24) / 3.6),
                    weather: 'clear',
                    startMs: 0,
                    endMs: 0,
                    preBrakeMarginM: 100,
                };
            }
            const sim = simulateProfile(segments, params);
            const segTimes = new Float64Array(route.length - 1);
            for (let i = 0; i < segTimes.length; i++) {
                const t = Number(sim.segmentTimeSec?.[i] || 0);
                // Zero-length/degenerate ORM pairs stay zero. A positive route segment
                // missing from the profile gets a tiny fallback so cumulation remains sane.
                segTimes[i] = t > 0 ? t : 0;
            }
            const cum = new Float64Array(route.length); // elapsed planned seconds from start
            for (let i = 0; i < segTimes.length; i++)
                cum[i + 1] = cum[i] + segTimes[i];
            if (!(cum[cum.length - 1] > 0))
                return null;
            return { segTimes, cum, totalSec: cum[cum.length - 1] };
        }
        catch (err) {
            console.warn('[v1.1.73] planned route-time profile unavailable:', err);
            return null;
        }
    }
    // PH-01/PH-03/PH-04 — one authoritative physical model for traction AND braking.
    // Weather is applied inside train-physics exactly once. Grade is taken from OSM
    // incline metadata when present.
    _computePhysicsAccel(weather, route = this._state?.cachedRoute, segIdx = this._state?.index || 0) {
        const baseAccel = this.train.accel || 3.0; // km/h/s
        const baseDecel = this.train.decel || 4.0; // km/h/s
        const grade = this._gradePermilleAt(route, segIdx);
        if (!this.rame) {
            const decelMs2 = Math.max(0.05, baseDecel / 3.6 + 9.81 * grade / 1000);
            return { accel: baseAccel, decel: decelMs2 * 3.6, accelMs2: baseAccel / 3.6, decelMs2, gradePermille: grade };
        }
        const massKg = this._currentMassKg();
        const resourceEffects = materialResourceEffects(this.rame, this._resourceSection(route, Number(segIdx)), weather?.type || 'clear');
        const powerW = resourceEffects.powerW;
        const lengthM = this.rame.totalLength || 200;
        const weatherType = weather?.type || 'clear';
        const adhesionMassKg = this._adhesionMassKg();
        const vMs = this.speed * _units.KMH_TO_MS;
        const physicsMult = (typeof window !== 'undefined' ? (window.game?.realismSettings?.physics ?? 1) : 1);
        const params = {
            massKg, powerW, lengthM, weather: weatherType, adhesionMassKg,
            brakeServiceMs2: Math.max(0.08, this._serviceBrakeMs2() * physicsMult),
        };
        const aMs2 = accelerationMs2({ ...params, adhesionMassKg: adhesionMassKg * resourceEffects.tractionFactor }, vMs, grade);
        const aKmhS = aMs2 * _units.MS_TO_KMH;
        const effectiveAccel = powerW > 0 && Number.isFinite(aKmhS) && aKmhS > 0
            ? Math.min(baseAccel, aKmhS)
            : (Number.isFinite(aKmhS) ? aKmhS : 0);
        const bMs2 = brakingDecelMs2(params, weatherType, grade);
        const bKmhS = bMs2 * _units.MS_TO_KMH;
        const effectiveDecel = Number.isFinite(bKmhS) && bKmhS > 0
            ? Math.min(baseDecel, bKmhS)
            : Math.max(0.18, baseDecel);
        this._lastPhysicsDecelMs2 = bMs2;
        return { accel: effectiveAccel, decel: effectiveDecel, accelMs2: aMs2, decelMs2: bMs2, gradePermille: grade };
    }
    _resourceSection(route = this._state?.cachedRoute, index = Number(this._state?.index || 0)) {
        if (!Array.isArray(route) || route.length < 2)
            return {};
        const i = Math.max(0, Math.min(route.length - 2, index));
        const a = route[i], b = route[i + 1];
        return { electrified: a.electrified !== false && b.electrified !== false,
            voltage: Array.isArray(a.voltage) ? a.voltage : [], frequency: Array.isArray(a.frequency) ? a.frequency : [] };
    }
    // REG-01/02/04 : calcule l'écart canton selon la couverture régulateur/AC
    // REG-04 : utilisation du découpage par axe (station/lineIds) plutôt que du seul cercle
    _updateRegulationFactor() {
        const lat = this.position?.lat;
        const lon = this.position?.lon;
        if (lat == null || lon == null || !window.game?.staffManager || window.game?.realismSettings?.personnelRequired !== true) {
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
                for (const l of lineManager.getLinesForStation(stId))
                    lineIds.add(l.id);
            }
        }
        const effects = window.game.staffManager.getRegulationEffects(lat, lon, stationIds, [...lineIds]);
        let minutes = 2;
        if (effects.regulator)
            minutes = 1; // 1 min d'écart si zone régulateur couverte
        if (effects.signalBox)
            minutes = 0.5; // 30 s d'écart si AC (signal box) couverte en plus
        cantonManager.setTrainSeparation(this.id, minutes);
    }
    // MAT-08 — détermine si la rame est 100 % électrique (pas de Diesel/Vapeur)
    _isElectricOnly() {
        const traction = this.rame?.traction || 'none';
        const parts = traction.split('+').map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (parts.length === 0 || parts.includes('none'))
            return false;
        const electric = new Set(['1.5kv', '3kv', '15kv', '25kv', '3e rail', '3e_rail', 'electrique', 'electric']);
        const self = new Set(['diesel', 'vapeur', 'steam']);
        if (parts.some((p) => self.has(p)))
            return false;
        if (parts.some((p) => electric.has(p)))
            return true;
        return false;
    }
    // MAT-08 — le segment courant est-il compatible avec la traction de la rame ?
    _electrificationMismatch(route, segIdx) {
        if (!route || !this.rame)
            return false;
        const from = route[segIdx];
        const to = route[segIdx + 1];
        if (!from || !to)
            return false;
        // Non électrifié seulement si explicitement false
        const electrified = (from.electrified !== false) && (to.electrified !== false);
        if (electrified)
            return false;
        return this._isElectricOnly();
    }
    _distanceAheadToElectrificationMismatch(route = this._state?.cachedRoute) {
        if (!this._isElectricOnly() || !Array.isArray(route) || route.length < 2)
            return Infinity;
        const cum = this._routeCumulativeKm(route);
        const frontKm = this._currentFrontKm(route);
        const start = Math.max(0, Math.min(route.length - 2, Number(this._state?.index) || 0));
        this._electrificationIndex ?? (this._electrificationIndex = new RouteElectrificationIndex());
        const next = this._electrificationIndex.next(route, start);
        return next == null ? Infinity : Math.max(0, Number(cum[next] || 0) - frontKm);
    }
    // Use the shared, bounded infrastructure-speed policy. Geometry is immutable;
    // the actual consist speed cap may change after a material operation.
    _resolvedRouteSpeeds(route) {
        if (!Array.isArray(route) || route.length === 0)
            return [];
        if (!this._resolvedSpeedCache)
            this._resolvedSpeedCache = new WeakMap();
        const cap = Math.max(1, Number(this.rame?.maxSpeed || this.train?.maxSpeed || 160));
        const cached = this._resolvedSpeedCache.get(route);
        if (cached?.cap === cap)
            return cached.speeds;
        const out = resolveRailSpeedLimits(route, cap);
        this._resolvedSpeedCache.set(route, { cap, speeds: out });
        return out;
    }
    // Annexe 3A — A. changements de vitesse : vitesse minimale sur la portion de
    // voie occupée par le train (de l’avant jusqu’à la queue, trainLength en m).
    _getInfraSpeedLimit(route, segIdx, progress, trainLengthM) {
        const segDists = this._state?.segDists;
        const resolved = this._resolvedRouteSpeeds(route);
        if (!segDists || !route?.length)
            return resolved[Math.max(0, Math.min(route.length - 1, segIdx + 1))] || resolved[segIdx] || this.train.maxSpeed;
        // RC7: compact 64-segment minima keep dense routes affordable. Normal
        // sparse routes retain the allocation-free scan. Cache dies with the leg.
        // The backward scan wins for ordinary, sparse OSM geometry. Only index
        // when a consist spans roughly 512+ vertices; route length alone is not
        // sufficient. cumDist is already built by the movement initializer.
        const meanSegmentKm = Number(this._state?.cumDist?.[0]) / segDists.length;
        const densityKm = Number.isFinite(meanSegmentKm) && meanSegmentKm >= 0
            ? meanSegmentKm : Number(segDists[Math.max(0, Math.min(segDists.length - 1, segIdx))] || 0);
        if (segDists.length >= 2048 && Number(trainLengthM) / 1000 > 512 * densityKm && resolved.length === segDists.length + 1) {
            let cached = this._tailSpeedIndex;
            if (!cached || cached.route !== route || cached.distances !== segDists || cached.speeds !== resolved) {
                cached = { route, distances: segDists, speeds: resolved, index: new TailSpeedIndex(segDists, resolved) };
                this._tailSpeedIndex = cached;
            }
            const limit = cached.index.minimum(segIdx, Number(progress), Number(trainLengthM));
            return Number.isFinite(limit) ? limit : (resolved[segIdx] || this.train.maxSpeed);
        }
        // v1.1.43 — the old implementation sampled the train every 10 m and, for
        // EVERY sample, rescanned the route from index 0. A 200 m train on a 10k-point
        // ORM leg could therefore do ~200k comparisons per movement tick.
        // The train occupies one contiguous interval: walk backwards only across the
        // handful of route segments physically under the consist.
        let i = Math.max(0, Math.min(segIdx, route.length - 2));
        let minSpeed = Math.min(resolved[i] ?? Infinity, resolved[i + 1] ?? Infinity);
        let remainingKm = Math.max(0, Number(trainLengthM) || 0) / 1000;
        const frontWithinCurrent = Math.max(0, Math.min(1, Number(progress) || 0)) * (segDists[i] || 0);
        remainingKm -= frontWithinCurrent;
        i--;
        while (remainingKm > 0 && i >= 0) {
            minSpeed = Math.min(minSpeed, resolved[i] ?? Infinity, resolved[i + 1] ?? Infinity);
            remainingKm -= segDists[i] || 0;
            i--;
        }
        if (remainingKm > 0)
            minSpeed = Math.min(minSpeed, resolved[0] ?? this.train.maxSpeed);
        return Number.isFinite(minSpeed) ? minSpeed : (resolved[segIdx] || this.train.maxSpeed);
    }
    // Annexe 3A — B. changement négatif : ralentir pour être à la nouvelle vitesse
    // 50-150 m avant le point de transition (on retient 100 m de marge).
    _getNegativeTransitionCap(route, segIdx, progress, currentSpeed) {
        const segDists = this._state?.segDists;
        const cumDist = this._state?.cumDist;
        const transitions = this._state?.negativeSpeedTransitions;
        if (!segDists || !cumDist || !transitions?.length || currentSpeed <= 0)
            return null;
        const totalDist = cumDist[0];
        const frontDist = totalDist - cumDist[segIdx] + progress * segDists[segIdx];
        const bufferKm = this._negativeBufferKm != null ? this._negativeBufferKm : 0.10;
        const weather = this._getWeatherEffects();
        const phys = this._computePhysicsAccel(weather, route, segIdx);
        const decel = Math.max(0.05, Number(phys.decelMs2 || 0));
        const buildKm = (Math.max(0, currentSpeed) / 3.6 * this._brakeBuildSeconds() * 0.5) / 1000;
        // Maximum useful look-ahead includes brake propagation/build-up as well as
        // the kinematic stopping distance.
        const vMs = Math.max(0, currentSpeed) / 3.6;
        const maxLookahead = (vMs * vMs) / (2 * decel) / 1000 + bufferKm + buildKm + 0.25;
        let lo = 0, hi = transitions.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (transitions[mid].distanceKm <= frontDist)
                lo = mid + 1;
            else
                hi = mid;
        }
        let cap = Infinity;
        for (let ti = lo; ti < transitions.length; ti++) {
            const tr = transitions[ti];
            const distToPoint = tr.distanceKm - frontDist;
            if (distToPoint > maxLookahead)
                break;
            const nextSpeed = tr.speed;
            if (nextSpeed >= currentSpeed)
                continue;
            const nextMs = Math.max(0, nextSpeed) / 3.6;
            const brakingNeeded = Math.max(0, (vMs * vMs - nextMs * nextMs) / (2 * decel) / 1000);
            if (distToPoint <= brakingNeeded + bufferKm + buildKm) {
                const reqSpeed = this._brakingCurveCapKmh(distToPoint * 1000, nextSpeed, bufferKm * 1000, phys.decelMs2);
                cap = Math.min(cap, reqSpeed);
            }
        }
        return Number.isFinite(cap) ? cap : null;
    }
    // DDS-05 : priority to a rescue movement only when it is a REAL conflict on
    // the same physical railway. Geographic proximity alone used to stop trains on
    // parallel/adjacent lines within 2 km of a rescue.
    _yieldToRescue() {
        const dm = globalThis.window?.game?.depotManager;
        if (!dm || !this.position)
            return false;
        const myRoute = this._state?.cachedRoute || this.getCurrentRoute?.();
        if (!Array.isArray(myRoute) || myRoute.length < 2)
            return false;
        const myIdx = Math.max(0, Math.min(myRoute.length - 2, Number(this._state?.index || 0)));
        const myProj = this._projectRoutePosition(this.position, myRoute, myIdx, 2);
        if (!Number.isFinite(myProj.progressKm))
            return false;
        const horizonKm = Math.max(0.5, this._safetyHorizonKm(this.speed));
        const myWays = this._wayIdsAlong(myRoute, myProj.segmentIndex, horizonKm, 0.3);
        for (const rescue of dm.activeRescues || []) {
            if (!rescue.position || !['en_route', 'recovering', 'returning'].includes(rescue.state))
                continue;
            const rescueRoute = rescue.state === 'returning' ? rescue.returnRoute : rescue.route;
            if (!Array.isArray(rescueRoute) || rescueRoute.length < 2)
                continue;
            const ri = Math.max(0, Math.min(rescueRoute.length - 2, Number(rescue.routeIndex || 0)));
            const raw = haversineDistance(this.position.lat, this.position.lon, rescue.position.lat, rescue.position.lon);
            if (raw > Math.max(2, horizonKm * 1.25))
                continue;
            // Project the rescue onto OUR route: if it is on another nearby line the
            // perpendicular miss is large and no priority stop is generated.
            const rp = this._projectRoutePosition(rescue.position, myRoute, myProj.segmentIndex, horizonKm + 1);
            if (!Number.isFinite(rp.progressKm) || rp.distanceKm > 0.05)
                continue;
            const rescueWays = this._wayIdsAlong(rescueRoute, ri, 0.3, 0.3);
            const wayKnown = myWays.size > 0 && rescueWays.size > 0;
            if (wayKnown && ![...myWays].some((id) => rescueWays.has(id)))
                continue;
            const a = myRoute[myProj.segmentIndex], b = myRoute[Math.min(myRoute.length - 1, myProj.segmentIndex + 1)];
            const ra = rescueRoute[ri], rb = rescueRoute[Math.min(rescueRoute.length - 1, ri + 1)];
            let opposite = false;
            if (a && b && ra && rb) {
                const mh = Math.atan2(b.lon - a.lon, b.lat - a.lat), rh = Math.atan2(rb.lon - ra.lon, rb.lat - ra.lat);
                let hd = Math.abs(mh - rh);
                if (hd > Math.PI)
                    hd = 2 * Math.PI - hd;
                opposite = hd > Math.PI / 2;
            }
            const longitudinalKm = rp.progressKm - myProj.progressKm;
            const conflict = opposite
                ? Math.abs(longitudinalKm) <= horizonKm
                : longitudinalKm >= -0.05 && longitudinalKm <= horizonKm;
            if (!conflict)
                continue;
            this._movementStop('RESCUE_PRIORITY', 'priorité train de secours', 'rescue');
            this.train.delayReason = this.train.delayReason || 'priorité train de secours';
            return true;
        }
        return false;
    }
    // Called every minute - handles schedule logic (departures, arrivals, state transitions)
    _isGarageRegulationActive(timeOfDay, dateStr = this._currentDate || '') {
        if (this._garageUntil == null)
            return false;
        const now = Number(timeOfDay), until = Number(this._garageUntil);
        if (!Number.isFinite(now) || !Number.isFinite(until))
            return false;
        if (!this._garageUntilDate || !dateStr)
            return now < until;
        if (dateStr < this._garageUntilDate)
            return true;
        if (dateStr > this._garageUntilDate)
            return false;
        return now < until;
    }
    _waitForConnection(stop, timeOfDay, dateStr) {
        const game = globalThis.window?.game;
        if (!stop?.stationId || stop.type !== 'arret' || stop.technicalLocationId || !this._isPassengerService())
            return false;
        if (!game?.connections?.shouldWait(this.id, stop.stationId, timeOfDay, game.scheduleCreator?.services || [], dateStr))
            return false;
        this._movementStop('CONNECTION', 'attente correspondance', 'connections');
        this.speed = 0;
        this.train.speed = 0;
        this._updateContinuousDelay(timeOfDay);
        return true;
    }
    /** Only a committed origin/return departure shuffles a marked consist. No station-stop redraws. */
    _prepareRandomDeparture(dateStr) {
        const origin = this.getCurrentStops()[0];
        const key = `${this.id}|${this._v2BaseDate || this._legacyOperatingDay || dateStr}|${this._tripCount || 0}|${this.isReturnLeg ? 'R' : 'A'}|${origin?.departureTime ?? ''}`;
        if (this._v2OccurrenceId) {
            globalThis.window?.game?.scheduleV2Runtime?.prepareRandomDeparture(this, key);
        }
        else if (this.rame) {
            randomizeRameDeparture(this.rame, key);
        }
    }
    _recordConnectionDeparture(stop, timeOfDay, dateStr) {
        const game = globalThis.window?.game;
        if (this._isPassengerService())
            game?.connections?.onDeparture(this, stop, timeOfDay, dateStr, game.scheduleCreator?.services || []);
    }
    _legacyEligibleDay(timeOfDay, dateStr) {
        const firstDep = Number(this.stops[0]?.departureTime ?? 0);
        const lastArr = Number(this.stops[this.stops.length - 1]?.arrivalTime ?? firstDep + 120);
        const finished = this.completed || this.cancelled || this.state === 'completed' || this.state === 'cancelled';
        return resolveLegacyOperatingDay({ date: dateStr, minute: timeOfDay, departure: firstDep,
            maxRuntime: Math.max(120, forwardClockMinutes(firstDep, lastArr) * 2 + 30),
            weekdays: this.runDays, dates: this.runDates, pinnedDay: finished ? '' : this._legacyOperatingDay,
            completedDay: this._legacyLastFinishedDay || (finished ? this._legacyOperatingDay || this.completedDate || '' : '') });
    }
    _legacyOriginEligible(timeOfDay) {
        if (this._v2OccurrenceId || civilDayIndex(this._currentDate) == null || this.currentStopIndex !== 0 || this.isReturnLeg || this._atTerminus)
            return true;
        if (this.state !== 'waiting' && this.state !== 'completed' && this.state !== 'cancelled')
            return true;
        return this._legacyEligibleDay(timeOfDay, this._currentDate) != null;
    }
    /** Admit/rearm dated legacy duties; V2 already owns absolute occurrences. */
    _prepareLegacyOperatingDay(timeOfDay, dateStr) {
        if (this._v2OccurrenceId || civilDayIndex(dateStr) == null)
            return true;
        const finished = this.completed || this.cancelled || this.state === 'completed' || this.state === 'cancelled';
        if (!finished && (this.currentStopIndex !== 0 || this.isReturnLeg || this._atTerminus ||
            (this.state !== 'waiting' && this.state !== 'stopped_at_station')))
            return true;
        if (finished && !this._legacyLastFinishedDay) {
            this._legacyLastFinishedDay = this._legacyOperatingDay || this.completedDate || '';
        }
        if (finished && this.serviceType === 'evo')
            return false; // automatic positioning is one-shot
        let day = this._legacyEligibleDay(timeOfDay, dateStr);
        // Rearm a future same-day duty early enough for the existing EVO path.
        if (!day && finished && timeOfDay < Number(this.stops[0]?.departureTime ?? 0)) {
            const future = this._legacyEligibleDay(Number(this.stops[0]?.departureTime ?? 0), dateStr);
            if (future === dateStr)
                day = future;
        }
        if (!day) {
            if (this.position || this._platformAssignment)
                this._releaseAllPhysicalResources();
            this.position = null;
            this.train.stoppedAt = null;
            return false;
        }
        if (finished || (this._legacyOperatingDay && day !== this._legacyOperatingDay)) {
            const completedTrack = materialTrackLocation(this.getCurrentStops().at(-1));
            globalThis.window?.game?.freightManager?.finishServiceCargo?.(this);
            this._releaseAllPhysicalResources();
            this.state = 'waiting';
            this.completed = false;
            this.cancelled = false;
            this.currentStopIndex = 0;
            this.isReturnLeg = false;
            this.returnStops = [];
            this._tripCount = 0;
            this._adjustedStops = null;
            this._adjustedReturnStops = null;
            this._nextDepartureTime = null;
            this._atTerminus = false;
            this.revenueCollected = false;
            this._evoCreated = false;
            this._evoCompleted = false;
            this._evoServiceId = null;
            this.position = null;
            this.speed = 0;
            this.delay = 0;
            this.totalDistance = 0;
            this._onboardPax = 0;
            this._onboardPassengerKm = 0;
            this._onboardFreight = 0;
            this._blockedSinceGameTime = null;
            this.train.speed = 0;
            this.train.delay = 0;
            this.train.state = 'waiting';
            this.train.stoppedAt = null;
            this.train.platform = null;
            this.train.delayReason = '';
            this.train._stoppedSinceGameTime = null;
            this.train.name = this.name;
            this.train.iteInfo = null;
            this.train.incidentDelayReasons = [];
            this._iteHardBlock = false;
            this._iteCargoMismatch = false;
            this._iteDwellExtra = 0;
            this._brakeEffort = 0;
            this._tractiveEffort = 0;
            this.targetSpeed = 0;
            this._lastArrivalTime = undefined;
            this._macroElapsed = { medium: 0, low: 0 };
            this._resetState();
            this._movementBegin();
        }
        this._legacyOperatingDay = day;
        return true;
    }
    _finishLegacyOperatingDay() {
        if (!this._v2OccurrenceId)
            this._legacyLastFinishedDay = this._legacyOperatingDay || this._currentDate || '';
    }
    /** No station-level teleport after a consist has acquired a physical track. */
    _turnbackDepartureReady(stop, timeOfDay, dateStr, returnLeg = false) {
        if (!stop || (!stop.turnBack && !returnLeg))
            return true;
        const nextTrip = this.roundTrip && (!this.isReturnLeg || (this.multiDepartures && this._tripCount < this.multiDepartures));
        if (!returnLeg && this.currentStopIndex >= this.getCurrentStops().length && nextTrip)
            return true;
        if (!this._v2BaseDate && !this._legacyOperatingDay)
            this._legacyOperatingDay = this._currentDate || dateStr;
        const index = returnLeg ? 0 : Math.max(0, this.currentStopIndex - 1);
        const key = [this._v2BaseDate || this._legacyOperatingDay || dateStr, this._tripCount || 0, this.isReturnLeg ? 1 : 0, stop.locationOccurrenceId || `${stop.stationId}:${index}`, returnLeg ? 'return' : 'TAQ'].join('|');
        const hold = (reason, code = 'TURNBACK_REQUIRED') => {
            this.train.delayReason = reason;
            this._movementStop(code, reason, 'rotation');
            return false;
        };
        // A cab cannot be changed in a moving train. Do not impose an instantaneous
        // speed=0 here: the normal movement authority performs the braking.
        if (this.speed > 0.05)
            return hold('rebroussement : attente de l’arrêt complet');
        const elements = this.rame?.elementDetails || [];
        if (this._turnbackState?.key === key && this._turnbackState.applied) {
            const controls = assessTurnback(elements, false);
            return controls.allowed || hold(controls.reason);
        }
        const operation = this._v2OperationState;
        if (operation?.locationOccurrenceId === stop.locationOccurrenceId && (!operation.completed || operation.failed))
            return hold('rebroussement : opérations de composition à terminer', 'ROTATION_OPERATION');
        const assessment = assessTurnback(elements);
        if (!assessment.allowed) {
            this._turnbackState = { key, signature: assessment.signature, startedAtSec: null, readyAtSec: null, applied: false, mode: assessment.mode };
            return hold(assessment.reason);
        }
        const day = civilDayIndex(dateStr), minute = Number(timeOfDay);
        if (day == null || !Number.isFinite(minute))
            return hold('rebroussement : heure de simulation inconnue');
        const now = day * 86400 + (((minute % 1440) + 1440) % 1440) * 60;
        if (this._turnbackState?.key !== key || this._turnbackState.signature !== assessment.signature || this._turnbackState.startedAtSec == null)
            this._turnbackState = { key, signature: assessment.signature, startedAtSec: now, readyAtSec: now + CAB_CHANGE_SECONDS, applied: false, mode: 'cab_change' };
        const state = this._turnbackState;
        if (now + 1e-6 < Number(state.readyAtSec))
            return hold(assessment.reason, 'CAB_CHANGE');
        const incoming = this._getStationaryRoute();
        const lengthKm = Number(this.rame?.totalLength || this.train.length || 0) / 1000;
        if (!this.position || !incoming || !(lengthKm > 0))
            return hold('rebroussement : empreinte ferroviaire de la rame inconnue');
        const head = this._projectRoutePosition(this.position, incoming, Math.max(0, incoming.length - 2), Infinity);
        if (head.distanceKm > 0.002 || head.progressKm + 1e-6 < lengthKm)
            return hold('rebroussement : géométrie insuffisante sous la queue de la rame');
        const tailKm = Math.max(0, head.progressKm - lengthKm);
        const tail = this._routePositionAtKm(incoming, tailKm);
        if (!tail)
            return hold('rebroussement : position de la cabine opposée inconnue');
        const outgoing = this.getCurrentRoute();
        const needsRoute = returnLeg || this.currentStopIndex < this.getCurrentStops().length;
        if (needsRoute) {
            if (!outgoing || outgoing.length < 2)
                return hold('rebroussement : tracé de départ ferroviaire requis');
            const next = this._projectRoutePosition(tail, outgoing, 0, Infinity);
            if (next.distanceKm > 0.002 || Math.abs(next.progressKm - lengthKm) > 0.003 || haversineDistance(outgoing[0].lat, outgoing[0].lon, this.position.lat, this.position.lon) > 0.002)
                return hold('rebroussement : le tracé de départ ne reprend pas la voie occupée');
            // Verify both sets of vertices: a short chord or a crossover cannot
            // silently cut through the physical consist at the change of direction.
            const inCum = this._routeCumulativeKm(incoming), outCum = this._routeCumulativeKm(outgoing);
            const matching = (d) => {
                const a = this._routePositionAtKm(incoming, head.progressKm - d), b = this._routePositionAtKm(outgoing, d);
                return !!a && !!b && haversineDistance(a.lat, a.lon, b.lat, b.lon) <= 0.002;
            };
            for (let i = 0; i < outgoing.length && outCum[i] <= lengthKm; i++)
                if (!matching(outCum[i]))
                    return hold('rebroussement : discontinuité sous la rame');
            for (let i = head.segmentIndex; i >= 0 && inCum[i] >= tailKm; i--)
                if (!matching(head.progressKm - inCum[i]))
                    return hold('rebroussement : discontinuité sous la rame');
            if (!matching(lengthKm / 2))
                return hold('rebroussement : discontinuité sous la rame');
        }
        // The material does NOT translate. The reference point changes from the old
        // front to the old rear; the occupied footprint stays exactly the same.
        const cum = this._routeCumulativeKm(incoming);
        const footprint = [{ ...this.position, wayId: incoming[Math.min(incoming.length - 1, head.segmentIndex + 1)].wayId }];
        for (let i = head.segmentIndex; i >= 0 && cum[i] > tailKm; i--)
            if (cum[i] < head.progressKm)
                footprint.push(incoming[i]);
        footprint.push(tail);
        if (this.rame) {
            this.rame.elementDetails = [...elements].reverse().map(e => ({ ...e, flipped: !e.flipped }));
            this.rame.elements = [...(this.rame.elements || [])].reverse();
            this.rame.currentLocation = { ...this.rame.currentLocation, lat: tail.lat, lon: tail.lon };
        }
        if (this._v2OccurrenceId)
            this._v2FormationReversed = !this._v2FormationReversed;
        this.position = { lat: tail.lat, lon: tail.lon };
        this._stationaryRoute = footprint;
        this._stationaryRouteIndex = Math.max(0, footprint.length - 2);
        this._resetState();
        state.applied = true;
        if (Number.isFinite(this.train.geoHeading))
            this.train.geoHeading = (Number(this.train.geoHeading) + Math.PI) % (2 * Math.PI);
        this.train.delayReason = '';
        return true;
    }
    _materialTrackDepartureReady(stop) {
        const location = this.rame?.currentLocation;
        if (!stop || !location || location.stationId !== stop.stationId)
            return true;
        if (!materialTrackMismatch(location, stop, stop.stationId, globalThis.window?.game?.voiePointManager?.voiePoints || []))
            return true;
        this.speed = 0;
        this.train.speed = 0;
        this.train.delayReason = 'changement de voie : acheminement W/HLP requis';
        this._movementStop('MATERIAL_TRACK_TRANSFER_REQUIRED', this.train.delayReason, 'rotation');
        return false;
    }
    scheduleTick(timeOfDay, dateStr, economy) {
        if (globalThis.window?.game?.depotManager?.ownsServiceMovement?.(this.id))
            return;
        if (this.state === 'waiting' || this.state === 'stopped_at_station' || this.state === 'preparation' || this.state === 'garage')
            this._movementBegin();
        if (!this.active || this.stops.length < 2)
            return;
        if (!this._prepareLegacyOperatingDay(timeOfDay, dateStr))
            return;
        const scheduleNow = this._v2ScheduleNowMinutes(dateStr, timeOfDay);
        cantonManager.setTime(timeOfDay);
        this._currentDate = dateStr;
        this._currentTimeOfDay = timeOfDay;
        this._economy = economy;
        // Keep service availability synchronized with the physical rame. Depot
        // admission is controlled by the player and is NOT a maintenance flag.
        if (this.rame) {
            this.train.inMaintenance = !!this.rame.inMaintenance;
            this.train.inDepot = !!this.rame.currentLocation?.depotId;
        }
        if (this.train.inDepot) {
            this.speed = 0;
            this.train.speed = 0;
            this.train.state = this.rame?.depotOperationId ? 'opération dépôt' : 'au dépôt';
            this.position = null;
            this.train.stoppedAt = null;
            this._movementStop('DEPOT', this.rame?.depotOperationId ? 'opération en dépôt' : 'rame garée au dépôt', 'depot');
            return;
        }
        // HOTFIX35 — rolling-stock operations have a real timeline. Advance them on
        // every schedule tick so detach/attach/UM/loco changes take effect at the end
        // of their actual 5/10/15-minute operation, not instantly on arrival.
        if (this._v2OccurrenceId && typeof this._v2OnOperationTick === 'function') {
            try {
                this._v2OnOperationTick(dateStr, timeOfDay);
            }
            catch (e) {
                console.warn('V2 rotation operation tick:', e);
            }
        }
        if (this.train.breakdown) {
            const BENIGN_TYPES = ['climatisation', 'portes'];
            // MNT-03 : pannes bénignes ne nécessitent pas de technicentre (train continue, limité en vitesse, réparé en gare)
            if (!BENIGN_TYPES.includes(this.train.breakdown.type)) {
                // A breakdown while moving commands a physical stop in moveUpdate/macro;
                // only an already-stationary service is allowed to be exactly 0 here.
                if (this.state !== 'moving' && this.state !== 'departing') {
                    this.speed = 0;
                    this.train.speed = 0;
                }
                this.train.state = 'en panne';
                this._movementStop('BREAKDOWN', 'Panne — arrêt du train', 'maintenance');
                // Section VI/DDS — demander un secours depuis le dépôt le plus proche
                if (!this._rescueDispatched && this.position && window.game?.depotManager) {
                    this._rescueDispatched = !!window.game.depotManager.dispatchRescue(this.world, this);
                }
                return;
            }
            this.train.state = 'anomalie legere';
        }
        if (this.train.inMaintenance) {
            this.speed = 0;
            this.train.speed = 0;
            this.train.state = 'en maintenance';
            this._movementStop('MAINTENANCE', 'train en maintenance', 'maintenance');
            return;
        }
        // Calendar eligibility uses the operating date above, not the wall date.
        if (!this._v2OccurrenceId && this.state === 'waiting' && this.currentStopIndex === 0) {
            if (window.game?.seasonal && !window.game.seasonal.isServiceActive(this.id)) {
                this.position = null;
                this.train.stoppedAt = null;
                this.train.delayReason = 'service saisonnier inactif';
                return;
            }
            else if (this.train.delayReason === 'service saisonnier inactif')
                this.train.delayReason = '';
        }
        if (this.completed) {
            this.position = null;
            this.train.stoppedAt = null;
            return;
        }
        // FAST EARLY REJECT for waiting trains far from departure
        // This avoids expensive Date parsing and service window checks for 99% of services
        if (this.state === 'waiting' && this.currentStopIndex === 0 && !this.train.breakdown && !this.train.inMaintenance && !this.train.inDepot) {
            const dep0 = this._cachedFirstDep;
            if (dep0 !== undefined) {
                // Quick check: if departure is more than 2 min in the future, skip.
                // timeDiff(dep0, timeOfDay) > 0 means dep0 is ahead of timeOfDay.
                const diff = this._scheduleDiff(dep0, scheduleNow);
                if (diff > 2) {
                    if (!this._v2OccurrenceId) {
                        this.position = null;
                        this.train.stoppedAt = null;
                    }
                    return;
                }
            }
        }
        // HOTFIX64 — Personnel is an opt-in advanced layer. In simplified mode
        // drivers and 3×8 remain invisible automation and can never block a departure.
        if (window.game?.realismSettings?.personnelRequired === true && window.game?.staffManager && !window.game.staffManager.hasAssignedConductor(this.id, true)) {
            this.train.delayReason = window.game.staffManager.getMissingConductorReason?.(this, dateStr, window.game) || 'personnel : conducteur indisponible';
            this._movementStop('NO_DRIVER', this.train.delayReason, 'staff');
            return;
        }
        else if (String(this.train.delayReason || '').startsWith('personnel : conducteur')) {
            this.train.delayReason = '';
        }
        // RH-05 : grève — bloque le départ des services concernés
        if (window.game?.realismSettings?.personnelRequired === true && window.game?.unions?.isServiceBlocked(this.id)) {
            this.train.delayReason = 'grève';
            this._movementStop('STRIKE', 'grève', 'operations');
            return;
        }
        else if (this.train.delayReason === 'grève') {
            this.train.delayReason = '';
        }
        if (this.state === 'waiting' || this.state === 'stopped_at_station') {
            const route = this.getCurrentRoute();
            const resources = materialResourceEffects(this.rame, this._resourceSection(route, 0));
            if (resources.stopReason) {
                this._movementStop('CONSUMABLE_STOP', resources.stopReason, 'depot');
                this.train.delayReason = resources.stopReason;
                this._updateContinuousDelay(timeOfDay);
                return;
            }
        }
        const currentStops = this.getCurrentStops();
        const firstDep = currentStops[0]?.departureTime ?? 0;
        this._cachedFirstDep = firstDep;
        if (this.state === 'waiting') {
            // INC-03 : incident en gare (bagage abandonné, etc.) bloque le départ immédiat
            if (this.train.incident?.effect === 'stop') {
                this.delay = Math.max(0, this._scheduleDiff(scheduleNow, firstDep));
                this.train.delay = this.delay;
                this.train.delayReason = this.train.incident.name || 'Incident';
                this._movementStop('STATION_INCIDENT', this.train.delayReason, 'incident');
                return;
            }
            // Compute service window
            const lastStop = currentStops[currentStops.length - 1];
            const endTime = lastStop?.arrivalTime ?? firstDep + 120;
            const plannedDuration = this._v2OccurrenceId ? Math.max(0, endTime - firstDep) : forwardClockMinutes(firstDep, endTime);
            const maxRuntime = Math.max(120, plannedDuration * 2 + 30);
            const windowEnd = firstDep + maxRuntime;
            // CVO-04 : attendre l'arrivée de l'EVO avant le premier départ
            if (this.serviceType !== 'evo' && this._evoServiceId && !this._evoCompleted) {
                const evo = window.game?.scheduleCreator?.services.find((s) => s.id === this._evoServiceId);
                if (evo && !evo.completed && evo.state !== 'completed') {
                    this.delay = Math.max(0, this._scheduleDiff(scheduleNow, firstDep));
                    this.train.delay = this.delay;
                    this.train.state = 'waiting_evo';
                    this._movementStop('WAITING_EVO', 'attente mise en place EVO', 'rotation');
                    return;
                }
                else {
                    this._evoCompleted = true;
                    this._evoServiceId = null;
                }
            }
            // Don't show train if not in service window. If the window has been missed,
            // cancel the service instead of keeping it waiting forever.
            if (this.currentStopIndex === 0 && !this._scheduleInWindow(scheduleNow, firstDep - 1, windowEnd)) {
                if (this._scheduleDiff(scheduleNow, windowEnd) > 0) {
                    this.completed = true;
                    this.cancelled = true;
                    this.state = 'cancelled';
                    this.completedDate = dateStr;
                    this._finishLegacyOperatingDay();
                    this._releaseAllPhysicalResources();
                    this.position = null;
                    this.train.stoppedAt = null;
                    return;
                }
                this.position = null;
                this.train.stoppedAt = null;
                return;
            }
            // RC11: a known parked track is physical truth, not a free choice at next departure.
            if (this.currentStopIndex === 0 && !this._materialTrackDepartureReady(currentStops[0]))
                return;
            if (this.currentStopIndex === 0 && !this._turnbackDepartureReady(currentStops[0], timeOfDay, dateStr))
                return;
            if (this.currentStopIndex === 0 && this._scheduleInWindow(scheduleNow, firstDep - 1, firstDep) && !this._scheduleGte(scheduleNow, firstDep)) {
                // HOTFIX16: before the booked first departure there is no operational delay.
                // Never leak a stale snapshot value onto LiveMap.
                this.delay = 0;
                this.train.delay = 0;
                const s0 = currentStops[0];
                const firstStation = this.world?.getStationById(s0?.stationId);
                // V2 owns an exact track coordinate. Native OSM stations may still be
                // streaming into world.stations, so their absence must not make the train
                // invisible during the pre-departure minute.
                if (firstStation || (this._v2OccurrenceId && s0?.lat != null && s0?.lon != null)) {
                    let posLat = this._v2OccurrenceId && s0?.lat != null ? s0.lat : firstStation.lat;
                    let posLon = this._v2OccurrenceId && s0?.lon != null ? s0.lon : firstStation.lon;
                    if (!this._v2OccurrenceId && firstStation && window.game?.voiePointManager) {
                        if (s0?.voiePointId) {
                            const vp = window.game.voiePointManager.getVoiePointById(s0.voiePointId);
                            if (vp) {
                                posLat = vp.lat;
                                posLon = vp.lon;
                            }
                        }
                        else if (s0?.platform) {
                            const svp = window.game.voiePointManager.getStationVoiePoint(firstStation.id, s0.platform);
                            if (svp) {
                                posLat = svp.lat;
                                posLon = svp.lon;
                            }
                        }
                    }
                    this.position = { lat: posLat, lon: posLon };
                    const originStation = firstStation || { id: s0?.stationId || '', name: s0?.locationName || '', lat: posLat, lon: posLon, platforms: 2 };
                    this.train.stoppedAt = originStation;
                    const originReserved = this._reserveArrivalResources(originStation, s0);
                    if (originReserved) {
                        if (this.train.delayReason === 'attente voie libre au départ')
                            this.train.delayReason = '';
                        this._movementGo();
                    }
                    else {
                        this.train.delayReason = 'attente voie libre au départ';
                        this._movementStop('ORIGIN_RESOURCE', this.train.delayReason, 'station');
                    }
                    this.train.platform = s0?.platform || this.train.platform || '';
                    this.train.speed = 0;
                    this.speed = 0;
                }
                return;
            }
            if (this.currentStopIndex === 0 && this._scheduleGte(scheduleNow, firstDep)) {
                if (!this._v2OccurrenceId && this.rame?.currentLocation?.stationId &&
                    String(this.rame.currentLocation.stationId) !== String(currentStops[0]?.stationId || '') &&
                    !this._evoServiceId) {
                    this.position = null;
                    this.train.stoppedAt = null;
                    this.delay = Math.max(0, this._scheduleDiff(scheduleNow, firstDep));
                    this.train.delay = this.delay;
                    this.train.delayReason = 'rame absente de la gare de départ';
                    this._movementStop('MATERIAL_POSITION', this.train.delayReason, 'rotation');
                    return;
                }
                // V2 origin operations consume their real preparation duration. A game
                // opened late cannot compress a 10-minute loco/attach operation to zero.
                if (this._v2OccurrenceId && this._v2OperationState && (!this._v2OperationState.completed || this._v2OperationState.failed)) {
                    this.train.state = 'preparation';
                    this.train.delayReason = this._v2OperationWaitingMaterial ? 'opérations de roulement : attente matériel' : 'opérations de roulement';
                    this._movementStop(this._v2OperationState.failed ? 'ROTATION_OPERATION_FAILED' : 'PREPARATION', this.train.delayReason, 'rotation');
                    return;
                }
                if (this._v2OccurrenceId && Number.isFinite(Number(this._v2PrepReadyMinute)) && !this._scheduleGte(scheduleNow, Number(this._v2PrepReadyMinute))) {
                    this.train.state = 'preparation';
                    this.train.delayReason = 'opérations de roulement';
                    this._movementStop('PREPARATION', this.train.delayReason, 'rotation');
                    return;
                }
                // Mise à jour du retard avant les décisions de régulation/priorité
                this.delay = this._scheduleDiff(scheduleNow, firstDep);
                this.train.delay = this.delay;
                // Cancel only if the whole service window is missed (end + 31 min grace).
                // Within the window the train departs late so delay is reported, not cancelled.
                if (!this._scheduleInWindow(scheduleNow, firstDep, windowEnd)) {
                    this.completed = true;
                    this.cancelled = true;
                    this.state = 'cancelled';
                    this.completedDate = dateStr;
                    this._finishLegacyOperatingDay();
                    this._releaseAllPhysicalResources();
                    this.position = null;
                    this.train.stoppedAt = null;
                    return;
                }
                if (this._scheduleInWindow(scheduleNow, firstDep, windowEnd)) {
                    // Section VI — une rame ne peut pas effectuer 2 trajets en même temps
                    if (this.rameId && window.game?.scheduleCreator?.isRameInUse?.(this.rameId, this.id, timeOfDay)) {
                        // Rame already used by another active service; stay waiting and retry next tick.
                        this.train.delayReason = 'rame déjà engagée sur une autre circulation';
                        this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                        return;
                    }
                    else if (this.train.delayReason === 'rame déjà engagée sur une autre circulation') {
                        this.train.delayReason = '';
                        this._movementGo();
                    }
                    // REG-03 : décision régulation — train en garage temporaire
                    if (this._isGarageRegulationActive(timeOfDay, dateStr)) {
                        this.train.state = 'garage';
                        this.train.delayReason = 'regulation : garage temporaire';
                        this._movementStop('GARAGE_REGULATION', this.train.delayReason, 'regulation');
                        return;
                    }
                    // OCC-03 : priorité au départ au voyageur dont le départ est le plus tôt
                    const depStationId = currentStops[0]?.stationId;
                    const myDep = currentStops[0]?.departureTime;
                    if (!this._v2OccurrenceId && depStationId && myDep != null && this.serviceType === 'passager' && window.game?.scheduleCreator) {
                        const earliest = window.game.scheduleCreator.getEarliestDueServiceAtStation(depStationId, timeOfDay);
                        if (earliest && earliest.id !== this.id && timeDiff(myDep, earliest.dep) > 0) {
                            const earliestSvc = window.game.scheduleCreator.services.find((s) => s.id === earliest.id);
                            const earliestBlockedByRame = earliestSvc && window.game.scheduleCreator.isRameInUse(earliestSvc.rameId, earliestSvc.id, timeOfDay);
                            if (!earliestBlockedByRame) {
                                this.train.delayReason = 'priorité à un départ voyageur antérieur';
                                this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                                return;
                            }
                        }
                    }
                    if (this.train.delayReason === 'priorité à un départ voyageur antérieur') {
                        this.train.delayReason = '';
                        this._movementGo();
                    }
                    // Ensure position is set (may not have been set by pre-departure positioning)
                    if (!this.position) {
                        const s0 = currentStops[0];
                        const depStation = this.world?.getStationById(s0?.stationId);
                        if (depStation || (this._v2OccurrenceId && s0?.lat != null && s0?.lon != null)) {
                            let posLat = this._v2OccurrenceId && s0?.lat != null ? s0.lat : depStation.lat;
                            let posLon = this._v2OccurrenceId && s0?.lon != null ? s0.lon : depStation.lon;
                            if (!this._v2OccurrenceId && window.game?.voiePointManager) {
                                const s0 = currentStops[0];
                                if (s0?.voiePointId) {
                                    const vp = window.game.voiePointManager.getVoiePointById(s0.voiePointId);
                                    if (vp) {
                                        posLat = vp.lat;
                                        posLon = vp.lon;
                                    }
                                }
                                else if (s0?.platform) {
                                    const svp = window.game.voiePointManager.getStationVoiePoint(depStation.id, s0.platform);
                                    if (svp) {
                                        posLat = svp.lat;
                                        posLon = svp.lon;
                                    }
                                }
                            }
                            this.position = { lat: posLat, lon: posLon };
                        }
                    }
                    // Origin is a physical resource too. A train that becomes due without
                    // having passed through the one-minute pre-display window must reserve it now.
                    {
                        const s0 = currentStops[0];
                        const depStation = this.world?.getStationById(s0?.stationId) || (this.position ? { id: s0?.stationId || '', name: s0?.locationName || '', lat: this.position.lat, lon: this.position.lon, platforms: 2 } : null);
                        if (depStation && !this._reserveArrivalResources(depStation, s0)) {
                            this.train.delayReason = 'attente voie libre au départ';
                            this._movementStop('ORIGIN_RESOURCE', this.train.delayReason, 'station');
                            return;
                        }
                        if (this.train.delayReason === 'attente voie libre au départ')
                            this.train.delayReason = '';
                    }
                    // V2 preflight: a train must never enter `moving` with an empty leg.
                    // Runtime normally rejects such schedules earlier; this guard keeps the
                    // ActiveService boundary fail-closed even after live edits/corruption.
                    if (this._v2OccurrenceId) {
                        const preflightRoute = this.getCurrentRoute();
                        if (!Array.isArray(preflightRoute) || preflightRoute.length < 2 || preflightRoute.some((p) => p?.fallback)) {
                            this.state = 'blocked_route';
                            this.train.state = 'blocked_route';
                            this.speed = 0;
                            this.train.speed = 0;
                            this.train.stoppedAt = this.train.stoppedAt || { id: currentStops[0]?.stationId || '', name: currentStops[0]?.locationName || '', lat: this.position?.lat ?? currentStops[0]?.lat, lon: this.position?.lon ?? currentStops[0]?.lon };
                            window.game?.scheduleV2Runtime?._pushAlert?.('ERROR', 'BLOCKED_ROUTE', `Train ${this.number || this.name || ''} bloqué avant départ : liaison ORM absente.`, { rotationId: this._v2RotationId, occurrenceId: this._v2OccurrenceId, baseDate: this._v2BaseDate, suggestion: 'Réparer/revalider le tracé dans Horaire.' });
                            return;
                        }
                    }
                    if (this._waitForConnection(currentStops[0], timeOfDay, dateStr))
                        return;
                    this._prepareRandomDeparture(dateStr);
                    this._recordConnectionDeparture(currentStops[0], timeOfDay, dateStr);
                    // Board passengers at departure station before moving
                    if (economy) {
                        const firstStation = this.world?.getStationById(currentStops[0]?.stationId);
                        if (firstStation) {
                            try {
                                economy.processStopRevenue(this, firstStation.name, 0, true, false, firstStation.id, []);
                            }
                            catch (e) {
                                console.warn('Economy origin-stop side effect ignored:', e);
                            }
                        }
                    }
                    this._adjustedStops = this._buildAdjustedStops();
                    this._adjustedReturnStops = null;
                    this.state = 'moving';
                    this.train.state = 'moving';
                    this.currentStopIndex = 1;
                    this.speed = 0;
                    this.train.speed = 0;
                    this.revenueCollected = false;
                    this.delay = this._scheduleDiff(scheduleNow, firstDep);
                    this.train.delay = this.delay;
                    this._movementGo();
                    this.train.stoppedAt = null;
                    this._beginDepartureResourceHold(currentStops[0]?.stationId);
                    this._captureCantonCarryover();
                    // DEP-05 : mise à jour de la localisation permanente de la rame
                    if (this.rame) {
                        this.rame.currentLocation = {
                            ...materialTrackLocation(currentStops[0]),
                            stationId: currentStops[0]?.stationId || '',
                            depotId: '', // RC2: home depot is affiliation, not physical presence.
                            serviceId: this.id,
                            lat: this.position?.lat ?? null,
                            lon: this.position?.lon ?? null,
                        };
                    }
                    // Keep origin platform/voie + old block footprint until the physical tail
                    // has cleared. Reset only the route-local simulation state.
                    this._resetState();
                    // Pre-initialize route state so the first move tick doesn't pay the cost.
                    {
                        const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
                        const route = this.getCurrentRoute();
                        if (route && route.length >= 2)
                            this._initializeState(route, legKey);
                    }
                }
            }
            return;
        }
        if (this.state === 'stopped_at_station') {
            // Multi-trip waiting: use _nextDepartureTime if set
            if (this._nextDepartureTime != null && this.currentStopIndex === 0) {
                const scheduleNowForTerminus = this._v2ScheduleNowMinutes(this._currentDate, timeOfDay);
                if (this._scheduleGte(scheduleNowForTerminus, this._nextDepartureTime)) {
                    // Board passengers at departure station for return/multi-trip
                    const curStops = this.getCurrentStops();
                    if (!this._materialTrackDepartureReady(curStops[0]))
                        return;
                    if (!this._turnbackDepartureReady(curStops[0], timeOfDay, dateStr, true))
                        return;
                    if (this._waitForConnection(curStops[0], timeOfDay, dateStr))
                        return;
                    this._prepareRandomDeparture(dateStr);
                    this._recordConnectionDeparture(curStops[0], timeOfDay, dateStr);
                    if (economy && curStops[0]) {
                        const depStation = this.world?.getStationById(curStops[0].stationId);
                        if (depStation) {
                            try {
                                economy.processStopRevenue(this, depStation.name, 0, true, false, depStation.id, []);
                            }
                            catch (e) {
                                console.warn('Economy terminus-departure side effect ignored:', e);
                            }
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
                        if (depSt)
                            this.position = { lat: depSt.lat, lon: depSt.lon };
                    }
                    if (this.isReturnLeg)
                        this._adjustedReturnStops = this._buildAdjustedStops(this.returnStops);
                    else
                        this._adjustedStops = this._buildAdjustedStops();
                    this.state = 'moving';
                    this.train.state = 'moving';
                    this.currentStopIndex = 1;
                    this.speed = 0;
                    this.train.speed = 0;
                    this.revenueCollected = false;
                    this._movementGo();
                    this.train.stoppedAt = null;
                    this._beginDepartureResourceHold(curStops?.[0]?.stationId || this._platformAssignment?.stationId);
                    this._captureCantonCarryover();
                    // Do not free the platform/voie/cantons under the rear of the train.
                    this._resetState();
                    // Pre-initialize route state so the first move tick doesn't pay the cost.
                    {
                        const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
                        const route = this.getCurrentRoute();
                        if (route && route.length >= 2)
                            this._initializeState(route, legKey);
                    }
                }
                return;
            }
            const stops = this.getCurrentStops();
            // v1.1.97 — stopped cursor self-heal. A healthy stopped service points to
            // the NEXT stop, while train.stoppedAt/_platformAssignment identify the
            // station physically occupied now. v1.1.96 could restore a terminal with
            // currentStopIndex still pointing AT that same terminal, which made the UI
            // announce it as the next stop and prevented terminal release/next rotation.
            if (this.currentStopIndex < stops.length) {
                const physicalStationId = String(this.train?.stoppedAt?.id || this._platformAssignment?.stationId || '');
                const pointedStationId = String(stops[this.currentStopIndex]?.stationId || '');
                const previousStationId = this.currentStopIndex > 0 ? String(stops[this.currentStopIndex - 1]?.stationId || '') : '';
                if (physicalStationId && pointedStationId === physicalStationId && previousStationId !== physicalStationId) {
                    this.currentStopIndex++;
                }
            }
            const stop = stops[this.currentStopIndex - 1];
            if (!stop) {
                this.state = 'moving';
                return;
            }
            if (!this._materialTrackDepartureReady(stop))
                return;
            // INC-03 : incident en gare (bagage abandonné, etc.) bloque le départ
            if (this.train.incident?.effect === 'stop' && this.train.stoppedAt) {
                this._movementStop('STATION_INCIDENT', this.train.incident.name || 'Incident', 'incident');
                this._updateContinuousDelay(timeOfDay);
                return;
            }
            // REG-03 : décision régulation — respecter le garage temporaire aussi en arrêt en gare
            if (this._isGarageRegulationActive(timeOfDay, dateStr)) {
                this.train.delayReason = 'regulation : garage temporaire';
                this._movementStop('GARAGE_REGULATION', this.train.delayReason, 'regulation');
                this._updateContinuousDelay(timeOfDay);
                return;
            }
            // Section VI — ITE : bloque le départ si le train est trop long pour l'ITE
            if (this._iteHardBlock && stop?.type === 'arret' && stop?.stationId && window.game?.depotManager && window.game?.world) {
                const station = window.game.world.getStationById(stop.stationId);
                if (station) {
                    const trainLength = this.rame ? this.rame.totalLength : (this.train.length || 20);
                    const rameCargo = this.rame?.elementDetails?.find((e) => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0)?.cargoTypes?.[0] || '';
                    const iteInfo = window.game.depotManager.getITEInfo(station.id, trainLength, rameCargo);
                    if (iteInfo?.isITE && (iteInfo.usable === false || Number(iteInfo.totalLength) <= 0)) {
                        this.train.iteInfo = { ...this.train.iteInfo, canFit: false };
                        this.train.delayReason = 'ITE : aucune voie utile';
                        this._movementStop('ITE_BLOCK', this.train.delayReason, 'ite');
                        this._updateContinuousDelay(timeOfDay);
                        return;
                    }
                }
                this._iteHardBlock = false;
            }
            // HOTFIX35 — never release the train while a physical consist operation at
            // this exact stop is still running (or waiting for its incoming material).
            if (this._v2OccurrenceId && this._v2OperationState?.locationOccurrenceId === stop?.locationOccurrenceId && (!this._v2OperationState.completed || this._v2OperationState.failed)) {
                this.train.delayReason = this._v2OperationWaitingMaterial ? 'opérations de roulement : attente matériel' : 'opérations de roulement';
                this._movementStop(this._v2OperationState.failed ? 'ROTATION_OPERATION_FAILED' : 'ROTATION_OPERATION', this.train.delayReason, 'rotation');
                this._updateContinuousDelay(timeOfDay);
                return;
            }
            if (this._v2OccurrenceId && this.currentStopIndex >= stops.length &&
                this._v2OperationState?.locationOccurrenceId === stop.locationOccurrenceId &&
                this._v2OperationState.completed && !this._v2OperationState.failed) {
                this.completeService(economy, null, this.position?.lat ?? null, this.position?.lon ?? null);
                return;
            }
            if (!this._turnbackDepartureReady(stop, timeOfDay, dateStr))
                return;
            const depTime = stop.departureTime;
            // Mise à jour du retard pendant l'arrêt (retard à l'arrivée qui s'aggrave si le départ est dépassé)
            if (depTime != null && this._scheduleGte(scheduleNow, depTime)) {
                const depDelay = this._scheduleDiff(scheduleNow, depTime);
                if (depDelay > (this.delay ?? 0)) {
                    this.delay = depDelay;
                    this.train.delay = this.delay;
                }
            }
            const iteExtra = this._iteDwellExtra || 0;
            let effectiveDep = depTime != null ? depTime + iteExtra : null;
            // V2 rotation operations are a hard minimum dwell. They cannot be erased
            // by the freight early-departure recovery rule below.
            if (this._v2OccurrenceId && Number(stop?.v2OperationSec || 0) > 0 && this.train._stoppedSinceGameTime != null) {
                const opReady = this.train._stoppedSinceGameTime + Number(stop.v2OperationSec || 0) / 60;
                effectiveDep = effectiveDep == null ? opReady : Math.max(effectiveDep, opReady);
            }
            // V2 non-passenger rule: an early freight/W/HLP/TM/Infra service only
            // marks its planned dwell; when late it may shorten that dwell to recover.
            // Passenger services remain pinned to the published departure time.
            if (this._v2AllowEarlyDeparture && stop.type === 'arret' && this.train._stoppedSinceGameTime != null) {
                const plannedDwell = Math.max(0, (stop.departureTime ?? stop.arrivalTime ?? 0) - (stop.arrivalTime ?? stop.departureTime ?? 0));
                const arrivalDelay = (this.train._stoppedSinceGameTime ?? scheduleNow) - (stop.arrivalTime ?? scheduleNow);
                const recoveredDwell = Math.max(0, plannedDwell - Math.max(0, arrivalDelay));
                const operationalDeparture = this.train._stoppedSinceGameTime + recoveredDwell + iteExtra;
                const operationFloor = (this._v2OccurrenceId && Number(stop?.v2OperationSec || 0) > 0) ? this.train._stoppedSinceGameTime + Number(stop.v2OperationSec || 0) / 60 : null;
                effectiveDep = effectiveDep == null ? operationalDeparture : Math.min(effectiveDep, operationalDeparture);
                if (operationFloor != null)
                    effectiveDep = Math.max(effectiveDep, operationFloor);
            }
            // OCC-06 : plafond d'attente max 2h en gare (sauf terminus) → départ forcé
            const stopDuration = this.train._stoppedSinceGameTime != null ? this._scheduleDiff(scheduleNow, this.train._stoppedSinceGameTime) : 0;
            const isLastStop = this.currentStopIndex >= stops.length;
            const forceDepart = !isLastStop && stopDuration >= 120;
            // Guard against undefined/NaN departureTime — depart immediately
            if (stop.type === 'passage' || stop.type === 'waypoint' || effectiveDep == null || isNaN(effectiveDep) || forceDepart || this._scheduleGte(scheduleNow, effectiveDep)) {
                if (this.currentStopIndex < stops.length) {
                    if (this._waitForConnection(stop, timeOfDay, dateStr))
                        return;
                    this._recordConnectionDeparture(stop, timeOfDay, dateStr);
                }
                // Departure resources stay locked until the physical rear has cleared the
                // platform/throat. This also prevents a second train being routed onto a
                // consist whose head has only just started moving.
                this._beginDepartureResourceHold(stop?.stationId || this._platformAssignment?.stationId);
                this._captureCantonCarryover();
                this.train._stoppedSinceGameTime = null;
                this._movementGo();
                this.train.stoppedAt = null;
                this._iteDwellExtra = 0;
                this._iteHardBlock = false;
                this.train.iteInfo = null;
                if (this.currentStopIndex >= stops.length) {
                    this.completeService(economy);
                }
                else {
                    // Old blocks are retained as a carry-over footprint until tail clear.
                    this.state = 'moving';
                    this.train.state = 'moving';
                    this.speed = 0;
                    this.train.speed = 0;
                    this._resetState();
                }
            }
        }
    }
    /**
     * Centralized wear/km tracking. Called from moveUpdate and _moveDirectToTarget.
     */
    _trackWear(distKm, timeOfDay) {
        if (!isFinite(distKm) || distKm <= 0)
            return;
        advanceMaterialMileage(this.rame, this.train, distKm);
        if (this.rame) {
            if (!this.rame.cleanliness)
                this.rame.cleanliness = { exterior: 100, interior: 100 };
            consumeMaterialResources(this.rame, distKm, this._resourceSection?.() ?? {});
        }
        // TRV-01 : usure des voies par le trafic (tonnage + distance)
        const vpm = globalThis.window?.game?.voiePointManager;
        if (vpm && this.position) {
            const trc = this._cachedTroncon || vpm.getTronconAtPosition(this.position, 0.3, this.state === 'stopped_at_station' ? this._stationaryPhysicalTrackRef() : null);
            if (trc) {
                const mass = this.rame?.getTotalMassWithPayload ? this.rame.getTotalMassWithPayload() : 400;
                trc.wear = Math.min(100, (trc.wear || 0) + distKm * (mass / 400) * 0.005);
            }
        }
        // Contract progress is delivered quantity / initial quantity. Travelling,
        // loading and train wear must not overwrite this business invariant.
        if (!this.train.breakdown) {
            const wearMultiplier = 1 + (this.train.wearLevel || 0) / 25;
            const breakdownMult = (typeof window !== 'undefined' ? (window.game?.realismSettings?.breakdown ?? 1) : 1);
            const failureProb = (distKm / 25000) * wearMultiplier * breakdownMult;
            const rng = getGlobalRng();
            if (rng.random() < failureProb) {
                const types = ['moteur', 'freins', 'climatisation', 'portes', 'fanaux'];
                const type = types[Math.floor(rng.random() * types.length)];
                this.train.breakdown = { type: type, time: timeOfDay };
                if (this.rame) {
                    if (!Array.isArray(this.rame.pendingDefects))
                        this.rame.pendingDefects = [];
                    if (!this.rame.pendingDefects.includes(type))
                        this.rame.pendingDefects.push(type);
                }
                this._rescueDispatched = false;
            }
        }
    }
    /**
     * Reset simulation state when starting a new movement leg.
     */
    resumeAfterRepair() {
        this.train.breakdown = null;
        this._rescueDispatched = false;
        this.train.inMaintenance = !!this.rame?.inMaintenance;
        if (this.completed || this.cancelled)
            return;
        this.speed = 0;
        this.train.speed = 0;
        this._brakeEffort = 0;
        this._tractiveEffort = 0;
        if (this.position && this._state?.cachedRoute?.length && this.currentStopIndex > 0 &&
            this.state !== 'blocked_route' && this.state !== 'stopped_at_station' && !this._atTerminus) {
            this.state = 'moving';
        }
        else if (this.state !== 'blocked_route' && this.state !== 'stopped_at_station') {
            this.state = 'waiting';
        }
        this.train.state = this.state;
        this.train.delayReason = '';
    }
    _resetState() {
        this._routeKey = null; // a completed leg must not suppress initialization of the next one
        this._tailSpeedIndex = null;
        this._electrificationIndex?.reset();
        this._state.index = 0;
        this._state.progress = 0;
        this._state.legKey = null;
        this._state.cachedRoute = null;
        this._state.worksLimitCache = null;
        this._state.plannedSegTimeSec = null;
        this._state.plannedCumTimeSec = null;
        this._state.plannedTotalTimeSec = 0;
        this._routeAnalysis = null;
        this._cantonAssignments = null;
        this._cachedTroncon = null;
        this._cachedTronconTime = null;
        this._trackKey = null;
        this._iteHardBlock = false;
    }
    /**
     * Initialize simulation state for the current route leg.
     * Computes route analysis and creates canton assignments.
     */
    _initializeState(route, legKey) {
        this._tailSpeedIndex = null;
        this._electrificationIndex?.reset();
        this._state.legKey = legKey;
        this._state.cachedRoute = route;
        this._state.worksLimitCache = null;
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
        const plannedProfile = this._buildPlannedTimeProfile(route);
        this._state.plannedSegTimeSec = plannedProfile?.segTimes || null;
        this._state.plannedCumTimeSec = plannedProfile?.cum || null;
        this._state.plannedTotalTimeSec = Number(plannedProfile?.totalSec || 0);
        // Pre-index actual downward speed transitions once per leg. Movement ticks
        // binary-search this tiny list instead of scanning the whole remaining route.
        const negativeSpeedTransitions = [];
        const totalRouteKm = cumDist[0] || 0;
        const resolvedSpeeds = this._resolvedRouteSpeeds(route);
        for (let i = 1; i < route.length; i++) {
            const prev = Number(resolvedSpeeds[i - 1] || this.train.maxSpeed), next = Number(resolvedSpeeds[i] || this.train.maxSpeed);
            if (next < prev)
                negativeSpeedTransitions.push({ index: i, speed: next, distanceKm: totalRouteKm - cumDist[i] });
        }
        this._state.negativeSpeedTransitions = negativeSpeedTransitions;
        // Cache a stable PHYSICAL key for route grouping (used by the LOD engine).
        // Endpoints/point-count/distance alone can collide for parallel tracks or
        // different platform routes. Include sampled geometry + OSM way identity.
        const first = route[0];
        const last = route[route.length - 1];
        const lastIdx = route.length - 1;
        const sampleIdx = [...new Set([0, Math.round(lastIdx * 0.25), Math.round(lastIdx * 0.5), Math.round(lastIdx * 0.75), lastIdx])];
        const routeSig = sampleIdx.map((i) => {
            const p = route[i] || {};
            return `${Number(p.lat || 0).toFixed(5)},${Number(p.lon || 0).toFixed(5)}:${String(p.wayId || '')}`;
        }).join('>');
        this._routeKey = `${route.length}@${cumDist[0].toFixed(3)}@${routeSig}`;
        // Direction-agnostic key for IPCS / same-track detection (same endpoints, either direction)
        const aKey = `${first.lat.toFixed(5)},${first.lon.toFixed(5)}`;
        const bKey = `${last.lat.toFixed(5)},${last.lon.toFixed(5)}`;
        this._trackKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
        // Find the closest point on the ROUTE GEOMETRY to current position. Nearest
        // vertex alone can jump to the wrong branch at loops/crossovers and after an
        // alternate-route swap. Preserve both segment index and fractional progress.
        if (this.position && route.length > 1) {
            const projected = this._projectRoutePosition(this.position, route, this._state.index || 0, Infinity);
            this._state.index = Math.max(0, Math.min(route.length - 2, Number(projected.segmentIndex) || 0));
            this._state.progress = Math.max(0, Math.min(1, Number(projected.t) || 0));
        }
        else {
            this._state.index = 0;
            this._state.progress = 0;
        }
        // Pre-analyze route for precise distance and time calculations
        const trainMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;
        this._routeAnalysis = analyzeRoute(route, trainMaxSpeed);
        // Create canton assignments for block signaling
        this._cantonAssignments = cantonManager.createRouteCantons(route);
        // Occupy the complete initial physical footprint. At a station change of leg,
        // keep the old-leg canton set until the tail has moved one train length into
        // the new leg.
        if (this._cantonAssignments.length > 0) {
            const occupied = this._syncCantonFootprint(route);
            if (!occupied)
                this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
        }
    }
    _getMaxRuntimeForCurrentLeg() {
        const stops = this.getCurrentStops();
        const idx = Math.max(0, this.currentStopIndex - 1);
        if (!stops || idx + 1 >= stops.length)
            return 120;
        const origin = stops[idx];
        const dest = stops[idx + 1];
        const rawPlanned = Number(dest.arrivalTime) - Number(origin.departureTime);
        const planned = this._v2OccurrenceId
            ? (rawPlanned > 0 ? rawPlanned : 5)
            : (((rawPlanned + 1440) % 1440) || 5);
        return Math.max(120, planned * 2 + 30);
    }
    _cancelBlockedService(timeOfDay) {
        if (this.completed || this.cancelled)
            return false;
        const completedTrack = materialTrackLocation(this.getCurrentStops().at(-1));
        globalThis.window?.game?.freightManager?.finishServiceCargo?.(this);
        this.state = 'cancelled';
        this.cancelled = true;
        this.completed = true;
        this.completedDate = (typeof window !== 'undefined' && window.game?._currentDate) || this._currentDate || '';
        this._finishLegacyOperatingDay();
        this.position = null;
        this.speed = 0;
        if (this.train) {
            this.train.speed = 0;
            this.train.stoppedAt = null;
            this._movementGo();
            this.train.delayReason = 'annulation après blocage prolongé';
        }
        this.delay = 0;
        // Cancellation must release every interlocking resource, not only cantons.
        this._releaseAllPhysicalResources();
        return true;
    }
    _updateStuckTimer(timeOfDay) {
        // A stop-type incident is a blocking condition from the moment it applies,
        // including the physical braking phase. Do not rely only on blockedBy: the
        // per-tick signal reset intentionally rebuilds that flag later in moveUpdate.
        const blocked = this.train && (this.train.incident?.effect === 'stop' || this.train.blockedBy || this.train.state === 'en panne' || this.train.delayReason === 'Incident' || this.train.delayReason === 'travaux' || this.train.delayReason?.startsWith('travaux :') || this.train.delayReason === 'tronçon non électrifié' || this.train.delayReason === 'TTX : ligne non électrifiée' || this.train.delayReason === 'attente voie libre en gare' || this.train.delayReason?.startsWith('Panne'));
        if (!blocked) {
            this._blockedSinceGameTime = null;
            return false;
        }
        const now = this._v2OccurrenceId
            ? this._v2ScheduleNowMinutes(this._currentDate, timeOfDay)
            : timeOfDay;
        if (this._blockedSinceGameTime == null)
            this._blockedSinceGameTime = now;
        const elapsed = this._v2OccurrenceId
            ? Math.max(0, now - Number(this._blockedSinceGameTime || 0))
            : ((now - Number(this._blockedSinceGameTime || 0) + 1440) % 1440);
        if (elapsed > this._getMaxRuntimeForCurrentLeg()) {
            return this._cancelBlockedService(timeOfDay);
        }
        return false;
    }
    _updateHeading(a, b) {
        if (!a || !b || !this.train)
            return;
        // Geographic heading (radians, 0 = north) used for "Se situe entre" context.
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLon = (b.lon - a.lon) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(b.lat * Math.PI / 180);
        const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos(dLon);
        this.train.geoHeading = Math.atan2(y, x);
        // Screen-space heading used for livemap icon rotation.
        const renderer = window.game?.renderer;
        if (!renderer?.latLonToScreen) {
            this.train.heading = 0;
            return;
        }
        try {
            const pa = renderer.latLonToScreen(a.lat, a.lon);
            const pb = renderer.latLonToScreen(b.lat, b.lon);
            this.train.heading = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        }
        catch (e) {
            this.train.heading = 0;
        }
    }
    _isPassThroughStop(stop) {
        return !stop?.turnBack && (stop?.type === 'waypoint' || stop?.type === 'passage');
    }
    _routeForStopIndex(stopIndex) {
        const leg = Math.max(0, stopIndex - 1);
        if (!this.isReturnLeg)
            return this.routes?.[leg] || null;
        if (this._returnRoutes?.length)
            return this._returnRoutes[leg] || null;
        const route = this.routes?.[this.routes.length - 1 - leg];
        return route && this._canSafelyReversePhysicalRoute(route) ? [...route].reverse() : null;
    }
    _passageContinuationIssue() {
        if (!this._isPassThroughStop(this.getNextStop()) || this.currentStopIndex + 1 >= this.getCurrentStops().length)
            return null;
        const next = this._routeForStopIndex(this.currentStopIndex + 1);
        const current = this._state?.cachedRoute;
        if (!next || next.length < 2)
            return 'tracé ferroviaire suivant manquant';
        const end = current?.[current.length - 1], start = next[0];
        if (!end || !Number.isFinite(haversineDistance(end.lat, end.lon, start.lat, start.lon)) ||
            haversineDistance(end.lat, end.lon, start.lat, start.lon) > 0.002)
            return 'discontinuité ferroviaire après passage';
        return null;
    }
    _holdAtInvalidPassage() {
        const issue = this._passageContinuationIssue();
        if (!issue)
            return false;
        this.speed = this.train.speed = 0;
        this.state = this.train.state = 'blocked_route';
        this._movementStop('PASSAGE_ROUTE_INVALID', issue, 'route');
        return true;
    }
    // A timing/pass-through point is not a braking horizon. Inspect actual
    // following geometry so removing its fictitious stop does not remove the
    // anticipation of the next real station, speed reduction or catenary gap.
    _passageLookAheadCap(route, timeOfDay) {
        if (!this._isPassThroughStop(this.getNextStop()))
            return null;
        const stops = this.getCurrentStops();
        if (this._passageContinuationIssue())
            return this._brakingCurveCapKmh(this._getRemainingDistance(route) * 1000, 0, 5);
        const horizon = Math.max(1, this._safetyHorizonKm(Math.max(this.speed, this.train.maxSpeed)));
        let distance = this._getRemainingDistance(route), cap = Infinity;
        const electricOnly = this._isElectricOnly() || this.isLegacyCatenaryWork;
        for (let si = this.currentStopIndex + 1; si < stops.length && distance <= horizon; si++) {
            const following = this._routeForStopIndex(si);
            if (!following || following.length < 2) {
                return Math.min(cap, this._brakingCurveCapKmh(distance * 1000, 0, 5));
            }
            const speeds = this._resolvedRouteSpeeds(following);
            for (let i = 0; i < following.length - 1 && distance <= horizon; i++) {
                let nextLimit = Math.min(speeds[i] ?? this.train.maxSpeed, speeds[i + 1] ?? this.train.maxSpeed);
                if (electricOnly && (following[i].electrified === false || following[i + 1].electrified === false))
                    nextLimit = 0;
                if (nextLimit < this.speed)
                    cap = Math.min(cap, this._brakingCurveCapKmh(distance * 1000, nextLimit, nextLimit ? 100 : 5));
                distance += haversineDistance(following[i].lat, following[i].lon, following[i + 1].lat, following[i + 1].lon);
            }
            if (!this._isPassThroughStop(stops[si])) {
                if (distance <= horizon)
                    cap = Math.min(cap, this._brakingCurveCapKmh(distance * 1000, 0, 0, null, 0.78));
                break;
            }
        }
        return Number.isFinite(cap) ? cap : null;
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
        if (globalThis.window?.game?.depotManager?.ownsServiceMovement?.(this.id))
            return;
        if (!this.active || this.state !== 'moving')
            return;
        if (this.train.inMaintenance || this.rame?.inMaintenance) {
            this.speed = this.train.speed = 0;
            this._movementStop('MAINTENANCE', 'rame en maintenance', 'depot');
            return;
        }
        this._movementBegin(this.train?.maxSpeed ?? Infinity);
        // REG-03 : un train en route n'est plus sous garage régulation
        this._garageUntil = null;
        // RH-05 / MNT-03 — operational hard stops are physical target speeds, not
        // teleporting velocity resets. Keep the service in the movement loop while it
        // brakes so followers see its real position/speed throughout the stop.
        const strikeBlocked = window.game?.realismSettings?.personnelRequired === true && !!window.game?.unions?.isServiceBlocked(this.id);
        const severeBreakdown = !!(this.train.breakdown && !['climatisation', 'portes'].includes(this.train.breakdown.type));
        if (strikeBlocked)
            this.train.delayReason = 'grève';
        if (severeBreakdown) {
            this.train.state = 'en panne';
            this.train.delayReason = 'Panne — arrêt du train';
            if (!this._rescueDispatched && this.position && window.game?.depotManager) {
                this._rescueDispatched = !!window.game.depotManager.dispatchRescue(this.world, this);
            }
        }
        cantonManager.setTime(timeOfDay);
        this._updateRegulationFactor();
        // Clear any stale garage state from old saves
        if (this._garage)
            this._garage = null;
        // Safety: ensure position exists (may be null after reload or direct transition)
        if (!this.position) {
            const stops = this.getCurrentStops();
            const depSt = stops?.length > 0 ? this.world?.getStationById(stops[0]?.stationId) : null;
            if (depSt) {
                this.position = { lat: depSt.lat, lon: depSt.lon };
            }
            else {
                return;
            }
        }
        let target = this.getTargetStation();
        if (!target) {
            // Missing target is infrastructure/schedule corruption, never a successful
            // arrival. Completing here used to hide routing failures as early services.
            this.speed = 0;
            this.train.speed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.state = 'blocked_route';
            this.train.state = 'blocked_route';
            this.train.delayReason = 'destination/tracé ferroviaire introuvable';
            return;
        }
        // Override target coords with voie point when stop has a voiePointId
        const nextStop = this.getNextStop();
        if (nextStop?.voiePointId && nextStop.trackIdentity?.kind !== 'osm' && window.game?.voiePointManager) {
            const vp = window.game.voiePointManager.getVoiePointById(nextStop.voiePointId);
            if (vp)
                target = { ...target, lat: vp.lat, lon: vp.lon };
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
        // Railway topology is authoritative for EVERY service. The old legacy
        // compatibility path moved a train in a synthetic straight line when its ORM
        // route was missing, violating the no-fallback contract and bypassing track
        // occupancy/interlocking entirely. Fail closed instead.
        if (!route || route.length < 2) {
            this.speed = 0;
            this.train.speed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.delayReason = this._v2OccurrenceId
                ? 'Horaire V2 à réparer : tracé ORM manquant'
                : 'Tracé ferroviaire ORM manquant : service à réparer';
            this.state = 'blocked_route';
            this.train.state = 'blocked_route';
            return;
        }
        // Clamp route index to valid range
        if (this._state.index < 0)
            this._state.index = 0;
        if (this._state.index >= route.length)
            this._state.index = route.length - 1;
        // Check if we've reached end of route
        if (this._state.index >= route.length - 1) {
            if (this._holdAtInvalidPassage())
                return;
            // A route vertex is not an arrival event while the consist is still moving.
            // Coarse ticks may land on the endpoint a fraction early; finish the brake
            // application first instead of teleporting velocity to zero in arriveAtStation().
            if (this.speed > 1 && !this._isPassThroughStop(this.getNextStop())) {
                const w = this._getWeatherEffects();
                const p = this._computePhysicsAccel(w, route, Math.max(0, route.length - 2));
                this._applyPhysicalSpeedTarget(0, p.accel, p.decel, dt);
                this.train.speed = Math.round(this.speed);
                this._syncCantonFootprint(route);
                return;
            }
            if (this._holdForBookedArrival(timeOfDay))
                return;
            // v1.1.73: arrival is not a teleport. Keep the physical footprint reserved
            // until the consist really clears it on a later departure/final cleanup.
            this._syncCantonFootprint(route);
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
        const infraLimit = Math.min(this._getInfraSpeedLimit(route, segIdx, this._state.progress, trainLength), this._getPassageTailSpeedLimit());
        const negativeCap = this._getNegativeTransitionCap(route, segIdx, this._state.progress, this.speed);
        let segMaxSpeed = negativeCap != null ? Math.min(infraLimit, negativeCap) : infraLimit;
        // Train physical speed limit
        const rameMaxSpeed = this.rame ? this.rame.maxSpeed : this.train.maxSpeed;
        // Reset transient safety state BEFORE this tick's restrictions are evaluated.
        // The old ordering cleared blockedBy after incidents/works had just set it.
        this._movementGo();
        this.train.signalAlert = null;
        if (this.train.delayReason === 'attente tronçon / réservation')
            this.train.delayReason = '';
        if (this.speed > 0 && this.train.incident?.effect !== 'stop')
            this._blockedSinceGameTime = null;
        // Incident effects
        const incident = this.train.incident;
        if (incident?.effect === 'stop') {
            // Do not teleport velocity to zero. An incident requiring a stop is a
            // physical 0 km/h target and therefore goes through the same braking law
            // as a red signal / closure. Approaching incidents already provide an
            // anticipatory speed cap before the affected point.
            segMaxSpeed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.delayReason = incident.name || 'Incident';
        }
        else if (incident?.effect === 'slow') {
            segMaxSpeed = Math.min(segMaxSpeed, incident.speedLimit || 30);
        }
        // Works speed limit (S15: work trains are unaffected)
        const worksLimit = this.isWorkTrain ? null : this.getWorksSpeedLimit(timeOfDay);
        const dateStrWorks = this._currentDate || (typeof window !== 'undefined' && window.game?._currentDate) || '';
        if (!this.isWorkTrain && this._worksClosureAhead) {
            this._startAlternateRouteSearch(timeOfDay, dateStrWorks);
            const ready = this._pendingAltRoute;
            if (ready?.completed && ready.route) {
                this._applyAlternateRoute(ready.route, timeOfDay);
                return;
            }
        }
        if (worksLimit === 0) {
            const dateStr = dateStrWorks;
            this._startAlternateRouteSearch(timeOfDay, dateStr);
            const search = this._pendingAltRoute;
            if (search && search.completed && search.route) {
                this._applyAlternateRoute(search.route, timeOfDay);
                return; // next tick will follow the alternate route
            }
            // Physical stop at the closure boundary; the spatial works look-ahead
            // already feeds a braking curve before this reaches zero.
            segMaxSpeed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.state = 'travaux';
            this.train.delayReason = (search && search.completed && !search.route) ? 'travaux : aucun itinéraire alternatif' : 'travaux';
        }
        else if (worksLimit !== null) {
            segMaxSpeed = Math.min(segMaxSpeed, worksLimit);
        }
        // CRITICAL: effectiveSpeed = min(train speed, infrastructure speed)
        let effectiveMaxSpeed = Math.min(rameMaxSpeed, segMaxSpeed);
        if (strikeBlocked || severeBreakdown) {
            effectiveMaxSpeed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
        }
        // MAT-08 — anticipate a non-electrified section using a physical stop curve.
        const elecAheadKm = this._distanceAheadToElectrificationMismatch(route);
        if (Number.isFinite(elecAheadKm)) {
            effectiveMaxSpeed = Math.min(effectiveMaxSpeed, this._brakingCurveCapKmh(elecAheadKm * 1000, 0, 5));
            if (elecAheadKm <= 0.005) {
                effectiveMaxSpeed = 0;
                this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                this.train.delayReason = this.isLegacyCatenaryWork ? 'TTX : ligne non électrifiée' : 'tronçon non électrifié';
            }
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
        const resources = materialResourceEffects(this.rame, this._resourceSection(route, segIdx), weather.type || 'clear');
        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, resources.speedCap);
        if (resources.stopReason) {
            effectiveMaxSpeed = 0;
            this._movementStop('CONSUMABLE_STOP', resources.stopReason, 'depot');
            this.train.delayReason = resources.stopReason;
        }
        else if (this.train.delayReason?.includes('épuisé'))
            this.train.delayReason = '';
        // --- TRONCON OCCUPANCY + CISAILLEMENT CHECK (first, physical block) ---
        let tronconBlocked = false;
        if (window.game?.voiePointManager && this.position) {
            const vpm = window.game.voiePointManager;
            // RC17: wall-time cache age is not evidence of physical position. During
            // catch-up, many simulated seconds can pass inside 300 real milliseconds;
            // after a route edit the cached object may not even belong to this network.
            // The manager owns its spatial index; ask it at the current front each step.
            const trainVoie = this.state === 'stopped_at_station' ? this._stationaryPhysicalTrackRef() : null;
            const currentTrc = vpm.getTronconAtPosition(this.position, 0.3, trainVoie, this._wayIdsAlong(route, segIdx, 0.15, 0.15));
            this._cachedTroncon = currentTrc || null;
            this._cachedTronconTime = null;
            if (currentTrc) {
                // A restored footprint is evidence of presence, not a permission to
                // cross a conflicting reserved route. Recheck even our own section.
                if (currentTrc.occupiedBy === this.id && vpm.checkCisaillement(currentTrc.id, this.id)) {
                    effectiveMaxSpeed = 0;
                    tronconBlocked = true;
                    this._movementStop('TRONCON_CONFLICT', 'attente itinéraire / cisaillement', 'interlocking');
                    this.train.delayReason = 'attente itinéraire / cisaillement';
                }
                if (currentTrc.occupiedBy !== this.id) {
                    if (vpm.isTronconOccupied(currentTrc.id, this.id)) {
                        effectiveMaxSpeed = 0;
                        tronconBlocked = true;
                        this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                        this.train.delayReason = this.train.delayReason || 'attente tronçon / réservation';
                    }
                    else {
                        const blocking = vpm.checkCisaillement(currentTrc.id, this.id);
                        if (blocking) {
                            effectiveMaxSpeed = 0;
                            tronconBlocked = true;
                            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                            this.train.delayReason = this.train.delayReason || 'attente tronçon / réservation';
                        }
                        else if (!vpm.occupyTroncon(currentTrc.id, this.id)) {
                            effectiveMaxSpeed = 0;
                            tronconBlocked = true;
                            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                            this.train.delayReason = this.train.delayReason || 'attente tronçon / réservation';
                        }
                    }
                }
                this._syncTronconTail(vpm, currentTrc);
            }
            else {
                // The head left custom infrastructure; keep old sections locked until the
                // rear has travelled one complete train length beyond them.
                this._syncTronconTail(vpm, null);
            }
            const approachConflict = this._reserveUpcomingTroncon(vpm, route, currentTrc);
            if (approachConflict) {
                effectiveMaxSpeed = Math.min(effectiveMaxSpeed, approachConflict.limit);
                tronconBlocked = !!approachConflict.blocked || Number(approachConflict.limit) <= 0;
                if (tronconBlocked)
                    this._movementStop('TRONCON_CONFLICT', 'attente itinéraire / cisaillement', 'interlocking');
                else
                    this._movementCaution(approachConflict.limit, 'TRONCON_APPROACH', 'approche itinéraire / cisaillement', 'interlocking');
                this.train.delayReason = this.train.delayReason || 'attente itinéraire / cisaillement';
            }
        }
        // --- CANTONNEMENT + PROXIMITY SAFETY (runs even on a troncon) ---
        if (this._cantonAssignments && this._cantonAssignments.length > 0) {
            const occupiedHere = cantonManager.getCantonForSegment(this._cantonAssignments, segIdx);
            if (occupiedHere && !cantonManager.isAvailable(occupiedHere.cantonId, this.id)) {
                effectiveMaxSpeed = 0;
                this._movementStop('CANTON_CURRENT_CONFLICT', 'canton physique occupé', 'canton');
            }
            const frontKm = this._currentFrontKm(route);
            const horizonM = this._safetyHorizonKm(this.speed) * 1000;
            const preReserved = cantonManager.reserveNextAhead(this._cantonAssignments, segIdx, this.id, frontKm, horizonM);
            const blocked = preReserved?.blocked ? preReserved : cantonManager.firstUnavailableAhead(this._cantonAssignments, segIdx, this.id, frontKm, horizonM);
            if (blocked) {
                const currentCanton = cantonManager.getCantonForSegment(this._cantonAssignments, segIdx);
                const currentIdx = currentCanton ? this._cantonAssignments.indexOf(currentCanton) : -1;
                const immediate = blocked.index === currentIdx + 1;
                const distM = Math.max(0, blocked.distanceM);
                this.train.signalAlert = immediate ? 'closed' : 'caution';
                // Physical stop curve to the first genuinely unavailable block. For the
                // immediately following red signal retain the VISA 30/20/10 approach.
                const curveCap = immediate && distM > 300
                    ? this._brakingCurveCapKmh(distM - 300, 30, 0)
                    : this._brakingCurveCapKmh(distM, 0, this._carreMarginM);
                const visaCap = immediate ? visaSpeedCapKmh(distM, this._carreMarginM) : null;
                effectiveMaxSpeed = Math.min(effectiveMaxSpeed, curveCap, visaCap == null ? Infinity : visaCap);
                if (!tronconBlocked && immediate && distM <= this._carreMarginM)
                    this._movementStop('CANTON_STOP', 'arrêt avant signal de canton fermé', 'canton');
                else
                    this._movementCaution(Math.min(curveCap, visaCap == null ? Infinity : visaCap), 'CANTON_APPROACH', 'freinage vers signal de canton fermé', 'canton');
            }
            else {
                this.train.signalAlert = null;
            }
        }
        // ALWAYS run proximity check as a safety net (catches cases where
        // canton geo-keys don't match between trains with different routes)
        const blockLimit = this._proximityBlockCheck(allServices);
        if (blockLimit !== null) {
            effectiveMaxSpeed = Math.min(effectiveMaxSpeed, blockLimit);
            if (blockLimit <= 0)
                this._movementStop('PROXIMITY_STOP', 'espacement avec le train précédent', 'proximity');
            else
                this._movementCaution(blockLimit, 'PROXIMITY_CAUTION', 'espacement avec le train précédent', 'proximity');
        }
        // IPCS runtime: stop opposite-direction trains on the same track (Section IV / Annexe 10d)
        const ipcsLimit = this._ipcsBlockCheck(allServices);
        if (ipcsLimit !== null) {
            effectiveMaxSpeed = Math.min(effectiveMaxSpeed, ipcsLimit);
            if (ipcsLimit <= 0) {
                this._movementStop('IPCS_STOP', 'attente IPCS / sens inverse', 'ipcs');
                this.train.delayReason = this.train.delayReason || 'attente IPCS / sens inverse';
            }
            else
                this._movementCaution(ipcsLimit, 'IPCS_CAUTION', 'croisement IPCS en approche', 'ipcs');
        }
        // --- STATION ROUTE / PLATFORM RESERVATION ---
        // Reserve the destination resource while it is still inside the physical
        // stopping envelope. This is an interlocking reservation, not an arrival:
        // two trains must never both enter the approach after seeing the same
        // platform as free. If the resource is unavailable, brake to a standstill
        // before the station instead of applying an instantaneous 0 km/h cap.
        {
            const nextStop = this.getNextStop();
            if (nextStop?.type === 'arret' && target) {
                const remainDist = this._getRemainingDistance(route);
                const reserveHorizonKm = Math.max(1.0, this._safetyHorizonKm(this.speed));
                if (remainDist <= reserveHorizonKm) {
                    const canArrive = this._reserveArrivalResources(target, nextStop);
                    if (!canArrive) {
                        const stationCurve = this._brakingCurveCapKmh(remainDist * 1000, 0, 15);
                        effectiveMaxSpeed = Math.min(effectiveMaxSpeed, stationCurve);
                        if (stationCurve <= 0.01)
                            this._movementStop('STATION_RESOURCE', 'attente voie libre en gare', 'station');
                        else
                            this._movementCaution(stationCurve, 'STATION_APPROACH', 'approche voie occupée en gare', 'station');
                        this.train.delayReason = 'attente voie libre en gare';
                    }
                }
            }
        }
        // v1.1.70 — no timetable-derived cruise cap. Passenger no-advance is
        // enforced only at the booked arrival boundary by _holdForBookedArrival().
        // --- ACCELERATION / DECELERATION PHYSICS (PH-01/PH-03/PH-04) ---
        // MET-03/04/05/06 — météo locale : freinage plus tôt sous pluie/orage/neige
        const physics = this._computePhysicsAccel(weather, route, segIdx);
        // Weather already acts through wheel/rail adhesion inside train-physics.
        const decel = physics.decel;
        // Check if next stop is a waypoint or passage (no station braking needed).
        const nextStopBrake = this.getNextStop();
        const isNextPassThrough = nextStopBrake?.type === 'waypoint' || nextStopBrake?.type === 'passage';
        // One speed target, one physical controller. Station stops use the exact same
        // SI braking curve as signals/incidents, including brake propagation build-up.
        const remainingDist = this._getRemainingDistance(route);
        if (this._yieldToRescue())
            effectiveMaxSpeed = 0;
        let physicalTargetSpeed = effectiveMaxSpeed;
        if (!isNextPassThrough && remainingDist > 0) {
            // HOTFIX81 — reserve a real service-braking margin and plan below the
            // physical maximum. The full service brake remains available for safety.
            const stationCurve = this._brakingCurveCapKmh(remainingDist * 1000, 0, 0, physics.decelMs2, 0.78);
            physicalTargetSpeed = Math.min(physicalTargetSpeed, stationCurve);
        }
        const throughCap = this._passageLookAheadCap(route, timeOfDay);
        if (throughCap != null)
            physicalTargetSpeed = Math.min(physicalTargetSpeed, throughCap);
        const speedBeforeController = Math.max(0, Number(this.speed || 0));
        this._applyPhysicalSpeedTarget(physicalTargetSpeed, physics.accel, decel, dt);
        // v1.1.73 — integrate distance with the average speed over the physics step.
        // Using the END speed for the whole tick made acceleration optimistic and,
        // especially in 1–3 s macro steps, created measurable timetable advance.
        const stepKm = this._clipAdvanceToPhysicalLeader(route, ((speedBeforeController + Math.max(0, Number(this.speed || 0))) * 0.5) * dt / 3600);
        if (stepKm <= 0) {
            if (this._commitNearEndpointArrival(route, timeOfDay))
                return;
            this.train.speed = 0;
            // A zero-speed service is not a completed station stop unless the arrival
            // transition above succeeded. Preserve the logical movement state for UI.
            this.train.state = this.train.blockedBy ? 'waiting_signal' : 'moving';
            this._updateContinuousDelay(timeOfDay);
            if (this._updateStuckTimer(timeOfDay))
                return;
            return;
        }
        // --- STRICT ROUTE FOLLOWING: advance segment by segment ---
        let remaining = stepKm;
        let movedKm = 0;
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
                movedKm += remainingInSeg;
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
                            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
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
                            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                            remaining = 0;
                            break;
                        }
                        // Do NOT release the previous canton here: the train's rear may still
                        // occupy it. _syncCantonFootprint() releases it only after tail clear.
                    }
                }
                this._state.index++;
                this._state.progress = 0;
            }
            else {
                // Partial segment: advance progress
                const partialKm = remaining;
                this._state.progress += partialKm / segDist;
                movedKm += partialKm;
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
        }
        else {
            // Reached end of route — track km before returning
            const lastPt = route[route.length - 1];
            this.position.lat = lastPt.lat;
            this.position.lon = lastPt.lon;
            const prevIdx = Math.max(0, this._state.index - 1);
            this._updateHeading(route[prevIdx], lastPt);
            const finalDist = movedKm;
            if (isFinite(finalDist) && finalDist > 0) {
                this.totalDistance += finalDist;
                this._trackWear(finalDist, timeOfDay);
            }
            this._syncCantonFootprint(route);
            if (this._holdAtInvalidPassage())
                return;
            if (this.speed > 1 && !isNextPassThrough) {
                // A coarse step may land exactly on the endpoint while a few km/h remain.
                // Never convert that residual velocity into an instantaneous arrival.
                this.train.speed = Math.round(this.speed);
                this.train.state = 'moving';
                return;
            }
            if (this._holdForBookedArrival(timeOfDay))
                return;
            // Keep physical rear blocks occupied while stopped at the platform.
            this.arriveAtStation(target, timeOfDay, this._economy);
            return;
        }
        // --- v1.1.71 HARD ANTI-OVERLAP (last-resort safety net) ---
        // Normal regulation is handled continuously by _proximityBlockCheck(). This
        // guard only rewinds a coarse simulation step that physically crossed the rear
        // of the leader; it no longer substitutes an oversized dynamic spacing rule.
        let overlapCorrectionKm = 0;
        if (allServices && allServices.length > 1) {
            const leader = this._findPhysicalLeader(allServices, route, 6);
            if (leader) {
                const myFrontKm = this._getRouteProgressKm(this.position, route, this._state.index);
                const hardTargetKm = Math.max(0, leader.frontProgressKm - leader.lengthM / 1000 - 0.03);
                if (myFrontKm > hardTargetKm) {
                    overlapCorrectionKm = Math.max(0, myFrontKm - hardTargetKm);
                    this._setRouteProgressKm(route, hardTargetKm);
                    this.speed = Math.min(this.speed, leader.leaderSpeedKmh);
                    if (this.speed <= 0.01)
                        this._movementStop('ANTI_OVERLAP_STOP', 'espacement de sécurité', 'proximity');
                    else
                        this._movementCaution(this.speed, 'ANTI_OVERLAP_CAUTION', 'espacement de sécurité', 'proximity');
                }
            }
        }
        // Synchronize occupation AFTER any anti-overlap rewind, so safety resources
        // match the actual physical front/rear coordinates.
        if (!this._syncCantonFootprint(route)) {
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.speed = 0;
        }
        this._releaseDepartureResourcesIfTailClear(route);
        // Distance really travelled this tick AFTER any coarse-step anti-overlap rewind.
        const actualDist = Math.max(0, movedKm - overlapCorrectionKm);
        this.totalDistance += actualDist;
        this.train.speed = Math.round(this.speed);
        this.train.totalKm = this.totalDistance;
        this.train.state = severeBreakdown ? 'en panne' : (strikeBlocked ? 'grève' : (this.speed > 0 ? 'moving' : 'stopped'));
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
        if (idx >= route.length - 1)
            return 0;
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
        if (!t)
            return;
        if (this._iteHardBlock) {
            t.delayReason = 'ITE : train trop long';
            return;
        }
        if (this._rescueDispatched || t.state === 'en panne') {
            t.delayReason = 'Panne — attente secours';
            return;
        }
        if (t.breakdown) {
            t.delayReason = `Panne ${t.breakdown.type}`;
            return;
        }
        if (t.incident) {
            t.delayReason = t.incident.name || 'Incident';
            return;
        }
        if (t.movementAuthority?.status === 'STOP') {
            const ar = String(t.movementAuthority.reason || '');
            if (ar && ar !== 'arrêt de sécurité') {
                t.delayReason = ar;
                return;
            }
            if (t.delayReason)
                return; // keep the exact subsystem reason already published this tick
        }
        if (t.signalAlert === 'closed') {
            t.delayReason = 'Arrêt pour signal fermé';
            return;
        }
        if (t.movementAuthority?.status === 'CAUTION' && t.movementAuthority.reason) {
            t.delayReason = t.movementAuthority.reason;
            return;
        }
        if (t.signalAlert === 'caution' || t.blockedBy) {
            t.delayReason = 'Régulation du trafic';
            return;
        }
        if (this._iteCargoMismatch) {
            t.delayReason = 'ITE : cargaison incompatible';
            return;
        }
        if (this._iteDwellExtra > 0) {
            t.delayReason = 'ITE : manœuvres / chargement';
            return;
        }
        t.delayReason = '';
    }
    _updateContinuousDelay(timeOfDay) {
        const stops = this.getCurrentStops();
        if (this.currentStopIndex <= 0 || this.currentStopIndex >= stops.length)
            return;
        // Use immediate previous and next stops for this segment
        const prevStop = stops[this.currentStopIndex - 1];
        const nextStop = stops[this.currentStopIndex];
        const depA = prevStop.departureTime ?? prevStop.arrivalTime ?? 0;
        const arrB = nextStop.arrivalTime ?? nextStop.departureTime ?? (depA + 5);
        let scheduledTravelTime = arrB - depA;
        // Legacy times wrap at midnight; V2 times are already absolute J+n values.
        if (!this._v2OccurrenceId && scheduledTravelTime < 0)
            scheduledTravelTime += 1440;
        if (scheduledTravelTime <= 0)
            scheduledTravelTime = 1;
        // Planned-time progress on the exact ORM route. Distance progress is wrong
        // whenever the run accelerates, brakes, changes line speed or crosses a grade.
        let progress = 0;
        const plannedTotal = Number(this._state?.plannedTotalTimeSec || 0);
        if (plannedTotal > 0 && this._state?.plannedCumTimeSec && this._state?.plannedSegTimeSec) {
            const idx = Math.max(0, Math.min(this._state.plannedSegTimeSec.length - 1, Number(this._state.index) || 0));
            const segProg = Math.max(0, Math.min(1, Number(this._state.progress) || 0));
            const elapsedPlanned = Number(this._state.plannedCumTimeSec[idx] || 0)
                + Number(this._state.plannedSegTimeSec[idx] || 0) * segProg;
            progress = Math.max(0, Math.min(1, elapsedPlanned / plannedTotal));
        }
        else if (this._state?.cachedRoute && this._state.cumDist && this._state.segDists) {
            // Compatibility fallback for corrupt/legacy routes where a physical profile
            // cannot be built. Keep the old distance interpolation only there.
            const totalRouteDist = this._state.cumDist[0] || 0;
            if (totalRouteDist > 0.001) {
                const idx = this._state.index || 0;
                const segProg = this._state.progress || 0;
                const distRemaining = (1 - segProg) * (this._state.segDists[idx] || 0)
                    + (this._state.cumDist[idx + 1] || 0);
                progress = Math.max(0, Math.min(1, 1 - distRemaining / totalRouteDist));
            }
        }
        else if (this.position) {
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
        // Expected time at current position = depA + scheduledTravelTime * progress.
        // V2 uses an absolute J/J+n clock; legacy keeps the wrapped clock.
        const expectedTime = depA + scheduledTravelTime * progress;
        const scheduleNow = this._v2ScheduleNowMinutes(this._currentDate, timeOfDay);
        const rawDelay = this._scheduleDiff(scheduleNow, expectedTime);
        // HOTFIX81 — early running is operational information too. Passenger trains
        // are still prevented from DEPARTING early by the booked-arrival/departure
        // gates; only the displayed/recorded delta is allowed below zero.
        this.delay = rawDelay;
        this.train.delay = rawDelay;
        // DEP-05 : mise à jour continue de la localisation permanente de la rame
        if (this.rame && this.position) {
            this.rame.currentLocation = {
                stationId: this.rame.currentLocation?.stationId || '',
                depotId: '', // RC2: home depot is affiliation, not physical presence.
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
        // v1.1.73 — synthetic straight-line railway movement is forbidden. Keep the
        // legacy method as a fail-closed compatibility boundary in case an old plugin
        // still calls it.
        this.speed = 0;
        this.train.speed = 0;
        this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
        this.state = 'blocked_route';
        this.train.state = 'blocked_route';
        this.train.delayReason = 'tracé ferroviaire ORM requis';
        return false;
    }
    /**
     * Proximity-based block check fallback (when canton data unavailable).
     */
    _distanceToRouteIndexM(route, targetIndex) {
        if (!route?.length || !this.position)
            return Infinity;
        const cum = this._routeCumulativeKm(route);
        const idx = Math.max(0, Math.min(route.length - 2, Number(this._state?.index) || 0));
        const segKm = Math.max(0, (cum[idx + 1] || cum[idx]) - (cum[idx] || 0));
        const frontKm = (cum[idx] || 0) + Math.max(0, Math.min(1, Number(this._state?.progress) || 0)) * segKm;
        const ti = Math.max(0, Math.min(route.length - 1, Number(targetIndex) || 0));
        return Math.max(0, ((cum[ti] || 0) - frontKm) * 1000);
    }
    _brakingCurveCapKmh(distanceM, targetKmh = 0, marginM = 0, decelMs2 = null, planningFactor = 0.86) {
        // HOTFIX81 — normal driving plans below the physical full-service maximum,
        // otherwise braking starts at the mathematical last moment.
        const buildM = Math.max(0, Number(this.speed || 0)) / 3.6 * this._brakeBuildSeconds() * 0.75;
        const d = Math.max(0, Number(distanceM || 0) - Math.max(0, Number(marginM || 0)) - buildM);
        const fallbackMs2 = Math.max(0.05, Number(this.train?.decel || 2) / 3.6);
        const physicalA = Math.max(0.05, Number(decelMs2 ?? this._lastPhysicsDecelMs2 ?? fallbackMs2));
        const factor = Math.max(0.55, Math.min(1, Number(planningFactor || 1)));
        const a = Math.max(0.05, physicalA * factor);
        const vt = Math.max(0, Number(targetKmh || 0)) / 3.6;
        return Math.sqrt(vt * vt + 2 * a * d) * 3.6;
    }
    _setRouteProgressKm(route, targetKm) {
        if (!route?.length)
            return;
        const cum = this._routeCumulativeKm(route);
        const total = cum?.[cum.length - 1] || 0;
        const target = Math.max(0, Math.min(total, Number(targetKm) || 0));
        let lo = 0, hi = route.length - 2;
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            if ((cum[mid] || 0) <= target)
                lo = mid;
            else
                hi = mid - 1;
        }
        const i = Math.max(0, Math.min(route.length - 2, lo));
        const segKm = Math.max(1e-12, (cum[i + 1] || cum[i]) - (cum[i] || 0));
        const t = Math.max(0, Math.min(1, (target - (cum[i] || 0)) / segKm));
        this._state.index = i;
        this._state.progress = t;
        const a = route[i], b = route[i + 1];
        this.position.lat = a.lat + (b.lat - a.lat) * t;
        this.position.lon = a.lon + (b.lon - a.lon) * t;
    }
    _routeCumulativeKm(route) {
        if (!route || route.length < 2)
            return null;
        if (!this._cumDistCache)
            this._cumDistCache = new WeakMap();
        let cum = this._cumDistCache.get(route);
        if (cum)
            return cum;
        cum = new Float64Array(route.length);
        for (let i = 1; i < route.length; i++) {
            cum[i] = cum[i - 1] + haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
        }
        this._cumDistCache.set(route, cum);
        return cum;
    }
    _projectRoutePosition(pos, route, hintIndex = 0, windowKm = 6) {
        if (!pos || !route || route.length < 2)
            return { progressKm: 0, distanceKm: Infinity, segmentIndex: 0, t: 0 };
        const cum = this._routeCumulativeKm(route);
        const hint = Math.max(0, Math.min(route.length - 2, Number(hintIndex) || 0));
        const centerKm = cum[hint] || 0;
        let lo = hint, hi = hint;
        while (lo > 0 && centerKm - cum[lo] < windowKm)
            lo--;
        while (hi < route.length - 2 && cum[hi + 1] - centerKm < windowKm)
            hi++;
        const cosLat = Math.max(0.15, Math.cos(Number(pos.lat) * Math.PI / 180));
        let best = { progressKm: 0, distanceKm: Infinity, segmentIndex: hint, t: 0 };
        for (let i = lo; i <= hi; i++) {
            const a = route[i], b = route[i + 1];
            if (!a || !b)
                continue;
            const ax = (Number(a.lon) - Number(pos.lon)) * 111.32 * cosLat;
            const ay = (Number(a.lat) - Number(pos.lat)) * 111.32;
            const bx = (Number(b.lon) - Number(pos.lon)) * 111.32 * cosLat;
            const by = (Number(b.lat) - Number(pos.lat)) * 111.32;
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            let t = len2 > 1e-12 ? (-(ax * dx + ay * dy) / len2) : 0;
            t = Math.max(0, Math.min(1, t));
            const px = ax + dx * t, py = ay + dy * t;
            const d = Math.hypot(px, py);
            if (d < best.distanceKm) {
                const segKm = (cum[i + 1] || cum[i]) - cum[i];
                best = { progressKm: (cum[i] || 0) + segKm * t, distanceKm: d, segmentIndex: i, t };
            }
        }
        return best;
    }
    _currentFrontKm(route = this._state?.cachedRoute) {
        if (!Array.isArray(route) || route.length < 2)
            return 0;
        const cum = this._routeCumulativeKm(route);
        const rawIdx = Number(this._state?.index) || 0;
        if (rawIdx >= route.length - 1)
            return Number(cum[route.length - 1] || 0);
        const idx = Math.max(0, Math.min(route.length - 2, rawIdx));
        const segKm = Math.max(0, Number(cum[idx + 1] || 0) - Number(cum[idx] || 0));
        return Number(cum[idx] || 0) + Math.max(0, Math.min(1, Number(this._state?.progress) || 0)) * segKm;
    }
    _routePositionAtKm(route, targetKm) {
        if (!Array.isArray(route) || route.length < 2)
            return this.position ? { ...this.position } : null;
        const cum = this._routeCumulativeKm(route);
        const total = Number(cum[cum.length - 1] || 0);
        const target = Math.max(0, Math.min(total, Number(targetKm) || 0));
        let lo = 0, hi = route.length - 2;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (Number(cum[mid] || 0) <= target)
                lo = mid;
            else
                hi = mid - 1;
        }
        const i = Math.max(0, Math.min(route.length - 2, lo));
        const seg = Math.max(1e-9, Number(cum[i + 1] || 0) - Number(cum[i] || 0));
        const t = Math.max(0, Math.min(1, (target - Number(cum[i] || 0)) / seg));
        const a = route[i], b = route[i + 1];
        return {
            lat: a.lat + (b.lat - a.lat) * t,
            lon: a.lon + (b.lon - a.lon) * t,
            wayId: a.wayId ?? b.wayId ?? null,
        };
    }
    _reserveUpcomingTroncon(vpm, route, currentTrc = null) {
        if (!vpm || !Array.isArray(vpm.troncons) || !vpm.troncons.length || !route?.length)
            return null;
        const frontKm = this._currentFrontKm(route);
        // Interlocking look-ahead follows the PHYSICAL stopping horizon. The old
        // 3 km cap could discover a blocked turnout only after a high-speed train had
        // already entered its braking distance. Keep sampling bounded for performance.
        const horizonKm = Math.max(0.4, Math.min(25.0, this._safetyHorizonKm(this.speed)));
        const stepKm = Math.max(0.025, Math.min(0.08, horizonKm / 60));
        let candidate = null, distanceKm = Infinity;
        for (let d = 0.03; d <= horizonKm + 1e-9; d += stepKm) {
            const pt = this._routePositionAtKm(route, frontKm + d);
            if (!pt)
                break;
            const trc = vpm.getTronconAtPosition(pt, 0.08, null, pt.wayId != null ? new Set([String(pt.wayId)]) : null);
            if (!trc || trc.id === currentTrc?.id || this._occupiedTronconIds.has(trc.id))
                continue;
            candidate = trc;
            distanceKm = d;
            break;
        }
        if (!candidate) {
            if (this._reservedTronconId)
                vpm.releaseTronconReservation?.(this._reservedTronconId, this.id);
            this._reservedTronconId = null;
            return null;
        }
        const unavailable = vpm.isTronconOccupied(candidate.id, this.id) || !!vpm.checkCisaillement(candidate.id, this.id);
        if (unavailable) {
            if (this._reservedTronconId && this._reservedTronconId !== candidate.id) {
                vpm.releaseTronconReservation?.(this._reservedTronconId, this.id);
                this._reservedTronconId = null;
            }
            return {
                limit: this._brakingCurveCapKmh(distanceKm * 1000, 0, 15),
                distanceKm,
                blocked: distanceKm <= 0.03,
                troncon: candidate,
            };
        }
        if (this._reservedTronconId && this._reservedTronconId !== candidate.id) {
            vpm.releaseTronconReservation?.(this._reservedTronconId, this.id);
        }
        if (!vpm.reserveTroncon?.(candidate.id, this.id)) {
            return { limit: this._brakingCurveCapKmh(distanceKm * 1000, 0, 15), distanceKm, blocked: false, troncon: candidate };
        }
        this._reservedTronconId = candidate.id;
        return null;
    }
    _syncTronconTail(vpm, currentTrc) {
        const lengthKm = Math.max(0.001, Number(this.rame?.totalLength || this.train?.length || 20) / 1000);
        if (currentTrc) {
            // Fail closed. If another train owns/reserves the section, never overwrite
            // it merely because our head geometry happens to project onto that section.
            const ownsOrAcquired = currentTrc.occupiedBy === this.id || vpm.occupyTroncon(currentTrc.id, this.id);
            if (ownsOrAcquired) {
                vpm.releaseTronconReservation?.(currentTrc.id, this.id);
                if (this._reservedTronconId === currentTrc.id)
                    this._reservedTronconId = null;
                this._occupiedTronconIds.add(currentTrc.id);
                this._tronconExitTravelKm.delete(currentTrc.id);
                if (this._lastTronconId && this._lastTronconId !== currentTrc.id && !this._tronconExitTravelKm.has(this._lastTronconId)) {
                    this._tronconExitTravelKm.set(this._lastTronconId, Number(this.totalDistance || 0));
                }
                this._lastTronconId = currentTrc.id;
            }
        }
        else if (this._lastTronconId && !this._tronconExitTravelKm.has(this._lastTronconId)) {
            this._tronconExitTravelKm.set(this._lastTronconId, Number(this.totalDistance || 0));
            this._lastTronconId = null;
        }
        for (const id of [...this._occupiedTronconIds]) {
            const exitKm = this._tronconExitTravelKm.get(id);
            if (exitKm == null)
                continue;
            if (Number(this.totalDistance || 0) - exitKm >= lengthKm + 0.03) {
                vpm.releaseTroncon(id, this.id);
                this._occupiedTronconIds.delete(id);
                this._tronconExitTravelKm.delete(id);
            }
        }
    }
    _restoreHeldDepartureSafety() {
        const hold = this._departureResourceHold;
        if (!hold)
            return;
        const vpm = typeof window !== 'undefined' ? window.game?.voiePointManager : null;
        if (hold.voiePointId && vpm)
            vpm.occupyVoiePoint?.(hold.voiePointId, this.id);
        if (hold.stationId && hold.platformSource !== 'VOIE_POINT' && typeof window !== 'undefined' && window.game?.platformManager) {
            const station = this.world?.getStationById?.(hold.stationId);
            const assigned = window.game.platformManager.assignPlatform(hold.stationId, this.id, station?.platforms || 2, hold.platform ?? null, { exactPreferred: !!this._v2OccurrenceId || !!hold.trackIdentity, trackIdentity: hold.trackIdentity, displayName: hold.displayName });
            if (assigned == null || (!hold.trackIdentity && hold.platform != null && String(assigned) !== String(hold.platform))) {
                this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
                this.train.delayReason = 'ressource gare à restaurer';
            }
            else if (hold.trackIdentity) {
                hold.platform = assigned; // The canonical alias key may differ after a fresh load.
            }
        }
        // Rebuild the old approach footprint under the physical rear. The new-route
        // footprint may already be occupied; retain it while adding the remaining
        // metres of the previous route, then carry those block IDs until tail clear.
        const oldRoute = this._stationaryRoute;
        if (!Array.isArray(oldRoute) || oldRoute.length < 2)
            return;
        const lengthM = Math.max(1, Number(this.rame?.totalLength || this.train?.length || 20));
        const travelledM = Math.max(0, (Number(this.totalDistance || 0) - Number(hold.startTravelKm || 0)) * 1000);
        const rearOnOldM = Math.max(0, lengthM - travelledM);
        if (rearOnOldM <= 0.5)
            return;
        const assignments = cantonManager.createRouteCantons(oldRoute);
        if (!assignments.length)
            return;
        const currentIds = cantonManager.getTrackedCantons(this.id);
        const cum = this._routeCumulativeKm(oldRoute);
        const oldFrontKm = Number(cum?.[cum.length - 1] || 0);
        cantonManager.syncFootprint(this.id, assignments, oldFrontKm, rearOnOldM, currentIds);
        const tracked = cantonManager.getTrackedCantons(this.id);
        const oldIds = new Set([...tracked].filter((id) => !currentIds.has(id)));
        this._carryoverCantonIds = oldIds.size ? oldIds : null;
        this._carryoverStartTravelKm = Number(hold.startTravelKm || 0);
    }
    _restoreStationarySafetyFootprint() {
        if (this.state !== 'stopped_at_station' || !this.position)
            return;
        // Rebuild the APPROACH-route footprint. After arrival getCurrentRoute() already
        // points to the following leg, which must never make the stopped consist vanish
        // from the throat it is still physically occupying.
        const route = this._stationaryRoute || this._getStationaryRoute?.();
        if (Array.isArray(route) && route.length >= 2) {
            this._stationaryRoute = route;
            this._stationaryRouteIndex = Math.max(0, Math.min(route.length - 2, Number(this._stationaryRouteIndex ?? (route.length - 2))));
            const assignments = cantonManager.createRouteCantons(route);
            if (assignments.length) {
                const cum = this._routeCumulativeKm(route);
                const frontKm = Number(cum?.[cum.length - 1] || 0);
                const lengthM = Math.max(1, Number(this.rame?.totalLength || this.train?.length || 20));
                if (!cantonManager.syncFootprint(this.id, assignments, frontKm, lengthM)) {
                    this._movementStop('STATION_FOOTPRINT_CONFLICT', 'canton occupé au stationnement', 'canton');
                    return false;
                }
            }
        }
        // A stopped consist must also reacquire the physical turnout/track section it
        // occupies after F5. Platform+canton ownership alone does not protect a station
        // throat represented by the custom VoiePoint interlocking layer.
        const vpm = globalThis.window?.game?.voiePointManager;
        if (!vpm)
            return;
        const trc = vpm.getTronconAtPosition?.(this.position, 0.3, this.train?.platform || null, Array.isArray(route) ? this._wayIdsAlong(route, Math.max(0, route.length - 2), 0.15, 0.15) : null);
        if (!trc)
            return;
        const acquired = trc.occupiedBy === this.id || vpm.occupyTroncon?.(trc.id, this.id) !== false;
        if (acquired) {
            this._occupiedTronconIds.add(trc.id);
            this._lastTronconId = trc.id;
            this._tronconExitTravelKm.delete(trc.id);
            this._cachedTroncon = trc;
        }
        else {
            // Fail closed: never silently resurrect two consists onto one physical section.
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.delayReason = this.train.delayReason || 'ressource physique occupée après rechargement';
            return false;
        }
        return true;
    }
    _reserveOriginSafetyFootprint() {
        if (!this.position)
            return true;
        let ok = true;
        const route = this.getCurrentRoute?.();
        if (Array.isArray(route) && route.length >= 2) {
            const assignments = cantonManager.createRouteCantons(route);
            if (assignments.length) {
                const lengthM = Math.max(1, Number(this.rame?.totalLength || this.train?.length || 20));
                ok = cantonManager.syncFootprint(this.id, assignments, 0, lengthM) !== false;
            }
        }
        const vpm = globalThis.window?.game?.voiePointManager;
        if (vpm) {
            const trc = vpm.getTronconAtPosition?.(this.position, 0.3, this.train?.platform || null, Array.isArray(route) ? this._wayIdsAlong(route, 0, 0.15, 0.15) : null);
            if (trc) {
                const acquired = trc.occupiedBy === this.id || vpm.occupyTroncon?.(trc.id, this.id) !== false;
                if (acquired) {
                    this._occupiedTronconIds.add(trc.id);
                    this._lastTronconId = trc.id;
                    this._tronconExitTravelKm.delete(trc.id);
                    this._cachedTroncon = trc;
                }
                else
                    ok = false;
            }
        }
        if (!ok) {
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.delayReason = this.train.delayReason || 'ressource physique occupée au départ';
        }
        return ok;
    }
    // RC7: a timetable point is not the end of the physical train. Retain
    // approach speed limits until the rear actually clears them, including several
    // short consecutive legs. Later, lower restrictions dominate earlier ones.
    _capturePassageTailSpeedLimits(route) {
        if (!route?.length || route !== this._state?.cachedRoute || !this._state.segDists)
            return;
        const distances = this._state.segDists, speeds = this._resolvedRouteSpeeds(route);
        const lengthKm = Math.max(0, Number(this.rame?.totalLength || this.train?.length || 20)) / 1000;
        const entries = [];
        let behindKm = 0;
        for (let i = distances.length - 1; i >= 0 && behindKm < lengthKm; --i) {
            const limitKmh = Math.min(speeds[i] ?? Infinity, speeds[i + 1] ?? Infinity);
            if (Number.isFinite(limitKmh))
                entries.push({ endTravelKm: Number(this.totalDistance || 0) - behindKm, limitKmh });
            behindKm += distances[i];
        }
        this._getPassageTailSpeedLimit(); // drop expired old-leg entries first
        for (let i = entries.length - 1; i >= 0; --i) {
            const entry = entries[i], queue = this._passageTailSpeedHolds;
            while (queue.length && queue[queue.length - 1].limitKmh >= entry.limitKmh)
                queue.pop();
            queue.push(entry);
        }
    }
    _getPassageTailSpeedLimit() {
        const queue = this._passageTailSpeedHolds || (this._passageTailSpeedHolds = []);
        const tailKm = Number(this.totalDistance || 0) - Math.max(0, Number(this.rame?.totalLength || this.train?.length || 20)) / 1000;
        let expired = 0;
        while (expired < queue.length && tailKm >= queue[expired].endTravelKm)
            ++expired;
        if (expired)
            queue.splice(0, expired);
        return queue[0]?.limitKmh ?? Infinity;
    }
    _captureCantonCarryover() {
        const ids = cantonManager.getTrackedCantons?.(this.id);
        this._carryoverCantonIds = ids?.size ? new Set(ids) : null;
        this._carryoverStartTravelKm = Number(this.totalDistance || 0);
    }
    _syncCantonFootprint(route = this._state?.cachedRoute) {
        if (!this._cantonAssignments?.length || !route?.length)
            return true;
        const frontKm = this._currentFrontKm(route);
        const lengthM = Math.max(1, Number(this.rame?.totalLength || this.train?.length || 20));
        // Old-route blocks remain protected until the train has ACTUALLY travelled
        // one full consist length since the leg/reroute transition. Using absolute
        // progress on the new route released them immediately during mid-line reroutes.
        let retain = null;
        const sinceCarryM = Math.max(0, (Number(this.totalDistance || 0) - Number(this._carryoverStartTravelKm || 0)) * 1000);
        if (this._carryoverCantonIds?.size && sinceCarryM < lengthM)
            retain = this._carryoverCantonIds;
        else if (this._carryoverCantonIds?.size) {
            this._carryoverCantonIds = null;
            this._carryoverStartTravelKm = null;
        }
        return cantonManager.syncFootprint(this.id, this._cantonAssignments, frontKm, lengthM, retain);
    }
    _getRouteProgressKm(pos, route, hintIndex) {
        // v1.1.71 — project on local route SEGMENTS, not a sparse sample of points.
        // The search window is expressed in physical kilometres so a dense 50 km OSM
        // route behaves exactly like a coarse one.
        return this._projectRoutePosition(pos, route, hintIndex, 7).progressKm;
    }
    _wayIdsAround(route, index, radiusKm = 0.6) {
        const out = new Set();
        if (!route?.length)
            return out;
        const i0 = Math.max(0, Math.min(route.length - 1, Number(index) || 0));
        const add = (i) => {
            const id = String(route[i]?.wayId || '');
            if (id)
                out.add(id);
        };
        add(i0);
        add(Math.min(route.length - 1, i0 + 1));
        let acc = 0;
        for (let i = i0 - 1; i >= 0 && acc <= radiusKm; i--) {
            acc += haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
            add(i);
        }
        acc = 0;
        for (let i = i0 + 1; i < route.length && acc <= radiusKm; i++) {
            acc += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
            add(i);
        }
        return out;
    }
    _wayIdsAlong(route, index, aheadKm = 0.6, behindKm = 0.3) {
        const out = new Set();
        if (!route?.length)
            return out;
        const i0 = Math.max(0, Math.min(route.length - 1, Number(index) || 0));
        const add = (i) => {
            const id = String(route[i]?.wayId || '');
            if (id)
                out.add(id);
        };
        add(i0);
        add(Math.min(route.length - 1, i0 + 1));
        let acc = 0;
        for (let i = i0 + 1; i < route.length && acc <= aheadKm; i++) {
            acc += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
            add(i);
        }
        acc = 0;
        for (let i = i0 - 1; i >= 0 && acc <= behindKm; i--) {
            acc += haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
            add(i);
        }
        return out;
    }
    _safetyHorizonKm(speedKmh = this.speed) {
        const vMs = Math.max(0, Number(speedKmh || 0)) / 3.6;
        const fallbackMs2 = Math.max(0.05, Number(this.train?.decel || 2) / 3.6);
        const decelMs2 = Math.max(0.05, Number(this._lastPhysicsDecelMs2 || fallbackMs2));
        const stopM = (vMs * vMs) / (2 * decelMs2);
        const reactionM = vMs * 4;
        return Math.max(2, Math.min(25, (stopM + reactionM + 750) / 1000));
    }
    _safetyCandidatePool(allServices, radiusKm = 6) {
        const game = globalThis.window?.game;
        const fleet = (Array.isArray(allServices) ? allServices : game?.scheduleCreator?.services);
        const grid = game?._serviceGrid;
        const frame = game?._safetyFleetFrame;
        // RC16: neighbour lists and spatial cells are accelerators, never authority.
        // A restore can replace an object with another bearing the same ID. Only a
        // grid built for this exact synchronous fleet may narrow the scan. Outside
        // that frame use the caller's complete, live fleet (including an empty one).
        if (fleet && (!grid?.size || !frame || frame.services !== fleet || frame.length !== fleet.length)) {
            return fleet.filter(s => s && s.id !== this.id);
        }
        const map = new Map();
        let stale = false;
        const add = (list) => {
            for (const s of list || []) {
                if (!s || s.id === this.id)
                    continue;
                if (fleet && frame) {
                    const index = frame.members.get(s);
                    if (index === undefined || fleet[index] !== s) {
                        stale = true;
                        continue;
                    }
                }
                map.set(String(s.id), s);
            }
        };
        add(this._nearbyServices);
        if (grid && this.position) {
            const cell = Number(game?._serviceGridCell) || 0.02;
            const latKey = Math.floor(this.position.lat / cell), lonKey = Math.floor(this.position.lon / cell);
            const latCells = Math.max(1, Math.ceil(radiusKm / Math.max(0.2, cell * 111.32)));
            const lonKm = Math.max(0.2, cell * 111.32 * Math.max(0.15, Math.cos(this.position.lat * Math.PI / 180)));
            const lonCells = Math.max(1, Math.ceil(radiusKm / lonKm));
            for (let a = -latCells; a <= latCells; a++)
                for (let b = -lonCells; b <= lonCells; b++)
                    add(grid.get(`${latKey + a},${lonKey + b}`));
        }
        // Direct edits during a frame invalidate the acceleration, not the railway.
        if (stale && fleet)
            return fleet.filter(s => s && s.id !== this.id);
        if (!grid?.size && fleet)
            add(fleet);
        return [...map.values()];
    }
    _stationaryPhysicalTrackRef() {
        const assignment = this._platformAssignment;
        if (assignment?.source === 'VOIE_POINT')
            return assignment.platform;
        if (assignment?.trackIdentity)
            return assignment.trackIdentity.trackRef || null;
        const stops = this.getCurrentStops();
        const stop = stops[Math.max(0, this.currentStopIndex - 1)];
        if (stop?.trackIdentity)
            return stop.trackIdentity.trackRef || null;
        return this.train.platform == null ? null : String(this.train.platform);
    }
    _findPhysicalLeader(allServices, route, radiusKm = 6) {
        if (!this.position || !route?.length)
            return null;
        const myProj = this._projectRoutePosition(this.position, route, this._state.index, radiusKm + 1);
        const vpm = typeof window !== 'undefined' ? window.game?.voiePointManager : null;
        const myVoie = this.state === 'stopped_at_station' ? this._stationaryPhysicalTrackRef() : (vpm ? vpm.getVoieAtPosition(this.position) : null);
        let best = null;
        // Exact broad phase, recomputed per call: a polyline projection cannot be
        // within 50 m if its latitude lies beyond every segment by >55 m.
        // Short routes only; never traverse an enormous route for this optional check.
        let latitudeBounds;
        const scan = (candidates) => {
            for (const other of (Array.isArray(candidates) ? candidates : [])) {
                if (!other || samePhysicalMovement(other.id, this.id) || !other.position)
                    continue;
                if (other.state === 'completed' || other.state === 'cancelled')
                    continue;
                const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
                if (rawDist > radiusKm)
                    continue;
                if (latitudeBounds === undefined) {
                    latitudeBounds = null;
                    if (route.length <= 2048 && Array.isArray(candidates) && candidates.length >= 4) {
                        let minLat = Infinity, maxLat = -Infinity, valid = true;
                        for (const point of route) {
                            if (!Number.isFinite(point?.lat)) {
                                valid = false;
                                break;
                            }
                            minLat = Math.min(minLat, point.lat);
                            maxLat = Math.max(maxLat, point.lat);
                        }
                        if (valid)
                            latitudeBounds = [minLat - 0.0005, maxLat + 0.0005];
                    }
                }
                if (latitudeBounds && (other.position.lat < latitudeBounds[0] || other.position.lat > latitudeBounds[1]))
                    continue;
                const otherVoie = other.state === 'stopped_at_station' ? (other._stationaryPhysicalTrackRef?.() ?? (other._platformAssignment?.trackIdentity ? null : other.train?.platform)) : (vpm ? vpm.getVoieAtPosition(other.position) : null);
                // OSM way identity is stronger than a fuzzy station voie label. Never let
                // an ambiguous nearest-platform lookup hide a leader proven to be on the
                // same physical OSM way.
                const otherStationary = other.state === 'stopped_at_station';
                const oRoute = (otherStationary
                    ? (other._stationaryRoute || other._getStationaryRoute?.() || other._state?.cachedRoute || other.getCurrentRoute?.())
                    : (other._state?.cachedRoute || other.getCurrentRoute?.()));
                const oIdx = otherStationary && oRoute?.length
                    ? Math.max(0, Math.min(oRoute.length - 2, Number(other._stationaryRouteIndex ?? (oRoute.length - 2))))
                    : Math.max(0, Number(other._state?.index) || 0);
                const otherWayIds = this._wayIdsAlong(oRoute || [], oIdx, 0.30, 0.30);
                // Project the other train onto *our* planned railway first. Track identity
                // must be compared at the SAME longitudinal location. The old code compared
                // our current wayId with a leader's wayId kilometres ahead, so every normal
                // OSM way split could make the leader disappear from safety detection.
                const op = this._projectRoutePosition(other.position, route, myProj.segmentIndex, radiusKm + 1);
                if (op.distanceKm > 0.05 || op.progressKm <= myProj.progressKm)
                    continue;
                const routeWayIdsAtOther = this._wayIdsAlong(route, op.segmentIndex, 0.30, 0.30);
                const wayKnown = routeWayIdsAtOther.size > 0 && otherWayIds.size > 0;
                const wayOverlap = wayKnown && [...routeWayIdsAtOther].some((id) => otherWayIds.has(id));
                if (wayKnown && !wayOverlap)
                    continue;
                if (!wayKnown && myVoie && otherVoie && canonicalTrackRef(myVoie) !== canonicalTrackRef(otherVoie))
                    continue;
                // A stationary consist is a physical obstacle regardless of the
                // direction of its previous/next timetable leg. Heading filtering is
                // meaningful only while the other train is actually moving.
                const otherPhysicalSpeed = Math.max(0, Number(other.speed || other.train?.speed || 0));
                if (otherPhysicalSpeed > 1 && oRoute && oRoute.length > 1 && oIdx < oRoute.length - 1 && myProj.segmentIndex < route.length - 1) {
                    const a = route[myProj.segmentIndex], b = route[myProj.segmentIndex + 1];
                    const oa = oRoute[oIdx], ob = oRoute[oIdx + 1];
                    if (a && b && oa && ob) {
                        const myH = Math.atan2(b.lon - a.lon, b.lat - a.lat);
                        const oH = Math.atan2(ob.lon - oa.lon, ob.lat - oa.lat);
                        let hd = Math.abs(myH - oH);
                        if (hd > Math.PI)
                            hd = 2 * Math.PI - hd;
                        if (hd > Math.PI / 2)
                            continue;
                    }
                }
                const lengthM = Math.max(1, Number(other.rame?.totalLength || other.train?.length || 20));
                const rearGapKm = op.progressKm - myProj.progressKm - lengthM / 1000;
                if (!best || rearGapKm < best.rearGapKm) {
                    // HOTFIX69 — a train which has just left a station keeps its departure
                    // resource until its REAR has cleared the departure point. Propagate
                    // that physical fact to the follower so a train already stopped at the
                    // protecting signal cannot launch at the same instant as the leader.
                    best = {
                        service: other,
                        frontProgressKm: op.progressKm,
                        rearGapKm,
                        leaderSpeedKmh: Math.max(0, Number(other.speed || other.train?.speed || 0)),
                        lengthM,
                        tailClearingDeparture: !!other._departureResourceHold,
                    };
                }
            }
        };
        const pool = this._safetyCandidatePool(allServices, radiusKm);
        scan(pool);
        // Full fallback exists for safety if route grouping/grid missed an immobilised train.
        if (!best && Array.isArray(allServices) && pool.length < allServices.length - 1)
            scan(allServices);
        return best;
    }
    // Last-resort coarse-step guard BEFORE committing route progress. Reuse
    // the leader already found by this tick's proximity check: no extra fleet scan.
    // Braking remains continuous; this is only the hard no-overlap safety bound.
    _clipAdvanceToPhysicalLeader(route, requestedKm) {
        const leader = this._stepPhysicalLeader;
        if (!leader || requestedKm <= 0)
            return requestedKm;
        const frontKm = this._currentFrontKm(route);
        const availableKm = Math.max(0, leader.frontProgressKm - leader.lengthM / 1000 - 0.03 - frontKm);
        if (requestedKm <= availableKm)
            return requestedKm;
        this.speed = Math.min(this.speed, leader.leaderSpeedKmh);
        this.train.speed = Math.round(this.speed);
        if (this.speed <= 0.01)
            this._movementStop('ANTI_OVERLAP_STOP', 'espacement de sécurité', 'proximity');
        else
            this._movementCaution(this.speed, 'ANTI_OVERLAP_CAUTION', 'espacement de sécurité', 'proximity');
        return availableKm;
    }
    _proximityBlockCheck(allServices) {
        this._stepPhysicalLeader = null;
        if (!this.position || !allServices)
            return null;
        const route = this._state.cachedRoute || this.getCurrentRoute();
        if (!route || route.length < 2)
            return null;
        const horizonKm = this._safetyHorizonKm(this.speed);
        const leader = this._findPhysicalLeader(allServices, route, horizonKm);
        this._stepPhysicalLeader = leader;
        if (!leader)
            return null;
        // v1.1.71 — protect the physical REAR of the leader. Add 50 m fixed margin
        // plus three seconds of reaction distance, then derive a continuous safe speed
        // from the braking equation instead of arbitrary 0 / +20 km/h steps.
        const mySpeed = Math.max(0, Number(this.speed || 0));
        // HOTFIX69 — signal-style tail clearance. If this follower is already
        // stopped/creeping behind a departing train, keep it at zero until the
        // leader's complete consist has passed the departure point. Do not impose
        // this hard stop on an approaching train which is still moving; the normal
        // continuous braking/canton logic below remains authoritative for it.
        if (leader.tailClearingDeparture && mySpeed <= 5)
            return 0;
        const fallbackMs2 = Math.max(0.05, Number(this.train?.decel || 2) / 3.6);
        const decel = Math.max(0.05, Number(this._lastPhysicsDecelMs2 || fallbackMs2));
        const reactionKm = mySpeed * 3 / 3600;
        const marginKm = 0.05 + reactionKm;
        if (leader.rearGapKm <= 0.03)
            return 0; // hard 30 m anti-overlap envelope
        const availableM = Math.max(0, (leader.rearGapKm - marginKm) * 1000);
        const leaderMs = leader.leaderSpeedKmh / 3.6;
        const safeKmh = Math.sqrt(Math.max(0, leaderMs * leaderMs + 2 * decel * availableM)) * 3.6;
        if (leader.rearGapKm <= marginKm)
            return Math.min(mySpeed, leader.leaderSpeedKmh);
        return safeKmh < mySpeed ? Math.max(0, safeKmh) : null;
    }
    /**
     * IPCS runtime helpers: stop trains travelling in opposite directions on the same track.
     */
    _getIpcsCandidates(candidates) {
        if (typeof window !== 'undefined' && window.game?._serviceGrid) {
            const grid = window.game._serviceGrid;
            const cellSize = window.game._serviceGridCell || 0.02;
            const latKey = Math.floor(this.position.lat / cellSize);
            const lonKey = Math.floor(this.position.lon / cellSize);
            const list = [];
            for (let dl = -1; dl <= 1; dl++) {
                for (let dn = -1; dn <= 1; dn++) {
                    const cell = grid.get(`${latKey + dl},${lonKey + dn}`);
                    if (cell)
                        list.push(...cell);
                }
            }
            return list;
        }
        return candidates || this._nearbyServices || [];
    }
    _isNearRoute(pos, route, hintIndex = 0) {
        if (!pos || !route || route.length < 2)
            return false;
        const NEAR_KM = 0.15;
        const start = Math.max(0, hintIndex - 50);
        const end = Math.min(route.length, hintIndex + 150);
        for (let i = start; i < end; i++) {
            const dlat = (pos.lat - route[i].lat) * 111;
            const dlon = (pos.lon - route[i].lon) * 111 * Math.cos(pos.lat * Math.PI / 180);
            if (dlat * dlat + dlon * dlon < NEAR_KM * NEAR_KM)
                return true;
        }
        return false;
    }
    _ipcsBlockCheck(candidates = null) {
        if (!this.position || !this._state?.cachedRoute)
            return null;
        const route = this._state.cachedRoute;
        if (route.length < 2)
            return null;
        const myIdx = Math.max(0, Number(this._state.index) || 0);
        if (myIdx >= route.length - 1)
            return null;
        const mySpeed = Math.max(0, Number(this.speed || 0));
        const myDecel = Math.max(0.05, Number(this._lastPhysicsDecelMs2 || (Number(this.train?.decel || 4) / 3.6)));
        const myFrontKm = this._currentFrontKm(route);
        const horizonKm = Math.min(25, this._safetyHorizonKm(mySpeed) * 2);
        const list = this._safetyCandidatePool(candidates, horizonKm);
        const vpm = globalThis.window?.game?.voiePointManager;
        const myVoie = this.state === 'stopped_at_station' ? this._stationaryPhysicalTrackRef() : (vpm ? vpm.getVoieAtPosition(this.position, 0.3) : null);
        let limit = null;
        // Exact broad phase for short polylines: a projected point cannot lie beyond
        // the latitude range of its vertices. 0.0005 degrees is more than 50 m in
        // our projection model, so this only rejects already-outside candidates.
        // Compute lazily, per call (no stale cache after in-place route edits), and
        // never walk a long route just to build this optional acceleration structure.
        let latitudeBounds;
        for (const other of list) {
            if (!other || samePhysicalMovement(other.id, this.id) || !other.position)
                continue;
            if (other.state === 'completed' || other.state === 'cancelled')
                continue;
            const rawDist = haversineDistance(this.position.lat, this.position.lon, other.position.lat, other.position.lon);
            if (rawDist > horizonKm)
                continue;
            if (latitudeBounds === undefined) {
                latitudeBounds = null;
                if (list.length >= 4 && route.length <= 2048) {
                    let minLat = Infinity, maxLat = -Infinity, valid = true;
                    for (const point of route) {
                        if (!Number.isFinite(point?.lat)) {
                            valid = false;
                            break;
                        }
                        minLat = Math.min(minLat, point.lat);
                        maxLat = Math.max(maxLat, point.lat);
                    }
                    if (valid)
                        latitudeBounds = [minLat - 0.0005, maxLat + 0.0005];
                }
            }
            if (latitudeBounds && (other.position.lat < latitudeBounds[0] || other.position.lat > latitudeBounds[1]))
                continue;
            const otherStationary = other.state === 'stopped_at_station';
            const otherRoute = otherStationary
                ? (other._stationaryRoute || other._getStationaryRoute?.() || other._state?.cachedRoute || other.getCurrentRoute?.())
                : (other._state?.cachedRoute || other.getCurrentRoute?.());
            if (!otherRoute || otherRoute.length < 2)
                continue;
            const oi = otherStationary
                ? Math.max(0, Math.min(otherRoute.length - 2, Number(other._stationaryRouteIndex ?? (otherRoute.length - 2))))
                : Math.max(0, Number(other._state?.index) || 0);
            if (oi >= otherRoute.length - 1)
                continue;
            const otherSpeed = Math.max(0, Number(other.speed || other.train?.speed || 0));
            const otherDecel = Math.max(0.05, Number(other._lastPhysicsDecelMs2 || (Number(other.train?.decel || 4) / 3.6)));
            // Use longitudinal conflict distance and the route tangent AT the other
            // train. Current way IDs/headings may differ at an OSM split or a curve.
            const projected = this._projectRoutePosition(other.position, route, myIdx, horizonKm + 1);
            const distanceKm = projected.progressKm - myFrontKm;
            if (projected.distanceKm > 0.05 || distanceKm <= 0 || distanceKm > horizonKm)
                continue;
            const tangentIndex = Math.max(0, Math.min(route.length - 2, projected.segmentIndex));
            const myH = Math.atan2(route[tangentIndex + 1].lon - route[tangentIndex].lon, route[tangentIndex + 1].lat - route[tangentIndex].lat);
            const myWayIds = this._wayIdsAlong(route, tangentIndex, 0.30, 0.30);
            const otherWayIds = this._wayIdsAlong(otherRoute, oi, 0.30, 0.30);
            const wayKnown = myWayIds.size > 0 && otherWayIds.size > 0;
            const wayOverlap = wayKnown && [...myWayIds].some((id) => otherWayIds.has(id));
            if (wayKnown && !wayOverlap)
                continue;
            if (!wayKnown) {
                const otherVoie = other.state === 'stopped_at_station' ? (other._stationaryPhysicalTrackRef?.() ?? (other._platformAssignment?.trackIdentity ? null : other.train?.platform)) : (vpm ? vpm.getVoieAtPosition(other.position, 0.3) : null);
                if (myVoie && otherVoie && canonicalTrackRef(myVoie) !== canonicalTrackRef(otherVoie))
                    continue;
            }
            const oH = Math.atan2(otherRoute[oi + 1].lon - otherRoute[oi].lon, otherRoute[oi + 1].lat - otherRoute[oi].lat);
            let hDiff = Math.abs(myH - oH);
            if (hDiff > Math.PI)
                hDiff = 2 * Math.PI - hDiff;
            if (hDiff <= Math.PI / 2)
                continue; // same direction: leader logic handles it
            const myV = mySpeed / 3.6, otherV = otherSpeed / 3.6;
            const otherStopM = (otherV * otherV) / (2 * otherDecel) + otherV * 3;
            const fixedMarginM = 200; // opposing movements need a real interlocking buffer
            const availableForMeM = distanceKm * 1000 - otherStopM - fixedMarginM - myV * 3;
            if (availableForMeM <= 0)
                return 0;
            const safeKmh = Math.sqrt(Math.max(0, 2 * myDecel * availableForMeM)) * 3.6;
            if (safeKmh < mySpeed)
                limit = Math.min(limit ?? Infinity, Math.max(0, safeKmh));
        }
        return limit;
    }
    /**
     * The distant-train entry point deliberately shares the complete movement
     * controller. LOD may batch elapsed time in main.moveTick, but must not have
     * its own braking, resource ownership, route transition or mileage rules.
     * RC9 duplicated these rules and applied the endpoint brake twice in macro.
     */
    moveMacro(dt, timeOfDay, economy, allServices) {
        this._economy = economy;
        ActiveService.prototype.moveUpdate.call(this, dt, timeOfDay, (Array.isArray(allServices) ? allServices : []));
    }
    // Legacy compatibility
    update(timeOfDay, dateStr, economy, allServices) {
        this._economy = economy;
        this.scheduleTick(timeOfDay, dateStr, economy);
    }
    _canSafelyReversePhysicalRoute(route) {
        if (!Array.isArray(route) || route.length < 2)
            return false;
        let explicit = false;
        for (const p of route) {
            if (!p)
                continue;
            const bi = String(p.bidirectional || p.tags?.['railway:bidirectional'] || '').trim().toLowerCase();
            const service = String(p.service || p.tags?.service || '').trim().toLowerCase();
            const oneway = String(p.oneway || p.tags?.oneway || '').trim().toLowerCase();
            const hasWay = p.wayId != null && p.wayId !== '';
            if (hasWay || bi || service || oneway)
                explicit = true;
            if (['yes', '1', 'true', 'forward', '-1', 'reverse', 'backward'].includes(oneway))
                return false;
            // Main-line OSM geometry is directional unless ORM explicitly marks regular
            // bidirectional running. Service/siding geometry can be traversed both ways
            // when OSM does not mark it one-way.
            if (hasWay && bi !== 'regular' && !service)
                return false;
        }
        // Unknown/manual geometry is not automatically reversible: the player must
        // provide a real independent return trace. This avoids legacy wrong-line runs.
        return explicit;
    }
    _getStationaryRoute() {
        // After an arrival currentStopIndex already points to the NEXT stop, so
        // getCurrentRoute() points to the next leg. Safety needs the approach leg
        // still physically occupied by the stopped consist.
        if (Array.isArray(this._stationaryRoute) && this._stationaryRoute.length >= 2)
            return this._stationaryRoute;
        const legIdx = Number(this.currentStopIndex || 0) - 2;
        if (legIdx < 0)
            return null;
        if (!this.isReturnLeg)
            return this.routes?.[legIdx] || null;
        if (this._returnRoutes?.length)
            return this._returnRoutes[legIdx] || null;
        if (!this.routes?.length)
            return null;
        const routeIdx = this.routes.length - 1 - legIdx;
        const route = this.routes[routeIdx];
        if (!route)
            return null;
        if (!this._canSafelyReversePhysicalRoute(route))
            return null;
        return [...route].reverse();
    }
    getCurrentRoute() {
        const idx = Math.max(0, this.currentStopIndex - 1);
        if (this.isReturnLeg) {
            // SC-04 — use an independent return geometry when provided; otherwise
            // fall back to reversing the forward legs.
            if (this._returnRoutes && this._returnRoutes.length) {
                return this._returnRoutes[idx] || null;
            }
            if (!this.routes || this.routes.length === 0)
                return null;
            const routeIdx = this.routes.length - 1 - idx;
            const route = this.routes[routeIdx];
            if (!route)
                return null;
            // v1.1.73 — never manufacture a return mainline path by reversing the
            // outbound OSM polyline. On double track that is literally wrong-line
            // running. Only legacy/manual geometry or explicitly regular-bidirectional
            // OSM track may be safely reversed; otherwise a real return route is required.
            if (!this._canSafelyReversePhysicalRoute(route)) {
                this.train.delayReason = 'tracé retour ORM requis';
                return null;
            }
            return [...route].reverse();
        }
        if (!this.routes || this.routes.length === 0)
            return null;
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
            const speeds = this._resolvedRouteSpeeds(route);
            return Math.min(speeds[idx] ?? Infinity, speeds[idx + 1] ?? Infinity);
        }
        // Fallback: find nearest point on route
        const route = this.getCurrentRoute();
        if (!route || route.length === 0)
            return 300;
        let minDist = Infinity;
        let bestSpeed = this.train.maxSpeed || 160;
        const resolved = this._resolvedRouteSpeeds(route);
        for (let i = 0; i < route.length; i++) {
            const pt = route[i];
            if (!this.position)
                break;
            const d = haversineDistance(this.position.lat, this.position.lon, pt.lat, pt.lon);
            if (d < minDist) {
                minDist = d;
                bestSpeed = resolved[i] || bestSpeed;
            }
        }
        return bestSpeed;
    }
    getWorksSpeedLimit(timeOfDay) {
        if (!this.world)
            return null;
        const currentStops = this.getCurrentStops();
        if (this.currentStopIndex <= 0 || this.currentStopIndex >= currentStops.length)
            return null;
        const route = this._state.cachedRoute;
        if (!route || route.length < 2)
            return null;
        const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
        const dateStr = this._currentDate || (typeof window !== 'undefined' && window.game?._currentDate) || '';
        const worksRevision = (typeof window !== 'undefined' && window.game?.worksManager?.revision) || 0;
        const progressBucket = Math.floor(this._currentFrontKm(route) * 10); // 100 m; restrictions are spatial, not minute-global
        const cacheKey = `${legKey}|${dateStr}|${Math.floor(timeOfDay)}|${route.length}|${worksRevision}|p${progressBucket}`;
        if (this._state.worksLimitCache && this._state.worksLimitCache.key === cacheKey) {
            return this._state.worksLimitCache.limit;
        }
        const limit = this._computeWorksLimit(route, dateStr, timeOfDay);
        this._state.worksLimitCache = { key: cacheKey, limit };
        return limit;
    }
    _distanceAheadToRestriction(route, restriction) {
        const poly = restriction?.route || [];
        if (!Array.isArray(route) || route.length < 2)
            return Infinity;
        const frontKm = this._currentFrontKm(route);
        const cum = this._routeCumulativeKm(route);
        const idx0 = Math.max(0, Math.min(route.length - 1, Number(this._state?.index) || 0));
        // HOTFIX46 — station-only works are spatially located at the station rather
        // than being treated as if they began at the train. This lets through trains
        // brake for / respect a station work even when the station is not a booked stop.
        if (restriction?.stationOnly) {
            const stationId = String(restriction.stationId || restriction.stationA || '');
            const st = this.world?.getStationById?.(stationId)
                || (Number.isFinite(Number(restriction.stationLat)) && Number.isFinite(Number(restriction.stationLon))
                    ? { lat: Number(restriction.stationLat), lon: Number(restriction.stationLon) } : null);
            if (!st)
                return Infinity;
            for (let i = idx0; i < route.length - 1; i++) {
                const d = this._pointToSegmentDistKm(Number(st.lat), Number(st.lon), route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
                if (d <= 0.12)
                    return Math.max(0, Number(cum[i] || 0) - frontKm);
            }
            return Infinity;
        }
        // Legacy/station-pair works have no precise ORM geometry: by definition they
        // already cover the current leg and therefore begin at the train, not at Infinity.
        if (!Array.isArray(poly) || poly.length < 1)
            return 0;
        const workWays = new Set(poly.map((p) => String(p?.wayId || '')).filter(Boolean));
        if (workWays.size) {
            for (let i = idx0; i < route.length; i++) {
                if (workWays.has(String(route[i]?.wayId || '')))
                    return Math.max(0, Number(cum[i] || 0) - frontKm);
            }
            return Infinity;
        }
        // Geometry fallback for old/manual work zones: scan ahead with covering chords.
        const step = Math.max(1, Math.ceil((route.length - idx0) / 600));
        const polyStep = Math.max(1, Math.ceil(poly.length / 80));
        for (let i = idx0; i < route.length; i += step) {
            const p = route[i];
            let d = Infinity;
            for (let j = 0; j < poly.length - 1; j += polyStep) {
                const j2 = Math.min(poly.length - 1, j + polyStep);
                d = Math.min(d, this._pointToSegmentDistKm(p.lat, p.lon, poly[j].lat, poly[j].lon, poly[j2].lat, poly[j2].lon));
            }
            if (d <= 0.04)
                return Math.max(0, Number(cum[i] || 0) - frontKm);
        }
        return Infinity;
    }
    _computeWorksLimit(route, dateStr, timeOfDay) {
        const blocking = this._getBlockingWorksForRoute(route, dateStr, timeOfDay);
        this._worksClosureAhead = false;
        if (blocking.length === 0)
            return null;
        const limits = [];
        const horizonM = this._safetyHorizonKm(this.speed) * 1000;
        for (const w of blocking) {
            const aheadKm = this._distanceAheadToRestriction(route, w);
            if (!Number.isFinite(aheadKm))
                continue;
            const aheadM = aheadKm * 1000;
            const isClosure = w.impact === 'stop' || (w.speedLimit === 0 && w.impact !== 'power-off');
            const powerBlocks = w.impact === 'power-off' && this._isElectricOnly();
            if (isClosure || powerBlocks) {
                this._worksClosureAhead = true;
                // Do NOT stop a train because a closure exists 40 km away. Follow one
                // physical braking curve to the work-zone boundary while alternate-route
                // search runs asynchronously.
                if (aheadM <= horizonM)
                    limits.push(this._brakingCurveCapKmh(aheadM, 0, this._carreMarginM));
                continue;
            }
            if (w.impact === 'power-off')
                continue;
            const target = Number.isFinite(Number(w.speedLimit)) ? Math.max(0, Number(w.speedLimit)) : 40;
            // Inside the restriction -> target limit. Ahead -> only begin slowing when
            // physically necessary to enter it at the target speed.
            limits.push(aheadM <= 5 ? target : this._brakingCurveCapKmh(aheadM, target, 30));
        }
        return limits.length ? Math.min(...limits) : null;
    }
    // TRV-06 — helpers for route/works intersection and alternate routing
    _pointToSegmentDistKm(pLat, pLon, aLat, aLon, bLat, bLon) {
        const cosLat = Math.cos(pLat * Math.PI / 180);
        const dx = (bLon - aLon) * 111 * cosLat;
        const dy = (bLat - aLat) * 111;
        const px = (pLon - aLon) * 111 * cosLat;
        const py = (pLat - aLat) * 111;
        const segLenSq = dx * dx + dy * dy;
        if (segLenSq < 0.0001)
            return Math.sqrt(px * px + py * py);
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
        const projX = t * dx, projY = t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }
    _minDistToPolyline(lat, lon, polyline) {
        if (!polyline || polyline.length < 2)
            return Infinity;
        let minD = Infinity;
        for (let i = 0; i < polyline.length - 1; i++) {
            const d = this._pointToSegmentDistKm(lat, lon, polyline[i].lat, polyline[i].lon, polyline[i + 1].lat, polyline[i + 1].lon);
            if (d < minD)
                minD = d;
        }
        return minD;
    }
    _routeIntersectsPolyline(route, polyline, bufferKm = 0.1) {
        if (!route || route.length < 2 || !polyline || polyline.length < 2)
            return false;
        for (const p of route) {
            if (this._minDistToPolyline(p.lat, p.lon, polyline) <= bufferKm)
                return true;
        }
        for (const p of polyline) {
            if (this._minDistToPolyline(p.lat, p.lon, route) <= bufferKm)
                return true;
        }
        return false;
    }
    _routesShareOsmWay(route, polyline) {
        const a = new Set((route || []).map((p) => p?.wayId != null ? String(p.wayId) : '').filter(Boolean));
        const b = new Set((polyline || []).map((p) => p?.wayId != null ? String(p.wayId) : '').filter(Boolean));
        if (!a.size || !b.size)
            return null; // caller may fall back to geometry
        for (const id of a)
            if (b.has(id))
                return true;
        return false;
    }
    _isFallbackRoute(route) {
        return Array.isArray(route) && route.length > 0 && route.some((p) => p && p.fallback);
    }
    _getBlockingWorksForRoute(route, dateStr, timeOfDay) {
        const blocking = [];
        if (!route || route.length < 2 || !this.world)
            return blocking;
        const currentStops = this.getCurrentStops();
        const prevId = currentStops[this.currentStopIndex - 1]?.stationId;
        const nextId = currentStops[this.currentStopIndex]?.stationId;
        const worksMgr = typeof window !== 'undefined' && window.game?.worksManager;
        // With Travaux V2, world-track flags are only a coarse visual projection.
        // Runtime must use the exact zone geometry below or a closure on voie 1
        // would incorrectly block a parallel voie 2 in the same legacy track object.
        if (!worksMgr?.getActiveRestrictions) {
            for (const track of this.world.tracks) {
                if (!track.worksActive)
                    continue;
                const poly = track.route;
                if (poly && poly.length >= 2) {
                    if (!this._routeIntersectsPolyline(route, poly, 0.1))
                        continue;
                }
                else if (prevId && nextId) {
                    const pairMatches = (track.stationA === prevId && track.stationB === nextId) || (track.stationA === nextId && track.stationB === prevId);
                    if (!pairMatches)
                        continue;
                }
                else
                    continue;
                blocking.push({ impact: track.worksImpact || 'stop', speedLimit: track.worksSpeedLimit, stationOnly: undefined, stationId: undefined, stationLat: undefined, stationLon: undefined, stationA: track.stationA, stationB: track.stationB, route: track.route });
            }
        }
        if (worksMgr) {
            // v1.1.64 — Travaux V2 exposes exact ORM restrictions per zone.  Do not
            // collapse a multi-track chantier back into one station-to-station track.
            const restrictions = worksMgr.getActiveRestrictions
                ? worksMgr.getActiveRestrictions(dateStr, timeOfDay)
                : worksMgr.getActive(dateStr, timeOfDay);
            for (const w of restrictions) {
                const poly = w.route || w.manualRoute;
                if (w.stationOnly) {
                    const stationId = String(w.stationId || w.stationA || '');
                    const st = this.world?.getStationById?.(stationId)
                        || (Number.isFinite(Number(w.stationLat)) && Number.isFinite(Number(w.stationLon))
                            ? { id: stationId, lat: Number(w.stationLat), lon: Number(w.stationLon) } : null);
                    const adjacent = stationId && (String(prevId || '') === stationId || String(nextId || '') === stationId);
                    const routePassesStation = !!(st && route?.length >= 2 && this._minDistToPolyline(Number(st.lat), Number(st.lon), route) <= 0.12);
                    if (!adjacent && !routePassesStation)
                        continue;
                }
                else if (poly && poly.length >= 2) {
                    const sharedWay = this._routesShareOsmWay(route, poly);
                    if (sharedWay === false)
                        continue;
                    if (sharedWay == null && !this._routeIntersectsPolyline(route, poly, 0.015))
                        continue;
                    // HOTFIX40 — works sections are bidirectional by default, but a player may
                    // explicitly constrain an LTV/closure to A→B or B→A only.
                    if (!railSectionDirectionMatchesRoute(route, w))
                        continue;
                }
                else if (prevId && nextId) {
                    const pairMatches = (w.stationA === prevId && w.stationB === nextId) || (w.stationA === nextId && w.stationB === prevId);
                    if (!pairMatches)
                        continue;
                }
                else
                    continue;
                blocking.push({
                    impact: w.impact || 'stop',
                    speedLimit: Number.isFinite(w.speedLimit) ? w.speedLimit : 40,
                    stationOnly: !!w.stationOnly, stationId: w.stationId || w.stationA || '', stationLat: w.stationLat, stationLon: w.stationLon,
                    stationA: w.stationA || '', stationB: w.stationB || '',
                    route: poly || [], startBinding: w.startBinding || null, endBinding: w.endBinding || null, direction: w.direction || 'both', workId: w.workId || w.id || '', zoneId: w.zoneId || ''
                });
            }
        }
        return blocking;
    }
    async _findAlternateRoute(prevId, nextId, dateStr, timeOfDay) {
        const prev = this.world?.getStationById(prevId);
        const next = this.world?.getStationById(nextId);
        if (!prev || !next)
            return null;
        const orm = typeof window !== 'undefined' && window.game?.orm ? window.game.orm : null;
        if (!orm)
            return null;
        const blocking = this._getBlockingWorksForRoute(this._state.cachedRoute, dateStr, timeOfDay);
        if (blocking.length === 0)
            return null;
        const avoidPairs = blocking.map((w) => {
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
        if (direct && !this._isFallbackRoute(direct) && this._getBlockingWorksForRoute(direct, dateStr, timeOfDay).length === 0)
            return direct;
        // Then: try detours via nearby stations
        const mid = { lat: (prev.lat + next.lat) / 2, lon: (prev.lon + next.lon) / 2 };
        const candidates = this.world.stations
            .filter((s) => s.id !== prevId && s.id !== nextId)
            .map((s) => ({ s, d: haversineDistance(s.lat, s.lon, mid.lat, mid.lon) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 12);
        for (const { s } of candidates) {
            const via = await orm.findConstrainedRoute(prev.lat, prev.lon, next.lat, next.lon, [{ lat: s.lat, lon: s.lon }], { avoidStationPairs: avoidPairs });
            if (via && !this._isFallbackRoute(via) && this._getBlockingWorksForRoute(via, dateStr, timeOfDay).length === 0)
                return via;
        }
        return null;
    }
    _startAlternateRouteSearch(timeOfDay, dateStr) {
        const currentStops = this.getCurrentStops();
        if (this.currentStopIndex <= 0 || this.currentStopIndex >= currentStops.length)
            return;
        const prev = currentStops[this.currentStopIndex - 1];
        const next = currentStops[this.currentStopIndex];
        if (!prev || !next)
            return;
        const legKey = `${this.currentStopIndex}-${this.isReturnLeg ? 1 : 0}`;
        const key = `${legKey}|${dateStr || ''}|${Math.floor(timeOfDay / 5)}`;
        if (this._pendingAltRoute && this._pendingAltRoute.key === key && !this._pendingAltRoute.completed)
            return;
        if (this._altRouteFailedKeys.has(key))
            return;
        const search = { key, completed: false, route: null, failed: false };
        this._pendingAltRoute = search;
        this._findAlternateRoute(prev.stationId, next.stationId, dateStr, timeOfDay)
            .then((route) => { search.route = route; search.completed = true; if (!route)
            this._altRouteFailedKeys.add(key); })
            .catch(() => { search.completed = true; search.failed = true; this._altRouteFailedKeys.add(key); });
    }
    _applyAlternateRoute(route, timeOfDay) {
        if (!route || route.length < 2)
            return;
        this._captureCantonCarryover();
        this._initializeState(route, this._state.legKey);
        this._state.worksLimitCache = null;
        this._pendingAltRoute = null;
        this._altRouteFailedKeys.clear();
        this._movementGo();
        this.train.delayReason = 'déroutement';
        this.train.state = 'moving';
    }
    arriveAtStation(station, timeOfDay, economy) {
        // Ensure economy ref is available after save/reload too. A restored service
        // can already be moving, so main intentionally skips scheduleTick(); without
        // this global fallback the first post-F5 arrival lost all stop accounting.
        if (!economy)
            economy = this._economy || globalThis.window?.game?.economy || null;
        if (economy)
            this._economy = economy;
        const stops = this.getCurrentStops();
        const stop = stops[this.currentStopIndex];
        // CVO-04 : quand un EVO arrive à destination, le service principal peut partir
        if (this.serviceType === 'evo' && this._evoForServiceId) {
            const passenger = window.game?.scheduleCreator?.services.find((s) => s.id === this._evoForServiceId);
            if (passenger) {
                passenger._evoCompleted = true;
                passenger._evoServiceId = null;
            }
        }
        // v1.1.73 fail-closed arrival boundary. Even direct/macro/fallback paths
        // must obey the V2 passenger no-advance rule and must reserve the physical
        // arrival track before waiting at the endpoint.
        if (this._holdForBookedArrival(timeOfDay))
            return;
        if (station && stop?.type === 'arret' && !this._reserveArrivalResources(station, stop)) {
            this.speed = 0;
            this.train.speed = 0;
            this._movementStop('RUNTIME_STOP', this.train.delayReason || 'arrêt de sécurité');
            this.train.delayReason = 'attente voie libre en gare';
            return;
        }
        const scheduleNow = this._v2ScheduleNowMinutes(this._currentDate, timeOfDay);
        // Only update delay based on actual arret stops, not waypoints/passages
        if (stop?.type === 'arret') {
            const expectedTime = stop.arrivalTime;
            if (expectedTime != null) {
                const measuredDelay = this._scheduleDiff(scheduleNow, expectedTime);
                this.delay = this._isPassengerService() ? Math.max(0, measuredDelay) : measuredDelay;
            }
            this.train.delay = this.delay;
        }
        // A native resource can represent an entire platform. Reserving it must
        // never teleport an ORM-bound berth to that resource's representative marker.
        let arrivalLat = station.lat, arrivalLon = station.lon;
        const boundLat = stop?.trackIdentity?.lat ?? stop?.lat;
        const boundLon = stop?.trackIdentity?.lon ?? stop?.lon;
        if (stop?.trackIdentity?.kind === 'osm' && boundLat != null && boundLon != null
            && Number.isFinite(Number(boundLat)) && Number.isFinite(Number(boundLon))) {
            arrivalLat = Number(boundLat);
            arrivalLon = Number(boundLon);
        }
        else if (window.game?.voiePointManager && stop) {
            // Priority 1: use the exact voie point from the stop
            if (stop.voiePointId) {
                const vp = window.game.voiePointManager.getVoiePointById(stop.voiePointId);
                if (vp) {
                    arrivalLat = vp.lat;
                    arrivalLon = vp.lon;
                }
            }
            // Priority 2: look up by station + platform name
            else if (stop.platform) {
                const svp = window.game.voiePointManager.getStationVoiePoint(station.id, stop.platform);
                if (svp) {
                    arrivalLat = svp.lat;
                    arrivalLon = svp.lon;
                }
            }
        }
        this.position = { lat: arrivalLat, lon: arrivalLon };
        this._movementGo();
        this._lastArrivalTime = scheduleNow;
        this._currentTimeOfDay = timeOfDay;
        // DEP-05 : mise à jour de la localisation permanente de la rame
        if (this.rame) {
            this.rame.currentLocation = {
                ...materialTrackLocation(stop),
                stationId: (station?.id || ''),
                depotId: '', // RC2: home depot is affiliation, not physical presence.
                serviceId: this.id,
                lat: arrivalLat,
                lon: arrivalLon,
            };
        }
        // Section VI — ITE : longueur utile, tranches et compatibilité fret.
        // ITE is an ancillary gameplay system: malformed legacy ITE data must never
        // abort the physical arrival state transition. Start from a neutral state and
        // isolate every external manager call behind one guarded side-effect block.
        this._iteDwellExtra = 0;
        this._iteCargoMismatch = false;
        this._iteHardBlock = false;
        this.train.iteInfo = null;
        if (stop?.type === 'arret' && station) {
            try {
                const dm = globalThis.window?.game?.depotManager;
                const trainLengthRaw = this.rame ? this.rame.totalLength : (this.train.length || 20);
                const trainLength = Number.isFinite(Number(trainLengthRaw)) ? Math.max(0, Number(trainLengthRaw)) : 20;
                const rameCargo = this.rame?.elementDetails?.find((e) => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0)?.cargoTypes?.[0] || '';
                const iteInfo = dm?.getITEInfo(station.id, trainLength, rameCargo);
                if (iteInfo?.isITE) {
                    const iteMods = globalThis.window?.game?.iteModules;
                    // ITE modules are keyed by the ITE/depot id, not by the gameplay station id.
                    // Older runtime code used station.id here, so purchased cranes/loading/shunting
                    // upgrades were visible in the Depot page but had no effect on real dwell time.
                    const iteModuleId = String(iteInfo.depotId || '');
                    const loadingRaw = iteModuleId ? iteMods?.getLoadingSpeedMultiplier?.(iteModuleId) : 1;
                    const shuntingRaw = iteModuleId ? iteMods?.getShuntingSpeedMultiplier?.(iteModuleId) : 1;
                    const loadingMult = Number.isFinite(Number(loadingRaw)) && Number(loadingRaw) > 0 ? Number(loadingRaw) : 1;
                    const shuntingMult = Number.isFinite(Number(shuntingRaw)) && Number(shuntingRaw) > 0 ? Number(shuntingRaw) : 1;
                    const craneRaw = iteModuleId ? iteMods?.getCraneCount?.(iteModuleId) : 0;
                    const craneCount = Number.isFinite(Number(craneRaw)) ? Math.max(0, Math.floor(Number(craneRaw))) : 0;
                    const totalLength = Number.isFinite(Number(iteInfo.totalLength)) ? Math.max(0, Number(iteInfo.totalLength)) : 0;
                    const trancheCount = Number.isFinite(Number(iteInfo.trancheCount)) ? Math.max(1, Math.floor(Number(iteInfo.trancheCount))) : 1;
                    const canFit = iteInfo.canFit !== false;
                    this.train.iteInfo = { totalLength, trainLength, trancheCount, canFit, cargoMatch: iteInfo.cargoMatch, craneCount };
                    this._iteCargoMismatch = iteInfo.cargoMatch === false;
                    // A train longer than the useful track is handled in successive tranches;
                    // that is exactly what trancheCount/trancheManeuver model. Only an ITE
                    // with no usable track is a true hard block.
                    this._iteHardBlock = iteInfo.usable === false || totalLength <= 0;
                    if (this._iteHardBlock)
                        this.train.delayReason = 'ITE : aucune voie utile';
                    const cargo = String(rameCargo || '').toLowerCase();
                    let factor = 1.0;
                    if (/citerne|gaz|gas|liquide/.test(cargo))
                        factor = 1.5;
                    else if (/intermodal|container|conteneur|porte-auto|tomber/.test(cargo))
                        factor = 2.5;
                    else if (/cereals|cereale|ciment|cement|silos|tremie|trémie/.test(cargo))
                        factor = 1.2;
                    const loadUnload = Math.ceil(factor * (trainLength / 100) * (canFit ? 1 : 1.2) * loadingMult);
                    const trancheManeuver = canFit ? 0 : Math.ceil((trancheCount - 1) * 10 * shuntingMult);
                    this._iteDwellExtra = Math.max(0, loadUnload + trancheManeuver);
                }
            }
            catch (e) {
                this._iteDwellExtra = 0;
                this._iteCargoMismatch = false;
                this._iteHardBlock = false;
                this.train.iteInfo = null;
                console.warn('ITE arrival side effect ignored:', e);
            }
        }
        // Per-stop revenue: montée/descente voyageurs + chargement/déchargement fret
        if (economy && stop?.type === 'arret') {
            const firstArretIdx = stops.findIndex((s) => s.type === 'arret');
            const lastArretIdx = stops.length - 1 - [...stops].reverse().findIndex((s) => s.type === 'arret');
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
                        const route = this._routeForStopIndex(seg + 1);
                        if (route && route.length >= 2) {
                            for (const p of route)
                                legRoute.push(p);
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
                    if (distFromPrev <= 0)
                        distFromPrev = 20; // ultimate fallback
                }
            }
            try {
                economy.processStopRevenue(this, station.name, distFromPrev, isFirst, isTerminus, String(station.id), legRoute);
            }
            catch (e) {
                console.warn('Economy arrival side effect ignored:', e);
            }
        }
        // For passage and waypoint stops, maintain speed (no stop-and-go)
        const isPassThrough = this._isPassThroughStop(stop);
        if (isPassThrough) {
            // Keep current speed, just update position and continue
            this.train.stoppedAt = null;
            this.state = 'moving';
            this.train.state = 'moving';
        }
        else {
            this.speed = 0;
            this.train.speed = 0;
            this.train.stoppedAt = station;
            this.state = 'stopped_at_station';
            this.train.state = 'stopped_at_station';
            if (this.train._stoppedSinceGameTime == null) {
                this.train._stoppedSinceGameTime = scheduleNow;
            }
            // MNT-03 : pannes bénignes réparables en gare sans technicentre
            if (this.train.breakdown && ['climatisation', 'portes'].includes(this.train.breakdown.type)) {
                this.delay = (this.delay ?? 0) + 5;
                this.train.delay = this.delay;
                this.train.breakdown = null;
            }
        }
        // Keep canton + arrival-track resources while the consist is physically
        // stopped. _reserveArrivalResources() already made the assignment atomically.
        // Troncon footprint is handled separately by the voie manager.
        if (this._isPassengerService())
            globalThis.window?.game?.connections?.onArrival(this, stop, timeOfDay, this._currentDate);
        if (this._v2OccurrenceId && typeof this._v2OnArrive === 'function') {
            try {
                this._v2OnArrive(stop, station, timeOfDay);
            }
            catch (e) {
                console.warn('V2 rotation action:', e);
            }
        }
        this.currentStopIndex++;
        // v1.1.73 — retain the exact approach geometry while physically stopped.
        // _resetState() prepares the next leg, but leader detection behind the train
        // must still know which OSM way the stationary consist actually occupies.
        this._stationaryRoute = this._state?.cachedRoute || this._stationaryRoute || null;
        this._stationaryRouteIndex = this._stationaryRoute?.length ? Math.max(0, this._stationaryRoute.length - 2) : 0;
        // RC7: a passage has no later departure tick to capture its rear footprint.
        // Retain the approach cantons until the full consist clears onto the new leg.
        if (isPassThrough)
            this._captureCantonCarryover();
        // Rear speed limits survive ordinary intermediate station stops too. The
        // platform dwell does not move the rear clear of its approach restriction.
        this._capturePassageTailSpeedLimits(this._state?.cachedRoute);
        // Reset simulation state for next leg
        this._resetState();
        if (stop?.turnBack)
            this._turnbackDepartureReady(stop, timeOfDay, this._currentDate);
        if (this.currentStopIndex >= stops.length) {
            // RC2: no-operation trains still despawn at arrival. completeService keeps
            // a consist physically present until its terminal operations have finished.
            this.completeService(economy, station, arrivalLat, arrivalLon);
        }
    }
    _releaseAllPhysicalResources() {
        cantonManager.releaseAll(this.id);
        const game = globalThis.window?.game;
        const vpm = game?.voiePointManager;
        if (vpm) {
            vpm.releaseAllVoiePointsForTrain(this.id);
            vpm.releaseAllForTrain(this.id);
        }
        if (this._platformAssignment && game?.platformManager && this._platformAssignment.source !== 'VOIE_POINT') {
            game.platformManager.releasePlatform(this._platformAssignment.stationId, this.id);
        }
        this._platformAssignment = null;
        this._departureResourceHold = null;
        this._carryoverCantonIds = null;
        this._carryoverStartTravelKm = null;
        this._passageTailSpeedHolds = [];
        this._occupiedTronconIds.clear();
        this._tronconExitTravelKm.clear();
        this._lastTronconId = null;
        this._reservedTronconId = null;
        this._stationaryRoute = null;
        this._stationaryRouteIndex = 0;
        this.train.platform = null;
    }
    _terminalOperationPending() {
        const stops = this.getCurrentStops();
        const op = this._v2OperationState;
        return !!(this._v2OccurrenceId && this.currentStopIndex >= stops.length && op &&
            op.locationOccurrenceId === stops[stops.length - 1]?.locationOccurrenceId &&
            (!op.completed || op.failed));
    }
    completeService(economy, station = null, arrivalLat = null, arrivalLon = null) {
        // Commercial arrival does not remove the consist while a detach/attach or
        // change-locomotive operation still occupies the terminal track.
        if (this._terminalOperationPending()) {
            this.state = 'stopped_at_station';
            this.train.state = 'stopped_at_station';
            this.speed = 0;
            this.train.speed = 0;
            this._movementStop(this._v2OperationState?.failed ? 'ROTATION_OPERATION_FAILED' : 'ROTATION_OPERATION', this._v2OperationWaitingMaterial ? 'opérations au terminus : attente matériel' : 'opérations au terminus', 'rotation');
            return;
        }
        const terminalStop = this.getCurrentStops().at(-1);
        if (terminalStop?.turnBack && !this._turnbackDepartureReady(terminalStop, Number(this._currentTimeOfDay ?? this._lastArrivalTime ?? 0), this._currentDate)) {
            this.state = 'stopped_at_station';
            this.train.state = 'stopped_at_station';
            return;
        }
        const completedTrack = materialTrackLocation(terminalStop);
        globalThis.window?.game?.freightManager?.finishServiceCargo?.(this);
        if (!this.revenueCollected && economy) {
            try {
                economy.processServiceRevenue(this);
            }
            catch (e) {
                console.warn('Economy completion side effect ignored:', e);
            }
            // Revenue/accounting must never be able to keep a physically completed
            // train alive forever. Mark the attempt consumed even if an optional
            // accounting hook failed; the error is logged and the service completes.
            this.revenueCollected = true;
        }
        // A workshop may have serviced the material since this duty was prepared.
        // Completing an old duty must not write its stale counters back to the rame.
        if (this.rame)
            syncMaterialMileage(this.rame, this.train);
        const rng = getGlobalRng();
        if (this.roundTrip && !this.isReturnLeg) {
            // Section OCC — retard au terminus : 1/3 de supprimer le retour, 2/3 de le faire rouler en retard
            // RET-03 : si supprimé, la rame reste à la gare et repart au prochain trajet prévu depuis cette gare
            if ((this.delay ?? 0) > 0 && rng.random() < 1 / 3) {
                this.state = 'cancelled';
                this.cancelled = true;
                this.speed = 0;
                this.train.speed = 0;
                this.delay = 0;
                this.train.delay = 0;
                this.completed = true;
                this.completedDate = this._currentDate || '';
                this._finishLegacyOperatingDay();
                this.train.stoppedAt = station || this.train.stoppedAt;
                if (this.rame) {
                    this.rame.currentLocation = {
                        ...completedTrack,
                        stationId: (station?.id || this.rame.currentLocation?.stationId || ''),
                        depotId: '', // RC2: home depot is affiliation, not physical presence.
                        serviceId: '',
                        lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
                        lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
                    };
                }
                this._releaseAllPhysicalResources();
                this.position = null;
                return;
            }
            this.returnStops = this.buildReturnStops();
            this.isReturnLeg = true;
            this.currentStopIndex = 0;
            this._tripCount = (this._tripCount || 0) + 1;
            // Switch to return name if defined
            if (this.returnName)
                this.train.name = this.returnName;
            // SC-03 — return leg shows the even number.
            if (this.returnNumber != null)
                this.train.number = String(this.returnNumber);
            // Start the return leg immediately (schedule as stopped_at_station for terminus wait)
            this.state = 'stopped_at_station';
            this.speed = 0;
            this.train.speed = 0;
            this.train.state = 'waiting';
            this._movementGo();
            // Reset delay for the return leg
            this.delay = 0;
            this.train.delay = 0;
            this._atTerminus = true;
            // Set next departure time based on terminus wait
            this._nextDepartureTime = (this._lastArrivalTime || 0) + this.terminusWait;
            this._turnbackDepartureReady(this.getCurrentStops()[0], Number(this._lastArrivalTime || 0), this._currentDate, true);
            return;
        }
        // Check for multi round-trip (additional departures)
        if (this.roundTrip && this.isReturnLeg && this.multiDepartures && this._tripCount < this.multiDepartures) {
            // Section OCC — retard au terminus : 1/3 de supprimer le trajet suivant, 2/3 de le faire rouler en retard
            // RET-03 : si supprimé, la rame reste à la gare et repart au prochain trajet prévu depuis cette gare
            if ((this.delay ?? 0) > 0 && rng.random() < 1 / 3) {
                this.state = 'cancelled';
                this.cancelled = true;
                this.speed = 0;
                this.train.speed = 0;
                this.delay = 0;
                this.train.delay = 0;
                this.completed = true;
                this.completedDate = this._currentDate || '';
                this._finishLegacyOperatingDay();
                this.train.stoppedAt = station || this.train.stoppedAt;
                if (this.rame) {
                    this.rame.currentLocation = {
                        ...completedTrack,
                        stationId: (station?.id || this.rame.currentLocation?.stationId || ''),
                        depotId: '', // RC2: home depot is affiliation, not physical presence.
                        serviceId: '',
                        lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
                        lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
                    };
                }
                this._releaseAllPhysicalResources();
                this.position = null;
                return;
            }
            this.isReturnLeg = false;
            this.currentStopIndex = 0;
            // Switch back to forward name
            this.train.name = this.name;
            // SC-03 — forward leg shows the odd number.
            if (this.number != null)
                this.train.number = String(this.number);
            this.state = 'stopped_at_station';
            this.speed = 0;
            this.train.speed = 0;
            this.train.state = 'waiting';
            this._movementGo();
            this.revenueCollected = false;
            // Reset delay for next trip
            this.delay = 0;
            this.train.delay = 0;
            this._atTerminus = true;
            this._nextDepartureTime = (this._lastArrivalTime || 0) + this.terminusWait;
            this._turnbackDepartureReady(this.stops[0], Number(this._lastArrivalTime || 0), this._currentDate, true);
            // Rebuild forward stops with adjusted times for new trip
            this._adjustedStops = this._rebuildStopsFromTime(this._nextDepartureTime);
            if (this.stops.length > 0 && this.world) {
                const firstStation = this.world.getStationById(this.stops[0].stationId);
                if (firstStation) {
                    if (!this.position)
                        this.position = { lat: arrivalLat ?? firstStation.lat, lon: arrivalLon ?? firstStation.lon };
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
        this._movementGo();
        this.delay = 0;
        this.train.delay = 0;
        this._atTerminus = false;
        this.completed = true;
        this.completedDate = this._currentDate || '';
        this._finishLegacyOperatingDay();
        this.isReturnLeg = false;
        this.revenueCollected = false;
        this._tripCount = 0;
        this._adjustedStops = null;
        this.train.stoppedAt = station || this.train.stoppedAt;
        // RET-03 : à la fin du trajet, la rame reste à la dernière gare pour le prochain service
        if (this.rame) {
            this.rame.currentLocation = {
                ...completedTrack,
                stationId: (station?.id || this.rame.currentLocation?.stationId || ''),
                // depotId is PHYSICAL presence only. Home depot is this.rame.depotId.
                depotId: '',
                serviceId: '',
                lat: arrivalLat ?? this.rame.currentLocation?.lat ?? null,
                lon: arrivalLon ?? this.rame.currentLocation?.lon ?? null,
            };
        }
        this._releaseAllPhysicalResources();
        this.position = null;
        this.train.stoppedAt = null;
        this.train.platform = null;
    }
    _rebuildStopsFromTime(departureTime) {
        const offset = departureTime - (this.stops[0]?.departureTime || 0);
        return this.stops.map((s) => {
            const dep = ((s.departureTime || 0) + offset) % 1440;
            const arr = ((s.arrivalTime || 0) + offset) % 1440;
            return new ServiceStop(s.stationId, s.type, dep < 0 ? dep + 1440 : dep, arr < 0 ? arr + 1440 : arr, s.voiePointId, s.platform, s.stopCode, { ...materialTrackLocation(s), lat: s.lat, lon: s.lon, turnBack: s.turnBack });
        });
    }
    // ARR-04/05 — for each circulation, randomly skip bracketed [C]/[S] stops.
    // Skipped arrets are treated as waypoints (no braking / no dwell / no revenue).
    _buildAdjustedStops(sourceStops = this.stops, rng = Math.random) {
        return sourceStops.map((s) => {
            let skip = false;
            if (this._v2OccurrenceId && s.locationOccurrenceId && this._v2OptionalStopDecisions) {
                skip = this._v2OptionalStopDecisions[s.locationOccurrenceId] === true;
            }
            else if (s.type === 'arret' && s.stopCode) {
                // Legacy creator keeps its historical draw. V2 stores its 50/50 result
                // on the ScheduleOccurrence so save/reload cannot reroll it.
                skip = shouldSkipStop(s.stopCode, rng);
            }
            if (s.turnBack)
                skip = false;
            const extra = {
                absoluteTime: !!this._v2OccurrenceId, lat: s.lat, lon: s.lon,
                locationOccurrenceId: s.locationOccurrenceId,
                technicalLocationId: s.technicalLocationId,
                locationName: s.locationName,
                v2OperationSec: s.v2OperationSec, trackIdentity: s.trackIdentity, turnBack: s.turnBack,
            };
            if (s.type === 'arret' && skip) {
                const adjusted = new ServiceStop(s.stationId, 'waypoint', s.departureTime, s.arrivalTime, s.voiePointId, s.platform, s.stopCode, extra);
                adjusted._skipped = true;
                return adjusted;
            }
            return new ServiceStop(s.stationId, s.type, s.departureTime, s.arrivalTime, s.voiePointId, s.platform, s.stopCode, extra);
        });
    }
    buildReturnStops() {
        // Build the return from the original (non-adjusted) forward stops so
        // skippable [C]/[S] draws are independent on the return leg.
        const fwdStops = this.stops;
        if (!fwdStops || fwdStops.length === 0)
            return [];
        // SC-04 — independent return timetable when the player defined one:
        // preserve its own inter-stop deltas, anchored at terminus + wait.
        if (this._returnStopsData && this._returnStopsData.length) {
            return this._buildIndependentReturnStops(fwdStops);
        }
        const reversed = [...fwdStops].reverse();
        const lastStop = fwdStops[fwdStops.length - 1];
        const lastArrival = lastStop.arrivalTime ?? lastStop.departureTime ?? 0;
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
                    travelTime = forwardClockMinutes(fwdStops[origIdxCurr].departureTime ?? fwdStops[origIdxCurr].arrivalTime, fwdStops[origIdxPrev].arrivalTime ?? fwdStops[origIdxPrev].departureTime);
                }
                if (!Number.isFinite(travelTime))
                    travelTime = 15;
            }
            const arrTime = currentTime + travelTime;
            const depTime = arrTime + (i > 0 && stop.type === 'arret' ? 2 : 0);
            currentTime = depTime;
            // RC11: changing direction does not move the train to the neighbouring track.
            const returnPlat = this.returnPlatforms?.[stop.stationId] ?? stop.platform;
            const sameTrack = canonicalTrackRef(returnPlat) === canonicalTrackRef(stop.platform);
            const explicitNative = !sameTrack ? globalThis.window?.game?.voiePointManager?.getStationVoiePoint(stop.stationId, returnPlat) : null;
            const physical = sameTrack ? materialTrackLocation(stop) : materialTrackLocation({ voiePointId: explicitNative?.id, platform: returnPlat });
            const rs = new ServiceStop(stop.stationId, stop.type, depTime, arrTime, physical.voiePointId, returnPlat, stop.stopCode, { ...physical, lat: sameTrack ? stop.lat : explicitNative?.lat, lon: sameTrack ? stop.lon : explicitNative?.lon, turnBack: stop.turnBack });
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
        return data.map((s) => {
            const dep = anchor + ((s.departureTime ?? s.arrivalTime ?? 0) - base);
            const arr = anchor + ((s.arrivalTime ?? s.departureTime ?? 0) - base);
            return new ServiceStop(s.stationId, s.type, wrap(dep), wrap(arr), s.voiePointId, s.platform, s.stopCode, { ...materialTrackLocation(s), lat: s.lat, lon: s.lon, turnBack: s.turnBack });
        });
    }
}
export class ScheduleCreator {
    constructor() {
        this.services = [];
        this.weather = null; // set by game
    }
    addService(data, rame, world) {
        const svc = new ActiveService((data && typeof data === 'object' ? data : {}), rame, world, this.weather);
        const freight = typeof window !== 'undefined' ? window.game?.freightManager : null;
        if (svc.assignedContractId && freight) {
            const contract = freight.contracts.find((c) => c.id === svc.assignedContractId);
            const check = freight.validateAssignment(contract, svc);
            if (!check.ok)
                throw new Error(check.message);
        }
        this.services.push(svc);
        this._invalidateActiveCache();
        return svc;
    }
    // CVO-04 : génère automatiquement un service EVO (garage/gare → gare de départ) si la rame n'est pas sur place
    ensureEVOForService(svc, world, timeOfDay) {
        // V2: no automatic EVO. Positioning is explicitly the player's responsibility.
        if (svc._v2OccurrenceId)
            return null;
        if (svc.serviceType === 'evo' || svc._evoCreated || svc._evoCompleted)
            return null;
        if (!svc.rame || !svc.stops?.length || !svc.active) {
            svc._evoCreated = true;
            return null;
        }
        const firstStop = svc.stops[0];
        if (!firstStop?.stationId) {
            svc._evoCreated = true;
            return null;
        }
        const targetStation = world?.getStationById(firstStop.stationId);
        if (!targetStation) {
            svc._evoCreated = true;
            return null;
        }
        const current = svc.rame.currentLocation || {};
        if (current.stationId === targetStation.id) {
            svc._evoCompleted = true;
            return null;
        }
        const depotManager = window.game?.depotManager;
        let fromStation = current.stationId ? world.getStationById(current.stationId) : null;
        let fromLat = current.lat ?? null;
        let fromLon = current.lon ?? null;
        if (!fromStation && current.depotId && depotManager) {
            const depot = depotManager.getDepotById(current.depotId);
            if (depot?.stationId)
                fromStation = world.getStationById(depot.stationId);
        }
        if (!fromStation && svc.rame.depotId && depotManager) {
            const depot = depotManager.getDepotById(svc.rame.depotId);
            if (depot?.stationId)
                fromStation = world.getStationById(depot.stationId);
        }
        if (!fromStation) {
            svc._evoCreated = true;
            return null;
        }
        if (fromLat == null || fromLon == null) {
            fromLat = fromStation.lat;
            fromLon = fromStation.lon;
        }
        // Automatic EVO must never invent railway geometry. This legacy synchronous
        // helper cannot await ORM, so if no already-resolved real route is available
        // it aborts cleanly instead of drawing a diagonal connector.
        let route = [];
        const orm = window.game?.orm;
        if (orm?._ensureGraph && orm?.findNearestNode && orm?.dijkstra) {
            try {
                const graph = orm._ensureGraph();
                const a = graph && orm.findNearestNode(graph, fromLat, fromLon, 5), b = graph && orm.findNearestNode(graph, targetStation.lat, targetStation.lon, 5);
                const resolved = (a && b) ? orm.dijkstra(graph, a.node.key, b.node.key, { allowFallback: false }) : null;
                if (Array.isArray(resolved) && resolved.length >= 2 && !orm.isFallbackRoute(resolved))
                    route = resolved;
            }
            catch (e) {
                route = [];
            }
        }
        if (route.length < 2) {
            svc._evoCreated = true;
            console.warn('EVO automatique annulé : aucun trajet ORM réel déjà chargé.');
            return null;
        }
        let distKm = 0;
        for (let i = 1; i < route.length; i++) {
            distKm += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
        }
        const avgSpeed = 30;
        const travelMin = Math.max(5, Math.ceil((distKm / avgSpeed) * 60) + 5);
        const firstDep = firstStop.departureTime;
        if (timeGte(timeOfDay, firstDep)) {
            svc._evoCreated = true;
            return null;
        } // too late
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
        const src = this.services.find((s) => s.id === id);
        if (!src)
            return [];
        const created = [];
        for (let i = 1; i <= count; i++) {
            const offset = intervalMin * i;
            const newName = incrementTrailingNumber(src.name, 2 * i);
            const shiftStops = (stops) => stops.map((st) => ({
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
        if (requestedCount <= 1)
            return [];
        const created = [];
        const shiftStops = (stops, offset) => stops.map((st) => ({
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
        const svc = this.services.find((s) => s.id === id);
        if (svc) {
            svc._releaseAllPhysicalResources?.();
            globalThis.window?.game?.freightManager?.finishServiceCargo?.(svc);
        }
        this.services = this.services.filter((s) => s.id !== id);
        this._invalidateActiveCache();
    }
    getActiveServices() {
        if (this._activeCache && this._activeCacheVer === this._serviceVer)
            return this._activeCache;
        this._activeCache = this.services.filter((s) => s.active);
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
            if (!svc.active || svc.completed || svc.cancelled)
                continue;
            this._addToTickIndexes(svc, timeOfDay);
        }
    }
    _addToTickIndexes(svc, timeOfDay) {
        if (svc._v2OccurrenceId)
            return;
        if (svc._legacyOriginEligible?.(Number(timeOfDay)) === false)
            return;
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
            }
            else if (svc.state === 'waiting' && svc.currentStopIndex === 0) {
                const firstDep = currentFirst.departureTime ?? currentFirst.time;
                if (firstDep != null) {
                    const now = svc._v2ScheduleNowMinutes(svc._currentDate, Number(timeOfDay));
                    const diff = svc._scheduleDiff(now, firstDep);
                    if (diff >= -2 && diff <= 5)
                        rEntry.waiting.set(svc.id, firstDep);
                }
            }
        }
        // HOTFIX69 — a departure immobilised by its OWN stop incident must not
        // become a station-wide priority lock. It remains a real physical obstacle
        // on its occupied track/platform, but unrelated departures can keep running.
        const hardDepartureIncident = svc.train?.incident?.effect === 'stop';
        if (svc.serviceType === 'passager' && !hardDepartureIncident && svc.state !== 'moving' && svc.state !== 'departing' && currentFirst && svc.currentStopIndex === 0) {
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
            if (rEntry.moving === svc.id)
                rEntry.moving = null;
            rEntry.waiting.delete(svc.id);
        }
        const currentFirst = svc._getCurrentFirstStop();
        if (currentFirst?.stationId != null) {
            const sEntry = this._stationPriority?.get(currentFirst.stationId);
            if (sEntry)
                sEntry.map.delete(svc.id);
        }
    }
    // Refresh indexes for a single service after its scheduleTick has run.
    updateServiceIndexes(svc, timeOfDay) {
        if (!this._rameUsage)
            return;
        this._removeFromTickIndexes(svc);
        this._addToTickIndexes(svc, timeOfDay);
    }
    isRameInUse(rameId, excludeId, timeOfDay) {
        if (!rameId)
            return false;
        // Determine the excluded service's own first departure so we can order
        // multiple waiting services instead of mutually blocking each other.
        const excludedSvc = this.getActiveServices().find((s) => s.id === excludeId);
        const excludedFirst = excludedSvc?._getCurrentFirstStop();
        const myDep = excludedFirst?.departureTime ?? excludedFirst?.time;
        const blocks = (otherId, otherDep) => {
            if (otherId === excludeId)
                return false;
            if (myDep == null || otherDep == null)
                return true;
            const d = timeDiff(otherDep, myDep);
            if (d < 0)
                return true; // other departs earlier
            if (d === 0 && otherId < excludeId)
                return true; // same time, lower id first
            return false;
        };
        // Fallback if beginTick was not called (e.g. unit tests calling directly).
        if (!this._rameUsage || this._indexTime !== timeOfDay) {
            for (const svc of this.getActiveServices()) {
                if (svc.id === excludeId)
                    continue;
                if (svc.rameId !== rameId)
                    continue;
                if (svc.completed || svc._legacyOriginEligible?.(Number(timeOfDay)) === false)
                    continue;
                if (svc.state === 'moving' || svc.state === 'stopped_at_station' || svc.state === 'departing')
                    return true;
                if (svc.state === 'waiting' && svc.currentStopIndex === 0) {
                    const currentFirst = svc._getCurrentFirstStop();
                    const firstDep = currentFirst?.departureTime ?? currentFirst?.time;
                    if (firstDep != null) {
                        const now = svc._v2ScheduleNowMinutes(svc._currentDate, Number(timeOfDay));
                        const diff = svc._scheduleDiff(now, firstDep);
                        if (diff >= -2 && diff <= 5 && blocks(svc.id, firstDep))
                            return true;
                    }
                }
            }
            return false;
        }
        const entry = this._rameUsage.get(rameId);
        if (!entry)
            return false;
        if (entry.moving && entry.moving !== excludeId)
            return true;
        for (const [id, dep] of entry.waiting) {
            if (id === excludeId)
                continue;
            const diff = timeDiff(timeOfDay, dep);
            if (diff >= -2 && diff <= 5 && blocks(id, dep))
                return true;
        }
        return false;
    }
    // Returns the active passenger service with the earliest due departure at the station.
    getEarliestDueServiceAtStation(stationId, timeOfDay) {
        if (!this._stationPriority || this._indexTime !== timeOfDay)
            return null;
        const sEntry = this._stationPriority.get(stationId);
        if (!sEntry || sEntry.map.size === 0)
            return null;
        let minId = null;
        let minDep = null;
        for (const [id, dep] of sEntry.map) {
            // Defensive guard for an incident that appeared after beginTick() built
            // the index: never let that train poison every later departure this tick.
            const indexedSvc = this.services?.find?.((svc) => svc.id === id);
            if (indexedSvc?.train?.incident?.effect === 'stop' || (indexedSvc && indexedSvc._legacyOriginEligible?.(Number(timeOfDay)) === false))
                continue;
            if (!timeGte(timeOfDay, dep))
                continue;
            // OCC-03 : un train bloqué depuis plus de 5 min ne doit plus bloquer les départs suivants à jamais
            if (timeDiff(timeOfDay, dep) > 5)
                continue;
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
        if (this._movingCache && this._movingCacheVer === this._serviceVer)
            return this._movingCache;
        const active = this.getActiveServices();
        this._movingCache = active.filter((s) => s.state === 'moving' || s.state === 'departing');
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
    // RC17 — compact integer deltas plus exact-coordinate exceptions. Preserve
    // the original IEEE coordinates so save/reload cannot perturb a braking
    // threshold or change the number of random-draw physics steps.
    _encodeRouteForSave(route) {
        if (!Array.isArray(route) || route.length === 0)
            return null;
        const q = 1e6;
        const coords = [];
        const exactCoords = [];
        let prevLat = 0, prevLon = 0;
        const speeds = [];
        let hasCustomSpeed = false;
        const wayDict = [];
        const wayMap = new Map();
        const wayIdx = [];
        const wayMeta = [];
        const fallbackSpeedIdx = [];
        const directions = [];
        let hasDirection = false;
        const electrification = [];
        let hasElectrification = false;
        const inclines = [];
        for (let i = 0; i < route.length; i++) {
            const pt = route[i] || {};
            const latQ = Math.round(Number(pt.lat || 0) * q);
            const lonQ = Math.round(Number(pt.lon || 0) * q);
            if (latQ / q !== Number(pt.lat) || lonQ / q !== Number(pt.lon))
                exactCoords.push([i, Number(pt.lat), Number(pt.lon)]);
            if (i === 0)
                coords.push(latQ, lonQ);
            else
                coords.push(latQ - prevLat, lonQ - prevLon);
            prevLat = latQ;
            prevLon = lonQ;
            const sp = Number.isFinite(Number(pt.maxSpeed)) ? Number(pt.maxSpeed) : 30;
            speeds.push(sp);
            if (sp !== 30)
                hasCustomSpeed = true;
            if (String(pt.maxSpeedSource || '') === 'FALLBACK_30')
                fallbackSpeedIdx.push(i);
            const wid = pt.wayId != null && pt.wayId !== '' ? String(pt.wayId) : '';
            let wi = 0;
            if (wid) {
                if (!wayMap.has(wid)) {
                    wayMap.set(wid, wayDict.length + 1);
                    wayDict.push(wid);
                    wayMeta.push({
                        s: pt.service || pt.tags?.service || '',
                        u: pt.usage || pt.tags?.usage || '',
                        o: pt.oneway || pt.tags?.oneway || '',
                        b: pt.bidirectional || pt.tags?.['railway:bidirectional'] || '',
                        r: pt.trackRef || pt.ref || pt.tags?.ref || '',
                    });
                }
                wi = wayMap.get(wid);
            }
            wayIdx.push(wi);
            const td = String(pt.travelDirection || '').toLowerCase();
            const dc = td === 'backward' ? -1 : (td === 'forward' ? 1 : 0);
            directions.push(dc);
            if (dc)
                hasDirection = true;
            const ec = pt.electrified === true ? 1 : (pt.electrified === false ? 0 : -1);
            electrification.push(ec);
            if (ec !== -1)
                hasElectrification = true;
            const rawIncline = pt.tags?.incline ?? pt.incline;
            if (rawIncline != null && rawIncline !== '')
                inclines.push([i, String(rawIncline)]);
        }
        const out = { c: coords, q: 6 };
        if (exactCoords.length)
            out.rc = exactCoords;
        if (hasCustomSpeed)
            out.s = speeds;
        if (fallbackSpeedIdx.length)
            out.f = fallbackSpeedIdx;
        if (wayDict.length) {
            out.wd = wayDict;
            out.w = wayIdx;
            out.wm = wayMeta;
        }
        if (hasDirection)
            out.d = directions;
        if (hasElectrification)
            out.e = electrification;
        if (inclines.length)
            out.i = inclines;
        return out;
    }
    _runtimeRouteRef(service, route) {
        if (!service || !Array.isArray(route))
            return null;
        const fi = (service.routes || []).indexOf(route);
        if (fi >= 0)
            return { s: 'f', i: fi };
        const ri = (service._returnRoutes || []).indexOf(route);
        if (ri >= 0)
            return { s: 'r', i: ri };
        return null;
    }
    _runtimeRouteFromRef(service, ref, encoded = null) {
        if (ref?.s === 'f')
            return service.routes?.[Number(ref.i)] || null;
        if (ref?.s === 'r')
            return service._returnRoutes?.[Number(ref.i)] || null;
        if (encoded)
            return (this._decodeRoutes([encoded])?.[0] || null);
        return null;
    }
    toSave() {
        // V2 runtime services are deterministic products of rotations and are rebuilt
        // from scheduleV2/rotationsV2; persisting them would re-introduce rameId coupling.
        return this.services.filter((s) => !s._v2OccurrenceId).map((s) => {
            try {
                // Compact route encoding preserving the complete physical ORM track.
                const safeRoutes = (s.routes || []).map((route) => this._encodeRouteForSave(route)).filter(Boolean);
                const safeReturnRoutes = (s._returnRoutes || []).map((route) => this._encodeRouteForSave(route)).filter(Boolean);
                // Compact stops: short keys
                const compactStops = (s.stops || []).map((st) => {
                    const o = { si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime };
                    if (st.voiePointId)
                        o.vp = st.voiePointId;
                    if (st.platform)
                        o.p = st.platform;
                    if (st.stopCode)
                        o.sc = st.stopCode;
                    if (st.trackIdentity)
                        o.ti = normalizeStationTrackIdentity(st.trackIdentity);
                    if (st.turnBack)
                        o.tb = true;
                    if (st.lat != null && st.lon != null) {
                        o.la = st.lat;
                        o.lo = st.lon;
                    }
                    return o;
                });
                const compactReturnStops = (s._returnStopsData || []).map((st) => {
                    const o = { si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime };
                    if (st.voiePointId)
                        o.vp = st.voiePointId;
                    if (st.platform)
                        o.p = st.platform;
                    if (st.stopCode)
                        o.sc = st.stopCode;
                    if (st.trackIdentity)
                        o.ti = normalizeStationTrackIdentity(st.trackIdentity);
                    if (st.turnBack)
                        o.tb = true;
                    if (st.lat != null && st.lon != null) {
                        o.la = st.lat;
                        o.lo = st.lon;
                    }
                    return o;
                });
                const o = { id: s.id, n: s.name, ri: s.rameId, st: compactStops, rt: safeRoutes, _r: {} };
                if (s.roundTrip)
                    o.rnd = true;
                if (s.multiDepartures > 1)
                    o.md = s.multiDepartures;
                if (s.terminusWait !== DEFAULT_TERMINUS_WAIT_MIN)
                    o.tw = s.terminusWait;
                // SC-03 — persist auto numbers so they survive reloads.
                if (s.number != null)
                    o.num = s.number;
                if (s.returnNumber != null)
                    o.rnum = s.returnNumber;
                o.td = Math.round((s.totalDistance || 0) * 10000) / 10000; // v1.1.73: 0.1 m precision, tail-release safe after F5
                if (s.plannedDistance)
                    o.pd = s.plannedDistance;
                if (!s.active)
                    o.act = false;
                if (s.serviceType && s.serviceType !== 'passager')
                    o.svt = s.serviceType;
                if (s.isWorkTrain)
                    o.wt = true;
                if (s.assignedContractId)
                    o.ac = s.assignedContractId;
                const allDays = [0, 1, 2, 3, 4, 5, 6];
                if (JSON.stringify(s.runDays) !== JSON.stringify(allDays))
                    o.rd = s.runDays;
                if (s.runDates?.length)
                    o.rdt = s.runDates;
                if (s.returnName)
                    o.rn = s.returnName;
                if (s.returnPlatforms && Object.keys(s.returnPlatforms).length)
                    o.rp = s.returnPlatforms;
                if (safeReturnRoutes.length)
                    o.rtrt = safeReturnRoutes;
                if (compactReturnStops.length)
                    o.rst = compactReturnStops;
                // Runtime state (compact)
                o._r = {
                    ci: s.currentStopIndex || 0,
                    dir: s.direction || 1,
                    tc: s._tripCount || 0,
                    st: s.state || 'waiting',
                    sp: Number(s.speed || 0),
                    dl: Number(s.delay ?? 0),
                    dr: s.train?.delayReason || '',
                    idr: Array.isArray(s.train?.incidentDelayReasons)
                        ? s.train.incidentDelayReasons.map((r) => ({
                            incidentId: r.incidentId, typeId: r.typeId || '', text: r.text || '',
                            startDelay: Number(r.startDelay || 0), lastDelay: Number(r.lastDelay || 0),
                            endDelay: Number(r.endDelay || 0), active: !!r.active, contributed: !!r.contributed,
                        }))
                        : [],
                    cf: s._contractFreight || 0,
                    cgid: s._contractCargoId || '',
                    cd: s._contractDelivered || 0,
                    cm: s.completed || false,
                    cn: s.cancelled || false,
                    cdt: s.completedDate || '',
                    lod: s._legacyOperatingDay || '',
                    lfd: s._legacyLastFinishedDay || '',
                    ih: s._iteHardBlock || false,
                    ie: s._iteDwellExtra || 0,
                    // v1.1.73 — enough runtime state to resume the exact leg instead of
                    // silently restarting an outbound trip after reload.
                    ir: !!s.isReturnLeg,
                    tb: normalizeTurnbackState(s._turnbackState),
                    nd: s._nextDepartureTime ?? null,
                    at: !!s._atTerminus,
                    ri: Number(s._state?.index || 0),
                    rg: Number(s._state?.progress || 0),
                    lk: s._state?.legKey || null,
                    pa: s._platformAssignment ? {
                        si: s._platformAssignment.stationId || '',
                        p: s._platformAssignment.platform ?? null,
                        vp: s._platformAssignment.voiePointId || null,
                        src: s._platformAssignment.source || '',
                        ti: normalizeStationTrackIdentity(s._platformAssignment.trackIdentity), dn: s._platformAssignment.displayName || '',
                    } : null,
                    op: Number(s._onboardPax || 0),
                    pk: Number(s._onboardPassengerKm || 0),
                    of: Number(s._onboardFreight || 0),
                    bs: s._blockedSinceGameTime ?? null,
                    ss: s.train?._stoppedSinceGameTime ?? null,
                    pth: (s._passageTailSpeedHolds || []).map(h => ({ ...h })),
                    be: Number(s._brakeEffort || 0),
                    te: Number(s._tractiveEffort || 0),
                    pd: Number(s._lastPhysicsDecelMs2 || 0),
                    dk: Number(s.totalDistance || 0),
                    dh: s._departureResourceHold ? {
                        si: s._departureResourceHold.stationId || '', p: s._departureResourceHold.platform ?? null,
                        src: s._departureResourceHold.platformSource || '', vp: s._departureResourceHold.voiePointId || null,
                        st: Number(s._departureResourceHold.startTravelKm || 0),
                        ti: normalizeStationTrackIdentity(s._departureResourceHold.trackIdentity), dn: s._departureResourceHold.displayName || '',
                    } : null,
                };
                if (s._stationaryRoute?.length) {
                    const sr = this._runtimeRouteRef(s, s._stationaryRoute);
                    if (sr)
                        o._r.sr = sr;
                    else
                        o._r.sx = this._encodeRouteForSave(s._stationaryRoute);
                }
                // Save position for mid-journey restore
                if (s.position) {
                    o._r.pos = [s.position.lat, s.position.lon];
                }
                if (s._adjustedStops) {
                    o._r.as = s._adjustedStops.map((st) => ({
                        si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime,
                        vp: st.voiePointId, p: st.platform, ti: normalizeStationTrackIdentity(st.trackIdentity), la: st.lat, lo: st.lon, tb: st.turnBack,
                    }));
                }
                return o;
            }
            catch (e) {
                console.warn('Error saving service', s.id, s.name, e);
                return { id: s.id, name: s.name, rameId: s.rameId, stops: [], routes: [], active: false, _saveError: true };
            }
        });
    }
    _decodeRoutes(routes) {
        if (!routes || !Array.isArray(routes))
            return [];
        return routes.map((r) => {
            // Compact format. q=6 is the v1.1.73 physical-track schema; absent q
            // means the old q=5 format and remains backward-compatible.
            if (r && r.c && Array.isArray(r.c)) {
                const pts = [];
                let lat = 0, lon = 0;
                const div = r.q === 6 ? 1e6 : 1e5;
                const fallbackSet = new Set(Array.isArray(r.f) ? r.f.map(Number) : []);
                const inclineMap = new Map(Array.isArray(r.i) ? r.i.map((x) => [Number(x?.[0]), x?.[1]]) : []);
                for (let i = 0; i < r.c.length; i += 2) {
                    if (i === 0) {
                        lat = r.c[0];
                        lon = r.c[1];
                    }
                    else {
                        lat += r.c[i];
                        lon += r.c[i + 1];
                    }
                    const n = i / 2;
                    const pt = { lat: lat / div, lon: lon / div, maxSpeed: 30, tracks: 1 };
                    if (r.s && r.s[n] !== undefined)
                        pt.maxSpeed = Number(r.s[n]);
                    if (fallbackSet.has(n))
                        pt.maxSpeedSource = 'FALLBACK_30';
                    else if (r.q === 6)
                        pt.maxSpeedSource = 'OSM';
                    else
                        pt.maxSpeedSource = 'LEGACY_SAVE';
                    const wi = Number(r.w?.[n] || 0);
                    if (wi > 0 && r.wd?.[wi - 1] != null) {
                        pt.wayId = String(r.wd[wi - 1]);
                        const wm = r.wm?.[wi - 1] || {};
                        if (wm.s)
                            pt.service = wm.s;
                        if (wm.u)
                            pt.usage = wm.u;
                        if (wm.o)
                            pt.oneway = wm.o;
                        if (wm.b)
                            pt.bidirectional = wm.b;
                        if (wm.r)
                            pt.trackRef = wm.r;
                    }
                    const dc = Number(r.d?.[n] || 0);
                    if (dc === 1)
                        pt.travelDirection = 'forward';
                    else if (dc === -1)
                        pt.travelDirection = 'backward';
                    const ec = r.e?.[n];
                    if (ec === 1)
                        pt.electrified = true;
                    else if (ec === 0)
                        pt.electrified = false;
                    if (inclineMap.has(n))
                        pt.incline = inclineMap.get(n);
                    pts.push(pt);
                }
                if (Array.isArray(r.rc))
                    for (const item of r.rc) {
                        if (!Array.isArray(item) || item.length !== 3)
                            continue;
                        const [index, a, b] = item;
                        if (Number.isInteger(index) && index >= 0 && index < pts.length && typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
                            pts[index].lat = a;
                            pts[index].lon = b;
                        }
                    }
                return pts;
            }
            // Old format: array of {lat, lon, maxSpeed, ...}
            if (Array.isArray(r))
                return r;
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
                stops: (d.st || []).map((s) => ({
                    stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
                    voiePointId: s.vp || null, platform: s.p || '', stopCode: s.sc || '',
                    trackIdentity: normalizeStationTrackIdentity(s.ti), lat: s.la, lon: s.lo, turnBack: s.tb === true,
                })),
                routes: this._decodeRoutes(d.rt || []),
                returnStops: (d.rst || []).map((s) => ({
                    stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
                    voiePointId: s.vp || null, platform: s.p || '', stopCode: s.sc || '',
                    trackIdentity: normalizeStationTrackIdentity(s.ti), lat: s.la, lon: s.lo, turnBack: s.tb === true,
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
                runDays: d.rd || [0, 1, 2, 3, 4, 5, 6],
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
                    delayReason: d._r.dr || '',
                    incidentDelayReasons: Array.isArray(d._r.idr) ? d._r.idr : [],
                    position: d._r.pos || null,
                    _adjustedStops: d._r.as ? d._r.as.map((s) => ({
                        stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a,
                        voiePointId: s.vp, platform: s.p, trackIdentity: normalizeStationTrackIdentity(s.ti), lat: s.la, lon: s.lo, turnBack: s.tb === true,
                    })) : null,
                    _contractFreight: d._r.cf || 0,
                    _contractCargoId: d._r.cgid ?? d.ac ?? '',
                    _contractDelivered: d._r.cd || 0,
                    completed: d._r.cm || false,
                    cancelled: d._r.cn || false,
                    completedDate: d._r.cdt || '',
                    operatingDate: d._r.lod || '',
                    lastFinishedOperatingDate: d._r.lfd || '',
                    cm: d._r.cm || false,
                    cn: d._r.cn || false,
                    cdt: d._r.cdt || '',
                    iteHardBlock: d._r.ih || false,
                    iteDwellExtra: d._r.ie || 0,
                    isReturnLeg: !!d._r.ir,
                    turnbackState: normalizeTurnbackState(d._r.tb),
                    nextDepartureTime: d._r.nd ?? null,
                    atTerminus: !!d._r.at,
                    stateIndex: Number(d._r.ri || 0),
                    stateProgress: Number(d._r.rg || 0),
                    legKey: d._r.lk || null,
                    platformAssignment: d._r.pa ? {
                        stationId: d._r.pa.si || '', platform: d._r.pa.p ?? null,
                        voiePointId: d._r.pa.vp || null, source: d._r.pa.src || '',
                        trackIdentity: normalizeStationTrackIdentity(d._r.pa.ti), displayName: d._r.pa.dn || '',
                    } : null,
                    onboardPax: Number(d._r.op || 0),
                    onboardPassengerKm: Number(d._r.pk || 0),
                    onboardFreight: Number(d._r.of || 0),
                    blockedSinceGameTime: d._r.bs ?? null,
                    stoppedSinceGameTime: d._r.ss ?? null,
                    passageTailSpeedHolds: normalizePassageTailSpeedHolds(d._r.pth),
                    brakeEffort: Number(d._r.be || 0),
                    tractiveEffort: Number(d._r.te || 0),
                    physicsDecelMs2: Number(d._r.pd || 0),
                    distanceKm: Number.isFinite(Number(d._r.dk)) ? Number(d._r.dk) : null,
                    departureResourceHold: d._r.dh ? {
                        stationId: d._r.dh.si || '', platform: d._r.dh.p ?? null, platformSource: d._r.dh.src || '',
                        voiePointId: d._r.dh.vp || null, startTravelKm: Number(d._r.dh.st || 0),
                        trackIdentity: normalizeStationTrackIdentity(d._r.dh.ti), displayName: d._r.dh.dn || '',
                    } : null,
                    stationaryRouteRef: d._r.sr || null,
                    stationaryRouteEncoded: d._r.sx || null,
                };
            }
            return expanded;
        }
        // Old format — just decode routes
        if (d.routes)
            d.routes = this._decodeRoutes(d.routes);
        return d;
    }
    loadFromSave(input, rameManager, world, timeOfDay = 0, dateStr = '') {
        const arr = Array.isArray(input) ? input : [];
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
                svc._legacyOperatingDay = civilDayIndex(rt.operatingDate) != null ? String(rt.operatingDate) : '';
                svc._legacyLastFinishedDay = civilDayIndex(rt.lastFinishedOperatingDate) != null ? String(rt.lastFinishedOperatingDate) : '';
                svc.direction = rt.direction || 1;
                svc._tripCount = rt._tripCount || 0;
                svc._iteHardBlock = rt.iteHardBlock || false;
                svc._iteDwellExtra = rt.iteDwellExtra || 0;
                svc.isReturnLeg = !!rt.isReturnLeg;
                svc._turnbackState = normalizeTurnbackState(rt.turnbackState);
                svc._nextDepartureTime = rt.nextDepartureTime ?? null;
                svc._atTerminus = !!rt.atTerminus;
                const emptyMovement = ['w', 'hlp', 'tm', 'm-', 'evo'].includes(String(svc.serviceType || '').toLowerCase());
                svc._onboardPax = emptyMovement ? 0 : Number(rt.onboardPax || 0);
                svc._onboardPassengerKm = emptyMovement ? 0 : Math.max(0, Number(rt.onboardPassengerKm || 0));
                svc._onboardFreight = emptyMovement ? 0 : Number(rt.onboardFreight || 0);
                svc._blockedSinceGameTime = rt.blockedSinceGameTime ?? null;
                const stoppedSince = rt.stoppedSinceGameTime == null ? null : Number(rt.stoppedSinceGameTime);
                svc.train._stoppedSinceGameTime = stoppedSince != null && Number.isFinite(stoppedSince) ? stoppedSince : null;
                svc._platformAssignment = rt.platformAssignment ? { ...rt.platformAssignment } : null;
                svc._passageTailSpeedHolds = normalizePassageTailSpeedHolds(rt.passageTailSpeedHolds);
                svc._brakeEffort = Math.max(0, Math.min(1, Number(rt.brakeEffort || 0)));
                svc._tractiveEffort = Math.max(0, Math.min(1, Number(rt.tractiveEffort || 0)));
                svc._lastPhysicsDecelMs2 = Math.max(0, Number(rt.physicsDecelMs2 || 0));
                svc._currentDate = dateStr;
                svc._currentTimeOfDay = currentTimeOfDay;
                if (Number.isFinite(Number(rt.distanceKm)))
                    svc.totalDistance = Number(rt.distanceKm);
                svc._departureResourceHold = rt.departureResourceHold ? { ...rt.departureResourceHold } : null;
                svc._stationaryRoute = this._runtimeRouteFromRef(svc, rt.stationaryRouteRef, rt.stationaryRouteEncoded);
                svc._stationaryRouteIndex = svc._stationaryRoute?.length ? Math.max(0, svc._stationaryRoute.length - 2) : 0;
                if (rt._adjustedStops) {
                    svc._adjustedStops = rt._adjustedStops.map((s) => new ServiceStop(s.stationId, s.type, s.departureTime, s.arrivalTime, s.voiePointId, s.platform, s.stopCode, { ...materialTrackLocation(s), lat: s.lat, lon: s.lon, turnBack: s.turnBack }));
                }
            }
            // Use the saved game time for validation (not wall clock).
            // Restore mid-journey state if train was moving/stopped at station
            const savedState = d._runtime?.state || 'waiting';
            const savedPos = d._runtime?.position || null;
            const savedSpeed = d._runtime?.speed || 0;
            const savedDelay = d._runtime?.delay ?? 0;
            const savedStopIdx = d._runtime?.currentStopIndex || 0;
            const savedRouteIndex = Number(d._runtime?.stateIndex || 0);
            const savedRouteProgress = Number(d._runtime?.stateProgress || 0);
            const savedLegKey = d._runtime?.legKey || null;
            const savedReturnLeg = !!d._runtime?.isReturnLeg;
            const savedCompleted = d._runtime?.cm || false;
            const savedCancelled = d._runtime?.cn || false;
            const savedCompletedDate = d._runtime?.cdt || completedDate;
            // Restore terminal states first so completed/cancelled services don't re-enter the schedule.
            if (savedState === 'completed' || savedState === 'cancelled' || savedCompleted || savedCancelled) {
                svc.completed = true;
                if (savedState === 'cancelled' || savedCancelled) {
                    svc.cancelled = true;
                    svc.state = 'cancelled';
                }
                else {
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
                svc.train.state = svc.cancelled ? 'cancelled' : 'completed';
                svc._movementGo?.();
                svc.train.stoppedAt = null;
                svc.train._stoppedSinceGameTime = null;
            }
            else if ((savedState === 'moving' || savedState === 'stopped_at_station') && savedPos) {
                // Check if service window has expired for this train
                const svcStops = svc.getCurrentStops();
                const svcLastArr = svcStops[svcStops.length - 1]?.arrivalTime ?? (svcStops[0]?.departureTime ?? 0) + 120;
                const minutesPastEnd = timeDiff(currentTimeOfDay, svcLastArr);
                // Do not delete a legitimately delayed train merely because booked
                // arrival passed five minutes ago. Use the same generous stuck/runtime
                // envelope as live simulation; only grossly stale legacy states expire.
                if (minutesPastEnd > svc._getMaxRuntimeForCurrentLeg()) {
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
                    svc.train.state = 'completed';
                    svc._movementGo?.();
                    svc.train.stoppedAt = null;
                    svc.train._stoppedSinceGameTime = null;
                }
                else {
                    // Service window still active — restore mid-journey
                    svc.state = savedState;
                    svc.position = { lat: savedPos[0], lon: savedPos[1] };
                    svc.speed = savedSpeed;
                    svc.currentStopIndex = savedStopIdx;
                    svc.delay = savedDelay;
                    svc.train.delay = Number.isFinite(Number(savedDelay)) ? Number(savedDelay) : 0;
                    svc.train.speed = savedSpeed;
                    svc.train.state = savedState === 'moving' ? 'moving' : 'stopped_at_station';
                    svc._movementGo?.();
                    svc.train.stoppedAt = null;
                    if (savedState === 'stopped_at_station' && svc.train._stoppedSinceGameTime == null) {
                        // Old saves lacked the arrival clock; restart dwell from reload time.
                        svc.train._stoppedSinceGameTime = currentTimeOfDay;
                    }
                    else if (savedState !== 'stopped_at_station') {
                        svc.train._stoppedSinceGameTime = null;
                    }
                    svc.completed = false;
                    svc.isReturnLeg = savedReturnLeg;
                }
            }
            else {
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
                    svc.train.state = 'completed';
                    svc._movementGo?.();
                    svc.train.stoppedAt = null;
                    svc.train._stoppedSinceGameTime = null;
                }
                else {
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
                    svc._movementGo?.();
                    svc.train.stoppedAt = null;
                    svc.train._stoppedSinceGameTime = null;
                }
            }
            // v1.1.65 — keep historical incident causes over reloads only while the
            // saved service still carries meaningful delay. Old saves simply get [].
            if (d._runtime) {
                svc.train.delayReason = d._runtime.delayReason || svc.train.delayReason || '';
                svc.train.incidentDelayReasons = (Number(svc.train.delay || svc.delay || 0) >= 0.5 &&
                    Array.isArray(d._runtime.incidentDelayReasons))
                    ? d._runtime.incidentDelayReasons.map((r) => ({ ...r }))
                    : [];
            }
            svc.train.inMaintenance = rame ? !!rame.inMaintenance : false;
            svc.train.inDepot = rame ? !!rame.currentLocation?.depotId : false;
            const emptyMovementCargo = ['w', 'hlp', 'tm', 'm-', 'evo'].includes(String(svc.serviceType || '').toLowerCase());
            svc._contractFreight = emptyMovementCargo ? 0 : (d._runtime?._contractFreight || 0);
            svc._contractCargoId = emptyMovementCargo ? '' : (d._runtime?._contractCargoId ?? svc.assignedContractId ?? '');
            svc._contractDelivered = d._runtime?._contractDelivered || 0;
            svc.revenueCollected = false;
            // Rebuild runtime-only infrastructure objects from the persisted physical
            // state. Occupancy maps themselves are never trusted from disk; they are
            // reconstructed from position + complete train footprint.
            svc._resetState();
            if ((svc.state === 'moving' || svc.state === 'departing') && svc.position) {
                const restoredRoute = svc.getCurrentRoute();
                if (restoredRoute && restoredRoute.length >= 2) {
                    const restoredLegKey = savedLegKey || `${svc.currentStopIndex}-${svc.isReturnLeg ? 1 : 0}`;
                    svc._initializeState(restoredRoute, restoredLegKey);
                    svc._state.index = Math.max(0, Math.min(restoredRoute.length - 1, savedRouteIndex));
                    svc._state.progress = Math.max(0, Math.min(1, savedRouteProgress));
                    svc._syncCantonFootprint(restoredRoute);
                    svc._restoreHeldDepartureSafety();
                }
            }
            else if (svc.state === 'stopped_at_station' && svc.position) {
                const stopsNow = svc.getCurrentStops();
                const stopAt = stopsNow[Math.max(0, Math.min(stopsNow.length - 1, svc.currentStopIndex - 1))]
                    || stopsNow[Math.max(0, Math.min(stopsNow.length - 1, svc.currentStopIndex))];
                const stationId = d._runtime?.platformAssignment?.stationId || stopAt?.stationId;
                const station = stationId ? world?.getStationById(stationId) : null;
                if (station && stopAt) {
                    // Prefer the exact saved platform/voie point before atomic re-reservation.
                    if (d._runtime?.platformAssignment?.platform != null)
                        stopAt.platform = d._runtime.platformAssignment.platform;
                    if (d._runtime?.platformAssignment?.voiePointId)
                        stopAt.voiePointId = d._runtime.platformAssignment.voiePointId;
                    svc._reserveArrivalResources(station, stopAt);
                    svc.train.stoppedAt = station;
                }
                // Rebuild the physical rear blocks even though _resetState() has already
                // prepared the next route leg.
                if (!svc._stationaryRoute && svc.currentStopIndex >= 2) {
                    const prevIdx = svc.currentStopIndex - 2;
                    svc._stationaryRoute = svc.isReturnLeg
                        ? (svc._returnRoutes?.[prevIdx] || null)
                        : (svc.routes?.[prevIdx] || null);
                    svc._stationaryRouteIndex = svc._stationaryRoute?.length ? Math.max(0, svc._stationaryRoute.length - 2) : 0;
                }
                svc._restoreStationarySafetyFootprint();
            }
            this.services.push(svc);
            const num = parseInt(d.id?.split('-')[1] || '0');
            if (num >= nextServiceId)
                nextServiceId = num + 1;
        }
    }
}
