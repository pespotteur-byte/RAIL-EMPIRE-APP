export class OperationalDiagnostics {
    constructor(maxEntries = 64, logIntervalMs = 60000) {
        this.maxEntries = maxEntries;
        this.logIntervalMs = logIntervalMs;
        this.entries = new Map();
    }
    record(code, error, now = Date.now()) {
        try {
            code = String(code || 'UNKNOWN').slice(0, 100);
            const safeNow = Number.isFinite(now) ? now : Date.now();
            let message;
            try {
                message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
            }
            catch {
                message = 'Erreur non sérialisable';
            }
            const old = this.entries.get(code);
            const row = old || { code, count: 0, firstAt: safeNow, lastAt: safeNow, message: '', lastLoggedAt: -Infinity };
            row.count++;
            row.lastAt = safeNow;
            row.message = message;
            this.entries.delete(code);
            this.entries.set(code, row);
            while (this.entries.size > Math.max(1, this.maxEntries))
                this.entries.delete(this.entries.keys().next().value);
            if (!old || safeNow - row.lastLoggedAt >= this.logIntervalMs || safeNow < row.lastLoggedAt) {
                row.lastLoggedAt = safeNow;
                try {
                    console.warn(`[RE ${code}] ${row.count} erreur(s) observée(s) — ${message}`);
                }
                catch { /* logging cannot break simulation */ }
            }
        }
        catch { /* diagnostics must stay fail-safe */ }
    }
    snapshot() { return [...this.entries.values()].reverse().map(row => ({ ...row })); }
    clear() { this.entries.clear(); }
}
