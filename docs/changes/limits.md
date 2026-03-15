# Limits & Transparency

*Date: 2026-03-15*

## 1. Overview

The application applies limits when fetching data from the Strava API to ensure a responsive user experience and stay within Strava API rate limits. All active limits are communicated to the user through a stats summary in the navigation bar and a contextual warning strip, with a link to a dedicated page that explains all limits in plain language.

---

## 2. Limits

All four limits are defined as named constants at the top of `src/services/strava.service.js` and are the single source of truth across the entire application — backend logic, API responses, and the frontend all read from these values rather than duplicating them.

| Constant | Description |
|----------|-------------|
| `LIMIT_CLUBS` | Maximum number of clubs whose events are processed |
| `LIMIT_CLUBS_FETCH` | Maximum clubs fetched from Strava in a single request; determines total membership count |
| `LIMIT_EVENTS` | Maximum upcoming events fetched per club |
| `LIMIT_ROUTES` | Maximum route detail API requests made per page load, shared across all clubs |

---

## 3. Data Fetching

### 3.1 Clubs

`getUserClubs` fetches up to `LIMIT_CLUBS_FETCH` (200) clubs from the Strava API in a single request (`per_page=200`). This gives an exact count of all clubs the user belongs to (up to the fetch cap).

`getAllUserClubsEvents` slices the full list to `LIMIT_CLUBS` before processing events:

```javascript
const allClubs = await getUserClubs(accessToken, userId); // up to LIMIT_CLUBS_FETCH
const clubsToProcess = allClubs.slice(0, LIMIT_CLUBS);
```

This means `clubs_total` always reflects the true membership count, while `clubs_processed` reflects how many were actually used to produce events.

Users with `clubs_total >= LIMIT_CLUBS_FETCH` are flagged as unsupported (their true club count cannot be determined).

### 3.2 Events per Club

`fetchRawClubEvents` requests up to `LIMIT_EVENTS` upcoming events per club (`per_page=LIMIT_EVENTS`). The raw response length is preserved and returned by `getClubEvents` as `rawCount`. If `rawCount >= LIMIT_EVENTS` for any club, the `events_limited` flag is set, indicating that club may have had more events than were fetched.

Events are then filtered to the next 30 days via `prepareEvent` before being included in the response.

### 3.3 Route Details

Route details require a separate Strava API call per event. A shared counter tracks requests across all clubs:

```javascript
let routeRequestCount = 0;
let routesSkipped = 0;
const shouldFetchRoute = () => {
  if (routeRequestCount >= LIMIT_ROUTES) {
    routesSkipped++;
    return false;
  }
  routeRequestCount++;
  return true;
};
```

The `shouldFetchRoute` function is passed through `getClubEvents` → `prepareEvent` → `getRouteDetails`. Cache hits are not counted against the limit — only actual API requests. Events whose routes are skipped due to the limit fall back to basic route info (name and fields available from the event data itself).

---

## 4. Metadata

`getAllUserClubsEvents` returns `{ events, meta }`. The `meta` object is included in the `GET /events` response and consumed by the frontend to render stats and warnings.

```typescript
interface Meta {
  clubs_total: number;         // exact count of clubs the user belongs to (up to LIMIT_CLUBS_FETCH)
  clubs_processed: number;     // clubs actually processed for events (≤ LIMIT_CLUBS)
  clubs_limited: boolean;      // true when clubs_total > LIMIT_CLUBS
  clubs_fetch_limited: boolean;// true when clubs_total >= LIMIT_CLUBS_FETCH (unsupported)
  events_total: number;        // events returned after 30-day filter, across all processed clubs
  events_limited: boolean;     // true when any club returned rawCount >= LIMIT_EVENTS
  routes_fetched: number;      // actual Strava route API requests made
  routes_skipped: number;      // route fetches skipped due to LIMIT_ROUTES
  limits: {
    clubs: number;             // current LIMIT_CLUBS value
    clubs_fetch: number;       // current LIMIT_CLUBS_FETCH value
    events_per_club: number;   // current LIMIT_EVENTS value
    routes: number;            // current LIMIT_ROUTES value
  };
}
```

The nested `limits` object lets the frontend display the actual configured values in warning messages without duplicating backend constants.

---

## 5. API

### 5.1 `GET /events`

- **Authentication**: required
- **Response**: `{ events: Array<Event>, meta: Meta }`

The frontend includes a backward-compatibility shim: if the response is a plain array (legacy), it is wrapped as `{ events: data, meta: null }`.

### 5.2 `GET /limits`

- **Authentication**: none required
- **Description**: Returns the current configured limit values. Used by the `/limits.html` page to populate its content dynamically without requiring the user to be logged in.
- **Response**:

```json
{
  "clubs": 25,
  "clubs_fetch": 200,
  "events_per_club": 100,
  "routes": 20
}
```

Implemented in `src/controllers/limits.controller.js`, routed via `src/routes/events.routes.js`.

---

## 6. Frontend

### 6.1 Stats (`#events-stats`)

A `<span id="events-stats">` in the navigation bar's left side always shows a summary after events load. It reflects the currently **visible** (filtered) event count so the number stays accurate when filters are applied.

| Condition | Display |
|-----------|---------|
| No clubs limit | `47 events · 5 clubs` |
| Clubs limited | `47 events · 10 of 15 clubs` |
| Single event/club | Singular forms used: `1 event · 1 club` |

### 6.2 Warning Strip (`#limits-warning`)

A `<div id="limits-warning">` sits between the navigation bar and the filter box. It is hidden (`display: none`) when no limits are active, and shown only when at least one limit condition is true. This keeps the UI uncluttered for typical users.

The strip renders a ⚠ icon on the left and a column of messages on the right. Warning messages are generated per condition:

| Condition | Message |
|-----------|---------|
| `clubs_fetch_limited` | `Only the first 200 clubs are loaded. Users with more than 200 clubs are not fully supported.` |
| `clubs_limited` (not fetch-limited) | `Showing events from N of M clubs. A per-club filter is coming — use it to focus on specific clubs.` |
| `events_limited` | `Some clubs may have more than N upcoming events — only the first N per club are shown.` |
| `routes_skipped > 0` | `Route details unavailable for N event(s) (API limit reached).` |

A **"Learn more →"** link to `/limits.html` (opens in a new tab) is appended inline at the end of the last warning message.

`clubs_fetch_limited` takes priority over `clubs_limited`: if the fetch cap is hit, only the fetch cap message is shown (the clubs limit is implied).

The warning strip and stats are both updated when filters change, via `displayEventsMeta(eventsMeta, filteredEvents.length)` called from `updateCalendarWithFilteredEvents`.

### 6.3 `displayEventsMeta(meta, visibleEventCount)`

Central function responsible for rendering both the stats text and the warning strip. Called after initial load and after every filter change.

---

## 7. Limits Page (`/limits.html`)

A static page that explains all limits to the user in plain language. It is accessible without authentication (intentionally, since it is linked from the warning strip which may be the first thing a new user sees).

The page is **dynamic**: on load it fetches `GET /limits` and populates `<strong id="limit-*">` placeholder elements with the actual configured values. Placeholders display `…` while loading and remain as `…` on fetch error (graceful degradation — the text remains readable without the numbers).

Sections:
- **Clubs** — `LIMIT_CLUBS_FETCH` total fetched; `LIMIT_CLUBS` processed; upcoming per-club filter mentioned
- **Events per Club** — `LIMIT_EVENTS` cap per club
- **Route Details** — `LIMIT_ROUTES` API requests per load; caching noted (cached routes are exempt from the limit on subsequent loads)

---

## 8. CSS

| Selector | Purpose |
|----------|---------|
| `.events-stats` | Small, muted white text in the nav bar |
| `.limits-warning` | Amber card (`flex-direction: row`); icon and messages sit side by side |
| `.limits-warning-icon` | `flex-shrink: 0` — the ⚠ icon never wraps |
| `.limits-warning-messages` | `flex-direction: column` — stacks multiple warning lines vertically |
| `.limits-learn-more` | Inline link in the same amber tone; `white-space: nowrap` keeps it on one line with the last message |
