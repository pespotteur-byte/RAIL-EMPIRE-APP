/** Raster service etiquette only. This never changes the OSM railway graph or simulation. */
export declare const OSM_STANDARD_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export declare const TILE_REFERRER_POLICY: ReferrerPolicy;
/** Stable, truthful app identity for local HTML. No forged Referer or User-Agent.
 * OSM documents this file:// integration at https://wiki.openstreetmap.org/wiki/Referer .
 */
export declare const OSM_LOCAL_APPLICATION_ID = "RailEmpire";
export declare function tileRequestOptions(url: string, protocol: string, signal?: AbortSignal): RequestInit;
/** Some OSM denials are HTTP 200 error images: inspect the exposed header too.
 * Never interpret an inaccessible header as proof that access was granted.
 */
export declare function tileResponseBlockReason(headers: Pick<Headers, 'get'>): string | null;
export type TileAccessKind = 'ready' | 'local-file' | 'forbidden' | 'rate-limit' | 'unavailable' | 'paused';
export type TileAccessState = {
    kind: TileAccessKind;
    status: number | null;
    until: number;
    manual: boolean;
    failures: number;
    blockedReason?: string;
};
export type TilePolicyStorage = Pick<Storage, 'getItem' | 'setItem'>;
export declare function isOSMStandard(url: string): boolean;
export declare function tileSourceKey(url: string): string;
export declare function retryAfterDeadline(value: string | null, now: number, minimumMs: number): number;
export declare function tilePolicyStorage(): TilePolicyStorage | null;
export declare class TileAccessPolicy {
    private storage;
    private states;
    private activeRequests;
    private listeners;
    private notificationQueued;
    subscribe(listener: () => void): () => void;
    private notify;
    acquire(url: string, max?: number): (() => void) | null;
    constructor(storage?: TilePolicyStorage | null);
    private persist;
    state(url: string, protocol: string, now?: number): TileAccessState;
    failure(url: string, status: number | null, retryAfter?: string | null, now?: number, blockedReason?: string | null): TileAccessState;
    success(url: string, protocol: string, now?: number): void;
    pause(url: string): void;
    resume(url: string, protocol: string, now?: number): boolean;
}
export type BaseMapSource = {
    url: string;
    attribution: string;
    maxZoom: number;
};
export declare function validateBaseMapSource(input: BaseMapSource): BaseMapSource;
export declare function sharedTileAccessPolicy(storage?: TilePolicyStorage | null): TileAccessPolicy;
