import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { coordinateSessionStore } from '../../src/utils/session-coordination.js';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const quietConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {} };

// Execute unchanged ESM sources; replace only external boundaries in each test.
export async function backend({ env = {}, modules = {} } = {}) {
  const context = vm.createContext({
    console: quietConsole, Buffer, URL, URLSearchParams, setTimeout, clearTimeout, AbortController,
    process: { env: { CLIENT_ID: 'test-client', CLIENT_SECRET: 'test-secret', ...env },
      exit(code) { throw new Error(`Unexpected process.exit(${code})`); } },
  });
  const loaded = new Map();
  const pendingImports = [];
  async function load(url) {
    const key = url.href;
    if (loaded.has(key)) return loaded.get(key);
    const source = await readFile(url, 'utf8');
    const module = new vm.SourceTextModule(source, {
      context, identifier: key,
      importModuleDynamically: (specifier, parent) => {
        const pending = (async () => {
          const child = await resolve(specifier, parent);
          if (child.status === 'unlinked') await child.link(resolve);
          if (child.status === 'linked') await child.evaluate();
          return child;
        })();
        pendingImports.push(pending);
        return pending;
      },
    });
    loaded.set(key, module);
    return module;
  }
  async function resolve(specifier, parent) {
    if (Object.hasOwn(modules, specifier) || !specifier.startsWith('.')) {
      const key = `external:${specifier}`;
      if (!loaded.has(key)) {
        const exports = Object.hasOwn(modules, specifier)
          ? modules[specifier] : await import(specifier);
        loaded.set(key, new vm.SyntheticModule(Object.keys(exports), function () {
          for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context, identifier: key }));
      }
      return loaded.get(key);
    }
    return load(new URL(specifier, parent.identifier));
  }
  return async (path) => {
    const module = await load(new URL(path, root));
    if (module.status === 'unlinked') await module.link(resolve);
    if (module.status === 'linked') await module.evaluate();
    // Wait for dynamic module loading in the VM test harness.
    await Promise.all(pendingImports);
    await new Promise(resolve => setImmediate(resolve));
    return module.namespace;
  };
}

export function response() {
  return {
    statusCode: 200, body: undefined, location: undefined, headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    redirect(url) { this.statusCode = 302; this.location = url; return this; },
  };
}

export function sessionRequest(query = {}) {
  const req = { query, saves: [], generations: 0, sessionID: randomUUID(), sessionStore: coordinateSessionStore(memoryStore()) };
  req.sessionStore.createSession = (request, value) => { request.session = Object.assign(createSession(), value); };
  function createSession() {
    return {
      save(done) { req.saves.push(JSON.parse(JSON.stringify(this))); req.sessionStore.set(req.sessionID, this, done); },
      regenerate(done) { req.generations++; req.sessionID = randomUUID(); req.session = createSession(); done(); },
    };
  }
  req.session = createSession();
  return req;
}

export function apiResponse(body, status = 200, headers = {}) {
  return { headers: { get(name) { return headers[name.toLowerCase()] ?? null; } }, ok: status >= 200 && status < 300, status, statusText: String(status),
    async json() { return body; }, async text() { return JSON.stringify(body); } };
}

// Small DOM fake for state/date logic. This is not browser or visual verification.
export async function frontend({ fetch = async () => apiResponse({}) } = {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        style: {}, innerHTML: '', textContent: '', dataset: {},
        classList: { add: (...xs) => xs.forEach(x => classes.add(x)),
          remove: (...xs) => xs.forEach(x => classes.delete(x)),
          contains: x => classes.has(x), toggle(x, force) {
            const active = force ?? !classes.has(x);
            if (active) classes.add(x); else classes.delete(x);
            return active;
          } },
        setAttribute() {}, addEventListener() {}, querySelectorAll: () => [],
        closest() { return this; }, appendChild() {}, focus() {},
      });
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    console: quietConsole, URL, URLSearchParams, fetch, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {} }, window: { innerWidth: 1200 },
    document: { getElementById: element, querySelector: element,
      addEventListener() {}, createElement: () => element(Symbol()), body: element('body') },
  });
  vm.runInContext(await readFile(new URL('public/index.js', root), 'utf8'), context,
    { filename: fileURLToPath(new URL('public/index.js', root)) });
  return { context, element, run: source => vm.runInContext(source, context) };
}

export function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

export function memoryStore() {
  const records = new Map();
  return { records,
    set(id, data, done) { records.set(id, JSON.parse(JSON.stringify(data))); done(); },
    get(id, done) { done(null, records.get(id)); },
    destroy(id, done) { records.delete(id); done(); },
  };
}
