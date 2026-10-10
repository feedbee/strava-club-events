import { buildRideCard } from "./event-card.js";
import { createEventDialog } from "./event-dialog.js";
import { createEventPreview } from "./event-preview.js";
import { indexCalendarEvents } from "./calendar-data.js";
import { getLocalDateKey } from "../../../js/event-list.js";

export function weekStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
function shift(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function mountContinuousCalendar(
  events,
  { transformEventsForCalendar, calendarElement, showCalendar },
) {
  let data = transformEventsForCalendar(events),
    start,
    end,
    visibleDate = new Date(),
    mode = "month";
  const expandedDays = new Set();
  let eventIndex = indexCalendarEvents(data);
  const eventsOn = (key) => eventIndex.days.get(key) || [];
  const cardHtml = (event) =>
    buildRideCard(event, eventIndex.positions.get(event));
  function replaceEvents(events) {
    data = events;
    eventIndex = indexCalendarEvents(data);
  }
  calendarElement.innerHTML = `<div class="journey-toolbar"><h2 id="journey-month"></h2><div class="journey-modes" aria-label="Calendar mode"><button type="button" data-mode="month" aria-pressed="true">Month</button><button type="button" data-mode="week" aria-pressed="false">Week</button><button type="button" data-mode="day" aria-pressed="false">Day</button><button type="button" data-mode="list" aria-pressed="false">List</button></div><div class="journey-navigation"><button type="button" data-nav="prev" aria-label="Previous month">←</button><button type="button" data-nav="today">Today</button><button type="button" data-nav="next" aria-label="Next month">→</button></div></div><div class="weekday-row">${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => `<span>${d}</span>`).join("")}</div><div class="journey-scroll" tabindex="0" aria-label="Calendar, scroll to explore weeks"><div class="journey-weeks"></div></div>`;
  const viewport = calendarElement.querySelector(".journey-scroll"),
    weeks = calendarElement.querySelector(".journey-weeks"),
    title = calendarElement.querySelector("#journey-month");
  const eventDialog = createEventDialog();
  function openDetails(e) {
    const more = e.target.closest("[data-more-date]");
    if (more) {
      const key = more.dataset.moreDate;
      const cell = more.closest(".journey-day");
      if (expandedDays.has(key)) {
        expandedDays.delete(key);
        [...cell.querySelectorAll(".ride")]
          .slice(5)
          .forEach((card) => card.remove());
        more.textContent = `+ ${eventsOn(key).length - 5} more`;
        more.setAttribute("aria-expanded", "false");
      } else {
        expandedDays.add(key);
        const extra = eventsOn(key).slice(5);
        more.insertAdjacentHTML("beforebegin", extra.map(cardHtml).join(""));
        more.textContent = "Show less";
        more.setAttribute("aria-expanded", "true");
      }
      more.focus();
      return;
    }
    const card = e.target.closest("[data-ride-index]");
    if (!card) return;
    const originalCard = preview.sourceCard || card;
    preview.hide();
    const event = data[Number(card.dataset.rideIndex)];
    if (event) eventDialog.open(event, originalCard);
  }
  const preview = createEventPreview({
    container: weeks,
    viewport,
    getEvent: (index) => data[index],
    onOpen: (card) => openDetails({ target: card }),
    isDialogOpen: eventDialog.isOpen,
  });
  weeks.addEventListener("click", openDetails);
  function weekHtml(date) {
    let html = '<section class="journey-week">';
    for (let i = 0; i < 7; i++) {
      const d = shift(date, i),
        key = getLocalDateKey(d);
      const dayEvents = eventsOn(key);
      const limit = expandedDays.has(key) ? dayEvents.length : 5;
      html += `<div class="journey-day${key === getLocalDateKey(new Date()) ? " is-today" : ""}" data-date="${key}"><div class="day-label"><time datetime="${key}">${d.toLocaleDateString("en-US", { weekday: "short" })}, <strong>${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></time></div>${dayEvents.slice(0, limit).map(cardHtml).join("")}${dayEvents.length > 5 ? `<button type="button" class="day-more" data-more-date="${key}" aria-expanded="${expandedDays.has(key)}">${expandedDays.has(key) ? "Show less" : `+ ${dayEvents.length - 5} more`}</button>` : ""}</div>`;
    }
    return html + "</section>";
  }
  function label() {
    if (mode === "week" || mode === "day" || mode === "list") return;
    const top = viewport.getBoundingClientRect().top;
    const visible = [...weeks.querySelectorAll(".journey-day")].find(
      (el) => el.getBoundingClientRect().bottom > top + 8,
    );
    if (visible) {
      visibleDate = new Date(visible.dataset.date + "T12:00:00");
      title.textContent = visibleDate.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
    }
  }
  function go(date) {
    const narrow = window.matchMedia("(max-width: 999px)").matches;
    if (narrow && mode === "week") mode = "month";
    calendarElement.querySelectorAll("[data-mode]").forEach((button) => {
      button.hidden = narrow && button.dataset.mode === "week";
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    preview.hide();
    visibleDate = new Date(date);
    calendarElement.dataset.mode = mode;
    for (const direction of ["prev", "next"])
      calendarElement
        .querySelector(`[data-nav="${direction}"]`)
        .setAttribute(
          "aria-label",
          `${direction === "prev" ? "Previous" : "Next"} ${mode === "list" ? "month" : mode}`,
        );
    calendarElement.querySelector(".weekday-row").hidden = mode !== "month";
    calendarElement.querySelector(".journey-navigation").hidden =
      mode === "list";
    if (mode === "list") {
      title.textContent = "Upcoming events";
      const dates = [...eventIndex.days.keys()].sort();
      weeks.innerHTML =
        dates
          .map((key) => {
            const d = new Date(key + "T12:00:00");
            const dayEvents = eventsOn(key);
            return `<section class="journey-day${key === getLocalDateKey(new Date()) ? " is-today" : ""}" data-date="${key}"><div class="day-label"><time>${d.toLocaleDateString("en-US", { weekday: "long" })}, <strong>${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong></time></div>${dayEvents.map(cardHtml).join("")}</section>`;
          })
          .join("") ||
        '<p class="list-empty" role="status">No events match your filters.</p>';
      viewport.scrollTop = 0;
      return;
    }
    if (mode === "week" || mode === "day") {
      const dates =
        mode === "day"
          ? [date]
          : Array.from({ length: 7 }, (_, i) => shift(weekStart(date), i));
      title.textContent =
        mode === "day"
          ? date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
          : `${dates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      let html = `<div class="time-grid ${mode}"><div class="time-grid-head"><span></span>${dates.map((d) => `<time><span class="${getLocalDateKey(d) === getLocalDateKey(new Date()) ? "is-current-date" : ""}">${d.toLocaleDateString("en-US", { weekday: "short" })}, <strong>${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></span></time>`).join("")}</div>`;
      for (let hour = 0; hour < 24; hour++) {
        html += `<div class="time-grid-row"><time>${String(hour).padStart(2, "0")}:00</time>${dates
          .map(
            (d) =>
              `<div class="time-slot">${eventsOn(getLocalDateKey(d))
                .filter((e) => new Date(e.start).getHours() === hour)
                .map(cardHtml)
                .join("")}</div>`,
          )
          .join("")}</div>`;
      }
      weeks.innerHTML = html + "</div>";
      viewport.scrollTop =
        weeks.querySelectorAll(".time-grid-row")[7].offsetTop - weeks.offsetTop;
      return;
    }
    start = shift(weekStart(date), -14);
    end = shift(start, 56);
    weeks.innerHTML = Array.from({ length: 8 }, (_, i) =>
      weekHtml(shift(start, i * 7)),
    ).join("");
    const target = weeks.querySelector(
      `[data-date="${getLocalDateKey(date)}"]`,
    );
    viewport.scrollTop = target.offsetTop - weeks.offsetTop;
    label();
  }
  // Bound off-screen month markup while preserving the visible scroll anchor.
  function trimWeeks(fromStart) {
    const rendered = [...weeks.querySelectorAll(":scope > .journey-week")];
    if (rendered.length <= 24) return;
    const excess = rendered.length - 24;
    const removed = fromStart
      ? rendered.slice(0, excess)
      : rendered.slice(-excess);
    // Never discard the user's current keyboard focus.
    if (removed.some((week) => week.contains(document.activeElement))) return;
    const oldHeight = viewport.scrollHeight;
    removed.forEach((week) => week.remove());
    if (fromStart) {
      start = shift(start, excess * 7);
      viewport.scrollTop -= oldHeight - viewport.scrollHeight;
    } else {
      end = shift(end, -excess * 7);
    }
  }
  viewport.addEventListener("scroll", () => {
    if (mode === "week" || mode === "day" || mode === "list") return;
    if (viewport.scrollTop < 100) {
      const height = viewport.scrollHeight;
      start = shift(start, -28);
      weeks.insertAdjacentHTML(
        "afterbegin",
        Array.from({ length: 4 }, (_, i) => weekHtml(shift(start, i * 7))).join(
          "",
        ),
      );
      viewport.scrollTop += viewport.scrollHeight - height;
      trimWeeks(false);
    }
    if (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      300
    ) {
      weeks.insertAdjacentHTML(
        "beforeend",
        Array.from({ length: 4 }, (_, i) => weekHtml(shift(end, i * 7))).join(
          "",
        ),
      );
      end = shift(end, 28);
      trimWeeks(true);
    }
    label();
  });
  calendarElement
    .querySelector(".journey-navigation")
    .addEventListener("click", (e) => {
      const direction = e.target.closest("[data-nav]")?.dataset.nav;
      if (!direction) return;
      if (direction === "today") return go(new Date());
      const step = direction === "next" ? 1 : -1;
      if (mode === "week" || mode === "day")
        return go(shift(visibleDate, step * (mode === "week" ? 7 : 1)));
      go(new Date(visibleDate.getFullYear(), visibleDate.getMonth() + step, 1));
    });
  calendarElement
    .querySelector(".journey-modes")
    .addEventListener("click", (e) => {
      const button = e.target.closest("[data-mode]");
      if (!button) return;
      mode = button.dataset.mode;
      calendarElement
        .querySelectorAll("[data-mode]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      go(visibleDate);
    });
  const icons = {
    month:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2M14 17h2"/>',
    week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v11M15 10v11M7 3v4M17 3v4"/>',
    day: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 3v4M17 3v4M8 14h8M8 17h8"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  };
  calendarElement
    .querySelectorAll("button[data-mode]")
    .forEach((button) =>
      button.insertAdjacentHTML(
        "afterbegin",
        `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[button.dataset.mode]}</svg>`,
      ),
    );
  showCalendar();
  go(new Date());
  const breakpoint = window.matchMedia("(max-width: 999px)");
  const onResize = () => go(visibleDate);
  breakpoint.addEventListener("change", onResize);
  function refresh() {
    if (mode === "week" || mode === "day" || mode === "list")
      return go(visibleDate);
    const visibleDay = [...weeks.querySelectorAll(".journey-day")].find(
      (element) =>
        element.getBoundingClientRect().bottom >
        viewport.getBoundingClientRect().top + 8,
    );
    go(
      visibleDay
        ? new Date(visibleDay.dataset.date + "T12:00:00")
        : visibleDate,
    );
  }
  return {
    updateSize: label,
    setEvents(events) {
      replaceEvents(events);
      refresh();
    },
    destroy() {
      breakpoint.removeEventListener("change", onResize);
      preview.destroy();
      eventDialog.destroy();
      calendarElement.innerHTML = "";
    },
  };
}
