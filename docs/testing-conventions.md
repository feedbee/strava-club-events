# Testing conventions

Install: `npm ci --ignore-scripts`. Default gate: `npm test` (119 checks after interface refactoring; 117 after data minimization; 106 at v0.9.0 preparation).
`npm run test:baseline` and `npm run test:regressions` are focused subsets.

The default suite covers pure rules, service scenarios with substituted Strava boundaries, real
loopback HTTP flows, encryption and frontend state/date behavior. It needs no Strava credentials
or database. Node VM modules may emit experimental warnings. Tests must be green, not intentionally failing.

For persistence, refresh coordination, quotas or storage changes, also run
`TEST_MONGODB_URI=<disposable URI> npm run test:mongodb` (11 checks after data minimization).
These tests create/drop randomized databases; never use production MongoDB.
Browser smoke in `tests/integration/browser-smoke.mjs` is an explicit optional Playwright check;
see that script for prerequisites. Live Strava and real TLS proxy verification remain operator smoke tests.

There is no lint, type-check or compilation command. Build production packaging with
`docker build -f Dockerfile.build -t strava-club-events:check .` and also check `Dockerfile`.
CI runs the same default suite on Node 24, separately from tag-only image publication.

Calendar experiment browser gate (optional): install/provide Playwright and its Chromium browser,
then run `node --experimental-vm-modules tests/integration/calendar-experiment-smoke.mjs`.
`PLAYWRIGHT_MODULE` may select an absolute Playwright package path; `CHROME_EXECUTABLE` may select
an installed Chrome executable. The script starts its own ephemeral loopback server, uses only
synthetic demo data and needs neither Strava credentials nor MongoDB. Sandbox loopback restrictions
may require approved execution. See the migration plan for live-account checks still required.

React implementation gate: `npm run build` in addition to `npm test`. Optional
`tests/integration/react-shell-smoke.mjs` checks the built `/next/` bundle, synthetic login/logout,
responsive profile disclosure and substituted `/me` success/401/503 responses. Build first;
Playwright configuration is the same as the calendar experiment smoke.

Mock design backend: `npm run dev:mock` starts a standalone loopback server on 8092 without Strava,
MongoDB or production configuration. Default checks include deterministic fixtures and its real
HTTP contract. Optional `tests/integration/mock-calendar-smoke.mjs` checks scenario switching and
prototype/React session flows; build the React frontend first. See `prototypes/calendar/README.md`.

React calendar gate: build first, then optionally run `tests/integration/react-calendar-smoke.mjs`
with the same Playwright variables. It starts the shared mock server and checks Month/List,
inline overflow, route details, filter intersections, responsive width, bounded bidirectional
scrolling, empty results and retry after an API error.

React hourly/preview gate: after `npm run build`, optionally run
`tests/integration/react-time-preview-smoke.mjs` with the same Playwright variables. It checks
Week/Day simultaneous starts, responsive mode normalization, preview dimensions and full-area
clicks before/during/after the hover animation on the standalone mock backend.
