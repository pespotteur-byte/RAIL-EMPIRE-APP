import type { CargoDefinition, FreightPatch } from './catalog-contracts.js';
export declare const BATCH186_FREIGHT_PASS2_CARGO_TYPES: CargoDefinition[];
export declare const BATCH186_FREIGHT_PASS2_WAGON_PATCH: Record<string, FreightPatch>;
export declare const BATCH186_FREIGHT_PASS2_INDUSTRY_ADDITIONS: Record<string, string[]>;
export declare function applyBatch186FreightPass2ToCatalog(catalog: unknown[]): unknown[];
export declare function applyBatch186FreightPass2IndustryPatch(industrialClients: unknown): {
    updated: number;
};
