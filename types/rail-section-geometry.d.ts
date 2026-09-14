export declare const RAIL_SECTION_DIRECTIONS: Readonly<{
    readonly BOTH: "both";
    readonly FORWARD: "forward";
    readonly REVERSE: "reverse";
}>;
export type RailSectionDirection = typeof RAIL_SECTION_DIRECTIONS[keyof typeof RAIL_SECTION_DIRECTIONS];
export interface RailPoint {
    lat: number;
    lon: number;
    wayId?: string;
    fallback?: boolean;
    synthetic?: boolean;
    [key: string]: unknown;
}
export interface RailBinding {
    lat: number;
    lon: number;
    snapLat: number;
    snapLon: number;
    wayId?: string;
    trackRef?: string;
    [key: string]: unknown;
}
export interface RailSectionLike {
    id?: unknown;
    name?: unknown;
    startBinding?: unknown;
    endBinding?: unknown;
    constraints?: unknown;
    route?: unknown;
    segments?: unknown;
    distanceKm?: unknown;
    length?: unknown;
    direction?: unknown;
    manual?: unknown;
    cargoType?: unknown;
    role?: unknown;
    [key: string]: unknown;
}
export interface RailSectionDefaults {
    id?: unknown;
    name?: unknown;
    direction?: unknown;
    cargoType?: unknown;
    role?: unknown;
    [key: string]: unknown;
}
export interface NormalizedRailSection {
    id: string;
    name: string;
    startBinding: RailBinding | null;
    endBinding: RailBinding | null;
    constraints: unknown[];
    route: RailPoint[];
    segments: unknown[];
    distanceKm: number;
    length: number;
    direction: RailSectionDirection;
    manual: boolean;
    cargoType: string;
    role: string;
}
export declare function normalizeSectionDirection(value: unknown): RailSectionDirection;
export declare function sectionDirectionLabel(value: unknown): string;
export declare function cloneRailValue<T>(v: T): T;
export declare function cleanRailBinding(v: unknown): RailBinding | null;
export declare function cleanRailRoute(route: unknown): RailPoint[];
export declare function normalizeRailSection(data?: RailSectionLike, defaults?: RailSectionDefaults): NormalizedRailSection;
export declare function railSectionDirectionMatchesRoute(trainRoute: unknown, section: RailSectionLike | null | undefined): boolean;
