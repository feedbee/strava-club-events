# Step 10: Strava quotas and explicit failures

## Behavior

The shared client reads `X-RateLimit-Limit/Usage` and `X-ReadRateLimit-Limit/Usage`, tracking short and daily quotas separately. Limits come from the application's responses, not fixed public defaults. The short window resets every 15 minutes; the daily window resets at midnight UTC. Source: [official Strava documentation](https://developers.strava.com/docs/rate-limits/).

One quota unit is reserved before each network API request. Reaching a known limit stops new requests until reset. After 429, `Retry-After` is honored as seconds or an HTTP date, but the wait cannot be shorter than a known exhausted quota requires. Without valid `Retry-After`, API requests wait until the next 15-minute window. A late response does not lower counters or carry usage from an old short window into the new one.

Production with MongoDB stores state in `strava_rate_limits`, keyed by `CLIENT_ID`, with atomic revisions for reservations across instances. Cooldown survives restart. All instances of one application must use the same session database. Memory mode is process-local. Quota storage initializes before listen and closes on shutdown; coordination failure does not permit quota bypass.

OAuth exchanges have a separate cooldown after 429; without a header, it is 60 seconds. This is application policy, not a claim that Strava excludes OAuth from all its limits. API quota exhaustion alone does not block OAuth. The client does not automatically retry requests, especially single-use code exchanges and refresh tokens. A refresh 429 preserves the session. Login with an already consumed OAuth state must be started again.

Complete failure of the selected clubs returns 502; if any cause is quota exhaustion, it returns 429 with `Retry-After` and `retry_after`. A genuinely empty successful result remains 200. Partial failures preserve successful events and existing club-error details.

A route failure preserves the event with basic information. The API reports `routes_failed`, `route_errors`, `events_route_details_failed`, `partial` and an available retry time. `routes_failed` counts unique routes; the event count can be higher because of recurring occurrences. Skipping routes due to the internal request budget remains a separate warning. An invalid route response is also a failure.

The interface explains the Strava limit and approximate wait. A failed filter request preserves displayed events and removes loading state. Partial data includes a route warning.

## Verification and limitations

92 ordinary + 8 MongoDB integration tests: 100/100 on Node.js 26.7.0 and target 24.21.0. Covered short/daily quotas, Retry-After, queueing, late responses, complete failure, empty success, routes and OAuth. Two independent MongoDB connections concurrently reserve the remaining shared quota, share cooldown and recover after reset. Previous refresh/logout scenarios also pass.

Chrome checked route warnings and 429 retry messages, calendar preservation, month/list/week views, recurrence, 401, POST logout and CSP. Live Strava requests were not made: provider responses are fixtures.

Accounting is conservative: reservations are not refunded after uncertain network outcomes. Already active parallel requests can finish after cooldown is established. The client does not know actual limits until they arrive in a response. Other programs using the same CLIENT_ID but another database are detected only through Strava responses. There are no automatic retries or guarantees that 429 will never occur.

No ENV or encryption-key change is required. The step 9 requirement to stop old instances before deploying still applies; a real HTTPS proxy and repeat production builds remain future integration checks.
