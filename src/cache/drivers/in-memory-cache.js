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
      this.store.delete(key);
      return null;
    }

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
    this.store.set(key, { data: value, expiresAt });
    
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
    const deleted = this.store.delete(key);
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
        this.store.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.debug(`Cleared ${deletedCount} cache entries for user: ${userId}`);
    }
    
    return deletedCount;
  }
}

export default InMemoryCache;
