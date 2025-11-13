import mongoose from 'mongoose';
import encryptionService from '../services/encryption.js';

const podcastSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ENCRYPTED FIELDS - stored encrypted at rest
  encryptedName: {
    type: String,
    required: true
  },
  encryptedRssUrl: {
    type: String,
    required: true
  },
  encryptedDescription: String,
  encryptedImageUrl: String,
  encryptedAuthor: String,
  encryptedFolderName: String,
  encryptedDriveFolderName: String,
  // END ENCRYPTED FIELDS
  
  enabled: {
    type: Boolean,
    default: true
  },
  lastChecked: Date,
  totalEpisodes: {
    type: Number,
    default: 0
  },
  downloadedEpisodes: {
    type: Number,
    default: 0
  },
  keepEpisodeCount: {
    type: Number,
    default: 10
  },
  driveFolderId: String,
  episodeCounter: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index on userId only (name is encrypted)
podcastSchema.index({ userId: 1 });

// Virtual fields for decrypted data (not stored in DB)
podcastSchema.virtual('name').get(function() {
  return this._decryptedName || '[Encrypted]';
}).set(function(value) {
  this._decryptedName = value;
});

podcastSchema.virtual('rssUrl').get(function() {
  return this._decryptedRssUrl;
}).set(function(value) {
  this._decryptedRssUrl = value;
});

podcastSchema.virtual('description').get(function() {
  return this._decryptedDescription;
}).set(function(value) {
  this._decryptedDescription = value;
});

podcastSchema.virtual('imageUrl').get(function() {
  return this._decryptedImageUrl;
}).set(function(value) {
  this._decryptedImageUrl = value;
});

podcastSchema.virtual('author').get(function() {
  return this._decryptedAuthor;
}).set(function(value) {
  this._decryptedAuthor = value;
});

podcastSchema.virtual('folderName').get(function() {
  return this._decryptedFolderName;
}).set(function(value) {
  this._decryptedFolderName = value;
});

podcastSchema.virtual('driveFolderName').get(function() {
  return this._decryptedDriveFolderName;
}).set(function(value) {
  this._decryptedDriveFolderName = value;
});

// Ensure virtuals are included in JSON
podcastSchema.set('toJSON', { virtuals: true });
podcastSchema.set('toObject', { virtuals: true });

/**
 * Decrypt podcast fields using user's encryption key
 * @param {Buffer} userKey - User's decrypted encryption key
 */
podcastSchema.methods.decrypt = function(userKey) {
  this._decryptedName = encryptionService.decrypt(this.encryptedName, userKey);
  this._decryptedRssUrl = encryptionService.decrypt(this.encryptedRssUrl, userKey);
  this._decryptedDescription = encryptionService.decrypt(this.encryptedDescription, userKey);
  this._decryptedImageUrl = encryptionService.decrypt(this.encryptedImageUrl, userKey);
  this._decryptedAuthor = encryptionService.decrypt(this.encryptedAuthor, userKey);
  this._decryptedFolderName = encryptionService.decrypt(this.encryptedFolderName, userKey);
  this._decryptedDriveFolderName = encryptionService.decrypt(this.encryptedDriveFolderName, userKey);
  return this;
};

/**
 * Encrypt podcast fields before saving
 * @param {Buffer} userKey - User's decrypted encryption key
 */
podcastSchema.methods.encrypt = function(userKey) {
  if (this._decryptedName !== undefined) {
    this.encryptedName = encryptionService.encrypt(this._decryptedName, userKey);
  }
  if (this._decryptedRssUrl !== undefined) {
    this.encryptedRssUrl = encryptionService.encrypt(this._decryptedRssUrl, userKey);
  }
  if (this._decryptedDescription !== undefined) {
    this.encryptedDescription = encryptionService.encrypt(this._decryptedDescription, userKey);
  }
  if (this._decryptedImageUrl !== undefined) {
    this.encryptedImageUrl = encryptionService.encrypt(this._decryptedImageUrl, userKey);
  }
  if (this._decryptedAuthor !== undefined) {
    this.encryptedAuthor = encryptionService.encrypt(this._decryptedAuthor, userKey);
  }
  if (this._decryptedFolderName !== undefined) {
    this.encryptedFolderName = encryptionService.encrypt(this._decryptedFolderName, userKey);
  }
  if (this._decryptedDriveFolderName !== undefined) {
    this.encryptedDriveFolderName = encryptionService.encrypt(this._decryptedDriveFolderName, userKey);
  }
};

// Reserve a contiguous block of sequence numbers atomically.
// Returns { start, end }
podcastSchema.statics.reserveSequenceBlock = async function(podcastId, count) {
  if (!count || count <= 0) return { start: null, end: null };
  const res = await this.findByIdAndUpdate(
    podcastId,
    { $inc: { episodeCounter: count } },
    { new: true }
  );
  const end = res.episodeCounter;
  const start = end - count + 1;
  return { start, end };
};

export default mongoose.model('Podcast', podcastSchema);
