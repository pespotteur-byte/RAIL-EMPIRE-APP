import { type TurnbackState } from './formation-turnback.js';
import { type StationTrackIdentity } from './station-track-identity.js';
import { type PassageTailSpeedHold } from './tail-speed-index.js';
type __KPM321 = number;
type __KPM322 = number;
type __KPM323 = number;
type __KPM329 = number;
type __KPM330 = number;
type __KPM332 = number;
type __KPM361 = number;
import type { World } from './world.js';
import type { Economy } from './economy.js';
import type { Rame, RameManager } from './rame.js';
import type { FormationMember } from './rotation-v2-model.js';
import { analyzeRoute, CantonManager } from './simulation.js?v=1784561441';
import { MovementAuthority } from './movement-authority.js';
import type { PublishedMovementAuthority } from './movement-authority.js';
type ServiceRoutePoint = Record<string, unknown> & {
    lat: number;
    lon: number;
    electrified?: boolean;
    wayId?: string | number;
    way_id?: string | number;
    maxSpeed?: number;
    speed?: number;
    maxSpeedSource?: string;
    direction?: unknown;
    incline?: unknown;
    fallback?: unknown;
    tracks?: number;
    usage?: unknown;
};
type ServiceRoute = ServiceRoutePoint[];
type PhysicalLeader = {
    service: ActiveService;
    frontProgressKm: number;
    rearGapKm: number;
    leaderSpeedKmh: number;
    lengthM: number;
    tailClearingDeparture: boolean;
};
type StationReservation = {
    id: unknown;
    lat?: number;
    lon?: number;
    platforms?: unknown;
};
type ArrivalStation = StationReservation & {
    id: string;
    lat: number;
    lon: number;
    name: string;
};
type ArrivalStopResource = {
    lat?: number | null;
    lon?: number | null;
};
type TronconResource = {
    id: string | number;
    occupiedBy?: unknown;
};
type TronconManager = {
    troncons?: TronconResource[];
    getTronconAtPosition: (pos: {
        lat: number;
        lon: number;
        wayId?: string | number | null;
    }, radiusKm?: number, voie?: unknown, wayIds?: Set<string> | null) => TronconResource | null | undefined;
    isTronconOccupied: (id: string | number, serviceId: unknown) => boolean;
    checkCisaillement: (id: string | number, serviceId: unknown) => unknown;
    reserveTroncon?: (id: string | number, serviceId: unknown) => boolean;
    occupyTroncon: (id: string | number, serviceId: unknown) => boolean;
    releaseTronconReservation?: (id: string | number, serviceId: unknown) => unknown;
    releaseTroncon: (id: string | number, serviceId: unknown) => unknown;
};
declare const cantonManager: any;
export { cantonManager };
export declare class ServiceStop {
    [key: string]: unknown;
    stationId: string;
    type: string;
    stopCode: string;
    departureTime: number;
    arrivalTime: number;
    voiePointId: string | null;
    trackIdentity: StationTrackIdentity | null;
    platform: string | number;
    lat: number | null;
    lon: number | null;
    locationOccurrenceId: string;
    technicalLocationId: string;
    locationName: string;
    name?: string;
    v2OperationSec: number;
    turnBack: boolean;
    _skipped?: boolean;
    time?: number;
    constructor(stationId: unknown, type: unknown, depTime: unknown, arrTime: unknown, voiePointId?: unknown, platform?: unknown, stopCode?: unknown, extra?: Record<string, unknown> | null);
}
type ServiceIncident = {
    effect?: string;
    name?: string;
    speedLimit?: number;
    [key: string]: unknown;
};
type ServiceBreakdown = {
    type: string;
    time?: number;
    [key: string]: unknown;
};
type ServiceTrain = {
    id: string;
    name: string;
    color: string;
    category: string;
    maxSpeed: number;
    speed: number;
    delay: number;
    state: string;
    totalKm: number;
    stoppedAt: ({
        id?: unknown;
        name?: unknown;
        lat?: unknown;
        lon?: unknown;
        platformNames?: string[];
    } | null);
    incident: ServiceIncident | null;
    breakdown: ServiceBreakdown | null;
    blockedBy: boolean;
    signalAlert: string | null;
    delayReason: string;
    incidentDelayReasons: Array<Record<string, unknown>>;
    accel: number;
    decel: number;
    seriesName: string;
    number: string;
    platform: unknown;
    totalKmRun: number;
    kmSinceLastMaint: number;
    wearLevel: number;
    inMaintenance: boolean;
    inDepot: boolean;
    length?: number;
    heading?: number;
    geoHeading?: number;
    iteInfo?: Record<string, unknown> | null;
    _stoppedSinceGameTime?: number | null;
    movementAuthority?: PublishedMovementAuthority;
};
type ActiveServiceState = {
    index: number;
    progress: number;
    legKey: unknown;
    cachedRoute: ServiceRoute | null;
    worksLimitCache: {
        key: string;
        limit: number | null;
    } | null;
    cumDist: Float64Array | null;
    segDists: Float64Array | null;
    plannedCumTimeSec: Float64Array | null;
    plannedSegTimeSec: Float64Array | null;
    plannedTotalTimeSec: number;
    negativeSpeedTransitions: Array<{
        index: number;
        speed: number;
        distanceKm: number;
    }>;
};
type PlatformAssignment = {
    stationId: unknown;
    platform: unknown;
    voiePointId?: unknown;
    source?: string;
    trackIdentity?: StationTrackIdentity | null;
    displayName?: string;
};
type DepartureResourceHold = {
    stationId: unknown;
    platform: unknown;
    platformSource: string;
    voiePointId: unknown;
    startTravelKm: number;
    trackIdentity?: StationTrackIdentity | null;
    displayName?: string;
};
type PendingAltRoute = {
    key: string;
    completed: boolean;
    route: ServiceRoute | null;
    failed: boolean;
};
type V2OperationEntry = {
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
    [key: string]: unknown;
};
type V2OperationState = {
    completed: boolean;
    failed: boolean;
    locationOccurrenceId?: string;
    stationId?: string;
    technicalLocationId?: string;
    locationName?: string;
    windowStartRelSec?: number;
    entries?: V2OperationEntry[];
    [key: string]: unknown;
};
type WeatherEffects = {
    brakeFactor: number;
    speedCap: number;
    speedMult: number;
    type: string;
};
type WeatherEffectsProvider = {
    getSpeedEffectsAt: (...args: unknown[]) => WeatherEffects;
};
type ActiveServiceRame = Rame & {
    currentLoadRatio?: number;
    loadRatio?: number;
    payloadRatio?: number;
    brakeServiceMs2?: number;
    seriesName?: string;
};
export declare class ActiveService {
    private _tailSpeedIndex;
    _passageTailSpeedHolds: PassageTailSpeedHold[];
    private _stepPhysicalLeader;
    private _electrificationIndex?;
    id: string;
    name: string;
    _v2OccurrenceId: string;
    _v2RotationId: string;
    _v2BaseDate: string;
    _v2OptionalStopDecisions: Record<string, boolean> | null;
    _v2AllowEarlyDeparture: boolean;
    rameId: unknown;
    rame: ActiveServiceRame | null | undefined;
    stops: ServiceStop[];
    routes: ServiceRoute[];
    world: World;
    weather: WeatherEffectsProvider | null;
    roundTrip: boolean;
    multiDepartures: number;
    terminusWait: number;
    number: string | number;
    returnNumber: string | number;
    _returnRoutes: ServiceRoute[] | null;
    _returnStopsData: ServiceStop[] | null;
    totalDistance: number;
    plannedDistance: number;
    active: boolean;
    serviceType: string;
    isTTX: boolean;
    isLegacyCatenaryWork: boolean;
    isWorkTrain: boolean;
    assignedContractId: string;
    returnName: string;
    returnPlatforms: Record<string, unknown>;
    runDays: number[];
    runDates: string[];
    _tripCount: number;
    _adjustedStops: ServiceStop[] | null;
    _adjustedReturnStops: ServiceStop[] | null;
    currentStopIndex: number;
    state: string;
    position: {
        lat: number;
        lon: number;
    } | null;
    speed: number;
    targetSpeed: number;
    delay: number;
    completed: boolean;
    direction: number;
    currentRouteIndex: number;
    routeProgress: number;
    lastTickTime: number;
    revenueCollected: boolean;
    isReturnLeg: boolean;
    returnStops: ServiceStop[];
    _platformAssignment: PlatformAssignment | null;
    _departureResourceHold: DepartureResourceHold | null;
    _state: ActiveServiceState;
    _routeAnalysis: ReturnType<typeof analyzeRoute> | null;
    _cantonAssignments: ReturnType<CantonManager['createRouteCantons']> | null;
    _carryoverCantonIds: Set<unknown> | null;
    _occupiedTronconIds: Set<string | number>;
    _tronconExitTravelKm: Map<string | number, number>;
    _reservedTronconId: string | number | null;
    _lastTronconId: string | number | null;
    _brakeEffort: number;
    _tractiveEffort: number;
    _stationaryRoute: ServiceRoute | null;
    _stationaryRouteIndex: number;
    _pendingAltRoute: PendingAltRoute | null;
    _altRouteFailedKeys: Set<string>;
    category: string;
    train: ServiceTrain;
    _movementAuthority: MovementAuthority;
    _garage: unknown;
    _iteHardBlock: boolean;
    _iteDwellExtra: number;
    _iteCargoMismatch: boolean;
    _passageStops: unknown[];
    _carreMarginM: number;
    _negativeBufferKm: number;
    _lastPhysicsDecelMs2?: number;
    _resolvedSpeedCache: WeakMap<object, {
        cap: number;
        speeds: number[];
    }> | null;
    _cumDistCache: WeakMap<object, Float64Array> | null;
    _currentDate: string;
    _economy: Economy;
    _v2OnOperationTick?: (dateStr: string, timeOfDay: number) => void;
    _v2OnArrive?: (stop: ServiceStop, station: unknown, timeOfDay: number) => void;
    _v2OperationState?: V2OperationState | null;
    _rescueDispatched?: boolean;
    _cachedDow: number;
    _cachedDowDate: string;
    _cachedFirstDep: number;
    _evoCompleted?: boolean;
    _evoServiceId?: string | null;
    cancelled?: boolean;
    completedDate?: string;
    _legacyOperatingDay: string;
    _legacyLastFinishedDay: string;
    _nextDepartureTime?: number | null;
    _atTerminus?: boolean;
    _cachedTroncon?: TronconResource | null;
    _cachedTronconTime?: number | null;
    _trackKey?: string | null;
    _routeKey?: string | null;
    _blockedSinceGameTime?: number | null;
    _carryoverStartTravelKm?: number | null;
    _worksClosureAhead?: boolean;
    _lastArrivalTime?: number;
    _v2BrakeServiceMs2?: number;
    _contractFreight?: number;
    _contractCargoId?: string;
    _onboardFreight?: number;
    _onboardPax?: number;
    _onboardPassengerKm?: number;
    _genericCargoType?: string;
    _contractDelivered?: number;
    _evoCreated?: boolean;
    _evoForServiceId?: string | null;
    _isEVO?: boolean;
    _v2OperationWaitingMaterial?: boolean;
    _v2PrepReadyMinute?: number;
    _v2FormationMembers?: Array<{
        vehicleId: string;
        role: FormationMember['role'];
        order?: number;
        sourceCouponId?: string;
    }>;
    _v2VehicleIds?: string[];
    _v2FormationReversed?: boolean;
    _v2OperationFailure?: string;
    _v2RandomDepartureKey?: string;
    _v2DirectRameId?: string;
    _v2AssignedRameId?: string;
    _macroElapsed?: {
        medium: number;
        low: number;
    };
    lineId?: string;
    delayReason?: string;
    isRescue?: boolean;
    rescueState?: string;
    rescueCanRetry?: boolean;
    _nearbyServices?: ActiveService[];
    _garageUntil?: number | null;
    _garageUntilDate?: string | null;
    _turnbackState?: TurnbackState | null;
    _currentTimeOfDay?: number;
    constructor(data: Record<string, unknown>, rame: Rame | null | undefined, world: unknown, weather: unknown);
    _movementBegin(baseLimitKmh?: unknown): import("./movement-authority.js").MovementDecision;
    _movementGo(): boolean;
    _movementStop(code?: string, reason?: string, source?: string, meta?: Record<string, unknown> | null): boolean;
    _movementCaution(limitKmh: unknown, code?: string, reason?: string, source?: string, meta?: Record<string, unknown> | null): import("./movement-authority.js").MovementDecision;
    _computePassageStops(): any[];
    getPassageStops(): unknown[];
    garageToVoiePoint(vpId: unknown): Promise<void>;
    resumeFromGarage(): void;
    getColor(): string;
    _v2ScheduleNowMinutes(dateStr: unknown, timeOfDay: number): number;
    _scheduleDiff(a: __KPM321, b: __KPM322): number;
    _scheduleGte(a: number, b: __KPM323): boolean;
    _timetableSpeedCap(timeOfDay: unknown, route: unknown): null;
    _isLiveResourceOwner(ownerId: unknown): any;
    _arrivalReservationOwnerIsFollower(ownerId: unknown, station: StationReservation, stop: ArrivalStopResource, resource?: ArrivalStopResource | null): boolean;
    _revokeFollowerArrivalReservation(ownerId: unknown, stationId: unknown, voiePointId?: unknown, platform?: unknown): void;
    _purgeStaleStationResources(stationId: unknown): void;
    _reserveArrivalResources(station: StationReservation, stop: ServiceStop): boolean;
    _beginDepartureResourceHold(stationId: unknown): void;
    _releaseDepartureResourcesIfTailClear(route?: unknown): void;
    _isPassengerService(): boolean;
    _holdForBookedArrival(timeOfDay: unknown): boolean;
    _commitNearEndpointArrival(route: unknown, timeOfDay: unknown, toleranceKm?: number): boolean;
    _scheduleInWindow(now: number, start: __KPM329, end: __KPM330): boolean;
    getNextStop(): ServiceStop | null;
    getTargetStation(): ArrivalStation | null;
    getCurrentStops(): ServiceStop[];
    _getCurrentFirstStop(): ServiceStop;
    _getWeatherEffects(): WeatherEffects;
    _referenceLoadRatio(): number;
    _currentMassKg(): number;
    _adhesionMassKg(): number;
    _gradePermilleAt(route?: unknown, segIdx?: number): number;
    _serviceBrakeMs2(): number;
    _brakeBuildSeconds(): number;
    _tractionBuildSeconds(): number;
    _applyPhysicalSpeedTarget(targetKmh: unknown, accelKmhS: number, decelKmhS: number, dt: unknown): number;
    _buildPlannedTimeProfile(route: unknown): {
        segTimes: Float64Array<ArrayBuffer>;
        cum: Float64Array<ArrayBuffer>;
        totalSec: number;
    } | null;
    _computePhysicsAccel(weather: __S3Struct695, route?: unknown, segIdx?: unknown): {
        accel: number;
        decel: number;
        accelMs2: any;
        decelMs2: any;
        gradePermille: number;
    };
    _resourceSection(route?: unknown, index?: number): {
        electrified?: undefined;
        voltage?: undefined;
        frequency?: undefined;
    } | {
        electrified: boolean;
        voltage: any[];
        frequency: any[];
    };
    _updateRegulationFactor(): void;
    _isElectricOnly(): boolean;
    _electrificationMismatch(route: ServiceRoute, segIdx: number): boolean;
    _distanceAheadToElectrificationMismatch(route?: unknown): number;
    _resolvedRouteSpeeds(route: ServiceRoute): number[];
    _getInfraSpeedLimit(route: ServiceRoute, segIdx: number, progress: unknown, trainLengthM: unknown): number;
    _getNegativeTransitionCap(route: unknown, segIdx: number, progress: number, currentSpeed: __KPM332): number | null;
    _yieldToRescue(): boolean;
    _isGarageRegulationActive(timeOfDay: number, dateStr?: string): boolean;
    _waitForConnection(stop: ServiceStop, timeOfDay: number, dateStr: string): boolean;
    /** Only a committed origin/return departure shuffles a marked consist. No station-stop redraws. */
    _prepareRandomDeparture(dateStr: string): void;
    _recordConnectionDeparture(stop: ServiceStop, timeOfDay: number, dateStr: string): void;
    _legacyEligibleDay(timeOfDay: number, dateStr: string): string | null;
    _legacyOriginEligible(timeOfDay: number): boolean;
    /** Admit/rearm dated legacy duties; V2 already owns absolute occurrences. */
    _prepareLegacyOperatingDay(timeOfDay: number, dateStr: string): boolean;
    _finishLegacyOperatingDay(): void;
    /** No station-level teleport after a consist has acquired a physical track. */
    _turnbackDepartureReady(stop: ServiceStop | undefined, timeOfDay: number, dateStr: string, returnLeg?: boolean): boolean;
    _materialTrackDepartureReady(stop: ServiceStop | undefined): boolean;
    scheduleTick(timeOfDay: number, dateStr: string, economy: Economy): void;
    /**
     * Centralized wear/km tracking. Called from moveUpdate and _moveDirectToTarget.
     */
    _trackWear(distKm: number, timeOfDay: number): void;
    /**
     * Reset simulation state when starting a new movement leg.
     */
    resumeAfterRepair(): void;
    _resetState(): void;
    /**
     * Initialize simulation state for the current route leg.
     * Computes route analysis and creates canton assignments.
     */
    _initializeState(route: ServiceRoute, legKey: unknown): void;
    _getMaxRuntimeForCurrentLeg(): number;
    _cancelBlockedService(timeOfDay: unknown): boolean;
    _updateStuckTimer(timeOfDay: unknown): boolean;
    _updateHeading(a: __S3Struct699, b: __S3Struct700): void;
    _isPassThroughStop(stop: ServiceStop | null | undefined): boolean;
    _routeForStopIndex(stopIndex: number): ServiceRoute | null;
    _passageContinuationIssue(): string | null;
    _holdAtInvalidPassage(): boolean;
    _passageLookAheadCap(route: ServiceRoute, timeOfDay: unknown): number | null;
    /**
     * Called every 0.5s - handles smooth train movement with strict route following.
     *
     * Movement rules:
     * 1. Follow route array sequentially, segment by segment
     * 2. effectiveSpeed = min(train.maxSpeed, segment.maxSpeed)
     * 3. Canton check: if next block occupied -> brake/stop
     * 4. Update progress via interpolation between two points
     * 5. On segment switch: release previous canton, reserve next
     * 6. Delay computed continuously during movement
     */
    moveUpdate(dt: number, timeOfDay: unknown, allServices: {
        "length": number;
    }): void;
    /**
     * Compute remaining distance from current position to end of route.
     */
    _getRemainingDistance(route: ServiceRoute): number;
    /**
     * Continuous delay computation during movement.
     * Uses per-segment time fractions mapped to scheduled stop times
     * for accurate delay even on routes with varying speed limits.
     *
     * Delay increases when:
     *  - speed < maxSpeed (infrastructure/incident constraints)
     *  - waiting for canton (blocked, speed = 0)
     */
    _updateDelayReason(): void;
    _updateContinuousDelay(timeOfDay: unknown): void;
    /**
     * Fallback movement toward target station when no ORM route is available.
     */
    _moveDirectToTarget(dt: unknown, timeOfDay: unknown, target: unknown): boolean;
    /**
     * Proximity-based block check fallback (when canton data unavailable).
     */
    _distanceToRouteIndexM(route: ServiceRoute, targetIndex: unknown): number;
    _brakingCurveCapKmh(distanceM: unknown, targetKmh?: unknown, marginM?: unknown, decelMs2?: unknown, planningFactor?: unknown): number;
    _setRouteProgressKm(route: ServiceRoute, targetKm: unknown): void;
    _routeCumulativeKm(route: ServiceRoute): Float64Array;
    _projectRoutePosition(pos: {
        lat: number;
        lon: number;
    }, route: ServiceRoute, hintIndex?: unknown, windowKm?: number): {
        progressKm: number;
        distanceKm: number;
        segmentIndex: number;
        t: number;
    };
    _currentFrontKm(route?: unknown): number;
    _routePositionAtKm(route: unknown, targetKm: unknown): {
        lat: number;
        lon: number;
        wayId?: undefined;
    } | {
        lat: any;
        lon: any;
        wayId: any;
    } | null;
    _reserveUpcomingTroncon(vpm: TronconManager, route: ServiceRoute, currentTrc?: TronconResource | null): {
        limit: number;
        distanceKm: number;
        blocked: boolean;
        troncon: TronconResource;
    } | null;
    _syncTronconTail(vpm: TronconManager, currentTrc: TronconResource | null): void;
    _restoreHeldDepartureSafety(): void;
    _restoreStationarySafetyFootprint(): boolean | undefined;
    _reserveOriginSafetyFootprint(): boolean;
    _capturePassageTailSpeedLimits(route: ServiceRoute | null): void;
    _getPassageTailSpeedLimit(): number;
    _captureCantonCarryover(): void;
    _syncCantonFootprint(route?: ServiceRoute | null): any;
    _getRouteProgressKm(pos: {
        lat: number;
        lon: number;
    }, route: ServiceRoute, hintIndex: unknown): number;
    _wayIdsAround(route: ServiceRoute, index: unknown, radiusKm?: number): Set<unknown>;
    _wayIdsAlong(route: ServiceRoute, index: unknown, aheadKm?: number, behindKm?: number): Set<unknown>;
    _safetyHorizonKm(speedKmh?: unknown): number;
    _safetyCandidatePool(allServices: unknown, radiusKm?: number): ActiveService[];
    _stationaryPhysicalTrackRef(): string | number | null;
    _findPhysicalLeader(allServices: unknown, route: ServiceRoute, radiusKm?: number): PhysicalLeader | null;
    _clipAdvanceToPhysicalLeader(route: ServiceRoute, requestedKm: number): number;
    _proximityBlockCheck(allServices: unknown): number | null;
    /**
     * IPCS runtime helpers: stop trains travelling in opposite directions on the same track.
     */
    _getIpcsCandidates(candidates: unknown): {};
    _isNearRoute(pos: __S3Struct710, route: ServiceRoute, hintIndex?: number): boolean;
    _ipcsBlockCheck(candidates?: unknown): number | null;
    /**
     * The distant-train entry point deliberately shares the complete movement
     * controller. LOD may batch elapsed time in main.moveTick, but must not have
     * its own braking, resource ownership, route transition or mileage rules.
     * RC9 duplicated these rules and applied the endpoint brake twice in macro.
     */
    moveMacro(dt: number, timeOfDay: unknown, economy: Economy, allServices: unknown): void;
    update(timeOfDay: number, dateStr: string, economy: Economy, allServices: unknown): void;
    _canSafelyReversePhysicalRoute(route: unknown): boolean;
    _getStationaryRoute(): ServiceRoute | null;
    getCurrentRoute(): ServiceRoute | null;
    /**
     * Get infrastructure speed limit at current position.
     * Uses segment data from _state for precision when available.
     */
    getLineSpeedAtPosition(): number;
    getWorksSpeedLimit(timeOfDay: number): number | null;
    _distanceAheadToRestriction(route: unknown, restriction: {
        route: unknown;
        stationOnly: unknown;
        stationId: unknown;
        stationA: unknown;
        stationLat: unknown;
        stationLon: unknown;
    }): number;
    _computeWorksLimit(route: ServiceRoute, dateStr: unknown, timeOfDay: unknown): number | null;
    _pointToSegmentDistKm(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number): number;
    _minDistToPolyline(lat: unknown, lon: unknown, polyline: ServiceRoute): number;
    _routeIntersectsPolyline(route: ServiceRoute, polyline: ServiceRoute, bufferKm?: number): boolean;
    _routesShareOsmWay(route: ServiceRoute, polyline: ServiceRoute): boolean | null;
    _isFallbackRoute(route: unknown): boolean;
    _getBlockingWorksForRoute(route: ServiceRoute, dateStr: unknown, timeOfDay: unknown): {
        impact: string;
        speedLimit: number | null | undefined;
        stationOnly: boolean | undefined;
        stationId: string | undefined;
        stationLat: unknown;
        stationLon: unknown;
        stationA: string | undefined;
        stationB: string | undefined;
        route: ServiceRoute | undefined;
        startBinding?: unknown;
        endBinding?: unknown;
        direction?: string;
        workId?: string;
        zoneId?: string;
    }[];
    _findAlternateRoute(prevId: string, nextId: string, dateStr: string, timeOfDay: number): Promise<any>;
    _startAlternateRouteSearch(timeOfDay: number, dateStr: string): void;
    _applyAlternateRoute(route: ServiceRoute, timeOfDay: unknown): void;
    arriveAtStation(station: ArrivalStation, timeOfDay: number, economy: Economy): void;
    _releaseAllPhysicalResources(): void;
    _terminalOperationPending(): boolean;
    completeService(economy: Economy, station?: ArrivalStation | null, arrivalLat?: number | null, arrivalLon?: number | null): void;
    _rebuildStopsFromTime(departureTime: __KPM361): ServiceStop[];
    _buildAdjustedStops(sourceStops?: ServiceStop[], rng?: () => number): ServiceStop[];
    buildReturnStops(): ServiceStop[];
    _buildIndependentReturnStops(fwdStops: ServiceStop[]): ServiceStop[];
}
export type ActiveServiceLike = ActiveService & {
    id: string;
    name: string;
    train: Record<string, unknown>;
    rame: Rame;
    position: {
        lat: number;
        lon: number;
    } | null;
    state: string;
    active: boolean;
    completed: boolean;
    cancelled: boolean;
    category: string;
    serviceType: string;
    routes: unknown[];
    _returnRoutes: unknown[];
    _garageStationId: string;
    _garageUntil: number;
    _garageUntilDate: string;
};
type RameUsageEntry = {
    moving: unknown | null;
    waiting: Map<unknown, number>;
};
type StationPriorityEntry = {
    map: Map<unknown, number>;
};
export declare class ScheduleCreator {
    services: ActiveService[];
    weather: unknown | null;
    _activeCache?: ActiveService[];
    _activeCacheVer?: number;
    _movingCache?: ActiveService[];
    _movingCacheVer?: number;
    _serviceVer?: number;
    _indexTime?: unknown;
    _rameUsage: Map<unknown, RameUsageEntry>;
    _stationPriority: Map<unknown, StationPriorityEntry>;
    constructor();
    addService(data: unknown, rame: Rame, world: World): ActiveService;
    ensureEVOForService(svc: ActiveService, world: World, timeOfDay: unknown): ActiveService | null;
    duplicateService(id: unknown, intervalMin: number, count: number, rame: Rame, world: World): ActiveService[];
    createAutoRoundTripDuplicates(baseService: ActiveService, requestedCount: number, oneRoundTripMin: number, rame: Rame, world: World): ActiveService[];
    removeService(id: unknown): void;
    getActiveServices(): ActiveService[];
    _invalidateActiveCache(): void;
    beginTick(timeOfDay: unknown): void;
    _addToTickIndexes(svc: ActiveService, timeOfDay: unknown): void;
    _removeFromTickIndexes(svc: ActiveService): void;
    updateServiceIndexes(svc: ActiveService, timeOfDay: unknown): void;
    isRameInUse(rameId: unknown, excludeId: string, timeOfDay: unknown): boolean;
    getEarliestDueServiceAtStation(stationId: unknown, timeOfDay: unknown): {
        id: {};
        dep: number | null;
    } | null;
    /**
     * Returns only services that are currently moving (need physics update).
     * Uses cached subset, rebuilt when version changes.
     */
    getMovingServices(): ActiveService[];
    /**
     * Rebuild moving cache after state transitions in scheduleTick/moveUpdate.
     * Called once per tick cycle.
     */
    refreshMovingCache(): void;
    _encodeRouteForSave(route: unknown): Record<string, unknown> | null;
    _runtimeRouteRef(service: ActiveService, route: unknown): {
        s: string;
        i: number;
    } | null;
    _runtimeRouteFromRef(service: ActiveService, ref: {
        s: unknown;
        i: unknown;
    }, encoded?: unknown): ServiceRoute | null;
    toSave(): ((Record<string, unknown> & {
        _r: Record<string, unknown>;
    }) | {
        id: string;
        name: string;
        rameId: unknown;
        stops: never[];
        routes: never[];
        active: boolean;
        _saveError: boolean;
    })[];
    _decodeRoutes(routes: unknown): unknown[][];
    _expandCompactService(d: unknown[]): unknown[] | Record<string, unknown>;
    loadFromSave(input: unknown, rameManager: RameManager, world: World, timeOfDay?: number, dateStr?: string): void;
}
type __S3Struct695 = {
    "type": string;
};
type __S3Struct699 = {
    "lat": number;
    "lon": number;
};
type __S3Struct700 = {
    "lat": number;
    "lon": number;
};
type __S3Struct710 = {
    "lat": number;
    "lon": number;
};
