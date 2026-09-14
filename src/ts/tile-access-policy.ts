/** Raster service etiquette only. This never changes the OSM railway graph or simulation. */
export const OSM_STANDARD_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_REFERRER_POLICY: ReferrerPolicy = 'strict-origin-when-cross-origin';
/** Stable, truthful app identity for local HTML. No forged Referer or User-Agent.
 * OSM documents this file:// integration at https://wiki.openstreetmap.org/wiki/Referer .
 */
export const OSM_LOCAL_APPLICATION_ID = 'RailEmpire';
export function tileRequestOptions(url: string, protocol: string, signal?: AbortSignal): RequestInit {
    const options: RequestInit = { mode: 'cors', credentials: 'omit', cache: 'default',
        referrerPolicy: TILE_REFERRER_POLICY, signal };
    if (protocol === 'file:' && isOSMStandard(url))
        options.headers = { 'X-Requested-With': OSM_LOCAL_APPLICATION_ID };
    return options;
}
/** Some OSM denials are HTTP 200 error images: inspect the exposed header too.
 * Never interpret an inaccessible header as proof that access was granted.
 */
export function tileResponseBlockReason(headers: Pick<Headers, 'get'>): string | null {
    const value = headers.get('x-blocked')?.trim();
    return value && !/^(?:0|false|no|none)$/i.test(value) ? value.slice(0, 240) : null;
}
export type TileAccessKind = 'ready' | 'local-file' | 'forbidden' | 'rate-limit' | 'unavailable' | 'paused';
export type TileAccessState = {
    kind: TileAccessKind; status: number | null; until: number; manual: boolean; failures: number; blockedReason?: string;
};
export type TilePolicyStorage = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'rail-empire.raster-access.v1';
const READY: Readonly<TileAccessState> = Object.freeze({ kind: 'ready', status: null, until: 0, manual: false, failures: 0 });
export function isOSMStandard(url: string): boolean {
    try { return /^(?:[abc]\.)?tile\.openstreetmap\.org$/i.test(new URL(url).hostname); }
    catch { return false; }
}
export function tileSourceKey(url: string): string {
    if (isOSMStandard(url)) return 'osm-standard';
    try {
        const u = new URL(url);
        // Sharded ORM hosts are one service, not independent retry budgets.
        if (/^(?:[abc]\.)?tiles\.openrailwaymap\.org$/i.test(u.hostname)) return 'orm-standard';
        return u.origin;
    } catch { return 'invalid-source'; }
}
export function retryAfterDeadline(value: string | null, now: number, minimumMs: number): number {
    let delay = minimumMs;
    if (value && /^\d+$/.test(value.trim())) {
        const seconds = Number(value.trim());
        delay = Math.max(delay, Number.isFinite(seconds) ? seconds * 1000 : Number.MAX_SAFE_INTEGER - now);
    } else if (value) {
        const date = Date.parse(value);
        if (Number.isFinite(date)) delay = Math.max(delay, date - now);
    }
    return Math.min(Number.MAX_SAFE_INTEGER, now + delay);
}
export function tilePolicyStorage(): TilePolicyStorage | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export class TileAccessPolicy {
    private states = new Map<string, TileAccessState>();
    private activeRequests = new Map<string, number>();
    private listeners = new Set<() => void>();
    private notificationQueued = false;
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener); return () => { this.listeners.delete(listener); };
    }
    private notify(): void {
        if (this.notificationQueued || !this.listeners.size) return;
        this.notificationQueued = true;
        void Promise.resolve().then(() => {
            this.notificationQueued = false;
            for (const listener of [...this.listeners]) listener();
        });
    }
    acquire(url: string, max = 4): (() => void) | null {
        const key = tileSourceKey(url), count = this.activeRequests.get(key) || 0;
        if (count >= max) return null;
        this.activeRequests.set(key, count + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const left = Math.max(0, (this.activeRequests.get(key) || 1) - 1);
            if (left) this.activeRequests.set(key, left); else this.activeRequests.delete(key);
            this.notify();
        };
    }
    constructor(private storage: TilePolicyStorage | null = tilePolicyStorage()) {
        try {
            const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(saved)) for (const entry of saved.slice(0, 32)) {
                if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !entry[1] || typeof entry[1] !== 'object') continue;
                const s = entry[1] as Partial<TileAccessState>;
                if (!['forbidden','rate-limit','unavailable','paused'].includes(String(s.kind)) ||
                    typeof s.until !== 'number' || !Number.isFinite(s.until) || s.until < 0 ||
                    typeof s.manual !== 'boolean' || typeof s.failures !== 'number' || !Number.isFinite(s.failures) ||
                    !(s.status === null || (typeof s.status === 'number' && Number.isInteger(s.status) && s.status >= 0 && s.status <= 599))) continue;
                this.states.set(entry[0], { kind: s.kind as TileAccessKind, status: s.status,
                    until: s.until, manual: s.manual, failures: Math.max(0, Math.min(20, s.failures)),
                    ...(typeof s.blockedReason === 'string' && s.blockedReason.trim() ? { blockedReason: s.blockedReason.trim().slice(0, 240) } : {}) });
            }
        } catch { /* Denied storage must not stop the game. */ }
    }
    private persist(): void {
        while (this.states.size > 32) this.states.delete(this.states.keys().next().value!);
        try { this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.states])); } catch { /* session-only protection */ }
        this.notify();
    }
    state(url: string, protocol: string, now = Date.now()): TileAccessState {
        // Local HTML uses an identified CORS fetch (see tileRequestOptions), not an anonymous Image request.
        if (isOSMStandard(url) && !['http:', 'https:', 'file:'].includes(protocol))
            return { kind: 'local-file', status: null, until: 0, manual: true, failures: 0 };
        const key = tileSourceKey(url), state = this.states.get(key);
        if (!state) return { ...READY };
        // Manual blocks deliberately survive time, reloads, style switches and successful old requests.
        if (!state.manual && now >= state.until) return { ...READY, failures: state.failures };
        return { ...state };
    }
    failure(url: string, status: number | null, retryAfter: string | null = null, now = Date.now(), blockedReason: string | null = null): TileAccessState {
        const key = tileSourceKey(url), old = this.states.get(key);
        if (old?.manual) return { ...old };
        const failures = Math.min(20, (old?.failures || 0) + 1);
        const reason = blockedReason?.trim().slice(0, 240);
        const forbidden = status === 401 || status === 403 || !!reason;
        const rateLimit = status === 429;
        const minimum = forbidden ? 15 * 60_000 : rateLimit ? 60_000 : Math.min(5 * 60_000, 30_000 * 2 ** (failures - 1));
        const state: TileAccessState = {
            kind: forbidden ? 'forbidden' : rateLimit ? 'rate-limit' : 'unavailable',
            status, until: Math.max(old?.until || 0, retryAfterDeadline(retryAfter, now, minimum)),
            manual: forbidden, failures, ...(reason ? { blockedReason: reason } : {}),
        };
        this.states.set(key, state); this.persist(); return { ...state };
    }
    success(url: string, protocol: string, now = Date.now()): void {
        const key = tileSourceKey(url);
        if (this.state(url, protocol, now).kind === 'ready' && this.states.has(key)) {
            this.states.delete(key); this.persist();
        }
    }
    pause(url: string): void {
        const key = tileSourceKey(url), old = this.states.get(key);
        // Pausing must not shorten a provider's Retry-After or erase a refusal.
        if (old?.kind === 'forbidden') return;
        this.states.set(key, { kind: 'paused', status: old?.status ?? null, until: old?.until || 0, manual: true, failures: old?.failures || 0 });
        this.persist();
    }
    resume(url: string, protocol: string, now = Date.now()): boolean {
        const state = this.state(url, protocol, now);
        if (state.kind === 'local-file' || now < state.until) return false;
        this.states.delete(tileSourceKey(url)); this.persist(); return true;
    }
}
export type BaseMapSource = { url: string; attribution: string; maxZoom: number };
export function validateBaseMapSource(input: BaseMapSource): BaseMapSource {
    const url = String(input.url).trim(), attribution = String(input.attribution).trim();
    if (url.length > 2048 || !['{z}', '{x}', '{y}'].every(k => url.includes(k)))
        throw new Error('Une URL XYZ contenant {z}, {x} et {y} est requise.');
    const parsed = new URL(url.replaceAll('{z}', '0').replaceAll('{x}', '0').replaceAll('{y}', '0'));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || /[{}]/.test(url.replace(/\{[zxy]\}/g, '')))
        throw new Error('Utiliser une URL HTTPS XYZ sans identifiants de connexion ni fragment.');
    if (isOSMStandard(url) && url !== OSM_STANDARD_URL)
        throw new Error('OSM standard exige son URL canonique, sans sous-domaine ni paramètre.');
    if (!attribution || attribution.length > 300) throw new Error('Une attribution lisible de 1 à 300 caractères est requise.');
    const maxZoom = Number(input.maxZoom);
    if (!Number.isInteger(maxZoom) || maxZoom < 1 || maxZoom > 20 || (isOSMStandard(url) && maxZoom > 19))
        throw new Error('Zoom source entier : 1 à 20, limité à 19 pour OSM standard.');
    return { url, attribution, maxZoom };
}

// All map editors in one browser origin share both access refusals and connection slots.
const sharedPolicies = new WeakMap<TilePolicyStorage, TileAccessPolicy>();
let volatilePolicy: TileAccessPolicy | null = null;
export function sharedTileAccessPolicy(storage = tilePolicyStorage()): TileAccessPolicy {
    if (!storage) return volatilePolicy || (volatilePolicy = new TileAccessPolicy(null));
    let policy = sharedPolicies.get(storage);
    if (!policy) { policy = new TileAccessPolicy(storage); sharedPolicies.set(storage, policy); }
    return policy;
}
