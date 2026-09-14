export interface ForecastStop {
    stationId: unknown;
    type?: unknown;
    departureTime?: number | null;
    arrivalTime?: number | null;
    platform?: unknown;
    stopCode?: unknown;
}
export interface ForecastService {
    id: string;
    stops: readonly ForecastStop[];
    returnStops?: readonly ForecastStop[];
    roundTrip?: boolean;
    multiDepartures?: number;
    terminusWait?: number;
    runDays?: readonly number[];
    runDates?: readonly string[];
    operatingDay?: string;
    completedDay?: string;
    completed?: boolean;
    isReturnLeg?: boolean;
    tripCount?: number;
    currentStops?: readonly ForecastStop[];
}
export interface ForecastRun {
    key: string;
    day: string;
    isReturn: boolean;
    live: boolean;
    stops: ForecastStop[];
}
/** Read-only forecasts, not invented runtime services. Weekdays and explicit dates both apply. */
export declare function legacyBoardRuns(service: ForecastService, date: string, now: number, horizon: number): ForecastRun[];
