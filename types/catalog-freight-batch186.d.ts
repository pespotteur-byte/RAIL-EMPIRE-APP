import type { CargoDefinition, FreightPatch, IndustryPatchType } from './catalog-contracts.js';
export declare const BATCH186_FREIGHT_CARGO_TYPES: CargoDefinition[];
export declare const BATCH186_WAGON_FREIGHT_PATCH: Record<string, FreightPatch>;
export declare const BATCH186_INDUSTRY_CARGO_ADDITIONS: Record<string, string[]>;
export declare const BATCH186_NEW_INDUSTRIES: IndustryPatchType[];
export declare function applyBatch186FreightToCatalog(catalog: unknown[]): unknown[];
export declare function applyBatch186IndustryFreightPatch(industrialClients: unknown): {
    updated: number;
    added: number;
};
