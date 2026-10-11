# Changelog

Canonical user-facing release history. Use an Unreleased section for pending changes;
move it into a dated version section when preparing a release. GitHub Release bodies
are extracted from this file, not maintained separately. Older versions are recorded
by Git tags; their release notes have not been reconstructed.

## [1.0.0] - 2026-10-11

### Added
- New responsive calendar design with Month, Week, Day and List views, hourly layouts, animated event previews and accessible event details.
- Club and sport pickers with search, club logos and account-isolated presentation preferences.
- Synthetic demo mode and a standalone mock backend for design development and edge-case checks.

### Changed
- The React frontend is now the primary interface at `/`; the legacy frontend and FullCalendar dependency are removed. `/next` redirects to `/`, preserving query strings.
- Upcoming events span the next 90 days. Calendar navigation covers the complete previous month through the third following month.
- OAuth login and logout return to the primary interface; cancellable event requests preserve current filters and distinguish loading, empty results, authentication loss and provider errors.
- Production Docker images build the React frontend with Vite on Node.js 24.21.0.
- Copyright notices now use 2026.

### Upgrade notes
- Local and source deployments require `npm ci --ignore-scripts` and `npm run build` before startup. Deploy the generated `public/app/` assets together with the shared `public/` tree; production Docker images include them.
- Preserve existing encryption/signing keys and MongoDB configuration. No database migration is required.
- Browser preferences are scoped by account and demo mode; old browser-wide preferences are not migrated.
- Live Strava, production HTTPS proxy and real-account smoke checks remain operator checks; unfinished audit work is not expanded in this release.

### Artifacts
- Docker image: `feedbee/strava-club-events:1.0.0` (amd64 and arm64).
- [Full changes](https://github.com/feedbee/strava-club-events/compare/v0.9.1...v1.0.0).

## [0.9.1] - 2026-10-10

### Security
- Events and cached Strava models retain only consumed fields; organizing profiles, route geometry and unknown provider fields are excluded. Existing full cache entries are scrubbed when read.
- Provider model examples and future fetch-model output use synthetic values and identifiers; upstream error bodies are no longer logged by that script.

### Fixed
- Zero route distance, elevation, slope and estimated time remain visible instead of becoming `N/A`; calendar tooltips no longer add a second percent sign.
- Keyboard focus survives picker selection and returns to visible controls on Escape; collapsed filters are inert and list cards use native buttons.
- Corrupted browser preferences cannot introduce invalid field types or unknown fields.

### Changed
- Frontend behavior is separated into native ES modules and shared CSS into ordered files, without a new build tool or dependency.
- Documentation now shows the current event DTO and browser architecture; the declared BSD-2-Clause license is included.

### Upgrade notes
- Deploy the complete `public/` tree, including the new `js/` and `css/` directories; the browser now loads native ES modules.
- `/events` no longer forwards unused raw Strava fields; consume the documented event DTO. Existing encryption/signing keys remain unchanged. Unread legacy cache records expire by their existing TTL; Git history is not rewritten.

### Artifacts
- Docker image: `feedbee/strava-club-events:0.9.1` (amd64 and arm64).
- [Full changes](https://github.com/feedbee/strava-club-events/compare/v0.9.0...v0.9.1).

## [0.9.0] - 2026-10-10

### Added
- Public liveness and readiness probes at `/health/live` and `/health/ready`.
- Shared Strava quota reservations and cooldowns for MongoDB-backed sessions.
- Default-test CI and documented, repeatable release preparation and publication.

### Changed
- Production and development containers use Node.js 24.21.0 and lockfile-based installs.
- Local commands automatically load `.env`; Compose and editor configuration use the same file.
- Strava requests use bounded concurrency, timeouts and deduplication; memory caches have size limits.

### Fixed
- Recurring events show each distinct upcoming occurrence within the next 30 days.
- New filter responses take precedence over stale requests; loading indicators clear on failure.
- List dates follow the browser's local calendar day.
- Partial club and route failures retain available events and show warnings; complete failures return errors instead of an empty calendar.
- Storage initializes before accepting traffic, and shutdown closes connections gracefully.

### Security
- OAuth uses expiring, single-use session-bound state and rotates the session after login.
- Tokens remain in server-side sessions with authenticated AES-GCM encryption and legacy CBC reading.
- MongoDB refresh leases and revision checks prevent concurrent refresh and stale session writes after logout.
- Logout requires POST and CSRF protection; security headers, safer URL rendering and private UI cleanup protect browser sessions.
- Production configuration rejects unsafe session, cookie and public URL settings.

### Upgrade notes
- Stop all old application instances before starting this version. Preserve existing `ENCRYPTION_KEY` and `SESSION_SECRET`. Old code cannot read newly written GCM sessions; rollback may require users to log in again.
- Set `NODE_ENV=production`, an HTTPS `PUBLIC_URL`, `SESSION_DRIVER=mongodb`, a reachable `MONGODB_URI`, a stable session secret of at least 32 characters, and secure cookies. Trust forwarded headers only behind an isolated trusted proxy.
- Remove `DEV_CALLBACK_REDIRECT`; OAuth callbacks must go directly to the application's `/callback`. The `/dev/token` endpoint and callback forwarding are removed.
- Rename any previous local env file to `.env` without committing its contents.

### Artifacts
- Docker image: `feedbee/strava-club-events:0.9.0` (amd64 and arm64).
- [Full changes](https://github.com/feedbee/strava-club-events/compare/v0.8.1...v0.9.0).
