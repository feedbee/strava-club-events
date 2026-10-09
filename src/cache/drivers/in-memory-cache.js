import AbstractCache from '../abstract-cache.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.create('cache:memory');

/**
 * In-memory cache implementation
 * @extends AbstractCache
 */
class InMemoryCache extends AbstractCache {
  /**
   * Create a new InMemoryCache instance
   * @param {Object} [options] - Cache options
   * @param {number} [options.defaultTTL=900000] - Default TTL in milliseconds (15 minutes)
   */
  constructor(options = {}) {
    super();
    /** @type {Map<string, CacheEntry>} */
    this.store = new Map();
    this.defaultTTL = options.defaultTTL || 15 * 60 * 1000; // 15 minutes default
    this.initialized = false;
    this.maxEntries = options.maxEntries ?? 1000;
    this.maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    this.bytes = 0;
  }

  /**
   * Initialize the cache
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    // No special initialization needed for in-memory cache
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<CacheEntry|null>}
   */
  async get(key) {
    if (!this.initialized) await this.init();
    
    const entry = this.store.get(key);
    if (!entry) {
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    }
    
    // Check if entry is expired
    if (entry.expiresAt < Date.now()) {
      logger.debug(`Cache expired for key: ${key}`);
      await this.del(key);
      return null;
    }

    this.store.delete(key);
    this.store.set(key, entry);
    logger.debug(`Cache hit for key: ${key}`);
    return entry.data;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.initialized) await this.init();
    
    const expiresAt = Date.now() + ttl;
    const bytes = Buffer.byteLength(JSON.stringify(value));
    await this.del(key);
    for (const [oldKey, entry] of this.store) {
      if (entry.expiresAt <= Date.now()) await this.del(oldKey);
    }
    if (bytes > this.maxBytes) return false;
    while (this.store.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      await this.del(this.store.keys().next().value);
    }
    this.store.set(key, { data: value, expiresAt, bytes });
    this.bytes += bytes;
    
    const ttlInSeconds = Math.ceil(ttl / 1000);
    logger.debug(`Cache set for key: ${key}, TTL: ${ttlInSeconds}s`);
    
    return true;
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!this.initialized) await this.init();
    const entry = this.store.get(key);
    const deleted = this.store.delete(key);
    if (entry) this.bytes -= entry.bytes;
    if (deleted) {
      logger.debug(`Cache deleted for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of deleted entries
   */
  async clearUserData(userId) {
    if (!this.initialized) await this.init();
    
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(`${userId}:`)) {
        await this.del(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.debug(`Cleared ${deletedCount} cache entries for user: ${userId}`);
    }
    
    return deletedCount;
  }
  async close() { this.store.clear(); this.bytes = 0; }
}

export default InMemoryCache;
