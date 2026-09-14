/** Stable station resources. Player-facing names are deliberately not identifiers. */
export interface StationTrackIdentity {
    kind: 'native' | 'osm';
    id: string;
    trackRef: string;
    lat: number | null;
    lon: number | null;
}
export interface NativeStationTrack {
    id: string;
    stationId: string | null;
    occupiedBy?: string | null;
    voie: string;
    lat: number;
    lon: number;
}
export declare function canonicalTrackRef(value: unknown): string;
export declare function normalizeStationTrackIdentity(value: unknown): StationTrackIdentity | null;
export declare function stationTrackIdentityFromBinding(value: unknown): StationTrackIdentity | null;
export declare function stationTrackResourceKey(identity: StationTrackIdentity): string;
/** Only native ID, real OSM ref or a unique <= 2 m snap may bridge to native tracks. */
export declare function resolveNativeStationTrack<T extends NativeStationTrack>(identity: StationTrackIdentity, stationId: string, tracks: readonly T[]): T | null;
