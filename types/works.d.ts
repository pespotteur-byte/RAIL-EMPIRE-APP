import type { World } from './world.js';
type WorkInput = {
    id?: unknown;
    name?: unknown;
    label?: unknown;
    impact?: unknown;
    speedLimit?: unknown;
    direction?: unknown;
    manual?: unknown;
    scope?: unknown;
    affectsTraffic?: unknown;
    stationId?: unknown;
    stationName?: unknown;
    station?: unknown;
    stationImpact?: unknown;
    stationSpeedLimit?: unknown;
    recurrence?: unknown;
    daysOfWeek?: unknown;
    zones?: unknown;
    manualRoute?: unknown;
    startDate?: unknown;
    startTime?: unknown;
    endDate?: unknown;
    endTime?: unknown;
    startBinding?: unknown;
    endBinding?: unknown;
    constraints?: unknown[];
    route?: unknown;
    segments?: unknown[];
    distanceKm?: unknown;
    startStation?: {
        name?: unknown;
    } | null;
    endStation?: {
        name?: unknown;
    } | null;
    stationA?: unknown;
    stationB?: unknown;
    trackId?: unknown;
};
declare function cleanRoute(route: unknown): {
    wayId: unknown;
    lat: number;
    lon: number;
}[];
declare function normalizeZone(data?: WorkInput, inherited?: WorkInput): {
    id: string;
    name: string;
    startBinding: Record<string, unknown> | null;
    endBinding: Record<string, unknown> | null;
    constraints: any;
    route: {
        wayId: unknown;
        lat: number;
        lon: number;
    }[];
    segments: any;
    distanceKm: number;
    impact: string;
    speedLimit: number;
    direction: import("./rail-section-geometry.js").RailSectionDirection;
    manual: boolean;
    startStation: any;
    endStation: any;
    stationA: string;
    stationB: string;
    trackId: string;
};
type NormalizedZone = ReturnType<typeof normalizeZone>;
type CleanRoute = ReturnType<typeof cleanRoute>;
export declare class PlannedWorks {
    id: string;
    name: string;
    trackId: string;
    scope: 'station' | 'sections';
    stationA: string;
    stationB: string;
    stationId: string;
    stationName: string;
    station: {
        name?: unknown;
        lat?: unknown;
        lon?: unknown;
    } | null;
    affectsTraffic: boolean;
    route: CleanRoute | null;
    manualRoute: CleanRoute | null;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    impact: string;
    stationImpact: string;
    speedLimit: number;
    stationSpeedLimit: number;
    recurrence: string;
    daysOfWeek: number[];
    zones: NormalizedZone[];
    active: boolean;
    constructor(input?: unknown);
    _dayOfWeek(dateStr: unknown): number;
    isActiveAt(dateStr: unknown, timeOfDay: unknown): boolean;
    getDateRange(): string;
}
export declare class WorksManager {
    works: PlannedWorks[];
    revision: number;
    _appliedWorksSignature: string;
    constructor();
    add(data: unknown): PlannedWorks;
    remove(id: unknown): void;
    getAll(): PlannedWorks[];
    _legacyZone(w: PlannedWorks): {
        id: string;
        name: string;
        startBinding: Record<string, unknown> | null;
        endBinding: Record<string, unknown> | null;
        constraints: any;
        route: {
            wayId: unknown;
            lat: number;
            lon: number;
        }[];
        segments: any;
        distanceKm: number;
        impact: string;
        speedLimit: number;
        direction: import("./rail-section-geometry.js").RailSectionDirection;
        manual: boolean;
        startStation: any;
        endStation: any;
        stationA: string;
        stationB: string;
        trackId: string;
    };
    getZones(work: PlannedWorks): {
        id: string;
        name: string;
        startBinding: Record<string, unknown> | null;
        endBinding: Record<string, unknown> | null;
        constraints: any;
        route: {
            wayId: unknown;
            lat: number;
            lon: number;
        }[];
        segments: any;
        distanceKm: number;
        impact: string;
        speedLimit: number;
        direction: import("./rail-section-geometry.js").RailSectionDirection;
        manual: boolean;
        startStation: any;
        endStation: any;
        stationA: string;
        stationB: string;
        trackId: string;
    }[];
    getActiveDisplayItems(dateStr: unknown, timeOfDay: unknown): ({
        workId: string;
        workName: string;
        zoneId: string;
        scope: string;
        stationOnly: boolean;
        stationId: string;
        stationName: {};
        station: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        stationLat: number | null;
        stationLon: number | null;
        affectsTraffic: boolean;
        impact: string;
        speedLimit: number | null;
        direction: string;
        route: never[];
        segments: never[];
        startBinding: null;
        endBinding: null;
        startStation: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        endStation: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        stationA: string;
        stationB: string;
        trackId: string;
        manual: boolean;
        sourceWork: PlannedWorks;
        sourceZone: null;
    } | {
        workId: string;
        workName: string;
        zoneId: string;
        scope: string;
        stationOnly: boolean;
        stationId: string;
        stationName: string;
        station: null;
        stationLat: null;
        stationLon: null;
        affectsTraffic: boolean;
        impact: string;
        speedLimit: number | null;
        direction: import("./rail-section-geometry.js").RailSectionDirection;
        route: {
            wayId: unknown;
            lat: number;
            lon: number;
        }[];
        segments: any;
        startBinding: Record<string, unknown> | null;
        endBinding: Record<string, unknown> | null;
        startStation: any;
        endStation: any;
        stationA: any;
        stationB: any;
        trackId: string;
        manual: boolean;
        sourceWork: PlannedWorks;
        sourceZone: {
            id: string;
            name: string;
            startBinding: Record<string, unknown> | null;
            endBinding: Record<string, unknown> | null;
            constraints: any;
            route: {
                wayId: unknown;
                lat: number;
                lon: number;
            }[];
            segments: any;
            distanceKm: number;
            impact: string;
            speedLimit: number;
            direction: import("./rail-section-geometry.js").RailSectionDirection;
            manual: boolean;
            startStation: any;
            endStation: any;
            stationA: string;
            stationB: string;
            trackId: string;
        };
    })[];
    getActiveRestrictions(dateStr: unknown, timeOfDay: unknown): ({
        workId: string;
        workName: string;
        zoneId: string;
        scope: string;
        stationOnly: boolean;
        stationId: string;
        stationName: {};
        station: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        stationLat: number | null;
        stationLon: number | null;
        affectsTraffic: boolean;
        impact: string;
        speedLimit: number | null;
        direction: string;
        route: never[];
        segments: never[];
        startBinding: null;
        endBinding: null;
        startStation: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        endStation: {
            name?: unknown;
            lat?: unknown;
            lon?: unknown;
        } | null;
        stationA: string;
        stationB: string;
        trackId: string;
        manual: boolean;
        sourceWork: PlannedWorks;
        sourceZone: null;
    } | {
        workId: string;
        workName: string;
        zoneId: string;
        scope: string;
        stationOnly: boolean;
        stationId: string;
        stationName: string;
        station: null;
        stationLat: null;
        stationLon: null;
        affectsTraffic: boolean;
        impact: string;
        speedLimit: number | null;
        direction: import("./rail-section-geometry.js").RailSectionDirection;
        route: {
            wayId: unknown;
            lat: number;
            lon: number;
        }[];
        segments: any;
        startBinding: Record<string, unknown> | null;
        endBinding: Record<string, unknown> | null;
        startStation: any;
        endStation: any;
        stationA: any;
        stationB: any;
        trackId: string;
        manual: boolean;
        sourceWork: PlannedWorks;
        sourceZone: {
            id: string;
            name: string;
            startBinding: Record<string, unknown> | null;
            endBinding: Record<string, unknown> | null;
            constraints: any;
            route: {
                wayId: unknown;
                lat: number;
                lon: number;
            }[];
            segments: any;
            distanceKm: number;
            impact: string;
            speedLimit: number;
            direction: import("./rail-section-geometry.js").RailSectionDirection;
            manual: boolean;
            startStation: any;
            endStation: any;
            stationA: string;
            stationB: string;
            trackId: string;
        };
    })[];
    getActiveClosuresBetween(stationA: unknown, stationB: unknown, dateStr: unknown, timeOfDay: unknown): PlannedWorks[];
    getActive(dateStr: unknown, timeOfDay: unknown): PlannedWorks[];
    _routeBBox(route: Array<{
        lat: number;
        lon: number;
    }> | null | undefined): {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null;
    _bboxNear(a: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null, b: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null, bufferDeg?: number): boolean;
    _minDistToPolyline(lat: number, lon: number, polyline: Array<{
        lat: number;
        lon: number;
    }> | null | undefined): number;
    _routeIntersectsPolyline(a: Array<{
        lat: number;
        lon: number;
    }> | null | undefined, b: Array<{
        lat: number;
        lon: number;
    }> | null | undefined, bufferKm?: number): boolean;
    _applyRestrictionToTrack(track: {
        worksActive?: boolean;
        worksImpact?: string | null;
        worksSpeedLimit?: number | null;
    }, r: {
        impact?: string;
        speedLimit?: number | null;
    }): void;
    update(dateStr: string, timeOfDay: unknown, world: World): boolean;
    _pointToSegmentDistKm(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number): number;
    toSave(): {
        id: unknown;
        name: unknown;
        trackId: unknown;
        scope: unknown;
        affectsTraffic: unknown;
        stationId: unknown;
        stationName: unknown;
        station: any;
        stationA: unknown;
        stationB: unknown;
        route: unknown;
        manualRoute: unknown;
        zones: any;
        startDate: unknown;
        startTime: unknown;
        endDate: unknown;
        endTime: unknown;
        impact: unknown;
        speedLimit: unknown;
        stationImpact: unknown;
        stationSpeedLimit: unknown;
        recurrence: unknown;
        daysOfWeek: unknown;
    }[];
    loadFromSave(arr: unknown): void;
}
export {};
