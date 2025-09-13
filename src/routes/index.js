import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventsRoutes from './events.routes.js';

const router = Router();

// Mount auth routes
router.use('/', authRoutes);

// Mount events routes
router.use('/', eventsRoutes);

export default router;
