import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMobileAuth, memoryMobileStore } from '../../src/services/mobile-auth.js';
const verifier = 'a'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('hex');

test('Mobile handoff requires proof and can be redeemed only once under concurrency', async () => {
  const auth = createMobileAuth({ store: memoryMobileStore() });
  const code = await auth.handoff('session-1', challenge);
  await assert.rejects(auth.exchange(code, 'b'.repeat(64)), e => e.status === 401);
  const outcomes = await Promise.allSettled([auth.exchange(code, verifier), auth.exchange(code, verifier)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  const credential = outcomes.find(x => x.status === 'fulfilled').value;
  assert.equal((await auth.authenticate(credential.token)).sessionId, 'session-1');
  await auth.revoke(credential.token);
  await assert.rejects(auth.authenticate(credential.token), e => e.status === 401);
});

test('Expired handoffs and app credentials fail even before TTL cleanup', async () => {
  let now = 1000;
  const auth = createMobileAuth({ store: memoryMobileStore(), now: () => now, sessionAge: 2000 });
  const code = await auth.handoff('session', challenge);
  now += 60001;
  await assert.rejects(auth.exchange(code, verifier), e => e.status === 401);
  const fresh = await auth.handoff('session', challenge);
  const credential = await auth.exchange(fresh, verifier);
  now += 2001;
  await assert.rejects(auth.authenticate(credential.token), e => e.status === 401);
});

test('Only credential hashes are persisted; malformed input never becomes a query', async () => {
  const store = memoryMobileStore();
  const auth = createMobileAuth({ store });
  const code = await auth.handoff('session', challenge);
  const { token } = await auth.exchange(code, verifier);
  assert.equal(JSON.stringify([...store.records.values()]).includes(token), false);
  assert.equal(JSON.stringify([...store.records.values()]).includes(verifier), false);
  for (const bad of [null, {}, ['$ne'], 'x']) {
    await assert.rejects(auth.authenticate(bad), e => e.status === 401);
    await assert.rejects(auth.exchange(bad, verifier), e => e.status === 401);
  }
});

test('Login throttling is bounded and expires', async () => {
  let now = 0;
  const auth = createMobileAuth({ store: memoryMobileStore(), now: () => now });
  for (let i = 0; i < 30; i++) await auth.throttle('test-address');
  await assert.rejects(auth.throttle('test-address'), e => e.status === 429 && e.retryAfter > 0);
  now += 60001;
  await auth.throttle('test-address');
});
test('Concurrent Mongo throttle returns each atomic increment rather than a later shared count', async () => {
  const { mongoMobileStore } = await import('../../src/services/mobile-auth.js');
  let count = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const collection = {
    async updateOne() { count++; if (count === 31) release(); await gate; },
    async findOne() { return { count }; },
    async findOneAndUpdate() { return { count: ++count }; },
  };
  const auth = createMobileAuth({ store: mongoMobileStore(collection), now: () => 1000 });
  const results = await Promise.allSettled(Array.from({ length: 31 }, () => auth.throttle('test-peer')));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 30);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});

test('Renewal extends an active credential and cannot restore an expired or revoked one', async () => {
  let now = 1000;
  const auth = createMobileAuth({ store: memoryMobileStore(), now: () => now, sessionAge: 2000 });
  const issue = async () => auth.exchange(await auth.handoff('session', challenge), verifier);
  const { token } = await issue();
  now = 2500;
  assert.equal(await auth.renew(token), new Date(4500).toISOString());
  now = 3100;
  assert.equal((await auth.authenticate(token)).sessionId, 'session');
  await auth.revoke(token);
  await assert.rejects(auth.renew(token), error => error.status === 401);
  const expired = await issue();
  now += 2000;
  await assert.rejects(auth.renew(expired.token), error => error.status === 401);
});
