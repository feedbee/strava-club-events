// Callback forwarding was removed because it bypassed session-bound OAuth state.
// Developers must use a direct callback URL allowed by their Strava app.
export function buildEffectiveRedirect(redirectUri, devCallbackRedirect) {
  if (devCallbackRedirect) throw new Error('Dev callback forwarding is disabled');
  return redirectUri;
}

export function maybeForwardDevCallback(req, res) {
  if (!Object.hasOwn(req.query, 'dev-callback-redirect')) return false;
  res.status(400).send('Dev callback forwarding is disabled. Please start a new login.');
  return true;
}
