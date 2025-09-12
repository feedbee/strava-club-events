# Strava Club Events Calendar

A simple Node.js app that connects to Strava, fetches upcoming club events for the next 30 days for the authenticated user, and displays them in a browser using a basic calendar view.

### Features
- OAuth2 login with Strava
- Fetches the user's clubs and their group events
- Filters events to the next 30 days
- Displays events in a calendar (FullCalendar via CDN)
- Dockerized; reads environment from `.env-local`
- Ready for Remote Containers/Dev Containers

### Prerequisites
- Docker and Docker Compose (recommended), or Node.js 18+
- A Strava API application (`CLIENT_ID`, `CLIENT_SECRET`)

### Environment Variables
Provide via `.env-local` at the repo root or via shell envs:
- `CLIENT_ID`: Strava app client ID
- `CLIENT_SECRET`: Strava app client secret
- `PORT` (optional): defaults to `3000`

Example `.env-local`:
```
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret
PORT=3000
```
Do not commit real secrets.

### Run with Docker Compose
1) Create `.env-local` as above.
2) Start services:
```
docker compose up --build
```
3) Open `http://localhost:3000` and click "Login with Strava".

The project folder is bind-mounted into the container for quick iteration. If you add dependencies, rebuild the image or run `npm install` inside the container.

### Run locally (Node.js)
```
npm install
# optionally: export envs from .env-local
export $(grep -v '^#' .env-local | xargs -d'\n')
npm start
```
Visit `http://localhost:3000`.

### OAuth Callback URL
The server expects `http://localhost:PORT/callback` (default: `http://localhost:3000/callback`). Configure this in your Strava app settings.

### API
- `GET /login`: Redirects to Strava OAuth authorization
- `GET /callback`: Exchanges code for access token; stores it in session
- `GET /events`: Returns JSON of upcoming group events across the user's clubs for the next 30 days (requires session)

### Project Structure
- `server.js`: Express server, OAuth, `/events` logic
- `public/index.html`: Minimal UI with FullCalendar
- `Dockerfile`: Node 18 base, apt update, installs deps, runs server
- `docker-compose.yml`: Ports, bind mount, `env_file: .env-local`
- `.env-local`: Local environment (not checked in with real secrets)

### Notes / Limitations
- Static session secret (demo only); not production-ready
- No refresh token rotation; access token stored in memory session
- No caching; events fetched per request, minimal error handling

### License
BSD-2-Clause
