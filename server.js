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

// OAuth callback
app.get("/callback", async (req, res) => {
  const code = req.query.code;

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
  const data = await tokenResp.json();

  req.session.access_token = data.access_token;
  res.redirect("/");
});

// Get events (needs login)
app.get("/events", async (req, res) => {
  if (!req.session.access_token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const token = req.session.access_token;

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
        let candidateDates = [];
        
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
