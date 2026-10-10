import React, { useState } from "react";

export function ClubLogo({ event }) {
  const [failed, setFailed] = useState(false);
  const logo = /^https:\/\//.test(event.club_info?.logo || "")
    ? event.club_info.logo
    : [
        "/prototypes/calendar/images/demo-club-road.svg",
        "/prototypes/calendar/images/demo-club-gravel.svg",
      ].includes(event.demo_logo)
      ? event.demo_logo
      : null;
  return logo && !failed ? (
    <img src={logo} alt={event.club_info?.name || "Club"} onError={() => setFailed(true)} />
  ) : (
    <span className="club-initial" aria-label={event.club_info?.name || "Club"}>
      {(event.club_info?.name || "?").slice(0, 1)}
    </span>
  );
}
