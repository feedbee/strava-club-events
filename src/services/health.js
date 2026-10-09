// Health checks use existing storage connections and never call Strava.
export function createHealth({ checks = [], timeoutMs = 1500 } = {}) {
  let initialized = false;
  let stopping = false;
  let pending;
  async function ready() {
    if (!initialized || stopping) return false;
    if (!pending) {
      const controller = new AbortController();
      let timer;
      const deadline = new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs);
      });
      const probes = Promise.all(checks.map(check => Promise.resolve().then(() => check({ signal: controller.signal }))))
        .then(() => true, () => false);
      pending = Promise.race([probes, deadline]).finally(() => {
        clearTimeout(timer); controller.abort(); pending = undefined;
      });
    }
    return await pending && !stopping;
  }
  return {
    start(nextChecks = checks) { checks = nextChecks; initialized = true; },
    stop() { stopping = true; },
    ready,
    live(req, res) { res.set('Cache-Control', 'no-store').json({ status: 'alive' }); },
    async readiness(req, res) {
      const available = await ready();
      res.set('Cache-Control', 'no-store').status(available ? 200 : 503)
        .json({ status: available ? 'ready' : 'not_ready' });
    }
  };
}
export const health = createHealth();
