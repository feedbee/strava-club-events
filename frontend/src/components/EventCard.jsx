import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "./ClubLogo.jsx";
import { useCardPreview } from "../hooks/useCardPreview.js";
export function EventCard({ event, onOpen, expanded = false }) {
  const source = useRef(null);
  const hover = useCardPreview(source);
  return (
    <>
      {" "}
      <button
        ref={source}
        data-event-key={event.key}
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
        <ClubLogo event={event} />
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
