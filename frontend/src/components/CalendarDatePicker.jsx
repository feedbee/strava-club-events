import React from "react";
import { dateKey } from "../data/events.js";
import { periodDays } from "../../../shared/mobile-state.js";

const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

export function eventCountLabel(count) {
  return `${count} ${count === 1 ? "event" : "events"}`;
}

export function CalendarDatePicker({ date, mode, days, bounds, onSelect }) {
  const month = mode === "month";
  const dates = periodDays(date, month ? "month" : "week");
  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(date);

  return (
    <div className={`calendar-date-picker ${month ? "month-picker" : "week-strip"}`}
      role="group" aria-label={month ? "Choose a date this month" : "Choose a day this week"}>
      {dates.map((day) => {
        const key = dateKey(day);
        const today = key === todayKey;
        const count = days.get(key)?.length || 0;
        return (
          <button type="button" key={key}
            className={day.getMonth() !== date.getMonth() && month ? "outside-month" : undefined}
            disabled={day < bounds.start || day > bounds.end}
            aria-current={today ? "date" : undefined}
            aria-pressed={key === selectedKey}
            aria-label={month ? `${fullDate.format(day)}, ${eventCountLabel(count)}` : fullDate.format(day)}
            onClick={() => onSelect(day)}>
            {!month && <span className="picker-weekday">{weekday.format(day)}</span>}
            <span className="picker-date-number">{day.getDate()}</span>
            {month && <span className="picker-date-count">{count > 0 && eventCountLabel(count)}</span>}
          </button>
        );
      })}
    </div>
  );
}
