import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
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

export default mongoose.model('Stats', statsSchema);
