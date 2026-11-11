import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMobileEvents, normalizeMobileUser } from '../../shared/mobile-events.js';
const event = { occurrence_id: '1:2:date', title: 'Ride', start_date: '2026-10-27T10:00:00Z',
  club_info: { id: '9007199254740999', name: 'Club' }, route_info: { id: '9007199254740998', name: 'Route', distance: '0 km' } };
test('Mobile DTO preserves large IDs and zero metrics while removing unknown data', () => {
  const data = normalizeMobileEvents({ events: [{ ...event, provider_token: 'never-cache' }],
    clubs: [{ id: '9007199254740999', name: 'Club', sport_type: 'cycling', logo: 'https://example.test/club.png', private_field: 'never-cache' }], meta: null });
  assert.equal(data.clubs[0].logo, 'https://example.test/club.png');
  assert.equal(data.events[0].club_info.id, '9007199254740999');
  assert.equal(data.events[0].route_info.id, '9007199254740998');
  assert.equal(data.events[0].route_info.distance, '0 km');
  assert.equal(JSON.stringify(data).includes('never-cache'), false);
});
test('Profile projection rejects non-text names before rendering', () => {
  for (const firstname of [{}, 123, []]) assert.throws(() => normalizeMobileUser({ id: 'strava_1', athleteId: 1, firstname }));
  const user = normalizeMobileUser({ id: 'strava_1', athleteId: 1, firstname: null, token: 'never-store' });
  assert.equal(user.firstname, ''); assert.equal(user.token, undefined);
});
test('Catalog corruption and invalid metadata fail explicitly', () => {
  for (const input of [
    { events: [event], clubs: [null] },
    { events: [event], clubs: [{ id: '1', name: 'One' }, { id: '1', name: 'Duplicate' }] },
    { events: [event], clubs: [], meta: { errors: [null] } },
    { events: [event], clubs: [], meta: { clubs_processed: '25' } },
  ]) assert.throws(() => normalizeMobileEvents(input));
});
