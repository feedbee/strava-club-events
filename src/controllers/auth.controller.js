import fetch from "node-fetch";
import { config } from "../config/index.js";
import { buildEffectiveRedirect, maybeForwardDevCallback } from "../utils/dev-callback.helper.js";

/**
 * Handles the login redirect to Strava OAuth
 */
function login(req, res) {
  const { clientId, redirectUri, devCallbackRedirect, stravaAuthUrl } = config;
  const effectiveRedirect = buildEffectiveRedirect(redirectUri, devCallbackRedirect);
  const authUrl = stravaAuthUrl(clientId, effectiveRedirect);
  res.redirect(authUrl);
}

/**
 * Handles user logout by destroying the session
 */
function logout(req, res) {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    // Clear the session cookie
    res.clearCookie('connect.sid');
    // Redirect to home page
    res.redirect('/');
  });
}

/**
 * Handles the OAuth callback from Strava
 */
async function oauthCallback(req, res) {
  try {
    const { clientId, clientSecret } = config;
    const { code } = req.query;

    // If a dev-callback-redirect parameter is present, forward the callback there with the same params
    if (maybeForwardDevCallback(req, res)) return;

    if (!code) {
      throw new Error('No authorization code provided');
    }

    const tokenResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const errorData = await tokenResp.text();
      throw new Error(`OAuth error: ${errorData}`);
    }

    const data = await tokenResp.json();
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
        lastname: data.athlete.lastname
      };
    }
    
    res.redirect("/");
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
}

export { login, oauthCallback, logout };
