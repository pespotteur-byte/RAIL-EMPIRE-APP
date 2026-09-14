import { type StationTrackIdentity } from './station-track-identity.js';
import type { World } from './world.js';
type LineOrm = {
    findRoute: (latA: number, lonA: number, latB: number, lonB: number) => Promise<unknown>;
    getRouteDistance: (route: unknown[]) => number;
};
type PlatformState = {
    total: number;
    occupied: Map<string | number, string>;
};
type PlatformAssignOptions = {
    exactPreferred?: boolean;
    trackIdentity?: StationTrackIdentity | null;
    displayName?: string;
};
export declare class Line {
    id: string;
    name: string;
    color: string;
    code: string;
    stops: string[];
    trackIds: string[];
    constructor(input?: unknown);
    getStationIds(): string[];
    hasStation(stationId: string): boolean;
    hasTrack(trackId: string): boolean;
    toSave(): {
        id: string;
        name: string;
        color: string;
        code: string;
        stops: string[];
        trackIds: string[];
    };
}
export declare class LineManager {
    lines: Line[];
    _trackLineMap: Map<string, Line[]> | null;
    constructor();
    addLine(data: unknown): Line;
    removeLine(id: string): void;
    getLine(id: string): Line | undefined;
    getAll(): Line[];
    getLinesForStation(stationId: string): Line[];
    getLinesForTrack(trackId: string): Line[];
    _rebuildTrackLineMap(): void;
    invalidateTrackLineMap(): void;
    /**
     * Build a line from ordered station IDs.
     * Reuses existing tracks (troncons communs) if they exist between station pairs.
     * Creates new tracks via ORM if they don't exist.
     */
    buildLine(input: unknown, world: World, orm: LineOrm): Promise<Line | null>;
    toSave(): {
        id: string;
        name: string;
        color: string;
        code: string;
        stops: string[];
        trackIds: string[];
    }[];
    loadFromSave(data: unknown, world?: World | null): void;
}
/**
 * PlatformManager - tracks platform allocation at stations.
 * Each station has N platforms. A train occupies one platform while stopped.
 */
export declare class PlatformManager {
    stationPlatforms: Map<string, PlatformState>;
    capacityProvider: ((stationId: string, base: number) => number) | null;
    private effectiveCapacity;
    private physicalAliases;
    private displayNames;
    private physicallyReferencedKeys;
    constructor();
    initStation(stationId: string, numPlatforms: unknown): void;
    /**
     * Try to assign a platform to a train at a station.
     * Returns the platform name/number or null if all platforms are occupied.
     * @param {string} preferred - preferred platform name from schedule (optional)
     */
    assignPlatform(stationId: string, trainId: string, numPlatforms: unknown, preferred: unknown, options?: PlatformAssignOptions | boolean | null): string | number | null;
    /** ORM aliases connect validated way IDs and real track refs, never display names. */
    private _assignPhysicalTrack;
    /** Identify a unique blocking owner without mutating aliases/reservations. */
    getPhysicalTrackOwner(stationId: string, input: StationTrackIdentity, displayName?: string): string | null;
    /**
     * Release a platform when a train departs.
     */
    releasePlatform(stationId: string, trainId: string): void;
    /**
     * Get the platform a train is on, or null.
     */
    getPlatformForTrain(stationId: string, trainId: string): string | number | null;
    /**
     * Check how many free platforms are available.
     */
    getFreePlatforms(stationId: string): number;
    /**
     * Get platform status for display.
     */
    getStatus(stationId: string): {
        total: number;
        used: number;
        free: number;
        assignments: {
            platform: string | number;
            resourceId: string | number;
            trainId: string;
        }[];
    };
}
export {};
