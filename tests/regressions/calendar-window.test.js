import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingOccurrences } from '../../src/utils/occurrences.js';
import { calendarBounds, clampCalendarDate } from '../../frontend/src/data/calendar-window.js';

test('events include day 90 but exclude later instants and past dates', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const dates = [-1, 30, 89, 90, 91].map(days => new Date(+now + days * 86400000).toISOString());
  assert.deepEqual(upcomingOccurrences(dates, now).map(date => date.toISOString()), dates.slice(1, 4));
});
test('calendar bounds cover previous month through three complete future months across years', () => {
  const bounds = calendarBounds(new Date(2026, 9, 11, 12));
  assert.equal(bounds.start.getMonth(), 8);
  assert.equal(bounds.start.getDate(), 1);
  assert.equal(bounds.end.getFullYear(), 2027);
  assert.equal(bounds.end.getMonth(), 0);
  assert.equal(bounds.end.getDate(), 31);
  assert.equal(+clampCalendarDate(new Date(2020, 0, 1), bounds), +bounds.start);
  assert.equal(+clampCalendarDate(new Date(2030, 0, 1), bounds), +bounds.end);
});
