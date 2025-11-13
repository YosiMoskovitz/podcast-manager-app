import mongoose from 'mongoose';
import encryptionService from '../services/encryption.js';

const userSchema = new mongoose.Schema({
  // Hashed Google ID for secure lookup (not encrypted, but pseudonymous)
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Hashed email for lookup (HMAC-SHA256)
  // Original email is not stored - cannot be reversed
  emailHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Encrypted email for display purposes
  encryptedEmail: {
    type: String,
    required: true
  },
  // Encrypted display name
  encryptedName: {
    type: String,
    required: true
  },
  // Encrypted profile picture URL
  encryptedPicture: {
    type: String
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual field for decrypted name (not stored in DB)
userSchema.virtual('name').get(function() {
  return this._decryptedName || '[Encrypted]';
}).set(function(value) {
  this._decryptedName = value;
});

// Virtual field for decrypted email (not stored in DB)
userSchema.virtual('email').get(function() {
  return this._decryptedEmail || '[Encrypted]';
}).set(function(value) {
  this._decryptedEmail = value;
});

// Virtual field for decrypted picture (not stored in DB)
userSchema.virtual('picture').get(function() {
  return this._decryptedPicture;
}).set(function(value) {
  this._decryptedPicture = value;
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

/**
 * Decrypt user fields using their encryption key
 * @param {Buffer} userKey - User's decrypted encryption key
 */
userSchema.methods.decrypt = function(userKey) {
  if (this.encryptedEmail) {
    this._decryptedEmail = encryptionService.decrypt(this.encryptedEmail, userKey);
  }
  if (this.encryptedName) {
    this._decryptedName = encryptionService.decrypt(this.encryptedName, userKey);
  }
  if (this.encryptedPicture) {
    this._decryptedPicture = encryptionService.decrypt(this.encryptedPicture, userKey);
  }
  return this;
};

/**
 * Encrypt user fields before saving
 * @param {Buffer} userKey - User's decrypted encryption key
 */
userSchema.methods.encrypt = function(userKey) {
  if (this._decryptedEmail) {
    this.encryptedEmail = encryptionService.encrypt(this._decryptedEmail, userKey);
  }
  if (this._decryptedName) {
    this.encryptedName = encryptionService.encrypt(this._decryptedName, userKey);
  }
  if (this._decryptedPicture) {
    this.encryptedPicture = encryptionService.encrypt(this._decryptedPicture, userKey);
  }
};

export default mongoose.model('User', userSchema);
