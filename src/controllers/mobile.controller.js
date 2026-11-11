import { initializeMobileAuth } from '../services/mobile-auth-runtime.js';
import { login } from './auth.controller.js';

export const MOBILE_CALLBACK = 'stravaclubevents://auth/callback';
const valid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function mobileError(res, error) {
  const status = [400, 401, 429].includes(error.status) ? error.status : 503;
  if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
  return res.status(status).json({ error: status === 429 ? 'Too many login attempts. Please try again later.' :
    status === 401 ? 'Invalid or expired mobile authorization' : status === 400 ? 'Invalid mobile login request' : 'Mobile authentication unavailable',
  ...(error.retryAfter ? { retry_after: error.retryAfter } : {}) });
}
export async function mobileLogin(req, res) {
  if (!valid(req.query.challenge) || !valid(req.query.state) ||
      Object.keys(req.query).some(key => !['challenge', 'state'].includes(key))) {
    return mobileError(res, { status: 400 });
  }
  try {
    await (await initializeMobileAuth()).throttle(req.socket.remoteAddress);
    req.mobileLogin = { challenge: req.query.challenge, state: req.query.state };
    return login(req, res);
  } catch (error) { return mobileError(res, error); }
}
export async function mobileExchange(req, res) {
  try {
    const auth = await initializeMobileAuth();
    await auth.throttle(req.socket.remoteAddress);
    res.json(await auth.exchange(req.body?.code, req.body?.verifier));
  } catch (error) { mobileError(res, error); }
}
export async function mobileMe(req, res) {
  if (!req.session?.user || !req.session.tokens?.access_token) return res.status(401).json({ error: 'Mobile session expired' });
  if (!await req.renewMobileSession()) return;
  const { id, athleteId, username, firstname, lastname, profile_pic } = req.session.user;
  res.json({ id, athleteId, username, firstname, lastname, profile_pic });
}
export async function mobileLogout(req, res) {
  try {
    // Destroying the shared session fences pending token refreshes and stale writers.
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    await (await initializeMobileAuth()).revoke(req.mobileToken);
    res.status(204).end();
  } catch (error) { mobileError(res, error); }
}
