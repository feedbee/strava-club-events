import { Router } from 'express';
import { login, oauthCallback } from '../controllers/auth.controller.js';

const router = Router();

// Login route
router.get('/login', login);

// OAuth callback route
router.get('/callback', oauthCallback);

export default router;
