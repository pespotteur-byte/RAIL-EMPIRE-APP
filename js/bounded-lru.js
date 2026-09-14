/** Bounded acceleration cache. Eviction never mutates the value or live world data. */
export class BoundedLruMap extends Map {
    constructor(maxEntries, maxWeight, measure = () => 1, onEvict) {
        super();
        this.maxEntries = maxEntries;
        this.maxWeight = maxWeight;
        this.measure = measure;
        this.onEvict = onEvict;
        this.weights = new Map();
        this.usedWeight = 0;
        if (!Number.isFinite(maxEntries) || maxEntries < 1 || !Number.isFinite(maxWeight) || maxWeight < 1)
            throw new RangeError('Cache limits must be finite and positive');
    }
    get weight() { return this.usedWeight; }
    get(key) {
        if (!super.has(key))
            return undefined;
        const value = super.get(key);
        super.delete(key);
        super.set(key, value);
        return value;
    }
    set(key, value) {
        const measured = this.measure(value);
        const weight = Math.max(1, Math.ceil(Number.isFinite(measured) ? measured : this.maxWeight + 1));
        // An oversized network result is still returned by its caller; do not
        // retain it here or evict useful smaller entries just to reject it.
        if (weight > this.maxWeight) {
            this.delete(key);
            return this;
        }
        if (super.has(key)) {
            this.usedWeight -= this.weights.get(key) || 0;
            super.delete(key);
        }
        super.set(key, value);
        this.weights.set(key, weight);
        this.usedWeight += weight;
        while (this.size > this.maxEntries || this.usedWeight > this.maxWeight) {
            const oldest = this.keys().next();
            if (oldest.done)
                break;
            this.delete(oldest.value);
        }
        return this;
    }
    delete(key) {
        if (!super.delete(key))
            return false;
        this.usedWeight = Math.max(0, this.usedWeight - (this.weights.get(key) || 0));
        this.weights.delete(key);
        this.onEvict?.(key);
        return true;
    }
    clear() {
        const keys = this.onEvict ? [...this.keys()] : [];
        super.clear();
        this.weights.clear();
        this.usedWeight = 0;
        for (const key of keys)
            this.onEvict?.(key);
    }
}
