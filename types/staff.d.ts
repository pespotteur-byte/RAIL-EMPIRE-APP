type __KPStruct677 = {
    "shiftGroup"?: unknown;
};
type __KPStruct681 = {
    "onLeave": unknown;
    "absenceRemainingDays": number;
    "busyTaskId": unknown;
    "trainingRemainingDays": number;
    "role": unknown;
    "assignedTo": unknown;
    "leaveDaysRemaining": unknown;
    "leaveRemainingDays": unknown;
    "leavePending": unknown;
    "onDuty": unknown;
    "available": unknown;
    "id": unknown;
    "name": unknown;
    "nextLeaveDate": unknown;
};
import type { Economy } from './economy.js';
import type { RandomSource } from './rng.js';
type StaffRoleDefinition = {
    label: string;
    salary: number;
    hiringCost: number;
    assignTo: string;
    department: string;
    category: string;
    description: string;
    depotRole?: boolean;
};
type HRIncidentDefinition = {
    label: string;
    minDays: number;
    maxDays: number;
    baseChance: number;
};
type StaffTrainingDefinition = {
    label: string;
    days: number;
    cost: number;
    skillGain: number;
    satisfactionGain: number;
    description: string;
    roles?: string[];
    dynamic?: boolean;
    validityDays?: number;
};
type StaffServiceStop = {
    stationId?: string;
    departureTime?: unknown;
    arrivalTime?: unknown;
    [key: string]: unknown;
};
type StaffService = {
    id?: unknown;
    name?: unknown;
    active?: unknown;
    completed?: unknown;
    cancelled?: unknown;
    state?: unknown;
    rame?: {
        totalCapacity?: number;
        elementDetails?: Array<Record<string, unknown>>;
    } | null;
    _onboardPax?: number;
    lineId?: unknown;
    _lineId?: unknown;
    line?: {
        id?: unknown;
    } | null;
    position?: {
        lat: unknown;
        lon: unknown;
    } | null;
    stops?: StaffServiceStop[];
    getCurrentStops?: () => StaffServiceStop[];
    currentStopIndex?: number;
    serviceType?: string;
    _regulationPriority?: number;
    _garageUntil?: unknown;
    _garageUntilDate?: unknown;
    _garageStationId?: unknown;
    train: {
        delayReason?: string;
    };
    [key: string]: unknown;
};
declare const ROLES: Record<string, StaffRoleDefinition>;
export { ROLES as STAFF_ROLES };
export declare const STAFF_SHIFT_GROUPS: readonly {
    id: number;
    label: string;
    short: string;
    start: number;
    end: number;
    hours: string;
}[];
export declare const HR_INCIDENT_TYPES: Readonly<Record<string, HRIncidentDefinition>>;
export declare const STAFF_TRAINING_CATALOG: Readonly<Record<string, StaffTrainingDefinition>>;
export declare const MATERIAL_AUTHORIZATION_RULES: Readonly<{
    trainingDays: 2;
    trainingCost: 1800;
    validityDays: 1095;
    renewalWarningDays: 90;
}>;
export declare function normalizeMaterialFamily(value?: unknown): string;
export declare function materialFamilyFromItem(item?: Record<string, unknown>): string;
type StaffAuthorization = {
    family: string;
    obtainedDate?: string;
    validUntil?: string;
    valid?: boolean;
    [key: string]: unknown;
};
type StaffMember = {
    id: string;
    name: string;
    role: string;
    nationality: string;
    assignedTo: string | null;
    available: boolean;
    hireDate: number;
    totalTrips: number;
    totalFines: number;
    totalFineRevenue: number;
    shiftStartMin: number;
    shiftWorkedMin: number;
    resting: boolean;
    restRemainingMin: number;
    restType: string | null;
    weeklyWorkMin: number;
    lastWeeklyRestDate: string | null;
    socialRisk: number;
    busyTaskId: string;
    busyTaskLabel: string;
    shiftGroup: number | null;
    onDuty: boolean;
    onLeave: boolean;
    leaveRemainingDays: number;
    leaveDaysRemaining: number;
    leaveYear: number;
    nextLeaveDate: string;
    leavePending: boolean;
    absenceType: string;
    absenceRemainingDays: number;
    pendingDismissal: boolean;
    weeklyRestDay: number | null;
    weeklyDayOff: boolean;
    shiftSessionKey: string;
    dailySalary: number;
    satisfaction: number;
    skillLevel: number;
    totalBonuses: number;
    trainingId: string;
    trainingLabel: string;
    trainingRemainingDays: number;
    materialAuthorizations: StaffAuthorization[];
    trainingMaterialFamily: string;
    assignedServiceId?: string | null;
    overtime?: boolean;
    shiftOverdue?: boolean;
    [key: string]: unknown;
};
type HireOptions = {
    count?: unknown;
    generateEach?: boolean;
    nationality?: string | null;
    assignedTo?: unknown;
};
type StaffSignalBox = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    radiusKm: number;
    stationId: unknown | null;
    lineId: unknown | null;
};
type StaffZone = {
    id: string;
    name: string;
    lat: number | null;
    lon: number | null;
    radiusKm: number;
    lineId: unknown | null;
    stationId?: unknown | null;
};
type StaffHrEvent = {
    id: string;
    date: unknown;
    type: unknown;
    staffId: unknown;
    title: unknown;
    detail: unknown;
};
type StaffDismissal = {
    date: unknown;
    staffId: string;
    name: string;
    role: string;
};
type StaffPayroll = {
    date: unknown;
    amount: number;
    count: number;
};
type LegacyConductor = {
    id: unknown;
    name: unknown;
    assignedServiceId: unknown;
    available: boolean;
    hireDate: unknown;
    totalTrips: unknown;
};
type MaterialFamilyRow = {
    family: string;
    count: number;
};
export declare class StaffManager {
    staff: StaffMember[];
    signalBoxes: StaffSignalBox[];
    zones: StaffZone[];
    conductors: LegacyConductor[];
    baseSalary: number;
    hiringCost: number;
    hrEvents: StaffHrEvent[];
    dismissalHistory: StaffDismissal[];
    _lastHRDate: unknown;
    _lastAutoAssignKey: string;
    _lastWorkforceTickTime: number | null;
    _lastWorkforceTickDate: unknown;
    _lastPayrollDate: unknown;
    payrollHistory: StaffPayroll[];
    _uiTab: string;
    _materialFamilyCache: {
        key: string;
        rows: MaterialFamilyRow[];
    };
    _lastAssignmentError: string;
    _needsMaterialAuthMigration: boolean;
    _lastGeneratedNationality?: string;
    _lastTickTime: number | null;
    _lastTickDate: unknown;
    constructor();
    hire(economy: Economy, name: unknown, role: string, opts?: HireOptions): StaffMember[] | null;
    generateRandomName(preferredNationality: string | null | undefined): string;
    _hashInt(value?: unknown): number;
    _addDays(dateStr: unknown, days?: unknown): string;
    getCurrentShiftGroup(timeOfDay?: unknown): {
        id: number;
        label: string;
        short: string;
        start: number;
        end: number;
        hours: string;
    };
    _isShiftGroupOnDuty(member: __KPStruct677, timeOfDay?: unknown): boolean;
    _ensureShiftGroup(member: StaffMember, targetId?: unknown): number;
    _ensureWeeklyRestDay(member: {
        weeklyRestDay: unknown;
        id: unknown;
    }): unknown;
    _weekday(dateStr?: unknown): number;
    _workforceDelta(timeOfDay: unknown, dateStr?: unknown): number;
    _scheduleNextLeave(member: StaffMember, dateStr: unknown): string;
    _pushHREvent(event?: Record<string, unknown>): void;
    _startLeave(member: __KPStruct681, days: unknown, dateStr: unknown, automatic?: unknown): {
        ok: boolean;
        reason: string;
        days?: undefined;
    } | {
        ok: boolean;
        days: number;
        reason?: undefined;
    };
    requestLeave(staffId: unknown, days: unknown, dateStr?: unknown): {
        ok: boolean;
        reason: string;
        days?: undefined;
    } | {
        ok: boolean;
        days: number;
        reason?: undefined;
    };
    _finishLeave(member: StaffMember, dateStr: unknown): void;
    _startHRIncident(member: StaffMember, type: string, dateStr: unknown, rng?: RandomSource): boolean;
    _finishHRIncident(member: StaffMember, dateStr: unknown): void;
    getMemberSalary(member: unknown): number;
    getAverageStaffSatisfaction(): number;
    giveBonus(staffId: unknown, amount: unknown, economy: Economy, dateStr?: unknown): {
        ok: boolean;
        reason: string;
        amount?: undefined;
        satisfactionGain?: undefined;
        satisfaction?: undefined;
    } | {
        ok: boolean;
        amount: number;
        satisfactionGain: number;
        satisfaction: number;
        reason?: undefined;
    };
    raiseSalary(staffId: unknown, percent: unknown, dateStr?: unknown): {
        ok: boolean;
        reason: string;
        before?: undefined;
        after?: undefined;
        satisfactionGain?: undefined;
        satisfaction?: undefined;
    } | {
        ok: boolean;
        before: number;
        after: number;
        satisfactionGain: number;
        satisfaction: number;
        reason?: undefined;
    };
    getTrainingOptions(member: {
        role: unknown;
    }): {
        label: string;
        days: number;
        cost: number;
        skillGain: number;
        satisfactionGain: number;
        description: string;
        roles?: string[];
        dynamic?: boolean;
        validityDays?: number;
        id: string;
    }[];
    _authorizationDateValid(auth: {
        family: unknown;
        validUntil?: unknown;
    }, dateStr?: unknown): boolean;
    getMaterialAuthorizations(member: unknown, dateStr?: unknown): StaffAuthorization[];
    hasMaterialAuthorization(member: unknown, family: unknown, dateStr?: unknown): boolean;
    getMaterialFamilyForElement(element: Record<string, unknown>, game?: unknown): string;
    getServiceMaterialFamilies(service: unknown, game?: unknown): string[];
    canConductorDriveService(member: {
        "role": unknown;
    }, service: unknown, dateStr?: unknown, game?: unknown): {
        ok: boolean;
        missing: string[];
        families: string[];
        reason: string;
    };
    getOwnedMaterialFamilies(game?: unknown): string[];
    migrateLegacyMaterialAuthorizations(game?: unknown, dateStr?: unknown): {
        migrated: boolean;
        families: number;
        drivers: number;
        grants: number;
    };
    getMaterialFamilyCatalogue(game?: unknown): {
        family: any;
        count: any;
    }[];
    startMaterialAuthorization(staffId: unknown, family: unknown, economy: Economy, dateStr?: unknown): {
        ok: boolean;
        reason: string;
        family?: undefined;
        days?: undefined;
        cost?: undefined;
    } | {
        ok: boolean;
        family: string;
        days: number;
        cost: number;
        reason?: undefined;
    };
    getMissingConductorReason(service: unknown, dateStr?: unknown, game?: unknown): string;
    startTraining(staffId: unknown, trainingId: unknown, economy: Economy, dateStr?: unknown): {
        ok: boolean;
        reason: string;
        days?: undefined;
        cost?: undefined;
    } | {
        ok: boolean;
        days: number;
        cost: number;
        reason?: undefined;
    };
    _finishTraining(member: StaffMember, dateStr?: unknown): void;
    processDailyHR(game: unknown, dateStr: unknown, rng?: RandomSource): {
        processed: boolean;
        incidents: number;
        leaves: number;
    };
    _tickFixedShiftStates(timeOfDay?: unknown, dateStr?: unknown, delta?: number): void;
    _targetsForRole(role: string, game: unknown): {
        id: string;
        label: string;
    }[];
    rebalanceConductorShifts(activeServices?: unknown): {
        demand: number[];
        counts: number[];
    };
    autoAssignAll(game: unknown): number;
    _processPendingDismissals(dateStr?: unknown): number;
    tickWorkforce(game: unknown, activeServices: unknown, timeOfDay: unknown, dateStr?: unknown): void;
    requestFire(staffId: unknown, dateStr?: unknown): {
        ok: boolean;
        pending: boolean;
        reason: string;
    } | {
        ok: boolean;
        pending: boolean;
        reason?: undefined;
    };
    fire(staffId: unknown): boolean;
    assign(staffId: unknown, targetId: unknown, game?: unknown): boolean;
    unassignStaff(staffId: unknown): boolean;
    unassignByTarget(targetId: unknown): void;
    getByRole(role: unknown): StaffMember[];
    getAvailableByRole(role: unknown): StaffMember[];
    getAssignedTo(targetId: unknown): StaffMember[];
    hasAssignedConductor(serviceId: unknown, strict?: unknown): boolean;
    getAvailable(): StaffMember[];
    isDepotRole(role: string): boolean;
    getDepotStaff(depotId: unknown, role?: unknown): StaffMember[];
    getDepotStaffAvailability(depotId: unknown, role: unknown): {
        assigned: number;
        busy: number;
        resting: number;
        leave: number;
        absent: number;
        training: number;
        offShift: number;
        free: number;
    };
    checkDepotStaff(depotId: unknown, requirements?: unknown): {
        ok: boolean;
        shortages: {
            role: string;
            need: number;
            free: number;
            assigned: number;
            label: string;
        }[];
    };
    reserveDepotStaff(depotId: unknown, requirements: unknown | undefined, taskId: unknown, taskLabel?: unknown): {
        ok: boolean;
        shortages: {
            role: string;
            need: number;
            free: number;
            assigned: number;
            label: string;
        }[];
        staffIds: never[];
    } | {
        ok: boolean;
        staffIds: string[];
        shortages?: undefined;
    };
    releaseDepotTask(taskId: unknown): number;
    reconcileDepotTaskReservations(operations?: unknown): void;
    autoAssignDepotStaff(depots?: unknown): number;
    tickConductors(activeServices: unknown, timeOfDay: number, dateStr?: unknown, game?: unknown): void;
    _startRest(c: StaffMember, dateStr: unknown, dailyRest: number, weeklyRest: number, weeklyWorkLimit: number): void;
    _isWeeklyRestOverdue(c: StaffMember, dateStr: unknown, weeklyWorkLimit: number): boolean;
    _daysBetween(a: unknown, b: unknown): number;
    addSignalBox(data?: Record<string, unknown>): {
        id: string;
        name: string;
        lat: number;
        lon: number;
        radiusKm: number;
        stationId: {} | null;
        lineId: {} | null;
    } | null;
    removeSignalBox(id: unknown): void;
    getSignalBoxById(id: unknown): StaffSignalBox | undefined;
    addZone(name: unknown, lat?: unknown, lon?: unknown, radiusKm?: unknown, lineId?: unknown): {
        id: string;
        name: string;
        lat: number | null;
        lon: number | null;
        radiusKm: number;
        lineId: {} | null;
    };
    removeZone(id: unknown): void;
    tickControleurs(economy: Economy, activeServices: unknown, gameTimeMin: unknown): void;
    _isCoverageMemberOperational(member: StaffMember): boolean;
    getZoneRegulatorCoverage(zoneId: unknown): {
        count: number;
        needed: number;
        teamsCovered: number;
        onDuty: number;
        covered: boolean;
    };
    getRegulationEffects(lat: unknown, lon: unknown, stationIds?: unknown[], lineIds?: unknown[]): {
        regulator: unknown;
        signalBox: unknown;
    };
    _garageHoldActive(svc: {
        _garageUntil?: unknown;
        _garageUntilDate?: unknown;
    }, timeOfDay: unknown, dateStr: unknown): boolean;
    _startGarageHold(svc: {
        _garageStationId?: unknown;
        _garageUntil?: unknown;
        _garageUntilDate?: unknown;
    }, stationId: string, waitMin: number, timeOfDay: unknown, dateStr: string): void;
    tickRegulateurs(activeServices: unknown, timeOfDay: number, dateStr: string, realismSettings: {
        delayTolerance: unknown;
    }): void;
    getDailySalaryExpense(): number;
    processDailySalaries(economy: Economy, dateStr?: unknown): {
        processed: boolean;
        total: number;
        count: number;
        reason: string;
    } | {
        processed: boolean;
        total: number;
        count: number;
        reason?: undefined;
    };
    render(container: HTMLElement, game: unknown): void;
    _renderRoleSection(role: string, activeServices: StaffService[], stations: unknown, depots: unknown, game: {
        "_currentDate": unknown;
    }): string;
    _renderZonesSection(): string;
    _renderSignalBoxSection(): string;
    _bindEvents(container: HTMLElement, game: {
        "_currentDate": unknown;
        "saveState": (...args: unknown[]) => unknown;
        "timeOfDay": unknown;
        "_gameTime": unknown;
        "depotManager": {
            "getDepots": (...args: unknown[]) => unknown;
        };
        "ui": {
            "_selectedDepotPageId": unknown;
            "_depotPageTab": unknown;
            "switchPage": (...args: unknown[]) => unknown;
            "renderDepotsList": (...args: unknown[]) => unknown;
        };
        "_pendingSignalBox": unknown;
    }, eco: Economy): void;
    _syncLegacy(): void;
    unassign(serviceId: unknown): void;
    toSave(): {
        materialAuthorizationSchemaVersion: number;
        runtimeClock: {
            tick: number | null;
            date: unknown;
            workforceTick: number | null;
            workforceDate: unknown;
            autoAssign: string;
        };
        staff: {
            id: unknown;
            name: unknown;
            role: unknown;
            nationality: {};
            assignedTo: unknown;
            available: boolean;
            hireDate: unknown;
            totalTrips: {};
            totalFines: {};
            totalFineRevenue: {};
            shiftStartMin: {};
            shiftWorkedMin: {};
            resting: {};
            restRemainingMin: {};
            restType: {} | null;
            weeklyWorkMin: {};
            lastWeeklyRestDate: {} | null;
            socialRisk: {};
            busyTaskId: {};
            busyTaskLabel: {};
            shiftGroup: number | null;
            onDuty: boolean;
            onLeave: boolean;
            leaveRemainingDays: number;
            leaveDaysRemaining: number;
            leaveYear: number;
            nextLeaveDate: {};
            leavePending: boolean;
            absenceType: {};
            absenceRemainingDays: number;
            pendingDismissal: boolean;
            weeklyRestDay: number | null;
            weeklyDayOff: boolean;
            shiftSessionKey: {};
            dailySalary: number;
            satisfaction: number;
            skillLevel: number;
            totalBonuses: number;
            trainingId: {};
            trainingLabel: {};
            trainingRemainingDays: number;
            materialAuthorizations: {
                family: string;
                obtainedDate: string;
                validUntil: string;
            }[];
            trainingMaterialFamily: string;
        }[];
        signalBoxes: StaffSignalBox[];
        zones: StaffZone[];
        hrEvents: StaffHrEvent[];
        dismissalHistory: StaffDismissal[];
        lastHRDate: {};
        lastPayrollDate: {};
        payrollHistory: StaffPayroll[];
        nextStaffId: number;
        conductors: LegacyConductor[];
        baseSalary: number;
        hiringCost: number;
    };
    reconcileAssignments({ services, stations, depots }?: Record<string, unknown>): number;
    loadFromSave(s: __S3Struct1000): void;
}
type __S3Struct1000 = {
    runtimeClock?: unknown;
    "materialAuthorizationSchemaVersion": unknown;
    "staff": unknown;
    "conductors": Array<{
        assignedServiceId?: unknown;
        [key: string]: unknown;
    }>;
    "signalBoxes": unknown;
    "zones": unknown;
    "hrEvents": unknown;
    "dismissalHistory": unknown;
    "lastHRDate": string;
    "lastPayrollDate": string;
    "payrollHistory": unknown;
    "baseSalary": unknown;
    "hiringCost": unknown;
    "nextStaffId": string;
};
