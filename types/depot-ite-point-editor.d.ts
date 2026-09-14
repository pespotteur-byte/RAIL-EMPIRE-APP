type LatLon = {
    lat: number;
    lon: number;
};
type StationLike = LatLon & {
    id: string;
    name: string;
    type?: string;
};
type DepotLike = {
    type?: string;
    stationId?: string;
    location?: LatLon | null;
};
type DepotForm = {
    type: string;
    name: string;
    tracks: number;
    cost: number;
    infrastructure: string[];
    cargoTypes: string[];
};
type PixelPoint = {
    x: number;
    y: number;
};
type TileMapLike = {
    setNetworkEnabled?(enabled: boolean): void;
    centerLat: number;
    centerLon: number;
    zoomLevel: number;
    viewportWidth: number;
    viewportHeight: number;
    basicMode?: boolean;
    satelliteEnabled?: boolean;
    railEnabled?: boolean;
    applyZoom(delta: number, x: number, y: number): void;
    pan(dx: number, dy: number): void;
    markDirty?(): void;
    screenToWorld(x: number, y: number, width: number, height: number): LatLon;
    latLonToPixel(lat: number, lon: number): PixelPoint;
    renderTiles(ctx: CanvasRenderingContext2D, width: number, height: number): void;
};
type WorldLike = {
    stations?: StationLike[];
    getStationsNear?(lat: number, lon: number, radiusKm: number): StationLike[];
    getStationsInBounds?(minLat: number, minLon: number, maxLat: number, maxLon: number): StationLike[];
    getStationById(id: string | undefined): StationLike | null;
};
type DepotManagerLike = {
    add(data: Record<string, unknown>, economy: unknown): unknown;
    getAll?(): DepotLike[];
};
type GameLike = {
    world: WorldLike;
    renderer?: {
        tileMap?: TileMapLike;
        invalidateStatic?(): void;
    };
    depotManager: DepotManagerLike;
    economy: unknown;
    saveState(): void;
};
type UiLike = {
    renderDepotsList(): void;
};
export declare class DepotITEPointEditor {
    game: GameLike;
    ui: UiLike;
    tileMap: TileMapLike;
    location: LatLon | null;
    form: DepotForm;
    dragging: boolean;
    panning: boolean;
    panThresholdPx: number;
    dragStartX: number;
    dragStartY: number;
    dragX: number;
    dragY: number;
    overlay: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    panel: HTMLElement;
    constructor(game: GameLike, ui: UiLike);
    _ensureOverlay(): void;
    _bind(): void;
    isOpen(): boolean;
    open(initialType?: string): void;
    close(): void;
    _zoom(d: number): void;
    _resize(): void;
    _setStatus(t: string): void;
    _placeFromEvent(e: MouseEvent): void;
    _nearestStation(lat: number, lon: number): StationLike | null;
    _readForm(): void;
    renderPanel(): void;
    _bindPanel(): void;
    save(): Promise<void>;
    _drawObjectIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: unknown, size?: number, alpha?: number): void;
    _objectPosition(d: DepotLike): LatLon | null;
    draw(): void;
}
export {};
