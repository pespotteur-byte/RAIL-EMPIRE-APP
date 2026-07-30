// Shared helpers and mutable ID counters used by services.
export const serviceCounters = {
  nextServiceId: 1,
  nextServiceNumber: 1,
};

// Midnight-safe time difference: handles wrapping around 00:00
// Returns difference in minutes, clamped to [-720, 720]
export function timeDiff(timeA, timeB) {
  let d = timeA - timeB;
  if (d > 720) d -= 1440;
  else if (d < -720) d += 1440;
  return d;
}

// Midnight-safe "is timeA >= timeB"
export function timeGte(timeA, timeB) {
  return timeDiff(timeA, timeB) >= 0;
}

// Check if timeOfDay falls within a service window [start, end]
// Handles midnight-crossing services (e.g., depart 23:00, arrive 01:00)
export function isInServiceWindow(timeOfDay, start, end) {
  start = ((start % 1440) + 1440) % 1440;
  end = ((end % 1440) + 1440) % 1440;
  if (start <= end) {
    return timeOfDay >= start && timeOfDay <= end;
  }
  return timeOfDay >= start || timeOfDay <= end;
}

export function wrapTime(t) {
  const n = Number.isFinite(t) ? t % 1440 : 0;
  return n < 0 ? n + 1440 : n;
}

// Deterministic [0,1) pseudo-random from a string seed (does not advance global RNG)
export function _seeded01(seed) {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  h ^= h << 13; h >>>= 0;
  h ^= h >>> 17; h >>>= 0;
  h ^= h << 5; h >>>= 0;
  return (h >>> 0) / 4294967296;
}
