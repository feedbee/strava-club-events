import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, response, apiResponse, frontend, memoryStore } from '../helpers/runtime.js';
import { parseJsonWithStringIds } from '../../src/utils/parsing.js';
import { buildEffectiveRedirect } from '../../src/utils/dev-callback.helper.js';
import InMemoryCache from '../../src/cache/drivers/in-memory-cache.js';

const encryptionEnv = { ENCRYPTION_KEY: 'ab'.repeat(32) };

test('large event and route IDs survive JSON parsing without rounding', () => {
  const data = parseJsonWithStringIds('{"id":3468204764614160646,"route":{"id":3465434395661532938}}');
  assert.equal(data.id, '3468204764614160646');
  assert.equal(data.route.id, '3465434395661532938');
});

test('normal OAuth redirect URI is preserved when dev forwarding is disabled', () => {
  assert.equal(buildEffectiveRedirect('https://app.example/callback', ''), 'https://app.example/callback');
});

test('me returns profile fields without OAuth credentials', async () => {
  const load = await backend({ modules: { 'node-fetch': { default: () => { throw new Error('Unexpected network'); } } } });
  const { me } = await load('src/controllers/auth.controller.js');
  const res = response();
  me({ session: { tokens: { access_token: 'secret' }, user: {
    id: 'strava_1', athleteId: 1, firstname: 'Test', lastname: 'User', refresh_token: 'secret',
  } } }, res);
  assert.equal(res.body.athleteId, 1);
  assert.equal('tokens' in res.body, false);
  assert.equal('refresh_token' in res.body, false);
});

test('me rejects an anonymous session', async () => {
  const load = await backend({ modules: { 'node-fetch': { default: () => {} } } });
  const { me } = await load('src/controllers/auth.controller.js');
  const res = response(); me({ session: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('encryption round trips and uses a fresh IV', async () => {
  const load = await backend({ env: encryptionEnv });
  const { encrypt, decrypt } = await load('src/utils/encryption.util.js');
  const a = encrypt('test-access-token'); const b = encrypt('test-access-token');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'test-access-token');
  assert.equal(decrypt(b), 'test-access-token');
});

test('cache isolates user keys and removes expired entries on read', async () => {
  const cache = new InMemoryCache();
  await cache.set('user-a:clubs', ['a']); await cache.set('user-b:clubs', ['b']);
  await cache.clearUserData('user-a');
  assert.equal(await cache.get('user-a:clubs'), null);
  assert.deepEqual(await cache.get('user-b:clubs'), ['b']);
  await cache.set('expired:clubs', ['old'], -1);
  assert.equal(await cache.get('expired:clubs'), null);
});

test('club and sport filters use AND and cannot fetch a club outside membership', async () => {
  const urls = [];
  const load = await backend({ modules: { 'node-fetch': { default: async url => {
    urls.push(url);
    return apiResponse(url.includes('/athlete/clubs') ? [
      { id: 1, name: 'Cycling', sport_type: 'cycling' },
      { id: 2, name: 'Running', sport_type: 'running' },
    ] : []);
  } } } });
  const { getAllUserClubsEvents } = await load('src/services/strava.service.js');
  const result = await getAllUserClubsEvents('test-token', 'user-a', {
    filterClubIds: ['1', '2', '999'], filterSportTypes: ['cycling'],
  });
  assert.equal(result.meta.clubs_processed, 1);
  assert.equal(urls.filter(url => url.includes('/group_events')).length, 1);
  assert.ok(urls.some(url => url.includes('/clubs/1/group_events')));
});

test('joined-only filter excludes events the user has not joined', async () => {
  const ui = await frontend();
  ui.run('filterState.joinedOnly = true');
  const result = ui.run('applyFilters([{id: "a", joined: true}, {id: "b", joined: false}])');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'a');
});

test('session defaults retain HttpOnly and SameSite protection', async () => {
  let options;
  const load = await backend({ modules: {
    'express-session': { default: Object.assign(value => { options = value; return () => {}; }, { MemoryStore: memoryStore }) },
    'connect-mongo': { default: { create() { throw new Error('Unexpected connection'); } } },
  } });
  await load('src/middleware/session.middleware.js');
  assert.equal(options.cookie.httpOnly, true);
  assert.equal(options.cookie.sameSite, 'lax');
});

test('session encryption protects both tokens in the persisted copy', async () => {
  const load = await backend({ env: encryptionEnv });
  const { encryptSessionStore, decrypt } = await load('src/utils/encryption.util.js');
  const store = encryptSessionStore(memoryStore());
  await new Promise(resolve => store.set('id', { tokens: { access_token: 'access', refresh_token: 'refresh' } }, resolve));
  const saved = store.records.get('id').tokens;
  assert.notEqual(saved.access_token, 'access');
  assert.notEqual(saved.refresh_token, 'refresh');
  assert.equal(decrypt(saved.access_token, 'id:access_token'), 'access');
  assert.equal(decrypt(saved.refresh_token, 'id:refresh_token'), 'refresh');
});

test('valid credentials reach events middleware without a token refresh', async () => {
  const load = await backend({ modules: { 'node-fetch': { default: () => {
    throw new Error('Unexpected token refresh');
  } } } });
  const { ensureValidToken } = await load('src/middleware/auth.middleware.js');
  const req = { session: { tokens: { access_token: 'valid', expires_at: Date.now() / 1000 + 3600 },
    user: { id: 'strava_1' } } };
  let continued = false;
  await ensureValidToken(req, response(), () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.token, 'valid');
  assert.equal(req.user.id, 'strava_1');
});

test('API authentication failures have a distinct error type in frontend', async () => {
  const ui = await frontend({ fetch: async () => apiResponse({ error: 'Not authenticated' }, 401) });
  await assert.rejects(ui.run('getEvents()'), error => error.isAuthError === true);
});
