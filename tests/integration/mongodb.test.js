import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import MongoStore from 'connect-mongo';
import MongoDBCache from '../../src/cache/drivers/mongodb-cache.js';
import { backend, apiResponse } from '../helpers/runtime.js';

const uri = process.env.TEST_MONGODB_URI;
if (!uri) throw new Error('Set TEST_MONGODB_URI to an isolated test MongoDB server');

test('MongoDB 7 driver cache preserves IDs, indexes, expiry and user isolation', async t => {
  const dbName = `strava_audit_cache_${randomUUID().replaceAll('-', '')}`;
  const cache = new MongoDBCache({ uri, dbName });
  t.after(async () => { if (cache.db) await cache.db.dropDatabase(); await cache.close(); });
  await cache.init();
  await cache.set('user-a:route', { id: '3465434395661532938' }, 60000);
  await cache.set('user-b:route', { id: 'other' }, 60000);
  assert.equal((await cache.get('user-a:route')).id, '3465434395661532938');
  await cache.clearUserData('user-a');
  assert.equal(await cache.get('user-a:route'), null);
  assert.equal((await cache.get('user-b:route')).id, 'other');
  await cache.set('user-b:expired', { id: 'expired' }, -1);
  assert.equal(await cache.get('user-b:expired'), null);
  const indexes = await cache.collection.indexes();
  assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
  assert.ok(indexes.some(index => index.key.key === 1 && index.unique));
});

test('connect-mongo 6 persists encrypted OAuth sessions through rotation, reload and logout', async t => {
  const dbName = `strava_audit_sessions_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(uri); await client.connect();
  let store; let listener;
  t.after(async () => {
    if (listener) await new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); });
    if (store) await store.close();
    await client.db(dbName).dropDatabase(); await client.close();
  });
  const load = await backend({ env: { SESSION_DRIVER: 'mongodb', MONGODB_URI: uri,
    MONGODB_DB: dbName, ENCRYPTION_KEY: 'ab'.repeat(32) }, modules: {
    'connect-mongo': { default: { create(options) { store = MongoStore.create(options); return store; } } },
    'node-fetch': { default: async () => apiResponse({ access_token: 'mongo-access',
      refresh_token: 'mongo-refresh', expires_in: 3600, athlete: { id: 1 } }) },
  } });
  const { app } = await load('src/app.js');
  const { default: routes } = await load('src/routes/index.js'); app.use(routes);
  listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const base = `http://127.0.0.1:${listener.address().port}`;
  const login = await fetch(`${base}/login`, { redirect: 'manual' });
  const before = login.headers.get('set-cookie').split(';')[0];
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${base}/callback?code=test&state=${state}`, {
    redirect: 'manual', headers: { cookie: before },
  });
  assert.equal(callback.status, 302);
  const after = callback.headers.get('set-cookie').split(';')[0]; assert.notEqual(before, after);
  const collection = client.db(dbName).collection('sessions');
  const documents = await collection.find({}).toArray();
  assert.equal(documents.length, 1);
  assert.match(documents[0].session.tokens.access_token, /^:encrypted::/);
  assert.notEqual(documents[0].session.tokens.refresh_token, 'mongo-refresh');
  let csrfToken;
  for (let i = 0; i < 2; i++) {
    const profile = await fetch(`${base}/me`, { headers: { cookie: after } });
    assert.equal(profile.status, 200); const data = await profile.json(); csrfToken = data.csrfToken; assert.equal(data.athleteId, 1);
  }
  const revoked = await fetch(`${base}/me`, { headers: { cookie: before } }); assert.equal(revoked.status, 401);
  const logout = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie: after, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({csrfToken}) });
  assert.equal(logout.status, 303); assert.equal(await collection.countDocuments({}), 0);
});
