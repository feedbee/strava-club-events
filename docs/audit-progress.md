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

## Remaining work, in order

1. **CI and containers:** a default-test PR gate and reproducible release procedure now exist from the v0.9.0 work. Remaining items include persistence coverage in gates, immutable supply-chain pins/runtime scanning and operator verification appropriate to future releases. Workflow tags are still mutable. Confirm actual HTTPS and live provider flows as needed; the owner's successful deployment is reported rather than independently reverified here.
2. **Documentation and minor defects:** local startup now loads `.env`, release guidance and the changelog are canonical. Remaining documentation inconsistencies should be reviewed against current code, including the still-missing LICENSE file. Zero-valued route metrics and duplicate percent signs remain.
3. **Maintainability and accessibility:** separate large frontend/CSS files after stabilization; keyboard/focus and accessibility checks; account-specific preferences if needed. Selected clubs and sports reset on authentication loss, but other browser settings remain shared.
4. **Historical data:** current examples are synthetic, but Git history has not been fully scanned or rewritten. Old cache records that are not read remain until TTL expiry; this step does not purge the database.

## Latest verification

117 ordinary and 11 MongoDB integration tests pass on Node.js 26.7.0 and target Node.js 24.21.0 (128/128). The additional coverage verifies minimal persisted models, old-cache scrubbing, explicit DTOs and synthetic model-script output. Existing refresh/logout/quota/storage tests still pass. Chrome checked the real service DTO with calendar/list/week views, two recurring occurrences, route warnings, 429 retry messages with calendar preservation, authentication loss, POST logout, CSP and the limits page without uncaught page errors or CSP violations. No live Strava tokens or production database were used in this step.

## Deployment handoff

Keep the existing `ENCRYPTION_KEY` and `SESSION_SECRET`. Stop all old application instances before starting this version: old code cannot read the new GCM records or enforce the revision/lease protocol. Follow the production configuration requirements in [step 2](security-step2.md) and the migration details in [step 9](session-security-step9.md). The owner already reports successful deployment of v0.9.0. This data-minimization change requires no signing/encryption-key rotation. Any next release follows docs/releases.md; the agent has not published or deployed this step.
