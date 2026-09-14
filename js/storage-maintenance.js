/** Explicit, cancellable offline compaction; only RE's two geometry databases are touched. */
import { isPackedCache, packCacheRow, unpackCacheRow } from './storage-cache.js';
export const CACHE_DATABASES = [
    { name: 'rail-empire-world-rail', store: 'tiles' }, { name: 'rail-empire-orm', store: 'areas' },
];
function rowBytes(row) {
    const meta = new Blob([JSON.stringify(row)]).size;
    return meta + (isPackedCache(row) ? row.payload.data.size : 0);
}
export function openExistingCache(name, store) {
    if (typeof indexedDB === 'undefined')
        return Promise.resolve(null);
    return new Promise(resolve => {
        let done = false;
        const finish = (db) => { if (done) {
            db?.close();
            return;
        } done = true; clearTimeout(timer); resolve(db); };
        const timer = setTimeout(() => finish(null), 4000);
        try {
            const req = indexedDB.open(name);
            // Inspect existing databases only. Never create a new empty database while measuring.
            req.onupgradeneeded = () => { req.transaction?.abort(); };
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(store)) {
                    db.close();
                    finish(null);
                }
                else {
                    db.onversionchange = () => db.close();
                    finish(db);
                }
            };
            req.onerror = req.onblocked = () => finish(null);
        }
        catch {
            finish(null);
        }
    });
}
async function nextRow(db, store, after) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).openCursor(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true));
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => reject(req.error || new Error('Lecture du cache impossible'));
            tx.onabort = () => reject(tx.error || new Error('Lecture du cache annulée'));
        }
        catch (e) {
            reject(e);
        }
    });
}
/** Compare and replace in one transaction, so a newer network response cannot be overwritten. */
export function replaceCacheIfUnchanged(db, store, original, packed) {
    const expected = original ? JSON.stringify(original) : null;
    return new Promise(resolve => {
        let replaced = false;
        try {
            const tx = db.transaction(store, 'readwrite'), os = tx.objectStore(store), req = os.get(packed.key);
            req.onsuccess = () => {
                const now = req.result;
                if ((expected === null && now) || (expected !== null && (!now || isPackedCache(now) || JSON.stringify(now) !== expected)))
                    return;
                os.put(packed);
                replaced = true;
            };
            tx.oncomplete = () => resolve(replaced ? 'committed' : 'conflict');
            tx.onabort = tx.onerror = () => resolve('failed');
        }
        catch {
            resolve('failed');
        }
    });
}
let running = null;
export function compactGeometryCaches(options = {}) {
    if (running)
        return running;
    running = runCompaction(options).finally(() => { running = null; });
    return running;
}
async function runCompaction({ signal, onProgress }) {
    const result = { scanned: 0, compacted: 0, skipped: 0, failed: 0, conflicts: 0, legacyMigrated: 0, beforeBytes: 0, afterBytes: 0, cancelled: false, errors: [] };
    const progress = () => { try {
        onProgress?.({ ...result, errors: [...result.errors] });
    }
    catch { /* UI failure must not abort a commit */ } };
    for (const target of CACHE_DATABASES) {
        if (signal?.aborted)
            break;
        const db = await openExistingCache(target.name, target.store);
        if (!db)
            continue;
        try {
            let after;
            while (!signal?.aborted) {
                const row = await nextRow(db, target.store, after);
                if (!row)
                    break;
                after = row.key;
                result.scanned++;
                const before = rowBytes(row);
                result.beforeBytes += before;
                if (isPackedCache(row)) {
                    result.skipped++;
                    result.afterBytes += before;
                    progress();
                    continue;
                }
                try {
                    const packed = await packCacheRow(row), smaller = rowBytes(packed);
                    if (signal?.aborted) {
                        result.afterBytes += before;
                        break;
                    }
                    if (!isPackedCache(packed) || smaller >= before) {
                        result.skipped++;
                        result.afterBytes += before;
                    }
                    else {
                        // Verify an exact JSON round-trip before replacing the existing record.
                        if (JSON.stringify(await unpackCacheRow(packed)) !== JSON.stringify(row))
                            throw new Error('Échec de la vérification sans perte');
                        const outcome = await replaceCacheIfUnchanged(db, target.store, row, packed);
                        if (outcome === 'committed') {
                            result.compacted++;
                            result.afterBytes += smaller;
                        }
                        else {
                            result.afterBytes += before;
                            if (outcome === 'conflict')
                                result.conflicts++;
                            else
                                result.failed++;
                        }
                    }
                }
                catch (e) {
                    result.failed++;
                    result.afterBytes += before;
                    if (result.errors.length < 12)
                        result.errors.push(e instanceof Error ? e.message : String(e));
                }
                progress();
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (target.name === 'rail-empire-orm' && !signal?.aborted) {
                const keys = [];
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k?.startsWith('orm-area-'))
                            keys.push(k);
                    }
                }
                catch { }
                for (const key of keys) {
                    if (signal?.aborted)
                        break;
                    try {
                        const text = localStorage.getItem(key);
                        if (!text)
                            continue;
                        const value = JSON.parse(text);
                        if (!value || typeof value !== 'object' || Array.isArray(value))
                            continue;
                        const row = { ...value, key: key.slice('orm-area-'.length) };
                        if (!Array.isArray(row.ways))
                            continue;
                        if (!Number.isFinite(Number(row.timestamp)))
                            row.timestamp = Date.now();
                        const packed = await packCacheRow(row);
                        if (JSON.stringify(await unpackCacheRow(packed)) !== JSON.stringify(row))
                            throw new Error('Migration locale invalide');
                        if (signal?.aborted)
                            break;
                        const outcome = await replaceCacheIfUnchanged(db, target.store, null, packed);
                        if (outcome === 'committed' && localStorage.getItem(key) === text) {
                            localStorage.removeItem(key);
                            result.legacyMigrated++;
                            result.beforeBytes += new Blob([text]).size;
                            result.afterBytes += rowBytes(packed);
                        }
                        else if (outcome === 'failed')
                            result.failed++;
                    }
                    catch {
                        result.failed++;
                    }
                    progress();
                }
            }
        }
        catch (e) {
            result.failed++;
            if (result.errors.length < 12)
                result.errors.push(e instanceof Error ? e.message : String(e));
        }
        finally {
            db.close();
        }
    }
    result.cancelled = !!signal?.aborted;
    progress();
    return result;
}
export async function storageUsage() {
    let usage = null, quota = null, persistent = null, localBytes = 0, localKeys = 0;
    try {
        if (typeof navigator !== 'undefined' && navigator.storage) {
            const estimate = await navigator.storage.estimate();
            usage = estimate.usage ?? null;
            quota = estimate.quota ?? null;
            persistent = await navigator.storage.persisted();
        }
    }
    catch { }
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key == null)
                continue;
            const value = localStorage.getItem(key) || '';
            localBytes += (key.length + value.length) * 2;
            localKeys++;
        }
    }
    catch { }
    return { usage, quota, persistent, localBytes, localKeys };
}
