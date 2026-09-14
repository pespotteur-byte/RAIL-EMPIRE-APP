/** User liveries are visual overlays, never catalogue replacements or vehicles. */
export interface LiveryImage {
    src: string;
    width: number;
    height: number;
}
export interface LiveryPlacement {
    x: number;
    y: number;
    scale: number;
}
export interface LiveryDefinition {
    id: string;
    catalogId: string;
    label: string;
    kind: 'wagon' | 'replacement';
    base: LiveryImage | null;
    cargo: LiveryImage | null;
    image: LiveryImage;
    placement: LiveryPlacement;
    anchorX: number;
    anchorY: number;
    createdAt: string;
}
export interface LiveryTarget {
    physicalVehicleId?: string;
    elementId?: string;
    liveryId?: string;
    catalogId?: string;
    stockId?: string;
    imageData?: string;
    originalImageData?: string;
}
export interface CompositeFrame {
    width: number;
    height: number;
    left: number;
    top: number;
    baseX: number;
    baseY: number;
    cargoX: number;
    cargoY: number;
    cargoWidth: number;
    cargoHeight: number;
}
export declare const LIVERY_MAX_SIDE = 8192;
export declare const LIVERY_MAX_PIXELS = 16777216;
export declare function assertImageSize(width: number, height: number): void;
export declare function isSafeLiverySource(src: string): boolean;
export declare function compositeFrame(base: Pick<LiveryImage, 'width' | 'height'>, cargo: Pick<LiveryImage, 'width' | 'height'>, placement: LiveryPlacement): CompositeFrame;
export declare function defaultLiveryPlacement(base: Pick<LiveryImage, 'width' | 'height'>, cargo: Pick<LiveryImage, 'width' | 'height'>): LiveryPlacement;
export declare class LiveryLibrary {
    private records;
    private sequence;
    private byCatalog;
    get size(): number;
    get(id: string): LiveryDefinition | undefined;
    all(): LiveryDefinition[];
    compatible(catalogId: unknown): readonly LiveryDefinition[];
    private reindex;
    newId(): string;
    put(value: LiveryDefinition): LiveryDefinition;
    remove(id: string): void;
    apply(target: LiveryTarget, original?: string, strict?: boolean): void;
    select(target: LiveryTarget, id: string, original?: string): void;
    /** Asset strings are stored once in the library; vehicles only store liveryId.
     * No arbitrary cap on liveries, and no eviction/truncation of user creations. */
    toSave(): {
        schemaVersion: 1;
        assets: LiveryImage[];
        liveries: Record<string, unknown>[];
    };
    loadFromSave(value: unknown): void;
}
export declare function saveLiveryTarget<T extends LiveryTarget>(element: T): T;
/** Copy appearance only, never physical properties or catalogue identity. */
export declare function copyLiveryAppearance(target: LiveryTarget, source: LiveryTarget): void;
