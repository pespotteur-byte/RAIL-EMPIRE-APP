/** Cooperative replay work between paints. A single outstanding timer; no
 * worker, no parallel mutation, and no increase of the 100 ms physical step. */
export class ReplayPump {
    constructor(slice, onError) {
        this.slice = slice;
        this.onError = onError;
        this.timer = null;
        this.active = true;
    }
    request() {
        if (!this.active || this.timer !== null)
            return;
        this.timer = setTimeout(() => {
            this.timer = null;
            if (!this.active)
                return;
            try {
                if (this.slice())
                    this.request();
            }
            catch (error) {
                this.onError(error);
            }
        }, 0);
    }
    cancel() { if (this.timer !== null)
        clearTimeout(this.timer); this.timer = null; }
    dispose() { this.active = false; this.cancel(); }
}
