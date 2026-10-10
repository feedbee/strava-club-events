# Calendar prototype: production migration plan

Status: reviewed experiment, proposed next work; not a production release. No tracker tasks have been created. Visual acceptance remains with the owner.

## Stack decision accepted by the owner

The owner selected React + Vite for the interactive frontend, keeping Express, sessions, OAuth and existing API contracts. Four layouts, responsive transitions, inline expansion, filters, delayed previews and modal focus create enough shared state to justify components. Native modules remain viable if avoiding a build step is the priority; React is not required for calendar performance.

React adds dependencies, a frontend build and packaging/CI work. It will not itself solve calendar semantics or data availability. Adopt it incrementally behind the experimental entry, then switch the primary page after parity checks. The [official integration guide](https://react.dev/learn/add-react-to-an-existing-project) describes adding React to an existing page and Vite where there is no existing compilation setup. Do not add a second backend or change the production Node major as part of this migration.

## Review changes completed

- Separate date indexing, safe compact-card markup, preview lifecycle, modal lifecycle and calendar controller modules. Index dates once per data update rather than repeatedly scanning all events for every cell; retain separate simultaneous occurrences.
- Replace the experiment's FullCalendar imitation with a `setEvents` boundary. Production FullCalendar remains unchanged.
- Consolidate experimental CSS by component with shared color, typography and control tokens; remove accumulated overrides and obsolete selectors.
- Abort preview listeners and timers on destruction; dismiss before opening details. Identify detail sections with semantic data attributes instead of translated heading text.
- Keep at most 24 month weeks when scrolling, preserving the visible anchor. Trimming defers when it would delete keyboard focus; this is bounded windowing, not a complete virtualizer.
- Load synthetic fixtures only for demo mode and keep demo preferences separate.
- Restore readable 12px footer text and intermediate spacing (12px above, 8px vertical padding) without a separate panel.

Pure indexing/date helpers, design tokens, fixtures and outcome-based tests transfer directly. DOM controllers should be rewritten as components/hooks if React is chosen; copying imperative DOM manipulation into React components would preserve the current maintenance cost.

## Ordered tracker-ready tasks

1. **Implement the accepted stack and build integration.** Add React/Vite with an opt-in entry, development serving and production static output. Acceptance: Node 24 CI and both Docker paths build; Express auth/API unchanged; existing page remains available for rollback.
2. **Define frontend data/state boundaries.** Separate requests/auth from calendar/filter state, inject demo data, use stable occurrence identity rather than positional card indices. Acceptance: request races, logout and repeated/parallel events preserve correct details and user-specific data boundaries; no synthetic fixtures in normal runtime loading.
3. **Migrate the approved design into reusable components.** Shell, controls, filters, date badge, event card, hover preview and dialog share tokens and typography. Acceptance: no dependency on legacy stylesheet override ordering; route and event details, safe links/logos and joined state preserved; footer and Day/List typography match the experiment.
4. **Implement calendar layouts and navigation.** Month includes empty dates on narrow screens; List includes populated dates only without date navigation; narrow screens support Month/Day/List; desktop also Week. Acceptance: overflow expands/collapses inline, simultaneous events do not overlap, all keyboard/touch paths work. Define exact minute placement and duration semantics before implementing them: the prototype groups by start hour and does not display event duration on the time axis.
5. **Finalize calendar data/windowing semantics.** Keep a stable visible date while trimming or updating events, preserve focus, limit detached/retained state and persist validated layout preferences. Acceptance: long forward/backward scrolling, filter updates and breakpoint transitions retain the intended date. Existing `/events` returns upcoming events; historical or per-month loading requires a separate provider/backend feasibility task, not an implied frontend feature.
6. **Complete accessibility and international presentation.** Localize labels and date formatting, decide viewer/event timezone policy, verify Cyrillic/extended Latin and fallback fonts, keyboard focus, touch details and reduced motion. Acceptance: no clipped controls or horizontal overflow at 320/768/1440px; modal focus restoration and preview clicks work throughout animation.
7. **Authenticated parity and rollout.** Verify live Strava login/logout, API failures, empty results, route fields and every filter with real account data. Run regression/browser gates and build checks. Switch primary template only after acceptance; remove FullCalendar and unused old styles in a separate cleanup with rollback documented.

## Verification and limits

The default suite and optional browser smoke cover synthetic data without Strava credentials or MongoDB. Browser smoke includes clicks before/during/after the hover delay, clicking outside the source cell, same-time events, bidirectional DOM windowing, inline expansion/collapse, responsive modes, filters and overflow. Additional local browser checks verify preview width is never smaller than its source and its highlight does not change when entering the overlay.

Unauthenticated backend rendering and authenticated presentation with substituted API responses were checked. Live OAuth was not exercised. This review prepares the prototype for migration; it does not establish production readiness or implement the proposed migration.

## Implementation tracking

Branch: `codex/calendar-react`. Checkpoint: `5961d88` isolates the native prototype in
`public/prototypes/calendar/`; old experiment bookmarks redirect there.

- Completed first increment: React/Vite static build, separate `/next/` entry, CI build gate and both Docker build stages; login/profile/logout shell with demo state and existing session API.
- Next: event DTO/identity and request-state boundary, then filters and Month/List renderers.
- Then: Week/Day, preview/dialog, focus/windowing/localization, authenticated parity and primary-page switch.

The React shell temporarily links to the working legacy calendar or demo prototype. Live OAuth
returns to the existing application until the frontend routing/parity increment is accepted.
The frozen prototype stylesheet is a reference; React owns an independent stylesheet.

First increment verification: 126 default tests pass, Vite production build succeeds, React-shell
browser smoke passes at 320/768/1440px with synthetic and substituted session states. Both Alpine
and Debian Docker builds succeed on Node 24.21.0. No live OAuth or publication was performed.

Mock development increment: standalone server under `prototypes/calendar/backend/` provides
selectable synthetic `/me` and `/events` scenarios to both the native prototype and React shell.
Run `npm run dev:mock`; see the mock README for fixture cases and workflow. Production is unchanged.

Events/Month/List increment: stable occurrence keys, validated event responses, cancellable loading
with separate error/empty/auth states, intersecting joined/club/sport filters, reusable compact
cards and a basic native detail dialog. Month has continuous bidirectional windowing capped at
24 weeks with visible-date anchoring; List includes populated dates without date navigation.
Month overflow expands/collapses inline. Narrow Month uses the same date/card components in
one column. The modal is an initial React implementation; full visual/detail parity and hover
preview remain follow-up work, alongside Week/Day, filter preferences and accessibility review.
Documentation and inline comments remain in English.

Verification for Events/Month/List: 134 default checks pass; production bundle builds; React
session and calendar Chromium checks pass, including responsive width and bidirectional month
windowing. Live Strava parity, exact prototype styling, preference persistence, Week/Day and
animated hover previews are not claimed by this increment.

Week/Day and preview increment: hourly rows with stacked simultaneous starts, mode-aware date
navigation, compact current-date badge, desktop Week with responsive normalization to Month,
and Day on narrow screens. Portaled previews wait 850ms, stay 44px high, clamp to the viewport
and never shrink below the source width. The entire preview opens details, including during
the opacity animation. Scroll, resize, pointer departure and source destruction dismiss previews
and clean timers/listeners. Global listeners exist only for active card previews.

Verification: 134 default tests, production build, Month/List browser gate and the new
`react-time-preview-smoke.mjs` pass. Browser coverage includes three simultaneous starts,
Week/Day headers, clicks at 0/500/830/860/930/1050ms, outside-cell preview clicks and width/height
at desktop/mobile sizes. Hour grouping deliberately matches the prototype; minute-offset and
duration semantics remain pending. Next: full detail/filter visual parity, persisted validated
preferences, keyboard/touch/accessibility checks and authenticated production parity.

Details/filters/preferences increment: unified line SVGs for event/route/external links, club
profile link, event participation badge, route activity type, labelled dialog and return focus
to the source occurrence. Filter typography and controls match the approved visual direction;
joined-only uses a keyboard-accessible switch presentation. Pickers expose named groups/search,
Escape closes a picker first and then the panel with focus restoration. Validated layout/filter
preferences are isolated by athlete and demo keys; only presentation fields are persisted, with
storage failures tolerated. Narrow Week still normalizes to Month without overwriting the saved
wide-screen preference. This does not claim complete visual or accessibility parity.

Verification: 136 default checks, production build, Month/List and Week/Day/preview browser gates
pass. The new preferences/details browser gate covers persistence, keyboard and touch controls.
Next: visual comparison across mock scenarios, API limits/warnings and authenticated parity;
keep the existing primary entry until acceptance.

### React increment: provider limits and scenario coverage

The React client now forwards selected clubs and sports to `/events`, allowing clubs outside
Strava's default processing limit to be requested. Joined-only filtering stays local. Requests
remain cancellable; refresh keeps the calendar and filters mounted, and failed refreshes explicitly
retain previously loaded events. Partial-result metadata exposes club/route failures and provider
caps without hiding otherwise available events. Club statistics distinguish selected and limited clubs.

A new `partial` mock scenario exercises these warnings. `react-scenarios-smoke.mjs` checks all
mock scenarios at 1440px and 320px, opening event dialogs and rejecting horizontal overflow and
JavaScript exceptions. Calendar and preference browser checks also pass after server filtering.
`npm test`: 138 passing tests; `npm run build`: successful. This is mock/API contract evidence,
not live OAuth acceptance. The primary entry and OAuth callback destination remain unchanged.

### React increment: mock controls and club identity

The React page exposes the standalone backend's scenario selector only with `?mock=1`.
Switching scenarios persists in the same mock session and reloads React; failed updates show a
retryable message. This removes the need to return to the native prototype to choose test data.
The production backend receives no new routes. Cards and event dialogs share `ClubLogo`, including
missing-image and failed-image fallback. The mock profile uses the synthetic avatar asset.

Verification: 138 default tests, production build, all mock scenarios at 1440px/320px, and the
login/profile/logout shell browser check pass. Screenshots confirm the mobile dialog remains
inside the viewport with club identity, joined status and route attributes. Live Strava OAuth
acceptance and final prototype comparison still remain before making React the primary entry.

### React increment: OAuth return continuity

React login supplies `returnTo=/next/`; the backend stores the exact allowlisted destination in
its OAuth transaction. Successful callback uses that stored value after validating state and
rotating the session. Callback query parameters cannot override it. CSRF-protected React logout
returns to the same signed-out page. Existing login/logout default to `/`; external, protocol-
relative, array and query-bearing destinations are rejected by falling back to `/`.

Verification: 144 default tests pass, including OAuth destination validation and a real local
HTTP login/callback/profile/logout sequence with a synthetic Strava token response. Production
build passes. This verifies application integration, not a completed live Strava authorization.

### React increment: final local visual parity review

Paired native/React screenshots cover Month/Week/Day/List at 1440px and supported narrow modes
at 320px. Corrected missing mode SVGs, date emphasis/full narrow dates, joined-mark placement,
repeat-Month scroll reset and return-to-Month positioning. Calendar sizing now uses remaining
shell height rather than a fixed viewport subtraction, keeping the footer visible when controls
are present. See [the parity matrix](react-calendar-parity.md) for evidence and remaining gates.
Default checks: 144 passing tests; production build and calendar/time-preview/scenario browser
gates pass. No primary routing switch or live OAuth acceptance is claimed.
