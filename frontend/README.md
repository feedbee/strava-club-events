# React frontend: implementation in progress

- `npm ci --ignore-scripts`: canonical installation from repository root.
- `npm run build`: emits ignored assets into `public/next/`.
- `npm start`: existing backend serves the built frontend at `/next/`.
- `npm run dev:frontend`: Vite development server, proxying auth/API and shared assets to the backend at `127.0.0.1:3000`. Local configuration remains in the repository `.env`.
- `/next/?demo=1&screen=login`: synthetic login → profile → logout.
- `/next/`: real session detection and standard Strava login/logout form.

Month/Week/Day/List, compact cards, inline overflow, club/sport/joined filters, cancellable event requests, delayed hover previews and a basic route/event dialog are implemented. Week is available on wide screens; narrowing it switches to Month. Hourly layouts group by start hour and stack simultaneous starts; duration and exact minute positioning are not implemented. Validated mode/filter preferences are saved per athlete (demo separately). Filter search/Escape and modal focus/touch controls have browser checks. Final visual/accessibility review and live Strava parity remain before switching the primary page. React login requests the allowlisted `/next/` return destination; the existing login defaults to `/`. Logout includes the same allowlisted destination.

Verify `npm test`, `npm run build`, and optional `node --experimental-vm-modules tests/integration/react-shell-smoke.mjs` with Playwright available. `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` optionally select installed tooling. The browser script starts its own loopback server and substitutes API responses; it does not use live Strava or MongoDB.

Club/sport selections are forwarded to the API; joined-only selection is local. API metadata
warnings remain visible above the calendar, and refresh errors retain the last successful data.
The mock backend includes a `partial` scenario. Run `tests/integration/react-scenarios-smoke.mjs`
with the same Playwright environment to verify every scenario at desktop and mobile widths.

Open `/next/?mock=1` on the standalone mock backend to reveal the collapsible **Mock data**
scenario selector. Selecting a scenario reloads the page with the same browser mock session.
These controls are opt-in and remain hidden when the mock endpoint is unavailable. Club logos
share one React component between cards and dialogs, with an initial fallback for missing or
failed images. The mock session supplies the synthetic profile avatar.
