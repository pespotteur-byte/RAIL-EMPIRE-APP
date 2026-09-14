import type { World } from './world.js';
import { type DepotManager } from './depot.js';
import type { PlatformManager } from './line.js';
type StationModuleEffect = {
    platforms?: number;
    frequentation?: number;
    satisfaction?: number;
    garage?: number;
    freight?: boolean;
};
type StationModuleDefinition = {
    name: string;
    cost: number;
    icon: string;
    description: string;
    maxPerStation: number;
    effect: StationModuleEffect;
};
type InstalledStationModule = {
    type: string;
    builtAt: number;
};
type StationUpgradeData = {
    modules: InstalledStationModule[];
    level: number;
    totalInvested: number;
};
import type { Economy } from './economy.js';
import type { RailEmpire } from './main.js';
export declare class StationUpgrades {
    upgrades: Record<string, StationUpgradeData>;
    availableModules: Record<string, StationModuleDefinition>;
    private world;
    private depots;
    private platforms;
    constructor();
    /** Runtime links are not serialised: reapply effects from paid modules only. */
    connectRuntime(world: World, depots: DepotManager, platforms: PlatformManager): void;
    getPlatformCapacity(stationId: string, base?: unknown): number;
    getGarageCapacity(stationId: string): number;
    /** null = no runtime context (legacy embedders); false = a known unsuitable station. */
    canHandleFreight(stationId: string): boolean | null;
    syncRuntime(): void;
    /**
     * Get upgrade data for a station, creating default if needed.
     */
    getStation(stationId: string): StationUpgradeData;
    /**
     * Buy a module for a station.
     */
    buyModule(stationId: string, moduleType: string | undefined, economy: Economy): boolean;
    /**
     * Get total extra platforms from upgrades.
     */
    getExtraPlatforms(stationId: string): number;
    /**
     * Get frequentation bonus.
     */
    getFrequentationBonus(stationId: string): number;
    /**
     * Get satisfaction bonus.
     */
    getSatisfactionBonus(stationId: string): number;
    /**
     * Render station upgrades panel.
     */
    render(container: HTMLElement, game: RailEmpire): void;
    _renderStationDetail(container: HTMLElement, stationId: string, game: RailEmpire): void;
    toSave(): {
        upgrades: Record<string, StationUpgradeData>;
    };
    loadFromSave(s: unknown, world?: World | null): void;
}
export {};
