import { type RailBinding, type RailPoint, type NormalizedRailSection } from './rail-section-geometry.js';
type StationLike = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    type?: string;
    country?: unknown;
};
type CandidateLike = Partial<RailBinding> & {
    wayId?: string | number;
    trackRef?: string;
    name?: string;
    ref?: string;
    maxSpeed?: number;
    electrified?: boolean;
    geometry?: RailPoint[];
};
type BoundPoint = RailBinding & {
    displayName?: string;
    osmSnapshot?: unknown;
};
type EditableRailSection = Omit<NormalizedRailSection, 'constraints'> & {
    constraints: BoundPoint[];
    error: string;
};
type InfraForm = {
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
    applyZoom(delta: number, x: number, y: number): void;
    pan(dx: number, dy: number): void;
    markDirty?(): void;
    screenToWorld(x: number, y: number, w: number, h: number): {
        lat: number;
        lon: number;
    };
    latLonToPixel(lat: number, lon: number): PixelPoint;
    renderTiles(ctx: CanvasRenderingContext2D, w: number, h: number): void;
};
type RouterSnapshot = {
    routePoints: RailPoint[];
    segments: unknown[];
    distanceKm: number;
};
type RouterLike = {
    chooseTrackCandidates(lat: number, lon: number, opts: Record<string, unknown>): Promise<CandidateLike[]>;
    routeBetweenBindings(start: RailBinding, end: RailBinding, constraints: BoundPoint[], opts: Record<string, unknown>): Promise<unknown>;
    snapshotRoute(route: unknown): RouterSnapshot;
};
type WorldLike = {
    stations?: StationLike[];
    getStationById(id: string | undefined): StationLike | null;
    getStationsInBounds?(a: number, b: number, c: number, d: number): StationLike[];
    addStation(data: Record<string, unknown>): StationLike;
    removeStation?(id: string): void;
};
type GameLike = {
    orm: {
        getCountryAtPoint(lat: number, lon: number): unknown;
    };
    world: WorldLike;
    renderer?: {
        tileMap?: TileMapLike;
        invalidateStatic?(): void;
    };
    platformManager: {
        initStation(id: string, tracks: number): void;
        stationPlatforms?: {
            delete?(id: string): void;
        };
    };
    depotManager: {
        add(data: Record<string, unknown>, economy: unknown): unknown;
        getAll?(): Array<{
            type?: string;
            railSections?: NormalizedRailSection[];
        }>;
    };
    economy: unknown;
    saveState(): void;
};
type UiLike = {
    renderDepotsList(): void;
};
type PickerResolve = ((value: CandidateLike | null) => void) | null;
export declare class InfrastructureV2Editor {
    game: GameLike;
    ui: UiLike;
    router: RouterLike;
    tileMap: TileMapLike;
    sections: EditableRailSection[];
    activeSectionId: string;
    mode: string;
    busy: boolean;
    dragging: boolean;
    panning: boolean;
    panThresholdPx: number;
    dragStartX: number;
    dragStartY: number;
    dragX: number;
    dragY: number;
    _pickerResolve: PickerResolve;
    _hoverCandidate: CandidateLike | null;
    form: InfraForm;
    overlay: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    panel: HTMLElement;
    picker: HTMLElement;
    pickerList: HTMLElement;
    constructor(game: GameLike, ui: UiLike);
    _ensureOverlay(): void;
    _bind(): void;
    isOpen(): boolean;
    open(initialType?: string): void;
    close(): void;
    _zoom(d: number): void;
    _resize(): void;
    _setStatus(t: string, busy?: boolean): void;
    _active(): EditableRailSection | null;
    _newSection(): EditableRailSection;
    addSection(): void;
    deleteSection(): void;
    armVia(): void;
    resetAuto(): Promise<void>;
    removeLastVia(): Promise<void>;
    _handleMapClick(e: MouseEvent): Promise<void>;
    _chooseBinding(lat: number, lon: number, title: string): Promise<BoundPoint | null>;
    _pickCandidate(candidates: CandidateLike[], title: string): Promise<CandidateLike | null>;
    _resolvePicker(v: CandidateLike | null): void;
    _recompute(s: EditableRailSection): Promise<boolean>;
    _readForm(): void;
    renderPanel(): void;
    _bindPanel(): void;
    save(): Promise<void>;
    _drawRoute(route: RailPoint[], color: string, width?: number, alpha?: number): void;
    _drawAnchor(b: RailBinding | null, color: string, r?: number): void;
    draw(): void;
    _error(err: unknown): void;
}
export {};
