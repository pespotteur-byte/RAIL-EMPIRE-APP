const DB_NAME = 'rail-empire-external-catalog-v1';
const STORE = 'catalog';
const ACTIVE_KEY = 'active';
const MAX_ROWS = 100000;
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Base catalogue externe indisponible.'));
    });
}
export async function loadExternalCatalogBundle() {
    if (typeof indexedDB === 'undefined')
        return null;
    const db = await openDB();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(ACTIVE_KEY);
            req.onsuccess = () => resolve(normalizeBundle(req.result));
            req.onerror = () => reject(req.error || new Error('Lecture du catalogue externe impossible.'));
        });
    }
    finally {
        db.close();
    }
}
export async function saveExternalCatalogBundle(bundle) {
    if (typeof indexedDB === 'undefined')
        throw new Error('IndexedDB indisponible : impossible de mémoriser le catalogue externe.');
    const clean = normalizeBundle(bundle);
    if (!clean)
        throw new Error('Catalogue externe invalide.');
    const db = await openDB();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(clean, ACTIVE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Écriture du catalogue externe impossible.'));
            tx.onabort = () => reject(tx.error || new Error('Écriture du catalogue externe annulée.'));
        });
    }
    finally {
        db.close();
    }
}
export async function clearExternalCatalogBundle() {
    if (typeof indexedDB === 'undefined')
        return;
    const db = await openDB();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(ACTIVE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Suppression du catalogue externe impossible.'));
        });
    }
    finally {
        db.close();
    }
}
function asEntry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const raw = value;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || id.length > 180)
        return null;
    const out = {};
    for (const [key, val] of Object.entries(raw)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor')
            continue;
        out[key] = val;
    }
    out.id = id;
    if (typeof out.name !== 'string')
        out.name = id;
    return out;
}
function normalizeBundle(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const raw = value;
    if (raw.format !== 'rail-empire-catalog')
        return null;
    const version = Number(raw.version || 1);
    if (version !== 1)
        return null;
    const modifications = Array.isArray(raw.modifications) ? raw.modifications.map(asEntry).filter((x) => !!x) : [];
    const imports = Array.isArray(raw.imports) ? raw.imports.map(asEntry).filter((x) => !!x) : [];
    const deletions = Array.isArray(raw.deletions) ? raw.deletions.filter((x) => typeof x === 'string' && x.length > 0 && x.length <= 180) : [];
    if (modifications.length + imports.length > MAX_ROWS || deletions.length > MAX_ROWS)
        return null;
    return {
        format: 'rail-empire-catalog', version: 1,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
        catalogBase: typeof raw.catalogBase === 'string' ? raw.catalogBase : undefined,
        modifications, deletions, imports,
        metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : undefined,
    };
}
function parseLegacyArray(value) {
    if (!Array.isArray(value))
        return null;
    const entries = value.map(asEntry).filter((x) => !!x);
    if (!entries.length || entries.length > MAX_ROWS)
        return null;
    return { format: 'rail-empire-catalog', version: 1, modifications: entries, deletions: [], imports: [] };
}
function decodeAscii(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (!b)
            break;
        out += String.fromCharCode(b);
    }
    return out;
}
function parseTar(bytes) {
    const files = new Map();
    let offset = 0;
    while (offset + 512 <= bytes.length) {
        const header = bytes.subarray(offset, offset + 512);
        let empty = true;
        for (let i = 0; i < 512; i++)
            if (header[i] !== 0) {
                empty = false;
                break;
            }
        if (empty)
            break;
        const name = decodeAscii(header.subarray(0, 100));
        const prefix = decodeAscii(header.subarray(345, 500));
        const fullName = (prefix ? prefix + '/' : '') + name;
        const sizeText = decodeAscii(header.subarray(124, 136)).trim().replace(/\0/g, '');
        const size = parseInt(sizeText || '0', 8) || 0;
        const type = header[156];
        offset += 512;
        if (size < 0 || offset + size > bytes.length)
            throw new Error('Archive TAR tronquée.');
        if ((type === 0 || type === 48) && fullName)
            files.set(fullName.replace(/^\.\//, ''), bytes.slice(offset, offset + size));
        offset += Math.ceil(size / 512) * 512;
    }
    return files;
}
async function gunzipFile(file) {
    if (typeof DecompressionStream === 'undefined')
        throw new Error('Ce navigateur ne sait pas ouvrir TAR.GZ. Utilise l’export JSON sur cette machine.');
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
}
function mimeFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png'))
        return 'image/png';
    if (lower.endsWith('.gif'))
        return 'image/gif';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
        return 'image/jpeg';
    if (lower.endsWith('.webp'))
        return 'image/webp';
    if (lower.endsWith('.bmp'))
        return 'image/bmp';
    return 'application/octet-stream';
}
function bytesToDataUrl(bytes, mime) {
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK)
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + CHUNK)));
    return `data:${mime};base64,${btoa(binary)}`;
}
async function hydrateTarAssets(bundle, files) {
    const imports = bundle.imports.map(entry => {
        const out = { ...entry };
        const src = typeof out.imageData === 'string' ? out.imageData.replace(/^\.\//, '') : '';
        if (src.startsWith('assets/')) {
            const asset = files.get(src);
            if (!asset)
                throw new Error(`Image absente de l’archive : ${src}`);
            out.imageData = bytesToDataUrl(asset, mimeFromPath(src));
        }
        return out;
    });
    return { ...bundle, imports };
}
export async function parseExternalCatalogFile(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        const tar = parseTar(await gunzipFile(file));
        const manifestBytes = tar.get('catalog.json');
        if (!manifestBytes)
            throw new Error('catalog.json absent du TAR.GZ.');
        const parsed = JSON.parse(new TextDecoder().decode(manifestBytes));
        const bundle = normalizeBundle(parsed);
        if (!bundle)
            throw new Error('Manifest catalogue incompatible.');
        return hydrateTarAssets(bundle, tar);
    }
    const parsed = JSON.parse(await file.text());
    const bundle = normalizeBundle(parsed) || parseLegacyArray(parsed);
    if (!bundle)
        throw new Error('JSON catalogue incompatible.');
    return bundle;
}
export function applyExternalCatalogBundle(manager, bundle) {
    const result = { modified: 0, deleted: 0, imported: 0, skipped: 0 };
    for (const id of bundle.deletions) {
        if (manager.getById(id) && manager.remove(id))
            result.deleted++;
        else
            result.skipped++;
    }
    for (const mod of bundle.modifications) {
        const item = manager.getById(mod.id);
        if (!item) {
            result.skipped++;
            continue;
        }
        // A player edit made after importing the external catalogue wins over the
        // catalogue overlay, matching the historical admin-catalogue behaviour.
        if (item._catalog && item._edited) {
            result.skipped++;
            continue;
        }
        if (manager.update(mod.id, mod, { markEdited: false }))
            result.modified++;
        else
            result.skipped++;
    }
    for (const imp of bundle.imports) {
        if (manager.getById(imp.id)) {
            result.skipped++;
            continue;
        }
        if (manager.add({ ...imp, _catalog: true, _source: imp._source || 'Catalogue externe' }))
            result.imported++;
        else
            result.skipped++;
    }
    return result;
}
