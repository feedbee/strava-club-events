// Utilities to support optional dev callback redirect flow

/**
 * Build the effective redirect URI for the Strava authorize URL.
 * If devCallbackRedirect is provided, append `dev-callback-redirect` param
 * to the production redirect so that the production server forwards
 * the callback to the dev environment.
 */
export function buildEffectiveRedirect(redirectUri, devCallbackRedirect) {
  if (!devCallbackRedirect || typeof devCallbackRedirect !== 'string' || !devCallbackRedirect.trim()) {
    return redirectUri;
  }
  const devCbBase = devCallbackRedirect.replace(/\/$/, '');
  const devCb = devCbBase.endsWith('/callback') ? devCbBase : `${devCbBase}/callback`;
  const sep = redirectUri.includes('?') ? '&' : '?';
  return `${redirectUri}${sep}dev-callback-redirect=${encodeURIComponent(devCb)}`;
}

/**
 * If the incoming request contains a `dev-callback-redirect` parameter,
 * forward the callback (including the original OAuth params) to that URL.
 * Returns true if a redirect response has been sent, otherwise false.
 */
export function maybeForwardDevCallback(req, res) {
  const devRedirect = req.query['dev-callback-redirect'];
  if (!devRedirect) return false;

  try {
    const target = new URL(devRedirect);
    // Preserve original OAuth params except the dev-callback-redirect itself
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'dev-callback-redirect') continue;
      if (Array.isArray(v)) {
        v.forEach((vv) => target.searchParams.append(k, vv));
      } else if (v !== undefined) {
        target.searchParams.set(k, v);
      }
    }
    res.redirect(target.toString());
    return true;
  } catch (e) {
    console.error('Invalid dev-callback-redirect URL:', devRedirect, e);
    res.status(400).send('Invalid dev-callback-redirect URL');
    return true;
  }
}
