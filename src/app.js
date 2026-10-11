import express from "express";
import { secureSessionMiddleware } from "./middleware/session.middleware.js";

import { securityHeaders } from './middleware/security.middleware.js';
import { health } from './services/health.js';

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use secure session middleware (includes encryption for sensitive data)
app.use(secureSessionMiddleware);

// Export the app
export { app };
