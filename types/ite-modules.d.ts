import type { Economy } from './economy.js';
import type { RailEmpire } from './main.js';
interface ITEModuleEffect {
    loadingTracks?: number;
    throughputBonus?: number;
    loadingSpeedBonus?: number;
    containerSpeed?: number;
    storageCapacity?: number;
    liquidCapacity?: number;
    hazardCapable?: boolean;
    shuntingSpeedBonus?: number;
    containerOnly?: boolean;
    bulkOnly?: boolean;
    protection?: boolean;
    coldCapable?: boolean;
    weighing?: boolean;
    autoOnly?: boolean;
    security?: boolean;
    nightOps?: boolean;
}
interface ITEModuleDefinition {
    name: string;
    cost: number;
    icon: string;
    description: string;
    maxPerITE: number;
    effect: ITEModuleEffect;
    maintenanceCost: number;
}
interface ITEModuleInstallation {
    type: string;
    builtAt: number;
}
interface ITEInstallation {
    modules: ITEModuleInstallation[];
    totalInvested: number;
    level: number;
    totalTonnageHandled: number;
    totalRevenue: number;
}
/**
 * ITEModules — Modular ITE system with upgradeable infrastructure.
 * Adds loading bays, cranes, silos, warehouses to ITE installations.
 */
export declare class ITEModules {
    installations: Record<string, ITEInstallation>;
    availableModules: Record<string, ITEModuleDefinition>;
    constructor();
    getInstallation(depotId: string): ITEInstallation;
    buyModule(depotId: string, moduleType: string, economy: Economy): boolean;
    getThroughput(depotId: string): number;
    getLoadingSpeedMultiplier(depotId: string): number;
    getShuntingSpeedMultiplier(depotId: string): number;
    getCraneCount(depotId: string): number;
    getStorageCapacity(depotId: string): number;
    getLoadingTracks(depotId: string): number;
    hasWeighbridge(depotId: string): boolean;
    canHandleHazardous(depotId: string): boolean;
    getDailyMaintenanceCost(depotId: string): number;
    removeInstallation(depotId: string): boolean;
    pruneInstallations(validDepotIds?: string[]): number;
    getTotalDailyMaintenance(): number;
    recordHandling(depotId: string, tonnage: unknown, revenue: unknown): boolean;
    render(container: HTMLElement, game: RailEmpire): void;
    _renderITEDetail(container: HTMLElement, depotId: string, game: RailEmpire): void;
    toSave(): {
        installations: Record<string, ITEInstallation>;
    };
    loadFromSave(s: {
        installations: unknown;
    }): void;
}
export {};
