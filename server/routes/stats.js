import express from 'express';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import DownloadHistory from '../models/DownloadHistory.js';
import Stats from '../models/Stats.js';
import { logger } from '../utils/logger.js';
import { loadUserKey, decryptDocuments, decryptDocument } from '../middleware/encryption.js';

const router = express.Router();

// Apply encryption middleware to all routes
router.use(loadUserKey);

// Get current statistics
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    const totalPodcasts = await Podcast.countDocuments({ userId });
    const activePodcasts = await Podcast.countDocuments({ userId, enabled: true });
    const totalEpisodes = await Episode.countDocuments({ userId });
    const downloadedEpisodes = await Episode.countDocuments({ userId, downloaded: true });
    const failedDownloads = await Episode.countDocuments({ userId, status: 'failed' });
    const pendingDownloads = await Episode.countDocuments({ userId, status: 'pending' });
    
    // Calculate total storage
    const storageResult = await Episode.aggregate([
      { $match: { userId: req.user._id, fileSize: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const totalStorageUsed = storageResult[0]?.total || 0;
    
    // Get recent downloads (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const downloadsToday = await DownloadHistory.countDocuments({
      userId,
      status: 'completed',
      createdAt: { $gte: yesterday }
    });
    
    res.json({
      totalPodcasts,
      activePodcasts,
      totalEpisodes,
      downloadedEpisodes,
      failedDownloads,
      pendingDownloads,
      totalStorageUsed,
      downloadsToday,
      lastUpdated: new Date()
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get historical statistics
router.get('/history', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const history = await Stats.find({
      userId: req.user.id,
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    res.json(history);
  } catch (error) {
    logger.error('Error fetching statistics history:', error);
    res.status(500).json({ error: 'Failed to fetch statistics history' });
  }
});

// Get download history
router.get('/downloads', async (req, res) => {
  try {
    const { limit = 50, podcast } = req.query;
    
    const filter = { userId: req.user.id };
    if (podcast) filter.podcast = podcast;
    
    const downloads = await DownloadHistory.find(filter)
      .populate('episode')
      .populate('podcast')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    // Decrypt populated episodes and podcasts
    downloads.forEach(download => {
      if (download.episode) {
        decryptDocument(download.episode, req.userKey);
      }
      if (download.podcast) {
        decryptDocument(download.podcast, req.userKey);
      }
    });
    
    res.json(downloads);
  } catch (error) {
    logger.error('Error fetching download history:', error);
    res.status(500).json({ error: 'Failed to fetch download history' });
  }
});

// Get podcast statistics
router.get('/podcasts', async (req, res) => {
  try {
    const podcasts = await Podcast.find({ userId: req.user.id });
    
    // Decrypt all podcasts
    const decryptedPodcasts = decryptDocuments(podcasts, req.userKey);
    
    const podcastStats = await Promise.all(
      decryptedPodcasts.map(async (podcast) => {
        const totalEpisodes = await Episode.countDocuments({ podcast: podcast._id });
        const downloaded = await Episode.countDocuments({ 
          podcast: podcast._id, 
          downloaded: true 
        });
        const failed = await Episode.countDocuments({ 
          podcast: podcast._id, 
          status: 'failed' 
        });
        
        const storageResult = await Episode.aggregate([
          { $match: { podcast: podcast._id, fileSize: { $exists: true } } },
          { $group: { _id: null, total: { $sum: '$fileSize' } } }
        ]);
        const storage = storageResult[0]?.total || 0;
        
        return {
          podcast: {
            _id: podcast._id,
            name: podcast.name,
            imageUrl: podcast.imageUrl
          },
          totalEpisodes,
          downloaded,
          failed,
          storage
        };
      })
    );
    
    res.json(podcastStats);
  } catch (error) {
    logger.error('Error fetching podcast statistics:', error);
    res.status(500).json({ error: 'Failed to fetch podcast statistics' });
  }
});

export default router;
