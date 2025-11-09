import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Download settings
  maxEpisodesPerCheck: {
    type: Number,
    default: 5,
    min: 1,
    max: 50
  },
  maxConcurrentDownloads: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  checkIntervalHours: {
    type: Number,
    default: 6,
    min: 1,
    max: 168 // 1 week
  },
  
  // Storage settings
  defaultKeepEpisodeCount: {
    type: Number,
    default: 10,
    min: 0,
    max: 1000
  },
  
  // Auto-check settings
  autoCheckEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// One settings config per user
systemSettingsSchema.statics.getSettings = async function(userId) {
  let settings = await this.findOne({ userId });
  if (!settings) {
    settings = await this.create({ userId });
  }
  return settings;
};

export default mongoose.model('SystemSettings', systemSettingsSchema);
