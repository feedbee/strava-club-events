import { refreshAccessToken } from '../services/strava.service.js';

/**
 * Middleware to check and refresh the access token if needed
 * Attaches the valid token to req.token for use in subsequent middleware
 */
async function ensureValidToken(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // If token is expired or about to expire in the next 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = req.session.tokens.expires_at || 0;
  
  if (now >= expiresAt - 300) { // 5 minutes buffer
    try {
      const newTokens = await refreshAccessToken(
        req.session.tokens.refresh_token,
        req.app.locals.config.clientId,
        req.app.locals.config.clientSecret
      );
      
      req.session.tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || req.session.tokens.refresh_token, // Use new refresh token if provided, otherwise keep the old one
        expires_at: now + newTokens.expires_in
      };
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      delete req.session.tokens; // Clear invalid session
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
  }
  
  // Attach the valid token to the request for use in subsequent middleware
  req.token = req.session.tokens.access_token;
  next();
}

export { ensureValidToken };
