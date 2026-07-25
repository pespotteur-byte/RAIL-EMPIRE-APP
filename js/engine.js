export class SimulationEngine {
  constructor() {
    this.paused = false;
    this.lastMinute = -1;
    this.onTick = null;
    this.onMoveTick = null;
    this.currentDate = null;
    this.lastMoveTime = 0;
    this.moveInterval = 100; // 0.1 seconds for smooth movement
    this._ptCache = null;
    this._ptCacheTime = 0;
    // DET-04 : pas de simulation fixe découplé du rendu
    this._lastFrameTime = 0;
    this._accumulator = 0;
    this._maxFrameDt = 0.25; // éviter le saut de temps si onglet inactif
    // SAV : support du temps de jeu sauvegardé (pas l'heure réelle)
    this._timeOffset = null;
    this._baseDate = null;
    this._baseTimeOfDay = 0;
  }

  _getRealParisTime() {
    // Use the player's local computer time instead of a fixed timezone
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const d = now.getDate();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    // Build a UTC timestamp whose wall-clock components equal the local time,
    // so getUTC*/getUTCDay return the local date/time.
    return {
      hours: h,
      minutes: m,
      seconds: s,
      dayOfWeek: now.getDay(),
      date: new Date(Date.UTC(y, mo, d, h, m, s)),
    };
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
    } else {
      this._timeOffset = timeOfDay - this._realMinute();
      this._baseDate = new Date(dateStr + 'T00:00:00Z');
      this._baseTimeOfDay = ((timeOfDay % 1440) + 1440) % 1440;
    }
    // Force a fresh time read on next update
    this._ptCache = null;
    this._ptCacheTime = 0;
  }

  _computeGameTime() {
    if (this._timeOffset == null || !this._baseDate) return this._getRealParisTime();
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
    if (this.paused) return;

    const now = performance.now();
    const pt = this.getParisTime();
    const currentMinute = pt.hours * 60 + pt.minutes;

    // Minute-level tick for schedule events
    if (currentMinute !== this.lastMinute) {
      this.lastMinute = currentMinute;
      this.currentDate = this.getParisDate();

      if (this.onTick) {
        this.onTick(currentMinute, this.currentDate, pt);
      }
    }

    // DET-04 : pas de simulation fixe découplé du rendu
    if (!this._lastFrameTime) this._lastFrameTime = now;
    const frameDt = Math.min((now - this._lastFrameTime) / 1000, this._maxFrameDt);
    this._lastFrameTime = now;
    const step = this.moveInterval / 1000; // 0.1 s
    this._accumulator += frameDt;
    while (this._accumulator >= step) {
      this._accumulator -= step;
      if (this.onMoveTick) {
        this.onMoveTick(step, currentMinute);
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
