# Route metrics and interface refactoring

## Accepted scope

The owner requested completion of the minor defects/documentation and frontend refactoring,
and explicitly excluded further CI work. Keep the current visual layout and workflows,
plain HTML/CSS/JavaScript, production Node 24.21.0 and existing authentication/data boundaries.
No dependency upgrade, framework, bundler, persistence migration or release is included.

## Implementation

- Route formatting accepts finite zero values for distance, elevation gain, high/low elevation,
  maximum slope and estimated moving time. Missing metrics remain `N/A`. The API owns formatted
  slope units; calendar tooltips consume that string without adding another `%`.
- The browser entry coordinates state, authentication, request ordering and view changes.
  `public/js/` contains safe HTML/image helpers, API errors, calendar mounting, list presentation,
  reusable multi-select behavior, filter configuration and typed preference normalization.
  Imports are native ES modules, with no circular dependency on the application entry.
- The shared stylesheet imports calendar, filter, shell and list files in the original cascade
  order; about and limits pages keep using the same entry. No generated build assets are needed.
- Picker triggers and event cards are native buttons. Clear buttons are separate controls rather
  than nested inside a button. Search fields have names; expanded controls identify their content.
  Hidden filter panels are inert. Keyboard selection retains checkbox focus; Escape first closes
  the active picker and returns focus, then closes the panel and returns to its toggle.
- List details open with Enter/Space and close with Escape. Removing an expanded panel restores
  focus if a link inside it was active. Calendar tooltips support focus, blur and Escape.
  Error/status announcements, a skip link, visible keyboard outlines and stronger muted text
  contrast improve accessibility without changing application navigation.
- Saved preferences accept only known typed fields and bounded string selections; malformed
  local data cannot replace booleans or view mode. View mode and joined-only remain browser-wide.
  Private club/sport selections still clear on authentication loss; account-specific preferences
  were optional and are not introduced.
- README examples now match the actual event DTO and endpoint table. Browser architecture/test
  documentation is current. LICENSE supplies the already-declared BSD-2-Clause terms and credits
  the existing project owner, as identified by the application footer and Docker metadata.

## Verification

- The zero-metric and corrupted-preference tests reproduced their respective defects before fixes.
- All 119 ordinary checks pass on Node 26.7.0 and the production-target Node 24.21.0 container.
- Local Chrome smoke loads the real browser ES module graph and CDN FullCalendar with SRI.
  It checks recurring month/list/week events, keyboard list details, checkbox focus preservation,
  Escape focus restoration, zero/single-percent route displays, tooltip focus/Escape, and absence
  of horizontal page overflow at 320, 768, 1024 and 1440px in list/calendar views.
- Existing browser scenarios still cover 429 calendar preservation, authentication loss, initial
  authentication failure, CSRF-protected POST logout, CSP and the limits/about pages. Screenshots were
  visually inspected; no uncaught page errors or CSP violations were observed.
- Persistence did not change; the 11 disposable MongoDB checks were not rerun in this step.
  Their previous verification belongs to the data-minimization report.

## Limits and deployment

No production database or live Strava credentials were used. This is a practical keyboard,
semantics and responsive check, not a formal WCAG certification or a screen-reader user study.
Git history has not been scanned or rewritten; further CI work is excluded by owner decision.
Serve the entire updated `public/` tree, including `js/` and `css/`, together. No encryption/signing
key changes are needed. Publication/deployment follows the existing separate release procedure.
