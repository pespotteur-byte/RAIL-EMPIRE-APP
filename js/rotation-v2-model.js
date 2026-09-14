import { saveLiveryTarget } from './livery-model.js';
import { materialTrackLocation } from './material-track-location.js';
import { makeV2Id, ScheduleVersion, PerformanceProfile } from './schedule-v2-model.js';
import { recalculateScheduleTiming } from './schedule-v2-timing.js';
// HOTFIX61 source-shape compatibility: code:'ROTATION_EMPTY'
export const ROTATION_V2_SCHEMA = 6;
export const FormationRole = Object.freeze({
    LEAD: 'LEAD',
    ACTIVE_MULTIPLE: 'ACTIVE_MULTIPLE',
    PUSHER: 'PUSHER',
    VEHICLE: 'VEHICLE', // CV — contributes mass/resistance, no traction
    COACH: 'COACH',
    WAGON: 'WAGON',
});
export const RotationActionType = Object.freeze({
    ATTACH: 'ATTACH',
    DETACH: 'DETACH',
    CHANGE_LOCOMOTIVE: 'CHANGE_LOCOMOTIVE',
    SPLIT: 'SPLIT',
    MERGE: 'MERGE',
    ADD_PUSHER: 'ADD_PUSHER',
    REMOVE_PUSHER: 'REMOVE_PUSHER',
    ADD_CV: 'ADD_CV',
    REMOVE_CV: 'REMOVE_CV',
});
const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
const arr = (v) => Array.isArray(v) ? v : [];
const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const DAY = 86400;
const idText = (v) => v == null ? '' : String(v).trim();
const stableId = (v, prefix) => idText(v) || makeV2Id(prefix);
const uniqueStrings = (values) => {
    const seen = new Set(), out = [];
    for (const raw of arr(values)) {
        const v = idText(raw);
        if (v && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }
    return out;
};
export class PhysicalVehicle {
    constructor(data = {}) {
        this.id = stableId(data.id, 'veh');
        this.catalogId = idText(data.catalogId);
        this.number = String(data.number || '').trim();
        this.name = data.name || this.number || 'Véhicule';
        this.category = data.category || '';
        this.traction = data.traction || 'none';
        this.maxSpeed = n(data.maxSpeed, 160);
        this.massKg = Math.max(0, n(data.massKg, 0));
        this.powerW = Math.max(0, n(data.powerW, 0));
        this.lengthM = Math.max(0, n(data.lengthM, 0));
        this.passengerCapacity = Math.max(0, n(data.passengerCapacity, 0));
        this.freightCapacity = Math.max(0, n(data.freightCapacity, 0));
        this.brakeServiceMs2 = Math.max(0.1, n(data.brakeServiceMs2, 0.9));
        this.electricSystems = arr(data.electricSystems).map((x) => ({ voltage: n(x.voltage), frequency: n(x.frequency) }));
        this.gauges = arr(data.gauges).map(Number).filter(Number.isFinite);
        this.loadingGauge = String(data.loadingGauge || '').trim();
        this.axleLoad = data.axleLoad == null ? null : Math.max(0, n(data.axleLoad, null));
        this.metreLoad = data.metreLoad == null ? null : Math.max(0, n(data.metreLoad, null));
        this.location = data.location ? { ...clone(data.location), ...materialTrackLocation(data.location) } : { kind: 'UNKNOWN', id: '', lat: null, lon: null };
        this.available = data.available !== false;
        this.sourceRameId = idText(data.sourceRameId);
        this.sourceRameElementId = idText(data.sourceRameElementId);
        const rameElementIndex = data.sourceRameElementIndex;
        this.sourceRameElementIndex = rameElementIndex !== null && rameElementIndex !== undefined && rameElementIndex !== '' && Number.isInteger(Number(rameElementIndex)) ? Number(rameElementIndex) : null;
        this.imageData = data.imageData || '';
        this.liveryId = String(data.liveryId || '');
        this.originalImageData = String(data.originalImageData || data.imageData || '');
        this.flipped = !!data.flipped;
        this.isDrivingTrailer = !!data.isDrivingTrailer;
        this.odometerKm = Math.max(0, n(data.odometerKm, 0));
        // HOTFIX50 — operational home depot for individually materialised stock.
        this.homeDepotId = idText(data.homeDepotId);
    }
    toJSON() {
        return {
            id: this.id, catalogId: this.catalogId, number: this.number, name: this.name, category: this.category,
            traction: this.traction, maxSpeed: this.maxSpeed, massKg: this.massKg, powerW: this.powerW, lengthM: this.lengthM,
            passengerCapacity: this.passengerCapacity, freightCapacity: this.freightCapacity,
            brakeServiceMs2: this.brakeServiceMs2, electricSystems: clone(this.electricSystems), gauges: [...this.gauges],
            loadingGauge: this.loadingGauge, axleLoad: this.axleLoad, metreLoad: this.metreLoad,
            location: clone(this.location), available: this.available, sourceRameId: this.sourceRameId, sourceRameElementId: this.sourceRameElementId, sourceRameElementIndex: this.sourceRameElementIndex,
            imageData: saveLiveryTarget(this).imageData, liveryId: this.liveryId, originalImageData: this.originalImageData, flipped: this.flipped, isDrivingTrailer: this.isDrivingTrailer, odometerKm: this.odometerKm, homeDepotId: this.homeDepotId,
        };
    }
}
export class Coupon {
    constructor(data = {}) {
        this.id = stableId(data.id, 'coupon');
        this.name = String(data.name || '').trim();
        this.vehicleIds = uniqueStrings(data.vehicleIds); // ordered, one physical vehicle once
        this.createdAt = data.createdAt || new Date().toISOString();
        this.sourceRameId = idText(data.sourceRameId);
        this.sourceRameElementIds = uniqueStrings(data.sourceRameElementIds);
        this.sourceRameElementIndexes = arr(data.sourceRameElementIndexes).map(Number).filter(Number.isInteger);
        this.homeDepotId = idText(data.homeDepotId);
    }
    toJSON() {
        return { id: this.id, name: this.name, vehicleIds: [...this.vehicleIds], createdAt: this.createdAt, sourceRameId: this.sourceRameId, sourceRameElementIds: [...this.sourceRameElementIds], sourceRameElementIndexes: [...this.sourceRameElementIndexes], homeDepotId: this.homeDepotId };
    }
}
export class FormationMember {
    constructor(data = {}) {
        this.vehicleId = idText(data.vehicleId);
        this.role = data.role || FormationRole.COACH;
        this.order = n(data.order, 0);
        this.sourceCouponId = idText(data.sourceCouponId);
    }
    toJSON() {
        return { vehicleId: this.vehicleId, role: this.role, order: this.order, sourceCouponId: this.sourceCouponId };
    }
}
export class ActiveFormationSpec {
    constructor(data = {}) {
        this.id = stableId(data.id, 'formation');
        this.members = arr(data.members).map((m) => new FormationMember(m));
        this.temporary = data.temporary !== false;
    }
    normalize() {
        this.members.sort((a, b) => a.order - b.order);
        this.members.forEach((m, i) => { m.order = i; });
        return this;
    }
    calculate(vehicleManager) {
        let massKg = 0, powerW = 0, lengthM = 0, maxSpeed = Infinity, brakeWeighted = 0, brakeMass = 0;
        let passengerCapacity = 0, freightCapacity = 0, adhesionMassKg = 0;
        const electricSystems = [];
        const gauges = new Set();
        const loadingGauges = new Set();
        let axleLoad = null, metreLoad = null;
        const activeVehicleIds = [];
        const seenVehicleIds = new Set();
        for (const m of this.members) {
            if (!m.vehicleId || seenVehicleIds.has(m.vehicleId))
                continue;
            seenVehicleIds.add(m.vehicleId);
            const v = vehicleManager.getVehicle(m.vehicleId);
            if (!v)
                continue;
            massKg += v.massKg;
            lengthM += v.lengthM;
            passengerCapacity += Math.max(0, Number(v.passengerCapacity || 0));
            freightCapacity += Math.max(0, Number(v.freightCapacity || 0));
            maxSpeed = Math.min(maxSpeed, v.maxSpeed || Infinity);
            brakeWeighted += v.brakeServiceMs2 * Math.max(1, v.massKg);
            brakeMass += Math.max(1, v.massKg);
            const tractionActive = m.role === FormationRole.LEAD || m.role === FormationRole.ACTIVE_MULTIPLE || m.role === FormationRole.PUSHER;
            if (tractionActive) {
                powerW += v.powerW;
                if (v.powerW > 0)
                    adhesionMassKg += Math.max(0, Number(v.massKg || 0));
                activeVehicleIds.push(v.id);
                electricSystems.push(...v.electricSystems);
            }
            for (const g of v.gauges)
                gauges.add(g);
            if (v.loadingGauge)
                loadingGauges.add(String(v.loadingGauge).trim());
            if (Number.isFinite(Number(v.axleLoad)))
                axleLoad = Math.max(axleLoad ?? 0, Number(v.axleLoad));
            if (Number.isFinite(Number(v.metreLoad)))
                metreLoad = Math.max(metreLoad ?? 0, Number(v.metreLoad));
        }
        return {
            massKg,
            powerW,
            lengthM,
            maxSpeed: Number.isFinite(maxSpeed) ? maxSpeed : 160,
            brakeServiceMs2: brakeMass ? brakeWeighted / brakeMass : 0.9,
            adhesionMassKg: Math.max(0, adhesionMassKg),
            passengerCapacity,
            freightCapacity,
            electricSystems,
            gauges: [...gauges],
            loadingGauge: loadingGauges.size === 1 ? [...loadingGauges][0] : '',
            axleLoad,
            metreLoad,
            activeVehicleIds,
        };
    }
    toJSON() { return { id: this.id, temporary: this.temporary, members: this.members.map((m) => m.toJSON()) }; }
}
export class ScheduleOccurrence {
    constructor(data = {}) {
        this.id = stableId(data.id, 'occ');
        this.scheduleId = idText(data.scheduleId);
        this.versionId = idText(data.versionId);
        this.offsetSec = n(data.offsetSec, 0);
        this.dateOffsetDays = n(data.dateOffsetDays, 0);
        this.sequence = n(data.sequence, 0);
        this.formation = new ActiveFormationSpec(data.formation || {});
        this.resolvedStartSec = data.resolvedStartSec == null ? null : n(data.resolvedStartSec);
        this.resolvedEndSec = data.resolvedEndSec == null ? null : n(data.resolvedEndSec);
        this.cancelled = !!data.cancelled;
        this.cancelReason = data.cancelReason || '';
        this.warnings = arr(data.warnings).map((x) => clone(x));
        this.optionalStopDecisions = data.optionalStopDecisions ? clone(data.optionalStopDecisions) : {};
        this.timingMismatchApproved = !!data.timingMismatchApproved;
        this.timingMismatchSignature = data.timingMismatchSignature || '';
        this.currentTimingMismatchSignature = data.currentTimingMismatchSignature || '';
        this.usesAssignedFormation = data.usesAssignedFormation !== false;
        this.reversed = !!data.reversed;
    }
    toJSON() {
        return {
            id: this.id, scheduleId: this.scheduleId, versionId: this.versionId, offsetSec: this.offsetSec,
            dateOffsetDays: this.dateOffsetDays, sequence: this.sequence, formation: this.formation.toJSON(),
            resolvedStartSec: this.resolvedStartSec, resolvedEndSec: this.resolvedEndSec, cancelled: this.cancelled,
            cancelReason: this.cancelReason, warnings: clone(this.warnings), optionalStopDecisions: clone(this.optionalStopDecisions),
            timingMismatchApproved: this.timingMismatchApproved, timingMismatchSignature: this.timingMismatchSignature,
            currentTimingMismatchSignature: this.currentTimingMismatchSignature, usesAssignedFormation: this.usesAssignedFormation, reversed: this.reversed,
        };
    }
}
export class DirectScheduleAssignment {
    constructor(data = {}) {
        this.id = stableId(data.id, 'direct');
        this.scheduleId = idText(data.scheduleId);
        this.versionId = idText(data.versionId);
        this.rameId = idText(data.rameId);
        this.formation = new ActiveFormationSpec(data.formation || {});
        this.enabled = data.enabled !== false;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.offsetSec = 0;
        this.dateOffsetDays = 0;
        this.sequence = 0;
        this.cancelled = false;
        this.cancelReason = '';
        this.warnings = arr(data.warnings).map((x) => clone(x));
        this.optionalStopDecisions = data.optionalStopDecisions ? clone(data.optionalStopDecisions) : {};
        this.timingMismatchApproved = !!data.timingMismatchApproved;
        this.timingMismatchSignature = data.timingMismatchSignature || '';
        this.currentTimingMismatchSignature = data.currentTimingMismatchSignature || '';
        this.usesAssignedFormation = data.usesAssignedFormation !== false;
        this.reversed = !!data.reversed;
    }
    toJSON() {
        return {
            id: this.id, scheduleId: this.scheduleId, versionId: this.versionId, rameId: this.rameId,
            formation: this.formation.toJSON(), enabled: this.enabled, createdAt: this.createdAt,
            warnings: clone(this.warnings), optionalStopDecisions: clone(this.optionalStopDecisions),
            timingMismatchApproved: this.timingMismatchApproved,
            timingMismatchSignature: this.timingMismatchSignature,
            currentTimingMismatchSignature: this.currentTimingMismatchSignature, usesAssignedFormation: this.usesAssignedFormation, reversed: this.reversed,
        };
    }
}
export class RotationAction {
    constructor(data = {}) {
        this.id = stableId(data.id, 'action');
        this.type = data.type || RotationActionType.ATTACH;
        this.occurrenceId = idText(data.occurrenceId);
        this.locationOccurrenceId = idText(data.locationOccurrenceId);
        this.vehicleIds = uniqueStrings(data.vehicleIds);
        this.couponIds = uniqueStrings(data.couponIds);
        this.durationSec = Math.max(300, n(data.durationSec, 300)); // 5 min minimum each
        this.parallelGroup = data.parallelGroup || '';
        this.dependsOn = uniqueStrings(data.dependsOn);
        this.forcedExecutionMode = data.forcedExecutionMode || ''; // PARALLEL | SEQUENTIAL | ''
        this.details = data.details ? clone(data.details) : {};
    }
    toJSON() {
        return {
            id: this.id, type: this.type, occurrenceId: this.occurrenceId, locationOccurrenceId: this.locationOccurrenceId,
            vehicleIds: [...this.vehicleIds], couponIds: [...this.couponIds], durationSec: this.durationSec,
            parallelGroup: this.parallelGroup, dependsOn: [...this.dependsOn], forcedExecutionMode: this.forcedExecutionMode,
            details: clone(this.details),
        };
    }
}
export class Rotation {
    constructor(data = {}) {
        this.id = stableId(data.id, 'rotation');
        this.name = data.name || 'Roulement';
        this.calendarId = idText(data.calendarId);
        this.occurrences = arr(data.occurrences).map((o) => new ScheduleOccurrence(o));
        this.actions = arr(data.actions).map((a) => new RotationAction(a));
        this.createdAt = data.createdAt || new Date().toISOString();
        this.enabled = data.enabled !== false;
        this.assignedRameId = idText(data.assignedRameId);
        this.assignedFormation = new ActiveFormationSpec(data.assignedFormation || {});
    }
    normalize() {
        this.occurrences.sort((a, b) => a.sequence - b.sequence);
        this.occurrences.forEach((o, i) => { o.sequence = i; });
        return this;
    }
    toJSON() {
        return {
            id: this.id, name: this.name, calendarId: this.calendarId,
            occurrences: this.occurrences.map((o) => o.toJSON()),
            actions: this.actions.map((a) => a.toJSON()), createdAt: this.createdAt, enabled: this.enabled,
            assignedRameId: this.assignedRameId, assignedFormation: this.assignedFormation.toJSON(),
        };
    }
}
export class RotationV2Manager {
    constructor(scheduleManager = null) {
        this.schemaVersion = ROTATION_V2_SCHEMA;
        this.scheduleManager = scheduleManager;
        this.vehicles = [];
        this.coupons = [];
        this.rotations = [];
        this.directAssignments = [];
        this.stationCodes = {};
        this.loadWarnings = [];
    }
    stationCodeKey(location = {}) {
        const stationId = String(location?.stationId || '').trim();
        if (stationId)
            return `station:${stationId}`;
        const technicalId = String(location?.technicalLocationId || '').trim();
        if (technicalId)
            return `technical:${technicalId}`;
        const occurrenceId = String(location?.id || '').trim();
        if (occurrenceId)
            return `occurrence:${occurrenceId}`;
        return `name:${String(location?.name || '').trim().toLowerCase()}`;
    }
    getStationCode(location = {}) {
        return String(this.stationCodes?.[this.stationCodeKey(location)] || '').trim().toUpperCase();
    }
    setStationCode(location = {}, code = '') {
        const key = this.stationCodeKey(location), value = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!key || key === 'name:')
            throw new Error('Gare/point opérationnel invalide.');
        if (value && !/^[A-Z0-9]{1,8}$/.test(value))
            throw new Error('Le code roulement doit contenir 1 à 8 lettres/chiffres.');
        if (value)
            this.stationCodes[key] = value;
        else
            delete this.stationCodes[key];
        return value;
    }
    addVehicle(data = {}) {
        const v = new PhysicalVehicle(data);
        if (!v.number)
            throw new Error('Chaque engin doit avoir un numéro individuel.');
        if (this.vehicles.some((x) => x.number.toLowerCase() === v.number.toLowerCase()))
            throw new Error(`Numéro matériel déjà utilisé : ${v.number}`);
        this.vehicles.push(v);
        return v;
    }
    getVehicle(id) { return this.vehicles.find((v) => v.id === id) || null; }
    setVehicleHomeDepot(vehicleId, depotId) {
        const v = this.getVehicle(vehicleId);
        if (!v)
            return false;
        v.homeDepotId = idText(depotId);
        return true;
    }
    setCouponHomeDepot(couponId, depotId) {
        const c = this.getCoupon(couponId);
        if (!c)
            return false;
        const id = idText(depotId);
        c.homeDepotId = id;
        for (const vid of c.vehicleIds) {
            const v = this.getVehicle(vid);
            if (v)
                v.homeDepotId = id;
        }
        return true;
    }
    getRameElementVehicle(rameId, elementIndex) {
        const idx = Number(elementIndex);
        return this.vehicles.find((v) => v.sourceRameId === rameId && v.sourceRameElementIndex === idx) || null;
    }
    getRameVehicles(rameId) {
        return this.vehicles.filter((v) => v.sourceRameId === rameId && Number.isInteger(v.sourceRameElementIndex))
            .sort((a, b) => a.sourceRameElementIndex - b.sourceRameElementIndex);
    }
    _rameLocation(rame) {
        const loc = rame?.currentLocation || {};
        if (loc.stationId)
            return { kind: 'STATION', id: loc.stationId, lat: loc.lat ?? null, lon: loc.lon ?? null, ...materialTrackLocation(loc) };
        if (loc.depotId)
            return { kind: 'DEPOT', id: loc.depotId, lat: loc.lat ?? null, lon: loc.lon ?? null };
        return { kind: 'UNKNOWN', id: '', lat: loc.lat ?? null, lon: loc.lon ?? null };
    }
    materializeRameElement(rame, elementIndex, catalogItem = null) {
        if (!rame?.id)
            throw new Error('Rame gameplay invalide.');
        const idx = Number(elementIndex);
        if (!Number.isInteger(idx) || idx < 0)
            throw new Error('Élément de rame invalide.');
        const detail = arr(rame.elementDetails)[idx] || {};
        const catalogId = arr(rame.elements)[idx] || detail.catalogId || catalogItem?.id || '';
        const existing = this.getRameElementVehicle(rame.id, idx);
        const source = catalogItem || detail || {};
        let number = String(detail.instanceName || detail.instanceNumber || detail.name || source.name || `${rame.serialNumber || rame.name || rame.id} ${idx + 1}`).trim();
        if (!number)
            number = `${rame.serialNumber || rame.name || rame.id} ${idx + 1}`;
        const numberTaken = (probe) => this.vehicles.some((v) => v.id !== existing?.id && v.number.toLowerCase() === String(probe).toLowerCase());
        if (numberTaken(number)) {
            number = `${number} · ${rame.serialNumber || rame.id}#${idx + 1}`;
            let n = 2, base = number;
            while (numberTaken(number))
                number = `${base}-${n++}`;
        }
        const electricSystems = arr(detail.electricSystems).length ? arr(detail.electricSystems) : arr(source.electricSystems);
        let gauges = arr(detail.gauges).length ? arr(detail.gauges) : arr(source.gauges);
        if (!gauges.length && Number.isFinite(Number(detail.gauge)))
            gauges = [Number(detail.gauge)];
        if (!gauges.length && Number.isFinite(Number(source.gauge)))
            gauges = [Number(source.gauge)];
        const vehicleData = {
            catalogId, number, name: detail.name || source.name || number, category: detail.category || source.category || '',
            traction: detail.traction || source.traction || 'none', maxSpeed: n(detail.maxSpeed, n(source.maxSpeed, 160)),
            massKg: Math.max(0, n(detail.mass, n(detail.tonnage, n(source.mass, n(source.tonnage, 0)))) * 1000),
            powerW: Math.max(0, n(detail.power, n(source.power, 0)) * 1000), lengthM: Math.max(0, n(detail.length, n(source.length, 0))),
            passengerCapacity: Math.max(0, n(detail.passengerCapacity, n(source.passengerCapacity, 0))),
            freightCapacity: Math.max(0, n(detail.freightCapacity, n(source.freightCapacity, 0))),
            brakeServiceMs2: n(detail.brakeServiceMs2, n(source.brakeServiceMs2, 0.9)), electricSystems, gauges,
            loadingGauge: String(detail.loadingGauge || source.loadingGauge || '').trim(),
            axleLoad: Number.isFinite(Number(detail.axleLoad ?? source.axleLoad)) ? Number(detail.axleLoad ?? source.axleLoad) : null,
            metreLoad: Number.isFinite(Number(detail.metreLoad ?? source.metreLoad)) ? Number(detail.metreLoad ?? source.metreLoad) : null,
            location: this._rameLocation(rame), sourceRameId: rame.id, sourceRameElementId: detail.elementId || '', sourceRameElementIndex: idx,
            imageData: detail.imageData || source.imageData || '', liveryId: detail.liveryId || '', originalImageData: detail.originalImageData ?? source.originalImageData ?? source.imageData ?? detail.imageData ?? '', flipped: !!detail.flipped, isDrivingTrailer: !!(detail.isDrivingTrailer ?? source.isDrivingTrailer),
            odometerKm: existing?.odometerKm || 0,
            homeDepotId: String(detail.homeDepotId || existing?.homeDepotId || ''),
        };
        if (existing) {
            // v1.1.73 migration/backfill: old saves may contain physical vehicles
            // created before capacities and later catalogue edits existed. Refresh the
            // Rame-derived technical fields in place instead of returning stale data.
            const available = existing.available, busy = existing._v2BusyUntilEpoch, id = existing.id;
            const physicalLocation = clone(existing.location), operationOwner = existing._v2OperationOwnerServiceId;
            const refreshed = new PhysicalVehicle({ ...vehicleData, id, available });
            Object.assign(existing, refreshed);
            existing.available = available;
            existing.location = physicalLocation;
            existing._v2OperationOwnerServiceId = operationOwner;
            if (busy != null)
                existing._v2BusyUntilEpoch = busy;
            return existing;
        }
        return this.addVehicle(vehicleData);
    }
    materializeRameCoupon(rame, elementIndexes, name, catalogResolver = null) {
        const indexes = [...new Set(arr(elementIndexes).map(Number).filter((i) => Number.isInteger(i) && i >= 0))].sort((a, b) => a - b);
        if (!indexes.length)
            throw new Error('Sélectionnez au moins une voiture ou un wagon.');
        const vehicles = indexes.map((i) => this.materializeRameElement(rame, i, catalogResolver?.(arr(rame.elements)[i], i) || null));
        const vehicleIds = vehicles.map((v) => v.id);
        const homes = [...new Set(vehicles.map((v) => String(v.homeDepotId || '')).filter(Boolean))];
        const homeDepotId = homes.length === 1 ? homes[0] : '';
        return this.addCoupon({ name, vehicleIds, sourceRameId: rame.id, sourceRameElementIds: indexes.map((i) => arr(rame.elementDetails)[i]?.elementId || '').filter(Boolean), sourceRameElementIndexes: indexes, homeDepotId });
    }
    syncRameAfterEdit(rame, previous = {}) {
        if (!rame?.id)
            throw new Error('Rame gameplay invalide.');
        const oldDetails = arr(previous.elementDetails);
        const newDetails = arr(rame.elementDetails);
        const newIndexById = new Map(newDetails.map((d, i) => [String(d?.elementId || ''), i]).filter(([id]) => id));
        let linked = 0, detached = 0;
        for (const v of this.vehicles.filter((v) => v.sourceRameId === rame.id && Number.isInteger(v.sourceRameElementIndex))) {
            const oldIdx = v.sourceRameElementIndex;
            const elementId = String(v.sourceRameElementId || oldDetails[oldIdx]?.elementId || '');
            const newIdx = elementId && newIndexById.has(elementId) ? newIndexById.get(elementId) : -1;
            if (newIdx >= 0) {
                v.sourceRameElementId = elementId;
                v.sourceRameElementIndex = newIdx;
                v.homeDepotId = String(newDetails[newIdx]?.homeDepotId || v.homeDepotId || '');
                linked++;
            }
            else {
                v.sourceRameId = '';
                v.sourceRameElementId = '';
                v.sourceRameElementIndex = null;
                detached++;
            }
        }
        // Refresh technical/capacity data of every surviving materialized element.
        // This also migrates pre-v1.1.73 saves whose PhysicalVehicle capacity was 0.
        for (let i = 0; i < newDetails.length; i++) {
            if (this.getRameElementVehicle(rame.id, i))
                this.materializeRameElement(rame, i, null);
        }
        for (const c of this.coupons.filter((c) => c.sourceRameId === rame.id)) {
            const rows = c.vehicleIds.map((id) => this.getVehicle(id)).filter((v) => v?.sourceRameId === rame.id && Number.isInteger(v.sourceRameElementIndex)).sort((a, b) => a.sourceRameElementIndex - b.sourceRameElementIndex);
            if (!rows.length) {
                c.sourceRameId = '';
                c.sourceRameElementIds = [];
                c.sourceRameElementIndexes = [];
                continue;
            }
            c.vehicleIds = rows.map((v) => v.id);
            c.sourceRameElementIndexes = rows.map((v) => v.sourceRameElementIndex);
            c.sourceRameElementIds = rows.map((v) => v.sourceRameElementId || newDetails[v.sourceRameElementIndex]?.elementId || '').filter(Boolean);
        }
        let rotationsUpdated = 0, rotationsBlocked = 0;
        for (const r of this.rotations.filter((r) => r.assignedRameId === rame.id)) {
            try {
                const formation = this.formationForRame(rame);
                r.assignedFormation = new ActiveFormationSpec(formation.toJSON());
                for (const occ of r.occurrences) {
                    if (occ.usesAssignedFormation !== false)
                        occ.formation = new ActiveFormationSpec(formation.toJSON());
                    occ.timingMismatchApproved = false;
                    occ.timingMismatchSignature = '';
                }
                rotationsUpdated++;
            }
            catch (_err) {
                r.assignedFormation = new ActiveFormationSpec({ members: [], temporary: false });
                for (const occ of r.occurrences) {
                    if (occ.usesAssignedFormation !== false)
                        occ.formation = new ActiveFormationSpec({ members: [], temporary: true });
                    occ.timingMismatchApproved = false;
                    occ.timingMismatchSignature = '';
                }
                rotationsBlocked++;
            }
            this.recalculateRotation(r.id);
        }
        let directUpdated = 0, directBlocked = 0;
        for (const a of this.directAssignments.filter((a) => a.rameId === rame.id)) {
            try {
                for (let i = 0; i < newDetails.length; i++)
                    this.materializeRameElement(rame, i, null);
                a.formation = new ActiveFormationSpec(this.formationForRame(rame).toJSON());
                a.timingMismatchApproved = false;
                a.timingMismatchSignature = '';
                a.currentTimingMismatchSignature = '';
                directUpdated++;
            }
            catch (_err) {
                a.formation = new ActiveFormationSpec({ members: [], temporary: true });
                directBlocked++;
            }
        }
        this.upsertRameProxy(rame);
        return { linked, detached, rotationsUpdated, rotationsBlocked, directUpdated, directBlocked };
    }
    formationForRame(rame) {
        if (!rame?.id)
            throw new Error('Rame gameplay invalide.');
        const details = arr(rame.elementDetails);
        const members = [];
        let tractionCount = 0;
        for (let i = 0; i < details.length; i++) {
            const v = this.getRameElementVehicle(rame.id, i);
            if (!v)
                throw new Error(`Matériel physique manquant pour ${details[i]?.instanceName || details[i]?.name || `élément ${i + 1}`}.`);
            const cat = String(v.category || details[i]?.category || '').toLowerCase();
            const powered = cat === 'locomotive' || cat === 'automotrice' || v.powerW > 0;
            const role = powered ? (tractionCount++ === 0 ? FormationRole.LEAD : FormationRole.ACTIVE_MULTIPLE) : (cat.includes('wagon') ? FormationRole.WAGON : FormationRole.COACH);
            const coupon = this.coupons.find((c) => c.sourceRameId === rame.id && c.vehicleIds.includes(v.id));
            members.push(new FormationMember({ vehicleId: v.id, role, order: members.length, sourceCouponId: coupon?.id || '' }));
        }
        if (!tractionCount)
            throw new Error('Cette rame ne contient aucun engin de traction physique.');
        return new ActiveFormationSpec({ members, temporary: false }).normalize();
    }
    assignRameToRotation(rotationId, rame) {
        const r = this.getRotation(rotationId);
        if (!r)
            throw new Error('Roulement introuvable.');
        const formation = this.formationForRame(rame);
        r.assignedRameId = rame.id;
        r.assignedFormation = new ActiveFormationSpec(formation.toJSON());
        for (const occ of r.occurrences) {
            if (occ.usesAssignedFormation !== false)
                occ.formation = new ActiveFormationSpec(formation.toJSON());
            occ.timingMismatchApproved = false;
            occ.timingMismatchSignature = '';
        }
        this.recalculateRotation(r.id);
        return r;
    }
    clearRameFromRotation(rotationId, options = {}) {
        const r = this.getRotation(rotationId);
        if (!r)
            return false;
        r.assignedRameId = '';
        r.assignedFormation = new ActiveFormationSpec({ members: [], temporary: false });
        if (!options.keepFormation)
            for (const occ of r.occurrences) {
                if (occ.usesAssignedFormation !== false)
                    occ.formation = new ActiveFormationSpec({ members: [], temporary: true });
                occ.timingMismatchApproved = false;
                occ.timingMismatchSignature = '';
            }
        this.recalculateRotation(r.id);
        return true;
    }
    // HOTFIX32 — player-spec line assignment.  A timetable is independent from
    // rolling stock; the physical formation belongs to the rotation line and is
    // inherited by every standard occurrence.  Per-occurrence formations are
    // explicit exceptions used for splits, joins, locomotive changes, etc.
    setAssignedFormation(rotationId, formation = {}, options = {}) {
        const r = this.getRotation(rotationId);
        if (!r)
            throw new Error('Ligne de roulement introuvable.');
        const spec = formation instanceof ActiveFormationSpec ? new ActiveFormationSpec(formation.toJSON()) : new ActiveFormationSpec(formation || {});
        spec.normalize();
        const seen = new Set();
        for (const m of spec.members) {
            if (!m.vehicleId || seen.has(m.vehicleId))
                throw new Error('Formation de ligne invalide : matériel vide ou dupliqué.');
            seen.add(m.vehicleId);
            if (!this.getVehicle(m.vehicleId))
                throw new Error(`Matériel introuvable : ${m.vehicleId}`);
            if (m.sourceCouponId) {
                const c = this.getCoupon(m.sourceCouponId);
                if (!c)
                    throw new Error(`Coupon introuvable : ${m.sourceCouponId}`);
                if (!c.vehicleIds.includes(m.vehicleId))
                    throw new Error(`Le matériel ${m.vehicleId} n’appartient pas au coupon ${c.name}.`);
            }
        }
        if (spec.members.length && !spec.members.some((m) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(m.role))) {
            const first = spec.members.find((m) => m.role !== FormationRole.VEHICLE && this._poweredVehicle(this.getVehicle(m.vehicleId)));
            if (first)
                first.role = FormationRole.LEAD;
        }
        r.assignedFormation = spec;
        r.assignedRameId = idText(options.rameId);
        const applyAll = options.applyAll === true;
        for (const occ of r.occurrences) {
            if (applyAll || occ.usesAssignedFormation !== false) {
                occ.formation = new ActiveFormationSpec(spec.toJSON());
                occ.usesAssignedFormation = true;
                occ.timingMismatchApproved = false;
                occ.timingMismatchSignature = '';
                occ.currentTimingMismatchSignature = '';
            }
        }
        this.recalculateRotation(r.id);
        return r;
    }
    addAssignedVehicle(rotationId, vehicleId, role = '', sourceCouponId = '') {
        const r = this.getRotation(rotationId), v = this.getVehicle(vehicleId);
        if (!r)
            throw new Error('Ligne de roulement introuvable.');
        if (!v)
            throw new Error('Matériel introuvable.');
        const spec = new ActiveFormationSpec(r.assignedFormation?.toJSON?.() || {});
        if (spec.members.some((m) => m.vehicleId === v.id))
            return r;
        let nextRole = role;
        if (!nextRole) {
            if (this._poweredVehicle(v)) {
                const hasActive = spec.members.some((m) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(m.role));
                nextRole = hasActive ? FormationRole.ACTIVE_MULTIPLE : FormationRole.LEAD;
            }
            else
                nextRole = String(v.category || '').toLowerCase().includes('wagon') ? FormationRole.WAGON : FormationRole.COACH;
        }
        spec.members.push(new FormationMember({ vehicleId: v.id, role: nextRole, order: spec.members.length, sourceCouponId }));
        return this.setAssignedFormation(rotationId, spec, { rameId: r.assignedRameId });
    }
    addAssignedCoupon(rotationId, couponId) {
        const r = this.getRotation(rotationId), c = this.getCoupon(couponId);
        if (!r)
            throw new Error('Ligne de roulement introuvable.');
        if (!c)
            throw new Error('Coupon introuvable.');
        const spec = new ActiveFormationSpec(r.assignedFormation?.toJSON?.() || {}), seen = new Set(spec.members.map((m) => m.vehicleId));
        for (const id of c.vehicleIds) {
            if (seen.has(id))
                continue;
            const v = this.getVehicle(id);
            if (!v)
                continue;
            spec.members.push(new FormationMember({ vehicleId: id, role: String(v.category || '').toLowerCase().includes('wagon') ? FormationRole.WAGON : FormationRole.COACH, order: spec.members.length, sourceCouponId: c.id }));
            seen.add(id);
        }
        return this.setAssignedFormation(rotationId, spec, { rameId: r.assignedRameId });
    }
    addAssignedRame(rotationId, rame) {
        const r = this.getRotation(rotationId);
        if (!r)
            throw new Error('Ligne de roulement introuvable.');
        const formation = this.formationForRame(rame);
        const spec = new ActiveFormationSpec(r.assignedFormation?.toJSON?.() || {}), seen = new Set(spec.members.map((m) => m.vehicleId));
        for (const m of formation.members) {
            if (seen.has(m.vehicleId))
                continue;
            spec.members.push(new FormationMember({ ...m.toJSON(), order: spec.members.length }));
            seen.add(m.vehicleId);
        }
        return this.setAssignedFormation(rotationId, spec, { rameId: rame.id });
    }
    removeAssignedVehicle(rotationId, vehicleId) {
        const r = this.getRotation(rotationId);
        if (!r)
            return false;
        const spec = new ActiveFormationSpec(r.assignedFormation?.toJSON?.() || {});
        const before = spec.members.length;
        spec.members = spec.members.filter((m) => m.vehicleId !== vehicleId);
        spec.normalize();
        if (before === spec.members.length)
            return false;
        this.setAssignedFormation(rotationId, spec, { rameId: '' });
        return true;
    }
    clearAssignedFormation(rotationId) {
        return !!this.setAssignedFormation(rotationId, { members: [], temporary: false }, { rameId: '', applyAll: true });
    }
    scheduleCoveredByRotation(scheduleId, versionId = null) {
        return this.rotations.some((r) => r.enabled !== false && (r.occurrences || []).some((o) => o.scheduleId === scheduleId && (!versionId || o.versionId === versionId)));
    }
    upsertRameProxy(rame) {
        if (!rame?.id)
            throw new Error('Rame gameplay invalide.');
        const id = `rame-proxy:${rame.id}`;
        const loc = rame.currentLocation || {};
        const location = loc.stationId ? { kind: 'STATION', id: loc.stationId, lat: loc.lat ?? null, lon: loc.lon ?? null, ...materialTrackLocation(loc) } : loc.depotId ? { kind: 'DEPOT', id: loc.depotId, lat: loc.lat ?? null, lon: loc.lon ?? null } : { kind: 'UNKNOWN', id: '', lat: loc.lat ?? null, lon: loc.lon ?? null };
        const details = Array.isArray(rame.elementDetails) ? rame.elementDetails : [];
        const systems = [];
        const gauges = [];
        const loadingGauges = [];
        const axleLoads = [];
        const metreLoads = [];
        for (const e of details) {
            if (Array.isArray(e.electricSystems))
                systems.push(...e.electricSystems);
            if (Array.isArray(e.gauges))
                gauges.push(...e.gauges);
            else if (Number.isFinite(Number(e.gauge)))
                gauges.push(Number(e.gauge));
            if (e.loadingGauge)
                loadingGauges.push(String(e.loadingGauge));
            if (Number.isFinite(Number(e.axleLoad)))
                axleLoads.push(Number(e.axleLoad));
            if (Number.isFinite(Number(e.metreLoad)))
                metreLoads.push(Number(e.metreLoad));
        }
        const uniqueGauges = [...new Set(gauges.map(Number).filter(Number.isFinite))];
        const uniqueLoading = [...new Set(loadingGauges.map((x) => x.trim()).filter(Boolean))];
        const data = { id, sourceRameId: rame.id, catalogId: '', number: `RAME:${rame.serialNumber || rame.id}`, name: rame.name || rame.serialNumber || rame.id, category: 'rame', traction: rame.traction || 'none', maxSpeed: Number(rame.maxSpeed || 160), massKg: Math.max(0, Number(rame.totalMass || rame.totalTonnage || 0) * 1000), powerW: Math.max(0, Number(rame.totalPower || 0) * 1000), lengthM: Math.max(0, Number(rame.totalLength || 0)), passengerCapacity: Math.max(0, Number(rame.totalCapacity || 0)), freightCapacity: Math.max(0, Number(rame.totalFreightCapacity || 0)), electricSystems: systems, gauges: uniqueGauges, loadingGauge: uniqueLoading.length === 1 ? uniqueLoading[0] : '', axleLoad: axleLoads.length ? Math.max(...axleLoads) : null, metreLoad: metreLoads.length ? Math.max(...metreLoads) : null, location };
        const sig = [data.number, data.name, data.traction, data.maxSpeed, data.massKg, data.powerW, data.lengthM, data.passengerCapacity, data.freightCapacity,
            systems.map((x) => `${x.voltage || 0}/${x.frequency || 0}`).join(','), uniqueGauges.join(','), data.loadingGauge, data.axleLoad ?? '', data.metreLoad ?? '',
            location.kind || '', location.id || '', location.lat ?? '', location.lon ?? ''].join('|');
        let v = this.getVehicle(id);
        if (!v) {
            v = new PhysicalVehicle(data);
            v._rameProxySignature = sig;
            this.vehicles.push(v);
            return v;
        }
        // v1.1.43 — direct assignments are inspected by sync + diagnostics. Do not
        // reconstruct the same PhysicalVehicle several times per second if the Rame
        // page composition/location has not changed.
        if (v._rameProxySignature === sig)
            return v;
        const available = v.available;
        const busy = v._v2BusyUntilEpoch;
        Object.assign(v, new PhysicalVehicle({ ...data, available }));
        v.available = available;
        if (busy)
            v._v2BusyUntilEpoch = busy;
        v._rameProxySignature = sig;
        return v;
    }
    addCoupon(data = {}) {
        const c = new Coupon(data);
        if (!c.name)
            throw new Error('Le coupon doit avoir un nom.');
        if (!c.vehicleIds.length)
            throw new Error('Un coupon physique doit contenir au moins un véhicule.');
        if (this.coupons.some((x) => x.name.toLowerCase() === c.name.toLowerCase()))
            throw new Error(`Nom de coupon déjà utilisé : ${c.name}`);
        for (const id of c.vehicleIds) {
            const vehicle = this.getVehicle(id);
            if (!vehicle)
                throw new Error(`Matériel introuvable dans le coupon : ${id}`);
            if (this._poweredVehicle(vehicle))
                throw new Error(`${vehicle.number || id} est un engin motorisé. Une locomotive/automotrice doit rester un élément physique séparé du coupon.`);
            const owner = this.coupons.find((x) => x.vehicleIds.includes(id));
            if (owner)
                throw new Error(`${vehicle.number || id} appartient déjà au coupon ${owner.name}. Un véhicule physique ne peut appartenir qu’à un seul coupon.`);
        }
        this.coupons.push(c);
        return c;
    }
    getCoupon(id) { return this.coupons.find((c) => c.id === id) || null; }
    expandCoupon(couponId, role = FormationRole.COACH) {
        const c = this.getCoupon(couponId);
        if (!c)
            return [];
        return c.vehicleIds.map((vehicleId, i) => new FormationMember({ vehicleId, role, order: i, sourceCouponId: c.id }));
    }
    getDirectAssignment(scheduleId, versionId = null) {
        const list = this.directAssignments.filter((a) => a.scheduleId === scheduleId);
        if (versionId)
            return list.find((a) => a.versionId === versionId) || null;
        return list[0] || null;
    }
    getDirectAssignmentById(id) {
        return this.directAssignments.find((a) => a.id === id) || null;
    }
    getDirectAssignmentByRuntimeRotationId(rotationId) {
        const raw = String(rotationId || '');
        if (!raw.startsWith('direct:'))
            return null;
        return this.getDirectAssignmentById(raw.slice('direct:'.length));
    }
    setDirectAssignment(scheduleId, versionId, formation = null, options = {}) {
        if (!scheduleId || !versionId)
            throw new Error('Horaire/version requis pour la compatibilité d’une ancienne affectation.');
        let a = this.getDirectAssignment(scheduleId, versionId);
        if (!a) {
            this.directAssignments = this.directAssignments.filter((x) => x.scheduleId !== scheduleId);
            a = new DirectScheduleAssignment({ scheduleId, versionId, formation: formation || {}, rameId: options.rameId || '' });
            this.directAssignments.push(a);
        }
        else if (formation) {
            a.formation = formation instanceof ActiveFormationSpec ? formation : new ActiveFormationSpec(formation);
        }
        if (Object.prototype.hasOwnProperty.call(options, 'rameId'))
            a.rameId = options.rameId || '';
        a.enabled = true;
        return a;
    }
    setDirectRameAssignment(scheduleId, versionId, rame) {
        if (!rame?.id)
            throw new Error('Rame invalide pour l’affectation directe.');
        for (let i = 0; i < arr(rame.elementDetails).length; i++)
            this.materializeRameElement(rame, i, null);
        const formation = this.formationForRame(rame);
        this.upsertRameProxy(rame);
        return this.setDirectAssignment(scheduleId, versionId, formation, { rameId: rame.id });
    }
    removeDirectAssignment(scheduleId, versionId = null) {
        const before = this.directAssignments.length;
        this.directAssignments = this.directAssignments.filter((a) => a.scheduleId !== scheduleId || (versionId && a.versionId !== versionId));
        return this.directAssignments.length !== before;
    }
    directAssignmentSuppressed(assignment) {
        return this.rotations.some((r) => (r.occurrences || []).some((o) => o.scheduleId === assignment?.scheduleId));
    }
    addRotation(data = {}) {
        const r = new Rotation(data);
        this.rotations.push(r);
        return r;
    }
    getRotation(id) { return this.rotations.find((r) => r.id === id) || null; }
    removeRotation(id) {
        const before = this.rotations.length;
        this.rotations = this.rotations.filter((r) => r.id !== id);
        return this.rotations.length !== before;
    }
    duplicateRotation(id, name = '') {
        const src = this.getRotation(id);
        if (!src)
            throw new Error('Roulement introuvable.');
        const copy = new Rotation({ ...src.toJSON(), id: makeV2Id('rotation'), name: name || `${src.name} — copie`, createdAt: new Date().toISOString() });
        const occMap = new Map();
        copy.occurrences = src.occurrences.map((o, i) => { const nocc = new ScheduleOccurrence({ ...o.toJSON(), id: makeV2Id('occ'), sequence: i }); occMap.set(o.id, nocc.id); return nocc; });
        copy.actions = src.actions.map((a) => new RotationAction({ ...a.toJSON(), id: makeV2Id('action'), occurrenceId: occMap.get(a.occurrenceId) || a.occurrenceId }));
        this.rotations.push(copy);
        this.recalculateRotation(copy.id);
        return copy;
    }
    removeVehicle(id) {
        if (this.coupons.some((c) => c.vehicleIds.includes(id)))
            throw new Error('Ce matériel appartient encore à un coupon.');
        if (this.rotations.some((r) => r.assignedFormation?.members?.some((m) => m.vehicleId === id) || r.occurrences.some((o) => o.formation.members.some((m) => m.vehicleId === id)) || r.actions.some((a) => a.vehicleIds.includes(id))))
            throw new Error('Ce matériel est encore utilisé dans un roulement.');
        if (this.directAssignments.some((a) => a.formation.members.some((m) => m.vehicleId === id)))
            throw new Error('Ce matériel est encore utilisé par une affectation directe en mode simplifié.');
        const before = this.vehicles.length;
        this.vehicles = this.vehicles.filter((v) => v.id !== id);
        return this.vehicles.length !== before;
    }
    removeCoupon(id) {
        if (this.rotations.some((r) => r.assignedFormation?.members?.some((m) => m.sourceCouponId === id) || r.actions.some((a) => a.couponIds.includes(id)) || r.occurrences.some((o) => o.formation.members.some((m) => m.sourceCouponId === id))))
            throw new Error('Ce coupon est encore utilisé dans un roulement.');
        const before = this.coupons.length;
        this.coupons = this.coupons.filter((c) => c.id !== id);
        return this.coupons.length !== before;
    }
    findScheduleReferences(scheduleId) {
        const refs = [];
        for (const rotation of this.rotations) {
            for (const occurrence of rotation.occurrences) {
                if (occurrence.scheduleId === scheduleId)
                    refs.push({ rotationId: rotation.id, rotationName: rotation.name, occurrenceId: occurrence.id });
            }
        }
        return refs;
    }
    removeScheduleReferences(scheduleId) {
        for (const rotation of this.rotations) {
            const removed = new Set(rotation.occurrences.filter((o) => o.scheduleId === scheduleId).map((o) => o.id));
            rotation.occurrences = rotation.occurrences.filter((o) => o.scheduleId !== scheduleId);
            rotation.actions = rotation.actions.filter((a) => !removed.has(a.occurrenceId));
            rotation.normalize();
        }
        this.removeDirectAssignment(scheduleId);
    }
    addOccurrence(rotationId, data = {}) {
        const r = this.getRotation(rotationId);
        if (!r)
            throw new Error('Roulement introuvable.');
        const payload = { ...data, sequence: r.occurrences.length };
        const suppliedMembers = payload.formation?.members;
        if ((!Array.isArray(suppliedMembers) || !suppliedMembers.length) && r.assignedFormation?.members?.length) {
            payload.formation = r.assignedFormation.toJSON();
            if (payload.usesAssignedFormation == null)
                payload.usesAssignedFormation = true;
        }
        const o = new ScheduleOccurrence(payload);
        r.occurrences.push(o);
        return o;
    }
    addAction(rotationId, data = {}) {
        const r = this.getRotation(rotationId);
        if (!r)
            throw new Error('Roulement introuvable.');
        const a = new RotationAction(data);
        r.actions.push(a);
        return a;
    }
    removeAction(rotationId, actionId) {
        const r = this.getRotation(rotationId);
        if (!r)
            return false;
        const before = r.actions.length;
        r.actions = r.actions.filter((a) => a.id !== actionId);
        return r.actions.length !== before;
    }
    // HOTFIX35 — one physical-material view for operation dependencies.  Coupon
    // actions must conflict with direct vehicle actions on the same underlying cars;
    // otherwise two AUTO operations on Coupon 301 could incorrectly run in parallel.
    _actionVehicleIds(action) {
        const ids = new Set(action?.vehicleIds || []);
        for (const cid of action?.couponIds || [])
            for (const id of this.getCoupon(cid)?.vehicleIds || [])
                if (id)
                    ids.add(id);
        return [...ids];
    }
    _operationDeps(actions, action, indexMap = null) {
        const index = indexMap || new Map(actions.map((a, i) => [a.id, i]));
        const deps = new Set(action?.dependsOn || []), ai = index.get(action.id) ?? 0;
        if (action?.forcedExecutionMode === 'SEQUENTIAL' && ai > 0)
            deps.add(actions[ai - 1].id);
        // Physical ownership beats the UI preference: two operations touching the
        // same coach/locomotive/coupon can never be simultaneous, even if PARALLEL
        // was explicitly selected. PARALLEL only suppresses ordering for disjoint
        // material.
        const mine = new Set(this._actionVehicleIds(action));
        for (let j = 0; j < ai; j++)
            if (this._actionVehicleIds(actions[j]).some((id) => mine.has(id)))
                deps.add(actions[j].id);
        return [...deps];
    }
    orderedActionsAtLocation(rotationId, occurrenceId, locationOccurrenceId) {
        const r = this.getRotation(rotationId);
        if (!r)
            return [];
        const actions = r.actions.filter((a) => a.occurrenceId === occurrenceId && a.locationOccurrenceId === locationOccurrenceId);
        if (actions.length < 2)
            return actions;
        const byId = new Map(actions.map((a) => [a.id, a])), index = new Map(actions.map((a, i) => [a.id, i])), done = new Set(), out = [];
        while (out.length < actions.length) {
            let progressed = false;
            for (const a of actions) {
                if (done.has(a.id))
                    continue;
                const deps = this._operationDeps(actions, a, index);
                // Missing dependencies are validated separately and must not be silently
                // treated as satisfied here.
                if (deps.some((id) => !byId.has(id)))
                    continue;
                if (deps.every((id) => done.has(id))) {
                    out.push(a);
                    done.add(a.id);
                    progressed = true;
                }
            }
            if (!progressed)
                break;
        }
        return out.length === actions.length ? out : actions;
    }
    // Critical-path schedule of all operations attached to one exact stop.
    // AUTO/PARALLEL actions on disjoint material may overlap; shared physical
    // material is always serialized. The returned offsets are relative to the
    // beginning of the operational window and are the canonical source for both
    // reservations and runtime execution.
    _operationTimeline(actions) {
        if (!actions?.length)
            return { windowSec: 0, entries: [] };
        const byId = new Map(actions.map((a) => [a.id, a]));
        const index = new Map(actions.map((a, i) => [a.id, i]));
        const memo = new Map(), visiting = new Set();
        const spanOf = (a) => {
            if (memo.has(a.id))
                return memo.get(a.id);
            if (visiting.has(a.id))
                throw new Error(`Cycle de dépendances d’opérations: ${a.id}`);
            visiting.add(a.id);
            let begin = 0;
            const dependsOn = this._operationDeps(actions, a, index);
            for (const depId of dependsOn) {
                const dep = byId.get(depId);
                if (!dep)
                    throw new Error(`Dépendance d’opération introuvable: ${depId}`);
                begin = Math.max(begin, spanOf(dep).endOffsetSec);
            }
            visiting.delete(a.id);
            const span = { action: a, startOffsetSec: begin, endOffsetSec: begin + Math.max(300, Number(a.durationSec || 300)), dependsOn: [...dependsOn] };
            memo.set(a.id, span);
            return span;
        };
        const entries = actions.map(spanOf).sort((x, y) => x.startOffsetSec - y.startOffsetSec || x.endOffsetSec - y.endOffsetSec || Number(index.get(x.action.id) || 0) - Number(index.get(y.action.id) || 0));
        return { windowSec: Math.max(...entries.map((x) => x.endOffsetSec), 0), entries };
    }
    operationTimelineAtLocation(rotationId, occurrenceId, locationOccurrenceId) {
        const r = this.getRotation(rotationId);
        if (!r)
            return { windowSec: 0, entries: [] };
        const actions = r.actions.filter((a) => a.occurrenceId === occurrenceId && a.locationOccurrenceId === locationOccurrenceId);
        return this._operationTimeline(actions);
    }
    operationWindowSec(rotationId, occurrenceId, locationOccurrenceId) {
        return this.operationTimelineAtLocation(rotationId, occurrenceId, locationOccurrenceId).windowSec;
    }
    _locationOperationBounds(rotation, occ, timed, locationOccurrenceId, startSec) {
        const loc = (timed?.locations || []).find((l) => l.id === locationOccurrenceId);
        if (!loc)
            return null;
        const idx = (timed.locations || []).findIndex((l) => l.id === locationOccurrenceId);
        const raw = loc.arrivalSec ?? loc.departureSec ?? timed.firstDepartureSec;
        const anchor = Number(startSec || 0) + (Number(raw || 0) - Number(timed.firstDepartureSec || 0));
        let windowSec = 0;
        try {
            windowSec = this.operationWindowSec(rotation.id, occ.id, locationOccurrenceId) || 0;
        }
        catch { }
        if (idx === 0)
            return { startSec: anchor - windowSec, endSec: anchor, anchorSec: anchor, windowSec, location: loc, index: idx };
        return { startSec: anchor, endSec: anchor + windowSec, anchorSec: anchor, windowSec, location: loc, index: idx };
    }
    _actionOperationBounds(rotation, occ, timed, action, startSec) {
        const full = this._locationOperationBounds(rotation, occ, timed, action?.locationOccurrenceId, startSec);
        if (!full)
            return null;
        const timeline = this.operationTimelineAtLocation(rotation.id, occ.id, action.locationOccurrenceId);
        const entry = timeline.entries.find((x) => x.action.id === action.id);
        if (!entry)
            return full;
        return { ...full, startSec: full.startSec + entry.startOffsetSec, endSec: full.startSec + entry.endOffsetSec, actionStartOffsetSec: entry.startOffsetSec, actionEndOffsetSec: entry.endOffsetSec };
    }
    _poweredVehicle(v) {
        if (!v)
            return false;
        const cat = String(v.category || '').toLowerCase();
        return Number(v.powerW || 0) > 0 || cat.includes('locomotive') || cat.includes('automotrice') || cat.includes('autorail') || cat.includes('locotracteur');
    }
    _roleForAttachedVehicle(v, type, activeCount = 0) {
        if (type === RotationActionType.ADD_PUSHER)
            return FormationRole.PUSHER;
        if (type === RotationActionType.ADD_CV)
            return FormationRole.VEHICLE;
        if (String(v?.category || '').toLowerCase().includes('wagon'))
            return FormationRole.WAGON;
        if (this._poweredVehicle(v))
            return activeCount > 0 ? FormationRole.ACTIVE_MULTIPLE : FormationRole.LEAD;
        return FormationRole.COACH;
    }
    originRequiredVehicleIds(rotationId, occurrenceId, timedVersion = null) {
        const r = this.getRotation(rotationId), occ = r?.occurrences.find((o) => o.id === occurrenceId);
        if (!r || !occ)
            return [];
        const timed = timedVersion || this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId);
        const ids = new Set((occ.formation?.members || []).map((m) => m.vehicleId).filter(Boolean));
        const originId = timed?.locations?.[0]?.id;
        if (originId) {
            for (const a of r.actions.filter((a) => a.occurrenceId === occ.id && a.locationOccurrenceId === originId)) {
                if ([RotationActionType.ATTACH, RotationActionType.MERGE, RotationActionType.ADD_PUSHER, RotationActionType.ADD_CV, RotationActionType.CHANGE_LOCOMOTIVE].includes(a.type)) {
                    for (const id of a.vehicleIds || [])
                        if (id)
                            ids.add(id);
                    for (const cid of a.couponIds || [])
                        for (const id of this.getCoupon(cid)?.vehicleIds || [])
                            if (id)
                                ids.add(id);
                }
            }
        }
        return [...ids];
    }
    materialIntervals(rotationId, occurrenceId, timedVersion = null, resolvedStartSec = null) {
        const r = this.getRotation(rotationId), occ = r?.occurrences.find((o) => o.id === occurrenceId);
        if (!r || !occ)
            return [];
        const timed = timedVersion || this._timedVersionForOccurrence(occ, this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId));
        if (!timed)
            return [];
        const start = (resolvedStartSec !== null && resolvedStartSec !== undefined && resolvedStartSec !== '' && Number.isFinite(Number(resolvedStartSec))) ? Number(resolvedStartSec) : Number(occ.resolvedStartSec ?? timed.firstDepartureSec ?? 0);
        const terminal = timed.locations?.at(-1);
        let terminalOps = 0, originOps = 0;
        try {
            if (terminal?.id)
                terminalOps = this.operationWindowSec(r.id, occ.id, terminal.id) || 0;
        }
        catch { }
        try {
            const origin = timed.locations?.[0];
            if (origin?.id)
                originOps = this.operationWindowSec(r.id, occ.id, origin.id) || 0;
        }
        catch { }
        const actualDuration = Math.max(0, Number(timed.lastArrivalSec || 0) - Number(timed.firstDepartureSec || 0));
        const terminalRelease = Math.max(Number(timed.lastArrivalSec || 0), Number((terminal?.departureSec ?? timed.lastArrivalSec) || 0), Number(timed.lastArrivalSec || 0) + terminalOps);
        const defaultEnd = start + Math.max(actualDuration, terminalRelease - Number(timed.firstDepartureSec || 0));
        const state = new Map(), intervals = [];
        const originLoc = timed.locations?.[0];
        const originId = originLoc?.stationId || originLoc?.technicalLocationId || originLoc?.id || '';
        const terminalId = terminal?.stationId || terminal?.technicalLocationId || terminal?.id || '';
        // HOTFIX33 — keep both the physical place id (station/technical point) and the
        // exact Schedule-location id.  The former is used for continuity checks; the
        // latter is unambiguous when the same station appears several times in one run
        // and lets odometer accounting use the exact routed legs actually travelled.
        const open = (id, role, at, sourceCouponId = '', startLocationId = originId, startLocationOccurrenceId = originLoc?.id || '') => {
            if (!id || state.has(id))
                return;
            state.set(id, { vehicleId: id, role, sourceCouponId, startSec: Number(at), startLocationId, startLocationOccurrenceId });
        };
        const close = (id, at, reason = '', endLocationId = terminalId, endLocationOccurrenceId = terminal?.id || '') => {
            const cur = state.get(id);
            if (!cur)
                return;
            const end = Math.max(cur.startSec, Number(at));
            intervals.push({ ...cur, endSec: end, reason, endLocationId, endLocationOccurrenceId });
            state.delete(id);
        };
        const initialStart = start - originOps;
        for (const m of occ.formation?.members || [])
            open(m.vehicleId, m.role, initialStart, m.sourceCouponId || '', originId);
        const rankByAction = new Map();
        for (const loc of timed.locations || []) {
            const ordered = this.orderedActionsAtLocation(r.id, occ.id, loc.id);
            ordered.forEach((a, i) => rankByAction.set(a.id, i));
        }
        const indexed = (r.actions || []).map((a, i) => ({ a, i })).filter((x) => x.a.occurrenceId === occ.id).map((x) => {
            const b = this._actionOperationBounds(r, occ, timed, x.a, start);
            return { ...x, b };
        }).filter((x) => x.b).sort((x, y) => x.b.startSec - y.b.startSec || x.b.endSec - y.b.endSec || String(x.a.locationOccurrenceId).localeCompare(String(y.a.locationOccurrenceId)) || (rankByAction.get(x.a.id) ?? x.i) - (rankByAction.get(y.a.id) ?? y.i));
        const activeCount = () => [...state.values()].filter((x) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(x.role)).length;
        for (const { a, b } of indexed) {
            const ids = this._actionVehicleIds(a);
            if ([RotationActionType.DETACH, RotationActionType.SPLIT, RotationActionType.REMOVE_PUSHER, RotationActionType.REMOVE_CV].includes(a.type)) {
                const locId = b.location?.stationId || b.location?.technicalLocationId || b.location?.id || '';
                for (const id of ids)
                    close(id, b.endSec, a.type, locId, b.location?.id || '');
                continue;
            }
            if (a.type === RotationActionType.CHANGE_LOCOMOTIVE) {
                const locId = b.location?.stationId || b.location?.technicalLocationId || b.location?.id || '';
                const wanted = new Set(ids);
                for (const [id, cur] of [...state])
                    if ([FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(cur.role) && !wanted.has(id))
                        close(id, b.endSec, a.type, locId, b.location?.id || '');
                let nActive = activeCount();
                for (const id of ids) {
                    if (state.has(id))
                        continue;
                    const v = this.getVehicle(id);
                    const role = this._poweredVehicle(v) ? (nActive++ === 0 ? FormationRole.LEAD : FormationRole.ACTIVE_MULTIPLE) : this._roleForAttachedVehicle(v, a.type, nActive);
                    open(id, role, b.startSec, '', locId, b.location?.id || '');
                }
                continue;
            }
            if ([RotationActionType.ATTACH, RotationActionType.MERGE, RotationActionType.ADD_PUSHER, RotationActionType.ADD_CV].includes(a.type)) {
                const locId = b.location?.stationId || b.location?.technicalLocationId || b.location?.id || '';
                let nActive = activeCount();
                for (const id of ids) {
                    if (state.has(id))
                        continue;
                    const v = this.getVehicle(id), role = this._roleForAttachedVehicle(v, a.type, nActive);
                    if ([FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(role))
                        nActive++;
                    open(id, role, b.startSec, '', locId, b.location?.id || '');
                }
            }
        }
        for (const id of [...state.keys()])
            close(id, defaultEnd, 'TERMINAL', terminalId, terminal?.id || '');
        return intervals.filter((x) => Number.isFinite(x.startSec) && Number.isFinite(x.endSec) && x.endSec >= x.startSec);
    }
    // HOTFIX33 — one canonical distance calculation for the material sheet AND
    // permanent vehicle odometers.  A split coupon only receives the kilometres up
    // to the split point; a locomotive attached halfway only receives the remainder.
    materialIntervalDistanceKm(rotationId, occurrenceId, interval, version = null) {
        const r = this.getRotation(rotationId), occ = r?.occurrences.find((o) => o.id === occurrenceId);
        if (!occ || !interval)
            return 0;
        const ver = version || this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId);
        if (!ver)
            return 0;
        const locs = ver.locations || [], legs = ver.outboundPath?.legs || [];
        const physical = (l) => String(l?.stationId || l?.technicalLocationId || l?.id || '');
        const exactIndex = (id) => id ? locs.findIndex((l) => String(l?.id || '') === String(id)) : -1;
        const physicalIndex = (id) => id ? locs.findIndex((l) => physical(l) === String(id) || String(l?.id || '') === String(id)) : -1;
        let a = exactIndex(interval.startLocationOccurrenceId), b = exactIndex(interval.endLocationOccurrenceId);
        if (a < 0)
            a = physicalIndex(interval.startLocationId);
        if (b < 0)
            b = physicalIndex(interval.endLocationId);
        if (a >= 0 && b >= a) {
            let total = 0;
            for (let i = a; i < b; i++) {
                const leg = legs.find((x) => x.fromLocationId === locs[i].id && x.toLocationId === locs[i + 1].id);
                total += Math.max(0, Number(leg?.distanceKm || 0));
            }
            if (total > 0 || a === b)
                return total;
        }
        const totalDistance = Number(ver.outboundPath?.distanceKm);
        const routeKm = Number.isFinite(totalDistance) && totalDistance >= 0 ? totalDistance : legs.reduce((n, l) => n + Math.max(0, Number(l?.distanceKm || 0)), 0);
        const duration = Math.max(1, Number(occ.resolvedEndSec ?? ver.lastArrivalSec ?? 0) - Number(occ.resolvedStartSec ?? ver.firstDepartureSec ?? 0));
        const frac = Math.max(0, Math.min(1, (Number(interval.endSec || 0) - Number(interval.startSec || 0)) / duration));
        return Math.max(0, routeKm * frac);
    }
    _canonicalizeOccurrenceDayOffset(occ, ver) {
        const days = Math.trunc(Number(occ?.dateOffsetDays || 0));
        if (!occ || !days)
            return false;
        const scheduleAlreadyCarriesDay = Number(ver?.firstDepartureSec || 0) >= DAY;
        // dateOffsetDays was an internal legacy second representation of J+n and was
        // never exposed by the current UI. If the timetable already carries (+N),
        // adding it again is a double-day bug. Otherwise preserve the old intent by
        // folding the offset into the single canonical offsetSec field.
        if (!scheduleAlreadyCarriesDay)
            occ.offsetSec = Number(occ.offsetSec || 0) + days * DAY;
        occ.dateOffsetDays = 0;
        occ.warnings = Array.isArray(occ.warnings) ? occ.warnings : [];
        if (!occ.warnings.some((w) => w.code === 'LEGACY_DAY_OFFSET_NORMALIZED'))
            occ.warnings.push({ code: 'LEGACY_DAY_OFFSET_NORMALIZED', level: 'INFO', message: scheduleAlreadyCarriesDay ? 'Ancien décalage J+n redondant supprimé : l’horaire contient déjà son jour absolu.' : 'Ancien décalage J+n fusionné dans le décalage de départ canonique.' });
        return true;
    }
    _timedVersionForOccurrence(occ, ver) {
        // Draft/test schedules may not have a routed path yet. In that case the
        // reference timetable remains authoritative; never collapse duration to 0.
        const hasRoute = !!ver?.outboundPath?.routePoints?.length || (ver?.outboundPath?.legs || []).some((l) => l?.routePoints?.length >= 2);
        if (!hasRoute)
            return ver;
        if (!occ?.formation?.members?.length)
            return ver;
        const f = occ.formation.calculate(this);
        const activeMembers = occ.formation.members.filter((m) => m.role === FormationRole.LEAD || m.role === FormationRole.ACTIVE_MULTIPLE || m.role === FormationRole.PUSHER);
        if (!activeMembers.length || !f.powerW)
            return ver;
        const activeMass = activeMembers.reduce((sum, m) => sum + (this.getVehicle(m.vehicleId)?.massKg || 0), 0);
        // Formation mass is authoritative. Do not add an invisible 70% payload here;
        // actual load belongs to the physical formation/runtime when known.
        const referenceLoadedMassKg = Math.max(1000, Number(f.massKg || 0));
        const cloneVer = new ScheduleVersion(ver.toJSON());
        cloneVer.performanceProfile = new PerformanceProfile({
            mode: 'REFERENCE_COMPOSITION', name: 'Formation réelle du roulement', category: ver.category,
            maxSpeed: f.maxSpeed || ver.performanceProfile.maxSpeed,
            massKg: referenceLoadedMassKg || Math.max(1000, ver.performanceProfile.massKg),
            powerW: Math.max(0, f.powerW), lengthM: Math.max(1, f.lengthM || ver.performanceProfile.lengthM),
            adhesionMassKg: Math.max(1000, activeMass || Math.min(Number(f.massKg || 100000), 100000)), brakeServiceMs2: f.brakeServiceMs2 || ver.performanceProfile.brakeServiceMs2,
            electricSystems: f.electricSystems, gauges: f.gauges, loadingGauge: f.loadingGauge, axleLoad: f.axleLoad, metreLoad: f.metreLoad, source: 'ROTATION_REAL_FORMATION',
        });
        recalculateScheduleTiming(cloneVer, { firstDepartureSec: ver.firstDepartureSec });
        return cloneVer;
    }
    _timingSignature(occ, actualDuration, referenceDuration) {
        const formation = (occ?.formation?.members || []).map((m) => { const v = this.getVehicle?.(m.vehicleId); return `${m.vehicleId}:${m.role}:${Number(v?.massKg) || 0}:${Number(v?.powerW) || 0}:${Number(v?.brakeServiceMs2) || 0}:${Number(v?.maxSpeed) || 0}:${v?.loadingGauge || ''}:${v?.axleLoad ?? ''}:${v?.metreLoad ?? ''}`; }).join('|');
        return `${occ?.scheduleId || ''}|${occ?.versionId || ''}|${formation}|${Math.round(actualDuration)}|${Math.round(referenceDuration)}`;
    }
    approveTimingMismatch(rotationId, occurrenceId) {
        const r = this.getRotation(rotationId), occ = r?.occurrences.find((o) => o.id === occurrenceId);
        if (!occ)
            return false;
        this.recalculateRotation(rotationId);
        if (!occ.currentTimingMismatchSignature)
            return false;
        occ.timingMismatchApproved = true;
        occ.timingMismatchSignature = occ.currentTimingMismatchSignature;
        return true;
    }
    timingMismatchNeedsApproval(occ) {
        // v1.1.30: slower real material is operational information, not a departure
        // interlock. The runtime recalculates the running time and propagates the
        // delay through the rotation automatically.
        return false;
    }
    // v1.1.88 — material-driven planning. Occurrences no longer share one global
    // cursor: only the physical vehicles that actually continue from one train to
    // another impose a dependency. This allows a detached coupon to branch while
    // the parent train continues with the rest of the consist.
    recalculateRotation(rotationId) {
        const r = this.getRotation(rotationId);
        if (!r || !this.scheduleManager)
            return null;
        r.normalize();
        const ready = new Map();
        for (const occ of r.occurrences) {
            const ver = this.scheduleManager.getVersion(occ.scheduleId, occ.versionId);
            if (!ver) {
                occ.cancelled = true;
                occ.cancelReason = 'Horaire/version introuvable';
                continue;
            }
            occ.cancelled = false;
            occ.cancelReason = '';
            this._canonicalizeOccurrenceDayOffset(occ, ver);
            const timed = this._timedVersionForOccurrence(occ, ver);
            const plannedStart = Number(timed.firstDepartureSec || 0) + Number(occ.offsetSec || 0);
            const actualDuration = Math.max(0, Number(timed.lastArrivalSec || 0) - Number(timed.firstDepartureSec || 0));
            const referenceDuration = Math.max(0, Number(ver.lastArrivalSec || 0) - Number(ver.firstDepartureSec || 0));
            const origin = timed.locations?.[0];
            let pre = 0;
            try {
                if (origin?.id)
                    pre = this.operationWindowSec(r.id, occ.id, origin.id) || 0;
            }
            catch { }
            let start = plannedStart;
            for (const id of this.originRequiredVehicleIds(r.id, occ.id, timed))
                if (ready.has(id))
                    start = Math.max(start, Number(ready.get(id) || 0) + pre);
            const terminal = timed.locations?.at(-1);
            let terminalOps = 0;
            try {
                if (terminal?.id)
                    terminalOps = this.operationWindowSec(r.id, occ.id, terminal.id) || 0;
            }
            catch { }
            const terminalRelease = Math.max(Number(timed.lastArrivalSec || 0), Number((terminal?.departureSec ?? timed.lastArrivalSec) || 0), Number(timed.lastArrivalSec || 0) + terminalOps);
            const occupancyDuration = Math.max(actualDuration, terminalRelease - Number(timed.firstDepartureSec || 0));
            occ.resolvedStartSec = start;
            occ.resolvedEndSec = start + occupancyDuration;
            occ.warnings = (occ.warnings || []).filter((w) => w.code !== 'MATERIAL_TIMING_CHANGED' && w.code !== 'MATERIAL_TOO_SLOW');
            occ.currentTimingMismatchSignature = '';
            if (occ.formation.members.length && Math.abs(actualDuration - referenceDuration) >= 1) {
                const delta = actualDuration - referenceDuration;
                if (delta > 0) {
                    const signature = this._timingSignature(occ, actualDuration, referenceDuration);
                    occ.currentTimingMismatchSignature = signature;
                    occ.timingMismatchApproved = true;
                    occ.timingMismatchSignature = signature;
                    occ.warnings.push({ code: 'MATERIAL_TOO_SLOW', level: 'WARNING', deltaSec: delta, approvalRequired: false, message: `Matériel réel plus lent : +${Math.round(delta)} s par rapport au profil de référence. Marche recalculée automatiquement ; départ non bloqué.` });
                }
                else
                    occ.warnings.push({ code: 'MATERIAL_TIMING_CHANGED', level: 'INFO', deltaSec: delta, message: `Matériel réel plus performant : ${Math.round(delta)} s par rapport au profil de référence.` });
            }
            for (const slot of this.materialIntervals(r.id, occ.id, timed, start))
                ready.set(slot.vehicleId, Math.max(Number(ready.get(slot.vehicleId) || 0), slot.endSec));
        }
        return r;
    }
    _occurrenceInterval(rotation, occurrence) {
        if (occurrence.resolvedStartSec == null || occurrence.resolvedEndSec == null)
            this.recalculateRotation(rotation.id);
        const ver = this.scheduleManager?.getVersion(occurrence.scheduleId, occurrence.versionId);
        const originId = ver?.locations?.[0]?.id || '';
        let pre = 0;
        try {
            if (originId)
                pre = this.operationWindowSec(rotation.id, occurrence.id, originId);
        }
        catch { }
        return [(occurrence.resolvedStartSec ?? 0) - pre, occurrence.resolvedEndSec ?? 0];
    }
    _validateFormationThroughActions(rotation, occ, ver) {
        const issues = [], state = new Map((occ.formation?.members || []).map((m) => [m.vehicleId, { vehicleId: m.vehicleId, role: m.role }]));
        const activeRole = (role) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(role);
        const physicallyPowered = (id) => this._poweredVehicle(this.getVehicle(id));
        const hasTraction = () => [...state.values()].some((m) => activeRole(m.role) && physicallyPowered(m.vehicleId));
        const add = (id, role) => {
            if (!id || state.has(id))
                return;
            state.set(id, { vehicleId: id, role });
        };
        const remove = (id) => state.delete(id);
        for (const m of state.values())
            if (activeRole(m.role) && !physicallyPowered(m.vehicleId))
                issues.push({ level: 'ERROR', code: 'ACTIVE_ROLE_NOT_POWERED', occurrenceId: occ.id, vehicleId: m.vehicleId, message: `${this.getVehicle(m.vehicleId)?.number || m.vehicleId} est déclaré comme traction active mais n’est pas un engin motorisé.` });
        const locs = ver?.locations || [];
        for (let idx = 0; idx < locs.length; idx++) {
            const loc = locs[idx], actions = this.orderedActionsAtLocation(rotation.id, occ.id, loc.id);
            for (const a of actions) {
                const ids = this._actionVehicleIds(a);
                if (a.type === RotationActionType.REMOVE_CV)
                    for (const id of ids) {
                        const cur = state.get(id);
                        if (cur && cur.role !== FormationRole.VEHICLE)
                            issues.push({ level: 'ERROR', code: 'ACTION_ROLE_MISMATCH', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `Retirer CV cible ${this.getVehicle(id)?.number || id}, qui n’est pas en rôle CV.` });
                    }
                if (a.type === RotationActionType.REMOVE_PUSHER)
                    for (const id of ids) {
                        const cur = state.get(id);
                        if (cur && cur.role !== FormationRole.PUSHER)
                            issues.push({ level: 'ERROR', code: 'ACTION_ROLE_MISMATCH', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `Retirer pousse cible ${this.getVehicle(id)?.number || id}, qui n’est pas en rôle pousse.` });
                    }
                if ([RotationActionType.DETACH, RotationActionType.SPLIT, RotationActionType.REMOVE_PUSHER, RotationActionType.REMOVE_CV].includes(a.type)) {
                    for (const id of ids) {
                        if (!state.has(id))
                            issues.push({ level: 'ERROR', code: 'ACTION_MATERIAL_NOT_PRESENT', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `L’opération ${a.type} cible ${this.getVehicle(id)?.number || id}, absent de la formation à ${loc.name || 'cet arrêt'}.` });
                        remove(id);
                    }
                    continue;
                }
                if (a.type === RotationActionType.CHANGE_LOCOMOTIVE) {
                    for (const id of ids)
                        if (!physicallyPowered(id))
                            issues.push({ level: 'ERROR', code: 'ACTION_TRACTION_REQUIRED', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `Changement de locomotive : ${this.getVehicle(id)?.number || id} n’est pas un engin de traction.` });
                    const wanted = new Set(ids);
                    for (const [id, m] of [...state])
                        if (activeRole(m.role) && !wanted.has(id))
                            remove(id);
                    let n = [...state.values()].filter((m) => activeRole(m.role) && physicallyPowered(m.vehicleId)).length;
                    for (const id of ids) {
                        if (state.has(id))
                            continue;
                        const v = this.getVehicle(id), role = this._poweredVehicle(v) ? (n++ === 0 ? FormationRole.LEAD : FormationRole.ACTIVE_MULTIPLE) : this._roleForAttachedVehicle(v, a.type, n);
                        add(id, role);
                    }
                    continue;
                }
                if ([RotationActionType.ATTACH, RotationActionType.MERGE, RotationActionType.ADD_PUSHER, RotationActionType.ADD_CV].includes(a.type)) {
                    let n = [...state.values()].filter((m) => activeRole(m.role) && physicallyPowered(m.vehicleId)).length;
                    for (const id of ids) {
                        if (state.has(id)) {
                            issues.push({ level: 'ERROR', code: 'ACTION_MATERIAL_ALREADY_PRESENT', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `L’opération ${a.type} tente d’ajouter ${this.getVehicle(id)?.number || id}, déjà présent dans la formation.` });
                            continue;
                        }
                        const v = this.getVehicle(id);
                        if (a.type === RotationActionType.ADD_PUSHER && !this._poweredVehicle(v)) {
                            issues.push({ level: 'ERROR', code: 'ACTION_TRACTION_REQUIRED', occurrenceId: occ.id, actionId: a.id, vehicleId: id, locationOccurrenceId: loc.id, message: `Ajouter pousse : ${v?.number || id} n’est pas un engin de traction.` });
                            continue;
                        }
                        const role = this._roleForAttachedVehicle(v, a.type, n);
                        if (activeRole(role) && this._poweredVehicle(v))
                            n++;
                        add(id, role);
                    }
                }
            }
            if (idx < locs.length - 1 && !hasTraction())
                issues.push({ level: 'ERROR', code: 'NO_TRACTION_AFTER_OPERATION', occurrenceId: occ.id, locationOccurrenceId: loc.id, message: `Après les opérations à ${loc.name || 'cet arrêt'}, aucun engin de traction actif ne reste pour poursuivre le train.` });
        }
        return issues;
    }
    validateRotation(rotationId) {
        const r = this.getRotation(rotationId);
        if (!r)
            return [{ level: 'ERROR', code: 'ROTATION_MISSING', message: 'Roulement introuvable.' }];
        const issues = [];
        // HOTFIX61 — an enabled empty duty is not operational. Surface this in the
        // same validator used by the runtime/editor instead of painting it green.
        if (r.enabled && !r.occurrences.length)
            issues.push({ level: 'ERROR', code: 'ROTATION_EMPTY', message: 'Cette ligne de roulement est vide : ajoutez au moins un horaire valide.' });
        // HOTFIX34 — a rolling line that can never run must not look "Exploitable"
        // in the editor. Runtime already refuses missing/disabled calendars; surface
        // the same truth here, including schedule-version calendars disjoint from the
        // rolling-line calendar.
        if (r.calendarId) {
            const lineCal = this.scheduleManager?.calendars?.find((c) => c.id === r.calendarId);
            if (!lineCal)
                issues.push({ level: 'ERROR', code: 'ROTATION_CALENDAR_MISSING', message: `Calendrier de ligne introuvable : ${r.calendarId}.` });
            else if (lineCal.enabled === false)
                issues.push({ level: 'ERROR', code: 'ROTATION_CALENDAR_DISABLED', message: `Le calendrier ${lineCal.name || r.calendarId} est désactivé : cette ligne ne circulera jamais.` });
        }
        for (const occ of r.occurrences) {
            const ver = this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId);
            if (!ver) {
                issues.push({ level: 'ERROR', code: 'SCHEDULE_VERSION_MISSING', occurrenceId: occ.id, message: 'Horaire/version introuvable dans le roulement.' });
                continue;
            }
            if (ver.state === 'DRAFT')
                issues.push({ level: 'ERROR', code: 'DRAFT_IN_ROTATION', occurrenceId: occ.id, message: 'Un brouillon ne peut pas être exploité dans un roulement.' });
            if (ver.state === 'NEEDS_REPAIR')
                issues.push({ level: 'ERROR', code: 'SCHEDULE_NEEDS_REPAIR', occurrenceId: occ.id, message: 'Un horaire À RÉPARER est présent dans le roulement.' });
            if (ver.calendarIds?.length) {
                const refs = ver.calendarIds.map((id) => this.scheduleManager?.calendars?.find((c) => c.id === id));
                const missing = ver.calendarIds.filter((id, i) => !refs[i]);
                if (missing.length)
                    issues.push({ level: 'ERROR', code: 'SCHEDULE_CALENDAR_MISSING', occurrenceId: occ.id, message: `Horaire ${this.scheduleManager?.getSchedule?.(occ.scheduleId)?.number || ''} : calendrier(s) introuvable(s) ${missing.join(', ')}.` });
                else if (!refs.some((c) => c.enabled !== false))
                    issues.push({ level: 'ERROR', code: 'SCHEDULE_CALENDAR_DISABLED_ALL', occurrenceId: occ.id, message: 'Tous les calendriers de cet horaire sont désactivés : cette circulation ne peut jamais rouler.' });
                else if (r.calendarId && !ver.calendarIds.some((id) => this._rotationsCanRunWithDayShift(r, { calendarId: id, enabled: true }, 0)))
                    issues.push({ level: 'ERROR', code: 'ROTATION_SCHEDULE_CALENDAR_DISJOINT', occurrenceId: occ.id, message: 'Le calendrier de cette ligne et celui de cet horaire ne possèdent aucun jour de circulation commun.' });
            }
            const memberIds = occ.formation.members.map((m) => m.vehicleId).filter(Boolean);
            const dupIds = [...new Set(memberIds.filter((id, i) => memberIds.indexOf(id) !== i))];
            for (const id of dupIds)
                issues.push({ level: 'ERROR', code: 'FORMATION_VEHICLE_DUPLICATE', occurrenceId: occ.id, vehicleId: id, message: `Le même matériel ${id} apparaît plusieurs fois dans la formation.` });
            for (const id of memberIds)
                if (!this.getVehicle(id))
                    issues.push({ level: 'ERROR', code: 'FORMATION_VEHICLE_MISSING', occurrenceId: occ.id, vehicleId: id, message: `La formation référence le matériel supprimé ${id}.` });
            for (const m of occ.formation.members) {
                if (m.sourceCouponId) {
                    const c = this.getCoupon(m.sourceCouponId);
                    if (!c)
                        issues.push({ level: 'ERROR', code: 'FORMATION_COUPON_MISSING', occurrenceId: occ.id, vehicleId: m.vehicleId, message: `La formation référence le coupon supprimé ${m.sourceCouponId}.` });
                    else if (!c.vehicleIds.includes(m.vehicleId))
                        issues.push({ level: 'ERROR', code: 'FORMATION_COUPON_MEMBERSHIP_INVALID', occurrenceId: occ.id, vehicleId: m.vehicleId, message: `${this.getVehicle(m.vehicleId)?.number || m.vehicleId} n’appartient plus au coupon ${c.name}.` });
                    else if (this._poweredVehicle(this.getVehicle(m.vehicleId)))
                        issues.push({ level: 'ERROR', code: 'COUPON_CONTAINS_POWERED_VEHICLE', occurrenceId: occ.id, vehicleId: m.vehicleId, message: `Le coupon ${c.name} contient l’engin motorisé ${this.getVehicle(m.vehicleId)?.number || m.vehicleId}; séparez la locomotive/automotrice du coupon.` });
                }
            }
            const activeMembers = occ.formation.members.filter((m) => m.role === FormationRole.LEAD || m.role === FormationRole.ACTIVE_MULTIPLE || m.role === FormationRole.PUSHER);
            if (!activeMembers.some((m) => this._poweredVehicle(this.getVehicle(m.vehicleId)))) {
                issues.push({ level: 'ERROR', code: 'NO_ACTIVE_TRACTION_ASSIGNED', occurrenceId: occ.id, message: 'Aucun engin de traction actif n’est affecté à ce train.' });
            }
            const locationIds = new Set(r.actions.filter((a) => a.occurrenceId === occ.id).map((a) => a.locationOccurrenceId));
            for (const locationId of locationIds) {
                const loc = ver.locations.find((l) => l.id === locationId);
                if (!loc) {
                    issues.push({ level: 'ERROR', code: 'ACTION_LOCATION_MISSING', occurrenceId: occ.id, locationOccurrenceId: locationId, message: 'Une opération référence un arrêt qui n’existe plus.' });
                    continue;
                }
                let required = 0;
                try {
                    required = this.operationWindowSec(r.id, occ.id, locationId);
                }
                catch (err) {
                    issues.push({ level: 'ERROR', code: 'OPERATION_DEPENDENCY_INVALID', occurrenceId: occ.id, locationOccurrenceId: locationId, message: err.message });
                    continue;
                }
                const locIndex = ver.locations.findIndex((l) => l.id === locationId);
                // Origin operations happen before departure; terminal operations consume
                // the terminal dwell/release window. Intermediate operations must fit dwell.
                if (locIndex > 0 && locIndex < ver.locations.length - 1 && (loc.dwellSec || 0) < required) {
                    issues.push({ level: 'ERROR', code: 'OPERATION_DWELL_TOO_SHORT', occurrenceId: occ.id, locationOccurrenceId: locationId, requiredSec: required, availableSec: loc.dwellSec || 0, message: `${loc.name || 'Arrêt'} : ${Math.ceil(required / 60)} min nécessaires pour les opérations, ${Math.floor((loc.dwellSec || 0) / 60)} min prévues.` });
                }
            }
            issues.push(...this._validateFormationThroughActions(r, occ, ver));
        }
        for (const a of r.actions) {
            for (const id of a.vehicleIds || [])
                if (!this.getVehicle(id))
                    issues.push({ level: 'ERROR', code: 'ACTION_VEHICLE_MISSING', actionId: a.id, message: `Une opération référence le matériel supprimé ${id}.` });
            for (const id of a.couponIds || []) {
                const c = this.getCoupon(id);
                if (!c)
                    issues.push({ level: 'ERROR', code: 'ACTION_COUPON_MISSING', actionId: a.id, message: `Une opération référence le coupon supprimé ${id}.` });
                else if (!c.vehicleIds.length)
                    issues.push({ level: 'ERROR', code: 'ACTION_COUPON_EMPTY', actionId: a.id, message: `L’opération référence le coupon vide ${c.name}.` });
                else if (c.vehicleIds.some((vid) => this._poweredVehicle(this.getVehicle(vid))))
                    issues.push({ level: 'ERROR', code: 'COUPON_CONTAINS_POWERED_VEHICLE', actionId: a.id, message: `Le coupon ${c.name} contient un engin motorisé; la locomotive/automotrice doit être sélectionnée séparément.` });
            }
        }
        // Proactive physical continuity: warn in the editor instead of discovering at
        // T-5 that a locomotive magically needs to jump from Lyon to Marseille.
        const byVehicle = new Map();
        for (const occ of r.occurrences) {
            if (occ.cancelled)
                continue;
            const ver = this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId);
            if (!ver)
                continue;
            const timed = this._timedVersionForOccurrence(occ, ver);
            let intervals = [];
            try {
                intervals = this.materialIntervals(r.id, occ.id, timed, occ.resolvedStartSec);
            }
            catch (err) {
                if (!issues.some((i) => i.code === 'OPERATION_DEPENDENCY_INVALID' && i.occurrenceId === occ.id))
                    issues.push({ level: 'ERROR', code: 'OPERATION_DEPENDENCY_INVALID', occurrenceId: occ.id, message: err?.message || String(err) });
                continue;
            }
            for (const iv of intervals) {
                if (!byVehicle.has(iv.vehicleId))
                    byVehicle.set(iv.vehicleId, []);
                byVehicle.get(iv.vehicleId).push({ ...iv, occurrenceId: occ.id });
            }
        }
        for (const [vehicleId, slots] of byVehicle) {
            slots.sort((a, b) => a.startSec - b.startSec);
            for (let i = 1; i < slots.length; i++) {
                const a = slots[i - 1], b = slots[i];
                if (a.endSec <= b.startSec && a.endLocationId && b.startLocationId && String(a.endLocationId) !== String(b.startLocationId))
                    issues.push({ level: 'ERROR', code: 'MATERIAL_LOCATION_GAP', vehicleId, occurrenceId: b.occurrenceId, message: `${this.getVehicle(vehicleId)?.number || vehicleId} termine à ${a.endLocationId} mais son service suivant commence à ${b.startLocationId}. Prévoir un acheminement/HLP ou changer le matériel.` });
            }
        }
        return issues;
    }
    // HOTFIX34 — two rolling lines may share a physical vehicle only when their
    // operating calendars can actually coexist.  The old conflict checker ignored
    // calendars entirely, so a Monday-Friday duty falsely collided with a weekend
    // duty at the same clock time.  This helper answers the exact weekly/date-range
    // question without scanning centuries of dates.
    _calendarSpecById(calendarId) {
        if (!calendarId)
            return { enabled: true, startDay: -25567, endDay: 376199, weekdays: [0, 1, 2, 3, 4, 5, 6], excluded: new Set() };
        const cal = this.scheduleManager?.calendars?.find((c) => c.id === calendarId);
        if (!cal)
            return null;
        const dayOf = (v) => { const t = Date.parse(`${v}T00:00:00Z`); return Number.isFinite(t) ? Math.floor(t / 86400000) : null; };
        return { enabled: cal.enabled !== false, startDay: dayOf(cal.startDate) ?? -25567, endDay: dayOf(cal.endDate) ?? 376199, weekdays: [...new Set((cal.weekdays || [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((x) => x >= 0 && x <= 6))], excluded: new Set((cal.excludedDates || []).map(dayOf).filter(Number.isFinite)) };
    }
    _intersectCalendarSpecs(a, b) {
        if (!a || !b || !a.enabled || !b.enabled)
            return null;
        const startDay = Math.max(a.startDay, b.startDay), endDay = Math.min(a.endDay, b.endDay);
        if (startDay > endDay)
            return null;
        const bw = new Set(b.weekdays), weekdays = a.weekdays.filter((w) => bw.has(w));
        if (!weekdays.length)
            return null;
        return { enabled: true, startDay, endDay, weekdays, excluded: new Set([...a.excluded, ...b.excluded]) };
    }
    _rotationCalendarSpec(rotation) {
        // Missing calendars remain conservative here so validation still surfaces
        // genuine material conflicts in broken saves instead of hiding them.
        return this._calendarSpecById(rotation?.calendarId) || { enabled: true, startDay: -25567, endDay: 376199, weekdays: [0, 1, 2, 3, 4, 5, 6], excluded: new Set() };
    }
    _occurrenceCalendarSpecs(rotation, occurrence) {
        const line = this._calendarSpecById(rotation?.calendarId);
        if (rotation?.calendarId && !line)
            return [this._rotationCalendarSpec(rotation)];
        const base = line || this._calendarSpecById('');
        const ver = this.scheduleManager?.getVersion?.(occurrence?.scheduleId, occurrence?.versionId);
        if (!ver?.calendarIds?.length)
            return base?.enabled ? [base] : [];
        const out = [];
        for (const id of ver.calendarIds) {
            const sc = this._calendarSpecById(id);
            if (!sc)
                continue;
            const both = this._intersectCalendarSpecs(base, sc);
            if (both)
                out.push(both);
        }
        return out;
    }
    _calendarSpecsCanRunWithDayShift(specsA, specsB, shiftDays = 0) {
        const shift = Math.trunc(Number(shiftDays) || 0);
        for (const ca of specsA || [])
            for (const cb of specsB || []) {
                if (!ca?.enabled || !cb?.enabled)
                    continue;
                const start = Math.max(ca.startDay, cb.startDay - shift), end = Math.min(ca.endDay, cb.endDay - shift);
                if (start > end)
                    continue;
                const bWeek = new Set(cb.weekdays.map((w) => (w - shift % 7 + 7) % 7));
                const common = ca.weekdays.filter((w) => bWeek.has(w));
                if (!common.length)
                    continue;
                const startWeekday = new Date(start * 86400000).getUTCDay();
                for (const w of common) {
                    let d = start + ((w - startWeekday + 7) % 7), guard = ca.excluded.size + cb.excluded.size + 2;
                    while (d <= end && guard-- > 0) {
                        if (!ca.excluded.has(d) && !cb.excluded.has(d + shift))
                            return true;
                        d += 7;
                    }
                }
            }
        return false;
    }
    _rotationsCanRunWithDayShift(a, b, shiftDays = 0) {
        return this._calendarSpecsCanRunWithDayShift([this._rotationCalendarSpec(a)], [this._rotationCalendarSpec(b)], shiftDays);
    }
    _calendarSpecsRunOnDay(specs, day) {
        const d = Math.trunc(Number(day));
        if (!Number.isFinite(d))
            return false;
        const w = new Date(d * 86400000).getUTCDay();
        return (specs || []).some((c) => c?.enabled && d >= c.startDay && d <= c.endDay && c.weekdays.includes(w) && !c.excluded.has(d));
    }
    _globalLocationConflicts(vehicleId, slots) {
        // HOTFIX35 — continuity is a rolling-DAY invariant, not an implicit
        // multi-day diagram.  The player's model describes a material day; the live
        // vehicle location remains authoritative from one real day to the next.  We
        // therefore catch impossible jumps between lines that can run on the SAME
        // base day, while J/J+1 temporal overlaps are still handled separately by the
        // double-booking engine. This preserves weekday/weekend reuse and simple
        // one-day duties without inventing overnight repositioning requirements.
        const out = [];
        slots = [...(slots || [])].sort((x, y) => x.start - y.start || x.end - y.end || String(x.rotationId).localeCompare(String(y.rotationId)));
        for (let i = 0; i < slots.length - 1; i++) {
            const a = slots[i];
            let b = null;
            for (let j = i + 1; j < slots.length; j++) {
                const cand = slots[j];
                if (cand.start < a.end)
                    continue;
                if (this._calendarSpecsCanRunWithDayShift(a.calendarSpecs, cand.calendarSpecs, 0)) {
                    b = cand;
                    break;
                }
            }
            if (!b || !a.endLocationId || !b.startLocationId || String(a.endLocationId) === String(b.startLocationId))
                continue;
            out.push({ code: 'MATERIAL_LOCATION_GAP_GLOBAL', vehicleId, first: a, second: b, message: `${this.getVehicle(vehicleId)?.number || vehicleId} termine à ${a.endLocationId} mais sa prochaine ligne du même jour commence à ${b.startLocationId}. Prévoir un HLP/acheminement explicite ou affecter un autre matériel.` });
        }
        return out;
    }
    validateMaterialConflicts() {
        const usage = new Map(), rameElementUsage = new Map(), scheduleUsage = new Map(), conflicts = [], rotationById = new Map(this.rotations.map((r) => [r.id, r]));
        const register = (vehicleId, slot) => {
            if (!vehicleId)
                return;
            if (!usage.has(vehicleId))
                usage.set(vehicleId, []);
            usage.get(vehicleId).push(slot);
        };
        for (const rotation of this.rotations) {
            if (!rotation.enabled)
                continue;
            this.recalculateRotation(rotation.id);
            for (const occ of rotation.occurrences) {
                if (occ.cancelled)
                    continue;
                const ver = this.scheduleManager?.getVersion(occ.scheduleId, occ.versionId), timed = ver ? this._timedVersionForOccurrence(occ, ver) : null;
                if (ver) {
                    const key = String(occ.scheduleId || '');
                    if (key) {
                        if (!scheduleUsage.has(key))
                            scheduleUsage.set(key, []);
                        scheduleUsage.get(key).push({ rotationId: rotation.id, occurrenceId: occ.id, versionId: occ.versionId, start: Number(occ.resolvedStartSec ?? timed?.firstDepartureSec ?? 0), end: Number(occ.resolvedEndSec ?? timed?.lastArrivalSec ?? 0), serviceDay: Math.floor((Number(ver.firstDepartureSec || 0) + Number(occ.offsetSec || 0)) / DAY), calendarSpecs: this._occurrenceCalendarSpecs(rotation, occ) });
                    }
                }
                const intervals = this.materialIntervals(rotation.id, occ.id, timed, occ.resolvedStartSec);
                const byRame = new Map();
                for (const iv of intervals) {
                    const slot = { rotationId: rotation.id, occurrenceId: occ.id, start: iv.startSec, end: iv.endSec, role: iv.role, reason: iv.reason, startLocationId: iv.startLocationId || '', endLocationId: iv.endLocationId || '', calendarSpecs: this._occurrenceCalendarSpecs(rotation, occ) };
                    register(iv.vehicleId, slot);
                    const v = this.getVehicle(iv.vehicleId);
                    if (v?.sourceRameId && Number.isInteger(v.sourceRameElementIndex)) {
                        const cur = byRame.get(v.sourceRameId) || { start: Infinity, end: -Infinity };
                        cur.start = Math.min(cur.start, iv.startSec);
                        cur.end = Math.max(cur.end, iv.endSec);
                        byRame.set(v.sourceRameId, cur);
                    }
                }
                for (const [rameId, iv] of byRame) {
                    if (!rameElementUsage.has(rameId))
                        rameElementUsage.set(rameId, []);
                    rameElementUsage.get(rameId).push({ rotationId: rotation.id, occurrenceId: occ.id, start: iv.start, end: iv.end });
                }
            }
        }
        // RC2: simple assignments are live duties again (HOTFIX64). Register
        // them before the shared checks, with the same calendars and J/J+n rules.
        const includeDirect = globalThis.window?.game?.realismSettings?.rotationsRequired !== true;
        for (const a of includeDirect ? this.directAssignments : []) {
            if (!a.enabled || a.cancelled || this.directAssignmentSuppressed(a))
                continue;
            const ver = this.scheduleManager?.getVersion(a.scheduleId, a.versionId);
            if (!ver || ver.state !== 'VALID')
                continue;
            const timed = this._timedVersionForOccurrence(a, ver);
            const start = Number(timed.firstDepartureSec), end = Math.max(start, Number(timed.lastArrivalSec));
            if (!Number.isFinite(start) || !Number.isFinite(end))
                continue;
            const calendarSpecs = this._occurrenceCalendarSpecs({ enabled: true, calendarId: '' }, a);
            const first = timed.locations[0], last = timed.locations[timed.locations.length - 1];
            const slot = {
                rotationId: `direct:${a.id}`, occurrenceId: a.id, start, end, direct: true, calendarSpecs,
                startLocationId: first?.stationId || first?.technicalLocationId || '',
                endLocationId: last?.stationId || last?.technicalLocationId || '',
            };
            for (const member of a.formation.members)
                register(member.vehicleId, { ...slot, role: member.role });
            // A proxy may be the only material in an old save. Keep the whole-rame
            // resource in the common registry as well as individual elements.
            if (a.rameId)
                register(`rame:${a.rameId}`, slot);
            if (!scheduleUsage.has(a.scheduleId))
                scheduleUsage.set(a.scheduleId, []);
            scheduleUsage.get(a.scheduleId).push({ ...slot, calendarSpecs, versionId: a.versionId, serviceDay: Math.floor(start / DAY) });
        }
        for (const [rameId, slots] of rameElementUsage) {
            for (const slot of slots) {
                const rotation = rotationById.get(slot.rotationId);
                const occurrence = rotation?.occurrences.find(o => o.id === slot.occurrenceId);
                if (rotation && occurrence)
                    register(`rame:${rameId}`, { ...slot, calendarSpecs: this._occurrenceCalendarSpecs(rotation, occurrence) });
            }
        }
        // Compare physical usage only on dates where both rolling lines can run.
        // This keeps mutually-exclusive calendars reusable while preserving strict
        // double-booking protection for lines that can coexist.
        for (const [vehicleId, slots] of usage) {
            slots.sort((x, y) => x.start - y.start || x.end - y.end || String(x.rotationId).localeCompare(String(y.rotationId)));
            // Compare not only J with J, but also repeated base dates. A 25-hour
            // circulation must not reuse its locomotive on J+1 while yesterday's train
            // is still running. Candidate day shifts are derived mathematically from
            // the two intervals, so ordinary one-hour duties do not create extra work.
            const DAY = 86400;
            for (let i = 0; i < slots.length; i++)
                for (let j = i; j < slots.length; j++) {
                    const a = slots[i], b = slots[j], ra = rotationById.get(a.rotationId), rb = rotationById.get(b.rotationId);
                    const low = Math.floor((a.start - b.end) / DAY) + 1, high = Math.ceil((a.end - b.start) / DAY) - 1;
                    let hit = null;
                    for (let shift = low; shift <= high; shift++) {
                        if (i === j && shift <= 0)
                            continue; // self-template: compare only future repetitions
                        if (i !== j && shift === 0 && j < i)
                            continue;
                        if (!this._calendarSpecsCanRunWithDayShift(a.calendarSpecs, b.calendarSpecs, shift))
                            continue;
                        const bs = b.start + shift * DAY, be = b.end + shift * DAY;
                        if (bs < a.end && be > a.start) {
                            const aa = { ...a, dayShift: 0 }, bb = { ...b, start: bs, end: be, dayShift: shift };
                            hit = aa.start <= bb.start ? [aa, bb] : [bb, aa];
                            break;
                        }
                    }
                    if (hit)
                        conflicts.push({ code: 'VEHICLE_DOUBLE_BOOKED', vehicleId, first: hit[0], second: hit[1] });
                }
            conflicts.push(...this._globalLocationConflicts(vehicleId, slots));
        }
        // HOTFIX35 — one published timetable is one physical train identity. It may
        // exist in several rolling-line templates only when their operating calendars
        // are mutually exclusive. If two lines can publish the same schedule on the
        // same service day, surface it before runtime and never create a duplicate train.
        for (const [scheduleId, slots] of scheduleUsage) {
            if (slots.length < 2)
                continue;
            for (let i = 0; i < slots.length; i++)
                for (let j = i + 1; j < slots.length; j++) {
                    const a = slots[i], b = slots[j];
                    const shift = a.serviceDay - b.serviceDay;
                    if (!this._calendarSpecsCanRunWithDayShift(a.calendarSpecs, b.calendarSpecs, shift))
                        continue;
                    conflicts.push({ code: 'SCHEDULE_DOUBLE_ASSIGNED', scheduleId, first: a, second: b, message: `L’horaire ${this.scheduleManager?.getSchedule?.(scheduleId)?.number || scheduleId} est affecté à plusieurs lignes de roulement pouvant circuler le même jour.` });
                }
        }
        return conflicts;
    }
    toSave() {
        return {
            schemaVersion: ROTATION_V2_SCHEMA,
            // `available` is an ephemeral runtime lock. ActiveService V2 objects are
            // deliberately not persisted, so persisting available=false would leave
            // ghost-occupied locomotives after reload with no service owning them.
            vehicles: this.vehicles.map((v) => ({ ...v.toJSON(), available: true })),
            coupons: this.coupons.map((c) => c.toJSON()),
            rotations: this.rotations.map((r) => r.toJSON()),
            directAssignments: this.directAssignments.map((a) => a.toJSON()), // HOTFIX64: simplified operation persists direct Rame assignments.
            stationCodes: { ...this.stationCodes },
        };
    }
    loadFromSave(data) {
        if (!data || ![2, 3, 4, 5, ROTATION_V2_SCHEMA].includes(Number(data.schemaVersion)))
            return false;
        let vehicles = [], coupons = [], rotations = [], directAssignments = [], stationCodes = {}, loadWarnings = [];
        try {
            vehicles = arr(data.vehicles).map((v) => { const pv = new PhysicalVehicle(v); pv.available = true; return pv; });
            coupons = arr(data.coupons).map((c) => new Coupon(c));
            rotations = arr(data.rotations).map((r) => new Rotation(r));
            directAssignments = arr(data.directAssignments).map((a) => new DirectScheduleAssignment(a));
            stationCodes = data.stationCodes && typeof data.stationCodes === 'object' && !Array.isArray(data.stationCodes) ? Object.fromEntries(Object.entries(data.stationCodes).map(([k, v]) => [String(k), String(v || '').trim().toUpperCase()]).filter(([, v]) => /^[A-Z0-9]{1,8}$/.test(v))) : {};
            const unique = (items, label) => {
                const ids = new Set();
                for (const x of items) {
                    const id = String(x?.id || '');
                    if (!id || ids.has(id))
                        throw new Error(`${label}: identifiant vide ou dupliqué (${id || '?'})`);
                    ids.add(id);
                }
            };
            unique(vehicles, 'Véhicules');
            unique(coupons, 'Coupons');
            unique(rotations, 'Roulements');
            unique(directAssignments, 'Affectations directes');
            // HOTFIX35 — physical coupons are exclusive ownership groups. Older saves
            // could accidentally put the same coach/wagon in several coupons or retain
            // deleted vehicle ids. Repair deterministically on load (first coupon wins)
            // instead of duplicating physical stock or refusing the whole save.
            const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
            const vehicleIds = new Set(vehicleById.keys()), couponOwner = new Map();
            for (const c of coupons) {
                const kept = [];
                for (const id of c.vehicleIds) {
                    if (!vehicleIds.has(id)) {
                        loadWarnings.push(`Coupon ${c.name || c.id}: matériel supprimé ${id} retiré.`);
                        continue;
                    }
                    const owner = couponOwner.get(id);
                    if (owner) {
                        loadWarnings.push(`Coupon ${c.name || c.id}: ${id} déjà possédé par ${owner}; doublon retiré.`);
                        continue;
                    }
                    couponOwner.set(id, c.name || c.id);
                    kept.push(id);
                }
                c.vehicleIds = kept;
                if (kept.some((id) => { const v = vehicleById.get(id); return Number(v?.powerW || 0) > 0 || String(v?.category || '').toLowerCase().includes('locomotive') || String(v?.category || '').toLowerCase().includes('automotrice') || String(v?.category || '').toLowerCase().includes('autorail') || String(v?.category || '').toLowerCase().includes('locotracteur'); }))
                    loadWarnings.push(`Coupon ${c.name || c.id}: contient un engin motorisé hérité; séparez-le du coupon avant exploitation.`);
                if (!kept.length)
                    loadWarnings.push(`Coupon ${c.name || c.id}: coupon vide après réparation; recréez-le avant utilisation.`);
            }
            for (const r of rotations) {
                unique(r.occurrences || [], `Occurrences ${r.id}`);
                unique(r.actions || [], `Opérations ${r.id}`);
                r.normalize();
                const occIds = new Set(r.occurrences.map((o) => o.id));
                // Ghost actions can survive deleted occurrences in old saves. They are
                // invisible in the editor but still poison dependency windows/conflicts.
                r.actions = r.actions.filter((a) => occIds.has(a.occurrenceId));
            }
            // Current UI contract is one direct assignment per schedule. Old/corrupt
            // saves with duplicates would otherwise compile duplicate trains.
            const seenDirectSchedules = new Set();
            directAssignments = directAssignments.filter((a) => a.scheduleId && a.versionId && !seenDirectSchedules.has(a.scheduleId) && (seenDirectSchedules.add(a.scheduleId), true));
            // Normalize legacy J+n on staged objects. Nothing live is replaced until
            // every migration/validation step has completed successfully.
            for (const rotation of rotations)
                for (const occ of rotation.occurrences) {
                    const ver = this.scheduleManager?.getVersion?.(occ.scheduleId, occ.versionId);
                    this._canonicalizeOccurrenceDayOffset(occ, ver);
                }
        }
        catch (err) {
            console.error('Rotation V2 chargement refusé:', err);
            return false;
        }
        // HOTFIX64 — schema 6 reintroduces direct Rame assignments as the optional
        // beginner path. Legacy schema 2–4 direct payloads keep the old safe migration
        // into one-service rotation lines; schema 5 never persisted direct assignments.
        if (Number(data.schemaVersion) < 6 && directAssignments.length) {
            for (const a of directAssignments) {
                if (rotations.some((r) => (r.occurrences || []).some((o) => o.scheduleId === a.scheduleId)))
                    continue;
                const rec = this.scheduleManager?.getSchedule?.(a.scheduleId);
                const number = rec?.number || a.scheduleId || 'horaire';
                const r = new Rotation({ name: `Migré — ${number}`, assignedRameId: a.rameId || '', assignedFormation: a.formation?.toJSON?.() || a.formation || {} });
                r.occurrences.push(new ScheduleOccurrence({ scheduleId: a.scheduleId, versionId: a.versionId, formation: a.formation?.toJSON?.() || a.formation || {}, usesAssignedFormation: true, sequence: 0 }));
                r.normalize();
                rotations.push(r);
            }
        }
        if (Number(data.schemaVersion) < 6)
            directAssignments = [];
        this.vehicles = vehicles;
        this.coupons = coupons;
        this.rotations = rotations;
        this.directAssignments = directAssignments;
        this.stationCodes = stationCodes;
        this.loadWarnings = loadWarnings;
        if (this.loadWarnings.length)
            console.warn('Rotation V2 — réparations de sauvegarde:', ...this.loadWarnings);
        for (const r of this.rotations)
            try {
                this.recalculateRotation(r.id);
            }
            catch { }
        return true;
    }
}
