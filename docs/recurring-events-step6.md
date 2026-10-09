# Step 6: recurring events

Historical report: this describes the state at the end of step 6. See [audit progress](audit-progress.md) for the current implementation and remaining work.

Previously, the server selected the first matching value from `upcoming_occurrences`. Each unique occurrence within the next 30 × 24 hours now becomes a separate response entry. Both interval boundaries are inclusive; dates are sorted, and identical instants are deduplicated even when expressed with different timezone offsets. Invalid values and past dates are excluded. Every club in a request shares one interval start time.

The original `id`, Strava link, participation flag and club data are preserved. The new `occurrence_id` combines the club, original event and occurrence's UTC date; FullCalendar uses it to distinguish repetitions. Route enrichment runs once per original event. The list already displays each entry separately and groups it by local day.

`meta.events_total` counts occurrences, while `rawCount` and the cap of 100 original events per club retain their previous meaning. The application does not generate a schedule itself: only dates provided by Strava are displayed. Complete occurrence data beyond Strava's response is not guaranteed.

Verification:

- Reproduced the missing second occurrence before fixing it.
- Recurring event: two sorted occurrences, unique IDs, preserved attributes and link, one route request.
- Interval boundaries, duplicates with different offsets, invalid and empty dates, and no route request for events outside the interval.
- `npm test`: 64/64 pass on Node.js 26.7.0 and target Node.js 24.21.0 in a container without external network access.
- Real Chrome: two occurrences of one event appear in month and list views; week view works; no uncaught page errors. Fixture API responses were used; live Strava was not called.
