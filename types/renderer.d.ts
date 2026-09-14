type __KPStruct143 = {
    lat: unknown;
    lon: unknown;
    _reMercLat?: unknown;
    _reMercLon?: unknown;
    _reMercX?: number;
    _reMercY?: number;
};
type __KPStruct194 = number;
import { TileMap } from './map.js';
import { TerrainRelief3D } from './terrain3d.js';
import type { World, Station } from './world.js';
import type { DepotManager } from './depot.js';
import type { LineManager, PlatformManager } from './line.js';
import type { VoiePointManager } from './voie-points.js';
type RendererPoint = {
    x: number;
    y: number;
    depth?: number;
};
type RendererRoutePoint = {
    lat: number;
    lon: number;
    wayId?: string | number;
    way_id?: string | number;
};
type RendererTrain = Record<string, unknown> & {
    id?: string | number;
    category?: string;
    geoHeading?: number;
    heading?: number;
    inMaintenance?: boolean;
    inDepot?: boolean;
    stoppedAt?: unknown;
    breakdown?: unknown;
    blockedBy?: unknown;
    speed?: number;
    delay?: number;
    color?: string;
    seriesName?: string;
    _stoppedSinceGameTime?: number;
};
type RendererRame = Record<string, unknown> & {
    inMaintenance?: boolean;
    currentLocation?: {
        depotId?: string;
    } | null;
    elementDetails?: Array<{
        imageData?: string;
    }>;
};
type RendererService = Record<string, unknown> & {
    id: string | number;
    name: string;
    category?: string;
    serviceType?: string;
    train?: RendererTrain;
    rame?: RendererRame | null;
    position?: {
        lat: number;
        lon: number;
    } | null;
    state?: string;
    active?: boolean;
    completed?: boolean;
    cancelled?: boolean;
    isRescue?: boolean;
    routes?: unknown[];
    roundTrip?: boolean;
    _returnRoutes?: unknown[];
    stops?: unknown[];
    returnStops?: unknown[];
    _returnStopsData?: unknown[];
    getTargetStation?: () => {
        lat: number;
        lon: number;
    } | null;
    _state?: {
        cachedRoute?: RendererRoutePoint[];
        index?: number;
    };
    _cantonAssignments?: Array<{
        endIndex: number;
        cantonId: string | number;
    }>;
};
type RendererEngine = {
    getParisDate?: () => string;
    getParisTime?: () => {
        hours?: number;
        minutes?: number;
        seconds?: number;
    };
};
type RendererWorkItem = Record<string, unknown> & {
    stationOnly?: boolean;
    route?: RendererRoutePoint[];
    stationId?: string | number;
    stationA?: string | number;
    stationB?: string | number;
    station?: {
        lat: number;
        lon: number;
    } | null;
    stationLat?: number;
    stationLon?: number;
};
export declare const LIVEMAP_CATEGORY_COLORS: Record<string, string>;
export declare function compute3DPlaneGeometry(viewWidth: unknown, viewHeight: unknown, zoomLevel?: unknown): {
    viewW: number;
    viewH: number;
    zoom: number;
    pitchDeg: number;
    perspectivePx: number;
    yComp: number;
    planeScale: number;
    overscan: number;
    width: number;
    height: number;
    left: number;
    top: number;
};
type RendererToggleElements = Partial<Record<'stations' | 'names' | 'trains' | 'voie' | 'orm' | 'basic' | 'satellite' | 'night' | 'weather' | 'industries' | 'zones', HTMLInputElement>>;
type RendererHeadingState = {
    angle: number;
    time: number;
    seen: number;
};
type RendererWorkHitZone = {
    item: RendererWorkItem;
    points: RendererPoint[];
    hitWidth: number;
};
type RendererMarkerNode = {
    root: HTMLDivElement;
    title: HTMLSpanElement;
    sub: HTMLElement;
};
type RendererMiniCache = {
    data: ImageData;
    x: number;
    y: number;
};
type RendererIndustryLocation = {
    lat: number;
    lon: number;
    color?: string;
    name: string;
    industryName: string;
};
export declare class Renderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tileMap: TileMap;
    private mapSourcePanel;
    private _routeDrawingCache;
    terrain3D: TerrainRelief3D;
    hoveredStation: Station | null;
    logicalWidth: number;
    logicalHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    _minimapCache: RendererMiniCache | null;
    _lastMinimapDraw: number;
    _minimapInterval: number;
    _staticCanvas: HTMLCanvasElement | null;
    _staticCtx: CanvasRenderingContext2D | null;
    _staticValid: boolean;
    _lastStaticZoom: number;
    _lastStaticCLat: number;
    _lastStaticCLon: number;
    _staticKey: string;
    _needsRender: boolean;
    _voieLayerCanvas: HTMLCanvasElement | null;
    _voieLayerCtx: CanvasRenderingContext2D | null;
    _voieLayerKey: string;
    _trainHeadingVisual: Map<string, RendererHeadingState>;
    _lastTrainHeadingSweep: number;
    _operationalIconCache: Map<string, HTMLImageElement>;
    _livemapWorkHitZones: RendererWorkHitZone[];
    _toggleEls: RendererToggleElements;
    _perfToggleListenersBound?: boolean;
    _livemapAttributionEl?: HTMLElement | null;
    _re3dMarkerNodes?: Map<string, RendererMarkerNode>;
    _trainImageCache?: Map<string | number, HTMLImageElement | null>;
    _frameTick?: number;
    _indLocs?: RendererIndustryLocation[];
    _indLocsTick?: number;
    constructor(canvas: HTMLElement);
    invalidateStatic(): void;
    get needsRender(): boolean;
    requestRender(): void;
    resize(): void;
    is3DPlanePanSafe(panX?: unknown, panY?: unknown, cameraHeadingRad?: unknown, marginPx?: unknown): boolean;
    render(world: World, services: RendererService[], engine: RendererEngine | null | undefined, depotManager: DepotManager, lineManager: LineManager, platformManager: PlatformManager, voiePointManager: VoiePointManager): void;
    _drawStaticOverlay(ctx: CanvasRenderingContext2D, world: World, depotManager: DepotManager, lineManager: LineManager, platformManager: PlatformManager, voiePointManager: VoiePointManager, flags?: Record<string, unknown>): void;
    drawStationPlatformOccupancy(ctx: CanvasRenderingContext2D, world: World, platformManager: PlatformManager): void;
    _drawCloudOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, alphaScale?: number): void;
    _stationToScreen(st: __KPStruct143): {
        x: number;
        y: number;
    };
    latLonToScreen(lat: unknown, lon: unknown): {
        x: number;
        y: number;
    };
    drawTracks(ctx: CanvasRenderingContext2D, world: World, lineManager: LineManager): void;
    drawReferenceStations(ctx: CanvasRenderingContext2D, world: World, showNames?: unknown): void;
    drawStations(ctx: CanvasRenderingContext2D, world: World, platformManager: PlatformManager, showNames?: unknown, includePlatformOccupancy?: unknown): void;
    drawDepots(ctx: CanvasRenderingContext2D, world: World, depotManager: DepotManager): void;
    drawIndustries(ctx: CanvasRenderingContext2D): void;
    drawSignalBoxes(ctx: CanvasRenderingContext2D): void;
    drawRegulationZones(ctx: CanvasRenderingContext2D): void;
    _livemapCategoryForService(svc: RendererService): string;
    _livemapMarkerRadius(zoom: number, compact?: unknown): 6 | 5 | 4.5 | 7 | 4 | 3.5;
    _ormTrainGeoHeading(svc: RendererService): number;
    _ormTrainHeading(svc: RendererService, projector?: unknown): number;
    _smoothTrainHeading(svc: {
        id: unknown;
    }, target: number, nowMs: number, namespace?: string): number;
    _sweepTrainHeadingCache(nowMs: number, liveCount: number): void;
    drawServices(ctx: CanvasRenderingContext2D, world: World, services: RendererService[]): void;
    sync3DMarkers(services: RendererService[]): void;
    clear3DMarkers(): void;
    _operationalIcon(src: string): HTMLImageElement | null | undefined;
    _operationalIconSize(zoom: unknown): number;
    _operationalStationIconSize(zoom: unknown): number;
    _drawOperationalIcon(ctx: CanvasRenderingContext2D, src: unknown, lat: unknown, lon: unknown, opts?: Record<string, unknown>): void;
    _eventMidpoint(route: unknown, world: World, stationA: unknown, stationB: unknown): {
        lat: number;
        lon: number;
    } | null;
    _activeWorksDisplayItems(engine: RendererEngine | null | undefined): RendererWorkItem[];
    drawActiveWorksZones(ctx: CanvasRenderingContext2D, world: World, engine: RendererEngine | null | undefined): void;
    getActiveWorkZoneAt(x: unknown, y: unknown): RendererWorkItem | null;
    drawOperationalEventIcons(ctx: CanvasRenderingContext2D, world: World, services: RendererService[], engine: RendererEngine | null | undefined): void;
    drawSelectedServiceRoute(ctx: CanvasRenderingContext2D, world: World): void;
    _appendTrainIconPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, heading: number): void;
    _drawTrainIcon(ctx: CanvasRenderingContext2D, p: RendererPoint, cat: unknown, color: string | CanvasGradient | CanvasPattern, r: number, state: unknown, heading?: unknown): void;
    drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: unknown, world: World, services: RendererService[]): void;
    _getTrainImage(svc: RendererService): HTMLImageElement | null | undefined;
    drawVoieLayerCached(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World): void;
    _visibleGeoBounds(margin?: number): {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null;
    drawOccupiedVoieOverlay(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World): void;
    drawVoiePoints(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, staticBase?: unknown): void;
    drawVoieTroncons(ctx: CanvasRenderingContext2D, voiePointManager: VoiePointManager, world: World, staticBase?: unknown): void;
    _drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string | CanvasGradient | CanvasPattern): void;
    /**
     * Draw signal lights at canton boundaries for active services.
     * Green = clear, Yellow = approach (next canton occupied), Red = stop.
     */
    drawSignals(ctx: CanvasRenderingContext2D, services: RendererService[]): void;
    _getTronconEndpoint(pointId: unknown, voiePointManager: VoiePointManager, world: World): {
        lat: number;
        lon: number;
        stationId: string;
    } | null;
    getVoiePointAt(x: number, y: number, voiePointManager: VoiePointManager): import("./voie-points.js").VoiePoint | null;
    _drawTempTrace(ctx: CanvasRenderingContext2D, waypoints: RendererRoutePoint[]): void;
    getReferenceStationAt(x: number, y: number, world: World): ({
        id?: string;
        name?: string;
        lat?: number;
        lon?: number;
        country?: string;
        uicRef?: string;
        ref?: string;
        operator?: string;
        network?: string;
        wikidata?: string;
        wheelchair?: string;
        osmType?: string;
        osmId?: string;
        type?: string;
        platforms?: number;
        facilities?: string[];
        source?: string;
        siteKind?: string;
        cargoTags?: string[];
        official?: boolean;
    } & {
        id: string;
        lat: number;
        lon: number;
        type?: string;
        _count?: number;
        _playableView?: Station;
        _reMercLat?: number;
        _reMercLon?: number;
        _reMercX?: number;
        _reMercY?: number;
    }) | null;
    getStationAt(x: number, y: number, stationsOrWorld: Station[] | World): Station | null;
    getIndustryAt(x: __KPStruct194, y: number): RendererIndustryLocation | null;
}
export {};
