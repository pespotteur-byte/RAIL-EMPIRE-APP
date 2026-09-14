/** Recent subsystem failures. Historical counters are not a diagnosis of current
 * health; recording must never throw, retain Error graphs, or flood the console.
 */
export type OperationalFailure = {
    code: string;
    count: number;
    firstAt: number;
    lastAt: number;
    message: string;
    lastLoggedAt: number;
};
export declare class OperationalDiagnostics {
    readonly maxEntries: number;
    readonly logIntervalMs: number;
    private entries;
    constructor(maxEntries?: number, logIntervalMs?: number);
    record(code: string, error: unknown, now?: number): void;
    snapshot(): OperationalFailure[];
    clear(): void;
}
