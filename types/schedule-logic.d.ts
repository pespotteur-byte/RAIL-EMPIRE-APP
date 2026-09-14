export declare const DEFAULT_TERMINUS_WAIT_MIN = 5;
export declare const SKIP_PROBABILITY = 0.5;
export type StopCode = 'C' | 'S' | null;
export interface ParsedStopType {
    code: StopCode;
    skippable: boolean;
    clean: string;
}
export type RandomFn = () => number;
export declare function toOdd(n: unknown): number;
export declare function returnNumberFor(forwardNumber: unknown): number;
export declare function incrementForward(baseOdd: unknown, k?: number): number;
export declare function incrementTrailingNumber(name: unknown, delta?: number): string;
export declare function parseStopType(label: unknown): ParsedStopType;
export declare function rollSkip(rng?: RandomFn): boolean;
export declare function shouldSkipStop(label: unknown, rng?: RandomFn): boolean;
export declare function interpolatePassageTimes(depTimeA: number, arrTimeB: number, cumDistsKm: readonly number[]): number[];
