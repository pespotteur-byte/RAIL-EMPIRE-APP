import { randomizeRameDeparture } from './rame-random.js';
import {assessTurnback,normalizeTurnbackState} from './formation-turnback.js';
import { materialTrackLocation, materialTrackMismatch } from './material-track-location.js';
type __KPM435 = { "stationId"?: unknown; "technicalLocationId"?: unknown; "lat"?: unknown; "lon"?: unknown };
type __KPM468 = { "schemaVersion": unknown; "capturedAtUnixSec": unknown; "services": unknown; "busyVehicles": unknown };
type __KPA137 = { "vehicleId": unknown };
type __KPA138 = { "v": unknown; "m": Record<string, unknown> };
type __KPA139 = { "v": unknown };
type __KPA140 = { "v": unknown };
type __KPA141 = { "sequence": number };
type __KPA142 = { "sequence": number };
type __KPA143 = { "vehicle": unknown };
type __KPA144 = { "vehicle": unknown };
type __KPA145 = { "vehicle": Record<string, unknown> };
type __KPA146 = number;
type __KPA147 = number;
type __KPA148 = { "vehicleId": unknown };
type __KPA149 = { "member": unknown; "vehicle": unknown };
type __KPA150 = { "role": unknown };
type __KPA154 = { "vehicleId": unknown };
type __KPA155 = { "locationOccurrenceId": unknown };
type __KPA156 = { "locationOccurrenceId": unknown };
type __KPA158 = { "occurrenceId": unknown };
type AnyRecord = Record<string, unknown>;
import { normalizeStationTrackIdentity, stationTrackIdentityFromBinding } from './station-track-identity.js';
import type { ActiveService, ActiveServiceLike } from './schedule-creator.js';
import type { RailEmpire } from './main.js';

declare global { interface Window { game?: RailEmpire; } }

import { normalizePassageTailSpeedHolds } from './tail-speed-index.js';
import { Rame } from './rame.js';
import { ScheduleState, ScheduleVersion, PerformanceProfile, TrainCategory, StopCode, ScheduledLocation } from './schedule-v2-model.js';
import { FormationRole, ActiveFormationSpec, FormationMember, PhysicalVehicle, ScheduleOccurrence, RotationAction, Rotation } from './rotation-v2-model.js';
import { recalculateScheduleTiming } from './schedule-v2-timing.js';

type RuntimeSegment = {
    wayId?: unknown; electrified?: unknown; voltage?: unknown[]; frequency?: unknown[];
    gauge?: unknown[]; loadingGauge?: unknown; axleLoad?: unknown; metreLoad?: unknown;
    from?: { lat?: unknown; lon?: unknown }; to?: { lat?: unknown; lon?: unknown }; distanceKm?: unknown;
};
type RuntimeLocationAnchor = { stationId?: unknown; technicalLocationId?: unknown; track?: { snapLat?: unknown; lat?: unknown; snapLon?: unknown; lon?: unknown; voiePointId?: unknown; wayId?: unknown; displayName?: unknown; trackRef?: unknown }; trackIdentity?: unknown; voiePointId?: unknown; platform?: unknown };
type RuntimePlanLocation = { location: ScheduledLocation; arrivalSec: number | null; departureSec: number | null };
type RuntimePlan = {
    rotation: RuntimeRotation; occ: ScheduleOccurrence; ver: ScheduleVersion; sourceVersion: ScheduleVersion;
    baseDate: string; startSec: number; prepStartSec: number; endSec: number; shiftSec: number;
    locations: RuntimePlanLocation[]; preDepartureOperationSec: number; terminalOperationSec: number;
    error?: never; errorCode?: never; _relNow?: number;
};
type RuntimePlanFailure = { rotation: RuntimeRotation; occ: ScheduleOccurrence; ver: null; baseDate: string; error: string; errorCode?: string; _relNow?: number };
type RuntimePlanResult = RuntimePlan | RuntimePlanFailure;
type RuntimeRotation = Rotation & { _directAssignmentId?: unknown; _directRameId?: unknown };
type RuntimeVehiclePair = { member: RuntimeFormationMember; vehicle: PhysicalVehicle };
type RuntimeUsableFormation = { members: RuntimeVehiclePair[]; active: RuntimeVehiclePair[]; missingLead: boolean; notReady: boolean };
type RuntimeFormationMember = { vehicleId: string; role: FormationMember['role']; order?: number; sourceCouponId?: string };
type RuntimeFormationSnapshot = { formationMembers?: RuntimeFormationMember[]; vehicleIds?: string[] };
type RuntimeStop = { stationId?: unknown; technicalLocationId?: unknown; locationName?: unknown; locationOccurrenceId?: unknown; lat?: unknown; lon?: unknown };
type RuntimeOperationEntry = {
    actionId: string; dependsOn: string[]; started: boolean; applied: boolean; failed: boolean; failure?: string;
    durationSec?: number; actualStartRelSec?: number; actualEndRelSec?: number; reservedIds: string[];
    plannedStartOffsetSec?: number; plannedEndOffsetSec?: number;
};
type RuntimeTimelineEntry = { action: RotationAction; startOffsetSec?: unknown; endOffsetSec?: unknown; dependsOn?: string[] };
const DAY = 86400;
const RUNTIME_SAVE_MIN_SCHEMA = 1;
const RUNTIME_SAVE_SCHEMA = 4;

type RuntimeAlert = Record<string, unknown> & { id: string; time: string; level: unknown; code: string; message: unknown; rotationId?: unknown; occurrenceId?: unknown };
type RuntimeSnapshot = Record<string, unknown> & { randomDepartureKey?: string; passageTailSpeedHolds?: unknown; macroElapsed?: {medium: number; low: number};
    isReturnLeg?: boolean; position?: { lat: number; lon: number } | null; speed?: number; completed?: boolean; cancelled?: boolean;
    currentStopIndex?: number; state: string; stateIndex?: number; stateProgress?: number; nextDepartureTime?: number | null; onboardPax?: number; onboardFreight?: number;
    delay: number; blockedSinceGameTime?: number | null; stoppedSinceGameTime?: number | null; totalDistance?: number; brakeEffort?: number; tractiveEffort?: number; physicsDecelMs2?: number;
    vehicleIds?: string[]; formationMembers?: RuntimeFormationMember[]; operationState?: Record<string, unknown> | null; platformAssignment?: Record<string, unknown> | null;
    departureResourceHold?: Record<string, unknown> | null; train?: Record<string, unknown>; atTerminus?: boolean; legKey?: unknown; stationaryRouteFallback?: unknown; stationaryRouteRef?: { i: unknown; s: string } | null;
};

export interface ScheduleV2Runtime {
    game: RailEmpire;
    alerts: RuntimeAlert[];
    _alertKeys: Set<string>;
    _alertTimes: Map<string, number>;
    _pendingSnapshots: Map<string, RuntimeSnapshot>;
    _lastSyncKey: string;
    _timedVersionCache: Map<string, { inputSignature: string; signature: string; timed: ScheduleVersion }>;
    _planCache: Map<string, RuntimePlanResult[]>;
    _planCacheEpoch: string;
    _snapshotCapturedAtUnixSec: number;
}
function addDays(dateStr: unknown, delta: number) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}
function daysBetween(a: unknown, b: unknown) {
    const aa = Date.parse(`${a}T12:00:00Z`), bb = Date.parse(`${b}T12:00:00Z`);
    if (!Number.isFinite(aa) || !Number.isFinite(bb))
        return 0;
    return Math.round((bb - aa) / 86400000);
}
function routeDistanceKm(a: { lat?: unknown; lon?: unknown } | null | undefined, b: { lat?: unknown; lon?: unknown } | null | undefined) {
    if (!a || !b || ![a.lat, a.lon, b.lat, b.lon].every((x: unknown) => Number.isFinite(Number(x))))
        return Infinity;
    const R = 6371, dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(Number(a.lat) * Math.PI / 180) * Math.cos(Number(b.lat) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function routePointClose(a: { lat?: unknown; lon?: unknown } | null | undefined, b: { lat?: unknown; lon?: unknown } | null | undefined, tolKm: number = 0.003) { return routeDistanceKm(a, b) <= tolKm; }
function seededBool(seed: unknown) {
    let h = 2166136261 >>> 0;
    for (const ch of String(seed)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h & 1) === 1;
}
// S3 compatibility marker for legacy source-text QA: [TrainCategory.INFRA]:'infra', [TrainCategory.TTX]:'ttx'
function serviceType(category: unknown) {
    const serviceMap: Record<string, string> = {
        [TrainCategory.PASSENGER]: 'passager', [TrainCategory.FREIGHT]: 'fret',
        [TrainCategory.W]: 'w', [TrainCategory.HLP]: 'hlp', [TrainCategory.TM]: 'tm',
        [TrainCategory.INFRA]: 'infra', [TrainCategory.TTX]: 'ttx',
    };
    return serviceMap[String(category)] || 'passager';
}
function isActiveRole(role: unknown) {
    return role === FormationRole.LEAD || role === FormationRole.ACTIVE_MULTIPLE || role === FormationRole.PUSHER;
}
function tractionLooksDiesel(v: Pick<PhysicalVehicle, 'traction'> | null | undefined) {
    const t = String(v?.traction || '').toLowerCase();
    return t.includes('diesel') || t.includes('therm') || t.includes('gazole');
}
function tractionLooksElectric(v: Pick<PhysicalVehicle, 'traction' | 'electricSystems'> | null | undefined) {
    const t = String(v?.traction || '').toLowerCase();
    return t.includes('elect') || t.includes('élect') || ((v?.electricSystems?.length ?? 0) > 0);
}
function normalizeLoadingGauge(value: unknown) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TSI/, '').replace(/^UIC/, ''); }
function loadingGaugeCompatible(required: unknown, available: unknown) {
    const req = normalizeLoadingGauge(required), have = normalizeLoadingGauge(available);
    if (!req || !have)
        return true;
    if (req === have)
        return true;
    const rank: Record<string, number> = { GA: 1, GB: 2, GC: 3 };
    return rank[req] != null && rank[have] != null ? rank[have] >= rank[req] : false;
}
function electricalMatch(systems: Array<{ voltage?: unknown; frequency?: unknown }>, seg: { electrified?: unknown; voltage?: unknown[]; frequency?: unknown[] } | null | undefined) {
    if (seg?.electrified == null || !Array.isArray(seg.voltage) || !seg.voltage.length || !systems.length)
        return null;
    const freqs = seg.frequency?.length ? seg.frequency : [0];
    for (const sys of systems)
        for (const voltage of seg.voltage)
            for (const frequency of freqs) {
                const vok = !sys.voltage || Math.abs(Number(sys.voltage) - Number(voltage)) <= Math.max(50, Number(voltage) * 0.03);
                const fok = !sys.frequency || !frequency || Math.abs(Number(sys.frequency) - Number(frequency)) <= 1;
                if (vok && fok)
                    return true;
            }
    return false;
}
function geoDistanceKm(a: { "lat": unknown; "lon": unknown }, b: { lat: unknown; lon: unknown }) {
    if (!a || !b || !Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lon)) || !Number.isFinite(Number(b.lat)) || !Number.isFinite(Number(b.lon)))
        return Infinity;
    const R = 6371, dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(Number(a.lat) * Math.PI / 180) * Math.cos(Number(b.lat) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function simulationEpochSec(baseDate: unknown, relativeSec: unknown = 0) {
    const base = Date.parse(`${baseDate}T00:00:00Z`);
    return Number.isFinite(base) ? Math.floor(base / 1000) + Number(relativeSec || 0) : Number(relativeSec || 0);
}
/**
 * Bridge between the V2 planning domain and the proven legacy ActiveService
 * runtime. HOTFIX32 enforces the player-spec invariant: a timetable never creates
 * a train by itself. Every physical circulation must be referenced by a real
 * rotation line carrying a valid physical formation.
 */
// S3 compatibility marker: referenceLoadedMassKg=Math.max(1000,Number(f.massKg||0))
export class ScheduleV2Runtime {
    constructor(game: RailEmpire) {
        this.game = game;
        this.alerts = [];
        this._alertKeys = new Set();
        this._alertTimes = new Map();
        this._pendingSnapshots = new Map();
        this._lastSyncKey = '';
        // v1.1.43 — cache expensive physical timetable recalculations. A VALID
        // schedule version is immutable; only the assigned physical formation can
        // change its runtime timing. Keeping one cached timed view per occurrence
        // avoids cloning the complete ORM geometry + re-running train physics every second.
        this._timedVersionCache = new Map();
        // v1.1.43 — planning is deterministic within one simulation minute.
        // Rebuilding every rotation/date plan on each second tick (and again for
        // diagnostics) created constant garbage and CPU load even while the
        // Livemap was idle. Share plans for the current minute; explicit forceSync
        // invalidates immediately after an editor/material change.
        this._planCache = new Map();
        this._planCacheEpoch = '';
        // v1.1.54 — snapshots are continuity hints, not permission to resurrect an
        // old train at an unrelated real-world time after a page reload.
        this._snapshotCapturedAtUnixSec = 0;
    }
    _pushAlert(level: string, code: string, message: string, data: Record<string, unknown> = {}) {
        const key = `${code}|${data.rotationId || ''}|${data.occurrenceId || ''}|${data.baseDate || ''}|${data.vehicleId || ''}`;
        const now = Date.now(), last = this._alertTimes.get(key) || 0;
        // Debounce spam, but allow the same fault to be reported again after it was
        // fixed and later reappears during the same session/day.
        if (now - last < 60000)
            return;
        this._alertTimes.set(key, now);
        this._alertKeys.add(key);
        this.alerts.unshift({ id: `rtalert-${now}-${this.alerts.length}`, time: new Date(now).toISOString(), level, code, message, ...data } as RuntimeAlert);
        if (this.alerts.length > 200)
            this.alerts.length = 200;
    }
    _runtimeRotations() {
        const rm = this.game.rotationV2;
        const out = [];
        for (const rotation of rm?.rotations || []) {
            if (rotation.assignedRameId) {
                const rame = this.game.rameManager?.getById?.(rotation.assignedRameId);
                if (!rame) {
                    this._pushAlert('ERROR', 'ROTATION_RAME_MISSING', `Ligne ${rotation.name || rotation.id} bloquée : la rame ${rotation.assignedRameId} n’existe plus.`, { rotationId: rotation.id, vehicleId: rotation.assignedRameId });
                    continue;
                }
                if (rame.inMaintenance) {
                    this._pushAlert('ERROR', 'ROTATION_RAME_MAINTENANCE', `Ligne ${rotation.name || rotation.id} bloquée : la rame ${rame.name || rotation.assignedRameId} est en maintenance.`, { rotationId: rotation.id, vehicleId: rotation.assignedRameId });
                    continue;
                }
                if (rame.currentLocation?.depotId) {
                    this._pushAlert('WARN', 'ROTATION_RAME_DEPOT', `Ligne ${rotation.name || rotation.id} en attente : la rame ${rame.name || rotation.assignedRameId} est garée au dépôt et doit être sortie manuellement.`, { rotationId: rotation.id, vehicleId: rotation.assignedRameId, depotId: rame.currentLocation.depotId });
                    continue;
                }
            }
            out.push(rotation);
        }
        // HOTFIX64 — simplified mode: a validated timetable can carry one Rame
        // directly, without forcing the player through the Roulements page. A real
        // rotation always wins when the same schedule is present in one.
        if (this.game.realismSettings?.rotationsRequired !== true) {
            for (const a of rm?.directAssignments || []) {
                if (a.enabled === false || rm.directAssignmentSuppressed?.(a))
                    continue;
                const rame = a.rameId ? this.game.rameManager?.getById?.(a.rameId) : null;
                if (a.rameId && !rame) {
                    this._pushAlert('ERROR', 'DIRECT_RAME_MISSING', `Affectation simple bloquée : la rame ${a.rameId} n’existe plus.`, { rotationId: `direct:${a.id}`, occurrenceId: a.id, vehicleId: a.rameId });
                    continue;
                }
                if (rame?.inMaintenance) {
                    this._pushAlert('ERROR', 'DIRECT_RAME_MAINTENANCE', `Affectation simple bloquée : la rame ${rame.name || a.rameId} est en maintenance.`, { rotationId: `direct:${a.id}`, occurrenceId: a.id, vehicleId: a.rameId });
                    continue;
                }
                if (rame?.currentLocation?.depotId) {
                    this._pushAlert('WARN', 'DIRECT_RAME_DEPOT', `Affectation simple en attente : la rame ${rame.name || a.rameId} est garée au dépôt et doit être sortie manuellement.`, { rotationId: `direct:${a.id}`, occurrenceId: a.id, vehicleId: a.rameId, depotId: rame.currentLocation.depotId });
                    continue;
                }
                out.push({ id: `direct:${a.id}`, name: `Mode simple — ${this.game.scheduleV2.getSchedule(a.scheduleId)?.number || a.scheduleId}`, enabled: true, calendarId: '', occurrences: [a], actions: [], assignedRameId: a.rameId || '', assignedFormation: a.formation, _directAssignmentId: a.id, _directRameId: a.rameId || '' });
            }
        }
        return out;
    }
    _rotationRuns(rotation: { "enabled": unknown; "calendarId": unknown; "name": unknown; "id": unknown }, baseDate: unknown) {
        if (!rotation?.enabled)
            return false;
        if (!rotation.calendarId)
            return true;
        const c = this.game.scheduleV2.calendars.find((x: { id: unknown }) => x.id === rotation.calendarId);
        if (!c) {
            this._pushAlert('ERROR', 'ROTATION_CALENDAR_MISSING', `Roulement ${rotation.name || rotation.id} bloqué : calendrier ${rotation.calendarId} introuvable.`, { rotationId: rotation.id, baseDate });
            return false;
        }
        return c.matchesDate(baseDate);
    }
    _versionApplies(ver: __S3Struct1036, baseDate: unknown) {
        if (!ver || ver.state !== ScheduleState.VALID)
            return false;
        if (!ver.calendarIds?.length)
            return true;
        const calendars = ver.calendarIds.map((id: unknown) => this.game.scheduleV2.calendars.find((c: { id: unknown }) => c.id === id));
        if (calendars.some((c: unknown) => !c))
            return false;
        return calendars.some((c: __S3Struct1037) => c.matchesDate(baseDate));
    }
    _resolveVersion(occ: { scheduleId: unknown; versionId: unknown }, baseDate: unknown) {
        // Rotation occurrences pin an exact immutable schedule version. Never swap it
        // silently for a newer version selected by calendar priority.
        const ver = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId);
        return this._versionApplies(ver, baseDate) ? ver : null;
    }
    _electricTractionUsableOnRoute(activeElectric: Array<{ v: PhysicalVehicle }>, segments: RuntimeSegment[] = []) {
        if (!activeElectric.length)
            return false;
        const systems = activeElectric.flatMap((x: { v: PhysicalVehicle }) => x.v.electricSystems || []);
        for (const seg of segments || []) {
            if (seg.electrified === false)
                return false;
            const m = electricalMatch(systems, seg);
            if (m === false)
                return false;
        }
        return true;
    }
    _actualProfile(occ: ScheduleOccurrence, fallbackProfile: PerformanceProfile, segments: unknown = []) {
        if (!occ?.formation?.members?.length)
            return fallbackProfile;
        const f = occ.formation.calculate(this.game.rotationV2);
        const active = occ.formation.members.map((m: FormationMember) => ({ m, v: this.game.rotationV2.getVehicle(m.vehicleId) as PhysicalVehicle | null })).filter((x: { m: FormationMember; v: PhysicalVehicle | null }): x is { m: FormationMember; v: PhysicalVehicle } => !!x.v && isActiveRole(x.m.role));
        const electric = active.filter((x) => tractionLooksElectric(x.v));
        const nonElectric = active.filter((x) => !tractionLooksElectric(x.v));
        // Carry installed power by traction mode. Availability is evaluated
        // per physical segment, never once for an entire continental route.
        const whollyNonElectric = Array.isArray(segments) && segments.length > 0 && segments.every(seg => seg.electrified === false);
        const powered = whollyNonElectric && nonElectric.length ? nonElectric : active;
        const electricPowerW = electric.reduce((n, x) => n + Math.max(0, Number(x.v.powerW || 0)), 0);
        const dieselPowerW = nonElectric.reduce((n, x) => n + Math.max(0, Number(x.v.powerW || 0)), 0);
        const powerW = powered.reduce((sum: number, x: __S3Struct1046) => sum + Math.max(0, Number(x.v.powerW || 0)), 0);
        const adhesion = powered.reduce((sum: number, x: __S3Struct1047) => sum + Math.max(0, Number(x.v.massKg || 0)), 0);
        // Formation mass is authoritative here. Never inject an invisible 70% load:
        // if the gameplay later carries a real live payload, it must be provided as
        // explicit mass by the formation/runtime rather than guessed by the timetable.
        const referenceLoadedMassKg = Math.max(1000, Number(f.massKg || 0));
        return new PerformanceProfile({
            mode: 'REFERENCE_COMPOSITION', name: 'Formation réelle', category: fallbackProfile?.category || TrainCategory.PASSENGER,
            maxSpeed: f.maxSpeed || fallbackProfile?.maxSpeed || 160,
            massKg: referenceLoadedMassKg || Math.max(1000, fallbackProfile?.massKg || 200000),
            powerW: Math.max(0, powerW), electricPowerW, dieselPowerW, lengthM: Math.max(1, f.lengthM || fallbackProfile?.lengthM || 200),
            adhesionMassKg: Math.max(1000, adhesion || Math.min(Number(f.massKg || 100000), 100000)), brakeServiceMs2: f.brakeServiceMs2 || fallbackProfile?.brakeServiceMs2 || 0.9,
            traction: powered.map((x: __S3Struct1048) => x.v.traction || '').filter(Boolean).join('+'), electricSystems: f.electricSystems,
            gauges: f.gauges, loadingGauge: f.loadingGauge, axleLoad: f.axleLoad, metreLoad: f.metreLoad, source: 'ROTATION_REAL_FORMATION',
        });
    }
    _timedVersion(occ: ScheduleOccurrence, ver: ScheduleVersion) {
        const path = ver.outboundPath || {};
        // v1.1.43 — check the cache BEFORE _actualProfile(). The latter may inspect
        // every ORM segment for electrical compatibility; doing that once/second on a
        // long route defeated the previous timing cache even when nothing changed.
        const members = occ?.formation?.members || [];
        const formationSig = members.map((m: { vehicleId: unknown; role: unknown }) => {
            const v = this.game.rotationV2.getVehicle(m.vehicleId);
            if (!v)
                return `${m.vehicleId}:${m.role}:missing`;
            const es = (v.electricSystems || []).map((x: { voltage: unknown; frequency: unknown }) => `${x.voltage || 0}/${x.frequency || 0}`).join(',');
            const gs = (v.gauges || []).join(',');
            return [m.vehicleId, m.role, v.traction || '', v.maxSpeed || 0, v.massKg || 0, v.powerW || 0, v.lengthM || 0,
                v.brakeServiceMs2 || 0, v.passengerCapacity || 0, v.freightCapacity || 0, v.loadingGauge || '', v.axleLoad ?? '', v.metreLoad ?? '', es, gs].join(':');
        }).join('|');
        const inputSignature = [
            ver.id, ver.version, ver.firstDepartureSec, ver.lastRecalculatedAt || '',
            path.id || '', path.validatedAt || '', path.ormRevision || '',
            path.legs?.length || 0, path.routePoints?.length || 0, path.segments?.length || 0,
            formationSig,
        ].join('|');
        const cacheKey = `${occ?.id || ''}|${ver.id}`;
        const cached = this._timedVersionCache.get(cacheKey);
        if (cached?.inputSignature === inputSignature)
            return cached.timed;
        const profile = this._actualProfile(occ, ver.performanceProfile, ver.outboundPath?.segments || []);
        const profileSig = [
            profile.maxSpeed, profile.massKg, profile.powerW, profile.lengthM, profile.adhesionMassKg,
            profile.brakeServiceMs2, profile.traction, profile.loadingGauge || '', profile.axleLoad ?? '', profile.metreLoad ?? '',
            (profile.electricSystems || []).map((x: { voltage: unknown; frequency: unknown }) => `${x.voltage || 0}/${x.frequency || 0}`).join(','),
            (profile.gauges || []).join(',')
        ].join(':');
        const signature = `${inputSignature}|${profileSig}`;
        // Do NOT new ScheduleVersion(ver.toJSON()) here: that deep-copies every ORM
        // route point. Clone only the mutable timing shell and share immutable route
        // geometry. This turns a 10k-point schedule from a multi-ms deep copy into a
        // handful of tiny location objects.
        const clone = Object.assign(Object.create(Object.getPrototypeOf(ver)), ver);
        clone.locations = (ver.locations || []).map((l: unknown) => Object.assign(Object.create(Object.getPrototypeOf(l)), l));
        clone.outboundPath = ver.outboundPath ? Object.assign(Object.create(Object.getPrototypeOf(ver.outboundPath)), ver.outboundPath) : ver.outboundPath;
        clone.returnPath = ver.returnPath ? Object.assign(Object.create(Object.getPrototypeOf(ver.returnPath)), ver.returnPath) : ver.returnPath;
        // Geometry is read-only, but timing caches belong to the clone.
        if (clone.outboundPath) clone.outboundPath.legs = (ver.outboundPath?.legs || []).map(leg => ({...leg}));
        if (clone.returnPath) clone.returnPath.legs = (ver.returnPath?.legs || []).map(leg => ({...leg}));
        clone.performanceProfile = profile;
        recalculateScheduleTiming(clone, { firstDepartureSec: ver.firstDepartureSec });
        this._timedVersionCache.set(cacheKey, { inputSignature, signature, timed: clone });
        // Bounded cache: normally one entry per occurrence. Avoid unbounded growth
        // after thousands of editor versions in a very long session.
        if (this._timedVersionCache.size > 2048) {
            const first = this._timedVersionCache.keys().next().value;
            if (first !== undefined)
                this._timedVersionCache.delete(first);
        }
        return clone;
    }
    _beginPlanCacheEpoch(dateStr: unknown, todSec: unknown) {
        const epoch = `${dateStr || ''}|${Math.floor(Math.max(0, Number(todSec || 0)) / 60)}`;
        if (this._planCacheEpoch !== epoch) {
            this._planCacheEpoch = epoch;
            this._planCache.clear();
        }
        return epoch;
    }
    _plansForRotationDate(rotation: Rotation, baseDate: string): RuntimePlanResult[] {
        const key = `${rotation?.id || ''}|${baseDate || ''}`;
        if (this._planCache.has(key))
            return this._planCache.get(key)!;
        const plans = this.planRotationForDate(rotation, baseDate);
        this._planCache.set(key, plans);
        // Defensive bound for unusual callers that enumerate many historical dates
        // within one minute. Normal runtime usage stays far below this.
        if (this._planCache.size > 512) {
            const first = this._planCache.keys().next().value;
            if (first !== undefined)
                this._planCache.delete(first);
        }
        return plans;
    }
    planRotationForDate(rotation: Rotation, baseDate: string): RuntimePlanResult[] {
        if (!this._rotationRuns(rotation, baseDate))
            return [];
        const occurrences = [...rotation.occurrences].sort((a: __KPA141, b: __KPA142) => a.sequence - b.sequence);
        const plans: RuntimePlanResult[] = [], ready = new Map<string, number>();
        for (const occ of occurrences) {
            if (occ.cancelled)
                continue;
            const ver = this._resolveVersion(occ, baseDate);
            if (!ver) {
                const raw = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId);
                const reason = !raw ? 'version introuvable' : raw.state !== ScheduleState.VALID ? `version ${raw.state}` : 'calendrier non applicable';
                this._pushAlert('ERROR', 'V2_OCCURRENCE_NOT_RUNNABLE', `Occurrence ${this.game.scheduleV2.getSchedule(occ.scheduleId)?.number || occ.scheduleId} non compilée : ${reason}.`, { rotationId: rotation.id, occurrenceId: occ.id, baseDate });
                plans.push({ rotation, occ, ver: null, baseDate, error: reason });
                continue;
            }
            let timed;
            try {
                timed = this._timedVersion(occ, ver);
            }
            catch (err) {
                const reason = (err as { message?: string })?.message || String(err);
                this._pushAlert('ERROR', 'V2_TIMING_INVALID', `Train ${this.game.scheduleV2.getSchedule(occ.scheduleId)?.number || ''} non compilé : ${reason}`, { rotationId: rotation.id, occurrenceId: occ.id, baseDate });
                plans.push({ rotation, occ, ver: null, baseDate, error: reason });
                continue;
            }
            const actualDuration = Math.max(0, timed.lastArrivalSec - timed.firstDepartureSec), referenceDuration = Math.max(0, ver.lastArrivalSec - ver.firstDepartureSec);
            if (occ.formation?.members?.length && actualDuration - referenceDuration >= 1) {
                const sig = this.game.rotationV2._timingSignature(occ, actualDuration, referenceDuration);
                occ.currentTimingMismatchSignature = sig;
                if (occ.timingMismatchSignature !== sig)
                    occ.timingMismatchApproved = false;
            }
            else
                occ.currentTimingMismatchSignature = '';
            const plannedStart = timed.firstDepartureSec + Number(occ.offsetSec || 0);
            let preDepartureOperationSec = 0, terminalOperationSec = 0;
            try {
                const originId = timed.locations?.[0]?.id;
                if (originId)
                    preDepartureOperationSec = this.game.rotationV2.operationWindowSec(rotation.id, occ.id, originId);
            }
            catch (err) {
                this._pushAlert('ERROR', 'OPERATION_DEPENDENCY_INVALID', (err as { message?: string }).message as string, { rotationId: rotation.id, occurrenceId: occ.id, baseDate });
                plans.push({ rotation, occ, ver: null, baseDate, error: (err as { message?: string }).message as string });
                continue;
            }
            try {
                const terminal = timed.locations?.at(-1);
                if (terminal?.id)
                    terminalOperationSec = this.game.rotationV2.operationWindowSec(rotation.id, occ.id, terminal.id);
            }
            catch (err) {
                this._pushAlert('ERROR', 'OPERATION_DEPENDENCY_INVALID', (err as { message?: string }).message as string, { rotationId: rotation.id, occurrenceId: occ.id, baseDate });
                plans.push({ rotation, occ, ver: null, baseDate, error: (err as { message?: string }).message as string });
                continue;
            }
            let start = plannedStart;
            for (const id of this.game.rotationV2.originRequiredVehicleIds?.(rotation.id, occ.id, timed) || [])
                if (ready.has(id))
                    start = Math.max(start, Number(ready.get(id) || 0) + preDepartureOperationSec);
            const shift = start - timed.firstDepartureSec, terminal = timed.locations?.at(-1);
            const terminalRelease = Math.max(timed.lastArrivalSec, terminal?.departureSec ?? timed.lastArrivalSec, timed.lastArrivalSec + terminalOperationSec);
            const end = terminalRelease + shift;
            const locations = timed.locations.map((l: __S3Struct1054, i: unknown) => {
                const arrivalSec = l.arrivalSec == null ? null : l.arrivalSec + shift;
                let departureSec = l.departureSec == null ? null : l.departureSec + shift;
                if (i === timed.locations.length - 1 && terminalOperationSec > 0 && arrivalSec != null)
                    departureSec = Math.max(departureSec ?? arrivalSec, arrivalSec + terminalOperationSec);
                return { location: l, arrivalSec, departureSec };
            });
            const plan = { rotation, occ, ver: timed, sourceVersion: ver, baseDate, startSec: start, prepStartSec: start - preDepartureOperationSec, endSec: end, shiftSec: shift, locations, preDepartureOperationSec, terminalOperationSec };
            plans.push(plan);
            for (const iv of this.game.rotationV2.materialIntervals?.(rotation.id, occ.id, timed, start) || [])
                ready.set(iv.vehicleId, Math.max(Number(ready.get(iv.vehicleId) || 0), iv.endSec));
        }
        return plans;
    }
    _roughLookback(rotation: Rotation) {
        let max = DAY;
        for (const occ of rotation.occurrences) {
            const ver = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId) || this.game.scheduleV2.getSchedule(occ.scheduleId)?.currentVersion;
            if (!ver)
                continue;
            max = Math.max(max, (occ.offsetSec || 0) + ver.lastArrivalSec + DAY);
        }
        return Math.max(1, Math.ceil(max / DAY) + 1);
    }
    _knownLocationMismatch(vehicle: PhysicalVehicle, firstLoc: { location: RuntimeLocationAnchor }) {
        const l = vehicle?.location;
        if (!l)
            return false;
        const finiteCoord = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
        const hasCoords = finiteCoord(l.lat) && finiteCoord(l.lon);
        // UNKNOWN means the semantic place id is unknown, not that valid coordinates
        // should be ignored. A vehicle explicitly stored at 0,0 is not magically at
        // the French departure station.
        if (!l.id && !hasCoords)
            return false;
        const expectedId = firstLoc.location.stationId || firstLoc.location.technicalLocationId || '';
        if (expectedId && l.id) {
            if (String(l.id) !== String(expectedId)) return true;
            return materialTrackMismatch(l, firstLoc.location, String(expectedId), this.game.voiePointManager?.voiePoints || []);
        }
        const target = { lat: firstLoc.location.track?.snapLat ?? firstLoc.location.track?.lat, lon: firstLoc.location.track?.snapLon ?? firstLoc.location.track?.lon };
        if (finiteCoord(l.lat) && finiteCoord(l.lon) && finiteCoord(target.lat) && finiteCoord(target.lon))
            return geoDistanceKm(l, target) > 1;
        return false;
    }
    _liveOwner(vehicleId: unknown) {
        return this.game.scheduleCreator?.services?.find((s: __S3Struct1058) => !s.completed && s.state !== 'cancelled' && (s._v2VehicleIds || []).includes(vehicleId)) || null;
    }
    _usableMembers(plan: RuntimePlan, restoreSnapshot: RuntimeFormationSnapshot | null = null, serviceId: unknown = '') {
        const members = [];
        const first = plan.locations[0];
        let missingLead = false, notReady = false;
        const seen = new Set();
        const restoring = !!(restoreSnapshot && Array.isArray(restoreSnapshot.formationMembers) && restoreSnapshot.formationMembers.length);
        const sourceMembers: RuntimeFormationMember[] = restoring ? (restoreSnapshot?.formationMembers ?? []) : plan.occ.formation.members;
        for (const m of sourceMembers) {
            if (!m.vehicleId || seen.has(m.vehicleId)) {
                missingLead = missingLead || isActiveRole(m.role);
                this._pushAlert('ERROR', 'FORMATION_DUPLICATE_OR_EMPTY', `Formation invalide : matériel ${m.vehicleId || '(vide)'} dupliqué ou absent.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: m.vehicleId || '' });
                continue;
            }
            seen.add(m.vehicleId);
            const v = this.game.rotationV2.getVehicle(m.vehicleId);
            if (!v) {
                if (isActiveRole(m.role))
                    missingLead = true;
                this._pushAlert('ERROR', 'FORMATION_VEHICLE_MISSING', `Formation invalide : matériel ${m.vehicleId} introuvable.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: m.vehicleId });
                continue;
            }
            if (this.game.depotManager?.isVehicleUnderRepair?.(v.id)) {
                v.available = false; notReady = true;
                this._pushAlert('WARNING', 'MATERIAL_EMERGENCY_REPAIR', `${v.number} est encore en réparation au dépôt.`, {rotationId:plan.rotation.id, occurrenceId:plan.occ.id, baseDate:plan.baseDate, vehicleId:v.id});
                continue;
            }
            const nowEpoch = simulationEpochSec(plan.baseDate, plan._relNow ?? plan.startSec);
            const busyUntil = Number(v._v2BusyUntilEpoch || 0);
            const operationBusy = Number.isFinite(busyUntil) && busyUntil > nowEpoch;
            if (busyUntil && !operationBusy)
                delete v._v2BusyUntilEpoch;
            if (!v.available && !this._liveOwner(v.id) && !operationBusy)
                v.available = true;
            const owner = this._liveOwner(v.id), owned = !!owner;
            // HOTFIX35 — a fresh runtime snapshot is the physical truth after a split,
            // UM change or locomotive swap.  Do not re-check its current members against
            // the ORIGINAL departure formation/location before restoration; that could
            // cancel a perfectly valid F5 at Valence because the old Paris locomotive
            // is no longer in the consist. Another live service owner still wins.
            if (restoring) {
                if (owner && String(owner.id) !== String(serviceId)) {
                    notReady = true;
                    this._pushAlert('ERROR', 'SNAPSHOT_MATERIAL_ALREADY_OWNED', `${v.number} appartient déjà à une autre circulation active ; restauration refusée.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: v.id });
                    continue;
                }
                members.push({ member: m, vehicle: v });
                continue;
            }
            const locationMismatch = this._knownLocationMismatch(v, first), mismatch = operationBusy || !v.available || locationMismatch;
            if (!owned && !operationBusy && String(v.location?.id || '') === String(first.location.stationId || first.location.technicalLocationId || '') &&
                materialTrackMismatch(v.location, first.location, String(v.location?.id || ''), this.game.voiePointManager?.voiePoints || [])) {
                notReady = true;
                this._pushAlert('WARNING', 'MATERIAL_TRACK_TRANSFER_REQUIRED', `${v.number} est sur une autre voie : acheminement physique W/HLP requis avant cette circulation.`, {rotationId:plan.rotation.id, occurrenceId:plan.occ.id, baseDate:plan.baseDate, vehicleId:v.id});
                continue;
            }
            if (operationBusy || (!v.available && owned)) {
                notReady = true;
                this._pushAlert('WARNING', 'MATERIAL_TRANSFER_PENDING', `${v.number} est encore engagé : la circulation ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} attendra sa libération.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: v.id });
                continue;
            }
            if (mismatch && isActiveRole(m.role)) {
                missingLead = true;
                this._pushAlert('ERROR', 'TITULAR_MISSING', `${v.number} n’est pas disponible au lieu de départ : train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} annulé.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: v.id, suggestion: 'Prévoir un HLP/acheminement explicite, corriger le roulement ou repositionner cet engin avant le départ.' });
                continue;
            }
            if (mismatch) {
                this._pushAlert('WARNING', 'VEHICLE_MISSING', `${v.number} n’est pas au lieu de départ : le train circulera sans ce véhicule/coupon.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: v.id });
                continue;
            }
            members.push({ member: m, vehicle: v });
        }
        const active = members.filter((x) => isActiveRole(x.member.role));
        if (!active.length)
            missingLead = true;
        return { members, active, missingLead, notReady };
    }
    _electricalProblem(plan: RuntimePlan, usable: RuntimeUsableFormation) {
        if (!usable.active.length)
            return 'Aucun engin de traction actif.';
        if (usable.active.some((x: { vehicle: PhysicalVehicle }) => tractionLooksDiesel(x.vehicle)))
            return '';
        const electric = usable.active.filter((x: { vehicle: PhysicalVehicle }) => tractionLooksElectric(x.vehicle));
        if (!electric.length)
            return ''; // data unknown/non-electric propulsion: do not invent a restriction
        const systems = electric.flatMap((x: RuntimeVehiclePair) => x.vehicle.electricSystems || []);
        for (const seg of plan.ver.outboundPath?.segments || []) {
            if (seg.electrified === false)
                return `Section ${seg.wayId || '?'} non électrifiée.`;
            const m = electricalMatch(systems, seg);
            if (m === false)
                return `Système électrique incompatible sur la section ${seg.wayId || '?'} (${(seg.voltage || []).join('/')} V ${(seg.frequency || []).join('/')} Hz).`;
        }
        return '';
    }
    _gaugeProblem(plan: RuntimePlan, usable: RuntimeUsableFormation) {
        for (const seg of plan.ver.outboundPath?.segments || []) {
            const trackGauges = (seg.gauge || []).map(Number).filter(Number.isFinite);
            // Unknown gauge only defers the gauge check. Loading gauge and
            // axle/metre loads remain independently enforceable.
            for (const { vehicle: v } of usable.members) {
                const allowed = (v.gauges || []).map(Number).filter(Number.isFinite);
                if (!allowed.length || !trackGauges.length)
                    continue; // only the gauge is unknown
                if (!allowed.some((g: __KPA146) => trackGauges.some((t: __KPA147) => Math.abs(t - g) <= 2)))
                    return `Écartement incompatible pour ${v.number} sur la section ${seg.wayId || '?'} (${trackGauges.join('/')} mm).`;
            }
            for (const { vehicle: v } of usable.members) {
                if (v.loadingGauge && seg.loadingGauge && !loadingGaugeCompatible(v.loadingGauge, seg.loadingGauge))
                    return `Gabarit ${v.loadingGauge} incompatible avec ${seg.loadingGauge} sur la section ${seg.wayId || '?'}.`;
                const axle = Number(v.axleLoad), trackAxle = Number(seg.axleLoad);
                if (Number.isFinite(axle) && axle > 0 && Number.isFinite(trackAxle) && trackAxle > 0 && axle > trackAxle + 0.05)
                    return `Charge par essieu ${axle} t supérieure à la limite ${trackAxle} t sur la section ${seg.wayId || '?'}.`;
                const metre = Number(v.metreLoad), trackMetre = Number(seg.metreLoad);
                if (Number.isFinite(metre) && metre > 0 && Number.isFinite(trackMetre) && trackMetre > 0 && metre > trackMetre + 0.02)
                    return `Charge au mètre ${metre} t/m supérieure à la limite ${trackMetre} t/m sur la section ${seg.wayId || '?'}.`;
            }
        }
        return '';
    }
    _vehicleDetail(member: Pick<FormationMember, 'role'>, v: PhysicalVehicle) {
        const active = isActiveRole(member.role), cv = member.role === FormationRole.VEHICLE, locomotiveLike = active && !cv;
        const out: AnyRecord = { physicalVehicleId:v.id, id: v.catalogId || v.id, catalogId: v.catalogId, name: v.name || v.number, seriesName: v.number, category: locomotiveLike ? 'locomotive' : (String(v.category || '').toLowerCase().includes('wagon') ? 'wagon' : 'voiture'), traction: locomotiveLike ? v.traction : 'none', maxSpeed: v.maxSpeed || 160, mass: (v.massKg || 0) / 1000, tonnage: (v.massKg || 0) / 1000, power: locomotiveLike ? (v.powerW || 0) / 1000 : 0, length: v.lengthM || 20, passengerCapacity: Number(v.passengerCapacity || 0), freightCapacity: Number(v.freightCapacity || 0), brakeServiceMs2: Number(v.brakeServiceMs2 || 0.9), electricSystems: v.electricSystems || [], gauges: v.gauges || [], loadingGauge: v.loadingGauge || '', axleLoad: v.axleLoad ?? null, metreLoad: v.metreLoad ?? null, isDrivingTrailer: !!v.isDrivingTrailer, flipped: !!v.flipped };
        // Keep the hot runtime object light: only carry an image when a real physical
        // vehicle actually has one. Direct assignments still resolve their Rames-page
        // source through _v2DirectRameId.
        if (v.imageData)
            out.imageData = v.imageData;
        if (v.liveryId) { out.liveryId=v.liveryId; out.originalImageData=v.originalImageData; }
        return out;
    }
    /** RC24: direct assignments reorder their source; advanced formations reorder only current members. */
    prepareRandomDeparture(svc: ActiveServiceLike, key: string): void {
        if (!key || svc._v2RandomDepartureKey === key || !svc.rame) return;
        const rames = this.game.rameManager;
        const direct = svc._v2DirectRameId ? rames?.getById(svc._v2DirectRameId) : null;
        if (direct) {
            if (!direct.randomizeOnDeparture) return;
            randomizeRameDeparture(direct, key);
            // The aggregate direct-runtime proxy has identical mass/power/length/capacity.
            // Never rebuild rotations or purchase material on a departure.
            svc._v2RandomDepartureKey = key;
            return;
        }
        let source = svc._v2AssignedRameId ? rames?.getById(svc._v2AssignedRameId) : null;
        if (!source) {
            const sourceIds = new Set((svc._v2FormationMembers || []).map(m => this.game.rotationV2.getVehicle(m.vehicleId)?.sourceRameId).filter(Boolean));
            if (sourceIds.size === 1) source = rames?.getById(String([...sourceIds][0]));
        }
        if (!source?.randomizeOnDeparture) return;
        const members = new Map((svc._v2FormationMembers || []).map(m => [m.vehicleId, m]));
        // All details must have a real physical identity before modifying anything.
        if (svc.rame.elementDetails.some(e => !members.has(String(e.physicalVehicleId || '')))) return;
        svc.rame.randomizeOnDeparture = true;
        randomizeRameDeparture(svc.rame, key);
        const ordered = svc._v2FormationReversed ? [...svc.rame.elementDetails].reverse() : svc.rame.elementDetails;
        svc._v2FormationMembers = ordered.map(e => ({ ...members.get(String(e.physicalVehicleId))! }));
        svc._v2VehicleIds = svc._v2FormationMembers.map(m => m.vehicleId);
        svc._v2RandomDepartureKey = key;
    }

    _refreshRuntimeFormation(svc: ActiveServiceLike) {
        // Unassigned legacy services can carry V2 snapshots before a physical rame exists.
        // Restoring the cab-direction flag must not manufacture or dereference a formation.
        if (!svc.rame) return;
        const pairs = ((svc._v2FormationMembers || []) as FormationMember[]).map((m: FormationMember) => ({ member: m, vehicle: this.game.rotationV2.getVehicle(m.vehicleId) as PhysicalVehicle | null })).filter((x: { member: FormationMember; vehicle: PhysicalVehicle | null }): x is { member: FormationMember; vehicle: PhysicalVehicle } => !!x.vehicle);
        svc._v2VehicleIds = pairs.map((x: __S3Struct1072) => x.vehicle.id);
        let details = pairs.map((x) => this._vehicleDetail(x.member, x.vehicle));
        if (svc._v2FormationReversed)
            details = details.reverse().map((d: AnyRecord) => ({ ...d, flipped: !Boolean(d.flipped) }));
        svc.rame.elementDetails = details as typeof svc.rame.elementDetails;
        svc.rame.elements = details.map(d => String(d.catalogId || d.id || ''));
        svc.train.maxSpeed = svc.rame.maxSpeed || svc.train.maxSpeed;
        // v1.1.73 — do not re-introduce a hidden 70%-payload acceleration/decel
        // cap when the formation changes. ActiveService now computes traction and
        // braking from live mass, powered-axle adhesion, weather and grade every tick.
        const physicsMult = (typeof window !== 'undefined' ? (window.game?.realismSettings?.physics ?? 1) : 1);
        svc.train.accel = Math.max(.1, 5 * physicsMult);
        svc.train.decel = Math.max(.1, 5 * physicsMult);
        try {
            const formation = new ActiveFormationSpec({ members: svc._v2FormationMembers || [] });
            const calc = formation.calculate(this.game.rotationV2);
            if (Number.isFinite(Number(calc.brakeServiceMs2)) && Number(calc.brakeServiceMs2) > 0)
                svc._v2BrakeServiceMs2 = Math.max(0.1, Number(calc.brakeServiceMs2));
        }
        catch { }
    }
    _actionLocation(stop: __KPM435) { return { ...materialTrackLocation(stop), kind: stop?.stationId ? 'STATION' : 'TECHNICAL', id: stop?.stationId || stop?.technicalLocationId || '', lat: stop?.lat ?? null, lon: stop?.lon ?? null }; }
    _operationAllIds(action: RotationAction) {
        return [...new Set([...(action?.vehicleIds || []), ...(action?.couponIds || []).flatMap((cid: unknown) => this.game.rotationV2.getCoupon?.(cid)?.vehicleIds || [])])];
    }
    _operationIncomingIds(svc: ActiveServiceLike, action: RotationAction) {
        const current = new Set((svc?._v2FormationMembers || []).map((m: { vehicleId: unknown }) => m.vehicleId));
        if (!['ATTACH', 'MERGE', 'ADD_PUSHER', 'ADD_CV', 'CHANGE_LOCOMOTIVE'].includes(action?.type))
            return [];
        return this._operationAllIds(action).filter((id: unknown) => !current.has(id));
    }
    _operationServiceId(svc: ActiveServiceLike, plan: RuntimePlan) { return String(svc?.id || `v2:${plan?.rotation?.id || ''}:${plan?.occ?.id || ''}:${plan?.baseDate || ''}`); }
    _reserveOperationEntry(svc: ActiveServiceLike, plan: RuntimePlan, stop: { "stationId": unknown; "technicalLocationId": unknown; "locationName": unknown }, stateEntry: RuntimeOperationEntry, relNowSec: unknown) {
        if (stateEntry.started)
            return true;
        const action = plan.rotation.actions.find((a: { id: unknown }) => a.id === stateEntry.actionId);
        if (!action) {
            stateEntry.failed = true;
            stateEntry.failure = 'opération introuvable';
            return false;
        }
        const deps = new Set(stateEntry.dependsOn || []);
        if ((svc._v2OperationState?.entries || []).some((e: { actionId: unknown; applied: unknown }) => deps.has(String(e.actionId)) && !e.applied))
            return false;
        const incoming = this._operationIncomingIds(svc, action), nowEpoch = simulationEpochSec(plan.baseDate, relNowSec), location = this._actionLocation(stop);
        const candidates = [];
        for (const id of incoming) {
            const v = this.game.rotationV2.getVehicle(id);
            if (!v) {
                stateEntry.failed = true;
                stateEntry.failure = `matériel ${id} introuvable`;
                return false;
            }
            const own = String(v._v2OperationOwnerServiceId || '') === this._operationServiceId(svc, plan);
            const opBusy = Number(v._v2BusyUntilEpoch || 0) > nowEpoch && !own;
            const liveOwner = this._liveOwner(v.id), ownedElsewhere = !!(liveOwner && String(liveOwner.id) !== this._operationServiceId(svc, plan));
            const mismatch = this._knownLocationMismatch(v, { location: { ...materialTrackLocation(stop), stationId: stop?.stationId || '', technicalLocationId: stop?.technicalLocationId || '' } });
            if (opBusy || ownedElsewhere || (!v.available && !own) || mismatch) {
                svc._v2OperationWaitingMaterial = true;
                this._pushAlert('WARNING', 'ROTATION_ACTION_MATERIAL_WAIT', `${v.number} n’est pas encore disponible pour l’opération à ${stop?.locationName || stop?.stationId || ''}. L’opération attend physiquement le matériel.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, vehicleId: v.id });
                return false;
            }
            candidates.push(v);
        }
        const duration = Math.max(300, Number(stateEntry.durationSec || action.durationSec || 300));
        stateEntry.started = true;
        stateEntry.actualStartRelSec = Number(relNowSec);
        stateEntry.actualEndRelSec = Number(relNowSec) + duration;
        stateEntry.reservedIds = [];
        for (const v of candidates) {
            v.available = false;
            v._v2OperationOwnerServiceId = this._operationServiceId(svc, plan);
            v._v2BusyUntilEpoch = simulationEpochSec(plan.baseDate, stateEntry.actualEndRelSec);
            stateEntry.reservedIds.push(v.id);
        }
        svc._v2OperationWaitingMaterial = false;
        return true;
    }
    _releaseOperationReservations(svc: ActiveServiceLike, plan: RuntimePlan, stateEntry: RuntimeOperationEntry, keepUnavailableIds: { "has": (...args: unknown[]) => unknown } = new Set()) {
        for (const id of stateEntry?.reservedIds || []) {
            const v = this.game.rotationV2.getVehicle(id);
            if (!v)
                continue;
            if (String(v._v2OperationOwnerServiceId || '') === this._operationServiceId(svc, plan))
                delete v._v2OperationOwnerServiceId;
            delete v._v2BusyUntilEpoch;
            v.available = keepUnavailableIds.has(id) ? false : true;
        }
        stateEntry.reservedIds = [];
    }
    _applyOneOperationAction(svc: ActiveServiceLike, plan: RuntimePlan, stop: { "stationId": unknown; "technicalLocationId": unknown; "locationName": unknown }, action: RotationAction, stateEntry: RuntimeOperationEntry, relativeNowSec: unknown) {
        const members = svc._v2FormationMembers || [], location = this._actionLocation(stop), ids = this._operationAllIds(action);
        const removeIds = (list: unknown[]) => { for (const id of list) {
            const idx = members.findIndex((m: { vehicleId: unknown }) => m.vehicleId === id);
            if (idx >= 0)
                members.splice(idx, 1);
            const v = this.game.rotationV2.getVehicle(id);
            if (v) {
                if (String(v._v2OperationOwnerServiceId || '') === this._operationServiceId(svc, plan))
                    delete v._v2OperationOwnerServiceId;
                delete v._v2BusyUntilEpoch;
                v.available = true;
                v.location = { ...location };
            }
        } };
        const activeCount = () => members.filter((m: __KPA150) => isActiveRole(m.role)).length;
        const powered = (v: { "powerW": unknown }) => this.game.rotationV2._poweredVehicle?.(v) ?? (Number(v?.powerW || 0) > 0);
        const infer = (a: RotationAction, v: PhysicalVehicle) => {
            const roleMap = a.details?.roleByVehicle;
            const explicit = roleMap && typeof roleMap === 'object' ? (roleMap as Record<string, unknown>)[v.id] : undefined;
            if (typeof explicit === 'string' && Object.values(FormationRole).includes(explicit as (typeof FormationRole)[keyof typeof FormationRole]))
                return explicit;
            if (a.type === 'ADD_PUSHER')
                return FormationRole.PUSHER;
            if (a.type === 'ADD_CV')
                return FormationRole.VEHICLE;
            if (String(v?.category || '').toLowerCase().includes('wagon'))
                return FormationRole.WAGON;
            if (powered(v))
                return activeCount() > 0 ? FormationRole.ACTIVE_MULTIPLE : FormationRole.LEAD;
            return FormationRole.COACH;
        };
        const canAttach = (id: unknown) => {
            if (members.some((m: { vehicleId: unknown }) => m.vehicleId === id))
                return false;
            const v = this.game.rotationV2.getVehicle(id);
            if (!v)
                return false;
            const own = String(v._v2OperationOwnerServiceId || '') === this._operationServiceId(svc, plan);
            const nowEpoch = simulationEpochSec(plan.baseDate, relativeNowSec), opBusy = Number(v._v2BusyUntilEpoch || 0) > nowEpoch && !own;
            return !opBusy && (v.available || own) && !this._knownLocationMismatch(v, { location: { ...materialTrackLocation(stop), stationId: stop?.stationId || '', technicalLocationId: stop?.technicalLocationId || '' } });
        };
        const attach = (id: unknown, role: unknown) => { if (!canAttach(id))
            return false; const v = this.game.rotationV2.getVehicle(id); members.push({ vehicleId: id as string, role: role as FormationMember['role'] }); v.available = false; if (String(v._v2OperationOwnerServiceId || '') === this._operationServiceId(svc, plan))
            delete v._v2OperationOwnerServiceId; delete v._v2BusyUntilEpoch; return true; };
        let ok = true;
        if (['DETACH', 'SPLIT', 'REMOVE_PUSHER', 'REMOVE_CV'].includes(action.type))
            removeIds(ids);
        else if (action.type === 'CHANGE_LOCOMOTIVE') {
            const old = members.filter((m: { role: unknown }) => isActiveRole(m.role)).map((m: { vehicleId: unknown }) => m.vehicleId), wanted = ids.filter((id: unknown) => !old.includes(id));
            if (wanted.some((id: unknown) => !canAttach(id)))
                ok = false;
            else {
                let first = true;
                for (const id of wanted) {
                    const v = this.game.rotationV2.getVehicle(id);
                    attach(id, first ? (first = false, FormationRole.LEAD) : (powered(v) ? FormationRole.ACTIVE_MULTIPLE : infer(action, v)));
                }
                removeIds(old.filter((id: unknown) => !ids.includes(id)));
            }
        }
        else if (['ATTACH', 'MERGE', 'ADD_PUSHER', 'ADD_CV'].includes(action.type)) {
            const wanted = ids.filter((id: unknown) => !members.some((m: __KPA154) => m.vehicleId === id));
            if (wanted.some((id: unknown) => !canAttach(id)))
                ok = false;
            else
                for (const id of wanted) {
                    const v = this.game.rotationV2.getVehicle(id);
                    attach(id, infer(action, v));
                }
        }
        const inTrain = new Set(members.map((m: { vehicleId: unknown }) => m.vehicleId));
        this._releaseOperationReservations(svc, plan, stateEntry, inTrain);
        if (!ok) {
            stateEntry.failed = true;
            stateEntry.failure = 'matériel indisponible à la fin de l’opération';
            svc._v2OperationFailure = stateEntry.failure;
            this._pushAlert('ERROR', 'ROTATION_ACTION_MATERIAL_MISSING', `Opération ${action.type} impossible à ${stop?.locationName || stop?.stationId || ''} : matériel indisponible.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate });
            return false;
        }
        members.forEach((m, i) => m.order = i);
        this._refreshRuntimeFormation(svc);
        return true;
    }
    _tickOperationState(svc: ActiveServiceLike, plan: RuntimePlan, relativeNowSec: unknown) {
        if (this.game.depotManager?.ownsServiceMovement?.(svc.id)) return;
        const state = svc?._v2OperationState;
        if (!state || state.completed)
            return;
        const stop = (svc.stops || []).find((s: __KPA155) => s.locationOccurrenceId === state.locationOccurrenceId)
            || (svc.returnStops || []).find((s: __KPA156) => s.locationOccurrenceId === state.locationOccurrenceId)
            || { locationOccurrenceId: state.locationOccurrenceId, stationId: state.stationId || '', technicalLocationId: state.technicalLocationId || '', locationName: state.locationName || '' };
        const elapsed = Math.max(0, Number(relativeNowSec) - Number(state.windowStartRelSec || 0));
        for (const entry of state.entries || []) {
            if (entry.applied || entry.failed)
                continue;
            if (!entry.started && elapsed + 1e-6 >= Number(entry.plannedStartOffsetSec || 0))
                this._reserveOperationEntry(svc, plan, stop, entry, relativeNowSec);
            if (!entry.started || entry.applied || entry.failed)
                continue;
            if (Number(relativeNowSec) + 1e-6 >= Number(entry.actualEndRelSec)) {
                const action = plan.rotation.actions.find((a: { id: unknown }) => a.id === entry.actionId);
                if (!action) {
                    entry.failed = true;
                    entry.failure = 'opération introuvable';
                    svc._v2OperationFailure = entry.failure;
                    continue;
                }
                if (this._applyOneOperationAction(svc, plan, stop, action, entry, relativeNowSec))
                    entry.applied = true;
            }
        }
        const failed = (state.entries || []).find((e: { failed: unknown }) => e.failed);
        if (failed) {
            svc._v2OperationFailure = failed.failure || 'opération de roulement impossible';
            state.failed = true;
            return;
        }
        if ((state.entries || []).every((e: { applied: unknown }) => e.applied)) {
            state.completed = true;
            svc._v2OperationWaitingMaterial = false;
            svc._v2OperationFailure = '';
            // Keep the completed state until the service leaves this stop; it is tiny and
            // prevents a second arrival callback from replaying the same operations.
        }
    }
    _beginActionsAtStop(svc: ActiveServiceLike, plan: RuntimePlan, stop: RuntimeStop, relativeNowSec: unknown = null, isOrigin: unknown = false) {
        const timeline = this.game.rotationV2.operationTimelineAtLocation?.(plan.rotation.id, plan.occ.id, stop?.locationOccurrenceId);
        if (!timeline?.entries?.length)
            return;
        if (svc._v2OperationState?.locationOccurrenceId === stop.locationOccurrenceId && !svc._v2OperationState?.failed) {
            this._tickOperationState(svc, plan, Number(relativeNowSec));
            return;
        }
        const relNow = Number.isFinite(Number(relativeNowSec)) ? Number(relativeNowSec) : Number(plan._relNow ?? plan.startSec);
        const windowStart = isOrigin ? Number(plan.startSec) - Number(timeline.windowSec || 0) : relNow;
        svc._v2OperationState = {
            locationOccurrenceId: String(stop.locationOccurrenceId || ''), stationId: String(stop.stationId || ''), technicalLocationId: String(stop.technicalLocationId || ''), locationName: String(stop.locationName || ''), windowStartRelSec: windowStart, completed: false, failed: false,
            entries: timeline.entries.map((e: RuntimeTimelineEntry) => ({ actionId: e.action.id, plannedStartOffsetSec: Number(e.startOffsetSec || 0), plannedEndOffsetSec: Number(e.endOffsetSec || 0), durationSec: Math.max(300, Number(e.action.durationSec || 300)), dependsOn: [...(e.dependsOn || [])], started: false, applied: false, failed: false, reservedIds: [] })),
        };
        svc._v2OperationFailure = '';
        svc._v2OperationWaitingMaterial = false;
        this._tickOperationState(svc, plan, relNow);
    }
    _operationTickForService(svc: ActiveServiceLike, plan: RuntimePlan, dateStr: unknown, timeOfDay: unknown) {
        if (!svc?._v2OperationState || svc._v2OperationState.completed)
            return;
        const relNow = daysBetween(plan.baseDate, dateStr) * DAY + Math.round(Number(timeOfDay || 0) * 60);
        this._tickOperationState(svc, plan, relNow);
    }
    _optionalDecisions(plan: RuntimePlan) {
        const out: AnyRecord = {};
        const actions = plan.rotation.actions.filter((a: __KPA158) => a.occurrenceId === plan.occ.id);
        const mandatory = new Set(actions.map((a: { locationOccurrenceId: unknown }) => a.locationOccurrenceId));
        for (const { location: l } of plan.locations) {
            if (l.stopCode !== StopCode.OPTIONAL_C && l.stopCode !== StopCode.OPTIONAL_S)
                continue;
            if (mandatory.has(l.id)) {
                out[l.id] = false;
                continue;
            }
            const key = `${plan.baseDate}|${l.id}`;
            if (!(key in plan.occ.optionalStopDecisions))
                plan.occ.optionalStopDecisions[key] = seededBool(`${plan.rotation.id}|${plan.occ.id}|${key}`);
            out[l.id] = !!plan.occ.optionalStopDecisions[key];
        }
        return out;
    }
    _buildRuntimeRame(plan: RuntimePlan, usable: RuntimeUsableFormation) {
        // v1.1.42 — keep the runtime consist deliberately lightweight. Direct
        // assignments still remember _v2DirectRameId, so the UI can resolve the
        // real Rames-page consist for pictures/name/capacity without attaching all
        // of its catalogue/image metadata to the hot simulation object.
        let details = usable.members.map(({ member: m, vehicle: v }) => this._vehicleDetail(m, v));
        if (plan.occ?.reversed)
            details = details.reverse().map((d: AnyRecord) => ({ ...d, flipped: !Boolean(d.flipped) }));
        return new Rame({ id: `v2rame-${plan.rotation.id}-${plan.occ.id}-${plan.baseDate}`, name: `Formation ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''}`, elementDetails: details, currentLocation: { depotId: '', stationId: '', serviceId: '', lat: null, lon: null } });
    }
    _routeIntegrityProblem(plan: RuntimePlan) {
        const locs = plan?.ver?.locations || [], path = plan?.ver?.outboundPath;
        if (!path || path.error)
            return path?.error || 'Tracé ORM absent.';
        if (Number(path.resolvedRevision || 0) !== Number(path.topologyRevision || 0))
            return 'Tracé ORM périmé par rapport aux gares/voies/VIA.';
        if ((path.legs?.length || 0) !== Math.max(0, locs.length - 1))
            return 'Nombre de liaisons ORM incohérent.';
        const strict = Number(path.topologyRevision || 0) > 0;
        const canonicalPoints = [], canonicalSegments = [];
        let canonicalDistance = 0, previousEnd = null;
        for (let i = 0; i < locs.length - 1; i++) {
            const matches = (path.legs || []).filter((l: { fromLocationId: unknown; toLocationId: unknown }) => l.fromLocationId === locs[i].id && l.toLocationId === locs[i + 1].id);
            if (matches.length !== 1)
                return `Liaison ORM ${locs[i].name || i} → ${locs[i + 1].name || i + 1} absente ou dupliquée.`;
            const leg = matches[0], points = leg.routePoints || [], segments = leg.segments || [];
            if (points.length < 2 || points.some((p: { fallback?: unknown }) => p.fallback))
                return `Liaison ORM ${locs[i].name || i} → ${locs[i + 1].name || i + 1} vide ou synthétique.`;
            if (strict && segments.length !== points.length - 1)
                return `Liaison ORM ${locs[i].name || i} → ${locs[i + 1].name || i + 1} : segments/géométrie désynchronisés.`;
            if (previousEnd && !routePointClose(previousEnd, points[0], 0.002))
                return `Discontinuité ORM avant ${locs[i].name || i}.`;
            let geom = 0, segDist = 0;
            if (strict)
                for (let j = 0; j < segments.length; j++) {
                    const seg = segments[j], d = routeDistanceKm(points[j], points[j + 1]);
                    if (!routePointClose(seg?.from, points[j]) || !routePointClose(seg?.to, points[j + 1]))
                        return `Segment ORM ${j + 1} désynchronisé de sa liaison.`;
                    if (!Number.isFinite(d) || Math.abs(Number(seg?.distanceKm || 0) - d) > 0.003)
                        return `Distance segment ORM ${j + 1} incohérente.`;
                    geom += d;
                    segDist += Number(seg.distanceKm || 0);
                }
            if (strict && (Math.abs(Number(leg.distanceKm || 0) - geom) > 0.005 || Math.abs(Number(leg.distanceKm || 0) - segDist) > 0.005))
                return `Kilométrage de liaison ${locs[i].name || i} → ${locs[i + 1].name || i + 1} incohérent.`;
            for (let j = 0; j < points.length; j++) {
                if (canonicalPoints.length && j === 0)
                    continue;
                canonicalPoints.push(points[j]);
            }
            for (const segment of segments) canonicalSegments.push(segment);
            canonicalDistance += Number(leg.distanceKm || 0);
            previousEnd = points.at(-1);
        }
        if (!strict)
            return '';
        if ((path.routePoints || []).length !== canonicalPoints.length)
            return 'Géométrie globale différente de la concaténation des liaisons.';
        for (let i = 0; i < canonicalPoints.length; i++)
            if (!routePointClose(path.routePoints[i], canonicalPoints[i]) || (String(path.routePoints[i]?.wayId || '') && String(canonicalPoints[i]?.wayId || '') && String(path.routePoints[i].wayId) !== String(canonicalPoints[i].wayId)))
                return `Point global ORM ${i + 1} désynchronisé.`;
        if ((path.segments || []).length !== canonicalSegments.length)
            return 'Segments globaux différents de la concaténation des liaisons.';
        if (Math.abs(Number(path.distanceKm || 0) - canonicalDistance) > 0.005)
            return 'Kilométrage global différent de la somme des liaisons.';
        return '';
    }
    _orderedActions(actions: RotationAction[], rotationId: unknown = '', occurrenceId: unknown = '', locationOccurrenceId: unknown = '') {
        const shared = this.game.rotationV2?.orderedActionsAtLocation?.(rotationId, occurrenceId, locationOccurrenceId);
        if (Array.isArray(shared) && shared.length === actions.length)
            return shared;
        const list = [...actions], byId = new Map<string, RotationAction>(list.map((a) => [a.id, a])), done = new Set<string>(), out: RotationAction[] = [];
        while (out.length < list.length) {
            let progressed = false;
            for (const a of list) {
                if (done.has(a.id))
                    continue;
                const deps = (a.dependsOn || []).filter((id: string) => byId.has(id));
                if (deps.every((id: string) => done.has(id))) {
                    out.push(a);
                    done.add(a.id);
                    progressed = true;
                }
            }
            if (!progressed)
                return list;
        }
        return out;
    }
    _preparedService(svc: ActiveService): boolean {
        return !svc.completed && !svc.cancelled && Number(svc.currentStopIndex || 0) === 0 &&
            ['waiting', 'preparation', 'garage'].includes(svc.state);
    }
    _retirePreparedService(svc: ActiveService): void {
        for (const id of svc._v2VehicleIds || []) {
            const usedElsewhere = (this.game.scheduleCreator.services || []).some((other: ActiveService) => other !== svc && !other.completed && !other.cancelled && other.active && (other._v2VehicleIds || []).includes(id));
            const vehicle = this.game.rotationV2?.getVehicle?.(id);
            if (vehicle && !usedElsewhere) {
                vehicle.available = true;
                if (vehicle._v2OperationOwnerServiceId === svc.id) {
                    vehicle._v2OperationOwnerServiceId = ''; vehicle._v2BusyUntilEpoch = 0;
                }
            }
        }
        this._pendingSnapshots.delete(svc.id);
        this.game.scheduleCreator.removeService(svc.id);
        this.game.scheduleCreator.refreshMovingCache();
    }
    _reconcilePreparedServices(): void {
        const rotations = new Map(this._runtimeRotations().map(r => [r.id, r]));
        for (const svc of [...(this.game.scheduleCreator?.services || [])]) {
            if (!svc._v2OccurrenceId || !this._preparedService(svc)) continue;
            const rotation = rotations.get(svc._v2RotationId);
            const occ = rotation?.occurrences?.find((o: ScheduleOccurrence) => o.id === svc._v2OccurrenceId);
            const version = occ && this.game.scheduleV2?.getVersion?.(occ.scheduleId, occ.versionId);
            if (!rotation?.enabled || !occ || !version || version.state !== ScheduleState.VALID || !this._rotationRuns(rotation, svc._v2BaseDate))
                this._retirePreparedService(svc);
        }
    }
    _compiledInputSignature(plan: RuntimePlan): string {
        const source = plan.sourceVersion || plan.ver;
        return JSON.stringify({version: source.id, state: source.state, revision: source.outboundPath?.resolvedRevision,
            times: plan.locations.map(x => [x.location.id, x.arrivalSec, x.departureSec, x.location.track]),
            legs: (source.outboundPath?.legs || []).map(l => [l.id, l.routeInputKey, l.physicsRouteKey, l.routePoints?.length, l.distanceKm]),
            profile: plan.ver.performanceProfile, formation: plan.occ.formation, reversed: plan.occ.reversed,
            operations: (plan.rotation.actions || []).filter(a => a.occurrenceId === plan.occ.id),
            directRame: plan.rotation._directRameId || plan.rotation.assignedRameId || ''});
    }
    _compile(plan: RuntimePlan) {
        const serviceId = `v2:${plan.rotation.id}:${plan.occ.id}:${plan.baseDate}`;
        const existing = this.game.scheduleCreator.services.find((s: ActiveService) => s.id === serviceId);
        const signature = this._compiledInputSignature(plan);
        if (existing) {
            if (!this._preparedService(existing) || existing._v2CompiledSignature === signature) return;
            this._retirePreparedService(existing);
        }
        if (plan.error || !plan.ver)
            return;
        if (this.game.seasonal && !this.game.seasonal.isServiceActive(plan.occ.scheduleId))
            return;
        const routeProblem = this._routeIntegrityProblem(plan);
        if (routeProblem) {
            this._pushAlert('ERROR', 'V2_ROUTE_INVALID', `Train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} non compilé : ${routeProblem}`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate });
            return;
        }
        if (plan.occ?.currentTimingMismatchSignature) {
            this._pushAlert('WARNING', 'TIMING_MISMATCH_AUTO_RECALCULATED', `Train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} : le matériel réel allonge la marche. Départ autorisé et temps de marche recalculé automatiquement.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Le train part à son heure résolue ; les circulations suivantes du roulement sont repoussées si nécessaire.' });
        }
        const formationIssues = [
            ...(this.game.rotationV2?._validateCategoryComposition?.(plan.occ, plan.sourceVersion || plan.ver) || []),
            ...(this.game.rotationV2?._validateFormationThroughActions?.(plan.rotation, plan.occ, plan.sourceVersion || plan.ver) || []),
        ];
        const fatalFormation = formationIssues.find((i: { level: unknown }) => i.level === 'ERROR');
        if (fatalFormation) {
            this._pushAlert('ERROR', fatalFormation.code || 'ROTATION_FORMATION_INVALID', `Train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} non compilé : ${fatalFormation.message}`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Corriger les opérations de composition du roulement avant circulation.' });
            return;
        }
        const pending = this._pendingSnapshots.get(serviceId);
        // HOTFIX82 — an old runtime snapshot can still identify the correct physical
        // formation, but only a genuinely fresh F5 snapshot may restore an exact
        // historical position. Older saves are reconstructed from today's timetable.
        const relevantSnapshot = pending && this._snapshotCanRestore(plan, pending, Number(plan._relNow)) ? pending : null;
        const exactRestoreSnapshot = relevantSnapshot && this._snapshotCanExactRestore(plan, relevantSnapshot, Number(plan._relNow)) ? relevantSnapshot : null;
        const usable = this._usableMembers(plan, relevantSnapshot, serviceId);
        if (usable.notReady)
            return;
        if (usable.missingLead) {
            this._pushAlert('ERROR', 'NO_TRACTION', `Train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} annulé : locomotive/engin titulaire absent.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Affecter un engin de traction au roulement ou prévoir son acheminement explicite.' });
            return;
        }
        const electricProblem = this._electricalProblem(plan, usable);
        const gaugeProblem = this._gaugeProblem(plan, usable);
        const physicalProblem = electricProblem || gaugeProblem;
        if (physicalProblem) {
            this._pushAlert('ERROR', 'PHYSICAL_INCOMPATIBILITY', `Train ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} ne part pas : ${physicalProblem}`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Modifier l’itinéraire ou affecter un matériel compatible. Une traction diesel ignore l’électrification mais pas l’écartement/gabarit connu.' });
            return;
        }
        const rame = this._buildRuntimeRame(plan, usable);
        const rec = this.game.scheduleV2.getSchedule(plan.occ.scheduleId);
        if (plan.occ.reversed && !relevantSnapshot) {
            const cab = assessTurnback(rame.elementDetails,false);
            if (!cab.allowed) {
                this._pushAlert('ERROR','TURNBACK_FORMATION_INCOMPATIBLE',`${rec?.number || ''} : ${cab.reason}`,{rotationId:plan.rotation.id,occurrenceId:plan.occ.id,baseDate:plan.baseDate});
                return;
            }
        }
        const stopCodeMap: AnyRecord = { C: 'C', S: 'S', OPTIONAL_C: '[C]', OPTIONAL_S: '[S]', NONE: '' };
        const stops = [];
        for (const { location: l, arrivalSec, departureSec } of plan.locations) {
            let v2OperationSec = 0;
            try {
                v2OperationSec = this.game.rotationV2.operationWindowSec(plan.rotation.id, plan.occ.id, l.id) || 0;
            }
            catch (err) {
                this._pushAlert('ERROR', 'OPERATION_DEPENDENCY_INVALID', (err as { message?: string }).message as string, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate });
                return;
            }
            stops.push({
                stationId: l.stationId || l.technicalLocationId || '', type: 'arret', arrivalTime: (arrivalSec ?? departureSec ?? 0) / 60, departureTime: (departureSec ?? arrivalSec ?? 0) / 60,
                voiePointId: l.track.voiePointId || null, trackIdentity: stationTrackIdentityFromBinding(l.track), platform: l.track.displayName, stopCode: stopCodeMap[l.stopCode] || '', lat: l.track.snapLat ?? l.track.lat, lon: l.track.snapLon ?? l.track.lon,
                locationOccurrenceId: l.id, technicalLocationId: l.technicalLocationId || '', locationName: l.name, v2OperationSec, turnBack:!!l.turnBack,
            });
        }
        const routes = [];
        for (let i = 0; i < plan.ver.locations.length - 1; i++) {
            const a = plan.ver.locations[i], b = plan.ver.locations[i + 1];
            const leg = plan.ver.outboundPath?.legs?.find((x: { fromLocationId: unknown; toLocationId: unknown }) => x.fromLocationId === a.id && x.toLocationId === b.id);
            if (!leg || !Array.isArray(leg.routePoints) || leg.routePoints.length < 2) {
                this._pushAlert('ERROR', 'ROUTE_INVALID', `Train ${rec?.number || ''} non compilé : liaison ORM ${a.name || i + 1} → ${b.name || i + 2} absente ou incomplète.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Recalculer puis revalider l’horaire. Aucun trajet synthétique ne sera utilisé.' });
                return;
            }
            // HOTFIX8 — canonical Schedule leg geometry is immutable between route edits.
            // Share it with the ephemeral V2 service instead of copying a continental
            // route again during every runtime sync / timetable-only edit.
            routes.push(leg.routePoints);
        }
        const svc = this.game.scheduleCreator.addService({
            id: serviceId, name: rec?.name || String(rec?.number || 'Train'), number: rec?.number || '', rameId: rame.id,
            stops, routes, roundTrip: false, multiDepartures: 1, serviceType: serviceType(plan.ver.category), active: true,
            v2OccurrenceId: plan.occ.id, v2RotationId: plan.rotation.id, v2BaseDate: plan.baseDate,
            v2DirectAssignmentId: plan.rotation._directAssignmentId || '',
            optionalStopDecisions: this._optionalDecisions(plan), allowEarlyDeparture: plan.ver.category !== TrainCategory.PASSENGER,
        }, rame, this.game.world);
        svc._v2CompiledSignature = signature;
        svc._v2ScheduleId = plan.occ.scheduleId || '';
        svc._v2DirectAssignmentId = plan.rotation._directAssignmentId || '';
        svc._v2DirectRameId = plan.rotation._directRameId || '';
        svc._v2AssignedRameId = plan.rotation.assignedRameId || '';
        svc._v2VehicleIds = usable.members.map((x) => x.vehicle.id);
        svc._v2FormationMembers = usable.members.map((x) => ({ vehicleId: x.vehicle.id, role: x.member.role }));
        svc._v2FormationReversed = !!plan.occ?.reversed;
        svc._v2BrakeServiceMs2 = Math.max(0.1, Number(plan.ver?.performanceProfile?.brakeServiceMs2 || 0.9));
        svc._v2PlannedStartSec = plan.startSec;
        svc._v2PlannedEndSec = plan.endSec;
        svc._currentDate = plan.baseDate;
        // v1.1.35 — a compiled V2 train must be visible immediately on the Livemap.
        // Compilation already means the physical formation is reserved for this run;
        // keeping position=null until T-1 made a perfectly valid train look nonexistent.
        const originStop = svc.stops?.[0];
        let originLat = Number(originStop?.lat), originLon = Number(originStop?.lon);
        if (!Number.isFinite(originLat) || !Number.isFinite(originLon)) {
            const rp = routes?.[0]?.[0];
            originLat = Number(rp?.lat);
            originLon = Number(rp?.lon);
        }
        if (Number.isFinite(originLat) && Number.isFinite(originLon)) {
            svc.position = { lat: originLat, lon: originLon };
            const originStation = originStop?.stationId ? this.game.world?.getStationById?.(originStop.stationId) : null;
            svc.train.stoppedAt = originStation || { id: originStop?.stationId || '', name: originStop?.locationName || '', lat: originLat, lon: originLon };
            svc.train.platform = originStop?.platform || '';
            svc.speed = 0;
            svc.train.speed = 0;
            if (svc._v2DirectRameId) {
                const rr = this.game.rameManager?.getById?.(svc._v2DirectRameId);
                if (rr)
                    rr.currentLocation = { ...materialTrackLocation(originStop), depotId: '', stationId: originStop?.stationId || '', serviceId: svc.id, lat: originLat, lon: originLon };
            }
            if (svc._v2AssignedRameId) {
                const rr = this.game.rameManager?.getById?.(svc._v2AssignedRameId);
                if (rr)
                    rr.currentLocation = { ...materialTrackLocation(originStop), depotId: '', stationId: originStop?.stationId || '', serviceId: svc.id, lat: originLat, lon: originLon };
            }
        }
        else {
            this._pushAlert('ERROR', 'V2_ORIGIN_POSITION_MISSING', `Train ${rec?.number || ''} compilé sans position de départ exploitable.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: 'Re-sélectionner la voie de départ dans l’horaire puis revalider.' });
        }
        // A successful compile supersedes stale missed-window/not-compiled alerts for
        // this exact occurrence, otherwise the diagnostics keep reporting a ghost fault.
        this.alerts = this.alerts.filter((a) => !(a.rotationId === plan.rotation.id && a.occurrenceId === plan.occ.id && ['V2_RUNTIME_WINDOW_MISSED', 'OCCURRENCE_NOT_COMPILED'].includes(a.code)));
        if (plan.preDepartureOperationSec > 0) {
            const prepStartedAt = Math.max(Number(plan.prepStartSec || plan.startSec), Number(plan._relNow ?? plan.prepStartSec ?? plan.startSec));
            svc._v2PrepReadyMinute = Math.max(plan.startSec, prepStartedAt + plan.preDepartureOperationSec) / 60;
        }
        svc._v2OnArrive = (stop: RuntimeStop, _station: unknown, timeOfDay: unknown) => {
            const date = svc._currentDate || plan.baseDate;
            const relNow = daysBetween(plan.baseDate, date) * DAY + Math.round(Number(timeOfDay || 0) * 60);
            this._beginActionsAtStop(svc, plan, stop, relNow, false);
        };
        svc._v2OnOperationTick = (date: unknown, timeOfDay: unknown) => this._operationTickForService(svc, plan, date || svc._currentDate || plan.baseDate, timeOfDay);
        for (const { vehicle: v } of usable.members)
            v.available = false;
        const restoreNowMin = Number.isFinite(Number(plan._relNow)) ? Number(plan._relNow) / 60 : null;
        const restored = exactRestoreSnapshot ? this._restoreSnapshot(svc, restoreNowMin) : false;
        let catchup = null;
        if (!restored && Number(plan._relNow) > Number(plan.startSec) + 1) {
            catchup = this._catchUpFreshCompile(svc, plan, Number(plan._relNow), relevantSnapshot);
            if (catchup) {
                this._pendingSnapshots.delete(serviceId);
                this._pushAlert('INFO', 'V2_RELOAD_TIMETABLE_CATCHUP', `Train ${rec?.number || ''} reconstruit à sa position horaire actuelle après rechargement.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate });
            }
        }
        // Origin operations run on their real pre-departure timeline. A restored or
        // timetable-caught-up service must never replay its origin preparation.
        if (!restored && !catchup && stops[0])
            this._beginActionsAtStop(svc, plan, stops[0], Number(plan._relNow ?? plan.prepStartSec ?? plan.startSec), true);
        else if (restored && svc._v2OperationState)
            this._tickOperationState(svc, plan, Number(plan._relNow ?? plan.startSec));
        else if (catchup?.mode === 'station' && stops[catchup.stopIndex])
            this._beginActionsAtStop(svc, plan, stops[catchup.stopIndex], Number(plan._relNow ?? plan.startSec), false);
        // A newly compiled train that is already drawn at its origin is physically
        // present there. Reserve its exact platform/track immediately instead of
        // waiting for the first movement tick, otherwise another service may be
        // admitted onto the same origin while this consist is visibly standing there.
        if (!restored && !catchup && svc.position && originStop?.stationId) {
            const originStation = this.game.world?.getStationById?.(originStop.stationId)
                || { id: originStop.stationId, name: originStop.locationName || '', lat: originLat, lon: originLon, platforms: 2 };
            const reserved = svc._reserveArrivalResources?.(originStation, originStop) !== false;
            const footprint = reserved ? (svc._reserveOriginSafetyFootprint?.() !== false) : false;
            if (!reserved || !footprint) {
                svc._movementStop?.('ORIGIN_RESOURCE', svc.train.delayReason || 'attente voie libre au départ', 'v2-runtime');
                svc.train.delayReason = svc.train.delayReason || 'attente voie libre au départ';
            }
        }
    }
    _pruneSeasonallyInactive() {
        const seasonal = this.game.seasonal;
        if (!seasonal)
            return;
        for (const svc of this.game.scheduleCreator?.services || []) {
            if (!svc?._v2OccurrenceId || !svc._v2ScheduleId || svc.completed || svc.cancelled)
                continue;
            if (['moving', 'departing', 'stopped_at_station'].includes(svc.state) && Number(svc.currentStopIndex || 0) > 0)
                continue; // a train already in service finishes normally
            if (seasonal.isServiceActive(svc._v2ScheduleId))
                continue;
            svc._releaseAllPhysicalResources?.();
            svc.cancelled = true;
            svc.completed = true;
            svc.state = 'cancelled';
            if (svc.train) {
                svc.train.state = 'cancelled';
                svc.train.speed = 0;
                svc.train.stoppedAt = null;
            }
            svc.speed = 0;
            svc.position = null;
        }
        this.game.scheduleCreator?._invalidateActiveCache?.();
    }
    _finalizeServices(dateStr: unknown, timeOfDay: number) {
        for (const svc of this.game.scheduleCreator.services) {
            if (!svc._v2OccurrenceId || svc._v2MaterialFinalized)
                continue;
            const relSec = daysBetween(svc._v2BaseDate, dateStr) * DAY + Math.round(Number(timeOfDay || 0) * 60);
            if (svc.state === 'blocked_route' && svc.position) continue;
            const terminal = svc.state === 'cancelled' || svc.state === 'blocked_route' || (svc.completed && relSec >= Number(svc._v2PlannedEndSec || 0));
            if (!terminal)
                continue;
            if (svc.state === 'blocked_route') {
                // A blocked-route service is terminal from the interlocking point of view.
                // Keep its diagnostic marker visible, but never let it poison subsequent
                // departures with stale platform/voie/troncon/canton reservations.
                svc._releaseAllPhysicalResources?.();
                this._pushAlert('ERROR', 'BLOCKED_ROUTE', `Train ${svc.number || svc.name || ''} bloqué : tracé ORM runtime absent. Le matériel et les réservations physiques sont libérés pour ne pas empoisonner le roulement.`, { rotationId: svc._v2RotationId, occurrenceId: svc._v2OccurrenceId, baseDate: svc._v2BaseDate, suggestion: 'Réparer/revalider l’horaire ; le train bloqué reste visible sur la Livemap pour diagnostic.' });
            }
            const stops = svc.getCurrentStops?.() || svc.stops || [];
            const finishedNormally = svc.completed && svc.state !== 'cancelled' && svc.state !== 'blocked_route';
            const currentIdx = Math.max(0, Math.min(Math.max(0, stops.length - 1), Number(svc.currentStopIndex || 0)));
            const target = finishedNormally ? stops[stops.length - 1] : (stops[currentIdx] || stops[0]);
            // HOTFIX33 — permanent odometers follow the same physical material windows
            // as the rolling-duty sheet.  Do not give the whole service distance to a
            // locomotive attached halfway, and do not lose the kilometres of a coupon
            // detached before the terminal.
            if (finishedNormally && svc._v2RotationId && svc._v2OccurrenceId) {
                const rot = this.game.rotationV2.getRotation?.(svc._v2RotationId), occ = rot?.occurrences?.find((o: { id: unknown }) => o.id === svc._v2OccurrenceId);
                const ver = occ ? this.game.scheduleV2.getVersion?.(occ.scheduleId, occ.versionId) : null;
                const intervals = occ ? this.game.rotationV2.materialIntervals?.(rot.id, occ.id, null, svc._v2PlannedStartSec) : [];
                const kmByVehicle = new Map();
                for (const iv of intervals || []) {
                    const km = this.game.rotationV2.materialIntervalDistanceKm?.(rot.id, occ.id, iv, ver) || 0;
                    if (Number.isFinite(Number(km)) && Number(km) > 0)
                        kmByVehicle.set(iv.vehicleId, Number(kmByVehicle.get(iv.vehicleId) || 0) + Number(km));
                }
                for (const [id, km] of kmByVehicle) {
                    const v = this.game.rotationV2.getVehicle(id);
                    if (v)
                        v.odometerKm = Math.max(0, Number(v.odometerKm || 0)) + Math.max(0, Number(km || 0));
                }
            }
            for (const id of svc._v2VehicleIds || []) {
                const v = this.game.rotationV2.getVehicle(id);
                if (!v)
                    continue;
                v.available = true;
                if (finishedNormally) v.location = { ...materialTrackLocation(target), kind: target?.stationId ? 'STATION' : 'TECHNICAL', id: target?.stationId || target?.technicalLocationId || '', lat: svc.position?.lat ?? target?.lat ?? null, lon: svc.position?.lon ?? target?.lon ?? null };
                else if (svc.position) {
                    // Cancellation must not place material at its NEXT booked stop
                    // (nor back at the origin). A stranded line position requires
                    // an explicit recovery; a real occupied station retains its track.
                    const occupied = String((svc.train.stoppedAt as {id?:unknown}|null)?.id || '');
                    const actual = stops.find((st: RuntimeStop) => String(st.locationOccurrenceId || '') === String(svc._v2OperationState?.locationOccurrenceId || '') && String(st.stationId || '') === occupied)
                        || stops[Math.max(0, currentIdx - 1)];
                    const parked = occupied && String(actual?.stationId || '') === occupied;
                    v.location = {...(parked ? materialTrackLocation(svc.rame?.currentLocation || actual) : {}), kind:parked ? 'STATION':'TECHNICAL', id:parked ? occupied : `stranded:${svc.id}`, lat:svc.position.lat,lon:svc.position.lon};
                }
            }
            if (finishedNormally && svc._v2DirectRameId) {
                const rr = this.game.rameManager?.getById?.(svc._v2DirectRameId);
                if (rr)
                    rr.currentLocation = { ...materialTrackLocation(target), depotId: '', stationId: target?.stationId || '', serviceId: '', lat: svc.position?.lat ?? target?.lat ?? null, lon: svc.position?.lon ?? target?.lon ?? null };
            }
            if (finishedNormally && svc._v2AssignedRameId) {
                const rr = this.game.rameManager?.getById?.(svc._v2AssignedRameId);
                if (rr)
                    rr.currentLocation = { ...materialTrackLocation(target), depotId: '', stationId: target?.stationId || '', serviceId: '', lat: svc.position?.lat ?? target?.lat ?? null, lon: svc.position?.lon ?? target?.lon ?? null };
            }
            svc._v2MaterialFinalized = true;
        }
        // Runtime services are reproducible from rotations; prune old completed ones.
        this.game.scheduleCreator.services = this.game.scheduleCreator.services.filter((s: unknown[]) => {
            if (!s._v2OccurrenceId || !s._v2MaterialFinalized)
                return true;
            const rel = daysBetween(s._v2BaseDate, dateStr) * 1440 + timeOfDay;
            const last = s.stops?.at(-1)?.arrivalTime ?? 0;
            return rel <= last + 1440;
        });
        this.game.scheduleCreator._invalidateActiveCache?.();
    }
    _snapshotRouteRef(svc: { routes: unknown; _returnRoutes: unknown }, route: unknown) {
        if (!Array.isArray(route) || route.length < 2)
            return null;
        const fi = Array.isArray(svc.routes) ? svc.routes.indexOf(route) : -1;
        if (fi >= 0)
            return { s: 'f', i: fi };
        const ri = Array.isArray(svc._returnRoutes) ? svc._returnRoutes.indexOf(route) : -1;
        if (ri >= 0)
            return { s: 'r', i: ri };
        return null;
    }
    _snapshotRouteFromRef(svc: __S3Struct1116, ref: __S3Struct1117 | null | undefined, fallback: unknown = null) {
        if (ref && Number.isInteger(Number(ref.i))) {
            const i = Number(ref.i);
            const route = ref.s === 'r' ? svc._returnRoutes?.[i] : svc.routes?.[i];
            if (Array.isArray(route) && route.length >= 2)
                return route;
        }
        return Array.isArray(fallback) && fallback.length >= 2 ? fallback : null;
    }
    _compactSnapshotRoute(route: unknown) {
        if (!Array.isArray(route) || route.length < 2)
            return null;
        return route.map((p: { lat: unknown; lon: unknown; wayId: unknown; maxSpeed: unknown; speedSource: unknown; incline: unknown; grade: unknown; electrified: unknown; voltage: unknown; frequency: unknown; gauge: unknown }) => {
            const q: AnyRecord = { lat: Number(p.lat), lon: Number(p.lon) };
            if (p.wayId != null)
                q.wayId = p.wayId;
            if (p.maxSpeed != null)
                q.maxSpeed = p.maxSpeed;
            if (p.speedSource != null)
                q.speedSource = p.speedSource;
            if (p.incline != null)
                q.incline = p.incline;
            if (p.grade != null)
                q.grade = p.grade;
            if (p.electrified != null)
                q.electrified = p.electrified;
            if (p.voltage != null)
                q.voltage = p.voltage;
            if (p.frequency != null)
                q.frequency = p.frequency;
            if (p.gauge != null)
                q.gauge = p.gauge;
            return q;
        });
    }
    _snapshotCanRestore(plan: RuntimePlan, snap: { id?: unknown; state: unknown; delay: unknown }, relNow: number) {
        if (!plan || !snap || !Number.isFinite(Number(relNow)))
            return false;
        if (snap.id && this.game.depotManager?.ownsServiceMovement?.(snap.id)) return true;
        const state = String(snap.state || 'waiting');
        const savedAt = Number(this._snapshotCapturedAtUnixSec || 0);
        const nowUnix = Math.floor((this.game.engine?.getSimulationEpochMs?.() ?? Date.now()) / 1000);
        const fresh = savedAt > 0 && Math.abs(nowUnix - savedAt) <= 300;
        // Old (<=1.1.53) snapshots have no capture timestamp. They may restore only
        // while the circulation is still inside its published operating window.
        if (!fresh)
            return relNow >= Number(plan.prepStartSec ?? plan.startSec) - 300 && relNow <= Number(plan.endSec);
        const lateSec = Math.max(0, Number(snap.delay || 0) * 60);
        const moving = ['moving', 'departing', 'stopped_at_station'].includes(state);
        // A fresh F5 may preserve a legitimately delayed train after booked arrival,
        // but only as far as its already-recorded delay can plausibly explain.
        const latest = moving ? Number(plan.endSec) + lateSec + 300 : Number(plan.endSec);
        return relNow >= Number(plan.prepStartSec ?? plan.startSec) - 300 && relNow <= latest;
    }
    _snapshotCanExactRestore(plan: RuntimePlan, snap: { id?: unknown; state: unknown; delay: unknown }, relNow: number) {
        if (!this._snapshotCanRestore(plan, snap, relNow))
            return false;
        if (snap.id && this.game.depotManager?.ownsServiceMovement?.(snap.id)) return true;
        const savedAt = Number(this._snapshotCapturedAtUnixSec || 0);
        if (!(savedAt > 0))
            return false;
        return Math.abs(Math.floor((this.game.engine?.getSimulationEpochMs?.() ?? Date.now()) / 1000) - savedAt) <= 300;
    }
    _routeLengthKm(route: unknown) {
        if (!Array.isArray(route) || route.length < 2)
            return 0;
        let km = 0;
        for (let i = 1; i < route.length; i++) {
            const d = routeDistanceKm(route[i - 1], route[i]);
            if (Number.isFinite(d))
                km += d;
        }
        return km;
    }
    _catchUpFreshCompile(svc: ActiveServiceLike, plan: RuntimePlan, relNowSec: unknown, staleSnap: Record<string, unknown> | null = null) {
        const now = Number(relNowSec);
        if (!svc || !plan || !Number.isFinite(now) || now < Number(plan.startSec) - 1)
            return null;
        const stops = svc.stops || [], locs = plan.locations || [], routes = svc.routes || [];
        if (stops.length < 2 || locs.length < 2)
            return null;
        const oldFields: Record<string, unknown> = {};
        const record = svc as unknown as Record<string, unknown>;
        for (const key of ['position','speed','targetSpeed','state','currentStopIndex','delay','totalDistance','_state','_adjustedStops','_platformAssignment','_departureResourceHold','_stationaryRoute','_stationaryRouteIndex','_cantonAssignments','_carryoverCantonIds','_carryoverStartTravelKm','_passageTailSpeedHolds','_brakeEffort','_tractiveEffort','_lastPhysicsDecelMs2']) {
            const value = record[key];
            oldFields[key] = key === '_passageTailSpeedHolds' ? normalizePassageTailSpeedHolds(value)
                : key === '_state' && value ? { ...(value as Record<string,unknown>) } : value;
        }
        const oldTrain = { ...svc.train };
        const rollback = () => {
            svc._releaseAllPhysicalResources?.();
            Object.assign(svc, oldFields); Object.assign(svc.train, oldTrain);
            const assignment = svc._platformAssignment;
            if (assignment) {
                const station = this.game.world?.getStationById?.(assignment.stationId) || svc.train.stoppedAt || svc.getTargetStation?.();
                const stop = (svc.getCurrentStops?.() || []).find(s => s.stationId === assignment.stationId);
                svc._platformAssignment = null;
                if (station && stop) svc._reserveArrivalResources?.(station, stop);
            }
            if (svc.state === 'moving' && svc._state?.cachedRoute) svc._syncCantonFootprint?.(svc._state.cachedRoute);
            else if (svc.state === 'stopped_at_station') svc._restoreStationarySafetyFootprint?.();
            else if (svc.position) svc._reserveOriginSafetyFootprint?.();
            svc.speed = 0; svc.train.speed = 0;
            svc._movementStop?.('RELOAD_CATCHUP_CONFLICT', 'reprise sauvegarde : ressource occupée', 'reload');
            svc.train.delayReason = 'reprise sauvegarde : ressource occupée';
            return { mode: 'blocked', stopIndex: Number(oldFields.currentStopIndex || 0), distanceKm: Number(oldFields.totalDistance || 0) };
        };
        const legLengths = routes.map((r: unknown) => this._routeLengthKm(r));
        const prefix = [0];
        for (let i = 0; i < legLengths.length; i++)
            prefix[i + 1] = prefix[i] + Number(legLengths[i] || 0);
        const setDistance = (km: unknown) => {
            const d = Math.max(Number(staleSnap?.totalDistance || 0), Math.max(0, Number(km || 0)));
            svc.totalDistance = d;
            if (svc.train)
                svc.train.totalKm = d;
        };
        const updateRameLocation = () => {
            for (const rid of [svc._v2DirectRameId, svc._v2AssignedRameId].filter(Boolean)) {
                const rr = this.game.rameManager?.getById?.(rid);
                if (rr)
                    rr.currentLocation = { ...materialTrackLocation(svc.state === 'stopped_at_station' ? stops[Math.max(0,svc.currentStopIndex - 1)] : null), depotId: '', stationId: ((svc.train?.stoppedAt as { id?: unknown } | null)?.id || ''), serviceId: svc.id, lat: svc.position?.lat ?? null, lon: svc.position?.lon ?? null };
            }
        };
        // If reload lands inside an intermediate booked dwell, reconstruct the train
        // physically at that station. At the exact departure second the moving-leg
        // branch below wins, so Paris→Lyon→Marseille can resume from Lyon directly.
        for (let i = 1; i < locs.length; i++) {
            const arr = Number(locs[i].arrivalSec ?? locs[i].departureSec);
            const dep = Number(locs[i].departureSec ?? locs[i].arrivalSec);
            if (!Number.isFinite(arr) || !Number.isFinite(dep))
                continue;
            if (now + 1e-6 < arr || now >= dep - 1e-6)
                continue;
            const stop = stops[i];
            if (!stop)
                continue;
            const lat = Number(stop.lat), lon = Number(stop.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon))
                continue;
            svc._releaseAllPhysicalResources?.();
            svc._resetState?.();
            svc.position = { lat, lon };
            svc.speed = 0;
            svc.train.speed = 0;
            svc.state = 'stopped_at_station';
            svc.train.state = 'stopped_at_station';
            svc.currentStopIndex = Math.min(stops.length, i + 1);
            svc.delay = 0;
            svc.train.delay = 0;
            svc.train.delayReason = '';
            const station = stop.stationId ? (this.game.world?.getStationById?.(stop.stationId) || { id: stop.stationId, name: stop.locationName || '', lat, lon, platforms: 2 }) : { id: '', name: stop.locationName || '', lat, lon, platforms: 2 };
            svc.train.stoppedAt = station;
            svc.train.platform = stop.platform || '';
            svc.train._stoppedSinceGameTime = arr / 60;
            svc._platformAssignment = null; // A requested platform is not an acquired reservation.
            if (i > 0) {
                const previousRoute = routes[i - 1];
                if (Array.isArray(previousRoute)) {
                    svc._stationaryRoute = previousRoute;
                    svc._stationaryRouteIndex = Math.max(0, previousRoute.length - 2);
                }
            }
            if (svc._reserveArrivalResources?.(station, stop) === false || svc._restoreStationarySafetyFootprint?.() === false)
                return rollback();
            svc._brakeEffort = 0; svc._tractiveEffort = 0;
            setDistance(prefix[i] || 0);
            updateRameLocation();
            this.game.scheduleCreator?._invalidateActiveCache?.();
            return { mode: 'station', stopIndex: i, distanceKm: prefix[i] || 0 };
        }
        // Otherwise reconstruct the booked position inside the current leg. This is
        // timetable interpolation, not teleporting from the origin after a long save gap.
        for (let i = 0; i < locs.length - 1; i++) {
            const dep = Number(locs[i].departureSec ?? locs[i].arrivalSec);
            const arr = Number(locs[i + 1].arrivalSec ?? locs[i + 1].departureSec);
            if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep)
                continue;
            if (now < dep - 1e-6 || now >= arr - 1e-6)
                continue;
            const route = routes[i];
            if (!Array.isArray(route) || route.length < 2)
                continue;
            const frac = Math.max(0, Math.min(1, (now - dep) / (arr - dep)));
            svc._releaseAllPhysicalResources?.();
            svc.position = { lat: Number(route[0].lat), lon: Number(route[0].lon) };
            svc.currentStopIndex = i + 1;
            svc.state = 'moving';
            svc.train.state = 'moving';
            svc.train.stoppedAt = null;
            svc.train.platform = null;
            svc._platformAssignment = null;
            svc.delay = 0;
            svc.train.delay = 0;
            svc.train.delayReason = '';
            svc._adjustedStops = svc._buildAdjustedStops?.() || null;
            svc._resetState?.();
            const legKey = `${svc.currentStopIndex}-${svc.isReturnLeg ? 1 : 0}`;
            svc._initializeState?.(route, legKey);
            const totalKm = Number(legLengths[i] || 0);
            svc._setRouteProgressKm?.(route, totalKm * frac);
            const averageKmh = totalKm > 0 ? totalKm / ((arr - dep) / 3600) : 0;
            const resolvedSpeeds = svc._resolvedRouteSpeeds?.(route) || [];
            const pointIndex = Math.max(0, Math.min(route.length - 1, Number(svc._state?.index || 0) + 1));
            const pointLimit = Number(resolvedSpeeds[pointIndex] ?? svc.train.maxSpeed ?? 0);
            svc._brakeEffort = 0; svc._tractiveEffort = 0;
            const edge = Math.min(1, Math.sqrt(Math.max(0, frac) / 0.08), Math.sqrt(Math.max(0, 1 - frac) / 0.08));
            const estimated = Math.max(0, Math.min(Number(svc.train.maxSpeed || 300), Number.isFinite(pointLimit) && pointLimit > 0 ? pointLimit : Infinity, Math.max(20, averageKmh * 1.15)) * edge);
            svc.speed = estimated;
            svc.train.speed = Math.round(estimated);
            const footprintOk = svc._syncCantonFootprint?.(route);
            if (footprintOk === false) return rollback();
            setDistance((prefix[i] || 0) + totalKm * frac);
            updateRameLocation();
            this.game.scheduleCreator?._invalidateActiveCache?.();
            return { mode: 'moving', stopIndex: i, distanceKm: (prefix[i] || 0) + totalKm * frac };
        }
        return null;
    }
    toSave() {
        const services = this.game.scheduleCreator?.services || [];
        const busyVehicles = (this.game.rotationV2?.vehicles || []).filter((v: { _v2BusyUntilEpoch: unknown }) => Number(v._v2BusyUntilEpoch || 0) > 0).map((v: { id: unknown; _v2BusyUntilEpoch: unknown }) => ({ id: v.id, busyUntilEpoch: Number(v._v2BusyUntilEpoch) }));
        return { schemaVersion: RUNTIME_SAVE_SCHEMA, capturedAtUnixSec: Math.floor((this.game.engine?.getSimulationEpochMs?.() ?? Date.now()) / 1000), busyVehicles, services: services.filter((s: { _v2OccurrenceId: unknown; _v2MaterialFinalized: unknown }) => s._v2OccurrenceId && !s._v2MaterialFinalized).map((s: ActiveServiceLike) => ({
                id: s.id, rotationId: s._v2RotationId, occurrenceId: s._v2OccurrenceId, baseDate: s._v2BaseDate,
                state: s.state, currentStopIndex: Number(s.currentStopIndex || 0), isReturnLeg: !!s.isReturnLeg,
                position: s.position ? { lat: Number(s.position.lat), lon: Number(s.position.lon) } : null,
                speed: Number(s.speed || 0), delay: Number(s.delay || 0), completed: !!s.completed, cancelled: !!s.cancelled,
                stateIndex: Number(s._state?.index || 0), stateProgress: Number(s._state?.progress || 0), legKey: s._state?.legKey || null,
                macroElapsed: { medium: Number(s._macroElapsed?.medium || 0), low: Number(s._macroElapsed?.low || 0) },
                nextDepartureTime: s._nextDepartureTime ?? null, atTerminus: !!s._atTerminus,
                onboardPax: Number(s._onboardPax || 0), onboardFreight: Number(s._onboardFreight || 0),
                onboardPassengerKm: Number(s._onboardPassengerKm || 0),
                contractFreight: Number(s._contractFreight || 0), contractCargoId: s._contractCargoId || s.assignedContractId || '', contractDelivered: Number(s._contractDelivered || 0), genericCargoType: s._genericCargoType || '', 
                blockedSinceGameTime: s._blockedSinceGameTime ?? null,
                stoppedSinceGameTime: s.train?._stoppedSinceGameTime ?? null,
                platformAssignment: s._platformAssignment ? { ...s._platformAssignment, trackIdentity: normalizeStationTrackIdentity(s._platformAssignment.trackIdentity) } : null,
                passageTailSpeedHolds: (s._passageTailSpeedHolds || []).map(h => ({ ...h })),
                totalDistance: Number(s.totalDistance || 0), brakeEffort: Number(s._brakeEffort || 0), tractiveEffort: Number(s._tractiveEffort || 0), physicsDecelMs2: Number(s._lastPhysicsDecelMs2 || 0),
                departureResourceHold: s._departureResourceHold ? { ...s._departureResourceHold, trackIdentity: normalizeStationTrackIdentity(s._departureResourceHold.trackIdentity) } : null,
                stationaryRouteRef: this._snapshotRouteRef(s, s._stationaryRoute),
                stationaryRouteFallback: this._snapshotRouteRef(s, s._stationaryRoute) ? null : this._compactSnapshotRoute(s._stationaryRoute),
                randomDepartureKey: s._v2RandomDepartureKey || '',
                vehicleIds: [...(s._v2VehicleIds || [])], formationMembers: (s._v2FormationMembers || []).map((x: RuntimeFormationMember) => ({ ...x })),
                operationState: s._v2OperationState ? structuredClone(s._v2OperationState) : null,
                turnbackState:normalizeTurnbackState(s._turnbackState),formationReversed:!!s._v2FormationReversed,
                train: {
                    speed: Number(s.train?.speed || 0), delay: Number(s.train?.delay || 0), state: s.train?.state || '',
                    delayReason: s.train?.delayReason || '',
                    breakdown: s.train?.breakdown ? { ...s.train.breakdown } : null,
                    incident: s.train?.incident ? { ...s.train.incident } : null,
                    inMaintenance: !!s.train?.inMaintenance,
                    incidentDelayReasons: Array.isArray(s.train?.incidentDelayReasons)
                        ? s.train.incidentDelayReasons.map((r: Record<string, unknown>) => ({ ...r }))
                        : [],
                },
            })) };
    }
    loadFromSave(data: __KPM468) {
        // Runtime restoration is transactional: a corrupt/partial runtime block must
        // never erase pending service snapshots or release live vehicle busy locks.
        if (!data || Array.isArray(data) || typeof data !== 'object')
            return false;
        const schema = Number(data.schemaVersion ?? 1);
        if (!Number.isInteger(schema) || schema < RUNTIME_SAVE_MIN_SCHEMA || schema > RUNTIME_SAVE_SCHEMA)
            return false;
        let capturedAt = 0, pending: Map<string, RuntimeSnapshot>, busy: Array<{ id: string; busyUntilEpoch: number }>; 
        try {
            capturedAt = Number(data.capturedAtUnixSec || 0);
            if (!Number.isFinite(capturedAt) || capturedAt < 0)
                throw new Error('capturedAtUnixSec invalide');
            if (data.services != null && !Array.isArray(data.services))
                throw new Error('services runtime invalide');
            if (data.busyVehicles != null && !Array.isArray(data.busyVehicles))
                throw new Error('busyVehicles runtime invalide');
            pending = new Map<string, RuntimeSnapshot>();
            for (const raw of data.services || []) {
                if (!raw || Array.isArray(raw) || typeof raw !== 'object')
                    throw new Error('snapshot service invalide');
                const id = String(raw.id || '').trim();
                if (!id || pending.has(id))
                    throw new Error(`snapshot service id vide/dupliqué (${id || '?'})`);
                if (raw.vehicleIds != null && !Array.isArray(raw.vehicleIds))
                    throw new Error(`snapshot ${id}: vehicleIds invalide`);
                if (raw.formationMembers != null && !Array.isArray(raw.formationMembers))
                    throw new Error(`snapshot ${id}: formationMembers invalide`);
                if (raw.operationState != null && (typeof raw.operationState !== 'object' || Array.isArray(raw.operationState)))
                    throw new Error(`snapshot ${id}: operationState invalide`);
                const snap = structuredClone(raw);
                if(raw.turnbackState!=null&&!normalizeTurnbackState(raw.turnbackState))throw new Error(`snapshot ${id}: rebroussement invalide`);
                snap.turnbackState=normalizeTurnbackState(raw.turnbackState);snap.formationReversed=typeof raw.formationReversed==='boolean'?raw.formationReversed:undefined;
                const finite = (v: unknown, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
                const nullableFinite = (v: unknown) => v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
                const states = new Set(['waiting', 'preparation', 'garage', 'moving', 'departing', 'stopped_at_station', 'blocked_route', 'completed', 'cancelled']);
                snap.state = states.has(String(raw.state || '')) ? String(raw.state) : 'waiting';
                snap.currentStopIndex = Math.max(0, Math.trunc(finite(raw.currentStopIndex, 0)));
                snap.speed = Math.max(0, finite(raw.speed, 0));
                snap.delay = finite(raw.delay, 0);
                snap.stateIndex = Math.max(0, Math.trunc(finite(raw.stateIndex, 0)));
                snap.stateProgress = Math.max(0, Math.min(1, finite(raw.stateProgress, 0)));
                if (raw.macroElapsed != null && (typeof raw.macroElapsed !== 'object' || Array.isArray(raw.macroElapsed)
                    || !Number.isFinite(raw.macroElapsed.medium) || !Number.isFinite(raw.macroElapsed.low)
                    || raw.macroElapsed.medium < 0 || raw.macroElapsed.low < 0)) throw new Error(`snapshot ${id}: dette physique invalide`);
                snap.macroElapsed = { medium: raw.macroElapsed?.medium || 0, low: raw.macroElapsed?.low || 0 };
                snap.nextDepartureTime = nullableFinite(raw.nextDepartureTime);
                snap.onboardPax = Math.max(0, finite(raw.onboardPax, 0));
                snap.onboardFreight = Math.max(0, finite(raw.onboardFreight, 0));
                snap.contractFreight = Math.max(0, finite(raw.contractFreight, 0));
                snap.contractDelivered = Math.max(0, finite(raw.contractDelivered, 0));
                snap.contractCargoId = String(raw.contractCargoId || '');
                snap.blockedSinceGameTime = nullableFinite(raw.blockedSinceGameTime);
                snap.stoppedSinceGameTime = nullableFinite(raw.stoppedSinceGameTime);
                snap.totalDistance = Math.max(0, finite(raw.totalDistance, 0));
                snap.brakeEffort = Math.max(0, Math.min(1, finite(raw.brakeEffort, 0)));
                if (raw.tractiveEffort != null && (typeof raw.tractiveEffort !== 'number' || !Number.isFinite(raw.tractiveEffort) || raw.tractiveEffort < 0 || raw.tractiveEffort > 1)) throw new Error(`snapshot ${id}: effort de traction invalide`);
                snap.tractiveEffort = Math.max(0, Math.min(1, finite(raw.tractiveEffort, 0)));
                if (raw.physicsDecelMs2 != null && (typeof raw.physicsDecelMs2 !== 'number' || !Number.isFinite(raw.physicsDecelMs2) || raw.physicsDecelMs2 < 0)) throw new Error(`snapshot ${id}: décélération invalide`);
                snap.physicsDecelMs2 = finite(raw.physicsDecelMs2, 0);
                if (raw.position != null) {
                    const lat = Number(raw.position.lat), lon = Number(raw.position.lon);
                    snap.position = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180 ? { lat, lon } : null;
                }
                else
                    snap.position = null;
                snap.vehicleIds = [...new Set((raw.vehicleIds || []).map((x: unknown) => String(x || '').trim()).filter(Boolean))];
                snap.formationMembers = (raw.formationMembers || []).filter((x: unknown) => x && typeof x === 'object' && !Array.isArray(x)).map((x: { vehicleId: unknown }) => ({ ...x, vehicleId: String(x.vehicleId || '').trim() })).filter((x: { vehicleId: unknown }) => x.vehicleId);
                if (raw.operationState && typeof raw.operationState === 'object' && !Array.isArray(raw.operationState)) {
                    const os = structuredClone(raw.operationState);
                    os.locationOccurrenceId = String(os.locationOccurrenceId || '');
                    os.stationId = String(os.stationId || '');
                    os.technicalLocationId = String(os.technicalLocationId || '');
                    os.locationName = String(os.locationName || '');
                    os.windowStartRelSec = finite(os.windowStartRelSec, 0);
                    os.completed = !!os.completed;
                    os.failed = !!os.failed;
                    os.entries = Array.isArray(os.entries) ? os.entries.filter((e: unknown) => e && typeof e === 'object' && !Array.isArray(e)).map((e: { actionId: unknown; plannedStartOffsetSec: unknown; plannedEndOffsetSec: unknown; durationSec: unknown; dependsOn: unknown; started: unknown; applied: unknown; failed: unknown; failure: unknown; actualStartRelSec: unknown; actualEndRelSec: unknown; reservedIds: unknown }) => ({
                        actionId: String(e.actionId || ''), plannedStartOffsetSec: Math.max(0, finite(e.plannedStartOffsetSec, 0)), plannedEndOffsetSec: Math.max(0, finite(e.plannedEndOffsetSec, 0)), durationSec: Math.max(300, finite(e.durationSec, 300)),
                        dependsOn: [...new Set((Array.isArray(e.dependsOn) ? e.dependsOn : []).map((x: unknown) => String(x || '')).filter(Boolean))], started: !!e.started, applied: !!e.applied, failed: !!e.failed, failure: String(e.failure || ''),
                        actualStartRelSec: e.actualStartRelSec == null ? null : finite(e.actualStartRelSec, 0), actualEndRelSec: e.actualEndRelSec == null ? null : finite(e.actualEndRelSec, 0), reservedIds: [...new Set((Array.isArray(e.reservedIds) ? e.reservedIds : []).map((x: unknown) => String(x || '')).filter(Boolean))],
                    })).filter((e: { actionId: unknown }) => e.actionId) : [];
                    snap.operationState = os.locationOccurrenceId && os.entries.length ? os : null;
                }
                else
                    snap.operationState = null;
                snap.platformAssignment = raw.platformAssignment && typeof raw.platformAssignment === 'object' && !Array.isArray(raw.platformAssignment) ? structuredClone(raw.platformAssignment) : null;
                if (snap.platformAssignment) snap.platformAssignment.trackIdentity = normalizeStationTrackIdentity(snap.platformAssignment.trackIdentity);
                snap.departureResourceHold = raw.departureResourceHold && typeof raw.departureResourceHold === 'object' && !Array.isArray(raw.departureResourceHold) ? structuredClone(raw.departureResourceHold) : null;
                if (snap.departureResourceHold) snap.departureResourceHold.trackIdentity = normalizeStationTrackIdentity(snap.departureResourceHold.trackIdentity);
                const train = raw.train && typeof raw.train === 'object' && !Array.isArray(raw.train) ? raw.train : {};
                snap.train = { ...structuredClone(train), speed: Math.max(0, finite(train.speed, snap.speed)), delay: finite(train.delay, snap.delay), state: String(train.state || ''), delayReason: String(train.delayReason || ''), incidentDelayReasons: Array.isArray(train.incidentDelayReasons) ? train.incidentDelayReasons.filter((x: unknown) => x && typeof x === 'object' && !Array.isArray(x)).map((x: unknown) => structuredClone(x)) : [] };
                pending.set(id, snap);
            }
            busy = [];
            const busyIds = new Set();
            for (const raw of data.busyVehicles || []) {
                if (!raw || Array.isArray(raw) || typeof raw !== 'object')
                    throw new Error('busyVehicle invalide');
                const id = String(raw.id || '').trim(), until = Number(raw.busyUntilEpoch);
                if (!id || busyIds.has(id))
                    throw new Error(`busyVehicle id vide/dupliqué (${id || '?'})`);
                if (!Number.isFinite(until) || until <= 0)
                    throw new Error(`busyVehicle ${id}: échéance invalide`);
                busyIds.add(id);
                busy.push({ id, busyUntilEpoch: until });
            }
        }
        catch (err) {
            console.error('Schedule V2 runtime chargement refusé:', err);
            return false;
        }
        // Commit only after the complete block has been validated/staged.
        this._pendingSnapshots = pending;
        // Imported state invalidates the already-processed second, even at the same cursor.
        this._lastSyncKey = '';
        this._snapshotCapturedAtUnixSec = capturedAt;
        for (const v of this.game.rotationV2?.vehicles || []) {
            delete v._v2BusyUntilEpoch;
            delete v._v2OperationOwnerServiceId;
        }
        for (const rec of busy) {
            const v = this.game.rotationV2?.getVehicle?.(rec.id);
            if (v)
                v._v2BusyUntilEpoch = rec.busyUntilEpoch;
        }
        return true;
    }
    _restoreSnapshot(svc: ActiveServiceLike, relNowMinutes: unknown = null) {
        const snap = this._pendingSnapshots.get(String(svc.id));
        if (!snap)
            return false;
        this._pendingSnapshots.delete(String(svc.id));
        // v1.1.97 — a stopped train uses currentStopIndex === stops.length as a
        // legitimate terminal sentinel: the last stop has already been consumed and
        // there is no next stop. v1.1.96 incorrectly clamped every restored cursor to
        // stops.length - 1, resurrecting the terminal itself as the "next stop".
        // The service then waited on the wrong stop and could never release into the
        // following rotation occurrence.
        svc.isReturnLeg = !!snap.isReturnLeg;
        svc.position = snap.position ? { lat: Number(snap.position.lat), lon: Number(snap.position.lon) } : null;
        svc.speed = Math.max(0, Number(snap.speed || 0));
        svc.delay = Number(snap.delay || 0);
        svc.completed = !!snap.completed;
        svc.cancelled = !!snap.cancelled;
        svc.state = snap.state || 'waiting';
        const restoreStops = svc.getCurrentStops?.() || (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
        let rawStopIndex = Math.max(0, Number(snap.currentStopIndex || 0));
        // Repair snapshots already poisoned by v1.1.96: when a stopped consist is
        // physically reserved at the same station as stops[currentStopIndex], that
        // stop has in fact already been reached and the cursor must move past it.
        // A healthy intermediate stop points to a DIFFERENT next-station id, so it
        // is left untouched.
        if (svc.state === 'stopped_at_station' && rawStopIndex < restoreStops.length) {
            const physicalStationId = String(snap.platformAssignment?.stationId || '');
            const pointedStationId = String(restoreStops[rawStopIndex]?.stationId || '');
            if (physicalStationId && pointedStationId && physicalStationId === pointedStationId)
                rawStopIndex++;
        }
        const terminalCursorAllowed = svc.state === 'stopped_at_station' || svc.state === 'completed' || svc.completed;
        const maxStopIndex = terminalCursorAllowed
            ? restoreStops.length
            : Math.max(0, restoreStops.length - 1);
        svc.currentStopIndex = Math.max(0, Math.min(maxStopIndex, rawStopIndex));
        svc._nextDepartureTime = snap.nextDepartureTime ?? null;
        svc._atTerminus = !!snap.atTerminus;
        const emptyMovement = ['w','hlp','tm','m-','evo'].includes(String(svc.serviceType || '').toLowerCase());
        svc._onboardPax = emptyMovement ? 0 : Number(snap.onboardPax || 0);
        svc._onboardPassengerKm = emptyMovement ? 0 : Math.max(0, Number(snap.onboardPassengerKm || 0));
        svc._contractFreight = emptyMovement ? 0 : Math.max(0, Number(snap.contractFreight || 0));
        svc._contractCargoId = emptyMovement ? '' : String(snap.contractCargoId || svc.assignedContractId || '');
        svc._contractDelivered = Math.max(0, Number(snap.contractDelivered || 0));
        svc._genericCargoType = emptyMovement ? '' : String(snap.genericCargoType || '');
        svc._onboardFreight = emptyMovement ? 0 : Number(snap.onboardFreight || 0);
        svc._blockedSinceGameTime = snap.blockedSinceGameTime ?? null;
        if (svc.train) {
            const savedStopped = snap.stoppedSinceGameTime == null ? null : Number(snap.stoppedSinceGameTime);
            if (savedStopped != null && Number.isFinite(savedStopped))
                svc.train._stoppedSinceGameTime = savedStopped;
            else if (svc.state === 'stopped_at_station' && Number.isFinite(Number(relNowMinutes))) {
                // Old snapshots did not persist the real arrival instant. Fail safe by
                // restarting the operational dwell from reload time rather than silently
                // skipping a rotation/ITE/freight dwell after F5.
                svc.train._stoppedSinceGameTime = Number(relNowMinutes);
            }
            else
                svc.train._stoppedSinceGameTime = null;
        }
        svc._platformAssignment = snap.platformAssignment ? ({ ...snap.platformAssignment, trackIdentity: normalizeStationTrackIdentity(snap.platformAssignment.trackIdentity) } as typeof svc._platformAssignment) : null;
        if (Number.isFinite(Number(snap.totalDistance)))
            svc.totalDistance = Number(snap.totalDistance);
        svc._passageTailSpeedHolds = normalizePassageTailSpeedHolds(snap.passageTailSpeedHolds);
        svc._brakeEffort = Math.max(0, Math.min(1, Number(snap.brakeEffort || 0)));
        svc._tractiveEffort = Math.max(0, Math.min(1, Number(snap.tractiveEffort || 0)));
        svc._lastPhysicsDecelMs2 = Math.max(0, Number(snap.physicsDecelMs2 || 0));
        svc._departureResourceHold = snap.departureResourceHold ? ({ ...snap.departureResourceHold, trackIdentity: normalizeStationTrackIdentity(snap.departureResourceHold.trackIdentity) } as typeof svc._departureResourceHold) : null;
        svc._stationaryRoute = this._snapshotRouteFromRef(svc, snap.stationaryRouteRef, snap.stationaryRouteFallback);
        svc._stationaryRouteIndex = svc._stationaryRoute?.length ? Math.max(0, svc._stationaryRoute.length - 2) : 0;
        svc._v2RandomDepartureKey = typeof snap.randomDepartureKey === 'string' ? snap.randomDepartureKey : '';
        svc._v2VehicleIds = [...(snap.vehicleIds || svc._v2VehicleIds || [])];
        svc._v2FormationMembers = (snap.formationMembers || svc._v2FormationMembers || []).map((x: RuntimeFormationMember) => ({ ...x }));
        svc._turnbackState = normalizeTurnbackState(snap.turnbackState);
        if (typeof snap.formationReversed === 'boolean') { svc._v2FormationReversed = snap.formationReversed; this._refreshRuntimeFormation(svc); }
        svc._v2OperationState = snap.operationState ? (structuredClone(snap.operationState) as typeof svc._v2OperationState) : null;
        svc._v2OperationFailure = svc._v2OperationState?.failed ? 'opération de roulement interrompue' : '';
        if (svc._v2OperationState) {
            for (const entry of svc._v2OperationState.entries || [])
                for (const id of entry.reservedIds || []) {
                    const v = this.game.rotationV2?.getVehicle?.(id);
                    if (v) {
                        v.available = false;
                        v._v2OperationOwnerServiceId = String(svc.id || '');
                        if (Number(entry.actualEndRelSec) > 0)
                            v._v2BusyUntilEpoch = simulationEpochSec(svc._v2BaseDate || '', Number(entry.actualEndRelSec));
                    }
                }
        }
        if (svc.train) {
            svc.train.speed = Number(snap.train?.speed ?? svc.speed);
            svc.train.delay = Number(snap.train?.delay ?? svc.delay);
            const savedTrainState = String(snap.train?.state || '');
            const incidentTrainStates = new Set(['en panne', 'travaux', 'grève', 'anomalie legere']);
            if (svc.state === 'moving' || svc.state === 'departing')
                svc.train.state = incidentTrainStates.has(savedTrainState) ? savedTrainState : 'moving';
            else if (svc.state === 'stopped_at_station')
                svc.train.state = 'stopped_at_station';
            else if (['completed', 'cancelled', 'blocked_route', 'preparation', 'garage', 'waiting'].includes(svc.state))
                svc.train.state = svc.state;
            else
                svc.train.state = savedTrainState || svc.train.state;
            svc.train.delayReason = String(snap.train?.delayReason || '');
            if (snap.train && 'breakdown' in snap.train) svc.train.breakdown = snap.train.breakdown as typeof svc.train.breakdown;
            if (snap.train && 'incident' in snap.train) svc.train.incident = snap.train.incident as typeof svc.train.incident;
            if (snap.train && 'inMaintenance' in snap.train) svc.train.inMaintenance = !!snap.train.inMaintenance;
            svc.train.incidentDelayReasons = (Number(svc.train.delay || 0) >= 0.5 && Array.isArray(snap.train?.incidentDelayReasons))
                ? snap.train.incidentDelayReasons.map((r: Record<string, unknown>) => ({ ...r }))
                : [];
        }
        svc._resetState?.();
        svc._macroElapsed = { medium: Number(snap.macroElapsed?.medium || 0), low: Number(snap.macroElapsed?.low || 0) };
        if (this.game.depotManager?.ownsServiceMovement?.(svc.id)) {
            // The saved cursor belongs to the rescue path, never the booked leg.
            this.game.depotManager.restoreRescueTow?.(svc.id);
            svc._restoreHeldDepartureSafety?.();
        }
        else if ((svc.state === 'moving' || svc.state === 'departing') && svc.position) {
            const route = svc.getCurrentRoute?.();
            const legKey = snap.legKey || `${svc.currentStopIndex}-${svc.isReturnLeg ? 1 : 0}`;
            if (route && route.length >= 2) {
                svc._initializeState(route, legKey);
                svc._state.index = Math.max(0, Math.min(route.length - 1, Number(snap.stateIndex || 0)));
                svc._state.progress = Math.max(0, Math.min(1, Number(snap.stateProgress || 0)));
                svc._syncCantonFootprint?.(route);
                svc._restoreHeldDepartureSafety?.();
            }
        }
        else if ((svc.state === 'waiting' || svc.state === 'preparation') && svc.position) {
            const stop = (svc.getCurrentStops?.() || svc.stops || [])[0];
            const stationId = String(snap.platformAssignment?.stationId || stop?.stationId || '');
            const station = stationId ? (svc.world?.getStationById?.(stationId)
                || { id: stationId, name: stop?.locationName || '', lat: svc.position.lat, lon: svc.position.lon, platforms: 2 }) : null;
            if (station && stop) {
                if (!stop.trackIdentity && snap.platformAssignment?.platform != null)
                    stop.platform = snap.platformAssignment.platform as string | number;
                if (!stop.trackIdentity && snap.platformAssignment?.voiePointId)
                    stop.voiePointId = snap.platformAssignment.voiePointId as string;
                const reserved = svc._reserveArrivalResources?.(station, stop) !== false;
                const footprint = reserved ? (svc._reserveOriginSafetyFootprint?.() !== false) : false;
                if (!reserved || !footprint) {
                    svc._movementStop?.('ORIGIN_RESOURCE', svc.train.delayReason || 'attente voie libre au départ', 'v2-runtime');
                    svc.train.delayReason = svc.train.delayReason || 'attente voie libre au départ';
                }
                if (svc.train)
                    svc.train.stoppedAt = station;
            }
        }
        else if (svc.state === 'stopped_at_station' && svc.position) {
            const stops = svc.getCurrentStops?.() || [];
            const stop = stops[Math.max(0, Math.min(stops.length - 1, Number(svc.currentStopIndex || 0) - 1))]
                || stops[Math.max(0, Math.min(stops.length - 1, Number(svc.currentStopIndex || 0)))];
            const stationId = String(snap.platformAssignment?.stationId || stop?.stationId || '');
            const station = stationId ? svc.world?.getStationById?.(stationId) : null;
            if (station && stop) {
                if (!stop.trackIdentity && snap.platformAssignment?.platform != null)
                    stop.platform = snap.platformAssignment.platform as string | number;
                if (!stop.trackIdentity && snap.platformAssignment?.voiePointId)
                    stop.voiePointId = snap.platformAssignment.voiePointId as string;
                svc._reserveArrivalResources?.(station, stop);
                if (svc.train)
                    svc.train.stoppedAt = station;
            }
            // Old snapshots did not retain the approach route. Infer it when possible
            // so the stopped consist still protects the throat with its full length.
            if (!svc._stationaryRoute && svc.currentStopIndex >= 2) {
                const prevIdx = svc.currentStopIndex - 2;
                svc._stationaryRoute = svc.isReturnLeg ? (svc._returnRoutes?.[prevIdx] || null) : (svc.routes?.[prevIdx] || null);
                svc._stationaryRouteIndex = svc._stationaryRoute?.length ? Math.max(0, svc._stationaryRoute.length - 2) : 0;
            }
            svc._restoreStationarySafetyFootprint?.();
        }
        for (const id of svc._v2VehicleIds || []) {
            const v = this.game.rotationV2.getVehicle(id);
            if (v)
                v.available = false;
        }
        this.game.scheduleCreator?._invalidateActiveCache?.();
        return true;
    }
    diagnose(timeOfDay: unknown, dateStr: string) {
        const out = [];
        if (!dateStr)
            return { summary: 'date simulation indisponible', items: [] };
        const todSec = Math.round(Number(timeOfDay || 0) * 60);
        this._beginPlanCacheEpoch(dateStr, todSec);
        const rm = this.game.rotationV2;
        const realRotations = rm?.rotations || [];
        const directAssignments = this.game.realismSettings?.rotationsRequired === true ? [] : (this.game.rotationV2?.directAssignments || []).filter((a: { enabled: unknown }) => a.enabled !== false && !this.game.rotationV2?.directAssignmentSuppressed?.(a));
        const runtimeRotations = this._runtimeRotations();
        const validSchedules = (this.game.scheduleV2?.schedules || []).filter((rec: __S3Struct1122) => rec?.currentVersion?.state === 'VALID');
        for (const rotation of runtimeRotations) {
            if (!rotation.enabled) {
                out.push({ level: 'warn', rotationId: rotation.id, label: rotation.name || rotation.id, status: 'roulement désactivé' });
                continue;
            }
            const dates = [dateStr, addDays(dateStr, -1)];
            for (const baseDate of dates) {
                if (!this._rotationRuns(rotation, baseDate))
                    continue;
                let plans = [];
                try {
                    plans = this._plansForRotationDate(rotation, baseDate) || [];
                }
                catch (err) {
                    out.push({ level: 'error', rotationId: rotation.id, label: rotation.name || rotation.id, status: `planification impossible: ${(err as { message?: string }).message || err}` });
                    continue;
                }
                const relNow = daysBetween(baseDate, dateStr) * DAY + todSec;
                for (const plan of plans) {
                    const rec = this.game.scheduleV2.getSchedule(plan.occ?.scheduleId);
                    const label = `${rec?.number || '?'} ${rec?.name || ''}`.trim();
                    const serviceId = plan.occ ? `v2:${rotation.id}:${plan.occ.id}:${baseDate}` : '';
                    const svc = this.game.scheduleCreator?.services?.find((s: { id: unknown }) => s.id === serviceId);
                    const direct = false;
                    // HOTFIX16 — do not mix a live J occurrence with an already-expired J-1
                    // diagnostic for the same rotation/occurrence. That contradiction hid
                    // the real movement authority state on LiveMap.
                    if (!svc && baseDate !== dateStr) {
                        const newerLive = (this.game.scheduleCreator?.services || []).some((s: { _v2RotationId: unknown; _v2OccurrenceId: unknown; completed: unknown; cancelled: unknown }) => String(s?._v2RotationId || '') === String(rotation.id) &&
                            String(s?._v2OccurrenceId || '') === String(plan.occ?.id || '') &&
                            !s.completed && !s.cancelled);
                        if (newerLive)
                            continue;
                    }
                    if (svc && !svc.completed && !svc.cancelled) {
                        const blocked = !!svc.train?.blockedBy;
                        const why = blocked ? ` · BLOQUÉ: ${svc.train?.delayReason || 'raison non renseignée'}` : '';
                        out.push({ level: blocked ? 'warn' : 'ok', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: `runtime ${svc.state}${svc.position ? ' · visible' : ' · sans position'}${why}` });
                        continue;
                    }
                    if (!plan.ver) {
                        out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ?.id, direct, label, status: plan.error || 'version/horaire non exploitable' });
                        continue;
                    }
                    const routeProblem = this._routeIntegrityProblem(plan);
                    if (routeProblem) {
                        out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: `route: ${routeProblem}` });
                        continue;
                    }
                    const members = plan.occ?.formation?.members || [];
                    if (!members.length) {
                        out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: 'aucun matériel affecté à la ligne' });
                        continue;
                    }
                    const activeMembers = members.filter((m: { role: unknown }) => isActiveRole(m.role));
                    if (!activeMembers.length) {
                        out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: 'aucun engin de traction actif' });
                        continue;
                    }
                    const missing = activeMembers.map((m: { vehicleId: unknown }) => this.game.rotationV2.getVehicle(m.vehicleId)).filter((v: unknown) => !v);
                    if (missing.length) {
                        out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: 'engin titulaire introuvable' });
                        continue;
                    }
                    const prep = Math.min(plan.startSec - 300, Number(plan.prepStartSec ?? plan.startSec));
                    const untilStart = plan.startSec - relNow;
                    if (relNow < prep) {
                        out.push({ level: 'info', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: `prévu dans ${Math.max(0, Math.ceil(untilStart / 60))} min · spawn à T−5` });
                        continue;
                    }
                    if (relNow > plan.endSec) {
                        out.push({ level: 'warn', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: 'fenêtre runtime déjà dépassée' });
                        continue;
                    }
                    const alerts = (this.alerts || []).filter((a) => a.rotationId === rotation.id && a.occurrenceId === plan.occ.id);
                    if (alerts.length) {
                        const a = alerts[0];
                        out.push({ level: a.level === 'ERROR' ? 'error' : 'warn', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: `${a.code}: ${a.message}` });
                        continue;
                    }
                    out.push({ level: 'error', rotationId: rotation.id, occurrenceId: plan.occ.id, direct, label, status: 'DÛ mais non compilé — resync nécessaire' });
                }
            }
        }
        const assignedScheduleIds = new Set();
        for (const rotation of realRotations)
            for (const occ of rotation.occurrences || [])
                assignedScheduleIds.add(occ.scheduleId);
        for (const a of directAssignments)
            assignedScheduleIds.add(a.scheduleId);
        for (const rec of validSchedules)
            if (!assignedScheduleIds.has(rec.id))
                out.push({ level: 'warn', scheduleId: rec.id, label: `${rec.number || '?'} ${rec.name || ''}`.trim(), status: this.game.realismSettings?.rotationsRequired === true ? 'horaire VALIDE mais HORS ROULEMENT — aucun train ne circulera' : 'horaire VALIDE sans rame directe — affectez une rame ou utilisez un roulement' });
        const rank: Record<string, number> = { error: 0, warn: 1, ok: 2, info: 3 };
        out.sort((a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9));
        const errors = out.filter((x) => x.level === 'error').length, active = out.filter((x) => x.level === 'ok').length;
        return { summary: `${realRotations.length} roulement(s) · ${directAssignments.length} affectation(s) simple(s) · ${active} train(s) runtime · ${errors} blocage(s)`, items: out.slice(0, 12) };
    }
    forceSync(timeOfDay: number, dateStr: string) {
        this._lastSyncKey = '';
        this._planCache.clear();
        this.sync(timeOfDay, dateStr);
        return this.diagnose(timeOfDay, dateStr);
    }
    // HOTFIX83 — when Chromium throttles a hidden tab for a long period, the
    // lightweight background heartbeat may not receive enough callbacks to run
    // every 100 ms physics step. Re-anchor EXISTING V2 services to the current
    // timetable clock on visibility return, preserving their accrued delay.
    // Hard-blocked/broken trains are deliberately left where they are.
    catchUpExistingToClock(timeOfDay: number, dateStr: string, { gapSec = 0 }: Record<string, unknown> = {}) {
        if (!dateStr || Number(gapSec || 0) <= 0)
            return 0;
        const todSec = Math.round(Number(timeOfDay || 0) * 60);
        let changed = 0;
        for (const rotation of this._runtimeRotations()) {
            if (!rotation?.enabled)
                continue;
            const lookback = this._roughLookback(rotation);
            for (let d = 0; d <= lookback; d++) {
                const baseDate = addDays(dateStr, -d);
                if (!this._rotationRuns(rotation, baseDate))
                    continue;
                let plans = [];
                try {
                    plans = this._plansForRotationDate(rotation, baseDate) || [];
                }
                catch {
                    continue;
                }
                const relNow = daysBetween(baseDate, dateStr) * DAY + todSec;
                for (const plan of plans) {
                    if (!plan?.ver)
                        continue;
                    const serviceId = `v2:${rotation.id}:${plan.occ.id}:${baseDate}`;
                    const svc = this.game.scheduleCreator?.services?.find?.((x: { id: unknown }) => x?.id === serviceId);
                    if (!svc || svc.completed || svc.cancelled)
                        continue;
                    const trainState = String(svc.train?.state || '').toLowerCase();
                    if (this.game.depotManager?.ownsServiceMovement?.(svc.id)) continue;
                    const blocked = !!svc.train?.breakdown || svc.state === 'blocked_route' || trainState === 'en panne' || trainState === 'grève' || !!svc._iteHardBlock || !!svc.train?.blockedBy || svc.train?.movementAuthority?.status === 'STOP' || svc.train?.incident?.effect === 'stop' || svc.train?.inMaintenance || svc.rame?.inMaintenance;
                    if (blocked)
                        continue;
                    // Delay is stored in minutes. Position the train where its delayed
                    // timetable says it should be, rather than erasing the delay.
                    const oldDelay = Number(svc.delay || svc.train?.delay || 0);
                    const effectiveNow = relNow - (Number.isFinite(oldDelay) ? oldDelay * 60 : 0);
                    if (effectiveNow < Number(plan.startSec) - 1 || effectiveNow > Number(plan.endSec) + 1)
                        continue;
                    const beforeKm = Math.max(0, Number(svc.totalDistance || 0));
                    const oldReason = String(svc.train?.delayReason || '');
                    const result = this._catchUpFreshCompile(svc, { ...plan, _relNow: effectiveNow }, effectiveNow, { totalDistance: beforeKm });
                    if (!result)
                        continue;
                    const afterKm = Math.max(beforeKm, Number(svc.totalDistance || 0));
                    const deltaKm = Math.max(0, afterKm - beforeKm);
                    if (deltaKm > 0)
                        try {
                            svc._trackWear?.(deltaKm, Number(timeOfDay || 0));
                        }
                        catch { }
                    svc.delay = oldDelay;
                    if (svc.train) {
                        svc.train.delay = oldDelay;
                        if (result.mode !== 'blocked') svc.train.delayReason = oldReason;
                    }
                    changed++;
                }
            }
        }
        this.game.scheduleCreator?._invalidateActiveCache?.();
        return changed;
    }
    sync(timeOfDay: number, dateStr: unknown) {
        if (!dateStr)
            return;
        const todSec = Math.round(Number(timeOfDay || 0) * 60);
        this._beginPlanCacheEpoch(dateStr, todSec);
        const syncKey = `${dateStr}|${todSec}`;
        if (this._lastSyncKey === syncKey)
            return;
        this._lastSyncKey = syncKey;
        this._reconcilePreparedServices();
        this._pruneSeasonallyInactive();
        this._finalizeServices(dateStr, timeOfDay);
        const due = [];
        for (const rotation of this._runtimeRotations()) {
            if (!rotation.enabled)
                continue;
            const lookback = this._roughLookback(rotation);
            for (let d = 0; d <= lookback; d++) {
                const baseDate = addDays(dateStr, -d);
                if (!this._rotationRuns(rotation, baseDate))
                    continue;
                let plans = [];
                try {
                    plans = this._plansForRotationDate(rotation, baseDate) || [];
                }
                catch (err) {
                    const reason = (err as { message?: string })?.message || String(err);
                    this._pushAlert('ERROR', 'ROTATION_RUNTIME_PLAN_FAILED', `Roulement ${rotation.name || rotation.id} ignoré pour cette synchronisation : ${reason}.`, { rotationId: rotation.id, baseDate, suggestion: 'Corriger le roulement ou la sauvegarde ; les autres roulements continuent à être compilés.' });
                    console.error('ScheduleV2Runtime plan isolation:', err);
                    continue;
                }
                const relNow = daysBetween(baseDate, dateStr) * DAY + todSec;
                for (const plan of plans) {
                    if (!plan.ver) {
                        if (plan.errorCode !== 'OCCURRENCE_CANCELLED') {
                            this._pushAlert('ERROR', 'OCCURRENCE_NOT_COMPILED', `Circulation non créée : ${plan.error || 'horaire non exploitable'}.`, { rotationId: rotation.id, occurrenceId: plan.occ?.id, baseDate, suggestion: 'Ouvrir le roulement et la version épinglée pour corriger la cause.' });
                        }
                        continue;
                    }
                    const prep = Math.min(plan.startSec - 300, Number(plan.prepStartSec ?? plan.startSec));
                    const serviceId = `v2:${rotation.id}:${plan.occ.id}:${baseDate}`;
                    if (this.game.depotManager?.hasRescuedOccurrence?.(serviceId)) continue;
                    const snap = this._pendingSnapshots.get(serviceId);
                    const hasSnapshot = !!snap;
                    const snapshotDue = hasSnapshot && this._snapshotCanRestore(plan, snap, relNow);
                    const alreadyExists = this.game.scheduleCreator.services.some((s: { id: unknown }) => s.id === serviceId);
                    // Fresh compilation is allowed only while the published circulation is
                    // actually in its operating window. The former +3600 s grace created
                    // zombie trains that departed +60 min after a reload.
                    const freshDue = relNow >= prep && relNow <= plan.endSec;
                    if (freshDue || snapshotDue) {
                        due.push({ ...plan, _relNow: relNow });
                    }
                    else {
                        if (hasSnapshot && !snapshotDue) {
                            this._pendingSnapshots.delete(serviceId);
                            this._pushAlert('WARNING', 'V2_STALE_RUNTIME_SNAPSHOT_IGNORED', `Ancien état runtime ignoré pour ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} : cette circulation n'est plus censée rouler à l'heure actuelle.`, { rotationId: rotation.id, occurrenceId: plan.occ.id, baseDate });
                        }
                        if (relNow > plan.endSec && !alreadyExists && relNow <= plan.endSec + DAY) {
                            this._pushAlert('WARNING', 'V2_RUNTIME_WINDOW_MISSED', `Circulation ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || ''} non reconstruite : son horaire est déjà terminé.`, { rotationId: rotation.id, occurrenceId: plan.occ.id, baseDate, suggestion: 'Le jeu ne lance plus automatiquement un train ancien avec +60 min après rechargement.' });
                        }
                    }
                }
            }
        }
        // Reservation winner is deterministic: earliest actual departure first,
        // independent from rotations array/UI order.
        due.sort((a: __S3Struct1125, b: __S3Struct1126) => a.startSec - b.startSec || String(a.rotation.id).localeCompare(String(b.rotation.id)) || String(a.occ.id).localeCompare(String(b.occ.id)));
        const publishedScheduleInstances = new Map();
        for (const plan of due) {
            // HOTFIX35 — the same published timetable must never spawn twice because it
            // was accidentally present in two compatible rolling lines.  Calendars may
            // make duplicate templates harmless; on a concrete runtime date only the
            // first deterministic owner is compiled and the second is rejected loudly.
            const plannedSec = Number(plan.sourceVersion?.firstDepartureSec ?? plan.ver?.firstDepartureSec ?? 0) + Number(plan.occ?.offsetSec || 0);
            const serviceDate = addDays(plan.baseDate, Math.floor(plannedSec / DAY));
            const scheduleKey = `${plan.occ?.scheduleId || ''}|${serviceDate}`;
            const previous = publishedScheduleInstances.get(scheduleKey);
            if (previous) {
                this._pushAlert('ERROR', 'SCHEDULE_DOUBLE_ASSIGNED_RUNTIME', `Horaire ${this.game.scheduleV2.getSchedule(plan.occ.scheduleId)?.number || plan.occ.scheduleId || ''} présent dans plusieurs lignes le ${serviceDate} : une seule circulation physique est créée.`, { rotationId: plan.rotation.id, occurrenceId: plan.occ.id, baseDate: plan.baseDate, suggestion: `Retirer cet horaire de ${plan.rotation.name || plan.rotation.id} ou de ${previous.rotation.name || previous.rotation.id}.` });
                continue;
            }
            try {
                this._compile(plan);
                // Register the published train identity only if the physical service now
                // exists. A plan can fail closed without throwing (route/material issue);
                // that broken owner must not suppress a later valid owner during isolation.
                const compiledServiceId = `v2:${plan.rotation.id}:${plan.occ.id}:${plan.baseDate}`;
                if (this.game.scheduleCreator.services.some((s: { id: unknown }) => s.id === compiledServiceId))
                    publishedScheduleInstances.set(scheduleKey, plan);
            }
            catch (err) {
                const reason = (err as { message?: string })?.message || String(err);
                this._pushAlert('ERROR', 'V2_COMPILE_FAILED_ISOLATED', `Une circulation n'a pas pu être compilée : ${reason}.`, { rotationId: plan?.rotation?.id, occurrenceId: plan?.occ?.id, baseDate: plan?.baseDate, suggestion: 'La circulation fautive est isolée ; les suivantes continuent.' });
                console.error('ScheduleV2Runtime compile isolation:', err);
            }
        }
    }
}
export { addDays as _v2AddDays, daysBetween as _v2DaysBetween };


// S3_STRUCT_V2_TEMP
type __S3Struct1036 = { "state": string; "calendarIds": unknown[] };
type __S3Struct1037 = { "matchesDate": (...args: unknown[]) => unknown };
type __S3Struct1039 = { "v": { "electricSystems": unknown[] } };
type __S3Struct1046 = { "v": { "powerW": unknown } };
type __S3Struct1047 = { "v": { "massKg": unknown } };
type __S3Struct1048 = { "v": { "traction": unknown } };
type __S3Struct1054 = { "arrivalSec": number; "departureSec": number };
type __S3Struct1058 = { "completed": number; "state": string; "_v2VehicleIds": unknown[] };
type __S3Struct1072 = { "vehicle": { "id": string } };
type __S3Struct1112 = { "id": string };
type __S3Struct1114 = { "rotationId": string; "occurrenceId": string; "code": string };
type __S3Struct1116 = { "_returnRoutes": unknown[]; "routes": unknown[] };
type __S3Struct1117 = { "i": unknown; "s": string };
type __S3Struct1122 = { "currentVersion": { "state": string } };
type __S3Struct1125 = { "startSec": number; "rotation": { "id": string }; "occ": { "id": string } };
type __S3Struct1126 = { "startSec": number; "rotation": { "id": string }; "occ": { "id": string } };
