import { Router } from 'express';
import { login, logout, oauthCallback, me } from '../controllers/auth.controller.js';


const router = Router();

// Authentication responses must not be stored by browsers or shared proxies.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Login route
router.get('/login', login);

// Logout route
router.get('/logout', (req, res) => res.set('Allow', 'POST').status(405).send('Use POST to log out'));
router.post('/logout', logout);

// OAuth callback route
router.get('/callback', oauthCallback);

// Get current user data
router.get('/me', me);

export default router;
