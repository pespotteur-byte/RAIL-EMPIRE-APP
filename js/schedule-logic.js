export const DEFAULT_TERMINUS_WAIT_MIN = 5;
export const SKIP_PROBABILITY = 0.5;
export function toOdd(n) {
    const v = Math.max(1, Math.floor(Number(n) || 1));
    return v % 2 === 0 ? v + 1 : v;
}
export function returnNumberFor(forwardNumber) { return toOdd(forwardNumber) + 1; }
export function incrementForward(baseOdd, k = 1) { return toOdd(baseOdd) + 2 * Math.max(0, Math.floor(k)); }
export function incrementTrailingNumber(name, delta = 2) {
    const s = String(name || '');
    const m = s.match(/^(.*?)(\d+)$/);
    if (!m) {
        const n = 1 + delta;
        if (n < 0)
            return s;
        return `${s} ${n}`;
    }
    const prefix = m[1];
    const num = parseInt(m[2], 10);
    const padLen = m[2].length;
    return prefix + String(num + delta).padStart(padLen, '0');
}
export function parseStopType(label) {
    const raw = (label == null ? '' : String(label)).trim();
    const bracketed = raw.match(/[[(]\s*([CS])\s*[\])]\s*$/i);
    if (bracketed)
        return { code: bracketed[1].toUpperCase(), skippable: true, clean: raw.slice(0, bracketed.index).trim() };
    const bare = raw.match(/\s([CS])$/);
    if (bare)
        return { code: bare[1].toUpperCase(), skippable: false, clean: raw.slice(0, bare.index).trim() };
    return { code: null, skippable: false, clean: raw };
}
export function rollSkip(rng = Math.random) { return rng() < SKIP_PROBABILITY; }
export function shouldSkipStop(label, rng = Math.random) { return parseStopType(label).skippable && rollSkip(rng); }
export function interpolatePassageTimes(depTimeA, arrTimeB, cumDistsKm) {
    if (!Array.isArray(cumDistsKm) || cumDistsKm.length === 0)
        return [];
    const total = cumDistsKm[cumDistsKm.length - 1] || 0;
    const span = arrTimeB - depTimeA;
    return cumDistsKm.map(d => total <= 0 ? depTimeA : depTimeA + span * (d / total));
}
