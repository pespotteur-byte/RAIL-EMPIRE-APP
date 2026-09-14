/** Compact exact-minimum index for the infrastructure occupied by a consist.
 * Geometry is immutable within a leg. Blocks reduce repeated scans of dense
 * OSM vertices; no vertex, speed restriction or part of the train is discarded.
 * Rounding-sensitive tail boundaries fall back to the original arithmetic.
 */
export class TailSpeedIndex {
    constructor(distances, speeds) {
        this.distances = distances;
        this.speeds = speeds;
        if (speeds.length !== distances.length + 1)
            throw new RangeError('Tail-speed index: incompatible route arrays');
        const blocks = Math.ceil(distances.length / TailSpeedIndex.SIZE);
        this.blockDistance = new Float64Array(blocks);
        this.blockMinimum = new Float64Array(blocks);
        for (let b = 0; b < blocks; b++) {
            let distance = 0, minimum = Infinity;
            for (let i = Math.min(distances.length, (b + 1) * TailSpeedIndex.SIZE) - 1; i >= b * TailSpeedIndex.SIZE; i--) {
                distance += distances[i] || 0;
                minimum = Math.min(minimum, speeds[i] ?? Infinity, speeds[i + 1] ?? Infinity);
            }
            this.blockDistance[b] = distance;
            this.blockMinimum[b] = minimum;
        }
    }
    get bytes() { return this.blockDistance.byteLength + this.blockMinimum.byteLength; }
    minimum(segIndex, progress, lengthM) {
        return this.scan(segIndex, progress, lengthM, true);
    }
    scan(segIndex, progress, lengthM, useBlocks) {
        if (!this.distances.length)
            return this.speeds[0] ?? Infinity;
        const start = Math.max(0, Math.min(this.distances.length - 1, Math.floor(segIndex) || 0));
        let minimum = Math.min(this.speeds[start] ?? Infinity, this.speeds[start + 1] ?? Infinity);
        let remaining = Math.max(0, Number(lengthM) || 0) / 1000 - Math.max(0, Math.min(1, Number(progress) || 0)) * (this.distances[start] || 0);
        let i = start - 1, skipped = false;
        while (remaining > 0 && i >= 0) {
            const b = Math.floor(i / TailSpeedIndex.SIZE);
            if (useBlocks && i % TailSpeedIndex.SIZE === TailSpeedIndex.SIZE - 1 &&
                remaining > this.blockDistance[b] + TailSpeedIndex.EPS_KM) {
                minimum = Math.min(minimum, this.blockMinimum[b]);
                remaining -= this.blockDistance[b];
                i -= TailSpeedIndex.SIZE;
                skipped = true;
            }
            else {
                minimum = Math.min(minimum, this.speeds[i] ?? Infinity, this.speeds[i + 1] ?? Infinity);
                remaining -= this.distances[i] || 0;
                i--;
                // Grouped additions can differ by a few ulps. Near an exact tail
                // boundary repeat the reference additions, not a looser speed rule.
                if (skipped && Math.abs(remaining) <= TailSpeedIndex.EPS_KM)
                    return this.scan(segIndex, progress, lengthM, false);
            }
        }
        if (remaining > 0)
            minimum = Math.min(minimum, this.speeds[0] ?? Infinity);
        return minimum;
    }
}
TailSpeedIndex.SIZE = 64;
TailSpeedIndex.EPS_KM = 1e-9;
/** Rebuild a monotone expiry/minimum queue from optional legacy snapshot data. */
export function normalizePassageTailSpeedHolds(value) {
    if (!Array.isArray(value))
        return [];
    const input = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object')
            continue;
        const obj = entry;
        const endTravelKm = Number(obj.endTravelKm), limitKmh = Number(obj.limitKmh);
        if (Number.isFinite(endTravelKm) && Number.isFinite(limitKmh) && limitKmh >= 0)
            input.push({ endTravelKm, limitKmh });
    }
    input.sort((a, b) => a.endTravelKm - b.endTravelKm);
    const queue = [];
    for (const entry of input) {
        while (queue.length && queue[queue.length - 1].limitKmh >= entry.limitKmh)
            queue.pop();
        queue.push(entry);
    }
    return queue;
}
