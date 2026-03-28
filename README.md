# Strava Club Events Calendar

A modern web application that connects to Strava, fetches upcoming club events for the next 30 days, and displays them in an interactive calendar or list view with enhanced UI/UX.

### ✨ Features
- **Secure Authentication** - Robust OAuth2 implementation with Strava
  - Automatic token refresh before expiration
  - Configurable session management with multiple storage backends
  - Optional AES-256-CBC encryption for sensitive session data
  - Secure cookie configuration with httpOnly, secure, and sameSite flags

- **Event Management**
  - Fetches events from all your Strava clubs
  - Filters events to show only upcoming ones (next 30 days)
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
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your Strava API credentials
4. Start the server: `npm start`
5. Open `http://localhost:3000` in your browser

## 📱 Features in Detail

#### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (recommended)
- [Node.js 18+](https://nodejs.org/) (for local development without Docker)
- A [Strava API application](https://www.strava.com/settings/api) with `CLIENT_ID` and `CLIENT_SECRET`

### 🔒 Security Features

- **Token Rotation**: Access tokens are automatically refreshed before expiration
- **Secure Storage**: Tokens stored in HTTP-only, secure cookies
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
DEV_CALLBACK_REDIRECT=

# Session Configuration
SESSION_DRIVER=memory  # or 'mongodb'
SESSION_SECRET=your_session_secret
SESSION_TTL=86400  # 24 hours in seconds
SESSION_SECURE_COOKIE=true  # set to false for HTTP
SESSION_TRUST_PROXY=false  # set to true if behind a reverse proxy

# MongoDB Configuration (required if using mongodb driver)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=strava-club-events

# Encryption (highly recommended for production)
ENCRYPTION_KEY=your_secure_encryption_key_here

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
| `DEV_CALLBACK_REDIRECT` | No | - | Development callback URL for OAuth flow |
| **Session** | | | |
| `SESSION_DRIVER` | No | `memory` | Session storage: `memory` or `mongodb` |
| `SESSION_SECRET` | No | `supersecret` | Secret for signing session cookies |
| `SESSION_TTL` | No | `86400` | Session lifetime in seconds (24h) |
| `SESSION_SECURE_COOKIE` | No | `true` | Use secure cookies (HTTPS only) |
| `SESSION_TRUST_PROXY` | No | `false` | Trust reverse proxy headers |
| `ENCRYPTION_KEY` | No | - | AES-256-CBC key for encrypting sensitive data |
| **MongoDB** | | | |
| `MONGODB_URI` | If using MongoDB | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | If using MongoDB | `strava-club-events` | Database name |
| **Cache** | | | |
| `CACHE_DRIVER` | No | `memory` | Cache driver: `memory` or `mongodb` |
| `CACHE_TTL_DEFAULT` | No | `900000` | Default cache TTL in ms (15m) |
| `CACHE_TTL_CLUBS` | No | `900000` | Clubs cache TTL in ms (15m) |
| `CACHE_TTL_EVENTS` | No | `900000` | Events cache TTL in ms (15m) |
| `CACHE_TTL_ROUTE` | No | `3600000` | Route cache TTL in ms (1h) |


> **Important:** Never commit your `.env.local` file or share your Strava API credentials.

### 🐳 Running with Docker Compose

1. Create `.env.local` with your Strava API credentials
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
  - Or install inside the container: `docker compose exec app npm install <package>`

### 💻 Local Development (Node.js)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   - Option 1: Create `.env.local` file (recommended)
   - Option 2: Export variables manually:
     ```bash
     export $(grep -v '^#' .env.local | xargs -d'\n')
     ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### OAuth Callback URL
The server expects `http://localhost:PORT/callback` (default: `http://localhost:3000/callback`). Configure this in your Strava app settings.

### 🔌 API Endpoints

#### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | GET | Initiates OAuth flow with Strava |
| `/callback` | GET | Handles OAuth callback and token exchange |

#### Events
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | GET | Returns `{ events, clubs, meta }` for upcoming club events (next 30 days) |
| `/events?clubs=id1,id2` | GET | Filter to up to 10 specific clubs |
| `/events?sportTypes=cycling` | GET | Filter by sport type (case-insensitive) |

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
```json
{
  "events": [
    {
      "id": "456",
      "title": "Morning Ride",
      "start": "2026-04-01T09:00:00Z",
      "end": "2026-04-01T11:00:00Z",
      "url": "https://www.strava.com/clubs/123/group_events/456",
      "club": { "id": 123, "name": "Cycling Club" },
      "recurring": false
    }
  ],
  "clubs": [
    {
      "id": 123,
      "name": "Cycling Club",
      "logo": "https://...",
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
│   ├── index.js       # Frontend JavaScript
│   ├── limits.html    # API limits explanation page
│   └── styles.css     # Global styles
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
├── .env.local         # Local environment variables
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
