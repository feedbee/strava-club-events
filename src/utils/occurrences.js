const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Strava supplies concrete instants; do not invent recurrences or shift their time zone.
export function upcomingOccurrences(values, now = new Date()) {
  if (!Array.isArray(values)) return [];
  const start = now.getTime();
  const end = start + WINDOW_MS;
  const instants = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const instant = new Date(value).getTime();
    if (Number.isFinite(instant) && instant >= start && instant <= end) instants.add(instant);
  }
  return [...instants].sort((a, b) => a - b).map(instant => new Date(instant));
}
