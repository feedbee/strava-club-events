// Navigation covers whole local months; event availability remains a rolling 90-day window.
export function calendarBounds(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 12),
    end: new Date(now.getFullYear(), now.getMonth() + 4, 0, 12),
  };
}
export function clampCalendarDate(date, bounds) {
  const local = new Date(date);
  local.setHours(12, 0, 0, 0);
  return new Date(Math.max(+bounds.start, Math.min(+bounds.end, +local)));
}
