# Audit progress — October 10, 2026

The [original audit](code-audit-2026-10-09.md) describes the baseline, and dated step reports preserve their original verification. This file tracks implementation work; release status belongs in [CHANGELOG.md](../CHANGELOG.md). The owner reports that deployed v0.9.0 works and authorized the next audit step on October 10. Data minimization is now implemented locally; this step has not been published or deployed by the agent.

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

- **Data minimization:** explicit event DTO and minimal club/event/route models; old rich cache hits are scrubbed before use and rewritten. Provider examples and future model-script output are synthetic. See [design and verification](changes/data-minimization.md) and [model coverage](api-model-coverage.md).

- **Interface and minor defects:** zero/absent route metrics and double percent fixed; native browser modules and ordered CSS; keyboard focus, inert panels, native list/picker buttons and typed preferences. Current README/API examples corrected and the declared BSD-2-Clause license added. See [design and verification](changes/interface-refactoring.md).

## Remaining scope

- **Historical data:** current examples are synthetic, but Git history has not been fully scanned or rewritten. Old cache records that are not read remain until TTL expiry; this work does not purge the database.
- **Operator verification:** check actual HTTPS and live provider flows for each future deployment as needed. Local fixture checks do not independently verify production.

## Excluded by owner decision

On October 10, 2026, the owner explicitly excluded further CI work. Persistence gates, immutable
workflow/base-image pins and runtime image scanning are therefore removed from the active audit
plan. Existing CI remains as it was. Account-specific preferences were optional and are not added:
view mode and joined-only remain browser-wide, while private club/sport selections clear on 401.

## Latest verification

119 ordinary tests pass on Node.js 26.7.0 and target Node.js 24.21.0 for the interface/metric change.
Chrome checks the real ES module graph, month/list/week views, recurrence, keyboard controls,
focus restoration, zero/single-percent rendering, four viewport widths, 429 preservation,
authentication loss, POST logout, CSP and the shared limits/about pages. No live Strava credentials or
production database were used. Persistence was unchanged; its 11 MongoDB checks last passed during
data minimization (128/128 at that step). No further CI changes were made.

## Deployment handoff

Keep the existing `ENCRYPTION_KEY` and `SESSION_SECRET`. Stop all old application instances before starting this version: old code cannot read the new GCM records or enforce the revision/lease protocol. Follow the production configuration requirements in [step 2](security-step2.md) and the migration details in [step 9](session-security-step9.md). The owner already reports successful deployment of v0.9.0. The data-minimization and interface changes require no signing/encryption-key rotation. Any next release follows docs/releases.md; the agent has not published or deployed this step.
