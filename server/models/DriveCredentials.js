import mongoose from 'mongoose';
import crypto from 'crypto';
import '../config/env.js'; // Load environment variables first

// IMPORTANT: Encryption key MUST be set in .env to prevent corruption on restart
if (!process.env.ENCRYPTION_KEY) {
  console.error('FATAL: ENCRYPTION_KEY is missing!');
  console.error('This should not happen if .env is configured correctly.');
  throw new Error('ENCRYPTION_KEY is not set in environment variables. Please set it in .env file before storing credentials.');
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

// Encryption helpers
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const driveCredentialsSchema = new mongoose.Schema({
  // OAuth2 Client credentials (from Google Console JSON)
  clientId: String,
  clientSecret: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  redirectUri: String,
  
  // OAuth2 Token (after user authorizes)
  accessToken: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  refreshToken: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  tokenExpiry: Date,
  
  // Original JSON files stored encrypted
  credentialsJson: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  tokenJson: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  
  // Configuration
  folderId: String,
  enabled: {
    type: Boolean,
    default: false
  },
  
  // Status
  lastSync: Date,
  status: {
    type: String,
    enum: ['not_configured', 'credentials_uploaded', 'needs_authorization', 'active', 'error'],
    default: 'not_configured'
  },
  errorMessage: String
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Singleton pattern - only one config per app
driveCredentialsSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

export default mongoose.model('DriveCredentials', driveCredentialsSchema);
