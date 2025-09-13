import fetch from "node-fetch";
import { parseJsonWithStringIds } from "../utils/parsing.js";

/**
 * Fetches and processes events for the authenticated user
 */
async function getEvents(req, res) {
  try {
    const token = req.token; // Use the token attached by ensureValidToken middleware

    // Get clubs
    let clubsResp = await fetch("https://www.strava.com/api/v3/athlete/clubs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    let clubsText = await clubsResp.text();
    let clubs = parseJsonWithStringIds(clubsText);

    let allEvents = [];
    let now = new Date();
    let nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 30);

    for (let club of clubs) {
      let eventsResp = await fetch(
        `https://www.strava.com/api/v3/clubs/${club.id}/group_events?upcoming=true&per_page=200&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let eventsText = await eventsResp.text();

      let events = parseJsonWithStringIds(eventsText);

      // Normalize to support upcoming_occurrences when start_date_local is absent
      let filtered = [];
      for (let ev of events) {
        // Only use upcoming_occurrences, operate entirely in UTC
        if (Array.isArray(ev.upcoming_occurrences) && ev.upcoming_occurrences.length > 0) {
          const candidateDates = ev.upcoming_occurrences.map((d) => new Date(d));
          
          // Find the first occurrence within [now, nextMonth] - all dates are UTC
          const match = candidateDates.find((d) => d >= now && d <= nextMonth);

          if (match) {
            // Pass UTC value to frontend
            ev.start_date = match.toISOString();
            // Add Strava event URL
            ev.strava_event_url = `https://www.strava.com/clubs/${club.id}/group_events/${ev.id}`;
            // Add club info
            ev.club_info = {
              name: club.name || '',
              logo: club.profile_medium || ''
            };
            
            // Add route information if available
            if (ev.route && ev.route.id) {
              try {
                // Fetch detailed route information
                const routeUrl = `https://www.strava.com/api/v3/routes/${ev.route.id}`;
                const routeResponse = await fetch(routeUrl, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                if (routeResponse.ok) {
                  const routeDetails = await routeResponse.json();
                  
                  // Format moving time
                  const formatMovingTime = (seconds) => {
                    if (!seconds) return 'N/A';
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    return hours > 0 
                      ? `${hours}h ${minutes}m` 
                      : `${minutes}m`;
                  };
                  
                  // Get route type as text
                  const getRouteType = (type, subType) => {
                    const types = {
                      1: 'Ride',
                      2: 'Run',
                      3: 'Walk',
                      4: 'Hike',
                      5: 'Trail',
                      6: 'Gravel Ride',
                      7: 'Mountain Biking',
                      8: 'E-Mountain Biking'
                    };
                    
                    const subTypes = {
                      1: 'Road',
                      2: 'Mountain Bike',
                      3: 'Cross',
                      4: 'Trail',
                      5: 'Mixed'
                    };
                    
                    const typeText = types[type] || 'Unknown: ' + type;
                    const subTypeText = subTypes[subType] || 'Unknown: ' + subType;
                    
                    return `${typeText} / ${subTypeText}`;
                  };
                  
                  ev.route_info = {
                    name: routeDetails.name || 'Unnamed Route',
                    distance: routeDetails.distance ? `${(routeDetails.distance / 1000).toFixed(1)} km` : 'N/A',
                    elevation_gain: routeDetails.elevation_gain ? `${Math.round(routeDetails.elevation_gain)}m` : 'N/A',
                    activity_type: getRouteType(routeDetails.type, routeDetails.sub_type) || ev.activity_type || 'Ride',
                    estimated_moving_time: formatMovingTime(routeDetails.estimated_moving_time),
                    max_slope: routeDetails.maximum_grade ? `${routeDetails.maximum_grade}%` : 'N/A',
                    elevation_high: routeDetails.elevation_high ? `${Math.round(routeDetails.elevation_high)}m` : 'N/A',
                    elevation_low: routeDetails.elevation_low ? `${Math.round(routeDetails.elevation_low)}m` : 'N/A'
                  };
                } else {
                  // Fallback to basic route info if detailed fetch fails
                  ev.route_info = getBasicRouteInfo(ev);
                }
              } catch (error) {
                console.error('Error fetching route details:', error);
                ev.route_info = getBasicRouteInfo(ev);
              }
            }
            
            // Helper function for basic route info
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
            
            filtered.push(ev);
          }
        }
      }

      filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      allEvents.push(...filtered);
    }

    res.json(allEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export { getEvents };
