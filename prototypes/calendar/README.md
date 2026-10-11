# Local mock backend for design development

Run `npm run dev:mock` from the repository root, then open `http://127.0.0.1:8092/`.
Optional port: `npm run dev:mock -- --port 8093`.

The server binds only to loopback and imports no production config, Strava client, sessions or MongoDB. It serves the existing prototype via normal `/me`, `/events`, `/login`, `/logout` requests. The prototype's `?mock=1` displays a **Mock data** disclosure with the scenario selector. Fixtures are relative to the server's startup date and reproducible when an explicit date is passed in tests. Restart to reset sessions/date.

Scenarios: dense calendar (84 events, seven per populated day, three simultaneous starts, joined/unjoined), empty, missing route/logo/attributes, long multilingual titles, month/year boundaries with midnight starts, twelve clubs, HTTP 503, HTTP 429 with Retry-After, and a two-second events delay. Club/sport filtering uses the same query names as production. Scenario state and synthetic login are isolated by HttpOnly SameSite cookie for each browser context; logout requires the synthetic CSRF token. Nothing changes your real Strava session on port 3000.

React is the primary UI at `http://127.0.0.1:8092/?mock=1` after `npm run build`.
The native reference remains at `/prototypes/calendar/index.html?mock=1`. Both use the same
cookie-isolated mock session and scenario API. For hot reload with mocks, run
`npm run dev:mock -- --port 3000`, then `npm run dev:frontend`.

Production launch remains `npm start`; the mock server is not imported or selected by production code. Existing frontend-only `?demo=1` remains available as a frozen visual reference. Prefer the mock backend for further features and API/error/loading behavior. Avoid adding separate mock implementations of UI components.

Checks: `npm test` includes fixture and HTTP API tests. Optional `tests/integration/mock-calendar-smoke.mjs` checks scenario switching and prototype/React login/logout in Chromium, using `PLAYWRIGHT_MODULE` / `CHROME_EXECUTABLE` when needed. Build React first.
