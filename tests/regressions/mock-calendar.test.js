import test from "node:test";
import assert from "node:assert/strict";
import {
  createMockDataset,
  filterMockDataset,
} from "../../prototypes/calendar/backend/fixtures.js";

test("mock scenarios are reproducible and preserve dense simultaneous occurrences", () => {
  const date = new Date("2026-10-10T12:00:00Z");
  const a = createMockDataset("dense", date);
  assert.deepEqual(a, createMockDataset("dense", date));
  assert.equal(a.events.length, 84);
  assert.equal(new Set(a.events.map((e) => e.occurrence_id)).size, 84);
  assert.ok(a.events.some((e) => !e.joined));
  assert.equal(
    a.events.filter((e) => e.start_date === a.events[1].start_date).length,
    3,
  );
});
test("mock filtering retains the club catalogue and does not mutate fixtures", () => {
  const data = createMockDataset("dense");
  const filtered = filterMockDataset(data, {
    clubs: "1",
    sportTypes: "cycling",
  });
  assert.equal(filtered.events.length, 42);
  assert.equal(filtered.clubs.length, 2);
  assert.equal(data.events.length, 84);
  assert.equal(filterMockDataset(data, { clubs: "999" }).events.length, 0);
});
test("mock edge cases include absent routes, missing logos and empty results", () => {
  assert.equal(createMockDataset("empty").events.length, 0);
  const missing = createMockDataset("missing");
  assert.ok(missing.events.some((e) => !e.route_info));
  assert.ok(missing.events.some((e) => !e.demo_logo));
  assert.throws(() => createMockDataset("unknown"), /Unknown/);
});

test('mock boundary and club scenarios cover navigation and selection limits', () => {
  const data=createMockDataset('boundaries',new Date(2026,9,10,12));
  assert.equal(data.events.length,5);
  assert.equal(new Date(data.events[0].start_date).getMonth(),8);
  assert.equal(new Date(data.events.at(-1).start_date).getFullYear(),2027);
  assert.equal(new Date(data.events[1].start_date).getMinutes(),5);
  const clubs=createMockDataset('clubs');
  assert.equal(clubs.clubs.length,12);
  assert.equal(new Set(clubs.events.map(event=>event.club_info.id)).size,12);
});
