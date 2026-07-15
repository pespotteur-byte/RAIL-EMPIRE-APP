let nextWorksId = 1;

export class PlannedWorks {
  constructor(data) {
    this.id = data.id || `works-${nextWorksId++}`;
    this.name = data.name || 'Travaux';
    this.trackId = data.trackId || '';
    // TRV-03 : fermeture d'un tronçon entre deux gares (portion de ligne)
    this.stationA = data.stationA || '';
    this.stationB = data.stationB || '';
    this.startDate = data.startDate || '';
    this.startTime = data.startTime || '22:00';
    this.endDate = data.endDate || '';
    this.endTime = data.endTime || '05:00';
    this.impact = data.impact || 'stop';
    this.speedLimit = data.speedLimit || 40;
    // TRV-05 : portée — journée, tranche horaire, entre 2 gares, récurrente
    this.recurrence = data.recurrence || 'daily'; // 'once' | 'daily' | 'weekly'
    this.daysOfWeek = data.daysOfWeek || [0,1,2,3,4,5,6]; // for weekly
    this.active = false;
  }

  _dayOfWeek(dateStr) {
    try { return new Date(dateStr + 'T12:00:00').getDay(); } catch { return -1; }
  }

  isActiveAt(dateStr, timeOfDay) {
    if (!this.startDate || !this.endDate) return false;

    // Check if current date is within the overall works period
    if (dateStr < this.startDate || dateStr > this.endDate) return false;

    // TRV-05 : récurrence
    if (this.recurrence === 'once' && dateStr !== this.startDate) return false;
    if (this.recurrence === 'weekly' && !this.daysOfWeek.includes(this._dayOfWeek(dateStr))) return false;

    // Check daily active hours
    const parseTime = (t) => {
      if (typeof t === 'number') return t;
      if (typeof t !== 'string' || !t.includes(':')) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const startMinutes = parseTime(this.startTime);
    const endMinutes = parseTime(this.endTime);

    if (startMinutes <= endMinutes) {
      // Same-day window (e.g. 08:00 - 18:00)
      return timeOfDay >= startMinutes && timeOfDay <= endMinutes;
    } else {
      // Overnight window (e.g. 22:00 - 05:00)
      return timeOfDay >= startMinutes || timeOfDay <= endMinutes;
    }
  }

  getDateRange() {
    if (!this.startDate || !this.endDate) return '';
    const fmt = (d) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    return `${fmt(this.startDate)} ${this.startTime} → ${fmt(this.endDate)} ${this.endTime}`;
  }
}

export class WorksManager {
  constructor() {
    this.works = [];
  }

  add(data) {
    const w = new PlannedWorks(data);
    this.works.push(w);
    return w;
  }

  remove(id) {
    this.works = this.works.filter(w => w.id !== id);
  }

  getAll() {
    return this.works;
  }

  // TRV-03 : travaux actifs fermant le tronçon entre deux gares
  getActiveClosuresBetween(stationA, stationB, dateStr, timeOfDay) {
    if (!stationA || !stationB || !dateStr || timeOfDay == null) return [];
    return this.works.filter(w =>
      w.isActiveAt(dateStr, timeOfDay) &&
      ((w.stationA === stationA && w.stationB === stationB) ||
       (w.stationA === stationB && w.stationB === stationA))
    );
  }

  getActive(dateStr, timeOfDay) {
    return this.works.filter(w => w.isActiveAt(dateStr, timeOfDay));
  }

  update(dateStr, timeOfDay, world) {
    if (!world) return;

    // First, clear all track works flags
    for (const track of world.tracks) {
      track.worksActive = false;
      track.worksImpact = null;
      track.worksSpeedLimit = null;
    }

    // Then apply active works (worst impact wins for overlapping works on same track)
    for (const w of this.works) {
      w.active = w.isActiveAt(dateStr, timeOfDay);
      if (!w.active) continue;

      const track = world.tracks.find(t => t.id === w.trackId);
      if (!track) continue;

      if (!track.worksActive) {
        track.worksActive = true;
        track.worksImpact = w.impact;
        track.worksSpeedLimit = w.speedLimit;
      } else {
        // Multiple active works on same track: take worst impact
        if (w.impact === 'stop') {
          track.worksImpact = 'stop';
          track.worksSpeedLimit = 0;
        } else if (track.worksImpact !== 'stop' && w.speedLimit < (track.worksSpeedLimit || 999)) {
          track.worksSpeedLimit = w.speedLimit;
        }
      }
    }
  }

  toSave() {
    return this.works.map(w => ({
      id: w.id, name: w.name, trackId: w.trackId,
      stationA: w.stationA, stationB: w.stationB,
      startDate: w.startDate, startTime: w.startTime,
      endDate: w.endDate, endTime: w.endTime,
      impact: w.impact, speedLimit: w.speedLimit,
      recurrence: w.recurrence, daysOfWeek: w.daysOfWeek,
    }));
  }

  loadFromSave(arr) {
    this.works = [];
    for (const d of arr) {
      this.works.push(new PlannedWorks(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextWorksId) nextWorksId = num + 1;
    }
  }
}
