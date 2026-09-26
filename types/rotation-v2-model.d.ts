import { type MaterialTrackLocation } from './material-track-location.js';
type UnknownRecord = Record<string, unknown>;
type ElectricSystem = {
    voltage: number;
    frequency: number;
};
type VehicleLocation = MaterialTrackLocation & {
    kind: string;
    id: string;
    lat: number | null;
    lon: number | null;
};
type RameElementLike = {
    id?: string;
    catalogId?: string;
    instanceName?: string;
    instanceNumber?: string;
    name?: string;
    category?: string;
    traction?: string;
    maxSpeed?: unknown;
    mass?: unknown;
    tonnage?: unknown;
    power?: unknown;
    length?: unknown;
    passengerCapacity?: unknown;
    freightCapacity?: unknown;
    brakeServiceMs2?: unknown;
    electricSystems?: unknown;
    gauges?: unknown;
    gauge?: unknown;
    loadingGauge?: string;
    axleLoad?: unknown;
    metreLoad?: unknown;
    elementId?: string;
    liveryId?: string;
    originalImageData?: string;
    imageData?: string;
    flipped?: unknown;
    isDrivingTrailer?: unknown;
    homeDepotId?: string;
};
type StationCodeLocation = {
    stationId?: unknown;
    technicalLocationId?: unknown;
    id?: unknown;
    name?: unknown;
};
type RameLocationLike = MaterialTrackLocation & {
    stationId?: string;
    depotId?: string;
    lat?: number | null;
    lon?: number | null;
};
type RameLike = {
    id: string;
    name?: string;
    serialNumber?: string;
    currentLocation?: RameLocationLike;
    elementDetails?: RameElementLike[];
    elements?: string[];
    traction?: string;
    maxSpeed?: unknown;
    totalMass?: unknown;
    totalTonnage?: unknown;
    totalPower?: unknown;
    totalLength?: unknown;
    totalCapacity?: unknown;
    totalFreightCapacity?: unknown;
};
type MaterialIntervalLike = {
    startSec: number;
    endSec: number;
    startLocationId?: string;
    endLocationId?: string;
    startLocationOccurrenceId?: string;
    endLocationOccurrenceId?: string;
};
type RotationLocationLike = {
    id: string;
    stationId?: string;
    technicalLocationId?: string;
    arrivalSec?: number | null;
    departureSec?: number | null;
};
type RotationRouteLegLike = {
    fromLocationId?: string;
    toLocationId?: string;
    distanceKm?: number;
    routePoints: unknown[];
};
type TimedRotationVersionLike = {
    locations: RotationLocationLike[];
    firstDepartureSec: number;
    lastArrivalSec: number;
    outboundPath?: {
        legs?: RotationRouteLegLike[];
        distanceKm?: number;
        routePoints?: unknown[];
    };
};
type OperationTimelineEntry = {
    action: RotationAction;
    startOffsetSec: number;
    endOffsetSec: number;
    dependsOn: string[];
};
type OperationTimeline = {
    windowSec: number;
    entries: OperationTimelineEntry[];
};
type LocationOperationBounds = {
    startSec: number;
    endSec: number;
    anchorSec: number;
    windowSec: number;
    location: RotationLocationLike;
    index: number;
    actionStartOffsetSec?: number;
    actionEndOffsetSec?: number;
};
type MaterialStateEntry = {
    vehicleId: string;
    role: FormationRoleValue;
    sourceCouponId: string;
    startSec: number;
    startLocationId: string;
    startLocationOccurrenceId: string;
};
type MaterialInterval = MaterialStateEntry & {
    endSec: number;
    reason: string;
    endLocationId: string;
    endLocationOccurrenceId: string;
};
type RotationWarning = UnknownRecord & {
    code?: string;
    level?: string;
    message?: string;
};
type ValidationIssueLike = UnknownRecord & {
    level?: string;
    code: string;
    occurrenceId?: string;
    actionId?: string;
    vehicleId?: string;
    message?: string;
};
type CalendarSpec = {
    enabled: boolean;
    startDay: number;
    endDay: number;
    weekdays: number[];
    excluded: Set<number>;
};
type RotationCalendarCarrier = {
    calendarId?: string;
    enabled?: boolean;
};
type MaterialUsageSlot = {
    rotationId: string;
    occurrenceId: string;
    start: number;
    end: number;
    role?: FormationRoleValue;
    reason?: string;
    startLocationId?: string;
    endLocationId?: string;
    calendarSpecs?: CalendarSpec[];
    dayShift?: number;
    direct?: boolean;
};
type PhysicalVehicleInput = UnknownRecord & {
    id?: unknown;
    catalogId?: unknown;
    number?: string;
    name?: string;
    category?: string;
    traction?: string;
    maxSpeed?: unknown;
    massKg?: unknown;
    powerW?: unknown;
    lengthM?: unknown;
    passengerCapacity?: unknown;
    freightCapacity?: unknown;
    brakeServiceMs2?: unknown;
    electricSystems?: unknown;
    gauges?: unknown;
    loadingGauge?: string;
    axleLoad?: unknown;
    metreLoad?: unknown;
    location?: VehicleLocation;
    available?: unknown;
    sourceRameId?: unknown;
    sourceRameElementId?: unknown;
    sourceRameElementIndex?: unknown;
    liveryId?: string;
    originalImageData?: string;
    imageData?: string;
    flipped?: unknown;
    isDrivingTrailer?: unknown;
    odometerKm?: unknown;
    homeDepotId?: unknown;
};
type CouponInput = UnknownRecord & {
    id?: unknown;
    name?: string;
    vehicleIds?: unknown;
    createdAt?: string;
    sourceRameId?: unknown;
    sourceRameElementIds?: unknown;
    sourceRameElementIndexes?: unknown;
    homeDepotId?: unknown;
};
type FormationMemberInput = UnknownRecord & {
    vehicleId?: unknown;
    role?: FormationRoleValue;
    order?: unknown;
    sourceCouponId?: unknown;
};
type ActiveFormationInput = UnknownRecord & {
    id?: unknown;
    members?: unknown;
    temporary?: unknown;
};
type ScheduleOccurrenceInput = UnknownRecord & {
    id?: unknown;
    scheduleId?: unknown;
    versionId?: unknown;
    offsetSec?: unknown;
    dateOffsetDays?: unknown;
    sequence?: unknown;
    formation?: ActiveFormationInput | ActiveFormationSpec;
    resolvedStartSec?: unknown;
    resolvedEndSec?: unknown;
    cancelled?: unknown;
    cancelReason?: string;
    warnings?: unknown;
    optionalStopDecisions?: UnknownRecord;
    timingMismatchApproved?: unknown;
    timingMismatchSignature?: string;
    currentTimingMismatchSignature?: string;
    usesAssignedFormation?: unknown;
    reversed?: unknown;
};
type DirectAssignmentInput = UnknownRecord & {
    id?: unknown;
    scheduleId?: unknown;
    versionId?: unknown;
    rameId?: unknown;
    formation?: ActiveFormationInput | ActiveFormationSpec;
    enabled?: unknown;
    createdAt?: string;
    warnings?: unknown;
    optionalStopDecisions?: UnknownRecord;
    timingMismatchApproved?: unknown;
    timingMismatchSignature?: string;
    currentTimingMismatchSignature?: string;
    usesAssignedFormation?: unknown;
    reversed?: unknown;
};
type RotationActionInput = UnknownRecord & {
    id?: unknown;
    type?: RotationActionTypeValue;
    occurrenceId?: unknown;
    locationOccurrenceId?: unknown;
    vehicleIds?: unknown;
    couponIds?: unknown;
    durationSec?: unknown;
    parallelGroup?: string;
    dependsOn?: unknown;
    forcedExecutionMode?: string;
    details?: UnknownRecord;
};
type RotationInput = UnknownRecord & {
    id?: unknown;
    name?: string;
    calendarId?: unknown;
    occurrences?: unknown;
    actions?: unknown;
    createdAt?: string;
    enabled?: unknown;
    assignedRameId?: unknown;
    assignedFormation?: ActiveFormationInput | ActiveFormationSpec;
};
type VehicleLookup = {
    getVehicle(id: string): PhysicalVehicle | null;
};
import { ScheduleVersion } from './schedule-v2-model.js';
import type { ScheduleV2Manager } from './schedule-v2-model.js';
export declare const ROTATION_V2_SCHEMA = 6;
export declare const FormationRole: Readonly<{
    LEAD: "LEAD";
    ACTIVE_MULTIPLE: "ACTIVE_MULTIPLE";
    PUSHER: "PUSHER";
    VEHICLE: "VEHICLE";
    COACH: "COACH";
    WAGON: "WAGON";
}>;
export declare const RotationActionType: Readonly<{
    ATTACH: "ATTACH";
    DETACH: "DETACH";
    CHANGE_LOCOMOTIVE: "CHANGE_LOCOMOTIVE";
    SPLIT: "SPLIT";
    MERGE: "MERGE";
    ADD_PUSHER: "ADD_PUSHER";
    REMOVE_PUSHER: "REMOVE_PUSHER";
    ADD_CV: "ADD_CV";
    REMOVE_CV: "REMOVE_CV";
}>;
type FormationRoleValue = typeof FormationRole[keyof typeof FormationRole];
type RotationActionTypeValue = typeof RotationActionType[keyof typeof RotationActionType];
type ClearRameOptions = {
    keepFormation?: boolean;
};
type AssignedFormationOptions = {
    rameId?: unknown;
    applyAll?: boolean;
};
type DirectAssignmentOptions = {
    rameId?: string;
};
type OccurrenceInput = UnknownRecord & {
    formation?: {
        members?: unknown;
    };
    usesAssignedFormation?: unknown;
    sequence?: number;
};
export declare class PhysicalVehicle {
    id: string;
    catalogId: string;
    number: string;
    name: string;
    category: string;
    traction: string;
    maxSpeed: number;
    massKg: number;
    powerW: number;
    lengthM: number;
    passengerCapacity: number;
    freightCapacity: number;
    brakeServiceMs2: number;
    electricSystems: ElectricSystem[];
    gauges: number[];
    loadingGauge: string;
    axleLoad: number | null;
    metreLoad: number | null;
    location: VehicleLocation;
    available: boolean;
    sourceRameId: string;
    sourceRameElementId: string;
    sourceRameElementIndex: number | null;
    imageData: string;
    liveryId: string;
    originalImageData: string;
    flipped: boolean;
    isDrivingTrailer: boolean;
    odometerKm: number;
    homeDepotId: string;
    _v2BusyUntilEpoch?: number;
    _v2OperationOwnerServiceId?: string;
    _rameProxySignature?: string;
    constructor(data?: PhysicalVehicleInput);
    toJSON(): {
        id: string;
        catalogId: string;
        number: string;
        name: string;
        category: string;
        traction: string;
        maxSpeed: number;
        massKg: number;
        powerW: number;
        lengthM: number;
        passengerCapacity: number;
        freightCapacity: number;
        brakeServiceMs2: number;
        electricSystems: ElectricSystem[];
        gauges: number[];
        loadingGauge: string;
        axleLoad: number | null;
        metreLoad: number | null;
        location: VehicleLocation;
        available: boolean;
        sourceRameId: string;
        sourceRameElementId: string;
        sourceRameElementIndex: number | null;
        imageData: string;
        liveryId: string;
        originalImageData: string;
        flipped: boolean;
        isDrivingTrailer: boolean;
        odometerKm: number;
        homeDepotId: string;
    };
}
export declare class Coupon {
    id: string;
    name: string;
    vehicleIds: string[];
    createdAt: string;
    sourceRameId: string;
    sourceRameElementIds: string[];
    sourceRameElementIndexes: number[];
    homeDepotId: string;
    constructor(data?: CouponInput);
    toJSON(): {
        id: string;
        name: string;
        vehicleIds: string[];
        createdAt: string;
        sourceRameId: string;
        sourceRameElementIds: string[];
        sourceRameElementIndexes: number[];
        homeDepotId: string;
    };
}
export declare class FormationMember {
    vehicleId: string;
    role: FormationRoleValue;
    order: number;
    sourceCouponId: string;
    constructor(data?: FormationMemberInput);
    toJSON(): {
        vehicleId: string;
        role: FormationRoleValue;
        order: number;
        sourceCouponId: string;
    };
}
export declare class ActiveFormationSpec {
    id: string;
    members: FormationMember[];
    temporary: boolean;
    constructor(data?: ActiveFormationInput | ActiveFormationSpec);
    normalize(): this;
    calculate(vehicleManager: VehicleLookup): {
        massKg: number;
        powerW: number;
        lengthM: number;
        maxSpeed: number;
        brakeServiceMs2: number;
        adhesionMassKg: number;
        passengerCapacity: number;
        freightCapacity: number;
        electricSystems: ElectricSystem[];
        gauges: number[];
        loadingGauge: string;
        axleLoad: number | null;
        metreLoad: number | null;
        activeVehicleIds: string[];
    };
    toJSON(): {
        id: string;
        temporary: boolean;
        members: {
            vehicleId: string;
            role: FormationRoleValue;
            order: number;
            sourceCouponId: string;
        }[];
    };
}
export declare class ScheduleOccurrence {
    id: string;
    scheduleId: string;
    versionId: string;
    offsetSec: number;
    dateOffsetDays: number;
    sequence: number;
    formation: ActiveFormationSpec;
    resolvedStartSec: number | null;
    resolvedEndSec: number | null;
    cancelled: boolean;
    cancelReason: string;
    warnings: RotationWarning[];
    optionalStopDecisions: UnknownRecord;
    timingMismatchApproved: boolean;
    timingMismatchSignature: string;
    currentTimingMismatchSignature: string;
    usesAssignedFormation: boolean;
    reversed: boolean;
    constructor(data?: ScheduleOccurrenceInput);
    toJSON(): {
        id: string;
        scheduleId: string;
        versionId: string;
        offsetSec: number;
        dateOffsetDays: number;
        sequence: number;
        formation: {
            id: string;
            temporary: boolean;
            members: {
                vehicleId: string;
                role: FormationRoleValue;
                order: number;
                sourceCouponId: string;
            }[];
        };
        resolvedStartSec: number | null;
        resolvedEndSec: number | null;
        cancelled: boolean;
        cancelReason: string;
        warnings: RotationWarning[];
        optionalStopDecisions: UnknownRecord;
        timingMismatchApproved: boolean;
        timingMismatchSignature: string;
        currentTimingMismatchSignature: string;
        usesAssignedFormation: boolean;
        reversed: boolean;
    };
}
export declare class DirectScheduleAssignment {
    id: string;
    scheduleId: string;
    versionId: string;
    rameId: string;
    formation: ActiveFormationSpec;
    enabled: boolean;
    createdAt: string;
    offsetSec: number;
    dateOffsetDays: number;
    sequence: number;
    cancelled: boolean;
    cancelReason: string;
    warnings: RotationWarning[];
    optionalStopDecisions: UnknownRecord;
    timingMismatchApproved: boolean;
    timingMismatchSignature: string;
    currentTimingMismatchSignature: string;
    usesAssignedFormation: boolean;
    reversed: boolean;
    constructor(data?: DirectAssignmentInput);
    toJSON(): {
        id: string;
        scheduleId: string;
        versionId: string;
        rameId: string;
        formation: {
            id: string;
            temporary: boolean;
            members: {
                vehicleId: string;
                role: FormationRoleValue;
                order: number;
                sourceCouponId: string;
            }[];
        };
        enabled: boolean;
        createdAt: string;
        warnings: RotationWarning[];
        optionalStopDecisions: UnknownRecord;
        timingMismatchApproved: boolean;
        timingMismatchSignature: string;
        currentTimingMismatchSignature: string;
        usesAssignedFormation: boolean;
        reversed: boolean;
    };
}
export declare class RotationAction {
    id: string;
    type: RotationActionTypeValue;
    occurrenceId: string;
    locationOccurrenceId: string;
    vehicleIds: string[];
    couponIds: string[];
    durationSec: number;
    parallelGroup: string;
    dependsOn: string[];
    forcedExecutionMode: string;
    details: UnknownRecord;
    constructor(data?: RotationActionInput);
    toJSON(): {
        id: string;
        type: RotationActionTypeValue;
        occurrenceId: string;
        locationOccurrenceId: string;
        vehicleIds: string[];
        couponIds: string[];
        durationSec: number;
        parallelGroup: string;
        dependsOn: string[];
        forcedExecutionMode: string;
        details: UnknownRecord;
    };
}
export declare class Rotation {
    id: string;
    name: string;
    calendarId: string;
    occurrences: ScheduleOccurrence[];
    actions: RotationAction[];
    createdAt: string;
    enabled: boolean;
    assignedRameId: string;
    assignedFormation: ActiveFormationSpec;
    constructor(data?: RotationInput);
    normalize(): this;
    toJSON(): {
        id: string;
        name: string;
        calendarId: string;
        occurrences: {
            id: string;
            scheduleId: string;
            versionId: string;
            offsetSec: number;
            dateOffsetDays: number;
            sequence: number;
            formation: {
                id: string;
                temporary: boolean;
                members: {
                    vehicleId: string;
                    role: FormationRoleValue;
                    order: number;
                    sourceCouponId: string;
                }[];
            };
            resolvedStartSec: number | null;
            resolvedEndSec: number | null;
            cancelled: boolean;
            cancelReason: string;
            warnings: RotationWarning[];
            optionalStopDecisions: UnknownRecord;
            timingMismatchApproved: boolean;
            timingMismatchSignature: string;
            currentTimingMismatchSignature: string;
            usesAssignedFormation: boolean;
            reversed: boolean;
        }[];
        actions: {
            id: string;
            type: RotationActionTypeValue;
            occurrenceId: string;
            locationOccurrenceId: string;
            vehicleIds: string[];
            couponIds: string[];
            durationSec: number;
            parallelGroup: string;
            dependsOn: string[];
            forcedExecutionMode: string;
            details: UnknownRecord;
        }[];
        createdAt: string;
        enabled: boolean;
        assignedRameId: string;
        assignedFormation: {
            id: string;
            temporary: boolean;
            members: {
                vehicleId: string;
                role: FormationRoleValue;
                order: number;
                sourceCouponId: string;
            }[];
        };
    };
}
export declare class RotationV2Manager {
    schemaVersion: number;
    scheduleManager: ScheduleV2Manager | null;
    vehicles: PhysicalVehicle[];
    coupons: Coupon[];
    rotations: Rotation[];
    directAssignments: DirectScheduleAssignment[];
    stationCodes: Record<string, string>;
    loadWarnings: string[];
    constructor(scheduleManager?: ScheduleV2Manager | null);
    stationCodeKey(location?: StationCodeLocation): string;
    getStationCode(location?: StationCodeLocation): string;
    setStationCode(location?: StationCodeLocation, code?: unknown): string;
    addVehicle(data?: UnknownRecord): PhysicalVehicle;
    getVehicle(id: string): PhysicalVehicle | null;
    setVehicleHomeDepot(vehicleId: string, depotId: unknown): boolean;
    setCouponHomeDepot(couponId: string, depotId: unknown): boolean;
    getRameElementVehicle(rameId: string, elementIndex: number | string): PhysicalVehicle | null;
    getRameVehicles(rameId: string): PhysicalVehicle[];
    _rameLocation(rame: RameLike): {
        trackIdentity?: import("./station-track-identity.js").StationTrackIdentity | null;
        voiePointId?: string | null;
        platform?: string | number;
        kind: string;
        id: string;
        lat: number | null;
        lon: number | null;
    };
    materializeRameElement(rame: RameLike, elementIndex: number | string, catalogItem?: RameElementLike | null): PhysicalVehicle;
    materializeRameCoupon(rame: RameLike, elementIndexes: unknown, name: string, catalogResolver?: ((catalogId: string | undefined, index: number) => RameElementLike | null) | null): Coupon;
    syncRameAfterEdit(rame: RameLike, previous?: {
        elementDetails?: RameElementLike[];
    }): {
        linked: number;
        detached: number;
        rotationsUpdated: number;
        rotationsBlocked: number;
        directUpdated: number;
        directBlocked: number;
    };
    formationForRame(rame: RameLike): ActiveFormationSpec;
    assignRameToRotation(rotationId: string, rame: RameLike): Rotation;
    clearRameFromRotation(rotationId: string, options?: ClearRameOptions): boolean;
    setAssignedFormation(rotationId: string, formation?: ActiveFormationSpec | UnknownRecord, options?: AssignedFormationOptions): Rotation;
    addAssignedVehicle(rotationId: string, vehicleId: string, role?: FormationRoleValue | '', sourceCouponId?: string): Rotation;
    addAssignedCoupon(rotationId: string, couponId: string): Rotation;
    addAssignedRame(rotationId: string, rame: RameLike): Rotation;
    removeAssignedVehicle(rotationId: string, vehicleId: string): boolean;
    clearAssignedFormation(rotationId: string): boolean;
    scheduleCoveredByRotation(scheduleId: string, versionId?: string | null): boolean;
    upsertRameProxy(rame: RameLike): PhysicalVehicle;
    addCoupon(data?: UnknownRecord): Coupon;
    getCoupon(id: string): Coupon | null;
    expandCoupon(couponId: string, role?: FormationRoleValue): FormationMember[];
    getDirectAssignment(scheduleId: string, versionId?: string | null): DirectScheduleAssignment | null;
    getDirectAssignmentById(id: string): DirectScheduleAssignment | null;
    getDirectAssignmentByRuntimeRotationId(rotationId: string): DirectScheduleAssignment | null;
    setDirectAssignment(scheduleId: string, versionId: string, formation?: ActiveFormationSpec | UnknownRecord | null, options?: DirectAssignmentOptions): DirectScheduleAssignment;
    setDirectRameAssignment(scheduleId: string, versionId: string, rame: RameLike): DirectScheduleAssignment;
    removeDirectAssignment(scheduleId: string, versionId?: string | null): boolean;
    directAssignmentSuppressed(assignment: DirectScheduleAssignment): boolean;
    addRotation(data?: UnknownRecord): Rotation;
    getRotation(id: string): Rotation | null;
    removeRotation(id: string): boolean;
    duplicateRotation(id: string, name?: string): Rotation;
    removeVehicle(id: string): boolean;
    removeCoupon(id: string): boolean;
    findScheduleReferences(scheduleId: string): {
        rotationId: string;
        rotationName: string;
        occurrenceId: string;
    }[];
    removeScheduleReferences(scheduleId: string): void;
    addOccurrence(rotationId: string, data?: OccurrenceInput): ScheduleOccurrence;
    addAction(rotationId: string, data?: UnknownRecord): RotationAction;
    removeAction(rotationId: string, actionId: string): boolean;
    _actionVehicleIds(action: RotationAction): string[];
    _operationDeps(actions: RotationAction[], action: RotationAction, indexMap?: Map<string, number> | null): string[];
    orderedActionsAtLocation(rotationId: string, occurrenceId: string, locationOccurrenceId: string): RotationAction[];
    _operationTimeline(actions: RotationAction[]): OperationTimeline;
    operationTimelineAtLocation(rotationId: string, occurrenceId: string, locationOccurrenceId: string): OperationTimeline;
    operationWindowSec(rotationId: string, occurrenceId: string, locationOccurrenceId: string): number;
    _locationOperationBounds(rotation: Rotation, occ: ScheduleOccurrence, timed: TimedRotationVersionLike, locationOccurrenceId: string, startSec: number): LocationOperationBounds | null;
    _actionOperationBounds(rotation: Rotation, occ: ScheduleOccurrence, timed: TimedRotationVersionLike, action: RotationAction, startSec: number): LocationOperationBounds | null;
    _poweredVehicle(v: PhysicalVehicle | null | undefined): boolean;
    _wagonVehicle(v: PhysicalVehicle | null | undefined): boolean;
    _validateCategoryComposition(occ: ScheduleOccurrence, ver: ScheduleVersion): ValidationIssueLike[];
    _roleForAttachedVehicle(v: PhysicalVehicle | null | undefined, type: RotationActionTypeValue, activeCount?: number): FormationRoleValue;
    originRequiredVehicleIds(rotationId: string, occurrenceId: string, timedVersion?: ScheduleVersion | null): string[];
    materialIntervals(rotationId: string, occurrenceId: string, timedVersion?: ScheduleVersion | null, resolvedStartSec?: number | string | null): MaterialInterval[];
    materialIntervalDistanceKm(rotationId: string, occurrenceId: string, interval: MaterialIntervalLike, version?: ScheduleVersion | null): number;
    _canonicalizeOccurrenceDayOffset(occ: ScheduleOccurrence, ver: ScheduleVersion | null | undefined): boolean;
    _timedVersionForOccurrence(occ: ScheduleOccurrence, ver: ScheduleVersion): ScheduleVersion;
    _timedVersionForOccurrence(occ: ScheduleOccurrence, ver: null): null;
    _timedVersionForOccurrence(occ: ScheduleOccurrence, ver: undefined): undefined;
    _timedVersionForOccurrence(occ: ScheduleOccurrence, ver: ScheduleVersion | null | undefined): ScheduleVersion | null | undefined;
    _timingSignature(occ: ScheduleOccurrence, actualDuration: number, referenceDuration: number): string;
    approveTimingMismatch(rotationId: string, occurrenceId: string): boolean;
    timingMismatchNeedsApproval(occ: ScheduleOccurrence): boolean;
    recalculateRotation(rotationId: string): Rotation | null;
    _occurrenceInterval(rotation: Rotation, occurrence: ScheduleOccurrence): number[];
    _validateFormationThroughActions(rotation: Rotation, occ: ScheduleOccurrence, ver: ScheduleVersion): ValidationIssueLike[];
    validateRotation(rotationId: string): (ValidationIssueLike | {
        level: string;
        code: string;
        message: string;
        occurrenceId?: undefined;
        vehicleId?: undefined;
        locationOccurrenceId?: undefined;
        requiredSec?: undefined;
        availableSec?: undefined;
        actionId?: undefined;
    } | {
        level: string;
        code: string;
        occurrenceId: string;
        message: string;
        vehicleId?: undefined;
        locationOccurrenceId?: undefined;
        requiredSec?: undefined;
        availableSec?: undefined;
        actionId?: undefined;
    } | {
        level: string;
        code: string;
        occurrenceId: string;
        vehicleId: string;
        message: string;
        locationOccurrenceId?: undefined;
        requiredSec?: undefined;
        availableSec?: undefined;
        actionId?: undefined;
    } | {
        level: string;
        code: string;
        occurrenceId: string;
        locationOccurrenceId: string;
        message: string;
        vehicleId?: undefined;
        requiredSec?: undefined;
        availableSec?: undefined;
        actionId?: undefined;
    } | {
        level: string;
        code: string;
        occurrenceId: string;
        locationOccurrenceId: string;
        requiredSec: number;
        availableSec: number;
        message: string;
        vehicleId?: undefined;
        actionId?: undefined;
    } | {
        level: string;
        code: string;
        actionId: string;
        message: string;
        occurrenceId?: undefined;
        vehicleId?: undefined;
        locationOccurrenceId?: undefined;
        requiredSec?: undefined;
        availableSec?: undefined;
    })[];
    _calendarSpecById(calendarId: string | undefined): CalendarSpec | null;
    _intersectCalendarSpecs(a: CalendarSpec | null, b: CalendarSpec | null): CalendarSpec | null;
    _rotationCalendarSpec(rotation: RotationCalendarCarrier): CalendarSpec;
    _occurrenceCalendarSpecs(rotation: RotationCalendarCarrier, occurrence: Pick<ScheduleOccurrence, 'scheduleId' | 'versionId'>): CalendarSpec[];
    _calendarSpecsCanRunWithDayShift(specsA: CalendarSpec[] | undefined, specsB: CalendarSpec[] | undefined, shiftDays?: number): boolean;
    _rotationsCanRunWithDayShift(a: RotationCalendarCarrier, b: RotationCalendarCarrier, shiftDays?: number): boolean;
    _calendarSpecsRunOnDay(specs: CalendarSpec[] | undefined, day: number): boolean;
    _globalLocationConflicts(vehicleId: string, slots: MaterialUsageSlot[]): {
        code: string;
        vehicleId: string;
        first: MaterialUsageSlot;
        second: MaterialUsageSlot;
        message: string;
    }[];
    validateMaterialConflicts(): ValidationIssueLike[];
    toSave(): {
        schemaVersion: number;
        vehicles: {
            available: boolean;
            id: string;
            catalogId: string;
            number: string;
            name: string;
            category: string;
            traction: string;
            maxSpeed: number;
            massKg: number;
            powerW: number;
            lengthM: number;
            passengerCapacity: number;
            freightCapacity: number;
            brakeServiceMs2: number;
            electricSystems: ElectricSystem[];
            gauges: number[];
            loadingGauge: string;
            axleLoad: number | null;
            metreLoad: number | null;
            location: VehicleLocation;
            sourceRameId: string;
            sourceRameElementId: string;
            sourceRameElementIndex: number | null;
            imageData: string;
            liveryId: string;
            originalImageData: string;
            flipped: boolean;
            isDrivingTrailer: boolean;
            odometerKm: number;
            homeDepotId: string;
        }[];
        coupons: {
            id: string;
            name: string;
            vehicleIds: string[];
            createdAt: string;
            sourceRameId: string;
            sourceRameElementIds: string[];
            sourceRameElementIndexes: number[];
            homeDepotId: string;
        }[];
        rotations: {
            id: string;
            name: string;
            calendarId: string;
            occurrences: {
                id: string;
                scheduleId: string;
                versionId: string;
                offsetSec: number;
                dateOffsetDays: number;
                sequence: number;
                formation: {
                    id: string;
                    temporary: boolean;
                    members: {
                        vehicleId: string;
                        role: FormationRoleValue;
                        order: number;
                        sourceCouponId: string;
                    }[];
                };
                resolvedStartSec: number | null;
                resolvedEndSec: number | null;
                cancelled: boolean;
                cancelReason: string;
                warnings: RotationWarning[];
                optionalStopDecisions: UnknownRecord;
                timingMismatchApproved: boolean;
                timingMismatchSignature: string;
                currentTimingMismatchSignature: string;
                usesAssignedFormation: boolean;
                reversed: boolean;
            }[];
            actions: {
                id: string;
                type: RotationActionTypeValue;
                occurrenceId: string;
                locationOccurrenceId: string;
                vehicleIds: string[];
                couponIds: string[];
                durationSec: number;
                parallelGroup: string;
                dependsOn: string[];
                forcedExecutionMode: string;
                details: UnknownRecord;
            }[];
            createdAt: string;
            enabled: boolean;
            assignedRameId: string;
            assignedFormation: {
                id: string;
                temporary: boolean;
                members: {
                    vehicleId: string;
                    role: FormationRoleValue;
                    order: number;
                    sourceCouponId: string;
                }[];
            };
        }[];
        directAssignments: {
            id: string;
            scheduleId: string;
            versionId: string;
            rameId: string;
            formation: {
                id: string;
                temporary: boolean;
                members: {
                    vehicleId: string;
                    role: FormationRoleValue;
                    order: number;
                    sourceCouponId: string;
                }[];
            };
            enabled: boolean;
            createdAt: string;
            warnings: RotationWarning[];
            optionalStopDecisions: UnknownRecord;
            timingMismatchApproved: boolean;
            timingMismatchSignature: string;
            currentTimingMismatchSignature: string;
            usesAssignedFormation: boolean;
            reversed: boolean;
        }[];
        stationCodes: {
            [x: string]: string;
        };
    };
    loadFromSave(data: UnknownRecord): boolean;
}
export {};
