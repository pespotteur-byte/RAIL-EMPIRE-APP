/** RC13 disk-only compression. Decoded geometry and routing semantics are unchanged. */
import { type BinaryJson } from './storage-codec.js';
export type CacheRow = Record<string, unknown> & {
    key: IDBValidKey;
};
export interface PackedCacheRow extends CacheRow {
    storageFormat: 'RE13-CACHE-1';
    payload: BinaryJson;
    wayCount: number;
}
export declare const cacheStorageStatus: {
    writes: number;
    memoryOnly: number;
    failures: number;
    lastError: string;
    pausedForQuota: boolean;
};
export declare function isPackedCache(row: CacheRow): row is PackedCacheRow;
export declare function cacheWayCount(row: CacheRow): number;
export declare function cacheRowBytes(row: CacheRow): number;
export declare function packCacheRow(row: CacheRow): Promise<CacheRow>;
export declare function unpackCacheRow(row: CacheRow): Promise<CacheRow>;
export declare function cacheWriteAllowed(incomingBytes: number): Promise<boolean>;
/** Resolves only on COMMIT, not on put.onsuccess (which can precede a quota abort). */
export declare function putCacheRow(db: IDBDatabase, store: string, row: CacheRow): Promise<boolean>;
