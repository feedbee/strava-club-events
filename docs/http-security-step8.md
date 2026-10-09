# Step 8: HTTP security

Historical report: this describes the state at the end of step 8. See [audit progress](audit-progress.md) for the current implementation and remaining work.

## Logout

`GET /logout` returns 405 and `Allow: POST` without deleting the session. `POST /logout` requires a cryptographically random 32-byte token stored in the session and returned as `csrfToken` by `/me`. The HTML form submits it in a hidden field. Type, format and equality with the session token are checked using timingSafeEqual. Missing or invalid tokens return 403. This is a form-protection token, not a Strava access token.

Success destroys the server session, clears the cookie and redirects to the homepage with 303. A storage failure returns 503 without a misleading redirect or cookie deletion. The hidden form field is cleared after authentication loss. The profile panel opens on both hover and keyboard focus.

`/dev/token` is removed in all environments. The fetch-model script still accepts an explicitly supplied STRAVA_ACCESS_TOKEN; the application no longer exposes a bearer token over HTTP.

## Headers

CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy and Permissions-Policy are set before static/session middleware. Express does not emit X-Powered-By. HSTS max-age=31536000 is enabled for an HTTPS PUBLIC_URL, without includeSubDomains/preload.

CSP permits same-origin scripts and the specific pinned FullCalendar 6.1.21 file with its existing SRI. Inline scripts are prohibited: limits.html logic moved to limits.js. Objects, base URLs and framing are blocked; forms and requests are restricted to the same origin.

Styles retain unsafe-inline because FullCalendar and the existing interface generate runtime styles. Google Fonts are explicitly allowed. Font data URLs are permitted because FullCalendar uses them for icons. Images may load from the same origin and HTTPS; individual image hosts are not yet restricted. This is an enforced policy, not report-only.

## Verification

Before the fixes, new HTTP checks reproduced missing CSRF tokens and security headers. Now 70/70 tests pass on Node.js 26.7.0; 68/68 passed on target Node.js 24.21.0 before the last two HSTS and store-failure tests were added.

HTTP checks cover login/rotation/profile/logout, GET rejection, missing and invalid tokens, session preservation after rejected POST, session deletion after valid POST, absence of the development endpoint, static headers, HSTS and correct storage-failure responses.

Chrome checked calendar/list/week views, recurring occurrences, load and authentication errors, the POST form with token and redirect, and limits.js. No uncaught page errors or CSP violations. Browser checks use fixture API responses; actual session destruction is verified separately by HTTP tests. A real TLS proxy, live Strava and a repeat MongoDB run were not checked in this step.
