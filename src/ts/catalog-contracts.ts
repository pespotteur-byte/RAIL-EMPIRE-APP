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
  name?: string; seriesName?: string; category?: string; traction?: string;
  maxSpeed?: number; power?: number; mass?: number; length?: number;
  passengerCapacity?: number; freightCapacity?: number; purchasePrice?: number;
  imageData?: string; cargoTypes?: string[]; _source?: string;
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
export function catalogRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function industryPatchHost(value: unknown): IndustryPatchHost | null {
  const record = catalogRecord(value);
  if (!record || typeof record.getIndustryTypes !== 'function') return null;
  return record as IndustryPatchHost;
}
