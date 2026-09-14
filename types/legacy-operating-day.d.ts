export declare function civilDayIndex(value: unknown): number | null;
export interface LegacyDayQuery {
    date: string;
    minute: number;
    departure: number;
    maxRuntime: number;
    weekdays: readonly number[];
    dates: readonly string[];
    pinnedDay?: string;
    completedDay?: string;
}
export declare function resolveLegacyOperatingDay(q: LegacyDayQuery): string | null;
