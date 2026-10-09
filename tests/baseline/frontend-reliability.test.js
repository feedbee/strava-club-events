import test from 'node:test';
import assert from 'node:assert/strict';
import { frontend, deferred, apiResponse } from '../helpers/runtime.js';

function setup(ui) {
  ui.run(`calendarInstance = {}; updateCalendarWithFilteredEvents = () => {};
    clubFilter.renderTrigger = () => {}; sportTypeFilter.renderTrigger = () => {};
    sportTypeFilter.updateGroupVisibility = () => {};`);
}
test('Older response does not stop loading while the newest request is pending', async () => {
  const first = deferred(); const second = deferred(); let calls = 0;
  const ui = await frontend({ fetch: () => ++calls === 1 ? first.promise : second.promise }); setup(ui);
  const older = ui.run('loadEvents()'); const newer = ui.run('loadEvents()');
  first.resolve(apiResponse({ events: [{id: 'old'}], clubs: [], meta: {} })); await older;
  assert.equal(ui.element('calendar').classList.contains('calendar-loading'), true);
  second.resolve(apiResponse({ events: [{id: 'new'}], clubs: [], meta: {} })); await newer;
  assert.equal(ui.element('calendar').classList.contains('calendar-loading'), false);
  assert.equal(ui.run('allEvents[0].id'), 'new');
});
test('Stale authentication failure does not reopen login after successful newer request', async () => {
  const first = deferred(); const second = deferred(); let calls = 0;
  const ui = await frontend({ fetch: () => ++calls === 1 ? first.promise : second.promise }); setup(ui);
  const older = ui.run('loadEvents()'); const newer = ui.run('loadEvents()');
  second.resolve(apiResponse({ events: [], clubs: [], meta: {} })); await newer;
  first.resolve(apiResponse({ error: 'expired' }, 401)); await older;
  assert.notEqual(ui.element('auth').style.display, 'block');
});
test('Latest failure clears loading and leaves existing events available', async () => {
  const ui = await frontend({ fetch: async () => { throw new Error('Network disconnected'); } }); setup(ui);
  ui.run(`allEvents = [{id: 'existing'}]`);
  await assert.rejects(ui.run('loadEvents()'), /Network disconnected/);
  assert.equal(ui.element('calendar').classList.contains('calendar-loading'), false);
  assert.equal(ui.run('allEvents[0].id'), 'existing');
});
test('Local date keys handle both sides of UTC midnight and DST changes', async () => {
  const previous = process.env.TZ;
  try {
    for (const [zone, iso, expected] of [
      ['Europe/Warsaw', '2026-10-10T22:30:00Z', '2026-10-11'],
      ['America/Los_Angeles', '2026-10-11T01:30:00Z', '2026-10-10'],
      ['Europe/Warsaw', '2026-10-25T00:30:00Z', '2026-10-25'],
      ['Europe/Warsaw', '2026-10-25T01:30:00Z', '2026-10-25'],
    ]) {
      process.env.TZ = zone;
      const ui = await frontend();
      assert.equal(ui.run(`getLocalDateKey(new Date('${iso}'))`), expected);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
