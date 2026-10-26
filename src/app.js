import express from "express";
import { secureSessionMiddleware } from "./middleware/session.middleware.js";

import { securityHeaders } from './middleware/security.middleware.js';
import { health } from './services/health.js';
import { mobileSession } from './middleware/mobile.middleware.js';

// Create Express app
const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
// Probes must remain available when session persistence is unavailable.
app.get('/health/live', health.live);
app.get('/health/ready', health.readiness);

// Preserve bookmarked opt-in URLs while serving React as the primary entry.
app.get(['/next', '/next/'], (req, res) => {
  const query = req.originalUrl.indexOf('?');
  res.redirect(308, '/' + (query < 0 ? '' : req.originalUrl.slice(query)));
});
// Generated frontend and shared static assets do not need a session.
app.use(express.static("public/app"));
app.use(express.static("public"));

// Configure middleware
// Native auth bodies are tiny JSON payloads. Reject compression/oversize/malformed input
// without passing parser errors (which may contain authorization codes) to the logger.
app.use('/mobile', express.json({ limit: '4kb', inflate: false }));
app.use('/mobile', (error, req, res, next) => {
  res.status(error.status === 413 ? 413 : 400).set('Cache-Control', 'no-store').json({ error: 'Invalid mobile request body' });
});
app.use('/mobile', (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'JSON body required' });
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use secure session middleware (includes encryption for sensitive data)
app.use(mobileSession);
app.use(secureSessionMiddleware);

// Export the app
export { app };
