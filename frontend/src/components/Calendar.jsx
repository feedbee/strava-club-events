import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { calendarBounds, clampCalendarDate } from "../data/calendar-window.js";
import { dateKey, indexByDate } from "../data/events.js";
import { CalendarDate } from "./CalendarDate.jsx";
import { Icon } from "./Icon.jsx";
import { TimeGrid } from "./TimeGrid.jsx";
import { EventCard } from "./EventCard.jsx";
function shift(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function monday(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return shift(d, -((d.getDay() + 6) % 7));
}
export function Calendar({
  events,
  onOpen,
  initialMode = "month",
  onModeChange,
}) {
  const [mode, setMode] = useState(() =>
    initialMode === "week" && matchMedia("(max-width: 999px)").matches
      ? "month"
      : initialMode,
  );
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 999px)").matches,
  );
  useEffect(() => {
    const breakpoint = matchMedia("(max-width: 999px)");
    function resize() {
      setNarrow(breakpoint.matches);
      if (breakpoint.matches)
        setMode((current) => (current === "week" ? "month" : current));
    }
    breakpoint.addEventListener("change", resize);
    return () => breakpoint.removeEventListener("change", resize);
  }, []);
  const [date, setDate] = useState(new Date());
  const bounds = calendarBounds();
  const rangeStart = monday(bounds.start);
  const rangeEnd = shift(monday(bounds.end), 6);
  const rangeDays = Math.round((rangeEnd - rangeStart) / 86400000) + 1;
  const previousDate = mode === "month"
    ? new Date(date.getFullYear(), date.getMonth() - 1, 1, 12)
    : shift(date, mode === "week" ? -7 : -1);
  const nextDate = mode === "month"
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1, 12)
    : shift(date, mode === "week" ? 7 : 1);
  const atStart = mode === "month"
    ? date.getFullYear() === bounds.start.getFullYear() && date.getMonth() === bounds.start.getMonth()
    : mode === "week" ? monday(date) <= bounds.start : date <= bounds.start;
  const atEnd = mode === "month"
    ? date.getFullYear() === bounds.end.getFullYear() && date.getMonth() === bounds.end.getMonth()
    : mode === "week" ? shift(monday(date), 6) >= bounds.end : date >= bounds.end;
  const [expanded, setExpanded] = useState(new Set());
  const viewport = useRef(null),
    pendingDate = useRef(dateKey(new Date())),
    programmaticScroll = useRef(false);
  const days = useMemo(() => indexByDate(events), [events]);
  const today = dateKey(new Date());
  useLayoutEffect(() => {
    if (viewport.current && pendingDate.current) {
      const target = viewport.current.querySelector(
        `[data-date="${pendingDate.current}"]`,
      );
      if (target) {
        const previousTop = viewport.current.scrollTop;
        viewport.current.scrollTop =
          target.offsetTop -
          viewport.current.querySelector(".calendar-days").offsetTop;
        // No scroll event is emitted when positioning leaves the offset unchanged.
        programmaticScroll.current = viewport.current.scrollTop !== previousTop;
      }
      pendingDate.current = null;
    }
  }, [mode, date]);
  function navigate(next) {
    const target = clampCalendarDate(next, bounds);
    pendingDate.current = dateKey(target);
    setDate(target);
  }
  function scroll() {
    if (mode !== "month") return;
    if (programmaticScroll.current) {
      programmaticScroll.current = false;
      return;
    }
    const element = viewport.current;
    const visible = [...element.querySelectorAll("[data-date]")].find(
      (day) =>
        day.getBoundingClientRect().bottom >
        element.getBoundingClientRect().top + 4,
    );
    if (!visible) return;
    const visibleDate = new Date(visible.dataset.date + "T12:00:00");
    if (
      visibleDate.getMonth() !== date.getMonth() ||
      visibleDate.getFullYear() !== date.getFullYear()
    )
      setDate(visibleDate);
  }
  function day(key, entries) {
    const showAll = mode === "list" || expanded.has(key);
    return (
      <section
        className={`calendar-day ${key === today ? "current-day" : ""}`}
        key={key}
        data-date={key}
      >
        <h3>
          <CalendarDate date={new Date(key + "T12:00:00")} long={mode === "list" || narrow} />
        </h3>
        <div className="day-events">
          {(showAll ? entries : entries.slice(0, 5)).map((event) => (
            <EventCard key={event.key} event={event} onOpen={onOpen} />
          ))}
        </div>
        {mode === "month" && entries.length > 5 && (
          <button
            className="day-overflow"
            onClick={() =>
              setExpanded((previous) => {
                const next = new Set(previous);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })
            }
          >
            {showAll ? "Show less" : `+ ${entries.length - 5} more`}
          </button>
        )}
      </section>
    );
  }
  return (
    <section className={`react-calendar ${mode}`} aria-label="Event calendar">
      <div className="calendar-toolbar">
        <div className="calendar-modes">
          {(narrow
            ? ["month", "day", "list"]
            : ["month", "week", "day", "list"]
          ).map((value) => (
            <button
              key={value}
              className={`control ${mode === value ? "primary" : ""}`}
              aria-pressed={mode === value}
              onClick={() => {
                if (value === mode) return;
                if (value === "month") pendingDate.current = dateKey(date);
                setMode(value);
                onModeChange?.(value);
                if (value === "list" && viewport.current) viewport.current.scrollTop = 0;
              }}
            >
              <Icon name={value} size={14} />
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <h2>
          {mode !== "list"
            ? date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                ...(mode === "day" ? { day: "numeric" } : {}),
              })
            : "Upcoming events"}
        </h2>
        {mode !== "list" && (
          <div className="calendar-navigation">
            <button
              className="control"
              disabled={atStart}
              aria-label={`Previous ${mode}`}
              onClick={() => navigate(previousDate)}
            >
              ←
            </button>
            <button className="control" onClick={() => navigate(new Date())}>
              Today
            </button>
            <button
              className="control"
              disabled={atEnd}
              aria-label={`Next ${mode}`}
              onClick={() => navigate(nextDate)}
            >
              →
            </button>
          </div>
        )}
      </div>
      {mode === "month" && (
        <div className="calendar-weekdays">
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
      {mode === "week" || mode === "day" ? (
        <TimeGrid date={date} mode={mode} days={days} onOpen={onOpen} bounds={bounds} />
      ) : (
        <div
          className="calendar-viewport"
          ref={viewport}
          onScroll={scroll}
          tabIndex={0}
          aria-label="Scroll calendar"
        >
          <div className="calendar-days">
            {mode === "month"
              ? Array.from({ length: rangeDays }, (_, index) => {
                  const key = dateKey(shift(rangeStart, index));
                  if (key < dateKey(bounds.start) || key > dateKey(bounds.end))
                    return <div key={key} className="calendar-padding" aria-hidden="true" />;
                  return day(key, days.get(key) || []);
                })
              : [...days].map(([key, entries]) => day(key, entries))}
          </div>
          {mode === "list" && !events.length && (
            <p className="calendar-empty">No matching events</p>
          )}
        </div>
      )}
    </section>
  );
}
