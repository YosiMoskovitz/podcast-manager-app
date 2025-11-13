import userKeyManager from '../services/userKeyManager.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to load and attach user's encryption key to request
 * Must be used after authentication middleware
 */
export async function loadUserKey(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Load user's decrypted encryption key
    const userKey = await userKeyManager.getUserKey(req.user.id);
    req.userKey = userKey;
    
    next();
  } catch (error) {
    logger.error('Error loading user encryption key:', error);
    res.status(500).json({ error: 'Encryption key error' });
  }
}

/**
 * Decrypt a single document
 * @param {Object} doc - Mongoose document
 * @param {Buffer} userKey - User's encryption key
 */
export function decryptDocument(doc, userKey) {
  if (!doc || !userKey) return doc;
  if (typeof doc.decrypt === 'function') {
    doc.decrypt(userKey);
  }
  return doc;
}

/**
 * Decrypt an array of documents
 * @param {Array} docs - Array of Mongoose documents
 * @param {Buffer} userKey - User's encryption key
 */
export function decryptDocuments(docs, userKey) {
  if (!docs || !userKey) return docs;
  return docs.map(doc => decryptDocument(doc, userKey));
}

/**
 * Encrypt a document before saving
 * @param {Object} doc - Mongoose document
 * @param {Buffer} userKey - User's encryption key
 */
export function encryptDocument(doc, userKey) {
  if (!doc || !userKey) return doc;
  if (typeof doc.encrypt === 'function') {
    doc.encrypt(userKey);
  }
  return doc;
}
