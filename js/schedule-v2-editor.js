import { htmlText } from './html-text.js';
// S3 legacy QA compatibility: u.target.segmentIndex=Number(u.r.segmentIndex)
// S3 legacy QA compatibility: HIT_TOLERANCE_PX=5 | segmentIndex:end.segmentIndex??null,displayName:'VIA'
import { TileMap } from './map.js';
import { ScheduleState, TrainCategory, StopCode, LocationKind, PathDirection, PerformanceMode, TrackBinding, RouteConstraint, ScheduledLocation, PerformanceProfile, RoundTripGroup, assignResolvedLegsToPath, formatScheduleClock, parseScheduleClock, isPassengerCategory, isOptionalStopCode, validateRoundTripPair, } from './schedule-v2-model.js';
import { ScheduleV2Router } from './schedule-v2-routing.js';
import { constraintSplitOnRailway, railAnchorPosition } from './route-linear-reference.js';
import { physicalAnchorKey, legRouteInputKey, physicsRouteKey } from './schedule-route-inputs.js';
import { recalculateScheduleTiming, calculatePhysicalTravelSeconds } from './schedule-v2-timing.js';
import { validateScheduleVersion, applyValidationState } from './schedule-v2-validation.js';
import { FormationRole } from './rotation-v2-model.js';
/*
 * SAISON 3 / ALPHA15 — source-shape compatibility for historical QA.
 * Additional historical performance/click-order contracts:
 * const st=this._nearestStation(w.lat,w.lon);
 * const existing=this._nearestConstraint(w.lat,w.lon);
 * if(this.tileMap.isDirty)this.draw()
 * if(zoom<7)
 * ctx.fillRect(p.x-dot/2,p.y-dot/2,dot,dot)
 * These strings preserve old source-inspection contracts only; runtime logic
 * remains in the typed methods below.
  _bindPanelEvents(){
  this.panelContent.querySelectorAll('[data-f="number"],[data-f="name"]')
  addEventListener('input'
  // Metadata edits
  _updateHeader()
  _autosaveSoon()
  this.panelContent.querySelectorAll('[data-f]:not([data-f="number"]):not([data-f="name"])')
  _retimeCurrentPath(v)
  _routeCompatibilityErrors(report)
  _recomputeActivePath({topologyChanged:false})

  _setReturnName

  renderList(){
  Mode simple actif
  Valider l’horaire
  🚆 Affecter une rame
  sv2-primary
  Rame : ${directRame.name
  rotationsRequired
  _duplicateScheduleDialog

  i?.level!=='ERROR'&&i?.level!=='WARNING'
 */
const BLUE = '#2583ff';
const GREEN = '#1fc86a';
const YELLOW = '#ffd338';
const ORANGE = '#ff982a';
const RED = '#ff4d5b';
// SC Future perf: mirror the LiveMap reference-station label policy.
// Keep station markers available at every zoom, but defer expensive Canvas text
// until local/regional zoom. Dense mid-zoom labels are thinned in screen space.
export const SC_STATION_LABEL_MIN_ZOOM = 10.5;
export const SC_STATION_LABEL_ALL_ZOOM = 13.5;
function esc(s) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, (c) => entities[String(c)] || String(c));
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function kmText(v) { return `${Number(v || 0).toFixed(v >= 100 ? 0 : 1)} km`; }
function stateLabel(s) { return s === ScheduleState.VALID ? 'VALIDE' : s === ScheduleState.NEEDS_REPAIR ? 'À RÉPARER' : 'BROUILLON'; }
function stateClass(s) { return s === ScheduleState.VALID ? 'ok' : s === ScheduleState.NEEDS_REPAIR ? 'repair' : 'draft'; }
function catLabel(c) { const labels = { PASSENGER: 'Voyageurs', FREIGHT: 'Fret', W: 'W — vide voyageurs', HLP: 'HLP — locomotive seule', TM: 'TM — train de machines', INFRA: 'Infra', TTX: 'TTX — train de travaux' }; return labels[String(c)] || c; }
function stopCodeLabel(c) { return c === StopCode.OPTIONAL_C ? '[C]' : c === StopCode.OPTIONAL_S ? '[S]' : c === StopCode.NONE ? '' : c; }
function routeColor(direction) { return direction === PathDirection.RETURN ? GREEN : BLUE; }
function directRoleLabel(r) { const labels = { LEAD: 'Tête', ACTIVE_MULTIPLE: 'UM active', PUSHER: 'Pousse', VEHICLE: 'CV / en véhicule', COACH: 'Voiture', WAGON: 'Wagon' }; return labels[String(r)] || r; }
function directRoleForVehicle(v) {
    const cat = String(v?.category || '').toLowerCase(), traction = String(v?.traction || '').toLowerCase();
    if (Number(v?.powerW || 0) > 0 || (traction && !['none', 'aucun', 'aucune', 'non'].includes(traction)))
        return FormationRole.LEAD;
    return cat.includes('wagon') ? FormationRole.WAGON : FormationRole.COACH;
}
function parseElectricSystems(text) { return String(text || '').split(/[;,]+/).map((x) => x.trim()).filter(Boolean).map((x) => { const [v, f = '0'] = x.split('@').map((y) => y.trim()); return { voltage: Number(v) || 0, frequency: Number(f) || 0 }; }).filter((x) => x.voltage > 0); }
function formatElectricSystems(items) { const list = Array.isArray(items) ? items : []; return list.map((x) => `${Number(x.voltage) || 0}@${Number(x.frequency) || 0}`).join(';'); }
function parseGauges(text) { return String(text || '').split(/[;,\s]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0); }
function routeGapKm(a, b) {
    if (!a || !b)
        return Infinity;
    const R = 6371, dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(Number(a.lat) * Math.PI / 180) * Math.cos(Number(b.lat) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// v1.1.47 — infer physical junctions directly from the exact OSM node IDs
// carried by the resident railway ways. This catches a real 3+ branch junction
// even if the mapper omitted railway=switch or the switch-node query is offline.
export function inferRailJunctions(ways) {
    const nodes = new Map();
    const list = Array.isArray(ways) ? ways : [];
    for (const way of list) {
        const g = way?.geometry || [], ids = way?.nodeIds || [];
        if (g.length < 2 || ids.length !== g.length)
            continue;
        for (let i = 0; i < g.length; i++) {
            const id = String(ids[i] ?? '');
            if (!id)
                continue;
            const lat = Number(g[i]?.lat), lon = Number(g[i]?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon))
                continue;
            let e = nodes.get(id);
            if (!e) {
                e = { id, lat, lon, degree: 0 };
                nodes.set(id, e);
            }
            if (i > 0)
                e.degree++;
            if (i < g.length - 1)
                e.degree++;
        }
    }
    return [...nodes.values()].filter((n) => n.degree >= 3);
}
export function applyLineMaxSpeedToVersion(version, rawValue) {
    if (!version)
        return null;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    const vmax = Math.max(1, Math.min(400, Math.round(parsed)));
    const current = version.performanceProfile;
    if (!current || current.mode !== PerformanceMode.LINE_MAX_SPEED) {
        version.performanceProfile = PerformanceProfile.genericForCategory(version.category, vmax);
    }
    else {
        current.maxSpeed = vmax;
        current.name = `${version.category} V${vmax}`;
        current.category = version.category;
    }
    // Force the next timing pass to consume the new cap even on a geometry-identical
    // route. The normal signature already includes maxSpeed, this explicit reset also
    // protects legacy/partially-migrated cached legs.
    for (const leg of version.outboundPath?.legs || []) {
        leg.physicalTravelSec = null;
        leg.physicalTravelSignature = '';
    }
    version.lastRecalculatedAt = '';
    return vmax;
}
export class ScheduleV2Editor {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.router = new ScheduleV2Router(game.orm);
        this.tileMap = new TileMap();
        this.tileMap.satelliteEnabled = true;
        this.tileMap.railEnabled = true;
        this.tileMap.zoomLevel = 9;
        this.tileMap.centerLat = 48.8;
        this.tileMap.centerLon = 2.5;
        this.record = null;
        this.version = null;
        this.returnRecord = null;
        this.returnVersion = null;
        this.roundTripGroup = null;
        this.mode = PathDirection.OUTBOUND;
        this.previewRoute = [];
        this.returnPreviewRoute = [];
        this.busy = false;
        this._routeGeneration = 0;
        this._routeAbortController = null;
        this._createdNewRecordId = '';
        this.dragging = false;
        this.panning = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragX = 0;
        this.dragY = 0;
        this.panThresholdPx = 8;
        this.history = [];
        this.future = [];
        this.selectedConstraintId = null;
        this.insertConstraint = null;
        this.trackCandidates = [];
        this.trackCandidateResolve = null;
        this.pendingStation = null;
        this._replaceLocationId = null;
        this._forcedConstraintLegIndex = null;
        this._viaNext = false;
        // v1.1.44 — continuous manual ORM guidance. This is not a synthetic route:
        // every click becomes a real-rail VIA constraint on one schedule leg.
        this._manualTraceMode = false;
        this._manualTraceLegIndex = null;
        this._onScheduleKeyDown = (e) => { if (e?.key === 'Escape' && this.busy) {
            e.preventDefault?.();
            this.cancelRouteCalculation();
        } };
        if (typeof document !== 'undefined')
            document.addEventListener('keydown', this._onScheduleKeyDown);
        this._raf = 0;
        this._lastRenderAt = 0;
        this._autosaveTimer = 0;
        this._pendingRotationScheduleIds = new Set();
        // v1.1.33 — Schedule Creator owns a separate TileMap. Native OSM stations
        // therefore have to be streamed from THIS viewport too; streaming only from
        // the Livemap leaves a fresh Schedule Creator with zero clickable stations.
        this._stationStreamTimer = 0;
        this._stationStreamPromise = null;
        this._stationStreamKey = '';
        this._stationStreamLastAttempt = 0;
        // v1.1.47 — show exact OSM railway geometry + switch nodes resident/visible to the routing editor
        // over the decorative OpenRailwayMap raster. This makes switches visible even
        // when the ORM raster rendering lags behind OSM data.
        this._engineOsmVisible = true;
        this._engineOsmStreamTimer = 0;
        this._engineOsmStreamPromise = null;
        this._engineOsmStreamKey = '';
        this._engineOsmRenderCache = { key: '', ways: [], switches: [] };
        this._ensureOverlay();
    }
    _ensureOverlay() {
        if (document.getElementById('schedule-v2-overlay'))
            return;
        const style = document.createElement('style');
        style.id = 'schedule-v2-style';
        style.textContent = `
      #schedule-v2-overlay{position:fixed;inset:0;z-index:9000;background:#07101d;color:#e8f0fb;display:none;font:12px system-ui,sans-serif}
      #schedule-v2-overlay.open{display:flex;flex-direction:column}
      .sv2-top{height:48px;display:flex;align-items:center;gap:9px;padding:0 10px;background:#0d1726;border-bottom:1px solid #25354b;flex:0 0 auto;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.sv2-top>*{flex:0 0 auto}
      .sv2-top strong{font-size:15px}.sv2-state{padding:3px 8px;border-radius:10px;font-weight:800;font-size:10px}.sv2-state.ok{background:#12482b;color:#8ef0ad}.sv2-state.draft{background:#4b3a0d;color:#ffe38b}.sv2-state.repair{background:#58212a;color:#ff9ca7}
      .sv2-top button,.sv2-btn{border:1px solid #344961;background:#16253a;color:#edf5ff;border-radius:6px;padding:7px 10px;cursor:pointer}.sv2-top button:hover,.sv2-btn:hover{background:#213650}.sv2-primary{background:#1267c9!important;border-color:#2d83e4!important}.sv2-danger{background:#471f27!important;border-color:#8d3e49!important}
      .sv2-body{position:relative;flex:1;min-height:0}.sv2-map{position:absolute;inset:0;width:100%;height:100%;display:block;background:#08111e}.sv2-panel{position:absolute;right:10px;top:10px;bottom:10px;width:325px;background:rgba(8,16,28,.96);border:1px solid #2b405b;border-radius:10px;box-shadow:0 12px 45px #0008;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(7px)}
      .sv2-panel.collapsed{width:46px;height:46px;bottom:auto}.sv2-panel.collapsed .sv2-panel-content{display:none}.sv2-panel-head{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #24374e}.sv2-panel-head b{flex:1}.sv2-panel-content{padding:8px;overflow:auto;flex:1}.sv2-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sv2-field{display:flex;flex-direction:column;gap:3px;margin-bottom:7px}.sv2-field label{font-size:10px;color:#9db0c8;text-transform:uppercase;letter-spacing:.04em}.sv2-field input,.sv2-field select,.sv2-field textarea{width:100%;box-sizing:border-box;background:#111d2d;border:1px solid #31455f;border-radius:5px;color:#eff6ff;padding:6px 7px;font:12px system-ui}.sv2-field input:focus,.sv2-field select:focus{outline:1px solid #388de7}
      .sv2-hint{padding:7px 9px;border:1px solid #27445f;background:#10243a;border-radius:6px;color:#c8e3ff;margin-bottom:8px}.sv2-hint.busy{border-color:#b57b21;color:#ffe2a4}.sv2-section{margin-top:11px;padding-top:9px;border-top:1px solid #22354a}.sv2-section h4{margin:0 0 7px;font-size:11px;color:#b9cbe0;text-transform:uppercase}
      .sv2-stop{border:1px solid #263a51;background:#0e1a29;border-radius:6px;padding:5px 6px;margin:4px 0}.sv2-stop-head{display:flex;align-items:center;gap:4px;min-height:25px}.sv2-stop-head b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sv2-badge{font-size:9px;border-radius:4px;padding:2px 5px;background:#283a51;color:#d9e8fa;max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sv2-mini{padding:3px 5px!important;min-width:25px}.sv2-stop-line{display:grid;grid-template-columns:1fr 1fr 82px auto;gap:4px;align-items:center;margin-top:3px}.sv2-stop-line input,.sv2-stop-line select{min-width:0;background:#0a1522;border:1px solid #2b4058;border-radius:4px;color:#eaf3ff;padding:3px 4px;font-size:10px}.sv2-stop-line label{font-size:10px;color:#aebfd2;white-space:nowrap}.sv2-leg-edit{display:flex;align-items:center;gap:4px;margin:2px 5px;padding:4px 5px;border-left:2px solid #315d8d;background:#0b1623;border-radius:4px;font-size:9px;color:#9fb6ce}.sv2-leg-edit .sv2-leg-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sv2-via-chip{padding:2px 5px!important;font-size:9px!important;border-color:#5d7da1!important}.sv2-via-chip.active{background:#dfeeff!important;color:#0b1726!important}.sv2-summary{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px}.sv2-metric{background:#101d2d;border:1px solid #29405a;border-radius:5px;padding:5px}.sv2-metric span{display:block;color:#8fa8c1;font-size:9px;text-transform:uppercase}.sv2-metric b{font-size:12px}.sv2-tabs{display:flex;gap:4px;margin:5px 0 7px}.sv2-tab{flex:1;padding:5px!important;font-weight:800}.sv2-tab.active.out{border-color:#2583ff;background:#153a65}.sv2-tab.active.ret{border-color:#1fc86a;background:#164d32}.sv2-fold{border-top:1px solid #22354a;padding-top:5px;margin-top:5px}.sv2-fold summary{cursor:pointer;color:#a9bdd4;font-weight:700;padding:4px 0}.sv2-arbox{border:1px solid #2a4660;background:#0d2133;border-radius:6px;padding:6px;margin:5px 0}
      .sv2-bottom{height:43px;background:#0c1624;border-top:1px solid #24364d;display:flex;align-items:center;gap:6px;padding:0 10px;flex:0 0 auto}.sv2-bottom .spacer{flex:1}.sv2-statusline{color:#9fb3cb;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36vw}
      .sv2-picker{position:absolute;z-index:5;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,90vw);max-height:70vh;background:#0b1726;border:1px solid #395571;border-radius:10px;box-shadow:0 20px 60px #000b;display:none;overflow:hidden}.sv2-picker.open{display:flex;flex-direction:column}.sv2-picker h3{margin:0;padding:11px 12px;border-bottom:1px solid #2a4057;font-size:13px}.sv2-picker-list{overflow:auto;padding:7px}.sv2-candidate{padding:8px;border:1px solid #273e56;border-radius:7px;margin:5px 0;background:#0f1d2d;cursor:pointer}.sv2-candidate:hover,.sv2-candidate.hover{border-color:#55a9ff;background:#16304b}.sv2-candidate small{display:block;color:#93aac4;margin-top:3px}.sv2-picker-foot{display:flex;gap:6px;padding:9px;border-top:1px solid #283e56}.sv2-picker-foot input{flex:1;background:#101d2d;border:1px solid #38516d;color:#fff;border-radius:5px;padding:7px}
      .sv2-alerts{position:absolute;left:12px;top:12px;width:min(340px,36vw);pointer-events:none}.sv2-alert{margin-bottom:5px;padding:6px 8px;border-radius:6px;background:#101b29dd;border-left:4px solid #5b708a;box-shadow:0 4px 18px #0007}.sv2-alert.red{border-color:${RED}}.sv2-alert.orange{border-color:${ORANGE}}.sv2-alert.yellow{border-color:${YELLOW}}
      .sv2-route-mode{font-weight:800}.sv2-route-mode.out{color:${BLUE}}.sv2-route-mode.ret{color:${GREEN}}
      .sv2-list-row{display:grid;grid-template-columns:90px minmax(160px,1.4fr) minmax(170px,2fr) 100px 190px;gap:8px;align-items:center;padding:9px;border:1px solid var(--border);border-radius:7px;margin:6px 0;background:var(--bg2)}
      .sv2-list-actions{display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap}.sv2-list-actions button{font-size:10px;padding:4px 7px}.sv2-empty{text-align:center;color:var(--text3);padding:40px}
      @media(max-width:850px){.sv2-panel{width:310px}.sv2-list-row{grid-template-columns:1fr}.sv2-alerts{display:none}}
    `;
        document.head.appendChild(style);
        const overlay = document.createElement('div');
        overlay.id = 'schedule-v2-overlay';
        overlay.innerHTML = `
      <div class="sv2-top">
        <button data-act="close">← Horaires</button>
        <strong>Schedule Creator V2 <span style="color:#7dd3fc">SC FUTURE A4.3</span></strong>
        <span class="sv2-route-mode out" id="sv2-route-mode">ALLER</span>
        <span class="sv2-state draft" id="sv2-state">BROUILLON</span>
        <span id="sv2-title" style="color:#a9bed6"></span>
        <span style="flex:1"></span>
        <button class="page-help-btn" data-page-help="schedules" type="button">❓ Aide / Tutoriel</button>
        <button data-act="undo">↶ Annuler</button><button data-act="redo">↷ Rétablir</button>
        <button data-act="export-diagnostic" title="Exporter le journal diagnostic du Schedule Creator">⬇ Diagnostic SC</button><div class="sv2-station-search-box" style="display:flex;align-items:center;gap:4px"><span style="color:#edf5ff;font-weight:600">🔍 Gare</span><input id="sv2-station-search" placeholder="Nom de gare..." style="width:180px;padding:6px;border-radius:6px;border:1px solid #344961;background:#16253a;color:#edf5ff"><button data-act="search-station" title="Centrer sur une gare">↗</button><span style="color:#edf5ff;font-weight:600">📍</span><input id="sv2-place-search" placeholder="Chercher un lieu..." style="width:180px;padding:6px;border-radius:6px;border:1px solid #344961;background:#16253a;color:#edf5ff"><button data-act="search-place" title="Centrer sur un lieu">↗</button></div>
        <button data-act="zoom-out" title="Dézoomer">−</button><button data-act="zoom-in" title="Zoomer">＋</button>
        <button data-act="validate" class="sv2-primary">✓ Valider</button>
      </div>
      <div class="sv2-body">
        <canvas id="sv2-map" class="sv2-map"></canvas>
        <div class="sv2-alerts" id="sv2-alerts"></div>
        <div class="sv2-panel" id="sv2-panel"><div class="sv2-panel-head"><b>Horaire</b><button class="sv2-btn" data-act="toggle-panel">⇆</button></div><div class="sv2-panel-content" id="sv2-panel-content"></div></div>
        <div class="sv2-picker" id="sv2-picker"><h3 id="sv2-picker-title">Choisir la voie ORM</h3><div class="sv2-picker-list" id="sv2-picker-list"></div><div class="sv2-picker-foot" id="sv2-picker-foot"><input id="sv2-track-name" placeholder="Nom voie Livemap (obligatoire)"><button class="sv2-btn" data-act="cancel-picker">Annuler</button></div></div>
      </div>
      <div class="sv2-bottom">
        <button class="sv2-btn sv2-primary" data-act="add-via">＋ VIA</button>
        <button class="sv2-btn sv2-primary" data-act="engine-osm" title="Afficher passivement les voies et jonctions OSM déjà chargées par le moteur (zoom 11+)">◉ OSM moteur</button>
        <button class="sv2-btn" data-act="world-osm-status" title="État de la couche ferroviaire OSM mondiale persistante">🌍 OSM monde</button>
        <button class="sv2-btn" data-act="world-osm-refresh" title="Forcer le rechargement des voies OSM mondiales dans la zone visible (zoom 10+)">↻ OSM zone</button>
        <button class="sv2-btn" data-act="manual-trace">✎ Tracé manuel</button>
        <button class="sv2-btn" data-act="auto-segment" title="Supprimer les VIA du segment actif et recalculer automatiquement">↺ Auto segment</button>
        <button class="sv2-btn" data-act="delete-last">✕ Dernier point</button>
        <button class="sv2-btn" data-act="move-selected">↔ Déplacer VIA</button>
        <button class="sv2-btn" data-act="insert-before">＋ VIA avant</button>
        <button class="sv2-btn" data-act="insert-after">＋ VIA après</button>
        <button class="sv2-btn" data-act="technical">◇ Point technique</button>
        <button class="sv2-btn" data-act="add-return">↩ Ajouter un retour</button>
        <span class="sv2-statusline" id="sv2-statusline">Cliquez une gare pour commencer.</span>
        <span class="spacer"></span>
        <button class="sv2-btn sv2-danger" data-act="trash-selected">🗑 Point sélectionné</button>
      </div>`;
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.canvas = overlay.querySelector('#sv2-map');
        this.ctx = this.canvas.getContext('2d');
        this.panel = overlay.querySelector('#sv2-panel');
        this.panelContent = overlay.querySelector('#sv2-panel-content');
        this.picker = overlay.querySelector('#sv2-picker');
        this.pickerList = overlay.querySelector('#sv2-picker-list');
        this.trackNameInput = overlay.querySelector('#sv2-track-name');
        this._bindDomEvents();
    }
    _bindDomEvents() {
        this.overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn)
                return;
            const act = btn.dataset.act;
            if (act === 'close')
                this.close();
            if (act === 'undo')
                this.undo();
            if (act === 'redo')
                this.redo();
            if (act === 'zoom-in')
                this._zoomMap(1);
            if (act === 'zoom-out')
                this._zoomMap(-1);
            if (act === 'world-osm-status')
                this.showWorldOsmStatus();
            if (act === 'world-osm-refresh')
                this.reloadWorldOsmVisible();
            if (act === 'export-diagnostic')
                this.exportScheduleDiagnostic();
            if (act === 'search-station')
                this.searchStationFromInput();
            if (act === 'search-place')
                this.searchPlaceFromInput();
            if (act === 'validate')
                this.validateAndSave();
            if (act === 'toggle-panel')
                this.panel.classList.toggle('collapsed');
            if (act === 'add-via')
                this.armVia();
            if (act === 'engine-osm')
                this.toggleEngineOsm();
            if (act === 'manual-trace')
                this.toggleManualTrace();
            if (act === 'auto-segment')
                this.resetActiveLegToAutomatic();
            if (act === 'delete-last')
                this.deleteLastPoint();
            if (act === 'trash-selected')
                this.deleteSelectedConstraint();
            if (act === 'move-selected')
                this.prepareConstraintEdit('MOVE');
            if (act === 'insert-before')
                this.prepareConstraintEdit('INSERT_BEFORE');
            if (act === 'insert-after')
                this.prepareConstraintEdit('INSERT_AFTER');
            if (act === 'technical')
                this.createTechnicalAtNextClick();
            if (act === 'add-return')
                this.beginReturn();
            if (act === 'cancel-picker')
                this._resolveTrackPicker(null);
        });
        const resize = () => this._resizeCanvas();
        window.addEventListener('resize', resize);
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            this.tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
            this.draw();
            this._queueVisibleStationStream(false);
            this._queueVisibleEngineOsm(false);
        }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this._beginMapPointer(e));
        window.addEventListener('mousemove', (e) => this._moveMapPointer(e));
        window.addEventListener('mouseup', (e) => this._endMapPointer(e));
        window.addEventListener('blur', () => this._cancelMapPointer());
    }
    _beginMapPointer(e) {
        if (e.button !== 0 || !this.isOpen())
            return false;
        this.dragging = true;
        this.panning = false;
        this.dragStartX = this.dragX = e.clientX;
        this.dragStartY = this.dragY = e.clientY;
        if (this.canvas)
            this.canvas.style.cursor = 'default';
        return true;
    }
    _moveMapPointer(e) {
        if (!this.dragging || !this.isOpen())
            return false;
        if (!this.panning) {
            const totalDx = e.clientX - this.dragStartX;
            const totalDy = e.clientY - this.dragStartY;
            if (Math.hypot(totalDx, totalDy) < this.panThresholdPx)
                return false;
            this.panning = true;
            if (this.canvas)
                this.canvas.style.cursor = 'grabbing';
            this.tileMap.pan(totalDx, totalDy);
            this.tileMap.markDirty?.();
            this.dragX = e.clientX;
            this.dragY = e.clientY;
            return true;
        }
        const dx = e.clientX - this.dragX;
        const dy = e.clientY - this.dragY;
        if (!dx && !dy)
            return true;
        this.tileMap.pan(dx, dy);
        this.tileMap.markDirty?.();
        this.dragX = e.clientX;
        this.dragY = e.clientY;
        return true;
    }
    _endMapPointer(e) {
        if (!this.dragging || !this.isOpen())
            return false;
        const wasPanning = this.panning;
        this.dragging = false;
        this.panning = false;
        if (this.canvas)
            this.canvas.style.cursor = 'default';
        if (!wasPanning && e.target === this.canvas) {
            this._handleMapClick(e).catch((err) => this._error(err));
            return 'click';
        }
        if (wasPanning) {
            this._queueVisibleStationStream(false);
            this._queueVisibleEngineOsm(false);
        }
        return wasPanning ? 'pan' : false;
    }
    _cancelMapPointer() {
        if (!this.dragging)
            return false;
        this.dragging = false;
        this.panning = false;
        if (this.canvas)
            this.canvas.style.cursor = 'default';
        return true;
    }
    _zoomMap(direction) {
        if (!this.canvas)
            return;
        const r = this.canvas.getBoundingClientRect();
        this.tileMap.applyZoom(direction > 0 ? 1 : -1, r.width / 2, r.height / 2);
        this.draw();
        this._queueVisibleStationStream(false);
        this._queueVisibleEngineOsm(false);
    }
    isOpen() { return this.overlay?.classList.contains('open'); }
    _resetTransientModes({ cancelRouteJobs = true } = {}) {
        if (cancelRouteJobs) {
            this._routeGeneration = Number(this._routeGeneration || 0) + 1;
            try {
                this._routeAbortController?.abort?.();
            }
            catch { }
            this._routeAbortController = null;
        }
        this.pendingStation = null;
        this._replaceLocationId = null;
        this._forcedConstraintLegIndex = null;
        this._viaNext = false;
        this._technicalNext = false;
        this._constraintEdit = null;
        this.selectedConstraintId = null;
        this._manualTraceMode = false;
        this._manualTraceLegIndex = null;
        this.insertConstraint = null;
        if (this.trackCandidateResolve) {
            const r = this.trackCandidateResolve;
            this.trackCandidateResolve = null;
            try {
                r(null);
            }
            catch { }
        }
        this.picker?.classList?.remove('open');
        this.busy = false;
        this._updateManualTraceButton?.();
    }
    _debugTrackSummary(track) {
        if (!track)
            return null;
        const snap = track.osmSnapshot || {};
        return {
            wayId: String(track.wayId || snap.wayId || ''), segmentIndex: Number.isFinite(Number(track.segmentIndex ?? snap.segmentIndex)) ? Number(track.segmentIndex ?? snap.segmentIndex) : null,
            lat: Number(track.lat), lon: Number(track.lon), snapLat: Number(track.snapLat), snapLon: Number(track.snapLon), trackRef: String(track.trackRef || snap.trackRef || ''), displayName: String(track.displayName || ''),
            snapshot: { wayId: String(snap.wayId || track.wayId || ''), segmentIndex: Number.isFinite(Number(snap.segmentIndex)) ? Number(snap.segmentIndex) : null, distanceM: Number.isFinite(Number(snap.distanceM)) ? Number(snap.distanceM) : null, geometryPoints: Array.isArray(snap.geometry) ? snap.geometry.length : 0, nodeCount: Array.isArray(snap.nodeIds) ? snap.nodeIds.length : 0, geometry: Array.isArray(snap.geometry) ? clone(snap.geometry) : [], nodeIds: Array.isArray(snap.nodeIds) ? [...snap.nodeIds] : [], tags: clone(snap.tags || {}), preferredDirection: snap.preferredDirection || '', bidirectional: snap.bidirectional || '', oneway: snap.oneway || '' }
        };
    }
    _diag(event, data = {}) { try {
        this.game?.orm?.debugScheduleEvent?.(event, data);
    }
    catch { } }
    _startScheduleDiagnosticSession(reason = 'editor-open') {
        try {
            return this.game?.orm?.startScheduleDebugSession?.({
                reason, build: 'v1.1.91-SC-DIJON-BEAUNE-ROUTING-RESILIENCE', scheduleId: this.record?.id || '', scheduleNumber: this.record?.number || '', scheduleName: this.record?.name || '',
                openedAt: new Date().toISOString(), worldStations: Number(this.game?.world?.stations?.length || 0),
            });
        }
        catch {
            return null;
        }
    }
    exportScheduleDiagnostic() {
        try {
            const ver = this._activeVersion(), path = this._activePath();
            this._diag('diagnostic-export-requested', { scheduleId: this._activeRecord()?.id || '', locations: Number(ver?.locations?.length || 0) });
            const orm = this.game?.orm?.getScheduleDebugSnapshot?.() || {};
            const payload = {
                ...orm,
                exportedAt: new Date().toISOString(),
                build: 'v1.1.91-SC-DIJON-BEAUNE-ROUTING-RESILIENCE',
                schedule: {
                    id: this._activeRecord()?.id || '', number: this._activeRecord()?.number || '', name: this._activeRecord()?.name || '', state: ver?.state || '',
                    locations: (ver?.locations || []).map((l, i) => ({ index: i, id: l.id, name: l.name, kind: l.kind, track: this._debugTrackSummary(l.track) })),
                    constraints: (path?.constraints || []).map((c, i) => ({ index: i, id: c.id, legIndex: c.legIndex, order: c.order, wayId: String(c.wayId || ''), segmentIndex: Number.isFinite(Number(c.segmentIndex)) ? Number(c.segmentIndex) : null, snapLat: Number(c.snapLat), snapLon: Number(c.snapLon), osmSnapshot: clone(c.osmSnapshot || null) })),
                    resolved: { distanceKm: Number(path?.distanceKm || 0), routePointCount: Number(path?.routePoints?.length || 0), segmentCount: Number(path?.segments?.length || 0), legCount: Number(path?.legs?.length || 0), error: String(path?.error || ''), topologyRevision: Number(path?.topologyRevision || 0), resolvedRevision: Number(path?.resolvedRevision || 0) },
                    validationReport: clone(ver?.validationReport || null),
                },
                viewport: { centerLat: Number(this.tileMap?.centerLat), centerLon: Number(this.tileMap?.centerLon), zoom: Number(this.tileMap?.zoomLevel) },
            };
            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.href = url;
            a.download = `RE_SC_DIAGNOSTIC_${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this._setHint('Diagnostic SC exporté. Envoyez-moi le fichier JSON sans refaire d’autres essais.');
            this._showTransientAlert('yellow', 'Diagnostic SC exporté — joignez le JSON dans ChatGPT.');
            return true;
        }
        catch (err) {
            this._error(err);
            return false;
        }
    }
    _routingOptions(ver = this._activeVersion(), extra = {}) {
        const p = ver?.performanceProfile;
        const out = { maxSpeed: p?.maxSpeed, traction: p?.traction || '', electricSystems: clone(p?.electricSystems || []), gauges: [...(p?.gauges || [])], loadingGauge: p?.loadingGauge || '', axleLoad: p?.axleLoad ?? null, metreLoad: p?.metreLoad ?? null, allowFallback: false, routeObjective: 'distance', allowSyntheticStitches: false, ...extra };
        out.onPreparationProgress = (info) => {
            const phase = String(info?.phase || '');
            if (phase === 'start')
                this._setHint('Préparation du graphe ferroviaire local pour ce tronçon…', true);
            else if (phase === 'long-macro')
                this._setHint(`Planification longue distance : corridor ${Number(info?.done || 0)}/${Number(info?.total || 0)} tuiles • ${Number(info?.ways || 0)} voies • marge ${Math.round(Number(info?.bufferKm || 0))} km…`, true);
            else if (phase === 'long-window')
                this._setHint(`Résolution exacte longue distance : fenêtre ${Number(info?.window || 0)}/${Number(info?.total || 0)} • trajet ~${Math.round(Number(info?.distanceKm || 0))} km…`, true);
            else if (phase === 'long-window-stream')
                this._setHint(`Chargement de la fenêtre exacte : ${Number(info?.done || 0)}/${Number(info?.total || 0)} tuiles • ${Number(info?.ways || 0)} voies…`, true);
            else if (phase === 'stream')
                this._setHint(`${info?.rescue ? 'Élargissement' : 'Préparation'} longue distance : ${Number(info?.done || 0)}/${Number(info?.total || 0)} tuiles • ${Number(info?.ways || 0)} voies OSM en cache…`, true);
            else if (phase === 'heal')
                this._setHint(`Réparation d’une zone OSM manquante… ${Number(info?.ways || 0)} voies récupérées • ${Number(info?.failed || 0)} zone(s) encore indisponible(s).`, true);
            else if (phase === 'acquired')
                this._setHint(`Géométrie OSM chargée (${Number(info?.ways || 0)} voies) — calcul local…`, true);
            else if (phase === 'rescue')
                this._setHint('Continuité complexe : élargissement unique du corridor ferroviaire…', true);
            else if (phase === 'done')
                this._setHint('Tracé ferroviaire local résolu.', true);
        };
        if (this._routeAbortController?.signal)
            out.signal = this._routeAbortController.signal;
        return out;
    }
    _cursorDistancePxToCandidate(lat, lon, candidate) {
        if (!this.tileMap?.latLonToPixel) {
            const d = Number(candidate?.distanceM);
            return Number.isFinite(d) ? d : Infinity;
        }
        const click = this.tileMap.latLonToPixel(Number(lat), Number(lon));
        const g = Array.isArray(candidate?.geometry) ? candidate.geometry : [];
        let best = Infinity;
        const segs = [];
        const idx = Number(candidate?.segmentIndex);
        if (Number.isInteger(idx) && idx >= 0 && idx < g.length - 1)
            segs.push(idx);
        else
            for (let i = 0; i < g.length - 1; i++)
                segs.push(i);
        for (const i of segs) {
            const a = this.tileMap.latLonToPixel(Number(g[i]?.lat), Number(g[i]?.lon));
            const b = this.tileMap.latLonToPixel(Number(g[i + 1]?.lat), Number(g[i + 1]?.lon));
            const vx = b.x - a.x, vy = b.y - a.y, wx = click.x - a.x, wy = click.y - a.y;
            const vv = vx * vx + vy * vy;
            const t = vv > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv)) : 0;
            const dx = click.x - (a.x + t * vx), dy = click.y - (a.y + t * vy);
            best = Math.min(best, Math.hypot(dx, dy));
        }
        if (!Number.isFinite(best) && Number.isFinite(Number(candidate?.snapLat)) && Number.isFinite(Number(candidate?.snapLon))) {
            const q = this.tileMap.latLonToPixel(Number(candidate.snapLat), Number(candidate.snapLon));
            best = Math.hypot(click.x - q.x, click.y - q.y);
        }
        return best;
    }
    async _exactTrackBinding(lat, lon, displayName = '') {
        // Exact means exact on-screen geometry: the SC never accepts a railway merely
        // because it lies within an arbitrary metre radius. It loads vector candidates
        // around the cursor, projects them with the same WebMercator map, then hit-tests
        // the clicked OSM segment in screen pixels.
        try {
            this._routeAbortController?.abort?.();
        }
        catch { }
        this._routeGeneration = Number(this._routeGeneration || 0) + 1;
        const pickerController = new AbortController();
        this._routeAbortController = pickerController;
        try {
            const HIT_TOLERANCE_PX = 5;
            const pxPerKm = Math.max(1, Number(this.tileMap?.getPixelsPerKm?.() || 1000));
            const pickerOptions = { pixelsPerKm: pxPerKm, hitTolerancePx: HIT_TOLERANCE_PX, limit: 16, signal: pickerController.signal };
            const candidates = this.router.chooseTrackCandidatesAtCursor ? await this.router.chooseTrackCandidatesAtCursor(lat, lon, pickerOptions) : await this.router.chooseTrackCandidates(lat, lon, { radiusM: Math.max(5, Math.ceil(((HIT_TOLERANCE_PX + 8) / pxPerKm) * 1000)), limit: 16, signal: pickerController.signal });
            const candidateList = Array.isArray(candidates) ? candidates : [];
            const hits = candidateList.map((c) => ({ c, px: this._cursorDistancePxToCandidate(lat, lon, c) })).filter((x) => Number.isFinite(x.px) && x.px <= HIT_TOLERANCE_PX).sort((a, b) => a.px - b.px);
            if (!hits.length)
                throw new Error(`Aucune voie OSM vectorielle sous le curseur (tolérance graphique ${HIT_TOLERANCE_PX} px). Zoomez davantage et cliquez directement sur le trait de la voie.`);
            if (hits.length > 1 && Math.abs(hits[1].px - hits[0].px) < 0.75)
                throw new Error('Plusieurs voies OSM se superposent sous le curseur. Zoomez davantage pour sélectionner sans ambiguïté la voie voulue.');
            const c = hits[0].c;
            const autoLabel = String(c.trackRef || c.ref || c.name || '').trim();
            return new TrackBinding({ voiePointId: String(c.voiePointId ?? ''), wayId: String(c.wayId), trackRef: String(c.trackRef || ''), displayName: String(displayName || autoLabel || '').trim(), lat: Number(lat), lon: Number(lon), snapLat: Number(c.snapLat), snapLon: Number(c.snapLon), segmentIndex: Number.isFinite(Number(c.segmentIndex)) ? Number(c.segmentIndex) : null, osmSnapshot: clone(c) });
        }
        finally {
            if (this._routeAbortController === pickerController)
                this._routeAbortController = null;
        }
    }
    open(scheduleId = null) {
        this._resetTransientModes();
        this._createdNewRecordId = '';
        if (scheduleId) {
            const refs = this.game.rotationV2?.findScheduleReferences(scheduleId) || [];
            if (refs.length && !window.confirm(`Cet horaire est utilisé ${refs.length} fois dans des roulements.\nToute modification sera propagée et les roulements seront recalculés.\n\nContinuer l’édition ?`))
                return;
            this.record = this.game.scheduleV2.getSchedule(scheduleId);
            this.version = this.record?.currentVersion || null;
        }
        else {
            this.record = this.game.scheduleV2.createDraft({ category: TrainCategory.PASSENGER, maxSpeed: 160 });
            this.version = this.record.currentVersion;
            this._createdNewRecordId = this.record.id;
        }
        if (!this.record || !this.version)
            return;
        this.returnRecord = null;
        this.returnVersion = null;
        this.roundTripGroup = null;
        this.mode = PathDirection.OUTBOUND;
        const group = this.game.scheduleV2.roundTrips.find((g) => g.outboundScheduleId === this.record.id || g.returnScheduleId === this.record.id);
        if (group) {
            this.roundTripGroup = group;
            const otherId = group.outboundScheduleId === this.record.id ? group.returnScheduleId : group.outboundScheduleId;
            if (group.returnScheduleId === this.record.id) {
                // Always edit a group from its outbound member for consistent colours.
                const out = this.game.scheduleV2.getSchedule(group.outboundScheduleId);
                if (out) {
                    this.record = out;
                    this.version = out.currentVersion;
                }
            }
            this.returnRecord = this.game.scheduleV2.getSchedule(group.returnScheduleId);
            this.returnVersion = this.returnRecord?.currentVersion || null;
        }
        this.history = [];
        this.future = [];
        this._resetTransientModes({ cancelRouteJobs: false });
        const hasContent = !!(this.version.locations.length || this.returnVersion?.locations?.length);
        this._centerOnContent();
        if (!hasContent)
            this._adoptMainViewport();
        this.overlay.classList.add('open');
        this.tileMap.setNetworkEnabled?.(true);
        this._resizeCanvas();
        this.renderPanel();
        this._setHint(this.version.locations.length ? 'Cliquez sur la carte pour guider le trajet, ou sur une gare pour ajouter un arrêt.' : `Toutes les gares gameplay sont visibles à ce zoom (${Number(this.game.world._builtInStationCount || this.game.world.stations?.length || 0).toLocaleString('fr-FR')}). Cliquez une gare de départ.`);
        this._scheduleDrawLoop();
        this._queueVisibleStationStream(true);
        this._updateEngineOsmButton();
        this._queueVisibleEngineOsm(true);
    }
    close() {
        if (!this.isOpen())
            return;
        const blankNew = !!this._createdNewRecordId && this.record?.id === this._createdNewRecordId && !this.version?.locations?.length && !this.returnRecord;
        if (blankNew) {
            this.game.scheduleV2.removeSchedule(this.record.id, { cascade: true, rotationManager: this.game.rotationV2 });
            this._createdNewRecordId = '';
        }
        else
            this._autosave();
        this._resetTransientModes();
        this.overlay.classList.remove('open');
        this.tileMap.setNetworkEnabled?.(false);
        cancelAnimationFrame(this._raf);
        clearTimeout(this._stationStreamTimer);
        clearTimeout(this._engineOsmStreamTimer);
        this.ui?.renderSchedulesList?.();
    }
    _adoptMainViewport() {
        const main = this.game?.renderer?.tileMap;
        if (!main)
            return false;
        if (Number.isFinite(main.centerLat))
            this.tileMap.centerLat = main.centerLat;
        if (Number.isFinite(main.centerLon))
            this.tileMap.centerLon = main.centerLon;
        // v1.1.34 — inherit the Livemap zoom EXACTLY, including minimum zoom 5.
        // All gameplay stations are already materialised globally; local OSM streaming
        // enriches metadata only and must never force a zoom change.
        const z = Number(main.zoomLevel || this.tileMap.zoomLevel || 7.5);
        const minZoom = Number.isFinite(this.tileMap.minZoom) ? this.tileMap.minZoom : 5;
        const maxZoom = Number.isFinite(this.tileMap.maxZoom) ? this.tileMap.maxZoom : 20;
        this.tileMap.zoomLevel = Math.max(minZoom, Math.min(maxZoom, z));
        this.tileMap.markDirty();
        return true;
    }
    _queueVisibleStationStream(force = false) {
        clearTimeout(this._stationStreamTimer);
        // v1.1.48 — 17,817 gameplay stations are already resident. Do not spend
        // Overpass capacity re-enriching station metadata in the background while the
        // player is calculating a route. Track/routing requests get priority.
        const residentStations = Number(this.game?.world?._builtInStationCount || this.game?.world?.stations?.length || 0);
        if (residentStations >= 1000)
            return;
        const delay = force ? 0 : 220;
        this._stationStreamTimer = setTimeout(() => {
            this._streamVisibleNativeStations(force).catch((err) => console.warn('Schedule V2 station stream:', err));
        }, delay);
    }
    async _streamVisibleNativeStations(force = false) {
        if (!this.isOpen() || !this.game?.orm || !this.game?.world || !this.canvas)
            return 0;
        const zoom = Number(this.tileMap.zoomLevel || 0);
        if (zoom < 8.5) {
            if (!this.version?.locations?.length)
                this._setHint(`Toutes les gares gameplay sont déjà visibles (${Number(this.game.world._builtInStationCount || this.game.world.stations?.length || 0).toLocaleString('fr-FR')}). Zoomez seulement pour enrichir OSM.`);
            return Number(this.game.world._builtInStationCount || this.game.world.stations?.length || 0);
        }
        const r = this.canvas.getBoundingClientRect();
        if (!r.width || !r.height)
            return 0;
        const a = this.tileMap.screenToWorld(0, 0, r.width, r.height), b = this.tileMap.screenToWorld(r.width, r.height, r.width, r.height);
        if (!a || !b)
            return 0;
        let south = Math.min(a.lat, b.lat), north = Math.max(a.lat, b.lat), west = Math.min(a.lon, b.lon), east = Math.max(a.lon, b.lon);
        if (![south, north, west, east].every(Number.isFinite))
            return 0;
        const padLat = Math.max(.01, (north - south) * .08), midLat = (south + north) / 2;
        const padLon = Math.max(.015, (east - west) * .08 / Math.max(.35, Math.cos(midLat * Math.PI / 180)));
        south = Math.max(-90, south - padLat);
        north = Math.min(90, north + padLat);
        west = Math.max(-180, west - padLon);
        east = Math.min(180, east + padLon);
        const q = (v) => (Math.round(v * 50) / 50).toFixed(2);
        const key = `${q(south)},${q(west)},${q(north)},${q(east)}@${Math.round(zoom * 2) / 2}`;
        if (!force && key === this._stationStreamKey)
            return Number(this.game.world._builtInStationCount || 0);
        if (this._stationStreamPromise) {
            // Do not overlap Overpass batches. Once the current batch settles, retry
            // the newest viewport so a quick pan never leaves the editor empty.
            this._stationStreamKey = '';
            return this._stationStreamPromise;
        }
        this._stationStreamKey = key;
        this._stationStreamLastAttempt = Date.now();
        if (!this.version?.locations?.length)
            this._setHint('Chargement des gares OSM visibles…', true);
        const p = (async () => {
            const stations = await this.game.orm.fetchStationsTiled(south, west, north, east);
            if (Array.isArray(stations) && stations.length) {
                await (this.game.world.mergeNativeOSMGameplayStationsAsync ? this.game.world.mergeNativeOSMGameplayStationsAsync(stations, null, 600) : this.game.world.setBuiltInGameplayStationsAsync(stations, null, 600));
                for (const ref of stations) {
                    const st = this.game.world.getStationById?.(ref.id);
                    if (st)
                        this.game.platformManager?.initStation?.(st.id, st.platforms || 2);
                }
            }
            this.tileMap.markDirty();
            this.draw();
            if (!this.version?.locations?.length) {
                this._setHint(stations?.length ? `Gares OSM chargées (${stations.length}). Cliquez une gare de départ, puis sa voie exacte.` : 'Aucune gare OSM trouvée dans cette zone. Déplacez/zoomez la carte.');
            }
            return Number(stations?.length || 0);
        })().catch((err) => {
            console.warn('Schedule V2 native station stream deferred:', err);
            if (!this.version?.locations?.length)
                this._setHint('Chargement des gares OSM indisponible pour cette zone. Réessayez après un léger déplacement/zoom.');
            return 0;
        }).finally(() => {
            this._stationStreamPromise = null;
            // If the user moved while the request was running, immediately ask for
            // the current viewport; same-key requests are deduplicated above.
            if (this.isOpen())
                this._queueVisibleStationStream(false);
        });
        this._stationStreamPromise = p;
        return p;
    }
    _activeRecord() { return (this.mode === PathDirection.RETURN ? this.returnRecord : this.record); }
    _activeVersion() { return (this.mode === PathDirection.RETURN ? this.returnVersion : this.version); }
    _activePath() { return this._activeVersion().outboundPath; }
    _activePreview() { return this.mode === PathDirection.RETURN ? this.returnPreviewRoute : this.previewRoute; }
    _setActivePreview(route) { if (this.mode === PathDirection.RETURN)
        this.returnPreviewRoute = route;
    else
        this.previewRoute = route; }
    _operationalReadiness(record, version, materialConflicts) {
        if (!record || !version || version.state !== ScheduleState.VALID)
            return { code: 'NOT_VALID', label: 'NON PRÊT', cls: 'repair' };
        const rm = this.game.rotationV2;
        if (!rm)
            return { code: 'NO_ROTATION_MANAGER', label: 'NON PRÊT', cls: 'draft' };
        const all = [];
        for (const rotation of rm.rotations || [])
            for (const occ of rotation.occurrences || [])
                if (occ.scheduleId === record.id)
                    all.push({ rotation, occ });
        const exact = all.filter((x) => x.occ.versionId === version.id), enabled = exact.filter((x) => x.rotation.enabled !== false);
        const activeRoles = new Set(['LEAD', 'ACTIVE_MULTIPLE', 'PUSHER']);
        for (const { rotation, occ } of enabled) {
            const issues = rm.validateRotation?.(rotation.id) || [];
            if ((occ.formation?.members || []).some((m) => activeRoles.has(String(m.role)) && rm.getVehicle?.(String(m.vehicleId))) && !issues.some((i) => i.level === 'ERROR' && (!i.occurrenceId || i.occurrenceId === occ.id)))
                return { code: 'READY', label: 'PRÊT · ROULEMENT', cls: 'ok', message: `Circule via ${rotation.name}.` };
        }
        if (this.game.realismSettings?.rotationsRequired === true) {
            if (!all.length)
                return { code: 'UNASSIGNED', label: 'HORS ROULEMENT', cls: 'draft', message: 'Mode Roulements avancés actif : ajoutez cet horaire à une ligne de roulement.' };
            if (!exact.length)
                return { code: 'OLD_VERSION', label: 'ROULEMENT À METTRE À JOUR', cls: 'repair', message: 'Une ligne de roulement référence une autre version de cet horaire.' };
            if (!enabled.length)
                return { code: 'ROTATION_DISABLED', label: 'LIGNE DÉSACTIVÉE', cls: 'draft' };
            if (enabled.every((x) => !(x.occ.formation?.members || []).length))
                return { code: 'NO_MATERIAL', label: 'LIGNE SANS MATÉRIEL', cls: 'repair' };
            return { code: 'BLOCKED', label: 'ROULEMENT BLOQUÉ', cls: 'repair', message: 'La ligne de roulement contient une erreur bloquante.' };
        }
        const direct = rm.getDirectAssignment?.(record.id, version.id);
        if (direct?.enabled !== false && direct) {
            const conflicts = materialConflicts ?? rm.validateMaterialConflicts?.() ?? [];
            const id = `direct:${direct.id}`;
            if (conflicts.some((c) => c.first?.rotationId === id || c.second?.rotationId === id))
                return { code: 'MATERIAL_CONFLICT', label: 'CONFLIT MATÉRIEL', cls: 'repair', message: 'Cette rame est déjà engagée ou ne peut rejoindre le départ. Corrigez les affectations ou ajoutez un acheminement.' };
            const rame = direct.rameId ? this.game.rameManager?.getById?.(direct.rameId) : null;
            if (direct.rameId && this.game.rameManager?.getById && !rame)
                return { code: 'RAME_MISSING', label: 'RAME INTROUVABLE', cls: 'repair' };
            if (rame?.inMaintenance)
                return { code: 'RAME_MAINTENANCE', label: 'RAME EN MAINTENANCE', cls: 'repair' };
            if (rame?.currentLocation?.depotId)
                return { code: 'RAME_IN_DEPOT', label: 'RAME AU DÉPÔT', cls: 'draft' };
        }
        if (direct?.enabled !== false && (direct?.formation?.members || []).some((m) => activeRoles.has(String(m.role)) && rm.getVehicle?.(String(m.vehicleId))))
            return { code: 'READY_SIMPLE', label: 'PRÊT · MODE SIMPLE', cls: 'ok', message: `Circule directement avec ${this.game.rameManager?.getById?.(direct.rameId)?.name || 'la rame affectée'}.` };
        return { code: 'NEEDS_RAME', label: 'RAME À AFFECTER', cls: 'draft', message: 'Roulements facultatifs : affectez simplement une rame à cet horaire.' };
    }
    _directAssignmentDialog(scheduleId) {
        const rec = this.game.scheduleV2.getSchedule(scheduleId), ver = rec?.currentVersion, rm = this.game.rotationV2;
        if (!rec || !ver || !rm)
            return;
        if (ver.state !== ScheduleState.VALID)
            return alert('Validez d’abord cet horaire.');
        if (this.game.realismSettings?.rotationsRequired === true) {
            const refs = rm.findScheduleReferences?.(rec.id) || [];
            document.getElementById('sv2-direct-modal')?.remove();
            const m = document.createElement('div');
            m.id = 'sv2-direct-modal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9450;background:#000a;display:flex;align-items:center;justify-content:center';
            const options = (rm.rotations || []).map((r) => `<option value="${esc(r.id)}">${esc(r.name)} — ${r.occurrences?.length || 0} service(s)</option>`).join('');
            const current = refs.length ? `<div class="sv2-alert green"><b>Déjà en roulement :</b><br>${refs.map((x) => esc(x.rotationName)).join('<br>')}</div>` : '<div class="sv2-alert orange"><b>Roulement requis.</b> Cet horaire ne circulera pas tant qu’il n’est pas ajouté à une ligne.</div>';
            m.innerHTML = `<div style="width:min(700px,95vw);max-height:88vh;overflow:auto;background:#0d1928;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">Ajouter au roulement — ${esc(rec.number || '')} ${esc(rec.name || '')}</h3>${current}<div class="sv2-field"><label>Ligne de roulement</label><select data-rotation-target style="width:100%;background:#111d2d;color:#eff6ff;border:1px solid #31455f;border-radius:5px;padding:8px"><option value="">— Choisir —</option>${options}<option value="__new__">＋ Créer une nouvelle ligne…</option></select></div><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px"><button class="sv2-btn" data-direct-cancel>Annuler</button><button class="sv2-btn sv2-primary" data-rotation-add>Ajouter l’horaire</button></div></div>`;
            const close = () => m.remove();
            m.querySelector('[data-direct-cancel]').onclick = close;
            m.addEventListener('click', (e) => { if (e.target === m)
                close(); });
            m.querySelector('[data-rotation-add]').onclick = () => { let id = m.querySelector('[data-rotation-target]').value; if (!id)
                return alert('Choisissez une ligne de roulement.'); if (id === '__new__') {
                const name = prompt('Nom de la nouvelle ligne de roulement :', `Ligne ${rec.number || ''}`.trim());
                if (!name?.trim())
                    return;
                id = rm.addRotation({ name: name.trim() }).id;
            } const r = rm.getRotation(id); if (!r)
                return alert('Ligne introuvable.'); if ((r.occurrences || []).some((o) => o.scheduleId === rec.id && o.versionId === ver.id))
                return alert('Cet horaire est déjà présent dans cette ligne.'); rm.addOccurrence(r.id, { scheduleId: rec.id, versionId: ver.id }); rm.recalculateRotation(r.id); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); close(); this.renderList(); this.renderPanel?.(); };
            document.body.appendChild(m);
            return;
        }
        const refs = rm.findScheduleReferences?.(rec.id) || [];
        if (refs.length) {
            alert(`Cet horaire est déjà géré par ${refs.map((x) => x.rotationName).join(', ')}. La rame directe du mode simple n'est pas nécessaire tant qu'il reste dans ce roulement.`);
            return;
        }
        document.getElementById('sv2-direct-modal')?.remove();
        const current = rm.getDirectAssignment?.(rec.id, ver.id), rames = this.game.rameManager?.getAll?.() || [];
        const m = document.createElement('div');
        m.id = 'sv2-direct-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9450;background:#000a;display:flex;align-items:center;justify-content:center';
        const options = rames.map((r) => `<option value="${esc(r.id)}" ${current?.rameId === r.id ? 'selected' : ''}>${esc(r.name || r.serialNumber || r.id)} · ${htmlText(Math.round(Number(r.totalLength || 0)))} m</option>`).join('');
        m.innerHTML = `<div style="width:min(650px,95vw);max-height:88vh;overflow:auto;background:#0d1928;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">Mode simple — affecter une rame à l’horaire</h3><p style="color:#b9cbe0">Les <b>Roulements sont facultatifs</b>. Pour faire circuler ${esc(rec.number || 'cet horaire')}, choisissez simplement une rame. Vous pourrez passer aux Roulements plus tard sans refaire l’horaire.</p><div class="sv2-field"><label>Rame utilisée</label><select data-simple-rame style="width:100%;background:#111d2d;color:#eff6ff;border:1px solid #31455f;border-radius:5px;padding:8px"><option value="">— Choisir une rame —</option>${options}</select></div>${!rames.length ? '<div class="sv2-alert orange">Aucune rame disponible. Créez d’abord une rame dans la page Rames.</div>' : ''}<div style="display:flex;justify-content:space-between;gap:6px;margin-top:12px"><div>${current ? '<button class="sv2-btn sv2-danger" data-simple-remove>Retirer l’affectation</button>' : ''}</div><div style="display:flex;gap:6px"><button class="sv2-btn" data-direct-cancel>Annuler</button><button class="sv2-btn sv2-primary" data-simple-save>Affecter la rame</button></div></div></div>`;
        const close = () => m.remove();
        m.querySelector('[data-direct-cancel]').onclick = close;
        m.addEventListener('click', (e) => { if (e.target === m)
            close(); });
        m.querySelector('[data-simple-remove]')?.addEventListener('click', () => { rm.removeDirectAssignment(rec.id, ver.id); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); close(); this.renderList(); });
        m.querySelector('[data-simple-save]').onclick = () => { const id = m.querySelector('[data-simple-rame]').value, rame = this.game.rameManager?.getById?.(id); if (!rame)
            return alert('Choisissez une rame.'); try {
            rm.setDirectRameAssignment(rec.id, ver.id, rame);
        }
        catch (err) {
            return alert(`Affectation impossible : ${err.message || err}`);
        } this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); close(); this.renderList(); this.renderPanel?.(); this._showTransientAlert('green', `${rec.number || 'Horaire'} prêt en mode simple avec ${rame.name || rame.id}.`); };
        document.body.appendChild(m);
    }
    _markRecordChanged(record = this._activeRecord(), version = this._activeVersion(), { needsValidation = true } = {}) {
        if (!record || !version)
            return;
        if (needsValidation)
            version.state = ScheduleState.DRAFT;
        this._pendingRotationScheduleIds.add(record.id);
    }
    _queueRotationRecalc(scheduleId) {
        if (scheduleId)
            this._pendingRotationScheduleIds.add(scheduleId);
    }
    _flushRotationRecalc() {
        const rm = this.game.rotationV2;
        if (!rm || !this._pendingRotationScheduleIds.size)
            return;
        const rotationIds = new Set();
        for (const scheduleId of this._pendingRotationScheduleIds) {
            for (const ref of rm.findScheduleReferences?.(scheduleId) || [])
                rotationIds.add(ref.rotationId);
        }
        this._pendingRotationScheduleIds.clear();
        for (const id of rotationIds) {
            try {
                rm.recalculateRotation?.(id);
            }
            catch (e) {
                console.warn('V2 rotation recalc:', id, e);
            }
        }
        this.ui?.rotationV2Editor?.render?.();
    }
    _makeTimingSnapshot(record = this._activeRecord(), version = this._activeVersion()) {
        if (!record || !version)
            return null;
        return {
            kind: 'TIMING', recordId: record.id, versionId: version.id, mode: this.mode, state: version.state,
            validationReport: version.validationReport || null, lastRecalculatedAt: version.lastRecalculatedAt || '',
            locations: (version.locations || []).map((l) => ({
                id: l.id, computedArrivalSec: l.computedArrivalSec, computedDepartureSec: l.computedDepartureSec,
                arrivalSec: l.arrivalSec, departureSec: l.departureSec, arrivalOverride: !!l.arrivalOverride, departureOverride: !!l.departureOverride,
                dwellSec: Number(l.dwellSec || 0), stopCode: l.stopCode, turnBack: !!l.turnBack,
            })),
        };
    }
    _snapshotTiming() {
        const data = this._makeTimingSnapshot();
        if (!data)
            return;
        this.history.push(data);
        if (this.history.length > 100)
            this.history.shift();
        this.future = [];
    }
    _restoreTimingSnapshot(s) {
        const rec = this.game.scheduleV2?.getSchedule?.(s?.recordId);
        const ver = rec?.versions?.find((v) => v.id === s.versionId);
        if (!rec || !ver)
            return false;
        const byId = new Map((s.locations || []).map((x) => [x.id, x]));
        for (const l of ver.locations || []) {
            const x = byId.get(l.id);
            if (!x)
                continue;
            l.computedArrivalSec = x.computedArrivalSec;
            l.computedDepartureSec = x.computedDepartureSec;
            l.arrivalSec = x.arrivalSec;
            l.departureSec = x.departureSec;
            l.arrivalOverride = !!x.arrivalOverride;
            l.departureOverride = !!x.departureOverride;
            l.dwellSec = Number(x.dwellSec || 0);
            l.stopCode = String(x.stopCode || '');
            l.turnBack = !!x.turnBack;
        }
        ver.state = s.state;
        ver.validationReport = s.validationReport || null;
        ver.lastRecalculatedAt = s.lastRecalculatedAt || '';
        this.record = rec;
        this.version = rec.currentVersion;
        this.mode = s.mode || this.mode;
        this._queueRotationRecalc(rec.id);
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
        return true;
    }
    _snapshot() {
        const data = {
            schedule: this.record?.toJSON(), returnSchedule: this.returnRecord?.toJSON() || null,
            roundTrip: this.roundTripGroup?.toJSON() || null, mode: this.mode,
            technicalLocations: clone(this.game.scheduleV2?.technicalLocations?.map((t) => t.toJSON?.() || t) || []),
            preview: clone(this.previewRoute), returnPreview: clone(this.returnPreviewRoute),
        };
        this.history.push(data);
        if (this.history.length > 100)
            this.history.shift();
        this.future = [];
    }
    _restoreSnapshot(s) {
        if (!s)
            return false;
        if (s.kind === 'TIMING')
            return this._restoreTimingSnapshot(s);
        this._routeGeneration = Number(this._routeGeneration || 0) + 1;
        try {
            this._routeAbortController?.abort?.();
        }
        catch { }
        this._routeAbortController = null;
        const mgr = this.game.scheduleV2;
        const schedule = s.schedule;
        if (!schedule?.id)
            return false;
        const roundTrip = s.roundTrip;
        // Rehydrate through manager save/load is safest and preserves prototypes.
        const all = mgr.toSave();
        all.schedules = all.schedules.filter((x) => x.id !== schedule.id && (!s.returnSchedule || x.id !== s.returnSchedule.id));
        all.schedules.push(schedule);
        if (s.returnSchedule)
            all.schedules.push(s.returnSchedule);
        if (roundTrip) {
            all.roundTrips = all.roundTrips.filter((x) => x.id !== roundTrip.id);
            all.roundTrips.push(roundTrip);
        }
        if (Array.isArray(s.technicalLocations))
            all.technicalLocations = clone(s.technicalLocations);
        const restored = mgr.loadFromSave(all);
        if (!restored) {
            this._setHint('Undo/redo annulé : snapshot incompatible, état courant conservé.', true);
            return false;
        }
        this.record = mgr.getSchedule(schedule.id);
        this.version = this.record?.currentVersion || null;
        if (!this.record || !this.version) {
            this._setHint('Undo/redo annulé : version restaurée introuvable.', true);
            return false;
        }
        this.returnRecord = s.returnSchedule ? mgr.getSchedule(s.returnSchedule.id) : null;
        this.returnVersion = this.returnRecord?.currentVersion || null;
        this.roundTripGroup = roundTrip ? mgr.roundTrips.find((x) => x.id === roundTrip.id) : null;
        this._queueRotationRecalc(this.record?.id);
        this._queueRotationRecalc(this.returnRecord?.id);
        this.mode = s.mode;
        this.previewRoute = clone(s.preview || []);
        this.returnPreviewRoute = clone(s.returnPreview || []);
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
        return true;
    }
    _currentUndoSnapshot(kind = 'FULL') { if (kind === 'TIMING')
        return this._makeTimingSnapshot(); return { schedule: this.record?.toJSON?.(), returnSchedule: this.returnRecord?.toJSON?.() || null, roundTrip: this.roundTripGroup?.toJSON?.() || null, mode: this.mode, technicalLocations: clone(this.game.scheduleV2?.technicalLocations?.map((t) => t.toJSON?.() || t) || []), preview: clone(this.previewRoute), returnPreview: clone(this.returnPreviewRoute) }; }
    undo() {
        if (!this.history.length)
            return false;
        const target = this.history[this.history.length - 1], cur = this._currentUndoSnapshot(target?.kind === 'TIMING' ? 'TIMING' : 'FULL');
        if (!this._restoreSnapshot(target))
            return false;
        this.history.pop();
        this.future.push(cur);
        return true;
    }
    redo() {
        if (!this.future.length)
            return false;
        const target = this.future[this.future.length - 1], cur = this._currentUndoSnapshot(target?.kind === 'TIMING' ? 'TIMING' : 'FULL');
        if (!this._restoreSnapshot(target))
            return false;
        this.future.pop();
        this.history.push(cur);
        return true;
    }
    _resizeCanvas() {
        if (!this.isOpen())
            return;
        const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
            this.canvas.width = Math.round(r.width * dpr);
            this.canvas.height = Math.round(r.height * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.tileMap.viewportWidth = r.width;
            this.tileMap.viewportHeight = r.height;
            this.tileMap.markDirty();
        }
        this.draw();
    }
    _scheduleDrawLoop() {
        cancelAnimationFrame(this._raf);
        const loop = () => { if (!this.isOpen())
            return; if (this.tileMap.isDirty)
            this.draw(); this._raf = requestAnimationFrame(loop); };
        this._raf = requestAnimationFrame(loop);
    }
    draw() {
        if (!this.isOpen())
            return;
        const r = this.canvas.getBoundingClientRect(), ctx = this.ctx, w = r.width, h = r.height;
        if (!w || !h)
            return;
        this._lastRenderAt = Date.now();
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#07101b';
        ctx.fillRect(0, 0, w, h);
        this.tileMap.viewportWidth = w;
        this.tileMap.viewportHeight = h;
        this.tileMap.renderTiles(ctx, w, h);
        this.tileMap._updateFrameCache();
        this._drawEngineOsm(ctx, w, h);
        this._drawStations(ctx, w, h);
        this._drawPath(ctx, this.version?.outboundPath, BLUE, this.version);
        this._drawPath(ctx, this.returnVersion?.outboundPath, GREEN, this.returnVersion);
        this._drawRoute(ctx, this.previewRoute, BLUE, .7);
        this._drawRoute(ctx, this.returnPreviewRoute, GREEN, .7);
        this._drawConstraints(ctx, this.version?.outboundPath, BLUE);
        this._drawConstraints(ctx, this.returnVersion?.outboundPath, GREEN);
        this._drawLocations(ctx, this.version, BLUE);
        this._drawLocations(ctx, this.returnVersion, GREEN);
        this._drawCandidateHighlight(ctx);
        this.tileMap.clearDirty();
    }
    _engineOsmViewportBounds(w, h, padRatio = 0) {
        const a = this.tileMap.screenToWorld(0, 0, w, h), b = this.tileMap.screenToWorld(w, h, w, h);
        if (!a || !b)
            return null;
        let south = Math.min(a.lat, b.lat), north = Math.max(a.lat, b.lat), west = Math.min(a.lon, b.lon), east = Math.max(a.lon, b.lon);
        if (![south, north, west, east].every(Number.isFinite))
            return null;
        if (padRatio > 0) {
            const dLat = (north - south) * padRatio, dLon = (east - west) * padRatio;
            south = Math.max(-90, south - dLat);
            north = Math.min(90, north + dLat);
            west = Math.max(-180, west - dLon);
            east = Math.min(180, east + dLon);
        }
        return { south, west, north, east };
    }
    _drawEngineOsm(ctx, w, h) {
        if (!this._engineOsmVisible || Number(this.tileMap.zoomLevel || 0) < 11)
            return;
        const b = this._engineOsmViewportBounds(w, h, .03);
        if (!b)
            return;
        const orm = this.game?.orm;
        if (!orm?.getLoadedRailwaysInBounds)
            return;
        const q = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
        // v1.1.69 — resident ORM size changes while routing is loading. Never put
        // it in the render-cache key or the whole overlay is rescanned every fetch.
        const key = `${q(b.south)},${q(b.west)},${q(b.north)},${q(b.east)}`;
        let ways = this._engineOsmRenderCache.key === key ? this._engineOsmRenderCache.ways : null;
        let switches = this._engineOsmRenderCache.key === key ? this._engineOsmRenderCache.switches : null;
        if (!ways) {
            ways = orm.getLoadedRailwaysInBounds(b.south, b.west, b.north, b.east, { limit: 16000 });
            switches = orm.getLoadedRailwaySwitchesInBounds?.(b.south, b.west, b.north, b.east, { limit: 4000 }) || [];
            this._engineOsmRenderCache = { key, ways: ways, switches: switches };
        }
        if (!ways?.length && !switches?.length)
            return;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const way of ways || []) {
            const g = way?.geometry || [];
            if (g.length < 2)
                continue;
            const service = String(way?.service || way?.tags?.service || '');
            ctx.strokeStyle = service ? '#65b6c8' : '#77e6ff';
            ctx.globalAlpha = service.length ? 0.60 : 0.82;
            ctx.lineWidth = service ? 1.05 : 1.45;
            ctx.beginPath();
            let started = false;
            for (const q0 of g) {
                if (!Number.isFinite(Number(q0?.lat)) || !Number.isFinite(Number(q0?.lon)))
                    continue;
                const p = this.tileMap.latLonToPixel(q0.lat, q0.lon);
                if (!started) {
                    ctx.moveTo(p.x, p.y);
                    started = true;
                }
                else
                    ctx.lineTo(p.x, p.y);
            }
            if (started)
                ctx.stroke();
        }
        // Tagged OSM switches: bright diamonds. They are point features and were
        // entirely absent from v1.1.46, which only painted railway ways.
        ctx.globalAlpha = .96;
        ctx.lineWidth = 1.2;
        const exactPositions = [];
        for (const sw of switches || []) {
            const lat = Number(sw?.lat), lon = Number(sw?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon))
                continue;
            const p = this.tileMap.latLonToPixel(lat, lon);
            exactPositions.push({ lat, lon });
            const r = Number(this.tileMap.zoomLevel || 0) >= 15 ? 5.5 : 4.2;
            ctx.fillStyle = '#ffcc33';
            ctx.strokeStyle = '#241900';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - r);
            ctx.lineTo(p.x + r, p.y);
            ctx.lineTo(p.x, p.y + r);
            ctx.lineTo(p.x - r, p.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        // v1.1.69 — inferred junctions are useful only at detailed zoom and costly
        // on dense city graphs. Tagged switches remain visible at the normal threshold.
        if (Number(this.tileMap.zoomLevel || 0) >= 14) {
            const inferred = inferRailJunctions(ways || []);
            ctx.fillStyle = '#d8fbff';
            ctx.strokeStyle = '#0a5360';
            ctx.globalAlpha = .9;
            for (const j of inferred) {
                if (exactPositions.some((sw) => Math.abs(sw.lat - j.lat) < 1e-6 && Math.abs(sw.lon - j.lon) < 1e-6))
                    continue;
                const p = this.tileMap.latLonToPixel(j.lat, j.lon), r = Number(this.tileMap.zoomLevel || 0) >= 15 ? 3.8 : 2.8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    showWorldOsmStatus() {
        const s = this.game?.orm?.getWorldRailCacheStats?.() || {};
        const cells = Number(s.memoryTiles || 0), ways = Number(s.memoryWays || 0), hits = Number(s.hits || 0), network = Number(s.networkTiles || 0), failed = Number(s.failedTiles || 0), empty = Number(s.verifiedEmpty || 0), rejected = Number(s.rejectedEmpty || 0), legacy = Number(s.invalidatedLegacyEmpty || 0);
        this._setHint(`🌍 Couche OSM ferroviaire mondiale active • grille ${Number(s.cellDeg || 0.5)}° • ${cells} tuile(s) en mémoire • ${ways.toLocaleString('fr-FR')} voies résidentes • cache utilisé ${hits} fois • ${network} tuile(s) acquise(s) ce lancement${empty ? ` • ${empty} zone(s) sans rail confirmée(s) temporairement` : ''}${rejected ? ` • ${rejected} réponse(s) vide(s) refusée(s)` : ''}${legacy ? ` • ${legacy} ancien(s) cache(s) vide(s) 1.1.93 invalidé(s)` : ''}${failed ? ` • ${failed} échec(s) réseau` : ''}. Les tuiles contenant des voies sont conservées durablement ; une tuile vide n'est réutilisée qu'après confirmation indépendante et expire automatiquement.`);
    }
    async reloadWorldOsmVisible() {
        const zoom = Number(this.tileMap?.zoomLevel || 0);
        if (zoom < 10) {
            this._setHint('↻ OSM zone : zoomez au niveau 10 ou davantage avant de forcer une zone mondiale, pour éviter un téléchargement trop large.');
            return;
        }
        const r = this.canvas?.getBoundingClientRect?.(), b = r ? this._engineOsmViewportBounds(r.width, r.height, .04) : null;
        const orm = this.game?.orm, cache = this.game?.worldRailCache;
        if (!b || !orm?.refreshWorldRailwaysForEnvelopes || !cache) {
            this._setHint('Couche OSM mondiale indisponible dans cette build.');
            return;
        }
        const cells = cache.tilesForBBox?.(b.south, b.west, b.north, b.east) || [];
        if (cells.length > 16) {
            this._setHint(`↻ OSM zone : zone encore trop large (${cells.length} tuiles mondiales). Zoomez davantage avant le rechargement.`);
            return;
        }
        this._setHint(`🌍 Rechargement forcé de ${cells.length} tuile(s) OSM ferroviaire mondiale…`, true);
        try {
            const ways = await orm.refreshWorldRailwaysForEnvelopes([b], { timeoutMs: 5200, attemptsPerEndpoint: 1, maxSplitDepth: 2, concurrency: Math.min(3, Math.max(1, cells.length)), maxEndpoints: 3, raceEndpoints: 2, hedgeDelayMs: 240 });
            this._engineOsmRenderCache = { key: '', ways: [], switches: [] };
            this.tileMap.markDirty?.();
            this.draw();
            this._setHint(`🌍 OSM monde rechargé : ${Number(ways?.length || 0).toLocaleString('fr-FR')} voie(s) vectorielle(s) disponibles dans la zone. Le cache local remplace désormais toute ancienne tuile douteuse.`);
        }
        catch (e) {
            this._setHint(`🌍 Rechargement OSM monde impossible : ${e?.message || e}`);
        }
    }
    _updateEngineOsmButton() {
        const btn = this.overlay?.querySelector?.('[data-act="engine-osm"]');
        if (!btn)
            return;
        btn.textContent = this._engineOsmVisible ? '◉ OSM moteur' : '○ OSM moteur';
        btn.classList.toggle('sv2-primary', !!this._engineOsmVisible);
    }
    toggleEngineOsm() {
        this._engineOsmVisible = !this._engineOsmVisible;
        this._updateEngineOsmButton();
        this._engineOsmRenderCache = { key: '', ways: [], switches: [] };
        this.tileMap.markDirty?.();
        this.draw();
        if (this._engineOsmVisible) {
            this._setHint('OSM moteur activé : affichage PASSIF des voies déjà chargées par le routage. Aucun appel Overpass supplémentaire ; les points clairs signalent les jonctions OSM déduites.');
            this._queueVisibleEngineOsm(true);
        }
        else
            this._setHint('OSM moteur masqué : seul le fond OpenRailwayMap reste visible.');
    }
    _queueVisibleEngineOsm(force = false) {
        // v1.1.48 — PASSIVE overlay. Never start Overpass/network work from the
        // diagnostic layer: Schedule Creator routing owns network priority.
        clearTimeout(this._engineOsmStreamTimer);
        if (!this._engineOsmVisible)
            return;
        const delay = force ? 0 : 120;
        this._engineOsmStreamTimer = setTimeout(() => {
            if (!this.isOpen() || !this._engineOsmVisible)
                return;
            // Passive redraws keep the cache. A forced refresh is used once routing has
            // settled so newly resident ways appear without a fetch-by-fetch rescan.
            if (force)
                this._engineOsmRenderCache = { key: '', ways: [], switches: [] };
            this.tileMap.markDirty?.();
            this.draw();
        }, delay);
    }
    async _streamVisibleEngineOsm(force = false) {
        // Compatibility shim retained for callers/tests. Deliberately network-free.
        this._queueVisibleEngineOsm(force);
        return 0;
    }
    _drawStations(ctx, w, h) {
        const zoom = this.tileMap.zoomLevel;
        let sts = this.game.world.stations || [];
        if (zoom >= 7 && this.game.world.getStationsInBounds) {
            const a = this.tileMap.screenToWorld(0, 0, w, h), b = this.tileMap.screenToWorld(w, h, w, h);
            sts = this.game.world.getStationsInBounds(Math.min(a.lat, b.lat), Math.min(a.lon, b.lon), Math.max(a.lat, b.lat), Math.max(a.lon, b.lon));
        }
        const showNames = zoom >= SC_STATION_LABEL_MIN_ZOOM;
        // Same idea as the LiveMap reference layer: at regional zoom, cap label work
        // by screen area instead of station count. Exact/local zoom keeps every label.
        const labelOccupied = showNames && zoom < SC_STATION_LABEL_ALL_ZOOM ? new Set() : null;
        const labelCellW = zoom < 12 ? 110 : 80, labelCellH = zoom < 12 ? 24 : 20;
        ctx.save();
        if (zoom < 7) {
            // Same continent strategy as the main renderer: all stations remain visible,
            // but each costs one tiny fillRect instead of arc+stroke paths.
            ctx.fillStyle = '#f4f7fb';
            const dot = zoom <= 5.25 ? 1.2 : 1.6;
            for (const st of sts) {
                const p = this.tileMap.latLonToPixel(st.lat, st.lon);
                if (p.x < -3 || p.y < -3 || p.x > w + 3 || p.y > h + 3)
                    continue;
                ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
            }
            ctx.restore();
            return;
        }
        ctx.fillStyle = '#f4f7fb';
        ctx.strokeStyle = '#182a3d';
        ctx.lineWidth = 1;
        if (showNames)
            ctx.font = zoom >= 12 ? '11px system-ui' : '10px system-ui';
        for (const st of sts) {
            const p = this.tileMap.latLonToPixel(st.lat, st.lon);
            if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10)
                continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (showNames) {
                let drawLabel = true;
                if (labelOccupied) {
                    const key = `${Math.floor(p.x / labelCellW)}:${Math.floor(p.y / labelCellH)}`;
                    if (labelOccupied.has(key))
                        drawLabel = false;
                    else
                        labelOccupied.add(key);
                }
                if (drawLabel) {
                    ctx.fillStyle = '#f1f5f9';
                    ctx.fillText(st.name, p.x + 5, p.y - 4);
                    ctx.fillStyle = '#f4f7fb';
                }
            }
        }
        ctx.restore();
    }
    _drawRoute(ctx, route, color, alpha = 1) {
        if (!Array.isArray(route) || route.length < 2)
            return;
        // HOTFIX8 — stream the simplified polyline directly into one Canvas path.
        // The previous pts[] allocation could retain tens of thousands of temporary
        // pixel objects every time a dwell input triggered draw() on a continental route.
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        let last = null, count = 0;
        for (let i = 0; i < route.length; i++) {
            const q = route[i];
            if (!Number.isFinite(Number(q?.lat)) || !Number.isFinite(Number(q?.lon)))
                continue;
            const p = this.tileMap.latLonToPixel(q.lat, q.lon), isLast = i === route.length - 1;
            if (!last || isLast || Math.hypot(p.x - last.x, p.y - last.y) >= 0.75) {
                if (count++)
                    ctx.lineTo(p.x, p.y);
                else
                    ctx.moveTo(p.x, p.y);
                last = p;
            }
        }
        if (count >= 2) {
            ctx.strokeStyle = '#06101d';
            ctx.globalAlpha = Math.min(0.9, alpha);
            ctx.lineWidth = 8;
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 4.5;
            ctx.stroke();
        }
        ctx.restore();
    }
    _drawPath(ctx, path, color, ver = null) {
        this._drawRoute(ctx, path?.routePoints, color, 1);
        if (!path?.segments || this.busy)
            return;
        const issueColor = new Map(), rank = { INFO: 0, UNKNOWN: 1, WARNING: 2, ERROR: 3 };
        for (const i of ver?.validationReport?.issues || []) {
            if (i?.level !== 'ERROR' && i?.level !== 'WARNING')
                continue;
            const data = (i.data && typeof i.data === 'object' ? i.data : {});
            const way = String(data.wayId || '');
            if (!way)
                continue;
            const prev = issueColor.get(way);
            if (!prev || rank[i.level] > rank[prev.level])
                issueColor.set(way, i);
        }
        ctx.save();
        ctx.lineWidth = 6;
        // HOTFIX65 — blue means the exact route is geometrically valid. Missing OSM
        // metadata (Vmax/electrification unknown) is informational only and must not
        // recolour a perfectly valid station/terminus leg yellow.
        for (const seg of path.segments) {
            let col = null;
            const issue = issueColor.get(String(seg.wayId || ''));
            if (issue)
                col = issue.level === 'ERROR' ? RED : ORANGE;
            else if (seg._againstPreferredDirection)
                col = ORANGE;
            if (!col)
                continue;
            const a = this.tileMap.latLonToPixel(seg.from.lat, seg.from.lon), b = this.tileMap.latLonToPixel(seg.to.lat, seg.to.lon);
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    }
    _drawConstraints(ctx, path, color) { if (!path)
        return; for (const c of path.constraints) {
        const anchor = railAnchorPosition(c);
        if (!anchor)
            continue;
        const p = this.tileMap.latLonToPixel(anchor.lat, anchor.lon);
        ctx.beginPath();
        ctx.arc(p.x, p.y, c.id === this.selectedConstraintId ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = c.id === this.selectedConstraintId ? '#fff' : color;
        ctx.fill();
        ctx.strokeStyle = '#0a1220';
        ctx.lineWidth = 2;
        ctx.stroke();
    } }
    _drawLocations(ctx, ver, color) { if (!ver)
        return; for (const l of ver.locations) {
        const anchor = railAnchorPosition(l.track);
        if (!anchor)
            continue;
        const p = this.tileMap.latLonToPixel(anchor.lat, anchor.lon);
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        if (l.kind === LocationKind.TECHNICAL) {
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-5, -5, 10, 10);
            ctx.strokeRect(-5, -5, 10, 10);
        }
        else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    } }
    _drawCandidateHighlight(ctx) { const c = this._hoverCandidate; if (!c?.geometry?.length)
        return; this._drawRoute(ctx, c.geometry, '#ffffff', .9); }
    _centerOnContent() { const pts = []; for (const v of [this.version, this.returnVersion])
        for (const l of v?.locations || []) {
            const anchor = railAnchorPosition(l.track);
            if (anchor)
                pts.push(anchor);
        } if (!pts.length)
        return; this.tileMap.centerLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length; this.tileMap.centerLon = pts.reduce((s, p) => s + p.lon, 0) / pts.length; this.tileMap.zoomLevel = pts.length === 1 ? 13 : 9; this.tileMap.markDirty(); }
    _nearestStation(lat, lon, maxPixels = 13) { const pxPerKm = this.tileMap.getPixelsPerKm() || 1; const radiusKm = Math.max(.05, maxPixels / pxPerKm); const candidates = this.game.world.getStationsNear(lat, lon, radiusKm); const click = this.tileMap.latLonToPixel(lat, lon); let best = null, bd = Infinity; for (const st of candidates) {
        const p = this.tileMap.latLonToPixel(st.lat, st.lon);
        const d = Math.hypot(p.x - click.x, p.y - click.y);
        if (d < bd && d <= maxPixels) {
            best = st;
            bd = d;
        }
    } return best; }
    _nearestConstraint(lat, lon, maxPx = 10) { const path = this._activePath(); if (!path)
        return null; const click = this.tileMap.latLonToPixel(lat, lon); let best = null, bd = Infinity; for (const c of path.constraints) {
        const anchor = railAnchorPosition(c);
        if (!anchor)
            continue;
        const p = this.tileMap.latLonToPixel(anchor.lat, anchor.lon);
        const d = Math.hypot(p.x - click.x, p.y - click.y);
        if (d < bd && d <= maxPx) {
            best = c;
            bd = d;
        }
    } return best; }
    async _handleMapClick(e) {
        if (this.busy || this.picker.classList.contains('open'))
            return;
        const r = this.canvas.getBoundingClientRect();
        const w = this.tileMap.screenToWorld(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
        const ver = this._activeVersion();
        if (!ver)
            return;
        if (this.pendingStation) {
            await this._finishPendingStationAnchor(w.lat, w.lon);
            return;
        }
        if (this._constraintEdit) {
            await this._applyConstraintEditAt(w.lat, w.lon);
            return;
        }
        if (this._replaceLocationId) {
            const target = ver.locations.find((x) => x.id === this._replaceLocationId);
            if (!target) {
                this._replaceLocationId = null;
                return;
            }
            const station = this._nearestStation(w.lat, w.lon);
            if (!station) {
                this._setHint('Remplacement de gare : cliquez précisément sur une icône de gare.');
                return;
            }
            this._replaceLocationId = null;
            this.pendingStation = { action: 'REPLACE', station, locationId: target.id, defaultName: target.track?.displayName || '' };
            this._setHint(`${station.name} sélectionnée — cliquez maintenant la position exacte de la voie d’arrêt.`);
            return;
        }
        if (this._forcedConstraintLegIndex != null) {
            const leg = this._forcedConstraintLegIndex;
            this._forcedConstraintLegIndex = null;
            await this._addConstraint(w.lat, w.lon, null, leg);
            return;
        }
        if (this._viaNext) {
            this._viaNext = false;
            await this._addConstraint(w.lat, w.lon);
            return;
        }
        if (this._technicalNext) {
            this._technicalNext = false;
            await this._addTechnicalStop(w.lat, w.lon);
            return;
        }
        if (this._manualTraceMode) {
            const leg = this._manualTraceLegIndex;
            await this._addConstraint(w.lat, w.lon, null, leg);
            if (this._manualTraceMode) {
                const v = this._activeVersion(), a = v?.locations?.[leg], b = v?.locations?.[leg + 1];
                this._setHint(`TRACÉ MANUEL ORM ${a?.name || '?'} → ${b?.name || '?'} : cliquez d’autres aiguilles/voies à imposer, puis ✓ Fin tracé.`);
                this._updateManualTraceButton();
            }
            return;
        }
        // A station hit has priority over a nearby VIA. Previously a VIA within a
        // few pixels of the station swallowed the click, making VIA -> station feel
        // impossible even though the station marker itself was clicked.
        const st = this._nearestStation(w.lat, w.lon);
        if (st) {
            await this._addStationStop(st);
            return;
        }
        const existing = this._nearestConstraint(w.lat, w.lon);
        if (existing) {
            this.selectedConstraintId = existing.id;
            this._setHint('VIA sélectionné : déplacer, insérer avant/après ou supprimer.');
            this.draw();
            return;
        }
        if (!ver.locations.length) {
            this._setHint('Commencez par cliquer une gare de départ.');
            return;
        }
        await this._addConstraint(w.lat, w.lon);
    }
    async _loadCandidates(lat, lon) {
        this.busy = true;
        this._setHint('Recherche des voies ORM…', true);
        try {
            const cs = await this.router.chooseTrackCandidates(lat, lon, { radiusM: 45, limit: 10 });
            return cs || [];
        }
        finally {
            this.busy = false;
        }
    }
    _candidateDetails(c) { const vmax = c.maxSpeed ?? 30; const vsrc = c.maxSpeedSource === 'FALLBACK_30' ? 'Vmax inconnue (pas de 30 fictif)' : `${vmax} km/h`; let elec = 'Électrification inconnue'; if (c.electrified === false)
        elec = 'Non électrifiée';
    else if (c.electrified === true) {
        const volts = (c.voltage || []).join('/');
        const freq = (c.frequency || []).join('/');
        elec = [c.electrifiedMode || 'électrifiée', volts && `${volts} V`, freq && `${freq} Hz`].filter(Boolean).join(' • ');
    } const tech = [c.gauge && `${c.gauge} mm`, c.loadingGauge && `gabarit ${c.loadingGauge}`, c.axleLoad && `essieu ${c.axleLoad}`, c.metreLoad && `mètre ${c.metreLoad}`, c.trainProtection && `protection ${c.trainProtection}`].filter(Boolean); return `${vsrc} • ${elec}${c.trackRef ? ` • voie ${c.trackRef}` : ''}${tech.length ? ` • ${tech.join(' • ')}` : ''}`; }
    _pickTrack(candidates, { title = 'Choisissez la voie ORM', requireName = true, defaultName = '' } = {}) {
        return new Promise((resolve) => {
            this.trackCandidateResolve = resolve;
            this.trackCandidates = candidates;
            this._hoverCandidate = null;
            this.picker.querySelector('#sv2-picker-title').textContent = title;
            this.trackNameInput.value = defaultName || '';
            this.trackNameInput.style.display = requireName ? 'block' : 'none';
            this.picker.dataset.requireName = requireName ? '1' : '0';
            this.pickerList.innerHTML = candidates.length ? candidates.map((c, i) => `<div class="sv2-candidate" data-candidate="${htmlText(i)}"><b>${esc(c.trackRef || c.name || c.ref || `OSM way ${c.wayId}`)}</b><small>ID ${esc(c.wayId)} • ${esc(this._candidateDetails(c))}</small></div>`).join('') : '<div style="padding:18px;color:#ff9a9a">Aucune voie ferroviaire ORM trouvée à proximité.</div>';
            this.pickerList.querySelectorAll('.sv2-candidate').forEach((el) => {
                el.addEventListener('mouseenter', () => { this._hoverCandidate = candidates[Number(el.dataset.candidate)]; this.draw(); });
                el.addEventListener('mouseleave', () => { this._hoverCandidate = null; this.draw(); });
                el.addEventListener('click', () => { const c = candidates[Number(el.dataset.candidate)]; const name = this.trackNameInput.value.trim(); if (requireName && !name) {
                    this.trackNameInput.focus();
                    this.trackNameInput.style.borderColor = RED;
                    return;
                } this._resolveTrackPicker({ candidate: c, displayName: name }); });
            });
            this.picker.classList.add('open');
        });
    }
    _resolveTrackPicker(value) { this.picker.classList.remove('open'); this._hoverCandidate = null; this.draw(); const r = this.trackCandidateResolve; this.trackCandidateResolve = null; if (r)
        r(value); }
    _trackBindingFromChoice(choice) { const c = choice.candidate; return new TrackBinding({ voiePointId: String(c.voiePointId ?? ''), wayId: String(c.wayId ?? ''), trackRef: String(c.trackRef ?? ''), displayName: String(choice.displayName || ''), lat: Number(c.lat ?? c.snapLat), lon: Number(c.lon ?? c.snapLon), snapLat: Number(c.snapLat ?? c.lat), snapLon: Number(c.snapLon ?? c.lon), osmSnapshot: clone(c) }); }
    _cursorTrackBinding(lat, lon, displayName = '') {
        return new TrackBinding({
            wayId: '', trackRef: '', displayName: String(displayName || '').trim(),
            lat: Number(lat), lon: Number(lon), snapLat: Number(lat), snapLon: Number(lon),
            osmSnapshot: { source: 'CURSOR_ANCHOR', lat: Number(lat), lon: Number(lon) },
        });
    }
    _askTrackDisplayName(defaultName = '') {
        const name = window.prompt('Nom de voie pour la Livemap (obligatoire) :', defaultName || '');
        return name?.trim() || '';
    }
    async _finishPendingStationAnchor(lat, lon) {
        const pending = this.pendingStation;
        if (!pending)
            return;
        const ver = this._activeVersion();
        if (!ver) {
            this.pendingStation = null;
            return;
        }
        let binding;
        try {
            binding = await this._exactTrackBinding(lat, lon, '');
        }
        catch (err) {
            this._error(err);
            return;
        }
        const suggestedName = pending.defaultName || binding.trackRef || binding.osmSnapshot?.trackRef || binding.osmSnapshot?.ref || binding.osmSnapshot?.name || '';
        const displayName = this._askTrackDisplayName(suggestedName);
        if (!displayName) {
            this._setHint(`${pending.station?.name || 'Arrêt'} : le nom de voie Livemap est obligatoire. Cliquez à nouveau la position de voie.`);
            return;
        }
        binding.displayName = displayName;
        this._snapshot();
        this._markRecordChanged();
        if (pending.action === 'ADD') {
            const st = pending.station;
            const kind = pending.kind || LocationKind.STATION;
            const oldLocations = [...ver.locations];
            const insertIndex = Number.isInteger(Number(pending.insertIndex)) ? Math.max(0, Math.min(ver.locations.length, Number(pending.insertIndex))) : ver.locations.length;
            const loc = new ScheduledLocation({ kind, stationId: kind === LocationKind.STATION ? st.id : '', technicalLocationId: kind === LocationKind.TECHNICAL ? st.id : '', name: st.name, track: binding.toJSON(), order: insertIndex, dwellSec: ver.locations.length ? 300 : 0, stopCode: StopCode.NONE });
            ver.locations.splice(insertIndex, 0, loc);
            this._remapConstraintsForInsertedStop(this._activePath(), oldLocations, insertIndex, loc);
            ver.normalize();
            if (ver.locations.length === 1) {
                loc.departureSec = 8 * 3600;
                loc.computedDepartureSec = 8 * 3600;
                this.tileMap.centerLat = lat;
                this.tileMap.centerLon = lon;
                this.tileMap.zoomLevel = Math.max(this.tileMap.zoomLevel, 13);
                this.tileMap.markDirty();
                if (this.mode === PathDirection.RETURN)
                    this._syncReturnStart();
            }
            this._setHint(`${st.name} — ${displayName} ajoutée${insertIndex < ver.locations.length - 1 ? ' dans le sillon' : ''}. Recalcul local des tronçons voisins…`);
        }
        else if (pending.action === 'REPLACE') {
            const loc = ver.locations.find((x) => x.id === pending.locationId);
            if (!loc) {
                this.pendingStation = null;
                return;
            }
            loc.stationId = pending.station.id;
            loc.name = pending.station.name;
            loc.track = binding;
            this._setHint(`Gare remplacée par ${pending.station.name} — ${displayName}. Tout le trajet est recalculé.`);
        }
        else if (pending.action === 'CHANGE_TRACK') {
            const loc = ver.locations.find((x) => x.id === pending.locationId);
            if (!loc) {
                this.pendingStation = null;
                return;
            }
            loc.track = binding;
            this._setHint(`${loc.name} : position de voie remplacée par ${displayName}.`);
        }
        this.pendingStation = null;
        await this._recomputeActivePath();
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
    }
    async _addStationStop(st) {
        const ver = this._activeVersion();
        if (!ver)
            return;
        // Native-station/native-network bridge: preload only the local SCV3 shards
        // around the selected gameplay station. No OSM/Overpass request is allowed.
        try {
            await this.game?.world?.prefetchRailNetworkNearStation?.(st, 0.8);
        }
        catch (err) {
            console.warn('Préchargement RailGraph gare impossible:', err);
        }
        // SC Future A3 — normal station clicks are chronological authoring.
        // Never re-order the player's journey from geography: if the player clicks
        // Karlsruhe -> Mannheim -> Darmstadt -> Hannover, that exact sequence is the
        // schedule. Mid-route insertion is an explicit editor action only.
        this.pendingStation = { action: 'ADD', station: st, kind: LocationKind.STATION, defaultName: '', insertIndex: ver.locations.length };
        if (this.tileMap) {
            this.tileMap.centerLat = Number(st.lat);
            this.tileMap.centerLon = Number(st.lon);
            this.tileMap.zoomLevel = Math.max(17, Number(this.tileMap.zoomLevel || 0));
            this.tileMap.markDirty?.();
        }
        this._setHint(`${st.name} sélectionnée — zoom voie exacte activé. Cliquez directement sur le trait ORM/OSM de la voie ${ver.locations.length ? 'd’arrêt' : 'de départ'}.`);
    }
    async _changeLocationTrack(locationId) {
        const ver = this._activeVersion();
        const loc = ver?.locations.find((x) => x.id === locationId);
        if (!loc)
            return;
        this.pendingStation = { action: 'CHANGE_TRACK', locationId: loc.id, station: { name: loc.name }, defaultName: loc.track?.displayName || '' };
        const lat = Number(loc.track?.snapLat ?? loc.track?.lat), lon = Number(loc.track?.snapLon ?? loc.track?.lon);
        if (this.tileMap && Number.isFinite(lat) && Number.isFinite(lon)) {
            this.tileMap.centerLat = lat;
            this.tileMap.centerLon = lon;
            this.tileMap.zoomLevel = Math.max(17, Number(this.tileMap.zoomLevel || 0));
            this.tileMap.markDirty?.();
        }
        this._setHint(`${loc.name} — cliquez directement sur le trait ORM/OSM de la nouvelle voie.`);
    }
    _renameTrackDisplay(locationId) {
        const ver = this._activeVersion(), loc = ver?.locations?.find((x) => x.id === locationId);
        if (!loc?.track)
            return false;
        const next = window.prompt('Nom de voie affiché (la voie physique ne change pas) :', loc.track.displayName || loc.track.trackRef || '');
        if (next == null)
            return false;
        const name = String(next).trim();
        if (!name)
            return false;
        this._snapshot();
        loc.track.displayName = name;
        this._markRecordChanged();
        // Metadata-only: deliberately no _recomputeActivePath().
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
        this.game?._forceV2RuntimeSyncNow?.();
        this._setHint(`${loc.name} : libellé de voie changé en ${name}, tracé inchangé.`);
        return true;
    }
    prepareStationReplacement(locationId) {
        const ver = this._activeVersion();
        const loc = ver?.locations.find((x) => x.id === locationId);
        if (!loc || loc.kind !== LocationKind.STATION)
            return;
        this._replaceLocationId = locationId;
        this._setHint(`Remplacer ${loc.name} : cliquez la nouvelle gare sur la carte.`);
        this.draw();
    }
    async _replaceStationLocation(locationId, station) {
        const ver = this._activeVersion();
        const loc = ver?.locations.find((x) => x.id === locationId);
        if (!loc)
            return;
        this.pendingStation = { action: 'REPLACE', station: station, locationId: locationId, defaultName: loc.track?.displayName || '' };
        this._setHint(`${station.name} sélectionnée — cliquez maintenant la position exacte de la voie d’arrêt.`);
    }
    _activeManualLegIndex() {
        const ver = this._activeVersion(), path = this._activePath();
        if (!ver || ver.locations.length < 2)
            return null;
        const selected = path?.constraints?.find((c) => c.id === this.selectedConstraintId);
        if (selected && Number.isInteger(Number(selected.legIndex)))
            return Math.max(0, Math.min(ver.locations.length - 2, Number(selected.legIndex)));
        if (this._manualTraceLegIndex != null)
            return Math.max(0, Math.min(ver.locations.length - 2, Number(this._manualTraceLegIndex)));
        return Math.max(0, ver.locations.length - 2);
    }
    _updateManualTraceButton() {
        const btn = this.overlay?.querySelector?.('[data-act="manual-trace"]');
        if (!btn)
            return;
        btn.textContent = this._manualTraceMode ? '✓ Fin tracé' : '✎ Tracé manuel';
        btn.classList.toggle('sv2-primary', !!this._manualTraceMode);
    }
    toggleManualTrace() {
        if (this._manualTraceMode) {
            this._manualTraceMode = false;
            this._manualTraceLegIndex = null;
            this._updateManualTraceButton();
            this._setHint('Tracé manuel terminé. Le trajet reste verrouillé par les VIA ORM ajoutés.');
            return;
        }
        const ver = this._activeVersion();
        if (!ver || ver.locations.length < 2) {
            this._setHint('Ajoutez d’abord une gare de départ et une destination.');
            return;
        }
        const leg = this._activeManualLegIndex();
        if (leg == null)
            return;
        this._manualTraceMode = true;
        this._manualTraceLegIndex = leg;
        this._viaNext = false;
        this._forcedConstraintLegIndex = null;
        this._technicalNext = false;
        if (this._engineOsmVisible)
            this._queueVisibleEngineOsm(true);
        const a = ver.locations[leg], b = ver.locations[leg + 1];
        this._updateManualTraceButton();
        this._setHint(`TRACÉ MANUEL ORM ${a?.name || '?'} → ${b?.name || '?'} : cliquez successivement les voies/aiguilles à imposer. Chaque clic reste sur le vrai graphe ORM.`);
    }
    async resetActiveLegToAutomatic() {
        const ver = this._activeVersion(), path = this._activePath();
        if (!ver || !path || ver.locations.length < 2)
            return;
        const leg = this._activeManualLegIndex();
        if (leg == null)
            return;
        const before = path.constraints.length;
        this._snapshot();
        this._markRecordChanged();
        path.constraints = path.constraints.filter((c) => Number(c.legIndex) !== Number(leg));
        path.constraints.forEach((x, i) => x.order = i);
        this.selectedConstraintId = null;
        this._manualTraceMode = false;
        this._manualTraceLegIndex = null;
        this._updateManualTraceButton();
        const a = ver.locations[leg], b = ver.locations[leg + 1];
        this._setHint(before === path.constraints.length ? `Segment ${a?.name || '?'} → ${b?.name || '?'} déjà automatique.` : `Retour AUTO ${a?.name || '?'} → ${b?.name || '?'} : recalcul ORM sans VIA imposé.`, true);
        await this._recomputeActivePath({ forceFreshRoute: true });
        this._autosaveSoon();
    }
    armVia() {
        const ver = this._activeVersion();
        if (!ver?.locations?.length) {
            this._setHint('Ajoutez d’abord une gare de départ.');
            return;
        }
        this._viaNext = true;
        this._setHint('MODE VIA : cliquez exactement sur la voie par laquelle le train doit passer. Aucun arrêt ne sera ajouté.');
    }
    prepareViaForLeg(legIndex) {
        const ver = this._activeVersion();
        const i = Number(legIndex);
        if (!ver || !Number.isInteger(i) || i < 0 || i >= ver.locations.length - 1)
            return;
        this._forcedConstraintLegIndex = i;
        this._viaNext = false;
        this._technicalNext = false;
        this._constraintEdit = null;
        this._manualTraceMode = false;
        this._manualTraceLegIndex = null;
        this._updateManualTraceButton();
        const a = ver.locations[i], b = ver.locations[i + 1];
        this._setHint(`INSÉRER VIA ${a?.name || '?'} → ${b?.name || '?'} : cliquez la voie de passage. Les deux arrêts restent en place et seul ce tronçon sera recalculé.`);
    }
    async _addConstraint(lat, lon, forcedOrder = null, forcedLegIndex = null) {
        const ver = this._activeVersion(), path = this._activePath();
        if (!ver.locations.length)
            return;
        let binding;
        try {
            binding = await this._exactTrackBinding(lat, lon, 'VIA');
        }
        catch (err) {
            this._error(err);
            return;
        }
        this._snapshot();
        this._markRecordChanged();
        // Free VIA clicks guide the NEXT leg after the current last stop. Forced/manual
        // VIA keep their explicit existing leg index.
        const defaultLeg = Math.max(0, ver.locations.length - 1);
        const rc = new RouteConstraint({ order: forcedOrder ?? path.constraints.length, lat, lon, wayId: binding.wayId, snapLat: binding.snapLat, snapLon: binding.snapLon, trackRef: binding.trackRef || '', segmentIndex: binding.segmentIndex ?? binding.osmSnapshot?.segmentIndex ?? null, osmSnapshot: clone(binding.osmSnapshot || null), legIndex: forcedLegIndex == null ? defaultLeg : Math.max(0, Number(forcedLegIndex)) });
        if (forcedOrder == null)
            path.constraints.push(rc);
        else
            path.constraints.splice(Math.max(0, Math.min(path.constraints.length, forcedOrder)), 0, rc);
        path.constraints.forEach((x, i) => x.order = i);
        this.selectedConstraintId = rc.id;
        this._setHint('VIA ajouté. Calcul du vrai tracé ferroviaire ORM…', true);
        this.draw();
        await this._recomputeActivePath();
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
    }
    async _addTechnicalStop(lat, lon) {
        const placeName = window.prompt('Nom du point technique (obligatoire) :', '');
        if (!placeName?.trim())
            return;
        const trackName = this._askTrackDisplayName('');
        if (!trackName)
            return;
        let binding;
        try {
            binding = await this._exactTrackBinding(lat, lon, trackName);
        }
        catch (err) {
            this._error(err);
            return;
        }
        this._snapshot();
        this._markRecordChanged();
        const tech = this.game.scheduleV2.addTechnicalLocation({ name: placeName.trim(), track: binding.toJSON() });
        const ver = this._activeVersion();
        ver.locations.push(new ScheduledLocation({ kind: LocationKind.TECHNICAL, technicalLocationId: tech.id, name: tech.name, track: binding.toJSON(), order: ver.locations.length, dwellSec: ver.locations.length ? 300 : 0 }));
        ver.normalize();
        await this._recomputeActivePath();
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
    }
    createTechnicalAtNextClick() { this._technicalNext = true; this._setHint('Cliquez la position exacte du point technique sur la carte.'); }
    _physicalAnchorKey(track) {
        return physicalAnchorKey(track);
    }
    _legRouteInputKey(ver, path, legIndex) {
        return legRouteInputKey(ver, path, legIndex);
    }
    _suggestStopInsertIndex(st) {
        const ver = this._activeVersion();
        if (!ver || ver.locations.length < 2)
            return ver?.locations?.length || 0;
        const p = { lat: Number(st?.lat), lon: Number(st?.lon) };
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon))
            return ver.locations.length;
        let bestIndex = ver.locations.length, bestScore = Infinity;
        for (let i = 0; i < ver.locations.length - 1; i++) {
            const ta = ver.locations[i]?.track, tb = ver.locations[i + 1]?.track;
            const a = { lat: Number(ta?.snapLat ?? ta?.lat), lon: Number(ta?.snapLon ?? ta?.lon) }, b = { lat: Number(tb?.snapLat ?? tb?.lat), lon: Number(tb?.snapLon ?? tb?.lon) };
            if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite))
                continue;
            // Extra distance caused by inserting the station between this pair.
            const score = routeGapKm(a, p) + routeGapKm(p, b) - routeGapKm(a, b);
            if (score < bestScore) {
                bestScore = score;
                bestIndex = i + 1;
            }
        }
        return bestIndex;
    }
    _remapConstraintsForInsertedStop(path, verBefore, insertIndex, newLoc) {
        if (!path || !verBefore.length || !Number.isInteger(insertIndex) || insertIndex < 0 || insertIndex >= verBefore.length)
            return;
        if (insertIndex === 0) {
            // A new origin prepends a leg; all existing (and pending preview) VIA
            // remain attached to their original railway pair, now one index later.
            for (const q of path.constraints || [])
                q.legIndex++;
            return;
        }
        const splitLeg = insertIndex - 1, a = verBefore[splitLeg], b = verBefore[splitLeg + 1];
        const ordered = (path.constraints || []).filter(q => q.legIndex === splitLeg).sort((x, y) => x.order - y.order);
        const oldLeg = path.legs?.find(l => l.fromLocationId === a.id && l.toLocationId === b.id);
        let cut = oldLeg?.routePoints?.length ? constraintSplitOnRailway(oldLeg.routePoints, ordered, newLoc.track) : null;
        if (cut == null) {
            // Unresolved/off-route insert: retain the VIA sequence with ONE partition,
            // not independent choices that reorder a loop. No point is dropped.
            const ap = railAnchorPosition(a.track), bp = railAnchorPosition(b.track), cp = railAnchorPosition(newLoc.track);
            cut = ordered.length;
            if (ap && bp && cp) {
                const before = [], after = [];
                for (const q of ordered) {
                    const p = railAnchorPosition(q);
                    before.push(p ? routeGapKm(ap, p) + routeGapKm(p, cp) - routeGapKm(ap, cp) : 0);
                    after.push(p ? routeGapKm(cp, p) + routeGapKm(p, bp) - routeGapKm(cp, bp) : 0);
                }
                let score = after.reduce((sum, x) => sum + x, 0), best = score;
                cut = 0;
                for (let i = 0; i < ordered.length; i++) {
                    score += before[i] - after[i];
                    if (score < best) {
                        best = score;
                        cut = i + 1;
                    }
                }
            }
        }
        for (const q of path.constraints || [])
            if (q.legIndex > splitLeg)
                q.legIndex++;
        const splitAt = cut ?? ordered.length;
        ordered.forEach((q, i) => q.legIndex = i < splitAt ? splitLeg : splitLeg + 1);
        path.constraints.sort((x, y) => x.legIndex - y.legIndex || x.order - y.order);
        path.constraints.forEach((q, i) => q.order = i);
    }
    _constraintsForLeg(path, legIndex) { if (!path)
        return []; return (path.constraints || []).filter((c) => c.legIndex === legIndex).sort((a, b) => a.order - b.order); }
    async _resolveLeg(ver, path, fromIndex, toIndex, resolvedStart = null, routeOptions = {}) {
        const a = ver.locations[fromIndex], b = ver.locations[toIndex];
        if (!a || !b)
            return null;
        const constraints = this._constraintsForLeg(path, fromIndex);
        const routeInputKey = this._legRouteInputKey(ver, path, fromIndex);
        const startBinding = resolvedStart ? { ...a.track, lat: resolvedStart.lat, lon: resolvedStart.lon, snapLat: resolvedStart.lat, snapLon: resolvedStart.lon, wayId: resolvedStart.wayId || a.track?.wayId || '' } : a.track;
        const route = await this.router.routeBetweenBindings(startBinding, b.track, constraints, this._routingOptions(ver, routeOptions));
        const resolved = route?._resolvedAnchors || [];
        const requested = [a.track, ...constraints, b.track];
        const anchorUpdates = [];
        if (resolved.length === requested.length) {
            for (let i = 0; i < resolved.length; i++) {
                const r = resolved[i], target = requested[i];
                if (target && r)
                    anchorUpdates.push({ target, r });
            }
        }
        const snap = this.router.snapshotRoute(route);
        if (!snap.routePoints?.length || snap.routePoints.length < 2) {
            const err = new Error('Liaison ORM vide pendant le recalcul.');
            err.code = 'ORM_EMPTY_ROUTE';
            throw err;
        }
        return { leg: { id: `leg-${a.id}-${b.id}`, fromLocationId: a.id, toLocationId: b.id, constraintIds: constraints.map((c) => c.id), routeInputKey, physicsRouteKey: physicsRouteKey(routeInputKey, this.game?.orm?._topologyEpoch, snap.routePoints.length, snap.distanceKm), routePoints: snap.routePoints, segments: snap.segments, distanceKm: snap.distanceKm }, anchorUpdates };
    }
    async _recomputeActivePath({ topologyChanged = true, forceFreshRoute = false } = {}) {
        const ver = this._activeVersion(), path = this._activePath();
        if (!ver || !path)
            return false;
        try {
            this._routeAbortController?.abort?.();
        }
        catch { }
        const routeController = new AbortController();
        this._routeAbortController = routeController;
        this._routeGeneration = Number(this._routeGeneration || 0) + 1;
        const generation = this._routeGeneration;
        const versionId = ver.id, pathId = path.id;
        if (topologyChanged)
            path.topologyRevision = Math.max(0, Number(path.topologyRevision || 0)) + 1;
        const hadResolvedRoute = Array.isArray(path.routePoints) && path.routePoints.length >= 2 && Array.isArray(path.legs) && path.legs.length > 0;
        this.busy = true;
        this._setHint('Calcul du tracé ferroviaire ORM…', true);
        const stillCurrent = () => generation === this._routeGeneration && this._activeVersion()?.id === versionId && this._activePath()?.id === pathId && !routeController.signal.aborted;
        const legs = [];
        const anchorUpdates = [];
        let resolvedStart = null;
        try {
            const existingByPair = new Map((path.legs || []).map((l) => [`${l.fromLocationId}>${l.toLocationId}`, l]));
            for (let i = 0; i < ver.locations.length - 1; i++) {
                const a = ver.locations[i], b = ver.locations[i + 1], key = this._legRouteInputKey(ver, path, i);
                const cached = existingByPair.get(`${a.id}>${b.id}`);
                const cacheContinuous = !legs.length || routeGapKm(legs.at(-1).routePoints.at(-1), cached?.routePoints?.[0]) <= 0.002;
                let leg = null, resolvedLeg = null;
                if (!forceFreshRoute && cached?.routeInputKey === key && cached.routePoints?.length >= 2 && cached.segments?.length === cached.routePoints.length - 1 && cacheContinuous) {
                    leg = cached;
                }
                else {
                    resolvedLeg = await this._resolveLeg(ver, path, i, i + 1, resolvedStart, { forceFreshRoute });
                    if (!stillCurrent())
                        return false;
                    if (!resolvedLeg?.leg)
                        throw new Error('Segment ORM introuvable.');
                    leg = resolvedLeg.leg;
                    anchorUpdates.push(...(resolvedLeg.anchorUpdates || []));
                }
                if (legs.length && routeGapKm(legs.at(-1).routePoints.at(-1), leg.routePoints[0]) > 0.002) {
                    // A preceding edited leg moved the physical join: recalculate this leg
                    // once instead of invalidating the whole A→B journey.
                    resolvedLeg = await this._resolveLeg(ver, path, i, i + 1, legs.at(-1).routePoints.at(-1), { forceFreshRoute });
                    if (!stillCurrent())
                        return false;
                    leg = resolvedLeg?.leg ?? null;
                    if (!leg)
                        throw new Error('Segment ORM introuvable.');
                    anchorUpdates.push(...(resolvedLeg.anchorUpdates || []));
                    if (routeGapKm(legs.at(-1).routePoints.at(-1), leg.routePoints[0]) > 0.002) {
                        const e = new Error('Discontinuité dans les données ferroviaires locales entre deux tronçons du trajet.');
                        e.code = 'ORM_CHAIN_GAP';
                        throw e;
                    }
                }
                legs.push(leg);
                resolvedStart = leg.routePoints.at(-1) || null;
            }
            if (!stillCurrent())
                return false;
            for (const u of anchorUpdates) {
                u.target.snapLat = Number(u.r.lat);
                u.target.snapLon = Number(u.r.lon);
                if (u.r.wayId)
                    u.target.wayId = String(u.r.wayId);
                if (Number.isFinite(Number(u.r.segmentIndex)))
                    u.target.segmentIndex = Number(u.r.segmentIndex);
            }
            // The router may refine the snapped anchors. Sign the committed inputs,
            // not the pre-snap request, otherwise the next metadata edit reroutes again.
            for (let i = 0; i < legs.length; i++) {
                const key = this._legRouteInputKey(ver, path, i), leg = legs[i];
                if (leg.routeInputKey !== key) {
                    leg.routeInputKey = key;
                    leg.physicsRouteKey = physicsRouteKey(key, this.game?.orm?._topologyEpoch, leg.routePoints.length, leg.distanceKm);
                }
            }
            assignResolvedLegsToPath(path, legs, { validatedAt: new Date().toISOString(), resolvedRevision: Number(path.topologyRevision || 0), error: '' });
            const last = ver.locations.at(-1);
            const pend = this._constraintsForLeg(path, Math.max(0, ver.locations.length - 1));
            if (last && pend.length) {
                const end = pend.at(-1);
                if (!end)
                    throw new Error('VIA terminal introuvable.');
                const pseudo = new TrackBinding({ wayId: end.wayId || '', lat: end.lat, lon: end.lon, snapLat: end.snapLat, snapLon: end.snapLon, segmentIndex: end.segmentIndex ?? null, displayName: 'VIA', osmSnapshot: clone(end.osmSnapshot || null) });
                const route = await this.router.routeBetweenBindings(last.track, pseudo, pend.slice(0, -1), this._routingOptions(ver));
                if (stillCurrent())
                    this._setActivePreview(route);
            }
            else if (stillCurrent())
                this._setActivePreview([]);
            if (!stillCurrent())
                return false;
            recalculateScheduleTiming(ver, { firstDepartureSec: ver.locations[0]?.departureSec ?? 8 * 3600, weather: 'clear' });
            ver.validationReport = validateScheduleVersion(ver, { ormAvailable: true });
            return this._reportCanProceedToValidation(ver.validationReport);
        }
        catch (err) {
            if (err?.name === 'AbortError' || err?.code === 'ROUTE_CANCELLED' || routeController.signal.aborted)
                return false;
            if (!stillCurrent())
                return false;
            const failure = String(this.game?.orm?._lastCursorRouteFailure || '');
            const localDataFailure = ['RAILGRAPH_DATA_MISSING', 'SOURCE_TOPOLOGY_GAP', 'NETWORK_UNAVAILABLE', 'TIME_BUDGET'].includes(failure) || ['RAILGRAPH_DATA_MISSING', 'ORM_SOURCE_TOPOLOGY_GAP', 'ORM_LOCAL_ROUTE_UNRESOLVED', 'ORM_NETWORK_UNAVAILABLE', 'ORM_TIME_BUDGET'].includes(String(err?.code || ''));
            if (failure === 'RAILGRAPH_MEMORY_BUDGET_EXCEEDED' || String(err?.code || '') === 'RAILGRAPH_MEMORY_BUDGET_EXCEEDED') {
                path.error = err?.message || String(err);
                ver.validationReport = validateScheduleVersion(ver, { ormAvailable: true });
                this._setActivePreview([]);
                this._setHint('Mémoire RailGraph plafonnée : calcul exact interrompu avant OOM, sans simplifier le réseau.', true);
                this._error(err);
                return false;
            }
            if (localDataFailure && hadResolvedRoute) {
                if (topologyChanged) {
                    path.error = err?.message || String(err);
                    ver.validationReport = validateScheduleVersion(ver, { ormAvailable: true });
                    this._setHint('Graphe ferroviaire ORM local incomplet autour de la modification : ancien tracé conservé visuellement, recalcul requis.', true);
                }
                else {
                    path.error = '';
                    ver.validationReport = validateScheduleVersion(ver, { ormAvailable: true });
                    this._setHint('Données locales temporairement indisponibles : dernier tracé ORM valide conservé.', true);
                }
                this._setActivePreview([]);
                this._error(err);
                return !topologyChanged && this._reportCanProceedToValidation(ver.validationReport);
            }
            if (legs.length) {
                assignResolvedLegsToPath(path, legs, { validatedAt: null, resolvedRevision: Math.max(0, Number(path.topologyRevision || 0) - 1), error: err?.message || String(err) });
            }
            else if (!hadResolvedRoute) {
                path.clearResolvedRoute?.();
                path.error = err?.message || String(err);
            }
            else
                path.error = err?.message || String(err);
            ver.validationReport = validateScheduleVersion(ver, { ormAvailable: true });
            this._setActivePreview([]);
            this._error(err);
            return false;
        }
        finally {
            if (this._routeAbortController === routeController)
                this._routeAbortController = null;
            if (generation === this._routeGeneration && this._activeVersion()?.id === versionId && this._activePath()?.id === pathId) {
                this.busy = false;
                if (this._engineOsmVisible)
                    this._queueVisibleEngineOsm(true);
                this.renderPanel();
                this.draw();
            }
        }
    }
    _routeCompatibilityErrors(report) {
        const codes = new Set(['ELECTRIC_INCOMPATIBLE', 'GAUGE_INCOMPATIBLE', 'LOADING_GAUGE_INCOMPATIBLE', 'AXLE_LOAD_INCOMPATIBLE', 'METRE_LOAD_INCOMPATIBLE']);
        return (report?.errors || []).some((x) => codes.has(x.code));
    }
    _pathStructurallyCurrent(ver, path) {
        if (!ver || !path || ver.locations?.length < 2)
            return false;
        if (path.error || Number(path.resolvedRevision || 0) !== Number(path.topologyRevision || 0))
            return false;
        if (!Array.isArray(path.routePoints) || path.routePoints.length < 2)
            return false;
        if (!Array.isArray(path.legs) || path.legs.length !== ver.locations.length - 1)
            return false;
        for (let i = 0; i < ver.locations.length - 1; i++) {
            const a = ver.locations[i], b = ver.locations[i + 1], leg = path.legs[i];
            if (!leg || leg.fromLocationId !== a.id || leg.toLocationId !== b.id || !Array.isArray(leg.routePoints) || leg.routePoints.length < 2)
                return false;
            // Structural geometry alone cannot prove this is the route selected for
            // the current traction/gauge/load profile (a less restrictive train may
            // have a shorter usable path). Old unsigned caches must also be rerouted.
            if (leg.routeInputKey !== this._legRouteInputKey(ver, path, i))
                return false;
            const expected = this._constraintsForLeg(path, i).map((c) => String(c.id)), actual = (leg.constraintIds || []).map(String);
            if (expected.length !== actual.length || expected.some((id, j) => id !== actual[j]))
                return false;
        }
        return true;
    }
    _retimeCurrentPath(ver) {
        if (!this._pathStructurallyCurrent(ver, ver?.outboundPath))
            return null;
        recalculateScheduleTiming(ver, { firstDepartureSec: ver.locations[0]?.departureSec ?? 8 * 3600, weather: 'clear' });
        const report = validateScheduleVersion(ver, { ormAvailable: true });
        ver.validationReport = report;
        return report;
    }
    async _ensureActivePathReady() {
        const ver = this._activeVersion();
        if (!ver)
            return false;
        const report = this._retimeCurrentPath(ver);
        if (report && !this._routeCompatibilityErrors(report))
            return this._reportCanProceedToValidation(report);
        return this._recomputeActivePath({ topologyChanged: false });
    }
    async _recomputeBoth() {
        const old = this.mode;
        let ok = true;
        try {
            this.mode = PathDirection.OUTBOUND;
            ok = (await this._ensureActivePathReady()) && ok;
            if (this.returnVersion) {
                this.mode = PathDirection.RETURN;
                ok = (await this._ensureActivePathReady()) && ok;
            }
            return ok;
        }
        catch (err) {
            this._error(err);
            return false;
        }
        finally {
            this.mode = old;
            this.renderPanel();
        }
    }
    prepareConstraintEdit(mode) {
        const path = this._activePath();
        const target = path?.constraints?.find((c) => c.id === this.selectedConstraintId);
        if (!target) {
            this._setHint('Sélectionnez d’abord un point VIA sur la carte.');
            return;
        }
        this._constraintEdit = { mode, targetId: target.id };
        this._setHint(mode === 'MOVE' ? 'Cliquez la nouvelle position du VIA sur la carte.' : mode === 'INSERT_BEFORE' ? 'Cliquez la position du nouveau VIA à insérer avant.' : 'Cliquez la position du nouveau VIA à insérer après.');
    }
    async _applyConstraintEditAt(lat, lon) {
        const edit = this._constraintEdit;
        this._constraintEdit = null;
        if (!edit)
            return;
        const path = this._activePath();
        const idx = path?.constraints?.findIndex((c) => c.id === edit.targetId) ?? -1;
        if (idx < 0)
            return;
        let binding;
        try {
            binding = await this._exactTrackBinding(lat, lon, 'VIA');
        }
        catch (err) {
            this._error(err);
            return;
        }
        this._snapshot();
        this._markRecordChanged();
        const target = path.constraints[idx];
        if (edit.mode === 'MOVE') {
            target.lat = lat;
            target.lon = lon;
            target.wayId = binding.wayId;
            target.snapLat = binding.snapLat;
            target.snapLon = binding.snapLon;
            target.trackRef = binding.trackRef || '';
            target.segmentIndex = binding.segmentIndex ?? binding.osmSnapshot?.segmentIndex ?? null;
            target.osmSnapshot = clone(binding.osmSnapshot || null);
            this.selectedConstraintId = target.id;
        }
        else {
            const rc = new RouteConstraint({ lat: lat, lon: lon, wayId: binding.wayId, snapLat: binding.snapLat, snapLon: binding.snapLon, trackRef: binding.trackRef || '', segmentIndex: binding.segmentIndex ?? binding.osmSnapshot?.segmentIndex ?? null, osmSnapshot: clone(binding.osmSnapshot || null), legIndex: target.legIndex });
            const pos = edit.mode === 'INSERT_BEFORE' ? idx : idx + 1;
            path.constraints.splice(pos, 0, rc);
            this.selectedConstraintId = rc.id;
        }
        path.constraints.forEach((x, i) => x.order = i);
        await this._recomputeActivePath();
        this._autosaveSoon();
    }
    deleteLastPoint() { const path = this._activePath(); if (!path?.constraints.length)
        return; this._snapshot(); this._markRecordChanged(); path.constraints.pop(); path.constraints.forEach((c, i) => c.order = i); this.selectedConstraintId = null; this._recomputeActivePath().then(() => this._autosaveSoon()); }
    deleteSelectedConstraint() { const path = this._activePath(); if (!path || !this.selectedConstraintId)
        return; const idx = path.constraints.findIndex((c) => c.id === this.selectedConstraintId); if (idx < 0)
        return; this._snapshot(); this._markRecordChanged(); path.constraints.splice(idx, 1); path.constraints.forEach((c, i) => c.order = i); this.selectedConstraintId = null; this._recomputeActivePath().then(() => this._autosaveSoon()); }
    async beginReturn() {
        if (this.returnRecord) {
            this.mode = PathDirection.RETURN;
            this.renderPanel();
            this.draw();
            if (!this.returnVersion?.locations?.length) {
                const terminal = this.version?.locations?.at(-1);
                if (terminal) {
                    this.pendingStation = { action: 'ADD', station: { id: terminal.stationId || terminal.technicalLocationId || '', name: terminal.name }, kind: terminal.kind, defaultName: terminal.track?.displayName || '' };
                    this._setHint(`RETOUR VERT : ${terminal.name} est le point de départ. Cliquez sa voie de départ exacte.`);
                }
            }
            else
                this._setHint('RETOUR VERT : cliquez + VIA pour guider le trajet ou une gare pour ajouter un arrêt.');
            return;
        }
        if (!this.version.locations.length) {
            this._setHint('Créez d’abord l’aller.');
            return;
        }
        if (this.version.locations.length < 2) {
            this._setHint('Ajoutez au moins le terminus de l’aller avant de créer le retour.');
            return;
        }
        this._snapshot();
        const baseNum = this.record.number || '';
        const m = baseNum.match(/^(.*?)(\d+)$/);
        let retNum = baseNum;
        if (m)
            retNum = m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
        this.returnRecord = this.game.scheduleV2.createDraft({ number: retNum, name: this.record.name ? `${this.record.name} — retour` : 'Retour', category: this.version.category, maxSpeed: this.version.performanceProfile.maxSpeed, calendarIds: [...(this.version.calendarIds || [])] });
        this.returnVersion = this.returnRecord.currentVersion;
        this.returnVersion.performanceProfile = new PerformanceProfile(this.version.performanceProfile.toJSON());
        this.roundTripGroup = new RoundTripGroup({ outboundScheduleId: this.record.id, returnScheduleId: this.returnRecord.id, terminalLayoverSec: 300 });
        this.game.scheduleV2.roundTrips.push(this.roundTripGroup);
        this.mode = PathDirection.RETURN;
        const terminal = this.version.locations.at(-1);
        this.pendingStation = { action: 'ADD', station: { id: terminal.stationId || terminal.technicalLocationId || '', name: terminal.name }, kind: terminal.kind, defaultName: terminal.track?.displayName || '' };
        this.renderPanel();
        this.draw();
        this._setHint(`RETOUR VERT : départ ${terminal.name}. Cliquez maintenant la voie de départ exacte, puis guidez le retour avec + VIA.`);
        this._autosaveSoon();
    }
    _applyCoreFields() {
        const rec = this._activeRecord(), ver = this._activeVersion();
        if (!rec || !ver)
            return;
        const electricSystems = parseElectricSystems(this.panelContent.querySelector('[data-f="electricSystems"]')?.value ?? formatElectricSystems(ver.performanceProfile.electricSystems));
        const gauges = parseGauges(this.panelContent.querySelector('[data-f="gauges"]')?.value ?? (ver.performanceProfile.gauges || []).join(';'));
        rec.number = this.panelContent.querySelector('[data-f="number"]')?.value ?? rec.number;
        rec.name = this.panelContent.querySelector('[data-f="name"]')?.value ?? rec.name;
        const cat = this.panelContent.querySelector('[data-f="category"]')?.value;
        if (cat && cat !== ver.category) {
            ver.category = cat;
            ver.performanceProfile = PerformanceProfile.genericForCategory(cat, ver.performanceProfile.maxSpeed);
        }
        const mode = this.panelContent.querySelector('[data-f="perfMode"]')?.value;
        if (mode === PerformanceMode.LINE_MAX_SPEED) {
            const vmax = Number(this.panelContent.querySelector('[data-f="vmax"]')?.value || 160);
            ver.performanceProfile = PerformanceProfile.genericForCategory(ver.category, vmax);
        }
        else if (mode === PerformanceMode.REFERENCE_COMPOSITION) {
            const rid = this.panelContent.querySelector('[data-f="referenceRame"]')?.value;
            const rame = this.game.rameManager.getById?.(rid) || this.game.rameManager.rames?.find((r) => r.id === rid);
            if (rame)
                ver.performanceProfile = PerformanceProfile.fromLegacyRame(rame, ver.category);
        }
        if (mode === PerformanceMode.REFERENCE_COMPOSITION) {
            ver.performanceProfile.electricSystems = electricSystems;
            ver.performanceProfile.gauges = gauges;
        }
    }
    _applySillonMaxSpeed(rawValue) {
        const ver = this._activeVersion();
        if (!ver)
            return false;
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            this._showTransientAlert('red', 'Vmax du sillon invalide.');
            return false;
        }
        this._snapshot();
        this._markRecordChanged();
        const vmax = applyLineMaxSpeedToVersion(ver, parsed);
        try {
            const report = this._retimeCurrentPath(ver);
            if (report) {
                this._setHint(`Vmax du sillon appliquée : ${vmax} km/h — temps de parcours recalculé.`);
                this.renderPanel();
                this.draw();
                this._autosaveSoon();
                this.game?._forceV2RuntimeSyncNow?.();
                return true;
            }
        }
        catch (err) {
            console.warn('Retiming Vmax sillon:', err);
        }
        this._recomputeActivePath({ topologyChanged: false }).then(() => {
            this._setHint(`Vmax du sillon appliquée : ${vmax} km/h — temps de parcours recalculé.`);
            this._autosaveSoon();
            this.game?._forceV2RuntimeSyncNow?.();
        });
        return true;
    }
    _bindPanelEvents() {
        // Metadata edits must never rebuild/reroute the Schedule Creator. In v1.1.49
        // number/name shared the generic physical-field handler, so leaving the input
        // launched an ORM recomputation whose final render collapsed every <details>.
        this.panelContent.querySelectorAll('[data-f="number"],[data-f="name"]').forEach((el) => {
            el.addEventListener('input', () => {
                const rec = this._activeRecord();
                if (!rec)
                    return;
                if (el.dataset.f === 'number')
                    rec.number = el.value;
                else
                    rec.name = el.value;
                this._updateHeader();
                this._autosaveSoon();
            });
            // Metadata does not invalidate railway geometry, but the runtime/list/rotation
            // views must not keep an old train number/name until the next unrelated edit.
            el.addEventListener('change', () => { const rec = this._activeRecord(); if (!rec)
                return; this._queueRotationRecalc(rec.id); this._autosaveSoon(); this.game?._forceV2RuntimeSyncNow?.(); });
        });
        this.panelContent.querySelectorAll('[data-f]:not([data-f="number"]):not([data-f="name"]):not([data-f="vmax"])').forEach((el) => el.addEventListener('change', () => { this._snapshot(); this._markRecordChanged(); this._applyCoreFields(); const v = this._activeVersion(); try {
            const report = this._retimeCurrentPath(v);
            if (report && !this._routeCompatibilityErrors(report)) {
                this.renderPanel();
                this.draw();
                this._autosaveSoon();
                return;
            }
        }
        catch { } this._recomputeActivePath({ topologyChanged: false }).then(() => this._autosaveSoon()); }));
        const vmaxInput = this.panelContent.querySelector('[data-f="vmax"]');
        vmaxInput?.addEventListener('change', () => this._applySillonMaxSpeed(vmaxInput.value));
        vmaxInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') {
            e.preventDefault();
            this._applySillonMaxSpeed(vmaxInput.value);
        } });
        this.panelContent.querySelector('[data-apply-vmax]')?.addEventListener('click', () => this._applySillonMaxSpeed(vmaxInput?.value));
        this.panelContent.querySelectorAll('[data-stop]').forEach((el) => el.addEventListener('change', (e) => this._handleStopField(e)));
        this.panelContent.querySelectorAll('[data-remove-stop]').forEach((el) => el.addEventListener('click', () => this.removeStop(el.dataset.removeStop)));
        this.panelContent.querySelectorAll('[data-change-track]').forEach((el) => el.addEventListener('click', () => this._changeLocationTrack(el.dataset.changeTrack)));
        this.panelContent.querySelectorAll('[data-rename-track]').forEach((el) => el.addEventListener('click', () => this._renameTrackDisplay(el.dataset.renameTrack)));
        this.panelContent.querySelectorAll('[data-replace-station]').forEach((el) => el.addEventListener('click', () => this.prepareStationReplacement(el.dataset.replaceStation)));
        this.panelContent.querySelectorAll('[data-via-before-stop]').forEach((el) => el.addEventListener('click', () => this.prepareViaForLeg(Number(el.dataset.viaBeforeStop) - 1)));
        this.panelContent.querySelectorAll('[data-via-between]').forEach((el) => el.addEventListener('click', () => this.prepareViaForLeg(Number(el.dataset.viaBetween))));
        this.panelContent.querySelectorAll('[data-select-via]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.selectVia, path = this._activePath(); if (!path?.constraints?.some((c) => c.id === id))
            return; this.selectedConstraintId = id; this._setHint('VIA sélectionné : vous pouvez le déplacer, insérer avant/après ou le supprimer.'); this.renderPanel(); this.draw(); }));
        this.panelContent.querySelector('[data-new-version]')?.addEventListener('click', () => this._createVersion());
        this.panelContent.querySelector('[data-version-select]')?.addEventListener('change', (e) => this._switchVersion(e.target.value));
        this.panelContent.querySelectorAll('[data-cal-check]').forEach((el) => el.addEventListener('change', (e) => this._setCalendarChecked(e.target.dataset.calCheck, e.target.checked)));
        this.panelContent.querySelector('[data-manage-calendars]')?.addEventListener('click', () => this.showCalendarManager());
        this.panelContent.querySelector('[data-switch-direction]')?.addEventListener('click', () => { this.mode = this.mode === PathDirection.OUTBOUND ? PathDirection.RETURN : PathDirection.OUTBOUND; this.renderPanel(); this.draw(); });
        this.panelContent.querySelector('[data-layover]')?.addEventListener('change', (e) => { if (!this.roundTripGroup)
            return; this._snapshot(); if (this.returnRecord && this.returnVersion)
            this._markRecordChanged(this.returnRecord, this.returnVersion); this.roundTripGroup.terminalLayoverSec = Math.max(0, Number(e.target.value || 0) * 60); this._syncReturnStart(); this._autosaveSoon(); });
        this.panelContent.querySelector('[data-return-name]')?.addEventListener('change', (e) => this._setReturnName(e.target.value));
        this.panelContent.querySelector('[data-quick-rame]')?.addEventListener('change', (e) => this._setReferenceRame(e.target.value));
        this.panelContent.querySelector('[data-duplicate-ar]')?.addEventListener('click', () => this._duplicateRoundTripDialog());
        this.panelContent.querySelector('[data-add-tech-existing]')?.addEventListener('click', () => this._addExistingTechnical(this.panelContent.querySelector('[data-tech-existing]')?.value));
        this.panelContent.querySelector('[data-del-tech-existing]')?.addEventListener('click', () => this._deleteTechnicalLocation(this.panelContent.querySelector('[data-tech-existing]')?.value));
    }
    _setReturnName(value) {
        if (!this.returnRecord || !this.returnVersion)
            return false;
        this._snapshot();
        this.returnRecord.name = String(value || '');
        this._queueRotationRecalc(this.returnRecord.id);
        this._autosaveSoon();
        this.game?._forceV2RuntimeSyncNow?.();
        this._updateHeader();
        return true;
    }
    _setReferenceRame(rameId) {
        const rid = String(rameId || '');
        if (!rid)
            return false;
        const rame = this.game.rameManager.getById?.(rid) || this.game.rameManager.getAll?.().find((r) => r.id === rid);
        if (!rame)
            return false;
        this._snapshot();
        this._markRecordChanged();
        const v = this._activeVersion();
        v.performanceProfile = PerformanceProfile.fromLegacyRame(rame, v.category);
        try {
            const report = this._retimeCurrentPath(v);
            if (report && !this._routeCompatibilityErrors(report)) {
                this.renderPanel();
                this.draw();
                this._autosaveSoon();
                return true;
            }
        }
        catch { }
        this._recomputeActivePath({ topologyChanged: false }).then(() => this._autosaveSoon());
        return true;
    }
    _deleteTechnicalLocation(technicalLocationId) {
        if (!technicalLocationId)
            return;
        const tech = this.game.scheduleV2.technicalLocations.find((t) => t.id === technicalLocationId);
        if (!tech)
            return;
        const probe = this.game.scheduleV2.removeTechnicalLocation(technicalLocationId, { cascade: false });
        if (!probe.ok) {
            const refs = probe.references || [];
            if (!confirm(`Le point technique « ${tech.name} » est utilisé ${refs.length} fois.\n\nLe supprimer quand même ? Les horaires concernés passeront À RÉPARER.`))
                return;
            this.game.scheduleV2.removeTechnicalLocation(technicalLocationId, { cascade: true });
        }
        this.game.saveState();
        this.game._forceV2RuntimeSyncNow?.();
        this.renderPanel();
        this.draw();
        this.ui?.renderSchedulesList?.();
    }
    async _addExistingTechnical(technicalLocationId) {
        if (!technicalLocationId)
            return;
        const tech = this.game.scheduleV2.technicalLocations.find((t) => t.id === technicalLocationId);
        const ver = this._activeVersion();
        if (!tech || !ver)
            return;
        if (!ver.locations.length) {
            this._error(new Error('Commencez par une gare de départ.'));
            return;
        }
        this._snapshot();
        this._markRecordChanged();
        ver.locations.push(new ScheduledLocation({ kind: LocationKind.TECHNICAL, technicalLocationId: tech.id, name: tech.name, track: tech.track.toJSON(), order: ver.locations.length, dwellSec: 300 }));
        ver.normalize();
        await this._recomputeActivePath();
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
    }
    _duplicateRoundTripDialog() {
        if (!this.roundTripGroup || !this.returnVersion)
            return;
        if (this.version.state !== ScheduleState.VALID || this.returnVersion.state !== ScheduleState.VALID) {
            this._error(new Error('Validez l’aller et le retour avant de les dupliquer.'));
            return;
        }
        const old = document.getElementById('sv2-ar-duplicate-modal');
        if (old)
            old.remove();
        const rotations = this.game.rotationV2?.rotations || [];
        const m = document.createElement('div');
        m.id = 'sv2-ar-duplicate-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9300;background:#000a;display:flex;align-items:center;justify-content:center';
        const base = this.version.firstDepartureSec || 0;
        m.innerHTML = `<div style="width:min(520px,92vw);background:#0d1928;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">Dupliquer l’aller-retour</h3><div class="sv2-field"><label>Mode</label><select id="sv2-ar-mode"><option value="FREQUENCY">Fréquence</option><option value="NEXT">Heure du prochain aller</option></select></div><div class="sv2-grid"><div class="sv2-field"><label>Fréquence (min)</label><input id="sv2-ar-freq" type="number" min="1" value="60"></div><div class="sv2-field"><label>Prochain aller</label><input id="sv2-ar-next" value="${htmlText(formatScheduleClock(base + 3600))}"></div></div><div class="sv2-field"><label>Fenêtre de génération (h, max 24)</label><input id="sv2-ar-horizon" type="number" min="1" max="24" value="24"></div><div class="sv2-field"><label>Ajouter directement au roulement</label><select id="sv2-ar-rotation"><option value="">Non</option>${rotations.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></div><p style="color:#9db0c8">Numérotation : +1 au retour, +2 au prochain aller. Tous les numéros restent modifiables.</p><div style="display:flex;justify-content:flex-end;gap:6px"><button class="sv2-btn" data-close-ar>Annuler</button><button class="sv2-btn sv2-primary" id="sv2-ar-create">Dupliquer</button></div></div>`;
        document.body.appendChild(m);
        m.querySelector('[data-close-ar]').onclick = () => m.remove();
        m.addEventListener('click', (e) => { if (e.target === m)
            m.remove(); });
        m.querySelector('#sv2-ar-create').onclick = () => { try {
            const mode = m.querySelector('#sv2-ar-mode').value, hours = Math.max(1, Math.min(24, Number(m.querySelector('#sv2-ar-horizon').value || 24)));
            const options = { horizonSec: hours * 3600, rotationId: m.querySelector('#sv2-ar-rotation').value };
            if (mode === 'NEXT') {
                const next = parseScheduleClock(m.querySelector('#sv2-ar-next').value, base);
                if (next == null || next <= base)
                    throw new Error('Heure du prochain aller invalide.');
                options.nextDepartureSec = next;
                options.intervalSec = next - base;
            }
            else
                options.intervalSec = Math.max(60, Number(m.querySelector('#sv2-ar-freq').value || 60) * 60);
            const made = this.game.scheduleV2.duplicateRoundTrip(this.roundTripGroup.id, options, this.game.rotationV2);
            this.game.saveState();
            m.remove();
            this.ui?.renderSchedulesList?.();
            this._showTransientAlert('yellow', `${made.length} aller-retour dupliqué(s).`);
        }
        catch (err) {
            alert(err.message);
        } };
    }
    _handleStopField(e) {
        const [id, field] = e.target.dataset.stop.split(':');
        const ver = this._activeVersion(), loc = ver.locations.find((x) => x.id === id);
        if (!loc)
            return;
        this._snapshotTiming();
        this._markRecordChanged();
        if (field === 'dwell') {
            loc.dwellSec = Math.max(0, Number(e.target.value || 0) * 60);
            if (loc.turnBack && loc.dwellSec < 300) {
                this._error(new Error(`${loc.name}: TAQ = 5 minutes minimum.`));
            }
        }
        if (field === 'code') {
            loc.stopCode = e.target.value;
            if (loc.turnBack && isOptionalStopCode(loc.stopCode)) {
                loc.stopCode = StopCode.NONE;
                this._error(new Error('TAQ incompatible avec [C]/[S].'));
            }
        }
        if (field === 'taq') {
            loc.turnBack = e.target.checked;
            if (loc.turnBack && isOptionalStopCode(loc.stopCode))
                loc.stopCode = StopCode.NONE;
            if (loc.turnBack && loc.dwellSec < 300)
                this._error(new Error(`${loc.name}: TAQ = 5 minutes minimum. Augmentez le temps d’arrêt avant validation.`));
        }
        if (field === 'arr') {
            if (!String(e.target.value || '').trim())
                loc.clearManualArrival();
            else {
                const first = loc.order === 0, prev = first ? 0 : (ver.locations[Math.max(0, loc.order - 1)]?.departureSec || 0);
                const sec = parseScheduleClock(e.target.value, prev, first ? { inferRollover: false, defaultDay: 0 } : undefined);
                if (sec != null)
                    loc.applyManualArrival(sec);
            }
        }
        if (field === 'dep') {
            if (!String(e.target.value || '').trim())
                loc.clearManualDeparture();
            else if (loc.order === 0) {
                const old = Number(loc.departureSec ?? 0);
                const sec = parseScheduleClock(e.target.value, 0, { inferRollover: false, defaultDay: 0 });
                if (sec != null) {
                    const delta = sec - old;
                    loc.applyManualDeparture(sec);
                    // Retiming the service origin moves downstream MANUAL overrides by the
                    // same delta. Otherwise an old 16:30 override can remain on J while a
                    // newly-entered 01:05 departure moves to another clock/day and makes a
                    // perfectly valid service fail NON_MONOTONIC_TIMING.
                    if (delta) {
                        for (const other of ver.locations) {
                            if (other.id === loc.id)
                                continue;
                            if (other.arrivalOverride && other.arrivalSec != null)
                                other.arrivalSec = Math.max(0, Math.round(Number(other.arrivalSec) + delta));
                            if (other.departureOverride && other.departureSec != null)
                                other.departureSec = Math.max(0, Math.round(Number(other.departureSec) + delta));
                        }
                    }
                }
            }
            else {
                const prev = loc.arrivalSec ?? ver.locations[Math.max(0, loc.order - 1)]?.departureSec ?? 0;
                const sec = parseScheduleClock(e.target.value, prev);
                if (sec != null)
                    loc.applyManualDeparture(sec);
            }
        }
        recalculateScheduleTiming(ver, { firstDepartureSec: ver.locations[0]?.departureSec ?? 8 * 3600, weather: 'clear' });
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
    }
    async removeStop(id) {
        const ver = this._activeVersion();
        const idx = ver.locations.findIndex((x) => x.id === id);
        if (idx < 0)
            return;
        if (ver.locations.length <= 1) {
            this._error(new Error('Supprimez l’horaire depuis la liste si vous voulez tout effacer.'));
            return;
        }
        this._snapshot();
        this._markRecordChanged();
        const oldCount = ver.locations.length;
        ver.locations.splice(idx, 1);
        ver.normalize();
        const path = this._activePath();
        const newLegCount = Math.max(0, ver.locations.length - 1), mapped = [];
        for (const c of path.constraints) {
            const oldLeg = Number(c.legIndex) || 0;
            let newLeg = oldLeg;
            if (idx === 0) {
                if (oldLeg === 0)
                    continue;
                newLeg = oldLeg - 1;
            }
            else if (idx === oldCount - 1) {
                if (oldLeg === oldCount - 2)
                    continue;
            }
            else {
                if (oldLeg === idx)
                    newLeg = idx - 1;
                else if (oldLeg > idx)
                    newLeg = oldLeg - 1;
            }
            if (newLegCount > 0)
                mapped.push({ c, oldLeg, newLeg: Math.max(0, Math.min(newLegCount - 1, newLeg)), oldOrder: Number(c.order) || 0 });
        }
        // On an interior merge, preserve railway order: old incoming leg VIA first,
        // then old outgoing leg VIA, irrespective of global creation chronology.
        mapped.sort((a, b) => a.newLeg - b.newLeg || a.oldLeg - b.oldLeg || a.oldOrder - b.oldOrder);
        path.constraints = mapped.map((x) => { x.c.legIndex = x.newLeg; return x.c; });
        path.constraints.forEach((c, i) => c.order = i);
        await this._recomputeActivePath();
        this._autosaveSoon();
    }
    _syncReturnStart() { if (!this.returnVersion?.locations.length || !this.version?.locations.length)
        return; const arr = this.version.locations.at(-1).arrivalSec ?? this.version.locations.at(-1).departureSec ?? 0; const dep = arr + (this.roundTripGroup?.terminalLayoverSec || 0); const first = this.returnVersion.locations[0]; first.computedDepartureSec = dep; if (!first.departureOverride)
        first.departureSec = dep; recalculateScheduleTiming(this.returnVersion, { firstDepartureSec: first.departureSec, weather: 'clear' }); this.renderPanel(); }
    showCalendarManager() {
        document.getElementById('sv2-calendar-modal')?.remove();
        const mgr = this.game.scheduleV2;
        const m = document.createElement('div');
        m.id = 'sv2-calendar-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9300;background:#000a;display:flex;align-items:center;justify-content:center';
        const render = () => {
            const overlapIds = new Set();
            for (let i = 0; i < mgr.calendars.length; i++)
                for (let j = i + 1; j < mgr.calendars.length; j++) {
                    const a = mgr.calendars[i], b = mgr.calendars[j];
                    if (a.startDate && a.endDate && b.startDate && b.endDate && a.startDate <= b.endDate && b.startDate <= a.endDate) {
                        overlapIds.add(a.id);
                        overlapIds.add(b.id);
                    }
                }
            m.innerHTML = `<div style="width:min(760px,94vw);max-height:88vh;overflow:auto;background:#0c1827;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><div style="display:flex;align-items:center"><h3 style="margin:0;flex:1">Calendriers de service</h3><button class="sv2-btn" data-cal-close>✕</button></div><p style="color:#9fb3cb">L’ordre d’affichage définit la priorité. Les périodes peuvent se chevaucher ; la priorité la plus haute gagne.</p><div id="sv2-cal-list">${mgr.calendars.map((c, i) => `<div style="border:1px solid ${htmlText(overlapIds.has(c.id) ? '#b7791f' : '#2b4058')};border-radius:7px;padding:8px;margin:6px 0;display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center"><b>#${i + 1}</b><div><b>${esc(c.name)}</b>${overlapIds.has(c.id) ? ' <span style="color:#f6c453">⚠ chevauchement</span>' : ''}<br><small>${esc(c.startDate || '—')} → ${esc(c.endDate || '—')} • jours ${esc((c.weekdays || []).join(','))}${c.excludedDates?.length ? ` • sauf ${esc(c.excludedDates.join(', '))}` : ''}</small></div><div style="display:flex;gap:4px"><button class="sv2-btn" data-cal-up="${htmlText(c.id)}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="sv2-btn" data-cal-down="${htmlText(c.id)}" ${i === mgr.calendars.length - 1 ? 'disabled' : ''}>↓</button><button class="sv2-btn sv2-danger" data-cal-del="${htmlText(c.id)}">Suppr.</button></div></div>`).join('') || '<div style="color:#9fb3cb;padding:10px">Aucun calendrier.</div>'}</div><div class="sv2-section"><h4>Ajouter</h4><div class="sv2-grid"><div class="sv2-field"><label>Nom</label><input id="sv2-cal-name" placeholder="Service hiver 2026/2027"></div><div></div><div class="sv2-field"><label>Début</label><input id="sv2-cal-start" type="date"></div><div class="sv2-field"><label>Fin</label><input id="sv2-cal-end" type="date"></div></div><div class="sv2-field"><label>Jours</label><div id="sv2-cal-weekdays" style="display:flex;gap:8px;flex-wrap:wrap">${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => `<label><input type="checkbox" value="${htmlText(i)}" checked> ${d}</label>`).join('')}</div></div><div class="sv2-field"><label>Dates exclues (une par ligne ou séparées par virgule)</label><textarea id="sv2-cal-exclusions" rows="2" placeholder="2026-12-25"></textarea></div><button class="sv2-btn sv2-primary" id="sv2-cal-add">Ajouter le calendrier</button></div></div>`;
            m.querySelector('[data-cal-close]').onclick = () => m.remove();
            m.querySelectorAll('[data-cal-up]').forEach((b) => b.onclick = () => { const idx = mgr.calendars.findIndex((c) => c.id === b.dataset.calUp); mgr.moveCalendar(b.dataset.calUp, idx - 1); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); render(); });
            m.querySelectorAll('[data-cal-down]').forEach((b) => b.onclick = () => { const idx = mgr.calendars.findIndex((c) => c.id === b.dataset.calDown); mgr.moveCalendar(b.dataset.calDown, idx + 1); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); render(); });
            m.querySelectorAll('[data-cal-del]').forEach((b) => b.onclick = () => { const id = b.dataset.calDel; const refs = []; for (const rec of mgr.schedules)
                for (const v of rec.versions)
                    if (v.calendarIds.includes(id))
                        refs.push(`${rec.number || rec.id} v${v.version}`); for (const r of this.game.rotationV2.rotations)
                if (r.calendarId === id)
                    refs.push(`Roulement ${r.name}`); if (refs.length && !confirm(`Calendrier utilisé par :\n${refs.slice(0, 20).join('\n')}\n\nLe détacher et le supprimer ?`))
                return; mgr.removeCalendar(id, { rotationManager: this.game.rotationV2 }); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); render(); this.renderPanel(); });
            m.querySelector('#sv2-cal-add').onclick = () => { const name = m.querySelector('#sv2-cal-name').value.trim(), startDate = m.querySelector('#sv2-cal-start').value, endDate = m.querySelector('#sv2-cal-end').value; if (!name || !startDate || !endDate)
                return alert('Nom, date de début et date de fin requis.'); if (endDate < startDate)
                return alert('La date de fin doit être postérieure au début.'); const weekdays = [...m.querySelectorAll('#sv2-cal-weekdays input:checked')].map((x) => Number(x.value)); const excludedDates = m.querySelector('#sv2-cal-exclusions').value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean); mgr.addCalendar({ name, startDate, endDate, weekdays, excludedDates }); this.game.saveState(); this.game._forceV2RuntimeSyncNow?.(); render(); this.renderPanel(); };
        };
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m)
            m.remove(); });
        render();
    }
    _createVersion() {
        const rec = this._activeRecord();
        if (!rec)
            return;
        this._snapshot();
        const v = rec.createVersion({ state: ScheduleState.DRAFT });
        if (this.mode === PathDirection.RETURN)
            this.returnVersion = v;
        else
            this.version = v;
        this.renderPanel();
        this.draw();
        this._autosaveSoon();
        this._showTransientAlert('yellow', `Nouvelle version v${v.version} créée en brouillon.`);
    }
    _switchVersion(versionId) {
        const rec = this._activeRecord();
        const v = rec?.versions.find((x) => x.id === versionId);
        if (!rec || !v)
            return;
        rec.currentVersionId = v.id;
        if (this.mode === PathDirection.RETURN)
            this.returnVersion = v;
        else
            this.version = v;
        this.renderPanel();
        this.draw();
    }
    _setCalendarChecked(id, checked) { const v = this._activeVersion(); if (!v)
        return; this._snapshot(); this._markRecordChanged(this._activeRecord(), v, { needsValidation: false }); this._queueRotationRecalc(this._activeRecord()?.id); const set = new Set(v.calendarIds); checked ? set.add(id) : set.delete(id); v.calendarIds = [...set]; this._autosaveSoon(); this.game._forceV2RuntimeSyncNow?.(); }
    _activeMetrics() {
        const ver = this._activeVersion(), path = this._activePath();
        const first = ver?.locations?.[0] || null, last = ver?.locations?.at(-1) || null, previewRoute = this._activePreview();
        let distanceKm = Number(path?.distanceKm || 0), departure = first?.departureSec ?? first?.computedDepartureSec ?? null, arrival = null, durationSec = null, preview = false;
        if (ver?.locations?.length >= 2 && last) {
            arrival = last.arrivalSec ?? last.computedArrivalSec ?? null;
            if (departure != null && arrival != null)
                durationSec = Math.max(0, arrival - departure);
        }
        if (first && previewRoute?.length >= 2) {
            const snap = this.router.snapshotRoute(previewRoute);
            const suffixSec = calculatePhysicalTravelSeconds(previewRoute, ver.performanceProfile, { weather: 'clear' });
            // v1.1.84 — preview is a SUFFIX after the last resolved stop. Previously
            // the panel replaced the distance only when there was a single stop and
            // ignored the same valid preview as soon as 2+ stops existed.
            distanceKm = Number(path?.distanceKm || 0) + Number(snap.distanceKm || 0);
            // The existing prefix already includes every intermediate braking cycle
            // and dwell. Do not time it again as one uninterrupted non-stop route.
            const previewStart = last?.departureSec ?? last?.computedDepartureSec ?? last?.arrivalSec ?? last?.computedArrivalSec ?? departure;
            arrival = previewStart == null ? null : Number(previewStart) + Number(suffixSec || 0);
            durationSec = departure != null && arrival != null ? Math.max(0, arrival - departure) : null;
            preview = true;
        }
        return { distanceKm, departure, arrival, durationSec, preview };
    }
    _durationText(sec) {
        if (sec == null || !Number.isFinite(Number(sec)))
            return '—';
        sec = Math.max(0, Math.round(Number(sec)));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min ${String(s).padStart(2, '0')} s`;
    }
    _panelControlKey(el) {
        if (!el || (typeof HTMLElement !== 'undefined' && !(el instanceof HTMLElement)))
            return '';
        if (el.dataset?.f)
            return `f:${el.dataset.f}`;
        if (el.dataset?.stop)
            return `stop:${el.dataset.stop}`;
        if (el.hasAttribute?.('data-return-name'))
            return 'return-name';
        if (el.hasAttribute?.('data-layover'))
            return 'layover';
        if (el.hasAttribute?.('data-version-select'))
            return 'version-select';
        if (el.hasAttribute?.('data-tech-existing'))
            return 'tech-existing';
        if (el.hasAttribute?.('data-quick-rame'))
            return 'quick-rame';
        return '';
    }
    _capturePanelUiState() {
        const root = this.panelContent;
        if (!root)
            return null;
        const details = [...root.querySelectorAll('details.sv2-fold')].map((el, i) => ({ key: el.dataset.foldKey || el.querySelector('summary')?.textContent?.trim() || `#${i}`, open: el.open }));
        const active = (typeof document !== 'undefined' && root.contains(document.activeElement)) ? document.activeElement : null;
        let focus = null;
        if (active) {
            const key = this._panelControlKey(active);
            if (key) {
                focus = { key };
                if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && typeof active.selectionStart === 'number') {
                    focus.start = active.selectionStart;
                    focus.end = active.selectionEnd ?? active.selectionStart;
                    focus.direction = active.selectionDirection || 'none';
                }
            }
        }
        return { details, scrollTop: root.scrollTop, focus };
    }
    _restorePanelUiState(state) {
        const root = this.panelContent;
        if (!root || !state)
            return;
        const openByKey = new Map((state.details || []).map((x) => [x.key, !!x.open]));
        [...root.querySelectorAll('details.sv2-fold')].forEach((el, i) => { const key = el.dataset.foldKey || el.querySelector('summary')?.textContent?.trim() || `#${i}`; if (openByKey.has(key))
            el.open = openByKey.get(key); });
        root.scrollTop = Number(state.scrollTop || 0);
        const focusState = state.focus;
        if (focusState?.key) {
            const controls = [...root.querySelectorAll('input,select,textarea')];
            const target = controls.find((el) => this._panelControlKey(el) === focusState.key);
            if (target) {
                target.focus({ preventScroll: true });
                if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && Number.isFinite(focusState.start)) {
                    try {
                        target.setSelectionRange(focusState.start, focusState.end ?? focusState.start, focusState.direction || 'none');
                    }
                    catch { }
                }
            }
        }
    }
    searchStationFromInput() {
        const input = document.getElementById('sv2-station-search');
        const q = (input?.value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!q)
            return;
        const stations = this.game?.world?.stations || this.game?.world?.stationsById || {};
        const list = Array.isArray(stations) ? stations : Object.values(stations);
        const s = list.find((x) => {
            const n = String(x.name || x.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return n.includes(q);
        });
        if (!s) {
            this._showTransientAlert?.('orange', 'Gare introuvable');
            return;
        }
        if (Number.isFinite(s.lat))
            this.tileMap.centerLat = s.lat;
        if (Number.isFinite(s.lon))
            this.tileMap.centerLon = s.lon;
        this.tileMap.zoomLevel = Math.max(this.tileMap.zoomLevel || 9, 15);
        this.tileMap.markDirty?.();
        this._showTransientAlert?.('yellow', `Carte centrée : ${s.name || 'gare'}`);
    }
    searchPlaceFromInput() {
        const input = document.getElementById('sv2-place-search');
        const q = (input?.value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!q)
            return;
        const world = this.game?.world || {};
        const pools = [];
        for (const key of ['stations', 'industries', 'sites', 'depots', 'technicalLocations', 'locations', 'places']) {
            const v = world[key] || this.game?.scheduleV2?.[key];
            if (Array.isArray(v))
                pools.push(...v);
            else if (v && typeof v === 'object')
                pools.push(...Object.values(v));
        }
        const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const hit = pools.find((x) => [x.name, x.label, x.title, x.displayName, x.city, x.ref].some((v) => norm(v).includes(q)));
        if (!hit) {
            this._showTransientAlert?.('orange', 'Lieu introuvable');
            return;
        }
        const lat = Number(hit.lat ?? hit.latitude ?? hit.y);
        const lon = Number(hit.lon ?? hit.lng ?? hit.longitude ?? hit.x);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            this.tileMap.centerLat = lat;
            this.tileMap.centerLon = lon;
            this.tileMap.zoomLevel = Math.max(this.tileMap.zoomLevel || 9, 13);
            this.tileMap.markDirty?.();
            this._showTransientAlert?.('yellow', `Carte centrée : ${hit.name || hit.label || 'lieu'}`);
        }
        else
            this._showTransientAlert?.('orange', 'Lieu trouvé mais sans coordonnées');
    }
    renderPanel() {
        if (!this.record || !this.version)
            return;
        const uiState = this._capturePanelUiState();
        const rec = this._activeRecord(), ver = this._activeVersion();
        const path = this._activePath();
        const rames = this.game.rameManager.rames || this.game.rameManager.getAll?.() || [];
        const passenger = isPassengerCategory(ver.category);
        const mode = ver.performanceProfile.mode;
        const metrics = this._activeMetrics();
        const locations = ver.locations.map((l, i) => {
            const arr = l.arrivalSec == null ? '—' : formatScheduleClock(l.arrivalSec), dep = l.departureSec == null ? '—' : formatScheduleClock(l.departureSec);
            const codes = passenger ? '' : `<select data-stop="${htmlText(l.id)}:code"><option value="NONE">—</option><option value="C" ${l.stopCode === 'C' ? 'selected' : ''}>C</option><option value="S" ${l.stopCode === 'S' ? 'selected' : ''}>S</option><option value="OPTIONAL_C" ${l.stopCode === 'OPTIONAL_C' ? 'selected' : ''}>[C]</option><option value="OPTIONAL_S" ${l.stopCode === 'OPTIONAL_S' ? 'selected' : ''}>[S]</option></select>`;
            const previous = i > 0 ? ver.locations[i - 1] : null, vias = i > 0 ? this._constraintsForLeg(path, i - 1) : [];
            const viaChips = vias.map((v, j) => `<button class="sv2-btn sv2-via-chip ${htmlText(v.id === this.selectedConstraintId ? 'active' : '')}" data-select-via="${htmlText(v.id)}" title="Sélectionner ce VIA">VIA ${j + 1}</button>`).join('');
            const legEditor = i > 0 ? `<div class="sv2-leg-edit"><span>↳</span><span class="sv2-leg-name" title="${esc(previous?.name || '?')} → ${esc(l.name || '?')}">${esc(previous?.name || '?')} → ${esc(l.name || '?')} • ${vias.length ? vias.length + ' VIA' : 'AUTO'}</span>${viaChips}<button class="sv2-btn sv2-mini" data-via-between="${htmlText(i - 1)}" title="Ajouter un point de passage entre ces deux arrêts sans supprimer les arrêts">＋ VIA</button></div>` : '';
            return `${legEditor}<div class="sv2-stop"><div class="sv2-stop-head"><span>${l.kind === LocationKind.TECHNICAL ? '◇' : '●'}</span><b title="${esc(l.name || 'Point')}">${esc(l.name || 'Point')}</b><span class="sv2-badge" title="${esc(l.track.displayName || '?')}">${esc(l.track.displayName || '?')}</span><button class="sv2-btn sv2-mini" data-rename-track="${htmlText(l.id)}" title="Modifier seulement le nom de voie">✎</button><button class="sv2-btn sv2-mini" data-change-track="${htmlText(l.id)}" title="Changer la voie physique">⌖</button>${l.kind === LocationKind.STATION ? `<button class="sv2-btn sv2-mini" data-replace-station="${htmlText(l.id)}" title="Remplacer la gare">◎</button>` : ''}${i > 0 ? `<button class="sv2-btn sv2-mini" data-via-before-stop="${htmlText(i)}" title="Ajouter un VIA avant cet arrêt">＋</button>` : ''}<button class="sv2-btn sv2-mini sv2-danger" data-remove-stop="${htmlText(l.id)}" title="Supprimer">🗑</button></div><div class="sv2-stop-line"><input data-stop="${htmlText(l.id)}:arr" value="${htmlText(arr === '—' ? '' : arr)}" placeholder="Arr."><input data-stop="${htmlText(l.id)}:dep" value="${htmlText(dep === '—' ? '' : dep)}" placeholder="Dép."><label>Arrêt <input data-stop="${htmlText(l.id)}:dwell" type="number" min="0" step="1" value="${htmlText(Math.round(l.dwellSec / 60))}" style="width:38px"> min</label><div style="display:flex;gap:3px;align-items:center">${codes}<label><input data-stop="${htmlText(l.id)}:taq" type="checkbox" ${l.turnBack ? 'checked' : ''}>TAQ</label></div></div></div>`;
        }).join('');
        const tabs = this.returnRecord ? `<div class="sv2-tabs"><button class="sv2-btn sv2-tab ${htmlText(this.mode === PathDirection.OUTBOUND ? 'active out' : '')}" data-dir="OUTBOUND">ALLER BLEU</button><button class="sv2-btn sv2-tab ${htmlText(this.mode === PathDirection.RETURN ? 'active ret' : '')}" data-dir="RETURN">RETOUR VERT</button></div>` : `<button class="sv2-btn" data-act-inline="add-return" style="width:100%;margin:4px 0">↩ Créer le retour</button>`;
        const ar = this.roundTripGroup ? `<div class="sv2-arbox"><b>Aller-retour</b><div class="sv2-grid" style="margin-top:5px"><div class="sv2-field"><label>Attente terminus (min)</label><input data-layover type="number" min="0" value="${htmlText(Math.round(this.roundTripGroup.terminalLayoverSec / 60))}"></div><div class="sv2-field"><label>Nom du retour</label><input data-return-name value="${esc(this.returnRecord?.name || '')}"></div></div><button class="sv2-btn" data-duplicate-ar>Dupliquer AR ≤24 h</button></div>` : '';
        const summary = `<div class="sv2-summary"><div class="sv2-metric"><span>Distance${metrics.preview ? ' (jusqu’au VIA)' : ''}</span><b>${kmText(metrics.distanceKm)}</b></div><div class="sv2-metric"><span>Temps de marche</span><b>${this._durationText(metrics.durationSec)}</b></div><div class="sv2-metric"><span>Départ</span><b>${metrics.departure == null ? '—' : formatScheduleClock(metrics.departure)}</b></div><div class="sv2-metric"><span>Arrivée${metrics.preview ? ' estimée' : ''}</span><b>${metrics.arrival == null ? '—' : formatScheduleClock(metrics.arrival)}</b></div></div>`;
        const params = `<details class="sv2-fold" data-fold-key="train-params"><summary>Paramètres train & calcul</summary><div class="sv2-grid"><div class="sv2-field"><label>Numéro</label><input data-f="number" value="${esc(rec.number)}"></div><div class="sv2-field"><label>Catégorie</label><select data-f="category">${Object.values(TrainCategory).map((c) => `<option value="${htmlText(c)}" ${c === ver.category ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></div></div><div class="sv2-field"><label>Nom du train</label><input data-f="name" value="${esc(rec.name)}" placeholder="Libre"></div><div class="sv2-field"><label>Rame de référence</label><select data-quick-rame><option value="">— Vmax de sillon —</option>${rames.map((r) => `<option value="${esc(r.id)}" ${r.id === ver.performanceProfile.referenceRameId ? 'selected' : ''}>${esc(r.name || r.id)}</option>`).join('')}</select></div><div class="sv2-field"><label>Mode</label><select data-f="perfMode"><option value="LINE_MAX_SPEED" ${mode === PerformanceMode.LINE_MAX_SPEED ? 'selected' : ''}>Vmax + rame étalon</option><option value="REFERENCE_COMPOSITION" ${mode === PerformanceMode.REFERENCE_COMPOSITION ? 'selected' : ''}>Composition type</option></select></div>${mode === PerformanceMode.REFERENCE_COMPOSITION ? `<div class="sv2-field"><label>Rame de référence</label><select data-f="referenceRame"><option value="">Choisir…</option>${rames.map((r) => `<option value="${esc(r.id)}" ${r.id === ver.performanceProfile.referenceRameId ? 'selected' : ''}>${esc(r.name || r.id)}</option>`).join('')}</select></div><div class="sv2-grid"><div class="sv2-field"><label>Systèmes électriques</label><input data-f="electricSystems" value="${esc(formatElectricSystems(ver.performanceProfile.electricSystems))}" placeholder="1500@0;25000@50"></div><div class="sv2-field"><label>Écartements mm</label><input data-f="gauges" value="${esc((ver.performanceProfile.gauges || []).join(';'))}" placeholder="1435"></div></div>` : `<div class="sv2-field"><label>Vmax du sillon</label><div style="display:flex;gap:5px"><input data-f="vmax" type="number" min="1" max="400" value="${htmlText(Math.round(ver.performanceProfile.maxSpeed))}" style="flex:1"><button type="button" class="sv2-btn sv2-mini" data-apply-vmax>Appliquer</button></div></div>`}<small style="color:#9db0c8">Calcul physique sans marge automatique.</small></details>`;
        const calendar = `<details class="sv2-fold" data-fold-key="version-calendars"><summary>Version & calendriers</summary><div class="sv2-grid"><div class="sv2-field"><label>Version</label><select data-version-select>${rec.versions.map((vv) => `<option value="${htmlText(vv.id)}" ${vv.id === ver.id ? 'selected' : ''}>v${vv.version} — ${htmlText(stateLabel(vv.state))}</option>`).join('')}</select></div><div style="display:flex;align-items:end"><button class="sv2-btn" data-new-version>+ Version</button></div></div><div class="sv2-field"><label>Calendriers</label><div style="display:flex;flex-direction:column;gap:3px">${this.game.scheduleV2.calendars.map((c, i) => `<label><input type="checkbox" data-cal-check="${htmlText(c.id)}" ${ver.calendarIds.includes(c.id) ? 'checked' : ''}> #${i + 1} ${esc(c.name)}</label>`).join('') || '<small>Aucun : permanent.</small>'}</div></div><button class="sv2-btn" data-manage-calendars>Gérer</button></details>`;
        const runtimeIssues = (this.game.scheduleV2Runtime?.alerts || []).filter((a) => { const rm = this.game.rotationV2; const r = rm?.getRotation?.(a.rotationId); const o = r?.occurrences?.find((x) => x.id === a.occurrenceId); if (o?.scheduleId === rec.id)
            return true; const d = rm?.getDirectAssignmentByRuntimeRotationId?.(a.rotationId); return d?.scheduleId === rec.id; }).slice(0, 5);
        const runtimeAlerts = runtimeIssues.length ? `<div class="sv2-section"><h4>Simulation / départ</h4>${runtimeIssues.map((a) => `<div class="sv2-alert ${htmlText(a.level === 'ERROR' ? 'red' : 'orange')}"><b>${a.level === 'ERROR' ? '🔴' : '🟠'} ${esc(a.code)}</b> — ${esc(a.message)}${a.suggestion ? `<br><small>💡 ${esc(a.suggestion)}</small>` : ''}</div>`).join('')}</div>` : '';
        this.panelContent.innerHTML = `<div class="sv2-hint ${htmlText(this.busy ? 'busy' : '')}" id="sv2-panel-hint">${esc(this.overlay.querySelector('#sv2-statusline')?.textContent || '')}${this.busy ? ' <button class="sv2-btn sv2-mini sv2-danger" data-cancel-route title="Annuler le calcul (Échap)">■ Annuler calcul</button>' : ''}</div>${summary}${tabs}${ar}<div class="sv2-section"><h4>${this.mode === PathDirection.RETURN ? 'Retour vert' : 'Aller bleu'} — arrêts</h4>${locations || '<div style="color:#8da3bd;padding:8px 0">Cliquez une gare sur la carte.</div>'}</div>${ver.locations.length && this.game.scheduleV2.technicalLocations.length ? `<details class="sv2-fold" data-fold-key="technical-points"><summary>Points techniques enregistrés</summary><div style="display:flex;gap:4px"><select data-tech-existing style="flex:1;background:#111d2d;color:#eff6ff;border:1px solid #31455f;border-radius:5px"><option value="">Choisir…</option>${this.game.scheduleV2.technicalLocations.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} — ${esc(t.track.displayName)}</option>`).join('')}</select><button class="sv2-btn" data-add-tech-existing>+</button><button class="sv2-btn sv2-danger" data-del-tech-existing>🗑</button></div></details>` : ''}${runtimeAlerts}${params}${calendar}`;
        this._bindPanelEvents();
        this.panelContent.querySelector('[data-cancel-route]')?.addEventListener('click', () => this.cancelRouteCalculation());
        this.panelContent.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => { this.mode = b.dataset.dir === 'RETURN' ? PathDirection.RETURN : PathDirection.OUTBOUND; this.renderPanel(); this.draw(); this._setHint(this.mode === PathDirection.RETURN ? 'RETOUR VERT actif. + VIA pour guider, clic gare pour ajouter un arrêt.' : 'ALLER BLEU actif. + VIA pour guider, clic gare pour ajouter un arrêt.'); }));
        this.panelContent.querySelector('[data-act-inline="add-return"]')?.addEventListener('click', () => this.beginReturn());
        this._restorePanelUiState(uiState);
        this._updateHeader();
    }
    _updateHeader() { const rec = this._activeRecord(), ver = this._activeVersion(); const state = this.overlay.querySelector('#sv2-state'); state.textContent = stateLabel(ver.state); state.className = `sv2-state ${stateClass(ver.state)}`; this.overlay.querySelector('#sv2-title').textContent = `${rec.number || 'Sans numéro'} ${rec.name || ''}`; const rm = this.overlay.querySelector('#sv2-route-mode'); rm.textContent = this.mode === PathDirection.RETURN ? 'RETOUR' : 'ALLER'; rm.className = `sv2-route-mode ${this.mode === PathDirection.RETURN ? 'ret' : 'out'}`; }
    _setHint(text, busy = false) { const el = this.overlay.querySelector('#sv2-statusline'); if (el)
        el.textContent = text; const p = this.panelContent?.querySelector('#sv2-panel-hint'); if (p) {
        p.textContent = text;
        p.classList.toggle('busy', busy);
    } }
    cancelRouteCalculation() {
        if (!this._routeAbortController)
            return false;
        try {
            this._routeAbortController.abort();
        }
        catch { }
        this._routeGeneration = Number(this._routeGeneration || 0) + 1;
        this._routeAbortController = null;
        this.busy = false;
        this._setHint('Calcul du sillon annulé par le joueur.');
        this.renderPanel?.();
        return true;
    }
    _error(err) { console.warn('Schedule V2:', err); const message = err instanceof Error ? err.message : String(err); this._setHint(message); this._showTransientAlert('red', message); }
    _showTransientAlert(level, text) { const wrap = this.overlay.querySelector('#sv2-alerts'); const e = document.createElement('div'); e.className = `sv2-alert ${level}`; e.textContent = String(text ?? ''); wrap.appendChild(e); setTimeout(() => e.remove(), 6000); }
    _shortTimingErrors(report) { return (report?.errors || []).filter((i) => i.code === 'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'); }
    _reportCanProceedToValidation(report) { const errs = report?.errors || []; return errs.length === 0 || errs.every((i) => i.code === 'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'); }
    _clearUnusedShortTimingOverride(ver) {
        if (!ver?.allowShorterThanPhysicalTiming)
            return;
        const stillShort = (ver.locations || []).some((loc) => loc.arrivalOverride && loc.computedArrivalSec != null && loc.arrivalSec != null && Number(loc.arrivalSec) < Number(loc.computedArrivalSec));
        if (!stillShort)
            ver.allowShorterThanPhysicalTiming = false;
    }
    _confirmForceShortTiming(issues) {
        return new Promise((resolve) => {
            document.getElementById('sv2-force-short-timing-modal')?.remove();
            const m = document.createElement('div');
            m.id = 'sv2-force-short-timing-modal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9450;background:#000b;display:flex;align-items:center;justify-content:center';
            const rows = (issues || []).map((i) => { const data = (i.data && typeof i.data === 'object' ? i.data : {}); const d = Math.max(0, Number(data.minimumSec || 0) - Number(data.manualSec || 0)); return `<div style="padding:8px;border-left:4px solid #ff982a;background:#2b1c0d;margin:6px 0;border-radius:5px"><b>${esc(i.message)}</b>${d ? `<br><small>Écart avec le calcul RE : ${Math.ceil(d / 60)} min (${Math.round(d)} s).</small>` : ''}</div>`; }).join('');
            m.innerHTML = `<div style="width:min(720px,94vw);max-height:86vh;overflow:auto;background:#0c1827;border:1px solid #ff982a;border-radius:10px;padding:16px;color:#eef6ff"><h3 style="margin-top:0;color:#ffb454">⚠ Temps de trajet inférieur au calcul RE</h3><p>Le joueur a saisi un horaire plus rapide que le temps physique actuellement proposé par Rail Empire.</p>${rows}<div style="padding:9px;background:#301616;border:1px solid #7f1d1d;border-radius:6px;margin-top:10px"><b>Le forçage ne contourne que cette différence de temps.</b><br><small>Les erreurs de tracé ORM, voie, gabarit, électrification, TAQ, chronologie négative et autres incompatibilités restent bloquantes. En circulation, le matériel réel peut naturellement prendre du retard s'il ne tient pas cet horaire.</small></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="sv2-btn" data-force-cancel>Revenir corriger</button><button class="sv2-btn sv2-primary" data-force-ok>Forcer et valider quand même</button></div></div>`;
            const done = (v) => { m.remove(); resolve(v); };
            m.querySelector('[data-force-cancel]').onclick = () => done(false);
            m.querySelector('[data-force-ok]').onclick = () => done(true);
            m.addEventListener('click', (e) => { if (e.target === m)
                done(false); });
            document.body.appendChild(m);
        });
    }
    async validateAndSave() {
        this._applyCoreFields();
        const num = String(this.record?.number || '').trim();
        if (!num) {
            this._showTransientAlert('red', 'Numéro de train obligatoire.');
            return false;
        }
        if (!this.game.scheduleV2.isTrainNumberAvailable(num, this.record.id)) {
            this._showTransientAlert('red', `Numéro ${num} déjà utilisé par un autre horaire.`);
            return false;
        }
        if (this.returnRecord) {
            const rn = String(this.returnRecord.number || '').trim();
            if (!rn || !this.game.scheduleV2.isTrainNumberAvailable(rn, this.returnRecord.id)) {
                this._showTransientAlert('red', !rn ? 'Numéro du retour obligatoire.' : `Numéro retour ${rn} déjà utilisé.`);
                return false;
            }
        }
        const recomputeOk = await this._recomputeBoth();
        if (this.roundTripGroup)
            this._syncReturnStart();
        const versions = [this.version, ...(this.returnVersion ? [this.returnVersion] : [])];
        for (const v of versions)
            this._clearUnusedShortTimingOverride(v);
        let reports = versions.map((v) => { const report = validateScheduleVersion(v, { ormAvailable: true }); v.validationReport = report; return report; });
        const pairIssues = (this.roundTripGroup && this.returnVersion) ? validateRoundTripPair(this.version, this.returnVersion, { terminalLayoverSec: this.roundTripGroup.terminalLayoverSec }) : [];
        let issues = reports.flatMap((r) => r.issues || []).concat(pairIssues);
        this._renderValidationSummary(issues);
        if (pairIssues.some((i) => i.level === 'ERROR')) {
            for (const v of versions)
                if (v.state === ScheduleState.VALID)
                    v.state = ScheduleState.NEEDS_REPAIR;
        }
        const blockingErrors = issues.filter((i) => i.level === 'ERROR' && i.code !== 'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE');
        const shortErrors = issues.filter((i) => i.level === 'ERROR' && i.code === 'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE');
        if (!recomputeOk || blockingErrors.length) {
            for (const v of versions) {
                const r = v.validationReport;
                if (r?.canValidate)
                    applyValidationState(v, r);
                else
                    v.state = v.state === ScheduleState.DRAFT ? ScheduleState.DRAFT : ScheduleState.NEEDS_REPAIR;
            }
            this.renderPanel();
            return false;
        }
        if (shortErrors.length) {
            if (!await this._confirmForceShortTiming(shortErrors)) {
                this.renderPanel();
                return false;
            }
            for (const v of versions) {
                if (this._shortTimingErrors(v.validationReport).length)
                    v.allowShorterThanPhysicalTiming = true;
            }
            reports = versions.map((v) => { const report = validateScheduleVersion(v, { ormAvailable: true }); v.validationReport = report; return report; });
            issues = reports.flatMap((r) => r.issues || []).concat(pairIssues);
            this._renderValidationSummary(issues);
            if (issues.some((i) => i.level === 'ERROR')) {
                this.renderPanel();
                return false;
            }
        }
        for (let i = 0; i < versions.length; i++) {
            const v = versions[i], r = reports[i];
            if (r.canValidate)
                applyValidationState(v, r);
        }
        if (!await this._confirmValidationSummary(issues))
            return false;
        for (const v of versions) {
            v.state = ScheduleState.VALID;
            v.validationReport = validateScheduleVersion(v, { ormAvailable: true });
        }
        this._queueRotationRecalc(this.record?.id);
        this._queueRotationRecalc(this.returnRecord?.id);
        this._autosave();
        this.game._forceV2RuntimeSyncNow?.();
        this.renderPanel();
        this.ui?.renderSchedulesList?.();
        const ready = this._operationalReadiness(this.record, this.version);
        this._showTransientAlert(ready.code === 'READY' ? 'yellow' : 'orange', `Horaire VALIDE · ${ready.label}${ready.message ? ` — ${ready.message}` : ''}`);
        return true;
    }
    _confirmValidationSummary(issues) {
        return new Promise((resolve) => {
            document.getElementById('sv2-validation-modal')?.remove();
            const m = document.createElement('div');
            m.id = 'sv2-validation-modal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9400;background:#000a;display:flex;align-items:center;justify-content:center';
            const rows = (issues || []).map((i) => `<div style="padding:7px;border-left:4px solid ${htmlText(i.level === 'WARNING' ? ORANGE : '#5b708a')};background:#101b29;margin:5px 0;border-radius:4px">${i.level === 'WARNING' ? '🟠' : 'ℹ'} ${esc(i.message)}</div>`).join('') || '<div style="padding:8px;border-left:4px solid #36d17c;background:#10291c;border-radius:4px">✓ Aucun problème détecté.</div>';
            m.innerHTML = `<div style="width:min(680px,94vw);max-height:86vh;overflow:auto;background:#0c1827;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">Résumé de validation</h3>${rows}<div style="margin-top:10px;padding:8px;background:#0b2137;border-radius:5px"><b>Marge automatique : 0 s</b><br><small style="color:#a9bdd4">Après validation, affectez simplement une rame en mode simplifié, ou ajoutez cet horaire à une ligne de roulement si vous utilisez le module avancé.</small></div><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px"><button class="sv2-btn" data-vcancel>Retour</button><button class="sv2-btn sv2-primary" data-vok>Valider l’horaire</button></div></div>`;
            const done = (v) => { m.remove(); resolve(v); };
            m.querySelector('[data-vcancel]').onclick = () => done(false);
            m.querySelector('[data-vok]').onclick = () => done(true);
            m.addEventListener('click', (e) => { if (e.target === m)
                done(false); });
            document.body.appendChild(m);
        });
    }
    _renderValidationSummary(issues) { const wrap = this.overlay.querySelector('#sv2-alerts'); wrap.innerHTML = ''; if (!issues.length) {
        const e = document.createElement('div');
        e.className = 'sv2-alert';
        e.style.borderColor = '#36d17c';
        e.textContent = '✓ Itinéraire et horaire valides — marge automatique 0 s';
        wrap.appendChild(e);
        return;
    } for (const i of issues.slice(0, 10)) {
        const level = i.level === 'ERROR' ? 'red' : i.level === 'WARNING' ? 'orange' : '';
        const e = document.createElement('div');
        e.className = `sv2-alert ${level}`;
        e.textContent = `${i.level === 'ERROR' ? '🔴' : i.level === 'WARNING' ? '🟠' : 'ℹ'} ${i.message}`;
        wrap.appendChild(e);
    } }
    _autosaveSoon() { clearTimeout(this._autosaveTimer); this._autosaveTimer = setTimeout(() => this._autosave(), 500); }
    _autosave() { try {
        this._flushRotationRecalc();
        const p = this._activePath(), routePointCount = Number(p?.routePoints?.length || 0), lowMemory = routePointCount > 12000;
        if (lowMemory)
            this.game?.orm?.releaseScheduleRoutingMemory?.({ aggressive: true });
        this.game.saveState?.({ lowMemory, routePointCount });
    }
    catch (e) {
        console.warn('V2 autosave:', e);
    } }
    renderList() {
        const container = document.getElementById('schedules-list');
        if (!container)
            return;
        const mgr = this.game.scheduleV2;
        const rotationsRequired = this.game.realismSettings?.rotationsRequired === true;
        const modeBanner = rotationsRequired
            ? `<div class="sv2-alert orange" style="margin:0 0 10px"><b>Roulements avancés obligatoires</b> — après validation, ajoutez chaque horaire à une ligne de roulement. L’affectation directe d’une rame est désactivée.</div>`
            : `<div class="sv2-alert green" style="margin:0 0 10px"><b>Mode simple actif</b> — pour un joueur novice : <b>1. Valider l’horaire → 2. cliquer 🚆 Affecter une rame → 3. le train peut circuler.</b> Les Roulements restent facultatifs.</div>`;
        const all = [...mgr.schedules].sort((a, b) => (a.currentVersion.firstDepartureSec || 0) - (b.currentVersion.firstDepartureSec || 0));
        const norm = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-–—]+/g, ' ').toLocaleLowerCase('fr').trim();
        const q = norm(document.getElementById('schedules-search')?.value || '');
        const schedules = q ? all.filter((rec) => { const v = rec.currentVersion; const hay = norm([rec.number, rec.name, catLabel(v.category), ...(v.locations || []).flatMap((l) => [l.name, l.stationId, l.track?.displayName])].filter(Boolean).join(' ')); return hay.includes(q); }) : all;
        const count = document.getElementById('schedules-search-count');
        if (count)
            count.textContent = q ? `${schedules.length} / ${all.length} horaire(s)` : `${all.length} horaire(s)`;
        if (!all.length) {
            container.innerHTML = modeBanner + '<div class="sv2-empty">Aucun horaire V2. Cliquez « + Créer un horaire » puis directement sur une gare.</div>';
            return;
        }
        if (!schedules.length) {
            container.innerHTML = modeBanner + `<div class="sv2-empty">Aucun horaire ne correspond à « ${esc(q)} ».</div>`;
            return;
        }
        // RC2: one shared validation per render, not a full pairwise audit per row.
        const materialConflicts = rotationsRequired ? [] : (this.game.rotationV2?.validateMaterialConflicts?.() || []);
        const rows = schedules.map((rec) => {
            const v = rec.currentVersion, first = v.locations[0], last = v.locations.at(-1);
            const rt = mgr.roundTrips.find((g) => g.outboundScheduleId === rec.id || g.returnScheduleId === rec.id), isReturn = rt?.returnScheduleId === rec.id;
            const ready = this._operationalReadiness(rec, v, materialConflicts);
            const refs = this.game.rotationV2?.findScheduleReferences?.(rec.id) || [];
            const direct = this.game.rotationV2?.getDirectAssignment?.(rec.id, v.id);
            const directRame = direct?.rameId ? this.game.rameManager?.getById?.(direct.rameId) : null;
            const valid = v.state === ScheduleState.VALID;
            let materialLabel, materialTitle, materialPrimary = false;
            if (refs.length) {
                materialLabel = 'Roulement ✓';
                materialTitle = `Géré par ${refs.map((x) => x.rotationName).join(', ')}`;
            }
            else if (rotationsRequired) {
                materialLabel = 'Ajouter au roulement';
                materialTitle = valid ? 'Ajouter cet horaire à une ligne de roulement.' : 'Validez d’abord cet horaire.';
                materialPrimary = valid;
            }
            else if (directRame) {
                materialLabel = `🚆 Rame : ${directRame.name || directRame.serialNumber || directRame.id} ✓`;
                materialTitle = 'Cliquer pour modifier ou retirer la rame affectée.';
                materialPrimary = true;
            }
            else {
                materialLabel = '🚆 Affecter une rame';
                materialTitle = valid ? 'Affecter directement une rame à cet horaire (mode simple).' : 'Validez d’abord cet horaire, puis affectez une rame.';
                materialPrimary = valid;
            }
            return `<div class="sv2-list-row"><b>${esc(rec.number || '—')}</b><div><b>${esc(rec.name || 'Sans nom')}</b><br><small>${esc(catLabel(v.category))} • v${v.version}</small></div><div>${esc(first?.name || '?')} → ${esc(last?.name || '?')}<br><small>${formatScheduleClock(v.firstDepartureSec || 0)} • ${kmText(v.outboundPath.distanceKm)}${isReturn ? ' • retour' : ''}</small></div><div style="display:flex;flex-direction:column;gap:4px"><span class="sv2-state ${htmlText(stateClass(v.state))}">${htmlText(stateLabel(v.state))}</span>${valid ? `<span class="sv2-state ${htmlText(ready.cls)}" title="${esc(ready.message || ready.label)}">${esc(ready.label)}</span>` : ''}</div><div class="sv2-list-actions"><button class="sv2-btn" data-edit-v2="${htmlText(rec.id)}">Éditer</button><button class="sv2-btn ${htmlText(materialPrimary ? 'sv2-primary' : '')}" data-direct-v2="${htmlText(rec.id)}" title="${esc(materialTitle)}" ${!valid ? 'disabled' : ''}>${esc(materialLabel)}</button><button class="sv2-btn" data-dup-v2="${htmlText(rec.id)}">Dupliquer / fréquence</button><button class="sv2-btn sv2-danger" data-del-v2="${htmlText(rec.id)}">Suppr.</button></div></div>`;
        }).join('');
        container.innerHTML = modeBanner + rows;
        container.querySelectorAll('[data-edit-v2]').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.editV2)));
        container.querySelectorAll('[data-direct-v2]').forEach((b) => b.addEventListener('click', () => this._directAssignmentDialog(b.dataset.directV2)));
        container.querySelectorAll('[data-dup-v2]').forEach((b) => b.addEventListener('click', () => this._duplicateScheduleDialog(b.dataset.dupV2)));
        container.querySelectorAll('[data-del-v2]').forEach((b) => b.addEventListener('click', () => this._deleteScheduleFromList(b.dataset.delV2)));
    }
    _duplicateScheduleDialog(id) {
        const mgr = this.game.scheduleV2, rec = mgr.getSchedule(id);
        if (!rec)
            return;
        document.getElementById('sv2-frequency-modal')?.remove();
        const v = rec.currentVersion, base = Number(v?.firstDepartureSec || 0), rt = mgr.roundTrips.find((g) => g.outboundScheduleId === id || g.returnScheduleId === id);
        const outbound = rt ? mgr.getSchedule(rt.outboundScheduleId) : rec;
        const outboundBase = Number(outbound?.currentVersion?.firstDepartureSec || base);
        const m = document.createElement('div');
        m.id = 'sv2-frequency-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9350;background:#000a;display:flex;align-items:center;justify-content:center';
        m.innerHTML = `<div style="width:min(590px,94vw);background:#0d1928;border:1px solid #38516d;border-radius:10px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">Dupliquer / créer une fréquence</h3><p style="color:#9db0c8"><b>${esc(rec.number || '—')} — ${esc(rec.name || 'Sans nom')}</b><br>Départ de référence : ${formatScheduleClock(base)}</p><div class="sv2-grid"><div class="sv2-field"><label>Intervalle entre départs (min)</label><input id="sv2-freq-min" type="number" min="1" max="1440" value="5"></div><div class="sv2-field"><label>Générer par</label><select id="sv2-freq-mode"><option value="COUNT">Nombre de trains</option><option value="UNTIL">Heure de fin</option></select></div></div><div id="sv2-freq-count-box" class="sv2-field"><label>Nombre de trains dans la série</label><input id="sv2-freq-count" type="number" min="1" max="500" value="2"><label style="display:block;margin-top:6px"><input id="sv2-freq-include-original" type="checkbox" checked> Inclure l’horaire d’origine dans ce nombre</label></div><div id="sv2-freq-until-box" class="sv2-field" style="display:none"><label>Créer des départs jusqu’à</label><input id="sv2-freq-until" value="${htmlText(formatScheduleClock(outboundBase + 3600))}"><small style="color:#9db0c8">Formats acceptés : 14:30, J+1 00:15 ou 00:15 (+1). Limite : 24 h après le départ d’origine.</small></div>${rt ? `<div class="sv2-field"><label style="display:block"><input id="sv2-freq-roundtrip" type="checkbox" checked> Dupliquer aussi l’aller-retour lié</label><small style="color:#9db0c8">Le couple reste lié. Numérotation : +1 au retour, +2 au prochain aller.</small></div>` : ''}<div id="sv2-freq-summary" style="padding:8px;background:#0b2137;border-radius:5px;margin:9px 0;color:#a9bdd4"></div><p style="color:#9db0c8;font-size:10px">Les nouvelles copies conservent trajet ORM, arrêts, calendriers et état de validation. Aucune rame directe ni affectation de roulement n’est recopiée.</p><div style="display:flex;justify-content:flex-end;gap:6px"><button class="sv2-btn" data-freq-close>Annuler</button><button class="sv2-btn sv2-primary" id="sv2-freq-create">Créer</button></div></div>`;
        document.body.appendChild(m);
        const mode = m.querySelector('#sv2-freq-mode'), countBox = m.querySelector('#sv2-freq-count-box'), untilBox = m.querySelector('#sv2-freq-until-box'), summary = m.querySelector('#sv2-freq-summary');
        const refresh = () => { const intv = Math.max(1, Number(m.querySelector('#sv2-freq-min').value || 5)); if (mode.value === 'COUNT') {
            countBox.style.display = '';
            untilBox.style.display = 'none';
            const total = Math.max(1, Number(m.querySelector('#sv2-freq-count').value || 2)), inc = m.querySelector('#sv2-freq-include-original').checked, copies = Math.max(0, total - (inc ? 1 : 0));
            summary.textContent = `${copies} nouvelle(s) circulation(s) • toutes les ${intv} min${inc ? ' • original inclus dans le total' : ''}`;
        }
        else {
            countBox.style.display = 'none';
            untilBox.style.display = '';
            summary.textContent = `Départs toutes les ${intv} min jusqu’à ${m.querySelector('#sv2-freq-until').value || '—'}`;
        } };
        mode.onchange = refresh;
        m.querySelectorAll('input,select').forEach((x) => x.addEventListener('input', refresh));
        refresh();
        const close = () => m.remove();
        m.querySelector('[data-freq-close]').onclick = close;
        m.addEventListener('click', (e) => { if (e.target === m)
            close(); });
        m.querySelector('#sv2-freq-create').onclick = () => {
            try {
                const intervalSec = Math.max(60, Math.round(Number(m.querySelector('#sv2-freq-min').value || 0) * 60));
                if (!Number.isFinite(intervalSec))
                    throw new Error('Intervalle invalide.');
                const linked = !!rt && !!m.querySelector('#sv2-freq-roundtrip')?.checked;
                let made = [];
                if (mode.value === 'COUNT') {
                    const total = Math.max(1, Math.floor(Number(m.querySelector('#sv2-freq-count').value || 0))), includeOriginal = m.querySelector('#sv2-freq-include-original').checked, copies = Math.max(0, total - (includeOriginal ? 1 : 0));
                    if (copies < 1)
                        throw new Error('Aucun nouvel horaire à créer.');
                    if (linked) {
                        if (outbound.currentVersion.state !== ScheduleState.VALID || mgr.getSchedule(rt.returnScheduleId)?.currentVersion?.state !== ScheduleState.VALID)
                            throw new Error('Validez l’aller et le retour avant de créer une fréquence liée.');
                        made = mgr.duplicateRoundTrip(rt.id, { intervalSec, horizonSec: Math.min(86400, copies * intervalSec), maxPairs: copies }, null);
                    }
                    else
                        made = mgr.duplicateScheduleFrequency(id, { intervalSec, totalCount: total, includeOriginal, maxCopies: 500 });
                }
                else {
                    const baseRef = linked ? outboundBase : base;
                    const until = parseScheduleClock(m.querySelector('#sv2-freq-until').value, baseRef);
                    if (until == null || until <= baseRef)
                        throw new Error('Heure de fin invalide.');
                    if (until - baseRef > 86400)
                        throw new Error('La fréquence est limitée à 24 h.');
                    if (linked) {
                        if (outbound.currentVersion.state !== ScheduleState.VALID || mgr.getSchedule(rt.returnScheduleId)?.currentVersion?.state !== ScheduleState.VALID)
                            throw new Error('Validez l’aller et le retour avant de créer une fréquence liée.');
                        made = mgr.duplicateRoundTrip(rt.id, { intervalSec, horizonSec: until - outboundBase, maxPairs: 500 }, null);
                    }
                    else
                        made = mgr.duplicateScheduleFrequency(id, { intervalSec, untilDepartureSec: until, maxCopies: 500 });
                }
                this.game.saveState();
                close();
                this.renderList();
                this._showTransientAlert('yellow', linked ? `${made.length} aller-retour créé(s) par fréquence.` : `${made.length} horaire(s) créé(s) par fréquence.`);
            }
            catch (err) {
                alert(err.message);
            }
        };
    }
    _deleteScheduleFromList(id) { const refs = this.game.rotationV2?.findScheduleReferences(id) || []; let cascade = false; if (refs.length) {
        const msg = `Cet horaire est utilisé ${refs.length} fois dans des roulements.\n\nOK = supprimer aussi ces références\nAnnuler = conserver`;
        if (!confirm(msg))
            return;
        cascade = true;
    }
    else if (!confirm('Supprimer cet horaire ?'))
        return; this.game.scheduleV2.removeSchedule(id, { cascade, rotationManager: this.game.rotationV2 }); this.game._forceV2RuntimeSyncNow?.(); this.game.saveState(); this.renderList(); }
}
// Diagnostic export lineage retained from v1.1.87-DIAG2.
export default ScheduleV2Editor;
