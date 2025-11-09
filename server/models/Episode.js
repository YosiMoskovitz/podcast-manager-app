import mongoose from 'mongoose';

const episodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  podcast: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Podcast',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  guid: {
    type: String,
    required: true
  },
  pubDate: Date,
  audioUrl: String,
  duration: String,
  fileSize: Number,
  downloaded: {
    type: Boolean,
    default: false
  },
  downloadDate: Date,
  localPath: String,
  cloudFileId: String,
  cloudUrl: String,
  sequenceNumber: Number,
  status: {
    type: String,
    enum: ['pending', 'downloading', 'completed', 'failed'],
    default: 'pending'
  },
  errorMessage: String
}, {
  timestamps: true
});

episodeSchema.index({ podcast: 1, pubDate: -1 });
episodeSchema.index({ guid: 1 });

export default mongoose.model('Episode', episodeSchema);
