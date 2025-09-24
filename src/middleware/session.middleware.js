import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from '../config/index.js';
import { sessionEncryptionMiddleware } from '../utils/encryption.util.js';

// Check if encryption is enabled
const ENCRYPTION_ENABLED = Boolean(config.encryptionKey);
const SESSION_DRIVER = config.session.driver || 'memory';

// Session store configuration
const getSessionStore = () => {
  if (SESSION_DRIVER === 'mongodb') {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI is not set, falling back to memory store');
      return null;
    }
    
    return MongoStore.create({
      mongoUrl: config.session.mongodb.uri,
      dbName: config.session.mongodb.dbName,
      collectionName: config.session.mongodb.collectionName,
      ttl: parseInt(config.session.ttl) || 24 * 60 * 60, // Default 24 hours in seconds
      touchAfter: 300, // 5 minutes in seconds (do not refresh session on every request unless modified; do it once per 5 minutes)
      stringify: false // store JSON, not strings
    });
  }
  
  // Default to memory store
  return null;
};

/**
 * Session middleware configuration
 */
export const sessionMiddleware = session({
  secret: config.session.secret,
  resave: false, // Do not resave the session if it has not been modified (MongoDB TTL update is handled by the store when rolling=true)
  saveUninitialized: true, // Save uninitialized sessions
  rolling: true, // Reset the session maxAge on every request
  proxy: config.session.trustProxy === 'true', // Trust proxy if configured
  store: getSessionStore(),
  cookie: {
    secure: config.session.secureCookie 
      ? config.session.secureCookie === 'true' 
      : process.env.NODE_ENV === 'production', // Default to secure in production
    httpOnly: true, // Do not allow access to the session cookie from JavaScript
    maxAge: parseInt(config.session.maxAge) || 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Prevent CSRF attacks
  }
});

// Export middleware based on encryption status
export const secureSessionMiddleware = ENCRYPTION_ENABLED 
  ? [sessionMiddleware, sessionEncryptionMiddleware] 
  : sessionMiddleware;

// Log encryption status
console.log(`📦 Session driver is "${SESSION_DRIVER}", encryption is ${ENCRYPTION_ENABLED ? '🔒 enabled' : '🔓 disabled'}`);