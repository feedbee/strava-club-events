import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createMobileAuth, mongoMobileStore } from '../../src/services/mobile-auth.js';
const uri = process.env.TEST_MONGODB_URI;
if (!uri) throw new Error('Set TEST_MONGODB_URI to an isolated MongoDB');
async function fixture(t) {
  const client = new MongoClient(uri); await client.connect();
  const db = client.db(`strava_mobile_${randomUUID().replaceAll('-', '')}`);
  t.after(async () => { await db.dropDatabase(); await client.close(); });
  return { collection: db.collection('mobile_auth') };
}
const verifier = 'd'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('hex');
test('Independent MongoDB adapters atomically consume a handoff once and share revocation', async t => {
  const { collection } = await fixture(t);
  const store1 = mongoMobileStore(collection); const store2 = mongoMobileStore(collection);
  await Promise.all([store1.init(), store2.init()]);
  const first = createMobileAuth({ store: store1 }); const second = createMobileAuth({ store: store2 });
  const code = await first.handoff('session-id', challenge);
  const outcomes = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => (i % 2 ? first : second).exchange(code, verifier)));
  const successes = outcomes.filter(value => value.status === 'fulfilled'); assert.equal(successes.length, 1);
  const { token } = successes[0].value;
  assert.equal((await second.authenticate(token)).sessionId, 'session-id');
  assert.equal(JSON.stringify(await collection.find().toArray()).includes(token), false);
  await second.revoke(token);
  await assert.rejects(first.authenticate(token), error => error.status === 401);
});
test('MongoDB expiry is checked before TTL deletion and concurrent throttling does not lose increments', async t => {
  const { collection } = await fixture(t); const store = mongoMobileStore(collection); await store.init();
  let now = Date.now(); const auth = createMobileAuth({ store, now: () => now, sessionAge: 100 });
  const code = await auth.handoff('session-id', challenge); now += 60001;
  await assert.rejects(auth.exchange(code, verifier), error => error.status === 401);
  const fresh = await auth.handoff('session-id', challenge); const { token } = await auth.exchange(fresh, verifier);
  now += 101; await assert.rejects(auth.authenticate(token), error => error.status === 401);
  const outcomes = await Promise.allSettled(Array.from({ length: 40 }, () => auth.throttle('local-test')));
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 30);
  assert.equal(outcomes.filter(value => value.status === 'rejected' && value.reason.status === 429).length, 10);
  assert.equal((await collection.findOne({ kind: 'throttle' })).count, 40);
});
