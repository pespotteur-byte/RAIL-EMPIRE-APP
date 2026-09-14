import type { World } from './world.js';
type SillonPoint = {
    lat: number;
    lon: number;
    maxSpeed?: number;
    electrified?: boolean;
    [key: string]: unknown;
};
export declare class Sillon {
    id: string;
    name: string;
    fromStationId: string;
    toStationId: string;
    fromStationName: string;
    toStationName: string;
    route: SillonPoint[];
    distance: number;
    maxSpeed: number;
    electrified: boolean;
    createdDate: string;
    constructor(input?: unknown);
    get isValid(): boolean | "";
}
export declare class SillonManager {
    sillons: Sillon[];
    constructor();
    add(data: unknown): Sillon | null;
    remove(id: string): void;
    getById(id: string): Sillon | undefined;
    getAll(): Sillon[];
    getBetween(fromStationId: string, toStationId: string): Sillon[];
    getNextName(fromStationId: string, toStationId: string): string;
    _samePoint(a: SillonPoint, b: SillonPoint): boolean;
    _pathEntry(route: Sillon[]): {
        id: string;
        name: string;
        fromStationId: string;
        toStationId: string;
        fromStationName: string;
        toStationName: string;
        route: SillonPoint[];
        distance: number;
        maxSpeed: number;
        electrified: boolean;
        segments: unknown[];
        _isPath: boolean;
    } | null;
    findPaths(fromStationId: string, toStationId: string, maxHops?: number): ({
        id: string;
        name: string;
        fromStationId: string;
        toStationId: string;
        fromStationName: string;
        toStationName: string;
        route: SillonPoint[];
        distance: number;
        maxSpeed: number;
        electrified: boolean;
        segments: unknown[];
        _isPath: boolean;
    } | null)[];
    toSave(): {
        id: unknown;
        name: unknown;
        fromStationId: unknown;
        toStationId: unknown;
        fromStationName: unknown;
        toStationName: unknown;
        route: unknown;
        distance: unknown;
        maxSpeed: unknown;
        electrified: unknown;
        createdDate: unknown;
    }[];
    loadFromSave(arr: unknown, world?: World | null): void;
}
export {};
