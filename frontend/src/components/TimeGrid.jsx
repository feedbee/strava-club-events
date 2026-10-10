import React, { useLayoutEffect, useRef } from "react";
import { dateKey } from "../data/events.js";
import { EventCard } from "./EventCard.jsx";
export function TimeGrid({ date, mode, days, onOpen }) {
  const root = useRef(null);
  const dates = Array.from({ length: mode === "week" ? 7 : 1 }, (_, index) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    if (mode === "week")
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + index);
    return d;
  });
  useLayoutEffect(() => {
    const row = root.current.querySelector('[data-hour="7"]');
    if (row)
      root.current.scrollTop +=
        row.getBoundingClientRect().top -
        root.current.getBoundingClientRect().top -
        root.current.querySelector(".time-grid-heading").offsetHeight;
  }, [date, mode]);
  return (
    <div
      className={`time-grid ${mode}`}
      ref={root}
      tabIndex={0}
      aria-label="Scroll hourly calendar"
      style={{ "--day-columns": dates.length }}
    >
      <div className="time-grid-heading">
        <span />
        {dates.map((d) => (
          <h3
            key={dateKey(d)}
            className={dateKey(d) === dateKey(new Date()) ? "time-today" : ""}
          >
            <time dateTime={dateKey(d)}>
              {d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </time>
          </h3>
        ))}
      </div>
      {Array.from({ length: 24 }, (_, hour) => (
        <div className="time-grid-row" key={hour} data-hour={hour}>
          <time className="hour-label">{String(hour).padStart(2, "0")}:00</time>
          {dates.map((d) => (
            <div
              className="time-slot"
              key={dateKey(d)}
              data-date={dateKey(d)}
              data-time={`${hour}:00`}
            >
              {(days.get(dateKey(d)) || [])
                .filter(
                  (event) => new Date(event.start_date).getHours() === hour,
                )
                .map((event) => (
                  <EventCard key={event.key} event={event} onOpen={onOpen} />
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
