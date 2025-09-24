import crypto from 'crypto';
import { config } from '../config/index.js';

// Encryption configuration
const ENCRYPTION_KEY = config.encryptionKey;
const ENCRYPTION_PREFIX = ':encrypted::';

// Use a fixed IV for deterministic encryption of the same input
// In production, consider using a random IV for each encryption
const IV_LENGTH = 16; // For AES-256-CBC
const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';

/**
 * Encrypts a string value
 * @param {string} text - The text to encrypt
 * @returns {string} Encrypted string
 */
export const encrypt = (text) => {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    // Return prefix + IV + encrypted data
    return ENCRYPTION_PREFIX + iv.toString(ENCODING) + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts a string
 * @param {string} text - The encrypted text to decrypt
 * @returns {string} Decrypted string
 */
export const decrypt = (text) => {
  if (!text) return text;
  
  // Only process if the text has our encryption prefix
  if (!text.startsWith(ENCRYPTION_PREFIX)) {
    return text;
  }
  
  try {
    // Remove the prefix and split the remaining string
    const encryptedData = text.slice(ENCRYPTION_PREFIX.length);
    const [ivString, encryptedText] = encryptedData.split(':');
    
    if (!ivString || !encryptedText) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(ivString, ENCODING);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedText, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Middleware to automatically encrypt/decrypt sensitive session data
 */
export const sessionEncryptionMiddleware = (req, res, next) => {
  if (!req.session) return next();
  
  // Store original save method
  const originalSave = req.session.save;
  
  // Override save method to handle encryption
  req.session.save = function(callback) {
    if (this.tokens) {
      // Create a copy of tokens to modify
      const tokensToSave = { ...this.tokens };
      
      // Encrypt sensitive fields if they exist
      const sensitiveFields = ['access_token', 'refresh_token'];
      sensitiveFields.forEach(field => {
        if (tokensToSave[field]) {
          tokensToSave[field] = encrypt(tokensToSave[field]);
        }
      });
      
      // Store the potentially encrypted tokens
      this.tokens = tokensToSave;
    }
    
    return originalSave.call(this, callback);
  };
  
  // Decrypt tokens when loading from session
  if (req.session.tokens) {
    try {
      const tokens = { ...req.session.tokens };
      const sensitiveFields = ['access_token', 'refresh_token'];
      
      // Decrypt sensitive fields if they exist and are encrypted
      sensitiveFields.forEach(field => {
        if (tokens[field] && typeof tokens[field] === 'string') {
          tokens[field] = decrypt(tokens[field]);
        }
      });
      
      // Replace with decrypted tokens
      req.session.tokens = tokens;
    } catch (error) {
      console.error('Failed to decrypt session tokens:', error);
      // Clear invalid session data
      req.session.tokens = {};
      req.session.encryptedTokens = {};
    }
  }
  
  next();
};
