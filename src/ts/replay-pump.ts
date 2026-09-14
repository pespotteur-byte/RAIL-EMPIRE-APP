/** Cooperative replay work between paints. A single outstanding timer; no
 * worker, no parallel mutation, and no increase of the 100 ms physical step. */
export class ReplayPump {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private active = true;
    constructor(private readonly slice: () => boolean, private readonly onError: (error: unknown) => void) {}
    request(): void {
        if (!this.active || this.timer !== null) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            if (!this.active) return;
            try { if (this.slice()) this.request(); } catch (error) { this.onError(error); }
        }, 0);
    }
    cancel(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
    dispose(): void { this.active = false; this.cancel(); }
}
