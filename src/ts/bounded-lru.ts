/** Bounded acceleration cache. Eviction never mutates the value or live world data. */
export class BoundedLruMap<K, V> extends Map<K, V> {
    private weights = new Map<K, number>();
    private usedWeight = 0;
    constructor(readonly maxEntries: number, readonly maxWeight: number,
        private readonly measure: (value: V) => number = () => 1,
        private readonly onEvict?: (key: K) => void) {
        super();
        if (!Number.isFinite(maxEntries) || maxEntries < 1 || !Number.isFinite(maxWeight) || maxWeight < 1)
            throw new RangeError('Cache limits must be finite and positive');
    }
    get weight(): number { return this.usedWeight; }
    override get(key: K): V | undefined {
        if (!super.has(key)) return undefined;
        const value = super.get(key)!;
        super.delete(key); super.set(key, value);
        return value;
    }
    override set(key: K, value: V): this {
        const measured = this.measure(value);
        const weight = Math.max(1, Math.ceil(Number.isFinite(measured) ? measured : this.maxWeight + 1));
        // An oversized network result is still returned by its caller; do not
        // retain it here or evict useful smaller entries just to reject it.
        if (weight > this.maxWeight) { this.delete(key); return this; }
        if (super.has(key)) {
            this.usedWeight -= this.weights.get(key) || 0;
            super.delete(key);
        }
        super.set(key, value); this.weights.set(key, weight); this.usedWeight += weight;
        while (this.size > this.maxEntries || this.usedWeight > this.maxWeight) {
            const oldest = this.keys().next();
            if (oldest.done) break;
            this.delete(oldest.value);
        }
        return this;
    }
    override delete(key: K): boolean {
        if (!super.delete(key)) return false;
        this.usedWeight = Math.max(0, this.usedWeight - (this.weights.get(key) || 0));
        this.weights.delete(key); this.onEvict?.(key); return true;
    }
    override clear(): void {
        const keys = this.onEvict ? [...this.keys()] : [];
        super.clear(); this.weights.clear(); this.usedWeight = 0;
        for (const key of keys) this.onEvict?.(key);
    }
}
