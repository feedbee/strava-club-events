import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
function ExternalLink({ href, children }) {
  if (!/^https:\/\//.test(href || "")) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}
export function EventDetails({ event, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return createPortal(
    <dialog
      className="event-details"
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom)
        )
          e.currentTarget.close();
      }}
    >
      <button
        className="control dialog-close"
        aria-label="Close event details"
        onClick={() => dialog.current.close()}
      >
        ×
      </button>
      <h2>{event.title}</h2>
      <section>
        <h3>Club</h3>
        <ExternalLink href={event.club_info?.url}>
          {event.club_info?.name}
        </ExternalLink>
      </section>
      <section>
        <h3>
          Event {event.joined && <span className="joined-badge">✓ Joined</span>}
        </h3>
        <ExternalLink href={event.strava_event_url}>{event.title}</ExternalLink>
        <dl>
          {[
            [
              "When",
              new Date(event.start_date).toLocaleString("en-US", {
                dateStyle: "full",
                timeStyle: "short",
              }),
            ],
            ["Where", event.address],
            ["Terrain", event.terrain_label],
            ["Skill", event.skill_level_label],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
        </dl>
      </section>
      {event.route_info && (
        <section>
          <h3>Route</h3>
          <ExternalLink
            href={
              event.route_info.url ||
              (event.route_info.id &&
                `https://www.strava.com/routes/${encodeURIComponent(event.route_info.id)}`)
            }
          >
            {event.route_info.name || "Route"}
          </ExternalLink>
          <dl>
            {[
              ["Distance", event.route_info.distance],
              ["Elevation gain", event.route_info.elevation_gain],
              ["Moving time", event.route_info.estimated_moving_time],
              ["Maximum slope", event.route_info.max_slope],
            ]
              .filter(([, value]) => value && value !== "N/A")
              .map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
          </dl>
        </section>
      )}
    </dialog>,
    document.body,
  );
}
