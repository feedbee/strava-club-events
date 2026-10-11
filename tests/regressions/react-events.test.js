import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEventsResponse,
  filterEvents,
  readEvents,
  indexByDate,
} from "../../frontend/src/data/events.js";
test("React event identity survives reorder and preserves simultaneous starts", () => {
  const source = [
    {
      occurrence_id: "a",
      title: "One",
      start_date: "2026-10-10T09:30:00",
      club_info: { id: 1 },
    },
    {
      occurrence_id: "b",
      title: "Two",
      start_date: "2026-10-10T09:30:00",
      club_info: { id: 1 },
    },
  ];
  const a = normalizeEventsResponse({ events: source, clubs: [] });
  const b = normalizeEventsResponse({
    events: [...source].reverse(),
    clubs: [],
  });
  assert.equal(a.events[0].key, b.events[1].key);
  assert.equal(indexByDate(a.events).get("2026-10-10").length, 2);
});
test("React filters combine joined, sport and club without mutating data", () => {
  const data = normalizeEventsResponse([
    {
      occurrence_id: "1",
      start_date: "2026-10-10",
      joined: true,
      club_info: { id: 1, sport_type: "cycling" },
    },
    {
      occurrence_id: "2",
      start_date: "2026-10-10",
      joined: false,
      club_info: { id: 2, sport_type: "hiking" },
    },
  ]);
  assert.equal(
    filterEvents(data.events, {
      joinedOnly: true,
      clubs: ["1"],
      sports: ["cycling"],
    }).length,
    1,
  );
  assert.equal(data.events.length, 2);
});
test("React events API preserves errors and rejects invalid response shapes", async () => {
  await assert.rejects(
    readEvents(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ retry_after: 60 }),
    })),
    (error) => error.status === 429 && error.retryAfter === 60,
  );
  assert.throws(() => normalizeEventsResponse({ events: null }), /Invalid/);
  assert.throws(
    () => normalizeEventsResponse([{ start_date: "invalid" }]),
    /Invalid/,
  );
});

test('sport filtering resolves sport types from the real club catalog', () => {
  const events = [
    { club_info: { id: 1, name: 'Cyclists' } },
    { club_info: { id: 2, name: 'Runners' } },
  ];
  const clubs = [{ id: 1, sport_type: 'cycling' }, { id: 2, sport_type: 'running' }];
  assert.deepEqual(filterEvents(events, { sports: ['cycling'] }, clubs), [events[0]]);
});
