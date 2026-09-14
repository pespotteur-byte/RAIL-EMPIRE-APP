/** Physical material continuity. Display labels are never an override of an acquired track. */
import { canonicalTrackRef, normalizeStationTrackIdentity, stationTrackIdentityFromBinding, resolveNativeStationTrack, stationTrackResourceKey } from './station-track-identity.js';
const rec = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const label = (value) => (typeof value === 'string' || typeof value === 'number') ? String(value).trim().slice(0, 256) : '';
/** Detached copies only; saved locations must not share mutable editor bindings. */
export function materialTrackLocation(value) {
    const data = rec(value), binding = rec(data.track);
    const identity = normalizeStationTrackIdentity(data.trackIdentity) || stationTrackIdentityFromBinding(binding);
    const voiePointId = label(data.voiePointId ?? binding.voiePointId) || (identity?.kind === 'native' ? identity.id : null);
    const platform = label(data.platform ?? binding.displayName);
    if (!identity && !voiePointId && !platform)
        return {};
    return { trackIdentity: identity || (voiePointId ? normalizeStationTrackIdentity({ kind: 'native', id: voiePointId }) : null), voiePointId, platform };
}
function key(loc, stationId, nativeTracks) {
    const identity = loc.trackIdentity;
    if (identity) {
        const native = resolveNativeStationTrack(identity, stationId, nativeTracks);
        return native ? `@native:${native.id}` : stationTrackResourceKey(identity);
    }
    const ref = canonicalTrackRef(loc.platform);
    if (!ref)
        return '';
    const matching = nativeTracks.filter(t => String(t.stationId ?? '') === stationId && canonicalTrackRef(t.voie) === ref);
    return matching.length === 1 ? `@native:${matching[0].id}` : `label:${ref}`;
}
/** Unknown legacy starting locations may be placed once. Known tracks may not be erased by a later label. */
export function materialTrackMismatch(current, expected, stationId, nativeTracks = []) {
    const from = materialTrackLocation(current), to = materialTrackLocation(expected);
    for (const loc of [from, to]) {
        if (loc.trackIdentity?.kind !== 'native')
            continue;
        const native = nativeTracks.find(t => t.id === loc.trackIdentity.id);
        if (native && String(native.stationId ?? '') !== stationId)
            return true;
    }
    const a = from.trackIdentity, b = to.trackIdentity;
    // A way may be split by OSM without a physical track change. A real railway
    // reference may alias such pieces, but a player-supplied display name may not.
    if (a && b && a.kind === b.kind && a.id === b.id)
        return false;
    if (a?.kind === 'osm' && b?.kind === 'osm') {
        const ref = canonicalTrackRef(a.trackRef);
        const locals = nativeTracks.filter(t => String(t.stationId ?? '') === stationId && canonicalTrackRef(t.voie) === ref);
        if (ref && ref === canonicalTrackRef(b.trackRef) && locals.length <= 1)
            return false;
    }
    const source = key(from, stationId, nativeTracks), target = key(to, stationId, nativeTracks);
    if (!source)
        return false;
    if (!target)
        return !!from.trackIdentity;
    return source !== target;
}
