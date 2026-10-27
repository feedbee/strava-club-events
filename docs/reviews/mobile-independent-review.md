# Mobile independent review and corrections

Date: 2026-10-27. Scope: mobile feature commits after `11be257`, followed by fixes on `codex/mobile`.
The owner requested an independent agent review and correction of substantive findings.

An independent reviewer inspected the feature and sent concrete findings with reproductions.
Its final/re-review turn hit an account usage limit; this document does not claim independent
approval of the corrected code. The primary agent reproduced findings and verified the fixes.

## Findings and disposition

| Priority | Failure | Correction and evidence |
| --- | --- | --- |
| P1 | Structurally corrupt event/catalog snapshots could reach React rendering and crash, despite valid JSON. API responses had the same weak boundary. | Shared native DTO validation/projection is used by network reads and snapshot restoration. Tests cover null catalog entries, non-text fields, duplicate IDs, route values, metadata, large IDs and removal of unknown fields. |
| P2 | Corrupt/non-text profile names passed saved/API identity validation and could crash `.charAt()` or Text. | Profile projection validates optional text fields in both `readUser` and `savedCredential`; regression tests reject object/number/array names. |
| P2 | A default snapshot of the first 25 clubs could claim complete coverage for an omitted club; changing filters also hid the original cap warning. | Coverage now checks the catalog, processed-club cap and failed-club IDs. Warnings use the response's source filters. Tests cover club 26, partial failure and broadening selection. |
| P2 | Failed Keychain deletion plus offline logout could silently restore the old credential on restart. Delayed deletion could also remove a subsequent sign-in. | Durable sign-out marker, serialized credential mutations, a version fence and a retryable cleanup UI prevent restoration and races. Tests reproduce failed deletion, overlapping delete/sign-in, concurrent sign-in and logout during sign-in. |
| P2 | A newly exchanged credential could remain active when profile validation failed before SecureStore persistence. | Any failure after issuance attempts server revocation; regression test confirms the abandoned credential is revoked. |
| P2 | Mongo throttling incremented and then read the global count separately; a simultaneous burst could reject every request, including those inside the budget. | Atomic `findOneAndUpdate(returnDocument: after)` returns each increment's own count. Controlled concurrency regression permits exactly 30/rejects 1; real MongoDB test permits 30/rejects 10. |
| P2 | Calendar export required calendar access on iOS 16 even though the app deliberately does not request read permission; Expo default target 16.4 advertised support. | Explicit iOS 17 minimum through `expo-build-properties`, verified in generated native configuration. Permissionless user-confirmed composer remains the integration. |
| P2 | A 23:50 event extended below the fixed scroll content and could have its title/tap area clipped. | Hourly grid reserves trailing card space after midnight. |

During corrections, the primary agent also propagated cancellation to `/me` validation and stops
obsolete loads before issuing event requests. A React-hook regression verifies the cancellation
signal and that only the current request reaches event loading.

## Verification

- Root `npm test`: 166 passed (includes web build and loopback HTTP checks).
- `TEST_MONGODB_URI` pointed only to a newly created disposable Docker MongoDB: 13 passed.
- Independent mobile `npm test`: 10 passed; `npm run typecheck` passed.
- iOS/Android Metro export passed.
- Generated iOS configuration sets `ios.deploymentTarget` to 17.0; native Release simulator build
  Release simulator build passed after regeneration.
- The original Docker image builds/runtime smoke are recorded in `docs/mobile.md`; they were not
  repeated for native-only corrections and an atomic MongoDB operation covered by the real database tests.

No live Strava login, production database, physical device, store upload or production deployment
was used. Share/calendar UI acceptance on real devices and Android native compilation remain
operator checks. Existing dependency-audit advisories are recorded in `docs/mobile.md`.
