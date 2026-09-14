import type { RailEmpire } from './main.js';
import type { ScheduleVersion as ScheduleVersionType } from './schedule-v2-model.js';
import { ScheduleV2Router } from './schedule-v2-routing.js?v=1144';
export declare class ScheduleV2Revalidator {
    game: RailEmpire;
    router: ScheduleV2Router;
    running: boolean;
    lastRun: string | null;
    deferred: boolean;
    constructor(game: RailEmpire);
    _networkFailure(err?: unknown): boolean;
    _rebuildVersion(ver: ScheduleVersionType): Promise<{
        ok: boolean;
        reason: string;
        preserved: boolean;
        report?: undefined;
    } | {
        ok: boolean;
        reason: any;
        report: any;
        preserved: boolean;
    } | {
        ok: boolean;
        report: any;
        preserved: boolean;
        reason?: undefined;
    }>;
    run(): Promise<{
        running: boolean;
        deferred?: undefined;
        reason?: undefined;
        checked?: undefined;
        repaired?: undefined;
        needsRepair?: undefined;
        error?: undefined;
    } | {
        deferred: boolean;
        reason: string;
        running?: undefined;
        checked?: undefined;
        repaired?: undefined;
        needsRepair?: undefined;
        error?: undefined;
    } | {
        deferred: boolean;
        checked: number;
        repaired: number;
        needsRepair: number;
        error: string;
        running?: undefined;
        reason?: undefined;
    } | {
        deferred: boolean;
        checked: number;
        repaired: number;
        needsRepair: number;
        running?: undefined;
        reason?: undefined;
        error?: undefined;
    }>;
}
export default ScheduleV2Revalidator;
