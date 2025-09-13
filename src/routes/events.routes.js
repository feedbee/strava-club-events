import { Router } from 'express';
import { ensureValidToken } from '../middleware/auth.middleware.js';
import { getEvents } from '../controllers/events.controller.js';

const router = Router();

// Get events (needs login)
router.get("/events", ensureValidToken, getEvents);

export default router;
