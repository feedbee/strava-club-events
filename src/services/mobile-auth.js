import { createHash, randomBytes } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const opaque = () => randomBytes(32).toString('hex');
const valid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const denied = () => Object.assign(new Error('Invalid or expired mobile authorization'), { status: 401 });

// All reads enforce expiry; MongoDB TTL is cleanup, not an authorization check.
export function memoryMobileStore() {
  const records = new Map();
  function prune(now) {
    for (const [key, value] of records) if (+value.expiresAt <= now) records.delete(key);
  }
  return {
    records,
    async insert(record, now) {
      prune(now);
      if (records.size >= 5000) throw Object.assign(new Error('Mobile auth busy'), { status: 503 });
      records.set(record._id, record);
    },
    async take(id, challenge, now) {
      const record = records.get(id);
      if (!record || record.kind !== 'handoff' || record.challenge !== challenge || +record.expiresAt <= now) return null;
      records.delete(id); return record;
    },
    async find(id, now) {
      const record = records.get(id);
      return record?.kind === 'credential' && +record.expiresAt > now ? record : null;
    },
    async remove(id) { records.delete(id); },
    async bump(id, expiresAt, now) {
      prune(now);
      const current = records.get(id);
      if (!current) {
        if (records.size >= 5000) throw Object.assign(new Error('Mobile auth busy'), { status: 503 });
        records.set(id, { _id: id, kind: 'throttle', count: 0, expiresAt });
      }
      return ++records.get(id).count;
    },
  };
}

export function mongoMobileStore(collection) {
  return {
    async init() { await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); },
    async insert(record) { await collection.insertOne(record); },
    take(_id, challenge, now) {
      return collection.findOneAndDelete({ _id, kind: 'handoff', challenge, expiresAt: { $gt: new Date(now) } });
    },
    find(_id, now) { return collection.findOne({ _id, kind: 'credential', expiresAt: { $gt: new Date(now) } }); },
    async remove(_id) { await collection.deleteOne({ _id }); },
    async bump(_id, expiresAt) {
      try {
        await collection.updateOne({ _id }, { $inc: { count: 1 }, $setOnInsert: { kind: 'throttle', expiresAt } }, { upsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        await collection.updateOne({ _id }, { $inc: { count: 1 } });
      }
      return (await collection.findOne({ _id })).count;
    },
  };
}

export function createMobileAuth({ store, now = Date.now, sessionAge = 86400000 }) {
  return {
    async throttle(address) {
      const time = now(); const bucket = Math.floor(time / 60000);
      const until = (bucket + 1) * 60000;
      const count = await store.bump(`rate:${bucket}:${digest(String(address))}`, new Date(until), time);
      if (count > 30) throw Object.assign(new Error('Too many mobile login attempts'), {
        status: 429, retryAfter: Math.max(1, Math.ceil((until - time) / 1000)),
      });
    },
    async handoff(sessionId, challenge) {
      if (!valid(challenge)) throw denied();
      const code = opaque();
      await store.insert({ _id: `handoff:${digest(code)}`, kind: 'handoff', sessionId,
        challenge, expiresAt: new Date(now() + 60000) }, now());
      return code;
    },
    async exchange(code, verifier) {
      if (!valid(code) || !valid(verifier)) throw denied();
      const handoff = await store.take(`handoff:${digest(code)}`, digest(verifier), now());
      if (!handoff) throw denied();
      const token = opaque(); const expiresAt = new Date(now() + sessionAge);
      await store.insert({ _id: `credential:${digest(token)}`, kind: 'credential',
        sessionId: handoff.sessionId, expiresAt }, now());
      return { token, expiresAt: expiresAt.toISOString() };
    },
    async authenticate(token) {
      if (!valid(token)) throw denied();
      const record = await store.find(`credential:${digest(token)}`, now());
      if (!record) throw denied();
      return record;
    },
    async revoke(token) {
      if (valid(token)) await store.remove(`credential:${digest(token)}`);
    },
  };
}
