import { maximumVehicleCount } from './rame-random.js';
import { saveLiveryTarget } from './livery-model.js';
import { materialTrackLocation } from './material-track-location.js';
let nextRameId = 1;
let nextRameElementId = 1;
function text(value, fallback = '') {
    if (value == null)
        return fallback;
    const s = String(value).trim();
    return s || fallback;
}
function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function nonNegative(value, fallback = 0) { return Math.max(0, finite(value, fallback)); }
function positive(value, fallback = 0) { const n = finite(value, fallback); return n > 0 ? n : fallback; }
function stringArray(value) { return Array.isArray(value) ? [...new Set(value.map((v) => text(v)).filter(Boolean))] : []; }
function validLat(value) { if (value == null || value === '')
    return null; const n = Number(value); return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null; }
function validLon(value) { if (value == null || value === '')
    return null; const n = Number(value); return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null; }
function normalizeLocation(raw = {}, depotFallback = '') {
    const loc = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        ...materialTrackLocation(loc),
        depotId: text(loc.depotId, text(depotFallback)),
        stationId: text(loc.stationId),
        serviceId: text(loc.serviceId),
        lat: validLat(loc.lat),
        lon: validLon(loc.lon),
    };
}
function normalizeElement(raw = {}, fallbackStockId = '') {
    const e = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const category = text(e.category);
    const mass = positive(e.mass, positive(e.tonnage, 0));
    const tonnage = positive(e.tonnage, mass);
    const freightCapacity = nonNegative(e.freightCapacity, 0);
    const maxSpeed = positive(e.maxSpeed, 0);
    const detail = {
        ...e,
        elementId: text(e.elementId),
        catalogId: text(e.catalogId, text(fallbackStockId)),
        name: text(e.name, 'Élément'),
        instanceName: text(e.instanceName, text(e.name, 'Élément')),
        instanceNumber: e.instanceNumber == null ? null : text(e.instanceNumber),
        seriesName: text(e.seriesName),
        category,
        traction: text(e.traction, 'none'),
        maxSpeed,
        tonnage,
        mass,
        power: nonNegative(e.power, 0),
        passengerCapacity: nonNegative(e.passengerCapacity, 0),
        freightCapacity,
        length: positive(e.length, 0),
        purchasePrice: nonNegative(e.purchasePrice, 0),
        wagonSubCategory: text(e.wagonSubCategory),
        cargoTypes: stringArray(e.cargoTypes),
        technicallyCompatibleCargoTypes: stringArray(e.technicallyCompatibleCargoTypes),
        electricSystems: Array.isArray(e.electricSystems) ? e.electricSystems.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).map((x) => ({ ...x })) : [],
        gauges: Array.isArray(e.gauges) ? [...new Set(e.gauges.map(Number).filter(Number.isFinite))] : [],
        gauge: Number.isFinite(Number(e.gauge)) ? Number(e.gauge) : undefined,
        isDrivingTrailer: !!e.isDrivingTrailer,
        flipped: !!e.flipped,
        homeDepotId: text(e.homeDepotId),
    };
    return detail;
}
function makeRameElementId(rameId = 'rame') {
    return `${rameId}-el-${nextRameElementId++}`;
}
export class Rame {
    constructor(input = {}) {
        this.randomizeOnDeparture = false;
        this.randomMaxVehicles = null;
        this.randomLastDepartureKey = '';
        const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const rawId = text(data.id);
        this.id = rawId || `rame-${nextRameId++}`;
        this.serialNumber = text(data.serialNumber);
        this.randomizeOnDeparture = data.randomizeOnDeparture === true;
        try {
            this.randomMaxVehicles = maximumVehicleCount(data.randomMaxVehicles);
        }
        catch {
            this.randomMaxVehicles = null;
        }
        this.randomLastDepartureKey = text(data.randomLastDepartureKey);
        this.name = text(data.name, 'Sans nom');
        const rawElements = Array.isArray(data.elements) ? data.elements : [];
        const rawDetails = Array.isArray(data.elementDetails) ? data.elementDetails : [];
        this.elementDetails = rawDetails
            .filter((e) => e && typeof e === 'object' && !Array.isArray(e))
            .map((e, i) => {
            const detail = normalizeElement(e, rawElements[i]);
            if (!detail.elementId)
                detail.elementId = makeRameElementId(this.id);
            return detail;
        });
        // Keep element IDs index-aligned with the detailed consist. A malformed save
        // must not leave 12 ids for 8 actual vehicles (or vice versa).
        this.elements = this.elementDetails.map((e, i) => text(rawElements[i], e.catalogId));
        this.createdDate = /^\d{4}-\d{2}-\d{2}$/.test(text(data.createdDate)) ? text(data.createdDate) : new Date().toISOString().split('T')[0];
        this.totalKmRun = nonNegative(data.totalKmRun, 0);
        this.kmSinceLastMaint = nonNegative(data.kmSinceLastMaint, 0);
        this.wearLevel = Math.min(100, nonNegative(data.wearLevel, 0));
        this.inMaintenance = !!data.inMaintenance;
        this.lastMaintenanceMonth = /^\d{4}-\d{2}$/.test(text(data.lastMaintenanceMonth)) ? text(data.lastMaintenanceMonth) : '';
        this.recommendedMaintenance = !!data.recommendedMaintenance;
        // HOTFIX50 — depotId is the HOME depot only. Physical presence is stored
        // separately in currentLocation.depotId and is never inferred automatically.
        this.depotId = text(data.depotId);
        this.currentLocation = normalizeLocation(data.currentLocation, '');
        this.pendingDefects = stringArray(data.pendingDefects);
        const cleanPct = (v, fb = 100) => Math.max(0, Math.min(100, finite(v, fb)));
        const cleanliness = data.cleanliness && typeof data.cleanliness === 'object' && !Array.isArray(data.cleanliness) ? data.cleanliness : {};
        this.cleanliness = {
            exterior: cleanPct(cleanliness.exterior, 100),
            interior: cleanPct(cleanliness.interior, 100),
        };
        const powered = this.elementDetails.filter((e) => e.category === 'locomotive' || e.category === 'automotrice');
        const dieselUnits = powered.filter((e) => /diesel|therm|gazole|bimode|hybrid/i.test(String(e.traction || ''))).length;
        const defaultFuelCap = dieselUnits * 3000;
        const defaultSandCap = Math.max(0, powered.length * 200);
        const levels = data.consumables && typeof data.consumables === 'object' && !Array.isArray(data.consumables) ? data.consumables : {};
        const cap = (v, fb) => Math.max(0, finite(v, fb));
        const qty = (v, c, fb = c) => Math.max(0, Math.min(c, finite(v, fb)));
        const fuelCapacityL = cap(levels.fuelCapacityL, defaultFuelCap);
        const sandCapacityKg = cap(levels.sandCapacityKg, defaultSandCap);
        const oilCapacityL = cap(levels.oilCapacityL, dieselUnits * 120);
        const coolantCapacityL = cap(levels.coolantCapacityL, dieselUnits * 220);
        const adblueCapacityL = cap(levels.adblueCapacityL, 0);
        const gearboxOilCapacityL = cap(levels.gearboxOilCapacityL, dieselUnits * 80);
        const hydraulicOilCapacityL = cap(levels.hydraulicOilCapacityL, powered.length * 25);
        const cabUnits = Math.max(1, this.elementDetails.filter((e) => e.isDrivingTrailer || e.category === 'locomotive' || e.category === 'automotrice').length);
        const washerCapacityL = cap(levels.washerCapacityL, cabUnits * 18);
        this.consumables = {
            fuelCapacityL, fuelL: qty(levels.fuelL, fuelCapacityL),
            sandCapacityKg, sandKg: qty(levels.sandKg, sandCapacityKg),
            oilCapacityL, oilL: qty(levels.oilL, oilCapacityL),
            coolantCapacityL, coolantL: qty(levels.coolantL, coolantCapacityL),
            adblueCapacityL, adblueL: qty(levels.adblueL, adblueCapacityL),
            gearboxOilCapacityL, gearboxOilL: qty(levels.gearboxOilL, gearboxOilCapacityL),
            hydraulicOilCapacityL, hydraulicOilL: qty(levels.hydraulicOilL, hydraulicOilCapacityL),
            washerCapacityL, washerL: qty(levels.washerL, washerCapacityL),
        };
        this.depotOperationId = text(data.depotOperationId);
    }
    get totalLength() {
        return this.elementDetails.reduce((s, e) => s + positive(e.length, 0), 0);
    }
    get totalTonnage() {
        return this.elementDetails.reduce((s, e) => s + nonNegative(e.tonnage, 0), 0);
    }
    get totalCapacity() {
        return this.elementDetails.reduce((s, e) => s + nonNegative(e.passengerCapacity, 0), 0);
    }
    get totalFreightCapacity() {
        return this.elementDetails.reduce((s, e) => {
            // Explicit zero is meaningful: never turn the wagon's OWN mass into payload.
            if (Object.prototype.hasOwnProperty.call(e, 'freightCapacity'))
                return s + nonNegative(e.freightCapacity, 0);
            // Very old saves may lack freightCapacity entirely. Their historical tonnage
            // sometimes represented gross mass, so only the positive gross-empty delta is safe.
            if (e.category === 'wagon')
                return s + Math.max(0, nonNegative(e.tonnage, 0) - nonNegative(e.mass, 0));
            return s;
        }, 0);
    }
    // Exact catalogue cargo -> usable payload map. A zero-capacity catalogue row is
    // never allowed to create phantom freight capacity merely because it has labels.
    get freightCapacityByCargo() {
        const out = {};
        for (const e of this.elementDetails) {
            if (e.category !== 'wagon')
                continue;
            const cap = nonNegative(e.freightCapacity, 0);
            if (!(cap > 0))
                continue;
            for (const type of stringArray(e.cargoTypes))
                out[type] = (out[type] || 0) + cap;
        }
        return out;
    }
    getFreightCapacityForCargo(cargoType) {
        const key = text(cargoType);
        return key ? nonNegative(this.freightCapacityByCargo[key], 0) : 0;
    }
    get maxGrossMass() {
        return this.totalMass + this.totalFreightCapacity;
    }
    get maxSpeed() {
        if (this.elementDetails.length === 0)
            return 0;
        return Math.min(...this.elementDetails.map((e) => positive(e.maxSpeed, 0)));
    }
    get traction() {
        const tractors = this.elementDetails.filter((e) => e.category === 'locomotive' || e.category === 'automotrice');
        if (tractors.length === 0)
            return 'none';
        const tractions = [...new Set(tractors.map((t) => text(t.traction, 'none')))];
        return tractions.join('+');
    }
    // Physics: total empty mass (tonnes)
    get totalMass() {
        return this.elementDetails.reduce((s, e) => s + positive(e.mass, positive(e.tonnage, 0)), 0);
    }
    // Physics: total power (kW) from traction units
    get totalPower() {
        return this.elementDetails
            .filter((e) => e.category === 'locomotive' || e.category === 'automotrice')
            .reduce((s, e) => s + nonNegative(e.power, 0), 0);
    }
    // v1.1.73 — adhesive mass is ONLY the mass carried by powered vehicles.
    // A locomotive hauling 1,500 t does not magically gain the wagons' weight
    // on its driven axles. This value is in tonnes, matching totalMass.
    get adhesionMass() {
        const powered = this.elementDetails.filter((e) => (e.category === 'locomotive' || e.category === 'automotrice') && nonNegative(e.power, 0) > 0);
        return powered.reduce((s, e) => s + positive(e.mass, positive(e.tonnage, 0)), 0);
    }
    // Physics: total mass including payload estimate
    getTotalMassWithPayload(loadFactor = 0.7) {
        const factor = Math.min(1, Math.max(0, finite(loadFactor, 0.7)));
        const passengerMass = this.totalCapacity * factor * 0.08; // ~80kg per passenger
        const freightMass = this.totalFreightCapacity * factor;
        return this.totalMass + passengerMass + freightMass;
    }
    get isValid() {
        return this.totalLength > 0 && this.totalLength <= 750 && this.elementDetails.length > 0 && this.maxSpeed > 0;
    }
}
export class RameManager {
    constructor() {
        this.rames = [];
    }
    add(data) {
        const rame = new Rame(data);
        this.rames.push(rame);
        return rame;
    }
    remove(id) {
        const key = text(id);
        const before = this.rames.length;
        this.rames = this.rames.filter((r) => r.id !== key);
        return this.rames.length !== before;
    }
    update(id, input = {}) {
        const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const rame = this.getById(text(id));
        if (!rame)
            return null;
        if (data.randomizeOnDeparture !== undefined)
            rame.randomizeOnDeparture = data.randomizeOnDeparture === true;
        if (data.randomMaxVehicles !== undefined)
            rame.randomMaxVehicles = maximumVehicleCount(data.randomMaxVehicles);
        if (data.name !== undefined)
            rame.name = text(data.name, 'Sans nom');
        if (data.serialNumber !== undefined)
            rame.serialNumber = text(data.serialNumber);
        if (data.depotId !== undefined)
            rame.depotId = text(data.depotId);
        if (Array.isArray(data.elementDetails)) {
            const rawElements = Array.isArray(data.elements) ? data.elements : rame.elements;
            rame.elementDetails = data.elementDetails.filter((e) => e && typeof e === 'object' && !Array.isArray(e)).map((e, i) => {
                const detail = normalizeElement(e, rawElements?.[i]);
                if (!detail.elementId)
                    detail.elementId = makeRameElementId(rame.id);
                return detail;
            });
            rame.elements = rame.elementDetails.map((e, i) => text(rawElements?.[i], e.catalogId));
        }
        else if (Array.isArray(data.elements)) {
            rame.elements = data.elements.slice(0, rame.elementDetails.length).map((v) => text(v));
        }
        return rame;
    }
    getById(id) {
        const key = text(id);
        return this.rames.find((r) => r.id === key);
    }
    getAll() {
        return this.rames;
    }
    toSave() {
        return this.rames.map((r) => ({
            id: r.id,
            serialNumber: r.serialNumber,
            randomizeOnDeparture: r.randomizeOnDeparture,
            randomMaxVehicles: r.randomMaxVehicles,
            randomLastDepartureKey: r.randomLastDepartureKey,
            name: r.name,
            elements: r.elements,
            elementDetails: r.elementDetails.map(saveLiveryTarget),
            createdDate: r.createdDate,
            totalKmRun: r.totalKmRun,
            kmSinceLastMaint: r.kmSinceLastMaint,
            wearLevel: r.wearLevel,
            inMaintenance: r.inMaintenance,
            lastMaintenanceMonth: r.lastMaintenanceMonth,
            recommendedMaintenance: r.recommendedMaintenance,
            depotId: r.depotId,
            currentLocation: r.currentLocation,
            pendingDefects: r.pendingDefects,
            cleanliness: r.cleanliness,
            consumables: r.consumables,
            depotOperationId: r.depotOperationId,
        }));
    }
    loadFromSave(arr, rollingStock = null) {
        this.rames = [];
        const rows = Array.isArray(arr) ? arr : [];
        const seen = new Set();
        for (const raw of rows) {
            if (!raw || typeof raw !== 'object')
                continue;
            const data = { ...raw };
            // Recover very old consists that persisted catalogue ids but lost details.
            if ((!Array.isArray(data.elementDetails) || data.elementDetails.length === 0) && Array.isArray(data.elements) && rollingStock?.getById) {
                data.elementDetails = data.elements.map((id) => {
                    const stock = rollingStock.getById(id);
                    return stock ? { ...stock, catalogId: stock.id } : null;
                }).filter(Boolean);
            }
            const rame = new Rame(data);
            if (!rame.id || seen.has(rame.id))
                continue;
            seen.add(rame.id);
            this.rames.push(rame);
            const m = /^rame-(\d+)$/.exec(rame.id);
            const num = m ? Number(m[1]) : 0;
            if (num >= nextRameId)
                nextRameId = num + 1;
        }
    }
    reconcileReferences({ depots = [], stations = [], services = [] } = {}) {
        const depotIds = new Set((Array.isArray(depots) ? depots : []).map((d) => text(d?.id)).filter(Boolean));
        const stationIds = new Set((Array.isArray(stations) ? stations : []).map((s) => text(s?.id)).filter(Boolean));
        const serviceIds = new Set((Array.isArray(services) ? services : []).map((s) => text(s?.id)).filter(Boolean));
        for (const rame of this.rames) {
            if (rame.depotId && !depotIds.has(rame.depotId))
                rame.depotId = '';
            const loc = normalizeLocation(rame.currentLocation, '');
            if (loc.depotId && !depotIds.has(loc.depotId))
                loc.depotId = '';
            if (loc.stationId && !stationIds.has(loc.stationId))
                loc.stationId = '';
            // A service id can legitimately disappear across reload because ActiveService
            // is derived. Clear only when a concrete services list was supplied.
            if (loc.serviceId && services.length && !serviceIds.has(loc.serviceId))
                loc.serviceId = '';
            for (const el of rame.elementDetails || [])
                if (el.homeDepotId && !depotIds.has(el.homeDepotId))
                    el.homeDepotId = '';
            rame.currentLocation = loc;
        }
    }
}
