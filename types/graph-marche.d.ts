import type { ActiveService } from './schedule-creator.js';
import type { ScheduleV2Manager } from './schedule-v2-model.js';
/**
 * Graphique de Marche — JT TRAN GRAPH reproduction.
 * Time-distance diagram with stations on the horizontal axis and
 * time (00:00 -> 24:00) on the vertical axis, like the JTrainGraph schema.
 */
type GraphStationStop = {
    stationId: string;
    name?: string;
    [key: string]: unknown;
};
type StationSearchRow = {
    id: string;
    name: string;
    norm: string;
    country: string;
};
type GraphPad = {
    top: number;
    right?: number;
    bottom?: number;
    left?: number;
};
type TimeRange = {
    start: number;
    end: number;
};
type LineSegment = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
type RouteDistancePoint = {
    lat: number;
    lon: number;
    dist: number;
};
type LegendItem = {
    name: string;
    color: string;
};
type GraphWorldStation = {
    id?: unknown;
    name?: string;
    country?: string;
    lat: number;
    lon: number;
    [key: string]: unknown;
};
type GraphGame = {
    _currentDate?: string;
    engine?: {
        currentDate?: string;
        getParisDate?: () => string;
    };
    scheduleCreator: {
        getActiveServices: () => ActiveService[];
        services?: ActiveService[];
    };
    scheduleV2?: ScheduleV2Manager;
    world: {
        stations?: GraphWorldStation[];
        getStationById: (id: unknown) => GraphWorldStation | null | undefined;
    };
    saveState?: (...args: unknown[]) => unknown;
};
type GraphLiveRecord = {
    serviceId: string;
    time: number;
    date?: string;
    lat?: number | null;
    lon?: number | null;
    [key: string]: unknown;
};
type GraphSave = {
    records?: unknown;
    colorMap?: unknown;
    colorIdx?: unknown;
    stationAId?: unknown;
    stationBId?: unknown;
    mode?: unknown;
};
type GraphRoutePoint = {
    lat: number;
    lon: number;
    [key: string]: unknown;
};
type GraphStopLike = GraphStationStop & {
    arrivalTime?: unknown;
    departureTime?: unknown;
    type?: unknown;
    platform?: unknown;
    stopCode?: unknown;
};
type GraphServiceLike = {
    id: string;
    name: string;
    number?: string;
    active?: unknown;
    train?: Record<string, unknown> | null;
    position?: {
        lat?: unknown;
        lon?: unknown;
    } | null;
    currentStopIndex?: number;
    state?: unknown;
    stops?: GraphStopLike[];
    routes?: GraphRoutePoint[][];
    _returnRoutes?: GraphRoutePoint[][];
    isReturnLeg?: unknown;
    serviceType?: unknown;
    isWorkTrain?: unknown;
    _v2OccurrenceId?: unknown;
    getCurrentStops?: () => GraphStopLike[];
    [key: string]: unknown;
};
export declare class GraphMarche {
    records: GraphLiveRecord[];
    maxRecords: number;
    _lastRecordTime: number;
    _lastRecordKey: string;
    _colorMap: Record<string, string>;
    _colorIdx: number;
    _colors: string[];
    stationAId: string | null;
    stationBId: string | null;
    mode: string;
    viewZoom: number;
    viewPanX: number;
    viewPanY: number;
    _viewMinZoom: number;
    _viewMaxZoom: number;
    constructor();
    /** Record live train positions each minute */
    record(game: GraphGame, timeOfDay: number): void;
    _v2GraphServices(game: GraphGame): GraphServiceLike[];
    _graphServices(game: GraphGame, mode?: unknown): GraphServiceLike[];
    /** Get all stations referenced by the theoretical timetable. */
    _getServiceStations(game: GraphGame): GraphWorldStation[];
    /** Find services that pass through both station A and B. */
    _findServicesThrough(game: GraphGame, stAId: unknown, stBId: unknown): {
        svc: GraphServiceLike;
        stops: GraphStopLike[];
        idxA: number;
        idxB: number;
        direction: number;
    }[];
    /** Build ordered station list between A and B from a service's stops */
    _getStationsBetween(stops: unknown, idxA: number, idxB: number): any[];
    _routeForLeg(svc: GraphServiceLike, legIdx: number): GraphRoutePoint[] | null;
    _wrappedSegments(x1: number, t1: unknown, x2: number, t2: unknown): {
        x1: number;
        t1: number;
        x2: number;
        t2: number;
    }[];
    /** Calculate cumulative distances between stations using the real ORM route.
     * Falls back to straight-line haversine only if no route is available. */
    _calcDistances(stationStops: GraphStationStop[], game: GraphGame, refSvc: GraphServiceLike | null, routeStartIndex?: number): number[];
    _haversine(lat1: number, lon1: number, lat2: number, lon2: number): number;
    _normalizeStationSearch(value: unknown): string;
    _stationSearchIndex(game: GraphGame, extraStations?: unknown): {
        id: string;
        name: string;
        norm: string;
        country: string;
    }[];
    _stationSearchMatches(index: StationSearchRow[], query: unknown, preferredIds?: Set<string>, limit?: number): StationSearchRow[];
    _stationSearchControlHtml(side: unknown, label: unknown, selectedName?: unknown): string;
    _escapeHtml(value: unknown): string;
    _bindStationSearch(container: HTMLElement, game: GraphGame, side: 'a' | 'b', index: StationSearchRow[], preferredIds: Set<string>): void;
    render(container: HTMLElement, game: GraphGame): void;
    _clampGraphView(W: number, H: number): void;
    _setGraphZoom(game: GraphGame, nextZoom: number, focalX?: number | null, focalY?: number | null): void;
    _panGraph(game: GraphGame, dx: unknown, dy: unknown): void;
    _timeStepForZoom(zoom?: unknown): 1 | 5 | 10 | 30;
    _visibleTimeRange(H: number, pad: GraphPad, chartH: number): {
        start: number;
        end: number;
    };
    _clipLineToViewport(x1: number, y1: number, x2: number, y2: number, minX: number, minY: number, maxX: number, maxY: number): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    } | null;
    _bestVisibleTrainLabelSegment(points: LineSegment[], W: number, H: number): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    } | null;
    _drawScreenTimeScale(ctx: CanvasRenderingContext2D, W: number, H: number, pad: GraphPad, chartH: number, step: number, range: TimeRange): void;
    _updateGraphZoomLabel(): void;
    _bindGraphViewport(game: GraphGame): void;
    _fitCanvas(canvas: HTMLCanvasElement): {
        ctx: CanvasRenderingContext2D;
        W: number;
        H: number;
        dpr: number;
    };
    _draw(game: GraphGame): void;
    _serviceDisplayName(svc: Pick<GraphServiceLike, 'name' | 'number' | 'train'>): string;
    /** Draw the train name parallel to the currently visible black timetable trace. */
    _drawTrainLabel(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, label: string): void;
    _centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void;
    _styleForService(svc: Pick<GraphServiceLike, 'serviceType' | 'isWorkTrain'>, ctx: CanvasRenderingContext2D): void;
    _interpolateDist(lat: number, lon: number, routeCoords: RouteDistancePoint[]): number | null;
    _getSvcColor(id: string): string;
    _drawLegend(items: LegendItem[]): void;
    toSave(): {
        records: GraphLiveRecord[];
        colorMap: Record<string, string>;
        colorIdx: number;
        stationAId: string | null;
        stationBId: string | null;
        mode: string;
    };
    loadFromSave(s: GraphSave): void;
}
export {};
