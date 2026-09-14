/** Constant-memory processing cursor. The real clock is the target, not the
 * timestamp supplied to every overdue callback. No time is discarded. */
export type ChronologicalSnapshot = {
    version: 1;
    cursorMs: number;
    targetMs: number;
    minuteEpoch: number | null;
    secondEpoch: number | null;
    failed: string;
};
export declare class ChronologicalClock {
    cursorMs: number;
    minuteEpoch: number | null;
    secondEpoch: number | null;
    targetMs: number;
    failed: string;
    constructor(raw?: unknown, fallbackMs?: number, nowMs?: number);
    get debtSeconds(): number;
    snapshot(): ChronologicalSnapshot;
    /** Event order at a boundary: minute, second, then physical motion. One
     * failing callback freezes the cursor, rather than skipping or auto-retrying
     * a possibly partially applied operation. The caller must surface the error. */
    advance(nowMs: number, handlers: {
        minute(ms: number): void;
        second(ms: number): void;
        move(dt: number, ms: number): void;
    }, maxSteps?: number, budgetMs?: number): number;
}
