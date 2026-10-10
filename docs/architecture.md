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
