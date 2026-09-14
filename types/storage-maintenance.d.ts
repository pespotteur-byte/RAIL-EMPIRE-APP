/** Explicit, cancellable offline compaction; only RE's two geometry databases are touched. */
import { type CacheRow } from './storage-cache.js';
export interface CompactionResult {
    scanned: number;
    compacted: number;
    skipped: number;
    failed: number;
    conflicts: number;
    legacyMigrated: number;
    beforeBytes: number;
    afterBytes: number;
    cancelled: boolean;
    errors: string[];
}
export interface MaintenanceOptions {
    signal?: AbortSignal;
    onProgress?: (result: CompactionResult) => void;
}
export declare const CACHE_DATABASES: readonly [{
    readonly name: "rail-empire-world-rail";
    readonly store: "tiles";
}, {
    readonly name: "rail-empire-orm";
    readonly store: "areas";
}];
export declare function openExistingCache(name: string, store: string): Promise<IDBDatabase | null>;
/** Compare and replace in one transaction, so a newer network response cannot be overwritten. */
export declare function replaceCacheIfUnchanged(db: IDBDatabase, store: string, original: CacheRow | null, packed: CacheRow): Promise<'committed' | 'conflict' | 'failed'>;
export declare function compactGeometryCaches(options?: MaintenanceOptions): Promise<CompactionResult>;
export declare function storageUsage(): Promise<{
    usage: number | null;
    quota: number | null;
    persistent: boolean | null;
    localBytes: number;
    localKeys: number;
}>;
