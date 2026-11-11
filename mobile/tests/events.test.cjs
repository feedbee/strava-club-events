const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('@babel/core');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const credential = { token: 'test-app-credential', user: { id: 'athlete-1' } };
const filters = { mode: 'list', clubs: [], sports: [], joinedOnly: false };
const data = id => ({ events: [{ key: id }], clubs: [], meta: null });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function mount(t, overrides = {}) {
  const shared = await import('../../shared/mobile-state.js');
  const source = transformSync(fs.readFileSync(path.join(__dirname, '../src/data/useEvents.ts'), 'utf8'), {
    filename: 'useEvents.ts', configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-typescript'],
  }).code;
  const writes = []; let expired = 0; let value; let listener; let tick;
  let appState = 'active';
  const modules = {
    react: React,
    'react-native': { AppState: { get currentState() { return appState; }, addEventListener: (_name, handler) => { listener = handler; return { remove() {} }; } } },
    '../../../shared/mobile-state.js': shared,
    './api': { API_URL: 'https://backend.test', ApiError, readUser: async () => credential.user,
      readEvents: async () => data('fresh'), ...overrides.api },
    './auth': { persistRenewedExpiry: async () => {} },
    './storage': { loadSnapshot: async () => null, saveSnapshot: async (...args) => { writes.push(args); }, storageEpoch: () => 1, ...overrides.storage },
  };
  const context = vm.createContext({ console, Date, Error, AbortController, setTimeout, clearTimeout,
    setInterval: callback => { tick = callback; }, clearInterval: () => { tick = undefined; },
    ...overrides.globals,
  });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = modules[specifier];
    if (!exports) throw new Error(`Unexpected import ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  function Consumer({ selected }) { value = module.namespace.useEvents(credential, selected, () => expired++); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Consumer, { selected: filters })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return { get value() { return value; }, get expired() { return expired; }, writes,
    async update(selected) { await act(async () => renderer.update(React.createElement(Consumer, { selected }))); },
    async foreground() { await act(async () => { appState = 'active'; listener(appState); }); },
    async background() { await act(async () => { appState = 'background'; listener(appState); }); },
    async tick() { await act(async () => tick?.()); },
    async unmount() { await act(async () => renderer.unmount()); },
  };
}
test('Saved events render before the network resolves, then fresh events replace them', async t => {
  const gate = deferred();
  const fixture = await mount(t, {
    api: { readEvents: () => gate.promise },
    storage: { loadSnapshot: async () => ({ data: data('saved'), filters, syncedAt: Date.now() - 1000 }) },
  });
  assert.equal(fixture.value.data.events[0].key, 'saved'); assert.equal(fixture.value.saved, true);
  await act(async () => gate.resolve(data('fresh')));
  assert.equal(fixture.value.data.events[0].key, 'fresh'); assert.equal(fixture.value.saved, false);
  assert.equal(fixture.writes.length, 1);
});
test('Only 401 expires identity; network failures preserve the saved snapshot', async t => {
  const storage = { loadSnapshot: async () => ({ data: data('saved'), filters, syncedAt: Date.now() - 1000 }) };
  const offline = await mount(t, { storage, api: { readUser: async () => { throw new Error('Network unavailable'); } } });
  assert.equal(offline.expired, 0); assert.equal(offline.value.data.events[0].key, 'saved');
  assert.match(offline.value.message, /Network unavailable/);
  const expired = await mount(t, { storage, api: { readUser: async () => { throw new ApiError('Expired', 401); } } });
  assert.equal(expired.expired, 1); assert.equal(expired.writes.length, 0);
});
test('Older filters cannot overwrite newer results or snapshots; unmounted requests cannot persist', async t => {
  const first = deferred(); const second = deferred(); let requests = 0;
  const fixture = await mount(t, { api: { readEvents: () => (++requests === 1 ? first.promise : second.promise) } });
  await fixture.update({ ...filters, clubs: ['2'] });
  await act(async () => second.resolve(data('new-filter')));
  await act(async () => first.resolve(data('old-filter')));
  assert.equal(fixture.value.data.events[0].key, 'new-filter'); assert.equal(fixture.writes.length, 1);
  const pending = deferred();
  const unmounted = await mount(t, { api: { readEvents: () => pending.promise } });
  await unmounted.unmount(); await act(async () => pending.resolve(data('late')));
  assert.equal(unmounted.writes.length, 0);
});
test('Changing filters cancels profile validation and prevents an obsolete events request', async t => {
  const gate = deferred(); let validations = 0; let eventRequests = 0; let oldSignal;
  const fixture = await mount(t, { api: {
    readUser: async (_token, signal) => {
      if (++validations === 1) { oldSignal = signal; return gate.promise; }
      return credential.user;
    },
    readEvents: async () => { eventRequests++; return data('current'); },
  } });
  await fixture.update({ ...filters, clubs: ['2'] });
  assert.equal(oldSignal.aborted, true);
  await act(async () => gate.resolve(credential.user));
  assert.equal(eventRequests, 1);
  assert.equal(fixture.value.data.events[0].key, 'current');
});

test('Automatic refresh waits for the foreground interval and respects server retry delays', async t => {
  let now = Date.now(); let requests = 0;
  const fixture = await mount(t, {
    globals: { Date: class extends Date { static now() { return now; } } },
    api: { readEvents: async () => ({ ...data('fresh'), meta: ++requests === 2 ? { retry_after: 1200 } : null }) },
  });
  now += 14 * 60000;
  await fixture.tick();
  assert.equal(requests, 1);
  await fixture.background();
  now += 60000;
  await fixture.tick();
  assert.equal(requests, 1);
  await fixture.foreground();
  assert.equal(requests, 2);
  now += 15 * 60000;
  await fixture.tick();
  assert.equal(requests, 2);
  now += 5 * 60000;
  await fixture.tick();
  assert.equal(requests, 3);
});

test('A filter change during cooldown retries the latest selection when the pause ends', async t => {
  let now = Date.now();
  let retry;
  const selections = [];
  const fixture = await mount(t, {
    globals: {
      Date: class extends Date { static now() { return now; } },
      setTimeout: (callback, delay) => { retry = { callback, delay }; return retry; },
      clearTimeout: timer => { if (retry === timer) retry = undefined; },
    },
    api: { readEvents: async (_token, selected) => {
      selections.push([...selected.clubs]);
      return { ...data('fresh'), meta: selections.length === 1 ? { retry_after: 30 } : null };
    } },
  });
  await fixture.update({ ...filters, clubs: ['1'] });
  now += 10000;
  await fixture.update({ ...filters, clubs: ['2'] });
  assert.deepEqual(selections, [[]]);
  assert.equal(retry?.delay, 20000);
  now += 20000;
  await act(async () => retry.callback());
  assert.deepEqual(selections, [[], ['2']]);
});
