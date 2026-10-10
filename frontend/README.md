# React frontend: implementation in progress

- `npm ci --ignore-scripts`: canonical installation from repository root.
- `npm run build`: emits ignored assets into `public/next/`.
- `npm start`: existing backend serves the built frontend at `/next/`.
- `npm run dev:frontend`: Vite development server, proxying auth/API and shared assets to the backend at `127.0.0.1:3000`. Local configuration remains in the repository `.env`.
- `/next/?demo=1&screen=login`: synthetic login → profile → logout.
- `/next/`: real session detection and standard Strava login/logout form.

Month/List, compact cards, inline overflow, club/sport/joined filters, cancellable event requests and a basic route/event dialog are implemented. Week/Day and animated hover previews remain next increments. Real OAuth redirects remain unchanged and return to the existing page.

Verify `npm test`, `npm run build`, and optional `node --experimental-vm-modules tests/integration/react-shell-smoke.mjs` with Playwright available. `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` optionally select installed tooling. The browser script starts its own loopback server and substitutes API responses; it does not use live Strava or MongoDB.
