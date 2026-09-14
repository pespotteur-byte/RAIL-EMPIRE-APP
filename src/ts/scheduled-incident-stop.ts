/** Scheduled stop eligibility. Never infer an operating stop from the nearest
 * station: a train stopped at a red signal must not acquire passenger incidents. */
export interface IncidentScheduledStop {
  stationId?: unknown; type?: unknown; stopCode?: unknown;
  technicalLocationId?: unknown; locationOccurrenceId?: unknown;
  lat?: unknown; lon?: unknown;
}
export interface IncidentStopService {
  state?: string; speed?: number; completed?: boolean; cancelled?: boolean;
  currentStopIndex?: number; stops?: IncidentScheduledStop[];
  getCurrentStops?: () => IncidentScheduledStop[];
  position?: {lat?: number; lon?: number} | null;
  train?: { stoppedAt?: unknown; speed?: unknown };
}
export function bookedIncidentStop(service: IncidentStopService): IncidentScheduledStop | null {
  if (service.completed || service.cancelled || !['waiting','stopped_at_station'].includes(service.state || '')) return null;
  const speed = Number(service.speed ?? service.train?.speed ?? 0);
  if (!Number.isFinite(speed) || Math.abs(speed) > 0.1) return null;
  const stops = service.getCurrentStops?.() ?? service.stops ?? [];
  // currentStopIndex advances when arrival is committed, including the terminus.
  const index = service.state === 'waiting' ? Number(service.currentStopIndex ?? 0) : Number(service.currentStopIndex ?? 0) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= stops.length) return null;
  const stop = stops[index];
  if (!stop || stop.stationId == null || String(stop.stationId) === '' || stop.technicalLocationId) return null;
  if (stop.type != null && stop.type !== 'arret') return null;
  const marker = service.train?.stoppedAt;
  const markerRecord = marker && typeof marker === 'object' ? marker as {id?: unknown; stationId?: unknown} : null;
  const markerId = markerRecord ? (markerRecord.id ?? markerRecord.stationId) : marker;
  if (markerId != null && String(markerId) !== '') return String(markerId) === String(stop.stationId) ? stop : null;
  // An old save can lack stoppedAt. Only accept the booked stop's own exact
  // stopping coordinates, never a different station found by geographic search.
  const lat = Number(stop.lat), lon = Number(stop.lon), pos = service.position;
  if (stop.lat == null || stop.lon == null || !pos || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return null;
  const dy = (Number(pos.lat) - lat) * 111.32;
  const dx = (Number(pos.lon) - lon) * 111.32 * Math.cos(lat * Math.PI / 180);
  return Math.hypot(dx,dy) <= 0.1 ? stop : null;
}
