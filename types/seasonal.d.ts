type SeasonMode = 'normal' | 'summer' | 'winter';
interface SeasonDate {
    month: number;
    day: number;
}
interface SeasonConfig {
    active?: boolean;
    freq?: number;
}
type ServiceSeasonOverrides = Partial<Record<SeasonMode, SeasonConfig>>;
type PeakService = Record<string, unknown> & {
    id: string;
    frequency?: number;
};
interface SeasonalService {
    id?: string;
    name?: string;
    _v2ScheduleId?: string;
    [key: string]: unknown;
}
interface SeasonalGame {
    scheduleCreator?: {
        services?: SeasonalService[];
        _invalidateActiveCache?: () => unknown;
    };
    scheduleV2Runtime?: {
        forceSync?: (timeOfDay: number, date?: string) => unknown;
    };
    timeOfDay?: number;
    _currentDate?: string;
    engine?: {
        getParisDate?: () => string;
    };
    saveState?: () => unknown;
}
/**
 * SeasonalSchedule — Summer/winter timetable system.
 * Manages timetable grids and automatic switching.
 */
export declare class SeasonalSchedule {
    mode: SeasonMode;
    autoSwitch: boolean;
    summerStart: SeasonDate;
    summerEnd: SeasonDate;
    _lastMode: SeasonMode;
    serviceOverrides: Record<string, ServiceSeasonOverrides>;
    peakServices: PeakService[];
    constructor();
    checkSeason(dateStr: string | null | undefined): void;
    isServiceActive(serviceId: string): boolean;
    getFrequencyMultiplier(serviceId: string): number;
    setOverride(serviceId: string, season: SeasonMode, config: SeasonConfig): void;
    addPeakService(serviceConfig: Record<string, unknown>): void;
    render(container: HTMLElement | null, game: SeasonalGame): void;
    toSave(): {
        mode: SeasonMode;
        autoSwitch: boolean;
        summerStart: SeasonDate;
        summerEnd: SeasonDate;
        serviceOverrides: Record<string, ServiceSeasonOverrides>;
        peakServices: PeakService[];
    };
    loadFromSave(rawSave: unknown): void;
}
export {};
