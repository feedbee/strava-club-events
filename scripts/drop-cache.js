#!/usr/bin/env node
/**
 * Drop cache entries for a given user.
 *
 * Usage:
 *   node scripts/drop-cache.js <userId>
 *
 * Environment variables:
 *   CACHE_DRIVER   - 'memory' or 'mongodb' (default: 'memory')
 *   MONGODB_URI    - MongoDB connection string (default: mongodb://localhost:27017)
 *   MONGODB_DB     - MongoDB database name (default: strava-club-events)
 */

import AbstractCache from '../src/cache/abstract-cache.js';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/drop-cache.js <userId>');
  process.exit(1);
}

const driver = process.env.CACHE_DRIVER || 'memory';
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const mongoDb = process.env.MONGODB_DB || 'strava-club-events';

console.log(`Cache driver: ${driver}`);
console.log(`Dropping cache for user: ${userId}`);

let cache;
try {
  cache = await AbstractCache.create(driver, {
    uri: mongoUri,
    dbName: mongoDb,
    collectionName: 'cache',
  });

  const deleted = await cache.clearUserData(userId);
  console.log(`Deleted ${deleted} cache entries for user ${userId}.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  if (cache?.close) await cache.close();
}
