# Mobile development and device testing

The client lives in `mobile/` and has its own package-lock. The web/backend install is unchanged.
Default backend: **https://str.valera.ws**. No new hosted server is required.
For Android USB development, signed Google Play bundles and paired TestFlight/Internal testing,
follow [the distribution guide](mobile-distribution.md). Expo/EAS cloud accounts are optional.

## Install on your USB-connected iPhone

Requirements: iPhone on iOS 17 or later, Xcode with the iOS platform installed, CocoaPods, Node 24.21.0 (or owner-permitted
Node 26), Apple Developer membership and an unlocked/trusted iPhone with Developer Mode enabled.
Xcode must already have your Apple account under Settings → Accounts.

From the repository root:

```sh
cd mobile
npm ci --ignore-scripts
npx expo run:ios --device
```

Select your physical iPhone when prompted. Expo generates `ios/`, installs CocoaPods, compiles,
signs with the selected development team, installs the application and starts Metro. If automatic
team selection fails, open `mobile/ios/ClubEvents.xcworkspace` in Xcode, select the **ClubEvents**
target → Signing & Capabilities → your Team → Automatically manage signing, and rerun the command.
You can also select the iPhone in Xcode and press Run.

The provisional application ID is **ws.valera.clubevents**. Confirm it is available in your team
before registering the app in App Store Connect. Change `ios.bundleIdentifier` and
`android.package` in `mobile/app.config.js` if necessary. The OAuth scheme must remain
`stravaclubevents` unless both server and app callback constants are changed together.

For subsequent JavaScript/TypeScript edits, with the app already installed:

```sh
cd mobile
npx expo start --dev-client
```

Keep the phone and Mac on a reachable network; permit the Mac's local-network prompt. A debug
build loads JavaScript from Metro. USB installation alone does not guarantee Metro connectivity.
Use the development client's displayed server URL/QR code if it does not reconnect automatically.
Rebuild after changing native dependencies, plugins, permissions, bundle IDs or the URL scheme.
After updating to the review fixes, run `npx expo prebuild --platform ios` once before rebuilding
so an existing generated Xcode project receives the explicit iOS17 deployment target. Native
folders are generated; keep lasting configuration in `app.config.js` rather than manual edits.
Expo Go is not the acceptance target for this app.

### Standalone device build

To view the application without keeping Metro running:

```sh
cd mobile
npx expo run:ios --device --configuration Release
```

This is a local device install, **not** a TestFlight upload. Development signing may be selected
by Expo/Xcode for a local install; App Store distribution signing is a separate step.

## Production backend update

**The currently deployed backend must receive this branch's server changes before real mobile
login will work.** Building/installing the app does not update `str.valera.ws`.
The client checks `/mobile/capabilities` and shows an explanatory message if the deployed server
is too old. The existing browser login and UI remain supported.

Deploy through the normal project release/deployment process in [releases.md](releases.md),
with the existing `.env`, MongoDB database, callback URL and encryption/signing keys. This change
introduces no required environment variables and no separate server. Production remains Node 24.
Do not use a production database for tests.

On startup, the server creates a **mobile_auth** collection in the existing configured session
database with an `expiresAt` TTL index. Its database user needs permission to create that index
and read/write the collection. No existing data is migrated or dropped.

### Why the extra collection exists

A system authentication browser and a native HTTP client do not share their session cookies.
A successful Strava login therefore needs a safe handoff back to the phone:

1. The phone generates a random verifier and sends its SHA-256 challenge with a separate state
   value to `/mobile/login`. The verifier stays in memory on the phone.
2. The server starts the existing Strava OAuth flow, keeping the registered HTTPS `/callback`.
   Browser session state protects that flow as before.
3. After login and session regeneration, the server redirects to
   `stravaclubevents://auth/callback` with an opaque one-use code and the phone's state.
4. `/mobile/exchange` checks the phone's verifier and atomically consumes the handoff record.
   An intercepted link cannot be exchanged without the verifier. This proof protects our
   handoff; it does not depend on Strava supporting upstream PKCE.
5. The phone receives its own random app credential. SecureStore holds it on-device; the
   collection holds only its hash and a pointer to the existing encrypted Express session.
6. `/mobile/me` and `/mobile/events` use this bearer credential to load the existing session,
   retaining the same provider-token refresh and logout fencing. There is no second independent
   copy of Strava's rotating refresh token.
7. `/mobile/logout` destroys the session and deletes the credential record. Late requests cannot
   recreate the destroyed authenticated session.

The collection contains three record kinds:

| Kind | Contents | Lifetime |
| --- | --- | --- |
| Handoff | Hash of one-use code, challenge, session ID | 60 seconds; atomic removal on successful exchange |
| Credential | Hash of app credential, session ID | Rolling `SESSION_MAX_AGE`, 24h by default |
| Throttle | Hashed network peer and minute bucket, count | Until the end of that minute |

Successful profile and event requests renew the credential and return its new expiry in
`X-Mobile-Session-Expires-At`, which the app stores with the credential. The idle window
uses the web's `SESSION_MAX_AGE`. It has no absolute cap while successful requests keep
renewing it. Explicit logout revokes the credential. Failed profile or event responses do
not renew it. Every authorization read checks expiry explicitly. MongoDB's eventual TTL
deletion only cleans up old records. The default login budget is 30 login/exchange requests per minute per network peer,
shared across instances. Behind a proxy this deliberately uses the directly connected peer rather
than trusting a caller-supplied forwarded IP; testers behind the same proxy share this budget.

This collection never contains Strava access/refresh tokens, passwords or the client secret.
Memory storage is used only with the development memory-session driver. MongoDB is mandatory in
production as before. Session-store loss, expiry or logout makes the corresponding app credential
unusable even if its hash record has not yet been cleaned up.

Native API contract:

| Endpoint | Authentication | Result |
| --- | --- | --- |
| `GET /mobile/capabilities` | Public | `{ version: 1, callback }` |
| `GET /mobile/login?challenge=…&state=…` | Browser OAuth | Redirect to Strava; fixed app callback on success |
| `POST /mobile/exchange` | One-use code + verifier | `{ token, expiresAt }` |
| `GET /mobile/me` | Bearer app credential | Sanitized profile, no provider tokens/CSRF token |
| `GET /mobile/events?clubs=…&sportTypes=…` | Bearer app credential | Existing `{ events, clubs, meta }` |
| `POST /mobile/logout` | Bearer app credential | 204; revoked session |

POST bodies are JSON, limited to 4 KiB and uncompressed. Exchange takes `{ code, verifier }`;
logout takes `{}`. Challenge, verifier, state and codes are 64 lowercase hexadecimal characters.
Mobile errors return JSON with `error` and optional `retry_after`; expired/invalid auth is 401,
throttling is 429, persistence/service failure is 503. No arbitrary callback URL is accepted.
Avoid logging request queries, Authorization headers or exchange bodies in the reverse proxy.

## Strava setup and approval

Reuse the existing client registration and its callback domain `str.valera.ws`; the phone does not
need the client secret. Initial sign-in uses Strava OAuth in the system authentication browser,
not an embedded WebView, and does not require the Strava app to be installed.
No separate mobile-OAuth approval is documented by Strava. We expect an already-connected owner
account to work with the existing registration, but real production login is a device acceptance
check after deploying the server. We have not inspected your Strava dashboard or changed it.

Other TestFlight users remain subject to the existing application's athlete capacity. Installing
through TestFlight does not raise that capacity or grant additional Strava scopes. Public use of
the club-events API/use case and branding remains a separate provider/release check.

References: [OAuth](https://developers.strava.com/docs/authentication/),
[getting started](https://developers.strava.com/docs/getting-started/),
[athlete capacity](https://developers.strava.com/docs/rate-limits/).

## Local development instead of production

Use only `.env` for local configuration. The mobile project supports a non-secret
`EXPO_PUBLIC_API_URL` in `mobile/.env`, for example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000
```

Use your Mac's actual LAN address. `localhost` on the iPhone refers to the iPhone, not the Mac.
HTTP overrides are accepted only by JavaScript development builds; release builds require HTTPS.
The app does not disable platform transport security globally: use a locally reachable HTTPS
endpoint if iOS/Android refuses your LAN HTTP endpoint. Expo permits local networking on iOS.
Do not change the production Strava callback domain just to test a LAN address. Real local OAuth
also requires a callback URL registered with Strava; the easiest real-account path is the existing
HTTPS production server after its update.

Never put CLIENT_SECRET, Strava tokens or session signing/encryption keys in an EXPO_PUBLIC value.
These variables are compiled into the app. The default HTTPS backend requires no mobile `.env`.

## Android

Install Android Studio/SDK and start an emulator, or connect a phone with USB debugging:

```sh
cd mobile
npm ci --ignore-scripts
npx expo run:android --device
```

Android and iOS share the TypeScript application. Calendar export launches a user-confirmed system
editor; the app does not request calendar read/write access or read reminders. No calendar app,
a cancelled editor or denied access must not be reported as a successful save.
Native APK/AAB compilation and Release launch on an Android emulator were verified on 2026-11-10.
For a local backend over USB, use the documented `android:usb`/`start:usb` workflow; for Play
submission use `build:android:store` with your upload key. See [the distribution guide](mobile-distribution.md).

## TestFlight

The app includes `mobile/eas.json` development, preview, production and testing profiles. **No binary has
been uploaded and no App Store Connect app, signing certificate or Expo project has been created.**
The following steps are performed by the owner when ready to upload.

### Option A: Xcode on this Mac

1. Generate the project with `cd mobile && npx expo prebuild --platform ios`. Open
   `mobile/ios/ClubEvents.xcworkspace` after pods are installed by `npx expo run:ios`.
2. Select your Team and confirm `ws.valera.clubevents` is your intended registered bundle ID.
   Create the matching app in App Store Connect under your account.
3. Select a generic **Any iOS Device** destination, then **Product → Archive**. Archive embeds
   the Release JavaScript bundle, so Metro is not required for TestFlight users.
4. In Organizer select **Distribute App → App Store Connect → Upload** and complete signing.
5. In App Store Connect wait for processing, complete export-compliance questions accurately,
   then add internal testers. External testers may require Beta App Review and review access.
6. For each subsequent upload increase the build number. With generated native files, set
   `ios.buildNumber` in `app.config.js` and regenerate before archiving; do not rely on edits to
   an ignored Xcode project surviving regeneration.

### Option B: EAS

In `mobile/`, install/use EAS CLI from npm and sign into your Expo account:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

`build:configure` links/creates your Expo project and updates its configuration; review the diff.
Because this project uses `app.config.js`, EAS may ask you to add its generated `extra.eas.projectId`
and `owner` there manually; use the exact values it returns. These identifiers are not secrets.
Follow the prompts for your Apple team, registered app identifier and signing credentials. Configure
App Store Connect's app ID in the submission profile when prompted; do not invent it or commit
private signing material. EAS `production` uses remote build-number management and auto-increment.
For a build on this Mac instead of Expo's builder, add `--local` to the build command.

Upload sends a binary to App Store Connect/TestFlight; public release still requires a separate
App Review submission. Neither build method deploys the backend.
[Expo local development](https://docs.expo.dev/guides/local-app-development/),
[Expo iOS submission](https://docs.expo.dev/submit/ios/).

## Behavior to verify on devices

- Real sign-in, cancelled sign-in, return from Safari/system auth and session expiry.
- List, Month, Week and Day; Today/bounded navigation; simultaneous events; club/sport/joined filters.
- Refresh/pull-to-refresh, incomplete results and quota messages. The app refreshes about
  every 15 minutes in the foreground and retries the latest changed filters after a server
  cooldown. 'Last synced' records a successful backend response, which may come from cache.
- Cold restart in airplane mode: show the last successful snapshot immediately, mark it saved;
  retry after reconnecting. The snapshot expires after 24h and is limited to 2 MiB. Changing
  filters cannot pretend that a restricted saved subset includes other clubs. If the locally
  stored session deadline has passed, verify the session with the server before opening the
  calendar. A connection failure offers a retry and preserves the credential.
- Sign-out clears account snapshot/credential; a late request cannot repopulate the old snapshot.
  Network failure during logout may leave the server session until its normal expiry, and the
  client explains that revocation could not be confirmed. A durable sign-out marker also prevents
  restoration if Keychain deletion fails. If both marker storage and deletion fail, reconnecting
  is blocked until retrying local cleanup succeeds.
- Share opens the sheet without sending automatically. Calendar export opens the system editor;
  confirm/cancel there. The proposed one-hour duration is editable and explicitly a placeholder.
  Export is a single occurrence, not a subscription or a two-way synchronization.
- Dynamic Type/VoiceOver, safe areas, Android Back, long titles and narrow screens.

A TestFlight build is not a declaration of public-store readiness. Privacy/deletion policy, review
access, provider permission/branding and store metadata remain launch work. In particular, this
iteration supports session logout, not full account/data deletion or provider deauthorization.

## Checks and current evidence

```sh
# Repository root (builds web first)
npm test
# Disposable database ONLY
TEST_MONGODB_URI=mongodb://127.0.0.1:YOUR_TEST_PORT npm run test:mongodb
# Mobile directory
npm test
npm run typecheck
npm run export
```

Implementation/review verification on 2026-10-27: 166 default checks, 13 disposable MongoDB checks,
ten mobile auth/lifecycle tests (including durable sign-out, cancellation and stale-request fencing),
mobile TypeScript, iOS/Android Metro export, and an unsigned iOS Simulator Release build passed.
Both production Dockerfiles also built successfully, and the Alpine image served the mobile
capability endpoint on Node 24.21.0 with synthetic configuration and disposable MongoDB.
The simulator launched the welcome screen. Physical-device login, Share/calendar interactions,
TestFlight upload has not been verified here. Android native compilation and emulator launch
were subsequently verified on 2026-11-10; see [distribution verification](mobile-distribution.md).
See [independent review findings and fixes](reviews/mobile-independent-review.md) for reproductions
and the limits of the independent verification.

Dependency audit found an existing server `body-parser` high-severity advisory and mobile
Expo CLI toolchain advisories involving `node-forge`/`zod`. The latter are build tooling, not the
native event UI; npm's proposed automatic fix downgrades Expo across many SDK versions and was
not applied. Resolve/reassess these before a public release; no production dependency was
silently upgraded as part of mobile work. Mobile JSON auth bodies explicitly reject compression.
