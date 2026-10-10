# Strava API model coverage

Implementation review: October 10, 2026. Checked-in files in [examples/](examples/) are now synthetic representations of previously observed model shapes, not live provider data. They are not evidence of current provider behavior.

## Resource boundaries

| Resource | Application endpoint | Data consumed |
|---|---|---|
| Clubs list | `GET /athlete/clubs` | Up to 200 clubs; first 25 by default, or the selected club/sport filter |
| Club events list | `GET /clubs/{id}/group_events` | Up to 100 original events per club |
| Route details | `GET /routes/{id}` | Up to 20 uncached route requests per application load |
| Club details | `GET /clubs/{id}` | Model script only; not fetched by the application |
| Single event | `GET /group_events/{id}` | Model script only; not fetched by the application |

The application consumes list events and an embedded basic route, enriching routes separately. Clubs, events and routes have user-specific cache keys. All provider records are projected before writing and after reading cache, using [strava-models.js](../src/services/strava-models.js).

## Cached club model

| Field | Use |
|---|---|
| `id` | Membership filtering, event requests, links and club response |
| `name` | Calendar/list/filter club name |
| `profile_medium` | Club logo |
| `sport_type` | Sport filtering |
| `localized_sport_type` | Club response label |

Embedded event clubs are not exposed. Profiles, location, membership counts, permissions, cover images and other unused club fields are discarded. Club data displayed with events comes from the clubs-list object, not its embedded event copy.

## Cached event model

| Field | Use |
|---|---|
| `id` | Original event identity and Strava link |
| `title` | Calendar/list title |
| `joined` | Participation styling and joined-only filtering |
| `address` | Meeting-point display |
| `terrain` | Computed terrain label |
| `skill_levels` | Computed skill label |
| `activity_type` | Basic route fallback |
| `upcoming_occurrences` | Each unique occurrence in the inclusive next 30 × 24 hours |
| `route.id`, `route.name` | Route lookup and fallback name |

Organizing-athlete profiles, descriptions, start coordinates, permissions, embedded clubs, recurrence templates and all unknown fields are discarded. Dates are displayed in the browser's local timezone; the application does not generate a schedule or apply a separate club timezone.

## Public event DTO

| Field | Source |
|---|---|
| `id`, `title`, `joined`, `address` | Minimal event model |
| `start_date` | One upcoming occurrence, as an ISO timestamp |
| `occurrence_id` | Club ID, original event ID and occurrence UTC timestamp |
| `strava_event_url` | Strava club/event URL |
| `club_info` | `id`, `name`, `logo` from the clubs-list record |
| `terrain_label`, `skill_level_label` | Decoded event values |
| `route_info` | Minimal detailed route or basic fallback |
| `route_details_failed` | Optional true flag when enrichment fails |

There is no raw provider-object spread. The API intentionally removes previously unused pass-through fields. Clients must consume this DTO rather than assume arbitrary Strava fields are forwarded.

## Cached route model

| Field | Use |
|---|---|
| `id` | Identity validation and route response |
| `name`, `resource_state` | Name and `is_full` flag |
| `distance`, `elevation_gain` | Distance in km and elevation gain in m |
| `type`, `sub_type` | Activity label |
| `estimated_moving_time` | Duration label |
| `maximum_grade` | Slope label |
| `elevation_high`, `elevation_low` | Elevation range |

Athlete profiles, maps, polylines, map URLs, segments, waypoints, descriptions, starred/private flags and provider timestamps are discarded. No map preview or geometry rendering currently requires them. Basic route fallback retains id/name and the event activity type; unavailable metrics display N/A.

`route_info` contains id, name, is_full, distance, elevation_gain, activity_type, estimated_moving_time, max_slope, elevation_high and elevation_low. Existing zero-value and percent-formatting defects remain a separate audit item.

## Validation and old cache records

Resources must be objects with a nonempty string ID or a nonnegative safe integer ID. Large provider IDs are preserved as strings. Optional text and numeric fields retain only their expected primitive types; nested objects cannot pass through those fields. An invalid list/resource fails explicitly. Invalid embedded route data falls back to basic event display.

Old rich cache records are projected before use and rewritten when their content differs, using the configured TTL for the scrub write. An unchanged minimal record is not rewritten. Old records not accessed remain until TTL expiry; failed adapter writes also leave stored records until a later successful scrub or expiry. Neither case permits excluded fields in the API. This is not a database-wide purge.

## Synthetic reference examples

Files preserve known model field names, resource states, array/object shapes and cross-resource identifiers while replacing personal text, URLs, IDs, dates and coordinates. Polylines are empty; image/site URLs use example.com. Large ID references are parsed without rounding. These examples describe possible provider shapes, not the application's smaller cache or API contract.

`node --env-file=.env scripts/fetch-model.js --type event --id <provider-id>` fetches a model using STRAVA_ACCESS_TOKEN and saves only its synthetic representation in docs/examples with a synthetic filename. Crawl mode shares identifier mappings within the run. Unknown provider fields are excluded, and raw upstream error bodies are not logged. The script still makes live authenticated provider calls when explicitly run; tests substitute that boundary.

Git history is unchanged. Removing historical personal data would require a separate repository-history operation.
