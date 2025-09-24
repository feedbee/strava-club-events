function getConfig() {
  // Server bind configuration
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces by default
  
  // Public URL configuration (for callbacks and redirects)
  const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  // Optional dev callback redirect target (used to bounce OAuth callback to a dev machine)
  const DEV_CALLBACK_REDIRECT = process.env.DEV_CALLBACK_REDIRECT || '';
  
  // App secrets
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecret';
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Missing CLIENT_ID or CLIENT_SECRET in environment");
    process.exit(1);
  }

  // Session configuration
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null; // enrypt session data if the variable is set
  const SESSION_DRIVER = process.env.SESSION_DRIVER || 'memory';
  const SESSION_TRUST_PROXY = process.env.SESSION_TRUST_PROXY || 'false';
  const SESSION_SECURE_COOKIE = process.env.SESSION_SECURE_COOKIE || 'false';
  const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE || 24 * 60 * 60 * 1000; // 24 hours
  const SESSION_TTL = process.env.SESSION_TTL || 24 * 60 * 60; // Default 24 hours in seconds

  // Cache configuration
  const CACHE_DRIVER = process.env.CACHE_DRIVER || 'memory'; // 'memory' or 'mongodb'
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const MONGODB_DB = process.env.MONGODB_DB || 'strava-club-events';
  const CACHE_TTL = {
    DEFAULT: parseInt(process.env.CACHE_TTL_DEFAULT) || 15 * 60 * 1000, // 15 minutes
    CLUBS: parseInt(process.env.CACHE_TTL_CLUBS) || 15 * 60 * 1000, // 15 minutes
    EVENTS: parseInt(process.env.CACHE_TTL_EVENTS) || 15 * 60 * 1000, // 15 minutes
    ROUTE: parseInt(process.env.CACHE_TTL_ROUTE) || 60 * 60 * 1000, // 1 hour
  };

  return {
    // Server configuration
    port: PORT,
    host: HOST,
    
    // Public URL configuration
    publicUrl: PUBLIC_URL,
    redirectUri: `${PUBLIC_URL}/callback`,
    devCallbackRedirect: DEV_CALLBACK_REDIRECT, // Optional dev callback redirect target
    
    // App secrets
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    session: {
      secret: SESSION_SECRET,
      driver: SESSION_DRIVER,
      trustProxy: SESSION_TRUST_PROXY === 'true',
      secureCookie: SESSION_SECURE_COOKIE === 'true',
      maxAge: parseInt(SESSION_MAX_AGE),
      ttl: parseInt(SESSION_TTL),
      mongodb: {
        uri: MONGODB_URI,
        dbName: MONGODB_DB,
        collectionName: 'sessions'
      }
    },
    encryptionKey: ENCRYPTION_KEY,
    stravaAuthUrl: (clientId, redirectUri) => 
      `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=read`,
    
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
