import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Singleton pattern - only one config per app
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model('SystemSettings', systemSettingsSchema);
