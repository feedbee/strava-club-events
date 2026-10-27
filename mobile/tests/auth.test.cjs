const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const origin = 'https://backend.test';
const user = { id: 'strava_1', athleteId: 1, firstname: 'Test' };
const session = { token: 'a'.repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString() };
async function fixture(overrides = {}) {
  const dto = await import('../../shared/mobile-events.js');
  const secure = new Map([['club-events-session', JSON.stringify({ ...session, backend: origin, user })]]);
  const local = new Map(); const revoked = [];
  class ApiError extends Error {}
  const auth = await load('src/data/auth.ts', {
    '../../../shared/mobile-events.js': dto,
    'expo-crypto': { getRandomBytes: () => new Uint8Array(32).fill(1), CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async () => 'b'.repeat(64) },
    'expo-web-browser': { openAuthSessionAsync: async (url, callback) => ({ type: 'success', url: `${callback}?code=${'c'.repeat(64)}&state=${new URL(url).searchParams.get('state')}` }) },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
      getItemAsync: async key => secure.get(key), setItemAsync: async (key, value) => secure.set(key, value),
      deleteItemAsync: async key => secure.delete(key), ...overrides.secure },
    '@react-native-async-storage/async-storage': { default: {
      getItem: async key => local.get(key) || null, setItem: async (key, value) => local.set(key, value),
      removeItem: async key => local.delete(key), ...overrides.local } },
    './api': { API_URL: origin, ApiError, request: async (path, token) => {
      if (path === '/capabilities') return { version: 1, callback: 'stravaclubevents://auth/callback' };
      if (path === '/exchange') return session;
      if (path === '/logout') revoked.push(token);
    }, readUser: async () => user, ...overrides.api },
  });
  return { auth, secure, local, revoked };
}
test('Durable logout marker prevents old credentials from returning if SecureStore deletion fails', async () => {
  const { auth, secure } = await fixture({ secure: { deleteItemAsync: async () => { throw new Error('Keychain unavailable'); } } });
  await auth.clearCredential();
  assert.ok(secure.has('club-events-session'));
  assert.equal(await auth.savedCredential(), null);
});
test('Credential deletion and the next sign-in are serialized without losing the new session', async () => {
  let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let secure;
  const fixtureValue = await fixture({ secure: { deleteItemAsync: async key => { entered(); await gate; secure.delete(key); } } });
  secure = fixtureValue.secure;
  const clearing = fixtureValue.auth.clearCredential(); await started;
  const connecting = fixtureValue.auth.connect();
  await new Promise(resolve => setImmediate(resolve)); release();
  await clearing; await connecting;
  assert.equal((await fixtureValue.auth.savedCredential()).token, session.token);
});
test('Failure after exchanging a credential revokes the abandoned server session', async () => {
  const { auth, revoked } = await fixture({ api: { readUser: async () => { throw new Error('Network failed'); } } });
  await assert.rejects(auth.connect(), /Network failed/);
  assert.deepEqual(revoked, [session.token]);
});
test('A damaged stored profile cannot reach native rendering', async () => {
  const { auth, secure } = await fixture();
  secure.set('club-events-session', JSON.stringify({ ...session, backend: origin, user: { ...user, firstname: {} } }));
  assert.equal(await auth.savedCredential(), null);
});
test('Only one interactive sign-in can run at a time', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { auth } = await fixture({ api: { readUser: () => gate } });
  const first = auth.connect();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(auth.connect(), /already in progress/);
  release(user); await first;
});
test('Logout during sign-in prevents a delayed credential from becoming restorable', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { auth, revoked } = await fixture({ api: { readUser: () => gate } });
  const pending = auth.connect();
  await new Promise(resolve => setImmediate(resolve));
  await auth.clearCredential(); release(user);
  await assert.rejects(pending, /cancelled/);
  assert.equal(await auth.savedCredential(), null);
  assert.deepEqual(revoked, [session.token]);
});
