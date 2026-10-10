# Architecture and coding guidance

Express serves static HTML/CSS/JavaScript from `public/` and session-authenticated API routes.
There is no React, Vite, compilation or frontend bundle step. FullCalendar loads from a pinned CDN URL.

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
