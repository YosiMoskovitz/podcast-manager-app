import UserEncryptionKey from '../models/UserEncryptionKey.js';
import encryptionService from './encryption.js';
import { logger } from '../utils/logger.js';

/**
 * User Key Manager
 * Handles loading and caching of user encryption keys
 */
class UserKeyManager {
  constructor() {
    // In-memory cache of decrypted user keys (userId -> Buffer)
    // Keys are cached per request/session for performance
    this.keyCache = new Map();
  }

  /**
   * Get a user's decrypted encryption key
   * @param {string} userId - User's MongoDB ObjectId
   * @returns {Promise<Buffer>} Decrypted user key
   */
  async getUserKey(userId) {
    const userIdStr = userId.toString();
    
    // Check cache first
    if (this.keyCache.has(userIdStr)) {
      return this.keyCache.get(userIdStr);
    }

    // Load from database
    const keyDoc = await UserEncryptionKey.findOne({ userId });
    if (!keyDoc) {
      throw new Error(`Encryption key not found for user ${userId}`);
    }

    // Decrypt the user's key using master key
    const userKey = encryptionService.decryptUserKey(keyDoc.encryptedKey);
    
    // Cache it
    this.keyCache.set(userIdStr, userKey);
    
    return userKey;
  }

  /**
   * Create a new encryption key for a user
   * @param {string} userId - User's MongoDB ObjectId
   * @returns {Promise<Buffer>} The new user key
   */
  async createUserKey(userId) {
    // Generate new key
    const userKey = encryptionService.generateUserKey();
    const encryptedUserKey = encryptionService.encryptUserKey(userKey);
    
    // Store in database
    await UserEncryptionKey.create({
      userId,
      encryptedKey: encryptedUserKey
    });
    
    // Cache it
    this.keyCache.set(userId.toString(), userKey);
    
    logger.info(`Created encryption key for user ${userId}`);
    return userKey;
  }

  /**
   * Clear cache for a specific user (e.g., after key rotation)
   * @param {string} userId - User's MongoDB ObjectId
   */
  clearCache(userId) {
    this.keyCache.delete(userId.toString());
  }

  /**
   * Clear all cached keys
   */
  clearAllCache() {
    this.keyCache.clear();
  }
}

// Singleton instance
const userKeyManager = new UserKeyManager();

export default userKeyManager;
