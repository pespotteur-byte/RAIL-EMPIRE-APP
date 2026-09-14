/**
 * RC10 — positive, local railway-connectivity evidence for industrial offers.
 * No geographic-neighbour shortcut, no inferred bridge and no network requests.
 * Availability of a compatible consist and of a train path remains a separate
 * check when assigning a contract to an actual service.
 */
type Point = {
    lat?: unknown;
    lon?: unknown;
    fallback?: unknown;
    synthetic?: unknown;
    closed?: unknown;
    railway?: unknown;
    railwayLifecycle?: unknown;
    oneway?: unknown;
    bidirectional?: unknown;
    service?: unknown;
    tags?: Record<string, unknown>;
};
type NetworkStation = {
    id: string;
    closed?: boolean;
    lat?: unknown;
    lon?: unknown;
};
type NetworkTrack = {
    stationA: string;
    stationB: string;
    route?: readonly Point[];
    worksActive?: boolean;
    worksImpact?: unknown;
    incidentActive?: boolean;
    incidentEffect?: unknown;
};
export type FreightNetworkWorld = {
    stations: readonly NetworkStation[];
    tracks?: readonly NetworkTrack[];
};
export type FreightRailLeg = {
    fromId: string;
    toId: string;
    route: readonly Point[];
    reverseAllowed?: boolean;
};
type Location = {
    id: string;
    stationId?: string;
    technicalLocationId?: string;
};
type Path = {
    legs?: readonly {
        fromLocationId: string;
        toLocationId: string;
        routePoints?: readonly Point[];
    }[];
    error?: string;
    topologyRevision?: number;
    resolvedRevision?: number;
};
type Version = {
    state: string;
    locations: readonly Location[];
    outboundPath?: Path;
    returnPath?: Path | null;
    validationReport?: {
        issues?: readonly {
            level?: string;
        }[];
    } | null;
};
type ScheduleModel = {
    schedules?: readonly {
        currentVersion?: Version | null;
    }[];
};
type Service = {
    _v2OccurrenceId?: unknown;
    stops?: readonly {
        stationId?: string;
        technicalLocationId?: string;
    }[];
    routes?: readonly (readonly Point[])[];
    _returnStopsData?: readonly {
        stationId?: string;
    }[] | null;
    _returnRoutes?: readonly (readonly Point[])[] | null;
};
/** Extract only current VALID V2 paths, plus already-authored legacy routes. */
export declare function collectFreightRailLegs(model?: ScheduleModel | null, services?: readonly Service[]): FreightRailLeg[];
export declare class FreightNetwork {
    private readonly edges;
    private readonly closed;
    readonly stations: Set<string>;
    edgeCount: number;
    constructor(world: FreightNetworkWorld, extra?: readonly FreightRailLeg[]);
    private link;
    /** An iterative traversal handles cycles and long networks without call-stack growth. */
    reachableStations(origin: string): Set<string>;
}
export {};
