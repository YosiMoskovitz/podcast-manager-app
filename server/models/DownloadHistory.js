import mongoose from 'mongoose';

const downloadHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  episode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Episode',
    required: true
  },
  podcast: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Podcast',
    required: true
  },
  status: {
    type: String,
    enum: ['started', 'completed', 'failed'],
    required: true
  },
  startTime: Date,
  endTime: Date,
  duration: Number, // in seconds
  bytesDownloaded: Number,
  errorMessage: String,
  uploadedToCloud: {
    type: Boolean,
    default: false
  },
  cloudUploadTime: Date
}, {
  timestamps: true
});

downloadHistorySchema.index({ podcast: 1, createdAt: -1 });

export default mongoose.model('DownloadHistory', downloadHistorySchema);
