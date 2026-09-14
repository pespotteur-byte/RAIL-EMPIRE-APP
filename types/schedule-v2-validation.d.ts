import { ValidationReport } from './schedule-v2-model.js';
import type { ScheduleVersion } from './schedule-v2-model.js';
interface ValidationOptions {
    ormAvailable?: boolean;
}
export declare function validateScheduleVersion(version: ScheduleVersion | null | undefined, { ormAvailable }?: ValidationOptions): ValidationReport;
export declare function applyValidationState(version: ScheduleVersion, report: ValidationReport): string;
export {};
