function getConfig() {
  const PORT = process.env.PORT || 3000;
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecret';
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Missing CLIENT_ID or CLIENT_SECRET in environment");
    process.exit(1);
  }

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
    port: PORT,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    sessionSecret: SESSION_SECRET,
    redirectUri: `http://localhost:${PORT}/callback`,
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
