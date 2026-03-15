# Strava API Model Coverage

*Based on real API responses in `docs/examples/`. Last reviewed: March 2026.*

This document maps every field returned by the Strava API against what the app
currently reads, processes, or exposes to the frontend — and what it ignores.

---

## How the app fetches each resource

| Resource | Endpoint | State returned | Notes |
|----------|----------|---------------|-------|
| Clubs list | `GET /athlete/clubs` | **2** | Up to 200 clubs; top 25 processed |
| Club events list | `GET /clubs/{id}/group_events` | **2** | Up to 100 per club |
| Route details | `GET /routes/{id}` | **3** | Max 20 fetches across all events |
| Club details | `GET /clubs/{id}` | **3** | **Never fetched** by the app |
| Single event | `GET /group_events/{id}` | **3** | **Never fetched** by the app |

The app never fetches state-3 events or state-3 clubs directly. All events arrive as
state-2 from the list endpoint, with routes embedded at state-1.

---

## Event (Group Event)

Source: `docs/examples/event-*-state-2-example.json` and `event-*-state-3-example.json`.

### State 2 — from `GET /clubs/{id}/group_events` *(what the app actually receives)*

| Field | Type | App usage |
|-------|------|-----------|
| `id` | string | ✅ Used — builds `strava_event_url` |
| `resource_state` | number (2) | — Passed through |
| `title` | string | — Passed through to frontend |
| `description` | string | — Passed through to frontend |
| `club_id` | number | — Passed through (redundant; `club.id` used instead) |
| `club` | object (state 1) | ⚠️ Only `club.name` used for `club_info.name`; see Club section |
| `organizing_athlete` | object (state 2) | — Passed through; not used by the app |
| `activity_type` | string | ✅ Used — fallback `route_info.activity_type` when route fetch fails |
| `created_at` | string | — Passed through; always `""` in real responses |
| `route_id` | number | ⚠️ **Precision loss** — large ID overflows JS float; ignored in favour of `route.id` |
| `route` | object (state 1) | ⚠️ Only `route.id` (string) and `route.name` used; see Route section |
| `women_only` | boolean | — Passed through; not used |
| `private` | boolean | — Passed through; not used |
| `skill_levels` | number \| null | ✅ Used — `skill_level_label` (`1`=Casual, `2`=Tempo, `4`=Race Pace). Returns `null` when the event uses Pace Groups instead |
| `terrain` | number \| null | ✅ Used — `terrain_label` (`0`=Flat, `1`=Rolling, `2`=Killer Climbs) |
| `upcoming_occurrences` | string[] | ✅ Used — selects next occurrence within 30 days → `start_date` |
| `zone` | string | — Passed through; timezone not applied when formatting `start_date` |
| `address` | string \| null | ✅ Used — passed through to frontend |
| `joined` | boolean | — Passed through; not used by the app (frontend filtering possible) |
| `start_latlng` | [lat, lng] \| null | — Passed through; not used |

**Computed fields added by the app** (not from API):

| Field | Source |
|-------|--------|
| `start_date` | First upcoming occurrence within 30 days, as ISO string |
| `strava_event_url` | `https://www.strava.com/clubs/{club.id}/group_events/{event.id}` |
| `club_info.name` | `club.name` — from the **clubs-list** object (state 2), not `event.club` |
| `club_info.logo` | `club.profile_medium` — from the **clubs-list** object (state 2), not `event.club` |
| `terrain_label` | Decoded from `terrain` |
| `skill_level_label` | Decoded from `skill_levels` |
| `route_info` | Built from route state-3 fetch, or fallback from embedded state-1 route |

> **Note.** `prepareEvent(event, club, ...)` receives `club` as a dedicated parameter
> sourced from `GET /athlete/clubs` (state 2), separate from the `event.club` state-1
> embed. `profile_medium` is absent on the state-1 embed but always present on the
> state-2 clubs-list object, so `club_info.logo` is correctly populated.

### Fields present in the edit UI but absent from the API entirely

Confirmed by inspecting a real event that has all of these configured — neither state 2
nor state 3 returns them:

| Edit form field | Notes |
|----------------|-------|
| **Pace Groups** (A/B/C speed ranges) | A newer, richer alternative to `skill_levels`. When an event uses Pace Groups, `skill_levels` returns `null`. The group definitions are not exposed via the API. |
| **Distance** (event-level) | Separate from the route's distance. Not returned at any state. |
| **Surface** (Road / Gravel / etc.) | Not returned at any state. |
| **Capacity limit** | Not returned at any state. |

### State 3 — from `GET /group_events/{id}` *(never fetched by the app)*

These fields exist only on directly-fetched events and are never seen:

| Field | Type | Potential use |
|-------|------|---------------|
| `viewer_permissions.edit` | boolean | Could expose edit link in UI |
| `start_datetime` | string (`"2026-03-19T09:00"`) | Local-time template for the recurring slot; complements `upcoming_occurrences` |
| `frequency` | string (`"weekly"`) | Recurrence pattern |
| `days_of_week` | string[] (`["tuesday"]`) | Which days the event repeats |
| `weekly_interval` | number | Every N weeks |

> `start_datetime` is the canonical local time for the recurring slot (e.g. "every
> Tuesday at 09:00"). `upcoming_occurrences` in state 2 contains the actual UTC
> datetimes of future instances. The two are consistent but serve different purposes.

---

## Route

Source: `docs/examples/route-*-state-1-example.json` and `route-*-state-3-example.json`.

### State 1 — embedded inside an event *(from the events list)*

| Field | App usage |
|-------|-----------|
| `id` (string, via `parseJsonWithStringIds`) | ✅ Used — triggers route detail fetch |
| `id_str` | — Duplicate of `id`; not used |
| `resource_state` (1) | — Not checked at this level |
| `name` | ✅ Used — `route_info.name` fallback |
| `map.summary_polyline` | — Not used |
| `map_urls` (`url`, `retina_url`, `light_url`, `dark_url`) | ❌ Not used — ready-made map tile images |

> **Fallback gap.** `getBasicRouteInfo()` also attempts to read `route.distance` and
> `route.elevation_gain` from the embedded route when a direct fetch fails or is
> rate-limited. These fields **do not exist at state 1**, so the fallback always
> produces `N/A` for distance and elevation.

### State 3 — from `GET /routes/{id}` *(what the app fetches)*

| Field | App usage |
|-------|-----------|
| `id` / `id_str` | — Not re-used after fetch |
| `resource_state` (3) | ✅ Used — `route_info.is_full = (resource_state == 3)` |
| `name` | ✅ Used — `route_info.name` |
| `distance` | ✅ Used — `route_info.distance` (converted to km) |
| `elevation_gain` | ✅ Used — `route_info.elevation_gain` (rounded to m) |
| `type` | ✅ Used — `route_info.activity_type` (e.g. `1`=Ride, `2`=Run) |
| `sub_type` | ✅ Used — appended to activity type (e.g. `1`=Road, `2`=MTB) |
| `estimated_moving_time` | ✅ Used — `route_info.estimated_moving_time` |
| `maximum_grade` | ✅ Used — `route_info.max_slope` |
| `elevation_high` | ✅ Used — `route_info.elevation_high` |
| `elevation_low` | ✅ Used — `route_info.elevation_low` |
| `map.summary_polyline` | ❌ Not used |
| `map.polyline` | ❌ Not used — full point-by-point polyline (state 3 only) |
| `map_urls` (`url`, `retina_url`, `light_url`, `dark_url`) | ❌ Not used — ready-made map tile images (available at both state 1 and 3) |
| `athlete` (state 2) | ❌ Not used — route creator |
| `description` | ❌ Not used |
| `private` | ❌ Not used |
| `starred` | ❌ Not used (note: user-specific; correctly excluded from cache key) |
| `created_at` / `updated_at` / `timestamp` | ❌ Not used |
| `waypoints` | ❌ Not used |
| `segments` | ❌ Not used — array of Strava segments with grade, climb category, elevation |

---

## Club

Source: `docs/examples/club-*-state-1/2/3-example.json`.

### State 1 — embedded inside a list-event's `club` field

```json
{ "id": 1752189, "resource_state": 1, "name": "Club Events Testing Club" }
```

Only `id` and `name` are available. `profile_medium` (needed for `club_info.logo`) is
absent, which is why the logo is sourced from the clubs-list object, not this embed.

### State 2 — from `GET /athlete/clubs` *(what the app fetches)*

| Field | App usage |
|-------|-----------|
| `id` | ✅ Used — iterate clubs, fetch events, build `strava_event_url` |
| `name` | ✅ Used — `club_info.name` |
| `profile_medium` | ✅ Used — `club_info.logo` |
| `profile` (large) | ❌ Not used |
| `cover_photo` / `cover_photo_small` | ❌ Not used |
| `activity_types` | ❌ Not used — array of activity types the club supports |
| `activity_types_icon` | ❌ Not used |
| `dimensions` | ❌ Not used — leaderboard metric keys |
| `sport_type` / `localized_sport_type` | ❌ Not used — e.g. `"cycling"` / `"Cycling"` |
| `city` / `state` / `country` | ❌ Not used — club location |
| `private` | ❌ Not used |
| `member_count` | ❌ Not used |
| `featured` / `verified` | ❌ Not used |
| `url` | ❌ Not used — vanity URL slug |

### State 3 — from `GET /clubs/{id}` *(never fetched by the app)*

Everything from state 2, plus:

| Field | Potential use |
|-------|---------------|
| `membership` | `"member"` / `"pending"` / `"blocked"` — could drive UI indicators |
| `admin` / `owner` | Could show admin controls |
| `description` | Club bio / about text |
| `club_type` | `"casual_club"` / `"racing_team"` / etc. — could be a filter |
| `following_count` | Social metric |
| `website` | External link |

---

## Summary of notable gaps

| # | Gap | Affected model | Impact |
|---|-----|----------------|--------|
| 1 | `map_urls` ignored on both route state 1 and state 3 | Route | Map preview images are already generated by Strava; displaying them requires no extra API calls |
| 2 | `segments` ignored on route state 3 | Route | Climb data (category, grade, elevation) available per segment |
| 3 | `map.polyline` ignored on route state 3 | Route | Full turn-by-turn polyline available for interactive map rendering |
| 4 | ~~`getBasicRouteInfo()` reads `distance`/`elevation_gain` from a state-1 route that never has them~~ | Route | **Fixed** — dead conditionals removed; fallback correctly returns N/A |
| 5 | `zone` (timezone) not applied to `start_date` | Event | Displayed time may differ from local club time |
| 6 | `joined` not surfaced | Event | Frontend filtering by join status is not wired up |
| 7 | State-3 event fields never fetched (`frequency`, `days_of_week`, `start_datetime`) | Event | Recurrence pattern and canonical local time unavailable |
| 8 | Club `city`/`state`/`country` not used | Club | No geographic filtering or display |
| 9 | `start_latlng` not used | Event | No map pin or geo-proximity filtering |
| 10 | `route_id` (number) silently loses precision | Event | Harmless — `route.id` (string, preserved by `parseJsonWithStringIds`) is used instead |
