/** Directional, route-relative virtual signals. This is the game's block model,
 * not an assertion that these are the surveyed positions of real OSM signals. */
export interface SignalAssignment {
    cantonId: string;
    startIndex: number;
    endIndex: number;
    startKm: number;
    endKm: number;
    trackSig: string;
    resourceIds: string[];
}
export interface SignalRouteService {
    id: string | number;
    active?: boolean;
    completed?: boolean;
    cancelled?: boolean;
    _cantonAssignments?: SignalAssignment[] | null;
    _state?: {
        cachedRoute?: Array<{
            lat: number;
            lon: number;
        }> | null;
        index?: number;
        progress?: number;
    } | null;
}
export interface SignalBounds {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}
export interface SignalReader {
    getEntrySignalAspect(assignments: SignalAssignment[], index: number, trainId: unknown): 0 | 30 | null;
}
export declare function displayBlockSignals(services: readonly SignalRouteService[], manager: SignalReader, bounds: SignalBounds): {
    lat: number;
    lon: number;
    heading: number;
    aspect: 0 | 30 | null;
}[];
