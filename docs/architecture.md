# Architecture and coding guidance

Express serves static HTML/CSS/JavaScript from `public/` and session-authenticated API routes.
The primary frontend in `frontend/` uses React/Vite and builds static assets into `public/app/`.

Routes select controllers; controllers handle HTTP shapes; reusable Strava and refresh rules belong
in services. Middleware owns authentication, sessions and security headers. Configuration validates
process environment. Cache adapters implement memory or MongoDB persistence. Sessions use memory
only in development; production requires MongoDB. OAuth tokens never belong in browser storage.

Keep API failures distinguishable from empty results. Preserve large provider identifiers, occurrence
identity and user-specific cache boundaries. Validate provider URLs and escape dynamic HTML.
Keep secret values out of logs and documentation. Use ES modules and existing helpers rather than
adding dependencies for behavior supported by Node. Preserve encryption-key compatibility and
refresh/logout fencing when changing persistence. Add outcome-based regression checks for changes.

## Primary React frontend

`frontend/src/App.jsx` owns session presentation. `data/auth.js` distinguishes signed-out 401 from
request failures and forwards cancellation. `components/Profile.jsx` owns account disclosure.
`data/events.js` validates occurrence identity and applies filter intersections; `hooks/useEvents.js`
owns cancellable requests. Calendar, card, picker and dialog components own React state.
`TimeGrid.jsx` provides hourly Week/Day layouts. `useCardPreview.js` manages delayed portal previews.
The calendar navigation spans the complete previous month through the third following month;
provider occurrences are included only in the rolling next 90 days. `/?demo=1` uses synthetic data.

Vite builds into ignored `public/app/`, with asset URLs rooted at `/`. Express serves the generated
frontend before shared public assets. `/next` and `/next/` redirect to `/`, preserving query strings.
Both Dockerfiles build the frontend in a Node 24.21.0 stage; local startup requires `npm run build`.
Vite development proxies session/API/brand assets to the existing backend at 127.0.0.1:3000.

## Native design reference

`public/prototypes/calendar/` retains the native custom-calendar reference and synthetic fixtures.
Its API/filter/list helpers and CSS are isolated under `shared/`. It does not depend on FullCalendar
or a separate legacy main page. The primary UI is React; prototype state tests and browser checks
remain labelled as development-reference coverage rather than production React verification.

## Design mock backend

`prototypes/calendar/backend/` is a standalone loopback-only Express application, launched with
`npm run dev:mock`. It serves the public prototype and built React frontend through the same
session/events HTTP shapes, with synthetic cookie-isolated sessions and selectable edge cases.
It has no imports into `src/` and needs no production configuration or MongoDB. See
[local mock development](../prototypes/calendar/README.md). This is the shared data boundary for
future design experiments; UI components should remain shared with the implementation being tested.

React presentation preferences use `data/preferences.js`: allowlisted modes, boolean joined-only
and deduplicated club/sport string selections capped at ten. Storage is isolated by athlete and
demo keys and contains no session/token fields. Blocked storage falls back to defaults. React
pickers handle Escape locally only while open, allowing a second Escape to close the panel.
Native dialogs expose a labelled title and restore focus to the source occurrence after closing.

OAuth and POST logout return to `/`. Callback state verification, session regeneration and CSRF
validation remain unchanged. Browser-provided destinations cannot select external redirect URLs.
