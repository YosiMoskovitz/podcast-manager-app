import express from 'express';
import Podcast from '../models/Podcast.js';
import Episode from '../models/Episode.js';
import { parseFeed, getLatestEpisodes } from '../services/rssParser.js';
import { loadUserKey, decryptDocuments, decryptDocument, encryptDocument } from '../middleware/encryption.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Apply encryption middleware to all routes
router.use(loadUserKey);

// Get all podcasts
router.get('/', async (req, res) => {
  try {
    const podcasts = await Podcast.find({ userId: req.user.id });
    
    // Decrypt all podcasts
    const decryptedPodcasts = decryptDocuments(podcasts, req.userKey);
    
    // Sort by decrypted name
    decryptedPodcasts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    res.json(decryptedPodcasts);
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
    
    // Decrypt podcast and episodes
    decryptDocument(podcast, req.userKey);
    decryptDocuments(episodes, req.userKey);
    
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
    
    // Create podcast with virtual fields
    const podcast = new Podcast({
      userId: req.user.id,
      keepEpisodeCount: keepEpisodeCount || 10
    });
    
    // Set virtual fields (will be encrypted on save)
    podcast.name = name;
    podcast.rssUrl = rssUrl;
    podcast.description = feedData.description;
    podcast.imageUrl = feedData.imageUrl;
    podcast.author = feedData.author;
    podcast.folderName = folderName || name.replace(/[^a-z0-9]/gi, '_');
    podcast.driveFolderName = driveFolderName || name;
    
    // Encrypt before saving
    encryptDocument(podcast, req.userKey);
    await podcast.save();
    
    // Decrypt for response
    decryptDocument(podcast, req.userKey);
    
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
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Update virtual fields
    Object.keys(req.body).forEach(key => {
      podcast[key] = req.body[key];
    });
    
    // Encrypt and save
    encryptDocument(podcast, req.userKey);
    await podcast.save();
    
    // Decrypt for response
    decryptDocument(podcast, req.userKey);
    
    res.json(podcast);
  } catch (error) {
    logger.error('Error updating podcast:', error);
    res.status(500).json({ error: 'Failed to update podcast' });
  }
});

// Delete podcast
router.delete('/:id', async (req, res) => {
  try {
    const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Decrypt for logging
    decryptDocument(podcast, req.userKey);
    const podcastName = podcast.name;
    
    // Delete podcast and episodes
    await Podcast.findByIdAndDelete(req.params.id);
    await Episode.deleteMany({ podcast: req.params.id, userId: req.user.id });
    
    logger.info(`Deleted podcast: ${podcastName}`);
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
    
    // Decrypt to get RSS URL
    decryptDocument(podcast, req.userKey);
    
    // Validate RSS URL exists
    if (!podcast.rssUrl) {
      return res.status(400).json({ error: 'Podcast has no RSS URL configured' });
    }
    
    const episodes = await getLatestEpisodes(podcast.rssUrl, 10);
    let newCount = 0;
    
    for (const episodeData of episodes) {
      const exists = await Episode.findOne({ guid: episodeData.guid });
      if (!exists) {
        const episode = new Episode({
          userId: req.user.id,
          podcast: podcast._id,
          guid: episodeData.guid,
          pubDate: episodeData.pubDate,
          duration: episodeData.duration,
          fileSize: episodeData.fileSize,
          status: episodeData.status
        });
        
        // Set virtual fields
        episode.title = episodeData.title;
        episode.description = episodeData.description;
        episode.audioUrl = episodeData.audioUrl;
        
        // Encrypt and save
        encryptDocument(episode, req.userKey);
        await episode.save();
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
