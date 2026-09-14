/** Explicit game-model cab changes. A time allowance is not a run-around path. */
export const CAB_CHANGE_SECONDS = 300;
const controlUnit = (e) => {
    if (!e || e.hasCab === false)
        return false;
    if (e.isDrivingTrailer === true)
        return true;
    return Number(e.power) > 0 && /^(locomotive|automotrice|autorail)$/.test(String(e.category || '').toLowerCase());
};
export function assessTurnback(elements, reverse = true) {
    const signature = elements.map(e => [e.physicalVehicleId || e.elementId || e.catalogId || '', e.category, Number(e.power) || 0, !!e.isDrivingTrailer, e.hasCab !== false, !!e.flipped].join(':')).join('|');
    const fail = (mode, reason) => ({ allowed: false, mode, reason, signature });
    if (!elements.length)
        return fail('unknown_formation', 'rebroussement : composition ou cabines non renseignées');
    if (!elements.some(e => Number(e.power) > 0))
        return fail('missing_traction', 'rebroussement : aucun engin de traction actif');
    const head = elements[reverse ? elements.length - 1 : 0];
    if (!controlUnit(head))
        return fail('runaround_required', 'rebroussement : remise en tête / manœuvre physique requise');
    return { allowed: true, mode: 'cab_change', reason: 'rebroussement : changement de cabine (5 min minimum)', signature };
}
export function normalizeTurnbackState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const v = value;
    if (typeof v.key !== 'string' || !v.key || v.key.length > 512 || typeof v.signature !== 'string' || v.signature.length > 100000)
        return null;
    const modes = ['cab_change', 'runaround_required', 'missing_traction', 'unknown_formation'];
    if (!modes.includes(v.mode))
        return null;
    const start = v.startedAtSec == null ? null : Number(v.startedAtSec), end = v.readyAtSec == null ? null : Number(v.readyAtSec);
    if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end)))
        return null;
    if ((start === null) !== (end === null) || (start !== null && end !== null && end - start < CAB_CHANGE_SECONDS))
        return null;
    if (v.applied === true && (v.mode !== 'cab_change' || start === null))
        return null;
    return { key: v.key, signature: v.signature, startedAtSec: start, readyAtSec: end, applied: v.applied === true, mode: v.mode };
}
