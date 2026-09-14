/** One infrastructure-speed policy for timetable physics, runtime and cantons.
 * Unknown mainline data uses 160 km/h (then the train cap); unknown service tracks
 * use 30. Local inheritance is bounded to 1 km on the SAME contiguous OSM way.
 * No inferred point ever becomes evidence for another inference.
 */
export interface RailSpeedPoint {
    lat?: unknown;
    lon?: unknown;
    wayId?: unknown;
    maxSpeed?: unknown;
    maxSpeedSource?: unknown;
    maxSpeedForward?: unknown;
    maxSpeedBackward?: unknown;
    travelDirection?: unknown;
    service?: unknown;
    usage?: unknown;
    tags?: Record<string, unknown>;
}
export declare function railPointDistanceKm(a: RailSpeedPoint, b: RailSpeedPoint): number;
export declare function documentedRailSpeed(p: RailSpeedPoint): number | null;
export declare function resolveRailSpeedLimits(route: RailSpeedPoint[], trainCap?: number): number[];
