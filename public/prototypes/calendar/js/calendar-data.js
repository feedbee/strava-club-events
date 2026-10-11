import { getLocalDateKey } from "../shared/js/event-list.js";

// Object identity preserves distinct occurrences even when timestamps coincide.
export function indexCalendarEvents(events) {
  const days = new Map();
  const positions = new Map();
  events.forEach((event, index) => {
    positions.set(event, index);
    const key = getLocalDateKey(new Date(event.start));
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(event);
  });
  for (const dayEvents of days.values()) {
    dayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  }
  return { days, positions };
}
