import React from "react";
import { dateKey } from "../data/events.js";

export function CalendarDate({ date, long = false }) {
  return (
    <time dateTime={dateKey(date)}>
      {date.toLocaleDateString("en-US", { weekday: long ? "long" : "short" })}, {" "}
      <strong>{date.toLocaleDateString("en-US", { month: long ? "long" : "short", day: "numeric" })}</strong>
    </time>
  );
}
