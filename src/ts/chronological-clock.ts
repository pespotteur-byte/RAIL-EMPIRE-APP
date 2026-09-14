/** Constant-memory processing cursor. The real clock is the target, not the
 * timestamp supplied to every overdue callback. No time is discarded. */
export type ChronologicalSnapshot = {
    version: 1; cursorMs: number; targetMs: number; minuteEpoch: number | null; secondEpoch: number | null; failed: string;
};
export class ChronologicalClock {
    cursorMs: number;
    minuteEpoch: number | null = null;
    secondEpoch: number | null = null;
    targetMs: number;
    failed = '';
    constructor(raw: unknown = null, fallbackMs = Date.now(), nowMs = Date.now()) {
        const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && Number.isFinite(new Date(n).getTime());
        // A complete snapshot can retain its cursor after a backwards wall-clock correction.
        const hasTarget = valid(value.targetMs) && valid(value.cursorMs) && value.targetMs >= value.cursorMs;
        const saved = value.version === 1 && valid(value.cursorMs) && (value.cursorMs <= nowMs || hasTarget);
        this.cursorMs = saved ? value.cursorMs as number : (valid(fallbackMs) && fallbackMs <= nowMs ? fallbackMs : nowMs);
        this.targetMs = Math.max(nowMs, this.cursorMs, saved && hasTarget ? value.targetMs as number : 0);
        if (saved && typeof value.failed === 'string') this.failed = value.failed.slice(0, 2000);
        if (saved) {
            const minute = Math.floor(this.cursorMs / 60000), second = Math.floor(this.cursorMs / 1000);
            if (value.minuteEpoch === minute) this.minuteEpoch = minute;
            if (value.secondEpoch === second) this.secondEpoch = second;
        }
    }
    get debtSeconds(): number { return Math.max(0, this.targetMs - this.cursorMs) / 1000; }
    snapshot(): ChronologicalSnapshot { return {version:1,cursorMs:this.cursorMs,targetMs:this.targetMs,minuteEpoch:this.minuteEpoch,secondEpoch:this.secondEpoch,failed:this.failed}; }
    /** Event order at a boundary: minute, second, then physical motion. One
     * failing callback freezes the cursor, rather than skipping or auto-retrying
     * a possibly partially applied operation. The caller must surface the error. */
    advance(nowMs: number, handlers: {
        minute(ms: number): void; second(ms: number): void; move(dt: number, ms: number): void;
    }, maxSteps = 50, budgetMs = 12): number {
        if (this.failed || !Number.isFinite(nowMs)) return 0;
        this.targetMs = Math.max(this.targetMs, nowMs);
        const started = performance.now();
        let count = 0;
        const events = () => {
            const minute = Math.floor(this.cursorMs / 60000), second = Math.floor(this.cursorMs / 1000);
            if (minute !== this.minuteEpoch) { handlers.minute(this.cursorMs); this.minuteEpoch = minute; }
            if (second !== this.secondEpoch) { handlers.second(this.cursorMs); this.secondEpoch = second; }
        };
        try {
            events();
            while (count < Math.max(1, Math.floor(maxSteps)) && this.targetMs > this.cursorMs) {
                // Finish at exact second boundaries even for imported subsecond saves.
                const nextBoundary = (Math.floor(this.cursorMs / 1000) + 1) * 1000;
                const dtMs = Math.min(100, nextBoundary - this.cursorMs);
                if (this.targetMs - this.cursorMs < dtMs) break;
                handlers.move(dtMs / 1000, this.cursorMs);
                this.cursorMs += dtMs; count++;
                events();
                if (performance.now() - started >= Math.max(0, budgetMs)) break;
            }
        } catch (error) {
            this.failed = error instanceof Error ? error.message : String(error);
            throw error;
        }
        return count;
    }
}
