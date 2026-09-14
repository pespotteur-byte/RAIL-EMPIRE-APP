import { type RoutePoint, type TrainPhysicsParams } from './train-physics.js';
type TimingWeather = string | {
    current?: unknown;
    type?: unknown;
    condition?: unknown;
} | null;
interface ElectricSystemLike {
    voltage?: unknown;
    frequency?: unknown;
}
interface TimingProfile {
    maxSpeed?: number;
    massKg?: number;
    powerW?: number;
    electricPowerW?: number;
    dieselPowerW?: number;
    electricSystems?: ElectricSystemLike[];
    traction?: string;
    lengthM?: number;
    adhesionMassKg?: number;
    brakeServiceMs2?: number;
    brakeBuildSec?: number;
    gauges?: unknown[];
    loadingGauge?: string;
    axleLoad?: number | null;
    metreLoad?: number | null;
    toPhysicsParams?: () => TrainPhysicsParams;
}
interface TimingLeg {
    fromLocationId?: unknown;
    toLocationId?: unknown;
    routePoints?: RoutePoint[];
    physicsRouteKey?: unknown;
    routeInputKey?: unknown;
    distanceKm?: unknown;
    physicalTravelSec?: number;
    physicalTravelSignature?: string;
    [key: string]: unknown;
}
interface PhysicalTravelOptions {
    weather?: TimingWeather;
    startMs?: number;
    endMs?: number;
    preBrakeMarginM?: number;
}
interface RecalculateTimingOptions {
    firstDepartureSec?: number | null;
    weather?: TimingWeather;
}
export declare function calculatePhysicalTravelSeconds(route: RoutePoint[], profile: TimingProfile, opts?: PhysicalTravelOptions): number;
export declare function physicalTravelSecondsForLeg(leg: TimingLeg, profile: TimingProfile, { weather }?: RecalculateTimingOptions): number;
export declare function recalculateScheduleTiming<T>(version: T, { firstDepartureSec, weather }?: RecalculateTimingOptions): T;
export declare function shiftScheduleFromLocation<T>(version: T, locationIndex: number, deltaSec: number): T;
export {};
