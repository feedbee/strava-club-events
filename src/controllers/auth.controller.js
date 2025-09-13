import fetch from "node-fetch";
import { config } from "../config/index.js";

/**
 * Handles the login redirect to Strava OAuth
 */
function login(req, res) {
  const { clientId, redirectUri, stravaAuthUrl } = config;
  const authUrl = stravaAuthUrl(clientId, redirectUri);
  res.redirect(authUrl);
}

/**
 * Handles the OAuth callback from Strava
 */
async function oauthCallback(req, res) {
  try {
    const { clientId, clientSecret } = config;
    const { code } = req.query;
    
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
    
    // Store tokens with expiration
    req.session.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + data.expires_in
    };
    
    res.redirect("/");
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
}

export { login, oauthCallback };
