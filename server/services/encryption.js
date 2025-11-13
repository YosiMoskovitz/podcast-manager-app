import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encryption Service
 * Provides per-user encryption with a master key system
 * - Each user has their own unique encryption key
 * - User keys are encrypted with a master key
 * - All sensitive data is encrypted at rest
 */
class EncryptionService {
  constructor() {
    // Master key for encrypting user-specific keys
    // This should be stored securely (env variable, key vault, etc.)
    this.masterKey = null;
  }

  /**
   * Initialize the encryption service with a master key
   * @param {string} masterKeyHex - Master key in hex format (64 chars = 32 bytes)
   */
  initialize(masterKeyHex) {
    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error('Master key must be 64 hex characters (32 bytes)');
    }
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    logger.info('Encryption service initialized');
  }

  /**
   * Generate a new random encryption key for a user
   * @returns {Buffer} 32-byte encryption key
   */
  generateUserKey() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * Encrypt a user's encryption key with the master key
   * @param {Buffer} userKey - The user's encryption key
   * @returns {string} Encrypted key in format: iv:authTag:encryptedKey (hex)
   */
  encryptUserKey(userKey) {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(userKey),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Return as iv:authTag:encrypted (all in hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a user's encryption key using the master key
   * @param {string} encryptedUserKey - Encrypted key in format: iv:authTag:encryptedKey
   * @returns {Buffer} Decrypted user key
   */
  decryptUserKey(encryptedUserKey) {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    const [ivHex, authTagHex, encryptedHex] = encryptedUserKey.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  }

  /**
   * Encrypt data with a user's key
   * @param {string} plaintext - Data to encrypt
   * @param {Buffer} userKey - User's encryption key
   * @returns {string} Encrypted data in format: iv:authTag:encrypted (hex)
   */
  encrypt(plaintext, userKey) {
    if (!plaintext) return null;
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, userKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt data with a user's key
   * @param {string} encryptedData - Encrypted data in format: iv:authTag:encrypted
   * @param {Buffer} userKey - User's encryption key
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData, userKey) {
    if (!encryptedData) return null;
    
    try {
      const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, userKey, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash email for pseudonymous lookup
   * Uses HMAC for consistent hashing
   * @param {string} email - Email to hash
   * @returns {string} Hashed email (hex)
   */
  hashEmail(email) {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }
    
    const normalized = email.toLowerCase().trim();
    const hmac = crypto.createHmac('sha256', this.masterKey);
    hmac.update(normalized);
    return hmac.digest('hex');
  }

  /**
   * Generate a random salt
   * @returns {string} Salt in hex format
   */
  generateSalt() {
    return crypto.randomBytes(SALT_LENGTH).toString('hex');
  }

  /**
   * Create a deterministic ID from googleId for consistent user lookup
   * @param {string} googleId - Google OAuth ID
   * @returns {string} Hashed ID
   */
  hashGoogleId(googleId) {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }
    
    const hmac = crypto.createHmac('sha256', this.masterKey);
    hmac.update(googleId);
    return hmac.digest('hex');
  }
}

// Singleton instance
const encryptionService = new EncryptionService();

export default encryptionService;
