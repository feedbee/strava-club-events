import { Router } from 'express';
import { mobileLogin, mobileExchange, mobileMe, mobileLogout } from '../controllers/mobile.controller.js';
import { ensureValidToken } from '../middleware/auth.middleware.js';
import { getEvents } from '../controllers/events.controller.js';
const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/capabilities', (req, res) => res.json({ version: 1, callback: 'stravaclubevents://auth/callback' }));
router.get('/login', mobileLogin);
router.post('/exchange', mobileExchange);
router.use(['/me', '/events', '/logout'], (req, res, next) => {
  if (!req.mobileToken) return res.status(401).json({ error: 'Mobile session required' });
  next();
});
router.get('/me', ensureValidToken, mobileMe);
router.get('/events', ensureValidToken, getEvents);
router.post('/logout', mobileLogout);
export default router;
