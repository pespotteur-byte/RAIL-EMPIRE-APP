/** Scheduled stop eligibility. Never infer an operating stop from the nearest
 * station: a train stopped at a red signal must not acquire passenger incidents. */
export interface IncidentScheduledStop {
    stationId?: unknown;
    type?: unknown;
    stopCode?: unknown;
    technicalLocationId?: unknown;
    locationOccurrenceId?: unknown;
    lat?: unknown;
    lon?: unknown;
}
export interface IncidentStopService {
    state?: string;
    speed?: number;
    completed?: boolean;
    cancelled?: boolean;
    currentStopIndex?: number;
    stops?: IncidentScheduledStop[];
    getCurrentStops?: () => IncidentScheduledStop[];
    position?: {
        lat?: number;
        lon?: number;
    } | null;
    train?: {
        stoppedAt?: unknown;
        speed?: unknown;
    };
}
export declare function bookedIncidentStop(service: IncidentStopService): IncidentScheduledStop | null;
