# React frontend: implementation in progress

- `npm ci --ignore-scripts`: canonical installation from repository root.
- `npm run build`: emits ignored assets into `public/next/`.
- `npm start`: existing backend serves the built frontend at `/next/`.
- `npm run dev:frontend`: Vite development server, proxying auth/API and shared assets to the backend at `127.0.0.1:3000`. Local configuration remains in the repository `.env`.
- `/next/?demo=1&screen=login`: synthetic login → profile → logout.
- `/next/`: real session detection and standard Strava login/logout form.

Month/Week/Day/List, compact cards, inline overflow, club/sport/joined filters, cancellable event requests, delayed hover previews and a basic route/event dialog are implemented. Week is available on wide screens; narrowing it switches to Month. Hourly layouts group by start hour and stack simultaneous starts; duration and exact minute positioning are not implemented. Full visual parity, preferences and accessibility remain later increments. Real OAuth redirects remain unchanged and return to the existing page.

Verify `npm test`, `npm run build`, and optional `node --experimental-vm-modules tests/integration/react-shell-smoke.mjs` with Playwright available. `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` optionally select installed tooling. The browser script starts its own loopback server and substitutes API responses; it does not use live Strava or MongoDB.
