/** Recent subsystem failures. Historical counters are not a diagnosis of current
 * health; recording must never throw, retain Error graphs, or flood the console.
 */
export type OperationalFailure = { code: string; count: number; firstAt: number; lastAt: number; message: string; lastLoggedAt: number };
export class OperationalDiagnostics {
    private entries = new Map<string, OperationalFailure>();
    constructor(readonly maxEntries = 64, readonly logIntervalMs = 60000) {}
    record(code: string, error: unknown, now = Date.now()): void {
        try {
            code = String(code || 'UNKNOWN').slice(0, 100);
            const safeNow = Number.isFinite(now) ? now : Date.now();
            let message: string;
            try { message = (error instanceof Error ? error.message : String(error)).slice(0, 500); }
            catch { message = 'Erreur non sérialisable'; }
            const old = this.entries.get(code);
            const row: OperationalFailure = old || { code, count: 0, firstAt: safeNow, lastAt: safeNow, message: '', lastLoggedAt: -Infinity };
            row.count++; row.lastAt = safeNow; row.message = message;
            this.entries.delete(code); this.entries.set(code, row);
            while (this.entries.size > Math.max(1, this.maxEntries)) this.entries.delete(this.entries.keys().next().value!);
            if (!old || safeNow - row.lastLoggedAt >= this.logIntervalMs || safeNow < row.lastLoggedAt) {
                row.lastLoggedAt = safeNow;
                try { console.warn(`[RE ${code}] ${row.count} erreur(s) observée(s) — ${message}`); } catch { /* logging cannot break simulation */ }
            }
        } catch { /* diagnostics must stay fail-safe */ }
    }
    snapshot(): OperationalFailure[] { return [...this.entries.values()].reverse().map(row => ({ ...row })); }
    clear(): void { this.entries.clear(); }
}
