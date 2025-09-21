# Strava Club Events Calendar

A modern web application that connects to Strava, fetches upcoming club events for the next 30 days, and displays them in an interactive calendar view with enhanced UI/UX.

### ✨ Features
- **Seamless OAuth2 Login** - Secure authentication with Strava using OAuth2
  - Automatic token refresh before expiration
  - Basic session management
  - Secure token storage

- **Event Management**
  - Fetches events from all your Strava clubs
  - Filters events to show only upcoming ones (next 30 days)
  - Displays detailed event information
  - **Smart Filtering System**
    - Filter events by join status (show only joined events)
    - Active filter counter shows number of applied filters
    - One-click filter reset
    - Persistent filter preferences across sessions

- **Beautiful Calendar UI** - Built with FullCalendar featuring:
  - Clean, modern interface with smooth loading states
  - Navigation bar that appears after calendar loads for a cleaner initial experience
  - Multiple view options: Month, Week, and Day views
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
  - Clean, modern interface with Inter font and custom styling
  - Support for various activity types with appropriate icons

- **Developer Friendly**
  - Docker and Docker Compose support
  - Development container configuration included
  - Environment-based configuration

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

### ⚙️ Configuration

#### Environment Variables
Create a `.env.local` file in the project root with the following variables:

```env
# Required
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret

# Optional (defaults shown)
PORT=3000
```

The app supports the following configuration variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_ID` | Yes | - | Strava API client ID |
| `CLIENT_SECRET` | Yes | - | Strava API client secret |
| `SESSION_SECRET` | No | `supersecret` | Secret for session signing (HTTP-only cookies) |
| `NODE_ENV` | No | `development` | Runtime environment |
| `HOST` | No | `0.0.0.0` | Bind address for the HTTP server (use `0.0.0.0` in Docker) |
| `PORT` | No | `3000` | Port for the HTTP server |
| `PUBLIC_URL` | No | `http://localhost:${PORT}` | Public base URL used to build OAuth redirect URI (`${PUBLIC_URL}/callback`) |
| `DEV_CALLBACK_REDIRECT` | No | - | Optional base URL for dev forwarding. When set in prod, login flow appends `dev-callback-redirect=<dev-base>/callback` and `/callback` forwards to it |
| `CACHE_DRIVER` | No | `memory` | Cache driver: `memory` or `mongodb` |
| `MONGODB_URI` | No | `mongodb://localhost:27017` | MongoDB connection string (when `CACHE_DRIVER=mongodb`) |
| `MONGODB_DB` | No | `strava-club-events` | MongoDB database name (when `CACHE_DRIVER=mongodb`) |
| `CACHE_TTL_DEFAULT` | No | `900000` | Default cache TTL in ms (15 minutes) |
| `CACHE_TTL_CLUBS` | No | `900000` | Clubs cache TTL in ms (15 minutes) |
| `CACHE_TTL_EVENTS` | No | `900000` | Events cache TTL in ms (15 minutes) |
| `CACHE_TTL_ROUTE` | No | `3600000` | Route cache TTL in ms (1 hour) |


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
| `/events` | GET | Returns JSON of upcoming club events (next 30 days) |

### Code Organization
- **Routes** are defined in `src/routes/`
- **Controllers** contain request handling logic in `src/controllers/`
- **Middleware** for authentication and other concerns in `src/middleware/`
- **Configuration** in `src/config/`
- **Static files** served from `public/`

#### Example Event Response
```json
[
  {
    "id": 456,
    "title": "Morning Ride",
    "start_date": "2025-10-15T09:00:00Z",
    "strava_event_url": "https://www.strava.com/clubs/123/group_events/456",
    "club_info": {
      "name": "Cycling Club",
      "logo": "https://dgalywyr863hv.cloudfront.net/pictures/clubs/123/medium.jpg"
    },
    "route_info": {
      "name": "City Loop",
      "distance": "42.5 km",
      "elevation_gain": "520m",
      "activity_type": "Ride / Road",
      "estimated_moving_time": "2h 10m",
      "max_slope": "8%",
      "elevation_high": "320m",
      "elevation_low": "40m"
    }
  }
]
```

### 📁 Project Structure

```
strava-events-calendar/
├── .devcontainer/     # VS Code Dev Container setup
├── public/            # Static frontend assets
│   ├── index.html     # Main application UI
│   ├── index.js       # Frontend JavaScript
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
├── .env.local         # Local environment variables
├── Dockerfile         # Production container setup
└── docker-compose.yml # Local development stack
```

### ⚠️ Limitations

This is a development-focused application with the following considerations:
- Limited security features (no session invalidation, no rate limiting)
- Limited error handling in the UI
- Mobile UI is not optimized

### 📜 License

This project is licensed under the [BSD-2-Clause License](LICENSE).

### 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI powered by [FullCalendar](https://fullcalendar.io/)
- Styled with [Inter](https://rsms.me/inter/) font
