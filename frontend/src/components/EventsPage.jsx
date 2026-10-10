import React, { useMemo, useState } from "react";
import { useEvents } from "../hooks/useEvents.js";
import { filterEvents } from "../data/events.js";
import { EventFilters } from "./EventFilters.jsx";
import { Calendar } from "./Calendar.jsx";
import { EventDetails } from "./EventDetails.jsx";
export function EventsPage({ demo, onAuthRequired }) {
  const data = useEvents({ demo, onAuthRequired });
  const [filters, setFilters] = useState({
    joinedOnly: false,
    clubs: [],
    sports: [],
  });
  const [selected, setSelected] = useState(null);
  const events = useMemo(
    () => filterEvents(data.events, filters),
    [data.events, filters],
  );
  if (data.status === "loading")
    return <p role="status">Loading your events…</p>;
  if (data.status === "error")
    return (
      <div role="alert">
        <p>{data.message}</p>
        <button className="control" onClick={data.retry}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="events-page">
      <EventFilters
        clubs={data.clubs}
        filters={filters}
        onChange={setFilters}
        count={events.length}
      />
      <Calendar events={events} onOpen={setSelected} />
      {selected && (
        <EventDetails event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
