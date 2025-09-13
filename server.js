import express from "express";
import session from "express-session";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Helper function to preserve large IDs as strings during JSON parsing
function parseJsonWithStringIds(jsonText) {
  // Replace large ID numbers with quoted strings before parsing
  const modifiedText = jsonText.replace(/"id":\s*(\d{16,})/g, '"id":"$1"');
  return JSON.parse(modifiedText);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing CLIENT_ID or CLIENT_SECRET in environment");
  process.exit(1);
}

app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.static("public"));

// Login redirect
app.get("/login", (req, res) => {
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=auto&scope=read`; // read,read_all,profile:read_all,activity:read_all,club:read
  res.redirect(stravaAuthUrl);
});

// Token refresh function
async function refreshAccessToken(refreshToken) {
  try {
    const tokenResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    
    if (!tokenResp.ok) {
      throw new Error('Failed to refresh access token');
    }
    
    return await tokenResp.json();
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}

// Middleware to check and refresh token if needed
async function ensureValidToken(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // If token is expired or about to expire in the next 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = req.session.tokens.expires_at || 0;
  
  if (now >= expiresAt - 300) { // 5 minutes buffer
    try {
      const newTokens = await refreshAccessToken(req.session.tokens.refresh_token);
      req.session.tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || req.session.tokens.refresh_token, // Use new refresh token if provided, otherwise keep the old one
        expires_at: now + newTokens.expires_in
      };
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      delete req.session.tokens; // Clear invalid session
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
  }
  
  next();
}

// OAuth callback
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      throw new Error('No authorization code provided');
    }

    const tokenResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const errorData = await tokenResp.text();
      throw new Error(`OAuth error: ${errorData}`);
    }

    const data = await tokenResp.json();
    const now = Math.floor(Date.now() / 1000);
    
    // Store tokens with expiration
    req.session.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + data.expires_in
    };
    
    res.redirect("/");
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// Get events (needs login)
app.get("/events", ensureValidToken, async (req, res) => {
  try {
    const token = req.session.tokens.access_token;

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
});

app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
