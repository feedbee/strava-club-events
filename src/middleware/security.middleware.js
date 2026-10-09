import { config } from '../config/index.js';

const policy = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net/npm/fullcalendar@6.1.21/index.global.min.js",
  // FullCalendar injects styles and both it and the UI set element styles at runtime.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' https:",
  "connect-src 'self'",
  "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': policy,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  if (config.publicUrl.startsWith('https://')) {
    res.set('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
}
