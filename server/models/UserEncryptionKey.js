import mongoose from 'mongoose';

/**
 * UserEncryptionKey Model
 * Stores each user's unique encryption key (encrypted with master key)
 * This allows per-user encryption while server can still process data
 */
const userEncryptionKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Encrypted user key (encrypted with master key)
  // Format: iv:authTag:encryptedKey (hex)
  encryptedKey: {
    type: String,
    required: true
  },
  // Key version for rotation support
  keyVersion: {
    type: Number,
    default: 1
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  lastRotated: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure only one key per user
userEncryptionKeySchema.index({ userId: 1 }, { unique: true });

export default mongoose.model('UserEncryptionKey', userEncryptionKeySchema);
