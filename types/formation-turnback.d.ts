/** Explicit game-model cab changes. A time allowance is not a run-around path. */
export declare const CAB_CHANGE_SECONDS = 300;
export interface TurnbackElement {
    category?: unknown;
    power?: unknown;
    isDrivingTrailer?: unknown;
    hasCab?: unknown;
    flipped?: unknown;
    physicalVehicleId?: unknown;
    elementId?: unknown;
    catalogId?: unknown;
}
export type TurnbackMode = 'cab_change' | 'runaround_required' | 'missing_traction' | 'unknown_formation';
export interface TurnbackAssessment {
    allowed: boolean;
    mode: TurnbackMode;
    reason: string;
    signature: string;
}
export interface TurnbackState {
    key: string;
    signature: string;
    startedAtSec: number | null;
    readyAtSec: number | null;
    applied: boolean;
    mode: TurnbackMode;
}
export declare function assessTurnback(elements: readonly TurnbackElement[], reverse?: boolean): TurnbackAssessment;
export declare function normalizeTurnbackState(value: unknown): TurnbackState | null;
