# Promote React to the primary frontend

React/Vite now serves `/` from the generated, ignored `public/app/` directory. Vite uses root
asset URLs. Express serves this directory before shared public assets. Both production Dockerfiles
copy their own frontend build into the runtime image. Host-generated builds are excluded from the
Docker context. Local setup requires `npm run build`; `npm test` builds first so HTTP tests work
on a clean checkout. No production Node major or release version changes are included.

The old `public/index.html`, coordinator, FullCalendar module and its browser-only smoke have been
removed. FullCalendar CDN permission and obsolete styles are gone. The native custom-calendar
reference remains under `public/prototypes/calendar/`; its helpers and styles are isolated under
`shared/`, and its state tests explicitly exercise the prototype coordinator. About and Limits
retain their content with a separate informational stylesheet. Primary React browser coverage
checks session state, filters, Month/List/Week/Day, previews and loading presentation.

Authentication uses the same backend/session contracts. Login, OAuth callback and CSRF-protected
POST logout always return to `/`, ignoring browser-provided redirect destinations. Existing
`/next` and `/next/` bookmarks receive a 308 redirect to `/` with their query string preserved.
The standalone mock server defaults to React; its native prototype URL remains available.

Verification: 149 default tests and the production build passed. Root HTTP tests prove React is
served, the old JS entry is unavailable and opt-in bookmarks redirect. Browser gates passed for
React shell, native/mock session flows, filter requests, Week/Day preview clicks and Month/List.
Both Debian and Alpine production Docker builds passed locally, without image publication.
Live OAuth still requires an operator check with the configured callback hostname. This change
is committed on the design branch; no merge, release or deployment is included.
