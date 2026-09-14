export interface DrawingGeoPoint {
    lat: number;
    lon: number;
}
export interface DrawingPoint {
    x: number;
    y: number;
}
export interface DrawingBounds {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}
/** Bounded, display-only cache. Exact coordinate comparison detects in-place edits;
 * no route vertex or physical constraint is ever removed from game data. */
export declare class RouteDrawingCache {
    private readonly maxPoints;
    private readonly maxEntries;
    private entries;
    private points;
    constructor(maxPoints?: number, maxEntries?: number);
    clear(): void;
    get retainedPoints(): number;
    private unchanged;
    project(route: readonly DrawingGeoPoint[], bounds: DrawingBounds, viewKey: string, project: (p: DrawingGeoPoint) => DrawingPoint): DrawingPoint[][];
}
