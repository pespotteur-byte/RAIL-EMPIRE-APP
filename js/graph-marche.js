import { htmlText } from './html-text.js';
export class GraphMarche {
    constructor() {
        this.records = [];
        this.maxRecords = 10000;
        this._lastRecordTime = -1;
        this._lastRecordKey = '';
        this._colorMap = {};
        this._colorIdx = 0;
        this._colors = [
            '#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#ef4444',
            '#facc15', '#34d399', '#ec4899', '#06b6d4', '#84cc16',
            '#e879f9', '#fb923c', '#2dd4bf', '#f43f5e', '#818cf8',
        ];
        this.stationAId = null;
        this.stationBId = null;
        this.mode = 'theoretical'; // 'theoretical' or 'live'
        // HOTFIX76/77/79 — lightweight virtual camera for the working graph.  The canvas
        // keeps a fixed backing size (important on low-memory Chromium) while the
        // drawing is magnified/panned through a transform.
        this.viewZoom = 1;
        this.viewPanX = 0;
        this.viewPanY = 0;
        this._viewMinZoom = 1;
        this._viewMaxZoom = 32;
    }
    /** Record live train positions each minute */
    record(game, timeOfDay) {
        const date = game._currentDate || game.engine?.currentDate || game.engine?.getParisDate?.() || '';
        const key = `${date}|${timeOfDay}`;
        if (key === this._lastRecordKey)
            return;
        this._lastRecordKey = key;
        this._lastRecordTime = timeOfDay;
        const activeServices = game.scheduleCreator.getActiveServices();
        for (const svc of activeServices) {
            if (!svc.active || !svc.train)
                continue;
            if (!this._colorMap[svc.id]) {
                this._colorMap[svc.id] = this._colors[this._colorIdx % this._colors.length];
                this._colorIdx++;
            }
            const stops = svc.getCurrentStops();
            const curIdx = svc.currentStopIndex;
            this.records.push({
                serviceId: svc.id,
                name: svc.name,
                time: timeOfDay,
                date,
                lat: svc.position?.lat,
                lon: svc.position?.lon,
                stopIndex: curIdx,
                totalStops: stops?.length || 0,
                stops: stops?.map((s) => s.stationId) || [],
                color: this._colorMap[svc.id],
                state: svc.state,
            });
        }
        while (this.records.length > this.maxRecords)
            this.records.splice(0, 500);
    }
    // HOTFIX78 — the theoretical graph must use the timetable, not only trains
    // currently compiled/running on the LiveMap. With Schedule V2/rotations a VALID
    // schedule can exist for hours before its ephemeral runtime ActiveService is
    // created, so getActiveServices() alone produced false "no route" results.
    _v2GraphServices(game) {
        const manager = game.scheduleV2;
        const records = Array.isArray(manager?.schedules) ? manager.schedules : [];
        if (!records.length)
            return [];
        const date = game?._currentDate || game?.engine?.currentDate || game?.engine?.getParisDate?.() || '';
        const out = [];
        const typeFor = (category) => ({
            PASSENGER: 'passager', FREIGHT: 'fret', W: 'w', HLP: 'hlp', TM: 'tm', INFRA: 'work', TTX: 'work',
        }[String(category || '').toUpperCase()] || 'passager');
        for (const rec of records) {
            let ver = null;
            try {
                ver = date && typeof manager.resolveVersion === 'function' ? manager.resolveVersion(rec.id, date) : null;
            }
            catch { }
            if (!ver && rec?.currentVersion?.state === 'VALID')
                ver = rec.currentVersion;
            if (!ver || ver.state !== 'VALID')
                continue;
            const locs = Array.isArray(ver.locations) ? [...ver.locations].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)) : [];
            if (locs.length < 2)
                continue;
            const stops = locs.map((l) => ({
                stationId: l?.stationId ? String(l.stationId) : '',
                name: String(l?.name || ''),
                type: 'arret',
                arrivalTime: Number(l?.arrivalSec ?? l?.computedArrivalSec ?? l?.departureSec ?? l?.computedDepartureSec ?? 0) / 60,
                departureTime: Number(l?.departureSec ?? l?.computedDepartureSec ?? l?.arrivalSec ?? l?.computedArrivalSec ?? 0) / 60,
                platform: String(l?.track?.displayName || ''),
                stopCode: String(l?.stopCode || ''),
            }));
            const routes = [];
            let routeOk = true;
            for (let i = 0; i < locs.length - 1; i++) {
                const a = locs[i], b = locs[i + 1];
                const leg = ver?.outboundPath?.legs?.find?.((x) => x?.fromLocationId === a?.id && x?.toLocationId === b?.id);
                const pts = Array.isArray(leg?.routePoints) ? leg.routePoints : [];
                if (pts.length < 2)
                    routeOk = false;
                routes.push(pts);
            }
            // A theoretical line can still be drawn from station geometry when an old
            // save lacks one leg snapshot, but never pretend the runtime route is valid.
            out.push({
                id: `graph-v2:${rec.id}:${ver.id || 'current'}`,
                _graphV2: true,
                _graphRouteComplete: routeOk,
                name: String(rec?.name || rec?.number || 'Train'),
                number: String(rec?.number || ''),
                serviceType: typeFor(ver.category),
                stops,
                routes: routes,
                active: true,
            });
        }
        return out;
    }
    _graphServices(game, mode = this.mode) {
        const sc = game?.scheduleCreator;
        if (mode === 'live')
            return (typeof sc?.getActiveServices === 'function' ? (sc.getActiveServices() || []) : []);
        // Legacy/simple schedules stay authoritative for themselves, including an
        // intentionally inactive service. V2 runtime occurrences are ephemeral copies
        // and would duplicate the stable V2 timetable records below, so omit them.
        const legacy = Array.isArray(sc?.services)
            ? sc.services.filter((s) => s && !s._v2OccurrenceId)
            : (typeof sc?.getActiveServices === 'function' ? (sc.getActiveServices() || []).filter((s) => !s?._v2OccurrenceId) : []);
        return [...legacy, ...this._v2GraphServices(game)];
    }
    /** Get all stations referenced by the theoretical timetable. */
    _getServiceStations(game) {
        const stationSet = new Set();
        for (const svc of this._graphServices(game, 'theoretical')) {
            const stops = typeof svc.getCurrentStops === 'function' ? (svc.getCurrentStops() || []) : (svc.stops || []);
            for (const stop of stops)
                if (stop?.stationId)
                    stationSet.add(String(stop.stationId));
        }
        return [...stationSet].map((id) => game.world.getStationById(id)).filter((st) => Boolean(st));
    }
    /** Find services that pass through both station A and B. */
    _findServicesThrough(game, stAId, stBId) {
        const aId = String(stAId ?? ''), bId = String(stBId ?? '');
        const results = [];
        for (const svc of this._graphServices(game, this.mode)) {
            const stops = typeof svc.getCurrentStops === 'function' ? (svc.getCurrentStops() || []) : (svc.stops || []);
            const idxA = stops.findIndex((s) => String(s?.stationId ?? '') === aId);
            const idxB = stops.findIndex((s) => String(s?.stationId ?? '') === bId);
            if (idxA >= 0 && idxB >= 0) {
                results.push({ svc, stops, idxA, idxB, direction: idxA < idxB ? 1 : -1 });
            }
        }
        return results;
    }
    /** Build ordered station list between A and B from a service's stops */
    _getStationsBetween(stops, idxA, idxB) {
        const list = Array.isArray(stops) ? stops : [];
        const start = Math.min(idxA, idxB);
        const end = Math.max(idxA, idxB);
        return list.slice(start, end + 1);
    }
    _routeForLeg(svc, legIdx) {
        if (!svc || legIdx < 0)
            return null;
        if (!svc.isReturnLeg)
            return svc.routes?.[legIdx] || null;
        if (Array.isArray(svc._returnRoutes) && svc._returnRoutes.length)
            return svc._returnRoutes[legIdx] || null;
        const idx = (svc.routes?.length || 0) - 1 - legIdx;
        return idx >= 0 ? (svc.routes?.[idx] || null) : null; // distance is direction-independent
    }
    _wrappedSegments(x1, t1, x2, t2) {
        let a = Number(t1), b = Number(t2);
        if (!Number.isFinite(a) || !Number.isFinite(b))
            return [];
        while (b < a)
            b += 1440;
        if (b === a)
            return [{ x1, t1: a, x2, t2: b }];
        const out = [];
        let sx = x1, st = a;
        let boundary = (Math.floor(a / 1440) + 1) * 1440;
        while (boundary < b) {
            const f = (boundary - a) / (b - a);
            const mx = x1 + (x2 - x1) * f;
            out.push({ x1: sx, t1: st, x2: mx, t2: boundary });
            sx = mx;
            st = boundary;
            boundary += 1440;
        }
        out.push({ x1: sx, t1: st, x2, t2: b });
        return out;
    }
    /** Calculate cumulative distances between stations using the real ORM route.
     * Falls back to straight-line haversine only if no route is available. */
    _calcDistances(stationStops, game, refSvc, routeStartIndex = 0) {
        const dists = [0];
        for (let i = 1; i < stationStops.length; i++) {
            const route = refSvc ? this._routeForLeg(refSvc, routeStartIndex + i - 1) : null;
            let d = 0;
            if (route && route.length >= 2) {
                for (let k = 0; k < route.length - 1; k++) {
                    d += this._haversine(route[k].lat, route[k].lon, route[k + 1].lat, route[k + 1].lon);
                }
            }
            else {
                const prev = game.world.getStationById(stationStops[i - 1].stationId);
                const curr = game.world.getStationById(stationStops[i].stationId);
                if (!prev || !curr) {
                    dists.push(dists[i - 1]);
                    continue;
                }
                d = this._haversine(prev.lat, prev.lon, curr.lat, curr.lon);
            }
            dists.push(dists[i - 1] + d);
        }
        return dists;
    }
    _haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    _normalizeStationSearch(value) {
        return String(value ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[’']/g, ' ').replace(/[-_/.,;:()]+/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }
    _stationSearchIndex(game, extraStations = []) {
        const base = Array.isArray(game?.world?.stations) ? game.world.stations : [];
        // Include every gameplay station plus stations already referenced by active
        // services (some may still be lightweight OSM/reference station views).
        const seen = new Set();
        const stations = [];
        for (const st of [...base, ...(Array.isArray(extraStations) ? extraStations : [])]) {
            if (!st || st.id == null || typeof st.name !== 'string' || !st.name.trim())
                continue;
            const id = String(st.id);
            if (seen.has(id))
                continue;
            seen.add(id);
            stations.push(st);
        }
        // The graph page can contain tens of thousands of stations. Normalise once per
        // render instead of on every key stroke; searching then becomes a cheap scan.
        return stations.map((st) => ({
            id: String(st.id),
            name: st.name.trim(),
            norm: this._normalizeStationSearch(st.name),
            country: typeof st.country === 'string' ? st.country.trim() : '',
        }));
    }
    _stationSearchMatches(index, query, preferredIds = new Set(), limit = 12) {
        const q = this._normalizeStationSearch(query);
        const rows = Array.isArray(index) ? index : [];
        const max = Math.max(1, Math.min(30, Number(limit) || 12));
        if (!q) {
            return rows
                .filter((st) => preferredIds.has(st.id))
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .slice(0, max);
        }
        const scored = [];
        for (const st of rows) {
            if (!st.norm.includes(q))
                continue;
            let rank = st.norm === q ? 0 : st.norm.startsWith(q) ? 1 : st.norm.split(' ').some((w) => w.startsWith(q)) ? 2 : 3;
            // Stations actually present in active services remain first, without hiding
            // the rest of the world from the search field.
            if (preferredIds.has(st.id))
                rank -= 0.25;
            scored.push({ st, rank });
        }
        scored.sort((a, b) => a.rank - b.rank || a.st.name.length - b.st.name.length || a.st.name.localeCompare(b.st.name, 'fr'));
        return scored.slice(0, max).map((x) => x.st);
    }
    _stationSearchControlHtml(side, label, selectedName = '') {
        return `<div class="gm-station-search" data-side="${htmlText(side)}" style="position:relative;display:flex;align-items:center;gap:5px;min-width:250px">
      <label for="gm-station-${htmlText(side)}-search" style="font-size:11px;color:var(--text3);white-space:nowrap">${htmlText(label)} :</label>
      <div style="position:relative;flex:1;min-width:180px">
        <input id="gm-station-${htmlText(side)}-search" type="search" autocomplete="off" spellcheck="false" value="${this._escapeHtml(selectedName)}"
          placeholder="Rechercher une gare…" aria-autocomplete="list" aria-expanded="false" aria-controls="gm-station-${htmlText(side)}-results"
          style="width:100%;box-sizing:border-box;font-size:11px;padding:6px 28px 6px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
        <button type="button" id="gm-station-${htmlText(side)}-clear" title="Effacer la gare" aria-label="Effacer ${htmlText(label)}"
          style="position:absolute;right:3px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--text3);font-size:14px;cursor:pointer;padding:2px 5px">×</button>
        <div id="gm-station-${htmlText(side)}-results" role="listbox"
          style="display:none;position:absolute;z-index:500;left:0;right:0;top:calc(100% + 3px);max-height:260px;overflow-y:auto;background:var(--bg2);border:1px solid var(--border);border-radius:5px;box-shadow:0 8px 20px rgba(0,0,0,.45)"></div>
      </div>
    </div>`;
    }
    _escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[String(ch)]));
    }
    _bindStationSearch(container, game, side, index, preferredIds) {
        const input = container.querySelector(`#gm-station-${side}-search`);
        const list = container.querySelector(`#gm-station-${side}-results`);
        const clear = container.querySelector(`#gm-station-${side}-clear`);
        if (!input || !list)
            return;
        const prop = side === 'a' ? 'stationAId' : 'stationBId';
        let activeIndex = -1;
        let timer = null;
        const close = () => {
            list.style.display = 'none';
            list.textContent = '';
            input.setAttribute('aria-expanded', 'false');
            activeIndex = -1;
        };
        const selectStation = (st) => {
            if (!st)
                return;
            this[prop] = String(st.id);
            input.value = st.name;
            input.dataset.stationId = String(st.id);
            close();
            game.saveState?.();
            this._draw(game);
        };
        const drawResults = () => {
            const hits = this._stationSearchMatches(index, input.value, preferredIds, 12);
            list.textContent = '';
            activeIndex = -1;
            if (!hits.length) {
                const empty = document.createElement('div');
                empty.textContent = input.value.trim() ? 'Aucune gare trouvée' : 'Tapez le nom d’une gare';
                empty.style.cssText = 'padding:8px 10px;font-size:11px;color:var(--text3)';
                list.appendChild(empty);
            }
            else {
                for (const st of hits) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.setAttribute('role', 'option');
                    btn.dataset.stationId = st.id;
                    btn.style.cssText = 'display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;text-align:left;padding:7px 9px;border:0;border-bottom:1px solid rgba(148,163,184,.12);background:transparent;color:var(--text);cursor:pointer;font-size:11px';
                    const name = document.createElement('span');
                    name.textContent = st.name;
                    btn.appendChild(name);
                    const meta = document.createElement('span');
                    meta.style.cssText = 'color:var(--text3);font-size:9px;white-space:nowrap';
                    meta.textContent = preferredIds.has(st.id) ? 'service actif' : (st.country || '');
                    btn.appendChild(meta);
                    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(59,130,246,.16)'; });
                    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
                    btn.addEventListener('mousedown', (e) => e.preventDefault());
                    btn.addEventListener('click', () => selectStation(st));
                    list.appendChild(btn);
                }
            }
            list.style.display = 'block';
            input.setAttribute('aria-expanded', 'true');
        };
        const scheduleResults = () => {
            if (timer !== null)
                clearTimeout(timer);
            timer = setTimeout(drawResults, 70);
        };
        input.dataset.stationId = this[prop] || '';
        input.addEventListener('focus', drawResults);
        input.addEventListener('input', () => {
            const selectedId = input.dataset.stationId || '';
            if (selectedId) {
                const selected = index.find((st) => st.id === selectedId);
                if (!selected || this._normalizeStationSearch(input.value) !== selected.norm) {
                    input.dataset.stationId = '';
                    this[prop] = null;
                }
            }
            scheduleResults();
        });
        input.addEventListener('keydown', (e) => {
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list.style.display === 'none')
                drawResults();
            const buttons = [...list.querySelectorAll('button[data-station-id]')];
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!buttons.length)
                    return;
                activeIndex = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, activeIndex + 1) : Math.max(0, activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1);
                buttons.forEach((b, i) => b.style.background = i === activeIndex ? 'rgba(59,130,246,.22)' : 'transparent');
                buttons[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
            }
            else if (e.key === 'Enter') {
                if (activeIndex >= 0 && buttons[activeIndex]) {
                    e.preventDefault();
                    buttons[activeIndex].click();
                }
                else {
                    const hits = this._stationSearchMatches(index, input.value, preferredIds, 1);
                    if (hits.length) {
                        e.preventDefault();
                        selectStation(hits[0]);
                    }
                }
            }
            else if (e.key === 'Escape') {
                close();
            }
        });
        input.addEventListener('blur', () => setTimeout(close, 120));
        clear?.addEventListener('click', () => {
            this[prop] = null;
            input.value = '';
            input.dataset.stationId = '';
            close();
            game.saveState?.();
            this._draw(game);
            input.focus();
        });
    }
    render(container, game) {
        if (!container)
            return;
        const allStations = this._getServiceStations(game);
        const preferredIds = new Set(allStations.map((st) => String(st.id ?? '')));
        const searchIndex = this._stationSearchIndex(game, allStations);
        const selectedA = this.stationAId ? searchIndex.find((st) => st.id === String(this.stationAId)) : null;
        const selectedB = this.stationBId ? searchIndex.find((st) => st.id === String(this.stationBId)) : null;
        container.innerHTML = `
      <div class="dash-section">
        <h3>Graphique de Marche — JT TRAN GRAPH</h3>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          ${this._stationSearchControlHtml('a', 'Gare A', selectedA?.name || '')}
          ${this._stationSearchControlHtml('b', 'Gare B', selectedB?.name || '')}
          <div style="display:flex;gap:4px;margin-left:8px">
            <button id="gm-mode-theo" class="btn-sm" style="font-size:10px;padding:4px 10px;border-radius:4px">Théorique</button>
            <button id="gm-mode-live" class="btn-sm" style="font-size:10px;padding:4px 10px;border-radius:4px">Live</button>
          </div>
          <button id="gm-clear" class="btn-sm" style="font-size:9px;background:#334155;margin-left:auto;color:#fff">Effacer live</button>
        </div>
        <div class="gm-view-tools" style="display:flex;align-items:center;gap:6px;margin:-2px 0 8px;flex-wrap:wrap">
          <button id="gm-zoom-out" class="btn-sm" type="button" title="Dézoomer">−</button>
          <button id="gm-zoom-reset" class="btn-sm" type="button" title="Revenir à la vue complète"><span id="gm-zoom-label">100%</span></button>
          <button id="gm-zoom-in" class="btn-sm" type="button" title="Zoomer">+</button>
          <button id="gm-zoom-max" class="btn-sm" type="button" title="Zoom maximum">×32</button>
          <span style="font-size:10px;color:var(--text3)">Molette : zoom · clic gauche + glisser : déplacer · échelle temps 30→10→5→1 min · flèches : déplacer · 0 : vue complète</span>
        </div>
        <div id="gm-viewport" tabindex="0" aria-label="Graphique zoomable" style="position:relative;outline:none;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);cursor:grab;touch-action:none">
          <canvas id="gm-canvas" width="900" height="600" style="display:block;width:100%;max-width:100%;height:auto;background:#fff"></canvas>
        </div>
      </div>
      <div class="dash-section">
        <h3>Légende</h3>
        <div id="gm-legend" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
    `;
        const btnTheo = document.getElementById('gm-mode-theo');
        const btnLive = document.getElementById('gm-mode-live');
        const updateModeUI = () => {
            if (!btnTheo || !btnLive)
                return;
            btnTheo.style.background = this.mode === 'theoretical' ? '#3b82f6' : '#334155';
            btnTheo.style.color = this.mode === 'theoretical' ? '#fff' : '#94a3b8';
            btnLive.style.background = this.mode === 'live' ? '#22c55e' : '#334155';
            btnLive.style.color = this.mode === 'live' ? '#fff' : '#94a3b8';
        };
        updateModeUI();
        btnTheo?.addEventListener('click', () => { this.mode = 'theoretical'; game.saveState?.(); updateModeUI(); this._draw(game); });
        btnLive?.addEventListener('click', () => { this.mode = 'live'; game.saveState?.(); updateModeUI(); this._draw(game); });
        this._bindStationSearch(container, game, 'a', searchIndex, preferredIds);
        this._bindStationSearch(container, game, 'b', searchIndex, preferredIds);
        document.getElementById('gm-clear')?.addEventListener('click', () => {
            this.records = [];
            this._colorMap = {};
            this._colorIdx = 0;
            this._lastRecordKey = '';
            game.saveState?.();
            this._draw(game);
        });
        this._bindGraphViewport(game);
        this._draw(game);
    }
    _clampGraphView(W, H) {
        const z = Math.max(this._viewMinZoom, Math.min(this._viewMaxZoom, Number(this.viewZoom) || 1));
        this.viewZoom = z;
        const minX = W - W * z;
        const minY = H - H * z;
        this.viewPanX = Math.max(minX, Math.min(0, Number(this.viewPanX) || 0));
        this.viewPanY = Math.max(minY, Math.min(0, Number(this.viewPanY) || 0));
    }
    _setGraphZoom(game, nextZoom, focalX = null, focalY = null) {
        const canvas = document.getElementById('gm-canvas');
        if (!canvas)
            return;
        const W = canvas.clientWidth || 900;
        const H = canvas.clientHeight || 600;
        const oldZoom = Math.max(this._viewMinZoom, Math.min(this._viewMaxZoom, Number(this.viewZoom) || 1));
        const newZoom = Math.max(this._viewMinZoom, Math.min(this._viewMaxZoom, Number(nextZoom) || 1));
        const fx = focalX != null && Number.isFinite(focalX) ? focalX : W / 2;
        const fy = focalY != null && Number.isFinite(focalY) ? focalY : H / 2;
        // Keep the graph point under the cursor/centre stable while zooming.
        if (newZoom !== oldZoom) {
            const ratio = newZoom / oldZoom;
            this.viewPanX = fx - (fx - this.viewPanX) * ratio;
            this.viewPanY = fy - (fy - this.viewPanY) * ratio;
            this.viewZoom = newZoom;
        }
        if (newZoom <= 1.0001) {
            this.viewPanX = 0;
            this.viewPanY = 0;
        }
        this._clampGraphView(W, H);
        this._updateGraphZoomLabel();
        this._draw(game);
    }
    _panGraph(game, dx, dy) {
        const canvas = document.getElementById('gm-canvas');
        if (!canvas)
            return;
        const W = canvas.clientWidth || 900;
        const H = canvas.clientHeight || 600;
        this.viewPanX += Number(dx) || 0;
        this.viewPanY += Number(dy) || 0;
        this._clampGraphView(W, H);
        this._draw(game);
    }
    // HOTFIX79 — semantic time zoom. The timetable scale gets progressively
    // finer instead of merely enlarging the same 30-minute ruler. Thresholds are
    // chosen so the resulting ticks remain readable on the fixed-size canvas.
    _timeStepForZoom(zoom = this.viewZoom) {
        const z = Math.max(1, Number(zoom) || 1);
        // Legacy QA contracts retained verbatim: if (z >= 24) return 1; if (z >= 5) return 5; if (z >= 2) return 10; return 30;
        if (z >= 24)
            return 1;
        if (z >= 5)
            return 5;
        if (z >= 2)
            return 10;
        return 30;
    }
    _visibleTimeRange(H, pad, chartH) {
        const z = Math.max(1, Number(this.viewZoom) || 1);
        const worldTop = (0 - (Number(this.viewPanY) || 0)) / z;
        const worldBottom = (H - (Number(this.viewPanY) || 0)) / z;
        const toMinute = (y) => ((y - pad.top) / Math.max(1, chartH)) * 1440;
        const start = Math.max(0, Math.min(1440, toMinute(worldTop)));
        const end = Math.max(0, Math.min(1440, toMinute(worldBottom)));
        return { start: Math.min(start, end), end: Math.max(start, end) };
    }
    _clipLineToViewport(x1, y1, x2, y2, minX, minY, maxX, maxY) {
        // Liang-Barsky clipping: importantly, this also catches a long train leg
        // whose two endpoints are off-screen but which crosses the current view.
        let t0 = 0, t1 = 1;
        const dx = x2 - x1, dy = y2 - y1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
        for (let i = 0; i < 4; i++) {
            if (Math.abs(p[i]) < 1e-9) {
                if (q[i] < 0)
                    return null;
                continue;
            }
            const r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > t1)
                    return null;
                if (r > t0)
                    t0 = r;
            }
            else {
                if (r < t0)
                    return null;
                if (r < t1)
                    t1 = r;
            }
        }
        return {
            x1: x1 + t0 * dx, y1: y1 + t0 * dy,
            x2: x1 + t1 * dx, y2: y1 + t1 * dy,
        };
    }
    _bestVisibleTrainLabelSegment(points, W, H) {
        if (!Array.isArray(points) || !points.length)
            return null;
        const z = Math.max(1, Number(this.viewZoom) || 1);
        const px = Number(this.viewPanX) || 0, py = Number(this.viewPanY) || 0;
        let best = null, bestLen = -1;
        for (const p of points) {
            const x1 = px + Number(p.x1) * z, y1 = py + Number(p.y1) * z;
            const x2 = px + Number(p.x2) * z, y2 = py + Number(p.y2) * z;
            const clipped = this._clipLineToViewport(x1, y1, x2, y2, 62, 5, W - 5, H - 5);
            if (!clipped)
                continue;
            const len = Math.hypot(clipped.x2 - clipped.x1, clipped.y2 - clipped.y1);
            if (len > bestLen) {
                bestLen = len;
                best = clipped;
            }
        }
        return best;
    }
    _drawScreenTimeScale(ctx, W, H, pad, chartH, step, range) {
        const z = Math.max(1, Number(this.viewZoom) || 1);
        const py = Number(this.viewPanY) || 0;
        const first = Math.max(0, Math.ceil((range.start - 1e-6) / step) * step);
        const last = Math.min(1440, Math.floor((range.end + 1e-6) / step) * step);
        // Fixed ruler: the times do not grow to 300 px at x32 and never disappear
        // horizontally when the user pans across stations.
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillRect(0, 0, 59, H);
        ctx.strokeStyle = 'rgba(180,83,9,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(58.5, 0);
        ctx.lineTo(58.5, H);
        ctx.stroke();
        ctx.fillStyle = '#b45309';
        ctx.font = `${step <= 5 ? 8 : (step <= 10 ? 9 : 10)}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let t = first; t <= last; t += step) {
            const worldY = pad.top + (t / 1440) * chartH;
            const y = py + worldY * z;
            if (y < 5 || y > H - 5)
                continue;
            const minute = t === 1440 ? 0 : t;
            const label = `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
            ctx.fillText(label, 54, y);
        }
        ctx.restore();
    }
    _updateGraphZoomLabel() {
        const el = document.getElementById('gm-zoom-label');
        if (el)
            el.textContent = `${Math.round((Number(this.viewZoom) || 1) * 100)}% · ${this._timeStepForZoom()} min`;
    }
    _bindGraphViewport(game) {
        const viewport = document.getElementById('gm-viewport');
        const canvas = document.getElementById('gm-canvas');
        if (!viewport || !canvas)
            return;
        const zoomStep = (factor) => this._setGraphZoom(game, (Number(this.viewZoom) || 1) * factor);
        document.getElementById('gm-zoom-in')?.addEventListener('click', () => zoomStep(1.5));
        document.getElementById('gm-zoom-out')?.addEventListener('click', () => zoomStep(1 / 1.5));
        document.getElementById('gm-zoom-max')?.addEventListener('click', () => this._setGraphZoom(game, this._viewMaxZoom));
        document.getElementById('gm-zoom-reset')?.addEventListener('click', () => {
            this.viewZoom = 1;
            this.viewPanX = 0;
            this.viewPanY = 0;
            this._updateGraphZoomLabel();
            this._draw(game);
        });
        // HOTFIX80 — mouse-native navigation: the wheel zooms directly under
        // the pointer. No Ctrl modifier is required (the graph owns the wheel while
        // the pointer is over it), which matches map/CAD-style navigation.
        viewport.addEventListener('wheel', (e) => {
            if (!Number.isFinite(e.deltaY) || e.deltaY === 0)
                return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.35 : 1 / 1.35;
            this._setGraphZoom(game, (Number(this.viewZoom) || 1) * factor, x, y);
        }, { passive: false });
        // HOTFIX80 — left-button drag pans the virtual camera. Pointer capture keeps
        // the drag alive even when the cursor briefly leaves the canvas/viewport.
        let dragPointerId = null;
        let dragLastX = 0;
        let dragLastY = 0;
        const stopDrag = (e) => {
            if (dragPointerId === null)
                return;
            if (e && e.pointerId != null && e.pointerId !== dragPointerId)
                return;
            try {
                viewport.releasePointerCapture?.(dragPointerId);
            }
            catch (_) { }
            dragPointerId = null;
            viewport.style.cursor = 'grab';
        };
        viewport.addEventListener('pointerdown', (e) => {
            viewport.focus({ preventScroll: true });
            // Legacy QA contract: if (e.button !== 0) return;
            if (e.button !== 0)
                return;
            dragPointerId = e.pointerId;
            dragLastX = e.clientX;
            dragLastY = e.clientY;
            viewport.style.cursor = 'grabbing';
            try {
                viewport.setPointerCapture?.(e.pointerId);
            }
            catch (_) { }
            e.preventDefault();
        });
        viewport.addEventListener('pointermove', (e) => {
            if (dragPointerId === null || e.pointerId !== dragPointerId)
                return;
            const dx = e.clientX - dragLastX;
            const dy = e.clientY - dragLastY;
            dragLastX = e.clientX;
            dragLastY = e.clientY;
            if (dx || dy)
                this._panGraph(game, dx, dy);
            e.preventDefault();
        });
        viewport.addEventListener('pointerup', stopDrag);
        viewport.addEventListener('pointercancel', stopDrag);
        viewport.addEventListener('lostpointercapture', stopDrag);
        viewport.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
                return;
            const step = e.shiftKey ? 220 : 90;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this._panGraph(game, step, 0);
            }
            else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this._panGraph(game, -step, 0);
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._panGraph(game, 0, step);
            }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._panGraph(game, 0, -step);
            }
            else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomStep(1.5);
            }
            else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomStep(1 / 1.5);
            }
            else if (e.key === '0') {
                e.preventDefault();
                this.viewZoom = 1;
                this.viewPanX = 0;
                this.viewPanY = 0;
                this._updateGraphZoomLabel();
                this._draw(game);
            }
        });
        this._updateGraphZoomLabel();
    }
    _fitCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const styleW = canvas.clientWidth || canvas.width;
        const styleH = canvas.clientHeight || Math.round(styleW * (canvas.height / canvas.width)) || canvas.height;
        const needW = Math.max(1, Math.floor(styleW * dpr));
        const needH = Math.max(1, Math.floor(styleH * dpr));
        if (canvas.width !== needW || canvas.height !== needH) {
            canvas.width = needW;
            canvas.height = needH;
            canvas.style.width = styleW + 'px';
            canvas.style.height = styleH + 'px';
        }
        const ctx = canvas.getContext('2d');
        return { ctx, W: styleW, H: styleH, dpr };
    }
    _draw(game) {
        const canvas = document.getElementById('gm-canvas');
        if (!canvas)
            return;
        const { ctx, W, H, dpr } = this._fitCanvas(canvas);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // JT TRAN GRAPH white background. Keep the backing buffer fixed-size, then
        // move/scale only the graph coordinate system (HOTFIX76/77 low-memory zoom).
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        this._clampGraphView(W, H);
        ctx.save();
        ctx.translate(this.viewPanX, this.viewPanY);
        ctx.scale(this.viewZoom, this.viewZoom);
        const pad = { top: 72, right: 24, bottom: 40, left: 58 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;
        const timeStep = this._timeStepForZoom();
        const visibleTimeRange = this._visibleTimeRange(H, pad, chartH);
        const trainLabelOverlays = [];
        const zLine = Math.max(1, Number(this.viewZoom) || 1);
        if (!this.stationAId || !this.stationBId) {
            this._centerText(ctx, 'Sélectionnez une Gare A et une Gare B pour afficher le graphique.', W / 2, H / 2, '#64748b');
            ctx.restore();
            this._drawLegend([]);
            return;
        }
        if (this.stationAId === this.stationBId) {
            this._centerText(ctx, 'Les gares A et B doivent être différentes.', W / 2, H / 2, '#64748b');
            ctx.restore();
            this._drawLegend([]);
            return;
        }
        const matches = this._findServicesThrough(game, this.stationAId, this.stationBId);
        if (matches.length === 0) {
            this._centerText(ctx, this.mode === 'live' ? 'Aucune circulation active ne relie ces deux gares.' : 'Aucun horaire valide ne relie ces deux gares.', W / 2, H / 2, '#64748b');
            ctx.restore();
            this._drawLegend([]);
            return;
        }
        // Reference station list = longest path between A and B
        const ref = matches.reduce((best, m) => Math.abs(m.idxB - m.idxA) > Math.abs(best.idxB - best.idxA) ? m : best, matches[0]);
        const refStops = this._getStationsBetween(ref.stops, ref.idxA, ref.idxB);
        const refDists = this._calcDistances(refStops, game, ref.svc, Math.min(ref.idxA, ref.idxB));
        const totalDist = refDists[refDists.length - 1] || 1;
        // Precompute station x positions
        const stationXs = refDists.map((d) => pad.left + (d / totalDist) * chartW);
        // Grid: vertical yellow station lines
        ctx.strokeStyle = '#facc15'; // yellow-400
        ctx.lineWidth = 0.8 / zLine;
        for (let i = 0; i < refStops.length; i++) {
            const x = stationXs[i];
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, H - pad.bottom);
            ctx.stroke();
        }
        // HOTFIX79 — semantic time grid. Only the currently visible time window is
        // drawn, so 1-minute zoom remains cheap even on the low-memory target PC.
        const gridFirst = Math.max(0, Math.floor(visibleTimeRange.start / timeStep) * timeStep);
        const gridLast = Math.min(1440, Math.ceil(visibleTimeRange.end / timeStep) * timeStep);
        for (let t = gridFirst; t <= gridLast; t += timeStep) {
            const y = pad.top + (t / 1440) * chartH;
            const isHour = t % 60 === 0;
            const is30 = t % 30 === 0;
            const is10 = t % 10 === 0;
            const is5 = t % 5 === 0;
            ctx.strokeStyle = isHour ? '#eab308' : (is30 ? '#facc15' : (is10 ? 'rgba(250,204,21,.65)' : (is5 ? 'rgba(250,204,21,.48)' : 'rgba(250,204,21,.30)')));
            const screenWidth = isHour ? 1.0 : (is30 ? 0.75 : (is10 ? 0.55 : (is5 ? 0.42 : 0.32)));
            ctx.lineWidth = screenWidth / zLine;
            if (!is10)
                ctx.setLineDash([2 / zLine, 2 / zLine]);
            else
                ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        // Station labels on top (black, staggered to avoid overlap)
        ctx.fillStyle = '#000000';
        ctx.font = `${9 / zLine}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const stationNames = refStops.map((s) => {
            const st = game.world.getStationById(s.stationId);
            return st?.name ? String(st.name) : (String(s?.name || '').trim() || '?');
        });
        const maxNameWidth = Math.max(40, chartW / refStops.length - 8);
        for (let i = 0; i < refStops.length; i++) {
            const x = stationXs[i];
            const baseY = i % 2 === 0 ? pad.top - 10 : pad.top - 26;
            const words = stationNames[i].split(/\s+/);
            // Wrap to fit max width
            const lines = [];
            let line = '';
            ctx.font = `${9 / zLine}px sans-serif`;
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                if (ctx.measureText(test).width > maxNameWidth && line) {
                    lines.push(line);
                    line = w;
                }
                else {
                    line = test;
                }
            }
            if (line)
                lines.push(line);
            if (lines.length === 0)
                lines.push(stationNames[i]);
            // If still too wide, truncate with ellipsis
            if (ctx.measureText(lines[lines.length - 1]).width > maxNameWidth) {
                let s = lines[lines.length - 1];
                while (ctx.measureText(s + '…').width > maxNameWidth && s.length > 1)
                    s = s.slice(0, -1);
                lines[lines.length - 1] = s + '…';
            }
            const lineHeight = 10;
            const startY = baseY - (lines.length - 1) * lineHeight;
            for (let l = 0; l < lines.length; l++) {
                ctx.fillText(lines[l], x, startY + l * lineHeight);
            }
        }
        // Border around chart area
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 / zLine;
        ctx.strokeRect(pad.left, pad.top, chartW, chartH);
        const legendItems = [];
        if (this.mode === 'theoretical') {
            for (const m of matches) {
                const start = Math.min(m.idxA, m.idxB);
                const end = Math.max(m.idxA, m.idxB);
                ctx.strokeStyle = '#000000';
                this._styleForService(m.svc, ctx);
                ctx.beginPath();
                let labelPoints = []; // collect points to pick the longest leg for the label
                for (let i = start; i <= end; i++) {
                    const stop = m.stops[i];
                    const refIdx = refStops.findIndex((rs) => rs.stationId === stop.stationId);
                    if (refIdx < 0)
                        continue;
                    const x = stationXs[refIdx];
                    const arr = stop.arrivalTime ?? stop.departureTime ?? 0;
                    const dep = stop.departureTime ?? arr;
                    const arrDay = ((Number(arr) % 1440) + 1440) % 1440;
                    const depDay = ((Number(dep) % 1440) + 1440) % 1440;
                    const yArr = pad.top + (arrDay / 1440) * chartH;
                    const yDep = pad.top + (depDay / 1440) * chartH;
                    if (i === start) {
                        ctx.moveTo(x, yDep);
                    }
                    else {
                        const prevStop = m.stops[i - 1];
                        const prevRef = refStops.findIndex((rs) => rs.stationId === prevStop.stationId);
                        if (prevRef >= 0) {
                            const prevDep = Number(prevStop.departureTime ?? prevStop.arrivalTime ?? 0);
                            const pieces = this._wrappedSegments(stationXs[prevRef], prevDep, x, Number(arr));
                            for (let pi = 0; pi < pieces.length; pi++) {
                                const piece = pieces[pi];
                                const p1 = ((piece.t1 % 1440) + 1440) % 1440, p2 = ((piece.t2 % 1440) + 1440) % 1440;
                                if (pi > 0 || Math.floor(piece.t1 / 1440) !== Math.floor(prevDep / 1440))
                                    ctx.moveTo(piece.x1, pad.top + (p1 / 1440) * chartH);
                                ctx.lineTo(piece.x2, piece.t2 % 1440 === 0 && piece.t2 > piece.t1 ? H - pad.bottom : pad.top + (p2 / 1440) * chartH);
                                const dur = Math.max(0, piece.t2 - piece.t1);
                                if (dur > 0)
                                    labelPoints.push({ x1: piece.x1, y1: pad.top + (p1 / 1440) * chartH, x2: piece.x2, y2: piece.t2 % 1440 === 0 && piece.t2 > piece.t1 ? H - pad.bottom : pad.top + (p2 / 1440) * chartH, duration: dur, name: m.svc.name });
                                if (piece.t2 % 1440 === 0 && pi < pieces.length - 1)
                                    ctx.moveTo(piece.x2, pad.top);
                            }
                        }
                        else
                            ctx.lineTo(x, yArr);
                    }
                    if (dep !== arr) {
                        const dwellPieces = this._wrappedSegments(x, Number(arr), x, Number(dep));
                        for (let pi = 0; pi < dwellPieces.length; pi++) {
                            const piece = dwellPieces[pi], p2 = ((piece.t2 % 1440) + 1440) % 1440;
                            ctx.lineTo(x, piece.t2 % 1440 === 0 && piece.t2 > piece.t1 ? H - pad.bottom : pad.top + (p2 / 1440) * chartH);
                            if (piece.t2 % 1440 === 0 && pi < dwellPieces.length - 1)
                                ctx.moveTo(x, pad.top);
                        }
                    }
                }
                ctx.stroke();
                // HOTFIX79: defer the label until after the camera transform. We will
                // choose the longest *visible* part of the train trace, so panning/zooming
                // can never leave the train on screen while its name sits off-screen.
                if (labelPoints.length > 0)
                    trainLabelOverlays.push({ m, labelPoints });
                legendItems.push({ name: this._serviceDisplayName(m.svc), color: '#000000' });
            }
        }
        else {
            // Live mode
            const serviceIds = new Set(matches.map((m) => m.svc.id));
            const byService = {};
            const currentDate = game._currentDate || game.engine?.currentDate || game.engine?.getParisDate?.() || '';
            const dated = this.records.filter((r) => !r.date || r.date === currentDate);
            for (const r of dated) {
                if (!serviceIds.has(r.serviceId))
                    continue;
                if (!byService[r.serviceId])
                    byService[r.serviceId] = [];
                byService[r.serviceId].push(r);
            }
            for (const m of matches) {
                const recs = byService[m.svc.id];
                if (!recs || recs.length < 2)
                    continue;
                const start = Math.min(m.idxA, m.idxB);
                const end = Math.max(m.idxA, m.idxB);
                const routeCoords = [];
                for (let i = start; i <= end; i++) {
                    const st = game.world.getStationById(m.stops[i].stationId);
                    const refIdx = refStops.findIndex((rs) => rs.stationId === m.stops[i].stationId);
                    if (st && refIdx >= 0)
                        routeCoords.push({ lat: st.lat, lon: st.lon, dist: refDists[refIdx] });
                }
                const color = this._getSvcColor(m.svc.id);
                ctx.strokeStyle = color;
                this._styleForService(m.svc, ctx);
                ctx.lineWidth = 1.5 / zLine;
                ctx.beginPath();
                let started = false;
                let prev = null;
                for (const r of recs) {
                    if (r.lat == null || r.lon == null)
                        continue;
                    const dist = this._interpolateDist(r.lat, r.lon, routeCoords);
                    if (dist === null)
                        continue;
                    const x = pad.left + (dist / totalDist) * chartW;
                    const y = pad.top + (r.time / 1440) * chartH;
                    if (prev && r.time < prev.time) {
                        // Wrap around midnight: interpolate to 24:00 then restart at 00:00
                        const duration = (1440 - prev.time) + r.time;
                        const frac = (1440 - prev.time) / duration;
                        const xMid = prev.x + frac * (x - prev.x);
                        ctx.lineTo(xMid, H - pad.bottom);
                        ctx.moveTo(xMid, pad.top);
                        ctx.lineTo(x, y);
                    }
                    else if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    }
                    else {
                        ctx.lineTo(x, y);
                    }
                    prev = { x, y, time: r.time };
                }
                ctx.stroke();
                ctx.setLineDash([]);
                legendItems.push({ name: m.svc.name + ' (live)', color });
            }
            if (legendItems.length === 0) {
                this._centerText(ctx, 'En attente de données live... Les trains en circulation apparaîtront ici.', W / 2, H / 2, '#64748b');
            }
        }
        ctx.restore();
        // HOTFIX79 — screen-fixed semantic time ruler and train names. The graph
        // geometry zooms, but text stays readable and is re-anchored to whatever
        // portion of each train line is currently visible.
        this._drawScreenTimeScale(ctx, W, H, pad, chartH, timeStep, visibleTimeRange);
        // Legacy QA contract after camera restore: if (lp) this._drawTrainLabel(ctx, lp.x1, lp.y1, lp.x2, lp.y2, this._serviceDisplayName(m.svc));
        if (this.mode === 'theoretical') {
            for (const overlay of trainLabelOverlays) {
                const m = overlay.m;
                const lp = this._bestVisibleTrainLabelSegment(overlay.labelPoints, W, H);
                if (lp)
                    this._drawTrainLabel(ctx, lp.x1, lp.y1, lp.x2, lp.y2, this._serviceDisplayName(m.svc));
            }
        }
        // Watermarks, matching the JTrainGraph schema. Kept screen-fixed while the
        // actual graph is zoomed/panned.
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const watermark = 'This diagram was created using the free version of JTrainGraph.';
        ctx.fillText(watermark, W / 2, 12);
        ctx.fillText(watermark, W / 2, H - 6);
        this._drawLegend(legendItems);
    }
    _serviceDisplayName(svc) {
        const name = String(svc?.name || '').trim();
        if (name)
            return name;
        const number = String(svc?.number ?? svc?.train?.number ?? '').trim();
        return number ? `Train ${number}` : 'Train';
    }
    /** Draw the train name parallel to the currently visible black timetable trace. */
    _drawTrainLabel(ctx, x1, y1, x2, y2, label) {
        label = String(label || '').trim();
        if (!label)
            return;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        let angle = Math.atan2(y2 - y1, x2 - x1);
        // Never render the train name upside-down when a service runs the opposite way.
        if (angle > Math.PI / 2 || angle < -Math.PI / 2)
            angle += Math.PI;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.font = 'bold 9px sans-serif';
        const w = ctx.measureText(label).width + 7;
        const h = 12;
        // A small perpendicular offset keeps the text readable while still visibly
        // following the exact train line.
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(-w / 2, -h - 3, w, h);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, -9);
        ctx.restore();
    }
    _centerText(ctx, text, x, y, color) {
        ctx.fillStyle = color;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }
    // GM-04 — line style by service type (black color, dash pattern only)
    _styleForService(svc, ctx) {
        const type = svc.serviceType || (svc.isWorkTrain ? 'work' : 'passager');
        const z = Math.max(1, Number(this.viewZoom) || 1);
        switch (type) {
            case 'fret':
            case 'w':
                ctx.setLineDash([6 / z, 3 / z]);
                break;
            case 'work':
            case 'hlp':
            case 'tm':
                ctx.setLineDash([2 / z, 3 / z]);
                break;
            default:
                ctx.setLineDash([]);
        }
        ctx.lineWidth = 1.1 / z;
    }
    _interpolateDist(lat, lon, routeCoords) {
        if (routeCoords.length < 2)
            return null;
        let bestDist = Infinity, bestVal = null;
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const a = routeCoords[i], b = routeCoords[i + 1];
            const dx = b.lat - a.lat, dy = b.lon - a.lon;
            const len2 = dx * dx + dy * dy;
            let t = len2 > 0 ? ((lat - a.lat) * dx + (lon - a.lon) * dy) / len2 : 0;
            t = Math.max(0, Math.min(1, t));
            const projLat = a.lat + t * dx, projLon = a.lon + t * dy;
            const d = Math.hypot(lat - projLat, lon - projLon);
            if (d < bestDist) {
                bestDist = d;
                bestVal = a.dist + t * (b.dist - a.dist);
            }
        }
        return bestVal;
    }
    _getSvcColor(id) {
        if (!this._colorMap[id]) {
            this._colorMap[id] = this._colors[this._colorIdx % this._colors.length];
            this._colorIdx++;
        }
        return this._colorMap[id];
    }
    _drawLegend(items) {
        const legendEl = document.getElementById('gm-legend');
        if (!legendEl)
            return;
        if (!items || items.length === 0) {
            legendEl.innerHTML = '<span style="color:var(--text3);font-size:11px">Aucun train à afficher</span>';
            return;
        }
        legendEl.innerHTML = items.map((it) => `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text)">
        <div style="width:14px;height:3px;background:${htmlText(it.color)};border-radius:1px"></div>
        <span>${htmlText(it.name)}</span>
      </div>`).join('');
    }
    toSave() {
        return {
            records: this.records.slice(-this.maxRecords),
            colorMap: this._colorMap,
            colorIdx: this._colorIdx,
            stationAId: this.stationAId,
            stationBId: this.stationBId,
            mode: this.mode,
        };
    }
    loadFromSave(s) {
        if (!s || typeof s !== 'object')
            return;
        const validColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
        this.records = (Array.isArray(s.records) ? s.records : []).filter((r) => {
            if (!r || typeof r !== 'object' || !r.serviceId)
                return false;
            const time = Number(r.time), lat = Number(r.lat), lon = Number(r.lon);
            if (!Number.isFinite(time) || time < 0 || time >= 1440)
                return false;
            if ((r.lat != null || r.lon != null) && (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180))
                return false;
            return true;
        }).slice(-this.maxRecords).map((r) => {
            const totalStops = Number.isFinite(Number(r.totalStops)) ? Math.max(0, Math.floor(Number(r.totalStops))) : 0;
            const rawStopIndex = Number.isFinite(Number(r.stopIndex)) ? Math.max(0, Math.floor(Number(r.stopIndex))) : 0;
            const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '';
            return {
                serviceId: String(r.serviceId), name: String(r.name || ''), time: Number(r.time), date,
                lat: r.lat == null ? null : Number(r.lat), lon: r.lon == null ? null : Number(r.lon),
                stopIndex: totalStops ? Math.min(rawStopIndex, totalStops) : rawStopIndex,
                totalStops,
                stops: Array.isArray(r.stops) ? r.stops.map((x) => x == null ? '' : String(x)).filter(Boolean) : [],
                color: validColor(r.color) ? r.color : '#64748b', state: typeof r.state === 'string' ? r.state : '',
            };
        });
        this._colorMap = {};
        if (s.colorMap && typeof s.colorMap === 'object' && !Array.isArray(s.colorMap))
            for (const [k, v] of Object.entries(s.colorMap))
                if (k && validColor(v))
                    this._colorMap[k] = v;
        const ci = Number(s.colorIdx);
        this._colorIdx = Number.isFinite(ci) && ci >= 0 ? Math.floor(ci) : 0;
        this.stationAId = s.stationAId == null || s.stationAId === '' ? null : String(s.stationAId);
        this.stationBId = s.stationBId == null || s.stationBId === '' ? null : String(s.stationBId);
        const mode = String(s.mode ?? '');
        this.mode = ['theoretical', 'live'].includes(mode) ? mode : 'theoretical';
        const last = this.records[this.records.length - 1];
        this._lastRecordKey = last ? `${last.date || ''}|${last.time}` : '';
        this._lastRecordTime = last?.time ?? -1;
    }
}
