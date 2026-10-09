# Step 9: AES-GCM and token-refresh coordination

Historical report: this describes the state at the end of step 9. Step 10 subsequently added explicit HTTP 429 handling; see [audit progress](audit-progress.md) for the current state.

## Key and migration

**Keep the existing ENCRYPTION_KEY.** Its format remains 64 hexadecimal characters (32 bytes). No key change or manual database rewrite is required.

New token records use AES-256-GCM: a random 12-byte nonce, a 16-byte authentication tag and the `:encrypted::v2:` version prefix. Additional authenticated data binds each token to the session ID and access_token/refresh_token field: moving ciphertext between sessions or fields is rejected. Corrupt records cause the invalid session to be deleted, without leaving its profile authenticated.

The old `:encrypted::<IV>:<ciphertext>` format is read using CBC with the same key. The next save migrates it to GCM. Older plaintext sessions can also be read and encrypted on write. Previous CBC records do not retroactively gain integrity protection. Token encryption is covered, not encryption of the entire session document. Encryption remains disabled without ENCRYPTION_KEY; every instance must use the same setting and key.

## Shared coordination

For each server session, MongoDB stores a random `_revision` and a temporary refreshLease with an owner. Atomic operations check the lease and revision in the same document as the session. New application instances use majority write concern. No extra collections, Redis or background jobs are needed for refresh coordination.

A request rereads the session before refreshing. If another request has updated tokens, it uses the stored values. Otherwise, one owner acquires the lease, exchanges tokens and saves the result only when the revision matches and the lease is valid. Other requests wait and reread the result. Waiting is checked against a ten-second budget between storage operations; contention returns 503 while preserving the session. MongoDB operations have their own bounded timeouts.

The lease lasts 30 seconds; Strava's total timeout now includes queue waiting and response reading and is 15 seconds. A request that expires in the queue never starts an exchange later. If a session is deleted, there is nowhere to save the result: commit does not upsert. Ordinary saves also check revisions and cannot recreate a deleted session. Unchanged snapshots are acknowledged without rewriting tokens, allowing parallel Express responses to finish after a shared refresh.

Memory mode uses revisions and local operation serialization. It remains a single-process development mode. The distributed lease applies **to one session ID**, not an entire Strava account with several independent logins.

## Errors and interrupted exchanges

- Explicit 400/401 or an invalid exchange response: terminate the session and return 401.
- Explicit temporary rejection (for example 429/503): release the lease, preserve the session and return 503 for retry at this step. Step 10 later preserves 429 and its retry time.
- Timeout/network disconnect: the exchange outcome is unknown, so terminate the session. Do not blindly replay the old refresh token.
- An expired lease after a process crash: terminate the session without another exchange. The user logs in again.
- Logout during refresh: document deletion prevents a late response from restoring authentication.

## Deployment

Keep the existing ENCRYPTION_KEY and SESSION_SECRET. **Stop all old instances before starting the new version:** the old version cannot read GCM and does not enforce revision/lease checks. The new version can still read old CBC sessions. Rolling back to old code after GCM writes requires new logins; reverse ciphertext migration is not implemented.

Do not rotate the key as part of this update: old records would become unreadable. If the key has previously leaked, key rotation and session termination are a separate operation.

## Verification

80 ordinary tests and 7 MongoDB integration tests: **87/87** on Node.js 26.7.0 and 24.21.0. Covered:

- GCM, random nonces, nonce/tag/ciphertext tampering, session/field binding.
- CBC with the previous key and migration of a real MongoDB record, including an old session without a revision.
- Rejection of stale writes and deleted-session recreation; concurrent unchanged snapshots.
- One exchange across two independent Node processes sharing MongoDB.
- Two Express instances, shared refresh and logout during an HTTP request.
- Expired leases, temporary rejection, uncertain timeout and bounded queue waiting.

Tests used a separate disposable MongoDB 8 and fixture tokens. The running deployment and its database were unchanged. Replica-set failover and live Strava were not tested. The VM HTTP harness emits an Express warning about a Promise from another JavaScript realm; native processes do not use this harness.
