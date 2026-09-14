type __KPM474 = number;
type __KPM475 = number;
type RoutePoint = {
    lat: number;
    lon: number;
    maxSpeed?: unknown;
    maxSpeedSource?: unknown;
    wayId?: unknown;
};
export type CantonAssignment = {
    cantonId: string;
    startIndex: number;
    endIndex: number;
    startKm: number;
    endKm: number;
    trackSig: string;
    resourceIds: string[];
};
/** Live references, not cached presence booleans: a stop/cancel within the same
 * physics tick must immediately affect block occupancy. */
type PresenceService = {
    id: unknown;
    active?: unknown;
    completed?: unknown;
    cancelled?: unknown;
    state?: unknown;
    position?: unknown;
};
/**
 * Precise geodesic distance using Haversine formula.
 * @returns {number} Distance in kilometers
 */
export declare function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
export declare function timeDiff(a: __KPM474, b: __KPM475): number;
/**
 * Pre-analyze a route: compute per-segment distances, speeds, and estimated travel times.
 * @param {Array} route - Array of { lat, lon, maxSpeed, tracks }
 * @param {number} trainMaxSpeed - Train's physical speed limit (km/h)
 * @returns {{ segments: Array, totalDistance: number, estimatedTimeMinutes: number }}
 */
export declare function analyzeRoute(route: RoutePoint[], trainMaxSpeed: number): {
    segments: {
        index: number;
        from: RoutePoint;
        to: RoutePoint;
        distance: number;
        maxSpeed: number;
        effectiveSpeed: number;
        timeMinutes: number;
        cumulativeDistance: number;
    }[];
    totalDistance: number;
    estimatedTimeMinutes: number;
};
/**
 * Canton (block section) for railway signaling.
 */
declare class Canton {
    id: unknown;
    startIndex: unknown;
    endIndex: unknown;
    occupiedBy: unknown | null;
    reservedBy: unknown | null;
    resourceIds: Set<string>;
    constructor(id: unknown, startIndex: unknown, endIndex: unknown, resourceIds?: string[]);
}
/**
 * Manages the cantonnement (block signaling) system.
 * Prevents two trains from occupying the same block section.
 */
export declare class CantonManager {
    private _serviceLookupFrame;
    private _generatedTables;
    private _ensureAssignment;
    private _assignmentIndex;
    /** Index service identities once for a synchronous movement tick. The
     * returned finalizer restores nested scopes and releases every reference. */
    beginServiceLookupFrame(services: PresenceService[]): () => void;
    /** Station-resource IDs in old saves may be numeric or textual. Keep that
     * compatibility without rescanning the entire fleet for every platform.
     * This index contains live references and lives only for a synchronous tick.
     */
    findResourceOwner<T extends PresenceService>(services: T[], id: unknown): T | undefined;
    private _lookupPresenceService;
    cantons: Map<unknown, Canton>;
    routeCantons: Map<string | null, CantonAssignment[]>;
    trainCantons: Map<unknown, Set<unknown>>;
    resourceCantons: Map<string, Set<unknown>>;
    currentTime: unknown;
    constructor();
    setTime(timeOfDay: unknown): void;
    setTrainSeparation(trainId: unknown, minutes: unknown): void;
    /**
     * Geographic key for a canton, quantized to ~11m precision.
     * Routes sharing physical track produce the same canton keys.
     */
    _geoKey(lat1: number, lon1: number, lat2: number, lon2: number, trackSig?: unknown): string;
    _physicalSegmentKey(a: RoutePoint, b: RoutePoint): string;
    _registerCantonResources(canton: Canton, resourceIds: string[]): void;
    _conflictingCantonOnResources(canton: Canton, trainId: unknown): {
        canton: Canton;
        resourceId: string;
        owner: {};
        field: "occupiedBy" | "reservedBy";
    } | null;
    _routeKey(route: RoutePoint[]): string | null;
    /**
     * Create cantons for a route. Returns array of canton assignments.
     * Block boundaries are determined by speed-dependent block lengths.
     */
    createRouteCantons(route: RoutePoint[]): CantonAssignment[];
    /**
     * Find which canton assignment a segment index falls into.
     */
    getCantonForSegment(assignments: CantonAssignment[], segmentIndex: number): CantonAssignment | null;
    /**
     * Get the next canton after the one containing the given segment index.
     */
    getNextCanton(assignments: CantonAssignment[], segmentIndex: number): CantonAssignment | null;
    reserve(cantonId: unknown, trainId: unknown): boolean;
    occupy(cantonId: unknown, trainId: unknown): boolean;
    release(cantonId: unknown, trainId: unknown): void;
    isAvailable(cantonId: unknown, trainId: unknown): boolean;
    _isTrainGone(id: unknown): boolean;
    /** Coupling changes the controlling identity without briefly unlocking rail. */
    transferTrainResources(from: unknown, to: unknown): Set<unknown>;
    getTrackedCantons(trainId: unknown): Set<unknown>;
    releaseAll(trainId: unknown): void;
    /**
     * v1.1.73 — synchronize block OCCUPATION with the whole physical train, not
     * merely the head. frontKm is progression along the current route.
     * Returns false if any block under the physical footprint is occupied by
     * another live train; the caller must not advance into that footprint.
     */
    syncFootprint(trainId: unknown, assignments: CantonAssignment[], frontKm: unknown, lengthM?: unknown, retainIds?: Iterable<unknown> | null): boolean;
    /**
     * Reserve the next distinct block before the train reaches its boundary.
     * Returns null when no reservation is needed, or a descriptor with blocked=true
     * when another movement owns/conflicts with that physical rail resource.
     */
    reserveNextAhead(assignments: CantonAssignment[], segmentIndex: number, trainId: unknown, frontKm?: unknown, horizonM?: number): {
        assignment: CantonAssignment;
        distanceM: number;
        index: number;
        blocked: boolean;
    } | null;
    /** Returns the first unavailable physical block ahead, including metric distance. */
    firstUnavailableAhead(assignments: CantonAssignment[], segmentIndex: number, trainId: unknown, frontKm?: unknown, horizonM?: number): {
        assignment: CantonAssignment;
        distanceM: number;
        index: number;
    } | null;
    /**
     * Periodic cleanup: remove cantons that are not occupied/reserved
     * and route cache entries exceeding limit. Call periodically (e.g. every 5 min).
     */
    cleanup(): void;
    /**
     * Get signal aspect for a train at a given position.
     * Returns: null (green/clear), 30 (yellow/caution), or 0 (red/stop).
     */
    /** The same entry-block predicate drives drawing and movement. An own
     * reservation is not a yellow lamp; yellow announces the next closed block. */
    getEntrySignalAspect(assignments: CantonAssignment[], entryIndex: number, trainId: unknown): 0 | 30 | null;
    getSignalAspect(assignments: CantonAssignment[], segmentIndex: number, trainId: unknown): 0 | 30 | null;
    _trackCanton(trainId: unknown, cantonId: unknown): void;
}
export {};
