# Runtime and dependency migration — step 3 (2026-10-09)

Historical report: this describes the state at the end of this step. See [audit progress](audit-progress.md) for the current implementation and remaining work.

## Result

The complete npm dependency tree now has **0 reported vulnerabilities** (previously 12; six production). This does not certify application security: four known behavior regressions remain active and fail in the full test command.

| Component | Previous installed version | New version |
|---|---|---|
| Node container runtime | 18 | 24.21.0 LTS |
| Express | 4.21.2 | 5.2.1 |
| express-session | 1.18.2 | 1.19.0 |
| connect-mongo | 5.1.0 | 6.0.0 |
| MongoDB Node driver | 6.19.0 | 7.7.0 |
| node-fetch | 3.3.2 | 3.3.2 (already current) |
| nodemon | 3.1.10 | Removed; `node --watch` replaces it |
| FullCalendar CDN | 6.1.8 | 6.1.21, with SHA-384 SRI |

Node 24 is the active LTS branch on this date: [official release schedule](https://github.com/nodejs/Release). `.nvmrc`, package engines and all Dockerfiles now agree on Node 24. FullCalendar 7.1.1 is available but involves API/CSS migration; that major change is deliberately separate. The obsolete FullCalendar CSS URL was removed: [v6 injects its own CSS](https://legacy.fullcalendar.io/v6/upgrading-from-v5).

Direct versions were explicitly updated, then compatible transitive dependencies refreshed without `npm audit fix --force`. This includes proxy-addr 2.0.8 and qs 6.16.0. Removing nodemon eliminated its vulnerable watcher/glob chain; no overrides force incompatible transitive major versions.

## Compatibility changes

[Express 5](https://expressjs.com/en/guide/migrating-5/) uses a simple query parser by default, makes req.query a getter and handles rejected async handlers. This app does not assign req.query or use the removed route patterns; current HTTP tests pass, including rejection of duplicate OAuth state. Existing repeated club/sport parameter validation needs separate hardening and has not been declared fixed here.

[MongoDB driver 7](https://raw.githubusercontent.com/mongodb/node-mongodb-native/main/etc/notes/CHANGES_7.0.0.md) removes useNewUrlParser/useUnifiedTopology, so the cache constructor no longer passes them. This application does not use deprecated BSON constructors, legacy authentication, change streams, GridFS or client-side Mongo encryption. connect-mongo 6 imports correctly as the existing default export and shares the installed MongoDB driver through its peer dependency. A driver update does not update the MongoDB server; verify the actual production cluster compatibility before deployment.

Production images now use `npm ci --omit=dev --ignore-scripts`, explicit source/static copies, `NODE_ENV=production` and the existing non-root node user. Tests, development tools, environment files and source-control metadata are not copied into production images. Debian and Alpine variants remain separately buildable. The devcontainer uses Node 24, reproducible npm installation and a valid apt update/install sequence.

Docker Compose has a dedicated node_modules volume so the source bind mount does not hide image dependencies. After changing dependency versions again, rebuild and refresh that volume's contents, for example `docker compose exec -u root strava-app npm ci --omit=dev --ignore-scripts`. No existing Compose stack was started, stopped or migrated during this task.

Production now defaults NODE_ENV to production in the images. Configure the required HTTPS/MongoDB/secret settings from [step 2](security-step2.md) before deployment. For local HTTP use an explicit NODE_ENV=development. The host's global Node/npm were not changed; run `nvm use` to select the repository's pinned Node.

## Verification

- `npm audit`: zero vulnerabilities for the full installed tree; production-only audit checked separately.
- Debian and Alpine production Docker builds and the development container build succeed locally on linux/arm64. amd64/multi-architecture publishing was not performed.
- Full tests on Node 24.21.0 using dependencies installed inside each production image: 46 pass, four known later-step regressions fail, zero skips/TODOs. Additional host run on Node 26.7.0 gives the same result; Node 24 remains the supported project runtime.
- Two additional MongoDB integration checks pass on Node 24 against real MongoDB 8: cache keys/expiry/indexes/user isolation, encrypted persistence through OAuth rotation/reload/logout. Integration was also verified from Alpine.
- Browser smoke in installed Chrome: FullCalendar 6.1.21 loads with SRI, month/list/week render and switch successfully, zero uncaught page errors. Only synthetic profile/events were used; live Strava authorization was not exercised.
- npm install scripts were disabled. The lock file resolves cleanly in the container builds.

A cached MongoDB 8 image initially refused to start on Docker Desktop's newer Linux kernel. Pulling the current mongo:8.0 image resolved the test-environment issue; no host settings or production database were changed. Temporary test databases are randomized and removed; the test MongoDB container is removed afterward.

## Repeat the checks

```sh
nvm use
npm ci --ignore-scripts
npm audit
npm run test:baseline
npm test  # still exits 1 for the four known defects
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:mongodb
```

MongoDB integration requires a disposable test server; tests create/drop randomly named strava_audit_* databases. The optional `tests/integration/browser-smoke.mjs` uses an existing Playwright installation (set PLAYWRIGHT_MODULE to its module path when outside this repository) and CHROME_EXECUTABLE if using installed Chrome. It does not add Playwright to production dependencies:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chrome \
  node --experimental-vm-modules tests/integration/browser-smoke.mjs
```

No release image was pushed and no deployment was performed. The next planned work is Strava API and cache reliability: timeouts, concurrency/deduplication, refresh coordination, explicit partial failures, readiness/shutdown and cache isolation/bounds.
