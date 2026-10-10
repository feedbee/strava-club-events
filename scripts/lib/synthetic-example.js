// Model examples preserve known field shapes, never original provider values.
const knownFields = new Set(`id resource_state name id_str map summary_polyline map_urls url retina_url light_url dark_url
 title description club_id club organizing_athlete username firstname lastname bio city state country sex premium summit
 created_at updated_at badge_type_id profile_medium profile friend follower blocked can_follow activity_type route_id route
 women_only private skill_levels terrain upcoming_occurrences zone address joined start_latlng athlete weight distance
 elevation_gain polyline starred sub_type timestamp type estimated_moving_time waypoints segments average_grade maximum_grade
 elevation_high elevation_low end_latlng elevation_profile elevation_profiles climb_category hazardous cover_photo
 cover_photo_small activity_types activity_types_icon dimensions sport_type localized_sport_type member_count featured verified
 viewer_permissions edit start_datetime frequency days_of_week weekly_interval membership admin owner club_type following_count
 website lat lng latitude longitude`.split(/\s+/));
const strings = {
  name: 'Example resource', title: 'Example group ride', description: 'Synthetic model example.',
  username: 'example-athlete', firstname: 'Example', lastname: 'Athlete', bio: 'Synthetic athlete profile.',
  city: 'Example city', state: 'Example region', country: 'Example country', sex: 'F',
  address: 'Example meeting point', activity_type: 'Ride', sport_type: 'cycling', localized_sport_type: 'Cycling',
  zone: 'Etc/UTC', frequency: 'weekly', days_of_week: 'tuesday', membership: 'member', club_type: 'casual',
  activity_types: 'Ride', activity_types_icon: 'cycling', polyline: '', summary_polyline: ''
};
export function parseExampleJson(text) {
  // Node 24 exposes the original numeric token to JSON.parse's reviver.
  return JSON.parse(text, (key, value, context) => {
    if ((key === 'id' || key.endsWith('_id')) && typeof value === 'number' && !Number.isSafeInteger(value)) {
      return context.source;
    }
    return value;
  });
}
export function createExampleSanitizer() {
  const identifiers = new Map();
  function id(value) {
    const key = String(value);
    if (!identifiers.has(key)) {
      const index = identifiers.size + 1;
      identifiers.set(key, /^\d{16,}$/.test(key) ? String(9000000000000000000n + BigInt(index)) : String(900000 + index));
    }
    return typeof value === 'number' ? Number(identifiers.get(key)) : identifiers.get(key);
  }
  function visit(value, key = '', index = 0) {
    if (value === null) return null;
    if (Array.isArray(value)) return value.map((item, i) => visit(item, key, i));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([name]) => knownFields.has(name))
        .map(([name, item]) => [name, visit(item, name)]));
    }
    if (key === 'id' || key === 'id_str' || key.endsWith('_id')) {
      // Enum-like badge IDs do not identify a resource.
      return key === 'badge_type_id' ? 0 : id(value);
    }
    if (typeof value === 'boolean') return key === 'joined';
    if (typeof value === 'number') {
      if (key === 'resource_state') return [1, 2, 3].includes(value) ? value : 1;
      return ({ distance: 12000, elevation_gain: 250, type: 1, sub_type: 1, skill_levels: 1, terrain: 1,
        estimated_moving_time: 3600, maximum_grade: 4, average_grade: 2, elevation_high: 500,
        elevation_low: 100, weekly_interval: 1, member_count: 12 })[key] ?? 0;
    }
    if (typeof value === 'string') {
      if (key === 'upcoming_occurrences') return new Date(Date.UTC(2030, 0, 1 + index, 9)).toISOString();
      if (key === 'start_datetime') return '2030-01-01T09:00';
      if (key.endsWith('_at')) return '2020-01-01T00:00:00Z';
      if (/url|profile|photo|website/.test(key) || /^https?:/i.test(value)) return 'https://example.com/synthetic-resource';
      return strings[key] ?? 'Example value';
    }
    return null;
  }
  const sanitize = value => visit(value);
  sanitize.id = id;
  return sanitize;
}
