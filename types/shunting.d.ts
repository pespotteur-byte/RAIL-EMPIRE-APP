type ShuntingPhase = 'arriving' | 'uncoupling' | 'pushing' | 'loading' | 'pulling' | 'coupling' | 'inspection' | 'departing';
type OperationPhase = ShuntingPhase | 'completed';
type ShuntingPhaseInfo = {
    name: string;
    duration: number;
    description: string;
};
type ShuntingOperation = {
    id: string;
    serviceId: string;
    stationId: string;
    depotId: string;
    cargoType: string;
    tonnage: number;
    wagons: number;
    phase: OperationPhase;
    phaseIndex: number;
    phaseElapsed: number;
    totalElapsed: number;
    startTime: number;
    completed: boolean;
    phaseDurations: Record<string, number>;
};
type ShuntingHistoryEntry = {
    id: string;
    serviceId: string;
    cargoType: string;
    tonnage: number;
    wagons: number;
    duration: number;
    completedAt: number;
};
type ShuntingStats = {
    totalOperations: number;
    totalWagonsHandled: number;
    totalTonnageHandled: number;
    averageDuration: number;
    totalDuration: number;
};
export declare class ShuntingManager {
    operations: ShuntingOperation[];
    history: ShuntingHistoryEntry[];
    stats: ShuntingStats;
    constructor();
    startOperation(serviceId: unknown, stationId: unknown, depotId: unknown, cargoType: unknown, tonnage: unknown, wagons: unknown, options: unknown): ShuntingOperation | null;
    _calculatePhaseDurations(depotId: unknown, tonnage: number, wagons: number, options: unknown): Record<string, number>;
    update(deltaMinutes: unknown): ShuntingOperation[];
    _completeOperation(op: ShuntingOperation): void;
    getActiveOperations(): ShuntingOperation[];
    getOperationForService(serviceId: unknown): ShuntingOperation | undefined;
    isServiceInShunting(serviceId: unknown): boolean;
    getPhaseInfo(phase: string): ShuntingPhaseInfo;
    render(container: HTMLElement, game: unknown): void;
    toSave(): {
        operations: ShuntingOperation[];
        history: ShuntingHistoryEntry[];
        stats: ShuntingStats;
        _nextOpId: number;
    };
    loadFromSave(s: unknown): void;
}
export {};
