import { MongoClient } from 'mongodb';
import { config } from '../config/index.js';

const QUARTER = 15 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const empty = () => ({ quarter: 0, day: 0, apiUntil: 0, oauthUntil: 0,
  overall: { limits: null, usage: [0, 0] }, read: { limits: null, usage: [0, 0] } });
const clone = value => JSON.parse(JSON.stringify(value));
export function memoryQuotaStore() {
  let value = empty(); let tail = Promise.resolve();
  return { transact(update) {
    const task = tail.catch(() => {}).then(() => { const next = clone(value); const result = update(next); value = next; return result; });
    tail = task; return task;
  } };
}
export function mongoQuotaStore(collection, id) {
  return {
    async init() {
      try {
        await collection.updateOne({ _id: id }, { $setOnInsert: { version: 0, value: empty() } }, { upsert: true });
      } catch (error) {
        // Another instance can create the same application state during startup.
        if (error.code !== 11000 || !await collection.findOne({ _id: id })) throw error;
      }
    },
    async transact(update) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const document = await collection.findOne({ _id: id });
        if (!document) throw Object.assign(new Error('Rate-limit state unavailable'), { status: 503 });
        const next = clone(document.value); const result = update(next);
        if (JSON.stringify(next) === JSON.stringify(document.value)) return result;
        const written = await collection.updateOne({ _id: id, version: document.version },
          { $set: { value: next }, $inc: { version: 1 } });
        if (written.matchedCount) return result;
      }
      throw Object.assign(new Error('Rate-limit state busy'), { status: 503 });
    }
  };
}
function pair(value, positive) {
  if (typeof value !== 'string' || !/^\s*\d+\s*,\s*\d+\s*$/.test(value)) return null;
  const values = value.split(',').map(Number);
  return values.every(number => Number.isSafeInteger(number) && number >= (positive ? 1 : 0)) ? values : null;
}
function roll(state, time) {
  const quarter = Math.floor(time / QUARTER); const day = Math.floor(time / DAY);
  for (const bucket of [state.overall, state.read]) {
    if (state.quarter !== quarter) bucket.usage[0] = 0;
    if (state.day !== day) bucket.usage[1] = 0;
  }
  state.quarter = quarter; state.day = day;
}
function quotaPause(state, time) {
  let until = state.apiUntil;
  for (const bucket of [state.overall, state.read]) {
    if (!bucket.limits) continue;
    if (bucket.usage[0] >= bucket.limits[0]) until = Math.max(until, (state.quarter + 1) * QUARTER);
    if (bucket.usage[1] >= bucket.limits[1]) until = Math.max(until, (state.day + 1) * DAY);
  }
  return until > time ? until : 0;
}
function retryUntil(header, time) {
  if (typeof header !== 'string' || !header.trim()) return 0;
  if (/^\d+$/.test(header.trim())) {
    const until = time + Math.max(1, Number(header)) * 1000;
    return Number.isSafeInteger(until) ? until : 0;
  }
  const until = Date.parse(header);
  return Number.isFinite(until) ? Math.max(time + 1000, until) : 0;
}
function limited(until, time) {
  return Object.assign(new Error('Strava rate limit reached'), {
    status: 429, retryAfter: Math.max(1, Math.ceil((until - time) / 1000))
  });
}
export function createRateLimiter({ now = Date.now, store = memoryQuotaStore() } = {}) {
  return {
    setStore(next) { store = next; },
    async before(scope) {
      return store.transact(state => {
        const time = now(); roll(state, time);
        const until = scope === 'api' ? quotaPause(state, time) : state.oauthUntil;
        if (until > time) throw limited(until, time);
        if (scope === 'api') for (const bucket of [state.overall, state.read]) {
          bucket.usage[0]++; bucket.usage[1]++;
        }
        return time;
      });
    },
    async observe(response, scope, startedAt) {
      return store.transact(state => {
        const time = now(); roll(state, time);
        const get = name => response.headers?.get?.(name);
        const date = Date.parse(get('date'));
        const observedAt = Number.isFinite(date) ? date : startedAt;
        if (scope === 'api') {
          for (const [name, prefix] of [['overall', 'x-ratelimit'], ['read', 'x-readratelimit']]) {
            const limits = pair(get(`${prefix}-limit`), true);
            const usage = pair(get(`${prefix}-usage`), false);
            if (limits) state[name].limits = limits;
            if (usage) {
              if (Math.floor(observedAt / QUARTER) === state.quarter) state[name].usage[0] = Math.max(state[name].usage[0], usage[0]);
              if (Math.floor(observedAt / DAY) === state.day) state[name].usage[1] = Math.max(state[name].usage[1], usage[1]);
            }
          }
        }
        if (response.status === 429) {
          const fallback = scope === 'api' ? (state.quarter + 1) * QUARTER : time + 60000;
          const until = Math.max(retryUntil(get('retry-after'), time) || fallback,
            scope === 'api' ? quotaPause(state, time) : 0);
          const key = scope === 'api' ? 'apiUntil' : 'oauthUntil';
          state[key] = Math.max(state[key], until);
          return Math.max(1, Math.ceil((state[key] - time) / 1000));
        }
        return undefined;
      });
    }
  };
}
export const rateLimiter = createRateLimiter();
let client;
export async function initializeRateLimits() {
  if (config.session.driver !== 'mongodb') return;
  client = new MongoClient(config.session.mongodb.uri, {
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 15000,
    writeConcern: { w: 'majority', wtimeoutMS: 5000 }
  });
  await client.connect();
  const store = mongoQuotaStore(client.db(config.session.mongodb.dbName).collection('strava_rate_limits'), `strava:${config.clientId}`);
  await store.init(); rateLimiter.setStore(store);
}
export async function closeRateLimits() { await client?.close(); }
export async function checkRateLimits({ signal }) {
  if (config.session.driver !== 'mongodb') return;
  if (!client) throw new Error('Rate-limit store unavailable');
  await client.db(config.session.mongodb.dbName).command({ ping: 1 }, { signal, timeoutMS: 1000 });
}
