import fetch from 'node-fetch';
import { parseJsonWithStringIds } from '../utils/parsing.js';
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

// Initialize cache
(async () => {
  try {
    const cacheConfig = {
      defaultTTL: config.cache.ttl.DEFAULT,
      ...config.cache.mongodb
    };
    
    cache = await AbstractCache.create(config.cache.driver, cacheConfig);
    logger.info(`Cache initialized with ${config.cache.driver} driver`);
  } catch (error) {
    logger.error('Failed to initialize cache:', error);
    process.exit(1);
  }
})();

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
  logger.debug('Refreshing access token');
  const tokenResp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResp.ok) {
    const errorData = await tokenResp.text();
    throw new Error(`Token refresh failed: ${errorData}`);
  }

  return await tokenResp.json();
}

/**
 * Fetches user's clubs from Strava
 * @param {string} accessToken - The OAuth access token
 * @returns {Promise<Array>} - List of user's clubs
 */
async function getUserClubs(accessToken, userId) {
  const cacheKey = AbstractCache.generateKey(userId, 'clubs');
  
  // Try to get from cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // If not in cache, fetch from API
  const response = await fetch(`https://www.strava.com/api/v3/athlete/clubs?page=1&per_page=${LIMIT_CLUBS_FETCH}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch clubs: ${response.statusText}`);
  }
  
  const clubs = parseJsonWithStringIds(await response.text());
  
  // Cache the result
  await cache.set(cacheKey, clubs, CACHE_TTL.CLUBS);
  
  return clubs;
}

/**
 * Fetches raw events data for a specific club from Strava API
 * @param {string} accessToken - The OAuth access token
 * @param {string|number} clubId - The club ID
 * @returns {Promise<Array>} - List of raw club events
 */
async function fetchRawClubEvents(accessToken, userId, clubId) {
  const cacheKey = AbstractCache.generateKey(userId, 'club_events', clubId);
  
  // Try to get from cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // If not in cache, fetch from API
  const url = `https://www.strava.com/api/v3/clubs/${clubId}/group_events?upcoming=true&page=1&per_page=${LIMIT_EVENTS}`;
  logger.debug(`Fetching club events from: ${url}`);
  
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch events for club ${clubId}: ${response.statusText}`);
  }
  
  const events = parseJsonWithStringIds(await response.text());
  
  // Cache the result
  await cache.set(cacheKey, events, CACHE_TTL.EVENTS);
  
  return events;
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
  
  const { shouldFetch = () => true } = options;
  const cacheKey = AbstractCache.generateKey('_', 'route', routeId); // routes are user-agnostic (it's important NOT to use route.starred field since this field is user specific)
  
  // Try to get from cache first
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // If not in cache and should not fetch, return null
  if (!shouldFetch()) {
    logger.debug(`Skipping fetch for route ${routeId} due to limit`);
    return null;
  }

  // Fetch from API
  const url = `https://www.strava.com/api/v3/routes/${routeId}`;
  logger.debug(`Fetching route details from: ${url}`);
  
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.error(`Failed to fetch route ${routeId}: ${response.statusText}`);
    return null;
  }
  
  const routeDetails = await parseJsonWithStringIds(await response.text());
  
  // Cache the result
  if (routeDetails) {
    logger.debug(`Caching route details for route ID: ${routeId}`);
    await cache.set(cacheKey, routeDetails, CACHE_TTL.ROUTE);
  }
  
  return routeDetails;
}

/**
 * Prepares an event for display with enriched data
 * @param {Object} event - The raw event object from Strava
 * @param {Object} club - The club object
 * @param {string} accessToken - The OAuth access token
 * @param {Object} [options] - Additional options
 * @param {Function} [options.shouldFetchRoute] - Function that returns true if route details should be fetched
 * @returns {Promise<Object|null>} - Prepared event or null if not within date range
 */
async function prepareEvent(event, club, accessToken, options = {}) {
  const { shouldFetchRoute = () => true } = options;
  
  // Process upcoming occurrences
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(now.getDate() + 30);

  if (!Array.isArray(event.upcoming_occurrences) || event.upcoming_occurrences.length === 0) {
    return null;
  }

  const candidateDates = event.upcoming_occurrences.map(d => new Date(d));
  const match = candidateDates.find(d => d >= now && d <= nextMonth);

  if (!match) {
    return null;
  }

  // Create event copy with processed data
  const processedEvent = {
    ...event,
    start_date: match.toISOString(),
    strava_event_url: `https://www.strava.com/clubs/${club.id}/group_events/${event.id}`,
    club_info: {
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
        shouldFetch: shouldFetchRoute
      });
    } catch (error) {
      console.error(`Error with route details for route ${event.route.id}:`, error);
    }
  }

  // Add route information: use detailed route info if available, otherwise fall back to basic info from event
  if (routeDetails) {
    processedEvent.route_info = createRouteInfo(routeDetails);
  } else {
    processedEvent.route_info = getBasicRouteInfo(event);
  }

  return processedEvent;
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
  const rawEvents = await fetchRawClubEvents(accessToken, userId, club.id);

  // Process events in parallel with route request limiting
  const eventPromises = rawEvents.map(event =>
    prepareEvent(event, club, accessToken, { shouldFetchRoute })
  );

  const preparedEvents = await Promise.all(eventPromises);
  return { events: preparedEvents.filter(Boolean), rawCount: rawEvents.length };
}

/**
 * Gets all events for all user's clubs with route request limiting
 * @param {string} accessToken - The OAuth access token
 * @param {string} userId - The user ID for caching
 * @returns {Promise<{events: Array, meta: Object}>} - All prepared events and metadata about limits applied
 */
async function getAllUserClubsEvents(accessToken, userId) {
  const allClubs = await getUserClubs(accessToken, userId);
  const clubsToProcess = allClubs.slice(0, LIMIT_CLUBS);
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

  // Process all clubs in parallel
  const clubResults = await Promise.all(clubsToProcess.map(club => 
    getClubEvents(accessToken, club, userId, { shouldFetchRoute })
      .catch(error => {
        console.error(`Error getting events for club ${club.id}:`, error);
        return { events: [], rawCount: 0 };
      })
  ));

  let eventsLimited = false;
  for (const result of clubResults) {
    if (result.rawCount >= LIMIT_EVENTS) eventsLimited = true;
    allEvents.push(...result.events);
  }

  // Sort all events by start date
  allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  return {
    events: allEvents,
    meta: {
      clubs_total: allClubs.length,
      clubs_processed: clubsToProcess.length,
      clubs_limited: allClubs.length > LIMIT_CLUBS,
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
