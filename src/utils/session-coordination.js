import { randomUUID } from 'node:crypto';

const conflict = () => Object.assign(new Error('Session changed or was removed'), { code: 'SESSION_CONFLICT' });
const invoke = (fn, ...args) => new Promise((resolve, reject) => fn(...args, (error, value) => error ? reject(error) : resolve(value)));
function snapshot(value) {
  const copy = JSON.parse(JSON.stringify(value));
  // connect-mongo supplies this as a Date for its touchAfter optimisation.
  if (value.lastModified) copy.lastModified = new Date(value.lastModified);
  return copy;
}
function content(value) {
  const copy = { ...value };
  for (const key of ['cookie', '_revision', 'lastModified']) delete copy[key];
  function canonical(item) {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]));
    return item;
  }
  return JSON.stringify(canonical(copy));
}

// The Mongo adapter is deliberately restricted to our connect-mongo configuration.
// Revisions and leases live in the session document, so deletion fences every writer.
export function coordinateSessionStore(store) {
  const rawGet = store.get.bind(store);
  const rawSet = store.set.bind(store);
  const rawDestroy = store.destroy.bind(store);
  const mongo = Boolean(store.collectionP);
  if (mongo && (store.options.stringify !== false || store.cryptoAdapter)) throw new Error('Unsupported session store serialization');
  const storageId = id => store.computeStorageId(id);
  const leases = new Map();
  const mutations = new Map();
  function serialize(id, task) {
    const previous = mutations.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    mutations.set(id, next);
    next.finally(() => { if (mutations.get(id) === next) mutations.delete(id); }).catch(() => {});
    return next;
  }
  async function read(id) {
    if (mongo) {
      let value = await invoke(rawGet, id);
      if (value && !value._revision) {
        const collection = await store.collectionP;
        await collection.updateOne({ _id: storageId(id), 'session._revision': { $exists: false },
          $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }] },
        { $set: { 'session._revision': randomUUID() } });
        value = await invoke(rawGet, id);
      }
      return value ? snapshot(value) : null;
    }
    const data = await invoke(rawGet, id);
    if (data && !data._revision) {
      data._revision = randomUUID();
      await invoke(rawSet, id, data);
    }
    return data ? snapshot(data) : null;
  }
  store.get = function (id, callback) {
    const task = mongo ? read(id) : serialize(id, () => read(id));
    task.then(value => callback(null, value), callback);
  };
  store.set = function (id, session, callback = () => {}) {
    const task = async () => {
      const current = await invoke(rawGet, id);
      const decode = data => store.decodeSession ? store.decodeSession(id, data) : data;
      // express-session may save a freshly reloaded, unchanged snapshot at response end.
      // Acknowledge identical content without advancing its version or rewriting tokens.
      if (current && !store.requiresEncryptionUpgrade?.(current) && content(decode(current)) === content(decode(session))) {
        if (store.touch) await invoke(store.touch.bind(store), id, session);
        session._revision = current._revision;
        return;
      }
      const revision = randomUUID();
      const data = snapshot({ ...session, _revision: revision });
      delete data.lastModified;
      if (mongo) {
        const collection = await store.collectionP;
        const expires = session.cookie?.expires ? new Date(session.cookie.expires) : new Date(Date.now() + store.options.ttl * 1000);
        if (session._revision) {
          const result = await collection.updateOne({ _id: storageId(id), 'session._revision': session._revision,
            refreshLease: { $exists: false }, $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }] },
          { $set: { session: data, expires, lastModified: new Date() } });
          if (!result.matchedCount) throw conflict();
        } else {
          try { await collection.insertOne({ _id: storageId(id), session: data, expires, lastModified: new Date() }); }
          catch (error) { if (error.code === 11000) throw conflict(); throw error; }
        }
      } else {
        if (leases.has(id) || (session._revision ? current?._revision !== session._revision : current !== null && current !== undefined)) throw conflict();
        await invoke(rawSet, id, data);
      }
      session._revision = revision;
    };
    (mongo ? task() : serialize(id, task)).then(() => callback(null), callback);
  };
  store.destroy = function (id, callback = () => {}) {
    const task = async () => { await invoke(rawDestroy, id); leases.delete(id); };
    (mongo ? task() : serialize(id, task)).then(() => callback(null), callback);
  };
  store.refreshState = async function (id) {
    if (mongo) {
      const document = await (await store.collectionP).findOne({ _id: storageId(id) });
      return document ? { revision: document.session._revision, lease: document.refreshLease } : null;
    }
    return serialize(id, async () => {
      const data = await invoke(rawGet, id);
      return data ? { revision: data._revision, lease: leases.get(id) } : null;
    });
  };
  store.acquireRefresh = async function (id, revision, owner, leaseMs = 30000) {
    const lease = { owner, until: new Date(Date.now() + leaseMs) };
    if (mongo) {
      const result = await (await store.collectionP).updateOne({ _id: storageId(id), 'session._revision': revision,
        refreshLease: { $exists: false }, $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }] }, { $set: { refreshLease: lease } });
      return result.matchedCount > 0;
    }
    return serialize(id, async () => {
      const data = await invoke(rawGet, id);
      if (data?._revision !== revision || leases.has(id)) return false;
      leases.set(id, lease); return true;
    });
  };
  store.commitRefresh = async function (id, revision, owner, tokens) {
    const next = randomUUID();
    if (mongo) {
      const result = await (await store.collectionP).updateOne({ _id: storageId(id), 'session._revision': revision,
        'refreshLease.owner': owner, 'refreshLease.until': { $gt: new Date() },
        $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }] },
      { $set: { 'session.tokens': tokens, 'session._revision': next }, $unset: { refreshLease: '' } });
      return result.matchedCount > 0;
    }
    return serialize(id, async () => {
      const data = await invoke(rawGet, id); const lease = leases.get(id);
      if (data?._revision !== revision || lease?.owner !== owner || lease.until <= new Date()) return false;
      data.tokens = tokens; data._revision = next;
      await invoke(rawSet, id, data); leases.delete(id); return true;
    });
  };
  store.releaseRefresh = async function (id, owner) {
    if (mongo) await (await store.collectionP).updateOne({ _id: storageId(id), 'refreshLease.owner': owner }, { $unset: { refreshLease: '' } });
    else await serialize(id, async () => { if (leases.get(id)?.owner === owner) leases.delete(id); });
  };
  store.invalidateRefresh = async function (id, revision, owner) {
    if (mongo) {
      const result = await (await store.collectionP).deleteOne({ _id: storageId(id), 'session._revision': revision, 'refreshLease.owner': owner });
      return result.deletedCount > 0;
    }
    return serialize(id, async () => {
      const data = await invoke(rawGet, id);
      if (data?._revision !== revision || leases.get(id)?.owner !== owner) return false;
      await invoke(rawDestroy, id); leases.delete(id); return true;
    });
  };
  return store;
}
