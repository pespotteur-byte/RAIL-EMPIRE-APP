// Time utility functions for midnight-safe schedule comparisons.
// Extracted from schedule-creator.js for testability and reuse.

/**
 * Midnight-safe time difference in minutes.
 * Returns difference (timeA - timeB), clamped to [-720, 720].
 */
export function timeDiff(timeA, timeB) {
  let d = timeA - timeB;
  if (d > 720) d -= 1440;
  else if (d < -720) d += 1440;
  return d;
}

/**
 * Midnight-safe "is timeA >= timeB".
 */
export function timeGte(timeA, timeB) {
  return timeDiff(timeA, timeB) >= 0;
}

/**
 * Check if timeOfDay falls within a service window [start, end].
 * Handles midnight-crossing services (e.g., depart 23:00, arrive 01:00).
 */
export function isInServiceWindow(timeOfDay, start, end) {
  start = ((start % 1440) + 1440) % 1440;
  end = ((end % 1440) + 1440) % 1440;
  if (start <= end) {
    return timeOfDay >= start && timeOfDay <= end;
  } else {
    return timeOfDay >= start || timeOfDay <= end;
  }
}
