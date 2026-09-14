/** Linear referencing of clicked OSM anchors on an existing, ordered railway leg.
 * Temporary editing index: no persistent copy of continental geometry, and no
 * change to routing/physics. A waypoint's order is distance ALONG the railway,
 * never its proximity to the end stations.
 */
export interface RailAnchor {
    lat?: unknown;
    lon?: unknown;
    snapLat?: unknown;
    snapLon?: unknown;
    wayId?: unknown;
    segmentIndex?: unknown;
}
export interface RouteProjection {
    alongKm: number;
    offsetKm: number;
    segment: number;
    fraction: number;
    ambiguous: boolean;
}
/** Zero is a coordinate. A missing/invalid snap falls back to the original axis. */
export declare function railAnchorPosition(anchor: RailAnchor | null | undefined): {
    lat: number;
    lon: number;
} | null;
export declare class RailRouteMeasure {
    private readonly route;
    readonly cumulativeKm: Float64Array;
    private readonly byWay;
    private valid;
    constructor(route: readonly RailAnchor[]);
    project(anchor: RailAnchor, minimumAlongKm?: number): RouteProjection | null;
}
/** Return one partition, preserving the original VIA sequence on loops. null
 * means absent/ambiguous old geometry: the editor must use its explicit fallback.
 */
export declare function constraintSplitOnRailway(route: readonly RailAnchor[], constraints: readonly RailAnchor[], inserted: RailAnchor): number | null;
