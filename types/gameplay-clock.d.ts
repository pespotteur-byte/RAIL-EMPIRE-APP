/** Persisted processing ledger, NOT a replacement for the real Paris game clock.
 * Durations use elapsed real minutes (DST-safe); daily settlements use civil dates.
 * A legacy save starts from its save date: no invented charges before that date.
 */
export declare class GameplayClock {
    lastUpdateMs: number;
    dailyDate: string;
    completedTasks: Record<string, string>;
    freightGenerationMinute: number;
    static validDate(value: unknown): value is string;
    static parisDate(ms: number): string;
    load(raw: unknown, legacySaveTime?: unknown): void;
    advance(date: string, nowMs?: number): {
        elapsedMinutes: number;
        dailyDates: string[];
    };
    runDailyTask(key: string, date: string, task: () => void): void;
    markSettled(date: string): void;
    toSave(): {
        lastUpdateMs: number;
        dailyDate: string;
        completedTasks: {
            [x: string]: string;
        };
        freightGenerationMinute: number;
    };
}
