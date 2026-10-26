import { normalizeEventsResponse } from './events.js';

export const SNAPSHOT_MAX = 2 * 1024 * 1024;
export const SNAPSHOT_AGE = 24 * 60 * 60 * 1000;
export function filterCoverage(saved, requested) {
  return ['clubs', 'sports'].every(key => !saved[key]?.length ||
    (requested[key]?.length > 0 && requested[key].every(value => saved[key].includes(value))));
}
export function makeSnapshot(data, context, now = Date.now()) {
  const text = JSON.stringify({ version: 1, ...context, syncedAt: now, data });
  // Two UTF-16 bytes per code unit is a conservative bound for these local strings.
  return text.length * 2 <= SNAPSHOT_MAX ? text : null;
}
export function restoreSnapshot(text, context, now = Date.now()) {
  try {
    if (typeof text !== 'string' || text.length * 2 > SNAPSHOT_MAX) return null;
    const value = JSON.parse(text);
    if (value.version !== 1 || value.account !== context.account || value.backend !== context.backend ||
        !Number.isFinite(value.syncedAt) || now < value.syncedAt || now - value.syncedAt > SNAPSHOT_AGE ||
        !value.filters || !['clubs', 'sports'].every(key => Array.isArray(value.filters[key]) &&
          value.filters[key].length <= 10 && value.filters[key].every(item => typeof item === 'string'))) return null;
    const data = normalizeEventsResponse(value.data);
    if (data.events.some(event => typeof event.occurrence_id !== 'string' || typeof event.title !== 'string' || !event.club_info)) return null;
    return { ...value, data };
  } catch { return null; }
}
export function periodDays(date, mode) {
  const first = new Date(date); first.setHours(12, 0, 0, 0);
  if (mode === 'month') {
    first.setDate(1); first.setDate(1 - (first.getDay() + 6) % 7);
  } else if (mode === 'week') first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  const count = mode === 'month' ? 42 : mode === 'week' ? 7 : 1;
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(first); day.setDate(first.getDate() + i); return day;
  });
}
export function movePeriod(date, mode, direction) {
  const next = new Date(date); next.setHours(12, 0, 0, 0);
  if (mode === 'month') {
    const day = next.getDate(); next.setDate(1); next.setMonth(next.getMonth() + direction);
    next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  } else next.setDate(next.getDate() + direction * (mode === 'week' ? 7 : 1));
  return next;
}
// Visual 45-minute slots; columns prevent cards from hiding one another, including near starts.
/** @template {{start_date: string}} T @param {T[]} events */
export function timeSlots(events) {
  const slots = events.map(event => {
    const date = new Date(event.start_date);
    return { event, minute: date.getHours() * 60 + date.getMinutes(), column: 0, columns: 1 };
  }).sort((a, b) => a.minute - b.minute);
  let group = []; let end = -1;
  function finish() {
    const lanes = [];
    for (const slot of group) {
      let lane = lanes.findIndex(until => until <= slot.minute);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = slot.minute + 45; slot.column = lane;
    }
    for (const slot of group) slot.columns = lanes.length;
  }
  for (const slot of slots) {
    if (slot.minute >= end) { finish(); group = []; }
    group.push(slot); end = Math.max(end, slot.minute + 45);
  }
  finish(); return slots;
}
export function stravaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.strava.com' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
export function calendarEvent(event) {
  const startDate = new Date(event.start_date);
  if (!Number.isFinite(+startDate)) throw new Error('Invalid event date');
  const url = stravaUrl(event.strava_event_url);
  if (!url) throw new Error('Invalid Strava event URL');
  return { title: event.title, startDate, endDate: new Date(+startDate + 3600000),
    location: event.address || '', url,
    notes: `${event.club_info.name}\n${url}\nDuration is a placeholder. Edit the end time before saving. This copy will not update automatically.` };
}
