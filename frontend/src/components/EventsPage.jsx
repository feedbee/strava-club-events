import React, { useEffect, useMemo, useState } from "react";
import {
  browserStorage,
  preferenceKey,
  readPreferences,
  writePreferences,
} from "../data/preferences.js";
import { eventWarnings } from "../data/event-warnings.js";
import { useEvents } from "../hooks/useEvents.js";
import { filterEvents } from "../data/events.js";
import { EventFilters } from "./EventFilters.jsx";
import { Calendar } from "./Calendar.jsx";
import { EventDetails } from "./EventDetails.jsx";
export function EventsPage({ demo, user, onAuthRequired }) {
  const key = preferenceKey({ demo, athleteId: user.athleteId });
  const [preferences, setPreferences] = useState(() =>
    readPreferences(browserStorage(), key),
  );
  useEffect(
    () => writePreferences(browserStorage(), key, preferences),
    [key, preferences],
  );
  const filters = preferences;
  const data = useEvents({ demo, onAuthRequired, filters });
  const warnings = eventWarnings(data.meta, filters.clubs);
  const setFilters = (filters) =>
    setPreferences((previous) => ({ ...previous, ...filters }));
  const [selected, setSelected] = useState(null);
  const events = useMemo(
    () => filterEvents(data.events, filters, data.clubs),
    [data.events, data.clubs, filters],
  );
  if (data.status === "loading" && !data.loaded)
    return <div className="initial-events-loading"><LoadingEvents /></div>;
  if (data.status === "error" && !data.loaded)
    return (
      <div role="alert">
        <p>{data.message}</p>
        {Number.isSafeInteger(data.retryAfter) && data.retryAfter > 0 && <p>Please retry in {data.retryAfter} seconds.</p>}
        <button className="control" onClick={data.retry}>
          Try again
        </button>
        {(filters.clubs.length > 0 || filters.sports.length > 0) && (
          <button className="control" onClick={() => setFilters({ clubs: [], sports: [] })}>Reset filters</button>
        )}
      </div>
    );
  return (
    <div className="events-page">
      <EventFilters
        clubs={data.clubs}
        filters={filters}
        onChange={setFilters}
        count={events.length}
        meta={data.meta}
      />
      {data.status === "error" && <div className="api-warning" role="alert">
        <p>{data.message} Previously loaded events are still shown.</p>
        <button className="control" onClick={data.retry}>Try again</button>
      </div>}
      {warnings.length > 0 && <aside className="api-warning" aria-label="Data availability">
        {warnings.map((message) => <p key={message}>{message}</p>)}
        <a href="/limits.html" target="_blank" rel="noopener noreferrer">Learn about Strava limits ↗</a>
      </aside>}
      <div className="calendar-loading-region" aria-busy={data.status === "loading"}>
        <div className="calendar-content" inert={data.status === "loading"}>
      <Calendar
        events={events}
        onOpen={setSelected}
        initialMode={preferences.mode}
        onModeChange={(mode) =>
          setPreferences((previous) => ({ ...previous, mode }))
        }
      />
        </div>
        {data.status === "loading" && <LoadingEvents />}
      </div>
      {selected && (
        <EventDetails event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function LoadingEvents() {
  return (
    <div className="events-loading-overlay" role="status" aria-live="polite">
      <div className="events-loading-indicator">
        <span className="events-loading-spinner" aria-hidden="true" />
        <span>Loading events…</span>
      </div>
    </div>
  );
}
