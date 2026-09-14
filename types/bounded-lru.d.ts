/** Bounded acceleration cache. Eviction never mutates the value or live world data. */
export declare class BoundedLruMap<K, V> extends Map<K, V> {
    readonly maxEntries: number;
    readonly maxWeight: number;
    private readonly measure;
    private readonly onEvict?;
    private weights;
    private usedWeight;
    constructor(maxEntries: number, maxWeight: number, measure?: (value: V) => number, onEvict?: ((key: K) => void) | undefined);
    get weight(): number;
    get(key: K): V | undefined;
    set(key: K, value: V): this;
    delete(key: K): boolean;
    clear(): void;
}
