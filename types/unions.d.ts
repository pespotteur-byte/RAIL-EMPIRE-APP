import type { Economy } from './economy.js';
import type { RailEmpire } from './main.js';
import type { RandomSource } from './rng.js';
export declare class Unions {
    satisfaction: number;
    socialBonus: number;
    strikeActive: boolean;
    strikeEnd: number;
    strikeDaysLeft: number;
    strikePercent: number;
    _lastCheck: number;
    _strikeHistory: Array<{
        date: string;
        duration: number;
        cause: string;
        percent: number;
    }>;
    baseSalary: number;
    demands: string[];
    _lastDailyDate: string;
    constructor();
    /**
     * Daily update: compute satisfaction, check for strike risk.
     * Called at midnight from tick().
     */
    dailyUpdate(game: RailEmpire, rng?: RandomSource, settlementDate?: string): boolean;
    _startStrike(game: RailEmpire, rng?: RandomSource): void;
    _endStrike(): void;
    /**
     * Should this service be blocked by strike?
     * Uses service id hash to deterministically block a consistent set.
     */
    isServiceBlocked(serviceId: string): boolean;
    _generateDemands(game: unknown, opts?: {
        overworkCount?: number;
        weeklyViolationCount?: number;
        avgSocialRisk?: number;
    }): void;
    /**
     * Negotiate: spend money to boost satisfaction.
     */
    negotiate(economy: Economy, type: string): boolean;
    render(container: HTMLElement, game: RailEmpire): void;
    toSave(): {
        satisfaction: number;
        socialBonus: number;
        strikeActive: boolean;
        strikeDaysLeft: number;
        strikePercent: number;
        _strikeHistory: {
            date: string;
            duration: number;
            cause: string;
            percent: number;
        }[];
        _lastDailyDate: string;
    };
    loadFromSave(s: __S3Struct1016): void;
}
type __S3Struct1016 = {
    socialBonus?: unknown;
    "satisfaction": unknown;
    "strikeDaysLeft": unknown;
    "strikePercent": unknown;
    "strikeActive": boolean;
    "_lastDailyDate": string;
    "_strikeHistory": unknown;
};
export {};
