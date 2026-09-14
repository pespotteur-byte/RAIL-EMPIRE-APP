import { civilDayIndex } from './legacy-operating-day.js';
/** Persisted processing ledger, NOT a replacement for the real Paris game clock.
 * Durations use elapsed real minutes (DST-safe); daily settlements use civil dates.
 * A legacy save starts from its save date: no invented charges before that date.
 */
export class GameplayClock {
    constructor() {
        this.lastUpdateMs = 0;
        this.dailyDate = '';
        this.completedTasks = Object.create(null);
        this.freightGenerationMinute = 0;
    }
    static validDate(value) {
        return civilDayIndex(value) != null;
    }
    static parisDate(ms) {
        if (!Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime()))
            return '';
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
        const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }
    load(raw, legacySaveTime) {
        const data = raw && typeof raw === 'object' ? raw : {};
        const ms = Number(data.lastUpdateMs ?? legacySaveTime);
        this.lastUpdateMs = Number.isFinite(ms) && ms > 0 && Number.isFinite(new Date(ms).getTime()) ? ms : 0;
        this.dailyDate = GameplayClock.validDate(data.dailyDate) ? data.dailyDate : (this.lastUpdateMs ? GameplayClock.parisDate(this.lastUpdateMs) : '');
        this.completedTasks = Object.create(null);
        if (data.completedTasks && typeof data.completedTasks === 'object') {
            for (const [key, date] of Object.entries(data.completedTasks)) {
                if (GameplayClock.validDate(date))
                    this.completedTasks[key] = date;
            }
        }
        const generation = Number(data.freightGenerationMinute);
        this.freightGenerationMinute = Number.isFinite(generation) && generation > 0 ? generation : 0;
    }
    advance(date, nowMs = Date.now()) {
        if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime()) || !GameplayClock.validDate(date))
            return { elapsedMinutes: 0, dailyDates: [] };
        const elapsedMinutes = this.lastUpdateMs ? Math.max(0, (nowMs - this.lastUpdateMs) / 60000) : 1;
        this.lastUpdateMs = Math.max(this.lastUpdateMs, nowMs);
        if (!this.dailyDate)
            this.dailyDate = date;
        const dailyDates = [];
        // At most 31 civil settlements per tick. The persistent ledger retains
        // the rest for subsequent ticks; no date is dropped. Avoid a multi-year
        // imported save allocating/executing its whole backlog in one frame.
        // Work in civil dates, not increments of 24 local hours across DST.
        for (let ms = Date.parse(this.dailyDate + 'T00:00:00Z') + 86400000, end = Date.parse(date + 'T00:00:00Z'); ms <= end && dailyDates.length < 31; ms += 86400000) {
            dailyDates.push(new Date(ms).toISOString().slice(0, 10));
        }
        return { elapsedMinutes, dailyDates };
    }
    runDailyTask(key, date, task) {
        if (!key || !GameplayClock.validDate(date) || (this.completedTasks[key] || '') >= date)
            return;
        task(); // Failed tasks remain retryable; successful siblings do not run twice.
        this.completedTasks[key] = date;
    }
    markSettled(date) { if (GameplayClock.validDate(date) && date > this.dailyDate)
        this.dailyDate = date; }
    toSave() { return { lastUpdateMs: this.lastUpdateMs, dailyDate: this.dailyDate, completedTasks: { ...this.completedTasks }, freightGenerationMinute: this.freightGenerationMinute }; }
}
