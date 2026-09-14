import { type IncidentScheduledStop } from './scheduled-incident-stop.js';
import type { Weather } from './weather.js';
type IncidentType = {
    id: string;
    name: string;
    impact: string;
    special: string;
    probability: number;
    seasons: string[];
    durationMin: number;
    durationMax: number;
    effect: string;
    speedLimit: number;
    scope: string;
    summerProbability?: number;
    requireElectrified?: boolean;
    requirePassenger?: boolean;
    requirePassengerService?: boolean;
    requireStopped?: boolean;
    pureStation?: boolean;
    timeWindows?: Array<[number, number]>;
    probabilityLabel?: string;
    weatherTriggered?: boolean;
    weatherHazard?: string;
    weatherRatePerHour?: number;
    weatherMinHazard?: number;
};
type IncidentRoutePoint = {
    lat: number;
    lon: number;
    wayId?: unknown;
    way_id?: unknown;
};
type IncidentInput = Record<string, unknown>;
type IncidentStation = {
    id?: string | number;
    stationId?: string | number;
    name?: string;
    lat?: number;
    lon?: number;
    platforms?: unknown;
};
type IncidentTrack = {
    id?: string | number;
    stationA?: string | number;
    stationB?: string | number;
    name?: string;
    route?: unknown;
    electrified?: boolean;
    wayId?: string | number;
    _incidentIds?: string[];
    incidentActive?: boolean;
    incidentEffect?: string | null;
    incidentSpeedLimit?: number | null;
    incidentName?: string | null;
};
type IncidentWorld = {
    stations?: IncidentStation[];
    tracks?: IncidentTrack[];
    getStationById?: (id: unknown) => IncidentStation | null | undefined;
};
type IncidentDelayReason = {
    incidentId?: string | number;
    typeId?: string;
    text?: string;
    startDelay?: number;
    lastDelay?: number;
    endDelay?: number;
    active?: boolean;
    contributed?: boolean;
    _drop?: boolean;
};
type IncidentStoppedAt = string | number | {
    id?: string | number;
    stationId?: string | number;
    name?: string;
} | null;
type IncidentTrain = Record<string, unknown> & {
    id?: string | number;
    name?: string;
    stoppedAt?: IncidentStoppedAt;
    decel?: number;
    incident?: unknown;
    rame?: {
        totalCapacity?: number;
    } | null;
    totalCapacity?: number;
    incidentDelayReasons?: IncidentDelayReason[];
    delay?: number;
    delayReason?: string;
    state?: string;
};
type IncidentStop = IncidentScheduledStop;
type IncidentService = {
    id?: string | number;
    name?: string;
    number?: string | number;
    state?: string;
    position?: {
        lat?: number;
        lon?: number;
    } | null;
    speed?: number;
    delay?: number;
    serviceType?: string;
    category?: string;
    train?: IncidentTrain;
    rame?: {
        totalCapacity?: number;
    } | null;
    stops?: IncidentStop[];
    currentStopIndex?: number;
    getCurrentStops?: () => IncidentStop[];
    _state?: {
        cachedRoute?: Array<{
            lat: number;
            lon: number;
            wayId?: unknown;
            way_id?: unknown;
        }>;
        segDists?: number[];
        index: number;
        progress: number;
    };
    _safetyHorizonKm?: (...args: unknown[]) => number;
    _lastPhysicsDecelMs2?: number;
};
type IncidentDepotManager = {
    activeRescues?: Array<{
        targetServiceId?: string | number;
        state?: string;
    }>;
    dispatchRescue?: (world: IncidentWorld, svc: IncidentService) => unknown;
};
type IncidentLocation = {
    key: string;
    text: string;
    stationA: string | null;
    stationB: string | null;
    stationAName: string;
    stationBName: string;
};
type IncidentWeatherState = Record<string, unknown> & {
    windGust?: number;
    precipitation?: number;
    temperature?: number;
    snowfall?: number;
    rain6hMm?: number;
    rain24hMm?: number;
    snowDepthCm?: number;
    risk?: IncidentWeatherRisk;
};
type IncidentWeatherRisk = Record<string, unknown> & {
    hazards?: Record<string, number>;
    level?: {
        label?: string;
    };
};
type IncidentWeatherCandidate = {
    loc: IncidentLocation;
    track: IncidentTrack | null;
    svc: IncidentService | null;
    point: {
        lat: number;
        lon: number;
    };
    state?: IncidentWeatherState;
    risk?: IncidentWeatherRisk;
    hazard?: number;
};
export declare const PREDEFINED_INCIDENT_TYPES: IncidentType[];
export declare class Incident {
    id: string;
    typeId: string;
    name: string;
    trackName: string;
    stationA: string | null;
    stationB: string | null;
    stationAName: string;
    stationBName: string;
    trainId: string | null;
    trainName: string | null;
    serviceId: string | null;
    effect: string;
    speedLimit: number;
    route: IncidentRoutePoint[] | null;
    duration: number;
    remaining: number;
    active: boolean;
    startTime: number;
    locationText: string;
    locationKey: string;
    source: string;
    triggerText: string;
    weatherLevel: string;
    weatherHazard: string;
    _bbox?: [number, number, number, number];
    train?: IncidentTrain;
    constructor(data?: IncidentInput);
}
export declare class IncidentManager {
    activeIncidents: Incident[];
    lastCheck: unknown;
    predefinedTypes: IncidentType[];
    enabledTypes: Set<unknown>;
    targetIncidentsPerHour: number;
    _incidentSpawnCredit: number;
    _incidentSpawnLastAbsMinute: number | null;
    _weatherIncidentLastAbsMinute: number | null;
    _weatherIncidentCredit: Record<string, number>;
    _weatherSampleCursor: number;
    _incBboxVer: number | null;
    incidentTypesVersion: number;
    accordionHorizonKm: number;
    constructor();
    isTypeEnabled(id: unknown): boolean;
    getEnabledTypes(): unknown[];
    setEnabledTypes(ids: unknown, savedVersion?: unknown): void;
    toggleType(id: unknown, enabled: unknown): boolean;
    _normalizeIncidentLocationText(text: unknown): string;
    _locationKeyFromParts(stationA: unknown, stationB: unknown, locationText?: unknown): string;
    _locationKeyForIncident(inc: Incident): string;
    _hasActiveDuplicate(typeId: unknown, locationKey: unknown, ignoreId?: unknown): boolean;
    _serviceLocationDescriptor(svc: IncidentService, world: IncidentWorld): {
        key: string;
        text: string;
        stationA: string | null;
        stationB: string | null;
        stationAName: string;
        stationBName: string;
    };
    createIncident(data: unknown, world: IncidentWorld | null): Incident | null;
    _recomputeTrackIncidentVisual(track: IncidentTrack): void;
    _markAffectedTracks(inc: Incident, world: IncidentWorld): void;
    removeIncident(id: unknown, world: IncidentWorld): void;
    _clearTrackFlags(inc: Pick<Incident, 'id'>, world: IncidentWorld): void;
    _isOnRoute(lat: unknown, lon: unknown, route: IncidentRoutePoint[] | null | undefined): boolean;
    _pointToSegmentDist(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number): number;
    _isBetweenStations(lat: number, lon: number, world: IncidentWorld, inc: Pick<Incident, 'stationA' | 'stationB'>): boolean;
    _incidentMatchesServiceLeg(svc: IncidentService, inc: Pick<Incident, 'stationA' | 'stationB'>): boolean;
    _distanceAheadOnRoute(svc: IncidentService, targetLat: number, targetLon: number, targetWayId?: unknown): number | null;
    getApproachingIncident(svc: IncidentService, world: IncidentWorld): {
        effect: string;
        speedLimit: number;
        name: string;
        approaching: boolean;
    } | null;
    _randomDuration(min: number, max: number): number;
    _probabilityForType(type: IncidentType, season: unknown): number;
    _inTimeWindow(type: IncidentType, timeOfDay: number): boolean;
    _spawnType(type: IncidentType, services: IncidentService[], world: IncidentWorld, timeOfDay: unknown): Incident | null;
    _weightedType(pool: IncidentType[], season: unknown): IncidentType | null;
    _spawnGuaranteedIncident(timeOfDay: unknown, services: IncidentService[], world: IncidentWorld, season: unknown): Incident | null;
    _absoluteGameMinute(dateStr: unknown, timeOfDay: unknown): number | null;
    _trySpawn(timeOfDay: unknown, services: IncidentService[], world: IncidentWorld, season: unknown, dateStr?: unknown): number;
    _weatherTrackPoint(track: IncidentTrack, world: IncidentWorld): {
        lat: number;
        lon: number;
    } | null;
    _weatherTrackForLocation(loc: Pick<IncidentLocation, 'stationA' | 'stationB'>, world: IncidentWorld): IncidentTrack | null;
    _weatherCandidates(services: IncidentService[], world: IncidentWorld): IncidentWeatherCandidate[];
    _weatherTriggerText(type: Pick<IncidentType, 'weatherHazard'>, state: IncidentWeatherState): string;
    _spawnWeatherAt(type: IncidentType, candidate: IncidentWeatherCandidate, state: IncidentWeatherState, risk: IncidentWeatherRisk, timeOfDay: unknown, world: IncidentWorld): Incident | null;
    _tryWeatherIncidents(timeOfDay: unknown, services: IncidentService[], world: IncidentWorld, dateStr: unknown, weather: Weather | null): number;
    _incidentLocationText(inc: Incident, world: IncidentWorld): string;
    _describeServiceLocation(svc: IncidentService, world: IncidentWorld): string;
    formatIncidentReason(inc: Incident, world: IncidentWorld): string;
    _syncIncidentDelayReasons(svc: IncidentService, matchedIncidents: Incident[], world: IncidentWorld): void;
    _spawnTrackIncident(type: IncidentType, world: IncidentWorld, timeOfDay?: unknown): Incident | null;
    _spawnPureStationIncident(type: IncidentType, world: IncidentWorld, stationOverride?: IncidentStation | null, timeOfDay?: unknown): Incident | null;
    _spawnStationOrTrackIncident(type: IncidentType, world: IncidentWorld, timeOfDay?: unknown): Incident | null;
    _spawnStationIncident(type: IncidentType, world: IncidentWorld, timeOfDay?: unknown): Incident | null;
    _spawnTrainIncident(type: IncidentType, services: IncidentService[], timeOfDay: unknown, world: IncidentWorld): Incident | null;
    update(timeOfDay: unknown, services: IncidentService[], depotManager: IncidentDepotManager, world: IncidentWorld, dateStr: unknown, season: unknown, weather?: Weather | null, elapsedMinutes?: number): void;
    checkTrainPositions(services: IncidentService[], depotManager: IncidentDepotManager, world: IncidentWorld): void;
    getActiveIncidents(): Incident[];
    getActiveIncidentsOnLine(lineStops?: string[]): Incident[];
    getBulletins(): {
        id: string;
        name: string;
        location: string;
        remaining: number;
        effect: unknown;
        speedLimit: number;
    }[];
    getCustomTypes(): never[];
    loadCustomTypes(): void;
    getAllTypes(): {
        origin: string;
        enabled: boolean;
        id: string;
        name: string;
        impact: string;
        special: string;
        probability: number;
        seasons: string[];
        durationMin: number;
        durationMax: number;
        effect: string;
        speedLimit: number;
        scope: string;
        summerProbability?: number;
        requireElectrified?: boolean;
        requirePassenger?: boolean;
        requirePassengerService?: boolean;
        requireStopped?: boolean;
        pureStation?: boolean;
        timeWindows?: Array<[number, number]>;
        probabilityLabel?: string;
        weatherTriggered?: boolean;
        weatherHazard?: string;
        weatherRatePerHour?: number;
        weatherMinHazard?: number;
    }[];
    /** RC18: versioned cadence is part of the simulation, not a disposable cache. */
    getCadenceSave(): {
        schemaVersion: number;
        lastCheck: unknown;
        spawnCredit: number;
        spawnLastAbsMinute: number | null;
        weatherLastAbsMinute: number | null;
        weatherCredit: {
            [x: string]: number;
        };
        weatherSampleCursor: number;
        targetIncidentsPerHour: number;
        nextId: number;
    };
    loadCadenceSave(value: unknown): void;
    getActiveIncidentsSave(): {
        id: string;
        typeId: string;
        name: string;
        trackName: string;
        stationA: string | null;
        stationB: string | null;
        stationAName: string;
        stationBName: string;
        locationText: string;
        locationKey: string;
        trainId: string | null;
        trainName: string | null;
        serviceId: string | null;
        effect: string;
        speedLimit: number;
        route: IncidentRoutePoint[] | null;
        duration: number;
        remaining: number;
        active: boolean;
        startTime: number;
        source: string;
        triggerText: string;
        weatherLevel: string;
        weatherHazard: string;
    }[];
    loadFromSave(arr: unknown, world: IncidentWorld): void;
}
export {};
