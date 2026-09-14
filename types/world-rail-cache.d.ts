type WorldRailCacheOptions = {
    cellDeg?: number;
    maxMemoryTiles?: number;
    maxMemoryWays?: number;
};
type RailEnvelope = {
    south: number;
    west: number;
    north: number;
    east: number;
};
type RailTile = RailEnvelope & {
    key: string;
    row: number;
    col: number;
    worldRail?: boolean;
};
type UnknownRecord = Record<string, unknown>;
type RailWay = UnknownRecord & {
    id?: unknown;
    geometry?: unknown[];
};
type RailCacheRecord = UnknownRecord & {
    key: string;
    schema?: unknown;
    complete?: unknown;
    ways?: RailWay[];
    negative?: unknown;
    emptyConfirmations?: unknown;
    expiresAt?: unknown;
    _touch?: number;
};
type WorldRailStats = {
    hits: number;
    misses: number;
    writes: number;
    networkTiles: number;
    failedTiles: number;
    rejectedEmpty: number;
    verifiedEmpty: number;
    expiredEmpty: number;
    invalidatedLegacyEmpty: number;
    invalidatedLegacySchema: number;
};
type PutOptions = {
    source?: string;
    complete?: boolean;
};
type VerifiedEmptyOptions = {
    source?: string;
    confirmations?: number;
    ttlMs?: number;
};
type ReleaseMemoryOptions = {
    maxTiles?: number;
    maxWays?: number;
};
export declare class WorldRailCache {
    cellDeg: number;
    maxMemoryTiles: number;
    maxMemoryWays: number;
    _db: IDBDatabase | null;
    _openPromise: Promise<boolean> | null;
    _memory: Map<string, RailCacheRecord>;
    _touch: number;
    _memoryWays: number;
    _stats: WorldRailStats;
    constructor({ cellDeg, maxMemoryTiles, maxMemoryWays }?: WorldRailCacheOptions);
    open(): Promise<boolean>;
    _row(lat: number): number;
    _col(lon: unknown): number;
    tileAt(lat: number, lon: number): {
        key: string;
        row: number;
        col: number;
        south: number;
        north: number;
        west: number;
        east: number;
        worldRail: boolean;
    };
    tilesForBBox(south: number, west: number, north: number, east: number): any[];
    tilesForEnvelopes(envelopes?: RailEnvelope[]): any[];
    _remember(rec: RailCacheRecord): RailCacheRecord | {
        _touch: number;
        key: string;
        schema?: unknown;
        complete?: unknown;
        ways?: RailWay[];
        negative?: unknown;
        emptyConfirmations?: unknown;
        expiresAt?: unknown;
    };
    _trim(maxTiles?: number, maxWays?: number): void;
    releaseMemory({ maxTiles, maxWays }?: ReleaseMemoryOptions): {
        memoryTiles: number;
        memoryWays: number;
    };
    _dropMemory(key: string): void;
    _recordUsable(rec: RailCacheRecord | null | undefined, now?: number): boolean;
    _deletePersistent(key: string): Promise<boolean>;
    get(tileOrKey: string | {
        key?: unknown;
    }): Promise<RailCacheRecord | {
        _touch: number;
        key: string;
        schema?: unknown;
        complete?: unknown;
        ways?: RailWay[];
        negative?: unknown;
        emptyConfirmations?: unknown;
        expiresAt?: unknown;
    } | null>;
    _persist(rec: RailCacheRecord): Promise<boolean>;
    put(tile: RailTile, ways: unknown, { source, complete }?: PutOptions): Promise<boolean>;
    putVerifiedEmpty(tile: RailTile, { source, confirmations, ttlMs }?: VerifiedEmptyOptions): Promise<boolean>;
    remove(tileOrKey: string | {
        key?: unknown;
    }): Promise<boolean>;
    cachedWaysForEnvelopes(envelopes?: RailEnvelope[]): Promise<{
        ways: any[];
        tiles: any[];
        missing: any[];
        cached: number;
        complete: boolean;
    }>;
    markNetworkTile(ok?: unknown): void;
    stats(): {
        hits: number;
        misses: number;
        writes: number;
        networkTiles: number;
        failedTiles: number;
        rejectedEmpty: number;
        verifiedEmpty: number;
        expiredEmpty: number;
        invalidatedLegacyEmpty: number;
        invalidatedLegacySchema: number;
        schema: string;
        coverage: string;
        cellDeg: number;
        memoryTiles: number;
        memoryWays: number;
    };
}
export {};
