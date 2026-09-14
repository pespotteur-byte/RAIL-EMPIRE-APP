import { bookedIncidentStop, type IncidentScheduledStop } from './scheduled-incident-stop.js';
type __KPStruct82 = unknown[];
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { haversineDistance } from './simulation.js?v=1784250033';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { getGlobalRng } from './rng.js?v=1784250033';
import type { Weather } from './weather.js';

let nextIncId = 1;

type IncidentType = {
  id: string; name: string; impact: string; special: string; probability: number; seasons: string[];
  durationMin: number; durationMax: number; effect: string; speedLimit: number; scope: string;
  summerProbability?: number; requireElectrified?: boolean; requirePassenger?: boolean; requirePassengerService?: boolean; requireStopped?: boolean; pureStation?: boolean;
  timeWindows?: Array<[number, number]>; probabilityLabel?: string; weatherTriggered?: boolean; weatherHazard?: string;
  weatherRatePerHour?: number; weatherMinHazard?: number;
};
type IncidentRoutePoint = { lat: number; lon: number; wayId?: unknown; way_id?: unknown };
type IncidentRouteCandidatePoint = { lat?: number; lon?: number; wayId?: unknown; way_id?: unknown };
type IncidentInput = Record<string, unknown>;
type IncidentStation = { id?: string | number; stationId?: string | number; name?: string; lat?: number; lon?: number; platforms?: unknown };
type IncidentTrack = { id?: string | number; stationA?: string | number; stationB?: string | number; name?: string; route?: unknown; electrified?: boolean; wayId?: string | number; _incidentIds?: string[]; incidentActive?: boolean; incidentEffect?: string | null; incidentSpeedLimit?: number | null; incidentName?: string | null };
type IncidentWorld = { stations?: IncidentStation[]; tracks?: IncidentTrack[]; getStationById?: (id: unknown) => IncidentStation | null | undefined };
type IncidentDelayReason = { incidentId?: string | number; typeId?: string; text?: string; startDelay?: number; lastDelay?: number; endDelay?: number; active?: boolean; contributed?: boolean; _drop?: boolean };
type IncidentStoppedAt = string | number | { id?: string | number; stationId?: string | number; name?: string } | null;
type IncidentTrain = Record<string, unknown> & { id?: string | number; name?: string; stoppedAt?: IncidentStoppedAt; decel?: number; incident?: unknown; rame?: { totalCapacity?: number } | null; totalCapacity?: number; incidentDelayReasons?: IncidentDelayReason[]; delay?: number; delayReason?: string; state?: string };
type IncidentStop = IncidentScheduledStop;
type IncidentService = {
  id?: string | number; name?: string; number?: string | number; state?: string; position?: { lat?: number; lon?: number } | null; speed?: number; delay?: number; serviceType?: string; category?: string;
  train?: IncidentTrain; rame?: { totalCapacity?: number } | null; stops?: IncidentStop[]; currentStopIndex?: number;
  getCurrentStops?: () => IncidentStop[]; _state?: { cachedRoute?: Array<{ lat: number; lon: number; wayId?: unknown; way_id?: unknown }>; segDists?: number[]; index: number; progress: number };
  _safetyHorizonKm?: (...args: unknown[]) => number; _lastPhysicsDecelMs2?: number;
};
type IncidentDepotManager = { activeRescues?: Array<{ targetServiceId?: string | number; state?: string }>; dispatchRescue?: (world: IncidentWorld, svc: IncidentService) => unknown };
type IncidentLocation = { key: string; text: string; stationA: string | null; stationB: string | null; stationAName: string; stationBName: string };
type IncidentWeatherState = Record<string, unknown> & { windGust?: number; precipitation?: number; temperature?: number; snowfall?: number; rain6hMm?: number; rain24hMm?: number; snowDepthCm?: number; risk?: IncidentWeatherRisk };
type IncidentWeatherRisk = Record<string, unknown> & { hazards?: Record<string, number>; level?: { label?: string } };
type IncidentWeatherCandidate = { loc: IncidentLocation; track: IncidentTrack | null; svc: IncidentService | null; point: { lat: number; lon: number }; state?: IncidentWeatherState; risk?: IncidentWeatherRisk; hazard?: number };

export const PREDEFINED_INCIDENT_TYPES: IncidentType[] = [
  {
    id: 'signal-failure',
    name: 'Panne de signalisation',
    impact: 'Ralentissement 30 km/h',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'slow',
    speedLimit: 30,
    scope: 'track',
  },
  {
    id: 'person-accident',
    name: 'Accident de personne',
    impact: 'Interruption des circulations',
    special: 'aucune',
    probability: 2.5,
    seasons: ['all'],
    durationMin: 120,
    durationMax: 240,
    effect: 'stop',
    speedLimit: 0,
    scope: 'track',
  },
  {
    id: 'power-failure',
    name: 'Défaut d\'alimentation électrique',
    impact: 'Interruption des circulations',
    special: 'Ligne électrifiée',
    probability: 7,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'stop',
    speedLimit: 0,
    scope: 'track',
    requireElectrified: true,
  },
  {
    id: 'door-problem',
    name: 'Problème de porte',
    impact: 'Interruption d\'un seul train, uniquement à l\'arrêt EN GARE',
    special: 'Train de voyageur',
    probability: 1.4, // v1.1.75: train-target incident probability / 5
    seasons: ['all'],
    durationMin: 5,
    durationMax: 5,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
    requirePassenger: true,
    requireStopped: true,
  },
  {
    id: 'crowding',
    name: 'Forte affluence à bord',
    impact: 'Interruption d\'un seul train, uniquement à l\'arrêt EN GARE',
    special: 'Train de voyageur retardé ou effectuant des arrêts proches. Uniquement de 7h à 10h30 et de 16h30 à 20h30.',
    probability: 1.4, // v1.1.75: train-target incident probability / 5
    seasons: ['all'],
    durationMin: 5,
    durationMax: 10,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
    requirePassenger: true,
    requirePassengerService: true,
    requireStopped: true,
    timeWindows: [[7 * 60, 10 * 60 + 30], [16 * 60 + 30, 20 * 60 + 30]],
  },
  {
    id: 'train-breakdown',
    name: 'Train en panne',
    impact: 'Interruption d\'un seul train. Si le jeu considère la panne légère celui-ci pourra repartir. En cas contraire une DDS devra être effectuée.',
    special: 'aucune',
    probability: 0.9, // v1.1.75: winter train-target probability / 5
    summerProbability: 1.5, // v1.1.75: summer train-target probability / 5
    seasons: ['all'],
    durationMin: 15,
    durationMax: 45,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
  },
  {
    id: 'abandoned-luggage',
    name: 'Bagage abandonné',
    impact: 'Interruption des circulations',
    special: 'Uniquement aux gares',
    probability: 7.5,
    seasons: ['all'],
    durationMin: 30,
    durationMax: 60,
    effect: 'stop',
    speedLimit: 0,
    scope: 'station',
  },
  {
    id: 'obstacle-on-track',
    name: 'Obstacle sur les voies',
    impact: 'Interruption des circulations en gare ou entre deux gares',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 30,
    durationMax: 120,
    effect: 'stop',
    speedLimit: 0,
    scope: 'station-or-track',
  },
  {
    id: 'track-incident',
    name: 'Incident voie',
    impact: 'Interruption des circulations',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'stop',
    speedLimit: 0,
    scope: 'track',
  },
  {
    id: 'people-on-track',
    name: 'Personnes sur les voies',
    impact: 'Ralentissement 30 km/h en gare ou entre deux gares',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 45,
    effect: 'slow',
    speedLimit: 30,
    scope: 'station-or-track',
  },
  {
    id: 'trackside-fire',
    name: 'Incendie aux abords des voies',
    impact: 'Interruption des circulations en gare ou entre deux gares',
    special: 'aucune',
    probability: 15,
    seasons: ['all'],
    durationMin: 60,
    durationMax: 60,
    effect: 'stop',
    speedLimit: 0,
    scope: 'station-or-track',
  },
  {
    id: 'passenger-illness',
    requirePassenger: true,
    requirePassengerService: true,
    name: 'Malaise voyageur',
    impact: 'Interruption d\'un seul train, uniquement à l\'arrêt EN GARE',
    special: 'Train à l\'arrêt en gare',
    probability: 3, // v1.1.75: train-target incident probability / 5
    seasons: ['all'],
    durationMin: 10,
    durationMax: 25,
    effect: 'stop',
    speedLimit: 0,
    scope: 'train',
    requireStopped: true,
  },
  {
    id: 'law-enforcement',
    name: 'Intervention des forces de l\'ordre',
    impact: 'Ralentissement 60 km/h',
    special: 'Uniquement en gare',
    probability: 15,
    seasons: ['all'],
    durationMin: 15,
    durationMax: 30,
    effect: 'slow',
    speedLimit: 60,
    scope: 'station',
    pureStation: true,
  },

  // HOTFIX56 — incidents météo. Ils ne participent jamais au tirage aléatoire
  // générique des 50 incidents/h : leur crédit dépend exclusivement de la météo
  // locale, des seuils HOTFIX55 et de la durée d'exposition.
  {
    id:'weather-tree-obstacle', name:'Arbre ou branche sur les voies',
    impact:'Interruption des circulations',
    special:'Météo — rafales ≥ 80 km/h ; risque fort ≥ 100 km/h. Sol saturé aggravant.',
    probability:0, probabilityLabel:'Dynamique · météo × exposition', seasons:['weather'],
    durationMin:30,durationMax:180,effect:'stop',speedLimit:0,scope:'track',
    weatherTriggered:true,weatherHazard:'obstacle',weatherRatePerHour:0.9,weatherMinHazard:0.12,
  },
  {
    id:'weather-catenary-damage', name:'Caténaire endommagée / givrée',
    impact:'Interruption des circulations électriques',
    special:'Météo — rafales ≥ 90 km/h, pluie verglaçante ou givre par froid humide. Ligne électrifiée.',
    probability:0, probabilityLabel:'Dynamique · météo × exposition', seasons:['weather'],
    durationMin:45,durationMax:180,effect:'stop',speedLimit:0,scope:'track',requireElectrified:true,
    weatherTriggered:true,weatherHazard:'catenary',weatherRatePerHour:0.55,weatherMinHazard:0.16,
  },
  {
    id:'weather-flooded-track', name:'Voie inondée',
    impact:'Interruption des circulations',
    special:'Météo — ≥ 10 mm/h ou cumul ≥ 30 mm/6 h ou ≥ 60 mm/24 h ; risque croissant avec la durée.',
    probability:0, probabilityLabel:'Dynamique · pluie/cumul × exposition', seasons:['weather'],
    durationMin:60,durationMax:240,effect:'stop',speedLimit:0,scope:'track',
    weatherTriggered:true,weatherHazard:'flooding',weatherRatePerHour:0.45,weatherMinHazard:0.12,
  },
  {
    id:'weather-frozen-switch', name:'Aiguillage bloqué par gel ou neige',
    impact:'Interruption locale des circulations',
    special:'Météo — T ≤ 0 °C avec humidité/précipitations/neige ; risque renforcé sous -5 °C ou avec accumulation.',
    probability:0, probabilityLabel:'Dynamique · gel/neige × exposition', seasons:['weather'],
    durationMin:20,durationMax:120,effect:'stop',speedLimit:0,scope:'station',pureStation:true,
    weatherTriggered:true,weatherHazard:'switchFreeze',weatherRatePerHour:0.65,weatherMinHazard:0.14,
  },
  {
    id:'weather-heat-track', name:'Dilatation / déformation de la voie',
    impact:'Ralentissement 40 km/h',
    special:'Météo — chaleur ≥ 35 °C ; risque fort à partir de 40 °C et avec exposition prolongée.',
    probability:0, probabilityLabel:'Dynamique · chaleur × exposition', seasons:['weather'],
    durationMin:60,durationMax:240,effect:'slow',speedLimit:40,scope:'track',
    weatherTriggered:true,weatherHazard:'heatTrack',weatherRatePerHour:0.30,weatherMinHazard:0.12,
  },
  {
    id:'weather-lightning-signal', name:'Panne de signalisation liée à la foudre',
    impact:'Ralentissement 30 km/h',
    special:'Météo — orage actif (codes WMO 95/96/99), risque aggravé par fortes rafales.',
    probability:0, probabilityLabel:'Dynamique · orage × exposition', seasons:['weather'],
    durationMin:20,durationMax:75,effect:'slow',speedLimit:30,scope:'track',
    weatherTriggered:true,weatherHazard:'stormSignal',weatherRatePerHour:0.40,weatherMinHazard:0.30,
  },
  {
    id:'weather-landslide', name:'Coulée de boue / glissement de terrain',
    impact:'Interruption des circulations',
    special:'Météo — pluie ≥ 25 mm/h ou cumul ≥ 50 mm/6 h ou ≥ 100 mm/24 h.',
    probability:0, probabilityLabel:'Dynamique · pluie extrême × exposition', seasons:['weather'],
    durationMin:120,durationMax:360,effect:'stop',speedLimit:0,scope:'track',
    weatherTriggered:true,weatherHazard:'landslide',weatherRatePerHour:0.22,weatherMinHazard:0.18,
  },
  {
    id:'weather-snow-blockage', name:'Accumulation de neige sur la voie',
    impact:'Ralentissement 40 km/h',
    special:'Météo — neige ≥ 3 cm/h ou ≥ 15 cm au sol ; risque de blocage des appareils de voie.',
    probability:0, probabilityLabel:'Dynamique · neige × exposition', seasons:['weather'],
    durationMin:30,durationMax:180,effect:'slow',speedLimit:40,scope:'station-or-track',
    weatherTriggered:true,weatherHazard:'snowBlockage',weatherRatePerHour:0.45,weatherMinHazard:0.16,
  },
  {
    id:'weather-rolling-stock-failure', name:'Panne matériel liée aux conditions météo',
    impact:'Interruption d’un seul train ; dépannage/secours selon la panne',
    special:'Météo — froid ≤ -12 °C, chaleur ≥ 40 °C, neige forte ou pluie verglaçante.',
    probability:0, probabilityLabel:'Dynamique · météo extrême × exposition', seasons:['weather'],
    durationMin:20,durationMax:90,effect:'stop',speedLimit:0,scope:'train',
    weatherTriggered:true,weatherHazard:'rollingStock',weatherRatePerHour:0.28,weatherMinHazard:0.20,
  },
];

function incText(value: unknown, fallback: string = '') {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}
function incFinite(value: unknown, fallback: number = 0, min: number = -Infinity, max: number = Infinity): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function normalizeIncidentServiceClass(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[ _]+/g, '-');
}

/** Passenger-only human incidents must follow the SC traffic classification,
 * not the physical seating capacity of the consist. A W can contain hundreds
 * of seats and still be an empty passenger-stock movement. */
function isCommercialPassengerIncidentService(service: IncidentService): boolean {
  const markers = [service?.serviceType, service?.category, service?.train?.category]
    .map(normalizeIncidentServiceClass).filter(Boolean);
  const excluded = new Set(['fret','freight','w','hlp','tm','infra','ttx','work','m-','evo']);
  if (markers.some((m) => excluded.has(m))) return false;
  if (markers.some((m) => ['passager','passenger','voyageur','voyageurs'].includes(m))) return true;
  // Backward compatibility for very old saves that did not persist a class.
  const rame = service?.rame || service?.train?.rame || null;
  return Number(rame?.totalCapacity || 0) > 0 || Number(service?.train?.totalCapacity || 0) > 0;
}
function normalizeIncidentRoute(route: unknown) {
  if (!Array.isArray(route)) return null;
  const pts = route.map((p: { lat: unknown; lon: unknown }) => {
    const lat = Number(p?.lat), lon = Number(p?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
  }).filter((p): p is IncidentRoutePoint => p !== null);
  return pts.length >= 2 ? pts : null;
}

export class Incident {
  declare id: string; declare typeId: string; declare name: string; declare trackName: string;
  declare stationA: string | null; declare stationB: string | null; declare stationAName: string; declare stationBName: string;
  declare trainId: string | null; declare trainName: string | null; declare serviceId: string | null;
  declare effect: string; declare speedLimit: number; declare route: IncidentRoutePoint[] | null;
  declare duration: number; declare remaining: number; declare active: boolean; declare startTime: number;
  declare locationText: string; declare locationKey: string; declare source: string; declare triggerText: string;
  declare weatherLevel: string; declare weatherHazard: string; declare _bbox?: [number, number, number, number];
  declare train?: IncidentTrain;
  constructor(data: IncidentInput = {}) {
    this.id = incText(data.id) || `inc-${nextIncId++}`;
    this.typeId = incText(data.typeId);
    this.name = incText(data.name, 'Incident');
    this.trackName = incText(data.trackName);
    this.stationA = data.stationA == null ? null : incText(data.stationA);
    this.stationB = data.stationB == null ? null : incText(data.stationB);
    this.stationAName = incText(data.stationAName);
    this.stationBName = incText(data.stationBName);
    this.trainId = data.trainId == null ? null : incText(data.trainId);
    this.trainName = data.trainName == null ? null : incText(data.trainName);
    this.serviceId = data.serviceId == null ? null : incText(data.serviceId);
    this.effect = incText(data.effect, 'slow');
    this.speedLimit = incFinite(data.speedLimit, 0, 0, 400);
    this.route = normalizeIncidentRoute(data.route);
    this.duration = incFinite(data.duration, 60, 1, 1440);
    this.remaining = incFinite(data.remaining, this.duration, 0, this.duration);
    this.active = data.active !== false && this.remaining > 0;
    this.startTime = incFinite(data.startTime, 0, 0);
    this.locationText = incText(data.locationText);
    this.locationKey = incText(data.locationKey);
    this.source = incText(data.source, 'random');
    this.triggerText = incText(data.triggerText);
    this.weatherLevel = incText(data.weatherLevel);
    this.weatherHazard = incText(data.weatherHazard);
  }
}

export class IncidentManager {
  declare activeIncidents: Incident[];
  declare lastCheck: unknown;
  declare predefinedTypes: IncidentType[];
  declare enabledTypes: Set<unknown>;
  declare targetIncidentsPerHour: number;
  declare _incidentSpawnCredit: number;
  declare _incidentSpawnLastAbsMinute: number | null;
  declare _weatherIncidentLastAbsMinute: number | null;
  declare _weatherIncidentCredit: Record<string, number>;
  declare _weatherSampleCursor: number;
  declare _incBboxVer: number | null;
  declare incidentTypesVersion: number;
  declare accordionHorizonKm: number;
  constructor() {
    this.activeIncidents = [];
    this.lastCheck = -1;
    this.predefinedTypes = PREDEFINED_INCIDENT_TYPES;
    this.enabledTypes = new Set(PREDEFINED_INCIDENT_TYPES.map((t) => t.id));
    // v1.1.65 — Europe-wide incident cadence. The old one-roll-per-type/hour
    // model produced ~1 incident/h. Accumulate spawn credit from ELAPSED game
    // time so starting/reloading at 15:25 never creates a catch-up burst.
    // 50 / 60 = one successful incident every 1.2 game minutes on average.
    this.targetIncidentsPerHour = 50;
    this._incidentSpawnCredit = 0;
    this._incidentSpawnLastAbsMinute = null;
    this._weatherIncidentLastAbsMinute = null;
    this._weatherIncidentCredit = Object.create(null);
    this._weatherSampleCursor = 0;
    this._incBboxVer = null;
    this.incidentTypesVersion = 56;
    this.accordionHorizonKm = 3.0; // INC-03 : effet accordéon avant la zone d'incident
  }

  isTypeEnabled(id: unknown) { return this.enabledTypes.has(id); }
  getEnabledTypes() { return Array.from(this.enabledTypes); }
  setEnabledTypes(ids: unknown, savedVersion: unknown = 0) {
    const known=new Set(PREDEFINED_INCIDENT_TYPES.map((t) =>t.id));
    this.enabledTypes = new Set(Array.isArray(ids) ? ids.filter((id) =>known.has(id)) : [...known]);
    // Saves antérieures à HOTFIX56 ne pouvaient pas contenir les nouveaux types météo.
    // On les active une seule fois via le numéro de schéma ; les sauvegardes 56+
    // respectent ensuite exactement les cases cochées/décochées par le joueur.
    if (Array.isArray(ids) && Number(savedVersion||0) < 56) {
      for (const t of PREDEFINED_INCIDENT_TYPES) if (t.weatherTriggered) this.enabledTypes.add(t.id);
    }
  }
  toggleType(id: unknown, enabled: unknown) {
    if (!PREDEFINED_INCIDENT_TYPES.some((t) =>t.id===id)) return false;
    if (enabled) this.enabledTypes.add(id);
    else this.enabledTypes.delete(id);
    return true;
  }

  _normalizeIncidentLocationText(text: unknown) {
    return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  _locationKeyFromParts(stationA: unknown, stationB: unknown, locationText: unknown = '') {
    const a = stationA == null ? '' : String(stationA);
    const b = stationB == null ? '' : String(stationB);
    if (a && b) {
      if (a === b) return `station:${a}`;
      return `segment:${[a, b].sort().join('<>')}`;
    }
    const text = this._normalizeIncidentLocationText(locationText);
    return text ? `text:${text}` : '';
  }

  _locationKeyForIncident(inc: Incident) {
    if (!inc) return '';
    return inc.locationKey || this._locationKeyFromParts(inc.stationA, inc.stationB, inc.locationText || inc.trackName);
  }

  _hasActiveDuplicate(typeId: unknown, locationKey: unknown, ignoreId: unknown = null) {
    const key = String(locationKey || '');
    if (!typeId || !key) return false;
    return this.activeIncidents.some((inc: Incident) =>
      inc?.active && String(inc.typeId || '') === String(typeId) &&
      String(inc.id || '') !== String(ignoreId || '') &&
      this._locationKeyForIncident(inc) === key
    );
  }

  _serviceLocationDescriptor(svc: IncidentService, world: IncidentWorld) {
    const stopped = svc?.train?.stoppedAt;
    if (stopped) {
      const stoppedId = typeof stopped === 'object' ? (stopped.id ?? stopped.stationId ?? null) : stopped;
      const st = typeof stopped === 'object' ? stopped : world?.getStationById?.(stopped);
      const id = stoppedId != null ? String(stoppedId) : (st?.id != null ? String(st.id) : '');
      const name = st?.name || '';
      if (id) return { key:`station:${id}`, text:name ? `à ${name}` : '', stationA:id, stationB:id, stationAName:name, stationBName:name };
      if (name) return { key:`text:${this._normalizeIncidentLocationText(`à ${name}`)}`, text:`à ${name}`, stationA:null, stationB:null, stationAName:name, stationBName:name };
    }
    // Defensive fallback: a service explicitly stopped at a station can come from
    // older/runtime test shapes where train.stoppedAt was not populated yet.
    if (svc?.state === 'stopped_at_station' && svc?.position && Array.isArray(world?.stations) && (world.stations?.length || 0)) {
      let nearest = null;
      let nearestKm = Infinity;
      for (const st of world.stations) {
        if (!Number.isFinite(Number(st?.lat)) || !Number.isFinite(Number(st?.lon))) continue;
        const d = haversineDistance(Number(svc.position.lat), Number(svc.position.lon), Number(st.lat), Number(st.lon));
        if (d < nearestKm) { nearestKm = d; nearest = st; }
      }
      if (nearest?.id != null) {
        const id = String(nearest.id);
        const name = nearest.name || '';
        return { key:`station:${id}`, text:name ? `à ${name}` : '', stationA:id, stationB:id, stationAName:name, stationBName:name };
      }
    }
    const stops = typeof svc?.getCurrentStops === 'function' ? svc.getCurrentStops() : (svc?.stops || []);
    const idx = Math.max(1, Math.min(stops.length - 1, Number(svc?.currentStopIndex || 1)));
    const aIdRaw = stops[idx - 1]?.stationId;
    const bIdRaw = stops[idx]?.stationId;
    const aId = aIdRaw == null ? '' : String(aIdRaw);
    const bId = bIdRaw == null ? '' : String(bIdRaw);
    const a = world?.getStationById?.(aIdRaw)?.name || '';
    const b = world?.getStationById?.(bIdRaw)?.name || '';
    if (aId && bId) {
      const text = a && b ? `entre ${a} et ${b}` : (a ? `à ${a}` : (b ? `à ${b}` : ''));
      return { key:`segment:${[aId,bId].sort().join('<>')}`, text, stationA:aId, stationB:bId, stationAName:a, stationBName:b };
    }
    const text = a && b ? `entre ${a} et ${b}` : (a ? `à ${a}` : (b ? `à ${b}` : ''));
    return { key:text ? `text:${this._normalizeIncidentLocationText(text)}` : '', text, stationA:aId || null, stationB:bId || null, stationAName:a, stationBName:b };
  }

  createIncident(data: unknown, world: IncidentWorld | null) {
    const inc = new Incident(data && typeof data === 'object' && !Array.isArray(data) ? data as IncidentInput : {});
    inc.locationKey = this._locationKeyForIncident(inc);
    if (this._hasActiveDuplicate(inc.typeId, inc.locationKey, inc.id)) return null;
    this.activeIncidents.push(inc);
    if (world && inc.stationA && inc.stationB) this._markAffectedTracks(inc, world);
    return inc;
  }

  _recomputeTrackIncidentVisual(track: IncidentTrack) {
    const ids = Array.isArray(track?._incidentIds) ? track._incidentIds : [];
    const active = ids.map((id: unknown) => this.activeIncidents.find((i: Incident) => i.id === id && i.active !== false)).filter(Boolean) as Incident[];
    if (!active.length) {
      track.incidentActive = false; track.incidentEffect = null; track.incidentSpeedLimit = null; track.incidentName = null;
      return;
    }
    const stops = active.filter((i: Incident) => i.effect === 'stop' || Number(i.speedLimit) === 0);
    const chosen = stops[0] || active.reduce((best: __S3Struct100, i: __S3Struct101) => {
      const a = Number(best.speedLimit), b = Number(i.speedLimit);
      return (Number.isFinite(b) && (!Number.isFinite(a) || b < a)) ? i : best;
    }, active[0]);
    track.incidentActive = true;
    track.incidentEffect = stops.length ? 'stop' : (chosen.effect || 'slow');
    track.incidentSpeedLimit = stops.length ? 0 : (Number.isFinite(Number(chosen.speedLimit)) ? Number(chosen.speedLimit) : null);
    track.incidentName = active.map((i: Incident) => i.name).filter(Boolean).join(' + ');
  }

  _markAffectedTracks(inc: Incident, world: IncidentWorld) {
    if (!inc.stationA || !inc.stationB) return;
    for (const track of (world.tracks || [])) {
      const matches = (track.stationA === inc.stationA && track.stationB === inc.stationB) ||
                      (track.stationA === inc.stationB && track.stationB === inc.stationA);
      if (matches) {
        if (!track._incidentIds) track._incidentIds = [];
        if (!track._incidentIds.includes(inc.id)) track._incidentIds.push(inc.id);
        this._recomputeTrackIncidentVisual(track);
      }
    }
  }

  removeIncident(id: unknown, world: IncidentWorld) {
    const inc = this.activeIncidents.find((i: Incident) => i.id === id);
    if (inc) {
      inc.active = false;
      this._clearTrackFlags(inc, world);
      if (inc.serviceId && inc.train) {
        // legacy single-train incident cleanup if train reference attached
        inc.train.incident = null;
      }
    }
    this.activeIncidents = this.activeIncidents.filter((i: Incident) => i.id !== id);
    this._incBboxVer = null;
  }

  _clearTrackFlags(inc: Pick<Incident, 'id'>, world: IncidentWorld) {
    if (!world) return;
    for (const track of (world.tracks || [])) {
      if (!Array.isArray(track._incidentIds)) continue;
      track._incidentIds = track._incidentIds.filter((iid: unknown) => iid !== inc.id);
      this._recomputeTrackIncidentVisual(track);
    }
  }

  _isOnRoute(lat: unknown, lon: unknown, route: IncidentRoutePoint[] | null | undefined) {
    if (!route || route.length < 2) return false;
    const tolerance = 0.5;
    for (let i = 0; i < route.length - 1; i++) {
      const aLat = route[i].lat, aLon = route[i].lon;
      const bLat = route[i + 1].lat, bLon = route[i + 1].lon;
      if (this._pointToSegmentDist(lat as number, lon as number, aLat as number, aLon as number, bLat as number, bLon as number) < tolerance) return true;
    }
    return false;
  }

  _pointToSegmentDist(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number) {
    const cosLat = Math.cos(pLat * Math.PI / 180);
    const dx = (bLon - aLon) * 111 * cosLat;
    const dy = (bLat - aLat) * 111;
    const px = (pLon - aLon) * 111 * cosLat;
    const py = (pLat - aLat) * 111;
    const segLenSq = dx * dx + dy * dy;
    if (segLenSq < 0.0001) return Math.sqrt(px * px + py * py);
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
    const projX = t * dx, projY = t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  _isBetweenStations(lat: number, lon: number, world: IncidentWorld, inc: Pick<Incident, 'stationA' | 'stationB'>) {
    const stA = world.getStationById?.(inc.stationA);
    const stB = world.getStationById?.(inc.stationB);
    if (!stA || !stB) return false;
    const aLat=Number(stA.lat), bLat=Number(stB.lat), aLon=Number(stA.lon), bLon=Number(stB.lon);
    if (![aLat,bLat,aLon,bLon].every(Number.isFinite)) return false;
    const minLat = Math.min(aLat, bLat) - 0.01;
    const maxLat = Math.max(aLat, bLat) + 0.01;
    const minLon = Math.min(aLon, bLon) - 0.01;
    const maxLon = Math.max(aLon, bLon) + 0.01;
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
    const totalDist = haversineDistance(aLat, aLon, bLat, bLon);
    const dA = haversineDistance(lat, lon, aLat, aLon);
    const dB = haversineDistance(lat, lon, bLat, bLon);
    return (dA + dB) < totalDist + 2;
  }

  // Track/station-track incidents should only affect a train whose current leg
  // actually traverses the incident segment. A train stopped at the end of the
  // segment and departing on another leg must not be blocked by the previous one.
  _incidentMatchesServiceLeg(svc: IncidentService, inc: Pick<Incident, 'stationA' | 'stationB'>) {
    if (inc.stationA === inc.stationB) return true; // pure station incident
    const stops = svc.getCurrentStops ? svc.getCurrentStops() : null;
    if (!stops || stops.length < 2) return true;
    // currentStopIndex is the next stop while moving, and has already been
    // incremented upon arrival (stopped_at_station). The origin of the current
    // leg is therefore the previous stop except when the train is still waiting
    // to start its very first leg.
    const stopIndex = Number.isInteger(svc.currentStopIndex) ? Number(svc.currentStopIndex) : 0;
    const originIdx = svc.state === 'waiting' ? stopIndex : Math.max(0, stopIndex - 1);
    const origin = stops[originIdx];
    const dest = stops[originIdx + 1];
    if (!origin || !dest) return true;
    const a = origin.stationId;
    const b = dest.stationId;
    if (a == null || b == null) return true;
    const incA = inc.stationA;
    const incB = inc.stationB;
    return (a === incA && b === incB) || (a === incB && b === incA);
  }

  // INC-03 : distance en avant du train jusqu'au point cible le long du trajet de service
  _distanceAheadOnRoute(svc: IncidentService, targetLat: number, targetLon: number, targetWayId: unknown = null) {
    const state = svc._state;
    const route = state?.cachedRoute;
    const segDists = state?.segDists;
    const stateIndex = Number.isInteger(state?.index) ? Number(state?.index) : 0;
    const stateProgress = Number.isFinite(Number(state?.progress)) ? Number(state?.progress) : 0;
    if (!route || route.length < 2 || stateIndex >= route.length - 1) return null;
    let minDist = Infinity, bestSeg = -1, bestT = 0, bestAhead = Infinity;
    for (let i = stateIndex; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      if (targetWayId != null) {
        const aw = a?.wayId ?? a?.way_id ?? null;
        const bw = b?.wayId ?? b?.way_id ?? null;
        if (aw != null || bw != null) {
          if (String(aw ?? bw) !== String(targetWayId) && String(bw ?? aw) !== String(targetWayId)) continue;
        }
      }
      const d = this._pointToSegmentDist(targetLat, targetLon, a.lat, a.lon, b.lat, b.lon);
      if (d < minDist) {
        minDist = d;
        bestSeg = i;
        // recompute projection t
        const cosLat = Math.cos(a.lat * Math.PI / 180);
        const dx = (b.lon - a.lon) * 111 * cosLat;
        const dy = (b.lat - a.lat) * 111;
        const px = (targetLon - a.lon) * 111 * cosLat;
        const py = (targetLat - a.lat) * 111;
        const segLenSq = dx * dx + dy * dy;
        bestT = segLenSq < 0.0001 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
      }
    }
    if (bestSeg < 0) return null;
    if (bestSeg === stateIndex && bestT < stateProgress) return null; // derrière le train
    let ahead = 0;
    const curSegDist = (segDists && segDists[stateIndex]) || haversineDistance(route[stateIndex].lat, route[stateIndex].lon, route[stateIndex + 1].lat, route[stateIndex + 1].lon);
    ahead += (1 - stateProgress) * curSegDist;
    for (let i = stateIndex + 1; i < bestSeg; i++) {
      ahead += (segDists && segDists[i]) || haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
    }
    if (bestSeg > stateIndex) {
      ahead += bestT * ((segDists && segDists[bestSeg]) || haversineDistance(route[bestSeg].lat, route[bestSeg].lon, route[bestSeg + 1].lat, route[bestSeg + 1].lon));
    } else {
      ahead -= (stateProgress - bestT) * curSegDist;
    }
    // One kilometre could accidentally match a parallel railway or another side
    // of a junction. Way identity is preferred; geometry-only fallback is kept
    // tight enough for station markers while avoiding cross-line contamination.
    return minDist < (targetWayId != null ? 0.08 : 0.25) ? ahead : null;
  }

  // INC-03 : approche incident sur une vraie enveloppe de freinage physique.
  // L'ancien modèle utilisait toujours 3 km puis 30 -> 0 km/h linéairement,
  // indépendamment de la vitesse, de la rame, de la météo et de la pente.
  getApproachingIncident(svc: IncidentService, world: IncidentWorld) {
    if (svc.state !== 'moving' || !svc._state?.cachedRoute || this.activeIncidents.length === 0) return null;
    const physicalHorizon = typeof svc._safetyHorizonKm === 'function'
      ? Number(svc._safetyHorizonKm(svc.speed || 0))
      : 0;
    const horizon = Math.max(Number(this.accordionHorizonKm) || 3, Number.isFinite(physicalHorizon) ? physicalHorizon : 0);
    let best = null;
    let bestDist = Infinity;
    for (const inc of this.activeIncidents) {
      if (!inc.active || inc.serviceId) continue; // incidents mono-train gérés directement
      if (inc.effect !== 'stop' && inc.effect !== 'slow') continue;
      if (inc.stationA != null && inc.stationB != null && inc.stationA !== inc.stationB) {
        if (!this._incidentMatchesServiceLeg(svc, inc)) continue;
      }
      const points: IncidentRouteCandidatePoint[] = [];
      if (inc.route && inc.route.length) points.push(...inc.route);
      else if (world) {
        const stA = world.getStationById?.(inc.stationA);
        const stB = world.getStationById?.(inc.stationB);
        if (stA) points.push({ lat: stA.lat, lon: stA.lon });
        if (stB) points.push({ lat: stB.lat, lon: stB.lon });
      }
      if (points.length === 0) continue;
      let minDist = Infinity;
      for (const p of points) {
        const d = this._distanceAheadOnRoute(svc, p.lat!, p.lon!, p.wayId ?? p.way_id ?? null);
        if (d != null && d < minDist) minDist = d;
      }
      if (minDist <= horizon && minDist < bestDist) {
        bestDist = minDist;
        best = inc;
      }
    }
    if (!best || bestDist > horizon) return null;

    const fallbackMs2 = Math.max(0.05, Number(svc.train?.decel || 2) / 3.6);
    const decelMs2 = Math.max(0.05, Number(svc._lastPhysicsDecelMs2 || fallbackMs2));
    const distM = Math.max(0, bestDist * 1000);
    const reactionM = Math.max(0, Number(svc.speed || 0)) / 3.6 * 3;
    const availableM = Math.max(0, distM - reactionM - 50);

    if (best.effect === 'stop') {
      const safeKmh = Math.sqrt(Math.max(0, 2 * decelMs2 * availableM)) * 3.6;
      if (availableM <= 1) {
        return { effect: 'stop', speedLimit: 0, name: best.name, approaching: true };
      }
      return {
        effect: 'slow',
        speedLimit: Math.max(1, Math.round(safeKmh)),
        name: `Approche incident : ${best.name}`,
        approaching: true,
      };
    }

    const targetKmh = Math.max(0, Number(best.speedLimit || 30));
    const targetMs = targetKmh / 3.6;
    const curveKmh = Math.sqrt(Math.max(0, targetMs * targetMs + 2 * decelMs2 * availableM)) * 3.6;
    return {
      effect: 'slow',
      speedLimit: Math.max(targetKmh, Math.round(curveKmh)),
      name: `Approche incident : ${best.name}`,
      approaching: true,
    };
  }

  // --- Random incident spawning (Annexe 11) ---

  _randomDuration(min: number, max: number) {
    const rng = getGlobalRng();
    return Math.floor(min + rng.random() * (max - min + 1));
  }

  _probabilityForType(type: IncidentType, season: unknown) {
    if (type.id === 'train-breakdown') {
      return season === 'summer' ? (type.summerProbability || type.probability) : type.probability;
    }
    return type.probability;
  }

  _inTimeWindow(type: IncidentType, timeOfDay: number) {
    if (!type.timeWindows) return true;
    return type.timeWindows.some(([start, end]: [number, number]) => timeOfDay >= start && timeOfDay < end);
  }

  _spawnType(type: IncidentType, services: IncidentService[], world: IncidentWorld, timeOfDay: unknown) {
    if (!type) return null;
    try {
      if (type.scope === 'track') return this._spawnTrackIncident(type, world, timeOfDay);
      if (type.scope === 'station') {
        return type.pureStation
          ? this._spawnPureStationIncident(type, world, null, timeOfDay)
          : this._spawnStationIncident(type, world, timeOfDay);
      }
      if (type.scope === 'station-or-track') return this._spawnStationOrTrackIncident(type, world, timeOfDay);
      if (type.scope === 'train') return this._spawnTrainIncident(type, services, timeOfDay, world);
    } catch (e) {
      console.warn('Incident spawn failed for', type.id, e);
    }
    return null;
  }

  _weightedType(pool: IncidentType[], season: unknown) {
    if (!pool?.length) return null;
    const weights = pool.map((t) => Math.max(0.01, Number(this._probabilityForType(t, season)) || 0.01));
    const total = weights.reduce((a: number,b: number) => a+b, 0);
    let pick = getGlobalRng().random() * total;
    for (let i=0;i<pool.length;i++) {
      pick -= weights[i];
      if (pick <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  _spawnGuaranteedIncident(timeOfDay: unknown, services: IncidentService[], world: IncidentWorld, season: unknown) {
    const pool = this.predefinedTypes.filter((type: IncidentType) =>
      this.enabledTypes.has(type.id) && !type.weatherTriggered && (!type.timeWindows || this._inTimeWindow(type, timeOfDay as number))
    );
    // Retry with another weighted type when a conditional type has no valid
    // target (e.g. no passenger train stopped in a station). This is what makes
    // the cadence count successful incidents rather than failed random rolls.
    while (pool.length) {
      const type = this._weightedType(pool, season);
      if (!type) break;
      const inc = this._spawnType(type, services, world, timeOfDay);
      if (inc) return inc;
      const idx = pool.indexOf(type);
      if (idx >= 0) pool.splice(idx, 1);
    }
    return null;
  }

  _absoluteGameMinute(dateStr: unknown, timeOfDay: unknown) {
    const minuteOfDay = Number(timeOfDay);
    if (!Number.isFinite(minuteOfDay)) return null;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
      const dayMs = Date.parse(`${dateStr}T00:00:00Z`);
      if (Number.isFinite(dayMs)) return Math.floor(dayMs / 60000) + minuteOfDay;
    }
    // Legacy/fallback mode without a date: monotonicity is handled below.
    return minuteOfDay;
  }

  _trySpawn(timeOfDay: unknown, services: IncidentService[], world: IncidentWorld, season: unknown, dateStr: unknown = '') {
    const absMinute = this._absoluteGameMinute(dateStr, timeOfDay);
    if (typeof absMinute !== 'number' || !Number.isFinite(absMinute)) return 0;

    // First observation establishes the reference point only. This avoids
    // spawning 20+ incidents immediately when a save is opened mid-hour.
    if (!Number.isFinite(this._incidentSpawnLastAbsMinute)) {
      this._incidentSpawnLastAbsMinute = absMinute;
      return 0;
    }

    let elapsed = absMinute - this._incidentSpawnLastAbsMinute!;
    // Date-less legacy mode can cross midnight (1439 -> 0).
    if (!dateStr && elapsed < 0) elapsed += 1440;
    // Clock rewinds/load jumps reset the cadence cleanly instead of creating
    // negative credit. Forward time acceleration is intentionally honoured.
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      this._incidentSpawnLastAbsMinute = absMinute;
      return 0;
    }
    if (elapsed === 0) return 0;
    this._incidentSpawnLastAbsMinute = absMinute;

    this._incidentSpawnCredit += elapsed * (this.targetIncidentsPerHour / 60);
    let due = Math.floor(this._incidentSpawnCredit + 1e-9);
    let spawned = 0;
    while (due-- > 0) {
      const inc = this._spawnGuaranteedIncident(timeOfDay, services, world, season);
      if (!inc) break; // keep credit: retry when a valid target exists
      this._incidentSpawnCredit -= 1;
      spawned++;
    }
    // Avoid floating-point drift and pathological negative values.
    if (this._incidentSpawnCredit < 0) this._incidentSpawnCredit = 0;
    return spawned;
  }

  _weatherTrackPoint(track: IncidentTrack, world: IncidentWorld) {
    if (!track) return null;
    const route=Array.isArray(track.route)?track.route:[];
    if(route.length){const p=route[Math.floor(route.length/2)];if(Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lon)))return {lat:Number(p.lat),lon:Number(p.lon)};}
    const a=world?.getStationById?.(track.stationA), b=world?.getStationById?.(track.stationB);
    if(a&&b&&[a.lat,a.lon,b.lat,b.lon].every((v: unknown) =>Number.isFinite(Number(v))))return {lat:(Number(a.lat)+Number(b.lat))/2,lon:(Number(a.lon)+Number(b.lon))/2};
    return null;
  }

  _weatherTrackForLocation(loc: Pick<IncidentLocation, 'stationA' | 'stationB'>, world: IncidentWorld) {
    if(!loc||!world)return null;
    if(loc.stationA&&loc.stationB&&String(loc.stationA)!==String(loc.stationB)) {
      return (world.tracks||[]).find((t: IncidentTrack) =>(String(t.stationA)===String(loc.stationA)&&String(t.stationB)===String(loc.stationB))||(String(t.stationA)===String(loc.stationB)&&String(t.stationB)===String(loc.stationA)))||null;
    }
    if(loc.stationA) return (world.tracks||[]).find((t: IncidentTrack) =>String(t.stationA)===String(loc.stationA)||String(t.stationB)===String(loc.stationA))||null;
    return null;
  }

  _weatherCandidates(services: IncidentService[], world: IncidentWorld): IncidentWeatherCandidate[] {
    const out: IncidentWeatherCandidate[] = [],seen=new Set<string>();
    for(const svc of (services||[])) {
      if(!svc?.position)continue;
      const loc=this._serviceLocationDescriptor(svc,world); if(!loc?.key||seen.has(loc.key))continue;
      const track=this._weatherTrackForLocation(loc,world); const point={lat:Number(svc.position.lat),lon:Number(svc.position.lon)};
      if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon))continue;
      seen.add(loc.key); out.push({loc,track,svc,point});
      if(out.length>=24)break;
    }
    // Réseau sans train : échantillonnage rotatif très borné, sans parcourir les milliers de voies à chaque minute.
    const tracks=Array.isArray(world?.tracks)?world.tracks:[];
    const extra=Math.min(6,tracks.length);
    for(let i=0;i<extra;i++) {
      const idx=(this._weatherSampleCursor+i)%Math.max(1,tracks.length),track=tracks[idx];
      const key=this._locationKeyFromParts(track?.stationA,track?.stationB,track?.name||''); if(!key||seen.has(key))continue;
      const point=this._weatherTrackPoint(track,world); if(!point)continue;
      const a=world?.getStationById?.(track.stationA),b=world?.getStationById?.(track.stationB);
      seen.add(key);out.push({track,svc:null,point,loc:{key,stationA:track.stationA == null ? null : String(track.stationA),stationB:track.stationB == null ? null : String(track.stationB),stationAName:a?.name||'',stationBName:b?.name||'',text:a?.name&&b?.name?`entre ${a.name} et ${b.name}`:''}});
    }
    if(tracks.length)this._weatherSampleCursor=(this._weatherSampleCursor+extra)%tracks.length;
    return out;
  }

  _weatherTriggerText(type: Pick<IncidentType, 'weatherHazard'>, state: IncidentWeatherState) {
    const gust=Math.round(Number(state?.windGust)||0), p=Number(state?.precipitation)||0, t=Number(state?.temperature), snow=Number(state?.snowfall)||0;
    const r6=Number(state?.rain6hMm)||0,r24=Number(state?.rain24hMm)||0,depth=Number(state?.snowDepthCm)||0;
    if(type.weatherHazard==='obstacle')return `Rafales ${gust} km/h`;
    if(type.weatherHazard==='catenary')return `Rafales ${gust} km/h · ${Number.isFinite(t)?t.toFixed(0)+' °C':'givre'}`;
    if(type.weatherHazard==='flooding')return `Pluie ${p.toFixed(1)} mm/h · cumul 6 h ${r6.toFixed(0)} mm · 24 h ${r24.toFixed(0)} mm`;
    if(type.weatherHazard==='switchFreeze')return `${Number.isFinite(t)?t.toFixed(0)+' °C':'Gel'} · neige ${snow.toFixed(1)} cm/h`;
    if(type.weatherHazard==='heatTrack')return `Température ${Number.isFinite(t)?t.toFixed(0):'?'} °C`;
    if(type.weatherHazard==='stormSignal')return `Orage · rafales ${gust} km/h`;
    if(type.weatherHazard==='landslide')return `Pluie ${p.toFixed(1)} mm/h · cumul 6 h ${r6.toFixed(0)} mm`;
    if(type.weatherHazard==='snowBlockage')return `Neige ${snow.toFixed(1)} cm/h · ${depth.toFixed(0)} cm au sol`;
    if(type.weatherHazard==='rollingStock')return `${Number.isFinite(t)?t.toFixed(0)+' °C':'Météo extrême'} · neige ${snow.toFixed(1)} cm/h`;
    return 'Conditions météo dégradées';
  }

  _spawnWeatherAt(type: IncidentType, candidate: IncidentWeatherCandidate, state: IncidentWeatherState, risk: IncidentWeatherRisk, timeOfDay: unknown, world: IncidentWorld) {
    if(!type||!candidate)return null;
    const loc=candidate.loc||{},track=candidate.track;
    if(type.requireElectrified && track?.electrified===false)return null;
    if(type.scope==='train') {
      const svc=candidate.svc;if(!svc?.train)return null;
      if(this._hasActiveDuplicate(type.id,loc.key))return null;
      const duration=this._randomDuration(type.durationMin,type.durationMax);
      const inc=new Incident({typeId:type.id,name:type.name,trainId:svc.train.id,trainName:String(svc.name||svc.number||svc.train.name||svc.train.id||'Train'),serviceId:svc.id,
        stationA:loc.stationA,stationB:loc.stationB,stationAName:loc.stationAName,stationBName:loc.stationBName,locationText:loc.text,locationKey:loc.key,
        effect:type.effect,speedLimit:type.speedLimit||0,duration,startTime:timeOfDay,source:'weather',triggerText:this._weatherTriggerText(type,state),weatherLevel:risk?.level?.label||'',weatherHazard:type.weatherHazard});
      this.activeIncidents.push(inc);svc.train.incident={effect:type.effect,speedLimit:type.speedLimit||0,name:type.name,incidentId:inc.id,locationText:inc.locationText};return inc;
    }
    if(type.scope==='station') {
      const sid=loc.stationA||track?.stationA;const st=world?.getStationById?.(sid);if(!st)return null;
      const key=`station:${String(st.id)}`;if(this._hasActiveDuplicate(type.id,key))return null;
      const duration=this._randomDuration(type.durationMin,type.durationMax);const inc=new Incident({typeId:type.id,name:type.name,trackName:st.name,stationA:st.id,stationB:st.id,stationAName:st.name,stationBName:st.name,locationText:`à ${st.name}`,locationKey:key,effect:type.effect,speedLimit:type.speedLimit||0,duration,startTime:timeOfDay,source:'weather',triggerText:this._weatherTriggerText(type,state),weatherLevel:risk?.level?.label||'',weatherHazard:type.weatherHazard});
      this.activeIncidents.push(inc);return inc;
    }
    if(!track)return null;
    const key=this._locationKeyFromParts(track.stationA,track.stationB,track.name||'');if(this._hasActiveDuplicate(type.id,key))return null;
    const duration=this._randomDuration(type.durationMin,type.durationMax),a=world?.getStationById?.(track.stationA),b=world?.getStationById?.(track.stationB);
    const inc=new Incident({typeId:type.id,name:type.name,trackName:track.name||`${a?.name||''} — ${b?.name||''}`,stationA:track.stationA,stationB:track.stationB,stationAName:a?.name||'',stationBName:b?.name||'',locationText:a?.name&&b?.name?`entre ${a.name} et ${b.name}`:loc.text,locationKey:key,route:track.route||null,effect:type.effect,speedLimit:type.speedLimit||0,duration,startTime:timeOfDay,source:'weather',triggerText:this._weatherTriggerText(type,state),weatherLevel:risk?.level?.label||'',weatherHazard:type.weatherHazard});
    this.activeIncidents.push(inc);this._markAffectedTracks(inc,world);return inc;
  }

  _tryWeatherIncidents(timeOfDay: unknown,services: IncidentService[],world: IncidentWorld,dateStr: unknown,weather: Weather | null) {
    if(!weather||!world)return 0;
    const abs=this._absoluteGameMinute(dateStr,timeOfDay);if(typeof abs!=='number'||!Number.isFinite(abs))return 0;
    if(!Number.isFinite(this._weatherIncidentLastAbsMinute)){this._weatherIncidentLastAbsMinute=abs;return 0;}
    let elapsed=abs-this._weatherIncidentLastAbsMinute!;if(!dateStr&&elapsed<0)elapsed+=1440;
    if(!Number.isFinite(elapsed)||elapsed<0){this._weatherIncidentLastAbsMinute=abs;return 0;}if(elapsed===0)return 0;
    this._weatherIncidentLastAbsMinute=abs;elapsed=Math.min(elapsed,10);
    const candidates=this._weatherCandidates(services,world);if(!candidates.length)return 0;
    const evaluated: IncidentWeatherCandidate[] = candidates.map((c) => { const state=(weather.getAt?.(c.point.lat,c.point.lon)||{}) as IncidentWeatherState; const risk=(weather.getRailRiskAt?.(c.point.lat,c.point.lon,160)||state.risk||{}) as unknown as IncidentWeatherRisk; return {...c,state,risk}; });
    const types=this.predefinedTypes.filter((t) =>t.weatherTriggered&&this.enabledTypes.has(t.id));let spawned=0;
    for(const type of types) {
      const eligible: IncidentWeatherCandidate[] = evaluated.map((c) =>({...c,hazard:Number(c.risk?.hazards?.[type.weatherHazard || ''])||0})).filter((c) =>Number(c.hazard)>=Number(type.weatherMinHazard||0));
      if(type.requireElectrified)eligible.splice(0,eligible.length,...eligible.filter((c) =>c.track?.electrified!==false));
      if(type.scope==='train')eligible.splice(0,eligible.length,...eligible.filter((c) =>!!c.svc?.train));
      if(!eligible.length){
        // Une exposition interrompue s'efface progressivement : un orage d'hier
        // ne doit pas précharger l'incident météo de demain.
        this._weatherIncidentCredit[type.id]=Math.max(0,(Number(this._weatherIncidentCredit[type.id])||0)-elapsed/30);
        continue;
      }
      eligible.sort((a,b)=>Number(b.hazard)-Number(a.hazard));const best=eligible[0];
      const exposureFactor=Math.min(2,0.55+Math.sqrt(eligible.length)/4);const rate=Math.max(0,Number(type.weatherRatePerHour)||0)*Number(best.hazard || 0)*exposureFactor;
      this._weatherIncidentCredit[type.id]=(Number(this._weatherIncidentCredit[type.id])||0)+elapsed*rate/60;
      if(this._weatherIncidentCredit[type.id]<1)continue;
      const inc=this._spawnWeatherAt(type,best,best.state || {},best.risk || {},timeOfDay,world);if(inc){this._weatherIncidentCredit[type.id]-=1;spawned++;if(spawned>=2)break;}
      else this._weatherIncidentCredit[type.id]=Math.min(this._weatherIncidentCredit[type.id],1.5);
    }
    return spawned;
  }

  _incidentLocationText(inc: Incident, world: IncidentWorld) {
    if (inc?.locationText) return inc.locationText;
    if (inc?.stationA && inc?.stationA === inc?.stationB) {
      const st = world?.getStationById?.(inc.stationA);
      const name = inc.stationAName || st?.name || inc.trackName || '';
      return name ? `à ${name}` : '';
    }
    if (inc?.stationA && inc?.stationB) {
      const a = inc.stationAName || world?.getStationById?.(inc.stationA)?.name || '';
      const b = inc.stationBName || world?.getStationById?.(inc.stationB)?.name || '';
      if (a && b && a !== b) return `entre ${a} et ${b}`;
    }
    return inc?.trackName ? `à ${inc.trackName}` : '';
  }

  _describeServiceLocation(svc: IncidentService, world: IncidentWorld) {
    return this._serviceLocationDescriptor(svc, world).text;
  }

  formatIncidentReason(inc: Incident, world: IncidentWorld) {
    if (!inc) return 'Incident';
    const loc = this._incidentLocationText(inc, world);
    return `${inc.name || 'Incident'}${loc ? ' ' + loc : ''}`.trim();
  }

  _syncIncidentDelayReasons(svc: IncidentService, matchedIncidents: Incident[], world: IncidentWorld) {
    const train = svc?.train;
    if (!train) return;
    const nowDelay = Number.isFinite(Number(train.delay)) ? Number(train.delay) : Number(svc.delay || 0);
    const matched = (matchedIncidents || []).filter(Boolean);
    const matchedIds = new Set(matched.map((i: Incident) => String(i.id)));
    let history = Array.isArray(train.incidentDelayReasons) ? train.incidentDelayReasons : [];

    // Close causes the train has left. Keep only those that actually increased
    // its delay; an incident that happened behind the train therefore never
    // appears in its history.
    for (const entry of history) {
      if (entry.active && !matchedIds.has(String(entry.incidentId))) {
        entry.active = false;
        if (nowDelay - Number(entry.startDelay || 0) >= 0.25) entry.contributed = true;
        entry.endDelay = nowDelay;
        if (!entry.contributed) entry._drop = true;
      }
    }

    for (const inc of matched) {
      let entry = history.find((x: IncidentDelayReason) => String(x.incidentId) === String(inc.id));
      if (!entry) {
        entry = {
          incidentId: inc.id, typeId: inc.typeId || '',
          text: this.formatIncidentReason(inc, world),
          startDelay: nowDelay, lastDelay: nowDelay,
          active: true, contributed: false,
        };
        history.push(entry);
      } else {
        entry.active = true;
        entry.text = entry.text || this.formatIncidentReason(inc, world);
      }
      if (nowDelay - Number(entry.startDelay || 0) >= 0.25) entry.contributed = true;
      entry.lastDelay = nowDelay;
    }

    history = history.filter((x: IncidentDelayReason) => !x._drop);
    // Once all delay has effectively been recovered, old causes must not come
    // back if the train is delayed again later for something unrelated.
    if (nowDelay < 0.5 && matched.length === 0) history = [];
    // Defensive cap against a pathological day-long accumulation while keeping
    // all recent operational causes visible in the left Livemap panel.
    if (history.length > 12) history = history.slice(history.length - 12);
    train.incidentDelayReasons = history;
  }

  _spawnTrackIncident(type: IncidentType, world: IncidentWorld, timeOfDay: unknown = 0) {
    if (!world || (world.tracks?.length || 0) === 0) return null;
    const baseCandidates = type.requireElectrified
      ? (world.tracks || []).filter((t: IncidentTrack) => t.electrified !== false)
      : [...(world.tracks || [])];
    const candidates = baseCandidates.filter((t: IncidentTrack) =>
      !this._hasActiveDuplicate(type.id, this._locationKeyFromParts(t.stationA, t.stationB, t.name || ''))
    );
    if (candidates.length === 0) return null;
    const rng = getGlobalRng();
    const track = candidates[Math.floor(rng.random() * candidates.length)];
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const stA = world.getStationById?.(track.stationA);
    const stB = world.getStationById?.(track.stationB);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: track.name || `${stA?.name || ''} — ${stB?.name || ''}`,
      stationA: track.stationA,
      stationB: track.stationB,
      stationAName: stA?.name || '',
      stationBName: stB?.name || '',
      locationText: stA?.name && stB?.name ? `entre ${stA.name} et ${stB.name}` : '',
      locationKey: this._locationKeyFromParts(track.stationA, track.stationB, track.name || ''),
      route: track.route || null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
      startTime: timeOfDay,
    });
    this.activeIncidents.push(inc);
    this._markAffectedTracks(inc, world);
    return inc;
  }

  _spawnPureStationIncident(type: IncidentType, world: IncidentWorld, stationOverride: IncidentStation | null = null, timeOfDay: unknown = 0) {
    if (!world || (world.stations?.length || 0) === 0) return null;
    const rng = getGlobalRng();
    const available = stationOverride
      ? [stationOverride].filter((st) => !this._hasActiveDuplicate(type.id, `station:${String(st?.id ?? '')}`))
      : (world.stations || []).filter((st: IncidentStation) => !this._hasActiveDuplicate(type.id, `station:${String(st?.id ?? '')}`));
    if (available.length === 0) return null;
    const station = stationOverride ? available[0] : available[Math.floor(rng.random() * available.length)];
    if (!station) return null;
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: station.name,
      stationA: station.id,
      stationB: station.id,
      stationAName: station.name,
      stationBName: station.name,
      locationText: `à ${station.name}`,
      locationKey: `station:${String(station.id)}`,
      route: null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
      startTime: timeOfDay,
    });
    this.activeIncidents.push(inc);
    return inc;
  }

  // Incidents autorisés aussi bien dans une gare que sur un tronçon intergare.
  // La cible est tirée uniformément parmi toutes les localisations gameplay
  // disponibles (gares + tronçons), plutôt que d'inventer un ratio fixe.
  _spawnStationOrTrackIncident(type: IncidentType, world: IncidentWorld, timeOfDay: unknown = 0) {
    if (!world) return null;
    const stations = (Array.isArray(world.stations) ? world.stations : []).filter((st: IncidentStation) =>
      !this._hasActiveDuplicate(type.id, `station:${String(st?.id ?? '')}`)
    );
    const tracks = (Array.isArray(world.tracks) ? world.tracks : []).filter((t: IncidentTrack) =>
      !this._hasActiveDuplicate(type.id, this._locationKeyFromParts(t.stationA, t.stationB, t.name || ''))
    );
    const total = stations.length + tracks.length;
    if (total === 0) return null;
    const rng = getGlobalRng();
    const pick = Math.floor(rng.random() * total);
    if (pick < stations.length) {
      return this._spawnPureStationIncident(type, world, stations[pick], timeOfDay);
    }
    const track = tracks[pick - stations.length];
    if (!track) return null;
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const stA = world.getStationById?.(track.stationA);
    const stB = world.getStationById?.(track.stationB);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: track.name || `${stA?.name || ''} — ${stB?.name || ''}`,
      stationA: track.stationA,
      stationB: track.stationB,
      stationAName: stA?.name || '',
      stationBName: stB?.name || '',
      locationText: stA?.name && stB?.name ? `entre ${stA.name} et ${stB.name}` : '',
      locationKey: this._locationKeyFromParts(track.stationA, track.stationB, track.name || ''),
      route: track.route || null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
      startTime: timeOfDay,
    });
    this.activeIncidents.push(inc);
    this._markAffectedTracks(inc, world);
    return inc;
  }

  _spawnStationIncident(type: IncidentType, world: IncidentWorld, timeOfDay: unknown = 0) {
    if (!world || (world.stations?.length || 0) === 0) return null;
    const rng = getGlobalRng();
    const available = (world.stations || []).filter((st: IncidentStation) =>
      !this._hasActiveDuplicate(type.id, `station:${String(st?.id ?? '')}`)
    );
    if (available.length === 0) return null;
    const station = available[Math.floor(rng.random() * available.length)];
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    // Station incidents block the immediate track(s) connected to the station
    // to keep a 5–10 km impact zone as requested.
    const track = (world.tracks || []).find((t: IncidentTrack) => t.stationA === station.id || t.stationB === station.id) || null;
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trackName: track ? (track.name || `${station.name}`) : station.name,
      stationA: track ? track.stationA : station.id,
      stationB: track ? track.stationB : station.id,
      stationAName: station.name,
      stationBName: station.name,
      locationText: `à ${station.name}`,
      locationKey: `station:${String(station.id)}`,
      route: track ? track.route : null,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
      startTime: timeOfDay,
    });
    this.activeIncidents.push(inc);
    if (track) this._markAffectedTracks(inc, world);
    return inc;
  }

  _spawnTrainIncident(type: IncidentType, services: IncidentService[], timeOfDay: unknown, world: IncidentWorld) {
    if (!services || services.length === 0) return null;
    let candidates = services.filter((s: IncidentService) => s.train && s.position);
    if (type.requirePassenger) {
      candidates = candidates.filter((s: IncidentService) => {
        if (type.requirePassengerService && !isCommercialPassengerIncidentService(s)) return false;
        const rame = s.rame || (s.train ? s.train.rame : null);
        return Number(rame?.totalCapacity || 0) > 0 || Number(s.train?.totalCapacity || 0) > 0;
      });
    }
    if (type.requireStopped) {
      candidates = candidates.filter((s: IncidentService) => bookedIncidentStop(s) !== null);
    }
    const eligible = candidates.map((svc) => {
      const stop = type.requireStopped ? bookedIncidentStop(svc) : null;
      const station = stop ? world?.getStationById?.(stop.stationId) : null;
      const id = stop ? String(stop.stationId) : '';
      const name = station?.name || id;
      const loc = stop ? {key:`station:${id}`,text:`à ${name}`,stationA:id,stationB:id,stationAName:name,stationBName:name} : this._serviceLocationDescriptor(svc, world);
      return {svc,loc};
    })
      .filter((x) => x.loc.key && !this._hasActiveDuplicate(type.id, x.loc.key));
    if (eligible.length === 0) return null;
    const rng = getGlobalRng();
    const chosen = eligible[Math.floor(rng.random() * eligible.length)];
    const svc = chosen.svc;
    const loc = chosen.loc;
    if (!svc.train) return null;
    const duration = this._randomDuration(type.durationMin, type.durationMax);
    const inc = new Incident({
      typeId: type.id,
      name: type.name,
      trainId: svc.train.id,
      trainName: String(svc.name || svc.number || svc.train?.name || svc.train?.id || svc.id || 'Train'),
      serviceId: svc.id,
      stationA: loc.stationA,
      stationB: loc.stationB,
      stationAName: loc.stationAName,
      stationBName: loc.stationBName,
      locationText: loc.text,
      locationKey: loc.key,
      effect: type.effect,
      speedLimit: type.speedLimit || 0,
      duration,
      startTime: timeOfDay,
    });
    this.activeIncidents.push(inc);
    // Apply immediately to the affected train
    svc.train.incident = { effect: type.effect, speedLimit: type.speedLimit || 0, name: type.name, incidentId: inc.id, locationText: inc.locationText };
    return inc;
  }

  update(timeOfDay: unknown, services: IncidentService[], depotManager: IncidentDepotManager, world: IncidentWorld, dateStr: unknown, season: unknown, weather: Weather | null = null, elapsedMinutes = 1) {
    const checkKey = dateStr ? `${dateStr}:${timeOfDay}` : timeOfDay;
    if (checkKey !== this.lastCheck) {
      this.lastCheck = checkKey;
      for (const inc of this.activeIncidents) {
        inc.remaining -= Math.max(0, Number.isFinite(elapsedMinutes) ? elapsedMinutes : 1);
        if (inc.remaining <= 0) {
          inc.active = false;
          this._clearTrackFlags(inc, world);
          if (inc.serviceId) {
            const svc = services?.find((s: IncidentService) => s.id === inc.serviceId);
            if (svc && svc.train) svc.train.incident = null;
          }
        }
      }
      this.activeIncidents = this.activeIncidents.filter((i: Incident) => i.active);
      this._incBboxVer = null;
    }

    this._trySpawn(timeOfDay, services, world, season, dateStr);
    this._tryWeatherIncidents(timeOfDay, services, world, dateStr, weather);
    this.checkTrainPositions(services, depotManager, world);
  }

  checkTrainPositions(services: IncidentService[], depotManager: IncidentDepotManager, world: IncidentWorld) {
    if (!services || this.activeIncidents.length === 0) {
      for (const svc of (services || [])) {
        if (svc?.train) {
          svc.train.incident = null;
          this._syncIncidentDelayReasons(svc, [], world);
        }
      }
      return;
    }

    if (!this._incBboxVer || this._incBboxVer !== this.activeIncidents.length) {
      this._incBboxVer = this.activeIncidents.length;
      for (const inc of this.activeIncidents) {
        if (inc._bbox) continue;
        if (inc.serviceId) {
          // train-specific incidents handled directly in update
          inc._bbox = [-Infinity, Infinity, -Infinity, Infinity];
        } else if (inc.route && inc.route.length >= 2) {
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          for (const p of inc.route) {
            if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
            if (p.lon < minLon) minLon = p.lon; if (p.lon > maxLon) maxLon = p.lon;
          }
          inc._bbox = [minLat - 0.01, maxLat + 0.01, minLon - 0.01, maxLon + 0.01];
        } else if (world) {
          const stA = world.getStationById?.(inc.stationA);
          const stB = world.getStationById?.(inc.stationB);
          if (stA && stB) {
            const aLat=Number(stA.lat), bLat=Number(stB.lat), aLon=Number(stA.lon), bLon=Number(stB.lon);
            if ([aLat,bLat,aLon,bLon].every(Number.isFinite)) inc._bbox = [Math.min(aLat, bLat) - 0.02, Math.max(aLat, bLat) + 0.02, Math.min(aLon, bLon) - 0.02, Math.max(aLon, bLon) + 0.02];
          }
        }
      }
    }

    for (const svc of services) {
      if (!svc.train || !svc.position) continue;
      svc.train.incident = null;

      const lat = Number(svc.position.lat), lon = Number(svc.position.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      let worstIncident = null;
      const matchedIncidents = [];
      for (const inc of this.activeIncidents) {
        if (!inc.active) continue;
        if (inc.serviceId) {
          if (inc.serviceId === svc.id) { worstIncident = inc; matchedIncidents.push(inc); }
          continue;
        }
        if (inc._bbox && (lat < inc._bbox[0] || lat > inc._bbox[1] || lon < inc._bbox[2] || lon > inc._bbox[3])) continue;
        let affected = false;
        if (inc.route) {
          affected = this._isOnRoute(lat, lon, inc.route);
        } else if (world) {
          affected = this._isBetweenStations(lat, lon, world, inc);
        }
        if (!affected) continue;

        // Track/station-track incidents must match the train's current leg.
        if (inc.stationA != null && inc.stationB != null && inc.stationA !== inc.stationB) {
          if (!this._incidentMatchesServiceLeg(svc, inc)) continue;
        }
        matchedIncidents.push(inc);

        if (!worstIncident || (inc.effect === 'stop' && worstIncident.effect !== 'stop')) {
          worstIncident = inc;
        } else if (worstIncident.effect === 'slow' && inc.effect === 'slow') {
          if (inc.speedLimit < worstIncident.speedLimit) worstIncident = inc;
        }
      }
      this._syncIncidentDelayReasons(svc, matchedIncidents, world);
      if (worstIncident) {
        svc.train.incident = {
          effect: worstIncident.effect,
          speedLimit: worstIncident.speedLimit || 0,
          name: worstIncident.name,
          incidentId: worstIncident.id,
          locationText: this._incidentLocationText(worstIncident, world),
        };
        // DDS-02 : secours uniquement pour les incidents spécifiques au train (panne, etc.)
        if (worstIncident.effect === 'stop' && worstIncident.serviceId && ['train-breakdown', 'weather-rolling-stock-failure'].includes(String(worstIncident.typeId)) && depotManager && world) {
          const alreadyRescued = depotManager.activeRescues?.some((r) => r.targetServiceId === svc.id && r.state !== 'done');
          if (!alreadyRescued) {
            depotManager.dispatchRescue?.(world, svc);
          }
        }
      }

      // INC-03 : si aucun incident direct, ralentissement progressif en approche
      if (!worstIncident && svc.state === 'moving') {
        const approaching = this.getApproachingIncident(svc, world);
        if (approaching) {
          svc.train.incident = approaching;
        }
      }
    }
  }

  getActiveIncidents() {
    return this.activeIncidents;
  }

  // TRV-07 — incidents actifs affectant une ligne (par stationA/B ou trackName)
  getActiveIncidentsOnLine(lineStops: string[] = []) {
    const stopSet = new Set(lineStops);
    return this.activeIncidents.filter((i: { active: unknown; stationA: string | null | undefined; stationB: string | null | undefined; trackName: string | null | undefined }) =>
      i.active && ((i.stationA != null && stopSet.has(i.stationA)) || (i.stationB != null && stopSet.has(i.stationB)) || lineStops.some((sid: string) => i.trackName?.includes(sid)))
    );
  }

  // INC-05 — bulletins spéciaux à côté du récap de compagnie
  getBulletins() {
    return this.activeIncidents.filter((i: __S3Struct152) => i.active).map((i: __S3Struct153) => ({
      id: i.id,
      name: i.name,
      location: i.trackName || (i.stationAName && i.stationBName ? `${i.stationAName} — ${i.stationBName}` : 'Zone inconnue'),
      remaining: Math.max(0, Math.ceil(i.remaining)),
      effect: i.effect,
      speedLimit: Number.isFinite(Number(i.speedLimit)) ? Number(i.speedLimit) : 30,
    }));
  }

  getCustomTypes() { return []; }
  loadCustomTypes() {}

  getAllTypes() {
    return this.predefinedTypes.map((t) => ({
      ...t,
      origin: t.weatherTriggered ? 'weather' : 'general',
      enabled: this.enabledTypes.has(t.id),
    }));
  }

  /** RC18: versioned cadence is part of the simulation, not a disposable cache. */
  getCadenceSave() {
    return { schemaVersion: 1, lastCheck: this.lastCheck,
      spawnCredit: this._incidentSpawnCredit, spawnLastAbsMinute: this._incidentSpawnLastAbsMinute,
      weatherLastAbsMinute: this._weatherIncidentLastAbsMinute,
      weatherCredit: { ...this._weatherIncidentCredit }, weatherSampleCursor: this._weatherSampleCursor,
      targetIncidentsPerHour: this.targetIncidentsPerHour, nextId: nextIncId };
  }

  loadCadenceSave(value: unknown): void {
    // Legacy files establish a new reference without a fabricated catch-up burst.
    this.lastCheck = -1;
    this._incidentSpawnCredit = 0; this._incidentSpawnLastAbsMinute = null;
    this._weatherIncidentLastAbsMinute = null; this._weatherIncidentCredit = Object.create(null);
    this._weatherSampleCursor = 0;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const data = value as Record<string, unknown>;
    if (data.schemaVersion !== 1) throw new Error('Cadence incidents : schéma incompatible');
    const minute = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
    this.lastCheck = typeof data.lastCheck === 'string' ? data.lastCheck : incFinite(data.lastCheck, -1);
    this._incidentSpawnCredit = incFinite(data.spawnCredit, 0, 0);
    this._incidentSpawnLastAbsMinute = minute(data.spawnLastAbsMinute);
    this._weatherIncidentLastAbsMinute = minute(data.weatherLastAbsMinute);
    this._weatherSampleCursor = Math.floor(incFinite(data.weatherSampleCursor, 0, 0));
    this.targetIncidentsPerHour = incFinite(data.targetIncidentsPerHour, 50, 0, 100000);
    if (data.weatherCredit && typeof data.weatherCredit === 'object' && !Array.isArray(data.weatherCredit)) {
      const credit = data.weatherCredit as Record<string, unknown>;
      for (const type of this.predefinedTypes) if (Object.prototype.hasOwnProperty.call(credit,type.id)) this._weatherIncidentCredit[type.id] = incFinite(credit[type.id], 0, 0);
    }
    const activeNext = this.activeIncidents.reduce((n, incident) => {
      const match = /^inc-(\d+)$/.exec(incident.id);
      return match ? Math.max(n, Number(match[1]) + 1) : n;
    }, 1);
    nextIncId = Math.max(activeNext, Math.floor(incFinite(data.nextId, activeNext, 1)));
  }

  getActiveIncidentsSave() {
    return this.activeIncidents.map((inc: Incident) => ({
      id: inc.id,
      typeId: inc.typeId,
      name: inc.name,
      trackName: inc.trackName,
      stationA: inc.stationA,
      stationB: inc.stationB,
      stationAName: inc.stationAName,
      stationBName: inc.stationBName,
      locationText: inc.locationText,
      locationKey: this._locationKeyForIncident(inc),
      trainId: inc.trainId,
      trainName: inc.trainName,
      serviceId: inc.serviceId,
      effect: inc.effect,
      speedLimit: inc.speedLimit,
      route: inc.route,
      duration: inc.duration,
      remaining: inc.remaining,
      active: inc.active,
      startTime: inc.startTime,
      source: inc.source, triggerText: inc.triggerText, weatherLevel: inc.weatherLevel, weatherHazard: inc.weatherHazard,
    }));
  }

  loadFromSave(arr: unknown, world: IncidentWorld) {
    this.activeIncidents = [];
    if (!Array.isArray(arr)) return;
    const typeById = new Map(PREDEFINED_INCIDENT_TYPES.map((t) => [t.id, t]));
    const stationExists = (id: unknown) => !id || !world?.getStationById || !!world.getStationById?.(id);
    const seenIds = new Set();
    for (const d of arr) {
      if (!d || typeof d !== 'object' || d.active === false) continue;
      const type = typeById.get(incText(d.typeId));
      if (!type) continue;
      const inc = new Incident({ ...d, typeId: type.id, name: type.name, effect: type.effect, speedLimit: type.speedLimit ?? 0 });
      if (!inc.id || !inc.active || seenIds.has(inc.id)) continue;
      if (!stationExists(inc.stationA) || !stationExists(inc.stationB)) continue;
      if (type.pureStation && (!inc.stationA || inc.stationA !== inc.stationB)) continue;
      inc.locationKey = this._locationKeyForIncident(inc);
      if (!inc.locationKey || this._hasActiveDuplicate(inc.typeId, inc.locationKey, inc.id)) continue;
      seenIds.add(inc.id);
      this.activeIncidents.push(inc);
      const m = /^inc-(\d+)$/.exec(inc.id);
      const num = m ? Number(m[1]) : 0;
      if (num >= nextIncId) nextIncId = num + 1;
      if (world && inc.stationA && inc.stationB && inc.stationA !== inc.stationB) this._markAffectedTracks(inc, world);
    }
    this._incBboxVer = null;
  }
}


// S3_STRUCT_V2_TEMP
type __S3Struct100 = { "speedLimit": unknown };
type __S3Struct101 = { "speedLimit": unknown };
type __S3Struct126 = { state: unknown; risk: { hazards: Record<string, unknown> } };
type __S3Struct127 = { "hazard": number };
type __S3Struct130 = { hazard: number; state: unknown; risk: { hazards?: Record<string, unknown> } };
type __S3Struct131 = { hazard: number; state: unknown; risk: { hazards?: Record<string, unknown> } };
type __S3Struct147 = { "state": string; "train": { "stoppedAt": unknown } };
type __S3Struct148 = { "loc": { "key": unknown } };
type __S3Struct152 = { "active": boolean };
type __S3Struct153 = { "id": string; "name": string; "trackName": string; "stationAName": string; "stationBName": string; "remaining": number; "effect": unknown; "speedLimit": unknown };
