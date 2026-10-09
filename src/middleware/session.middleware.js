import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from '../config/index.js';
import { coordinateSessionStore } from '../utils/session-coordination.js';
import { encryptSessionStore } from '../utils/encryption.util.js';

// Check if encryption is enabled
const ENCRYPTION_ENABLED = Boolean(config.encryptionKey);
const SESSION_DRIVER = config.session.driver || 'memory';

// Session store configuration
const getSessionStore = () => {
  if (SESSION_DRIVER === 'mongodb') {
    return MongoStore.create({
      mongoUrl: config.session.mongodb.uri,
      mongoOptions: { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 15000, writeConcern: { w: 'majority', wtimeoutMS: 5000 } },
      dbName: config.session.mongodb.dbName,
      collectionName: config.session.mongodb.collectionName,
      ttl: config.session.ttl,
      touchAfter: 300, // 5 minutes in seconds (do not refresh session on every request unless modified; do it once per 5 minutes)
      stringify: false // store JSON, not strings
    });
  }
  
  // Default to memory store
  return new session.MemoryStore();
};

/**
 * Session middleware configuration
 */
export const sessionStore = coordinateSessionStore(getSessionStore());
export async function initializeSessionStore() {
  if (sessionStore.collectionP) await sessionStore.collectionP;
}
export async function closeSessionStore() { await sessionStore.close?.(); }
export async function checkSessionStore({ signal }) {
  if (SESSION_DRIVER !== 'mongodb') return;
  const client = await sessionStore.clientP;
  await client.db(config.session.mongodb.dbName).command({ ping: 1 }, { signal, timeoutMS: 1000 });
}

export const sessionMiddleware = session({
  secret: config.session.secret,
  resave: false, // Do not resave the session if it has not been modified (MongoDB TTL update is handled by the store when rolling=true)
  saveUninitialized: false, // Anonymous requests do not allocate sessions
  rolling: true, // Reset the session maxAge on every request
  proxy: config.session.trustProxy, // Trust proxy if configured
  store: ENCRYPTION_ENABLED ? encryptSessionStore(sessionStore) : sessionStore,
  cookie: {
    secure: config.session.secureCookie,
    httpOnly: true, // Do not allow access to the session cookie from JavaScript
    maxAge: config.session.maxAge,
    sameSite: 'lax' // Prevent CSRF attacks
  }
});

// Encryption is performed by the configured store, including regenerated sessions.
export const secureSessionMiddleware = sessionMiddleware;

// Log encryption status
console.log(`📦 Session driver is "${SESSION_DRIVER}", encryption is ${ENCRYPTION_ENABLED ? '🔒 enabled' : '🔓 disabled'}`);
