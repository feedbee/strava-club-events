import { app } from './app.js';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

import { initializeRateLimits, closeRateLimits, checkRateLimits } from './services/strava-rate-limits.js';
import { initializeCache, closeCache, checkCache } from './services/strava.service.js';
import { initializeSessionStore, closeSessionStore, checkSessionStore } from './middleware/session.middleware.js';
import { health } from './services/health.js';
const { port, host } = config;

// Use routes
app.use('/', routes);

// Use error handling middleware
app.use(errorHandler);

// Fail startup before accepting requests if persistence is unavailable.
await Promise.all([initializeCache(), initializeSessionStore(), initializeRateLimits()]);
health.start([checkCache, checkSessionStore, checkRateLimits]);
const server = app.listen(port, host, () => {
  console.log(`🌐 Public URL: ${config.publicUrl}`);
  console.log("✅ Server is running on " + host + ":" + port);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  health.stop();
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await Promise.all([closeCache(), closeSessionStore(), closeRateLimits()]);
    clearTimeout(deadline);
  } catch { process.exitCode = 1; }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
