import { htmlText } from './html-text.js';
// @ts-expect-error Runtime cache-busted browser specifier; canonical map module is TypeScript.
import { TileMap } from './map.js?v=1148';
import { evaluateRailWeather } from './weather-thresholds.js';
const LAYERS = [
    ['radar', 'Radar pluie'], ['risk', 'Risques ferroviaires'], ['temperature', 'Température'], ['precipitation', 'Précipitations'],
    ['wind', 'Vent'], ['gust', 'Rafales'], ['snow', 'Neige'], ['visibility', 'Visibilité'], ['humidity', 'Humidité'], ['pressure', 'Pression'], ['clouds', 'Nuages']
];
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
function layerValue(p, layer) {
    switch (layer) {
        case 'temperature': return Number(p.temperature);
        case 'precipitation': return Number(p.precipitation) || 0;
        case 'wind': return Number(p.windSpeed) || 0;
        case 'gust': return Number(p.windGust) || 0;
        case 'snow': return Number(p.snowfall) || 0;
        case 'visibility': return (Number(p.visibilityM) || 10000) / 1000;
        case 'humidity': return Number(p.humidity) || 0;
        case 'pressure': return Number(p.pressure) || 1013;
        case 'clouds': return Number(p.cloudCover) || 0;
        case 'risk': return Number(p.risk?.rank) || 0;
        default: return 0;
    }
}
function colorFor(layer, value) {
    let h = 210, s = 70, l = 50, a = .38;
    if (layer === 'temperature') {
        const t = clamp((value + 20) / 65, 0, 1);
        h = 240 - 240 * t;
        s = 80;
        l = 50;
        a = .42;
    }
    else if (layer === 'precipitation') {
        const t = clamp(value / 25, 0, 1);
        h = 210 + 70 * t;
        s = 90;
        l = 55;
        a = .25 + .45 * t;
    }
    else if (layer === 'wind' || layer === 'gust') {
        const t = clamp(value / 120, 0, 1);
        h = 150 - 150 * t;
        s = 85;
        l = 50;
        a = .28 + .35 * t;
    }
    else if (layer === 'snow') {
        const t = clamp(value / 6, 0, 1);
        h = 195;
        s = 65;
        l = 80 - 30 * t;
        a = .20 + .45 * t;
    }
    else if (layer === 'visibility') {
        const t = 1 - clamp(value / 10, 0, 1);
        h = 40;
        s = 10;
        l = 75 - 35 * t;
        a = .20 + .45 * t;
    }
    else if (layer === 'humidity' || layer === 'clouds') {
        const t = clamp(value / 100, 0, 1);
        h = 210;
        s = 35;
        l = 72 - 35 * t;
        a = .18 + .42 * t;
    }
    else if (layer === 'pressure') {
        const t = clamp((value - 970) / 80, 0, 1);
        h = 220 - 220 * t;
        s = 65;
        l = 50;
        a = .34;
    }
    else if (layer === 'risk') {
        const colors = ['34,197,94', '234,179,8', '249,115,22', '239,68,68', '168,85,247'];
        return `rgba(${colors[Math.max(0, Math.min(4, Math.round(value)))]},.48)`;
    }
    return `hsla(${h},${s}%,${l}%,${a})`;
}
function fmtLayer(layer, v) {
    if (!Number.isFinite(v))
        return '—';
    if (layer === 'temperature')
        return `${v.toFixed(1)} °C`;
    if (layer === 'precipitation')
        return `${v.toFixed(1)} mm/h`;
    if (layer === 'wind' || layer === 'gust')
        return `${Math.round(v)} km/h`;
    if (layer === 'snow')
        return `${v.toFixed(1)} cm/h`;
    if (layer === 'visibility')
        return `${v.toFixed(1)} km`;
    if (layer === 'humidity' || layer === 'clouds')
        return `${Math.round(v)} %`;
    if (layer === 'pressure')
        return `${Math.round(v)} hPa`;
    if (layer === 'risk')
        return ['Normal', 'Vigilance', 'Dégradé', 'Sévère', 'Extrême'][Math.round(v)] || 'Normal';
    return String(v);
}
export class WeatherMapView {
    constructor(weather) {
        this.weather = weather;
        this.map = null;
        this.layer = 'radar';
        this.grid = [];
        this.gridLoading = false;
        this.selected = null;
        this.forecast = [];
        this._token = 0;
        this._gridTimer = null;
        this._drag = null;
        this._game = null;
    }
    render(container, game = null) {
        this._game = game || this._game;
        this._token++;
        const token = this._token;
        const d = this.weather.getDisplay();
        const risk = d.railRisk || this.weather.getRailRiskAt(this.weather._lastLat, this.weather._lastLon, 160);
        container.innerHTML = `
      <div class="weather-page-v2">
        <section class="weather-v2-hero">
          <div><div class="weather-v2-eyebrow">MÉTÉO MONDIALE • TEMPS RÉEL</div><h2>${esc(d.label)} · ${Math.round(d.temperature)}°C</h2><p>La météo est évaluée par coordonnées pour chaque train. La carte ci-dessous permet d'inspecter n'importe quel point du globe.</p></div>
          <div class="weather-v2-risk" style="--risk:${htmlText(risk.level.color)}"><span>Risque ferroviaire local</span><b>${esc(risk.level.label)}</b><small>Vent ${Math.round(d.windSpeed)} · rafales ${Math.round(d.windGust || d.windSpeed)} km/h · visibilité ${d.visibility} km</small></div>
        </section>

        <section class="weather-v2-map-card">
          <div class="weather-v2-toolbar">
            <div class="weather-v2-search-wrap"><input id="weather-map-search" type="search" placeholder="Rechercher une ville, gare ou lieu dans le monde…" autocomplete="off"><div id="weather-map-search-results" class="weather-v2-search-results hidden"></div></div>
            <div class="weather-v2-layerbar">${LAYERS.map(([id, label]) => `<button class="weather-layer-btn ${htmlText(id === this.layer ? 'active' : '')}" data-layer="${htmlText(id)}">${htmlText(label)}</button>`).join('')}</div>
          </div>
          <div class="weather-map-stage">
            <canvas id="weather-world-map"></canvas>
            <div id="weather-map-loading" class="weather-map-loading hidden">Chargement de la couche météo…</div>
            <div id="weather-map-coords" class="weather-map-coords">Clique sur la carte pour inspecter la météo</div>
            <div class="weather-map-legend" id="weather-map-legend"></div>
          </div>
          <div class="weather-v2-timeline" id="weather-forecast-timeline"><span>Prévisions : clique sur un point de la carte</span></div>
        </section>

        <div class="weather-v2-grid">
          <section class="weather-v2-panel" id="weather-point-panel">${this._pointHtml(this.selected || this.weather._globalPointState(), this.weather._lastLat, this.weather._lastLon, 'Position météo actuelle')}</section>
          <section class="weather-v2-panel">${this._thresholdHtml()}</section>
        </div>
      </div>`;
        const canvas = container.querySelector('#weather-world-map');
        if (!canvas)
            return;
        if (!this.map) {
            this.map = new TileMap();
            this.map.minZoom = 2;
            this.map.maxZoom = 15;
            this.map.zoomLevel = 4.5;
            this.map.centerLat = 48.5;
            this.map.centerLon = 8;
            this.map.railEnabled = true;
            this.map.basicMode = true;
        }
        this.map.radarEnabled = this.layer === 'radar';
        this.map.cloudEnabled = false;
        const rp = this.weather.getLatestRadarPath();
        if (typeof rp === 'string' && rp) {
            const radarUrl = this.weather.getRadarTileUrl(rp);
            if (typeof radarUrl === 'string' && radarUrl)
                this.map.setRadarTileUrl(radarUrl);
        }
        this._wire(container, canvas, token);
        this._resize(canvas);
        this._scheduleGrid(container, 0);
        this._drawLoop(container, canvas, token);
    }
    _wire(container, canvas, token) {
        const layerButtons = container.querySelectorAll('.weather-layer-btn');
        layerButtons.forEach((node) => { const btn = node; btn.addEventListener('click', () => { this.layer = btn.dataset.layer || 'radar'; layerButtons.forEach((other) => other.classList.toggle('active', other === btn)); this.map.radarEnabled = this.layer === 'radar'; this.map.markDirty(); this._scheduleGrid(container, 0); this._updateLegend(container); }); });
        let resizeTimer;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (token !== this._token)
                    return;
                this._resize(canvas);
                this._scheduleGrid(container, 100);
            }, 100);
        };
        window.addEventListener('resize', onResize, { once: false });
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); this.map.applyZoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top); this.map.markDirty(); this._scheduleGrid(container, 300); }, { passive: false });
        canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); this._drag = { x: e.clientX, y: e.clientY, moved: false }; });
        canvas.addEventListener('pointermove', (e) => {
            const r = canvas.getBoundingClientRect(), w = this.map.screenToWorld(e.clientX - r.left, e.clientY - r.top, canvas.clientWidth, canvas.clientHeight);
            const coords = container.querySelector('#weather-map-coords');
            if (coords)
                coords.textContent = `${w.lat.toFixed(3)}°, ${w.lon.toFixed(3)}°`;
            if (!this._drag)
                return;
            const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 2)
                this._drag.moved = true;
            this.map.pan(dx, dy);
            this.map.markDirty();
            this._drag.x = e.clientX;
            this._drag.y = e.clientY;
            this._scheduleGrid(container, 350);
        });
        canvas.addEventListener('pointerup', async (e) => {
            const was = this._drag;
            this._drag = null;
            if (was?.moved)
                return;
            const r = canvas.getBoundingClientRect();
            const w = this.map.screenToWorld(e.clientX - r.left, e.clientY - r.top, canvas.clientWidth, canvas.clientHeight);
            await this._inspectPoint(container, w.lat, w.lon, `Point ${w.lat.toFixed(3)}°, ${w.lon.toFixed(3)}°`);
        });
        const search = container.querySelector('#weather-map-search'), results = container.querySelector('#weather-map-search-results');
        let st;
        search?.addEventListener('input', () => {
            clearTimeout(st);
            const q = search.value.trim();
            if (q.length < 2) {
                results.classList.add('hidden');
                return;
            }
            st = setTimeout(async () => {
                try {
                    const rows = await this.weather.searchLocation(q);
                    if (token !== this._token)
                        return;
                    results.innerHTML = rows.length ? rows.map((r, i) => `<button data-i="${htmlText(i)}"><b>${esc(r.name)}</b><span>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</span></button>`).join('') : '<div class="weather-search-empty">Aucun résultat</div>';
                    results.classList.remove('hidden');
                    results.querySelectorAll('button').forEach((b) => b.onclick = async () => { const r = rows[Number(b.dataset.i)]; this.map.centerLat = r.lat; this.map.centerLon = r.lon; this.map.zoomLevel = Math.max(this.map.zoomLevel, 7); this.map.markDirty(); results.classList.add('hidden'); search.value = [r.name, r.country].filter(Boolean).join(', '); this._scheduleGrid(container, 50); await this._inspectPoint(container, r.lat, r.lon, [r.name, r.admin1, r.country].filter(Boolean).join(', ')); });
                }
                catch (e) {
                    results.innerHTML = '<div class="weather-search-empty">Recherche indisponible</div>';
                    results.classList.remove('hidden');
                }
            }, 350);
        });
        this._updateLegend(container);
    }
    _resize(canvas) { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(300, Math.round(r.width)), h = Math.max(320, Math.round(r.height)); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas._weatherDpr = dpr; this.map.viewportWidth = w; this.map.viewportHeight = h; this.map.markDirty(); }
    _drawLoop(container, canvas, token) {
        if (token !== this._token || !canvas.isConnected)
            return;
        const dpr = canvas._weatherDpr || 1, ctx = canvas.getContext('2d');
        const w = canvas.width / dpr, h = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        this.map.viewportWidth = w;
        this.map.viewportHeight = h;
        this.map.renderTiles(ctx, w, h);
        if (this.layer !== 'radar')
            this._drawGrid(ctx, w, h);
        this._drawTrains(ctx, w, h);
        requestAnimationFrame(() => this._drawLoop(container, canvas, token));
    }
    _drawGrid(ctx, w, h) {
        if (!this.grid.length)
            return;
        const cols = 7, rows = 5;
        for (const p of this.grid) {
            const pt = this.map.worldToScreen(p.lat, p.lon, w, h);
            const val = layerValue(p, this.layer);
            const radius = Math.max(38, Math.min(w, h) / 6.2);
            ctx.beginPath();
            ctx.fillStyle = colorFor(this.layer, val);
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fill();
            if (this.layer === 'wind' || this.layer === 'gust') {
                const ang = ((Number(p.windDirection) || 0) - 90) * Math.PI / 180;
                ctx.strokeStyle = 'rgba(255,255,255,.75)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(pt.x - Math.cos(ang) * 9, pt.y - Math.sin(ang) * 9);
                ctx.lineTo(pt.x + Math.cos(ang) * 9, pt.y + Math.sin(ang) * 9);
                ctx.stroke();
            }
            if (w > 700) {
                ctx.font = '10px sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,.9)';
                ctx.textAlign = 'center';
                ctx.fillText(fmtLayer(this.layer, val), pt.x, pt.y + 3);
            }
        }
    }
    _drawTrains(ctx, w, h) {
        const services = this._game?.scheduleCreator?.services || [];
        ctx.save();
        for (const s of services) {
            const t = s?.train;
            if (!t || !Number.isFinite(Number(t.lat)) || !Number.isFinite(Number(t.lon)))
                continue;
            const p = this.map.worldToScreen(Number(t.lat), Number(t.lon), w, h);
            if (p.x < 0 || p.y < 0 || p.x > w || p.y > h)
                continue;
            ctx.beginPath();
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = 'rgba(15,23,42,.9)';
            ctx.lineWidth = 2;
            ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
    _bounds(canvas) { const w = canvas.clientWidth || 800, h = canvas.clientHeight || 500; const nw = this.map.screenToWorld(0, 0, w, h), se = this.map.screenToWorld(w, h, w, h); return { minLat: Math.min(nw.lat, se.lat), maxLat: Math.max(nw.lat, se.lat), minLon: Math.min(nw.lon, se.lon), maxLon: Math.max(nw.lon, se.lon) }; }
    _scheduleGrid(container, delay = 250) { if (this._gridTimer !== null)
        clearTimeout(this._gridTimer); this._gridTimer = setTimeout(() => this._loadGrid(container), delay); }
    async _loadGrid(container) {
        const canvas = container.querySelector('#weather-world-map');
        if (!canvas || this.layer === 'radar') {
            this.grid = [];
            return;
        }
        const load = container.querySelector('#weather-map-loading');
        load?.classList.remove('hidden');
        this.gridLoading = true;
        try {
            this.grid = await this.weather.fetchGrid(this._bounds(canvas), this.layer, 7, 5);
        }
        catch (e) {
            console.warn('Weather grid:', e instanceof Error ? e.message : String(e));
            this.grid = [];
        }
        finally {
            this.gridLoading = false;
            load?.classList.add('hidden');
        }
    }
    async _inspectPoint(container, lat, lon, title) {
        const panel = container.querySelector('#weather-point-panel'), timeline = container.querySelector('#weather-forecast-timeline');
        if (panel)
            panel.innerHTML = '<div class="weather-panel-loading">Lecture météo du point…</div>';
        try {
            const [stateRaw, forecastRaw] = await Promise.all([this.weather._fetchLiveWeatherFor(lat, lon), this.weather.fetchForecastAt(lat, lon)]);
            const state = stateRaw;
            const forecast = forecastRaw;
            state.risk = evaluateRailWeather(state, 160, 1);
            this.selected = state;
            this.forecast = forecast;
            if (panel)
                panel.innerHTML = this._pointHtml(state, lat, lon, title);
            if (timeline)
                timeline.innerHTML = this._forecastHtml(forecast);
        }
        catch (e) {
            if (panel)
                panel.innerHTML = `<div class="weather-error">Météo indisponible : ${esc(e instanceof Error ? e.message : String(e))}</div>`;
        }
    }
    _pointHtml(s, lat, lon, title) {
        const r = s.risk || this.weather.getRailRiskAt(lat, lon, 160);
        return `<div class="weather-panel-title"><div><span>POINT INSPECTÉ</span><h3>${esc(title)}</h3></div><b style="color:${htmlText(r.level.color)}">${esc(r.level.label)}</b></div><div class="weather-data-grid">
    <div><span>Condition</span><b>${esc(s.label || '—')}</b></div><div><span>Température</span><b>${htmlText(Number(s.temperature).toFixed(1))} °C</b></div><div><span>Ressenti</span><b>${htmlText(Number(s.apparentTemp ?? s.temperature).toFixed(1))} °C</b></div><div><span>Humidité</span><b>${htmlText(Math.round(Number(s.humidity) || 0))} %</b></div>
    <div><span>Vent</span><b>${htmlText(Math.round(Number(s.windSpeed) || 0))} km/h</b></div><div><span>Rafales</span><b>${htmlText(Math.round(Number(s.windGust) || 0))} km/h</b></div><div><span>Précipitations</span><b>${htmlText((Number(s.precipitation) || 0).toFixed(1))} mm/h</b></div><div><span>Cumul pluie 6 h</span><b>${htmlText((Number(s.rain6hMm) || 0).toFixed(1))} mm</b></div><div><span>Cumul pluie 24 h</span><b>${htmlText((Number(s.rain24hMm) || 0).toFixed(1))} mm</b></div><div><span>Neige</span><b>${htmlText((Number(s.snowfall) || 0).toFixed(1))} cm/h</b></div><div><span>Neige au sol</span><b>${htmlText((Number(s.snowDepthCm) || 0).toFixed(1))} cm</b></div>
    <div><span>Visibilité</span><b>${htmlText(Number(s.visibility ?? ((s.visibilityM || 0) / 1000)).toFixed(1))} km</b></div><div><span>Pression</span><b>${htmlText(Math.round(Number(s.pressure) || 1013))} hPa</b></div><div><span>Nuages</span><b>${htmlText(Math.round(Number(s.cloudCover) || 0))} %</b></div><div><span>Coordonnées</span><b>${htmlText(Number(lat).toFixed(3))}°, ${htmlText(Number(lon).toFixed(3))}°</b></div>
  </div><div class="weather-impact-box"><b>Impact ferroviaire actuel</b><span>${htmlText(r.reasons?.length ? (r.reasons.join(' · ')) : 'Aucun seuil dégradé franchi')}</span><small>${htmlText(Number.isFinite(r.speedCap) ? `Vitesse plafonnée jusqu'à ${Math.round(r.speedCap)} km/h selon matériel/vitesse` : 'Pas de limitation automatique')} · coefficient freinage ${r.brakeFactor.toFixed(2)}</small></div>`;
    }
    _forecastHtml(rows) {
        if (!rows?.length)
            return '<span>Prévisions indisponibles</span>';
        const now = Date.now();
        const future = rows.filter((r) => new Date(r.time).getTime() >= now - 3600000);
        const picks = [0, 1, 3, 6, 12, 24].map((h) => future[Math.min(future.length - 1, h)]).filter(Boolean);
        return picks.map((r, i) => { const h = [0, 1, 3, 6, 12, 24][i]; return `<div class="weather-time-chip"><span>${h === 0 ? 'Maintenant' : `+${h}h`}</span><b>${htmlText(Math.round(Number(r.temperature_2m) || 0))}°</b><small>${htmlText((Number(r.precipitation) || 0).toFixed(1))} mm · ${htmlText(Math.round(Number(r.wind_gusts_10m) || 0))} km/h</small></div>`; }).join('');
    }
    _thresholdHtml() { const cats = this.weather.getThresholdCatalog(); return `<div class="weather-panel-title"><div><span>MOTEUR FERROVIAIRE</span><h3>Seuils d'impact</h3></div></div><p class="weather-panel-copy">Ces seuils sont utilisés par la page et par les trains : l'interface n'affiche plus une règle différente de la physique.</p><div class="weather-threshold-list">${Object.values(cats).map((c) => `<div><b>${esc(c.label)}</b><span>${htmlText(c.bands.map((v, i) => `${['Vigilance', 'Dégradé', 'Sévère', 'Extrême'][i]} ${c.direction === 'low' ? '≤' : '≥'} ${v} ${c.unit}`).join(' · '))}</span></div>`).join('')}</div>`; }
    _updateLegend(container) {
        const el = container.querySelector('#weather-map-legend');
        if (!el)
            return;
        if (this.layer === 'radar') {
            el.innerHTML = '<b>Radar</b><span>Précipitations RainViewer en temps réel</span>';
            return;
        }
        el.innerHTML = `<b>${esc(LAYERS.find((x) => x[0] === this.layer)?.[1] || this.layer)}</b><span>Couche Open-Meteo · grille mondiale mise en cache 10 min</span>`;
    }
}
