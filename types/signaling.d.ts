export declare const ASPECT: {
    readonly CLEAR: "clear";
    readonly CAUTION: "caution";
    readonly CLOSED: "closed";
};
export type SignalAspect = typeof ASPECT[keyof typeof ASPECT];
export declare const CARRE_STOP_MARGIN_M = 30;
export declare const RESTART_SPEED_KMH = 60;
export declare function cantonLengthKm(lineSpeedKmh: number): number;
export declare function visaSpeedCapKmh(distToClosedSignalM: number, marginM?: number): number | null;
export declare function aspectFromOccupancy(nextOccupied: boolean, secondOccupied: boolean): SignalAspect;
export declare function aspectSpeedCapKmh(aspect: SignalAspect | string, lineSpeedKmh: number, distToSignalM?: number, marginM?: number): number;
export type PlayerSignalType = 'ralentissement' | 'avertissement' | 'arret' | string;
export interface PlayerSignalData {
    id?: string;
    name?: string;
    stationA?: string;
    stationB?: string;
    type?: PlayerSignalType;
    speedLimit?: number;
    active?: boolean;
    xKm?: number;
}
export declare class PlayerSignal {
    id: string;
    name: string;
    stationA: string;
    stationB: string;
    type: PlayerSignalType;
    speedLimit: number;
    active: boolean;
    xKm: number;
    constructor(data: PlayerSignalData);
}
export declare class PlayerSignalManager {
    signals: PlayerSignal[];
    add(data: PlayerSignalData): PlayerSignal;
    remove(id: string): void;
    getAll(): PlayerSignal[];
    getSpeedLimit(stationA: string, stationB: string): number | null;
    toSave(): PlayerSignalData[];
    loadFromSave(arr: PlayerSignalData[] | null | undefined): void;
}
