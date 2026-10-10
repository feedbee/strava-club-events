# Testing conventions

Install: `npm ci --ignore-scripts`. Default gate: `npm test` (106 checks at v0.9.0 preparation).
`npm run test:baseline` and `npm run test:regressions` are focused subsets.

The default suite covers pure rules, service scenarios with substituted Strava boundaries, real
loopback HTTP flows, encryption and frontend state/date behavior. It needs no Strava credentials
or database. Node VM modules may emit experimental warnings. Tests must be green, not intentionally failing.

For persistence, refresh coordination, quotas or storage changes, also run
`TEST_MONGODB_URI=<disposable URI> npm run test:mongodb` (10 checks).
These tests create/drop randomized databases; never use production MongoDB.
Browser smoke in `tests/integration/browser-smoke.mjs` is an explicit optional Playwright check;
see that script for prerequisites. Live Strava and real TLS proxy verification remain operator smoke tests.

There is no lint, type-check or compilation command. Build production packaging with
`docker build -f Dockerfile.build -t strava-club-events:check .` and also check `Dockerfile`.
CI runs the same default suite on Node 24, separately from tag-only image publication.
