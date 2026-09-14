import { type FreightRailLeg } from './freight-network.js';
import type { Economy } from './economy.js';
import type { World } from './world.js';
import type { RailEmpire } from './main.js';
type UnknownRecord = Record<string, unknown>;
type IndustrialLocationOverride = {
    name?: string;
    country?: string;
    type?: string;
    lat?: number;
    lon?: number;
};
type CustomIndustrialSite = {
    id: string;
    type: string;
    name: string;
    lat: number;
    lon: number;
    country: string;
    _key: string;
    industryName?: string;
    icon?: string;
};
type IndustrialClient = {
    id: string;
    type: string;
    name: string;
    icon: string;
    stationId: string;
    depotId: string;
    dailyTonnage: number;
    active: boolean;
    satisfaction: number;
    marketShare: number;
    contractsGenerated: number;
    totalTonnage: number;
    totalRevenue: number;
    createdAt: number;
};
type IndustrialStats = {
    totalClients: number;
    totalTonnage: number;
    totalRevenue: number;
    contractsGenerated: number;
};
type FreightContractLike = {
    active: boolean;
} & UnknownRecord;
type FreightManagerLike = {
    contracts: FreightContractLike[];
    addContract?: (data: UnknownRecord) => FreightContractLike | null | undefined;
    cancelContractsForIndustrialClient?: (clientId: string) => unknown;
};
type CargoTypesLike = {
    getTransportTariffPerTonne?: (cargoType: string) => number;
};
export declare class IndustrialClients {
    clients: IndustrialClient[];
    lastGenerationTime: Record<string, number>;
    stats: IndustrialStats;
    locationOverrides: Record<string, IndustrialLocationOverride>;
    customSites: CustomIndustrialSite[];
    hiddenStaticKeys: Set<string>;
    railLegProvider: (() => readonly FreightRailLeg[]) | null;
    freightAccessProvider: ((stationId: string) => boolean | null) | null;
    lastGenerationReport: {
        generated: number;
        clientsWithoutKnownRoute: number;
        clientsWithoutFreightAccess: number;
        knownDirectedLinks: number;
    };
    constructor();
    setLocationOverride(key: string, lat: unknown, lon: unknown): boolean;
    getIndustryTypes(): {
        type: string;
        name: string;
        icon: string;
        cargoTypes: string[];
        cargoOut: string;
        dailyTonnageMin: number;
        dailyTonnageMax: number;
        pricePerTonne: number;
        attractCost: number;
        description: string;
        realLocations: {
            name: string;
            lat: number;
            lon: number;
            country: string;
        }[];
    }[];
    getIndustryColors(): Record<string, string>;
    getCountryNames(): Record<string, string>;
    getIndustryInfo(type: unknown): {
        type: string;
        name: string;
        icon: string;
        cargoTypes: string[];
        cargoOut: string;
        dailyTonnageMin: number;
        dailyTonnageMax: number;
        pricePerTonne: number;
        attractCost: number;
        description: string;
        realLocations: {
            name: string;
            lat: number;
            lon: number;
            country: string;
        }[];
    } | null;
    getAllRealLocations(): ({
        name: string;
        country: string;
        lat: number;
        lon: number;
        industryType: string;
        industryName: string;
        industryIcon: string;
        color: string;
        _key: string;
        custom: boolean;
    } | {
        industryType: string;
        industryName: string;
        industryIcon: string;
        color: string;
        _key: string;
        custom: boolean;
        id: string;
        type: string;
        name: string;
        lat: number;
        lon: number;
        country: string;
        icon?: string;
    })[];
    addCustomSite(type: unknown, name: unknown, lat: number, lon: number, country?: unknown): CustomIndustrialSite | null;
    removeSite(key: string): void;
    restoreStaticSite(key: unknown): void;
    updateSite(key: string, data: {
        lat: unknown;
        lon: unknown;
        type: unknown;
        name: unknown;
        country: unknown;
    }): {
        name?: string;
        type?: string;
        lat?: number;
        lon?: number;
        country?: string;
        _key?: string;
        id?: string;
    } | null;
    getSiteByKey(key: unknown): {
        name?: string;
        type?: string;
        lat?: number;
        lon?: number;
        country?: string;
        _key?: string;
        id?: string;
    } | null;
    attractClient(industryType: unknown, stationId: unknown, depotId: unknown, economy: Economy): IndustrialClient | null;
    removeClient(clientId: unknown, freightManager?: FreightManagerLike | null): boolean;
    updateClient(clientId: unknown, data: {
        name?: unknown;
        dailyTonnage?: unknown;
        satisfaction?: unknown;
    }): IndustrialClient | null;
    moveClient(clientId: unknown, stationId: unknown, depotId: unknown): IndustrialClient | null;
    getClientsByStation(stationId: unknown): IndustrialClient[];
    getActiveClients(): IndustrialClient[];
    generateDailyContracts(freightManager: FreightManagerLike, world: World, cargoTypes?: CargoTypesLike | null): void;
    boostSatisfaction(clientId: unknown, amount: unknown): boolean;
    pruneClients(validITEs?: unknown): number;
    render(container: HTMLElement, game: RailEmpire): void;
    _renderSitesSection(game: RailEmpire): string;
    _renderLocationsRows(countryFilter: unknown, typeFilter: unknown): string;
    toSave(): {
        clients: IndustrialClient[];
        stats: IndustrialStats;
        _nextClientId: number;
        locationOverrides: Record<string, IndustrialLocationOverride>;
        customSites: CustomIndustrialSite[];
        hiddenStaticKeys: string[];
    };
    loadFromSave(s: unknown): void;
}
export {};
