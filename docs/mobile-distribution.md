# Android, USB development and paired test distribution

Preparation updated 2026-11-10. Both platforms use the same React Native application and Express
backend. Expo is the app framework; **Expo/EAS cloud accounts are optional**. The main route below
builds on this Mac and uploads manually through Google Play Console and Xcode Organizer.

## Choose the testing route

| Route | Android | iOS | Backend |
| --- | --- | --- | --- |
| Local development | USB debugging + `adb reverse` | Simulator; physical iPhone needs a reachable network address | Local Mac |
| Distributed testing | Google Play **Internal testing** | **TestFlight** | `https://str.valera.ws` by default |

A store-installed application cannot reach your Mac's `localhost` on another tester's phone.
For Android, USB forwarding can make device loopback reach your Mac while connected. On an iPhone,
USB installation does not itself provide a reverse tunnel to the Mac. Use the iOS Simulator for a
fully local loopback setup, or explicitly configure reachable HTTPS/LAN networking for the phone.
No changes to the production Strava callback registration are needed for the Android loopback
route below: Strava documents `localhost` and `127.0.0.1` callback exceptions.

Before testing real accounts, run this branch's backend locally or deploy its mobile routes once
to the shared server. Both apps use `/mobile/*`, the same callback scheme and the same API DTOs.
An unchanged older server will not support mobile login.

## Mobile runner

Run these commands from the repository root. Install root and mobile dependencies with
`npm ci --ignore-scripts` in each directory first.

```sh
npm run mobile -- --help
# Choose a local target. The runner starts the API if needed:
npm run mobile -- run ios simulator
npm run mobile -- run ios device
npm run mobile -- run android emulator
npm run mobile -- run android device

# Build for the stores, then upload separately:
npm run mobile -- build ios
npm run mobile -- build android
npm run mobile -- upload ios mobile/artifacts/ios/1/export/YourApp.ipa
npm run mobile -- upload android           # displays the manual Internal testing steps
```

Start the Android emulator from Device Manager first. When more than one eligible Android
target is connected, append its ADB serial to the command. For iOS, optionally append the
device name or UDID. Leave one Metro instance running at a time. If the development client
opens its launcher, open the Metro link printed by Expo.

The runner checks port 4317 and reuses a ready Club Events development backend with the
matching OAuth origin. If nothing is listening, it offers to start the backend, waits for it,
and stops that instance when Metro exits. Use `npm run mobile -- backend` to keep a separate
backend running in watch mode. If the port is occupied, set `MOBILE_LOCAL_API_PORT` in
`mobile/.env`. Android forwards that port and Metro's 8081 through ADB.

For a physical iPhone, USB installs the app. The iPhone reaches Metro over the local network.
Set `MOBILE_IOS_DEVICE_API_URL` in `mobile/.env` to the Mac's LAN IP and the selected
port, e.g. `http://192.168.1.50:4317`. The runner uses that origin for the backend callback.
If Strava rejects the LAN callback, use an HTTPS tunnel to port 4317 (or your configured port)
and register the tunnel hostname with Strava. Stop a separately running backend before switching
between LAN and loopback targets so that the next run can start it with the right origin.

Build numbers are reserved automatically and independently for iOS and Android in
`mobile/.local/build-numbers/`, which Git ignores. A failed build may leave a gap.
Keep this directory when moving to another Mac. If needed, use `--build-number N` once to
raise the counter above builds already uploaded from elsewhere.

Both store build commands force `https://str.valera.ws`. For iOS, sign in to Xcode,
set `MOBILE_IOS_TEAM_ID` in `mobile/.env` and register the bundle ID in App Store Connect.
The runner exports a signed IPA to `mobile/artifacts/ios/<build-number>/export/`.
To upload it from the terminal, set `APP_STORE_CONNECT_KEY_ID` and
`APP_STORE_CONNECT_ISSUER_ID` in `mobile/.env` and put the matching
`AuthKey_<key-id>.p8` under `~/.appstoreconnect/private_keys/`.
After Apple processes the upload, assign the build to your internal group in TestFlight.

## Android over USB, with a local backend

Use Node 24.21.0 (or the owner's permitted Node 26), Java 21 and Android Studio with its SDK installed.
Android Studio's bundled Java is suitable. If tools are not on PATH, `android:usb` discovers the
SDK through ANDROID_HOME/ANDROID_SDK_ROOT or the conventional Mac installation directory.

1. Enable Developer options and USB debugging on the Android phone. Connect it by USB, unlock it
   and authorize this Mac when Android asks. No Google Play/Expo account is needed for this route.
2. In the repository root `.env`, preserve the existing Strava credentials and configure:

   ```dotenv
   NODE_ENV=development
   HOST=0.0.0.0
   PORT=3000
   PUBLIC_URL=http://127.0.0.1:3000
   SESSION_SECURE_COOKIE=false
   ```

   Use a local disposable/development MongoDB if that configuration selects MongoDB. Do not point
   local tests at production. Memory sessions are supported in development.
3. Start the updated local backend from the repository root:

   ```sh
   npm ci --ignore-scripts
   npm run build
   npm run dev
   ```

4. Set `mobile/.env`:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
   ```

   Keep the literal hostname the same as backend PUBLIC_URL. Mixing localhost and 127.0.0.1 can
   break the OAuth browser cookie/state check despite both reaching the same machine.
5. From `mobile/`, install/build the development application without starting a LAN bundler:

   ```sh
   npm ci --ignore-scripts
   npx expo prebuild --platform android --no-install
   npx expo run:android --device --no-bundler
   npm run android:usb
   npm run start:usb
   ```

   The helper forwards phone ports 3000 and 8081 to the Mac through ADB. If more than one device is
   connected, select one explicitly: `npm run android:usb -- DEVICE_SERIAL` (list serials with
   Android Studio's Device Manager or `adb devices`). Repeat forwarding after reconnecting/rebooting.
   Open the development client on the phone; its Metro URL is `http://127.0.0.1:8081`. The Expo
   terminal also prints a development-client launch link. Keep both backend and Metro running.
6. The browser used by Strava also reaches the forwarded device loopback. The authorization
   callback returns through the local backend, which hands the session back to the native app.
   Test actual login, cancellation, refresh, process restart and logout on your account.

HTTP is allowed by the client only in development. Debug Android manifests permit cleartext for
local development; release/store builds require HTTPS. A cable alone without ADB forwarding is
not enough. The same helper also works with a single emulator when desired.

## Local signed Android bundle for Google Play

The Android package ID is **ws.valera.sportclubevents**. Confirm the
identifier before creating its Play Console entry; if a previous application with that package
already exists, use its existing upload key and increasing versionCode. Do not replace its key.

### Local upload key

The store build reads `mobile/.local/android.json`. Set `storeFile` (relative to the
JSON file or absolute), `storePassword`, `keyAlias` and `keyPassword`. For a passwordless
PKCS12 upload key, set both password fields to empty strings. Keep the JSON and keystore
in the Git-ignored `mobile/.local/` directory with file permissions `600`. Back up both
files and reuse the same upload key for updates.

In `mobile/.env`, set:

```dotenv
EXPO_PUBLIC_API_URL=https://str.valera.ws
MOBILE_ANDROID_VERSION_CODE=1
```

Use a version code greater than every previously uploaded build. PKCS12 normally uses the same
password for the store and private key.
If SDK discovery needs an override, also set ANDROID_HOME in this same `.env`.

```sh
cd mobile
npm ci --ignore-scripts
npm run build:android:store
```

The wrapper validates the HTTPS backend, versionCode, required signing fields and key file,
regenerates Android from managed config, and builds a signed Release AAB plus a matching APK.
If Gradle times out waiting for the journal cache, check the owner PID from the error.
On macOS, `lsof -a -p PID -d cwd` can show the daemon version under `~/.gradle/daemon/`.
Check its status with the matching Gradle version's `--status`. If the daemon is idle,
run `--stop` with that version, then retry the build.
Signing values are sent as Gradle environment properties, not command-line password arguments;
they are not EXPO_PUBLIC variables and are not embedded in the JavaScript bundle. Do not run
Gradle with verbose property/environment dumps when signing.

- Google Play artifact: `mobile/android/app/build/outputs/bundle/release/app-release.aab`.
- Direct-install artifact: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

An AAB cannot be installed directly with adb. An APK can be installed for a quick device check.
A local APK may have a different certificate from Google Play App Signing; switching between
those distributions may require uninstalling the old copy (which removes its local data).
The generated project's ordinary `assembleRelease` defaults to Expo's development signing key;
use the wrapper or Android Studio's **Generate Signed App Bundle / APK** with your real upload key
for store submission. Do not upload debug/verification artifacts from local smoke tests.

The user's mobile version remains sourced from root package.json. `MOBILE_ANDROID_VERSION_CODE`
controls only Android's internal build number; no server release/version publication is implied.

### Upload to Internal testing

1. Open Google Play Console. Create/select **Strava Club Events** with package `ws.valera.sportclubevents`. Keep the
   identifier consistent with the AAB; package IDs cannot be changed for an existing Play app.
2. Under **Test and release → Testing → Internal testing**, create a release and upload your AAB.
   Complete Play App Signing setup and the tasks currently required by your account/dashboard.
3. Add release notes describing the test build and shared backend. Review and start the internal
   release when Console permits. This publishes only to that testing track, not production.
4. Under the track's **Testers**, add the testers' Google-account email addresses and share the
   opt-in link. Testers must opt in with an authorized account before installing from Google Play.
5. For each update, increase MOBILE_ANDROID_VERSION_CODE, rebuild and create the next release.

Internal testing is Google's counterpart for this task. Keep provider athlete-capacity limits in
mind: a Play/TestFlight invitation does not grant additional Strava API access. Existing public
release/privacy/deletion limitations in `mobile.md` remain separate launch work.

## iOS TestFlight from this Mac

Use the same HTTPS EXPO_PUBLIC_API_URL in `mobile/.env`. Increment the iOS internal build number
independently of Android:

```dotenv
MOBILE_IOS_BUILD_NUMBER=1
```

Then:

```sh
cd mobile
npx expo prebuild --platform ios
```

Open `mobile/ios/ClubEvents.xcworkspace` in Xcode. Select the ClubEvents target, your Apple Team and
its signing configuration; create/select the matching App Store Connect application. Select
**Any iOS Device**, **Product → Archive**, then Organizer → **Distribute App → App Store Connect →
Upload**. After processing, add internal TestFlight testers; external testers may need Beta App
Review. Each upload needs a new MOBILE_IOS_BUILD_NUMBER and regeneration so the value reaches
the native project.

Before submitting to App Review or Google Play review, prepare a dedicated Strava review account
authorized for the deployed backend. Verify that it can sign in and has clubs with upcoming events.
Supply its access instructions through App Store Connect or Play Console and keep the backend
reachable for the duration of review.

The ignored `.env` may contain Android signing fields as well; only EXPO_PUBLIC_* values enter the
mobile JS bundle. No Android signing fields are referenced by the iOS app configuration.

Both platforms should display the same events for the same account. Verify sign-in on both,
filtering/timezones, offline recovery, calendar-editor cancellation, Share cancellation and that
logging out on one device does not sign out the other device's independent session.

## Optional cloud route with Expo/EAS

Skip this section if you prefer the local builds above. EAS is Expo's optional cloud build/signing/
upload service and requires a separate Expo account/project. No such account/project was created
or linked by this change.

After creating/linking your own Expo project and configuring Apple/Google signing credentials:

```sh
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform all --profile testing
npx eas-cli submit --platform ios --profile testing
npx eas-cli submit --platform android --profile testing
```

`testing` inherits the production store profile: iOS archive plus Android **AAB**, automatic remote
build-number increments and the explicit shared HTTPS backend `https://str.valera.ws`. This avoids
shipping an accidental local HTTP address from your development `.env`. Change that public URL in
the profile if the shared hosted backend changes. The Android submission profile selects `internal`.
Select the matching testing build at submission time; uploading is a separate operation.

For Google submission through EAS, configure a Google service account key with access to this Play
application; manual Console upload does not require that service account. EAS can handle a first
internal upload with the app entry and credentials set up, or you can upload manually as above.
The `preview` profile instead produces an Android APK for direct installation; it is not a Play
store artifact. TestFlight requires an App Store distribution archive, not the internal/ad-hoc
preview profile. Both local store uploads and EAS submissions leave public release separate.

## Evidence and references

Android native APK/AAB compilation, signing-wrapper verification, emulator launch and permissions
are checked during this task. Final results and limits are recorded in the completion note below.
Physical Android USB login, actual store signing with the owner's key and store uploads require
owner-device/account acceptance. No production backend changes are necessary beyond the mobile
routes already in this branch, and no production deployment is performed here.

- [Expo Android submission](https://docs.expo.dev/submit/android/)
- [Expo APK vs AAB](https://docs.expo.dev/build-reference/apk/)
- [Google Play internal testing](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Expo iOS submission](https://docs.expo.dev/submit/ios/)
- [Gradle environment properties](https://docs.gradle.org/current/userguide/build_environment.html)
- [Strava OAuth callback rules](https://developers.strava.com/docs/authentication/)

### Completion note, 2026-11-10

- Both native Android Release tasks (`assembleRelease`, `bundleRelease`) passed. The complete
  signing-wrapper build also passed for arm64-v8a, armeabi-v7a, x86 and x86_64.
- Verified the APK and AAB certificate against the explicitly supplied disposable verification
  key; it was not Expo's default debug certificate. No owner signing key was read or created.
- Package ws.valera.clubevents, versionName 1.0.0, verification versionCode 2, minimum Android API 24,
  target API 36. The APK's merged manifest has no calendar/contacts/storage/microphone/overlay
  permissions. It includes ordinary networking, vibration and SecureStore's library permissions.
- Installed and launched the final Release APK in a clean API 37 arm64 emulator. No AndroidRuntime
  or ReactNativeJS errors appeared during launch. USB reverse setup was exercised on that emulator.
- Root tests 166 passed; mobile tests 13 passed; TypeScript and iOS/Android Metro exports passed.
  An iOS Simulator Release build also passed after the shared native dependency/config changes.
- Physical-device OAuth, Back behavior, calendar/Share dialogs and real store account uploads
  remain acceptance checks. No app was uploaded to TestFlight/Google Play or deployed to production.
- Verification artifacts are explicitly test-signed and must not be uploaded to a store. Generate
  owner-signed artifacts with `build:android:store` before publishing an internal release.

The direct-install verification APK is saved locally at
`mobile/artifacts/android/clubevents-preview.apk` (ignored by Git). It uses a disposable test
certificate and the default hosted backend. It is useful for a preview, not for store upload.
The disposable private key was deleted after signature verification; build future owner/test-track
updates with your permanent upload key. The verification AAB was removed from the normal upload
path so it cannot be mistaken for an owner-signed store artifact.
