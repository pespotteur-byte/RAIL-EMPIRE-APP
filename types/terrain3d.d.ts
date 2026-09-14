export declare function decodeTerrariumRGB(r: unknown, g: unknown, b: unknown): number;
export declare function slippyTileForLatLon(lat: number, lon: number, z: number): {
    x: number;
    y: number;
};
export declare function terrainGridSize(zoom: number, deviceMemory?: unknown, width?: number): 45 | 31 | 35 | 57 | 37 | 41 | 49 | 53;
type TerrainTileMapLike = {
    centerLat: number;
    centerLon: number;
    zoomLevel: number;
    screenToWorld(x: number, y: number, width: number, height: number): {
        lat: number;
        lon: number;
    };
};
type TerrainDemRecord = {
    pixels: Uint8ClampedArray | null;
    used: number;
    promise: Promise<TerrainDemRecord | null> | null;
};
type TerrainStatusListener = (status: string, detail: unknown) => void;
type TerrainCenter = {
    lat: number;
    lon: number;
};
type TerrainGridWorld = {
    grid: number;
    center: TerrainCenter;
    centerH: number;
};
export declare class TerrainRelief3D {
    canvas: HTMLCanvasElement | null;
    tileMap: TerrainTileMapLike | null;
    enabled: boolean;
    ready: boolean;
    failed: boolean;
    status: string;
    verticalExaggeration: number;
    _gl: WebGLRenderingContext | null;
    _prog: WebGLProgram | null;
    _posBuf: WebGLBuffer | null;
    _uvBuf: WebGLBuffer | null;
    _normBuf: WebGLBuffer | null;
    _idxBuf: WebGLBuffer | null;
    _texture: WebGLTexture | null;
    _indexCount: number;
    _demCache: Map<string, TerrainDemRecord>;
    _demMaxTiles: number;
    _demGeneration: number;
    _lastMeshKey: string;
    _lastTextureAt: number;
    _lastMeshAt: number;
    _lastCenter: TerrainCenter | null;
    _centerElevation: number;
    _mvp: Float32Array | null;
    bearingRad: number;
    _halfWidthKm: number;
    _halfHeightKm: number;
    _gridWorld: TerrainGridWorld | null;
    _listeners: Set<TerrainStatusListener>;
    _textureDirty: boolean;
    _rebuildPending: boolean;
    _sourceCanvas: HTMLCanvasElement | null;
    _demEndpoints: string[];
    _dpr: number;
    _viewportW: number;
    _viewportH: number;
    _lastTextureKey: string;
    _indexType: number;
    constructor(canvas: unknown, tileMap: unknown);
    onStatus(fn: unknown): () => boolean;
    _emit(status: string, detail?: unknown): void;
    isSupported(): boolean;
    _initGL(): boolean;
    enable(sourceCanvas: unknown): boolean;
    disable(): void;
    destroy(): void;
    resize(): void;
    requestRebuild(force?: boolean): void;
    shouldRecenter(lat: number, lon: number): boolean;
    markTextureDirty(): void;
    sync(sourceCanvas: unknown, mapDirty?: unknown): void;
    _rebuildMesh(force: boolean): Promise<void>;
    setBearing(rad: unknown): void;
    _computeMvp(): void;
    render(): void;
    projectLatLon(lat: number, lon: number): {
        x: number;
        y: number;
        depth: number;
    } | null;
    _sampleFromTilePoint(p: __S3Struct169): number;
    _sampleElevationSync(lat: number, lon: number): number;
    _loadDemTile(z: number, x: number, y: number): Promise<TerrainDemRecord | null>;
    _evictDem(target: number): void;
}
type __S3Struct169 = {
    "k": string;
    "t": {
        "x": number;
        "y": number;
    };
};
export {};
