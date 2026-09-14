import {RouteDrawingCache} from './route-drawing-cache.js';
import {displayBlockSignals, type SignalRouteService} from './block-signal-view.js';
type __KPA79 = { "stationId"?: unknown; "lat": unknown; "lon": unknown; "voiePointId": unknown };
type __KPStruct143 = { lat: unknown; lon: unknown; _reMercLat?: unknown; _reMercLon?: unknown; _reMercX?: number; _reMercY?: number };
type __KPStruct194 = number;
import { TileMap } from './map.js';
import { MapSourcePanel } from './map-source-panel.js';
import { TerrainRelief3D } from './terrain3d.js';
import { OP_ICON_STOP, OP_ICON_WARN, OP_ICON_WORKS } from './operational-icons.js';
import { operationalDelayMinutes } from './operational-time.js';
import type { World, Station } from './world.js';
import type { DepotManager } from './depot.js';
import type { LineManager, PlatformManager } from './line.js';
import type { VoiePointManager } from './voie-points.js';
import type { ActiveService, ActiveServiceLike } from './schedule-creator.js';

// v1.1.55 — Livemap train marker palette. One category = one stable colour.
// The marker itself is vector-only (solid dot + directional tip): no centre pictogram.

type RendererPoint = { x: number; y: number; depth?: number };
type RendererRoutePoint = { lat: number; lon: number; wayId?: string | number; way_id?: string | number };
type RendererTrain = Record<string, unknown> & { id?: string | number; category?: string; geoHeading?: number; heading?: number; inMaintenance?: boolean; inDepot?: boolean; stoppedAt?: unknown; breakdown?: unknown; blockedBy?: unknown; speed?: number; delay?: number; color?: string; seriesName?: string; _stoppedSinceGameTime?: number };
type RendererRame = Record<string, unknown> & { inMaintenance?: boolean; currentLocation?: { depotId?: string } | null; elementDetails?: Array<{ imageData?: string }> };
type RendererService = Record<string, unknown> & { id: string | number; name: string; category?: string; serviceType?: string; train?: RendererTrain; rame?: RendererRame | null; position?: { lat: number; lon: number } | null; state?: string; active?: boolean; completed?: boolean; cancelled?: boolean; isRescue?: boolean; routes?: unknown[]; roundTrip?: boolean; _returnRoutes?: unknown[]; stops?: unknown[]; returnStops?: unknown[]; _returnStopsData?: unknown[]; getTargetStation?: () => { lat: number; lon: number } | null; _state?: { cachedRoute?: RendererRoutePoint[]; index?: number }; _cantonAssignments?: Array<{ endIndex: number; cantonId: string | number }> };
type RendererEngine = { getParisDate?: () => string; getParisTime?: () => { hours?: number; minutes?: number; seconds?: number } };
type RendererWorkItem = Record<string, unknown> & { stationOnly?: boolean; route?: RendererRoutePoint[]; stationId?: string | number; stationA?: string | number; stationB?: string | number; station?: { lat: number; lon: number } | null; stationLat?: number; stationLon?: number };

export const LIVEMAP_CATEGORY_COLORS: Record<string, string> = {
  voyageur: '#3b82f6', // bleu
  fret: '#22c55e',     // vert
  w: '#94a3b8',        // gris
  hlp: '#334155',      // gris foncé
  tm: '#ef4444',       // rouge
  infra: '#facc15',    // jaune
  ttx: '#f97316',      // orange
};

const LIVEMAP_CATEGORIES = Object.freeze(Object.keys(LIVEMAP_CATEGORY_COLORS));

export function compute3DPlaneGeometry(viewWidth: unknown, viewHeight: unknown, zoomLevel : unknown = 11) {
  const viewW = Math.max(1, Number(viewWidth) || 1);
  const viewH = Math.max(1, Number(viewHeight) || 1);
  const zoom = Math.max(8.5, Math.min(30.0, Number(zoomLevel) || 11));
  // HOTFIX29 — genuinely low GPS camera. HOTFIX28's 50° was an honest
  // tilt, but still read too much like an aerial/satellite view. Push the map
  // plane to 70° so the route is seen much closer to a dashboard GPS angle.
  const pitchDeg = 70;
  const diagonal = Math.hypot(viewW, viewH);
  // A longer focal distance keeps the highly tilted plane safely in front of
  // the perspective camera without needing a gigantic raster surface.
  const perspectivePx = Math.round(diagonal * 3.50);
  // Small Y compensation is geometry-only: it keeps full-frame coverage with
  // a moderate overscan while preserving a much stronger apparent tilt than
  // HOTFIX28 (effective vertical foreshortening ~0.44 vs ~0.64).
  const yComp = 1.30;
  const planeScale = 1.05;
  // HOTFIX29 — 1.90x diagonal is enough for 70° at all tested bearings and
  // common aspect ratios, while staying far below the huge buffers that caused
  // the old 2 FPS behaviour.
  const overscan = 1.90;
  const planeSize = Math.ceil(diagonal * overscan);
  return {
    viewW, viewH, zoom, pitchDeg, perspectivePx, yComp, planeScale, overscan,
    width: planeSize, height: planeSize,
    left: (viewW - planeSize) / 2,
    top: (viewH - planeSize) / 2,
  };
}

type RendererToggleElements = Partial<Record<'stations'|'names'|'trains'|'voie'|'orm'|'basic'|'satellite'|'night'|'weather'|'industries'|'zones', HTMLInputElement>>;
type RendererHeadingState = { angle: number; time: number; seen: number };
type RendererWorkHitZone = { item: RendererWorkItem; points: RendererPoint[]; hitWidth: number };
type RendererMarkerNode = { root: HTMLDivElement; title: HTMLSpanElement; sub: HTMLElement };
type RendererMiniCache = { data: ImageData; x: number; y: number };
type RendererIndustryLocation = { lat: number; lon: number; color?: string; name: string; industryName: string };

export class Renderer {
  declare canvas: HTMLCanvasElement;
  declare ctx: CanvasRenderingContext2D;
  declare tileMap: TileMap;
  private mapSourcePanel: MapSourcePanel;
  private _routeDrawingCache = new RouteDrawingCache();
  declare terrain3D: TerrainRelief3D;
  declare hoveredStation: Station | null;
  declare logicalWidth: number;
  declare logicalHeight: number;
  declare viewportWidth: number;
  declare viewportHeight: number;
  declare _minimapCache: RendererMiniCache | null;
  declare _lastMinimapDraw: number;
  declare _minimapInterval: number;
  declare _staticCanvas: HTMLCanvasElement | null;
  declare _staticCtx: CanvasRenderingContext2D | null;
  declare _staticValid: boolean;
  declare _lastStaticZoom: number;
  declare _lastStaticCLat: number;
  declare _lastStaticCLon: number;
  declare _staticKey: string;
  declare _needsRender: boolean;
  declare _voieLayerCanvas: HTMLCanvasElement | null;
  declare _voieLayerCtx: CanvasRenderingContext2D | null;
  declare _voieLayerKey: string;
  declare _trainHeadingVisual: Map<string, RendererHeadingState>;
  declare _lastTrainHeadingSweep: number;
  declare _operationalIconCache: Map<string, HTMLImageElement>;
  declare _livemapWorkHitZones: RendererWorkHitZone[];
  declare _toggleEls: RendererToggleElements;
  declare _perfToggleListenersBound?: boolean;
  declare _livemapAttributionEl?: HTMLElement | null;
  declare _re3dMarkerNodes?: Map<string, RendererMarkerNode>;
  declare _trainImageCache?: Map<string | number, HTMLImageElement | null>;
  declare _frameTick?: number;
  declare _indLocs?: RendererIndustryLocation[];
  declare _indLocsTick?: number;
  constructor(canvas: HTMLElement) {
    this.canvas = canvas as HTMLCanvasElement;
    this.ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
    this.tileMap = new TileMap();
    this.mapSourcePanel = new MapSourcePanel(this.tileMap, document.getElementById('map-source-panel'));
    document.addEventListener('visibilitychange', () => {
      this.tileMap.onDocumentVisibilityChange(); this.requestRender();
    });
    // RE3D-DEM-01 — true local relief. The WebGL canvas is dormant outside 3D follow.
    this.terrain3D = new TerrainRelief3D(document.getElementById('re3d-terrain-canvas'), this.tileMap);
    this.hoveredStation = null;
    this.logicalWidth = 0;
    this.logicalHeight = 0;
    this._minimapCache = null;
    this._lastMinimapDraw = 0;
    this._minimapInterval = 50; // ~20 FPS throttle
    // Static layer offscreen canvas (tracks, stations, depots)
    this._staticCanvas = null;
    this._staticCtx = null;
    this._staticValid = false;
    this._lastStaticZoom = 0;
    this._lastStaticCLat = 0;
    this._lastStaticCLon = 0;
    this._staticKey = '';
    this._needsRender = true;
    this._voieLayerCanvas = null;
    this._voieLayerCtx = null;
    this._voieLayerKey = '';
    // v1.1.55 — visual heading cache smooths only marker rotation. The target
    // heading always comes from the current OSM/ORM route segment.
    this._trainHeadingVisual = new Map();
    this._lastTrainHeadingSweep = 0;
    // v1.1.65 — cached operational pictograms (incidents / travaux).
    this._operationalIconCache = new Map();
    // HOTFIX48 — screen-space geometry cache for active Works zones. It is
    // rebuilt during normal Livemap rendering, so mouse hover never reruns ORM
    // projection across the full work route.
    this._livemapWorkHitZones = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  invalidateStatic() { this._staticValid = false; this._staticKey = ''; this._voieLayerKey = ''; this._needsRender = true; }

  get needsRender() { return !!this._needsRender || !!this.tileMap?.isDirty; }
  requestRender() { this._needsRender = true; }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // HOTFIX23 — keep the visible viewport separate from the oversized 3D
    // render plane. logicalWidth/logicalHeight are overscan pixels in 3D.
    this.viewportWidth = Math.max(1, Number(rect.width) || 1);
    this.viewportHeight = Math.max(1, Number(rect.height) || 1);
    const baseDpr = window.devicePixelRatio || 1;
    const main3D = document.getElementById('main-area');
    const markerPlane = document.getElementById('re3d-marker-plane');
    const followMarkerPlane = document.getElementById('re3d-follow-marker-plane');
    const threeD = !!main3D?.classList.contains('re3d-active');

    let renderW = Math.max(1, Math.round(rect.width));
    let renderH = Math.max(1, Math.round(rect.height));
    let planeLeft = 0;
    let planeTop = 0;

    if (threeD) {
      const geom = compute3DPlaneGeometry(rect.width, rect.height, this.tileMap?.zoomLevel);
      renderW = geom.width;
      renderH = geom.height;
      planeLeft = geom.left;
      planeTop = geom.top;
      main3D.style?.setProperty?.('--re3d-pitch', `${geom.pitchDeg.toFixed(2)}deg`);
      main3D.style?.setProperty?.('--re3d-counter-pitch', `${(-geom.pitchDeg).toFixed(2)}deg`);
      main3D.style?.setProperty?.('--re3d-perspective', `${geom.perspectivePx.toFixed(0)}px`);
      main3D.style?.setProperty?.('--re3d-ycomp', geom.yComp.toFixed(3));
      main3D.style?.setProperty?.('--re3d-plane-scale', geom.planeScale.toFixed(3));
      main3D.style?.setProperty?.('--re3d-billboard-scale', (1 / geom.planeScale).toFixed(4));
    } else {
      main3D?.style?.removeProperty?.('--re3d-pitch');
      main3D?.style?.removeProperty?.('--re3d-counter-pitch');
      main3D?.style?.removeProperty?.('--re3d-perspective');
      main3D?.style?.removeProperty?.('--re3d-ycomp');
      main3D?.style?.removeProperty?.('--re3d-plane-scale');
      main3D?.style?.removeProperty?.('--re3d-billboard-scale');
    }

    // HOTFIX24 — real overscan already supplies map pixels outside the screen.
    // Keep the backing store close to 1×: the expensive square plane is refreshed
    // at a bounded cadence and no longer needs a second supersampling multiplier.
    const dpr = threeD ? 1.0 : baseDpr;
    // Normal source zoom is enough because the plane is rendered at its real size.
    // The old +1 source zoom multiplied satellite tile traffic and decode work.
    this.tileMap.setRenderQuality?.(0, 1);

    this.logicalWidth = renderW;
    this.logicalHeight = renderH;
    this.canvas.width = Math.max(1, Math.round(renderW * dpr));
    this.canvas.height = Math.max(1, Math.round(renderH * dpr));
    this.canvas.style.width = renderW + 'px';
    this.canvas.style.height = renderH + 'px';
    this.canvas.style.left = planeLeft + 'px';
    this.canvas.style.top = planeTop + 'px';
    if (markerPlane) {
      markerPlane.style.width = renderW + 'px';
      markerPlane.style.height = renderH + 'px';
      markerPlane.style.left = planeLeft + 'px';
      markerPlane.style.top = planeTop + 'px';
      markerPlane.style.right = 'auto';
      markerPlane.style.bottom = 'auto';
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tileMap.viewportWidth = renderW;
    this.tileMap.viewportHeight = renderH;
    this._staticValid = false;
    this._staticKey = '';
    this._needsRender = true;
    this._voieLayerKey = '';
    this.tileMap.markDirty();
    this.terrain3D?.resize?.();
  }

  is3DPlanePanSafe(panX : unknown = 0, panY : unknown = 0, cameraHeadingRad : unknown = 0, marginPx : unknown = 18) {
    const g = compute3DPlaneGeometry(this.viewportWidth || this.logicalWidth, this.viewportHeight || this.logicalHeight, this.tileMap?.zoomLevel);
    const half = g.width / 2;
    const scale = g.planeScale;
    // CSS map rotation is the opposite of the geographic camera bearing.
    const rz = -Number(cameraHeadingRad || 0);
    const cr = Math.cos(rz), sr = Math.sin(rz);
    const rx = g.pitchDeg * Math.PI / 180;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const d = g.perspectivePx;
    const poly: number[][] = [];
    for (const [bx, by] of [[-half,-half],[half,-half],[half,half],[-half,half]]) {
      const x0 = (bx + Number(panX || 0)) * scale;
      const y0 = (by + Number(panY || 0)) * scale;
      const x1 = x0 * cr - y0 * sr;
      const y1 = x0 * sr + y0 * cr;
      const y2 = y1 * cx * g.yComp;
      const z2 = y1 * sx;
      const den = d - z2;
      if (!(den > 1)) return false;
      const f = d / den;
      poly.push([x1 * f, y2 * f]);
    }
    const w = (this.viewportWidth || g.viewW) / 2 + Math.max(0, Number(marginPx || 0));
    const h = (this.viewportHeight || g.viewH) / 2 + Math.max(0, Number(marginPx || 0));
    const points = [[-w,-h],[w,-h],[w,h],[-w,h]];
    const inside = ([x,y]: number[]) => {
      let pos = false, neg = false;
      for (let i = 0; i < poly.length; i++) {
        const [x1,y1] = poly[i], [x2,y2] = poly[(i + 1) % poly.length];
        const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
        if (cross > 1e-6) pos = true;
        if (cross < -1e-6) neg = true;
        if (pos && neg) return false;
      }
      return true;
    };
    return points.every(inside);
  }

  render(world: World, services: RendererService[], engine: RendererEngine | null | undefined, depotManager: DepotManager, lineManager: LineManager, platformManager: PlatformManager, voiePointManager: VoiePointManager) {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    this.tileMap.renderTiles(ctx, w, h);

    // Update frame projection cache once per render (avoids redundant trig in latLonToScreen)
    this.tileMap._updateFrameCache();

    // Cache toggle element refs (avoid per-frame DOM lookups, re-query if null)
    if (!this._toggleEls || !this._toggleEls.stations) {
      this._toggleEls = {
        stations: document.getElementById('toggle-stations') as HTMLInputElement,
        names: document.getElementById('toggle-station-names') as HTMLInputElement,
        trains: document.getElementById('toggle-trains') as HTMLInputElement,
        voie: document.getElementById('toggle-voie-points') as HTMLInputElement,
        orm: document.getElementById('toggle-orm') as HTMLInputElement,
        basic: document.getElementById('toggle-basic') as HTMLInputElement,
        satellite: document.getElementById('toggle-satellite') as HTMLInputElement,
        night: document.getElementById('toggle-night') as HTMLInputElement,
        weather: document.getElementById('toggle-weather') as HTMLInputElement,
      };
      // Sync toggle inputs with the initial TileMap state
      if (this._toggleEls.weather) this._toggleEls.weather!.checked = this.tileMap.weatherEnabled;
      if (this._toggleEls.satellite) this._toggleEls.satellite!.checked = this.tileMap.satelliteEnabled;
      if (this._toggleEls.basic) this._toggleEls.basic!.checked = this.tileMap.basicMode;
      if (this._toggleEls.orm) this._toggleEls.orm!.checked = this.tileMap.railEnabled;

      if (this._toggleEls.night) {
        this._toggleEls.night.checked = this.tileMap.nightMapEnabled;
        this._toggleEls.night.addEventListener('change', () => {
          this.tileMap.setNightMapEnabled(this._toggleEls.night!.checked);
          this.requestRender();
        });
      }
      if (this._toggleEls.orm) {
        this._toggleEls.orm.addEventListener('change', () => {
          this.tileMap.railEnabled = this._toggleEls.orm!.checked;
          this.tileMap.markDirty();
        });
      }
      if (this._toggleEls.basic) {
        this._toggleEls.basic.addEventListener('change', () => {
          if (this._toggleEls.basic!.checked) this.tileMap.selectOSMStandard();
          else this.tileMap.setBasicMode(false);
          this.requestRender();
        });
      }
      if (this._toggleEls.weather) {
        this._toggleEls.weather.addEventListener('change', () => {
          this.tileMap.setWeatherEnabled(this._toggleEls.weather!.checked);
        });
      }
      if (this._toggleEls.satellite) {
        this._toggleEls.satellite.addEventListener('change', () => {
          this.tileMap.setSatelliteEnabled(this._toggleEls.satellite!.checked);
        });
      }
    }
    // Buttons describe the displayed base, including changes made in the source panel/GPS.
    if (this._toggleEls.basic) this._toggleEls.basic.checked = this.tileMap.basicMode && !this.tileMap.satelliteEnabled && !this.tileMap.nightMapEnabled;
    if (this._toggleEls.satellite) this._toggleEls.satellite.checked = this.tileMap.satelliteEnabled;
    if (this._toggleEls.night) this._toggleEls.night.checked = this.tileMap.nightMapEnabled;
    if (this._toggleEls.orm) { this._toggleEls.orm.checked = this.tileMap.railEnabled; this._toggleEls.orm.disabled = false; }
    const showStations = this._toggleEls.stations?.checked !== false;
    const showNames = this._toggleEls.names?.checked !== false;
    const showTrains = this._toggleEls.trains?.checked !== false;
    const showVoiePoints = this._toggleEls.voie?.checked !== false;
    this.mapSourcePanel.update();
    // Attribution remains visible independently from the diagnostic/configuration panel.
    if (!this._livemapAttributionEl) this._livemapAttributionEl = document.getElementById('livemap-attribution');
    if (this._livemapAttributionEl) {
      const credit = this.tileMap.getMapCreditText();
      if (this._livemapAttributionEl.textContent !== `${credit} · Licence OSM`) {
        this._livemapAttributionEl.textContent = `${credit} · `;
        const link = document.createElement('a');
        link.href = 'https://www.openstreetmap.org/copyright';
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Licence OSM';
        this._livemapAttributionEl.appendChild(link);
      }
    }

    // Industries toggle
    if (!this._toggleEls.industries) {
      this._toggleEls.industries = document.getElementById('toggle-industries') as HTMLInputElement;
    }
    const showIndustries = this._toggleEls.industries?.checked === true;

    // Zones toggle (signal boxes + regulation zones)
    if (!this._toggleEls.zones) {
      this._toggleEls.zones = document.getElementById('toggle-zones') as HTMLInputElement;
    }
    const showZones = this._toggleEls.zones?.checked !== false;

    if (!this._perfToggleListenersBound) {
      this._perfToggleListenersBound = true;
      for (const el of [this._toggleEls.stations,this._toggleEls.names,this._toggleEls.voie,this._toggleEls.zones,this._toggleEls.industries]) {
        el?.addEventListener('change', () => this.invalidateStatic());
      }
      this._toggleEls.trains?.addEventListener('change', () => this.requestRender());
    }

    // v1.1.43 — REAL static map cache. Tracks, depots, zones, voie base and all
    // gameplay stations are unchanged between frames most of the time. Previous
    // builds declared _staticCanvas/_staticValid but never used them, so the
    // 17,817 all-zoom stations and infrastructure were re-projected ~30 FPS even
    // with zero trains and a perfectly still camera. Keep every station visible,
    // but rasterize the static overlay only when view/data/toggles actually change.
    this._drawStaticOverlay(ctx, world, depotManager, lineManager, platformManager, voiePointManager, {
      showZones, showVoiePoints, showStations, showNames, showIndustries
    });
    // Voie occupation and platform occupation are genuinely dynamic and remain
    // lightweight overlays on top of the cached static map.
    if (showVoiePoints && voiePointManager) this.drawOccupiedVoieOverlay(ctx, voiePointManager, world);
    if (showStations && showNames) this.drawStationPlatformOccupancy(ctx, world, platformManager);

    // Cloud overlay: canvas fallback drawn in addition to/instead of tile layer
    if (this.tileMap.cloudEnabled) {
      this._drawCloudOverlay(ctx, w, h, this.tileMap._cloudTileUrl ? 0.4 : 1.0);
    }

    // Dynamic layers always drawn
    if (window.game?.ui?._manualTronconWaypoints?.length > 1) {
      this._drawTempTrace(ctx, window.game!.ui._manualTronconWaypoints);
    }
    // HOTFIX48 — active A↔B Works zones use the exact ORM geometry stored by
    // the Works Schedule Creator. Draw them below the selected train path and
    // markers, with the same dark-underlay + clean-stroke language as the SC.
    this.drawActiveWorksZones(ctx, world, engine);
    // Selected service geometry is drawn below train markers so the consist
    // remains visually dominant, like in the Schedule Creator.
    this.drawSelectedServiceRoute(ctx, world);
    // HOTFIX20 — the normal Livemap 'Trains' filter also owns the 3D DOM
    // arrows. Previous builds forced them back on whenever 3D was active.
    if (showTrains) this.drawServices(ctx, world, services);
    else if (window.game?.ui?._threeDFollowActive && this._re3dMarkerNodes?.size) this.clear3DMarkers();
    // v1.1.65 — incidents/travaux are dynamic and must not be baked into the
    // expensive 17,817-station static cache.
    this.drawOperationalEventIcons(ctx, world, services, engine);
    this.drawSignals(ctx, services);
    // RE3D-DEM-01 — the completed 2D Livemap becomes the draped texture. Uploads
    // are throttled inside TerrainRelief3D and only happen while relief is enabled.
    if (window.game?.ui?._threeDFollowActive && this.terrain3D?.enabled) this.terrain3D.sync(this.canvas, !!this.tileMap.isDirty);
    this.tileMap.clearDirty?.();
    this._needsRender=false;
  }

  _drawStaticOverlay(ctx: CanvasRenderingContext2D, world: World, depotManager: DepotManager, lineManager: LineManager, platformManager: PlatformManager, voiePointManager: VoiePointManager, flags : Record<string, unknown> = {}) {
    const w=Math.max(1,Math.round(this.logicalWidth));
    const h=Math.max(1,Math.round(this.logicalHeight));
    const tm=this.tileMap;
    const voieRevision=voiePointManager?.revision||0;
    const key=[
      tm.centerLat.toFixed(7),tm.centerLon.toFixed(7),tm.zoomLevel.toFixed(4),`${w}x${h}`,
      flags.showZones?1:0,flags.showVoiePoints?1:0,flags.showStations?1:0,flags.showNames?1:0,flags.showIndustries?1:0,
      world?.stations?.length||0,world?.tracks?.length||0,world?.referenceStations?.length||0,
      depotManager?.getAll?.().length||0,voieRevision
    ].join('|');
    if(!this._staticCanvas || this._staticCanvas.width!==w || this._staticCanvas.height!==h){
      this._staticCanvas=document.createElement('canvas');
      this._staticCanvas.width=w;this._staticCanvas.height=h;
      this._staticCtx=this._staticCanvas.getContext('2d');
      this._staticValid=false;this._staticKey='';
    }
    if(!this._staticValid || this._staticKey!==key){
      const c=this._staticCtx!;c.clearRect(0,0,w,h);
      this.drawTracks(c,world,lineManager);
      this.drawDepots(c,world,depotManager);
      if(flags.showZones)this.drawSignalBoxes(c);
      if(flags.showZones)this.drawRegulationZones(c);
      if(flags.showVoiePoints && voiePointManager){
        // Static base only — occupied voies are drawn separately every dynamic frame.
        this.drawVoieTroncons(c,voiePointManager,world,true);
        this.drawVoiePoints(c,voiePointManager,true);
      }
      if(flags.showStations){
        this.drawReferenceStations(c,world,flags.showNames);
        this.drawStations(c,world,platformManager,flags.showNames,false);
      }
      if(flags.showIndustries)this.drawIndustries(c);
      this._staticKey=key;this._staticValid=true;
    }
    ctx.drawImage(this._staticCanvas,0,0,w,h);
  }

  drawStationPlatformOccupancy(ctx: CanvasRenderingContext2D, world: World, platformManager: PlatformManager) {
    const zoom=this.tileMap.zoomLevel;
    if(!platformManager || zoom<10)return;
    const states=platformManager.stationPlatforms;
    if(!states?.size)return;
    // v1.1.43 PERF — occupancy is sparse. Iterate only stations that have a
    // live platform state instead of every visible station, and skip empty states.
    ctx.save();ctx.font='9px sans-serif';
    for(const [stationId,status] of states){
      const used=status?.occupied?.size||0;
      if(!used)continue;
      const st=world.getStationById(stationId);
      if(!st)continue;
      const p=this.latLonToScreen(st.lat,st.lon);
      if(p.x<-30||p.x>this.logicalWidth+30||p.y<-30||p.y>this.logicalHeight+30)continue;
      const total=Number(status.total||st.platforms||2);
      const baseSize=5;
      ctx.fillStyle=used>=total?'#ef4444':'#f59e0b';
      ctx.fillText(`[${used}/${total}]`,p.x+baseSize+4,p.y+14);
    }
    ctx.restore();
  }

  _drawCloudOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, alphaScale : number = 1.0) {
    const weather = window.game?.weather;
    if (!weather) return;
    const low = weather.cloudLow || 0;
    const mid = weather.cloudMid || 0;
    const high = weather.cloudHigh || 0;
    if (low + mid + high === 0) return;

    // Low clouds: dense, gray-white
    if (low > 0) {
      ctx.fillStyle = `rgba(200,210,220,${low * 0.002 * alphaScale})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Mid clouds: lighter, blue-gray
    if (mid > 0) {
      ctx.fillStyle = `rgba(180,195,215,${mid * 0.0015 * alphaScale})`;
      ctx.fillRect(0, 0, w, h);
    }
    // High clouds: wispy, very transparent
    if (high > 0) {
      ctx.fillStyle = `rgba(220,225,235,${high * 0.001 * alphaScale})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _stationToScreen(st: __KPStruct143) {
    // v1.1.43 — station geography is static during normal panning. Cache the
    // expensive Web-Mercator sin/log projection on the station object and only
    // apply the current scale/translation per frame. This keeps all 17,817 dots
    // visible at zoom 5 without 17,817 trigonometric projections per pan frame.
    if (!st) return { x: -1e9, y: -1e9 };
    const lat=Number(st.lat), lon=Number(st.lon);
    if (st._reMercLat !== lat || st._reMercLon !== lon || !Number.isFinite(st._reMercX as number) || !Number.isFinite(st._reMercY as number)) {
      const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat));
      const sinLat=Math.sin((safeLat*Math.PI)/180);
      st._reMercX=(lon+180)/360;
      st._reMercY=0.5-Math.log((1+sinLat)/(1-sinLat))/(4*Math.PI);
      st._reMercLat=lat;st._reMercLon=lon;
    }
    const tm=this.tileMap;
    if (!tm._frameScale) tm._updateFrameCache?.();
    return {
      x: st._reMercX!*tm._frameScale-tm._frameCx+tm._frameHalfW,
      y: st._reMercY!*tm._frameScale-tm._frameCy+tm._frameHalfH,
    };
  }

  latLonToScreen(lat: unknown, lon: unknown) {
    return this.tileMap.latLonToPixel(lat as number, lon as number);
  }

  drawTracks(ctx: CanvasRenderingContext2D, world: World, lineManager: LineManager) {
    const tm = this.tileMap;
    const topLeft = tm ? tm.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight) : null;
    const botRight = tm ? tm.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight) : null;
    const hasVP = topLeft && botRight;
    const vpMinLat = hasVP ? Math.min(topLeft.lat, botRight.lat) - 0.01 : -90;
    const vpMaxLat = hasVP ? Math.max(topLeft.lat, botRight.lat) + 0.01 : 90;
    const vpMinLon = hasVP ? Math.min(topLeft.lon, botRight.lon) - 0.01 : -180;
    const vpMaxLon = hasVP ? Math.max(topLeft.lon, botRight.lon) + 0.01 : 180;

    const zoom = tm?.zoomLevel || 10;
    const pxPerDegLon = tm._frameScale ? (tm._frameScale / 360) : 500;

    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

      // Use cached bounding box if available
      let tMinLat, tMaxLat, tMinLon, tMaxLon;
      if (track._bbox) {
        tMinLat = track._bbox[0]; tMaxLat = track._bbox[1];
        tMinLon = track._bbox[2]; tMaxLon = track._bbox[3];
      } else {
        tMinLat = Math.min(stA.lat, stB.lat);
        tMaxLat = Math.max(stA.lat, stB.lat);
        tMinLon = Math.min(stA.lon, stB.lon);
        tMaxLon = Math.max(stA.lon, stB.lon);
        track._bbox = [tMinLat, tMaxLat, tMinLon, tMaxLon];
      }
      if (tMaxLat < vpMinLat || tMinLat > vpMaxLat || tMaxLon < vpMinLon || tMinLon > vpMaxLon) continue;

      // Skip tiny tracks that would be sub-pixel at current zoom
      const spanPx = (tMaxLon - tMinLon) * pxPerDegLon;
      const spanPy = (tMaxLat - tMinLat) * pxPerDegLon;
      if (spanPx < 2 && spanPy < 2 && zoom < 10) continue;

      // Determine track color: incidents/works override, then line color, then speed-based
      let trackColor, trackWidth;
      const hasInterruption = (track.worksActive && track.worksImpact === 'stop') ||
                              (track.incidentActive && track.incidentEffect === 'stop');
      const hasSlowdown = (track.worksActive && track.worksImpact !== 'stop') ||
                          (track.incidentActive && track.incidentEffect === 'slow');

      if (hasInterruption) {
        trackColor = track.worksActive ? '#c2410c' : '#7f1d1d';
        trackWidth = 4;
      } else if (hasSlowdown) {
        trackColor = track.worksActive ? '#c2410c' : '#facc15';
        trackWidth = 3.5;
      } else {
        // Check if track belongs to a line (skip expensive lookup at very low zoom)
        let lineColor = null;
        if (lineManager && zoom >= 7) {
          const linesOnTrack = lineManager.getLinesForTrack(track.id);
          if (linesOnTrack.length > 0) {
            lineColor = linesOnTrack[0].color;
          }
        }
        if (lineColor) {
          trackColor = lineColor;
          trackWidth = 2.5;
        } else {
          trackColor = track.maxSpeed >= 250 ? '#3b82f6' :
                       track.maxSpeed >= 160 ? '#f59e0b' : '#64748b';
          trackWidth = track.maxSpeed >= 250 ? 2.5 : 1.5;
        }
      }

      ctx.strokeStyle = trackColor;
      ctx.lineWidth = trackWidth;

      if (track.maxSpeed < 160 && !hasInterruption && !hasSlowdown) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }

      if (track.route && track.route.length > 1) {
        const len = track.route.length;
        const routeStep = len <= 20 ? 1 :
          zoom >= 15 ? 1 : zoom >= 12 ? Math.max(1, len >> 6) :
          zoom >= 9 ? Math.max(2, len >> 4) : Math.max(4, len >> 3);
        ctx.beginPath();
        // Inline Mercator projection for speed (avoid method call overhead)
        const fScale = tm._frameScale;
        const fCx = tm._frameCx;
        const fCy = tm._frameCy;
        const fHW = tm._frameHalfW;
        const fHH = tm._frameHalfH;
        const DEG2RAD = Math.PI / 180;
        const INV4PI = 1 / (4 * Math.PI);
        const r0 = track.route[0];
        let sinLat = Math.sin(r0.lat * DEG2RAD);
        let sx = ((r0.lon + 180) / 360) * fScale - fCx + fHW;
        let sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
        ctx.moveTo(sx, sy);
        for (let i = routeStep; i < len; i += routeStep) {
          const rp = track.route[i];
          sinLat = Math.sin(rp.lat * DEG2RAD);
          sx = ((rp.lon + 180) / 360) * fScale - fCx + fHW;
          sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
          ctx.lineTo(sx, sy);
        }
        const rl = track.route[len - 1];
        sinLat = Math.sin(rl.lat * DEG2RAD);
        sx = ((rl.lon + 180) / 360) * fScale - fCx + fHW;
        sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        const pa = tm.worldToScreenFast(stA.lat, stA.lon);
        const pb = tm.worldToScreenFast(stB.lat, stB.lon);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Annex 3A / LVM — per-segment voie labels + direction arrows from OSM railway:track_ref
      if (zoom >= 13 && track.route && track.route.length > 1) {
        const route = track.route;
        const screenPoints = route.map((r: { lat: unknown; lon: unknown }) => this.latLonToScreen(r.lat, r.lon));
        let i = 1;
        while (i < route.length) {
          const ref = (route[i].trackRef || '').toString().trim();
          if (!ref) { i++; continue; }
          let j = i;
          while (j < route.length && (route[j].trackRef || '').toString().trim() === ref) j++;
          const pStart = screenPoints[i - 1];
          const pEnd = screenPoints[j - 1];
          const dx = pEnd.x - pStart.x;
          const dy = pEnd.y - pStart.y;
          const len = Math.hypot(dx, dy);
          if (len > 25) {
            let sumX = 0, sumY = 0, n = 0;
            for (let k = i; k < j; k++) {
              sumX += screenPoints[k].x;
              sumY += screenPoints[k].y;
              n++;
            }
            const mx = sumX / n;
            const my = sumY / n;
            const angle = Math.atan2(dy, dx);
            const label = `VOIE ${ref}`;
            ctx.save();
            ctx.font = 'bold 9px sans-serif';
            const metrics = ctx.measureText(label);
            const pad = 3;
            const bw = metrics.width + pad * 2;
            const bh = 14;
            ctx.fillStyle = 'rgba(30, 58, 138, 0.9)';
            ctx.fillRect(mx - bw / 2, my - bh / 2, bw, bh);
            ctx.fillStyle = '#e0e7ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, mx, my);
            ctx.restore();
            this._drawArrow(ctx, mx, my, angle, 5, '#e2e8f0');
          }
          i = j;
        }
      }

      // Draw incident/works label on track at midpoint
      if ((hasInterruption || hasSlowdown) && this.tileMap.zoomLevel >= 8) {
        const midA = stA, midB = stB;
        const mp = this.latLonToScreen((midA.lat + midB.lat) / 2, (midA.lon + midB.lon) / 2);
        const label = track.incidentActive ? (track.incidentName || 'Incident') :
                      track.worksActive ? 'Travaux' : '';
        if (label) {
          ctx.fillStyle = hasInterruption ? (track.worksActive ? '#c2410c' : '#7f1d1d') : '#facc15';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`\u26A0 ${label}`, mp.x + 5, mp.y - 5);
        }
      }
    }
    ctx.setLineDash([]);
  }

  // v1.1.9 — worldwide OSM/ORM reference stations.
  // Rendered from a spatial/LOD reference layer, never from player save objects.
  drawReferenceStations(ctx: CanvasRenderingContext2D, world: World, showNames : unknown = true) {
    if (!world?.referenceStations?.length || !world.getReferenceStationRenderCandidates) return;
    const zoom = this.tileMap.zoomLevel;
    const tl = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
    const br = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
    const south = Math.min(tl.lat, br.lat), north = Math.max(tl.lat, br.lat);
    const west = tl.lon, east = br.lon;
    const candidates = world.getReferenceStationRenderCandidates(south, west, north, east, zoom);
    if (!candidates.length) return;

    // Screen-space thinning: total drawing cost depends on pixels, not on the size of
    // the worldwide catalog. At high zoom every visible railway station is retained.
    const gridPx = zoom < 4.5 ? 28 : zoom < 6 ? 20 : zoom < 8 ? 13 : zoom < 9.5 ? 8 : 0;
    const occupied = gridPx ? new Set() : null;
    const labelOccupied = showNames && zoom >= 10.5 ? new Set() : null;
    const maxMarkers = Math.max(800, Math.ceil(this.logicalWidth * this.logicalHeight / 70));
    let drawn = 0;

    ctx.save();
    ctx.lineWidth = 1;
    for (const st of candidates) {
      // Once a world reference station is activated it is drawn by drawStations()
      // with the normal gameplay marker, never twice.
      if (world.isReferenceStationActivated?.(st.id)) continue;
      const p = this._stationToScreen(st);
      if (p.x < -8 || p.x > this.logicalWidth + 8 || p.y < -8 || p.y > this.logicalHeight + 8) continue;
      if (occupied) {
        const k = `${Math.floor(p.x / gridPx)}:${Math.floor(p.y / gridPx)}`;
        if (occupied.has(k)) continue;
        occupied.add(k);
      }
      if (++drawn > maxMarkers) break;

      const halt = st.type === 'halt';
      // Same visual language as Rail Empire passenger stations. At distant zooms
      // the marker is deliberately tiny/transparent; at local zoom it is the
      // familiar yellow station dot, ready to be activated by the player.
      const r = zoom >= 10 ? (halt ? 3.2 : 4.2) : zoom >= 8 ? 2.5 : 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = zoom >= 8
        ? (halt ? 'rgba(251,191,36,.70)' : 'rgba(251,191,36,.90)')
        : 'rgba(251,191,36,.42)';
      ctx.fill();
      if (zoom >= 8) {
        ctx.strokeStyle = 'rgba(15,23,42,.95)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (labelOccupied && st.name) {
        // One label per coarse screen cell avoids unreadable walls of text in dense hubs.
        const lk = `${Math.floor(p.x / 110)}:${Math.floor(p.y / 24)}`;
        if (!labelOccupied.has(lk)) {
          labelOccupied.add(lk);
          ctx.font = zoom >= 12 ? '11px sans-serif' : '10px sans-serif';
          ctx.fillStyle = 'rgba(226,232,240,.88)';
          ctx.fillText(st.name, p.x + r + 3, p.y + 3);
        }
      }
    }
    ctx.restore();
  }

  drawStations(ctx: CanvasRenderingContext2D, world: World, platformManager: PlatformManager, showNames : unknown = true, includePlatformOccupancy : unknown = true) {
    const stColors: Record<string, string> = { voyageur: '#fbbf24', marchandise: '#06b6d4', ite: '#a855f7', depot: '#10b981', mixed: '#f59e0b' };
    const zoom = this.tileMap.zoomLevel;
    const fontSize = zoom >= 11 ? 12 : 10;
    // v1.1.20: every native gameplay station remains visible at every zoom level.
    // At continent zoom it is cheaper to scan the ~18k station array once than to
    // walk hundreds of thousands of empty 0.05° spatial-index cells. Local zooms
    // still use the spatial index. There is deliberately NO screen-grid deduplication:
    // two nearby stations remain two visible gameplay objects even when fully zoomed out.
    let candidates = world.stations;
    if (zoom >= 7 && world.getStationsInBounds) {
      const tl = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
      const br = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
      candidates = world.getStationsInBounds(Math.min(tl.lat, br.lat), tl.lon, Math.max(tl.lat, br.lat), br.lon);
    }
    for (const st of candidates) {
      const p = this._stationToScreen(st);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      const color = st.closed ? '#6b7280' : (stColors[st.type] || '#fbbf24');

      // Ultra-light continent rendering: every station is drawn, but as a tiny
      // pixel marker. Names remain hidden until zoom 8, so Europe stays readable.
      if (zoom < 7) {
        const dot = zoom <= 5.25 ? 1.25 : 1.6;
        ctx.fillStyle = color;
        ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
        continue;
      }

      ctx.fillStyle = color;
      ctx.beginPath();

      const baseSize = zoom >= 10 ? 5 : zoom >= 8 ? 4 : 2.5;

      if (st.closed) {
        // Closed station: X shape
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.moveTo(p.x - 4, p.y - 4); ctx.lineTo(p.x + 4, p.y + 4);
        ctx.moveTo(p.x + 4, p.y - 4); ctx.lineTo(p.x - 4, p.y + 4);
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (st.type === 'ite' || st.type === 'depot') {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else {
        ctx.arc(p.x, p.y, baseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (showNames && zoom >= 8) {
        // Basic mode is a light map: use black station labels for contrast.
        // Satellite explicitly keeps the light labels even if Basic was toggled too.
        const blackStationNames = !!this.tileMap.basicMode && !this.tileMap.satelliteEnabled;
        ctx.fillStyle = blackStationNames ? '#000000' : (st.closed ? '#6b7280' : '#e2e8f0');
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(st.closed ? `${st.name} (Fermee)` : st.name, p.x + baseSize + 4, p.y + 4);

        // Show platform occupancy for stations with multiple platforms at high zoom
        if (includePlatformOccupancy && platformManager && zoom >= 10 && st.platforms > 1) {
          const status = platformManager.getStatus(st.id);
          if (status.total > 0) {
            const label = `${status.used}/${status.total}`;
            ctx.font = '9px sans-serif';
            ctx.fillStyle = status.used >= status.total ? '#ef4444' : status.used > 0 ? '#f59e0b' : '#64748b';
            ctx.fillText(`[${label}]`, p.x + baseSize + 4, p.y + 14);
          }
        }
      }
    }
  }

  drawDepots(ctx: CanvasRenderingContext2D, world: World, depotManager: DepotManager) {
    if (!depotManager) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    const size = Math.max(8, Math.min(15, 7 + (zoom - 7) * 1.2));
    const drawIcon = (x: number, y: number, type: unknown) => {
      const ite = String(type || '').startsWith('ite');
      ctx.save();
      ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#07101d'; ctx.lineWidth = 1.7;
      if (ite) {
        ctx.fillStyle = '#0891b2';
        ctx.beginPath();
        ctx.moveTo(-size * .55, size * .4); ctx.lineTo(-size * .55, -size * .05);
        ctx.lineTo(-size * .22, -size * .28); ctx.lineTo(size * .02, -size * .05);
        ctx.lineTo(size * .28, -size * .28); ctx.lineTo(size * .55, -size * .05);
        ctx.lineTo(size * .55, size * .4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e6fbff'; ctx.fillRect(size * .34, -size * .58, size * .12, size * .45);
      } else {
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.moveTo(-size * .58, size * .4); ctx.lineTo(-size * .58, -size * .08);
        ctx.lineTo(0, -size * .5); ctx.lineTo(size * .58, -size * .08); ctx.lineTo(size * .58, size * .4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5f3ff'; ctx.fillRect(-size * .28, -size * .02, size * .56, size * .42); ctx.strokeRect(-size * .28, -size * .02, size * .56, size * .42);
        ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-size * .28, size * .12); ctx.lineTo(size * .28, size * .12); ctx.stroke();
      }
      ctx.restore();
    };
    for (const depot of depotManager.getAll()) {
      const station = world.getStationById(depot.stationId);
      const loc = depot.location && Number.isFinite(Number(depot.location.lat)) && Number.isFinite(Number(depot.location.lon)) ? depot.location : station;
      if (!loc) continue;
      const p = this.latLonToScreen(loc.lat, loc.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;
      drawIcon(p.x, p.y, depot.type);
    }
  }

  drawIndustries(ctx: CanvasRenderingContext2D) {
    const ic = window.game?.industrialClients;
    if (!ic) return;

    // Cache locations array (heavy to compute every frame)
    if (!this._indLocs || this._indLocsTick !== (this._frameTick || 0)) {
      this._indLocs = ic.getAllRealLocations();
      this._indLocsTick = this._frameTick || 0;
    }
    const locs = this._indLocs;
    if (!locs || locs.length === 0) return;

    const zoom = this.tileMap?.zoomLevel || 10;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Adaptive: at low zoom, only show every Nth site and skip labels
    const showLabels = zoom >= 9;
    const step = zoom < 7 ? 4 : zoom < 8 ? 2 : 1;
    const dotSize = zoom >= 10 ? 5 : zoom >= 8 ? 4 : 3;

    ctx.textAlign = 'center';
    ctx.font = `${zoom >= 10 ? 9 : 8}px sans-serif`;

    for (let i = 0; i < locs.length; i += step) {
      const loc = locs[i];
      const p = this.latLonToScreen(loc.lat, loc.lon);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;

      // Colored diamond marker
      const color = loc.color || '#94a3b8';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.fillRect(-dotSize / 2, -dotSize / 2, dotSize, dotSize);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-dotSize / 2, -dotSize / 2, dotSize, dotSize);
      ctx.restore();

      // Label at sufficient zoom
      if (showLabels) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        const label = zoom >= 11 ? loc.name : loc.industryName;
        ctx.fillText(label, p.x, p.y - dotSize - 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawSignalBoxes(ctx: CanvasRenderingContext2D) {
    const sbs = window.game?.staffManager?.signalBoxes;
    if (!sbs || sbs.length === 0) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    for (const sb of sbs) {
      const p = this.latLonToScreen(sb.lat, sb.lon);
      if (p.x < -40 || p.x > this.logicalWidth + 40) continue;
      // Draw radius circle
      const metersPerPixel = 156543.03 * Math.cos(sb.lat * Math.PI / 180) / Math.pow(2, zoom);
      const radiusPx = (sb.radiusKm * 1000) / metersPerPixel;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Draw icon
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
      // Label
      if (zoom >= 9) {
        ctx.fillStyle = '#c4b5fd';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sb.name, p.x, p.y - 8);
      }
    }
  }

  drawRegulationZones(ctx: CanvasRenderingContext2D) {
    const zones = window.game?.staffManager?.zones;
    if (!zones || zones.length === 0) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    for (const z of zones) {
      if (z.lat == null || z.lon == null || !Number.isFinite(Number(z.lat)) || !Number.isFinite(Number(z.lon))) continue;
      const p = this.latLonToScreen(z.lat, z.lon);
      if (p.x < -100 || p.x > this.logicalWidth + 100) continue;
      const metersPerPixel = 156543.03 * Math.cos(z.lat * Math.PI / 180) / Math.pow(2, zoom);
      const radiusPx = ((z.radiusKm || 30) * 1000) / metersPerPixel;
      // Draw radius circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw center marker
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0ea5e9';
      ctx.fill();
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      if (zoom >= 8) {
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.name, p.x, p.y - 10);
      }
    }
  }

  _livemapCategoryForService(svc: RendererService) {
    const raw = String(svc?.category || svc?.train?.category || '').toLowerCase();
    if (LIVEMAP_CATEGORIES.includes(raw)) return raw;
    const type = String(svc?.serviceType || '').toLowerCase();
    if (type === 'fret') return 'fret';
    if (type === 'w') return 'w';
    if (type === 'hlp' || type === 'm-' || type === 'evo') return 'hlp';
    if (type === 'tm') return 'tm';
    if (type === 'infra') return 'infra';
    if (type === 'ttx' || type === 'work' || raw === 'travaux') return 'ttx';
    // Historical saves used one generic "machine" category for HLP + TM.
    if (raw === 'machine') return type === 'tm' ? 'tm' : 'hlp';
    return raw === 'fret' ? 'fret' : 'voyageur';
  }

  _livemapMarkerRadius(zoom: number, compact : unknown = false) {
    if (compact) return zoom >= 10 ? 4.5 : 3.5;
    if (zoom >= 13) return 7;
    if (zoom >= 10) return 6;
    if (zoom >= 7) return 5;
    return 4;
  }

  _ormTrainGeoHeading(svc: RendererService) {
    // Geographic tangent of the exact active route segment. Radians, 0 = north,
    // +PI/2 = east. The 3D follow camera uses this value so it turns with the
    // railway instead of staying north-up while the train curves.
    const route = svc?._state?.cachedRoute;
    let idx = Number(svc?._state?.index);
    if (Array.isArray(route) && route.length >= 2 && Number.isFinite(idx)) {
      idx = Math.max(0, Math.min(route.length - 2, Math.floor(idx)));
      let a = route[idx], b = route[idx + 1];
      let j = idx + 1;
      while (a && b && a.lat === b.lat && a.lon === b.lon && j < route.length - 1) b = route[++j];
      if (a && b) {
        const lat1 = Number(a.lat) * Math.PI / 180;
        const lat2 = Number(b.lat) * Math.PI / 180;
        const dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
        if ([lat1, lat2, dLon].every(Number.isFinite)) {
          const y = Math.sin(dLon) * Math.cos(lat2);
          const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
          return Math.atan2(y, x);
        }
      }
    }
    const geoHeading = Number(svc?.train?.geoHeading);
    if (Number.isFinite(geoHeading)) return geoHeading;
    const target = typeof svc?.getTargetStation === 'function' ? svc.getTargetStation() : null;
    if (target && svc?.position) {
      const lat1 = Number(svc.position.lat) * Math.PI / 180;
      const lat2 = Number(target.lat) * Math.PI / 180;
      const dLon = (Number(target.lon) - Number(svc.position.lon)) * Math.PI / 180;
      if ([lat1, lat2, dLon].every(Number.isFinite)) {
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return Math.atan2(y, x);
      }
    }
    // train.heading is a 2D canvas angle (0 = east), convert it back to the
    // geographic convention used by the camera.
    const trainHeading = Number(svc?.train?.heading);
    if (Number.isFinite(trainHeading)) return trainHeading + Math.PI / 2;
    return 0;
  }

  _ormTrainHeading(svc: RendererService, projector : unknown = null) {
    // The ActiveService movement state is already locked to the real routed
    // OSM polyline. Derive the visual tangent from that exact current segment
    // instead of pointing at the next station.
    const route = svc?._state?.cachedRoute;
    let idx = Number(svc?._state?.index);
    if (Array.isArray(route) && route.length >= 2 && Number.isFinite(idx)) {
      idx = Math.max(0, Math.min(route.length - 2, Math.floor(idx)));
      let a = route[idx], b = route[idx + 1];
      // Skip zero-length duplicate route points without leaving the routed line.
      let j = idx + 1;
      while (a && b && a.lat === b.lat && a.lon === b.lon && j < route.length - 1) {
        b = route[++j];
      }
      if (a && b) {
        const project = typeof projector === 'function' ? projector : ((lat: unknown, lon: unknown) => this.latLonToScreen(lat, lon));
        const pa = project(a.lat, a.lon);
        const pb = project(b.lat, b.lon);
        if (Number.isFinite(pa?.x) && Number.isFinite(pa?.y) && Number.isFinite(pb?.x) && Number.isFinite(pb?.y)) {
          return Math.atan2(pb.y - pa.y, pb.x - pa.x);
        }
      }
    }
    const trainHeading = Number(svc?.train?.heading);
    if (Number.isFinite(trainHeading)) return trainHeading;
    const target = typeof svc?.getTargetStation === 'function' ? svc.getTargetStation() : null;
    if (target && svc?.position) {
      const pa = this.latLonToScreen(svc.position.lat, svc.position.lon);
      const pb = this.latLonToScreen(target.lat, target.lon);
      return Math.atan2(pb.y - pa.y, pb.x - pa.x);
    }
    return 0;
  }

  _smoothTrainHeading(svc: { id: unknown }, target: number, nowMs: number, namespace : string = 'map') {
    const rawId = String(svc?.id || '');
    const id = rawId ? (namespace === 'map' ? rawId : `${namespace}:${rawId}`) : '';
    if (!id || !Number.isFinite(target)) return Number.isFinite(target) ? target : 0;
    const now = Number.isFinite(nowMs) ? nowMs : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const prev = this._trainHeadingVisual.get(id);
    if (!prev || !Number.isFinite(prev.angle) || now - prev.time > 1000) {
      this._trainHeadingVisual.set(id, { angle: target, time: now, seen: now });
      return target;
    }
    const dt = Math.max(0, Math.min(0.25, (now - prev.time) / 1000));
    // Shortest angular path + ~80 ms visual time constant. This smooths a
    // turnout/curve transition without changing the train's physical route.
    const delta = Math.atan2(Math.sin(target - prev.angle), Math.cos(target - prev.angle));
    const alpha = 1 - Math.exp(-dt * 12.5);
    const angle = prev.angle + delta * alpha;
    this._trainHeadingVisual.set(id, { angle, time: now, seen: now });
    return angle;
  }

  _sweepTrainHeadingCache(nowMs: number, liveCount: number) {
    if (nowMs - this._lastTrainHeadingSweep < 5000 && this._trainHeadingVisual.size < Math.max(256, liveCount * 2)) return;
    this._lastTrainHeadingSweep = nowMs;
    for (const [id, st] of this._trainHeadingVisual) {
      if (!st || nowMs - (st.seen || st.time || 0) > 30000) this._trainHeadingVisual.delete(id);
    }
  }

  drawServices(ctx: CanvasRenderingContext2D, world: World, services: RendererService[]) {
    // HOTFIX50 — a rame physically parked in a depot is not live traffic. Keep
    // this filter before both 2D and GPS-3D marker paths.
    services = services.filter((svc) => !svc.train?.inMaintenance && !svc.train?.inDepot && !(svc.rame && (svc.rame.inMaintenance || svc.rame.currentLocation?.depotId)));
    // RE3D-01 — in GPS 3D mode the map/route remain on the tilted canvas, but
    // train markers move to a DOM billboard layer so arrows stay flat/readable.
    if (window.game?.ui?._threeDFollowActive) {
      this.sync3DMarkers(services);
      return;
    }
    if (this._re3dMarkerNodes?.size) this.clear3DMarkers();
    const zoom = this.tileMap?.zoomLevel || 10;
    const len = services.length;
    if (len === 0) return;

    // Viewport bounds for fast lat/lon reject
    let vpMinLat, vpMaxLat, vpMinLon, vpMaxLon;
    if (len > 200 && this.tileMap) {
      const tl = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
      const br = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
      if (tl && br) {
        vpMinLat = Math.min(tl.lat, br.lat) - 0.1;
        vpMaxLat = Math.max(tl.lat, br.lat) + 0.1;
        vpMinLon = Math.min(tl.lon, br.lon) - 0.1;
        vpMaxLon = Math.max(tl.lon, br.lon) + 0.1;
      }
    }

    const useBatch = len > 1000;
    const showLabels = zoom >= 7 && len < 5000;
    const w = this.logicalWidth, h = this.logicalHeight;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._sweepTrainHeadingCache(now, len);

    if (useBatch) {
      // Massive-scale renderer: still keeps category colour + direction, but
      // batches all circles/arrowheads by category into seven paths.
      const tm = this.tileMap;
      const fScale = tm._frameScale || (256 * Math.pow(2, tm.zoomLevel));
      const fCx = tm._frameCx;
      const fCy = tm._frameCy;
      const fHW = w / 2;
      const fHH = h / 2;
      const DEG2RAD = Math.PI / 180;
      const MAX_VISIBLE = 5000;
      const r = this._livemapMarkerRadius(zoom, true);
      const groups: Record<string, Array<[number, number, number, string | undefined]>> = Object.fromEntries(LIVEMAP_CATEGORIES.map((cat) => [cat, []]));
      let drawn = 0;

      for (let i = 0; i < len && drawn < MAX_VISIBLE; i++) {
        const svc = services[i];
        if (!svc || !svc.position || svc.state === 'completed') continue;
        if (svc.state === 'waiting' && !svc.train?.stoppedAt) continue;
        const lat = svc.position.lat, lon = svc.position.lon;
        if (vpMinLat !== undefined && vpMaxLat !== undefined && vpMinLon !== undefined && vpMaxLon !== undefined && (lat < vpMinLat || lat > vpMaxLat || lon < vpMinLon || lon > vpMaxLon)) continue;
        const sx = ((lon + 180) / 360) * fScale - fCx + fHW;
        if (sx < -30 || sx > w + 30) continue;
        const sinLat = Math.sin(lat * DEG2RAD);
        const sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * fScale - fCy + fHH;
        if (sy < -30 || sy > h + 30) continue;
        const cat = this._livemapCategoryForService(svc);
        const rawHeading = Number(svc.train?.heading);
        const heading = Number.isFinite(rawHeading) ? rawHeading : 0;
        groups[cat].push([sx, sy, heading, svc.state]);
        drawn++;
      }

      for (const cat of LIVEMAP_CATEGORIES) {
        const items = groups[cat];
        if (!items.length) continue;
        ctx.beginPath();
        for (const [x, y, heading] of items) this._appendTrainIconPath(ctx, x, y, r, heading);
        ctx.fillStyle = LIVEMAP_CATEGORY_COLORS[cat];
        ctx.globalAlpha = 0.96;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.78)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Selection remains obvious even in massive mode.
      const selected = window.game?.ui?.selectedService;
      if (selected?.position && selected.state !== 'completed' && !selected.completed) {
        const p = this.latLonToScreen(selected.position.lat, selected.position.lon);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    // Detailed rendering for normal gameplay scale (500–1000 trains included).
    const r = this._livemapMarkerRadius(zoom, false);
    for (let i = 0; i < len; i++) {
      const svc = services[i];
      if (!svc || !svc.position || !svc.train) continue;
      if (svc.state === 'completed') continue;
      if (svc.state === 'waiting' && !svc.train.stoppedAt) continue;
      if (vpMinLat !== undefined && vpMaxLat !== undefined && vpMinLon !== undefined && vpMaxLon !== undefined) {
        const lat = svc.position.lat, lon = svc.position.lon;
        if (lat < vpMinLat || lat > vpMaxLat || lon < vpMinLon || lon > vpMaxLon) continue;
      }

      const p = this.latLonToScreen(svc.position.lat, svc.position.lon);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;

      const cat = this._livemapCategoryForService(svc);
      const color = LIVEMAP_CATEGORY_COLORS[cat] || '#3b82f6';

      // LVM-06 — selected train only: no permanent glow on every moving service.
      if (window.game?.ui?.selectedService?.id === svc.id) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      const targetHeading = this._ormTrainHeading(svc);
      const heading = this._smoothTrainHeading(svc, targetHeading, now);
      this._drawTrainIcon(ctx, p, cat, color, r, svc.state, heading);

      if (svc.train.breakdown) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(p.x + r + 4, p.y - r - 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (svc.train.blockedBy) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(p.x - r - 4, p.y - r - 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (showLabels) {
        const labelX = p.x + r * 2.4 + 7;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${zoom >= 10 ? 11 : 9}px sans-serif`;
        ctx.fillStyle = '#fff';
        let label = `${Math.round(Number(svc.train.speed) || 0)} km/h`;
        if (svc.train.blockedBy) label += ' [BLOQUE]';
        ctx.fillText(label, labelX, p.y - 7);
        const liveDelay = operationalDelayMinutes(Number(svc.train.delay) || 0);
        ctx.fillStyle = svc.isRescue ? '#ef4444' : (liveDelay > 0 ? '#ef4444' : liveDelay < 0 ? '#38bdf8' : '#10b981');
        ctx.fillText(svc.isRescue ? `${svc.name} [SECOURS]` : svc.name, labelX, p.y + 7);
        if (liveDelay > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`+${liveDelay} min`, labelX, p.y + 21);
        } else if (liveDelay < 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`- ${Math.abs(liveDelay)} min`, labelX, p.y + 21);
        }
        ctx.restore();
      }
    }
  }

  // RE3D-01 — keep at most a small visible set of DOM arrows. No images, no
  // Train markers never become WebGL meshes and create no per-frame array clones;
  // only the optional terrain surface uses WebGL, keeping train UI cheap on 32-bit Opera.
  sync3DMarkers(services: RendererService[]) {
    const layer = document.getElementById('re3d-marker-plane');
    const followLayer = document.getElementById('re3d-follow-marker-plane');
    if (!layer || !followLayer) return;
    const ui = window.game?.ui;
    const selected = ui?.selectedService || null;
    const maxMarkers = 64;
    if (!this._re3dMarkerNodes) this._re3dMarkerNodes = new Map();
    const nodes = this._re3dMarkerNodes;
    const alive = new Set();
    const chosen: RendererService[] = [];

    // Visibility is checked BEFORE the 64-marker budget, not after it.
    // Distant services must not consume every slot around the followed train.
    const projected = new Map<string, RendererPoint>();
    const addVisible = (svc: RendererService) => {
      if (!svc?.position || svc.state === 'completed') return;
      const id = String(svc.id);
      const pinned = id === String(selected?.id ?? '') && ui?._threeDFollowActive && String(ui?._followService?.id ?? '') === id;
      const relief = this.terrain3D?.enabled && this.terrain3D?.ready;
      const p = pinned ? {x: this.viewportWidth / 2, y: this.viewportHeight / 2} : (relief ? this.terrain3D.projectLatLon(svc.position.lat, svc.position.lon) : this.latLonToScreen(svc.position.lat, svc.position.lon));
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      if (!pinned && (p.x < -80 || p.x > this.logicalWidth + 80 || p.y < -80 || p.y > this.logicalHeight + 80)) return;
      projected.set(id, p);
      chosen.push(svc);
    };
    if (selected?.position) addVisible(selected);
    for (let i = 0; i < (services?.length || 0) && chosen.length < maxMarkers; i++) {
      const svc = services[i];
      if (!svc?.position || svc.state === 'completed' || svc.id === selected?.id) continue;
      if (svc.state === 'waiting' && !svc.train?.stoppedAt) continue;
      addVisible(svc);
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._sweepTrainHeadingCache(now, chosen.length);
    for (const svc of chosen) {
      const id = String(svc.id);
      const isSelected = id === String(selected?.id ?? '');
      const isPinnedFollow = !!(isSelected && ui?._threeDFollowActive && String(ui?._followService?.id ?? '') === id);
      const relief = this.terrain3D?.enabled && this.terrain3D?.ready;
      let p: RendererPoint | null = projected.get(id) || null;
      // HOTFIX23 — pin the followed arrow in SCREEN SPACE, not in the oversized
      // map plane. HOTFIX21/22 used logicalWidth/logicalHeight, which are the
      // pre-perspective overscan dimensions; after rotateX the visual point could
      // land around 70–80% of the screen or leave the frame at close zoom.
      if (isPinnedFollow) {
        p = { x:this.viewportWidth / 2, y:this.viewportHeight / 2, depth:p?.depth };
      }
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (!isPinnedFollow && (p.x < -80 || p.x > this.logicalWidth + 80 || p.y < -80 || p.y > this.logicalHeight + 80)) continue;
      alive.add(id);
      let rec = nodes.get(id);
      if (!rec) {
        const root = document.createElement('div');
        root.className = 're3d-train-marker';
        root.dataset.serviceId = id;
        root.title = 'Cliquer pour suivre ce train';
        const arrow = document.createElement('div');
        arrow.className = 're3d-train-arrow';
        arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 21 21l-9-4.7L3 21z"/></svg>';
        const label = document.createElement('div');
        label.className = 're3d-train-label';
        const title = document.createElement('span');
        const sub = document.createElement('small');
        label.append(title, sub);
        root.append(arrow, label);
        root.addEventListener('click', (e) => {
          e.stopPropagation();
          window.game?.ui?.selectServiceById?.(root.dataset.serviceId);
          window.game?.ui?.recenter3DFollow?.();
        });
        (isPinnedFollow ? followLayer : layer).appendChild(root);
        rec = { root, title, sub };
        nodes.set(id, rec);
      }
      // HOTFIX24 — if the followed service changes, move the existing marker
      // between the tilted map plane and the fixed screen-space follow plane.
      const targetLayer = isPinnedFollow ? followLayer : layer;
      if (rec.root.parentElement !== targetLayer) targetLayer.appendChild(rec.root);
      const cat = this._livemapCategoryForService(svc);
      const color = LIVEMAP_CATEGORY_COLORS[cat] || '#3b82f6';
      rec.root.classList.toggle('selected', isSelected);
      rec.root.style.setProperty('--re3d-color', color);
      rec.root.style.left = `${p.x.toFixed(1)}px`;
      rec.root.style.top = `${p.y.toFixed(1)}px`;
      let targetHeading;
      if (relief) {
        // In true DEM mode _ormTrainHeading() returns a projected screen tangent
        // whose zero axis points right (+X). The SVG train arrow itself is drawn
        // pointing UP at rotate(0deg), so add +90° to convert +X-based tangent
        // angles into the arrow's native up-based CSS rotation convention.
        const screenTangent = Number(this._ormTrainHeading(svc, (lat: unknown, lon: unknown) => this.terrain3D.projectLatLon(lat as number, lon as number))) || 0;
        targetHeading = screenTangent + Math.PI / 2;
      } else {
        // CSS fallback: the map is already rotated by -cameraHeading and each
        // marker billboard is counter-rotated so labels stay horizontal. The SVG
        // arrow is natively UP at 0°, therefore its remaining local rotation is
        // simply route bearing - camera bearing (no historical -90° offset).
        const geoHeading = Number(this._ormTrainGeoHeading(svc)) || 0;
        const cameraHeading = Number(ui?._threeDCameraHeading || 0);
        targetHeading = geoHeading - cameraHeading;
      }
      const heading = this._smoothTrainHeading(svc, targetHeading, now, '3d');
      // CSS rotate() consumes degrees; renderer headings are radians. HOTFIX18
      // fixes the old rad-as-deg bug that made a 90° curve look like ~1.6°.
      const headingDeg = Number(heading || 0) * 180 / Math.PI;
      rec.root.style.setProperty('--re3d-heading', `${headingDeg.toFixed(1)}deg`);
      rec.title.textContent = String(svc.name || svc.train?.seriesName || 'Train');
      const speed = Math.max(0, Math.round(Number(svc.train?.speed || 0)));
      const delay = operationalDelayMinutes(Number(svc.train?.delay || 0));
      rec.sub.textContent = `${speed} km/h${delay > 0 ? ` · +${delay} min` : delay < 0 ? ` · -${Math.abs(delay)} min` : ''}`;
    }

    for (const [id, rec] of nodes) {
      if (alive.has(id)) continue;
      rec.root?.remove?.();
      nodes.delete(id);
    }
  }

  clear3DMarkers() {
    if (this._re3dMarkerNodes) {
      for (const rec of this._re3dMarkerNodes.values()) rec.root?.remove?.();
      this._re3dMarkerNodes.clear();
    }
    const layer = document.getElementById('re3d-marker-plane');
    if (layer) layer.textContent = '';
    const followLayer = document.getElementById('re3d-follow-marker-plane');
    if (followLayer) followLayer.textContent = '';
  }

  _operationalIcon(src: string) {
    if (!src) return null;
    if (this._operationalIconCache.has(src)) return this._operationalIconCache.get(src);
    const img = new Image();
    img.onload = () => this.requestRender();
    img.onerror = () => this.requestRender();
    img.src = src;
    this._operationalIconCache.set(src, img);
    return img;
  }

  _operationalIconSize(zoom: unknown) {
    // HOTFIX47 — operational pictograms intentionally grow with every zoom step.
    // They stay compact at Europe scale but become unmistakable at local scale.
    const z = Number.isFinite(Number(zoom)) ? Number(zoom) : 10;
    return Math.round(Math.max(8, Math.min(40, 8 + Math.max(0, z - 5) * 2.1)));
  }

  // v1.1.66 — station incidents are deliberately smaller than generic event
  // pictograms and are drawn ON TOP of the normal station marker. At local zoom
  // a thin rim of the yellow station marker remains visible around the icon.
  _operationalStationIconSize(zoom: unknown) {
    const z = Number.isFinite(Number(zoom)) ? Number(zoom) : 10;
    return Math.round(Math.max(4, Math.min(24, 4 + Math.max(0, z - 5) * 1.25)));
  }

  _drawOperationalIcon(ctx: CanvasRenderingContext2D, src: unknown, lat: unknown, lon: unknown, opts : Record<string, unknown> = {}) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return;
    const p = this.latLonToScreen(Number(lat), Number(lon));
    if (!p || p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) return;
    const size = Number(opts.size || this._operationalIconSize(this.tileMap?.zoomLevel || 10));
    const x = p.x + Number(opts.dx || 0);
    const y = p.y + Number(opts.dy || 0);
    const img = this._operationalIcon(String(src || ''));
    if (img?.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }
  }

  _eventMidpoint(route: unknown, world: World, stationA: unknown, stationB: unknown) {
    if (Array.isArray(route) && route.length) {
      const p = route[Math.max(0, Math.min(route.length - 1, Math.floor(route.length / 2)))];
      if (Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lon))) return { lat:Number(p.lat), lon:Number(p.lon) };
    }
    const a = stationA ? world?.getStationById?.(String(stationA)) : null;
    const b = stationB ? world?.getStationById?.(String(stationB)) : null;
    if (a && b) return { lat:(Number(a.lat)+Number(b.lat))/2, lon:(Number(a.lon)+Number(b.lon))/2 };
    if (a) return { lat:Number(a.lat), lon:Number(a.lon) };
    if (b) return { lat:Number(b.lat), lon:Number(b.lon) };
    return null;
  }

  _activeWorksDisplayItems(engine: RendererEngine | null | undefined): RendererWorkItem[] {
    const game = typeof window !== 'undefined' ? window.game : null;
    if (!game?.worksManager) return [];
    const dateStr = engine?.getParisDate?.() || game.engine?.getParisDate?.();
    const pt = engine?.getParisTime?.() || game.engine?.getParisTime?.();
    const timeOfDay = pt
      ? Number(pt.hours || 0) * 60 + Number(pt.minutes || 0) + Number(pt.seconds || 0) / 60
      : Number(game.timeOfDay || 0);
    return game.worksManager.getActiveDisplayItems?.(dateStr, timeOfDay)
      || game.worksManager.getActiveRestrictions?.(dateStr, timeOfDay)
      || [];
  }

  drawActiveWorksZones(ctx: CanvasRenderingContext2D, world: World, engine: RendererEngine | null | undefined) {
    this._livemapWorkHitZones = [];
    if (!ctx || !world || !this.tileMap) return;
    const items = this._activeWorksDisplayItems(engine);
    if (!items.length) return;

    const zoom = Number(this.tileMap.zoomLevel || 10);
    // Very dark burnt orange requested for the Livemap Works footprint.
    const color = '#7c2d12';
    const coreWidth = Math.max(2.4, Math.min(6.0, 2.4 + Math.max(0, zoom - 7) * 0.28));
    const underWidth = coreWidth + 4;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const item of items) {
      if (item?.stationOnly || !Array.isArray(item?.route) || item.route.length < 2) continue;
      const pts: Array<{ x: number; y: number }> = [];
      let last = null;
      for (let i = 0; i < item.route.length; i++) {
        const q = item.route[i];
        if (!Number.isFinite(Number(q?.lat)) || !Number.isFinite(Number(q?.lon))) continue;
        const p = this.latLonToScreen(Number(q.lat), Number(q.lon));
        if (!p) continue;
        const isLast = i === item.route.length - 1;
        // Same display-only simplification used for selected Schedule Creator routes.
        if (!last || isLast || Math.hypot(p.x - last.x, p.y - last.y) >= 0.75) {
          pts.push({ x:p.x, y:p.y });
          last = p;
        }
      }
      if (pts.length < 2) continue;

      const drawStroke = (strokeStyle: string | CanvasGradient | CanvasPattern, lineWidth: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      };
      drawStroke('#06101d', underWidth, 0.88);
      drawStroke(color, coreWidth, 0.92);
      this._livemapWorkHitZones.push({ item, points:pts, hitWidth:Math.max(9, coreWidth + 5) });
    }
    ctx.restore();
  }

  getActiveWorkZoneAt(x: unknown, y: unknown) {
    const zones = Array.isArray(this._livemapWorkHitZones) ? this._livemapWorkHitZones : [];
    let best = null;
    let bestD = Infinity;
    const px = Number(x), py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    const segDist = (p: __S3Struct204, a: __S3Struct205, b: __S3Struct206) => {
      const dx=b.x-a.x, dy=b.y-a.y;
      const len2=dx*dx+dy*dy;
      if (len2 <= 1e-9) return Math.hypot(p.x-a.x,p.y-a.y);
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2));
      return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
    };
    for (const zone of zones) {
      const pts=zone?.points||[];
      const maxD=Number(zone?.hitWidth||9);
      for (let i=1;i<pts.length;i++) {
        const d=segDist({x:px,y:py},pts[i-1],pts[i]);
        if (d<=maxD && d<bestD) { bestD=d; best=zone.item; }
      }
    }
    return best;
  }

  drawOperationalEventIcons(ctx: CanvasRenderingContext2D, world: World, services: RendererService[], engine: RendererEngine | null | undefined) {
    const game = typeof window !== 'undefined' ? window.game : null;
    if (!game || !world) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    const size = this._operationalIconSize(zoom);
    const stationSize = this._operationalStationIconSize(zoom);
    const trainOffset = Math.max(6, size * 0.72);
    const serviceById = new Map((services || []).map((svc) => [String(svc?.id || ''), svc] as const));

    const STOP_ICON = OP_ICON_STOP;
    const WARN_ICON = OP_ICON_WARN;
    const WORKS_ICON = OP_ICON_WORKS;

    for (const inc of game.incidentManager?.getActiveIncidents?.() || []) {
      if (!inc || inc.active === false) continue;
      const src = inc.effect === 'stop' ? STOP_ICON : WARN_ICON;

      // Train-specific incidents: icon follows the affected train.
      if (inc.serviceId) {
        const svc = serviceById.get(String(inc.serviceId)) || (services || []).find((s) => String(s?.train?.id || '') === String(inc.trainId || ''));
        if (svc?.position) {
          this._drawOperationalIcon(ctx, src, svc.position.lat, svc.position.lon, {
            size, dx: trainOffset, dy: -trainOffset,
          });
        }
        continue;
      }

      // Pure station incident: SUPERIMPOSE the compact pictogram directly on
      // the normal station marker. String comparison tolerates legacy saves where
      // one side of the same station id may have been deserialised differently.
      if (inc.stationA != null && inc.stationB != null &&
          String(inc.stationA) === String(inc.stationB)) {
        const st = world.getStationById?.(String(inc.stationA))
          || world.stations?.find?.((x: { id: unknown }) => String(x?.id) === String(inc.stationA));
        if (st) this._drawOperationalIcon(ctx, src, st.lat, st.lon, {
          size: stationSize, dx: 0, dy: 0,
        });
        continue;
      }

      // Interstation / routed zone incident: one icon at the real ORM zone.
      const mid = this._eventMidpoint(inc.route, world, inc.stationA, inc.stationB);
      if (mid) this._drawOperationalIcon(ctx, src, mid.lat, mid.lon, { size });
    }

    const worksItems = this._activeWorksDisplayItems(engine);
    for (const r of worksItems) {
      const stationId = r.stationId || r.stationA;
      const st = r.stationOnly
        ? (world.getStationById?.(String(stationId ?? '')) || r.station || (Number.isFinite(Number(r.stationLat)) && Number.isFinite(Number(r.stationLon)) ? {lat:Number(r.stationLat),lon:Number(r.stationLon)} : null))
        : null;
      const mid = st || this._eventMidpoint(r.route, world, r.stationA, r.stationB);
      if (mid) this._drawOperationalIcon(ctx, WORKS_ICON, mid.lat, mid.lon, { size });
    }
  }

  // LVM-06 — selected service overlay uses the Schedule Creator visual language.
  drawSelectedServiceRoute(ctx: CanvasRenderingContext2D, world: World) {
    const svc = window.game?.ui?.selectedService;
    if (!svc || !world || !this.tileMap) return;

    const BLUE = '#2583ff';
    const GREEN = '#1fc86a';
    const RED = '#ff4d5b';

    // Same route treatment as Schedule Creator V2: dark underlay + clean colour
    // stroke and rounded joins/caps, with exact display vertices.
    // Crucially: no route-node dots. Stored OSM/ORM geometry is untouched.
    const drawRoute = (routes: unknown, color: string) => {
      if (!Array.isArray(routes)) return;
      for (const route of routes) {
        if (!Array.isArray(route) || route.length < 2) continue;
        // Retain the exact polyline. Reuse unchanged projections and cull only
        // chunks wholly outside the viewport (including their connecting segment).
        if (!this._routeDrawingCache) this._routeDrawingCache = new RouteDrawingCache();
        const tl=this.tileMap.screenToWorld?.(-16,-16,this.logicalWidth,this.logicalHeight);
        const br=this.tileMap.screenToWorld?.(this.logicalWidth+16,this.logicalHeight+16,this.logicalWidth,this.logicalHeight);
        // Pixel overscan preserves the entire 8 px stroke and rounded joins,
        // including at low zoom where a fixed degree margin is too small.
        const bounds=tl&&br?{minLat:Math.min(tl.lat,br.lat),maxLat:Math.max(tl.lat,br.lat),minLon:Math.min(tl.lon,br.lon),maxLon:Math.max(tl.lon,br.lon)}:(this._visibleGeoBounds(.01)||{minLat:-90,maxLat:90,minLon:-180,maxLon:180});
        const viewKey=[this.tileMap.centerLat,this.tileMap.centerLon,this.tileMap.zoomLevel,this.logicalWidth,this.logicalHeight].join('|');
        const paths=this._routeDrawingCache.project(route,bounds,viewKey,q=>this.latLonToScreen(q.lat,q.lon));
        if(!paths.length)continue;
        const stroke = (col: string, width: number, alpha: number) => {
          ctx.strokeStyle = col;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = width;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          for(const points of paths)for(let i=0;i<points.length;i++){const p=points[i];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}
          ctx.stroke();
        };
        ctx.save();
        stroke('#06101d', 8, 0.9);
        stroke(color, 4.5, 1);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const liveRoutes = (routes: typeof svc.routes, returnLeg: boolean) => {
      const live = svc._state?.cachedRoute;
      const legIndex = Math.max(0, Number(svc.currentStopIndex || 1) - 1);
      if (!routes || !!svc.isReturnLeg !== returnLeg || !live?.length || !routes[legIndex] || routes[legIndex] === live) return routes;
      const displayRoutes = routes.slice();
      displayRoutes[legIndex] = live;
      return displayRoutes;
    };
    drawRoute(liveRoutes(svc.routes, false), BLUE);
    if (svc.roundTrip) {
      // Never fake a return by reversing the outbound geometry.
      drawRoute(liveRoutes(svc._returnRoutes || null, true), GREEN);
    }

    // Scheduled stations are red and use the exact V2 track anchor whenever
    // available, so the marker sits on the route instead of the station centroid.
    const drawStation = (stop: __KPA79) => {
      if (!stop?.stationId) return;
      let lat = Number(stop.lat), lon = Number(stop.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        if (stop.voiePointId && window.game?.voiePointManager) {
          const vp = window.game.voiePointManager.getVoiePointById(stop.voiePointId);
          if (vp) { lat = Number(vp.lat); lon = Number(vp.lon); }
        }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const st = world.getStationById(String(stop.stationId));
        if (st) { lat = Number(st.lat); lon = Number(st.lon); }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const p = this.latLonToScreen(lat, lon);
      ctx.save();
      ctx.fillStyle = RED;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    for (const stop of svc.stops || []) drawStation(stop);
    if (svc.roundTrip) {
      const returnStops = svc.returnStops?.length
        ? svc.returnStops
        : (svc._returnStopsData || []);
      for (const stop of returnStops) drawStation(stop);
    }
  }

  // v1.1.55 — marker geometry: solid dot + separate direction tip.
  // No PNG and no centre symbol: category is carried only by colour.
  _appendTrainIconPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, heading: number) {
    const ux = Math.cos(heading), uy = Math.sin(heading);
    const vx = -uy, vy = ux;
    const baseD = r + 0.8;
    const tipD = r + Math.max(4, r * 0.95);
    const halfW = Math.max(2.0, r * 0.48);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x + ux * tipD, y + uy * tipD);
    ctx.lineTo(x + ux * baseD + vx * halfW, y + uy * baseD + vy * halfW);
    ctx.lineTo(x + ux * baseD - vx * halfW, y + uy * baseD - vy * halfW);
    ctx.closePath();
  }

  _drawTrainIcon(ctx: CanvasRenderingContext2D, p: RendererPoint, cat: unknown, color: string | CanvasGradient | CanvasPattern, r: number, state: unknown, heading : unknown = 0) {
    ctx.save();
    ctx.globalAlpha = state === 'waiting' ? 0.72 : 0.98;
    ctx.beginPath();
    this._appendTrainIconPath(ctx, p.x, p.y, r, heading as number);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: unknown, world: World, services: RendererService[]) {
    const now = performance.now();
    // Throttle minimap rendering to ~20 FPS
    if (now - this._lastMinimapDraw < this._minimapInterval) {
      // Draw cached minimap if available
      if (this._minimapCache) {
        ctx.putImageData(this._minimapCache.data, this._minimapCache.x, this._minimapCache.y);
      }
      return;
    }
    this._lastMinimapDraw = now;

    const mw = 150, mh = 110;
    const mx = w - mw - 8, my = 8;

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#1e3a5f';
    ctx.strokeRect(mx, my, mw, mh);

    if (world.stations.length === 0) return;

    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const st of world.stations) {
      minLat = Math.min(minLat, st.lat);
      maxLat = Math.max(maxLat, st.lat);
      minLon = Math.min(minLon, st.lon);
      maxLon = Math.max(maxLon, st.lon);
    }
    const padLat = (maxLat - minLat) * 0.15 + 0.5;
    const padLon = (maxLon - minLon) * 0.15 + 0.5;
    minLat -= padLat; maxLat += padLat;
    minLon -= padLon; maxLon += padLon;

    const projMini = (lat: number, lon: number) => ({
      x: mx + ((lon - minLon) / (maxLon - minLon)) * mw,
      y: my + ((maxLat - lat) / (maxLat - minLat)) * mh,
    });

    // Simplified tracks (no labels)
    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;
      const pa = projMini(stA.lat, stA.lon);
      const pb = projMini(stB.lat, stB.lon);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Simplified station dots (no labels)
    for (const st of world.stations) {
      const p = projMini(st.lat, st.lon);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active train dots only (hide if stopped at station > 5 game min)
    for (const svc of services) {
      if (!svc.position || svc.state === 'completed' || svc.state === 'cancelled') continue;
      if (svc.train?._stoppedSinceGameTime != null && svc.train.stoppedAt && window.game?.timeOfDay != null) {
        let el = window.game.timeOfDay - svc.train._stoppedSinceGameTime;
        if (el < 0) el += 1440;
        if (el > 5) continue;
      }
      const p = projMini(svc.position.lat, svc.position.lon);
      ctx.fillStyle = svc.train?.color || '#22d3ee';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cache the minimap region
    try {
      const dpr = window.devicePixelRatio || 1;
      this._minimapCache = {
        data: ctx.getImageData(mx * dpr, my * dpr, mw * dpr, mh * dpr),
        x: mx * dpr,
        y: my * dpr,
      };
    } catch (e: unknown) { /* security restriction on getImageData */ }
  }

  // S9: Cache train images for map rendering (no per-frame resizing)
  _getTrainImage(svc: RendererService) {
    if (!this._trainImageCache) this._trainImageCache = new Map();
    const cacheKey = svc.id;
    if (this._trainImageCache.has(cacheKey)) return this._trainImageCache.get(cacheKey);

    // Get first element with image data
    const el = svc.rame?.elementDetails?.find((e) => !!e.imageData);
    if (!el?.imageData) { this._trainImageCache.set(cacheKey, null); return null; }

    const img = new Image();
    img.src = el.imageData;
    this._trainImageCache.set(cacheKey, img);
    return img;
  }

  drawVoieLayerCached(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World) {
    const w = Math.max(1, Math.round(this.logicalWidth));
    const h = Math.max(1, Math.round(this.logicalHeight));
    const tm = this.tileMap;
    const key = `${voiePointManager.revision}|${tm.centerLat.toFixed(6)}|${tm.centerLon.toFixed(6)}|${tm.zoomLevel.toFixed(3)}|${w}x${h}`;
    if (!this._voieLayerCanvas || this._voieLayerCanvas.width !== w || this._voieLayerCanvas.height !== h) {
      this._voieLayerCanvas = document.createElement('canvas');
      this._voieLayerCanvas.width = w; this._voieLayerCanvas.height = h;
      this._voieLayerCtx = this._voieLayerCanvas.getContext('2d');
      this._voieLayerKey = '';
    }
    if (this._voieLayerKey !== key) {
      const c = this._voieLayerCtx!;
      c.clearRect(0, 0, w, h);
      this.drawVoieTroncons(c, voiePointManager, world, true);
      this.drawVoiePoints(c, voiePointManager, true);
      this._voieLayerKey = key;
    }
    ctx.drawImage(this._voieLayerCanvas, 0, 0, w, h);
    // Occupation is dynamic; only the tiny occupied subset is redrawn every frame.
    this.drawOccupiedVoieOverlay(ctx, voiePointManager, world);
  }

  _visibleGeoBounds(margin : number = 0.005) {
    const tl = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
    const br = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
    if (!tl || !br) return null;
    return {
      minLat: Math.min(tl.lat, br.lat) - margin, maxLat: Math.max(tl.lat, br.lat) + margin,
      minLon: Math.min(tl.lon, br.lon) - margin, maxLon: Math.max(tl.lon, br.lon) + margin,
    };
  }

  drawOccupiedVoieOverlay(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World) {
    const zoom = this.tileMap.zoomLevel;
    ctx.save();
    ctx.strokeStyle = '#ef4444'; ctx.fillStyle = '#ef4444'; ctx.lineWidth = 2;
    for (const trc of voiePointManager.getOccupiedTroncons?.() || []) {
      if (!trc) continue;
      const route = trc.route || [];
      if (route.length >= 2) {
        const p0 = this.latLonToScreen(route[0].lat, route[0].lon); ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
        const step = zoom >= 14 ? 1 : zoom >= 11 ? 2 : 4;
        for (let i = step; i < route.length; i += step) { const p = this.latLonToScreen(route[i].lat, route[i].lon); ctx.lineTo(p.x, p.y); }
        const pe = this.latLonToScreen(route[route.length - 1].lat, route[route.length - 1].lon); ctx.lineTo(pe.x, pe.y); ctx.stroke();
      }
    }
    for (const vp of voiePointManager.getOccupiedVoiePoints?.() || []) {
      if (!vp) continue;
      const p = this.latLonToScreen(vp.lat, vp.lon);
      if (p.x < -20 || p.x > this.logicalWidth + 20 || p.y < -20 || p.y > this.logicalHeight + 20) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    ctx.restore();
  }

  drawVoiePoints(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, staticBase : unknown = false) {
    const bounds = this._visibleGeoBounds(0.01);
    const visibleVPs = bounds && voiePointManager.getVoiePointsInBounds
      ? voiePointManager.getVoiePointsInBounds(bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon)
      : voiePointManager.getAll();
    for (const vp of visibleVPs) {
      const p = this.latLonToScreen(vp.lat, vp.lon);
      if (p.x < -20 || p.x > this.logicalWidth + 20 || p.y < -20 || p.y > this.logicalHeight + 20) continue;

      const isStationVP = !!vp.stationId;
      const isOccupied = staticBase ? false : !!vp.occupiedBy;
      const isLinePoint = !!vp.linePoint;
      // Line points only visible at high zoom
      if (isLinePoint && this.tileMap.zoomLevel < 11) continue;
      const size = isStationVP ? 3 : (isLinePoint ? 1.5 : 2.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = isOccupied ? '#ef4444' : (isStationVP ? '#1e40af' : (isLinePoint ? '#334155' : '#0f172a'));
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = isLinePoint ? '#64748b' : '#ffffff';
      ctx.lineWidth = isLinePoint ? 0.8 : 1.5;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      // Voie label at higher zoom (not for line points)
      if (!isLinePoint && this.tileMap.zoomLevel >= 10) {
        ctx.fillStyle = isOccupied ? '#ef4444' : '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`Voie ${vp.voie}`, p.x + 8, p.y + 3);
      }
    }
  }

  drawVoieTroncons(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World, staticBase : unknown = false) {
    // Viewport bounds for culling
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    const topLeft = this.tileMap ? this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight) : null;
    const botRight = this.tileMap ? this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight) : null;
    const hasViewport = topLeft && botRight;
    const vpMinLat = hasViewport ? Math.min(topLeft.lat, botRight.lat) - 0.005 : -90;
    const vpMaxLat = hasViewport ? Math.max(topLeft.lat, botRight.lat) + 0.005 : 90;
    const vpMinLon = hasViewport ? Math.min(topLeft.lon, botRight.lon) - 0.005 : -180;
    const vpMaxLon = hasViewport ? Math.max(topLeft.lon, botRight.lon) + 0.005 : 180;

    // Batch troncons by color (occupied vs free) for fewer state changes
    type DrawTroncon = {
      route?: Array<{ lat: number; lon: number }>;
      pointA: unknown; pointB: unknown; occupiedBy?: unknown;
      trackRef?: string; ref?: string; name?: string;
    };
    const freeTrcs: DrawTroncon[] = [];
    const occupiedTrcs: DrawTroncon[] = [];
    const visibleTrcs: DrawTroncon[] = [];

    const sourceTrcs = voiePointManager.getTronconsInBounds
      ? voiePointManager.getTronconsInBounds(vpMinLat, vpMaxLat, vpMinLon, vpMaxLon)
      : voiePointManager.getAllTroncons();
    for (const trc of sourceTrcs) {
      if (!trc.route || trc.route.length < 2) {
        const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
        const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
        if (!ptA || !ptB) continue;
        // Viewport cull
        const minLat = Math.min(ptA.lat, ptB.lat);
        const maxLat = Math.max(ptA.lat, ptB.lat);
        const minLon = Math.min(ptA.lon, ptB.lon);
        const maxLon = Math.max(ptA.lon, ptB.lon);
        if (maxLat < vpMinLat || minLat > vpMaxLat || maxLon < vpMinLon || minLon > vpMaxLon) continue;
        ((trc.occupiedBy && !staticBase) ? occupiedTrcs : freeTrcs).push(trc);
        visibleTrcs.push(trc);
        continue;
      }
      // Viewport cull using first/last route points
      const rF = trc.route[0], rL = trc.route[trc.route.length - 1];
      const minLat = Math.min(rF.lat, rL.lat);
      const maxLat = Math.max(rF.lat, rL.lat);
      const minLon = Math.min(rF.lon, rL.lon);
      const maxLon = Math.max(rF.lon, rL.lon);
      if (maxLat < vpMinLat || minLat > vpMaxLat || maxLon < vpMinLon || minLon > vpMaxLon) continue;
      ((trc.occupiedBy && !staticBase) ? occupiedTrcs : freeTrcs).push(trc);
      visibleTrcs.push(trc);
    }

    // Route simplification step based on zoom
    const zoom = this.tileMap?.zoomLevel || 10;
    const step = zoom >= 14 ? 1 : zoom >= 11 ? 2 : 4;

    // Draw free tronçons (single batch)
    if (freeTrcs.length > 0) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const trc of freeTrcs) {
        if (!trc.route || trc.route.length < 2) {
          const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
          const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
          if (!ptA || !ptB) continue;
          const pa = this.latLonToScreen(ptA.lat, ptA.lon);
          const pb = this.latLonToScreen(ptB.lat, ptB.lon);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        } else {
          const p0 = this.latLonToScreen(trc.route[0].lat, trc.route[0].lon);
          ctx.moveTo(p0.x, p0.y);
          for (let i = step; i < trc.route.length; i += step) {
            const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
            ctx.lineTo(p.x, p.y);
          }
          const pL = trc.route[trc.route.length - 1];
          const pEnd = this.latLonToScreen(pL.lat, pL.lon);
          ctx.lineTo(pEnd.x, pEnd.y);
        }
      }
      ctx.stroke();
    }

    // Draw occupied tronçons (red, single batch)
    if (occupiedTrcs.length > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const trc of occupiedTrcs) {
        if (!trc.route || trc.route.length < 2) {
          const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
          const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
          if (!ptA || !ptB) continue;
          const pa = this.latLonToScreen(ptA.lat, ptA.lon);
          const pb = this.latLonToScreen(ptB.lat, ptB.lon);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        } else {
          const p0 = this.latLonToScreen(trc.route[0].lat, trc.route[0].lon);
          ctx.moveTo(p0.x, p0.y);
          for (let i = step; i < trc.route.length; i += step) {
            const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
            ctx.lineTo(p.x, p.y);
          }
          const pL = trc.route[trc.route.length - 1];
          const pEnd = this.latLonToScreen(pL.lat, pL.lon);
          ctx.lineTo(pEnd.x, pEnd.y);
        }
      }
      ctx.stroke();
    }

    // Player note / Annex 6 — small circle on each traced point (50 m vertex) at high zoom.
    if (zoom >= 12 && visibleTrcs.length > 0) {
      ctx.fillStyle = zoom >= 14 ? '#cbd5e1' : '#64748b';
      ctx.beginPath();
      for (const trc of visibleTrcs) {
        if (!trc.route || trc.route.length < 2) continue;
        for (let i = step; i < trc.route.length - 1; i += step) {
          const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
          ctx.moveTo(p.x + 1.5, p.y);
          ctx.arc(p.x, p.y, zoom >= 14 ? 1.5 : 1, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }

    // Annex 6 — direction arrows + PA/PB markers on user tronçons at high zoom
    if (zoom >= 14 && visibleTrcs.length > 0) {
      ctx.save();
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const trc of visibleTrcs) {
        const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
        const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
        if (!ptA || !ptB) continue;
        const start = this.latLonToScreen(ptA.lat, ptA.lon);
        const end = this.latLonToScreen(ptB.lat, ptB.lon);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len < 12) continue;
        const angle = Math.atan2(dy, dx);
        const perp = angle + Math.PI / 2;
        const off = 10;
        const ox = Math.cos(perp) * off;
        const oy = Math.sin(perp) * off;
        // PA / PB labels
        ctx.fillText('PA', start.x + ox, start.y + oy);
        ctx.fillText('PB', end.x + ox, end.y + oy);
        // Direction arrow + labels at midpoint
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        this._drawArrow(ctx, midX, midY, angle, 5, '#e2e8f0');

        // Track label (OSM ref/name/trackRef)
        const trkLabel = trc.trackRef || trc.ref || trc.name || '';
        if (trkLabel) {
          ctx.save();
          ctx.font = 'bold 8px sans-serif';
          const metrics = ctx.measureText(trkLabel);
          const pad = 2;
          ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
          ctx.fillRect(midX - metrics.width / 2 - pad, midY - 18, metrics.width + pad * 2, 12);
          ctx.fillStyle = '#e0e7ff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(trkLabel, midX, midY - 12);
          ctx.restore();
        }

        // Direction label
        const destName = ptB.stationId ? (world.getStationById(ptB.stationId)?.name || 'PB') : 'PB';
        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Direction ${destName}`, midX + 6, midY + 8);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  _drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string | CanvasGradient | CanvasPattern) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw signal lights at canton boundaries for active services.
   * Green = clear, Yellow = approach (next canton occupied), Red = stop.
   */
  drawSignals(ctx: CanvasRenderingContext2D, services: RendererService[]) {
    const zoom = this.tileMap.zoomLevel;
    if (zoom < 12) return; // Only show signals at high zoom

    // Viewport bounds for culling
    const topLeft = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
    const botRight = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
    if (!topLeft || !botRight) return;
    const vpMinLat = Math.min(topLeft.lat, botRight.lat) - 0.005;
    const vpMaxLat = Math.max(topLeft.lat, botRight.lat) + 0.005;
    const vpMinLon = Math.min(topLeft.lon, botRight.lon) - 0.005;
    const vpMaxLon = Math.max(topLeft.lon, botRight.lon) + 0.005;

    const cantonMgr = window.game?.cantonManager;
    if (!cantonMgr) return;

    const signalRadius = zoom >= 15 ? 5 : zoom >= 13 ? 4 : 3;

    // Signal geometry is infrastructure, not a list of currently visible trains.
    // Use the complete active fleet so panning/zooming cannot hide or recolour it.
    const signalServices = [
      ...(window.game?.scheduleCreator?.getActiveServices?.() || services),
      ...(window.game?.depotManager?.getPhysicalRescueServices?.() || []),
    ] as SignalRouteService[];
    const signals=displayBlockSignals(signalServices,cantonMgr,{minLat:vpMinLat,maxLat:vpMaxLat,minLon:vpMinLon,maxLon:vpMaxLon});
    for(const signal of signals){
        const pt=signal;
        const color=signal.aspect===0?'#ef4444':signal.aspect===30?'#eab308':'#22c55e';
        const screenPos = this.latLonToScreen(pt.lat, pt.lon);

        // Signal post (small vertical line)
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y + signalRadius);
        ctx.lineTo(screenPos.x, screenPos.y + signalRadius + 6);
        ctx.stroke();

        // Signal head (filled circle with glow)
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, signalRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glow effect for red/yellow signals
        if (color !== '#22c55e') {
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, signalRadius + 3, 0, Math.PI * 2);
          ctx.fillStyle = color === '#ef4444' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)';
          ctx.fill();
        }

        // Annex 7 — label signal aspect at very high zoom
        if (zoom >= 15) {
          const aspectLabel = color === '#22c55e' ? 'voie libre' : color === '#eab308' ? 'avertissement' : 'arrêt de canton';
          ctx.fillStyle = color;
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(aspectLabel, screenPos.x, screenPos.y - signalRadius - 2);
        }
    }
  }

  _getTronconEndpoint(pointId: unknown, voiePointManager: VoiePointManager, world: World) {
    // Could be a voie point or a station
    const pointKey = String(pointId);
    const vp = voiePointManager.getVoiePointById(pointKey);
    if (vp) return { lat: vp.lat, lon: vp.lon, stationId: vp.stationId || '' };
    const st = world.getStationById(pointKey);
    if (st) return { lat: st.lat, lon: st.lon, stationId: st.id || pointKey };
    return null;
  }

  getVoiePointAt(x: number, y: number, voiePointManager: VoiePointManager) {
    const hitR = 'ontouchstart' in window ? 25 : 15;
    const worldPos = this.tileMap.screenToWorld(x, y, this.logicalWidth, this.logicalHeight);
    const edgePos = this.tileMap.screenToWorld(x + hitR, y, this.logicalWidth, this.logicalHeight);
    let radiusKm = 0.3;
    if (worldPos && edgePos) {
      const dLat = (edgePos.lat - worldPos.lat) * 111;
      const dLon = (edgePos.lon - worldPos.lon) * 111 * Math.cos(worldPos.lat * Math.PI / 180);
      radiusKm = Math.max(0.03, Math.hypot(dLat, dLon) * 1.2);
    }
    const candidates = voiePointManager?.getVoiePointsNear
      ? voiePointManager.getVoiePointsNear(worldPos.lat, worldPos.lon, radiusKm)
      : (voiePointManager?.getAll?.() || []);
    let best = null, bestD = hitR;
    for (const vp of candidates) {
      const p = this.latLonToScreen(vp.lat, vp.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = vp; }
    }
    return best;
  }

  _drawTempTrace(ctx: CanvasRenderingContext2D, waypoints: RendererRoutePoint[]) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const p0 = this.latLonToScreen(waypoints[0].lat, waypoints[0].lon);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < waypoints.length; i++) {
      const p = this.latLonToScreen(waypoints[i].lat, waypoints[i].lon);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Draw dots at each waypoint
    for (const wp of waypoints) {
      const p = this.latLonToScreen(wp.lat, wp.lon);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getReferenceStationAt(x: number, y: number, world: World) {
    if (!world?.getReferenceStationsInBounds || !world.referenceStations?.length) return null;
    const hitR = 'ontouchstart' in window ? 25 : 15;
    const p1 = this.tileMap.screenToWorld(x - hitR, y - hitR, this.logicalWidth, this.logicalHeight);
    const p2 = this.tileMap.screenToWorld(x + hitR, y + hitR, this.logicalWidth, this.logicalHeight);
    const south = Math.min(p1.lat, p2.lat), north = Math.max(p1.lat, p2.lat);
    const west = p1.lon, east = p2.lon;
    const candidates = world.getReferenceStationsInBounds(south, west, north, east);
    let best = null, bestD = hitR;
    for (const st of candidates) {
      if (world.isReferenceStationActivated?.(st.id)) continue;
      const p = this._stationToScreen(st);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = st; }
    }
    return best;
  }

  getStationAt(x: number, y: number, stationsOrWorld: Station[] | World) {
    const hitR = 'ontouchstart' in window ? 25 : 15;
    let stations = Array.isArray(stationsOrWorld) ? stationsOrWorld : (stationsOrWorld?.stations || []);
    // v1.1.14: mousemove hit-testing must not scan every native European station.
    if (!Array.isArray(stationsOrWorld) && stationsOrWorld?.getStationsInBounds) {
      const a = this.tileMap.screenToWorld(x - hitR, y - hitR, this.logicalWidth, this.logicalHeight);
      const b = this.tileMap.screenToWorld(x + hitR, y + hitR, this.logicalWidth, this.logicalHeight);
      stations = stationsOrWorld.getStationsInBounds(Math.min(a.lat, b.lat), Math.min(a.lon, b.lon), Math.max(a.lat, b.lat), Math.max(a.lon, b.lon));
    }
    let best = null, bestD = hitR;
    for (const st of stations) {
      const p = this._stationToScreen(st);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = st; }
    }
    return best;
  }

  // Hit-test an industry marker (uses the per-frame cached locations). Returns
  // the nearest industry loc within the hit radius, or null.
  getIndustryAt(x: __KPStruct194, y: number) {
    const locs = this._indLocs;
    if (!locs || locs.length === 0) return null;
    const hitR = 'ontouchstart' in window ? 22 : 12;
    let best = null, bestD = hitR;
    for (const loc of locs) {
      const p = this.latLonToScreen(loc.lat, loc.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = loc; }
    }
    return best;
  }
}


// S3_STRUCT_V2_TEMP
type __S3Struct178 = { "fillStyle": unknown; "fillRect": (...args: unknown[]) => unknown };
type __S3Struct191 = { "textAlign": unknown; "font": unknown; "save": (...args: unknown[]) => unknown; "translate": (...args: unknown[]) => unknown; "rotate": (...args: unknown[]) => unknown; "fillStyle": unknown; "fillRect": (...args: unknown[]) => unknown; "strokeStyle": unknown; "lineWidth": number; "strokeRect": (...args: unknown[]) => unknown; "restore": (...args: unknown[]) => unknown; "globalAlpha": unknown; "fillText": (...args: unknown[]) => unknown };
type __S3Struct192 = { "beginPath": (...args: unknown[]) => unknown; "arc": (...args: unknown[]) => unknown; "fillStyle": unknown; "fill": (...args: unknown[]) => unknown; "strokeStyle": unknown; "lineWidth": number; "stroke": (...args: unknown[]) => unknown; "fillRect": (...args: unknown[]) => unknown; "strokeRect": (...args: unknown[]) => unknown; "font": unknown; "textAlign": unknown; "fillText": (...args: unknown[]) => unknown };
type __S3Struct193 = { "beginPath": (...args: unknown[]) => unknown; "arc": (...args: unknown[]) => unknown; "fillStyle": unknown; "fill": (...args: unknown[]) => unknown; "strokeStyle": unknown; "lineWidth": number; "setLineDash": (...args: unknown[]) => unknown; "stroke": (...args: unknown[]) => unknown; "font": unknown; "textAlign": unknown; "fillText": (...args: unknown[]) => unknown };
type __S3Struct194 = { "category": string; "train": { "category": string }; "serviceType": string };
type __S3Struct198 = { "train": { "inMaintenance": number; "inDepot": number }; "rame": { "inMaintenance": unknown; "currentLocation": { "depotId": string } } };
type __S3Struct204 = { "x": number; "y": number };
type __S3Struct205 = { "x": number; "y": number };
type __S3Struct206 = { "x": number; "y": number };
type __S3Struct208 = { "id": string };
type __S3Struct209 = { "train": { "id": string } };
type __S3Struct210 = { "strokeStyle": unknown; "globalAlpha": unknown; "lineWidth": number; "lineJoin": unknown; "lineCap": unknown; "beginPath": (...args: unknown[]) => unknown; "lineTo": (...args: unknown[]) => unknown; "moveTo": (...args: unknown[]) => unknown; "stroke": (...args: unknown[]) => unknown; "save": (...args: unknown[]) => unknown; "restore": (...args: unknown[]) => unknown; "fillStyle": unknown; "arc": (...args: unknown[]) => unknown; "fill": (...args: unknown[]) => unknown };
type __S3Struct229 = { "strokeStyle": unknown; "lineWidth": number; "beginPath": (...args: unknown[]) => unknown; "moveTo": (...args: unknown[]) => unknown; "lineTo": (...args: unknown[]) => unknown; "stroke": (...args: unknown[]) => unknown; "arc": (...args: unknown[]) => unknown; "fillStyle": unknown; "fill": (...args: unknown[]) => unknown; "font": unknown; "textAlign": unknown; "textBaseline": unknown; "fillText": (...args: unknown[]) => unknown };
type __S3Struct233 = { "strokeStyle": unknown; "lineWidth": number; "setLineDash": (...args: unknown[]) => unknown; "beginPath": (...args: unknown[]) => unknown; "moveTo": (...args: unknown[]) => unknown; "lineTo": (...args: unknown[]) => unknown; "stroke": (...args: unknown[]) => unknown; "fillStyle": unknown; "arc": (...args: unknown[]) => unknown; "fill": (...args: unknown[]) => unknown };
