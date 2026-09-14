import { installSaveSerializerWorker } from './save-serializer-worker.js';
import { compactJson, encodeCompact, decodeJson, textByteStream, type BinaryJson } from './storage-codec.js';
const SAVE_KEY = 'rail-empire-save'; // legacy localStorage key (migration/fallback only)
const SAVE_MARKER_KEY = 'rail-empire-save-present';
const SAVE_META_KEY = 'rail-empire-save-meta';
const SAVE_DB_NAME = 'rail-empire-save-db';
const SAVE_DB_STORE = 'saves';
const SAVE_DB_VERSION = 1;
const SAVE_RECORD_KEY = 'main';
const COMPRESSED_PREFIX = 'RELZ:';
const LOCAL_COMPACT_PREFIX = 'RE13:';
const SAVE_DELETED_KEY = 'rail-empire-save-deleted-at';

type SerializeMode = 'storage' | 'export';

interface SaveRecord {
    key: string;
    stored: string | Blob;
    codec?: BinaryJson['codec'];
    rawBytes?: number;
    compactBytes?: number;
    references?: number;
    sizeBytes: number;
    compressed: boolean;
    updatedAt: number;
}

interface SerializeWorkerResult {
    id: number;
    ok: boolean;
    stored?: string;
    gzip?: boolean;
    buffer?: ArrayBuffer;
    json?: string;
    error?: string;
}

interface SerializePending {
    resolve: (value: SerializeWorkerResult) => void;
    reject: (reason?: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
}

interface SaveOptions { lowMemory?: boolean; }
interface SaveMeta { sizeBytes?: unknown; compressed?: unknown; backend?: unknown; rawBytes?: unknown; references?: unknown; updatedAt?: unknown; }
export interface SaveInfo { sizeBytes: number; sizeKB: number; sizeMB: string; compressed: boolean; backend: string; rawBytes?: number; references?: number; reductionRatio?: number; }

interface PackedLegLike { routePacked?: { count?: unknown }; routePoints?: unknown[]; }
interface PackedPathLike { legs?: PackedLegLike[]; }
interface PackedVersionLike { outboundPath?: PackedPathLike; returnPath?: PackedPathLike; }
interface PackedRecordLike { versions?: PackedVersionLike[]; }
interface PackedStateLike { scheduleV2?: { schedules?: PackedRecordLike[] } }

let _serializeWorker: Worker | null = null;
let _serializeSeq = 0;
const _serializePending = new Map<number, SerializePending>();
let _storageWarned = false;
// Ordering covers saves and deletion, including multiple GameStorage instances.
let _operations: Promise<unknown> = Promise.resolve();
function ordered<T>(job: () => Promise<T>): Promise<T> {
    const result = _operations.then(job, job);
    _operations = result.catch(() => {});
    return result;
}

class SaveIndexedDB {
    _db: IDBDatabase | null;
    _openPromise: Promise<boolean> | null;
    lastError: string | null = null;

    constructor() {
        this._db = null;
        this._openPromise = null;
    }

    open(): Promise<boolean> {
        if (this._db) return Promise.resolve(true);
        if (this._openPromise) return this._openPromise;
        if (typeof indexedDB === 'undefined') return Promise.resolve(false);
        this._openPromise = new Promise<boolean>((resolve) => {
            let settled = false;
            const fail = () => { settled = true; resolve(false); };
            try {
                const req = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(SAVE_DB_STORE))
                        db.createObjectStore(SAVE_DB_STORE, { keyPath: 'key' });
                };
                req.onsuccess = () => {
                    if (settled) { req.result.close(); return; }
                    settled = true;
                    this._db = req.result;
                    this._db.onversionchange = () => {
                        this._db?.close(); this._db = null; this._openPromise = null;
                    };
                    resolve(true);
                };
                req.onerror = fail;
                req.onblocked = fail;
            }
            catch (e) { fail(); }
        }).then(ok => {
            if (!ok) this._openPromise = null;
            return ok;
        });
        return this._openPromise;
    }

    async get(key: IDBValidKey = SAVE_RECORD_KEY): Promise<SaveRecord | null> {
        if (!this._db)
            await this.open();
        if (!this._db)
            return null;
        return new Promise<SaveRecord | null>((resolve) => {
            try {
                const tx = this._db!.transaction(SAVE_DB_STORE, 'readonly');
                const req = tx.objectStore(SAVE_DB_STORE).get(key);
                req.onsuccess = () => resolve((req.result as SaveRecord | undefined) || null);
                req.onerror = () => resolve(null);
            }
            catch (e) {
                resolve(null);
            }
        });
    }

    async set(record: SaveRecord): Promise<boolean> {
        if (!this._db)
            await this.open();
        if (!this._db)
            return false;
        return new Promise<boolean>((resolve) => {
            try {
                const tx = this._db!.transaction(SAVE_DB_STORE, 'readwrite');
                tx.objectStore(SAVE_DB_STORE).put(record);
                tx.oncomplete = () => { this.lastError = null; resolve(true); };
                const fail = () => { this.lastError = tx.error?.name || 'IndexedDBTransactionError'; resolve(false); };
                tx.onerror = fail;
                tx.onabort = fail;
            }
            catch (e) {
                this.lastError = e instanceof Error ? e.name : 'IndexedDBWriteError';
                resolve(false);
            }
        });
    }

    async delete(key: IDBValidKey = SAVE_RECORD_KEY): Promise<boolean> {
        if (!this._db)
            await this.open();
        if (!this._db)
            return false;
        return new Promise<boolean>((resolve) => {
            try {
                const tx = this._db!.transaction(SAVE_DB_STORE, 'readwrite');
                tx.objectStore(SAVE_DB_STORE).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            }
            catch (e) {
                resolve(false);
            }
        });
    }
}

const _saveDb = new SaveIndexedDB();

function safeLocalGet(key: string): string | null {
    try { return localStorage.getItem(key); }
    catch { return null; }
}
function safeLocalSet(key: string, value: string): boolean {
    try { localStorage.setItem(key, value); return true; }
    catch { return false; }
}
function safeLocalRemove(key: string): void {
    try { localStorage.removeItem(key); }
    catch { }
}

function isSaveDeleted(updatedAt: number): boolean {
    const marker = safeLocalGet(SAVE_DELETED_KEY);
    return marker === 'deleted' || (marker !== null && updatedAt <= Number(marker));
}

function saveMeta(sizeBytes: number, compressed: boolean, backend = 'indexeddb', extra: {rawBytes?: number; references?: number; updatedAt?: number} = {}): void {
    safeLocalSet(SAVE_MARKER_KEY, '1');
    safeLocalSet(SAVE_META_KEY, JSON.stringify({ sizeBytes, compressed: !!compressed, backend, updatedAt: Date.now(), ...extra }));
}

function failSerializeWorker(reason: unknown): void {
    const worker = _serializeWorker;
    _serializeWorker = null;
    try { worker?.terminate(); } catch { /* failure must still reject callers */ }
    const pending = [..._serializePending.values()];
    _serializePending.clear();
    for (const p of pending) {
        clearTimeout(p.timer);
        p.reject(reason instanceof Error ? reason : new Error('Worker de sauvegarde indisponible'));
    }
}

function getSerializeWorker(): Worker | null {
    if (_serializeWorker || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined')
        return _serializeWorker;
    try {
        const workerCode = `(${installSaveSerializerWorker.toString()})(self);`;
        const url = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
        _serializeWorker = new Worker(url);
        URL.revokeObjectURL(url);
        _serializeWorker.onmessage = (e: MessageEvent<SerializeWorkerResult>) => {
            const p = _serializePending.get(e.data.id);
            if (!p)
                return;
            _serializePending.delete(e.data.id);
            clearTimeout(p.timer);
            if (e.data.ok)
                p.resolve(e.data);
            else
                p.reject(new Error(e.data.error || 'serialization failed'));
        };
        _serializeWorker.onerror = () => failSerializeWorker(new Error('Échec du worker de sauvegarde'));
        _serializeWorker.onmessageerror = () => failSerializeWorker(new Error('Réponse du worker de sauvegarde illisible'));
    }
    catch (e) {
        _serializeWorker = null;
    }
    return _serializeWorker;
}

function serializeOffMain(state: string, mode: SerializeMode = 'storage'): Promise<SerializeWorkerResult | null> {
    const w = getSerializeWorker();
    if (!w)
        return Promise.resolve(null);
    return new Promise<SerializeWorkerResult>((resolve, reject) => {
        const id = ++_serializeSeq;
        const timer = setTimeout(() => failSerializeWorker(new Error('Délai de sérialisation dépassé')), 60000);
        _serializePending.set(id, { resolve, reject, timer });
        try { w.postMessage({ id, state, mode }); }
        catch (e) { clearTimeout(timer); _serializePending.delete(id); reject(e); }
    });
}

function countPackedScheduleRoutePoints(state: unknown): number {
    let count = 0;
    try {
        const saved = state as PackedStateLike | null | undefined;
        for (const rec of saved?.scheduleV2?.schedules || [])
            for (const ver of rec?.versions || []) {
                for (const path of [ver?.outboundPath, ver?.returnPath])
                    for (const leg of path?.legs || []) {
                        count += Math.max(0, Number(leg?.routePacked?.count || leg?.routePoints?.length || 0));
                        if (count > 12000)
                            return count;
                    }
            }
    }
    catch { }
    return count;
}

async function decompressData(stored: string | null | undefined): Promise<string | null> {
    if (!stored)
        return null;
    if (stored.startsWith(COMPRESSED_PREFIX)) {
        const b64 = stored.slice(COMPRESSED_PREFIX.length);
        try {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
                bytes[i] = binary.charCodeAt(i);
            if (typeof DecompressionStream === 'undefined')
                throw new Error('DecompressionStream indisponible');
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return await new Response(stream).text();
        }
        catch (e) {
            console.warn('Decompression failed:', e);
            return null;
        }
    }
    return stored;
}

export class GameStorage {
    _ready: Promise<boolean>;
    lastError: string | null = null;

    constructor() {
        this._ready = _saveDb.open();
        // Never delete offline geometry at startup to manufacture a storage gain.
        try { if (navigator?.storage?.persist) navigator.storage.persist().catch(() => {}); } catch {}
    }

    hasSave(): boolean {
        return safeLocalGet(SAVE_MARKER_KEY) === '1' || !!safeLocalGet(SAVE_KEY);
    }

    async hasSaveAsync(): Promise<boolean> {
        await _operations;
        if (this.hasSave()) return true;
        try {
            const rec = await _saveDb.get(SAVE_RECORD_KEY);
            if (rec?.stored && !isSaveDeleted(rec.updatedAt)) {
                saveMeta(rec.sizeBytes, !!rec.compressed, 'indexeddb', {rawBytes:rec.rawBytes, references:rec.references, updatedAt:rec.updatedAt});
                return true;
            }
        } catch {}
        return false;
    }

    async _writeIndexed(payload: BinaryJson, updatedAt = Date.now()): Promise<boolean> {
        const ok = await _saveDb.set({ key: SAVE_RECORD_KEY, stored: payload.data,
            codec: payload.codec, sizeBytes: payload.data.size, compressed: payload.codec === 'RE13/gzip',
            rawBytes: payload.rawBytes, compactBytes: payload.compactBytes, references: payload.references, updatedAt });
        if (ok) {
            // IndexedDB transaction completed: only now remove the fallback copy.
            safeLocalRemove(SAVE_KEY); safeLocalRemove(SAVE_DELETED_KEY);
            saveMeta(payload.data.size, payload.codec === 'RE13/gzip', 'indexeddb', {
                rawBytes: payload.rawBytes, references: payload.references, updatedAt });
        }
        return ok;
    }

    saveGame(state: unknown, options: SaveOptions | null = null): Promise<boolean> {
        let compact: ReturnType<typeof compactJson>;
        let lowMemory: boolean;
        try {
            // Capture at call time, before any wait: a caller can mutate its own snapshot afterwards.
            lowMemory = options?.lowMemory === true || countPackedScheduleRoutePoints(state) > 12000;
            compact = compactJson(state);
            lowMemory ||= compact.rawBytes > 4 * 1024 * 1024;
        } catch (e) { this.lastError = e instanceof Error ? e.message : String(e); return Promise.resolve(false); }
        return ordered(async () => {
            try {
                let payload: BinaryJson | null = null;
                if (!lowMemory) {
                    try {
                        const wr = await serializeOffMain(compact.json, 'storage');
                        if (wr?.gzip && wr.buffer) payload = { codec:'RE13/gzip', data:new Blob([wr.buffer]),
                            storedBytes:wr.buffer.byteLength, rawBytes:compact.rawBytes, compactBytes:compact.compactBytes,
                            duplicateBytes:compact.duplicateBytes, references:compact.references };
                    } catch { /* worker unavailable: same codec, no data loss */ }
                }
                payload ??= await encodeCompact(compact);
                const updatedAt = Date.now();
                if (await this._writeIndexed(payload, updatedAt)) { this.lastError = null; return true; }
                // Web Storage only supports strings. Base64 is a last-resort fallback, never the main store.
                const bytes = new Uint8Array(await payload.data.arrayBuffer());
                let binary = '';
                for (let i = 0; i < bytes.length; i += 0x8000)
                    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
                const stored = LOCAL_COMPACT_PREFIX + JSON.stringify({ codec:payload.codec, data:btoa(binary),
                    rawBytes:payload.rawBytes, references:payload.references, updatedAt });
                try {
                    localStorage.setItem(SAVE_KEY, stored); safeLocalRemove(SAVE_DELETED_KEY);
                    saveMeta(new Blob([stored]).size, payload.codec === 'RE13/gzip', 'localStorage-fallback', {
                        rawBytes:payload.rawBytes, references:payload.references, updatedAt });
                    this.lastError = null; return true;
                } catch (e) {
                    this.lastError = `${_saveDb.lastError || 'IndexedDBUnavailable'} / ${e instanceof Error ? e.name : String(e)}`;
                    if (!_storageWarned) { _storageWarned = true;
                        if (typeof alert === 'function') alert('Sauvegarde impossible : quota ou stockage indisponible. La dernière sauvegarde reste conservée. Exportez la partie et ouvrez Stockage pour compacter les caches.'); }
                    return false;
                }
            } catch (e) { this.lastError = e instanceof Error ? e.message : String(e); return false; }
        });
    }

    async makeExportBlob(state: unknown): Promise<{ blob: Blob; ext: '.json.gz' | '.json' }> {
        // Snapshot before the first await, including the worker-failure fallback.
        const json = JSON.stringify(state);
        if (typeof json !== 'string') throw new Error('Sauvegarde non sérialisable');
        try {
            const wr = countPackedScheduleRoutePoints(state) > 12000 ? null : await serializeOffMain(json, 'export');
            if (wr?.gzip && wr.buffer)
                return { blob: new Blob([wr.buffer], { type: 'application/gzip' }), ext: '.json.gz' };
            if (wr?.json != null)
                return { blob: new Blob([wr.json], { type: 'application/json' }), ext: '.json' };
        }
        catch (e) { /* fallback below */ }
        if (typeof CompressionStream !== 'undefined') {
            try {
                const stream = textByteStream(json).pipeThrough(new CompressionStream('gzip'));
                return { blob: await new Response(stream).blob(), ext: '.json.gz' };
            }
            catch (e) { /* raw below */ }
        }
        return { blob: new Blob([json], { type: 'application/json' }), ext: '.json' };
    }

    async _parseStored(stored: string | Blob | null | undefined, codec?: BinaryJson['codec']): Promise<unknown> {
        if (!stored) return null;
        if (stored instanceof Blob) {
            if (!codec) throw new Error('Codec binaire absent.');
            return decodeJson({codec, data:stored});
        }
        if (stored.startsWith(LOCAL_COMPACT_PREFIX)) {
            const rec = JSON.parse(stored.slice(LOCAL_COMPACT_PREFIX.length)) as {codec: BinaryJson['codec']; data:string};
            const binary = atob(rec.data), bytes = new Uint8Array(binary.length);
            for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
            return decodeJson({codec:rec.codec, data:new Blob([bytes])});
        }
        const json = await decompressData(stored);
        if (!json) throw new Error('Sauvegarde historique illisible.');
        return JSON.parse(json);
    }

    async loadGame(): Promise<unknown> {
        await _operations;
        let rec = await _saveDb.get(SAVE_RECORD_KEY);
        if (rec && isSaveDeleted(rec.updatedAt)) rec = null;
        const local = safeLocalGet(SAVE_KEY);
        let localTime = 0;
        try {
            if (local?.startsWith(LOCAL_COMPACT_PREFIX)) localTime = Number(JSON.parse(local.slice(LOCAL_COMPACT_PREFIX.length)).updatedAt) || 0;
            else { const meta = JSON.parse(safeLocalGet(SAVE_META_KEY) || '{}');
                if (String(meta.backend || '').startsWith('localStorage')) localTime = Number(meta.updatedAt) || 0; }
        } catch {}
        const candidates = local && (local.startsWith(LOCAL_COMPACT_PREFIX) || !rec || localTime >= rec.updatedAt) ?
            [{stored:local, codec:undefined}, rec] : [rec, local ? {stored:local, codec:undefined} : null];
        for (const candidate of candidates) {
            if (!candidate?.stored) continue;
            try {
                const state = await this._parseStored(candidate.stored, candidate.codec);
                if (state == null) continue;
                // Reading does not rewrite user data. Migration happens on the next confirmed save.
                this.lastError = null;
                return state;
            } catch (e) { this.lastError = e instanceof Error ? e.message : String(e); }
        }
        return null;
    }

    deleteSave(): Promise<boolean> {
        return ordered(async () => {
            const deleted = await _saveDb.delete(SAVE_RECORD_KEY);
            safeLocalRemove(SAVE_KEY); safeLocalRemove(SAVE_MARKER_KEY); safeLocalRemove(SAVE_META_KEY);
            if (deleted) safeLocalRemove(SAVE_DELETED_KEY);
            else {
                const masked = safeLocalSet(SAVE_DELETED_KEY, 'deleted');
                this.lastError = masked ? 'Suppression IndexedDB différée : sauvegarde masquée' : 'Échec de suppression : stockage indisponible';
                return masked;
            }
            this.lastError = null;
            return true;
        });
    }

    getSaveInfo(): SaveInfo | null {
        const fallback = safeLocalGet(SAVE_KEY);
        if (fallback?.startsWith(LOCAL_COMPACT_PREFIX)) {
            try {
                // The fallback can commit while the smaller metadata update still fails.
                // Its own envelope is authoritative, rather than stale IndexedDB metadata.
                const record = JSON.parse(fallback.slice(LOCAL_COMPACT_PREFIX.length)) as {codec?:unknown;rawBytes?:unknown;references?:unknown};
                const sizeBytes = new Blob([fallback]).size, rawBytes = Number(record.rawBytes) || 0;
                return {sizeBytes,sizeKB:Math.round(sizeBytes/1024),sizeMB:(sizeBytes/1048576).toFixed(2),
                    compressed:record.codec==='RE13/gzip',backend:'localStorage-fallback',rawBytes:rawBytes||undefined,
                    references:Number(record.references)||0,reductionRatio:rawBytes>0?rawBytes/sizeBytes:undefined};
            } catch { /* Corrupt local data: the older IndexedDB metadata remains useful. */ }
        }
        try {
            const meta = JSON.parse(safeLocalGet(SAVE_META_KEY) || 'null') as SaveMeta | null;
            if (meta?.sizeBytes != null) {
                const sizeBytes = Number(meta.sizeBytes) || 0;
                return {
                    sizeBytes,
                    sizeKB: Math.round(sizeBytes / 1024),
                    sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
                    compressed: !!meta.compressed,
                    backend: typeof meta.backend === 'string' ? meta.backend : 'indexeddb',
                    rawBytes: Number(meta.rawBytes) || undefined, references: Number(meta.references) || 0,
                    reductionRatio: sizeBytes > 0 && Number(meta.rawBytes) > 0 ? Number(meta.rawBytes) / sizeBytes : undefined,
                };
            }
        }
        catch { }
        const raw = safeLocalGet(SAVE_KEY);
        if (!raw)
            return null;
        const sizeBytes = new Blob([raw]).size;
        return {
            sizeBytes,
            sizeKB: Math.round(sizeBytes / 1024),
            sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
            compressed: raw.startsWith(COMPRESSED_PREFIX),
            backend: 'localStorage-legacy',
        };
    }
}
