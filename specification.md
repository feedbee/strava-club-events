## Strava Events Calendar — Functional Specification

### 1. Objective
Build a minimal web application that authenticates a user with Strava, fetches group events from all clubs the user has joined, filters events to the next 30 days, and renders them in a simple calendar UI.

### 2. User Roles
- Regular user (authenticated via Strava OAuth2)
- No admin role at this stage

### 3. User Flows
1) Landing
   - User opens `http://localhost:3000`
   - If unauthenticated, page displays a link to “Login with Strava”
2) Login
   - Clicking link redirects to Strava OAuth authorize URL
   - After consent, Strava redirects to `/callback?code=...`
3) Token Exchange
   - Server exchanges `code` for `access_token` and stores it in session
4) Events View
   - Frontend requests `GET /events`
   - Server fetches clubs and their `group_events`, filters to next 30 days, returns JSON
   - Frontend maps events to FullCalendar and renders a month view

### 4. Scope (MVP)
- OAuth2 login (authorization_code)
- Server-side session for access token
- Endpoints: `/login`, `/callback`, `/events`, static assets
- Events filtering: now → now + 30 days using `start_date_local`
- Basic calendar UI via FullCalendar CDN
- Dockerized runtime; `.env-local` for local secrets; devcontainer support

### 5. Non-Goals (for now)
- Refresh token rotation and token persistence
- Production-ready security (session store, CSRF, HTTPS termination)
- Server-side rendering or complex UI
- Caching, pagination, or retries/backoff
- Error detail surfacing to UI

### 6. APIs and External Integrations
- Strava OAuth2
  - Authorization: `GET https://www.strava.com/oauth/authorize`
  - Token: `POST https://www.strava.com/oauth/token`
- Strava REST
  - `GET /api/v3/athlete/clubs`
  - `GET /api/v3/clubs/{club_id}/group_events`

### 7. Server Endpoints
- `GET /login`
  - Redirects to Strava authorize with `scope=read,read_all,profile:read_all,activity:read_all,club:read`
- `GET /callback`
  - Exchanges `code` for `access_token`, saves to session, redirects to `/`
- `GET /events`
  - Requires `access_token` in session; returns combined events for next 30 days
- Static: Serves `public/` (contains `index.html` and assets)

### 8. Environment & Configuration
- Required: `CLIENT_ID`, `CLIENT_SECRET`
- Optional: `PORT` (default `3000`)
- `.env-local` consumed by `docker-compose.yml` via `env_file`
- OAuth redirect: `http://localhost:${PORT}/callback`

### 9. Data Model (implicit)
- Session: `{ access_token: string }`
- Event (subset from Strava): `{ title, start_date_local, route? }`

### 10. UI Specification
- Title: “Strava Club Events”
- If unauthenticated: show login link
- If authenticated: render FullCalendar month view
- Event title: `event.title`
- Event start: `event.start_date_local`
- Optional URL: `event.route?.url`

### 11. Error Handling
- `401` from `/events` when no session token
- `500` for unexpected errors; logs to server console
- Frontend logs errors to browser console only

### 12. Security Considerations (MVP)
- Session secret is static in code (not production-grade)
- No HTTPS in dev; deploy behind TLS in production
- Do not commit real secrets; use environment variables

### 13. Operational Concerns
- Dockerfile uses Node 18 and runs `node server.js`
- `docker-compose.yml` exposes `3000:3000`, binds repo into container, loads `.env-local`
- Use VS Code Dev Containers or similar for remote development

### 14. Acceptance Criteria
- User can authenticate via Strava and return to app
- After authentication, `/events` returns non-empty array when clubs have upcoming events
- Calendar displays events occurring within the next 30 days
- App runs via Docker Compose with `.env-local`

### 15. Future Enhancements (Roadmap)
- Persist and refresh tokens; handle token expiry
- Configurable time window and filters (club, type)
- Pagination and batching for clubs/events; caching layer
- Improve error messages and UI states
- Secure session store (Redis) and rotated secrets
- Deploy manifests (Dockerfile optimizations, Kubernetes/Compose profiles)
- Tests (unit for server, integration with mocked Strava API)


