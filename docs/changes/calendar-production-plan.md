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
