export declare const CATALOG_NORMALIZATION_EXTRA_CARGO_TYPES: {
    category: string;
    type: string;
    name: string;
    unit: string;
    pricePerUnit: number;
    hazard: boolean;
    balanceStatus: string;
}[];
export declare const CATALOG_CARGO_ALIASES: Record<string, string>;
export interface CargoCatalogItem {
    [key: string]: unknown;
    cargoTypes?: string[];
    technicallyCompatibleCargoTypes?: string[];
}
export declare function normalizeCatalogCargoKeys<T extends CargoCatalogItem>(catalog: readonly T[]): Array<T & {
    cargoTypes: string[];
    technicallyCompatibleCargoTypes: string[];
}>;
