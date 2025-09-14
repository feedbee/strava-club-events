# Strava Club Events Calendar

A modern web application that connects to Strava, fetches upcoming club events for the next 30 days, and displays them in an interactive calendar view with enhanced UI/UX.

### ✨ Features
- **Seamless OAuth2 Login** - Secure authentication with Strava using OAuth2
  - Automatic token refresh before expiration
  - Graceful session management
  - Secure token storage

- **Smart Event Fetching** - Automatically retrieves events from all your Strava clubs
- **Intelligent Filtering** - Shows only relevant events within the next 30 days
- **Beautiful Calendar UI** - Built with FullCalendar featuring:
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
Create a `.env-local` file in the project root with the following variables:

```env
# Required
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret

# Optional (defaults shown)
PORT=3000
```

> **Important:** Never commit your `.env-local` file or share your Strava API credentials.

### 🐳 Running with Docker Compose

1. Create `.env-local` with your Strava API credentials
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
   - Option 1: Create `.env-local` file (recommended)
   - Option 2: Export variables manually:
     ```bash
     export $(grep -v '^#' .env-local | xargs -d'\n')
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
    "title": "Morning Ride",
    "start": "2023-10-15T09:00:00Z",
    "url": "https://www.strava.com/clubs/123/group_events/456",
    "extendedProps": {
      "club_logo": "https://dgalywyr863hv.cloudfront.net/pictures/clubs/123/medium.jpg"
    }
  }
]
```

### 📁 Project Structure

```
strava-events-calendar/
├── .devcontainer/       # VS Code Dev Container configuration
│   ├── devcontainer.json
│   └── Dockerfile
├── public/              # Static assets
│   ├── index.html       # Main application UI
│   ├── styles.css       # Custom styles
│   └── index.js         # Frontend JavaScript
├── src/
│   ├── config/          # Configuration files
│   │   └── index.js
│   ├── controllers/     # Route controllers
│   │   ├── auth.controller.js
│   │   └── events.controller.js
│   ├── middleware/      # Express middleware
│   │   └── auth.middleware.js
│   ├── routes/          # Route definitions
│   │   ├── auth.routes.js
│   │   ├── events.routes.js
│   │   └── index.js
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
│       └── parsing.js
├── .env-local           # Local environment variables (gitignored)
├── .gitignore           # Git ignore rules
├── Dockerfile           # Production Dockerfile
├── docker-compose.yml   # Docker Compose configuration
├── package.json         # Node.js dependencies and scripts
└── README.md            # This file
```

### ⚠️ Limitations

This is a development-focused application with the following considerations:
- Uses a static session secret (not suitable for production)
- No refresh token rotation (sessions expire with the access token)
- Events are fetched on each page load (no caching)
- Minimal error handling in the UI

### 📜 License

This project is licensed under the [BSD-2-Clause License](LICENSE).

### 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI powered by [FullCalendar](https://fullcalendar.io/)
- Styled with [Inter](https://rsms.me/inter/) font
