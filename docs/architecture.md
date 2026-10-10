# Architecture and coding guidance

Express serves static HTML/CSS/JavaScript from `public/` and session-authenticated API routes.
The legacy page remains native JavaScript with FullCalendar from a pinned CDN URL.
The opt-in frontend in `frontend/` uses React/Vite and builds static assets into `public/next/`.

Routes select controllers; controllers handle HTTP shapes; reusable Strava and refresh rules belong
in services. Middleware owns authentication, sessions and security headers. Configuration validates
process environment. Cache adapters implement memory or MongoDB persistence. Sessions use memory
only in development; production requires MongoDB. OAuth tokens never belong in browser storage.

Keep API failures distinguishable from empty results. Preserve large provider identifiers, occurrence
identity and user-specific cache boundaries. Validate provider URLs and escape dynamic HTML.
Keep secret values out of logs and documentation. Use ES modules and existing helpers rather than
adding dependencies for behavior supported by Node. Preserve encryption-key compatibility and
refresh/logout fencing when changing persistence. Add outcome-based regression checks for changes.

## Browser modules

`public/index.js` coordinates authentication, request versions, application state and view changes.
Native ES modules in `public/js/` own API errors, safe HTML/image helpers, calendar rendering,
list presentation, reusable multi-select behavior, filter configuration and preference validation.
The HTML entry uses `type="module"`; no bundler or transpiler is required. Modules must use explicit
imports rather than relying on other files' global declarations. FullCalendar remains a CDN global.

`public/styles.css` imports calendar, filter, shell and list styles in that order. All public pages
keep the shared entry point so the existing cascade is preserved. Update the responsible stylesheet
rather than appending unrelated overrides to the entry point.

Filters use native buttons and checkboxes. Collapsed panels are inert; Escape closes the active
picker first and then the filter panel, returning focus to its opener. Dropdown re-rendering retains
checkbox focus. Browser preferences contain only typed presentation/filter fields, never tokens.
View mode and joined-only preferences intentionally remain browser-wide; club/sport selections are
cleared on authentication loss. Account-specific preference storage is not part of this change.

## Opt-in calendar experiment

`public/prototypes/calendar/index.html` mounts the custom controller through the shared coordinator. Its interface is
`setEvents(events)`, `updateSize()` and `destroy()`; it does not imitate FullCalendar's mutation API.
`calendar-data.js` indexes dates, `event-card.js` renders safe compact cards, `event-preview.js`
owns delayed hover listeners/timers, and `event-dialog.js` owns the shared detail dialog lifecycle.
Experimental CSS is organized by component in `public/prototypes/calendar/css/experiment.css`. Demo fixtures are imported
only when requested and use separate presentation preferences. See
[the migration proposal](changes/calendar-production-plan.md) before moving this into the primary page.

## React implementation in progress

`frontend/src/App.jsx` owns session presentation; `data/auth.js` distinguishes signed-out 401 from
request failures and forwards cancellation. `components/Profile.jsx` owns account disclosure.
The React entry now provides session presentation, event loading, filters and Month/List layouts.
`data/events.js` validates occurrence identity, indexes local dates and applies filter intersections;
`hooks/useEvents.js` owns cancellable requests. Calendar, card, picker and dialog components own
React state rather than manipulating prototype markup. Week/Day and animated previews remain
upcoming migration increments. `/next/?demo=1` uses synthetic state without OAuth.
`npm run dev:frontend` proxies auth/API/assets to the existing server at 127.0.0.1:3000; `npm run build`
produces ignored `/next/` assets served by Express. Both production Dockerfiles build this frontend
in a Node 24.21.0 stage. The existing `/` entry is unchanged until parity acceptance.

## Design mock backend

`prototypes/calendar/backend/` is a standalone loopback-only Express application, launched with
`npm run dev:mock`. It serves the public prototype and built React frontend through the same
session/events HTTP shapes, with synthetic cookie-isolated sessions and selectable edge cases.
It has no imports into `src/` and needs no production configuration or MongoDB. See
[local mock development](../prototypes/calendar/README.md). This is the shared data boundary for
future design experiments; UI components should remain shared with the implementation being tested.
