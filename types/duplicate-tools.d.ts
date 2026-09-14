/** Exact in-memory clone for editable schedule graphs. Avoids lossy JSON route
 * packing/reconstruction; preserves prototypes and within-copy aliases, never
 * aliases mutable objects between the source and a copy. */
export declare function cloneEditableGraph<T>(source: T): T;
/** Compile the reference graph once for a synchronous duplication batch.
 * Each invocation allocates EVERY mutable node afresh. Only immutable primitive
 * templates and reference indices are reused; the plan is discarded at batch end.
 * This avoids repeated key inspection and Map lookups for railway snapshots. */
export declare function prepareEditableClone<T>(source: T): () => T;
/** Increment the last numerical group, preserving leading zeros and suffixes.
 * BigInt avoids silently rounding serial numbers longer than 15 digits. */
export declare function incrementLabel(value: unknown, delta: number): string;
export declare class LabelAllocator {
    private readonly insensitive;
    private used;
    constructor(labels: Iterable<unknown>, insensitive?: boolean);
    private key;
    has(label: string): boolean;
    claim(preferred: unknown, step?: number): string;
    next(source: unknown, delta?: number, step?: number): string;
}
export declare function duplicatedTrainName(name: unknown, sourceNumber: unknown, targetNumber: unknown, delta: number, names: LabelAllocator): string;
