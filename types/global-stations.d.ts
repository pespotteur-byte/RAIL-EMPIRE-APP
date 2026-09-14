type StationProgress = Record<string, unknown>;
type StationProgressCallback = ((progress: StationProgress) => void) | null;
type QueryRow = {
    station?: unknown;
    railway?: unknown;
    name?: unknown;
    centroid?: unknown;
    stationKind?: unknown;
    train?: unknown;
    subway?: unknown;
    tram?: unknown;
    lightRail?: unknown;
    monorail?: unknown;
    uicRef?: unknown;
    ref?: unknown;
    operator?: unknown;
    network?: unknown;
    wikidata?: unknown;
    wheelchair?: unknown;
    [key: string]: unknown;
};
type WorldStation = QueryRow & {
    id: string;
    lat: number;
    lon: number;
    type?: string;
    osmType?: unknown;
    osmId?: unknown;
    reference?: boolean;
    source?: unknown;
    country?: unknown;
    _normName?: string;
};
export declare const WORLD_STATION_QUERY = "\nPREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>\nPREFIX geo: <http://www.opengis.net/ont/geosparql#>\nSELECT ?station ?railway ?centroid\n       (SAMPLE(?name0) AS ?name)\n       (SAMPLE(?stationKind0) AS ?stationKind)\n       (SAMPLE(?train0) AS ?train)\n       (SAMPLE(?subway0) AS ?subway)\n       (SAMPLE(?tram0) AS ?tram)\n       (SAMPLE(?lightRail0) AS ?lightRail)\n       (SAMPLE(?monorail0) AS ?monorail)\n       (SAMPLE(?uicRef0) AS ?uicRef)\n       (SAMPLE(?ref0) AS ?ref)\n       (SAMPLE(?operator0) AS ?operator)\n       (SAMPLE(?network0) AS ?network)\n       (SAMPLE(?wikidata0) AS ?wikidata)\n       (SAMPLE(?wheelchair0) AS ?wheelchair)\nWHERE {\n  {\n    VALUES ?railway { \"station\" \"halt\" }\n    ?station osmkey:railway ?railway .\n  } UNION {\n    ?station osmkey:public_transport \"station\" ;\n             osmkey:train \"yes\" .\n    BIND(\"station\" AS ?railway)\n  }\n  ?station geo:hasCentroid/geo:asWKT ?centroid .\n  OPTIONAL { ?station osmkey:name ?name0 . }\n  OPTIONAL { ?station osmkey:station ?stationKind0 . }\n  OPTIONAL { ?station osmkey:train ?train0 . }\n  OPTIONAL { ?station osmkey:subway ?subway0 . }\n  OPTIONAL { ?station osmkey:tram ?tram0 . }\n  OPTIONAL { ?station osmkey:light_rail ?lightRail0 . }\n  OPTIONAL { ?station osmkey:monorail ?monorail0 . }\n  OPTIONAL { ?station osmkey:uic_ref ?uicRef0 . }\n  OPTIONAL { ?station osmkey:ref ?ref0 . }\n  OPTIONAL { ?station osmkey:operator ?operator0 . }\n  OPTIONAL { ?station osmkey:network ?network0 . }\n  OPTIONAL { ?station osmkey:wikidata ?wikidata0 . }\n  OPTIONAL { ?station osmkey:wheelchair ?wheelchair0 . }\n}\nGROUP BY ?station ?railway ?centroid";
export declare function loadEmbeddedStationPack(onProgress?: ((progress: Record<string, unknown>) => void) | null): Promise<{
    stations: WorldStation[];
    pack: {
        prepared?: boolean;
        shards?: unknown[];
        source?: string;
        datasetKind?: string;
        generatedAt?: string;
    };
} | null>;
export declare function dedupeWorldStations(stations: unknown): WorldStation[];
export declare function parseWorldStationResponse(data: unknown): WorldStation[];
export declare class GlobalStationCatalog {
    stations: WorldStation[];
    loaded: boolean;
    source: string;
    cacheTimestamp: number;
    refreshPromise: Promise<unknown> | null;
    constructor();
    load(onProgress?: StationProgressCallback, onRefreshed?: unknown): Promise<WorldStation[]>;
    refresh(onProgress?: StationProgressCallback): Promise<WorldStation[]>;
}
export {};
