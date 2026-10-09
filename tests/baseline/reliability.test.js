import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, apiResponse, deferred } from '../helpers/runtime.js';

test('Strava client times out even if the upstream never settles', async () => {
  const load = await backend({ modules: { 'node-fetch': { default: () => new Promise(() => {}) } } });
  const { createStravaClient } = await load('src/services/strava-client.js');
  await assert.rejects(createStravaClient({ timeoutMs: 10 })('https://example.test'), error => error.status === 504);
});
test('Strava client bounds concurrency and waiting queue', async () => {
  const gate = deferred(); let active = 0; let peak = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async () => {
    active++; peak = Math.max(peak, active); await gate.promise; active--; return apiResponse([]);
  } } } });
  const { createStravaClient } = await load('src/services/strava-client.js');
  const request = createStravaClient({ concurrency: 1, maxQueue: 1 });
  const first = request('https://example.test'); const second = request('https://example.test');
  await assert.rejects(request('https://example.test'), error => error.status === 503);
  gate.resolve(); await Promise.all([first, second]); assert.equal(peak, 1);
});
test('Concurrent club cache misses perform one upstream request', async () => {
  let calls = 0; const gate = deferred();
  const load = await backend({ modules: { 'node-fetch': { default: async () => {
    calls++; await gate.promise; return apiResponse([]);
  } } } });
  const { getUserClubs } = await load('src/services/strava.service.js');
  const first = getUserClubs('token', 'user'); const second = getUserClubs('token', 'user');
  gate.resolve(); await Promise.all([first, second]); assert.equal(calls, 1);
});
test('Routes are isolated by authenticated user', async () => {
  let calls = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async () => apiResponse({ id: 'route', name: String(++calls) }) } } });
  const { getRouteDetails } = await load('src/services/strava.service.js');
  await getRouteDetails('first', 'route', { userId: '1' });
  await getRouteDetails('second', 'route', { userId: '2' });
  await getRouteDetails('first', 'route', { userId: '1' });
  assert.equal(calls, 2);
});
test('Memory cache evicts least recently used entries and rejects oversized values', async () => {
  const load = await backend(); const { default: Cache } = await load('src/cache/drivers/in-memory-cache.js');
  const cache = new Cache({ maxEntries: 2, maxBytes: 20 });
  await cache.set('a', 'a'); await cache.set('b', 'b'); await cache.get('a'); await cache.set('c', 'c');
  assert.equal(await cache.get('b'), null); assert.equal(await cache.get('a'), 'a');
  assert.equal(await cache.set('large', 'x'.repeat(30)), false);
  await cache.close(); assert.equal(cache.bytes, 0);
});
test('Concurrent token refreshes use one exchange and share the rotated token', async () => {
  let calls = 0; const gate = deferred();
  const load = await backend({ modules: { 'node-fetch': { default: async () => {
    calls++; await gate.promise; return apiResponse({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 });
  } } } });
  const { refreshAccessToken } = await load('src/services/strava.service.js');
  const first = refreshAccessToken('old', 'client', 'secret');
  const second = refreshAccessToken('old', 'client', 'secret');
  gate.resolve(); const results = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(results[0].refresh_token, results[1].refresh_token);
});
test('Queued requests have a deadline and never start after timing out', async () => {
  let calls=0;
  const load=await backend({modules:{'node-fetch':{default:()=>{calls++;return new Promise(()=>{});}}}});
  const {createStravaClient}=await load('src/services/strava-client.js');
  const request=createStravaClient({concurrency:1,timeoutMs:10});
  await Promise.all([assert.rejects(request('https://example.test/a'),error=>error.status===504),
    assert.rejects(request('https://example.test/b'),error=>error.status===504)]);
  assert.equal(calls,1);
});
