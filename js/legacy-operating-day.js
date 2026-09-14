/** Civil operating dates for legacy clock-of-day schedules. The game engine
 * already supplies the Paris date: no host locale/timezone is consulted here.
 */
const DAY_MS = 86400000;
export function civilDayIndex(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const ms = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms / DAY_MS : null;
}
export function resolveLegacyOperatingDay(q) {
    const today = civilDayIndex(q.date);
    if (today == null || !Number.isFinite(q.minute) || !Number.isFinite(q.departure) || !Number.isFinite(q.maxRuntime))
        return null;
    const now = today * 1440 + q.minute;
    const dep = ((q.departure % 1440) + 1440) % 1440;
    const maxRuntime = Math.max(0, q.maxRuntime);
    const completed = civilDayIndex(q.completedDay);
    const allowed = (index, pinned = false) => {
        if (completed != null && index <= completed)
            return null;
        const elapsed = now - (index * 1440 + dep);
        if (elapsed < -1 || elapsed > maxRuntime)
            return null;
        const day = new Date(index * DAY_MS).toISOString().slice(0, 10);
        // Already admitted occurrences keep their operating date after midnight.
        // Future occurrences must pass both weekday and explicit-date restrictions.
        if (!pinned && (!q.weekdays.includes(((index + 4) % 7 + 7) % 7) || (q.dates.length > 0 && !q.dates.includes(day))))
            return null;
        return day;
    };
    const pinned = civilDayIndex(q.pinnedDay);
    if (pinned != null) {
        const day = allowed(pinned, true);
        if (day)
            return day;
    }
    // Defensive bound for malformed imported durations; ordinary legacy plans
    // use wrapped single-day clocks and require at most a few candidates.
    const lookback = Math.min(366, Math.ceil(maxRuntime / 1440));
    for (let d = 0; d <= lookback; d++) {
        const day = allowed(today - d);
        if (day)
            return day;
    }
    return allowed(today + 1); // a 00:00 departure may prepare at 23:59
}
