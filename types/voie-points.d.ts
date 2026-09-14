type UnknownRecord = Record<string, unknown>;
type VoiePointInput = {
    id?: unknown;
    lat?: unknown;
    lon?: unknown;
    voie?: unknown;
    stationId?: unknown;
    occupiedBy?: unknown;
    lineGroupId?: unknown;
    linePoint?: unknown;
};
type RoutePoint = UnknownRecord & {
    lat: number;
    lon: number;
    maxSpeed?: number;
    maxSpeedSource?: string;
    wayId?: string;
    incline?: unknown;
    tags?: UnknownRecord;
    service?: unknown;
    usage?: unknown;
    oneway?: unknown;
    bidirectional?: unknown;
    trackRef?: unknown;
    ref?: unknown;
    travelDirection?: unknown;
    electrified?: unknown;
};
type TronconInput = {
    id?: unknown;
    pointA?: unknown;
    pointB?: unknown;
    route?: unknown;
    distance?: unknown;
    wear?: unknown;
    name?: unknown;
    ref?: unknown;
    trackRef?: unknown;
    lineGroupId?: unknown;
};
type RenderBBox = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};
type RouteChunk = RenderBBox & {
    start: number;
    end: number;
};
type GeoLike = {
    lat: number;
    lon: number;
};
type WorldLike = {
    stations?: Array<{
        id?: unknown;
    }>;
} | null;
type EncodedRouteRecord = UnknownRecord & {
    c?: unknown[];
    q?: unknown;
    f?: unknown[];
    i?: unknown[][];
    s?: unknown[];
    w?: unknown[];
    wd?: unknown[];
    wm?: UnknownRecord[];
    dr?: unknown[];
    e?: unknown[];
};
type VoiePointSaveData = UnknownRecord & {
    _v?: unknown;
    voiePoints?: unknown;
    troncons?: unknown;
};
export declare class VoiePoint {
    id: string;
    lat: number;
    lon: number;
    voie: string;
    stationId: string | null;
    occupiedBy: string | null;
    lineGroupId: string | null;
    linePoint: boolean;
    constructor(data?: VoiePointInput);
}
export declare class Troncon {
    id: string;
    pointA: string;
    pointB: string;
    route: RoutePoint[];
    distance: number;
    occupiedBy: string | null;
    reservedBy: string | null;
    wear: number;
    name: string;
    ref: string;
    trackRef: string;
    lineGroupId: string | null;
    _renderBBox?: RenderBBox;
    constructor(data?: TronconInput);
}
export declare class VoiePointManager {
    voiePoints: VoiePoint[];
    troncons: Troncon[];
    _vpMap: Map<string, VoiePoint>;
    _trcMap: Map<string, Troncon>;
    _trcByPoint: Map<string, Troncon[]>;
    _revision: number;
    _saveCache: unknown;
    _spatialDirty: boolean;
    _vpSpatial: Map<string, VoiePoint[]>;
    _trcSpatial: Map<string, Troncon[]>;
    _largeTrcs: Troncon[];
    _routeGeomCache: WeakMap<RoutePoint[], {
        chunkSize: number;
        chunks: RouteChunk[];
    }>;
    _spatialCellSize: number;
    _batchDepth: number;
    _batchChanged: boolean;
    _occupiedVpIds: Set<string>;
    _occupiedTrcIds: Set<string>;
    onChange: (() => void) | null;
    constructor();
    get revision(): number;
    beginBatch(): void;
    endBatch(): void;
    markDirty(): void;
    _notifyChange(): void;
    _rebuildMaps(): void;
    _cellKey(lat: number, lon: number): string;
    _ensureSpatialIndex(): void;
    getVoiePointsInBounds(minLat: number, maxLat: number, minLon: number, maxLon: number): VoiePoint[];
    getTronconsInBounds(minLat: number, maxLat: number, minLon: number, maxLon: number): Troncon[];
    getVoiePointsNear(lat: number, lon: number, radiusKm?: number): VoiePoint[];
    addVoiePoint(data: VoiePointInput): VoiePoint;
    addVoiePointsBulk(items: Array<VoiePoint | VoiePointInput> | null | undefined): VoiePoint[];
    removeVoiePoint(id: string): void;
    deleteLineGroup(lineGroupId: string | null | undefined): number;
    getVoiePointById(id: string): VoiePoint | null;
    getAll(): VoiePoint[];
    getStationVoiePoints(stationId: string): VoiePoint[];
    getStationVoiePoint(stationId: string, voie: string): VoiePoint | undefined;
    occupyVoiePoint(vpId: string, trainId: string): boolean;
    releaseVoiePoint(vpId: string, trainId: string): void;
    releaseAllVoiePointsForTrain(trainId: string): void;
    isVoiePointOccupied(vpId: string, excludeTrainId: string | null): boolean;
    _purgeDeadVoiePointOwner(vp: VoiePoint, excludeTrainId?: string | null): boolean;
    addTroncon(data: TronconInput): Troncon;
    addTronconsBulk(items: Array<Troncon | TronconInput> | null | undefined): Troncon[];
    removeTroncon(id: string): void;
    getTronconById(id: string): Troncon | null;
    getAllTroncons(): Troncon[];
    getTronconsForPoint(pointId: string): Troncon[];
    getTronconVoies(troncon: Troncon): Set<unknown>;
    tronconsShareVoie(trcA: Troncon, trcB: Troncon): boolean;
    occupyTroncon(tronconId: string, trainId: string): boolean;
    releaseTroncon(tronconId: string, trainId: string): void;
    reserveTroncon(tronconId: string, trainId: string): boolean;
    releaseTronconReservation(tronconId: string, trainId: string): void;
    releaseAllReservationsForTrain(trainId: string): void;
    _isDeadInterlockingOwner(trainId: string | null): any;
    _purgeDeadTronconReservation(trc: Troncon, excludeTrainId?: string | null): boolean;
    _purgeDeadTronconOwners(trc: Troncon, excludeTrainId?: string | null): boolean;
    isTronconReserved(tronconId: string, excludeTrainId: string | null): boolean;
    releaseAllForTrain(trainId: string): void;
    getOccupiedVoiePoints(): (VoiePoint | null)[];
    getOccupiedTroncons(): (Troncon | null)[];
    _routeGeometryChunks(route: RoutePoint[], chunkSize?: number): RouteChunk[];
    _pointToSegmentKm(position: GeoLike, a: GeoLike, b: GeoLike): number;
    _pointToBBoxLowerBoundKm(position: GeoLike, box: RenderBBox): number;
    _distanceToRouteKm(position: GeoLike, route: RoutePoint[]): number;
    isTronconOccupied(tronconId: string, excludeTrainId: string | null): boolean;
    /**
     * Check if a troncon's ORM route physically crosses any other occupied troncon's route.
     * Returns the first blocking troncon, or null if clear.
     * @param {string} tronconId - troncon to check
     * @param {string} trainId - train trying to use this troncon
     * @returns {Troncon|null} - blocking troncon or null
     */
    checkCisaillement(tronconId: string, trainId: string): Troncon | null;
    /**
     * Check if two ORM routes physically cross each other.
     * Uses segment-segment intersection test.
     */
    _routesCross(routeA: RoutePoint[], routeB: RoutePoint[]): boolean;
    /**
     * 2D line segment intersection test using cross products.
     */
    _segmentsIntersect(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number): boolean;
    /**
     * Find a route through the tronçon graph from point A to point B.
     * Returns the concatenated route geometry or null if no path exists.
     * @param {number} fromLat
     * @param {number} fromLon
     * @param {number} toLat
     * @param {number} toLon
     * @returns {{ route: Array, tronconIds: Array }|null}
     */
    findTronconRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): {
        route: RoutePoint[];
        tronconIds: string[];
    } | null;
    _findNearestVoiePoint(lat: number, lon: number, maxDistKm: number): VoiePoint | null;
    /**
     * Find which voie a train is on based on its position and nearby voie points.
     * Returns the voie string or null if no voie point is close enough.
     * @param {object} position - {lat, lon}
     * @param {number} maxDistKm - max distance to consider (default 5km)
     * @returns {string|null} voie name
     */
    getVoieAtPosition(position: GeoLike | null | undefined, maxDistKm?: number): string | null;
    /**
     * Get the troncon a train is currently on, based on position.
     * @param {object} position - {lat, lon}
     * @param {number} maxDistKm - max distance to route to consider
     * @returns {Troncon|null}
     */
    getTronconAtPosition(position: GeoLike | null | undefined, maxDistKm?: number, filterVoie?: string | null, filterWayIds?: Set<string> | string[] | string | null): Troncon | null;
    _encodeTronconRoute(route: RoutePoint[]): UnknownRecord | null;
    _decodeTronconRoute(r: unknown[] | EncodedRouteRecord | null | undefined): UnknownRecord[] | {
        lat: number;
        lon: number;
    }[];
    toSave(): {};
    loadFromSave(data: VoiePointSaveData | null | undefined, world?: WorldLike): void;
}
export {};
