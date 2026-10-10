# Frozen design reference

This directory isolates the approved native-JavaScript calendar prototype before React migration.
Open `/prototypes/calendar/index.html?demo=1` or `/prototypes/calendar/login.html`.
Legacy `/experiment.html` bookmarks redirect here and preserve query parameters.

The prototype coordinator is copied from the legacy page so further experimentation does not change `public/index.js`. Shared API/filter/list helpers and static brand assets remain dependencies. This is a visual reference, not the production frontend source. Migration plan: `docs/changes/calendar-production-plan.md`.
