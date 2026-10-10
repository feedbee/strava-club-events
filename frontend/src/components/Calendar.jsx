import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { dateKey, indexByDate } from "../data/events.js";
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
function initialRange(date) {
  return {
    start: shift(
      monday(new Date(date.getFullYear(), date.getMonth(), 1, 12)),
      -7,
    ),
    weeks: 8,
  };
}
export function Calendar({ events, onOpen }) {
  const [mode, setMode] = useState("month");
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
  const [range, setRange] = useState(() => initialRange(new Date()));
  const [expanded, setExpanded] = useState(new Set());
  const viewport = useRef(null),
    anchor = useRef(null),
    pendingDate = useRef(dateKey(new Date()));
  const days = useMemo(() => indexByDate(events), [events]);
  const today = dateKey(new Date());
  useLayoutEffect(() => {
    if (viewport.current && pendingDate.current) {
      const target = viewport.current.querySelector(
        `[data-date="${pendingDate.current}"]`,
      );
      if (target)
        viewport.current.scrollTop =
          target.offsetTop -
          viewport.current.querySelector(".calendar-days").offsetTop;
      pendingDate.current = null;
    }
    if (!viewport.current || !anchor.current) return;
    const { key, top } = anchor.current;
    const element = viewport.current.querySelector(`[data-date="${key}"]`);
    if (element)
      viewport.current.scrollTop += element.getBoundingClientRect().top - top;
    anchor.current = null;
  }, [range]);
  function navigate(next) {
    pendingDate.current = dateKey(next);
    setDate(next);
    setRange(initialRange(next));
  }
  function scroll() {
    if (mode !== "month") return;
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
    const atTop = element.scrollTop < 80,
      atBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight < 200;
    if (!atTop && !atBottom) return;
    anchor.current = {
      key: visible.dataset.date,
      top: visible.getBoundingClientRect().top,
    };
    // Do not remove a week containing keyboard focus while trimming the window.
    const focusedDate =
      document.activeElement.closest?.("[data-date]")?.dataset.date;
    if (range.weeks >= 24 && focusedDate) {
      const nextStart = atTop
        ? shift(range.start, -28)
        : shift(range.start, 28);
      if (
        focusedDate < dateKey(nextStart) ||
        focusedDate > dateKey(shift(nextStart, 167))
      ) {
        anchor.current = null;
        return;
      }
    }
    setRange((previous) => ({
      start: atTop
        ? shift(previous.start, -28)
        : previous.weeks >= 24
          ? shift(previous.start, 28)
          : previous.start,
      weeks: Math.min(24, previous.weeks + 4),
    }));
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
          <time dateTime={key}>
            {new Date(key + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </time>
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
                setMode(value);
                if (viewport.current) viewport.current.scrollTop = 0;
              }}
            >
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
              aria-label={`Previous ${mode}`}
              onClick={() =>
                navigate(
                  mode === "month"
                    ? new Date(date.getFullYear(), date.getMonth() - 1, 1, 12)
                    : shift(date, mode === "week" ? -7 : -1),
                )
              }
            >
              ←
            </button>
            <button className="control" onClick={() => navigate(new Date())}>
              Today
            </button>
            <button
              className="control"
              aria-label={`Next ${mode}`}
              onClick={() =>
                navigate(
                  mode === "month"
                    ? new Date(date.getFullYear(), date.getMonth() + 1, 1, 12)
                    : shift(date, mode === "week" ? 7 : 1),
                )
              }
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
        <TimeGrid date={date} mode={mode} days={days} onOpen={onOpen} />
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
              ? Array.from({ length: range.weeks * 7 }, (_, index) => {
                  const key = dateKey(shift(range.start, index));
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
