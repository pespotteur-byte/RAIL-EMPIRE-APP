/** Rescue-route input boundary. This checks geometry and endpoints, NOT proof of
 * railway connectivity. No invalid interior point is silently removed: doing so
 * would create an invented connector across the missing section.
 */
export interface RescuePoint {
    lat: number;
    lon: number;
    [key: string]: unknown;
}
export interface RescueRoutePoint extends RescuePoint {
    [key: string]: unknown;
}
export declare const RESCUE_ENDPOINT_TOLERANCE_KM = 0.05;
export declare function rescuePoint(value: unknown): RescuePoint | null;
export declare function rescueDistanceKm(a: RescuePoint, b: RescuePoint): number;
export declare function validatedRescueRoute(value: unknown, from?: RescuePoint | null, to?: RescuePoint | null): RescueRoutePoint[] | null;
export interface RescueRouteFailure {
    attempts: number;
    retrySec: number;
    retryAtMs: number;
    accessDenied: boolean;
    message: string;
}
export declare function rescueRouteFailure(error: unknown, previousAttempts: number, now?: number): RescueRouteFailure;
