# Step 5: frontend dates and loading

Historical report: this describes the state at the end of step 5. See [audit progress](audit-progress.md) for the current implementation and remaining work.

The event list now groups entries by the browser's local calendar day, using the same timezone as the displayed time. Previously, the day key came from a UTC string: an event after local midnight could appear under the previous day's heading. Positive and negative UTC offsets and daylight saving transitions were checked.

Each event load receives a sequence number. Only the current load can store events, clubs and metadata, update the interface or remove the loading indicator. Stale results and errors are ignored; a stale 401 does not reopen login after a newer successful response. Requests continue running on the server: this mechanism protects frontend state but does not cancel network work.

Loading cleanup runs in finally for the current request on both success and failure. A failed filter request preserves the previous results, and the existing error handler displays the failure.

## Verification

- `npm test`: 60/60 pass, without skips. All three remaining regressions from the previous step are fixed.
- Additional checks: an older load cannot remove a newer load's indicator; a stale 401 cannot reopen login; network failure preserves events; local dates remain correct around midnight and DST transitions.
- Chrome with the Europe/Warsaw timezone and fixture API responses: month calendar, list, week view, local day heading, a 503 during club selection and loading overlay cleanup. No uncaught page errors. The 503 is intentionally simulated.
- Tests ran on installed Node.js 26.7.0. Live Strava was not used in this step.

Recurring events (the server currently selects the first matching occurrence) and distributed refresh-token coordination remain separate audit items at this point; this step does not change them.
