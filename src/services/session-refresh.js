import { randomUUID } from 'node:crypto';

const gone = () => Object.assign(new Error('Session expired. Please log in again.'), { status: 401, code: 'SESSION_GONE' });
const read = (store, id) => new Promise((resolve, reject) => store.get(id, (error, value) => error ? reject(error) : resolve(value)));

export async function refreshSession(store, id, refresh, { waitMs = 10000, pollMs = 50 } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const current = await read(store, id);
    if (!current?.tokens?.access_token || !current.user?.id) throw gone();
    if (Math.floor(Date.now() / 1000) < current.tokens.expires_at - 300) return current;
    const state = await store.refreshState(id);
    if (!state) throw gone();
    if (state.revision !== current._revision) {
      if (Date.now() >= deadline) throw Object.assign(new Error('Token refresh is busy'), { status: 503 });
      continue;
    }
    if (state.lease && new Date(state.lease.until).getTime() <= Date.now()) {
      // An interrupted exchange may have rotated the provider token. Never replay it.
      await store.invalidateRefresh(id, state.revision, state.lease.owner);
      throw gone();
    }
    const owner = randomUUID();
    if (await store.acquireRefresh(id, current._revision, owner)) {
      try {
        if (!current.tokens.refresh_token) throw gone();
        const result = await refresh(current.tokens.refresh_token);
        if (typeof result.access_token !== 'string' || !result.access_token ||
            !Number.isFinite(result.expires_in) || result.expires_in <= 0 ||
            (result.refresh_token !== undefined && (typeof result.refresh_token !== 'string' || !result.refresh_token))) {
          throw gone();
        }
        const tokens = { access_token: result.access_token,
          refresh_token: result.refresh_token ?? current.tokens.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + result.expires_in };
        if (!await store.commitRefresh(id, current._revision, owner, tokens)) throw gone();
        const saved = await read(store, id);
        if (!saved) throw gone();
        return saved;
      } catch (error) {
        if (error.status === 400 || error.status === 401 || error.status === 504 || !error.status) {
          await store.invalidateRefresh(id, current._revision, owner);
          throw gone();
        }
        throw error;
      } finally {
        await store.releaseRefresh(id, owner);
      }
    }
    if (Date.now() >= deadline) throw Object.assign(new Error('Token refresh is busy'), { status: 503 });
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}
