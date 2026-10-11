# Frozen design reference

This directory isolates the approved native-JavaScript calendar prototype before React migration.
Open `/prototypes/calendar/index.html?demo=1` or `/prototypes/calendar/login.html`.
Legacy `/experiment.html` bookmarks redirect here and preserve query parameters.

The native prototype is isolated from the primary React UI. Its coordinator and shared API/filter/list
helpers live under this directory; static brand assets remain shared. It has no FullCalendar dependency.
The primary application is built from `frontend/` and served at `/`.
