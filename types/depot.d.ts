import { ActiveService } from './schedule-creator.js';
import { RescueMovement, type RescueMotionSnapshot } from './rescue-movement.js';
type __KPStruct38 = {
    "depotOperationId": unknown;
    "id": unknown;
    "currentLocation": Record<string, unknown>;
    "inMaintenance": unknown;
};
import type { Economy } from './economy.js';
import type { World } from './world.js';
import { type NormalizedRailSection, type RailBinding, type RailPoint } from './rail-section-geometry.js';
import { Rame, type RameManager } from './rame.js';
type DepotServiceRuntime = {
    rame?: {
        id?: unknown;
    };
    train?: {
        inDepot?: boolean;
        inMaintenance?: boolean;
    };
    completed?: unknown;
    cancelled?: unknown;
    state?: unknown;
};
type DepotStaffBridge = {
    checkDepotStaff?: (depotId: string, needs: Record<string, unknown>) => {
        ok: boolean;
        shortages: Array<{
            label: unknown;
            free: unknown;
            need: unknown;
        }>;
    };
    reserveDepotStaff?: (depotId: string, needs: Record<string, unknown>, operationId: string, label: string) => {
        ok: boolean;
        staffIds?: string[];
    };
    releaseDepotTask?: (operationId: string) => unknown;
};
type BrokenServiceForRescue = {
    id?: unknown;
    position?: {
        lat?: unknown;
        lon?: unknown;
    } | null;
    getCurrentRoute?: () => Array<{
        electrified?: unknown;
    }> | null | undefined;
    _state?: {
        cachedRoute?: Array<{
            electrified?: unknown;
        }>;
    };
    train?: {
        breakdown?: {
            type?: unknown;
        };
    };
};
export interface DepotResourceDefinition {
    label: string;
    unit: string;
    price: number;
    stock: boolean;
    defaultCapacity: number;
    category: string;
}
export interface DepotEquipmentDefinition {
    label: string;
    category: string;
    price: number;
    maxCount: number;
    description: string;
}
export interface DepotOperationDefinition {
    label: string;
    group: string;
    duration: number;
    staff: Record<string, number>;
    dynamic?: 'fuel' | 'sand' | 'fluids' | 'washer' | 'engine';
    resources?: Record<string, number>;
    parts?: Record<string, number>;
    equipment?: string[];
    requires?: string;
}
export declare const DEPOT_RESOURCE_CATALOG: Readonly<Record<string, DepotResourceDefinition>>;
export declare const DEPOT_STAFF_CATALOG: Readonly<{
    chef_equipe: {
        label: string;
        category: string;
    };
    agent_manoeuvre: {
        label: string;
        category: string;
    };
    agent_visite: {
        label: string;
        category: string;
    };
    agent_maintenance: {
        label: string;
        category: string;
    };
    electromecanicien: {
        label: string;
        category: string;
    };
    mecanicien_diesel: {
        label: string;
        category: string;
    };
    technicien_traction_elec: {
        label: string;
        category: string;
    };
    technicien_pneumatique: {
        label: string;
        category: string;
    };
    specialiste_freinage: {
        label: string;
        category: string;
    };
    specialiste_essieux: {
        label: string;
        category: string;
    };
    agent_levage: {
        label: string;
        category: string;
    };
    technicien_hvac: {
        label: string;
        category: string;
    };
    chaudronnier_soudeur: {
        label: string;
        category: string;
    };
    electricien_bord: {
        label: string;
        category: string;
    };
    agent_avitaillement: {
        label: string;
        category: string;
    };
    agent_lavage: {
        label: string;
        category: string;
    };
    agent_nettoyage: {
        label: string;
        category: string;
    };
    agent_assainissement: {
        label: string;
        category: string;
    };
    magasinier: {
        label: string;
        category: string;
    };
}>;
export declare const DEPOT_EQUIPMENT_CATALOG: Readonly<Record<string, DepotEquipmentDefinition>>;
export declare const DEPOT_TRACK_EXPANSION_COST = 30000;
export declare const DEPOT_PART_CATALOG: readonly ({
    id: string;
    label: string;
    category: string;
    price: number;
    match: RegExp;
    realModel: boolean;
} | {
    id: string;
    label: string;
    category: string;
    price: number;
    match?: undefined;
    realModel?: undefined;
})[];
export declare const DEPOT_OPERATION_CATALOG: Readonly<Record<string, DepotOperationDefinition>>;
type DepotIteTrack = {
    name: string;
    length: number;
    cargoType: string;
    startBinding: RailBinding | null;
    endBinding: RailBinding | null;
    constraints: unknown[];
    route: RailPoint[];
    segments: unknown[];
    distanceKm: number;
    role: string;
};
type DepotRescueLoco = {
    stockId: string;
    stockName: string;
    traction: string;
    deployed: boolean;
    consumables?: Rame['consumables'];
    totalKmRun?: number;
};
type DepotTrackSlot = {
    track: number;
    rameId: string;
    purpose: string;
    operationId: string;
};
type DepotExpense = {
    time: number;
    label: string;
    amount: number;
    category: string;
};
type DepotUtilityTotals = {
    electricityKWh: number;
    waterL: number;
    expenseEur: number;
};
type DepotLegacySpareParts = {
    moteur: number;
    climatisation: number;
    fanaux: number;
    freins: number;
    portes: number;
};
export declare class Depot {
    id: string;
    type: string;
    name: string;
    stationId: string;
    stationUpgradeSource: string;
    stationUpgradeTracks: number;
    tracks: number;
    cost: number;
    built: boolean;
    infrastructure: string[];
    equipmentInventory: Record<string, number>;
    ramesStored: string[];
    schemaVersion: 1 | 2;
    location: {
        lat: number;
        lon: number;
    } | null;
    placementOnly: boolean;
    railSections: NormalizedRailSection[];
    iteTracks: DepotIteTrack[];
    iteCargoTypes: string[];
    rescueLocos: DepotRescueLoco[];
    partInventory: Record<string, number>;
    spareParts: DepotLegacySpareParts;
    resourceStocks: Record<string, number>;
    resourceCapacities: Record<string, number>;
    resourceUsage: Record<string, number>;
    trackOccupancy: DepotTrackSlot[];
    utilityTotals: DepotUtilityTotals;
    expenseLedger: DepotExpense[];
    constructor(data?: unknown);
    _syncLegacySpareParts(): void;
    addPart(partId: unknown, qty: unknown): boolean;
    consumeParts(parts: unknown): boolean;
    addSpareParts(type: unknown, qty: unknown): boolean;
    consumeSpareParts(parts: unknown): boolean;
    freeTrackCount(): number;
    occupancyCount(): number;
    findRameTrack(rameId: unknown): DepotTrackSlot | null;
    getTypeLabel(): string;
    getMaintenanceCost(): number;
    hasInfrastructure(type: unknown): boolean;
    equipmentCount(id: unknown): number;
    hasEquipment(id: unknown): boolean;
    addEquipment(id: unknown, count?: unknown): boolean;
    getMaintenanceDuration(baseMinutes: unknown): number;
    canRescue(): boolean;
    getAvailableRescueLoco(preferredTraction: unknown): DepotRescueLoco | undefined;
    deployRescue(stockId: unknown): DepotRescueLoco | null;
    returnRescue(stockId: unknown): void;
}
type DepotRoutePoint = {
    lat: number;
    lon: number;
    [key: string]: unknown;
};
type DepotActiveRescue = {
    id: string;
    depotId: string;
    stockId: string;
    stockName: string;
    targetServiceId: string;
    repairType: string;
    state: string;
    position: DepotRoutePoint | null;
    targetPosition: DepotRoutePoint | null;
    depotPosition: DepotRoutePoint | null;
    speed: number;
    progress: number;
    route: DepotRoutePoint[] | null;
    routeIndex: number;
    returnRoute: DepotRoutePoint[] | null;
    _routeRequestInFlight: boolean;
    _routeRetrySec: number;
    _recoverTimer?: number;
    _routeFailureCount?: number;
    _routeRetryAtMs?: number;
    _routeAccessDenied?: boolean;
    routeStatusMessage?: string;
    towAttached?: boolean;
    towDistanceKm?: number;
    towRameId?: string;
    towVehicleIds?: string[];
    movementSnapshot?: RescueMotionSnapshot;
    _motionInvalid?: boolean;
};
type DepotRepairQueueEntry = {
    serviceId: string;
    depotId: string;
    remainingMin: number;
    totalMin: number;
    serviceName: string;
    repairType: string;
    rameId?: string;
    vehicleIds?: string[];
};
type DepotRescuedFormation = {
    id: string;
    name: string;
    depotId: string;
    serviceId: string;
    vehicleIds: string[];
};
type DepotMaintenanceQueueEntry = {
    rameId: string;
    depotId: string;
    remainingMin: number;
    totalMin: number;
    rameName: string;
};
type DepotOperation = {
    id: string;
    depotId: string;
    rameId: string;
    rameName: unknown;
    opId: unknown;
    label: string;
    group: string;
    remainingMin: number;
    totalMin: number;
    state: string;
    staff: Record<string, unknown>;
    staffIds: string[];
    resources: Record<string, unknown>;
    parts: Record<string, unknown>;
    equipment: string[];
    startedAt?: number;
};
export declare class DepotManager {
    private _rescueMovements;
    depots: Depot[];
    activeRescues: DepotActiveRescue[];
    repairQueue: DepotRepairQueueEntry[];
    maintenanceQueue: DepotMaintenanceQueueEntry[];
    depotOperations: DepotOperation[];
    rescuedOccurrenceIds: Set<string>;
    rescuedFormations: DepotRescuedFormation[];
    constructor();
    add(data: unknown, economy: Economy): Depot | null;
    remove(id: unknown): boolean;
    getAll(): Depot[];
    getDepots(): Depot[];
    getDepotById(id: unknown): Depot | null;
    getITEs(): Depot[];
    getByStation(stationId: unknown): Depot[];
    addITETrack(depotId: unknown, track: {
        length: unknown;
        name: unknown;
        cargoType: unknown;
        startBinding: unknown;
        endBinding: unknown;
        constraints: unknown;
        route: unknown;
        segments: unknown;
        distanceKm: unknown;
        role: unknown;
    }): boolean;
    removeITETrack(depotId: unknown, index: unknown): boolean;
    getTotalITELength(depotId: unknown): number;
    getITEByStation(stationId: unknown): Depot | null;
    getITEInfo(stationId: unknown, trainLengthM: unknown, cargoType: unknown): {
        isITE: boolean;
        depotId: string;
        totalLength: number;
        trancheCount: number;
        canFit?: undefined;
        usable?: undefined;
        cargoMatch?: undefined;
        placementOnly?: undefined;
    } | {
        isITE: boolean;
        depotId: string;
        totalLength: number;
        canFit: boolean;
        usable: boolean;
        trancheCount: number;
        cargoMatch: boolean;
        placementOnly: boolean;
    } | {
        isITE: boolean;
        depotId: string;
        totalLength: number;
        canFit: boolean;
        usable: boolean;
        trancheCount: number;
        cargoMatch: boolean;
        placementOnly?: undefined;
    };
    assignRameHome(rame: Rame, depotId: string, { assignElements }?: {
        assignElements?: boolean;
    }): boolean;
    assignElementHome(rame: Rame, elementId: unknown, depotId: unknown): boolean;
    clearRameHome(rame: Rame): boolean;
    _rameHasActiveService(rameId: unknown, services?: DepotServiceRuntime[]): boolean;
    enterRame(depotId: unknown, rame: __S3Struct54, services?: DepotServiceRuntime[]): {
        ok: boolean;
        reason: string;
        track?: undefined;
        already?: undefined;
    } | {
        ok: boolean;
        track: number;
        already: boolean;
        reason?: undefined;
    };
    leaveRame(depotId: unknown, rame: __KPStruct38, services?: DepotServiceRuntime[]): {
        ok: boolean;
        reason: string;
    } | {
        ok: boolean;
        reason?: undefined;
    };
    getDepotOccupancy(depotId: unknown): {
        used: number;
        capacity: number;
        free: number;
        tracks: {
            track: unknown;
            rameId: unknown;
            purpose: unknown;
            operationId: unknown;
        }[];
    };
    addDepotTracks(depotId: unknown, count: number, economy: Economy): {
        ok: boolean;
        reason: string;
        cost?: undefined;
        count?: undefined;
        tracks?: undefined;
    } | {
        ok: boolean;
        cost: number;
        reason: string;
        count?: undefined;
        tracks?: undefined;
    } | {
        ok: boolean;
        cost: number;
        count: number;
        tracks: number;
        reason?: undefined;
    };
    buyEquipment(depotId: unknown, equipmentId: unknown, economy: Economy): {
        ok: boolean;
        reason: string;
        cost?: undefined;
        count?: undefined;
    } | {
        ok: boolean;
        cost: number;
        reason: string;
        count?: undefined;
    } | {
        ok: boolean;
        cost: number;
        count: number;
        reason?: undefined;
    };
    _equipmentBusyCount(depotId: unknown, equipmentId: unknown): number;
    getEquipmentAvailability(depotId: unknown, equipmentId: unknown): {
        installed: number;
        busy: number;
        free: number;
    };
    buyResource(depotId: unknown, key: unknown, qty: number, economy: Economy): {
        ok: boolean;
        cost: number;
        reason?: undefined;
        qty?: undefined;
    } | {
        ok: boolean;
        cost: number;
        reason: string;
        qty?: undefined;
    } | {
        ok: boolean;
        cost: number;
        qty: number;
        reason?: undefined;
    };
    buyPart(depotId: unknown, partId: unknown, qty: number, economy: Economy): {
        ok: boolean;
        cost: number;
        reason?: undefined;
    } | {
        ok: boolean;
        cost: number;
        reason: string;
    };
    _operationNeeds(rame: Rame, opId: unknown): {
        def: DepotOperationDefinition;
        resources: {
            [x: string]: number;
        };
        parts: {
            [x: string]: number;
        };
        nothing: boolean;
    } | null;
    startDepotOperation(depotId: unknown, rame: Rame, opId: unknown, economy: Economy, staffManager?: DepotStaffBridge | null): {
        ok: boolean;
        reason: string;
        operation?: undefined;
        utilityCost?: undefined;
    } | {
        ok: boolean;
        operation: {
            id: string;
            depotId: string;
            rameId: string;
            rameName: string;
            opId: unknown;
            label: string;
            group: string;
            remainingMin: number;
            totalMin: number;
            state: string;
            staff: {
                [x: string]: number;
            };
            staffIds: string[];
            resources: {
                [x: string]: number;
            };
            parts: {
                [x: string]: number;
            };
            equipment: string[];
            startedAt: number;
        };
        utilityCost: number;
        reason?: undefined;
    };
    updateDepotOperations(dt: unknown, rameManager: RameManager, staffManager?: DepotStaffBridge | null): DepotOperation[];
    getOperationsForDepot(depotId: unknown): DepotOperation[];
    addRescueLoco(depotId: unknown, stockId: unknown, stockName: unknown, traction: unknown): boolean;
    removeRescueLoco(depotId: unknown, stockId: unknown): boolean;
    findNearestRescueDepot(world: World, lat: number, lon: number): Depot | null;
    dispatchRescue(world: World, brokenService: BrokenServiceForRescue): DepotActiveRescue | null;
    _requestRescueRoute(rescue: DepotActiveRescue, from: {
        lat?: unknown;
        lon?: unknown;
    } | null, to: {
        lat: unknown;
        lon: unknown;
    }, returning?: unknown): boolean;
    resumeRescueRouting(id: unknown): boolean;
    /** The mission, not a transient train flag, owns an attached consist. */
    hasRescuedOccurrence(serviceId: unknown): boolean;
    ownsServiceMovement(serviceId: unknown): boolean;
    isVehicleUnderRepair(vehicleId: unknown): boolean;
    getRescuedFormations(depotId: unknown): {
        vehicleIds: string[];
        repairing: boolean;
        id: string;
        name: string;
        depotId: string;
        serviceId: string;
    }[];
    reconcileRescuedFormations(): void;
    restoreRescueTow(serviceId: unknown): boolean;
    /** Only a genuine stopped rendezvous target can share a block with its
     * rescue. A third train is NEVER part of this authorisation. */
    isRescueCouplingAuthorized(a: unknown, b: unknown): boolean;
    getPhysicalRescueService(id: unknown): RescueMovement | undefined;
    /** Occupation liveness remains true during load, before controllers exist. */
    hasPhysicalRescue(id: unknown): boolean;
    getPhysicalRescueServices(): RescueMovement[];
    _prepareRescueMovement(rescue: DepotActiveRescue): RescueMovement | null;
    _moveRescue(rescue: DepotActiveRescue, dt: number, timeOfDay: number, fleet: ActiveService[]): boolean;
    _rescueTarget(rescue: DepotActiveRescue): any;
    _attachRescueTow(rescue: DepotActiveRescue): boolean;
    /** Restore/publish the consist on the SAME resolved return path. Coordinates
     * are the convoy's common map reference, not independently modelled couplers.
     * The original timetable never advances, earns revenue or consumes traction.
     */
    _syncRescueTow(rescue: DepotActiveRescue, movedKm?: number): boolean;
    _deliverRescueTow(rescue: DepotActiveRescue): boolean;
    updateRescues(dt: number, timeOfDay?: number, physicalFleet?: ActiveService[]): void;
    updateRepairs(dt: unknown): {
        repaired: {
            serviceId: string;
            depotId: string;
            repairType: string;
            rameId: string | undefined;
            vehicleIds: string[];
        }[];
        maintainedIds: unknown[];
    };
    checkPreventiveMaintenance(dateStr: string, rameManager: RameManager): void;
    getLowStockDepots(threshold?: unknown): {
        depot: Depot;
        low: string[];
    }[];
    buyBulkSpareParts(type: unknown, qty: number, economy: Economy): {
        ok: boolean;
        totalCost: number;
        invalid: boolean;
        count?: undefined;
    } | {
        ok: boolean;
        totalCost: number;
        invalid?: undefined;
        count?: undefined;
    } | {
        ok: boolean;
        totalCost: number;
        count: number;
        invalid?: undefined;
    };
    sendRameToMaintenance(rameId: unknown, rameName: unknown, depotId: unknown): boolean;
    isRameInMaintenance(rameId: unknown): boolean;
    getRameMaintenanceInfo(rameId: unknown): DepotMaintenanceQueueEntry | null;
    isInRepairOrMaintenance(serviceId: unknown): boolean;
    getRepairInfo(serviceId: unknown): DepotRepairQueueEntry | null;
    getRescueServices(): {
        id: string;
        name: string;
        position: DepotRoutePoint | null;
        state: string;
        isRescue: boolean;
        rescueState: string;
        rescueCanRetry: boolean;
        train: {
            speed: number;
            delayReason: string;
            color: string;
            stoppedAt: null;
            incident: null;
            delay: number;
            seriesName: string;
            number: string;
            platform: null;
        };
    }[];
    toSave(): {
        rescuedOccurrenceIds: string[];
        rescuedFormations: {
            vehicleIds: string[];
            id: string;
            name: string;
            depotId: string;
            serviceId: string;
        }[];
        depots: {
            id: string;
            type: string;
            name: string;
            stationId: string;
            stationUpgradeSource: string;
            stationUpgradeTracks: number;
            tracks: number;
            cost: number;
            built: boolean;
            infrastructure: string[];
            equipmentInventory: Record<string, number>;
            ramesStored: string[];
            schemaVersion: 2 | 1;
            location: {
                lat: number;
                lon: number;
            } | null;
            placementOnly: boolean;
            railSections: NormalizedRailSection[];
            iteTracks: DepotIteTrack[];
            iteCargoTypes: string[];
            rescueLocos: DepotRescueLoco[];
            spareParts: DepotLegacySpareParts;
            partInventory: Record<string, number>;
            resourceStocks: Record<string, number>;
            resourceCapacities: Record<string, number>;
            resourceUsage: Record<string, number>;
            trackOccupancy: DepotTrackSlot[];
            utilityTotals: DepotUtilityTotals;
            expenseLedger: DepotExpense[];
        }[];
        activeRescues: {
            movementSnapshot: RescueMotionSnapshot | undefined;
            _routeRequestInFlight: boolean;
            towVehicleIds: string[];
            position: {
                [key: string]: unknown;
                lat: number;
                lon: number;
            } | null;
            targetPosition: {
                [key: string]: unknown;
                lat: number;
                lon: number;
            } | null;
            depotPosition: {
                [key: string]: unknown;
                lat: number;
                lon: number;
            } | null;
            route: {
                [key: string]: unknown;
                lat: number;
                lon: number;
            }[] | null;
            returnRoute: {
                [key: string]: unknown;
                lat: number;
                lon: number;
            }[] | null;
            id: string;
            depotId: string;
            stockId: string;
            stockName: string;
            targetServiceId: string;
            repairType: string;
            state: string;
            speed: number;
            progress: number;
            routeIndex: number;
            _routeRetrySec: number;
            _recoverTimer?: number;
            _routeFailureCount?: number;
            _routeRetryAtMs?: number;
            _routeAccessDenied?: boolean;
            routeStatusMessage?: string;
            towAttached?: boolean;
            towDistanceKm?: number;
            towRameId?: string;
            _motionInvalid?: boolean;
        }[];
        repairQueue: {
            vehicleIds: string[];
            serviceId: string;
            depotId: string;
            remainingMin: number;
            totalMin: number;
            serviceName: string;
            repairType: string;
            rameId?: string;
        }[];
        maintenanceQueue: DepotMaintenanceQueueEntry[];
        depotOperations: DepotOperation[];
    };
    loadFromSave(data: unknown): void;
}
type __S3Struct54 = {
    "id": string;
    "depotOperationId": string;
    "currentLocation": unknown;
    "inMaintenance": number;
};
export {};
