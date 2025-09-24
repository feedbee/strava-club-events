import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from '../config/index.js';

// Session store configuration
const getSessionStore = () => {
  const sessionDriver = process.env.SESSION_DRIVER || 'memory';
  
  if (sessionDriver === 'mongodb') {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI is not set, falling back to memory store');
      return null;
    }
    
    return MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB || 'strava-club-events',
      collectionName: 'sessions',
      ttl: parseInt(process.env.SESSION_TTL) || 24 * 60 * 60, // Default 24 hours in seconds
      touchAfter: 300, // 5 minutes in seconds
      stringify: false
    });
  }
  
  // Default to memory store
  return null;
};

/**
 * Session middleware configuration
 */
export const sessionMiddleware = session({
  secret: config.sessionSecret,
  resave: false, // Do not resave the session if it has not been modified (MongoDB TTL update is handled by the store when rolling=true)
  saveUninitialized: true, // Save uninitialized sessions
  rolling: true, // Reset the session maxAge on every request
  proxy: process.env.SESSION_TRUST_PROXY === 'true', // Trust proxy if configured
  store: getSessionStore(),
  cookie: {
    secure: process.env.SESSION_SECURE_COOKIE 
      ? process.env.SESSION_SECURE_COOKIE === 'true' 
      : process.env.NODE_ENV === 'production', // Default to secure in production
    httpOnly: true, // Do not allow access to the session cookie from JavaScript
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Prevent CSRF attacks
  }
});