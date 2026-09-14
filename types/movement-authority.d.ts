export type MovementStatus = 'GO' | 'CAUTION' | 'STOP';
export interface MovementConstraintMeta {
    [key: string]: unknown;
}
export interface MovementConstraint {
    status: 'CAUTION' | 'STOP';
    limitKmh: number;
    code: string;
    reason: string;
    source: string;
    meta: MovementConstraintMeta | null;
}
export interface MovementDecision {
    status: MovementStatus;
    speedLimitKmh: number;
    code: string;
    reason: string;
    source: string;
    meta: MovementConstraintMeta | null;
    limitKmh?: number;
}
export interface PublishedMovementAuthority {
    status: MovementStatus;
    code: string;
    reason: string;
    source: string;
    speedLimitKmh: number;
    sequence: number;
}
export interface MovementAuthorityTrain {
    blockedBy: boolean;
    movementAuthority?: PublishedMovementAuthority;
    [key: string]: unknown;
}
export declare class MovementAuthority {
    readonly train: MovementAuthorityTrain | null;
    readonly constraints: MovementConstraint[];
    sequence: number;
    baseLimitKmh: number;
    constructor(train: MovementAuthorityTrain | null | undefined);
    begin(baseLimitKmh?: unknown): this;
    go(): this;
    caution(limitKmh: unknown, code?: string, reason?: string, source?: string, meta?: MovementConstraintMeta | null): this;
    stop(code?: string, reason?: string, source?: string, meta?: MovementConstraintMeta | null): this;
    limit(limitKmh: unknown, code?: string, reason?: string, source?: string, meta?: MovementConstraintMeta | null): this;
    private _decision;
    private _publish;
    decision(): MovementDecision;
}
