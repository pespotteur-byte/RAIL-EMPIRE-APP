import { type MaterialTrackLocation } from './material-track-location.js';
type UnknownRecord = Record<string, unknown>;
type NumericMap = Record<string, number>;
interface RameLocation extends MaterialTrackLocation {
    depotId: string;
    stationId: string;
    serviceId: string;
    lat: number | null;
    lon: number | null;
}
interface RameElementDetail extends UnknownRecord {
    imageData?: string;
    liveryId?: string;
    originalImageData?: string;
    elementId: string;
    catalogId: string;
    name: string;
    instanceName: string;
    instanceNumber: string | null;
    seriesName: string;
    category: string;
    traction: string;
    maxSpeed: number;
    tonnage: number;
    mass: number;
    power: number;
    passengerCapacity: number;
    freightCapacity: number;
    length: number;
    purchasePrice: number;
    wagonSubCategory: string;
    cargoTypes: string[];
    technicallyCompatibleCargoTypes: string[];
    electricSystems: UnknownRecord[];
    gauges: number[];
    gauge?: number;
    isDrivingTrailer: boolean;
    flipped: boolean;
    homeDepotId: string;
}
interface RameConsumables {
    fuelCapacityL: number;
    fuelL: number;
    sandCapacityKg: number;
    sandKg: number;
    oilCapacityL: number;
    oilL: number;
    coolantCapacityL: number;
    coolantL: number;
    adblueCapacityL: number;
    adblueL: number;
    gearboxOilCapacityL: number;
    gearboxOilL: number;
    hydraulicOilCapacityL: number;
    hydraulicOilL: number;
    washerCapacityL: number;
    washerL: number;
}
interface RollingStockLookup {
    getById(id: unknown): UnknownRecord | null | undefined;
}
interface ReconcileInput {
    depots?: Array<{
        id?: unknown;
    }>;
    stations?: Array<{
        id?: unknown;
    }>;
    services?: Array<{
        id?: unknown;
    }>;
}
export declare class Rame {
    id: string;
    serialNumber: string;
    name: string;
    elements: string[];
    elementDetails: RameElementDetail[];
    createdDate: string;
    totalKmRun: number;
    kmSinceLastMaint: number;
    wearLevel: number;
    inMaintenance: boolean;
    lastMaintenanceMonth: string;
    recommendedMaintenance: boolean;
    depotId: string;
    currentLocation: RameLocation;
    pendingDefects: string[];
    cleanliness: {
        exterior: number;
        interior: number;
    };
    consumables: RameConsumables;
    depotOperationId: string;
    randomizeOnDeparture: boolean;
    randomMaxVehicles: number | null;
    randomLastDepartureKey: string;
    constructor(input?: unknown);
    get totalLength(): number;
    get totalTonnage(): number;
    get totalCapacity(): number;
    get totalFreightCapacity(): number;
    get freightCapacityByCargo(): NumericMap;
    getFreightCapacityForCargo(cargoType: unknown): number;
    get maxGrossMass(): number;
    get maxSpeed(): number;
    get traction(): string;
    get totalMass(): number;
    get totalPower(): number;
    get adhesionMass(): number;
    getTotalMassWithPayload(loadFactor?: unknown): number;
    get isValid(): boolean;
}
export declare class RameManager {
    rames: Rame[];
    constructor();
    add(data: unknown): Rame;
    remove(id: unknown): boolean;
    update(id: unknown, input?: unknown): Rame | null;
    getById(id: unknown): Rame | undefined;
    getAll(): Rame[];
    toSave(): {
        id: string;
        serialNumber: string;
        randomizeOnDeparture: boolean;
        randomMaxVehicles: number | null;
        randomLastDepartureKey: string;
        name: string;
        elements: string[];
        elementDetails: RameElementDetail[];
        createdDate: string;
        totalKmRun: number;
        kmSinceLastMaint: number;
        wearLevel: number;
        inMaintenance: boolean;
        lastMaintenanceMonth: string;
        recommendedMaintenance: boolean;
        depotId: string;
        currentLocation: RameLocation;
        pendingDefects: string[];
        cleanliness: {
            exterior: number;
            interior: number;
        };
        consumables: RameConsumables;
        depotOperationId: string;
    }[];
    loadFromSave(arr: unknown, rollingStock?: RollingStockLookup | null): void;
    reconcileReferences({ depots, stations, services }?: ReconcileInput): void;
}
export {};
