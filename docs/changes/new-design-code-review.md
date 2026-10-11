# Independent new-design code review

Date: 2026-10-11. Scope: design prototype, React/Vite implementation, mock backend, OAuth return
integration, and packaging introduced after `dedb4bc`. A separate read-only agent reviewed final
code and commit differences, reproduced failures, and then reviewed the corrections.

## Findings and corrections

| Priority | Finding | Correction | Regression evidence |
| --- | --- | --- | --- |
| P1 | Real events omit per-event club sport type; local sport filtering removed all results | Resolve sport types through the returned club catalog | Unit test with real DTO shape; browser sports filtering |
| P1 | Programmatic scroll overwrote the selected month, trapping Next navigation | Skip month synchronization only when programmatic positioning changes the scroll offset | Consecutive navigation and three-month-then-scroll tests, including a 500px-tall viewport |
| P1 | Both Docker build stages omitted the demo fixture imported by Vite | Copy the required fixture source into both frontend stages | Successful Debian and Alpine Docker builds |
| P2 | Every checkbox change immediately started provider work that browser abort cannot cancel | Debounce filter changes by 400ms; initial load and retry remain immediate | Rapid two-club toggle yields one final request |
| P2 | Invalid saved club IDs caused initial API errors without reset controls | Validate numeric IDs and expose filter reset on initial errors | Preference unit test; initial 400 followed by successful reset |
| Minor | Vite development proxy omitted the limits page used by warning links | Add `/limits.html` alongside other static-page proxies | Configuration reviewed |

## Verification

- `npm test`: 146 passing tests, no failures or skipped checks.
- `npm run build`: successful.
- Local Docker builds using both `Dockerfile` and `Dockerfile.build`: successful; no publication.
- `react-filter-requests-smoke.mjs`: real DTO sport filtering and batched provider queries.
- `react-review-smoke.mjs`: consecutive month navigation and saved-filter error recovery.
- Existing calendar, preferences, time/preview and all-scenario browser checks rerun after fixes.

The user confirmed actual Strava authorization works using `localhost:3000/next/`. The callback
host must match the host used to start login; `127.0.0.1` and `localhost` have different cookie
scopes. Existing primary routing remains unchanged. This report is review evidence, not a release.
