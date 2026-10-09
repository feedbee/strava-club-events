import fetch from 'node-fetch';
import { createRateLimiter, rateLimiter as sharedRateLimiter } from './strava-rate-limits.js';

// Bound actual active work; a request's deadline includes queueing and body reading.
export function createStravaClient({ timeoutMs = 15000, concurrency = 4, maxQueue = 256, rateLimiter = createRateLimiter() } = {}) {
  let active = 0;
  const queue = [];
  return async function request(url, options = {}) {
    const controller = new AbortController();
    const timeoutError = Object.assign(new Error('Strava request timed out'), { status: 504 });
    const timeout = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(timeoutError), { once: true }));
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const work = (async () => {
      let ownsSlot = false;
      try {
        if (active >= concurrency) {
          if (queue.length >= maxQueue) throw Object.assign(new Error('Strava request queue full'), { status: 503 });
          await new Promise((resolve, reject) => {
            const entry = { resolve: () => {
              controller.signal.removeEventListener('abort', abort);
              ownsSlot = true; resolve();
            } };
            const abort = () => { const index = queue.indexOf(entry); if (index >= 0) queue.splice(index, 1); reject(timeoutError); };
            queue.push(entry);
            controller.signal.addEventListener('abort', abort, { once: true });
          });
        } else { active++; ownsSlot = true; }
        if (controller.signal.aborted) throw timeoutError;
        const scope = new URL(url).pathname.startsWith('/api/') ? 'api' : 'oauth';
        const startedAt = await rateLimiter.before(scope);
        if (controller.signal.aborted) throw timeoutError;
        const response = await fetch(url, { ...options, signal: controller.signal });
        const retryAfter = await rateLimiter.observe(response, scope, startedAt);
        if (!response.ok) throw Object.assign(new Error(`Strava request failed (${response.status})`), { status: response.status, retryAfter });
        return await response.text();
      } finally {
        if (ownsSlot) {
          if (queue.length) queue.shift().resolve();
          else active--;
        }
      }
    })();
    try { return await Promise.race([work, timeout]); }
    finally { clearTimeout(timer); }
  };
}
export const stravaRequest = createStravaClient({ rateLimiter: sharedRateLimiter });
