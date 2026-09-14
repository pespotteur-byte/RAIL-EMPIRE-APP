import type { Rame } from './rame.js';
type FreightContractInput = Record<string, unknown>;
type CargoTypeLike = {
    type: string;
    name: string;
    category: string;
    pricePerUnit: number;
};
type CargoTypesLike = {
    getAllTypes?: () => CargoTypeLike[];
};
type FreightStopLike = {
    stationId?: unknown;
    type?: unknown;
    technicalLocationId?: unknown;
};
export type FreightCarrierState = {
    id?: unknown;
    assignedContractId?: unknown;
    _contractCargoId?: string;
    _contractFreight?: number;
    contractCargoId?: unknown;
    contractFreight?: unknown;
    completed?: boolean;
    cancelled?: boolean;
    state?: unknown;
};
type FreightServiceLike = FreightCarrierState & {
    rame: Rame;
    serviceType?: unknown;
    isWorkTrain?: unknown;
    stops?: FreightStopLike[];
    getCurrentStops?: () => FreightStopLike[];
};
export type FreightAssignmentCheck = {
    ok: boolean;
    code: string;
    message: string;
    originIndex: number;
    destinationIndex: number;
    capacity: number;
};
export declare class FreightContract {
    id: string;
    cargoType: string;
    diffuse: boolean;
    cargoTypes: string[];
    cargoName: string;
    quantity: number;
    initialQuantity: number;
    unit: string;
    from: string;
    fromId: string;
    to: string;
    toId: string;
    payment: number;
    unitPrice: number;
    active: boolean;
    industrialClientId: string | null;
    loadedByService: Record<string, number>;
    removeWhenSettled: boolean;
    constructor(data: FreightContractInput);
    get deliveredQuantity(): number;
    get inTransitQuantity(): number;
    get progress(): number;
}
export declare class FreightManager {
    contracts: FreightContract[];
    lastGenTime: number;
    constructor();
    maybeGenerate(stations: unknown, absTime: number, cargoTypes: CargoTypesLike | null, industrialClients: unknown): void;
    /** A contract is an ordered commercial journey, not only a compatible wagon.
     * Intermediate loading is allowed, but passing/technical points do not count.
     * Routing itself remains the Schedule Creator's responsibility.
     */
    validateAssignment(contract: FreightContract | null | undefined, service: FreightServiceLike): FreightAssignmentCheck;
    reserveForService(contract: FreightContract, service: FreightCarrierState, capacity: number): number;
    releaseForService(serviceId: unknown): void;
    /** The cargo's owner is independent of a newly edited service assignment. */
    carriedContract(service: FreightCarrierState): FreightContract | null;
    /** Return/unload an unfulfilled consignment. This is NOT a delivery: no
     * quantity/progress, revenue, industrial satisfaction or generic cargo change.
     * Used at the next usable commercial stop of an interrupted contract, or
     * when its service is removed/finally completed. Idempotent after reload.
     */
    finishServiceCargo(service: FreightCarrierState): number;
    private _pruneSettledRemovals;
    /** Reconcile saved/live reservations only once all carrier snapshots exist.
     * Pending V2 snapshots count as carriers before compilation. Live instances
     * take precedence. This prevents both orphan stock and early release on F5.
     */
    reconcileReservations(services: Iterable<FreightCarrierState>, pending?: Iterable<FreightCarrierState>): void;
    toSave(): {
        id: string;
        cargoType: string;
        diffuse: boolean;
        cargoTypes: string[];
        cargoName: string;
        quantity: number;
        initialQuantity: number;
        unit: string;
        from: string;
        fromId: string;
        to: string;
        toId: string;
        payment: number;
        unitPrice: number;
        active: boolean;
        progress: number;
        industrialClientId: string | null;
        loadedByService: {
            [x: string]: number;
        };
        removeWhenSettled: boolean;
    }[];
    _contractMatchesCargo(contract: Pick<FreightContract, 'diffuse' | 'cargoTypes' | 'cargoType'> | null, type: string): boolean;
    getRameCargoTypes(rame: Rame): unknown[];
    getRameCargoCapacity(rame: Rame, cargoOrContract: unknown): number;
    isContractCompatibleWithRame(contract: unknown, rame: Rame): boolean;
    cancelContractsForIndustrialClient(clientId: string): number;
    pruneIndustrialClientContracts(validClientIds?: unknown): number;
    fulfillAtStation(service: FreightServiceLike, stationId: string, freightUnload: unknown, isDelayed?: boolean, isEarly?: boolean): {
        fulfilled: never[];
        remainingTonnes: unknown;
    } | {
        fulfilled: unknown[];
        remainingTonnes: number;
    };
    getAllActive(): FreightContract[];
    addContract(data: unknown): FreightContract | null;
    removeContract(id: string): void;
    loadFromSave(arr: unknown): void;
}
export {};
