import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { useCardPreview } from "../hooks/useCardPreview.js";
export function EventCard({ event, onOpen, expanded = false }) {
  const source = useRef(null);
  const hover = useCardPreview(source);
  const logo = /^https:\/\//.test(event.club_info?.logo || "")
    ? event.club_info.logo
    : [
          "/prototypes/calendar/images/demo-club-road.svg",
          "/prototypes/calendar/images/demo-club-gravel.svg",
        ].includes(event.demo_logo)
      ? event.demo_logo
      : null;
  return (
    <>
      {" "}
      <button
        ref={source}
        tabIndex={expanded ? -1 : undefined}
        onPointerEnter={expanded ? undefined : hover.enter}
        onPointerLeave={expanded ? undefined : hover.leave}
        onPointerDown={hover.hide}
        onKeyDown={(event) => {
          if (event.key === "Escape") hover.hide();
        }}
        className={`event-card ${event.joined ? "joined" : ""} ${expanded ? "expanded-card" : ""}`}
        onClick={() => {
          hover.hide();
          onOpen(event);
        }}
        aria-haspopup="dialog"
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
      {!expanded &&
        hover.preview &&
        createPortal(
          <div
            className="event-preview"
            style={hover.preview}
            onPointerLeave={hover.leave}
          >
            <EventCard
              event={event}
              expanded
              onOpen={(event) => {
                hover.hide();
                onOpen(event);
              }}
            />
          </div>,
          document.body,
        )}{" "}
    </>
  );
}
