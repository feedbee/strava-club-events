import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, apiResponse, frontend } from '../helpers/runtime.js';

test('A recurring Strava event expands into distinct sorted occurrences and fetches its route once', async () => {
  const first = new Date(Date.now() + 86400000).toISOString();
  const second = new Date(Date.now() + 2 * 86400000).toISOString();
  let routes = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async url => {
    if (url.includes('/routes/')) { routes++; return apiResponse({id:'route',name:'Route',resource_state:3}); }
    return apiResponse([{id:'90071992547409999',title:'Weekly ride',joined:true,route:{id:'route'},
      upcoming_occurrences:[second,first,first,'invalid',null,'2020-01-01T00:00:00Z']}]);
  } } } });
  const { getClubEvents } = await load('src/services/strava.service.js');
  const result = await getClubEvents('token', {id:'club',name:'Club'}, 'user');
  assert.equal(result.rawCount, 1);
  assert.equal(result.events.length, 2);
  assert.deepEqual(Array.from(result.events, e => e.start_date), [first,second]);
  assert.equal(new Set(result.events.map(e => e.occurrence_id)).size, 2);
  for (const event of result.events) {
    assert.equal(event.id, '90071992547409999'); assert.equal(event.joined, true);
    assert.equal(event.route_info.name, 'Route');
    assert.equal(event.strava_event_url, 'https://www.strava.com/clubs/club/group_events/90071992547409999');
  }
  assert.equal(routes, 1);
});
test('Occurrence window is inclusive and excludes invalid dates and duplicate instants', async () => {
  const load = await backend();
  const { upcomingOccurrences } = await load('src/utils/occurrences.js');
  const now = new Date('2026-10-10T12:00:00Z');
  const end = new Date('2026-11-09T12:00:00Z');
  const values = ['2026-11-09T12:00:00.001Z',end.toISOString(),now.toISOString(),
    '2026-10-10T14:00:00+02:00','2026-10-10T11:59:59.999Z','garbage',null,12];
  assert.deepEqual(Array.from(upcomingOccurrences(values, now), d => d.toISOString()), [now.toISOString(),end.toISOString()]);
  assert.equal(upcomingOccurrences(undefined, now).length, 0);
});
test('FullCalendar receives a distinct identity for each occurrence', async () => {
  const ui = await frontend();
  const result = ui.run(`transformEventsForCalendar([
    {id:'same',occurrence_id:'club:same:first',start_date:'2026-10-10T10:00:00Z'},
    {id:'same',occurrence_id:'club:same:second',start_date:'2026-10-11T10:00:00Z'}
  ])`);
  assert.deepEqual(Array.from(result, e => e.id), ['club:same:first','club:same:second']);
});
test('Events with no occurrence in the window do not fetch routes', async () => {
  let routes = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async url => {
    if (url.includes('/routes/')) { routes++; return apiResponse({}); }
    return apiResponse([{id:'1',route:{id:'route'},upcoming_occurrences:[]},
      {id:'2',route:{id:'route'},upcoming_occurrences:['2020-01-01T00:00:00Z']}]);
  } } } });
  const { getClubEvents } = await load('src/services/strava.service.js');
  const result = await getClubEvents('token', {id:'club'}, 'user');
  assert.equal(result.events.length, 0); assert.equal(result.rawCount, 2); assert.equal(routes, 0);
});
