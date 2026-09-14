/** Contracts for generated catalogue data and their TypeScript adapters.
 * Data tables are build inputs; no permissive global/DOM augmentation here. */
export interface CargoDefinition {
    category: string;
    type?: string;
    name?: string;
    unit?: string;
    pricePerUnit?: number;
    hazard?: boolean;
    [key: string]: unknown;
}
export interface CatalogEntry {
    id: string;
    name?: string;
    seriesName?: string;
    category?: string;
    traction?: string;
    maxSpeed?: number;
    power?: number;
    mass?: number;
    length?: number;
    passengerCapacity?: number;
    freightCapacity?: number;
    purchasePrice?: number;
    imageData?: string;
    cargoTypes?: string[];
    _source?: string;
    [key: string]: unknown;
}
export interface FreightPatch {
    cargoTypes?: string[];
    technicallyCompatibleCargoTypes?: string[];
    freightValidationSource?: string;
    freightValidationScope?: string;
    [key: string]: unknown;
}
export interface IndustryPatchType {
    type: string;
    cargoTypes?: string[];
    [key: string]: unknown;
}
export interface IndustryPatchHost {
    getIndustryTypes?: () => IndustryPatchType[];
    getIndustryColors?: () => Record<string, string>;
}
export declare function catalogRecord(value: unknown): Record<string, unknown> | null;
export declare function industryPatchHost(value: unknown): IndustryPatchHost | null;
