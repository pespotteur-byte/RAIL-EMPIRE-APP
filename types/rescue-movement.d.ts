import { ActiveService } from './schedule-creator.js';
import { Rame } from './rame.js';
type Route = Parameters<ActiveService['_initializeState']>[0];
export type RescueMotionSnapshot = {
    version: 1;
    returning: boolean;
    index: number;
    progress: number;
    distance: number;
    speed: number;
    brakeEffort: number;
    tractiveEffort: number;
    physicsDecelMs2?: number;
    carryover: Array<string | number>;
    carryoverStartKm: number;
    occupiedTroncons: Array<string | number>;
    tronconExits: Array<[string | number, number]>;
    lastTroncon: string | number | null;
    consumables: Rame['consumables'];
};
/** Reject a corrupt physical snapshot as a whole. Never turn bad progress
 * into a plausible teleport, or drop saved tail locks to make motion succeed. */
export declare function validRescueMotion(value: unknown): RescueMotionSnapshot | null;
/** The DDS does not have a second motion integrator. It is an ActiveService
 * with two technical endpoints and no passenger/freight booking at arrival.
 * Its train length/mass include the hauled consist; power is locomotive-only. */
export declare class RescueMovement extends ActiveService {
    arrived: boolean;
    returning: boolean;
    routeIdentity: Route | null;
    private readonly locomotiveLength;
    private readonly locomotiveMass;
    private readonly locomotiveMaxSpeed;
    private hauledMass;
    private hauledLength;
    private phaseLimit;
    private originalRameMaxSpeed;
    constructor(id: string, material: Rame, world: unknown, weather: unknown);
    setPhaseLimit(kmh: number): void;
    configure(route: Route, position: {
        lat: number;
        lon: number;
    }, returning: boolean, hauled: ActiveService | null, snapshot?: RescueMotionSnapshot): void;
    _reserveArrivalResources(): boolean;
    _yieldToRescue(): boolean;
    _updateStuckTimer(): boolean;
    _cancelBlockedService(): boolean;
    _startAlternateRouteSearch(): void;
    _updateContinuousDelay(): void;
    _safetyCandidatePool(allServices: unknown, radiusKm?: number): ActiveService[];
    arriveAtStation(): void;
    _trackWear(km: number): void;
    snapshot(): RescueMotionSnapshot;
}
export {};
