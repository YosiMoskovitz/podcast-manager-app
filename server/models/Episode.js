import mongoose from 'mongoose';
import encryptionService from '../services/encryption.js';

const episodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  podcast: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Podcast',
    required: true
  },
  // ENCRYPTED FIELDS - stored encrypted at rest
  encryptedTitle: {
    type: String,
    required: true
  },
  encryptedDescription: String,
  encryptedAudioUrl: String,
  encryptedOriginalFileName: String,
  encryptedImageUrl: String,
  // END ENCRYPTED FIELDS
  
  // GUID can stay unencrypted as it's a technical identifier from RSS
  guid: {
    type: String,
    required: true
  },
  pubDate: Date,
  duration: String,
  fileSize: Number,
  downloaded: {
    type: Boolean,
    default: false
  },
  downloadDate: Date,
  localPath: String,
  cloudFileId: String,
  cloudUrl: String,
  sequenceNumber: Number,
  status: {
    type: String,
    enum: ['pending', 'downloading', 'completed', 'failed'],
    default: 'pending'
  },
  errorMessage: String
}, {
  timestamps: true
});

episodeSchema.index({ podcast: 1, pubDate: -1 });
episodeSchema.index({ guid: 1 });
// Ensure sequenceNumber is unique per podcast when present
episodeSchema.index({ podcast: 1, sequenceNumber: 1 }, { unique: true, partialFilterExpression: { sequenceNumber: { $exists: true } } });

// Virtual fields for decrypted data (not stored in DB)
episodeSchema.virtual('title').get(function() {
  return this._decryptedTitle || '[Encrypted]';
}).set(function(value) {
  this._decryptedTitle = value;
});

episodeSchema.virtual('description').get(function() {
  return this._decryptedDescription;
}).set(function(value) {
  this._decryptedDescription = value;
});

episodeSchema.virtual('audioUrl').get(function() {
  return this._decryptedAudioUrl;
}).set(function(value) {
  this._decryptedAudioUrl = value;
});

episodeSchema.virtual('originalFileName').get(function() {
  return this._decryptedOriginalFileName;
}).set(function(value) {
  this._decryptedOriginalFileName = value;
});

episodeSchema.virtual('imageUrl').get(function() {
  return this._decryptedImageUrl;
}).set(function(value) {
  this._decryptedImageUrl = value;
});

// Ensure virtuals are included in JSON
episodeSchema.set('toJSON', { virtuals: true });
episodeSchema.set('toObject', { virtuals: true });

/**
 * Decrypt episode fields using user's encryption key
 * @param {Buffer} userKey - User's decrypted encryption key
 */
episodeSchema.methods.decrypt = function(userKey) {
  this._decryptedTitle = encryptionService.decrypt(this.encryptedTitle, userKey);
  this._decryptedDescription = encryptionService.decrypt(this.encryptedDescription, userKey);
  this._decryptedAudioUrl = encryptionService.decrypt(this.encryptedAudioUrl, userKey);
  this._decryptedOriginalFileName = encryptionService.decrypt(this.encryptedOriginalFileName, userKey);
  this._decryptedImageUrl = encryptionService.decrypt(this.encryptedImageUrl, userKey);
  return this;
};

/**
 * Encrypt episode fields before saving
 * @param {Buffer} userKey - User's decrypted encryption key
 */
episodeSchema.methods.encrypt = function(userKey) {
  if (this._decryptedTitle !== undefined) {
    this.encryptedTitle = encryptionService.encrypt(this._decryptedTitle, userKey);
  }
  if (this._decryptedDescription !== undefined) {
    this.encryptedDescription = encryptionService.encrypt(this._decryptedDescription, userKey);
  }
  if (this._decryptedAudioUrl !== undefined) {
    this.encryptedAudioUrl = encryptionService.encrypt(this._decryptedAudioUrl, userKey);
  }
  if (this._decryptedOriginalFileName !== undefined) {
    this.encryptedOriginalFileName = encryptionService.encrypt(this._decryptedOriginalFileName, userKey);
  }
  if (this._decryptedImageUrl !== undefined) {
    this.encryptedImageUrl = encryptionService.encrypt(this._decryptedImageUrl, userKey);
  }
};

export default mongoose.model('Episode', episodeSchema);
