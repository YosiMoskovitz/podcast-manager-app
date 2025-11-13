import mongoose from 'mongoose';

const podcastSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  rssUrl: {
    type: String,
    required: true
  },
  description: String,
  imageUrl: String,
  author: String,
  folderName: String,
  driveFolderName: String, // Custom name for Google Drive folder
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

// Compound unique index: name must be unique per user
podcastSchema.index({ userId: 1, name: 1 }, { unique: true });

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
