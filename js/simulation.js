import { samePhysicalMovement } from './physical-service-identity.js';
import { resolveRailSpeedLimits } from './rail-speed.js';
// simulation.js - High-fidelity railway physics and infrastructure simulation layer
import { cantonLengthKm } from './signaling.js';
function buildServiceLookupFrame(services) {
    const byId = new Map();
    for (let index = 0; index < services.length; index++) {
        const service = services[index];
        // Match Array.find even for an invalid duplicate-ID legacy save.
        if (!byId.has(service.id))
            byId.set(service.id, { service, index });
    }
    return { services, length: services.length, indexed: true, byId };
}
/**
 * Precise geodesic distance using Haversine formula.
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Midnight-safe minute difference, clamped to [-720, 720]
export function timeDiff(a, b) {
    let d = a - b;
    if (d > 720)
        d -= 1440;
    else if (d < -720)
        d += 1440;
    return d;
}
/**
 * Pre-analyze a route: compute per-segment distances, speeds, and estimated travel times.
 * @param {Array} route - Array of { lat, lon, maxSpeed, tracks }
 * @param {number} trainMaxSpeed - Train's physical speed limit (km/h)
 * @returns {{ segments: Array, totalDistance: number, estimatedTimeMinutes: number }}
 */
export function analyzeRoute(route, trainMaxSpeed) {
    if (!route || route.length < 2) {
        return { segments: [], totalDistance: 0, estimatedTimeMinutes: 0 };
    }
    const segments = [];
    let totalDistance = 0;
    let totalTimeMinutes = 0;
    const resolved = resolveRailSpeedLimits(route, trainMaxSpeed);
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i];
        const to = route[i + 1];
        const distance = haversineDistance(from.lat, from.lon, to.lat, to.lon);
        const segmentMaxSpeed = resolved[i + 1];
        const effectiveSpeed = Math.min(trainMaxSpeed, segmentMaxSpeed);
        const timeMinutes = effectiveSpeed > 0 ? (distance / effectiveSpeed) * 60 : 0;
        totalDistance += distance;
        totalTimeMinutes += timeMinutes;
        segments.push({
            index: i,
            from,
            to,
            distance,
            maxSpeed: segmentMaxSpeed,
            effectiveSpeed,
            timeMinutes,
            cumulativeDistance: totalDistance,
        });
    }
    // No margin — raw physics time for accurate delay calculation
    const estimatedTimeMinutes = totalTimeMinutes;
    return { segments, totalDistance, estimatedTimeMinutes };
}
/**
 * Canton (block section) for railway signaling.
 */
class Canton {
    constructor(id, startIndex, endIndex, resourceIds = []) {
        this.id = id;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.occupiedBy = null;
        this.reservedBy = null;
        // Atomic physical OSM/geometry segments covered by this virtual signal block.
        // Two services may cut their virtual block boundaries differently, but any
        // shared rail segment remains a single safety resource.
        this.resourceIds = new Set(resourceIds);
    }
}
/**
 * Determines the target block length (km) based on line speed (SIG-01).
 * Higher speeds require longer blocks for safe braking distance.
 */
function getBlockLength(speed) {
    return cantonLengthKm(speed);
}
/**
 * Manages the cantonnement (block signaling) system.
 * Prevents two trains from occupying the same block section.
 */
export class CantonManager {
    _ensureAssignment(a) {
        if (!a || this.cantons.has(a.cantonId))
            return;
        const c = new Canton(a.cantonId, a.startIndex, a.endIndex, a.resourceIds || []);
        this.cantons.set(a.cantonId, c);
        this._registerCantonResources(c, a.resourceIds || []);
    }
    _assignmentIndex(assignments, index) {
        const generated = this._generatedTables.get(assignments);
        if (!generated || generated.length !== assignments.length)
            return assignments.findIndex(a => index >= a.startIndex && index < a.endIndex);
        let lo = 0, hi = assignments.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (assignments[mid].endIndex <= index)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo < assignments.length && assignments[lo].startIndex <= index ? lo : -1;
    }
    /** Index service identities once for a synchronous movement tick. The
     * returned finalizer restores nested scopes and releases every reference. */
    beginServiceLookupFrame(services) {
        const previous = this._serviceLookupFrame;
        // An idle tick must not scan a large timetable merely to open a scope.
        this._serviceLookupFrame = { services, length: services.length, indexed: false, byId: new Map() };
        return () => { this._serviceLookupFrame = previous; };
    }
    /** Station-resource IDs in old saves may be numeric or textual. Keep that
     * compatibility without rescanning the entire fleet for every platform.
     * This index contains live references and lives only for a synchronous tick.
     */
    findResourceOwner(services, id) {
        const key = String(id);
        let frame = this._serviceLookupFrame;
        if (!frame)
            return services.find(service => String(service?.id) === key);
        if (frame.services !== services || frame.length !== services.length) {
            frame = this._serviceLookupFrame = { services, length: services.length, indexed: false, byId: new Map() };
        }
        const rebuild = () => {
            const owners = new Map();
            for (let index = 0; index < services.length; index++) {
                const service = services[index];
                if (service && !owners.has(String(service.id)))
                    owners.set(String(service.id), { service, index });
            }
            frame.resourceById = owners;
            return owners;
        };
        let owners = frame.resourceById || rebuild();
        let entry = owners.get(key);
        if (entry && (services[entry.index] !== entry.service || String(entry.service.id) !== key)) {
            owners = rebuild();
            entry = owners.get(key);
        }
        if (!entry) {
            // A same-length replacement/rename may add an identity mid-tick.
            // Never free a resource merely because the acceleration index missed it.
            const current = services.find(service => String(service?.id) === key);
            if (current) {
                owners = rebuild();
                entry = owners.get(key);
            }
        }
        return entry?.service;
    }
    _lookupPresenceService(services, id) {
        let frame = this._serviceLookupFrame;
        if (!frame)
            return services.find(service => service.id === id);
        if (!frame.indexed || frame.services !== services || frame.length !== services.length) {
            frame = this._serviceLookupFrame = buildServiceLookupFrame(services);
        }
        let entry = frame.byId.get(id);
        // Direct legacy array edits/reorders are still supported. Validate the
        // actual slot, not only array length or a manually maintained revision.
        if (entry && (services[entry.index] !== entry.service || entry.service.id !== id)) {
            frame = this._serviceLookupFrame = buildServiceLookupFrame(services);
            entry = frame.byId.get(id);
        }
        if (!entry) {
            // A same-length replacement may introduce a new ID mid-tick. A
            // miss falls back to the authoritative array: never free its track
            // merely because a stale acceleration index did not know it.
            const index = services.findIndex(service => service.id === id);
            if (index >= 0) {
                frame = this._serviceLookupFrame = buildServiceLookupFrame(services);
                entry = frame.byId.get(id);
            }
        }
        return entry?.service;
    }
    constructor() {
        this._serviceLookupFrame = null;
        // Tables generated by this manager are immutable during use. External/test
        // tables retain the linear compatibility path; the cache holds no train state.
        this._generatedTables = new WeakMap();
        this.cantons = new Map();
        this.routeCantons = new Map();
        this.trainCantons = new Map();
        this.resourceCantons = new Map(); // physical segment key -> virtual canton IDs
        this.currentTime = 0;
    }
    setTime(timeOfDay) {
        this.currentTime = timeOfDay;
    }
    setTrainSeparation(trainId, minutes) {
        // No-op : l'écart temporel fixe est supprimé, c'est la signalisation (canton
        // occupé/réservé) qui gère l'espacement entre trains.
    }
    /**
     * Geographic key for a canton, quantized to ~11m precision.
     * Routes sharing physical track produce the same canton keys.
     */
    _geoKey(lat1, lon1, lat2, lon2, trackSig = '') {
        // Sort coordinates to ensure symmetric keys: A→B and B→A produce the same canton ID.
        // v1.1.73 also includes physical OSM way identity so parallel tracks sharing
        // endpoints cannot collapse into the same safety resource.
        const a = `${lat1.toFixed(5)},${lon1.toFixed(5)}`;
        const b = `${lat2.toFixed(5)},${lon2.toFixed(5)}`;
        const geo = a < b ? `${a}|${b}` : `${b}|${a}`;
        return `${geo}|w:${String(trackSig || 'unknown')}`;
    }
    _physicalSegmentKey(a, b) {
        if (!a || !b)
            return '';
        const ca = `${Number(a.lat || 0).toFixed(5)},${Number(a.lon || 0).toFixed(5)}`;
        const cb = `${Number(b.lat || 0).toFixed(5)},${Number(b.lon || 0).toFixed(5)}`;
        const geo = ca < cb ? `${ca}|${cb}` : `${cb}|${ca}`;
        const way = String(a.wayId || b.wayId || 'unknown');
        return `${geo}|w:${way}`;
    }
    _registerCantonResources(canton, resourceIds) {
        if (!canton)
            return;
        for (const rid of resourceIds || []) {
            if (!rid)
                continue;
            canton.resourceIds.add(rid);
            if (!this.resourceCantons.has(rid))
                this.resourceCantons.set(rid, new Set());
            this.resourceCantons.get(rid).add(canton.id);
        }
    }
    _conflictingCantonOnResources(canton, trainId) {
        if (!canton?.resourceIds?.size)
            return null;
        for (const rid of canton.resourceIds) {
            const ids = this.resourceCantons.get(rid);
            if (!ids)
                continue;
            for (const cid of ids) {
                const other = this.cantons.get(cid);
                if (!other)
                    continue;
                for (const field of ['occupiedBy', 'reservedBy']) {
                    const owner = other[field];
                    if (owner == null || samePhysicalMovement(owner, trainId))
                        continue;
                    if (this._isTrainGone(owner))
                        other[field] = null;
                    else
                        return { canton: other, resourceId: rid, owner, field };
                }
            }
        }
        return null;
    }
    _routeKey(route) {
        if (!route || route.length < 2)
            return null;
        // v1.1.71 — endpoints + point count are not enough: two parallel or diverging
        // geometries can share both and must never reuse the same canton table.
        const last = route.length - 1;
        const indices = [...new Set([0, Math.round(last * 0.25), Math.round(last * 0.50), Math.round(last * 0.75), last])];
        const sample = indices.map((i) => {
            const q = route[i] || {};
            return `${Number(q.lat || 0).toFixed(5)},${Number(q.lon || 0).toFixed(5)}:${String(q.wayId || '')}:${Number(q.maxSpeed || 0)}`;
        }).join('>');
        return `${route.length}|${sample}`;
    }
    /**
     * Create cantons for a route. Returns array of canton assignments.
     * Block boundaries are determined by speed-dependent block lengths.
     */
    createRouteCantons(route) {
        if (!route || route.length < 2)
            return [];
        const routeKey = this._routeKey(route);
        if (this.routeCantons.has(routeKey))
            return this.routeCantons.get(routeKey) ?? [];
        const resolved = resolveRailSpeedLimits(route, 160);
        const assignments = [];
        let blockStartIdx = 0;
        let blockDist = 0;
        let routeKm = 0;
        let blockStartKm = 0;
        for (let i = 0; i < route.length - 1; i++) {
            const segDist = haversineDistance(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
            const speed = resolved[i + 1];
            const targetBlockLength = getBlockLength(speed);
            blockDist += segDist;
            routeKm += segDist;
            if (blockDist >= targetBlockLength || i === route.length - 2) {
                const endIdx = i + 1;
                const wayIds = [...new Set(route.slice(blockStartIdx, endIdx + 1)
                        .map((q) => q?.wayId).filter((v) => v != null && v !== ''))].map(String).sort();
                const trackSig = wayIds.join(',');
                const cantonId = this._geoKey(route[blockStartIdx].lat, route[blockStartIdx].lon, route[endIdx].lat, route[endIdx].lon, trackSig);
                const resourceIds = [];
                for (let j = blockStartIdx; j < endIdx; j++) {
                    const rid = this._physicalSegmentKey(route[j], route[j + 1]);
                    if (rid)
                        resourceIds.push(rid);
                }
                let canton = this.cantons.get(cantonId);
                if (!canton) {
                    canton = new Canton(cantonId, blockStartIdx, endIdx, resourceIds);
                    this.cantons.set(cantonId, canton);
                }
                this._registerCantonResources(canton, resourceIds);
                assignments.push({
                    cantonId,
                    startIndex: blockStartIdx,
                    endIndex: endIdx,
                    startKm: blockStartKm,
                    endKm: routeKm,
                    trackSig,
                    resourceIds,
                });
                blockStartIdx = endIdx;
                blockStartKm = routeKm;
                blockDist = 0;
            }
        }
        this._generatedTables.set(assignments, { length: assignments.length, ids: new Set(assignments.map(a => a.cantonId)) });
        this.routeCantons.set(routeKey, assignments);
        return assignments;
    }
    /**
     * Find which canton assignment a segment index falls into.
     */
    getCantonForSegment(assignments, segmentIndex) {
        const index = this._assignmentIndex(assignments, segmentIndex);
        if (index < 0)
            return null;
        this._ensureAssignment(assignments[index]);
        return assignments[index];
    }
    /**
     * Get the next canton after the one containing the given segment index.
     */
    getNextCanton(assignments, segmentIndex) {
        const idx = this._assignmentIndex(assignments, segmentIndex);
        return (idx >= 0 && idx < assignments.length - 1) ? assignments[idx + 1] : null;
    }
    reserve(cantonId, trainId) {
        const c = this.cantons.get(cantonId);
        if (!c)
            return true;
        // HOTFIX13 — reservation must apply the SAME stale-owner cleanup as
        // occupy()/isAvailable(). reserveNextAhead() is the departure interlocking
        // path; previously a dead/blocked_route service could leave reservedBy behind
        // forever and every following train would sit at 0 km/h with [BLOQUE].
        if (c.occupiedBy && !samePhysicalMovement(c.occupiedBy, trainId)) {
            if (!this._isTrainGone(c.occupiedBy))
                return false;
            c.occupiedBy = null;
        }
        if (c.reservedBy && !samePhysicalMovement(c.reservedBy, trainId)) {
            if (!this._isTrainGone(c.reservedBy))
                return false;
            c.reservedBy = null;
        }
        if (this._conflictingCantonOnResources(c, trainId))
            return false;
        c.reservedBy = trainId;
        this._trackCanton(trainId, cantonId);
        return true;
    }
    occupy(cantonId, trainId) {
        const c = this.cantons.get(cantonId);
        if (!c)
            return true;
        // Fail closed for BOTH physical occupation and an interlocking reservation.
        // A direct occupy() must never steal a block already reserved by another live train.
        if (c.occupiedBy && !samePhysicalMovement(c.occupiedBy, trainId)) {
            if (!this._isTrainGone(c.occupiedBy))
                return false;
            c.occupiedBy = null;
        }
        if (c.reservedBy && !samePhysicalMovement(c.reservedBy, trainId)) {
            if (!this._isTrainGone(c.reservedBy))
                return false;
            c.reservedBy = null;
        }
        if (this._conflictingCantonOnResources(c, trainId))
            return false;
        if (c.occupiedBy == null || c.occupiedBy === trainId)
            c.occupiedBy = trainId;
        if (c.reservedBy === trainId)
            c.reservedBy = null;
        this._trackCanton(trainId, cantonId);
        return true;
    }
    release(cantonId, trainId) {
        const c = this.cantons.get(cantonId);
        if (!c)
            return;
        if (c.occupiedBy === trainId) {
            c.occupiedBy = null;
        }
        if (c.reservedBy === trainId) {
            c.reservedBy = null;
        }
        const tc = this.trainCantons.get(trainId);
        if (tc)
            tc.delete(cantonId);
    }
    isAvailable(cantonId, trainId) {
        const c = this.cantons.get(cantonId);
        if (!c)
            return true;
        // Verify occupying/reserving train still exists and is active
        if (c.occupiedBy !== null && !samePhysicalMovement(c.occupiedBy, trainId)) {
            if (this._isTrainGone(c.occupiedBy)) {
                c.occupiedBy = null;
            }
            else
                return false;
        }
        if (c.reservedBy !== null && !samePhysicalMovement(c.reservedBy, trainId)) {
            if (this._isTrainGone(c.reservedBy)) {
                c.reservedBy = null;
            }
            else
                return false;
        }
        if (this._conflictingCantonOnResources(c, trainId))
            return false;
        return true;
    }
    _isTrainGone(id) {
        if (globalThis.window?.game?.depotManager?.hasPhysicalRescue?.(id))
            return false;
        const svcs = globalThis.window?.game?.scheduleCreator?.services;
        if (!svcs)
            return false;
        const s = globalThis.window?.game?.depotManager?.getPhysicalRescueService?.(id) || this._lookupPresenceService(svcs, id);
        if (!s)
            return true;
        // An immobilised train still physically occupies its track.
        if (s.active === false || s.completed || s.cancelled || (s.state === 'completed' || s.state === 'cancelled'))
            return true;
        if (!s.position)
            return true;
        // Logical `waiting` is NOT disappearance: pre-departure/stationary trains with
        // a physical position must continue to protect their footprint and throat.
        return false;
    }
    /** Coupling changes the controlling identity without briefly unlocking rail. */
    transferTrainResources(from, to) {
        const ids = this.getTrackedCantons(from);
        for (const id of ids) {
            const c = this.cantons.get(id);
            if (c && c.occupiedBy === from)
                c.occupiedBy = to;
            if (c && c.reservedBy === from)
                c.reservedBy = to;
            this._trackCanton(to, id);
        }
        this.trainCantons.delete(from);
        return ids;
    }
    getTrackedCantons(trainId) {
        return new Set(this.trainCantons.get(trainId) || []);
    }
    releaseAll(trainId) {
        const ids = this.trainCantons.get(trainId);
        if (!ids)
            return;
        for (const cid of ids) {
            const c = this.cantons.get(cid);
            if (c) {
                if (c.occupiedBy === trainId) {
                    c.occupiedBy = null;
                }
                if (c.reservedBy === trainId) {
                    c.reservedBy = null;
                }
            }
        }
        ids.clear();
        this.trainCantons.delete(trainId);
    }
    /**
     * v1.1.73 — synchronize block OCCUPATION with the whole physical train, not
     * merely the head. frontKm is progression along the current route.
     * Returns false if any block under the physical footprint is occupied by
     * another live train; the caller must not advance into that footprint.
     */
    syncFootprint(trainId, assignments, frontKm, lengthM = 0, retainIds = null) {
        if (!Array.isArray(assignments) || !assignments.length)
            return true;
        const front = Math.max(0, Number(frontKm) || 0);
        const rear = Math.max(0, front - Math.max(0, Number(lengthM) || 0) / 1000);
        const eps = 1e-6;
        const generated = this._generatedTables.get(assignments);
        let desired;
        if (generated && generated.length === assignments.length) {
            let lo = 0, hi = assignments.length;
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (assignments[mid].endKm + eps < rear)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            desired = [];
            for (let i = lo; i < assignments.length && assignments[i].startKm - eps <= front; i++)
                desired.push(assignments[i]);
        }
        else
            desired = assignments.filter(a => Number(a.endKm) + eps >= rear && Number(a.startKm) - eps <= front);
        // Atomic pre-check: never partially move a footprint into another train.
        for (const a of desired) {
            this._ensureAssignment(a);
            if (!this.isAvailable(a.cantonId, trainId))
                return false;
        }
        const desiredIds = new Set(desired.map((a) => a.cantonId));
        if (retainIds)
            for (const cid of retainIds)
                desiredIds.add(cid);
        for (const a of desired)
            this.occupy(a.cantonId, trainId);
        // Keep an interlocking reservation ahead on THIS route even though the train
        // footprint has not reached it yet. Old-route/stale reservations are released.
        const routeIds = generated && generated.length === assignments.length ? generated.ids : new Set(assignments.map(a => a.cantonId));
        const tracked = new Set(this.trainCantons.get(trainId) || []);
        for (const cid of tracked) {
            const c = this.cantons.get(cid);
            const ownAheadReservation = routeIds.has(cid) && c?.reservedBy === trainId && c?.occupiedBy !== trainId;
            if (!desiredIds.has(cid) && !ownAheadReservation)
                this.release(cid, trainId);
        }
        return true;
    }
    /**
     * Reserve the next distinct block before the train reaches its boundary.
     * Returns null when no reservation is needed, or a descriptor with blocked=true
     * when another movement owns/conflicts with that physical rail resource.
     */
    reserveNextAhead(assignments, segmentIndex, trainId, frontKm = 0, horizonM = Infinity) {
        if (!Array.isArray(assignments) || !assignments.length)
            return null;
        const currentIdx = this._assignmentIndex(assignments, segmentIndex);
        const nextIdx = currentIdx + 1;
        if (nextIdx < 0 || nextIdx >= assignments.length)
            return null;
        const a = assignments[nextIdx];
        const distanceKm = Math.max(0, Number(a.startKm || 0) - Number(frontKm || 0));
        const maxKm = Number.isFinite(horizonM) ? Math.max(0, Number(horizonM)) / 1000 : Infinity;
        if (distanceKm > maxKm)
            return null;
        this._ensureAssignment(a);
        if (!this.reserve(a.cantonId, trainId)) {
            return { assignment: a, distanceM: distanceKm * 1000, index: nextIdx, blocked: true };
        }
        return { assignment: a, distanceM: distanceKm * 1000, index: nextIdx, blocked: false };
    }
    /** Returns the first unavailable physical block ahead, including metric distance. */
    firstUnavailableAhead(assignments, segmentIndex, trainId, frontKm = 0, horizonM = Infinity) {
        if (!Array.isArray(assignments))
            return null;
        let idx = this._assignmentIndex(assignments, segmentIndex) + 1;
        const maxKm = Number.isFinite(horizonM) ? Math.max(0, horizonM) / 1000 : Infinity;
        for (; idx < assignments.length; idx++) {
            const a = assignments[idx];
            const distanceKm = Math.max(0, Number(a.startKm || 0) - Number(frontKm || 0));
            if (distanceKm > maxKm)
                break;
            this._ensureAssignment(a);
            if (!this.isAvailable(a.cantonId, trainId))
                return { assignment: a, distanceM: distanceKm * 1000, index: idx };
        }
        return null;
    }
    /**
     * Periodic cleanup: remove cantons that are not occupied/reserved
     * and route cache entries exceeding limit. Call periodically (e.g. every 5 min).
     */
    cleanup() {
        // Evict routeCantons cache if too large (max 200 entries)
        if (this.routeCantons.size > 200) {
            const keys = Array.from(this.routeCantons.keys());
            for (let i = 0; i < keys.length - 100; i++) {
                this.routeCantons.delete(keys[i]);
            }
        }
        // Remove idle cantons (not occupied, not reserved, not tracked by any train)
        const activeCantonIds = new Set();
        for (const [, ids] of this.trainCantons) {
            for (const cid of ids)
                activeCantonIds.add(cid);
        }
        // RC19: a currently empty block can still be ahead of a running train.
        // Do not destroy infrastructure referenced by a route cache or live service.
        for (const table of this.routeCantons.values())
            for (const a of table)
                activeCantonIds.add(a.cantonId);
        const game = typeof window !== 'undefined' ? window.game : null;
        const live = [...(game?.scheduleCreator?.getActiveServices?.() || game?.scheduleCreator?.services || []), ...(game?.depotManager?.getPhysicalRescueServices?.() || [])];
        for (const service of live)
            for (const a of service?._cantonAssignments || [])
                activeCantonIds.add(a.cantonId);
        for (const [cid, c] of this.cantons) {
            if (!c.occupiedBy && !c.reservedBy && !activeCantonIds.has(cid)) {
                this.cantons.delete(cid);
                for (const rid of c.resourceIds || []) {
                    const ids = this.resourceCantons.get(rid);
                    if (!ids)
                        continue;
                    ids.delete(cid);
                    if (!ids.size)
                        this.resourceCantons.delete(rid);
                }
            }
        }
    }
    /**
     * Get signal aspect for a train at a given position.
     * Returns: null (green/clear), 30 (yellow/caution), or 0 (red/stop).
     */
    /** The same entry-block predicate drives drawing and movement. An own
     * reservation is not a yellow lamp; yellow announces the next closed block. */
    getEntrySignalAspect(assignments, entryIndex, trainId) {
        const first = assignments[entryIndex];
        if (!first)
            return null;
        this._ensureAssignment(first);
        if (!this.isAvailable(first.cantonId, trainId))
            return 0;
        const second = assignments[entryIndex + 1];
        if (second) {
            this._ensureAssignment(second);
            if (!this.isAvailable(second.cantonId, trainId))
                return 30;
        }
        return null;
    }
    getSignalAspect(assignments, segmentIndex, trainId) {
        const current = this._assignmentIndex(assignments, segmentIndex);
        return current < 0 ? null : this.getEntrySignalAspect(assignments, current + 1, trainId);
    }
    _trackCanton(trainId, cantonId) {
        if (!this.trainCantons.has(trainId)) {
            this.trainCantons.set(trainId, new Set());
        }
        this.trainCantons.get(trainId).add(cantonId);
    }
}
