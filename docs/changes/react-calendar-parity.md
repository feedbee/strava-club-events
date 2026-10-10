# React calendar parity review

Date: 2026-10-10. Scope: opt-in `/next/` compared with the native calendar prototype.
This records local mock verification, not production or live Strava acceptance.

| Area | Result | Evidence |
| --- | --- | --- |
| Month | Seven weekday columns on wide screens; one-column continuous calendar on narrow screens; empty dates retained | Paired screenshots at 1440px/320px; calendar browser gate |
| Navigation | Previous/Today/next, selected-date restoration, repeat Month preserves scroll position | Calendar browser gate |
| Week/Day | Hourly slots with stacked simultaneous starts; narrow Week normalizes to Month | Time/preview browser gate |
| List | Populated dates only, all events, no date navigation | Calendar browser gate |
| Typography | Manrope, stronger month/day, full dates in List/narrow Month, mode SVGs | Paired screenshots across available modes |
| Cards | Club logo, time, compact title, right-aligned joined mark; wider Day/List title and club name | Paired screenshots and scenario browser gate |
| Overflow | Five cards then inline more/less in Month | Calendar browser gate |
| Preview | Delayed width expansion, stable height, full-area clicks, viewport bounds | Time/preview browser gate |
| Dialog | Club/event/route identity, external links, joined badge, optional route fields | Desktop/mobile screenshots; scenario and keyboard gates |
| Filters | Club/sport API requests, local joined filter, per-athlete preferences, keyboard controls | Unit/HTTP and preference browser gates |
| Footer | Calendar uses available height; balanced footer spacing remains visible | Calendar browser gate at 1440px/768px/320px |
| Data states | Empty, missing, long titles, boundaries, many clubs, partial, error, rate limit, slow | Scenario browser gate at 1440px/320px |
| Authentication | Allowlisted React return destination, session rotation, CSRF logout | HTTP flow with synthetic provider response; shell browser gate |

## Intentional differences

React mock controls are an opt-in disclosure styled with the new controls. React compact cards
keep their 44px height on narrow screens. Broken club images fall back to a club initial.
These are not exact pixel copies of the native prototype.

## Remaining before primary entry replacement

- Complete an actual Strava authorization and inspect authenticated data on `/next/`, including
  clubs beyond the default processing cap and real routes. Synthetic OAuth checks cannot prove
  provider configuration or account-specific data coverage.
- Obtain visual acceptance of the current React page. The primary `/` entry remains unchanged.
- Week/Day group starts by hour, matching the prototype. Minute positioning and event-duration
  blocks are outside current parity and need a separate design decision if required.

Build and default checks pass (144 tests). Calendar, time/preview and all-scenario browser gates
pass after the sizing and date/navigation adjustments. These results belong to this increment.
