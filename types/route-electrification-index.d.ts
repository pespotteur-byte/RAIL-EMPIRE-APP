/** Index explicit gaps in the route's fixed infrastructure snapshot.
 * Unknown electrification keeps its existing permissive meaning. Operational
 * outages/works are still checked live by their own movement-authority paths.
 * A new route snapshot gets a new index; reset() handles explicit in-place edits.
 */
export interface ElectrificationPoint {
    electrified?: unknown;
}
export declare class RouteElectrificationIndex {
    private cachedRoute;
    private cachedLength;
    private ranges;
    reset(): void;
    next(route: readonly ElectrificationPoint[], index: number): number | null;
}
