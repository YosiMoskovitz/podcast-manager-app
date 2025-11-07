import express from 'express';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import DownloadHistory from '../models/DownloadHistory.js';
import Stats from '../models/Stats.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get current statistics
router.get('/current', async (req, res) => {
  try {
    const totalPodcasts = await Podcast.countDocuments();
    const activePodcasts = await Podcast.countDocuments({ enabled: true });
    const totalEpisodes = await Episode.countDocuments();
    const downloadedEpisodes = await Episode.countDocuments({ downloaded: true });
    const failedDownloads = await Episode.countDocuments({ status: 'failed' });
    const pendingDownloads = await Episode.countDocuments({ status: 'pending' });
    
    // Calculate total storage
    const storageResult = await Episode.aggregate([
      { $match: { fileSize: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const totalStorageUsed = storageResult[0]?.total || 0;
    
    // Get recent downloads (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const downloadsToday = await DownloadHistory.countDocuments({
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
    
    const filter = {};
    if (podcast) filter.podcast = podcast;
    
    const downloads = await DownloadHistory.find(filter)
      .populate('episode', 'title')
      .populate('podcast', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(downloads);
  } catch (error) {
    logger.error('Error fetching download history:', error);
    res.status(500).json({ error: 'Failed to fetch download history' });
  }
});

// Get podcast statistics
router.get('/podcasts', async (req, res) => {
  try {
    const podcasts = await Podcast.find();
    
    const podcastStats = await Promise.all(
      podcasts.map(async (podcast) => {
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
