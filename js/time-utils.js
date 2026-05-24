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
  // Normalize to [0, 1440)
  start = ((start % 1440) + 1440) % 1440;
  end = ((end % 1440) + 1440) % 1440;
  if (start <= end) {
    return timeOfDay >= start && timeOfDay <= end;
  } else {
    // Midnight-crossing
    return timeOfDay >= start || timeOfDay <= end;
  }
}
