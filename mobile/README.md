# Club Events mobile

Expo SDK 58 / React Native 0.88, iOS and Android. Uses the existing Express backend;
Strava secrets and provider tokens stay on that server.

See [the mobile guide](../docs/mobile.md) for iPhone installation, backend rollout and TestFlight.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run ios
```

The default API is `https://str.valera.ws`. Explore the demo without deploying anything.
Actual sign-in requires the backend changes in this branch to be deployed there first.
