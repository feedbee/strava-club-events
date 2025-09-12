import express from "express";
import session from "express-session";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

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
    let clubs = await clubsResp.json();

    let allEvents = [];
    let now = new Date();
    let nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 30);

    for (let club of clubs) {
      let eventsResp = await fetch(
        `https://www.strava.com/api/v3/clubs/${club.id}/group_events`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let events = await eventsResp.json();

      let filtered = events.filter((ev) => {
        let start = new Date(ev.start_date_local);
        return start >= now && start <= nextMonth;
      });

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
