import { demoEvents } from "../../../public/prototypes/calendar/js/experiment-fixtures.js";

export const SCENARIOS = {
  dense: "Many events · simultaneous starts",
  partial: "Incomplete clubs and route details",
  empty: "No events",
  missing: "Missing routes, logos and attributes",
  long: "Long international titles and club names",
  boundaries: "Month/year boundaries · midnight starts",
  clubs: "Twelve clubs · multi-select limits",
  error: "Events API unavailable (503)",
  limited: "Strava request limit (429)",
  slow: "Slow events response (2 seconds)",
};
export function createMockDataset(scenario = "dense", now = new Date()) {
  if (!Object.hasOwn(SCENARIOS, scenario))
    throw new Error("Unknown mock scenario");
  const data = demoEvents(now);
  if (scenario === "partial") data.meta = {
    clubs_total: 12, clubs_processed: 10, clubs_limited: true,
    clubs_failed: 1, routes_failed: 2, routes_skipped: 3, partial: true,
    events_limited: true, limits: { events_per_club: 100 },
  };
  if (scenario === "empty") data.events = [];
  if (scenario === "missing")
    data.events.forEach((event, index) => {
      if (index % 2 === 0) delete event.route_info;
      if (index % 3 === 0) delete event.demo_logo;
      if (index % 4 === 0) {
        delete event.address;
        delete event.terrain_label;
        delete event.skill_level_label;
      }
    });
  if (scenario === "long") {
    const name =
      "Международный велосипедный клуб · Zażółć gęślą jaźń · 東京サイクリング";
    data.clubs[0].name = name;
    data.events.forEach((event) => {
      event.title =
        "Очень длинное название мероприятия: вечерняя велопрогулка по набережной · Café & rencontre · 東京";
      if (event.club_info.id === 1) event.club_info.name = name;
    });
  }
  if (scenario === "boundaries") {
    const year = now.getFullYear(),
      month = now.getMonth();
    const dates = [
      new Date(year, month, 0, 23, 55),
      new Date(year, month, 1, 0, 5),
      new Date(year, month + 1, 1, 0, 5),
      new Date(year, 11, 31, 23, 55),
      new Date(year + 1, 0, 1, 0, 5),
    ];
    data.events = data.events
      .slice(0, dates.length)
      .map((event, index) => ({
        ...event,
        start_date: dates[index].toISOString(),
        title: `Boundary ${index + 1} · ${event.title}`,
      }));
  }
  if (scenario === "clubs") {
    data.clubs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Mock club ${index + 1}`,
      sport_type: ["cycling", "hiking", "running"][index % 3],
    }));
    data.events.forEach((event, index) => {
      event.club_info = { ...data.clubs[index % 12] };
    });
    data.meta = { clubs_total: 12, clubs_processed: 12 };
  }
  return data;
}
export function filterMockDataset(data, query) {
  const clubs = (query.clubs || "").split(",").filter(Boolean);
  const sports = (query.sportTypes || "")
    .toLowerCase()
    .split(",")
    .filter(Boolean);
  return {
    ...data,
    events: data.events.filter(
      (event) =>
        (!clubs.length || clubs.includes(String(event.club_info.id))) &&
        (!sports.length || sports.includes(event.club_info.sport_type)),
    ),
  };
}
