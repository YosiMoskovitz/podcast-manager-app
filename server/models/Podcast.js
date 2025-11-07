import mongoose from 'mongoose';

const podcastSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  rssUrl: {
    type: String,
    required: true
  },
  description: String,
  imageUrl: String,
  author: String,
  folderName: String,
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

export default mongoose.model('Podcast', podcastSchema);
