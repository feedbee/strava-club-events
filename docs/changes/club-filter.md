# Club Filter

*Date: 2026-03-15*

## 1. Overview

A Jira-style multi-select club picker added to the filter panel. Users can select up to 10 clubs at a time; when active, the calendar shows only events from those clubs.

This feature also serves as a practical workaround for users whose clubs exceed the `LIMIT_CLUBS` processing cap: by explicitly selecting clubs beyond position 25, their events are loaded on demand.

---

## 2. Backend

### 2.1 New limit constant

`LIMIT_CLUBS_FILTER = 10` is defined in `src/services/strava.service.js` alongside the other limit constants. It caps how many club IDs may be passed in a single filtered request. It is a functional constraint on the filter UI and is not exposed through `GET /limits` or the warning strip.

### 2.2 Modified `GET /events`

#### Query parameter

`clubs` (optional) — comma-separated list of club IDs, e.g. `?clubs=123,456,789`.

- Validated in the controller: non-numeric values and lists exceeding `LIMIT_CLUBS_FILTER` are rejected with `400 Bad Request`.
- When present, only events for the listed clubs are returned (regardless of their position in the user's club list — clubs beyond `LIMIT_CLUBS` are accessible this way).
- When absent, the existing behaviour applies: events for the first `LIMIT_CLUBS` clubs.

#### Response shape

The response now includes a top-level `clubs` array alongside `events` and `meta`:

```json
{
  "events": [...],
  "clubs": [
    { "id": "123", "name": "Club Name", "logo": "https://..." }
  ],
  "meta": { ... }
}
```

`clubs` contains **all** of the user's clubs (up to `LIMIT_CLUBS_FETCH`), not just those whose events were fetched. This lets the frontend populate the picker without a separate endpoint. Because `getUserClubs` results are cached, including `clubs` in every response is effectively free after the first call.

#### `club_info.id`

Each event now includes `club_info.id` (the club's numeric/string ID) so the frontend can associate events with picker selections even without re-fetching.

#### `meta` changes

`clubs_limited` is set to `false` when `filterClubIds` is provided (the user explicitly chose which clubs to load; they are not being cut off by the system limit).

---

## 3. Frontend

### 3.1 Filter state

`filterState` gains a `selectedClubs` field — an array of club ID strings:

```javascript
const DEFAULT_FILTER_STATE = {
  joinedOnly: false,
  selectedClubs: []   // new
};
```

`selectedClubs` is persisted in `localStorage` under the existing `stravaEventsFilterState` key. An array comparison guard in `applyFilterState` prevents the legacy `!==` check from treating two empty arrays as different.

`selectedClubs.length > 0` counts as 1 active filter in the badge counter.

### 3.2 Data loading

`getEvents()` builds the request URL from `filterState.selectedClubs`:

```
/events                      (no filter)
/events?clubs=123,456,789    (filter active)
```

`loadEvents()` extracts `clubs` from every response and stores it in the module-level `allClubs` array, which drives the picker. The club picker avatars are re-rendered at the end of `loadEvents()`.

Because `filterState` must be populated before the URL is built, `loadFilterState()` is called synchronously at the top of the init IIFE (before `await loadEvents()`), taking advantage of the fact that the script tag is at the bottom of `<body>` where all DOM elements are already available.

When `selectedClubs` changes, `loadEvents()` is called for a full re-fetch (the backend's per-club cache makes this fast for clubs whose events were already fetched). When only `joinedOnly` changes, the existing `updateCalendarWithFilteredEvents()` re-filters in-memory without a server round-trip.

When "Clear filters" is clicked and a club filter was active, `loadEvents()` is called to restore the full first-25-clubs view. If only `joinedOnly` was set, `updateCalendarWithFilteredEvents()` is called instead.

### 3.3 Club picker UI

A new `filter-group-clubs` row is added inside `#event-filters`, after the joined toggle:

```
[ label: "Clubs" ]  [ trigger: avatar row / "All clubs" ]
                    ┌────────────────────────────────────┐
                    │ 🔍 Search clubs…                   │
                    ├────────────────────────────────────┤
                    │ ☑ [logo] Club Alpha                │  ← selected, sorted first
                    │ ☑ [logo] Club Beta                 │
                    │ ☐ [logo] Club Gamma                │
                    │ ☐ [logo] Club Delta  (disabled)    │  ← when limit reached
                    ├────────────────────────────────────┤
                    │ 3 of 10 selected                   │
                    └────────────────────────────────────┘
```

The trigger shows up to 5 circular club avatars (with a `+N` overflow label). Clubs without a logo use a coloured initial-letter circle.

The dropdown:
- Opens on trigger click; closes on outside click or `Escape`.
- Search filters the list in real time.
- Selected clubs are sorted to the top.
- Checkboxes for unselected clubs are disabled once 10 are selected.
- Footer shows "N of 10 selected".

### 3.4 Stats and warning strip

When `selectedClubs.length > 0`:

- Stats text shows `"X events · N selected club(s)"` instead of the total-clubs text.
- The "Showing events from N of M clubs. Use the club filter…" warning is suppressed (the user is already using the filter).
- `clubs_fetch_limited` and other limit warnings are unaffected.

The clubs-limit warning message is updated from *"A per-club filter is coming — use it to focus on specific clubs."* to *"Use the club filter to focus on specific clubs."* now that the feature exists.

---

## 4. Files changed

| File | Change |
|------|--------|
| `src/services/strava.service.js` | `LIMIT_CLUBS_FILTER` constant; `club_info.id`; `getAllUserClubsEvents` accepts `{ filterClubIds }` and returns `clubs` array |
| `src/controllers/events.controller.js` | Parse and validate `?clubs` query param; pass `filterClubIds` to service |
| `public/index.html` | Club picker markup inside `#event-filters` |
| `public/index.js` | `allClubs` global; `CLUB_FILTER_LIMIT`; extended filter state; updated `getEvents`/`loadEvents`; club picker functions; updated `displayEventsMeta` and filter utilities |
| `public/styles.css` | Club picker component styles |
