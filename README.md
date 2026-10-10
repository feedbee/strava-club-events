# Strava Club Events Calendar

A modern web application that connects to Strava, fetches upcoming club events for the next 30 days, and displays them in an interactive calendar or list view with enhanced UI/UX.

### ✨ Features
- **Secure Authentication** - Robust OAuth2 implementation with Strava
  - Automatic token refresh before expiration
  - Configurable session management with multiple storage backends
  - Optional AES-256-GCM encryption for sensitive session data (reads legacy CBC sessions)
  - Secure cookie configuration with httpOnly, secure, and sameSite flags

- **Event Management**
  - Fetches events from all your Strava clubs
  - Shows every unique upcoming occurrence in the next 30 days, including recurring events
  - Displays detailed event information
  - **Smart Filtering System**
    - Filter events by join status (show only joined events)
    - Filter by club (multi-select picker with search and logos, up to 10 clubs)
    - Filter by sport type (Cycling, Running, Triathlon, etc.)
    - Active filter counter shows number of applied filters
    - One-click filter reset
    - Persistent filter preferences across sessions

- **Two View Modes**
  - **Calendar view** — Built with FullCalendar, with Month, Week, and Day options
  - **List view** — Chronological feed grouped by date with sticky headers; click any row to expand Club / Event / Route details

- **Beautiful UI** featuring:
  - Clean, modern interface with smooth loading states
  - Navigation bar that appears after events load for a cleaner initial experience
  - Club logos displayed next to each event
  - Responsive design that works on all devices
  - Rich event tooltips with:
    - Event title and club information
    - Route details (distance, elevation gain, activity type)
    - Estimated moving time
    - Max slope percentage
    - Elevation range
  - Click to open events in Strava (new tab)
  - Right-click to copy event URL to clipboard
  - Support for various activity types with appropriate icons

- **API Limits Transparency**
  - Stats summary in the navigation bar (total clubs / events)
  - Contextual warning strip when limits are hit, linking to `/limits`
  - Dedicated `/limits` page with plain-language explanations

- **Developer Friendly**
  - Docker and Docker Compose support
  - Development container configuration included
  - Environment-based configuration
  - Configurable session and cache settings
  - Detailed logging for debugging

- **Performance**
  - Configurable caching system with multiple backends:
    - In-memory cache (default)
    - MongoDB for persistent caching
  - Granular TTL settings for different data types:
    - Clubs: 15 minutes
    - Events: 15 minutes
    - Routes: 1 hour
  - Basic error handling with middleware

### 🚀 Quick Start

### Using Docker (Recommended)
```bash
docker-compose up -d
```

### Local Development

Use Node 24.21.0 (`nvm use`, version pinned in `.nvmrc`). `npm run dev` uses Node’s built-in watch mode. See [dependency migration and verification](docs/dependencies-step3.md).

1. Clone the repository
2. Install dependencies: `npm ci --ignore-scripts`
3. Create a `.env` file with your Strava API credentials
4. Start the server: `npm start`
5. Open `http://localhost:3000` in your browser

## 📱 Features in Detail

#### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (recommended)
- [Node.js 24 LTS](https://nodejs.org/) (for local development without Docker)
- A [Strava API application](https://www.strava.com/settings/api) with `CLIENT_ID` and `CLIENT_SECRET`

### 🔒 Security Features

- **Token Rotation**: Access tokens are automatically refreshed before expiration
- **OAuth state**: One-time session-bound state expires after 10 minutes; successful login rotates the session ID
- **Secure Storage**: Tokens stay in the server-side session store; the HttpOnly cookie contains only a signed session ID
- **Session Management**: Automatic cleanup of expired sessions
- **Error Handling**: Graceful degradation and user-friendly error messages

### 🔧 Configuration

#### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Required
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret

# Application Settings
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
PUBLIC_URL=http://localhost:3000

# Session Configuration
SESSION_DRIVER=memory  # or 'mongodb'
SESSION_SECRET=your_session_secret
SESSION_TTL=86400  # 24 hours in seconds
SESSION_SECURE_COOKIE=false  # development over HTTP; production requires true
SESSION_TRUST_PROXY=false  # set to true if behind a reverse proxy

# MongoDB Configuration (required if using mongodb driver)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=strava-club-events

# Encryption (highly recommended for production)
ENCRYPTION_KEY=  # optional; set to 64 hexadecimal characters for a 32-byte key

# Cache Configuration
CACHE_DRIVER=memory  # or 'mongodb'
CACHE_TTL_DEFAULT=900000    # 15 minutes
CACHE_TTL_CLUBS=900000     # 15 minutes
CACHE_TTL_EVENTS=900000    # 15 minutes
CACHE_TTL_ROUTE=3600000    # 1 hour
```

#### Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Required** | | | |
| `CLIENT_ID` | Yes | - | Strava API client ID |
| `CLIENT_SECRET` | Yes | - | Strava API client secret |
| **Application** | | | |
| `NODE_ENV` | No | `development` | Runtime environment (`development`/`production`) |
| `HOST` | No | `0.0.0.0` | Bind address for the HTTP server |
| `PORT` | No | `3000` | Port for the HTTP server |
| `PUBLIC_URL` | No | `http://localhost:${PORT}` | Base URL for OAuth redirects |
| `DEV_CALLBACK_REDIRECT` | Removed | - | Must be unset; callback forwarding is rejected |
| **Session** | | | |
| `SESSION_DRIVER` | In production | `memory` in development | Production requires `mongodb` |
| `SESSION_SECRET` | In production | Random per process in development | Signing secret; production requires at least 32 non-whitespace characters |
| `SESSION_TTL` | No | `86400` | Session lifetime in seconds (24h) |
| `SESSION_SECURE_COOKIE` | No | `true` in production, `false` otherwise | Production rejects `false` |
| `SESSION_TRUST_PROXY` | No | `false` | Trust TLS-forwarding headers only when the backend is reachable solely through the trusted proxy |
| `ENCRYPTION_KEY` | No | - | 64-hex-character AES-256 key; new writes use GCM, legacy CBC remains readable |
| **MongoDB** | | | |
| `MONGODB_URI` | If using MongoDB | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | If using MongoDB | `strava-club-events` | Database name |
| **Cache** | | | |
| `CACHE_DRIVER` | No | `memory` | Cache driver: `memory` or `mongodb` |
| `CACHE_TTL_DEFAULT` | No | `900000` | Default cache TTL in ms (15m) |
| `CACHE_TTL_CLUBS` | No | `900000` | Clubs cache TTL in ms (15m) |
| `CACHE_TTL_EVENTS` | No | `900000` | Events cache TTL in ms (15m) |
| `CACHE_TTL_ROUTE` | No | `3600000` | Route cache TTL in ms (1h) |


> **Important:** Never commit your `.env` file or share your Strava API credentials.

### 🐳 Running with Docker Compose

1. Create `.env` with your Strava API credentials
2. Start the application:
   ```bash
   docker compose up --build
   ```
3. Open your browser to [http://localhost:3000](http://localhost:3000)
4. Click "Login with Strava" to authenticate

#### Development Workflow
- The project directory is bind-mounted into the container for live code changes
- For new dependencies, either:
  - Rebuild the container: `docker compose up --build`
  - Or install inside the container: `docker compose exec -u root strava-app npm ci --omit=dev --ignore-scripts`

### 💻 Local Development (Node.js)

1. Install dependencies:
   ```bash
   npm ci --ignore-scripts
   ```

2. Create `.env` with your Strava API credentials and local settings.
   Both `npm start` and `npm run dev` automatically load `.env`.
   Existing process environment variables override values in the file.
   The file may be absent when configuration is supplied through the environment.

3. Start the development server:
   ```bash
   npm run dev
   ```

   Use `npm start` to run without automatic server restarts.

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### OAuth Callback URL

OAuth callbacks are direct and bound to the browser session. The old production-to-development callback forwarding is disabled. See [security configuration and migration](docs/security-step2.md) before deploying these changes.

The server expects `http://localhost:PORT/callback` (default: `http://localhost:3000/callback`). Configure this in your Strava app settings.

### 🔌 API Endpoints

#### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | GET | Initiates OAuth flow with Strava |
| `/callback` | GET | Handles OAuth callback and token exchange |
| `/logout` | POST | Destroys the session; requires the session-bound `csrfToken` from `/me` |

#### Events
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | GET | Returns `{ events, clubs, meta }` for upcoming club events (next 30 days) |
| `/events?clubs=id1,id2` | GET | Filter to up to 10 specific clubs |
| `/events?sportTypes=cycling` | GET | Filter by sport type (case-insensitive) |

Each item in `events` represents one occurrence. `id` remains the original Strava event ID; `occurrence_id` identifies the club, event and UTC start instant. `start_date` is that occurrence’s start. `meta.events_total` counts displayed occurrences; per-club fetch limits still count source events. The window includes now through now + 30 × 24 hours. Invalid dates and duplicate instants within one source event are omitted.

#### Health

`GET /health/live` reports process liveness. `GET /health/ready` returns 200 only after initialization and while configured storage is reachable; shutdown withdraws readiness. Both endpoints bypass sessions.

#### Limits
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/limits` | GET | Returns application limit constants (no authentication required) |

### Code Organization

- **Routes** are defined in `src/routes/`
- **Controllers** contain request handling logic in `src/controllers/`
- **Middleware** for authentication and other concerns in `src/middleware/`
- **Configuration** in `src/config/`
- **Static files** served from `public/`

#### Example `/events` Response

Synthetic illustration; see [model coverage](docs/api-model-coverage.md) for the complete contract.

```json
{
  "events": [
    {
      "id": "456",
      "title": "Morning Ride",
      "occurrence_id": "123:456:2030-04-01T09:00:00.000Z",
      "start_date": "2030-04-01T09:00:00.000Z",
      "strava_event_url": "https://www.strava.com/clubs/123/group_events/456",
      "club_info": { "id": 123, "name": "Cycling Club", "logo": null },
      "joined": false,
      "address": null,
      "route_info": {
        "id": null, "name": "Route is not attached", "is_full": false,
        "distance": "N/A", "elevation_gain": "N/A", "activity_type": "Ride",
        "estimated_moving_time": "N/A", "max_slope": "N/A",
        "elevation_high": "N/A", "elevation_low": "N/A"
      }
    }
  ],
  "clubs": [
    {
      "id": 123,
      "name": "Cycling Club",
      "logo": null,
      "sport_type": "cycling",
      "localized_sport_type": "Cycling"
    }
  ],
  "meta": {
    "clubs_total": 50,
    "clubs_processed": 25,
    "clubs_limited": true,
    "clubs_fetch_limited": false,
    "events_total": 142,
    "events_limited": false,
    "routes_fetched": 18,
    "routes_skipped": 3,
    "limits": { "clubs": 25, "clubs_fetch": 200, "events_per_club": 100, "routes": 20 }
  }
}
```

### 📁 Project Structure

```
strava-events-calendar/
├── .devcontainer/     # VS Code Dev Container setup
├── public/            # Static frontend assets
│   ├── index.html     # Main application UI
│   ├── index.js       # Frontend initialization and state coordination
│   ├── js/            # Native browser modules: calendar, list, filters, preferences, API
│   ├── css/           # Ordered shared styles: calendar, filters, shell, list
│   ├── limits.html    # API limits explanation page
│   └── styles.css     # Shared stylesheet entry point
├── src/               # Backend source code
│   ├── config/        # Application configuration
│   ├── controllers/   # Request handlers
│   ├── middleware/    # Express middleware
│   ├── routes/        # API route definitions
│   ├── services/      # Business logic
│   └── utils/         # Helper functions
│   ├── app.js         # Express app configuration
│   ├── server.js      # HTTP server bootstrap
├── scripts/           # Utility scripts
├── .env         # Local environment variables
├── Dockerfile         # Production container setup
└── docker-compose.yml # Local development stack
```

### ⚠️ Limitations

- **API Limits** (visible in-app at `/limits`)
  - Up to 25 clubs are processed for events by default — use the club filter to access specific clubs beyond this cap
  - Up to 200 clubs are fetched from Strava for the filter picker
  - Up to 100 upcoming events are fetched per club
  - Up to 20 route detail requests are made per page load; remaining events show basic info

### 📜 License

This project is licensed under the [BSD-2-Clause License](LICENSE).

### 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI powered by [FullCalendar](https://fullcalendar.io/)
- Styled with [Inter](https://rsms.me/inter/) font

HTTP responses include CSP, frame protection, nosniff and referrer/permissions policies. HSTS is enabled when `PUBLIC_URL` is HTTPS. Logout is a POST form protected by a session-bound CSRF token. The former `/dev/token` endpoint has been removed. See [HTTP security details](docs/http-security-step8.md).

Token refresh is coordinated per session through the shared MongoDB store, with versioned writes to prevent stale credentials overwriting a refresh or restoring a logged-out session. Keep the existing `ENCRYPTION_KEY`; stop old application instances before starting this version. See [encryption migration and refresh coordination](docs/session-security-step9.md).

Strava quotas are read from provider response headers. MongoDB-backed sessions also provide shared quota reservations and cooldowns across application instances using the same session database and CLIENT_ID. A complete club failure returns HTTP 502/429; partial club or route failures retain events and display warnings. See [quota handling and upstream failures](docs/strava-quota-step10.md).

Health probes are public and bypass sessions: `GET /health/live` returns 200 while the process responds; `GET /health/ready` returns 200 when initialized storage connections respond, otherwise 503. Responses disable caching and disclose only a status. Readiness checks never call Strava. PORT and session/cache TTL settings require positive decimal integers; CACHE_DRIVER accepts only memory or mongodb. The cache-clearing CLI supports shared MongoDB storage and rejects process-local memory clearing. See [configuration and operations](docs/operations-step11.md).

### Release history and publication

See [CHANGELOG.md](CHANGELOG.md) and the [release procedure](docs/releases.md).
