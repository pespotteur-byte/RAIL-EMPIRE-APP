export class ScheduleManager {
  schedules: unknown[];
  constructor() {
    this.schedules = [];
  }
}

export function formatTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
