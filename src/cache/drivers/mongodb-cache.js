import { MongoClient } from 'mongodb';
import { Logger } from '../../utils/logger.js';

const logger = Logger.create('cache:mongodb');

/**
 * MongoDB cache implementation
 * @extends AbstractCache
 */
class MongoDBCache {
  /**
   * Create a new MongoDBCache instance
   * @param {Object} [options] - Cache options
   * @param {string} [options.uri] - MongoDB connection string
   * @param {string} [options.dbName='strava_cache'] - Database name
   * @param {string} [options.collectionName='cache'] - Collection name
   * @param {number} [options.defaultTTL=900000] - Default TTL in milliseconds (15 minutes)
   */
  constructor({
    uri = process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName = 'strava-club-evetns',
    collectionName = 'cache',
    defaultTTL = 15 * 60 * 1000, // 15 minutes
  } = {}) {
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.defaultTTL = defaultTTL;
    this.client = null;
    this.db = null;
    this.collection = null;
    this.initialized = false;
  }

  /**
   * Initialize the MongoDB connection and create necessary indexes
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;

    try {
      this.client = new MongoClient(this.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);

      // Create TTL index
      await this.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 } // Delete documents when expiresAt is reached
      );

      // Create index on key for faster lookups
      await this.collection.createIndex({ key: 1 }, { unique: true });
      
      // Create index on userId for faster user data clearing
      await this.collection.createIndex({ userId: 1 });

      this.initialized = true;
      logger.info('MongoDB cache initialized');
    } catch (error) {
      logger.error('Failed to initialize MongoDB cache:', error);
      throw error;
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null if not found/expired
   */
  async get(key) {
    if (!this.initialized) await this.init();

    try {
      const doc = await this.collection.findOne({
        key,
        expiresAt: { $gt: new Date() },
      });

      if (!doc) {
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      logger.debug(`Cache hit for key: ${key}`);
      return doc.value;
    } catch (error) {
      logger.error(`Error getting key ${key} from cache:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {Promise<boolean>} - True if successful
   */
  async set(key, value, ttl) {
    if (!this.initialized) await this.init();

    try {
      const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL));
      const userId = key.split(':')[0]; // Extract userId from key

      await this.collection.updateOne(
        { key },
        {
          $set: {
            key,
            value,
            userId,
            expiresAt,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      logger.debug(`Cache set for key: ${key}, TTL: ${ttl || this.defaultTTL}ms`);
      return true;
    } catch (error) {
      logger.error(`Error setting key ${key} in cache:`, error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async del(key) {
    if (!this.initialized) await this.init();

    try {
      const result = await this.collection.deleteOne({ key });
      const deleted = result.deletedCount > 0;
      
      if (deleted) {
        logger.debug(`Cache deleted for key: ${key}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Error deleting key ${key} from cache:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of deleted entries
   */
  async clearUserData(userId) {
    if (!this.initialized) await this.init();

    try {
      const result = await this.collection.deleteMany({ userId });
      const deletedCount = result.deletedCount || 0;
      
      if (deletedCount > 0) {
        logger.debug(`Cleared ${deletedCount} cache entries for user: ${userId}`);
      }
      
      return deletedCount;
    } catch (error) {
      logger.error(`Error clearing cache for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Close the MongoDB connection
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.initialized = false;
        this.client = null;
        this.db = null;
        this.collection = null;
        logger.info('MongoDB cache connection closed');
      }
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }
}

export default MongoDBCache;
