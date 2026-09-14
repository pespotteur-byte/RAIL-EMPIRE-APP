import { LiveryLibrary, type LiveryTarget } from './livery-model.js';
export interface LiveryCatalogItem {
    id: string;
    name: string;
    category: string;
    imageData?: string;
}
export interface LiveryEditorHost {
    library: LiveryLibrary;
    catalog: () => LiveryCatalogItem[];
    commit: (change: () => void) => Promise<void>;
    targets: () => LiveryTarget[];
    ensureCatalog?: () => Promise<unknown> | unknown;
}
/** Event-driven editor. No animation loop, network map or per-train work. */
export declare class LiveryEditor {
    private readonly root;
    private readonly host;
    private selected;
    private editingId;
    private baseAsset;
    private cargoAsset;
    private baseImage;
    private cargoImage;
    private placement;
    private request;
    private frameRequest;
    private busy;
    private placementValid;
    private active;
    private page;
    private stockPage;
    private readonly perPage;
    private drag;
    private canvas;
    constructor(root: HTMLElement, host: LiveryEditorHost);
    private el;
    private message;
    setActive(value: boolean): void;
    dispose(): void;
    show(): void;
    private refreshCatalog;
    private setBusy;
    private clear;
    private renderCatalog;
    private renderLibrary;
    private choose;
    private upload;
    private readPlacement;
    private writePlacement;
    private updatePlacement;
    private scheduleRender;
    private sizePreview;
    private render;
    private bindCanvas;
    private save;
    private export;
    private recordAction;
}
