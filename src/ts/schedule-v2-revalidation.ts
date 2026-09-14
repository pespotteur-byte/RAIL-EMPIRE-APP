type __KPStruct831 = { "legIndex": unknown };
type __KPStruct832 = { "order": number };
type __KPStruct833 = { "order": number };
import { legRouteInputKey, physicsRouteKey } from './schedule-route-inputs.js';
import type { RailEmpire } from './main.js';
import type { ScheduleVersion as ScheduleVersionType, ScheduledLocation as ScheduledLocationType, SchedulePath as SchedulePathType, RouteConstraint as RouteConstraintType } from './schedule-v2-model.js';
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
import { ScheduleState, ScheduleVersion, SchedulePath, ScheduledLocation, assignResolvedLegsToPath } from './schedule-v2-model.js?v=1144';
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
import { ScheduleV2Router } from './schedule-v2-routing.js?v=1144';
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
import { recalculateScheduleTiming } from './schedule-v2-timing.js?v=1144';
// @ts-expect-error cache-busted browser specifier; runtime resolution is intentional
import { validateScheduleVersion, applyValidationState } from './schedule-v2-validation.js?v=1144';

type RevalidationAnchor = { lat: number; lon: number; wayId?: string; segmentIndex?: number };
type ErrorLike = { code?: unknown; message?: unknown };
const errorLike = (value: unknown): ErrorLike => typeof value === 'object' && value !== null ? value as ErrorLike : {};

function constraintsForLeg(path: SchedulePathType, legIndex: number): RouteConstraintType[] { return (path?.constraints || []).filter((c) => Number(c.legIndex) === legIndex).sort((a, b) => a.order - b.order); }
function gapKm(a: { lat: unknown; lon: unknown }, b: { lat: unknown; lon: unknown }) { if (!a || !b)
    return Infinity; const R = 6371, dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(Number(a.lat) * Math.PI / 180) * Math.cos(Number(b.lat) * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
export class ScheduleV2Revalidator {
    game: RailEmpire;
    router: ScheduleV2Router;
    running: boolean;
    lastRun: string | null;
    deferred: boolean;

    constructor(game: RailEmpire) { this.game = game; this.router = new ScheduleV2Router(game.orm); this.running = false; this.lastRun = null; this.deferred = false; }
    _networkFailure(err: unknown = null) {
        const failure = String(this.game.orm?._lastCursorRouteFailure || '');
        const code = String(errorLike(err).code || '');
        return failure.startsWith('NETWORK') || failure === 'TIME_BUDGET' || ['ORM_NETWORK_UNAVAILABLE', 'ORM_TIME_BUDGET', 'TIME_BUDGET'].includes(code);
    }
    async _rebuildVersion(ver: ScheduleVersionType) {
        if (!ver?.outboundPath || !ver.locations?.length || ver.locations.length < 2)
            return { ok: false, reason: 'Horaire incomplet.', preserved: true };
        // v1.1.86: explicit revalidation is transactional. The live version is not
        // touched until a complete candidate route, timing and validation all pass.
        const candidate = new ScheduleVersion(ver.toJSON()) as ScheduleVersionType;
        const path = candidate.outboundPath;
        const legs = [];
        let resolvedStart: RevalidationAnchor | null = null;
        const deadline = Date.now() + 180000;
        for (let i = 0; i < candidate.locations.length - 1; i++) {
            const a = candidate.locations[i], b = candidate.locations[i + 1];
            const via = constraintsForLeg(path, i);
            const startBinding: Parameters<ScheduleV2Router['routeBetweenBindings']>[0] = resolvedStart ? { ...a.track, lat: resolvedStart.lat, lon: resolvedStart.lon, snapLat: resolvedStart.lat, snapLon: resolvedStart.lon, wayId: resolvedStart.wayId || a.track?.wayId || '' } : a.track;
            let route: Awaited<ReturnType<ScheduleV2Router['routeBetweenBindings']>>;
            try {
                route = await this.router.routeBetweenBindings(startBinding, b.track, via, { maxSpeed: candidate.performanceProfile.maxSpeed, traction: candidate.performanceProfile.traction || '', electricSystems: candidate.performanceProfile.electricSystems || [], gauges: candidate.performanceProfile.gauges || [], loadingGauge: candidate.performanceProfile.loadingGauge || '', axleLoad: candidate.performanceProfile.axleLoad ?? null, metreLoad: candidate.performanceProfile.metreLoad ?? null, allowFallback: false, routeBudgetMs: 180000, _deadlineTs: deadline });
            }
            catch (err) {
                if (this._networkFailure(err))
                    throw err;
                return { ok: false, reason: (err as { message?: string })?.message || String(err), preserved: true };
            }
            const resolved = route?._resolvedAnchors || [];
            const requested = [a.track, ...via, b.track];
            if (resolved.length === requested.length) {
                for (let j = 0; j < resolved.length; j++) {
                    const r = resolved[j], target = requested[j];
                    if (!target || !r)
                        continue;
                    target.snapLat = Number(r.lat);
                    target.snapLon = Number(r.lon);
                    if (r.wayId)
                        target.wayId = String(r.wayId);
                    if (Number.isFinite(Number(r.segmentIndex)))
                        target.segmentIndex = Number(r.segmentIndex);
                }
            }
            const snap: ReturnType<ScheduleV2Router['snapshotRoute']> = this.router.snapshotRoute(route);
            if (!snap.routePoints?.length || snap.routePoints.length < 2)
                return { ok: false, reason: 'Liaison ORM vide pendant la revalidation.', preserved: true };
            if (legs.length && gapKm(legs[legs.length - 1].routePoints[legs[legs.length - 1].routePoints.length - 1], snap.routePoints[0]) > 0.002)
                return { ok: false, reason: 'Discontinuité ORM entre deux tronçons du trajet.', preserved: true };
            legs.push({ id: `leg-${a.id}-${b.id}`, fromLocationId: a.id, toLocationId: b.id, constraintIds: via.map((c: { id: unknown }) => c.id), routeInputKey: '', physicsRouteKey: '', routePoints: snap.routePoints, segments: snap.segments, distanceKm: snap.distanceKm });
            resolvedStart = snap.routePoints[snap.routePoints.length - 1] || null;
        }
        // A later leg can refine the shared stop anchor: sign all inputs only
        // after the entire candidate has been resolved, like the editor does.
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i], key = legRouteInputKey(candidate, path, i);
            leg.routeInputKey = key;
            leg.physicsRouteKey = physicsRouteKey(key, this.game?.orm?._topologyEpoch, leg.routePoints.length, leg.distanceKm);
        }
        assignResolvedLegsToPath(path, legs, { validatedAt: new Date().toISOString(), resolvedRevision: Number(path.topologyRevision || 0), error: '' });
        (path as SchedulePathType & { cacheVersion?: string }).cacheVersion = 'ORM_REVALIDATED_V1187';
        try {
            recalculateScheduleTiming(candidate, { firstDepartureSec: candidate.locations[0]?.departureSec ?? 8 * 3600, weather: 'clear' });
        }
        catch (err) {
            return { ok: false, reason: (err as { message?: string })?.message || String(err), preserved: true };
        }
        const report = validateScheduleVersion(candidate, { ormAvailable: true });
        candidate.validationReport = report;
        applyValidationState(candidate, report);
        if (!report.canValidate)
            return { ok: false, reason: report.errors?.[0]?.message || 'Le trajet candidat ne passe pas la validation.', report, preserved: true };
        // Atomic commit: geometry, snapped anchors and computed times switch together.
        ver.outboundPath = new SchedulePath(candidate.outboundPath.toJSON());
        ver.locations = candidate.locations.map((l: ScheduledLocationType) => new ScheduledLocation(l.toJSON()) as ScheduledLocationType);
        ver.validationReport = report;
        ver.lastRecalculatedAt = candidate.lastRecalculatedAt;
        ver.state = ScheduleState.VALID;
        return { ok: true, report, preserved: false };
    }
    async run() {
        if (this.running)
            return { running: true };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.deferred = true;
            return { deferred: true, reason: 'offline' };
        }
        this.running = true;
        this.deferred = false;
        let checked = 0, repaired = 0, needsRepair = 0;
        try {
            for (const rec of this.game.scheduleV2.schedules) {
                for (const ver of rec.versions) {
                    if (ver.state === ScheduleState.DRAFT)
                        continue;
                    try {
                        const r = await this._rebuildVersion(ver);
                        checked++;
                        if (r.ok)
                            repaired++;
                        else {
                            ver.state = ScheduleState.NEEDS_REPAIR;
                            needsRepair++;
                        }
                    }
                    catch (err) {
                        // Network/controller failures defer revalidation. They never mean the
                        // physical railway was deleted, and the validated cached path remains usable.
                        this.deferred = true;
                        console.warn('Schedule V2 revalidation deferred:', err);
                        return { deferred: true, checked, repaired, needsRepair, error: String((err as { message?: string })?.message || err) };
                    }
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }
            for (const r of this.game.rotationV2.rotations)
                this.game.rotationV2.recalculateRotation(r.id);
            this.lastRun = new Date().toISOString();
            this.game.saveState?.();
            this.game.ui?.renderSchedulesList?.();
            this.game.ui?.rotationV2Editor?.render?.();
            return { deferred: false, checked, repaired, needsRepair };
        }
        finally {
            this.running = false;
        }
    }
}
export default ScheduleV2Revalidator;


// S3_STRUCT_V2_TEMP
type __S3Struct1127 = { constraints: Array<{ id: unknown; legIndex: unknown; order: number }> };
