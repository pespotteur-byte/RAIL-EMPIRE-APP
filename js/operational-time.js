// RE Saison 3 / TypeScript Alpha 1
// HOTFIX16 — operational minute display: only COMPLETE minutes count.
// +00:59 => 0, +01:00 => +1, +01:59 => +1. Negative values mirror the rule.
export function operationalDelayMinutes(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) < 1e-9)
        return 0;
    const out = n > 0 ? Math.floor(n + 1e-9) : Math.ceil(n - 1e-9);
    return out === 0 ? 0 : out;
}
/** Forward interval in legacy clock minutes. Absolute J+n values retain their span. */
export function forwardClockMinutes(start, end) {
    const a = Number(start), b = Number(end);
    if (!Number.isFinite(a) || !Number.isFinite(b))
        return 0;
    const delta = b - a;
    return delta >= 0 ? delta : ((delta % 1440) + 1440) % 1440;
}
