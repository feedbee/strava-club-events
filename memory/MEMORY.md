# Project Memory: Strava Club Events Calendar

## Architecture
- **Backend**: Node.js / Express in `src/` — routes, controllers, services, utils, cache
- **Frontend**: Single-page vanilla JS in `public/` — index.html, index.js, styles.css
- **Main service**: `src/services/strava.service.js` — all Strava API calls, limits constants, caching

## Key Patterns
- Filter state stored in `localStorage` key `stravaEventsFilterState`
- Events response shape: `{ events, clubs, meta }` (with legacy array fallback in frontend)
- All limit constants defined at top of `strava.service.js` as `LIMIT_*` named constants
- Changes documented in `docs/changes/` as markdown specs (modeled on `limits.md` style)
- `loadFilterState()` called in the init IIFE before `loadEvents()` (ensures filter state is ready before URL is built)
- Club filter triggers a full re-fetch (`loadEvents()`); joined filter re-filters in-memory (`updateCalendarWithFilteredEvents()`)

## Implemented Features
- OAuth2 auth, token refresh, session management
- FullCalendar month/week/day views with club logos
- Filter: joined-only toggle + club multi-select picker (up to 10 clubs)
- Persistent filter state via localStorage
- In-memory and MongoDB cache drivers
- Limits/transparency system with warning strip + `/limits.html`

## API
- `GET /events` — returns `{ events, clubs, meta }`. Optional `?clubs=id1,id2,...` (max 10) to filter by specific clubs; bypasses the 25-club default limit.
- `GET /clubs` — does NOT exist; clubs are returned inside the `/events` response
- `GET /limits` — returns limit constants (no auth required)

## Important Files
- `src/services/strava.service.js` — limits, caching, event enrichment, `getAllUserClubsEvents({ filterClubIds })`
- `src/controllers/events.controller.js` — parses `?clubs` query param
- `public/index.js` — filter state (`filterState.selectedClubs`), club picker functions, `CLUB_FILTER_LIMIT = 10`
- `docs/changes/limits.md` — limits system spec
- `docs/changes/club-filter.md` — club filter feature spec
