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
  }

  getParisTime() {
    const now = new Date();
    const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
    const paris = new Date(parisStr);
    return {
      hours: paris.getHours(),
      minutes: paris.getMinutes(),
      seconds: paris.getSeconds(),
      dayOfWeek: paris.getDay(),
      date: paris,
    };
  }

  getParisDate() {
    const now = new Date();
    const parisStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    return parisStr;
  }

  update() {
    if (this.paused) return;

    const now = performance.now();
    // Cache Paris time computation (expensive) — refresh max every 500ms
    if (!this._ptCache || now - this._ptCacheTime > 500) {
      this._ptCache = this.getParisTime();
      this._ptCacheTime = now;
    }
    const pt = this._ptCache;
    const currentMinute = pt.hours * 60 + pt.minutes;

    // Minute-level tick for schedule events
    if (currentMinute !== this.lastMinute) {
      this.lastMinute = currentMinute;
      this.currentDate = this.getParisDate();

      if (this.onTick) {
        this.onTick(currentMinute, this.currentDate, pt);
      }
    }

    // Movement tick for smooth train movement (every ~100ms)
    if (now - this.lastMoveTime >= this.moveInterval) {
      const dt = Math.min((now - this.lastMoveTime) / 1000, 1.0); // delta in seconds, cap at 1s
      this.lastMoveTime = now;

      if (this.onMoveTick) {
        this.onMoveTick(dt, currentMinute);
      }
    }
  }

  getFormattedTime() {
    const pt = this.getParisTime();
    return `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`;
  }

  getFormattedDate() {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
