import { stravaRequest } from './strava-client.js';
import { createHash } from 'node:crypto';
import { upcomingOccurrences } from '../utils/occurrences.js';
import { parseJsonWithStringIds } from '../utils/parsing.js';
import { clubRecord, eventRecord, routeRecord, resourceList } from './strava-models.js';
import AbstractCache from '../cache/abstract-cache.js';
import { Logger } from '../utils/logger.js';

const LIMIT_CLUBS = 25; // Max clubs to process for events; users with more will have only their top clubs analyzed
const LIMIT_CLUBS_FETCH = 200; // Max clubs fetched from Strava in one request; users with more are not supported
const LIMIT_EVENTS = 100; // Max events to fetch per club; if a club has more, only the first 100 upcoming events are analyzed
const LIMIT_ROUTES = 20; // Max route details to fetch across all events; once this limit is reached, remaining events will not have route details fetched and will use basic info instead

const logger = Logger.create('strava:api');

import { config } from '../config/index.js';

// Cache instance
let cache;

let cacheReady;
export function initializeCache() {
  cacheReady ??= AbstractCache.create(config.cache.driver, {
    defaultTTL: config.cache.ttl.DEFAULT, ...config.cache.mongodb
  }).then(instance => { cache = instance; return instance; });
  return cacheReady;
}
export async function closeCache() {
  if (cacheReady) await (await cacheReady).close?.();
}
export async function checkCache({ signal }) {
  if (!cache) throw new Error('Cache unavailable');
  if (config.cache.driver === 'mongodb') await cache.db.command({ ping: 1 }, { signal, timeoutMS: 1000 });
}
const pending = new Map();
async function cachedRequest(key, ttl, load, project = value => value) {
  await initializeCache();
  const hit = await cache.get(key);
  if (hit !== null && hit !== undefined) {
    const value = project(hit);
    // Scrub legacy full responses on access; minimized entries keep their expiry.
    if (JSON.stringify(value) !== JSON.stringify(hit)) await cache.set(key, value, ttl);
    return value;
  }
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const loaded = await load();
    const value = loaded === null ? null : project(loaded);
    if (value !== null) await cache.set(key, value, ttl);
    return value;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
const refreshes = new Map();

// Use configured TTLs
const CACHE_TTL = config.cache.ttl;

/**
 * Refreshes the access token using the refresh token
 * @param {string} refreshToken - The refresh token
 * @param {string} clientId - Strava API client ID
 * @param {string} clientSecret - Strava API client secret
 * @returns {Promise<Object>} - The new access token data
 */
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const key = createHash('sha256').update(`${clientId}:${refreshToken}`).digest('hex');
  if (refreshes.has(key)) return refreshes.get(key);
  const task = stravaRequest('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token' })
  }).then(JSON.parse);
  refreshes.set(key, task);
  try { return await task; } finally { refreshes.delete(key); }

}

/**
 * Fetches user's clubs from Strava
 * @param {string} accessToken - The OAuth access token
 * @returns {Promise<Array>} - List of user's clubs
 */
async function getUserClubs(accessToken, userId) {
  const key = AbstractCache.generateKey(userId, 'clubs');
  return cachedRequest(key, CACHE_TTL.CLUBS, async () => {
    const clubs = parseJsonWithStringIds(await stravaRequest(`https://www.strava.com/api/v3/athlete/clubs?page=1&per_page=${LIMIT_CLUBS_FETCH}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }));
    if (!Array.isArray(clubs)) throw new Error('Invalid Strava clubs response');
    return clubs;
  }, value => resourceList(value, clubRecord));
}

/**
 * Fetches raw events data for a specific club from Strava API
 * @param {string} accessToken - The OAuth access token
 * @param {string|number} clubId - The club ID
 * @returns {Promise<Array>} - List of raw club events
 */
async function fetchRawClubEvents(accessToken, userId, clubId) {
  const key = AbstractCache.generateKey(userId, 'club_events', clubId);
  return cachedRequest(key, CACHE_TTL.EVENTS, async () => {
    const events = parseJsonWithStringIds(await stravaRequest(`https://www.strava.com/api/v3/clubs/${clubId}/group_events?upcoming=true&page=1&per_page=${LIMIT_EVENTS}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }));
    if (!Array.isArray(events)) throw new Error('Invalid Strava events response');
    return events;
  }, value => resourceList(value, eventRecord));
}

/**
 * Fetches detailed route information
 * @param {string} accessToken - The OAuth access token
 * @param {string|number} routeId - The route ID
 * @param {Object} [options] - Additional options
 * @param {Function} [options.shouldFetch] - Function that returns true if we should fetch from Strava when not in cache
 * @returns {Promise<Object|null>} - Route details or null if not found or fetch skipped
 */
async function getRouteDetails(accessToken, routeId, options = {}) {
  if (!routeId) return null;
  if (!options.userId) throw new Error('Route cache requires authenticated user ID');
  const key = AbstractCache.generateKey(options.userId, 'route', routeId);
  return cachedRequest(key, CACHE_TTL.ROUTE, async () => {
    if (options.shouldFetch && !options.shouldFetch()) return null;
    const route = parseJsonWithStringIds(await stravaRequest(`https://www.strava.com/api/v3/routes/${routeId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }));
    if (!route || typeof route !== 'object' || Array.isArray(route) || String(route.id) !== String(routeId)) {
      throw Object.assign(new Error('Invalid Strava route response'), { status: 502 });
    }
    return route;
  }, value => {
    const route = routeRecord(value);
    if (String(route.id) !== String(routeId)) throw Object.assign(new Error('Invalid cached route ID'), { status: 502 });
    return route;
  });
}

/**
 * Prepares an event for display with enriched data
 * @param {Object} event - The raw event object from Strava
 * @param {Object} club - The club object
 * @param {string} accessToken - The OAuth access token
 * @param {Object} [options] - Additional options
 * @param {Function} [options.shouldFetchRoute] - Function that returns true if route details should be fetched
 * @returns {Promise<Array>} - Prepared occurrences within the date range
 */
async function prepareEvent(event, club, accessToken, options = {}) {
  event = eventRecord(event);
  club = clubRecord(club);
  const { shouldFetchRoute = () => true } = options;
  
  const occurrences = upcomingOccurrences(event.upcoming_occurrences, options.now);
  if (occurrences.length === 0) return [];

  // Create event copy with processed data
  const processedEvent = {
    id: event.id,
    title: event.title || '',
    joined: event.joined,
    strava_event_url: `https://www.strava.com/clubs/${club.id}/group_events/${event.id}`,
    club_info: {
      id: club.id,
      name: club.name || '',
      logo: club.profile_medium || ''
    },
    terrain_label: getTerrainLabel(event.terrain),
    skill_level_label: getSkillLevelLabel(event.skill_levels),
    address: event.address || null,
  };

  // Get route details if route.id is available
  let routeDetails = null;
  if (event.route?.id) {
    try {
      // Always try to get from cache first, only apply limit when fetching from Strava
      routeDetails = await getRouteDetails(accessToken, event.route.id, {
        shouldFetch: shouldFetchRoute, userId: options.userId
      });
    } catch (error) {
      processedEvent.route_details_failed = true;
      options.onRouteError?.({ route_id: String(event.route.id), status: error.status || 502, retry_after: error.retryAfter });
    }
  }

  // Add route information: use detailed route info if available, otherwise fall back to basic info from event
  if (routeDetails) {
    processedEvent.route_info = createRouteInfo(routeDetails);
  } else {
    processedEvent.route_info = getBasicRouteInfo(event);
  }

  return occurrences.map(date => {
    const startDate = date.toISOString();
    return { ...processedEvent, start_date: startDate,
      occurrence_id: `${club.id}:${event.id}:${startDate}` };
  });
}

/**
 * Formats moving time in seconds to a human-readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2h 30m" or "45m")
 */
function formatMovingTime(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Gets the activity type as a human-readable string
 * @param {number} type - Activity type code
 * @param {number} subType - Activity sub-type code
 * @returns {string} Formatted activity type (e.g., "Ride / Road")
 */
function getRouteType(type, subType) {
  const types = {
    1: 'Ride', 2: 'Run', 3: 'Walk', 4: 'Hike',
    5: 'Trail', 6: 'Gravel Ride', 7: 'Mountain Biking', 8: 'E-Mountain Biking'
  };
  
  const subTypes = {
    1: 'Road', 2: 'Mountain Bike', 3: 'Cross', 4: 'Trail', 5: 'Mixed'
  };
  
  const typeText = types[type] || `Unknown: ${type}`;
  const subTypeText = subTypes[subType] || `Unknown: ${subType}`;
  
  return `${typeText} / ${subTypeText}`;
}

/**
 * Gets the terrain as a human-readable string
 * @param {number} terrain - Terrain type code
 * @returns {string|undefined} Formatted terrain description or undefined if not available
 */
function getTerrainLabel(terrain) {
  if (terrain == null) return undefined;

  const terrainMap = {
    0: 'Mostly Flat',
    1: 'Rolling Hills',
    2: 'Killer Climbs'
  };

  return terrainMap[terrain] ?? `Unknown: ${terrain}`;
}

/**
 * Gets the skill level as a human-readable string
 * @param {number} skillLevel - Skill level code
 * @returns {string|undefined} Formatted skill level or undefined if not available
 */
function getSkillLevelLabel(skillLevel) {
  if (skillLevel == null) return undefined;

  const skillLevelMap = {
    1: 'Casual (No Drop)',
    2: 'Tempo',
    4: 'Race Pace'
  };

  return skillLevelMap[skillLevel] ?? `Unknown: ${skillLevel}`;
}

/**
 * Creates a formatted route info object from route details
 * @param {Object} routeDetails - Raw route details from Strava API
 * @returns {Object} Formatted route information
 */
function createRouteInfo(routeDetails) {
  return {
    id: routeDetails.id || null,
    name: routeDetails.name || 'Route is not attached',
    is_full: routeDetails.resource_state == 3,
    distance: routeDetails.distance ? `${(routeDetails.distance / 1000).toFixed(1)} km` : 'N/A',
    elevation_gain: routeDetails.elevation_gain ? `${Math.round(routeDetails.elevation_gain)}m` : 'N/A',
    activity_type: getRouteType(routeDetails.type, routeDetails.sub_type) || 'Ride',
    estimated_moving_time: formatMovingTime(routeDetails.estimated_moving_time),
    max_slope: routeDetails.maximum_grade ? `${routeDetails.maximum_grade}%` : 'N/A',
    elevation_high: routeDetails.elevation_high ? `${Math.round(routeDetails.elevation_high)}m` : 'N/A',
    elevation_low: routeDetails.elevation_low ? `${Math.round(routeDetails.elevation_low)}m` : 'N/A'
  };
}

/**
 * Gets basic route information when detailed fetch fails
 * @param {Object} event - The event object
 * @returns {Object} Basic route information
 */
function getBasicRouteInfo(event) {
  // The route embedded in an event is always state 1 (id, name, map, map_urls only).
  // distance, elevation_gain and other metrics are absent at state 1, so they are N/A.
  return {
    id: event.route?.id || null,
    name: event.route?.name || 'Route is not attached',
    is_full: false,
    distance: 'N/A',
    elevation_gain: 'N/A',
    activity_type: event.activity_type || 'Ride',
    estimated_moving_time: 'N/A',
    max_slope: 'N/A',
    elevation_high: 'N/A',
    elevation_low: 'N/A'
  };
}

/**
 * Gets all events for a specific club with enriched data
 * @param {string} accessToken - The OAuth access token
 * @param {Object} club - The club object
 * @param {string} userId - The user ID for caching
 * @param {Object} [options] - Additional options
 * @param {Function} [options.shouldFetchRoute] - Function that returns true if route details should be fetched
 * @returns {Promise<{events: Array, rawCount: number}>} - Prepared events and raw event count from API
 */
async function getClubEvents(accessToken, club, userId, options = {}) {
  const { shouldFetchRoute } = options;
  const now = options.now ?? new Date();
  const rawEvents = await fetchRawClubEvents(accessToken, userId, club.id);

  // Process events in parallel with route request limiting
  const eventPromises = rawEvents.map(event =>
    prepareEvent(event, club, accessToken, { shouldFetchRoute, userId, now, onRouteError: options.onRouteError })
  );

  const preparedEvents = await Promise.all(eventPromises);
  return { events: preparedEvents.flat(), rawCount: rawEvents.length };
}

/**
 * Gets all events for all user's clubs with route request limiting
 * @param {string} accessToken - The OAuth access token
 * @param {string} userId - The user ID for caching
 * @param {Object} [options] - Additional options
 * @param {string[]} [options.filterClubIds] - When provided, only fetch events for these club IDs
 * @param {string[]} [options.filterSportTypes] - When provided, only fetch events for clubs matching these sport types (lowercase)
 * @returns {Promise<{events: Array, clubs: Array, meta: Object}>} - All prepared events, full clubs list, and metadata
 */
async function getAllUserClubsEvents(accessToken, userId, { filterClubIds, filterSportTypes } = {}) {
  const now = new Date();
  const allClubs = await getUserClubs(accessToken, userId);

  const hasClubFilter  = filterClubIds   && filterClubIds.length > 0;
  const hasSportFilter = filterSportTypes && filterSportTypes.length > 0;

  let clubsToProcess;
  if (hasClubFilter || hasSportFilter) {
    clubsToProcess = allClubs.filter(c => {
      const clubIdMatch = !hasClubFilter  || filterClubIds.includes(String(c.id));
      const sportMatch  = !hasSportFilter || filterSportTypes.includes((c.sport_type || '').toLowerCase());
      return clubIdMatch && sportMatch;
    });
  } else {
    clubsToProcess = allClubs.slice(0, LIMIT_CLUBS);
  }

  const allEvents = [];

  // Track route requests across all clubs
  let routeRequestCount = 0;
  let routesSkipped = 0;
  const shouldFetchRoute = () => {
    if (routeRequestCount >= LIMIT_ROUTES) {
      routesSkipped++;
      return false;
    }
    routeRequestCount++;
    logger.debug(`Fetching route ${routeRequestCount}/${LIMIT_ROUTES}`);
    return true;
  };

  const errors = [];
  const routeErrors = new Map();
  const onRouteError = error => routeErrors.set(error.route_id, error);
  // Process all clubs in parallel
  const clubResults = await Promise.all(clubsToProcess.map(club => 
    getClubEvents(accessToken, club, userId, { shouldFetchRoute, now, onRouteError })
      .catch(error => {
        errors.push({ club_id: club.id, status: error.status || 502, retry_after: error.retryAfter });
        return { events: [], rawCount: 0 };
      })
  ));

  if (clubsToProcess.length > 0 && errors.length === clubsToProcess.length) {
    throw Object.assign(new Error('Failed to fetch all Strava clubs'), {
      status: errors.some(error => error.status === 429) ? 429 : 502,
      retryAfter: Math.max(0, ...errors.map(error => error.retry_after || 0)) || undefined
    });
  }
  const retryAfter = Math.max(0, ...errors.map(error => error.retry_after || 0),
    ...[...routeErrors.values()].map(error => error.retry_after || 0)) || undefined;
  let eventsLimited = false;
  for (const result of clubResults) {
    if (result.rawCount >= LIMIT_EVENTS) eventsLimited = true;
    allEvents.push(...result.events);
  }

  // Sort all events by start date
  allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  return {
    events: allEvents,
    clubs: allClubs.map(c => ({
      id: c.id,
      name: c.name,
      logo: c.profile_medium || '',
      sport_type: c.sport_type || '',
      localized_sport_type: c.localized_sport_type || ''
    })),
    meta: {
      partial: errors.length > 0 || routeErrors.size > 0,
      retry_after: retryAfter,
      routes_failed: routeErrors.size,
      route_errors: [...routeErrors.values()],
      events_route_details_failed: allEvents.filter(event => event.route_details_failed).length,
      clubs_failed: errors.length,
      errors,
      clubs_total: allClubs.length,
      clubs_processed: clubsToProcess.length,
      clubs_limited: (hasClubFilter || hasSportFilter) ? false : allClubs.length > LIMIT_CLUBS,
      clubs_fetch_limited: allClubs.length >= LIMIT_CLUBS_FETCH,
      events_total: allEvents.length,
      events_limited: eventsLimited,
      routes_fetched: routeRequestCount,
      routes_skipped: routesSkipped,
      limits: {
        clubs: LIMIT_CLUBS,
        clubs_fetch: LIMIT_CLUBS_FETCH,
        events_per_club: LIMIT_EVENTS,
        routes: LIMIT_ROUTES,
      },
    }
  };
}

function getLimits() {
  return {
    clubs: LIMIT_CLUBS,
    clubs_fetch: LIMIT_CLUBS_FETCH,
    events_per_club: LIMIT_EVENTS,
    routes: LIMIT_ROUTES,
  };
}

export {
  refreshAccessToken,
  getUserClubs,
  getClubEvents,
  getRouteDetails,
  getAllUserClubsEvents,
  getLimits,
};
