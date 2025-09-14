import fetch from 'node-fetch';
import { parseJsonWithStringIds } from '../utils/parsing.js';
import AbstractCache from '../cache/abstract-cache.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.create('strava:api');

// Create a default in-memory cache instance
let cache;

// Initialize cache immediately
(async () => {
  try {
    cache = await AbstractCache.create('memory', {
      defaultTTL: 15 * 60 * 1000 // 15 minutes default
    });
  } catch (error) {
    logger.error('Failed to initialize cache:', error);
    process.exit(1);
  }
})();

// Cache TTLs in milliseconds
const CACHE_TTL = {
  CLUBS: 15 * 60 * 1000, // 15 minutes
  EVENTS: 15 * 60 * 1000, // 15 minutes
  ROUTE: 60 * 60 * 1000,  // 1 hour (routes don't change often)
};

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
  const response = await fetch("https://www.strava.com/api/v3/athlete/clubs", {
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
  const url = `https://www.strava.com/api/v3/clubs/${clubId}/group_events?upcoming=true&per_page=200&page=1`;
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
 * @returns {Promise<Object|null>} - Route details or null if not found
 */
async function getRouteDetails(accessToken, userId, routeId) {
  if (!routeId) return null;
  
  const cacheKey = AbstractCache.generateKey(userId, 'route', routeId);
  
  // Try to get from cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // If not in cache, fetch from API
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
 * Prepares and enriches event data with club and route information
 * @param {Object} event - The event object from Strava
 * @param {Object} club - The club object the event belongs to
 * @param {string} accessToken - The OAuth access token
 * @returns {Promise<Object|null>} - Prepared event or null if not within date range
 */
async function prepareEvent(event, club, accessToken, userId) {
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
    }
  };

  // Get route details if route.id is available
  if (event.route?.id) {
    try {
      event.route = await getRouteDetails(accessToken, userId, event.route.id);
    } catch (error) {
      console.error(`Error fetching route details for route ${event.route.id}:`, error);
      event.route = getBasicRouteInfo(event);
    }
  }

  // Add route information if available
  if (event.route) {
    try {
      processedEvent.route_info = createRouteInfo(event.route);
    } catch (error) {
      console.error('Error fetching route details:', error);
      processedEvent.route_info = getBasicRouteInfo(event);
    }
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
 * Creates a formatted route info object from route details
 * @param {Object} routeDetails - Raw route details from Strava API
 * @returns {Object} Formatted route information
 */
function createRouteInfo(routeDetails) {
  return {
    name: routeDetails.name || 'Unnamed Route',
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
  return {
    name: event.route?.name || 'Unnamed Route',
    distance: event.route?.distance ? `${(event.route.distance / 1000).toFixed(1)} km` : 'N/A',
    elevation_gain: event.route?.elevation_gain ? `${Math.round(event.route.elevation_gain)}m` : 'N/A',
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
 * @returns {Promise<Array>} - Array of prepared events
 */
async function getClubEvents(accessToken, club, userId) {
  const events = await fetchRawClubEvents(accessToken, userId, club.id);
  
  // Process events in parallel
  const eventPromises = events.map(event => 
    prepareEvent(event, club, accessToken, userId)
  );
  
  const preparedEvents = await Promise.all(eventPromises);
  return preparedEvents.filter(Boolean); // Filter out null/undefined events
}

export {
  refreshAccessToken,
  getUserClubs,
  getClubEvents,
  getRouteDetails
};
