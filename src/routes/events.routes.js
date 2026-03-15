import { Router } from 'express';
import { ensureValidToken } from '../middleware/auth.middleware.js';
import { getEvents } from '../controllers/events.controller.js';
import { getLimitsHandler } from '../controllers/limits.controller.js';

const router = Router();

// Get events (needs login)
router.get("/events", ensureValidToken, getEvents);

// Get current application limits (public, no auth required)
router.get("/limits", getLimitsHandler);

export default router;
