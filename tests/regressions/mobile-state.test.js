import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSnapshot, restoreSnapshot, filterCoverage, periodDays, movePeriod, timeSlots, calendarEvent } from '../../shared/mobile-state.js';
const filters = { clubs: ['1'], sports: [], joinedOnly: false };
const data = { events: [{ key: '1', occurrence_id: '1', title: 'Ride', start_date: '2026-10-26T10:00:00Z',
  strava_event_url: 'https://www.strava.com/clubs/1/group_events/1', club_info: { id: '1', name: 'Club' } }], clubs: [], meta: null };
test('Offline snapshots reject other accounts, backend, expired, corrupt and oversized data', () => {
  const context = { account: 'a', backend: 'https://server.test', filters };
  const text = makeSnapshot(data, context, 1000);
  assert.equal(restoreSnapshot(text, context, 2000).data.events.length, 1);
  assert.equal(restoreSnapshot(text, { ...context, account: 'b' }, 2000), null);
  assert.equal(restoreSnapshot(text, { ...context, backend: 'https://other.test' }, 2000), null);
  assert.equal(restoreSnapshot(text, context, 86401001), null);
  for (const bad of ['no json', '{}', 'x'.repeat(2100000)]) assert.equal(restoreSnapshot(bad, context), null);
  assert.equal(makeSnapshot({ ...data, huge: 'x'.repeat(2100000) }, context), null);
});
test('Offline filter coverage never treats a restricted response as all clubs', () => {
  assert.equal(filterCoverage(filters, { ...filters, clubs: [] }), false);
  assert.equal(filterCoverage(filters, { ...filters, clubs: ['2'] }), false);
  assert.equal(filterCoverage(filters, { ...filters, joinedOnly: true }), true);
  assert.equal(filterCoverage({ clubs: [], sports: [] }, filters), true);
  assert.equal(filterCoverage({ clubs: [], sports: ['cycling'] }, { clubs: [], sports: [] }), false);
});
test('Month/year navigation clamps dates and week/day use local calendar arithmetic', () => {
  const next = movePeriod(new Date(2026, 0, 31, 12), 'month', 1);
  assert.equal(next.getMonth(), 1); assert.equal(next.getDate(), 28);
  const days = periodDays(new Date(2026, 9, 26, 12), 'week');
  assert.equal(days.length, 7); assert.equal(days[0].getDay(), 1);
  assert.equal(periodDays(new Date(), 'day').length, 1);
});
test('Simultaneous event cards occupy separate lanes and export has editable placeholder end', () => {
  const events = [data.events[0], { ...data.events[0], key: '2' }];
  const slots = timeSlots(events);
  assert.equal(slots[0].columns, 2); assert.notEqual(slots[0].column, slots[1].column);
  const exported = calendarEvent(events[0]);
  assert.equal(+exported.endDate - +exported.startDate, 3600000);
  assert.match(exported.notes, /Duration is a placeholder/);
  assert.equal(exported.recurrenceRule, undefined);
});
test('Valid JSON snapshots reject corrupt club and nested event fields before rendering', () => {
  const context = { account: 'a', backend: 'https://server.test', filters };
  for (const broken of [
    { ...data, clubs: [null] }, { ...data, clubs: [{ id: '1', name: {} }] },
    { ...data, events: [{ ...data.events[0], club_info: { id: '1', name: {} } }] },
    { ...data, events: [{ ...data.events[0], route_info: { name: {} } }] },
    { ...data, events: [{ ...data.events[0], address: {} }] },
  ]) assert.equal(restoreSnapshot(makeSnapshot(broken, context, 1000), context, 2000), null);
});
test('Capped and partial snapshots cannot claim coverage for omitted or failed clubs', () => {
  const clubs = Array.from({ length: 26 }, (_, i) => ({ id: String(i + 1), name: `Club ${i + 1}`, sport_type: 'cycling' }));
  const saved = { clubs: [], sports: [] };
  const capped = { clubs, meta: { clubs_limited: true, clubs_processed: 25 } };
  assert.equal(filterCoverage(saved, { clubs: ['26'], sports: [] }, capped), false);
  assert.equal(filterCoverage(saved, { clubs: ['1'], sports: [] }, capped), true);
  assert.equal(filterCoverage(saved, saved, capped), false);
  const partial = { clubs, meta: { errors: [{ club_id: '1' }] } };
  assert.equal(filterCoverage(saved, { clubs: ['1'], sports: [] }, partial), false);
});
