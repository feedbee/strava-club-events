import React from "react";
export function EventCard({ event, onOpen }) {
  const logo = /^https:\/\//.test(event.club_info?.logo || "")
    ? event.club_info.logo
    : [
          "/prototypes/calendar/images/demo-club-road.svg",
          "/prototypes/calendar/images/demo-club-gravel.svg",
        ].includes(event.demo_logo)
      ? event.demo_logo
      : null;
  return (
    <button
      className={`event-card ${event.joined ? "joined" : ""}`}
      onClick={() => onOpen(event)}
      aria-haspopup="dialog"
      title={event.title}
    >
      {logo ? (
        <img src={logo} alt={event.club_info?.name || "Club"} />
      ) : (
        <span className="club-initial">
          {(event.club_info?.name || "?").slice(0, 1)}
        </span>
      )}
      <span className="card-copy">
        <span className="card-time">
          <time>
            {new Date(event.start_date).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          <span className="card-club"> · {event.club_info?.name}</span>
          {event.joined && <span aria-label="Joined"> ✓</span>}
        </span>
        <strong>{event.title}</strong>
      </span>
    </button>
  );
}
