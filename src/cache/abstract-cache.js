/**
 * @typedef {Object} CacheEntry
 * @property {any} data - The cached data
 * @property {number} expiresAt - Timestamp when the cache entry expires
 */

// Cache driver types
export const DRIVERS = {
  MEMORY: 'memory',
  MONGODB: 'mongodb',  // Will be implemented later
};

/**
 * Abstract base class for cache implementations
 * @abstract
 */
class AbstractCache {
  /**
   * Initialize the cache
   * @abstract
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('Method not implemented');
  }

  /**
   * Get a value from cache
   * @abstract
   * @param {string} key - Cache key
   * @returns {Promise<CacheEntry|null>} - Cached value or null if not found/expired
   */
  async get(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Set a value in cache
   * @abstract
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} - True if successful
   */
  async set(key, value, ttl) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete a value from cache
   * @abstract
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async del(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Clear all cache entries for a specific user
   * @abstract
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of deleted entries
   */
  async clearUserData(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Factory method to create a new cache instance
   * @param {string} [type='memory'] - Cache driver type
   * @param {Object} [options] - Cache options
   * @returns {AbstractCache} - New cache instance
   */
  /**
   * Factory method to create a new cache instance
   * @param {string} [type='memory'] - Cache driver type
   * @param {Object} [options] - Cache options
   * @returns {Promise<AbstractCache>} - Promise that resolves to a new cache instance
   */
  static async create(type = 'memory', options = {}) {
    switch (type) {
      case DRIVERS.MEMORY: {
        const { default: InMemoryCache } = await import('./drivers/in-memory-cache.js');
        return new InMemoryCache(options);
      }
      case DRIVERS.MONGODB: {
        const { default: MongoDBCache } = await import('./drivers/mongodb-cache.js');
        const instance = new MongoDBCache(options);
        await instance.init(); // Ensure the connection is established
        return instance;
      }
      default:
        throw new Error(`Unsupported cache driver: ${type}`);
    }
  }

  /**
   * Generate a cache key for user-specific data
   * @param {string} userId - User ID
   * @param {string} type - Type of data (e.g., 'clubs', 'events')
   * @param {string} [id] - Optional ID for the specific resource
   * @returns {string} - Generated cache key
   */
  static generateKey(userId, type, id = '') {
    return `${userId}:${type}${id ? `:${id}` : ''}`;
  }
}

export default AbstractCache;
