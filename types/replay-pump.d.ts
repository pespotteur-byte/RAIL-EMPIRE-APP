/** Cooperative replay work between paints. A single outstanding timer; no
 * worker, no parallel mutation, and no increase of the 100 ms physical step. */
export declare class ReplayPump {
    private readonly slice;
    private readonly onError;
    private timer;
    private active;
    constructor(slice: () => boolean, onError: (error: unknown) => void);
    request(): void;
    cancel(): void;
    dispose(): void;
}
