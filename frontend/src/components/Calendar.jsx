import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { calendarBounds, clampCalendarDate } from "../data/calendar-window.js";
import { dateKey, indexByDate } from "../data/events.js";
import { movePeriod } from "../../../shared/mobile-state.js";
import { CalendarDatePicker, eventCountLabel } from "./CalendarDatePicker.jsx";
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
  const compactMonth = narrow && mode === "month";
  const dayMode = mode === "day";
  const continuousMonth = mode === "month" && !narrow;
  const navigationMode = dayMode ? "week" : mode;
  const previousDate = continuousMonth
    ? new Date(date.getFullYear(), date.getMonth() - 1, 1, 12)
    : movePeriod(date, navigationMode, -1);
  const nextDate = continuousMonth
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1, 12)
    : movePeriod(date, navigationMode, 1);
  function periodKey(value) {
    if (mode === "month") return dateKey(value).slice(0, 7);
    return dateKey(navigationMode === "week" ? monday(value) : value);
  }
  const atStart = periodKey(date) === periodKey(bounds.start);
  const atEnd = periodKey(date) === periodKey(bounds.end);
  const [expanded, setExpanded] = useState(new Set());
  const agendaViewport = useRef(null);
  const viewport = useRef(null),
    pendingDate = useRef(null),
    programmaticScroll = useRef(false);
  const days = useMemo(() => indexByDate(events), [events]);
  const wasContinuous = useRef(false);
  const today = dateKey(new Date());
  const selectedKey = dateKey(date);
  const selectedEvents = days.get(selectedKey) || [];
  useLayoutEffect(() => {
    if (!continuousMonth) {
      programmaticScroll.current = false;
      wasContinuous.current = false;
      return;
    }
    const position = !wasContinuous.current || pendingDate.current;
    wasContinuous.current = true;
    if (viewport.current && position) {
      const target = viewport.current.querySelector(
        `[data-date="${pendingDate.current || selectedKey}"]`,
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
  }, [continuousMonth, date, selectedKey]);
  function navigate(next) {
    const target = clampCalendarDate(next, bounds);
    if (continuousMonth) pendingDate.current = dateKey(target);
    setDate(target);
  }
  function navigatePeriod(next) {
    if (agendaViewport.current) agendaViewport.current.scrollTop = 0;
    navigate(next);
  }
  function scroll() {
    if (!continuousMonth) return;
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
    const detailed = mode === "list" || compactMonth;
    const showAll = detailed || expanded.has(key);
    return (
      <section
        className={`calendar-day ${key === today ? "current-day" : ""}`}
        key={key}
        data-date={key}
      >
        <h3 className={detailed ? "agenda-date" : undefined}>
          <CalendarDate date={new Date(key + "T12:00:00")} long={detailed} />
        </h3>
        <div className="day-events">
          {(showAll ? entries : entries.slice(0, 5)).map((event) => (
            <EventCard key={event.key} event={event} onOpen={onOpen} detailed={detailed} />
          ))}
        </div>
        {continuousMonth && entries.length > 5 && (
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
  const weekdayHeading = (
    <div className="calendar-weekdays">
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((name) => (
        <span key={name}>{compactMonth ? name.slice(0, 3) : name}</span>
      ))}
    </div>
  );
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
                if (value === "month" && !narrow) pendingDate.current = dateKey(date);
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
        {!dayMode && <h2>
          {mode !== "list"
            ? date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            : "Upcoming events"}
        </h2>}
        {mode !== "list" && (
          <div className="calendar-navigation">
            <button
              className="control"
              disabled={atStart}
              aria-label={`Previous ${navigationMode}`}
              onClick={() => navigatePeriod(previousDate)}
            >
              ←
            </button>
            <button className="control" onClick={() => navigatePeriod(new Date())}>
              Today
            </button>
            <button
              className="control"
              disabled={atEnd}
              aria-label={`Next ${navigationMode}`}
              onClick={() => navigatePeriod(nextDate)}
            >
              →
            </button>
          </div>
        )}
      </div>
      {dayMode && (
        <>
          <CalendarDatePicker date={date} mode={mode} days={days} bounds={bounds} onSelect={navigate} />
          <div className="day-strip-heading">
            <h2>{date.toLocaleDateString("en-GB", { dateStyle: "full" })}</h2>
            <p>{eventCountLabel(selectedEvents.length)}</p>
          </div>
        </>
      )}
      {continuousMonth && weekdayHeading}
      {mode === "week" || mode === "day" ? (
        <TimeGrid date={date} mode={mode} days={days} onOpen={onOpen} bounds={bounds} />
      ) : compactMonth ? (
        <div key="month-agenda" ref={agendaViewport} className="calendar-viewport month-agenda" tabIndex={0} aria-label="Scroll month agenda">
          {weekdayHeading}
          <CalendarDatePicker date={date} mode={mode} days={days} bounds={bounds} onSelect={navigate} />
          {day(selectedKey, selectedEvents)}
          {!selectedEvents.length && <p className="calendar-empty">No events on this date</p>}
        </div>
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
