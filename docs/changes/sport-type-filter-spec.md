# Sport Type Filter — Feature Specification

*Added: 2026-03-21*

---

## 1. Overview

Strava clubs expose a **Sport** attribute (e.g., Cycling, Running, Triathlon) visible both in the Strava UI and in the API response for `GET /api/v3/athlete/clubs` via the `sport_type` and `localized_sport_type` fields. This feature adds a sport type filter to the Events Calendar so users can:

- Filter events **across all their clubs** by sport category (e.g., show only events from Cycling clubs)
- Combine the sport type filter **with** the existing individual-club filter using **AND logic**
- Persist their sport type selection in localStorage alongside other filter state

No new Strava API calls are required — the `sport_type` data is already present in cached club objects.

---

## 2. API Changes

### 2.1 `GET /events` — Updated Query Parameters

| Parameter    | Type                      | Required | Default   | Notes |
|--------------|---------------------------|----------|-----------|-------|
| `clubs`      | comma-separated IDs       | No       | all clubs | Unchanged — filters by specific club IDs |
| `sportTypes` | comma-separated strings   | No       | all types | **New** — filters by club `sport_type` |

**Example requests:**
```
GET /events
GET /events?clubs=12345,67890
GET /events?sportTypes=cycling
GET /events?sportTypes=cycling,running
GET /events?clubs=12345&sportTypes=cycling
```

### 2.2 Filtering Behaviour Contract

| `clubs` param | `sportTypes` param | Clubs processed for event fetching |
|---|---|---|
| absent | absent | First `LIMIT_CLUBS` (25) clubs — default cap |
| present | absent | Clubs matching the given IDs |
| absent | present | All clubs whose `sport_type` matches any value in the set |
| present | present | **AND logic**: clubs matching both the given IDs AND the given sport types |

The AND combination means that when both filters are active, a club must satisfy **both** conditions to have its events fetched. This allows the sport type filter to refine an individual club selection (or vice versa).

### 2.3 `sportTypes` Parameter Validation

- Values are split on `,`, trimmed, and lowercased before comparison
- Matched case-insensitively against `club.sport_type` (which Strava returns in lowercase)
- No explicit count cap — the set of Strava sport types is small and bounded by Strava's own enum
- Empty strings after trim are silently dropped
- Unknown / unrecognised sport type values produce zero matched clubs (graceful degradation — no 400 error)
- The `clubs_limited` meta flag is set to `false` whenever either filter is active

---

## 3. Updated Club Object Shape

The `clubs` array in the `/events` response is extended with two new fields:

```json
{
  "clubs": [
    {
      "id": "12345",
      "name": "Bay Area Cyclists",
      "logo": "https://dgalywyr863hv.cloudfront.net/pictures/clubs/12345/...",
      "sport_type": "cycling",
      "localized_sport_type": "Cycling"
    },
    {
      "id": "67890",
      "name": "Sunday Trail Runners",
      "logo": "https://dgalywyr863hv.cloudfront.net/pictures/clubs/67890/...",
      "sport_type": "running",
      "localized_sport_type": "Running"
    }
  ]
}
```

| Field                  | Source                            | Notes |
|------------------------|-----------------------------------|-------|
| `sport_type`           | `club.sport_type` from Strava API | Lowercase string, e.g. `"cycling"` |
| `localized_sport_type` | `club.localized_sport_type`       | Human-readable, e.g. `"Cycling"`. Falls back to `sport_type` if absent |

Both fields return `""` (empty string) if the Strava API does not provide them for a club.

---

## 4. Frontend Behaviour

### 4.1 Filter State

```js
const DEFAULT_FILTER_STATE = {
  joinedOnly: false,
  selectedClubs: [],
  selectedSportTypes: []   // new — array of sport_type strings e.g. ["cycling"]
};
```

State is persisted to `localStorage` under the key `stravaEventsFilterState`, matching existing behaviour.

### 4.2 Sport Type Pill UI

- Rendered as a horizontal row of **pill/chip buttons** between the "Show only joined events" toggle and the Clubs dropdown
- Available pills are derived **dynamically** from the `allClubs` array after each `loadEvents()` response — not hardcoded
- Pills are labelled using `localized_sport_type` (human-readable) and keyed by `sport_type` (lowercase)
- Pills are sorted alphabetically by label
- **Multi-select**: multiple sport types can be active simultaneously (OR within sport types, AND with club filter)
- Active pill: filled purple (`#667eea`), matching existing primary colour
- The sport type filter group is **hidden** (`display: none`) until club data is loaded, to avoid an empty label on first paint
- When a user has clubs of only one sport type, only one pill is shown (the filter still works, but is less useful — it is shown regardless)

### 4.3 Filter Combination Semantics

```
selected sport types = [A, B]   →  clubs where sport_type ∈ {A, B}
selected clubs       = [X, Y]   →  clubs where id ∈ {X, Y}

both active          →  clubs where sport_type ∈ {A, B}  AND  id ∈ {X, Y}
```

Within sport types the logic is OR (any matching sport type is included). Between sport types and club IDs the logic is AND (both must match).

### 4.4 Active Filter Count

The filter count badge increments by 1 when `selectedSportTypes.length > 0` (regardless of how many types are selected), consistent with how `selectedClubs` is counted.

### 4.5 Clear Filters

The global **Clear filters** button resets `selectedSportTypes` to `[]` in addition to existing resets. If sport types were the only active backend filter, a full `loadEvents()` reload is triggered (same logic as when clearing `selectedClubs`).

### 4.6 localStorage Persistence

`selectedSportTypes` is saved and restored automatically via the existing `saveFilterState` / `loadFilterState` / `applyFilterState` machinery. Pills are re-rendered with active state after the first `loadEvents()` completes and club data is available.

---

## 5. Implementation Files

| File | Change |
|---|---|
| `src/services/strava.service.js` | Add `sport_type` + `localized_sport_type` to clubs map; add `filterSportTypes` param and AND logic to `getAllUserClubsEvents()` |
| `src/controllers/events.controller.js` | Parse `?sportTypes=` query param; pass `filterSportTypes` to service |
| `public/index.js` | `createMultiSelectFilter` factory shared by both filters; `clubFilter` and `sportTypeFilter` instances; `SPORT_TYPE_LABELS` map; refactored `setupFilterEventListeners()` |
| `public/index.html` | `filter-group-sport-type` div with full dropdown structure (same as clubs) |
| `public/styles.css` | `.club-filter-chip` / `.club-filter-chip-more` for text chips in sport type trigger |

---

## 6. UI Design

The sport type filter uses the **same dropdown with checkboxes** design as the club filter:

- **Trigger**: shows selected sport types as text chips (e.g. `Cycling`, `Running`); overflow shown as `+N`
- **Dropdown**: searchable checkbox list, alphabetically sorted, up to 10 selections, with footer count
- **Behaviour**: identical to the club filter — opens on click, closes on outside click or Escape, mutual exclusion (opening one closes the other)
- **Empty state**: the entire filter group is hidden when the user has no clubs with a `sport_type` value

---

## 7. Known Sport Type Values (Strava Enum)

The following `sport_type` values are defined in the Strava club edit UI. The `SPORT_TYPE_LABELS` map in `public/index.js` covers all of them. Available options in the filter are derived from the user's actual clubs — only sport types present in their clubs appear.

| `sport_type`          | Display label          |
|-----------------------|------------------------|
| `cycling`             | Cycling                |
| `running`             | Running                |
| `triathlon`           | Triathlon              |
| `alpine_skiing`       | Alpine Skiing          |
| `backcountry_skiing`  | Backcountry Skiing     |
| `canoeing`            | Canoeing               |
| `crossfit`            | Crossfit               |
| `ebiking`             | E-Biking               |
| `elliptical`          | Elliptical             |
| `soccer`              | Football (Soccer)      |
| `golf`                | Golf                   |
| `handcycling`         | Handcycling            |
| `hiking`              | Hiking                 |
| `ice_skating`         | Ice Skating            |
| `inline_skating`      | Inline Skating         |
| `kayaking`            | Kayaking               |
| `kitesurfing`         | Kitesurfing            |
| `nordic_skiing`       | Nordic Skiing          |
| `rock_climbing`       | Rock Climbing          |
| `roller_skiing`       | Roller Skiing          |
| `rowing`              | Rowing                 |
| `footsports`          | Run/Walk/Hike          |
| `sailing`             | Sailing                |
| `skateboarding`       | Skateboarding          |
| `ski_snowboard`       | Ski/Snowboard          |
| `snowboarding`        | Snowboarding           |
| `snowshoeing`         | Snowshoeing            |
| `stair_stepper`       | Stair Stepper          |
| `stand_up_paddling`   | Stand-up Paddling      |
| `surfing`             | Surfing                |
| `swimming`            | Swimming               |
| `velomobile`          | Velomobile             |
| `virtual_ride`        | Virtual Riding         |
| `virtual_run`         | Virtual Running        |
| `walking`             | Walking                |
| `weight_training`     | Weight Training        |
| `wheelchair`          | Wheelchair             |
| `windsurfing`         | Windsurfing            |
| `winter_sports`       | Winter Sports          |
| `workout`             | Workout                |
| `yoga`                | Yoga                   |
| `other`               | Multisport             |
