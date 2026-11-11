import { createHmac } from 'node:crypto';
import { config } from '../config/index.js';
import { initializeMobileAuth } from '../services/mobile-auth-runtime.js';

// Bridge only protected mobile endpoints into the existing encrypted session/refresh machinery.
// A cookie supplied by the caller is never sufficient to authenticate these endpoints.
export async function mobileSession(req, res, next) {
  if (!/^\/mobile\/(me|events|logout)\/?$/i.test(req.path)) return next();
  res.set('Cache-Control', 'no-store');
  delete req.headers.cookie;
  try {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error: 'Mobile session required' });
    const auth = await initializeMobileAuth();
    const record = await auth.authenticate(match[1]);
    const signature = createHmac('sha256', config.session.secret).update(record.sessionId).digest('base64').replace(/=+$/, '');
    req.headers.cookie = `connect.sid=${encodeURIComponent(`s:${record.sessionId}.${signature}`)}`;
    req.mobileToken = match[1];
    req.renewMobileSession = async () => {
      try {
        res.set('X-Mobile-Session-Expires-At', await auth.renew(match[1]));
        return true;
      } catch (error) {
        if (error.status === 401) req.session = null;
        sendAuthError(res, error);
        return false;
      }
    };
    next();
  } catch (error) {
    sendAuthError(res, error);
  }
}

function sendAuthError(res, error) {
  const expired = error.status === 401;
  res.status(expired ? 401 : 503).json({ error: expired ? 'Mobile session expired' : 'Mobile authentication unavailable' });
}
