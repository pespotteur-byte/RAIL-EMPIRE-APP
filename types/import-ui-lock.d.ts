/** Prevent user edits while an imported world awaits durable storage.
 * Simulation/autosave are independently paused by the caller. */
export declare function acquireImportUiLock(): () => void;
