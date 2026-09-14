import { ActiveService, cantonManager } from './schedule-creator.js';
import { advanceMaterialMileage } from './material-mileage.js';
import { consumeMaterialResources } from './consumable-effects.js';
import { samePhysicalMovement } from './physical-service-identity.js';
/** Reject a corrupt physical snapshot as a whole. Never turn bad progress
 * into a plausible teleport, or drop saved tail locks to make motion succeed. */
export function validRescueMotion(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const v = value;
    const number = (key, max = Infinity) => typeof v[key] === 'number' && Number.isFinite(v[key]) && Number(v[key]) >= 0 && Number(v[key]) <= max;
    const id = (x) => (typeof x === 'string' && x.length > 0 && x.length <= 512) || (typeof x === 'number' && Number.isFinite(x));
    if (v.version !== 1 || typeof v.returning !== 'boolean' || !number('index') || !Number.isInteger(v.index) ||
        !number('progress', 1) || !number('distance') || !number('speed', 1000) || !number('brakeEffort', 1) ||
        !number('tractiveEffort', 1) || !number('carryoverStartKm') || (v.physicsDecelMs2 != null && !number('physicsDecelMs2')))
        return null;
    if (!Array.isArray(v.carryover) || !v.carryover.every(id) || !Array.isArray(v.occupiedTroncons) || !v.occupiedTroncons.every(id) ||
        !Array.isArray(v.tronconExits) || !v.tronconExits.every(x => Array.isArray(x) && x.length === 2 && id(x[0]) && typeof x[1] === 'number' && Number.isFinite(x[1]) && x[1] >= 0) ||
        (v.lastTroncon !== null && !id(v.lastTroncon)))
        return null;
    if (!v.consumables || typeof v.consumables !== 'object' || Array.isArray(v.consumables) ||
        Object.entries(v.consumables).some(([k, n]) => ['__proto__', 'constructor', 'prototype'].includes(k) || typeof n !== 'number' || !Number.isFinite(n) || n < 0))
        return null;
    return { ...v, carryover: [...v.carryover], occupiedTroncons: [...v.occupiedTroncons],
        tronconExits: v.tronconExits.map(x => [...x]), consumables: { ...v.consumables } };
}
/** The DDS does not have a second motion integrator. It is an ActiveService
 * with two technical endpoints and no passenger/freight booking at arrival.
 * Its train length/mass include the hauled consist; power is locomotive-only. */
export class RescueMovement extends ActiveService {
    constructor(id, material, world, weather) {
        super({ id, name: material.name, serviceType: 'hlp', routes: [], stops: [] }, material, world, weather);
        this.arrived = false;
        this.returning = false;
        this.routeIdentity = null;
        this.hauledMass = 0;
        this.hauledLength = 0;
        this.phaseLimit = 100;
        this.originalRameMaxSpeed = 0;
        this.isRescue = true;
        this.active = true;
        this.currentStopIndex = 1;
        this.state = 'moving';
        this.locomotiveLength = material.totalLength;
        this.locomotiveMass = material.totalMass;
        this.locomotiveMaxSpeed = material.maxSpeed;
        this.originalRameMaxSpeed = material.maxSpeed;
        // These are physics views, not changes to saved rolling-stock details.
        Object.defineProperties(material, {
            totalMass: { get: () => this.locomotiveMass + this.hauledMass },
            totalTonnage: { get: () => this.locomotiveMass + this.hauledMass },
            totalLength: { get: () => this.locomotiveLength + this.hauledLength },
            maxSpeed: { get: () => Math.min(this.originalRameMaxSpeed, this.phaseLimit) },
        });
    }
    setPhaseLimit(kmh) { this.phaseLimit = Math.max(0, kmh); }
    configure(route, position, returning, hauled, snapshot) {
        this.returning = returning;
        this.hauledMass = returning && hauled ? hauled._currentMassKg() / 1000 : 0;
        this.hauledLength = returning ? Math.max(0, Number(hauled?.rame?.totalLength || hauled?.train.length || 0)) : 0;
        this.originalRameMaxSpeed = Math.min(this.locomotiveMaxSpeed, returning ? Number(hauled?.rame?.maxSpeed || 60) : Infinity);
        this.train.length = this.rame.totalLength;
        this.train.maxSpeed = this.rame.maxSpeed;
        this.position = { ...position };
        this.arrived = false;
        this.state = 'moving';
        this.currentStopIndex = 1;
        const endpoints = [route[0], route[route.length - 1]];
        const stationIds = [`${this.id}:origin`, `${this.id}:destination`];
        const baseWorld = this.world;
        this.world = Object.assign(Object.create(baseWorld || null), {
            getStationById: (id) => {
                const i = stationIds.indexOf(id);
                return i < 0 ? baseWorld?.getStationById?.(id) : { ...endpoints[i], id, name: 'Point technique secours', platforms: 1 };
            },
        });
        // Reuse the same public construction contract as a normal service.
        const stops = new ActiveService({ id: this.id + ':stops', stops: stationIds.map((stationId, i) => ({ stationId, type: 'arret', departureTime: 0, arrivalTime: 0, lat: endpoints[i].lat, lon: endpoints[i].lon })) }, null, this.world, null).stops;
        this.stops = stops;
        this.routes = [route];
        this._captureCantonCarryover();
        this.routeIdentity = route;
        if (snapshot) {
            this.totalDistance = Math.max(0, Number(snapshot.distance) || 0);
            this._state.index = Math.max(0, Number(snapshot.index) || 0);
            this._carryoverCantonIds = new Set(snapshot.carryover || []);
            this._carryoverStartTravelKm = Number(snapshot.carryoverStartKm) || 0;
            this._occupiedTronconIds = new Set(snapshot.occupiedTroncons || []);
            this._tronconExitTravelKm = new Map(snapshot.tronconExits || []);
            this._lastTronconId = snapshot.lastTroncon || null;
            if (snapshot.consumables)
                this.rame.consumables = { ...snapshot.consumables };
        }
        this._initializeState(route, '1-0');
        if (snapshot) {
            // Location is projected first; exact saved subsegment progress is then
            // restored, without accumulating an extra movement step on reload.
            this._state.index = Math.min(route.length - 1, Math.max(0, snapshot.index));
            this._state.progress = Math.max(0, Math.min(1, snapshot.progress));
            this.speed = Math.max(0, snapshot.speed);
            this._brakeEffort = Math.max(0, Math.min(1, snapshot.brakeEffort));
            this._tractiveEffort = Math.max(0, Math.min(1, snapshot.tractiveEffort));
            this._lastPhysicsDecelMs2 = Math.max(0, Number(snapshot.physicsDecelMs2 || 0));
            for (const id of this._carryoverCantonIds || [])
                cantonManager.occupy(id, this.id);
            this._syncCantonFootprint(route);
        }
    }
    // Arrival is a technical rendezvous. Depot parking itself remains an atomic
    // DepotManager transaction. All track/canton/works checks still run normally.
    _reserveArrivalResources() { return true; }
    _yieldToRescue() { return false; }
    // A blocked rescue remains physically present. A booked-service timeout
    // cannot delete an emergency locomotive and its hauled train from the line.
    _updateStuckTimer() { return false; }
    _cancelBlockedService() { return false; }
    // Rescue rerouting is owned by DepotManager, with validated endpoints and
    // saved mission geometry. Do not silently replace the controller route alone.
    _startAlternateRouteSearch() { }
    _updateContinuousDelay() { }
    _safetyCandidatePool(allServices, radiusKm = 6) {
        return super._safetyCandidatePool(allServices, radiusKm).filter(s => !samePhysicalMovement(this.id, s.id));
    }
    arriveAtStation() {
        this.arrived = true;
        this.speed = this.train.speed = 0;
        this.state = 'stopped_at_station';
        this.train.state = 'accostage';
        this._syncCantonFootprint();
    }
    _trackWear(km) {
        // No passenger receipts, no fuel drawn from the disabled locomotive.
        if (!this.rame || !(km > 0))
            return;
        advanceMaterialMileage(this.rame, this.train, km);
        consumeMaterialResources(this.rame, km, this._resourceSection());
    }
    snapshot() {
        return { version: 1, returning: this.returning, index: this._state.index, progress: this._state.progress,
            distance: this.totalDistance, speed: this.speed, brakeEffort: this._brakeEffort, tractiveEffort: this._tractiveEffort, physicsDecelMs2: Number(this._lastPhysicsDecelMs2 || 0),
            carryover: [...(this._carryoverCantonIds || [])].filter((v) => typeof v === 'string' || typeof v === 'number'),
            carryoverStartKm: Number(this._carryoverStartTravelKm || 0),
            occupiedTroncons: [...this._occupiedTronconIds], tronconExits: [...this._tronconExitTravelKm],
            lastTroncon: this._lastTronconId || null, consumables: { ...this.rame.consumables } };
    }
}
