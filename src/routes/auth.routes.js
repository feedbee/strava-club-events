import { Router } from 'express';
import { login, logout, oauthCallback, me } from '../controllers/auth.controller.js';
import { ensureValidToken } from '../middleware/auth.middleware.js';

const router = Router();

// Login route
router.get('/login', login);

// Logout route
router.get('/logout', logout);

// OAuth callback route
router.get('/callback', oauthCallback);

// Get current user data
router.get('/me', me);

// Dev-only: return current access token (for local scripts/testing)
if (process.env.NODE_ENV === 'development') {
  router.get('/dev/token', ensureValidToken, (req, res) => {
    res.json({ access_token: req.token });
  });
}

export default router;
