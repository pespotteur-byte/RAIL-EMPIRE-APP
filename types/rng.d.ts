export interface RandomSource {
    random(): number;
}
export declare class SeededRng implements RandomSource {
    private _seed;
    constructor(seed?: number);
    setSeed(seed: number): void;
    getState(): number;
    setState(state: number): void;
    random(): number;
    randomInt(n: number): number;
}
export declare function setGlobalRng(rng: RandomSource | null): void;
export declare function getGlobalRng(): RandomSource;
