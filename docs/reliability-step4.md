# Step 4: Strava and cache reliability

Historical report: this describes the state at the end of step 4. Queue deadlines, distributed refresh coordination and route warnings were subsequently changed; see [audit progress](audit-progress.md).

The shared API/OAuth client limits active requests to four and the queue to 256. Overflow returns 503. An active request, including body reading, is limited to 15 seconds; cancellation is passed through AbortController. Queue waiting time is not included in this step's timeout. There are no automatic retries: code exchange and refresh-token rotation must not be repeated blindly. Upstream errors retain their HTTP status; the event controller returns 429 for Strava rate limits and 502 for other failures.

Concurrent cache misses for the same user and resource share one request. Failures are not cached. Routes now use a user-specific key instead of the shared `_`: one user's private route cannot serve another user's request. Old shared entries are no longer read and expire by TTL.

Club errors appear in `meta.partial`, `meta.clubs_failed` and `meta.errors` (club ID and status). Available events are preserved; the interface warns about incomplete results. Route failures currently fall back to basic route information without a separate warning.

The memory cache is bounded to 1,000 entries and 32 MiB of serialized values. It evicts least recently used entries, removes expired entries on writes and refuses oversized values. Actual memory consumption includes JavaScript overhead and may exceed serialized size. MongoDB connections and operations have bounded timeouts.

Cache initialization is explicit and awaited. The server waits for cache and MongoDB session-store readiness before opening its port. SIGTERM/SIGINT stop accepting requests, wait for active connections and close stores; shutdown is limited to ten seconds.

Concurrent exchanges of the same refresh token are deduplicated within a process; new tokens are saved before continuing the request. This is not a distributed lock. Late requests with old session snapshots and multiple server instances still require storage coordination. This step resolves simultaneous exchanges for a single process; horizontal scaling should not yet be considered ready.

Repeated `clubs`/`sportTypes` parameters return 400 instead of causing a `.split()` error.

## Verification

- `npm test`: 56 checks, 53 pass. Three previously identified frontend regressions remain for the next step: local-date grouping, stale filter responses and loading cleanup after failure.
- Six new checks: stalled upstream, queue/concurrency limits, club-request deduplication, route isolation, cache eviction/size and refresh deduplication.
- Real `src/server.js` launch with memory cache/sessions and SIGTERM: exit code 0.
- Checks ran on installed Node.js 26.7.0. A repeat run on target Node.js 24, MongoDB and live Strava after these changes was not yet completed at this point.
