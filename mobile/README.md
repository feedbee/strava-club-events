# Club Events mobile

Expo SDK 58 / React Native 0.88, iOS and Android. Uses the existing Express backend;
Strava secrets and provider tokens stay on that server.

See [the mobile guide](../docs/mobile.md) for iPhone installation, backend rollout and TestFlight.
See [Android and paired distribution](../docs/mobile-distribution.md) for USB-only Android testing,
locally signed AABs, Google Play Internal testing and TestFlight with the same hosted backend.
An Expo/EAS cloud account is optional.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run ios
```

The default API is `https://str.valera.ws`.
Actual sign-in requires the backend changes in this branch to be deployed there first.
For a local backend use a development build; Android supports `npm run android:usb` plus
`npm run start:usb` after installing the development client. Store builds require HTTPS.
