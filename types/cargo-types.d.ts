type __KPM2 = number;
type __KPM3 = number;
type __KPM5 = {
    "stats": unknown;
    "customTypes": unknown;
};
type CargoType = {
    type: string;
    name: string;
    unit: string;
    pricePerUnit: number;
    hazard: boolean;
    [key: string]: unknown;
};
type CargoCategory = {
    name: string;
    icon: string;
    description: string;
    wagonType: string;
    loadingTime: number;
    types: CargoType[];
};
type CargoCategoryStats = {
    contracts: number;
    tonnage: number;
    revenue: number;
};
type CargoStats = {
    totalContracts: number;
    totalTonnage: number;
    totalRevenue: number;
    byCategory: Record<string, CargoCategoryStats>;
};
type CustomCargoType = CargoType & {
    categoryKey: string;
    categoryName: string;
};
type AddCustomCargoOptions = {
    name?: unknown;
    categoryKey?: unknown;
    categoryName?: unknown;
    description?: unknown;
    wagonType?: unknown;
    loadingTime?: unknown;
    type?: unknown;
    unit?: unknown;
    pricePerUnit?: unknown;
    hazard?: unknown;
};
import type { RailEmpire } from './main.js';
export declare class CargoTypeManager {
    categories: Record<string, CargoCategory>;
    stats: CargoStats;
    customTypes: CustomCargoType[];
    constructor();
    addCustomType(opts?: AddCustomCargoOptions): {
        ok: boolean;
        error: string;
        type?: undefined;
        categoryKey?: undefined;
    } | {
        ok: boolean;
        type: string;
        categoryKey: string;
        error?: undefined;
    };
    ensureType(categoryKey: unknown, typeObj: Record<string, unknown>): boolean;
    getAllTypes(): {
        category: string;
        categoryName: string;
        icon: string;
        wagonType: string;
        loadingTime: number;
        type: string;
        name: string;
        unit: string;
        pricePerUnit: number;
        hazard: boolean;
    }[];
    getTypeInfo(cargoType: unknown): {
        category: string;
        categoryName: string;
        icon: string;
        wagonType: string;
        loadingTime: number;
        type: string;
        name: string;
        unit: string;
        pricePerUnit: number;
        hazard: boolean;
    } | null;
    getCategoryForType(cargoType: unknown): string | null;
    isHazardous(cargoType: unknown): boolean;
    getLoadingTime(cargoType: unknown): number;
    getTransportTariffPerTonne(cargoType: unknown): number;
    recordContract(cargoType: unknown, quantity: __KPM2, revenue: __KPM3, countContract?: unknown): boolean;
    render(container: HTMLElement, game: RailEmpire): void;
    toSave(): {
        stats: CargoStats;
        customTypes: CustomCargoType[];
    };
    loadFromSave(s: __KPM5): void;
}
export {};
