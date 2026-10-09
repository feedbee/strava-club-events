import test from 'node:test';
import assert from 'node:assert/strict';
import { frontend } from '../helpers/runtime.js';

test('Club logos cannot introduce HTML attributes or executable URL schemes', async () => {
  const ui = await frontend();
  const hostile = 'https://example.test/logo" onerror="alert(1)';
  const html = ui.run(`clubMarkupHtml({name:'Club',logo:${JSON.stringify(hostile)}}, 'logo', 'initial')`);
  assert.doesNotMatch(html, /" onerror=/);
  for (const logo of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload="alert(1)">', 'http://example.test/logo', 'https://user:pass@example.test/logo']) {
    const markup = ui.run(`clubMarkupHtml({name:'Club',logo:${JSON.stringify(logo)}}, 'logo', 'initial')`);
    assert.doesNotMatch(markup, /<img/);
  }
});
test('Authentication loss clears private event and profile UI and invalidates pending requests', async () => {
  const ui = await frontend();
  ui.run(`allEvents = [{id:'private'}]; allClubs = [{id:'club'}]; listViewEvents = allEvents;
    filterState.selectedClubs = ['club']; filterState.selectedSportTypes = ['cycling'];
    calendarInstance = {destroy() {}};`);
  ui.element('user-name').innerHTML = '<a>Private user</a>';
  ui.element('list-view').innerHTML = 'Private event';
  ui.run('handleAuthRequired()');
  assert.equal(ui.run('allEvents.length'), 0);
  assert.equal(ui.run('allClubs.length'), 0);
  assert.equal(ui.run('listViewEvents.length'), 0);
  assert.equal(ui.run('calendarInstance'), null);
  assert.equal(ui.element('user-name').innerHTML, '');
  assert.equal(ui.element('list-view').innerHTML, '');
  assert.equal(ui.run('filterState.selectedClubs.length'), 0);
  assert.equal(ui.element('auth').style.display, 'block');
});
