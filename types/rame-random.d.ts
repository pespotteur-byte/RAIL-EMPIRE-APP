/** RC24 — composition policy. Only identity-preserving permutations run at departure. */
import { SeededRng, type RandomSource } from './rng.js';
export interface ConsistItem {
    category?: unknown;
    length?: unknown;
    power?: unknown;
    isDrivingTrailer?: unknown;
    elementId?: unknown;
    catalogId?: unknown;
    physicalVehicleId?: unknown;
}
export interface RandomRame<T extends ConsistItem> {
    id?: unknown;
    elementDetails: T[];
    elements: string[];
    randomizeOnDeparture?: boolean;
    randomMaxVehicles?: number | null;
    randomLastDepartureKey?: string;
}
export declare function maximumVehicleCount(value: unknown): number | null;
export declare function isMovableWagon(item: ConsistItem): boolean;
export declare function shuffleWagons<T extends ConsistItem>(items: readonly T[], random: RandomSource): T[];
/** A local keyed PRNG avoids changing simulation/weather draws when a consist is randomized. */
export declare function departureRng(key: string): SeededRng;
export declare function randomizeRameDeparture<T extends ConsistItem>(rame: RandomRame<T>, departureKey: string): boolean;
export interface FillResult<T> {
    selected: T[];
    totalLength: number;
    modelsUsed: number;
}
/** Initial creation may instantiate selected models; departure randomization never calls this. */
export declare function planRandomWagons<T extends ConsistItem>(fixed: readonly T[], models: readonly T[], maximum: number | null, random: RandomSource): FillResult<T>;
