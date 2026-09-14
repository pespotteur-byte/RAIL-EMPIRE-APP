import type { TileMap } from './map.js';
/** DOM-only diagnostics. It neither fetches map data nor changes the simulation. */
export declare class MapSourcePanel {
    private map;
    private root;
    private lastRefresh;
    private lastStateKey;
    constructor(map: TileMap, root: HTMLElement | null);
    update(force?: boolean): void;
}
