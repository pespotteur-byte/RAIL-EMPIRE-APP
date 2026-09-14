/** RC13 disk-only compression. Decoded geometry and routing semantics are unchanged. */
import { encodeJson, decodeJson } from './storage-codec.js';
export const cacheStorageStatus = { writes: 0, memoryOnly: 0, failures: 0, lastError: '', pausedForQuota: false };
export function isPackedCache(row) { return row.storageFormat === 'RE13-CACHE-1'; }
export function cacheWayCount(row) {
    return isPackedCache(row) ? Number(row.wayCount) || 0 : Array.isArray(row.ways) ? row.ways.length : 0;
}
// IDB can hold more than JSON. Never silently convert Dates, typed arrays, undefined,
// non-finite numbers, sparse arrays or prototype-bearing objects in a legacy cache.
function jsonCompatible(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value) && !Object.is(value, -0);
    if (typeof value !== 'object' || seen.has(value))
        return false;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
        return false;
    seen.add(value);
    const keys = Object.keys(value);
    if (Array.isArray(value) && keys.length !== value.length) {
        seen.delete(value);
        return false;
    }
    const ok = keys.every(key => jsonCompatible(value[key], seen));
    seen.delete(value);
    return ok;
}
export function cacheRowBytes(row) {
    try {
        return new Blob([JSON.stringify(row)]).size + (isPackedCache(row) ? row.payload.data.size : 0);
    }
    catch {
        return 0;
    } // Unknown is not a claim about physical space.
}
export async function packCacheRow(row) {
    if (!jsonCompatible(row))
        return row;
    const payload = await encodeJson(row);
    // Only cheap query metadata remains uncompressed. Everything else is in the binary body once.
    return { key: row.key, storageFormat: 'RE13-CACHE-1', payload, wayCount: cacheWayCount(row),
        bbox: row.bbox, timestamp: row.timestamp, savedAt: row.savedAt, schema: row.schema,
        complete: row.complete, negative: row.negative, expiresAt: row.expiresAt, emptyConfirmations: row.emptyConfirmations };
}
export async function unpackCacheRow(row) {
    if (!isPackedCache(row))
        return row;
    const decoded = await decodeJson(row.payload);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) ||
        JSON.stringify(decoded.key) !== JSON.stringify(row.key))
        throw new Error('Cache compact incohérent.');
    return decoded;
}
export async function cacheWriteAllowed(incomingBytes) {
    try {
        if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (typeof usage === 'number' && typeof quota === 'number' && quota > 0) {
                // Reserve capacity for the save. Unknown estimates do not pretend to be exact disk sizes.
                const reserve = Math.min(64 * 1024 * 1024, quota * 0.15);
                if (usage + Math.max(0, incomingBytes) > quota - reserve) {
                    cacheStorageStatus.pausedForQuota = true;
                    cacheStorageStatus.memoryOnly++;
                    return false;
                }
            }
        }
    }
    catch { /* unavailable estimate is not a storage failure */ }
    cacheStorageStatus.pausedForQuota = false;
    return true;
}
/** Resolves only on COMMIT, not on put.onsuccess (which can precede a quota abort). */
export function putCacheRow(db, store, row) {
    return new Promise(resolve => {
        let settled = false;
        try {
            const tx = db.transaction(store, 'readwrite');
            tx.objectStore(store).put(row);
            tx.oncomplete = () => { if (settled)
                return; settled = true; cacheStorageStatus.writes++; cacheStorageStatus.lastError = ''; resolve(true); };
            const fail = () => { if (settled)
                return; settled = true; cacheStorageStatus.failures++; cacheStorageStatus.lastError = tx.error?.name || 'CacheTransactionError'; resolve(false); };
            tx.onerror = fail;
            tx.onabort = fail;
        }
        catch (e) {
            cacheStorageStatus.failures++;
            cacheStorageStatus.lastError = e instanceof Error ? e.name : String(e);
            resolve(false);
        }
    });
}
