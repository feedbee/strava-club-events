import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventsRoutes from './events.routes.js';
import mobileRoutes from './mobile.routes.js';

const router = Router();
router.use('/mobile', mobileRoutes);

// Mount auth routes
router.use('/', authRoutes);

// Mount events routes
router.use('/', eventsRoutes);

export default router;
