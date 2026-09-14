import type { CatalogEntry } from './catalog-contracts.js';
import type { RollingStockManager } from './rolling-stock.js';
export interface ExternalCatalogBundle {
    format: 'rail-empire-catalog';
    version: 1;
    createdAt?: string;
    catalogBase?: string;
    modifications: CatalogEntry[];
    deletions: string[];
    imports: CatalogEntry[];
    metadata?: Record<string, unknown>;
}
export interface ExternalCatalogApplyResult {
    modified: number;
    deleted: number;
    imported: number;
    skipped: number;
}
export declare function loadExternalCatalogBundle(): Promise<ExternalCatalogBundle | null>;
export declare function saveExternalCatalogBundle(bundle: ExternalCatalogBundle): Promise<void>;
export declare function clearExternalCatalogBundle(): Promise<void>;
export declare function parseExternalCatalogFile(file: File): Promise<ExternalCatalogBundle>;
export declare function applyExternalCatalogBundle(manager: RollingStockManager, bundle: ExternalCatalogBundle): ExternalCatalogApplyResult;
