import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  totalPodcasts: Number,
  activePodcasts: Number,
  totalEpisodes: Number,
  downloadedEpisodes: Number,
  failedDownloads: Number,
  totalStorageUsed: Number, // in bytes
  downloadsToday: Number,
  lastCheckRun: Date
}, {
  timestamps: true
});

// Compound unique index: date must be unique per user
statsSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model('Stats', statsSchema);
