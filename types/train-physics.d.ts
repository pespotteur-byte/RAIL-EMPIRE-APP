export type WeatherCondition = string | null | undefined;
export interface ElectricSystem {
    voltage?: unknown;
    frequency?: unknown;
}
export interface TrainPhysicsParams {
    massKg: number;
    powerW: number;
    lengthM?: number;
    weather?: WeatherCondition;
    adhesionMassKg?: number;
    brakeServiceMs2?: number;
    brakeBuildSec?: number;
    electricPowerW?: number;
    dieselPowerW?: number;
    electricSystems?: ElectricSystem[];
}
export interface SimulationParams extends TrainPhysicsParams {
    startMs?: number;
    endMs?: number;
    preBrakeMarginM?: number;
    dsStep?: number;
    collectSegmentTimes?: boolean;
    /** Smaller values are useful for deterministic workspace stress tests. */
    workspaceCellLimit?: number;
}
export interface RoutePoint {
    lat: number;
    lon: number;
    maxSpeed?: unknown;
    maxSpeedSource?: unknown;
    maxSpeedForward?: unknown;
    maxSpeedBackward?: unknown;
    travelDirection?: string;
    incline?: unknown;
    tags?: {
        incline?: unknown;
        [key: string]: unknown;
    };
    electrified?: boolean | null;
    voltage?: unknown[];
    frequency?: unknown[];
    [key: string]: unknown;
}
export interface PhysicsSegment {
    distM: number;
    limitMs: number;
    gradePermille?: number;
    electrified?: boolean | null;
    voltage?: unknown[];
    frequency?: unknown[];
    sourceIndex?: number;
}
export interface SimulationResult {
    timeSec: number;
    distM: number;
    vMaxReachedMs: number;
    segmentTimeSec: number[];
}
export type HaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => number;
export declare function weatherAdhesion(weather: WeatherCondition): number;
export declare function resistanceN(massKg: number, vMs: number, gradePermille?: number, lengthM?: number): number;
export declare function tractiveEffortN(powerW: number, vMs: number, adhesionMassKg: number, weather: WeatherCondition): number;
export declare function accelerationMs2(params: TrainPhysicsParams, vMs: number, gradePermille?: number): number;
export declare function brakingDecelMs2(params: TrainPhysicsParams, weather: WeatherCondition, gradePermille?: number): number;
export declare function brakingDistanceM(v0Ms: number, vTargetMs: number, decelMs2: number): number;
export declare function segmentsFromRoute(route: RoutePoint[], rameMaxSpeedKmh: number, haversineKm: HaversineKm): PhysicsSegment[];
export declare const MAX_PROFILE_WORKSPACE_CELLS = 20000;
/** Diagnostics describe numerical cell storage, not route metadata or output arrays. */
export declare function getLastProfileWorkspaceStats(): {
    streamed: boolean;
    totalCells: number;
    residentCells: number;
    cellStorageBytes: number;
    windows: number;
};
export declare function simulateProfile(segments: PhysicsSegment[], params?: SimulationParams): SimulationResult;
export declare const _units: {
    G: number;
    KMH_TO_MS: number;
    MS_TO_KMH: number;
};
