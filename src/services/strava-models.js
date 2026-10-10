// Allow only consumed provider fields, including inside nested objects.
const invalid = () => Object.assign(new Error('Invalid Strava resource response'), { status: 502 });
function resource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const id = value.id;
  if (!(typeof id === 'string' && id.length > 0) && !(Number.isSafeInteger(id) && id >= 0)) throw invalid();
  return value;
}
function fields(value, strings, numbers = []) {
  const result = { id: resource(value).id };
  for (const name of strings) if (typeof value[name] === 'string') result[name] = value[name];
  for (const name of numbers) if (typeof value[name] === 'number' && Number.isFinite(value[name])) result[name] = value[name];
  return result;
}
export function clubRecord(value) {
  return fields(value, ['name', 'profile_medium', 'sport_type', 'localized_sport_type']);
}
export function eventRecord(value) {
  const result = fields(value, ['title', 'address', 'activity_type'], ['terrain', 'skill_levels']);
  result.joined = value.joined === true;
  result.upcoming_occurrences = Array.isArray(value.upcoming_occurrences)
    ? value.upcoming_occurrences.filter(date => typeof date === 'string' && Number.isFinite(Date.parse(date))) : [];
  if (value.route && typeof value.route === 'object' && !Array.isArray(value.route)) {
    // An invalid embedded route does not prevent displaying the event itself.
    try { result.route = fields(value.route, ['name']); } catch { /* use basic route fallback */ }
  }
  return result;
}
export function routeRecord(value) {
  return fields(value, ['name'], ['resource_state', 'distance', 'elevation_gain', 'type', 'sub_type',
    'estimated_moving_time', 'maximum_grade', 'elevation_high', 'elevation_low']);
}
export function resourceList(value, project) {
  if (!Array.isArray(value)) throw invalid();
  return value.map(project);
}
