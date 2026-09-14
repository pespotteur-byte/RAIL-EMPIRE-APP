export declare const AUXILIARY_KEYS: readonly ["admin_catalog_mods", "admin_catalog_deleted", "admin_catalog_imported", "admin_incidents"];
export type AuxiliaryKey = typeof AUXILIARY_KEYS[number];
export declare class AuxiliaryJsonStorage {
    private db;
    private opening;
    lastWarning: string | null;
    private open;
    private get;
    private put;
    /** Existing local data wins over a stale IDB copy, including a recent fallback.
     * Migration removes that local value only AFTER commit and if it is unchanged. */
    load(key: AuxiliaryKey): Promise<unknown>;
    /** Capture JSON now; never let later UI edits mutate a pending write. */
    save(key: AuxiliaryKey, value: unknown): Promise<void>;
    close(): void;
}
