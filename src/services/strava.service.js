import fetch from 'node-fetch';

/**
 * Refreshes the access token using the refresh token
 * @param {string} refreshToken - The refresh token
 * @param {string} clientId - Strava API client ID
 * @param {string} clientSecret - Strava API client secret
 * @returns {Promise<Object>} - The new access token data
 */
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const tokenResp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResp.ok) {
    const errorData = await tokenResp.text();
    throw new Error(`Token refresh failed: ${errorData}`);
  }

  return tokenResp.json();
}

export { refreshAccessToken };
