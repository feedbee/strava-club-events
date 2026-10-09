# Audit progress — October 9, 2026

The [original audit](code-audit-2026-10-09.md) describes the baseline. Current results are below and in the step 2–11 reports. This work is being committed locally for the owner's production verification; no public release or deployment was performed by the agent. Further audit work is paused at the owner's request until deployment feedback.

## Completed

- Regression tests and HTTP OAuth checks.
- Arbitrary callback redirects removed; single-use state, TTL and session ID rotation.
- Cookie/proxy flags and unsafe production defaults fixed.
- Encryption moved to the session-store boundary; AES-GCM reads legacy CBC sessions with the existing key. Concurrent refresh is coordinated through MongoDB; stale writes and session recreation after logout are rejected. Explicit temporary upstream responses preserve the session; an uncertain exchange outcome requires a new login.
- Node.js, npm dependencies and FullCalendar updated; both Docker builds checked in step 3. The npm audit at that point reported zero vulnerabilities.
- Strava timeouts, bounded queue/concurrency, request deduplication and user-specific route cache.
- Partial club errors visible in API/UI; memory cache size bounded.
- Storage initialization awaited before listen; graceful shutdown.
- Query type validation; filter races, loading cleanup, local dates and recurring events fixed.
- Logo escaping and HTTPS URL validation; private UI cleanup on 401; initial profile-load errors handled.
- **Step 8 — HTTP security:** session-token-protected POST logout, `/dev/token` removed, CSP/security headers. FullCalendar and the limits page verified in Chrome. A real HTTPS setup remains to be checked.
- **Step 9 — tokens/sessions:** AES-GCM, CBC reading, revisions and a refresh lease per session through MongoDB. Two independent processes and two Express instances verified against a shared database. Independent logins to the same Strava account do not share an account-wide lease.
- **Step 10 — quotas/failures:** overall/read quota headers, Retry-After, shared cooldown and reservations through MongoDB. Complete club failure returns 502/429; partial failure retains data. Route errors are visible in API/UI. Explicit 429 handling for OAuth login and refresh. See [step 10](strava-quota-step10.md).
- **Step 11 — operations/configuration:** strict PORT/TTL and CACHE_DRIVER; public liveness/readiness before sessions; MongoDB connection probes with deadlines; readiness withdrawn on shutdown. Cache clearing rejects the memory driver and reports MongoDB errors. Real server recovery after pausing MongoDB verified. See [step 11](operations-step11.md).

## Remaining work, in order

1. **Data minimization:** explicit DTO instead of `...event`, limited route-cache records and anonymized API examples. Git history has not been fully scanned or rewritten.
2. **CI and containers:** PR test/build gates; remove BuildKit master and excess workflow permissions; pin supply-chain versions. Repeat production Docker builds after the latest changes and verify HTTPS through a real reverse proxy. MongoDB integration has been rerun through step 11.
3. **Documentation and minor defects:** precise startup with an env file; stale callback/encryption descriptions; LICENSE; zero-valued metrics and duplicate percent signs. Session-created Markdown reports are now in English.
4. **Maintainability and accessibility:** separate large frontend/CSS files after stabilization; keyboard/focus and accessibility checks; account-specific preferences if needed. Selected clubs and sports reset on authentication loss, but other browser settings remain shared.

## Latest verification

106 ordinary and 10 MongoDB integration tests pass on Node.js 26.7.0 and target Node.js 24.21.0 (116/116). Integration covers GCM/CBC, two independent processes, two Express instances, refresh/logout, shared quotas, storage readiness and cache clearing. The real server returns readiness 503 while MongoDB is paused and 200 after recovery without restart; liveness stays 200. Live Strava tokens were not used. Chrome checked calendar/list/week views, two recurring occurrences, route warnings, 429 retry messages with calendar preservation, authentication loss, POST logout, CSP and the limits page without uncaught page errors or CSP violations. Real TLS proxy checks and production-image rebuilds after the latest changes remain outstanding.

## Deployment handoff

Keep the existing `ENCRYPTION_KEY` and `SESSION_SECRET`. Stop all old application instances before starting this version: old code cannot read the new GCM records or enforce the revision/lease protocol. Follow the production configuration requirements in [step 2](security-step2.md) and the migration details in [step 9](session-security-step9.md). The owner will push, deploy and test; the agent has not done so.
