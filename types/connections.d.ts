import type { ActiveService } from './schedule-creator.js';
import type { RailEmpire } from './main.js';
type WaitPolicy = 'strict' | 'moderate' | 'flexible';
type TransferConfig = {
    id: string;
    fromServiceId: string;
    toServiceId: string;
    stationId: string;
    minTransferTime: number;
    waitTime: number;
};
type TransferStats = {
    totalTransfers: number;
    successfulTransfers: number;
    missedTransfers: number;
};
type PendingTransfer = Record<string, unknown>;
type ConnectionStop = {
    stationId?: string;
    technicalLocationId?: string;
    type?: string;
    arrivalTime?: number;
    departureTime?: number;
    locationOccurrenceId?: string;
};
type ConnectionService = {
    id: string;
    name?: string;
    state?: string;
    active?: boolean;
    completed?: boolean;
    cancelled?: boolean;
    currentStopIndex?: number;
    stops?: ConnectionStop[];
    getCurrentStops?: () => ConnectionStop[];
    train?: {
        delay?: number;
        stoppedAt?: {
            id?: unknown;
        };
        _stoppedSinceGameTime?: number | null;
    };
    delay?: number;
    _v2BaseDate?: string;
    _v2OccurrenceId?: string;
    _currentDate?: string;
    _tripCount?: number;
    isReturnLeg?: boolean;
};
type ConnectionArrival = {
    key: string;
    serviceId: string;
    stationId: string;
    at: number;
};
type ConnectionSettlement = {
    key: string;
    at: number;
};
/**
 * Connections — Passenger transfer/correspondence system.
 * Tracks transfers between services at shared stations.
 */
export declare class Connections {
    transfers: TransferConfig[];
    waitPolicy: WaitPolicy;
    stats: TransferStats;
    _pendingTransfers: PendingTransfer[];
    arrivals: ConnectionArrival[];
    settled: ConnectionSettlement[];
    constructor();
    /**
     * Define a connection between two services at a station.
     */
    addTransfer(fromServiceId: string, toServiceId: string, stationId: string): TransferConfig | null;
    removeTransfer(id: string): void;
    _getWaitTime(): number;
    /**
     * Check if a connecting service should wait for an arriving service.
     * Called from schedule tick when a service is at a station.
     */
    _clock(currentTime: unknown, dateStr?: string): number;
    _booked(service: ConnectionService, value: unknown, now: number): number;
    _stopForDeparture(service: ConnectionService): ConnectionStop | undefined;
    _prune(now: number): void;
    _evaluate(transfer: TransferConfig, receiver: ConnectionService | undefined, stop: ConnectionStop | undefined, now: number, services: ConnectionService[]): {
        bookedDep: number;
        success: boolean;
        waiting: boolean;
    };
    /** A bounded hold relative to BOOKED departure, never a sliding five minutes. */
    shouldWait(serviceId: string, stationId: string, currentTime: unknown, services: unknown, dateStr?: string): boolean;
    onArrival(service: ConnectionService, stop: ConnectionStop, currentTime: unknown, dateStr?: string): void;
    onDeparture(service: ConnectionService, stop: ConnectionStop, currentTime: unknown, dateStr: string | undefined, services: unknown): void;
    /**
     * Record a transfer event.
     */
    recordTransfer(fromServiceId: string, toServiceId: string, stationId: string, success: unknown): void;
    /**
     * Auto-detect possible connections based on shared stations and compatible times.
     */
    autoDetect(services: ActiveService[], world: unknown): {
        fromServiceId: string;
        fromName: string;
        toServiceId: string;
        toName: string;
        stationId: string;
        transferTime: number;
    }[];
    render(container: HTMLElement, game: RailEmpire): void;
    toSave(): {
        transfers: TransferConfig[];
        waitPolicy: WaitPolicy;
        stats: TransferStats;
        arrivals: ConnectionArrival[];
        settled: ConnectionSettlement[];
    };
    loadFromSave(s: unknown): void;
}
export {};
