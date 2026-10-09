# Strava Club Events audit — October 9, 2026

Baseline: commit `742f2d1`, version 0.8.1. The working tree was clean before the audit. At the time of this report, code and dependencies had not been changed; only this report was created.

This is the original audit, not a description of the current implementation. See [audit progress](audit-progress.md) for completed fixes and remaining work. File line numbers below refer to the baseline.

## Findings

This small Express + vanilla JS project can be improved incrementally without switching stacks. The routes/controllers/services separation already supports that approach. The main risks concern OAuth, session configuration, Strava integration and asynchronous frontend state. Dependency updates are necessary but will not fix these application bugs by themselves.

Priorities: **P1** — fix before the next public release; **P2** — next improvement cycle; **P3** — maintainability and minor defects. P1 here does not mean confirmed account takeover.

## Scope and limitations

Reviewed backend, frontend, both caches, utilities, scripts, Docker/Compose/devcontainer, GitHub Actions, README, specifications, API examples and package-lock. Syntax checks passed for all 23 JavaScript files. Local reproductions used fixture data and built-in Node APIs, without real tokens.

Ran `npm audit --package-lock-only --ignore-scripts` and a separate audit with `--omit=dev`. Packages were not installed and the lockfile was unchanged. There was no local node_modules directory and no test/lint/build scripts. Full HTTP/OAuth flows, real MongoDB, browser execution and Docker builds were not tested. Production server and reverse proxy settings are unknown. Findings below distinguish demonstrated code bugs from risks requiring integration checks.

A search for obvious access_token/refresh_token/client_secret literals in tracked text files found no candidates. This is not a complete secret scan or a scan of the entire Git history.

## P1: security and authentication

### 1. Arbitrary redirect from the OAuth callback

**Location:** `src/utils/dev-callback.helper.js:25`, `src/controllers/auth.controller.js:40`.

`dev-callback-redirect` comes from the request, becomes a URL and receives all other parameters, including `code`. There is no environment check, address allowlist or binding to the initiated OAuth flow. The function also works in production without DEV_CALLBACK_REDIRECT configured.

**Reproduction:** the helper given `dev-callback-redirect=https://attacker.example/collect&code=dummy-code` returns a redirect to `https://attacker.example/collect?code=dummy-code`.

**Impact:** confirmed open redirect and the ability to forward an authorization code to an external address. A complete authorization-theft scenario depends on Strava's redirect_uri and code-exchange rules; it was not reproduced.

**Fix:** disable this flow in production or permit only an explicitly configured address bound to a server-side OAuth transaction; do not trust a query-supplied address.

### 2. OAuth without state protection

**Location:** `src/config/index.js:79`, `src/controllers/auth.controller.js:8,34`.

Login does not generate a random single-use state; callback does not compare it with the session. There is no alternative OAuth transaction binding, such as PKCE.

**Impact:** login CSRF / login-context substitution. SameSite=lax does not replace state for a top-level GET callback.

**Fix:** cryptographically random state, server storage, TTL, single-use verification and cancelled-login handling. Add PKCE only after checking Strava support. Reference: [OAuth Security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

### 3. Secure-cookie and proxy settings broken by boolean/string comparison

**Location:** `src/config/index.js:63`, `src/middleware/session.middleware.js:40`.

Configuration already converts settings to booleans; middleware then compares them with `'true'`. SESSION_TRUST_PROXY=true always becomes proxy=false. SESSION_SECURE_COOKIE=true produces secure=false. With false, secure depends on NODE_ENV, so false in production also fails to implement the documented setting.

**Reproduction:** configuration with both settings true contains boolean true; both middleware comparisons return false.

**Impact:** cookies may lack Secure despite explicit protection; behind a TLS proxy, sessions may be lost when secure is effectively true but the proxy is not trusted.

**Fix:** parse configuration once and use booleans directly. Define trusted proxies/hops separately; test HTTPS through a real proxy and HTTP in development.

### 4. Unsafe session defaults

**Location:** `src/config/index.js:14`, `src/middleware/session.middleware.js:11,38`.

The default secret is `supersecret`. SESSION_DRIVER=mongodb without a URI silently falls back to MemoryStore. saveUninitialized=true creates sessions for anonymous visits; session middleware precedes static assets. MemoryStore does not support shared production sessions and loses sessions on restart.

**Impact:** predictable signing secret, excessive session creation and unstable production persistence. A known secret alone does not grant access to another server-side session without its identifier.

**Fix:** require a strong production secret; fail startup instead of falling back; saveUninitialized=false; serve static files before sessions; use a shared production store.

### 5. Vulnerable production dependencies and unsupported Node in Docker

**Location:** `package-lock.json`, `Dockerfile:2`, `Dockerfile.build:3`, `.devcontainer/Dockerfile:1`.

Both application images and the devcontainer use Node 18, which is EOL: [official Node.js status](https://nodejs.org/en/about/eol). Local checks ran on Node 26.7.0 and do not establish compatibility with the Docker runtime.

Lockfile audit: **12 entries** overall (1 critical, 8 high, 3 moderate); **6 production** (1 critical, 2 high, 3 moderate). These count vulnerable packages, including transitive effects, rather than independent attacks.

| Production package | Locked version | npm severity | Reachability assessment |
|---|---|---|---|
| proxy-addr | 2.0.7 | critical | [IP spoofing advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h); the IPv4-mapped IPv6 subnet trust condition is not configured in this app; direct exploitation was not confirmed |
| express | 4.21.2 | high | Aggregates qs/body-parser/path-to-regexp issues; the transitive tree needs updating |
| path-to-regexp | 0.1.12 | high | [ReDoS advisory](https://github.com/advisories/GHSA-37ch-88jc-xwx2); current code has no routes with multiple parameters |
| qs | 6.13.0 | moderate | Query parsing is a public boundary; some advisories concern stringify/special options not directly used by the app |
| body-parser | 1.20.3 | moderate | Public JSON/urlencoded parsers are enabled; the specific invalid-limit defect does not follow from current settings |
| bn.js | 4.12.2 | moderate | Transitive through asn1.js; application handling of attacker-controlled input was not established |

Other entries concern development tooling: brace-expansion, braces, chokidar, minimatch, nodemon and picomatch. The main Dockerfile also installs devDependencies. npm suggests downgrading nodemon to 1.14.10 for one chain; this should not automatically be accepted as the correct fix.

**Fix:** use supported Node LTS; update the production tree separately from development tooling and the Express major migration; rerun audit. Do not blindly run npm audit fix --force.

## P2: security, reliability and correctness

### 6. Potential HTML injection through logo URLs

**Location:** `public/index.js:381,912`.

Calendar events and clubMarkupHtml insert external logos into HTML attributes without escaping. A string containing a closing quote and onerror creates an HTML handler. Other parts already use escapeHtml, making protection inconsistent.

**Status:** an unsafe sink is confirmed by code review; whether a user can set such a profile URL through Strava and exploit it in a browser was not checked.

**Fix:** createElement + img.src, boundary URL/scheme validation and a restrictive CSP. This does not imply every innerHTML use is unsafe: most list text is correctly escaped.

### 7. Encryption mutates tokens in the live session

**Location:** `src/utils/encryption.util.js:90`.

save replaces this.tokens with encrypted values without restoring plaintext. A second save in the same request encrypts ciphertext again. Locally reproduced: after two saves, one decrypt still returns a string with the encryption prefix. How often current express-session flows trigger this needs an HTTP test.

Additionally, CBC does not authenticate ciphertext; the key is not validated at startup; a decrypt failure leaves tokens={} and user in the session. /me can therefore show a profile while /events attempts to refresh an empty refresh_token. The fixed-IV comment is stale: the implementation actually uses a random IV.

**Fix:** encrypt at the session-store boundary without mutating request objects; use AEAD such as AES-GCM, versioned migration, key validation and consistent invalid-session termination.

### 8. OAuth session lifecycle is not explicitly completed

**Location:** `src/controllers/auth.controller.js:62`, `src/middleware/auth.middleware.js:18`.

Login does not regenerate the session ID or explicitly save before redirect with write-failure handling. express-session normally saves automatically, so data loss is not demonstrated, but ID rotation and write failures are untested. Parallel requests may refresh the same token independently and overwrite results. Every refresh failure, including temporary network/5xx errors, removes tokens but leaves user.

**Fix:** regenerate after validating callback; controlled persistence; per-session refresh coordination; distinguish invalid_grant from temporary failures; maintain consistent authentication state.

### 9. Strava failures become successful empty results

**Location:** `src/services/strava.service.js:424`.

Club-loading failures are caught and replaced with events=[]/rawCount=0. Even if all club requests return 429 or 5xx, /events can return 200 with an empty list. The user cannot distinguish no events from a failure.

**Fix:** club partial/error metadata; correct status on complete failure; clear warnings that do not present errors as an empty calendar.

### 10. No timeouts or shared management of Strava requests

**Location:** `src/services/strava.service.js:46,80,115,162`, `src/controllers/auth.controller.js:46`.

fetch has no AbortSignal timeout. All clubs run through Promise.all. The sport filter intentionally bypasses the cap of 25 per the specification: up to 200 clubs, plus 20 routes and the club-list request. That is an upper bound of 221 Strava requests on a cold load. The route limit applies to one application request, not the overall quota.

There is no concurrency queue, shared in-flight deduplication, Retry-After/quota handling or application request-frequency control. Multiple concurrent loads bypass the cache's benefit and repeat requests.

**Fix:** shared API client with timeout, bounded concurrency, deduplication, 429 handling and short controlled retries for safe requests. Preserve sport filtering but execute within a shared quota.

### 11. Route cache is shared across users

**Location:** `src/services/strava.service.js:146`.

Route API requests use a user's access token, but the full response is cached under the shared `_` key. A cache hit bypasses authorization at Strava. The current response uses only some fields and does not display route.starred; nevertheless, route availability/privacy are not checked before sharing.

**Status:** risk of cross-user metadata disclosure; a specific private-route scenario was not tested.

**Fix:** user-specific keys by default, or confirmed public visibility and an explicitly limited shared-cache model. Do not store full athlete data/geometry unnecessarily.

### 12. No readiness barrier or graceful shutdown

**Location:** `src/services/strava.service.js:19`, `src/server.js:18`.

Cache initialization runs in a detached async IIFE; server.listen does not wait. With MongoDB, a request can arrive before cache assignment and receive 500. No readiness endpoint or SIGTERM shutdown closes HTTP and Mongo clients.

**Fix:** explicit async bootstrap; await infrastructure before listen; readiness/liveness and graceful shutdown.

### 13. In-memory cache grows without background removal

**Location:** `src/cache/drivers/in-memory-cache.js:62,84`, `scripts/drop-cache.js:31`.

Expired entries are removed only on the next get of the same key. Data for users who do not return stays in the Map. There is no size bound. Memory-mode drop-cache creates a new empty instance in another process and cannot clear the running server's cache.

**Fix:** bounded TTL/LRU cache with cleanup; explicitly support only a persistent backend in the CLI or an in-process command. MongoDB init also uses obsolete useNewUrlParser/useUnifiedTopology options that must be checked against the updated driver.

### 14. Query parameters are validated after assuming their types

**Location:** `src/controllers/events.controller.js:24,37`.

clubs[]=1 or repeated clubs can produce an array/object; .split throws TypeError, giving 500 instead of 400. The same applies to sportTypes and OAuth code. External API data is also used without shape checks: an object instead of an Array can fail at map/find.

**Fix:** validate parameter types/size/count before parsing; schemas for minimal expected Strava responses; consistent 400/401/429/502/503 and safe messages.

### 15. Filter requests can overwrite new data with old results

**Location:** `public/index.js:683,1214`.

Debounce delays request starts but does not cancel active requests. An older filter response can arrive last and replace allEvents/allClubs/meta, leaving data inconsistent with active filters. Two initial loads may recreate calendarInstance. Reload failures leave calendar-loading because cleanup exists only on success.

**Fix:** AbortController and/or a monotonic request ID; apply only the current response; cleanup in finally.

### 16. Frontend authentication errors are handled inconsistently

**Location:** `public/index.js:14,1218,1369`.

loadUserProfile() is called without await/catch, so /me rejection escapes the surrounding try/catch. Subsequent loadEvents calls treat all failures, including 401, as generic errors. handleAuthRequired attempts to delete an HttpOnly cookie via document.cookie, which the browser disallows; it also leaves old private data and nav/calendar visible.

**Fix:** shared authentication state, awaited/Promise.all error handling, UI cleanup on 401 and server-side cookie/session deletion. Separate localStorage preferences by user: selected clubs currently carry across accounts in one browser.

### 17. List dates are grouped by UTC while times are local

**Location:** `public/index.js:614`.

The group key is start_date.slice(0,10); the server creates start_date with toISOString. Day headings and times use local dates. For example, 2026-10-10T22:30:00Z is already October 11 in Warsaw, but the card appears under October 10.

**Fix:** one explicit timezone and consistent date-key, heading, time and Today calculations; tests around midnight and DST.

### 18. Recurring events are reduced to one date

**Location:** `src/services/strava.service.js:206`.

Only the first matching upcoming_occurrences entry is selected with find. A weekly event with four occurrences in the 30-day window appears once. The code also relies on list order and does not guarantee the nearest date.

**Fix:** clarify the product contract: expand occurrences into entries with stable IDs if the calendar should show every meeting; otherwise name the next-meeting-only restriction explicitly and sort dates. The specification currently claims recurring support without describing this reduction.

## P3: infrastructure and maintainability

- **Tests and CI:** no test files, npm test/lint/build or PR quality workflow. The only workflow publishes Docker tags without checking behavior. The specification nevertheless marks tests and timezone/recurrence correctness as complete. Add checks for OAuth, cookies/proxy, encryption/store, refresh, API partial errors, filters and dates, then a PR gate. Syntax checks alone are insufficient.
- **Docker:** the main Dockerfile runs as root, uses npm install instead of npm ci and includes devDependencies; the release variant already uses non-root and production installation. Standardize reproducible builds. The Compose bind mount hides image contents, including installed node_modules when absent on the host. Development needs a separate volume or another mount layout.
- **Devcontainer:** apt lists are removed before a separate apt-get install git curl, which can fail without indexes. Combine update/install in a correct layer. Validate configuration against the current devcontainer schema.
- **Supply chain:** BuildKit is set to master; action tags are mutable; no digest pinning/runtime scanning. id-token:write is unused. FullCalendar loads from a CDN without SRI and outside npm lock; track its update separately. Google Fonts is another external runtime dependency.
- **Security headers:** the app does not set CSP, HSTS, frame-ancestors/X-Frame-Options or nosniff; infrastructure may set these, but that was not checked. /me, /events and /dev/token need explicit private/no-store rules. GET /logout changes state and permits logout CSRF; use protected POST. The development token endpoint exposes a bearer token with NODE_ENV=development and HOST=0.0.0.0; restrict or remove it from externally accessible deployments.
- **Data minimization:** prepareEvent spreads ...event instead of building an explicit DTO; API fixtures contain a real profile and route geometry. Check every field's necessity and anonymize examples. Address Git history separately if already published personal data must be removed.
- **Documentation:** npm start does not load .env/.env.local, although README recommends creating the file and starting the server; docker compose exec app uses the wrong service name (strava-app); the README-linked LICENSE is missing. Tokens are stored server-side and cookies hold a session ID, contrary to README's token-in-cookie claim. NODE_ENV/secure-cookie defaults are inaccurate; the event-response example differs from the current model.
- **Configuration:** no validation of enums, positive integer TTL/PORT or AES keys; `parseInt(...) || default` hides invalid values, accepts negative TTL and rejects zero without explanation. OAuth URLs use concatenation without URLSearchParams; a nested development callback with its own & parameters is parsed incorrectly.
- **Frontend:** 1,382 JavaScript lines combine API, authentication, rendering, state and picker; 1,840 CSS lines contain duplicate rules. Separate responsibilities after adding tests, without requiring React/TypeScript. Address calendar tooltip keyboard/focus, filter semantics and failure states; real accessibility/visual checks have not been performed.
- **Minor defects:** maximum_grade gains `%` on the server and another `%` in tooltips; zero elevation/distance are treated as N/A. The regex large-ID parser handles current positive integer IDs but is not a general lossless JSON parser. AbstractCache duplicates factory documentation and its documented get type differs from actual data.

## Existing strengths

- Small stack and clear backend layering.
- Tokens stay server-side; /me returns a limited profile.
- HttpOnly and SameSite=lax are configured; cookies contain a session ID.
- Clubs/events are cached per user; club filtering operates on that user's clubs.
- Most HTML text is escaped; tooltips use textContent.
- MongoDB cache checks expiresAt on reads and has TTL/unique indexes.
- Route fetch count is bounded; cache hits do not consume that budget.
- The release Dockerfile already uses a non-root user and npm ci.

## Proposed work sequence

1. **Capture behavior with regression checks:** OAuth callback/state, cookie/proxy configuration, session-store encryption, partial API errors and frontend races/date keys. Do this before major upgrades.
2. **Fix P1 code:** development callback, state, cookie/proxy, production configuration and session lifecycle. Verify login through an HTTPS reverse proxy.
3. **Update runtime/dependencies separately:** supported Node LTS everywhere; patch/minor production tree updates; development tooling separately; Express major migration with query-parser, async-error and session-integration checks. Rerun audit and both Docker builds. Track FullCalendar CDN separately from npm.
4. **Harden Strava integration/cache:** timeout, concurrency, in-flight deduplication, refresh coordination, 429/partial errors, readiness/shutdown, private-route isolation and bounded memory cache.
5. **Fix frontend correctness:** current responses, authentication errors, timezone grouping, recurring contract and loading cleanup.
6. **Improve maintainability:** PR CI, consistent containers, accurate startup instructions, anonymized fixtures, then frontend/CSS separation.

The next stage's completion criterion is more than a clean npm audit: login/refresh/logout work over HTTPS, sessions persist and encrypt correctly, API errors are visible, rapid filters do not show stale data, and calendar/list dates agree.
