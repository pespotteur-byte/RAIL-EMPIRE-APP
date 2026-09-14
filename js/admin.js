import { htmlText } from './html-text.js';
import { AuxiliaryJsonStorage, AUXILIARY_KEYS } from './storage-auxiliary.js';
const adminStorage = new AuxiliaryJsonStorage();
const adminSnapshots = new Map();
let adminReady = false;
let adminWriting = false;
function readAdminSnapshot(key) {
    const value = adminSnapshots.get(key) ?? [];
    return JSON.parse(JSON.stringify(value));
}
async function persistAdmin(key, value) {
    try {
        await adminStorage.save(key, value);
        adminSnapshots.set(key, JSON.parse(JSON.stringify(value)));
        return true;
    }
    catch (error) {
        alert(error instanceof Error ? error.message : String(error));
        return false;
    }
}
// Serialize editing operations; reject overlapping clicks instead of deriving two
// replacement arrays from the same stale snapshot. Publishing/export stay blocked
// while an edit is being committed, and every handler releases the guard in finally.
function adminMutation(action) {
    return async () => {
        if (!adminReady || adminWriting)
            return;
        adminWriting = true;
        try {
            await action();
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error));
        }
        finally {
            adminWriting = false;
        }
    };
}
import { catalogRecord } from './catalog-contracts.js';
const ADMIN_TAGS = {
    "stat-total": "b",
    "stat-locos": "b",
    "stat-wagons": "b",
    "stat-sources": "b",
    "stat-filtered": "b",
    "search": "input",
    "filter-cat": "select",
    "filter-source": "select",
    "filter-traction": "select",
    "btn-import": "button",
    "btn-export": "button",
    "btn-export-csv": "button",
    "btn-delete-selected": "button",
    "btn-incidents": "button",
    "btn-publish": "button",
    "table-wrap": "div",
    "select-all": "input",
    "tbody": "tbody",
    "page-prev": "button",
    "page-info": "span",
    "page-next": "button",
    "page-size": "select",
    "footer-info": "span",
    "modal-edit": "div",
    "edit-title": "h2",
    "edit-image-preview": "div",
    "edit-name": "input",
    "edit-series": "input",
    "edit-category": "select",
    "edit-traction": "select",
    "edit-vmax": "input",
    "edit-power": "input",
    "edit-mass": "input",
    "edit-length": "input",
    "edit-pax": "input",
    "edit-freight": "input",
    "edit-price": "input",
    "edit-cargo": "input",
    "edit-cancel": "button",
    "edit-save": "button",
    "modal-import": "div",
    "drop-zone": "div",
    "import-file": "input",
    "import-progress": "div",
    "import-bar": "div",
    "import-status": "p",
    "import-results": "div",
    "import-table-wrap": "div",
    "import-cancel": "button",
    "import-confirm": "button",
    "modal-incidents": "div",
    "incident-add": "button",
    "incidents-list": "div",
    "incidents-close": "button",
    "modal-incident-edit": "div",
    "incident-edit-title": "h2",
    "inc-name": "input",
    "inc-desc": "input",
    "inc-effect": "select",
    "inc-severity": "select",
    "inc-duration": "input",
    "inc-probability": "input",
    "inc-hour-start": "input",
    "inc-hour-end": "input",
    "incident-edit-cancel": "button",
    "incident-edit-save": "button",
    "modal-publish": "div",
    "publish-token-section": "div",
    "gh-token": "input",
    "publish-status": "div",
    "publish-cancel": "button",
    "publish-confirm": "button"
};
function byId(id) {
    const element = document.getElementById(id);
    if (!element || element.tagName.toLowerCase() !== ADMIN_TAGS[id]) {
        throw new Error(`Contrôle administrateur absent ou incorrect : ${id}`);
    }
    return element;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function readStoredJson(key) {
    return readAdminSnapshot(key);
}
function catalogEntries(value) {
    if (!Array.isArray(value))
        return [];
    const entries = [];
    for (const raw of value) {
        const source = catalogRecord(raw);
        if (!source || typeof source.id !== 'string')
            continue;
        const entry = { ...source, id: source.id };
        for (const key of ['name', 'seriesName', 'category', 'traction', 'imageData', '_source']) {
            if (source[key] != null)
                entry[key] = String(source[key]);
        }
        for (const key of ['maxSpeed', 'power', 'mass', 'length', 'passengerCapacity', 'freightCapacity', 'purchasePrice']) {
            if (source[key] != null) {
                const value = Number(source[key]);
                entry[key] = Number.isFinite(value) ? value : 0;
            }
        }
        if (source.cargoTypes != null)
            entry.cargoTypes = Array.isArray(source.cargoTypes) ? source.cargoTypes.filter((x) => typeof x === 'string') : [];
        entries.push(entry);
    }
    return entries;
}
function readCatalogStorage(key) { return catalogEntries(readStoredJson(key)); }
function readStringStorage(key) {
    const value = readStoredJson(key);
    return Array.isArray(value) ? value.filter((x) => typeof x === 'string') : [];
}
function readIncidents() {
    const value = readStoredJson('admin_incidents');
    if (!Array.isArray(value))
        return [];
    return value.flatMap(raw => {
        const item = catalogRecord(raw);
        if (!item || typeof item.id !== 'string')
            return [];
        const num = (key, fallback) => Number.isFinite(Number(item[key])) ? Number(item[key]) : fallback;
        return [{ id: item.id, name: String(item.name ?? ''), description: String(item.description ?? ''),
                effect: String(item.effect ?? 'delay'), severity: String(item.severity ?? 'medium'),
                duration: num('duration', 60), probability: num('probability', 5), hourStart: num('hourStart', 0), hourEnd: num('hourEnd', 24) }];
    });
}
// ============ LOAD ALL CATALOGS ============
import { CATALOG } from './catalog-data.js';
import { CATALOG_PACK_RE } from './catalog-data-pack-re.js';
let allItems = [];
let filteredItems = [];
let currentPage = 0;
let pageSize = 500;
let sortCol = 'name';
let sortAsc = true;
const selectedIds = new Set();
let editingItem = null;
// Load everything
function loadCatalogs() {
    allItems = [];
    // MLG
    if (Array.isArray(CATALOG)) {
        for (const c of CATALOG)
            allItems.push({ ...c, _source: c._source || 'MLG' });
    }
    // Pack RE
    if (Array.isArray(CATALOG_PACK_RE)) {
        for (const c of CATALOG_PACK_RE)
            allItems.push({ ...c, _source: c._source || 'PACK RE' });
    }
    // Imports/deletions must work even before the first edited catalogue item.
    // Apply overrides AFTER merging imports, and deletions to both sources.
    const mods = readCatalogStorage('admin_catalog_mods');
    const modMap = new Map(mods.map(item => [item.id, item]));
    const deletedIds = new Set(readStringStorage('admin_catalog_deleted'));
    for (const item of readCatalogStorage('admin_catalog_imported'))
        allItems.push(item);
    allItems = allItems.filter(item => !deletedIds.has(item.id))
        .map(item => modMap.has(item.id) ? { ...item, ...modMap.get(item.id) } : item);
    updateStats();
    applyFilters();
}
// ============ STATS ============
function updateStats() {
    // One pass, including catalogues with thousands of distinct source labels.
    // Do not repeatedly filter/reparse the entire catalogue for each option.
    const sourceCounts = new Map();
    let locomotives = 0, wagons = 0;
    for (const item of allItems) {
        const source = item._source || '?';
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
        if (item.category === 'locomotive' || item.category === 'automotrice')
            locomotives++;
        if (item.category === 'wagon' || item.category === 'voiture')
            wagons++;
    }
    byId('stat-total').textContent = allItems.length.toLocaleString();
    byId('stat-locos').textContent = locomotives.toLocaleString();
    byId('stat-wagons').textContent = wagons.toLocaleString();
    const sources = [...sourceCounts.keys()].sort();
    const label = byId('stat-sources');
    label.textContent = `${sources.length.toLocaleString()} sources`;
    // Keep the header bounded; every full source stays available in the filter.
    label.title = sources.slice(0, 5).join(', ').slice(0, 240);
    const select = byId('filter-source'), previous = select.value;
    const fragment = document.createDocumentFragment();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'Toutes sources';
    fragment.appendChild(all);
    for (const source of sources) {
        const option = document.createElement('option');
        option.value = source;
        option.textContent = `${source} (${sourceCounts.get(source).toLocaleString()})`;
        fragment.appendChild(option);
    }
    select.replaceChildren(fragment);
    select.value = previous;
}
// ============ FILTER + SORT ============
function applyFilters() {
    const q = byId('search').value.toLowerCase().trim();
    const cat = byId('filter-cat').value;
    const src = byId('filter-source').value;
    const trac = byId('filter-traction').value;
    filteredItems = allItems.filter(i => {
        if (cat && i.category !== cat)
            return false;
        if (src && (i._source || '') !== src)
            return false;
        if (trac && (i.traction || '') !== trac)
            return false;
        if (q) {
            const hay = `${i.name || ''} ${i.seriesName || ''} ${i._source || ''} ${i.id || ''}`.toLowerCase();
            if (!hay.includes(q))
                return false;
        }
        return true;
    });
    // Sort
    filteredItems.sort((a, b) => {
        let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
        if (typeof va === 'number' && typeof vb === 'number')
            return sortAsc ? va - vb : vb - va;
        const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
        return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    byId('stat-filtered').textContent = filteredItems.length.toLocaleString();
    currentPage = 0;
    renderPage();
}
// ============ RENDER ============
function renderPage() {
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, filteredItems.length);
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const tbody = byId('tbody');
    let html = '';
    for (let i = start; i < end; i++) {
        const item = filteredItems[i];
        const checked = selectedIds.has(item.id) ? 'checked' : '';
        const catBadge = item.category === 'locomotive' ? 'badge-loco' : item.category === 'automotrice' ? 'badge-auto' : 'badge-wagon';
        const catLabel = (item.category || '').substring(0, 5);
        const price = item.purchasePrice ? (item.purchasePrice >= 1000000 ? (item.purchasePrice / 1000000).toFixed(1) + 'M€' : (item.purchasePrice / 1000).toFixed(0) + 'k€') : '-';
        html += `<tr data-id="${escapeHtml(item.id)}">
      <td><input type="checkbox" class="row-cb" data-id="${escapeHtml(item.id)}" ${checked}></td>
      <td><img src="${escapeHtml(item.imageData || '')}" class="img-cell" loading="lazy"></td>
      <td title="${escapeHtml(item.name || '')}">${escapeHtml(item.name || '')}</td>
      <td title="${escapeHtml(item.seriesName || '')}">${escapeHtml(item.seriesName || '')}</td>
      <td><span class="badge ${htmlText(catBadge)}">${escapeHtml(catLabel)}</span></td>
      <td>${escapeHtml(item.traction || '-')}</td>
      <td>${item.maxSpeed || '-'}</td>
      <td>${item.power || '-'}</td>
      <td>${item.length || '-'}</td>
      <td>${item.mass || '-'}</td>
      <td>${price}</td>
      <td><span class="badge badge-source">${escapeHtml(item._source || '?')}</span></td>
    </tr>`;
    }
    tbody.innerHTML = html;
    byId('page-info').textContent = `${currentPage + 1} / ${totalPages}`;
    byId('page-prev').disabled = currentPage === 0;
    byId('page-next').disabled = currentPage >= totalPages - 1;
    byId('footer-info').textContent = `Lignes ${start + 1}-${end} sur ${filteredItems.length.toLocaleString()}`;
}
// ============ EVENTS ============
byId('search').addEventListener('input', debounce(applyFilters, 200));
byId('filter-cat').addEventListener('change', applyFilters);
byId('filter-source').addEventListener('change', applyFilters);
byId('filter-traction').addEventListener('change', applyFilters);
byId('page-size').addEventListener('change', () => { pageSize = +byId('page-size').value; currentPage = 0; renderPage(); });
byId('page-prev').addEventListener('click', () => { if (currentPage > 0) {
    currentPage--;
    renderPage();
    byId('table-wrap').scrollTop = 0;
} });
byId('page-next').addEventListener('click', () => { const tp = Math.ceil(filteredItems.length / pageSize); if (currentPage < tp - 1) {
    currentPage++;
    renderPage();
    byId('table-wrap').scrollTop = 0;
} });
// Sort headers
document.querySelectorAll('th[data-col]').forEach(th => {
    if (!(th instanceof HTMLElement))
        return;
    th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (!col)
            return;
        if (sortCol === col)
            sortAsc = !sortAsc;
        else {
            sortCol = col;
            sortAsc = true;
        }
        applyFilters();
    });
});
// Select all
byId('select-all').addEventListener('change', e => {
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, filteredItems.length);
    for (let i = start; i < end; i++) {
        if (byId('select-all').checked)
            selectedIds.add(filteredItems[i].id);
        else
            selectedIds.delete(filteredItems[i].id);
    }
    renderPage();
});
// Row checkbox
byId('tbody').addEventListener('change', e => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.classList.contains('row-cb')) {
        const id = target.dataset.id;
        if (!id)
            return;
        if (target.checked)
            selectedIds.add(id);
        else
            selectedIds.delete(id);
    }
});
// ============ DELETE ============
byId('btn-delete-selected').addEventListener('click', adminMutation(async () => {
    if (selectedIds.size === 0)
        return alert('Aucun engin sélectionné');
    if (!confirm(`Supprimer ${selectedIds.size} engin(s) ?`))
        return;
    const deletedIds = new Set(readStringStorage('admin_catalog_deleted'));
    for (const id of selectedIds)
        deletedIds.add(id);
    if (!await persistAdmin('admin_catalog_deleted', [...deletedIds]))
        return;
    allItems = allItems.filter(i => !selectedIds.has(i.id));
    selectedIds.clear();
    updateStats();
    applyFilters();
}));
// ============ EDIT MODAL ============
window._editItem = function (id) {
    editingItem = allItems.find(i => i.id === id);
    if (!editingItem)
        return;
    byId('edit-title').textContent = `Modifier : ${editingItem.name}`;
    byId('edit-image-preview').innerHTML = editingItem.imageData ? `<img src="${escapeHtml(editingItem.imageData)}" style="max-height:60px;max-width:200px;border-radius:4px">` : '';
    byId('edit-name').value = String(editingItem.name || '');
    byId('edit-series').value = String(editingItem.seriesName || '');
    byId('edit-category').value = String(editingItem.category || 'wagon');
    byId('edit-traction').value = String(editingItem.traction || 'none');
    byId('edit-vmax').value = String(editingItem.maxSpeed || 0);
    byId('edit-power').value = String(editingItem.power || 0);
    byId('edit-mass').value = String(editingItem.mass || 0);
    byId('edit-length').value = String(editingItem.length || 0);
    byId('edit-pax').value = String(editingItem.passengerCapacity || 0);
    byId('edit-freight').value = String(editingItem.freightCapacity || 0);
    byId('edit-price').value = String(editingItem.purchasePrice || 0);
    byId('edit-cargo').value = String((editingItem.cargoTypes || []).join(', '));
    byId('modal-edit').classList.add('active');
};
byId('edit-cancel').addEventListener('click', () => byId('modal-edit').classList.remove('active'));
byId('edit-save').addEventListener('click', adminMutation(async () => {
    if (!editingItem)
        return;
    const updatedItem = { ...editingItem };
    updatedItem.name = byId('edit-name').value;
    updatedItem.seriesName = byId('edit-series').value;
    updatedItem.category = byId('edit-category').value;
    updatedItem.traction = byId('edit-traction').value;
    updatedItem.maxSpeed = +byId('edit-vmax').value;
    updatedItem.power = +byId('edit-power').value;
    updatedItem.mass = +byId('edit-mass').value;
    updatedItem.length = +byId('edit-length').value;
    updatedItem.passengerCapacity = +byId('edit-pax').value;
    updatedItem.freightCapacity = +byId('edit-freight').value;
    updatedItem.purchasePrice = +byId('edit-price').value;
    updatedItem.cargoTypes = byId('edit-cargo').value.split(',').map(s => s.trim()).filter(Boolean);
    updatedItem.tonnage = updatedItem.mass;
    // Save modification
    const mods = readCatalogStorage('admin_catalog_mods');
    const idx = mods.findIndex(m => m.id === editingItem.id);
    if (idx >= 0)
        mods[idx] = updatedItem;
    else
        mods.push(updatedItem);
    if (!await persistAdmin('admin_catalog_mods', mods))
        return;
    Object.assign(editingItem, updatedItem);
    byId('modal-edit').classList.remove('active');
    renderPage();
}));
// ============ EXPORT JSON ============
byId('btn-export').addEventListener('click', () => {
    const data = JSON.stringify(filteredItems, null, 2);
    downloadBlob(data, 'catalogue-rail-empire.json', 'application/json');
});
// ============ EXPORT CSV ============
byId('btn-export-csv').addEventListener('click', () => {
    const cols = ['id', 'name', 'seriesName', 'category', 'traction', 'maxSpeed', 'power', 'mass', 'length', 'passengerCapacity', 'freightCapacity', 'purchasePrice', 'imageData', '_source', 'cargoTypes'];
    let csv = cols.join(';') + '\n';
    for (const item of filteredItems) {
        csv += cols.map(c => {
            let v = item[c] ?? '';
            if (Array.isArray(v))
                v = v.join(',');
            return String(v).replace(/;/g, ',');
        }).join(';') + '\n';
    }
    downloadBlob(csv, 'catalogue-rail-empire.csv', 'text/csv');
});
function downloadBlob(content, name, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}
// ============ IMPORT ============
const dropZone = byId('drop-zone');
const importFile = byId('import-file');
let importedEntries = [];
byId('btn-import').addEventListener('click', () => {
    importedEntries = [];
    byId('import-progress').style.display = 'none';
    byId('import-results').style.display = 'none';
    byId('import-confirm').style.display = 'none';
    byId('modal-import').classList.add('active');
});
byId('import-cancel').addEventListener('click', () => byId('modal-import').classList.remove('active'));
dropZone.addEventListener('click', () => importFile.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag'); const file = e.dataTransfer?.files[0]; if (file)
    void processImportFile(file); });
importFile.addEventListener('change', () => { const file = importFile.files?.[0]; if (file)
    void processImportFile(file); });
async function processImportFile(file) {
    byId('import-progress').style.display = 'block';
    const status = byId('import-status');
    const bar = byId('import-bar');
    status.textContent = 'Lecture du fichier...';
    bar.style.width = '10%';
    try {
        if (!window.JSZip)
            throw new Error('Le module ZIP n’a pas pu être chargé.');
        const zip = await window.JSZip.loadAsync(file);
        const imageFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir && /\.(png|gif|jpg|jpeg|bmp|webp)$/i.test(f));
        status.textContent = `${imageFiles.length} images trouvées. Analyse...`;
        bar.style.width = '30%';
        // Group by folder
        const folders = {};
        for (const path of imageFiles) {
            const parts = path.split('/').filter(Boolean);
            let folderName, fileName;
            if (parts.length >= 2) {
                // Skip root folder, use immediate parent as series
                folderName = parts[parts.length - 2];
                fileName = parts[parts.length - 1];
            }
            else {
                folderName = '_root';
                fileName = parts[0];
            }
            if (!folders[folderName])
                folders[folderName] = [];
            folders[folderName].push({ path, fileName });
        }
        status.textContent = `${Object.keys(folders).length} séries détectées. Extraction des images...`;
        bar.style.width = '50%';
        importedEntries = [];
        let processed = 0;
        for (const [folderName, files] of Object.entries(folders)) {
            for (const { path, fileName } of files) {
                const nameNoExt = fileName.replace(/\.\w+$/, '');
                const blob = await zip.files[path].async('blob');
                const url = URL.createObjectURL(blob);
                // Get image dimensions for length calculation
                let lengthM = 15.0;
                try {
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = url;
                    });
                    lengthM = Math.round(img.naturalWidth * 0.1 * 10) / 10; // 1px = 10cm
                }
                catch (e) { }
                // Auto-detect specs from folder/name
                const specs = autoDetectSpecs(folderName, nameNoExt, lengthM);
                const entry = {
                    id: `import-${Date.now()}-${processed}`,
                    name: nameNoExt,
                    category: specs.category,
                    traction: specs.traction,
                    maxSpeed: specs.vmax,
                    mass: specs.mass,
                    power: specs.power,
                    passengerCapacity: 0,
                    freightCapacity: specs.freightCapacity,
                    length: lengthM,
                    imageData: url,
                    _importPath: path,
                    _importBlob: blob,
                    seriesName: folderName === '_root' ? nameNoExt : folderName,
                    numberStart: '',
                    purchasePrice: specs.price,
                    cargoTypes: specs.cargoTypes,
                    _source: 'Import',
                    tonnage: specs.mass,
                    _catalog: true,
                };
                importedEntries.push(entry);
                processed++;
                bar.style.width = `${50 + Math.round(processed / imageFiles.length * 40)}%`;
            }
        }
        bar.style.width = '100%';
        status.textContent = `${importedEntries.length} engins prêts à importer.`;
        // Show preview table
        const wrap = byId('import-table-wrap');
        let html = '<table style="width:100%"><thead><tr><th>Image</th><th>Nom</th><th>Série</th><th>Cat.</th><th>VMax</th><th>Puiss.</th><th>Long.</th><th>Prix</th></tr></thead><tbody>';
        for (const e of importedEntries.slice(0, 50)) {
            const price = (e.purchasePrice ?? 0) >= 1000000 ? ((e.purchasePrice ?? 0) / 1000000).toFixed(1) + 'M€' : ((e.purchasePrice ?? 0) / 1000).toFixed(0) + 'k€';
            html += `<tr>
        <td><img src="${escapeHtml(e.imageData)}" style="height:25px;max-width:80px;object-fit:contain"></td>
        <td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.seriesName)}</td><td>${escapeHtml(e.category)}</td>
        <td>${e.maxSpeed}</td><td>${e.power}</td><td>${e.length}</td><td>${price}</td></tr>`;
        }
        if (importedEntries.length > 50)
            html += `<tr><td colspan="8" style="text-align:center;color:var(--text2)">...et ${importedEntries.length - 50} autres</td></tr>`;
        html += '</tbody></table>';
        wrap.innerHTML = html;
        byId('import-results').style.display = 'block';
        byId('import-confirm').style.display = 'inline-flex';
    }
    catch (e) {
        status.textContent = `Erreur : ${errorMessage(e)}`;
        bar.style.width = '100%';
        bar.style.background = 'var(--red)';
    }
}
// Auto-detect specs from folder name and file name
function autoDetectSpecs(folder, name, lengthM) {
    const fl = folder.toLowerCase();
    const nl = name.toLowerCase();
    const combined = fl + ' ' + nl;
    // Known loco patterns
    const locoPatterns = {
        '185': { vmax: 140, power: 5600, mass: 84, traction: 'electrique' },
        '186': { vmax: 160, power: 5600, mass: 86, traction: 'electrique' },
        '187': { vmax: 140, power: 5600, mass: 87, traction: 'bi' },
        '188': { vmax: 160, power: 2400, mass: 90, traction: 'bi' },
        '193': { vmax: 200, power: 6400, mass: 87, traction: 'electrique' },
        'vectron': { vmax: 200, power: 6400, mass: 87, traction: 'electrique' },
        '218': { vmax: 140, power: 2060, mass: 79, traction: 'diesel' },
        '214': { vmax: 100, power: 1100, mass: 62, traction: 'diesel' },
        'g1206': { vmax: 100, power: 1500, mass: 87, traction: 'diesel' },
        'g2000': { vmax: 120, power: 2240, mass: 90, traction: 'diesel' },
        'g1000': { vmax: 100, power: 1100, mass: 80, traction: 'diesel' },
        'de18': { vmax: 120, power: 1800, mass: 85, traction: 'diesel' },
        'e4000': { vmax: 160, power: 3178, mass: 126, traction: 'diesel' },
        'euro4000': { vmax: 160, power: 3178, mass: 126, traction: 'diesel' },
        'tgv': { vmax: 300, power: 8800, mass: 383, traction: 'electrique' },
        'ave': { vmax: 300, power: 8800, mass: 392, traction: 'electrique' },
    };
    // Check if it's a known loco
    for (const [pattern, specs] of Object.entries(locoPatterns)) {
        if (combined.includes(pattern)) {
            const price = 1000 * specs.power;
            return { category: 'locomotive', ...specs, freightCapacity: 0, price, cargoTypes: [] };
        }
    }
    // Wagon type detection from folder
    const wagonTypes = {
        'citerne': { vmax: 100, mass: 24, freightCapacity: 66, cargoTypes: ['hydrocarbures', 'produits chimiques'] },
        'gaz': { vmax: 100, mass: 24, freightCapacity: 65, cargoTypes: ['gaz liquéfié', 'GPL'] },
        'intermodal': { vmax: 120, mass: 25, freightCapacity: 60, cargoTypes: ['conteneurs', 'caisses mobiles'] },
        'conteneur': { vmax: 120, mass: 25, freightCapacity: 60, cargoTypes: ['conteneurs', 'caisses mobiles'] },
        'porte-auto': { vmax: 120, mass: 35, freightCapacity: 25, cargoTypes: ['véhicules automobiles'] },
        'auto': { vmax: 120, mass: 35, freightCapacity: 25, cargoTypes: ['véhicules automobiles'] },
        'bach': { vmax: 120, mass: 22, freightCapacity: 68, cargoTypes: ['bobines acier', 'produits sidérurgiques'] },
        'plat': { vmax: 100, mass: 20, freightCapacity: 55, cargoTypes: ['bois', 'machines', 'rails'] },
        'tremi': { vmax: 100, mass: 20, freightCapacity: 60, cargoTypes: ['céréales', 'sable', 'ciment'] },
        'hopper': { vmax: 100, mass: 20, freightCapacity: 60, cargoTypes: ['céréales', 'sable', 'ciment'] },
        'silo': { vmax: 100, mass: 22, freightCapacity: 60, cargoTypes: ['ciment', 'céréales', 'engrais'] },
    };
    for (const [pattern, specs] of Object.entries(wagonTypes)) {
        if (combined.includes(pattern)) {
            const price = 100 * specs.freightCapacity;
            return { category: 'wagon', traction: 'none', power: 0, ...specs, price };
        }
    }
    // UIC code patterns in name
    if (/^z/i.test(nl))
        return { category: 'wagon', traction: 'none', power: 0, vmax: 100, mass: 24, freightCapacity: 65, price: 6500, cargoTypes: ['hydrocarbures'] };
    if (/^s[gn]/i.test(nl))
        return { category: 'wagon', traction: 'none', power: 0, vmax: 120, mass: 22, freightCapacity: 60, price: 6000, cargoTypes: ['conteneurs'] };
    if (/^e/i.test(nl) && lengthM < 20)
        return { category: 'wagon', traction: 'none', power: 0, vmax: 100, mass: 20, freightCapacity: 55, price: 5500, cargoTypes: ['charbon', 'minerai'] };
    if (/^h/i.test(nl))
        return { category: 'wagon', traction: 'none', power: 0, vmax: 120, mass: 30, freightCapacity: 25, price: 2500, cargoTypes: ['véhicules'] };
    if (/^f/i.test(nl))
        return { category: 'wagon', traction: 'none', power: 0, vmax: 100, mass: 20, freightCapacity: 60, price: 6000, cargoTypes: ['céréales', 'sable'] };
    if (/^t/i.test(nl) && lengthM < 20)
        return { category: 'wagon', traction: 'none', power: 0, vmax: 100, mass: 20, freightCapacity: 60, price: 6000, cargoTypes: ['céréales'] };
    // Default: if short = wagon, if long or name looks like loco = loco
    if (lengthM > 20 || /\d{3}/.test(nl) || /^(br|bb|cc|class)/i.test(nl)) {
        return { category: 'locomotive', traction: 'electrique', power: 4000, vmax: 160, mass: 84, freightCapacity: 0, price: 4000000, cargoTypes: [] };
    }
    return { category: 'wagon', traction: 'none', power: 0, vmax: 100, mass: 20, freightCapacity: 55, price: 5500, cargoTypes: [] };
}
// Confirm import
byId('import-confirm').addEventListener('click', adminMutation(async () => {
    // Persist compressed data before exposing the new rows in the catalogue.
    const imported = readCatalogStorage('admin_catalog_imported');
    // For each entry, convert blob URL to stored data
    for (const e of importedEntries) {
        // Keep the blob URL for display in this session
        imported.push({ ...e, _importBlob: undefined });
    }
    if (!await persistAdmin('admin_catalog_imported', imported))
        return;
    allItems.push(...importedEntries);
    updateStats();
    applyFilters();
    byId('modal-import').classList.remove('active');
    alert(`${importedEntries.length} engins importés avec succès !`);
}));
// ============ UTILS ============
function debounce(fn, ms) {
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(fn, ms); };
}
// Close modals on Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});
// Close modal clicking overlay
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m)
        m.classList.remove('active'); });
});
// ============ INCIDENTS MANAGEMENT ============
let incidents = [];
let editingIncident = null;
byId('btn-incidents').addEventListener('click', () => {
    renderIncidentsList();
    byId('modal-incidents').classList.add('active');
});
byId('incidents-close').addEventListener('click', () => byId('modal-incidents').classList.remove('active'));
function renderIncidentsList() {
    const list = byId('incidents-list');
    if (incidents.length === 0) {
        list.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px">Aucun incident créé. Clique sur "+ Nouvel incident" pour commencer.</p>';
        return;
    }
    let html = '<table style="width:100%"><thead><tr><th>Nom</th><th>Effet</th><th>Sévérité</th><th>Durée</th><th>Prob.</th><th>Horaires</th><th>Actions</th></tr></thead><tbody>';
    for (const inc of incidents) {
        const effectLabels = { speed_reduction: 'Vitesse -50%', line_blocked: 'Ligne bloquée', extra_cost: 'Surcoût +30%', delay: 'Retard +15min', revenue_bonus: 'Bonus +20%' };
        const sevColors = { low: 'var(--green)', medium: 'var(--orange)', high: 'var(--red)' };
        html += `<tr>
      <td><b>${escapeHtml(inc.name)}</b><br><span style="font-size:.75em;color:var(--text2)">${escapeHtml(inc.description || '')}</span></td>
      <td>${escapeHtml(effectLabels[inc.effect] || inc.effect)}</td>
      <td><span style="color:${htmlText(sevColors[inc.severity] || 'var(--text)')}">${escapeHtml(inc.severity)}</span></td>
      <td>${inc.duration} min</td>
      <td>${inc.probability}%/h</td>
      <td>${inc.hourStart}h - ${inc.hourEnd}h</td>
      <td>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:.75em" data-edit-incident="${escapeHtml(inc.id)}">Modifier</button>
        <button class="btn btn-red" style="padding:3px 8px;font-size:.75em" data-delete-incident="${escapeHtml(inc.id)}">Supprimer</button>
      </td>
    </tr>`;
    }
    html += '</tbody></table>';
    list.innerHTML = html;
}
byId('incident-add').addEventListener('click', () => {
    editingIncident = null;
    byId('incident-edit-title').textContent = 'Nouvel incident';
    byId('inc-name').value = String('');
    byId('inc-desc').value = String('');
    byId('inc-effect').value = String('speed_reduction');
    byId('inc-severity').value = String('medium');
    byId('inc-duration').value = String(60);
    byId('inc-probability').value = String(5);
    byId('inc-hour-start').value = String(6);
    byId('inc-hour-end').value = String(22);
    byId('modal-incident-edit').classList.add('active');
});
window._editIncident = function (id) {
    editingIncident = incidents.find(i => i.id === id);
    if (!editingIncident)
        return;
    byId('incident-edit-title').textContent = 'Modifier : ' + editingIncident.name;
    byId('inc-name').value = String(editingIncident.name);
    byId('inc-desc').value = String(editingIncident.description || '');
    byId('inc-effect').value = String(editingIncident.effect);
    byId('inc-severity').value = String(editingIncident.severity);
    byId('inc-duration').value = String(editingIncident.duration);
    byId('inc-probability').value = String(editingIncident.probability);
    byId('inc-hour-start').value = String(editingIncident.hourStart);
    byId('inc-hour-end').value = String(editingIncident.hourEnd);
    byId('modal-incident-edit').classList.add('active');
};
window._deleteIncident = function (id) {
    void adminMutation(async () => {
        if (!confirm('Supprimer cet incident ?'))
            return;
        const next = incidents.filter(i => i.id !== id);
        if (!await persistAdmin('admin_incidents', next))
            return;
        incidents = next;
        renderIncidentsList();
    })();
};
byId('incident-edit-cancel').addEventListener('click', () => byId('modal-incident-edit').classList.remove('active'));
byId('incident-edit-save').addEventListener('click', adminMutation(async () => {
    const name = byId('inc-name').value.trim();
    if (!name)
        return alert('Le nom est obligatoire');
    const data = {
        id: editingIncident?.id ?? 'inc-' + Date.now(),
        name,
        description: byId('inc-desc').value.trim(),
        effect: byId('inc-effect').value,
        severity: byId('inc-severity').value,
        duration: +byId('inc-duration').value,
        probability: +byId('inc-probability').value,
        hourStart: +byId('inc-hour-start').value,
        hourEnd: +byId('inc-hour-end').value,
    };
    const next = editingIncident ? incidents.map(item => item.id === editingIncident.id ? data : item) : [...incidents, data];
    if (!await persistAdmin('admin_incidents', next))
        return;
    incidents = next;
    byId('modal-incident-edit').classList.remove('active');
    renderIncidentsList();
}));
// ============ PUBLISH FOR ALL PLAYERS ============
const REPO_OWNER = 'pespotteur-byte';
const REPO_NAME = 'RAIL-EMPIRE-APP';
const BRANCH = 'devin/1780231310-catalog-bb7200';
const OVERRIDE_PATH = 'data/admin-overrides.json';
byId('btn-publish').addEventListener('click', () => {
    const savedToken = localStorage.getItem('admin_gh_token') || '';
    byId('gh-token').value = String(savedToken);
    byId('publish-status').style.display = 'none';
    byId('modal-publish').classList.add('active');
});
byId('publish-cancel').addEventListener('click', () => byId('modal-publish').classList.remove('active'));
byId('publish-confirm').addEventListener('click', async () => {
    const token = byId('gh-token').value.trim();
    if (!token)
        return alert('Token GitHub requis');
    localStorage.setItem('admin_gh_token', token);
    const statusEl = byId('publish-status');
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(59,130,246,.15)';
    statusEl.style.color = 'var(--blue)';
    statusEl.textContent = 'Préparation des données...';
    // Build override data
    const mods = readCatalogStorage('admin_catalog_mods');
    const deletedIds = readStringStorage('admin_catalog_deleted');
    const imported = readCatalogStorage('admin_catalog_imported');
    const overrideData = {
        version: Date.now(),
        publishedAt: new Date().toISOString(),
        modifications: mods,
        deletions: deletedIds,
        imports: imported.map(i => ({ ...i, imageData: undefined, _importBlob: undefined })),
        incidents: incidents,
    };
    const content = JSON.stringify(overrideData, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(content)));
    try {
        statusEl.textContent = 'Vérification du fichier existant...';
        // Check if file already exists to get its SHA
        let sha = null;
        try {
            const check = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${OVERRIDE_PATH}?ref=${BRANCH}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (check.ok) {
                const data = await check.json();
                sha = typeof data.sha === 'string' ? data.sha : null;
            }
        }
        catch (e) { }
        statusEl.textContent = 'Publication en cours...';
        const body = {
            message: `[Admin] Mise à jour catalogue + incidents (${new Date().toLocaleString('fr-FR')})`,
            content: contentBase64,
            branch: BRANCH,
        };
        if (sha)
            body.sha = sha;
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${OVERRIDE_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erreur GitHub API');
        }
        statusEl.style.background = 'rgba(34,197,94,.15)';
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = '✓ Publié avec succès ! Les joueurs verront les changements au prochain chargement.';
    }
    catch (e) {
        statusEl.style.background = 'rgba(239,68,68,.15)';
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = `Erreur : ${errorMessage(e)}`;
    }
});
// Events are TypeScript-owned; names/IDs cannot become JavaScript attributes.
byId('tbody').addEventListener('dblclick', event => {
    const row = event.target instanceof Element ? event.target.closest('tr[data-id]') : null;
    if (row?.dataset.id)
        window._editItem(row.dataset.id);
});
byId('incidents-list').addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button?.dataset.editIncident)
        window._editIncident(button.dataset.editIncident);
    if (button?.dataset.deleteIncident)
        window._deleteIncident(button.dataset.deleteIncident);
});
document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement)
        event.target.style.display = 'none';
}, true);
// ============ INIT ============
const adminBusyNotice = document.createElement('p');
adminBusyNotice.id = 'admin-storage-status';
adminBusyNotice.textContent = 'Chargement des données administrateur…';
adminBusyNotice.setAttribute('role', 'status');
document.body.prepend(adminBusyNotice);
document.addEventListener('click', event => {
    if (adminReady && !adminWriting)
        return;
    if (event.target instanceof Element && event.target.closest('button,input,select')) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}, true);
async function initializeAdmin() {
    try {
        for (const key of AUXILIARY_KEYS)
            adminSnapshots.set(key, await adminStorage.load(key));
        incidents = readIncidents();
        loadCatalogs();
        adminReady = true;
        adminBusyNotice.textContent = adminStorage.lastWarning || 'Stockage administrateur compact prêt.';
    }
    catch (error) {
        adminBusyNotice.textContent = 'Données non chargées : ' + errorMessage(error) + '. Aucune donnée effacée ; fermez les autres onglets et rechargez.';
    }
}
void initializeAdmin();
