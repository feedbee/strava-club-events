# Step 11: configuration, server health and cache clearing

## Strict configuration

`PORT` is now a number from 1 to 65535. `SESSION_MAX_AGE` and `CACHE_TTL_DEFAULT/CLUBS/EVENTS/ROUTE` are positive integer milliseconds; `SESSION_TTL` is positive integer seconds. Values must contain only decimal digits and fit safe numeric and JavaScript Date ranges. Empty strings, zero, negatives, fractions, suffixes, exponential notation and whitespace are rejected with the setting's name.

Defaults apply only when a variable is absent, not invalid. `CACHE_DRIVER` accepts only `memory` or `mongodb`. Valid existing ENV settings retain their behavior. Sessions use validated numbers without another parseInt/fallback. Keys and tokens do not need to change.

## Health contract

| Endpoint | Response | Meaning |
|---|---|---|
| GET /health/live | 200, `{"status":"alive"}` | The HTTP process responds |
| GET /health/ready | 200, `{"status":"ready"}` | Initialization is complete, required stores respond and shutdown has not started |
| GET /health/ready | 503, `{"status":"not_ready"}` | Initialization is incomplete, a store is unavailable or shutdown is in progress |

Both endpoints are public and return `Cache-Control: no-store`; they run before static assets, body parsing and session middleware. They do not create/update sessions or return URIs, driver errors, tokens or infrastructure details. Existing security headers apply.

Readiness checks existing real MongoDB connections separately for configured cache, sessions and quotas. Memory stores do not need network checks. MongoDB ping commands have a 1000 ms deadline; the overall check has a 1500 ms deadline with operation cancellation. Concurrent readiness requests share the current check. This checks connection availability, not every read/write permission, replica-set majority availability or sufficient disk space.

Strava is not called; its quota exhaustion does not change readiness. After database recovery, the next check can return 200 without restarting the application. SIGTERM/SIGINT withdraw readiness before closing the listener and stores. Once the listener closes, probes receive connection refusal; liveness remains 200 while the process serves HTTP. Initial store initialization is still awaited before listen: startup failure does not open HTTP.

Monitoring can use `/health/live` to decide on restarts and `/health/ready` to route user traffic. Automatic Docker/CI healthchecks and a real TLS proxy remain a separate step.

## Cache clearing

`node --env-file=.env.local scripts/drop-cache.js <userId>` clears only the specified user's entries in the `cache` collection when `CACHE_DRIVER=mongodb`. Use the intended instance's ENV; userId must match the internal identifier, for example `strava_12345`.

For the memory driver, the command exits with code 1 and explains that another process cannot clear the running server's memory. Restarting is required to reset it. Unknown drivers are also rejected. There is no public deletion endpoint.

MongoDB deletion errors now propagate instead of falsely reporting zero deleted entries. The CLI sets a nonzero exit code and closes the connection in finally, including initialization failure. Sessions and shared quotas are not deleted.

## Verification

- 106 ordinary + 10 MongoDB integration tests: 116/116 on Node.js 26.7.0 and 24.21.0.
- Covered valid/invalid settings, HTTP contract without session middleware calls, absence of cookies/error details, deadline/cancellation, shared concurrent probes and shutdown during a check.
- Real MongoDB: readiness of all configured connections, failure when the quota connection closes and recovery after replacement; the CLI deletes only the specified user's cache.
- Real `src/server.js` on Node.js 26 with MongoDB: readiness 200 before failure; after `docker pause` of the test database, 503 in 1028 ms and liveness 200; after `docker unpause`, readiness 200 again without restart. SIGTERM exited with code 0.
- The test database and container were removed. Live Strava tokens, the production database and a real TLS proxy were not used.
