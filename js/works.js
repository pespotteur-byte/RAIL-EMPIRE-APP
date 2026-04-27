let nextWorksId = 1;

export class PlannedWorks {
  constructor(data) {
    this.id = data.id || `works-${nextWorksId++}`;
    this.name = data.name || 'Travaux';
    this.trackId = data.trackId || '';
    this.startDate = data.startDate || '';
    this.startTime = data.startTime || '22:00';
    this.endDate = data.endDate || '';
    this.endTime = data.endTime || '05:00';
    this.impact = data.impact || 'stop';
    this.speedLimit = data.speedLimit || 40;
    this.active = false;
  }

  isActiveAt(dateStr, timeOfDay) {
    if (!this.startDate || !this.endDate) return false;

    const [sh, sm] = this.startTime.split(':').map(Number);
    const [eh, em] = this.endTime.split(':').map(Number);
    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);

    if (dateStr > this.startDate && dateStr < this.endDate) return true;

    if (dateStr === this.startDate && dateStr === this.endDate) {
      if (startMinutes <= endMinutes) {
        return timeOfDay >= startMinutes && timeOfDay <= endMinutes;
      }
      return timeOfDay >= startMinutes || timeOfDay <= endMinutes;
    }

    if (dateStr === this.startDate) return timeOfDay >= startMinutes;
    if (dateStr === this.endDate) return timeOfDay <= endMinutes;

    return false;
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

  getActive(dateStr, timeOfDay) {
    return this.works.filter(w => w.isActiveAt(dateStr, timeOfDay));
  }

  update(dateStr, timeOfDay, world) {
    for (const w of this.works) {
      const wasActive = w.active;
      w.active = w.isActiveAt(dateStr, timeOfDay);

      if (w.active && world) {
        const track = world.tracks.find(t => t.id === w.trackId);
        if (track) {
          track.worksActive = true;
          track.worksImpact = w.impact;
          track.worksSpeedLimit = w.speedLimit;
        }
      } else if (!w.active && wasActive && world) {
        const track = world.tracks.find(t => t.id === w.trackId);
        if (track) {
          track.worksActive = false;
          track.worksImpact = null;
          track.worksSpeedLimit = null;
        }
      }
    }
  }

  toSave() {
    return this.works.map(w => ({
      id: w.id, name: w.name, trackId: w.trackId,
      startDate: w.startDate, startTime: w.startTime,
      endDate: w.endDate, endTime: w.endTime,
      impact: w.impact, speedLimit: w.speedLimit,
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
