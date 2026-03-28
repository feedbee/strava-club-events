# List View — Feature Specification

**Date:** 2026-03-28
**Status:** Approved for implementation

---

## 1. Problem Statement

The existing calendar (Month / Week / Day) forces the user to navigate by date grid. This creates two friction points:

1. **Scanning upcoming events** requires clicking through days or weeks; there is no way to see all events in a single scrollable flow sorted by time.
2. **Mobile experience** is poor — the calendar grid is spatially complex and hard to interact with on a small screen.

The list view solves both by presenting events as a vertical chronological feed.

---

## 2. Product Requirements

### Scope
- Same 30-day event window as the calendar (no new API calls; data is already fetched).
- All existing filters apply identically: club filter, sport type filter, joined-only toggle.
- No tooltips in list view — detail is revealed via expand/collapse instead.

### Grouping & Ordering
- Events grouped by **calendar date**, sorted chronologically within each group.
- Each date group has a sticky header showing the full date (e.g. `Saturday, March 28`).
- If today has events, the **Today** group is visually distinguished (orange label).
- Empty dates are not shown.

### Event Card — Collapsed State (default)
Each card displays:
```
[TIME]   [CLUB NAME]                              [JOINED badge?]
[EMOJI]  [Event Title]
         [Distance · Elevation · Terrain · Skill]   (if route data available)
```

- **Time**: formatted as `10:30 AM`
- **Club name**: plain text, secondary color
- **Joined badge**: small pill `Joined` in Strava orange — shown only when joined
- **Emoji**: activity type emoji prepended to title
- **Stats row**: shown only when route data is present; omitted gracefully if not
  - Distance (km), elevation gain (m↑), terrain label, skill level label; separator ` · `

### Event Card — Expanded State (accordion)

Clicking a card toggles an **expanded detail panel** directly below that card. Only one card may be expanded at a time — expanding a new card collapses any currently open one.

The expanded panel has three labelled sections, each with links to Strava:

**Club**
- Club logo + club name → links to the club's Strava page

**Event**
- Event title → links to the event's Strava page
- Full date and time
- Address (if available)
- Terrain label (if available)
- Skill level label (if available)
- Joined confirmation (if joined)

**Route** — shown only when route data is present
- Route name → links to the route's Strava page
- Distance, elevation gain, activity type, estimated moving time, max slope, elevation range
- Fields with no data (`N/A`) are omitted

### Empty State
When no events match the current filters, show a centred message:
`No upcoming events match your filters.`

### Mode Switcher
Two icon buttons in the **nav bar** right side, before the avatar:
- Grid icon = Calendar mode
- Lines icon = List mode

The active mode icon is highlighted. The Month / Week / Day sub-view buttons are hidden in List mode.

### State Persistence
The selected mode (calendar / list) is persisted in `localStorage` so the user returns to their preferred mode on reload.

---

## 3. Technical Approach

### Rendering
The list view is a **separate DOM container** that lives alongside the calendar. Only one is visible at a time. No new backend calls — the list reads from the same filtered events array already maintained in memory.

FullCalendar's built-in list view was evaluated and rejected: it cannot hide its navigation bar, navigates by month rather than showing a continuous feed, and does not support the card layout or expand/collapse interaction required here.

### Files to Modify

| File | What changes |
|------|--------------|
| `public/index.html` | Add list view container; add mode-switcher buttons to nav bar |
| `public/index.js` | List rendering, accordion logic, mode toggle, filter integration, localStorage |
| `public/styles.css` | All new list view styles, namespaced under `.list-view` and `.lv-*` |
| `src/services/strava.service.js` | Expose route ID in route info object so the route Strava URL can be constructed client-side |

### Data Available Per Event

All data needed for both the collapsed card and the expanded panel is already present in the events array passed to the frontend:

- **Event**: title, start date/time, address, terrain label, skill level label, joined flag, Strava event URL
- **Club**: id (for URL), name, logo
- **Route** (optional): id (for URL), name, distance, elevation gain, activity type, estimated moving time, max slope, elevation range

> The route `id` is currently not included in the route info object sent to the client. One field must be added to the backend's route info builder so the route Strava URL can be constructed. No other backend changes are needed.

### CSS Namespace

All new rules are scoped under `.list-view` and `.lv-*` prefixes to avoid conflicts with existing styles.

---

## 4. Out of Scope

- Infinite scroll / pagination beyond the existing 30-day window
- Pull-to-refresh on mobile
- Sorting options (by distance, elevation, etc.)
- Collapsible date groups
- Tooltips in list view (replaced by expand/collapse panel)
- Any backend changes beyond exposing the route ID

---

## 5. Decisions

| Question | Decision |
|----------|----------|
| Time range | Same 30 days as calendar — no new API endpoint needed |
| Grouping | By calendar date with sticky headers |
| Card density | Medium: time, club, title, stats row, joined badge |
| Detail reveal | Accordion expand/collapse — no tooltips in list view |
| Expanded panel structure | Three sections: Club · Event · Route — all with Strava links |
| Accordion limit | One card open at a time |
| Route URL | Requires route ID added to route info in backend (one field) |
| Mode switcher placement | Icon pair in nav bar right, before avatar; Month/Week/Day hidden in list mode |
| State persistence | View mode saved to existing `stravaEventsFilterState` key in localStorage |
| FullCalendar list view | Rejected — navigation not removable, no layout control, mobile UX unchanged |
