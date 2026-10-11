# Audit regression checks

These checks began with steps 1–3 of [the audit plan](../docs/code-audit-2026-10-09.md) and now cover the implemented security, reliability, data-minimization and interface work.

## Run

```sh
npm test                  # default gate: 119 passing checks
npm run test:baseline     # baseline/security/HTTP subset
npm run test:regressions  # audit regression subset
```

All default tests must pass. See [current testing conventions](../docs/testing-conventions.md).

Install the exact lock-file dependencies with `npm ci --ignore-scripts`. HTTP checks bind to an ephemeral 127.0.0.1 port and use real Express, express-session and MemoryStore; the Strava response is stubbed. No real Strava credentials or database are required. Run with Node supporting `node:test` and VM modules; validated on Node 24.21.0 in both production container variants, with an additional host run on Node 26.7.0. The VM module flag emits Node's experimental feature warning. Node 18 is no longer supported.

## Scope

Baseline checks preserve large numeric IDs, normal callback URL construction, safe `/me` responses, anonymous access rejection, encryption round trips/random IVs, encryption of both stored credentials, user cache isolation/expiry, club membership and sport filter semantics, joined-only filtering, HttpOnly/SameSite cookie options, valid access token handling, and frontend 401 classification.

Regression checks require:

- Session-bound OAuth state and rejection of unsolicited callback codes.
- No forwarding of production callback codes to arbitrary hosts.
- Correct explicit secure-cookie and proxy-trust options.
- Two session saves without double encryption or mutation of live tokens.
- Visible upstream club-fetch failure instead of a successful empty result.
- Local calendar date grouping across UTC midnight (Europe/Warsaw).
- New filter responses winning over stale requests, using controlled promises rather than sleep.
- Loading state cleanup after a failed filter request.

## Test boundaries

`helpers/runtime.js` loads the backend ES modules without source rewriting into isolated VM contexts. It replaces only the external boundaries selected by a test: `node-fetch`, the session middleware constructor, and MongoStore. Real configuration, controllers, middleware, services, memory cache and crypto execute. Each test gets a fresh environment and module graph. The helper waits for memory-cache dynamic import completion; it does not fix or validate production startup readiness.

Frontend state checks follow `public/prototypes/calendar/coordinator.js` imports and flatten import/export declarations into a small DOM fake. This is deliberately not a browser module-loader test; the real ES module graph is exercised by Chrome smoke. For request ordering, calendar rendering is replaced while the real loading and API state transitions run. DOMContentLoaded initialization is not invoked. These tests cover state/date logic, not React rendering, real DOM parsing, XSS exploitability, layout, keyboard support, or browser behavior.

The session constructor fake inspects application-provided options. The persistence fake exercises encryption at the store boundary. Additional real HTTP tests validate session ID rotation, encrypted-session reloading, logout and Secure/HttpOnly/SameSite cookies. TLS proxy behavior is simulated with forwarded headers, not a real reverse proxy or TLS handshake. Real MongoDB and Chrome integrations have since been verified; see the sections below and the step reports.

The suite now covers refresh races, partial failures, route cache isolation, recurrence, shutdown, quotas and resource bounds. Live provider behavior, a real HTTPS proxy and assistive-technology usability remain operator checks.

Step 2 also checks production startup validation, malformed keys, state expiry/mismatch/replay/cancellation, persistence failures, refresh 400 vs 503 behavior, and legacy/corrupt/nested encrypted sessions. Those original club API and frontend regressions are now fixed; all ordinary checks pass.

## MongoDB integration (step 3)

```sh
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:mongodb
```

These additional checks require a disposable MongoDB server and create/drop randomly named `strava_audit_*`, `strava_refresh_*`, `strava_quota_*` and `strava_operations_*` databases. They use the real MongoDB driver, connect-mongo, Express and session persistence with stubbed Strava exchange. They are separate from `npm test` so ordinary tests do not require a database; absence of TEST_MONGODB_URI is an error rather than a silent skip. Validated against MongoDB 8 on Node 24.21.0.

Express 5 may emit a Promise-like handler deprecation warning for controllers loaded through the isolated VM helper: their async functions belong to a different JavaScript realm. Production modules run in one realm. VM modules themselves also emit Node's experimental feature warning.

## Session security (step 9)

`npm test` now includes GCM integrity/context checks, CBC compatibility, guarded session writes, refresh error handling, queued request deadlines and logout fencing. `test:mongodb` includes two independent Node processes sharing one refresh, two Express instances with a common store, logout during refresh, interrupted leases and real CBC migration. The full 87-test set passed on Node 24.21.0 with MongoDB 8. API exchanges use fixtures, not live Strava tokens.

## Strava quotas (step 10)

Quota tests exercise short/day windows, Retry-After seconds and HTTP dates, out-of-order counters, queued request cooldown, all-club failures, empty success, route degradation and OAuth 429. MongoDB integration uses two independent connections sharing the application state and verifies concurrent reservations, shared API/OAuth cooldown and reset. The full suite passes 100/100 (92 ordinary + 8 MongoDB) on Node 24.21.0 and 26.7.0. Browser smoke also checks route warnings and 429 retry messages while preserving the calendar. Provider responses remain fixtures.

## Configuration and operations (step 11)

Tests cover strict numeric configuration, cache driver validation, health HTTP contracts without session requests, readiness timeout/cancellation and shutdown, real MongoDB connection checks/recovery, and cache CLI isolation. All 116 tests (106 ordinary + 10 MongoDB) pass on Node 24.21.0 and 26.7.0. The genuine server also recovered readiness after the disposable MongoDB container was paused and resumed.

## Data minimization

The default suite verifies the explicit event DTO, each minimal provider cache record, existing rich cache hits, failed scrub writes, malformed optional values and invalid resources. Model-script checks cover synthetic filenames/values, large reference IDs and suppression of raw error bodies. The MongoDB suite verifies new stored records and scrubbing of real legacy entries with user isolation. At the data-minimization step, all 128 checks (117 ordinary + 11 MongoDB) passed on Node 24.21.0 and Node 26. Browser smoke now obtains its initial event fixture from the real Strava service projection rather than constructing a DTO manually.

## Interface refactoring and route metrics

The default suite now has 119 checks, including zero/absent route metrics and corrupted preference
validation. The browser smoke also covers native list buttons, keyboard expansion/collapse,
checkbox focus preservation after selection, Escape focus restoration, calendar tooltip focus,
single percent signs, and list/calendar overflow at 320, 768, 1024 and 1440px.
Persistence behavior did not change in this step; its 11 MongoDB checks were not rerun.
