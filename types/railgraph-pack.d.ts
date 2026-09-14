type UnknownRecord = Record<string, unknown>;
type GeoPoint = {
    lat: number;
    lon: number;
};
type ReaderInput = Uint8Array | ArrayLike<number> | null | undefined;
type RailWay = UnknownRecord & {
    id?: unknown;
    nodeIds?: unknown[];
    geometry?: GeoPoint[];
    tags?: UnknownRecord;
    trainProtection?: unknown;
    orm?: unknown;
};
type RailGraphShard = {
    schema?: string;
    id?: unknown;
    ways?: RailWay[];
};
type CoarseRaw = {
    cellDeg?: unknown;
    nodes?: unknown[][];
    edges?: unknown[][];
};
type CoarseEdge = {
    to: number;
    dist: number;
    shards: number[];
};
type CoarseNode = {
    i: number;
    key: string;
    lat: number;
    lon: number;
    shard: number;
    edges: CoarseEdge[];
};
type CoarseGraph = {
    nodes: CoarseNode[];
};
type CoarseIndex = {
    cell: number;
    cells: Map<string, CoarseNode[]>;
};
type GridIndex = {
    cell: number;
    cells: Map<string, number[]>;
};
type BoundingBox = {
    south: number;
    west: number;
    north: number;
    east: number;
};
type ShardMeta = Partial<BoundingBox> & {
    id?: unknown;
    file?: string;
    neighbors?: unknown[];
    runtimeEstimateBytes?: unknown;
};
type RailGraphManifest = {
    schema?: string;
    prepared?: boolean;
    reason?: string;
    source?: string;
    shards?: ShardMeta[];
    shardCellDeg?: unknown;
    coarse?: CoarseRaw;
    coarseFile?: string;
    grid?: {
        cellDeg?: unknown;
        cells?: Record<string, unknown>;
    };
};
type ScriptLoaderOptions = {
    coarse?: boolean;
    index?: number;
    meta?: ShardMeta;
};
type ScriptLoader = (src: string, options?: ScriptLoaderOptions) => Promise<unknown>;
type ShardLoadResult = {
    id: string;
    added: number;
    totalWays: number;
    cached: boolean;
};
type ProgressInfo = {
    phase: string;
    done: number;
    total: number;
    loadedWays: number;
    residentBytes: number;
    budgetBytes: number;
};
type ProgressCallback = ((info: ProgressInfo) => void) | null;
type AnchorLike = {
    lat?: unknown;
    lon?: unknown;
    snapLat?: unknown;
    snapLon?: unknown;
};
type RailGraphPackOptions = {
    scriptLoader?: ScriptLoader | null;
    basePath?: string;
    maxLoadedShards?: unknown;
    maxResidentBytes?: unknown;
    maxConcurrentShardLoads?: unknown;
};
type EnsureAnchorOptions = {
    neighborRing?: unknown;
    onProgress?: ProgressCallback;
};
type TrimCacheOptions = {
    pinnedIndexes?: number[];
};
type MemoryBudgetError = Error & {
    code?: string;
    requiredBytes?: number;
    budgetBytes?: number;
    shardIndexes?: number[];
};
export declare function decodeRailGraphBinaryV2(bytes: ReaderInput): RailGraphShard;
export declare function decodeRailGraphCoarseBinaryV2(bytes: ReaderInput): CoarseRaw;
export declare class RailGraphPack {
    manifest: RailGraphManifest | null;
    loadedShards: Set<string>;
    loadingShards: Map<string, Promise<ShardLoadResult | null>>;
    ways: Map<string, RailWay>;
    shardWayIds: Map<string, Set<string>>;
    wayRefCount: Map<string, number>;
    shardTouch: Map<string, number>;
    _touchSerial: number;
    maxLoadedShards: number;
    maxResidentBytes: number;
    maxConcurrentShardLoads: number;
    residentWayBytes: number;
    wayResidentBytes: Map<string, number>;
    _coarse: CoarseGraph | null;
    _coarseIndex: CoarseIndex | null;
    _gridIndex: GridIndex | null;
    _scriptLoader: ScriptLoader;
    _basePath: string;
    constructor({ scriptLoader, basePath, maxLoadedShards, maxResidentBytes, maxConcurrentShardLoads }?: RailGraphPackOptions);
    ready(): Promise<RailGraphManifest>;
    get prepared(): boolean;
    get source(): string;
    _prepareGridIndex(): GridIndex | null;
    _prepareCoarse(raw: CoarseRaw): CoarseGraph;
    _nearestCoarse(lat: number, lon: number, maxKm?: number): {
        node: CoarseNode;
        distKm: number;
    } | null;
    _coarseRoute(from: AnchorLike, to: AnchorLike): {
        distanceKm: number;
        nodePath: number[];
        shardIndexes: number[];
    } | null;
    _shardMeta(idx: number): ShardMeta | null;
    _shardId(idx: number): string;
    _wayNodeIds(w: RailWay | null | undefined): string[];
    _containsNodeChain(big: string[], small: string[]): boolean;
    _preferWayVariant(current: RailWay | null | undefined, incoming: RailWay): RailWay;
    _loadShardIndex(idx: number): Promise<ShardLoadResult | null | undefined>;
    _touchShard(id: unknown): void;
    _estimateWayResidentBytes(w: RailWay | null | undefined): number;
    _estimateIndexesRuntimeBytes(indexes: number[] | null | undefined): number;
    _memoryBudgetError(requiredBytes: number, indexes?: Iterable<number>): MemoryBudgetError;
    _prepareMemoryForIndexes(indexes: unknown[] | null | undefined): {
        incomingBytes: number;
        projectedBytes: number;
    };
    _evictShard(id: unknown): boolean;
    trimCache({ pinnedIndexes }?: TrimCacheOptions): number;
    _expandShardNeighborhood(indexes: unknown[] | null | undefined, ring?: number): number[];
    _waysForShardIndexes(indexes: number[] | null | undefined): RailWay[];
    _loadIndexes(indexes: unknown[] | null | undefined, onProgress?: ProgressCallback): Promise<number[]>;
    ensureForAnchors(anchors: AnchorLike[] | null | undefined, { neighborRing, onProgress }?: EnsureAnchorOptions): Promise<RailWay[]>;
    _bboxIntersects(a: Partial<BoundingBox> | null | undefined, b: Partial<BoundingBox> | null | undefined): boolean | null | undefined;
    _shardsForBBox(bb: BoundingBox): unknown[];
    ensureNear(lat: unknown, lon: unknown, radiusKm?: number): Promise<RailWay[]>;
    stats(): {
        prepared: boolean;
        source: string;
        loadedShards: number;
        loadedWays: number;
        maxLoadedShards: number;
        residentBytes: number;
        maxResidentBytes: number;
        maxConcurrentShardLoads: number;
        totalShards: number;
        coarseNodes: number;
    };
}
export {};
