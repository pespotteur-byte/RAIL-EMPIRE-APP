/**
 * RC10 — positive, local railway-connectivity evidence for industrial offers.
 * No geographic-neighbour shortcut, no inferred bridge and no network requests.
 * Availability of a compatible consist and of a train path remains a separate
 * check when assigning a contract to an actual service.
 */
type Point = { lat?: unknown; lon?: unknown; fallback?: unknown; synthetic?: unknown;
  closed?: unknown; railway?: unknown; railwayLifecycle?: unknown; oneway?: unknown;
  bidirectional?: unknown; service?: unknown; tags?: Record<string, unknown> };
type NetworkStation = { id: string; closed?: boolean; lat?: unknown; lon?: unknown };
type NetworkTrack = { stationA: string; stationB: string; route?: readonly Point[];
  worksActive?: boolean; worksImpact?: unknown; incidentActive?: boolean; incidentEffect?: unknown };
export type FreightNetworkWorld = { stations: readonly NetworkStation[]; tracks?: readonly NetworkTrack[] };
export type FreightRailLeg = { fromId: string; toId: string; route: readonly Point[]; reverseAllowed?: boolean };
type Location = { id: string; stationId?: string; technicalLocationId?: string };
type Path = { legs?: readonly { fromLocationId: string; toLocationId: string; routePoints?: readonly Point[] }[];
  error?: string; topologyRevision?: number; resolvedRevision?: number };
type Version = { state: string; locations: readonly Location[]; outboundPath?: Path; returnPath?: Path | null;
  validationReport?: { issues?: readonly { level?: string }[] } | null };
type ScheduleModel = { schedules?: readonly { currentVersion?: Version | null }[] };
type Service = { _v2OccurrenceId?: unknown; stops?: readonly { stationId?: string; technicalLocationId?: string }[];
  routes?: readonly (readonly Point[])[]; _returnStopsData?: readonly { stationId?: string }[] | null;
  _returnRoutes?: readonly (readonly Point[])[] | null };

const blockedRailways = new Set(['abandoned', 'disused', 'razed', 'construction', 'proposed', 'tram', 'subway', 'light_rail', 'monorail']);
const text = (value: unknown): string => String(value ?? '').trim().toLowerCase();
function validPoint(p: Point | undefined): boolean {
  if (!p || p.lat == null || p.lon == null || p.lat === '' || p.lon === '') return false;
  const lat = Number(p.lat), lon = Number(p.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
    !p.fallback && !p.synthetic && p.closed !== true &&
    !blockedRailways.has(text(p.railway ?? p.tags?.railway)) && !blockedRailways.has(text(p.railwayLifecycle));
}
function validRoute(route: readonly Point[] | undefined): route is readonly Point[] {
  if (!Array.isArray(route) || route.length < 2) return false;
  let hasDistance = false;
  for (let i = 0; i < route.length; i++) {
    if (!validPoint(route[i])) return false;
    if (i && (Number(route[i].lat) !== Number(route[i - 1].lat) || Number(route[i].lon) !== Number(route[i - 1].lon))) hasDistance = true;
  }
  return hasDistance;
}
/** Reversing OSM geometry requires positive evidence; missing direction is not permission. */
function reversible(route: readonly Point[]): boolean {
  return route.every(p => {
    const one = text(p.oneway ?? p.tags?.oneway);
    if (['yes', '1', 'true', 'forward', '-1', 'reverse', 'backward'].includes(one)) return false;
    return text(p.bidirectional ?? p.tags?.['railway:bidirectional']) === 'regular' ||
      ['siding', 'yard', 'spur', 'crossover'].includes(text(p.service ?? p.tags?.service));
  });
}

/** Extract only current VALID V2 paths, plus already-authored legacy routes. */
export function collectFreightRailLegs(model?: ScheduleModel | null, services: readonly Service[] = []): FreightRailLeg[] {
  const result: FreightRailLeg[] = [];
  for (const record of model?.schedules ?? []) {
    const v = record.currentVersion;
    if (!v || v.state !== 'VALID' || v.validationReport?.issues?.some(i => i.level === 'ERROR')) continue;
    const locations = new Map(v.locations.map(l => [l.id, l]));
    const key = (id: string): string => {
      const l = locations.get(id);
      return l?.stationId || (l?.technicalLocationId ? `technical:${l.technicalLocationId}` : '');
    };
    for (const path of [v.outboundPath, v.returnPath]) {
      if (!path || path.error || Number(path.topologyRevision ?? 0) !== Number(path.resolvedRevision ?? 0)) continue;
      for (const leg of path.legs ?? []) {
        const fromId = key(leg.fromLocationId), toId = key(leg.toLocationId);
        if (fromId && toId && validRoute(leg.routePoints)) result.push({ fromId, toId, route: leg.routePoints });
      }
    }
  }
  for (const service of services) {
    // A stale compiled V2 occurrence cannot resurrect an invalidated version.
    if (service._v2OccurrenceId) continue;
    for (const [stops, routes] of [[service.stops, service.routes], [service._returnStopsData, service._returnRoutes]] as const) {
      if (!stops || !routes) continue;
      for (let i = 0; i < routes.length; i++) {
        const fromId = stops[i]?.stationId, toId = stops[i + 1]?.stationId;
        if (fromId && toId && validRoute(routes[i])) result.push({ fromId, toId, route: routes[i] });
      }
    }
  }
  return result;
}

export class FreightNetwork {
  private readonly edges = new Map<string, Set<string>>();
  private readonly closed = new Set<string>();
  readonly stations = new Set<string>();
  edgeCount = 0;
  constructor(world: FreightNetworkWorld, extra: readonly FreightRailLeg[] = []) {
    for (const s of world.stations ?? []) {
      if (!s?.id || !validPoint(s)) continue;
      this.stations.add(s.id);
    }
    for (const s of world.stations ?? []) if (s?.closed) this.closed.add(s.id);
    const add = (leg: FreightRailLeg): void => {
      if (!leg.fromId || !leg.toId || leg.fromId === leg.toId || this.closed.has(leg.fromId) || this.closed.has(leg.toId) || !validRoute(leg.route)) return;
      // Technical endpoints are explicit identities, never a spatial join.
      if ((!this.stations.has(leg.fromId) && !leg.fromId.startsWith('technical:')) ||
          (!this.stations.has(leg.toId) && !leg.toId.startsWith('technical:'))) return;
      this.link(leg.fromId, leg.toId);
      if (leg.reverseAllowed && reversible(leg.route)) this.link(leg.toId, leg.fromId);
    };
    for (const track of world.tracks ?? []) {
      if ((track.worksActive && ['closed', 'closure', 'stop', 'fermeture'].includes(text(track.worksImpact))) ||
          (track.incidentActive && track.incidentEffect === 'stop')) continue;
      add({ fromId: track.stationA, toId: track.stationB, route: track.route ?? [], reverseAllowed: true });
    }
    for (const leg of extra) add(leg);
  }
  private link(a: string, b: string): void {
    let next = this.edges.get(a);
    if (!next) { next = new Set(); this.edges.set(a, next); }
    if (!next.has(b)) { next.add(b); this.edgeCount++; }
  }
  /** An iterative traversal handles cycles and long networks without call-stack growth. */
  reachableStations(origin: string): Set<string> {
    const reachable = new Set<string>();
    if (!this.stations.has(origin) || this.closed.has(origin)) return reachable;
    const visited = new Set([origin]), queue = [origin];
    for (let head = 0; head < queue.length; head++) {
      for (const next of this.edges.get(queue[head]) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next); queue.push(next);
        if (this.stations.has(next)) reachable.add(next);
      }
    }
    return reachable;
  }
}
