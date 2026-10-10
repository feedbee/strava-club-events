import test from 'node:test';
import assert from 'node:assert/strict';
import { eventWarnings } from '../../frontend/src/data/event-warnings.js';
import { readEvents } from '../../frontend/src/data/events.js';
test('partial routes and capped clubs remain visible as separate warnings', () => {
  const warnings = eventWarnings({ clubs_limited: true, clubs_processed: 10, clubs_total: 12, routes_failed: 2 });
  assert.equal(warnings.length, 2);
  assert.match(warnings.join(' '), /10 of 12 clubs/);
  assert.match(warnings.join(' '), /2 routes/);
  assert.equal(eventWarnings(null).length, 0);
  assert.equal(eventWarnings({ clubs_limited: true }, ['12']).length, 0);
});
test('selected clubs and sports are requested from the backend', async () => {
  await readEvents(async (url) => {
    const query = new URL(url, 'http://localhost').searchParams;
    assert.equal(query.get('clubs'), '11,12');
    assert.equal(query.get('sportTypes'), 'cycling');
    return { ok: true, json: async () => ({ events: [], clubs: [] }) };
  }, undefined, { clubs: ['11', '12'], sports: ['cycling'] });
});
