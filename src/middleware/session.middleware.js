import session from 'express-session';
import { config } from '../config/index.js';

/**
 * Session middleware configuration
 */
export const sessionMiddleware = session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  // Add any additional session configuration here
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});