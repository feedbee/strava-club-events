import { refreshAccessToken } from '../services/strava.service.js';
import { refreshSession } from '../services/session-refresh.js';
import { config } from '../config/index.js';

async function ensureValidToken(req, res, next) {
  if (!req.session?.tokens?.access_token || !req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (Math.floor(Date.now() / 1000) >= (req.session.tokens.expires_at || 0) - 300) {
    try {
      const current = await refreshSession(req.sessionStore, req.sessionID,
        token => refreshAccessToken(token, config.clientId, config.clientSecret));
      // Replace the entire stale snapshot, retaining express-session's methods.
      req.sessionStore.createSession(req, current);
    } catch (error) {
      if (error.status === 401) {
        req.session = null; // Prevent express-session from saving the stale authenticated snapshot.
        res.clearCookie?.('connect.sid');
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      if (error.status === 429) {
        if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
        return res.status(429).json({ error: 'Strava rate limit reached', retry_after: error.retryAfter });
      }
      return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
    }
  }
  req.token = req.session.tokens.access_token;
  req.user = { ...req.session.user };
  next();
}
export { ensureValidToken };
