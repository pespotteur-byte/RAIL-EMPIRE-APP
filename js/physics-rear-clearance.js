/** Exact rear-clearance envelope on the SC's existing numerical cells.
 * Each positive speed transition contributes its old speed until the complete
 * consist clears it. A min-heap merges overlapping restrictions, instead of
 * revisiting every cell under every transition. No geometry is discarded.
 */
export function rearClearanceCaps(distance, originalLimit, transitionUp, lengthM) {
    const count = distance.length;
    if (originalLimit.length !== count || transitionUp.length !== count) {
        throw new RangeError('Rear-clearance arrays must describe the same cells');
    }
    const result = new Float64Array(count);
    if (!(lengthM > 0) || count < 2)
        return result;
    let transitions = 0;
    for (let i = 1; i < count; i++)
        if (transitionUp[i])
            transitions++;
    if (!transitions)
        return result;
    const caps = new Float64Array(transitions);
    const until = new Float64Array(transitions);
    let size = 0, position = 0;
    for (let i = 0; i < count; i++) {
        if (i > 0 && transitionUp[i]) {
            // Precisely the old forward addition order, including floating-point
            // boundary coordinates; no early release from recomputing distances.
            const cap = originalLimit[i - 1], end = position + lengthM;
            let child = size++;
            while (child > 0) {
                const parent = (child - 1) >>> 1;
                if (caps[parent] <= cap)
                    break;
                caps[child] = caps[parent];
                until[child] = until[parent];
                child = parent;
            }
            caps[child] = cap;
            until[child] = end;
        }
        while (size > 0 && position >= until[0]) {
            const last = --size;
            if (!size)
                break;
            const cap = caps[last], end = until[last];
            let parent = 0;
            for (;;) {
                let child = parent * 2 + 1;
                if (child >= size)
                    break;
                if (child + 1 < size && caps[child + 1] < caps[child])
                    child++;
                if (cap <= caps[child])
                    break;
                caps[parent] = caps[child];
                until[parent] = until[child];
                parent = child;
            }
            caps[parent] = cap;
            until[parent] = end;
        }
        if (size > 0)
            result[i] = caps[0];
        position += distance[i];
    }
    return result;
}
