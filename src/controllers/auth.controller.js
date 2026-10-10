import { randomBytes, timingSafeEqual } from 'node:crypto';
import { stravaRequest } from '../services/strava-client.js';
import { config } from "../config/index.js";
import { buildEffectiveRedirect, maybeForwardDevCallback } from "../utils/dev-callback.helper.js";

// Keep frontend destinations exact; never accept arbitrary redirect URLs.
const frontendDestination = value => value === '/next/' ? '/next/' : '/';

const OAUTH_TTL = 10 * 60 * 1000;
const saveSession = req => new Promise((resolve, reject) => {
  req.session.save(error => error ? reject(error) : resolve());
});

/** Start an OAuth transaction and persist its state before leaving the app. */
async function login(req, res) {
  try {
    const { clientId, redirectUri, devCallbackRedirect, stravaAuthUrl } = config;
    const state = randomBytes(32).toString('hex');
    req.session.oauth = { state, expiresAt: Date.now() + OAUTH_TTL,
      returnTo: frontendDestination(req.query?.returnTo) };
    await saveSession(req);
    const effectiveRedirect = buildEffectiveRedirect(redirectUri, devCallbackRedirect);
    res.redirect(stravaAuthUrl(clientId, effectiveRedirect, state));
  } catch {
    res.status(500).send('Unable to start authentication. Please try again.');
  }
}

/**
 * Handles user logout by destroying the session
 */
function logout(req, res) {
  const supplied = req.body?.csrfToken;
  const expected = req.session?.csrfToken;
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
      typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).send('Invalid logout request');
  }
  const returnTo = frontendDestination(req.body?.returnTo);
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session logout failed');
      return res.status(503).send('Unable to log out. Please try again.');
    }
    // Clear the session cookie
    res.clearCookie('connect.sid');
    // Redirect to home page
    res.redirect(303, returnTo);
  });
}

/**
 * Handles the OAuth callback from Strava
 */
async function oauthCallback(req, res) {
  let rotatedSession = false;
  try {
    const { clientId, clientSecret } = config;
    const { code, state, error: oauthError } = req.query;
    if (maybeForwardDevCallback(req, res)) return;
    const transaction = req.session.oauth;
    const validState = typeof state === 'string' && /^[a-f0-9]{64}$/.test(state) &&
      typeof transaction?.state === 'string' && /^[a-f0-9]{64}$/.test(transaction.state) &&
      Number.isFinite(transaction.expiresAt) && transaction.expiresAt > Date.now() &&
      timingSafeEqual(Buffer.from(state), Buffer.from(transaction.state));
    if (!validState) return res.status(400).send('Invalid or expired login. Please start a new login.');
    const returnTo = frontendDestination(transaction.returnTo);
    delete req.session.oauth;
    await saveSession(req);
    if (oauthError || typeof code !== 'string' || !code || code.length > 2048) {
      return res.status(400).send('Authentication cancelled or invalid. Please start a new login.');
    }

    const tokenText = await stravaRequest("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    const data = JSON.parse(tokenText);
    if (typeof data.access_token !== 'string' || !data.access_token ||
        typeof data.refresh_token !== 'string' || !data.refresh_token ||
        !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
        !Number.isSafeInteger(data.athlete?.id) || data.athlete.id <= 0) {
      throw new Error('Invalid OAuth token response');
    }
    await new Promise((resolve, reject) => {
      req.session.regenerate(error => error ? reject(error) : resolve());
    });
    rotatedSession = true;
    req.session.csrfToken = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Store tokens and user information
    req.session.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + data.expires_in
    };
    
    // Store athlete information
    if (data.athlete) {
      req.session.user = {
        id: `strava_${data.athlete.id}`,
        athleteId: data.athlete.id,
        username: data.athlete.username || `user_${data.athlete.id}`,
        firstname: data.athlete.firstname,
        lastname: data.athlete.lastname,
        profile_pic: data.athlete.profile_medium || ''
      };
    }
    
    await saveSession(req);
    res.redirect(returnTo);
  } catch (error) {
    if (rotatedSession && req.session) {
      delete req.session.tokens;
      delete req.session.user;
    }
    console.error('OAuth callback failed');
    if (error.status === 429) {
      if (Number.isSafeInteger(error.retryAfter) && error.retryAfter > 0) res.set('Retry-After', String(error.retryAfter));
      return res.status(429).send('Strava request limit reached. Please wait and start a new login.');
    }
    res.status(500).send('Authentication failed. Please try again.');
  }
}

/**
 * Returns the currently authenticated user's data
 */
function me(req, res) {
  if (!req.session?.tokens?.access_token || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  req.session.csrfToken ??= randomBytes(32).toString('hex');
  // Return a clean copy of the user data without sensitive information
  const { id, athleteId, username, firstname, lastname, profile_pic } = req.session.user;
  res.json({
    id,
    athleteId,
    username,
    firstname,
    lastname,
    profile_pic,
    csrfToken: req.session.csrfToken
  });
}

export { login, oauthCallback, logout, me };
