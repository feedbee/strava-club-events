# React Native mobile client

Status: approved on 2026-10-26; implementation completed on 2026-10-27. Deployment, physical-device acceptance and upload remain separate; see `docs/mobile.md` for verification and remaining checks.
Date: 2026-10-26. Branch: `codex/mobile`.

## Objective and agreed scope

Build an Expo/React Native application for iOS and Android, preserving the web application's
event discovery features and visual identity. The first acceptance target is the owner's
physical iPhone, followed by an independently launchable TestFlight build using the existing
production backend at `https://str.valera.ws`. No separate hosted backend is introduced.

The owner has Xcode, Apple Developer Program membership and a USB-connected iPhone with
Developer Mode enabled. The first version is English-only. Web translation is future work.

Include List, Month, Week and Day; club/sport/joined filters; occurrence details and route
metrics; profile; sign-in/sign-out; manual refresh; a small offline snapshot; native sharing;
and user-confirmed export of a single occurrence to the system calendar.

Exclude push notifications, background polling, joining/editing events through the API,
automatic two-way calendar synchronization, web localization, and public store release.
Prepare TestFlight instructions/configuration; uploading requires an explicit publication
instruction. Do not deploy server changes automatically.

## Product behavior

- Retain the purple shell, white surfaces and orange Strava accent. Use native touch targets,
  safe areas, readable text, accessibility labels and platform Back/dismiss behavior.
- Default to List on first launch. Remember mode and filters per athlete/backend.
- Month shows occurrence counts/compact indicators and a selected day's agenda. Week and Day
  provide scrollable hourly layouts with selectable cards, including simultaneous starts.
  An occurrence's supplied start time is authoritative; no event finish time is available.
  Time-grid block height is a visual convention, not an asserted duration.
- Include Today and previous/next period controls. Reuse the web navigation bounds (complete
  previous month through the third following month) and the actual rolling occurrence window
  supplied by the server. Render dates in the phone's local timezone.
- Filter intersections and occurrence identity match web behavior. Preserve large IDs as
  strings. Club selection stays capped at ten; sport choices come from the club catalog.
- Details show available meeting point, club, terrain, skill and route information. Open
  validated Strava event/route URLs externally; joining remains on Strava.
- Show loading, empty, error, incomplete-result and rate-limit states distinctly. Keep usable
  data on refresh failure. Show API coverage warnings, including club/route limits.
- Refresh button and pull-to-refresh trigger a new backend request. Disable duplicate refresh
  while pending; honor Retry-After. This does NOT bypass the server's provider cache or quota.
  Label the timestamp 'Last synced' (backend response time), not 'Updated on Strava'.
- Reload when appropriate after returning to the foreground, with throttling; no background
  Strava polling. Only the latest request may update the displayed account/filter state.

## Offline snapshot and preferences

- Persist the latest successful response for the current filter combination and athlete,
  including its club catalog, coverage metadata, request filters, schema version and sync time.
  Do not treat a filtered subset as a complete snapshot of all clubs.
- Keep one bounded snapshot per current account/backend, replacing it on successful fetch.
  Maximum serialized size: 2 MiB; maximum offline retention: 24 hours. Expired/corrupt/oversize
  snapshots are discarded. These are local retention limits, not a claim of API freshness.
- Show 'Saved data · Last synced …' when serving a snapshot after a network failure. Filtering
  a snapshot may narrow its saved coverage, but cannot claim to fetch omitted clubs offline.
- A 401 is an expired session, not offline mode: stop authenticated loading, clear credentials
  and the account snapshot, and request sign-in. A network failure must not sign the user out.
- Clear the snapshot on logout and account/backend switches. Prevent in-flight requests from
  restoring another account's data. Do not include credentials in cache/preferences keys.
- Use AsyncStorage for non-secret preferences and this minimized snapshot. Use SecureStore for
  the app session credential. Never persist Strava access/refresh tokens on the device.

## Native actions

- Share title, local date/time and the canonical Strava event URL with React Native Share.
- Add to calendar opens the system's editable event composer, with title, start, meeting point
  and Strava source link. The user chooses calendar and confirms/cancels; no silent writes.
- Because the DTO has no end time, propose a clearly editable one-hour placeholder. Do not
  infer event duration from route moving time. Export only the selected occurrence, with no
  recurrence rule and no promise of automatic future updates.
- Prefer the system composer API without requesting read access to the user's calendar or
  reminders. Handle unavailable calendar apps, cancellations and denied permissions honestly.
- Repeated exports are user actions; the app does not claim cross-calendar deduplication.

## Architecture and stack

- Add an independently installable `mobile/` Expo project with its own lockfile and supported
  Expo/React/RN versions selected together at implementation time. Do not change the web React
  version or production Node major to match the mobile toolchain.
- TypeScript for new mobile code. Use Expo development builds rather than rely on Expo Go for
  custom OAuth callbacks and native modules. Generated `ios/`, `android/`, `.expo/`, bundles and
  signing material stay ignored; native configuration lives in Expo config/plugins.
- Planned native dependencies: Expo WebBrowser, Crypto, SecureStore, Calendar, LinearGradient,
  AsyncStorage and safe-area support. Confirm SDK-compatible APIs and permissions before use.
- Separate native screens/styles from pure date/filter/DTO rules. Extract existing pure helpers
  into `shared/` with compatibility exports for existing web imports; keep browser storage,
  DOM, React portals and hover behavior outside shared modules.
- Server changes are additive and use the existing event services, encryption and session
  persistence. No Strava client secret or provider token enters a JavaScript mobile bundle.
- Default API origin is `https://str.valera.ws`. Overrides are non-secret `.env` configuration;
  never use `.env.local` or commit environment files. HTTPS is required in release builds.
  Local development on a physical phone uses the Mac's LAN address, not phone `localhost`.
- Keep initial navigation simple: main calendar, filters, event details and account surfaces;
  no generic cross-platform UI abstraction or attempt to reuse web HTML/CSS.

## Mobile authentication and required server work

Existing `/login` and `/callback` establish a browser cookie and return to `/`. Native HTTP
requests do not automatically inherit the authentication browser's cookie. The unchanged
production server therefore cannot yet authenticate this native client.

Proposed additive protocol (final names may be refined without changing these guarantees):

1. Device generates a cryptographically random verifier and S256 challenge. Starts a short-lived
   mobile login transaction on the server. The server returns a browser authorization URL.
2. Open the system authentication browser. Keep Strava's registered HTTPS callback on the
   existing domain. Preserve state validation, expiry and session regeneration. Browser web
   logins retain their current behavior. The initial implementation may use Strava web OAuth
   in the system browser; launching the installed Strava app is optional, not required.
3. After successful authorization, return to a fixed application callback scheme such as
   `stravaclubevents://auth/callback` with a short-lived, one-use handoff code. Never include
   Strava tokens or a durable app credential in a deep link. Do not accept arbitrary return URLs.
4. Device redeems the handoff over HTTPS with its original verifier. Verify challenge, expiry
   and atomic single-use consumption before issuing an opaque, revocable app session credential.
   An intercepted link without the verifier must be useless. This is our handoff protection;
   it does not assume that Strava implements upstream PKCE.
5. Native routes accept the app credential in Authorization, backed by server-side state and
   existing session/token refresh coordination. Return a sanitized profile and the existing
   event DTO. Keep cookie/CSRF web authentication intact. App logout revokes its server session
   and returns JSON; locally clear credentials even if the network fails, with an honest warning
   when server revocation could not be confirmed.

Use the existing production MongoDB database for short-lived handoffs and hashed app-credential
lookups, with a dedicated collection and expiry index; memory implementation is development-only.
This is an additive persistence change requiring approval as part of this specification.
Never rely on an in-process map for production redemption/revocation. Enforce expiry when reading,
not just through MongoDB's asynchronous TTL deletion. Store provider tokens only through existing
encrypted session persistence. Avoid issuing duplicate copies of rotating refresh tokens in a
new independent token store. Reuse the session lifetime policy initially; do not promise permanent
login. Add bounded login/exchange throttling and redact sensitive query/header/body values.

Provide a capability/version check so a client against the old production deployment explains
that mobile login needs a server update. Demo UI remains usable before backend deployment.
No broad CORS relaxation, arbitrary redirect forwarding or web cookie copying is required.

## Repository structure

```text
mobile/                   Expo config, package/lockfile, App entry, build profiles
mobile/src/screens/       Calendar, filters, event details, account/sign-in
mobile/src/data/          API, auth, snapshot, preferences, calendar export
mobile/src/components/    Native controls, event cards, calendar views
shared/                   Pure DTO/filter/date rules used by web and native
src/routes/               Additive mobile HTTP routes
src/controllers/          Mobile HTTP shaping
src/services/             Mobile auth/handoff/session integration
tests/regressions/        Mobile auth, cache/date/filter behavior regressions
tests/integration/        Disposable MongoDB atomicity/expiry tests
docs/mobile.md            iPhone/Android setup, production backend rollout, TestFlight
```

Style example (new mobile code; existing server conventions remain):

```ts
export function sameOccurrence(left: EventOccurrence, right: EventOccurrence): boolean {
  return left.occurrence_id === right.occurrence_id;
}
```

Prefer named exports, explicit API types, small functions and native accessibility properties.
Do not assume missing route metrics are zero or derive identifiers from display titles.

## Implementation plan and verification checkpoints

1. Bootstrap the isolated mobile project and extract pure rules without web behavior changes.
   Verify root `npm test`, mobile TypeScript and an iOS/Android Metro export.
2. Implement mobile handoff/session routes and their regression tests before live integration.
   Cover invalid state/verifier, expiry, replay/concurrent redemption, cancelled OAuth, rejected
   destinations, session fixation, logout/revocation and refresh-versus-logout fencing. Verify
   existing browser auth tests and disposable MongoDB persistence tests.
3. Implement sign-in/API lifecycle and bounded account-isolated snapshots. Test offline startup,
   corrupt cache, stale requests, 401 versus network failure, expiry and logout/account switching.
4. Implement all four calendar views, filters, details and coverage warnings against synthetic
   data. Test local dates/DST, occurrence selection, bounds and simultaneous-start layout.
5. Add native Share/calendar composer and permissions/config. Verify actual composer confirm/
   cancel and external-link return on physical devices, rather than claiming native behavior
   from mocked unit tests alone.
6. Document build/install, sign-in with the deployed backend and TestFlight preparation. Run
   root/mobile gates and review the final diff. Record device/production checks not executable
   here instead of marking them passed.

Implementation commands to supply (mobile scripts will be created in step 1):

```sh
# Existing web/backend checks (repository root)
npm ci --ignore-scripts
npm test

# Mobile directory, once implementation exists
cd mobile
npm ci --ignore-scripts
npm run typecheck
npx expo export --platform ios --platform android
npx expo run:ios --device
# Subsequent JavaScript development after the native app is installed:
npx expo start --dev-client
# Android emulator or connected phone:
npx expo run:android --device
```

The iPhone build uses Xcode signing with the owner's team; no team ID or Apple credentials are
invented. Use provisional reverse-domain identifiers based on `ws.valera` and document changing
them before registering the App Store Connect app. Final identifiers must belong to the owner.

TestFlight has two documented options: generate the native iOS project and Archive/Distribute
through Xcode, or configure EAS and run `eas build --platform ios --profile production` followed
by `eas submit --platform ios`. Include configuration steps, unique build numbers, signing and
App Store Connect setup. A debug device install is not a TestFlight upload, and uploading to
TestFlight is not publication to the public App Store. Do not execute upload commands implicitly.

## Boundaries and acceptance

- Always: keep existing web flows working; validate external URLs; isolate accounts; preserve
  cache/provider limits; test meaningful auth/persistence changes; report actual verification.
- Approve with this spec: new mobile dependencies, shared helper extraction, additive backend
  routes and a dedicated expiring mobile-auth collection in the existing database.
- Ask separately: production deployment, schema/destructive changes beyond that collection,
  TestFlight/store upload, release/tag/image publication, changes to the Strava registration.
- Never: read secrets into logs, commit environment/signing files, test against production
  MongoDB, embed provider secrets/tokens in the app, claim store/provider approval is guaranteed.

Success: all four views work on synthetic data; native build/export and tests pass; the owner
can install on iPhone using documented commands; after separately deploying the server update,
the real account can sign in and load production events; offline/refresh/share/calendar flows
are verifiable; a signed TestFlight build can be prepared with documented owner steps.

Public-store readiness remains separate: privacy/deletion/revocation policy, review access,
brand/service permission and current platform submission requirements require a release review.
Do not broaden this first device-testing change into a full provider-compliance audit.

## Strava approval and references

Strava documents mobile OAuth and existing registration/callback domains. No separate approval
solely for using a native client is documented. Testing an already-connected owner account is
expected to use the existing registration; this is an inference, not a live-account verification.
Additional testers remain subject to that registration's athlete capacity and permissions.
The current account's tier/limits and callback configuration have not been inspected.

- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/getting-started/
- https://developers.strava.com/docs/rate-limits/
- https://docs.expo.dev/guides/local-app-development/
- https://docs.expo.dev/versions/latest/sdk/webbrowser/
- https://docs.expo.dev/versions/latest/sdk/calendar/
- https://docs.expo.dev/submit/ios/

Known provider dependency: club `group_events` access works through the existing service boundary,
but public distribution/support of that endpoint and the use case is not established by this spec.
