import { Router } from 'express';
import { login, logout, oauthCallback } from '../controllers/auth.controller.js';

const router = Router();

// Login route
router.get('/login', login);

// Logout route
router.get('/logout', logout);

// OAuth callback route
router.get('/callback', oauthCallback);

export default router;
