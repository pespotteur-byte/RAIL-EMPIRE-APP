import { RouteSegmentSnapshot } from './schedule-v2-model.js';
type RoutingOptions = Record<string, unknown>;
interface AnchorLike {
    lat?: unknown;
    lon?: unknown;
    snapLat?: unknown;
    snapLon?: unknown;
    wayId?: unknown;
    segmentIndex?: unknown;
    osmSnapshot?: {
        segmentIndex?: unknown;
        [key: string]: unknown;
    } | null;
}
export interface RoutePointLike {
    [key: string]: unknown;
    lat?: unknown;
    lon?: unknown;
    wayId?: unknown;
    segmentIndex?: unknown;
    maxSpeed?: unknown;
    maxSpeedSource?: string | null;
    maxSpeedForward?: unknown;
    maxSpeedBackward?: unknown;
    electrified?: unknown;
    electrifiedMode?: string | null;
    voltage?: unknown;
    frequency?: unknown;
    gauge?: unknown;
    loadingGauge?: string | null;
    axleLoad?: unknown;
    metreLoad?: unknown;
    tracks?: unknown;
    trafficMode?: string | null;
    usage?: string | null;
    service?: string | null;
    railway?: string | null;
    railwayLifecycle?: string | null;
    railwayBaseType?: string | null;
    preferredDirection?: string | null;
    bidirectional?: string | null;
    oneway?: string | null;
    signalRestrictedDirection?: unknown;
    travelDirection?: string | null;
    _againstPreferredDirection?: unknown;
    trackRef?: string | null;
    name?: string | null;
    ref?: string | null;
    trainProtection?: Record<string, unknown> | null;
    fallback?: unknown;
    tags?: {
        incline?: unknown;
        [key: string]: unknown;
    } | null;
    pickerSource?: string | null;
}
interface CompactRoutePoint extends RoutePointLike {
    lat: number;
    lon: number;
    wayId: string;
    segmentIndex: number | null;
    maxSpeed: unknown;
    maxSpeedSource: string;
    maxSpeedForward: unknown;
    maxSpeedBackward: unknown;
    electrified: unknown;
    electrifiedMode: string;
    voltage: unknown[];
    frequency: unknown[];
    gauge: unknown[];
    loadingGauge: string;
    axleLoad: unknown;
    metreLoad: unknown;
    tracks: unknown;
    trafficMode: string;
    usage: string;
    service: string;
    railway: string;
    railwayLifecycle: string;
    railwayBaseType: string;
    preferredDirection: string;
    bidirectional: string;
    oneway: string;
    signalRestrictedDirection: boolean;
    travelDirection: string;
    _againstPreferredDirection: boolean;
    trackRef: string;
    name: string;
    ref: string;
    trainProtection: Record<string, unknown>;
    fallback: boolean;
    tags?: {
        incline?: unknown;
    };
}
interface AnchorCoords {
    lat: number;
    lon: number;
    wayId: string;
    segmentIndex: number | null;
    osmSnapshot: AnchorLike['osmSnapshot'];
}
export type RouteArray = RoutePointLike[] & {
    _longRangeWindowed?: boolean;
};
interface RailGraphPackLike {
    ready?: () => Promise<unknown> | unknown;
    prepared?: unknown;
}
interface RoutingFailureLike {
    requiredBytes?: unknown;
    budgetBytes?: unknown;
}
interface ORMRouterLike {
    getTrackCandidates(lat: number, lon: number, options: RoutingOptions): Promise<RoutePointLike[] | null | undefined>;
    _railGraphPack?: RailGraphPackLike;
    _lastCursorRouteFailure?: unknown;
    _lastRoutingFailure?: RoutingFailureLike;
    findRouteViaLocalRailGraphAnchors?: (anchors: AnchorCoords[], options: RoutingOptions) => Promise<RouteArray | null | undefined>;
    findRouteViaCursorAnchors?: (anchors: AnchorCoords[], options: RoutingOptions) => Promise<RouteArray | null | undefined>;
    prepareAndRouteScheduleAnchors?: (anchors: AnchorCoords[], options: RoutingOptions) => Promise<RouteArray | null | undefined>;
    isFallbackRoute(route: RouteArray): boolean;
    releaseScheduleRoutingMemory?: (options: RoutingOptions) => unknown;
}
export declare class ScheduleV2Router {
    readonly orm: ORMRouterLike;
    constructor(orm: ORMRouterLike);
    chooseTrackCandidatesAtCursor(lat: number, lon: number, options?: RoutingOptions): Promise<RoutePointLike[]>;
    chooseTrackCandidates(lat: number, lon: number, options?: RoutingOptions): Promise<RoutePointLike[]>;
    routeBetweenBindings(fromTrack: AnchorLike, toTrack: AnchorLike, constraints?: AnchorLike[], opts?: RoutingOptions): Promise<RouteArray>;
    snapshotRoute(route: RouteArray): {
        routePoints: CompactRoutePoint[];
        segments: RouteSegmentSnapshot[];
        distanceKm: number;
    };
}
export {};
