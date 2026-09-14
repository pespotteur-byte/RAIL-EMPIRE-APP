type __KPM435 = {
    "stationId"?: unknown;
    "technicalLocationId"?: unknown;
    "lat"?: unknown;
    "lon"?: unknown;
};
type __KPM468 = {
    "schemaVersion": unknown;
    "capturedAtUnixSec": unknown;
    "services": unknown;
    "busyVehicles": unknown;
};
type AnyRecord = Record<string, unknown>;
import type { ActiveService, ActiveServiceLike } from './schedule-creator.js';
import type { RailEmpire } from './main.js';
declare global {
    interface Window {
        game?: RailEmpire;
    }
}
import { Rame } from './rame.js';
import { ScheduleVersion, PerformanceProfile, ScheduledLocation } from './schedule-v2-model.js';
import { FormationMember, PhysicalVehicle, ScheduleOccurrence, RotationAction, Rotation } from './rotation-v2-model.js';
type RuntimeSegment = {
    wayId?: unknown;
    electrified?: unknown;
    voltage?: unknown[];
    frequency?: unknown[];
    gauge?: unknown[];
    loadingGauge?: unknown;
    axleLoad?: unknown;
    metreLoad?: unknown;
    from?: {
        lat?: unknown;
        lon?: unknown;
    };
    to?: {
        lat?: unknown;
        lon?: unknown;
    };
    distanceKm?: unknown;
};
type RuntimeLocationAnchor = {
    stationId?: unknown;
    technicalLocationId?: unknown;
    track?: {
        snapLat?: unknown;
        lat?: unknown;
        snapLon?: unknown;
        lon?: unknown;
        voiePointId?: unknown;
        wayId?: unknown;
        displayName?: unknown;
        trackRef?: unknown;
    };
    trackIdentity?: unknown;
    voiePointId?: unknown;
    platform?: unknown;
};
type RuntimePlanLocation = {
    location: ScheduledLocation;
    arrivalSec: number | null;
    departureSec: number | null;
};
type RuntimePlan = {
    rotation: RuntimeRotation;
    occ: ScheduleOccurrence;
    ver: ScheduleVersion;
    sourceVersion: ScheduleVersion;
    baseDate: string;
    startSec: number;
    prepStartSec: number;
    endSec: number;
    shiftSec: number;
    locations: RuntimePlanLocation[];
    preDepartureOperationSec: number;
    terminalOperationSec: number;
    error?: never;
    errorCode?: never;
    _relNow?: number;
};
type RuntimePlanFailure = {
    rotation: RuntimeRotation;
    occ: ScheduleOccurrence;
    ver: null;
    baseDate: string;
    error: string;
    errorCode?: string;
    _relNow?: number;
};
type RuntimePlanResult = RuntimePlan | RuntimePlanFailure;
type RuntimeRotation = Rotation & {
    _directAssignmentId?: unknown;
    _directRameId?: unknown;
};
type RuntimeVehiclePair = {
    member: RuntimeFormationMember;
    vehicle: PhysicalVehicle;
};
type RuntimeUsableFormation = {
    members: RuntimeVehiclePair[];
    active: RuntimeVehiclePair[];
    missingLead: boolean;
    notReady: boolean;
};
type RuntimeFormationMember = {
    vehicleId: string;
    role: FormationMember['role'];
    order?: number;
    sourceCouponId?: string;
};
type RuntimeFormationSnapshot = {
    formationMembers?: RuntimeFormationMember[];
    vehicleIds?: string[];
};
type RuntimeStop = {
    stationId?: unknown;
    technicalLocationId?: unknown;
    locationName?: unknown;
    locationOccurrenceId?: unknown;
    lat?: unknown;
    lon?: unknown;
};
type RuntimeOperationEntry = {
    actionId: string;
    dependsOn: string[];
    started: boolean;
    applied: boolean;
    failed: boolean;
    failure?: string;
    durationSec?: number;
    actualStartRelSec?: number;
    actualEndRelSec?: number;
    reservedIds: string[];
    plannedStartOffsetSec?: number;
    plannedEndOffsetSec?: number;
};
type RuntimeAlert = Record<string, unknown> & {
    id: string;
    time: string;
    level: unknown;
    code: string;
    message: unknown;
    rotationId?: unknown;
    occurrenceId?: unknown;
};
type RuntimeSnapshot = Record<string, unknown> & {
    randomDepartureKey?: string;
    passageTailSpeedHolds?: unknown;
    macroElapsed?: {
        medium: number;
        low: number;
    };
    isReturnLeg?: boolean;
    position?: {
        lat: number;
        lon: number;
    } | null;
    speed?: number;
    completed?: boolean;
    cancelled?: boolean;
    currentStopIndex?: number;
    state: string;
    stateIndex?: number;
    stateProgress?: number;
    nextDepartureTime?: number | null;
    onboardPax?: number;
    onboardFreight?: number;
    delay: number;
    blockedSinceGameTime?: number | null;
    stoppedSinceGameTime?: number | null;
    totalDistance?: number;
    brakeEffort?: number;
    tractiveEffort?: number;
    physicsDecelMs2?: number;
    vehicleIds?: string[];
    formationMembers?: RuntimeFormationMember[];
    operationState?: Record<string, unknown> | null;
    platformAssignment?: Record<string, unknown> | null;
    departureResourceHold?: Record<string, unknown> | null;
    train?: Record<string, unknown>;
    atTerminus?: boolean;
    legKey?: unknown;
    stationaryRouteFallback?: unknown;
    stationaryRouteRef?: {
        i: unknown;
        s: string;
    } | null;
};
export interface ScheduleV2Runtime {
    game: RailEmpire;
    alerts: RuntimeAlert[];
    _alertKeys: Set<string>;
    _alertTimes: Map<string, number>;
    _pendingSnapshots: Map<string, RuntimeSnapshot>;
    _lastSyncKey: string;
    _timedVersionCache: Map<string, {
        inputSignature: string;
        signature: string;
        timed: ScheduleVersion;
    }>;
    _planCache: Map<string, RuntimePlanResult[]>;
    _planCacheEpoch: string;
    _snapshotCapturedAtUnixSec: number;
}
declare function addDays(dateStr: unknown, delta: number): string;
declare function daysBetween(a: unknown, b: unknown): number;
/**
 * Bridge between the V2 planning domain and the proven legacy ActiveService
 * runtime. HOTFIX32 enforces the player-spec invariant: a timetable never creates
 * a train by itself. Every physical circulation must be referenced by a real
 * rotation line carrying a valid physical formation.
 */
export declare class ScheduleV2Runtime {
    constructor(game: RailEmpire);
    _pushAlert(level: string, code: string, message: string, data?: Record<string, unknown>): void;
    _runtimeRotations(): any[];
    _rotationRuns(rotation: {
        "enabled": unknown;
        "calendarId": unknown;
        "name": unknown;
        "id": unknown;
    }, baseDate: unknown): any;
    _versionApplies(ver: __S3Struct1036, baseDate: unknown): boolean;
    _resolveVersion(occ: {
        scheduleId: unknown;
        versionId: unknown;
    }, baseDate: unknown): any;
    _electricTractionUsableOnRoute(activeElectric: Array<{
        v: PhysicalVehicle;
    }>, segments?: RuntimeSegment[]): boolean;
    _actualProfile(occ: ScheduleOccurrence, fallbackProfile: PerformanceProfile, segments?: unknown): PerformanceProfile;
    _timedVersion(occ: ScheduleOccurrence, ver: ScheduleVersion): any;
    _beginPlanCacheEpoch(dateStr: unknown, todSec: unknown): string;
    _plansForRotationDate(rotation: Rotation, baseDate: string): RuntimePlanResult[];
    planRotationForDate(rotation: Rotation, baseDate: string): RuntimePlanResult[];
    _roughLookback(rotation: Rotation): number;
    _knownLocationMismatch(vehicle: PhysicalVehicle, firstLoc: {
        location: RuntimeLocationAnchor;
    }): boolean;
    _liveOwner(vehicleId: unknown): any;
    _usableMembers(plan: RuntimePlan, restoreSnapshot?: RuntimeFormationSnapshot | null, serviceId?: unknown): {
        members: {
            member: RuntimeFormationMember;
            vehicle: any;
        }[];
        active: {
            member: RuntimeFormationMember;
            vehicle: any;
        }[];
        missingLead: boolean;
        notReady: boolean;
    };
    _electricalProblem(plan: RuntimePlan, usable: RuntimeUsableFormation): string;
    _gaugeProblem(plan: RuntimePlan, usable: RuntimeUsableFormation): string;
    _vehicleDetail(member: Pick<FormationMember, 'role'>, v: PhysicalVehicle): AnyRecord;
    /** RC24: direct assignments reorder their source; advanced formations reorder only current members. */
    prepareRandomDeparture(svc: ActiveServiceLike, key: string): void;
    _refreshRuntimeFormation(svc: ActiveServiceLike): void;
    _actionLocation(stop: __KPM435): {
        kind: string;
        id: {};
        lat: {} | null;
        lon: {} | null;
        trackIdentity?: import("./station-track-identity.js").StationTrackIdentity | null;
        voiePointId?: string | null;
        platform?: string | number;
    };
    _operationAllIds(action: RotationAction): any[];
    _operationIncomingIds(svc: ActiveServiceLike, action: RotationAction): any[];
    _operationServiceId(svc: ActiveServiceLike, plan: RuntimePlan): string;
    _reserveOperationEntry(svc: ActiveServiceLike, plan: RuntimePlan, stop: {
        "stationId": unknown;
        "technicalLocationId": unknown;
        "locationName": unknown;
    }, stateEntry: RuntimeOperationEntry, relNowSec: unknown): boolean;
    _releaseOperationReservations(svc: ActiveServiceLike, plan: RuntimePlan, stateEntry: RuntimeOperationEntry, keepUnavailableIds?: {
        "has": (...args: unknown[]) => unknown;
    }): void;
    _applyOneOperationAction(svc: ActiveServiceLike, plan: RuntimePlan, stop: {
        "stationId": unknown;
        "technicalLocationId": unknown;
        "locationName": unknown;
    }, action: RotationAction, stateEntry: RuntimeOperationEntry, relativeNowSec: unknown): boolean;
    _tickOperationState(svc: ActiveServiceLike, plan: RuntimePlan, relativeNowSec: unknown): void;
    _beginActionsAtStop(svc: ActiveServiceLike, plan: RuntimePlan, stop: RuntimeStop, relativeNowSec?: unknown, isOrigin?: unknown): void;
    _operationTickForService(svc: ActiveServiceLike, plan: RuntimePlan, dateStr: unknown, timeOfDay: unknown): void;
    _optionalDecisions(plan: RuntimePlan): AnyRecord;
    _buildRuntimeRame(plan: RuntimePlan, usable: RuntimeUsableFormation): Rame;
    _routeIntegrityProblem(plan: RuntimePlan): string;
    _orderedActions(actions: RotationAction[], rotationId?: unknown, occurrenceId?: unknown, locationOccurrenceId?: unknown): any[];
    _preparedService(svc: ActiveService): boolean;
    _retirePreparedService(svc: ActiveService): void;
    _reconcilePreparedServices(): void;
    _compiledInputSignature(plan: RuntimePlan): string;
    _compile(plan: RuntimePlan): void;
    _pruneSeasonallyInactive(): void;
    _finalizeServices(dateStr: unknown, timeOfDay: number): void;
    _snapshotRouteRef(svc: {
        routes: unknown;
        _returnRoutes: unknown;
    }, route: unknown): {
        s: string;
        i: number;
    } | null;
    _snapshotRouteFromRef(svc: __S3Struct1116, ref: __S3Struct1117 | null | undefined, fallback?: unknown): any[] | null;
    _compactSnapshotRoute(route: unknown): AnyRecord[] | null;
    _snapshotCanRestore(plan: RuntimePlan, snap: {
        id?: unknown;
        state: unknown;
        delay: unknown;
    }, relNow: number): boolean;
    _snapshotCanExactRestore(plan: RuntimePlan, snap: {
        id?: unknown;
        state: unknown;
        delay: unknown;
    }, relNow: number): boolean;
    _routeLengthKm(route: unknown): number;
    _catchUpFreshCompile(svc: ActiveServiceLike, plan: RuntimePlan, relNowSec: unknown, staleSnap?: Record<string, unknown> | null): {
        mode: string;
        stopIndex: number;
        distanceKm: number;
    } | null;
    toSave(): {
        schemaVersion: number;
        capturedAtUnixSec: number;
        busyVehicles: any;
        services: any;
    };
    loadFromSave(data: __KPM468): boolean;
    _restoreSnapshot(svc: ActiveServiceLike, relNowMinutes?: unknown): boolean;
    diagnose(timeOfDay: unknown, dateStr: string): {
        summary: string;
        items: ({
            level: string;
            rotationId: any;
            label: any;
            status: string;
            occurrenceId?: undefined;
            direct?: undefined;
            scheduleId?: undefined;
        } | {
            level: string;
            rotationId: any;
            occurrenceId: string;
            direct: boolean;
            label: string;
            status: string;
            scheduleId?: undefined;
        } | {
            level: string;
            scheduleId: any;
            label: string;
            status: string;
            rotationId?: undefined;
            occurrenceId?: undefined;
            direct?: undefined;
        })[];
    };
    forceSync(timeOfDay: number, dateStr: string): {
        summary: string;
        items: ({
            level: string;
            rotationId: any;
            label: any;
            status: string;
            occurrenceId?: undefined;
            direct?: undefined;
            scheduleId?: undefined;
        } | {
            level: string;
            rotationId: any;
            occurrenceId: string;
            direct: boolean;
            label: string;
            status: string;
            scheduleId?: undefined;
        } | {
            level: string;
            scheduleId: any;
            label: string;
            status: string;
            rotationId?: undefined;
            occurrenceId?: undefined;
            direct?: undefined;
        })[];
    };
    catchUpExistingToClock(timeOfDay: number, dateStr: string, { gapSec }?: Record<string, unknown>): number;
    sync(timeOfDay: number, dateStr: unknown): void;
}
export { addDays as _v2AddDays, daysBetween as _v2DaysBetween };
type __S3Struct1036 = {
    "state": string;
    "calendarIds": unknown[];
};
type __S3Struct1116 = {
    "_returnRoutes": unknown[];
    "routes": unknown[];
};
type __S3Struct1117 = {
    "i": unknown;
    "s": string;
};
