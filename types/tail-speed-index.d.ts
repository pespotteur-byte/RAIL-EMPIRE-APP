/** Compact exact-minimum index for the infrastructure occupied by a consist.
 * Geometry is immutable within a leg. Blocks reduce repeated scans of dense
 * OSM vertices; no vertex, speed restriction or part of the train is discarded.
 * Rounding-sensitive tail boundaries fall back to the original arithmetic.
 */
export declare class TailSpeedIndex {
    private readonly distances;
    private readonly speeds;
    private readonly blockDistance;
    private readonly blockMinimum;
    private static readonly SIZE;
    private static readonly EPS_KM;
    constructor(distances: Float64Array, speeds: readonly number[]);
    get bytes(): number;
    minimum(segIndex: number, progress: number, lengthM: number): number;
    private scan;
}
export type PassageTailSpeedHold = {
    endTravelKm: number;
    limitKmh: number;
};
/** Rebuild a monotone expiry/minimum queue from optional legacy snapshot data. */
export declare function normalizePassageTailSpeedHolds(value: unknown): PassageTailSpeedHold[];
