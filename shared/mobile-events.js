import { normalizeEventsResponse } from './events.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw new Error('Invalid mobile events response'); };
function id(value) {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  return invalid();
}
function text(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : invalid();
}
function record(value, stringFields) {
  if (!object(value)) return invalid();
  return Object.fromEntries(stringFields.map(key => [key, text(value[key])]));
}
export function normalizeMobileUser(value) {
  if (!object(value) || typeof value.id !== 'string' || !value.id ||
      !Number.isSafeInteger(value.athleteId) || value.athleteId < 1) return invalid();
  return { id: value.id, athleteId: value.athleteId,
    ...record(value, ['firstname', 'lastname', 'username', 'profile_pic']) };
}
// Network and local storage are both untrusted boundaries. Project only native DTO fields.
export function normalizeMobileEvents(value) {
  if (!object(value) || !Array.isArray(value.events) || !Array.isArray(value.clubs)) return invalid();
  const clubs = value.clubs.map(club => ({ ...record(club, ['name', 'sport_type', 'localized_sport_type']), id: id(club.id) }));
  if (new Set(clubs.map(club => club.id)).size !== clubs.length) return invalid();
  const events = value.events.map(event => {
    if (!object(event) || typeof event.occurrence_id !== 'string' || !event.occurrence_id ||
        typeof event.title !== 'string' || typeof event.start_date !== 'string' ||
        (event.joined !== undefined && typeof event.joined !== 'boolean')) return invalid();
    const result = { ...record(event, ['title', 'start_date', 'strava_event_url', 'address', 'terrain_label', 'skill_level_label']),
      occurrence_id: event.occurrence_id, joined: event.joined === true,
      club_info: { ...record(event.club_info, ['name', 'logo']), id: id(event.club_info.id) } };
    if (event.id !== undefined) result.id = id(event.id);
    if (event.route_info != null) result.route_info = {
      ...record(event.route_info, ['name', 'distance', 'elevation_gain', 'estimated_moving_time', 'activity_type', 'max_slope']),
      ...(event.route_info.id != null ? { id: id(event.route_info.id) } : {}),
    };
    if (event.route_details_failed !== undefined) {
      if (typeof event.route_details_failed !== 'boolean') return invalid();
      result.route_details_failed = event.route_details_failed;
    }
    return result;
  });
  let meta = null;
  if (value.meta != null) {
    if (!object(value.meta)) return invalid();
    meta = {};
    for (const key of ['partial', 'clubs_limited', 'clubs_fetch_limited', 'events_limited']) {
      if (value.meta[key] === undefined) continue;
      if (typeof value.meta[key] !== 'boolean') return invalid();
      meta[key] = value.meta[key];
    }
    for (const key of ['retry_after', 'routes_failed', 'clubs_failed', 'clubs_total', 'clubs_processed', 'routes_skipped']) {
      if (value.meta[key] == null) continue;
      if (!Number.isSafeInteger(value.meta[key]) || value.meta[key] < 0) return invalid();
      meta[key] = value.meta[key];
    }
    if (value.meta.limits != null) {
      if (!object(value.meta.limits)) return invalid();
      meta.limits = {};
      for (const key of ['clubs', 'clubs_fetch', 'events_per_club', 'routes']) {
        const count = value.meta.limits[key];
        if (count === undefined) continue;
        if (!Number.isSafeInteger(count) || count < 1) return invalid();
        meta.limits[key] = count;
      }
    }
    if (value.meta.errors !== undefined) {
      if (!Array.isArray(value.meta.errors)) return invalid();
      meta.errors = value.meta.errors.map(error => {
        if (!object(error)) return invalid();
        return { club_id: id(error.club_id) };
      });
    }
  }
  return normalizeEventsResponse({ events, clubs, meta });
}
