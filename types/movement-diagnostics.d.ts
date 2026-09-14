export declare function buildMovementDiagnostics(input: unknown, now?: number, requestedLimit?: number): {
    schemaVersion: number;
    build: string;
    exportedAtMs: number | null;
    note: string;
    context: {
        date: string;
        timeOfDay: number | null;
        page: string;
        running: boolean;
        hasSpatialIndex: boolean;
    };
    counts: {
        total: number;
        active: number;
        moving: number;
        slowMoving: number;
        stoppedByAuthority: number;
        invalidEntries: number;
    };
    sampled: number;
    truncated: number;
    services: {
        id: string;
        name: string;
        state: string;
        active: boolean;
        position: {
            lat: number;
            lon: number;
        } | null;
        speedKmh: number | null;
        displaySpeedKmh: number | null;
        totalDistanceKm: number | null;
        delayReason: string;
        lod: string;
        pendingMacroSec: {
            medium: number | null;
            low: number | null;
        };
        brakeEffort: number | null;
        tractiveEffort: number | null;
        lastDecelMs2: number | null;
        authority: {
            status: string;
            code: string;
            source: string;
            reason: string;
            speedLimitKmh: number | null;
        };
        route: {
            key: string;
            legKey: string;
            expectedLegKey: string;
            pointCount: number;
            index: number | null;
            progress: number | null;
            wayId: string;
            maxSpeed: number | null;
            maxSpeedSource: string;
            electrified: boolean | null;
            incline: string;
        };
        nextStop: {
            stationId: string;
            type: string;
            arrivalTime: number | null;
            departureTime: number | null;
        };
        material: {
            id: string;
            traction: string;
            massT: number | null;
            lengthM: number | null;
            powerKw: number | null;
            maxSpeedKmh: number | null;
            inMaintenance: boolean;
        };
        obstruction: {
            signal: string;
            incidentId: string;
            incidentEffect: string;
            breakdown: string;
            rescueDispatched: boolean;
            departureTailHeld: boolean;
            nearbyCount: number;
        };
    }[];
    rescues: {
        id: string;
        state: string;
        targetServiceId: string;
        position: {
            lat: number;
            lon: number;
        } | null;
        speedKmh: number | null;
        routeIndex: number | null;
        retrySec: number | null;
        accessDenied: boolean;
        message: string;
    }[];
    rescuesTruncated: number;
};
