import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, apiResponse } from '../helpers/runtime.js';

async function server(t, env = {}) {
  const load = await backend({ env, modules: { 'node-fetch': { default: async () => apiResponse({
    access_token: 'http-access', refresh_token: 'http-refresh', expires_in: 3600,
    athlete: { id: 1, firstname: 'HTTP', lastname: 'Test' },
  }) } } });
  const { app } = await load('src/app.js');
  const { default: routes } = await load('src/routes/index.js');
  app.use(routes);
  const listener = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(() => new Promise((resolve, reject) => {
    listener.close(error => error ? reject(error) : resolve());
    listener.closeAllConnections();
  }));
  return `http://127.0.0.1:${listener.address().port}`;
}
const cookie = res => res.headers.get('set-cookie')?.split(';')[0];

test('P1 HTTP anonymous profile request does not create a session', async t => {
  const base = await server(t);
  const res = await fetch(`${base}/me`);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('P1 HTTP login saves state, rotates session ID, and loads encrypted credentials', async t => {
  const base = await server(t, { ENCRYPTION_KEY: 'ab'.repeat(32) });
  const login = await fetch(`${base}/login`, { redirect: 'manual' });
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const before = cookie(login);
  assert.ok(before);
  assert.ok(state);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  assert.match(login.headers.get('set-cookie'), /SameSite=Lax/);
  const callback = await fetch(`${base}/callback?code=test-code&state=${state}`, {
    redirect: 'manual', headers: { cookie: before },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/');
  const after = cookie(callback);
  assert.ok(after);
  assert.notEqual(after, before);
  const profile = await fetch(`${base}/me`, { headers: { cookie: after } });
  assert.equal(profile.status, 200);
  const profileData = await profile.json();
  assert.equal(profileData.athleteId, 1);
  const revoked = await fetch(`${base}/me`, { headers: { cookie: before } });
  assert.equal(revoked.status, 401);
  const replay = await fetch(`${base}/callback?code=test-code&state=${state}`, {
    redirect: 'manual', headers: { cookie: after },
  });
  assert.equal(replay.status, 400);
  const logout = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie: after, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({csrfToken:profileData.csrfToken}) });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  const signedOut = await fetch(`${base}/me`, { headers: { cookie: after } });
  assert.equal(signedOut.status, 401);
});

test('P1 HTTP trusted TLS proxy sets Secure cookie', async t => {
  const base = await server(t, { SESSION_TRUST_PROXY: 'true', SESSION_SECURE_COOKIE: 'true' });
  const res = await fetch(`${base}/login`, { redirect: 'manual', headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('set-cookie'), /; Secure/);
});

test('P1 HTTP untrusted forwarded TLS header cannot set a secure session cookie', async t => {
  const base = await server(t, { SESSION_TRUST_PROXY: 'false', SESSION_SECURE_COOKIE: 'true' });
  const res = await fetch(`${base}/login`, { redirect: 'manual', headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(res.headers.get('set-cookie'), null);
});

test('P1 HTTP callback with repeated state is rejected', async t => {
  const base = await server(t);
  const login = await fetch(`${base}/login`, { redirect: 'manual' });
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const res = await fetch(`${base}/callback?code=test-code&state=${state}&state=${state}`, {
    redirect: 'manual', headers: { cookie: cookie(login) },
  });
  assert.equal(res.status, 400);
});

test('Logout requires POST and a session-bound CSRF token', async t => {
  const base = await server(t);
  const login = await fetch(`${base}/login`, {redirect:'manual'});
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${base}/callback?code=test&state=${state}`, {redirect:'manual',headers:{cookie:cookie(login)}});
  const sessionCookie = cookie(callback);
  const profile = await fetch(`${base}/me`, {headers:{cookie:sessionCookie}});
  const {csrfToken} = await profile.json(); assert.match(csrfToken, /^[a-f0-9]{64}$/);
  assert.equal((await fetch(`${base}/logout`, {redirect:'manual',headers:{cookie:sessionCookie}})).status, 405);
  for (const body of [{}, {csrfToken:'wrong'}, {csrfToken:[csrfToken]}]) {
    const result = await fetch(`${base}/logout`, {method:'POST',redirect:'manual',headers:{cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(result.status, 403);
  }
  assert.equal((await fetch(`${base}/me`, {headers:{cookie:sessionCookie}})).status, 200);
  const result = await fetch(`${base}/logout`, {method:'POST',redirect:'manual',headers:{cookie:sessionCookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken})});
  assert.equal(result.status, 303);
  assert.equal((await fetch(`${base}/me`, {headers:{cookie:sessionCookie}})).status, 401);
});
test('Security headers protect static pages and token endpoint is absent in development', async t => {
  const base = await server(t, {NODE_ENV:'development'});
  const page = await fetch(base);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('strict-transport-security'), null);
  assert.equal(page.headers.get('x-powered-by'), null);
  assert.equal((await fetch(`${base}/dev/token`)).status, 404);
});
test('HSTS is enabled for the configured HTTPS origin', async t => {
  const base = await server(t, {PUBLIC_URL:'https://events.example.test'});
  const result = await fetch(base);
  assert.equal(result.headers.get('strict-transport-security'), 'max-age=31536000');
});
test('Logout storage failure returns an error and does not clear the cookie', async () => {
  const load = await backend();
  const { logout } = await load('src/controllers/auth.controller.js');
  const csrfToken = 'ab'.repeat(32);
  let cleared = false; let redirected = false;
  const res = {statusCode:200,status(code){this.statusCode=code;return this;},send(){},
    clearCookie(){cleared=true;},redirect(){redirected=true;}};
  logout({body:{csrfToken},session:{csrfToken,destroy(done){done(new Error('Store unavailable'));}}},res);
  assert.equal(res.statusCode, 503); assert.equal(cleared, false); assert.equal(redirected, false);
});
