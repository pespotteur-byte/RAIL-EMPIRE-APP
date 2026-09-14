import { sharedTileAccessPolicy, TILE_REFERRER_POLICY, OSM_STANDARD_URL, isOSMStandard, tileSourceKey, validateBaseMapSource, tilePolicyStorage, tileRequestOptions, tileResponseBlockReason } from './tile-access-policy.js';
import type { BaseMapSource, TileAccessState } from './tile-access-policy.js';
import { nightLightsOpacity, nightAppearanceLabel, NIGHT_LIGHTS_NATIVE_ZOOM, SATELLITE_NIGHT_TINT, OSM_DARK_FILTER } from './map-lighting.js';
type __KPStruct126 = string;
type TileRecord = { loaded: boolean; error: boolean; img: HTMLImageElement | null; errorTime: number;
    retryAt?: number; cacheKey?: string; inspectStatus?: boolean };
type TileQueueItem = {
    tile: TileRecord;
    url: string;
    z: number;
    viewZ?: number;
    isWeather?: boolean;
    key: string;
};
export class TileMap {
    readonly tileAccess = sharedTileAccessPolicy();
    private _unsubscribeAccess: () => void;
    private _renderCanvas: HTMLCanvasElement | null = null;
    private _baseTilesDrawn = 0;
    private _mapCredit: HTMLDivElement | null = null;
    private _baseSource: BaseMapSource = { url: OSM_STANDARD_URL, attribution: '© OpenStreetMap contributors', maxZoom: 19 };
    private _loads = new Map<TileRecord, { url: string; cancel: () => void }>();
    private _sourceIds = new Map<string, number>();
    private _nextSourceId = 1;
    private _collectingTiles = false;
    private _visibleTileKeys = new Set<string>();
    private _networkEnabled = true;
    private _draining = false;
    private _retryTimer: ReturnType<typeof setTimeout> | null = null;
    private _retryDeadline = 0;
    private _frameCacheWidth = -1;
    private _frameCacheHeight = -1;
    private readonly _unavailableTile: TileRecord = { loaded: false, error: true, img: null, errorTime: 0 };
    readonly networkStats = { started: 0, loaded: 0, failed: 0, cancelled: 0, discardedQueued: 0, peakActive: 0 };
    declare tileSize: number;
    declare tileCache: Map<string, TileRecord>;
    declare centerLat: number;
    declare centerLon: number;
    declare zoomLevel: number;
    declare minZoom: number;
    declare maxZoom: number;
    declare viewportWidth: number;
    declare viewportHeight: number;
    declare _baseLoading: number;
    declare _railLoading: number;
    declare _defaultMaxBaseConn: number;
    declare _defaultMaxRailConn: number;
    declare _maxBaseConn: number;
    declare _maxRailConn: number;
    declare _gpsLowMemoryMode: boolean;
    declare _tileCacheLimit: number;
    declare _baseQueue: TileQueueItem[];
    declare _railQueue: TileQueueItem[];
    declare _lastQueueZoom: number;
    declare _generation: number;
    declare _zoomDebounceTimer: ReturnType<typeof setTimeout> | null;
    declare _zoomSettled: boolean;
    declare _lastRoundedZoom: number;
    declare _dirty: boolean;
    declare _lastCenterLat: number;
    declare _lastCenterLon: number;
    declare _lastZoom: number;
    declare _tileCanvas: HTMLCanvasElement | null;
    declare _tileCtx: CanvasRenderingContext2D | null;
    declare _tileBufferValid: boolean;
    declare _tileBufferW: number;
    declare _tileBufferH: number;
    declare _pendingTiles: number;
    declare _lastPendingTiles: number;
    declare sourceZoomBias: number;
    declare bufferScale: number;
    declare _tileBufferScale: number;
    declare _osmBaseTileUrls: string[];
    declare _darkBaseTileUrls: string[];
    declare _lightBaseTileUrls: string[];
    declare baseTileUrls: string[];
    declare satelliteTileUrls: string[];
    declare labelTileUrls: string[];
    declare weatherEnabled: boolean;
    declare satelliteEnabled: boolean;
    declare nightMapEnabled: boolean;
    declare nightSatelliteTileUrls: string[];
    declare _nightSatelliteMaxZoom: number;
    declare _baseMaxZoom: number;
    declare _satelliteMaxZoom: number;
    declare _railMaxZoom: number;
    declare _labelMaxZoom: number;
    declare railTileUrls: string[];
    declare railEnabled: boolean;
    declare basicMode: boolean;
    declare _basicWasRail: boolean;
    declare radarEnabled: boolean;
    declare _radarTileUrl: string | null;
    declare _radarMaxZoom: number;
    declare cloudEnabled: boolean;
    declare _cloudTileUrl: string | null;
    declare _cloudMaxZoom: number;
    declare _frameCacheZoom: number | undefined;
    declare _frameCacheLat: number | undefined;
    declare _frameCacheLon: number | undefined;
    declare _frameScale: number;
    declare _frameCx: number;
    declare _frameCy: number;
    declare _frameHalfW: number;
    declare _frameHalfH: number;
    constructor() {
        this._unsubscribeAccess = this.tileAccess.subscribe(() => {
            if (!this._networkEnabled) return;
            for (const load of [...this._loads.values()]) {
                if (this.tileAccess.state(load.url, this._protocol()).kind !== 'ready') load.cancel();
            }
            this.markDirty(); this._processQueue();
        });
        this.tileSize = 256;
        this.tileCache = new Map<string, TileRecord>();
        this.centerLat = 49.75;
        this.centerLon = 2.7;
        this.zoomLevel = 7.5;
        this.minZoom = 5;
        this.maxZoom = 20;
        this.viewportWidth = 800;
        this.viewportHeight = 600;
        // Separate loading pools: base and ORM/weather load in parallel
        this._baseLoading = 0;
        this._railLoading = 0;
        this._defaultMaxBaseConn = 4; // RC9: bounded base-service concurrency, including OSM
        this._defaultMaxRailConn = 4;
        this._maxBaseConn = this._defaultMaxBaseConn;
        this._maxRailConn = this._defaultMaxRailConn;
        // HOTFIX73 — GPS is allowed to use an aggressively bounded tile budget.
        // On old 32-bit Chromium/Opera, hundreds of decoded 256px raster images plus
        // the large tilted canvas can otherwise push the renderer into a permanent
        // freeze even though no JavaScript exception is thrown.
        this._gpsLowMemoryMode = false;
        this._tileCacheLimit = 3000;
        this._baseQueue = [];
        this._railQueue = [];
        this._lastQueueZoom = 0;
        // Generation counter — increments on zoom change to discard stale loads
        this._generation = 0;
        // Zoom debounce — wait for zoom to stabilize before loading
        this._zoomDebounceTimer = null;
        this._zoomSettled = true;
        this._lastRoundedZoom = 0;
        // Dirty flag for view changes
        this._dirty = true;
        this._lastCenterLat = 0;
        this._lastCenterLon = 0;
        this._lastZoom = 0;
        // Offscreen tile buffer
        this._tileCanvas = null;
        this._tileCtx = null;
        this._tileBufferValid = false;
        this._tileBufferW = 0;
        this._tileBufferH = 0;
        this._pendingTiles = 0;
        this._lastPendingTiles = 0;
        // HOTFIX21 — 3D quality knobs. sourceZoomBias=1 requests one extra tile
        // zoom level while preserving the same geographic camera zoom; bufferScale
        // keeps that extra source detail instead of immediately downsampling it.
        this.sourceZoomBias = 0;
        this.bufferScale = 1;
        this._tileBufferScale = 1;
        // One standard URL; no host rotation, proxy or fake browser identity.
        this._osmBaseTileUrls = [OSM_STANDARD_URL];
        this._darkBaseTileUrls = this._osmBaseTileUrls;
        this._lightBaseTileUrls = this._osmBaseTileUrls;
        this.baseTileUrls = this._osmBaseTileUrls;
        try {
            const raw = tilePolicyStorage()?.getItem('rail-empire.basemap.v1');
            if (raw) this._baseSource = validateBaseMapSource(JSON.parse(raw));
        } catch { /* Invalid preferences fall back to the standard source. */ }
        if (this._baseSource.url !== OSM_STANDARD_URL) this.baseTileUrls = [this._baseSource.url];
        this.satelliteTileUrls = [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ];
        // Satellite remains imagery-only: do not reintroduce the former CARTO
        // transparent label tiles, because those are exactly the tiles that can carry
        // the API-key watermark. Rail Empire's own station labels stay available.
        this.labelTileUrls = [];
        // Single météo toggle drives satellite + radar + clouds
        this.weatherEnabled = false;
        this.satelliteEnabled = false;
        // RC23 — night is a style of the selected base, never an implicit provider switch.
        // Regional NASA lights fade out completely before local GPS zoom; detailed
        // night is honestly a day-imagery tint, not claimed nighttime photography.
        this.nightMapEnabled = false;
        this.nightSatelliteTileUrls = [
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
        ];
        this._nightSatelliteMaxZoom = NIGHT_LIGHTS_NATIVE_ZOOM;
        this._baseMaxZoom = 20; // HOTFIX27 visual/native contract; OSM source is clamped separately below
        this._satelliteMaxZoom = 20;
        this._railMaxZoom = 19;
        this._labelMaxZoom = 20;
        this.railTileUrls = [
            'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
            'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
            'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        ];
        this.railEnabled = true; // ORM layer visible by default
        this.basicMode = false; // basic map: light base, no ORM overlay
        this._basicWasRail = true; // remember ORM state when switching back from basic
        // Weather radar overlay (RainViewer)
        this.radarEnabled = false;
        this._radarTileUrl = null;
        this._radarMaxZoom = 7; // RainViewer max zoom officiel
        // Cloud overlay — NASA GIBS true-color satellite (XIV)
        this.cloudEnabled = false;
        this._cloudTileUrl = null;
        this._cloudMaxZoom = 9; // GIBS VIIRS/NOAA-20 True Color max zoom
    }
    private _protocol(): string { return typeof location === 'undefined' ? 'https:' : location.protocol; }
    getBaseMapSource(): BaseMapSource { return { ...this._baseSource }; }
    /** Count is used only to distinguish real pixels from an empty/loading canvas. */
    hasVisibleBaseTiles(): boolean { return this._baseTilesDrawn > 0; }
    /** Explicit user choice. Does NOT reset a refusal, cache or retry deadline. */
    selectOSMStandard(): void {
        this.setBaseMapSource({ url: OSM_STANDARD_URL, attribution: '© OpenStreetMap contributors', maxZoom: 19 });
        this.setBasicMode(true);
    }
    setBasicMode(enabled: boolean): void {
        this.basicMode = !!enabled;
        if (this.basicMode) {
            this.setNightMapEnabled(false);
            this.setSatelliteEnabled(false);
        }
        // ORM is an independent overlay; choosing original OSM must not disable it.
        this.markDirty();
    }
    private _updateMapCredit(canvas: HTMLCanvasElement | null): void {
        // LiveMap has its own permanently visible credit. Editors receive the same
        // licence link here, outside their canvas and outside collapsible controls.
        if (!canvas || canvas.id === 'game-canvas' || !canvas.parentElement || !canvas.ownerDocument) return;
        const parent = canvas.parentElement;
        if (!this._mapCredit || this._mapCredit.parentElement !== parent) {
            this._mapCredit?.remove();
            const doc = canvas.ownerDocument;
            const credit = doc.createElement('div');
            credit.className = 're-map-credit';
            if (typeof getComputedStyle === 'function' && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
            parent.appendChild(credit); this._mapCredit = credit;
        }
        const text = this.getMapCreditText() + ' · Licence OSM';
        if (this._mapCredit.textContent !== text) {
            this._mapCredit.textContent = text.slice(0, -'Licence OSM'.length);
            const link = canvas.ownerDocument.createElement('a');
            link.href = 'https://www.openstreetmap.org/copyright';
            link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Licence OSM';
            this._mapCredit.appendChild(link);
        }
    }
    getNightLightsOpacity(): number {
        return nightLightsOpacity(this.zoomLevel, this.nightMapEnabled, this.satelliteEnabled);
    }
    getMapAppearanceLabel(): string {
        return nightAppearanceLabel(this.nightMapEnabled, this.satelliteEnabled, this.zoomLevel);
    }
    getMapCreditText(): string {
        const source = this._baseSource;
        const base = this.satelliteEnabled ? '© OpenStreetMap contributors · Esri World Imagery'
            : /openstreetmap/i.test(source.attribution) ? source.attribution : source.attribution + ' · © OpenStreetMap contributors';
        return base + (this.getNightLightsOpacity() > 0 ? ' · NASA GIBS / VIIRS Black Marble' : '')
            + (this.railEnabled ? ' · OpenRailwayMap' : '');
    }
    getBaseMapAccess(): TileAccessState { return this.tileAccess.state(this._baseSource.url, this._protocol()); }
    getRailMapAccess(): TileAccessState { return this.tileAccess.state(this.railTileUrls[0], this._protocol()); }
    pauseRailMap(): void {
        this.tileAccess.pause(this.railTileUrls[0]); this._stopSourceLoads(this.railTileUrls[0]); this.markDirty();
    }
    resumeRailMap(): boolean {
        if (!this.tileAccess.resume(this.railTileUrls[0], this._protocol())) return false;
        for (const [key, tile] of this.tileCache) if (tile.error && key.endsWith('/r')) this.tileCache.delete(key);
        this.markDirty(); return true;
    }
    setBaseMapSource(source: BaseMapSource): void {
        const next = validateBaseMapSource(source);
        if (next.url === this._baseSource.url && next.attribution === this._baseSource.attribution && next.maxZoom === this._baseSource.maxZoom) return;
        this._baseSource = next;
        this.baseTileUrls = next.url === OSM_STANDARD_URL ? this._osmBaseTileUrls : [next.url];
        this._restartTileLoadPipelines();
        try { tilePolicyStorage()?.setItem('rail-empire.basemap.v1', JSON.stringify(next)); } catch { /* session only */ }
        this.markDirty();
    }
    pauseBaseMap(): void {
        this.tileAccess.pause(this._baseSource.url);
        this._stopSourceLoads(this._baseSource.url);
        this.markDirty();
    }
    resumeBaseMap(): boolean {
        if (!this.tileAccess.resume(this._baseSource.url, this._protocol())) return false;
        // Loaded tiles remain reusable. Failed entries must be eligible immediately after a deliberate retry.
        for (const [key, tile] of this.tileCache) if (tile.error) this.tileCache.delete(key);
        this.markDirty(); return true;
    }
    setNetworkEnabled(enabled: boolean): void {
        if (this._networkEnabled === enabled) return;
        this._networkEnabled = enabled;
        if (!enabled) this._restartTileLoadPipelines();
        this.markDirty();
    }
    onDocumentVisibilityChange(): void {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this._restartTileLoadPipelines();
        this.markDirty();
    }
    private _networkCanRun(): boolean {
        if (!this._networkEnabled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return false;
        const canvas = this._renderCanvas;
        return !canvas || typeof canvas.isConnected !== 'boolean' || (canvas.isConnected && canvas.getClientRects().length > 0);
    }
    private _scheduleWake(deadline: number): void {
        if (!deadline || deadline <= Date.now() || (this._retryTimer && this._retryDeadline <= deadline)) return;
        if (this._retryTimer) clearTimeout(this._retryTimer);
        this._retryDeadline = deadline;
        this._retryTimer = setTimeout(() => {
            this._retryTimer = null; this._retryDeadline = 0; this.markDirty();
        }, Math.min(2_147_483_647, Math.max(1, deadline - Date.now())));
    }
    private _tileSuffix(urlTemplate: string): string {
        if (urlTemplate.includes('openrailway')) return 'r';
        if (urlTemplate === this._cloudTileUrl || (urlTemplate.includes('rainviewer') && urlTemplate.includes('/0/0_0.'))) return 'c';
        if (urlTemplate.includes('rainviewer') && urlTemplate.includes('/2/1_1.')) return 'w';
        if (urlTemplate.includes('VIIRS_Black_Marble')) return 'n';
        if (urlTemplate.includes('arcgisonline')) return 's';
        if (urlTemplate.includes('only_labels')) return 'l';
        return 'b';
    }
    private _tileKey(tx: number, ty: number, z: number, template: string): string {
        // Source identity is independent from display style. Weather timestamps and custom
        // providers must NOT alias another source's pixels at the same coordinates.
        const canonical = template.replace(/https:\/\/[abc]\.tiles\.openrailwaymap\.org\//, 'https://tiles.openrailwaymap.org/');
        let id = this._sourceIds.get(canonical);
        if (id === undefined) {
            if (this._sourceIds.size >= 64) this._sourceIds.delete(this._sourceIds.keys().next().value!);
            id = this._nextSourceId++; this._sourceIds.set(canonical, id);
        }
        return `${z}/${tx}/${ty}/${id}/${this._tileSuffix(template)}`;
    }
    private _stopSourceLoads(url: string): void {
        const source = tileSourceKey(url);
        for (const load of [...this._loads.values()]) if (tileSourceKey(load.url) === source) load.cancel();
        for (const queue of [this._baseQueue, this._railQueue]) {
            for (let i = queue.length - 1; i >= 0; i--) if (tileSourceKey(queue[i].url) === source) {
                const item = queue.splice(i, 1)[0];
                if (this.tileCache.get(item.key) === item.tile) this.tileCache.delete(item.key);
                this.networkStats.discardedQueued++;
            }
        }
    }
    private _pruneViewportRequests(): void {
        for (const queue of [this._baseQueue, this._railQueue]) {
            for (let i = queue.length - 1; i >= 0; i--) if (!this._visibleTileKeys.has(queue[i].key)) {
                const item = queue.splice(i, 1)[0];
                if (this.tileCache.get(item.key) === item.tile) this.tileCache.delete(item.key);
                this.networkStats.discardedQueued++;
            }
        }
        for (const [tile, load] of [...this._loads]) if (tile.cacheKey && !this._visibleTileKeys.has(tile.cacheKey)) load.cancel();
    }
    dispose(): void {
        this._networkEnabled = false; this._unsubscribeAccess(); this._restartTileLoadPipelines();
        if (this._zoomDebounceTimer) clearTimeout(this._zoomDebounceTimer);
        if (this._retryTimer) clearTimeout(this._retryTimer);
        this._retryTimer = null; this.tileCache.clear(); this._releaseTileBuffer();
        this._mapCredit?.remove(); this._mapCredit = null;
    }
    markDirty() { this._dirty = true; this._tileBufferValid = false; }
    // HOTFIX73 — invalidate every in-flight loader before counters are reset.
    // Previous satellite/night switches did `_baseLoading = 0` while old Image
    // callbacks were still alive. Those callbacks later decremented the new counter
    // below zero, effectively defeating the connection cap and causing decode storms.
    _restartTileLoadPipelines() {
        this._generation++;
        for (const load of [...this._loads.values()]) load.cancel();
        this._baseLoading = 0;
        this._railLoading = 0;
        this._baseQueue = [];
        this._railQueue = [];
        for (const [k, tile] of this.tileCache) {
            if (!tile?.loaded)
                this.tileCache.delete(k);
        }
    }
    _releaseTileBuffer() {
        if (this._tileCanvas) {
            // Shrinking first releases the backing store immediately in old Chromium.
            this._tileCanvas.width = 1;
            this._tileCanvas.height = 1;
        }
        this._tileCanvas = null;
        this._tileCtx = null;
        this._tileBufferValid = false;
        this._tileBufferW = 0;
        this._tileBufferH = 0;
        this._tileBufferScale = 1;
    }
    setGPSLowMemoryMode(enabled:boolean) {
        const next = !!enabled;
        if (this._gpsLowMemoryMode === next)
            return false;
        this._gpsLowMemoryMode = next;
        this._maxBaseConn = next ? 4 : this._defaultMaxBaseConn;
        this._maxRailConn = next ? 4 : this._defaultMaxRailConn;
        this._tileCacheLimit = next ? 600 : 3000;
        // A GPS mode transition is rare, so prefer a deterministic clean slate over
        // keeping hundreds of decoded tiles from the previous 2D/satellite mode.
        this._restartTileLoadPipelines();
        this.tileCache.clear();
        this._releaseTileBuffer();
        this._dirty = true;
        return true;
    }
    _effectiveTileZoom() {
        return Math.round(this.zoomLevel + Math.max(0, Math.min(1, Number(this.sourceZoomBias || 0))));
    }
    setRenderQuality(sourceZoomBias: unknown = 0, bufferScale: unknown = 1) {
        const bias = Math.max(0, Math.min(1, Math.round(Number(sourceZoomBias || 0))));
        const scale = Math.max(1, Math.min(1.5, Number(bufferScale || 1)));
        if (bias === this.sourceZoomBias && Math.abs(scale - this.bufferScale) < 1e-6)
            return;
        this.sourceZoomBias = bias;
        this.bufferScale = scale;
        this._restartTileLoadPipelines();
        this._lastRoundedZoom = this._effectiveTileZoom();
        this._zoomSettled = true;
        this.markDirty();
    }
    _checkDirty() {
        if (this.centerLat !== this._lastCenterLat ||
            this.centerLon !== this._lastCenterLon ||
            this.zoomLevel !== this._lastZoom) {
            this._dirty = true;
            this._tileBufferValid = false;
            // Detect zoom level change (integer) → discard stale + debounce
            const newZ = this._effectiveTileZoom();
            if (newZ !== this._lastRoundedZoom) {
                this._lastRoundedZoom = newZ;
                this._restartTileLoadPipelines();
                // Debounce: don't load new tiles until zoom stable for 80ms
                this._zoomSettled = false;
                clearTimeout(this._zoomDebounceTimer!);
                this._zoomDebounceTimer = setTimeout(() => {
                    this._zoomSettled = true;
                    this._dirty = true;
                    this._tileBufferValid = false;
                    this._processQueue();
                }, 80);
            }
            this._lastCenterLat = this.centerLat;
            this._lastCenterLon = this.centerLon;
            this._lastZoom = this.zoomLevel;
        }
    }
    get isDirty() {
        this._checkDirty();
        return this._dirty;
    }
    clearDirty() { this._dirty = false; }
    latLonToGlobalPixel(lat:number, lon:number, zoom:number) {
        const scale = Math.pow(2, zoom) * this.tileSize;
        const x = ((lon + 180) / 360) * scale;
        const sinLat = Math.sin((lat * Math.PI) / 180);
        const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
        return { x, y };
    }
    globalPixelToLatLon(px: number, py: number, zoom:number) {
        const scale = Math.pow(2, zoom) * this.tileSize;
        const lon = (px / scale) * 360 - 180;
        const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / scale))) * 180) / Math.PI;
        return { lat, lon };
    }
    // Cache center projection per frame to avoid redundant trig
    _updateFrameCache() {
        if (this._frameCacheZoom === this.zoomLevel &&
            this._frameCacheLat === this.centerLat &&
            this._frameCacheLon === this.centerLon &&
            this._frameCacheWidth === this.viewportWidth && this._frameCacheHeight === this.viewportHeight)
            return;
        this._frameCacheWidth = this.viewportWidth;
        this._frameCacheHeight = this.viewportHeight;
        this._frameCacheZoom = this.zoomLevel;
        this._frameCacheLat = this.centerLat;
        this._frameCacheLon = this.centerLon;
        const s = Math.pow(2, this.zoomLevel) * this.tileSize;
        this._frameScale = s;
        this._frameCx = ((this.centerLon + 180) / 360) * s;
        const sinC = Math.sin((this.centerLat * Math.PI) / 180);
        this._frameCy = (0.5 - Math.log((1 + sinC) / (1 - sinC)) / (4 * Math.PI)) * s;
        this._frameHalfW = this.viewportWidth / 2;
        this._frameHalfH = this.viewportHeight / 2;
    }
    // Fast inline projection using cached center (avoids 2x trig per call)
    worldToScreenFast(lat:number, lon:number) {
        const s = this._frameScale;
        const x = ((lon + 180) / 360) * s;
        const sinLat = Math.sin((lat * Math.PI) / 180);
        const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * s;
        return { x: x - this._frameCx + this._frameHalfW, y: y - this._frameCy + this._frameHalfH };
    }
    worldToScreen(lat:number, lon:number, canvasW: number, canvasH: number) {
        // Use fast path if frame cache is valid
        if (this._frameScale && canvasW === this.viewportWidth && canvasH === this.viewportHeight) {
            return this.worldToScreenFast(lat, lon);
        }
        const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
        const point = this.latLonToGlobalPixel(lat, lon, this.zoomLevel);
        return {
            x: point.x - center.x + canvasW / 2,
            y: point.y - center.y + canvasH / 2,
        };
    }
    screenToWorld(sx: number, sy: number, canvasW: number, canvasH: number) {
        const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
        const px = sx - canvasW / 2 + center.x;
        const py = sy - canvasH / 2 + center.y;
        return this.globalPixelToLatLon(px, py, this.zoomLevel);
    }
    pan(dx: number, dy: number) {
        const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
        const newCenter = this.globalPixelToLatLon(center.x - dx, center.y - dy, this.zoomLevel);
        this.centerLat = Math.max(-85, Math.min(85, newCenter.lat));
        this.centerLon = newCenter.lon;
    }
    applyZoom(delta: number, sx: unknown, sy: unknown) {
        const worldBefore = this.screenToWorld(sx as number, sy as number, this.viewportWidth, this.viewportHeight);
        const step = delta > 0 ? 0.25 : -0.25;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + step));
        const worldAfter = this.screenToWorld(sx as number, sy as number, this.viewportWidth, this.viewportHeight);
        this.centerLat -= worldAfter.lat - worldBefore.lat;
        this.centerLon -= worldAfter.lon - worldBefore.lon;
    }
    _processQueue() {
        if (!this._zoomSettled || this._collectingTiles || this._draining || !this._networkCanRun()) return;
        this._draining = true;
        try {
            const curZ = this._effectiveTileZoom();
            this._drainPool(this._baseQueue, curZ, false);
            this._drainPool(this._railQueue, curZ, true);
        } finally { this._draining = false; }
    }
    _drainPool(queue: TileQueueItem[], curZ: number, isRail: boolean) {
        const max = isRail ? this._maxRailConn : this._maxBaseConn;
        let remaining = queue.length;
        while (queue.length && remaining-- > 0 && this._networkCanRun() && (isRail ? this._railLoading : this._baseLoading) < max) {
            const item = queue.shift()!;
            if (item.tile.loaded || item.tile.error || this.tileCache.get(item.key) !== item.tile) continue;
            if (item.viewZ !== undefined && item.viewZ !== curZ && !item.isWeather) {
                this.tileCache.delete(item.key); this.networkStats.discardedQueued++; continue;
            }
            const access = this.tileAccess.state(item.url, this._protocol());
            if (access.kind !== 'ready') {
                this.tileCache.delete(item.key); this._scheduleWake(access.until); continue;
            }
            const release = this.tileAccess.acquire(item.url);
            if (!release) { queue.push(item); continue; }
            if (isRail) this._railLoading++; else this._baseLoading++;
            this._fetchTile(item.tile, item.url, isRail, release);
        }
    }
    _fetchTile(tile: TileRecord, url: string, isRail: boolean, releasePermit?: () => void) {
        const gen = this._generation, img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = TILE_REFERRER_POLICY;
        img.decoding = 'async';
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let settled = false, objectURL: string | null = null;
        const cleanup = () => {
            clearTimeout(timeoutId); img.onload = null; img.onerror = null;
            this._loads.delete(tile); releasePermit?.();
            if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
        };
        const releaseSlot = () => {
            if (gen !== this._generation) return;
            if (isRail) this._railLoading = Math.max(0, this._railLoading - 1);
            else this._baseLoading = Math.max(0, this._baseLoading - 1);
        };
        const cancel = () => {
            if (settled) return;
            settled = true; cleanup(); controller?.abort();
            try { img.src = ''; } catch { /* best effort */ }
            if (tile.cacheKey && this.tileCache.get(tile.cacheKey) === tile) this.tileCache.delete(tile.cacheKey);
            this.networkStats.cancelled++; releaseSlot();
        };
        const finish = (ok: boolean, status: number | null = null, retryAfter: string | null = null, blockedReason: string | null = null) => {
            if (settled) return;
            settled = true; cleanup(); releaseSlot();
            if (gen !== this._generation) return;
            if (ok) {
                tile.loaded = true; tile.img = img; tile.error = false;
                this.networkStats.loaded++; this.tileAccess.success(url, this._protocol());
            } else {
                tile.error = true; tile.errorTime = Date.now(); this.networkStats.failed++;
                const access = this.tileAccess.failure(url, status, retryAfter, Date.now(), blockedReason);
                tile.retryAt = access.until;
                this._scheduleWake(access.until);
                controller?.abort();
                // Stop the provider as a whole, not only one tile. Never rotate hosts on 403/429.
                this._stopSourceLoads(url);
            }
            this.markDirty(); this._processQueue();
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        const timeoutId = setTimeout(() => {
            finish(false);
            try { img.src = ''; } catch { /* best effort abort */ }
        }, this._gpsLowMemoryMode ? 8000 : 15000);
        this._loads.set(tile, { url, cancel });
        this.networkStats.started++;
        this.networkStats.peakActive = Math.max(this.networkStats.peakActive, this._loads.size);
        // file:// cannot set app headers on Image.src. Never fall back to an
        // anonymous request if the identified fetch API is missing or rejected.
        if (isOSMStandard(url) && this._protocol() === 'file:' && typeof fetch !== 'function') {
            finish(false); return;
        }
        if ((isOSMStandard(url) || tileSourceKey(url) === 'orm-standard' || tile.inspectStatus) && typeof fetch === 'function') {
            // Read HTTP status with the SAME request that supplies the bitmap: no probe + re-download.
            // Browser cache headers are honoured. HTTP pages keep their genuine
            // Referer; local HTML identifies RailEmpire through X-Requested-With.
            void fetch(url, tileRequestOptions(url, this._protocol(), controller?.signal)).then(async response => {
                if (settled) return;
                const blockedReason = tileResponseBlockReason(response.headers);
                if (!response.ok || blockedReason) {
                    finish(false, response.status, response.headers.get('Retry-After'), blockedReason); return;
                }
                const blob = await response.blob();
                if (settled) return;
                if (!blob.type.startsWith('image/') || blob.size > 2 * 1024 * 1024) { finish(false); return; }
                objectURL = URL.createObjectURL(blob); img.src = objectURL;
            }).catch(() => { if (!settled) finish(false); });
        } else img.src = url;
    }
    getTile(tx: number, ty: number, z: number, urlTemplate: __KPStruct126) {
        if (!urlTemplate || !Number.isInteger(z) || z < 0 || z > 30 || !Number.isInteger(tx) || !Number.isInteger(ty) ||
            tx < 0 || ty < 0 || tx >= 2 ** z || ty >= 2 ** z || (isOSMStandard(urlTemplate) && z > 19)) return this._unavailableTile;
        const key = this._tileKey(tx, ty, z, urlTemplate);
        if (this._collectingTiles) this._visibleTileKeys.add(key);
        const cached = this.tileCache.get(key);
        if (cached?.loaded) {
            // True access-order LRU: a frequently viewed tile must not be evicted as merely old.
            this.tileCache.delete(key); this.tileCache.set(key, cached); return cached;
        }
        const access = this.tileAccess.state(urlTemplate, this._protocol());
        if (access.kind !== 'ready') { this._scheduleWake(access.until); return cached || this._unavailableTile; }
        if (!this._networkCanRun()) return cached || this._unavailableTile;
        if (cached) {
            if (!cached.error || Date.now() < (cached.retryAt || cached.errorTime + 30_000)) return cached;
            this.tileCache.delete(key);
        }
        const tile: TileRecord = { loaded: false, error: false, img: null, errorTime: 0,
            cacheKey: key, inspectStatus: this.baseTileUrls.includes(urlTemplate) };
        this.tileCache.set(key, tile);
        const url = urlTemplate.replaceAll('{z}', String(z)).replaceAll('{x}', String(tx)).replaceAll('{y}', String(ty));
        const suffix = this._tileSuffix(urlTemplate), isWeather = suffix === 'w' || suffix === 'c';
        const queue = suffix === 'r' || suffix === 'l' || isWeather ? this._railQueue : this._baseQueue;
        queue.push({ tile, url, z, viewZ: this._lastQueueZoom, isWeather, key });
        // Hard queue bound even for non-rendering callers. Current viewport rendering also prunes stale requests.
        if (queue.length > (this._gpsLowMemoryMode ? 128 : 512)) {
            const removed = queue.shift()!;
            if (this.tileCache.get(removed.key) === removed.tile) this.tileCache.delete(removed.key);
            this.networkStats.discardedQueued++;
        }
        this._processQueue();
        if (this.tileCache.size > this._tileCacheLimit) {
            const currentZ = this._effectiveTileZoom();
            const target = this._tileCacheLimit - (this._gpsLowMemoryMode ? 150 : 500);
            for (let phase = 0; phase < 2 && this.tileCache.size > target; phase++) {
                for (const [k, t] of this.tileCache) {
                    if (this.tileCache.size <= target) break;
                    if (this._loads.has(t) || (!t.loaded && !t.error) || this._visibleTileKeys.has(k)) continue;
                    if (phase === 0 && !t.error && Number(k.split('/')[0]) === currentZ) continue;
                    this.tileCache.delete(k);
                }
            }
        }
        return tile;
    }
    renderTiles(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) {
        if (!canvasW || !canvasH)
            return;
        this._renderCanvas = ctx.canvas || null;
        this._updateMapCredit(this._renderCanvas);
        this._checkDirty();
        const bufferScale = Math.max(1, Math.min(1.5, Number(this.bufferScale || 1)));
        const pixelW = Math.max(1, Math.round(canvasW * bufferScale));
        const pixelH = Math.max(1, Math.round(canvasH * bufferScale));
        // Use offscreen buffer when view is static (not panning).
        if (this._tileBufferValid && this._tileCanvas &&
            this._tileBufferW === canvasW && this._tileBufferH === canvasH &&
            Math.abs(this._tileBufferScale - bufferScale) < 1e-6) {
            ctx.drawImage(this._tileCanvas, 0, 0, this._tileCanvas.width, this._tileCanvas.height, 0, 0, canvasW, canvasH);
            return;
        }
        if (!this._tileCanvas || this._tileBufferW !== canvasW || this._tileBufferH !== canvasH ||
            Math.abs(this._tileBufferScale - bufferScale) >= 1e-6) {
            this._tileCanvas = document.createElement('canvas');
            this._tileCanvas.width = pixelW;
            this._tileCanvas.height = pixelH;
            this._tileCtx = this._tileCanvas.getContext('2d');
            this._tileBufferW = canvasW;
            this._tileBufferH = canvasH;
            this._tileBufferScale = bufferScale;
        }
        // Supersampled buffer: all geometry stays in logical map pixels, while the
        // backing store keeps 1.5× detail for the later CSS/WebGL projection.
        const tctx = this._tileCtx!;
        tctx.setTransform(bufferScale, 0, 0, bufferScale, 0, 0);
        const z = this._effectiveTileZoom();
        tctx.clearRect(0, 0, canvasW, canvasH);
        // A dark, explicitly diagnosed loading surface is not an OSM substitute.
        // The original raster is drawn opaque and unfiltered when OSM is selected.
        this._baseTilesDrawn = 0;
        tctx.filter = 'none'; tctx.globalAlpha = 1;
        tctx.fillStyle = '#172331'; tctx.fillRect(0, 0, canvasW, canvasH);
        const scale = Math.pow(2, this.zoomLevel - z);
        const scaledTileSize = this.tileSize * scale;
        const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, z);
        // Pre-compute tile origin offset (avoid per-tile multiplication)
        const originX = -center.x * scale + canvasW / 2;
        const originY = -center.y * scale + canvasH / 2;
        const startTileX = Math.floor((center.x - canvasW / 2 / scale) / this.tileSize);
        const startTileY = Math.floor((center.y - canvasH / 2 / scale) / this.tileSize);
        const endTileX = Math.ceil((center.x + canvasW / 2 / scale) / this.tileSize) - 1;
        const endTileY = Math.ceil((center.y + canvasH / 2 / scale) / this.tileSize) - 1;
        const maxTile = 1 << z; // faster than Math.pow(2, z)
        const tileSize = this.tileSize;
        this._pendingTiles = 0;
        this._lastQueueZoom = z;
        this._collectingTiles = true;
        this._visibleTileKeys.clear();
        const baseUrls = this.satelliteEnabled ? this.satelliteTileUrls : this.baseTileUrls;
        const lightsOpacity = this.getNightLightsOpacity();
        const layers = [baseUrls];
        if (lightsOpacity > 0) layers.push(this.nightSatelliteTileUrls);
        if (this.satelliteEnabled && this.labelTileUrls.length) layers.push(this.labelTileUrls);
        if (this.railEnabled)
            layers.push(this.railTileUrls);
        if (this.radarEnabled && this._radarTileUrl) {
            layers.push([this._radarTileUrl]);
        }
        if (this.cloudEnabled && this._cloudTileUrl) {
            layers.push([this._cloudTileUrl]);
        }
        for (let li = 0; li < layers.length; li++) {
            const urls = layers[li];
            if (!urls.length) continue;
            const isRadarLayer = this.radarEnabled && urls[0] === this._radarTileUrl;
            const isCloudLayer = this.cloudEnabled && urls[0] === this._cloudTileUrl;
            const isSatLayer = urls === baseUrls && this.satelliteEnabled;
            const isNightSatelliteLayer = lightsOpacity > 0 && urls === this.nightSatelliteTileUrls;
            const isWeatherOverlay = isRadarLayer || isCloudLayer;
            const isNightBaseLayer = this.nightMapEnabled && this.satelliteEnabled && urls === baseUrls;
            // Default 2D map keeps the historical dark look. Basic = original OSM colours.
            const isDarkBaseLayer = !this.satelliteEnabled && (this.nightMapEnabled || !this.basicMode) && urls === baseUrls;
            // HOTFIX72 — Opera/old-Chromium safety. Canvas2D filters + `screen` on the
            // oversized GPS buffer can force extra GPU/compositor surfaces and crash
            // low-memory browsers exactly when night mode opens. Keep the genuine NASA
            // VIIRS pixels, but composite them with the cheap source-over path. The base
            // is darkened once with a translucent fill after its tiles are drawn.
            tctx.globalCompositeOperation = 'source-over';
            tctx.filter = isDarkBaseLayer
                ? OSM_DARK_FILTER
                : 'none';
            if (isNightSatelliteLayer)
                tctx.globalAlpha = lightsOpacity;
            else if (isRadarLayer)
                tctx.globalAlpha = 0.70;
            else if (isCloudLayer)
                tctx.globalAlpha = 0.85;
            let layerZ = z;
            if (isRadarLayer)
                layerZ = Math.min(z, this._radarMaxZoom);
            else if (isCloudLayer)
                layerZ = Math.min(z, this._cloudMaxZoom);
            else if (isNightSatelliteLayer)
                layerZ = Math.min(z, this._nightSatelliteMaxZoom);
            else if (isSatLayer)
                layerZ = Math.min(z, this._satelliteMaxZoom);
            else if (urls === this.baseTileUrls)
                layerZ = Math.min(z, this._baseMaxZoom, this._baseSource.maxZoom);
            else if (urls === this._osmBaseTileUrls)
                layerZ = Math.min(z, this._baseMaxZoom, this._baseSource.maxZoom);
            // OSM standard raster currently tops out below Rail Empire's visual z20;
            // retain the HOTFIX27 public contract while upscaling z19 at the closest view.
            if (urls === this._osmBaseTileUrls)
                layerZ = Math.min(layerZ, 19);
            else if (urls === this.railTileUrls)
                layerZ = Math.min(z, this._railMaxZoom);
            else if (urls === this.labelTileUrls)
                layerZ = Math.min(z, this._labelMaxZoom);
            const zoomDiff = z - layerZ;
            const upscale = 1 << zoomDiff;
            const urlsLen = urls.length;
            for (let tx = startTileX; tx <= endTileX; tx++) {
                const pxBase = originX + tx * scaledTileSize;
                for (let ty = startTileY; ty <= endTileY; ty++) {
                    if (ty < 0 || ty >= maxTile)
                        continue;
                    const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
                    const py = originY + ty * scaledTileSize;
                    if (zoomDiff > 0) {
                        const parentTx = wrappedTx >> zoomDiff;
                        const parentTy = ty >> zoomDiff;
                        const tile = this.getTile(parentTx, parentTy, layerZ, urls[(parentTx + parentTy) % urlsLen]);
                        if (tile.loaded && tile.img) {
                            if (li === 0) this._baseTilesDrawn++;
                            const srcSize = tileSize / upscale;
                            tctx.drawImage(tile.img, (wrappedTx - parentTx * upscale) * srcSize, (ty - parentTy * upscale) * srcSize, srcSize, srcSize, pxBase, py, scaledTileSize, scaledTileSize);
                        } else if (!tile.error) this._pendingTiles++;
                    }
                    else {
                        const tile = this.getTile(wrappedTx, ty, layerZ, urls[(wrappedTx + ty) % urlsLen]);
                        if (tile.loaded && tile.img) {
                            if (li === 0) this._baseTilesDrawn++;
                            tctx.drawImage(tile.img, pxBase, py, scaledTileSize, scaledTileSize);
                        }
                        else if (!tile.error && !isRadarLayer) {
                            this._pendingTiles++;
                            for (let fz = layerZ - 1; fz >= this.minZoom; fz--) {
                                const fScale = 1 << (layerZ - fz);
                                const ftx = wrappedTx >> (layerZ - fz);
                                const fty = ty >> (layerZ - fz);
                                const fTile = this.tileCache.get(this._tileKey(ftx, fty, fz, urls[(ftx + fty) % urlsLen]));
                                if (fTile && fTile.loaded && fTile.img) {
                                    if (li === 0) this._baseTilesDrawn++;
                                    const srcSize2 = tileSize / fScale;
                                    tctx.drawImage(fTile.img, (wrappedTx - ftx * fScale) * srcSize2, (ty - fty * fScale) * srcSize2, srcSize2, srcSize2, pxBase, py, scaledTileSize, scaledTileSize);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (isNightBaseLayer) {
                // One flat tint, no blur, screen blend or extra full-size surface.
                // Close views retain native detail; regional VIIRS never hides it.
                tctx.save();
                tctx.globalCompositeOperation = 'source-over';
                tctx.globalAlpha = 1;
                tctx.filter = 'none';
                tctx.fillStyle = SATELLITE_NIGHT_TINT;
                tctx.fillRect(0, 0, canvasW, canvasH);
                tctx.restore();
            }
            if (isWeatherOverlay || isNightSatelliteLayer)
                tctx.globalAlpha = 1.0;
            tctx.globalCompositeOperation = 'source-over';
            tctx.filter = 'none';
        }
        this._collectingTiles = false;
        this._pruneViewportRequests();
        this._processQueue();
        // Buffer is valid only if all tiles loaded
        this._tileBufferValid = this._pendingTiles === 0;
        this._lastPendingTiles = this._pendingTiles;
        // Blit the supersampled map back into logical coordinates. The main
        // canvas DPR then preserves that detail for the 3D compositor/DEM texture.
        ctx.drawImage(this._tileCanvas, 0, 0, this._tileCanvas.width, this._tileCanvas.height, 0, 0, canvasW, canvasH);
    }
    latLonToPixel(lat:number, lon:number) {
        return this.worldToScreen(lat, lon, this.viewportWidth, this.viewportHeight);
    }
    getPixelsPerKm() {
        const lat = this.centerLat;
        const p1 = this.latLonToGlobalPixel(lat, 0, this.zoomLevel);
        const p2 = this.latLonToGlobalPixel(lat, 0.01, this.zoomLevel);
        const pxPer001Deg = p2.x - p1.x;
        const kmPer001Deg = 0.01 * 111.32 * Math.cos((lat * Math.PI) / 180);
        return pxPer001Deg / kmPer001Deg;
    }
    setRadarTileUrl(url:string) {
        if (this._radarTileUrl !== url) {
            this._radarTileUrl = url;
            this._restartTileLoadPipelines();
            if (this.radarEnabled) {
                this._tileBufferValid = false;
                this._dirty = true;
            }
        }
    }
    toggleRadar() {
        this.radarEnabled = !this.radarEnabled;
        this._tileBufferValid = false;
        this._dirty = true;
        return this.radarEnabled;
    }
    setCloudTileUrl(url:string) {
        if (this._cloudTileUrl !== url) {
            this._cloudTileUrl = url;
            this._restartTileLoadPipelines();
            if (this.cloudEnabled) {
                this._tileBufferValid = false;
                this._dirty = true;
            }
        }
    }
    toggleCloud() {
        this.cloudEnabled = !this.cloudEnabled;
        this._tileBufferValid = false;
        this._dirty = true;
        return this.cloudEnabled;
    }
    toggleBasic() {
        this.setBasicMode(!this.basicMode);
        return this.basicMode;
    }
    toggleSatellite() {
        this.satelliteEnabled = !this.satelliteEnabled;
        this._restartTileLoadPipelines();
        this._tileBufferValid = false;
        this._dirty = true;
        return this.satelliteEnabled;
    }
    // Météo = radar + nuages (satellite reste indépendant)
    setWeatherEnabled(enabled:boolean) {
        if (this.weatherEnabled === enabled)
            return;
        this.weatherEnabled = enabled;
        this.radarEnabled = enabled;
        this.cloudEnabled = enabled;
        this._tileBufferValid = false;
        this._dirty = true;
    }
    setNightMapEnabled(enabled:boolean) {
        const next = !!enabled;
        if (this.nightMapEnabled === next)
            return false;
        this.nightMapEnabled = next;
        this._restartTileLoadPipelines();
        this._tileBufferValid = false;
        this._dirty = true;
        return true;
    }
    setSatelliteEnabled(enabled:boolean) {
        if (this.satelliteEnabled === enabled)
            return;
        this.satelliteEnabled = enabled;
        this._restartTileLoadPipelines();
        this._tileBufferValid = false;
        this._dirty = true;
    }
}


// S3_STRUCT_V2_TEMP
