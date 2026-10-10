import test from "node:test";
import assert from "node:assert/strict";
import { weekStart } from "../../public/prototypes/calendar/js/continuous-calendar.js";
import { buildRideCard } from "../../public/prototypes/calendar/js/event-card.js";
test("calendar weeks begin on local Monday across month boundaries", () => {
  const d = weekStart(new Date(2026, 10, 1, 15));
  assert.equal(d.getDay(), 1);
  assert.equal(d.getDate(), 26);
  assert.equal(d.getMonth(), 9);
});
test("ride previews escape titles and omit missing route metrics", () => {
  const html = buildRideCard(
    {
      title: "<script>",
      start: "2026-10-10T10:00:00",
      extendedProps: {
        club_info: { name: "Club" },
        route_info: { distance: "N/A" },
      },
    },
    0,
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("undefined"));
  assert.ok(!html.includes("N/A"));
});
test("compact cards open external details without inserting a panel into the day", () => {
  const html = buildRideCard(
    {
      title: "Five rides fit",
      start: "2026-10-10T10:00:00",
      extendedProps: {},
    },
    4,
  );
  assert.match(html, /data-ride-index="4"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.ok(!html.includes("lv-detail-panel"));
});
test("club logo appears without a visible club name and unsafe image URLs are rejected", () => {
  const event = {
    title: "Morning event",
    start: "2026-10-10T10:00:00",
    extendedProps: {
      club_info: { name: "Road Club", logo: "https://example.com/logo.png" },
    },
  };
  const html = buildRideCard(event, 0);
  assert.match(html, /class="ride-logo"/);
  assert.match(html, /alt="Road Club"/);
  assert.ok(!html.includes(">Road Club<"));
  event.extendedProps.club_info.logo = "javascript:alert(1)";
  assert.ok(!buildRideCard(event, 0).includes("javascript:"));
});

test("date index preserves simultaneous occurrences and sorts without mutating input", async () => {
  const { indexCalendarEvents } = await import(
    "../../public/prototypes/calendar/js/calendar-data.js"
  );
  const first = { start: "2026-10-10T09:30:00", id: "one" };
  const second = { start: "2026-10-10T09:30:00", id: "two" };
  const later = { start: "2026-10-10T18:00:00", id: "three" };
  const input = [later, first, second];
  const index = indexCalendarEvents(input);
  assert.deepEqual(index.days.get("2026-10-10"), [first, second, later]);
  assert.equal(index.positions.get(first), 1);
  assert.equal(index.positions.get(second), 2);
  assert.deepEqual(input, [later, first, second]);
});
