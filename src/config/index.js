import { randomBytes } from 'node:crypto';

function getConfig() {
  const production = process.env.NODE_ENV === 'production';
  function positiveInteger(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
    const value = process.env[name];
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maximum) {
      throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
    }
    return number;
  }
  function booleanSetting(name, fallback) {
    const value = process.env[name];
    if (value === undefined) return fallback;
    if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false`);
    return value === 'true';
  }

  // Server bind configuration
  const PORT = positiveInteger('PORT', 3000, 65535);
  const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces by default
  
  // Public URL configuration (for callbacks and redirects)
  const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  const publicUrl = new URL(PUBLIC_URL);
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password ||
      publicUrl.search || publicUrl.hash || (production && publicUrl.protocol !== 'https:')) {
    throw new Error('PUBLIC_URL must be an HTTP(S) base URL; production requires HTTPS');
  }
  // Retained only to reject obsolete callback forwarding configuration explicitly.
  const DEV_CALLBACK_REDIRECT = process.env.DEV_CALLBACK_REDIRECT || '';
  
  // App secrets
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const SESSION_SECRET = process.env.SESSION_SECRET || (production ? '' : randomBytes(32).toString('hex'));
  if (production && (SESSION_SECRET.trim().length < 32 || SESSION_SECRET === 'supersecret')) {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production');
  }
  if (DEV_CALLBACK_REDIRECT) {
    throw new Error('DEV_CALLBACK_REDIRECT is disabled; configure a direct PUBLIC_URL callback in Strava');
  }
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing CLIENT_ID or CLIENT_SECRET in environment");
  }

  // Session configuration
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;
  const SESSION_DRIVER = process.env.SESSION_DRIVER || 'memory';
  const SESSION_TRUST_PROXY = booleanSetting('SESSION_TRUST_PROXY', false);
  const SESSION_SECURE_COOKIE = booleanSetting('SESSION_SECURE_COOKIE', production);
  if (production && !SESSION_SECURE_COOKIE) throw new Error('SESSION_SECURE_COOKIE must be true in production');
  if (!['memory', 'mongodb'].includes(SESSION_DRIVER) || (production && SESSION_DRIVER !== 'mongodb')) {
    throw new Error('SESSION_DRIVER must be memory or mongodb; production requires mongodb');
  }
  if (SESSION_DRIVER === 'mongodb' && !process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for MongoDB sessions');
  if (ENCRYPTION_KEY && !/^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY)) throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters');
  // Stay within JavaScript Date's supported range, including the current time.
  const maxDuration = 8640000000000000 - Date.now();
  const SESSION_MAX_AGE = positiveInteger('SESSION_MAX_AGE', 24 * 60 * 60 * 1000, maxDuration);
  const SESSION_TTL = positiveInteger('SESSION_TTL', 24 * 60 * 60, Math.floor(maxDuration / 1000));

  // Cache configuration
  const CACHE_DRIVER = process.env.CACHE_DRIVER ?? 'memory';
  if (!['memory', 'mongodb'].includes(CACHE_DRIVER)) throw new Error('CACHE_DRIVER must be memory or mongodb');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const MONGODB_DB = process.env.MONGODB_DB || 'strava-club-events';
  const CACHE_TTL = {
    DEFAULT: positiveInteger('CACHE_TTL_DEFAULT', 15 * 60 * 1000, maxDuration),
    CLUBS: positiveInteger('CACHE_TTL_CLUBS', 15 * 60 * 1000, maxDuration),
    EVENTS: positiveInteger('CACHE_TTL_EVENTS', 15 * 60 * 1000, maxDuration),
    ROUTE: positiveInteger('CACHE_TTL_ROUTE', 60 * 60 * 1000, maxDuration),
  };

  return {
    // Server configuration
    port: PORT,
    host: HOST,
    
    // Public URL configuration
    publicUrl: PUBLIC_URL,
    redirectUri: `${PUBLIC_URL}/callback`,
    devCallbackRedirect: DEV_CALLBACK_REDIRECT,
    
    // App secrets
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    session: {
      secret: SESSION_SECRET,
      driver: SESSION_DRIVER,
      trustProxy: SESSION_TRUST_PROXY,
      secureCookie: SESSION_SECURE_COOKIE,
      maxAge: SESSION_MAX_AGE,
      ttl: SESSION_TTL,
      mongodb: {
        uri: MONGODB_URI,
        dbName: MONGODB_DB,
        collectionName: 'sessions'
      }
    },
    encryptionKey: ENCRYPTION_KEY,
    stravaAuthUrl: (clientId, redirectUri, state) => {
      const url = new URL('https://www.strava.com/oauth/authorize');
      url.search = new URLSearchParams({ client_id: clientId, response_type: 'code',
        redirect_uri: redirectUri, approval_prompt: 'auto', scope: 'read', state }).toString();
      return url.toString();
    },
    
    // Cache configuration
    cache: {
      driver: CACHE_DRIVER,
      ttl: CACHE_TTL,
      mongodb: {
        uri: MONGODB_URI,
        dbName: MONGODB_DB,
        collectionName: 'cache'
      }
    }
  };
}

export const config = getConfig();
