import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, response, apiResponse, sessionRequest } from '../helpers/runtime.js';

const production = { NODE_ENV: 'production', PUBLIC_URL: 'https://app.example',
  SESSION_SECRET: 's'.repeat(64), SESSION_DRIVER: 'mongodb', MONGODB_URI: 'mongodb://test-db' };
const tokenReply = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
  athlete: { id: 1, firstname: 'Test', lastname: 'User' } };

async function auth() {
  let exchanges = 0;
  const load = await backend({ modules: { 'node-fetch': { default: async () => {
    exchanges++; return apiResponse(tokenReply);
  } } } });
  return { ...await load('src/controllers/auth.controller.js'), exchanges: () => exchanges };
}

for (const [name, env, expected] of [
  ['missing session secret', { ...production, SESSION_SECRET: '' }, /SESSION_SECRET/],
  ['short session secret', { ...production, SESSION_SECRET: 'supersecret' }, /SESSION_SECRET/],
  ['memory session store', { ...production, SESSION_DRIVER: 'memory' }, /SESSION_DRIVER/],
  ['missing MongoDB URI', { ...production, MONGODB_URI: '' }, /MONGODB_URI/],
  ['HTTP public URL', { ...production, PUBLIC_URL: 'http://app.example' }, /PUBLIC_URL/],
  ['insecure production cookie', { ...production, SESSION_SECURE_COOKIE: 'false' }, /SESSION_SECURE_COOKIE/],
  ['unrecognized session driver', { SESSION_DRIVER: 'typo' }, /SESSION_DRIVER/],
  ['malformed encryption key', { ENCRYPTION_KEY: 'not-a-key' }, /ENCRYPTION_KEY/],
  ['dev callback bounce', { DEV_CALLBACK_REDIRECT: 'http://localhost:3001' }, /DEV_CALLBACK_REDIRECT/],
]) {
  test(`configuration rejects ${name}`, async () => {
    const load = await backend({ env });
    await assert.rejects(load('src/config/index.js'), expected);
  });
}

test('secure cookies default on in production and off in local development', async () => {
  const prod = await (await backend({ env: production }))('src/config/index.js');
  const dev = await (await backend())('src/config/index.js');
  assert.equal(prod.config.session.secureCookie, true);
  assert.equal(dev.config.session.secureCookie, false);
});

test('OAuth URL correctly encodes callback query parameters', async () => {
  const { config } = await (await backend())('src/config/index.js');
  const callback = 'https://app.example/callback?a=1&b=2';
  const url = new URL(config.stravaAuthUrl('client', callback, 'state'));
  assert.equal(url.searchParams.get('redirect_uri'), callback);
  assert.equal(url.searchParams.get('state'), 'state');
});

for (const scenario of ['mismatch', 'expired', 'array', 'cancelled']) {
  test(`OAuth ${scenario} callback never exchanges a token`, async () => {
    const controller = await auth(); const req = sessionRequest(); const loginRes = response();
    await controller.login(req, loginRes);
    const state = new URL(loginRes.location).searchParams.get('state');
    req.query = { code: 'code', state };
    if (scenario === 'mismatch') req.query.state = 'wrong';
    if (scenario === 'expired') req.session.oauth.expiresAt = Date.now() - 1;
    if (scenario === 'array') req.query.state = [state];
    if (scenario === 'cancelled') { delete req.query.code; req.query.error = 'access_denied'; }
    const res = response(); await controller.oauthCallback(req, res);
    assert.equal(controller.exchanges(), 0);
    assert.equal(req.session.tokens, undefined);
    assert.equal(res.statusCode, 400);
  });
}

test('successful OAuth rotates the session and persists credentials before redirect', async () => {
  const controller = await auth(); const req = sessionRequest(); const loginRes = response();
  req.session.oldPrivateField = 'must-not-survive';
  await controller.login(req, loginRes);
  const state = new URL(loginRes.location).searchParams.get('state');
  assert.equal(req.saves[0].oauth.state, state);
  req.query = { code: 'code', state };
  const res = response(); await controller.oauthCallback(req, res);
  assert.equal(res.location, '/');
  assert.equal(req.generations, 1);
  assert.equal(req.session.oldPrivateField, undefined);
  assert.equal(req.saves.at(-1).tokens.access_token, 'access');
  assert.equal(req.session.user.athleteId, 1);
  const replay = response(); await controller.oauthCallback(req, replay);
  assert.equal(replay.statusCode, 400);
  assert.equal(controller.exchanges(), 1);
});

test('session write failure cannot redirect the user to Strava', async () => {
  const controller = await auth(); const req = sessionRequest(); const res = response();
  req.session.save = done => done(new Error('test store failure'));
  await controller.login(req, res);
  assert.equal(res.location, undefined);
  assert.equal(res.statusCode, 500);
});

test('failed final persistence does not leave the request authenticated', async () => {
  const controller = await auth(); const req = sessionRequest(); const loginRes = response();
  await controller.login(req, loginRes);
  req.query = { code: 'code', state: new URL(loginRes.location).searchParams.get('state') };
  const regenerate = req.session.regenerate;
  req.session.regenerate = done => regenerate(error => {
    req.session.save = callback => callback(new Error('test store failure'));
    done(error);
  });
  const res = response(); await controller.oauthCallback(req, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.location, undefined);
  assert.equal(req.session.tokens, undefined);
  assert.equal(req.session.user, undefined);
});

for (const status of [400, 503]) {
  test(`refresh ${status} ${status === 400 ? 'clears the expired identity' : 'preserves the session for retry'}`, async () => {
    const load = await backend({ modules: { 'node-fetch': { default: async () => apiResponse({}, status) } } });
    const { ensureValidToken } = await load('src/middleware/auth.middleware.js');
    const req = sessionRequest();
    req.session.user = { id: 'strava_1' };
    req.session.tokens = { access_token: 'expired', refresh_token: 'refresh', expires_at: 0 };
    await new Promise((resolve,reject) => req.session.save(error => error ? reject(error) : resolve()));
    const res = response();
    await ensureValidToken(req, res, () => assert.fail('expired credentials reached events'));
    assert.equal(res.statusCode, status === 400 ? 401 : 503);
    assert.equal(Boolean(req.session?.user), status !== 400);
    assert.equal(Boolean(req.session?.tokens), status !== 400);
  });
}

for (const kind of ['legacy', 'corrupt', 'nested']) {
  test(`encrypted store handles ${kind} persisted credentials safely`, async () => {
    const { memoryStore } = await import('../helpers/runtime.js');
    const load = await backend({ env: { ENCRYPTION_KEY: 'ab'.repeat(32) } });
    const { encrypt, encryptSessionStore } = await load('src/utils/encryption.util.js');
    const raw = memoryStore();
    raw.records.set('id', { user: { id: 'strava_1' }, tokens: { access_token:
      kind === 'legacy' ? encrypt('access', 'id:access_token') : kind === 'nested' ? encrypt(encrypt('access'), 'id:access_token') : ':encrypted::invalid' } });
    const store = encryptSessionStore(raw);
    const data = await new Promise((resolve, reject) => store.get('id', (error, data) => error ? reject(error) : resolve(data)));
    if (kind === 'legacy') assert.equal(data.tokens.access_token, 'access');
    else { assert.equal(data, null); assert.equal(raw.records.has('id'), false); }
  });
}

for (const destination of ['/next/', 'https://evil.example', '//evil.example', '/next/?redirect=evil', ['/next/']]) {
  test(`OAuth return destination is allowlisted: ${JSON.stringify(destination)}`, async () => {
    const controller = await auth();
    const req = sessionRequest();
    req.query = { returnTo: destination };
    const start = response();
    await controller.login(req, start);
    req.query = { code: 'code', state: new URL(start.location).searchParams.get('state'), returnTo: 'https://evil.example' };
    const done = response();
    await controller.oauthCallback(req, done);
    assert.equal(done.location, destination === '/next/' ? '/next/' : '/');
  });
}
