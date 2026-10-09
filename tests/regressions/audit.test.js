import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, response, apiResponse, frontend, deferred, sessionRequest, memoryStore } from '../helpers/runtime.js';

process.env.TZ = 'Europe/Warsaw';
const tokenReply = {
  access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600,
  athlete: { id: 1, firstname: 'Test', lastname: 'User' },
};

async function authRuntime() {
  let exchanges = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async () => {
    exchanges++; return apiResponse(tokenReply);
  } } } });
  return { auth: await load('src/controllers/auth.controller.js'), exchanges: () => exchanges };
}

test('P1 OAuth login includes a nonempty state bound to this session', async () => {
  const { auth } = await authRuntime();
  const req = sessionRequest(); const res = response();
  await auth.login(req, res);
  const state = new URL(res.location).searchParams.get('state');
  assert.ok(state && state.length >= 32, 'OAuth URL must contain an unpredictable state');
  assert.ok(JSON.stringify(req.session).includes(state), 'state must be stored in the initiating session');
});

test('P1 callback rejects an unsolicited code before token exchange', async () => {
  const runtime = await authRuntime(); const res = response(); const session = {};
  await runtime.auth.oauthCallback({ query: { code: 'unsolicited-code' }, session }, res);
  assert.equal(runtime.exchanges(), 0, 'no token exchange without a matching OAuth transaction');
  assert.equal(session.tokens, undefined);
  assert.equal(res.statusCode, 400);
});

test('P1 production callback never forwards an OAuth code to an arbitrary host', async () => {
  const load = await backend({ env: { NODE_ENV: 'production', PUBLIC_URL: 'https://app.example',
    SESSION_SECRET: 's'.repeat(64), SESSION_DRIVER: 'mongodb', MONGODB_URI: 'mongodb://test-db' },
    modules: { 'node-fetch': { default: async () => apiResponse(tokenReply) } } });
  const { oauthCallback } = await load('src/controllers/auth.controller.js');
  const res = response();
  await oauthCallback({ session: {}, query: {
    code: 'test-code', 'dev-callback-redirect': 'https://attacker.example/collect',
  } }, res);
  assert.ok(!res.location?.startsWith('https://attacker.example'), 'callback leaked code via redirect');
});

async function sessionOptions(env) {
  let options;
  const load = await backend({ env, modules: {
    'express-session': { default: Object.assign(value => { options = value; return () => {}; }, { MemoryStore: memoryStore }) },
    'connect-mongo': { default: { create() { throw new Error('Unexpected Mongo connection'); } } },
  } });
  await load('src/middleware/session.middleware.js');
  return options;
}

test('P1 explicit secure cookie setting remains enabled', async () => {
  const options = await sessionOptions({ SESSION_SECURE_COOKIE: 'true' });
  assert.equal(options.cookie.secure, true);
});

test('P1 explicit proxy trust setting remains enabled', async () => {
  const options = await sessionOptions({ SESSION_TRUST_PROXY: 'true' });
  assert.equal(options.proxy, true);
});

test('P2 saving a session twice preserves readable tokens and encrypted stored data', async () => {
  const load = await backend({ env: { ENCRYPTION_KEY: 'ab'.repeat(32) } });
  const { encryptSessionStore, decrypt } = await load('src/utils/encryption.util.js');
  const store = encryptSessionStore(memoryStore());
  const session = { tokens: { access_token: 'test-access', refresh_token: 'test-refresh' } };
  await new Promise(resolve => store.set('id', session, resolve));
  await new Promise(resolve => store.set('id', session, resolve));
  const persisted = store.records.get('id');
  assert.equal(decrypt(persisted.tokens.access_token, 'id:access_token'), 'test-access', 'stored token must decrypt exactly once');
  assert.equal(session.tokens.access_token, 'test-access', 'save must not mutate request credentials');
  assert.notEqual(persisted.tokens.access_token, 'test-access');
  const loaded = await new Promise((resolve, reject) => store.get('id', (error, data) => error ? reject(error) : resolve(data)));
  assert.equal(loaded.tokens.access_token, 'test-access');
});

test('P2 failed club fetches are distinguishable from a genuinely empty calendar', async () => {
  const load = await backend({ modules: { 'node-fetch': { default: async url =>
    apiResponse(url.includes('/athlete/clubs') ? [{ id: 1, name: 'Club' }] : {},
      url.includes('/athlete/clubs') ? 200 : 429) } } });
  const { getAllUserClubsEvents } = await load('src/services/strava.service.js');
  let result;
  try { result = await getAllUserClubsEvents('test-token', 'user'); }
  catch (error) {
    assert.match(error.message, /429|rate.limit|upstream|Strava|fetch.*club/i);
    return;
  }
  assert.ok(result.meta?.errors?.length || result.meta?.clubs_failed > 0 || result.meta?.partial === true,
    '429 must be surfaced as an error or explicit failure metadata');
});

test('P2 list groups an event after local midnight under the local calendar day', async () => {
  const ui = await frontend();
  ui.run(`renderListView([{
    title: 'Late ride', start_date: '2026-10-10T22:30:00.000Z',
    club_info: {name: 'Club'}, strava_event_url: 'https://www.strava.com/clubs/1/group_events/1'
  }])`);
  assert.match(ui.element('list-view').innerHTML, /Sunday, October 11/);
});

test('P2 newer filter results survive an older request completing later', async () => {
  const first = deferred(); const second = deferred(); let requests = 0;
  const ui = await frontend({ fetch: () => (++requests === 1 ? first.promise : second.promise) });
  // Keep the real loadEvents/getEvents state transition; rendering is outside this test.
  ui.run(`calendarInstance = {}; updateCalendarWithFilteredEvents = () => {};
    clubFilter.renderTrigger = () => {}; sportTypeFilter.renderTrigger = () => {};
    sportTypeFilter.updateGroupVisibility = () => {};`);
  const older = ui.run('loadEvents()');
  ui.run('filterState.selectedClubs = ["2"]');
  const newer = ui.run('loadEvents()');
  second.resolve(apiResponse({ events: [{ id: 'new' }], clubs: [], meta: {} }));
  await newer;
  first.resolve(apiResponse({ events: [{ id: 'old' }], clubs: [], meta: {} }));
  await older;
  assert.equal(ui.run('allEvents[0].id'), 'new');
});

test('P2 loading state is cleared when a filter request fails', async () => {
  const ui = await frontend({ fetch: async () => apiResponse({ error: 'Upstream unavailable' }, 503) });
  ui.run('calendarInstance = {}');
  await assert.rejects(ui.run('loadEvents()'), /503/);
  assert.equal(ui.element('calendar').classList.contains('calendar-loading'), false);
});
