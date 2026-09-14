export declare class StateTransaction {
    private entries;
    private seen;
    captureRoot(target: object, descend?: boolean): void;
    rollback(): void;
    release(): void;
    get objectCount(): number;
}
export type SaveDocument = Record<string, unknown>;
/** Reject incompatible containers BEFORE touching any live state. Missing legacy
 * sections remain supported; existing model loaders retain their domain checks. */
export declare function validateSaveDocument(input: unknown): asserts input is SaveDocument;
