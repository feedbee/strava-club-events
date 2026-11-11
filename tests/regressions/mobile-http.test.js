import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { backend, apiResponse } from '../helpers/runtime.js';
const verifier = 'a'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('hex');
const clientState = 'b'.repeat(64);
const cookie = res => res.headers.get('set-cookie')?.split(';')[0];
async function server(t) {
  const load = await backend({ env: { ENCRYPTION_KEY: 'ab'.repeat(32), SESSION_SECRET: 'test-mobile-secret-'.repeat(3) }, modules: {
    'node-fetch': { default: async url => apiResponse(new URL(url).pathname.endsWith('/athlete/clubs') ? [] : { access_token: 'provider-access', refresh_token: 'provider-refresh',
      expires_in: 3600, athlete: { id: 7, firstname: 'Mobile' } }) },
  } });
  const { app } = await load('src/app.js');
  app.use((await load('src/routes/index.js')).default);
  const listener = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject);
  });
  t.after(() => new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); }));
  return `http://127.0.0.1:${listener.address().port}`;
}
async function handoff(base) {
  const start = await fetch(`${base}/mobile/login?challenge=${challenge}&state=${clientState}`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${base}/callback?code=provider-code&state=${state}`, { redirect: 'manual', headers: { cookie: cookie(start) } });
  assert.equal(callback.status, 302);
  const url = new URL(callback.headers.get('location'));
  assert.equal(url.origin, 'null'); assert.equal(url.protocol, 'stravaclubevents:');
  assert.equal(url.searchParams.get('state'), clientState);
  assert.equal(url.search.includes('provider-'), false);
  return { code: url.searchParams.get('code'), browserCookie: cookie(callback) };
}
test('Real HTTP mobile OAuth uses proof, encrypted sessions and bearer-only profile/logout', async t => {
  const base = await server(t);
  assert.equal((await fetch(`${base}/mobile/capabilities`)).status, 200);
  const { code, browserCookie } = await handoff(base);
  assert.equal((await fetch(`${base}/mobile/me`, { headers: { cookie: browserCookie } })).status, 401);
  const exchange = body => fetch(`${base}/mobile/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await exchange({ code, verifier: 'c'.repeat(64) })).status, 401);
  const response = await exchange({ code, verifier }); assert.equal(response.status, 200);
  const { token, expiresAt } = await response.json();
  assert.equal((await exchange({ code, verifier })).status, 401);
  const headers = { Authorization: `Bearer ${token}` };
  const profile = await fetch(`${base}/mobile/me`, { headers }); assert.equal(profile.status, 200);
  const renewed = Date.parse(profile.headers.get('X-Mobile-Session-Expires-At'));
  assert.ok(renewed >= Date.parse(expiresAt));
  const events = await fetch(`${base}/mobile/events`, { headers });
  assert.equal(events.status, 200);
  assert.ok(Date.parse(events.headers.get('X-Mobile-Session-Expires-At')) >= renewed);
  const invalidFilters = await fetch(`${base}/mobile/events?clubs=invalid`, { headers });
  assert.equal(invalidFilters.status, 400);
  assert.equal(invalidFilters.headers.get('X-Mobile-Session-Expires-At'), null);
  const data = await profile.json(); assert.equal(data.athleteId, 7);
  assert.equal(JSON.stringify(data).includes('provider-'), false); assert.equal(data.csrfToken, undefined);
  assert.equal((await fetch(`${base}/mobile/logout`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' })).status, 204);
  assert.equal((await fetch(`${base}/mobile/me`, { headers })).status, 401);
  assert.equal((await fetch(`${base}/me`, { headers: { cookie: browserCookie } })).status, 401);
});
test('Mobile start rejects malformed proof, duplicate parameters and arbitrary redirects', async t => {
  const base = await server(t);
  for (const suffix of ['', `?challenge=${challenge}&state=${clientState}&returnTo=https://attacker.test`,
    `?challenge=${challenge}&state=${clientState}&state=${clientState}`]) {
    assert.equal((await fetch(`${base}/mobile/login${suffix}`, { redirect: 'manual' })).status, 400);
  }
  assert.equal((await fetch(`${base}/mobile/me`, { headers: { Authorization: 'Bearer malformed' } })).status, 401);
});
test('Mobile bodies reject malformed JSON, oversize and non-JSON before auth processing', async t => {
  const base = await server(t);
  const cases = [
    ['application/json', '{"code":', 400],
    ['application/json', JSON.stringify({ code: 'x'.repeat(5000) }), 413],
    ['application/x-www-form-urlencoded', 'code=test&verifier=test', 415],
  ];
  for (const [type, body, status] of cases) {
    const response = await fetch(`${base}/mobile/exchange`, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes('test&verifier'), false);
  }
});
