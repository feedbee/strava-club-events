import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "./ClubLogo.jsx";
import { useCardPreview } from "../hooks/useCardPreview.js";

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function CardContent({ event, detailed }) {
  const time = <time dateTime={event.start_date}>{timeFormat.format(new Date(event.start_date))}</time>;
  if (detailed) {
    const route = [event.route_info?.distance, event.route_info?.elevation_gain]
      .filter((value) => value && value !== "N/A");
    return (
      <>
        <span className="detailed-card-top">
          {time}
          {event.joined && <span className="detailed-card-joined">✓ Joined</span>}
        </span>
        <strong>{event.title}</strong>
        <span className="detailed-card-club"><ClubLogo event={event} />{event.club_info?.name}</span>
        {route.length > 0 && <span className="detailed-card-route">{route.join(" · ")}</span>}
      </>
    );
  }

  return (
    <>
      <ClubLogo event={event} />
      {event.joined && <span className="card-joined" aria-label="Joined">✓</span>}
      <span className="card-copy">
        <span className="card-time">
          {time}
          <span className="card-club"> · {event.club_info?.name}</span>
        </span>
        <strong>{event.title}</strong>
      </span>
    </>
  );
}

export function EventCard({ event, onOpen, detailed = false }) {
  const source = useRef(null);
  const hover = useCardPreview(source);
  const cardClass = `event-card ${event.joined ? "joined" : ""}`;
  function open() {
    hover.hide();
    onOpen(event);
  }

  return (
    <>
      <button
        ref={source}
        data-event-key={event.key}
        onPointerEnter={detailed ? undefined : hover.enter}
        onPointerLeave={detailed ? undefined : hover.leave}
        onPointerDown={hover.hide}
        onKeyDown={(event) => {
          if (event.key === "Escape") hover.hide();
        }}
        className={`${cardClass}${detailed ? " detailed-card" : ""}`}
        onClick={open}
        aria-haspopup="dialog"
      >
        <CardContent event={event} detailed={detailed} />
      </button>
      {!detailed && hover.preview &&
        createPortal(
          <div
            ref={hover.panel}
            className="event-preview"
            style={hover.preview}
            onPointerLeave={hover.leave}
          >
            <button className={`${cardClass} detailed-card`} tabIndex={-1} onClick={open} aria-haspopup="dialog">
              <CardContent event={event} detailed />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
