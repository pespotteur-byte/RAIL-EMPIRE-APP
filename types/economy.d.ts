import type { Rame } from './rame.js';
type CountryRateMap = Record<string, number>;
import type { ActiveService } from './schedule-creator.js';
export declare class Economy {
    balance: number;
    revenue: number;
    expenses: number;
    penalties: number;
    history: Array<Record<string, unknown>>;
    ticketPricePerKm: number;
    freightPricePerTKm: number;
    passengerPriceByClass: CountryRateMap;
    dailyProcessed: Record<string, boolean>;
    totalPassengers: number;
    totalFreightTonnes: number;
    revenueByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    lineRevenue: Record<string, number>;
    lineExpense: Record<string, number>;
    dailySnapshots: Array<Record<string, unknown>>;
    _currentDayKey: string | null;
    _currentDayRevenue: number;
    _currentDayExpenses: number;
    _currentDayByCategory: Record<string, number>;
    totalTicketsSold: number;
    totalTicketRevenue: number;
    totalFraudFines: number;
    fraudRate: number;
    _companyLogo: string | null;
    _lastBulletinDate: string | null;
    historyInheritedTruncation: boolean;
    private _transactionTime;
    passengerSatisfactionSamples: number;
    passengerSatisfactionPoints: number;
    get passengerSatisfaction(): number | null;
    constructor();
    addRevenue(amount: number, category: string, description: unknown): boolean;
    addExpense(amount: number, category: string, description: unknown): boolean;
    addPenalty(amount: number, description: unknown): boolean;
    getPassengerPricePerKm(maxSpeed?: number): number;
    processServiceRevenue(service: unknown): void;
    /**
     * Péage infrastructure (redevance d'utilisation des voies).
     * Dépend de la distance, du pays, de la vitesse max de la ligne, du nombre
     * de voies, de l'électrification, et de la masse du convoi.
     */
    _calcInfrastructureToll(distanceKm: number, route: Array<{
        maxSpeed?: number;
        tracks?: number;
        electrified?: unknown;
        usage?: unknown;
    }>, rame: Rame, country?: string): number;
    /**
     * Process revenue at each station stop.
     * - Passengers: some descend (revenue for their trip), new ones board
     * - Freight: some unloaded (revenue), new freight loaded
     */
    processStopRevenue(service: ActiveService, stationName: string, distFromPrev: number, isFirst: boolean, isTerminus: boolean, stationId: string, legRoute: Array<{
        maxSpeed?: number;
        tracks?: number;
        electrified?: unknown;
        usage?: unknown;
    }>): void;
    _rameCargoType(rame: Rame): string | null;
    processDailyCharges(services: ActiveService[], depots: Array<{
        getMaintenanceCost?: () => number;
        tracks: number;
        name: string;
    }> | null | undefined, dateKey: string): void;
    getEffectiveFraudRate(hasControleur: boolean): number;
    getRevenueBreakdown(): {
        [x: string]: number;
    };
    getExpenseBreakdown(): {
        [x: string]: number;
    };
    addLineRevenue(lineId: string, amount: number): void;
    addLineExpense(lineId: string, amount: number): void;
    getLineProfitability(lineId: string): {
        revenue: number;
        expense: number;
        profit: number;
        margin: number;
    };
    formatAmount(n: number): string;
    toSave(): {
        balance: number;
        revenue: number;
        expenses: number;
        penalties: number;
        ticketPricePerKm: number;
        freightPricePerTKm: number;
        passengerPriceByClass: {
            [x: string]: number;
        };
        history: {
            [x: string]: unknown;
        }[];
        historyVersion: number;
        historyInheritedTruncation: boolean;
        dailyProcessed: Record<string, boolean>;
        totalPassengers: number;
        passengerSatisfactionSamples: number;
        passengerSatisfactionPoints: number;
        totalFreightTonnes: number;
        _companyLogo: string | null;
        _lastBulletinDate: string | null;
        revenueByCategory: Record<string, number>;
        expenseByCategory: Record<string, number>;
        lineRevenue: Record<string, number>;
        lineExpense: Record<string, number>;
        dailySnapshots: {
            [x: string]: unknown;
        }[];
        totalTicketsSold: number;
        totalTicketRevenue: number;
        totalFraudFines: number;
        fraudRate: number;
        _currentDayKey: string | null;
        _currentDayRevenue: number;
        _currentDayExpenses: number;
        _currentDayByCategory: Record<string, number>;
    };
    loadFromSave(s: unknown): void;
}
export {};
