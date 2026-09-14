/** Stable station resources. Player-facing names are deliberately not identifiers. */
export interface StationTrackIdentity {
  kind: 'native' | 'osm';
  id: string;
  trackRef: string;
  lat: number | null;
  lon: number | null;
}

export interface NativeStationTrack {
  id: string;
  stationId: string | null;
  occupiedBy?: string | null;
  voie: string;
  lat: number;
  lon: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  const text = String(value).trim();
  return text.length <= 256 && !/[\u0000-\u001f\u007f]/.test(text) ? text : '';
}
function coordinate(value: unknown, limit: number): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export function canonicalTrackRef(value: unknown): string {
  const ref = identifier(value).toLowerCase().replace(/\s+/g, ' ');
  const numeric = /^(?:(?:voie|track|gleis|v)\s*)?(\d+)$/.exec(ref);
  return numeric ? numeric[1].replace(/^0+(?=\d)/, '') : ref;
}

export function normalizeStationTrackIdentity(value: unknown): StationTrackIdentity | null {
  const data = record(value);
  if (!data || (data.kind !== 'native' && data.kind !== 'osm')) return null;
  const rawId = identifier(data.id);
  const id = data.kind === 'osm' ? rawId.replace(/^way\//i, '').trim() : rawId;
  if (!id) return null;
  return {
    kind: data.kind, id,
    trackRef: identifier(data.trackRef),
    lat: coordinate(data.lat, 90), lon: coordinate(data.lon, 180),
  };
}

export function stationTrackIdentityFromBinding(value: unknown): StationTrackIdentity | null {
  const data = record(value);
  if (!data) return null;
  const nativeId = identifier(data.voiePointId);
  const wayId = identifier(data.wayId).replace(/^way\//i, '');
  if (!nativeId && !wayId) return null; // An old display label is not physical evidence.
  return normalizeStationTrackIdentity({
    kind: nativeId ? 'native' : 'osm', id: nativeId || wayId,
    trackRef: data.trackRef,
    lat: data.snapLat ?? data.lat, lon: data.snapLon ?? data.lon,
  });
}

export function stationTrackResourceKey(identity: StationTrackIdentity): string {
  return `@${identity.kind}:${identity.id}`;
}

/** Only native ID, real OSM ref or a unique <= 2 m snap may bridge to native tracks. */
export function resolveNativeStationTrack<T extends NativeStationTrack>(
  identity: StationTrackIdentity, stationId: string, tracks: readonly T[],
): T | null {
  const local = tracks.filter(track => String(track.stationId ?? '') === stationId);
  if (identity.kind === 'native') return local.find(track => track.id === identity.id) ?? null;
  const ref = canonicalTrackRef(identity.trackRef);
  if (ref) {
    const matching = local.filter(track => canonicalTrackRef(track.voie) === ref);
    if (matching.length === 1) return matching[0];
    // A repeated reference is ambiguous. Geometry must disambiguate it below.
  }
  if (identity.lat == null || identity.lon == null) return null;
  const candidates = local.filter(track => {
    if (ref && canonicalTrackRef(track.voie) !== ref) return false;
    const dy = (track.lat - identity.lat!) * Math.PI / 180;
    const dx = (track.lon - identity.lon!) * Math.PI / 180;
    const a = Math.sin(dy / 2) ** 2 + Math.cos(identity.lat! * Math.PI / 180)
      * Math.cos(track.lat * Math.PI / 180) * Math.sin(dx / 2) ** 2;
    const metres = 6371000 * 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
    return Number.isFinite(metres) && metres <= 2;
  });
  return candidates.length === 1 ? candidates[0] : null;
}
