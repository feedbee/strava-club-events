# Data minimization

## Accepted scope

Keep the current calendar/list behavior, occurrence identity, joined and club/sport filters, route enrichment budgets, partial errors and user-specific cache boundaries. Build an explicit event response instead of spreading provider objects. Preserve IDs without numeric rounding. No session, encryption, release-version or deployment changes.

Provider models retain only consumed fields. Club cache: id, name, profile_medium, sport_type, localized_sport_type. Event cache: id, title, joined, address, terrain, skill_levels, activity_type, upcoming_occurrences and a route containing id/name. Route cache: id, name, resource_state, distance, elevation_gain, type, sub_type, estimated_moving_time, maximum_grade, elevation_high, elevation_low. Validate retained field types; nested profiles, maps, geometry, segments, permissions and unknown future fields are excluded.

Apply these projections before cache writes and on cache reads. Previously stored full responses are projected before use and rewritten when changed, using the configured TTL for that one-time scrub write. Unread old entries remain until their existing TTL; this is not a bulk database purge or a Git-history rewrite. A failed cache rewrite cannot cause excluded fields to reach the API.

The event API exposes only id, title, joined, address, club_info, terrain_label, skill_level_label, route_info, strava_event_url, start_date, occurrence_id and the optional route_details_failed flag. Unused provider pass-through fields are intentionally removed.

Replace checked-in provider examples with synthetic values while preserving their model shape and relationships. The fetch-model script must save synthetic examples by default; it must not persist original identifiers, personal strings, geographic data or tokens. Keep output in docs/examples, using synthetic file IDs. Do not log raw provider error bodies. Live provider calls and repository-history rewriting are outside this step.

## Acceptance checks

- Rich provider responses preserve used UI fields and exclude extra/nested private data in API and every cache layer.
- Existing rich cache hits are scrubbed without another provider request; unchanged minimized hits are not rewritten.
- Invalid optional objects cannot carry extra data through an allowed field; invalid top-level resource shapes fail explicitly.
- Recurring occurrences, filters, route errors and per-user isolation retain existing behavior.
- Examples preserve relationships and large-ID types, use synthetic values, and have no original personal data or geometry.
- Run default tests, disposable MongoDB persistence checks and the browser smoke on the current target runtime.

## Implementation verification — October 10, 2026

Implemented with explicit provider projections and event DTO. Legacy cache hits are scrubbed on access; unchanged minimal hits retain their expiry. Adapter write failures may leave the old record until successful rewriting or TTL expiry, while the response remains projected. All nine JSON examples now use synthetic values and filenames; the fetching script also saves only synthetic representations. Git history is unchanged.

117 ordinary and 11 MongoDB tests pass (128/128) on host Node.js 26.7.0 and target Node.js 24.21.0. Chrome verifies the real service DTO in month/list/week views, recurring occurrences, filtering failure, route warnings, 401, logout and CSP. No live Strava calls or production database access were performed. Version/publication and unfinished audit items were not included.
