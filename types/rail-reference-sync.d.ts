import type { World } from './world.js';
export declare const SERVED_RAIL_COUNTRIES: readonly ("FR" | "DE" | "IT" | "ES" | "BE" | "NL" | "CH" | "AT" | "GB" | "PL" | "CZ" | "HU" | "RO" | "SE" | "NO" | "DK" | "PT" | "FI" | "IE" | "LU" | "SI" | "SK" | "HR" | "GR" | "BG" | "LT" | "LV" | "EE" | "RS" | "BA" | "MK" | "AL" | "BY" | "ME" | "NZ" | "RU" | "UA" | "CY" | "MT")[];
declare function referencePointFromCompactRow(row: unknown, source: string): RailReferencePoint | null;
type OverpassElement = {
    type?: string;
    id?: number | string;
    lat?: number;
    lon?: number;
    center?: {
        lat?: number;
        lon?: number;
    };
    tags?: Record<string, string | undefined>;
};
type RailReferencePoint = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    country: string;
    type: 'voyageur' | 'marchandise' | 'ite';
    platforms: number;
    facilities: string[];
    source: string;
    siteKind: string;
    cargoTags: string[];
    official: boolean;
    osmType?: string;
    osmId?: string;
    uicRef?: string;
    ref?: string;
    operator?: string;
    network?: string;
    wikidata?: string;
    wheelchair?: string;
};
export type RailReferenceSyncProgress = {
    phase: string;
    iso?: string;
    index?: number;
    totalCountries?: number;
    totalShards?: number;
    stations?: number;
    freightSites?: number;
    added?: number;
    enriched?: number;
    message?: string;
};
declare function stationFromElement(el: OverpassElement, iso: string): RailReferencePoint | null;
declare function freightSiteFromElement(el: OverpassElement, iso: string): RailReferencePoint | null;
type GeoPoint = {
    lat: number;
    lon: number;
    type?: string;
};
declare function mergeSiteRecords(points: RailReferencePoint[], anchors?: readonly GeoPoint[]): RailReferencePoint[];
declare function stationQuery(iso: string): string;
declare function freightQuery(iso: string): string;
declare function parseFranceIte3000(data: unknown): RailReferencePoint[];
export declare class RailReferenceSync {
    private db;
    private running;
    private franceOfficial;
    loadEmbeddedIntoWorld(world: World, onProgress?: ((p: RailReferenceSyncProgress) => void) | null): Promise<{
        stations: number;
        freightSites: number;
        shards: number;
    }>;
    loadCachedIntoWorld(world: World, onProgress?: ((p: RailReferenceSyncProgress) => void) | null): Promise<{
        stations: number;
        freightSites: number;
        countries: number;
    }>;
    fetchFranceOfficialITE(): Promise<RailReferencePoint[]>;
    syncAll(world: World, onProgress?: ((p: RailReferenceSyncProgress) => void) | null, force?: boolean): Promise<{
        countries: number;
        stations: number;
        freightSites: number;
        errors: number;
    }>;
}
export declare const __railReferenceTest: {
    stationFromElement: typeof stationFromElement;
    freightSiteFromElement: typeof freightSiteFromElement;
    mergeSiteRecords: typeof mergeSiteRecords;
    parseFranceIte3000: typeof parseFranceIte3000;
    stationQuery: typeof stationQuery;
    freightQuery: typeof freightQuery;
    referencePointFromCompactRow: typeof referencePointFromCompactRow;
};
export {};
