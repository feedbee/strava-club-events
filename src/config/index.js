function getConfig() {
  const PORT = process.env.PORT || 3000;
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecret';
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Missing CLIENT_ID or CLIENT_SECRET in environment");
    process.exit(1);
  }

  return {
    port: PORT,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    sessionSecret: SESSION_SECRET,
    redirectUri: `http://localhost:${PORT}/callback`,
    stravaAuthUrl: (clientId, redirectUri) => 
      `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=read`
  };
}

export const config = getConfig();
