import { ChronologicalClock } from './chronological-clock.js';
export class SimulationEngine {
    enableChronologicalReplay(raw = null, fallbackMs = Date.now(), nowMs = Date.now()) {
        this.chronologicalClock = new ChronologicalClock(raw, fallbackMs, nowMs);
        this.paused = !!this.chronologicalClock.failed;
        this._replayTimeSecond = -1;
        this._replayTime = null;
        this._accumulator = 0;
        this.discardedPhysicsSeconds = 0;
        this._ptCache = null;
    }
    getSimulationEpochMs() { return this.chronologicalClock?.cursorMs ?? Date.now(); }
    getReplayDebtSeconds() { return this.chronologicalClock?.debtSeconds ?? 0; }
    toClockSave() { return this.chronologicalClock?.snapshot() ?? null; }
    _timeAtEpoch(ms) {
        const second = Math.floor(ms / 1000);
        if (!this._replayTime || second !== this._replayTimeSecond) {
            this._replayTime = this._getRealParisTime(new Date(ms));
            this._replayTimeSecond = second;
        }
        return this._replayTime;
    }
    _updateChronological() {
        const clock = this.chronologicalClock;
        const dateAt = (ms) => this._formatDateISO(this._timeAtEpoch(ms).date);
        const timeAt = (ms) => { const p = this._timeAtEpoch(ms); return p.hours * 60 + p.minutes + (p.seconds + (ms % 1000) / 1000) / 60; };
        try {
            const targetMs = Date.now();
            const catchingUp = Math.max(clock.targetMs, targetMs) - clock.cursorMs > 2000;
            clock.advance(targetMs, {
                minute: ms => {
                    const pt = this._timeAtEpoch(ms), date = dateAt(ms);
                    this.lastMinute = pt.hours * 60 + pt.minutes;
                    this.currentDate = date;
                    this.onTick?.(timeAt(ms), date, pt);
                },
                second: ms => {
                    const pt = this._timeAtEpoch(ms), date = dateAt(ms);
                    this.lastSecondKey = String(Math.floor(ms / 1000));
                    this.currentDate = date;
                    this.onSecondTick?.(timeAt(ms), date, pt);
                },
                move: (dt, ms) => { this.onMoveTick?.(dt, timeAt(ms)); },
                // Lift the arbitrary five-simulated-seconds cap when catching up;
                // the wall-time budget still yields regularly for input/painting.
            }, catchingUp ? Math.max(2000, this._maxMoveStepsPerUpdate) : this._maxMoveStepsPerUpdate, catchingUp ? 8 : 12);
        }
        catch (error) {
            this.paused = true;
            throw error;
        }
    }
    constructor() {
        this.chronologicalClock = null;
        this._replayTimeSecond = -1;
        this._replayTime = null;
        this.discardedPhysicsSeconds = 0;
        this.paused = false;
        this.lastMinute = -1;
        this.onTick = null;
        this.onMoveTick = null;
        this.onSecondTick = null;
        this.lastSecondKey = '';
        this.currentDate = null;
        this.lastMoveTime = 0;
        this.moveInterval = 100; // 0.1 seconds for smooth movement
        this._ptCache = null;
        this._ptCacheTime = 0;
        // DET-04 : pas de simulation fixe découplé du rendu
        this._lastFrameTime = 0;
        this._accumulator = 0;
        // HOTFIX82 — a heavy in-game page can block the JS thread for seconds.
        // Do not throw that elapsed time away: keep a bounded simulation debt and
        // repay it over the following frames. Browser-tab background time remains
        // deliberately clamped; save/reload catch-up owns long offline gaps.
        this._maxFrameDt = 120;
        // HOTFIX83 — background browser tabs do not stop the railway clock. A
        // dedicated hidden-tab heartbeat calls update(); accept the real elapsed
        // interval (normally ~1 s once Chromium throttles timers) instead of the old
        // 250 ms clamp. Very long throttled gaps are handled by timetable catch-up
        // on visibility return rather than thousands of physics steps at once.
        this._hiddenFrameDt = 5;
        this._maxMoveStepsPerUpdate = 50; // repay at most 5 s of 100 ms physics per call
        // CLOCK : décalage optionnel interne ; les sauvegardes normales utilisent toujours l'heure réelle
        this._timeOffset = null;
        this._baseDate = null;
        this._baseTimeOfDay = 0;
        // v1.1.43 — constructing/parsing a locale time string every 500 ms is
        // surprisingly expensive on older Chromium builds. Keep one formatter and
        // read its numeric parts; the returned Date is a UTC container for Paris
        // wall-clock fields, matching the engine's UTC date helpers.
        try {
            this._parisFormatter = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
            });
        }
        catch (e) {
            this._parisFormatter = null;
        }
    }
    _getRealParisTime(now = new Date()) {
        if (this._parisFormatter?.formatToParts) {
            const values = {};
            for (const part of this._parisFormatter.formatToParts(now)) {
                if (part.type !== 'literal')
                    values[part.type] = part.value;
            }
            const year = Number(values.year), month = Number(values.month), day = Number(values.day);
            let hours = Number(values.hour);
            if (hours === 24)
                hours = 0;
            const minutes = Number(values.minute), seconds = Number(values.second);
            if ([year, month, day, hours, minutes, seconds].every(Number.isFinite)) {
                const paris = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
                return { hours, minutes, seconds, dayOfWeek: paris.getUTCDay(), date: paris };
            }
        }
        // Compatibility fallback for browsers with incomplete Intl support.
        const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
        const paris = new Date(parisStr);
        return { hours: paris.getHours(), minutes: paris.getMinutes(), seconds: paris.getSeconds(), dayOfWeek: paris.getDay(), date: paris };
    }
    _realMinute() {
        const pt = this._getRealParisTime();
        return pt.hours * 60 + pt.minutes;
    }
    setGameTime(timeOfDay, dateStr) {
        if (timeOfDay == null || !dateStr) {
            this._timeOffset = null;
            this._baseDate = null;
            this._baseTimeOfDay = 0;
            return;
        }
        this._timeOffset = timeOfDay - this._realMinute();
        this._baseDate = new Date(dateStr + 'T00:00:00Z');
        this._baseTimeOfDay = ((timeOfDay % 1440) + 1440) % 1440;
        // Force a fresh time read on next update
        this._ptCache = null;
    }
    _computeGameTime() {
        if (this._timeOffset == null || !this._baseDate)
            return this._getRealParisTime();
        const realPt = this._getRealParisTime();
        const realMin = realPt.hours * 60 + realPt.minutes;
        const totalMinutes = realMin + this._timeOffset;
        const currentMinute = ((totalMinutes % 1440) + 1440) % 1440;
        const days = Math.floor((totalMinutes - this._baseTimeOfDay) / 1440);
        const date = new Date(this._baseDate);
        date.setUTCDate(date.getUTCDate() + days);
        return {
            hours: Math.floor(currentMinute / 60),
            minutes: currentMinute % 60,
            seconds: realPt.seconds,
            dayOfWeek: date.getUTCDay(),
            date,
        };
    }
    getParisTime() {
        if (this.chronologicalClock)
            return this._timeAtEpoch(this.chronologicalClock.cursorMs);
        const now = performance.now();
        if (!this._ptCache || now - this._ptCacheTime > 500) {
            this._ptCache = this._computeGameTime();
            this._ptCacheTime = now;
        }
        return this._ptCache;
    }
    _formatDateISO(d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    getParisDate() {
        const pt = this.getParisTime();
        return this._formatDateISO(pt.date);
    }
    update() {
        if (this.paused)
            return;
        if (this.chronologicalClock) {
            this._updateChronological();
            return;
        }
        const now = performance.now();
        const pt = this.getParisTime();
        const currentMinute = pt.hours * 60 + pt.minutes;
        // Minute-level tick for schedule events
        if (currentMinute !== this.lastMinute || this.getParisDate() !== this.currentDate) {
            this.lastMinute = currentMinute;
            this.currentDate = this.getParisDate();
            if (this.onTick) {
                this.onTick(currentMinute, this.currentDate, pt);
            }
        }
        // V2 schedules retain second precision. Legacy schedules keep their minute
        // tick, while V2 receives one deterministic fractional-minute tick/second.
        const secondKey = `${this.getParisDate()}|${currentMinute}|${pt.seconds}`;
        if (secondKey !== this.lastSecondKey) {
            this.lastSecondKey = secondKey;
            if (!this.currentDate)
                this.currentDate = this.getParisDate();
            if (this.onSecondTick)
                this.onSecondTick(currentMinute + (pt.seconds / 60), this.currentDate, pt);
        }
        // DET-04 : pas de simulation fixe découplé du rendu
        if (!this._lastFrameTime)
            this._lastFrameTime = now;
        const rawFrameDt = Math.max(0, (now - this._lastFrameTime) / 1000);
        this._lastFrameTime = now;
        const pageHidden = typeof document !== 'undefined' && !!document.hidden;
        const frameDt = Math.min(rawFrameDt, pageHidden ? this._hiddenFrameDt : this._maxFrameDt);
        const step = this.moveInterval / 1000; // 0.1 s
        this.discardedPhysicsSeconds += Math.max(0, rawFrameDt - frameDt);
        this._accumulator += frameDt;
        let moveSteps = 0;
        const maxSteps = Math.max(1, Number(this._maxMoveStepsPerUpdate || 50));
        while (this._accumulator >= step && moveSteps < maxSteps) {
            this._accumulator -= step;
            moveSteps++;
            if (this.onMoveTick) {
                // Movement physics must see the same second-precise clock as V2. Passing
                // only currentMinute made every 100 ms physics step operate on a clock
                // rounded down by as much as 59 s, contaminating arrival/delay logic.
                this.onMoveTick(step, currentMinute + (Number(pt.seconds || 0) / 60));
            }
        }
    }
    getFormattedTime() {
        const pt = this.getParisTime();
        return `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`;
    }
    getFormattedDate() {
        const pt = this.getParisTime();
        const d = pt.date;
        const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
        return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
}
