import express from 'express';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import { parseFeed, getLatestEpisodes } from '../services/rssParser.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all podcasts
router.get('/', async (req, res) => {
  try {
    const podcasts = await Podcast.find({ userId: req.user.id }).sort({ name: 1 });
    res.json(podcasts);
  } catch (error) {
    logger.error('Error fetching podcasts:', error);
    res.status(500).json({ error: 'Failed to fetch podcasts' });
  }
});

// Get single podcast with episodes
router.get('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    const episodes = await Episode.find({ podcast: req.params.id, userId: req.user.id })
      .sort({ pubDate: -1 })
      .limit(50);
    
    res.json({ podcast, episodes });
  } catch (error) {
    logger.error('Error fetching podcast:', error);
    res.status(500).json({ error: 'Failed to fetch podcast' });
  }
});

// Create new podcast
router.post('/', async (req, res) => {
  try {
    const { name, rssUrl, folderName, driveFolderName, keepEpisodeCount } = req.body;
    
    // Validate RSS feed
    const feedData = await parseFeed(rssUrl);
    
    const podcast = await Podcast.create({
      userId: req.user.id,
      name,
      rssUrl,
      description: feedData.description,
      imageUrl: feedData.imageUrl,
      author: feedData.author,
      folderName: folderName || name.replace(/[^a-z0-9]/gi, '_'),
      driveFolderName: driveFolderName || name, // Default to podcast name
      keepEpisodeCount: keepEpisodeCount || 10
    });
    
    logger.info(`Created podcast: ${name}`);
    res.status(201).json(podcast);
  } catch (error) {
    logger.error('Error creating podcast:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update podcast
router.put('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    res.json(podcast);
  } catch (error) {
    logger.error('Error updating podcast:', error);
    res.status(500).json({ error: 'Failed to update podcast' });
  }
});

// Delete podcast
router.delete('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Delete all episodes
    await Episode.deleteMany({ podcast: req.params.id, userId: req.user.id });
    
    logger.info(`Deleted podcast: ${podcast.name}`);
    res.json({ message: 'Podcast deleted successfully' });
  } catch (error) {
    logger.error('Error deleting podcast:', error);
    res.status(500).json({ error: 'Failed to delete podcast' });
  }
});

// Refresh podcast feed
router.post('/:id/refresh', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    const episodes = await getLatestEpisodes(podcast.rssUrl, 10);
    let newCount = 0;
    
    for (const episodeData of episodes) {
      const exists = await Episode.findOne({ guid: episodeData.guid });
      if (!exists) {
        await Episode.create({
          userId: req.user.id,
          ...episodeData,
          podcast: podcast._id
        });
        newCount++;
      }
    }
    
    await Podcast.findByIdAndUpdate(podcast._id, { lastChecked: new Date() });
    
    logger.info(`Refreshed ${podcast.name}: ${newCount} new episodes`);
    res.json({ message: `Found ${newCount} new episodes`, newCount });
  } catch (error) {
    logger.error('Error refreshing podcast:', error);
    res.status(500).json({ error: 'Failed to refresh podcast' });
  }
});

export default router;
