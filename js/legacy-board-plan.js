import { civilDayIndex } from './legacy-operating-day.js';
const DAY = 1440;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const forward = (a, b) => { const d = b - a; return d >= 0 ? d : ((d % DAY) + DAY) % DAY; };
/** Resolve a leg chronologically. A midnight crossing belongs to its departure's civil date. */
function unroll(stops, start) {
    if (!stops.length)
        return [];
    let raw = stops[0].departureTime ?? stops[0].arrivalTime;
    if (!finite(raw))
        return [];
    let now = start ?? raw;
    return stops.map((s, i) => {
        const arr = finite(s.arrivalTime) ? s.arrivalTime : finite(s.departureTime) ? s.departureTime : raw;
        if (i > 0)
            now += forward(raw, arr);
        const arrival = now;
        const dep = finite(s.departureTime) ? s.departureTime : arr;
        if (i > 0)
            now += forward(arr, dep);
        raw = dep;
        return { ...s, arrivalTime: arrival, departureTime: now };
    });
}
/** Read-only forecasts, not invented runtime services. Weekdays and explicit dates both apply. */
export function legacyBoardRuns(service, date, now, horizon) {
    const today = civilDayIndex(date);
    if (today == null || !finite(now) || !finite(horizon) || horizon < 0)
        return [];
    const outbound = unroll(service.stops);
    if (outbound.length < 2)
        return [];
    const origin = outbound[0].departureTime, end = outbound.at(-1).arrivalTime;
    const dwell = Math.max(0, finite(service.terminusWait) ? service.terminusWait : 5);
    const ret = service.roundTrip && service.returnStops?.length ? unroll(service.returnStops, end + dwell) : [];
    const cycle = ret.length ? ret.at(-1).arrivalTime + dwell - origin : end - origin;
    const count = service.roundTrip && ret.length && Number.isSafeInteger(service.multiDepartures) && Number(service.multiDepartures) > 0 ? Number(service.multiDepartures) : 1;
    const span = Math.max(0, cycle) * count;
    const days = service.runDays ?? [0, 1, 2, 3, 4, 5, 6], dates = service.runDates ?? [];
    const out = [];
    // The legacy engine itself admits operating dates for at most 366 days of lookback.
    for (let offset = -Math.min(366, Math.ceil(span / DAY) + 1); offset <= Math.floor((now + horizon) / DAY); offset++) {
        const day = new Date((today + offset) * 86400000).toISOString().slice(0, 10);
        const pinned = service.operatingDay === day;
        if (!pinned && (!days.includes(((today + offset + 4) % 7 + 7) % 7) || dates.length && !dates.includes(day)))
            continue;
        if (service.completedDay && day <= service.completedDay || service.completed && day === service.operatingDay)
            continue;
        for (let turn = 0; turn < count; turn++) {
            const shift = offset * DAY + cycle * turn;
            if (origin + shift > now + horizon)
                break;
            const add = (leg, isReturn) => {
                if (!leg.length)
                    return;
                const live = (pinned || !service.operatingDay && day === date) && !!service.isReturnLeg === isReturn && (service.tripCount || 0) === turn + (isReturn ? 1 : 0) && !service.completed;
                let stops = leg.map(s => ({ ...s, arrivalTime: s.arrivalTime + shift, departureTime: s.departureTime + shift }));
                if (live && service.currentStops?.length) {
                    const base = unroll(service.currentStops);
                    if (base.length) {
                        const delta = Math.round((leg[0].departureTime + cycle * turn - base[0].departureTime) / DAY) * DAY;
                        stops = base.map(s => ({ ...s, arrivalTime: s.arrivalTime + offset * DAY + delta, departureTime: s.departureTime + offset * DAY + delta }));
                    }
                }
                if (stops.at(-1).arrivalTime < now - 3 && !live)
                    return;
                out.push({ key: `${service.id}:${day}:${turn}:${isReturn ? 'R' : 'A'}`, day, isReturn, live, stops });
            };
            add(outbound, false);
            add(ret, true);
        }
    }
    return out;
}
